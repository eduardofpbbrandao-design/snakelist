// Checks of the 3D viewer's "3d" preview (v6.35, the shared realism pass in species/3d/viewer.js) and the live fixes made with
// it: the preview is off unless switched on; on, every body plan gets its group and shape; grounded snakes touch the ground
// (no floating stretches, nothing sunk into it); touch devices get finger instructions (an iPad too) and a toolbar that fits
// a phone; closing the viewer frees the graphics memory.
// Run: python3 build-site.py; python3 -m http.server $PORT --bind 127.0.0.1 (repo root); PORT=$PORT node tests/viewer3d-realism.js
// Needs Playwright with Chromium (WebGL on SwiftShader).
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8993, BASE = process.env.BASE || 'http://127.0.0.1:' + PORT;
const res = []; const ok = (n, c, i) => { res.push((c ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : '')); if (!c) process.exitCode = 1; };
const SEEN = ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen'];
async function open(br, id, o = {}) {
  const ctx = await br.newContext(Object.assign({ viewport: { width: 760, height: 560 } }, o.ctx || {}));
  const pg = await ctx.newPage(); pg.setDefaultTimeout(180000);
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await pg.addInitScript(([keys, pv]) => { for (const k of keys) localStorage.setItem(k, '1'); if (pv != null) localStorage.setItem('sl-art-preview-3d', pv); window.SL_3D_TEST = true; window.SL_3D_QUALITY = 'low'; }, [SEEN, o.preview == null ? null : o.preview ? '1' : '0']);
  await pg.goto(BASE + '/index.html');
  await pg.waitForFunction(() => window.SL_3D && window.SL_3D.panel, null, { timeout: 90000 });
  await pg.evaluate((id) => window.SL_3D.panel(id, null, ''), id);
  await pg.waitForFunction(() => window.__sp3d && window.__sp3d.info && window.__sp3d.info(), null, { timeout: 180000 });
  await pg.evaluate(() => window.__sp3d.envReady);
  return { ctx, pg, errs };
}
// the belly's height over what it rests on (the ground, or a turn of the body under it), in body radii, along the body
const CONTACT = () => {
  const S = window.__sp3d, I = S.info(), B = I.body, F = I.F, fx = S.fx, N = 240, pts = [];
  for (let i = 0; i <= N; i++) { const x = F.Hl * 1.2 + (i / N) * (F.L * 0.97 - F.Hl * 1.2); pts.push({ x, bel: B.surf(x, Math.PI).p, top: B.surf(x, 0).p, c: B.spine(x), r: Math.max(F.W(x), F.Hh(x)) }); }
  const gy = fx.groundY ? fx.groundY(pts.map((p) => [p.bel.x, p.bel.z]), false) : pts.map(() => 0);
  let float = 0, sink = 0, n = 0, worst = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]; if (p.x < F.Hl * 4.5) continue; // (the head and neck are held up on purpose)
    let below = null;
    for (const q of pts) { if (Math.abs(q.x - p.x) < p.r * 6) continue; if (Math.hypot(q.c.x - p.c.x, q.c.z - p.c.z) < F.W(q.x) * 0.6 && q.top.y < p.bel.y + p.r && (below == null || q.top.y > below)) below = q.top.y; }
    const gap = (p.bel.y - Math.max(gy[i] || 0, below != null ? below : -1e9)) / p.r; n++;
    if (gap > 0.35) float++; if (gap < -0.25) sink++; if (Math.abs(gap) > Math.abs(worst)) worst = gap;
  }
  return { n, float, sink, worst: +worst.toFixed(2) };
};
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  // 1. off by default: the live model is untouched
  {
    const { ctx, pg, errs } = await open(br, 'oxyuranus-microlepidotus');
    const r = await pg.evaluate(() => { const P = window.__sp3d.P; return { rz: P.realism || null, fore: P.body.fore || null, lip: P.head.lipK || null, hint: document.querySelector('.sp3d-hint').textContent }; });
    ok('preview off: no realism pass', !r.rz && !r.fore && !r.lip, JSON.stringify(r));
    ok('desktop: mouse and keyboard instructions', /W A S D/.test(r.hint), r.hint);
    ok('preview off: grounded snake touches the ground', ((c) => c.float === 0 && c.sink === 0)(await pg.evaluate(CONTACT)), JSON.stringify(await pg.evaluate(CONTACT)));
    // closing frees the graphics memory
    const before = await pg.evaluate(() => { const m = window.__sp3d.renderer.info.memory; window.__r = window.__sp3d.renderer; return { g: m.geometries, t: m.textures }; });
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(1500);
    const after = await pg.evaluate(() => { const m = window.__r.info.memory; return { g: m.geometries, t: m.textures, gone: !window.__sp3d && !document.querySelector('canvas.sp3d-canvas') }; });
    ok('close disposes geometries and textures', after.gone && after.g === 0 && after.t === 0, JSON.stringify({ before, after }));
    ok('no page errors (off)', errs.length === 0, errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  // 2. on: each body plan gets its group and shape; contact holds
  const want = { 'oxyuranus-microlepidotus': 'elapid', 'opheodrys-vernalis': 'racer', 'crotalus-atrox': 'rattlesnake', 'python-regius': 'python', 'ahaetulla-prasina': 'vine', 'indotyphlops-braminus': 'blind' };
  for (const [id, grp] of Object.entries(want)) {
    const { ctx, pg, errs } = await open(br, id, { preview: true });
    const r = await pg.evaluate(() => { const P = window.__sp3d.P, F = window.__sp3d.info().F; return { rz: P.realism, fore: P.body.fore, tail: P.body.tailShape || '', lift: P.pose.lift, wf: P.body.fore ? F.W(F.L * P.body.fore[0]) / F.w0 : 0, neck: F.W(F.Hl * 1.5) / F.w0, head: F.W(F.Hl * 0.75) / F.w0, tip: F.W(F.L * 0.995) / F.w0 }; });
    ok(id + ': group ' + grp, r.rz === grp, JSON.stringify(r));
    if (grp !== 'blind') {
      ok(id + ': forebody filled out early (near full width a fifth to a third of the way along)', r.wf >= r.fore[1] * 0.97 && r.fore[0] <= 0.3, r.wf.toFixed(2) + ' at ' + r.fore[0]);
      ok(id + ': head wider than the neck', r.head > r.neck * 1.08, r.head.toFixed(2) + ' / ' + r.neck.toFixed(2));
    }
    if (id === 'opheodrys-vernalis' || id === 'ahaetulla-prasina') ok(id + ': whip tail', r.tail === 'whip', r.tail);
    if (id === 'python-regius') ok(id + ': thick prehensile tail', r.tail === 'prehensile', r.tail);
    const c = await pg.evaluate(CONTACT);
    if (id !== 'ahaetulla-prasina') ok(id + ': rests on the ground or its own coils (no float, no sinking)', c.float === 0 && c.sink === 0, JSON.stringify(c));
    if (id === 'oxyuranus-microlepidotus') {
      const L = await pg.evaluate(() => { const P = window.__sp3d.P; return { w: P.head.w, iris: P.head.iris, gloss: P.scales.gloss }; });
      ok('inland taipan remodelled (narrower head, round-pupil eye colours)', L.w <= 0.82 && L.iris === '#3a2617', JSON.stringify(L));
    }
    ok(id + ': no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  // 3. touch: an iPad-sized touch screen and a phone get finger instructions; the phone's toolbar fits the screen
  for (const [nm, vp] of [['tablet', { width: 1024, height: 768 }], ['phone', { width: 390, height: 760 }]]) {
    const { ctx, pg, errs } = await open(br, 'crotalus-atrox', { ctx: { viewport: vp, hasTouch: true, isMobile: true } });
    const r = await pg.evaluate(() => { const st = document.querySelector('.sp3d-stage').getBoundingClientRect(), bs = [...document.querySelectorAll('.sp3d-stage .sp3d-b')].filter((b) => b.offsetParent && !b.hidden);
      return { hint: document.querySelector('.sp3d-hint').textContent, out: bs.filter((b) => { const q = b.getBoundingClientRect(); return q.left < st.left - 1 || q.right > st.right + 1; }).map((b) => b.textContent.trim()), small: bs.filter((b) => { const q = b.getBoundingClientRect(); return q.height < 24; }).map((b) => b.textContent.trim()), docW: document.documentElement.scrollWidth, vw: innerWidth }; });
    ok(nm + ': finger instructions', /pinch/i.test(r.hint) && !/W A S D/.test(r.hint), r.hint);
    ok(nm + ': every toolbar button inside the view', r.out.length === 0, r.out.join(', '));
    ok(nm + ': buttons big enough to tap', r.small.length === 0, r.small.join(', '));
    ok(nm + ': no sideways page scroll', r.docW <= r.vw + 1, r.docW + ' / ' + r.vw);
    ok(nm + ': no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  console.log(res.join('\n'));
  await br.close();
})().catch((e) => { console.error(String(e).slice(0, 500)); console.log(res.join('\n')); process.exit(1); });
