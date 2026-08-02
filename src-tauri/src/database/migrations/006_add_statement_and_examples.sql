-- Add problem_statement and examples columns to problems table
ALTER TABLE problems ADD COLUMN problem_statement TEXT NOT NULL DEFAULT '';
ALTER TABLE problems ADD COLUMN examples TEXT NOT NULL DEFAULT '[]';

-- Update FTS table to include problem_statement for searching
DROP TRIGGER IF EXISTS problems_ai;
DROP TRIGGER IF EXISTS problems_ad;
DROP TRIGGER IF EXISTS problems_au;
DROP TABLE IF EXISTS problems_fts;

CREATE VIRTUAL TABLE problems_fts USING fts5(
    problem_name,
    topic,
    pattern_category,
    pattern,
    thinking,
    mistakes,
    takeaways,
    tags,
    problem_statement,
    examples,
    content='problems',
    content_rowid='rowid'
);

CREATE TRIGGER problems_ai AFTER INSERT ON problems BEGIN
    INSERT INTO problems_fts (rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways, tags, problem_statement, examples)
    VALUES (new.rowid, new.problem_name, new.topic, new.pattern_category, new.pattern, new.thinking, new.mistakes, new.takeaways, new.tags, new.problem_statement, new.examples);
END;

CREATE TRIGGER problems_ad AFTER DELETE ON problems BEGIN
    INSERT INTO problems_fts (problems_fts, rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways, tags, problem_statement, examples)
    VALUES ('delete', old.rowid, old.problem_name, old.topic, old.pattern_category, old.pattern, old.thinking, old.mistakes, old.takeaways, old.tags, old.problem_statement, old.examples);
END;

CREATE TRIGGER problems_au AFTER UPDATE ON problems BEGIN
    INSERT INTO problems_fts (problems_fts, rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways, tags, problem_statement, examples)
    VALUES ('delete', old.rowid, old.problem_name, old.topic, old.pattern_category, old.pattern, old.thinking, old.mistakes, old.takeaways, old.tags, old.problem_statement, old.examples);
    INSERT INTO problems_fts (rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways, tags, problem_statement, examples)
    VALUES (new.rowid, new.problem_name, new.topic, new.pattern_category, new.pattern, new.thinking, new.mistakes, new.takeaways, new.tags, new.problem_statement, new.examples);
END;

INSERT INTO problems_fts(problems_fts) VALUES('rebuild');
