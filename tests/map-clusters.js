// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT, default 8766), then
//   PORT=<port> node tests/map-clusters.js [screenshot-dir]
// batch109 - map sightings at world scale. iNaturalist is MOCKED (its map tiles api/v1/points/z/x/y.grid.json, the
// per_page=0 count and /observations/{id}), with crowded tiles so the whole world is covered in dots. Checks:
//  - zoomed out, crowded dots are drawn as groups (bigger dots), every sighting either a single dot or in a group;
//    clicking a group zooms in to it (an Undo step) and the groups split into dots
//  - dots at one exact spot, as close as the map goes: a group that fans out on click (spiderfy), each one opens its
//    own record, and a click on empty map folds them back
//  - the counts say what they are: iNaturalist's total in view, the dots shown (a sample), the groups; a count that
//    can't load says so; "Most favourited sighting" names favourites; "Zoom out to all sightings"
//  - stale answers: tiles for a view left behind are called off, and a slow answer for the old snakes never lands on
//    the new ones; loading is shown; a failed tile says so with Retry, and Retry loads it
//  - the selected dot is marked; Escape closes only the card (not full screen), and the keyboard goes back to the map
//  - PREVIEW "sightings": a docked panel (a bottom sheet on a phone) with the whole photo (object-fit contain), swipe and
//    "1 / 2", one main name with "also called", Seen / Where / Found by / Quality / Source in that order, View species and
//    See the spot, the photo licence apart from the record licence, Close keeping the dot picked and the map where it
//    was, a compact key that opens and closes, a chip row, numbers on the groups, and a taller map on a phone; with the
//    preview off none of it shows.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://localhost:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const PILE = { lon: 10.5123, lat: 45.5123, n: 5 }; // (five sightings at one exact spot)

const M = { tileDelay: 0, slowTaxon: '', failTiles: 0, countFail: false, tileUrls: [], aborted: [], where: {} };
function obs(id, lon, lat) {
  return { id, uri: 'https://www.inaturalist.org/observations/' + id, quality_grade: 'research', observed_on: '2025-04-0' + (1 + id % 9),
    time_observed_at: '2025-04-0' + (1 + id % 9) + 'T10:15:00+01:00', observed_time_zone: 'Europe/Lisbon', created_at: '2025-05-01T08:00:00+00:00',
    user: { id: 9, login: 'obs' + id, name: 'Observer ' + id }, place_guess: 'Place of ' + id, positional_accuracy: 30, license_code: 'cc-by',
    taxon: { id: 26093, name: 'Natrix maura', rank: 'species', preferred_common_name: 'Viperine Water Snake' },
    geojson: { type: 'Point', coordinates: [lon, lat] }, faves_count: 2, description: 'Long notes ' + 'about the snake. '.repeat(30),
    photos: [{ id: id * 10, url: 'https://static.inaturalist.org/photos/' + id + '-0/square.jpg', attribution: '(c) Observer ' + id + ', some rights reserved (CC BY-NC)', license_code: 'cc-by-nc' },
      { id: id * 10 + 1, url: 'https://static.inaturalist.org/photos/' + id + '-1/square.jpg', attribution: '(c) Observer ' + id + ', no rights reserved (CC0)', license_code: 'cc0' }] };
}
async function route(r) {
  const u = r.request().url();
  const J = (o, st) => r.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
  if (/static\.inaturalist\.org\/photos\//.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  if (/api\.inaturalist\.org\/v1\/taxa\?/.test(u)) { const q = decodeURIComponent((u.match(/q=([^&]+)/) || [])[1] || ''); return J({ results: [{ id: /latastei/i.test(q) ? 30715 : 26093, name: q }] }); }
  const tm = u.match(/api\.inaturalist\.org\/v1\/points\/(\d+)\/(\d+)\/(\d+)\.grid\.json/);
  if (tm) {
    M.tileUrls.push(u);
    const lat = /taxon_id=30715/.test(u); // (Lataste's viper: its own ids, 3000000+)
    if (M.tileDelay) await new Promise(res => setTimeout(res, M.tileDelay));
    if (M.slowTaxon && u.includes(M.slowTaxon)) await new Promise(res => setTimeout(res, 3000));
    if (M.failTiles > 0) { M.failTiles--; return J({ error: 'boom' }, 500); }
    const z = +tm[1], x = +tm[2], y = +tm[3], n = 2 ** z, lon0 = x / n * 360 - 180, lon1 = (x + 1) / n * 360 - 180;
    const la = (yy) => Math.atan(Math.sinh(Math.PI * (1 - 2 * yy / n))) * 180 / Math.PI, la0 = la(y + 1), la1 = la(y);
    const data = {}, base = (lat ? 3000000 : 1000000) + z * 100000 + ((x * 131 + y * 71) % 997) * 100;
    // land only, roughly (keeps the seas empty): a crowded hot spot or two per tile, and some scattered dots
    const per = z <= 3 ? 70 : z <= 6 ? 30 : 12;
    for (let i = 0; i < per; i++) {
      const hot = i < per * 0.7, cx = 0.3 + 0.4 * ((x * 7 + y * 3) % 5) / 5, cy = 0.3 + 0.4 * ((x * 3 + y * 5) % 5) / 5;
      const fx = hot ? cx + ((i * 0.618) % 1 - 0.5) * 0.06 : (i * 0.618 + 0.1) % 1, fy = hot ? cy + ((i * 0.414) % 1 - 0.5) * 0.06 : (i * 0.414 + 0.1) % 1;
      const lo = +(lon0 + (lon1 - lon0) * fx).toFixed(5), lt = +(la0 + (la1 - la0) * fy).toFixed(5);
      if (lt > 75 || lt < -55) continue;
      const id = base + i; M.where[id] = [lo, lt];
      data[id] = { id, latitude: lt, longitude: lo, cellCount: 1, quality_grade: 'research', geoprivacy: null, private_location: null };
    }
    if (!lat && PILE.lon >= lon0 && PILE.lon < lon1 && PILE.lat <= la1 && PILE.lat > la0) for (let k = 0; k < PILE.n; k++) { const id = 990000 + k; M.where[id] = [PILE.lon, PILE.lat]; data[id] = { id, latitude: PILE.lat, longitude: PILE.lon, cellCount: 1, quality_grade: 'research' }; }
    return J({ grid: [], keys: [], data });
  }
  const det = u.match(/api\.inaturalist\.org\/v1\/observations\/(\d+)/);
  if (det) { const id = +det[1], w = M.where[id] || [0, 0]; return J({ total_results: 1, page: 1, per_page: 1, results: [obs(id, w[0], w[1])] }); }
  if (/api\.inaturalist\.org\/v1\/observations\?/.test(u)) {
    if (/per_page=0/.test(u)) return M.countFail ? J({ error: 'boom' }, 500) : J({ total_results: 2345678, results: [] });
    return J({ total_results: 0, page: 1, per_page: 1, results: [] });
  }
  return r.abort();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const open = async (vp, preview) => {
    const phone = vp.width < 600;
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    p.on('requestfailed', rq => { if (/points\/\d+/.test(rq.url())) M.aborted.push(rq.url()); });
    await p.route(/^https?:\/\/(?!localhost)/, route);
    await p.addInitScript(() => { ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen'].forEach(k => localStorage.setItem(k, '1')); localStorage.setItem('sl-consent', 'essential'); });
    await p.goto(BASE + 'index.html?tab=map' + (preview ? '&preview=' + preview : '&preview=sightings-off'), { waitUntil: 'load' });
    await p.waitForFunction(() => window.SL_MAP_GEO_DONE, null, { timeout: 90000 });
    await p.waitForTimeout(800);
    return { ctx, p, errs };
  };
  const dbg = p => p.evaluate(() => window.SL_SG_DEBUG());
  const shot = async (p, name) => { if (SHOTS) { await p.evaluate(() => document.getElementById('globe').scrollIntoView({ block: 'center' })); await p.screenshot({ path: SHOTS + '/' + name + '.png' }); } };
  const tap = (p, x, y) => p.evaluate(a => window.SL_MAP_TAP(a[0], a[1]), [x, y]);
  const click = async (p, x, y) => {
    const r = await p.evaluate((y) => { let c = document.getElementById('globe').getBoundingClientRect();
      if (c.top + y < 40 || c.top + y > innerHeight - 40) { window.scrollBy(0, c.top + y - innerHeight / 2); c = document.getElementById('globe').getBoundingClientRect(); }
      return [c.left, c.top]; }, y);
    await p.waitForTimeout(120); await p.mouse.click(r[0] + x, r[1] + y);
  };
  const view = p => p.evaluate(() => window.SL_MAP_VIEW());

  // ---------- desktop, preview off ----------
  {
    const { ctx, p, errs } = await open({ width: 1280, height: 860 });
    await p.click('#sg-toggle'); await p.waitForTimeout(2600);
    let d = await dbg(p);
    const inG = d.clusters.reduce((a, c) => a + c.n, 0);
    ok(d.mode === 'tiles' && d.clusters.length >= 10, 'world view: crowded dots are drawn as groups (' + d.clusters.length + ' groups, ' + d.dots.length + ' single dots)');
    ok(d.clusters.every(c => c.n >= 3), 'a group holds 3 or more dots');
    const onScreen = await p.evaluate(() => { const B = window.SL_MAP_VIEW(); return window.SL_SG_DEBUG().ids.length; });
    ok(inG + d.dots.length <= onScreen && inG > d.dots.length, 'every dot is drawn once - as a single dot or inside one group (' + inG + ' in groups + ' + d.dots.length + ' single)');
    const hint = await p.evaluate(() => document.getElementById('sg-hint').innerText);
    ok(/2,345,678 iNaturalist sightings in view/.test(hint) && /shown \(a sample/.test(hint) && /\d+ groups/.test(hint) && /group of nearby dots/.test(hint), 'the key says what each number counts: iNaturalist\'s total in view, the dots shown (a sample), the groups (' + hint.replace(/\s+/g, ' ') + ')');
    ok(!/One iNaturalist sighting[^·]*·\s*\d[\d,]* sightings in view/.test(hint), 'no "one sighting" next to "millions of sightings" without saying the dots are a sample');
    ok(await p.evaluate(() => /Most favourited sighting/.test(document.getElementById('sg-popular').textContent) && !/most view/i.test(document.getElementById('sg-popular').textContent) && /Zoom out to all sightings/.test(document.getElementById('sg-all').textContent)),
      'buttons say what they do: "Most favourited sighting" (favourites, never views) and "Zoom out to all sightings"');
    ok(await p.evaluate(() => !document.querySelector('.sg2-key:not([hidden]), .sg2-chips:not([hidden])') && !document.getElementById('globe-stage').classList.contains('sg2-on')), 'preview off: no compact key, no chip row (the map looks as before)');
    await shot(p, 'clusters-world-desktop');
    // a group clicked: the map zooms in to it, and it splits
    const v0 = await view(p), G = d.clusters.filter(c => c.x > 100 && c.x < 1180 && c.y > 120 && c.y < 560).sort((a, c) => c.n - a.n)[0];
    await click(p, G.x, G.y); await p.waitForTimeout(2600);
    const v1 = await view(p); d = await dbg(p);
    // (the mock's closer tiles hold other dots, as iNaturalist's do: compare what is on screen now)
    const nowSingles = d.dots.length, biggest = Math.max(0, ...d.clusters.map(c => c.n));
    ok((v1.e - v1.w) < (v0.e - v0.w) / 4, 'clicking a group zooms the map in to it (' + (v0.e - v0.w).toFixed(1) + ' -> ' + (v1.e - v1.w).toFixed(2) + ' degrees wide)');
    ok(nowSingles > 0 && biggest < G.n, 'zoomed in, the groups split into dots (' + nowSingles + ' single dots; the biggest group ' + biggest + ', was ' + G.n + ')');
    ok(await p.evaluate(() => !!document.getElementById('map-undo') && !document.getElementById('map-undo').disabled), 'the zoom is an Undo step');
    // the selected dot: opened, marked, its own record
    let one = d.dots.find(o => o.x > 80 && o.x < 900 && o.y > 140 && o.y < 600);
    if (!one) { const g2 = d.clusters[0]; await tap(p, g2.x, g2.y); await p.waitForTimeout(2400); d = await dbg(p); one = d.dots.find(o => o.x > 80 && o.x < 900 && o.y > 140 && o.y < 600); }
    await click(p, one.x, one.y); await p.waitForTimeout(1200);
    d = await dbg(p);
    ok(d.open === one.id && d.view, 'a single dot opens its own record, and it is the picked (ringed) dot (' + one.id + ')');
    // Escape: only the card - and focus back on the map
    await p.evaluate(() => document.querySelector('#sg-pop .sg-name').focus());
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.getElementById('sg-pop').hidden && document.activeElement === document.getElementById('globe')), 'Escape closes the card and the keyboard goes back to the map');
    await p.evaluate(() => window.scrollTo(0, 0)); await p.click('#globe-full'); await p.waitForTimeout(1200);
    d = await dbg(p); one = d.dots[Math.floor(d.dots.length / 2)];
    await tap(p, one.x, one.y); await p.waitForTimeout(900);
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    const afterEsc = await p.evaluate(() => ({ card: document.getElementById('sg-pop').hidden, full: document.getElementById('globe-stage').classList.contains('full') }));
    ok(afterEsc.card && afterEsc.full, 'full screen: Escape closes only the card, the map stays full screen ' + JSON.stringify(afterEsc));
    await p.keyboard.press('Escape'); await p.waitForTimeout(500);
    ok(!(await p.evaluate(() => document.getElementById('globe-stage').classList.contains('full'))), 'a second Escape then leaves full screen');
    // the pile at one exact spot, as close as the map goes: a group that fans out
    await p.evaluate(a => window.SL_FLY_BOX(a.lon - 0.0006, a.lon + 0.0006, a.lat - 0.0004, a.lat + 0.0004), PILE); await p.waitForTimeout(2600);
    d = await dbg(p);
    const pg = d.clusters.find(c => c.ids.some(id => id >= 990000));
    ok(!!pg && pg.n === PILE.n, 'dots at one exact spot, fully zoomed in: one group (' + (pg ? pg.n : 0) + ' of ' + PILE.n + ')');
    if (pg) {
      await tap(p, pg.x, pg.y); await p.waitForTimeout(500);
      d = await dbg(p);
      const fan = d.dots.filter(o => o.id >= 990000);
      ok(d.spider === PILE.n && fan.length === PILE.n && fan.every((a, i) => fan.every((c, j) => i === j || Math.hypot(a.x - c.x, a.y - c.y) >= 14)), 'clicking it fans them out round the spot, each its own dot (' + fan.length + ')');
      await shot(p, 'clusters-spiderfy');
      const f3 = fan[2]; await tap(p, f3.x, f3.y); await p.waitForTimeout(900);
      ok((await dbg(p)).open === f3.id, 'a fanned-out dot opens its own record');
      await p.evaluate(() => document.querySelector('#sg-pop .sg-x').click()); await p.waitForTimeout(200);
      await tap(p, 30, 300); await p.waitForTimeout(300);
      ok((await dbg(p)).spider === 0, 'a click on empty map folds them back');
    }
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(errs.length === 0, 'no page errors (desktop)' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await ctx.close();
  }

  // ---------- stale answers, loading, failures ----------
  {
    const { ctx, p, errs } = await open({ width: 1280, height: 860 });
    await p.evaluate(() => window.SL_FLY_BOX(-10, 4, 36, 44)); await p.waitForTimeout(400);
    M.tileDelay = 2500; M.aborted = [];
    await p.click('#sg-toggle'); await p.waitForTimeout(700);
    const hl = await p.evaluate(() => document.getElementById('sg-hint').innerText + ' | ' + document.getElementById('sg-note').innerText);
    ok(/loading/i.test(hl), 'while the dots load, the map says so (' + hl.replace(/\s+/g, ' ').slice(0, 120) + ')');
    // the view moves on before its tiles arrive: those tiles are called off
    await p.evaluate(() => window.SL_FLY_BOX(100, 114, -10, -2)); await p.waitForTimeout(900);
    ok(M.aborted.length > 0, 'tiles for a view left behind are called off (' + M.aborted.length + ')');
    M.tileDelay = 0; await p.waitForTimeout(3000);
    let d = await dbg(p), vv = await view(p);
    ok(d.n > 0 && d.dots.concat(d.clusters).every(o => o.x > -30 && o.x < 1310), 'the new view gets its own dots (' + d.n + ')');
    // the snakes change while the old snakes' tiles are still on their way: only the new snakes' dots
    M.slowTaxon = 'taxon_id=26093';
    await p.fill('#heat-search', 'Natrix maura'); await p.keyboard.press('Enter'); await p.waitForTimeout(800);
    M.slowTaxon = '';
    await p.fill('#heat-search', 'Vipera latastei'); await p.keyboard.press('Enter'); await p.waitForTimeout(5000);
    d = await dbg(p);
    ok(d.n > 0 && d.ids.every(id => id >= 3000000 && id < 4000000), 'a slow answer for the old snakes never lands on the new ones (' + d.n + ' dots, all Lataste\'s viper)');
    // a failed tile: said, with Retry; Retry loads it
    await p.fill('#heat-search', ''); await p.waitForTimeout(1500);
    M.failTiles = 3; await p.evaluate(() => window.SL_FLY_BOX(-80, -66, 30, 40)); await p.waitForTimeout(3500);
    const note = await p.evaluate(() => document.getElementById('sg-note').innerText);
    ok(/couldn.t load|busy/i.test(note) && /Retry/.test(note), 'tiles that fail say so, with Retry (' + note.replace(/\s+/g, ' ') + ')');
    M.failTiles = 0;
    if (await p.$('#sg-note .sg-retry')) { await p.click('#sg-note .sg-retry'); await p.waitForTimeout(2500); }
    d = await dbg(p);
    ok(d.n > 0 && await p.evaluate(() => document.getElementById('sg-note').hidden), 'Retry loads them (' + d.n + ' dots)');
    // the count can't load: said so, not a silent old number
    M.countFail = true; await p.evaluate(() => window.SL_FLY_BOX(20, 34, -30, -20)); await p.waitForTimeout(3000);
    const h2 = await p.evaluate(() => document.getElementById('sg-hint').innerText);
    ok(/total for the view couldn.t load/.test(h2) && !/2,345,678/.test(h2), 'a count that couldn\'t load says so, never an old number (' + h2.replace(/\s+/g, ' ').slice(0, 160) + ')');
    M.countFail = false;
    ok(errs.length === 0, 'no page errors (stale)' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await ctx.close();
  }

  // ---------- PREVIEW "sightings", desktop ----------
  {
    const { ctx, p, errs } = await open({ width: 1280, height: 860 }, 'sightings');
    await p.evaluate(() => window.SL_FLY_BOX(-10, 4, 36, 44)); await p.waitForTimeout(300);
    await p.click('#sg-toggle'); await p.waitForTimeout(2600);
    ok(await p.evaluate(() => !document.getElementById('sg2-key').hidden && document.getElementById('sg2-key-body').hidden && getComputedStyle(document.getElementById('sg-hint')).display === 'none'), 'preview: a compact key (closed) instead of the long line');
    await p.click('.sg2-key-btn'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => { const k = document.getElementById('sg2-key-body'); return !k.hidden && /group of nearby dots/.test(k.innerText) && /not how many snakes live there/.test(k.innerText); }), 'preview: the key opens - dot, group, picked dot, and "not how many snakes live there"');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    ok(await p.evaluate(() => document.getElementById('sg2-key-body').hidden), 'preview: Escape closes the key');
    ok(await p.evaluate(() => /Snakes/.test(document.getElementById('sg2-chips').innerText) && !document.getElementById('sg2-chips').hidden), 'preview: the chip row says which snakes are shown');
    await p.fill('#heat-search', 'Natrix maura'); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
    ok(await p.evaluate(() => /Viperine|Natrix/.test(document.getElementById('sg2-chips').innerText) && !!document.querySelector('#sg2-chips .sg2-chip-x')), 'preview: a searched snake is a chip, with x to clear it');
    await p.click('#sg2-chips .sg2-chip-x'); await p.waitForTimeout(2200);
    ok(await p.evaluate(() => /all snakes/.test(document.getElementById('sg2-chips').innerText) && document.getElementById('heat-search').value === ''), 'preview: x clears the search - all snakes again');
    let d = await dbg(p);
    let one = d.dots.find(o => o.x > 120 && o.x < 700 && o.y > 160 && o.y < 600);
    if (!one) { await p.evaluate(() => window.SL_FLY_BOX(-9, -8, 39, 40)); await p.waitForTimeout(2500); d = await dbg(p); one = d.dots.find(o => o.x > 120 && o.x < 700 && o.y > 160 && o.y < 600); }
    const cam0 = await view(p);
    await click(p, one.x, one.y); await p.waitForTimeout(1500);
    const P = await p.evaluate(() => {
      const s = document.getElementById('sg-pop'), r = s.getBoundingClientRect(), st = document.getElementById('globe-stage').getBoundingClientRect(), im = s.querySelector('.sg-ph img');
      const dts = [].map.call(s.querySelectorAll('.sg2-facts dt'), x => x.textContent.trim());
      return { cls: s.className, right: Math.round(st.right - r.right), top: Math.round(r.top - st.top), w: Math.round(r.width), fit: im && getComputedStyle(im).objectFit, n: (s.querySelector('.sgc-n') || {}).textContent,
        name: s.querySelector('.sg-name').textContent, sci: (s.querySelector('.sg2-sci') || {}).textContent || '', dts, view: !!s.querySelector('.sg2-view'), spot: !!s.querySelector('.sgv-spot'),
        notesClosed: !!s.querySelector('details.sgc-more:not([open])'), focus: document.activeElement && document.activeElement.classList.contains('sg-name') };
    });
    ok(/sg2-pop/.test(P.cls) && P.right >= 40 && P.right < 80 && P.top <= 20 && P.w >= 320 && P.w <= 360, 'preview: the panel is docked at the side of the map, not floating over the dots ' + JSON.stringify({ right: P.right, top: P.top, w: P.w }));
    ok(P.fit === 'contain', 'preview: the photo is shown whole (object-fit: contain - no cut-off heads)');
    ok(P.n === '1 / 2', 'preview: "1 / 2" photo counter (' + P.n + ')');
    ok(P.name === 'Viperine Snake' && /Natrix maura/.test(P.sci) && /also called Viperine Water Snake/.test(P.sci), 'preview: one main name (SnakeList\'s), the other name small as "also called" (' + P.name + ' / ' + P.sci + ')');
    ok(P.dts.join(',') === 'Seen,Where,Found by,Quality,Source', 'preview: Seen, Where, Found by, Quality, Source - in that order (' + P.dts.join(',') + ')');
    ok(P.view && P.spot, 'preview: View species and See the spot buttons');
    ok(P.notesClosed && P.focus, 'preview: the long parts start folded away, and focus is on the panel\'s title');
    // swipe to the next photo
    const fr = await p.evaluate(() => { const r = document.querySelector('#sg-pop .sg2-frame').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await p.mouse.move(fr[0] + 60, fr[1]); await p.mouse.down(); await p.mouse.move(fr[0] - 40, fr[1], { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(250);
    ok(await p.evaluate(() => document.querySelector('#sg-pop .sgc-n').textContent === '2 / 2' && /-1\//.test(document.querySelector('#sg-pop .sg-ph img').getAttribute('src'))), 'preview: a swipe shows the next photo (2 / 2)');
    const lic = await p.evaluate(() => { const d = document.querySelector('#sg-pop details.sgc-more'); d.open = true; return [].map.call(d.querySelectorAll(':scope > dl > dt'), x => x.textContent + ' ' + x.nextElementSibling.textContent).join('\n'); });
    await p.waitForTimeout(300);
    ok(/Photo licence/.test(lic) && /Record licence\s*CC BY\b/.test(lic) && /CC BY-NC/.test(lic), 'preview: the photo licence is told apart from the record (data) licence (' + (lic.match(/Photo licence[^]*?Record licence[^\n]*\n?[^\n]*/) || [lic.slice(0, 200)])[0].replace(/\s+/g, ' ') + ')');
    ok(await p.evaluate(() => !!document.querySelector('#sg-pop details.sg2-notes:not([open])')), 'preview: long notes in their own folded section');
    // "Zoom the map here" then Close: the map goes back, the dot stays picked
    await p.evaluate(() => document.querySelector('#sg-pop .sgv-onmap').click()); await p.waitForTimeout(1200);
    const zoomed = await view(p);
    await p.evaluate(() => document.querySelector('#sg-pop .sg-x').click()); await p.waitForTimeout(900);
    const back = await view(p); d = await dbg(p);
    ok((zoomed.e - zoomed.w) < (cam0.e - cam0.w) / 3 && Math.abs((back.e - back.w) - (cam0.e - cam0.w)) < 0.05 * (cam0.e - cam0.w) && Math.abs(back.w - cam0.w) < 0.05 * (cam0.e - cam0.w), 'preview: Close puts the map back where it was when the panel opened');
    ok(d.sel === one.id && !d.view, 'preview: after Close the dot stays picked (ringed) (' + d.sel + ')');
    await shot(p, 'preview-key-chips-desktop');
    ok(errs.length === 0, 'no page errors (preview desktop)' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await ctx.close();
  }

  // ---------- phone: live height vs preview height, the sheet ----------
  let hLive = 0;
  {
    const { ctx, p } = await open({ width: 390, height: 844 });
    hLive = await p.evaluate(() => document.getElementById('globe').getBoundingClientRect().height);
    await ctx.close();
  }
  {
    const { ctx, p, errs } = await open({ width: 390, height: 844 }, 'sightings');
    const hPv = await p.evaluate(() => document.getElementById('globe').getBoundingClientRect().height);
    ok(hPv > hLive + 100, 'preview, phone: the map is taller (' + Math.round(hLive) + ' -> ' + Math.round(hPv) + ' px)');
    await p.evaluate(() => window.SL_FLY_BOX(-10, 4, 36, 44)); await p.waitForTimeout(300);
    await p.click('#sg-toggle'); await p.waitForTimeout(2600);
    let d = await dbg(p);
    let one = d.dots.find(o => o.y > 200 && o.y < 450);
    if (!one && d.clusters[0]) { await tap(p, d.clusters[0].x, d.clusters[0].y); await p.waitForTimeout(2500); d = await dbg(p); one = d.dots.find(o => o.y > 200 && o.y < 450) || d.dots[0]; }
    await tap(p, one.x, one.y); await p.waitForTimeout(1200);
    const S = await p.evaluate(() => { const s = document.getElementById('sg-pop'), r = s.getBoundingClientRect(), st = document.getElementById('globe-stage').getBoundingClientRect();
      return { sheet: s.classList.contains('sgc-sheet') && s.classList.contains('sg2-pop'), left: Math.round(r.left - st.left), right: Math.round(st.right - r.right), bottom: Math.round(st.bottom - r.bottom) }; });
    ok(S.sheet && S.left <= 1 && S.right <= 1 && S.bottom <= 1, 'preview, phone: a bottom sheet across the map ' + JSON.stringify(S));
    await shot(p, 'preview-sheet-phone');
    ok(errs.length === 0, 'no page errors (preview phone)' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
