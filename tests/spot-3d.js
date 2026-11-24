// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT, default 8766), then
//   PORT=<port> node tests/spot-3d.js [screenshot-dir]
// v6.14 "See the spot" (species/3d/spot.js) and Day / Night (species/3d/daynight.js). Everything outside is MOCKED (the
// build machine can't reach it): iNaturalist (a few sightings round one point in Spain), the satellite tiles (a
// patterned picture), the land-height tiles (flat) and the Overpass API (a road through the spot and a pond).
//  - a sighting's big view has "See the spot" next to "Explore in 3D"; pressing it shows a busy state at once and opens
//    the 3D panel, which loads nothing of the spot before the press;
//  - the spot is built: real-sized land, the satellite picture, the road and the pond, the card with the place, date and
//    observer, the accuracy note, the credits (Esri, AWS Terrain Tiles, OpenStreetMap), "See the area" and Night;
//  - Night turns the scene to night and back; an evening sighting opens at night by itself;
//  - an obscured sighting says that the exact spot is hidden;
//  - closing lets the 3D view go (no canvas left) and returns to the sighting;
//  - with Overpass failing, the spot still opens (no roads) and says so;
//  - the ordinary 3D viewer (Explore in 3D) has the Night button too.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const zlib = require('zlib');
const PORT = process.env.PORT || 8766, BASE = 'http://localhost:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };

function png(fn) { // a 256 x 256 PNG, colour per pixel from fn(x, y)
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const W = 256, raw = Buffer.alloc((W * 3 + 1) * W);
  for (let y = 0; y < W; y++) { raw[y * (W * 3 + 1)] = 0; for (let x = 0; x < W; x++) { const o = y * (W * 3 + 1) + 1 + x * 3, c = fn(x, y); raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(W, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const SAT = png((x, y) => (((x >> 4) + (y >> 4)) % 3 ? [96, 122, 70] : [40, 70, 36])), DEM = png(() => [128, 40, 0]);
const LAT = 38.55, LON = -7.9; // the sightings' point (Alentejo)
const OSM = { elements: [
  { type: 'way', id: 1, tags: { highway: 'tertiary', surface: 'asphalt' }, geometry: [{ lat: LAT - 0.002, lon: LON - 0.002 }, { lat: LAT, lon: LON }, { lat: LAT + 0.002, lon: LON + 0.002 }] },
  { type: 'way', id: 2, tags: { highway: 'track' }, geometry: [{ lat: LAT, lon: LON }, { lat: LAT + 0.001, lon: LON - 0.002 }] },
  { type: 'way', id: 3, tags: { natural: 'water' }, geometry: [[0.0008, 0.0008], [0.0008, 0.0016], [0.0014, 0.0016], [0.0014, 0.0008], [0.0008, 0.0008]].map(([a, b]) => ({ lat: LAT + a, lon: LON - b })) },
  { type: 'area', id: 3600000001, tags: { landuse: 'meadow' } }] };
const M = { overpassFail: false, overpassHits: 0, tileHits: 0 };
function obs(id, sci, opt = {}) {
  return { id, uri: 'https://www.inaturalist.org/observations/' + id, quality_grade: 'research', observed_on: '2024-05-12', observed_on_details: { date: '2024-05-12' },
    time_observed_at: opt.when || '2024-05-12T11:20:00+01:00', observed_time_zone: 'Europe/Lisbon', created_at: '2024-05-13T08:00:00+00:00',
    user: { login: 'obs' + id, name: 'Observer ' + id }, place_guess: 'Place of ' + id, positional_accuracy: opt.obscured ? 28000 : 8, obscured: !!opt.obscured, geoprivacy: opt.obscured ? 'obscured' : null,
    taxon: { id: sci === 'Natrix maura' ? 26093 : 30715, name: sci, rank: 'species', preferred_common_name: sci === 'Natrix maura' ? 'Viperine Water Snake' : "Lataste's Viper" },
    geojson: { type: 'Point', coordinates: [opt.lon != null ? opt.lon : LON, opt.lat != null ? opt.lat : LAT] }, photos: [{ id: id * 10, url: 'https://static.inaturalist.org/photos/' + id + '-0/square.jpg', attribution: '(c) Observer', license_code: 'cc-by' }] };
}
const OBS = [obs(101, 'Natrix maura'), obs(102, 'Vipera latastei', { when: '2024-05-12T23:10:00+01:00', lat: LAT + 0.01, lon: LON + 0.012 }), obs(103, 'Natrix maura', { obscured: true, lat: LAT - 0.012, lon: LON - 0.01 })];
const PHOTO = png(() => [120, 150, 90]);
async function route(r) {
  const u = r.request().url(), J = (o, st) => r.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
  if (/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery/.test(u)) { M.tileHits++; return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: SAT }); }
  if (/elevation-tiles-prod\/terrarium/.test(u)) { M.tileHits++; return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: DEM }); }
  if (/overpass/.test(u)) { M.overpassHits++; return M.overpassFail ? r.fulfill({ status: 504, body: 'busy' }) : J(OSM); }
  if (/static\.inaturalist\.org\/photos\//.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PHOTO });
  if (/api\.inaturalist\.org\/v1\/taxa\?/.test(u)) { const q = decodeURIComponent((u.match(/q=([^&]+)/) || [])[1] || ''); return J({ results: [{ id: /maura/i.test(q) ? 26093 : 30715, name: q }] }); }
  const det = u.match(/api\.inaturalist\.org\/v1\/observations\/(\d+)/);
  if (det) { const o = OBS.find((x) => x.id === +det[1]); return J({ total_results: o ? 1 : 0, page: 1, per_page: 1, results: o ? [o] : [] }); }
  if (/api\.inaturalist\.org\/v1\/observations\?/.test(u)) return J({ total_results: OBS.length, page: 1, per_page: 200, results: (/[?&]page=1(&|$)/.test(u) || !/page=/.test(u)) ? OBS : [] });
  return r.abort();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [label, vp] of [['desktop', { width: 1280, height: 860 }], ['phone', { width: 390, height: 844 }]]) {
    const phone = vp.width < 600;
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.route(/^https?:\/\/(?!localhost)/, route);
    await p.addInitScript(() => { for (const k of ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen']) localStorage.setItem(k, '1'); localStorage.setItem('sl-consent', 'essential'); window.SL_3D_TEST = true; });
    await p.goto(BASE + 'index.html?tab=map', { waitUntil: 'load' });
    await p.waitForFunction(() => window.SL_MAP_GEO_DONE, null, { timeout: 90000 });
    ok(await p.evaluate(() => ![].some.call(document.scripts, (s) => /spot\.js|daynight\.js/.test(s.src)) && !performance.getEntriesByType('resource').some((e) => /spot\.js|daynight\.js|arcgisonline|terrarium|overpass/.test(e.name))), `${label}: nothing of See the spot is loaded with the page`);
    await p.evaluate(([la, lo]) => window.SL_FLY_BOX(lo - 0.05, lo + 0.05, la - 0.04, la + 0.04), [LAT, LON]); await p.waitForTimeout(600);
    await p.click('#sg-toggle'); await p.waitForTimeout(2500);
    const openDot = async (id) => {
      const d = await p.evaluate(() => window.SL_SG_DEBUG()), dot = d.dots.find((o) => o.id === id);
      if (!dot) return false;
      const r = await p.evaluate((y) => { let c = document.getElementById('globe').getBoundingClientRect(); if (c.top + y < 40 || c.top + y > innerHeight - 40) { window.scrollBy(0, c.top + y - innerHeight / 2); c = document.getElementById('globe').getBoundingClientRect(); } return [c.left, c.top]; }, dot.y);
      await p.waitForTimeout(150); await p.mouse.click(r[0] + dot.x, r[1] + dot.y); await p.waitForTimeout(900);
      return p.evaluate(() => !document.getElementById('sg-pop').hidden);
    };
    ok(await openDot(101), `${label}: a sighting opens its big view`);
    const btns = await p.evaluate(() => { const a = document.querySelector('#sg-pop .sgc-acts'); return a ? [].map.call(a.querySelectorAll('button, a'), (x) => x.textContent.trim()) : []; });
    ok(btns.indexOf('See the spot') >= 0 && btns.indexOf('Explore in 3D') < 0, `${label}: the card has "See the spot" (v6.28 L9: in place of Explore in 3D) (${btns.join(' | ')})`);
    // v6.28: the 3D viewer and See the spot are fetched ahead once the card shows (so pressing it opens sooner) - but no place data
    await p.waitForTimeout(1500);
    ok(await p.evaluate(() => !performance.getEntriesByType('resource').some((e) => /arcgisonline|terrarium|overpass/.test(e.name))), `${label}: nothing of the place is fetched before the press`);
    // the press: busy at once, the panel opens at once
    const busy = await p.evaluate(() => { const b2 = document.querySelector('.sgv-spot'); b2.click(); return { busy: b2.getAttribute('aria-busy') === 'true', txt: b2.textContent.trim(), panel: !!document.querySelector('.sl3d-bd .sl3d-ov.sl3d-spot') }; });
    ok(busy.busy && /Opening/.test(busy.txt) && busy.panel, `${label}: the button responds at once (busy, "${busy.txt}") and the 3D panel opens`);
    await p.waitForFunction(() => window.__slSpot && document.querySelector('.sp3d-busy') && document.querySelector('.sp3d-busy').hidden, null, { timeout: 180000 });
    const s1 = await p.evaluate(() => window.__slSpot);
    ok(s1.roads >= 1 && s1.waters >= 1 && s1.onRoad && s1.dem && s1.osm && s1.zNear >= 17 && s1.extent > 200, `${label}: the real place is built (${JSON.stringify(s1)})`);
    ok(M.overpassHits >= 1 && M.tileHits >= 20, `${label}: satellite, land-height and OpenStreetMap data asked for (${M.tileHits} tiles, ${M.overpassHits} Overpass)`);
    const ui = await p.evaluate(() => ({ card: (document.querySelector('.spot-card') || {}).textContent || '', credit: (document.querySelector('.spot-credit') || {}).textContent || '',
      dnP: document.querySelector('.sp3d-dn') && document.querySelector('.sp3d-dn').getAttribute('aria-pressed'),
      shown: [].filter.call(document.querySelectorAll('.sl3d-ov button'), (x) => x.offsetParent !== null && !x.closest('.spot-card') && !x.closest('.sp3d-side') && !x.classList.contains('sl3d-x') && !x.classList.contains('sl3d-back')).map((x) => x.getAttribute('aria-label') || x.textContent.trim()),
      side: (document.querySelector('.sp3d-side:not([hidden]) img') || {}).src || '', cardPh: !!document.querySelector('.spot-card .spot-ph img'),
      ground: !!(window.__sp3d && window.__sp3d.scene.getObjectByName('spot-ground')), road: !!(window.__sp3d && window.__sp3d.scene.getObjectByName('spot-road')), water: !!(window.__sp3d && window.__sp3d.scene.getObjectByName('spot-water')) }));
    ok(/Place of 101/.test(ui.card) && /Observer 101/.test(ui.card) && /2024/.test(ui.card) && /within about 8 m/.test(ui.card), `${label}: the card: place, date, observer and accuracy`);
    ok(/Esri/.test(ui.credit) && /AWS Terrain Tiles/.test(ui.credit) && /OpenStreetMap/.test(ui.credit), `${label}: imagery, land height and OpenStreetMap are credited`);
    ok(ui.ground && ui.road && ui.water, `${label}: ground, road surface and water are in the scene`);
    ok(ui.dnP === 'false', `${label}: a morning sighting opens by day (lit for its own time)`);
    ok(ui.shown.length === 1 && /Fullscreen/.test(ui.shown[0]), `${label}: no buttons but Fullscreen in See the spot - no Day/Night, See the area, Compare photo... (${ui.shown.join(' | ')})`);
    ok(/photos\/101-0\/large\./.test(ui.side) && ui.cardPh, `${label}: the sighting's OWN photo is shown beside the place (Compare photo) and in the card (${ui.side.slice(-40)})`);
    if (SHOTS) await p.screenshot({ path: SHOTS + `/spot-${label}-day.png`, timeout: 120000 });
    // close: everything goes, the sighting is still there
    await p.evaluate(() => document.querySelector('.sl3d-ov .sl3d-x').click()); await p.waitForTimeout(500);
    ok(await p.evaluate(() => !document.querySelector('.sl3d-bd') && !document.querySelector('canvas.sp3d-canvas') && !window.__sp3d && !document.getElementById('sg-pop').hidden), `${label}: closing lets the 3D view go and returns to the sighting`);
    // an evening sighting opens at night by itself
    await p.evaluate(() => { const x = document.querySelector('#sg-pop .sg-x'); if (x) x.click(); });
    if (await openDot(102)) {
      await p.evaluate(() => document.querySelector('.sgv-spot').click());
      await p.waitForFunction(() => window.__slSpot && document.querySelector('.sp3d-busy') && document.querySelector('.sp3d-busy').hidden, null, { timeout: 180000 });
      ok(await p.evaluate(() => document.querySelector('.sp3d-dn').getAttribute('aria-pressed') === 'true' && /after dark/.test(document.querySelector('.spot-card').textContent)), `${label}: a sighting at 23:10 opens at night ("seen after dark")`);
      await p.evaluate(() => document.querySelector('.sl3d-ov .sl3d-x').click()); await p.waitForTimeout(400);
      await p.evaluate(() => { const x = document.querySelector('#sg-pop .sg-x'); if (x) x.click(); });
    } else ok(false, `${label}: the evening sighting's dot`);
    // obscured, with Overpass failing
    M.overpassFail = true;
    await p.evaluate(() => { try { Object.keys(localStorage).filter((k) => /^sl-spot-osm:/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (e) {} });
    if (await openDot(103)) {
      await p.evaluate(() => document.querySelector('.sgv-spot').click());
      await p.waitForFunction(() => window.__slSpot && document.querySelector('.sp3d-busy') && document.querySelector('.sp3d-busy').hidden, null, { timeout: 180000 });
      const o = await p.evaluate(() => ({ card: document.querySelector('.spot-card').textContent, s: window.__slSpot, pin: document.querySelector('.spot-pin').textContent }));
      ok(/hidden to protect the snake/.test(o.card) && /general area/.test(o.card) && /Somewhere here/.test(o.pin), `${label}: obscured: says the exact spot is hidden and shows the general area`);
      ok(!o.s.osm && o.s.roads === 0 && /couldn't load just now/.test(o.card), `${label}: Overpass failing: the spot still opens, without roads, and says so`);
      if (SHOTS) await p.screenshot({ path: SHOTS + `/spot-${label}-obscured.png`, timeout: 120000 });
      await p.evaluate(() => document.querySelector('.sl3d-ov .sl3d-x').click()); await p.waitForTimeout(400);
    } else ok(false, `${label}: the obscured sighting's dot`);
    M.overpassFail = false;
    // the plain viewer has Night too
    await p.evaluate(() => { const x = document.querySelector('#sg-pop .sg-x'); if (x) x.click(); });
    await p.evaluate(() => window.SL_3D.panel('natrix-maura', null, 'Viperine Water Snake'));
    await p.waitForFunction(() => document.querySelector('.sl3d-ov .sp3d-dn') && document.querySelector('.sp3d-busy') && document.querySelector('.sp3d-busy').hidden, null, { timeout: 180000 });
    ok(await p.evaluate(() => !document.querySelector('.spot-card') && !document.querySelector('.spot-area')), `${label}: Explore in 3D: no spot pieces in the plain viewer`);
    await p.evaluate(() => document.querySelector('.sp3d-dn').click()); await p.waitForTimeout(1500);
    ok(await p.evaluate(() => document.querySelector('.sp3d-dn').getAttribute('aria-pressed') === 'true' && window.__sp3d.scene.getObjectByName('sl-stars')), `${label}: Explore in 3D: Night works in the plain viewer`);
    if (SHOTS) await p.screenshot({ path: SHOTS + `/viewer-${label}-night.png`, timeout: 120000 });
    await p.evaluate(() => document.querySelector('.sl3d-ov .sl3d-x').click());
    ok(errs.length === 0, `${label}: no page errors (${errs.slice(0, 3).join(' | ')})`);
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
