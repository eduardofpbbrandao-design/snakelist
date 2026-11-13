"""One page per snake species (species/<id>.html), an A-Z index (species/index.html), the shared
world map they colour in (species/world.svg) and their style/script - all generated from the app
file, so the pages always match the checklist. Called by build-site.py.
"""
import json, re, html as H, os, base64, unicodedata
import sys as _sys_e; _sys_e.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools")); import etymology as ETY  # where the names come from

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


# the header and footer every SnakeList page shares (the static pages use the same markup):
# the app icon and the SnakeList wordmark going home, then the app, the species directory,
# the install guide and the About page. rel = the way back to the site root ("../", "../../")
def site_header(rel, here=""):
    def a(href, label, key):
        return '<a href="%s"%s>%s</a>' % (href, ' aria-current="page"' if key == here else "", label)
    return ('<header class="sl-top"><a class="sl-brand" href="%s"><img src="%sapp/icon-192-s.png" width="32" height="32" alt="">SnakeList</a>'
            '<nav aria-label="Site">%s%s%s%s</nav></header>') % (rel, rel, a(rel, "Open the app", "app"), a(rel + "species/", "Species", "species"),
                                                                 a(rel + "install.html", "Install", "install"), a(rel + "about-snakelist.html", "About", "about"))
def site_footer(rel, note=""):
    return ('<footer class="sl-foot"><p><a class="sl-flogo" href="%s">SnakeList</a> &middot; made by <a href="%sabout.html">Eduardo Brandao</a></p>'
            '<p class="sl-flinks"><a href="%s">Open the app</a><a href="%sspecies/">All species</a><a href="%sinstall.html">Install app</a>'
            '<a href="%sabout-snakelist.html">About SnakeList</a><a href="%sabout.html">About me</a><a href="%sprivacy.html">Privacy</a><a href="%sterms.html">Terms</a><a href="%sspecies/photo-credits.html">Photo credits</a></p>%s</footer>') % (
        rel, rel, rel, rel, rel, rel, rel, rel, rel, rel, ('<p class="sl-fnote">%s</p>' % note) if note else "")
# Creative Commons licences, each linked to its official deed (the attribution the licences ask for)
def lic_url(lic):
    l = (lic or "").upper().replace("CC-", "CC ").strip()
    if l == "CC0": return "https://creativecommons.org/publicdomain/zero/1.0/"
    m = re.match(r"CC ((?:BY)(?:-(?:NC|SA|ND))*)$", l)
    return "https://creativecommons.org/licenses/%s/4.0/" % m.group(1).lower() if m else ""
def lic_link(lic):
    l = (lic or "").replace("CC-", "CC ").strip(); u = lic_url(l)
    return ('<a href="%s" rel="license noopener">%s</a>' % (u, H.escape(l))) if u else H.escape(l)
def an(word):
    """'a' or 'an' before a word (an Inland Taipan, a Boa, an elapid)"""
    w = (word or "").strip().lower()
    return "an" if w[:1] in "aeiou" and not w.startswith(("uni", "use", "eu", "one")) else "a"
def nplural(k, one, many=None):
    return "{:,} {}".format(k, one if k == 1 else (many or one + "s"))
# ---- habitats ----
# SnakeList's habitat data (#habitat-data in the app) was generated earlier from WHERE each snake is
# recorded (every habitat of its countries, states and provinces) plus WHAT KIND of snake it is -
# never from a study of the species. So it gives a sea snake rainforests and deserts, and the
# Inland Taipan the Queensland rainforests, because those habitats exist in its countries.
# Here those estimates are (1) cut back where they contradict the kind of snake (a sea snake is
# kept to the sea and coasts; a land snake never gets the open ocean or coral reefs) and (2) shown
# as what they are: habitat types found where the snake is recorded, not habitats proven for it.
HAB_SEC = {}
MARINE = re.compile(r"ocean|pelagic|coral|reef|sea\b|seagrass|coastal waters|open water", re.I)
COASTAL = re.compile(r"mangrove|estuar|lagoon|shore|beach|coast|brackish|tidal|salt marsh|island", re.I)
def habitat_estimate(hs, typ):
    if typ == "Sea Snake":
        return [h for h in hs if HAB_SEC.get(h) == "Coasts & sea" or MARINE.search(h) or COASTAL.search(h)]
    return [h for h in hs if not MARINE.search(h)]
# the broad kinds of habitat, in order (the place-named sections - Borneo, Madagascar... - are
# the same habitats again under a regional name, so they count toward their kind instead)
HAB_KIND_ORDER = ["Rainforests", "Forests & woodlands", "Savannas & grasslands", "Shrublands & heath", "Deserts & dunes", "Mountains & rocks",
                  "Underground & forest floor", "Wetlands & swamps", "Rivers & lakes", "Coasts & sea", "Around people"]
def hab_kind(h):
    sec = HAB_SEC.get(h, "")
    if sec in HAB_KIND_ORDER: return sec
    t = h.lower()
    for k, rx in (("Coasts & sea", "mangrove|coast|reef|sea|estuar|lagoon|island"), ("Rivers & lakes", "river|lake|stream|flooded|várzea|igapó|delta"),
                  ("Wetlands & swamps", "swamp|marsh|wetland|peat|everglades|pantanal|sundarbans"), ("Deserts & dunes", "desert|dune|sahara|kalahari|namib|outback|arabian|gobi"),
                  ("Savannas & grasslands", "savanna|grassland|steppe|prairie|plains|llanos|cerrado|pampas|spinifex|veld"), ("Shrublands & heath", "scrub|shrub|heath|fynbos|chaparral|matorral|mallee|caatinga|maquis"),
                  ("Mountains & rocks", "montane|mountain|alpine|highland|rock|limestone|karst|andes|himalaya|plateau"), ("Rainforests", "rainforest|cloud forest|moist forest|wet tropics|humid forest"),
                  ("Forests & woodlands", "forest|woodland|mulga|brigalow|miombo|mopane|taiga|pine|oak")):
        if re.search(rx, t): return k
    return "Forests & woodlands"
APP = [""]
MODELS = {}       # "Explore in 3D": each species' model profile (species/3d/models.json), for its JSON-LD
PAGE_LASTMOD = {} # species page URL -> the day its content last changed (data/page-dates.json), for sitemap.xml
CITIES = {}
NONSOV = set()


def places_txt(names, link=None):
    """'5 countries and 1 territory': countries and territories (NON_SOVEREIGN) counted apart"""
    t = sum(1 for n in names if n in NONSOV); c = len(names) - t
    bits = ([nplural(c, "country", "countries")] if c else []) + ([nplural(t, "territory", "territories")] if t else [])
    return " and ".join(bits) or "no recorded countries"


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
    fossil_age = json.loads(app.split("const FOSSIL_AGE = ", 1)[1].split(";\n", 1)[0])
    def ago(m):
        return "about %s million years ago" % (round(m) if m >= 10 else (round(m * 10) / 10 if m % 1 else int(m))) if m >= 1 else "about {:,} years ago".format(int(round(m * 1000000, -3)))
    fossils = set(re.findall(r'"([a-z0-9-]+)"', app.split("// prehistoric snakes known only from fossil bones", 1)[1].split("]", 1)[0]))
    eaters = set(re.findall(r'"([A-Z][a-z]+)"', app.split("const SNAKE_EATERS = new Set([", 1)[1].split("]", 1)[0]))
    # places that are not countries of their own (Gibraltar, Puerto Rico...): the app's NON_SOVEREIGN
    NONSOV.clear(); NONSOV.update(re.findall(r'"([^"]+)":1', app.split("var NON_SOVEREIGN = {", 1)[1].split("};", 1)[0]))
    intro = {}
    for m in re.finditer(r'"([a-z0-9-]+)":\s*\[(\{ area: [^\]]*)\]', app.split("var INTRODUCED = {", 1)[1].split("};", 1)[0]):
        intro[m.group(1)] = re.findall(r'area: "([^"]*)"', m.group(2))
    # habitats: one bit per card, in card order
    hab_names, hab_bits = [], []
    HAB_SEC.clear()
    for sec in hab["sections"]:
        for h in sec[1]:
            hab_names.append(h[0]); hab_bits.append(base64.b64decode(h[1])); HAB_SEC[h[0]] = sec[0]

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
        c["habitats_raw"] = [hab_names[n] for n, b in enumerate(hab_bits) if k < hab["n"] and b[k >> 3] & (1 << (k & 7))]
        c["habitats"] = habitat_estimate(c["habitats_raw"], a.get("type", ""))
        c["spots"] = rarity.get(c["id"], 0)
        c["extinct"] = extinct.get(c["id"], "")
        c["fossil"] = c["id"] in fossils
        fa = fossil_age.get(c["id"])
        c["died"] = (fa[0], ago(fa[1])) if c["fossil"] and fa else None  # (epoch, "about 6 million years ago")
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

    import build_regions
    open(OUT + "/sp.css", "w").write(CSS + build_regions.REAL_CSS)
    open(OUT + "/sp.js", "w").write(JS + build_regions.REAL_JS)
    # "Explore in 3D": the reviewed model profiles, next to the viewer (species/3d/viewer.js)
    os.makedirs(OUT + "/3d", exist_ok=True)
    # v4.63: every other species (living, extinct and fossil) gets a generated profile (tools/auto_models.py)
    import sys as _sys; _sys.path.insert(0, "tools"); import auto_models
    M = json.load(open("data/snake-models.json", encoding="utf-8"))
    by_id = {c["id"]: c for c in cards}
    lens = {}
    for i, inf in load_info(by_id).items():
        lm = build_regions.length_m(inf)
        if lm: lens[i] = lm
    gen = auto_models.build(cards, lens, hab_kind, M["species"], HAB_SEC.get)
    M["species"].update(gen)
    MODELS.clear(); MODELS.update(M["species"])
    with open(OUT + "/3d/models.json", "w", encoding="utf-8") as fh:
        json.dump(M, fh, ensure_ascii=False, separators=(",", ":"))
    return pages(cards, by_genus, by_family, photos, iso, hab_names, invasive, intro_ll, paths, boxes, region)


def world_map(out):
    """species/world.svg: one path per country (id c-<iso code>) from the app's Natural Earth
    1:10m outlines, equirectangular x = (lon+180)*4, y = (90-lat)*4 in a 1440x720 box (the app's
    camera place-picker loads the same file, so keep the ids and projection). The full-detail
    rings are simplified (Douglas-Peucker, 0.1 map units = 0.025 degrees, well under a pixel at
    12x zoom) and written as relative moves in tenths of a unit. Returns the path codes and, per
    country, the box of its largest piece (for fitting a species' range)."""
    src = open("data/geo.js", encoding="utf-8").read().split("window.SL_GEO=", 1)[1]
    js = re.sub(r'([{,])(prebuilt|wp|cp|us|isle):', r'\1"\2":', src.rstrip().rstrip(';'), count=5)
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
            e = out.setdefault(nm, {"d": "", "also": set(), "box": None, "ll": [], "rings": []})
            e["also"].update(also)
            for ring in rings:
                if len(ring) < 3: continue
                e["rings"].append(ring)  # [lon, lat] points, for the region and city pages (build_regions.py)
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


# ---- reviewed information (data/) -------------------------------------------------------------
# data/species-info/<id>.json: one species account, written for SnakeList from the sources it
# lists - every paragraph and fact carries the keys of its own sources, and "reviewed" is the day
# it was last checked against them. Sections that no source supports are simply left out.
#   {"id", "reviewed": "YYYY-MM-DD", "status": "rich" | "limited", "authority": "(Kuhl, 1820)",
#    "facts": {"length"|"reproduction"|"activity"|"diet"|"iucn": {"text", "src": [keys]}},   (iucn also "code", "long")
#    "sections": {"overview"|"identification"|"size"|"variation"|"distribution"|"habitat"|"behaviour"|
#                 "diet"|"reproduction"|"conservation"|"taxonomy": [{"text", "src": [keys], "label"?}]},
#    "similar": [{"id", "text", "src"}], "synonyms": {"names": [...], "src": [keys]},
#    "funfacts": [{"text", "src"}], "sources": {key: {"title", "publisher", "url", "year"?}}}
# In any text, *Genus species* is set in italics and [[genus-species]] or [[genus-species|label]]
# links to that species' page.
# data/genus-info.json: {Genus: {"meaning", "short"?, "source": {"title"?, "publisher", "url"}, "reviewed"}}
# data/family-info.json: {Family: {"common", "text": [{"text", "src"}], "sources": {...}, "reviewed"}}
INFO_DIR = "data/species-info"
GENUS_FILE = "data/genus-info.json"
FAMILY_FILE = "data/family-info.json"
GENUS_INFO, FAMILY_INFO = {}, {}
GEN_MARK = "@@PAGE-GENERATED@@"
INTRO_FILE = "data/introduced-status.json"   # introduced vs invasive, with sources
FOSSIL_FILE = "data/fossil-additions.json"   # fossil snakes: age, find site, size estimate, debate, sources
AUTH_FILE = "data/authorities.json"          # verified "Author, year" for species without an account
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def load_json(path):
    try:
        with open(path, encoding="utf-8") as fh: return json.load(fh)
    except FileNotFoundError: return {}


def fmt_date(d):
    y, m, dd = d.split("-")
    return "%d %s %s" % (int(dd), MONTHS[int(m) - 1], y)


def load_info(by_id):
    out = {}
    if not os.path.isdir(INFO_DIR): return out
    for f in sorted(os.listdir(INFO_DIR)):
        if not f.endswith(".json"): continue
        d = load_json(os.path.join(INFO_DIR, f))
        if d.get("id") not in by_id: print("species-info: %s is not a SnakeList species id" % f); continue
        out[d["id"]] = d
    return out


def plain(t):
    """a data text without its markup (for meta descriptions)"""
    t = re.sub(r"\[\[[^|\]]+\|([^\]]+)\]\]", r"\1", t)
    t = re.sub(r"\[\[([a-z]+)-([a-z-]+)\]\]", lambda m: m.group(1).capitalize() + " " + m.group(2), t)
    return t.replace("*", "")


class Refs:
    """one page's numbered sources: cite() gives the little [1,2] links, numbered in the order
    they first appear on the page; list_html() the reference list they point to"""
    def __init__(self, info, by_id, page_name, rel=""):
        self.src = dict((info or {}).get("sources", {})); self.order = []; self.by_id = by_id; self.pn = page_name; self.rel = rel
        self.who = (info or {}).get("id", "?")

    def add(self, key, s): self.src[key] = s

    def cite(self, keys):
        out = []
        for k in keys or []:
            if k not in self.src: print("species-info %s: unknown source %s" % (self.who, k)); continue
            if k not in self.order: self.order.append(k)
            out.append(self.order.index(k) + 1)
        out = ['<a href="#src-%d" aria-label="source %d">%d</a>' % (n, n, n) for n in sorted(set(out))]
        return '<sup class="sp-ref">[%s]</sup>' % ",".join(out) if out else ""

    def rich(self, t):
        s = H.escape(t, quote=False)
        s = re.sub(r"\*([^*]+)\*", r"<i>\1</i>", s)
        def lk(m):
            i, _, lab = m.group(1).partition("|")
            x = self.by_id.get(i)
            if not x: print("species-info %s: unknown species link %s" % (self.who, i)); return lab or i
            return '<a href="%s%s">%s</a>' % (self.rel, self.pn(x), lab or H.escape(x["name"]))
        return re.sub(r"\[\[([^\]]+)\]\]", lk, s)

    def para(self, p, cls=""):
        return '<p%s>%s%s%s</p>' % (' class="%s"' % cls if cls else "", ("<b>%s:</b> " % H.escape(p["label"])) if p.get("label") else "",
                                    self.rich(p["text"]), self.cite(p.get("src")))

    def list_html(self):
        if not self.order: return ""
        def one(k):
            s = self.src[k]
            t = H.escape(s.get("title", ""))
            if s.get("url"): t = '<a href="%s" rel="noopener">%s</a>' % (H.escape(s["url"]), t or H.escape(s["url"]))
            bits = [t] + [H.escape(str(s[x])) for x in ("authors", "publisher", "year") if s.get(x)]
            return ". ".join(b.rstrip(".") if not b.endswith("</a>") else b for b in bits if b) + "."
        return '<ol class="sp-refs">%s</ol>' % "".join('<li id="src-%d">%s</li>' % (i + 1, one(k)) for i, k in enumerate(self.order))


class PageDates:
    """"Page generated": the day a page's content last changed (kept in data/page-dates.json, so
    rebuilding an unchanged page keeps its date and the file stays the same)"""
    FILE = "data/page-dates.json"

    def __init__(self):
        import datetime
        self.old = load_json(self.FILE); self.new = {}; self.today = datetime.date.today().isoformat()

    def get(self, key, content):
        import hashlib
        h = hashlib.sha1(content.encode("utf-8")).hexdigest()[:12]
        o = self.old.get(key)
        self.new[key] = [h, o[1] if o and o[0] == h else self.today]
        return self.new[key][1]

    def save(self):
        with open(self.FILE, "w", encoding="utf-8") as fh: json.dump(self.new, fh, separators=(",", ":"), sort_keys=True)


def pages(cards, by_genus, by_family, photos, iso, hab_names, invasive, intro_ll, paths, boxes, region):
    from urllib.parse import quote

    def esc(t): return H.escape(str(t), quote=True)
    def plist(L, n=6):
        L = list(L)
        if len(L) <= 1: return "".join(L)
        return (", ".join(L[:-1]) + " and " + L[-1]) if len(L) <= n + 1 else ", ".join(L[:n]) + " and %d more" % (len(L) - n)
    # photos that came with the photographer's name printed on them: SnakeList keeps a cleaned
    # copy (the name cropped off; the credit is shown under the photo), used instead of the original
    CLEANED = set(['0-9', '102-12', '104-7', '108-7', '109-3', '16-19', '16-2', '21-20', '22-14', '24-12', '28-13', '29-19', '3-2', '33-4', '35-23', '40-12', '40-7', '43-24', '43-8', '49-22', '50-10', '50-14', '50-6', '61-10', '61-18', '61-2', '69-4', '7-9', '72-1', '80-16', '88-10', '9-5', '93-9', '97-2', '97-7', '98-5'])
    def img_of(c, size="medium"):
        p = c["photo"]
        if not p or len(p) < 5 or "Illustration" in p[2]: return None
        if "%d-%d" % (p[0], p[1]) in CLEANED:
            return SITE + "species-photos/t/%d-%d.webp" % (p[0], p[1])
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
        t = {"Other": "snake", "Colubrid": "snake", "Elapid": "snake", "Pit Viper": "pit viper", "Sea Snake": "sea snake", "Watersnake": "water snake"}.get(c["type"], c["type"].lower())
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
            rk = build_regions.key_of(cc, n)  # its own page (species/region/...), else the app's map on it
            k = len(build_regions.REG[rk]["ids"]) if rk else prov_count(cc, [n])
            items.append('<a href="%s">%s</a>%s' % (("region/" + rk) if rk else "../?map=" + esc(quote(shown)), esc(shown), (' <small class="sp-n" title="All snake species SnakeList records in %s - not records of this snake">(%s in all)</small>' % (esc(shown), nplural(k, "species", "species"))) if k else ""))
        return "<li><b>%s%s:</b> %s</li>" % (esc(cname), what, ", ".join(items))
    PROV_N = {}
    for c in cards:
        for pkey in c["provinces"]:
            cc, _, pn = pkey.partition(":"); PROV_N.setdefault(cc.lower(), {}).setdefault(pn, set()).add(c["id"])
        for stc in c["states"] or []: PROV_N.setdefault("us", {}).setdefault(stc, set()).add(c["id"])
    import build_regions
    build_regions.index(cards, region, iso, APP[0])  # the state/province and city pages, so the species pages can link them
    def prov_count(cc, names):
        ids = set()
        for n in names: ids |= PROV_N.get(cc, {}).get(n, set())
        return len(ids)
    def hab_html(c, gone):
        if c["fossil"]: return '<p class="sp-muted">Unknown - this snake is known only from fossils.</p>'
        hs = c["habitats"]
        if not hs: return '<p class="sp-muted">Habitat information unavailable.</p>'
        kinds = {}
        for h in hs: kinds.setdefault(hab_kind(h), []).append(h)
        order = [k for k in HAB_KIND_ORDER if k in kinds]
        note = ('<p class="sp-note">Habitat types found in the countries, states and provinces where it %s recorded, narrowed by what kind of snake it is. '
                'They have not been checked for this species, so some may not apply.</p>') % ("was" if gone else "is")
        pills = '<ul class="sp-pills" aria-label="Kinds of habitat in its range">%s</ul>' % "".join(
            '<li><a href="../?hab=%s">%s</a></li>' % (esc(quote(kinds[k][0])), esc(k)) for k in order)
        full = ('<details class="sp-habd"><summary>The %s habitat types in the estimate</summary><ul class="sp-pills">%s</ul></details>') % (
            "{:,}".format(len(hs)), "".join('<li><a href="../?hab=%s">%s</a></li>' % (esc(quote(h)), esc(h)) for h in hs))
        return note + pills + full
    def ext_lab(x):
        return ' <small class="sp-ext">fossil</small>' if x["fossil"] else ' <small class="sp-ext">extinct</small>' if x["extinct"] else ""
    def rel_html(c, rg, rf):
        out = ""
        if rg:
            out += '<h3 class="sp-relh">Same genus: <a href="genus/%s"><i>%s</i></a> <small>%s</small></h3><ul class="sp-rel sp-clip">%s</ul>%s' % (
                slugify(c["genus"]), esc(c["genus"]), "closest relatives" if len(rg) > 1 else "its closest relative",
                "".join('<li%s><a href="%s">%s</a> <i>%s</i>%s</li>' % (xcls(i, len(rg)), page_name(x), esc(x["name"]), esc(x["sci"] if not x["is_sci"] else ""), ext_lab(x)) for i, x in enumerate(rg)),
                see_all("of the genus", len(rg)))
        if rf:
            out += '<h3 class="sp-relh">Same family: <a href="family/%s">%s</a> <small>other genera</small></h3><ul class="sp-rel">%s</ul>' % (
                slugify(c["family"]), esc(c["family"]),
                "".join('<li><a href="%s">%s</a> <i>%s</i>%s</li>' % (page_name(x), esc(x["name"]), esc(x["sci"] if not x["is_sci"] else ""), ext_lab(x)) for x in rf))
        return out or '<p class="sp-muted">No other species of its genus or family in SnakeList.</p>'
    by_id = {c["id"]: c for c in cards}
    INFO = load_info(by_id)
    GENUS_INFO.clear(); GENUS_INFO.update(load_json(GENUS_FILE)); FAMILY_INFO.clear(); FAMILY_INFO.update(load_json(FAMILY_FILE))
    dates = PageDates()
    links = []
    ISTAT = load_json(INTRO_FILE); FOSSIL = {x["id"]: x for x in (load_json(FOSSIL_FILE) or [])}
    AUTH = {k: v for k, v in load_json(AUTH_FILE).items() if not k.startswith("_")}
    def intro_status(c):
        """its introduced populations: [{area, status ('introduced' or 'invasive'), when, text, src}], from
        data/introduced-status.json - "invasive" only where a cited source calls it that"""
        st = ISTAT.get(c["id"])
        if st: return st
        return [{"area": a.strip(), "status": "introduced", "text": "", "src": None} for a in (c["invasive"].split(",") if c["invasive"] else c["intro"])]
    for c in cards:
        nm, sci = c["name"], c["sci"]
        info = INFO.get(c["id"])
        label = nm if c["is_sci"] else "%s (%s)" % (nm, sci)
        where = plist(c["countries"], 5) if c["countries"] else ""
        venom = "venomous" if c["venom"] else "non-venomous"
        if c["fossil"]:
            fa = c["died"]
            lead = "%s is a prehistoric snake%s, known only from fossils.%s" % (label, " of the family %s" % c["family"] if c["family"] else "",
                (" It died out in the %s, %s." % fa) if fa else "")
        elif c["extinct"]:  # died out: everything about it in the past tense
            lead = "%s was %s %s %s%s%s." % (label, an(venom), venom, kind(c), " of the family %s" % c["family"] if c["family"] else "",
                                            (" that lived in " + where) if where else "")
        else:
            lead = "%s is %s %s %s%s%s." % (label, an(venom), venom, kind(c), " of the family %s" % c["family"] if c["family"] else "",
                                           (", found in " + where) if where else "")
        gone = bool(c["extinct"] or c["fossil"])
        extra = []
        if c["extinct"]: extra.append(c["extinct"].replace(" - ", ": ", 1) + ".")
        if c["eater"]: extra.append("It was known to eat other snakes." if gone else "It is known to eat other snakes.")
        IST = intro_status(c) if (c["invasive"] or c["intro"]) else []
        for x in IST:
            extra.append(("It is invasive in %s, where people introduced it." if x["status"] == "invasive" else
                          "People introduced it to %s" + ((" " + x["when"]) if x.get("when") else "") + ".") % x["area"])
        rt = rarity_txt(c)
        about = lead + " " + " ".join(extra)
        # the title names the snake both ways and the 3D viewer, kept short enough for search results
        for title in [label + " \u2013 Explore in 3D | SnakeList", label + " \u2013 Explore in 3D", nm + " \u2013 Explore in 3D | SnakeList"]:
            if len(title) <= 70: break
        else: title = label + " \u2013 Explore in 3D"
        ov = (info or {}).get("sections", {}).get("overview") or []
        desc = (plain(ov[0]["text"]) if ov else (lead + (" " + extra[0] if extra else "")))
        desc = desc if len(desc) <= 300 else desc[:297].rsplit(" ", 1)[0] + "..."
        # the meta description: the 3D viewer first (so it survives truncation), then what the page says
        cut = desc.startswith(label + " ")
        has = (["photos"] if img_of(c) else []) + (["facts", "where its fossils were found"] if c["fossil"] else (["a range map"] if c["countries"] else []) + ["facts"])
        mdesc = ("Explore %s in 3D, with %s. " % (label if c["is_sci"] else "the " + label, ", ".join(has[:-1]) + " and " + has[-1] if len(has) > 1 else has[0])) + (
            ("It " + desc[len(label) + 1:]) if cut else desc)
        mdesc = mdesc if len(mdesc) <= 300 else mdesc[:297].rsplit(" ", 1)[0] + "..."
        url = SITE + "species/" + page_name(c)
        # link previews: SnakeList's own copy of the photo on snakelist.com where it has one
        p0 = c["photo"]
        own = ("species-photos/t/%d-%d.webp" % (p0[0], p0[1])) if p0 and len(p0) >= 5 and "Illustration" not in p0[2] else None
        own = SITE + own if own and os.path.exists(own) else None
        img = own or img_of(c, "large") or (SITE + "snakelist-logo.png")
        img_alt = ("Photo of " + label) if (own or img_of(c)) else "SnakeList logo"
        R = Refs(info, by_id, page_name)
        # where it lives, country by country, with its states/provinces
        provs = {}
        for pkey in c["provinces"]:
            cc, _, pn = pkey.partition(":"); provs.setdefault(cc.lower(), []).append(pn)
        if c["states"]: provs.setdefault("us", []).extend(c["states"])
        # a province it was only brought to (the Balearics for the Viperine Snake) is not native range
        for x in invasive.get(c["id"]) or []:
            if x.get("code") and x.get("areas") and x["code"] in provs:
                provs[x["code"]] = [n for n in provs[x["code"]] if n not in x["areas"]]
                if not provs[x["code"]]: del provs[x["code"]]
        def place(n):  # a country name, linking to the app's map on that country
            return '<a href="../?map=%s">%s</a>' % (esc(quote(n)), esc(n)) if n in iso else esc(n)
        rows = []
        for i, n in enumerate(c["countries"]):  # countries only - the states are on the map
            rows.append("<li%s><b>%s</b>%s</li>" % (xcls(i, len(c["countries"])), place(n), ' <small class="sp-terr">territory</small>' if n in NONSOV else ""))
        codes = [iso[n] for n in c["countries"] if n in iso]
        # introduced / invasive places: their own colour on the map (unless also native there)
        inv = invasive.get(c["id"]) or [{"name": a, "code": "", "note": ""} for a in c["intro"]]
        icodes, dots, ishapes, iboxes = [], [], [], []
        for x in inv:
            cc = x["code"] or iso.get(x["name"], "")
            # the same word as the summary and key facts: "Invasive" only where a cited source says so
            lab = "Invasive" if any(y["status"] == "invasive" and y["area"] == (x.get("note") or x["name"]) for y in IST) else "Introduced"
            rows.append("<li><b>" + lab + ":</b> %s%s</li>" % (esc(x["note"]) + " (" + place(x["name"]) + ")" if x.get("note") else place(x["name"]),
                        "" if x.get("note") or not x["name"] in NONSOV else ' <small class="sp-terr">territory</small>'))
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
            st_rows.append(st_row(cc, cname, names, " (islands)" if cc == "id" else " (introduced)" if cls == "in" else ""))
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
            st_rows.append(st_row(cc, x["name"], x["areas"], " (introduced)"))
        for x in inv:  # the states it was brought to (already drawn in orange, see ishapes)
            cc = x["code"] or iso.get(x["name"], "")
            if x.get("states") and cc not in provs:
                st_rows.append("<li><b>%s (introduced):</b> %s</li>" % (esc(x["name"]), esc(", ".join(region.us_names.get(n, n) if cc == "us" else n for n in x["states"]))))
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
        # each label says what it measures: how well known it is (SnakeList's Popular / Uncommon),
        # how often it's recorded on iNaturalist (Common / Rare) - two different things - and where
        # it's exotic (SnakeList's "Exotic" means not native to North America)
        tags.append(("Popular (well known)", "f=chip-popular") if c["popular"] else ("Less well known", "f=chip-uncommon"))
        if "North America" not in c["continents"] and c["continents"]: tags.append(("Exotic to North America", "f=chip-exotic"))
        if rt.startswith("Common"): tags.append(("Often recorded on iNaturalist", "f=chip-common"))
        if rt.startswith("Rare"): tags.append(("Rarely recorded on iNaturalist", "f=chip-rare"))
        tags.append(("Venomous", "f=chip-venom") if c["venom"] else ("Non-venomous", "f=chip-nonvenom"))
        hm = harm(c)
        if hm: tags.append(("Dangerous to people" if hm == "harmful" else "Not dangerous to people", "f=chip-" + hm))
        cons = constriction(c)  # documented for its family or genus, same list as the app (#constrictor-data)
        if cons == "yes": tags.append(("Constrictor", "f=chip-constrictor"))
        elif cons == "no": tags.append(("Non-constrictor", "f=chip-nonconstrictor"))
        if c["invasive"]:  # the app's filter groups every introduced population; the label says which they are
            inv_areas = [x["area"] for x in IST if x["status"] == "invasive"]
            tags.append((("Invasive in " + plist(inv_areas, 2)) if inv_areas else ("Introduced to " + plist([x["area"] for x in IST], 2)), "f=chip-invasive"))
        if c["eater"]: tags.append(("Snake eater", "f=chip-snakeeater"))
        if c["extinct"] or c["fossil"]: tags.append(("Fossil" if c["fossil"] else c["extinct"].split(" - ")[0].split(" since")[0], "f=chip-extinct"))
        if c["type"] and c["type"] != "Other": tags.append((c["type"], "type=" + quote(c["type"])))
        if c["family"]: tags.append((c["family"], "fam=" + quote(c["family"])))
        if c["fossil"]:  # nothing about living snakes (venom, danger, iNaturalist, where it is exotic) applies to a fossil
            tags = [t for t in tags if t[1] in ("f=chip-extinct",) or t[1].startswith(("type=", "fam="))]
        # related: its own genus first (its closest relatives), then - when the genus is small - a
        # few more of its family, each group labelled with how it's related
        def relkey(x): return (bool(x["fossil"] or x["extinct"]), not x["popular"], x["name"].lower())
        rel_g = sorted([x for x in by_genus.get(c["genus"], []) if x is not c], key=relkey)
        rel_f = sorted([x for x in by_family.get(c["family"], []) if x is not c and x["genus"] != c["genus"]], key=relkey)[:max(0, 8 - len(rel_g))] if c["family"] else []
        S = (info or {}).get("sections", {})
        F = (info or {}).get("facts", {})
        FI = FOSSIL.get(c["id"], {}) if c["fossil"] else {}
        G = GENUS_INFO.get(c["genus"]) if c["genus"] else None
        if G: R.add("genus", {"title": "Meaning of the name %s" % c["genus"], **G["source"]})
        for x in IST:
            if x.get("src"): R.add("intro-%s" % slugify(x["area"]), x["src"])
        if ov:
            intro_html = R.para(ov[0], "sp-intro") + "".join(R.para(x, "sp-intro2") for x in ov[1:])
        else:
            intro_html = '<p class="sp-intro">%s</p>' % esc(" ".join([lead] + extra)).replace("(%s)" % esc(sci), "(<i>%s</i>)" % esc(sci), 1)
        if info and info.get("status") == "limited":
            intro_html += ('<p class="sp-limited"><b>Little is known about this species.</b> Only a few published studies describe it, so this page gives just '
                           'what they record and says &ldquo;Not known&rdquo; for the rest.</p>')
        if not info and not c["fossil"]: intro_html += '<div id="sp-wiki"></div>'

        # ---- key facts: the same six labels on every living species' page (fossils get their own) ----
        UNK = '<span class="sp-unk">Not known</span>'
        def fact(k):
            f = F.get(k)
            return (R.rich(f["text"]) + R.cite(f.get("src"))) if f and f.get("text") else None
        am = build_regions.authority(INFO, c)
        kf = []
        if c["fossil"]:
            fa = c["died"]
            kf.append(("Status", "Extinct &ndash; known only from fossils"))
            kf.append(("Geological age", esc("%s, %s" % (fa[0][0].upper() + fa[0][1:], fa[1])) if fa else UNK))
            kf.append(("Fossils found in", '<a href="#range">%s</a>' % esc(plist(c["countries"], 3)) if c["countries"] else UNK))
            kf.append(("Estimated length", fact("length") or UNK))
            kf.append(("Diet", fact("diet") or UNK))
            kf.append(("First described", esc(("%s et al., %d" % (re.split(r",|&| and ", am[1])[0].strip(), am[2])) if am[1].count(",") >= 2 else "%s, %d" % (am[1], am[2])) if am else UNK))
        else:
            if F.get("venom"): vt = fact("venom")
            elif c["venom"]: vt = "Venomous &ndash; dangerous to people" if hm == "harmful" else "Mildly venomous &ndash; no serious bites to people documented"
            else: vt = "Not venomous &ndash; but big enough to injure people" if hm == "harmful" else "Not venomous to people &ndash; it can still bite"
            if gone and not F.get("venom"): vt = "Venomous" if c["venom"] else "Not venomous"  # an extinct snake bites nobody now
            kf.append(("Venom", vt))
            kf.append(("Adult length", fact("length") or UNK))
            kf.append(("Diet", fact("diet") or UNK))
            kf.append(("Reproduction", fact("reproduction") or UNK))
            # no conservation status (it came from iNaturalist): the snake's size instead, from the sourced
            # adult length: under 50 cm small, 50-150 cm medium, over 150 cm large (nothing without a length)
            lm = build_regions.length_m(info)
            if lm:
                mid = (lm[0] + lm[1]) / 2
                kf.append(("Size", "Small-sized" if mid < 0.5 else "Medium-sized" if mid <= 1.5 else "Large-sized"))
            if c["extinct"]:
                kf.append(("Status", esc(c["extinct"].split(" - ")[0])))
            if c["countries"]:
                dist = '<a href="#range">%s</a>' % (("Formerly " if c["extinct"] else "") + places_txt(c["countries"]))
                if c["continents"]: dist += " <small>&middot; %s</small>" % esc(", ".join(c["continents"]))
            else:
                dist = UNK
            if IST:
                dist += "<small class=\"sp-kintro\">%s</small>" % "; ".join(
                    esc(("Invasive in %s" if x["status"] == "invasive" else "Introduced to %s") % x["area"]) for x in IST)
            kf.append(("Distribution", dist))
        keyfacts = "".join('<div><dt>%s</dt><dd>%s</dd></div>' % (esc(f[0]), f[1]) for f in kf)

        # ---- photo, with a readable credit linking to the original record ----
        photo = img_of(c); p = c["photo"]
        if c["fossil"]:  # no photo can exist, and its colours are unknown: no painted life reconstruction
            ph = ('<figure class="sp-photo sp-nophoto sp-fossilfig"><div><b>Known only from fossils</b><span>No photo can exist, and its colours '
                  'and pattern are unknown, so SnakeList shows no life reconstruction.</span></div></figure>')
        elif photo:
            who, _, lic = p[2].rpartition(", ")
            if not who: who, lic = p[2], ""
            pid = p[4].split(".")[0] if len(p) >= 5 else ""
            ph = ('<figure class="sp-photo"><img src="%s" data-fb="../species-photos/t/%d-%d.webp" alt="%s" width="500" height="333" fetchpriority="high">'
                  '<figcaption>Photo &copy; %s%s%s</figcaption></figure>') % (
                esc(photo), p[0], p[1], esc("Photo of %s" % ((nm + " (" + sci + ")") if not c["is_sci"] else sci)),
                esc(who), (", " + lic_link(lic)) if lic else "",
                (' &middot; cropped &middot; <a href="https://www.inaturalist.org/photos/%s" rel="noopener">original photo</a>' % esc(pid)) if pid.isdigit() else "")
        elif p:
            ph = '<figure class="sp-photo"><div class="sp-sprite" role="img" aria-label="%s" style="%s"></div><figcaption>%s</figcaption></figure>' % (esc("Illustration of " + label), sprite(c), esc(p[2]))
        else:
            ph = '<figure class="sp-photo sp-nophoto"><div>No photo of this snake yet</div></figure>'

        # ---- the sections, in reading order ----
        def paras(key, h3=None):
            ps = S.get(key) or []
            if not ps: return ""
            return ('<h3>%s</h3>' % h3 if h3 else "") + "".join(R.para(x) for x in ps)
        secs = []
        if c["fossil"]:
            # what the fossils are, where and when - and how sure anyone can be
            fos = paras("fossils", "What has been found") + paras("geology", "Geological age and setting")
            if not S.get("geology") and c["died"]:
                fos += '<h3>Geological age</h3><p>It lived in the %s, %s%s.</p>' % (esc(c["died"][0]), esc(c["died"][1]),
                        (" (dated from the rocks its fossils were found in)") if FI else "")
            if not S.get("fossils") and FI.get("discovered"):
                fos += '<h3>Where it was found</h3><p>%s.</p>' % esc(FI["discovered"])
            fos += paras("size", "Size estimate")
            if not S.get("size") and FI.get("length_note"):
                fos += '<h3>Size estimate</h3><p>%s</p>' % esc(FI["length_note"])
            fos += paras("uncertainty", "What is uncertain")
            if not S.get("uncertainty") and FI.get("dispute"):
                fos += '<h3>What is uncertain</h3><p>%s</p>' % esc(FI["dispute"])
            fos += paras("palaeoenvironment", "Its world") + paras("diet", "Diet")
            if not S and FI.get("sources"):
                fos += '<p class="sp-note">From: %s</p>' % ", ".join('<a href="%s" rel="noopener">%s</a>' % (esc(u), esc(re.sub(r"^https?://(www\.)?", "", u).split("/")[0])) for u in FI["sources"])
            secs.append(("fossil", "Fossils and geological context", fos or '<p class="sp-muted">Not known.</p>'))
        else:
            ident = paras("identification", "Appearance") + paras("juvenile", "Adults and young") + paras("variation", "Variation") + paras("size", "Size")
            if ident: secs.append(("identification", "Identification", ident))
        # range: the published account, then SnakeList's country-level map and regions, then observations
        obs = ""  # (v4.63: no iNaturalist records section)
        secs.append(("range", "Where its fossils were found" if c["fossil"] else "Distribution", None))  # filled in by the template (the map)
        pub_html = paras("distribution", "Published distribution")
        if IST and not S.get("distribution"):
            pub_html += "<h3>Introduced populations</h3>" + "".join(
                "<p><b>%s:</b> %s%s%s</p>" % (esc(x["area"]), "Invasive. " if x["status"] == "invasive" else "Introduced by people%s. " % ((" " + x["when"]) if x.get("when") else ""),
                                            esc(x.get("text", "")), R.cite(["intro-%s" % slugify(x["area"])]) if x.get("src") else "") for x in IST)
        if not c["fossil"]:
            eco = paras("habitat", "Habitat") or ('<h3>Habitat types in its range <small>rough estimate</small></h3>' + hab_html(c, gone))
            # the one-line activity fact only where no fuller behaviour text says it again
            eco += paras("activity", "Activity") or (("<h3>Activity</h3><p>%s</p>" % fact("activity")) if F.get("activity") and not S.get("behaviour") else "")
            eco += paras("behaviour", "Behaviour") + paras("diet", "Diet") + paras("reproduction", "Reproduction") + paras("longevity", "Lifespan")
            if info and info.get("funfacts"):
                eco += '<div class="sp-fun"><h3>Did you know?</h3><ul>%s</ul></div>' % "".join(
                    "<li>%s%s</li>" % (R.rich(x["text"]), R.cite(x.get("src"))) for x in info["funfacts"])
            secs.append(("ecology", "Behaviour and ecology", eco))
            # no Red List status on the pages (it came from iNaturalist); only sourced conservation notes
            cons_html = paras("conservation")
            if c["extinct"]: cons_html = '<p><b>%s.</b></p>' % esc(c["extinct"].replace(" - ", ": ", 1)) + cons_html
            if cons_html: secs.append(("conservation", "Conservation", cons_html))
        else:
            eco = paras("behaviour", "Behaviour") + paras("habitat", "Habitat")
            if eco: secs.append(("ecology", "What it may have been like", '<p class="sp-note">Inferred from the fossils and the rocks around them, not observed.</p>' + eco))
        # similar species (how to tell them apart), its relatives, and the app's filters for snakes like it
        relx = ""
        if info and info.get("similar"):
            items = []
            for x in info["similar"]:
                o = by_id.get(x["id"])
                if not o: print("species-info %s: unknown similar species %s" % (c["id"], x["id"])); continue
                items.append('<li><a href="%s">%s</a>%s &ndash; %s%s</li>' % (page_name(o), esc(o["name"]), (" <i>%s</i>" % esc(o["sci"])) if not o["is_sci"] else "",
                                                                         R.rich(x["text"]), R.cite(x.get("src"))))
            relx += '<h3>Similar species and how to tell them apart</h3><ul class="sp-sim">%s</ul>' % "".join(items)
        relx += rel_html(c, rel_g, rel_f)
        relx += '<h3>Find snakes like it in the app</h3><ul class="sp-tags" aria-label="SnakeList filters">%s</ul>' % "".join(
            '<li><a href="../?%s">%s</a></li>' % (esc(q), esc(t)) for t, q in tags)
        secs.append(("related", "Similar and related snakes", relx))
        # taxonomy: the classification, who described it, what the genus name means, names it has had
        auth = am[0] if am else ""
        # a long list of authors: "Head et al., 2009" where space is short, the full authority in Taxonomy
        auth_short = ("%s et al., %d" % (re.split(r",|&| and ", am[1])[0].strip(), am[2])) if am and am[1].count(",") >= 2 else auth
        tx = '<dl class="sp-tax">'
        if c["family"]:
            fi = FAMILY_INFO.get(c["family"], {})
            tx += '<div><dt>Family</dt><dd><a href="family/%s">%s</a>%s</dd></div>' % (slugify(c["family"]), esc(c["family"]), (" (%s)" % esc(fi["common"])) if fi.get("common") else "")
        if c["genus"]:
            tx += '<div><dt>Genus</dt><dd><a href="genus/%s"><i>%s</i></a></dd></div>' % (slugify(c["genus"]), esc(c["genus"]))
        tx += '<div><dt>Species</dt><dd><i>%s</i>%s</dd></div></dl>' % (esc(sci), (" " + esc(auth)) if auth else "")
        if am:
            who = '<p class="sp-who-s">First described by <b>%s</b> in <b>%d</b><span class="sp-ago" data-y="%d"></span>.%s</p>' % (
                esc(am[1]), am[2], am[2], (" The brackets around the authority, %s, mean it was first described in a different genus." % esc(am[0])) if am[3] else "")
        else:
            who = '<p class="sp-who-s sp-muted">Author details not available.</p>'
        tx += '<div class="sp-who" id="sp-who" data-sci="%s" data-auth="%s"%s><h3>Who described it</h3>%s<div class="sp-who-p"></div></div>' % (
            esc(sci), esc(auth), (' data-y="%d"' % am[2]) if am else "", who)
        # where the names come from: the genus (sourced, or its plain Greek/Latin roots), the second
        # word of the scientific name, and the parts of the common name (tools/etymology.py)
        ety, epi = [], sci.split(" ")[1] if " " in sci else ""
        cname = "" if c["is_sci"] else c["name"]
        if G:
            ety.append('<p class="sp-ety"><i>%s</i>: %s%s</p>' % (esc(c["genus"]), R.rich(G["meaning"]), R.cite(["genus"])))
        elif ETY.genus(c["genus"]):
            ety.append('<p class="sp-ety"><i>%s</i>: %s</p>' % (esc(c["genus"]), ETY.genus(c["genus"])))
        ei = ETY.epithet(epi, c["countries"] + c["provinces"] + c["continents"], cname) if epi else None
        if ei: ety.append('<p class="sp-ety"><i>%s</i>: %s</p>' % (esc(epi), ei[1]))
        cn = ETY.common_name(cname, epi, ei, c["countries"] + c["provinces"] + c["continents"]) if cname else None
        if cn:
            ety.append('<p class="sp-ety"><b>%s</b>: %s.</p>' % (esc(cname), "; ".join(
                "&lsquo;%s&rsquo; &ndash; %s" % (esc(w), t) for w, t in cn)))
        if ety:
            tx += ('<h3>Where the name comes from</h3>%s<p class="sp-note">Worked out from the Latin and Greek roots and the words in the name; '
                   'parts SnakeList can&rsquo;t explain are left out.</p>') % "".join(ety)
        tx += paras("taxonomy", "Classification notes")
        syn = (info or {}).get("synonyms")
        if syn and syn.get("names"):
            tx += '<details class="sp-det"><summary>Other scientific names it has had (%d)</summary><ul>%s</ul>%s</details>' % (
                len(syn["names"]), "".join("<li>%s</li>" % R.rich(s) for s in syn["names"]), ('<p class="sp-note">Source%s</p>' % R.cite(syn.get("src"))) if syn.get("src") else "")
        if not c["fossil"]:  # the Reptile Database keeps the older names (synonyms) with who used them and when: point there
            g1, _, s1 = sci.partition(" ")
            tx += ('<p class="sp-note">%s <a href="https://reptile-database.reptarium.cz/species?genus=%s&amp;species=%s" rel="noopener">The Reptile Database</a> '
                   'keeps a list of its older scientific names, with who used them and when.</p>') % (
                "For more," if syn and syn.get("names") else "SnakeList doesn&rsquo;t list its older scientific names.", quote(g1), quote(s1.split(" ")[0]))
        secs.append(("taxonomy", "Taxonomy", tx))
        # sources: the numbered references, the photo, where to look further, provenance and the dates
        src = ""
        if FI.get("sources") and not info:
            for k, u in enumerate(FI["sources"]):
                R.add("fos%d" % k, {"title": re.sub(r"^https?://(www\.)?", "", u).split("/")[0], "url": u}); R.cite(["fos%d" % k])
        refs = R.list_html()
        if refs:
            src += '<details class="sp-det sp-refd"%s><summary>References (%d)</summary>%s</details>' % (" open" if len(R.order) <= 8 else "", len(R.order), refs)
        else:
            src += ('<p>SnakeList has no reviewed species account for this snake yet. The facts on this page come from SnakeList&rsquo;s own checklist '
                    'data (names, family, venom, and the countries, states and provinces where it is recorded).</p>')
        if photo and not c["fossil"]:
            w3, _, l3 = p[2].rpartition(", ")
            src += '<p><b>Photo:</b> &copy; %s, used under %s; cropped and resized by SnakeList. <a href="photo-credits.html#%s">All photo credits</a>.</p>' % (
                esc(w3 or p[2]), lic_link(l3) if w3 else "its Creative Commons licence", esc(c["id"]))
        if not c["fossil"]:
            g0, _, s0 = sci.partition(" ")
            src += ('<h3>Look it up</h3><p class="sp-links"><a href="https://reptile-database.reptarium.cz/species?genus=%s&amp;species=%s" rel="noopener">The Reptile Database</a>'
                    '<a href="https://www.inaturalist.org/taxa/search?q=%s" rel="noopener">iNaturalist</a><a href="https://www.iucnredlist.org/search?query=%s&amp;searchType=species" rel="noopener">IUCN Red List</a>'
                    '<a href="https://www.gbif.org/species/search?q=%s" rel="noopener">GBIF</a></p>') % (quote(g0), quote(s0.split(" ")[0]), quote(sci), quote(sci), quote(sci))
        src += ('<details class="sp-det sp-prov"><summary>How this page is made</summary><ul>'
                '<li>Countries, states and provinces, venom and family come from SnakeList&rsquo;s checklist; the map shades whole countries and regions, not exact range.</li>'
                '%s<li id="sp-wdprov">%s</li></ul></details>') % (
            "<li>Facts with numbered references come from the reviewed species account; anything the sources do not cover is shown as &ldquo;Not known&rdquo;.</li>" if info else "",
            ("Who described it: from the authority %s%s." % (esc(am[0]), " in the reviewed account" if (info and info.get("authority")) else " (checked by SnakeList)")) if am else
            "Who described it: SnakeList has no checked record yet, so a name from Wikidata is shown only if it passes basic checks.")
        src += '<p class="sp-dates">%s<span>Page generated %s</span></p>' % (
            ('<span>Information last reviewed %s</span>' % fmt_date(info["reviewed"])) if info and info.get("reviewed") else "", GEN_MARK)
        secs.append(("sources", "Sources", src))
        toc_names = {"fossil": "Fossils", "identification": "Identification", "range": "Where found" if c["fossil"] else "Distribution",
                     "ecology": "Behaviour" if not c["fossil"] else "Way of life", "conservation": "Conservation", "related": "Related", "taxonomy": "Taxonomy", "sources": "Sources"}
        toc = "".join('<a href="#%s">%s</a>' % (k, toc_names[k]) for k, _, _ in secs if k in toc_names)
        def sec_html(k, h, body):
            return '<section id="%s" class="sp-sec"><h2>%s</h2>%s</section>' % (k, h, body)
        ri = [s[0] for s in secs].index("range")
        before = "".join(sec_html(*s) for s in secs[:ri])
        after = "".join(sec_html(*s) for s in secs[ri + 1:])
        # ---- "Explore in 3D" > Information: what this page says, as data for the dialog (sp.js) ----
        def txt(h):  # a key fact's HTML as plain text, without its little source numbers
            h = re.sub(r'<sup class="sp-ref">.*?</sup>', "", h)
            h = re.sub(r'<small class="sp-kintro">', "; ", h)
            h = re.sub(r"<small[^>]*>", " ", h)
            return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", "", h))).strip()
        def sentences(t): return [x.strip() for x in re.split(r"(?<=[.!?])\s+(?=[A-Z])", plain(t)) if x.strip()]
        funp = list((info or {}).get("funfacts") or [])
        allp = [x for k in sorted(S) for x in S[k]] + funp
        fang_s, life_s = [], []
        for x in allp:
            if x in funp and fang_s and re.search(r"\bfang", x["text"], re.I): continue  # a fun fact saying it again
            lab = (x.get("label") or "").lower()
            if lab in ("lifespan", "longevity", "life span"):
                life_s.append(plain(x["text"])); continue
            for t in sentences(x["text"]):
                if re.search(r"\bfang", t, re.I) and t not in fang_s: fang_s.append(t)
                if re.search(r"lifespan|life span|longevity|\blive[sd]?\b[^.]*\b\d+\s*years|\bage of \d+", t, re.I) and t not in life_s: life_s.append(t)
        measured = [t for t in fang_s if re.search(r"\d\s*(?:mm|cm)\b", t)]
        if measured: fang_s = measured  # the sentences with the fang sizes
        for x in S.get("longevity") or []:
            if plain(x["text"]) not in life_s: life_s.append(plain(x["text"]))
        hab = " ".join(plain(x["text"]) for x in (S.get("habitat") or [])[:1])
        if not hab and not c["fossil"] and c["habitats"]:
            kinds = [k for k in HAB_KIND_ORDER if any(hab_kind(h) == k for h in c["habitats"])]
            if kinds: hab = "A rough estimate from the places where it %s recorded (not checked for this species): %s." % ("was" if gone else "is", ", ".join(kinds).lower())
        sp_info = {"intro": [plain(x["text"]) for x in ov] or [" ".join([lead] + extra)],
                   "limited": bool(info and info.get("status") == "limited"),
                   "facts": [[f[0], txt(f[1])] for f in kf] + ([["Habitat", hab]] if hab else []),
                   "fangs": fang_s, "fangsize": any(re.search(r"\d\s*(?:mm|cm)\b", t) for t in fang_s),
                   "life": life_s, "fun": [plain(x["text"]) for x in (info or {}).get("funfacts") or []][:4],
                   "fossil": c["fossil"], "gone": gone, "acct": bool(info)}
        info_json = '<script type="application/json" class="sp-info-data">%s</script>' % json.dumps(sp_info, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
        mp = MODELS.get(c["id"])
        ax = ((mp or {}).get("auto") or {}).get("x", "") if mp else ""
        if not mp: m3 = None
        elif not (mp or {}).get("auto"):
            m3 = "An interactive 3D reconstruction of %s, built by SnakeList from published descriptions and photos: the body proportions, head shape, scales, colours and markings of a typical adult." % label
        elif "f" in ax:
            m3 = "An interactive 3D reconstruction of how %s may have looked, from the body shape of its family and the size estimated from its fossil bones. Its colours are a guess, because fossils keep no colour." % label
        else:
            m3 = "An interactive 3D model of %s generated by SnakeList from the body shape of its family, %s and %s." % (
                label, "a typical size for its group" if "l" in ax else "its recorded size",
                "colours that are a guess for its group" if "g" in ax else "colours and markings taken from its SnakeList photo")
        the = label if c["is_sci"] else "the " + label
        m3 = m3.replace(" of " + label, " of " + the, 1).replace(" how " + label, " how " + the, 1) if m3 else m3
        tax_id = url + "#taxon"
        ld = [{"@context": "https://schema.org", "@type": "Taxon", "@id": tax_id, "name": sci, "alternateName": [nm] if not c["is_sci"] else [],
               "taxonRank": "species", "url": url, "image": img, "description": desc,
               "parentTaxon": {"@type": "Taxon", "name": c["genus"], "taxonRank": "genus",
                               "parentTaxon": {"@type": "Taxon", "name": c["family"], "taxonRank": "family"} if c["family"] else None} if c["genus"] else None},
              {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
                  {"@type": "ListItem", "position": 1, "name": "SnakeList", "item": SITE},
                  {"@type": "ListItem", "position": 2, "name": "All species", "item": SITE + "species/"},
                  {"@type": "ListItem", "position": 3, "name": nm, "item": url}]}]
        if not ld[0]["alternateName"]: del ld[0]["alternateName"]
        if not ld[0]["parentTaxon"]: del ld[0]["parentTaxon"]
        elif not ld[0]["parentTaxon"]["parentTaxon"]: del ld[0]["parentTaxon"]["parentTaxon"]
        if m3:
            ld[0]["subjectOf"] = {"@id": url + "#real"}
            ld.append({"@context": "https://schema.org", "@type": "3DModel", "@id": url + "#real", "name": "%s 3D model" % (nm if not c["is_sci"] else sci),
                       "url": url + "#real", "description": m3 + " It opens in an interactive WebGL viewer on this page (\u201cExplore in 3D\u201d); it is not a scan of a real snake.",
                       "about": {"@id": tax_id}, "isPartOf": {"@type": "WebPage", "@id": url, "url": url, "name": title},
                       "image": img, "isAccessibleForFree": True, "inLanguage": "en",
                       "creator": {"@type": "Organization", "name": "SnakeList", "url": SITE}})
        nterr = sum(1 for n in c["countries"] if n in NONSOV)
        if c["fossil"]:
            actions = '<a class="sp-btn sp-btn2" href="../?sp=%s">Open in the SnakeList app</a>' % c["id"]
            actnote = "Fossil snakes are in the app&rsquo;s checklist too, but there is nothing alive to see."
        else:
            actions = ('<a class="sp-btn" href="../?sp=%s&amp;do=seen"><span aria-hidden="true">&#10003; </span>Mark seen</a>'
                       '<a class="sp-btn sp-btn2" href="../?sp=%s&amp;do=want"><span aria-hidden="true">&#9734; </span>Want to see</a>') % (c["id"], c["id"])
            if c["countries"]: actions += '<a class="sp-btn sp-btn2" href="../?map=%s">View on map</a>' % esc(quote(sci))
            actnote = ("&ldquo;Mark seen&rdquo; and &ldquo;Want to see&rdquo; open this snake in the SnakeList app, where your lists are kept on your device &ndash; "
                       "tap the highlighted button on its card. &ldquo;View on map&rdquo; opens the app&rsquo;s map on it.")
        page = PAGE.format(
            title=esc(title), desc=esc(mdesc), url=url, img=esc(img), img_alt=esc(img_alt), info_json=info_json, ld=json.dumps(ld, ensure_ascii=False).replace("</", "<\\/"),
            h1=esc(nm), sub=('<i>%s</i>%s' % (esc(sci), (' <span class="sp-auth">%s</span>' % esc(auth_short)) if auth else "")) if not c["is_sci"] else (esc(auth_short) if auth else ""),
            fossil_flag=('<p class="sp-fossil-flag">Extinct &middot; fossil snake%s</p>' % (" &middot; " + esc(c["died"][0]) if c["died"] else "")) if c["fossil"] else
                        ('<p class="sp-fossil-flag">%s</p>' % esc(c["extinct"].split(" - ")[0])) if c["extinct"] else "",
            photo=ph, intro=intro_html, keyfacts=keyfacts, toc=toc, before=before, after=after,
            actions=actions, actnote=actnote, range_h=dict((k, h) for k, h, _ in secs)["range"],
            pub=pub_html, obs=obs,
            where_h=("Country where the fossils were found" if len(c["countries"]) == 1 else "Countries where the fossils were found") if c["fossil"] else
                    "%s where it %s recorded <small>(%s)</small>" % ("Countries and territories" if nterr else "Countries", "was" if gone else "is", places_txt(c["countries"])) if c["countries"] else "Countries",
            where="".join(rows) or "<li>No range recorded yet.</li>", where_all=see_all("places", len(c["countries"])),
            st=esc(json.dumps(st_data, ensure_ascii=False, separators=(",", ":"))) if st_data else "", sview=esc(sview or "0 0 1440 720"),
            ns=esc(json.dumps(ns, separators=(",", ":"))) if ns else "",
            stbtn="" if c["fossil"] else ('<button type="button" class="sp-all sp-stbtn" aria-pressed="false">Show states &amp; provinces</button>' if st_rows or ns else "") +
                  ('<button type="button" class="sp-all sp-ctbtn" aria-pressed="false">See cities</button>' if cities else ""),
            cities_json=esc(json.dumps([[round(t[3], 2), round(t[4], 2), t[0]] for t in cities], ensure_ascii=False)),
            cities_list=('<div class="sp-cities"><h3>Cities in its range</h3><p class="sp-note">Big cities inside the states and provinces where it is recorded - not individual sightings.</p><ul class="sp-where">%s</ul></div>' % "".join(
                "<li>%s <small>%s</small></li>" % (esc(t[0]), esc(t[1])) for t in cities)) if cities and not c["fossil"] else "",
            states=('<details class="sp-states sp-det"><summary>States, provinces and islands where it %s recorded</summary><p class="sp-note">More detail than the countries, but still approximate. The number after each place is how many snake species SnakeList records there <b>in all</b>, not how many records there are of this snake.</p><ul class="sp-where">%s</ul></details>' % ("was" if gone else "is", "".join(st_rows))) if (st_rows or ns) and not c["fossil"] else "",
            codes=esc(" ".join(codes)), intro_codes=esc(" ".join(icodes)),
            ishapes="".join('<path class="in" d="%s"/>' % d for d in ishapes),
            dots=esc(" ".join("%.1f,%.1f,%s,%.2g" % ((lo + 180) * 4, (90 - la) * 4, k, sz) for lo, la, k, sz in dots)),
            legend=('<p class="sp-legend"><span><i class="on"></i>%s</span>%s</p>' % ("Fossil find (by country)" if c["fossil"] else "Former range (by country)" if gone else "Native (by country)",
                '<span><i class="in"></i>Introduced by people</span>' if icodes or ishapes or any(d[2] == "in" for d in dots) else "")) if codes or icodes or ishapes or dots else "", view=esc(view or "0 0 1440 720"), sci_attr=esc(sci), id=c["id"],
            sci_q=esc(quote(sci)),
            nplaces_txt=places_txt(c["countries"]) if c["countries"] else "the places", lives="lived" if gone else "lives", safe_hidden=" hidden" if gone else "",
            site_head=site_header("../", "species"), site_foot=site_footer("../"),
            crumb_tax=((' &rsaquo; <a href="family/%s">%s</a>' % (slugify(c["family"]), esc(c["family"]))) if c["family"] else "") + ((' &rsaquo; <a href="genus/%s"><i>%s</i></a>' % (slugify(c["genus"]), esc(c["genus"]))) if c["genus"] and not c["fossil"] else ""),
            author=AUTHOR, venom_cls="v" if c["venom"] else "nv",
            realbtn='<button type="button" class="sp-btn sp-btn2 sp-realbtn" aria-haspopup="dialog">Explore in 3D</button>',
            lenattr=len_attr(info),
            mapnote=('<p class="sp-note sp-mapnote">%s</p>' % ("The shaded country is where its fossils were found &ndash; not a living range." if c["fossil"] else
                     ("Shaded countries are those where it was recorded &ndash; it did not live everywhere inside them." if gone else
                      "Shaded countries are those where it is recorded &ndash; it does not live everywhere inside them.")))
                    if codes or icodes or ishapes or dots else '<p class="sp-muted">No range data for this snake yet.</p>')
        pd = dates.get(page_name(c), page)
        PAGE_LASTMOD[url] = pd
        page = page.replace(GEN_MARK, fmt_date(pd))
        open("%s/%s.html" % (OUT, page_name(c)), "w", encoding="utf-8").write(page)
        if page_name(c) != c["id"]:  # the old address (and the app's ?sp ids) still lead here
            open("%s/%s.html" % (OUT, c["id"]), "w", encoding="utf-8").write(REDIRECT.format(name=esc(c["name"]), url=url, page=page_name(c)))
        links.append(c)
    dates.save()
    # the "See states" shapes: one small file per country, fetched only when the button is pressed
    os.makedirs(OUT + "/prov", exist_ok=True)
    for cc in sorted(prov_used):
        with open("%s/prov/%s.json" % (OUT, cc), "w", encoding="utf-8") as fh:
            json.dump({nm: e["d"] for nm, e in region.provinces(cc).items()}, fh, ensure_ascii=False, separators=(",", ":"))
    # the A-Z of every species, by family - one crawlable page linking them all
    fams = sorted(by_family.items(), key=lambda kv: (kv[0] == "", kv[0]))
    cnt = {}
    for c in cards:
        for n in c["countries"]: cnt[n] = cnt.get(n, 0) + (0 if c["fossil"] or c["extinct"] else 1)  # living species, as the country pages count them
    countries = [(n, k) for n, k in sorted(cnt.items()) if slugify(n)]
    fid = lambda f: "f-" + (slugify(f) or "other")
    tools = ('<div class="sx-tools">'
             '<form class="sx-box" role="search" onsubmit="return false"><label for="sx-q">Find a snake</label>'
             '<input id="sx-q" type="search" placeholder="Common or scientific name..." autocomplete="off"><p id="sx-n" class="sp-note" aria-live="polite"></p></form>'
             '<form class="sx-box" id="sx-cf" role="search" action="#by-country"><label for="sx-c">Snakes of a country</label><span class="sx-row">'
             '<input id="sx-c" list="sx-cl" placeholder="Type a country..." autocomplete="off"><button type="submit">Go</button></span>'
             '<datalist id="sx-cl">%s</datalist></form></div>') % "".join('<option value="%s">' % esc(n) for n, k in countries)
    jump = ('<nav class="sx-jump" aria-label="Jump to"><a href="#by-country">By country</a><a href="#by-family">Families</a><a href="#az">A-Z by family</a></nav>'
            '<nav class="sx-chips" aria-label="Families">%s</nav>') % "".join(
        '<a href="#%s">%s <small>%s</small></a>' % (fid(f), esc(f or "Other"), "{:,}".format(len(L))) for f, L in fams)
    hub_lists = ('<section id="by-country"><h2>Snakes by country</h2><ul class="sp-hubs">%s</ul></section>' % "".join(
        '<li><a href="country/%s">%s</a> <small>%s</small></li>' % (slugify(n), esc(n), "{:,}".format(k)) for n, k in countries) +
        '<section id="by-family"><h2>Snake families</h2><ul class="sp-hubs">%s</ul></section>' % "".join(
        '<li><a href="family/%s">%s</a> <small>%s</small></li>' % (slugify(f), esc(f), "{:,}".format(len(L))) for f, L in fams if f))
    body = '<div id="az">' + "".join('<section class="sx-fam" id="%s"><h2>%s <small>%s</small></h2><ul class="sp-az">%s</ul></section>' % (
        fid(f), ('<a href="family/%s">%s</a>' % (slugify(f), esc(f))) if f else "Other snakes", "{:,}".format(len(L)), "".join('<li><a href="%s">%s</a>%s</li>' % (
            page_name(x), esc(x["name"]), (" <i>%s</i>" % esc(x["sci"])) if not x["is_sci"] else "") for x in sorted(L, key=lambda x: x["name"].lower())))
        for f, L in fams) + '</div><p id="sx-none" class="sp-muted" hidden>No snake matches that name. Try part of the name, or the scientific name.</p>'
    body = tools + jump + hub_lists + body
    cslugs = json.dumps({n: slugify(n) for n, k in countries}, ensure_ascii=False).replace("</", "<\\/")
    open(OUT + "/index.html", "w", encoding="utf-8").write(INDEX.format(n="{:,}".format(len(cards)), body=body, author=AUTHOR, url=SITE + "species/",
        nfam=len([f for f, L in fams if f]), ncountry="{:,}".format(len(countries)), cslugs=cslugs,
        site_head=site_header("../", "species"), site_foot=site_footer("../", "Every photo belongs to its photographer and is used under the Creative Commons licence they chose, credited with it.")))
    credits_page(cards, esc)
    reg_urls = build_regions.build(cards, by_id, INFO, invasive, iso, harm)
    return [SITE + "species/"] + [SITE + "species/" + page_name(c) for c in links] + hubs(cards, esc, img_of, invasive) + reg_urls


def credits_page(cards, esc):
    """species/photo-credits.html: every photo SnakeList shows, with its photographer, its licence
    (linked to the official Creative Commons deed), a link to the original and what SnakeList changed"""
    rows = []
    for c in sorted(cards, key=lambda x: x["name"].lower()):
        p = c.get("photo")
        if not p or "Illustration" in p[2]: continue
        who, _, lic = p[2].rpartition(", ")
        if not who: who, lic = p[2], ""
        pid = p[4].split(".")[0] if len(p) >= 5 else ""
        orig = ('<a href="https://www.inaturalist.org/photos/%s" rel="noopener">original</a>' % esc(pid)) if pid.isdigit() else "&ndash;"
        rows.append('<tr id="%s"><td><a href="%s">%s</a></td><td>%s</td><td>%s</td><td>%s</td></tr>' % (
            esc(c["id"]), page_name(c), esc(c["name"]), esc(who), lic_link(lic), orig))
    fam = json.loads(re.search(r'<script type="application/json" id="family-photos">(.*?)</script>', APP[0], re.S).group(1))
    frows = []
    for f, v in sorted(fam.items()):
        b = re.sub(r"^\(c\)\s*", "", v.get("by", "")).replace(", via iNaturalist", "")
        who, _, lic = b.rpartition(", ")
        frows.append('<tr><td>%s</td><td>%s</td><td>%s</td></tr>' % (esc(f), esc(who or b), lic_link(lic)))
    ill = sum(1 for c in cards if c.get("photo") and "Illustration" in c["photo"][2])
    html = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Photo credits | SnakeList</title><meta name="description" content="Who took every snake photo on SnakeList, and the Creative Commons licence each one is used under.">
<link rel="canonical" href="%sspecies/photo-credits.html"><meta name="robots" content="index,follow"><link rel="icon" href="../favicon.ico" sizes="any"><link rel="stylesheet" href="sp.css">
<style>.pc-wrap{overflow-x:auto}.pc{border-collapse:collapse;width:100%%;font-size:14px}.pc th,.pc td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.pc th{font-weight:600;position:sticky;top:0;background:var(--bg)}.pc tr:target{background:var(--tag)}.pc-q{width:100%%;max-width:420px;font:inherit;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text)}</style>
</head><body>
%s
<main class="sp-main"><nav class="sp-crumbs" aria-label="Breadcrumb"><a href="../">SnakeList</a> &rsaquo; <a href="./">All species</a> &rsaquo; <span aria-current="page">Photo credits</span></nav>
<h1>Photo credits</h1>
<p>Every snake photo on SnakeList was taken by the person named below and is used under the Creative Commons licence <em>they</em> chose for it. SnakeList is free, has no ads and makes no money from these photos.</p>
<p>To fit SnakeList, each photo is <b>cropped and resized</b>; nothing else about it is changed. The &ldquo;original&rdquo; link opens the photo as the photographer shared it (they shared these photos on iNaturalist, where each one has its own page and licence).</p>
<p>Photos marked &ldquo;No Derivatives&rdquo; (ND) are not used, because cropping counts as changing a photo. The %s fossil snakes are shown with SnakeList&rsquo;s own illustrations, as no photo of them can exist.</p>
<p class="sp-note">If you took one of these photos and want the credit changed or the photo removed, contact SnakeList through the <a href="../about.html">About me</a> page and it will be done.</p>
<h2>Snake photos (%s)</h2>
<p><label for="pc-q">Find a snake or photographer</label><br><input id="pc-q" class="pc-q" type="search" autocomplete="off"></p>
<div class="pc-wrap"><table class="pc" id="pc-t"><thead><tr><th>Snake</th><th>Photographer</th><th>Licence</th><th>Photo</th></tr></thead><tbody>%s</tbody></table></div>
<h2>Family pictures (%s)</h2>
<div class="pc-wrap"><table class="pc"><thead><tr><th>Family</th><th>Photographer</th><th>Licence</th></tr></thead><tbody>%s</tbody></table></div>
</main>
%s
<script>(function(){var q=document.getElementById('pc-q'),r=[].slice.call(document.querySelectorAll('#pc-t tbody tr')),t;r.forEach(function(e){e._t=e.textContent.toLowerCase()});
q.addEventListener('input',function(){clearTimeout(t);t=setTimeout(function(){var v=q.value.trim().toLowerCase();r.forEach(function(e){e.hidden=v&&e._t.indexOf(v)<0})},120)})})();</script>
</body></html>
""" % (SITE, site_header("../", "species"), ill, "{:,}".format(len(rows)), "".join(rows), len(frows), "".join(frows), site_footer("../"))
    open(OUT + "/photo-credits.html", "w", encoding="utf-8").write(html)


def len_attr(info):
    """a species page's sourced adult length, for the size picture in "Explore in 3D" (photos tab):
    data-lenlo/-hi in metres, the account's own words and its first source (none without an account)"""
    import build_regions
    lm = build_regions.length_m(info)
    if not lm: return ""
    f = info["facts"]["length"]; s = (info.get("sources") or {}).get((f.get("src") or [""])[0], {})
    e = lambda t: H.escape(str(t), quote=True)
    return ' data-lenlo="%g" data-lenhi="%g" data-lentxt="%s"%s' % (lm[0], lm[1], e(plain(f["text"])),
                                                              (' data-lensrc="%s"' % e("%s|%s" % (s.get("publisher") or s.get("title", ""), s.get("url", "")))) if s else "")


INFO_ALL = [{}]  # the reviewed species accounts, for the genus pages' comparison table


def genus_compare(L, info, esc):
    """a genus page's species side by side: venom, where recorded, and the reviewed adult length"""
    import build_regions
    rows = []
    for x in L:
        f = ((info.get(x["id"]) or {}).get("facts") or {}).get("length")
        conts = sorted(set(x["continents"]))
        rows.append('<tr><td><a href="../%s">%s</a>%s</td><td>%s</td><td>%s%s</td><td>%s</td></tr>' % (
            page_name(x), esc(x["sci"] if x["is_sci"] else x["name"]), "" if x["is_sci"] else " <small><i>%s</i></small>" % esc(x["sci"]),
            "Venomous" if x["venom"] else "Non-venomous", esc(build_regions.count_places(set(x["countries"])) or "No country recorded"),
            (" <small>(%s)</small>" % esc(", ".join(conts))) if conts else "", esc(plain(f["text"])) if f else '<small>No reviewed account yet</small>'))
    tbl = ('<div class="cy-cmp-wrap"><table class="cy-cmp"><thead><tr><th scope="col">Species</th><th scope="col">Venom</th><th scope="col">Recorded in</th>'
           '<th scope="col">Adult length (reviewed accounts)</th></tr></thead><tbody>%s</tbody></table></div>') % "".join(rows)
    if len(L) > 25: tbl = '<details><summary>Show the table of all %d species</summary>%s</details>' % (len(L), tbl)
    return ('<section class="cy-sec" id="compare" aria-labelledby="cy-cmp-h"><h2 id="cy-cmp-h">Compare its species</h2>'
            '<p class="cy-note">Its living species side by side. Lengths come only from SnakeList&rsquo;s reviewed, sourced accounts; the others are left blank rather than guessed.</p>%s</section>') % tbl


def hubs(cards, esc, img_of, invasive=None):
    """crawlable landing pages - snakes of each country, each family, each genus - linking to the species pages"""
    import build_regions
    INFO_ALL[0] = load_info({c["id"]: c for c in cards})
    groups = {"country": {}, "family": {}, "genus": {}}
    for c in cards:
        for n in c["countries"]: groups["country"].setdefault(n, []).append(c)
        if c["family"]: groups["family"].setdefault(c["family"], []).append(c)
        if c["genus"]: groups["genus"].setdefault(c["genus"], []).append(c)
    urls = []
    for kind, G in groups.items():
        os.makedirs(OUT + "/" + kind, exist_ok=True)
        if kind == "country":  # the redesigned country pages (country_page below) and the country picker's list
            open(OUT + "/country.css", "w", encoding="utf-8").write(COUNTRY_CSS + build_regions.REGION_CSS)
            open(OUT + "/country.js", "w", encoding="utf-8").write(COUNTRY_JS + build_regions.PLIST_JS)
            with open(OUT + "/countries.json", "w", encoding="utf-8") as fh:
                json.dump({n: slugify(n) for n in sorted(G) if slugify(n)}, fh, ensure_ascii=False, separators=(",", ":"))
            for name, L in G.items():
                slug = slugify(name)
                if not slug: continue
                open("%s/country/%s.html" % (OUT, slug), "w", encoding="utf-8").write(
                    country_page(name, L, {"_cards": cards}, invasive or {}, esc, slug))
                urls.append(SITE + "species/country/%s" % slug)
            # a country page from an earlier build whose country no longer has a species: still a
            # working page (it may be linked or bookmarked), now saying plainly that none are listed
            done = {slugify(n) for n in G}
            for f in os.listdir(OUT + "/country"):
                if not f.endswith(".html") or f[:-5] in done: continue
                old = open("%s/country/%s" % (OUT, f), encoding="utf-8").read()
                m = re.search(r"<title>Snakes of ([^:<|]+?)(?::| \|)", old)
                if m: open("%s/country/%s" % (OUT, f), "w", encoding="utf-8").write(
                    country_page(H.unescape(m.group(1).strip()), [], {"_cards": cards}, invasive or {}, esc, f[:-5]))
            continue
        open(OUT + "/country.css", "w", encoding="utf-8").write(COUNTRY_CSS + build_regions.REGION_CSS)
        open(OUT + "/country.js", "w", encoding="utf-8").write(COUNTRY_JS + build_regions.PLIST_JS)
        for name, L in G.items():
            slug = slugify(name)
            if not slug: continue
            open("%s/%s/%s.html" % (OUT, kind, slug), "w", encoding="utf-8").write(country_page(name, L, {"_cards": cards}, invasive or {}, esc, slug, kind))
            urls.append(SITE + "species/%s/%s" % (kind, slug))
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
<meta property="og:url" content="{url}"><meta property="og:image" content="{img}"><meta property="og:image:alt" content="{img_alt}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{title}"><meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{img}"><meta name="twitter:image:alt" content="{img_alt}">
<meta name="theme-color" content="#1F5A3A">
<link rel="icon" href="../favicon.ico" sizes="any"><link rel="manifest" href="../app/snakelist.webmanifest">
<link rel="stylesheet" href="sp.css"><script>document.documentElement.className+=" js"</script>
<script type="application/ld+json">{ld}</script>
</head><body>
{site_head}
<main class="sp-main" data-id="{id}" data-sci="{sci_attr}"{lenattr}>{info_json}
<nav class="sp-crumbs" aria-label="Breadcrumb"><a href="../">SnakeList</a> &rsaquo; <a href="./">All species</a>{crumb_tax} &rsaquo; <span aria-current="page">{h1}</span></nav>
<article>
<header class="sp-head">{photo}
<div class="sp-title">{fossil_flag}<h1>{h1}</h1><p class="sp-sci">{sub}</p>
{intro}
</div></header>
<div class="sp-keybox"><h2 class="sp-vh">Key facts</h2><dl class="sp-key">{keyfacts}</dl>
<div class="sp-actions">{actions}{realbtn}</div>
<p class="sp-actnote">{actnote}</p></div>
<nav class="sp-toc" aria-label="On this page">{toc}</nav>
{before}<section id="range" class="sp-sec"><h2>{range_h}</h2>{pub}
<h3>Map</h3>
<div class="sp-map" data-codes="{codes}" data-intro="{intro_codes}" data-dots="{dots}" data-view="{view}" data-st="{st}" data-ns="{ns}" data-sview="{sview}" data-cities="{cities_json}" aria-label="Map of {nplaces_txt} where {h1} {lives}"></div><template class="sp-ishapes">{ishapes}</template><div class="sp-mapbar">{legend}{stbtn}</div>{mapnote}{states}{cities_list}
<h3 class="sp-whereh">{where_h}</h3><ul class="sp-where sp-clip">{where}</ul>{where_all}{obs}</section>
{after}
<p class="sp-safe"{safe_hidden}><b>Stay safe:</b> a photo or a web page can never tell you for certain that a snake is harmless. Keep your distance, never handle a wild snake, and get medical help straight away after any bite.</p>
</article></main>
{site_foot}
<script src="sp.js" defer></script><script src="wd.js" defer></script>
</body></html>
"""

INDEX = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>All {n} snake species A-Z, by family and country | SnakeList</title>
<meta name="description" content="Every one of the {n} snake species in SnakeList, by family and by country - each with its photo, range map and facts.">
<link rel="canonical" href="{url}"><meta name="author" content="{author}"><meta name="robots" content="index,follow">
<meta property="og:title" content="All {n} snake species | SnakeList"><meta property="og:url" content="{url}"><meta property="og:type" content="website">
<link rel="icon" href="../favicon.ico" sizes="any"><link rel="stylesheet" href="sp.css">
</head><body>
{site_head}
<main class="sp-main"><nav class="sp-crumbs" aria-label="Breadcrumb"><a href="../">SnakeList</a> &rsaquo; <span aria-current="page">All species</span></nav>
<h1>All {n} snake species</h1><p class="sp-muted">{n} species in {nfam} families, recorded in {ncountry} countries. Search by name, open a country, or browse by family A-Z.</p>{body}</main>
{site_foot}
<script>(function(){{var C={cslugs};
var q=document.getElementById('sx-q'),n=document.getElementById('sx-n'),none=document.getElementById('sx-none'),secs=[].slice.call(document.querySelectorAll('.sx-fam')),t0;
secs.forEach(function(s){{s._li=[].slice.call(s.querySelectorAll('li')).map(function(li){{return [li,li.textContent.toLowerCase()]}})}});
function run(){{var t=q.value.trim().toLowerCase(),hit=0;secs.forEach(function(s){{var k=0;s._li.forEach(function(e){{var m=!t||e[1].indexOf(t)>=0;e[0].hidden=!m;if(m)k++}});s.hidden=!k;hit+=k}});
document.body.classList.toggle('sx-searching',!!t);none.hidden=hit>0;n.textContent=t?(hit===1?'1 match':hit.toLocaleString('en')+' matches'):''}}
q.addEventListener('input',function(){{clearTimeout(t0);t0=setTimeout(run,120)}});
document.getElementById('sx-cf').addEventListener('submit',function(e){{var v=document.getElementById('sx-c').value.trim().toLowerCase();
for(var k in C)if(k.toLowerCase()===v){{e.preventDefault();location.href='country/'+C[k];return}}
for(var k in C)if(k.toLowerCase().indexOf(v)===0&&v){{e.preventDefault();location.href='country/'+C[k];return}}}});
}})();</script>
</body></html>
"""

CSS = """.sl-nophoto{display:flex;align-items:center;justify-content:center;width:100%;min-height:120px;height:100%;background:var(--tag,#e3f0dc);color:var(--muted,#55705b);font-size:13px;border-radius:inherit}
.sp-note{font-size:13px;color:var(--muted);margin:-4px 0 10px}.sp-more{font-size:14px;margin:10px 0 0}.sp-lead{font-size:18px;margin:10px 0 14px}
.sp-safe{margin:24px 0 0;padding:18px 22px;border-radius:16px;border:2px solid var(--tagline);background:var(--tag);font-size:16.5px;line-height:1.55}
.sp-all{font:500 12px Inter,system-ui,-apple-system,Segoe UI,sans-serif;padding:4px 11px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--muted);cursor:pointer;margin:8px 0 0;display:none}
.js .sp-all{display:inline-block}.js .sp-clip:not(.sp-open)>.sp-x{display:none}
.sp-mapbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px}.sp-mapbar .sp-legend{margin-right:auto}.sp-mapbar .sp-legend,.sp-mapbar .sp-all{margin-top:8px}
.sp-states{margin-top:12px}.sp-n{color:var(--muted);font-size:.85em}.sp-shade{display:inline-flex;align-items:center;gap:6px}.sp-ramp{display:inline-block;width:46px!important;height:12px;border-radius:4px;background:linear-gradient(90deg,#b8e2aa,#1f5c28)}.sp-cities{margin-top:12px}.js .sp-cities:not(.sp-open){display:none}.sp-cities h3{font:700 16px Georgia,serif;margin:0 0 4px}.sp-cities .sp-where{margin:0}.sp-cities small{color:var(--muted)}
.sp-map circle.ct{fill:#e0a526;stroke:#fff;stroke-width:1.2px;vector-effect:non-scaling-stroke}.sp-states h3{font:700 16px Georgia,serif;margin:0 0 4px}.sp-states .sp-where{margin:0;columns:1}
.sp-az .v{font-size:11px;font-weight:700;color:#b5452a;margin-left:4px}@media (prefers-color-scheme:dark){.sp-az .v{color:#f0a04b}}
.sx-tools{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:14px 0}.sx-box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.sx-box label{display:block;font-weight:600;font-size:14px;margin:0 0 6px}.sx-box input{width:100%;min-width:0;font:inherit;padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--text)}
.sx-row{display:flex;gap:8px}.sx-box button{font:600 14px Inter,system-ui,sans-serif;padding:8px 14px;border-radius:10px;border:0;background:var(--g);color:#fff;cursor:pointer}.sx-box .sp-note{margin:6px 0 0;min-height:1em}
.sx-jump{display:flex;flex-wrap:wrap;gap:6px 16px;font-weight:600;margin:6px 0}.sx-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 18px}
.sx-chips a{display:inline-block;padding:4px 11px;border-radius:999px;border:1px solid var(--tagline);background:var(--tag);color:var(--text);text-decoration:none;font-size:13px}.sx-chips small{color:var(--muted)}
.sx-searching #by-country,.sx-searching #by-family,.sx-searching .sx-chips{display:none}.sx-fam{scroll-margin-top:12px}.sx-fam h2 a{color:inherit}
.sp-hubs{columns:3 200px;column-gap:24px;padding:0;list-style:none}.sp-hubs li{break-inside:avoid;margin:2px 0}
:root{--bg:#f1f6ee;--card:#fbfdf9;--text:#183020;--muted:#55705b;--line:#d5e4cf;--g:#58b351;--land:#d7dccb;--on:#58b351;--in:#e07a1f;--sea:#e3ecef;--tag:#e3f0dc;--tagline:#a9cf9c;--link:#2a7a2f}
@media (prefers-color-scheme:dark){:root{--bg:#22623f;--card:#256846;--text:#eef6ee;--muted:#c4e0cc;--line:#37855f;--g:#58b351;--land:#3a7c5a;--on:#58b351;--in:#f0a04b;--sea:#1b5034;--tag:#2c7a57;--tagline:#4a9a6c;--link:#dcf7d0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 Inter,system-ui,-apple-system,Segoe UI,sans-serif}
a{color:var(--link)}.sp-top{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:980px;margin:0 auto;padding:14px 16px}
.sp-logo{font:700 26px Georgia,'Times New Roman',serif;color:var(--g);text-decoration:none}.sp-top nav{display:flex;gap:16px;font-size:14px}
.sp-main{max-width:980px;margin:0 auto;padding:0 16px 30px}.sp-crumbs{font-size:13px;color:var(--muted);margin:4px 0 14px}
.sp-head{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:24px;align-items:start}
@media (max-width:720px){.sp-head{grid-template-columns:1fr}}
.sp-photo{margin:0}.sp-photo img,.sp-sprite{width:100%;height:auto;aspect-ratio:3/2;object-fit:cover;border-radius:18px;display:block;background:var(--line)}
.sp-photo figcaption{font-size:12px;color:var(--muted);margin-top:6px}.sp-nophoto div{aspect-ratio:3/2;border-radius:18px;display:grid;place-items:center;background:var(--line);color:var(--muted)}
h1{font:700 clamp(30px,5vw,44px)/1.1 Georgia,serif;margin:0}.sp-sci{font-style:italic;color:var(--muted);margin:4px 0 10px;font-size:18px}
/* every page's main heading in the species pages' green, and the line under it in the lighter green */
h1,.sp-title h1,.cy-head h1{color:#1f7a3a}.sp-title .sp-sci,.cy-htext .cy-lead,.cy-htext .rg-sub,h1+.sp-muted,h1+p{color:#2e7d4f}
@media (prefers-color-scheme:dark){h1,.sp-title h1,.cy-head h1{color:#a8ef94}.sp-title .sp-sci,.cy-htext .cy-lead,.cy-htext .rg-sub,h1+.sp-muted,h1+p{color:#8fd98a}}
.sp-badge{display:none}.sp-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(140px,100%),1fr));gap:8px;margin:18px 0 12px}.sp-facts dd{overflow-wrap:anywhere}
.sp-facts div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px 12px}.sp-facts dt{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}.sp-facts dd{margin:0;font-weight:600}
.sp-btn{display:inline-block;background:var(--g);color:#fff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:12px}
section{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px 20px;margin-top:18px}h2{font:700 22px Georgia,serif;margin:0 0 8px}h2 small{font:500 13px Inter,sans-serif;color:var(--muted)}
.sp-map{position:relative;border-radius:12px;overflow:hidden;background:var(--sea);aspect-ratio:2/1;max-height:460px;width:100%}
.sp-map svg{width:100%;height:100%;display:block;user-select:none;-webkit-user-select:none}
.sp-map path{fill:var(--land);stroke:var(--sea);stroke-width:.6;vector-effect:non-scaling-stroke;stroke-linejoin:round}.sp-map path.on{fill:var(--on)}.sp-map path.in{fill:var(--in)}
.sp-map circle{stroke:var(--card);stroke-width:1.2;vector-effect:non-scaling-stroke}.sp-map circle.on{fill:var(--on)}.sp-map circle.in{fill:var(--in)}
.sp-zoom{position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:6px}
.sp-zoom button{width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--link);font:600 20px/1 Inter,system-ui,sans-serif;cursor:pointer;padding:0;touch-action:manipulation}
.sp-zoom button:disabled{opacity:.45;cursor:default}
.sp-legend{display:flex;flex-wrap:wrap;gap:6px 16px;margin:8px 0 0;font-size:13px;color:var(--muted)}.sp-legend span{display:inline-flex;align-items:center;gap:6px}
.sp-legend i{width:14px;height:14px;border-radius:4px;display:inline-block}.sp-legend i.on{background:var(--on)}.sp-legend i.in{background:var(--in)}
.sp-tags{list-style:none;padding:0;margin:4px 0 10px;display:flex;flex-wrap:wrap;gap:6px}
.sp-tags a{display:inline-block;background:var(--tag);border:1px solid var(--tagline);color:var(--link);text-decoration:none;font-size:13px;font-weight:600;padding:3px 12px;border-radius:999px}
.sp-tags a:hover,.sp-pills a:hover{background:var(--g);border-color:var(--g);color:#fff}
.sp-where a{color:inherit;text-decoration:underline;text-decoration-color:var(--tagline);text-underline-offset:2px}.sp-where a:hover{color:var(--link)}
.sp-where{columns:2 260px;padding-left:18px;font-size:14px}.sp-where li{break-inside:avoid;margin-bottom:4px}
.sp-pills{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:6px}.sp-pills li{border:1px solid var(--line);border-radius:999px;padding:3px 11px;font-size:13.5px}.sp-pills li:has(a){border:0;padding:0}
.sp-pills a{display:inline-block;border:1px solid var(--tagline);background:var(--tag);color:var(--link);text-decoration:none;border-radius:999px;padding:3px 11px;font-size:13.5px}
.sp-rel,.sp-az{columns:3 220px;padding-left:18px}.sp-rel i,.sp-az i{color:var(--muted);font-size:13px}.sp-muted{color:var(--muted)}
.sp-lb{position:fixed;inset:0;z-index:50;background:rgba(5,15,9,.92);display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out}
.sp-lb img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;cursor:default}.sp-lb-x{position:fixed;top:12px;right:14px;width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.15);color:#fff;font-size:26px;cursor:pointer}
#sp-wiki p{margin:10px 0 0}#sp-wiki .src{font-size:12px;color:var(--muted)}.sp-foot{text-align:center;color:var(--muted);font-size:13px;padding:20px 16px 34px;border-top:1px solid var(--line)}
.sl-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 16px;max-width:1120px;margin:0 auto;padding:14px 16px}
.sl-brand{display:inline-flex;align-items:center;gap:9px;font:700 24px/1 Fraunces,Georgia,'Times New Roman',serif;color:#58b351;text-decoration:none}
.sl-brand img{width:32px;height:32px;border-radius:8px;display:block}
.sl-top nav{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:14.5px}.sl-top nav a{color:var(--muted);text-decoration:none;padding:6px 0}
.sl-top nav a:hover,.sl-top nav a[aria-current]{color:var(--link)}.sl-top nav a[aria-current]{font-weight:600}
.sl-foot{margin-top:30px;border-top:1px solid var(--line);text-align:center;color:var(--muted);font-size:13.5px;padding:20px 16px 30px}
.sl-foot p{margin:4px 0}.sl-flogo{font:700 18px Fraunces,Georgia,serif;color:#58b351!important;text-decoration:none}
.sl-flinks{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 16px}.sl-foot a{color:var(--muted)}.sl-fnote{font-size:12px}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--g);outline-offset:2px;border-radius:4px}
.sp-relh{font:700 16px Georgia,serif;margin:10px 0 4px}.sp-relh small{font:500 12.5px Inter,sans-serif;color:var(--muted)}
.sp-habd{margin-top:10px}.sp-habd summary{cursor:pointer;color:var(--link);font-size:14px}.sp-habd .sp-pills{margin-top:8px}
@media (max-width:560px){.sl-top{padding:12px}.sl-top nav{gap:2px 14px;font-size:14px}.sl-brand{font-size:21px}}
.sp-head{margin-bottom:6px;grid-template-areas:'photo title' 'key title';grid-template-rows:auto 1fr;row-gap:16px}.sp-head>.sp-photo{grid-area:photo}.sp-head>.sp-title{grid-area:title}.sp-head>.sp-key{grid-area:key;align-self:start;margin:0}@media (max-width:720px){.sp-head{grid-template-areas:'photo' 'title' 'key';row-gap:14px}}.sp-title{min-width:0}.sp-sci{margin:6px 0 12px}.sp-sci i{font-style:italic}.sp-auth{font-style:normal;font-size:14px;color:var(--muted)}
.sp-intro{font-size:17px;line-height:1.6;margin:0 0 14px}
.sp-key{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px;margin:0 0 16px;border-top:1px solid var(--line)}
.sp-key div{padding:7px 0;border-bottom:1px solid var(--line);min-width:0}.sp-key dt{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.sp-key dd{margin:0;font-weight:600;font-size:14.5px;line-height:1.4;overflow-wrap:anywhere}.sp-key dd small{font-weight:400;color:var(--muted)}.sp-key a{color:var(--link)}
@media (max-width:380px){.sp-key{grid-template-columns:1fr}}
.sp-actions{display:flex;flex-wrap:wrap;gap:8px}.sp-actions .sp-btn{padding:10px 16px;font-size:15px}.sp-btn2{background:var(--card);color:var(--link);border:1px solid var(--tagline)}.sp-btn2:hover{background:var(--tag)}
.sp-actnote{font-size:12.5px;color:var(--muted);margin:6px 0 0}
.sp-photo figcaption{font-size:13px;color:var(--text);opacity:.8}.sp-photo figcaption a{color:inherit}
.sp-toc{position:sticky;top:0;z-index:5;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin:18px -16px 0;padding:8px 16px;background:var(--bg);border-bottom:1px solid var(--line)}
.sp-toc::-webkit-scrollbar{display:none}.sp-toc a{flex:none;padding:5px 12px;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;color:var(--muted)}
.sp-toc a:hover,.sp-toc a:focus-visible{background:var(--tag);color:var(--link)}
.sp-sec{scroll-margin-top:60px}.sp-sec h3{font:700 17px Georgia,serif;margin:16px 0 4px}.sp-sec h2+h3{margin-top:4px}.sp-sec h3 small{font:500 12.5px Inter,sans-serif;color:var(--muted)}
.sp-sec p{margin:0 0 10px}.sp-ref{font-size:11px;line-height:0;margin-left:2px;white-space:nowrap}.sp-ref a{text-decoration:none}
.sp-limited{background:var(--tag);border:1px solid var(--tagline);border-radius:12px;padding:10px 14px}
.sp-fun{margin-top:14px;padding:12px 16px;border-radius:14px;background:var(--tag);border:1px solid var(--tagline)}.sp-fun h3{margin:0 0 4px}.sp-fun ul{margin:0;padding-left:20px}.sp-fun li{margin:4px 0}
.sp-tagh{font-size:13px;color:var(--muted);margin:14px 0 4px!important}.sp-sec .sp-tags{margin:0}
.sp-sim{padding-left:18px;margin:0}.sp-sim li{margin:0 0 8px}.sp-sim i{color:var(--muted)}
.sp-links{display:flex;flex-wrap:wrap;gap:6px 18px}.sp-links a{font-weight:600}
.sp-iucn{display:flex;gap:12px;align-items:center}.sp-cat{flex:none;display:inline-grid;place-items:center;width:44px;height:44px;border-radius:50%;font:700 15px Inter,sans-serif;color:#fff;background:#6b7d72}
.sp-cat.cat-LC{background:#3d8b55}.sp-cat.cat-NT{background:#7d9a2e}.sp-cat.cat-VU{background:#c9a400;color:#1c1c1c}.sp-cat.cat-EN{background:#d9741a}.sp-cat.cat-CR{background:#c4302b}.sp-cat.cat-DD{background:#8a8f8c}.sp-cat.cat-NE{background:#a3aaa6;color:#1c1c1c}
.sp-tax{display:grid;gap:4px;margin:0 0 10px}.sp-tax div{display:flex;gap:10px;flex-wrap:wrap}.sp-tax dt{min-width:70px;color:var(--muted);font-size:14px}.sp-tax dd{margin:0;flex:1 1 220px;min-width:0}.sp-ety{color:var(--muted)}
.sp-det{margin:10px 0 0}.sp-det summary{cursor:pointer;color:var(--link);font-size:14.5px;font-weight:600}.sp-det ul{margin:8px 0;padding-left:20px;font-size:14.5px}
.sp-refs{padding-left:22px;font-size:14px;margin:0 0 10px}.sp-refs li{margin:0 0 6px;overflow-wrap:anywhere}.sp-refs li:target{background:var(--tag);border-radius:6px}
.sp-dates{display:flex;flex-wrap:wrap;gap:4px 20px;font-size:13px;color:var(--muted);margin-top:14px!important;padding-top:10px;border-top:1px solid var(--line)}
.sp-mapnote{margin:8px 0 0}.sp-intro-box p{margin:0 0 10px}
.cy-about{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 18px;margin:14px 0 0;max-width:820px}.cy-about p{margin:0 0 8px;line-height:1.6}
.cy-about .sp-ref{font-size:11px}.cy-about .sp-refs{font-size:13px;margin:6px 0 0}.cy-about details summary{cursor:pointer;color:var(--link);font-size:13.5px;font-weight:600}.cy-about .sp-note{margin:4px 0 0}
.sp-head{grid-template-areas:'photo title';grid-template-rows:auto;margin-bottom:0}@media (max-width:720px){.sp-head{grid-template-areas:'photo' 'title'}}
.sp-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sp-fossil-flag{display:inline-block;margin:0 0 8px;padding:3px 12px;border-radius:999px;font-size:13px;font-weight:600;background:#5b4a3a;color:#fff}
.sp-intro2{margin:0 0 12px}
.sp-keybox{margin-top:18px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:6px 20px 16px}
.sp-keybox .sp-key{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:0 24px;margin:0 0 14px;border-top:0}
.sp-keybox .sp-key div{padding:10px 0;border-bottom:1px solid var(--line)}
.sp-keybox .sp-key dt{font-size:12px;font-weight:600;text-transform:none;letter-spacing:0;color:var(--muted);margin-bottom:2px}
.sp-keybox .sp-key dd{font-weight:500;font-size:15px;line-height:1.45}.sp-keybox .sp-key dd small{display:inline;font-size:13px}
.sp-keybox .sp-key dd .sp-kintro{display:block;margin-top:2px}
.sp-unk{color:var(--muted);font-weight:400}
.sp-keybox .sp-actions{gap:8px}.sp-keybox .sp-actnote{margin:8px 0 0}
.sp-actions .sp-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border:1px solid transparent;cursor:pointer;font:600 15px Inter,system-ui,sans-serif}
.sp-actions .sp-btn2{border-color:var(--tagline)}.sp-actions .sp-btn span{margin-right:6px}.sp-keybox a.sp-btn{color:#fff;text-decoration:none}.sp-keybox a.sp-btn2{color:var(--link)}
.sp-keybox a.sp-btn:hover{filter:brightness(1.06)}
@media (max-width:560px){.sp-actions{display:grid;grid-template-columns:1fr 1fr}.sp-actions .sp-btn:only-child{grid-column:1/-1}.sp-keybox{padding:4px 14px 14px}}
.sp-sec a,.sp-keybox a,.sp-intro a{color:var(--link);text-decoration:underline;text-decoration-color:var(--tagline);text-underline-offset:2px}
.sp-sec a:hover,.sp-keybox a:hover{text-decoration-color:currentColor}.sp-sec .sp-tags a,.sp-sec .sp-pills a,.sp-ref a{text-decoration:none}
.sp-ext{display:inline-block;margin-left:4px;padding:0 7px;border-radius:999px;font-size:11.5px;font-weight:600;background:#5b4a3a;color:#fff;line-height:1.6}
.sp-terr{color:var(--muted);font-weight:400}
.sp-fossilfig div{display:flex!important;flex-direction:column;gap:6px;padding:20px;text-align:center;background:repeating-linear-gradient(135deg,var(--line) 0 12px,var(--tag) 12px 24px)!important;color:var(--text)!important}
.sp-fossilfig div{justify-content:center;align-items:center}@media (max-width:720px){.sp-fossilfig div{aspect-ratio:auto!important;min-height:130px}}.sp-fossilfig b{font:700 18px Georgia,serif}.sp-fossilfig span{font-size:14px;max-width:34ch}
.sp-iucn{display:flex;gap:14px;align-items:center;margin:0 0 12px}.sp-iucn p{margin:0!important}.sp-iucn .sp-note{margin:2px 0 0!important}
.sp-ety{color:var(--text)}
.sp-whereh{margin-top:16px!important}
.sp-states{margin-top:12px}.sp-states>summary,.sp-det>summary{cursor:pointer;color:var(--link);font-size:14.5px;font-weight:600;padding:4px 0}
.sp-states .sp-note{margin:6px 0 8px}.sp-refd{margin:0 0 10px}.sp-refd .sp-refs{margin-top:8px}
.sp-prov ul{font-size:14px;color:var(--muted)}
.sp-who{margin:14px 0 0}.sp-who h3{margin:0 0 4px}.sp-person{display:flex;gap:12px;align-items:flex-start;margin:10px 0 0;padding:10px 12px;border:1px solid var(--line);border-radius:14px;background:var(--bg)}
.sp-person img{flex:none;width:64px;height:80px;object-fit:cover;border-radius:10px;background:var(--line)}.sp-person-t{min-width:0}.sp-person p{margin:0 0 2px}
.sp-person-n{font-weight:700}.sp-person-d{font-size:14px}.sp-person-m{font-size:13.5px;color:var(--muted)}
.sp-rel li{break-inside:avoid}
@media (prefers-color-scheme:dark){.sp-fossil-flag,.sp-ext{background:#d8c3a5;color:#2b2016}}
"""

JS = """(function(){function nf(t){if(!t||t.tagName!=='IMG'||t.dataset.nf)return;if(t.dataset.fb){var fb=t.dataset.fb;t.removeAttribute('data-fb');t.src=fb;return}t.dataset.nf=1;var d=document.createElement('span');d.className='sl-nophoto';d.setAttribute('role','img');d.setAttribute('aria-label',t.alt||'Photo unavailable');d.textContent='Photo unavailable';if(t.width&&t.height)d.style.aspectRatio=t.width+'/'+t.height;t.replaceWith(d)}
window.addEventListener('error',function(e){nf(e.target)},true);[].forEach.call(document.images,function(i){if(i.complete&&!i.naturalWidth&&i.getAttribute('src'))nf(i)})})();
(function(){
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
if(!k){p.remove();return}var nm2=nm.replace(/ \\(\\d+\\)$/,''),t=document.createElementNS(NS,'title');t.textContent=nm2+': seen '+k+(k===1?' time':' times')+' on iNaturalist';p.appendChild(t);names.push(nm2)});
if(names.length){var c=s.getElementById('c-'+x[0]);if(c&&c.getAttribute('class')){off.push([c,c.getAttribute('class')]);c.removeAttribute('class')}got.push(x[5]);
if(ul){var li=document.createElement('li');li.className='sp-inat';li.innerHTML='<b></b> <span></span> <small class="sp-n">from iNaturalist sightings</small>';li.firstChild.textContent=x[5]+':';li.children[1].textContent=names.sort().join(', ');ul.appendChild(li)}}else g.remove()}
one();fin()},function(){live--;one();fin()})}
one();one();one()}
function done(o){sb.textContent=o?'Hide states & provinces':'Show states & provinces';sb.setAttribute('aria-pressed',o?'true':'false')}
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
// no photo built in: find one now - its best sighting marked Alive (never a dead snake), else
// iNaturalist's photo of the species, else its Wikipedia picture (never a map, range map or drawing)
var nf=document.querySelector('.sp-nophoto'),sm=document.querySelector('.sp-main[data-sci]');
if(nf&&sm){var sci=sm.dataset.sci,API='https://api.inaturalist.org/v1/';
function bad(u){var f='';try{f=decodeURIComponent(String(u).split('?')[0].split('/').pop())}catch(e){f=String(u)}return !u||/map|range|distrib|locat|verbreit|carte|mapa|karte|areal|zone|world|globe/i.test(f)||(/wiki(pedia|media)/.test(u)&&/\\.(svg|png|gif)\\b/i.test(f))}
function J(u){return fetch(u).then(function(r){return r.ok?r.json():null})}
function show(url,credit,via){if(!url||bad(url))return false;var f=document.createElement('figure');f.className='sp-photo';
var i=new Image();i.src=url;i.alt='Photo of '+sci;i.width=500;i.height=333;var c=document.createElement('figcaption');c.textContent='Photo: '+credit+', via '+via;
f.appendChild(i);f.appendChild(c);nf.replaceWith(f);return true}
J(API+'taxa?per_page=10&is_active=true&q='+encodeURIComponent(sci)).then(function(d){
var t=d&&(d.results||[]).filter(function(x){return (x.name||'').toLowerCase()===sci.toLowerCase()})[0];
return (t?J(API+'observations?photos=true&quality_grade=research&term_id=17&term_value_id=18&order_by=votes&per_page=3&taxon_id='+t.id):Promise.resolve(null)).then(function(o){
var r=o&&(o.results||[]).filter(function(x){return x.photos&&x.photos[0]})[0];
if(r&&show(r.photos[0].url.replace('/square.','/medium.'),(r.photos[0].attribution||'iNaturalist').replace(/^\\(c\\)\\s*/i,''),'iNaturalist'))return true;
if(t&&t.default_photo&&show((t.default_photo.medium_url||t.default_photo.url),(t.default_photo.attribution||'iNaturalist').replace(/^\\(c\\)\\s*/i,''),'iNaturalist'))return true;
return J('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(sci.replace(/ /g,'_'))).then(function(w){
var img=w&&(w.originalimage||w.thumbnail);if(img&&!bad(img.source)&&w.thumbnail)show(w.thumbnail.source,'Wikipedia','Wikipedia')})})}).catch(function(){})}
var main=document.querySelector('.sp-main[data-sci]'),w=document.getElementById('sp-wiki');
if(main&&w){fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(main.dataset.sci.replace(/ /g,'_'))).then(function(r){return r.ok?r.json():null}).then(function(d){
if(!d||!d.extract||d.type==='disambiguation')return;var p=document.createElement('p');p.textContent=d.extract;w.appendChild(p);
var s=document.createElement('p');s.className='src';s.innerHTML='From <a href="'+d.content_urls.desktop.page+'" rel="noopener" target="_blank">Wikipedia</a> (CC BY-SA)';w.appendChild(s)}).catch(function(){})}
})();// a numbered citation, or a link to a place inside closed details (references, states): open it first
function opn(h){var t=h&&h.charAt(0)==='#'&&document.getElementById(h.slice(1));if(!t)return;for(var e=t.parentNode;e&&e!==document;e=e.parentNode)if(e.tagName==='DETAILS')e.open=true}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^="#"]');if(a)opn(a.getAttribute('href'))});opn(location.hash);
"""


# ---- country pages: "Snakes of <country>" ----------------------------------------------------
# one reusable template for every country: a header with its real numbers, photo cards for each
# species (each card's own built-in photo tile, never another species'), and - for lists long
# enough to need them - search, venom/family filters and sorting, all over that country's own
# species only. Everything is in the HTML (crawlable); country.js only filters, sorts and pages.
# the names as the countries themselves write them (the app's SL_DISPLAY_NAME); page addresses stay the same
COUNTRY_DISPLAY = {"Sao Tome and Principe": "São Tomé and Príncipe", "Ivory Coast": "Côte d'Ivoire", "Turkey": "Türkiye",
                   "Cape Verde": "Cabo Verde", "Reunion": "Réunion", "Curacao": "Curaçao"}
def country_page(name, L, all_countries, invasive, esc, slug, kind="country"):
    """one template for the country, family and genus pages (kind): photo cards, search, filters
    and sorting over that group's own species only"""
    url = SITE + "species/%s/%s" % (kind, slug)
    intro_here = []  # species SnakeList records as introduced (invasive) here, not native
    if kind == "country":
        for c in all_countries["_cards"]:
            if name in c["countries"]: continue
            if any(e.get("name") == name for e in invasive.get(c["id"], [])): intro_here.append(c)
    # the second filter: a family page filters by genus, the others by family
    grp = (lambda x: x["genus"]) if kind == "family" else (lambda x: x["family"])
    def key(c): return ((1 if c["is_sci"] else 0), (c["sci"] if c["is_sci"] else c["name"]).lower(), c["sci"].lower())
    # living species only in the counts and the grid; fossil and extinct taxa get their own labelled sections
    G = sorted([x for x in L if x["extinct"] or x["fossil"]], key=key)
    L = sorted([x for x in L if not (x["extinct"] or x["fossil"])], key=key); intro_here = sorted(intro_here, key=key)
    import build_regions
    land = build_regions.land_word(name) if kind == "country" else "country"
    nfos = sum(1 for x in G if x["fossil"])
    n = len(L); nv = sum(1 for x in L if x["venom"]); fams = {}
    for x in L: fams[grp(x) or ""] = fams.get(grp(x) or "", 0) + 1
    nfam = len([f for f in fams if f])
    fam_word = ("genus", "genera") if kind == "family" else ("family", "families")
    family = next((x["family"] for x in L if x["family"]), "")
    ncountry = len({k for x in L for k in x["countries"]})
    places_txt = build_regions.count_places({k for x in (L or G) for k in x["countries"]})
    only = [x for x in L if x["countries"] == [name]]
    def plural(k, one, many=None): return "{:,} {}".format(k, one if k == 1 else (many or one + "s"))
    def vsplit():
        if nv == n: return "all venomous" if n > 1 else "venomous"
        if nv == 0: return "none venomous" if n > 1 else "non-venomous"
        return "%s venomous and %s non-venomous" % ("{:,}".format(nv), "{:,}".format(n - nv))
    # fossil and extinct members, said apart from the living ones
    gone_txt = ""
    if G:
        bits = ([plural(nfos, "fossil species", "fossil species")] if nfos else []) + ([plural(len(G) - nfos, "recently extinct species", "recently extinct species")] if len(G) > nfos else [])
        gone_txt = " and ".join(bits)
    dn = COUNTRY_DISPLAY.get(name, name) if kind == "country" else name
    common = (" (%s)" % FAMILY_INFO[name]["common"]) if kind == "family" and FAMILY_INFO.get(name, {}).get("common") else ""
    if kind in ("family", "genus") and not n:  # a group known only from fossils (Titanoboa, Madtsoiidae)
        h1 = name
        lead = "The %s %s%s is known only from fossils: SnakeList has %s and no living species%s." % (
            kind, name, common or (" (family %s)" % family if kind == "genus" and family else ""), gone_txt,
            (", found in %s" % (" and ".join(sorted({k for x in G for k in x["countries"]})) if len({k for x in G for k in x["countries"]}) <= 3 else places_txt)) if places_txt else "")
        title = "%s: %s | SnakeList" % (name, gone_txt)
    elif kind == "family":
        h1 = name
        lead = "The family %s%s has %s in SnakeList (%s), in %s%s." % (name, common, plural(n, "living species", "living species"), vsplit(), plural(nfam, "genus", "genera"),
                                                                   (", plus %s listed separately" % gone_txt) if gone_txt else "")
        title = ("%s: all %s, with photos | SnakeList" if n > 1 else "%s: %s | SnakeList") % (name, plural(n, "living snake species", "living snake species"))
    elif kind == "genus":
        h1 = name
        lead = "The genus %s%s has %s in SnakeList (%s), recorded in %s%s." % (
            name, " (family %s)" % family if family else "", plural(n, "living species", "living species"), vsplit(), places_txt,
            ("; %s %s listed separately" % (gone_txt, "is" if len(G) == 1 else "are")) if gone_txt else "")
        title = ("%s snakes: all %s, with photos | SnakeList" if n > 1 else "%s snakes: %s | SnakeList") % (name, plural(n, "species", "species"))
    elif n:
        h1 = "Snakes of %s" % dn
        lead = "%s %s recorded in %s in SnakeList: %s venomous and %s non-venomous%s." % (
            plural(n, "living snake species", "living snake species"), "is" if n == 1 else "are", the_place(dn), "{:,}".format(nv), "{:,}".format(n - nv),
            ", from %s" % plural(nfam, "family", "families") if nfam else "")
        if gone_txt: lead += " %s found here %s listed separately and not counted." % (gone_txt[0].upper() + gone_txt[1:], "is" if len(G) == 1 else "are")
        title = "Snakes of %s: %s with photos, venom status & map | SnakeList" % (dn, plural(n, "species", "species"))
    else:
        h1 = "Snakes of %s" % dn
        lead = "No living snake species are currently listed for %s in SnakeList." % the_place(dn)
        if gone_txt: lead += " %s found here %s listed below." % (gone_txt[0].upper() + gone_txt[1:], "is" if len(G) == 1 else "are")
        title = "Snakes of %s | SnakeList" % dn
    desc = lead + (" Photos, scientific names and families for each%s." % (", plus a map" if kind == "country" else "") if n else "")

    def card(x, intro=False):
        p = x["photo"]
        has = bool(p and len(p) >= 5 and "Illustration" not in p[2])
        nm = x["sci"] if x["is_sci"] else x["name"]
        alt = "Photo of %s" % (nm if x["is_sci"] else "%s (%s)" % (x["name"], x["sci"]))
        img = ('<img src="../../species-photos/t/%d-%d.webp" alt="%s" width="540" height="360" loading="lazy" decoding="async">' % (p[0], p[1], esc(alt))
               if has else '<span class="cy-noimg">%s</span>' % ("Known from fossils" if x["fossil"] else "No photo yet"))
        badges = '<span class="cy-b %s">%s</span>' % (("v", "Venomous") if x["venom"] else ("nv", "Non-venomous"))
        if x["fossil"]: badges += '<span class="cy-b x">Fossil</span>'
        elif x["extinct"]: badges += '<span class="cy-b x">Extinct</span>'
        if intro: badges += '<span class="cy-b i">Introduced</span>'
        title_html = ('<strong class="cy-name"><i>%s</i></strong>' % esc(nm)) if x["is_sci"] else (
            '<strong class="cy-name">%s</strong><i class="cy-sci">%s</i>' % (esc(x["name"]), esc(x["sci"])))
        return ('<li class="cy-card" data-n="%s" data-s="%s" data-f="%s" data-v="%d"%s><a href="../%s">'
                '<span class="cy-img">%s</span><span class="cy-body">%s<span class="cy-meta">%s%s</span></span></a></li>') % (
            esc(("~" + nm) if x["is_sci"] else nm.lower()), esc(x["sci"].lower()), esc(grp(x) or ""), 1 if x["venom"] else 0,
            ' data-i="1"' if intro else "", page_name(x), img, title_html, badges,
            ('<span class="cy-fam">%s</span>' % esc(grp(x))) if grp(x) and kind != "genus" else "")

    stats = ""
    if n or G:
        nland = len({k for x in L for k in x["countries"] if not build_regions.is_territory(k)})
        srows = [("{:,}".format(n), "living species"), ("{:,}".format(nv), "venomous"), ("{:,}".format(n - nv), "non-venomous"),
                 (("{:,}".format(nland), "countries" if nland != 1 else "country") if kind == "genus" else ("{:,}".format(nfam), fam_word[1] if nfam != 1 else fam_word[0]))]
        srows = [r0 for r0 in srows if not (r0[0] == "0" and r0[1] != "living species")]
        if nfos: srows.append(("{:,}".format(nfos), "fossil, not counted" if kind == "country" else "fossil"))
        if len(G) > nfos: srows.append(("{:,}".format(len(G) - nfos), "recently extinct"))
        stats = '<ul class="cy-stats" aria-label="At a glance: unique living species">%s</ul>' % "".join('<li><b>%s</b><span>%s</span></li>' % (v, k) for v, k in srows)
    big = n > 6
    controls = ""
    if big:
        fam_opts = "".join('<option value="%s">%s (%d)</option>' % (esc(f), esc(f), k) for f, k in sorted(fams.items()) if f)
        if "" in fams: fam_opts += '<option value="-">%s not recorded (%d)</option>' % (fam_word[0].capitalize(), fams[""])
        controls = ('<div class="cy-tools" role="search">'
                    '<label class="cy-q"><span class="cy-sr">Search snakes in %s</span><input id="cy-q" type="search" placeholder="Search snakes in %s..." autocomplete="off"></label>'
                    '%s%s'
                    '<label><span class="cy-lab">Sort</span><select id="cy-s"><option value="n">Common name A-Z</option><option value="nr">Common name Z-A</option><option value="s">Scientific name A-Z</option>%s</select></label>'
                    '<button type="button" id="cy-reset" class="cy-reset" hidden>Reset</button></div>') % (
            esc(name), esc(name),
            ('<label><span class="cy-lab">Venom</span><select id="cy-v"><option value="">All species</option><option value="1">Venomous (%s)</option><option value="0">Non-venomous (%s)</option></select></label>' % ("{:,}".format(nv), "{:,}".format(n - nv))) if 0 < nv < n else "",
            ('<label><span class="cy-lab">%s</span><select id="cy-f"><option value="">All %s</option>%s</select></label>' % (fam_word[0].capitalize(), fam_word[1], fam_opts)) if nfam > 1 else "",
            "" if kind == "genus" else '<option value="f">%s</option>' % ("Genus" if kind == "family" else "Family"))
    count = '<p class="cy-count" id="cy-count" aria-live="polite">Showing %s</p>' % plural(n, "species", "species") if n else ""
    grid = ('<ul class="cy-grid" id="cy-grid">%s</ul><p class="cy-empty" id="cy-empty" hidden>No snakes in %s match. <button type="button" class="cy-link" id="cy-clear">Clear the search and filters</button></p>'
            '<p class="cy-more-wrap"><button type="button" class="cy-more" id="cy-more" hidden>Show more</button></p>' % ("".join(card(x) for x in L), esc(name))) if n else (
            "" if G else
            '<div class="cy-none"><p><b>No snake species are currently listed for %s in SnakeList.</b></p><p>That only means none are in SnakeList yet - not that no snakes live there.</p>'
            '<p><a href="../#by-country">All countries</a> &middot; <a href="../">All species</a></p></div>' % esc(the_place(name)))
    intro_sec = ""
    if intro_here:
        intro_sec = ('<section class="cy-sec" aria-labelledby="cy-intro-h"><h2 id="cy-intro-h">Introduced to %s</h2><p class="cy-note">Not native here: SnakeList records %s brought to %s by people.</p>'
                     '<ul class="cy-grid cy-grid-intro">%s</ul></section>') % (esc(name), "this snake as" if len(intro_here) == 1 else "these snakes as", esc(name), "".join(card(x, True) for x in intro_here))
    # fossil and extinct taxa: their own labelled sections (with geological age), never in the living counts
    GS = build_regions.gone_sections(G, the_place(dn), "../", local=(kind == "country"))
    intro_sec += "".join('<section class="cy-sec rg-sec" id="%s" aria-labelledby="h-%s"><h2 id="h-%s">%s</h2>%s</section>' % (k, k, k, GS[k][0], GS[k][1]) for k in ("fossils", "extinct") if k in GS)
    # the overview: only facts that come straight from the data
    facts = []
    if kind in ("family", "genus") and (L or G):
        conts = sorted({k for x in (L or G) for k in x["continents"]})
        facts.append("<li><b>Distribution:</b> %s recorded in %s%s.</li>" % (
            "living species" if L else "fossils", places_txt or "no country yet", (", on %s: %s" % ("one continent" if len(conts) == 1 else "%d continents" % len(conts), ", ".join(conts))) if conts else ""))
    if kind == "family" and n >= 2:
        top = sorted([(k, f) for f, k in fams.items() if f], key=lambda t: (-t[0], t[1]))
        facts.append("<li><b>Genera:</b> %s.</li>" % ", ".join('<a href="../genus/%s"><i>%s</i></a> %d' % (slugify(f), esc(f), k) for k, f in top))
    elif kind == "genus" and n:
        if family: facts.append('<li><b>Family:</b> <a href="../family/%s">%s</a>.</li>' % (slugify(family), esc(family)))
        cc = {}
        for x in L:
            for k in x["countries"]: cc[k] = cc.get(k, 0) + 1
        if cc: facts.append("<li><b>Countries and territories:</b> %s%s.</li>" % (", ".join('<a href="../country/%s">%s</a>' % (slugify(k), esc(k)) for k in sorted(cc)[:40]), (" and %d more" % (len(cc) - 40)) if len(cc) > 40 else ""))
    if kind == "country" and n >= 2:
        top = sorted([(k, f) for f, k in fams.items() if f], key=lambda t: (-t[0], t[1]))
        if top:
            facts.append("<li><b>Families:</b> %s.</li>" % ", ".join('<a href="../family/%s">%s</a> %d' % (slugify(f), esc(f), k) for k, f in top))
        if only:
            facts.append("<li><b>%s</b> %s recorded in no other country or territory in SnakeList: %s.</li>" % (
                len(only), "is" if len(only) == 1 else "are", ", ".join('<a href="../%s">%s</a>' % (page_name(x), esc(x["sci"] if x["is_sci"] else x["name"])) for x in only[:12]) + (" and %d more" % (len(only) - 12) if len(only) > 12 else "")))
    if kind == "country" and len(facts) == 1 and nfam < 3: facts = []  # just the family split the header already gives
    ov_h = ("%s&rsquo;s snakes in numbers" % esc(name)) if kind == "country" else ("About the %s %s" % ("family" if kind == "family" else "genus", esc(name)))
    if kind == "country":  # its states/provinces and cities, each with its own page (build_regions.py)
        facts_extra = build_regions.country_sections(name, n)
    elif kind == "genus" and n >= 2:
        facts_extra = genus_compare(L, INFO_ALL[0], esc)
    else: facts_extra = ""
    overview = ('<section class="cy-sec" aria-labelledby="cy-ov-h"><h2 id="cy-ov-h">%s</h2><ul class="cy-facts">%s</ul></section>' % (ov_h, "".join(facts))) if facts else ""
    overview += facts_extra
    if kind == "country": crumbs = [("Countries", SITE + "species/#by-country", "../#by-country")]
    elif kind == "family": crumbs = [("Families", SITE + "species/#by-family", "../#by-family")]
    else: crumbs = [("Families", SITE + "species/#by-family", "../#by-family")] + ([(family, SITE + "species/family/" + slugify(family), "../family/" + slugify(family))] if family else [])
    ld = json.dumps([{"@context": "https://schema.org", "@type": "CollectionPage", "name": h1, "url": url, "description": lead,
                      "mainEntity": {"@type": "ItemList", "numberOfItems": n, "itemListElement": [
                          {"@type": "ListItem", "position": i + 1, "url": SITE + "species/" + page_name(x), "name": x["sci"] if x["is_sci"] else x["name"]} for i, x in enumerate(L[:100])]}},
                     {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
                         {"@type": "ListItem", "position": 1, "name": "SnakeList", "item": SITE},
                         ] + [{"@type": "ListItem", "position": i + 2, "name": c0[0], "item": c0[1]} for i, c0 in enumerate(crumbs)] + [
                         {"@type": "ListItem", "position": len(crumbs) + 2, "name": h1, "item": url}]}], ensure_ascii=False).replace("</", "<\\/")
    first = next((x for x in L if x["photo"] and len(x["photo"]) >= 5 and "Illustration" not in x["photo"][2]), None)
    img = SITE + "species-photos/t/%d-%d.webp" % (first["photo"][0], first["photo"][1]) if first else SITE + "snakelist-logo.png"
    cta = ("../../?map=%s" % quote_param(name), "View snakes on map") if kind == "country" else (
        ("../../?fam=%s" % quote_param(name), "Open the family in SnakeList") if kind == "family" else ("../../?q=%s" % quote_param(name), "Open the genus in SnakeList"))
    crumbs_html = "".join('<li><a href="%s">%s</a></li>' % (c0[2], esc(c0[0])) for c0 in crumbs)
    jump = ('<form class="cy-jump" id="cy-jump" role="search" action="../#by-country"><label for="cy-jq" class="cy-sr">Go to another country or territory</label><input id="cy-jq" list="cy-clist" placeholder="Another country or territory..." autocomplete="off"><datalist id="cy-clist"></datalist><button type="submit">Go</button></form>'
            if kind == "country" else "")
    # the introduction: what this family is (its reviewed text), what the genus name means, or
    # for a country, what its totals count
    about = ""
    if kind == "family" and FAMILY_INFO.get(name):
        fi = FAMILY_INFO[name]; R = Refs(fi, {}, page_name, "../")
        R.who = name
        paras = "".join(R.para(p) for p in fi["text"])
        about = ('<section class="cy-about" aria-labelledby="cy-ab-h"><h2 id="cy-ab-h" class="cy-sr">About the family</h2>%s'
                 '<details><summary>Sources for this introduction</summary>%s<p class="sp-note">Information last reviewed %s.</p></details></section>') % (
            paras, R.list_html(), fmt_date(fi["reviewed"]))
    elif kind == "genus":
        GI = GENUS_INFO.get(name); bits = []
        if GI:
            R = Refs({"sources": {"g": {"title": "Meaning of the name %s" % name, **GI["source"]}}}, {}, page_name, "../"); R.who = name
            bits.append('<p><b>What the name means:</b> <i>%s</i> &ndash; %s.%s</p>' % (esc(name), R.rich(GI["meaning"]), R.cite(["g"])))
            bits.append('<details><summary>Source</summary>%s<p class="sp-note">Information last reviewed %s.</p></details>' % (R.list_html(), fmt_date(GI["reviewed"])))
        fi = FAMILY_INFO.get(family)
        if fi and fi.get("common"):
            bits.insert(0, '<p>A genus of the family <a href="../family/%s">%s</a> (%s).</p>' % (slugify(family), esc(family), esc(fi["common"])))
        if bits: about = '<section class="cy-about" aria-labelledby="cy-ab-h"><h2 id="cy-ab-h" class="cy-sr">About the genus</h2>%s</section>' % "".join(bits)
    elif kind == "country" and (n or G):
        bits = []
        if land == "territory": bits.append("%s is a territory, not a sovereign country; SnakeList lists it as a place of its own." % esc(the_place(dn)[:1].upper() + the_place(dn)[1:]))
        bits.append("These totals count the unique living snake species SnakeList records in %s%s." % (esc(the_place(dn)), (
            "; the %s found here %s listed separately and not counted" % (esc(gone_txt), "is" if len(G) == 1 else "are")) if G else ""))
        if intro_here: bits.append("The %s brought here by people (introduced, not native) %s listed separately below and %s not in the total." % (
            nplural(len(intro_here), "species", "species"), "is" if len(intro_here) == 1 else "are", "is" if len(intro_here) == 1 else "are"))
        TERR = {"United States": ["Puerto Rico", "Guam", "American Samoa", "US Virgin Islands", "Northern Mariana Islands"],
                "France": ["French Guiana", "New Caledonia", "Martinique", "Guadeloupe", "Mayotte", "Réunion", "Saint Barthélemy", "Saint Martin"],
                "United Kingdom": ["British Virgin Islands", "Cayman Islands", "Montserrat", "Anguilla", "Turks and Caicos Islands", "Jersey"],
                "Netherlands": ["Aruba", "Curaçao", "Sint Maarten"]}
        listed = {k for x in all_countries["_cards"] for k in x["countries"]}
        terr = [t for t in TERR.get(name, []) if t in listed]
        if terr: bits.append("Territories that SnakeList lists as places of their own (%s) have their own pages and are not counted here." % ", ".join(
            '<a href="%s">%s</a>' % (slugify(t), esc(t)) for t in terr))
        bits.append("A species counts if it is recorded anywhere in the %s, so not every snake lives in every part of it." % land)
        about = '<section class="cy-about cy-about-note" aria-label="What the totals count"><p>%s</p></section>' % " ".join(bits)
    return COUNTRY.format(about=about, title=esc(title), desc=esc(desc), url=url, img=img, ld=ld, name=esc(name), lead=esc(lead), stats=stats,
                          h1=("<i>%s</i>" % esc(h1)) if kind == "genus" else esc(h1), crumbs=crumbs_html, jump=jump,
                          cta_href=esc(cta[0]), cta_label=cta[1], controls=controls, count=count, grid=grid, intro=intro_sec, overview=overview,
                          author=AUTHOR, big=" cy-big" if big else "", total=n,
                          site_head=site_header("../../", "species"), site_foot=site_footer("../../", "Every photo belongs to its photographer and is used under the Creative Commons licence they chose, credited with it."),
                          robots="index,follow,max-image-preview:large" if n or G else "noindex,follow")


def the_place(name):
    """'the United States', 'the Philippines' - but 'Portugal'"""
    if re.match(r"(United |Republic |Democratic Republic |Central African |Dominican |Czech Republic)", name) or re.search(r"(Islands|lands|Philippines|Bahamas|Gambia|Maldives|Seychelles|Comoros|Emirates)$", name):
        return "the " + name
    return name


def quote_param(s):
    from urllib.parse import quote
    return quote(s)


COUNTRY = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}"><meta name="author" content="{author}"><meta name="robots" content="{robots}">
<meta property="og:type" content="website"><meta property="og:site_name" content="SnakeList"><meta property="og:title" content="{title}"><meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{img}"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1F5A3A">
<link rel="icon" href="../../favicon.ico" sizes="any"><link rel="stylesheet" href="../sp.css"><link rel="stylesheet" href="../country.css">
<script type="application/ld+json">{ld}</script>
</head><body class="cy-page">
{site_head}
<main class="cy-main" id="main">
<nav class="cy-crumbs" aria-label="Breadcrumb"><ol><li><a href="../../">SnakeList</a></li><li><a href="../">Species</a></li>{crumbs}<li aria-current="page">{h1}</li></ol>
{jump}</nav>
<header class="cy-head">
<div class="cy-htext"><h1>{h1}</h1><p class="cy-lead">{lead}</p></div>
{stats}
<p class="cy-cta"><a class="cy-btn" href="{cta_href}">{cta_label}</a></p>
</header>{about}
<section class="cy-list{big}" aria-labelledby="cy-list-h" data-total="{total}"><h2 id="cy-list-h" class="cy-sr">Species</h2>
{controls}{count}{grid}
</section>
{intro}{overview}
</main>
{site_foot}
<script src="../country.js" defer></script>
</body></html>
"""

COUNTRY_CSS = """.sl-nophoto{display:flex;align-items:center;justify-content:center;width:100%;min-height:120px;height:100%;background:var(--tag,#e3f0dc);color:var(--muted,#55705b);font-size:13px;border-radius:inherit}
.cy-page{min-height:100vh;min-height:100dvh;display:flex;flex-direction:column}
.cy-main{flex:1 0 auto;width:100%;max-width:1120px;margin:0 auto;padding:0 16px 40px}
.cy-top{max-width:1120px}.cy-top nav{flex-wrap:wrap;justify-content:flex-end;gap:6px 16px}
.cy-sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.cy-page a:focus-visible,.cy-page button:focus-visible,.cy-page input:focus-visible,.cy-page select:focus-visible{outline:3px solid var(--g);outline-offset:2px}
.cy-crumbs{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;margin:2px 0 14px;font-size:13.5px;color:var(--muted)}
.cy-crumbs ol{list-style:none;display:flex;flex-wrap:wrap;margin:0;padding:0}.cy-crumbs li+li:before{content:"/";margin:0 8px;color:var(--tagline)}
.cy-crumbs a{color:var(--muted)}.cy-crumbs a:hover{color:var(--g)}.cy-crumbs [aria-current]{color:var(--text);font-weight:600}
.cy-jump{display:flex;gap:6px}.cy-jump input{width:190px;max-width:52vw;font:inherit;font-size:14px;padding:6px 10px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text)}
.cy-jump button,.cy-reset{font:600 13px Inter,system-ui,sans-serif;padding:6px 12px;border-radius:10px;border:1px solid var(--tagline);background:var(--tag);color:var(--text);cursor:pointer}
.cy-head{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:22px 24px;display:grid;grid-template-columns:1fr auto;gap:14px 24px;align-items:center;box-shadow:0 1px 2px rgba(20,60,30,.06)}
.cy-head h1{font:700 clamp(28px,4.4vw,40px)/1.12 Georgia,serif;margin:0;overflow-wrap:anywhere}
.cy-lead{margin:8px 0 0;color:var(--muted);font-size:16px;max-width:62ch}
.cy-stats{grid-column:1;list-style:none;margin:2px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.cy-stats li{display:flex;align-items:baseline;gap:6px;background:var(--tag);border:1px solid var(--tagline);border-radius:12px;padding:5px 12px;font-size:13.5px;color:var(--muted)}
.cy-stats b{font-size:18px;color:var(--text)}
@media (prefers-color-scheme:dark){.cy-stats li{color:var(--text)}}
.cy-cta{grid-column:2;grid-row:1/span 2;margin:0}
.cy-btn{display:inline-flex;align-items:center;min-height:44px;background:var(--g);color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:12px;white-space:nowrap}
.cy-btn:hover{filter:brightness(.95)}
.cy-list{margin-top:22px;background:none;border:0;padding:0;border-radius:0}
.cy-tools{display:flex;flex-wrap:wrap;gap:10px 12px;align-items:flex-end;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.cy-tools label{display:flex;flex-direction:column;gap:3px;min-width:0}.cy-lab{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.cy-q{flex:1 1 240px}.cy-tools input,.cy-tools select{font:inherit;font-size:15px;min-height:40px;padding:6px 10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text);max-width:100%}
.cy-tools input{width:100%}.cy-reset{min-height:40px}
.cy-count{margin:12px 2px 10px;font-size:14px;color:var(--muted)}
.cy-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
.cy-list:not(.cy-big) .cy-grid,.cy-grid-intro{grid-template-columns:repeat(auto-fill,minmax(230px,256px))}
.cy-card a{display:flex;flex-direction:column;height:100%;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;color:inherit;text-decoration:none;transition:border-color .15s,box-shadow .15s}
.cy-card a:hover{border-color:var(--tagline);box-shadow:0 3px 10px rgba(20,60,30,.10)}
.cy-img{display:block;aspect-ratio:3/2;background:var(--line);overflow:hidden}.cy-img img{width:100%;height:100%;object-fit:cover;display:block}
.cy-noimg{display:grid;place-items:center;height:100%;color:var(--muted);font-size:13px}
.cy-body{display:flex;flex-direction:column;gap:2px;padding:10px 12px 12px;flex:1}
.cy-name{font:700 16.5px/1.25 Georgia,serif;overflow-wrap:anywhere}.cy-sci{color:var(--muted);font-size:13.5px;overflow-wrap:anywhere}
.cy-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:auto;padding-top:8px}
.cy-b{font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px;border:1px solid var(--line);line-height:1.4}
.cy-b.v{background:#fbe9e3;border-color:#e8b9a8;color:#8a2f17}.cy-b.nv{background:var(--tag);border-color:var(--tagline);color:var(--text)}
.cy-b.x{color:var(--muted)}.cy-b.i{background:#fdf1df;border-color:#ecc995;color:#7a4a0c}
.cy-fam{font-size:12.5px;color:var(--muted)}
.cy-empty,.cy-none{background:var(--card);border:1px dashed var(--tagline);border-radius:14px;padding:18px 20px;margin:4px 0 0}
.cy-none p{margin:4px 0}.cy-link{font:inherit;background:none;border:0;color:var(--link);text-decoration:underline;cursor:pointer;padding:0}
.cy-more-wrap{text-align:center;margin:16px 0 0}.cy-more{font:600 14px Inter,system-ui,sans-serif;min-height:42px;padding:8px 22px;border-radius:12px;border:1px solid var(--tagline);background:var(--card);color:var(--text);cursor:pointer}
.cy-sec{margin-top:26px}.cy-sec h2{font:700 21px Georgia,serif;margin:0 0 6px}.cy-note{margin:0 0 12px;color:var(--muted);font-size:14px}
.cy-facts{margin:0;padding-left:18px}.cy-facts li{margin:4px 0}
.cy-foot{border-top:1px solid var(--line);text-align:center;color:var(--muted);font-size:13px;padding:18px 16px 26px}
.cy-foot p{margin:4px 0}.cy-flogo{font:700 17px Georgia,serif;color:var(--g);text-decoration:none}
.cy-flinks{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 16px}.cy-foot a{color:var(--muted)}.cy-foot .cy-flogo{color:var(--g)}.cy-fnote{font-size:12px}
@media (prefers-color-scheme:dark){.cy-b.v{background:#5a2a1c;border-color:#a5553a;color:#ffd9cc}.cy-b.i{background:#5a4318;border-color:#a8833d;color:#ffe3b0}
.cy-head,.cy-card a:hover{box-shadow:none}.cy-tools input,.cy-tools select{background:var(--bg)}}
@media (max-width:760px){.cy-head{grid-template-columns:1fr;padding:18px}.cy-cta{grid-column:1;grid-row:auto}.cy-btn{width:100%;justify-content:center}}
@media (max-width:560px){.cy-main{padding:0 12px 32px}.cy-crumbs{flex-direction:column;align-items:stretch}.cy-jump input{flex:1;width:auto;max-width:none}
.cy-tools{padding:10px}.cy-tools label:not(.cy-q){flex:1 1 calc(50% - 6px)}.cy-tools select{width:100%}
.cy-grid,.cy-list:not(.cy-big) .cy-grid,.cy-grid-intro{grid-template-columns:1fr;gap:10px}
.cy-card a{flex-direction:row;min-height:96px}.cy-img{flex:0 0 112px;width:112px;aspect-ratio:auto;align-self:stretch}.cy-body{padding:9px 12px}
.cy-name{font-size:15.5px}.cy-stats b{font-size:16px}}
@media (prefers-reduced-motion:reduce){.cy-card a{transition:none}}
"""

COUNTRY_JS = r"""(function(){function nf(t){if(!t||t.tagName!=='IMG'||t.dataset.nf)return;t.dataset.nf=1;var d=document.createElement('span');d.className='sl-nophoto';d.setAttribute('role','img');d.setAttribute('aria-label',t.alt||'Photo unavailable');d.textContent='Photo unavailable';if(t.width&&t.height)d.style.aspectRatio=t.width+'/'+t.height;t.replaceWith(d)}
window.addEventListener('error',function(e){nf(e.target)},true);[].forEach.call(document.images,function(i){if(i.complete&&!i.naturalWidth&&i.getAttribute('src'))nf(i)})})();
(function(){
var grid=document.getElementById('cy-grid'),PAGE=60,shown=PAGE;
// the country picker: every country page, typed to search
var jump=document.getElementById('cy-jump'),jq=document.getElementById('cy-jq'),dl=document.getElementById('cy-clist'),C=null;
function loadC(){if(C)return;C={};fetch('../countries.json').then(function(r){return r.ok?r.json():{}}).then(function(o){C=o;dl.innerHTML=Object.keys(o).map(function(n){return '<option value="'+n.replace(/"/g,'&quot;')+'">'}).join('')}).catch(function(){})}
if(jq){jq.addEventListener('focus',loadC);jq.addEventListener('change',function(){go(false)})}
function go(sub){var v=(jq.value||'').trim().toLowerCase(),hit=null;for(var k in C)if(k.toLowerCase()===v){hit=k;break}
if(!hit&&sub){for(var k2 in C)if(k2.toLowerCase().indexOf(v)===0){hit=k2;break}}if(hit){location.href=C[hit];return true}return false}
if(jump)jump.addEventListener('submit',function(e){e.preventDefault();loadC();if(!go(true)&&C&&Object.keys(C).length)jq.setCustomValidity('No country called that in SnakeList'),jq.reportValidity(),setTimeout(function(){jq.setCustomValidity('')},1500)});
if(!grid)return;
var items=[].slice.call(grid.children),total=items.length,count=document.getElementById('cy-count'),empty=document.getElementById('cy-empty'),more=document.getElementById('cy-more');
var q=document.getElementById('cy-q'),fv=document.getElementById('cy-v'),ff=document.getElementById('cy-f'),fs=document.getElementById('cy-s'),reset=document.getElementById('cy-reset');
items.forEach(function(li,i){li._t=(li.textContent+' '+li.dataset.f).toLowerCase();li._i=i});
function cmp(a,b){var s=fs?fs.value:'n',x,y;
if(s==='s'){x=a.dataset.s;y=b.dataset.s}else if(s==='f'){x=(a.dataset.f||'~')+' '+a.dataset.n;y=(b.dataset.f||'~')+' '+b.dataset.n}else{x=a.dataset.n;y=b.dataset.n}
var r=x<y?-1:x>y?1:(a.dataset.s<b.dataset.s?-1:a.dataset.s>b.dataset.s?1:0);if(s==='nr'){r=-r;if(a.dataset.n.charAt(0)==='~'!==(b.dataset.n.charAt(0)==='~'))r=-r}return r}
function apply(keep){
var t=q?q.value.trim().toLowerCase():'',v=fv?fv.value:'',f=ff?ff.value:'';
var hit=items.filter(function(li){return (!t||li._t.indexOf(t)>=0)&&(!v||li.dataset.v===v)&&(!f||(f==='-'?!li.dataset.f:li.dataset.f===f))});
hit.sort(cmp);if(!keep)shown=PAGE;
var frag=document.createDocumentFragment();hit.forEach(function(li){frag.appendChild(li)});
items.forEach(function(li){li.hidden=true});grid.appendChild(frag);
hit.forEach(function(li,i){li.hidden=i>=shown});
var vis=Math.min(hit.length,shown);
if(count)count.textContent=hit.length===total?(vis===total?'Showing '+total+' species':'Showing '+vis+' of '+total+' species'):
(vis<hit.length?'Showing '+vis+' of '+hit.length+' matching species ('+total+' in all)':'Showing '+hit.length+' of '+total+' species');
empty.hidden=hit.length>0;more.hidden=hit.length<=shown;if(!more.hidden)more.textContent='Show more ('+(hit.length-shown)+' left)';
if(reset)reset.hidden=!(t||v||f||(fs&&fs.value!=='n'))}
[q,fv,ff,fs].forEach(function(el){if(el)el.addEventListener(el===q?'input':'change',function(){apply()})});
function clear(){if(q)q.value='';if(fv)fv.value='';if(ff)ff.value='';if(fs)fs.value='n';apply();(q||grid).focus&&q&&q.focus()}
if(reset)reset.addEventListener('click',clear);var cl=document.getElementById('cy-clear');if(cl)cl.addEventListener('click',clear);
more.addEventListener('click',function(){var first=shown;shown+=PAGE;apply(true);var li=grid.children[first];if(li){var a=li.querySelector('a');if(a)a.focus({preventScroll:true})}});
apply(true);
})();
"""
