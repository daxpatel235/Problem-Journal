use tauri::State;

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
pub async fn export_problem_pdf_html(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let pool = state.pool.read().await.clone();
    let problem = problem_repo::get_by_id(&pool, &id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Problem not found".to_string())?;
    Ok(export_service::export_pdf_html(&problem))
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
