# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

## [0.2.1] — 2026-07-27

### Fixed

- **The sort dropdown had no visible effect.** Choosing **Oldest first** left the
  timeline looking exactly the same as **Newest first**, so there was no way to read
  the journal forwards through time.

  _Cause:_ the query did order rows correctly, but `groupProblemsByDate` in
  `src/lib/dateGroups.ts` then bucketed them into date groups and emitted those groups
  in a hardcoded ladder — Today, Yesterday, This Week, This Month, then older months.
  That ladder is newest-first by construction, so it overrode whatever order the rows
  arrived in: only the contents *within* a group followed the chosen sort.

  _Fix:_ the grouping now takes the active sort. **Oldest first** puts the oldest month
  groups at the top and flips the relative labels below them; **Newest first** is
  unchanged. Groups also no longer keep a stale collapsed state when the sort changes,
  and the group at the top of the list is never collapsed by default.

- **Recently updated** grouped by the date a problem was *created*, so a problem
  written months ago and edited today sat far down the list under its original month.
  It now groups by the date it was last updated.

- **Name (A-Z)** was still split into date groups, which broke the alphabetical run
  across headers — a problem starting with "A" logged last month appeared below one
  starting with "Z" logged today. It now renders as a single flat list.

## [0.2.0] — 2026-07-26

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

- **"New" opened the previous problem instead of a blank one.** Clicking **New**
  (or pressing `Ctrl+N`, or using the command palette) appeared to do nothing: the
  editor kept showing the problem you had just been editing, so there was no way to
  start a fresh entry without restarting the app.

  _Cause:_ the "reopen the problem you had open last time" logic in `src/App.tsx` was
  written as a reactive effect that watched `selectedId`, rather than as a one-time
  restore at startup. Starting a new problem sets `selectedId` to `null` (there's no
  saved row yet), which re-triggered that effect; it then compared the remembered
  `lastOpenedProblemId` against `null`, decided they differed, and re-selected the old
  problem — overwriting the blank draft milliseconds after it appeared.

  _Fix:_ the restore now runs at most once per app launch, gated on settings having
  finished loading, and it yields if a problem is already open — so whatever you choose
  during a session stays open. Your last problem is still reopened on the next launch.

- **Deleting the open problem brought it straight back.** Same root cause: moving a
  problem to trash clears the selection, which re-triggered the restore effect and
  reloaded the problem you had just deleted.
- Edits are no longer lost when saving while typing, switching problems, or closing the
  app (pending changes are flushed on close).
- Removed a duplicate favorite control and tightened alignment in the problem editor.
- Distinct empty states for "no problems yet" vs "no results for filters".
- Visible keyboard focus rings across interactive controls (accessibility).

## [0.1.0]

- Initial version: timeline, structured editor, Monaco code editor, full-text search,
  favorites/trash/duplication, export (Markdown/JSON/PDF), and backups.

[Unreleased]: https://github.com/daxpatel235/Problem-Journal/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/daxpatel235/Problem-Journal/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/daxpatel235/Problem-Journal/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/daxpatel235/Problem-Journal/releases/tag/v0.1.0
