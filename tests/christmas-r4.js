// Christmas round 4 (preview): the Advent skip rule (missed AND chosen future days, no exploits), the Advent
// calendar's door states / "Jump to today" / skips explained once / skippable reveal, the countdown's screen-reader
// text and slim map state, the Cursor section's place in Settings (no nested buttons), the Legendary box as the only
// gold-and-emerald one, the Cabin's layout and log basket, and the New Year 2026-27 preview ("newyear").
// Run: python3 build-site.py && python3 tools/build-christmas.py, then  node tests/christmas-r4.js [screenshot-dir]
// Like tests/events.js it needs no web server: the repo's files are served from disk (page.route) and the "server"
// Date header the app trusts follows the fake clock (page.clock). No real dates or user data are touched.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), HOST = 'http://snakelist.test/';
const SHOTS = process.argv[2] || null;
const L = require(path.join(ROOT, 'events', 'advent-logic.js')), CFG = require(path.join(ROOT, 'events', 'config.js'));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const DAY = 864e5, T0 = Date.parse('2026-12-01T00:00:00Z');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VP = { desktop: { width: 1280, height: 900 }, ipad: { width: 820, height: 1180 }, phone: { width: 390, height: 844 } };

async function open(b, o) {
  o = o || {};
  const ctx = await b.newContext(Object.assign({ viewport: VP.desktop }, o.ctx || {}));
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await ctx.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.origin + '/' !== HOST) return r.abort();
    if (u.searchParams.has('sl-time')) { let t; try { t = await p.evaluate(() => Date.now()); } catch (e) { t = Date.now(); } return r.fulfill({ status: 200, headers: { Date: new Date(t).toUTCString(), 'Cache-Control': 'no-store' }, body: '' }); }
    const f = path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, headers: { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }, body: fs.readFileSync(f) });
  });
  await p.addInitScript((seed) => {
    ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen'].forEach((k) => localStorage.setItem(k, '1')); localStorage.setItem('sl-consent', 'essential');
    if (seed && !sessionStorage.getItem('seeded')) { Object.keys(seed).forEach((k) => localStorage.setItem(k, seed[k])); sessionStorage.setItem('seeded', '1'); }
  }, o.seed || null);
  if (o.time) await p.clock.install({ time: o.time });
  await p.goto(HOST + 'index.html' + (o.query || '?preview=events&christmas'), { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction(() => window.SL_EVENTS && window.SL_EVENTS.cursor && SL_EVENTS.time.trusted(), null, { timeout: 40000 });
  return { ctx, p };
}
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const door = (at, via, extra) => Object.assign({ at, via, run: 1, ahead: 0, bonus: false }, extra || {});

/* ------------------------------------------------------------------ 1. the skip rule (no browser) ---------- */
function logicTests() {
  const E = CFG.events.filter((e) => e.id === 'xmas2026')[0];
  ok(E.advent.skipCanClaimFuture === true, 'config: skips may reserve future days (Eduardo\'s rule)');
  ok(CFG.xmasPublic === false, 'config: xmasPublic stays false');
  const now = T0 + 4 * DAY + 3600e3;                    // 5 December, 01:00 UTC: door 5 is today's
  let s = L.empty();
  ok(L.check(E, s, 9, T0 - DAY, 'skip').ok === false, 'before the calendar starts no door can be reserved');
  ok(L.check(E, s, 5, now, 'skip').reason === 'open-today', 'today\'s door is never a skip target (it is simply claimed)');
  ok(L.check(E, s, 9, now, 'skip').reason === 'no-earned-skips', 'a future day needs a free skip in hand');
  // earn a free skip: doors 1-3 covered in a row (claimed on their days)
  s = L.apply(E, s, 1, T0 + 3600e3, 'day'); s = L.apply(E, s, 2, T0 + DAY + 3600e3, 'day'); s = L.apply(E, s, 3, T0 + 2 * DAY + 3600e3, 'day');
  ok(s.earned === 1 && L.skipsLeft(E, s).earned === 1, '3 doors in a row earn exactly 1 free skip');
  const c9 = L.check(E, s, 9, now, 'skip');
  ok(c9.ok && c9.target === 'reserve', 'a free skip can reserve a chosen future day (door 9)');
  s = L.apply(E, s, 9, now, 'skip');
  ok(L.reserved(E, s, 9, now) && L.stats(E, s, now).doors === 3 && L.stats(E, s, now).covered === 4, 'the reserved door counts as covered, but its reward stays hidden until its day');
  ok(!L.reserved(E, s, 9, T0 + 8 * DAY + 1000), 'on its own day the reserved door\'s reward unlocks (once)');
  let threw = ''; try { L.apply(E, s, 9, now, 'skip'); } catch (e) { threw = e.reason; }
  ok(threw === 'already-claimed', 'the same day can never be claimed twice (reserved door)');
  threw = ''; try { L.apply(E, s, 9, T0 + 8 * DAY + 1000, 'day'); } catch (e) { threw = e.reason; }
  ok(threw === 'already-claimed', '... not even on its own day');
  threw = ''; try { L.apply(E, s, 4, now, 'skip'); } catch (e) { threw = e.reason; }
  ok(threw === 'no-earned-skips', 'the free-skip allowance can\'t be exceeded (missed door 4 with none left)');
  ok(L.check(E, s, 4, now, 'sub', false).reason === 'not-subscriber', 'subscriber skips need a subscription');
  // subscriber skips: at most 10 per event, counted apart from the free ones, on missed or future days
  let t = s; const days = [4, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  days.forEach((d) => { t = L.apply(E, t, d, now, 'sub', true); });
  ok(t.subUsed === 10 && t.earnedUsed === 1, '10 subscriber skips used, kept apart from the free skips');
  ok(L.check(E, t, 19, now, 'sub', true).reason === 'subscriber-skip-cap', 'an 11th subscriber skip is refused');
  // streak + free skips stay sane: never more than one per 3 in a row, whatever the order
  ok(t.earned === L.earnedFor(E, t) && t.earned <= 8, 'free skips earned always equal one per 3 covered in a row (' + t.earned + ')');
  ok(L.stats(E, t).fairDoors === Object.keys(t.doors).filter((d) => t.doors[d].via !== 'sub').length && L.stats(E, t).fairDoors === 4, 'doors covered by subscriber skips never count towards achievements (fair doors: ' + L.stats(E, t).fairDoors + ')');
  ok(L.bestRun(t) === 3, 'the 3-day streak achievement counts real on-day visits only');
  ok(L.check(E, t, 24, Date.parse(E.advent.recoverUntil) + 1, 'skip').reason === 'event-over', 'after the event: nothing more can be claimed or reserved');
}

(async () => {
  logicTests();
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  try {
    /* -------------------------------------------------------------- 2. the Advent calendar --------------- */
    {
      const doors = { 1: door(T0 + 5e6, 'day'), 2: door(T0 + DAY + 5e6, 'day', { run: 2 }), 4: door(T0 + 3 * DAY + 5e6, 'day'), 5: door(T0 + 4 * DAY + 5e6, 'day', { run: 2 }), 7: door(T0 + 6 * DAY + 5e6, 'day'), 12: door(T0 + 6 * DAY + 6e6, 'skip') };
      const { ctx, p } = await open(b, { time: new Date('2026-12-09T10:00:00Z'), seed: { 'sl-ev-advent:xmas2026:local': JSON.stringify({ doors, earned: 1, earnedUsed: 1, subUsed: 0 }) } });
      await p.clock.runFor(1500);
      await p.evaluate(() => SL_EVENTS.advent.open()); await p.waitForSelector('#sl-ev-adv .sl-ev-door');
      const st = await p.evaluate(() => { const q = (d) => document.querySelector('#sl-ev-adv .sl-ev-door[data-day="' + d + '"]');
        return { today: q(9).classList.contains('is-today') && /Today/.test(q(9).textContent) && /Claim/.test(q(9).textContent),
          missed: q(3).classList.contains('is-missed') && /Missed/.test(q(3).textContent) && !!q(3).querySelector('.st svg'),
          locked: q(20).classList.contains('is-locked') && !!q(20).querySelector('.ic svg') && /20/.test(q(20).textContent),
          claimed: q(1).classList.contains('is-claimed') && !!q(1).querySelector('.inside svg'),
          reserved: q(12).classList.contains('is-reserved') && /Reserved/.test(q(12).textContent),
          lockedNum: getComputedStyle(q(20).querySelector('.leaf b')).opacity,
          help: document.querySelectorAll('#sl-ev-adv .sl-ev-howskip').length, helpOpen: document.querySelector('#sl-ev-adv .sl-ev-howskip').open,
          key: document.querySelectorAll('#sl-ev-adv .sl-ev-key li').length, oldRule: !!document.querySelector('#sl-ev-adv .sl-ev-rule') }; });
      ok(st.today, 'today\'s door is highlighted and says "Today" and "Claim"');
      ok(st.missed && st.locked && st.claimed && st.reserved, 'missed / coming / opened / reserved doors each have their own word or icon (not colour alone)');
      ok(+st.lockedNum === 1, 'locked doors keep their number at full strength (legible)');
      ok(st.key === 5, 'the key names the five door states');
      ok(st.help === 1 && st.helpOpen && !st.oldRule, 'skips are explained in one place, unfolded the first time');
      await p.click('#sl-ev-adv [data-act="today"]'); await sleep(300);
      ok(await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-day') === '9'), '"Jump to today" moves the focus to today\'s door');
      // a future door: reserve flow is offered (the rule), and the reserve card hides the reward
      await p.click('#sl-ev-adv .sl-ev-door[data-day="20"]'); await sleep(200);
      ok(/Reserve a future day/.test(await p.textContent('#sl-ev-adv [data-skip]')), 'a future door offers "Reserve a future day" with a skip');
      await p.click('#sl-ev-adv [data-act="noskip"]');
      // today's door: the reveal plays with "Skip animation", the reward for everyone apart from the subscriber bonus
      // (the page clock is paused, so the opening can't end by itself before the test presses Skip)
      await p.clock.pauseAt(await p.evaluate(() => Date.now() + 500));
      await p.click('#sl-ev-adv .sl-ev-door[data-day="9"]'); await p.waitForSelector('.sl-ev-reveal');
      ok(!!(await p.$('.sl-ev-reveal [data-skipanim]')), 'the door opening can be skipped ("Skip animation")');
      await shot(p, 'advent-reveal-opening');
      await p.click('.sl-ev-reveal [data-skipanim]'); await sleep(150);
      ok(await p.evaluate(() => !document.querySelector('.sl-ev-reveal .sl-ev-rv-card.is-opening') && document.activeElement && document.activeElement.hasAttribute('data-close')), 'skipping jumps straight to the reward, focus on its button');
      ok(await p.evaluate(() => /everyone gets this one/.test(document.querySelector('.sl-ev-reveal .sl-ev-rv-who').textContent) && !!document.querySelector('.sl-ev-reveal .sl-ev-rv-bonus')), 'the reward for everyone and the subscriber bonus are shown apart');
      await shot(p, 'advent-reveal');
      await p.click('.sl-ev-reveal [data-close]');
      await p.click('#sl-ev-adv .sl-ev-door[data-day="9"]'); await p.waitForSelector('.sl-ev-reveal');
      ok(!(await p.$('.sl-ev-reveal [data-skipanim]')) && !(await p.$('.sl-ev-reveal .is-opening')), 'opening a door again shows the reward at once (no animation to sit through)');
      await p.click('.sl-ev-reveal [data-close]');
      await p.clock.resume();
      ok(/Cabin's presents under the tree are separate/.test(await p.textContent('#sl-ev-adv')), 'the calendar says the Cabin\'s task presents are separate from the 24 doors');
      await shot(p, 'advent');
      // gold-and-emerald: the Legendary box only
      await p.waitForSelector('#sl-ev-adv .sl-ev-grand'); await p.evaluate(() => window.SL_openAch && SL_openAch()); await sleep(800);
      const borders = await p.evaluate(() => [...document.querySelectorAll('.sl-ev-rbox, .sl-ev-earlynote, .sl-ev-act')].map((e) => [e.className + (e.getAttribute('data-ach') ? ' ' + e.getAttribute('data-ach') : ''), getComputedStyle(e).borderTopColor]));
      const gold = borders.filter((x) => /217, 182, 111|216, 183, 106/.test(x[1])).map((x) => x[0]);
      ok(borders.length >= 5 && gold.length >= 1 && gold.every((c) => /sl-ev-legendary/.test(c)), 'of ' + borders.length + ' Christmas reward boxes only the Legendary ones have the gold border (' + gold.join(' | ') + ')');
      await p.keyboard.press('Escape'); await sleep(200);
      // nested interactive elements: none in the calendar
      ok(await p.evaluate(() => document.querySelectorAll('#sl-ev-adv button button, #sl-ev-adv button a, #sl-ev-adv a button').length === 0), 'no button inside a button in the calendar');
      await p.keyboard.press('Escape');
      // a reload: the skip explanation is folded away now (explained once)
      await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.SL_EVENTS && SL_EVENTS.advent && SL_EVENTS.time.trusted(), null, { timeout: 40000 });
      await p.evaluate(() => SL_EVENTS.advent.open()); await p.waitForSelector('#sl-ev-adv .sl-ev-howskip');
      ok(await p.evaluate(() => !document.querySelector('#sl-ev-adv .sl-ev-howskip').open), 'next time the skip explanation is folded (one tap to read it again)');
      ok(p.errs.length === 0, 'advent: no page errors ' + p.errs.join(' | '));
      await ctx.close();
    }
    /* -------------------------------------------------------------- 3. the countdown --------------------- */
    {
      const { ctx, p } = await open(b, { time: new Date('2026-11-25T15:00:00Z'), ctx: { timezoneId: 'Europe/Lisbon' } });
      await p.clock.runFor(3000);
      const a1 = await p.evaluate(() => { const b = document.getElementById('sl-ev-banner'); return b && { label: b.getAttribute('aria-label'), hidden: b.querySelector('.sl-ev-clock').getAttribute('aria-hidden'), live: b.querySelectorAll('[aria-live]').length, when: b.querySelector('.sl-ev-b-when').textContent }; });
      await p.clock.runFor(7000);
      const l2 = await p.evaluate(() => document.getElementById('sl-ev-banner').getAttribute('aria-label'));
      ok(a1 && a1.hidden === 'true', 'the animated digits are hidden from screen readers');
      ok(a1 && a1.label === l2 && !/second/.test(l2), 'the banner\'s spoken name changes at most once a minute (no seconds): ' + l2);
      ok(a1 && /Dec/.test(a1.when) && /Lisbon time/.test(a1.when), 'the banner shows the date and time zone: ' + (a1 && a1.when));
      await p.evaluate(() => SL_EVENTS.openCountdown()); await p.waitForSelector('#sl-ev-cd [data-sr]');
      const sr1 = await p.textContent('#sl-ev-cd [data-sr]'); await p.clock.runFor(5000); const sr2 = await p.textContent('#sl-ev-cd [data-sr]');
      ok(sr1 === sr2 && /^Public opening in: \d+ days?/.test(sr1) && !/second/.test(sr1) && await p.getAttribute('#sl-ev-cd [data-sr]', 'aria-live') === 'polite', 'the panel has one polite, visually hidden line, updated per minute: ' + sr1);
      ok(await p.evaluate(() => { const c = document.querySelector('#sl-ev-cd .sl-ev-dg'); return getComputedStyle(c.parentNode).fontVariantNumeric.indexOf('tabular-nums') >= 0 && c.getBoundingClientRect().width > 0; }), 'the digits are tabular, each in its own fixed cell');
      ok(await p.evaluate(() => document.querySelectorAll('#sl-ev-cd button button').length === 0), 'no button inside a button in the countdown panel');
      await p.keyboard.press('Escape');
      await p.evaluate(() => document.getElementById('tab-map').click()); await p.clock.runFor(1500); await sleep(300);
      const dn = await p.evaluate(() => { const b = document.getElementById('sl-ev-banner'); return { dense: b.classList.contains('sl-ev-dense'), h: b.offsetHeight }; });
      ok(dn.dense && dn.h <= 50, 'on the map the countdown is one slim line (' + dn.h + 'px)');
      await shot(p, 'countdown-map');
      ok(p.errs.length === 0, 'countdown: no page errors ' + p.errs.join(' | '));
      await ctx.close();
    }
    /* -------------------------------------------------------------- 4. Settings: the Cursor section -------- */
    {
      const { ctx, p } = await open(b, { time: new Date('2026-12-05T10:00:00Z') });
      await p.evaluate(() => SL_OPEN_SETTINGS()); await p.clock.runFor(3500); await sleep(300);
      const r = await p.evaluate(() => { const sec = document.querySelector('#sl-settings .sl-ev-cur-sec');
        return { n: document.querySelectorAll('#sl-settings .sl-ev-cur-sec').length, inDisplay: !!(sec && sec.closest('[data-sl-settings-body]')), inButton: !!(sec && sec.closest('button, a')),
          nested: document.querySelectorAll(['#sl-settings', '#xm-cabin', '#sl-ev-banner', '.sl-ev-panel', '.sl-ny-card'].map((s) => ['button button', 'button a', 'a button', 'button input', 'button select', '[role=button] button'].map((n) => s + ' ' + n).join(', ')).join(', ')).length }; });
      ok(r.n === 1 && r.inDisplay && !r.inButton, 'Cursor customization sits once, in Settings > Display, inside no button');
      ok(r.nested === 0, 'no interactive element nested in a button in Settings or the Christmas parts');
      ok(p.errs.length === 0, 'settings: no page errors ' + p.errs.join(' | '));
      await ctx.close();
    }
    /* -------------------------------------------------------------- 5. the Cabin ------------------------- */
    for (const vp of ['desktop', 'ipad', 'phone']) {
      const seed = { 'sl-xmas-cabin-state': JSON.stringify({ logs: 2, species: [], done: {}, opened: {}, unlocked: {}, deco: {}, opt: {} }) };
      const { ctx, p } = await open(b, { time: new Date('2026-12-05T10:00:00Z'), seed, ctx: { viewport: VP[vp], isMobile: vp === 'phone', hasTouch: vp !== 'desktop' } });
      // past the opening photo first (while it shows, the page under it can't take the focus)
      await p.evaluate(() => { const h = document.getElementById('sl-hero'); if (h && !h.hidden) window.scrollBy(0, 400); }); await p.clock.runFor(1500);
      await p.evaluate(() => XM.cabin.open(false)); await p.clock.runFor(1500); await sleep(300);
      await p.evaluate(() => { document.querySelector('#xm-cabin .xc-head').scrollIntoView({ block: 'start' }); });
      const m = await p.evaluate(() => { const room = document.querySelector('#xm-cabin .xc-room').getBoundingClientRect(), st = document.querySelector('#xm-cabin .xc-stage').getBoundingClientRect();
        return { room: room.height, stageH: st.height, vh: innerHeight, over: document.documentElement.scrollWidth > innerWidth + 1, groups: [...document.querySelectorAll('#xm-cabin .xc-gh')].map((g) => g.textContent.replace(/\s+remembered.*/, '')),
          labels: [...document.querySelectorAll('#xm-cabin .xm-au-row label span')].map((s) => s.textContent), logs: document.querySelector('#xm-cabin .xc-logs').textContent.trim(),
          hot: [...document.querySelectorAll('#xm-cabin .xc-hot')].filter((h) => h.getAttribute('role') === 'button' && h.getAttribute('tabindex') === '0').length }; });
      ok(!m.over, vp + ': the Cabin causes no sideways scrolling');
      if (vp === 'desktop') ok(m.room <= m.vh - 120, 'desktop: the scene and every control fit on one screen (' + Math.round(m.room) + 'px of ' + m.vh + ')');
      ok(m.groups.join('|') === 'In your Cabin|Fireplace|The room|Sound', vp + ': the controls are in labelled groups (' + m.groups.join(', ') + ')');
      ok(m.labels.join('|') === 'Christmas music|Fireplace', vp + ': the two volume sliders are labelled');
      ok(/^2 logs in the basket/.test(m.logs), vp + ': the log count is said in words (' + m.logs + ')');
      ok(m.hot === 3, vp + ': the tree, the fire and the log basket can be focused and pressed');
      if (vp === 'desktop') {
        for (const want of ['1 log', '0 logs']) { await p.focus('#xm-cabin .xc-hot-fire'); await p.keyboard.press('Enter'); await p.waitForFunction((w) => document.querySelector('#xm-cabin .xc-logs').textContent.trim().indexOf(w) === 0, want, { timeout: 5000 }).catch(() => {}); }
        const lt = await p.textContent('#xm-cabin .xc-logs');
        ok(/^0 logs/.test(lt), 'the fire takes a log with Enter (keyboard): ' + lt);
        await p.focus('#xm-cabin .xc-hot-fire'); await p.keyboard.press('Enter'); await sleep(200);
        ok(await p.evaluate(() => /basket is empty/.test(document.querySelector('#xm-cabin .xc-loghint').textContent) && document.querySelector('#xm-cabin .xc-loghint').classList.contains('xc-flash')), 'with no logs, a friendly line says how to get more (and lights up)');
        await p.evaluate(() => XM.audio.setVolume('music', .3));
        ok(await p.evaluate(() => JSON.parse(localStorage.getItem('sl-xmas-audio') || '{}').mv === .3), 'a volume change is remembered in this browser (sl-xmas-audio)');
      }
      await shot(p, vp + '-cabin');
      ok(p.errs.length === 0, vp + ' cabin: no page errors ' + p.errs.join(' | '));
      await ctx.close();
    }
    /* -------------------------------------------------------------- 6. New Year 2026-27 ------------------- */
    {
      // without the preview: nothing of it
      let { ctx, p } = await open(b, { time: new Date('2026-12-31T20:00:00Z') });
      await p.clock.runFor(1500);
      ok(await p.evaluate(() => !document.documentElement.classList.contains('sl-ny') && !document.querySelector('.sl-ny-card')), 'without the "newyear" preview nothing of the New Year theme shows');
      ok(await p.evaluate(() => !!(window.SL_PREVIEWS && SL_PREVIEWS.list && SL_PREVIEWS.list().some((x) => x.key === 'newyear'))), 'the "newyear" preview is in the previews list');
      await ctx.close();
      const doors = {}; for (let d = 1; d <= 6; d++) doors[d] = door(T0 + (d - 1) * DAY + 5e6, 'day', { run: d });
      const seed = { 'sl-ev-advent:xmas2026:local': JSON.stringify({ doors, earned: 2, earnedUsed: 0, subUsed: 0 }), 'sl-art-preview-newyear': '1' };
      ({ ctx, p } = await open(b, { time: new Date('2027-01-01T04:59:20Z'), seed, ctx: { timezoneId: 'America/New_York' } }));
      await p.waitForFunction(() => SL_EVENTS.newYear && document.querySelector('.sl-ny-card'), null, { timeout: 20000 });
      const ny = await p.evaluate(() => ({ cls: document.documentElement.classList.contains('sl-ny'), top: document.querySelector('.sl-ny-top').textContent, mid: new Date(SL_EVENTS.newYear.midnight()).toISOString(), sr: document.querySelector('.sl-ny-card [data-sr]').textContent, tz: document.querySelector('.sl-ny-card em').textContent }));
      ok(ny.cls && /HAPPY NEW YEAR 2026–2027!/.test(ny.top) && /HAPPY NEW YEAR!/.test(ny.top), 'New Year theme on: "HAPPY NEW YEAR 2026–2027!" above the logo, the party-hat snakes say "HAPPY NEW YEAR!"');
      ok(ny.mid === '2027-01-01T05:00:00.000Z' && /New York time/.test(ny.tz), 'the countdown is to midnight in the viewer\'s own time zone (' + ny.tz + ')');
      ok(/Time until New Year: 1 minute/.test(ny.sr), 'its screen-reader line: ' + ny.sr);
      await shot(p, 'newyear-countdown');
      const dt = await p.evaluate(() => SL_EVENTS.newYear.midnight() - SL_EVENTS.time.display());
      await p.clock.runFor(Math.max(0, Math.round(dt)) + 1200); await sleep(200);
      ok(!!(await p.$('.sl-ny-cel')), 'at midnight, with the page open, the celebration plays');
      await shot(p, 'newyear-midnight');
      await p.click('.sl-ny-cel [data-x]'); await sleep(400);
      ok(!(await p.$('.sl-ny-cel')), 'the midnight celebration can be skipped');
      ok(await p.evaluate(() => /Welcome to 2027/.test(document.querySelector('.sl-ny-card').textContent) && /6 Advent doors/.test(document.querySelector('.sl-ny-card').textContent) && SL_EVENTS.advent.stats().covered === 6), 'after midnight: the Christmas rewards are kept (6 doors)');
      ok(await p.evaluate(() => localStorage.getItem('sl-ny-midnight-seen:2027') === '1'), 'the automatic celebration is shown once per browser');
      ok(p.errs.length === 0, 'new year: no page errors ' + p.errs.join(' | '));
      await ctx.close();
    }
  } finally { await b.close(); }
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
