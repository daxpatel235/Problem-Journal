//! Problem Journal's PDF engine.
//!
//! `render` lays every problem out in parallel (each starts on its own page),
//! adds a title page and contents when there are several, numbers the pages,
//! and writes the PDF. A problem that fails to lay out is reported and left
//! out; the rest still export.

pub mod fonts;
mod highlight;
mod layout;
mod subset;
mod writer;

use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

use rayon::prelude::*;
use serde::Serialize;

use crate::models::problem::Problem;
use fonts::FontBook;
use layout::{CoverInfo, Page, TocEntry, Usage};
use writer::{Meta, OutlineEntry};

pub struct DocumentInput {
    /// Problems in the order they should appear.
    pub problems: Vec<Problem>,
    /// Shown on the title page (folder name, "All Problems"…).
    pub title: String,
    /// Shown under the title ("Folder export").
    pub subtitle: String,
    /// Already formatted for the user's locale ("16 Nov 2026").
    pub exported_on: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FailedProblem {
    pub id: String,
    pub name: String,
    pub reason: String,
}

pub struct RenderOutput {
    pub bytes: Vec<u8>,
    pub pages: usize,
    pub exported: usize,
    pub failed: Vec<FailedProblem>,
}

#[derive(Debug)]
pub enum RenderError {
    Cancelled,
    Failed(String),
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    Layout,
    Writing,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub phase: Phase,
    pub done: usize,
    pub total: usize,
}

/// Half the machine's cores (at least one), so the app stays responsive
/// while the export still runs in parallel.
pub fn worker_threads() -> usize {
    std::thread::available_parallelism()
        .map(|n| (n.get() / 2).max(1))
        .unwrap_or(1)
}

fn display_name(p: &Problem) -> String {
    let name = p.problem_name.trim();
    if name.is_empty() { "Untitled problem".to_string() } else { name.to_string() }
}

fn panic_message(payload: Box<dyn std::any::Any + Send>) -> String {
    payload
        .downcast_ref::<&str>()
        .map(|s| s.to_string())
        .or_else(|| payload.downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "unexpected error while laying out the page".to_string())
}

pub fn render(
    input: &DocumentInput,
    cancel: &AtomicBool,
    progress: &(dyn Fn(Progress) + Sync),
) -> Result<RenderOutput, RenderError> {
    let book = FontBook::get();
    let total = input.problems.len();
    if total == 0 {
        return Err(RenderError::Failed("No problems were selected.".into()));
    }

    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(worker_threads())
        .thread_name(|i| format!("pdf-export-{i}"))
        .build()
        .map_err(|e| RenderError::Failed(format!("Couldn't start the export workers: {e}")))?;

    // 1. Lay out every problem in parallel. Order is kept by index.
    let done = AtomicUsize::new(0);
    progress(Progress { phase: Phase::Layout, done: 0, total });
    let laid_out: Vec<Option<Result<(Vec<Page>, Usage), String>>> = pool.install(|| {
        input
            .problems
            .par_iter()
            .map(|p| {
                if cancel.load(Ordering::Relaxed) {
                    return None;
                }
                let result = catch_unwind(AssertUnwindSafe(|| layout::layout_problem(book, p)))
                    .map_err(panic_message);
                let n = done.fetch_add(1, Ordering::Relaxed) + 1;
                progress(Progress { phase: Phase::Layout, done: n, total });
                Some(result)
            })
            .collect()
    });
    if cancel.load(Ordering::Relaxed) {
        return Err(RenderError::Cancelled);
    }

    let mut ok: Vec<(&Problem, Vec<Page>)> = Vec::new();
    let mut usage = Usage::new();
    let mut failed = Vec::new();
    for (p, result) in input.problems.iter().zip(laid_out) {
        match result {
            Some(Ok((pages, u))) if !pages.is_empty() => {
                layout::merge_usage(&mut usage, u);
                ok.push((p, pages));
            }
            Some(Ok(_)) => failed.push(FailedProblem {
                id: p.id.clone(),
                name: display_name(p),
                reason: "It produced no pages.".into(),
            }),
            Some(Err(reason)) => failed.push(FailedProblem { id: p.id.clone(), name: display_name(p), reason }),
            None => return Err(RenderError::Cancelled),
        }
    }
    if ok.is_empty() {
        return Err(RenderError::Failed("None of the selected problems could be exported.".into()));
    }

    progress(Progress { phase: Phase::Writing, done: 0, total: 1 });

    // 2. Assemble: [title page, contents…] + problems, then number pages.
    let multi = total > 1;
    let front = if multi { 1 + layout::toc_page_count(ok.len()) } else { 0 };
    let mut starts = Vec::with_capacity(ok.len());
    let mut next = front;
    for (_, pages) in &ok {
        starts.push(next);
        next += pages.len();
    }
    let total_pages = next;

    let mut pages: Vec<Page> = Vec::with_capacity(total_pages);
    // What the running header shows on each page.
    let mut contexts: Vec<String> = Vec::with_capacity(total_pages);
    let doc_title = if input.title.trim().is_empty() { "Problem Journal".to_string() } else { input.title.trim().to_string() };

    if multi {
        let (mut easy, mut medium, mut hard) = (0, 0, 0);
        for (p, _) in &ok {
            match p.difficulty.trim().to_ascii_lowercase().as_str() {
                "easy" => easy += 1,
                "medium" => medium += 1,
                "hard" => hard += 1,
                _ => {}
            }
        }
        let (cover, u) = layout::cover_page(
            book,
            &CoverInfo {
                title: &doc_title,
                subtitle: &input.subtitle,
                exported_on: &input.exported_on,
                total_pages,
                easy,
                medium,
                hard,
            },
        );
        layout::merge_usage(&mut usage, u);
        pages.push(cover);
        contexts.push(String::new());

        let entries: Vec<TocEntry> = ok
            .iter()
            .zip(&starts)
            .map(|((p, _), &page)| TocEntry { name: display_name(p), difficulty: p.difficulty.clone(), page })
            .collect();
        let (toc, u) = layout::contents_pages(book, &entries);
        layout::merge_usage(&mut usage, u);
        for page in toc {
            pages.push(page);
            contexts.push(doc_title.clone());
        }
        // The contents estimate and the real count must agree, or page
        // numbers and links would be off.
        if pages.len() != front {
            return Err(RenderError::Failed("Contents pages didn't fit as planned.".into()));
        }
    }

    let mut outline = Vec::with_capacity(ok.len());
    for ((p, problem_pages), &start) in ok.into_iter().zip(&starts) {
        outline.push(OutlineEntry { title: display_name(p), page: start });
        for page in problem_pages {
            pages.push(page);
            contexts.push(display_name(p));
        }
    }

    let footer = format!("Exported {}", input.exported_on);
    for (index, page) in pages.iter_mut().enumerate() {
        if multi && index == 0 {
            continue; // the title page has its own colophon
        }
        layout::decorate(book, page, &mut usage, &contexts[index], &footer, index + 1, total_pages);
    }

    if cancel.load(Ordering::Relaxed) {
        return Err(RenderError::Cancelled);
    }

    // 3. Write the file bytes.
    let meta = Meta { title: &doc_title, outline: if multi { outline.as_slice() } else { &[] } };
    let bytes = pool
        .install(|| writer::write(book, &pages, &usage, &meta))
        .map_err(RenderError::Failed)?;
    progress(Progress { phase: Phase::Writing, done: 1, total: 1 });

    Ok(RenderOutput { bytes, pages: total_pages, exported: outline.len(), failed })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn problem(name: &str, difficulty: &str) -> Problem {
        Problem {
            id: name.to_lowercase(),
            problem_name: name.into(),
            difficulty: difficulty.into(),
            topic: "Arrays".into(),
            platform: "LeetCode".into(),
            url: String::new(),
            problem_statement: "Find the answer.\n\nSecond paragraph with ≤ and Σ.".into(),
            examples: vec!["Input: [1,2]\nOutput: 3".into()],
            pattern_category: String::new(),
            favorite: false,
            brute_force: vec![],
            brute_force_time_complexity: String::new(),
            brute_force_space_complexity: String::new(),
            pattern: vec![],
            thinking: vec!["Think.".into()],
            time_complexity: "O(n)".into(),
            space_complexity: String::new(),
            mistakes: vec![],
            takeaways: vec![],
            tags: vec![],
            code: "def f():\n    return 1".into(),
            language: "python".into(),
            is_deleted: false,
            created_at: String::new(),
            updated_at: String::new(),
        }
    }

    fn input(problems: Vec<Problem>) -> DocumentInput {
        DocumentInput {
            problems,
            title: "Arrays".into(),
            subtitle: "Folder export".into(),
            exported_on: "16 Nov 2026".into(),
        }
    }

    #[test]
    fn single_problem_has_no_cover() {
        let out = render(&input(vec![problem("Two Sum", "Easy")]), &AtomicBool::new(false), &|_| {}).unwrap();
        assert!(out.bytes.starts_with(b"%PDF-"));
        assert_eq!(out.pages, 1);
        assert_eq!(out.exported, 1);
    }

    #[test]
    fn several_problems_get_cover_and_contents() {
        let problems = vec![problem("Two Sum", "Easy"), problem("3Sum", "Medium"), problem("Trapping Rain Water", "Hard")];
        let out = render(&input(problems), &AtomicBool::new(false), &|_| {}).unwrap();
        assert_eq!(out.pages, 2 + 3); // cover + contents + one page each
        let text = String::from_utf8_lossy(&out.bytes);
        assert!(text.contains("/Outlines"));
        assert!(text.trim_end().ends_with("%%EOF"));
    }

    #[test]
    fn cancelling_stops_the_export() {
        let result = render(&input(vec![problem("A", "Easy"), problem("B", "Easy")]), &AtomicBool::new(true), &|_| {});
        assert!(matches!(result, Err(RenderError::Cancelled)));
    }
}
