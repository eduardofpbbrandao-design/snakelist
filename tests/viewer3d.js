// Reliability tests for the "Explore in 3D" species viewer (species/3d/viewer.js).
// Run: python3 build-site.py; python3 -m http.server 8857 (repo root); node tests/viewer3d.js
// Env: BASE (default http://127.0.0.1:8857), OUT (folder for screenshots and test-results.txt; default tests/out/).
// Needs Playwright with Chromium; WebGL runs on SwiftShader. External requests are aborted, so it runs offline.
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const OUT = (process.env.OUT || path.join(__dirname, 'out')).replace(/\/?$/, '/');
fs.mkdirSync(OUT, { recursive: true });
const BASE = (process.env.BASE || 'http://127.0.0.1:8857').replace(/\/$/, '') + '/species/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const results = [];
const ok = (name, cond, info) => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (info ? ' :: ' + info : '')); if (!cond) process.exitCode = 1; };
const COUNT_LISTENERS = () => {
  const live = new Map(); window.__lc = live;
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  const key = (t, ty, fn, o) => { if (!t.__lid) t.__lid = Math.random().toString(36).slice(2); return t.__lid + '|' + ty + '|' + (fn && (fn.__fid || (fn.__fid = Math.random().toString(36).slice(2)))) + '|' + !!(o === true || (o && o.capture)); };
  EventTarget.prototype.addEventListener = function (ty, fn, o) { if (fn) live.set(key(this, ty, fn, o), ty); return add.call(this, ty, fn, o); };
  EventTarget.prototype.removeEventListener = function (ty, fn, o) { if (fn) live.delete(key(this, ty, fn, o)); return rem.call(this, ty, fn, o); };
  window.__lcount = () => live.size;
};

let lastCtx = null;
async function newPage(br, opts = {}) {
  if (lastCtx) await lastCtx.close().catch(() => {}); // one page at a time: software WebGL is slow and memory-hungry
  const ctx = lastCtx = await br.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, opts.ctx || {}));
  const pg = await ctx.newPage();
  const reqs = [];
  pg.on('request', (r) => reqs.push(r.url()));
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await pg.addInitScript(COUNT_LISTENERS);
  await pg.addInitScript(() => { window.SL_3D_TEST = true; });
  if (opts.init) await pg.addInitScript(opts.init);
  return { ctx, pg, reqs, errs };
}
const settle = (pg) => pg.waitForFunction(() => { const st = window.__sp3d.controls.st; return !st.goal && !st.vaz && !st.vel && !st.dragging; }, null, { timeout: 20000 }).catch(() => {});
const waitViewer = (pg) => pg.waitForFunction(() => window.__sp3d && document.querySelector('.sp-rl .sp3d-canvas'), null, { timeout: 90000 });

(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ARGS });

  // 1. on-demand loading, open/close/reopen x5, listener stability, one canvas
  {
    const { pg, reqs, errs } = await newPage(br);
    await pg.goto(BASE + 'western-diamond-backed-rattlesnake-crotalus-atrox.html');
    await pg.waitForTimeout(500);
    ok('three.js and viewer not loaded before opening', !reqs.some((u) => /three\.module|viewer\.js|models\.json/.test(u)));
    const base = await pg.evaluate(() => window.__lcount());
    const counts = [];
    for (let i = 0; i < 5; i++) {
      await pg.click('.sp-realbtn');
      await waitViewer(pg);
      await pg.waitForTimeout(200);
      counts.push({ open: await pg.evaluate(() => window.__lcount()), canvases: await pg.evaluate(() => document.querySelectorAll('canvas.sp3d-canvas').length), dialogs: await pg.evaluate(() => document.querySelectorAll('dialog.sp-rl').length) });
      await pg.click('.sp-rl-x');
      await pg.waitForTimeout(200);
      counts[i].closed = await pg.evaluate(() => window.__lcount());
      counts[i].canvasAfterClose = await pg.evaluate(() => document.querySelectorAll('canvas.sp3d-canvas').length);
    }
    ok('loaded on first open', reqs.some((u) => /three\.module\.min\.js/.test(u)) && reqs.some((u) => /3d\/viewer\.js/.test(u)));
    ok('exactly one canvas while open, every time', counts.every((c) => c.canvases === 1 && c.dialogs === 1), JSON.stringify(counts.map((c) => c.canvases)));
    ok('no canvas left after closing', counts.every((c) => c.canvasAfterClose === 0));
    ok('listener count stable across 5 open/close cycles', counts.every((c) => c.open === counts[0].open && c.closed === counts[0].closed), 'baseline ' + base + ', ' + JSON.stringify(counts.map((c) => [c.open, c.closed])));
    ok('three.js fetched once (cached module)', reqs.filter((u) => /three\.module\.min\.js/.test(u)).length === 1, String(reqs.filter((u) => /three\.module/.test(u)).length));
    ok('no page errors (atrox)', errs.length === 0, errs.join(' | '));

    // keyboard, orbit limits, zoom limits
    await pg.click('.sp-realbtn'); await waitViewer(pg);
    await pg.focus('.sp3d-canvas');
    const az0 = await pg.evaluate(() => window.__sp3d.controls.st.az);
    await pg.keyboard.press('ArrowLeft'); await settle(pg);
    const az1 = await pg.evaluate(() => window.__sp3d.controls.st.az);
    ok('arrow key orbits', Math.abs(az1 - az0 - 0.17) < 0.02, (az1 - az0).toFixed(3));
    for (let i = 0; i < 30; i++) await pg.keyboard.press('ArrowDown');
    await settle(pg);
    let st = await pg.evaluate(() => { const s = window.__sp3d, c = s.cam; return { el: s.controls.st.el * 180 / Math.PI, y: c.position.y, h: s.info().hMax }; });
    ok('cannot orbit below 8 degrees / under the ground', st.el >= 7.99 && st.y > st.h, JSON.stringify(st));
    for (let i = 0; i < 30; i++) await pg.keyboard.press('ArrowUp');
    await settle(pg);
    st = await pg.evaluate(() => window.__sp3d.controls.st.el * 180 / Math.PI);
    ok('upper orbit limit 80 degrees', st <= 80.01 && st > 79, st.toFixed(2));
    // mouse drag far down: still bounded
    const box = await (await pg.$('.sp3d-canvas')).boundingBox();
    await pg.mouse.move(box.x + box.width / 2, box.y + 50); await pg.mouse.down(); await pg.mouse.move(box.x + box.width / 2 + 300, box.y + box.height - 10, { steps: 12 }); await pg.mouse.up();
    await settle(pg);
    st = await pg.evaluate(() => { const s = window.__sp3d; return { el: s.controls.st.el * 180 / Math.PI, y: s.cam.position.y }; });
    ok('mouse drag orbit stays above ground', st.el >= 7.99 && st.y > 0, JSON.stringify(st));
    for (let i = 0; i < 25; i++) await pg.keyboard.press('+');
    await settle(pg);
    st = await pg.evaluate(() => { const s = window.__sp3d, i = s.info(); return { d: s.controls.st.d, dMin: i.dMin, near: s.cam.near, y: s.cam.position.y, h: i.hMax }; });
    ok('zoom-in stops at the near limit; camera above the body', st.d >= st.dMin * 0.999 && st.y > st.h, JSON.stringify(st));
    await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 40; i++) await pg.mouse.wheel(0, 200);
    await settle(pg);
    st = await pg.evaluate(() => { const s = window.__sp3d, i = s.info(); return { d: s.controls.st.d, dMax: i.dMax }; });
    ok('wheel zoom-out stops at the far limit', st.d <= st.dMax * 1.001, JSON.stringify(st));
    await pg.keyboard.press('r'); await settle(pg);
    st = await pg.evaluate(() => { const s = window.__sp3d, i = s.info(); return { d: s.controls.st.d, dFit: i.dFit, el: s.controls.st.el }; });
    ok('R resets the view', Math.abs(st.d - st.dFit) / st.dFit < 0.01 && Math.abs(st.el - Math.PI / 6) < 0.01, JSON.stringify(st));
    // no spin: after release with no movement, nothing keeps moving
    await pg.waitForFunction(() => !window.__sp3d.controls.st.goal, null, { timeout: 120000 }).catch(() => {}); // software rendering is slow; wait for the reset to finish
    const az2 = await pg.evaluate(() => window.__sp3d.controls.st.az); await pg.waitForTimeout(1500);
    ok('no unexpected spin at rest', Math.abs((await pg.evaluate(() => window.__sp3d.controls.st.az)) - az2) < 1e-6);
    // touch: two synthetic touch pointers pinching apart zoom in; one finger orbits
    const pinch = await pg.evaluate(() => {
      const c = document.querySelector('.sp3d-canvas'), r = c.getBoundingClientRect(), s = window.__sp3d, d0 = s.controls.st.d, az0 = s.controls.st.az;
      const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: r.left + x, clientY: r.top + y, bubbles: true, isPrimary: id === 11, button: 0 }));
      ev('pointerdown', 11, 300, 200); ev('pointermove', 11, 360, 200); ev('pointerup', 11, 360, 200);
      const az1 = s.controls.st.az;
      ev('pointerdown', 11, 300, 200); ev('pointerdown', 12, 340, 200);
      for (let k = 1; k <= 10; k++) { ev('pointermove', 11, 300 - k * 10, 200); ev('pointermove', 12, 340 + k * 10, 200); }
      ev('pointerup', 11, 200, 200); ev('pointerup', 12, 440, 200);
      return { d0, d1: s.controls.st.d, dMin: s.info().dMin, orbited: Math.abs(az1 - az0) > 0.01 };
    });
    ok('one-finger touch orbits', pinch.orbited);
    ok('two-finger pinch zooms (bounded)', pinch.d1 < pinch.d0 && pinch.d1 >= pinch.dMin * 0.999, JSON.stringify(pinch));

    // views
    for (const v of ['front', 'side', 'top']) {
      await pg.click('.sp3d-b:text-is("' + v[0].toUpperCase() + v.slice(1) + '")'); await settle(pg);
    }
    st = await pg.evaluate(() => window.__sp3d.controls.st.el * 180 / Math.PI);
    ok('Top view button', Math.abs(st - 80) < 0.5, st.toFixed(1));

    // context loss
    const lost = await pg.evaluate(async () => {
      const gl = window.__sp3d.renderer.getContext(), ext = gl.getExtension('WEBGL_lose_context');
      ext.loseContext(); await new Promise((r) => setTimeout(r, 300));
      const msg = document.querySelector('.sp3d-status'); const shown = msg && !msg.hidden ? msg.textContent : '';
      ext.restoreContext(); await new Promise((r) => setTimeout(r, 2500));
      return { shown, hiddenAfter: msg.hidden, canvases: document.querySelectorAll('canvas.sp3d-canvas').length };
    });
    await pg.evaluate(() => window.__sp3d.frame());
    const pix = await pg.evaluate(() => { const c = document.querySelector('.sp3d-canvas'), x = document.createElement('canvas'); x.width = 40; x.height = 40; const g = x.getContext('2d'); g.drawImage(c, 0, 0, 40, 40); const d = g.getImageData(0, 0, 40, 40).data; let v = 0; for (let i = 0; i < d.length; i += 4) v += d[i] + d[i + 1] + d[i + 2]; return v / (d.length / 4); });
    ok('context loss shows a message, restore rebuilds and renders', !!lost.shown && lost.hiddenAfter && lost.canvases === 1 && pix > 20, JSON.stringify(lost) + ' avg ' + pix.toFixed(0));
    await pg.screenshot({ path: OUT + 'test-after-context-restore.png' });

    // fullscreen
    await pg.click('.sp3d-b:text-is("Fullscreen")'); await pg.waitForTimeout(800);
    const fs = await pg.evaluate(() => ({ fs: !!document.fullscreenElement || !!document.querySelector('.sp3d-max'), w: document.querySelector('.sp3d-canvas').clientWidth, h: document.querySelector('.sp3d-canvas').clientHeight, rw: window.__sp3d.renderer.domElement.width }));
    await pg.screenshot({ path: OUT + 'test-fullscreen.png' });
    ok('fullscreen enlarges the viewer', fs.fs && fs.w >= 1200, JSON.stringify(fs));
    await pg.click('.sp3d-b:text-is("Exit fullscreen")').catch(() => {}); await pg.waitForTimeout(500);
    // resize to phone width
    await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(800);
    const rs = await pg.evaluate(() => { const c = document.querySelector('.sp3d-canvas'); return { cw: c.clientWidth, ch: c.clientHeight, bw: c.width / (window.devicePixelRatio || 1), aspect: window.__sp3d.cam.aspect, docW: document.documentElement.scrollWidth }; });
    ok('resize to phone updates canvas and aspect; no horizontal scroll', Math.abs(rs.cw - rs.bw) < 2 && Math.abs(rs.aspect - rs.cw / rs.ch) < 0.01 && rs.docW <= 390, JSON.stringify(rs));
    await pg.screenshot({ path: OUT + 'test-resized-phone.png' });
    ok('no page errors after interaction tests', errs.length === 0, errs.join(' | '));
  }

  // 2. another species page opens its own model
  {
    const { pg, errs } = await newPage(br);
    await pg.goto(BASE + 'gaboon-viper-bitis-gabonica.html#real'); await waitViewer(pg);
    const n = await pg.evaluate(() => ({ h: document.querySelector('#sp-rl-h').textContent, rattle: 0 }));
    ok('opens on another species page via #real', /Gaboon Viper/.test(n.h), n.h);
    ok('no page errors (gaboon)', errs.length === 0, errs.join(' | '));
  }

  // 3. reduced motion: no damping/inertia, view changes are instant
  {
    const { pg } = await newPage(br, { ctx: { reducedMotion: 'reduce' } });
    await pg.goto(BASE + 'smooth-snake-coronella-austriaca.html#real'); await waitViewer(pg);
    await pg.click('.sp3d-b:text-is("Top")');
    const r = await pg.evaluate(() => ({ el: window.__sp3d.controls.st.el * 180 / Math.PI, goal: window.__sp3d.controls.st.goal }));
    ok('reduced motion: views jump without animation', Math.abs(r.el - 80) < 0.01 && r.goal === null, JSON.stringify(r));
    const box = await (await pg.$('.sp3d-canvas')).boundingBox();
    await pg.mouse.move(box.x + 200, box.y + 200); await pg.mouse.down(); await pg.mouse.move(box.x + 400, box.y + 200, { steps: 3 }); await pg.mouse.up();
    const a1 = await pg.evaluate(() => window.__sp3d.controls.st.az); await pg.waitForTimeout(600);
    ok('reduced motion: no inertia after a fling', Math.abs((await pg.evaluate(() => window.__sp3d.controls.st.az)) - a1) < 1e-6);
  }

  // 4. species without a profile: honest message + photos, no 3D code downloaded
  {
    const { pg, reqs } = await newPage(br);
    await pg.goto(BASE + 'common-gartersnake-thamnophis-sirtalis.html#real');
    await pg.waitForFunction(() => document.querySelector('.sp3d-none') && !document.querySelector('.sp3d-none').hidden, null, { timeout: 30000 });
    const r = await pg.evaluate(() => ({ note: document.querySelector('.sp3d-none').textContent, tabsHidden: document.querySelector('.sp-rl-tabs').hidden, photo: !!document.querySelector('.sp-rl-own img'), canvas: document.querySelectorAll('canvas.sp3d-canvas').length }));
    ok('no profile: plain message, photos shown, no canvas', /No accurate 3D model/.test(r.note) && r.photo && r.canvas === 0 && r.tabsHidden, JSON.stringify(r));
    ok('no profile: three.js never downloaded', !reqs.some((u) => /three\.module|viewer\.js/.test(u)));
    await (await pg.$('.sp-rl')).screenshot({ path: OUT + 'test-no-profile.png' });
  }

  // 5. load failure + Retry
  {
    const { pg } = await newPage(br);
    let block = true;
    await pg.route('**/3d/viewer.js', (r) => (block ? r.abort() : r.continue()));
    await pg.goto(BASE + 'viperine-snake-natrix-maura.html#real');
    await pg.waitForSelector('.sp3d-msg[role=alert]', { timeout: 30000 });
    const t = await pg.textContent('.sp3d-msg[role=alert]');
    await (await pg.$('.sp-rl')).screenshot({ path: OUT + 'test-load-error.png' });
    block = false;
    await pg.click('.sp3d-msg button:text-is("Retry")'); await waitViewer(pg);
    ok('load error shows message and Retry recovers', /could not be loaded/.test(t) && (await pg.evaluate(() => document.querySelectorAll('canvas.sp3d-canvas').length)) === 1, t);
  }


  // 5b. failed model data (models.json) + Retry
  {
    const { pg } = await newPage(br);
    let block = true;
    await pg.route('**/3d/models.json', (r) => (block ? r.fulfill({ status: 503, body: 'unavailable' }) : r.continue()));
    await pg.goto(BASE + 'smooth-snake-coronella-austriaca.html#real');
    await pg.waitForSelector('.sp3d-msg[role=alert]', { timeout: 30000 });
    const t = await pg.textContent('.sp3d-msg[role=alert]');
    const hasRetry = !!(await pg.$('.sp3d-msg button:text-is("Retry")'));
    block = false;
    await pg.click('.sp3d-msg button:text-is("Retry")'); await waitViewer(pg);
    const r = await pg.evaluate(() => ({ canvases: document.querySelectorAll('canvas.sp3d-canvas').length, alerts: document.querySelectorAll('.sp3d-msg[role=alert]').length }));
    ok('model data failure shows an error with Retry, and Retry loads the model', hasRetry && r.canvases === 1 && r.alerts === 0, t + ' ' + JSON.stringify(r));
  }

  // 8. zoom and orbit limits scale with the model: a 16 cm blind snake and a 4.5 m python
  for (const [page, label] of [['brahminy-blindsnake-indotyphlops-braminus.html', 'blind snake'], ['reticulated-python-malayopython-reticulatus.html', 'reticulated python']]) {
    const { pg, errs } = await newPage(br);
    await pg.goto(BASE + page + '#real'); await waitViewer(pg);
    const lim = await pg.evaluate(async () => {
      const s = window.__sp3d, c = s.controls, i = s.info(), L = i.F.L, out = { L, Rb: i.Rb, dMin: i.dMin, dMax: i.dMax };
      const probe = (g) => { c.setGoal(g, true); s.frame(); return { d: c.st.d, el: c.st.el * 180 / Math.PI, y: s.cam.position.y }; };
      out.inMost = probe({ d: i.dMin * 0.01, el: 0.3 });
      out.outMost = probe({ d: i.dMax * 100, el: 0.3 });
      out.lowest = probe({ el: -1.2, d: i.dFit });
      out.lowestNear = probe({ el: -1.2, d: i.dMin });
      out.highest = probe({ el: 3, d: i.dFit });
      let minY = 1e9; for (let k = 0; k < 24; k++) { const r = probe({ az: k * Math.PI / 12, el: -1, d: i.dMin + (i.dMax - i.dMin) * (k % 4) / 3 }); minY = Math.min(minY, r.y); }
      out.minY = minY; out.hMax = i.hMax;
      return out;
    });
    ok(label + ': zoom-in limit holds and is relative to its size', lim.inMost.d >= lim.dMin * 0.999 && lim.dMin < lim.L && lim.dMin > lim.L * 0.02, JSON.stringify({ L: lim.L, dMin: +lim.dMin.toFixed(4), d: +lim.inMost.d.toFixed(4) }));
    ok(label + ': zoom-out limit holds and is relative to its size', lim.outMost.d <= lim.dMax * 1.001 && lim.dMax < lim.Rb * 12, JSON.stringify({ Rb: +lim.Rb.toFixed(3), dMax: +lim.dMax.toFixed(3), d: +lim.outMost.d.toFixed(3) }));
    ok(label + ': camera never goes below the ground (24 orbit probes)', lim.lowest.el >= 7.99 && lim.minY > 0 && lim.lowestNear.y > 0, JSON.stringify({ el: +lim.lowest.el.toFixed(2), minY: +lim.minY.toFixed(4), hMax: +lim.hMax.toFixed(4) }));
    ok(label + ': upper orbit bound', lim.highest.el <= 80.01, lim.highest.el.toFixed(2));
    ok(label + ': no page errors', errs.length === 0, errs.join(' | '));
    await (await pg.$('.sp-rl')).screenshot({ path: OUT + 'test-limits-' + label.replace(/ /g, '-') + '.png' });
  }

  // 9. close zoom never puts the camera inside the snake (stacked coil, so body parts sit above the ground)
  {
    const { pg, errs } = await newPage(br);
    await pg.goto(BASE + 'viperine-snake-natrix-maura.html#real'); await waitViewer(pg);
    const r = await pg.evaluate(() => {
      const s = window.__sp3d, c = s.controls, i = s.info(), F = i.F, B = i.body;
      // independent check: distance from the camera to the body's centre line minus the body's half-size there
      const inside = () => { let m = 1e9; for (let k = 0; k <= 600; k++) { const x = (k / 600) * F.L, d = s.cam.position.distanceTo(B.spine(x)) - Math.max(F.W(x), F.Hh(x)); if (d < m) m = d; } return m; };
      let worst = 1e9, n = 0, below = 0;
      for (let a = 0; a < 36; a++) for (const el of [0.14, 0.4, 0.9, 1.3]) for (const dk of [0.6, 1, 1.6]) {
        c.setGoal({ az: (a / 36) * Math.PI * 2, el, d: i.dMin * dk }, true); s.frame(); n++;
        const m = inside(); if (m < worst) worst = m; if (s.cam.position.y <= 0) below++;
      }
      return { probes: n, worstClearance: +worst.toFixed(5), near: +s.cam.near.toFixed(5), below, L: F.L };
    });
    ok('close zoom: camera never inside the snake (432 probes round a stacked coil)', r.worstClearance > 0 && r.below === 0, JSON.stringify(r));
    ok('viperine snake: no page errors', errs.length === 0, errs.join(' | '));
  }

  // 6. WebGL unavailable: fallback message, photos offered
  {
    const { pg } = await newPage(br, { init: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { return /webgl/.test(t) ? null : g.call(this, t, o); }; } });
    await pg.goto(BASE + 'viperine-snake-natrix-maura.html#real');
    await pg.waitForSelector('.sp3d-msg[role=alert]', { timeout: 30000 });
    const t = await pg.textContent('.sp3d-msg[role=alert]');
    ok('no WebGL: fallback message with photos button', /WebGL/.test(t) && !!(await pg.$('.sp3d-msg button:text-is("See photos instead")')), t);
  }

  // 7. hidden tab pauses rendering
  {
    const { pg } = await newPage(br);
    await pg.goto(BASE + 'smooth-snake-coronella-austriaca.html#real'); await waitViewer(pg);
    await pg.evaluate(() => window.__sp3d.envReady); await pg.waitForTimeout(1500); // the photo surroundings arrive once, then nothing moves
    const r = await pg.evaluate(async () => {
      const ren = window.__sp3d.renderer; let n = 0; const o = ren.render.bind(ren); ren.render = (a, b) => { n++; o(a, b); };
      await new Promise((r) => setTimeout(r, 1000)); const idle = n;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      window.__sp3d.controls.setGoal({ az: 2 }); await new Promise((r) => setTimeout(r, 800)); const hiddenRenders = n - idle;
      return { idle, hiddenRenders };
    });
    ok('renders on demand only (no frames while idle) and pauses while the tab is hidden', r.idle <= 1 && r.hiddenRenders === 0, JSON.stringify(r));
  }
  await br.close();
  const txt = results.join('\n') + '\n\n' + results.filter((r) => r.startsWith('PASS')).length + ' passed, ' + results.filter((r) => r.startsWith('FAIL')).length + ' failed\n';
  fs.writeFileSync(OUT + 'test-results.txt', txt); console.log(txt);
})().catch((e) => { console.error(e); console.log(results.join('\n')); process.exit(1); });
