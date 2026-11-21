// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT --bind 127.0.0.1), then
//   PORT=<port> node tests/hero-scroll.js [screenshot-dir]
// Eduardo: "when I scroll down for the opening it reload snakelist while scrolling down ... dont make button be reloaded".
// From the opening photo, a slow scroll down into SnakeList and on through the list must not redraw anything: while
// scrolling (and just after it stops), no button may be removed, made again or added (header, tabs, filters, the cards'
// Mark Seen / 3D / See more info, the extra Rare / Common tags over the cards), no CSS animation or transition may start
// (no fade-ins, no colour fades of buttons coming on screen, no pop-up sliding in mid-scroll), and nothing on screen may
// jump. The pop-ups (cookies, the first-visit chooser) wait until the scrolling has stopped.
// Checked on a computer (wheel) and on a phone (touch, 412 x 915), returning and first visit, light and dark, scrolling
// as soon as the photo is there (SnakeList under it not drawn yet) and after it has been drawn.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://127.0.0.1:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };

// everything below runs in the page from the very start
function watch() {
  const L = window.__HS = { on: false, btnAdd: [], btnRem: [], anims: [], trans: [], shifts: [], jumps: [], frames: 0 };
  const isBtn = (n) => n.nodeType === 1 && (n.matches('button, [role=button]') || !!n.querySelector('button, [role=button]'));
  const name = (n) => n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  new MutationObserver((ms) => { if (!L.on) return; for (const m of ms) {
    m.addedNodes.forEach((n) => { if (isBtn(n)) L.btnAdd.push(name(n) + ' < ' + name(m.target)); });
    m.removedNodes.forEach((n) => { if (isBtn(n)) L.btnRem.push(name(n) + ' < ' + name(m.target)); });
  } }).observe(document, { subtree: true, childList: true });
  // the pop-ups may come once the page has been still for a moment: an animation counts when it starts within 0.8 s of a scroll
  L.lastScroll = 0; L.maxGap = 0; window.addEventListener('scroll', () => { const t = performance.now(); if (L.on && L.lastScroll) L.maxGap = Math.max(L.maxGap, t - L.lastScroll); L.lastScroll = t; }, { passive: true });
  document.addEventListener('sl-hero-entered', () => { L.heroGone = performance.now(); });
  document.addEventListener('animationstart', (e) => { if (L.on) { const since = performance.now() - L.lastScroll; if (since < 800) L.anims.push(e.animationName + ' on ' + name(e.target) + ' (' + Math.round(since) + ' ms after a scroll)'); } }, true);
  // (a button under a resting mouse changing colour is a hover, not a redraw - the mouse is kept off the page's content)
  document.addEventListener('transitionrun', (e) => { if (!L.on || e.propertyName === 'scrollbar-color') return; let fromTo = ''; // (a scrollbar colour on something that never scrolls is never seen)
    try { const a = e.target.getAnimations().find((x) => x.transitionProperty === e.propertyName); const k = a && a.effect.getKeyframes(); if (k) fromTo = ' ' + k.map((f) => Object.entries(f).filter(([q]) => !/^(offset|easing|composite|computedOffset)$/.test(q)).map(([, v]) => v).join(' ')).join(' -> '); } catch (x) {}
    L.trans.push(e.propertyName + ' on ' + name(e.target) + fromTo + (L.chosenAt ? ' (' + Math.round(performance.now() - L.chosenAt) + ' ms after the choice)' : '')); }, true);
  try { new PerformanceObserver((l) => { if (L.on) l.getEntries().forEach((e) => L.shifts.push({ t: e.startTime, v: e.value, src: (e.sources || []).map((s) => s.node && s.node.nodeType === 1 ? name(s.node) : '?').join(',') })); }).observe({ type: 'layout-shift' }); } catch (e) {}
  // every frame: where the tracked buttons on the screen are. A button may only move by as much as the page scrolled
  // (and not at all in the frame where the photo goes away: the page moves up by its height and the scroll goes to 0).
  let prev = null;
  const tick = () => {
    if (L.on) {
      L.frames++;
      const hero = document.getElementById('sl-hero'), heroOn = !!(hero && !hero.hidden), hh = heroOn ? hero.offsetHeight : 0, vh = innerHeight;
      const els = [...document.querySelectorAll('.sl-header button, .tabs .tab-btn, #grid .card .seen-btn, #grid .card .map-btn, #fav-layer .sl-tag')].filter((b) => b.offsetParent).slice(0, 600);
      const cur = { y: scrollY, hh, pos: new Map(els.map((b) => [b, b.getBoundingClientRect().top])) };
      if (prev) {
        const expect = -(cur.y - prev.y) - (prev.hh - cur.hh); // scrolled by dy -> moved up by dy; the photo going -> everything up by its height
        const onScreen = (t) => t > -40 && t < vh + 40; // (cards far below the screen may still settle their size - not seen)
        for (const [b, top] of cur.pos) { const was = prev.pos.get(b); if (was === undefined || !onScreen(was + expect) || !onScreen(top)) continue; const d = top - was - expect; if (Math.abs(d) > 2) { L.jumps.push(name(b) + ' ' + d.toFixed(1) + 'px'); } }
      }
      prev = cur;
    } else prev = null;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function run(b, o) {
  const label = (o.phone ? 'phone' : 'computer') + ', ' + (o.first ? 'first visit' : 'returning') + ', ' + o.theme + (o.drawn ? ', SnakeList already drawn' : ', scrolling at once');
  const ctx = await b.newContext(o.phone ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, colorScheme: o.theme } : { viewport: { width: 1280, height: 860 }, colorScheme: o.theme });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  await p.addInitScript(([first, theme]) => {
    if (!first) ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen'].forEach((k) => localStorage.setItem(k, '1'));
    localStorage.setItem('sl-theme', theme);
  }, [!!o.first, o.theme]);
  await p.addInitScript(watch);
  await p.goto(BASE + (process.env.PAGE || ''), { waitUntil: 'load', timeout: 120000 }); // (PAGE: another copy of the page, e.g. an older one to compare)
  await p.waitForFunction(() => window.__introDone, null, { timeout: 90000 });
  await p.waitForTimeout(o.drawn ? 6000 : 1200);
  const cdp = await ctx.newCDPSession(p);
  const step = async () => {
    if (o.phone) { // a short swipe up, like a thumb
      let y = 650; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 206, y }] });
      for (let i = 0; i < 6; i++) { y -= 25; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 206, y }] }); await p.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else { await p.mouse.move(4, 600); await p.mouse.wheel(0, 120); }
    await p.waitForTimeout(110);
  };
  // the buttons there are now are marked: each must still be the same element at the end
  await p.evaluate(() => { let n = 0; document.querySelectorAll('button, [role=button]').forEach((x) => { x.__hsMark = 1; n++; }); window.__HS.n0 = n; window.__HS.on = true; });
  for (let k = 0; k < 40 && !(await p.evaluate(() => window.__heroEntered)); k++) await step();
  const entered = await p.evaluate(() => !!window.__heroEntered);
  for (let k = 0; k < 18; k++) await step(); // on down the list
  await p.waitForTimeout(600); // (the tags and pop-out wait for the scrolling to pause - they must not redraw then either)
  const r = await p.evaluate(() => { const L = window.__HS; L.on = false; let gone = 0; document.querySelectorAll('button, [role=button]').forEach(() => {});
    // marked buttons no longer in the page (removed or replaced by a new copy)
    const all = new Set(document.querySelectorAll('button, [role=button]')); let kept = 0; all.forEach((x) => { if (x.__hsMark) kept++; }); gone = L.n0 - kept;
    return { gone, n0: L.n0, add: L.btnAdd, rem: L.btnRem, anims: L.anims, trans: L.trans, shifts: L.shifts, heroGone: L.heroGone, maxGap: L.maxGap, jumps: L.jumps, frames: L.frames, y: scrollY }; });
  if (SHOTS) await p.screenshot({ path: SHOTS + '/hero-scroll-' + label.replace(/[^a-z]+/gi, '-') + '.png' });
  const uniq = (a) => [...new Set(a)].slice(0, 6).join(' | ');
  console.log('-- ' + label + ': scrolled to ' + r.y + ', ' + r.frames + ' frames, ' + r.n0 + ' buttons, longest pause between scroll events ' + Math.round(r.maxGap) + ' ms');
  ok(entered && r.y > 600, label + ': the scroll went from the photo into SnakeList and on down the list');
  ok(r.gone === 0 && !r.rem.length, label + ': no button removed or made again (' + r.gone + ' gone' + (r.rem.length ? ': ' + uniq(r.rem) : '') + ')');
  ok(!r.add.length, label + ': no button added while scrolling' + (r.add.length ? ' (' + r.add.length + ': ' + uniq(r.add) + ')' : ''));
  ok(!r.anims.length, label + ': no animation starts while scrolling' + (r.anims.length ? ' (' + uniq(r.anims) + ')' : ''));
  ok(!r.trans.length, label + ': no fade/colour transition starts while scrolling' + (r.trans.length ? ' (' + r.trans.length + ': ' + uniq(r.trans) + ')' : ''));
  ok(!r.jumps.length, label + ': nothing jumps on screen (every button moves exactly with the scroll)' + (r.jumps.length ? ' (' + r.jumps.length + ': ' + uniq(r.jumps) + ')' : ''));
  // layout shifts: the frame where the photo goes away moves the page and the scroll together (nothing moves on screen - checked
  // frame by frame above), which Chrome still reports as a shift of the page; any other shift counts
  const other = r.shifts.filter((s) => !(r.heroGone && s.t > r.heroGone - 20 && s.t < r.heroGone + 400)); // (the frame that shows it can come a little after, on a slow phone)
  ok(!other.length, label + ': no layout shift' + (other.length ? ' (' + other.map((s) => s.v.toFixed(4) + ' ' + s.src + ' at ' + Math.round(s.t - (r.heroGone || 0)) + ' ms from the photo going').slice(0, 4).join(' | ') + ')' : ''));
  ok(!errs.length, label + ': no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  // the pop-ups come once the scrolling has stopped (not during it)
  if (o.first) {
    await p.waitForSelector('#sl-level.open', { timeout: 15000 }).catch(() => {});
    ok(await p.evaluate(() => document.getElementById('sl-level').classList.contains('open')), label + ': the "How well do you know snakes?" choice opens once the scrolling stops');
    const press = (sel) => (o.phone ? p.tap(sel) : p.click(sel)); // (a finger on the phone: a mouse left resting there would hover the cards)
    await press('.sl-lv-opt[data-level="some"]'); await press('#sl-lv-go'); await p.evaluate(() => { window.__HS.chosenAt = performance.now(); });
    if (!o.phone) await p.mouse.move(4, 600); // (off the cards: a card under a resting mouse pops out - a hover, not a redraw)
    await p.waitForTimeout(900);
    await p.evaluate(() => { const s = document.getElementById('tour-skip'); if (s && !document.getElementById('tour-layer').hidden) s.click(); });
    await p.waitForTimeout(1500);
    // after the choice (the list was put in a new order then): scrolling on still redraws nothing
    const r2 = await (async () => {
      await p.evaluate(() => { const L = window.__HS; L.btnAdd = []; L.btnRem = []; L.anims = []; L.trans = []; L.jumps = []; document.querySelectorAll('button, [role=button]').forEach((x) => { x.__hsMark2 = 1; }); L.n1 = document.querySelectorAll('button, [role=button]').length; L.on = true; });
      for (let k = 0; k < 14; k++) await step();
      await p.waitForTimeout(600);
      return p.evaluate(() => { const L = window.__HS; L.on = false; let kept = 0; document.querySelectorAll('button, [role=button]').forEach((x) => { if (x.__hsMark2) kept++; }); return { gone: L.n1 - kept, add: L.btnAdd, anims: L.anims.filter((a) => !/^wnUp on div#ck-bar/.test(a)), trans: L.trans, jumps: L.jumps }; });
    })();
    ok(r2.gone === 0 && !r2.add.length && !r2.anims.length && !r2.trans.length && !r2.jumps.length, label + ': after the choice, scrolling on redraws nothing (' + JSON.stringify({ gone: r2.gone, add: r2.add.length, anims: uniq(r2.anims), trans: uniq(r2.trans), jumps: uniq(r2.jumps) }) + ')');
  } else {
    await p.waitForTimeout(2500);
    ok(await p.evaluate(() => !document.getElementById('ck-bar').hidden), label + ': the cookie question comes up once the scrolling has stopped');
  }
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const all = [{ phone: false, theme: 'light' }, { phone: true, theme: 'light' }, { phone: false, theme: 'dark', drawn: true }, { phone: true, theme: 'dark', drawn: true },
    { phone: false, theme: 'light', first: true }, { phone: true, theme: 'dark', first: true }];
  for (const [i, o] of all.entries()) if (!process.env.ONLY || process.env.ONLY.split(',').includes(String(i + 1))) await run(b, o); // ONLY=2,6: just those
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
