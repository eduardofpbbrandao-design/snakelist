// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT), then
//   PORT=<port> node tests/ip-country.js [screenshot-dir]
// "See snakes from: <your country>": SnakeList never asks for the browser's location by itself. After the opening, it looks up
// the visitor's approximate country from the IP address (api.country.is, then get.geojs.io; both mocked here) and shows a small
// panel "See snakes from: Brazil - N species". Tapping it opens the Map on that country, as if it was tapped there. Checked:
// no geolocation request on entry (navigator.geolocation is watched), BR / US / PT from the first service, the second service
// when the first fails, the time-zone guess when both fail, no panel for a country with no snakes (Iceland), the x keeps it
// away (also after a reload), the cached code is used without asking again, and See near me falls back to the country when
// location is denied. Desktop (1280 x 900) and phone (iPhone 13); screenshots of the panel and of the map after the tap.
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://localhost:' + PORT + '/';
const PAGE = process.env.PAGE || 'index.html';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };

// o: { phone, first: 'BR' | null (fails), second: 'US' | null, tz, deny, seed: {k: v} }
async function open(browser, o) {
  const ctx = await browser.newContext(Object.assign(o.phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } },
    { deviceScaleFactor: 2, timezoneId: o.tz || 'America/New_York', locale: 'en-US' }));
  const p = await ctx.newPage();
  const errs = [], calls = { first: 0, second: 0, other: [] };
  p.on('pageerror', e => errs.push(String(e)));
  await p.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => {
    const u = r.request().url();
    if (u.startsWith('https://api.country.is/')) {
      calls.first++; calls.firstHeaders = r.request().headers();
      return o.first ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ip: '203.0.113.9', country: o.first }) }) : r.abort();
    }
    if (u.startsWith('https://get.geojs.io/')) {
      calls.second++;
      return o.second ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ country: o.second, ip: '203.0.113.9' }) }) : r.abort();
    }
    return r.abort();
  });
  await p.addInitScript(([seed, deny]) => {
    if (!sessionStorage.getItem('ipc-seeded')) {
      sessionStorage.setItem('ipc-seeded', '1');
      ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen'].forEach(k => localStorage.setItem(k, '1'));
      localStorage.setItem('sl-consent', 'essential');
      Object.keys(seed || {}).forEach(k => localStorage.setItem(k, seed[k]));
    }
    // every use of the browser's location is counted (none may happen by itself)
    window.__geoCalls = 0;
    const g = navigator.geolocation;
    if (g) {
      const wrap = (fn) => function (ok, bad, opt) { window.__geoCalls++; if (deny) { setTimeout(() => bad && bad({ code: 1, message: 'denied' }), 50); return 0; } return fn.call(g, ok, bad, opt); };
      try { g.getCurrentPosition = wrap(g.getCurrentPosition); g.watchPosition = wrap(g.watchPosition); } catch (e) {}
    }
  }, [o.seed || {}, !!o.deny]);
  await p.goto(BASE + PAGE, { waitUntil: 'load', timeout: 180000 });
  return { ctx, p, errs, calls };
}
// scroll a little into SnakeList (the rule the small panels follow), then wait for the panel
async function waitPanel(p, ms) {
  await p.waitForFunction(() => window.__introDone, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.mouse.wheel(0, 500); await p.waitForTimeout(300);
  await p.evaluate(() => window.scrollBy(0, 400));
  try { await p.waitForSelector('#sl-ipc:not([hidden])', { timeout: ms || 25000 }); return true; } catch (e) { return false; }
}
const panelText = p => p.evaluate(() => { const el = document.getElementById('sl-ipc'); return el && !el.hidden ? el.innerText.replace(/\s+/g, ' ').trim() : null; });
async function shot(p, name) { if (SHOTS) { await p.waitForTimeout(500); await p.screenshot({ path: SHOTS + '/' + name + '.png' }); } }

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const phone of [false, true]) {
      const tag = phone ? 'phone' : 'desktop';
      // 1. Brazil, from the first service: the panel, then the Map on Brazil
      let s = await open(browser, { phone, first: 'BR', tz: 'America/Sao_Paulo' });
      let shown = await waitPanel(s.p);
      ok(shown, tag + ': the panel shows after the opening (BR)');
      const t = await panelText(s.p);
      ok(t && /See snakes from: .*Brazil/.test(t) && /\d[\d,]* species/.test(t), tag + ': it says "See snakes from: Brazil" and a count: ' + t);
      const want = await s.p.evaluate(() => window.SL_IPC.place('BR'));
      ok(want && want.code === 'br' && want.n > 100, tag + ': Brazil has ' + (want && want.n) + ' living species in SnakeList');
      ok(s.calls.first === 1 && s.calls.second === 0, tag + ': one request, to the first service (' + s.calls.first + '/' + s.calls.second + ')');
      ok(s.calls.firstHeaders && !s.calls.firstHeaders.referer && !s.calls.firstHeaders.cookie, tag + ': no referrer or cookies sent');
      ok(await s.p.evaluate(() => window.__geoCalls) === 0, tag + ': the browser location was never asked for');
      const cache = await s.p.evaluate(() => JSON.parse(localStorage.getItem('sl-ipc') || 'null'));
      ok(cache && cache.cc === 'BR' && cache.src === 'ip', tag + ': the country code is kept on the device');
      const box = await s.p.evaluate(() => { const r = document.getElementById('sl-ipc').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight }; });
      ok(box.l >= 0 && box.r <= box.w && box.b <= box.h && box.t > box.h / 2, tag + ': the panel sits inside the screen, at the bottom');
      await shot(s.p, 'panel-br-' + tag);
      await s.p.click('#sl-ipc .ipc-go');
      await s.p.waitForFunction(() => document.getElementById('tab-map').classList.contains('active'), null, { timeout: 15000 });
      await s.p.waitForFunction(() => { const c = document.getElementById('country-panel'), t = document.getElementById('cp-title'); return c && !c.hidden && /Brazil/.test(t.textContent); }, null, { timeout: 120000 });
      const mp = await s.p.evaluate(() => ({ title: document.getElementById('cp-title').textContent, sub: document.getElementById('cp-sub').textContent,
        rows: document.querySelectorAll('#cp-list .cp-row.cp-sp').length, hidden: document.getElementById('sl-ipc').hidden }));
      ok(/Brazil/.test(mp.title) && mp.rows > 100, tag + ': the Map shows Brazil with its species (' + mp.title + ' - ' + mp.sub + ', ' + mp.rows + ' rows)');
      ok(mp.hidden, tag + ': the panel went away');
      ok(await s.p.evaluate(() => window.__geoCalls) === 0, tag + ': still no location request after opening the map');
      await s.p.waitForTimeout(1500);
      await shot(s.p, 'map-br-' + tag);
      await s.p.evaluate(() => document.getElementById('country-panel').scrollIntoView({ block: 'start' }));
      await shot(s.p, 'map-br-list-' + tag);
      ok(!s.errs.length, tag + ': no page errors ' + s.errs.join(' | '));
      await s.ctx.close();
      if (phone) break; // the other cases on desktop only
      // 2. the first service fails: the second one answers (US)
      s = await open(browser, { first: null, second: 'US' });
      ok(await waitPanel(s.p), 'desktop: the panel shows when the first service fails (US from the second)');
      ok(/United States/.test(await panelText(s.p) || ''), 'desktop: it names the United States: ' + await panelText(s.p));
      ok(s.calls.first === 1 && s.calls.second === 1, 'desktop: the second service was asked once');
      await shot(s.p, 'panel-us-desktop');
      // the x: hidden, and not shown again after a reload
      await s.p.click('#sl-ipc .nd-x');
      ok(await s.p.evaluate(() => document.getElementById('sl-ipc').hidden), 'desktop: x closes it');
      await s.p.evaluate(() => sessionStorage.removeItem('sl-ipc-shown'));
      await s.p.reload({ waitUntil: 'load' });
      ok(!(await waitPanel(s.p, 6000)), 'desktop: after x it does not come back');
      await s.ctx.close();
      // 3. Portugal, cached: no request at all
      s = await open(browser, { first: 'PT', seed: { 'sl-ipc': JSON.stringify({ cc: 'PT', src: 'ip', t: Date.now() }) } });
      ok(await waitPanel(s.p), 'desktop: a cached country shows the panel');
      ok(/Portugal/.test(await panelText(s.p) || ''), 'desktop: Portugal (cached): ' + await panelText(s.p));
      ok(s.calls.first === 0 && s.calls.second === 0, 'desktop: nothing was asked while the code is cached');
      await shot(s.p, 'panel-pt-desktop');
      await s.ctx.close();
      // 4. both fail: the time zone guess (Lisbon -> Portugal)
      s = await open(browser, { first: null, second: null, tz: 'Europe/Lisbon' });
      ok(await waitPanel(s.p), 'desktop: both services failing - the guess from the time zone');
      ok(/Portugal/.test(await panelText(s.p) || ''), 'desktop: guessed Portugal: ' + await panelText(s.p));
      ok(await s.p.evaluate(() => JSON.parse(localStorage.getItem('sl-ipc')).src) === 'guess', 'desktop: kept as a guess');
      await s.ctx.close();
      // 5. a country with no snakes (Iceland): no panel
      s = await open(browser, { first: 'IS' });
      ok(!(await waitPanel(s.p, 8000)), 'desktop: no panel for Iceland (no snakes)');
      ok(await s.p.evaluate(() => window.SL_IPC.place('IS') === null && window.SL_IPC.place('PR') && window.SL_IPC.place('GF') && window.SL_IPC.place('HK').code === 'cn'), 'desktop: territories map to SnakeList places (PR, GF, HK -> China)');
      await s.ctx.close();
      // 6. See near me with location denied: the country is offered instead
      s = await open(browser, { first: 'BR', deny: true, seed: { 'sl-ipc-off': String(Date.now()) } });
      await s.p.waitForFunction(() => window.__introDone, null, { timeout: 90000 });
      await s.p.click('#tab-map');
      await s.p.waitForFunction(() => window.SL_MAP_GEO_DONE && document.querySelector('#nm-toggle:not([hidden])'), null, { timeout: 120000 });
      ok(await s.p.evaluate(() => window.__geoCalls) === 0, 'desktop: opening the Map asks for no location');
      await s.p.click('#nm-toggle');
      await s.p.waitForSelector('.nm-ask-wrap:not([hidden]) .nm-ask-go', { timeout: 10000 });
      await s.p.click('.nm-ask-wrap .nm-ask-go:not(.nm-ask-ipc-go)');
      await s.p.waitForFunction(() => window.__geoCalls === 1 && !document.querySelector('.nm-ask-msg').hidden, null, { timeout: 10000 });
      await s.p.waitForSelector('.nm-ask-ipc:not([hidden]) .nm-ask-ipc-go', { timeout: 10000 });
      await s.p.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('nm-ask-ipc-go'), null, { timeout: 5000 }).catch(() => {});
      const fb = await s.p.evaluate(() => ({ btn: document.querySelector('.nm-ask-ipc-go').textContent, focus: document.activeElement && document.activeElement.classList.contains('nm-ask-ipc-go') }));
      ok(/Brazil/.test(fb.btn) && fb.focus, 'desktop: location denied - "' + fb.btn + '" is offered (focused)');
      await shot(s.p, 'nearme-denied-desktop');
      await s.p.click('.nm-ask-ipc-go');
      await s.p.waitForFunction(() => /Brazil/.test(document.getElementById('cp-title').textContent) && !document.getElementById('country-panel').hidden, null, { timeout: 30000 });
      ok(true, 'desktop: the fallback opens Brazil on the map');
      ok(!s.errs.length, 'desktop: no page errors ' + s.errs.join(' | '));
      await s.ctx.close();
    }
  } catch (e) { ok(false, 'threw: ' + (e && e.stack || e)); }
  await browser.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
