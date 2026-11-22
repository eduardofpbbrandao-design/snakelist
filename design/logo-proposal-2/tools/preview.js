const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const W = '/tmp/claude-0/-home-user-snakelist/0efffb05-b4c1-556b-aa06-7f7ade7de641/scratchpad/batch84/work/';
const L = W + '../logo/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // sheet.png
  let ctx = await b.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
  let p = await ctx.newPage();
  await p.goto('file://' + W + 'sheet.html'); await p.waitForTimeout(500);
  await (await p.$('#sheet')).screenshot({ path: L + 'sheet.png' });
  await ctx.close();
  // page previews
  const body = fs.readFileSync(L + 'logo-choice.html', 'utf8');
  fs.writeFileSync(W + 'wrapped.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + body + '</body></html>');
  for (const [w, scheme, tag] of [[1200, 'light', 'desk-light'], [1200, 'dark', 'desk-dark'], [390, 'light', 'phone-light'], [390, 'dark', 'phone-dark']]) {
    ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1, colorScheme: scheme });
    p = await ctx.newPage();
    await p.goto('file://' + W + 'wrapped.html'); await p.waitForTimeout(800);
    const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    console.log(tag, 'scrollWidth', sw);
    await p.screenshot({ path: W + `prev-${tag}.png`, fullPage: true });
    await ctx.close();
  }
  await b.close();
})();
