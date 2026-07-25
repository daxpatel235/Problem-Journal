use chrono::Utc;
use uuid::Uuid;

pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

pub fn json_array_to_string(items: &[String]) -> String {
    serde_json::to_string(items).unwrap_or_else(|_| "[]".to_string())
}

pub fn json_array_from_string(s: &str) -> Vec<String> {
    serde_json::from_str(s).unwrap_or_default()
}
