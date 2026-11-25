// Accessibility + performance checks for the main app (snakelist-synced.html -> index.html).
// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT --bind 127.0.0.1), then
//   PORT=<port> node tests/a11y-perf.js [screenshot-dir]
// Checked on a computer and on a phone, a returning visitor with some sightings and a photo of their own, and a first visit:
//   - no button or link drawn inside another one (anywhere on the page, as drawn)
//   - a card's Follow / Want to see / 3D never mark it seen; a logged sighting's button says its date and place; a card
//     with your photo has "See your photos" and "Remove photo" as two buttons side by side
//   - the drawn "+ date & place" / "+ photo" words are not read out on top of the buttons' names
//   - a dialog: the keyboard goes into it, what is behind it is inert while it is open, Escape closes only the top one
//     of two, and the keyboard goes back to the button that opened it
//   - the accessibility tree stays within a budget (only what is on the page, not 4,243 cards), during the opening too
//   - once SnakeList is open and the page is left alone, no single task holds the page up for more than 200 ms
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://127.0.0.1:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const SKIP = ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen'];
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const STATE = {
  done: ['boa-constrictor', 'python-regius', 'natrix-natrix', 'vipera-berus', 'opisthotropis-zhaoermii'],
  wish: ['naja-naja'], follow: ['crotalus-atrox'],
  notes: { 'boa-constrictor': { iso: '2024-05-12', when: '12 May 2024', where: 'Tortuguero, Costa Rica' } },
};
const SEED = { 'sl-web-state': JSON.stringify(STATE), 'sl-sighting-photos:opisthotropis-zhaoermii': JSON.stringify([PNG]), 'sl-consent': 'essential' };
const AX_BUDGET = 3500; // accessible (not ignored) nodes: ~2,100 with 60 cards on show

function watchLong() {
  const M = window.__A11Y = { long: [] };
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => M.long.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
}
// every button / link / button-like element that is drawn, inside another one that is drawn
function nestedDrawn() {
  const I = 'button, a[href], [role=button], [role=link], [role=checkbox], [role=tab], [role=menuitem], summary, input, select, textarea';
  const drawn = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const out = [];
  document.querySelectorAll(I).forEach((e) => {
    const p = e.parentElement && e.parentElement.closest(I);
    if (p && drawn(e) && drawn(p)) out.push(p.tagName.toLowerCase() + '.' + String(p.className).split(' ')[0] + ' > ' + e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]);
  });
  return out;
}
const AE = () => { const a = document.activeElement; return a ? a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + '.' + String(a.className).split(' ')[0] : ''; };

async function axCount(p, cdp) {
  const ax = await cdp.send('Accessibility.getFullAXTree');
  const nodes = ax.nodes.filter((n) => !n.ignored);
  const drawnWords = nodes.filter((n) => n.role && n.role.value === 'StaticText' && /^\+ (date & place|photo)$/.test((n.name && n.name.value) || '')).length;
  return { n: nodes.length, drawnWords };
}

async function returning(b, phone) {
  const label = (phone ? 'phone' : 'computer') + ', returning';
  const ctx = await b.newContext(phone ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  await p.addInitScript(([k, s]) => { k.forEach((x) => localStorage.setItem(x, '1')); if (!localStorage.getItem('sl-test-seeded')) { Object.keys(s).forEach((x) => localStorage.setItem(x, s[x])); localStorage.setItem('sl-test-seeded', '1'); } }, [SKIP, SEED]);
  await p.addInitScript(watchLong);
  const cdp = await ctx.newCDPSession(p);
  await p.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => window.__introDone && document.getElementById('grid'), null, { timeout: 90000 });
  // into SnakeList from the opening photo
  await p.waitForTimeout(1500);
  const go = p.locator('#hero-go-btn, .hero-go-btn').first();
  if (await go.count() && await go.isVisible()) await go.click();
  await p.waitForFunction(() => window.__heroEntered || !document.querySelector('#sl-hero:not([hidden])'), null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(4000);
  // left alone: no task over 200 ms (the page has settled: the opening, the first list and the picks are done)
  const t0 = await p.evaluate(() => performance.now());
  await p.waitForTimeout(6000);
  const long = await p.evaluate((t0) => window.__A11Y.long.filter((x) => x.t >= t0), t0);
  ok(!long.some((x) => x.d > 200), label + ': no task over 200 ms while the open page is left alone ' + JSON.stringify(long));

  // the accessibility tree
  const ax = await axCount(p, cdp);
  ok(ax.n > 200 && ax.n <= AX_BUDGET, label + ': accessibility tree within budget (' + ax.n + ' <= ' + AX_BUDGET + ')');
  ok(ax.drawnWords === 0, label + ': "+ date & place" / "+ photo" drawn words are not read out (' + ax.drawnWords + ')');
  ok((await p.evaluate(nestedDrawn)).length === 0, label + ': no button or link drawn inside another one ' + JSON.stringify((await p.evaluate(nestedDrawn)).slice(0, 5)));

  const search = async (q) => { await p.evaluate((q) => { window.scrollTo(0, 0); const s = document.getElementById('search'); s.value = q; s.dispatchEvent(new Event('input', { bubbles: true })); }, q); await p.waitForTimeout(700); };
  const card = (id) => p.locator('#grid .card[data-id="' + id + '"]');
  // a logged sighting reads its date and place
  await search('Boa constrictor');
  const nl = await card('boa-constrictor').evaluate((c) => c.querySelector('.note-btn').getAttribute('aria-label'));
  ok(/12 May 2024/.test(nl) && /Tortuguero/.test(nl), label + ': the sighting button says what was logged ("' + nl + '")');
  // your own photo: two buttons side by side, not one inside the other
  await search('Zhao');
  const ph = await card('opisthotropis-zhaoermii').evaluate((c) => { const w = c.querySelector('.photo-btn'), o = w.querySelector('.photo-btn-open'), x = w.querySelector('.photo-btn-clear');
    return { has: w.classList.contains('has-photo'), role: w.getAttribute('role'), tab: w.getAttribute('tabindex'), open: !!o && o.tagName, openName: o && o.getAttribute('aria-label'), clearDrawn: !!(x && x.getClientRects().length), nested: !!(o && o.closest('button') !== o) }; });
  ok(ph.has && !ph.role && !ph.tab && ph.open === 'BUTTON' && ph.openName === 'See your photos' && ph.clearDrawn && !ph.nested, label + ': a card with your photo: "See your photos" and "Remove photo" side by side ' + JSON.stringify(ph));
  ok((await p.evaluate(nestedDrawn)).length === 0, label + ': still no button inside a button with a photo on show');
  if (SHOTS) await card('opisthotropis-zhaoermii').screenshot({ path: SHOTS + '/' + label.replace(/\W+/g, '-') + '-photo-card.png' });
  // the photo opens your photos, and Escape takes the keyboard back to it
  await card('opisthotropis-zhaoermii').locator('.photo-btn-open').focus();
  await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  const phL = await p.evaluate(() => window.SL_LAYERS());
  ok(phL.length === 1, label + ': Enter on the photo opens your photos once (' + JSON.stringify(phL) + ')');
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  ok((await p.evaluate(() => window.SL_LAYERS())).length === 0, label + ': Escape closes your photos');
  await search('');

  // a card's own buttons never mark it seen (or open its page)
  const id = await p.evaluate(() => [...document.querySelectorAll('#grid .card')].find((c) => c.offsetParent && !c.classList.contains('done') && !c.classList.contains('wish') && !c.classList.contains('follow') && c.querySelector('.td-card-btn')).dataset.id);
  const url0 = p.url();
  for (const sel of ['.follow-btn', '.wish-btn']) { await card(id).locator(sel).click(); await p.waitForTimeout(600); }
  if (p.url() !== url0) { ok(false, label + ': a card button left the page (' + p.url() + ')'); await ctx.close(); return; }
  const cs = await card(id).evaluate((c) => ({ done: c.classList.contains('done'), wish: c.classList.contains('wish'), follow: c.classList.contains('follow') }));
  ok(!cs.done && cs.wish && cs.follow && p.url() === url0, label + ': Follow and Want to see work and never mark the card seen ' + JSON.stringify(cs));
  for (const sel of ['.follow-btn', '.wish-btn']) { await card(id).locator(sel).click(); await p.waitForTimeout(500); } // (undone again)

  // the 3D viewer from a card, by keyboard: in, inert behind, out, back to the button
  await card(id).locator('.td-card-btn').focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(1800);
  // (page.evaluate, not a locator: the viewer starting up can hold the page for a long while on a busy machine)
  const in3 = await p.evaluate((id) => { const L = document.querySelector('.sl3d-bd'); return { open: !!L, focusIn: !!(L && L.contains(document.activeElement)), bodyInert: !!document.querySelector('.sl-body').closest('[inert]'), seen: document.querySelector('#grid .card[data-id="' + id + '"]').classList.contains('done') }; }, id);
  ok(in3.open && in3.focusIn && in3.bodyInert, label + ': 3D: the keyboard goes into it and SnakeList behind it is inert ' + JSON.stringify(in3));
  ok(!in3.seen, label + ': 3D did not mark the card seen');
  await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  const out3 = await p.evaluate(() => ({ layers: window.SL_LAYERS(), inert: document.querySelectorAll('[inert]').length, ae: document.activeElement && document.activeElement.classList.contains('td-card-btn') }));
  ok(out3.layers.length === 0 && out3.inert === 0 && out3.ae, label + ': Escape closes 3D, nothing is left inert and the keyboard is back on the 3D button ' + JSON.stringify(out3));

  // Settings: focus in, Escape, focus back
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator('#set-btn').focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(1000);
  const inS = await p.evaluate(() => { const s = document.getElementById('sl-settings'); return { open: !s.hidden, focusIn: s.contains(document.activeElement), bodyInert: !!document.querySelector('.sl-body').closest('[inert]') }; });
  ok(inS.open && inS.focusIn && inS.bodyInert, label + ': Settings: the keyboard goes into it, SnakeList behind is inert ' + JSON.stringify(inS));
  await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  const outS = await p.evaluate((f) => ({ layers: window.SL_LAYERS(), ae: eval(f)(), inert: document.querySelectorAll('[inert]').length }), AE.toString());
  ok(outS.layers.length === 0 && outS.ae === 'button#set-btn.theme-btn' && outS.inert === 0, label + ': Escape closes Settings and the keyboard is back on its button ' + JSON.stringify(outS));
  // two layers at once (Settings and a seen card's sighting sheet - each has its own Escape): Escape closes only the top one
  await p.locator('#set-btn').click(); await p.waitForTimeout(900);
  await p.evaluate(() => { const b = document.querySelector('#grid .card.done .note-btn'); b.click(); });
  await p.waitForTimeout(900);
  const two = await p.evaluate(() => window.SL_LAYERS());
  ok(two.length === 2, label + ': two layers open ' + JSON.stringify(two));
  await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  const one = await p.evaluate(() => window.SL_LAYERS());
  ok(one.length === 1 && one[0] === two[0], label + ': Escape closes only the top layer (' + two[1] + '), ' + two[0] + ' stays ' + JSON.stringify(one));
  await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  const none = await p.evaluate((f) => ({ layers: window.SL_LAYERS(), inert: document.querySelectorAll('[inert]').length, ae: eval(f)() }), AE.toString());
  ok(none.layers.length === 0 && none.inert === 0 && none.ae === 'button#set-btn.theme-btn', label + ': the next Escape closes the other one, nothing left inert, the keyboard back on Settings ' + JSON.stringify(none));

  // Following, with Wikipedia and iNaturalist out of reach (every outside request fails here): each followed snake says so,
  // with Retry - no "Loading facts..." left spinning for ever
  await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('tab-follow').click(); });
  await p.waitForFunction(() => { const f = document.querySelector('.fp .fp-facts'); return f && !/^Loading/.test(f.textContent.trim()); }, null, { timeout: 30000 }).catch(() => {});
  const fp = await p.evaluate(() => { const a = document.querySelector('.fp'); if (!a) return null; return { facts: a.querySelector('.fp-facts').textContent.trim(), retry: a.querySelectorAll('.fp-retry').length, loading: !!a.querySelector('.sl-loading') }; });
  ok(fp && !/^Loading/.test(fp.facts) && !/Very little has been written/.test(fp.facts) && fp.retry >= 1, label + ': Following: facts that could not load say so, with Retry ' + JSON.stringify(fp));

  ok(errs.length === 0, label + ': no page errors ' + JSON.stringify(errs.slice(0, 3)));
  await ctx.close();
}

async function firstVisit(b, phone) {
  const label = (phone ? 'phone' : 'computer') + ', first visit';
  const ctx = await b.newContext(phone ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  const cdp = await ctx.newCDPSession(p);
  await p.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForTimeout(1500);
  const during = await axCount(p, cdp);
  ok(during.n <= 400, label + ': during the opening only the opening is in the accessibility tree (' + during.n + ' nodes)');
  await p.waitForFunction(() => window.__introDone, null, { timeout: 90000 });
  await p.waitForTimeout(3000);
  const after = await axCount(p, cdp);
  ok(after.n <= AX_BUDGET, label + ': accessibility tree within budget after the opening (' + after.n + ')');
  ok((await p.evaluate(nestedDrawn)).length === 0, label + ': no button or link drawn inside another one');
  ok(errs.length === 0, label + ': no page errors ' + JSON.stringify(errs.slice(0, 3)));
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const phone of [false, true]) { await returning(b, phone); await firstVisit(b, phone); }
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
})();
