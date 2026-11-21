// Run: serve the repo (python3 -m http.server $PORT --bind 127.0.0.1), then  PORT=<port> node tests/level-chooser.js [screenshot-dir]
// v5.93: the first-visit "How well do you know snakes?" choice.
//  * a brand-new visitor gets it after the opening and the photo, before the tutorial (the tutorial comes after the choice)
//  * "Accept and continue" stores the choice (sl-level) and the cookie answer; the checklist starts with famous snakes for
//    "I'm new to snakes" and little-known ones for "I know a lot"; the quiz marks Easy / Hard "Recommended for you"
//  * "Just for this visit" uses the choice without storing it
//  * the skip keys (sl-level-seen, or sl-tour-seen like the other tests) keep it away; it can be changed from the quiz
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://127.0.0.1:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };

async function fresh(b, init) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.errs = errs;
  await p.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  if (init) await p.addInitScript(init);
  await p.goto(BASE, { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction(() => window.__introDone, null, { timeout: 90000 });
  return p;
}
async function pastHero(p) {
  // the opening photo: scroll down (as a visitor would) until SnakeList is entered
  for (let k = 0; k < 30 && !(await p.evaluate(() => window.__heroEntered || !document.querySelector('#sl-hero:not([hidden])'))); k++) {
    await p.mouse.move(640, 400); await p.mouse.wheel(0, 600); await p.waitForTimeout(500);
  }
}
const topIds = (p, n) => p.evaluate((n) => [...document.querySelectorAll('#grid .card')].filter((c) => c.offsetParent && getComputedStyle(c).display !== 'none')
  .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left).slice(0, n).map((c) => c.dataset.id), n);
const fameOf = (p, ids) => p.evaluate((ids) => { const F = JSON.parse(document.getElementById('fame-data').textContent); return ids.map((i) => F[i] || 0); }, ids);
const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // 1. first visit: chooser after the photo, before the tutorial
  let p = await fresh(b);
  await pastHero(p);
  await p.waitForSelector('#sl-level.open', { timeout: 20000 }).catch(() => {});
  ok(await p.evaluate(() => document.getElementById('sl-level').classList.contains('open')), 'first visit: the chooser opens after the opening photo');
  ok(await p.evaluate(() => document.getElementById('tour-layer').hidden), 'the tutorial waits until a choice is made');
  ok(await p.evaluate(() => document.getElementById('sl-lv-go').disabled), 'Accept and continue is off until a choice is picked');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/test-chooser.png' });
  await p.click('.sl-lv-opt[data-level="new"]');
  await p.click('#sl-lv-go');
  await p.waitForTimeout(900);
  ok(await p.evaluate(() => localStorage.getItem('sl-level') === 'new' && localStorage.getItem('sl-consent') === 'yes'), 'Accept and continue stores the choice and the cookie answer');
  ok(await p.evaluate(() => !document.getElementById('tour-layer').hidden), 'the tutorial starts after the choice');
  await p.evaluate(() => document.getElementById('tour-skip').click());
  await p.waitForTimeout(500);
  const newTop = await topIds(p, 12), newF = await fameOf(p, newTop);
  console.log('  new-to-snakes first cards:', newTop.join(', '));
  ok(avg(newF) > 900, "I'm new to snakes: the first cards are famous snakes (average fame " + Math.round(avg(newF)) + ')');
  await p.evaluate(() => document.getElementById('tab-quiz').click()); await p.waitForTimeout(500);
  ok(await p.evaluate(() => { const r = document.querySelector('.quiz-level-btn.is-rec'); return r && r.dataset.level === 'easy' && /Recommended for you/.test(r.textContent); }), 'quiz: Easy is Recommended for you');
  ok(await p.evaluate(() => document.querySelectorAll('.quiz-rec').length === 1), 'quiz: only one level is recommended');
  // change it from the quiz
  await p.click('#quiz-lv-note button'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.getElementById('sl-level').classList.contains('open')), 'quiz: Change opens the chooser again');
  await p.click('.sl-lv-opt[data-level="lot"]'); await p.click('#sl-lv-go'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => localStorage.getItem('sl-level') === 'lot' && document.querySelector('.quiz-level-btn.is-rec').dataset.level === 'hard'), 'changed to "know a lot": Hard is recommended now');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/test-quiz-rec.png' });
  await p.evaluate(() => document.getElementById('tab-guide').click()); await p.waitForTimeout(600);
  const lotTop = await topIds(p, 12), lotF = await fameOf(p, lotTop);
  console.log('  know-a-lot first cards:', lotTop.join(', '));
  ok(avg(lotF) < 450, 'I know a lot: the first cards are little-known snakes (average fame ' + Math.round(avg(lotF)) + ')');
  ok(!p.errs.length, 'no page errors' + (p.errs.length ? ': ' + p.errs.join(' | ') : ''));
  await p.context().close();

  // 2. "Just for this visit": used, not stored
  p = await fresh(b);
  await pastHero(p);
  await p.waitForSelector('#sl-level.open', { timeout: 20000 }).catch(() => {});
  await p.click('.sl-lv-opt[data-level="some"]'); await p.click('#sl-lv-no'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => !localStorage.getItem('sl-level') && window.SL_LEVEL() === 'some' && localStorage.getItem('sl-consent') === 'no'), 'Just for this visit: the choice is used but not stored');
  await p.evaluate(() => { document.getElementById('tour-skip').click(); document.getElementById('tab-quiz').click(); }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.querySelector('.quiz-level-btn.is-rec').dataset.level === 'medium'), 'quiz: Medium is recommended for "know a bit"');
  await p.context().close();

  // 3. the skip keys
  p = await fresh(b, () => { localStorage.setItem('sl-level-seen', '1'); });
  await pastHero(p); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => !document.getElementById('sl-level').classList.contains('open')), 'sl-level-seen = 1 skips the chooser');
  await p.context().close();
  p = await fresh(b, () => { ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off'].forEach((k) => localStorage.setItem(k, '1')); });
  await pastHero(p); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => !document.getElementById('sl-level').classList.contains('open')), 'returning visitors (sl-tour-seen) never get it');
  await p.context().close();
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
