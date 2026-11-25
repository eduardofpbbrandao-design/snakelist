#!/usr/bin/env python3
"""Copies the curated opening-photo pool (data/hero-pool.json) into snakelist-synced.html, between the markers
/*HERO_POOL*/ and /*END_HERO_POOL*/, in the same shape as window.SL_HERO_PHOTOS:
  [file, common name, scientific name, its SnakeList page, widths, credit, {pm: phone crop, lg: logo band, lgm: ...}]
The pool is used only by the cinematic opening preview (?opening=cinematic / preview key "cinematic").
Run from the repo root after editing data/hero-pool.json:  python3 tools/hero_pool.py"""
import json, re, sys

POOL = "data/hero-pool.json"
PAGE = "snakelist-synced.html"

pool = json.load(open(POOL, encoding="utf-8"))["photos"]
rows = []
for p in pool:
    o = {"pm": p["crop"]["phone"], "fo": p["focal"]}
    if "logo" in p: o["lg"] = p["logo"]
    if "logoUpright" in p: o["lgm"] = p["logoUpright"]
    rows.append([p["id"], p["name"], p["sci"], p["page"], p["widths"], p["credit"], o])
js = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
src = open(PAGE, encoding="utf-8").read()
new, n = re.subn(r"/\*HERO_POOL\*/.*?/\*END_HERO_POOL\*/", lambda m: "/*HERO_POOL*/" + js + "/*END_HERO_POOL*/", src, count=1, flags=re.S)
if n != 1:
    sys.exit("markers not found in " + PAGE)
if new != src:
    open(PAGE, "w", encoding="utf-8").write(new)
print("hero pool: %d photos" % len(rows))
