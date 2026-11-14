const CACHE = 'snakelist-v8';
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
