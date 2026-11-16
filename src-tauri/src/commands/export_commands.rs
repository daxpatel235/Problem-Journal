use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_opener::OpenerExt;

use crate::pdf::{self, DocumentInput, FailedProblem, Progress, RenderError};
use crate::repositories::problem_repo;
use crate::services::export_service;
use crate::AppState;

#[tauri::command]
pub async fn export_problem_markdown(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let pool = state.pool.read().await.clone();
    let problem = problem_repo::get_by_id(&pool, &id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Problem not found".to_string())?;
    Ok(export_service::export_markdown(&problem))
}

#[tauri::command]
pub async fn export_problem_json(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let pool = state.pool.read().await.clone();
    let problem = problem_repo::get_by_id(&pool, &id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Problem not found".to_string())?;
    export_service::export_json(std::slice::from_ref(&problem)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_all_json(state: State<'_, AppState>) -> Result<String, String> {
    let pool = state.pool.read().await.clone();
    let summaries = problem_repo::list_all(&pool).await.map_err(|e| e.to_string())?;
    let mut problems = Vec::with_capacity(summaries.len());
    for summary in summaries {
        if let Some(p) = problem_repo::get_by_id(&pool, &summary.id)
            .await
            .map_err(|e| e.to_string())?
        {
            problems.push(p);
        }
    }
    export_service::export_json(&problems).map_err(|e| e.to_string())
}

// ---------- PDF export ----------

/// Event the export page listens to for its progress bar.
const PROGRESS_EVENT: &str = "pdf-export-progress";

static EXPORT_RUNNING: AtomicBool = AtomicBool::new(false);
static CANCEL_REQUESTED: AtomicBool = AtomicBool::new(false);
/// The last file this app wrote; "Open" / "Show in folder" only act on it.
static LAST_EXPORT: Mutex<Option<PathBuf>> = Mutex::new(None);

/// Clears the "running" flag however the export ends.
struct RunningGuard;

impl Drop for RunningGuard {
    fn drop(&mut self) {
        EXPORT_RUNNING.store(false, Ordering::SeqCst);
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportRequest {
    /// Problems in the order they should appear in the PDF.
    pub problem_ids: Vec<String>,
    pub path: String,
    pub title: String,
    pub subtitle: String,
    pub exported_on: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportReport {
    pub path: String,
    pub pages: usize,
    pub exported: usize,
    pub bytes: usize,
    pub failed: Vec<FailedProblem>,
}

fn friendly_write_error(err: std::io::Error) -> String {
    match err.kind() {
        std::io::ErrorKind::PermissionDenied => {
            "Couldn't save the PDF there. If it's open in another app, close it and try again, or pick a different folder.".into()
        }
        std::io::ErrorKind::NotFound => "That folder no longer exists. Pick another location.".into(),
        _ => format!("Couldn't save the PDF: {err}"),
    }
}

/// Writes next to the target, then renames, so a crash or cancel never
/// leaves a half-written PDF behind.
fn write_atomically(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let file_name = path.file_name().ok_or("That isn't a valid file name.")?;
    let mut temp_name = file_name.to_os_string();
    temp_name.push(".part");
    let temp = path.with_file_name(temp_name);
    std::fs::write(&temp, bytes).map_err(friendly_write_error)?;
    std::fs::rename(&temp, path).map_err(|e| {
        let _ = std::fs::remove_file(&temp);
        friendly_write_error(e)
    })
}

#[tauri::command]
pub async fn export_pdf(
    app: AppHandle,
    state: State<'_, AppState>,
    request: PdfExportRequest,
) -> Result<PdfExportReport, String> {
    if EXPORT_RUNNING.swap(true, Ordering::SeqCst) {
        return Err("Another export is still running.".into());
    }
    let _guard = RunningGuard;
    CANCEL_REQUESTED.store(false, Ordering::SeqCst);

    let path = PathBuf::from(&request.path);
    if !path.extension().is_some_and(|e| e.eq_ignore_ascii_case("pdf")) {
        return Err("The file name must end in .pdf".into());
    }

    // Load the problems and put them back in the order the user picked.
    let pool = state.pool.read().await.clone();
    let loaded = problem_repo::get_many(&pool, &request.problem_ids)
        .await
        .map_err(|e| format!("Couldn't read your problems: {e}"))?;
    let mut by_id: HashMap<String, _> = loaded.into_iter().map(|p| (p.id.clone(), p)).collect();
    let mut problems = Vec::with_capacity(request.problem_ids.len());
    let mut missing = Vec::new();
    for id in &request.problem_ids {
        match by_id.remove(id) {
            Some(p) => problems.push(p),
            None => missing.push(FailedProblem {
                id: id.clone(),
                name: "A problem".into(),
                reason: "It was deleted or moved to the trash.".into(),
            }),
        }
    }
    if problems.is_empty() {
        return Err("None of the selected problems exist anymore.".into());
    }

    let input = DocumentInput {
        problems,
        title: request.title,
        subtitle: request.subtitle,
        exported_on: request.exported_on,
    };

    // Layout and writing are CPU work: keep them off the async runtime.
    let progress_app = app.clone();
    let rendered = tauri::async_runtime::spawn_blocking(move || {
        let start = Instant::now();
        let last_emit = Mutex::new(start.checked_sub(Duration::from_secs(1)).unwrap_or(start));
        let progress = move |p: Progress| {
            // At most ~20 updates a second, plus always the final one.
            let mut last = last_emit.lock().unwrap_or_else(|e| e.into_inner());
            if p.done == p.total || last.elapsed() >= Duration::from_millis(50) {
                *last = Instant::now();
                let _ = progress_app.emit(PROGRESS_EVENT, p);
            }
        };
        pdf::render(&input, &CANCEL_REQUESTED, &progress)
    })
    .await
    .map_err(|e| format!("The export stopped unexpectedly: {e}"))?;

    let output = match rendered {
        Ok(output) => output,
        Err(RenderError::Cancelled) => return Err("cancelled".into()),
        Err(RenderError::Failed(message)) => return Err(message),
    };
    if CANCEL_REQUESTED.load(Ordering::SeqCst) {
        return Err("cancelled".into());
    }

    let bytes = output.bytes;
    let write_path = path.clone();
    let size = bytes.len();
    tauri::async_runtime::spawn_blocking(move || write_atomically(&write_path, &bytes))
        .await
        .map_err(|e| format!("The export stopped unexpectedly: {e}"))??;

    if let Ok(mut last) = LAST_EXPORT.lock() {
        *last = Some(path.clone());
    }

    let mut failed = missing;
    failed.extend(output.failed);
    Ok(PdfExportReport {
        path: path.to_string_lossy().into_owned(),
        pages: output.pages,
        exported: output.exported,
        bytes: size,
        failed,
    })
}

#[tauri::command]
pub fn cancel_pdf_export() {
    CANCEL_REQUESTED.store(true, Ordering::SeqCst);
}

/// Only the file this app just exported may be opened or revealed.
fn last_export_matching(path: &str) -> Result<PathBuf, String> {
    let last = LAST_EXPORT.lock().map_err(|_| "Export state is unavailable.".to_string())?;
    match last.as_ref() {
        Some(p) if p == Path::new(path) => Ok(p.clone()),
        _ => Err("That file wasn't exported in this session.".into()),
    }
}

#[tauri::command]
pub fn open_exported_pdf(app: AppHandle, path: String) -> Result<(), String> {
    let path = last_export_matching(&path)?;
    app.opener()
        .open_path(path.to_string_lossy(), None::<String>)
        .map_err(|e| format!("Couldn't open the PDF: {e}"))
}

#[tauri::command]
pub fn reveal_exported_pdf(app: AppHandle, path: String) -> Result<(), String> {
    let path = last_export_matching(&path)?;
    app.opener()
        .reveal_item_in_dir(&path)
        .map_err(|e| format!("Couldn't show the file: {e}"))
}
