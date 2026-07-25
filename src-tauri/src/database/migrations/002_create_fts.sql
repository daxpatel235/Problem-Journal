CREATE VIRTUAL TABLE IF NOT EXISTS problems_fts USING fts5(
    problem_name,
    topic,
    pattern_category,
    pattern,
    thinking,
    mistakes,
    takeaways,
    content='problems',
    content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS problems_ai AFTER INSERT ON problems BEGIN
    INSERT INTO problems_fts (rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways)
    VALUES (new.rowid, new.problem_name, new.topic, new.pattern_category, new.pattern, new.thinking, new.mistakes, new.takeaways);
END;

CREATE TRIGGER IF NOT EXISTS problems_ad AFTER DELETE ON problems BEGIN
    INSERT INTO problems_fts (problems_fts, rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways)
    VALUES ('delete', old.rowid, old.problem_name, old.topic, old.pattern_category, old.pattern, old.thinking, old.mistakes, old.takeaways);
END;

CREATE TRIGGER IF NOT EXISTS problems_au AFTER UPDATE ON problems BEGIN
    INSERT INTO problems_fts (problems_fts, rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways)
    VALUES ('delete', old.rowid, old.problem_name, old.topic, old.pattern_category, old.pattern, old.thinking, old.mistakes, old.takeaways);
    INSERT INTO problems_fts (rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways)
    VALUES (new.rowid, new.problem_name, new.topic, new.pattern_category, new.pattern, new.thinking, new.mistakes, new.takeaways);
END;
