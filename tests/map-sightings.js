// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT, default 8766), then
//   PORT=<port> node tests/map-sightings.js [screenshot-dir]
// Needs Playwright with Chromium. iNaturalist is MOCKED (the build machine can't reach it): the mocks
// follow the documented API v1 shape of /observations (list, bounding box, paging, total_results)
// and /observations/{id}. Covers: one marker = one observation id, the right record and photos per
// marker, no stale photo after a quick second tap, no substitute photo, failures + Retry, deleted
// records, dedupe across pages, Load more, a species change while loading, clusters, Most/Fewest
// (ties, zeros), fossils kept out of living counts, Close vs Clear selection, Reset view, the
// Cameras layer, and the map state coming back after a species page.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://localhost:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// ---- the mock iNaturalist ------------------------------------------------------------------
const M = { listMode: 'ok', listDelay: 0, total: 450, slowIds: {}, failOnce: {}, gone: {}, brokenPhoto: {}, noPhoto: {}, listUrls: [], detailUrls: [], stack: {} };
function taxonFor(id, sci) {
  const t = sci || (id % 3 ? 'Natrix maura' : 'Vipera latastei');
  return { id: t === 'Natrix maura' ? 26093 : 30715, name: t, rank: 'species', preferred_common_name: t === 'Natrix maura' ? 'Viperine Water Snake' : "Lataste's Viper",
    default_photo: { medium_url: 'https://static.inaturalist.org/photos/TAXON-DEFAULT/medium.jpg', attribution: 'taxon default photo - must never be shown' } };
}
function obs(id, lon, lat, sci) {
  const o = { id, uri: 'https://www.inaturalist.org/observations/' + id, quality_grade: id % 4 ? 'research' : 'needs_id',
    observed_on: '2024-05-' + String(1 + id % 28).padStart(2, '0'), observed_on_details: { date: '2024-05-' + String(1 + id % 28).padStart(2, '0') },
    time_observed_at: '2024-05-' + String(1 + id % 28).padStart(2, '0') + 'T10:15:00+01:00', observed_time_zone: 'Europe/Lisbon',
    created_at: '2024-06-02T08:00:00+00:00', user: { login: 'obs' + id, name: 'Observer ' + id }, place_guess: 'Place of ' + id,
    positional_accuracy: 25 + id % 50, obscured: id % 7 === 0, geoprivacy: id % 7 === 0 ? 'obscured' : null, taxon: taxonFor(id, sci),
    geojson: { type: 'Point', coordinates: [lon, lat] }, description: id % 2 ? '<p>Notes for ' + id + '</p>' : null,
    annotations: id % 2 ? [{ controlled_attribute_id: 1, controlled_value_id: 2 }] : [],
    photos: M.noPhoto[id] ? [] : [{ id: id * 10, url: 'https://static.inaturalist.org/photos/' + id + '-0/square.jpg', attribution: '(c) Observer ' + id + ', some rights reserved (CC BY-NC)', license_code: 'cc-by-nc' },
      { id: id * 10 + 1, url: 'https://static.inaturalist.org/photos/' + id + '-1/square.jpg', attribution: '(c) Observer ' + id + ', no rights reserved (CC0)', license_code: 'cc0' }] };
  return o;
}
// deterministic observations spread over the requested box; page p holds ids p*100.. with an
// overlap of 20 ids with the page before (as when new uploads shift iNaturalist's pages)
function listFor(u) {
  const q = new URL(u).searchParams, s = +q.get('swlat'), w = +q.get('swlng'), n = +q.get('nelat'), e = +q.get('nelng'), page = +q.get('page') || 1, per = +q.get('per_page') || 200;
  const taxa = q.get('taxon_id') || '';
  const sci = /30715/.test(taxa) && !/26093/.test(taxa) ? 'Vipera latastei' : null;
  const base = sci ? 50000 : 1000;
  const res = [];
  const start = (page - 1) * per - (page > 1 ? 20 : 0);
  for (let i = start; i < Math.min(start + per, M.total); i++) {
    const id = base + i;
    const fx = ((i * 0.6180339) % 1), fy = ((i * 0.4142135) % 1);
    res.push(obs(id, +(w + (e - w) * (0.08 + 0.84 * fx)).toFixed(4), +(s + (n - s) * (0.08 + 0.84 * fy)).toFixed(4), sci));
  }
  if (page === 1 && M.stack.n) for (let k = 0; k < M.stack.n; k++) res.push(obs(90000 + k, M.stack.lon, M.stack.lat));
  return { total_results: M.total + (M.stack.n || 0), page, per_page: per, results: res };
}
async function route(r) {
  const u = r.request().url();
  const J = (o, st) => r.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
  if (/static\.inaturalist\.org\/photos\//.test(u)) {
    const id = +((u.match(/photos\/(\d+)-/) || [])[1]);
    if (/TAXON-DEFAULT/.test(u)) M.defaultPhotoAsked = true;
    if (M.brokenPhoto[id] > 0 && /medium/.test(u)) { M.brokenPhoto[id]--; return r.fulfill({ status: 404, body: '' }); }
    return r.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  }
  if (/api\.inaturalist\.org\/v1\/taxa\?/.test(u)) {
    const qq = decodeURIComponent((u.match(/q=([^&]+)/) || [])[1] || '');
    return J({ results: [{ id: /maura/i.test(qq) ? 26093 : /latastei/i.test(qq) ? 30715 : 1000 + qq.length, name: qq }] });
  }
  const det = u.match(/api\.inaturalist\.org\/v1\/observations\/(\d+)/);
  if (det) {
    const id = +det[1]; M.detailUrls.push(id);
    if (M.slowIds[id]) await new Promise(res => setTimeout(res, M.slowIds[id]));
    if (M.failOnce[id]) { M.failOnce[id]--; return J({ error: 'boom' }, 500); }
    if (M.gone[id]) return J({ total_results: 0, page: 1, per_page: 1, results: [] });
    const known = M.where && M.where[id];
    return J({ total_results: 1, page: 1, per_page: 1, results: [obs(id, known ? known[0] : 0, known ? known[1] : 0, id >= 50000 && id < 90000 ? 'Vipera latastei' : null)] });
  }
  if (/api\.inaturalist\.org\/v1\/observations\?/.test(u)) {
    M.listUrls.push(u);
    if (/per_page=0/.test(u)) return J({ total_results: 3, results: [] });
    if (M.listDelay) await new Promise(res => setTimeout(res, M.listDelay));
    if (M.listMode === 'fail') return J({ error: 'boom' }, 500);
    const d = listFor(u); M.where = M.where || {}; d.results.forEach(o => { M.where[o.id] = o.geojson.coordinates; });
    return J(d);
  }
  return r.abort();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const run = async (vp, theme, label) => {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: vp.width < 600, isMobile: vp.width < 600 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/^https?:\/\/(?!localhost)/, route);
    await p.addInitScript(th => {
      localStorage.setItem('sl-consent', 'essential'); localStorage.setItem('sl-tour-seen', '1'); localStorage.setItem('sl-news-off', '1');
      if (th) localStorage.setItem('sl-theme', th);
      // the Cameras layer's storage, mocked (Firebase can't be reached here): the real fields
      window.SL_CAM_API = { list: () => Promise.resolve([
        { id: 'c1', title: 'Stream camera', lat: 39.6, lon: -8.3, status: 'ok', uid: 'u1', showName: true, name: 'Ana', at: '2026-11-01T10:00:00Z', media: [{ kind: 'photo', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', species: 'Natrix maura', date: '2026-11-01' }] },
        { id: 'c2', title: 'Garden cam', lat: 38.4, lon: -7.6, status: 'ok', uid: 'u2', live: 'https://www.youtube.com/watch?v=x', media: [] },
        { id: 'c3', title: 'Bare spot', lat: 40.9, lon: -8.0, status: 'ok', uid: 'u3', media: [] }]), save: () => Promise.reject(new Error('signin')), setStatus: () => Promise.resolve(), remove: () => Promise.resolve(), me: () => null, creator: () => false };
    }, theme);
    await p.goto(BASE + 'index.html?tab=map', { waitUntil: 'load' });
    await p.waitForFunction(() => window.SL_MAP_GEO_DONE, null, { timeout: 90000 });
    if (theme) await p.evaluate(th => { document.documentElement.setAttribute('data-sl-theme', th); }, theme);
    await p.waitForTimeout(1200);
    return { ctx, p, errs };
  };
  const shot = async (p, name, el) => { if (!SHOTS) return; const t = el ? await p.$(el) : null; await (t || p).screenshot({ path: SHOTS + '/' + name + '.png' }); };
  const dbg = p => p.evaluate(() => window.SL_SG_DEBUG());
  const cvClick = async (p, x, y) => { const r = await p.evaluate(() => { const c = document.getElementById('globe').getBoundingClientRect(); return [c.left, c.top]; }); await p.mouse.click(r[0] + x, r[1] + y); };
  const panelText = p => p.evaluate(() => { const s = document.getElementById('sg-pop'); return s.hidden ? '' : s.innerText; });
  const panelImgs = p => p.evaluate(() => [].map.call(document.querySelectorAll('#sg-pop .sg-ph img'), i => i.getAttribute('src')));

  // ================= desktop, light =================
  let { ctx, p, errs } = await run({ width: 1280, height: 900 }, 'light');
  await p.evaluate(() => window.SL_FLY_BOX(-10, -6, 37, 42.2)); await p.waitForTimeout(500);
  await shot(p, 'desktop-light-sightings-off', '#globe-stage');
  await p.click('#sg-toggle'); await p.waitForTimeout(2500);
  let d = await dbg(p);
  const firstList = M.listUrls[M.listUrls.length - 1] || '';
  ok(/swlat=/.test(firstList) && /nelng=/.test(firstList) && /per_page=200/.test(firstList) && /page=1/.test(firstList), 'sightings load for the view (bounding box), 200 per page');
  ok(d.n === 200 && d.total === 450, 'first page: 200 observations of 450 (' + d.n + ' of ' + d.total + ')');
  let bar = await p.evaluate(() => document.getElementById('sg-bar').innerText);
  ok(/200 observations on the map/.test(bar) && /newest 200 of 450/.test(bar), 'the bar says "N of M" honestly: ' + bar.replace(/\s+/g, ' '));
  ok(!/live/i.test(bar), 'the bar never calls the records live');
  ok(await p.evaluate(() => document.getElementById('sg-toggle').innerText.trim()) === 'Sightings', 'the button label is just "Sightings"');
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('sg-toggle')).backgroundColor) === 'rgb(11, 106, 99)', 'Sightings on: deep teal, not red');
  ok(await p.evaluate(() => !document.querySelector('#sg-key input, #cam-key input')), 'no tick boxes in the legends (one toggle per layer)');
  ok(await p.evaluate(() => document.querySelectorAll('#sg-toggle').length === 1 && !document.querySelector('.sg-key2')), 'one Sightings toggle only');
  await shot(p, 'desktop-light-sightings-on', '#globe-stage');
  // Load more: page 2 overlaps page 1 by 20 ids -> deduped
  await p.click('#sg-more'); await p.waitForTimeout(1500);
  d = await dbg(p);
  ok(new Set(d.ids).size === d.ids.length, 'no duplicate observation ids after Load more (' + d.ids.length + ')');
  ok(d.n === 380 && d.page === 2, 'Load more added page 2 without the 20 repeated ids (' + d.n + ')');
  ok(M.listUrls.some(u => /page=2/.test(u)), 'Load more asked for &page=2');
  // options panel
  await p.click('#sg-opt-btn'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.getElementById('sg-opts').hidden && /Observed/.test(document.getElementById('sg-opts').textContent)), 'options panel opens with the date range');
  await shot(p, 'desktop-light-options', '#globe-stage');
  await p.check('#sg-opts input[value="y1"]'); await p.waitForTimeout(1500);
  ok(/&d1=\d{4}-\d{2}-\d{2}/.test(M.listUrls[M.listUrls.length - 1]), 'a date range adds d1= to the request');
  await p.check('#sg-opts input[value="any"]'); await p.waitForTimeout(1500);
  await p.keyboard.press('Escape');
  // the right record per marker: tap single dots, compare the panel with the marker's own id
  await p.evaluate(() => window.SL_FLY_BOX(-9, -8, 39, 40)); await p.waitForTimeout(1500);
  d = await dbg(p);
  ok(d.dots.length >= 3, 'single markers at close zoom (' + d.dots.length + ')');
  let good = 0;
  for (const dot of d.dots.slice(0, 3)) {
    await cvClick(p, dot.x, dot.y); await p.waitForTimeout(700);
    const t = await panelText(p), im = await panelImgs(p);
    const okRec = t.includes('Observation #' + dot.id) && t.includes('Observer ' + dot.id) && (im.length ? im[0].includes('/photos/' + dot.id + '-0/medium.') : /No photo available/.test(t));
    if (okRec) good++; else console.log('   wrong panel for', dot.id, t.slice(0, 200), im);
  }
  ok(good === 3, 'each marker opens its own observation (id, observer, its own photo)');
  const t1 = await panelText(p);
  ok(/Observed/.test(t1) && /Lisbon time/.test(t1) && /Uploaded/.test(t1) && /Quality/.test(t1) && /Place of/.test(t1), 'panel: observed date+time with time zone, uploaded date, quality, locality');
  ok(/CC BY-NC/.test(t1) && /\(c\) Observer/.test(t1), 'panel: photo attribution and licence');
  ok(await p.evaluate(() => [].some.call(document.querySelectorAll('#sg-pop a'), a => /inaturalist\.org\/observations\/\d+/.test(a.href)) && [].some.call(document.querySelectorAll('#sg-pop a'), a => /species\//.test(a.href))), 'panel: link to the observation and a separate SnakeList species link');
  await shot(p, 'desktop-light-observation', '#globe-stage');
  // no stale photo: A is slow, B is quick; the panel must end on B, and never show A's photo
  const A = d.dots[3], B = d.dots[4];
  M.slowIds[A.id] = 2000;
  await cvClick(p, A.x, A.y); await p.waitForTimeout(150);
  ok(/Loading observation/.test(await panelText(p)) && (await panelImgs(p)).length === 0, 'a new tap empties the panel and shows Loading (no old photo)');
  await cvClick(p, B.x, B.y); await p.waitForTimeout(2600);
  let tB = await panelText(p), imB = await panelImgs(p);
  ok(tB.includes('#' + B.id) && !tB.includes('#' + A.id) && imB.every(s => !s.includes('/photos/' + A.id + '-')), 'the slow answer for the first tap is ignored (panel shows ' + B.id + ')');
  // no substitute photo
  const C = d.dots[5]; M.noPhoto[C.id] = 1;
  await cvClick(p, C.x, C.y); await p.waitForTimeout(800);
  ok(/No photo available for this observation/.test(await panelText(p)) && (await panelImgs(p)).length === 0 && !M.defaultPhotoAsked, 'no photo: says so, and no species/default photo is used');
  // a photo that fails to load: message + Retry, no other picture
  const Dd = d.dots[6]; M.brokenPhoto[Dd.id] = 1;
  await cvClick(p, Dd.x, Dd.y); await p.waitForTimeout(900);
  ok(/This photo couldn.t load/.test(await panelText(p)), 'a broken photo says so, with Retry');
  await p.click('#sg-pop .sg-ph-retry'); await p.waitForTimeout(700);
  ok(!/This photo couldn.t load/.test(await panelText(p)), 'photo Retry loads it');
  // detail request fails -> Retry
  const E = d.dots[7]; M.failOnce[E.id] = 1;
  await cvClick(p, E.x, E.y); await p.waitForTimeout(900);
  ok(/Couldn.t load this observation/.test(await panelText(p)), 'a failed observation request shows an error with Retry');
  await p.click('#sg-pop .sg-retry2'); await p.waitForTimeout(900);
  ok((await panelText(p)).includes('Observation #' + E.id), 'Retry loads the observation');
  // cached: a second open makes no new request
  const nDet = M.detailUrls.length; await cvClick(p, B.x, B.y); await p.waitForTimeout(400);
  ok(M.detailUrls.length === nDet && (await panelText(p)).includes('#' + B.id), 'observations are cached by id');
  // deleted record
  const G = d.dots[8]; M.gone[G.id] = 1; const nBefore = (await dbg(p)).n;
  await cvClick(p, G.x, G.y); await p.waitForTimeout(900);
  ok(/no longer on iNaturalist/.test(await panelText(p)) && (await dbg(p)).n === nBefore - 1, 'a deleted observation says so and leaves the map');
  await p.click('#sg-pop .sg-x');
  // clusters: 6 observations stacked on one spot
  M.stack = { n: 6, lon: -8.5, lat: 39.5 };
  await p.evaluate(() => window.SL_FLY_BOX(-10, -6, 37, 42.2)); await p.waitForTimeout(1800);
  d = await dbg(p);
  ok(d.clusters.length > 0, 'nearby observations are drawn as numbered clusters (' + d.clusters.length + ')');
  await shot(p, 'desktop-light-clusters', '#globe-stage');
  await p.evaluate(() => window.SL_FLY_BOX(-8.52, -8.48, 39.49, 39.51)); await p.waitForTimeout(1800);
  d = await dbg(p);
  const stackC = d.clusters.find(c => c.n >= 6);
  ok(!!stackC, 'observations at one exact spot stay one cluster at close zoom');
  if (stackC) { await cvClick(p, stackC.x, stackC.y); await p.waitForTimeout(500); }
  ok(/observations at this exact spot/.test(await panelText(p)), 'tapping a cluster that cannot split lists its observations');
  await p.click('#sg-pop [data-oid]'); await p.waitForTimeout(800);
  ok(/Observation #9000\d/.test(await panelText(p)), 'picking one from the list opens it');
  await p.click('#sg-pop .sg-x'); M.stack = {};
  // list failure + Retry
  M.listMode = 'fail'; await p.evaluate(() => window.SL_FLY_BOX(-9.5, -7, 38, 40)); await p.waitForTimeout(3500);
  let note = await p.evaluate(() => document.getElementById('sg-note').innerText);
  ok(/Couldn.t load sightings/.test(note) && /Retry/.test(note), 'a failed list request says so with Retry');
  M.listMode = 'ok'; await p.click('#sg-note .sg-retry'); await p.waitForTimeout(1500);
  ok((await dbg(p)).n > 0 && await p.evaluate(() => document.getElementById('sg-note').hidden), 'Retry loads the sightings');
  // species changed while the first species' observations are still loading
  M.listDelay = 2500;
  await p.fill('#heat-search', 'Natrix maura'); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  M.listDelay = 200;
  await p.fill('#heat-search', 'Vipera latastei'); await p.keyboard.press('Enter'); await p.waitForTimeout(4500);
  d = await dbg(p);
  ok(d.n > 0 && d.ids.every(id => id >= 50000), 'after changing species mid-load, only the new species is on the map');
  ok(/Lataste/.test(await p.evaluate(() => document.getElementById('sg-what').textContent)), 'the bar names the species shown');
  M.listDelay = 0;
  // hit testing after full screen and a resize: the tapped dot is still the one opened
  await p.click('#globe-full'); await p.waitForTimeout(1200);
  await p.setViewportSize({ width: 1100, height: 760 }); await p.waitForTimeout(1500);
  d = await dbg(p);
  const cvs = await p.evaluate(() => { const c = document.getElementById('globe').getBoundingClientRect(); return [c.width, c.height]; });
  const mid = d.dots.find(o => o.x > cvs[0] * 0.35 && o.x < cvs[0] * 0.65 && o.y > cvs[1] * 0.45 && o.y < cvs[1] * 0.75);
  if (mid) { await cvClick(p, mid.x, mid.y); await p.waitForTimeout(900); }
  ok(mid && (await panelText(p)).includes('#' + mid.id), 'after full screen + resize, a tap opens the dot under it');
  const edge = await p.evaluate(() => { const s = document.getElementById('sg-pop').getBoundingClientRect(), g = document.getElementById('globe-stage').getBoundingClientRect(); return s.left >= g.left - 1 && s.right <= g.right + 1 && s.top >= g.top - 1 && s.bottom <= g.bottom + 1; });
  ok(edge, 'the observation panel stays inside the map');
  await p.evaluate(() => { const x = document.querySelector('#sg-pop .sg-x'); if (x) x.click(); }); await p.click('#globe-full'); await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(800);
  // Cameras layer
  await p.fill('#heat-search', ''); await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  await p.evaluate(() => window.SL_FLY_BOX(-10, -6, 37, 42.2)); await p.waitForTimeout(800);
  await p.click('#cam-toggle'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => !document.getElementById('cam-key').hidden && /3 cameras added by SnakeList users/.test(document.getElementById('cam-key').innerText)), 'Cameras is its own layer with its own key and source');
  const camTxt = await p.evaluate(() => document.getElementById('cam-key').innerText);
  ok(!/\blive\b/i.test(camTxt) && /not checked/.test(camTxt), 'camera key never claims a camera is live');
  await shot(p, 'desktop-light-cameras', '#globe-stage');
  await p.click('#sg-toggle'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.SL_CAMS_ON() && !window.SL_SG_ON()), 'Cameras stay on when Sightings goes off (separate layers)');
  await p.click('#cam-toggle');
  console.log('  page errors:', errs);
  ok(!errs.length, 'no page errors (desktop)');
  await ctx.close();

  // ================= map lists: fossils, Most/Fewest, Close vs Clear, state on return =================
  ({ ctx, p, errs } = await run({ width: 1280, height: 900 }, 'light'));
  await p.fill('#heat-search', 'Portugal'); await p.waitForTimeout(1500); await p.keyboard.press('Escape');
  let sub = await p.evaluate(() => document.getElementById('cp-sub').textContent);
  ok(/^10 living species recorded here/.test(sub) && /1 fossil or extinct listed apart/.test(sub), 'Portugal: 10 living species, the fossil listed apart (' + sub + ')');
  ok(await p.evaluate(() => { const g = document.querySelector('#cp-list .cp-gone[data-sp="portugalophis-lignites"]'); const main = [].slice.call(document.querySelectorAll('#cp-list .cp-sp:not(.cp-gone)')).some(r => r.dataset.sp === 'portugalophis-lignites'); return !!g && !main && /Fossil and extinct/.test(document.querySelector('.cp-gone-h').textContent); }), 'Portugalophis lignites is only in the labelled fossil section');
  ok(/living species/.test(await p.evaluate(() => document.getElementById('heat-caption').textContent)), 'the caption says living species');
  await p.evaluate(() => document.getElementById('see-search-cities').click()); await p.waitForTimeout(1500);
  const rk = await p.evaluate(() => ({ most: !!document.querySelector('#cp-list [data-rank="most"]'), fewest: (document.querySelector('#cp-list [data-rank="fewest"]') || {}).innerText || '', sub: document.getElementById('cp-sub').textContent, porto: ([].find.call(document.querySelectorAll('#cp-list > .cp-row'), r => /^Porto\b/.test(r.innerText)) || {}).innerText || '' }));
  ok(rk.most && /Fewest species \((\d+)\)/.test(rk.fewest) && +rk.fewest.match(/\((\d+)\)/)[1] > 0, 'cities: Most and Fewest (fewest is positive): ' + rk.fewest.split('\n')[0]);
  ok(!/nearby/.test(rk.sub) && /district/.test(rk.sub), 'city list scope is labelled, no "nearby": ' + rk.sub);
  ok(/8 recorded in Porto district/.test(rk.porto) && /1 possible \(country-level record only\)/.test(rk.porto), 'Porto: 8 in Porto district + 1 possible (country-level), fossil left out: ' + rk.porto.replace(/\n/g, ' '));
  // pick a tied Fewest city
  await p.evaluate(() => { const d = document.querySelector('#cp-list details[data-rank="fewest"]'); if (d) d.open = true; });
  const tieName = await p.evaluate(() => { const r = document.querySelectorAll('#cp-list [data-rank="fewest"] .cp-rank-pick'); return r.length > 1 ? r[1].querySelector('b').textContent : null; });
  if (tieName) { await p.click('#cp-list [data-rank="fewest"] .cp-rank-pick:nth-of-type(2) b'); await p.waitForTimeout(800); }
  ok(!tieName || (await p.evaluate(() => document.getElementById('cp-title').textContent)) === tieName, 'a tied Fewest place can be chosen (' + tieName + ')');
  // the ranking helper itself: ties, zeros, all-one
  const R = await p.evaluate(() => {
    const mk = a => a.map((n, i) => ({ name: 'P' + i, n, attr: 'data-x="' + i + '"' }));
    const div = s => { const d = document.createElement('div'); d.innerHTML = s; return d; };
    const t = div(window.SL_MAP_RANK(mk([0, 3, 1, 1, 3, 0]), 'city', 'cities', 'species'));
    return { most: t.querySelector('[data-rank="most"]').textContent, fewest: t.querySelector('[data-rank="fewest"]').textContent, fewPicks: t.querySelectorAll('[data-rank="fewest"] .cp-rank-pick').length,
      zero: div(window.SL_MAP_RANK(mk([0, 0, 0]), 'city', 'cities', 'species')).textContent, one: div(window.SL_MAP_RANK(mk([1, 1, 0, 1]), 'city', 'cities', 'species')).textContent };
  });
  ok(/Most species \(3\): P1 and 1 more tied/.test(R.most), 'Most: tie shown (' + R.most.slice(0, 50) + ')');
  ok(/Fewest species \(1\): P2 and 1 more tied/.test(R.fewest) && R.fewPicks === 2, 'Fewest: zeros left out, tie shown with both to choose from');
  ok(/No matching species recorded in these places\./.test(R.zero), 'all zero: "No matching species recorded in these places."');
  ok(/All 3 cities with matching species have just one each/.test(R.one), 'all one: said so');
  // Close keeps the selection; Clear selection lets go of it; Reset view keeps it
  await p.fill('#heat-search', ''); await p.waitForTimeout(800);
  await p.fill('#heat-search', 'Portugal'); await p.waitForTimeout(1500); await p.keyboard.press('Escape');
  await p.click('#cp-close'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.getElementById('country-panel').hidden && !document.getElementById('see-species').hidden), 'Close hides the panel but keeps the selection (See species is there)');
  await p.click('#see-species'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.getElementById('country-panel').hidden && document.getElementById('cp-title').textContent === 'Portugal'), 'See species opens it again as it was');
  await p.click('#globe-reset'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.getElementById('country-panel').hidden), 'Reset view keeps the selection');
  await p.click('#cp-clear'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.getElementById('country-panel').hidden && document.getElementById('see-species').hidden), 'Clear selection lets go of it');
  // the map comes back after a species page
  await p.fill('#heat-search', 'Portugal'); await p.waitForTimeout(1500); await p.keyboard.press('Escape');
  await p.evaluate(() => document.getElementById('see-search-cities').click()); await p.waitForTimeout(1200);
  await p.click('#sg-toggle'); await p.waitForTimeout(1500);
  await p.evaluate(() => { const r = document.querySelector('#cp-list > .cp-row[data-city]'); r.querySelector('b').click(); }); await p.waitForTimeout(800);
  const before = await p.evaluate(() => ({ t: document.getElementById('cp-title').textContent, q: document.getElementById('heat-search').value }));
  await p.evaluate(() => { const r = document.querySelector('#cp-list .cp-sp'); r.click(); }); // a species row opens its page
  await p.waitForURL(/species\//, { timeout: 15000 }); await p.waitForTimeout(800);
  await p.goBack(); await p.waitForFunction(() => window.SL_MAP_GEO_DONE, null, { timeout: 90000 }); await p.waitForTimeout(2500);
  const after = await p.evaluate(() => ({ t: document.getElementById('cp-title').textContent, q: document.getElementById('heat-search').value, sg: window.SL_SG_ON && window.SL_SG_ON(), tab: document.body.classList.contains('tab-map') }));
  ok(after.tab && after.q === before.q && after.t === before.t && after.sg, 'back from a species page: same tab, search, place and Sightings layer (' + JSON.stringify(after) + ')');
  console.log('  page errors:', errs);
  ok(!errs.length, 'no page errors (lists)');
  await ctx.close();

  // ================= screenshots: phone light/dark, desktop dark =================
  for (const [vp, th, nm] of [[{ width: 390, height: 844 }, 'light', 'phone-light'], [{ width: 390, height: 844 }, 'dark', 'phone-dark'], [{ width: 1280, height: 900 }, 'dark', 'desktop-dark']]) {
    ({ ctx, p, errs } = await run(vp, th));
    await p.evaluate(() => window.SL_FLY_BOX(-10, -6, 37, 42.2)); await p.waitForTimeout(500);
    await p.evaluate(() => document.getElementById('sg-toggle').click()); await p.waitForTimeout(2500);
    await shot(p, nm + '-sightings', '#globe-stage');
    await p.evaluate(() => document.getElementById('sg-opt-btn').click()); await p.waitForTimeout(300);
    await shot(p, nm + '-options', '#globe-stage');
    await p.evaluate(() => document.getElementById('sg-opt-btn').click());
    await p.evaluate(() => window.SL_FLY_BOX(-9, -8, 39, 40)); await p.waitForTimeout(1500);
    const dd = await dbg(p);
    if (dd.dots[0]) { await p.evaluate(x => window.SL_MAP_TAP(x.x, x.y), dd.dots[0]); await p.waitForTimeout(900); }
    await shot(p, nm + '-observation', vp.width < 600 ? null : '#globe-stage');
    await p.evaluate(() => document.querySelector('#sg-pop .sg-x') && document.querySelector('#sg-pop .sg-x').click());
    await p.evaluate(() => { window.SL_FLY_BOX(-10, -6, 37, 42.2); document.getElementById('cam-toggle').click(); }); await p.waitForTimeout(1200);
    await shot(p, nm + '-cameras', '#globe-stage');
    ok(!errs.length, 'no page errors (' + nm + ')' + (errs.length ? ' ' + errs : ''));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
})();
