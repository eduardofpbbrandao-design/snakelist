// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT --bind 127.0.0.1), then
//   PORT=<port> node tests/country-card.js [screenshot-dir]
// PREVIEW "country" - the country card at the top of the Species Checklist (just under the opening photo, not a pop-up):
// "Explore snakes in Portugal - N species - [See snakes] [Change country]". The country is the one you chose (sl-cc-pick, never
// replaced by a guess) or else the approximate country from the internet address (the "See snakes from" lookup, mocked here).
// Checked, on a computer (1440 x 900) and a phone (390 x 844):
//   * the preview off: no card, and the "See snakes from" panel works as before
//   * PT from the address: "Explore snakes in Portugal", its count = the checklist's own count; See snakes filters the
//     checklist (every card shown lives in Portugal, the result count agrees), a heading "Snakes of Portugal", a chip that
//     takes the filter off, View on map opens the Map on Portugal
//   * nothing known: "Find snakes in your country" + a country search (typed, arrow keys, Enter)
//   * Change country: the chosen country is kept after a reload and a detected one never replaces it
//   * Iceland: an honest "No snakes recorded in Iceland"
//   * the browser location is never asked for, unless See snakes near me is pressed (then the Map's own question opens)
//   * the "See snakes from" panel does not also show while the card is on
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://127.0.0.1:' + PORT + '/';
const PAGE = process.env.PAGE || 'index.html';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };

async function open(browser, o) {
  const ctx = await browser.newContext(Object.assign(o.phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } },
    { deviceScaleFactor: 1, timezoneId: o.tz || 'UTC', locale: o.locale || 'en' }));
  const p = await ctx.newPage();
  const errs = [], calls = { ip: 0 };
  p.on('pageerror', e => errs.push(String(e)));
  await p.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => {
    const u = r.request().url();
    if (u.startsWith('https://api.country.is/') || u.startsWith('https://get.geojs.io/')) {
      calls.ip++;
      return o.cc ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ip: '203.0.113.9', country: o.cc }) }) : r.abort();
    }
    return r.abort();
  });
  await p.addInitScript(([seed, pv]) => {
    if (!sessionStorage.getItem('cc-seeded')) {
      sessionStorage.setItem('cc-seeded', '1');
      ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen'].forEach(k => localStorage.setItem(k, '1'));
      localStorage.setItem('sl-consent', 'essential');
      if (pv) localStorage.setItem('sl-art-preview-country', '1');
      Object.keys(seed || {}).forEach(k => localStorage.setItem(k, seed[k]));
    }
    window.__geoCalls = 0;
    const g = navigator.geolocation;
    if (g) { const wrap = (fn) => function (a, b, c) { window.__geoCalls++; setTimeout(() => b && b({ code: 1, message: 'denied' }), 30); return 0; };
      try { g.getCurrentPosition = wrap(g.getCurrentPosition); g.watchPosition = wrap(g.watchPosition); } catch (e) {} }
  }, [o.seed || {}, o.preview !== false]);
  await p.goto(BASE + PAGE, { waitUntil: 'load', timeout: 180000 });
  await p.waitForFunction(() => window.__introDone, null, { timeout: 90000 });
  return { ctx, p, errs, calls };
}
const card = p => p.evaluate(() => { const c = document.getElementById('sl-cc'); if (!c) return null; const r = c.getBoundingClientRect();
  return { text: c.querySelector('.slcc-main').innerText.replace(/\s+/g, ' ').trim(), picking: !c.querySelector('.slcc-pick').hidden, top: r.top + scrollY, h: r.height }; });
async function toCard(p) { await p.evaluate(() => { const h = document.getElementById('hero-go-btn'); if (h && !window.__heroEntered) h.click(); }); await p.waitForFunction(() => window.__heroEntered || !document.querySelector('#sl-hero:not([hidden])'), null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(400); await p.evaluate(() => { const c = document.getElementById('sl-cc'); if (c) c.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(300); }
async function shot(p, name) { if (SHOTS) { await p.waitForTimeout(300); await p.screenshot({ path: SHOTS + '/' + name + '.png' }); } }
const waitText = (p, re, ms) => p.waitForFunction((src) => { const c = document.getElementById('sl-cc'); return c && new RegExp(src).test(c.innerText); }, re.source, { timeout: ms || 20000 }).then(() => true, () => false);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    // 0. the preview off: nothing new, and the "See snakes from" panel still comes
    let s = await open(browser, { preview: false, cc: 'BR' });
    await s.p.waitForTimeout(1500);
    ok(await s.p.evaluate(() => !document.getElementById('sl-cc') && !window.SL_COUNTRY_CARD), 'preview off: no country card');
    await s.p.mouse.wheel(0, 500); await s.p.waitForTimeout(300); await s.p.evaluate(() => window.scrollBy(0, 400));
    ok(await s.p.waitForSelector('#sl-ipc:not([hidden])', { timeout: 25000 }).then(() => true, () => false), 'preview off: the "See snakes from" panel shows as before');
    await s.ctx.close();
    for (const phone of [false, true]) {
      const tag = phone ? 'phone' : 'desktop';
      // 1. Portugal from the internet address
      s = await open(browser, { phone, cc: 'PT' });
      ok(await waitText(s.p, /Explore snakes in Portugal/), tag + ': "Explore snakes in Portugal" (from the address)');
      await toCard(s.p);
      let c = await card(s.p), n = await s.p.evaluate(() => window.SL_CK_COUNTRY.count('Portugal'));
      ok(c && new RegExp('\\b' + n + ' species').test(c.text) && n > 5, tag + ': its count is the checklist\'s own (' + n + '): ' + (c && c.text));
      ok(c && c.h < (phone ? 230 : 120), tag + ': compact (' + (c && Math.round(c.h)) + ' px tall)');
      ok(await s.p.evaluate(() => { const c = document.getElementById('sl-cc'), h = document.getElementById('sl-hero'); return !h || h.hidden || c.getBoundingClientRect().top + scrollY >= h.offsetTop + h.offsetHeight - 1; }), tag + ': it sits under the opening photo, never over it');
      ok(await s.p.evaluate(() => !document.querySelector('#sl-ipc:not([hidden])')), tag + ': the "See snakes from" panel does not show as well');
      await shot(s.p, 'cc-pt-' + tag);
      await s.p.click('#sl-cc [data-cc="go"]');
      await s.p.waitForTimeout(800);
      const f = await s.p.evaluate(() => { const vis = [...document.querySelectorAll('#grid .card')].filter(c => getComputedStyle(c).display !== 'none');
        return { f: window.SL_CK_COUNTRY.get(), vis: vis.length, allPT: vis.every(c => (c.dataset.countries || '').split('|').includes('Portugal')), rc: document.getElementById('result-count').innerText, chip: !!document.querySelector('#sl-cc [data-cc="off"]'), map: !!document.querySelector('#sl-cc [data-cc="map"]'), h: document.getElementById('slcc-h').innerText }; });
      ok(f.f.length === 1 && f.f[0] === 'Portugal', tag + ': See snakes filters the checklist to Portugal');
      ok(f.vis > 0 && f.allPT, tag + ': every card shown lives in Portugal (' + f.vis + ' shown)');
      ok(new RegExp('\\b' + n + '\\b').test(f.rc.replace(/,/g, '')), tag + ': the checklist count agrees: "' + f.rc + '"');
      ok(/Snakes of Portugal/.test(f.h) && f.chip && f.map, tag + ': a heading "' + f.h + '", a remove-filter chip and View on map');
      await shot(s.p, 'cc-pt-filtered-' + tag);
      await s.p.click('#sl-cc [data-cc="off"]'); await s.p.waitForTimeout(500);
      ok(await s.p.evaluate(() => window.SL_CK_COUNTRY.get().length === 0 && /Explore snakes in Portugal/.test(document.getElementById('sl-cc').innerText)), tag + ': the chip takes the filter off');
      ok(await s.p.evaluate(() => window.__geoCalls) === 0, tag + ': the browser location was never asked for');
      if (!phone) {
        await s.p.click('#sl-cc [data-cc="go"]'); await s.p.waitForTimeout(300);
        await s.p.click('#sl-cc [data-cc="map"]');
        ok(await s.p.waitForFunction(() => document.getElementById('tab-map').classList.contains('active'), null, { timeout: 15000 }).then(() => true, () => false), 'desktop: View on map opens the Map');
        ok(await s.p.waitForFunction(() => { const c = document.getElementById('country-panel'), t = document.getElementById('cp-title'); return c && !c.hidden && t && /Portugal/.test(t.textContent); }, null, { timeout: 120000 }).then(() => true, () => false), 'desktop: ...on Portugal');
        await shot(s.p, 'cc-pt-map-desktop');
      }
      ok(!s.errs.length, tag + ': no page errors ' + s.errs.join(' | '));
      await s.ctx.close();
    }
    // 2. nothing known (no address answer, no time-zone guess): find your country with the search
    s = await open(browser, { cc: null, tz: 'UTC', locale: 'en' });
    ok(await waitText(s.p, /Find snakes in your country/), 'unknown: "Find snakes in your country"');
    await toCard(s.p);
    await shot(s.p, 'cc-unknown-desktop');
    await s.p.click('#sl-cc [data-cc="change"]');
    ok((await card(s.p)).picking && await s.p.evaluate(() => document.activeElement && document.activeElement.id === 'slcc-in'), 'unknown: Choose country opens a search, focused');
    await s.p.keyboard.type('bra');
    await s.p.waitForTimeout(200);
    ok(await s.p.evaluate(() => [...document.querySelectorAll('#sl-cc .slcc-opt')].some(o => /Brazil/.test(o.textContent))), 'unknown: typing "bra" offers Brazil');
    await shot(s.p, 'cc-picker-desktop');
    await s.p.keyboard.press('ArrowDown'); await s.p.keyboard.press('Enter'); await s.p.waitForTimeout(300);
    ok(await waitText(s.p, /Explore snakes in Brazil/, 3000) && await s.p.evaluate(() => localStorage.getItem('sl-cc-pick') === 'Brazil'), 'unknown: Enter chooses Brazil, kept on the device');
    await s.ctx.close();
    // 3. a chosen country is never replaced by the detected one (and Change country corrects a detected one)
    s = await open(browser, { cc: 'PT', seed: { 'sl-cc-pick': 'Spain' } });
    await s.p.waitForTimeout(3000);
    ok(/Explore snakes in Spain/.test((await card(s.p) || {}).text || ''), 'chosen Spain + address PT: the card stays on Spain');
    await s.ctx.close();
    s = await open(browser, { cc: 'PT' });
    await waitText(s.p, /Portugal/); await toCard(s.p);
    await s.p.click('#sl-cc [data-cc="change"]'); await s.p.keyboard.type('Spain'); await s.p.keyboard.press('Enter');
    ok(await waitText(s.p, /Explore snakes in Spain/, 3000), 'detected PT corrected to Spain with Change country');
    await s.p.evaluate(() => { sessionStorage.removeItem('sl-ipc-shown'); });
    await s.p.reload({ waitUntil: 'load' }); await s.p.waitForFunction(() => window.__introDone, null, { timeout: 90000 }); await s.p.waitForTimeout(3000);
    ok(/Explore snakes in Spain/.test((await card(s.p) || {}).text || ''), 'after a reload: still Spain');
    // See snakes near me: only now is the location asked for (the Map's own question first)
    await toCard(s.p);
    await s.p.click('#sl-cc [data-cc="change"]');
    ok(await s.p.evaluate(() => window.__geoCalls) === 0, 'no location request before See snakes near me');
    await s.p.click('#sl-cc [data-cc="near"]');
    ok(await s.p.waitForFunction(() => document.getElementById('tab-map').classList.contains('active'), null, { timeout: 15000 }).then(() => true, () => false), 'See snakes near me opens the Map (its own location question)');
    await s.ctx.close();
    // 4. Iceland: an honest empty state
    s = await open(browser, { cc: 'IS' });
    ok(await waitText(s.p, /No snakes recorded in Iceland/), 'Iceland: "No snakes recorded in Iceland"');
    await toCard(s.p); await shot(s.p, 'cc-iceland-desktop');
    await s.ctx.close();
  } catch (e) { ok(false, 'crashed: ' + (e && e.stack || e)); }
  await browser.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
