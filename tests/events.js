// Events preview (events/*): countdown, early access, Advent Calendar claims/streaks/skips, trusted time vs. device
// clock, subscriber-skip cap (TEST switch), grand prize, seasonal achievements, cursor customization, reduced
// motion, phone + desktop layout, cursor-effect performance - and that nothing appears without the preview switch.
// Run: python3 build-site.py, then  node tests/events.js [screenshot-dir]
// No web server needed: the repo's files are served to the browser straight from disk (page.route), and the
// "server" Date header the app trusts is answered from the fake clock (page.clock) plus a chosen skew.
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), HOST = 'http://snakelist.test/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const T = (s) => new Date(s).getTime();
const DAY = 864e5;

async function open(b, o) {
  o = o || {};
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, o.ctx || {}));
  const p = await ctx.newPage();
  const errs = [], evFetches = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.dismiss());
  p.skew = o.skew || 0;            // the "server" clock = the page's (device) clock + skew
  p.noServer = !!o.noServer;
  await ctx.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.origin + '/' !== HOST) return r.abort();
    if (u.searchParams.has('sl-time')) {
      if (p.noServer) return r.abort();
      let t; try { t = await p.evaluate(() => Date.now()); } catch (e) { t = Date.now(); }
      return r.fulfill({ status: 200, headers: { Date: new Date(t + p.skew).toUTCString(), 'Cache-Control': 'no-store' }, body: '' });
    }
    if (u.pathname.startsWith('/events/')) evFetches.push(u.pathname);
    const f = path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, headers: { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }, body: fs.readFileSync(f) });
  });
  await p.addInitScript((seed) => {
    localStorage.setItem('sl-consent', 'essential'); localStorage.setItem('sl-tour-seen', '1'); localStorage.setItem('sl-news-off', '1'); localStorage.setItem('sl-level-seen', '1');
    if (seed && !sessionStorage.getItem('seeded')) { Object.keys(seed).forEach((k) => localStorage.setItem(k, seed[k])); sessionStorage.setItem('seeded', '1'); }
  }, o.seed || null);
  if (o.time) await p.clock.install({ time: o.time });
  await p.goto(HOST + 'index.html' + (o.query == null ? '?preview=events' : o.query), { waitUntil: 'load', timeout: 120000 });
  if (o.query == null || /events/.test(o.query)) {
    await p.waitForFunction(() => window.SL_EVENTS && window.SL_EVENTS.cursor, null, { timeout: 30000 });
    if (!o.noServer) await p.waitForFunction(() => SL_EVENTS.time.trusted(), null, { timeout: 30000 });
    else await p.waitForFunction(() => SL_EVENTS.time.failed(), null, { timeout: 30000 });
  }
  return { ctx, p, errs, evFetches };
}
// move the device clock to `t` and let the app ask the server again (as it does on its own every 10 minutes)
async function setTime(p, t) { await p.clock.setSystemTime(t); await p.evaluate(() => SL_EVENTS.time.sync()); await p.evaluate(() => SL_EVENTS.advent.load()); }
const claim = (p, d, via) => p.evaluate(([d, via]) => SL_EVENTS.advent.claim(d, via).then((r) => ({ ok: true, earnedSkip: r.earnedSkip }), (e) => ({ ok: false, reason: e.reason })), [d, via]);
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const noOverflow = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch();

  console.log('--- a normal visitor (no preview switch)');
  {
    const { ctx, p, errs, evFetches } = await open(b, { query: '', time: T('2026-12-05T10:00:00Z') });
    await p.waitForTimeout(1500);
    ok(await p.evaluate(() => !window.SL_EVENTS && !document.getElementById('sl-ev-banner') && !document.querySelector('link[href*="events/"]')), 'nothing from the events preview is on the page');
    ok(evFetches.length === 0, 'no events/ file is even downloaded (' + evFetches.length + ')');
    ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('--- countdown to the start of Christmas 2026 (viewer in New York)');
  {
    const { ctx, p, errs } = await open(b, { time: T('2026-11-30T23:58:00Z'), ctx: { timezoneId: 'America/New_York' } });
    await p.waitForSelector('#sl-ev-banner');
    ok(await p.evaluate(() => /Christmas 2026/.test(document.getElementById('sl-ev-banner').textContent)), 'banner above the tabs names the event');
    ok(await p.evaluate(() => document.getElementById('sl-ev-banner').nextElementSibling === document.querySelector('.tabs')), 'banner sits right above the tabs');
    await p.click('#sl-ev-banner');
    await p.waitForSelector('#sl-ev-cd .sl-ev-clock');
    const txt = await p.textContent('#sl-ev-cd');
    ok(/Early access for subscribers/.test(txt), 'shows the "Early access for subscribers" badge');
    ok(/EST/.test(txt) && /November 30, 2026|30 November 2026|Nov 30, 2026/.test(txt), 'start time shown in the viewer\'s local time (30 Nov, EST)');
    ok(/Tue, 01 Dec 2026 00:00:00 UTC/.test(txt), 'and the single official UTC instant');
    await p.clock.pauseAt(T('2026-11-30T23:59:51Z'));   // (the page took real seconds to load; from here on the clock only moves when told)
    await p.clock.runFor(300);
    ok(await p.evaluate(() => document.querySelector('#sl-ev-cd .sl-ev-box').classList.contains('sl-ev-final')), 'last 10 seconds: the countdown escalates (final mode)');
    ok(await p.evaluate(() => document.getElementById('sl-ev-banner').classList.contains('sl-ev-hot')), 'banner heats up in the last minute');
    await shot(p, 'countdown-final-seconds');
    const s1 = await p.textContent('#sl-ev-cd [data-u="s"]');
    await p.clock.runFor(9000);
    ok(await p.evaluate(() => !!document.querySelector('#sl-ev-cd .sl-ev-burst .sl-ev-boom')), 'reaching zero plays the completion burst');
    ok(/has begun/.test(await p.textContent('#sl-ev-cd .sl-ev-burst')), 'burst says the event has begun (was ' + s1 + 's)');
    await shot(p, 'countdown-zero-burst');
    await p.clock.runFor(1000);
    { const t = await p.textContent('#sl-ev-cd');
      ok(/Live now/.test(t) && /Explore the Christmas event/.test(t) && /Time until Christmas/.test(t), 'then the panel turns live: the "Explore the Christmas event" button, and the clock counts on to Christmas'); }
    ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('--- early access (subscribers from 29 Nov)');
  {
    const { ctx, p } = await open(b, { time: T('2026-11-29T12:00:00Z') });
    ok(await p.evaluate(() => SL_EVENTS.countdownState().phase) === 'upcoming', 'without a subscription it is still upcoming');
    ok(await p.evaluate(() => !SL_EVENTS.isOpen('xmas2026')), 'event not open for free accounts yet');
    await p.evaluate(() => SL_EVENTS.setTestMode(true));
    ok(await p.evaluate(() => SL_EVENTS.countdownState().phase) === 'early', 'with the TEST subscriber switch: early access');
    ok(await p.evaluate(() => SL_EVENTS.isOpen('xmas2026')), 'event open early for the subscriber');
    await p.clock.runFor(600);
    ok(/early access/i.test(await p.textContent('#sl-ev-banner')), 'banner says early access');
    ok(await p.evaluate(() => SL_EVENTS.advent.claim(1, 'day').then(() => false, (e) => e.reason === 'future')), 'early access never opens Advent door 1 early');
    await p.evaluate(() => SL_EVENTS.subscribe.open()); await p.waitForSelector('#sl-ev-sub');
    ok(/TEST MODE/.test(await p.textContent('#sl-ev-sub')), 'subscription page shows the TEST MODE label');
    ok(/coming soon/i.test(await p.textContent('#sl-ev-sub [data-act="buy"]')), 'Subscribe button only says subscriptions are coming soon');
    await p.click('#sl-ev-sub [data-act="buy"]', { force: true });
    ok(await p.evaluate(() => SL_EVENTS.subscription().real === false), 'pressing it activates nothing');
    ok(/14 days/.test(await p.textContent('#sl-ev-sub')) && /non-refundable where legally permitted/.test(await p.textContent('#sl-ev-sub')), 'refund + 14-day withdrawal statement shown');
    ok(await p.$$eval('#sl-ev-sub [data-consent]', (l) => l.length) === 2, 'the two express-consent boxes are there');
    await shot(p, 'subscription-page');
    await ctx.close();
  }

  console.log('--- Advent Calendar, signed out (this device only, server time)');
  let p2, c2;
  {
    const r = await open(b, { time: T('2026-12-01T09:00:00Z') }); p2 = r.p; c2 = r.ctx;
    const p = p2;
    await p.evaluate(() => SL_EVENTS.advent.open()); await p.waitForSelector('#sl-ev-adv .sl-ev-door');
    ok(/Sign in to save your Advent Calendar/.test(await p.textContent('#sl-ev-adv')), 'signed out: "Sign in to save your Advent Calendar"');
    ok(await p.$$eval('#sl-ev-adv .sl-ev-door', (l) => l.length) === 24, '24 doors');
    ok(await p.$$eval('#sl-ev-adv .sl-ev-door.is-open', (l) => l.map((e) => e.dataset.day).join()) === '1', 'on 1 December only door 1 is open');
    await shot(p, 'advent-dec1-before');
    await p.click('#sl-ev-adv .sl-ev-door[data-day="1"]');
    await p.waitForSelector('.sl-ev-reveal');
    ok(/Santa-Hat Snake Sticker/.test(await p.textContent('.sl-ev-reveal')), 'door 1 reveals its reward');
    await p.clock.runFor(2200); await p.waitForTimeout(1800); await shot(p, 'advent-reveal');
    await p.click('.sl-ev-reveal [data-close]');
    ok((await claim(p, 1, 'day')).reason === 'already-claimed', 'door 1 cannot be claimed twice');
    ok((await claim(p, 2, 'day')).reason === 'future', 'door 2 (tomorrow) is refused');
    ok((await claim(p, 2, 'skip')).reason === 'future', 'a skip can never open a future door');
    await p.click('#sl-ev-adv .sl-ev-door[data-day="2"]');
    ok(await p.$$eval('.sl-ev-toast', (l) => l.some((t) => /No peeking/.test(t.textContent))), 'clicking a future door just says no peeking');
    await setTime(p, T('2026-12-02T15:00:00Z'));
    ok((await claim(p, 2, 'day')).ok, '2 December: door 2');
    await setTime(p, T('2026-12-03T08:00:00Z'));
    const d3 = await claim(p, 3, 'day');
    ok(d3.ok && d3.earnedSkip, '3 December: door 3 - a 3-day streak earns a free skip');
    ok(await p.evaluate(() => SL_EVENTS.logic.skipsLeft(SL_EVENTS.advent.event, SL_EVENTS.advent.state()).earned) === 1, '1 free skip available');
    await setTime(p, T('2026-12-05T12:00:00Z'));
    ok((await claim(p, 4, 'day')).reason === 'missed-needs-skip', '5 December: missed door 4 can\'t be opened as if on time');
    ok((await claim(p, 4, 'sub')).reason === 'not-subscriber', 'subscriber skip refused without a subscription');
    await p.click('#sl-ev-adv .sl-ev-door[data-day="4"]');
    await p.waitForSelector('#sl-ev-adv [data-skip]:not([hidden]) [data-act="skip"]');
    await shot(p, 'advent-recover-with-skip');
    await p.click('#sl-ev-adv [data-act="skip"]');
    await p.waitForSelector('.sl-ev-reveal'); await p.click('.sl-ev-reveal [data-close]');
    ok(await p.evaluate(() => SL_EVENTS.advent.state().doors[4].via) === 'skip', 'door 4 recovered with the free skip');
    ok((await claim(p, 5, 'day')).ok, 'door 5 on its day');
    ok(await p.evaluate(() => SL_EVENTS.logic.streak(SL_EVENTS.advent.event, SL_EVENTS.advent.state(), SL_EVENTS.time.now())) === 5, 'the recovered day counts for the streak (5 in a row)');
    ok((await claim(p, 6, 'skip')).reason === 'future', 'skips never recover future days');
    await shot(p, 'advent-dec5');

    console.log('--- seasonal achievements');
    await p.evaluate(() => SL_EVENTS.seasonal.evaluate());
    const e1 = await p.evaluate(() => SL_EVENTS.seasonal.earned());
    ok(e1['x-first'] && e1['x-streak3'] && e1['f-pioneer'], 'First Christmas, Three-Day Streak and Event Pioneer unlocked');
    ok(!e1['x-explorer'], 'Christmas Explorer (6 doors) not yet');
    const again = await p.evaluate(() => SL_EVENTS.seasonal.evaluate());
    ok(again.length === 0, 'evaluating again unlocks nothing twice');
    ok(e1['x-first'].startsWith('2026-12-0'), 'unlock date comes from the server time (' + e1['x-first'] + ')');
    await p.keyboard.press('Escape');
    await p.evaluate(() => window.SL_openAch()); await p.waitForSelector('#sl-ev-ach .sl-ev-agrp');
    await p.clock.runFor(800);
    ok(await p.$$eval('#sl-ev-ach .sl-ev-agrp', (l) => l.map((x) => x.dataset.event).join()) === 'xmas2026,newyear2027,firstever,snakeday2027,anniversary2027,halloween2027', 'grouped by event in the Achievements panel');
    ok(/Earned/.test(await p.textContent('#sl-ev-ach [data-ach="x-first"]')), 'First Christmas shows as earned');
    await shot(p, 'achievements-seasonal');
    await p.keyboard.press('Escape');
    await setTime(p, T('2027-01-02T12:00:00Z'));
    await p.evaluate(() => window.SL_openAch()); await p.waitForSelector('#sl-ev-ach'); await p.clock.runFor(800);
    ok(/No longer obtainable/.test(await p.textContent('#sl-ev-ach [data-ach="x-perfect"]')), 'after the event: unearned ones are marked "No longer obtainable"');
    ok(/Earned/.test(await p.textContent('#sl-ev-ach [data-ach="x-first"]')), 'earned ones are kept');
    ok((await claim(p, 6, 'skip')).reason === 'event-over', 'nothing can be claimed after the event');
    await p.keyboard.press('Escape');
    await c2.close();
  }

  console.log('--- device clock tampering');
  {
    // the device says 24 December, the server says 1 December
    const { ctx, p } = await open(b, { time: T('2026-12-24T10:00:00Z'), skew: -23 * DAY });
    await p.evaluate(() => SL_EVENTS.advent.open()); await p.waitForSelector('#sl-ev-adv .sl-ev-door');
    ok(await p.$$eval('#sl-ev-adv .sl-ev-door.is-open', (l) => l.map((e) => e.dataset.day).join()) === '1', 'device clock on 24 Dec, server on 1 Dec: only door 1 opens');
    ok((await claim(p, 24, 'day')).reason === 'future', 'door 24 refused');
    // changing the device clock after the page has loaded changes nothing (time runs on from the server's)
    await p.clock.setSystemTime(T('2027-06-01T10:00:00Z'));
    ok((await claim(p, 2, 'day')).reason === 'future', 'moving the device clock forward later still opens nothing');
    ok(await p.evaluate(() => new Date(SL_EVENTS.time.now()).toISOString().slice(0, 10)) === '2026-12-01', 'trusted time stays on the server\'s day');
    await ctx.close();
    const r = await open(b, { time: T('2026-12-24T10:00:00Z'), noServer: true });
    ok((await claim(r.p, 24, 'day')).reason === 'no-trusted-time', 'no answer from the server: nothing unlocks from the device clock alone');
    await r.p.evaluate(() => SL_EVENTS.advent.open()); await r.p.waitForSelector('#sl-ev-adv');
    ok(await r.p.$$eval('#sl-ev-adv .sl-ev-door.is-open', (l) => l.length) === 0, 'and no door shows as open');
    await r.ctx.close();
  }

  console.log('--- subscriber skips (TEST switch): max 10, separate from earned skips');
  {
    const { ctx, p } = await open(b, { time: T('2026-12-20T10:00:00Z') });
    await p.evaluate(() => SL_EVENTS.setTestMode(true));
    ok(await p.evaluate(() => SL_EVENTS.advent.kind()) === 'test', 'TEST mode uses its own separate progress');
    let n = 0; for (let d = 1; d <= 10; d++) if ((await claim(p, d, 'sub')).ok) n++;
    ok(n === 10, '10 subscriber skips used on doors 1-10');
    ok((await claim(p, 11, 'sub')).reason === 'subscriber-skip-cap', 'the 11th subscriber skip is refused');
    const sk = await p.evaluate(() => SL_EVENTS.logic.skipsLeft(SL_EVENTS.advent.event, SL_EVENTS.advent.state()));
    ok(sk.sub === 0 && sk.earned === 3, 'earned skips are counted separately (3 earned from the run, 0 subscriber left)');
    ok((await claim(p, 11, 'skip')).ok, 'an earned skip still works');
    ok((await claim(p, 20, 'day')).ok, 'today\'s door 20 on time');
    await p.evaluate(() => SL_EVENTS.seasonal.evaluate());
    const e = await p.evaluate(() => SL_EVENTS.seasonal.earned());
    ok(!e['x-explorer'], 'doors from subscriber skips don\'t count for achievements (no unfair advantage)');
    await p.evaluate(() => SL_EVENTS.setTestMode(false));
    ok(await p.evaluate(() => SL_EVENTS.advent.kind() === 'local' && SL_EVENTS.advent.state().claimed === 0), 'switching TEST off: the real (local) calendar is untouched');
    await ctx.close();
  }

  console.log('--- all 24 doors: the Legendary Christmas Serpent, once');
  {
    const doors = {}; for (let d = 1; d <= 23; d++) doors[d] = { at: T('2026-12-01T10:00:00Z') + (d - 1) * DAY, via: 'day', run: d };
    const seed = { 'sl-ev-advent:xmas2026:local': JSON.stringify({ doors, earned: 7, earnedUsed: 0, subUsed: 0 }) };
    const { ctx, p } = await open(b, { time: T('2026-12-24T18:00:00Z'), seed });
    await p.evaluate(() => SL_EVENTS.advent.open()); await p.waitForSelector('#sl-ev-adv .sl-ev-door.is-open');
    await p.click('#sl-ev-adv .sl-ev-door[data-day="24"]');
    await p.waitForSelector('.sl-ev-reveal'); await p.click('.sl-ev-reveal [data-close]');
    await p.waitForSelector('.sl-ev-legend');
    ok(/Legendary Christmas Serpent/.test(await p.textContent('.sl-ev-legend')), 'grand prize unlock animation after door 24');
    await p.clock.runFor(1500); await p.waitForTimeout(2000); await shot(p, 'grand-prize');
    await p.click('.sl-ev-legend [data-close]');
    ok(await p.evaluate(() => SL_EVENTS.advent.inventory().filter((x) => x.grand)[0].owned), 'the serpent is in the collection');
    await p.evaluate(() => SL_EVENTS.seasonal.evaluate());
    const e = await p.evaluate(() => SL_EVENTS.seasonal.earned());
    ok(e['x-legend'] && e['x-perfect'], 'Legendary Serpent + Perfect Christmas achievements');
    await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.SL_EVENTS && SL_EVENTS.time.trusted());
    await p.evaluate(() => SL_EVENTS.advent.open()); await p.waitForSelector('#sl-ev-adv .sl-ev-door');
    await p.click('#sl-ev-adv .sl-ev-door[data-day="24"]'); await p.waitForSelector('.sl-ev-reveal'); await p.click('.sl-ev-reveal [data-close]');
    ok(await p.$('.sl-ev-legend') === null, 'the grand prize animation is not shown a second time');
    ok((await claim(p, 24, 'day')).reason === 'already-claimed', 'door 24 still can\'t be claimed twice');
    await p.evaluate(() => SL_EVENTS.advent.openInventory()); await p.waitForSelector('#sl-ev-inv');
    ok(/Premium decorations/.test(await p.textContent('#sl-ev-inv')) && /Subscribers/.test(await p.textContent('#sl-ev-inv')), 'collection: premium section labelled and locked');
    await shot(p, 'collection');
    await ctx.close();
  }

  console.log('--- cursor customization (computer with a mouse)');
  {
    const { ctx, p, errs } = await open(b, { time: T('2026-12-05T10:00:00Z') });
    ok(await p.evaluate(() => SL_EVENTS.cursor.supported()), 'fine pointer detected');
    await p.evaluate(() => SL_EVENTS.cursor.open()); await p.waitForSelector('#sl-ev-cur');
    ok(/subscriber benefit/i.test(await p.textContent('#sl-ev-cur')), 'without a subscription it is labelled a subscriber benefit');
    await p.click('#sl-ev-cur [data-effect="sparkle"]');
    ok(await p.evaluate(() => !document.querySelector('canvas.sl-ev-curfx') && !document.documentElement.classList.contains('sl-ev-cur')), 'not applied to the page without a subscription');
    const box = await p.$('#sl-ev-cur [data-prev]'); const bb = await box.boundingBox();
    for (let i = 0; i < 12; i++) await p.mouse.move(bb.x + 20 + i * 15, bb.y + 40 + (i % 3) * 10);
    await shot(p, 'cursor-preview');
    await p.evaluate(() => SL_EVENTS.setTestMode(true));
    await p.click('#sl-ev-cur [data-colour="gold"]'); await p.click('#sl-ev-cur [data-effect="trail"]');
    ok(await p.evaluate(() => document.documentElement.classList.contains('sl-ev-cur') && !!document.querySelector('canvas.sl-ev-curfx')), 'subscriber (TEST): coloured pointer + effect canvas on the page');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('canvas.sl-ev-curfx')).pointerEvents === 'none'), 'the effect canvas never takes clicks');
    await p.keyboard.press('Escape');
    for (let i = 0; i < 10; i++) await p.mouse.move(300 + i * 20, 300 + i * 5);
    ok(await p.evaluate(() => SL_EVENTS.cursor._fx().trail.length > 3), 'snake trail follows the pointer');
    await shot(p, 'cursor-trail');
    // performance: no long tasks while moving the mouse with an effect on
    await p.evaluate(() => { SL_EVENTS.cursor.open(); }); await p.click('#sl-ev-cur [data-effect="sparkle"]'); await p.keyboard.press('Escape');
    await p.waitForTimeout(1500);
    await p.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: 'longtask' }); });
    for (let i = 0; i < 200; i++) await p.mouse.move(200 + (i * 7) % 800, 200 + (i * 13) % 500);
    await p.waitForTimeout(500);
    const lt = await p.evaluate(() => window.__lt);
    ok(lt.length === 0, 'no long tasks during 200 pointer moves with Sparkling Particles (' + JSON.stringify(lt) + ')');
    ok(await p.evaluate(() => SL_EVENTS.cursor._fx().parts.length <= 80), 'particle count stays capped');
    await p.evaluate(() => { SL_EVENTS.cursor.open(); }); await p.click('#sl-ev-cur [data-act="reset"]');
    ok(await p.evaluate(() => !document.querySelector('canvas.sl-ev-curfx') && SL_EVENTS.cursor.pref().effect === 'none'), 'Reset brings the normal pointer back');
    await p.evaluate(() => SL_EVENTS.setTestMode(false));
    ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('--- reduced motion');
  {
    const { ctx, p } = await open(b, { time: T('2026-12-05T10:00:00Z'), ctx: { reducedMotion: 'reduce' }, seed: { 'sl-ev-test-sub': '1', 'sl-ev-cursor': JSON.stringify({ colour: 'blue', effect: 'trail' }) } });
    await p.waitForSelector('canvas.sl-ev-curfx');
    for (let i = 0; i < 10; i++) await p.mouse.move(300 + i * 20, 300);
    ok(await p.evaluate(() => SL_EVENTS.cursor._fx().trail.length === 0 && SL_EVENTS.cursor._fx().still()), 'moving effects become a still glow');
    ok(await p.evaluate(() => getComputedStyle(document.getElementById('sl-ev-banner'), '::after').animationName) === 'none', 'banner shine is switched off');
    await p.evaluate(() => SL_EVENTS.advent.open()); await p.waitForSelector('#sl-ev-adv .sl-ev-door.is-open');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('#sl-ev-adv .sl-ev-door.is-open .leaf')).animationName) === 'none', 'the open door doesn\'t wiggle');
    await ctx.close();
  }

  console.log('--- phone (touch)');
  {
    const { ctx, p, errs } = await open(b, { time: T('2026-12-05T10:00:00Z'), ctx: devices['iPhone 13'], seed: { 'sl-ev-test-sub': '1', 'sl-ev-cursor': JSON.stringify({ colour: 'gold', effect: 'sparkle' }) } });
    ok(await p.evaluate(() => !SL_EVENTS.cursor.supported()), 'touch screen: no fine pointer');
    ok(await p.evaluate(() => !document.querySelector('canvas.sl-ev-curfx') && !document.documentElement.classList.contains('sl-ev-cur')), 'no cursor effect on a phone even for a subscriber');
    await p.waitForSelector('#sl-ev-banner');
    await p.evaluate(() => window.scrollTo(0, document.getElementById('sl-ev-banner').getBoundingClientRect().top + scrollY - 120));
    await p.waitForTimeout(400);
    ok(await noOverflow(p), 'no sideways scrolling with the banner');
    const bw = await p.evaluate(() => { const r = document.getElementById('sl-ev-banner').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; });
    ok(bw, 'banner fits the phone screen');
    await shot(p, 'phone-banner');
    await p.click('#sl-ev-banner'); await p.waitForSelector('#sl-ev-cd .sl-ev-clock'); await shot(p, 'phone-countdown');
    await p.evaluate(() => SL_EVENTS.advent.open()); await p.waitForSelector('#sl-ev-adv .sl-ev-door');
    ok(await p.evaluate(() => { const r = document.querySelector('#sl-ev-adv .sl-achbox').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }), 'Advent Calendar panel fits the phone');
    await shot(p, 'phone-advent');
    await p.evaluate(() => SL_EVENTS.cursor.open()); await p.waitForSelector('#sl-ev-cur');
    ok(/mouse or trackpad/.test(await p.textContent('#sl-ev-cur')), 'cursor settings explain it needs a mouse or trackpad');
    ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('--- desktop layout');
  {
    const { ctx, p } = await open(b, { time: T('2026-12-05T10:00:00Z') });
    await p.waitForSelector('#sl-ev-banner');
    await p.evaluate(() => window.scrollTo(0, document.getElementById('sl-ev-banner').getBoundingClientRect().top + scrollY - 160));
    await p.waitForTimeout(400);
    ok(await noOverflow(p), 'no sideways scrolling on desktop');
    await shot(p, 'desktop-banner');
    await p.click('#sl-ev-banner'); await p.waitForSelector('#sl-ev-cd'); await shot(p, 'desktop-countdown-live');
    const same = await p.evaluate(() => { window.SL_openAch(); const a = document.querySelector('#sl-achdlg .sl-achbox').offsetWidth, e = document.querySelector('#sl-ev-cd .sl-achbox').offsetWidth; return Math.abs(a - e) < 2; });
    ok(same, 'event panels are the same size as the Achievements panel');
    await ctx.close();
  }

  console.log('--- inside the Christmas Cabin (both previews on)');
  {
    const { ctx, p, errs } = await open(b, { time: T('2026-12-05T10:00:00Z'), query: '?christmas&preview=events' });
    await p.waitForSelector('#tab-cabin', { timeout: 30000 });
    await p.evaluate(() => document.getElementById('tab-cabin').click());
    await p.waitForSelector('#xm-cabin .xc-bar .sl-ev-cabin-btn', { timeout: 10000 });
    ok(true, 'an "Advent Calendar" button is added inside the Cabin');
    ok(await p.evaluate(() => !!document.querySelector('#xm-cabin .sl-ev-cabin-btn .sl-ev-dot')), 'it shows a dot while today\'s door is waiting');
    await p.click('#xm-cabin .sl-ev-cabin-btn'); await p.waitForSelector('#sl-ev-adv .sl-ev-door.is-open');
    await p.click('#sl-ev-adv .sl-ev-door[data-day="5"]'); await p.waitForSelector('.sl-ev-reveal'); await p.click('.sl-ev-reveal [data-close]');
    await p.keyboard.press('Escape');
    await p.clock.runFor(1500);
    ok(await p.evaluate(() => document.querySelectorAll('#xm-cabin .xc-stage .sl-ev-shelf svg').length >= 1), 'the reward is displayed on the Cabin mantel');
    ok(await p.evaluate(() => !document.querySelector('#xm-cabin .sl-ev-cabin-btn .sl-ev-dot')), 'the dot goes once today\'s door is open');
    await p.evaluate(() => document.getElementById('xm-cabin').scrollIntoView());
    await shot(p, 'cabin-with-advent');
    ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
})().catch((e) => { console.error(e); process.exit(2); });
