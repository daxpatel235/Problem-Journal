use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// A user-named folder. `parent_id` is `None` for top-level folders.
/// `problem_count` is the number of (non-trashed) problems placed directly in
/// this folder — subfolders are not included, the frontend sums those itself.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub problem_count: i64,
    pub created_at: String,
    pub updated_at: String,
}
