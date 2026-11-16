//! A small syntax highlighter for the code block, using the same colors as
//! the editor's light theme (VS Code / Monaco "vs"): keywords blue, strings
//! dark red, numbers green-teal, comments green.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Token {
    Plain,
    Keyword,
    String,
    Number,
    Comment,
}

impl Token {
    pub fn rgb(self) -> [f32; 3] {
        let hex = match self {
            Token::Plain => 0x000000,
            Token::Keyword => 0x0000FF,
            Token::String => 0xA31515,
            Token::Number => 0x098658,
            Token::Comment => 0x008000,
        };
        super::layout::rgb(hex)
    }
}

/// A colored span inside one source line (byte offsets into that line).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Span {
    pub start: usize,
    pub end: usize,
    pub token: Token,
}

struct Lang {
    line_comments: &'static [&'static str],
    block_comment: Option<(&'static str, &'static str)>,
    quotes: &'static [char],
    triple_quotes: bool,
    keywords: &'static [&'static str],
    /// `#include`-style lines are drawn as keywords.
    preprocessor: bool,
}

const PYTHON: Lang = Lang {
    line_comments: &["#"],
    block_comment: None,
    quotes: &['"', '\''],
    triple_quotes: true,
    keywords: &[
        "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del",
        "elif", "else", "except", "False", "finally", "for", "from", "global", "if", "import",
        "in", "is", "lambda", "None", "nonlocal", "not", "or", "pass", "raise", "return", "True",
        "try", "while", "with", "yield", "self", "int", "float", "str", "bool", "list", "dict",
        "set", "tuple", "len", "range", "enumerate", "zip", "min", "max", "sum", "sorted", "print",
        "abs", "map", "filter", "any", "all", "reversed", "object", "super", "isinstance",
    ],
    preprocessor: false,
};

const C_FAMILY_COMMON: &[&str] = &[
    "if", "else", "for", "while", "do", "switch", "case", "default", "break", "continue",
    "return", "goto", "struct", "enum", "union", "typedef", "const", "static", "void", "int",
    "long", "short", "char", "float", "double", "unsigned", "signed", "sizeof", "true", "false",
    "bool", "auto", "extern", "volatile", "inline",
];

const CPP_EXTRA: &[&str] = &[
    "class", "public", "private", "protected", "virtual", "override", "template", "typename",
    "namespace", "using", "new", "delete", "this", "nullptr", "operator", "friend", "constexpr",
    "noexcept", "try", "catch", "throw", "std", "vector", "string", "map", "set",
    "unordered_map", "unordered_set", "pair", "queue", "stack", "priority_queue", "deque",
    "size_t", "mutable", "explicit", "static_cast", "const_cast",
];

const JAVA: &[&str] = &[
    "abstract", "boolean", "break", "byte", "case", "catch", "char", "class", "continue",
    "default", "do", "double", "else", "enum", "extends", "final", "finally", "float", "for",
    "if", "implements", "import", "instanceof", "int", "interface", "long", "new", "package",
    "private", "protected", "public", "return", "short", "static", "super", "switch", "this",
    "throw", "throws", "try", "void", "while", "true", "false", "null", "var", "String",
    "Integer", "List", "Map", "Set", "ArrayList", "HashMap", "HashSet",
];

const JS: &[&str] = &[
    "async", "await", "break", "case", "catch", "class", "const", "continue", "default",
    "delete", "do", "else", "export", "extends", "false", "finally", "for", "function", "if",
    "import", "in", "instanceof", "let", "new", "null", "of", "return", "static", "super",
    "switch", "this", "throw", "true", "try", "typeof", "undefined", "var", "void", "while",
    "yield", "from", "as",
];

const TS_EXTRA: &[&str] = &[
    "interface", "type", "enum", "implements", "private", "public", "protected", "readonly",
    "number", "string", "boolean", "any", "unknown", "never", "keyof", "declare", "namespace",
    "abstract",
];

const RUST: &[&str] = &[
    "as", "break", "const", "continue", "crate", "else", "enum", "extern", "false", "fn", "for",
    "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return",
    "self", "Self", "static", "struct", "super", "trait", "true", "type", "unsafe", "use",
    "where", "while", "dyn", "i32", "i64", "u32", "u64", "usize", "isize", "f64", "f32", "bool",
    "char", "str", "String", "Vec", "Option", "Some", "None", "Ok", "Err", "Result", "u8",
];

const GO: &[&str] = &[
    "break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough",
    "for", "func", "go", "goto", "if", "import", "interface", "map", "package", "range",
    "return", "select", "struct", "switch", "type", "var", "true", "false", "nil", "int",
    "int64", "string", "bool", "byte", "rune", "float64", "make", "len", "append", "error",
];

const CSHARP: &[&str] = &[
    "abstract", "as", "base", "bool", "break", "case", "catch", "char", "class", "const",
    "continue", "default", "do", "double", "else", "enum", "false", "finally", "float", "for",
    "foreach", "if", "in", "int", "interface", "internal", "is", "long", "namespace", "new",
    "null", "out", "override", "private", "protected", "public", "readonly", "ref", "return",
    "static", "string", "struct", "switch", "this", "throw", "true", "try", "using", "var",
    "virtual", "void", "while", "List", "Dictionary",
];

const KOTLIN: &[&str] = &[
    "as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if", "in",
    "interface", "is", "null", "object", "package", "return", "super", "this", "throw", "true",
    "try", "typealias", "val", "var", "when", "while", "import", "private", "public",
    "override", "data", "Int", "Long", "String", "Boolean", "List", "MutableList", "Array",
];

const QUOTES: &[char] = &['"', '\''];
const QUOTES_AND_BACKTICK: &[char] = &['"', '\'', '`'];
const DOUBLE_QUOTE: &[char] = &['"'];
const NO_KEYWORDS: &[&str] = &[];

fn c_like(keywords: &'static [&'static str], quotes: &'static [char]) -> Lang {
    Lang {
        line_comments: &["//"],
        block_comment: Some(("/*", "*/")),
        quotes,
        triple_quotes: false,
        keywords,
        preprocessor: false,
    }
}

fn lang_for(language: &str) -> (Lang, Option<&'static [&'static str]>) {
    match language.trim().to_ascii_lowercase().as_str() {
        "python" | "py" => (PYTHON, None),
        "cpp" | "c++" => {
            (Lang { preprocessor: true, ..c_like(C_FAMILY_COMMON, QUOTES) }, Some(CPP_EXTRA))
        }
        "c" => (Lang { preprocessor: true, ..c_like(C_FAMILY_COMMON, QUOTES) }, None),
        "java" => (c_like(JAVA, QUOTES), None),
        "javascript" | "js" => (c_like(JS, QUOTES_AND_BACKTICK), None),
        "typescript" | "ts" => (c_like(JS, QUOTES_AND_BACKTICK), Some(TS_EXTRA)),
        "rust" | "rs" => (c_like(RUST, DOUBLE_QUOTE), None),
        "go" | "golang" => (c_like(GO, QUOTES_AND_BACKTICK), None),
        "csharp" | "c#" | "cs" => (c_like(CSHARP, QUOTES), None),
        "kotlin" | "kt" => (c_like(KOTLIN, QUOTES), None),
        // Anything else: C-style comments and strings, no keywords.
        _ => (c_like(NO_KEYWORDS, QUOTES), None),
    }
}

fn is_word_char(c: char) -> bool {
    c.is_alphanumeric() || c == '_'
}

fn push(spans: &mut Vec<Span>, start: usize, end: usize, token: Token) {
    if end > start {
        spans.push(Span { start, end, token });
    }
}

/// A multi-line construct still open at the end of a line.
#[derive(Clone, Copy)]
enum Open {
    None,
    Block(&'static str),
    Triple(&'static str),
}

/// Highlights the whole code (so block comments and strings may span lines)
/// and returns the spans of each line. Lines are split on `\n`.
pub fn highlight(code: &str, language: &str) -> Vec<Vec<Span>> {
    let (lang, extra) = lang_for(language);
    let is_keyword =
        |w: &str| lang.keywords.contains(&w) || extra.is_some_and(|e| e.contains(&w));

    let lines: Vec<&str> = code.split('\n').collect();
    let mut out: Vec<Vec<Span>> = Vec::with_capacity(lines.len());

    let mut open = Open::None;

    for line in lines {
        let line = line.strip_suffix('\r').unwrap_or(line);
        let mut spans = Vec::new();
        let mut i = 0usize;

        // Continue a block comment or triple-quoted string.
        let carried = match open {
            Open::Block(end) => Some((end, Token::Comment)),
            Open::Triple(end) => Some((end, Token::String)),
            Open::None => None,
        };
        if let Some((end, token)) = carried {
            if let Some(pos) = line.find(end) {
                push(&mut spans, 0, pos + end.len(), token);
                i = pos + end.len();
                open = Open::None;
            } else {
                push(&mut spans, 0, line.len(), token);
                out.push(spans);
                continue;
            }
        }

        if lang.preprocessor && line.trim_start().starts_with('#') && i == 0 {
            push(&mut spans, 0, line.len(), Token::Keyword);
            out.push(spans);
            continue;
        }

        while i < line.len() {
            let rest = &line[i..];
            let c = rest.chars().next().unwrap_or(' ');

            if lang.line_comments.iter().any(|p| rest.starts_with(p)) {
                push(&mut spans, i, line.len(), Token::Comment);
                break;
            }
            if let Some((start, end)) = lang.block_comment {
                if let Some(after) = rest.strip_prefix(start) {
                    match after.find(end) {
                        Some(pos) => {
                            let stop = i + start.len() + pos + end.len();
                            push(&mut spans, i, stop, Token::Comment);
                            i = stop;
                        }
                        None => {
                            push(&mut spans, i, line.len(), Token::Comment);
                            open = Open::Block(end);
                            i = line.len();
                        }
                    }
                    continue;
                }
            }
            if lang.triple_quotes && (rest.starts_with("\"\"\"") || rest.starts_with("'''")) {
                let delim: &'static str = if rest.starts_with("\"\"\"") { "\"\"\"" } else { "'''" };
                match rest[3..].find(delim) {
                    Some(pos) => {
                        let stop = i + 3 + pos + 3;
                        push(&mut spans, i, stop, Token::String);
                        i = stop;
                    }
                    None => {
                        push(&mut spans, i, line.len(), Token::String);
                        open = Open::Triple(delim);
                        i = line.len();
                    }
                }
                continue;
            }
            if lang.quotes.contains(&c) {
                // String to the matching quote on this line, honoring escapes.
                let mut j = i + c.len_utf8();
                let mut escaped = false;
                let mut closed = false;
                for (k, ch) in line[j..].char_indices() {
                    if escaped {
                        escaped = false;
                    } else if ch == '\\' {
                        escaped = true;
                    } else if ch == c {
                        j += k + ch.len_utf8();
                        closed = true;
                        break;
                    }
                }
                if !closed {
                    j = line.len();
                }
                push(&mut spans, i, j, Token::String);
                i = j;
                continue;
            }
            if c.is_ascii_digit() {
                let prev_is_word = line[..i].chars().next_back().is_some_and(is_word_char);
                let len = rest
                    .char_indices()
                    .find(|&(_, ch)| !(ch.is_ascii_alphanumeric() || ch == '.' || ch == '_'))
                    .map(|(k, _)| k)
                    .unwrap_or(rest.len());
                if !prev_is_word {
                    push(&mut spans, i, i + len, Token::Number);
                }
                i += len;
                continue;
            }
            if is_word_char(c) {
                let len = rest
                    .char_indices()
                    .find(|&(_, ch)| !is_word_char(ch))
                    .map(|(k, _)| k)
                    .unwrap_or(rest.len());
                if is_keyword(&rest[..len]) {
                    push(&mut spans, i, i + len, Token::Keyword);
                }
                i += len;
                continue;
            }
            i += c.len_utf8();
        }
        out.push(spans);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn python_line() {
        let lines = highlight("def f(x):  # hi\n    return \"a\" + 10", "python");
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0][0], Span { start: 0, end: 3, token: Token::Keyword });
        assert_eq!(lines[0].last().unwrap().token, Token::Comment);
        let kinds: Vec<Token> = lines[1].iter().map(|s| s.token).collect();
        assert_eq!(kinds, vec![Token::Keyword, Token::String, Token::Number]);
    }

    #[test]
    fn block_comment_spans_lines() {
        let lines = highlight("int a; /* one\ntwo */ int b;", "cpp");
        assert_eq!(lines[1][0], Span { start: 0, end: 6, token: Token::Comment });
        assert_eq!(lines[1][1].token, Token::Keyword);
    }

    #[test]
    fn identifiers_with_digits_are_not_numbers() {
        let lines = highlight("x1 = 2", "python");
        assert_eq!(lines[0], vec![Span { start: 5, end: 6, token: Token::Number }]);
    }
}
