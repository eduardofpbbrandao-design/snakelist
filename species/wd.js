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

// v4.80: every dropdown (Sort by, Venom, Family...) opens as a SnakeList panel, not the browser's plain list.
// The real <select> stays (hidden) underneath, so everything that reads or changes it keeps working.
(function(){
if(!document.querySelector||window.__slDd)return;window.__slDd=1;
var st=document.createElement('style');st.textContent=
'.sl-dd{position:relative;display:inline-block;vertical-align:middle;max-width:100%}'+
'.sl-dd>select.sl-dd-native{position:absolute!important;left:0;top:0;width:100%!important;height:100%!important;opacity:0!important;pointer-events:none!important}'+
'.sl-dd-btn{display:inline-flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;text-align:left;max-width:100%;background-image:none!important}'+
'.sl-dd-btn>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
'.sl-dd-btn::after{content:"";flex:none;width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-2px) rotate(45deg);opacity:.75;transition:transform .15s}'+
'.sl-dd-btn[aria-expanded=true]::after{transform:translateY(2px) rotate(-135deg)}'+
'.sl-dd-list{position:absolute;z-index:3000;left:0;top:calc(100% + 6px);min-width:100%;max-width:min(360px,calc(100vw - 24px));max-height:min(340px,60vh);overflow:auto;margin:0;padding:6px;list-style:none;box-sizing:border-box;'+
'background:var(--surface,var(--card,#fbfdf9));color:var(--text,#183020);border:1px solid var(--border,var(--line,#d5e4cf));border-radius:12px;box-shadow:0 12px 32px rgba(10,40,20,.22);font:500 14.5px/1.35 Inter,system-ui,sans-serif}'+
'.sl-dd-list[hidden]{display:none}.sl-dd-up .sl-dd-list{top:auto;bottom:calc(100% + 6px)}.sl-dd-right .sl-dd-list{left:auto;right:0}'+
'.sl-dd-list li{display:flex;align-items:center;gap:8px;padding:8px 12px 8px 10px;border-radius:8px;cursor:pointer;white-space:nowrap}'+
'.sl-dd-list li::before{content:"";flex:none;width:14px;text-align:center;font-weight:700;color:#3f9a45}'+
'.sl-dd-list li[aria-selected=true]{font-weight:650;color:#2e7d4f}.sl-dd-list li[aria-selected=true]::before{content:"\\2713"}'+
'.sl-dd-list li.act{background:rgba(88,179,81,.18)}.sl-dd-list li[aria-disabled=true]{opacity:.45;cursor:default}'+
'[data-sl-theme=dark] .sl-dd-list li[aria-selected=true]{color:#9be07c}@media (prefers-color-scheme:dark){:root:not([data-sl-theme=light]) .sl-dd-list li[aria-selected=true]{color:#9be07c}}';
document.head.appendChild(st);
var n=0;
function enhance(sel){
  if(sel.dataset.slDd||sel.multiple||sel.size>1||sel.closest('.sl-dd'))return;
  if(sel.hidden||sel.getAttribute('aria-hidden')==='true')return;
  sel.dataset.slDd='1';var id='sl-dd-'+(++n);
  var w=document.createElement('span');w.className='sl-dd';sel.parentNode.insertBefore(w,sel);w.appendChild(sel);
  var cs=getComputedStyle(sel),b=document.createElement('button');b.type='button';b.className='sl-dd-btn '+(sel.className||'');
  ['font','color','background-color','border','border-radius','padding','min-height','height','box-shadow','letter-spacing'].forEach(function(k){b.style.setProperty(k,cs.getPropertyValue(k))});
  if(cs.width&&cs.display!=='none'&&sel.offsetWidth)b.style.minWidth=sel.offsetWidth+'px';
  b.setAttribute('aria-haspopup','listbox');b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls',id);
  var lab=sel.getAttribute('aria-label')||(sel.labels&&sel.labels[0]&&sel.labels[0].textContent.trim())||'';if(lab)b.setAttribute('aria-label',lab);
  var txt=document.createElement('span');b.appendChild(txt);
  sel.classList.add('sl-dd-native');sel.tabIndex=-1;sel.setAttribute('aria-hidden','true');
  var list=document.createElement('ul');list.className='sl-dd-list';list.id=id;list.setAttribute('role','listbox');list.hidden=true;
  w.appendChild(b);w.appendChild(list);
  var act=-1;
  function label(){var o=sel.options[sel.selectedIndex];txt.textContent=o?o.text:''}
  function build(){list.innerHTML='';[].forEach.call(sel.options,function(o,i){var li=document.createElement('li');li.setAttribute('role','option');li.textContent=o.text;li.dataset.i=i;li.id=id+'-'+i;
    if(i===sel.selectedIndex)li.setAttribute('aria-selected','true');if(o.disabled)li.setAttribute('aria-disabled','true');list.appendChild(li)})}
  function hi(i){var ls=list.children;if(act>=0&&ls[act])ls[act].classList.remove('act');act=Math.max(0,Math.min(ls.length-1,i));if(ls[act]){ls[act].classList.add('act');b.setAttribute('aria-activedescendant',ls[act].id);var r=ls[act];if(r.offsetTop<list.scrollTop)list.scrollTop=r.offsetTop;else if(r.offsetTop+r.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=r.offsetTop+r.offsetHeight-list.clientHeight}}
  function open(){if(sel.disabled)return;build();list.hidden=false;b.setAttribute('aria-expanded','true');
    var r=w.getBoundingClientRect();w.classList.toggle('sl-dd-up',r.bottom+Math.min(340,list.scrollHeight)+12>innerHeight&&r.top>innerHeight/2);w.classList.toggle('sl-dd-right',r.left+list.offsetWidth>innerWidth-12);
    hi(sel.selectedIndex>=0?sel.selectedIndex:0)}
  function close(){if(list.hidden)return;list.hidden=true;b.setAttribute('aria-expanded','false');b.removeAttribute('aria-activedescendant')}
  function pick(i){var o=sel.options[i];if(!o||o.disabled)return;if(sel.selectedIndex!==i){sel.selectedIndex=i;sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}))}label();close();b.focus()}
  b.addEventListener('click',function(e){e.stopPropagation();list.hidden?open():close()});
  list.addEventListener('mousedown',function(e){e.preventDefault()});
  list.addEventListener('click',function(e){var li=e.target.closest('li');if(li)pick(+li.dataset.i)});
  list.addEventListener('mousemove',function(e){var li=e.target.closest('li');if(li&&+li.dataset.i!==act)hi(+li.dataset.i)});
  b.addEventListener('keydown',function(e){var k=e.key;
    if(k==='ArrowDown'||k==='ArrowUp'){e.preventDefault();if(list.hidden)open();else hi(act+(k==='ArrowDown'?1:-1))}
    else if(k==='Home'&&!list.hidden){e.preventDefault();hi(0)}else if(k==='End'&&!list.hidden){e.preventDefault();hi(list.children.length-1)}
    else if((k==='Enter'||k===' ')&&!list.hidden){e.preventDefault();pick(act)}
    else if(k==='Escape'&&!list.hidden){e.preventDefault();e.stopPropagation();close()}
    else if(k==='Tab')close()});
  document.addEventListener('click',function(e){if(!w.contains(e.target))close()});
  sel.addEventListener('change',label);
  // code that sets .value or .selectedIndex straight on the select: keep the button's text right
  ['value','selectedIndex'].forEach(function(p){var d=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,p);if(d&&d.set)Object.defineProperty(sel,p,{configurable:true,get:function(){return d.get.call(this)},set:function(v){d.set.call(this,v);label()}})});
  new MutationObserver(label).observe(sel,{childList:true,subtree:true,attributes:true,attributeFilter:['selected']});
  label();
}
function scan(root){[].forEach.call((root||document).querySelectorAll('select'),enhance)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){scan()});else scan();
if(window.MutationObserver)new MutationObserver(function(ms){ms.forEach(function(m){[].forEach.call(m.addedNodes,function(nd){if(nd.nodeType!==1)return;if(nd.tagName==='SELECT')enhance(nd);else if(nd.querySelector&&nd.querySelector('select'))scan(nd)})})}).observe(document.documentElement,{childList:true,subtree:true});
})();
