use std::fmt;

use crate::database::DbPool;
use crate::models::folder::Folder;
use crate::models::problem::{ProblemSummary, ProblemSummaryRow};
use crate::utils;

/// Longest folder name we accept. Generous, but keeps the UI from having to
/// render a paragraph as a folder label.
pub const MAX_NAME_LEN: usize = 100;

#[derive(Debug)]
pub enum FolderError {
    /// A user-facing validation problem (empty name, duplicate, bad move…).
    Invalid(String),
    Db(sqlx::Error),
}

impl fmt::Display for FolderError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FolderError::Invalid(msg) => write!(f, "{msg}"),
            FolderError::Db(err) => write!(f, "{err}"),
        }
    }
}

impl From<sqlx::Error> for FolderError {
    fn from(err: sqlx::Error) -> Self {
        FolderError::Db(err)
    }
}

type Result<T> = std::result::Result<T, FolderError>;

const FOLDER_SELECT: &str = "SELECT f.id, f.name, f.parent_id, f.created_at, f.updated_at, \
     (SELECT COUNT(*) FROM folder_problems fp JOIN problems p ON p.id = fp.problem_id \
      WHERE fp.folder_id = f.id AND p.is_deleted = 0) AS problem_count \
     FROM folders f";

fn clean_name(name: &str) -> Result<String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(FolderError::Invalid("Folder name can't be empty.".into()));
    }
    if trimmed.chars().count() > MAX_NAME_LEN {
        return Err(FolderError::Invalid(format!(
            "Folder name is too long (max {MAX_NAME_LEN} characters)."
        )));
    }
    Ok(trimmed.to_string())
}

fn normalize_parent(parent_id: Option<String>) -> Option<String> {
    parent_id.filter(|p| !p.trim().is_empty())
}

/// Like a real file explorer, two folders in the same place can't share a name
/// (case-insensitive). `exclude_id` skips the folder being renamed/moved.
async fn ensure_unique_sibling(
    pool: &DbPool,
    parent_id: Option<&str>,
    name: &str,
    exclude_id: Option<&str>,
) -> Result<()> {
    let (count,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM folders WHERE parent_id IS ? AND lower(name) = lower(?) AND id IS NOT ?",
    )
    .bind(parent_id)
    .bind(name)
    .bind(exclude_id)
    .fetch_one(pool)
    .await?;

    if count > 0 {
        return Err(FolderError::Invalid(format!(
            "A folder named \"{name}\" already exists here."
        )));
    }
    Ok(())
}

async fn ensure_exists(pool: &DbPool, id: &str) -> Result<()> {
    let found: Option<(String,)> = sqlx::query_as("SELECT id FROM folders WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    found
        .map(|_| ())
        .ok_or_else(|| FolderError::Invalid("That folder no longer exists.".into()))
}

pub async fn get_by_id(pool: &DbPool, id: &str) -> Result<Folder> {
    let folder = sqlx::query_as::<_, Folder>(&format!("{FOLDER_SELECT} WHERE f.id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await?;
    folder.ok_or_else(|| FolderError::Invalid("That folder no longer exists.".into()))
}

pub async fn list_all(pool: &DbPool) -> Result<Vec<Folder>> {
    let folders = sqlx::query_as::<_, Folder>(&format!(
        "{FOLDER_SELECT} ORDER BY f.name COLLATE NOCASE ASC"
    ))
    .fetch_all(pool)
    .await?;
    Ok(folders)
}

pub async fn create(pool: &DbPool, name: &str, parent_id: Option<String>) -> Result<Folder> {
    let name = clean_name(name)?;
    let parent_id = normalize_parent(parent_id);
    if let Some(parent) = parent_id.as_deref() {
        ensure_exists(pool, parent).await?;
    }
    ensure_unique_sibling(pool, parent_id.as_deref(), &name, None).await?;

    let id = utils::new_id();
    let now = utils::now_iso();
    sqlx::query(
        "INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&name)
    .bind(parent_id.as_deref())
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await?;

    get_by_id(pool, &id).await
}

pub async fn rename(pool: &DbPool, id: &str, name: &str) -> Result<Folder> {
    let name = clean_name(name)?;
    let current = get_by_id(pool, id).await?;
    ensure_unique_sibling(pool, current.parent_id.as_deref(), &name, Some(id)).await?;

    sqlx::query("UPDATE folders SET name = ?, updated_at = ? WHERE id = ?")
        .bind(&name)
        .bind(utils::now_iso())
        .bind(id)
        .execute(pool)
        .await?;

    get_by_id(pool, id).await
}

/// Moves a folder under `new_parent_id` (or to the top level when `None`).
/// Refuses to move a folder into itself or one of its own subfolders.
pub async fn move_folder(pool: &DbPool, id: &str, new_parent_id: Option<String>) -> Result<Folder> {
    let current = get_by_id(pool, id).await?;
    let new_parent_id = normalize_parent(new_parent_id);

    if let Some(parent) = new_parent_id.as_deref() {
        ensure_exists(pool, parent).await?;
        let (inside_self,): (i64,) = sqlx::query_as(
            "WITH RECURSIVE subtree(id) AS ( \
                 SELECT id FROM folders WHERE id = ? \
                 UNION ALL \
                 SELECT f.id FROM folders f JOIN subtree s ON f.parent_id = s.id \
             ) SELECT COUNT(*) FROM subtree WHERE id = ?",
        )
        .bind(id)
        .bind(parent)
        .fetch_one(pool)
        .await?;
        if inside_self > 0 {
            return Err(FolderError::Invalid(
                "A folder can't be moved into itself or one of its subfolders.".into(),
            ));
        }
    }

    if current.parent_id == new_parent_id {
        return Ok(current);
    }
    ensure_unique_sibling(pool, new_parent_id.as_deref(), &current.name, Some(id)).await?;

    sqlx::query("UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?")
        .bind(new_parent_id.as_deref())
        .bind(utils::now_iso())
        .bind(id)
        .execute(pool)
        .await?;

    get_by_id(pool, id).await
}

/// Deletes a folder and (via ON DELETE CASCADE) all of its subfolders and
/// folder links. The problems themselves are never touched.
pub async fn delete(pool: &DbPool, id: &str) -> Result<()> {
    sqlx::query("DELETE FROM folders WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Problems placed directly in a folder (trashed ones are hidden; restoring a
/// problem from the trash brings it back into its folders).
pub async fn list_problems(pool: &DbPool, folder_id: &str) -> Result<Vec<ProblemSummary>> {
    let rows = sqlx::query_as::<_, ProblemSummaryRow>(
        "SELECT p.id, p.problem_name, p.difficulty, p.topic, p.pattern_category, p.favorite, \
                p.tags, p.created_at, p.updated_at \
         FROM folder_problems fp JOIN problems p ON p.id = fp.problem_id \
         WHERE fp.folder_id = ? AND p.is_deleted = 0 \
         ORDER BY p.problem_name COLLATE NOCASE ASC",
    )
    .bind(folder_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(ProblemSummary::from).collect())
}

/// Adds problems to a folder. Problems already in it are skipped. Returns how
/// many were newly added.
pub async fn add_problems(pool: &DbPool, folder_id: &str, problem_ids: &[String]) -> Result<u64> {
    ensure_exists(pool, folder_id).await?;
    let now = utils::now_iso();
    let mut tx = pool.begin().await?;
    let mut added = 0u64;
    for problem_id in problem_ids {
        let result = sqlx::query(
            "INSERT OR IGNORE INTO folder_problems (folder_id, problem_id, added_at) \
             SELECT ?, id, ? FROM problems WHERE id = ?",
        )
        .bind(folder_id)
        .bind(&now)
        .bind(problem_id)
        .execute(&mut *tx)
        .await?;
        added += result.rows_affected();
    }
    tx.commit().await?;
    Ok(added)
}

pub async fn remove_problem(pool: &DbPool, folder_id: &str, problem_id: &str) -> Result<()> {
    sqlx::query("DELETE FROM folder_problems WHERE folder_id = ? AND problem_id = ?")
        .bind(folder_id)
        .bind(problem_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Takes a problem out of `from_folder_id` and puts it in `to_folder_id`, in
/// one transaction so it's never left in neither.
pub async fn move_problem(
    pool: &DbPool,
    problem_id: &str,
    from_folder_id: &str,
    to_folder_id: &str,
) -> Result<()> {
    if from_folder_id == to_folder_id {
        return Ok(());
    }
    ensure_exists(pool, to_folder_id).await?;
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM folder_problems WHERE folder_id = ? AND problem_id = ?")
        .bind(from_folder_id)
        .bind(problem_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT OR IGNORE INTO folder_problems (folder_id, problem_id, added_at) \
         SELECT ?, id, ? FROM problems WHERE id = ?",
    )
    .bind(to_folder_id)
    .bind(utils::now_iso())
    .bind(problem_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// Ids of every folder a problem is in.
pub async fn folder_ids_for_problem(pool: &DbPool, problem_id: &str) -> Result<Vec<String>> {
    let rows: Vec<(String,)> =
        sqlx::query_as("SELECT folder_id FROM folder_problems WHERE problem_id = ?")
            .bind(problem_id)
            .fetch_all(pool)
            .await?;
    Ok(rows.into_iter().map(|(id,)| id).collect())
}

/// Puts `to_problem_id` in every folder `from_problem_id` is in (used when
/// duplicating a problem, so the copy lands next to the original).
pub async fn copy_links(
    pool: &DbPool,
    from_problem_id: &str,
    to_problem_id: &str,
) -> std::result::Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT OR IGNORE INTO folder_problems (folder_id, problem_id, added_at) \
         SELECT folder_id, ?, ? FROM folder_problems WHERE problem_id = ?",
    )
    .bind(to_problem_id)
    .bind(utils::now_iso())
    .bind(from_problem_id)
    .execute(pool)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database;
    use crate::models::problem::CreateProblem;
    use crate::repositories::problem_repo;

    async fn test_pool() -> DbPool {
        let path = std::env::temp_dir().join(format!("pj-folders-{}.db", utils::new_id()));
        database::connect(&path).await.expect("connect test db")
    }

    async fn new_problem(pool: &DbPool, name: &str) -> String {
        let input = CreateProblem {
            problem_name: name.into(),
            difficulty: "Easy".into(),
            topic: "Arrays".into(),
            platform: String::new(),
            url: String::new(),
            problem_statement: String::new(),
            examples: vec![],
            pattern_category: String::new(),
            favorite: false,
            brute_force: vec![],
            brute_force_time_complexity: String::new(),
            brute_force_space_complexity: String::new(),
            pattern: vec![],
            thinking: vec![],
            time_complexity: String::new(),
            space_complexity: String::new(),
            mistakes: vec![],
            takeaways: vec![],
            tags: vec![],
            code: String::new(),
            language: "python".into(),
        };
        problem_repo::create(pool, input).await.unwrap().id
    }

    #[tokio::test]
    async fn create_rename_and_validate_names() {
        let pool = test_pool().await;
        let arrays = create(&pool, "  Arrays  ", None).await.unwrap();
        assert_eq!(arrays.name, "Arrays");
        assert!(arrays.parent_id.is_none());

        // Same name at the same level is refused (case-insensitive)…
        assert!(matches!(
            create(&pool, "arrays", None).await,
            Err(FolderError::Invalid(_))
        ));
        // …but allowed in a different place.
        let nested = create(&pool, "Arrays", Some(arrays.id.clone()))
            .await
            .unwrap();
        assert_eq!(nested.parent_id.as_deref(), Some(arrays.id.as_str()));

        assert!(matches!(
            create(&pool, "   ", None).await,
            Err(FolderError::Invalid(_))
        ));
        let long = "x".repeat(MAX_NAME_LEN + 1);
        assert!(matches!(
            create(&pool, &long, None).await,
            Err(FolderError::Invalid(_))
        ));

        // Any name is fine, including emoji and punctuation.
        let renamed = rename(&pool, &arrays.id, "🔥 Must-do / Arrays")
            .await
            .unwrap();
        assert_eq!(renamed.name, "🔥 Must-do / Arrays");
        // Renaming to its own name (different case) is allowed.
        rename(&pool, &arrays.id, "🔥 MUST-DO / Arrays")
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn problems_can_live_in_many_folders_and_move() {
        let pool = test_pool().await;
        let arrays = create(&pool, "Arrays", None).await.unwrap();
        let hashing = create(&pool, "Hashing", None).await.unwrap();
        let two_sum = new_problem(&pool, "Two Sum").await;
        let other = new_problem(&pool, "Best Time to Buy").await;

        let added = add_problems(&pool, &arrays.id, &[two_sum.clone(), other.clone()])
            .await
            .unwrap();
        assert_eq!(added, 2);
        // Re-adding is a no-op.
        assert_eq!(
            add_problems(&pool, &arrays.id, std::slice::from_ref(&two_sum))
                .await
                .unwrap(),
            0
        );
        add_problems(&pool, &hashing.id, std::slice::from_ref(&two_sum))
            .await
            .unwrap();

        let mut ids = folder_ids_for_problem(&pool, &two_sum).await.unwrap();
        ids.sort();
        let mut expected = vec![arrays.id.clone(), hashing.id.clone()];
        expected.sort();
        assert_eq!(ids, expected);

        move_problem(&pool, &other, &arrays.id, &hashing.id)
            .await
            .unwrap();
        assert_eq!(list_problems(&pool, &arrays.id).await.unwrap().len(), 1);
        assert_eq!(list_problems(&pool, &hashing.id).await.unwrap().len(), 2);

        remove_problem(&pool, &hashing.id, &other).await.unwrap();
        assert_eq!(list_problems(&pool, &hashing.id).await.unwrap().len(), 1);

        // Trashed problems disappear from folders and come back on restore.
        problem_repo::soft_delete(&pool, &two_sum).await.unwrap();
        assert_eq!(list_problems(&pool, &arrays.id).await.unwrap().len(), 0);
        assert_eq!(get_by_id(&pool, &arrays.id).await.unwrap().problem_count, 0);
        problem_repo::restore(&pool, &two_sum).await.unwrap();
        assert_eq!(get_by_id(&pool, &arrays.id).await.unwrap().problem_count, 1);

        // Permanently deleting a problem removes its folder links.
        problem_repo::permanent_delete(&pool, &two_sum)
            .await
            .unwrap();
        assert_eq!(list_problems(&pool, &hashing.id).await.unwrap().len(), 0);
    }

    #[tokio::test]
    async fn duplicating_a_problem_keeps_its_folders() {
        let pool = test_pool().await;
        let arrays = create(&pool, "Arrays", None).await.unwrap();
        let p = new_problem(&pool, "Two Sum").await;
        add_problems(&pool, &arrays.id, std::slice::from_ref(&p)).await.unwrap();
        let copy = problem_repo::duplicate(&pool, &p).await.unwrap();
        assert_eq!(
            folder_ids_for_problem(&pool, &copy.id).await.unwrap(),
            vec![arrays.id]
        );
    }

    #[tokio::test]
    async fn moving_and_deleting_folders() {
        let pool = test_pool().await;
        let a = create(&pool, "A", None).await.unwrap();
        let b = create(&pool, "B", Some(a.id.clone())).await.unwrap();
        let c = create(&pool, "C", Some(b.id.clone())).await.unwrap();

        // No moving a folder into itself or its own subfolder.
        assert!(matches!(
            move_folder(&pool, &a.id, Some(a.id.clone())).await,
            Err(FolderError::Invalid(_))
        ));
        assert!(matches!(
            move_folder(&pool, &a.id, Some(c.id.clone())).await,
            Err(FolderError::Invalid(_))
        ));

        // Moving C to the top level works.
        let moved = move_folder(&pool, &c.id, None).await.unwrap();
        assert!(moved.parent_id.is_none());

        // Name clash at the destination is refused.
        create(&pool, "B", None).await.unwrap();
        assert!(matches!(
            move_folder(&pool, &b.id, None).await,
            Err(FolderError::Invalid(_))
        ));

        // Deleting A removes B (its subfolder) but never the problems.
        let p = new_problem(&pool, "Kept").await;
        add_problems(&pool, &b.id, std::slice::from_ref(&p)).await.unwrap();
        delete(&pool, &a.id).await.unwrap();
        let remaining: Vec<String> = list_all(&pool)
            .await
            .unwrap()
            .into_iter()
            .map(|f| f.name)
            .collect();
        assert_eq!(remaining, vec!["B".to_string(), "C".to_string()]);
        assert!(problem_repo::get_by_id(&pool, &p).await.unwrap().is_some());
        assert!(folder_ids_for_problem(&pool, &p).await.unwrap().is_empty());
    }
}
