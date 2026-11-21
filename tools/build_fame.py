"""How famous is each snake? A score from 0 (almost nobody has heard of it) to 999 (everyone
knows it), written into the app as <script type="application/json" id="fame-data">{id: score}</script>.
Used by the first-visit "How well do you know snakes?" choice to order the checklist: famous
snakes first for beginners, a mix in the middle, little-known ones first for experts.

The raw fame of a species is a weighted sum of signals that already exist or are fetched once:
  * Wikipedia: in how many language editions it has an article (Wikidata sitelinks, from
    tools/wikidata_fame.py)                                            weight 0.45 (log scale)
  * how often people photograph it: the number of ~10 km squares with a confirmed
    iNaturalist sighting (the app's rarity-data)                       weight 0.25 (log scale)
  * has an English Wikipedia article                                   +0.05
  * has a real photo in SnakeList (not a fossil drawing)               +0.05
  * has a hand-checked SnakeList species profile (data/species-info)   +0.05
  * the hand list of famous snakes everybody knows (the app's data-popular, used by the
    quiz's Easy level)                                                 +0.60
  * the quiz's second tier of well-known snakes (QUIZ_KNOWN, Medium)   +0.25
  * fossil-only species                                                -0.30 (never "famous first")
The raw values are then turned into a rank (percentile x 1000), so the score says where a snake
stands among all of SnakeList's species. Run after wikidata_fame.py:  python3 tools/build_fame.py
"""
import json, math, os, re
APP = "snakelist-synced.html"
app = open(APP, encoding="utf-8").read()
wd = json.load(open("data/wikidata-species.json", encoding="utf-8"))
jget = lambda i: json.loads(re.search(r'<script type="application/json" id="%s">(.*?)</script>' % i, app, re.S).group(1))
rar = jget("rarity-data"); photos = jget("photo-index")["items"]
known = set(json.loads(re.search(r"const QUIZ_KNOWN = new Set\((\[.*?\])\)", app).group(1)))
fossils = set(re.findall(r'"([a-z0-9-]+)"', app.split("// prehistoric snakes known only from fossil bones", 1)[1].split("]", 1)[0]))
rich = {f[:-5] for f in os.listdir("data/species-info") if f.endswith(".json")}
cards = re.findall(r'<div class="card" data-id="([^"]+)"([^>]*)>', app)
mx_sl = math.log1p(max(v.get("sl", 0) for v in wd.values()))
mx_sp = math.log1p(max(rar.values()))
raw = {}
for cid, attrs in cards:
    d = wd.get(cid, {})
    v = 0.45 * math.log1p(d.get("sl", 0)) / mx_sl + 0.25 * math.log1p(rar.get(cid, 0)) / mx_sp
    v += 0.05 * bool(d.get("enwiki")) + 0.05 * bool(cid in photos and "Illustration" not in photos[cid][2]) + 0.05 * (cid in rich)
    if 'data-popular="1"' in attrs: v += 0.60
    elif cid in known: v += 0.25
    if cid in fossils: v -= 0.30
    raw[cid] = v
order = sorted(raw, key=lambda c: raw[c])
n = len(order)
score = {c: int(999 * i / max(1, n - 1)) for i, c in enumerate(order)}
blob = json.dumps(score, separators=(",", ":"), sort_keys=True)
tag = '<script type="application/json" id="fame-data">%s</script>' % blob
if 'id="fame-data"' in app:
    app = re.sub(r'<script type="application/json" id="fame-data">.*?</script>', lambda m: tag, app, count=1, flags=re.S)
else:
    app = app.replace('<script type="application/json" id="rarity-data">', tag + '\n<script type="application/json" id="rarity-data">', 1)
open(APP, "w", encoding="utf-8").write(app)
top = sorted(score, key=lambda c: -score[c])
print("top 25:", ", ".join(top[:25]))
print("bottom 10:", ", ".join(top[-10:]))
print(len(score), "species scored;", len(blob) // 1024, "KB")
