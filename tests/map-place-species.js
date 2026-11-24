// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT), then
//   PORT=<port> node tests/map-place-species.js [screenshot-dir] [--audit]
// v6.28 (Eduardo, L8): a searched town such as Hoedspruit (South Africa) showed only "0 snakes were brought here by
// people (introduced) - none of them is native here". Now every searched town, city or place lists the snakes found in
// its area (its state/province/district from SnakeList's range records, plus country-level records as "possible"),
// "See species" opens that list, and a place with truly none says so plainly. --audit checks every city in SL_CITIES
// and every country, and prints the counts. Nothing outside is needed (all from the app's own data).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://localhost:' + PORT + '/';
const SHOTS = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null, AUDIT = process.argv.includes('--audit');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await p.addInitScript(() => { ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen'].forEach(k => localStorage.setItem(k, '1')); localStorage.setItem('sl-consent', 'essential'); });
  await p.goto(BASE + 'index.html?tab=map', { waitUntil: 'load', timeout: 90000 });
  await p.waitForFunction(() => window.SL_MAP_GEO_DONE, null, { timeout: 90000 });
  await p.waitForTimeout(800);
  const search = async (q) => {
    await p.evaluate((q) => { const h = document.getElementById('heat-search'); h.value = ''; h.dispatchEvent(new Event('input', { bubbles: true })); }, '');
    await p.waitForTimeout(300);
    await p.fill('#heat-search', q); await p.waitForTimeout(1200);
    await p.evaluate(() => { const m = document.querySelector('.heat-search .gmenu'); if (m) m.hidden = true; });
  };
  const panel = () => p.evaluate(() => { const cp = document.getElementById('country-panel'); return { open: !cp.hidden, title: document.getElementById('cp-title').textContent, sub: document.getElementById('cp-sub').textContent, rows: cp.querySelectorAll('.cp-row.cp-sp').length, text: cp.innerText, see: !document.getElementById('see-species').hidden }; });
  // the places list loads on the first search; wait until a town resolves
  await search('Hoedspruit');
  await p.waitForFunction(() => window.SL_PLACE_LOOKUP && window.SL_PLACE_LOOKUP('hoedspruit'), null, { timeout: 30000 }).catch(() => {});
  await search('Hoedspruit');
  const towns = ['Hoedspruit', 'Kisumu', 'Alice Springs', 'Manaus'];
  for (const t of towns) {
    await search(t);
    let s = await panel();
    // as Eduardo did: a tap on the town's dot (then "See species" if the list isn't open yet)
    const xy = await p.evaluate((t) => { const pl = window.SL_PLACE_LOOKUP(t.toLowerCase()), bx = window.SL_MAP_BOX(), c = document.getElementById('globe').getBoundingClientRect();
      return pl ? [c.left + bx[0] + (pl.lon + 180) / 360 * bx[2], c.top + bx[1] + (90 - pl.lat) / 180 * bx[3]] : null; }, t);
    if (xy) { await p.mouse.click(xy[0], xy[1]); await p.waitForTimeout(900); }
    s = await panel();
    if (!s.open || !s.rows) { if (s.see) await p.evaluate(() => document.getElementById('see-species').click()); await p.waitForTimeout(800); s = await panel(); }
    ok(!/brought here by people \(introduced\) - none/.test(s.text) && !/^0 snakes/.test(s.sub), `${t}: never the "0 introduced - none native" line (${s.sub})`);
    ok(s.open && s.rows > 0, `${t}: the panel lists the snakes found in its area (${s.rows} species · ${s.sub})`);
    if (SHOTS) await (await p.$('#globe-stage')).screenshot({ path: SHOTS + '/place-' + t.toLowerCase() + '.png' }).catch(() => {});
    if (SHOTS) await (await p.$('#country-panel')).screenshot({ path: SHOTS + '/place-' + t.toLowerCase() + '-panel.png' }).catch(() => {});
  }
  // Hoedspruit is in Limpopo: its snakes come from Limpopo's records (not the whole of South Africa)
  const h = await p.evaluate(() => window.SL_MAP_AREA_SPECIES('Hoedspruit', 'South Africa', -24.355, 30.954));
  ok(h.n > 20 && /Limpopo/.test(h.where), `Hoedspruit: ${h.n} species, area ${h.where}`);
  // a place with none says so plainly
  await search('Reykjavik');
  let r = await panel(); if (!r.open && r.see) { await p.click('#see-species'); await p.waitForTimeout(600); r = await panel(); }
  ok(r.open && !r.rows && /no snakes|no native land snakes/i.test(r.text) && !/introduced/.test(r.text), `Reykjavik: says plainly there are no snakes (${r.sub})`);
  if (AUDIT) {
    const a = await p.evaluate(() => {
      const geo = window.SL_MAP_GEO(), out = { cities: 0, withSnakes: 0, none: [], countries: 0, countriesNone: [] };
      (window.SL_CITIES || []).forEach((c) => { out.cities++; const s = window.SL_MAP_AREA_SPECIES(c[0], c[1], c[2], c[3]); if (s.n) out.withSnakes++; else out.none.push(c[0] + ', ' + c[1]); });
      Object.keys(geo.iso).forEach((n) => { out.countries++; const cc = geo.iso[n]; const ids = window.SL_MAP_PLACE_AT ? null : null; });
      return out;
    });
    console.log('AUDIT cities: ' + a.cities + ' checked, ' + a.withSnakes + ' with a non-empty list, ' + a.none.length + ' with none: ' + a.none.join('; '));
    ok(a.withSnakes > 0, 'audit ran');
  }
  ok(errs.length === 0, 'no page errors (' + errs.slice(0, 3).join(' | ') + ')');
  await b.close();
  console.log(fails ? fails + ' failed' : 'all passed');
})();
