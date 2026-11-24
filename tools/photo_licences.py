#!/usr/bin/env python3
"""Write data/photo-licences.json: every photo SnakeList shows, with its licence and whether it may be used
on a site with ads (commercial use).

    python3 tools/photo_licences.py

Reads the species photos from the #photo-index of snakelist-synced.html and the opening (hero) photos from
window.SL_HERO_PHOTOS. Photos that are not commercial-OK but are kept until their photographer answers are
listed in data/photo-permissions.json ({"<species-id>": {"login": ..., "observation": ..., "why": ...}}),
which docs/PHOTO-PERMISSIONS.md is written from.

Commercial-OK: CC0, public domain, CC BY, CC BY-SA (credit given). Not OK: any NC licence, any ND licence
(SnakeList crops every photo, so it is never used unmodified), all rights reserved, or an unknown licence -
unless the photographer has given SnakeList permission (then "permission": "granted <date>" in
data/photo-permissions.json makes it OK).
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "snakelist-synced.html")
OUT = os.path.join(ROOT, "data", "photo-licences.json")
PERM = os.path.join(ROOT, "data", "photo-permissions.json")


def licence_of(credit):
    m = re.search(r",\s*(CC[^,]*|public domain)\s*$", credit, re.I)
    return m.group(1).strip() if m else ""


def commercial_ok(lic):
    l = lic.upper()
    if not l: return False
    if l.startswith("PUBLIC DOMAIN"): return True
    if not l.startswith("CC"): return False
    return "NC" not in l and "ND" not in l


def author_of(credit):
    lic = licence_of(credit)
    a = credit[: len(credit) - len(lic)].rstrip().rstrip(",").strip() if lic else credit.strip()
    return a


def source_of(url):
    if not url: return "unknown"
    for k, v in (("inaturalist.org", "iNaturalist"), ("wikimedia.org", "Wikimedia Commons"), ("flickr.com", "Flickr"),
                 ("gbif.org", "GBIF"), ("zenodo.org", "Zenodo"), ("doi.org", "journal"), ("mdpi.com", "journal")):
        if k in url: return v
    return "other"


def main():
    app = open(APP, encoding="utf-8").read()
    D = json.loads(re.search(r'<script type="application/json" id="photo-index">(.*?)</script>', app, re.S).group(1))["items"]
    perm = json.load(open(PERM, encoding="utf-8")) if os.path.exists(PERM) else {}
    photos = []
    for sid in sorted(D):
        v = D[sid]
        credit = v[2]
        if credit.startswith("Illustration"): continue
        pid = v[4].split(".")[0] if len(v) > 4 and v[4] else ""
        url = "https://www.inaturalist.org/photos/%s" % pid if pid else (v[5] if len(v) > 5 else "")
        lic = licence_of(credit)
        ok = commercial_ok(lic)
        p = perm.get(sid) or {}
        rec = {"species": sid, "kind": "species", "tile": "species-photos/t/%d-%d.webp" % (v[0], v[1]),
               "source": source_of(url), "url": url, "author": author_of(credit), "licence": lic or "unknown",
               "commercialOK": ok}
        if not ok:
            granted = str(p.get("permission", "")).startswith("granted")
            rec["commercialOK"] = granted
            rec["permission"] = p.get("permission", "needed")
            if p.get("observation"): rec["observation"] = p["observation"]
            if p.get("login"): rec["login"] = p["login"]
        photos.append(rec)
    hero_src, stem = {}, None
    cp = os.path.join(ROOT, "species-photos", "hero", "CREDITS.txt")
    for line in open(cp, encoding="utf-8") if os.path.exists(cp) else []:
        sm = re.match(r"^([a-z-]+)-\{", line)
        if sm: stem = sm.group(1)
        um = re.match(r"^\s*Source:\s*(https?://\S+)", line)
        if um and stem: hero_src[stem] = um.group(1); stem = None
    m = re.search(r"window\.SL_HERO_PHOTOS = (\[.*?\]);\s*\n", app)
    for h in json.loads(m.group(1)) if m else []:
        cr = re.sub(r"^Photo:\s*", "", h[5] or "")
        src = re.search(r"\(([^()]*)\)\s*$", cr)
        cr2 = cr[: src.start()].strip() if src else cr
        lic = licence_of(cr2)
        ok = commercial_ok(lic)
        rec = {"species": h[2].lower().replace(" ", "-"), "kind": "opening", "file": "species-photos/hero/%s-*.webp" % h[0],
               "source": src.group(1) if src else "unknown", "url": hero_src.get(h[0], ""), "author": author_of(cr2) if cr2 else "unknown",
               "licence": lic or "unknown", "commercialOK": ok}
        if not ok: rec["permission"] = (perm.get("hero:" + h[0]) or {}).get("permission", "needed")
        photos.append(rec)
    n_ok = sum(1 for p in photos if p["commercialOK"])
    out = {"about": "Every photo SnakeList shows and whether its licence allows use on a site with ads. "
                    "commercialOK: CC0 / public domain / CC BY / CC BY-SA (with credit), or the photographer's permission. "
                    "Written by tools/photo_licences.py from the photo index; photos still waiting for permission are in "
                    "docs/PHOTO-PERMISSIONS.md.",
           "counts": {"photos": len(photos), "commercialOK": n_ok, "needPermission": len(photos) - n_ok},
           "photos": photos}
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(out["counts"])


if __name__ == "__main__":
    main()
