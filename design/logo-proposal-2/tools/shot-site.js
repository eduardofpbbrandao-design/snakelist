// Real-site renders: CURRENT as-is, and A / B injected into the running site (preview only, nothing saved).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const W = '/tmp/claude-0/-home-user-snakelist/0efffb05-b4c1-556b-aa06-7f7ade7de641/scratchpad/batch84/work/';
const OUT = W + 'site/';
fs.mkdirSync(OUT, { recursive: true });
const V = JSON.parse(fs.readFileSync(W + 'variants.json', 'utf8'));
function inject(v) {
  const g = document.getElementById('mark-snake');
  g.innerHTML = v.inner;
  document.querySelectorAll('svg.snake-s').forEach(s => s.setAttribute('viewBox', v.vb));
  const st = document.createElement('style'); st.textContent = v.css; document.head.appendChild(st);
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const name of ['cur', 'A', 'B']) for (const theme of ['light', 'dark']) for (const [w, tag] of [[1280, 'desktop'], [390, 'phone']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 860 }, deviceScaleFactor: 2 });
    await ctx.addInitScript((t) => { for (const k of ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen']) localStorage.setItem(k, '1'); localStorage.setItem('snakelist.theme', t); }, theme);
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8784/snakelist-synced.html', { waitUntil: 'load' });
    if (name !== 'cur') await p.evaluate(inject, V[name]);
    await p.waitForTimeout(2600);
    if (theme === 'light') {
      const bb = await p.evaluate(() => { const t = document.querySelector('#sl-hero .hero-title'); const r = t && t.getBoundingClientRect(); return r && r.width ? { x: r.left, y: r.top, width: r.width, height: r.height } : null; });
      if (bb) await p.screenshot({ path: OUT + `hero-${name}-${tag}.png`, clip: { x: Math.max(0, bb.x - 24), y: Math.max(0, bb.y - 20), width: Math.min(w - Math.max(0, bb.x - 24), bb.width + 48), height: bb.height + 40 } });
    }
    await p.mouse.wheel(0, 1000); await p.waitForTimeout(2200);
    const bb = await p.evaluate(() => { const a = document.querySelector('.sl-header .sl-titletext').getBoundingClientRect(), c = document.querySelector('.sl-header .sl-tick').getBoundingClientRect(); return { x: a.left, y: Math.min(a.top, c.top), width: c.right - a.left, height: Math.max(a.bottom, c.bottom) - Math.min(a.top, c.top) }; });
    const pad = 14;
    await p.screenshot({ path: OUT + `header-${name}-${theme}-${tag}.png`, clip: { x: Math.max(0, bb.x - pad), y: bb.y - (tag === 'phone' ? 1 : 6), width: bb.width + 2 * pad + 8, height: bb.height + 5 + (tag === 'phone' ? 1 : 6) } });
    if (tag === 'desktop' && theme === 'light') {
      const tb = await p.$('#tab-sightings'); if (tb) await tb.screenshot({ path: OUT + `tab-${name}.png` });
    }
    await ctx.close();
  }
  await b.close();
})();
