-- Add brute-force approach and complexity-analysis columns to problems table
ALTER TABLE problems ADD COLUMN brute_force TEXT NOT NULL DEFAULT '[]';
ALTER TABLE problems ADD COLUMN brute_force_time_complexity TEXT NOT NULL DEFAULT '';
ALTER TABLE problems ADD COLUMN brute_force_space_complexity TEXT NOT NULL DEFAULT '';
ALTER TABLE problems ADD COLUMN time_complexity TEXT NOT NULL DEFAULT '';
ALTER TABLE problems ADD COLUMN space_complexity TEXT NOT NULL DEFAULT '';

-- Update FTS table to include the new searchable columns
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
    brute_force,
    brute_force_time_complexity,
    brute_force_space_complexity,
    time_complexity,
    space_complexity,
    content='problems',
    content_rowid='rowid'
);

CREATE TRIGGER problems_ai AFTER INSERT ON problems BEGIN
    INSERT INTO problems_fts (rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways, tags, problem_statement, examples, brute_force, brute_force_time_complexity, brute_force_space_complexity, time_complexity, space_complexity)
    VALUES (new.rowid, new.problem_name, new.topic, new.pattern_category, new.pattern, new.thinking, new.mistakes, new.takeaways, new.tags, new.problem_statement, new.examples, new.brute_force, new.brute_force_time_complexity, new.brute_force_space_complexity, new.time_complexity, new.space_complexity);
END;

CREATE TRIGGER problems_ad AFTER DELETE ON problems BEGIN
    INSERT INTO problems_fts (problems_fts, rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways, tags, problem_statement, examples, brute_force, brute_force_time_complexity, brute_force_space_complexity, time_complexity, space_complexity)
    VALUES ('delete', old.rowid, old.problem_name, old.topic, old.pattern_category, old.pattern, old.thinking, old.mistakes, old.takeaways, old.tags, old.problem_statement, old.examples, old.brute_force, old.brute_force_time_complexity, old.brute_force_space_complexity, old.time_complexity, old.space_complexity);
END;

CREATE TRIGGER problems_au AFTER UPDATE ON problems BEGIN
    INSERT INTO problems_fts (problems_fts, rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways, tags, problem_statement, examples, brute_force, brute_force_time_complexity, brute_force_space_complexity, time_complexity, space_complexity)
    VALUES ('delete', old.rowid, old.problem_name, old.topic, old.pattern_category, old.pattern, old.thinking, old.mistakes, old.takeaways, old.tags, old.problem_statement, old.examples, old.brute_force, old.brute_force_time_complexity, old.brute_force_space_complexity, old.time_complexity, old.space_complexity);
    INSERT INTO problems_fts (rowid, problem_name, topic, pattern_category, pattern, thinking, mistakes, takeaways, tags, problem_statement, examples, brute_force, brute_force_time_complexity, brute_force_space_complexity, time_complexity, space_complexity)
    VALUES (new.rowid, new.problem_name, new.topic, new.pattern_category, new.pattern, new.thinking, new.mistakes, new.takeaways, new.tags, new.problem_statement, new.examples, new.brute_force, new.brute_force_time_complexity, new.brute_force_space_complexity, new.time_complexity, new.space_complexity);
END;

INSERT INTO problems_fts(problems_fts) VALUES('rebuild');
