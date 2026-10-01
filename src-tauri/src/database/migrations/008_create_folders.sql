-- Folders: a user-named, nestable way to organise problems (like a file
-- explorer). `parent_id` NULL means the folder sits at the top level. Deleting
-- a folder deletes its subfolders too (ON DELETE CASCADE), but never the
-- problems inside them: those only lose the folder link.
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES folders (id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders (parent_id);

-- Many-to-many link: one problem can live in several folders at once.
CREATE TABLE IF NOT EXISTS folder_problems (
    folder_id TEXT NOT NULL REFERENCES folders (id) ON DELETE CASCADE,
    problem_id TEXT NOT NULL REFERENCES problems (id) ON DELETE CASCADE,
    added_at TEXT NOT NULL,
    PRIMARY KEY (folder_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_folder_problems_problem_id ON folder_problems (problem_id);
