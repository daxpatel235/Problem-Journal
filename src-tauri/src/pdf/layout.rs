//! Turns problems into positioned page items (text, boxes, lines, links).
//!
//! Coordinates here are in points with y growing *down* from the top of the
//! page; the writer flips them for PDF. The look follows the approved design:
//! A4, light, Inter for text, JetBrains Mono for code, editor section order,
//! and empty fields left out.

use std::collections::{BTreeMap, HashMap};
use std::ops::Range;

use super::fonts::{FontBook, FontId, Shaped, Style};
use super::highlight::{self, Token};
use crate::models::problem::Problem;

// ---------- page geometry ----------

pub const MM: f32 = 72.0 / 25.4;
pub const PAGE_W: f32 = 210.0 * MM;
pub const PAGE_H: f32 = 297.0 * MM;
const LEFT: f32 = 18.0 * MM;
const RIGHT: f32 = PAGE_W - 18.0 * MM;
const CONTENT_W: f32 = RIGHT - LEFT;
const TOP: f32 = 14.0 * MM;
const BOTTOM: f32 = 12.0 * MM;

const RUN_SIZE: f32 = 7.5; // header/footer text
const RUN_LINE: f32 = RUN_SIZE * 1.4;
const HEADER_RULE_Y: f32 = TOP + RUN_LINE + 2.5 * MM;
const CONTENT_TOP: f32 = HEADER_RULE_Y + 7.0 * MM;
const FOOTER_TOP: f32 = PAGE_H - BOTTOM - RUN_LINE;
const CONTENT_BOTTOM: f32 = FOOTER_TOP - 3.0 * MM;

const SECTION_GAP: f32 = 5.2 * MM;
const BODY: f32 = 10.0;
const BODY_LH: f32 = 1.5;
const HAIRLINE: f32 = 0.25 * MM;

// ---------- colors (the PDF is always light) ----------

pub fn rgb(hex: u32) -> [f32; 3] {
    [
        ((hex >> 16) & 0xFF) as f32 / 255.0,
        ((hex >> 8) & 0xFF) as f32 / 255.0,
        (hex & 0xFF) as f32 / 255.0,
    ]
}

struct Palette;
impl Palette {
    fn ink() -> [f32; 3] { rgb(0x1F1F1F) }
    fn ink_soft() -> [f32; 3] { rgb(0x4B4B4B) }
    fn faint() -> [f32; 3] { rgb(0x8A8A8A) }
    fn rule() -> [f32; 3] { rgb(0xE2E2E2) }
    fn tint() -> [f32; 3] { rgb(0xF5F7FA) }
    fn paper() -> [f32; 3] { rgb(0xFFFFFF) }
    fn accent() -> [f32; 3] { rgb(0x005FB8) }
    fn code_bg() -> [f32; 3] { rgb(0xFAFAFA) }
    fn gutter() -> [f32; 3] { rgb(0x9A9A9A) }
}

pub fn difficulty_color(difficulty: &str) -> [f32; 3] {
    match difficulty.trim().to_ascii_lowercase().as_str() {
        "easy" => rgb(0x257D3B),
        "medium" => rgb(0xA67302),
        "hard" => rgb(0xCD3131),
        _ => Palette::ink_soft(),
    }
}

// ---------- page model ----------

#[derive(Debug, Clone, Copy)]
pub struct PlacedGlyph {
    pub font: FontId,
    pub gid: u16,
    /// Absolute page position of the glyph origin (y = baseline, from top).
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone)]
pub enum LinkTarget {
    Uri(String),
    /// Index of the destination page in the final document.
    Page(usize),
}

#[derive(Debug, Clone)]
pub enum Item {
    Text { glyphs: Vec<PlacedGlyph>, size: f32, color: [f32; 3] },
    Rect { x: f32, y: f32, w: f32, h: f32, fill: [f32; 3] },
    RoundRect {
        x: f32,
        y: f32,
        w: f32,
        h: f32,
        r: f32,
        fill: Option<[f32; 3]>,
        stroke: Option<([f32; 3], f32)>,
    },
    Line { x1: f32, y1: f32, x2: f32, y2: f32, width: f32, color: [f32; 3], dotted: bool },
    Circle { cx: f32, cy: f32, r: f32, fill: [f32; 3] },
    Link { x: f32, y: f32, w: f32, h: f32, target: LinkTarget },
}

#[derive(Debug, Clone, Default)]
pub struct Page {
    pub items: Vec<Item>,
}

/// Which glyphs each font used, with the text they stand for (for copy/search).
pub type Usage = HashMap<FontId, BTreeMap<u16, String>>;

pub fn merge_usage(into: &mut Usage, from: Usage) {
    for (font, glyphs) in from {
        let target = into.entry(font).or_default();
        for (gid, text) in glyphs {
            target.entry(gid).or_insert(text);
        }
    }
}

// ---------- line breaking ----------

struct LineRange {
    start: usize,
    /// End of the drawn glyphs (trailing spaces excluded).
    draw_end: usize,
    width: f32,
}

fn char_at(shaped: &Shaped, cluster: usize) -> char {
    shaped.text.get(cluster..).and_then(|s| s.chars().next()).unwrap_or(' ')
}

/// Greedy line breaking on shaped text. Prefers breaking at spaces (and after
/// `- / _ , ;`), never splits a cluster, and hard-breaks words wider than the
/// line. `rest_w` is the width of every line after the first.
fn break_lines(shaped: &Shaped, first_w: f32, rest_w: f32, anywhere: bool) -> Vec<LineRange> {
    let g = &shaped.glyphs;
    let n = g.len();
    if n == 0 {
        return vec![LineRange { start: 0, draw_end: 0, width: 0.0 }];
    }
    let is_space = |i: usize| char_at(shaped, g[i].cluster).is_whitespace();
    let boundary = |i: usize| i > 0 && g[i].cluster != g[i - 1].cluster;
    let can_break_before = |i: usize| {
        if !boundary(i) || is_space(i) {
            return false;
        }
        anywhere || is_space(i - 1) || matches!(char_at(shaped, g[i - 1].cluster), '-' | '/' | '_' | ',' | ';')
    };

    let mut lines = Vec::new();
    let mut start = 0usize;
    while start < n {
        if !lines.is_empty() {
            while start < n && is_space(start) {
                start += 1;
            }
            if start >= n {
                break;
            }
        }
        let max_w = if lines.is_empty() { first_w } else { rest_w };
        let origin = g[start].x;
        let mut last_break: Option<usize> = None;
        let mut end = n;
        let mut i = start;
        while i < n {
            if i > start && can_break_before(i) {
                last_break = Some(i);
            }
            let right = g[i].x + g[i].advance - origin;
            if right > max_w && i > start && !is_space(i) {
                end = match last_break {
                    Some(b) if b > start => b,
                    _ => {
                        // Hard break at the last cluster boundary that fits.
                        let mut j = i;
                        while j > start + 1 && !boundary(j) {
                            j -= 1;
                        }
                        if j <= start {
                            j = start + 1;
                            while j < n && !boundary(j) {
                                j += 1;
                            }
                        }
                        j
                    }
                };
                break;
            }
            i += 1;
        }
        let mut draw_end = end;
        while draw_end > start && is_space(draw_end - 1) {
            draw_end -= 1;
        }
        let width = if draw_end > start {
            g[draw_end - 1].x + g[draw_end - 1].advance - origin
        } else {
            0.0
        };
        lines.push(LineRange { start, draw_end, width });
        start = end;
    }
    if lines.is_empty() {
        lines.push(LineRange { start: 0, draw_end: 0, width: 0.0 });
    }
    lines
}

// ---------- layout context ----------

/// A box drawn behind content that may continue on the next page.
struct Frag {
    page: usize,
    insert_at: usize,
    top: f32,
}

pub struct Ctx<'a> {
    book: &'a FontBook,
    pub pages: Vec<Page>,
    y: f32,
    pub usage: Usage,
}

impl<'a> Ctx<'a> {
    pub fn new(book: &'a FontBook) -> Self {
        let mut ctx = Ctx { book, pages: Vec::new(), y: CONTENT_TOP, usage: Usage::new() };
        ctx.new_page();
        ctx
    }

    fn new_page(&mut self) {
        self.pages.push(Page::default());
        self.y = CONTENT_TOP;
    }

    fn page(&mut self) -> &mut Page {
        self.pages.last_mut().expect("at least one page")
    }

    fn at_top(&self) -> bool {
        self.y <= CONTENT_TOP + 0.5
    }

    /// Starts a new page if `h` doesn't fit (unless we're already at the top).
    fn ensure(&mut self, h: f32) {
        if self.y + h > CONTENT_BOTTOM && !self.at_top() {
            self.new_page();
        }
    }

    fn gap(&mut self, h: f32) {
        if !self.at_top() {
            self.y += h;
        }
    }

    fn push(&mut self, item: Item) {
        self.page().items.push(item);
    }

    fn shape(&self, text: &str, style: Style, size: f32, tracking: f32) -> Shaped {
        self.book.shape(text, style, size, tracking)
    }

    /// Baseline for a line box of height `h` starting at `top`.
    fn baseline(&self, style: Style, size: f32, top: f32, h: f32) -> f32 {
        let (asc, desc) = self.book.metrics(style, size);
        top + (h - (asc + desc)) / 2.0 + asc
    }

    fn record_usage(&mut self, shaped: &Shaped, range: Range<usize>) {
        let g = &shaped.glyphs;
        for (i, glyph) in g.iter().copied().enumerate().take(range.end).skip(range.start) {
            let entry = self.usage.entry(glyph.font).or_default();
            if entry.contains_key(&glyph.gid) {
                continue;
            }
            let first_of_cluster = i == 0 || g[i - 1].cluster != glyph.cluster;
            let text = if first_of_cluster {
                let end = g[i + 1..]
                    .iter()
                    .map(|n| n.cluster)
                    .find(|&c| c > glyph.cluster)
                    .unwrap_or(shaped.text.len());
                shaped.text.get(glyph.cluster..end).unwrap_or("").to_string()
            } else {
                String::new()
            };
            if !text.is_empty() {
                entry.insert(glyph.gid, text);
            }
        }
    }

    /// Draws glyphs `range` of `shaped` with the first one at `x`.
    fn place(&mut self, shaped: &Shaped, range: Range<usize>, x: f32, baseline: f32, size: f32, color: [f32; 3]) {
        if range.is_empty() {
            return;
        }
        let x0 = shaped.glyphs[range.start].x;
        let glyphs = shaped.glyphs[range.clone()]
            .iter()
            .map(|g| PlacedGlyph {
                font: g.font,
                gid: g.gid,
                x: x + g.x - x0 + g.x_offset,
                y: baseline - g.y_offset,
            })
            .collect();
        self.push(Item::Text { glyphs, size, color });
        self.record_usage(shaped, range);
    }

    /// Shapes and draws a single line, cut with "…" if wider than `max_w`.
    fn fitted(&self, text: &str, style: Style, size: f32, tracking: f32, max_w: f32) -> Shaped {
        let shaped = self.shape(text, style, size, tracking);
        if shaped.width <= max_w {
            return shaped;
        }
        let ellipsis = self.shape("…", style, size, tracking).width;
        let limit = (max_w - ellipsis).max(0.0);
        let cut = shaped
            .glyphs
            .iter()
            .find(|g| g.x + g.advance > limit)
            .map(|g| g.cluster)
            .unwrap_or(shaped.text.len());
        let prefix = shaped.text.get(..cut).unwrap_or("").trim_end();
        self.shape(&format!("{prefix}…"), style, size, tracking)
    }

    /// Lays out multi-line text (newlines kept, long lines wrapped).
    /// `on_line` runs for every visual line with (ctx, line index, top, height,
    /// width) so callers can add bullets, numbers or link boxes.
    #[allow(clippy::too_many_arguments)]
    fn text_lines(
        &mut self,
        text: &str,
        style: Style,
        size: f32,
        lh: f32,
        color: [f32; 3],
        x: f32,
        width: f32,
        anywhere: bool,
        mut on_line: impl FnMut(&mut Self, usize, f32, f32, f32),
    ) {
        let h = size * lh;
        let mut index = 0;
        for raw in text.split('\n') {
            let raw = raw.strip_suffix('\r').unwrap_or(raw);
            let shaped = self.shape(raw, style, size, 0.0);
            for line in break_lines(&shaped, width, width, anywhere) {
                self.ensure(h);
                let top = self.y;
                let baseline = self.baseline(style, size, top, h);
                self.place(&shaped, line.start..line.draw_end, x, baseline, size, color);
                on_line(self, index, top, h, line.width);
                index += 1;
                self.y += h;
            }
        }
    }

    fn paragraph(&mut self, text: &str) {
        self.text_lines(text, Style::Regular, BODY, BODY_LH, Palette::ink(), LEFT, CONTENT_W, false, |_, _, _, _, _| {});
    }

    fn frag_start(&mut self) -> Frag {
        Frag { page: self.pages.len() - 1, insert_at: self.page().items.len(), top: self.y }
    }

    /// Inserts `behind` under everything drawn since `frag` started.
    fn frag_end(&mut self, frag: Frag, behind: Vec<Item>) {
        let items = &mut self.pages[frag.page].items;
        let at = frag.insert_at.min(items.len());
        items.splice(at..at, behind);
    }
}

// ---------- problem page pieces ----------

fn non_empty(items: &[String]) -> Vec<&str> {
    items.iter().map(|s| s.trim_end()).filter(|s| !s.trim().is_empty()).collect()
}

/// Uppercase section label with a hairline running to the right edge.
fn section_heading(ctx: &mut Ctx, title: &str, keep_with: f32) {
    let size = 8.0;
    let h = size * 1.4;
    ctx.gap(SECTION_GAP);
    ctx.ensure(h + 2.0 * MM + keep_with);
    let shaped = ctx.shape(&title.to_uppercase(), Style::Bold, size, size * 0.1);
    let top = ctx.y;
    let baseline = ctx.baseline(Style::Bold, size, top, h);
    let n = shaped.glyphs.len();
    let width = shaped.width - size * 0.1;
    ctx.place(&shaped, 0..n, LEFT, baseline, size, Palette::accent());
    let mid = baseline - size * 0.36;
    let x1 = LEFT + width + 2.5 * MM;
    if x1 < RIGHT {
        ctx.push(Item::Line { x1, y1: mid, x2: RIGHT, y2: mid, width: HAIRLINE, color: Palette::rule(), dotted: false });
    }
    ctx.y += h + 2.0 * MM;
}

fn numbered_list(ctx: &mut Ctx, items: &[&str]) {
    let num_w = 6.0 * MM;
    for (i, item) in items.iter().enumerate() {
        if i > 0 {
            ctx.y += 1.2 * MM;
        }
        let label = ctx.shape(&format!("{}.", i + 1), Style::Regular, BODY * 0.92, 0.0);
        ctx.text_lines(
            item,
            Style::Regular,
            BODY,
            BODY_LH,
            Palette::ink(),
            LEFT + num_w,
            CONTENT_W - num_w,
            false,
            |ctx, line, top, h, _| {
                if line == 0 {
                    let baseline = ctx.baseline(Style::Regular, BODY, top, h);
                    let x = LEFT + num_w - 1.5 * MM - label.width;
                    let n = label.glyphs.len();
                    ctx.place(&label, 0..n, x, baseline, BODY * 0.92, Palette::faint());
                }
            },
        );
    }
}

fn header_block(ctx: &mut Ctx, p: &Problem) {
    // Title
    let title = if p.problem_name.trim().is_empty() { "Untitled problem" } else { p.problem_name.trim() };
    ctx.text_lines(title, Style::Bold, 19.0, 1.2, Palette::ink(), LEFT, CONTENT_W, false, |_, _, _, _, _| {});

    // Difficulty pill
    if !p.difficulty.trim().is_empty() {
        ctx.y += 3.2 * MM;
        let size = 8.0;
        let color = difficulty_color(&p.difficulty);
        let text = ctx.shape(p.difficulty.trim(), Style::SemiBold, size, 0.0);
        let pad = 2.4 * MM;
        let dot = 1.5 * MM;
        let h = size + 2.2 * MM;
        let w = pad + dot + 1.2 * MM + text.width + pad;
        ctx.ensure(h);
        let top = ctx.y;
        ctx.push(Item::RoundRect { x: LEFT, y: top, w, h, r: h / 2.0, fill: None, stroke: Some((color, HAIRLINE)) });
        ctx.push(Item::Circle { cx: LEFT + pad + dot / 2.0, cy: top + h / 2.0, r: dot / 2.0, fill: color });
        let baseline = top + h / 2.0 + size * 0.36;
        let n = text.glyphs.len();
        ctx.place(&text, 0..n, LEFT + pad + dot + 1.2 * MM, baseline, size, color);
        ctx.y += h;
    }

    // Topic / Platform / Pattern Category
    let fields: Vec<(&str, &str)> = [
        ("Topic", p.topic.trim()),
        ("Platform", p.platform.trim()),
        ("Pattern Category", p.pattern_category.trim()),
    ]
    .into_iter()
    .filter(|(_, v)| !v.is_empty())
    .collect();
    if !fields.is_empty() {
        ctx.y += 4.0 * MM;
        let label_size = 7.0;
        let value_size = 9.5;
        let label_h = label_size * 1.4;
        let value_h = value_size * 1.4;
        let col_gap = 9.0 * MM;
        let mut x = LEFT;
        let mut row_h: f32 = 0.0;
        for (label, value) in fields {
            let l = ctx.shape(&label.to_uppercase(), Style::SemiBold, label_size, label_size * 0.08);
            let v = ctx.shape(value, Style::SemiBold, value_size, 0.0);
            let lines = break_lines(&v, CONTENT_W, CONTENT_W, false);
            let col_w = l.width.max(lines.iter().fold(0.0, |m, ln| ln.width.max(m)));
            if x > LEFT && x + col_w > RIGHT {
                ctx.y += row_h + 1.0 * MM;
                x = LEFT;
                row_h = 0.0;
            }
            let h = label_h + value_h * lines.len() as f32;
            ctx.ensure(h);
            let top = ctx.y;
            let lb = ctx.baseline(Style::SemiBold, label_size, top, label_h);
            let ln = l.glyphs.len();
            ctx.place(&l, 0..ln, x, lb, label_size, Palette::faint());
            for (i, line) in lines.iter().enumerate() {
                let vt = top + label_h + value_h * i as f32;
                let vb = ctx.baseline(Style::SemiBold, value_size, vt, value_h);
                ctx.place(&v, line.start..line.draw_end, x, vb, value_size, Palette::ink());
            }
            row_h = row_h.max(h);
            x += col_w + col_gap;
        }
        ctx.y += row_h;
    }

    // Tags
    let tags = non_empty(&p.tags);
    if !tags.is_empty() {
        ctx.y += 3.5 * MM;
        let size = 7.5;
        let pad_x = 2.0 * MM;
        let h = size * 1.3 + 1.6 * MM;
        let gap = 1.5 * MM;
        let mut x = LEFT;
        ctx.ensure(h);
        for tag in tags {
            let t = ctx.fitted(tag.trim(), Style::Regular, size, 0.0, CONTENT_W - 2.0 * pad_x);
            let w = t.width + 2.0 * pad_x;
            if x > LEFT && x + w > RIGHT {
                ctx.y += h + gap;
                x = LEFT;
                ctx.ensure(h);
            }
            let top = ctx.y;
            ctx.push(Item::RoundRect { x, y: top, w, h, r: 1.0 * MM, fill: Some(Palette::tint()), stroke: None });
            let baseline = ctx.baseline(Style::Regular, size, top, h);
            let n = t.glyphs.len();
            ctx.place(&t, 0..n, x + pad_x, baseline, size, Palette::ink_soft());
            x += w + gap;
        }
        ctx.y += h;
    }

    // URL (clickable)
    let url = p.url.trim();
    if !url.is_empty() {
        ctx.y += 2.5 * MM;
        let target = if url.contains("://") { url.to_string() } else { format!("https://{url}") };
        ctx.text_lines(url, Style::Regular, 8.0, 1.4, Palette::accent(), LEFT, CONTENT_W, true, |ctx, _, top, h, w| {
            ctx.push(Item::Link { x: LEFT, y: top, w, h, target: LinkTarget::Uri(target.clone()) });
        });
    }
}

fn examples_section(ctx: &mut Ctx, examples: &[&str]) {
    let label_size = 7.5;
    let size = 8.5;
    let lh = size * 1.55;
    let pad_y = 2.0 * MM;
    let bar = 0.7 * MM;
    let text_x = LEFT + bar + 3.0 * MM;
    let text_w = RIGHT - 3.0 * MM - text_x;

    let draw = |top: f32, bottom: f32| -> Vec<Item> {
        vec![
            Item::Rect { x: LEFT, y: top, w: CONTENT_W, h: bottom - top, fill: Palette::tint() },
            Item::Rect { x: LEFT, y: top, w: bar, h: bottom - top, fill: Palette::rule() },
        ]
    };

    for (i, example) in examples.iter().enumerate() {
        if i > 0 {
            ctx.y += 2.0 * MM;
        }
        // Label + first line stay together.
        ctx.ensure(pad_y + label_size * 1.6 + lh + pad_y);
        let mut frag = ctx.frag_start();
        ctx.y += pad_y;

        let label = ctx.shape(&format!("EXAMPLE {}", i + 1), Style::SemiBold, label_size, label_size * 0.06);
        let lb = ctx.baseline(Style::SemiBold, label_size, ctx.y, label_size * 1.6);
        let n = label.glyphs.len();
        ctx.place(&label, 0..n, text_x, lb, label_size, Palette::faint());
        ctx.y += label_size * 1.6;

        for raw in example.split('\n') {
            let raw = raw.strip_suffix('\r').unwrap_or(raw);
            let shaped = ctx.shape(raw, Style::Mono, size, 0.0);
            for line in break_lines(&shaped, text_w, text_w, false) {
                if ctx.y + lh + pad_y > CONTENT_BOTTOM {
                    let bottom = ctx.y + pad_y;
                    let top = frag.top;
                    ctx.frag_end(frag, draw(top, bottom));
                    ctx.new_page();
                    frag = ctx.frag_start();
                    ctx.y += pad_y;
                }
                let baseline = ctx.baseline(Style::Mono, size, ctx.y, lh);
                ctx.place(&shaped, line.start..line.draw_end, text_x, baseline, size, Palette::ink());
                ctx.y += lh;
            }
        }
        ctx.y += pad_y;
        let (top, bottom) = (frag.top, ctx.y);
        ctx.frag_end(frag, draw(top, bottom));
    }
}

fn complexity_section(ctx: &mut Ctx, p: &Problem) {
    let rows: Vec<(&str, &str, &str)> = [
        ("Brute Force", p.brute_force_time_complexity.trim(), p.brute_force_space_complexity.trim()),
        ("Optimal", p.time_complexity.trim(), p.space_complexity.trim()),
    ]
    .into_iter()
    .filter(|(_, t, s)| !t.is_empty() || !s.is_empty())
    .collect();
    if rows.is_empty() {
        return;
    }
    let show_time = rows.iter().any(|r| !r.1.is_empty());
    let show_space = rows.iter().any(|r| !r.2.is_empty());

    let head_size = 7.0;
    let size = 9.0;
    let pad_y = 1.4 * MM;
    let col_pad = 7.0 * MM;
    let line_h = size * 1.5;

    section_heading(ctx, "Complexity", line_h * 2.0 + pad_y * 4.0);

    let label_w = rows
        .iter()
        .map(|r| ctx.shape(r.0, Style::SemiBold, size, 0.0).width)
        .fold(0.0f32, f32::max)
        + col_pad;
    let mut columns: Vec<(&str, usize)> = Vec::new();
    if show_time {
        columns.push(("TIME", 1));
    }
    if show_space {
        columns.push(("SPACE", 2));
    }
    let natural: Vec<f32> = columns
        .iter()
        .map(|&(head, idx)| {
            let head_w = ctx.shape(head, Style::SemiBold, head_size, head_size * 0.08).width;
            rows.iter()
                .map(|r| ctx.shape(if idx == 1 { r.1 } else { r.2 }, Style::Mono, size, 0.0).width)
                .fold(head_w, f32::max)
                + col_pad
        })
        .collect();
    let available = CONTENT_W - label_w;
    let total: f32 = natural.iter().sum();
    let widths: Vec<f32> = if total <= available {
        natural
    } else {
        vec![available / columns.len() as f32; columns.len()]
    };

    // Header row
    let head_h = head_size * 1.4 + pad_y * 2.0;
    ctx.ensure(head_h);
    let top = ctx.y;
    let mut x = LEFT + label_w;
    for (i, &(head, _)) in columns.iter().enumerate() {
        let s = ctx.shape(head, Style::SemiBold, head_size, head_size * 0.08);
        let b = ctx.baseline(Style::SemiBold, head_size, top + pad_y, head_size * 1.4);
        let n = s.glyphs.len();
        ctx.place(&s, 0..n, x, b, head_size, Palette::faint());
        x += widths[i];
    }
    let table_right = (LEFT + label_w + widths.iter().sum::<f32>()).min(RIGHT);
    ctx.y += head_h;
    ctx.push(Item::Line { x1: LEFT, y1: ctx.y, x2: table_right, y2: ctx.y, width: HAIRLINE, color: Palette::rule(), dotted: false });

    // Body rows
    for row in rows {
        let cells: Vec<(Shaped, Vec<LineRange>)> = columns
            .iter()
            .zip(&widths)
            .map(|(&(_, idx), &w)| {
                let s = ctx.shape(if idx == 1 { row.1 } else { row.2 }, Style::Mono, size, 0.0);
                let lines = break_lines(&s, w - col_pad, w - col_pad, false);
                (s, lines)
            })
            .collect();
        let lines = cells.iter().map(|c| c.1.len()).max().unwrap_or(1).max(1);
        let h = line_h * lines as f32 + pad_y * 2.0;
        ctx.ensure(h);
        let top = ctx.y + pad_y;
        let label = ctx.shape(row.0, Style::SemiBold, size, 0.0);
        let b = ctx.baseline(Style::SemiBold, size, top, line_h);
        let n = label.glyphs.len();
        ctx.place(&label, 0..n, LEFT, b, size, Palette::ink());
        let mut x = LEFT + label_w;
        for ((shaped, lines), w) in cells.iter().zip(&widths) {
            for (i, line) in lines.iter().enumerate() {
                let lt = top + line_h * i as f32;
                let b = ctx.baseline(Style::Mono, size, lt, line_h);
                ctx.place(shaped, line.start..line.draw_end, x, b, size, Palette::ink());
            }
            x += w;
        }
        ctx.y += h;
        ctx.push(Item::Line { x1: LEFT, y1: ctx.y, x2: table_right, y2: ctx.y, width: HAIRLINE, color: Palette::rule(), dotted: false });
    }
}

pub fn language_label(language: &str) -> String {
    match language.trim().to_ascii_lowercase().as_str() {
        "python" => "Python".into(),
        "cpp" | "c++" => "C++".into(),
        "java" => "Java".into(),
        "javascript" => "JavaScript".into(),
        "typescript" => "TypeScript".into(),
        "rust" => "Rust".into(),
        "go" => "Go".into(),
        "c" => "C".into(),
        "csharp" => "C#".into(),
        "kotlin" => "Kotlin".into(),
        "" => "Code".into(),
        _ => language.trim().to_string(),
    }
}

fn code_section(ctx: &mut Ctx, p: &Problem) {
    let code = p.code.replace("\r\n", "\n").replace('\t', "    ");
    let mut lines: Vec<&str> = code.split('\n').collect();
    while lines.last().is_some_and(|l| l.trim().is_empty()) {
        lines.pop();
    }
    if lines.is_empty() {
        return;
    }
    let spans = highlight::highlight(&lines.join("\n"), &p.language);

    let size = 8.4;
    let lh = size * 1.6;
    let pad_y = 2.5 * MM;
    let head_size = 7.5;
    let head_h = head_size * 1.4 + 3.0 * MM;
    let gutter = 9.0 * MM;
    let code_x = LEFT + gutter;
    let code_w = RIGHT - 3.0 * MM - code_x;
    let radius = 1.2 * MM;

    section_heading(ctx, "Code", head_h + pad_y + lh * 2.0);

    let draw = |top: f32, bottom: f32, with_header: bool| -> Vec<Item> {
        let mut items = vec![Item::RoundRect {
            x: LEFT,
            y: top,
            w: CONTENT_W,
            h: bottom - top,
            r: radius,
            fill: Some(Palette::code_bg()),
            stroke: None,
        }];
        if with_header {
            items.push(Item::RoundRect { x: LEFT, y: top, w: CONTENT_W, h: head_h, r: radius, fill: Some(Palette::paper()), stroke: None });
            items.push(Item::Rect { x: LEFT, y: top + head_h - radius, w: CONTENT_W, h: radius, fill: Palette::paper() });
            items.push(Item::Line { x1: LEFT, y1: top + head_h, x2: RIGHT, y2: top + head_h, width: HAIRLINE, color: Palette::rule(), dotted: false });
        }
        items.push(Item::RoundRect {
            x: LEFT,
            y: top,
            w: CONTENT_W,
            h: bottom - top,
            r: radius,
            fill: None,
            stroke: Some((Palette::rule(), HAIRLINE)),
        });
        items
    };

    ctx.ensure(head_h + pad_y + lh * 2.0);
    let mut frag = ctx.frag_start();
    let mut first_frag = true;

    // Header: language on the left, line count on the right.
    {
        let top = ctx.y;
        let lang = ctx.shape(&language_label(&p.language), Style::SemiBold, head_size, 0.0);
        let count = ctx.shape(
            &format!("{} line{}", lines.len(), if lines.len() == 1 { "" } else { "s" }),
            Style::Regular,
            head_size,
            0.0,
        );
        let b = ctx.baseline(Style::Regular, head_size, top, head_h);
        let n = lang.glyphs.len();
        ctx.place(&lang, 0..n, LEFT + 3.0 * MM, b, head_size, Palette::ink_soft());
        let n = count.glyphs.len();
        ctx.place(&count, 0..n, RIGHT - 3.0 * MM - count.width, b, head_size, Palette::faint());
        ctx.y += head_h + pad_y;
    }

    let space_w = ctx.shape(" ", Style::Mono, size, 0.0).width;
    for (number, line) in lines.iter().enumerate() {
        let shaped = ctx.shape(line, Style::Mono, size, 0.0);
        let indent = (line.len() - line.trim_start_matches(' ').len()) as f32 * space_w;
        let indent = indent.min(code_w * 0.4);
        let rows = break_lines(&shaped, code_w, code_w - indent, false);
        let line_spans = spans.get(number).map(Vec::as_slice).unwrap_or(&[]);

        for (row_index, row) in rows.iter().enumerate() {
            if ctx.y + lh + pad_y > CONTENT_BOTTOM {
                let bottom = ctx.y + pad_y;
                let top = frag.top;
                ctx.frag_end(frag, draw(top, bottom, first_frag));
                first_frag = false;
                ctx.new_page();
                frag = ctx.frag_start();
                ctx.y += pad_y;
            }
            let baseline = ctx.baseline(Style::Mono, size, ctx.y, lh);

            // Gutter: line number, or ↪ for a wrapped continuation.
            let (mark, color) = if row_index == 0 {
                ((number + 1).to_string(), Palette::gutter())
            } else {
                ("↪".to_string(), Palette::accent())
            };
            let m = ctx.shape(&mark, Style::Mono, size, 0.0);
            let n = m.glyphs.len();
            ctx.place(&m, 0..n, code_x - 3.0 * MM - m.width, baseline, size, color);

            // Code, split into runs of one color.
            let x = if row_index == 0 { code_x } else { code_x + indent };
            let x0 = shaped.glyphs.get(row.start).map(|g| g.x).unwrap_or(0.0);
            let mut i = row.start;
            while i < row.draw_end {
                let token = token_at(line_spans, shaped.glyphs[i].cluster);
                let mut j = i + 1;
                while j < row.draw_end && token_at(line_spans, shaped.glyphs[j].cluster) == token {
                    j += 1;
                }
                let run_x = x + shaped.glyphs[i].x - x0;
                ctx.place(&shaped, i..j, run_x, baseline, size, token.rgb());
                i = j;
            }
            ctx.y += lh;
        }
    }
    ctx.y += pad_y;
    let (top, bottom) = (frag.top, ctx.y);
    ctx.frag_end(frag, draw(top, bottom, first_frag));
}

fn token_at(spans: &[highlight::Span], at: usize) -> Token {
    spans
        .iter()
        .find(|s| s.start <= at && at < s.end)
        .map(|s| s.token)
        .unwrap_or(Token::Plain)
}

/// Lays out one problem from the top of a fresh page.
pub fn layout_problem(book: &FontBook, p: &Problem) -> (Vec<Page>, Usage) {
    let mut ctx = Ctx::new(book);
    header_block(&mut ctx, p);

    if !p.problem_statement.trim().is_empty() {
        section_heading(&mut ctx, "Problem Statement", BODY * BODY_LH);
        let statement = p.problem_statement.trim_end().trim_start_matches(['\n', '\r']);
        ctx.paragraph(statement);
    }

    let examples = non_empty(&p.examples);
    if !examples.is_empty() {
        section_heading(&mut ctx, "Examples", 8.5 * 1.55 + 10.0 * MM);
        examples_section(&mut ctx, &examples);
    }

    for (title, items) in [("Brute Force", &p.brute_force), ("Pattern", &p.pattern), ("Thinking", &p.thinking)] {
        let items = non_empty(items);
        if !items.is_empty() {
            section_heading(&mut ctx, title, BODY * BODY_LH);
            numbered_list(&mut ctx, &items);
        }
    }

    complexity_section(&mut ctx, p);

    for (title, items) in [("Mistakes", &p.mistakes), ("Takeaways", &p.takeaways)] {
        let items = non_empty(items);
        if !items.is_empty() {
            section_heading(&mut ctx, title, BODY * BODY_LH);
            numbered_list(&mut ctx, &items);
        }
    }

    code_section(&mut ctx, p);
    (ctx.pages, ctx.usage)
}

// ---------- title page, contents, running header/footer ----------

pub struct TocEntry {
    pub name: String,
    pub difficulty: String,
    /// Index of the problem's first page in the final document.
    pub page: usize,
}

const TOC_TITLE_H: f32 = 19.0 * 1.2 + 6.0 * MM;
const TOC_ROW_H: f32 = BODY * 1.5 + 4.4 * MM;

/// How many pages the contents list needs for `entries` problems.
pub fn toc_page_count(entries: usize) -> usize {
    let usable = CONTENT_BOTTOM - CONTENT_TOP;
    let first = (((usable - TOC_TITLE_H) / TOC_ROW_H).floor() as usize).max(1);
    let rest = ((usable / TOC_ROW_H).floor() as usize).max(1);
    if entries <= first {
        1
    } else {
        1 + (entries - first).div_ceil(rest)
    }
}

pub fn contents_pages(book: &FontBook, entries: &[TocEntry]) -> (Vec<Page>, Usage) {
    let mut ctx = Ctx::new(book);
    let title = ctx.shape("Contents", Style::Bold, 19.0, 0.0);
    let b = ctx.baseline(Style::Bold, 19.0, ctx.y, 19.0 * 1.2);
    let n = title.glyphs.len();
    ctx.place(&title, 0..n, LEFT, b, 19.0, Palette::ink());
    ctx.y += TOC_TITLE_H;

    let num_w = 8.0 * MM;
    let diff_w = 13.0 * MM;
    let page_w = 6.0 * MM;
    let gap = 2.0 * MM;
    for (i, e) in entries.iter().enumerate() {
        if ctx.y + TOC_ROW_H > CONTENT_BOTTOM {
            ctx.new_page();
        }
        let top = ctx.y;
        let b = ctx.baseline(Style::Regular, BODY, top + 2.2 * MM, BODY * 1.5);

        let num = ctx.shape(&(i + 1).to_string(), Style::Regular, BODY * 0.9, 0.0);
        let n = num.glyphs.len();
        ctx.place(&num, 0..n, LEFT, b, BODY * 0.9, Palette::faint());

        let pg = ctx.shape(&(e.page + 1).to_string(), Style::Regular, BODY, 0.0);
        let n = pg.glyphs.len();
        ctx.place(&pg, 0..n, RIGHT - pg.width, b, BODY, Palette::ink_soft());

        let diff_x = RIGHT - page_w - gap - diff_w;
        if !e.difficulty.trim().is_empty() {
            let d = ctx.fitted(e.difficulty.trim(), Style::SemiBold, 7.5, 0.0, diff_w);
            let n = d.glyphs.len();
            ctx.place(&d, 0..n, diff_x, b, 7.5, difficulty_color(&e.difficulty));
        }

        let name_x = LEFT + num_w;
        let name_max = diff_x - gap - name_x - 6.0 * MM;
        let name = if e.name.trim().is_empty() { "Untitled problem" } else { e.name.trim() };
        let s = ctx.fitted(name, Style::Regular, BODY, 0.0, name_max);
        let n = s.glyphs.len();
        ctx.place(&s, 0..n, name_x, b, BODY, Palette::ink());

        // Dotted leader between the name and the difficulty.
        let lead_x1 = name_x + s.width + gap;
        let lead_x2 = diff_x - gap;
        if lead_x2 - lead_x1 > 2.0 * MM {
            ctx.push(Item::Line { x1: lead_x1, y1: b, x2: lead_x2, y2: b, width: 0.3 * MM, color: Palette::faint(), dotted: true });
        }

        ctx.y += TOC_ROW_H;
        ctx.push(Item::Line { x1: LEFT, y1: ctx.y, x2: RIGHT, y2: ctx.y, width: HAIRLINE, color: Palette::rule(), dotted: false });
        ctx.push(Item::Link { x: LEFT, y: top, w: CONTENT_W, h: TOC_ROW_H, target: LinkTarget::Page(e.page) });
    }
    (ctx.pages, ctx.usage)
}

pub struct CoverInfo<'a> {
    pub title: &'a str,
    pub subtitle: &'a str,
    pub exported_on: &'a str,
    pub total_pages: usize,
    pub easy: usize,
    pub medium: usize,
    pub hard: usize,
}

pub fn cover_page(book: &FontBook, info: &CoverInfo) -> (Page, Usage) {
    let mut ctx = Ctx::new(book);
    ctx.y = TOP + 40.0 * MM;

    let eyebrow = ctx.shape("PROBLEM JOURNAL", Style::Bold, 9.0, 9.0 * 0.14);
    let b = ctx.baseline(Style::Bold, 9.0, ctx.y, 9.0 * 1.4);
    let n = eyebrow.glyphs.len();
    ctx.place(&eyebrow, 0..n, LEFT, b, 9.0, Palette::accent());
    ctx.y += 9.0 * 1.4 + 5.0 * MM;

    let title = if info.title.trim().is_empty() { "Problem Journal" } else { info.title.trim() };
    ctx.text_lines(title, Style::Bold, 40.0, 1.08, Palette::ink(), LEFT, CONTENT_W, false, |_, _, _, _, _| {});
    ctx.y += 5.0 * MM;
    if !info.subtitle.trim().is_empty() {
        ctx.text_lines(info.subtitle.trim(), Style::Regular, 12.0, 1.4, Palette::ink_soft(), LEFT, CONTENT_W, false, |_, _, _, _, _| {});
    }

    // Difficulty bar + legend
    let total = info.easy + info.medium + info.hard;
    if total > 0 {
        ctx.y += 14.0 * MM;
        let bar_w = 110.0 * MM;
        let bar_h = 2.2 * MM;
        let mut x = LEFT;
        for (count, color) in [
            (info.easy, difficulty_color("easy")),
            (info.medium, difficulty_color("medium")),
            (info.hard, difficulty_color("hard")),
        ] {
            if count == 0 {
                continue;
            }
            let w = bar_w * count as f32 / total as f32;
            ctx.push(Item::Rect { x, y: ctx.y, w, h: bar_h, fill: color });
            x += w;
        }
        ctx.y += bar_h + 3.5 * MM;
        let mut x = LEFT;
        let b = ctx.baseline(Style::Regular, 9.0, ctx.y, 9.0 * 1.4);
        for (count, label, key) in [(info.easy, "Easy", "easy"), (info.medium, "Medium", "medium"), (info.hard, "Hard", "hard")] {
            let color = difficulty_color(key);
            ctx.push(Item::Circle { cx: x + 1.0 * MM, cy: b - 9.0 * 0.33, r: 1.0 * MM, fill: color });
            let s = ctx.shape(&format!("{count} {label}"), Style::Regular, 9.0, 0.0);
            let n = s.glyphs.len();
            ctx.place(&s, 0..n, x + 3.5 * MM, b, 9.0, color);
            x += 3.5 * MM + s.width + 7.0 * MM;
        }
    }

    // Colophon at the bottom
    let line_y = PAGE_H - BOTTOM - 8.5 * 1.4 - 4.0 * MM;
    ctx.push(Item::Line { x1: LEFT, y1: line_y, x2: RIGHT, y2: line_y, width: HAIRLINE, color: Palette::rule(), dotted: false });
    let b = ctx.baseline(Style::Regular, 8.5, line_y + 4.0 * MM, 8.5 * 1.4);
    let left = ctx.shape(&format!("Exported {}", info.exported_on), Style::Regular, 8.5, 0.0);
    let n = left.glyphs.len();
    ctx.place(&left, 0..n, LEFT, b, 8.5, Palette::faint());
    let pages = info.total_pages;
    let right = ctx.shape(&format!("{pages} page{}", if pages == 1 { "" } else { "s" }), Style::Regular, 8.5, 0.0);
    let n = right.glyphs.len();
    ctx.place(&right, 0..n, RIGHT - right.width, b, 8.5, Palette::faint());

    let page = ctx.pages.into_iter().next().unwrap_or_default();
    (page, ctx.usage)
}

/// Adds the running header (brand + context) and footer (date + page x of y).
pub fn decorate(book: &FontBook, page: &mut Page, usage: &mut Usage, context: &str, footer_left: &str, number: usize, total: usize) {
    let mut ctx = Ctx { book, pages: vec![Page::default()], y: TOP, usage: Usage::new() };

    let b = ctx.baseline(Style::Regular, RUN_SIZE, TOP, RUN_LINE);
    let brand = ctx.shape("Problem Journal", Style::SemiBold, RUN_SIZE, RUN_SIZE * 0.02);
    let n = brand.glyphs.len();
    ctx.place(&brand, 0..n, LEFT, b, RUN_SIZE, Palette::ink_soft());
    let right = ctx.fitted(context, Style::Regular, RUN_SIZE, 0.0, CONTENT_W * 0.6);
    let n = right.glyphs.len();
    ctx.place(&right, 0..n, RIGHT - right.width, b, RUN_SIZE, Palette::faint());
    ctx.push(Item::Line { x1: LEFT, y1: HEADER_RULE_Y, x2: RIGHT, y2: HEADER_RULE_Y, width: HAIRLINE, color: Palette::rule(), dotted: false });

    let fb = ctx.baseline(Style::Regular, RUN_SIZE, FOOTER_TOP, RUN_LINE);
    let left = ctx.shape(footer_left, Style::Regular, RUN_SIZE, 0.0);
    let n = left.glyphs.len();
    ctx.place(&left, 0..n, LEFT, fb, RUN_SIZE, Palette::faint());
    let num = ctx.shape(&format!("Page {number} of {total}"), Style::Regular, RUN_SIZE, 0.0);
    let n = num.glyphs.len();
    ctx.place(&num, 0..n, RIGHT - num.width, fb, RUN_SIZE, Palette::faint());

    let decor = ctx.pages.pop().unwrap_or_default();
    page.items.extend(decor.items);
    merge_usage(usage, ctx.usage);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Problem {
        Problem {
            id: "p1".into(),
            problem_name: "Longest Substring Without Repeating Characters".into(),
            difficulty: "Medium".into(),
            topic: "Strings".into(),
            platform: "LeetCode".into(),
            url: "https://leetcode.com/problems/longest-substring-without-repeating-characters/".into(),
            problem_statement: "Given a string s, find the length of the longest substring without repeating characters.".into(),
            examples: vec!["Input: s = \"abcabcbb\"\nOutput: 3".into()],
            pattern_category: "Sliding Window".into(),
            favorite: false,
            brute_force: vec!["Try every start index.".into()],
            brute_force_time_complexity: "O(n^2)".into(),
            brute_force_space_complexity: String::new(),
            pattern: vec![],
            thinking: vec!["Keep the window unique.".into(), "\u{0935}\u{093F}\u{0902}\u{0921}\u{094B}".into()],
            time_complexity: "O(n)".into(),
            space_complexity: "O(min(n, m))".into(),
            mistakes: vec!["".into()],
            takeaways: vec![],
            tags: vec!["Amazon".into(), "Google".into()],
            code: (0..120).map(|i| format!("    x{i} = {i}  # a fairly long comment that should wrap onto the next row of the page")).collect::<Vec<_>>().join("\n"),
            language: "python".into(),
            is_deleted: false,
            created_at: String::new(),
            updated_at: String::new(),
        }
    }

    #[test]
    fn long_code_flows_onto_more_pages() {
        let (pages, usage) = layout_problem(FontBook::get(), &sample());
        assert!(pages.len() >= 3, "120 wrapped code lines should need several pages");
        assert!(!usage.is_empty());
    }

    #[test]
    fn breaks_lines_at_spaces() {
        let book = FontBook::get();
        let s = book.shape("one two three four five six", Style::Regular, 10.0, 0.0);
        let lines = break_lines(&s, 60.0, 60.0, false);
        assert!(lines.len() > 1);
        for l in &lines {
            assert!(l.width <= 60.0 + 0.01);
        }
    }

    #[test]
    fn toc_pages_grow_with_entries() {
        assert_eq!(toc_page_count(1), 1);
        assert!(toc_page_count(200) > toc_page_count(20));
    }
}
