// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT --bind 127.0.0.1), then
//   PORT=<port> node tests/settings-share-idea.js [screenshot-dir]
// v6.11:
//  * Settings - the gear at the top replaces the light/dark and translate buttons. Its panel is the size of the
//    Achievements panel; every setting works at once and is remembered (localStorage): light/dark, "Open SnakeList in",
//    brightness for light and for dark, text size (with Default), full screen, language (the translate menu opens over the
//    panel), location sharing (needs an account), "Account to open with" (greyed out unless 2+ accounts), reduce motion,
//    sounds, What's new pop-ups, restart tutorial, reset.
//  * Share - the share button at the top opens a share sheet (link, Copy link, WhatsApp/Telegram/X/Facebook/Email, the
//    phone's own Share when there is one); "Share my sightings" makes a picture + text of your sightings.
//  * The "Have an idea? Send it to the developer." tip - after a few minutes of use (SL_IDEA_AFTER shortens it here), next to
//    Report, nothing dimmed, an x closes it for good; never over another pop-up.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://127.0.0.1:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };

async function open(b, o = {}) {
  const ctx = o.ctx || await b.newContext(o.phone ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 860 } });
  try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE.replace(/\/$/, '') }); } catch (e) {}
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.errs = errs;
  await p.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  if (!o.ctx) await p.addInitScript((idea) => {
    ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-level-seen', 'sl-news-off'].forEach((k) => { if (localStorage.getItem(k) == null) localStorage.setItem(k, '1'); });
    if (localStorage.getItem('sl-consent') == null) localStorage.setItem('sl-consent', 'yes');
    if (idea) window.SL_IDEA_AFTER = idea;
  }, o.idea || 0);
  if (o.init) await p.addInitScript(o.init);
  await p.goto(BASE, { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction(() => window.__introDone, null, { timeout: 90000 });
  await p.waitForTimeout(800);
  await p.click('#hero-cue').catch(() => {});
  await p.waitForFunction(() => window.__heroEntered || !document.querySelector('#sl-hero:not([hidden])'), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(700);
  return p;
}
const vis = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && !e.closest('[hidden]'); }, sel);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  // ---------------- Settings ----------------
  let p = await open(b);
  ok(await vis(p, '#set-btn') && !(await vis(p, '#theme-btn')) && !(await vis(p, '#lang-btn')), 'the gear is at the top; the light/dark and translate buttons are not (they are in Settings)');
  // the Achievements panel's size, to compare
  await p.click('#sl-ach-btn'); await p.waitForTimeout(400);
  const achW = await p.evaluate(() => document.querySelector('#sl-achdlg .sl-achbox').getBoundingClientRect().width);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('#set-btn'); await p.waitForTimeout(400);
  ok(await vis(p, '#sl-settings .sl-achbox'), 'the gear opens Settings');
  const setW = await p.evaluate(() => document.querySelector('#sl-settings .sl-achbox').getBoundingClientRect().width);
  ok(Math.abs(setW - achW) < 2, 'Settings is the same width as Achievements (' + Math.round(setW) + ' / ' + Math.round(achW) + ' px)');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/test-settings.png' });
  await p.click('#ss-theme [data-v="dark"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.documentElement.getAttribute('data-sl-theme') === 'dark' && localStorage.getItem('snakelist.theme') === 'dark'), 'Dark: SnakeList turns dark at once and remembers it');
  await p.evaluate(() => { const r = document.getElementById('ss-bd'); r.value = '70'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  ok(await p.evaluate(() => localStorage.getItem('sl-bright-dark') === '70' && Math.abs(parseFloat(getComputedStyle(document.documentElement, '::after').opacity) - 0.3) < 0.01), 'brightness in dark mode 70%: the screen dims by 30% at once');
  await p.click('#ss-theme [data-v="light"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => parseFloat(getComputedStyle(document.documentElement, '::after').opacity) === 0), 'light mode keeps its own brightness (100%)');
  await p.click('#ss-text [data-v="115"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.documentElement.classList.contains('sl-ts') && Math.abs(parseFloat(getComputedStyle(document.querySelector('#grid .card .card-name')).zoom) - 1.15) < 0.01), 'text size Large: the words grow at once');
  await p.click('#ss-text [data-v="100"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => !document.documentElement.classList.contains('sl-ts') && !localStorage.getItem('sl-text-size')), 'Default puts the text size back');
  await p.click('#ss-open [data-v="dark"]'); await p.click('#ss-calm'); await p.click('#ss-news'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => localStorage.getItem('sl-open-theme') === 'dark' && document.documentElement.classList.contains('sl-calm') && localStorage.getItem('sl-news-off') === '0'), 'Open in Dark, reduce motion and What\'s new pop-ups are remembered');
  ok(await p.evaluate(() => document.getElementById('ss-acct').disabled && document.getElementById('ss-acct').closest('.sl-srow').classList.contains('is-off')), 'Account to open with is greyed out with only one account');
  ok(await p.evaluate(() => document.getElementById('ss-loc').disabled), 'Share my location needs an account (signed out: off)');
  // the language menu opens over the panel
  await p.click('#ss-lang'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => { const m = document.querySelector('.lang-menu'); if (!m || m.hidden) return false; const r = m.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return m.contains(top); }), 'Language opens the language list on top of Settings');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(!(await vis(p, '#sl-settings .sl-achbox')), 'Escape closes Settings');
  ok(!p.errs.length, 'Settings: no page errors' + (p.errs.length ? ': ' + p.errs.join(' | ') : ''));
  // remembered next time: opens in dark (Open in: Dark), calm on
  const ctx = p.context(); await p.close();
  p = await open(b, { ctx });
  ok(await p.evaluate(() => document.documentElement.getAttribute('data-sl-theme') === 'dark' && document.documentElement.classList.contains('sl-calm')), 'next visit: opens in dark and with reduce motion, as chosen');
  await ctx.close();
  // two accounts on this device: the choice can be made
  p = await open(b, { init: () => { localStorage.setItem('sl-accounts', JSON.stringify([{ id: 'a1', name: 'One' }, { id: 'a2', name: 'Two' }])); localStorage.setItem('sl-acct-cur', 'a1'); } });
  await p.click('#set-btn'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.getElementById('ss-acct').disabled && document.querySelectorAll('#ss-acct option').length === 2), 'with two accounts, Account to open with can be chosen');
  await p.context().close();
  // phone + dark screenshots
  p = await open(b, { phone: true, init: () => localStorage.setItem('snakelist.theme', 'dark') });
  await p.click('#set-btn'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => { const r = document.querySelector('#sl-settings .sl-achbox').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; }), 'phone: Settings fits the screen');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/test-settings-phone-dark.png' });
  await p.context().close();

  // ---------------- Share ----------------
  p = await open(b);
  await p.click('#share-btn'); await p.waitForTimeout(300);
  ok(await vis(p, '#sl-share .sl-achbox') && await p.evaluate(() => document.querySelector('#sl-share .sl-shr-link input').value === 'https://snakelist.com/'), 'the share button opens a share sheet with the SnakeList link');
  ok(await p.evaluate(() => ['whatsapp', 'telegram', 'x', 'facebook', 'email'].every((k) => { const a = document.querySelector('#sl-share [data-t="' + k + '"]'); return a && /snakelist\.com/.test(decodeURIComponent(a.href)); })), 'share to WhatsApp, Telegram, X, Facebook and email, each with the link');
  await p.click('#sl-share [data-a="copy"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => /copied|Couldn't copy/.test(document.querySelector('#sl-share .sl-shr-msg').textContent)), 'Copy link answers (' + await p.evaluate(() => document.querySelector('#sl-share .sl-shr-msg').textContent) + ')');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/test-share.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // share my sightings: two snakes marked seen
  await p.evaluate(() => { [...document.querySelectorAll('#grid .card')].filter((c) => c.offsetParent).slice(0, 2).forEach((c) => c.querySelector('.seen-btn').click()); });
  await p.waitForTimeout(600);
  const noteOpen = await p.evaluate(() => !!document.querySelector('.note-sheet.open')); if (noteOpen) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  ok(await vis(p, '#sl-share-sightings'), 'Share my sightings is next to Snakes seen and Achievements');
  await p.click('#sl-share-sightings'); await p.waitForTimeout(500);
  const sh = await p.evaluate(() => ({ img: !!document.querySelector('#sl-share .sl-shr-card[src^="data:image/png"]'), sub: document.querySelector('#sl-share .sl-ahead p').textContent, note: (document.querySelector('#sl-share .sl-shr-note') || {}).textContent || '' }));
  ok(sh.img && /\d+ species seen/.test(sh.sub), 'Share my sightings makes a picture of your sightings (' + sh.sub + ')');
  ok(/no public page/.test(sh.note), 'it says plainly that there is no public link to a list (no server for that)');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/test-share-sightings.png' });
  ok(!p.errs.length, 'Share: no page errors' + (p.errs.length ? ': ' + p.errs.join(' | ') : ''));
  await p.context().close();

  // ---------------- "Have an idea?" ----------------
  p = await open(b, { idea: 2500 });
  await p.waitForTimeout(4000);
  ok(await vis(p, '#sl-idea'), 'after a while of use the "Have an idea?" tip shows');
  const g = await p.evaluate(() => { const t = document.getElementById('sl-idea').getBoundingClientRect(), r = document.getElementById('report-btn').getBoundingClientRect(); return { below: t.top > r.bottom - 1 && t.top - r.bottom < 30, ax: parseFloat(getComputedStyle(document.getElementById('sl-idea')).getPropertyValue('--ax')) + t.left, mid: r.left + r.width / 2, text: document.getElementById('sl-idea').textContent }; });
  ok(g.below && Math.abs(g.ax - g.mid) < 2, 'it sits under the Report button with its arrow pointing at it');
  ok(/Have an idea\?\s*Send it to the developer\./.test(g.text), 'it says "Have an idea? Send it to the developer."');
  ok(await p.evaluate(() => document.getElementById('tour-layer').hidden && !document.querySelector('.sl-achdlg:not([hidden])') && !document.documentElement.classList.contains('sl-achdlg-on')), 'nothing else is dimmed or blurred');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/test-idea.png' });
  // never over another pop-up
  await p.click('#set-btn'); await p.waitForTimeout(700);
  ok(!(await vis(p, '#sl-idea')), 'it hides while another panel is open');
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  ok(await vis(p, '#sl-idea'), '...and comes back when it closes');
  await p.click('#sl-idea .sl-idea-x'); await p.waitForTimeout(300);
  ok(!(await p.$('#sl-idea')) && await p.evaluate(() => localStorage.getItem('sl-idea-tip') === '1'), 'the x closes it and it is remembered');
  const ctx2 = p.context(); await p.close();
  p = await open(b, { ctx: ctx2 }); await p.evaluate(() => { window.SL_IDEA_AFTER = 1000; }); await p.waitForTimeout(4000);
  ok(!(await p.$('#sl-idea')), 'once closed it never shows again');
  ok(!p.errs.length, 'idea tip: no page errors' + (p.errs.length ? ': ' + p.errs.join(' | ') : ''));
  await ctx2.close();
  // clicking it opens Report and also counts as done
  p = await open(b, { idea: 1500 }); await p.waitForTimeout(3000);
  await p.click('#sl-idea .sl-idea-go'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => localStorage.getItem('sl-idea-tip') === '1' && !!document.querySelector('.report-sheet.open')), '"Send an idea" opens Report and the tip is done');
  await p.context().close();

  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
