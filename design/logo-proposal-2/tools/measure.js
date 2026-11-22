const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const W = '/tmp/claude-0/-home-user-snakelist/0efffb05-b4c1-556b-aa06-7f7ade7de641/scratchpad/batch84/work/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.goto('file://' + W + 'harness.html');
  await p.waitForTimeout(300);
  const m = await p.evaluate(() => {
    const res = {};
    document.querySelectorAll('.exp').forEach(cell => {
      const mark = cell.querySelector('.mark'), tt = mark.querySelector('.tt'), s = tt.querySelector('.snake-s'), tk = mark.querySelector('.sl-tick');
      const o = mark.getBoundingClientRect();
      const rel = r => ({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height });
      const probe = document.createElement('span'); probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
      tt.appendChild(probe); const base = probe.getBoundingClientRect().top - o.top; probe.remove();
      const nodes = [...tt.childNodes];
      const nake = nodes.find(n => n.nodeType === 3 && n.textContent === 'nake');
      const r1 = document.createRange(); r1.selectNodeContents(nake);
      const r2 = document.createRange(); r2.selectNodeContents(tt.querySelector('em'));
      res[cell.id] = { mark: rel(o), tt: rel(tt.getBoundingClientRect()), snake: rel(s.getBoundingClientRect()), tick: rel(tk.getBoundingClientRect()),
        nake: rel(r1.getBoundingClientRect()), list: rel(r2.getBoundingClientRect()), base };
    });
    return res;
  });
  fs.writeFileSync(W + 'metrics.json', JSON.stringify(m, null, 1));
  console.log(JSON.stringify(m['exp-A-light']));
  await b.close();
})();
