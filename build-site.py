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
# how many of them have a real photo (not a fossil illustration): "about N of the 4,247" on the static pages
_pi = re.search(r'<script type="application/json" id="photo-index">(.*?)</script>', app, re.S)
P_TXT = "{:,}".format(sum(1 for v in __import__("json").loads(_pi.group(1))["items"].values() if "Illustration" not in v[2])) if _pi else "0"
def _fix_totals(path):
    try: t = open(path, encoding="utf-8").read()
    except OSError: return
    t2 = re.sub(r"\b\d,\d{3}(?=(?:</[a-z]+>)? (?:snake )?species\b)", N_TXT, t)
    t2 = re.sub(r'(<span data-sl-total>)[\d,]+(</span>)', r"\g<1>" + N_TXT + r"\2", t2)
    t2 = re.sub(r'(<span data-sl-photos>)[\d,]+(</span>)', r"\g<1>" + P_TXT + r"\2", t2)
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
<link rel="icon" type="image/svg+xml" href="favicon.svg">
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
  // v4.81: SnakeList opens from the copy saved on this device and the offline helper fetches the newest
  // one in the background; when it is different, this bar offers Refresh. The page never reloads by
  // itself (on poor wifi a reload meant downloading everything again, and offline nothing came).
  if ('serviceWorker' in navigator) {{
    window.SL_SHOW_NEW = function () {{ if (document.getElementById('sl-newver') || !document.body) return; var b = document.createElement('div'); b.id = 'sl-newver'; b.setAttribute('role', 'status'); b.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9300;display:flex;gap:12px;align-items:center;max-width:calc(100vw - 32px);padding:10px 12px 10px 16px;border-radius:14px;background:#256846;color:#fff;font:500 14px/1.35 Inter,system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.28)'; b.innerHTML = '<span>A new version of SnakeList is ready. Your list is already saved.</span><button type="button" style="font:600 14px Inter,sans-serif;color:#256846;background:#fff;border:0;border-radius:9px;padding:7px 14px;cursor:pointer">Refresh</button><button type="button" aria-label="Later" style="background:none;border:0;color:#fff;font-size:20px;cursor:pointer">&times;</button>'; var bs = b.querySelectorAll('button'); bs[0].onclick = function () {{ if (document.querySelector('.note-sheet.open') && !confirm('You have a sighting open that is not saved yet. Refresh anyway?')) return; location.reload(); }}; bs[1].onclick = function () {{ b.remove(); }}; document.body.appendChild(b); }};
    navigator.serviceWorker.addEventListener('message', function (e) {{ if (e.data && e.data.type === 'sl-update') {{ if (document.body) window.SL_SHOW_NEW(); else document.addEventListener('DOMContentLoaded', window.SL_SHOW_NEW); }} }});
    if (location.protocol === 'https:') window.addEventListener('load', function () {{ navigator.serviceWorker.register('sw.js', {{ updateViaCache: 'none' }}).then(function (r) {{ if (navigator.onLine !== false) r.update().catch(function () {{}}); }}).catch(function () {{}}); }});
  }}
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
for _f in ("data/geo.js", "data/places.js", "data/islands.js", "data/cities-more.js"):
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
site_app = re.sub(r'(<span data-sl-total>)[\d,]+(</span>)', r"\g<1>" + N_TXT + r"\2", site_app)  # the right count from the very first frame
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
- Each photo belongs to its photographer and is used under the Creative Commons licence they chose; full list: {SITE}species/photo-credits.html
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
    # a species page: the day its content last changed, from build_species (data/page-dates.json,
    # a hash of the page itself) - the same date the page shows as "Page generated"
    if u in build_species.PAGE_LASTMOD:
        DATES.pop(u, None)
        return build_species.PAGE_LASTMOD[u]
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
json.dump(DATES, open(DATES_FILE, "w"), separators=(",", ":"), sort_keys=True)
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
# the offline helper (v4.81: made for poor wifi and no wifi). SnakeList itself opens straight from
# the copy saved on this device - no waiting for a slow connection - and the newest version is
# fetched quietly in the background; when it differs, the page is told and offers Refresh (it is
# never reloaded by itself). Other pages wait at most a few seconds for the network before their
# saved copy is used. Photos, map data, icons and the UI pictures are kept after their first load.
# The cache keeps its name, so the photos and map data saved by earlier versions stay.
open("sw.js", "w").write(r"""const CACHE = 'snakelist-v8';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.match('./').then((hit) => hit || c.add('./')))); });
// photos that were changed in place (v4.79: white borders cropped) - their saved copies are thrown away once
const REFRESHED = ['/species-photos/p2.jpg', '/species-photos/p44.jpg', '/species-photos/p65.jpg', '/species-photos/t/2-13.webp', '/species-photos/t/44-10.webp', '/species-photos/t/65-18.webp', '/species-photos/p1.jpg', '/species-photos/p3.jpg', '/species-photos/t/1-1.webp', '/species-photos/t/1-11.webp', '/species-photos/t/1-17.webp', '/species-photos/t/2-22.webp', '/species-photos/t/3-4.webp', '/species-photos/t/3-17.webp']; // photo batch 1: replaced photos are fetched again
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  .then(() => caches.open(CACHE)).then((c) => c.keys().then((ks) => Promise.all(ks.filter((k) => REFRESHED.some((p) => new URL(k.url).pathname.endsWith(p))).map((k) => c.delete(k)))))
  .then(() => self.clients.claim())); });
// the network, but never longer than ms: then null (the saved copy is used and the download still finishes into the cache)
const within = (p, ms) => new Promise((res) => { const t = setTimeout(() => res(null), ms); p.then((r) => { clearTimeout(t); res(r); }, () => { clearTimeout(t); res(null); }); });
const keep = (key) => (r) => { if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); } return r; };
// the same page? (validators when the server sends them, otherwise the text itself)
const samePage = (a, b) => {
  const ea = a.headers.get('etag'), eb = b.headers.get('etag');
  if (ea && eb) return Promise.resolve(ea === eb);
  const la = a.headers.get('last-modified'), lb = b.headers.get('last-modified');
  if (la && lb) return Promise.resolve(la === lb);
  return Promise.all([a.clone().text(), b.clone().text()]).then(([x, y]) => x === y);
};
// tell the newly opened page (once it exists) that a newer SnakeList is saved and ready
const tell = (id, tries) => self.clients.get(id || '').then((cl) => {
  if (cl) return cl.postMessage({ type: 'sl-update' });
  if (tries > 0) return new Promise((r) => setTimeout(r, 1000)).then(() => tell(id, tries - 1));
  return self.clients.matchAll({ type: 'window' }).then((cs) => cs.forEach((c) => c.postMessage({ type: 'sl-update' })));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // Google Fonts: the same files for ever, so a saved copy is used as it is (no waiting for them offline)
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // each page keeps its own last copy (the app itself under './'), so being offline on a species
    // page or the install page can never put that page in place of the app
    const home = url.pathname === '/' || url.pathname === '/index.html';
    const key = home ? './' : url.origin + url.pathname;
    const net = fetch(req, { cache: 'no-cache' });
    if (home) {
      e.respondWith(caches.match(key).then((hit) => {
        if (!hit) return net.then(keep(key)).catch(() => caches.match('./'));
        // opens at once from the saved copy; the newer one is fetched and saved in the background
        e.waitUntil(net.then((r) => {
          if (!r || !r.ok) return;
          return samePage(hit, r).then((same) => { if (same) return; return caches.open(CACHE).then((c) => c.put(key, r.clone())).then(() => tell(e.resultingClientId, 15)); });
        }).catch(() => {}));
        return hit;
      }));
      return;
    }
    e.respondWith(caches.match(key).then((hit) => {
      const fresh = net.then(keep(key));
      if (!hit) return fresh.catch(() => caches.match('./'));
      e.waitUntil(fresh.catch(() => {}));
      return within(fresh, 3500).then((r) => (r && r.ok ? r : hit));
    }));
    return;
  }
  if (/\/(app|brand)\//.test(url.pathname)) {
    // icons and the app manifest: the saved copy at once, refreshed in the background
    e.respondWith(caches.match(req).then((hit) => { const fresh = fetch(req, { cache: 'no-cache' }).then(keep(req)); if (!hit) return fresh; e.waitUntil(fresh.catch(() => {})); return hit; }));
    return;
  }
  if (/\/data\/ui\//.test(url.pathname)) {
    // the app's own pictures, named after their contents: a saved one never changes
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(keep(req))));
    return;
  }
  if (/^\/species\/(3d\/|[^/]+\.(js|css|json)$)/.test(url.pathname)) {
    // the 3D viewer and the species pages' scripts: the network, but a saved copy after 4 s or offline
    e.respondWith(caches.match(req).then((hit) => {
      const fresh = fetch(req).then(keep(req));
      if (!hit) return fresh;
      e.waitUntil(fresh.catch(() => {}));
      return within(fresh, 4000).then((r) => (r && r.ok ? r : hit));
    }));
    return;
  }
  if (/\/(species-photos|data|vendor)\//.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => {
      // photos never change and versioned data files (?v=...) are new files when they change:
      // a saved copy is used as it is, with no download at all (works offline, saves data)
      if (hit && (/\/species-photos\//.test(url.pathname) || url.search)) return hit;
      const net = fetch(req).then((r) => {
        if (r.ok) {
          c.put(req, r.clone());
          // the offline copy keeps at most ~600 snake photos (about 20 MB): the oldest go first
          if (/\/species-photos\//.test(url.pathname)) c.keys().then((ks) => { const ph = ks.filter((k) => /\/species-photos\//.test(k.url)); ph.slice(0, Math.max(0, ph.length - 600)).forEach((k) => c.delete(k)); });
          // a new version of a data file: drop the older copies of the same file
          if (url.search) c.keys().then((ks) => ks.forEach((k) => { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) c.delete(k); }));
        }
        return r;
      }).catch(() => hit);
      if (!hit) return net;
      // anything else saved: the network for at most 4 s, then the saved copy
      e.waitUntil(net.catch(() => {}));
      return within(net, 4000).then((r) => (r && r.ok ? r : hit));
    })));
  }
});
""")
print("built index.html")
