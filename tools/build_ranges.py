"""Build the map's "Show colours" ranges: one small file per species, data/ranges/<id>.json.

Where a snake lives, drawn as its real range instead of the whole states/countries it is recorded in.

Source: GARD 1.7 - Global Assessment of Reptile Distributions (Roll et al. 2017, Nature Ecology &
Evolution 1:1677-1682; updated in Caetano et al. 2022, PLoS Biology), expert range polygons for every
terrestrial reptile, published under CC0 (public domain) at https://zenodo.org/records/6499637
(Gard_1_7_ranges.shp/.shx/.dbf, ~860 MB, not kept in this repo).

For every SnakeList species (the cards in snakelist-synced.html):
1. its GARD range, by scientific name - or, when SnakeList uses a newer name, the GARD species with the
   same species name (and its gender variants) in another genus, or one listed in SYNONYMS below, but
   only when that range lies in the countries SnakeList records it in (so a namesake elsewhere in the
   world is never taken);
2. simplified (curves kept, ~0.02 degrees), reaching out to the coast where the GARD outline stops just
   short of it, and cut to the map's own land (data/geo.js + data/islands.js), so it never runs into the
   sea and its coast is the coast the map draws;
3. no GARD range: the places SnakeList records it in (states/provinces, else whole countries; a big
   country with no finer records only near its finer records next door, as before), joined into one
   shape with rounded corners and cut to the land - no state lines inside;
4. plus the places people brought it to (SL_INVASIVE), with the documented smaller-than-a-state ones
   (Burmese and Northern African pythons in South Florida, USGS NAS) drawn as natural outlines.

File: {"s": "g" (GARD) or "f" (from SnakeList's places), "k": 100 (units per degree),
       "b": [w, e, s, n], "t": the half-thickness of its biggest piece in degrees (under ~0.05: one shade),
       "p": [[ring, ring...], ...] polygons (first ring the outside, the rest holes),
       "e": [line, ...] the parts of the outline that are NOT the coast (where the range really ends),
       "et": [t, ...] for each of those, how deep its piece goes (the lighter bands' widths follow it)}
A ring/line is flat integers: the first point, then each point as the step from the one before.

Run from the repo root:  python3 -I tools/build_ranges.py <folder with Gard_1_7_ranges.*> [id ...]
(--resume: keep the files already written; --retouch: only work out the shading of the files again)
Needs: pip install shapely pyshp
"""
import json, math, os, re, subprocess, sys
from multiprocessing import Pool

ROOT = os.getcwd()
sys.path.insert(0, os.path.join(ROOT, "tools"))
import numpy as np
import shapely
import shapefile
from shapely.geometry import Polygon, MultiPolygon, Point, box
from shapely.geometry.polygon import orient
from shapely import STRtree
from shapely.ops import polylabel
from fix_state_borders import load, country_land, polys_of, mp, state_geom

OUT = os.path.join(ROOT, "data", "ranges")
K = 100                       # units per degree in the files
SIMPLIFY = 0.02               # degrees: GARD outlines simplified to this (curves kept)
LAND_SIMPLIFY = 0.01          # the land they are cut to
COAST_REACH = 0.1             # a GARD edge this close to the coast is taken out to the coast
NEAR_DEG = 450 / 111.2        # (as AREA_NEAR_KM was) a big country with no finer records: only this near them
BIG = 200                     # square degrees: a "big" country
MIN_PART = 0.0004             # square degrees: smaller pieces dropped (except whole islands)

# SnakeList name -> GARD name, where neither the name nor the species name alone finds it
SYNONYMS = {
    "Trimerodytes yunnanensis": None,     # a different snake from Atretium (now Fowlea) yunnanensis
}
# GARD's and SnakeList's family names for the same groups (a renamed snake must stay in its group)
FAMILY = {"Dipsadidae": "Colubridae", "Natricidae": "Colubridae", "Dipsadinae": "Colubridae", "Pseudoxenodontidae": "Colubridae",
          "Pseudoxyrhophiidae": "Lamprophiidae", "Atractaspididae": "Lamprophiidae", "Psammophiidae": "Lamprophiidae",
          "Prosymnidae": "Lamprophiidae", "Pseudaspididae": "Lamprophiidae", "Pareatidae": "Pareidae",
          "Xenodermatidae": "Xenodermidae", "Bolyeridae": "Bolyeriidae"}
fam = lambda f: FAMILY.get(f, f)

# the documented smaller-than-a-state ranges of snakes people brought somewhere (natural outlines, lon/lat,
# cut to the land afterwards so the coast is the real coast)
PART = {
    # Burmese python: breeding across South Florida - from around Lake Okeechobee's south shore through Big
    # Cypress, the Everglades and the mainland of Collier, Monroe and Miami-Dade to Key Largo (USGS NAS
    # Python bivittatus fact sheet; Florida FWC). The Gulf side runs offshore so the real coast is its edge.
    ("python-bivittatus", "us:FL"): [
        (-82.25, 26.45), (-81.95, 26.62), (-81.62, 26.78), (-81.3, 26.92), (-81.02, 26.98), (-80.78, 26.93),
        (-80.56, 26.8), (-80.42, 26.58), (-80.38, 26.3), (-80.44, 26.02), (-80.47, 25.78), (-80.43, 25.55),
        (-80.33, 25.38), (-80.2, 25.27), (-80.12, 25.1), (-80.25, 24.93), (-80.55, 24.88), (-80.95, 24.95),
        (-81.35, 25.2), (-81.75, 25.55), (-82.1, 25.95), (-82.3, 26.2)],
    # Northern African python: one breeding population, in the Bird Drive Basin west of Miami (USGS NAS)
    ("python-sebae", "us:FL"): "ellipse:-80.54,25.72,0.17,0.13",
}

# ---------------------------------------------------------------------------------------------------------
def app_data():
    h = open(os.path.join(ROOT, "snakelist-synced.html"), encoding="utf-8").read()
    sp = []
    for m in re.finditer(r'<div class="card"([^>]*)>', h):
        a = dict(re.findall(r'(data-[\w-]+)="([^"]*)"', m.group(1)))
        seg = h[m.end():m.end() + 3000]
        nm = re.search(r'card-name[^>]*>([^<]*)<', seg).group(1)
        sc = re.search(r'class="card-sci( no-common)?"[^>]*>([^<]*)<', seg)
        sci = nm if sc.group(1) else sc.group(2)
        sp.append({"id": a["data-id"], "sci": sci.strip(), "family": a.get("data-family", ""),
                   "countries": [x for x in a.get("data-countries", "").split("|") if x],
                   "states": [x for x in a.get("data-states", "").split("|") if x],
                   "provinces": [x for x in a.get("data-provinces", "").split("|") if x]})
    iso = json.loads(re.search(r'var ISO = (\{.*?\});', h).group(1))
    src = re.search(r'var INVASIVE = (\{.*?\n  \});', h, re.S).group(1)
    inv = json.loads(subprocess.check_output(["node", "-e", "process.stdout.write(JSON.stringify(eval('(' + require('fs').readFileSync(0, 'utf8') + ')')))"], input=src.encode()))
    # fossil and extinct snakes have no range to show (the app offers no Show colours for them)
    gone = set(re.findall(r'"([a-z0-9-]+)":', re.search(r'const EXTINCT = (\{.*?\});', h, re.S).group(1)))
    gone |= set(re.findall(r'"([a-z0-9-]+)"', re.search(r'// prehistoric snakes known only from fossil bones\n\s*\[(.*?)\]', h, re.S).group(1)))
    gone |= set(json.loads(re.search(r'const FOSSIL_AGE = (\{.*?\});', h).group(1)))
    return [s for s in sp if s["id"] not in gone], iso, inv


def islands():
    src = open(os.path.join(ROOT, "data", "islands.js"), encoding="utf-8").read()
    X = json.loads(src[src.index("window.SL_ISLANDS=") + len("window.SL_ISLANDS="):].rstrip().rstrip(";"))
    SC = X.get("scale", 500); out = {}
    for code, f in X["c"].items():
        i = 0; x = y = 0
        while i < len(f):
            n = f[i] // 3; i += 1; pts = []
            for _ in range(n):
                x += f[i]; y += f[i + 1]; i += 2; pts.append((x / SC, y / SC))
            if n >= 3:
                g = shapely.make_valid(Polygon(pts))
                out.setdefault(code, []).extend(polys_of(g))
    return out


def geo():
    """the map's land (each country, with its small islands) and every state/province, in degrees"""
    _, G = load()
    pb = G["prebuilt"]
    land = country_land(pb["poly"], pb.get("scale", 100))
    for code, ps in islands().items():
        land[code] = shapely.union_all([land[code]] + ps) if code in land else shapely.union_all(ps)
    states = {}
    for st in G["us"]:
        states[("us", st["code"])] = state_geom(st["rings"])
    for cc, lst in G["cp"].items():
        for st in lst:
            states[(cc, st["name"])] = state_geom(st["rings"])
    for cc, (k, fs) in G["wp"].items():
        for f in fs:
            rings = []
            for flat in f[1]:
                x = y = 0; r = []
                for i in range(0, len(flat), 2):
                    x += flat[i]; y += flat[i + 1]; r.append((x / k, y / k))
                rings.append(r)
            states[(cc, f[0])] = state_geom(rings)
    return land, {k: v for k, v in states.items() if v is not None}


# ---------------------------------------------------------------------------------------------------------
W = {}   # per worker: land pieces, the land tree, countries, states


def init(land, states):
    # all the land as one shape (countries joined, so no borders inside), each landmass on its own
    allland = shapely.union_all([g.simplify(0.003, preserve_topology=True) for g in land.values()])
    pieces = polys_of(allland)
    W["pieces"] = pieces
    W["tree"] = STRtree(pieces)
    W["land"] = land
    W["states"] = states


def land_near(g, pad=0.3):
    b = g.bounds
    bb = (b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad)
    idx = W["tree"].query(box(*bb))
    # (the landmasses don't touch: each just cut to the box)
    return mp([q for i in idx for q in polys_of(shapely.clip_by_rect(W["pieces"][i], *bb))]) if len(idx) else None


def to_land(g, reach):
    """g cut to the map's land; where its edge stops just short of the coast (within reach), out to it"""
    L = land_near(g)
    if L is None: return None
    if reach:
        g = shapely.union(g, shapely.intersection(g.buffer(reach, quad_segs=4), L))
    return shapely.intersection(g, L)


def clean(g, min_part=MIN_PART):
    ps = [orient(p, 1.0) for p in polys_of(g) if p.area >= min_part]
    if not ps and polys_of(g):   # a very small range: its biggest piece all the same
        ps = [orient(max(polys_of(g), key=lambda p: p.area), 1.0)]
    return mp(ps)


def chaikin(pts, n=3):
    for _ in range(n):
        q = []
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            q.append((0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]))
            q.append((0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]))
        pts = q
    return pts


def smooth(g, r):
    """joined into one shape with rounded corners (no state lines, no sharp administrative corners)"""
    if g is None or g.is_empty: return g
    g = g.buffer(r, quad_segs=6).buffer(-r, quad_segs=6)            # pieces side by side become one
    keep = [p for p in polys_of(g) if p.area < 6 * r * r]            # small islands stay as they are
    big = mp([p for p in polys_of(g) if p.area >= 6 * r * r])
    if big is not None:
        big = big.buffer(-r * 0.7, quad_segs=6).buffer(r * 0.7, quad_segs=6)  # corners rounded
    out = []
    for p in polys_of(big) + keep:
        ext = chaikin(list(p.simplify(r * 0.15).exterior.coords)[:-1], 2)
        if len(ext) >= 3: out.append(shapely.make_valid(Polygon(ext)))
    return shapely.union_all(out) if out else None


def part_shape(spec):
    if isinstance(spec, str) and spec.startswith("ellipse:"):
        x, y, rx, ry = map(float, spec[8:].split(","))
        return Polygon([(x + rx * math.cos(a), y + ry * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 48, endpoint=False)])
    return Polygon(chaikin(spec, 3))


def main_land(g, far=12):
    """a whole country without its far-off islands (Heard Island for Australia, Hawaii for the USA...)"""
    ps = polys_of(g)
    if len(ps) < 2: return g
    big = max(ps, key=lambda p: p.area)
    return mp([p for p in ps if p.distance(big) <= far])


def places_shape(sp, iso, inv):
    """the places SnakeList records it in (and the places it was brought to)"""
    land, states = W["land"], W["states"]
    rec, whole = {}, set()
    for s in sp["states"]: rec.setdefault("us", []).append(s)
    for p in sp["provinces"]: rec.setdefault(p[:2].lower(), []).append(p[3:])
    for n in sp["countries"]:
        if iso.get(n): whole.add(iso[n])
    extra, exact = [], []   # (exact: the documented outlines, used as they are - Key Largo stays)
    for pl in inv.get(sp["id"], []):
        cc = pl.get("code")
        ks = pl.get("states") or pl.get("areas") or []
        for k in ks:
            if (sp["id"], cc + ":" + k) in PART:
                g = to_land(part_shape(PART[(sp["id"], cc + ":" + k)]), 0)
                if g is not None: exact.append(g)
            elif (cc, k) in states: extra.append(states[(cc, k)])
        if not ks and cc in land: extra.append(land[cc])
    fine, big = [], []
    for cc, ks in rec.items():
        gs = [states[(cc, k)] for k in ks if (cc, k) in states]
        if gs: fine.extend(gs)
        elif cc in land: whole.add(cc)
    for cc in whole:
        if cc in rec and any((cc, k) in states for k in rec[cc]): continue
        if cc not in land: continue
        g = main_land(land[cc]); b = g.bounds
        if fine and (b[2] - b[0]) * (b[3] - b[1]) >= BIG: big.append(g)
        else: fine.append(g)
    core = shapely.union_all(fine) if fine else None
    if big and core is not None:
        near = core.buffer(NEAR_DEG, quad_segs=8)
        fine = fine + [shapely.intersection(g, near) for g in big]
    elif big:
        fine = fine + big
    if not fine and not extra and not exact: return None, None, None
    g = shapely.union_all(fine) if fine else None
    return g, (shapely.union_all(extra) if extra else None), (shapely.union_all(exact) if exact else None)


def gard_shape(rd, i):
    s = rd.shape(i)
    pts, parts = s.points, list(s.parts) + [len(s.points)]
    rings = [pts[parts[j]:parts[j + 1]] for j in range(len(parts) - 1)]
    g = None
    for r in rings:
        if len(r) < 4: continue
        p = shapely.make_valid(Polygon(r))
        g = p if g is None else shapely.symmetric_difference(g, p)
    return g


# ---------------------------------------------------------------------------------------------------------
def q_ring(coords):
    out = []
    for x, y in coords:
        p = (int(round(x * K)), int(round(y * K)))
        if not out or out[-1] != p: out.append(p)
    while len(out) > 1 and out[0] == out[-1]: out.pop()
    return out


def flat(pts):
    f = [pts[0][0], pts[0][1]]
    for i in range(1, len(pts)):
        f += [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]
    return f


def run_len(f):
    x, y, d = f[0], f[1], 0
    for i in range(2, len(f), 2): d += math.hypot(f[i], f[i + 1])
    return d / K


def encode(g, src):
    L = land_near(g, 0.5)
    from shapely import prepare
    LB = None
    if L is not None: prepare(L); LB = L.boundary; prepare(LB)
    polys, edges = [], []
    big = max(polys_of(g), key=lambda p: p.area)
    t = big.exterior.distance(polylabel(big, 0.02)) if big.area > 0.01 else 0
    for p in polys_of(g):
        p = orient(p, 1.0)
        # how deep this piece goes (the darker middle of a small piece is as small as the piece)
        tp = p.exterior.distance(polylabel(p, max(0.005, math.sqrt(p.area) / 60))) if p.area > 0.0004 else 0
        rings = []
        for ring in [p.exterior] + list(p.interiors):
            r = q_ring(ring.coords)
            if len(r) < 3: continue
            rings.append(flat(r))
            # which steps of the outline are NOT on the coast: a point just outside the range there is land
            n = len(r); pts = r + [r[0]]
            mx = np.array([(pts[j][0] + pts[j + 1][0]) / 2 / K for j in range(n)])
            my = np.array([(pts[j][1] + pts[j + 1][1]) / 2 / K for j in range(n)])
            dx = np.array([(pts[j + 1][0] - pts[j][0]) / K for j in range(n)])
            dy = np.array([(pts[j + 1][1] - pts[j][1]) / K for j in range(n)])
            ln = np.maximum(np.hypot(dx, dy), 1e-9)
            nx, ny = dy / ln, -dx / ln                    # (outward: to the right of a ring running the right way)
            # (both a little and a bit further out on land: across a narrow bay or estuary is still the coast)
            inland = np.zeros(n, bool)
            if L is not None:
                inland = shapely.contains_xy(L, mx + nx * 0.04, my + ny * 0.04) & shapely.contains_xy(L, mx + nx * 0.12, my + ny * 0.12)
                if inland.any():   # (and not right by the shore: the inside of an estuary is coast too)
                    inland &= ~shapely.dwithin(LB, shapely.points(mx, my), 0.06)
            # runs of inland steps (step j goes from point j to j+1)
            if inland.all():
                edges.append((flat(pts), tp))
            elif inland.any():
                s0 = int(np.argmin(inland))           # start just after a coast step, so no run wraps
                run = []
                for jj in range(1, n + 1):
                    j = (s0 + jj) % n
                    if inland[j]:
                        if not run: run = [pts[j]]
                        run.append(pts[j + 1])
                    elif run:
                        edges.append((flat(run), tp)); run = []
                if run: edges.append((flat(run), tp))
        if rings: polys.append(rings)
    b = list(g.bounds)
    if b[0] < -170 and b[2] > 170:  # across the date line: the box of its biggest part
        b = list(big.bounds)
    # short bits between two stretches of coast (a river mouth, a bay) are not where it stops living
    edges = [e for e in edges if run_len(e[0]) >= min(0.4, max(0.15, 0.3 * e[1])) and e[1] > 0]
    return {"s": src, "k": K, "b": [round(b[0], 2), round(b[2], 2), round(b[1], 2), round(b[3], 2)],
            "t": round(t, 2), "p": polys, "e": [e[0] for e in edges], "et": [round(e[1], 2) for e in edges]}


def decode(d):
    """a range file back to a geometry"""
    k = d.get("k", K); ps = []
    for rings in d["p"]:
        rs = []
        for f in rings:
            x = y = 0; r = []
            for i in range(0, len(f), 2):
                x += f[i]; y += f[i + 1]; r.append((x / k, y / k))
            if len(set(r)) >= 3: rs.append(r)
        if rs: ps.append(Polygon(rs[0], rs[1:]))
    return shapely.make_valid(MultiPolygon(ps)) if len(ps) > 1 else shapely.make_valid(ps[0])


def retouch(path):
    """a file written before: its shading worked out again (the outline is kept as it is)"""
    try:
        d = json.load(open(path))
        g = clean(decode(d), 0)
        s = json.dumps(encode(g, d["s"]), separators=(",", ":"))
        with open(path, "w") as f: f.write(s)
        return path, d["s"], len(s)
    except Exception as e:
        return path, None, "error " + repr(e)


def codes_of(sp, iso, inv=None):
    cs = set(iso[n] for n in sp["countries"] if n in iso) | set(p[:2].lower() for p in sp["provinces"])
    if sp["states"]: cs.add("us")
    if inv: cs |= set(pl.get("code") for pl in inv.get(sp["id"], []))
    return cs


def split_check(sp, g, iso, inv, sibs):
    """A GARD range mostly outside the countries SnakeList records the snake in is usually right (SnakeList's
    country list is short) - but where a newer species split off from it lives there (a snake of the same
    genus that GARD doesn't have, recorded in those countries), GARD's map still holds both: it is cut to
    this snake's own countries."""
    rec = [W["land"][c] for c in codes_of(sp, iso, inv) if c in W["land"]]
    if not rec: return g
    R = shapely.union_all([x.simplify(0.05) for x in rec]).buffer(0.3)
    frac = shapely.intersection(g, R).area / g.area
    if frac >= 0.6: return g
    out = shapely.difference(g, R)
    for cs in sibs:
        S = [W["land"][c].simplify(0.05) for c in cs if c in W["land"]]
        if not S: continue
        S = shapely.union_all(S); both = shapely.intersection(out, S).area
        # (the relative lives mostly where GARD's map goes past this snake's countries, and fills much of it)
        if frac < 0.3 and both > 0.6 * S.area and both > 0.25 * out.area:
            cut = clean(shapely.make_valid(shapely.intersection(g, shapely.union_all(rec))))
            print("  split:", sp["id"], "GARD range cut to its own countries (%.0f%% was in them)" % (frac * 100), flush=True)
            return cut if cut is not None else g
    print("  check:", sp["id"], "only %.0f%% of its GARD range is in its countries (kept: no split-off relative there)" % (frac * 100), flush=True)
    return g


def build(job):
    sp, gi, iso, inv, gdir, sibs = job
    try:
        src = None; g = None
        if gi is not None:
            rd = shapefile.Reader(shp=open(os.path.join(gdir, "Gard_1_7_ranges.shp"), "rb"), shx=open(os.path.join(gdir, "Gard_1_7_ranges.shx"), "rb"), dbf=open(os.path.join(gdir, "Gard_1_7_ranges.dbf"), "rb"))
            g = gard_shape(rd, gi)
            if g is not None and not g.is_empty:
                g = shapely.make_valid(g.simplify(SIMPLIFY, preserve_topology=True))
                g = to_land(g, COAST_REACH)
                if g is not None:
                    g = g.simplify(LAND_SIMPLIFY, preserve_topology=True)
                    g = clean(shapely.make_valid(g)); src = "g"
            if g is not None:
                g = split_check(sp, g, iso, inv, sibs)
            extra, exact = places_shape(sp, iso, inv)[1:] if inv.get(sp["id"]) else (None, None)
        if g is None:
            base, extra, exact = places_shape(sp, iso, inv)
            if base is not None:
                base = base.simplify(0.02, preserve_topology=True)
                b = base.bounds; size = max(b[2] - b[0], b[3] - b[1])
                g = to_land(smooth(base, min(0.35, max(0.06, size * 0.03))), 0)
                if g is not None: g = clean(shapely.make_valid(g.simplify(LAND_SIMPLIFY, preserve_topology=True)), MIN_PART / 4); src = "f"
        if extra is not None and not extra.is_empty:
            ex = extra.simplify(0.02, preserve_topology=True)
            ex = to_land(smooth(ex, 0.08), 0)
            if ex is not None:
                ex = clean(shapely.make_valid(ex.simplify(LAND_SIMPLIFY, preserve_topology=True)), MIN_PART / 4)
                if ex is not None:
                    g = ex if g is None else clean(shapely.make_valid(shapely.union(g, ex)), MIN_PART / 4)
                    src = src or "f"
        if exact is not None and not exact.is_empty:
            ex = clean(shapely.make_valid(exact.simplify(0.005, preserve_topology=True)), 0)
            if ex is not None:
                g = ex if g is None else clean(shapely.make_valid(shapely.union(g, ex)), 0)
                src = src or "f"
        if g is None or g.is_empty: return sp["id"], None, "empty"
        d = encode(g, src)
        s = json.dumps(d, separators=(",", ":"))
        with open(os.path.join(OUT, sp["id"] + ".json"), "w") as f: f.write(s)
        return sp["id"], src, len(s)
    except Exception as e:
        return sp["id"], None, "error " + repr(e)


# ---------------------------------------------------------------------------------------------------------
def stem(ep):
    for suf in ("us", "um", "a", "is", "e", "i"):
        if ep.endswith(suf) and len(ep) > len(suf) + 3: return ep[:-len(suf)]
    return ep


def match(species, gdir, iso, land):
    rd = shapefile.Reader(dbf=open(os.path.join(gdir, "Gard_1_7_ranges.dbf"), "rb"))
    recs = rd.records()
    by = {r[0].strip(): i for i, r in enumerate(recs)}
    snakes = [i for i, r in enumerate(recs) if r[2] == "snake"]
    by_stem = {}
    for i in snakes:
        by_stem.setdefault(stem(recs[i][0].split()[-1]), []).append(i)
    full = shapefile.Reader(shp=open(os.path.join(gdir, "Gard_1_7_ranges.shp"), "rb"), shx=open(os.path.join(gdir, "Gard_1_7_ranges.shx"), "rb"), dbf=open(os.path.join(gdir, "Gard_1_7_ranges.dbf"), "rb"))
    out, how = {}, {}
    taken = set(by.get(s["sci"]) for s in species if s["sci"] in by)

    def inside(sp, i):
        """how much of the GARD range lies in (or near) the countries SnakeList records it in"""
        cs = set(iso[n] for n in sp["countries"] if n in iso) | set(p[:2].lower() for p in sp["provinces"])
        if sp["states"]: cs.add("us")
        rec = [land[c] for c in cs if c in land]
        if not rec: return 0
        g = gard_shape(full, i)
        if g is None or g.is_empty or g.area == 0: return 0
        g = g.simplify(0.1)
        R = shapely.union_all([r.simplify(0.05) for r in rec]).buffer(0.5)
        return shapely.intersection(g, R).area / max(g.area, 1e-9)

    for sp in species:
        sci = sp["sci"]
        if sci in SYNONYMS:
            if SYNONYMS[sci] and SYNONYMS[sci] in by: out[sp["id"]] = by[SYNONYMS[sci]]; how[sp["id"]] = "synonym " + SYNONYMS[sci]
            continue
        if sci in by:
            out[sp["id"]] = by[sci]; how[sp["id"]] = "exact"; continue
        ep = sci.split()[-1]
        cands = [i for i in by_stem.get(stem(ep), []) if i not in taken and (not sp["family"] or fam(recs[i][3]) == fam(sp["family"]))]
        best = None
        for i in cands:
            f = inside(sp, i)
            if f >= 0.7 and (best is None or f > best[1]): best = (i, f)
        if best:
            out[sp["id"]] = best[0]; how[sp["id"]] = "renamed " + recs[best[0]][0] + " (%.0f%% in its countries)" % (best[1] * 100)
    return out, how


def main():
    gdir = sys.argv[1]
    only = set(sys.argv[2:])
    if "--retouch" in only:
        land, states = geo(); init(land, states)
        paths = [os.path.join(OUT, f) for f in sorted(os.listdir(OUT))]
        with Pool(os.cpu_count()) as pool:
            for n, (pth, src, r) in enumerate(pool.imap_unordered(retouch, paths, chunksize=8)):
                if src is None: print("  ", pth, r)
                if n % 500 == 0: print(" ", n, "/", len(paths), flush=True)
        return
    species, iso, inv = app_data()
    print(len(species), "species")
    land, states = geo()
    print(len(land), "countries,", len(states), "states/provinces")
    os.makedirs(OUT, exist_ok=True)
    gi, how = match(species, gdir, iso, land)
    with open(os.path.join(ROOT, "tools", "ranges-matches.json"), "w") as f:
        json.dump({k: how[k] for k in sorted(how) if how[k] != "exact"}, f, indent=0, sort_keys=True)
    print(len(gi), "matched to GARD (", sum(1 for v in how.values() if v != "exact"), "under another name )")
    # (--resume: the ones already written are kept)
    resume = "--resume" in only; only.discard("--resume")
    sibs = {}
    for s in species:   # the snakes GARD doesn't have, by genus (newer species, often split from an older one)
        if s["id"] not in gi: sibs.setdefault(s["sci"].split()[0], []).append(codes_of(s, iso))
    jobs = [(s, gi.get(s["id"]), iso, inv, gdir, sibs.get(s["sci"].split()[0], [])) for s in species if (not only or s["id"] in only)
            and not (resume and os.path.exists(os.path.join(OUT, s["id"] + ".json")))]
    stats = {"g": 0, "f": 0, None: 0}; total = 0
    init(land, states)            # (the workers are forked: they share these)
    with Pool(os.cpu_count()) as pool:
        for n, (sid, src, r) in enumerate(pool.imap_unordered(build, jobs, chunksize=4)):
            stats[src] += 1
            if src is None: print("  no range:", sid, r)
            else: total += r
            if n % 250 == 0: print(" ", n, "/", len(jobs), flush=True)
    print("GARD:", stats["g"], " from SnakeList's places:", stats["f"], " none:", stats[None], " total %.1f MB" % (total / 1e6))


if __name__ == "__main__":
    main()
