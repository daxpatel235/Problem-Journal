# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Tags** — free-form, multi-value tags (e.g. companies like Google/Amazon) on each
  problem, shown in the timeline and editor, with autocomplete suggestions.
- **Tag filtering & search** — filter the timeline by tag, and full-text search now
  matches tags too.
- **Review mode** — resurfaces problems you logged 1 day, 1 week, and 1 month ago.
- **Statistics dashboard** — totals, favorites, difficulty/topic/tag breakdowns, and a
  logging streak.
- **Import** — import problems from an exported JSON file (complements Export).
- **Light theme** — System / Light / Dark, following the OS preference in System mode;
  the code editor matches.
- **Command palette** (`Ctrl+K`) — run actions, switch theme/zoom, and jump to any problem.
- **Autosave toggle** in Settings, plus an explicit **Save** button.

### Fixed

- Edits are no longer lost when saving while typing, switching problems, or closing the
  app (pending changes are flushed on close).
- Removed a duplicate favorite control and tightened alignment in the problem editor.
- Distinct empty states for "no problems yet" vs "no results for filters".
- Visible keyboard focus rings across interactive controls (accessibility).

## [0.1.0]

- Initial version: timeline, structured editor, Monaco code editor, full-text search,
  favorites/trash/duplication, export (Markdown/JSON/PDF), and backups.
