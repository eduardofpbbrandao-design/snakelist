// Renders the Christmas preview's pictures (made by tools/build-christmas.py), with Playwright + Chromium:
//   node tools/christmas-icons.js                       the PNG icons from christmas/xmas-icon.svg
//                                                       -> tools/christmas/xmas-icon-48.png, -180.png, -192.png
//   node tools/christmas-icons.js --cabin in.svg out.png  the Christmas Cabin's room (1000 x 600 drawing) at 2x
//   node tools/christmas-icons.js --render in.svg out.png scale w h   any drawing, transparent (the pages' logo letters)
// The build calls it when Node + Playwright are here and otherwise keeps the saved pictures.
const fs = require('fs'), path = require('path');
let pw; try { pw = require(process.env.PLAYWRIGHT || 'playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
(async () => {
  const root = path.join(__dirname, '..');
  const opts = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : (fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const b = await pw.chromium.launch(opts);
  const ci = process.argv.indexOf('--cabin'), ri = process.argv.indexOf('--render');
  if (ri > 0) {
    // --render in.svg out.png scale width height: any drawing, on a transparent background
    const [f, out, sc, w, h] = process.argv.slice(ri + 1);
    const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +sc });
    await p.setContent('<html><body style="margin:0;background:transparent">' + fs.readFileSync(f, 'utf8') + '</body></html>');
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
    await p.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: +w, height: +h } });
  } else if (ci > 0) {
    const p = await b.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 2 });
    await p.setContent('<html><body style="margin:0">' + fs.readFileSync(process.argv[ci + 1], 'utf8') + '</body></html>');
    await p.waitForTimeout(300);
    await p.screenshot({ path: process.argv[ci + 2], clip: { x: 0, y: 0, width: 1000, height: 600 } });
  } else {
    const svg = fs.readFileSync(path.join(root, 'christmas', 'xmas-icon.svg'), 'utf8');
    for (const n of [48, 180, 192]) {
      const p = await b.newPage({ viewport: { width: n, height: n } });
      await p.setContent('<html><body style="margin:0;background:transparent">' + svg.replace('<svg ', `<svg width="${n}" height="${n}" `) + '</body></html>');
      await p.screenshot({ path: path.join(root, 'tools', 'christmas', `xmas-icon-${n}.png`), omitBackground: true, clip: { x: 0, y: 0, width: n, height: n } });
      await p.close();
    }
  }
  await b.close();
})();
