"""State/province pages (species/region/<cc>-<name>.html) and city pages (species/city/<cc>-<name>.html),
built from the same app data as the species pages. Called by build_species.pages().

What the data can and cannot say, and how the pages word it:
- SnakeList records each snake by country and - for most countries - by state, province or island
  (the cards' data-states / data-provinces). Nothing is recorded per city, so a city page shows the
  snakes of the state/province the city is in, and says so.
- "Most widely recorded" uses #rarity-data: in how many places each species has research-grade
  iNaturalist records across its WHOLE range. That is how widely it has been photographed, not how
  many live in the region.
- "Found only here" means: no other country, state or province in SnakeList's data - not a claim
  that it is endemic in the scientific literature.
- Habitats are SnakeList's estimate from where each snake is recorded (see build_species), counted
  over the region's species.
- Who described a snake: the reviewed account's authority where there is one; otherwise the page
  asks Wikidata in the visitor's browser (wd.js) and says where the answer came from.
"""
import json, re, os, math, html as H
from urllib.parse import quote
import build_species as B

REG = {}      # "cc-slug" -> the region (a state, province or island as the cards name it)
RAW = {}      # (cc, the cards' own name) -> "cc-slug"
BY_CC = {}    # cc -> region keys
CITIES = []   # every city of the app's list that could be placed in a region
CITY = {}     # "cc-slug" -> the cities that get their own page
CITY_CAP = 25  # city pages per country: the biggest ones (SL_CITIES is in population order)
MIN_INDEX = 3  # a region (or its cities) with fewer species is still a page, but kept out of search results

KIND_WORD = {"us": ("state", "states"), "id": ("island", "islands"), "au": ("state or territory", "states and territories"),
             "ca": ("province or territory", "provinces and territories")}


def kword(cc, many=False): return KIND_WORD.get(cc, ("state or province", "states and provinces"))[1 if many else 0]
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
    REG.clear(); RAW.clear(); BY_CC.clear(); CITIES.clear(); CITY.clear()
    in_cards = {n for c in cards for n in c["countries"]}
    cc2name = {}
    for n, code in iso.items():
        if n in in_cards: cc2name.setdefault(code, n)
    for c in cards:
        pairs = [(p.partition(":")[0].lower(), p.partition(":")[2]) for p in c["provinces"]] + [("us", s) for s in c["states"]]
        for cc, raw in pairs:
            disp = region.us_names.get(raw, raw) if cc == "us" else strip_n(raw)
            sl = B.slugify(disp)
            if not sl: continue
            key = cc + "-" + sl
            r = REG.get(key)
            if not r:
                r = REG[key] = {"key": key, "cc": cc, "name": disp, "raw": set(), "ids": set(), "country": cc2name.get(cc, cc.upper()), "cities": []}
            r["raw"].add(raw); r["ids"].add(c["id"]); RAW[(cc, raw)] = key
    for k in sorted(REG): BY_CC.setdefault(REG[k]["cc"], []).append(k)
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
            c2, _, pn = ct[4].partition(":"); cc = c2.lower(); key = RAW.get((cc, pn))
        if not key and cc in BY_CC:
            key = locate(cc, lon, lat); how = "coords"
        if not key: continue
        r = REG[key]
        city = {"name": nm, "country": cn, "cc": r["cc"], "lat": lat, "lon": lon, "region": key, "rank": rank, "how": how, "page": None}
        CITIES.append(city); r["cities"].append(city)
        if per_cc.get(r["cc"], 0) < CITY_CAP:
            per_cc[r["cc"]] = per_cc.get(r["cc"], 0) + 1
            sl = r["cc"] + "-" + B.slugify(nm)
            if sl in used: sl = sl + "-" + key.split("-", 1)[1]
            if sl in used: continue
            used.add(sl); city["page"] = sl; CITY[sl] = city


def locate(cc, lon, lat):
    """the region of one country a point falls in (the smallest, for enclaves like Berlin), or one
    whose border is within ~20 km (a city on the coast just outside the simplified outline)"""
    best = None
    for k in BY_CC.get(cc, []):
        r = REG[k]; b = r["box"]
        if not b or not (b[0] <= lon <= b[1] and b[2] <= lat <= b[3]): continue
        if any(pip(lon, lat, ring) for ring in r["rings"]):
            a = (b[1] - b[0]) * (b[3] - b[2])
            if best is None or a < best[0]: best = (a, k)
    if best: return best[1]
    near = None
    for k in BY_CC.get(cc, []):
        r = REG[k]; b = r["box"]
        if not b or not (b[0] - .3 <= lon <= b[1] + .3 and b[2] - .3 <= lat <= b[3] + .3): continue
        d = min(((p[0] - lon) * math.cos(math.radians(lat))) ** 2 + (p[1] - lat) ** 2 for ring in r["rings"] for p in ring)
        if d < .2 ** 2 and (near is None or d < near[0]): near = (d, k)
    return near[1] if near else None


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
    urls = []
    keep = set()
    for k, r in REG.items():
        L = sorted((by_id[i] for i in r["ids"]), key=skey)
        html = region_page(r, L, ctx)
        open("%s/region/%s.html" % (B.OUT, k), "w", encoding="utf-8").write(html); keep.add(k + ".html")
        if len(L) >= MIN_INDEX: urls.append(B.SITE + "species/region/" + k)
    keepc = set()
    for sl, city in CITY.items():
        r = REG[city["region"]]
        L = sorted((by_id[i] for i in r["ids"]), key=skey)
        open("%s/city/%s.html" % (B.OUT, sl), "w", encoding="utf-8").write(city_page(city, r, L, ctx)); keepc.add(sl + ".html")
        if len(L) >= MIN_INDEX: urls.append(B.SITE + "species/city/" + sl)
    # pages from an earlier build that no longer exist (a renamed province): removed, not left stale
    for d, ok in (("region", keep), ("city", keepc)):
        for f in os.listdir(B.OUT + "/" + d):
            if f.endswith(".html") and f not in ok: os.remove("%s/%s/%s" % (B.OUT, d, f))
    return urls


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


def authority(info, c):
    a = (info.get(c["id"]) or {}).get("authority", "")
    m = re.match(r"^\(?(.*?),?\s*(\d{4})\)?$", a.strip())
    return (a, m.group(1).strip(), int(m.group(2)), a.strip().startswith("(")) if m else None


def summary(r, L, ctx, rel_species="../"):
    """the facts both page kinds share, as {section id: (heading, html)} in page order"""
    n = len(L); nv = sum(1 for c in L if c["venom"])
    S = {}
    living = [c for c in L if not (c["fossil"] or c["extinct"])]
    top = sorted([c for c in living if c["spots"]], key=lambda c: (-c["spots"], skey(c)))
    if top:
        S["recorded"] = ("Most widely recorded", '<p class="cy-note">The species here that have research-grade iNaturalist records in the most places '
                         '<b>across their whole range</b> - not just in %s. That shows how often people have photographed them, not how many live here.</p>'
                         '<ul class="cy-grid rg-top">%s</ul>' % (esc(r["name"]), "".join(photo_card(c, "Recorded in %s" % B.nplural(c["spots"], "place")) for c in top[:8])))
    fams = {}
    for c in L: fams[c["family"] or ""] = fams.get(c["family"] or "", 0) + 1
    fl = sorted(fams.items(), key=lambda t: (-t[1], t[0] or "~"))
    if fl:
        mx = fl[0][1]
        S["families"] = ("Snake families", '<ul class="rg-bars">%s</ul>' % "".join(
            '<li><span class="rg-bl">%s</span><span class="rg-bar"><i style="width:%.1f%%"></i></span><b>%d</b></li>' % (
                ('<a href="../family/%s">%s</a>%s' % (B.slugify(f), esc(f), (' <small>%s</small>' % esc(B.FAMILY_INFO[f]["common"])) if B.FAMILY_INFO.get(f, {}).get("common") else "")) if f else "Family not recorded",
                max(2, k * 100 / mx), k) for f, k in fl))
    hm = [c for c in L if ctx["harm"](c) == "harmful"]
    vb = ('<div class="rg-split" role="img" aria-label="%d venomous, %d non-venomous"><i class="v" style="width:%.1f%%"></i><i class="nv" style="width:%.1f%%"></i></div>'
          '<p class="rg-key"><span><i class="v"></i>Venomous: <b>%s</b></span><span><i class="nv"></i>Non-venomous: <b>%s</b></span></p>') % (
        nv, n - nv, nv * 100 / max(1, n), (n - nv) * 100 / max(1, n), nf(nv), nf(n - nv))
    if hm:
        vb += ('<p><b>%s</b> %s listed by SnakeList as dangerous to people: %s.</p>' % (nf(len(hm)), "is" if len(hm) == 1 else "are",
               ", ".join(sp_a(c, rel_species) for c in hm[:30]) + (" and %d more" % (len(hm) - 30) if len(hm) > 30 else "")))
    if nv > len(hm):
        vb += '<p class="cy-note">The other venomous ones have mild venom: no serious bites to people are documented for them.</p>'
    S["venom"] = ("Venomous and non-venomous", vb)
    only = [c for c in L if c["countries"] == [r["country"]] and {RAW.get((r["cc"], x)) for x in regions_of(c, r["cc"])} == {r["key"]}]
    if only:
        S["only"] = ("Found only here", '<p class="cy-note">Recorded in no other %s or country in SnakeList&rsquo;s data. That may mean it lives only here, '
                     'but it can also mean it has not been recorded elsewhere yet.</p><ul class="rg-cols">%s</ul>' % (
                         kword(r["cc"]), "".join("<li>%s</li>" % sp_a(c, rel_species) for c in only)))
    it = ctx["intro"].get(r["key"], [])
    if it:
        S["introduced"] = ("Introduced by people", '<p class="cy-note">Not native here: SnakeList records these as brought to %s by people. They are not counted in the totals.</p><ul class="rg-cols">%s</ul>' % (
            esc(r["name"]), "".join("<li>%s%s</li>" % (sp_a(c, rel_species), (" <small>(%s)</small>" % esc(nt)) if nt else "") for c, nt in it)))
    gone = [c for c in L if c["fossil"] or c["extinct"]]
    if gone:
        S["extinct"] = ("Extinct and fossil snakes", '<ul class="rg-cols">%s</ul>' % "".join(
            "<li>%s <small>(%s)</small></li>" % (sp_a(c, rel_species), esc(("fossil, " + c["died"][0] + ", " + c["died"][1]) if c["fossil"] and c["died"] else "known from fossils" if c["fossil"] else c["extinct"].split(" - ")[0]))
            for c in gone))
    kinds = {}
    for c in living:
        for kd in {B.hab_kind(h) for h in c["habitats"]}: kinds[kd] = kinds.get(kd, 0) + 1
    if kinds:
        mx = max(kinds.values())
        S["habitats"] = ("Habitats (rough estimate)", '<p class="cy-note">How many of its living snakes have each kind of habitat in SnakeList&rsquo;s estimate. '
                         'That estimate comes from every country, state and province where each snake is recorded - <b>not</b> from a survey of %s, and not checked species by species.</p>'
                         '<ul class="rg-bars">%s</ul>' % (esc(r["name"]), "".join(
                             '<li><span class="rg-bl"><a href="../../?hab=%s">%s</a></span><span class="rg-bar"><i style="width:%.1f%%"></i></span><b>%d</b></li>' % (
                                 esc(quote(kd)), esc(kd), max(2, kinds[kd] * 100 / mx), kinds[kd]) for kd in B.HAB_KIND_ORDER if kd in kinds)))
    if top:
        items = []
        for c in top[:8]:
            a = authority(ctx["info"], c)
            by = ('<span class="rg-by" data-done="1">described by %s in %d<span class="sp-ago" data-y="%d"></span>%s</span>' % (
                esc(a[1]), a[2], a[2], " (under another genus name)" if a[3] else "")) if a else '<span class="rg-by"></span>'
            items.append('<li data-sci="%s">%s - %s</li>' % (esc(c["sci"]), sp_a(c, rel_species), by))
        S["who"] = ("Who described them", '<p class="cy-note">The scientists who first described its most widely recorded snakes, and when.</p>'
                    '<ul class="rg-who" data-wd="1">%s</ul><p class="cy-note rg-wdnote">Names and dates come from SnakeList&rsquo;s reviewed species accounts; '
                    'the others are looked up on <a href="https://www.wikidata.org/" rel="noopener">Wikidata</a> (CC0) when this page opens.</p>' % "".join(items))
    return S


def regions_of(c, cc):
    if cc == "us": return c["states"]
    return [p.partition(":")[2] for p in c["provinces"] if p.partition(":")[0].lower() == cc]


def all_list(L, title_id, where, rel_species="../"):
    """every species, as a compact list with a search box and Show more (all in the HTML)"""
    items = "".join('<li>%s%s</li>' % (sp_a(c, rel_species),
                    ' <span class="rg-v" title="Venomous">venomous</span>' if c["venom"] else "") for c in L)
    tools = ('<label class="rg-pq"><span class="cy-sr">Search the snakes of %s</span><input type="search" placeholder="Search %s..." autocomplete="off"></label>' % (esc(where), nf(len(L)) + " species")) if len(L) > 12 else ""
    return ('<div class="rg-pl" data-page="60">%s<ul class="rg-cols rg-pul">%s</ul><p class="cy-note rg-pempty" hidden>No snake here matches that.</p>'
            '<p class="cy-more-wrap"><button type="button" class="cy-more rg-pmore" hidden>Show more</button></p></div>') % (tools, items)


def place_list(items, what, page=24):
    """a searchable list of places (a country page's states or cities)"""
    tools = ('<label class="rg-pq"><span class="cy-sr">Search %s</span><input type="search" placeholder="Search %s..." autocomplete="off"></label>' % (esc(what), esc(what))) if len(items) > page else ""
    return ('<div class="rg-pl" data-page="%d">%s<ul class="rg-cols rg-pul">%s</ul><p class="cy-note rg-pempty" hidden>No place matches that.</p>'
            '<p class="cy-more-wrap"><button type="button" class="cy-more rg-pmore" hidden>Show more</button></p></div>') % (page, tools, "".join(items))


def country_sections(name):
    """the "States and provinces" and "Cities" sections of a country page"""
    keys = [k for k, r in REG.items() if r["country"] == name]
    if not keys: return ""
    cc = REG[keys[0]]["cc"]
    keys.sort(key=lambda k: B.slugify(REG[k]["name"]))
    out = ('<section class="cy-sec" id="regions" aria-labelledby="cy-rg-h"><h2 id="cy-rg-h">%s</h2><p class="cy-note">The %s where SnakeList records snakes, with how many species each has. '
           'Each page has its families, venomous snakes, the species found only there, its cities and neighbours.</p>%s</section>') % (
        esc(kword(cc, True).capitalize()), kword(cc, True), place_list(['<li data-t="%s"><a href="../region/%s">%s</a> <small>%s</small></li>' % (
            esc(REG[k]["name"].lower()), k, esc(REG[k]["name"]), B.nplural(len(REG[k]["ids"]), "species", "species")) for k in keys], kword(cc, True)))
    cs = [ct for k in keys for ct in REG[k]["cities"] if ct["page"]]
    cs.sort(key=lambda ct: ct["rank"])
    if cs:
        out += ('<section class="cy-sec" id="cities" aria-labelledby="cy-ct-h"><h2 id="cy-ct-h">Cities</h2><p class="cy-note">Its biggest cities, biggest first. Snakes are recorded by %s, '
                'not by city, so each city page shows the snakes of the %s it is in.</p>%s</section>') % (
            kword(cc), kword(cc), place_list(['<li data-t="%s"><a href="../city/%s">%s</a> <small>%s</small></li>' % (
                esc((ct["name"] + " " + REG[ct["region"]]["name"]).lower()), ct["page"], esc(ct["name"]), esc(REG[ct["region"]]["name"])) for ct in cs], "cities", 18))
    return out


def stats_html(r, L, ctx):
    n = len(L); nv = sum(1 for c in L if c["venom"])
    fams = len({c["family"] for c in L if c["family"]})
    only = [c for c in L if c["countries"] == [r["country"]] and {RAW.get((r["cc"], x)) for x in regions_of(c, r["cc"])} == {r["key"]}]
    rows = [(nf(n), "species"), (nf(nv), "venomous"), (nf(n - nv), "non-venomous"), (nf(fams), "families" if fams != 1 else "family")]
    if only: rows.append((nf(len(only)), "found only here"))
    it = ctx["intro"].get(r["key"])
    if it: rows.append((nf(len(it)), "introduced"))
    return '<ul class="cy-stats" aria-label="At a glance">%s</ul>' % "".join('<li><b>%s</b><span>%s</span></li>' % (v, k) for v, k in rows if not (v == "0" and k in ("venomous", "non-venomous")))


def sections_html(S, order):
    return "".join('<section class="cy-sec rg-sec" id="%s" aria-labelledby="h-%s"><h2 id="h-%s">%s</h2>%s</section>' % (k, k, k, S[k][0], S[k][1]) for k in order if k in S)


def toc(S, order, extra=()):
    names = {"recorded": "Most recorded", "families": "Families", "venom": "Venomous", "only": "Only here", "introduced": "Introduced", "extinct": "Extinct",
             "habitats": "Habitats", "who": "Who described them", "cities": "Cities", "nearby": "Nearby", "neighbours": "Neighbours", "all": "All species"}
    return '<nav class="rg-toc" aria-label="On this page">%s</nav>' % "".join('<a href="#%s">%s</a>' % (k, names[k]) for k in order if k in S or k in extra)


def region_page(r, L, ctx):
    n = len(L); nv = sum(1 for c in L if c["venom"]); cslug = B.slugify(r["country"])
    word = kword(r["cc"])
    S = summary(r, L, ctx)
    cs = sorted(r["cities"], key=lambda ct: ct["rank"])
    if cs:
        S["cities"] = ("Biggest cities", '<p class="cy-note">The biggest cities in %s from SnakeList&rsquo;s city list, biggest first%s.</p><ul class="rg-cols">%s</ul>' % (
            esc(r["name"]), " (placed here by their map position)" if any(ct["how"] == "coords" for ct in cs) else "",
            "".join("<li>%s</li>" % (('<a href="../city/%s">%s</a>' % (ct["page"], esc(ct["name"]))) if ct["page"] else esc(ct["name"])) for ct in cs[:15])))
    def reg_li(o):
        R = REG[o]
        return '<li><a href="%s">%s</a>%s <small>%s</small></li>' % (o, esc(R["name"]), (" <small>(%s)</small>" % esc(R["country"])) if R["country"] != r["country"] else "",
                                                                     B.nplural(len(R["ids"]), "species", "species"))
    if r["nb"]:
        S["neighbours"] = ("Neighbouring %s" % kword(r["cc"], True), '<p class="cy-note">Places in SnakeList that share a border with %s.</p><ul class="rg-cols">%s</ul>' % (
            esc(r["name"]), "".join(reg_li(o) for o in r["nb"])))
    elif r["near"]:
        S["neighbours"] = ("Nearby %s" % kword(r["cc"], True), '<p class="cy-note">The closest other %s of %s in SnakeList.</p><ul class="rg-cols">%s</ul>' % (
            kword(r["cc"], True), esc(r["country"]), "".join(reg_li(o) for o in r["near"])))
    S["all"] = ("All %s" % B.nplural(n, "species", "species"), all_list(L, "all", r["name"]))
    order = ["recorded", "families", "venom", "only", "introduced", "extinct", "habitats", "who", "cities", "neighbours", "all"]
    merged = len(r["raw"]) > 1 and r["cc"] != "us"
    about = ('<section class="cy-about cy-about-note" aria-label="What this page counts"><p>SnakeList records where snakes live by country and by %s, not by exact spot, '
             'so a species listed here may live in only part of %s. %s<a href="../country/%s">All snakes of %s</a>.</p></section>') % (
        word, esc(r["name"]), ("SnakeList&rsquo;s map has %d areas called %s; they are counted together here. " % (len(r["raw"]), esc(r["name"]))) if merged else "", cslug, esc(B.the_place(r["country"])))
    lead = "%s %s recorded in %s, %s %s of %s, in SnakeList: %s venomous and %s non-venomous, from %s." % (
        B.nplural(n, "snake species", "snake species"), "is" if n == 1 else "are", r["name"], B.an(word), word, B.the_place(r["country"]), nf(nv), nf(n - nv),
        B.nplural(len({c["family"] for c in L if c["family"]}), "family", "families"))
    title = "Snakes of %s, %s: %s with photos | SnakeList" % (r["name"], r["country"], B.nplural(n, "species", "species"))
    url = B.SITE + "species/region/" + r["key"]
    crumbs = [("Countries", "../#by-country"), (r["country"], "../country/" + cslug)]
    ld = ld_json("Snakes of %s" % r["name"], url, lead, L, [("Countries", B.SITE + "species/#by-country"), (r["country"], B.SITE + "species/country/" + cslug)])
    return PAGE.format(title=esc(title), desc=esc(lead), url=url, img=og_img(L), ld=ld, crumbs=crumbs_html(crumbs), h1="Snakes of " + esc(r["name"]),
                       sub=esc("%s %s of %s" % (B.an(word).capitalize(), word, B.the_place(r["country"]))), lead=esc(lead), stats=stats_html(r, L, ctx),
                       cta=('<a class="cy-btn" href="../../?map=%s">View on SnakeList map</a>' % esc(quote(r["name"]))), about=about, toc=toc(S, order),
                       body=sections_html(S, order), robots="index,follow,max-image-preview:large" if n >= MIN_INDEX else "noindex,follow",
                       site_head=B.site_header("../../", "species"), site_foot=B.site_footer("../../", "Photos: iNaturalist observers (CC licences) - credited on each species page."), author=B.AUTHOR)


def city_page(city, r, L, ctx):
    n = len(L); word = kword(r["cc"]); cslug = B.slugify(r["country"])
    S = summary(r, L, ctx)
    near = sorted((km((city["lat"], city["lon"]), (o["lat"], o["lon"])), o) for o in CITIES if o is not city)[:8]
    S["nearby"] = ("Nearby cities", '<p class="cy-note">The closest cities in SnakeList&rsquo;s city list, as the crow flies.</p><ul class="rg-cols">%s</ul>' % "".join(
        "<li>%s <small>%s km &middot; %s, %s</small></li>" % (('<a href="%s">%s</a>' % (o["page"], esc(o["name"]))) if o["page"] else esc(o["name"]), nf(round(d)),
                                                           esc(REG[o["region"]]["name"]), esc(o["country"])) for d, o in near))
    same = [o for o in sorted(r["cities"], key=lambda o: o["rank"]) if o is not city]
    if same:
        S["cities"] = ("Other cities in %s" % esc(r["name"]), '<ul class="rg-cols">%s</ul>' % "".join(
            "<li>%s</li>" % (('<a href="%s">%s</a>' % (o["page"], esc(o["name"]))) if o["page"] else esc(o["name"])) for o in same[:15]))
    S["all"] = ("All %s of %s" % (B.nplural(n, "species", "species"), esc(r["name"])), all_list(L, "all", r["name"]))
    order = ["recorded", "venom", "families", "only", "introduced", "extinct", "habitats", "who", "nearby", "cities", "all"]
    rlink = '<a href="../region/%s">%s</a>' % (r["key"], esc(r["name"]))
    about = ('<section class="cy-about rg-warn" aria-label="How precise this is"><p><b>These are the snakes of %s, not of %s itself.</b> SnakeList records snakes by %s, '
             'not by city, so this page lists the %s recorded anywhere in %s, the %s %s is in%s. Many of them may not live in or near the city.</p></section>') % (
        rlink, esc(city["name"]), word, B.nplural(n, "species", "species"), rlink, word, esc(city["name"]),
        " (worked out from the city&rsquo;s map position)" if city["how"] == "coords" else "")
    lead = "%s is a city in %s, %s. %s %s recorded in %s in SnakeList." % (city["name"], r["name"], city["country"], B.nplural(n, "snake species", "snake species"),
                                                                       "is" if n == 1 else "are", r["name"])
    title = "Snakes around %s, %s: the %s of %s | SnakeList" % (city["name"], city["country"], B.nplural(n, "species", "species"), r["name"])
    url = B.SITE + "species/city/" + city["page"]
    crumbs = [("Countries", "../#by-country"), (r["country"], "../country/" + cslug), (r["name"], "../region/" + r["key"])]
    ld = ld_json("Snakes around %s" % city["name"], url, lead, L, [("Countries", B.SITE + "species/#by-country"), (r["country"], B.SITE + "species/country/" + cslug),
                                                                  (r["name"], B.SITE + "species/region/" + r["key"])])
    sub = "%s, %s &middot; %.2f&deg;%s, %.2f&deg;%s" % (esc(r["name"]), esc(city["country"]), abs(city["lat"]), "N" if city["lat"] >= 0 else "S", abs(city["lon"]), "E" if city["lon"] >= 0 else "W")
    return PAGE.format(title=esc(title), desc=esc(lead + " SnakeList records snakes by %s, not by city." % word), url=url, img=og_img(L), ld=ld, crumbs=crumbs_html(crumbs),
                       h1="Snakes around " + esc(city["name"]), sub=sub, lead=esc(lead), stats=stats_html(r, L, ctx),
                       cta='<a class="cy-btn" href="../region/%s">All about %s</a>' % (r["key"], esc(r["name"])), about=about, toc=toc(S, order), body=sections_html(S, order),
                       robots="index,follow,max-image-preview:large" if n >= MIN_INDEX else "noindex,follow",
                       site_head=B.site_header("../../", "species"), site_foot=B.site_footer("../../", "Photos: iNaturalist observers (CC licences) - credited on each species page."), author=B.AUTHOR)


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
.rg-toc a:hover,.rg-toc a:focus-visible{background:var(--tag);color:var(--g)}
.rg-sec{scroll-margin-top:56px}.rg-sec>p{margin:0 0 10px}
.rg-top{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
.rg-bars{list-style:none;margin:0;padding:0;display:grid;gap:6px}.rg-bars li{display:grid;grid-template-columns:minmax(0,15em) minmax(40px,1fr) 3em;gap:10px;align-items:center;font-size:14.5px}
.rg-bl{overflow-wrap:anywhere}.rg-bl small{color:var(--muted)}.rg-bars b{text-align:right}
.rg-bar{height:12px;border-radius:6px;background:var(--bg);overflow:hidden}.rg-bar i{display:block;height:100%;background:var(--g);border-radius:6px}
.rg-split{display:flex;height:18px;border-radius:9px;overflow:hidden;background:var(--bg);margin:4px 0 8px}.rg-split i{display:block;height:100%}
.rg-split i.v,.rg-key i.v{background:#c4562f}.rg-split i.nv,.rg-key i.nv{background:var(--g)}
.rg-key{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:14px}.rg-key span{display:inline-flex;align-items:center;gap:6px}.rg-key i{width:12px;height:12px;border-radius:3px;display:inline-block}
.rg-cols{columns:3 210px;column-gap:24px;padding-left:18px;margin:0;font-size:14.5px}.rg-cols li{break-inside:avoid;margin:0 0 4px}.rg-cols small{color:var(--muted)}.rg-cols i{color:var(--muted);font-size:13px}
.rg-v{font-size:11px;font-weight:700;color:#b5452a}
.rg-pq{display:block;margin:0 0 10px;max-width:420px}.rg-pq input{width:100%;font:inherit;font-size:15px;min-height:40px;padding:6px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text)}
.rg-who{padding-left:18px;margin:0 0 8px;font-size:14.5px}.rg-who li{margin:0 0 6px}.rg-who i{color:var(--muted)}.rg-by{color:var(--text)}.rg-by.rg-miss{color:var(--muted)}
.rg-warn{border-color:#e0b25c;background:#fdf4e2}.rg-warn p{margin:0}
.sp-ago{color:var(--muted)}
@media (prefers-color-scheme:dark){.rg-v{color:#f0a04b}.rg-warn{background:#4a4220;border-color:#a8833d}.rg-split i.v,.rg-key i.v{background:#e07a4f}}
@media (max-width:560px){.rg-bars li{grid-template-columns:minmax(0,1fr) 30% 2.4em}.rg-cols{columns:1}}
"""

# runtime: who described a species, from Wikidata (P225 taxon name -> its P405 taxon author and
# P574 year qualifiers -> the author's label, description, birth/death, citizenship and picture),
# fetched in the visitor's browser. Fills the species page's #sp-who block and the region pages'
# "Who described them" lists; anything missing, slow or blocked just leaves them as they were.
WD_JS = r"""(function(){
var EP='https://query.wikidata.org/sparql?format=json&query=';
function get(u,ms){return new Promise(function(res,rej){var c=window.AbortController?new AbortController():null,t=setTimeout(function(){if(c)c.abort();rej(new Error('timeout'))},ms||10000);
fetch(u,c?{signal:c.signal}:{}).then(function(r){if(!r.ok)throw new Error('http '+r.status);return r.json()}).then(function(j){clearTimeout(t);res(j)},function(e){clearTimeout(t);rej(e)})})}
function yr(s){var m=/^(-?)(\d{1,4})-/.exec(String(s||''));return m?(m[1]?-1:1)*+m[2]:null}
function lit(s){return '"'+String(s).replace(/[\\"]/g,'')+'"'}
// names -> {name: {item, year, people:[{id,label,desc,born,died,nat:[...],img}]}}
function lookup(names){if(!names.length)return Promise.resolve({});if(navigator.onLine===false)return Promise.reject(new Error('offline'));
var q='SELECT ?name ?item ?author ?authorLabel ?authorDescription ?year ?born ?died ?natLabel ?img WHERE { VALUES ?name { '+names.map(lit).join(' ')+' } '+
'?item p:P225 ?st . ?st ps:P225 ?name . OPTIONAL { ?st pq:P574 ?year } OPTIONAL { ?st pq:P405 ?author . OPTIONAL { ?author wdt:P569 ?born } OPTIONAL { ?author wdt:P570 ?died } '+
'OPTIONAL { ?author wdt:P27 ?nat } OPTIONAL { ?author wdt:P18 ?img } } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 400';
return get(EP+encodeURIComponent(q)).then(function(j){var out={};((j&&j.results&&j.results.bindings)||[]).forEach(function(b){function v(k){return b[k]&&b[k].value}
var n=v('name');if(!n)return;var item=(v('item')||'').split('/').pop(),o=out[n];
if(!o||(!o.people.length&&v('author')&&o.item!==item))o=out[n]={item:item,year:null,people:[]};if(o.item!==item)return;
var y=yr(v('year'));if(y&&!o.year)o.year=y;var a=v('author');if(!a)return;var id=a.split('/').pop(),p=o.people.filter(function(x){return x.id===id})[0];
if(!p){p={id:id,label:v('authorLabel')||'',desc:v('authorDescription')||'',born:yr(v('born')),died:yr(v('died')),nat:[],img:''};if(/^Q\d+$/.test(p.label))p.label='';o.people.push(p)}
var nt=v('natLabel');if(nt&&!/^Q\d+$/.test(nt)&&p.nat.indexOf(nt)<0)p.nat.push(nt);var im=v('img');if(im&&!p.img)p.img=im});
for(var k in out)out[k].people=out[k].people.filter(function(p){return p.label});return out})}
function ago(y){var n=new Date().getFullYear()-y;return n>0?n+(n===1?' year':' years')+' ago':''}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function link(h,t){var a=el('a','',t);a.href=h;a.rel='noopener';return a}
function img(u,w){return String(u).replace(/^http:/,'https:').replace(/\?.*$/,'')+'?width='+w}
[].forEach.call(document.querySelectorAll('.sp-ago[data-y]'),function(s){var a=ago(+s.dataset.y);if(a)s.textContent=' ('+a+')'});
window.SLWD={lookup:lookup,ago:ago};
// the species page
var box=document.getElementById('sp-who');
if(box){var sci=box.dataset.sci,auth=box.dataset.auth||'',st=box.querySelector('.sp-who-s'),pp=box.querySelector('.sp-who-p');
lookup([sci]).then(function(R){var r=R[sci];if(!r)return;var y=r.year||+box.dataset.y||null,ppl=r.people;
// a reviewed authority is the one shown: Wikidata's people are only added when they match it
if(auth){var a=auth.toLowerCase();ppl=ppl.filter(function(p){var s=p.label.split(/\s+/).pop().toLowerCase();return s&&a.indexOf(s)>=0})}
if(!auth&&(ppl.length||y)){st.textContent='';st.appendChild(document.createTextNode('First described'+(ppl.length?' by ':'')));
ppl.forEach(function(p,i){if(i)st.appendChild(document.createTextNode(i===ppl.length-1?' and ':', '));st.appendChild(el('b','',p.label))});
if(y){st.appendChild(document.createTextNode(' in '));st.appendChild(el('b','',String(y)));var g=ago(y);if(g)st.appendChild(el('span','sp-ago',' ('+g+')'))}
st.appendChild(document.createTextNode(', according to '));st.appendChild(link('https://www.wikidata.org/wiki/'+r.item,'Wikidata'));st.appendChild(document.createTextNode('.'))}
ppl.forEach(function(p){var c=el('div','sp-person');if(p.img){var i=new Image();i.src=img(p.img,120);i.alt='Portrait of '+p.label;i.width=64;i.height=80;i.loading='lazy';i.onerror=function(){i.remove()};c.appendChild(i)}
var t=el('div','sp-person-t');var h=el('p','sp-person-n');h.appendChild(link('https://www.wikidata.org/wiki/'+p.id,p.label));t.appendChild(h);
if(p.desc)t.appendChild(el('p','sp-person-d',p.desc.charAt(0).toUpperCase()+p.desc.slice(1)));
var b=[];if(p.born)b.push('Born '+p.born);if(p.died)b.push('died '+p.died+(p.born?' (aged about '+(p.died-p.born)+')':''));if(p.nat.length)b.push(p.nat.join(', '));
if(b.length)t.appendChild(el('p','sp-person-m',b.join(' · ')));
if(y&&p.born&&y>p.born&&(!p.died||y<=p.died+60))t.appendChild(el('p','sp-person-m','About '+(y-p.born)+' years old when '+(p.died&&y>p.died?'this name was published':'describing it')+'.'));
c.appendChild(t);pp.appendChild(c)});
if(ppl.length){var s=el('p','sp-note sp-who-src');s.appendChild(document.createTextNode('About the '+(ppl.length>1?'people':'person')+': '));s.appendChild(link('https://www.wikidata.org/wiki/'+r.item,'Wikidata'));
s.appendChild(document.createTextNode(' (CC0)'+(ppl.some(function(p){return p.img})?'; portraits from Wikimedia Commons.':'.')));pp.appendChild(s)}
if(ppl.length||!auth&&y)box.hidden=false}).catch(function(){})}
// region and city pages: the most recorded snakes' describers
[].forEach.call(document.querySelectorAll('.rg-who[data-wd]'),function(ul){var lis=[].filter.call(ul.children,function(li){var s=li.querySelector('.rg-by');return s&&!s.dataset.done});
if(!lis.length)return;lis.forEach(function(li){li.querySelector('.rg-by').textContent='looking it up...'});
lookup(lis.map(function(li){return li.dataset.sci})).then(function(R){lis.forEach(function(li){var s=li.querySelector('.rg-by'),r=R[li.dataset.sci];s.textContent='';
if(!r||(!r.people.length&&!r.year)){s.textContent='not found on Wikidata';s.className='rg-by rg-miss';return}
s.appendChild(document.createTextNode('described'+(r.people.length?' by ':'')));r.people.forEach(function(p,i){if(i)s.appendChild(document.createTextNode(i===r.people.length-1?' and ':', '));
s.appendChild(link('https://www.wikidata.org/wiki/'+p.id,p.label))});if(r.year){s.appendChild(document.createTextNode(' in '+r.year));var g=ago(r.year);if(g)s.appendChild(el('span','sp-ago',' ('+g+')'))}})})
.catch(function(){lis.forEach(function(li){var s=li.querySelector('.rg-by');s.textContent='could not reach Wikidata just now';s.className='rg-by rg-miss'})})});
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

# species pages: "See it in real life" - several research-grade iNaturalist photos (openly licensed
# only, each credited and linked), plus a size picture when the reviewed account gives a length
REAL_JS = r"""
(function(){var b=document.querySelector('.sp-realbtn'),m=document.querySelector('.sp-main[data-sci]');if(!b||!m)return;
var sci=m.dataset.sci,name=(document.querySelector('h1')||{}).textContent||sci,dlg=null;
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function lic(c){c=String(c||'').toLowerCase();return c==='cc0'?'CC0':c.replace(/^cc-/,'CC ').toUpperCase()}
var SCN={rainforest:'a rainforest',forest:'a forest',savanna:'a savanna',desert:'a desert',rocks:'rocky scrub',heath:'heathland',water:'fresh water',ocean:'the open sea'};
function size(){var lo=+m.dataset.lenlo,hi=+m.dataset.lenhi;if(!hi)return null;var W=340,P=1.5,s=Math.min((W-40)/(hi+0.55),74),NS='http://www.w3.org/2000/svg',ph=P*s,H=Math.max(ph+46,128),g=H-26,sc=SCN[m.dataset.scene]?m.dataset.scene:'';
var svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('role','img');
svg.setAttribute('aria-label',name+': about '+rng(lo,hi)+' long, next to a person 1.5 m tall'+(sc?', in '+SCN[sc]:''));
function a(t,o,p){var e=document.createElementNS(NS,t);for(var k in o)e.setAttribute(k,o[k]);(p||svg).appendChild(e);return e}
var px=14+0.2*s,hr=Math.max(3,0.11*s),x0=px+0.2*s+18,th=Math.max(5,Math.min(12,0.06*s)),y=g-th/2-1;
if(sc){svg.setAttribute('class','scn-on');scene(sc,W,g,x0,a,NS,svg)}
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
// a simple painted scene of the snake's habitat, behind the size picture (fixed colours, the same in dark mode)
function scene(k,W,g,x0,a,NS,svg){var G=a('g',{'class':'scn'}),r=7;function R(){r=(r*9301+49297)%233280;return r/233280}
for(var i=0,h=0;i<(m.dataset.sci||'').length;i++)h=(h*31+m.dataset.sci.charCodeAt(i))%233280;r=h||7;
var id='sky'+Math.round(R()*1e6),sky={rainforest:['#2c5e3a','#5c9654'],forest:['#cde5f1','#eef6e6'],savanna:['#f3dfa6','#fbf2d6'],desert:['#f6cf93','#fcefd6'],rocks:['#d3e2ec','#eef1e8'],heath:['#d8dfec','#eeeff2'],water:['#cbe6f3','#eaf5f1'],ocean:['#b8e0f4','#e4f4fb']}[k];
var df=a('defs',{},G),lg=a('linearGradient',{id:id,x1:0,y1:0,x2:0,y2:1},df);a('stop',{offset:0,'stop-color':sky[0]},lg);a('stop',{offset:1,'stop-color':sky[1]},lg);
var cp=a('clipPath',{id:id+'c'},df);a('path',{d:'M0 8Q0 0 8 0H'+(W-8)+'Q'+W+' 0 '+W+' 8V'+g+'H0Z'},cp);G.setAttribute('clip-path','url(#'+id+'c)');
a('rect',{x:0,y:0,width:W,height:g,fill:'url(#'+id+')'},G);
function P(d,f,o){return a('path',{d:d,fill:f,opacity:o==null?1:o},G)}function C(x,y,rr,f,o){return a('circle',{cx:x,cy:y,r:rr,fill:f,opacity:o==null?1:o},G)}
function E(x,y,rx,ry,f,o){return a('ellipse',{cx:x,cy:y,rx:rx,ry:ry,fill:f,opacity:o==null?1:o},G)}function Rc(x,y,w,h,f,o){return a('rect',{x:x,y:y,width:w,height:h,fill:f,opacity:o==null?1:o},G)}
function hills(y0,amp,f,o){var d='M0 '+g+'L0 '+y0;for(var x=0;x<=W;x+=34)d+='Q'+(x+17)+' '+(y0-amp*(0.4+R()))+' '+(x+34)+' '+y0;P(d+'L'+W+' '+g+'Z',f,o)}
function tufts(f,n,hh){for(var i=0;i<n;i++){var x=R()*W,q=hh*(0.6+R()*0.6);P('M'+(x-3)+' '+g+'L'+(x-1)+' '+(g-q)+'L'+x+' '+g+'L'+(x+2)+' '+(g-q*0.9)+'L'+(x+3)+' '+g+'Z',f)}}
if(k==='rainforest'){for(var i=0;i<7;i++){var x=R()*W;Rc(x,0,5+R()*7,g,'#1d4529',0.8)}
for(i=0;i<16;i++)E(R()*W,R()*g*0.45,20+R()*26,10+R()*12,['#2f7a3c','#3f8d45','#246330'][i%3],0.9);
for(i=0;i<5;i++){var vx=R()*W;P('M'+vx+' 0Q'+(vx+8)+' '+(g*0.3)+' '+(vx-2)+' '+(g*(0.45+R()*0.25))+'l2 0Q'+(vx+10)+' '+(g*0.3)+' '+(vx+2)+' 0Z','#1f5a2c')}
hills(g-14,6,'#2a5a2f');Rc(0,g-5,W,5,'#4b3a22');for(i=0;i<6;i++){var fx=i<3?R()*30:W-R()*30;P('M'+fx+' '+g+'Q'+(fx-14)+' '+(g-16)+' '+(fx-22)+' '+(g-12)+'Q'+(fx-10)+' '+(g-8)+' '+fx+' '+g+'Q'+(fx+14)+' '+(g-18)+' '+(fx+22)+' '+(g-13)+'Q'+(fx+10)+' '+(g-8)+' '+fx+' '+g,'#3d9a48')}}
else if(k==='forest'){hills(g-26,10,'#a9cfa0',0.8);for(var i=0;i<6;i++){var x=20+R()*(W-40),hh=g*(0.45+R()*0.3);Rc(x-3,g-hh,6,hh,'#7a5a3a');C(x,g-hh,16+R()*10,['#5e9b4f','#4f8a45','#6aa85a'][i%3]);C(x-10,g-hh+8,12,'#4f8a45',0.9)}
Rc(0,g-6,W,6,'#8fb36b');tufts('#6f9a4d',18,6)}
else if(k==='savanna'){C(W-40,24,13,'#f7c95b');hills(g-18,5,'#e4cf8e');var ax=W*0.62+R()*40,ah=g*0.45;Rc(ax-2,g-ah,4,ah,'#6b5236');E(ax,g-ah,34,8,'#7d9a48');E(ax-14,g-ah+5,18,6,'#6f8c3e');
if(R()>0.3){var bx=W*0.25+R()*40;Rc(bx-1.5,g-ah*0.6,3,ah*0.6,'#6b5236',0.8);E(bx,g-ah*0.6,20,5,'#8aa452',0.8)}Rc(0,g-6,W,6,'#d8b35a');tufts('#c39a3e',30,9)}
else if(k==='desert'){C(W-46,26,15,'#fbe08a');P('M0 '+(g-24)+'Q'+(W*0.3)+' '+(g-44)+' '+(W*0.6)+' '+(g-22)+'T'+W+' '+(g-30)+'L'+W+' '+g+'L0 '+g+'Z','#ebc584');
P('M0 '+(g-10)+'Q'+(W*0.4)+' '+(g-22)+' '+(W*0.75)+' '+(g-8)+'T'+W+' '+(g-12)+'L'+W+' '+g+'L0 '+g+'Z','#dfb16c');for(var i=0;i<4;i++)E(R()*W,g-2,4+R()*5,3,'#a98a62');
var sx=W*0.8;for(i=0;i<5;i++)P('M'+sx+' '+g+'L'+(sx-10+i*5)+' '+(g-10-R()*6),'none').setAttribute('stroke','#7b7a4a')}
else if(k==='rocks'){hills(g-34,14,'#b9c5b2');hills(g-16,8,'#a6b29c');for(var i=0;i<5;i++){var x=R()*W;E(x,g-6,10+R()*12,7+R()*7,['#9aa39a','#878f87','#a9b0a6'][i%3])}
for(i=0;i<5;i++)C(R()*W,g-6,5+R()*5,'#6f8f55');Rc(0,g-4,W,4,'#9a8d74')}
else if(k==='heath'){hills(g-30,10,'#b3bfae');for(var i=0;i<14;i++)E(R()*W,g-4,14+R()*16,6+R()*6,['#9a78a6','#7f9a5c','#8a6c96'][i%3]);Rc(0,g-3,W,3,'#6e5a4a')}
else if(k==='water'){hills(g-28,10,'#9cc790');for(var i=0;i<4;i++){var x=W*0.3+R()*W*0.7,hh=g*(0.3+R()*0.25);Rc(x-2,g-hh-12,4,hh,'#7a5a3a',0.8);C(x,g-hh-12,13,'#6aa85a',0.85)}
Rc(0,g-12,W,12,'#5aa3c8');for(i=0;i<6;i++)Rc(x0+R()*(W-x0-30),g-9+R()*6,14+R()*14,1.2,'#d4ecf6',0.8);P('M0 '+g+'L0 '+(g-14)+'L'+(x0-12)+' '+(g-14)+'Q'+(x0-4)+' '+(g-8)+' '+(x0-8)+' '+g+'Z','#7a9a52');
for(i=0;i<9;i++){var rx=W-6-R()*36;P('M'+rx+' '+(g-8)+'L'+(rx+1)+' '+(g-30-R()*14)+'L'+(rx+2.4)+' '+(g-8)+'Z','#5b7f3a')}}
else if(k==='ocean'){Rc(0,g-34,W,34,'#3f8fc0');Rc(0,g-34,W,2,'#2c6f9e',0.6);for(var i=0;i<10;i++){var x=R()*W,yy=g-30+R()*26;P('M'+x+' '+yy+'q6 -4 12 0q6 4 12 0','none').setAttribute('stroke','#cbe8f6')}
P('M0 '+g+'L0 '+(g-12)+'Q'+(x0*0.6)+' '+(g-16)+' '+(x0-4)+' '+(g-5)+'L'+(x0-1)+' '+g+'Z','#e9d39a');if(R()>0.2){P('M'+(W*0.7)+' '+(g-34)+'q22 -16 44 0Z','#8bb07a')}}
[].forEach.call(G.querySelectorAll('path[fill="none"]'),function(e){e.setAttribute('stroke-width','1.4');e.setAttribute('stroke-linecap','round')})}
function fmt(v){return v<1?Math.round(v*100)+' cm':(Math.round(v*100)/100)+' m'}
function rng(lo,hi){if(lo===hi)return fmt(hi);if(lo>=1)return (Math.round(lo*100)/100)+'–'+fmt(hi);if(hi<1)return Math.round(lo*100)+'–'+fmt(hi);return fmt(lo)+'–'+fmt(hi)}
function open(){if(!dlg)build();if(dlg.showModal){if(!dlg.open)dlg.showModal()}else dlg.setAttribute('open','');load()}
function close(){if(dlg.close)dlg.close();else dlg.removeAttribute('open')}
var grid,stat,got=0;
function build(){dlg=el('dialog','sp-rl');dlg.setAttribute('aria-labelledby','sp-rl-h');var inn=el('div','sp-rl-in'),hd=el('div','sp-rl-hd'),h=el('h2','',name+' in real life');h.id='sp-rl-h';
var x=el('button','sp-rl-x','×');x.type='button';x.setAttribute('aria-label','Close');x.addEventListener('click',close);hd.appendChild(h);hd.appendChild(x);inn.appendChild(hd);
stat=el('p','sp-rl-st','Loading photos from iNaturalist...');stat.setAttribute('role','status');inn.appendChild(stat);grid=el('ul','sp-rl-grid');inn.appendChild(grid);
var sz=size();if(sz){var f=el('figure','sp-rl-size');f.appendChild(el('h3','','How big is it?'));f.appendChild(sz);var cap=el('figcaption');cap.appendChild(document.createTextNode('Adult length: '+(m.dataset.lentxt||'')+' '));
var src=m.dataset.lensrc;if(src){var p=src.split('|');var aa=el('a','',p[0]);if(p[1]){aa.href=p[1];aa.rel='noopener'}cap.appendChild(document.createTextNode('(source: '));cap.appendChild(p[1]?aa:document.createTextNode(p[0]));cap.appendChild(document.createTextNode(')'))}
cap.appendChild(el('span','sp-note',' Drawn stretched out, to scale with a person 1.5 m tall'+(SCN[m.dataset.scene]?', in '+SCN[m.dataset.scene]+' - the kind of place it lives':'')+'. Real snakes vary.'));f.appendChild(cap);inn.appendChild(f)}
var n=el('p','sp-note sp-rl-n');n.appendChild(document.createTextNode('Research-grade observations shared on '));var ia=el('a','','iNaturalist');ia.href='https://www.inaturalist.org/observations?taxon_name='+encodeURIComponent(sci)+'&quality_grade=research';ia.rel='noopener';n.appendChild(ia);
n.appendChild(document.createTextNode('. Only photos their photographers shared under an open licence are shown; each links to its observation.'));inn.appendChild(n);
dlg.appendChild(inn);document.body.appendChild(dlg);dlg.addEventListener('click',function(e){if(e.target===dlg)close()});dlg.addEventListener('close',function(){b.focus();if(location.hash==='#real')history.replaceState(null,'',location.pathname+location.search)})}
function load(){if(got)return;if(navigator.onLine===false){stat.textContent='You seem to be offline. These photos come from iNaturalist, so they need an internet connection.';return}got=1;stat.textContent='Loading photos from iNaturalist...';
var c=window.AbortController?new AbortController():null,t=setTimeout(function(){if(c)c.abort()},12000);
fetch('https://api.inaturalist.org/v1/observations?taxon_name='+encodeURIComponent(sci)+'&photos=true&quality_grade=research&per_page=12',c?{signal:c.signal}:{}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){clearTimeout(t);var k=0;
((d&&d.results)||[]).forEach(function(o){var ph=(o.photos||[])[0];if(!ph||!ph.license_code||!ph.url)return;var who=(o.user&&(o.user.name||o.user.login))||'an iNaturalist user',u='https://www.inaturalist.org/observations/'+o.id;
var li=el('li'),f=el('figure'),a=el('a');a.href=u;a.rel='noopener';a.target='_blank';var i=new Image();i.src=ph.url.replace('/square.','/medium.');i.alt='Photo of '+name+' by '+who;i.loading='lazy';i.width=320;i.height=240;a.appendChild(i);f.appendChild(a);
var cap=el('figcaption');cap.appendChild(document.createTextNode('© '+who+' ('+lic(ph.license_code)+') '));var l2=el('a','','observation'+(o.observed_on?' from '+o.observed_on.slice(0,4):''));l2.href=u;l2.rel='noopener';l2.target='_blank';cap.appendChild(l2);f.appendChild(cap);li.appendChild(f);grid.appendChild(li);k++});
stat.textContent=k?k+' photo'+(k>1?'s':'')+' of '+name+' by iNaturalist observers.':'No openly licensed research-grade photos of this snake are on iNaturalist yet.'})
.catch(function(){clearTimeout(t);got=0;stat.textContent='Could not reach iNaturalist just now (it may be offline or blocked on this network). Try again later.'})}
b.addEventListener('click',open);if(location.hash==='#real')open();window.addEventListener('hashchange',function(){if(location.hash==='#real')open()})})();
"""

REAL_CSS = """
.sp-realbtn{font:inherit;cursor:pointer}.sp-ago{color:var(--muted)}
.sp-rl{width:min(920px,calc(100vw - 24px));max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--line);border-radius:18px;background:var(--card);color:var(--text)}
.sp-rl::backdrop{background:rgba(5,15,9,.72)}.sp-rl-in{padding:14px 18px 18px}
.sp-rl-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;position:sticky;top:-14px;background:var(--card);padding:4px 0 6px;z-index:1}
.sp-rl-hd h2{margin:0;font:700 22px/1.2 Georgia,serif}.sp-rl-x{flex:none;width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:24px;line-height:1;cursor:pointer}
.sp-rl-st{margin:4px 0 10px;color:var(--muted);font-size:14.5px}
.sp-rl-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr));gap:10px}@media (max-width:560px){.sp-rl-grid{grid-template-columns:1fr 1fr;gap:8px}}
.sp-rl-grid figure{margin:0}.sp-rl-grid img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:12px;display:block;background:var(--line)}
.sp-rl-grid figcaption{font-size:12px;color:var(--muted);margin-top:4px;overflow-wrap:anywhere}.sp-rl-grid figcaption a{color:inherit}
.sp-rl-size{margin:16px 0 0;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--bg)}.sp-rl-size h3{margin:0 0 6px;font:700 17px Georgia,serif}
.sp-rl-size svg{display:block;width:100%;max-width:520px;height:auto}.sp-rl-size .gr{stroke:var(--tagline);stroke-width:2}.sp-rl-size .pp{fill:var(--muted)}
.sp-rl-size .sn{fill:var(--g)}.sp-rl-size .sn2{fill:var(--g);opacity:.4}.sp-rl-size text{fill:var(--text);font:600 12px Inter,system-ui,sans-serif}
.sp-rl-size svg.scn-on{border-radius:10px}.sp-rl-size svg.scn-on .pp{fill:#2d3a33}.sp-rl-size svg.scn-on .sn{fill:#b5762f;stroke:#4a2e12;stroke-width:1.2}.sp-rl-size svg.scn-on .sn2{fill:#b5762f;opacity:.45;stroke:#4a2e12;stroke-width:1;stroke-dasharray:3 2}.sp-rl-size .eye{fill:#1a1208}.sp-rl-size svg.scn-on text.ln{fill:#13261a;paint-order:stroke;stroke:rgba(255,255,255,.85);stroke-width:3px;stroke-linejoin:round}.sp-rl-size text.tk{fill:var(--muted);font-weight:500;font-size:10.5px}
.sp-rl-size figcaption{font-size:13.5px}.sp-rl-size .sp-note{display:block;margin:4px 0 0}.sp-rl-n{margin:12px 0 0}
.sp-who{margin:14px 0 0}.sp-who h3{margin:0 0 4px}.sp-person{display:flex;gap:12px;align-items:flex-start;margin:10px 0 0;padding:10px 12px;border:1px solid var(--line);border-radius:14px;background:var(--bg)}
.sp-person img{flex:none;width:64px;height:80px;object-fit:cover;border-radius:10px;background:var(--line)}.sp-person-t{min-width:0}.sp-person p{margin:0 0 2px}
.sp-person-n{font-weight:700}.sp-person-d{font-size:14px}.sp-person-m{font-size:13.5px;color:var(--muted)}.sp-who-src{margin:8px 0 0!important}
@media (max-width:560px){.sp-rl{width:100vw;max-width:100vw;max-height:100dvh;height:100dvh;border-radius:0;margin:0}.sp-rl-in{padding:12px}}
"""
