// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT), then
//   PORT=<port> node tests/near-me-time.js [screenshot-dir]
// See near me's "Time": with Time on (the default) the list says which snakes are likely out right now where you
// are - your device's clock and date, the sun at your position (day / dawn / dusk / night), the season from the
// date and your hemisphere - from the same activity data the How to find it guide uses; a snake with none says
// "Activity not known" and is never left out. The Time button turns it off (the plain list), and that is kept.
// Fake position + fake clock: Florida summer night, Florida January day, Sydney in July (southern winter),
// Arizona summer midday, Pennsylvania January. Screenshots: time on/off, desktop + phone, light + dark.
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://localhost:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const USER = { email: 'tester@example.com', name: 'Tester', kind: 'google' };

async function open(o) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext(Object.assign(o.phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } },
    { permissions: ['geolocation'], geolocation: { latitude: o.lat, longitude: o.lon }, timezoneId: o.tz, locale: 'en-US' }));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => r.abort());
  await p.clock.setFixedTime(new Date(o.at));
  await p.addInitScript(([th, u, lat, lon, time]) => {
    if (sessionStorage.getItem('nmt-seeded')) return; // (a reload keeps what the page saved)
    sessionStorage.setItem('nmt-seeded', '1');
    ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen'].forEach(k => localStorage.setItem(k, '1'));
    localStorage.setItem('sl-consent', 'essential');
    localStorage.setItem('sl-theme', th);
    localStorage.setItem('sl-google', JSON.stringify(u));
    localStorage.setItem('sl-nearme', JSON.stringify({ ans: 'yes', lat, lon, who: u.email, t: Date.now() }));
    if (time) localStorage.setItem('sl-nearme-time', time); else localStorage.removeItem('sl-nearme-time');
  }, [o.theme || 'light', USER, Math.round(o.lat * 10) / 10, Math.round(o.lon * 10) / 10, o.time || null]);
  await p.goto(BASE + 'index.html?tab=map', { waitUntil: 'load' });
  await p.waitForFunction(() => window.SL_MAP_GEO_DONE && window.SL_NEARME && window.SL_NEARME_MAP && window.SL_NEARME_MAP.ready(), null, { timeout: 90000 });
  await p.evaluate(th => document.documentElement.setAttribute('data-sl-theme', th), o.theme || 'light');
  return { browser, p, errs };
}
async function seeNear(p) {
  await p.evaluate(() => { window.SL_NEARME.check(); document.getElementById('globe-stage').scrollIntoView(); });
  await p.waitForSelector('#nm-toggle:not([hidden])', { timeout: 15000 });
  await p.click('#nm-toggle');
  await p.waitForSelector('#cp-list #nm-off', { timeout: 30000 });
  await p.waitForTimeout(900);
}
const state = p => p.evaluate(() => {
  const t = window.SL_NEARME.time(), bar = document.getElementById('nm-tbar');
  const rows = [...document.querySelectorAll('#cp-list > .cp-row.cp-sp')].map(r => {
    const c = r.querySelector('.nm-tchip'); return { id: r.getAttribute('data-sp'), chip: c ? c.textContent : null, k: c ? c.getAttribute('data-nmk') : null };
  });
  const r = window.SL_NEARME.rec(), f = window.SL_NEARME_MAP.find(r.lat, r.lon);
  return { T: t && t.T, info: t && t.info, bar: bar && !bar.hidden ? bar.innerText : null, btn: (document.getElementById('nm-tbtn') || {}).textContent || null,
    pressed: (document.getElementById('nm-tbtn') || { getAttribute() {} }).getAttribute('aria-pressed'), rows, base: f.list.map(o => o.sp.id),
    stored: localStorage.getItem('sl-nearme-time'), titles: document.querySelectorAll('#nm-tbar [title], #cp-list .nm-tchip[title]').length };
});
const chipOf = (s, id) => (s.rows.find(r => r.id === id) || {}).chip;
async function shot(p, name) {
  if (!SHOTS) return;
  await p.waitForTimeout(600);
  await p.locator('#globe-stage').screenshot({ path: SHOTS + '/' + name + '-stage.png' });
  await p.evaluate(() => document.getElementById('country-panel').scrollIntoView({ block: 'start' }));
  await p.waitForTimeout(500);
  await p.screenshot({ path: SHOTS + '/' + name + '-panel.png' });
}
const CASES = [
  { name: 'florida-summer-night', lat: 26.6, lon: -81.9, tz: 'America/New_York', at: '2026-07-16T03:10:00Z',
    check(s) {
      ok(s.T.phase === 'night', 'Florida summer night: it is night (' + s.T.phase + ')');
      ok(/summer/.test(s.T.season) && !s.T.off, 'Florida summer: summer, in season (' + s.T.season + ')');
      ok(/Wednesday 11:10 pm/.test(s.bar), 'Florida: the local day and time in the line');
      ok(chipOf(s, 'python-bivittatus') === 'Active now', 'Burmese python (sourced: mostly at night): Active now (' + chipOf(s, 'python-bivittatus') + ')');
      ok(chipOf(s, 'opheodrys-aestivus') === 'Usually out by day', 'Rough green snake (sourced: by day): Usually out by day (' + chipOf(s, 'opheodrys-aestivus') + ')');
      ok(s.rows[0].k === 'yes', 'the snakes likely out now come first');
      ok(/Sunrise at 6:\d\d am/.test(s.bar), 'the next sunrise is shown (' + (s.bar.match(/Sunrise at [^.]*/) || [''])[0] + ')');
    } },
  { name: 'florida-january-day', lat: 26.6, lon: -81.9, tz: 'America/New_York', at: '2026-01-15T18:00:00Z',
    check(s) {
      ok(s.T.phase === 'day', 'Florida January 1 pm: day');
      ok(s.T.off === 'warm' && /winter/.test(s.T.season), 'Florida January: winter, out on warm days (' + s.T.season + ')');
      ok(chipOf(s, 'python-bivittatus') === 'Winter: out only on warm days', 'Burmese python in January: out only on warm days');
      ok(/Thursday 1:00 pm/.test(s.bar) && /Sunset at [56]:\d\d pm/.test(s.bar), 'local time and the sunset in the line');
    } },
  { name: 'sydney-july', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney', at: '2026-07-15T04:00:00Z',
    check(s) {
      ok(s.T.phase === 'day' && /mid-winter/.test(s.T.season), 'Sydney in July: a winter day (southern hemisphere) (' + s.T.season + ')');
      ok(s.rows.length > 10 && s.rows.every(r => r.chip), 'every snake near Sydney is listed with a chip (' + s.rows.length + ')');
      ok(chipOf(s, 'pseudonaja-textilis') === 'Winter: out only on warm days', 'Eastern brown snake in July: out only on warm days (' + chipOf(s, 'pseudonaja-textilis') + ')');
      ok(/Wednesday 2:00 pm/.test(s.bar), 'Sydney: its own local time');
    } },
  { name: 'arizona-summer-midday', lat: 33.45, lon: -112.07, tz: 'America/Phoenix', at: '2026-07-15T20:00:00Z',
    check(s) {
      ok(s.T.heat && /hot middle of the day/.test(s.bar), 'Arizona July 1 pm: the hot middle of the day');
      ok(s.rows.filter(r => r.chip === 'Activity not known').length > 0, 'snakes with no activity data say Activity not known');
    } },
  { name: 'pennsylvania-january', lat: 40.9, lon: -77.8, tz: 'America/New_York', at: '2026-01-20T15:00:00Z',
    check(s) {
      ok(s.T.off === 'cold', 'Pennsylvania January: the cold months');
      ok(s.rows.every(r => r.chip === 'Likely hiding for winter'), 'every snake: Likely hiding for winter');
      ok(s.info.yes === 0 && /0 of \d+ snakes likely active now/.test(s.bar), 'none likely active now');
    } },
];
(async () => {
  for (const c of CASES) {
    const { browser, p, errs } = await open(c);
    await seeNear(p);
    const s = await state(p);
    ok(!!s.T && s.btn === 'Time on' && s.pressed === 'true' && s.stored === null, c.name + ': Time is on by default');
    ok(s.rows.length === s.base.length && s.rows.every(r => s.base.includes(r.id)), c.name + ': the same snakes as the plain list (' + s.rows.length + '), none hidden');
    ok(s.rows.every(r => r.chip), c.name + ': every snake has a chip');
    ok(s.titles === 0, c.name + ': no hover tooltips');
    console.log('  ' + (s.bar || '').replace(/\n+/g, ' | '));
    c.check(s);
    ok(!errs.length, c.name + ': no page errors ' + errs.join(' '));
    await browser.close();
  }
  // Time off: the plain list; remembered after a reload; How to find it still works; on again
  for (const v of [{ theme: 'light', phone: false }, { theme: 'dark', phone: false }, { theme: 'light', phone: true }, { theme: 'dark', phone: true }]) {
    const tag = v.theme + (v.phone ? '-phone' : '-desktop');
    const c = CASES[0], { browser, p, errs } = await open(Object.assign({}, c, v));
    await seeNear(p);
    await shot(p, 'time-on-' + tag);
    await p.click('#nm-tbtn'); await p.waitForTimeout(500);
    let s = await state(p);
    ok(s.stored === 'off' && s.btn === 'Time off' && s.pressed === 'false', tag + ': the Time button turns it off and saves it');
    ok(!s.T && s.rows.every(r => !r.chip), tag + ': Time off - no chips');
    ok(JSON.stringify(s.rows.map(r => r.id)) === JSON.stringify(s.base), tag + ': Time off - the plain list in its own order');
    ok(/Time is off/.test(s.bar), tag + ': the line says Time is off');
    await shot(p, 'time-off-' + tag);
    if (!v.phone && v.theme === 'light') {
      await p.reload({ waitUntil: 'load' });
      await p.waitForFunction(() => window.SL_MAP_GEO_DONE && window.SL_NEARME && window.SL_NEARME_MAP && window.SL_NEARME_MAP.ready(), null, { timeout: 90000 });
      await seeNear(p);
      s = await state(p);
      ok(s.stored === 'off' && !s.T && s.btn === 'Time off', 'after a reload Time is still off');
      await p.click('#nm-tbtn'); await p.waitForTimeout(500);
      s = await state(p);
      ok(s.stored === 'on' && s.T && s.rows.every(r => r.chip), 'and on again');
      await p.evaluate(() => { const b = document.querySelector('#cp-list .nm-how'); window.SL_NEARME.how(b.getAttribute('data-how')); });
      await p.waitForTimeout(800);
      ok(await p.evaluate(() => { const w = document.querySelector('.nm-how-wrap'); return !!w && !w.hidden && /Best time of day/i.test(w.textContent); }), 'How to find it still opens');
      // another place in the panel: the Time line goes
      await p.evaluate(() => { document.getElementById('cp-list').innerHTML = '<div class="cp-row">x</div>'; });
      await p.waitForTimeout(200);
      ok(await p.evaluate(() => document.getElementById('nm-tbar').hidden), 'the Time line goes with the near me list');
    }
    if (v.phone) { // the card shows the chip as its first tag
      await p.click('#nm-tbtn'); await p.waitForTimeout(1200);
      const first = await p.evaluate(() => { const t = document.querySelector('#cp-list .cpc-card .card-tags .tag'); return t ? t.textContent : null; });
      ok(!!first && /now|night|day|known|winter|underground|heat/i.test(first), tag + ': a card shows the chip first in its tags (' + first + ')');
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(over <= 0, tag + ': no sideways page scroll');
    }
    ok(!errs.length, tag + ': no page errors ' + errs.join(' '));
    await browser.close();
  }
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
