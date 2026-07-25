use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingEntry {
    pub key: String,
    pub value: String,
}

pub type SettingsMap = HashMap<String, String>;

pub mod keys {
    pub const ZOOM_LEVEL: &str = "zoom_level";
    pub const SIDEBAR_WIDTH: &str = "sidebar_width";
    pub const TIMELINE_WIDTH: &str = "timeline_width";
    pub const LAST_OPENED_PROBLEM_ID: &str = "last_opened_problem_id";
    pub const WINDOW_WIDTH: &str = "window_width";
    pub const WINDOW_HEIGHT: &str = "window_height";
    pub const WINDOW_X: &str = "window_x";
    pub const WINDOW_Y: &str = "window_y";
    pub const WINDOW_MAXIMIZED: &str = "window_maximized";
    pub const BACKUP_DIR: &str = "backup_dir";
    pub const BACKUP_RETENTION: &str = "backup_retention";
}
