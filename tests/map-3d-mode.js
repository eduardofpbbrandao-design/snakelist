// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT), then
//   PORT=<port> node tests/map-3d-mode.js [screenshot-dir]
// v4.63 3D mode on the map, on desktop (1280 x 900) and phone portrait (390 x 844):
//  - the "3D" button sits inside the map's bottom-right corner, clear of the zoom buttons, the colour key
//    and the hint, and pressing it only lights it up: no panel, drawer, pop-up or species picker opens;
//  - with 3D on, choosing a species in the map's list opens that exact snake's model in the map area
//    straight away (no box or extra step first), and "Back to map" leaves the map's zoom, the picked
//    country and the list as they were; every snake has a model (v4.63);
//  - a species box that is already open gets a 3D action as soon as 3D goes on, and loses it when 3D
//    goes off;
//  - with 3D off, a species row still opens the species page, as before.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT || 8766, BASE = 'http://localhost:' + PORT + '/';
const SHOTS = process.argv[2] || null;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const phone = vp.width < 600;
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await p.addInitScript(() => { localStorage.setItem('sl-consent', 'essential'); localStorage.setItem('sl-tour-seen', '1'); localStorage.setItem('sl-news-off', '1'); });
    await p.goto(BASE + 'index.html?map=Spain', { waitUntil: 'load' });
    await p.waitForFunction(() => window.SL_MAP_GEO_DONE, null, { timeout: 90000 });
    await p.waitForTimeout(2500);
    const sb = await p.$('#see-species:not([hidden])'); if (sb) { await sb.click(); await p.waitForTimeout(800); }
    ok(await p.evaluate(() => document.getElementById('cp-title').textContent === 'Spain' && document.querySelectorAll('#cp-list .cp-row.cp-sp').length > 5), `${label}: Spain picked, its species listed`);

    // ---- the corner button ----
    const geo = await p.evaluate(() => {
      const st = document.getElementById('globe-stage').getBoundingClientRect(), t = document.getElementById('td-toggle').getBoundingClientRect();
      const lap = sel => [].some.call(document.querySelectorAll(sel), e => { const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).display !== 'none' && r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top; });
      return { inside: t.left >= st.left && t.right <= st.right && t.top >= st.top && t.bottom <= st.bottom, right: st.right - t.right, bottom: st.bottom - t.bottom, w: t.width, h: t.height,
        lapZoom: lap('.globe-zoom, .layers-wrap, .map-tools'), lapKey: lap('.map-legend:not([hidden])'), lapHint: lap('.globe-hint'), lapAttr: lap('.leaflet-control-attribution') };
    });
    ok(geo.inside && geo.right <= 16 && geo.bottom <= 50, `${label}: the 3D button is inside the map's bottom-right corner (${Math.round(geo.right)} px from the right, ${Math.round(geo.bottom)} px from the bottom)`);
    ok(!geo.lapZoom && !geo.lapKey && !geo.lapHint && !geo.lapAttr, `${label}: it overlaps no zoom button, colour key, hint or map credit`);
    ok(geo.w >= 40 && geo.h >= 34 && geo.w <= 90, `${label}: compact and still easy to tap (${Math.round(geo.w)} x ${Math.round(geo.h)})`);
    if (SHOTS) await (await p.$('#globe-stage')).screenshot({ path: `${SHOTS}/3d-${label}-off.png` });
    const visible = () => p.evaluate(() => [].filter.call(document.querySelectorAll('[role="dialog"], .hm-panel, .sl3d-ov, .sp-info-wrap, .td-panel, .layers-pop, .sg-pop'),
      e => !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0).map(e => e.id || e.className));
    const before = await visible(), url0 = p.url();
    await p.click('#td-toggle'); await p.waitForTimeout(700);
    const after = await visible();
    ok(await p.evaluate(() => document.getElementById('td-toggle').getAttribute('aria-pressed') === 'true' && document.getElementById('td-toggle').classList.contains('on')), `${label}: pressing it turns 3D mode on and highlights it`);
    ok(JSON.stringify(before) === JSON.stringify(after) && p.url() === url0, `${label}: no panel, drawer, pop-up or species picker opens (${JSON.stringify(after)})`);
    if (SHOTS) await (await p.$('#globe-stage')).screenshot({ path: `${SHOTS}/3d-${label}-on.png` });

    // ---- a species with a model: its model, straight away ----
    const view0 = await p.evaluate(() => JSON.stringify(window.SL_MAP_VIEW()));
    const row = await p.$('#cp-list .cp-row.cp-sp:has(i:text-is("Natrix maura")) > b');
    ok(!!row, `${label}: Natrix maura is in Spain's list`);
    await row.scrollIntoViewIfNeeded(); await row.click(); await p.waitForTimeout(900);
    ok(await p.evaluate(() => !!document.querySelector('#globe-stage .sl3d-ov') && !/species\//.test(location.pathname) && document.querySelector('.sp-info-wrap').hidden),
      `${label}: with 3D on, choosing the species opens its 3D model right away (no species box or page first)`);
    const t0 = Date.now();
    const got = await p.waitForFunction(() => { const c = document.querySelector('#globe-stage .sl3d-ov .sp3d-canvas, #globe-stage .sl3d-ov .sp3d-msg:not(:has(.sp3d-spin))'); return c && (c.classList.contains('sp3d-canvas') ? 'canvas' : /Loading/.test(c.textContent) ? null : c.textContent); }, null, { timeout: 180000 }).then(h => h.jsonValue()).catch(() => null);
    const ov = await p.evaluate(() => { const o = document.querySelector('.sl3d-ov'), s = document.getElementById('globe-stage').getBoundingClientRect(); if (!o) return null; const r = o.getBoundingClientRect();
      return { inStage: o.parentNode.id === 'globe-stage', fills: Math.abs(r.left - s.left) <= 3 && Math.abs(r.width - s.width) <= 4 && Math.abs(r.top - s.top) <= 3 && Math.abs(r.height - s.height) <= 4,
        title: o.querySelector('h2').textContent, back: (o.querySelector('.sl3d-back') || {}).textContent, boxHidden: getComputedStyle(document.querySelector('.sp-info-wrap')).display === 'none' }; });
    ok(ov && ov.inStage && ov.fills, `${label}: the model opens in the map area (not a new page or full-screen layer)`);
    ok(ov && /Viperine/.test(ov.title) && /Natrix maura/.test(ov.title), `${label}: it is that exact snake's model (${ov && ov.title})`);
    ok(got === 'canvas', `${label}: the 3D model is drawn (${got === 'canvas' ? 'canvas in ' + Math.round((Date.now() - t0) / 1000) + ' s' : got})`);
    ok(ov && /Back to map/.test(ov.back), `${label}: a "Back to map" control is there`);
    if (SHOTS) { await p.waitForTimeout(2500); await (await p.$('#globe-stage')).screenshot({ path: `${SHOTS}/3d-${label}-model.png` }); }
    await p.click('.sl3d-back'); await p.waitForTimeout(800);
    const back = await p.evaluate(() => ({ ov: !!document.querySelector('.sl3d-ov'), box: !document.querySelector('.sp-info-wrap').hidden && getComputedStyle(document.querySelector('.sp-info-wrap')).display !== 'none',
      name: (document.getElementById('sp-info-name') || {}).textContent, view: JSON.stringify(window.SL_MAP_VIEW()), place: document.getElementById('cp-title').textContent }));
    ok(!back.ov && !back.box && back.place === 'Spain' && await p.evaluate(() => !!document.querySelector('#cp-list .cp-row.cp-sp')), `${label}: Back to map closes the model and Spain's list is still there`);
    ok(back.view === view0, `${label}: the map's zoom and position are unchanged`);

    // ---- v4.63: every snake has a model (living, extinct and fossil) ----
    const missing = await p.evaluate(() => fetch('species/3d/models.json').then(r => r.json()).then(m => [].filter.call(document.querySelectorAll('#cp-list .cp-row.cp-sp'),
      x => !m.species[x.dataset.sp]).length));
    ok(missing === 0, `${label}: every snake in Spain's list has a 3D model (${missing} missing)`);

    // ---- a box already open when 3D goes on / off ----
    await p.click('#td-toggle'); await p.waitForTimeout(300);
    const id = await p.evaluate(() => { const c = [].find.call(document.querySelectorAll('#grid .card'), x => (x.querySelector('.card-sci') || {}).textContent === 'Natrix maura'); return c && c.dataset.id; });
    await p.evaluate(id => window.SL_MAP_SPECIES_INFO(id), id); await p.waitForTimeout(400);
    ok(await p.evaluate(() => !document.querySelector('.sp-info-wrap').hidden && !document.querySelector('.sp-info-3d')), `${label}: 3D off: an open species box has no 3D action`);
    // on a phone the box covers the screen, so the corner button is pressed by script here
    await p.evaluate(() => document.getElementById('td-toggle').click()); await p.waitForTimeout(150);
    ok(await p.evaluate(() => !!document.querySelector('.sp-info-wrap:not([hidden]) .sp-info-acts .sp-info-3d')), `${label}: turning 3D on shows the action in the open box straight away`);
    await p.evaluate(() => document.getElementById('td-toggle').click()); await p.waitForTimeout(150);
    ok(await p.evaluate(() => !document.querySelector('.sp-info-3d') && document.getElementById('td-toggle').getAttribute('aria-pressed') === 'false'), `${label}: pressing the corner button again turns 3D off and hides the action`);
    await p.click('.sp-info-x'); await p.waitForTimeout(300);

    // ---- 3D off: a species row still opens its page ----
    const r3 = await p.$('#cp-list .cp-row.cp-sp:has(i:text-is("Natrix maura")) > b'); await r3.scrollIntoViewIfNeeded(); await r3.click();
    ok(await p.waitForURL(/species\//, { timeout: 15000 }).then(() => true, () => false), `${label}: with 3D off, a species row opens the species page as before`);
    ok(errs.length === 0, `${label}: no page errors` + (errs.length ? ' - ' + errs.join(' | ') : ''));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
})().catch(e => { console.error(e); process.exit(1); });
