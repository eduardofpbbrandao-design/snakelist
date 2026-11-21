#!/usr/bin/env python3
"""Apply data/fossil-pbdb.json to the SnakeList app (fossil snakes' ages and find countries).

For every fossil snake in the JSON:
  * "age" [epoch, million years ago] is added to FOSSIL_AGE when the app has no age for it yet
    (an age the app already has, from another source, is never replaced);
  * "countries"/"continents" fill the card's data-countries/data-continents when the card has
    none yet, and its "Range not recorded" tag then names the continents.

Idempotent: running it again changes nothing. Usage:
  python3 tools/fossil_pbdb.py [APP_HTML] [--dry-run]
Then run build-site.py as usual (see CLAUDE.md).
"""
import argparse
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("app", nargs="?", default=os.path.join(ROOT, "snakelist-synced.html"))
    ap.add_argument("--json", default=os.path.join(ROOT, "data", "fossil-pbdb.json"))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    data = {k: v for k, v in json.load(open(a.json, encoding="utf-8")).items() if not k.startswith("_")}
    s = open(a.app, encoding="utf-8").read()
    fossils = set(re.findall(r'"([a-z0-9-]+)"', s.split("// prehistoric snakes known only from fossil bones", 1)[1].split("]", 1)[0]))

    # 1. FOSSIL_AGE
    i = s.index("const FOSSIL_AGE = {") + len("const FOSSIL_AGE = ")
    j = s.index("};", i) + 1
    ages = json.loads(s[i:j])
    n_age = 0
    for k, v in data.items():
        if v.get("age") and k in fossils and k not in ages:
            ages[k] = v["age"]; n_age += 1
    s = s[:i] + json.dumps(ages, ensure_ascii=False, separators=(",", ":")) + s[j:]

    # 2. countries / continents of cards that have none
    n_cc = 0
    for k, v in data.items():
        if not v.get("countries") or k not in fossils: continue
        m = re.search(r'<div class="card" data-id="%s"[^>]*>' % re.escape(k), s)
        if not m: continue
        tag = m.group(0)
        if not re.search(r'data-countries=""', tag): continue
        e = m.end()
        new = tag.replace('data-continents=""', 'data-continents="%s"' % html.escape("|".join(v["continents"]))) \
                 .replace('data-countries=""', 'data-countries="%s"' % html.escape("|".join(v["countries"])))
        rest_end = s.index('<div class="card-bottom">', e)
        body = s[e:rest_end].replace("</svg>Range not recorded</span>", "</svg>%s</span>" % " &middot; ".join(html.escape(c) for c in v["continents"]), 1)
        s = s[:m.start()] + new + body + s[rest_end:]
        n_cc += 1
    print("fossil ages added: %d; cards given countries: %d" % (n_age, n_cc))
    if not a.dry_run:
        open(a.app, "w", encoding="utf-8").write(s)


if __name__ == "__main__":
    main()
