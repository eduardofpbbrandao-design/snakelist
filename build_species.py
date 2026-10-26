"""One page per snake species (species/<id>.html), an A-Z index (species/index.html), the shared
world map they colour in (species/world.svg) and their style/script - all generated from the app
file, so the pages always match the checklist. Called by build-site.py.
"""
import json, re, html as H, os, base64

SITE = "https://snakelist.com/"
OUT = "species"
AUTHOR = "Eduardo Brandao"


def build(app):
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
            "venom": a.get("venomous") == "1", "invasive": H.unescape(a.get("invasive", "")),
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

    # ---- the world map: one path per country, equirectangular (x = lon, y = -lat) ----
    src = open("data/geo.js", encoding="utf-8").read().split("window.SL_GEO=", 1)[1]
    js = re.sub(r'([{,])(prebuilt|wp|cp|us):', r'\1"\2":', src.rstrip().rstrip(';'), count=4)
    P = json.loads(js)["prebuilt"]; SC = P["scale"]
    paths, boxes = {}, {}
    for r in P["poly"]:
        code = r[0]
        if not isinstance(r[7], list) or len(r[7]) < 3: continue
        xs, ys, x, y = [], [], 0, 0
        for dx, dy in zip(r[7], r[8]):
            x += dx; y += dy; xs.append(x / SC); ys.append(y / SC)
        area = (max(xs) - min(xs)) * (max(ys) - min(ys))
        if area < 0.02 and code in paths: continue          # specks next to a bigger shape of the same country
        q, last = [], None
        for lon, lat in zip(xs, ys):
            pt = (round((lon + 180) * 4), round((90 - lat) * 4))
            if pt != last: q.append(pt); last = pt
        if len(q) < 3: continue
        d = "M%d %d" % q[0] + "".join("l%d %d" % (b[0] - a[0], b[1] - a[1]) for a, b in zip(q, q[1:]))
        paths.setdefault(code, []).append(d + "z")
        if area > boxes.get(code, (0,))[0]: boxes[code] = (area, min(xs), max(xs), min(ys), max(ys))
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 720">']
    for code, ps in paths.items():
        svg.append('<path id="c-%s" d="%s"/>' % (code, "".join(ps)))
    svg.append("</svg>")
    open(OUT + "/world.svg", "w").write("".join(svg))

    open(OUT + "/sp.css", "w").write(CSS)
    open(OUT + "/sp.js", "w").write(JS)

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
        if c["invasive"] or c["intro"]: extra.append("It has also been introduced outside its native range (%s), where it is invasive." % (c["invasive"] or ", ".join(c["intro"])))
        if c["habitats"]: extra.append("It lives in habitats such as %s." % plist([h.lower() for h in c["habitats"]], 4))
        rt = rarity_txt(c)
        if rt: extra.append(rt.split(" - ")[0] + ": " + rt.split(" - ", 1)[1] + "." if " - " in rt else rt + ".")
        about = lead + " " + " ".join(extra)
        title = ("%s - %s" % (nm, sci) if not c["is_sci"] else sci) + ": range map, photos & facts | SnakeList"
        desc = (lead + (" " + extra[0] if extra else ""))[:300]
        url = SITE + "species/" + c["id"]
        img = img_of(c, "large") or (SITE + "snakelist-logo.png")
        # where it lives, country by country, with its states/provinces
        provs = {}
        for pkey in c["provinces"]:
            cc, _, pn = pkey.partition(":"); provs.setdefault(cc.lower(), []).append(pn)
        if c["states"]: provs.setdefault("us", []).extend(c["states"])
        rows = []
        for n in c["countries"]:
            cc = iso.get(n, "")
            sub = provs.get(cc, [])
            rows.append("<li><b>%s</b>%s</li>" % (esc(n), (": " + esc(", ".join(sorted(sub)))) if sub else ""))
        codes = [iso[n] for n in c["countries"] if n in iso]
        bx = [boxes[cc] for cc in codes if cc in boxes]
        view = None
        if bx:
            w, e = min(b[1] for b in bx), max(b[2] for b in bx); s, nn = min(b[3] for b in bx), max(b[4] for b in bx)
            padx, pady = max(8, (e - w) * 0.25), max(6, (nn - s) * 0.25)
            w, e, s, nn = max(-180, w - padx), min(180, e + padx), max(-60, s - pady), min(85, nn + pady)
            if (e - w) < (nn - s) * 1.6: mid = (w + e) / 2; half = (nn - s) * 0.8; w, e = max(-180, mid - half), min(180, mid + half)
            view = "%.0f %.0f %.0f %.0f" % ((w + 180) * 4, (90 - nn) * 4, (e - w) * 4, (nn - s) * 4)
        rel = [x for x in by_genus.get(c["genus"], []) if x is not c][:12]
        if len(rel) < 6: rel += [x for x in by_family.get(c["family"], []) if x is not c and x not in rel][:12 - len(rel)]
        facts = []
        facts.append(("Venom", "Venomous" if c["venom"] else "Not venomous"))
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
            facts="".join("<div><dt>%s</dt><dd>%s</dd></div>" % (esc(k), esc(v)) for k, v in facts),
            habitats="".join("<li>%s</li>" % esc(h) for h in c["habitats"][:24]) or "<li>Not worked out yet</li>",
            where=("".join(rows) or "<li>No range recorded yet.</li>") + ("".join("<li><b>Introduced:</b> %s</li>" % esc(x) for x in c["intro"])),
            codes=esc(" ".join(codes)), view=esc(view or "0 0 1440 720"), sci_attr=esc(sci), id=c["id"],
            nplaces=len(c["countries"]),
            related="".join('<li><a href="%s">%s</a> <i>%s</i></li>' % (x["id"], esc(x["name"]), esc(x["sci"] if not x["is_sci"] else "")) for x in rel),
            author=AUTHOR, venom_cls="v" if c["venom"] else "nv", mapnote="" if codes else '<p class="sp-muted">No range data for this snake yet.</p>')
        open("%s/%s.html" % (OUT, c["id"]), "w", encoding="utf-8").write(page)
        links.append(c)
    # the A-Z of every species, by family - one crawlable page linking them all
    fams = sorted(by_family.items(), key=lambda kv: (kv[0] == "", kv[0]))
    body = "".join('<section><h2>%s <small>%d</small></h2><ul class="sp-az">%s</ul></section>' % (
        esc(f or "Other snakes"), len(L), "".join('<li><a href="%s">%s</a>%s</li>' % (
            x["id"], esc(x["name"]), (" <i>%s</i>" % esc(x["sci"])) if not x["is_sci"] else "") for x in sorted(L, key=lambda x: x["name"].lower())))
        for f, L in fams)
    open(OUT + "/index.html", "w", encoding="utf-8").write(INDEX.format(n=len(cards), body=body, author=AUTHOR, url=SITE + "species/"))
    return [SITE + "species/"] + [SITE + "species/" + c["id"] for c in links]


PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta name="author" content="{author}">
<meta property="og:type" content="article"><meta property="og:site_name" content="SnakeList by {author}">
<meta property="og:title" content="{title}"><meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1F5A3A">
<link rel="icon" href="../favicon.ico" sizes="any"><link rel="manifest" href="../app/snakelist.webmanifest">
<link rel="stylesheet" href="sp.css">
<script type="application/ld+json">{ld}</script>
</head><body>
<header class="sp-top"><a class="sp-logo" href="../">SnakeList</a><nav><a href="./">All species</a><a href="../">Open the app</a></nav></header>
<main class="sp-main" data-id="{id}" data-sci="{sci_attr}">
<nav class="sp-crumbs" aria-label="Breadcrumb"><a href="../">SnakeList</a> &rsaquo; <a href="./">All species</a> &rsaquo; <span>{h1}</span></nav>
<article>
<div class="sp-head">{photo}
<div class="sp-title"><h1>{h1}</h1><p class="sp-sci">{sub}</p>
<p class="sp-badge {venom_cls}"></p>
<dl class="sp-facts">{facts}</dl>
<p class="sp-cta"><a class="sp-btn" href="../?sp={id}">Open in SnakeList</a></p></div></div>
<section><h2>About</h2><p>{about}</p><div id="sp-wiki"></div></section>
<section><h2>Where it lives</h2>
<div class="sp-map" data-codes="{codes}" data-view="{view}" aria-label="Map of the {nplaces} countries where {h1} lives"></div>{mapnote}
<ul class="sp-where">{where}</ul></section>
<section><h2>Habitats</h2><ul class="sp-pills">{habitats}</ul></section>
<section><h2>Related snakes</h2><ul class="sp-rel">{related}</ul></section>
</article></main>
<footer class="sp-foot">SnakeList &middot; made by <a href="../about.html"><b>{author}</b></a> &middot; <a href="../about.html">About me</a> &middot; <a href="../privacy.html">Privacy</a> &middot; <a href="../terms.html">Terms</a></footer>
<script src="sp.js" defer></script>
</body></html>
"""

INDEX = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>All {n} snake species A-Z | SnakeList</title>
<meta name="description" content="Every one of the {n} snake species in SnakeList, by family - each with its photo, range map, habitats and facts.">
<link rel="canonical" href="{url}"><meta name="author" content="{author}">
<link rel="icon" href="../favicon.ico" sizes="any"><link rel="stylesheet" href="sp.css">
</head><body>
<header class="sp-top"><a class="sp-logo" href="../">SnakeList</a><nav><a href="../">Open the app</a></nav></header>
<main class="sp-main"><h1>All {n} snake species</h1><p class="sp-muted">By family, A-Z. Tap one for its photo, map and facts.</p>{body}</main>
<footer class="sp-foot">SnakeList &middot; made by <b>{author}</b></footer>
</body></html>
"""

CSS = """:root{--bg:#f1f6ee;--card:#fbfdf9;--text:#183020;--muted:#55705b;--line:#d5e4cf;--g:#3f8a3a;--land:#d7dccb;--on:#3f8a3a;--sea:#e3ecef}
@media (prefers-color-scheme:dark){:root{--bg:#10261a;--card:#173323;--text:#e6f2e4;--muted:#a3c3a8;--line:#2b4d37;--g:#7fc76a;--land:#2d4b39;--on:#7fc76a;--sea:#0d1f15}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 Inter,system-ui,-apple-system,Segoe UI,sans-serif}
a{color:var(--g)}.sp-top{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:980px;margin:0 auto;padding:14px 16px}
.sp-logo{font:700 26px Georgia,'Times New Roman',serif;color:var(--g);text-decoration:none}.sp-top nav{display:flex;gap:16px;font-size:14px}
.sp-main{max-width:980px;margin:0 auto;padding:0 16px 30px}.sp-crumbs{font-size:13px;color:var(--muted);margin:4px 0 14px}
.sp-head{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:24px;align-items:start}
@media (max-width:720px){.sp-head{grid-template-columns:1fr}}
.sp-photo{margin:0}.sp-photo img,.sp-sprite{width:100%;height:auto;aspect-ratio:3/2;object-fit:cover;border-radius:18px;display:block;background:var(--line)}
.sp-photo figcaption{font-size:12px;color:var(--muted);margin-top:6px}.sp-nophoto div{aspect-ratio:3/2;border-radius:18px;display:grid;place-items:center;background:var(--line);color:var(--muted)}
h1{font:700 clamp(30px,5vw,44px)/1.1 Georgia,serif;margin:0}.sp-sci{font-style:italic;color:var(--muted);margin:4px 0 10px;font-size:18px}
.sp-badge{display:none}.sp-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}
.sp-facts div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px 12px}.sp-facts dt{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}.sp-facts dd{margin:0;font-weight:600}
.sp-btn{display:inline-block;background:var(--g);color:#fff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:12px}
section{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px 20px;margin-top:18px}h2{font:700 22px Georgia,serif;margin:0 0 8px}h2 small{font:500 13px Inter,sans-serif;color:var(--muted)}
.sp-map{border-radius:12px;overflow:hidden;background:var(--sea);aspect-ratio:2/1;max-height:460px}.sp-map svg{width:100%;height:100%;display:block}
.sp-map path{fill:var(--land);stroke:var(--sea);stroke-width:.6;vector-effect:non-scaling-stroke}.sp-map path.on{fill:var(--on)}
.sp-where{columns:2 260px;padding-left:18px;font-size:14px}.sp-where li{break-inside:avoid;margin-bottom:4px}
.sp-pills{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:6px}.sp-pills li{border:1px solid var(--line);border-radius:999px;padding:3px 11px;font-size:13.5px}
.sp-rel,.sp-az{columns:3 220px;padding-left:18px}.sp-rel i,.sp-az i{color:var(--muted);font-size:13px}.sp-muted{color:var(--muted)}
.sp-lb{position:fixed;inset:0;z-index:50;background:rgba(5,15,9,.92);display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out}
.sp-lb img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;cursor:default}.sp-lb-x{position:fixed;top:12px;right:14px;width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.15);color:#fff;font-size:26px;cursor:pointer}
#sp-wiki p{margin:10px 0 0}#sp-wiki .src{font-size:12px;color:var(--muted)}.sp-foot{text-align:center;color:var(--muted);font-size:13px;padding:20px 16px 34px;border-top:1px solid var(--line)}
"""

JS = """(function(){
var m=document.querySelector('.sp-map');
if(m){fetch('world.svg').then(function(r){return r.text()}).then(function(t){m.innerHTML=t;var s=m.querySelector('svg');
s.setAttribute('viewBox',m.dataset.view||'0 0 1440 720');s.setAttribute('preserveAspectRatio','xMidYMid meet');
(m.dataset.codes||'').split(' ').forEach(function(c){var p=c&&s.getElementById('c-'+c);if(p){p.classList.add('on');s.appendChild(p)}})}).catch(function(){})}
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
