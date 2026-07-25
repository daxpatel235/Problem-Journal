use chrono::Utc;
use serde::Serialize;
use std::path::PathBuf;

use crate::config;
use crate::database::{self, DbPool};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub file_name: String,
    pub path: String,
    pub size_bytes: u64,
    pub created_at: String,
}

fn backup_dir(configured: Option<&str>) -> PathBuf {
    match configured {
        Some(dir) if !dir.trim().is_empty() => PathBuf::from(dir),
        _ => config::default_backups_dir(),
    }
}

pub fn create_backup(configured_dir: Option<&str>, retention: usize) -> std::io::Result<BackupInfo> {
    let dir = backup_dir(configured_dir);
    std::fs::create_dir_all(&dir)?;

    let timestamp = Utc::now().format("%Y%m%d-%H%M%S");
    let file_name = format!("problem_journal-{timestamp}.db");
    let dest = dir.join(&file_name);

    std::fs::copy(config::db_path(), &dest)?;

    rotate_backups(&dir, retention)?;

    let metadata = std::fs::metadata(&dest)?;
    Ok(BackupInfo {
        file_name,
        path: dest.to_string_lossy().to_string(),
        size_bytes: metadata.len(),
        created_at: Utc::now().to_rfc3339(),
    })
}

fn rotate_backups(dir: &PathBuf, retention: usize) -> std::io::Result<()> {
    let mut entries: Vec<_> = std::fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext == "db")
                .unwrap_or(false)
        })
        .collect();

    entries.sort_by_key(|e| {
        e.metadata()
            .and_then(|m| m.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
    });

    while entries.len() > retention {
        let oldest = entries.remove(0);
        let _ = std::fs::remove_file(oldest.path());
    }

    Ok(())
}

pub fn list_backups(configured_dir: Option<&str>) -> std::io::Result<Vec<BackupInfo>> {
    let dir = backup_dir(configured_dir);
    std::fs::create_dir_all(&dir)?;

    let mut backups: Vec<BackupInfo> = std::fs::read_dir(&dir)?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext == "db")
                .unwrap_or(false)
        })
        .filter_map(|e| {
            let metadata = e.metadata().ok()?;
            let created: chrono::DateTime<Utc> = metadata.modified().ok()?.into();
            Some(BackupInfo {
                file_name: e.file_name().to_string_lossy().to_string(),
                path: e.path().to_string_lossy().to_string(),
                size_bytes: metadata.len(),
                created_at: created.to_rfc3339(),
            })
        })
        .collect();

    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

/// Closes the current pool, overwrites the live database with the backup file,
/// then reopens the pool. Callers must swap the returned pool into shared state.
pub async fn restore_backup(pool: DbPool, backup_path: &str) -> Result<DbPool, String> {
    pool.close().await;

    std::fs::copy(backup_path, config::db_path()).map_err(|e| e.to_string())?;

    database::connect(&config::db_path())
        .await
        .map_err(|e| e.to_string())
}
