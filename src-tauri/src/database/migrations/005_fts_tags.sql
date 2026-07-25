-- Rebuild the FTS index to also cover `tags`, so full-text search matches
-- company/custom tags too. External-content FTS5 tables can't be ALTERed to add
-- a column, so we drop and recreate the table + triggers, then repopulate from
-- the content table with the built-in 'rebuild' command.
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
    content='problems',
    content_rowid='rowid'
);

CREATE TRIGGER problems_ai AFTER INSERT ON problems BEGIN
    INSERT INTO problems_fts (rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways, tags)
    VALUES (new.rowid, new.problem_name, new.topic, new.pattern_category, new.pattern, new.thinking, new.mistakes, new.takeaways, new.tags);
END;

CREATE TRIGGER problems_ad AFTER DELETE ON problems BEGIN
    INSERT INTO problems_fts (problems_fts, rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways, tags)
    VALUES ('delete', old.rowid, old.problem_name, old.topic, old.pattern_category, old.pattern, old.thinking, old.mistakes, old.takeaways, old.tags);
END;

CREATE TRIGGER problems_au AFTER UPDATE ON problems BEGIN
    INSERT INTO problems_fts (problems_fts, rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways, tags)
    VALUES ('delete', old.rowid, old.problem_name, old.topic, old.pattern_category, old.pattern, old.thinking, old.mistakes, old.takeaways, old.tags);
    INSERT INTO problems_fts (rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways, tags)
    VALUES (new.rowid, new.problem_name, new.topic, new.pattern_category, new.pattern, new.thinking, new.mistakes, new.takeaways, new.tags);
END;

INSERT INTO problems_fts(problems_fts) VALUES('rebuild');
