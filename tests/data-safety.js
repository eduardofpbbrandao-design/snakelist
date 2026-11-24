// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT), then
//   PORT=<port> node tests/data-safety.js [screenshot-dir]
// Data safety: nobody's saved list may ever be lost or changed by SnakeList itself. The browser is
// seeded with a realistic saved list (Seen, Want to see, Following, sightings with several
// encounters, the person's own photos, favourites, quiz scores, achievement dates). The app is
// opened, used (search, filters, Mark Seen / unseen, a new sighting's date and place, Want to see,
// Follow, Show more, a card's 3D, a quiz question, Achievements), then reloaded: every saved value
// must still be there (plus exactly the changes made) and the app must show it (Snakes seen, the
// cards' Seen / sighting / photo state, the My Sightings count, the Achievements).
// Checked on desktop (1280 x 900) and on a phone (iPhone 13). With "light cards" it also
// checks that the cards that are not on screen were made light and nothing woke them all up again.
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://localhost:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const PNG1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PNG2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const STATE = {
  done: ['boa-constrictor', 'python-regius', 'natrix-natrix', 'vipera-berus', 'opisthotropis-zhaoermii'],
  wish: ['naja-naja', 'boa-constrictor', 'morelia-viridis'],
  follow: ['crotalus-atrox', 'python-regius'],
  notes: {
    'boa-constrictor': { iso: '2024-05-12', when: '12 May 2024', where: 'Tortuguero, Costa Rica' },
    'python-regius': { iso: '2023-08', when: 'Aug 2023', where: 'Accra, Ghana', more: JSON.stringify([{ iso: '2022-01-03', where: 'Kumasi, Ghana' }, { iso: '2021', where: '≈ Lomé, Togo' }]), n: '3' },
    'natrix-natrix': { where: 'Sintra, Portugal' },
    'opisthotropis-zhaoermii': { iso: '2020-02-29', when: '29 Feb 2020', where: 'Guangxi, China' },
  },
};
const SEED = {
  'sl-web-state': JSON.stringify(STATE),
  'sl-sighting-photos:boa-constrictor': JSON.stringify([PNG1, PNG2]),
  'sl-sighting-photos:opisthotropis-zhaoermii': JSON.stringify([PNG2]),
  'sl-favs': JSON.stringify(['naja-naja']),
  'sl-quiz-correct': '7', 'sl-quiz-wrong': '3',
  'sl-ach-dates': JSON.stringify({ sp1: '2024-05-12', sp5: '2024-06-01', rec1: '' }),
};
// the same list whatever order the cards happen to be in
const norm = (s) => { const o = JSON.parse(s || '{}'); ['done', 'wish', 'follow'].forEach((k) => { o[k] = (o[k] || []).slice().sort(); }); const n = {}; Object.keys(o.notes || {}).sort().forEach((k) => { n[k] = o.notes[k]; }); o.notes = n; return o; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function run(b, label, ctxOpts) {
  console.log('--- ' + label);
  const ctx = await b.newContext(ctxOpts);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.dismiss());
  // the Christmas preview is a switch: a normal visit must not fetch anything from christmas/. From events/ it may fetch
  // ONLY the public countdown's own files (config.js, core.js, art.js, countdown.js, events.css, its two fonts) - never
  // the Advent Calendar, achievements, subscription or cursor code
  const PUB_OK = /^\/events\/(config\.js|core\.js|art\.js|countdown\.js|events\.css|fonts\/outfit-latin-(500|800)\.woff2)$/;
  const previewFetches = [], countdownFetches = [];
  p.on('request', (r) => { const u = new URL(r.url()); if (/^\/christmas\//.test(u.pathname) || (/^\/events\//.test(u.pathname) && !PUB_OK.test(u.pathname))) previewFetches.push(u.pathname); else if (/^\/events\//.test(u.pathname)) countdownFetches.push(u.pathname); });
  await p.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await p.addInitScript((seed) => {
    localStorage.setItem('sl-consent', 'essential'); localStorage.setItem('sl-tour-seen', '1'); localStorage.setItem('sl-news-off', '1');
    if (!localStorage.getItem('sl-test-seeded')) { Object.keys(seed).forEach((k) => localStorage.setItem(k, seed[k])); localStorage.setItem('sl-test-seeded', '1'); }
  }, SEED);
  const ready = async () => {
    await p.waitForFunction(() => window.__introDone && document.getElementById('grid'), null, { timeout: 90000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => { const i = document.getElementById('intro'); if (i) i.remove(); });
  };
  const ls = (k) => p.evaluate((k) => localStorage.getItem(k), k);
  const card = (id) => p.locator('#grid .card[data-id="' + id + '"]');
  const search = async (q) => {
    await p.evaluate((q) => { window.scrollTo(0, 0); const s = document.getElementById('search'); s.value = q; s.dispatchEvent(new Event('input', { bubbles: true })); }, q);
    await p.waitForTimeout(500);
  };
  const shown = (id) => p.evaluate((id) => { const c = document.querySelector('#grid .card[data-id="' + id + '"]'); return !!(c && c.offsetParent && getComputedStyle(c).display !== 'none'); }, id);
  const tap = async (id, sel) => { const l = card(id).locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.click(); };

  await p.goto(BASE + 'index.html', { waitUntil: 'load', timeout: 180000 });
  await ready();
  // give the light-card tidy-up (if any) time to run, then check nothing was lost by it
  await p.waitForTimeout(6000);
  const st0 = await p.evaluate(() => window.SL_LIGHT ? window.SL_LIGHT.stats() : null);
  if (st0) {
    console.log('light cards after opening:', JSON.stringify(st0));
    ok(st0.light > 3000, label + ': most cards are light once SnakeList has opened (' + st0.light + ')');
  }
  ok(same(norm(await ls('sl-web-state')), norm(SEED['sl-web-state'])), label + ': saved list unchanged after opening');
  ok(await p.textContent('#sl-seen-n') === '5', label + ': Snakes seen shows 5');
  // a hidden card's saved data still reads from the page itself (what the cloud sync and backups read)
  const fromPage = await p.evaluate(() => {
    const out = {};
    document.querySelectorAll('#grid .note-btn[data-iso], #grid .note-btn[data-where]').forEach((b) => { out[b.closest('.card').dataset.id] = b.getAttribute('data-n') || '1'; });
    return { notes: out, done: [...document.querySelectorAll('#grid .card.done')].map((c) => c.dataset.id).sort(), photo: [...document.querySelectorAll('#grid .photo-btn.has-photo')].map((x) => x.closest('.card').dataset.id).sort() };
  });
  ok(same(Object.keys(fromPage.notes).sort().reduce((o, k) => (o[k] = fromPage.notes[k], o), {}), { 'boa-constrictor': '1', 'natrix-natrix': '1', 'opisthotropis-zhaoermii': '1', 'python-regius': '3' }), label + ': every sighting is on its card ' + JSON.stringify(fromPage.notes));
  ok(same(fromPage.done, STATE.done.slice().sort()), label + ': every Seen card is marked');
  ok(same(fromPage.photo, ['boa-constrictor', 'opisthotropis-zhaoermii']), label + ': both cards with your photos show them');

  // a rare one with a photo and a sighting, searched for
  await search('Zhao');
  ok(await shown('opisthotropis-zhaoermii'), label + ': search finds the Zhao snake');
  const z = await card('opisthotropis-zhaoermii').evaluate((c) => ({ done: c.classList.contains('done'), iso: c.querySelector('.note-btn').getAttribute('data-iso'), ph: c.querySelector('.photo-btn').classList.contains('has-photo'), bg: c.querySelector('.photo-btn').style.backgroundImage.slice(0, 20), seen: c.querySelector('.seen-btn') && getComputedStyle(c.querySelector('.lbl-seen')).display !== 'none', tags: c.querySelectorAll('.card-tags .tag').length, td: !!c.querySelector('.td-card-btn') }));
  ok(z.done && z.iso === '2020-02-29' && z.ph && /data:image/.test(z.bg) && z.seen && z.tags >= 3 && z.td, label + ': its card shows Seen, the sighting, the photo, its tags and 3D ' + JSON.stringify(z));
  // Ball Python: three encounters, followed
  await search('Ball Python');
  const bp = await card('python-regius').evaluate((c) => ({ n: c.querySelector('.note-btn').getAttribute('data-n'), f: c.classList.contains('follow'), d: c.classList.contains('done') }));
  ok(bp.n === '3' && bp.f && bp.d, label + ': Ball Python keeps its 3 encounters and Following ' + JSON.stringify(bp));
  if (SHOTS) await p.screenshot({ path: SHOTS + '/' + label + '-ballpython.png' });

  // Mark Seen + a new sighting's date and place
  await search('Black Mamba');
  await tap('dendroaspis-polylepis', '.seen-btn');
  await p.waitForTimeout(1600);
  ok(await card('dendroaspis-polylepis').evaluate((c) => c.classList.contains('done')), label + ': Black Mamba marked seen');
  await tap('dendroaspis-polylepis', '.note-btn');
  await p.waitForSelector('#note-sheet.open', { timeout: 5000 });
  await p.fill('#note-date', '2025-03-04');
  await p.fill('#note-where', 'Kruger National Park, South Africa');
  await p.click('#note-save');
  await p.waitForTimeout(600);
  const nm = await card('dendroaspis-polylepis').evaluate((c) => ({ iso: c.querySelector('.note-btn').getAttribute('data-iso'), where: c.querySelector('.note-btn').getAttribute('data-where') }));
  ok(nm.iso === '2025-03-04' && nm.where === 'Kruger National Park, South Africa', label + ': the new sighting is on the card ' + JSON.stringify(nm));

  // Mark unseen (the person's own choice: its sighting goes with it)
  await search('Grass Snake');
  await tap('natrix-natrix', '.seen-btn');
  await p.waitForTimeout(800);
  ok(await card('natrix-natrix').evaluate((c) => !c.classList.contains('done')), label + ': Grass Snake unmarked');

  // Want to see + Follow
  await search('Common Kingsnake');
  await tap('lampropeltis-getula', '.wish-btn');
  await p.waitForTimeout(300);
  await tap('lampropeltis-getula', '.follow-btn');
  await p.waitForTimeout(600);
  await p.keyboard.press('Escape');
  const kg = await card('lampropeltis-getula').evaluate((c) => ({ w: c.classList.contains('wish'), f: c.classList.contains('follow') }));
  ok(kg.w && kg.f, label + ': Kingsnake is on Want to see and Following ' + JSON.stringify(kg));

  // filters, Show more, 3D
  await search('');
  await p.evaluate(() => document.getElementById('chip-venom').click()); await p.waitForTimeout(500);
  const venomOnly = await p.evaluate(() => [...document.querySelectorAll('#grid .card')].filter((c) => getComputedStyle(c).display !== 'none').every((c) => c.dataset.venomous === '1' && c.querySelector('.seen-btn')));
  ok(venomOnly, label + ': the Venomous filter shows only venomous cards, each complete');
  await p.evaluate(() => document.getElementById('chip-venom').click()); await p.waitForTimeout(500);
  for (let i = 0; i < 2; i++) { await p.evaluate(() => { const m = document.getElementById('more-btn'); if (!m.hidden) m.click(); }); await p.waitForTimeout(500); }
  const complete = await p.evaluate(() => { const v = [...document.querySelectorAll('#grid .card')].filter((c) => getComputedStyle(c).display !== 'none'); return { n: v.length, ok: v.every((c) => c.querySelector('.card-top .card-name') && c.querySelector('.card-bottom .note-btn') && c.querySelector('.card-bottom .seen-btn') && c.querySelector('.td-card-btn')) }; });
  ok(complete.n >= 150 && complete.ok, label + ': after Show more every card on screen is complete (' + complete.n + ')');
  const td = p.locator('#grid .card .td-card-btn:visible').first();
  await td.scrollIntoViewIfNeeded(); await td.click(); await p.waitForTimeout(2500);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  await p.evaluate(() => { const x = document.querySelector('.sl3d-close, .sl3d-x, [aria-label="Close 3D"]'); if (x && x.offsetParent) x.click(); });

  // a quiz question
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.click('#tab-quiz'); await p.waitForTimeout(600);
  await p.locator('.quiz-level-btn').first().click(); await p.waitForTimeout(800);
  // a multiple-choice question gets its first answer; a map question is submitted as it is
  if (await p.locator('.quiz-choice:visible').count()) await p.locator('.quiz-choice:visible').first().click();
  else await p.locator('.quiz-submit:visible').first().click();
  await p.waitForTimeout(800);
  const q = (+await ls('sl-quiz-correct')) + (+await ls('sl-quiz-wrong'));
  ok(q === 11, label + ': the quiz answer was counted (' + q + ')');
  await p.click('#tab-guide'); await p.waitForTimeout(600);

  // Achievements
  await p.evaluate(() => window.SL_openAch('disc')); await p.waitForTimeout(700);
  const ach = await p.evaluate(() => { const d = document.getElementById('sl-achdlg'); return d && !d.hidden ? d.textContent : ''; });
  ok(/First Snake/.test(ach) && /Five Species/.test(ach), label + ': Achievements open and list the badges');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/' + label + '-ach.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.evaluate(() => { const d = document.getElementById('sl-achdlg'); const x = d && d.querySelector('.sl-aclose'); if (d && !d.hidden && x) x.click(); });

  await p.waitForTimeout(6000); // saves land, the tidy-up runs again
  const st1 = await p.evaluate(() => window.SL_LIGHT ? window.SL_LIGHT.stats() : null);
  if (st1) {
    console.log('light cards after using it:', JSON.stringify(st1));
    ok(st1.light > 3000, label + ': cards went light again after use (' + st1.light + ')');
    ok(st1.woken < 200, label + ': no feature woke up all the cards (' + st1.woken + ' woken on demand)');
  }
  const expect = JSON.parse(JSON.stringify(STATE));
  expect.done = expect.done.filter((x) => x !== 'natrix-natrix').concat('dendroaspis-polylepis');
  expect.wish.push('lampropeltis-getula'); expect.follow.push('lampropeltis-getula');
  delete expect.notes['natrix-natrix'];
  const saved = norm(await ls('sl-web-state'));
  const mamba = saved.notes['dendroaspis-polylepis'];
  ok(mamba && mamba.iso === '2025-03-04' && mamba.where === 'Kruger National Park, South Africa', label + ': the new sighting is saved');
  if (mamba) expect.notes['dendroaspis-polylepis'] = mamba;
  ok(same(saved, norm(JSON.stringify(expect))), label + ': saved list = the seeded list + exactly the changes made');
  if (!same(saved, norm(JSON.stringify(expect)))) console.log('  saved   ', JSON.stringify(saved), '\n  expected', JSON.stringify(norm(JSON.stringify(expect))));

  // reload: everything is still there and shown
  await p.reload({ waitUntil: 'load', timeout: 180000 });
  await ready();
  await p.waitForTimeout(3000);
  ok(same(norm(await ls('sl-web-state')), saved), label + ': saved list unchanged by reloading');
  ok(await ls('sl-sighting-photos:boa-constrictor') === SEED['sl-sighting-photos:boa-constrictor'] && await ls('sl-sighting-photos:opisthotropis-zhaoermii') === SEED['sl-sighting-photos:opisthotropis-zhaoermii'], label + ': your photos are untouched');
  ok(await ls('sl-favs') === SEED['sl-favs'], label + ': favourites untouched');
  const ad = JSON.parse(await ls('sl-ach-dates') || '{}');
  ok(ad.sp1 === '2024-05-12' && ad.sp5 === '2024-06-01' && ad.rec1 === '', label + ': achievement dates kept ' + JSON.stringify(ad));
  ok((+await ls('sl-quiz-correct')) + (+await ls('sl-quiz-wrong')) === 11, label + ': quiz score kept');
  ok(await p.textContent('#sl-seen-n') === '5', label + ': Snakes seen shows 5 after reloading');
  ok(/5/.test(await p.textContent('#tab-sightings')), label + ': My Sightings shows 5');
  await search('Black Mamba');
  const m2 = await card('dendroaspis-polylepis').evaluate((c) => ({ d: c.classList.contains('done'), w: c.querySelector('.note-btn').getAttribute('data-where'), lbl: getComputedStyle(c.querySelector('.lbl-seen')).display !== 'none' }));
  ok(m2.d && m2.w === 'Kruger National Park, South Africa' && m2.lbl, label + ': Black Mamba still shows Seen and its sighting ' + JSON.stringify(m2));
  await search('Zhao');
  ok(await card('opisthotropis-zhaoermii').evaluate((c) => c.querySelector('.photo-btn').classList.contains('has-photo') && c.classList.contains('done')), label + ': the Zhao snake still shows your photo');
  if (SHOTS) await p.screenshot({ path: SHOTS + '/' + label + '-after-reload.png' });
  ok(!previewFetches.length, label + ': nothing from christmas/, and from events/ only the public countdown\'s files, without the preview switch (' + previewFetches.slice(0, 3).join(', ') + ')');
  console.log('  public countdown files fetched: ' + ([...new Set(countdownFetches)].join(', ') || 'none (outside its window)'));
  ok(await p.evaluate(() => !window.SL_EVENTS || (window.SL_EVENTS.pub && !window.SL_EVENTS.advent && !window.SL_EVENTS.subscribe && !window.SL_EVENTS.cursor)), label + ': only the public countdown runs (no Advent, subscription or cursor)');
  ok(await p.evaluate(() => !window.XM && !document.documentElement.classList.contains('xm')), label + ': no Christmas decoration on the page');
  ok(!errs.length, label + ': no page errors ' + errs.slice(0, 3).join(' | '));
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  if (!process.env.ONLY_PHONE) await run(b, 'desktop', { viewport: { width: 1280, height: 900 } });
  await run(b, 'phone', devices['iPhone 13']);
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
