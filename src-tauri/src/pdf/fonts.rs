//! Fonts for the PDF engine: the bundled Inter + JetBrains Mono, plus system
//! fallbacks (Nirmala UI for Hindi and other Indian scripts, Segoe UI /
//! Segoe UI Symbol for Greek, math and arrows). Also does text shaping, so
//! kerning and Devanagari conjuncts come out right.

use std::sync::OnceLock;

use rustybuzz::ttf_parser::{fonts_in_collection, Face as TtfFace};
use rustybuzz::{Face, UnicodeBuffer};

pub const INTER_REGULAR: &[u8] = include_bytes!("../../fonts/Inter-Regular.ttf");
pub const INTER_SEMIBOLD: &[u8] = include_bytes!("../../fonts/Inter-SemiBold.ttf");
pub const INTER_BOLD: &[u8] = include_bytes!("../../fonts/Inter-Bold.ttf");
pub const MONO_REGULAR: &[u8] = include_bytes!("../../fonts/JetBrainsMonoNL-Regular.ttf");

/// Index into [`FontBook::fonts`].
pub type FontId = u16;

/// Text styles the layout asks for. Each maps to a primary font.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Style {
    Regular,
    SemiBold,
    Bold,
    Mono,
}

pub struct Font {
    /// PostScript-style name used in the PDF (`Inter-Regular`).
    pub name: String,
    pub data: &'static [u8],
    pub index: u32,
    pub face: Face<'static>,
    pub units_per_em: f32,
    pub ascender: f32,
    pub descender: f32,
    pub cap_height: f32,
    pub bbox: [f32; 4],
    pub italic_angle: f32,
    pub monospaced: bool,
    pub bold: bool,
}

impl Font {
    fn load(name: &str, data: &'static [u8], index: u32) -> Option<Font> {
        let face = Face::from_slice(data, index)?;
        // The subsetter only handles TrueType outlines.
        face.raw_face().table(rustybuzz::ttf_parser::Tag::from_bytes(b"glyf"))?;
        let upem = face.units_per_em() as f32;
        let bb = face.global_bounding_box();
        Some(Font {
            name: name.to_string(),
            data,
            index,
            units_per_em: upem,
            ascender: face.ascender() as f32,
            descender: face.descender() as f32,
            cap_height: face.capital_height().map(f32::from).unwrap_or(face.ascender() as f32 * 0.7),
            bbox: [bb.x_min as f32, bb.y_min as f32, bb.x_max as f32, bb.y_max as f32],
            italic_angle: face.italic_angle(),
            monospaced: face.is_monospaced(),
            bold: face.weight().to_number() >= 600,
            face,
        })
    }

    pub fn has_char(&self, c: char) -> bool {
        self.face.glyph_index(c).is_some()
    }

    /// Advance width of a glyph in font units.
    pub fn advance(&self, gid: u16) -> f32 {
        self.face
            .glyph_hor_advance(rustybuzz::ttf_parser::GlyphId(gid))
            .map(f32::from)
            .unwrap_or(0.0)
    }
}

pub struct FontBook {
    pub fonts: Vec<Font>,
    regular: FontId,
    semibold: FontId,
    bold: FontId,
    mono: FontId,
    /// System fonts tried, in order, for characters the primary font lacks.
    fallbacks: Vec<FontId>,
}

/// Places to look for fallback fonts. Missing files are skipped, so the same
/// list works on Windows, macOS and Linux.
const FALLBACK_FILES: &[(&str, &str, char)] = &[
    // (path, pdf name, a character the face must have)
    ("C:\\Windows\\Fonts\\Nirmala.ttc", "NirmalaUI", '\u{0915}'),
    ("C:\\Windows\\Fonts\\Nirmala.ttf", "NirmalaUI", '\u{0915}'),
    ("C:\\Windows\\Fonts\\segoeui.ttf", "SegoeUI", '\u{03A3}'),
    ("C:\\Windows\\Fonts\\seguisym.ttf", "SegoeUISymbol", '\u{2264}'),
    ("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari", '\u{0915}'),
    ("/usr/share/fonts/noto/NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari", '\u{0915}'),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "DejaVuSans", '\u{03A3}'),
    ("/usr/share/fonts/TTF/DejaVuSans.ttf", "DejaVuSans", '\u{03A3}'),
    ("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "ArialUnicodeMS", '\u{0915}'),
];

fn load_system_font(path: &str, name: &str, probe: char) -> Option<Font> {
    let bytes = std::fs::read(path).ok()?;
    // Fonts live for the whole app run; leaking once gives the 'static data
    // the shaper and subsetter borrow from.
    let data: &'static [u8] = Box::leak(bytes.into_boxed_slice());
    let count = fonts_in_collection(data).unwrap_or(1);
    // In a collection, take the regular-weight, upright face with the script.
    let mut best: Option<u32> = None;
    for index in 0..count {
        let Ok(face) = TtfFace::parse(data, index) else { continue };
        if face.glyph_index(probe).is_none() || face.is_italic() {
            continue;
        }
        if face.weight().to_number() == 400 {
            best = Some(index);
            break;
        }
        best.get_or_insert(index);
    }
    Font::load(name, data, best?)
}

impl FontBook {
    fn build() -> FontBook {
        let mut fonts = vec![
            Font::load("Inter-Regular", INTER_REGULAR, 0).expect("bundled Inter Regular"),
            Font::load("Inter-SemiBold", INTER_SEMIBOLD, 0).expect("bundled Inter SemiBold"),
            Font::load("Inter-Bold", INTER_BOLD, 0).expect("bundled Inter Bold"),
            Font::load("JetBrainsMono-Regular", MONO_REGULAR, 0).expect("bundled JetBrains Mono"),
        ];
        let mut fallbacks = Vec::new();
        let mut loaded_names: Vec<&str> = Vec::new();
        for &(path, name, probe) in FALLBACK_FILES {
            if loaded_names.contains(&name) {
                continue;
            }
            if let Some(font) = load_system_font(path, name, probe) {
                fallbacks.push(fonts.len() as FontId);
                fonts.push(font);
                loaded_names.push(name);
            }
        }
        FontBook { fonts, regular: 0, semibold: 1, bold: 2, mono: 3, fallbacks }
    }

    /// Fonts are loaded once per app run and shared by every export.
    pub fn get() -> &'static FontBook {
        static BOOK: OnceLock<FontBook> = OnceLock::new();
        BOOK.get_or_init(FontBook::build)
    }

    pub fn font(&self, id: FontId) -> &Font {
        &self.fonts[id as usize]
    }

    pub fn primary(&self, style: Style) -> FontId {
        match style {
            Style::Regular => self.regular,
            Style::SemiBold => self.semibold,
            Style::Bold => self.bold,
            Style::Mono => self.mono,
        }
    }

    /// The font that draws `c` for this style, or `None` if no font can.
    fn font_for(&self, style: Style, c: char) -> Option<FontId> {
        let primary = self.primary(style);
        if self.font(primary).has_char(c) {
            return Some(primary);
        }
        // Code falls back to Inter before system fonts, to stay close in look.
        if style == Style::Mono && self.font(self.regular).has_char(c) {
            return Some(self.regular);
        }
        self.fallbacks.iter().copied().find(|&id| self.font(id).has_char(c))
    }
}

/// Emoji are left out of the PDF on purpose (it's a DSA journal, and PDF
/// fonts can't draw color emoji anyway).
pub fn is_dropped_char(c: char) -> bool {
    matches!(c as u32,
        0x1F000..=0x1FAFF   // emoji & pictographs
        | 0xFE0F            // emoji presentation selector
        | 0x200D            // zero-width joiner (emoji sequences)
        | 0xE0020..=0xE007F // emoji tag sequences
    ) || (c.is_control() && c != '\n' && c != '\t')
}

/// Characters that must stay in the same font run as the one before them
/// (combining marks, joiners), so clusters never split across fonts.
fn sticks_to_previous(c: char) -> bool {
    matches!(c as u32,
        0x0300..=0x036F | 0x1AB0..=0x1AFF | 0x1DC0..=0x1DFF | 0x20D0..=0x20FF | 0xFE20..=0xFE2F
        | 0x200C | 0xFE00..=0xFE0E
        // Devanagari & other Indic dependent signs live inside their blocks;
        // the whole block is in the same font anyway.
    ) || c.is_whitespace()
}

/// One shaped glyph. Positions are in points, relative to the run start.
#[derive(Debug, Clone, Copy)]
pub struct Glyph {
    pub font: FontId,
    pub gid: u16,
    /// Pen position before this glyph.
    pub x: f32,
    pub advance: f32,
    pub x_offset: f32,
    pub y_offset: f32,
    /// Byte offset of this glyph's cluster in the shaped text.
    pub cluster: usize,
}

/// Text shaped at a size, with clusters pointing back into `text`.
pub struct Shaped {
    pub text: String,
    pub glyphs: Vec<Glyph>,
    pub width: f32,
}

impl FontBook {
    /// Shapes a single line of text (no newlines) in one style.
    /// `tracking` adds extra space after every glyph, in points.
    pub fn shape(&self, text: &str, style: Style, size: f32, tracking: f32) -> Shaped {
        let text: String = text
            .chars()
            .map(|c| if c == '\t' { ' ' } else { c })
            .filter(|&c| !is_dropped_char(c))
            .collect();

        // Split into runs that use one font each.
        let mut runs: Vec<(usize, usize, FontId)> = Vec::new();
        let mut current: Option<(usize, FontId)> = None;
        for (i, c) in text.char_indices() {
            let font = match current {
                Some((_, prev)) if sticks_to_previous(c) => Some(prev),
                _ => self.font_for(style, c),
            };
            let Some(font) = font else {
                // Nothing can draw it: end the run so it is skipped.
                if let Some((start, f)) = current.take() {
                    runs.push((start, i, f));
                }
                continue;
            };
            match current {
                Some((_, f)) if f == font => {}
                Some((start, f)) => {
                    runs.push((start, i, f));
                    current = Some((i, font));
                }
                None => current = Some((i, font)),
            }
        }
        if let Some((start, f)) = current {
            runs.push((start, text.len(), f));
        }

        let mut glyphs = Vec::new();
        let mut pen = 0.0f32;
        for (start, end, font_id) in runs {
            let font = self.font(font_id);
            let scale = size / font.units_per_em;
            let mut buffer = UnicodeBuffer::new();
            buffer.push_str(&text[start..end]);
            buffer.guess_segment_properties();
            let shaped = rustybuzz::shape(&font.face, &[], buffer);
            for (info, pos) in shaped.glyph_infos().iter().zip(shaped.glyph_positions()) {
                let advance = pos.x_advance as f32 * scale + tracking;
                glyphs.push(Glyph {
                    font: font_id,
                    gid: info.glyph_id as u16,
                    x: pen,
                    advance,
                    x_offset: pos.x_offset as f32 * scale,
                    y_offset: pos.y_offset as f32 * scale,
                    cluster: start + info.cluster as usize,
                });
                pen += advance;
            }
        }
        Shaped { text, glyphs, width: pen }
    }

    /// Line height metrics for a style at a size: (ascent, descent) in points,
    /// descent positive.
    pub fn metrics(&self, style: Style, size: f32) -> (f32, f32) {
        let f = self.font(self.primary(style));
        let scale = size / f.units_per_em;
        (f.ascender * scale, -f.descender * scale)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shapes_latin_with_kerning_and_clusters() {
        let book = FontBook::get();
        let s = book.shape("AVA wave", Style::Regular, 10.0, 0.0);
        assert_eq!(s.glyphs.len(), 8);
        assert!(s.width > 20.0 && s.width < 60.0);
        assert_eq!(s.glyphs[3].cluster, 3); // the space
    }

    #[test]
    fn drops_emoji() {
        let book = FontBook::get();
        let s = book.shape("ok \u{1F600}", Style::Regular, 10.0, 0.0);
        assert_eq!(s.text, "ok ");
    }

    #[test]
    fn hindi_uses_a_fallback_font_when_available() {
        let book = FontBook::get();
        let s = book.shape("\u{0915}\u{094D}\u{0937}", Style::Regular, 10.0, 0.0); // क्ष
        if book.fonts.len() > 4 && s.glyphs.iter().any(|g| g.font >= 4) {
            // Shaped into a conjunct: fewer glyphs than code points.
            assert!(s.glyphs.len() < 3);
        }
    }
}
