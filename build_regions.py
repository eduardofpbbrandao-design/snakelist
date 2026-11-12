"""State/province pages (species/region/<cc>-<name>.html) and city pages (species/city/<cc>-<name>.html),
built from the same app data as the species pages. Called by build_species.pages().

What the data can and cannot say, and how the pages word it:
- SnakeList records each snake by country and - for most countries - by state, district, province or
  island (the cards' data-states / data-provinces). Each place is called what its country calls it
  (the app's SUBDIV table, read from the app): Porto is a district, Texas a state. A place's identity
  is its key (country code + its own name; "region:pt-porto", "city:pt-porto"), never its name alone,
  and a district named like a city of its country is always titled with its type ("Porto District").
- Counts are unique LIVING species. Fossil and extinct taxa are listed in their own sections with
  their age and never counted; introduced snakes are listed apart too.
- Species recorded in a country with no state/district record there are "possible", listed apart on
  each part's page - never as recorded there (the app's map used to count them, see place-counts.js).
- Nothing is recorded per city: a city page says so, then lists the district's species and the
  possible ones separately, with the explicit wording that presence in the city is not confirmed.
- "Most recorded worldwide" uses #rarity-data: in how many places each species has research-grade
  iNaturalist records across its WHOLE range - a global ranking, labelled as such.
- "Found only here" means: no other place in SnakeList's data - not a claim of endemism.
- Habitats: only what the reviewed, sourced species accounts (data/species-info) say about each
  species in general; the old per-place habitat counts (estimated from ranges) are gone.
- Who described a snake: the reviewed account's authority where there is one; otherwise the page
  asks Wikidata in the visitor's browser (wd.js) and says where the answer came from.
"""
import json, re, os, math, unicodedata, html as H
from urllib.parse import quote
import build_species as B

REG = {}      # "cc-slug" -> the region (a state, province or island as the cards name it)
RAW = {}      # (cc, the cards' own name) -> "cc-slug"
BY_CC = {}    # cc -> region keys
CITIES = []   # every city of the app's list that could be placed in a region
CITY = {}     # "cc-slug" -> the cities that get their own page
CITY_CAP = 25  # city pages per country: the biggest ones (SL_CITIES is in population order)
MIN_INDEX = 3  # a region (or its cities) with fewer species is still a page, but kept out of search results

COUNTRY_ONLY = {}  # cc -> living species recorded in the country with no state/district record there
GONE = {}     # cc -> fossil and extinct species of the country (never counted as living there)
SHAPES = [None]  # region.provinces: every map shape of a country, recorded or not (for placing cities)

# ---- what each country calls its parts --------------------------------------------------------
# The app's own table (SUBDIV in snakelist-synced.html, used by its subdivWord()) is read from
# the app at build time, so the pages and the map always use the same word: Portugal's parts are
# districts, Spain's provinces, France's regions. A few places differ from the rest of their
# country (a territory among states); those are named here.
SUBDIV = {}           # cc -> "districts", "states & territories", ...
NON_SOVEREIGN = set()  # the app's NON_SOVEREIGN: places in the checklist that are territories, not countries
TYPE_OF = {("us", "DC"): "federal district", ("us", "PR"): "territory", ("us", "GU"): "territory", ("us", "AS"): "territory",
           ("us", "MP"): "territory", ("us", "VI"): "territory",
           ("ca", "Yukon"): "territory", ("ca", "Northwest Territories"): "territory", ("ca", "Nunavut"): "territory",
           ("in", "Delhi"): "union territory", ("in", "Puducherry"): "union territory", ("in", "Chandigarh"): "union territory",
           ("in", "Jammu and Kashmir"): "union territory", ("in", "Ladakh"): "union territory", ("in", "Lakshadweep"): "union territory",
           ("in", "Andaman and Nicobar"): "union territory", ("in", "Andaman and Nicobar Islands"): "union territory",
           ("in", "Dadra and Nagar Haveli and Daman and Diu"): "union territory",
           ("pk", "Islamabad"): "territory", ("pk", "Gilgit-Baltistan"): "territory", ("pk", "Azad Kashmir"): "territory",
           ("es", "Ceuta"): "autonomous city", ("es", "Melilla"): "autonomous city",
           ("my", "Kuala Lumpur"): "federal territory",
           # cities that are a first-level unit of their own, not part of the region around them
           ("et", "Addis Ababa"): "chartered city", ("et", "Dire Dawa"): "chartered city",
           ("kr", "Seoul"): "special city", ("kr", "Sejong"): "special self-governing city", ("kr", "Busan"): "metropolitan city",
           ("kr", "Daegu"): "metropolitan city", ("kr", "Incheon"): "metropolitan city", ("kr", "Gwangju"): "metropolitan city",
           ("kr", "Daejeon"): "metropolitan city", ("kr", "Ulsan"): "metropolitan city",
           ("cn", "Beijing"): "municipality", ("cn", "Shanghai"): "municipality", ("cn", "Tianjin"): "municipality", ("cn", "Chongqing"): "municipality",
           ("vn", "Hanoi"): "municipality", ("vn", "Ho Chi Minh"): "municipality", ("vn", "Da Nang"): "municipality",
           ("vn", "Haiphong"): "municipality", ("vn", "Cần Thơ"): "municipality",
           ("ru", "Moscow"): "federal city", ("ru", "Saint Petersburg"): "federal city",
           ("br", "Distrito Federal"): "federal district", ("ng", "Federal Capital Territory"): "territory",
           ("th", "Bangkok"): "special administrative area", ("kh", "Phnom Penh"): "municipality", ("hu", "Budapest"): "capital city", ("pg", "of Bougainville"): "autonomous region", ("pt", "Azores"): "autonomous region", ("pt", "Madeira"): "autonomous region"}


# a name the map data carries cut short ("of Bougainville", from "Autonomous Region of Bougainville")
NAME_FIX = {("pg", "of Bougainville"): "Bougainville"}


def load_terms(app):
    SUBDIV.clear(); NON_SOVEREIGN.clear()
    m = re.search(r'var SUBDIV = \{\};\s*\((.*?)\)\.split\("\|"\)', app, re.S)
    if m:
        s = "".join(re.findall(r'"([^"]*)"', m.group(1)))
        for grp in s.split("|"):
            w, _, ccs = grp.partition(":")
            for cc in ccs.split(): SUBDIV[cc] = w
    m = re.search(r"var NON_SOVEREIGN = \{(.*?)\};", app, re.S)
    if m: NON_SOVEREIGN.update(H.unescape(x) for x in re.findall(r'"([^"]+)":1', m.group(1)))


def one_word(w):
    """the app's own singular rule (subdivWord(..., one=true)): districts -> district, counties -> county"""
    return "castello" if w == "castelli" else re.sub(r"s$", "", re.sub(r"(sh|ch)es$", r"\1", re.sub(r"ies$", "y", w)))


def place_type(cc, raw=""):
    """what one state/district/province is called: Porto is a district, Texas a state, Guam a territory"""
    if (cc, raw) in TYPE_OF: return TYPE_OF[(cc, raw)]
    w = SUBDIV.get(cc, "regions")
    parts = [one_word(p) for p in w.split(" & ")]
    if len(parts) > 1:  # "Northern Territory", "Chin State", "Sarajevo Canton": the name says which
        hit = next((p for p in parts if re.search(r"\b%s\b" % p.split()[-1], raw, re.I)), None)
        if hit: return hit
        return {"mm": "region", "ba": "region"}.get(cc, parts[0])
    return parts[0]


def kword(cc, many=False):
    """the word for a country's parts in general: "districts" (Portugal), "states and territories" (Australia)"""
    w = SUBDIV.get(cc, "regions")
    return w.replace(" & ", " and ") if many else " or ".join(one_word(p) for p in w.split(" & "))


def is_territory(name): return name in NON_SOVEREIGN


def count_places(names):
    """the app's countPlaces(): "3 countries (+1 territory)" - territories are not counted as countries"""
    t = sum(1 for n in names if n in NON_SOVEREIGN); c = len(names) - t
    if not names: return ""
    out = B.nplural(c, "country", "countries") if c else ""
    if t: out = (out + " (+%s)" % B.nplural(t, "territory", "territories")) if c else B.nplural(t, "territory", "territories")
    return out
def land_word(name): return "territory" if is_territory(name) else "country"
def esc(t): return H.escape(str(t), quote=True)
def strip_n(n): return re.sub(r" \(\d+\)$", "", n)
def nf(k): return "{:,}".format(k)


def km(a, b):
    """great-circle distance in km between two (lat, lon)"""
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(min(1, math.sqrt(h)))


def pip(lon, lat, ring):
    inside, j = False, len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]; xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi: inside = not inside
        j = i
    return inside


def index(cards, region, iso, app):
    """which regions exist (one per state/province name the cards use, the numbered duplicates of
    the map's shapes - 'Lima (2)' - joined to their name), their outlines, neighbours and cities"""
    REG.clear(); RAW.clear(); BY_CC.clear(); CITIES.clear(); CITY.clear(); COUNTRY_ONLY.clear(); GONE.clear()
    SHAPES[0] = region.provinces
    load_terms(app)
    in_cards = {n for c in cards for n in c["countries"]}
    cc2name = {}
    for n, code in iso.items():
        if n in in_cards: cc2name.setdefault(code, n)
    for c in cards:
        pairs = [(p.partition(":")[0].lower(), p.partition(":")[2]) for p in c["provinces"]] + [("us", s) for s in c["states"]]
        for cc, raw in pairs:
            disp = region.us_names.get(raw, raw) if cc == "us" else NAME_FIX.get((cc, raw), strip_n(raw))
            sl = B.slugify(disp)
            if not sl: continue
            key = cc + "-" + sl
            r = REG.get(key)
            if not r:
                # a place's identity is its key (country code + its own name), never its name alone:
                # Porto District (pt-porto, a region) and Porto city (a city row) are different places
                r = REG[key] = {"key": key, "id": "region:" + key, "cc": cc, "name": disp, "raw": set(), "ids": set(), "country": cc2name.get(cc, cc.upper()),
                                "parent": "country:" + cc, "type": place_type(cc, raw), "cities": []}
            r["raw"].add(raw); r["ids"].add(c["id"]); RAW[(cc, raw)] = key
    for k in sorted(REG): BY_CC.setdefault(REG[k]["cc"], []).append(k)
    # what is counted: living species only. Fossil and recently extinct taxa are listed apart, never
    # as snakes that live in a place
    gone = {c["id"] for c in cards if c["fossil"] or c["extinct"]}
    for r in REG.values():
        r["living"] = r["ids"] - gone; r["gone"] = r["ids"] & gone
    # species recorded in a country (with state/district data) but with no state/district there:
    # they may live in any part of it, so a part's page lists them apart as "possible", never as recorded
    for c in cards:
        for n in c["countries"]:
            cc = iso.get(n, "")
            if cc not in BY_CC: continue
            if c["id"] in gone: GONE.setdefault(cc, set()).add(c["id"])
            elif not regions_of(c, cc): COUNTRY_ONLY.setdefault(cc, set()).add(c["id"])
    # outlines: the map's shapes with the same name, or that belong to a named group (ID:Nusa Tenggara)
    for k, r in REG.items():
        shapes = region.provinces(r["cc"]); rings, bx = [], []
        for nm, e in shapes.items():
            if nm in r["raw"] or (e["also"] & r["raw"]): rings += e["rings"]; bx.append(e["box"])
        r["rings"] = rings
        r["box"] = (min(b[0] for b in bx), max(b[1] for b in bx), min(b[2] for b in bx), max(b[3] for b in bx)) if bx else None
        r["mid"] = ((r["box"][2] + r["box"][3]) / 2, (r["box"][0] + r["box"][1]) / 2) if bx else None
    # neighbours: regions whose borders run through the same few-km squares (any country)
    cells = {}
    for k, r in REG.items():
        own = {(round(p[0] * 10), round(p[1] * 10)) for ring in r["rings"] for p in ring}
        r["ncell"] = len(own)
        for cl in own: cells.setdefault(cl, []).append(k)
    shared = {}
    for ks in cells.values():
        if 1 < len(ks) < 7:
            for a in ks:
                for b in ks:
                    if a != b: shared.setdefault(a, {}).setdefault(b, 0); shared[a][b] += 1
    for k, r in REG.items():
        nb = []
        for o, n in shared.get(k, {}).items():
            # a group and its own islands (Nusa Tenggara / Flores) overlap rather than touch
            if n >= 3 and n < 0.6 * min(r["ncell"], REG[o]["ncell"]): nb.append(o)
        r["nb"] = sorted(nb, key=lambda o: (REG[o]["cc"] != r["cc"], B.slugify(REG[o]["name"])))
        r["near"] = []
        if not nb and r["mid"]:  # islands: the closest regions of the same country instead
            near = sorted((km(r["mid"], REG[o]["mid"]), o) for o in BY_CC[r["cc"]] if o != k and REG[o]["mid"])
            r["near"] = [o for d, o in near[:5]]
    # cities: the app's list (biggest first); placed by the state it names, else by its coordinates
    rows = json.loads(re.search(r"window\.SL_CITIES = (\[.*?\]);\n", app, re.S).group(1))
    per_cc, used = {}, set()
    for rank, ct in enumerate(rows):
        nm, cn, lat, lon = ct[0], ct[1], ct[2], ct[3]
        cc = iso.get(cn, ""); key = None; how = "listed"
        if len(ct) > 4 and ":" in ct[4]:
            # the app names its state/district: that one or none (a district with no records - Bogota
            # D.C. - is not swapped for the department around it)
            c2, _, pn = ct[4].partition(":"); cc = c2.lower(); key = RAW.get((cc, pn))
        elif cc in BY_CC:
            key = locate(cc, lon, lat, nm); how = "coords"
        if not key: continue
        r = REG[key]
        city = {"name": nm, "country": cn, "cc": r["cc"], "lat": lat, "lon": lon, "region": key, "rank": rank, "how": how, "page": None,
                "type": "city", "parent": r["id"], "id": None, "app": "%s|%s" % (nm, cn)}
        CITIES.append(city); r["cities"].append(city)
        if per_cc.get(r["cc"], 0) < CITY_CAP:
            per_cc[r["cc"]] = per_cc.get(r["cc"], 0) + 1
            sl = r["cc"] + "-" + B.slugify(nm)
            if sl in used: sl = sl + "-" + key.split("-", 1)[1]
            if sl in used: continue
            used.add(sl); city["page"] = sl; CITY[sl] = city
        city["id"] = "city:" + (city["page"] or r["cc"] + "-" + B.slugify(nm) + "@" + key)
    # a region named like a city of its country (Porto, Lisbon, New York) or like the country
    # itself is always called by its type as well - "Porto District" - so the two never read as one
    fold = lambda t: B.slugify(t)
    city_names = {}
    for ct in rows: city_names.setdefault(iso.get(ct[1], ""), set()).add(fold(ct[0]))
    for r in REG.values():
        clash = fold(r["name"]) in city_names.get(r["cc"], set()) or fold(r["name"]) == fold(r["country"])
        t = r["type"]
        r["title"] = r["name"] if not clash or re.search(r"\b%s\b" % re.escape(t.split()[-1]), r["name"], re.I) else "%s %s" % (r["name"], t.title())
        # in running text: "the Northern Territory", "the Balearic Islands" - but "Porto District", "Texas"
        r["the"] = ("the " + r["title"]) if re.search(r"(Territory|Territories|Islands|Republic)$", r["title"]) and not r["title"].startswith("The ") else r["title"]


def fold(t):
    return re.sub(r"[^a-z]+", " ", unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()).strip()


def locate(cc, lon, lat, name=""):
    """the region of one country a city falls in, looked up among ALL the map's shapes of that country
    (the same lookup as the app's cityArea()), then matched to a region page. In order:
    a shape with the city's own name close by (Addis Ababa, Busan, Tunis: chartered cities and capital
    districts, whose simplified outline can lose the point to the region around them); else the
    smallest shape the point is in (Berlin inside Brandenburg); else one whose border is within ~20 km
    (a coastal city just outside the simplified outline). A city whose shape has no species records
    of its own is left without a region - never given the neighbouring one's (Brussels is not in
    Flemish Brabant, Malabo not in Bioko Sur)."""
    shapes = SHAPES[0](cc) if SHAPES[0] else {}
    def near_box(b, pad): return b[0] - pad <= lon <= b[1] + pad and b[2] - pad <= lat <= b[3] + pad
    inside = None
    for nm, e in shapes.items():
        if not near_box(e["box"], 0): continue
        for ring in e["rings"]:
            if pip(lon, lat, ring):
                xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
                a = (max(xs) - min(xs)) * (max(ys) - min(ys))
                if inside is None or a < inside[0]: inside = (a, nm)
    pick = None
    # the shape it is in already carries its name (Vientiane in Vientiane Prefecture): that one
    if name and inside and fold(name) in fold(strip_n(inside[1])): pick = inside[1]
    if name and not pick:
        same = sorted(((e["box"][1] - e["box"][0]) * (e["box"][3] - e["box"][2]), nm) for nm, e in shapes.items()
                      if fold(strip_n(nm)) == fold(name) and near_box(e["box"], .3))
        if same: pick = same[0][1]
    if not pick and inside: pick = inside[1]
    if not pick:
        near = None
        for nm, e in shapes.items():
            if not near_box(e["box"], .3): continue
            d = min(((p[0] - lon) * math.cos(math.radians(lat))) ** 2 + (p[1] - lat) ** 2 for ring in e["rings"] for p in ring)
            if d < .2 ** 2 and (near is None or d < near[0]): near = (d, nm)
        if near: pick = near[1]
    if not pick: return None
    if (cc, pick) in RAW: return RAW[(cc, pick)]
    for a in sorted(shapes[pick]["also"]):  # a shape inside a named group (ID:Java)
        if (cc, a) in RAW: return RAW[(cc, a)]
    return None


def key_of(cc, raw):
    """the region page (species/region/<key>) for one of a card's own state/province names, or None"""
    return RAW.get((cc, raw))


# ---------------------------------------------------------------------------------------------
def build(cards, by_id, info, invasive, iso, harm):
    """write every region and city page; returns their URLs for the sitemap (the indexable ones)"""
    os.makedirs(B.OUT + "/region", exist_ok=True); os.makedirs(B.OUT + "/city", exist_ok=True)
    open(B.OUT + "/wd.js", "w", encoding="utf-8").write(WD_JS)
    # introduced populations, by region: the app's INVASIVE table names the states/areas they were brought to
    intro = {}
    for sid, L in invasive.items():
        c = by_id.get(sid)
        if not c: continue
        for x in L:
            cc = x["code"] or iso.get(x["name"], "")
            for raw in (x.get("states") or []) + (x.get("areas") or []):
                k = RAW.get((cc, raw)) or (cc + "-" + B.slugify(raw) if (cc + "-" + B.slugify(raw)) in REG else None)
                if k: intro.setdefault(k, []).append((c, x.get("note", "")))
    ctx = {"by_id": by_id, "info": info, "intro": intro, "harm": harm}
    srt = lambda ids: sorted((by_id[i] for i in ids if i in by_id), key=skey)
    urls = []
    keep = set()
    for k, r in REG.items():
        L, G, P = srt(r["living"]), srt(r["gone"]), srt(COUNTRY_ONLY.get(r["cc"], set()) - r["ids"])
        html = region_page(r, L, G, P, ctx)
        open("%s/region/%s.html" % (B.OUT, k), "w", encoding="utf-8").write(html); keep.add(k + ".html")
        if len(L) >= MIN_INDEX: urls.append(B.SITE + "species/region/" + k)
    # the app's map links to these pages: its own place keys ("US:TX", "PT:Lisboa") and city rows -> page names
    pages = {"r": {"%s:%s" % (cc.upper(), raw): k for (cc, raw), k in RAW.items()},
             "c": {"%s|%s" % (city["name"], city["country"]): sl for sl, city in CITY.items()}}
    open(B.OUT + "/pages.js", "w", encoding="utf-8").write("window.SL_PAGES=" + json.dumps(pages, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + ";\n")
    open(B.OUT + "/place-counts.js", "w", encoding="utf-8").write(place_counts_js(cards, invasive, iso, by_id))
    keepc = set()
    for sl, city in CITY.items():
        r = REG[city["region"]]
        L, P = srt(r["living"]), srt(COUNTRY_ONLY.get(r["cc"], set()) - r["ids"])
        open("%s/city/%s.html" % (B.OUT, sl), "w", encoding="utf-8").write(city_page(city, r, L, P, ctx)); keepc.add(sl + ".html")
        if len(L) >= MIN_INDEX: urls.append(B.SITE + "species/city/" + sl)
    # pages from an earlier build that no longer exist (a renamed province): removed, not left stale
    for d, ok in (("region", keep), ("city", keepc)):
        for f in os.listdir(B.OUT + "/" + d):
            if f.endswith(".html") and f not in ok: os.remove("%s/%s/%s" % (B.OUT, d, f))
    return urls


def app_key(r):
    """the app's own key for a region ("US:TX", "PT:Porto"); a region joined from numbered map shapes takes its plain name"""
    raws = sorted(r["raw"], key=lambda x: (x != r["name"] and not r["cc"] == "us", x))
    return "%s:%s" % (r["cc"].upper(), raws[0])


def place_counts_js(cards, invasive, iso, by_id):
    """species/place-counts.js: the counts the pages show, for the app's map to show the same.
    Every number is unique living species (fossil and extinct taxa never count as living anywhere)."""
    country = {}
    for c in cards:
        for n in c["countries"]:
            e = country.setdefault(n, [set(), set(), set(), set()])
            e[1 if c["fossil"] else 2 if c["extinct"] else 0].add(c["id"])
    for sid, L in invasive.items():
        c = by_id.get(sid)
        if not c: continue
        for x in L:
            if x["name"] and x["name"] not in c["countries"]: country.setdefault(x["name"], [set(), set(), set(), set()])[3].add(sid)
    region = {}
    for (cc, raw), k in RAW.items():
        r = REG[k]
        region["%s:%s" % (cc.upper(), raw)] = [len(r["living"]), len(COUNTRY_ONLY.get(cc, set()) - r["ids"]), len(r["gone"]), r["type"], k]
    city = {}
    for ct in CITIES:
        r = REG[ct["region"]]
        city.setdefault(ct["app"], [app_key(r), len(r["living"]), len(COUNTRY_ONLY.get(r["cc"], set()) - r["ids"]), ct["page"]])
    out = {
        "v": 1,
        "about": "Counts of unique living snake species, as the SnakeList place pages show them. Fossil and extinct taxa are never counted as living.",
        "fields": {
            "country": ["living (recorded in the country or territory)", "fossil (known only from fossils found there)", "extinct (recently extinct, last recorded there)", "introduced (brought by people, not native; not in living)"],
            "region": ["living (recorded in this state/district/province)", "countryOnly (living, recorded in the country with no state/district record there: possible, not recorded here)",
                       "fossilOrExtinct (not counted)", "type (what this place is: district, state, province, territory...)", "page (species/region/<page>.html)"],
            "city": ["region (the app key of the state/district the city is in)", "living in that region (the city itself has no records)", "countryOnly (possible, see region)",
                     "page (species/city/<page>.html, or null)"]},
        "country": {n: [len(e[0]), len(e[1]), len(e[2]), len(e[3])] for n, e in sorted(country.items())},
        "region": region, "city": city}
    return "window.SL_PLACE_COUNTS=" + json.dumps(out, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + ";\n"


def skey(c): return ((1 if c["is_sci"] else 0), (c["sci"] if c["is_sci"] else c["name"]).lower())
def label(c): return c["sci"] if c["is_sci"] else c["name"]


def sp_a(c, rel="../"):
    return '<a href="%s%s">%s</a>%s' % (rel, B.page_name(c), esc(label(c)), (" <i>%s</i>" % esc(c["sci"])) if not c["is_sci"] else "")


def photo_card(c, note=""):
    p = c["photo"]
    has = bool(p and len(p) >= 5 and "Illustration" not in p[2])
    alt = "Photo of %s" % (c["sci"] if c["is_sci"] else "%s (%s)" % (c["name"], c["sci"]))
    img = ('<img src="../../species-photos/t/%d-%d.webp" alt="%s" width="540" height="360" loading="lazy" decoding="async">' % (p[0], p[1], esc(alt))
           if has else '<span class="cy-noimg">No photo yet</span>')
    t = ('<strong class="cy-name"><i>%s</i></strong>' % esc(c["sci"])) if c["is_sci"] else (
        '<strong class="cy-name">%s</strong><i class="cy-sci">%s</i>' % (esc(c["name"]), esc(c["sci"])))
    b = '<span class="cy-b %s">%s</span>' % (("v", "Venomous") if c["venom"] else ("nv", "Non-venomous"))
    return ('<li class="cy-card"><a href="../%s"><span class="cy-img">%s</span><span class="cy-body">%s<span class="cy-meta">%s%s</span></span></a></li>') % (
        B.page_name(c), img, t, b, ('<span class="cy-fam">%s</span>' % esc(note)) if note else "")


_AUTH = []
def authority(info, c):
    """(authority, author(s), year, bracketed) from the reviewed account, else data/authorities.json (checked by hand)"""
    if not _AUTH:
        try: _AUTH.append(json.load(open("data/authorities.json", encoding="utf-8")))
        except (OSError, ValueError): _AUTH.append({})
    a = (info.get(c["id"]) or {}).get("authority", "") or _AUTH[0].get(c["id"], "")
    m = re.match(r"^\(?(.*?),?\s*(\d{4})\)?$", a.strip())
    return (a, m.group(1).strip(), int(m.group(2)), a.strip().startswith("(")) if m else None


def is_are(k): return "is" if k == 1 else "are"


def age_text(c):
    if c["fossil"]: return (c["died"][0] + ", " + c["died"][1]) if c["died"] else "fossil; age not recorded in SnakeList"
    return c["extinct"].split(" - ")[0]


def gone_sections(G, where, rel_species="../", local=True):
    """fossil and recently extinct taxa, listed apart from the living species and never counted as them.
    local: a place page ("Fossil snakes found here"), else a family or genus page ("Fossil species")"""
    S = {}
    fos = [c for c in G if c["fossil"]]; ext = [c for c in G if not c["fossil"]]
    if fos:
        one = len(fos) == 1
        S["fossils"] = ("Fossil snakes found here" if local else "Fossil species", (
            '<p class="cy-note">%s known only from fossils%s. %s not %s and %s not counted in this page&rsquo;s totals. '
            '%s approximate: %s from the rock layers the fossils were found in, and the dating and classification of fossil snakes are revised as new material is studied.</p>'
            '<ul class="rg-cols rg-fos">%s</ul>') % (
                ("This snake is" if one else "These snakes are") if local else ("This species is" if one else "These species are"),
                (" found in %s" % esc(where)) if local else "", "It is" if one else "They are", "a living species" if one else "living species", "is" if one else "are",
                "The geological age given is" if one else "The geological ages given are", "it comes" if one else "they come",
                "".join("<li>%s <small>(%s)</small></li>" % (sp_a(c, rel_species), esc(age_text(c))) for c in fos)))
    if ext:
        one = len(ext) == 1
        S["extinct"] = ("Extinct in recent times", (
            '<p class="cy-note">%s extinct or possibly extinct, last recorded %s in historical times, so %s not counted as living.</p><ul class="rg-cols">%s</ul>') % (
                "This snake is" if one else "These snakes are", ("in " + esc(where)) if local else "in the wild", "it is" if one else "they are",
                "".join("<li>%s <small>(%s)</small></li>" % (sp_a(c, rel_species), esc(age_text(c))) for c in ext)))
    return S


def habitat_section(L, info, places, rel_species="../"):
    """what the reviewed, sourced species accounts say about each species' habitat - the species'
    habitat in general, not a measurement of this place. Regional notes about somewhere else are left out."""
    rows = []
    for c in L:
        d = info.get(c["id"])
        if not d: continue
        for e in (d.get("sections") or {}).get("habitat") or []:
            lab = e.get("label", "")
            if lab and not any(p and p.lower() in lab.lower() for p in places): continue
            srcs = [d.get("sources", {}).get(s) for s in e.get("src", [])]
            src = ", ".join('<a href="%s" rel="noopener">%s</a>' % (esc(s["url"]), esc(s.get("publisher") or s.get("title", ""))) for s in srcs if s and s.get("url"))
            rows.append('<li>%s: %s%s</li>' % (sp_a(c, rel_species), esc(B.plain(e["text"])), (' <small>Source: %s.</small>' % src) if src else ""))
            break
    if not rows: return None
    left = len(L) - len(rows)
    return ("Habitats from reviewed species accounts", (
        '<p class="cy-note">What SnakeList&rsquo;s reviewed, sourced accounts say about where each species lives <b>in general</b>, across its range. '
        'They do not describe %s in particular.%s</p><ul class="rg-hab">%s</ul>') % (
            esc(places[0]), (" The other %s here %s no reviewed account yet, so nothing is said about %s." % (
                B.nplural(left, "species", "species"), "has" if left == 1 else "have", "its habitat" if left == 1 else "their habitats")) if left else "", "".join(rows)))


def venom_section(L, ctx, rel_species="../"):
    n = len(L); nv = sum(1 for c in L if c["venom"])
    hm = [c for c in L if ctx["harm"](c) == "harmful"]
    vb = ('<div class="rg-split" role="img" aria-label="%d venomous, %d non-venomous"><i class="v" style="width:%.1f%%"></i><i class="nv" style="width:%.1f%%"></i></div>'
          '<p class="rg-key"><span><i class="v"></i>Venomous: <b>%s</b> of %s</span><span><i class="nv"></i>Non-venomous: <b>%s</b></span></p>') % (
        nv, n - nv, nv * 100 / max(1, n), (n - nv) * 100 / max(1, n), nf(nv), nf(n), nf(n - nv))
    if hm:
        vb += ('<p><b>%s</b> %s listed by SnakeList as dangerous to people: %s.</p>' % (nf(len(hm)), is_are(len(hm)),
               ", ".join(sp_a(c, rel_species) for c in hm[:30]) + (" and %d more" % (len(hm) - 30) if len(hm) > 30 else "")))
    if nv > len(hm):
        k = nv - len(hm)
        vb += ('<p class="cy-note">The other venomous species has mild venom: no serious bites to people are documented for it.</p>' if k == 1 else
               '<p class="cy-note">The other %s venomous species have mild venom: no serious bites to people are documented for them.</p>' % nf(k))
    return ("Venomous and non-venomous", vb)


def families_section(L):
    fams = {}
    for c in L: fams[c["family"] or ""] = fams.get(c["family"] or "", 0) + 1
    fl = sorted(fams.items(), key=lambda t: (-t[1], t[0] or "~"))
    if not fl: return None
    mx = fl[0][1]
    return ("Snake families", '<p class="cy-note">Living species recorded here, by family.</p><ul class="rg-bars">%s</ul>' % "".join(
        '<li><span class="rg-bl">%s</span><span class="rg-bar"><i style="width:%.1f%%"></i></span><b>%d</b></li>' % (
            ('<a href="../family/%s">%s</a>%s' % (B.slugify(f), esc(f), (' <small>%s</small>' % esc(B.FAMILY_INFO[f]["common"])) if B.FAMILY_INFO.get(f, {}).get("common") else "")) if f else "Family not recorded",
            max(2, k * 100 / mx), k) for f, k in fl))


def only_here(r, L):
    return [c for c in L if c["countries"] == [r["country"]] and {RAW.get((r["cc"], x)) for x in regions_of(c, r["cc"])} == {r["key"]}]


def recorded_section(r, L, ctx, rel_species="../"):
    """the global ranking (iNaturalist research-grade records across each species' whole range) - SnakeList has no local counts"""
    top = sorted([c for c in L if c["spots"]], key=lambda c: (-c["spots"], skey(c)))
    if not top: return None, []
    return ("Most recorded worldwide", '<p class="cy-note"><b>A global ranking, not a local one.</b> These are the species here with research-grade iNaturalist records in the most places '
            '<b>across their whole range</b> (worldwide records). SnakeList has no counts of records within %s, so this says nothing about which snakes are commonest here.</p>'
            '<ul class="cy-grid rg-top">%s</ul>' % (esc(r["the"]), "".join(photo_card(c, "Recorded worldwide in %s" % B.nplural(c["spots"], "place")) for c in top[:8]))), top


def who_section(top, ctx, rel_species="../"):
    if not top: return None
    items = []
    for c in top[:8]:
        a = authority(ctx["info"], c)
        by = ('<span class="rg-by" data-done="1">described by %s in %d<span class="sp-ago" data-y="%d"></span>%s</span>' % (
            esc(a[1]), a[2], a[2], " (under another genus name)" if a[3] else "")) if a else '<span class="rg-by"></span>'
        items.append('<li data-sci="%s">%s - %s</li>' % (esc(c["sci"]), sp_a(c, rel_species), by))
    return ("Who described them", '<p class="cy-note">The scientists who first described the species above, and when.</p>'
            '<ul class="rg-who" data-wd="1">%s</ul><p class="cy-note rg-wdnote">Names and dates come from SnakeList&rsquo;s reviewed species accounts; '
            'the others come from <a href="https://www.wikidata.org/" rel="noopener">Wikidata</a> (CC0) and are only shown if they pass basic checks.</p>' % "".join(items))


def possible_section(r, P, scope):
    """species recorded in the country with no state/district record: possible, never counted as recorded here"""
    if not P: return None
    t = kword(r["cc"]); k = len(P)
    return ("Possible here: %s-level records only" % land_word(r["country"]), (
        '<p class="cy-note">SnakeList records %s in %s without saying in which %s, so %s may or may not live in %s. '
        '%s not counted among the species recorded here.</p>%s') % (
            "this species" if k == 1 else "these %s species" % nf(k), esc(B.the_place(r["country"])), esc(t), "it" if k == 1 else "each", esc(scope),
            "It is" if k == 1 else "They are", all_list(P, "possible", r["title"])))


def regions_of(c, cc):
    if cc == "us": return c["states"]
    return [p.partition(":")[2] for p in c["provinces"] if p.partition(":")[0].lower() == cc]


def all_list(L, title_id, where, rel_species="../", intro_ids=()):
    """every species, as a compact list with a search box and Show more (all in the HTML);
    populations brought by people are marked "introduced" (they live here, but are not native)"""
    items = "".join('<li>%s%s%s</li>' % (sp_a(c, rel_species),
                    ' <span class="rg-v" title="Venomous">venomous</span>' if c["venom"] else "",
                    ' <span class="rg-i" title="Not native here: brought by people">introduced</span>' if c["id"] in intro_ids else "") for c in L)
    tools = ('<label class="rg-pq"><span class="cy-sr">Search the snakes of %s</span><input type="search" placeholder="Search %s..." autocomplete="off"></label>' % (esc(where), nf(len(L)) + " species")) if len(L) > 12 else ""
    return ('<div class="rg-pl" data-page="60">%s<ul class="rg-cols rg-pul">%s</ul><p class="cy-note rg-pempty" hidden>No snake here matches that.</p>'
            '<p class="cy-more-wrap"><button type="button" class="cy-more rg-pmore" hidden>Show more</button></p></div>') % (tools, items)


def place_list(items, what, page=24):
    """a searchable list of places (a country page's states or cities)"""
    tools = ('<label class="rg-pq"><span class="cy-sr">Search %s</span><input type="search" placeholder="Search %s..." autocomplete="off"></label>' % (esc(what), esc(what))) if len(items) > page else ""
    return ('<div class="rg-pl" data-page="%d">%s<ul class="rg-cols rg-pul">%s</ul><p class="cy-note rg-pempty" hidden>No place matches that.</p>'
            '<p class="cy-more-wrap"><button type="button" class="cy-more rg-pmore" hidden>Show more</button></p></div>') % (page, tools, "".join(items))


def country_sections(name, n_living=None):
    """the country page's distribution context, its states/districts/provinces and its cities"""
    keys = [k for k, r in REG.items() if r["country"] == name]
    if not keys: return ""
    cc = REG[keys[0]]["cc"]
    keys.sort(key=lambda k: B.slugify(REG[k]["name"]))
    many, one = kword(cc, True), kword(cc)
    out = ""
    co = COUNTRY_ONLY.get(cc, set())
    if n_living:
        withreg = n_living - len(co)
        out += ('<section class="cy-sec" id="distribution" aria-labelledby="cy-ds-h"><h2 id="cy-ds-h">How precisely they are recorded</h2>'
                '<p>Of the %s living species recorded in %s, <b>%s</b> %s recorded by %s in SnakeList&rsquo;s data%s. '
                'SnakeList records each species by %s, not by exact spot, so a species listed for a %s may live in only part of it.</p></section>') % (
            nf(n_living), esc(B.the_place(name)), nf(withreg), is_are(withreg), esc(one),
            ("; <b>%s</b> %s recorded only for %s as a whole, so the %s pages list %s as possible rather than recorded" % (
                nf(len(co)), is_are(len(co)), esc(B.the_place(name)), esc(one), "it" if len(co) == 1 else "them")) if co else "",
            esc(one), esc(one.split(" or ")[0]))
    out += ('<section class="cy-sec" id="regions" aria-labelledby="cy-rg-h"><h2 id="cy-rg-h">%s</h2><p class="cy-note">The %s where SnakeList records snakes, with how many living species are recorded in each. '
            'Each page has its species, venomous snakes, families, the species found only there, its cities and neighbours.</p>%s</section>') % (
        esc(many[:1].upper() + many[1:]), esc(many), place_list(['<li data-t="%s"><a href="../region/%s">%s</a> <small>%s</small></li>' % (
            esc(REG[k]["name"].lower()), k, esc(REG[k]["name"]), B.nplural(len(REG[k]["living"]), "species", "species")) for k in keys], many))
    cs = [ct for k in keys for ct in REG[k]["cities"] if ct["page"]]
    cs.sort(key=lambda ct: ct["rank"])
    if cs:
        out += ('<section class="cy-sec" id="cities" aria-labelledby="cy-ct-h"><h2 id="cy-ct-h">Cities</h2><p class="cy-note">Its biggest cities, biggest first. SnakeList records snakes by %s, '
                'not by city, so each city page shows the species recorded in its %s and, separately, those only possible there - not species confirmed in the city.</p>%s</section>') % (
            esc(one), esc(one), place_list(['<li data-t="%s"><a href="../city/%s">%s</a> <small>%s</small></li>' % (
                esc((ct["name"] + " " + REG[ct["region"]]["name"]).lower()), ct["page"], esc(ct["name"]), esc(REG[ct["region"]]["title"])) for ct in cs], "cities", 18))
    return out


def stats_html(rows, label):
    return '<ul class="cy-stats" aria-label="%s">%s</ul>' % (esc(label), "".join('<li><b>%s</b><span>%s</span></li>' % (v, k) for v, k in rows))


def sections_html(S, order):
    return "".join('<section class="cy-sec rg-sec" id="%s" aria-labelledby="h-%s"><h2 id="h-%s">%s</h2>%s</section>' % (k, k, k, S[k][0], S[k][1]) for k in order if k in S)


TOC = {"all": "Species", "district": "In the area", "incity": "In the city", "possible": "Possible", "recorded": "Most recorded worldwide", "families": "Families",
       "venom": "Venomous", "only": "Only here", "introduced": "Introduced", "fossils": "Fossils", "extinct": "Extinct", "habitats": "Habitats",
       "who": "Who described them", "cities": "Cities", "nearby": "Nearby cities", "neighbours": "Neighbours"}


def toc(S, order, names=None):
    nm = dict(TOC, **(names or {}))
    return '<nav class="rg-toc" aria-label="On this page">%s</nav>' % "".join('<a href="#%s">%s</a>' % (k, nm[k]) for k in order if k in S)


def a_type(r):
    """"a district of Portugal", "a territory of the United States" """
    return "%s %s of %s" % (B.an(r["type"]), r["type"], B.the_place(r["country"]))


def region_page(r, L, G, P, ctx):
    n = len(L); nv = sum(1 for c in L if c["venom"]); cslug = B.slugify(r["country"])
    T = r["the"]; t = r["type"]
    nfam = len({c["family"] for c in L if c["family"]})
    S = {}
    it = ctx["intro"].get(r["key"], [])
    S["all"] = (("The %s recorded in %s" % (B.nplural(n, "living species", "living species"), esc(T)) if n > 1 else "The living species recorded in %s" % esc(T)) if n else "Species recorded in %s" % esc(T),
                ('<p class="cy-note">Every living snake species SnakeList records in %s. Each is recorded somewhere in the %s, not necessarily all over it.</p>%s' % (esc(T), esc(t), all_list(L, "all", T, intro_ids={c["id"] for c, nt in it})))
                if n else '<p>No living snake species %s recorded in %s in SnakeList&rsquo;s data.</p>' % ("is", esc(T)))
    ps = possible_section(r, P, T)
    if ps: S["possible"] = ps
    if it:
        S["introduced"] = ("Introduced by people", '<p class="cy-note">Not native here: SnakeList records %s as brought to %s by people. %s in the list above too, marked &ldquo;introduced&rdquo;, because %s here now.</p><ul class="rg-cols">%s</ul>' % (
            "this species" if len(it) == 1 else "these species", esc(T), "It is" if len(it) == 1 else "They are", "it lives" if len(it) == 1 else "they live",
            "".join("<li>%s%s</li>" % (sp_a(c), (" <small>(%s)</small>" % esc(nt)) if nt else "") for c, nt in it)))
    if n:
        S["venom"] = venom_section(L, ctx)
        fs = families_section(L)
        if fs: S["families"] = fs
    only = only_here(r, L)
    if only:
        S["only"] = ("Found only here", '<p class="cy-note">Recorded in no other %s, country or territory in SnakeList&rsquo;s data. That may mean %s only here, '
                     'but it can also mean %s not been recorded elsewhere yet.</p><ul class="rg-cols">%s</ul>' % (
                         esc(t), "it lives" if len(only) == 1 else "they live", "it has" if len(only) == 1 else "they have", "".join("<li>%s</li>" % sp_a(c) for c in only)))
    hs = habitat_section(L, ctx["info"], [T, r["name"], r["country"]])
    if hs: S["habitats"] = hs
    S.update(gone_sections(G, T))
    cs = sorted(r["cities"], key=lambda ct: ct["rank"])
    if cs:
        S["cities"] = ("Biggest cities", '<p class="cy-note">The biggest cities in %s from SnakeList&rsquo;s city list, biggest first%s. SnakeList has no records for the cities themselves.</p><ul class="rg-cols">%s</ul>' % (
            esc(T), " (placed here by their map position)" if any(ct["how"] == "coords" for ct in cs) else "",
            "".join("<li>%s</li>" % (('<a href="../city/%s">%s</a>' % (ct["page"], esc(ct["name"]))) if ct["page"] else esc(ct["name"])) for ct in cs[:15])))
    def reg_li(o):
        R = REG[o]
        return '<li><a href="%s">%s</a>%s <small>%s</small></li>' % (o, esc(R["title"]), (" <small>(%s, %s)</small>" % (esc(R["type"]), esc(R["country"]))) if R["country"] != r["country"] else "",
                                                                     B.nplural(len(R["living"]), "species", "species"))
    nb = r["nb"] or r["near"]
    if nb:
        same = all(REG[o]["cc"] == r["cc"] for o in nb)
        types = {REG[o]["type"] for o in nb}
        word = (types.pop() + "s") if same and len(types) == 1 else "places"
        word = re.sub(r"ys$", "ies", word)
        if r["nb"]:
            S["neighbours"] = ("Neighbouring %s" % word, '<p class="cy-note">Places in SnakeList that share a border with %s, with their living species.</p><ul class="rg-cols">%s</ul>' % (
                esc(T), "".join(reg_li(o) for o in nb)))
        else:
            S["neighbours"] = ("Nearby %s" % word, '<p class="cy-note">The closest other parts of %s in SnakeList.</p><ul class="rg-cols">%s</ul>' % (
                esc(B.the_place(r["country"])), "".join(reg_li(o) for o in nb)))
    rs, top = recorded_section(r, L, ctx)  # (v4.63: the iNaturalist records ranking is no longer shown; its species still head "Who described them")
    ws = who_section(top, ctx)
    if ws: S["who"] = ws
    order = ["all", "possible", "introduced", "venom", "families", "only", "habitats", "fossils", "extinct", "cities", "neighbours", "recorded", "who"]
    merged = len(r["raw"]) > 1 and r["cc"] != "us"
    about = ('<section class="cy-about cy-about-note" aria-label="What this page counts"><p>%s is %s. SnakeList records where snakes live by %s, not by exact spot, '
             'so a species counted here may live in only part of it. The counts are unique living species; fossils, extinct species and introduced snakes are listed apart. %s<a href="../country/%s">All snakes of %s</a>.</p></section>') % (
        esc(T[:1].upper() + T[1:]), esc(a_type(r)), esc(kword(r["cc"])), ("SnakeList&rsquo;s map has %d areas called %s; they are counted together here. " % (len(r["raw"]), esc(r["name"]))) if merged else "",
        cslug, esc(B.the_place(r["country"])))
    lead = "%s %s recorded in %s, %s, in SnakeList's data" % (B.nplural(n, "living snake species", "living snake species"), is_are(n), T, a_type(r))
    split = ("it is venomous" if nv else "it is non-venomous") if n == 1 else "all venomous" if nv == n else "none venomous" if nv == 0 else "%s venomous and %s non-venomous" % (nf(nv), nf(n - nv))
    lead += (". It is %s." % ("venomous" if nv else "non-venomous") if n == 1 else ": %s, from %s." % (split, B.nplural(nfam, "family", "families"))) if n else "."
    if P: lead += " %s more %s possible: recorded in %s without %s detail." % (nf(len(P)), is_are(len(P)), B.the_place(r["country"]), kword(r["cc"]))
    rows = [(nf(n), "living species"), (nf(nv), "venomous"), (nf(n - nv), "non-venomous"), (nf(nfam), "families" if nfam != 1 else "family")]
    rows = [x for x in rows if not (x[0] == "0" and x[1] in ("venomous", "non-venomous", "families"))]
    if only: rows.append((nf(len(only)), "found only here"))
    if P: rows.append((nf(len(P)), "more possible"))
    if it: rows.append((nf(len(it)), "introduced"))
    if G: rows.append((nf(len(G)), "fossil" if all(c["fossil"] for c in G) else "fossil or extinct"))
    title = "Snakes of %s, %s: %s with photos | SnakeList" % (T, r["country"], B.nplural(n, "living species", "living species"))
    url = B.SITE + "species/region/" + r["key"]
    crumbs = [("Countries", "../#by-country"), (r["country"], "../country/" + cslug)]
    ld = ld_json("Snakes of %s" % T, url, lead, L, [("Countries", B.SITE + "species/#by-country"), (r["country"], B.SITE + "species/country/" + cslug)])
    return PAGE.format(title=esc(title), desc=esc(lead), url=url, img=og_img(L), ld=ld, crumbs=crumbs_html(crumbs), h1="Snakes of " + esc(T),
                       sub=esc(a_type(r)[:1].upper() + a_type(r)[1:]), lead=esc(lead),
                       stats=stats_html(rows, "At a glance: unique living species recorded in %s" % T),
                       cta=('<a class="cy-btn" href="../../?map=%s">View on SnakeList map</a>' % esc(quote(r["name"]))), about=about, toc=toc(S, order),
                       body=sections_html(S, order), robots="index,follow,max-image-preview:large" if n >= MIN_INDEX else "noindex,follow",
                       site_head=B.site_header("../../", "species"), site_foot=B.site_footer("../../", "Every photo belongs to its photographer and is used under the Creative Commons licence they chose, credited with it."), author=B.AUTHOR)


def city_page(city, r, L, P, ctx):
    """a city: honest about what is known locally (no city-level records), then the species recorded
    in its district/state, then those only possible from country-level records - never one list"""
    n = len(L); T = r["the"]; t = r["type"]; cn = city["name"]; cslug = B.slugify(r["country"])
    rlink = '<a href="../region/%s">%s</a>' % (r["key"], esc(T))
    # a city that is a region of its own (Addis Ababa, Busan, Beijing): never "a city in Addis Ababa Chartered City"
    own = fold(cn) == fold(strip_n(r["name"])) and re.search(r"city|municipality|federal district|special administrative", t)
    is_a = ("a %s of %s &ndash; a city that is also a region of its own" % (esc(t), esc(city["country"]))) if own else None
    S = {}
    inat = "https://www.inaturalist.org/observations?lat=%.4f&lng=%.4f&radius=10&taxon_id=85553" % (city["lat"], city["lon"])
    S["incity"] = ("Observed in %s itself" % esc(cn), (
        '<p><b>No city-level data.</b> SnakeList has no observation records for a defined %s city area, so this page lists no species as confirmed in the city. '
        'Community observations of snakes within 10 km of the city centre can be browsed on <a href="%s" rel="noopener">iNaturalist</a> '
        '(not checked or counted by SnakeList).</p>') % (esc(cn), esc(inat)))
    S["district"] = (("Recorded in %s: %s" % (esc(T), B.nplural(n, "species", "species"))) if n else "Recorded in %s" % esc(T), (
        '<p class="cy-note"><b>These species are recorded in %s; their presence within %s city has not been confirmed by this dataset.</b> '
        'SnakeList records snakes by %s, not by city, and many of them may not live in or near %s.%s</p>%s') % (
            rlink, esc(cn), esc(kword(r["cc"])), esc(cn), " (The city is placed in %s by its map position.)" % esc(T) if city["how"] == "coords" else "",
            all_list(L, "district", T, intro_ids={c["id"] for c, nt in ctx["intro"].get(r["key"], [])})) if n else '<p>No living snake species are recorded in %s in SnakeList&rsquo;s data.</p>' % rlink)
    ps = possible_section(r, P, T)
    if ps: S["possible"] = ps
    it = ctx["intro"].get(r["key"], [])
    if it:
        S["introduced"] = ("Introduced in %s" % esc(T), '<p class="cy-note">Not native: SnakeList records %s as brought to %s by people. %s in the list above too, marked &ldquo;introduced&rdquo;.</p><ul class="rg-cols">%s</ul>' % (
            "this species" if len(it) == 1 else "these species", rlink, "It is" if len(it) == 1 else "They are",
            "".join("<li>%s%s</li>" % (sp_a(c), (" <small>(%s)</small>" % esc(nt)) if nt else "") for c, nt in it)))
    near = sorted((km((city["lat"], city["lon"]), (o["lat"], o["lon"])), o) for o in CITIES if o is not city)[:8]
    S["nearby"] = ("Nearby cities", '<p class="cy-note">The closest cities in SnakeList&rsquo;s city list, as the crow flies.</p><ul class="rg-cols">%s</ul>' % "".join(
        "<li>%s <small>%s km &middot; %s, %s</small></li>" % (('<a href="%s">%s</a>' % (o["page"], esc(o["name"]))) if o["page"] else esc(o["name"]), nf(round(d)),
                                                           esc(REG[o["region"]]["title"]), esc(o["country"])) for d, o in near))
    same = [o for o in sorted(r["cities"], key=lambda o: o["rank"]) if o is not city]
    if same:
        S["cities"] = ("Other cities in %s" % esc(T), '<ul class="rg-cols">%s</ul>' % "".join(
            "<li>%s</li>" % (('<a href="%s">%s</a>' % (o["page"], esc(o["name"]))) if o["page"] else esc(o["name"])) for o in same[:15]))
    order = ["incity", "district", "possible", "introduced", "nearby", "cities"]
    about = ('<section class="cy-about rg-warn" aria-label="What this page can and cannot say"><p><b>What is known here:</b> %s is %s. '
             'SnakeList has no snake records for the city itself. Below are, separately, the species recorded in %s and those only possible from records for %s as a whole. '
             'For the %s&rsquo;s families, venomous snakes and habitats, see %s.</p></section>') % (
        esc(cn), is_a or ("a city in %s (%s)" % (rlink, esc(a_type(r)))), esc(T), esc(B.the_place(r["country"])), esc(t), rlink)
    lead = "%s is %s. SnakeList has no snake records for the city itself: %s %s recorded in %s" % (
        cn, H.unescape(is_a) if is_a else "a city in %s, %s" % (T, city["country"]), B.nplural(n, "living species", "living species"), is_are(n), T)
    lead += (", and %s more %s possible from records for %s as a whole." % (nf(len(P)), is_are(len(P)), B.the_place(r["country"]))) if P else "."
    title = "Snakes around %s, %s: %s recorded in %s | SnakeList" % (cn, city["country"], B.nplural(n, "species", "species"), T)
    url = B.SITE + "species/city/" + city["page"]
    crumbs = [("Countries", "../#by-country"), (r["country"], "../country/" + cslug), (T, "../region/" + r["key"])]
    ld = ld_json("Snakes around %s" % cn, url, lead, L, [("Countries", B.SITE + "species/#by-country"), (r["country"], B.SITE + "species/country/" + cslug),
                                                        (T, B.SITE + "species/region/" + r["key"])])
    sub = ("A %s of %s" % (esc(t), esc(city["country"])) if own else "A city in %s, %s" % (esc(T), esc(city["country"]))) + " &middot; %.2f&deg;%s, %.2f&deg;%s" % (abs(city["lat"]), "N" if city["lat"] >= 0 else "S", abs(city["lon"]), "E" if city["lon"] >= 0 else "W")
    rows = [("No data", "confirmed in the city"), (nf(n), "recorded in the %s" % t)]
    if P: rows.append((nf(len(P)), "possible (%s-level)" % land_word(r["country"])))
    return PAGE.format(title=esc(title), desc=esc(lead), url=url, img=og_img(L), ld=ld, crumbs=crumbs_html(crumbs),
                       h1="Snakes around " + esc(cn), sub=sub, lead=esc(lead), stats=stats_html(rows, "What is known: unique living species, by evidence level"),
                       cta='<a class="cy-btn" href="../region/%s">All about %s</a>' % (r["key"], esc(T)), about=about,
                       toc=toc(S, order, {"district": "In the %s" % t}), body=sections_html(S, order),
                       robots="index,follow,max-image-preview:large" if n >= MIN_INDEX else "noindex,follow",
                       site_head=B.site_header("../../", "species"), site_foot=B.site_footer("../../", "Every photo belongs to its photographer and is used under the Creative Commons licence they chose, credited with it."), author=B.AUTHOR)


def og_img(L):
    first = next((c for c in sorted(L, key=lambda c: -c["spots"]) if c["photo"] and len(c["photo"]) >= 5 and "Illustration" not in c["photo"][2]), None)
    return B.SITE + "species-photos/t/%d-%d.webp" % (first["photo"][0], first["photo"][1]) if first else B.SITE + "snakelist-logo.png"


def crumbs_html(crumbs): return "".join('<li><a href="%s">%s</a></li>' % (h, esc(t)) for t, h in crumbs)


def ld_json(name, url, desc, L, crumbs):
    return json.dumps([{"@context": "https://schema.org", "@type": "CollectionPage", "name": name, "url": url, "description": desc,
                        "mainEntity": {"@type": "ItemList", "numberOfItems": len(L), "itemListElement": [
                            {"@type": "ListItem", "position": i + 1, "url": B.SITE + "species/" + B.page_name(c), "name": label(c)} for i, c in enumerate(L[:20])]}},
                       {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "SnakeList", "item": B.SITE}] +
                        [{"@type": "ListItem", "position": i + 2, "name": t, "item": u} for i, (t, u) in enumerate(crumbs)] +
                        [{"@type": "ListItem", "position": len(crumbs) + 2, "name": name, "item": url}]}], ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def length_m(info):
    """a species account's sourced adult length, as (low, high) metres for the size picture - only
    from its first clause with a number, and never from a figure the account itself calls rare or
    a popular claim. Returns None when there is nothing safe to draw."""
    f = (info or {}).get("facts", {}).get("length")
    if not f: return None
    clause = next((p for p in f["text"].split(";") if re.search(r"\d", p)), "")
    if not clause or re.search(r"popular|rare", clause, re.I): return None
    toks = re.findall(r"(\d+(?:\.\d+)?)\s*(cm|m)?\b", clause)
    vals, pend = [], []
    for v, u in toks:
        pend.append(float(v))
        if u:
            vals += [x / 100 if u == "cm" else x for x in pend]; pend = []
    if not vals: return None
    lo, hi = min(vals), max(vals)
    return (lo, hi) if 0.05 < lo <= hi < 15 else None


PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}"><meta name="author" content="{author}"><meta name="robots" content="{robots}">
<meta property="og:type" content="website"><meta property="og:site_name" content="SnakeList"><meta property="og:title" content="{title}"><meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{img}"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1F5A3A">
<link rel="icon" href="../../favicon.ico" sizes="any"><link rel="stylesheet" href="../sp.css"><link rel="stylesheet" href="../country.css">
<script>document.documentElement.className+=" js"</script>
<script type="application/ld+json">{ld}</script>
</head><body class="cy-page">
{site_head}
<main class="cy-main" id="main">
<nav class="cy-crumbs" aria-label="Breadcrumb"><ol><li><a href="../../">SnakeList</a></li><li><a href="../">Species</a></li>{crumbs}<li aria-current="page">{h1}</li></ol></nav>
<header class="cy-head">
<div class="cy-htext"><h1>{h1}</h1><p class="rg-sub">{sub}</p><p class="cy-lead">{lead}</p></div>
{stats}
<p class="cy-cta">{cta}</p>
</header>{about}
{toc}
{body}
</main>
{site_foot}
<script src="../country.js" defer></script><script src="../wd.js" defer></script>
</body></html>
"""

REGION_CSS = """.rg-sub{margin:4px 0 0;color:var(--muted);font-size:15px}
.rg-toc{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin:16px 0 0;padding:6px 0;position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line)}
.rg-toc::-webkit-scrollbar{display:none}.rg-toc a{flex:none;padding:5px 12px;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;color:var(--muted)}
.rg-toc a:hover,.rg-toc a:focus-visible{background:var(--tag);color:var(--link)}
.rg-sec{scroll-margin-top:56px}.rg-sec>p{margin:0 0 10px}
.rg-top{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
.rg-bars{list-style:none;margin:0;padding:0;display:grid;gap:6px}.rg-bars li{display:grid;grid-template-columns:minmax(0,15em) minmax(40px,1fr) 3em;gap:10px;align-items:center;font-size:14.5px}
.rg-bl{overflow-wrap:anywhere}.rg-bl small{color:var(--muted)}.rg-bars b{text-align:right}
.rg-bar{height:12px;border-radius:6px;background:var(--bg);overflow:hidden}.rg-bar i{display:block;height:100%;background:var(--g);border-radius:6px}
.rg-split{display:flex;height:18px;border-radius:9px;overflow:hidden;background:var(--bg);margin:4px 0 8px}.rg-split i{display:block;height:100%}
.rg-split i.v,.rg-key i.v{background:#c4562f}.rg-split i.nv,.rg-key i.nv{background:var(--g)}
.rg-key{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:14px}.rg-key span{display:inline-flex;align-items:center;gap:6px}.rg-key i{width:12px;height:12px;border-radius:3px;display:inline-block}
.rg-cols{columns:3 210px;column-gap:24px;padding-left:18px;margin:0;font-size:14.5px}.rg-cols li{break-inside:avoid;margin:0 0 4px}.rg-cols small{color:var(--muted)}.rg-cols i{color:var(--muted);font-size:13px}
.rg-v{font-size:11px;font-weight:700;color:#b5452a}.rg-i{font-size:11px;font-weight:700;color:#8a6d1f}
.rg-pq{display:block;margin:0 0 10px;max-width:420px}.rg-pq input{width:100%;font:inherit;font-size:15px;min-height:40px;padding:6px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text)}
.rg-who{padding-left:18px;margin:0 0 8px;font-size:14.5px}.rg-who li{margin:0 0 6px}.rg-who i{color:var(--muted)}.rg-by{color:var(--text)}.rg-by.rg-miss{color:var(--muted)}
.rg-warn{border-color:#e0b25c;background:#fdf4e2}.rg-warn p{margin:0}
.rg-hab{padding-left:18px;margin:0;font-size:14.5px}.rg-hab li{margin:0 0 8px}.rg-hab small{color:var(--muted)}
.cy-cmp-wrap{overflow-x:auto}.cy-cmp{border-collapse:collapse;font-size:14px;min-width:100%}.cy-cmp th,.cy-cmp td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.cy-cmp th{font-size:13px;color:var(--muted);font-weight:600}.cy-cmp td small{color:var(--muted)}
.sp-ago{color:var(--muted)}
@media (prefers-color-scheme:dark){.rg-v{color:#ffd39c}.rg-i{color:#e6c46a}.rg-warn{background:#4a4220;border-color:#a8833d}.rg-split i.v,.rg-key i.v{background:#e07a4f}}
@media (max-width:560px){.rg-bars li{grid-template-columns:minmax(0,1fr) 30% 2.4em}.rg-cols{columns:1}}
"""

# runtime: who described a species, from Wikidata, fetched in the visitor's browser. The taxon's
# own item is found by its P225 (taxon name) statement - species rank preferred - and the author
# comes from that statement's structured qualifiers: P405 (taxon author) and P574 (year of
# publication), never from a name search. Every answer is checked before it is shown:
#  - with a known authority ("(Hermann, 1804)", from the account or data/authorities.json) the
#    year must be the same and every person's surname must be one of the authority's names;
#  - without one, the year must be there, the people must have been alive (give or take ten years)
#    when it was published, and all the taxon's statements must agree.
# Anything else shows "Author details not available"; where the data came from goes in Sources.
WD_JS = r"""(function(){
var EP='https://query.wikidata.org/sparql?format=json&query=';
function get(u,ms){return new Promise(function(res,rej){var c=window.AbortController?new AbortController():null,t=setTimeout(function(){if(c)c.abort();rej(new Error('timeout'))},ms||10000);
fetch(u,c?{signal:c.signal}:{}).then(function(r){if(!r.ok)throw new Error('http '+r.status);return r.json()}).then(function(j){clearTimeout(t);res(j)},function(e){clearTimeout(t);rej(e)})})}
function yr(s){var m=/^(-?)(\d{1,4})-/.exec(String(s||''));return m?(m[1]?-1:1)*+m[2]:null}
function lit(s){return '"'+String(s).replace(/[\\"]/g,'')+'"'}
function norm(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()}
// "(Duméril, Bibron & Duméril, 1854)" -> {names:['dumeril','bibron','dumeril'], year:1854}
function parseAuth(a){a=String(a||'').replace(/[()]/g,'').trim();var m=/^(.*?),?\s*(\d{4})$/.exec(a);if(!m)return null;
var names=m[1].replace(/\bet al\.?/g,'').split(/,|&|\band\b|\bin\b|\bex\b/).map(function(x){x=x.trim().replace(/^([A-Z]\.\s*)+/,'');return norm(x).split(/\s+/).pop()}).filter(Boolean);
return names.length?{names:names,year:+m[2]}:null}
function surname(label){return norm(label).replace(/[^a-z\s'-]/g,' ').trim().split(/\s+/).pop()||''}
// names -> {name: [candidate statements {item, rank, year, people:[{id,label,desc,born,died,nat,img}]}]}
function lookup(names){if(!names.length)return Promise.resolve({});if(navigator.onLine===false)return Promise.reject(new Error('offline'));
var q='SELECT ?name ?item ?st ?rank ?author ?authorLabel ?authorDescription ?year ?born ?died ?natLabel ?img WHERE { VALUES ?name { '+names.map(lit).join(' ')+' } '+
'?item p:P225 ?st . ?st ps:P225 ?name . OPTIONAL { ?item wdt:P105 ?rank } OPTIONAL { ?st pq:P574 ?year } OPTIONAL { ?st pq:P405 ?author . OPTIONAL { ?author wdt:P569 ?born } OPTIONAL { ?author wdt:P570 ?died } '+
'OPTIONAL { ?author wdt:P27 ?nat } OPTIONAL { ?author wdt:P18 ?img } } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 400';
return get(EP+encodeURIComponent(q)).then(parse)}
function parse(j){var out={},by={};((j&&j.results&&j.results.bindings)||[]).forEach(function(b){function v(k){return b[k]&&b[k].value}
var n=v('name');if(!n)return;var item=(v('item')||'').split('/').pop(),sk=n+'|'+(v('st')||item),o=by[sk];
if(!o){o=by[sk]={item:item,rank:(v('rank')||'').split('/').pop(),year:null,people:[]};(out[n]=out[n]||[]).push(o)}
var y=yr(v('year'));if(y&&!o.year)o.year=y;var a=v('author');if(!a)return;var id=a.split('/').pop(),p=o.people.filter(function(x){return x.id===id})[0];
if(!p){p={id:id,label:v('authorLabel')||'',desc:v('authorDescription')||'',born:yr(v('born')),died:yr(v('died')),nat:[],img:''};if(/^Q\d+$/.test(p.label))p.label='';o.people.push(p)}
var nt=v('natLabel');if(nt&&!/^Q\d+$/.test(nt)&&p.nat.indexOf(nt)<0)p.nat.push(nt);var im=v('img');if(im&&!p.img)p.img=im});
for(var k in out)out[k].forEach(function(o){o.people=o.people.filter(function(p){return p.label})});return out}
// the one checked answer {item, year, people}, or null
function resolve(cands,auth){cands=(cands||[]).slice();var A=parseAuth(auth);
if(cands.some(function(c){return c.rank==='Q7432'}))cands=cands.filter(function(c){return !c.rank||c.rank==='Q7432'});
var ok=cands.filter(function(c){if(!c.people.length)return false;
if(A){if(c.year&&c.year!==A.year)return false;return c.people.every(function(p){return A.names.indexOf(surname(p.label))>=0})}
if(!c.year)return false;return c.people.every(function(p){return (!p.born||p.born<c.year-10)&&(!p.died||c.year<=p.died+10)})});
if(!ok.length)return null;
if(!A){var key=function(c){return c.year+':'+c.people.map(function(p){return p.id}).sort().join(',')};if(ok.some(function(c){return key(c)!==key(ok[0])}))return null}
return {item:ok[0].item,year:A?A.year:ok[0].year,people:ok[0].people}}
function ago(y){var n=new Date().getFullYear()-y;return n>0?n+(n===1?' year':' years')+' ago':''}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function link(h,t){var a=el('a','',t);a.href=h;a.rel='noopener';return a}
function img(u,w){return String(u).replace(/^http:/,'https:').replace(/\?.*$/,'')+'?width='+w}
[].forEach.call(document.querySelectorAll('.sp-ago[data-y]'),function(s){var a=ago(+s.dataset.y);if(a)s.textContent=' ('+a+')'});
window.SLWD={lookup:lookup,parse:parse,resolve:resolve,parseAuth:parseAuth,ago:ago};
var NA='Author details not available.';
// the species page
var box=document.getElementById('sp-who');
if(box){var sci=box.dataset.sci,auth=box.dataset.auth||'',st=box.querySelector('.sp-who-s'),pp=box.querySelector('.sp-who-p'),prov=document.getElementById('sp-wdprov');
function pv(nodes){if(!prov)return;prov.textContent='';nodes.forEach(function(n){prov.appendChild(typeof n==='string'?document.createTextNode(n):n)})}
lookup([sci]).then(function(R){var r=resolve(R[sci],auth);
if(!r){if(!auth){st.textContent=NA;st.className='sp-who-s sp-muted'}
pv(['Who described it: ',auth?'the authority '+auth+' (checked by SnakeList). Wikidata had no matching person, so no biography is shown.':'Wikidata gave no answer that passed the checks (matching year and authors), so none is shown.']);return}
var y=r.year,ppl=r.people;
if(!auth){st.textContent='';st.className='sp-who-s';st.appendChild(document.createTextNode('First described by '));
ppl.forEach(function(p,i){if(i)st.appendChild(document.createTextNode(i===ppl.length-1?' and ':', '));st.appendChild(el('b','',p.label))});
st.appendChild(document.createTextNode(' in '));st.appendChild(el('b','',String(y)));var g=ago(y);if(g)st.appendChild(el('span','sp-ago',' ('+g+')'));st.appendChild(document.createTextNode('.'))}
ppl.forEach(function(p){var c=el('div','sp-person');if(p.img){var i=new Image();i.src=img(p.img,120);i.alt='Portrait of '+p.label;i.width=64;i.height=80;i.loading='lazy';i.onerror=function(){i.remove()};c.appendChild(i)}
var t=el('div','sp-person-t');var h=el('p','sp-person-n');h.appendChild(link('https://www.wikidata.org/wiki/'+p.id,p.label));t.appendChild(h);
if(p.desc)t.appendChild(el('p','sp-person-d',p.desc.charAt(0).toUpperCase()+p.desc.slice(1)));
var b=[];if(p.born)b.push('Born '+p.born);if(p.died)b.push('died '+p.died+(p.born?' (aged about '+(p.died-p.born)+')':''));if(p.nat.length)b.push(p.nat.join(', '));
if(b.length)t.appendChild(el('p','sp-person-m',b.join(' · ')));
if(y&&p.born&&y>p.born&&(!p.died||y<=p.died+60))t.appendChild(el('p','sp-person-m',p.died&&y>p.died?'The name was published in '+y+', after the author\'s death.':'About '+(y-p.born)+' years old when describing it.'));
c.appendChild(t);pp.appendChild(c)});
pv(['Who described it: ',auth?'the authority '+auth+'; the '+(ppl.length>1?'people':'person')+' from ':'author and year from ',link('https://www.wikidata.org/wiki/'+r.item,'Wikidata item '+r.item),
' (taxon author and year of the taxon name, CC0)'+(auth?', shown because the surname and year match the authority':', shown because the year and lifetimes agree')+(ppl.some(function(p){return p.img})?'; portraits from Wikimedia Commons.':'.')])}).catch(function(){
if(!auth){st.textContent=NA;st.className='sp-who-s sp-muted'}})}
// region and city pages: the most recorded snakes' describers (when no checked authority is on file)
[].forEach.call(document.querySelectorAll('.rg-who[data-wd]'),function(ul){var lis=[].filter.call(ul.children,function(li){var s=li.querySelector('.rg-by');return s&&!s.dataset.done});
if(!lis.length)return;
function none(s){s.textContent='author details not available';s.className='rg-by rg-miss'}
lookup(lis.map(function(li){return li.dataset.sci})).then(function(R){lis.forEach(function(li){var s=li.querySelector('.rg-by'),r=resolve(R[li.dataset.sci],li.dataset.auth||'');s.textContent='';
if(!r){none(s);return}
s.appendChild(document.createTextNode('described by '));r.people.forEach(function(p,i){if(i)s.appendChild(document.createTextNode(i===r.people.length-1?' and ':', '));
s.appendChild(link('https://www.wikidata.org/wiki/'+p.id,p.label))});s.appendChild(document.createTextNode(' in '+r.year));var g=ago(r.year);if(g)s.appendChild(el('span','sp-ago',' ('+g+')'))})})
.catch(function(){lis.forEach(function(li){none(li.querySelector('.rg-by'))})})});
})();
"""

# (REGION_CSS goes into country.css, which the country, region and city pages all load)
# the searchable, Show-more lists of region/city pages and of the country pages' states and cities
PLIST_JS = r"""
(function(){[].forEach.call(document.querySelectorAll('.rg-pl'),function(w){var ul=w.querySelector('.rg-pul'),q=w.querySelector('.rg-pq input'),more=w.querySelector('.rg-pmore'),none=w.querySelector('.rg-pempty'),P=+w.dataset.page||60,shown=P;
var li=[].slice.call(ul.children);li.forEach(function(e){e._t=(e.dataset.t||e.textContent).toLowerCase()});
function run(){var t=q?q.value.trim().toLowerCase():'',k=0;li.forEach(function(e){var m=!t||e._t.indexOf(t)>=0;e.hidden=!m||k>=shown;if(m)k++});
none.hidden=k>0;more.hidden=k<=shown;if(!more.hidden)more.textContent='Show more ('+(k-shown)+' left)'}
if(q)q.addEventListener('input',function(){shown=P;run()});more.addEventListener('click',function(){var f=shown;shown+=P;run();var e=li.filter(function(x){return !x.hidden})[f];var a=e&&e.querySelector('a');if(a)a.focus({preventScroll:true})});run()})})();
"""

# species pages: "Explore in 3D" - a procedural, species-specific 3D model (species/3d/viewer.js and
# the vendored three.js there, both loaded only when the viewer is opened), with the species' real
# photos as a separate tab: the page's own photo and a size drawing (v4.63: no iNaturalist gallery).
# Every species has a model profile (data/snake-models.json + the generated ones).
REAL_JS = r"""
(function(){var b=document.querySelector('.sp-realbtn'),m=document.querySelector('.sp-main[data-sci]');if(!b||!m)return;
var sci=m.dataset.sci,sid=m.dataset.id,name=(document.querySelector('h1')||{}).textContent||sci,dlg=null,me=document.currentScript&&document.currentScript.src||location.href;
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function lic(c){c=String(c||'').toLowerCase();return c==='cc0'?'CC0':c.replace(/^cc-/,'CC ').toUpperCase()}
function size(){var lo=+m.dataset.lenlo,hi=+m.dataset.lenhi;if(!hi)return null;var W=340,P=1.5,s=Math.min((W-40)/(hi+0.55),74),NS='http://www.w3.org/2000/svg',ph=P*s,H=Math.max(ph+46,128),g=H-26;
var svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('role','img');
svg.setAttribute('aria-label',name+': about '+rng(lo,hi)+' long, next to a person 1.5 m tall');
function a(t,o,p){var e=document.createElementNS(NS,t);for(var k in o)e.setAttribute(k,o[k]);(p||svg).appendChild(e);return e}
var px=14+0.2*s,hr=Math.max(3,0.11*s),x0=px+0.2*s+18,th=Math.max(5,Math.min(12,0.06*s)),y=g-th/2-1;
a('line',{x1:6,y1:g,x2:W-6,y2:g,'class':'gr'});
a('circle',{cx:px,cy:g-ph+hr,r:hr,'class':'pp'});a('path',{d:'M'+(px-0.2*s)+' '+g+'L'+(px-0.13*s)+' '+(g-ph*0.52)+'L'+(px-0.2*s)+' '+(g-ph*0.82)+'Q'+px+' '+(g-ph*0.9)+' '+(px+0.2*s)+' '+(g-ph*0.82)+'L'+(px+0.13*s)+' '+(g-ph*0.52)+'L'+(px+0.2*s)+' '+g+'Z','class':'pp'});
var t=a('text',{x:px,y:g+16,'text-anchor':'middle'});t.textContent='1.5 m';
var st=[0.1,0.25,0.5,1,2].filter(function(v){return v*s>=34})[0]||2;
for(var v=0;v<=hi+1e-9;v+=st){a('line',{x1:x0+v*s,y1:g,x2:x0+v*s,y2:g+4,'class':'gr'});var tk=a('text',{x:x0+v*s,y:g+16,'text-anchor':'middle','class':'tk'});tk.textContent=v?fmt(v):'0'}
function body(L,c){var hl=Math.min(th*1.7,L/3),tl=Math.min(L*0.35,th*6),h=th/2;if(L<th*2)return a('rect',{x:x0,y:y-h,width:Math.max(L,1),height:th,rx:h,'class':c});
return a('path',{d:'M'+x0+' '+y+'L'+(x0+tl)+' '+(y-h)+'L'+(x0+L-hl)+' '+(y-h)+'C'+(x0+L-hl*0.4)+' '+(y-h*1.5)+' '+(x0+L)+' '+(y-h)+' '+(x0+L)+' '+y+'C'+(x0+L)+' '+(y+h)+' '+(x0+L-hl*0.4)+' '+(y+h*1.5)+' '+(x0+L-hl)+' '+(y+h)+'L'+(x0+tl)+' '+(y+h)+'Z','class':c})}
if(hi>lo)body(hi*s,'sn2');body(lo*s,'sn');if(lo*s>=th*2)a('circle',{cx:x0+lo*s-Math.min(th*1.7,lo*s/3)*0.45,cy:y-th*0.18,r:Math.max(1,th*0.13),'class':'eye'});
var t2=a('text',{x:Math.min(Math.max(x0+hi*s/2,x0+30),W-50),y:y-th/2-7,'text-anchor':'middle','class':'ln'});t2.textContent=rng(lo,hi);
return svg}
function fmt(v){return v<1?Math.round(v*100)+' cm':(Math.round(v*100)/100)+' m'}
function rng(lo,hi){if(lo===hi)return fmt(hi);if(lo>=1)return (Math.round(lo*100)/100)+'–'+fmt(hi);if(hi<1)return Math.round(lo*100)+'–'+fmt(hi);return fmt(lo)+'–'+fmt(hi)}
// the model profiles and the viewer code are fetched only when the viewer is opened
var models=null,modP=null,viewer=null,tabs,p3d,pph,host,about,note,stat,grid,got=0,busy=0;
function getModels(){if(models)return Promise.resolve(models);return fetch(new URL('3d/models.json',me).href).then(function(r){if(!r.ok)throw new Error('models '+r.status);return r.json()}).then(function(d){models=d;return d})}
var tries=0;function getViewer(){if(!modP){var imp,q=tries++?'?r='+tries:'';try{imp=new Function('u','return import(u)')}catch(e){return Promise.reject(e)}
modP=Promise.all([imp(new URL('3d/three.module.min.js'+q,me).href),imp(new URL('3d/viewer.js'+q,me).href)]).then(function(r){r[1].useThree(r[0]);return r[1]}).catch(function(e){modP=null;throw e})}return modP}
function gl(){try{var c=document.createElement('canvas');return !!(window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl')))}catch(e){return false}}
function open(){if(!dlg)build();if(dlg.showModal){if(!dlg.open)dlg.showModal()}else dlg.setAttribute('open','');start()}
function close(){if(dlg.close)dlg.close();else{dlg.removeAttribute('open');closed()}}
function closed(){if(viewer){viewer.dispose();viewer=null}busy=0;b.focus();if(location.hash==='#real')history.replaceState(null,'',location.pathname+location.search)}
function pick(which){var is3=which==='3d';tabs[0].setAttribute('aria-selected',is3);tabs[1].setAttribute('aria-selected',!is3);tabs[0].tabIndex=is3?0:-1;tabs[1].tabIndex=is3?-1:0;p3d.hidden=!is3;pph.hidden=is3;if(!is3)load()}
function msg(t,retry,photos){host.innerHTML='';var d=el('div','sp3d-msg');d.setAttribute('role','alert');d.appendChild(el('p','',t));if(retry){var r=el('button','sp-btn sp-btn2','Retry');r.type='button';r.addEventListener('click',start);d.appendChild(r)}
if(photos){var q=el('button','sp-btn sp-btn2','See photos instead');q.type='button';q.addEventListener('click',function(){pick('ph');tabs[1].focus()});d.appendChild(q)}host.appendChild(d)}
function start(){if(viewer||busy)return;busy=1;host.innerHTML='';var ld=el('div','sp3d-msg sp3d-loading');ld.setAttribute('role','status');ld.appendChild(el('span','sp3d-spin'));ld.appendChild(el('p','','Loading the 3D model...'));host.appendChild(ld);
getModels().then(function(d){var p=d&&d.species&&d.species[sid];
if(!p){busy=0;nomodel();return}
fillAbout(p);
if(!gl()){busy=0;msg('This browser or device cannot show 3D graphics (WebGL is turned off or not supported), so the 3D model cannot be shown. The photos are still available.',false,true);return}
return getViewer().then(function(mod){if(!dlg.open&&!dlg.hasAttribute('open')){busy=0;return}host.innerHTML='';
try{viewer=mod.mount(host,{profile:p,id:sid,name:name,testing:!!window.SL_3D_TEST})}catch(e){viewer=null;busy=0;msg(e&&e.message==='webgl'?'The 3D view could not start on this device (WebGL is not available). The photos are still available.':'The 3D view could not start.',true,true);return}busy=0})})
.catch(function(){busy=0;msg(navigator.onLine===false?'You seem to be offline, and the 3D viewer has not been downloaded yet.':'The 3D viewer could not be loaded just now.',true,true)})}
function nomodel(){tabs[0].parentNode.hidden=true;p3d.hidden=true;pph.hidden=false;note.hidden=false;load()}
function fillAbout(p){if(about.dataset.done)return;about.dataset.done=1;var s=el('summary','','About this model and its sources');about.appendChild(s);
if(p.auto){var x=p.auto.x||'';about.appendChild(el('p','',x.indexOf('f')>=0?'A reconstruction of how this fossil snake may have looked: the body shape of its family and the size estimated from its fossil bones. Colours and markings are a guess, because fossils keep no colour.':'A model generated by SnakeList: the body shape, head and scales of its family, '+(x.indexOf('l')>=0?'a typical size for its group, ':'its recorded size, ')+(x.indexOf('g')>=0?'and colours that are a guess for its group (SnakeList has no photo of it yet).':'and colours and markings taken from its SnakeList photo and its name.')+' It is not a scan of a real snake, and individual snakes vary.'));return}
about.appendChild(el('p','','A reconstruction built by SnakeList from the sources below: body proportions, head shape, scale rows and keels, colours and markings of a typical adult. It is not a scan of a real snake, and individual snakes vary.'));
if(p.scene&&p.scene.basis)about.appendChild(el('p','','Surroundings: '+p.scene.basis));var ul=el('ul');(p.refs||[]).forEach(function(r){var li=el('li'),a=el('a','',r.t);a.href=r.acct?'#sources':r.u;if(!r.acct){a.rel='noopener';a.target='_blank'}else a.addEventListener('click',close);li.appendChild(a);ul.appendChild(li)});about.appendChild(ul)}
function build(){dlg=el('dialog','sp-rl');dlg.setAttribute('aria-labelledby','sp-rl-h');var inn=el('div','sp-rl-in'),hd=el('div','sp-rl-hd'),h=el('h2','','Explore in 3D: ');h.appendChild(el('span','sp-rl-nm',name));h.id='sp-rl-h';
var x=el('button','sp-rl-x','×');x.type='button';x.setAttribute('aria-label','Close');x.addEventListener('click',close);hd.appendChild(h);hd.appendChild(x);inn.appendChild(hd);
var tl=el('div','sp-rl-tabs');tl.setAttribute('role','tablist');tl.setAttribute('aria-label','View');tabs=[el('button','sp-rl-tab','3D model'),el('button','sp-rl-tab','Photos')];
tabs.forEach(function(t,i){t.type='button';t.setAttribute('role','tab');t.id='sp-rl-t'+i;t.setAttribute('aria-controls','sp-rl-p'+i);t.addEventListener('click',function(){pick(i?'ph':'3d')});
t.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();var j=1-i;pick(j?'ph':'3d');tabs[j].focus()}});tl.appendChild(t)});inn.appendChild(tl);
p3d=el('section','sp-rl-p');p3d.id='sp-rl-p0';p3d.setAttribute('role','tabpanel');p3d.setAttribute('aria-labelledby','sp-rl-t0');host=el('div','sp3d-host');p3d.appendChild(host);about=el('details','sp3d-about');p3d.appendChild(about);inn.appendChild(p3d);
pph=el('section','sp-rl-p');pph.id='sp-rl-p1';pph.setAttribute('role','tabpanel');pph.setAttribute('aria-labelledby','sp-rl-t1');pph.hidden=true;
note=el('p','sp3d-none','No accurate 3D model of this snake exists yet. SnakeList only shows a 3D model when it can be built from reliable descriptions and photos of the species, so here are photos of it instead.');note.hidden=true;pph.appendChild(note);
var pf=document.querySelector('.sp-photo img'),pc=document.querySelector('.sp-photo figcaption');if(pf){var f0=el('figure','sp-rl-own'),im=new Image();im.src=pf.getAttribute('data-fb')||pf.src;im.alt=pf.alt;im.width=540;im.height=360;f0.appendChild(im);if(pc)f0.appendChild(pc.cloneNode(true));pph.appendChild(f0)}
var sz=size();if(sz){var f=el('figure','sp-rl-size');f.appendChild(el('h3','','How big is it?'));f.appendChild(sz);var cap=el('figcaption');cap.appendChild(document.createTextNode('Adult length: '+(m.dataset.lentxt||'')+' '));
var src=m.dataset.lensrc;if(src){var p=src.split('|');var aa=el('a','',p[0]);if(p[1]){aa.href=p[1];aa.rel='noopener'}cap.appendChild(document.createTextNode('(source: '));cap.appendChild(p[1]?aa:document.createTextNode(p[0]));cap.appendChild(document.createTextNode(')'))}
cap.appendChild(el('span','sp-note',' Drawn stretched out, to scale with a person 1.5 m tall. Real snakes vary.'));f.appendChild(cap);pph.appendChild(f)}
inn.appendChild(pph);pick('3d');
dlg.appendChild(inn);document.body.appendChild(dlg);dlg.addEventListener('click',function(e){if(e.target===dlg)close()});dlg.addEventListener('close',closed)}
function load(){}
b.addEventListener('click',open);if(location.hash==='#real')open();window.addEventListener('hashchange',function(){if(location.hash==='#real')open()})})();
"""

REAL_CSS = """
.sp-realbtn{font:inherit;cursor:pointer}.sp-ago{color:var(--muted)}
.sp-rl{width:min(1040px,calc(100vw - 24px));max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--line);border-radius:18px;background:var(--card);color:var(--text)}
.sp-rl::backdrop{background:rgba(5,15,9,.72)}.sp-rl-in{padding:12px 18px 18px}
.sp-rl-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 0 8px}
.sp-rl-hd h2{margin:0;font:700 21px/1.2 Georgia,serif}.sp-rl-x{flex:none;width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:24px;line-height:1;cursor:pointer}
.sp-rl-tabs{display:flex;gap:4px;margin:0 0 10px;border-bottom:1px solid var(--line)}.sp-rl-tabs[hidden]{display:none}
.sp-rl-tab{font:600 14.5px Inter,system-ui,sans-serif;padding:8px 14px;border:0;border-bottom:3px solid transparent;background:none;color:var(--muted);cursor:pointer;margin-bottom:-1px}
.sp-rl-tab[aria-selected=true]{color:var(--text);border-bottom-color:var(--g)}
.sp-rl-st{margin:10px 0 10px;color:var(--muted);font-size:14.5px}
.sp-rl-own{margin:0 0 4px}.sp-rl-own img{display:block;width:100%;max-width:540px;height:auto;aspect-ratio:3/2;object-fit:cover;border-radius:12px;background:var(--line)}.sp-rl-own figcaption{font-size:12.5px;color:var(--muted);margin-top:4px}.sp-rl-own figcaption a{color:inherit}
.sp-rl-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr));gap:10px}@media (max-width:560px){.sp-rl-grid{grid-template-columns:1fr 1fr;gap:8px}}
.sp-rl-grid figure{margin:0}.sp-rl-grid img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:12px;display:block;background:var(--line)}
.sp-rl-grid figcaption{font-size:12px;color:var(--muted);margin-top:4px;overflow-wrap:anywhere}.sp-rl-grid figcaption a{color:inherit}
.sp-rl-size{margin:16px 0 0;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--bg)}.sp-rl-size h3{margin:0 0 6px;font:700 17px Georgia,serif}
.sp-rl-size svg{display:block;width:100%;max-width:520px;height:auto}.sp-rl-size .gr{stroke:var(--tagline);stroke-width:2}.sp-rl-size .pp{fill:var(--muted)}
.sp-rl-size .sn{fill:var(--g)}.sp-rl-size .sn2{fill:var(--g);opacity:.4}.sp-rl-size text{fill:var(--text);font:600 12px Inter,system-ui,sans-serif}.sp-rl-size .eye{fill:#1a1208}.sp-rl-size text.tk{fill:var(--muted);font-weight:500;font-size:10.5px}
.sp-rl-size figcaption{font-size:13.5px}.sp-rl-size .sp-note{display:block;margin:4px 0 0}.sp-rl-n{margin:12px 0 0}
.sp3d-none{margin:0 0 12px;padding:10px 14px;border:1px solid var(--tagline);border-radius:12px;background:var(--tag);font-size:15px}
.sp-rl .sp-rl-p{background:none;border:0;border-radius:0;padding:0;margin:0}.sp3d-host{position:relative}
.sp3d-msg{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;min-height:min(56vh,480px);padding:20px;border:1px solid var(--line);border-radius:14px;background:var(--bg)}.sp3d-msg p{margin:0;max-width:440px}
.sp3d-spin{width:34px;height:34px;border-radius:50%;border:4px solid var(--line);border-top-color:var(--g);animation:sp3dspin 1s linear infinite}@keyframes sp3dspin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.sp3d-spin{animation-duration:3s}}
.sp3d-wrap{position:relative;background:var(--card)}
.sp3d-stage{position:relative;height:min(64vh,600px);min-height:280px;border-radius:14px;overflow:hidden;background:#c9d1c3;touch-action:none}
.sp3d-canvas{display:block;width:100%;height:100%;outline:none;cursor:grab;touch-action:none}.sp3d-canvas:active{cursor:grabbing}
.sp3d-canvas:focus-visible{box-shadow:inset 0 0 0 3px var(--g)}
.sp3d-hint{position:absolute;left:8px;top:8px;margin:0;max-width:calc(100% - 16px);padding:4px 10px;border-radius:999px;background:rgba(12,26,18,.72);color:#fff;font:500 12.5px/1.4 Inter,system-ui,sans-serif;pointer-events:none;transition:opacity .6s}
.sp3d-hint-off{opacity:0}
.sp3d-status{position:absolute;inset:auto 12px 12px 12px;padding:10px 14px;border-radius:12px;background:rgba(12,26,18,.85);color:#fff;font-size:14px;text-align:center}
.sp3d-labels{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.sp3d-mk{position:absolute;left:0;top:0;display:flex;align-items:center;gap:5px;margin:-6px 0 0 -6px;white-space:nowrap}.sp3d-mk[hidden]{display:none}
.sp3d-dot{flex:none;width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid var(--g);box-shadow:0 1px 3px rgba(0,0,0,.5)}
.sp3d-mt{padding:2px 8px;border-radius:8px;background:rgba(12,26,18,.82);color:#fff;font:500 12px/1.4 Inter,system-ui,sans-serif;max-width:200px;white-space:normal}
.sp3d-sl{margin:0}.sp3d-sl .sp3d-mt{transform:translate(-50%,-100%)}.sp3d-back{opacity:.45}.sp3d-moved .sp3d-dot{opacity:.35}
@media (max-width:560px){.sp3d-mt{font-size:11px;max-width:150px;padding:1px 6px}}
.sp3d-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 0 0}
.sp3d-views{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}.sp3d-views .sp3d-b{border:0;border-radius:0}.sp3d-views .sp3d-b+.sp3d-b{border-left:1px solid var(--line)}
.sp3d-b{font:600 13.5px Inter,system-ui,sans-serif;min-height:38px;padding:6px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text);cursor:pointer}
.sp3d-b:hover{border-color:var(--tagline)}.sp3d-b[aria-pressed=true],.sp3d-b[aria-expanded=true]{background:var(--g);border-color:var(--g);color:#fff}.sp3d-set{margin-left:auto}
.sp3d-panel{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;margin:8px 0 0;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--bg);font-size:14px}.sp3d-panel[hidden]{display:none}
.sp3d-panel select{font:inherit;margin-left:6px;padding:4px 8px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--text)}
.sp3d-cap{font-size:13.5px;color:var(--muted);margin:8px 0 0}.sp3d-cap p{margin:2px 0}.sp3d-recon{font-weight:600;color:var(--text)}
.sp3d-about{margin:10px 0 0;font-size:14px}.sp3d-about summary{cursor:pointer;font-weight:600}.sp3d-about ul{margin:6px 0 0;padding-left:20px}.sp3d-about p{margin:6px 0}
.sp3d-wrap:fullscreen{padding:10px;background:var(--card);display:flex;flex-direction:column}.sp3d-wrap:fullscreen .sp3d-stage{flex:1;height:auto}
.sp3d-max{position:fixed;inset:0;z-index:2147483000;padding:10px;background:var(--card);display:flex;flex-direction:column}.sp3d-max .sp3d-stage{flex:1;height:auto}
.sp-who{margin:14px 0 0}.sp-who h3{margin:0 0 4px}.sp-person{display:flex;gap:12px;align-items:flex-start;margin:10px 0 0;padding:10px 12px;border:1px solid var(--line);border-radius:14px;background:var(--bg)}
.sp-person img{flex:none;width:64px;height:80px;object-fit:cover;border-radius:10px;background:var(--line)}.sp-person-t{min-width:0}.sp-person p{margin:0 0 2px}
.sp-person-n{font-weight:700}.sp-person-d{font-size:14px}.sp-person-m{font-size:13.5px;color:var(--muted)}.sp-who-src{margin:8px 0 0!important}
@media (max-width:560px){.sp-rl{width:100vw;max-width:100vw;max-height:100dvh;height:100dvh;border-radius:0;margin:0}.sp-rl-in{padding:10px 12px 16px}.sp-rl-hd h2{font-size:18px}
.sp3d-stage{height:min(46vh,380px);min-height:240px}.sp3d-b{padding:6px 10px;font-size:13px}.sp3d-set{margin-left:0}}
"""
