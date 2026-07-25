# Problem Journal

**Every problem. Every pattern. Every insight.**

[![CI](https://github.com/daxpatel235/Problem-Journal/actions/workflows/ci.yml/badge.svg)](https://github.com/daxpatel235/Problem-Journal/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/daxpatel235/Problem-Journal?include_prereleases)](https://github.com/daxpatel235/Problem-Journal/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

A personal, offline, developer-grade desktop app for recording DSA problem-solving sessions — built with [Tauri 2](https://tauri.app/), Rust, React 19, and SQLite. Open it, log what you just solved (problem details, pattern, thinking, mistakes, takeaways, code), and close it. No accounts, no sync, no SaaS — just a fast, local knowledge base built for long-term recall.

> 🔒 **100% offline.** No accounts, no sync, no telemetry — your data never leaves your machine.

## Download

Grab the installer for your OS from the [**latest release**](https://github.com/daxpatel235/Problem-Journal/releases/latest):

- **Windows** — `.exe` (NSIS) or `.msi`
- **macOS** — `.dmg`
- **Linux** — `.AppImage` or `.deb`

> ⚠️ **Before you install — please read.** These installers are **not code-signed**
> (a signing certificate costs money; this is a free, open-source project). Because of
> that, Windows and macOS will show a one-time **"unknown publisher"** warning that you
> have to **allow** manually. The warning does **not** mean the app is unsafe — it only
> means the file isn't signed. Follow the steps for your OS below to allow it.

### Installing past the "unknown publisher" warning

**Windows (SmartScreen):**

1. Double-click `Problem.Journal_0.1.0_x64-setup.exe`.
2. On the blue "Windows protected your PC" dialog, click **More info**.
3. Click the **Run anyway** button that appears, then continue the installer.

**macOS (Gatekeeper):**

1. Open the `.dmg` and drag the app to Applications.
2. **Right-click** (or Control-click) the app → **Open** → **Open** again on the prompt.
   (Doing it this way once tells macOS to trust it; normal double-click works afterward.)

**Linux:**

- **`.deb`** — install with `sudo dpkg -i Problem.Journal_0.1.0_amd64.deb` (no warning).
- **`.AppImage`** — mark it executable first, then run it:
  ```bash
  chmod +x Problem.Journal_0.1.0_amd64.AppImage
  ./Problem.Journal_0.1.0_amd64.AppImage
  ```

### Why you can trust it

- **It's fully open source** — every line that goes into these installers is in this repo.
- **The installers are built by GitHub Actions** directly from the tagged source
  ([release workflow](.github/workflows/release.yml)), not uploaded by hand — so the
  binary matches the public code.
- **Prefer zero trust in prebuilt binaries?** Build it yourself from source — see
  [Development](#development). It's the same result.

The "unknown publisher" warning only means the file isn't signed with a paid certificate;
it is **not** a detection that the app is harmful.

## Screenshots

> _Screenshots coming soon._ Add images under [`docs/`](./docs) and reference them here,
> e.g. `![Main window](docs/screenshot-main.png)`.

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

### Troubleshooting: app closes immediately on launch

If you ran a **pre-release/dev build** in the past, you may have an older database whose
schema no longer matches this version, which causes the app to close on startup. Fix it by
moving the old database aside (a fresh one is created automatically):

```bash
# Windows (PowerShell)
Rename-Item "$HOME\.problem-journal\problem_journal.db" "problem_journal.db.bak"

# macOS / Linux
mv ~/.problem-journal/problem_journal.db ~/.problem-journal/problem_journal.db.bak
```

This does **not** affect fresh installs — new users never hit it.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+N` | New problem |
| `Ctrl+S` | Save |
| `Ctrl+K` | Command palette |
| `Ctrl+F` | Search |
| `Ctrl+D` | Duplicate problem |
| `Delete` | Move to trash |
| `Ctrl +` / `Ctrl -` / `Ctrl 0` | Zoom in / out / reset |

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and the
dev workflow, and please follow the [Code of Conduct](./CODE_OF_CONDUCT.md). Found a
security issue? See [SECURITY.md](./SECURITY.md). Notable changes are tracked in the
[CHANGELOG](./CHANGELOG.md).

## License

MIT — see [LICENSE](./LICENSE).
