"""Crop white borders / strips off SnakeList species photos.

Some photos came with a white frame, a white letterbox or a bad crop, so a thin white strip shows
along an edge of the photo (e.g. down the left side of a card). This finds those strips in every
photo tile and crops them away.

A strip is a band of lines (rows or columns) at the very edge of the 540x360 tile where nearly every
pixel is near-white and the line is flat (low variance), followed by a hard edge into the photo
(the next line inwards is clearly not white). Pale real content (a pale snake on sand, a blown-out
sky) is not flagged because it is not flat near-white right to the edge and/or has no hard edge.

For each flagged tile the band(s) plus a small safety margin are cut away, the rest is centre-cropped
to 3:2 and scaled back up to 540x360, then written back into its sprite sheet
(species-photos/p<sheet>.jpg, re-encoded once at quality 92, only sheets with a flagged tile) and into
the per-photo file species-photos/t/<sheet>-<cell>.webp used by the species pages.

Run:  python3 tools/crop_white_borders.py            (scan + fix)
      python3 tools/crop_white_borders.py --dry-run  (scan only, list what would change)
      python3 tools/crop_white_borders.py --sheet-out DIR   (also write before/after contact sheet)
"""
import json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JPEG_Q, WEBP_Q = 92, 80
WHITE_MIN = 225      # a pixel is near-white when its darkest channel is above this
LINE_FRAC = 0.97     # share of near-white pixels for a line to count as white
LINE_STD = 10.0      # max std of the line's darkest channel (flat, not textured)
MAX_BAND = 120       # never cut more than this from one edge (px of the 540x360 tile)
SAFETY = 2           # extra px cut past the band


def load_index():
    app = open(os.path.join(ROOT, "snakelist-synced.html"), encoding="utf-8").read()
    return json.loads(re.search(r'<script type="application/json" id="photo-index">(.*?)</script>', app, re.S).group(1))


def edge_lines(mn, edge):
    """Lines of the darkest-channel image ordered from the given edge inwards."""
    if edge == "top": return mn
    if edge == "bottom": return mn[::-1]
    if edge == "left": return mn.T
    return mn.T[::-1]


def band_width(mn, edge):
    """Width in px of a white band at this edge, or 0."""
    L = edge_lines(mn, edge)
    n = 0
    for i in range(min(MAX_BAND + 1, len(L))):
        line = L[i]
        # ignore a couple of px at each end of the line (corners can belong to the other edge's band)
        core = line[3:-3]
        # JPEG noise lets a few px of a white strip dip a little below WHITE_MIN
        if core.mean() >= WHITE_MIN - 3 and (core > WHITE_MIN - 20).mean() >= LINE_FRAC and core.std() <= LINE_STD:
            n += 1
        else:
            break
    if n < 1 or n > MAX_BAND:
        return 0
    # hard edge: within 3 lines after the band the photo must be clearly non-white
    nxt = L[n:n + 3, 3:-3]
    if len(nxt) == 0:
        return 0
    if (nxt[-1] > WHITE_MIN).mean() > 0.6 or nxt[-1].mean() > 215:
        return 0
    # extend over the soft transition into the photo (JPEG ringing, blending, or a frame's drop
    # shadow): cut through the last of the next few lines that still differs clearly from the photo
    # just inside them
    inner = L[n + 8:n + 16, 3:-3].mean()
    thr = max(20.0, 0.2 * abs(255 - inner))
    for i in range(n, min(n + 8, len(L))):
        if abs(L[i, 3:-3].mean() - inner) > thr:
            n = i + 1
    return n


def detect(tile):
    a = np.asarray(tile.convert("RGB"), dtype=np.int16)
    mn = a.min(2).astype(np.float64)
    # the other edges' bands are allowed in corners, but a band must not just be an all-white image
    if (mn > WHITE_MIN).mean() > 0.6:
        return {}
    out = {}
    for e in ("top", "bottom", "left", "right"):
        w = band_width(mn, e)
        if w:
            out[e] = w
    return out


def fix(tile, bands):
    W, H = tile.size
    l = bands.get("left", 0); r = bands.get("right", 0); t = bands.get("top", 0); b = bands.get("bottom", 0)
    x0 = l + SAFETY if l else 0; x1 = W - (r + SAFETY if r else 0)
    y0 = t + SAFETY if t else 0; y1 = H - (b + SAFETY if b else 0)
    cw, ch = x1 - x0, y1 - y0
    # centre-crop the other axis so the 3:2 shape is kept (nothing stretched)
    if cw * H > ch * W:
        nw = round(ch * W / H); x0 += (cw - nw) / 2; x1 = x0 + nw
    else:
        nh = round(cw * H / W); y0 += (ch - nh) / 2; y1 = y0 + nh
    return tile.resize((W, H), Image.LANCZOS, box=(x0, y0, x1, y1))


def main():
    dry = "--dry-run" in sys.argv
    out_dir = sys.argv[sys.argv.index("--sheet-out") + 1] if "--sheet-out" in sys.argv else None
    P = load_index()
    C, W, H = P["cols"], P["w"], P["h"]
    cells = {}
    for sid, v in P["items"].items():
        if not v or "Illustration" in str(v[2] if len(v) > 2 else ""):
            continue
        cells.setdefault((v[0], v[1]), []).append(sid)
    by_sheet = {}
    for (s, c) in sorted(cells):
        by_sheet.setdefault(s, []).append(c)
    flagged = []
    for s, cl in sorted(by_sheet.items()):
        path = os.path.join(ROOT, P["path"] % s)
        sheet = Image.open(path).convert("RGB")
        changed = False
        for c in cl:
            box = ((c % C) * W, (c // C) * H, (c % C) * W + W, (c // C) * H + H)
            tile = sheet.crop(box)
            bands = detect(tile)
            if not bands:
                continue
            new = fix(tile, bands)
            flagged.append((s, c, bands, cells[(s, c)], tile, new))
            print("p%d cell %d %s %s" % (s, c, bands, ",".join(cells[(s, c)])))
            if not dry:
                sheet.paste(new, box[:2])
                changed = True
                wp = os.path.join(ROOT, "species-photos", "t", "%d-%d.webp" % (s, c))
                if os.path.exists(wp):
                    # the per-photo copy is the same photo, encoded separately: fix it from its own
                    # pixels (its band can be a px wider/narrower), falling back to the sheet's bands
                    own = Image.open(wp).convert("RGB")
                    if own.size == (W, H):
                        fix(own, detect(own) or bands).save(wp, "WEBP", quality=WEBP_Q, method=6)
                    else:
                        new.save(wp, "WEBP", quality=WEBP_Q, method=6)
        if changed:
            sheet.save(path, "JPEG", quality=JPEG_Q, optimize=True)
    print("%d tiles flagged" % len(flagged))
    if out_dir and flagged:
        os.makedirs(out_dir, exist_ok=True)
        tw, th = 270, 180
        per = 12
        for k in range(0, len(flagged), per):
            chunk = flagged[k:k + per]
            cs = Image.new("RGB", (tw * 2 + 30, (th + 18) * len(chunk)), (40, 40, 40))
            d = ImageDraw.Draw(cs)
            for i, (s, c, bands, ids, before, after) in enumerate(chunk):
                y = i * (th + 18)
                cs.paste(before.resize((tw, th)), (0, y + 16)); cs.paste(after.resize((tw, th)), (tw + 30, y + 16))
                d.text((2, y + 2), "p%d/%d %s %s" % (s, c, ids[0], bands), fill=(255, 255, 0))
            cs.save(os.path.join(out_dir, "contact_%02d.jpg" % (k // per)), quality=88)


if __name__ == "__main__":
    main()
