"""Make the map's country outlines (data/geo.js, SL_GEO.prebuilt.poly) share their borders exactly.

Why: every ring in geo.js had been simplified on its own, so the border France draws and the
border Spain draws were two different lines - between them the sea showed through as dark
slivers and wedges (the Pyrenees round Andorra, ~1,000 such gaps worldwide) and elsewhere the
two shapes overlapped. This tool rebuilds the three levels of detail from one topology:

1. full detail: the rings are cleaned as one polygonal coverage (GEOS CoverageCleaner via
   shapely.coverage_clean) - overlaps go to one side, gaps narrower than GAP_WIDTH are given to
   a neighbour, and every shared border ends up with exactly the same vertices on both sides.
   Countries lying inside another one's ring (Lesotho, San Marino, the Vatican, Llivia,
   Madha...) are drawn on top of it and are left out of the cleaning, as they are.
2. the two coarser levels: the cleaned rings are cut into arcs at every point where the set of
   neighbours changes, each arc is simplified once (Douglas-Peucker) and both neighbours use the
   same simplified arc - so the borders stay identical at every zoom. Rings of 80 points or fewer
   that touch a neighbour keep every point at every level (the app shows small rings whole, and
   their neighbours must then follow the same line).

Keeps the file format, the ring order and indices (SL_GEO.isle refers to them); pieces a ring
splits into are appended at the end. Run from the repo root:  python3 tools/fix_map_borders.py
"""
import json, re, sys, math, os
import numpy as np
import shapely
from shapely.geometry import Polygon, MultiPolygon, LineString
from shapely import STRtree

PATH = os.environ.get("SL_GEO_PATH", "data/geo.js")
GAP_WIDTH = 12          # map units (1/200 degree): gaps under ~6 km between neighbours are closed
TOL = [float(t) for t in os.environ.get("SL_TOL", "24,7").split(",")]  # Douglas-Peucker tolerance per coarse level, map units
SMALL = 80              # the app keeps rings this small whole (see keep() in loadPrebuiltGeometry)


def load(path):
    src = open(path, encoding="utf-8").read()
    i = src.index("window.SL_GEO=") + len("window.SL_GEO=")
    head, body = src[:i], src[i:]
    js = re.sub(r'([{,])(prebuilt|wp|cp|us|isle):', r'\1"\2":', body.rstrip().rstrip(';'), count=5)
    return src, head, json.loads(js)


def dec(dl, da):
    x = y = 0; out = []
    for a, b in zip(dl, da):
        x += a; y += b; out.append((x, y))
    return out


def enc(pts):
    dl, da = [], []; px = py = 0
    for x, y in pts:
        dl.append(x - px); da.append(y - py); px, py = x, y
    return dl, da


def polys_of(g):
    if g.is_empty: return []
    if g.geom_type == "Polygon": return [g]
    if g.geom_type == "MultiPolygon": return list(g.geoms)
    if g.geom_type == "GeometryCollection":
        out = []
        for h in g.geoms: out += polys_of(h)
        return out
    return []


def ring_pts(poly):
    """exterior as integer points, clockwise (as the app's data), no closing repeat, no dupes"""
    c = list(poly.exterior.coords)[:-1]
    if shapely.is_ccw(poly.exterior): c = c[::-1]
    out = []
    for x, y in c:
        p = (int(round(x)), int(round(y)))
        if not out or out[-1] != p: out.append(p)
    while len(out) > 1 and out[0] == out[-1]: out.pop()
    return out


def dp(pts, tol):
    """Douglas-Peucker on an open polyline; the ends always stay"""
    n = len(pts)
    if n < 3 or tol <= 0: return list(pts)
    keep = [False] * n; keep[0] = keep[-1] = True; st = [(0, n - 1)]; t2 = tol * tol
    while st:
        a, b = st.pop()
        if b - a < 2: continue
        ax, ay = pts[a]; bx, by = pts[b]; dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L == 0: d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = ((px - ax) * dx + (py - ay) * dy) / L
                t = 0 if t < 0 else 1 if t > 1 else t
                d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d > best: best, bi = d, i
        if best > t2:
            keep[bi] = True; st.append((a, bi)); st.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]


def winding(r, x, y):
    w = 0; n = len(r)
    for k in range(n):
        (x1, y1), (x2, y2) = r[k], r[(k + 1) % n]
        cr = (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1)
        if y1 <= y < y2 and cr > 0: w += 1
        elif y2 <= y < y1 and cr < 0: w -= 1
    return w


def main():
    src, head, G = load(PATH)
    P = G["prebuilt"]; Q = P["poly"]
    isle = set(G.get("isle") or [])
    N = len(Q)
    full = [None if q[1] else dec(q[2], q[3]) for q in Q]
    geoms = []
    for i, pts in enumerate(full):
        g = None
        if pts and len(pts) >= 3:
            g = Polygon(pts)
            if not g.is_valid: g = shapely.make_valid(g)
            ps = [p for p in polys_of(g) if p.area > 0]
            g = MultiPolygon(ps) if len(ps) > 1 else (ps[0] if ps else None)
        geoms.append(g)

    # enclaves: (mostly) inside another country's ring - drawn on top of it, left as they are
    idx = [i for i, g in enumerate(geoms) if g is not None]
    tree = STRtree([geoms[i] for i in idx])
    enclave = set()
    for k, i in enumerate(idx):
        g = geoms[i]
        for kk in tree.query(g, predicate="intersects"):
            j = idx[kk]
            if j == i or Q[j][0] == Q[i][0]: continue
            h = geoms[j]
            if h.area > g.area and g.intersection(h).area > 0.6 * g.area:
                enclave.add(i); break
    print("enclaves left on top:", sorted({Q[i][0] for i in enclave}), len(enclave), "rings")

    cov_i = [i for i in idx if i not in enclave]
    cov = np.array([geoms[i] for i in cov_i], dtype=object)
    clean = shapely.coverage_clean(cov, gap_width=0.0, snapping_distance=0.5)
    # gaps: thin holes in the land that lie BETWEEN two countries - each goes to the neighbour
    # sharing the longest edge with it. (A lake, delta or fjord inside one country is real water.)
    ccode = [Q[i][0] for i in cov_i]
    ctree = STRtree(clean)
    land = shapely.union_all(clean)
    filled = 0
    for part in polys_of(land):
        for h in part.interiors:
            hp = Polygon(h)
            if shapely.maximum_inscribed_circle(hp, 0.1).length * 2 >= GAP_WIDTH: continue
            nb = [k for k in ctree.query(hp.buffer(0.3), predicate="intersects")]
            if len({ccode[k] for k in nb}) < 2: continue
            best = max(nb, key=lambda k: clean[k].boundary.intersection(hp.boundary.buffer(0.01)).length)
            clean[best] = shapely.union(clean[best], hp)
            filled += 1
    clean = shapely.coverage_clean(clean, gap_width=0.0, snapping_distance=0.0)
    print("gaps between countries closed:", filled, "- coverage valid after clean:", shapely.coverage_is_valid(clean))

    new_full = list(full)
    extra = []          # (source index, points) for pieces a ring split into
    holes_kept = 0; holes_filled = 0; emptied = 0; hole_rings = set()
    for i, g in zip(cov_i, clean):
        ps = [p for p in polys_of(g) if p.area > 0]
        if not ps: emptied += 1; continue   # an atoll of 1-2 map units snapped away: the old ring stays
        ps.sort(key=lambda p: -p.area)
        r0 = ring_pts(ps[0])
        if len(r0) >= 3: new_full[i] = r0
        for p in ps[1:]:
            r = ring_pts(p)
            if len(r) >= 3 and p.area >= 1: extra.append((i, r))
        # a hole: water the old ring left open (it crossed itself round a lake or bay, and the app
        # fills with the nonzero rule, so there it showed as water) stays water - a ring of its own
        # running the other way round, which cancels the fill there. Any other hole was land.
        for p in ps:
            for h in p.interiors:
                hp = Polygon(h); c = hp.representative_point()
                if winding(full[i], c.x, c.y) == 0:
                    r = ring_pts(hp)[::-1]
                    if len(r) >= 3: extra.append((i, r)); hole_rings.add(len(extra) - 1); holes_kept += 1
                else: holes_filled += 1
    print("rings emptied (kept old):", emptied, "extra pieces:", len(extra) - holes_kept, "holes kept as water:", holes_kept, "filled (land before too):", holes_filled)

    rings = [r if r and len(r) >= 3 else None for r in new_full] + [r for _, r in extra]
    src_of = list(range(N)) + [i for i, _ in extra]

    # ---- topology: which rings use each vertex and each edge ----
    vuse = {}
    for ri, r in enumerate(rings):
        if r is None or src_of[ri] in enclave: continue
        for p in set(r): vuse.setdefault(p, set()).add(ri)
    euse = {}
    for ri, r in enumerate(rings):
        if r is None or src_of[ri] in enclave: continue
        n = len(r)
        for k in range(n):
            a, b = r[k], r[(k + 1) % n]
            key = (a, b) if a < b else (b, a)
            euse.setdefault(key, set()).add(ri)

    def esig(r, k, ri):
        a, b = r[k], r[(k + 1) % len(r)]
        return frozenset(euse.get((a, b) if a < b else (b, a), ())) - {ri}

    arcs_of = {}        # ring -> list of (arc key, reversed?)
    arcs = {}           # key -> points (canonical direction)
    for ri, r in enumerate(rings):
        if r is None or src_of[ri] in enclave: continue
        n = len(r)
        sig = [esig(r, k, ri) for k in range(n)]
        nodes = [k for k in range(n) if sig[k] != sig[k - 1] or len(vuse.get(r[k], ())) >= 3]
        seq = []
        if not nodes:
            # one closed arc: start it at its smallest point so both users cut it alike
            k0 = min(range(n), key=lambda k: r[k])
            pts = r[k0:] + r[:k0] + [r[k0]]
            seq.append(pts)
        else:
            for a_, b_ in zip(nodes, nodes[1:] + [nodes[0] + n]):
                seq.append([r[k % n] for k in range(a_, b_ + 1)])
        lst = []
        for pts in seq:
            t, tr = tuple(pts), tuple(reversed(pts))
            if pts[0] == pts[-1] and len(pts) > 2:   # closed arc: canonical start and direction
                body = pts[:-1]; s = body.index(min(body))
                f = body[s:] + body[:s]
                bw = list(reversed(body)); s2 = bw.index(min(body)); f2 = bw[s2:] + bw[:s2]
                key = min(tuple(f + [f[0]]), tuple(f2 + [f2[0]]))
                rev = list(key[:-1]) != f      # this ring runs against the stored direction
                lst.append((key, rev, pts[0]))
            else:
                key = min(t, tr); lst.append((key, key != t, None))
            arcs[key] = None
        arcs_of[ri] = lst

    users = {}
    for ri, lst in arcs_of.items():
        for key, _, _ in lst: users.setdefault(key, set()).add(ri)
    protect = set()
    rings_code = {ri: Q[src_of[ri]][0] for ri in arcs_of}
    for ri, lst in arcs_of.items():
        r = rings[ri]
        shared = any(len(users[k]) > 1 for k, _, _ in lst)
        if shared and len(r) <= SMALL:
            for k, _, _ in lst: protect.add(k)

    def simp(key, tol):
        pts = list(key)
        if key in protect: return pts
        if pts[0] == pts[-1]:
            # closed: split at the point farthest from the start, simplify both halves
            x0, y0 = pts[0]
            far = max(range(len(pts) - 1), key=lambda k: (pts[k][0] - x0) ** 2 + (pts[k][1] - y0) ** 2)
            if far == 0: return pts
            a = dp(pts[:far + 1], tol); b = dp(pts[far:], tol)
            out = a + b[1:]
            if len(out) < 5: return pts if len(pts) <= 5 else dp(pts[:far + 1], tol / 4)[:-1] + dp(pts[far:], tol / 4)
            return out
        return dp(pts, tol)

    lv = []
    for tol in TOL:
        S = {k: simp(k, tol) for k in arcs}
        # a simplified arc must not cross another arc (or itself): that would open a wedge or a
        # spike between neighbours again - those arcs are simplified again, more gently
        keys = list(arcs); kt = {k: tol for k in keys}; todo = keys
        pos = {k: n for n, k in enumerate(keys)}
        # only crossings that can open a gap or an overlap between two countries matter: a border
        # arc, or arcs of different countries (a coast cutting across its own islet is as before)
        cc_of = [frozenset(rings_code[r] for r in users[k]) for k in keys]
        shared = [len(users[k]) > 1 for k in keys]
        def matters(n, m): return shared[n] or shared[m] or cc_of[n] != cc_of[m]
        if tol == TOL[0]:
            full_lines = [LineString(k) for k in keys]; full_tree = STRtree(full_lines)
            base = {}   # arcs that already cross at full detail (left as they are)
            for n, a in enumerate(full_lines):
                for m in full_tree.query(a, predicate="intersects"):
                    if m != n and (a.crosses(full_lines[m]) or a.overlaps(full_lines[m])): base.setdefault(n, set()).add(m)
            base_ns = {n for n, a in enumerate(full_lines) if not a.is_simple}
        for rnd in range(8):
            lines = [LineString(S[k]) for k in keys]
            tree = STRtree(lines)
            bad = set()
            for k in todo:
                n = pos[k]; a = lines[n]; bs = base.get(n, ())
                if shared[n] and not a.is_simple and n not in base_ns: bad.add(k); continue
                # against the others at full detail: this arc's own simplification is at fault
                for m in full_tree.query(a, predicate="intersects"):
                    if m != n and m not in bs and matters(n, m) and (a.crosses(full_lines[m]) or a.overlaps(full_lines[m])): bad.add(k); break
                if k in bad: continue
                for m in tree.query(a, predicate="intersects"):
                    if m != n and m not in bs and matters(n, m) and (a.crosses(lines[m]) or a.overlaps(lines[m])): bad.add(k); bad.add(keys[m])
            if not bad: break
            for k in bad:
                kt[k] = kt[k] / 2 if rnd < 7 else 0
                S[k] = simp(k, kt[k]) if kt[k] > 0.3 else list(k)
            todo = bad
        print("level tol", tol, "arcs", len(keys), "re-simplified after crossing checks:", sum(1 for k in keys if kt[k] < tol))
        out = {}
        for ri, lst in arcs_of.items():
            r = []
            for key, rev, start in lst:
                pts = S[key]
                if start is not None:      # a closed arc: rotate to where this ring starts
                    body = pts[:-1]
                    if rev: body = list(reversed(body))
                    if start in body:
                        s = body.index(start); body = body[s:] + body[:s]
                    pts = body + [body[0]]
                elif rev: pts = list(reversed(pts))
                r.extend(pts[1:] if r else pts)
            if len(r) > 1 and r[0] == r[-1]: r.pop()
            out[ri] = r
        lv.append(out)

    newQ = []
    for ri in range(len(rings)):
        i = src_of[ri]
        q = Q[i]
        if ri < N and (rings[ri] is None or i in enclave or q[1]):
            newQ.append(q); continue
        f = rings[ri]
        l0, l1 = lv[0][ri], lv[1][ri]
        if len(l0) < 3: l0 = f
        if len(l1) < 3: l1 = f
        d = enc(f); a = enc(l0); b = enc(l1)
        newQ.append([q[0], 0, d[0], d[1], q[4], a[0], a[1], b[0], b[1]])
    P["poly"] = newQ
    G["isle"] = sorted(isle | {N + k for k, (i, _) in enumerate(extra) if i in isle and k not in hole_rings})
    tot = [0, 0, 0]
    for q in newQ:
        if q[1]: continue
        tot[0] += len(q[5]); tot[1] += len(q[7]); tot[2] += len(q[2])
    print("points per level (coarse, mid, full):", tot)

    # write back: only prebuilt.poly and isle change; the states/provinces stay byte for byte
    s = src
    note = "// (countries share their borders exactly at every level of detail: tools/fix_map_borders.py)\n"
    if note not in s: s = s.replace("window.SL_GEO=", note + "window.SL_GEO=", 1)
    pb = json.dumps(P, separators=(",", ":"))
    a = s.index("{prebuilt:") + len("{prebuilt:"); b = s.index(",wp:")
    s = s[:a] + pb + s[b:]
    a = s.index(",isle:") + len(",isle:"); b = s.index("]", a) + 1
    s = s[:a] + json.dumps(G["isle"], separators=(",", ":")) + s[b:]
    open(PATH, "w", encoding="utf-8").write(s)
    print("written", PATH, len(s), "bytes")


if __name__ == "__main__":
    main()
