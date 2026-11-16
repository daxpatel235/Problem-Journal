//! Writes laid-out pages to PDF bytes: embedded font subsets (CIDFontType2 +
//! ToUnicode, so text can be copied and searched), Flate-compressed page
//! streams, clickable links and a bookmark per problem.

use std::collections::BTreeMap;

use miniz_oxide::deflate::compress_to_vec_zlib;
use pdf_writer::types::{
    ActionType, AnnotationType, CidFontType, FontFlags, LineCapStyle, PageMode, SystemInfo,
    UnicodeCmap,
};
use pdf_writer::{Content, Date, Filter, Finish, Name, Pdf, Rect, Ref, Str, TextStr};
use rayon::prelude::*;

use super::fonts::{FontBook, FontId};
use super::layout::{Item, LinkTarget, Page, Usage, PAGE_H, PAGE_W};
use super::subset;

const COMPRESSION: u8 = 6;

pub struct OutlineEntry {
    pub title: String,
    pub page: usize,
}

pub struct Meta<'a> {
    pub title: &'a str,
    pub outline: &'a [OutlineEntry],
}

struct Refs(i32);

impl Refs {
    fn next(&mut self) -> Ref {
        self.0 += 1;
        Ref::new(self.0)
    }
}

fn font_resource_name(id: FontId) -> String {
    format!("F{id}")
}

/// Six-letter subset tag (PDF convention), stable for the same glyph set.
fn subset_tag(font: FontId, glyphs: &BTreeMap<u16, String>) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325 ^ u64::from(font);
    for gid in glyphs.keys() {
        hash ^= u64::from(*gid);
        hash = hash.wrapping_mul(0x0100_0000_01b3);
    }
    (0..6)
        .map(|i| (b'A' + ((hash >> (i * 5)) % 26) as u8) as char)
        .collect()
}

fn rounded_rect(c: &mut Content, x: f32, y: f32, w: f32, h: f32, r: f32) {
    let r = r.min(w / 2.0).min(h / 2.0).max(0.0);
    let k = 0.552_284_8 * r;
    c.move_to(x + r, y);
    c.line_to(x + w - r, y);
    c.cubic_to(x + w - r + k, y, x + w, y + r - k, x + w, y + r);
    c.line_to(x + w, y + h - r);
    c.cubic_to(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h);
    c.line_to(x + r, y + h);
    c.cubic_to(x + r - k, y + h, x, y + h - r + k, x, y + h - r);
    c.line_to(x, y + r);
    c.cubic_to(x, y + r - k, x + r - k, y, x + r, y);
    c.close_path();
}

fn circle(c: &mut Content, cx: f32, cy: f32, r: f32) {
    rounded_rect(c, cx - r, cy - r, r * 2.0, r * 2.0, r);
}

/// Width of a glyph in PDF glyph space (1000 units per em).
fn glyph_width(book: &FontBook, font: FontId, gid: u16) -> f32 {
    let f = book.font(font);
    f.advance(gid) * 1000.0 / f.units_per_em
}

/// Builds the content stream for one page (uncompressed).
fn page_content(book: &FontBook, page: &Page) -> Vec<u8> {
    let mut c = Content::new();
    for item in &page.items {
        match item {
            Item::Rect { x, y, w, h, fill } => {
                c.set_fill_rgb(fill[0], fill[1], fill[2]);
                c.rect(*x, PAGE_H - y - h, *w, *h);
                c.fill_nonzero();
            }
            Item::RoundRect { x, y, w, h, r, fill, stroke } => {
                if let Some(f) = fill {
                    c.set_fill_rgb(f[0], f[1], f[2]);
                }
                if let Some((s, width)) = stroke {
                    c.set_stroke_rgb(s[0], s[1], s[2]);
                    c.set_line_width(*width);
                }
                // Inset strokes by half their width so they sit inside the box.
                let inset = stroke.map(|(_, w)| w / 2.0).unwrap_or(0.0);
                rounded_rect(&mut c, x + inset, PAGE_H - y - h + inset, w - 2.0 * inset, h - 2.0 * inset, *r);
                match (fill.is_some(), stroke.is_some()) {
                    (true, true) => {
                        c.fill_nonzero_and_stroke();
                    }
                    (true, false) => {
                        c.fill_nonzero();
                    }
                    (false, true) => {
                        c.stroke();
                    }
                    (false, false) => {
                        c.end_path();
                    }
                }
            }
            Item::Line { x1, y1, x2, y2, width, color, dotted } => {
                c.save_state();
                c.set_stroke_rgb(color[0], color[1], color[2]);
                c.set_line_width(*width);
                if *dotted {
                    c.set_line_cap(LineCapStyle::RoundCap);
                    c.set_dash_pattern([0.0, width * 3.0], 0.0);
                }
                c.move_to(*x1, PAGE_H - y1);
                c.line_to(*x2, PAGE_H - y2);
                c.stroke();
                c.restore_state();
            }
            Item::Circle { cx, cy, r, fill } => {
                c.set_fill_rgb(fill[0], fill[1], fill[2]);
                circle(&mut c, *cx, PAGE_H - cy, *r);
                c.fill_nonzero();
            }
            Item::Text { glyphs, size, color } => {
                if glyphs.is_empty() {
                    continue;
                }
                c.begin_text();
                c.set_fill_rgb(color[0], color[1], color[2]);
                let mut current_font: Option<FontId> = None;
                let mut i = 0;
                while i < glyphs.len() {
                    let first = glyphs[i];
                    if current_font != Some(first.font) {
                        let name = font_resource_name(first.font);
                        c.set_font(Name(name.as_bytes()), *size);
                        current_font = Some(first.font);
                    }
                    // A run shares a font and a baseline (marks with a vertical
                    // offset start their own run).
                    let mut j = i + 1;
                    while j < glyphs.len()
                        && glyphs[j].font == first.font
                        && (glyphs[j].y - first.y).abs() < 0.001
                    {
                        j += 1;
                    }
                    c.set_text_matrix([1.0, 0.0, 0.0, 1.0, first.x, PAGE_H - first.y]);
                    {
                        let mut tj = c.show_positioned();
                        let mut items = tj.items();
                        let mut buf: Vec<u8> = Vec::with_capacity((j - i) * 2);
                        let run = &glyphs[i..j];
                        for (k, g) in run.iter().enumerate() {
                            buf.extend_from_slice(&g.gid.to_be_bytes());
                            if let Some(next) = run.get(k + 1) {
                                let natural = glyph_width(book, g.font, g.gid) * size / 1000.0;
                                let actual = next.x - g.x;
                                let adjust = (natural - actual) * 1000.0 / size;
                                if adjust.abs() > 0.05 {
                                    items.show(Str(&buf));
                                    buf.clear();
                                    items.adjust(adjust);
                                }
                            }
                        }
                        if !buf.is_empty() {
                            items.show(Str(&buf));
                        }
                    }
                    i = j;
                }
                c.end_text();
            }
            Item::Link { .. } => {}
        }
    }
    c.finish().to_vec()
}

fn pdf_rect(x: f32, y: f32, w: f32, h: f32) -> Rect {
    Rect::new(x, PAGE_H - y - h, x + w, PAGE_H - y)
}

/// Embeds one font: Type0 → CIDFontType2 → descriptor → subset file + ToUnicode.
#[allow(clippy::too_many_arguments)]
fn write_font(
    pdf: &mut Pdf,
    book: &FontBook,
    id: FontId,
    glyphs: &BTreeMap<u16, String>,
    file: &[u8],
    file_len: usize,
    refs: [Ref; 5],
) {
    let [type0_ref, cid_ref, descriptor_ref, file_ref, cmap_ref] = refs;
    let font = book.font(id);
    let base = format!("{}+{}", subset_tag(id, glyphs), font.name);
    let scale = 1000.0 / font.units_per_em;

    pdf.type0_font(type0_ref)
        .base_font(Name(base.as_bytes()))
        .encoding_predefined(Name(b"Identity-H"))
        .descendant_font(cid_ref)
        .to_unicode(cmap_ref);

    let system_info = SystemInfo { registry: Str(b"Adobe"), ordering: Str(b"Identity"), supplement: 0 };
    {
        let mut cid = pdf.cid_font(cid_ref);
        cid.subtype(CidFontType::Type2)
            .base_font(Name(base.as_bytes()))
            .system_info(system_info)
            .font_descriptor(descriptor_ref)
            .default_width(0.0)
            .cid_to_gid_map_predefined(Name(b"Identity"));
        let mut widths = cid.widths();
        // Group consecutive glyph ids into one entry each.
        let ids: Vec<u16> = glyphs.keys().copied().collect();
        let mut start = 0;
        while start < ids.len() {
            let mut end = start + 1;
            while end < ids.len() && ids[end] == ids[end - 1] + 1 {
                end += 1;
            }
            widths.consecutive(ids[start], ids[start..end].iter().map(|&g| glyph_width(book, id, g)));
            start = end;
        }
        widths.finish();
        cid.finish();
    }

    let mut flags = FontFlags::SYMBOLIC;
    if font.monospaced {
        flags |= FontFlags::FIXED_PITCH;
    }
    pdf.font_descriptor(descriptor_ref)
        .name(Name(base.as_bytes()))
        .flags(flags)
        .bbox(Rect::new(
            font.bbox[0] * scale,
            font.bbox[1] * scale,
            font.bbox[2] * scale,
            font.bbox[3] * scale,
        ))
        .italic_angle(font.italic_angle)
        .ascent(font.ascender * scale)
        .descent(font.descender * scale)
        .cap_height(font.cap_height * scale)
        .stem_v(if font.bold { 120.0 } else { 80.0 })
        .font_file2(file_ref);

    pdf.stream(file_ref, file)
        .filter(Filter::FlateDecode)
        .pair(Name(b"Length1"), file_len as i32);

    let mut cmap: UnicodeCmap = UnicodeCmap::new(
        Name(b"Custom"),
        SystemInfo { registry: Str(b"Adobe"), ordering: Str(b"UCS"), supplement: 0 },
    );
    for (gid, text) in glyphs {
        if !text.is_empty() {
            cmap.pair_with_multiple(*gid, text.chars());
        }
    }
    let cmap_data = cmap.finish();
    pdf.stream(cmap_ref, &cmap_data);
}

pub fn write(
    book: &FontBook,
    pages: &[Page],
    usage: &Usage,
    meta: &Meta,
) -> Result<Vec<u8>, String> {
    // Heavy work first, in parallel: page streams and font subsets.
    let contents: Vec<Vec<u8>> = pages
        .par_iter()
        .map(|page| compress_to_vec_zlib(&page_content(book, page), COMPRESSION))
        .collect();

    let mut font_ids: Vec<FontId> = usage.keys().copied().filter(|id| !usage[id].is_empty()).collect();
    font_ids.sort_unstable();
    let font_files: Vec<(Vec<u8>, usize)> = font_ids
        .par_iter()
        .map(|&id| {
            let font = book.font(id);
            let gids: std::collections::BTreeSet<u16> = usage[&id].keys().copied().collect();
            let data = subset::subset(font.data, font.index, &gids).map_err(|e| format!("{} ({})", e, font.name))?;
            Ok((compress_to_vec_zlib(&data, COMPRESSION), data.len()))
        })
        .collect::<Result<_, String>>()?;

    // Object ids.
    let mut refs = Refs(0);
    let catalog_ref = refs.next();
    let tree_ref = refs.next();
    let info_ref = refs.next();
    let page_refs: Vec<Ref> = pages.iter().map(|_| refs.next()).collect();
    let content_refs: Vec<Ref> = pages.iter().map(|_| refs.next()).collect();
    let font_refs: Vec<[Ref; 5]> = font_ids
        .iter()
        .map(|_| [refs.next(), refs.next(), refs.next(), refs.next(), refs.next()])
        .collect();
    let annotation_refs: Vec<Vec<Ref>> = pages
        .iter()
        .map(|p| {
            p.items
                .iter()
                .filter(|i| matches!(i, Item::Link { .. }))
                .map(|_| refs.next())
                .collect()
        })
        .collect();
    let outline_ref = (!meta.outline.is_empty()).then(|| refs.next());
    let outline_item_refs: Vec<Ref> = meta.outline.iter().map(|_| refs.next()).collect();

    let mut pdf = Pdf::new();

    {
        let mut catalog = pdf.catalog(catalog_ref);
        catalog.pages(tree_ref);
        if let Some(outline) = outline_ref {
            catalog.outlines(outline).page_mode(PageMode::UseOutlines);
        }
    }

    {
        let now = chrono::Local::now();
        use chrono::{Datelike, Timelike};
        let mut info = pdf.document_info(info_ref);
        info.title(TextStr(meta.title))
            .creator(TextStr("Problem Journal"))
            .producer(TextStr("Problem Journal PDF engine"))
            .creation_date(
                Date::new(now.year().clamp(0, 9999) as u16)
                    .month(now.month() as u8)
                    .day(now.day() as u8)
                    .hour(now.hour() as u8)
                    .minute(now.minute() as u8),
            );
    }

    pdf.pages(tree_ref).kids(page_refs.iter().copied()).count(pages.len() as i32);

    let font_names: Vec<String> = font_ids.iter().map(|&id| font_resource_name(id)).collect();
    for (index, page) in pages.iter().enumerate() {
        {
            let mut p = pdf.page(page_refs[index]);
            p.media_box(Rect::new(0.0, 0.0, PAGE_W, PAGE_H))
                .parent(tree_ref)
                .contents(content_refs[index]);
            {
                let mut resources = p.resources();
                let mut fonts = resources.fonts();
                for (k, name) in font_names.iter().enumerate() {
                    fonts.pair(Name(name.as_bytes()), font_refs[k][0]);
                }
            }
            if !annotation_refs[index].is_empty() {
                p.annotations(annotation_refs[index].iter().copied());
            }
        }

        pdf.stream(content_refs[index], &contents[index]).filter(Filter::FlateDecode);

        let links = page.items.iter().filter_map(|i| match i {
            Item::Link { x, y, w, h, target } => Some((*x, *y, *w, *h, target)),
            _ => None,
        });
        for (k, (x, y, w, h, target)) in links.enumerate() {
            let mut a = pdf.annotation(annotation_refs[index][k]);
            a.subtype(AnnotationType::Link)
                .rect(pdf_rect(x, y, w, h))
                .border(0.0, 0.0, 0.0, None);
            match target {
                LinkTarget::Uri(uri) => {
                    a.action().action_type(ActionType::Uri).uri(Str(uri.as_bytes()));
                }
                LinkTarget::Page(target) => {
                    if let Some(&dest) = page_refs.get(*target) {
                        a.action().action_type(ActionType::GoTo).destination().page(dest).xyz(0.0, PAGE_H, None);
                    }
                }
            }
        }
    }

    for (k, &id) in font_ids.iter().enumerate() {
        let (file, len) = &font_files[k];
        write_font(&mut pdf, book, id, &usage[&id], file, *len, font_refs[k]);
    }

    if let Some(outline_ref) = outline_ref {
        let n = outline_item_refs.len();
        pdf.outline(outline_ref)
            .first(outline_item_refs[0])
            .last(outline_item_refs[n - 1])
            .count(n as i32);
        for (k, entry) in meta.outline.iter().enumerate() {
            let mut item = pdf.outline_item(outline_item_refs[k]);
            item.title(TextStr(&entry.title)).parent(outline_ref);
            if k > 0 {
                item.prev(outline_item_refs[k - 1]);
            }
            if k + 1 < n {
                item.next(outline_item_refs[k + 1]);
            }
            if let Some(&dest) = page_refs.get(entry.page) {
                item.dest().page(dest).xyz(0.0, PAGE_H, None);
            }
        }
    }

    Ok(pdf.finish())
}
