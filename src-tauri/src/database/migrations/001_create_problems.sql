CREATE TABLE IF NOT EXISTS problems (
    id TEXT PRIMARY KEY,
    problem_name TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'Medium',
    topic TEXT NOT NULL DEFAULT '',
    platform TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    pattern_category TEXT NOT NULL DEFAULT '',
    favorite INTEGER NOT NULL DEFAULT 0,
    pattern TEXT NOT NULL DEFAULT '[]',
    thinking TEXT NOT NULL DEFAULT '[]',
    mistakes TEXT NOT NULL DEFAULT '[]',
    takeaways TEXT NOT NULL DEFAULT '[]',
    code TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'python',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_problems_created_at ON problems (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_problems_is_deleted ON problems (is_deleted);
CREATE INDEX IF NOT EXISTS idx_problems_favorite ON problems (favorite);
CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems (difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_topic ON problems (topic);
