use sqlx::QueryBuilder;
use sqlx::Sqlite;

use crate::database::DbPool;
use crate::models::problem::{
    CreateProblem, Problem, ProblemFilters, ProblemRow, ProblemSummary, ProblemSummaryRow,
    UpdateProblem,
};
use crate::utils;

const SUMMARY_COLUMNS: &str =
    "id, problem_name, difficulty, topic, pattern_category, favorite, tags, created_at, updated_at";

pub async fn create(pool: &DbPool, input: CreateProblem) -> Result<Problem, sqlx::Error> {
    let id = utils::new_id();
    let now = utils::now_iso();

    sqlx::query(
        r#"
        INSERT INTO problems (
            id, problem_name, difficulty, topic, platform, url, problem_statement, examples, pattern_category, favorite,
            brute_force, brute_force_time_complexity, brute_force_space_complexity,
            pattern, thinking, time_complexity, space_complexity, mistakes, takeaways, tags, code, language, is_deleted, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.problem_name)
    .bind(&input.difficulty)
    .bind(&input.topic)
    .bind(&input.platform)
    .bind(&input.url)
    .bind(&input.problem_statement)
    .bind(utils::json_array_to_string(&input.examples))
    .bind(&input.pattern_category)
    .bind(input.favorite as i64)
    .bind(utils::json_array_to_string(&input.brute_force))
    .bind(&input.brute_force_time_complexity)
    .bind(&input.brute_force_space_complexity)
    .bind(utils::json_array_to_string(&input.pattern))
    .bind(utils::json_array_to_string(&input.thinking))
    .bind(&input.time_complexity)
    .bind(&input.space_complexity)
    .bind(utils::json_array_to_string(&input.mistakes))
    .bind(utils::json_array_to_string(&input.takeaways))
    .bind(utils::json_array_to_string(&input.tags))
    .bind(&input.code)
    .bind(&input.language)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await?;

    get_by_id(pool, &id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update(pool: &DbPool, input: UpdateProblem) -> Result<Problem, sqlx::Error> {
    let now = utils::now_iso();

    sqlx::query(
        r#"
        UPDATE problems SET
            problem_name = ?, difficulty = ?, topic = ?, platform = ?, url = ?, problem_statement = ?, examples = ?,
            pattern_category = ?, favorite = ?, brute_force = ?, brute_force_time_complexity = ?, brute_force_space_complexity = ?,
            pattern = ?, thinking = ?, time_complexity = ?, space_complexity = ?, mistakes = ?,
            takeaways = ?, tags = ?, code = ?, language = ?, updated_at = ?
        WHERE id = ? AND is_deleted = 0
        "#,
    )
    .bind(&input.problem_name)
    .bind(&input.difficulty)
    .bind(&input.topic)
    .bind(&input.platform)
    .bind(&input.url)
    .bind(&input.problem_statement)
    .bind(utils::json_array_to_string(&input.examples))
    .bind(&input.pattern_category)
    .bind(input.favorite as i64)
    .bind(utils::json_array_to_string(&input.brute_force))
    .bind(&input.brute_force_time_complexity)
    .bind(&input.brute_force_space_complexity)
    .bind(utils::json_array_to_string(&input.pattern))
    .bind(utils::json_array_to_string(&input.thinking))
    .bind(&input.time_complexity)
    .bind(&input.space_complexity)
    .bind(utils::json_array_to_string(&input.mistakes))
    .bind(utils::json_array_to_string(&input.takeaways))
    .bind(utils::json_array_to_string(&input.tags))
    .bind(&input.code)
    .bind(&input.language)
    .bind(&now)
    .bind(&input.id)
    .execute(pool)
    .await?;

    get_by_id(pool, &input.id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn get_by_id(pool: &DbPool, id: &str) -> Result<Option<Problem>, sqlx::Error> {
    let row = sqlx::query_as::<_, ProblemRow>("SELECT * FROM problems WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?;

    Ok(row.map(Problem::from))
}

pub async fn list_all(pool: &DbPool) -> Result<Vec<ProblemSummary>, sqlx::Error> {
    let rows = sqlx::query_as::<_, ProblemSummaryRow>(&format!(
        "SELECT {SUMMARY_COLUMNS} FROM problems WHERE is_deleted = 0 ORDER BY created_at DESC"
    ))
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(ProblemSummary::from).collect())
}

pub async fn list_trash(pool: &DbPool) -> Result<Vec<ProblemSummary>, sqlx::Error> {
    let rows = sqlx::query_as::<_, ProblemSummaryRow>(&format!(
        "SELECT {SUMMARY_COLUMNS} FROM problems WHERE is_deleted = 1 ORDER BY updated_at DESC"
    ))
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(ProblemSummary::from).collect())
}

pub async fn list_filtered(
    pool: &DbPool,
    filters: ProblemFilters,
) -> Result<Vec<ProblemSummary>, sqlx::Error> {
    let mut builder: QueryBuilder<Sqlite> = if let Some(q) = filters
        .query
        .as_ref()
        .filter(|q| !q.trim().is_empty())
    {
        let mut b: QueryBuilder<Sqlite> = QueryBuilder::new(
            "SELECT p.id, p.problem_name, p.difficulty, p.topic, p.pattern_category, p.favorite, p.tags, p.created_at, p.updated_at \
             FROM problems_fts f JOIN problems p ON p.rowid = f.rowid \
             WHERE f.problems_fts MATCH ",
        );
        b.push_bind(format!("{}*", q.trim()));
        b.push(" AND p.is_deleted = 0");
        b
    } else {
        // Alias `problems` as `p` here too, so every filter/sort clause below can
        // be `p.`-qualified and stay unambiguous in both branches (the FTS table
        // also exposes columns like `topic` and `tags`).
        QueryBuilder::new(format!(
            "SELECT {SUMMARY_COLUMNS} FROM problems p WHERE p.is_deleted = 0"
        ))
    };

    if let Some(difficulty) = filters.difficulty.filter(|d| !d.is_empty()) {
        builder.push(" AND p.difficulty = ");
        builder.push_bind(difficulty);
    }
    if let Some(topic) = filters.topic.filter(|t| !t.is_empty()) {
        builder.push(" AND p.topic = ");
        builder.push_bind(topic);
    }
    if let Some(pattern_category) = filters.pattern_category.filter(|p| !p.is_empty()) {
        builder.push(" AND p.pattern_category = ");
        builder.push_bind(pattern_category);
    }
    if let Some(tag) = filters.tag.filter(|t| !t.is_empty()) {
        // Tags are stored as a JSON array string (e.g. ["Google","Amazon"]);
        // match the quoted value so "Go" doesn't match "Google".
        builder.push(" AND p.tags LIKE ");
        builder.push_bind(format!("%\"{tag}\"%"));
    }
    if filters.favorites_only.unwrap_or(false) {
        builder.push(" AND p.favorite = 1");
    }
    if let Some(from) = filters.date_from.filter(|d| !d.is_empty()) {
        builder.push(" AND p.created_at >= ");
        builder.push_bind(from);
    }
    if let Some(to) = filters.date_to.filter(|d| !d.is_empty()) {
        builder.push(" AND p.created_at <= ");
        builder.push_bind(to);
    }

    let sort_clause = match filters.sort.as_deref() {
        Some("oldest") => " ORDER BY p.created_at ASC",
        Some("name") => " ORDER BY p.problem_name ASC",
        Some("updated") => " ORDER BY p.updated_at DESC",
        _ => " ORDER BY p.created_at DESC",
    };
    builder.push(sort_clause);

    let rows: Vec<ProblemSummaryRow> = builder.build_query_as().fetch_all(pool).await?;
    Ok(rows.into_iter().map(ProblemSummary::from).collect())
}

pub async fn toggle_favorite(pool: &DbPool, id: &str) -> Result<Problem, sqlx::Error> {
    let now = utils::now_iso();
    sqlx::query(
        "UPDATE problems SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?",
    )
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await?;

    get_by_id(pool, id).await?.ok_or(sqlx::Error::RowNotFound)
}

pub async fn soft_delete(pool: &DbPool, id: &str) -> Result<(), sqlx::Error> {
    let now = utils::now_iso();
    sqlx::query("UPDATE problems SET is_deleted = 1, updated_at = ? WHERE id = ?")
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn restore(pool: &DbPool, id: &str) -> Result<(), sqlx::Error> {
    let now = utils::now_iso();
    sqlx::query("UPDATE problems SET is_deleted = 0, updated_at = ? WHERE id = ?")
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn permanent_delete(pool: &DbPool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM problems WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Bulk-inserts problems (e.g. from a JSON export). Each becomes a brand-new
/// row with a fresh id and timestamps; originals on another machine are left
/// untouched. Returns the number imported.
pub async fn import_many(pool: &DbPool, items: Vec<CreateProblem>) -> Result<usize, sqlx::Error> {
    let mut imported = 0usize;
    for item in items {
        create(pool, item).await?;
        imported += 1;
    }
    Ok(imported)
}

pub async fn duplicate(pool: &DbPool, id: &str) -> Result<Problem, sqlx::Error> {
    let original = get_by_id(pool, id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)?;

    create(
        pool,
        CreateProblem {
            problem_name: format!("{} (copy)", original.problem_name),
            difficulty: original.difficulty,
            topic: original.topic,
            platform: original.platform,
            url: original.url,
            problem_statement: original.problem_statement,
            examples: original.examples,
            pattern_category: original.pattern_category,
            favorite: false,
            brute_force: original.brute_force,
            brute_force_time_complexity: original.brute_force_time_complexity,
            brute_force_space_complexity: original.brute_force_space_complexity,
            pattern: original.pattern,
            thinking: original.thinking,
            time_complexity: original.time_complexity,
            space_complexity: original.space_complexity,
            mistakes: original.mistakes,
            takeaways: original.takeaways,
            tags: original.tags,
            code: original.code,
            language: original.language,
        },
    )
    .await
}
