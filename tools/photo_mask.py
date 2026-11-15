"""The snake in each SnakeList photo, cut out from its background (v5.24), for the generated 3D models.

tools/model_colours.py guesses the snake's colours from colour groups that sit in the middle of the picture. This
goes further: it cuts the snake out with GrabCut (started from the middle of the picture, the edges taken to be
background), checks that what it cut out is shaped like a snake (long and thin, not a blob, not a hand), and then reads
from the snake's own pixels:
  - its main colour, its second colour and how strongly they differ;
  - its pattern, from the shapes the second colour makes on the body: thin marks running along the body (stripes),
    marks across it (bands), roundish marks about as big as the body is wide (blotches), many small dots (speckles),
    or none (plain); the body's direction at each point comes from the cut-out's distance map.
Each result has a confidence 0-1; tools/auto_models.py only uses confident ones, and never over hand-checked profiles.

Writes data/snake-model-photo.json: { id: { "d", "p", "c", "t", "q", "w": mask share of the photo } }.
Run: python3 tools/photo_mask.py   (about 10 minutes)
"""
import json, os, re, sys
import numpy as np
import cv2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def hexc(rgb):
    return "#%02x%02x%02x" % tuple(int(max(0, min(255, round(v)))) for v in rgb)


def snake_mask(img):
    """img: BGR uint8. Returns (mask bool, quality 0-1)."""
    h, w = img.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    rect = (int(w * 0.08), int(h * 0.08), int(w * 0.84), int(h * 0.84))
    bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(img, mask, rect, bg, fg, 4, cv2.GC_INIT_WITH_RECT)
    except cv2.error:
        return None, 0
    m = (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    # keep the largest pieces (the snake may be split by a branch)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8))
    if n <= 1: return None, 0
    order = np.argsort(-st[1:, cv2.CC_STAT_AREA]) + 1
    keep = np.zeros_like(m)
    for k in order[:3]:
        if st[k, cv2.CC_STAT_AREA] >= st[order[0], cv2.CC_STAT_AREA] * 0.25: keep |= lab == k
    m = keep
    share = m.mean()
    if share < 0.03 or share > 0.75: return m, 0
    # a clean cut-out: the snake's colours differ from the background's, and the cut-out rarely touches the picture's edge
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float64)
    sep = np.linalg.norm(lab[m].mean(0) - lab[~m].mean(0)) / 40.0
    edge = np.concatenate([m[0], m[-1], m[:, 0], m[:, -1]]).mean()
    q = float(np.clip(sep, 0, 1) * (1 - np.clip(edge * 2.5, 0, 0.9)))
    # a hand (skin colour) taking most of the cut-out: not the snake
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    skin = ((hsv[..., 0] < 22) & (hsv[..., 1] > 50) & (hsv[..., 1] < 170) & (hsv[..., 2] > 120))[m].mean()
    if skin > 0.45: q *= 0.3
    return m, q


def kmeans(X, k, it=12, seed=1):
    rs = np.random.RandomState(seed); cen = X[rs.choice(len(X), k, replace=False)].copy()
    for _ in range(it):
        lab = np.argmin(((X[:, None, :] - cen[None]) ** 2).sum(-1), 1)
        for j in range(k):
            if (lab == j).any(): cen[j] = X[lab == j].mean(0)
    return cen, lab


def analyse(img):
    m, q = snake_mask(img)
    if m is None or q <= 0: return None
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float64)
    px = lab[m]
    if len(px) > 6000: px = px[np.random.RandomState(3).choice(len(px), 6000, replace=False)]
    cen, lb = kmeans(px, 3)
    cnt = np.bincount(lb, minlength=3) / len(lb)
    main = int(np.argmax(cnt))
    # the second colour: the most different group that covers a fair part of the snake
    others = [j for j in range(3) if j != main and cnt[j] > 0.08]
    sec, dist = None, 0.0
    if others:
        sec = max(others, key=lambda j: np.linalg.norm(cen[j] - cen[main]) * min(1, cnt[j] / 0.2))
        dist = float(np.linalg.norm(cen[sec] - cen[main]))
    toBGR = lambda c: cv2.cvtColor(np.uint8([[np.clip(c, 0, 255)]]), cv2.COLOR_LAB2BGR)[0, 0][::-1]
    d = hexc(toBGR(cen[main])); p = hexc(toBGR(cen[sec])) if sec is not None else None
    con = min(1.0, dist / 70.0)
    t, tq = "plain", 0.5
    if sec is not None and dist > 22:
        # the second colour's marks on the snake: their size and direction against the body's
        full = lab[m]; allc = np.argmin(((full[:, None, :] - cen[None]) ** 2).sum(-1), 1)
        sm = np.zeros(m.shape, np.uint8); sm[m] = (allc == sec)
        sm = cv2.morphologyEx(sm, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
        dt = cv2.distanceTransform(m.astype(np.uint8), cv2.DIST_L2, 5)
        W = max(2.0, 2 * np.percentile(dt[m], 90))  # body width in pixels
        gy, gx = np.gradient(cv2.GaussianBlur(dt, (0, 0), 2))
        n, cl, st, _ = cv2.connectedComponentsWithStats(sm)
        small = big = along = across = 0; tot = 0
        for k in range(1, n):
            a = st[k, cv2.CC_STAT_AREA]
            if a < 3: continue
            ys, xs = np.nonzero(cl == k)
            tot += a
            if a < (W * 0.35) ** 2: small += a; continue
            # its long direction (PCA) against the body's direction (perpendicular to the distance-map gradient)
            cov = np.cov(np.vstack([xs - xs.mean(), ys - ys.mean()]))
            ev, evec = np.linalg.eigh(cov); el = np.sqrt(max(ev[1], 1e-6) / max(ev[0], 1e-6)); v = evec[:, 1]
            g = np.array([gx[ys, xs].mean(), gy[ys, xs].mean()]); gn = np.linalg.norm(g)
            if gn < 1e-6 or el < 1.8: big += a; continue
            body = np.array([-g[1], g[0]]) / gn
            if abs(np.dot(v, body)) > 0.75: along += a
            elif abs(np.dot(v, body)) < 0.45: across += a
            else: big += a
        if tot > 0 and cnt[sec] > 0.06:
            shares = {"speckle": small / tot, "blotch": big / tot, "stripe": along / tot, "band": across / tot}
            t = max(shares, key=shares.get); tq = shares[t]
    return {"d": d, "p": p, "c": round(con, 2), "t": t, "q": round(q * (0.5 + 0.5 * tq), 2), "w": round(float(m.mean()), 2)}


def main():
    app = open(os.path.join(ROOT, "snakelist-synced.html"), encoding="utf-8").read()
    P = json.loads(re.search(r'<script type="application/json" id="photo-index">(.*?)</script>', app, re.S).group(1))
    C, W, H = P["cols"], P["w"], P["h"]
    items = sorted(((k, v) for k, v in P["items"].items() if "Illustration" not in str(v[2])), key=lambda kv: (kv[1][0], kv[1][1]))
    only = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None
    out, cur, sheet = {}, None, None
    for i, (sid, v) in enumerate(items):
        if only and sid not in only: continue
        if v[0] != cur: cur = v[0]; sheet = cv2.imread(os.path.join(ROOT, P["path"].replace("%d", str(cur))))
        x, y = (v[1] % C) * W, (v[1] // C) * H
        tile = sheet[y:y + H, x:x + W]
        if tile.size == 0: continue
        r = analyse(cv2.resize(tile, (W // 2, H // 2), interpolation=cv2.INTER_AREA))
        if r: out[sid] = r
        if i % 300 == 0: print(i, "/", len(items), file=sys.stderr)
    path = os.path.join(ROOT, "data/snake-model-photo.json") if not only else os.path.join(os.environ.get("OUT", "/tmp"), "photo-test.json")
    json.dump(dict(sorted(out.items())), open(path, "w"), separators=(",", ":"))
    print(len(out), "species ->", path)


if __name__ == "__main__":
    main()
