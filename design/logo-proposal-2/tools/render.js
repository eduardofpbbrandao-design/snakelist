// usage: node render.js jobs.json   jobs: [{svg:"file.svg"|html:"file.html", out:"x.png", w, h, dpr?, bg?}]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctxs = {};
  for (const j of jobs) {
    const dpr = j.dpr || 1;
    if (!ctxs[dpr]) ctxs[dpr] = await b.newContext({ deviceScaleFactor: dpr });
    const p = await ctxs[dpr].newPage();
    await p.setViewportSize({ width: j.w, height: j.h });
    if (j.img) {
      const d = 'data:image/svg+xml;base64,' + fs.readFileSync(j.img).toString('base64');
      await p.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:${j.bg || 'transparent'}}img{display:block;width:${j.w}px;height:${j.h}px}</style></head><body><img src="${d}"></body></html>`);
      await p.waitForTimeout(300);
    } else if (j.svg) {
      let svg = fs.readFileSync(j.svg, 'utf8').replace(/<\?xml[^>]*>/, '');
      await p.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:${j.bg || 'transparent'}}svg{display:block;width:${j.w}px;height:${j.h}px}</style></head><body>${svg}</body></html>`);
    } else {
      await p.goto('file://' + j.html);
    }
    await p.waitForTimeout(j.wait || 150);
    if (j.sel) { const el = await p.$(j.sel); await el.screenshot({ path: j.out, omitBackground: !j.bg }); }
    else await p.screenshot({ path: j.out, omitBackground: !j.bg, fullPage: !!j.full });
    await p.close();
  }
  await b.close();
})();
