"""Give every public SnakeList page the cookie and ad consent script (sl-consent.js), which loads Google AdSense.

Run by build-site.py after every build (index.html gets the same script inside its own head from build-site.py).
sl-consent.js sets Google Consent Mode v2 to "denied" first and only then loads the AdSense script (outside Europe
only after the visitor has answered the cookie question) - so pages must NOT carry the plain AdSense tag any more:
an old plain tag is replaced. Skipped: pages that only redirect (no content), the internal design tools.
The ?v= tag changes with the script's contents, so browsers fetch a new copy when it changes.
"""
import hashlib, os, re

VER = hashlib.sha1(open("sl-consent.js", "rb").read()).hexdigest()[:10]
OLD = re.compile(r'<script async src="https://pagead2\.googlesyndication\.com/pagead/js/adsbygoogle\.js\?client=ca-pub-\d+"\s*crossorigin="anonymous"></script>\n?')
NEW = re.compile(r'<script src="[./]*sl-consent\.js(?:\?v=[0-9a-f]*)?"[^>]*></script>\n?')
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

changed = 0
for p in pages():
    with open(p, encoding="utf-8") as fh:
        s = fh.read()
    if "</head>" not in s or "location.replace(" in s[:2000]:
        continue
    rel = "../" * p.count(os.sep)
    tag = '<script src="%ssl-consent.js?v=%s" data-root="%s" defer></script>\n' % (rel, VER, rel)
    t = OLD.sub("", s)
    t = NEW.sub("", t)
    t = t.replace("</head>", tag + "</head>", 1)
    if t != s:
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(t)
        changed += 1
print("consent/ads script: updated on %d page(s)" % changed)
