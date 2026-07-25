use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::utils;

#[derive(Debug, Clone, FromRow)]
pub struct ProblemRow {
    pub id: String,
    pub problem_name: String,
    pub difficulty: String,
    pub topic: String,
    pub platform: String,
    pub url: String,
    pub pattern_category: String,
    pub favorite: i64,
    pub pattern: String,
    pub thinking: String,
    pub mistakes: String,
    pub takeaways: String,
    pub tags: String,
    pub code: String,
    pub language: String,
    pub is_deleted: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Problem {
    pub id: String,
    pub problem_name: String,
    pub difficulty: String,
    pub topic: String,
    pub platform: String,
    pub url: String,
    pub pattern_category: String,
    pub favorite: bool,
    pub pattern: Vec<String>,
    pub thinking: Vec<String>,
    pub mistakes: Vec<String>,
    pub takeaways: Vec<String>,
    pub tags: Vec<String>,
    pub code: String,
    pub language: String,
    pub is_deleted: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<ProblemRow> for Problem {
    fn from(row: ProblemRow) -> Self {
        Problem {
            id: row.id,
            problem_name: row.problem_name,
            difficulty: row.difficulty,
            topic: row.topic,
            platform: row.platform,
            url: row.url,
            pattern_category: row.pattern_category,
            favorite: row.favorite != 0,
            pattern: utils::json_array_from_string(&row.pattern),
            thinking: utils::json_array_from_string(&row.thinking),
            mistakes: utils::json_array_from_string(&row.mistakes),
            takeaways: utils::json_array_from_string(&row.takeaways),
            tags: utils::json_array_from_string(&row.tags),
            code: row.code,
            language: row.language,
            is_deleted: row.is_deleted != 0,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, Clone, FromRow)]
pub struct ProblemSummaryRow {
    pub id: String,
    pub problem_name: String,
    pub difficulty: String,
    pub topic: String,
    pub pattern_category: String,
    pub favorite: i64,
    pub tags: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemSummary {
    pub id: String,
    pub problem_name: String,
    pub difficulty: String,
    pub topic: String,
    pub pattern_category: String,
    pub favorite: bool,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<ProblemSummaryRow> for ProblemSummary {
    fn from(row: ProblemSummaryRow) -> Self {
        ProblemSummary {
            id: row.id,
            problem_name: row.problem_name,
            difficulty: row.difficulty,
            topic: row.topic,
            pattern_category: row.pattern_category,
            favorite: row.favorite != 0,
            tags: utils::json_array_from_string(&row.tags),
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProblem {
    pub problem_name: String,
    pub difficulty: String,
    pub topic: String,
    pub platform: String,
    pub url: String,
    pub pattern_category: String,
    pub favorite: bool,
    pub pattern: Vec<String>,
    pub thinking: Vec<String>,
    pub mistakes: Vec<String>,
    pub takeaways: Vec<String>,
    pub tags: Vec<String>,
    pub code: String,
    pub language: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProblem {
    pub id: String,
    pub problem_name: String,
    pub difficulty: String,
    pub topic: String,
    pub platform: String,
    pub url: String,
    pub pattern_category: String,
    pub favorite: bool,
    pub pattern: Vec<String>,
    pub thinking: Vec<String>,
    pub mistakes: Vec<String>,
    pub takeaways: Vec<String>,
    pub tags: Vec<String>,
    pub code: String,
    pub language: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemFilters {
    pub query: Option<String>,
    pub difficulty: Option<String>,
    pub topic: Option<String>,
    pub pattern_category: Option<String>,
    pub tag: Option<String>,
    pub favorites_only: Option<bool>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub sort: Option<String>,
}
