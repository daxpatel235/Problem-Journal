# Problem Journal

**Every problem. Every pattern. Every insight.**

A personal, offline, developer-grade desktop app for recording DSA problem-solving sessions — built with [Tauri 2](https://tauri.app/), Rust, React 19, and SQLite. Open it, log what you just solved (problem details, pattern, thinking, mistakes, takeaways, code), and close it. No accounts, no sync, no SaaS — just a fast, local knowledge base built for long-term recall.

## Why

Most people solve hundreds of DSA problems while prepping for interviews and remember almost none of the *reasoning* six months later. Problem Journal isn't a note-taking app or an IDE — it's a structured, VS Code-styled logbook purpose-built for one thing: capturing what you learned from a problem while it's still fresh, and making it instantly searchable later.

## Features

- **Timeline** — every problem you've logged, grouped by Today / Yesterday / This Week / This Month / older, with quick filters (favorites, difficulty, date range) and instant search.
- **Structured editor** — problem name, difficulty, topic, platform, URL, pattern category, and four dynamic, reorderable lists: Pattern, Thinking, Mistakes, Takeaways.
- **Code editor** — full Monaco editor (VS Code's own editor) with a language picker, syntax highlighting, and a dark theme that matches the rest of the app.
- **Autosave** — every edit is saved automatically ~2.5s after you stop typing, with a live "Saving… / Saved" indicator. `Ctrl+S` saves immediately.
- **Full-text search** — SQLite FTS5-backed search across problem name, topic, pattern category, and every entry you've written.
- **Favorites, trash, and duplication** — soft-delete with restore, one-click duplicate for near-identical problems, star your favorites.
- **Export** — per-problem Markdown, JSON, or print-to-PDF; bulk JSON export of your whole journal.
- **Backups** — manual or automatic backups on app close, with configurable retention and one-click restore.
- **Keyboard-first** — `Ctrl+N` new problem, `Ctrl+F` search, `Ctrl+D` duplicate, `Delete` to trash, `Ctrl +/-/0` to zoom.
- **Offline-first** — everything lives in a local SQLite database (`~/.problem-journal/`). Nothing leaves your machine.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop runtime | Tauri 2 |
| Backend | Rust + SQLx (SQLite, FTS5) |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Code editor | Monaco Editor |
| State | Zustand |
| Fonts | Inter (UI) + JetBrains Mono (code) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- On Windows: [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (preinstalled on modern Windows) and the Visual Studio C++ build tools
- [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS

### Development

```bash
npm install
npm run tauri dev
```

### Building

```bash
npm run tauri build
```

On Windows this produces both an NSIS installer (`.exe`) and a WiX installer (`.msi`) under `src-tauri/target/release/bundle/`.

## Where your data lives

Problem Journal stores everything locally in a single SQLite file:

```
~/.problem-journal/problem_journal.db
```

Backups are written to `~/.problem-journal/backups/` by default (configurable in Settings).

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+N` | New problem |
| `Ctrl+S` | Save |
| `Ctrl+F` | Search |
| `Ctrl+D` | Duplicate problem |
| `Delete` | Move to trash |
| `Ctrl +` / `Ctrl -` / `Ctrl 0` | Zoom in / out / reset |

## License

MIT — see [LICENSE](./LICENSE).
