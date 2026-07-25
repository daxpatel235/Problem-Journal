use tauri::State;

use crate::config;
use crate::models::settings::keys;
use crate::repositories::settings_repo;
use crate::services::backup_service::{self, BackupInfo};
use crate::AppState;

async fn resolve_backup_settings(state: &State<'_, AppState>) -> (Option<String>, usize) {
    let pool = state.pool.read().await.clone();
    let dir = settings_repo::get(&pool, keys::BACKUP_DIR).await.ok().flatten();
    let retention = settings_repo::get(&pool, keys::BACKUP_RETENTION)
        .await
        .ok()
        .flatten()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(config::DEFAULT_BACKUP_RETENTION);
    (dir, retention)
}

#[tauri::command]
pub async fn create_backup(state: State<'_, AppState>) -> Result<BackupInfo, String> {
    let (dir, retention) = resolve_backup_settings(&state).await;
    backup_service::create_backup(dir.as_deref(), retention).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_backups(state: State<'_, AppState>) -> Result<Vec<BackupInfo>, String> {
    let (dir, _) = resolve_backup_settings(&state).await;
    backup_service::list_backups(dir.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restore_backup(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let mut pool_guard = state.pool.write().await;
    let current_pool = pool_guard.clone();
    let new_pool = backup_service::restore_backup(current_pool, &path).await?;
    *pool_guard = new_pool;
    Ok(())
}
