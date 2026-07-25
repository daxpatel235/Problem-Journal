# Security Policy

## Reporting a vulnerability

Problem Journal is an offline, local-only desktop app — it stores everything in a
local SQLite database and makes no network requests. The most likely security-relevant
issues are around local data handling, file access, or the Tauri/WebView boundary.

If you find a vulnerability, **please do not open a public issue.** Instead:

- Use GitHub's [private vulnerability reporting](https://github.com/daxpatel235/Problem-Journal/security/advisories/new)
  ("Report a vulnerability" under the repo's Security tab), or
- Email the maintainer at the address on their GitHub profile.

Please include steps to reproduce and the affected version. We'll acknowledge your
report as soon as we can and keep you updated on a fix.

## Supported versions

As a pre-1.0 project, only the latest released version receives fixes.
