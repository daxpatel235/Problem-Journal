use tauri::State;

use crate::models::settings::SettingsMap;
use crate::repositories::settings_repo;
use crate::AppState;

#[tauri::command]
pub async fn get_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    let pool = state.pool.read().await.clone();
    settings_repo::get(&pool, &key).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    let pool = state.pool.read().await.clone();
    settings_repo::set(&pool, &key, &value)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_settings(state: State<'_, AppState>) -> Result<SettingsMap, String> {
    let pool = state.pool.read().await.clone();
    settings_repo::get_all(&pool).await.map_err(|e| e.to_string())
}
