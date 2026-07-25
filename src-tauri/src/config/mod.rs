use std::path::PathBuf;

pub const APP_DIR_NAME: &str = ".problem-journal";
pub const DB_FILE_NAME: &str = "problem_journal.db";
pub const BACKUPS_DIR_NAME: &str = "backups";
pub const DEFAULT_BACKUP_RETENTION: usize = 10;

pub fn app_dir() -> PathBuf {
    let home = dirs::home_dir().expect("could not resolve home directory");
    home.join(APP_DIR_NAME)
}

pub fn db_path() -> PathBuf {
    app_dir().join(DB_FILE_NAME)
}

pub fn default_backups_dir() -> PathBuf {
    app_dir().join(BACKUPS_DIR_NAME)
}
