use tauri::State;

use crate::models::folder::Folder;
use crate::models::problem::ProblemSummary;
use crate::repositories::folder_repo;
use crate::AppState;

#[tauri::command]
pub async fn list_folders(state: State<'_, AppState>) -> Result<Vec<Folder>, String> {
    let pool = state.pool.read().await.clone();
    folder_repo::list_all(&pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_folder(
    state: State<'_, AppState>,
    name: String,
    parent_id: Option<String>,
) -> Result<Folder, String> {
    let pool = state.pool.read().await.clone();
    folder_repo::create(&pool, &name, parent_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_folder(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<Folder, String> {
    let pool = state.pool.read().await.clone();
    folder_repo::rename(&pool, &id, &name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn move_folder(
    state: State<'_, AppState>,
    id: String,
    parent_id: Option<String>,
) -> Result<Folder, String> {
    let pool = state.pool.read().await.clone();
    folder_repo::move_folder(&pool, &id, parent_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_folder(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let pool = state.pool.read().await.clone();
    folder_repo::delete(&pool, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_folder_problems(
    state: State<'_, AppState>,
    folder_id: String,
) -> Result<Vec<ProblemSummary>, String> {
    let pool = state.pool.read().await.clone();
    folder_repo::list_problems(&pool, &folder_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_problems_to_folder(
    state: State<'_, AppState>,
    folder_id: String,
    problem_ids: Vec<String>,
) -> Result<u64, String> {
    let pool = state.pool.read().await.clone();
    folder_repo::add_problems(&pool, &folder_id, &problem_ids)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_problem_from_folder(
    state: State<'_, AppState>,
    folder_id: String,
    problem_id: String,
) -> Result<(), String> {
    let pool = state.pool.read().await.clone();
    folder_repo::remove_problem(&pool, &folder_id, &problem_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn move_problem_to_folder(
    state: State<'_, AppState>,
    problem_id: String,
    from_folder_id: String,
    to_folder_id: String,
) -> Result<(), String> {
    let pool = state.pool.read().await.clone();
    folder_repo::move_problem(&pool, &problem_id, &from_folder_id, &to_folder_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_problem_folder_ids(
    state: State<'_, AppState>,
    problem_id: String,
) -> Result<Vec<String>, String> {
    let pool = state.pool.read().await.clone();
    folder_repo::folder_ids_for_problem(&pool, &problem_id)
        .await
        .map_err(|e| e.to_string())
}
