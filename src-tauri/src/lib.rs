pub mod commands;
pub mod config;
pub mod database;
pub mod models;
pub mod repositories;
pub mod services;
pub mod utils;

use tauri::Manager;
use tokio::sync::RwLock;

use crate::database::DbPool;
use crate::models::settings::keys;
use crate::repositories::settings_repo;
use crate::services::backup_service;

pub struct AppState {
    pub pool: RwLock<DbPool>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let pool = database::init_pool()
                    .await
                    .expect("failed to initialize database");
                let settings = settings_repo::get_all(&pool).await.unwrap_or_default();
                handle.manage(AppState {
                    pool: RwLock::new(pool),
                });

                if let Some(window) = handle.get_webview_window("main") {
                    if let (Some(w), Some(h)) = (
                        settings.get(keys::WINDOW_WIDTH).and_then(|v| v.parse::<u32>().ok()),
                        settings.get(keys::WINDOW_HEIGHT).and_then(|v| v.parse::<u32>().ok()),
                    ) {
                        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(w, h)));
                    }
                    if let (Some(x), Some(y)) = (
                        settings.get(keys::WINDOW_X).and_then(|v| v.parse::<i32>().ok()),
                        settings.get(keys::WINDOW_Y).and_then(|v| v.parse::<i32>().ok()),
                    ) {
                        let _ = window
                            .set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
                    }
                    if settings
                        .get(keys::WINDOW_MAXIMIZED)
                        .map(|v| v == "true")
                        .unwrap_or(false)
                    {
                        let _ = window.maximize();
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let handle = window.app_handle().clone();
                let win = window.clone();
                tauri::async_runtime::block_on(async move {
                    let state = handle.state::<AppState>();
                    let pool = state.pool.read().await.clone();

                    if let Ok(size) = win.inner_size() {
                        let _ = settings_repo::set(&pool, keys::WINDOW_WIDTH, &size.width.to_string()).await;
                        let _ = settings_repo::set(&pool, keys::WINDOW_HEIGHT, &size.height.to_string()).await;
                    }
                    if let Ok(pos) = win.outer_position() {
                        let _ = settings_repo::set(&pool, keys::WINDOW_X, &pos.x.to_string()).await;
                        let _ = settings_repo::set(&pool, keys::WINDOW_Y, &pos.y.to_string()).await;
                    }
                    let maximized = win.is_maximized().unwrap_or(false);
                    let _ =
                        settings_repo::set(&pool, keys::WINDOW_MAXIMIZED, &maximized.to_string()).await;

                    let dir = settings_repo::get(&pool, keys::BACKUP_DIR).await.ok().flatten();
                    let retention = settings_repo::get(&pool, keys::BACKUP_RETENTION)
                        .await
                        .ok()
                        .flatten()
                        .and_then(|v| v.parse::<usize>().ok())
                        .unwrap_or(config::DEFAULT_BACKUP_RETENTION);
                    let _ = backup_service::create_backup(dir.as_deref(), retention);
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::problem_commands::create_problem,
            commands::problem_commands::update_problem,
            commands::problem_commands::get_problem,
            commands::problem_commands::list_problems,
            commands::problem_commands::list_trash,
            commands::problem_commands::get_filtered_problems,
            commands::problem_commands::toggle_favorite,
            commands::problem_commands::delete_problem,
            commands::problem_commands::restore_problem,
            commands::problem_commands::permanent_delete_problem,
            commands::problem_commands::duplicate_problem,
            commands::problem_commands::import_problems_json,
            commands::settings_commands::get_setting,
            commands::settings_commands::set_setting,
            commands::settings_commands::get_all_settings,
            commands::backup_commands::create_backup,
            commands::backup_commands::list_backups,
            commands::backup_commands::restore_backup,
            commands::export_commands::export_problem_markdown,
            commands::export_commands::export_problem_json,
            commands::export_commands::export_problem_pdf_html,
            commands::export_commands::export_all_json,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
