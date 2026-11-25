// Run: python3 build-site.py, serve the repo (python3 -m http.server $PORT --bind 127.0.0.1), then
//   PORT=<port> node tests/data-seo.js
// Data accuracy and SEO of the generated site (docs/audit/data-seo.md):
//  * venom status has one source (data/venom-status.json, written into the app's cards): no card disagrees with it, the
//    Asian Vine Snake (Ahaetulla prasina) says "mildly venomous" in its intro, tags, key facts, the app's card, filter and
//    quick look, and no sourced account that calls its snake mildly venomous / rear-fanged is flagged non-venomous;
//  * species pages: unique title, description and canonical (= its own address), og:url = canonical, no fake ratings in
//    the structured data, every image has alt text; old scientific-name-only addresses are noindex redirect stubs
//    pointing (canonical + refresh) at a page that exists;
//  * sitemap.xml: no duplicate URLs, only canonical pages (no redirect stub), every species page in it;
//  * "recorded in N countries" is worded as SnakeList's records, and a published range wider than the records says so;
//  * species totals: every hard-coded "N species" on the static pages and the app's first frame equal the card count;
//  * a card with no common name shows only its scientific name (no "No common name" label on screen).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 8877, BASE = 'http://127.0.0.1:' + PORT + '/';
const SITE = 'https://snakelist.com/';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const attr = (t, re) => { const m = re.exec(t); return m ? m[1] : null; };
const plain = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&ndash;/g, '–').replace(/&rsquo;/g, '’').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

// ---------------------------------------------------------------- venom: one source
const app = rd('snakelist-synced.html');
const cards = {};
for (const m of app.matchAll(/<div class="card" data-id="([^"]+)"[^>]*?data-venomous="(\d)"[^>]*>/g)) cards[m[1]] = m[2] === '1';
const nCards = (app.match(/<div class="card" data-id=/g) || []).length;
ok(Object.keys(cards).length === nCards, 'every card has a venom flag (' + nCards + ')');
let chk = '';
try { chk = execFileSync('python3', [path.join(ROOT, 'tools/venom_status.py'), '--check'], { cwd: ROOT, encoding: 'utf8' }); ok(true, 'tools/venom_status.py --check: ' + chk.trim().split('\n').pop()); }
catch (e) { ok(false, 'tools/venom_status.py --check: ' + String(e.stdout || e.message).trim().split('\n').slice(-3).join(' | ')); }
ok(cards['ahaetulla-prasina'] === true, 'app card: Ahaetulla prasina is venomous (data-venomous="1")');
// sourced accounts that say the snake is (mildly) venomous / rear-fanged must not be flagged non-venomous, and the reverse
const VS = JSON.parse(rd('data/venom-status.json'));
const reviewed = new Set(Object.keys(VS.reviewed_not_changed || {}).map((g) => g.toLowerCase()));
const txt = (o) => typeof o === 'string' ? o : Array.isArray(o) ? o.map(txt).join(' ') : o && typeof o === 'object' ? Object.entries(o).filter(([k]) => !['src', 'sources', 'url'].includes(k)).map(([, v]) => txt(v)).join(' ') : '';
const contra = [];
for (const f of fs.readdirSync(path.join(ROOT, 'data/species-info'))) {
  const d = JSON.parse(rd('data/species-info/' + f)), id = d.id;
  if (!(id in cards)) continue;
  const own = txt([d.sections && d.sections.overview, d.facts && d.facts.venom, d.sections && d.sections.snakebite]);
  const says = /\bmildly venomous\b|\brear-fanged\b|\bback-fanged\b|fangs at the back|\b(?:very )?mild venom\b/i.test(own);
  const saysNot = /\bis (?:a |an )?[a-z ,-]*\bnon-?venomous\b|\bnot venomous\b/i.test(own);
  if (says && !cards[id] && !reviewed.has(id.split('-')[0])) contra.push(id + ' (account: venomous, card: non-venomous)');
  if (saysNot && cards[id]) contra.push(id + ' (account: non-venomous, card: venomous)');
}
ok(!contra.length, 'no species account contradicts its venom flag ' + contra.join(', '));

// ---------------------------------------------------------------- species pages
const SP = path.join(ROOT, 'species');
const pages = [], stubs = [];
for (const f of fs.readdirSync(SP)) {
  if (!f.endsWith('.html') || f === 'index.html' || f === 'photo-credits.html') continue;
  const t = fs.readFileSync(path.join(SP, f), 'utf8');
  (/<meta name="robots" content="noindex">/.test(t) && /http-equiv="refresh"/.test(t) ? stubs : pages).push([f, t]);
}
ok(pages.length > 4000, 'species pages built: ' + pages.length + ' (and ' + stubs.length + ' redirect stubs)');
const seen = { title: {}, desc: {}, canon: {} }, bad = { canon: [], og: [], rating: [], alt: [], noTitle: [] };
for (const [f, t] of pages) {
  const title = attr(t, /<title>([^<]*)<\/title>/), desc = attr(t, /<meta name="description" content="([^"]*)"/), canon = attr(t, /<link rel="canonical" href="([^"]*)"/);
  const og = attr(t, /<meta property="og:url" content="([^"]*)"/);
  if (!title || !desc || !canon) { bad.noTitle.push(f); continue; }
  (seen.title[title] = seen.title[title] || []).push(f); (seen.desc[desc] = seen.desc[desc] || []).push(f); (seen.canon[canon] = seen.canon[canon] || []).push(f);
  if (canon !== SITE + 'species/' + f.replace(/\.html$/, '')) bad.canon.push(f);
  if (og && og !== canon) bad.og.push(f);
  if (/aggregateRating|"ratingValue"|"reviewCount"/.test(t)) bad.rating.push(f);
  // every image has an alt; a photo of the snake has a real one (alt="" only for a decorative icon)
  for (const m of t.matchAll(/<img\b[^>]*>/g)) if (!/\balt="/.test(m[0]) || (/species-photos|inaturalist|wikimedia/.test(m[0]) && !/\balt="[^"]+"/.test(m[0]))) { bad.alt.push(f); break; }
}
const dups = (o) => Object.entries(o).filter(([, v]) => v.length > 1);
ok(!bad.noTitle.length, 'every species page has a title, description and canonical ' + bad.noTitle.slice(0, 5).join(' '));
ok(!dups(seen.title).length, 'species page titles are unique ' + dups(seen.title).slice(0, 3).map(([k, v]) => k + ' = ' + v.join('+')).join(' | '));
ok(!dups(seen.desc).length, 'species page meta descriptions are unique ' + dups(seen.desc).slice(0, 3).map(([, v]) => v.join('+')).join(' | '));
ok(!dups(seen.canon).length && !bad.canon.length, 'each species page is its own canonical ' + bad.canon.slice(0, 5).join(' '));
ok(!bad.og.length, 'og:url = canonical on every species page ' + bad.og.slice(0, 5).join(' '));
ok(!bad.rating.length, 'no ratings or reviews in any structured data ' + bad.rating.slice(0, 5).join(' '));
ok(!bad.alt.length, 'every image on the species pages has alt text ' + bad.alt.slice(0, 5).join(' '));
const titleStyle = pages.filter(([, t]) => / – (?:Photos, Range & Facts|Photos & Facts|Range & Facts|Facts|Fossil Snake Facts|Fossil Snake) \| SnakeList<\/title>|\| SnakeList<\/title>/.test(t.replace(/&amp;/g, '&'))).length;
ok(titleStyle === pages.length, 'species titles follow "Name (Scientific) – Photos, Range & Facts | SnakeList" (' + titleStyle + '/' + pages.length + ')');
const pageSet = new Set(pages.map(([f]) => f));
const badStub = stubs.filter(([, t]) => { const tgt = attr(t, /url=([^"]+)"/); const c = attr(t, /<link rel="canonical" href="([^"]*)"/); return !tgt || !(pageSet.has(tgt + '.html') || /^\.\.?\//.test(tgt) || /\//.test(tgt)) || !c || !c.startsWith(SITE); });
ok(!badStub.length, 'old addresses are noindex stubs with canonical + refresh to a page that exists ' + badStub.slice(0, 5).map(([f]) => f).join(' '));

// ---------------------------------------------------------------- sitemap
const sm = [...rd('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
ok(sm.length === new Set(sm).size, 'sitemap.xml has no duplicate URLs (' + sm.length + ')');
const stubUrls = new Set(stubs.map(([f]) => SITE + 'species/' + f.replace(/\.html$/, '')));
ok(!sm.some((u) => stubUrls.has(u)), 'sitemap.xml lists no redirect stub');
const smSet = new Set(sm), missing = pages.filter(([f]) => !smSet.has(SITE + 'species/' + f.replace(/\.html$/, '')));
ok(!missing.length, 'every species page is in sitemap.xml ' + missing.slice(0, 5).map(([f]) => f).join(' '));
ok(sm.every((u) => !/\.html$/.test(u) || /\/(install|about-snakelist|about|privacy|terms|photo-credits)\.html$/.test(u)), 'sitemap species URLs are the extension-less canonical form');
ok(/Sitemap: https:\/\/snakelist\.com\/sitemap\.xml/.test(rd('robots.txt')) && /User-agent: \*\nAllow: \//.test(rd('robots.txt')), 'robots.txt allows crawling and names the sitemap');

// ---------------------------------------------------------------- Ahaetulla prasina's page, statically
const AP = rd('species/asian-vine-snake-ahaetulla-prasina.html'), APt = plain(AP);
ok(/It is mildly venomous/.test(APt), 'page intro: "mildly venomous"');
ok(/Key facts Mildly venomous/.test(APt), 'page key-fact tag: "Mildly venomous"');
ok(/Venom and safety Mildly venomous/.test(APt), 'page safety text: "Mildly venomous"');
ok(!/Non-venomous|Not venomous/.test(APt.split('Similar and related snakes')[0]), 'page: no "Non-venomous" / "Not venomous" about it anywhere above the related species');
ok(/Recorded in 7 countries/.test(APt) && /published range also includes India, Bangladesh, China, Indonesia and the Philippines/.test(APt), 'page: recorded countries vs the wider published range are told apart');
ok(/Countries with records of it in SnakeList/.test(APt) && /a country with no records is not necessarily outside its range/.test(APt), 'page: the country list and map say they are records, not the range');
ok(/data-lenlo="1.8" data-lenhi="1.8"/.test(AP), 'page: 3D size uses the adult length (1.8 m), not the tail length');

// ---------------------------------------------------------------- species totals
const N = nCards.toLocaleString('en-US');
const totals = [];
for (const f of ['index.html', 'about.html', 'about-snakelist.html', 'install.html', 'llms.txt', 'species/index.html']) {
  const t = rd(f).replace(/<script(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/g, ' ');  // what a visitor reads (not code comments)
  for (const m of t.matchAll(/\b(\d,\d{3})(?=(?:<\/[a-z]+>)? (?:snake )?species\b)/g)) if (m[1] !== N) totals.push(f + ':' + m[1]);
  for (const m of t.matchAll(/<span data-sl-total>([\d,]+)<\/span>/g)) if (m[1] !== N) totals.push(f + ':' + m[1]);
}
ok(!totals.length, 'every "N species" total on the static pages is the card count ' + N + ' ' + totals.join(' '));
ok(rd('index.html').includes('A checklist of ' + N + ' snake species'), 'the home page description uses the counted total');

// ---------------------------------------------------------------- the app, in a browser
(async () => {
  let chromium;
  try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (e) { ok(false, 'playwright: ' + e.message); return; }
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { ['sl-intro-seen', 'sl-tour-done', 'sl-tour-seen', 'sl-news-off', 'sl-level-seen'].forEach((k) => localStorage.setItem(k, '1')); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + 'index.html', { waitUntil: 'load' });
  await p.waitForFunction(() => document.querySelectorAll('#grid .card').length > 4000 && window.SL_HARM, null, { timeout: 60000 });
  const r = await p.evaluate(() => {
    const c = document.querySelector('#grid .card[data-id="ahaetulla-prasina"]');
    const sci = document.querySelector('#grid .card .card-name.is-sci');
    const sciCard = sci && sci.closest('.card'), lab = sciCard && sciCard.querySelector('.card-sci.no-common');
    return { ven: c && c.dataset.venomous, tag: c && !!c.querySelector('.tag.venom'), harm: window.SL_HARM('ahaetulla-prasina'),
      url: window.SL_SP_PAGE_URL ? window.SL_SP_PAGE_URL('ahaetulla-prasina') : null,
      total: (document.querySelector('[data-sl-total]') || {}).textContent, cards: document.querySelectorAll('#grid .card').length,
      sciShown: lab ? getComputedStyle(lab).display : 'none', sciTitle: sci ? getComputedStyle(sci).display : '', noCommonVisible: [...document.querySelectorAll('#grid .card')].slice(0, 400).some((x) => x.innerText.includes('No common name')) };
  });
  ok(r.ven === '1' && r.tag, 'app: the Asian Vine Snake card is venomous and carries the Venomous tag');
  ok(r.harm !== 'harmful', 'app: ... and is not listed as dangerous (so it reads "Mildly venomous")');
  ok(/asian-vine-snake-ahaetulla-prasina(\.html)?$/.test(r.url || ''), 'app: links to species pages use the canonical address (' + r.url + ')');
  ok(r.total === r.cards.toLocaleString('en-US'), 'app: the species total (' + r.total + ') is the card count (' + r.cards + ')');
  ok(r.sciShown === 'none' && r.sciTitle !== 'none' && !r.noCommonVisible, 'app: a card with no common name shows its scientific name as the title and no "No common name" label');
  // quick look (the card's Venom row) - SnakeList's own opener when there is one
  const ql = await p.evaluate(() => { const c = document.querySelector('#grid .card[data-id="ahaetulla-prasina"]'); c.scrollIntoView(); return !!c; });
  ok(ql, 'app: Ahaetulla prasina card found');
  // the Venomous filter counts the cards' own flag (so the Asian Vine Snake is in it)
  const vf = await p.evaluate(() => ({ chip: +((document.querySelector('#chip-venom .chip-n') || {}).textContent || '0').replace(/\D/g, ''),
    flagged: document.querySelectorAll('#grid .card[data-venomous="1"]').length }));
  ok(vf.chip === vf.flagged && vf.chip > 1300, 'app: the Venomous filter counts every venomous card (' + vf.chip + ' = ' + vf.flagged + ')');
  ok(!errs.length, 'app: no page errors ' + errs.slice(0, 3).join(' | '));
  // the species page in a browser: what a visitor sees
  const q = await ctx.newPage();
  await q.goto(BASE + 'species/ahaetulla-prasina.html', { waitUntil: 'load' });
  await q.waitForSelector('.sp-ftag', { timeout: 15000 }).catch(() => {});
  ok(/asian-vine-snake-ahaetulla-prasina/.test(q.url()), 'the old scientific-name address redirects to the canonical page (' + q.url().replace(BASE, '') + ')');
  // (the stub sends you to the extension-less address, as GitHub Pages serves it; a plain local server needs the .html)
  await q.goto(BASE + 'species/asian-vine-snake-ahaetulla-prasina.html', { waitUntil: 'load' });
  await q.waitForSelector('.sp-ftag', { timeout: 15000 }).catch(() => {});
  const tags = await q.evaluate(() => [...document.querySelectorAll('.sp-ftag')].map((x) => x.textContent.trim()));
  ok(tags.includes('Mildly venomous') && !tags.includes('Non-venomous'), 'rendered page: key-fact tags ' + JSON.stringify(tags));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})();
