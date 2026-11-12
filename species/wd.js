(function(){
var EP='https://query.wikidata.org/sparql?format=json&query=';
function get(u,ms){return new Promise(function(res,rej){var c=window.AbortController?new AbortController():null,t=setTimeout(function(){if(c)c.abort();rej(new Error('timeout'))},ms||10000);
fetch(u,c?{signal:c.signal}:{}).then(function(r){if(!r.ok)throw new Error('http '+r.status);return r.json()}).then(function(j){clearTimeout(t);res(j)},function(e){clearTimeout(t);rej(e)})})}
function yr(s){var m=/^(-?)(\d{1,4})-/.exec(String(s||''));return m?(m[1]?-1:1)*+m[2]:null}
function lit(s){return '"'+String(s).replace(/[\\"]/g,'')+'"'}
function norm(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()}
// "(Duméril, Bibron & Duméril, 1854)" -> {names:['dumeril','bibron','dumeril'], year:1854}
function parseAuth(a){a=String(a||'').replace(/[()]/g,'').trim();var m=/^(.*?),?\s*(\d{4})$/.exec(a);if(!m)return null;
var names=m[1].replace(/\bet al\.?/g,'').split(/,|&|\band\b|\bin\b|\bex\b/).map(function(x){x=x.trim().replace(/^([A-Z]\.\s*)+/,'');return norm(x).split(/\s+/).pop()}).filter(Boolean);
return names.length?{names:names,year:+m[2]}:null}
function surname(label){return norm(label).replace(/[^a-z\s'-]/g,' ').trim().split(/\s+/).pop()||''}
// names -> {name: [candidate statements {item, rank, year, people:[{id,label,desc,born,died,nat,img}]}]}
function lookup(names){if(!names.length)return Promise.resolve({});if(navigator.onLine===false)return Promise.reject(new Error('offline'));
var q='SELECT ?name ?item ?st ?rank ?author ?authorLabel ?authorDescription ?year ?born ?died ?natLabel ?img WHERE { VALUES ?name { '+names.map(lit).join(' ')+' } '+
'?item p:P225 ?st . ?st ps:P225 ?name . OPTIONAL { ?item wdt:P105 ?rank } OPTIONAL { ?st pq:P574 ?year } OPTIONAL { ?st pq:P405 ?author . OPTIONAL { ?author wdt:P569 ?born } OPTIONAL { ?author wdt:P570 ?died } '+
'OPTIONAL { ?author wdt:P27 ?nat } OPTIONAL { ?author wdt:P18 ?img } } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 400';
return get(EP+encodeURIComponent(q)).then(parse)}
function parse(j){var out={},by={};((j&&j.results&&j.results.bindings)||[]).forEach(function(b){function v(k){return b[k]&&b[k].value}
var n=v('name');if(!n)return;var item=(v('item')||'').split('/').pop(),sk=n+'|'+(v('st')||item),o=by[sk];
if(!o){o=by[sk]={item:item,rank:(v('rank')||'').split('/').pop(),year:null,people:[]};(out[n]=out[n]||[]).push(o)}
var y=yr(v('year'));if(y&&!o.year)o.year=y;var a=v('author');if(!a)return;var id=a.split('/').pop(),p=o.people.filter(function(x){return x.id===id})[0];
if(!p){p={id:id,label:v('authorLabel')||'',desc:v('authorDescription')||'',born:yr(v('born')),died:yr(v('died')),nat:[],img:''};if(/^Q\d+$/.test(p.label))p.label='';o.people.push(p)}
var nt=v('natLabel');if(nt&&!/^Q\d+$/.test(nt)&&p.nat.indexOf(nt)<0)p.nat.push(nt);var im=v('img');if(im&&!p.img)p.img=im});
for(var k in out)out[k].forEach(function(o){o.people=o.people.filter(function(p){return p.label})});return out}
// the one checked answer {item, year, people}, or null
function resolve(cands,auth){cands=(cands||[]).slice();var A=parseAuth(auth);
if(cands.some(function(c){return c.rank==='Q7432'}))cands=cands.filter(function(c){return !c.rank||c.rank==='Q7432'});
var ok=cands.filter(function(c){if(!c.people.length)return false;
if(A){if(c.year&&c.year!==A.year)return false;return c.people.every(function(p){return A.names.indexOf(surname(p.label))>=0})}
if(!c.year)return false;return c.people.every(function(p){return (!p.born||p.born<c.year-10)&&(!p.died||c.year<=p.died+10)})});
if(!ok.length)return null;
if(!A){var key=function(c){return c.year+':'+c.people.map(function(p){return p.id}).sort().join(',')};if(ok.some(function(c){return key(c)!==key(ok[0])}))return null}
return {item:ok[0].item,year:A?A.year:ok[0].year,people:ok[0].people}}
function ago(y){var n=new Date().getFullYear()-y;return n>0?n+(n===1?' year':' years')+' ago':''}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function link(h,t){var a=el('a','',t);a.href=h;a.rel='noopener';return a}
function img(u,w){return String(u).replace(/^http:/,'https:').replace(/\?.*$/,'')+'?width='+w}
[].forEach.call(document.querySelectorAll('.sp-ago[data-y]'),function(s){var a=ago(+s.dataset.y);if(a)s.textContent=' ('+a+')'});
window.SLWD={lookup:lookup,parse:parse,resolve:resolve,parseAuth:parseAuth,ago:ago};
var NA='Author details not available.';
// the species page
var box=document.getElementById('sp-who');
if(box){var sci=box.dataset.sci,auth=box.dataset.auth||'',st=box.querySelector('.sp-who-s'),pp=box.querySelector('.sp-who-p'),prov=document.getElementById('sp-wdprov');
function pv(nodes){if(!prov)return;prov.textContent='';nodes.forEach(function(n){prov.appendChild(typeof n==='string'?document.createTextNode(n):n)})}
lookup([sci]).then(function(R){var r=resolve(R[sci],auth);
if(!r){if(!auth){st.textContent=NA;st.className='sp-who-s sp-muted'}
pv(['Who described it: ',auth?'the authority '+auth+' (checked by SnakeList). Wikidata had no matching person, so no biography is shown.':'Wikidata gave no answer that passed the checks (matching year and authors), so none is shown.']);return}
var y=r.year,ppl=r.people;
if(!auth){st.textContent='';st.className='sp-who-s';st.appendChild(document.createTextNode('First described by '));
ppl.forEach(function(p,i){if(i)st.appendChild(document.createTextNode(i===ppl.length-1?' and ':', '));st.appendChild(el('b','',p.label))});
st.appendChild(document.createTextNode(' in '));st.appendChild(el('b','',String(y)));var g=ago(y);if(g)st.appendChild(el('span','sp-ago',' ('+g+')'));st.appendChild(document.createTextNode('.'))}
ppl.forEach(function(p){var c=el('div','sp-person');if(p.img){var i=new Image();i.src=img(p.img,120);i.alt='Portrait of '+p.label;i.width=64;i.height=80;i.loading='lazy';i.onerror=function(){i.remove()};c.appendChild(i)}
var t=el('div','sp-person-t');var h=el('p','sp-person-n');h.appendChild(link('https://www.wikidata.org/wiki/'+p.id,p.label));t.appendChild(h);
if(p.desc)t.appendChild(el('p','sp-person-d',p.desc.charAt(0).toUpperCase()+p.desc.slice(1)));
var b=[];if(p.born)b.push('Born '+p.born);if(p.died)b.push('died '+p.died+(p.born?' (aged about '+(p.died-p.born)+')':''));if(p.nat.length)b.push(p.nat.join(', '));
if(b.length)t.appendChild(el('p','sp-person-m',b.join(' · ')));
if(y&&p.born&&y>p.born&&(!p.died||y<=p.died+60))t.appendChild(el('p','sp-person-m',p.died&&y>p.died?'The name was published in '+y+', after the author\'s death.':'About '+(y-p.born)+' years old when describing it.'));
c.appendChild(t);pp.appendChild(c)});
pv(['Who described it: ',auth?'the authority '+auth+'; the '+(ppl.length>1?'people':'person')+' from ':'author and year from ',link('https://www.wikidata.org/wiki/'+r.item,'Wikidata item '+r.item),
' (taxon author and year of the taxon name, CC0)'+(auth?', shown because the surname and year match the authority':', shown because the year and lifetimes agree')+(ppl.some(function(p){return p.img})?'; portraits from Wikimedia Commons.':'.')])}).catch(function(){
if(!auth){st.textContent=NA;st.className='sp-who-s sp-muted'}})}
// region and city pages: the most recorded snakes' describers (when no checked authority is on file)
[].forEach.call(document.querySelectorAll('.rg-who[data-wd]'),function(ul){var lis=[].filter.call(ul.children,function(li){var s=li.querySelector('.rg-by');return s&&!s.dataset.done});
if(!lis.length)return;
function none(s){s.textContent='author details not available';s.className='rg-by rg-miss'}
lookup(lis.map(function(li){return li.dataset.sci})).then(function(R){lis.forEach(function(li){var s=li.querySelector('.rg-by'),r=resolve(R[li.dataset.sci],li.dataset.auth||'');s.textContent='';
if(!r){none(s);return}
s.appendChild(document.createTextNode('described by '));r.people.forEach(function(p,i){if(i)s.appendChild(document.createTextNode(i===r.people.length-1?' and ':', '));
s.appendChild(link('https://www.wikidata.org/wiki/'+p.id,p.label))});s.appendChild(document.createTextNode(' in '+r.year));var g=ago(r.year);if(g)s.appendChild(el('span','sp-ago',' ('+g+')'))})})
.catch(function(){lis.forEach(function(li){none(li.querySelector('.rg-by'))})})});
})();

// v4.70: a long paragraph shows its first lines and a "See more" button (See less to fold it back)
(function(){
if(!document.querySelector||!window.getComputedStyle)return;
var st=document.createElement('style');st.textContent='.sl-clamp:not(.sl-open){max-height:var(--sl-clamp);overflow:hidden;-webkit-mask-image:linear-gradient(#000 55%,transparent);mask-image:linear-gradient(#000 55%,transparent)}'+
'.sl-more-btn{display:inline-flex;align-items:center;gap:4px;margin:2px 0 6px;padding:5px 14px;border:1px solid var(--line,#cfd8cf);border-radius:999px;background:transparent;color:var(--g,#2e7d4f);font:600 14px/1.2 Inter,system-ui,sans-serif;cursor:pointer}'+
'.sl-more-btn:hover{border-color:var(--g,#2e7d4f)}.sl-more-btn:focus-visible{outline:2px solid var(--g,#2e7d4f);outline-offset:2px}';
document.head.appendChild(st);
function lh(p){var c=getComputedStyle(p),v=parseFloat(c.lineHeight);return v||parseFloat(c.fontSize)*1.5||24}
function clamp(p){
if(p.dataset.slMore||p.classList.contains('src')||p.closest('details,nav,footer,figure,table,dialog,.sp-rl,.sl-noclamp'))return;
var h=lh(p);if(!p.offsetHeight||p.scrollHeight<=h*8.5)return;
p.dataset.slMore='1';p.classList.add('sl-clamp');p.style.setProperty('--sl-clamp',Math.round(h*5)+'px');
var b=document.createElement('button');b.type='button';b.className='sl-more-btn';b.textContent='See more';b.setAttribute('aria-expanded','false');
b.addEventListener('click',function(){var o=p.classList.toggle('sl-open');b.textContent=o?'See less':'See more';b.setAttribute('aria-expanded',String(o));if(!o&&p.getBoundingClientRect().top<0)p.scrollIntoView({block:'start'})});
p.parentNode.insertBefore(b,p.nextSibling)}
function run(){[].forEach.call(document.querySelectorAll('main p'),clamp)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
window.addEventListener('load',run);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(run);
var w=document.getElementById('sp-wiki');if(w&&window.MutationObserver)new MutationObserver(run).observe(w,{childList:true});
})();
