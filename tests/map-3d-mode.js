// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT), then
//   PORT=<port> node tests/map-3d-mode.js [screenshot-dir]
// v6.09 the map's 3D button makes the MAP 3D (Eduardo: "make the 3d button in the map make the map 3d instead of the
// snakes"), on desktop (1280 x 900) and phone portrait (390 x 844). Outside sites are blocked; the satellite and land-height
// tiles and the habitat photos are answered here with small made-up pictures, so the test runs offline:
//  - the "3D" button sits inside the map's bottom-right corner, clear of the zoom buttons, the colour key and the hint;
//  - pressing it lights it up and turns the map into a tilted 3D landscape (MapLibre, loaded only now) over the same
//    place, with a compass, the zoom buttons working it, SnakeList's own colours laid over it and a "Flat map" button;
//  - with 3D on, a species from the map's list opens its species box, which has a 3D action: that opens the snake's
//    model in the map area, and "Back to map" goes back to the 3D map;
//  - Habitats on: a click on a coloured place flies the camera down low and opens "What it looks like" with real
//    photos (credited) and "See snakes here in 3D", which opens a snake that lives there in its 3D viewer;
//  - "Flat map" goes back to the flat map, on the same place; nothing of the 3D map is left behind;
//  - with the tile servers unreachable (offline) the 3D map gives up by itself: the flat map, with a message;
//  - with 3D off, a species row still opens the species page, as before.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const zlib = require('zlib');
const PORT = process.env.PORT || 8766, BASE = 'http://localhost:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };

// a plain 256 x 256 PNG of one colour (the made-up tiles)
function png(r, g, b) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const W = 256, raw = Buffer.alloc((W * 3 + 1) * W);
  for (let y = 0; y < W; y++) { raw[y * (W * 3 + 1)] = 0; for (let x = 0; x < W; x++) { const o = y * (W * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(W, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const SAT = png(70, 110, 60), DEM = png(128, 40, 0) /* terrarium: 40 m */, PHOTO = png(120, 160, 90);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const phone = vp.width < 600;
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    let tilesOn = true, tileHits = 0;
    await p.route(/^https?:\/\/(?!localhost)/, r => {
      const u = r.request().url();
      if (tilesOn && /server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery/.test(u)) { tileHits++; return r.fulfill({ status: 200, contentType: 'image/png', body: SAT }); }
      if (tilesOn && /server\.arcgisonline\.com\/ArcGIS\/rest\/services\/Reference/.test(u)) return r.fulfill({ status: 404, body: '' });
      if (tilesOn && /elevation-tiles-prod\/terrarium/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: DEM });
      if (/wikimedia\.org\//.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PHOTO });
      return r.abort();
    });
    await p.addInitScript(() => { for (const k of ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen']) localStorage.setItem(k, '1'); localStorage.setItem('sl-consent', 'essential'); });
    await p.goto(BASE + 'index.html?map=Spain', { waitUntil: 'load' });
    await p.waitForFunction(() => window.SL_MAP_GEO_DONE, null, { timeout: 90000 });
    await p.waitForTimeout(2500);
    const sb = await p.$('#see-species:not([hidden])'); if (sb) { await sb.click(); await p.waitForTimeout(800); }
    ok(await p.evaluate(() => document.getElementById('cp-title').textContent === 'Spain' && document.querySelectorAll('#cp-list .cp-row.cp-sp').length > 5), `${label}: Spain picked, its species listed`);
    ok(await p.evaluate(() => !window.maplibregl && !document.querySelector('script[src*="maplibre"]')), `${label}: the 3D map's library is not loaded with the page`);

    // ---- the corner button ----
    const geo = await p.evaluate(() => {
      const st = document.getElementById('globe-stage').getBoundingClientRect(), t = document.getElementById('td-toggle').getBoundingClientRect();
      const lap = sel => [].some.call(document.querySelectorAll(sel), e => { const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).display !== 'none' && r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top; });
      return { inside: t.left >= st.left && t.right <= st.right && t.top >= st.top && t.bottom <= st.bottom, right: st.right - t.right, bottom: st.bottom - t.bottom, w: t.width, h: t.height,
        lapZoom: lap('.globe-zoom, .layers-wrap, .map-tools'), lapKey: lap('.map-legend:not([hidden])'), lapHint: lap('.globe-hint'), lapAttr: lap('.leaflet-control-attribution') };
    });
    ok(geo.inside && geo.right <= 16 && geo.bottom <= 50, `${label}: the 3D button is inside the map's bottom-right corner (${Math.round(geo.right)} px from the right, ${Math.round(geo.bottom)} px from the bottom)`);
    ok(!geo.lapZoom && !geo.lapKey && !geo.lapHint && !geo.lapAttr, `${label}: it overlaps no zoom button, colour key, hint or map credit`);
    ok(geo.w >= 40 && geo.h >= 34 && geo.w <= 90, `${label}: compact and still easy to tap (${Math.round(geo.w)} x ${Math.round(geo.h)})`);
    if (SHOTS) await (await p.$('#globe-stage')).screenshot({ path: `${SHOTS}/3d-${label}-off.png` });

    // ---- pressing it: the map itself goes 3D, over the same place ----
    const view0 = await p.evaluate(() => window.SL_MAP_VIEW());
    await p.click('#td-toggle');
    ok(await p.evaluate(() => document.getElementById('td-toggle').getAttribute('aria-pressed') === 'true' && document.getElementById('td-toggle').classList.contains('on') && window.SL_MAP3D.on()), `${label}: pressing it turns the 3D map on and highlights it`);
    const t0 = Date.now();
    const loaded = await p.waitForFunction(() => { const m = window.SL_MAP3D.map(); return m && m.loaded() && !document.querySelector('.map3d-load') && m.getPitch() > 30; }, null, { timeout: 150000 }).then(() => true, () => false);
    ok(loaded, `${label}: a tilted 3D landscape is drawn in the map area (${Math.round((Date.now() - t0) / 1000)} s)`);
    const st3 = await p.evaluate(() => {
      const m = window.SL_MAP3D.map(), el = document.getElementById('map3d'), s = document.getElementById('globe-stage').getBoundingClientRect(), r = el.getBoundingClientRect(), c = m.getCenter();
      const st = m.getStyle();
      return { fills: Math.abs(r.width - s.width) <= 4 && Math.abs(r.height - s.height) <= 4, terrain: !!(st.terrain && st.terrain.source), sky: !!st.sky, proj: st.projection && st.projection.type,
        ov: !!m.getSource('ov') && !!m.getLayer('ov'), hint: getComputedStyle(document.querySelector('.globe-hint')).display, lon: c.lng, lat: c.lat,
        flat: !!document.querySelector('#m3d-flat'), compass: !!document.querySelector('.globe-zoom #m3d-compass'), attr: (document.querySelector('.maplibregl-ctrl-attrib-inner') || {}).textContent || '' };
    });
    ok(st3.fills && st3.terrain && st3.sky && st3.proj === 'globe', `${label}: it fills the map area, with real heights, sky and a globe when zoomed out`);
    ok(Math.abs(st3.lon - (view0.w + view0.e) / 2) < 8 && Math.abs(st3.lat - (view0.s + view0.n) / 2) < 8, `${label}: it shows the place the flat map showed (centre ${st3.lon.toFixed(1)}, ${st3.lat.toFixed(1)})`);
    ok(st3.ov, `${label}: SnakeList's own colours (borders, the picked place, Habitats...) are laid over the landscape`);
    ok(st3.flat && st3.compass && st3.hint === 'none', `${label}: a "Flat map" button and a compass are there; the flat map's hint steps aside`);
    ok(/Esri/.test(st3.attr) && /Terrain Tiles/.test(st3.attr) && /MapLibre/.test(st3.attr), `${label}: the credits name Esri, AWS Terrain Tiles and MapLibre`);
    ok(tileHits > 0, `${label}: satellite tiles were asked for (${tileHits})`);
    const z0 = await p.evaluate(() => window.SL_MAP3D.map().getZoom());
    await p.evaluate(() => document.getElementById('globe-in').click()); await p.waitForTimeout(700);
    ok(await p.evaluate((z0) => window.SL_MAP3D.map().getZoom() > z0 + 0.5, z0), `${label}: the map's + button zooms the 3D map`);
    await p.evaluate(() => window.SL_MAP3D.map().jumpTo({ bearing: 50 })); await p.click('#m3d-compass'); await p.waitForFunction(() => Math.abs(window.SL_MAP3D.map().getBearing()) < 1, null, { timeout: 8000 }).catch(() => {});
    ok(await p.evaluate(() => Math.abs(window.SL_MAP3D.map().getBearing()) < 1), `${label}: the compass turns it back to north`);
    if (SHOTS) await (await p.$('#globe-stage')).screenshot({ path: `${SHOTS}/3d-${label}-on.png` });

    // ---- a species box over the 3D map keeps its 3D action (the snake's model) ----
    const row = await p.$('#cp-list .cp-row.cp-sp[data-sp="natrix-maura"]');
    ok(!!row, `${label}: Natrix maura is in Spain's list`);
    await row.scrollIntoViewIfNeeded(); await p.waitForTimeout(400); await p.click('#cp-list .cp-row.cp-sp[data-sp="natrix-maura"] .cpc-card .card-name'); await p.waitForTimeout(900);
    ok(await p.evaluate(() => !document.querySelector('.sp-info-wrap').hidden && !/species\//.test(location.pathname) && !!document.querySelector('.sp-info-wrap .sp-info-3d')), `${label}: with 3D on, choosing the species opens its box, with a 3D action`);
    await p.evaluate(() => document.querySelector('.sp-info-wrap .sp-info-3d').click());
    const got = await p.waitForFunction(() => { const c = document.querySelector('#globe-stage .sl3d-ov .sp3d-canvas, #globe-stage .sl3d-ov .sp3d-msg:not(:has(.sp3d-spin))'); return c && (c.classList.contains('sp3d-canvas') ? 'canvas' : /Loading/.test(c.textContent) ? null : c.textContent); }, null, { timeout: 180000 }).then(h => h.jsonValue()).catch(() => null);
    ok(got === 'canvas' && await p.evaluate(() => /Natrix maura/.test(document.querySelector('.sl3d-ov h2').textContent)), `${label}: its 3D action opens that snake's model in the map area (${got})`);
    await p.click('.sl3d-back'); await p.waitForTimeout(800);
    ok(await p.evaluate(() => !document.querySelector('.sl3d-ov') && window.SL_MAP3D.on() && !!document.getElementById('map3d')), `${label}: "Back to map" goes back to the 3D map`);
    await p.evaluate(() => { const x = document.querySelector('.sp-info-wrap:not([hidden]) .sp-info-x'); if (x) x.click(); });

    // ---- Habitats in 3D: fly down low, and what it looks like ----
    await p.evaluate(() => { document.getElementById('hab-toggle').click(); });
    await p.waitForTimeout(400);
    await p.evaluate(() => window.SL_MAP_HABITAT('Florida Everglades')); await p.waitForTimeout(600);
    if (phone) await p.evaluate(() => { const hp = document.getElementById('hab-panel'); hp.classList.add('collapsed'); });
    await p.evaluate(() => window.SL_MAP3D.map().jumpTo({ center: [-81.5, 27.5], zoom: 5.2, pitch: 45, bearing: 0 }));
    await p.waitForTimeout(1500);
    const pt = await p.evaluate(() => { const m = window.SL_MAP3D.map(), q = m.project([-80.9, 25.9]), r = m.getCanvas().getBoundingClientRect(); return [r.left + q.x, r.top + q.y]; });
    await p.mouse.click(pt[0], pt[1]);
    const pan = await p.waitForFunction(() => { const d = document.getElementById('m3d-panel'); return d && d.querySelector('.m3d-fig img') && d; }, null, { timeout: 30000 }).then(() => true, () => false);
    ok(pan, `${label}: a click on a coloured place opens "What it looks like"`);
    const pi = await p.evaluate(() => { const d = document.getElementById('m3d-panel'); return { h: d.querySelector('h3').textContent, n: d.querySelectorAll('.m3d-thumbs button').length, cap: d.querySelector('.m3d-cap').textContent,
      src: d.querySelector('.m3d-fig img').src, go: !!d.querySelector('.m3d-go'), chips: [].map.call(d.querySelectorAll('.m3d-chips button'), b => b.textContent) }; });
    ok(/Florida Everglades/.test(pi.h) && /Florida/.test(pi.h.replace('Florida Everglades', '')), `${label}: it names the habitat and the place (${pi.h})`);
    ok(pi.n >= 3 && /wikimedia\.org/.test(pi.src) && /Photo: .+, (CC|Public|PD)/.test(pi.cap) && /Wikimedia Commons/.test(pi.cap), `${label}: several real photos, each credited (${pi.n}; "${pi.cap.slice(0, 80)}")`);
    ok(pi.go && pi.chips.length > 0, `${label}: "See snakes here in 3D", with snakes of that habitat there (${pi.chips.join(', ')})`);
    await p.waitForFunction(() => { const m = window.SL_MAP3D.map(); return m.getZoom() > 11.5 && m.getPitch() > 64; }, null, { timeout: 30000 }).catch(() => {});
    const low = await p.evaluate(() => { const m = window.SL_MAP3D.map(), c = m.getCenter(); return { z: m.getZoom(), pitch: m.getPitch(), lon: c.lng, lat: c.lat }; });
    ok(low.z > 11.5 && low.pitch > 64 && low.lon > -83 && low.lon < -79 && low.lat > 24.5 && low.lat < 28, `${label}: the camera flies down low over the real place (zoom ${low.z.toFixed(1)}, tilt ${Math.round(low.pitch)}, at ${low.lon.toFixed(2)}, ${low.lat.toFixed(2)})`);
    if (SHOTS) await (await p.$('#globe-stage')).screenshot({ path: `${SHOTS}/3d-${label}-habitat.png` });
    await p.click('#m3d-panel .m3d-go');
    const snake = await p.waitForFunction(() => { const o = document.querySelector('.sl3d-ov.sl3d-modal'); return o && o.querySelector('.sp3d-canvas') && o.querySelector('h2').textContent; }, null, { timeout: 180000 }).then(h => h.jsonValue()).catch(() => null);
    ok(!!snake, `${label}: "See snakes here in 3D" opens a snake that lives there in 3D (${snake})`);
    const habBtn = await p.evaluate(() => [].map.call(document.querySelectorAll('.sl3d-ov .sp3d-habopt'), b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')));
    ok(!habBtn.length || habBtn.some(t => /\*$/.test(t) && /Everglades|swamp/i.test(t)), `${label}: in the habitat's own 3D scene (${habBtn.join(', ') || 'its scene'})`);
    await p.click('.sl3d-ov .sl3d-x'); await p.waitForTimeout(600);
    await p.click('#m3d-panel .m3d-x'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => !document.getElementById('m3d-panel')), `${label}: the photos panel closes`);
    await p.evaluate(() => document.getElementById('hab-toggle').click()); await p.waitForTimeout(300);

    // ---- back to the flat map, on the same place ----
    const c3 = await p.evaluate(() => { const c = window.SL_MAP3D.map().getCenter(); return [c.lng, c.lat]; });
    await p.click('#m3d-flat'); await p.waitForTimeout(800);
    const back = await p.evaluate(() => ({ on: window.SL_MAP3D.on(), el: !!document.getElementById('map3d'), btn: document.getElementById('td-toggle').getAttribute('aria-pressed'), flat: !!document.getElementById('m3d-flat'),
      comp: !!document.getElementById('m3d-compass'), v: window.SL_MAP_VIEW(), hint: getComputedStyle(document.querySelector('.globe-hint')).display }));
    ok(!back.on && !back.el && back.btn === 'false' && !back.flat && !back.comp && back.hint !== 'none', `${label}: "Flat map" goes back to the flat map, and nothing of the 3D map is left`);
    ok(Math.abs((back.v.w + back.v.e) / 2 - c3[0]) < 3 && Math.abs((back.v.s + back.v.n) / 2 - c3[1]) < 3, `${label}: the flat map shows the same place (${((back.v.w + back.v.e) / 2).toFixed(1)}, ${((back.v.s + back.v.n) / 2).toFixed(1)})`);

    // ---- offline: the tile servers can't be reached ----
    tilesOn = false;
    await p.evaluate(() => window.SL_MAP_FIT(-10, 4, 35, 44, false));
    await p.click('#td-toggle');
    const gaveUp = await p.waitForFunction(() => !window.SL_MAP3D.on() && !document.getElementById('map3d') && document.querySelector('.m3d-note'), null, { timeout: 60000 }).then(() => true, () => false);
    const msg = await p.evaluate(() => (document.querySelector('.m3d-note') || {}).textContent || '');
    ok(gaveUp && /flat map/.test(msg) && await p.evaluate(() => document.getElementById('td-toggle').getAttribute('aria-pressed') === 'false'), `${label}: offline, it goes back to the flat map with a message ("${msg}")`);
    tilesOn = true;

    // ---- 3D off: a species row still opens its page ----
    await p.goto(BASE + 'index.html?map=Spain', { waitUntil: 'load' });
    await p.waitForFunction(() => window.SL_MAP_GEO_DONE, null, { timeout: 90000 }); await p.waitForTimeout(2500);
    { const sb2 = await p.$('#see-species:not([hidden])'); if (sb2) { await sb2.click(); await p.waitForTimeout(800); } }
    const r3 = await p.$('#cp-list .cp-row.cp-sp[data-sp="natrix-maura"]');
    if (r3) { await r3.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await p.click('#cp-list .cp-row.cp-sp[data-sp="natrix-maura"] .cpc-card .card-name'); }
    ok(!!r3 && await p.waitForURL(/species\//, { timeout: 15000 }).then(() => true, () => false), `${label}: with 3D off, a species row opens the species page as before`);
    ok(errs.length === 0, `${label}: no page errors` + (errs.length ? ' - ' + errs.join(' | ') : ''));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
})().catch(e => { console.error(e); process.exit(1); });
