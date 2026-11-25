// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT --bind 127.0.0.1), then
//   PORT=<port> node tests/opening-cinematic.js [screenshot-dir] [video-dir]
// PREVIEW "cinematic" (?opening=cinematic) - the cinematic opening: a dark tropical scene, the logo assembled from its letters
// and tick on curved paths, a warm gold light, the opening photo revealed, the logo gliding onto the photo's own logo.
// Checked (computer 1440 x 900, phone 390 x 844, iPad 1180 x 820, ultra-wide 2560 x 1080):
//   * it runs on one timeline: no long task over 100 ms from the start of the assembly to the hand-over (the moving parts are
//     Web Animations on transforms and opacity, so the graphics chip plays them); the whole thing ends within ~4-7 s
//   * Skip is there from the first frame, inside the screen and clear of the safe areas, and ends it quickly (no jump to the top)
//   * a scroll during the sequence ends it and carries on down into SnakeList, at its top
//   * the first visit plays the whole opening, a returning visitor a short one; a reload right after does not play it again
//   * prefers-reduced-motion: the letters fade in where they are (no flight), then a fade to the photo
//   * a link straight to a species: no opening at all
//   * the preview off: the opening is exactly the old one (wall of photos, no cinematic scene, nothing extra built)
//   * the photo and the logo are ready before the light opens onto them; no page errors
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const PORT = process.env.PORT || 8766, BASE = 'http://127.0.0.1:' + PORT + '/' + (process.env.PAGE || '');
const SHOTS = process.argv[2] || null, VIDEO = process.argv[3] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const SIZES = { computer: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ipad: { viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, wide: { viewport: { width: 2560, height: 1080 } } };

function inPage() {
  const L = window.__OC = { lt: [], done: 0, ev: [] };
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => L.lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  document.addEventListener('sl-intro-done', () => { L.done++; L.doneAt = performance.now(); L.yAtDone = scrollY; });
  document.addEventListener('sl-hero-entered', () => { L.enteredAt = performance.now(); });
}
async function open(b, o) {
  const opts = Object.assign({}, SIZES[o.size || 'computer'], o.reduce ? { reducedMotion: 'reduce' } : {});
  if (o.video) opts.recordVideo = { dir: o.video, size: { width: opts.viewport.width > 1500 ? 1280 : opts.viewport.width, height: opts.viewport.width > 1500 ? Math.round(1280 * opts.viewport.height / opts.viewport.width) : opts.viewport.height } };
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  await p.addInitScript(([seen, cine]) => {
    if (sessionStorage.getItem('oc-seeded')) return; sessionStorage.setItem('oc-seeded', '1');
    ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen'].forEach((k) => localStorage.setItem(k, '1'));
    localStorage.setItem('sl-consent', 'essential');
    if (seen) localStorage.setItem('sl-cine-seen', '1');
    if (cine === false) localStorage.setItem('sl-art-preview-cinematic', '0');
  }, [!!o.seen, o.cine]);
  await p.addInitScript(inPage);
  let navs = 0; p.on('framenavigated', (f) => { if (f === p.mainFrame()) navs++; });
  await p.goto(BASE + (o.path == null ? '?opening=cinematic' : o.path), { waitUntil: 'commit', timeout: 120000 });
  return { ctx, p, errs, navs: () => navs };
}
const st = (p) => p.evaluate(() => ({ s: window.SL_CINE && window.SL_CINE.state(), a: window.SL_CINE && window.SL_CINE.assembleAt, r: window.SL_CINE && window.SL_CINE.revealAt, oc: window.__OC, y: scrollY,
  intro: (document.getElementById('intro') || {}).className, done: !!window.__introDone }));
const waitDone = (p, ms) => p.waitForFunction(() => window.__introDone, null, { timeout: ms || 60000 }).then(() => true, () => false);
async function shot(p, name) { if (SHOTS) await p.screenshot({ path: SHOTS + '/' + name + '.png' }); }

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    // 1. the whole opening, first visit, every screen size
    for (const size of (process.env.SIZES || 'computer,phone,ipad,wide').split(',')) {
      const s = await open(b, { size, video: VIDEO && (size === 'computer' || size === 'phone') ? VIDEO + '/' + size : null });
      await s.p.waitForSelector('#intro.intro-cine .cine-skip', { timeout: 30000 });
      const ui = await s.p.evaluate(() => { const r = document.querySelector('.cine-skip').getBoundingClientRect(), q = document.querySelector('.cine-snd').getBoundingClientRect();
        return { t: r.top, r: r.right, b: r.bottom, l: q.left, w: innerWidth, h: innerHeight, vis: getComputedStyle(document.querySelector('.cine-ui')).visibility }; });
      ok(ui.t >= 8 && ui.r <= ui.w - 8 && ui.l >= 0 && ui.vis === 'visible', size + ': Skip and Sound are on screen from the start, clear of the edges (' + Math.round(ui.t) + 'px from the top, ' + Math.round(ui.w - ui.r) + 'px from the right)');
      await s.p.waitForFunction(() => window.SL_CINE && window.SL_CINE.state().phase !== 'atmos', null, { timeout: 30000 });
      await s.p.waitForTimeout(600); await shot(s.p, 'cine-assembling-' + size);
      // the lock: every piece has landed
      await s.p.waitForFunction(() => { const a = document.getAnimations().filter((x) => x.effect && x.effect.target && x.effect.target.classList && x.effect.target.classList.contains('cine-pc')); return a.length && a.every((x) => x.playState === 'finished'); }, null, { timeout: 30000 }).catch(() => {});
      const mk = await s.p.evaluate(() => { const r = document.querySelector('.intro-line').getBoundingClientRect(); return { n: window.SL_CINE.state().pieces, l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight }; });
      ok(mk.n === 10, size + ': the logo is built from 10 pieces (S, n-a-k-e, L-i-s-t, tick): ' + mk.n);
      ok(mk.l >= 0 && mk.r <= mk.w && mk.t >= 0 && mk.b <= mk.h, size + ': the assembled logo fits the screen (' + [mk.l, mk.r, mk.t, mk.b].map(Math.round).join(', ') + ' in ' + mk.w + 'x' + mk.h + ')');
      await shot(s.p, 'cine-assembled-' + size);
      ok(await waitDone(s.p), size + ': the opening ends');
      await s.p.waitForTimeout(1500);
      const r = await st(s.p);
      const seq = [r.a, r.oc.doneAt], dur = seq[1] - seq[0];
      const lts = r.oc.lt.filter((x) => x[0] + x[1] > seq[0] && x[0] < seq[1] && x[1] > 100);
      ok(r.s.full && r.s.photoOk, size + ': the whole opening, the photo decoded before the reveal');
      ok(dur > 2500 && dur < 7500, size + ': assembly to hand-over took ' + Math.round(dur) + ' ms (whole page: start ' + Math.round(r.a) + ' ms, hand-over ' + Math.round(r.oc.doneAt) + ' ms)');
      ok(!lts.length, size + ': no long task over 100 ms during the sequence ' + JSON.stringify(lts));
      ok(r.oc.done === 1 && s.navs() === 1, size + ': it played once, no reload');
      const hero = await s.p.evaluate(() => { const b = document.getElementById('hero-go-btn'), r = b.getBoundingClientRect(), t = document.querySelector('#sl-hero .hero-title'), im = document.querySelector('#sl-hero .hero-media img:not(.hero-fill)');
        return { btn: r.width > 0 && r.bottom <= innerHeight && getComputedStyle(b).opacity > 0.9, title: getComputedStyle(t).opacity, img: im && im.complete && im.naturalWidth > 0, scene: !!document.querySelector('.cine'), seen: localStorage.getItem('sl-cine-seen') }; });
      ok(hero.btn && +hero.title > 0.9 && hero.img, size + ': then the photo, its logo and the Explore button are on screen');
      if (hero.scene) hero.scene = !(await s.p.waitForFunction(() => !document.querySelector('.cine'), null, { timeout: 8000 }).then(() => true, () => false));
      ok(!hero.scene && hero.seen === '1', size + ': the scene is taken away afterwards, and remembered as seen');
      await shot(s.p, 'cine-end-' + size);
      ok(!s.errs.length, size + ': no page errors ' + s.errs.join(' | '));
      if (size === 'computer') {
        await s.p.reload({ waitUntil: 'commit' }); await s.p.waitForTimeout(2500);
        ok(await s.p.evaluate(() => !window.SL_CINE && (!document.getElementById('intro') || document.getElementById('intro').classList.contains('intro-gone'))), 'computer: a reload right after does not play it again');
      }
      await s.ctx.close();
    }
    // 2. returning: the short version
    let s = await open(b, { seen: true });
    await waitDone(s.p);
    let r = await st(s.p);
    ok(r.s && !r.s.full && r.oc.doneAt - r.a < 4200, 'returning: the short version (' + Math.round(r.oc.doneAt - r.a) + ' ms from assembly to hand-over)');
    await s.ctx.close();
    // 3. Skip
    s = await open(b, {});
    await s.p.waitForFunction(() => window.SL_CINE && window.SL_CINE.state().phase === 'assemble', null, { timeout: 30000 });
    await s.p.waitForTimeout(400);
    const t0 = await s.p.evaluate(() => performance.now());
    await s.p.focus('.cine-skip'); await s.p.keyboard.press('Enter'); // (with the keyboard: Skip is a real button)
    ok(await waitDone(s.p, 15000), 'Skip: the opening ends');
    r = await st(s.p);
    ok(r.s.skipped && r.oc.doneAt - t0 < 3000, 'Skip: it ends quickly (' + Math.round(r.oc.doneAt - t0) + ' ms after the click; whatever was left plays 4x faster)');
    ok(r.oc.yAtDone === 0 && r.y === 0, 'Skip: nothing jumps - the page stays at the top, on the photo');
    ok(await s.p.evaluate(() => !window.__heroEntered && !document.getElementById('sl-hero').hidden), 'Skip: the photo is shown (not skipped past)');
    await s.ctx.close();
    // 4. a scroll during the sequence: it ends and carries on into SnakeList
    s = await open(b, {});
    await s.p.waitForFunction(() => window.SL_CINE && window.SL_CINE.state().phase === 'assemble', null, { timeout: 30000 });
    await s.p.mouse.move(700, 450); await s.p.mouse.wheel(0, 400);
    ok(await waitDone(s.p, 15000), 'scroll: the opening ends');
    ok(await s.p.waitForFunction(() => window.__heroEntered, null, { timeout: 20000 }).then(() => true, () => false), 'scroll: it carries on down into SnakeList');
    await s.p.waitForTimeout(800);
    r = await st(s.p);
    ok(r.y < 5, 'scroll: SnakeList is shown from its top (scroll ' + r.y + ')');
    ok(!s.errs.length, 'scroll: no page errors ' + s.errs.join(' | '));
    await s.ctx.close();
    // 5. reduced motion: no flights - the logo fades in where it is, then a fade to the photo
    s = await open(b, { reduce: true });
    await s.p.waitForFunction(() => window.SL_CINE && window.SL_CINE.state().phase !== 'atmos', null, { timeout: 30000 });
    const moves = await s.p.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.classList && a.effect.target.classList.contains('cine-pc'))
      .some((a) => a.effect.getKeyframes().some((k) => k.transform && k.transform !== 'none')));
    ok(!moves, 'reduced motion: the letters do not fly in (only fade)');
    ok(await waitDone(s.p), 'reduced motion: the opening ends');
    r = await st(s.p);
    ok(r.s.calm && !s.errs.length, 'reduced motion: the calm version ran, no page errors');
    await shot(s.p, 'cine-reduced-end');
    await s.ctx.close();
    // 6. a link to a species: no opening at all
    s = await open(b, { path: '?opening=cinematic&sp=ahaetulla-prasina' });
    await s.p.waitForTimeout(3000);
    ok(await s.p.evaluate(() => !window.SL_CINE && !document.querySelector('.cine')), 'species link: no cinematic opening');
    await s.ctx.close();
    // 7. the preview off: the old opening, untouched
    s = await open(b, { path: '', cine: false });
    await s.p.waitForTimeout(1200);
    const off = await s.p.evaluate(() => ({ cine: !!window.SL_CINE, on: !!window.SL_CINE_ON, scene: !!document.querySelector('.cine, .cine-ui, .cine-mark'), wall: !!document.querySelector('#intro .photo-wall .ph'), cls: document.getElementById('intro').className, n: window.SL_HERO_PHOTOS.length }));
    ok(!off.cine && !off.on && !off.scene && off.wall && !/cine/.test(off.cls), 'preview off: the old opening (wall of photos), nothing cinematic built (' + off.cls + ')');
    ok(off.n === 15, 'preview off: the opening photos are the same 15 as before');
    let glided = false; s.p.on('console', () => {});
    ok(await waitDone(s.p, 60000), 'preview off: the old opening ends');
    glided = await s.p.evaluate(() => document.getElementById('intro').classList.contains('intro-glide') || document.getElementById('intro').classList.contains('intro-gone'));
    ok(glided && !s.errs.length, 'preview off: it hands over to the photo as before, no page errors');
    await s.ctx.close();
  } catch (e) { ok(false, 'crashed: ' + (e && e.stack || e)); }
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
