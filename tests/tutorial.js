// Run: serve the repo (python3 -m http.server $PORT --bind 127.0.0.1), then  PORT=<port> node tests/tutorial.js [screenshot-dir]
// (PAGE=snakelist-synced.html tests the canonical file directly - the charset and viewport tags the website adds are put in front.)
// v6.28: the tutorial and guides (script#sl-tour) - the "tutorial" preview, switched on here.
//  * first visit: the opening, then "How well do you know snakes?", then the welcome - Start Quick Tour / Explore Full Tutorial /
//    Skip for now - and nothing else pops up meanwhile (SL_canPrompt says no)
//  * the Quick Tour and the Full Tutorial run to the end in the learning order (7 stages), on a computer and on a phone
//    ("Click" / "Tap"), with every box inside the screen; your lists are never touched and the "King Cobra" example is put back
//  * Skip, the x and Escape close it at any step and keep your place: Settings -> Tutorials & help offers Continue, and so does
//    the welcome after a reload in the middle (an interrupted run)
//  * Restart goes back to the welcome; Back works; Tab stays in the box; Right arrow = Next
//  * the feature guides run, the Filters guide closes the section it opened, data-sl-guide="..." starts one
//  * Settings -> Tutorials & help (into [data-sl-settings-help] when the panel has one)
//  * the one-time Map guide offer
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, PAGE = process.env.PAGE || '', BASE = 'http://127.0.0.1:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const USER_KEYS = /^(sl-web-state|sl-favs|sl-follow-meta|sl-pinned|sl-badges|sl-ach-dates|sl-ach-seen|sl-seen|sl-wish|sl-follow|sl-notes|sl-enc|sl-photos|sl-interests)/;

async function fresh(b, o) {
  o = o || {};
  const ctx = await b.newContext(o.phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.errs = errs;
  await p.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  if (/synced/.test(PAGE)) await p.route(/snakelist-synced\.html/, async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' + (await res.text()), headers: { ...res.headers(), 'content-type': 'text/html; charset=utf-8' } }); });
  // the new tutorial is the "tutorial" preview (Settings > Previews); without it the old tutorial runs
  await p.addInitScript(() => { if (localStorage.getItem('sl-art-preview-tutorial') == null) localStorage.setItem('sl-art-preview-tutorial', '1'); });
  if (o.init) await p.addInitScript(o.init);
  await p.goto(BASE + PAGE, { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction(() => window.__introDone, null, { timeout: 90000 });
  return p;
}
const returning = () => { ['sl-intro-seen', 'sl-tour-seen', 'sl-level-seen', 'sl-news-off'].forEach((k) => { if (localStorage.getItem(k) == null) localStorage.setItem(k, '1'); }); if (!localStorage.getItem('sl-consent')) localStorage.setItem('sl-consent', 'essential'); };
async function pastHero(p) {
  for (let k = 0; k < 30 && !(await p.evaluate(() => window.__heroEntered || !document.querySelector('#sl-hero:not([hidden])'))); k++) { await p.mouse.move(200, 400); await p.mouse.wheel(0, 600); await p.waitForTimeout(500); }
}
const cur = (p) => p.evaluate(() => window.SL_TOUR.current());
const shown = (p) => p.waitForFunction(() => { const l = document.getElementById('tour-layer'), c = document.getElementById('tour-callout'); return !l.hidden && c.offsetWidth > 0; }, null, { timeout: 15000 }).then(() => p.waitForTimeout(700)).catch(() => {});
const box = (p) => p.evaluate(() => { const r = document.getElementById('tour-callout').getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, vw: innerWidth, vh: innerHeight, title: document.getElementById('tour-title').textContent, text: document.getElementById('tour-text').textContent, num: document.getElementById('tour-step-num').textContent }; });
const userData = (p) => p.evaluate((re) => { const o = {}, R = new RegExp(re); for (let k = 0; k < localStorage.length; k++) { const n = localStorage.key(k); if (R.test(n)) o[n] = localStorage.getItem(n); } return JSON.stringify(o); }, USER_KEYS.source);
const next = (p) => p.evaluate(() => document.getElementById('tour-next').click());

async function runTo(p, label, max, onStep) {
  const ids = []; let offscreen = [];
  for (let n = 0; n < (max || 60); n++) {
    await shown(p);
    const c = await cur(p); if (!c) break;
    ids.push(c.step);
    const bx = await box(p);
    if (bx.l < -1 || bx.t < -1 || bx.r > bx.vw + 1 || bx.b > bx.vh + 1) offscreen.push(c.step);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${label}-${String(n + 1).padStart(2, '0')}-${c.step}.png` });
    const said = onStep && (await onStep(c, bx));
    if (said === 'stop') return { ids, offscreen };
    if (said === 'done') continue; // (the step moved on by itself)
    if (c.step === 'search') { await p.click('#tour-trycobra'); await p.waitForTimeout(3000); if ((await cur(p)).step === 'search') await next(p); continue; }
    await next(p);
  }
  return { ids, offscreen };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  // 1. the first visit: chooser, then the welcome; nothing else on top
  let p = await fresh(b);
  ok(await p.evaluate(() => window.SL_TOUR && window.SL_TOUR.pending() && !window.SL_canPrompt()), 'first visit: the tutorial is pending, so no other pop-up may open');
  await pastHero(p);
  await p.waitForSelector('#sl-level.open', { timeout: 20000 }).catch(() => {});
  ok(await p.evaluate(() => document.getElementById('sl-level').classList.contains('open') && document.getElementById('tour-layer').hidden), 'the level chooser comes first, the tutorial waits');
  await p.click('.sl-lv-opt[data-level="new"]'); await p.click('#sl-lv-go');
  await shown(p);
  const w = await p.evaluate(() => ({ step: window.SL_TOUR.current() && window.SL_TOUR.current().step, choices: [...document.querySelectorAll('.tour-choices button')].map((x) => x.dataset.go), skip: document.getElementById('tour-skip').textContent,
    photo: !!document.querySelector('#tour-media .tour-photo img'), logo: !!document.querySelector('#tour-media .tour-logo'), others: [...document.querySelectorAll('#wn-sheet.open, .ck-bar:not([hidden]), #sl-welcome, #sl-idea, #xm-welcome, .keep-nudge, .sl-nudge')].filter((e) => e.offsetParent).length,
    can: window.SL_canPrompt(), modal: document.getElementById('tour-callout').getAttribute('aria-modal'), focusIn: document.getElementById('tour-callout').contains(document.activeElement) }));
  ok(w.step === 'welcome' && w.choices.join() === 'quick,full' && /Skip for now/.test(w.skip), 'the welcome offers Start Quick Tour / Explore Full Tutorial / Skip for now');
  ok(w.photo && w.logo, 'the welcome has a snake photo and the SnakeList logo');
  ok(!w.others && !w.can, 'nothing else is showing, and nothing else may pop up while it shows');
  ok(w.modal === 'true' && w.focusIn, 'it is a modal dialog and the focus is inside it');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/t-welcome.png' });
  const before = await userData(p);
  // keyboard: Tab stays inside, Escape closes
  for (let k = 0; k < 8; k++) await p.keyboard.press('Tab');
  ok(await p.evaluate(() => document.getElementById('tour-callout').contains(document.activeElement)), 'Tab stays inside the box');
  // 2. the Quick Tour, start to finish
  await p.click('.tour-choices [data-go="quick"]');
  let deskCard = null;
  const q = await runTo(p, 'quick', 30, async (c, bx) => { if (c.step === 'card') deskCard = bx; });
  ok(q.ids.join() === 'what,nav,search,card,seen,map-tab,help,done', 'the Quick Tour: ' + q.ids.join(' > '));
  ok(deskCard && /Click a tag/.test(deskCard.text), 'computer wording: "Click a tag"');
  ok(!q.offscreen.length, 'every box stays on the screen' + (q.offscreen.length ? ' (' + q.offscreen + ')' : ''));
  ok(await p.evaluate(() => !window.SL_TOUR.current() && document.getElementById('tour-layer').hidden && localStorage.getItem('sl-tour-seen') === '1' && JSON.parse(localStorage.getItem('sl-tour-progress')).done.quick === 1), 'Start Exploring closes it and remembers it was finished');
  ok(await p.evaluate(() => document.getElementById('search').value === ''), 'the "King Cobra" example is taken out of the search again');
  ok((await userData(p)) === before, 'your lists, sightings and picks were not changed');
  ok(!p.errs.length, 'no page errors' + (p.errs.length ? ': ' + p.errs.join(' | ') : ''));
  await p.context().close();

  // 3. the Full Tutorial on a computer, in the learning order; skip at step 12, then Continue from Settings
  p = await fresh(b, { init: returning });
  await p.evaluate(() => window.SL_TOUR.start('hub')); await shown(p);
  await p.click('.tour-choices [data-go="full"]');
  const STAGE_ORDER = [];
  let r = await runTo(p, 'full-a', 60, async (c, bx) => { const m = bx.num.match(/Stage (\d)/); if (m) STAGE_ORDER.push(+m[1]); return c.step === 'record' ? 'stop' : null; });
  ok(r.ids.slice(0, 4).join() === 'what,why,cando,nav', 'Full Tutorial starts: what SnakeList is, why it was made, what you can do, then the basics');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !window.SL_TOUR.current() && JSON.parse(localStorage.getItem('sl-tour-progress')).cur.id === 'record'), 'Escape closes it and keeps your place (step "Record a sighting")');
  await p.click('#set-btn'); await p.waitForTimeout(500);
  const help = await p.evaluate(() => { const s = document.querySelector('#sl-settings .sl-tour-help'); return s && { text: s.textContent, guides: s.querySelectorAll('[data-guide]').length, resume: !!s.querySelector('[data-th="resume"]') }; });
  ok(help && help.resume && help.guides >= 6 && /Quick Tour/.test(help.text) && /What's new/.test(help.text), 'Settings has Tutorials & help: Continue, Quick Tour, Full Tutorial, ' + (help && help.guides) + ' guides, What\'s new');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/t-settings-help.png' });
  await p.click('#sl-settings [data-th="resume"]'); await shown(p);
  ok((await cur(p)).step === 'record', 'Continue goes back to the same step');
  r = await runTo(p, 'full-b', 60, async (c, bx) => { const m = bx.num.match(/Stage (\d)/); if (m) STAGE_ORDER.push(+m[1]); });
  ok(r.ids[r.ids.length - 1] === 'done' && r.ids.indexOf('map-intro') < r.ids.indexOf('quiz') && r.ids.indexOf('quiz') < r.ids.indexOf('settings'), 'it goes on to the map, then extras, then settings, then the end');
  ok(STAGE_ORDER.every((s, k) => !k || s >= STAGE_ORDER[k - 1]) && STAGE_ORDER[STAGE_ORDER.length - 1] === 7, 'the stages only go forward, 1 to 7');
  ok(!r.offscreen.length, 'every box stays on the screen' + (r.offscreen.length ? ' (' + r.offscreen + ')' : ''));
  // 4. Restart and Back
  await p.evaluate(() => window.SL_TOUR.start('full')); await shown(p); await next(p); await shown(p); await next(p); await shown(p);
  const s2 = (await cur(p)).step; await p.click('#tour-back'); await shown(p);
  ok(s2 === 'cando' && (await cur(p)).step === 'why', 'Back goes to the step before');
  await p.click('#tour-restart'); await shown(p);
  ok((await cur(p)).step === 'welcome', 'Restart goes back to the welcome');
  await p.click('#tour-close'); await p.waitForTimeout(300);
  // 5. guides
  for (const g of ['map', 'sightings', 'checklist', 'filters', 'camera', 'achievements']) {
    await p.evaluate((g) => window.SL_TOUR.start(g), g);
    const rr = await runTo(p, 'guide-' + g, 30, async (c) => {
      if (c.step === 'filters-try') { await p.click('details.fsec[data-sec="family"] > summary'); await p.waitForTimeout(1500); return 'done'; }
    });
    ok(rr.ids[rr.ids.length - 1] === 'guide-done' && !rr.offscreen.length, 'the ' + g + ' guide runs to the end (' + rr.ids.length + ' steps)');
    if (g === 'filters') ok(await p.evaluate(() => !document.querySelector('details.fsec[data-sec="family"]').open), 'the Filters guide closes the section it opened');
  }
  await p.evaluate(() => { const b = document.createElement('button'); b.id = 'xg'; b.setAttribute('data-sl-guide', 'camera'); b.textContent = 'guide'; document.body.appendChild(b); b.click(); }); await shown(p);
  ok((await cur(p)) && (await cur(p)).guide === 'camera', 'an element with data-sl-guide="camera" starts the Camera guide');
  ok(/can be wrong|guide, not/.test(await p.evaluate(() => Object.values(window.SL_TOUR.steps).map((s) => typeof s.text === 'string' ? s.text : '').join(' '))), 'the camera is described as a guide that can be wrong');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // a settings panel with its own slot
  await p.evaluate(() => { const d = document.createElement('div'); d.id = 'fake-set'; d.innerHTML = '<div data-sl-settings-help></div>'; document.body.appendChild(d); window.SL_TOUR_MOUNT_HELP(d); });
  ok(await p.evaluate(() => !!document.querySelector('#fake-set [data-sl-settings-help] .sl-tour-help [data-th="quick"]')), 'Tutorials & help goes into [data-sl-settings-help] when Settings has one');
  // 6. the one-time Map guide offer (not after the Full Tutorial; clear that first)
  await p.evaluate(() => { const g = JSON.parse(localStorage.getItem('sl-tour-progress')); delete g.done.full; delete g.done.map; localStorage.setItem('sl-tour-progress', JSON.stringify(g)); });
  // (v6.3x: the "See snakes from <your country>" panel is a pop-up too - closed first, as anyone would, so the offer can come)
  await p.evaluate(() => { const x = document.querySelector('#sl-ipc .nd-x'); if (x) x.click(); }); await p.waitForTimeout(500);
  await p.click('#tab-guide'); await p.waitForTimeout(400); await p.click('#tab-map');
  // (it waits its turn: another pop-up - like the sign-in nudge after a few minutes of use - goes first)
  await p.waitForSelector('.sl-tour-tip.on', { timeout: 30000 }).catch(() => {});
  ok(await p.evaluate(() => !!document.querySelector('.sl-tour-tip.on') && localStorage.getItem('sl-tour-tip-map') === '1'), 'the first time the Map tab opens, a Map guide is offered (once)');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/t-map-offer.png' });
  await p.click('.sl-tour-tip .go'); await shown(p);
  ok((await cur(p)).guide === 'map', 'Show me starts the Map guide');
  await p.keyboard.press('Escape');
  ok(!p.errs.length, 'no page errors' + (p.errs.length ? ': ' + p.errs.join(' | ') : ''));
  await p.context().close();

  // 7. an interrupted first run (the page reloaded in the middle) offers Continue on the welcome
  p = await fresh(b, { init: () => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); ['sl-intro-seen', 'sl-level-seen', 'sl-news-off'].forEach((k) => localStorage.setItem(k, '1')); localStorage.setItem('sl-consent', 'essential'); } } });
  await pastHero(p); await shown(p);
  await p.click('.tour-choices [data-go="full"]'); await shown(p); await next(p); await shown(p); await next(p); await shown(p);
  const at = (await cur(p)).step;
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__introDone, null, { timeout: 90000 }); await pastHero(p); await shown(p);
  ok(await p.evaluate((at) => { const b = document.querySelector('.tour-choices [data-go="resume"]'); return !!b && document.querySelector('.tour-choices button.primary') === b; }, at), 'after a reload in the middle, the welcome comes back with "Continue where you left off"');
  await p.click('.tour-choices [data-go="resume"]'); await shown(p);
  ok((await cur(p)).step === at, 'and it continues at the same step (' + at + ')');
  // Skip at another point
  await next(p); await shown(p); await p.click('#tour-skip'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.getElementById('tour-layer').hidden && localStorage.getItem('sl-tour-seen') === '1'), 'Skip tutorial closes it at any step');
  await p.context().close();

  // 8. a phone: a bottom sheet inside the screen, "Tap" words
  p = await fresh(b, { phone: true, init: returning });
  await p.evaluate(() => window.SL_TOUR.start('quick'));
  let phCard = null;
  const ph = await runTo(p, 'phone-quick', 20, async (c, bx) => { if (c.step === 'card') phCard = bx; }); ph.card = phCard;
  ok(ph.ids[ph.ids.length - 1] === 'done' && !ph.offscreen.length, 'phone: the Quick Tour runs with every box on the screen');
  ok(ph.card && /Tap a tag/.test(ph.card.text) && ph.card.l >= 15 && ph.card.vw - ph.card.r >= 15, 'phone: "Tap" wording and a sheet 16px from the edges');
  ok(!p.errs.length, 'phone: no page errors' + (p.errs.length ? ': ' + p.errs.join(' | ') : ''));
  await p.context().close();
  await b.close();
  console.log(fails ? fails + ' failed' : 'all passed');
})();
