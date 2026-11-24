// Settings > Time zone (window.SL_TZ, localStorage sl-tz) and the countdown finale (events/countdown.js) through
// its preview switch (?countdown-finale-preview=1): the last minute opens the big panel (not while typing - then on
// blur), the last 10 seconds glow red/green (at most 2 colour changes a second, see-through tint), "reduce motion"
// keeps the glow still, and zero says "SnakeList Christmas is here!" and then ends without switching Christmas on.
// Without the switch nothing pretends anything.
// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT), then  PORT=<port> node tests/countdown-finale-tz.js
// (takes about 2 minutes: the preview really counts down 70 seconds)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://localhost:' + PORT + '/';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const seed = () => { ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen'].forEach((k) => localStorage.setItem(k, '1')); localStorage.setItem('sl-consent', 'essential'); };

async function page(b, query, o) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/Lisbon' }, o || {}));
  await ctx.addInitScript(seed);
  const p = await ctx.newPage(); p.setDefaultTimeout(150000);
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto(BASE + 'index.html' + query, { waitUntil: 'load', timeout: 180000 });
  return { ctx, p };
}
const ready = (p) => p.waitForFunction(() => window.SL_EVENTS && SL_EVENTS.countdownState, null, { timeout: 150000 });

(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

  // ------------------------------------------------ the time zone setting
  {
    const { ctx, p } = await page(b, '');
    await p.waitForFunction(() => window.SL_TZ && document.getElementById('ss-tz-row'), null, { timeout: 150000 });
    const r = await p.evaluate(() => {
      const o = {};
      o.auto = SL_TZ.chosen() === '' && SL_TZ.zone() === 'Europe/Lisbon';
      o.inSettings = !!document.querySelector('#sl-settings #ss-tz-row');
      o.render = typeof window.SL_TZ_SETTING_RENDER === 'function';
      SL_TZ.set('Not/AZone'); o.badIgnored = SL_TZ.chosen() === '' && localStorage.getItem('sl-tz') === null;
      let fired = 0; document.addEventListener('sl-tz-changed', () => fired++);
      SL_TZ.set('Asia/Tokyo'); o.saved = localStorage.getItem('sl-tz') === 'Asia/Tokyo' && SL_TZ.zone() === 'Asia/Tokyo' && fired === 1;
      o.fmt = SL_TZ.format(Date.parse('2026-12-01T00:00:00Z'), { hour: '2-digit', minute: '2-digit', hour12: false });
      o.btn = document.getElementById('ss-tz').textContent;
      document.getElementById('ss-reset').click(); o.reset = SL_TZ.chosen() === '';
      return o;
    });
    ok(r.auto, 'time zone: Automatic (the device\'s) by default');
    ok(r.inSettings && r.render, 'time zone: a row in Settings, drawn by SL_TZ_SETTING_RENDER');
    ok(r.badIgnored, 'time zone: an unknown zone is not saved');
    ok(r.saved, 'time zone: a chosen zone is saved (sl-tz) and announced');
    ok(r.fmt === '09:00', 'time zone: times are shown in the chosen zone (00:00 UTC = 09:00 Tokyo) - got ' + r.fmt);
    ok(/Tokyo/.test(r.btn), 'time zone: the Settings button names the choice');
    ok(r.reset, 'time zone: Reset to defaults goes back to Automatic');
    // the searchable list
    await p.evaluate(() => window.SL_OPEN_SETTINGS());
    await p.waitForTimeout(400);   // (Settings puts the focus on its close button first)
    await p.evaluate(() => document.getElementById('ss-tz').click());
    await p.waitForSelector('#sl-tz-menu:not([hidden])');
    const n = await p.evaluate(() => document.querySelectorAll('#sl-tz-menu li').length);
    ok(n > 300, 'time zone: the list holds every zone the browser knows (' + n + ')');
    await p.keyboard.type('tok');
    ok(await p.evaluate(() => document.querySelector('#sl-tz-menu li').getAttribute('data-z')) === 'Asia/Tokyo', 'time zone: typing "tok" puts Tokyo first');
    await p.keyboard.press('Enter');
    ok(await p.evaluate(() => localStorage.getItem('sl-tz') === 'Asia/Tokyo' && document.getElementById('sl-tz-menu').hidden), 'time zone: Enter chooses it and closes the list');
    ok(await p.evaluate(() => !!document.querySelector('#sl-settings:not([hidden])')), 'time zone: choosing in the list does not close Settings');
    ok(!p.errs.length, 'time zone: no page errors ' + p.errs.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------ no switch: nothing pretends (events preview loads at once)
  {
    const { ctx, p } = await page(b, '?preview=events');
    await ready(p);
    const r = await p.evaluate(() => ({ fp: SL_EVENTS.finalePreview, d: Math.abs(SL_EVENTS.time.display() - Date.now()) < 120000 }));
    ok(!r.fp && r.d, 'without the switch the countdown is not pretending');
    await p.goto(BASE + 'index.html?preview=events-off');
    await ctx.close();
  }

  // ------------------------------------------------ the finale preview: three pages at once
  const main = await page(b, '?countdown-finale-preview=1', { timezoneId: 'Asia/Tokyo' });
  const typer = await page(b, '?countdown-finale-preview=1');
  const calm = await page(b, '?countdown-finale-preview=1', { reducedMotion: 'reduce' });
  for (const x of [main, typer, calm]) await ready(x.p);
  const st = await main.p.evaluate(() => { const s = SL_EVENTS.countdownState(); return { left: s.left, kind: s.kind, fp: SL_EVENTS.finalePreview, trustedNow: SL_EVENTS.time.now() }; });
  ok(st.fp && st.kind === 'public' && st.left > 30000 && st.left <= 70000, 'preview: the start is pretended about 70 s away (' + Math.round(st.left / 1000) + ' s)');
  ok(st.trustedNow == null || Math.abs(st.trustedNow - Date.now()) < 120000, 'preview: the trusted clock (what unlocks) is not pretended');
  // the typer types into a field before the last minute
  await typer.p.evaluate(() => { const i = document.createElement('input'); i.id = 'tt'; i.style.cssText = 'position:fixed;top:0;left:0;z-index:99999'; document.body.appendChild(i); i.focus();
    window.__typing = setInterval(() => i.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })), 400); });
  // the colour changes the glow makes, as seen by the page itself
  await main.p.evaluate(() => { window.__cc = []; setInterval(() => { const f = document.getElementById('sl-ev-fin'); const c = f && f.getAttribute('data-c'); if (c && c !== window.__last) { window.__cc.push([performance.now(), c]); window.__last = c; } }, 20); });
  await main.p.waitForSelector('#sl-ev-cd', { timeout: 90000 });
  const at = await main.p.evaluate(() => SL_EVENTS.countdownState().left);
  ok(at <= 60000 && at > 50000, 'last minute: the big panel opened by itself (' + Math.round(at / 1000) + ' s left)');
  ok(await main.p.evaluate(() => document.querySelector('#sl-ev-cd .sl-ev-box').classList.contains('sl-ev-lastmin')), 'last minute: just the seconds, big');
  ok(await main.p.evaluate(() => /Asia\/Tokyo/.test(document.querySelector('#sl-ev-cd .sl-ev-tz').textContent) && /09:00|9:00/.test(document.querySelector('#sl-ev-cd .sl-ev-when b').textContent)), 'panel: "Starts" and "Your time zone" follow the time zone');
  await typer.p.waitForFunction(() => SL_EVENTS.countdownState().left < 58000, null, { timeout: 30000, polling: 50 });
  await typer.p.waitForTimeout(500);
  ok(!(await typer.p.evaluate(() => !!document.getElementById('sl-ev-cd'))) && await typer.p.evaluate(() => document.activeElement.id === 'tt'), 'last minute: not opened while typing');
  await typer.p.evaluate(() => { clearInterval(window.__typing); document.getElementById('tt').blur(); });
  const t0 = Date.now();
  await typer.p.waitForSelector('#sl-ev-cd', { state: 'attached', timeout: 15000 }).catch(() => {});
  ok(await typer.p.evaluate(() => !!document.getElementById('sl-ev-cd')), 'last minute: opened once they stopped typing / left the field (' + (Date.now() - t0) + ' ms)');
  await main.p.waitForFunction(() => { const f = document.getElementById('sl-ev-fin'); return f && f.getAttribute('data-c') === 'red'; }, null, { timeout: 70000, polling: 50 });
  await main.p.waitForTimeout(600);
  const tint = await main.p.evaluate(() => [...document.querySelectorAll('#sl-ev-fin > i')].map((i) => getComputedStyle(i).backgroundImage).join(' '));
  const alphas = (tint.match(/rgba\([^)]*\)/g) || []).map((s) => parseFloat(s.split(',')[3]));
  ok(alphas.length && Math.max(...alphas) <= 0.45, 'last 10 s: the glow is see-through (max alpha ' + Math.max(...alphas) + ')');
  ok(await main.p.evaluate(() => getComputedStyle(document.querySelector('#sl-ev-fin > i')).transitionDuration !== '0s'), 'last 10 s: colours fade softly');
  await calm.p.waitForSelector('#sl-ev-fin', { state: 'attached', timeout: 30000 });
  ok(await calm.p.evaluate(() => document.getElementById('sl-ev-fin').classList.contains('calm') && getComputedStyle(document.querySelector('#sl-ev-fin > .r')).transitionDuration === '0s'), 'reduce motion: a steady glow, no changes');
  await main.p.waitForFunction(() => { const f = document.getElementById('sl-ev-fin'); return f && f.getAttribute('data-c') === 'zero'; }, null, { timeout: 20000, polling: 50 });
  const cc = await main.p.evaluate(() => window.__cc.filter((x) => x[1] !== 'zero'));
  let worst = 0; for (let i = 0; i < cc.length; i++) { let k = 0; for (let j = i; j < cc.length && cc[j][0] - cc[i][0] < 1000; j++) k++; worst = Math.max(worst, k); }
  ok(cc.length >= 8 && worst <= 2, 'last 10 s: red and green alternate (' + cc.length + ' changes), at most 2 in any second (' + worst + ')');
  await main.p.waitForTimeout(400);
  const z = await main.p.evaluate(() => ({ boom: (document.querySelector('#sl-ev-cd .sl-ev-boom') || {}).textContent, go: SL_EVENTS.countdownState().go, xm: SL_EVENTS_CONFIG.xmasPublic }));
  ok(z.boom === 'SnakeList Christmas is here!', 'zero: "SnakeList Christmas is here!" (' + z.boom + ')');
  ok(z.go === null && z.xm === false, 'zero: the Christmas event is not switched on');
  await main.p.waitForFunction(() => !document.getElementById('sl-ev-fin'), null, { timeout: 15000 });
  ok(await main.p.evaluate(() => /coming to SnakeList today/.test(document.querySelector('#sl-ev-cd .sl-ev-hero').textContent)), 'after zero: the glow ends and the countdown carries on as usual (coming today)');
  for (const x of [main, typer, calm]) { ok(!x.p.errs.length, 'finale: no page errors ' + x.p.errs.join(' | ')); await x.ctx.close(); }
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
