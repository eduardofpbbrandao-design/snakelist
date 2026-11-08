const CACHE = 'snakelist-v7';
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
  if (/\/(app|brand)\//.test(url.pathname)) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return r; }).catch(() => caches.match(req)));
    return;
  }
  if (/\/(species-photos|data|vendor)\//.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((r) => {
        if (r.ok) {
          c.put(req, r.clone());
          // a new version of a data file: drop the older copies of the same file
          if (url.search) c.keys().then((ks) => ks.forEach((k) => { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) c.delete(k); }));
        }
        return r;
      }).catch(() => hit);
      return hit || net;
    })));
  }
});
