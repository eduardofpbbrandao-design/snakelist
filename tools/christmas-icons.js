// Renders the Christmas preview's PNG icons from christmas/xmas-icon.svg (made by tools/build-christmas.py):
//   node tools/christmas-icons.js        (needs Playwright + Chromium; the build calls it when they are there)
// writes tools/christmas/xmas-icon-48.png, -180.png and -192.png, which the build then copies into christmas/.
const fs = require('fs'), path = require('path');
let pw; try { pw = require(process.env.PLAYWRIGHT || 'playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
(async () => {
  const root = path.join(__dirname, '..');
  const svg = fs.readFileSync(path.join(root, 'christmas', 'xmas-icon.svg'), 'utf8');
  const opts = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : (fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const b = await pw.chromium.launch(opts);
  for (const n of [48, 180, 192]) {
    const p = await b.newPage({ viewport: { width: n, height: n } });
    await p.setContent('<html><body style="margin:0;background:transparent">' + svg.replace('<svg ', `<svg width="${n}" height="${n}" `) + '</body></html>');
    await p.screenshot({ path: path.join(root, 'tools', 'christmas', `xmas-icon-${n}.png`), omitBackground: true, clip: { x: 0, y: 0, width: n, height: n } });
    await p.close();
  }
  await b.close();
})();
