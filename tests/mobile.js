// Phones, tablets and the installed app (docs/audit/mobile.md).
// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT --bind 127.0.0.1), then
//   PORT=<port> node tests/mobile.js [screenshot-dir]
// Checked:
//   - the app manifest and the iPhone tags: installable, standalone, any orientation (never forced sideways), maskable icon
//   - at 360x740, 390x844, 844x390 (a phone on its side), 820x1180 and 1180x820 (iPad) and with text at 200%: no sideways
//     scroll, the search and the tabs within reach, Settings' close button on the screen, the map never taller than the screen
//   - safe areas (an iPhone's status bar, notch and home bar): the header, the 3D viewer's close button and the full-screen
//     map's search keep clear of them
//   - Back closes the top panel (3D viewer, Settings, full-screen map) and SnakeList stays; a panel closed by its own X or
//     Escape leaves no dead Back step; Back between tabs works as before
//   - the on-screen keyboard: a search box with suggestions under it is moved up so they are not under the keyboard
//   - turning the phone keeps the search text and a half-typed sighting
//   - the "new version" Refresh asks first in the middle of a quiz; its bar keeps clear of the status bar
//   - offline: the offline helper's own page when nothing is saved; the app says it is offline
//   - the installed app put away and opened again within 5 minutes: no opening again; a page frozen in the background and
//     woken up: no opening again, the same place
//   - the "mobile" preview: off for everyone (no class); on, a shorter header on phones
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 8766, BASE = 'http://127.0.0.1:' + PORT + '/';
const SHOTS = process.argv[2] || null;
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const SKIP = ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen'];
const STATE = { done: ['boa-constrictor'], wish: [], follow: [] };
const PHONE_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const TAB_UA = 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function open(b, w, h, opt) {
  opt = opt || {};
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: Math.min(w, h) >= 700 ? TAB_UA : PHONE_UA });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  await p.addInitScript(([k, st, o]) => {
    k.forEach((x) => localStorage.setItem(x, '1')); localStorage.setItem('sl-consent', 'essential');
    if (!localStorage.getItem('sl-test-seeded')) { localStorage.setItem('sl-web-state', st); localStorage.setItem('sl-test-seeded', '1'); }
    if (o.pv) localStorage.setItem('sl-art-preview-' + o.pv, '1');
    if (o.standalone) Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => true });
    if (o.hiddenAgo != null && !sessionStorage.getItem('zz-once')) { sessionStorage.setItem('zz-once', '1'); localStorage.setItem('sl-hidden-at', String(Date.now() - o.hiddenAgo)); }
  }, [SKIP, JSON.stringify(STATE), opt]);
  const cdp = await ctx.newCDPSession(p);
  if (opt.text) { await cdp.send('Page.enable'); await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } }); }
  if (opt.insets) await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: opt.insets });
  return { ctx, p, errs, cdp };
}
async function enter(p, url) {
  await p.goto(BASE + (url || 'index.html'), { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => window.__introDone && document.getElementById('grid'), null, { timeout: 150000 });
  await p.waitForTimeout(1200);
  await p.click('#hero-cue', { timeout: 4000 }).catch(() => {});
  await p.waitForFunction(() => window.__heroEntered || !document.querySelector('#sl-hero:not([hidden])'), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(2000);
  await p.evaluate(() => document.querySelectorAll('.sl-nudge, .keep-nudge').forEach((e) => e.remove()));
}
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, name + '.png') }); };

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  // ---------------------------------------------------------------- the manifest and the head
  {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/snakelist.webmanifest'), 'utf8'));
    const old = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/manifest.webmanifest'), 'utf8'));
    ok(m.name && m.short_name && m.short_name.length <= 12, 'manifest: name and a short name (' + m.short_name + ')');
    ok(m.display === 'standalone' && m.start_url && m.scope && m.id, 'manifest: standalone, start_url, scope and id');
    ok(!/landscape|portrait/.test(m.orientation || ''), 'manifest: the orientation is not forced (' + m.orientation + ')');
    ok(m.icons.some((i) => /maskable/.test(i.purpose) && /512/.test(i.sizes)) && m.icons.some((i) => /any/.test(i.purpose || 'any') && /192/.test(i.sizes)), 'manifest: 192 and 512 icons, one of them maskable');
    ok(m.icons.every((i) => fs.existsSync(path.join(ROOT, 'app', i.src))), 'manifest: every icon file is there');
    ok(/^#[0-9a-f]{6}$/i.test(m.theme_color) && /^#[0-9a-f]{6}$/i.test(m.background_color), 'manifest: theme and background colours');
    ok(JSON.stringify(old) === JSON.stringify(m), 'the older manifest name says the same');
    const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').slice(0, 20000);
    ok(/name="viewport" content="[^"]*viewport-fit=cover/.test(idx) && /rel="apple-touch-icon"/.test(idx) && /apple-mobile-web-app-capable/.test(idx) && /name="theme-color"/.test(idx) && /rel="manifest"/.test(idx),
      'index.html: viewport-fit=cover, apple-touch-icon, iPhone app tags, theme colour, manifest');
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    ok(/You are offline/.test(sw) && /const offline = /.test(sw), 'the offline helper has its own "you are offline" page for a page that was never saved');
  }
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  try {
    // ---------------------------------------------------------------- sizes
    for (const [w, h, text] of [[360, 740], [390, 844], [844, 390], [820, 1180], [1180, 820], [390, 844, true]]) {
      const L = w + 'x' + h + (text ? ' text 200%' : '');
      const { ctx, p, errs } = await open(b, w, h, { text });
      await enter(p);
      const m = await p.evaluate(() => {
        const t = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : -1; };
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, tabs: t('.tabs'), search: t('#search'), vh: innerHeight };
      });
      ok(m.sw <= m.cw, L + ': no sideways scroll (' + m.sw + ' <= ' + m.cw + ')');
      ok(m.search > 0 && m.search < m.vh * 1.6 + 200, L + ': the search is near the top (' + m.search + ' px down, screen ' + m.vh + ')');
      await shot(p, 'm-' + w + 'x' + h + (text ? '-text' : '') + '-home');
      await p.evaluate(() => window.SL_OPEN_SETTINGS()); await p.waitForTimeout(1200);
      const s = await p.evaluate(() => { const d = document.getElementById('sl-settings'); const x = d && [].filter.call(d.querySelectorAll('button'), (b) => /close/i.test(b.getAttribute('aria-label') || '') && b.getClientRects().length)[0]; const r = x && x.getBoundingClientRect(); return r ? { t: r.top, b: r.bottom, l: r.left, r: r.right, vw: innerWidth, vh: innerHeight } : null; });
      ok(s && s.t >= 0 && s.b <= s.vh && s.l >= 0 && s.r <= s.vw, L + ': Settings\' close button is on the screen ' + JSON.stringify(s));
      await p.keyboard.press('Escape'); await p.waitForTimeout(600);
      await p.click('#tab-map'); await p.waitForTimeout(2500);
      const g = await p.evaluate(() => { const e = document.getElementById('globe-stage'); const r = e.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), vh: innerHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
      ok(g.h <= g.vh - 40 && g.h >= 180, L + ': the map is never taller than the screen, so there is page to scroll with (' + g.h + ' of ' + g.vh + ')');
      ok(g.sw <= g.cw, L + ': map tab: no sideways scroll');
      ok(errs.length === 0, L + ': no page errors ' + JSON.stringify(errs.slice(0, 2)));
      await ctx.close();
    }
    // ---------------------------------------------------------------- safe areas (an iPhone: status bar, notch, home bar)
    for (const [w, h, ins] of [[390, 844, { top: 47, bottom: 34, left: 0, right: 0 }], [844, 390, { top: 0, bottom: 21, left: 47, right: 47 }]]) {
      const L = 'safe areas ' + w + 'x' + h;
      const { ctx, p, errs } = await open(b, w, h, { insets: ins });
      await enter(p);
      const hd = await p.evaluate(() => { scrollTo(0, 0); const r = document.querySelector('.sl-header').getBoundingClientRect(); return { t: r.top, l: r.left, r: r.right }; });
      ok(hd.t >= ins.top && hd.l >= ins.left && hd.r <= w - ins.right, L + ': the header is clear of the status bar / notch ' + JSON.stringify(hd));
      await p.evaluate(() => { const x = document.querySelector('#grid .td-card-btn'); x.scrollIntoView(); x.click(); }); await p.waitForTimeout(2500);
      const x = await p.evaluate(() => { const e = document.querySelector('.sl3d-x'); const r = e && e.getBoundingClientRect(); return r && { t: r.top, l: r.left, r: r.right }; });
      ok(x && x.t >= ins.top && x.r <= w - ins.right, L + ': the 3D viewer\'s close button is clear of them ' + JSON.stringify(x));
      await shot(p, 'm-safe-' + w + 'x' + h + '-3d');
      await p.keyboard.press('Escape'); await p.waitForTimeout(800);
      await p.click('#tab-map'); await p.waitForTimeout(1500); await p.click('#globe-full'); await p.waitForTimeout(1800);
      const q = await p.evaluate(() => { const e = document.querySelector('.globe-stage.full .heat-search'); const r = e && e.getBoundingClientRect(); return r && { t: r.top, l: r.left, r: r.right }; });
      ok(q && q.t >= ins.top && q.l >= ins.left && q.r <= w - ins.right, L + ': the full-screen map\'s search is clear of them ' + JSON.stringify(q));
      ok(errs.length === 0, L + ': no page errors ' + JSON.stringify(errs.slice(0, 2)));
      await ctx.close();
    }
    // ---------------------------------------------------------------- Back, the keyboard, turning the phone, Refresh
    {
      const L = 'phone';
      const { ctx, p, errs } = await open(b, 390, 844);
      await enter(p);
      const st = () => p.evaluate(() => ({ L: window.SL_LAYERS(), url: location.pathname + location.search, full: document.body.classList.contains('map-full') }));
      await p.evaluate(() => { const x = document.querySelector('#grid .td-card-btn'); x.scrollIntoView(); x.click(); }); await p.waitForTimeout(2500);
      ok((await st()).L.length === 1, L + ': the 3D viewer is open');
      await p.goBack({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1200);
      let s = await st();
      ok(s.L.length === 0 && s.url === '/index.html', L + ': Back closes the 3D viewer and SnakeList stays ' + JSON.stringify(s));
      const n0 = await p.evaluate(() => history.length);
      await p.evaluate(() => window.SL_OPEN_SETTINGS()); await p.waitForTimeout(2200);
      await p.keyboard.press('Escape'); await p.waitForTimeout(1500);
      s = await p.evaluate(() => ({ L: window.SL_LAYERS(), state: history.state, depth: window.SL_BACK_DEPTH() }));
      ok(s.L.length === 0 && !(s.state && s.state.slLayer) && s.depth === 0, L + ': Settings closed by Escape leaves no dead Back step ' + JSON.stringify(s) + ' (history ' + n0 + ')');
      await p.click('#tab-map'); await p.waitForTimeout(1200);
      await p.goBack({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1200);
      ok(await p.evaluate(() => document.querySelector('.tab-btn.active').id === 'tab-guide' && location.pathname === '/index.html'), L + ': Back between tabs works as before');
      await p.click('#tab-map'); await p.waitForTimeout(1200); await p.click('#globe-full'); await p.waitForTimeout(2000);
      ok((await st()).full, L + ': full-screen map is on');
      await p.goBack({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1500);
      s = await st();
      ok(!s.full && /tab=map/.test(s.url), L + ': Back leaves the full-screen map, still on the Map tab ' + JSON.stringify(s));
      // the on-screen keyboard (its height given to visualViewport, as a phone does)
      const kb = await p.evaluate(async () => {
        const el = document.getElementById('heat-search'); el.scrollIntoView({ block: 'end' }); await new Promise((r) => setTimeout(r, 300));
        el.focus(); const vv = visualViewport; Object.defineProperty(vv, 'height', { configurable: true, get: () => innerHeight - 330 });
        vv.dispatchEvent(new Event('resize')); await new Promise((r) => setTimeout(r, 700));
        const out = { room: Math.round(innerHeight - 330 - el.getBoundingClientRect().bottom), kb: getComputedStyle(document.documentElement).getPropertyValue('--sl-kb').trim(), cls: document.documentElement.classList.contains('sl-kb') };
        delete vv.height; vv.dispatchEvent(new Event('resize')); el.blur(); await new Promise((r) => setTimeout(r, 500));
        out.gone = !document.documentElement.classList.contains('sl-kb'); return out;
      });
      ok(kb.room >= 200 && kb.kb === '330px' && kb.cls && kb.gone, L + ': with the keyboard up the map search moves up, its suggestions have room above the keyboard ' + JSON.stringify(kb));
      // turning the phone: the search text and a half-typed sighting stay
      await p.click('#tab-guide'); await p.waitForTimeout(800);
      await p.fill('#search', 'boa constrictor'); await p.waitForTimeout(1200);
      await p.evaluate(() => { const x = document.querySelector('#grid .card.done .note-btn'); x.scrollIntoView(); x.click(); }); await p.waitForTimeout(1000);
      await p.fill('#note-where', 'Tortuguero'); await p.waitForTimeout(300);
      await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(1500);
      await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(1500);
      const rot = await p.evaluate(() => ({ q: document.getElementById('search').value, where: document.getElementById('note-where').value, open: !!document.querySelector('.note-sheet.open'), sw: document.documentElement.scrollWidth }));
      ok(rot.q === 'boa constrictor' && rot.where === 'Tortuguero' && rot.open && rot.sw <= 390, L + ': turning the phone keeps the search and the half-typed sighting ' + JSON.stringify(rot));
      ok((await p.evaluate(() => window.SL_BUSY())) !== '', L + ': Refresh would ask first with a sighting open');
      // Back with a half-typed sighting: the sheet's own "you haven't saved this" first (nothing lost), Back again closes it
      await p.goBack({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1200);
      const w1 = await p.evaluate(() => ({ open: !!document.querySelector('.note-sheet.open'), warn: !document.getElementById('note-err').hidden, where: document.getElementById('note-where').value, url: location.pathname }));
      ok(w1.open && w1.warn && w1.where === 'Tortuguero' && w1.url === '/index.html', L + ': Back on a half-typed sighting first warns, the text stays ' + JSON.stringify(w1));
      await p.goBack({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1200);
      ok(await p.evaluate(() => !document.querySelector('.note-sheet.open') && location.pathname === '/index.html'), L + ': Back again closes the sighting sheet and SnakeList stays');
      // the "new version" Refresh in the middle of a quiz
      await p.click('#tab-quiz'); await p.waitForTimeout(1000);
      await p.click('.quiz-level-btn[data-level="easy"]').catch(() => {}); await p.waitForTimeout(1500);
      await p.evaluate(() => { window.__zzStay = 1; window.SL_SHOW_NEW(true); });
      let asked = '';
      p.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
      await p.click('#sl-newver button'); await p.waitForTimeout(1500);
      ok(/quiz/i.test(asked) && await p.evaluate(() => window.__zzStay === 1), L + ': in a quiz, Refresh asks first and "Cancel" keeps the quiz (' + asked.slice(0, 50) + ')');
      ok(errs.length === 0, L + ': no page errors ' + JSON.stringify(errs.slice(0, 2)));
      await ctx.close();
    }
    {
      const { ctx, p } = await open(b, 390, 844, { insets: { top: 47, bottom: 34, left: 0, right: 0 } });
      await enter(p);
      await p.evaluate(() => window.SL_SHOW_NEW(true));
      const t = await p.evaluate(() => document.getElementById('sl-newver').getBoundingClientRect().top);
      ok(t >= 47, 'the "new version" bar keeps clear of the status bar (' + Math.round(t) + ')');
      await ctx.close();
    }
    // ---------------------------------------------------------------- offline
    {
      const { ctx, p } = await open(b, 390, 844);
      await enter(p);
      await p.evaluate(() => navigator.serviceWorker.register('sw.js'));
      await p.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true), null, { timeout: 60000 });
      await p.evaluate(() => navigator.serviceWorker.ready);
      await p.evaluate(async () => { const c = await caches.open('snakelist-v8'); await c.delete('./'); (await c.keys()).forEach((k) => { if (new URL(k.url).pathname === '/' || /index\.html$/.test(k.url)) c.delete(k); }); });
      await ctx.setOffline(true);
      const p2 = await ctx.newPage();
      await p2.goto(BASE + 'about-never-saved.html', { timeout: 30000 }).catch(() => {});
      const txt = await p2.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
      ok(/You are offline/.test(txt) && /needs a connection/.test(txt), 'offline, a page never saved: the offline helper says so plainly (' + txt.slice(0, 40).replace(/\n/g, ' ') + ')');
      await ctx.setOffline(false);
      await p.evaluate(() => window.dispatchEvent(new Event('offline')));
      await ctx.close();
    }
    // ---------------------------------------------------------------- coming back
    {
      // the installed app, put away a minute ago and opened again (the phone had thrown the page away)
      const { ctx, p } = await open(b, 390, 844, { standalone: true, hiddenAgo: 60000 });
      await p.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded', timeout: 180000 });
      const r = await p.evaluate(() => ({ back: !!window.SL_CAME_BACK, lock: document.documentElement.classList.contains('sl-intro-lock') }));
      ok(r.back && !r.lock, 'installed app reopened within 5 minutes of being put away: no opening again ' + JSON.stringify(r));
      await ctx.close();
      const o = await open(b, 390, 844, { standalone: true, hiddenAgo: 3600000 });
      await o.p.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded', timeout: 180000 });
      const r2 = await o.p.evaluate(() => ({ back: !!window.SL_CAME_BACK, lock: document.documentElement.classList.contains('sl-intro-lock') }));
      ok(!r2.back && r2.lock, 'an hour later: the opening plays as usual ' + JSON.stringify(r2));
      await o.ctx.close();
    }
    {
      // frozen in the background (another app, a link to iNaturalist...) and woken up: same place, no opening
      const { ctx, p, cdp } = await open(b, 390, 844);
      await enter(p);
      await p.evaluate(() => scrollTo(0, 1500)); await p.waitForTimeout(500);
      const y0 = await p.evaluate(() => scrollY);
      await cdp.send('Page.enable'); await cdp.send('Page.setWebLifecycleState', { state: 'frozen' }); await p.waitForTimeout(1500);
      await cdp.send('Page.setWebLifecycleState', { state: 'active' }); await p.waitForTimeout(1500);
      const r = await p.evaluate(() => ({ y: scrollY, intro: !!document.querySelector('#intro:not([hidden]):not(.intro-gone)') && getComputedStyle(document.getElementById('intro')).display !== 'none', lock: document.documentElement.classList.contains('sl-intro-lock'), away: !!localStorage.getItem('sl-hidden-at') }));
      ok(Math.abs(r.y - y0) < 5 && !r.lock && !r.intro, 'woken up from the background: same place, no opening ' + JSON.stringify(r));
      await ctx.close();
    }
    // ---------------------------------------------------------------- the "mobile" preview
    {
      const { ctx, p } = await open(b, 390, 844);
      await enter(p);
      const off = await p.evaluate(() => ({ cls: document.documentElement.classList.contains('sl-pv-mobile'), sub: getComputedStyle(document.querySelector('.sl-sub')).display, h: Math.round(document.querySelector('.sl-header').getBoundingClientRect().height) }));
      ok(!off.cls && off.sub !== 'none', 'preview off (everyone): the header as today ' + JSON.stringify(off));
      await ctx.close();
      const o = await open(b, 390, 844);
      await enter(o.p, 'index.html?preview=mobile');
      const on = await o.p.evaluate(() => ({ cls: document.documentElement.classList.contains('sl-pv-mobile'), sub: getComputedStyle(document.querySelector('.sl-sub')).display, h: Math.round(document.querySelector('.sl-header').getBoundingClientRect().height), sw: document.documentElement.scrollWidth }));
      ok(on.cls && on.sub === 'none' && on.h < off.h - 60 && on.sw <= 390, 'preview on: a shorter header on a phone ' + JSON.stringify(on));
      await shot(o.p, 'm-preview-390x844-home');
      await o.ctx.close();
    }
  } catch (e) { ok(false, 'crashed: ' + (e && e.stack || e)); }
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
