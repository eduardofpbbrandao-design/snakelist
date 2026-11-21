"""Fetch, once, what Wikidata knows about every SnakeList species (by scientific name):
how many Wikipedia language editions have an article on it (sitelinks), whether English
Wikipedia has one, and its English and Chinese labels. Writes data/wikidata-species.json.
Used by tools/build_fame.py (the "how famous is this snake" score) and the Chinese-name
translations. Run:  python3 tools/wikidata_fame.py
"""
import json, re, time, urllib.request, urllib.parse
app = open("snakelist-synced.html", encoding="utf-8").read()
cards = []
for cid, body in re.findall(r'<div class="card" data-id="([^"]+)"[^>]*>(.{0,900})', app):
    m = re.search(r'<div class="card-name is-sci">([^<]+)</div>', body) or re.search(r'<div class="card-sci">([^<]+)</div>', body)
    if m: cards.append((cid, m.group(1)))
names = {}
for cid, sci in cards: names.setdefault(sci.strip(), []).append(cid)
out = {}
try: out = json.load(open("data/wikidata-species.json"))
except Exception: pass
todo = [n for n in names if not any(c in out for c in names[n])]
Q = """SELECT ?n ?item ?sl ?en ?enwiki ?zh WHERE { VALUES ?n { %s } ?item wdt:P225 ?n; wikibase:sitelinks ?sl.
 OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en)="en") }
 OPTIONAL { ?w schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?enwiki }
 OPTIONAL { ?item rdfs:label ?zh FILTER(lang(?zh)="zh") } }"""
for i in range(0, len(todo), 250):
    chunk = todo[i:i + 250]
    q = Q % " ".join(json.dumps(n) for n in chunk)
    req = urllib.request.Request("https://query.wikidata.org/sparql", data=urllib.parse.urlencode({"query": q}).encode(),
        headers={"Accept": "application/sparql-results+json", "User-Agent": "SnakeListDataBuild/1.0"})
    for t in range(4):
        try: res = json.load(urllib.request.urlopen(req, timeout=90)); break
        except Exception as e: print("retry", e); time.sleep(5 * (t + 1))
    else: continue
    for b in res["results"]["bindings"]:
        n = b["n"]["value"]; sl = int(b["sl"]["value"])
        for cid in names.get(n, []):
            cur = out.get(cid)
            if cur and cur["sl"] >= sl: continue
            out[cid] = {"q": b["item"]["value"].rsplit("/", 1)[1], "sl": sl, "en": b.get("en", {}).get("value", ""),
                        "enwiki": b.get("enwiki", {}).get("value", ""), "zh": b.get("zh", {}).get("value", "")}
    print(i + len(chunk), "/", len(todo), len(out)); time.sleep(1)
json.dump(out, open("data/wikidata-species.json", "w"), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
print("species with a Wikidata item:", len(out), "of", len(cards))
