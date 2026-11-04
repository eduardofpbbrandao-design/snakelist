"""One page per snake species (species/<id>.html), an A-Z index (species/index.html), the shared
world map they colour in (species/world.svg) and their style/script - all generated from the app
file, so the pages always match the checklist. Called by build-site.py.
"""
import json, re, html as H, os, base64, unicodedata

SITE = "https://snakelist.com/"
OUT = "species"
AUTHOR = "Eduardo Brandao"


def slugify(t):
    """the same as the app's SL_SLUG: plain letters and digits joined by dashes"""
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def page_name(c):
    """species/<common-name>-<scientific-name>, or just the scientific name when there is no common one"""
    n = slugify(c["name"]) if not c["is_sci"] else ""
    return (n + "-" + c["id"]) if n and n != c["id"] else c["id"]


REDIRECT = """<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{name}</title><meta name="robots" content="noindex">
<link rel="canonical" href="{url}"><meta http-equiv="refresh" content="0; url={page}">
<script>location.replace("{page}" + location.search + location.hash)</script></head><body><a href="{page}">{name}</a></body></html>
"""


APP = [""]
CITIES = {}


def build(app):
    APP[0] = app
    # the app's big-city list; only cities that name their state can be placed in a snake's range
    CITIES.clear()
    for ct in json.loads(re.search(r"window\.SL_CITIES = (\[.*?\]);\n", app, re.S).group(1)):
        if len(ct) > 4 and ":" in ct[4]:
            cc, _, st = ct[4].partition(":"); CITIES.setdefault(cc.lower(), []).append((ct[0], ct[1], st, ct[2], ct[3]))
    os.makedirs(OUT, exist_ok=True)
    jget = lambda i: json.loads(re.search(r'<script type="application/json" id="%s">(.*?)</script>' % i, app, re.S).group(1))
    photos = jget("photo-index")
    rarity = jget("rarity-data")
    hab = jget("habitat-data")
    iso = json.loads(re.search(r"var ISO = (\{.*?\});", app).group(1))
    extinct = dict(re.findall(r'"([a-z0-9-]+)": "((?:Extinct|Possibly extinct)[^"]*)"', app.split("const EXTINCT = ", 1)[1].split("};", 1)[0]))
    fossils = set(re.findall(r'"([a-z0-9-]+)"', app.split("// prehistoric snakes known only from fossil bones", 1)[1].split("]", 1)[0]))
    eaters = set(re.findall(r'"([A-Z][a-z]+)"', app.split("const SNAKE_EATERS = new Set([", 1)[1].split("]", 1)[0]))
    intro = {}
    for m in re.finditer(r'"([a-z0-9-]+)":\s*\[(\{ area: [^\]]*)\]', app.split("var INTRODUCED = {", 1)[1].split("};", 1)[0]):
        intro[m.group(1)] = re.findall(r'area: "([^"]*)"', m.group(2))
    # habitats: one bit per card, in card order
    hab_names, hab_bits = [], []
    for sec in hab["sections"]:
        for h in sec[1]:
            hab_names.append(h[0]); hab_bits.append(base64.b64decode(h[1]))

    cards = []
    for k, m in enumerate(re.finditer(r'<div class="card" (data-id="[^"]*"[^>]*)>(.*?)<div class="card-bottom">', app, re.S)):
        a = dict(re.findall(r'data-([a-z-]+)="([^"]*)"', m.group(1)))
        body = m.group(2)
        nm = re.search(r'<div class="card-name( is-sci)?">(.*?)</div>', body)
        sci = re.search(r'<div class="card-sci">(.*?)</div>', body)
        tags = [re.sub(r"<[^>]+>", "", t).strip() for t in re.findall(r'<span class="tag[^"]*">(.*?)</span>', body)]
        fam = next((t for t in tags if t.endswith("idae")), "")
        c = {
            "id": a["id"], "k": k, "name": H.unescape(nm.group(2)), "is_sci": bool(nm.group(1)),
            "sci": H.unescape(sci.group(1)) if sci else "", "type": a.get("type", ""), "family": fam,
            "continents": [x for x in a.get("continents", "").split("|") if x],
            "countries": [x for x in a.get("countries", "").split("|") if x],
            "provinces": [x for x in H.unescape(a.get("provinces", "")).split("|") if x],
            "states": [x for x in a.get("states", "").split("|") if x],
            "venom": a.get("venomous") == "1", "popular": a.get("popular") == "1", "invasive": H.unescape(a.get("invasive", "")),
        }
        if c["is_sci"]: c["sci"] = c["name"]
        c["genus"] = c["sci"].split(" ")[0] if c["sci"] else ""
        c["habitats"] = [hab_names[n] for n, b in enumerate(hab_bits) if k < hab["n"] and b[k >> 3] & (1 << (k & 7))]
        c["spots"] = rarity.get(c["id"], 0)
        c["extinct"] = extinct.get(c["id"], "")
        c["fossil"] = c["id"] in fossils
        c["eater"] = c["genus"] in eaters or bool(re.search(r"snake[- ]?eater", a.get("name", ""), re.I))
        c["intro"] = intro.get(c["id"], [])
        c["photo"] = photos["items"].get(c["id"])
        cards.append(c)
    by_genus, by_family = {}, {}
    for c in cards:
        by_genus.setdefault(c["genus"], []).append(c); by_family.setdefault(c["family"], []).append(c)

    # introduced / invasive populations: the app's INVASIVE table (with the world map's code for
    # each place), plus the INTRODUCED points (lon/lat) for places too small to have a shape
    invasive = {}
    for m in re.finditer(r'"([a-z0-9-]+)":\s*\[(\{[^\]]*?(?:\[[^\]]*\][^\]]*?)*)\]', app.split("var INVASIVE = {", 1)[1].split("};", 1)[0]):
        for o in re.findall(r"\{([^{}]*)\}", m.group(2)):
            g = lambda k: (re.search(k + r':\s*"([^"]*)"', o) or [None, ""])[1]
            st = re.search(r"states:\s*\[([^\]]*)\]", o)  # US state codes, or province names elsewhere
            ar = re.search(r"areas:\s*\[([^\]]*)\]", o)  # the provinces/islands it was brought to (shown by "See precise area")
            invasive.setdefault(m.group(1), []).append({"name": g("name"), "code": g("code"), "note": g("note"),
                                                        "states": re.findall(r'"([^"]*)"', st.group(1)) if st else [],
                                                        "areas": re.findall(r'"([^"]*)"', ar.group(1)) if ar else []})
    intro_ll = {}
    for m in re.finditer(r'area: "([^"]*)", lon: (-?[\d.]+), lat: (-?[\d.]+)', app.split("var INTRODUCED = {", 1)[1].split("};", 1)[0]):
        intro_ll[m.group(1)] = (float(m.group(2)), float(m.group(3)))

    paths, boxes, region = world_map(OUT + "/world.svg")

    open(OUT + "/sp.css", "w").write(CSS)
    open(OUT + "/sp.js", "w").write(JS)
    return pages(cards, by_genus, by_family, photos, iso, hab_names, invasive, intro_ll, paths, boxes, region)


def world_map(out):
    """species/world.svg: one path per country (id c-<iso code>) from the app's Natural Earth
    1:10m outlines, equirectangular x = (lon+180)*4, y = (90-lat)*4 in a 1440x720 box (the app's
    camera place-picker loads the same file, so keep the ids and projection). The full-detail
    rings are simplified (Douglas-Peucker, 0.1 map units = 0.025 degrees, well under a pixel at
    12x zoom) and written as relative moves in tenths of a unit. Returns the path codes and, per
    country, the box of its largest piece (for fitting a species' range)."""
    src = open("data/geo.js", encoding="utf-8").read().split("window.SL_GEO=", 1)[1]
    js = re.sub(r'([{,])(prebuilt|wp|cp|us):', r'\1"\2":', src.rstrip().rstrip(';'), count=4)
    G = json.loads(js); P = G["prebuilt"]; SC = P["scale"]
    TOL = 0.1

    def ring_xy(lons, lats):
        return [((lo + 180) * 4, (90 - la) * 4) for lo, la in zip(lons, lats)]

    def simplify(pts):
        """Douglas-Peucker on a closed ring (split in two halves so the ends stay put)."""
        def dp(p):
            n = len(p)
            if n < 3: return p
            keep = [False] * n; keep[0] = keep[-1] = True; st = [(0, n - 1)]; t2 = TOL * TOL
            while st:
                a, b = st.pop(); ax, ay = p[a]; bx, by = p[b]; dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
                best, bi = -1, -1
                for i in range(a + 1, b):
                    px, py = p[i]
                    if L == 0: d = (px - ax) ** 2 + (py - ay) ** 2
                    else:
                        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
                        d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
                    if d > best: best, bi = d, i
                if best > t2: keep[bi] = True; st.append((a, bi)); st.append((bi, b))
            return [q for q, k in zip(p, keep) if k]
        m = len(pts) // 2
        return dp(pts[:m + 1])[:-1] + dp(pts[m:])

    def num(n):  # n in tenths of a unit -> shortest SVG number
        s = "-" if n < 0 else ""; n = abs(n)
        return s + (str(n // 10) if n % 10 == 0 else (str(n // 10) if n >= 10 else "") + "." + str(n % 10))

    def path_d(pts):
        q = []
        for x, y in pts:
            p = (round(x * 10), round(y * 10))
            if not q or p != q[-1]: q.append(p)
        if len(q) > 1 and q[-1] == q[0]: q.pop()
        if len(q) < 3: return ""
        toks = [num(q[0][0]), num(q[0][1])]
        out = "M" + join(toks) + "l"
        rel = []
        for a, b in zip(q, q[1:]): rel += [num(b[0] - a[0]), num(b[1] - a[1])]
        return out + join(rel) + "z"

    def join(toks):
        s, prev = "", ""
        for t in toks:
            if prev and not (t[0] == "-" or (t[0] == "." and "." in prev)): s += " "
            s += t; prev = t
        return s

    paths, boxes = {}, {}
    def add(code, pts, track=True):
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        bw, bh = max(xs) - min(xs), max(ys) - min(ys)
        # sub-pixel specks (even at full zoom) next to a bigger piece of the same country
        if bw < 0.3 and bh < 0.3 and code in paths: return
        d = path_d(simplify(pts)) or (path_d(pts) if code not in paths else "")
        if not d and code not in paths:  # smaller than the grid: a tiny diamond where it is
            cx, cy = round(sum(xs) / len(xs), 1), round(sum(ys) / len(ys), 1)
            d = path_d([(cx, cy - .1), (cx + .1, cy), (cx, cy + .1), (cx - .1, cy)])
        if not d: return
        paths.setdefault(code, []).append(d)
        if track:
            area = bw * bh / 16  # in square degrees
            if area > boxes.get(code, (-1,))[0]:
                boxes[code] = (area, min(xs) / 4 - 180, max(xs) / 4 - 180, 90 - max(ys) / 4, 90 - min(ys) / 4)

    kuril = []
    for r in P["poly"]:
        if r[1] or not isinstance(r[2], list) or len(r[2]) < 3: continue
        lons, lats, x, y = [], [], 0, 0
        for dx, dy in zip(r[2], r[3]):
            x += dx; y += dy; lons.append(x / SC); lats.append(y / SC)
        pts = ring_xy(lons, lats)
        add(r[0], pts)
        # the Southern Kuril Islands (a "country" in the app's list) are Russian islands here
        if r[0] == "ru" and 145.3 <= min(lons) and max(lons) <= 149.2 and 43.2 <= min(lats) and max(lats) <= 45.7: kuril.append(pts)
    # Crimea is drawn inside Russia's outline in this Natural Earth edition: its own shape comes
    # from the province outlines (Crimea + Sevastopol), drawn on top, so it can be coloured alone
    wsc, crimea = G["wp"]["ru"][0], []
    for nm, rings in G["wp"]["ru"][1]:
        if nm in ("Autonomous Republic of Crimea", "Sevastopol"):
            for rg in rings:
                x, y, lons, lats = rg[0], rg[1], [rg[0] / wsc], [rg[1] / wsc]
                for i in range(2, len(rg) - 1, 2):
                    x += rg[i]; y += rg[i + 1]; lons.append(x / wsc); lats.append(y / wsc)
                crimea.append(ring_xy(lons, lats))
    for code, rings in (("xq", crimea), ("xr", kuril)):
        for pts in rings: add(code, pts)
    overlay = {"xq", "xr"}
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 720">']
    for code, ps in sorted(paths.items(), key=lambda kv: kv[0] in overlay):
        # the overlays sit on top of Russia; taps on the app's picker go through to Russia itself
        svg.append('<path id="c-%s"%s d="%s"/>' % (code, ' pointer-events="none"' if code in overlay else "", "".join(ps)))
    svg.append("</svg>")
    open(out, "w").write("".join(svg))

    def region(cc, names):
        """The outline of some states/provinces of one country - only the few introduced areas
        need these, so they go inline in their species' pages, not in world.svg. US states come
        from SL_GEO.us (by code or name), elsewhere from the app's admin-1 data SL_GEO.wp/cp.
        Returns (path data, (w, e, s, n) in degrees) or None."""
        want = {n.lower() for n in names}; rings = []
        if cc == "us":
            for st in G["us"]:
                if st["code"].lower() in want or st["name"].lower() in want: rings += st["rings"]
        else:
            src = G["wp"].get(cc) or G["cp"].get(cc)
            if src and isinstance(src, list) and len(src) == 2:
                k = src[0]
                for nm, rr in src[1]:
                    if re.sub(r" \(\d+\)$", "", nm).lower() in want:
                        for flat in rr:
                            x = y = 0; ring = []
                            for i in range(0, len(flat) - 1, 2):
                                x += flat[i]; y += flat[i + 1]; ring.append([x / k, y / k])
                            rings.append(ring)
        ds, lons, lats = [], [], []
        for ring in rings:
            if len(ring) < 3: continue
            d = path_d(simplify(ring_xy([p[0] for p in ring], [p[1] for p in ring])))
            if d: ds.append(d)
            # the fit uses only pieces of some size (not every key off Florida)
            xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
            if (max(xs) - min(xs)) * (max(ys) - min(ys)) > 0.05 or not lons: lons += xs; lats += ys
        return ("".join(ds), (min(lons), max(lons), min(lats), max(lats))) if ds else None

    prov_cache = {}
    def provinces(cc):
        """Every state/province (or, for Indonesia, island) of one country, for the "See states"
        button: {name: {"d": path data, "also": group names it also answers to (ID:Nusa Tenggara),
        "box": (w, e, s, n) of its sizeable pieces}}. US states are keyed by code, like the cards'
        data-states; elsewhere by the names the cards' data-provinces use (the app's SL_GEO.cp
        first, then the Natural Earth admin-1 shapes in SL_GEO.wp), simplified like world.svg."""
        if cc in prov_cache: return prov_cache[cc]
        items = []
        if cc == "us":
            items = [(st["code"], st["rings"], []) for st in G["us"]]
        elif isinstance(G["cp"].get(cc), list):
            items = [(st["name"], st["rings"], st.get("also") or []) for st in G["cp"][cc]]
        elif isinstance(G["wp"].get(cc), list) and len(G["wp"][cc]) == 2:
            k = G["wp"][cc][0]
            for nm, rr in G["wp"][cc][1]:
                rings = []
                for flat in rr:
                    x = y = 0; ring = []
                    for i in range(0, len(flat) - 1, 2):
                        x += flat[i]; y += flat[i + 1]; ring.append([x / k, y / k])
                    rings.append(ring)
                items.append((nm, rings, []))  # "Toamasina (3)": its own shape, named so in data-provinces too
        out = {}
        for nm, rings, also in items:
            e = out.setdefault(nm, {"d": "", "also": set(), "box": None, "ll": []})
            e["also"].update(also)
            for ring in rings:
                if len(ring) < 3: continue
                pts = ring_xy([p[0] for p in ring], [p[1] for p in ring])
                d = path_d(simplify(pts)) or path_d(pts)
                if d: e["d"] += d
                xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
                if (max(xs) - min(xs)) * (max(ys) - min(ys)) > 0.05 or not e["ll"]: e["ll"].append((min(xs), max(xs), min(ys), max(ys)))
        for nm in list(out):
            e = out[nm]
            if not e["d"]: del out[nm]; continue
            L = e.pop("ll"); e["box"] = (min(b[0] for b in L), max(b[1] for b in L), min(b[2] for b in L), max(b[3] for b in L))
        prov_cache[cc] = out
        return out
    region.provinces = provinces
    region.us_names = {st["code"]: st["name"] for st in G["us"]}

    return set(paths), boxes, region


def pages(cards, by_genus, by_family, photos, iso, hab_names, invasive, intro_ll, paths, boxes, region):
    from urllib.parse import quote

    def esc(t): return H.escape(str(t), quote=True)
    def plist(L, n=6):
        L = list(L)
        return ", ".join(L) if len(L) <= n else ", ".join(L[:n]) + " and %d more" % (len(L) - n)
    def img_of(c, size="medium"):
        p = c["photo"]
        if not p or len(p) < 5 or "Illustration" in p[2]: return None
        pid, ext = p[4].split(".")
        return "https://inaturalist-open-data.s3.amazonaws.com/photos/%s/%s.%s" % (pid, size, ext)
    def sprite(c):
        p = c["photo"]
        if not p: return ""
        col, row = p[1] % photos["cols"], p[1] // photos["cols"]
        return "background-image:url(../%s);background-size:%d%% %d%%;background-position:%.4g%% %.4g%%" % (
            photos["path"].replace("%d", str(p[0])), photos["cols"] * 100, photos["rows"] * 100,
            col / (photos["cols"] - 1) * 100, row / (photos["rows"] - 1) * 100)
    def kind(c):
        t = {"Other": "snake", "Pit Viper": "pit viper", "Sea Snake": "sea snake", "Watersnake": "water snake"}.get(c["type"], c["type"].lower())
        return t if t.endswith("snake") or t in ("pit viper",) else t
    def rarity_txt(c):
        if c["extinct"] or c["fossil"]: return ""
        n = c["spots"]
        if n >= 75: return "Common - recorded in %d places on iNaturalist" % n
        if n <= 2: return "Rare - " + ("recorded in only %d place%s on iNaturalist" % (n, "s" if n > 1 else "") if n else "no confirmed iNaturalist sightings")
        return "Recorded in %d places on iNaturalist" % n

    def view_of(bx):
        """the map's starting view (an SVG viewBox) around some (_, w, e, s, n) boxes in degrees"""
        if not bx: return None
        w, e = min(b[1] for b in bx), max(b[2] for b in bx); s, nn = min(b[3] for b in bx), max(b[4] for b in bx)
        padx, pady = max(8, (e - w) * 0.25), max(6, (nn - s) * 0.25)
        w, e, s, nn = max(-180, w - padx), min(180, e + padx), max(-60, s - pady), min(85, nn + pady)
        if (e - w) < (nn - s) * 1.6: mid = (w + e) / 2; half = (nn - s) * 0.8; w, e = max(-180, mid - half), min(180, mid + half)
        return "%.0f %.0f %.0f %.0f" % ((w + 180) * 4, (90 - nn) * 4, (e - w) * 4, (nn - s) * 4)
    CLIP = 10  # long lists show this many, then a "See all" button (the rest stay in the HTML)
    def clipped(n): return n > CLIP + 2  # never hide just one or two
    def xcls(i, n): return ' class="sp-x"' if i >= CLIP and clipped(n) else ""
    def see_all(what, n):
        return ('<button type="button" class="sp-all" aria-expanded="false" data-all="See all %s (%d)">See all %s (%d)</button>' % (what, n, what, n)) if clipped(n) else ""
    code_name = {v: k for k, v in iso.items()}
    prov_used = set()
    HARM = json.loads(re.search(r'<script type="application/json" id="harm-data">(.*?)</script>', APP[0], re.S).group(1))["harmful"]
    def harm(c):
        """the app's #harm-data: dangerous to people, harmless, or not documented (mild rear-fanged venom)"""
        if (c["venom"] and c["family"] in HARM["venomousFamilies"]) or c["genus"] in HARM["genera"] or c["id"] in HARM["species"]: return "harmful"
        return "harmless" if not c["venom"] else ""
    CONS = json.loads(re.search(r'<script type="application/json" id="constrictor-data">(.*?)</script>', APP[0], re.S).group(1))
    def constriction(c):
        if c["genus"] in CONS["constrictor"]["genera"] or c["family"] in CONS["constrictor"]["families"] or c["type"] in ("Boa", "Python"): return "yes"
        if c["genus"] in CONS["nonconstrictor"]["genera"] or c["family"] in CONS["nonconstrictor"]["families"]: return "no"
        return "unknown"
    # how many species live in each state/province (by the cards' own names), for "See precise area"
    def st_row(cc, cname, names, what):
        items = []
        for n in sorted(dict.fromkeys(names), key=lambda t: slugify(region.us_names.get(t, t) if cc == "us" else t)):
            shown = region.us_names.get(n, n) if cc == "us" else re.sub(r" \(\d+\)$", "", n)
            k = prov_count(cc, [n])
            items.append('<a href="../?map=%s">%s</a>%s' % (esc(quote(shown)), esc(shown), (' <small class="sp-n">%d species</small>' % k) if k else ""))
        return "<li><b>%s%s:</b> %s</li>" % (esc(cname), what, ", ".join(items))
    PROV_N = {}
    for c in cards:
        for pkey in c["provinces"]:
            cc, _, pn = pkey.partition(":"); PROV_N.setdefault(cc.lower(), {}).setdefault(pn, set()).add(c["id"])
        for stc in c["states"] or []: PROV_N.setdefault("us", {}).setdefault(stc, set()).add(c["id"])
    def prov_count(cc, names):
        ids = set()
        for n in names: ids |= PROV_N.get(cc, {}).get(n, set())
        return len(ids)
    links = []
    for c in cards:
        nm, sci = c["name"], c["sci"]
        label = nm if c["is_sci"] else "%s (%s)" % (nm, sci)
        where = plist(c["countries"], 5) if c["countries"] else ""
        venom = "venomous" if c["venom"] else "non-venomous"
        if c["fossil"]:
            lead = "%s is a prehistoric snake known only from fossils%s." % (label, " of the family %s" % c["family"] if c["family"] else "")
        else:
            lead = "%s is a %s %s%s%s." % (label, venom, kind(c), " of the family %s" % c["family"] if c["family"] else "",
                                           (", found in " + where) if where else "")
        extra = []
        if c["extinct"]: extra.append(c["extinct"].replace(" - ", ": ", 1) + ".")
        if c["eater"]: extra.append("It is known to eat other snakes.")
        if c["invasive"] or c["intro"]: extra.append("It is also invasive outside its native range (%s)." % (c["invasive"] or ", ".join(c["intro"])))
        if c["habitats"]: extra.append("It lives in habitats such as %s." % plist([h.lower() for h in c["habitats"]], 4))
        rt = rarity_txt(c)
        if rt: extra.append(rt.split(" - ")[0] + ": " + rt.split(" - ", 1)[1] + "." if " - " in rt else rt + ".")
        about = lead + " " + " ".join(extra)
        title = ("%s - %s" % (nm, sci) if not c["is_sci"] else sci) + ": range map, photos & facts | SnakeList"
        desc = (lead + (" " + extra[0] if extra else ""))[:300]
        url = SITE + "species/" + page_name(c)
        img = img_of(c, "large") or (SITE + "snakelist-logo.png")
        # where it lives, country by country, with its states/provinces
        provs = {}
        for pkey in c["provinces"]:
            cc, _, pn = pkey.partition(":"); provs.setdefault(cc.lower(), []).append(pn)
        if c["states"]: provs.setdefault("us", []).extend(c["states"])
        def place(n):  # a country name, linking to the app's map on that country
            return '<a href="../?map=%s">%s</a>' % (esc(quote(n)), esc(n)) if n in iso else esc(n)
        rows = []
        for i, n in enumerate(c["countries"]):  # countries only - the states are on the map
            rows.append("<li%s><b>%s</b></li>" % (xcls(i, len(c["countries"])), place(n)))
        codes = [iso[n] for n in c["countries"] if n in iso]
        # introduced / invasive places: their own colour on the map (unless also native there)
        inv = invasive.get(c["id"]) or [{"name": a, "code": "", "note": ""} for a in c["intro"]]
        icodes, dots, ishapes, iboxes = [], [], [], []
        for x in inv:
            cc = x["code"] or iso.get(x["name"], "")
            rows.append("<li><b>Invasive:</b> %s</li>" % place(x["name"]))
            rg = region(cc, x.get("states") or []) if cc and x.get("states") else None
            if rg:  # only the states/provinces it was brought to, not the whole country
                ishapes.append(rg[0]); iboxes.append((0,) + rg[1])
            elif cc in paths:
                if cc not in codes and cc not in icodes: icodes.append(cc)
            else:  # too small for a shape (Christmas Island): a dot where it is
                ll = intro_ll.get(x["name"]) or next((v for k, v in intro_ll.items() if k.startswith(x["name"])), None)
                if ll: dots.append((ll[0], ll[1], "in", 0))
        # tiny countries (Gibraltar, Monaco...) get a dot too, or they'd be invisible zoomed out
        for cc, cls in [(cc, "on") for cc in codes] + [(cc, "in") for cc in icodes]:
            b = boxes.get(cc)
            if b and max(b[2] - b[1], b[4] - b[3]) < 1.2: dots.append(((b[1] + b[2]) / 2, (b[3] + b[4]) / 2, cls, max(b[2] - b[1], b[4] - b[3]) * 4))
        bx = [boxes[cc] for cc in codes + icodes if cc in boxes] + iboxes + [(0, d[0], d[0], d[1], d[1]) for d in dots]
        view = view_of(bx)
        # "See states": its native states/provinces/islands, drawn from species/prov/<cc>.json when
        # the button is pressed (green; orange where the country is only an invasive one for it),
        # and listed by country under the map
        st_data, st_rows, st_boxes, st_whole = [], [], [], set()
        st_ccs = [iso[n] for n in c["countries"] if n in iso and provs.get(iso[n])] + [cc for cc in provs if cc not in codes]
        for cc in dict.fromkeys(st_ccs):
            names = list(dict.fromkeys(provs[cc])); shapes = region.provinces(cc)
            want = set(names); hit = [nm for nm, e in shapes.items() if nm in want or e["also"] & want]
            cls = "in" if cc in icodes and cc not in codes else "on"
            if hit:
                hit = sorted(hit)
                st_data.append([cc, cls, hit, [prov_count(cc, {nm} | shapes[nm]["also"]) for nm in hit]] + ([[region.us_names.get(nm, nm) for nm in hit]] if cc == "us" else [])); prov_used.add(cc); st_whole.add(cc)
                st_boxes += [(0,) + shapes[nm]["box"] for nm in hit]
            cname = next((n for n in c["countries"] if iso.get(n) == cc), None) or code_name.get(cc, cc.upper())
            st_rows.append(st_row(cc, cname, names, " (islands)" if cc == "id" else " (invasive)" if cls == "in" else ""))
        # invasive provinces/islands outside the US (the Canary Islands, the Balearics): orange, only
        # with "See precise area" on - the whole country stays orange otherwise
        for x in inv:
            cc = x["code"] or iso.get(x["name"], "")
            if not (cc and x.get("areas")) or cc == "us": continue
            shapes = region.provinces(cc); want = set(x["areas"])
            hit = sorted(nm for nm, e in shapes.items() if nm in want or e["also"] & want)
            if not hit: continue
            st_data.append([cc, "in", hit, [prov_count(cc, {nm} | shapes[nm]["also"]) for nm in hit]]); prov_used.add(cc); st_whole.add(cc)
            st_boxes += [(0,) + shapes[nm]["box"] for nm in hit]
            st_rows.append(st_row(cc, x["name"], x["areas"], " (invasive)"))
        for x in inv:  # the states it was brought to (already drawn in orange, see ishapes)
            cc = x["code"] or iso.get(x["name"], "")
            if x.get("states") and cc not in provs:
                st_rows.append("<li><b>%s (invasive):</b> %s</li>" % (esc(x["name"]), esc(", ".join(region.us_names.get(n, n) if cc == "us" else n for n in x["states"]))))
        ns = []
        for cc in codes:
            if cc in st_whole or cc in provs or cc not in boxes: continue
            P = region.provinces(cc)
            if not P: continue
            B = [e["box"] for e in P.values()]  # every state's own box, so islands far off count too
            w, e_, s_, n_ = min(x[0] for x in B), max(x[1] for x in B), min(x[2] for x in B), max(x[3] for x in B)
            if e_ - w > 180: w, e_, s_, n_ = boxes[cc][1:]  # across the date line: the main piece only
            ns.append([cc, round(w, 2), round(e_, 2), round(s_, 2), round(n_, 2), next((n for n in c["countries"] if iso.get(n) == cc), cc.upper())]); prov_used.add(cc)
        cities = []
        for cc, names in provs.items():
            want = set(names)
            for ct in CITIES.get(cc, []):
                if ct[2] in want: cities.append(ct)
        cities.sort(key=lambda t: t[0])
        sview = view
        if st_data:
            sview = view_of([boxes[cc] for cc in codes + icodes if cc in boxes and cc not in st_whole] + st_boxes + iboxes + [(0, d[0], d[0], d[1], d[1]) for d in dots]) or view
        # what the app's filter chips say about it, each a link to that filter
        tags = []
        tags.append(("Popular", "f=chip-popular") if c["popular"] else ("Uncommon", "f=chip-uncommon"))
        if "North America" not in c["continents"]: tags.append(("Exotic", "f=chip-exotic"))
        if rt.startswith("Common"): tags.append(("Common", "f=chip-common"))
        if rt.startswith("Rare"): tags.append(("Rare", "f=chip-rare"))
        tags.append(("Venomous", "f=chip-venom") if c["venom"] else ("Non-venomous", "f=chip-nonvenom"))
        hm = harm(c)
        if hm: tags.append((hm.capitalize(), "f=chip-" + hm))
        cons = constriction(c)  # documented for its family or genus, same list as the app (#constrictor-data)
        if cons == "yes": tags.append(("Constrictor", "f=chip-constrictor"))
        elif cons == "no": tags.append(("Non-constrictor", "f=chip-nonconstrictor"))
        if c["invasive"]: tags.append(("Invasive", "f=chip-invasive"))
        if c["eater"]: tags.append(("Snake eater", "f=chip-snakeeater"))
        if c["extinct"] or c["fossil"]: tags.append(("Fossil" if c["fossil"] else c["extinct"].split(" - ")[0].split(" since")[0], "f=chip-extinct"))
        if c["type"] and c["type"] != "Other": tags.append((c["type"], "type=" + quote(c["type"])))
        if c["family"]: tags.append((c["family"], "fam=" + quote(c["family"])))
        rel = [x for x in by_genus.get(c["genus"], []) if x is not c][:40]
        if len(rel) < 6: rel += [x for x in by_family.get(c["family"], []) if x is not c and x not in rel][:12 - len(rel)]
        facts = []
        facts.append(("Venom", "Venomous" if c["venom"] else "Not venomous"))
        facts.append(("To people", hm.capitalize() if hm else "Not documented"))
        facts.append(("Constrictor", {"yes": "Constrictor", "no": "Non-constrictor"}.get(cons, "Not documented")))
        facts.append(("Type", c["type"] or "Snake"))
        if c["family"]: facts.append(("Family", c["family"]))
        if c["genus"]: facts.append(("Genus", c["genus"]))
        if c["continents"]: facts.append(("Continents", ", ".join(c["continents"])))
        if c["countries"]: facts.append(("Countries", "%d" % len(c["countries"])))
        if rt: facts.append(("How common", rt.split(" - ")[0]))
        if c["extinct"]: facts.append(("Status", c["extinct"].split(" - ")[0]))
        if c["fossil"]: facts.append(("Status", "Known only from fossils"))
        if c["eater"]: facts.append(("Diet", "Eats other snakes"))
        if c["invasive"] or c["intro"]: facts.append(("Invasive in", c["invasive"] or ", ".join(c["intro"])))
        photo = img_of(c)
        if photo:
            ph = '<figure class="sp-photo"><img src="%s" alt="%s" width="500" height="333" fetchpriority="high"><figcaption>Photo: %s, via iNaturalist</figcaption></figure>' % (
                esc(photo), esc("Photo of a " + (nm if not c["is_sci"] else sci) + " (" + sci + ")"), esc(c["photo"][2]))
        elif c["photo"]:
            ph = '<figure class="sp-photo"><div class="sp-sprite" role="img" aria-label="%s" style="%s"></div><figcaption>%s</figcaption></figure>' % (esc("Illustration of " + label), sprite(c), esc(c["photo"][2]))
        else:
            ph = '<figure class="sp-photo sp-nophoto"><div>No photo of this snake yet</div></figure>'
        ld = [{"@context": "https://schema.org", "@type": "Taxon", "name": sci, "alternateName": [nm] if not c["is_sci"] else [],
               "taxonRank": "species", "url": url, "image": img, "description": desc,
               "parentTaxon": {"@type": "Taxon", "name": c["genus"], "taxonRank": "genus",
                               "parentTaxon": {"@type": "Taxon", "name": c["family"], "taxonRank": "family"}} if c["genus"] else None},
              {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
                  {"@type": "ListItem", "position": 1, "name": "SnakeList", "item": SITE},
                  {"@type": "ListItem", "position": 2, "name": "All species", "item": SITE + "species/"},
                  {"@type": "ListItem", "position": 3, "name": nm, "item": url}]}]
        page = PAGE.format(
            title=esc(title), desc=esc(desc), url=url, img=esc(img), ld=json.dumps(ld, ensure_ascii=False).replace("</", "<\\/"),
            h1=esc(nm), sub=esc(sci) if not c["is_sci"] else "", photo=ph, about=esc(about),
            facts="".join("<div><dt>%s</dt><dd>%s</dd></div>" % (esc(k), ('<a href="%s/%s">%s</a>' % (k.lower(), slugify(v), esc(v))) if k in ("Family", "Genus") and v else esc(v)) for k, v in facts),
            habitats="".join('<li%s><a href="../?hab=%s">%s</a></li>' % (xcls(i, len(c["habitats"])), esc(quote(h)), esc(h)) for i, h in enumerate(c["habitats"])) or "<li>Not worked out yet</li>",
            hab_all=see_all("habitats", len(c["habitats"])),
            where="".join(rows) or "<li>No range recorded yet.</li>", where_all=see_all("countries", len(c["countries"])),
            st=esc(json.dumps(st_data, ensure_ascii=False, separators=(",", ":"))) if st_data else "", sview=esc(sview or "0 0 1440 720"),
            ns=esc(json.dumps(ns, separators=(",", ":"))) if ns else "",
            stbtn=('<button type="button" class="sp-all sp-stbtn" aria-pressed="false">See precise area</button>' if st_rows or ns else "") +
                  ('<button type="button" class="sp-all sp-ctbtn" aria-pressed="false">See cities</button>' if cities else ""),
            cities_json=esc(json.dumps([[round(t[3], 2), round(t[4], 2), t[0]] for t in cities], ensure_ascii=False)),
            cities_list=('<div class="sp-cities"><h3>Cities in its range</h3><p class="sp-note">Big cities inside the states and provinces where it is recorded - not individual sightings.</p><ul class="sp-where">%s</ul></div>' % "".join(
                "<li>%s <small>%s</small></li>" % (esc(t[0]), esc(t[1])) for t in cities)) if cities else "",
            states=('<div class="sp-states"><h3>States, provinces and islands</h3><ul class="sp-where">%s</ul></div>' % "".join(st_rows)) if st_rows or ns else "",
            tags="".join('<li><a href="../?%s">%s</a></li>' % (esc(q), esc(t)) for t, q in tags),
            codes=esc(" ".join(codes)), intro=esc(" ".join(icodes)),
            ishapes="".join('<path class="in" d="%s"/>' % d for d in ishapes),
            dots=esc(" ".join("%.1f,%.1f,%s,%.2g" % ((lo + 180) * 4, (90 - la) * 4, k, sz) for lo, la, k, sz in dots)),
            legend=('<p class="sp-legend"><span><i class="on"></i>Native range</span>%s</p>' % (
                '<span><i class="in"></i>Invasive</span>' if icodes or ishapes or any(d[2] == "in" for d in dots) else "")) if codes or icodes or ishapes or dots else "", view=esc(view or "0 0 1440 720"), sci_attr=esc(sci), id=c["id"],
            nplaces=len(c["countries"]),
            related="".join('<li%s><a href="%s">%s</a> <i>%s</i></li>' % (xcls(i, len(rel)), page_name(x), esc(x["name"]), esc(x["sci"] if not x["is_sci"] else "")) for i, x in enumerate(rel)),
            rel_all=see_all("related snakes", len(rel)),
            author=AUTHOR, venom_cls="v" if c["venom"] else "nv", mapnote="" if codes or icodes or ishapes or dots else '<p class="sp-muted">No range data for this snake yet.</p>')
        open("%s/%s.html" % (OUT, page_name(c)), "w", encoding="utf-8").write(page)
        if page_name(c) != c["id"]:  # the old address (and the app's ?sp ids) still lead here
            open("%s/%s.html" % (OUT, c["id"]), "w", encoding="utf-8").write(REDIRECT.format(name=esc(c["name"]), url=url, page=page_name(c)))
        links.append(c)
    # the "See states" shapes: one small file per country, fetched only when the button is pressed
    os.makedirs(OUT + "/prov", exist_ok=True)
    for cc in sorted(prov_used):
        with open("%s/prov/%s.json" % (OUT, cc), "w", encoding="utf-8") as fh:
            json.dump({nm: e["d"] for nm, e in region.provinces(cc).items()}, fh, ensure_ascii=False, separators=(",", ":"))
    # the A-Z of every species, by family - one crawlable page linking them all
    fams = sorted(by_family.items(), key=lambda kv: (kv[0] == "", kv[0]))
    cnt = {}
    for c in cards:
        for n in c["countries"]: cnt[n] = cnt.get(n, 0) + 1
    hub_lists = ('<section><h2>Snakes by country</h2><ul class="sp-hubs">%s</ul></section>' % "".join(
        '<li><a href="country/%s">%s</a> <small>%d</small></li>' % (slugify(n), esc(n), k) for n, k in sorted(cnt.items()) if slugify(n)) +
        '<section id="by-family"><h2>Snake families</h2><ul class="sp-hubs">%s</ul></section>' % "".join(
        '<li><a href="family/%s">%s</a> <small>%d</small></li>' % (slugify(f), esc(f), len(L)) for f, L in fams if f))
    body = "".join('<section><h2>%s <small>%d</small></h2><ul class="sp-az">%s</ul></section>' % (
        esc(f or "Other snakes"), len(L), "".join('<li><a href="%s">%s</a>%s</li>' % (
            page_name(x), esc(x["name"]), (" <i>%s</i>" % esc(x["sci"])) if not x["is_sci"] else "") for x in sorted(L, key=lambda x: x["name"].lower())))
        for f, L in fams)
    body = hub_lists + body
    open(OUT + "/index.html", "w", encoding="utf-8").write(INDEX.format(n=len(cards), body=body, author=AUTHOR, url=SITE + "species/"))
    return [SITE + "species/"] + [SITE + "species/" + page_name(c) for c in links] + hubs(cards, esc, img_of)


def hubs(cards, esc, img_of):
    """crawlable landing pages - snakes of each country, each family, each genus - linking to the species pages"""
    groups = {"country": {}, "family": {}, "genus": {}}
    for c in cards:
        for n in c["countries"]: groups["country"].setdefault(n, []).append(c)
        if c["family"]: groups["family"].setdefault(c["family"], []).append(c)
        if c["genus"]: groups["genus"].setdefault(c["genus"], []).append(c)
    urls = []
    for kind, G in groups.items():
        os.makedirs(OUT + "/" + kind, exist_ok=True)
        for name, L in G.items():
            L = sorted(L, key=lambda x: (not x["popular"], x["name"].lower()))
            slug = slugify(name)
            if not slug: continue
            nv = sum(1 for x in L if x["venom"]); nfam = len({x["family"] for x in L if x["family"]})
            if kind == "country":
                h1 = "Snakes of %s" % name
                title = "Snakes of %s: all %d species, with photos and maps | SnakeList" % (name, len(L))
                lead = "%d snake species are recorded in %s - %d venomous and %d non-venomous%s." % (len(L), name, nv, len(L) - nv, ", from %d families" % nfam if nfam > 1 else "")
            elif kind == "family":
                h1 = name
                title = "%s: all %d snake species | SnakeList" % (name, len(L))
                lead = "The family %s has %d species in SnakeList - %d venomous and %d non-venomous, in %d genera." % (name, len(L), nv, len(L) - nv, len({x["genus"] for x in L}))
            else:
                h1 = name
                title = "%s snakes: all %d species | SnakeList" % (name, len(L))
                fam = next((x["family"] for x in L if x["family"]), "")
                lead = "The genus %s%s has %d species in SnakeList - %d venomous and %d non-venomous." % (name, " (family %s)" % fam if fam else "", len(L), nv, len(L) - nv)
            url = SITE + "species/%s/%s" % (kind, slug)
            img = next((img_of(x, "large") for x in L if img_of(x)), SITE + "snakelist-logo.png")
            items = "".join('<li><a href="../%s">%s</a>%s%s</li>' % (page_name(x), esc(x["name"]), (" <i>%s</i>" % esc(x["sci"])) if not x["is_sci"] else "",
                                                                   ' <span class="v">venomous</span>' if x["venom"] else "") for x in L)
            ld = json.dumps([{"@context": "https://schema.org", "@type": "CollectionPage", "name": h1, "url": url, "description": lead,
                              "mainEntity": {"@type": "ItemList", "numberOfItems": len(L), "itemListElement": [
                                  {"@type": "ListItem", "position": i + 1, "url": SITE + "species/" + page_name(x), "name": x["name"]} for i, x in enumerate(L[:100])]}},
                             {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
                                 {"@type": "ListItem", "position": 1, "name": "SnakeList", "item": SITE},
                                 {"@type": "ListItem", "position": 2, "name": "All species", "item": SITE + "species/"},
                                 {"@type": "ListItem", "position": 3, "name": h1, "item": url}]}], ensure_ascii=False).replace("</", "<\\/")
            app = "../../?map=%s" % esc(name) if kind == "country" else "../../?fam=%s" % esc(name) if kind == "family" else "../../?q=%s" % esc(name)
            open("%s/%s/%s.html" % (OUT, kind, slug), "w", encoding="utf-8").write(HUB.format(
                title=esc(title), desc=esc(lead), url=url, img=img, ld=ld, h1=esc(h1), lead=esc(lead), items=items, author=AUTHOR, app=app,
                app_label="See it on the map" if kind == "country" else "Open in SnakeList"))
            urls.append(url)
    # the lists of every country and family, so each hub is one link from the A-Z page
    return urls


PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta name="author" content="{author}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta property="og:type" content="article"><meta property="og:site_name" content="SnakeList by {author}">
<meta property="og:title" content="{title}"><meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1F5A3A">
<link rel="icon" href="../favicon.ico" sizes="any"><link rel="manifest" href="../app/snakelist.webmanifest">
<link rel="stylesheet" href="sp.css"><script>document.documentElement.className+=" js"</script>
<script type="application/ld+json">{ld}</script>
</head><body>
<header class="sp-top"><a class="sp-logo" href="../">SnakeList</a><nav><a href="./">All species</a><a href="../">Open the app</a></nav></header>
<main class="sp-main" data-id="{id}" data-sci="{sci_attr}">
<nav class="sp-crumbs" aria-label="Breadcrumb"><a href="../">SnakeList</a> &rsaquo; <a href="./">All species</a> &rsaquo; <span>{h1}</span></nav>
<article>
<div class="sp-head">{photo}
<div class="sp-title"><h1>{h1}</h1><p class="sp-sci">{sub}</p>
<ul class="sp-tags" aria-label="In SnakeList">{tags}</ul>
<p class="sp-badge {venom_cls}"></p>
</div></div>
<dl class="sp-facts">{facts}</dl>
<p class="sp-cta"><a class="sp-btn" href="../?sp={id}">Open in SnakeList</a></p>
<section><h2>About</h2><p>{about}</p><div id="sp-wiki"></div></section>
<section><h2>Where it lives</h2>
<div class="sp-map" data-codes="{codes}" data-intro="{intro}" data-dots="{dots}" data-view="{view}" data-st="{st}" data-ns="{ns}" data-sview="{sview}" data-cities="{cities_json}" aria-label="Map of the {nplaces} countries where {h1} lives"></div><template class="sp-ishapes">{ishapes}</template><div class="sp-mapbar">{legend}{stbtn}</div>{mapnote}{states}{cities_list}
<ul class="sp-where sp-clip">{where}</ul>{where_all}</section>
<section><h2>Habitats</h2><p class="sp-note">Estimated from where this snake is recorded and what kind of snake it is - not a confirmed habitat survey.</p><ul class="sp-pills sp-clip">{habitats}</ul>{hab_all}</section>
<section><h2>Related snakes</h2><ul class="sp-rel sp-clip">{related}</ul>{rel_all}</section>
<p class="sp-safe"><b>Stay safe:</b> a photo or a web page can never tell you for certain that a snake is harmless. Keep your distance, never handle a wild snake, and get medical help straight away after any bite.</p>
</article></main>
<footer class="sp-foot">SnakeList &middot; made by <a href="../about.html"><b>{author}</b></a> &middot; <a href="../about.html">About me</a> &middot; <a href="../privacy.html">Privacy</a> &middot; <a href="../terms.html">Terms</a></footer>
<script src="sp.js" defer></script>
</body></html>
"""

HUB = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}"><meta name="author" content="{author}"><meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website"><meta property="og:title" content="{title}"><meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{img}"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../../favicon.ico" sizes="any"><link rel="stylesheet" href="../sp.css">
<script type="application/ld+json">{ld}</script>
</head><body>
<header class="sp-top"><a class="sp-logo" href="../../">SnakeList</a><nav><a href="../">All species</a><a href="../../">Open the app</a></nav></header>
<main class="sp-main"><nav class="sp-crumbs" aria-label="Breadcrumb"><a href="../../">SnakeList</a> &rsaquo; <a href="../">All species</a> &rsaquo; <span>{h1}</span></nav>
<h1>{h1}</h1><p class="sp-lead">{lead}</p><p class="sp-cta"><a class="sp-btn" href="{app}">{app_label}</a></p>
<ul class="sp-az">{items}</ul></main>
<footer class="sp-foot">SnakeList &middot; made by <a href="../../about.html"><b>{author}</b></a></footer>
</body></html>
"""

INDEX = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>All {n} snake species A-Z | SnakeList</title>
<meta name="description" content="Every one of the {n} snake species in SnakeList, by family - each with its photo, range map, habitats and facts.">
<link rel="canonical" href="{url}"><meta name="author" content="{author}"><meta name="robots" content="index,follow">
<link rel="icon" href="../favicon.ico" sizes="any"><link rel="stylesheet" href="sp.css">
</head><body>
<header class="sp-top"><a class="sp-logo" href="../">SnakeList</a><nav><a href="../">Open the app</a></nav></header>
<main class="sp-main"><h1>All {n} snake species</h1><p class="sp-muted">By family, A-Z. Tap one for its photo, map and facts.</p>{body}</main>
<footer class="sp-foot">SnakeList &middot; made by <b>{author}</b></footer>
</body></html>
"""

CSS = """.sp-note{font-size:13px;color:var(--muted);margin:-4px 0 10px}.sp-more{font-size:14px;margin:10px 0 0}.sp-lead{font-size:18px;margin:10px 0 14px}
.sp-safe{margin:24px 0 0;padding:18px 22px;border-radius:16px;border:2px solid var(--tagline);background:var(--tag);font-size:16.5px;line-height:1.55}
.sp-all{font:500 12px Inter,system-ui,-apple-system,Segoe UI,sans-serif;padding:4px 11px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--muted);cursor:pointer;margin:8px 0 0;display:none}
.js .sp-all{display:inline-block}.js .sp-clip:not(.sp-open)>.sp-x{display:none}
.sp-mapbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px}.sp-mapbar .sp-legend{margin-right:auto}.sp-mapbar .sp-legend,.sp-mapbar .sp-all{margin-top:8px}
.sp-states{margin-top:12px}.sp-n{color:var(--muted);font-size:.85em}.sp-shade{display:inline-flex;align-items:center;gap:6px}.sp-ramp{display:inline-block;width:46px!important;height:12px;border-radius:4px;background:linear-gradient(90deg,#b8e2aa,#1f5c28)}.sp-cities{margin-top:12px}.js .sp-cities:not(.sp-open){display:none}.sp-cities h3{font:700 16px Georgia,serif;margin:0 0 4px}.sp-cities .sp-where{margin:0}.sp-cities small{color:var(--muted)}
.sp-map circle.ct{fill:#e0a526;stroke:#fff;stroke-width:1.2px;vector-effect:non-scaling-stroke}.sp-states h3{font:700 16px Georgia,serif;margin:0 0 4px}.sp-states .sp-where{margin:0;columns:1}
.sp-az .v{font-size:11px;font-weight:700;color:#b5452a;margin-left:4px}@media (prefers-color-scheme:dark){.sp-az .v{color:#f0a04b}}
.sp-hubs{columns:3 200px;column-gap:24px;padding:0;list-style:none}.sp-hubs li{break-inside:avoid;margin:2px 0}
:root{--bg:#f1f6ee;--card:#fbfdf9;--text:#183020;--muted:#55705b;--line:#d5e4cf;--g:#58b351;--land:#d7dccb;--on:#58b351;--in:#e07a1f;--sea:#e3ecef;--tag:#e3f0dc;--tagline:#a9cf9c}
@media (prefers-color-scheme:dark){:root{--bg:#22623f;--card:#256846;--text:#eef6ee;--muted:#b5d4bf;--line:#37855f;--g:#58b351;--land:#3a7c5a;--on:#58b351;--in:#f0a04b;--sea:#1b5034;--tag:#2c7a57;--tagline:#4a9a6c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 Inter,system-ui,-apple-system,Segoe UI,sans-serif}
a{color:var(--g)}.sp-top{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:980px;margin:0 auto;padding:14px 16px}
.sp-logo{font:700 26px Georgia,'Times New Roman',serif;color:var(--g);text-decoration:none}.sp-top nav{display:flex;gap:16px;font-size:14px}
.sp-main{max-width:980px;margin:0 auto;padding:0 16px 30px}.sp-crumbs{font-size:13px;color:var(--muted);margin:4px 0 14px}
.sp-head{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:24px;align-items:start}
@media (max-width:720px){.sp-head{grid-template-columns:1fr}}
.sp-photo{margin:0}.sp-photo img,.sp-sprite{width:100%;height:auto;aspect-ratio:3/2;object-fit:cover;border-radius:18px;display:block;background:var(--line)}
.sp-photo figcaption{font-size:12px;color:var(--muted);margin-top:6px}.sp-nophoto div{aspect-ratio:3/2;border-radius:18px;display:grid;place-items:center;background:var(--line);color:var(--muted)}
h1{font:700 clamp(30px,5vw,44px)/1.1 Georgia,serif;margin:0}.sp-sci{font-style:italic;color:var(--muted);margin:4px 0 10px;font-size:18px}
.sp-badge{display:none}.sp-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin:18px 0 12px}
.sp-facts div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px 12px}.sp-facts dt{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}.sp-facts dd{margin:0;font-weight:600}
.sp-btn{display:inline-block;background:var(--g);color:#fff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:12px}
section{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px 20px;margin-top:18px}h2{font:700 22px Georgia,serif;margin:0 0 8px}h2 small{font:500 13px Inter,sans-serif;color:var(--muted)}
.sp-map{position:relative;border-radius:12px;overflow:hidden;background:var(--sea);aspect-ratio:2/1;max-height:460px;width:100%}
.sp-map svg{width:100%;height:100%;display:block;user-select:none;-webkit-user-select:none}
.sp-map path{fill:var(--land);stroke:var(--sea);stroke-width:.6;vector-effect:non-scaling-stroke;stroke-linejoin:round}.sp-map path.on{fill:var(--on)}.sp-map path.in{fill:var(--in)}
.sp-map circle{stroke:var(--card);stroke-width:1.2;vector-effect:non-scaling-stroke}.sp-map circle.on{fill:var(--on)}.sp-map circle.in{fill:var(--in)}
.sp-zoom{position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:6px}
.sp-zoom button{width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--g);font:600 20px/1 Inter,system-ui,sans-serif;cursor:pointer;padding:0;touch-action:manipulation}
.sp-zoom button:disabled{opacity:.45;cursor:default}
.sp-legend{display:flex;flex-wrap:wrap;gap:6px 16px;margin:8px 0 0;font-size:13px;color:var(--muted)}.sp-legend span{display:inline-flex;align-items:center;gap:6px}
.sp-legend i{width:14px;height:14px;border-radius:4px;display:inline-block}.sp-legend i.on{background:var(--on)}.sp-legend i.in{background:var(--in)}
.sp-tags{list-style:none;padding:0;margin:4px 0 10px;display:flex;flex-wrap:wrap;gap:6px}
.sp-tags a{display:inline-block;background:var(--tag);border:1px solid var(--tagline);color:var(--g);text-decoration:none;font-size:13px;font-weight:600;padding:3px 12px;border-radius:999px}
.sp-tags a:hover,.sp-pills a:hover{background:var(--g);border-color:var(--g);color:#fff}
.sp-where a{color:inherit;text-decoration:underline;text-decoration-color:var(--tagline);text-underline-offset:2px}.sp-where a:hover{color:var(--g)}
.sp-where{columns:2 260px;padding-left:18px;font-size:14px}.sp-where li{break-inside:avoid;margin-bottom:4px}
.sp-pills{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:6px}.sp-pills li{border:1px solid var(--line);border-radius:999px;padding:3px 11px;font-size:13.5px}.sp-pills li:has(a){border:0;padding:0}
.sp-pills a{display:inline-block;border:1px solid var(--tagline);background:var(--tag);color:var(--g);text-decoration:none;border-radius:999px;padding:3px 11px;font-size:13.5px}
.sp-rel,.sp-az{columns:3 220px;padding-left:18px}.sp-rel i,.sp-az i{color:var(--muted);font-size:13px}.sp-muted{color:var(--muted)}
.sp-lb{position:fixed;inset:0;z-index:50;background:rgba(5,15,9,.92);display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out}
.sp-lb img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;cursor:default}.sp-lb-x{position:fixed;top:12px;right:14px;width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.15);color:#fff;font-size:26px;cursor:pointer}
#sp-wiki p{margin:10px 0 0}#sp-wiki .src{font-size:12px;color:var(--muted)}.sp-foot{text-align:center;color:var(--muted);font-size:13px;padding:20px 16px 34px;border-top:1px solid var(--line)}
"""

JS = """(function(){
var m=document.querySelector('.sp-map');
if(m){fetch('world.svg').then(function(r){if(!r.ok)throw 0;return r.text()}).then(function(t){m.innerHTML=t;var s=m.querySelector('svg'),NS='http://www.w3.org/2000/svg';
s.removeAttribute('width');s.removeAttribute('height');s.setAttribute('preserveAspectRatio','xMidYMid meet');s.setAttribute('aria-hidden','true');
[['intro','in'],['codes','on']].forEach(function(a){(m.dataset[a[0]]||'').split(' ').forEach(function(c){var p=c&&s.getElementById('c-'+c);if(p){p.setAttribute('class',a[1]);s.appendChild(p)}})});var mk=document.createComment('states');s.appendChild(mk);
var tp=document.querySelector('template.sp-ishapes');if(tp&&tp.innerHTML.trim()){var g=new DOMParser().parseFromString('<svg xmlns="'+NS+'">'+tp.innerHTML+'</svg>','image/svg+xml').documentElement;[].slice.call(g.childNodes).forEach(function(n){s.appendChild(document.importNode(n,true))})}
var dots=[];(m.dataset.dots||'').split(' ').forEach(function(d){var q=d.split(',');if(q.length<3)return;var c=document.createElementNS(NS,'circle');c.setAttribute('cx',q[0]);c.setAttribute('cy',q[1]);c.setAttribute('class',q[2]);c._s=+q[3]||0;s.appendChild(c);dots.push(c)});
var W=1440,HH=720,V=function(a){return(a||'0 0 1440 720').split(' ').map(Number)},f=V(m.dataset.view),v={x:0,y:0,w:W,h:HH},minW=Math.max(80,f[2]),maxW=W,A=.5;
function asp(){var w=m.clientWidth,h=m.clientHeight;A=w&&h?h/w:.5}
function draw(){asp();v.w=Math.min(maxW,Math.max(minW,v.w));v.h=v.w*A;
if(v.h>HH&&v.w>=maxW){v.x=0;v.y=(HH-v.h)/2}else{v.x=Math.min(W-v.w,Math.max(0,v.x));v.y=v.h>=HH?(HH-v.h)/2:Math.min(HH-v.h,Math.max(0,v.y))}
s.setAttribute('viewBox',v.x+' '+v.y+' '+v.w+' '+v.h);var k=v.w/Math.max(1,m.clientWidth);dots.forEach(function(c){c.setAttribute('r',(4*k).toFixed(3));c.style.display=c._s/k>12?'none':''})}
function fit(){asp();var w=f[2],h=f[3],cx=f[0]+w/2,cy=f[1]+h/2;if(h>w*A)w=h/A;w=Math.min(maxW,Math.max(minW,w));v.w=w;v.h=w*A;v.x=cx-w/2;v.y=cy-v.h/2;draw()}
var rw=m.clientWidth;window.addEventListener('resize',function(){if(m.clientWidth!==rw){rw=m.clientWidth;fit()}});fit();
var sb=document.querySelector('.sp-stbtn'),sl=document.querySelector('.sp-states'),sg=null,off=[],busy=0,st=[];try{st=JSON.parse(m.dataset.st||'[]')}catch(e){}
if(sb)sb.addEventListener('click',function(){if(busy)return;var on=!sg;
if(!on){sg.remove();sg=null;[].forEach.call(document.querySelectorAll('.sp-inat'),function(e){e.remove()});var sh=document.querySelector('.sp-shade');if(sh)sh.remove();off.forEach(function(p){p[0].setAttribute('class',p[1])});off=[];f=V(m.dataset.view);fit();done(0);return}
busy=1;Promise.all(st.map(function(x){return fetch('prov/'+x[0]+'.json').then(function(r){return r.ok?r.json():{}}).catch(function(){return{}})})).then(function(J){busy=0;
sg=document.createElementNS(NS,'g');var mx=1,mn=1e9;st.forEach(function(x){if(x[1]==='on')(x[3]||[]).forEach(function(k){if(k>mx)mx=k;if(k<mn)mn=k})});if(mn>mx)mn=mx;
st.forEach(function(x,i){var n=0;x[2].forEach(function(nm,j){var d=J[i][nm];if(!d)return;var p=document.createElementNS(NS,'path');p.setAttribute('d',d);p.setAttribute('class',x[1]);
var k=(x[3]||[])[j]||0;if(x[1]==='on'&&mx>mn){var t=Math.sqrt((k-mn)/(mx-mn)),a=[184,226,170],b=[31,92,40];p.style.fill='rgb('+a.map(function(v,q){return Math.round(v+(b[q]-v)*t)}).join(',')+')'}
var tt=document.createElementNS(NS,'title');tt.textContent=((x[4]||[])[j]||nm).replace(/ \\(\\d+\\)$/,'')+(k?': '+k+' snake species live here':'');p.appendChild(tt);sg.appendChild(p);n++});
var c=n&&s.getElementById('c-'+x[0]);if(c&&c.getAttribute('class')){off.push([c,c.getAttribute('class')]);c.removeAttribute('class')}});
s.insertBefore(sg,mk.nextSibling);f=V(m.dataset.sview);fit();done(1);
inat();var lg=document.querySelector('.sp-legend');if(lg&&mx>mn&&!document.querySelector('.sp-shade')){var e=document.createElement('span');e.className='sp-shade';e.innerHTML='<i class="sp-ramp"></i>Lighter: fewer snake species live there · darker: more';lg.appendChild(e)}})});
// countries with no state data on record: their states come from where it has actually been
// seen - iNaturalist's verified wild sightings, each one placed in the state it falls in
var ns=[];try{ns=JSON.parse(m.dataset.ns||'[]')}catch(e){}
function inat(){if(!ns.length||!sg)return;var sci=(document.querySelector('.sp-main')||{dataset:{}}).dataset.sci,my=sg,q=ns.slice(0,40),i=0,live=0,got=[];
var ul=sl&&sl.querySelector('.sp-where'),note=document.createElement('p');note.className='sp-note sp-inat';note.textContent='Looking up where it has been seen on iNaturalist...';if(sl)sl.appendChild(note);
function fin(){if(live||i<q.length)return;if(!got.length)note.textContent='No iNaturalist sightings to place in the other countries yet - they stay shaded whole.';else note.textContent='States and provinces marked from verified wild sightings on iNaturalist.'}
function one(){if(sg!==my)return;if(i>=q.length){fin();return}var x=q[i++];live++;
Promise.all([fetch('prov/'+x[0]+'.json').then(function(r){return r.ok?r.json():{}}),fetch('https://api.inaturalist.org/v1/observations?taxon_name='+encodeURIComponent(sci)+'&verifiable=true&captive=false&per_page=200&swlng='+x[1]+'&nelng='+x[2]+'&swlat='+x[3]+'&nelat='+x[4]).then(function(r){return r.ok?r.json():{}})]).then(function(R){live--;if(sg!==my)return;
var P=R[0]||{},pts=((R[1]||{}).results||[]).map(function(o){return o.geojson&&o.geojson.coordinates}).filter(Boolean),g=document.createElementNS(NS,'g'),names=[];
if(pts.length){sg.appendChild(g);Object.keys(P).forEach(function(nm){var p=document.createElementNS(NS,'path');p.setAttribute('d',P[nm]);p.setAttribute('class','on');g.appendChild(p);var k=0;
pts.forEach(function(c){var pt=s.createSVGPoint();pt.x=(c[0]+180)*4;pt.y=(90-c[1])*4;if(p.isPointInFill(pt))k++});
if(!k){p.remove();return}var nm2=nm.replace(/ \(\d+\)$/,''),t=document.createElementNS(NS,'title');t.textContent=nm2+': seen '+k+(k===1?' time':' times')+' on iNaturalist';p.appendChild(t);names.push(nm2)});
if(names.length){var c=s.getElementById('c-'+x[0]);if(c&&c.getAttribute('class')){off.push([c,c.getAttribute('class')]);c.removeAttribute('class')}got.push(x[5]);
if(ul){var li=document.createElement('li');li.className='sp-inat';li.innerHTML='<b></b> <span></span> <small class="sp-n">from iNaturalist sightings</small>';li.firstChild.textContent=x[5]+':';li.children[1].textContent=names.sort().join(', ');ul.appendChild(li)}}else g.remove()}
one();fin()},function(){live--;one();fin()})}
one();one();one()}
function done(o){sb.textContent=o?'Hide precise area':'See precise area';sb.setAttribute('aria-pressed',o?'true':'false')}
var cz=null,cb=document.querySelector('.sp-ctbtn'),cl=document.querySelector('.sp-cities'),cg=null,cs=[];try{cs=JSON.parse(m.dataset.cities||'[]')}catch(e){}
if(cb)cb.addEventListener('click',function(){var on=!cg;
if(!on){cg.remove();cg=null;if(cz){f=cz[0];minW=cz[1];cz=null;fit()}}else{
if(cs.length){var X=cs.map(function(c){return(c[1]+180)*4}),Y=cs.map(function(c){return(90-c[0])*4}),x0=Math.min.apply(0,X),x1=Math.max.apply(0,X),y0=Math.min.apply(0,Y),y1=Math.max.apply(0,Y),
bw=Math.max((x1-x0)*1.5,110),bh=Math.max((y1-y0)*1.5,55);cz=[f,minW];f=[(x0+x1)/2-bw/2,(y0+y1)/2-bh/2,bw,bh];minW=Math.min(minW,110);fit()}
cg=document.createElementNS(NS,'g');var k=v.w/Math.max(1,m.clientWidth);cs.forEach(function(c){var d=document.createElementNS(NS,'circle');d.setAttribute('cx',((c[1]+180)*4).toFixed(1));d.setAttribute('cy',((90-c[0])*4).toFixed(1));d.setAttribute('r',(4.5*k).toFixed(2));d.setAttribute('class','ct');var t=document.createElementNS(NS,'title');t.textContent=c[2];d.appendChild(t);cg.appendChild(d)});s.appendChild(cg)}
cb.textContent=on?'Hide cities':'See cities';cb.setAttribute('aria-pressed',on?'true':'false');if(cl)cl.classList.toggle('sp-open',on)});
}).catch(function(){})}
[].forEach.call(document.querySelectorAll('.sp-all[data-all]'),function(b){b.addEventListener('click',function(){var l=b.previousElementSibling,o=!l.classList.contains('sp-open');l.classList.toggle('sp-open',o);b.textContent=o?'Show less':b.dataset.all;b.setAttribute('aria-expanded',o?'true':'false')})});
var im=document.querySelector('.sp-photo img');
if(im){im.style.cursor='zoom-in';im.addEventListener('click',function(){var o=document.createElement('div');o.className='sp-lb';o.setAttribute('role','dialog');
var big=new Image();big.alt=im.alt;big.src=im.src.replace('/medium.','/original.');big.onerror=function(){big.onerror=null;big.src=im.src.replace('/medium.','/large.')};
var x=document.createElement('button');x.type='button';x.className='sp-lb-x';x.textContent='\u00d7';x.setAttribute('aria-label','Close');
o.appendChild(big);o.appendChild(x);document.body.appendChild(o);function close(){o.remove();document.removeEventListener('keydown',k)}function k(e){if(e.key==='Escape')close()}
o.addEventListener('click',function(e){if(e.target!==big)close()});document.addEventListener('keydown',k)})}
var main=document.querySelector('.sp-main[data-sci]'),w=document.getElementById('sp-wiki');
if(main&&w){fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(main.dataset.sci.replace(/ /g,'_'))).then(function(r){return r.ok?r.json():null}).then(function(d){
if(!d||!d.extract||d.type==='disambiguation')return;var p=document.createElement('p');p.textContent=d.extract;w.appendChild(p);
var s=document.createElement('p');s.className='src';s.innerHTML='From <a href="'+d.content_urls.desktop.page+'" rel="noopener" target="_blank">Wikipedia</a> (CC BY-SA)';w.appendChild(s)}).catch(function(){})}
})();
"""
