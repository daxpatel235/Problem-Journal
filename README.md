# Problem Journal

**Every problem. Every pattern. Every insight.**

[![CI](https://github.com/daxpatel235/Problem-Journal/actions/workflows/ci.yml/badge.svg)](https://github.com/daxpatel235/Problem-Journal/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/daxpatel235/Problem-Journal?include_prereleases)](https://github.com/daxpatel235/Problem-Journal/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

A personal, offline, developer-grade desktop app for recording DSA problem-solving sessions — built with [Tauri 2](https://tauri.app/), Rust, React 19, and SQLite. Open it, log what you just solved (problem details, pattern, thinking, mistakes, takeaways, code), and close it. No accounts, no sync, no SaaS — just a fast, local knowledge base built for long-term recall.

> 🔒 **100% offline.** No accounts, no sync, no telemetry — your data never leaves your machine.

## Download

Grab the installer for your OS from the [**latest release**](https://github.com/daxpatel235/Problem-Journal/releases/latest):

| Platform | File to download |
| --- | --- |
| Windows 10 / 11 (x64) | `…_x64-setup.exe` or `…_x64_en-US.msi` |
| Windows 11 on ARM | `…_arm64-setup.exe` |
| macOS, Apple Silicon (M1 to M4) | `…_aarch64.dmg` |
| macOS, Intel | `…_x64.dmg` |
| Linux x64 | `…_amd64.AppImage`, `…_amd64.deb` or `…x86_64.rpm` |
| Linux ARM64 | `…_aarch64.AppImage`, `…_arm64.deb` or `…aarch64.rpm` |

Not sure which Mac you have? Apple menu → **About This Mac**: "Chip: Apple M…" means
Apple Silicon; "Processor: Intel…" means Intel.

> ⚠️ **Before you install — please read.** These installers are **not code-signed**
> (a signing certificate costs money; this is a free, open-source project). Because of
> that, Windows and macOS will show a one-time **"unknown publisher"** warning that you
> have to **allow** manually. The warning does **not** mean the app is unsafe — it only
> means the file isn't signed. Follow the steps for your OS below to allow it.

### Installing past the "unknown publisher" warning

**Windows (SmartScreen):**

1. Double-click `Problem.Journal_0.4.1_x64-setup.exe` (or the `.msi` installer; on an ARM
   PC use `Problem.Journal_0.4.1_arm64-setup.exe`).
2. On the blue "Windows protected your PC" dialog, click **More info**.
3. Click the **Run anyway** button that appears, then continue the installer.

**macOS (Gatekeeper):**

1. Open the `.dmg` and drag the app to Applications.
2. Double-click the app once. macOS says it can't verify the developer; click **Done**
   (or **Cancel**).
3. Open **System Settings → Privacy & Security**, scroll down to the message about
   Problem Journal, and click **Open Anyway**, then confirm. You only do this once.
   (On macOS 14 and older you can instead **right-click** the app → **Open** → **Open**.)

If macOS ever says the app "is damaged", run this once in Terminal, then open it again:

```bash
xattr -dr com.apple.quarantine "/Applications/Problem Journal.app"
```

**Linux:**

- **`.deb`** (Debian / Ubuntu) — install with `sudo apt install ./Problem.Journal_0.4.1_amd64.deb` (no warning).
- **`.rpm`** (Fedora / RHEL / openSUSE) — install with `sudo dnf install ./Problem.Journal-0.4.1-1.x86_64.rpm`.
- **`.AppImage`** — mark it executable first, then run it:
  ```bash
  chmod +x Problem.Journal_0.4.1_amd64.AppImage
  ./Problem.Journal_0.4.1_amd64.AppImage
  ```
- On an ARM64 machine, use the files marked `arm64` / `aarch64` instead.

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
- **Folders** — a file-explorer view to organize problems into folders you name yourself (e.g. Arrays › Sliding Window). Nest folders, rename/move/delete them, add existing problems in bulk (a problem can be in several folders), and open any problem full screen with a back arrow to return.
- **Structured editor** — problem name, difficulty, topic, platform, URL, pattern category, and four dynamic, reorderable lists: Pattern, Thinking, Mistakes, Takeaways.
- **Code editor** — full Monaco editor (VS Code's own editor) with a language picker, syntax highlighting, and a dark theme that matches the rest of the app. A full-screen button next to the language picker gives you the whole window for long solutions; **← Back to problem** or `Esc` returns.
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

- [Node.js](https://nodejs.org/) 20.19+ or 22.12+ (required by Vite 7)
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

On Windows, run `npm run tauri build -- --bundles msi` to produce the `.msi` installer under `src-tauri/target/release/bundle/msi/`.

### Releasing

Installers for every platform are built by GitHub Actions
([`.github/workflows/release.yml`](.github/workflows/release.yml)):

| Runner | Target | Output |
| --- | --- | --- |
| `macos-latest` | `aarch64-apple-darwin` | Apple Silicon `.dmg` |
| `macos-latest` | `x86_64-apple-darwin` | Intel `.dmg` |
| `windows-latest` | `x86_64-pc-windows-msvc` | `.exe` (NSIS) + `.msi` |
| `windows-latest` | `aarch64-pc-windows-msvc` | ARM64 `.exe` (NSIS) |
| `ubuntu-22.04` | `x86_64-unknown-linux-gnu` | `.AppImage`, `.deb`, `.rpm` |
| `ubuntu-22.04-arm` | `aarch64-unknown-linux-gnu` | `.AppImage`, `.deb`, `.rpm` |

To publish a release:

1. Bump the version in `package.json`, `src-tauri/tauri.conf.json` and
   `src-tauri/Cargo.toml` (they must match), and run `npm install` once so
   `package-lock.json` follows.
2. Add `release-notes/vX.Y.Z.md` (used as the release description) and a CHANGELOG entry.
3. Commit, then tag and push:
   ```bash
   git tag v0.4.1
   git push origin main v0.4.1
   ```

The workflow refuses to build if the tag and the version numbers disagree, builds all
six targets in parallel into a draft release, and publishes it only once every
installer has uploaded. To try a build without releasing, open **Actions → Release →
Run workflow**; the installers are attached to that run as downloadable artifacts.

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
| `Alt+←` / `Backspace` | Back (in Folders) |
| `Delete` | Move to trash |
| `Ctrl +` / `Ctrl -` / `Ctrl 0` | Zoom in / out / reset |
| `Esc` | Leave full-screen code editor |

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and the
dev workflow, and please follow the [Code of Conduct](./CODE_OF_CONDUCT.md). Found a
security issue? See [SECURITY.md](./SECURITY.md). Notable changes are tracked in the
[CHANGELOG](./CHANGELOG.md).

## License

MIT — see [LICENSE](./LICENSE).
