// Run: serve the repo on http://localhost:9017 (python3 -m http.server 9017), then node tests/sightings-empty-search.js
// Needs Playwright with Chromium. iNaturalist is mocked, so it runs offline.
// REGRESSION: an empty search/filter result must never turn the sightings layer into "all snakes"
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:1280,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const obs=[];
 await p.route(/^https?:\/\/(?!localhost)/,r=>{const u=r.request().url();const J=o=>r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
  if(/\/taxa\?/.test(u)){const q=decodeURIComponent(u.match(/q=([^&]+)/)[1]);return J({results:[{id:1000+q.length,name:q}]});}
  if(/\/observations\?/.test(u)){obs.push(u);const all=/taxon_id=85553/.test(u);
   return J({total_results:2,results:[{id:all?7:5,geojson:{coordinates:[100,15]},observed_on:'2024-01-01',taxon:{name:all?'Naja naja':'Python bivittatus'}},{id:all?8:6,geojson:{coordinates:[101,16]},observed_on:'2024-01-01',taxon:{name:all?'Vipera berus':'Python bivittatus'}}]});}
  return r.abort();});
 await p.addInitScript(()=>{localStorage.setItem('sl-consent','essential');localStorage.setItem('sl-tour-seen','1');localStorage.setItem('sl-news-off','1');});
 await p.goto('http://localhost:'+(process.env.PORT||9017)+'/index.html?tab=map',{waitUntil:'load'});await p.waitForFunction(()=>window.SL_MAP_GEO_DONE,null,{timeout:60000}).catch(()=>{});await p.waitForTimeout(2500);
 const state=()=>p.evaluate(()=>({what:(document.getElementById('sg-what')||{}).textContent,note:(document.getElementById('sg-note')||{}).hidden?'':(document.getElementById('sg-note')||{}).textContent}));
 const search=async q=>{await p.fill('#heat-search',q);await p.keyboard.press('Enter');await p.waitForTimeout(2500);};
 await search('Burmese python');
 await p.click('#sg-toggle');await p.waitForTimeout(3000);
 let s=await state();console.log('  python:',JSON.stringify(s));
 ok(/Burmese/i.test(s.what)&&obs.some(u=>/taxon_id=10/.test(u)),'Burmese python: sightings are for that snake');
 // the reported failure
 const n0=obs.length;await search('zzzznotasnake');await p.waitForTimeout(1500);s=await state();console.log('  nonsense:',JSON.stringify(s));
 ok(!/all snakes/.test(s.what),'nonsense search does NOT say "all snakes" ('+s.what+')');
 ok(!obs.slice(n0).some(u=>/taxon_id=85553/.test(u)),'nonsense search does NOT load every snake\'s sightings');
 ok(/No snake matches/.test(s.note),'it explains why there are no dots');
 const dots=await p.evaluate(()=>window.SL_SG_COUNT?window.SL_SG_COUNT():-1);ok(dots===0,'no sighting markers left on the map ('+dots+')');
 // filter combination with zero matches: family Pythonidae + search "cobra"
 await search('cobra');
 await p.evaluate(()=>window.SL_MAPF.fromChecklist(Object.assign(window.SL_CK.blank(),{families:['Pythonidae']})));await p.waitForTimeout(2500);
 s=await state();console.log('  cobra+pythons:',JSON.stringify(s));
 ok(!/all snakes/.test(s.what)&&await p.evaluate(()=>window.SL_SG_COUNT())===0,'search + family filter with no overlap shows no dots');
 // clear the search: filter alone (pythons) -> filtered, not zero
 await search('');s=await state();console.log('  pythons only:',JSON.stringify(s));
 ok(/your filters/.test(s.what),'filter alone: dots are "your filters"');
 // country filter with zero: no snakes in Iceland
 await p.evaluate(()=>window.SL_MAPF.fromChecklist(Object.assign(window.SL_CK.blank(),{countries:['Iceland']})));await p.waitForTimeout(2500);
 s=await state();console.log('  iceland:',JSON.stringify(s));
 ok(!/all snakes/.test(s.what),'country filter with zero snakes is not "all snakes"');
 // nothing selected at all -> all snakes is correct
 await p.evaluate(()=>window.SL_MAPF.fromChecklist(window.SL_CK.blank()));await search('');await p.waitForTimeout(1500);
 s=await state();console.log('  nothing:',JSON.stringify(s));ok(/all snakes/.test(s.what),'no filter and no search: "all snakes"');
 // a place search is not a snake search
 await search('Brazil');s=await state();ok(/all snakes/.test(s.what),'place search (Brazil): all snakes in view');
 console.log('errs',errs);await b.close();})();
