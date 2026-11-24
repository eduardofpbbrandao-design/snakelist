// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT), then
//   PORT=<port> node tests/map-see-area.js [screenshot-dir]
// v5.74 "See area" (v5.78: "Show colours") on a species' card in the map's list: that snake's range on the map in the picked
// country's green, with a key (Close chip) - and how it goes away again (the button, Close, the empty map, a place,
// closing the list). v5.90: the real range (GARD expert range maps, data/ranges/<id>.json, fetched only when pressed),
// cut to the coast - not whole states/countries - darker deep inside it, lighter where it ends.
// Portugal -> Montpellier snake, Pennsylvania -> Timber Rattlesnake, Florida -> Burmese python (brought by
// people), Saint Lucia's racer and threadsnake (a small island). Desktop light, then a phone in dark mode.
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://localhost:' + PORT + '/';
const SHOTS = process.argv[2] || null;
async function open(opts) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext(Object.assign(opts.phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } }, { permissions: ['geolocation'], geolocation: { latitude: 38.72, longitude: -9.14 } }));
  const p = await ctx.newPage();
  const errs = [], rangeReqs = [];
  p.on('request', r => { if (/data\/ranges\//.test(r.url())) rangeReqs.push(r.url()); });
  p.on('pageerror', e => errs.push(String(e)));
  await p.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => r.abort()); // (iNaturalist and the rest aren't needed)
  await p.addInitScript(([th, extra]) => {
    ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off'].forEach(k => localStorage.setItem(k, '1'));
    localStorage.setItem('sl-consent', 'essential');
    if (th) localStorage.setItem('sl-theme', th);
    Object.keys(extra || {}).forEach(k => localStorage.setItem(k, extra[k]));
  }, [opts.theme || 'light', opts.ls || null]);
  await p.goto(BASE + 'index.html?tab=map', { waitUntil: 'load' });
  await p.waitForFunction(() => window.SL_MAP_GEO_DONE, null, { timeout: 90000 });
  if (opts.theme) await p.evaluate(th => document.documentElement.setAttribute('data-sl-theme', th), opts.theme);
  await p.waitForTimeout(1000);
  return { browser, p, errs, rangeReqs };
}
// the screen point of a lon/lat on the map canvas (the flat map is equirectangular)
async function llXY(p, lon, lat) {
  return p.evaluate(([lon, lat]) => {
    const c = document.getElementById('globe'), r = c.getBoundingClientRect();
    if (!window.SL_MAP_BOX) { const v = window.SL_MAP_VIEW(); return [r.left + (lon - v.w) / (v.e - v.w) * r.width, r.top + (v.n - lat) / (v.n - v.s) * r.height]; }
    const b = window.SL_MAP_BOX();
    return [r.left + b[0] + (lon + 180) / 360 * b[2], r.top + b[1] + (90 - lat) / 180 * b[3]];
  }, [lon, lat]);
}
async function llClick(p, lon, lat) {
  const xy = await llXY(p, lon, lat);
  await p.mouse.click(xy[0], xy[1]); await p.waitForTimeout(900);
}
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
async function run(theme, phone) {
  const tag = theme + (phone ? '-phone' : '-desktop');
  const { browser, p, errs, rangeReqs } = await open({ theme, phone });
  const stage = async () => p.evaluate(() => document.getElementById('globe-stage').scrollIntoView());
  const shotMap = async (name) => { if (!SHOTS) return; await p.waitForTimeout(700); await p.locator('#globe-stage').screenshot({ path: SHOTS + '/' + name + '-' + tag + '.png' }); };
  const clickArea = async (id) => {
    const row = '#cp-list .cp-row[data-sp="' + id + '"]';
    const has = await p.evaluate(r => !!document.querySelector(r), row);
    if (!has) { ok(false, id + ' in the list'); return false; }
    await p.evaluate(r => document.querySelector(r).scrollIntoView({ block: 'nearest', inline: 'nearest' }), row);
    await p.waitForTimeout(700);
    await p.click(row + ' .cpc-card .area-btn');
    await p.waitForTimeout(1600);
    return true;
  };
  const info = () => p.evaluate(() => window.SL_MAP_AREA_INFO());
  const has = (lon, lat) => p.evaluate(([a, b]) => window.SL_MAP_AREA_HAS(a, b), [lon, lat]);

  // ---- 1. Portugal -> Montpellier snake
  await stage();
  await p.evaluate(() => window.SL_FLY_BOX(-12, 2, 35, 45)); await p.waitForTimeout(1500);
  await llClick(p, -8, 39.5);
  ok(await p.evaluate(() => document.getElementById('cp-title').textContent) === 'Portugal', 'Portugal picked');
  ok(await p.evaluate(() => [...document.querySelectorAll('#cp-list .cpc-card')].every(c => c.querySelector('.area-btn'))), 'every built card has Show colours');
  ok(await p.evaluate(() => [...document.querySelectorAll('#cp-list .cpc-card')].every(c => c.scrollHeight <= c.clientHeight + 1)), 'no card overflows with the new line');
  ok(await p.evaluate(() => [...document.querySelectorAll('#cp-list .cpc-card .cpc-extra')].every(x => x.getBoundingClientRect().height >= 16)), 'the line of states is full height on every card (not crushed to a thin green line)');
  ok(await p.evaluate(() => !document.querySelector('#cp-list .area-btn[title], #area-key [title]')), 'no title tooltips');
  ok(rangeReqs.length === 0, 'no range file is downloaded before Show colours is pressed');
  await clickArea('malpolon-monspessulanus');
  let a = await info();
  ok(a && a.id === 'malpolon-monspessulanus', 'Montpellier snake area on');
  ok(rangeReqs.length === 1 && /malpolon-monspessulanus\.json$/.test(rangeReqs[0]), 'its own range file fetched when pressed');
  ok(a && a.src === 'g' && !a.flat && a.edges > 0 && a.points > 300, 'a real range map (GARD), shaded darker inside / lighter at its edges (' + (a && a.points) + ' points)');
  ok(await has(-9.1, 38.75) && await has(-3.7, 40.4) && await has(-5.8, 35.0), 'lives round Lisbon, Madrid and in northern Morocco');
  ok(!(await has(2, 27)) && !(await has(-20, 40)) && !(await has(-12, 39)), 'not out in the Sahara, not in the sea');
  ok(await p.evaluate(() => /GARD/.test(document.getElementById('ak-src').textContent)), 'the key names the range map (GARD)');
  ok(await p.evaluate(() => { const b = document.querySelector('#cp-list .cp-row[data-sp="malpolon-monspessulanus"] .area-btn'); return b.textContent === 'Hide colours' && b.classList.contains('on') && b.getAttribute('aria-pressed') === 'true'; }), 'button turns into Hide area');
  ok(await p.evaluate(() => !document.getElementById('area-key').hidden && /Where the Montpellier Snake lives/.test(document.getElementById('area-key').textContent) && /Core/.test(document.getElementById('ak-scale').textContent) && /Edge of range/.test(document.getElementById('ak-scale').textContent) && /not a count of how many snakes/.test(document.getElementById('area-key').textContent) && !/state or country/.test(document.getElementById('area-key').textContent)), 'key: Where the Montpellier Snake lives, Core / Edge of range, not a count of snakes (no "shaded by state or country")');
  const vw = await p.evaluate(() => window.SL_MAP_VIEW());
  ok(vw.w < -9 && vw.e > 7 && vw.s < 36 && vw.n > 44, 'map fitted to the range (' + [vw.w, vw.e, vw.s, vw.n].map(x => x.toFixed(1)).join(', ') + ')');
  await shotMap('1-portugal-montpellier');
  // a drag keeps it
  const box = await p.locator('#globe').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 10, { steps: 5 }); await p.mouse.up();
  await p.waitForTimeout(300);
  ok((await info()) !== null, 'a drag keeps the area');
  // button again: off
  await clickArea('malpolon-monspessulanus');
  ok((await info()) === null && await p.evaluate(() => document.getElementById('area-key').hidden), 'Hide colours puts it away');
  ok(await p.evaluate(() => document.querySelector('#cp-list .cp-row[data-sp="malpolon-monspessulanus"] .area-btn').textContent === 'Show colours'), 'button back to Show colours');
  // the close chip
  await clickArea('malpolon-monspessulanus');
  await p.click('#ak-close'); await p.waitForTimeout(300);
  ok((await info()) === null && await p.evaluate(() => !document.getElementById('country-panel').hidden), 'Close on the key puts it away (the list stays)');
  // empty map: only the area goes
  await clickArea('malpolon-monspessulanus');
  await llClick(p, -12, 36.5); // the Atlantic
  ok((await info()) === null && await p.evaluate(() => !document.getElementById('country-panel').hidden && document.getElementById('cp-title').textContent === 'Portugal'), 'a click on the empty sea puts the area away, the list stays');
  await llClick(p, -20, 40);
  ok(await p.evaluate(() => document.getElementById('country-panel').hidden), 'the next click on the sea closes the list as before');
  // a place: area goes and the place shows
  await llClick(p, -8, 39.5);
  await clickArea('malpolon-monspessulanus');
  await p.evaluate(() => window.SL_FLY_BOX(-12, 2, 35, 45)); await p.waitForTimeout(1200);
  await llClick(p, -3.7, 40.2); // Spain
  ok((await info()) === null && await p.evaluate(() => document.getElementById('cp-title').textContent) === 'Spain', 'a click on a place puts the area away and shows that place');
  // Close the list: the area goes too
  await clickArea('malpolon-monspessulanus');
  await p.click('#cp-close'); await p.waitForTimeout(300);
  ok((await info()) === null, 'closing the list puts the area away');

  // ---- 2. a USA state -> Timber Rattlesnake
  await stage();
  await p.evaluate(() => window.SL_FLY_BOX(-125, -66, 24, 50)); await p.waitForTimeout(1500);
  await llClick(p, -98, 39);
  await p.click('#see-provinces'); await p.waitForTimeout(1500);
  await llClick(p, -77.6, 40.9); // Pennsylvania
  ok(/Pennsylvania/.test(await p.evaluate(() => document.getElementById('cp-title').textContent)), 'Pennsylvania picked');
  await clickArea('crotalus-horridus');
  a = await info();
  ok(a && a.src === 'g' && await has(-77.6, 40.9) && await has(-86, 35.5), 'Timber Rattlesnake: in Pennsylvania and Tennessee');
  ok(!(await has(-69.2, 45.3)) && !(await has(-81.2, 27.5)) && !(await has(-100, 40)), 'not in Maine, the Florida peninsula or the Great Plains (the range, not whole states)');
  await shotMap('2-pennsylvania-timber-rattlesnake');
  await p.click('#ak-close'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.getElementById('map-legend').hidden && /Pennsylvania/.test(document.getElementById('cp-title').textContent)), 'after Close, Pennsylvania is still picked (one state: no fewer/more key - v5.78)');
  await shotMap('2b-after-close-states-back');

  // ---- 3. Florida -> Burmese python (brought by people)
  await llClick(p, -81.6, 28.3); // Florida
  ok(/Florida/.test(await p.evaluate(() => document.getElementById('cp-title').textContent)), 'Florida picked');
  if (await clickArea('python-bivittatus')) {
    a = await info();
    ok(await has(-80.9, 25.6) && await has(-81.2, 26.2), 'South Florida shaded (the Everglades, Big Cypress - where it breeds)');
    ok(!(await has(-84.3, 30.4)) && !(await has(-81.4, 28.5)) && !(await has(-80.2, 26.7 + 3)), 'not north Florida, Orlando or the Panhandle');
    ok(await has(101, 23) && await has(100.5, 15) && await has(110.5, -7.3), 'native range in Asia (Yunnan, Thailand, Java)');
    ok(!(await has(77.2, 28.6)) && !(await has(80.5, 7.5)), 'not Delhi or Sri Lanka');
    ok(await p.evaluate(() => !document.getElementById('ak-intro') && !document.getElementById('ak-note').hidden), 'no separate brought-by-people colour; the key explains the shading');
    await shotMap('3-florida-burmese-python');
    await p.click('#ak-close'); await p.waitForTimeout(300);
  }

  // ---- 4. small islands: Saint Lucia
  await p.evaluate(() => window.SL_FLY_BOX(-62.5, -59.5, 12.8, 15)); await p.waitForTimeout(1500);
  await llClick(p, -60.97, 13.9);
  ok(/Saint Lucia/.test(await p.evaluate(() => document.getElementById('cp-title').textContent)), 'Saint Lucia picked');
  if (await clickArea('erythrolamprus-ornatus')) {
    a = await info();
    ok(a && a.rings >= 1 && a.box[1] - a.box[0] < 0.5, 'Saint Lucia Racer: its tiny range on Saint Lucia (' + (a && a.box) + ')');
    await shotMap('4-saint-lucia-racer');
  }
  if (await clickArea('tetracheilostoma-breuili')) {
    a = await info();
    ok(a && a.flat && await has(-60.97, 13.9), 'St. Lucia Threadsnake: the island lit, one shade');
    ok(await p.evaluate(() => !document.getElementById('ak-flat').hidden && document.getElementById('ak-scale').hidden), 'key: one shade, Lives here');
    await shotMap('4b-saint-lucia-threadsnake');
  }
  ok(errs.length === 0, tag + ': no page errors ' + errs.join(' | '));
  await browser.close();
}
(async () => {
  await run('light', false);
  await run('dark', true);
  console.log(fails ? 'FAILED ' + fails : 'ALL PASSED');
  process.exitCode = fails ? 1 : 0;
})();
