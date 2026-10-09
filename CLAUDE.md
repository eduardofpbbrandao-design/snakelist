# SnakeList project instructions

- **Canonical file:** `snakelist-synced.html` is the live app. `index.html` is the public website (GitHub Pages), generated from it by `python3 build-site.py` (adds doctype, meta tags, robots.txt, sitemap.xml) — after every change run it and commit both. Never edit `index.html` by hand.
- **Versioning:** bump the version shown in `.sl-ver` by +0.01 for every requested change, however small.
- **Website:** the site is https://snakelist.com (GitHub Pages from `main` root, `CNAME` file; domain registered at GoDaddy); `species-photos/` must stay next to `index.html`. Also republish the claude.ai artifact.
- **Git:** this repo is connected to `github.com/eduardofpbbrandao-design/snakelist`. Commit and push `snakelist-synced.html` (and any other changed tracked files) to `main` automatically at the end of each work session, or after finishing a meaningful set of changes — don't wait to be asked. Use a short commit message summarizing what changed. Still never force-push, and still ask before any destructive git operation.
