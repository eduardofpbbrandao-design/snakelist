// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT --bind 127.0.0.1), then
//   PORT=<port> node tests/opening-continuous.js [screenshot-dir]
// v6.11 (Eduardo, "dozens of times"): the whole opening is ONE continuous motion - the wall of photos, the logo gliding
// down onto the opening photo, the photo settling - and at its end nothing stops, reloads, flashes or plays again.
// Recorded frame by frame (Chrome's screencast) on a slow computer (CPU 4x slower), first visit and returning, on a
// computer and on a phone. Checked:
//   * the page is loaded once (no reload) and the opening plays once (one glide, one sl-intro-done)
//   * no frame during the glide jumps, and no long task blocks the page while it glides
//   * (the glide is moved frame by frame, so even a slow frame can only pause it, never skip it)
//   * no frame during the glide jumps (a sudden big change from one frame to the next that is not part of the fade)
//   * once the opening has handed over to the photo, nothing flashes or changes on screen for 3 s (no replay, no
//     photo swap, no What's new / chooser / update bar over the photo, no late font swap or photo re-decode)
//   * What's new and the first-visit chooser never open while the photo is on screen
//   * a reload within a minute of the opening (any reason) does not play the opening again
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://127.0.0.1:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };

function inPage() {
  const L = window.__OC = { log: [], glides: 0, introDone: 0, wnOverPhoto: 0, lvOverPhoto: 0, lt: [] };
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => L.lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  const t = () => performance.now();
  document.addEventListener('sl-intro-done', () => { L.introDone++; L.doneAt = t(); });
  document.addEventListener('sl-hero-entered', () => { L.enteredAt = t(); });
  const onPhoto = () => { const h = document.getElementById('sl-hero'); return h && !h.hidden && !window.__heroEntered; };
  document.addEventListener('DOMContentLoaded', () => {
    const intro = document.getElementById('intro');
    if (intro) new MutationObserver(() => { if (intro.classList.contains('intro-glide') && !L.glideAt) { L.glides++; L.glideAt = t(); } if (intro.classList.contains('intro-gone') && !L.goneAt) L.goneAt = t(); }).observe(intro, { attributes: true, attributeFilter: ['class'] });
    const wn = document.getElementById('wn-sheet'), lv = document.getElementById('sl-level');
    const chk = () => { if (wn && wn.classList.contains('open') && onPhoto()) L.wnOverPhoto++; if (lv && lv.classList.contains('open') && onPhoto()) L.lvOverPhoto++; };
    [wn, lv].forEach((el) => { if (el) new MutationObserver(chk).observe(el, { attributes: true, attributeFilter: ['class'] }); });
  });
  L.perf0 = Date.now() - performance.now();
}

async function run(b, o) {
  const label = (o.phone ? 'phone' : 'computer') + ', ' + (o.first ? 'first visit' : 'returning');
  const ctx = await b.newContext(o.phone ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  await p.addInitScript((first) => { if (!first) { ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-level-seen'].forEach((k) => localStorage.setItem(k, '1')); localStorage.setItem('sl-seen-ver', 'v1.00'); } }, !!o.first);
  await p.addInitScript(inPage);
  let navs = 0; p.on('framenavigated', (f) => { if (f === p.mainFrame()) navs++; });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => { frames.push({ ts: f.metadata.timestamp * 1000, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 55, maxWidth: o.phone ? 412 : 640 });
  await p.goto(BASE, { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => window.__OC && window.__OC.goneAt, null, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(4500); // the photo settles, SnakeList is drawn under it
  await cdp.send('Page.stopScreencast');
  const L = await p.evaluate(() => window.__OC);
  // frame differences, measured in a canvas (each frame shrunk to 160 x 100, mean absolute grey difference 0-255)
  const an = await ctx.newPage();
  const diffs = await an.evaluate(async (fr) => {
    const c = document.createElement('canvas'); c.width = 160; c.height = 100; const g = c.getContext('2d', { willReadFrequently: true });
    const grey = async (d) => { const im = new Image(); im.src = 'data:image/jpeg;base64,' + d; await im.decode(); g.drawImage(im, 0, 0, 160, 100); const px = g.getImageData(0, 0, 160, 100).data, out = new Float32Array(16000); for (let i = 0; i < 16000; i++) out[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3; return out; };
    const res = []; let prev = null;
    for (const f of fr) { const cur = await grey(f.data); if (prev) { let s = 0; for (let i = 0; i < 16000; i++) s += Math.abs(cur[i] - prev[i]); res.push({ ts: f.ts, d: s / 16000 }); } prev = cur; }
    return res;
  }, frames);
  await an.close();
  const toFrame = (pt) => L.perf0 + pt; // page time -> wall clock (the screencast's clock)
  const glideA = toFrame(L.glideAt || 0), goneT = toFrame(L.goneAt || 0);
  const during = diffs.filter((d) => d.ts > glideA - 100 && d.ts < goneT + 150);
  const after = diffs.filter((d) => d.ts > goneT + 600 && d.ts < goneT + 3600);
  const maxDuring = Math.max(0, ...during.map((d) => d.d)), maxAfter = Math.max(0, ...after.map((d) => d.d));
  console.log('-- ' + label + ': ' + frames.length + ' frames, glide ' + Math.round((L.goneAt - L.glideAt) || 0) + ' ms, biggest change between frames: during the hand-over ' + maxDuring.toFixed(2) + ', after it ' + maxAfter.toFixed(2));
  if (SHOTS && frames.length) require('fs').writeFileSync(SHOTS + '/opening-last-' + label.replace(/[^a-z]+/gi, '-') + '.jpg', Buffer.from(frames[frames.length - 1].data, 'base64'));
  ok(navs === 1, label + ': the page was loaded once - no reload (' + navs + ')');
  ok(L.glides === 1 && L.introDone === 1, label + ': the opening played once (glides ' + L.glides + ', sl-intro-done ' + L.introDone + ')');
  ok(during.length > 2 && maxDuring < 15, label + ': the hand-over from the opening to the photo has no jump (largest frame-to-frame change ' + maxDuring.toFixed(2) + ' < 15)');
  const inGlide = (L.lt || []).filter((x) => x[0] + x[1] > L.glideAt && x[0] < L.goneAt && x[1] > 250);
  ok(!inGlide.length, label + ': no long task (over 250 ms at 4x slower CPU) while the logo glides onto the photo' + (inGlide.length ? ' (' + inGlide.map((x) => Math.round(x[1]) + ' ms').join(', ') + ')' : ''));
  ok(after.length > 0 && maxAfter < 3, label + ': after the hand-over nothing flashes, swaps or plays again for 3 s (largest change ' + maxAfter.toFixed(2) + ' < 3)');
  ok(!L.wnOverPhoto && !L.lvOverPhoto, label + ': What\'s new and the chooser never open over the photo');
  ok(!errs.length, label + ': no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  if (!o.first && !o.phone) {
    // a reload within a minute of the opening: straight back to the photo, no second opening
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await p.reload({ waitUntil: 'load' });
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => ({ glides: window.__OC.glides, gone: document.getElementById('intro').classList.contains('intro-gone'), hero: !document.getElementById('sl-hero').hidden }));
    ok(r.gone && r.glides === 0 && r.hero, 'a reload right after the opening does not play it again (the photo is there at once)');
  }
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const o of [{ phone: false, first: false }, { phone: true, first: false }, { phone: false, first: true }, { phone: true, first: true }]) await run(b, o);
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
