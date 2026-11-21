"""Check every internal link on the website: each href/src in the root pages and in species/ (species,
country, region, city, family and genus pages) must point at a file that exists (query strings and #fragments
are ignored; a #fragment on the same page must match an id there). External links are not fetched.
Run from the repo root:  python3 tools/check_links.py   (prints the broken ones, grouped, and a total)
"""
import glob, os, re, sys, html, collections
from urllib.parse import unquote, urlsplit
ROOT = os.getcwd()
pages = [p for p in glob.glob("*.html") + glob.glob("species/**/*.html", recursive=True) if not p.startswith("index-base")]
ref = re.compile(r'''(?<![\w-])(?:href|src)\s*=\s*["']([^"'<>]+)["']''', re.I)
idre = re.compile(r'''\sid\s*=\s*["']([^"']+)["']''')
bad = collections.defaultdict(list); n = 0
exists = {}
def ok(path):
    if path not in exists: exists[path] = os.path.exists(path)
    return exists[path]
for p in pages:
    t = open(p, encoding="utf-8", errors="replace").read()
    t = re.sub(r"<script\b(?![^>]*\bsrc=)[^>]*>.*?</script>", "", t, flags=re.S | re.I)  # links built by scripts are not static links
    ids = None
    for u in ref.findall(t):
        u = html.unescape(u).strip()
        if re.match(r"^(?:[a-z][a-z0-9+.-]*:|//)", u, re.I) or u.startswith("{") or "'+" in u or "%s" in u: continue
        n += 1
        sp = urlsplit(u)
        if not sp.path:
            if sp.fragment:
                if ids is None: ids = set(idre.findall(t))
                if sp.fragment not in ids: bad[p].append(u)
            continue
        base = ROOT if sp.path.startswith("/") else os.path.dirname(os.path.join(ROOT, p))
        tgt = os.path.normpath(os.path.join(base, unquote(sp.path).lstrip("/")))
        if sp.path.endswith("/"): tgt = os.path.join(tgt, "index.html")
        if not ok(tgt) and not ok(tgt + ".html"): bad[p].append(u)
tot = sum(len(v) for v in bad.values())
targets = collections.Counter(u for v in bad.values() for u in v)
for u, c in targets.most_common(60): print("%5d x %s" % (c, u))
print("pages:", len(pages), " internal links checked:", n, " broken:", tot, "on", len(bad), "pages")
sys.exit(1 if tot else 0)
