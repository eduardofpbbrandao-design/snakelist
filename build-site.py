"""Build the public website (index.html) from the app (snakelist-synced.html).

The app file is written for the claude.ai viewer, which supplies the page skeleton itself; a
real website needs its own doctype, charset, mobile viewport and the tags search engines and
link previews read. Run after every change:  python3 build-site.py
"""
import re
SITE = "https://snakelist.com/"
app = open("snakelist-synced.html", encoding="utf-8").read()
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
  if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', function () {{ var had = !!navigator.serviceWorker.controller; navigator.serviceWorker.addEventListener('controllerchange', function () {{ if (had && !window.SL_SW_RELOADED) {{ window.SL_SW_RELOADED = 1; location.reload(); }} }}); navigator.serviceWorker.register('sw.js', {{ updateViaCache: 'none' }}).then(function (r) {{ r.update(); }}).catch(function () {{}}); }});
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
open("index.html", "w", encoding="utf-8").write(head + app + "\n</body>\n</html>\n")
open("robots.txt", "w").write(f"User-agent: *\nAllow: /\nSitemap: {SITE}sitemap.xml\n")
import build_species, datetime
TODAY = datetime.date.today().isoformat()
SPECIES_URLS = build_species.build(app)
open("sitemap.xml", "w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    "".join("  <url><loc>%s</loc><lastmod>%s</lastmod></url>\n" % (u, TODAY) for u in [SITE, SITE + "about.html", SITE + "privacy.html", SITE + "terms.html"] + SPECIES_URLS) + "</urlset>\n")
import json
MANIFEST = json.dumps({
    "name": "SnakeList", "short_name": "SnakeList", "description": desc + " Made by Eduardo Brandao.",
    "id": "/",  # same as the old default (the start URL) so installed apps keep their identity
    "start_url": "./../", "scope": "./../", "display": "standalone", "display_override": ["window-controls-overlay", "standalone"], "orientation": "any",
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
open("sw.js", "w").write("""const CACHE = 'snakelist-v6';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.add('./'))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); return r; })
      .catch(() => caches.match('./')));
    return;
  }
  if (/\\/(app|brand)\\//.test(url.pathname)) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return r; }).catch(() => caches.match(req)));
    return;
  }
  if (/\\/(species-photos|data|vendor)\\//.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
  }
});
""")
print("built index.html")
