# SnakeList project instructions

- **Canonical file:** `snakelist-synced.html` is the live app. `index.html` is an exact copy of it that serves as the public website (GitHub Pages) — after every change run `cp snakelist-synced.html index.html` and commit both.
- **Versioning:** bump the version shown in `.sl-ver` by +0.01 for every requested change, however small.
- **Website:** the site is GitHub Pages from `main` (root); `species-photos/` must stay next to `index.html`. Also republish the claude.ai artifact.
- **Git:** this repo is connected to `github.com/eduardofpbbrandao-design/snakelist`. Commit and push `snakelist-synced.html` (and any other changed tracked files) to `main` automatically at the end of each work session, or after finishing a meaningful set of changes — don't wait to be asked. Use a short commit message summarizing what changed. Still never force-push, and still ask before any destructive git operation.
