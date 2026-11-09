"""Build the public website (index.html) from the app (snakelist-synced.html).

The app file is written for the claude.ai viewer, which supplies the page skeleton itself; a
real website needs its own doctype, charset, mobile viewport and the tags search engines and
link previews read. Run after every change:  python3 build-site.py
"""
import re
SITE = "https://snakelist.com/"
app = open("snakelist-synced.html", encoding="utf-8").read()
# how many snakes SnakeList lists: the one source for every "N species" on the static pages
N_SPECIES = len(re.findall(r'<div class="card" data-id=', app))
N_TXT = "{:,}".format(N_SPECIES)
def _fix_totals(path):
    try: t = open(path, encoding="utf-8").read()
    except OSError: return
    t2 = re.sub(r"\b\d,\d{3}(?=(?:</[a-z]+>)? (?:snake )?species\b)", N_TXT, t)
    t2 = re.sub(r'(<span data-sl-total>)[\d,]+(</span>)', r"\g<1>" + N_TXT + r"\2", t2)
    if t2 != t: open(path, "w", encoding="utf-8").write(t2)
for _p in ("about.html", "about-snakelist.html", "install.html", "privacy.html", "terms.html"): _fix_totals(_p)
title = "SnakeList - the snake life list, map and quiz"
desc = ("Track every snake species you've seen. A checklist of 4,000+ snakes with photos, "
        "range maps down to states and provinces, a wishlist and a where-does-it-live quiz.")
head = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="{desc}">
<meta name="theme-color" content="#1F5A3A">
<meta name="author" content="Eduardo Brandao">
<meta name="copyright" content="SnakeList by Eduardo Brandao">
<meta property="og:site_name" content="SnakeList by Eduardo Brandao">
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"WebApplication","name":"SnakeList","url":"{SITE}","applicationCategory":"EducationalApplication","operatingSystem":"Any","description":"{desc}","author":{{"@type":"Person","name":"Eduardo Brandao"}},"creator":{{"@type":"Person","name":"Eduardo Brandao"}},"publisher":{{"@type":"Person","name":"Eduardo Brandao"}},"offers":{{"@type":"Offer","price":"0","priceCurrency":"USD"}}}}</script>
<link rel="canonical" href="{SITE}">
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="96x96" href="app/favicon-96-s.png">
<link rel="icon" type="image/png" sizes="48x48" href="app/favicon-48-s.png">
<link rel="apple-touch-icon" href="app/apple-touch-icon-s.png">
<link rel="manifest" href="app/snakelist.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="SnakeList">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{SITE}">
<meta property="og:image" content="{SITE}snakelist-logo.png">
<meta name="twitter:card" content="summary_large_image">
<style>html,body{{margin:0;padding:0}}</style>
<script>
  // installable app: the offline helper, and the browser's install prompt kept for the Install button
  window.addEventListener('beforeinstallprompt', function (e) {{ e.preventDefault(); window.SL_INSTALL_EVT = e; }});
  if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', function () {{ var had = !!navigator.serviceWorker.controller; navigator.serviceWorker.addEventListener('controllerchange', function () {{ if (!had || window.SL_SW_RELOADED) return; if (!window.SL_TOUCHED) {{ window.SL_SW_RELOADED = 1; location.reload(); return; }} if (document.getElementById('sl-newver')) return; var b = document.createElement('div'); b.id = 'sl-newver'; b.setAttribute('role', 'status'); b.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9300;display:flex;gap:12px;align-items:center;max-width:calc(100vw - 32px);padding:10px 12px 10px 16px;border-radius:14px;background:#256846;color:#fff;font:500 14px/1.35 Inter,system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.28)'; b.innerHTML = '<span>A new version of SnakeList is ready. Your list is already saved.</span><button type="button" style="font:600 14px Inter,sans-serif;color:#256846;background:#fff;border:0;border-radius:9px;padding:7px 14px;cursor:pointer">Refresh</button><button type="button" aria-label="Later" style="background:none;border:0;color:#fff;font-size:20px;cursor:pointer">&times;</button>'; var bs = b.querySelectorAll('button'); bs[0].onclick = function () {{ if (document.querySelector('.note-sheet.open') && !confirm('You have a sighting open that is not saved yet. Refresh anyway?')) return; window.SL_SW_RELOADED = 1; location.reload(); }}; bs[1].onclick = function () {{ b.remove(); }}; document.body.appendChild(b); }}); navigator.serviceWorker.register('sw.js', {{ updateViaCache: 'none' }}).then(function (r) {{ r.update(); }}).catch(function () {{}}); }});
</script>
<!-- Google tag (gtag.js) - visitor statistics for snakelist.com -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-PY2LJV389K"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  // cookies only once the visitor accepts them in SnakeList's cookie banner
  var slOk = false; try {{ slOk = localStorage.getItem('sl-consent') === 'yes'; }} catch (e) {{}}
  gtag('consent', 'default', {{ analytics_storage: slOk ? 'granted' : 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }});
  gtag('js', new Date());
  gtag('config', 'G-PY2LJV389K');
</script>
"""
app = re.sub(r"^<title>[^<]*</title>", f"<title>{title}</title>", app, count=1)
# for search engines and AI browsers that only read the first megabytes of a page: the pictures
# built into the app's styles become small separate files (same look, the page's text comes much
# sooner), and the page gets its explicit </head><body> where the browser would start the body anyway
import hashlib, base64, os
os.makedirs("data/ui", exist_ok=True)
def _pic(m):
    q, mime, b64 = m.group(1), m.group(2), m.group(3)
    raw = base64.b64decode(b64)
    ext = {"jpeg": "jpg", "svg+xml": "svg"}.get(mime, mime)
    name = "data/ui/%s.%s" % (hashlib.sha1(raw).hexdigest()[:14], ext)
    if not os.path.exists(name): open(name, "wb").write(raw)
    return "url(%s%s%s)" % (q, name, q)
site_app = re.sub(r"url\((['\"]?)data:image/([a-z+]+);base64,([A-Za-z0-9+/=]+)\1\)", _pic, app)
# the big data files get a version tag from their contents, so a device that saved an older copy
# (the offline helper keeps data/ files) fetches the new one the moment it changes
for _f in ("data/geo.js", "data/places.js", "data/islands.js"):
    if os.path.exists(_f):
        _v = hashlib.sha1(open(_f, "rb").read()).hexdigest()[:10]
        site_app = site_app.replace('sc.src = "%s"' % _f, 'sc.src = "%s?v=%s"' % (_f, _v))
body_at = re.search(r"<(?!/?(?:title|style|script|link|meta|!--)\b)[a-zA-Z]", site_app).start()
# every stylesheet goes up into the head, in the same order: the page is megabytes long, and a
# style block near its end used to arrive seconds after the parts it styles - the Install
# button and the tab bar showed unstyled (an old-looking grey button) while SnakeList opened
_late = [m for m in re.finditer(r"<style>.*?</style>", site_app[body_at:], re.S)]
if _late:
    _css = "\n".join(m.group(0) for m in _late)
    _rest = site_app[body_at:]
    for m in reversed(_late): _rest = _rest[:m.start()] + _rest[m.end():]
    site_app = site_app[:body_at] + _css + "\n</head>\n<body>\n" + _rest
else:
    site_app = site_app[:body_at] + "</head>\n<body>\n" + site_app[body_at:]
open("index.html", "w", encoding="utf-8").write(head + site_app + "\n</body>\n</html>\n")
# every crawler is welcome on the public pages; the AI ones named too, so it's never in doubt
open("robots.txt", "w").write("User-agent: *\nAllow: /\n\n" + "".join("User-agent: %s\nAllow: /\n\n" % b for b in (
    "Googlebot", "Bingbot", "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User", "Applebot")) +
    f"Sitemap: {SITE}sitemap.xml\n")
# a plain-text guide for AI tools (llmstxt.org): what SnakeList is and where everything is
open("llms.txt", "w", encoding="utf-8").write(f"""# SnakeList

> SnakeList ({SITE}) is a free snake life list, map and quiz made by Eduardo Brandao. It covers {N_TXT} snake species with photos, range maps down to states and provinces, habitats, venom and constrictor classification, and a checklist people can tick off.

The app itself is one large interactive page. Every species also has its own small static page with its facts, range and links - those are the best pages to read.

## Species
- [All snake species A-Z]({SITE}species/): every species, by family, with links to each species page
- [Sitemap]({SITE}sitemap.xml): every public page, including all species, country, family and genus pages
- Species pages look like {SITE}species/coastal-taipan-oxyuranus-scutellatus (common name, then scientific name)

## Browse
- Snakes by country: {SITE}species/country/<country> - e.g. [Snakes of Australia]({SITE}species/country/australia)
- Snakes by family: {SITE}species/family/<family> - e.g. [Elapidae]({SITE}species/family/elapidae)
- Snakes by genus: {SITE}species/genus/<genus> - e.g. [Oxyuranus]({SITE}species/genus/oxyuranus)

## About
- [About SnakeList]({SITE}about-snakelist.html) - what it is, why and when it was made, and who made it
- [Install SnakeList]({SITE}install.html) - how to install SnakeList on Android, iPhone, iPad, Windows and Mac
- [About the creator]({SITE}about.html)
- [Privacy]({SITE}privacy.html) - lists are kept on the visitor's own device or their own Google Drive; there is no user database
- Photos come from iNaturalist photographers under Creative Commons licences, credited on each species page
""")
import build_species, datetime
TODAY = datetime.date.today().isoformat()
SPECIES_URLS = build_species.build(app)
import json
# lastmod only moves when a page really changed, so search engines can trust it
import hashlib
DATES_FILE = "data/sitemap-dates.json"
try: DATES = json.load(open(DATES_FILE))
except Exception: DATES = {}
def lastmod(u):
    rel = u[len(SITE):] or "index.html"
    if rel.endswith("/"): rel += "index.html"
    elif not rel.endswith(".html"): rel += ".html"
    try: h = hashlib.sha1(open(rel, "rb").read()).hexdigest()[:16]
    except OSError: return TODAY
    old = DATES.get(u)
    if not old or old[0] != h: DATES[u] = [h, TODAY]
    return DATES[u][1]
ALL_URLS = [SITE, SITE + "install.html", SITE + "about-snakelist.html", SITE + "about.html", SITE + "privacy.html", SITE + "terms.html"] + SPECIES_URLS
open("sitemap.xml", "w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    "".join("  <url><loc>%s</loc><lastmod>%s</lastmod></url>\n" % (u, lastmod(u)) for u in ALL_URLS) + "</urlset>\n")
json.dump(DATES, open(DATES_FILE, "w"), separators=(",", ":"))
import json
MANIFEST = json.dumps({
    "name": "SnakeList", "short_name": "SnakeList", "description": desc + " Made by Eduardo Brandao.",
    "id": "/",  # same as the old default (the start URL) so installed apps keep their identity
    "start_url": "./../", "scope": "./../", "display": "standalone", "display_override": ["window-controls-overlay", "standalone"], "orientation": "any",
    # lets the website ask the browser "is the SnakeList app installed on this device?"
    "related_applications": [{"platform": "webapp", "url": "https://snakelist.com/app/snakelist.webmanifest"}],
    "background_color": "#1F5A3A", "theme_color": "#1F5A3A",
    "icons": [{"src": "icon-192-s.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
              {"src": "icon-512-s.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
              {"src": "icon-maskable-512-s.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
    # real screenshots for the install sheet (wide = desktop / landscape), in this order
    "screenshots": [{"src": "screenshots/" + f, "sizes": "2048x960", "type": "image/jpeg", "form_factor": "wide", "label": l} for f, l in (
        ("1-homepage.jpg", "SnakeList homepage: the snake life list with every snake species in the world"),
        ("2-snake-species.jpg", "Snake species cards with photos, range, venom and size"),
        ("3-world-map.jpg", "World map showing where each snake species lives, down to states and provinces"),
        ("4-snake-identifier.jpg", "Snake identifier: take a photo and the camera suggests which snake it is"))]}, indent=1)
# the older name too, for phones that saved the page before the rename
for f in ("app/snakelist.webmanifest", "app/manifest.webmanifest"):
    open(f, "w").write(MANIFEST)
# the offline helper: pages always from the network first (so updates show at once), with the
# last copy kept for when there's no connection; photos, map data and icons are kept after
# their first load and refreshed in the background
open("sw.js", "w").write("""const CACHE = 'snakelist-v8';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.add('./'))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // each page keeps its own last copy (the app itself under './'), so being offline on a species
    // page or the install page can never put that page in place of the app
    const home = url.pathname === '/' || url.pathname === '/index.html';
    const key = home ? './' : url.origin + url.pathname;
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); } return r; })
      .catch(() => caches.match(key).then((hit) => hit || caches.match('./'))));
    return;
  }
  if (/\\/(app|brand)\\//.test(url.pathname)) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return r; }).catch(() => caches.match(req)));
    return;
  }
  if (/\\/(species-photos|data|vendor)\\//.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => {
      // photos never change and versioned data files (?v=...) are new files when they change:
      // a saved copy is used as it is, with no download at all (works offline, saves data)
      if (hit && (/\\/species-photos\\//.test(url.pathname) || url.search)) return hit;
      const net = fetch(req).then((r) => {
        if (r.ok) {
          c.put(req, r.clone());
          // the offline copy keeps at most ~600 snake photos (about 20 MB): the oldest go first
          if (/\\/species-photos\\//.test(url.pathname)) c.keys().then((ks) => { const ph = ks.filter((k) => /\\/species-photos\\//.test(k.url)); ph.slice(0, Math.max(0, ph.length - 600)).forEach((k) => c.delete(k)); });
          // a new version of a data file: drop the older copies of the same file
          if (url.search) c.keys().then((ks) => ks.forEach((k) => { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) c.delete(k); }));
        }
        return r;
      }).catch(() => hit);
      return hit || net;
    })));
  }
});
""")
print("built index.html")
