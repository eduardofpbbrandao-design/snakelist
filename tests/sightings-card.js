// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT), then
//   PORT=<port> node tests/sightings-card.js [screenshot-dir]
// v4.63 Sightings: one button, one set of dots, one compact card. Each dot is reachable (nothing on
// top of it) and opens its own observation's card. iNaturalist is MOCKED with the made-up records in
// tests/fixtures/inat-sightings.json (a 4 x 3 grid over central Portugal; 7005 has no photo).
// Checked on desktop (1280 x 900) and phone portrait (390 x 844), at two map zooms: every dot is
// the top element at its own position (nothing covers it), a tap opens the right record (id,
// observer, date, its own photo or "No photo available for this sighting."), a quick tap on a second
// dot while the first is still loading ends on the second dot's record and photo, the card opens with
// its photo already loaded, and pressing Sightings again clears the dots.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const PORT = process.env.PORT || 8766, BASE = 'http://localhost:' + PORT + '/';
const SHOTS = process.argv[2] || null;
const FIX = require(path.join(__dirname, 'fixtures', 'inat-sightings.json')).results;
const BY_ID = {}; FIX.forEach(o => { BY_ID[o.id] = o; });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const SLOW = {};

async function route(r) {
  const u = r.request().url();
  const J = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
  if (/static\.inaturalist\.org\/photos\//.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  if (/api\.inaturalist\.org\/v1\/taxa\?/.test(u)) return J({ results: [{ id: 85553, name: 'Serpentes' }] });
  const det = u.match(/api\.inaturalist\.org\/v1\/observations\/(\d+)/);
  if (det) {
    const id = +det[1];
    if (SLOW[id]) await new Promise(res => setTimeout(res, SLOW[id]));
    return J(BY_ID[id] ? { total_results: 1, page: 1, per_page: 1, results: [BY_ID[id]] } : { total_results: 0, results: [] });
  }
  if (/api\.inaturalist\.org\/v1\/observations\?/.test(u)) {
    if (/per_page=0/.test(u)) return J({ total_results: FIX.length, results: [] });
    const q = new URL(u).searchParams, s = +q.get('swlat'), w = +q.get('swlng'), n = +q.get('nelat'), e = +q.get('nelng');
    const res = (+q.get('page') || 1) > 1 ? [] : FIX.filter(o => { const [lo, la] = o.geojson.coordinates; return la >= s && la <= n && lo >= w && lo <= e; });
    return J({ total_results: res.length, page: 1, per_page: 200, results: res });
  }
  return r.abort();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const phone = vp.width < 600;
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/^https?:\/\/(?!localhost)/, route);
    await p.addInitScript(() => { localStorage.setItem('sl-consent', 'essential'); localStorage.setItem('sl-tour-seen', '1'); localStorage.setItem('sl-news-off', '1'); });
    await p.goto(BASE + 'index.html?tab=map', { waitUntil: 'load' });
    await p.waitForFunction(() => window.SL_MAP_GEO_DONE, null, { timeout: 90000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => window.SL_FLY_BOX(-9.7, -7.4, 38.35, 40.45)); await p.waitForTimeout(600);
    await p.click('#sg-toggle'); await p.waitForTimeout(2200);
    const dbg = () => p.evaluate(() => window.SL_SG_DEBUG());
    // a dot's page position, scrolled into view first; and what element is on top there
    const at = async (dot) => p.evaluate((dot) => {
      const cv = document.getElementById('globe'); let c = cv.getBoundingClientRect();
      if (c.top + dot.y < 30 || c.top + dot.y > innerHeight - 30) { window.scrollBy(0, c.top + dot.y - innerHeight / 2); c = cv.getBoundingClientRect(); }
      const x = c.left + dot.x, y = c.top + dot.y, el = document.elementFromPoint(x, y);
      return { x, y, top: el === cv ? 'canvas' : (el ? (el.id || el.className || el.tagName) : 'none') };
    }, dot);
    const panel = () => p.evaluate(() => { const s = document.getElementById('sg-pop'), a = s.querySelector('a.sg-orig'), m = a && a.href.match(/observations\/(\d+)/);
      return s.hidden ? { t: '', im: [], id: null } : { t: s.innerText, id: m ? +m[1] : null, done: [].every.call(s.querySelectorAll('img'), i => i.complete), im: [].map.call(s.querySelectorAll('.sg-ph img'), i => i.getAttribute('src')) }; });
    const closePanel = () => p.evaluate(() => { const x = document.querySelector('#sg-pop .sg-x'); if (x) x.click(); });
    const rightRecord = (pn, id) => {
      const o = BY_ID[id], d = new Date(o.observed_on + 'T12:00:00Z');
      const dateOk = pn.t.includes(String(d.getUTCDate())) && pn.t.includes(String(d.getUTCFullYear()));
      const photoOk = o.photos.length ? pn.im.length === 1 && pn.im[0].includes('/photos/' + id + '-') && pn.done : /No photo available for this sighting\./.test(pn.t) && pn.im.length === 0;
      return pn.id === id && pn.t.includes('Seen by ' + o.user.name) && dateOk && photoOk && pn.t.includes(o.taxon.preferred_common_name);
    };
    for (const [zoom, box] of [['whole view', null], ['zoomed in', [-9.4, -8.6, 39.9, 40.4]]]) {
      if (box) { await closePanel(); await p.evaluate(bx => window.SL_FLY_BOX.apply(null, bx), box); await p.waitForTimeout(2200); }
      const d = await dbg();
      ok(d.dots.length >= 2,`${label}, ${zoom}: single dots on the map (${d.dots.length})`);
      const covered = [];
      for (const dot of d.dots) { const a = await at(dot); if (a.top !== 'canvas') covered.push(dot.id + ' under ' + a.top); }
      ok(covered.length === 0, `${label}, ${zoom}: no dot is covered by a control` + (covered.length ? ' - ' + covered.join(', ') : ''));
      if (SHOTS) await p.screenshot({ path: `${SHOTS}/sightings-${label}-${zoom.replace(' ', '-')}.png` });
      let good = 0, bad = [];
      for (const dot of d.dots) {
        await closePanel();
        const a = await at(dot); await p.waitForTimeout(80);
        await p.mouse.click(a.x, a.y); await p.waitForTimeout(500);
        const pn = await panel();
        if (rightRecord(pn, dot.id)) good++; else bad.push(dot.id + ': ' + pn.t.slice(0, 80).replace(/\s+/g, ' '));
      }
      ok(good === d.dots.length, `${label}, ${zoom}: every dot opens its own record - id, observer, date, own photo (${good}/${d.dots.length})` + (bad.length ? ' ' + bad.join(' | ') : ''));
    }
    // the record with no photo, and a quick switch between two dots (the first one slow)
    await closePanel(); await p.evaluate(() => window.SL_FLY_BOX(-9.7, -7.4, 38.35, 40.45)); await p.waitForTimeout(2200);
    const d = await dbg();
    const np = d.dots.find(x => x.id === 7005);
    if (np) {
      const a = await at(np); await p.mouse.click(a.x, a.y); await p.waitForTimeout(600);
      const pn = await panel();
      ok(/No photo available for this sighting\./.test(pn.t) && pn.im.length === 0 && pn.id === 7005, `${label}: the record with no photo says "No photo available for this sighting." and shows no other picture`);
      if (SHOTS) await p.screenshot({ path: `${SHOTS}/sightings-${label}-no-photo.png` });
    } else ok(false, `${label}: the no-photo record 7005 is on the map`);
    const [A, B] = d.dots.filter(x => x.id !== 7005).slice(0, 2);
    // tap X (slow to answer), then Y at once; on a phone the open panel covers the map, so the
    // panel is closed first (still within X's loading time), as a person would
    const quick = async (X, Y) => {
      await closePanel();
      const px = await at(X); await p.mouse.click(px.x, px.y); await p.waitForTimeout(120);
      let py = await at(Y);
      if (py.top !== 'canvas') { await closePanel(); py = await at(Y); }
      await p.mouse.click(py.x, py.y); await p.waitForTimeout(2400);
      return panel();
    };
    SLOW[A.id] = 1500;
    let pn = await quick(A, B);
    ok(rightRecord(pn, B.id) && pn.im.every(s => !s.includes('/photos/' + A.id + '-')), `${label}: quick switch A(slow) -> B ends on B with B's own photo`);
    delete SLOW[A.id]; SLOW[B.id] = 1500;
    pn = await quick(B, A);
    ok(rightRecord(pn, A.id) && pn.im.every(s => !s.includes('/photos/' + B.id + '-')), `${label}: quick switch back B(slow) -> A ends on A with A's own photo`);
    delete SLOW[B.id];
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/sightings-${label}-record.png` });
    // full screen: every dot is still reachable and opens its own record
    await closePanel();
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.click('#globe-full'); await p.waitForTimeout(1500);
    await p.evaluate(() => window.SL_FLY_BOX(-9.7, -7.4, 38.35, 40.45)); await p.waitForTimeout(2200);
    const fd = (await dbg()).dots; let fgood = 0; const fbad = [];
    for (const dot of fd) {
      await closePanel(); const a = await at(dot);
      if (a.top !== 'canvas') { fbad.push(dot.id + ' under ' + a.top); continue; }
      await p.mouse.click(a.x, a.y); await p.waitForTimeout(500);
      if (rightRecord(await panel(), dot.id)) fgood++; else fbad.push(dot.id);
    }
    ok(fd.length >= 2 && fgood === fd.length, `${label}, full screen: every dot reachable and opens its own record (${fgood}/${fd.length})` + (fbad.length ? ' ' + fbad.join(' | ') : ''));
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/sightings-${label}-fullscreen.png` });
    await closePanel();
    await p.click('#globe-full'); await p.waitForTimeout(800);
    // Sightings again: the layer goes off and its dots go
    await p.click('#sg-toggle'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => window.SL_SG_COUNT() === 0 && !document.getElementById('sg-toggle').classList.contains('on') && document.getElementById('sg-pop').hidden), `${label}: pressing Sightings again turns the layer off and clears the dots`);
    ok(errs.length === 0, `${label}: no page errors` + (errs.length ? ' - ' + errs.join(' | ') : ''));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
})().catch(e => { console.error(e); process.exit(1); });
