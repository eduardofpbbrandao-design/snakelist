// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT --bind 127.0.0.1), then
//   PORT=<port> node tests/update-check.js [screenshot-dir]
// v6.28 (Eduardo's iPad stayed on v6.21 while snakelist.com was on v6.27): an installed app is mostly woken up, not opened
// afresh, so the page itself asks version.json (never from a cache) when it starts, when it comes back on screen and every
// 30 minutes. A different version shows the "new version" bar - never over the opening or its photo - and Refresh tells the
// offline helper to wait for the newest page.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const PORT = process.env.PORT || 8766, BASE = 'http://127.0.0.1:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const built = JSON.parse(fs.readFileSync(__dirname + '/../version.json', 'utf8')).v;
  const app = fs.readFileSync(__dirname + '/../snakelist-synced.html', 'utf8');
  ok(app.indexOf('<span class="sl-ver">v' + built + '</span>') >= 0, 'version.json (' + built + ') matches the version shown in the app');
  const sw = fs.readFileSync(__dirname + '/../sw.js', 'utf8');
  ok(/self\.skipWaiting\(\)/.test(sw) && /clients\.claim\(\)/.test(sw), 'the offline helper takes over at once (skipWaiting + clients.claim)');
  ok(/cache: 'no-cache'/.test(sw) && /sl-fresh/.test(sw), 'the app page is always checked with the server, and after Refresh the newest page is waited for');
  const idx = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  ok(/updateViaCache: 'none'/.test(idx) && /SL_CHECK_UPDATE/.test(idx) && /visibilitychange/.test(idx), 'index.html registers the helper without HTTP caching and checks for updates on start and on coming back');

  let live = built, asked = 0;
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  await p.route(/\/version\.json\?t=\d+/, (r) => { asked++; r.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ v: live }) }); });
  await p.addInitScript(() => { ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-level-seen', 'sl-news-off'].forEach((k) => localStorage.setItem(k, '1')); localStorage.setItem('sl-consent', 'yes'); });
  await p.goto(BASE, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(5500);
  ok(asked >= 1, 'the page asks for the live version when it starts (' + asked + ' time(s))');
  ok(!(await p.$('#sl-newver')), 'same version: no bar');
  // a new deploy while the app sits in the background; it comes back on screen
  live = '99.99';
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); window.SL_CHECK_UPDATE(true); });
  await p.waitForTimeout(800);
  const onPhoto = await p.evaluate(() => { const h = document.getElementById('sl-hero'); return !!(h && !h.hidden && !window.__heroEntered); });
  if (onPhoto) ok(!(await p.$('#sl-newver')), 'while the opening photo shows, the bar waits (it never covers the opening)');
  await p.click('#hero-cue').catch(() => {});
  await p.waitForSelector('#sl-newver', { timeout: 15000 }).catch(() => {});
  ok(!!(await p.$('#sl-newver')), 'a newer version on the site: the "new version" bar shows once SnakeList is open');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/test-update-bar.png' });
  const before = asked;
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p.waitForTimeout(400);
  ok(asked === before, 'once the bar is up it does not keep asking');
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
