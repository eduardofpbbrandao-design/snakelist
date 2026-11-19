"""Make the map's states, provinces and regions (data/geo.js: wp, cp and us) share their borders
exactly with each other and with their country's own outline.

Why: the state shapes were refitted to an older tracing of the country outlines. After
tools/fix_map_borders.py rebuilt the countries as one clean topology, the states no longer
followed the coast or the land borders the map draws: close up (Lisbon and the Tagus, the
Pyrenees, the US east coast...) a state's edge ran a little inside or outside the country's
line, so two or three near-parallel lines, slivers and doubled strokes showed where there
should be one.

For every country with states (the same countries the app clips them to, with CLIP_ALSO):
1. the country's land at full detail, exactly as the map fills it (its outlines, less its own
   water rings and any country drawn inside it, such as Lesotho in South Africa);
2. each state cut to that land, the states cleaned as one coverage (GEOS CoverageCleaner:
   overlaps go to one side and every border between two states gets the same vertices on both);
3. what the states leave of the land next to them (thin strips along the coast or a border)
   goes to the state sharing the longest edge with it, so the states fill the country exactly;
4. coordinates back on the 0.001 degree grid the file uses. The country's own vertices (0.005
   degree grid) are kept exactly, so a state's coast IS the country's coast.

Run from the repo root after tools/fix_map_borders.py:  python3 tools/fix_state_borders.py
Prints, per level of detail, how much state outline is not on a shared border or the country's
own outline (should be ~0 afterwards).
"""
import json, os, re, sys
import numpy as np
import shapely
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString
from shapely import STRtree

PATH = os.environ.get("SL_GEO_PATH", "data/geo.js")
GRID = 1000                      # the states' coordinates: thousandths of a degree
CLIP_ALSO = {"fr": ["gf"], "us": ["as", "gu", "mp", "pr", "vi"]}   # as in the app


def dec(dl, da):
    x = y = 0; out = []
    for a, b in zip(dl, da):
        x += a; y += b; out.append((x, y))
    return out


def polys_of(g):
    if g is None or g.is_empty: return []
    if g.geom_type == "Polygon": return [g]
    if g.geom_type in ("MultiPolygon", "GeometryCollection"):
        out = []
        for h in g.geoms: out += polys_of(h)
        return out
    return []


def mp(ps):
    ps = [p for p in ps if p.area > 0]
    return MultiPolygon(ps) if len(ps) > 1 else (ps[0] if ps else None)


def area2(pts):
    a = 0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % len(pts)]; a += x1 * y2 - x2 * y1
    return a


def valid_poly(pts):
    if len(pts) < 3: return None
    g = Polygon(pts)
    if not g.is_valid: g = shapely.make_valid(g)
    return mp(polys_of(g))


def grid_ring(coords, cw):
    """a ring as integer thousandths, no repeats, clockwise (exterior) or anticlockwise (hole)"""
    out = []
    for x, y in coords:
        p = (int(round(x * GRID)), int(round(y * GRID)))
        if not out or out[-1] != p: out.append(p)
    while len(out) > 1 and out[0] == out[-1]: out.pop()
    if len(out) < 3: return None
    a = area2(out)
    if a == 0: return None
    if (a < 0) != cw: out.reverse()
    return out


def rings_of(geom):
    out = []
    for p in polys_of(geom):
        r = grid_ring(p.exterior.coords, True)
        if r: out.append(r)
        for h in p.interiors:
            r = grid_ring(h.coords, False)
            if r: out.append(r)
    return out


def state_geom(rings):
    """a state's rings (lon/lat) as one geometry, even-odd (a ring inside another is a hole)"""
    g = None
    for r in rings:
        p = valid_poly(r)
        if p is None: continue
        g = p if g is None else shapely.symmetric_difference(g, p)
    return mp(polys_of(g)) if g is not None else None


def load():
    src = open(PATH, encoding="utf-8").read()
    i = src.index("window.SL_GEO=") + len("window.SL_GEO=")
    js = re.sub(r'([{,])(prebuilt|wp|cp|us|isle):', r'\1"\2":', src[i:].rstrip().rstrip(';'), count=5)
    return src, json.loads(js)


def country_land(Q, SC):
    """code -> the land the map fills for it, at full detail, in degrees"""
    by = {}
    for q in Q:
        if q[1]: continue
        pts = [(x / SC, y / SC) for x, y in dec(q[2], q[3])]
        if len(pts) < 3: continue
        by.setdefault(q[0], []).append((pts, area2(pts) < 0))
    land = {}
    for code, rs in by.items():
        cw = [valid_poly(p) for p, c in rs if c]
        ccw = [valid_poly(p) for p, c in rs if not c]
        cw = [g for g in cw if g is not None]; ccw = [g for g in ccw if g is not None]
        if not cw: cw, ccw = ccw, []
        g = shapely.union_all(cw)
        if ccw:   # rings running the other way round inside the land are water (a lake, a bay)
            holes = [h for h in ccw if g.intersection(h).area > 0.5 * h.area]
            rest = [h for h in ccw if h not in holes]
            if rest: g = shapely.union_all([g] + rest)
            if holes: g = g.difference(shapely.union_all(holes))
        land[code] = g
    # countries drawn inside another one (Lesotho, San Marino, the Vatican, Llivia...) are not its land
    codes = list(land); geoms = [land[c] for c in codes]; tree = STRtree(geoms)
    out = {}
    for i, c in enumerate(codes):
        g = geoms[i]
        inner = [geoms[j] for j in tree.query(g, predicate="intersects") if j != i and geoms[j].area < g.area
                 and g.intersection(geoms[j]).area > 0.6 * geoms[j].area]
        out[c] = g.difference(shapely.union_all(inner)) if inner else g
    return out


def fit_country(land, shapes):
    """shapes: list of state geometries (None allowed) -> the fitted geometries"""
    idx = [i for i, g in enumerate(shapes) if g is not None]
    cut = []
    for i in idx:
        g = shapely.intersection(shapes[i], land)
        cut.append(mp(polys_of(g)))
    # a state lying inside another one (Vienna in Lower Austria, Berlin in Brandenburg, Brasilia's
    # district in Goias): the app picks the smaller one there, so it is cut out of the one around it
    live = [k for k, g in enumerate(cut) if g is not None]
    if len(live) > 1:
        tr = STRtree([cut[k] for k in live])
        for a in live:
            g = cut[a]
            if g is None: continue
            for m in tr.query(g, predicate="intersects"):
                b = live[m]
                if b == a or cut[b] is None or cut[b].area >= g.area: continue
                if g.intersection(cut[b]).area > 0.5 * cut[b].area:
                    g = mp(polys_of(g.difference(cut[b])))
                    if g is None: break
            cut[a] = g
    keep = [k for k, g in enumerate(cut) if g is not None]
    arr = np.array([cut[k] for k in keep], dtype=object)
    if len(arr) > 1:
        for snap in (0.0002, 0.001):
            try: arr = shapely.coverage_clean(arr, gap_width=0.0, snapping_distance=snap); break
            except shapely.errors.GEOSException: pass
    fitted = {idx[k]: mp(polys_of(g)) for k, g in zip(keep, arr)}
    fitted = {i: g for i, g in fitted.items() if g is not None}
    if not fitted: return {}
    order = list(fitted); geoms = [fitted[i] for i in order]
    # the land the states leave, next to them: each piece to the state with the longest edge on it
    rest = land.difference(shapely.union_all(geoms))
    tree = STRtree(geoms); add = {}
    pieces = []
    for piece in polys_of(rest):
        # (a union of thousands of shapes can come out a little wrong: never hand a state's own land to another)
        over = [geoms[k] for k in tree.query(piece, predicate="intersects")]
        if over: piece = shapely.difference(piece, shapely.union_all(over)) if any(piece.intersection(g).area > 1e-9 for g in over) else piece
        pieces += polys_of(piece)
    for piece in pieces:
        if piece.area <= 0: continue
        best, bl = None, 0.0
        edge = piece.boundary
        for k in tree.query(piece.buffer(1e-6), predicate="intersects"):
            l = geoms[k].boundary.intersection(edge.buffer(1e-6)).length
            if l > bl: best, bl = k, l
        if best is not None and bl > 0: add.setdefault(best, []).append(piece)
    for k, ps in add.items():
        geoms[k] = mp(polys_of(shapely.union_all([geoms[k]] + ps)))
    arr = np.array(geoms, dtype=object)
    if len(arr) > 1:
        # (the cleaning can, rarely, hand a whole state to its neighbour: such a result is not used)
        for snap in (0.0, 0.0002, 0.001):
            try: res = shapely.coverage_clean(arr, gap_width=0.0, snapping_distance=snap)
            except shapely.errors.GEOSException: continue
            if all(r is not None and r.area >= 0.9 * g.area - 1e-6 for r, g in zip(res, arr)): arr = res; break
    out = {i: g for i, g in zip(order, arr) if g is not None and not g.is_empty}
    # the same place listed twice under two names (Madagascar's "Toamasina" and "Toamasina (2)"): the
    # one the cleaning left out gets the very same shape as its twin
    for i in idx:
        if i in out: continue
        g = shapes[i]
        for j in list(out):
            h = shapes[j]
            if h is not None and g.intersection(h).area > 0.9 * g.area and abs(h.area - g.area) < 0.1 * g.area:
                out[i] = out[j]; break
    return out


def mismatch(rings_list, land):
    """state outline length (degrees) that is neither a border shared by two states nor on the
    country's outline"""
    edges = {}
    for rings in rings_list:
        for r in rings:
            n = len(r)
            for k in range(n):
                a, b = tuple(r[k]), tuple(r[(k + 1) % n])
                key = (a, b) if a < b else (b, a)
                edges[key] = edges.get(key, 0) + 1
    single = [((a[0] / GRID, a[1] / GRID), (b[0] / GRID, b[1] / GRID)) for (a, b), c in edges.items() if c == 1]
    if not single: return 0.0, 0.0
    ml = MultiLineString(single)
    on = ml.intersection(land.boundary.buffer(0.0008)).length
    return ml.length - on, ml.length


def main():
    src, G = load()
    P = G["prebuilt"]; SC = P.get("scale", 100)
    land_of = country_land(P["poly"], SC)
    wp, cp, us = G["wp"], G["cp"], G["us"]
    jobs = []   # (cc, list of rings (lon/lat floats), setter)
    for cc, (k, feats) in wp.items():
        if cc in cp: continue
        rings = [[[(x / k, y / k) for x, y in dec(f[1][j][0::2], f[1][j][1::2])] for j in range(len(f[1]))] for f in feats]
        def setter(i, rs, feats=feats, k=k):
            flat = []
            for r in rs:
                fl = []; px = py = 0
                for x, y in r:
                    X, Y = x * k // GRID, y * k // GRID
                    fl += [X - px, Y - py]; px, py = X, Y
                flat.append(fl)
            feats[i][1] = flat
        jobs.append((cc, rings, setter))
    for cc, feats in cp.items():
        rings = [[[tuple(p) for p in r] for r in f["rings"]] for f in feats]
        def setter(i, rs, feats=feats): feats[i]["rings"] = [[[x / GRID, y / GRID] for x, y in r] for r in rs]
        jobs.append((cc, rings, setter))
    rings_us = [[[tuple(p) for p in r] for r in f["rings"]] for f in us]
    def set_us(i, rs): us[i]["rings"] = [[[x / GRID, y / GRID] for x, y in r] for r in rs]
    jobs.append(("us", rings_us, set_us))

    tot_b = tot_a = tot_len = 0.0; changed = 0; pts_b = pts_a = 0
    only = set(filter(None, os.environ.get("SL_ONLY", "").split(",")))
    for cc, rings, setter in sorted(jobs, key=lambda j: j[0]):
        if only and cc not in only: continue
        codes = [cc] + CLIP_ALSO.get(cc, [])
        lands = [land_of[c] for c in codes if c in land_of]
        if not lands: print("no outline for", cc, "- left as it is"); continue
        land = shapely.union_all(lands)
        old = [[grid_ring(r, True) or [] for r in rs] for rs in rings]
        b, L = mismatch(old, land)
        shapes = [state_geom(rs) for rs in rings]
        fitted = fit_country(land, shapes)
        new = []
        for i, rs in enumerate(rings):
            g = fitted.get(i)
            nr = rings_of(g) if g is not None else []
            if not nr: nr = [r for r in old[i] if r]     # nothing left of it (a speck): kept as it was
            new.append(nr)
        a, _ = mismatch(new, land)
        pts_b += sum(len(r) for rs in rings for r in rs); pts_a += sum(len(r) for rs in new for r in rs)
        tot_b += b; tot_a += a; tot_len += L
        if b > 0.05 or a > 0.05: print("%s: off-outline state edges %.2f -> %.2f degrees" % (cc, b, a))
        for i, nr in enumerate(new): setter(i, nr)
        changed += 1
    print("countries fitted:", changed, "off-outline state edges: %.1f -> %.1f degrees" % (tot_b, tot_a), "points:", pts_b, "->", pts_a)

    s = src
    def put(key, nxt, val):
        nonlocal s
        a = s.index("," + key + ":") + len(key) + 2; b = s.index("," + nxt + ":", a)
        s = s[:a] + json.dumps(val, separators=(",", ":"), ensure_ascii=False) + s[b:]
    put("wp", "cp", wp); put("cp", "us", cp); put("us", "isle", us)
    note = "// (the states share their borders exactly with each other and with their country: tools/fix_state_borders.py)\n"
    if note not in s: s = s.replace("window.SL_GEO=", note + "window.SL_GEO=", 1)
    open(PATH, "w", encoding="utf-8").write(s)
    print("written", PATH, len(s), "bytes")


if __name__ == "__main__":
    main()
