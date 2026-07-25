use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::Path;
use std::str::FromStr;

use crate::config;

pub type DbPool = SqlitePool;

pub async fn connect(db_path: &Path) -> Result<DbPool, sqlx::Error> {
    let connect_options = SqliteConnectOptions::from_str(&format!(
        "sqlite://{}",
        db_path.to_string_lossy().replace('\\', "/")
    ))?
    .create_if_missing(true)
    .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(connect_options)
        .await?;

    sqlx::migrate!("./src/database/migrations")
        .run(&pool)
        .await
        .expect("failed to run database migrations");

    Ok(pool)
}

pub async fn init_pool() -> Result<DbPool, sqlx::Error> {
    let app_dir = config::app_dir();
    std::fs::create_dir_all(&app_dir).expect("failed to create app data directory");
    std::fs::create_dir_all(config::default_backups_dir())
        .expect("failed to create backups directory");

    connect(&config::db_path()).await
}
