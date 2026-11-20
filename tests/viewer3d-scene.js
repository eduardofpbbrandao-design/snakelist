// Checks of the 3D viewer's surroundings work (v5.78): See it eat - Pause/Play, Replay, turning the camera during the
// show, the state after it stops; Size vs person - the sculpted 1.70 m person loads and goes away; Anatomy - picking a
// part fades the others. Run: python3 -m http.server 8993 --bind 127.0.0.1 (repo root); node tests/viewer3d-scene.js [species-id]
// Env: BASE (default http://127.0.0.1:8993). Needs Playwright with Chromium (WebGL on SwiftShader).
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8993';
const sp = process.argv[2] || 'python-regius';
const res = []; const ok = (n, c, i) => { res.push((c ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : '')); if (!c) process.exitCode = 1; };
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await (await br.newContext({ viewport: { width: 700, height: 520 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await pg.addInitScript(() => { localStorage.setItem('sl-intro-seen', '1'); localStorage.setItem('sl-tour-done', '1'); localStorage.setItem('sl-tour-seen', '1'); window.SL_3D_TEST = true; });
  await pg.goto(BASE + '/index.html');
  await pg.waitForFunction(() => window.SL_3D && window.SL_3D.panel, null, { timeout: 60000 });
  await pg.evaluate((id) => window.SL_3D.panel(id, null, ''), sp);
  await pg.waitForFunction(() => window.__sp3d && window.__sp3d.info && window.__sp3d.info(), null, { timeout: 120000 });
  await pg.waitForTimeout(1500);
  const click = (txt) => pg.evaluate((txt) => { const b = [...document.querySelectorAll('.sp3d-stage .sp3d-b')].find((x) => x.textContent.trim() === txt && x.offsetParent); if (b) { b.click(); return true; } return false; }, txt);
  const vis = (txt) => pg.evaluate((txt) => !![...document.querySelectorAll('.sp3d-stage .sp3d-b')].find((x) => x.textContent.trim() === txt && x.offsetParent && !x.hidden), txt);
  const st0 = await pg.evaluate(() => { const s = window.__sp3d.controls.st; return { az: s.az, el: s.el, d: s.d }; });
  ok('no Pause before', !(await vis('Pause')));
  await click('See it eat'); await pg.waitForTimeout(1500);
  ok('Pause and Replay shown', (await vis('Pause')) && (await vis('Replay')));
  ok('prey has motion', await pg.evaluate(() => { const f = window.__sp3d.fx; return !!(f.test.showInfo && f.test.showInfo.kind); }));
  await click('Pause'); const t1 = await pg.evaluate(() => window.__sp3d.fx.test.show.time); await pg.waitForTimeout(2500); const t2 = await pg.evaluate(() => window.__sp3d.fx.test.show.time);
  ok('paused: time stands still', Math.abs(t2 - t1) < 0.05, t1.toFixed(2) + ' -> ' + t2.toFixed(2));
  ok('button says Play', await vis('Play'));
  // orbit by dragging while paused
  const box = await (await pg.$('canvas.sp3d-canvas')).boundingBox();
  const az0 = await pg.evaluate(() => window.__sp3d.controls.st.az);
  await pg.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6); await pg.mouse.down(); await pg.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(1200);
  const az1 = await pg.evaluate(() => window.__sp3d.controls.st.az);
  ok('drag turns the camera during the show', Math.abs(az1 - az0) > 0.05, (az1 - az0).toFixed(3));
  ok('still in the show after the drag', await pg.evaluate(() => !!window.__sp3d.fx.test.show));
  await click('Play'); await pg.waitForTimeout(1500); const t3 = await pg.evaluate(() => window.__sp3d.fx.test.show.time);
  ok('plays again', t3 > t2 + 0.3, t3.toFixed(2));
  await click('Replay'); await pg.waitForTimeout(800); const t4 = await pg.evaluate(() => window.__sp3d.fx.test.show && window.__sp3d.fx.test.show.time);
  ok('replay restarts', t4 != null && t4 < 2, String(t4));
  // jump near the end and let it finish
  await pg.evaluate(() => { const f = window.__sp3d.fx; const s = f.test.show; f.test.freeze(s.dur - 0.3); });
  await pg.evaluate(() => { const f = window.__sp3d.fx; f.test.freeze(null); });
  await pg.evaluate(() => { const fx = window.__sp3d.fx; });
  await pg.evaluate(() => { const b = [...document.querySelectorAll('.sp3d-stage .sp3d-b')].find((x) => x.textContent.trim() === 'Stop eating'); if (b) b.click(); });
  await pg.waitForTimeout(1800);
  ok('after stopping: no show, Pause hidden', !(await pg.evaluate(() => !!window.__sp3d.fx.test.show)) && !(await vis('Pause')));
  ok('See it eat back, not pressed', await pg.evaluate(() => { const b = [...document.querySelectorAll('.sp3d-stage .sp3d-b')].find((x) => x.textContent.trim() === 'See it eat'); return !!b && b.getAttribute('aria-pressed') === 'false'; }));
  const st1 = await pg.evaluate(() => { const s = window.__sp3d.controls.st; return { az: s.az, el: s.el, d: s.d }; });
  ok('camera back to the view you had', Math.abs(st1.d - st0.d) / st0.d < 0.05 && Math.abs(Math.atan2(Math.sin(st1.az - st0.az), Math.cos(st1.az - st0.az))) < 0.05, JSON.stringify(st0) + ' / ' + JSON.stringify(st1));
  ok('Normal pressed', await pg.evaluate(() => { const b = [...document.querySelectorAll('.sp3d-stage .sp3d-b')].find((x) => x.textContent.trim() === 'Normal'); return b && b.getAttribute('aria-pressed') === 'true'; }));
  // Size vs person and back
  await click('Size vs person'); await pg.waitForTimeout(4000);
  { const r = await pg.evaluate(() => { const p = window.__sp3d.scene.getObjectByName('sizePerson'); let real = false, h = 0; if (p) { p.traverse((o) => { if (o.name === 'person-skin') real = true; }); const b = new window.__sp3d.THREE.Box3().setFromObject(p); h = b.max.y - b.min.y; } return { has: !!p, real, h }; }); ok('person loaded (sculpted model), 1.70 m', r.real && Math.abs(r.h - 1.7) < 0.01, JSON.stringify(r)); }
  await click('Back to model'); await pg.waitForTimeout(2500);
  ok('back from Size vs person: Normal pressed, no person', await pg.evaluate(() => { const b = [...document.querySelectorAll('.sp3d-stage .sp3d-b')].find((x) => x.textContent.trim() === 'Normal'); return b && b.getAttribute('aria-pressed') === 'true' && !window.__sp3d.size().on; }));
  // Anatomy: pick the heart, others fade
  await click('Anatomy'); await pg.waitForTimeout(2500);
  const fade = await pg.evaluate(async () => { const a = window.__sp3d.fx.test.anat, p = a.parts.find((q) => q.key === 'heart'); a.select(p); await new Promise((r) => setTimeout(r, 2500)); const ribs = a.parts.find((q) => q.key === 'ribs'); return { ribs: ribs.meshes[0].material.opacity, heart: p.meshes[0].material.opacity }; });
  ok('picking the heart fades the ribs', fade.ribs < 0.5 && fade.heart > 0.9, JSON.stringify(fade));
  await click('Normal'); await pg.waitForTimeout(1500);
  ok('Normal again: anatomy off', await pg.evaluate(() => !window.__sp3d.fx.anatOn()));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await br.close();
})().catch((e) => { console.error(String(e).slice(0, 500)); console.log(res.join('\n')); process.exit(1); });
