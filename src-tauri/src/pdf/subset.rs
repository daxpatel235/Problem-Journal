//! A small TrueType subsetter for embedding fonts in the PDF.
//!
//! It keeps glyph ids unchanged and empties the outlines of every glyph that
//! isn't used, which is the simplest subsetting that stays correct with
//! `CIDToGIDMap /Identity`. Composite glyphs pull in their components. Only
//! the tables a PDF reader needs for a CIDFontType2 font are written.

use std::collections::BTreeSet;

use rustybuzz::ttf_parser::{RawFace, Tag};

#[derive(Debug)]
pub struct SubsetError(pub &'static str);

impl std::fmt::Display for SubsetError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "font subsetting failed: {}", self.0)
    }
}

// Composite glyph flags (OpenType `glyf` spec).
const ARG_1_AND_2_ARE_WORDS: u16 = 0x0001;
const WE_HAVE_A_SCALE: u16 = 0x0008;
const MORE_COMPONENTS: u16 = 0x0020;
const WE_HAVE_AN_X_AND_Y_SCALE: u16 = 0x0040;
const WE_HAVE_A_TWO_BY_TWO: u16 = 0x0080;

/// Tables copied unchanged when present (hinting and metrics).
const COPIED: [&[u8; 4]; 6] = [b"cvt ", b"fpgm", b"prep", b"hhea", b"hmtx", b"OS/2"];

fn read_u16(data: &[u8], at: usize) -> Option<u16> {
    data.get(at..at + 2).map(|b| u16::from_be_bytes([b[0], b[1]]))
}

fn read_u32(data: &[u8], at: usize) -> Option<u32> {
    data.get(at..at + 4).map(|b| u32::from_be_bytes([b[0], b[1], b[2], b[3]]))
}

/// Byte ranges of every glyph in `glyf`, read from `loca`.
fn glyph_ranges(loca: &[u8], long: bool, num_glyphs: usize) -> Option<Vec<(usize, usize)>> {
    let offset = |i: usize| -> Option<usize> {
        if long {
            read_u32(loca, i * 4).map(|v| v as usize)
        } else {
            read_u16(loca, i * 2).map(|v| v as usize * 2)
        }
    };
    let mut ranges = Vec::with_capacity(num_glyphs);
    for i in 0..num_glyphs {
        let start = offset(i)?;
        let end = offset(i + 1)?;
        ranges.push((start, end.max(start)));
    }
    Some(ranges)
}

/// Component glyph ids of a composite glyph (empty for simple glyphs).
fn components(glyph: &[u8]) -> Vec<u16> {
    let mut out = Vec::new();
    let Some(contours) = read_u16(glyph, 0) else { return out };
    if (contours as i16) >= 0 {
        return out;
    }
    let mut at = 10; // skip the glyph header
    while let (Some(flags), Some(gid)) = (read_u16(glyph, at), read_u16(glyph, at + 2)) {
        out.push(gid);
        at += 4;
        at += if flags & ARG_1_AND_2_ARE_WORDS != 0 { 4 } else { 2 };
        if flags & WE_HAVE_A_SCALE != 0 {
            at += 2;
        } else if flags & WE_HAVE_AN_X_AND_Y_SCALE != 0 {
            at += 4;
        } else if flags & WE_HAVE_A_TWO_BY_TWO != 0 {
            at += 8;
        }
        if flags & MORE_COMPONENTS == 0 {
            break;
        }
    }
    out
}

fn checksum(data: &[u8]) -> u32 {
    let mut sum = 0u32;
    for chunk in data.chunks(4) {
        let mut word = [0u8; 4];
        word[..chunk.len()].copy_from_slice(chunk);
        sum = sum.wrapping_add(u32::from_be_bytes(word));
    }
    sum
}

/// Builds a standalone TrueType font holding only `used` glyphs (plus `.notdef`
/// and any composite components). Glyph ids are unchanged.
pub fn subset(data: &[u8], index: u32, used: &BTreeSet<u16>) -> Result<Vec<u8>, SubsetError> {
    let raw = RawFace::parse(data, index).map_err(|_| SubsetError("unreadable font"))?;
    let table = |tag: &[u8; 4]| raw.table(Tag::from_bytes(tag));

    let head = table(b"head").ok_or(SubsetError("missing head table"))?;
    let maxp = table(b"maxp").ok_or(SubsetError("missing maxp table"))?;
    let loca = table(b"loca").ok_or(SubsetError("missing loca table"))?;
    let glyf = table(b"glyf").ok_or(SubsetError("not a TrueType-outline font"))?;
    if head.len() < 54 {
        return Err(SubsetError("bad head table"));
    }
    let num_glyphs = read_u16(maxp, 4).ok_or(SubsetError("bad maxp table"))? as usize;
    let long_loca = read_u16(head, 50) == Some(1);
    let ranges = glyph_ranges(loca, long_loca, num_glyphs).ok_or(SubsetError("bad loca table"))?;
    let glyph = |gid: u16| -> &[u8] {
        ranges
            .get(gid as usize)
            .and_then(|&(s, e)| glyf.get(s..e))
            .unwrap_or(&[])
    };

    // Close the set over composite components.
    let mut keep: BTreeSet<u16> = used.iter().copied().filter(|&g| (g as usize) < num_glyphs).collect();
    keep.insert(0);
    let mut queue: Vec<u16> = keep.iter().copied().collect();
    while let Some(gid) = queue.pop() {
        for component in components(glyph(gid)) {
            if (component as usize) < num_glyphs && keep.insert(component) {
                queue.push(component);
            }
        }
    }

    // New glyf + long loca.
    let mut new_glyf = Vec::new();
    let mut new_loca = Vec::with_capacity((num_glyphs + 1) * 4);
    for gid in 0..num_glyphs {
        new_loca.extend_from_slice(&(new_glyf.len() as u32).to_be_bytes());
        if keep.contains(&(gid as u16)) {
            new_glyf.extend_from_slice(glyph(gid as u16));
            while new_glyf.len() % 4 != 0 {
                new_glyf.push(0);
            }
        }
    }
    new_loca.extend_from_slice(&(new_glyf.len() as u32).to_be_bytes());

    // head: long loca, checksum adjustment recomputed at the end.
    let mut new_head = head.to_vec();
    new_head[8..12].copy_from_slice(&[0; 4]);
    new_head[50..52].copy_from_slice(&1i16.to_be_bytes());

    // post: version 3 (no glyph names) keeps the file small.
    let new_post = table(b"post").filter(|p| p.len() >= 32).map(|p| {
        let mut v = p[..32].to_vec();
        v[0..4].copy_from_slice(&0x0003_0000u32.to_be_bytes());
        v
    });

    let mut tables: Vec<([u8; 4], Vec<u8>)> = vec![
        (*b"glyf", new_glyf),
        (*b"head", new_head),
        (*b"loca", new_loca),
        (*b"maxp", maxp.to_vec()),
    ];
    for tag in COPIED {
        if let Some(t) = table(tag) {
            tables.push((*tag, t.to_vec()));
        }
    }
    if let Some(post) = new_post {
        tables.push((*b"post", post));
    }
    tables.sort_by_key(|t| t.0);

    Ok(write_font(tables))
}

/// Serializes tables into an sfnt file with a correct directory and checksums.
fn write_font(tables: Vec<([u8; 4], Vec<u8>)>) -> Vec<u8> {
    let num = tables.len() as u16;
    let mut entry_selector = 0u16;
    while (1u16 << (entry_selector + 1)) <= num {
        entry_selector += 1;
    }
    let search_range = (1u16 << entry_selector) * 16;
    let range_shift = num * 16 - search_range;

    let mut out = Vec::new();
    out.extend_from_slice(&0x0001_0000u32.to_be_bytes());
    out.extend_from_slice(&num.to_be_bytes());
    out.extend_from_slice(&search_range.to_be_bytes());
    out.extend_from_slice(&entry_selector.to_be_bytes());
    out.extend_from_slice(&range_shift.to_be_bytes());

    let mut offset = 12 + 16 * tables.len();
    let mut head_offset = None;
    for (tag, data) in &tables {
        out.extend_from_slice(tag);
        out.extend_from_slice(&checksum(data).to_be_bytes());
        out.extend_from_slice(&(offset as u32).to_be_bytes());
        out.extend_from_slice(&(data.len() as u32).to_be_bytes());
        if tag == b"head" {
            head_offset = Some(offset);
        }
        offset += (data.len() + 3) & !3;
    }
    for (_, data) in &tables {
        out.extend_from_slice(data);
        while out.len() % 4 != 0 {
            out.push(0);
        }
    }
    if let Some(at) = head_offset {
        let adjustment = 0xB1B0_AFBAu32.wrapping_sub(checksum(&out));
        out[at + 8..at + 12].copy_from_slice(&adjustment.to_be_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustybuzz::ttf_parser::{Face, GlyphId};

    #[test]
    fn subset_keeps_used_glyphs_and_parses() {
        let data = crate::pdf::fonts::INTER_REGULAR;
        let face = Face::parse(data, 0).unwrap();
        let a = face.glyph_index('A').unwrap().0;
        let used: BTreeSet<u16> = [a].into_iter().collect();
        let out = subset(data, 0, &used).unwrap();
        assert!(out.len() < data.len() / 4, "subset should be much smaller");
        let sub = Face::parse(&out, 0).unwrap();
        assert_eq!(sub.number_of_glyphs(), face.number_of_glyphs());
        assert!(sub.outline_glyph(GlyphId(a), &mut NullSink).is_some());
    }

    struct NullSink;
    impl rustybuzz::ttf_parser::OutlineBuilder for NullSink {
        fn move_to(&mut self, _: f32, _: f32) {}
        fn line_to(&mut self, _: f32, _: f32) {}
        fn quad_to(&mut self, _: f32, _: f32, _: f32, _: f32) {}
        fn curve_to(&mut self, _: f32, _: f32, _: f32, _: f32, _: f32, _: f32) {}
        fn close(&mut self) {}
    }
}
