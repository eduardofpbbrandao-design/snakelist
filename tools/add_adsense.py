"""Add the Google AdSense tag to the <head> of every public SnakeList page that doesn't have it yet.

Run by build-site.py after every build (index.html gets the tag from build-site.py's own head).
Skipped: pages that only redirect (no content), the internal design tools, and anything already tagged,
so the tag is never added twice.
"""
import os, re

TAG = ('<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-0736553562389933"\n'
       '     crossorigin="anonymous"></script>\n')
SKIP_FILES = {"index.html", "snakelist-synced.html", "logo-lab.html", "snake-sizer.html", "tick-sizer.html"}
SKIP_DIRS = {".git", ".claude", "node_modules", "christmas", "design", "tests", "scratchpad", "brand", "vendor", "data", "tools"}

def pages():
    for f in sorted(os.listdir(".")):
        if f.endswith(".html") and f not in SKIP_FILES:
            yield f
    for root, dirs, files in os.walk("species"):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f.endswith(".html"):
                yield os.path.join(root, f)

added = 0
for p in pages():
    with open(p, encoding="utf-8") as fh:
        s = fh.read()
    if "adsbygoogle.js" in s or "</head>" not in s or "location.replace(" in s[:2000]:
        continue
    s = s.replace("</head>", TAG + "</head>", 1)
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(s)
    added += 1
print("adsense: tag added to %d page(s)" % added)
