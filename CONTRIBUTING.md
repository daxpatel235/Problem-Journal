# Contributing to Problem Journal

Thanks for your interest in improving Problem Journal! This is a small, offline-first
desktop app, and contributions of all sizes are welcome — bug reports, docs, and code.

## Ground rules

- Be respectful. This project follows the [Code of Conduct](./CODE_OF_CONDUCT.md).
- Open an issue before starting significant work, so we can align on the approach.
- Keep the app **offline-first**: no telemetry, no network calls, no accounts.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (CI uses 20)
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS
  (on Linux, the WebKitGTK/AppIndicator dev packages; on Windows, WebView2 + MSVC build tools)

## Getting started

```bash
npm install
npm run tauri dev
```

The database lives at `~/.problem-journal/problem_journal.db`. Delete that file to
start from a clean slate (your changes to schema migrations will re-run on next launch).

## Project layout

- `src/` — React + TypeScript frontend (Zustand stores, Tailwind + shadcn/ui, Monaco editor)
- `src-tauri/` — Rust backend (Tauri commands → repositories → SQLite via SQLx)
- `src-tauri/src/database/migrations/` — ordered SQL migrations (never edit an applied one; add a new file)

## Before you open a PR

Run the same checks CI runs:

```bash
npm run build      # type-check + bundle
npm run lint       # ESLint
npm run format     # Prettier (auto-format)

cd src-tauri
cargo fmt          # format Rust (recommended)
cargo clippy --all-targets -- -D warnings
```

Then **run the app** and manually verify your change — there is no end-to-end test
harness yet, so manual verification matters.

## Commit & PR guidelines

- Write clear commit messages describing the "why".
- One logical change per PR where possible.
- For UI changes, include before/after screenshots in the PR.
- Update `CHANGELOG.md` under "Unreleased" for user-facing changes.

## Releasing (maintainers)

Push a version tag and the [release workflow](./.github/workflows/release.yml) builds
and drafts a GitHub Release with installers for Windows, macOS, and Linux:

```bash
git tag v0.2.0
git push origin v0.2.0
```
