// Previews follow the account (tools/previews.js + the account sync in snakelist-synced.html + Settings > Previews).
// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT --bind 127.0.0.1), then
//   PORT=<port> node tests/previews.js [screenshot-dir]
// Firebase is replaced by a small fake (auth + the Firestore calls the app makes), its documents kept here in Node,
// so two separate browsers can sign in to the same test account.
//   a) a normal visitor (no switch, not signed in): no previews, nothing preview-only fetched, no Previews in Settings
//   b) ?preview=events while signed in: the switch is saved to the account
//   c) a fresh browser signing in to that account gets the events preview
//   d) Settings > Previews: the switch turns it off and on again (the account follows), "Turn all previews off"
//   e) ?preview=all: the five previews waiting for approval are on (classes on <html>, the new parts running), Settings
//      lists all six switches; ?preview=off puts everything back as today
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const PORT = process.env.PORT || 8766, BASE = 'http://127.0.0.1:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const ACCOUNT = ['previews-test', 'example.invalid'].join(String.fromCharCode(64)); // a made-up test address
const PUB_OK = /^\/events\/(config\.js|core\.js|art\.js|countdown\.js|events\.css|fonts\/outfit-latin-(500|800)\.woff2)$/;

// ---------------------------------------------------------------- the fake Firebase (documents live in STORE)
const STORE = new Map();
const FAKE_FB = `(function(){
  var cur = null; try { cur = JSON.parse(localStorage.getItem('fake-fb-user') || 'null'); } catch (e) {}
  var ls = [];
  function mk(u) { return u && Object.assign({}, u, { emailVerified: true, updateProfile: function () { return Promise.resolve(); }, sendEmailVerification: function () { return Promise.resolve(); },
    getIdToken: function () { return Promise.resolve('t'); }, getIdTokenResult: function () { return Promise.resolve({ claims: {} }); } }); }
  function fire() { ls.forEach(function (cb) { setTimeout(function () { cb(mk(cur)); }, 0); }); }
  var auth = {
    get currentUser() { return mk(cur); },
    onAuthStateChanged: function (cb) { ls.push(cb); setTimeout(function () { cb(mk(cur)); }, 30); return function () {}; },
    setPersistence: function () { return Promise.resolve(); },
    signInWithEmailAndPassword: function (e) { cur = { uid: 'uid-test-1', email: e, displayName: 'Tester' }; localStorage.setItem('fake-fb-user', JSON.stringify(cur)); fire(); return Promise.resolve({ user: mk(cur) }); },
    createUserWithEmailAndPassword: function (e, p) { return auth.signInWithEmailAndPassword(e, p); },
    signOut: function () { cur = null; localStorage.removeItem('fake-fb-user'); fire(); return Promise.resolve(); },
    sendPasswordResetEmail: function () { return Promise.resolve(); }
  };
  function call(op, p, d) { return window.__fakeFS(op, p, d == null ? null : JSON.stringify(d)).then(function (r) { return r == null ? null : JSON.parse(r); }); }
  var EMPTY = { docs: [], empty: true, size: 0, forEach: function () {} };
  function q() { var o = { where: function () { return o; }, limit: function () { return o; }, orderBy: function () { return o; },
    get: function () { return Promise.resolve(EMPTY); }, onSnapshot: function (cb) { setTimeout(function () { cb(EMPTY); }, 0); return function () {}; } }; return o; }
  function doc(p) { return { id: p.split('/').pop(), path: p, collection: function (n) { return col(p + '/' + n); },
    get: function () { return call('get', p).then(function (d) { return { exists: d != null, id: p.split('/').pop(), data: function () { return d; } }; }); },
    set: function (d, o) { return call(o && o.merge ? 'merge' : 'set', p, d); }, update: function (d) { return call('merge', p, d); }, delete: function () { return call('del', p); },
    onSnapshot: function (cb) { call('get', p).then(function (d) { cb({ exists: d != null, data: function () { return d; } }); }); return function () {}; } }; }
  function col(p) { var o = q(); o.doc = function (id) { return doc(p + '/' + (id || 'auto' + Math.random().toString(36).slice(2))); };
    o.add = function (d) { var r = o.doc(); return r.set(d).then(function () { return r; }); }; return o; }
  var db = { collection: col, doc: doc };
  window.firebase = { apps: [], initializeApp: function () { this.apps.push({}); },
    auth: Object.assign(function () { return auth; }, { Auth: { Persistence: { LOCAL: 'local', SESSION: 'session' } } }),
    firestore: Object.assign(function () { return db; }, { FieldValue: { serverTimestamp: function () { return '(server time)'; } }, Timestamp: { fromMillis: function (t) { return { toMillis: function () { return t; } }; } } }) };
})();`;
function fakeFS(op, p, json) {
  const d = json == null ? null : JSON.parse(json);
  if (op === 'get') return STORE.has(p) ? JSON.stringify(STORE.get(p)) : null;
  if (op === 'set') STORE.set(p, d);
  else if (op === 'merge') STORE.set(p, Object.assign({}, STORE.get(p) || {}, d));
  else if (op === 'del') STORE.delete(p);
  return null;
}
const accountKV = () => { const d = STORE.get('lists/uid-test-1'); try { return (JSON.parse(d.list) || {}).kv || {}; } catch (e) { return {}; } };

async function browser(b, o) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, o || {}));
  await ctx.exposeFunction('__fakeFS', fakeFS);
  const p = await ctx.newPage(); const errs = [], reqs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.dismiss());
  p.on('request', (r) => reqs.push(r.url()));
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => {
    if (/gstatic\.com\/firebasejs\/.*firebase-app-compat\.js/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_FB });
    if (/gstatic\.com\/firebasejs\//.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    return r.abort();
  });
  await p.addInitScript(() => { ['sl-consent'].forEach((k) => localStorage.setItem(k, 'essential')); ['sl-tour-seen', 'sl-news-off', 'sl-level-seen'].forEach((k) => localStorage.setItem(k, '1')); });
  return { ctx, p, errs, reqs };
}
const ready = (p) => p.waitForFunction(() => window.__introDone && document.getElementById('grid'), null, { timeout: 240000 });
const enter = async (p) => { await ready(p); await p.click('#hero-cue', { timeout: 5000 }).catch(() => {});
  await p.waitForFunction(() => window.__heroEntered || !document.querySelector('#sl-hero:not([hidden])'), null, { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500); };
async function signIn(p) {
  await p.evaluate(() => { const b = document.querySelector('.auth-btn[data-auth="open"]'); if (b) b.click(); });
  await p.waitForSelector('#signin-email', { state: 'visible', timeout: 30000 });
  await p.fill('#signin-email', ACCOUNT); await p.fill('#signin-password', 'test-password-1');
  await p.click('#signin-submit');
  await p.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('sl-google') || 'null'); } catch (e) { return null; } }, null, { timeout: 30000 });
}
const openSettings = (p) => p.evaluate(() => { window.SL_OPEN_SETTINGS(); return !!document.getElementById('sl-set-previews'); });
const closeSettings = (p) => p.keyboard.press('Escape');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  try {
    // ---------------------------------------------------------------- a) a normal visitor
    console.log('--- a) normal visitor');
    {
      const { ctx, p, errs, reqs } = await browser(b);
      await p.goto(BASE + 'index.html', { waitUntil: 'load', timeout: 240000 });
      await enter(p); await p.waitForTimeout(8000); // the public countdown (if any) has had time to load
      const st = await p.evaluate(() => ({ any: window.SL_PREVIEWS.any(), keys: Object.keys(localStorage).filter((k) => /preview/.test(k)), on: document.documentElement.classList.contains('sl-ev-on'),
        ev: window.SL_EV || null, fin: !!window.__slCdFinPv, style: sessionStorage.getItem('sl-opening-style') }));
      ok(st.any === false && st.keys.length === 0, 'no preview is on and none is stored (' + JSON.stringify(st.keys) + ')');
      ok(!st.on && !(st.ev && st.ev.on), 'the events preview is not running (' + JSON.stringify(st.ev) + ')');
      ok(!st.fin && !st.style, 'no finale / opening preview flags');
      const bad = reqs.filter((u) => { const x = new URL(u); return x.host.startsWith('127.0.0.1') && ((/^\/events\//.test(x.pathname) && !PUB_OK.test(x.pathname)) || /^\/christmas\//.test(x.pathname)); });
      ok(bad.length === 0, 'nothing preview-only fetched ' + JSON.stringify(bad));
      ok(!reqs.some((u) => /firebasejs/.test(u)), 'the account service is not loaded for a visitor who is not signed in');
      ok(!(await openSettings(p)), 'Settings has no Previews section');
      await closeSettings(p);
      ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 3)));
      await ctx.close();
    }
    // ---------------------------------------------------------------- b) the URL switch while signed in -> the account
    console.log('--- b) ?preview=events while signed in');
    {
      const { ctx, p, errs } = await browser(b);
      await p.goto(BASE + 'index.html', { waitUntil: 'load', timeout: 240000 });
      await enter(p); await signIn(p);
      await p.waitForFunction(() => +localStorage.getItem('sl-last-sync') > 0, null, { timeout: 60000 });
      ok(!('sl-art-preview-events' in accountKV()), 'before the switch the account has no previews');
      await p.goto(BASE + 'index.html?preview=events', { waitUntil: 'load', timeout: 240000 });
      await p.waitForFunction(() => window.SL_EVENTS && window.SL_EV && window.SL_EV.on, null, { timeout: 120000 });
      ok(!/preview=/.test(await p.evaluate(() => location.search)), 'the switch is taken out of the address');
      const t0 = Date.now(); while (accountKV()['sl-art-preview-events'] !== '1' && Date.now() - t0 < 90000) await p.waitForTimeout(500);
      ok(accountKV()['sl-art-preview-events'] === '1', 'the events preview is saved to the account (' + JSON.stringify(accountKV()) + ')');
      ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 3)));
      await ctx.close();
    }
    // ---------------------------------------------------------------- c) + d) a fresh browser signs in to that account
    console.log('--- c) a fresh browser signs in');
    {
      const { ctx, p, errs } = await browser(b, { deviceScaleFactor: 2 });
      await p.goto(BASE + 'index.html', { waitUntil: 'load', timeout: 240000 });
      await enter(p);
      ok(await p.evaluate(() => !window.SL_PREVIEWS.any() && !(window.SL_EV && window.SL_EV.on)), 'before signing in: no previews in this browser');
      await signIn(p);
      // the preview arrives with the account: switched on in place, or after one quiet reload
      await p.waitForFunction(() => localStorage.getItem('sl-art-preview-events') === '1', null, { timeout: 60000 });
      await p.waitForFunction(() => window.SL_EVENTS && window.SL_EV && window.SL_EV.on, null, { timeout: 240000 });
      const how = await p.evaluate(() => sessionStorage.getItem('sl-prev-reloaded') ? 'after one reload' : 'in place');
      ok(true, 'the events preview is running in the fresh browser (' + how + ')');
      await p.waitForFunction(() => window.__introDone, null, { timeout: 240000 }); await enter(p);
      console.log('--- d) Settings > Previews');
      ok(await openSettings(p), 'Settings shows the Previews section');
      const sw = '#sl-set-previews [data-pv="events"]';
      ok(await p.getAttribute(sw, 'aria-checked') === 'true', 'the Christmas events switch is on');
      ok(/Preview — not public yet/.test(await p.textContent('#sl-set-previews')), 'labelled "Preview — not public yet"');
      if (SHOTS) { await p.locator('#sl-set-previews').scrollIntoViewIfNeeded(); await p.waitForTimeout(400); await p.locator('#sl-set-previews').screenshot({ path: path.join(SHOTS, 'settings-previews.png') }); }
      await p.click(sw);
      ok(await p.getAttribute(sw, 'aria-checked') === 'false' && await p.evaluate(() => localStorage.getItem('sl-art-preview-events')) === '0', 'the switch turns it off');
      ok(await p.isVisible('#sl-set-previews [data-pv-reload]'), 'a Reload button is offered');
      let t0 = Date.now(); while (accountKV()['sl-art-preview-events'] !== '0' && Date.now() - t0 < 60000) await p.waitForTimeout(500);
      ok(accountKV()['sl-art-preview-events'] === '0', 'off is saved to the account');
      ok(await p.isVisible('#sl-set-previews'), 'the section stays while Settings is open');
      await p.click(sw);
      ok(await p.getAttribute(sw, 'aria-checked') === 'true' && await p.evaluate(() => localStorage.getItem('sl-art-preview-events')) === '1', 'the switch turns it on again');
      t0 = Date.now(); while (accountKV()['sl-art-preview-events'] !== '1' && Date.now() - t0 < 60000) await p.waitForTimeout(500);
      ok(accountKV()['sl-art-preview-events'] === '1', 'on is saved to the account');
      if (SHOTS) await p.locator('#sl-set-previews').screenshot({ path: path.join(SHOTS, 'settings-previews-changed.png') });
      await p.click('#sl-set-previews [data-pv-alloff]');
      ok(await p.evaluate(() => !window.SL_PREVIEWS.any()), '"Turn all previews off" turns them all off');
      await closeSettings(p); await p.waitForTimeout(300);
      ok(!(await openSettings(p)), 'with none on, Settings opens without the Previews section');
      await closeSettings(p);
      t0 = Date.now(); while (accountKV()['sl-art-preview-events'] !== '0' && Date.now() - t0 < 60000) await p.waitForTimeout(500);
      ok(accountKV()['sl-art-preview-events'] === '0', 'and the account follows');
      ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 3)));
      await ctx.close();
    }
    // ---------------------------------------------------------------- e) ?preview=all: the five previews waiting for approval
    console.log('--- e) ?preview=all');
    {
      const { ctx, p, errs } = await browser(b);
      await p.goto(BASE + 'index.html?preview=all', { waitUntil: 'load', timeout: 240000 });
      await enter(p);
      const st = await p.evaluate(() => ({ cls: ['opening', 'design', 'cookies', 'tutorial', 'finale'].filter((k) => document.documentElement.classList.contains('sl-pv-' + k)),
        ev: localStorage.getItem('sl-art-preview-events'), menu: localStorage.getItem('sl-art-preview-menu'), ds: document.getElementById('sl-ds-css').media, tour: document.getElementById('sl-tour-css').media,
        api: { ds: !!window.__slDS, tour: !!window.SL_TOUR, tz: !!window.SL_TZ }, q: location.search }));
      ok(st.cls.length === 5, 'the five previews are on, each a class on <html> (' + st.cls.join(', ') + ')');
      ok(st.ev === null && st.menu === '1', 'the events preview is left alone; the Previews section is remembered');
      ok(st.ds === 'all' && st.tour === 'all' && st.api.ds && st.api.tour && st.api.tz, 'the new design, tutorial and time zone are running');
      ok(!/preview=/.test(st.q), 'the switch is taken out of the address');
      ok(await openSettings(p), 'Settings shows the Previews section');
      const keys = await p.evaluate(() => [].map.call(document.querySelectorAll('#sl-set-previews [data-pv]'), (x) => x.getAttribute('data-pv') + '=' + x.getAttribute('aria-checked')));
      ok(['opening', 'design', 'cookies', 'tutorial', 'finale', 'country', 'spot'].every((k) => keys.indexOf(k + '=true') >= 0) && keys.length === 9, 'all nine switches are listed, the seven for approval on (' + keys.join(' ') + ')');
      if (SHOTS) { await p.locator('#sl-set-previews').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.locator('#sl-set-previews').screenshot({ path: path.join(SHOTS, 'settings-previews-all.png') }); }
      await closeSettings(p);
      await p.goto(BASE + 'index.html?preview=off', { waitUntil: 'load', timeout: 240000 });
      await ready(p);
      const off = await p.evaluate(() => ({ cls: /sl-pv-/.test(document.documentElement.className), ds: document.getElementById('sl-ds-css').media, any: window.SL_PREVIEWS.any(), lbl: (document.querySelector('#grid .card .lbl-mark') || {}).textContent }));
      ok(!off.cls && off.ds === 'not all' && !off.any && off.lbl === 'Mark Seen', '?preview=off: everything as today (' + JSON.stringify(off) + ')');
      ok(!(await openSettings(p)), 'not signed in, with none on: no Previews section');
      await closeSettings(p);
      ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 3)));
      await ctx.close();
    }
  } catch (e) { ok(false, 'crashed: ' + (e && e.stack || e)); }
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
