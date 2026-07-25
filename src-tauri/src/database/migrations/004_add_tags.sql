-- User-defined tags (e.g. companies like Google, Amazon), stored as a JSON array
-- string to match how pattern/thinking/mistakes/takeaways are persisted.
ALTER TABLE problems ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
