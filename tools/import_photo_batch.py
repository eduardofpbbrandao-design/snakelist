#!/usr/bin/env python3
"""Add or replace species photos from a photo-audit batch (a folder with photo_changes.csv).

    python3 tools/import_photo_batch.py BATCH_DIR [--crops crops.json] [--skip "Genus species,..."] [--dry-run]

photo_changes.csv columns: scientific_name, action (add|replace), file, width, height, credit,
license, license_url, source, reason.

For every row this:
  * finds the species' card by its scientific name (genus-species, lower case)
  * crops away printed names / watermarks (crops.json: {"Genus species": [x0, y0, x1, y1]} as
    fractions of the photo) and cuts the photo to SnakeList's 540x360 tile (never stretched)
  * writes species-photos/t/<sheet>-<n>.webp and the same tile into the sheet species-photos/p<sheet>.jpg
  * stores the credit, licence and source in the app's #photo-index:
      [sheet, n, "Photographer, LICENCE", band, "<inat photo id>.<ext>"]          (an iNaturalist photo)
      [sheet, n, "Photographer, LICENCE", band, "", "<source url>"]               (any other source)
  * a replacement keeps the species' photo slot; an addition takes a free slot
  * a cropped photo is added to the "cleaned" list, so SnakeList always shows its own copy (without the
    printed name), never the original
Then run python3 build-site.py to rebuild the pages.
"""
import csv, json, os, re, subprocess, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "snakelist-synced.html")
BUILD_SP = os.path.join(ROOT, "build_species.py")
TW, TH = 540, 360
LIC = {"cc-by": "CC BY", "cc-by-nc": "CC BY-NC", "cc-by-sa": "CC BY-SA", "cc-by-nc-sa": "CC BY-NC-SA", "cc0": "CC0",
       "cc-by-nd": "CC BY-ND", "cc-by-nc-nd": "CC BY-NC-ND"}


def who_of(credit):
    c = credit.strip()
    m = re.match(r"^\(c\)\s*(.*?),\s*(some|all) rights reserved", c, re.I)
    if m: return m.group(1).strip()
    c = re.sub(r"^\(c\)\s*", "", c)
    c = re.sub(r",?\s*uploaded by .*$", "", c)
    return re.sub(r"\s*\([^)]*(CC|licen|observer|public domain)[^)]*\)\s*$", "", c, flags=re.I).strip()  # "Name (iNaturalist observer, CC0)" -> "Name"


def licence(code):
    k = (code or "").strip()
    if re.match(r"^(cc0|cc-?0)(\s*1\.0)?$", k, re.I): return "CC0"
    return LIC.get(k.lower(), k)


def ext_on_inat(pid):
    for ext in ("jpg", "jpeg", "png", "JPG", "JPEG"):
        r = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}", "-I", "--max-time", "15",
                            "https://inaturalist-open-data.s3.amazonaws.com/photos/%s/medium.%s" % (pid, ext)], capture_output=True, text=True)
        if r.stdout == "200": return ext
    return None


def tile(path, crop):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    if crop:
        x0, y0, x1, y1 = crop
        im = im.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h))); w, h = im.size
    # cover-crop to 3:2 around the middle, then resize (never stretched)
    if w / h > TW / TH:
        nw = round(h * TW / TH); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = round(w * TH / TW); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    return im.resize((TW, TH), Image.LANCZOS)


def main():
    args = sys.argv[1:]
    if not args: print(__doc__); sys.exit(1)
    bdir = args[0]; dry = "--dry-run" in args
    crops = {}
    if "--crops" in args: crops = json.load(open(args[args.index("--crops") + 1]))
    rows = list(csv.DictReader(open(os.path.join(bdir, "photo_changes.csv"), encoding="utf-8-sig")))
    if "--skip" in args:  # --skip "Genus species,Genus species": rows left out (e.g. a photo that fails the checks)
        sk = {x.strip().lower() for x in args[args.index("--skip") + 1].split(",")}
        rows = [r for r in rows if r["scientific_name"].strip().lower() not in sk]
    app = open(APP, encoding="utf-8").read()
    m = re.search(r'(<script type="application/json" id="photo-index">)(.*?)(</script>)', app, re.S)
    D = json.loads(m.group(2)); items = D["items"]
    cards = set(re.findall(r'<div class="card[^"]*" data-id="([^"]+)"', app))
    used = {(v[0], v[1]) for v in items.values()}
    free = [(s, n) for s in range(0, 10000) for n in range(D["cols"] * D["rows"]) if (s, n) not in used]
    cleaned_new, report, sheets = [], [], {}
    for r in rows:
        sci = r["scientific_name"].strip(); sid = re.sub(r"[^a-z-]", "", sci.lower().replace(" ", "-"))
        if sid not in cards: report.append("SKIP %s: no SnakeList card" % sci); continue
        act = r["action"].strip().lower()
        if sid in items and "Illustration" not in items[sid][2]:  # it has a photo: the new one takes its slot (so re-running is safe)
            sheet, n = items[sid][0], items[sid][1]
            if act == "add": report.append("NOTE %s: already had a photo - replaced in its slot" % sci)
        else:
            sheet, n = free.pop(0)
        src = (r.get("source") or "").strip()
        # the photo's own iNaturalist record, wherever the batch put it (source, photo_page_with_license, ...)
        pm = None
        for v in [src] + [str(x) for k, x in r.items() if k != "source"]:
            pm = re.search(r"inaturalist\.org/photos/(\d+)", v or "")
            if pm: break
        if not pm:  # otherwise the most specific page given: a photo page beats an observation, which beats a taxon
            for v in [r.get(k, "") for k in r if "photo" in k.lower() and "http" in (r.get(k) or "")]: src = v.strip(); break
        ext = ext_on_inat(pm.group(1)) if pm else None
        lic = licence(r["license"])
        credit = "%s, %s" % (who_of(r["credit"]), lic) if lic else who_of(r["credit"])
        band = 0.2  # the card's strip sits in the middle of the photo
        entry = [sheet, n, credit, band, "%s.%s" % (pm.group(1), ext)] if ext else [sheet, n, credit, band, "", src]
        crop = crops.get(sci)
        t = tile(os.path.join(bdir, r["file"]), crop)
        if crop: cleaned_new.append("%d-%d" % (sheet, n))
        if not dry:
            t.save(os.path.join(ROOT, "species-photos", "t", "%d-%d.webp" % (sheet, n)), "WEBP", quality=84, method=6)
            sp = sheets.get(sheet)
            if sp is None:
                p = os.path.join(ROOT, "species-photos", "p%d.jpg" % sheet)
                sp = sheets[sheet] = Image.open(p).convert("RGB") if os.path.exists(p) else Image.new("RGB", (TW * D["cols"], TH * D["rows"]), (40, 60, 45))
            sp.paste(t, ((n % D["cols"]) * TW, (n // D["cols"]) * TH))
        items[sid] = entry
        report.append("%s %s -> %d-%d  %s  %s%s" % (act.upper(), sci, sheet, n, credit, entry[4] or src, "  (cropped)" if crop else ""))
    if not dry:
        for s, im in sheets.items(): im.save(os.path.join(ROOT, "species-photos", "p%d.jpg" % s), "JPEG", quality=86)
        js = json.dumps(D, ensure_ascii=False, separators=(",", ":"))
        app = app[:m.start(2)] + js + app[m.end(2):]
        if cleaned_new:
            # both copies of the "cleaned" list: the app's photo viewer and the species page builder
            cm = re.search(r"var CLEANED = \{(.*?)\};", app)
            have = set(re.findall(r'"([\d-]+)": 1', cm.group(1)))
            allc = sorted(have | set(cleaned_new))
            app = app[:cm.start(1)] + ", ".join('"%s": 1' % k for k in allc) + app[cm.end(1):]
            b = open(BUILD_SP, encoding="utf-8").read()
            bm = re.search(r"CLEANED = set\(\[(.*?)\]\)", b)
            bh = set(re.findall(r"'([\d-]+)'", bm.group(1)))
            b = b[:bm.start(1)] + ", ".join("'%s'" % k for k in sorted(bh | set(cleaned_new))) + b[bm.end(1):]
            open(BUILD_SP, "w", encoding="utf-8").write(b)
        open(APP, "w", encoding="utf-8").write(app)
    print("\n".join(report))


if __name__ == "__main__":
    main()
