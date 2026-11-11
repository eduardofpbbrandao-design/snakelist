"""The colours of each snake for its generated 3D model (v4.63), read from its own SnakeList photo.

For every species with a real photo in species-photos/ (not the fossil illustrations), the photo is
split into colour groups (k-means). Colours that fill the photo's edges are taken to be the
background (ground, leaves, a hand), so the snake is the colour groups that sit mostly in the middle
of the picture. The biggest of those is the snake's main colour; a clearly lighter or darker one,
if it covers enough of the snake, is its pattern colour.

Writes data/snake-model-colours.json: { id: { "d": main, "p": pattern or null, "c": contrast 0-1,
"q": how sure 0-1 } }. Run: python3 tools/model_colours.py   (takes a few minutes)
"""
import json, re, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app = open(os.path.join(ROOT, "snakelist-synced.html"), encoding="utf-8").read()
P = json.loads(re.search(r'<script type="application/json" id="photo-index">(.*?)</script>', app, re.S).group(1))
C, R, W, H = P["cols"], P["rows"], P["w"], P["h"]
# names, to know which snakes really are green (so leaves aren't taken for them)
NAMES = {}
for m in re.finditer(r'<div class="card" data-id="([^"]*)"[^>]*>.*?<div class="card-name(?: is-sci)?">(.*?)</div>', app, re.S):
    NAMES[m.group(1)] = m.group(2)
GREEN_GENERA = {"ahaetulla", "philothamnus", "opheodrys", "chironius", "leptophis", "trimeresurus", "craspedocephalus", "atheris",
                "bothriechis", "morelia", "corallus", "dendroaspis", "hapsidophrys", "rhadinophis", "gonyosoma", "dendrelaphis", "oxybelis",
                "dispholidus", "thrasops", "rhamnophis", "liophis", "philodryas", "uromacer", "langaha", "ophryacus", "tropidolaemus",
                "viridovipera", "popeia", "parias", "himalayophis", "protobothrops", "cryptelytrops", "boiga", "oxyrhopus", "erythrolamprus",
                "masticophis", "tantilla", "eirenis", "liopeltis", "ptyas", "cyclophiops", "chlorosoma", "tachymenis", "leptophis", "toxicodryas"}
def green_ok(sid):
    n = NAMES.get(sid, "").lower()
    return bool(re.search(r"green|emerald|verde|grass|vine|leaf|jade|olive", n)) or sid.split("-")[0] in GREEN_GENERA


def srgb_to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def kmeans(X, k, it=14, seed=1):
    rs = np.random.RandomState(seed)
    cen = X[rs.choice(len(X), k, replace=False)]
    for _ in range(it):
        lab = np.argmin(((X[:, None, :] - cen[None]) ** 2).sum(-1), 1)
        for j in range(k):
            m = lab == j
            if m.any(): cen[j] = X[m].mean(0)
    return cen, lab


def hexc(rgb):
    r, g, b = [int(max(0, min(255, round(v)))) for v in rgb]
    return "#%02x%02x%02x" % (r, g, b)


def colours(cell, sid=""):
    a = np.asarray(cell.convert("RGB").resize((120, 80), Image.BILINEAR), dtype=np.float64)
    h, w, _ = a.shape
    yy, xx = np.mgrid[0:h, 0:w]
    # distance from the picture's edge, 0 at the edge .. 1 at the middle
    edge = np.minimum(np.minimum(xx / (w / 2), (w - 1 - xx) / (w / 2)), np.minimum(yy / (h / 2), (h - 1 - yy) / (h / 2)))
    rgb = a.reshape(-1, 3); lab = srgb_to_lab(rgb); e = edge.reshape(-1)
    cen, lb = kmeans(lab, 7)
    border, middle = e < 0.16, e > 0.42
    groups = []
    for j in range(7):
        m = lb == j
        n = m.sum()
        if n < 30: continue
        bshare = (m & border).sum() / max(1, border.sum())
        mshare = (m & middle).sum() / max(1, middle.sum())
        snake = mshare / (bshare + 0.02)  # sits in the middle, not at the edges
        L0, A0, B0 = cen[j]
        # a hand holding the snake, or leaves around it: rarely the snake itself
        if 45 < L0 < 88 and 6 < A0 < 30 and 6 < B0 < 34: snake *= 0.12
        if A0 < -7 and B0 > 4 and not green_ok(sid): snake *= 0.15
        groups.append({"n": n, "snake": snake, "mshare": mshare, "rgb": rgb[m].mean(0), "L": cen[j][0], "lab": cen[j]})
    if not groups: return None
    cand = [g for g in groups if g["snake"] > 1.15 and g["mshare"] > 0.06]
    sure = 1.0
    if not cand:  # the snake fills the photo, or blends in: take what fills the middle
        cand = sorted(groups, key=lambda g: -g["mshare"])[:2]; sure = 0.4
    main = max(cand, key=lambda g: g["mshare"] * min(g["snake"], 3))
    others = [g for g in cand if g is not main and g["mshare"] > 0.035]
    pat, con = None, 0.0
    if others:
        best = max(others, key=lambda g: np.linalg.norm(g["lab"] - main["lab"]) * min(1, g["mshare"] / max(0.05, main["mshare"])))
        d = float(np.linalg.norm(best["lab"] - main["lab"]))
        if d > 18:
            pat, con = best, min(1.0, d / 70)
    return {"d": hexc(main["rgb"]), "p": hexc(pat["rgb"]) if pat else None, "c": round(con, 2), "q": round(sure * min(1.0, main["snake"] / 2.5), 2)}


def main():
    out, sheets = {}, {}
    items = [(k, v) for k, v in P["items"].items() if "Illustration" not in str(v[2])]
    items.sort(key=lambda kv: (kv[1][0], kv[1][1]))  # one photo sheet at a time
    for i, (sid, v) in enumerate(items):
        sh, cell = v[0], v[1]
        if sh not in sheets:
            sheets.clear(); sheets[sh] = Image.open(os.path.join(ROOT, P["path"].replace("%d", str(sh))))
        x, y = (cell % C) * W, (cell // C) * H
        try:
            r = colours(sheets[sh].crop((x, y, x + W, y + H)), sid)
        except Exception as ex:  # a damaged tile: no colours, the model uses its group's
            print(sid, ex, file=sys.stderr); r = None
        if r: out[sid] = r
        if i % 250 == 0: print(i, "/", len(items), file=sys.stderr)
    json.dump(dict(sorted(out.items())), open(os.path.join(ROOT, "data/snake-model-colours.json"), "w"), separators=(",", ":"))
    print(len(out), "species")


if __name__ == "__main__":
    main()
