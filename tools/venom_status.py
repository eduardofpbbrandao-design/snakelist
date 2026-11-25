#!/usr/bin/env python3
"""Write data/venom-status.json into the app's species cards, so every place that says whether a snake is
venomous agrees (the cards are what the app's filters, tags, quick look, quiz and map read, and what
build_species.py / build_regions.py build the species, genus, family, country and region pages from).

  python3 tools/venom_status.py            apply it (prints what changed)
  python3 tools/venom_status.py --check    change nothing; exit 1 if a card disagrees with the file

For each card whose genus or family is listed with status "mild" (rear-fanged, venomous, low risk to people):
  * data-venomous becomes "1",
  * the red <span class="tag venom">Venomous</span> tag is added after its other tags (as on every venomous card).
Whether a venomous snake is dangerous to people stays in the app's #harm-data (Venomous vs Mildly venomous).
"family_fixes" corrects a card's family (its data-family and its family tag).
"""
import argparse
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAG = '<span class="tag venom">Venomous</span>'


def load(path=None):
    return json.load(open(path or os.path.join(ROOT, "data", "venom-status.json"), encoding="utf-8"))


def wanted(cid, family, vs):
    """'mild' when data/venom-status.json lists the card's genus or family, else None (the card's own flag stands)"""
    genus = cid.split("-")[0].capitalize()
    for k, d in ((genus, vs.get("genera", {})), (family, vs.get("families", {}))):
        if k in d: return d[k]["status"]
    return None


def apply(s, vs, log=None):
    fixes = vs.get("family_fixes", {})
    changed = {"venom": [], "family": []}

    def one(m):
        line = m.group(0)
        cid = re.search(r' data-id="([^"]+)"', line).group(1)
        if cid in fixes:
            fam_new = fixes[cid]
            fm = re.search(r' data-family="([^"]*)"', line)
            fam_old = fm.group(1) if fm else ""
            if fam_old != fam_new:
                line = line.replace(' data-family="%s"' % fam_old, ' data-family="%s"' % fam_new, 1)
                line = line.replace('<span class="tag">%s</span>' % fam_old, '<span class="tag">%s</span>' % fam_new, 1)
                changed["family"].append(cid)
        fam = (re.search(r' data-family="([^"]*)"', line) or [None, ""])[1]
        if wanted(cid, fam, vs) and ' data-venomous="0"' in line:
            line = line.replace(' data-venomous="0"', ' data-venomous="1"', 1)
            tm = re.search(r'<div class="card-tags">((?:(?!</div>).)*)</div>', line)
            if tm and TAG not in tm.group(1):
                line = line[:tm.end(1)] + TAG + line[tm.end(1):]
            changed["venom"].append(cid)
        return line

    out = re.sub(r'<div class="card" data-id="[^"]+"[^\n]*', one, s)
    return out, changed


def mismatches(s, vs):
    """cards that disagree with the file: [(id, what)]"""
    bad = []
    for m in re.finditer(r'<div class="card" data-id="([^"]+)"[^\n]*', s):
        line, cid = m.group(0), m.group(1)
        fam = (re.search(r' data-family="([^"]*)"', line) or [None, ""])[1]
        ven = ' data-venomous="1"' in line
        tags = re.search(r'<div class="card-tags">((?:(?!</div>).)*)</div>', line)
        if wanted(cid, fam, vs) and not ven: bad.append((cid, "should be venomous (%s)" % fam))
        if tags and ven != (TAG in tags.group(1)): bad.append((cid, "Venomous tag does not match data-venomous"))
        if cid in vs.get("family_fixes", {}) and fam != vs["family_fixes"][cid]: bad.append((cid, "family should be " + vs["family_fixes"][cid]))
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", default=os.path.join(ROOT, "snakelist-synced.html"))
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    vs = load()
    s = open(a.app, encoding="utf-8").read()
    if a.check:
        bad = mismatches(s, vs)
        for cid, w in bad: print("%s: %s" % (cid, w))
        print("%d card(s) disagree with data/venom-status.json" % len(bad))
        raise SystemExit(1 if bad else 0)
    out, ch = apply(s, vs)
    by = {}
    for cid in ch["venom"]: by.setdefault(cid.split("-")[0], []).append(cid)
    for g in sorted(by): print("venomous now: %-18s %d" % (g, len(by[g])))
    print("%d card(s) made venomous, %d family fix(es)" % (len(ch["venom"]), len(ch["family"])))
    if out != s: open(a.app, "w", encoding="utf-8").write(out)


if __name__ == "__main__":
    main()
