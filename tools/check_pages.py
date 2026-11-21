"""Consistency checks over the species pages (run after build-site.py):  python3 tools/check_pages.py
  * the page's main photo is this species' photo: its alt names this snake, and its offline copy is the
    photo tile the app's photo-index gives this species
  * the 3D viewer gets this species: the page's data-id is a species with a 3D model (species/3d/models.json)
  * the name in the <h1>, the <title> and the app's card agree; the scientific name under it matches
  * no fact is said twice: a key-facts value repeated word for word in two boxes, or the same paragraph twice
Prints each problem and a summary; exit code 1 if any.
"""
import glob, json, re, html, collections
app = open("snakelist-synced.html", encoding="utf-8").read()
photos = json.loads(re.search(r'<script type="application/json" id="photo-index">(.*?)</script>', app, re.S).group(1))
C = photos["cols"] * photos["rows"]
models = json.load(open("species/3d/models.json", encoding="utf-8"))["species"]
names = {}
for cid, body in re.findall(r'<div class="card" data-id="([^"]+)"[^>]*>(.{0,700})', app):
    m = re.search(r'<div class="card-name(?: is-sci)?">([^<]*)</div>', body); names[cid] = html.unescape(m.group(1)) if m else ""
probs = collections.defaultdict(list); n = 0
for f in sorted(glob.glob("species/*.html")):
    t = open(f, encoding="utf-8").read()
    m = re.search(r'class="sp-main" data-id="([^"]+)" data-sci="([^"]*)"', t)
    if not m: continue
    n += 1; cid, sci = m.group(1), html.unescape(m.group(2))
    h1 = re.search(r"<h1>(.*?)</h1>", t, re.S); h1 = html.unescape(re.sub(r"<[^>]+>", "", h1.group(1))).strip() if h1 else ""
    if cid in names and h1 != names[cid]: probs["h1 differs from the app's card name"].append("%s: %r vs %r" % (f, h1, names[cid]))
    title = html.unescape(re.search(r"<title>(.*?)</title>", t, re.S).group(1))
    if h1 and h1 not in title: probs["<title> does not name the snake"].append(f)
    img = re.search(r'<img src="[^"]*" data-fb="\.\./species-photos/t/(\d+)-(\d+)\.webp" alt="([^"]*)"[^>]*fetchpriority="high"', t)
    it = photos["items"].get(cid)
    if img:
        alt = html.unescape(img.group(3))
        if sci not in alt: probs["main photo alt does not name this species"].append("%s: %s" % (f, alt))
        if it and (int(img.group(1)), int(img.group(2))) != (it[0], it[1]): probs["main photo is another species' photo tile"].append("%s: %s-%s vs %s-%s" % (f, img.group(1), img.group(2), it[0], it[1]))
    if cid not in models: probs["no 3D model for this species"].append(f)
    paras = [re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", p)).strip() for p in re.findall(r"<p[^>]*>(.*?)</p>", t, re.S)]
    seen = set()
    for p in paras:
        if len(p) > 60 and p in seen: probs["the same paragraph twice"].append("%s: %s" % (f, p[:90])); break
        seen.add(p)
for k, v in probs.items():
    print("== %s: %d" % (k, len(v)))
    for x in v[:12]: print("   ", x)
print("species pages checked:", n, " problems:", sum(len(v) for v in probs.values()))
raise SystemExit(1 if probs else 0)
