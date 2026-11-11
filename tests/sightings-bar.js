// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT), then
//   PORT=<port> node tests/sightings-bar.js [screenshot-dir]
// Sightings dots are never hidden under the Sightings bar or the other map controls, and each dot
// opens its own observation. iNaturalist is MOCKED with the made-up records in
// tests/fixtures/inat-sightings.json (a 4 x 3 grid over central Portugal; 7005 has no photo).
// Checked on desktop (1280 x 900) and phone portrait (390 x 844), at two map zooms: every dot is
// the top element at its own position (nothing covers it), a tap opens the right record (id,
// observer, date, its own photo or "No photo"), a quick tap on a second dot while the first is
// still loading ends on the second dot's record and photo, and a record with no photo says so.
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
    const panel = () => p.evaluate(() => { const s = document.getElementById('sg-pop'); return s.hidden ? { t: '', im: [] } : { t: s.innerText, im: [].map.call(s.querySelectorAll('.sg-ph img'), i => i.getAttribute('src')) }; });
    const closePanel = () => p.evaluate(() => { const x = document.querySelector('#sg-pop .sg-x'); if (x) x.click(); });
    const rightRecord = (pn, id) => {
      const o = BY_ID[id], d = new Date(o.observed_on + 'T12:00:00Z');
      const dateOk = pn.t.includes(String(d.getUTCDate())) && pn.t.includes(String(d.getUTCFullYear()));
      const photoOk = o.photos.length ? pn.im.length > 0 && pn.im.every(s => s.includes('/photos/' + id + '-')) : /No photo available/.test(pn.t) && pn.im.length === 0;
      return pn.t.includes('#' + id) && pn.t.includes(o.user.name) && dateOk && photoOk;
    };
    for (const [zoom, box] of [['whole view', null], ['zoomed in', [-9.4, -8.6, 39.9, 40.4]]]) {
      if (box) { await closePanel(); await p.evaluate(bx => window.SL_FLY_BOX.apply(null, bx), box); await p.waitForTimeout(2200); }
      const d = await dbg();
      ok(d.dots.length >= 2,`${label}, ${zoom}: single dots on the map (${d.dots.length})`);
      const covered = [];
      for (const dot of d.dots) { const a = await at(dot); if (a.top !== 'canvas') covered.push(dot.id + ' under ' + a.top); }
      ok(covered.length === 0, `${label}, ${zoom}: no dot is covered by the bar or another control` + (covered.length ? ' - ' + covered.join(', ') : ''));
      const lap = await p.evaluate(() => { const b = document.getElementById('sg-bar').getBoundingClientRect(), c = document.getElementById('globe').getBoundingClientRect();
        return b.width > 0 && b.left < c.right && b.right > c.left && b.top < c.bottom && b.bottom > c.top; });
      ok(!lap, `${label}, ${zoom}: the Sightings bar sits off the map (no overlap with it)`);
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
      ok(/No photo available/.test(pn.t) && pn.im.length === 0 && pn.t.includes('#7005'), `${label}: the record with no photo says "No photo available" and shows no other picture`);
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
    // full screen: the bar is back on the map; drag the map so a dot sits right under the bar's
    // text, then tap it there - the tap must go through the bar and open that dot's record
    await closePanel();
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.click('#globe-full'); await p.waitForTimeout(1500);
    const onMap = await p.evaluate(() => !!document.querySelector('#globe-stage .map-tools #sg-bar'));
    ok(onMap, `${label}, full screen: the Sightings bar is on the map`);
    const bar = await p.evaluate(() => { const r = document.querySelector('#sg-bar .sg-bar-txt').getBoundingClientRect(); return { x: r.left + Math.min(60, r.width / 2), y: r.top + r.height / 2 }; });
    let dd = (await dbg()).dots;
    const cv = await p.evaluate(() => { const c = document.getElementById('globe').getBoundingClientRect(); return [c.left, c.top]; });
    const near = dd.map(x => ({ ...x, px: cv[0] + x.x, py: cv[1] + x.y })).sort((a, b2) => Math.hypot(a.px - bar.x, a.py - bar.y) - Math.hypot(b2.px - bar.x, b2.py - bar.y))[0];
    // drag from an empty-ish spot in the lower middle of the map by the needed amount
    const sx = vp.width / 2, sy = vp.height * 0.75;
    await p.mouse.move(sx, sy); await p.mouse.down();
    await p.mouse.move(sx + (bar.x - near.px) / 2, sy + (bar.y - near.py) / 2, { steps: 8 });
    await p.mouse.move(sx + bar.x - near.px, sy + bar.y - near.py, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(2500); await closePanel();
    dd = (await dbg()).dots;
    const target = dd.find(x => x.id === near.id);
    const under = target && await p.evaluate(([t, cv]) => { const r = document.getElementById('sg-bar').getBoundingClientRect(), x = cv[0] + t.x, y = cv[1] + t.y;
      return x > r.left && x < r.right && y > r.top && y < r.bottom ? { x, y, top: document.elementFromPoint(x, y) === document.getElementById('globe') } : null; }, [target, await p.evaluate(() => { const c = document.getElementById('globe').getBoundingClientRect(); return [c.left, c.top]; })]);
    if (!under) ok(false, `${label}, full screen: could not drag a dot under the bar to test it (dot ${near.id})`);
    else {
      ok(under.top, `${label}, full screen: a dot under the bar's text is reachable (the bar lets the tap through)`);
      if (SHOTS) await p.screenshot({ path: `${SHOTS}/sightings-${label}-fullscreen-dot-under-bar.png` });
      await p.mouse.click(under.x, under.y); await p.waitForTimeout(700);
      ok(rightRecord(await panel(), target.id), `${label}, full screen: tapping it opens that dot's own record (${target.id})`);
    }
    await closePanel();
    await p.click('#globe-full'); await p.waitForTimeout(800);
    ok(await p.evaluate(() => !!document.querySelector('#sg-dock #sg-bar') && !document.getElementById('sg-dock').hidden), `${label}: leaving full screen puts the bar back above the map`);
    ok(errs.length === 0, `${label}: no page errors` + (errs.length ? ' - ' + errs.join(' | ') : ''));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
})().catch(e => { console.error(e); process.exit(1); });
