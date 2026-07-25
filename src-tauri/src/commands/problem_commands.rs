use tauri::State;

use crate::models::problem::{CreateProblem, Problem, ProblemFilters, ProblemSummary, UpdateProblem};
use crate::repositories::problem_repo;
use crate::AppState;

#[tauri::command]
pub async fn create_problem(
    state: State<'_, AppState>,
    input: CreateProblem,
) -> Result<Problem, String> {
    let pool = state.pool.read().await.clone();
    problem_repo::create(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_problem(
    state: State<'_, AppState>,
    input: UpdateProblem,
) -> Result<Problem, String> {
    let pool = state.pool.read().await.clone();
    problem_repo::update(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_problem(state: State<'_, AppState>, id: String) -> Result<Option<Problem>, String> {
    let pool = state.pool.read().await.clone();
    problem_repo::get_by_id(&pool, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_problems(state: State<'_, AppState>) -> Result<Vec<ProblemSummary>, String> {
    let pool = state.pool.read().await.clone();
    problem_repo::list_all(&pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_trash(state: State<'_, AppState>) -> Result<Vec<ProblemSummary>, String> {
    let pool = state.pool.read().await.clone();
    problem_repo::list_trash(&pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_filtered_problems(
    state: State<'_, AppState>,
    filters: ProblemFilters,
) -> Result<Vec<ProblemSummary>, String> {
    let pool = state.pool.read().await.clone();
    problem_repo::list_filtered(&pool, filters)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_favorite(state: State<'_, AppState>, id: String) -> Result<Problem, String> {
    let pool = state.pool.read().await.clone();
    problem_repo::toggle_favorite(&pool, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_problem(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let pool = state.pool.read().await.clone();
    problem_repo::soft_delete(&pool, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restore_problem(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let pool = state.pool.read().await.clone();
    problem_repo::restore(&pool, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn permanent_delete_problem(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let pool = state.pool.read().await.clone();
    problem_repo::permanent_delete(&pool, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_problems_json(state: State<'_, AppState>, json: String) -> Result<usize, String> {
    let items: Vec<CreateProblem> = serde_json::from_str(&json)
        .map_err(|e| format!("Could not parse JSON: {e}"))?;
    let pool = state.pool.read().await.clone();
    problem_repo::import_many(&pool, items)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn duplicate_problem(state: State<'_, AppState>, id: String) -> Result<Problem, String> {
    let pool = state.pool.read().await.clone();
    problem_repo::duplicate(&pool, &id)
        .await
        .map_err(|e| e.to_string())
}
