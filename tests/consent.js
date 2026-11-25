// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT), then
//   PORT=<port> node tests/consent.js [screenshot-dir]
// Cookie and ad consent (sl-consent.js): Google Consent Mode v2 is "denied" before any Google tag; outside Europe the
// AdSense script loads only after an answer, Reject keeps everything denied (limited, non-personalised ads, no ad
// cookies), Manage saves each switch; in Europe Google's certified consent message (faked here with a TCF API) replaces
// SnakeList's own banner, and without it the banner asks about analytics only; auto-placed ads never stay inside the
// card grid or a panel; the other pages get the same banner and the "Cookie choices" link.
// Google's servers are never reached: the AdSense and Analytics scripts are answered with small fakes.
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://localhost:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const AD = /googlesyndication\.com|doubleclick\.net|googleadservices\.com|fundingchoicesmessages\.google\.com|adtrafficquality\.google/;
const GA = /google-analytics\.com|googletagmanager\.com/;
// the fake AdSense script: notes what the page had told Google before it ran; with window.__fakeCmp it acts like
// Google's consent message (TCF v2.2 API, the visitor is in the EEA)
const FAKE_ADS = `(function(){
  window.__adsAt = { dl: JSON.parse(JSON.stringify((window.dataLayer||[]).map(function(a){return [].slice.call(a);}))), npa: (window.adsbygoogle||{}).requestNonPersonalizedAds };
  if (window.__fakeCmp) { var L = [];
    window.__tcfapi = function (cmd, v, cb) { if (cmd === 'addEventListener') { L.push(cb); cb({ gdprApplies: true, eventStatus: 'cmpuishown' }, true); } };
    window.__cmpAnswer = function (yes) { var c = {}; [1,2,3,4,5,6,7,8,9,10].forEach(function(i){ c[i] = yes; });
      L.forEach(function (cb) { cb({ gdprApplies: true, eventStatus: 'useractioncomplete', purpose: { consents: c }, vendor: { consents: { 755: yes } } }, true); }); };
  }
})();`;

async function page(b, opts, seed) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.errs = errs;
  p.ext = [];
  await p.route(/^https?:\/\/(?!localhost)/, (r) => {
    const u = r.request().url(); p.ext.push({ u, t: Date.now() });
    if (/adsbygoogle\.js/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_ADS });
    if (/googletagmanager\.com\/gtag/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.__gaLoaded=1;' });
    return r.abort();
  });
  await p.addInitScript((seed) => {
    for (const k of ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen']) localStorage.setItem(k, '1');
    // the new bar, Manage and Cookie choices are the "cookies" preview (Settings > Previews); the protective part runs for everyone
    if (localStorage.getItem('sl-art-preview-cookies') == null) localStorage.setItem('sl-art-preview-cookies', '1');
    Object.keys(seed || {}).forEach((k) => localStorage.setItem(k, seed[k]));
  }, seed || {});
  return p;
}
const consentCalls = (p) => p.evaluate(() => (window.dataLayer || []).filter((a) => a[0] === 'consent').map((a) => [a[1], a[2]]));
const last = (calls) => { const o = {}; calls.forEach((c) => Object.assign(o, c[1])); return o; };
const cookies = (p) => p.evaluate(() => document.cookie);
const adsReq = (p) => p.ext.filter((x) => AD.test(x.u));
async function appReady(p) {
  await p.waitForFunction(() => window.__introDone && document.getElementById('grid'), null, { timeout: 120000 });
  await p.evaluate(() => { const i = document.getElementById('intro'); if (i) i.remove(); });
  // into SnakeList past the opening photo (pop-ups wait while it is there)
  for (let k = 0; k < 30 && !(await p.evaluate(() => window.__heroEntered || !document.querySelector('#sl-hero:not([hidden])'))); k++) {
    await p.mouse.move(200, 300).catch(() => {}); await p.mouse.wheel(0, 400).catch(() => {});
    await p.evaluate(() => window.scrollBy(0, 300)); await p.waitForTimeout(400);
  }
  await p.waitForFunction(() => !document.documentElement.classList.contains('sl-prompt-hold'), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(500);
}
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: SHOTS + '/' + name + '.png' }); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--disable-gpu'] });
  const desk = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' };
  const phone = { ...devices['iPhone 13'], deviceScaleFactor: 2, reducedMotion: 'reduce' };

  // ---------- outside Europe, the app: nothing before the answer, then Manage ----------
  for (const [label, opts] of [['desktop', desk], ['phone', phone]]) {
    console.log('--- app, New York, ' + label);
    const p = await page(b, { ...opts, timezoneId: 'America/New_York' });
    await p.goto(BASE + 'index.html', { waitUntil: 'load', timeout: 180000 });
    await appReady(p);
    const c0 = await consentCalls(p);
    ok(c0.length && c0[0][0] === 'default' && ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'].every((k) => c0[0][1][k] === 'denied') && c0[0][1].wait_for_update === 500,
      label + ': Consent Mode v2 default is denied for all four, with wait_for_update');
    ok(await p.evaluate(() => { const d = window.dataLayer; const i = d.findIndex((a) => a[0] === 'consent' && a[1] === 'default'), j = d.findIndex((a) => a[0] === 'config'); return i >= 0 && j > i; }), label + ': the default comes before the Google tag config');
    await p.evaluate(() => window.SL_3P && window.SL_3P()); // the moment the app loads Google's scripts
    await p.waitForTimeout(3500);
    ok(!adsReq(p).length, label + ': no AdSense / DoubleClick request before an answer (' + adsReq(p).map((x) => x.u).join(' ') + ')');
    ok(!/(^|; )(_ga|_gid|__gads|__gpi|__eoi|_gcl)/.test(await cookies(p)), label + ': no analytics or ad cookies before an answer');
    await p.evaluate(() => window.SL_showCookies());
    await p.waitForSelector('#ck-bar:not([hidden])', { timeout: 5000 });
    const btns = await p.$$eval('#ck-bar button', (l) => l.filter((x) => !x.hidden).map((x) => x.textContent.trim()));
    ok(btns.join('|') === 'Reject|Manage|Accept cookies', label + ': the bar offers Reject, Manage, Accept (' + btns.join('|') + ')');
    ok(await p.$eval('#ck-bar .ck-ads', (x) => !x.hidden), label + ': outside Europe the bar mentions ads');
    const r = await p.$eval('#ck-bar', (x) => { const r = x.getBoundingClientRect(); return { h: r.height, b: innerHeight - r.bottom }; });
    ok(r.h < (label === 'phone' ? 190 : 110), label + ': the bar stays small (' + Math.round(r.h) + ' px high)');
    await shot(p, 'app-' + label + '-banner');
    await p.click('#ck-more');
    await p.waitForSelector('#slc-manage .slc-panel', { timeout: 3000 });
    ok(await p.$$eval('#slc-manage .slc-sw', (l) => l.map((x) => x.id).join(',')) === 'slc-an,slc-ads', label + ': Manage shows the Analytics and Advertising switches (Essential always on)');
    await shot(p, 'app-' + label + '-manage');
    await p.click('#slc-an'); // analytics on, ads stay off
    await p.click('#slc-manage .slc-save');
    await p.waitForTimeout(400);
    ok(await p.evaluate(() => localStorage.getItem('sl-consent') === 'yes' && localStorage.getItem('sl-ads') === 'no'), label + ': Save choices stores analytics yes, ads no');
    const u = last(await consentCalls(p));
    ok(u.analytics_storage === 'granted' && u.ad_storage === 'denied' && u.ad_user_data === 'denied' && u.ad_personalization === 'denied', label + ': Consent Mode now: analytics granted, ads denied ' + JSON.stringify(u));
    ok(await p.evaluate(() => document.getElementById('ck-bar').hidden && !document.getElementById('slc-manage')), label + ': the bar and the panel are gone');
    await p.waitForTimeout(600);
    ok(adsReq(p).length === 1, label + ': the AdSense script loads after the answer');
    ok(await p.evaluate(() => window.__adsAt && window.__adsAt.npa === 1), label + ': ...asking for non-personalised ads');
    // the ad guard: an auto-placed ad inside the card grid is taken out, one between the page's own parts stays
    await p.evaluate(() => { const g = document.getElementById('grid'); const a = document.createElement('div'); a.className = 'google-auto-placed'; a.id = 'ad-in'; a.innerHTML = '<ins class="adsbygoogle"></ins>'; g.insertBefore(a, g.children[3]);
      const z = document.createElement('div'); z.className = 'google-auto-placed'; z.id = 'ad-out'; z.innerHTML = '<ins class="adsbygoogle"></ins>'; document.body.appendChild(z);
      const s = document.querySelector('.sl-achdlg') || document.body; const y = document.createElement('ins'); y.className = 'adsbygoogle'; y.id = 'ad-dlg'; (document.querySelector('.sl-achbox') || s).appendChild(y); });
    await p.waitForTimeout(100);
    ok(await p.evaluate(() => !document.getElementById('ad-in') && !!document.getElementById('ad-out')), label + ': an auto-placed ad inside the cards is removed, one outside stays');
    ok(await p.evaluate(() => !document.querySelector('.sl-achbox') || !document.getElementById('ad-dlg')), label + ': an auto-placed ad inside a panel is removed');
    // Cookie choices in Settings and the footer open the panel again with the saved switches
    ok(await p.evaluate(() => !document.getElementById('sl-foot-ck').hidden), label + ': the footer has Cookie choices');
    await p.evaluate(() => window.SL_OPEN_SETTINGS());
    await p.waitForSelector('#ss-ck', { timeout: 3000 });
    await p.click('#ss-ck');
    await p.waitForSelector('#slc-manage', { timeout: 3000 });
    ok(await p.evaluate(() => document.getElementById('slc-an').getAttribute('aria-checked') === 'true' && document.getElementById('slc-ads').getAttribute('aria-checked') === 'false'), label + ': Settings > Cookie choices shows the saved choice');
    await p.keyboard.press('Escape');
    ok(await p.evaluate(() => !document.getElementById('slc-manage')), label + ': Escape closes the panel');
    ok(!p.errs.length, label + ': no page errors ' + p.errs.join(' | '));
    await p.context().close();
  }

  // ---------- Reject and Accept ----------
  for (const [label, btn, want, npa] of [['Reject', '#ck-no', 'denied', 1], ['Accept', '#ck-yes', 'granted', 0]]) {
    console.log('--- app, New York, ' + label);
    const p = await page(b, { ...desk, timezoneId: 'America/New_York' });
    await p.goto(BASE + 'index.html', { waitUntil: 'load', timeout: 180000 });
    await appReady(p);
    await p.evaluate(() => { window.SL_3P && window.SL_3P(); window.SL_showCookies(); });
    await p.waitForSelector('#ck-bar:not([hidden])', { timeout: 5000 });
    await p.waitForTimeout(3000);
    ok(!adsReq(p).length, label + ': no ad request while the question is open');
    await p.click(btn);
    await p.waitForTimeout(800);
    const u = last(await consentCalls(p));
    ok(['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'].every((k) => u[k] === want), label + ': Consent Mode is ' + want + ' for all four ' + JSON.stringify(u));
    ok(await p.evaluate(() => localStorage.getItem('sl-consent') + '/' + localStorage.getItem('sl-ads')) === (npa ? 'no/no' : 'yes/yes'), label + ': the choice is stored');
    ok(await p.evaluate((n) => window.__adsAt && window.__adsAt.npa === n, npa), label + ': ads load ' + (npa ? 'limited (non-personalised)' : 'personalised'));
    if (npa) ok(!/(^|; )(_ga|_gid|__gads|__gpi|__eoi|_gcl)/.test(await cookies(p)), label + ': still no analytics or ad cookies');
    // the choice is remembered: after a reload the stored answer is told to Google before its scripts
    await p.reload({ waitUntil: 'load' }); await appReady(p);
    const c = await consentCalls(p);
    ok(c.length >= 2 && c[1][0] === 'update' && c[1][1].ad_storage === want, label + ': after a reload the stored choice is applied straight away');
    ok(await p.evaluate(() => document.getElementById('ck-bar').hidden), label + ': and not asked again');
    await p.context().close();
  }

  // ---------- an older answer (before ads were asked about) ----------
  {
    console.log('--- app, older "yes"');
    const p = await page(b, { ...desk, timezoneId: 'America/Chicago' }, { 'sl-consent': 'yes' });
    await p.goto(BASE + 'index.html', { waitUntil: 'load', timeout: 180000 });
    await appReady(p);
    const u = last(await consentCalls(p));
    ok(u.analytics_storage === 'granted' && u.ad_storage === 'denied', 'an older "yes" keeps analytics, ads stay not personalised ' + JSON.stringify(u));
    await p.context().close();
  }

  // ---------- Europe with Google's consent message (faked) ----------
  {
    console.log('--- app, Lisbon, Google consent message');
    const p = await page(b, { ...desk, timezoneId: 'Europe/Lisbon' });
    await p.addInitScript(() => { window.__fakeCmp = 1; });
    await p.goto(BASE + 'index.html', { waitUntil: 'load', timeout: 180000 });
    await appReady(p);
    ok(await p.evaluate(() => window.SLC && window.SLC.strict), 'Lisbon counts as Europe');
    await p.evaluate(() => window.SL_3P && window.SL_3P());
    await p.waitForFunction(() => window.__adsAt, null, { timeout: 10000 });
    ok(await p.evaluate(() => { const d = window.__adsAt.dl; return d.length && d[0][0] === 'consent' && d[0][1] === 'default' && d[0][2].ad_storage === 'denied'; }), 'the AdSense script runs only after the denied defaults');
    ok(await p.evaluate(() => window.__adsAt.npa === undefined), 'in Europe SnakeList does not force non-personalised ads (Google\'s message decides)');
    await p.waitForFunction(() => window.SLC.cmpHandles(), null, { timeout: 8000 });
    await p.evaluate(() => window.SL_showCookies());
    await p.waitForTimeout(1500);
    ok(await p.evaluate(() => document.getElementById('ck-bar').hidden), 'SnakeList\'s own bar is not shown when Google\'s message handles it');
    ok(!/(^|; )(_ga|__gads)/.test(await cookies(p)), 'no cookies before the answer in Google\'s message');
    await p.evaluate(() => window.__cmpAnswer(false));
    let u = last(await consentCalls(p));
    ok(['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'].every((k) => u[k] === 'denied') && await p.evaluate(() => localStorage.getItem('sl-consent')) === 'no', '"Do not consent" there keeps everything denied');
    await p.evaluate(() => window.__cmpAnswer(true));
    u = last(await consentCalls(p));
    ok(['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'].every((k) => u[k] === 'granted') && await p.evaluate(() => localStorage.getItem('sl-consent')) === 'yes', '"Consent" there grants all four and turns on Picked for you');
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
  }

  // ---------- the other pages: Europe without Google's message, and outside Europe on a phone ----------
  {
    console.log('--- privacy page, Paris, no Google message yet');
    const p = await page(b, { ...desk, timezoneId: 'Europe/Paris' });
    await p.goto(BASE + 'privacy.html', { waitUntil: 'load' });
    await p.waitForSelector('#slc-bar:not([hidden])', { timeout: 15000 });
    ok(await p.$eval('#slc-bar p', (x) => !/ads/.test(x.textContent)), 'Europe without Google\'s message: the bar asks about analytics only');
    ok(adsReq(p).length === 1 && await p.evaluate(() => window.__adsAt && window.__adsAt.dl[0][1] === 'default'), 'the AdSense script (which brings Google\'s message) loads after the denied defaults');
    await p.click('#slc-bar .slc-more');
    ok(await p.evaluate(() => !document.getElementById('slc-ads') && /Google's own consent message/.test(document.getElementById('slc-manage').textContent)), 'Manage: no ad switch, it explains Google\'s message');
    await shot(p, 'page-desktop-manage-europe');
    await p.click('#slc-manage .slc-yes');
    const u = last(await consentCalls(p));
    ok(u.analytics_storage === 'granted' && u.ad_storage === 'denied', 'Accept all there: analytics yes, ads stay denied until Google\'s message ' + JSON.stringify(u));
    await p.context().close();
  }
  {
    console.log('--- species page, New York, phone');
    const p = await page(b, { ...phone, timezoneId: 'America/New_York' });
    await p.goto(BASE + 'species/viperine-snake-natrix-maura.html', { waitUntil: 'load' });
    await p.waitForSelector('#slc-bar:not([hidden])', { timeout: 15000 });
    await p.waitForTimeout(1500);
    ok(!adsReq(p).length, 'species page: no ad request before an answer');
    ok(await p.evaluate(() => !!document.querySelector('footer [data-slc-open]')), 'species page: the footer has Cookie choices');
    await shot(p, 'page-phone-banner');
    await p.click('#slc-bar .slc-more');
    await shot(p, 'page-phone-manage');
    await p.click('#slc-manage .slc-no');
    await p.waitForTimeout(600);
    const u = last(await consentCalls(p));
    ok(['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'].every((k) => u[k] === 'denied'), 'species page: Reject all keeps everything denied');
    ok(adsReq(p).length === 1 && await p.evaluate(() => window.__adsAt.npa === 1), 'species page: then limited, non-personalised ads');
    ok(await p.evaluate(() => document.getElementById('slc-bar').hidden), 'species page: the bar is gone');
    await p.click('footer [data-slc-open]');
    ok(await p.evaluate(() => !!document.getElementById('slc-manage')), 'species page: Cookie choices opens the panel again');
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
  }
  // dark look, for the record
  if (SHOTS) {
    const p = await page(b, { ...desk, timezoneId: 'America/New_York', colorScheme: 'dark' });
    await p.goto(BASE + 'about-snakelist.html', { waitUntil: 'load' });
    await p.waitForSelector('#slc-bar:not([hidden])', { timeout: 15000 });
    await shot(p, 'page-desktop-banner-dark');
    await p.click('#slc-bar .slc-more'); await shot(p, 'page-desktop-manage-dark');
    await p.context().close();
  }
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
