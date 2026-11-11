// Run: build (python3 build-site.py), serve the repo (python3 -m http.server 8917), then node tests/wd-authority.js [port]
// Needs Playwright with Chromium. Wikidata is mocked (it cannot be reached from the build machine), so it runs offline.
// REGRESSION: the Montpellier Snake was credited to "Jean-Herman Faber, 1912"; the authority is (Hermann, 1804).
// wd.js must only show a describer whose surname and year match the taxon's authority, and say
// "Author details not available" when nothing checks out.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const PORT=process.argv[2]||8917, BASE='http://localhost:'+PORT+'/species/';
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
const B=(name,item,o)=>Object.assign({name:{value:name},item:{value:'http://www.wikidata.org/entity/'+item},st:{value:'http://www.wikidata.org/entity/statement/'+item+'-'+(o.st||1)}},
  o.rank?{rank:{value:'http://www.wikidata.org/entity/'+o.rank}}:{}, o.year?{year:{value:o.year+'-01-01T00:00:00Z'}}:{},
  o.author?{author:{value:'http://www.wikidata.org/entity/'+o.author},authorLabel:{value:o.label}}:{}, o.born?{born:{value:o.born+'-01-01T00:00:00Z'}}:{}, o.died?{died:{value:o.died+'-01-01T00:00:00Z'}}:{});
const MAL='Malpolon monspessulanus';
const CASES={
  good:[B(MAL,'Q1',{rank:'Q7432',year:1804,author:'Q70',label:'Johann Hermann',born:1738,died:1800})],
  wrong:[B(MAL,'Q1',{rank:'Q7432',year:1912,author:'Q99',label:'Jean-Herman Faber',born:1880,died:1950})],
  wrongname:[B(MAL,'Q1',{rank:'Q7432',year:1804,author:'Q99',label:'Jean-Herman Faber'})],
  missing:[],
};
async function run(b,page,mock,check){
  const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route(/^https?:\/\/(?!localhost)/,r=>{const u=r.request().url();
    if(/query\.wikidata\.org/.test(u)){const q=decodeURIComponent(u.split('query=')[1]);const names=[...q.matchAll(/"([^"]+)"/g)].map(m=>m[1]);
      const rows=(CASES[mock]||[]).map(x=>names.indexOf(x.name.value)>=0?x:Object.assign({},x,{name:{value:names[0]}}));
      return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({results:{bindings:rows}})});}
    return r.abort();});
  await p.goto(BASE+page,{waitUntil:'load'});await p.waitForTimeout(800);
  await check(p);ok(!errs.length,page+' ['+mock+']: no script errors '+errs.join('|'));await p.close();
}
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const who=p=>p.evaluate(()=>({s:document.querySelector('#sp-who .sp-who-s').textContent,p:document.querySelector('#sp-who .sp-who-p').textContent,prov:(document.getElementById('sp-wdprov')||{}).textContent||'',
    main:document.querySelector('article').textContent}));
  // a species with a checked authority
  await run(b,'montpellier-snake-malpolon-monspessulanus.html','good',async p=>{const w=await who(p);
    ok(/Hermann/.test(w.s)&&/1804/.test(w.s),'good: authority shown ('+w.s.trim()+')');ok(/Johann Hermann/.test(w.p),'good: the matching person is added');ok(/Q1/.test(w.prov),'good: provenance names the Wikidata item, in Sources');});
  await run(b,'montpellier-snake-malpolon-monspessulanus.html','wrong',async p=>{const w=await who(p);
    ok(!/Faber/.test(w.main),'wrong person and year (Faber, 1912): never shown');ok(/Hermann/.test(w.s)&&/1804/.test(w.s),'wrong: the checked authority stays');});
  await run(b,'montpellier-snake-malpolon-monspessulanus.html','wrongname',async p=>{const w=await who(p);ok(!/Faber/.test(w.main),'right year, wrong surname: rejected');});
  await run(b,'montpellier-snake-malpolon-monspessulanus.html','missing',async p=>{const w=await who(p);ok(/Hermann/.test(w.s),'missing: authority still shown');ok(!/Wikidata/.test(w.s),'no implementation message in the main text');});
  // a species without any authority on file
  const NOAUTH='abor-hills-kukri-snake-oligodon-melanozonatus.html';
  await run(b,NOAUTH,'missing',async p=>{const w=await who(p);ok(/Author details not available/.test(w.s),'no authority + nothing found: "Author details not available"');ok(!/not found on Wikidata/i.test(w.main),'no "not found on Wikidata" in the content');});
  await run(b,NOAUTH,'wrong',async p=>{const w=await who(p);ok(/Faber/.test(w.s)&&/1912/.test(w.s),'no authority: a consistent single answer is shown ('+w.s.trim()+')');ok(/Wikidata item Q1/.test(w.prov),'...with its provenance in Sources');});
  // pure checks of the resolver
  const p=await b.newPage();await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());await p.goto(BASE+NOAUTH);await p.waitForTimeout(300);
  const R=await p.evaluate(()=>{const W=window.SLWD;const P=(n,b,d)=>({id:'Q'+n.length,label:n,born:b,died:d,nat:[],img:''});
    return {
      multi:!!W.resolve([{item:'Q5',rank:'Q7432',year:1854,people:[P('André Marie Constant Duméril',1774,1860),P('Gabriel Bibron',1805,1848)]}],'(Duméril, Bibron & Duméril, 1854)'),
      initials:!!W.resolve([{item:'Q6',rank:'Q7432',year:1849,people:[P('Andrew Smith',1797,1872)]}],'(A. Smith, 1849)'),
      yearoff:W.resolve([{item:'Q7',rank:'Q7432',year:1805,people:[P('Johann Hermann',1738,1800)]}],'(Hermann, 1804)'),
      conflict:W.resolve([{item:'Q8',year:1900,people:[P('A B',1850)]},{item:'Q9',year:1910,people:[P('C D',1860)]}],''),
      tooyoung:W.resolve([{item:'Q10',year:1912,people:[P('Jean-Herman Faber',1950)]}],''),
    };});
  ok(R.multi,'several authors with accents match (Duméril, Bibron & Duméril)');ok(R.initials,'an initial before the surname matches (A. Smith)');
  ok(R.yearoff===null,'a different year is rejected');ok(R.conflict===null,'two different answers without an authority: none shown');ok(R.tooyoung===null,'a person born after the year is rejected');
  await b.close();})();
