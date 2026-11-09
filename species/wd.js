(function(){
var EP='https://query.wikidata.org/sparql?format=json&query=';
function get(u,ms){return new Promise(function(res,rej){var c=window.AbortController?new AbortController():null,t=setTimeout(function(){if(c)c.abort();rej(new Error('timeout'))},ms||10000);
fetch(u,c?{signal:c.signal}:{}).then(function(r){if(!r.ok)throw new Error('http '+r.status);return r.json()}).then(function(j){clearTimeout(t);res(j)},function(e){clearTimeout(t);rej(e)})})}
function yr(s){var m=/^(-?)(\d{1,4})-/.exec(String(s||''));return m?(m[1]?-1:1)*+m[2]:null}
function lit(s){return '"'+String(s).replace(/[\\"]/g,'')+'"'}
// names -> {name: {item, year, people:[{id,label,desc,born,died,nat:[...],img}]}}
function lookup(names){if(!names.length)return Promise.resolve({});if(navigator.onLine===false)return Promise.reject(new Error('offline'));
var q='SELECT ?name ?item ?author ?authorLabel ?authorDescription ?year ?born ?died ?natLabel ?img WHERE { VALUES ?name { '+names.map(lit).join(' ')+' } '+
'?item p:P225 ?st . ?st ps:P225 ?name . OPTIONAL { ?st pq:P574 ?year } OPTIONAL { ?st pq:P405 ?author . OPTIONAL { ?author wdt:P569 ?born } OPTIONAL { ?author wdt:P570 ?died } '+
'OPTIONAL { ?author wdt:P27 ?nat } OPTIONAL { ?author wdt:P18 ?img } } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 400';
return get(EP+encodeURIComponent(q)).then(function(j){var out={};((j&&j.results&&j.results.bindings)||[]).forEach(function(b){function v(k){return b[k]&&b[k].value}
var n=v('name');if(!n)return;var item=(v('item')||'').split('/').pop(),o=out[n];
if(!o||(!o.people.length&&v('author')&&o.item!==item))o=out[n]={item:item,year:null,people:[]};if(o.item!==item)return;
var y=yr(v('year'));if(y&&!o.year)o.year=y;var a=v('author');if(!a)return;var id=a.split('/').pop(),p=o.people.filter(function(x){return x.id===id})[0];
if(!p){p={id:id,label:v('authorLabel')||'',desc:v('authorDescription')||'',born:yr(v('born')),died:yr(v('died')),nat:[],img:''};if(/^Q\d+$/.test(p.label))p.label='';o.people.push(p)}
var nt=v('natLabel');if(nt&&!/^Q\d+$/.test(nt)&&p.nat.indexOf(nt)<0)p.nat.push(nt);var im=v('img');if(im&&!p.img)p.img=im});
for(var k in out)out[k].people=out[k].people.filter(function(p){return p.label});return out})}
function ago(y){var n=new Date().getFullYear()-y;return n>0?n+(n===1?' year':' years')+' ago':''}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function link(h,t){var a=el('a','',t);a.href=h;a.rel='noopener';return a}
function img(u,w){return String(u).replace(/^http:/,'https:').replace(/\?.*$/,'')+'?width='+w}
[].forEach.call(document.querySelectorAll('.sp-ago[data-y]'),function(s){var a=ago(+s.dataset.y);if(a)s.textContent=' ('+a+')'});
window.SLWD={lookup:lookup,ago:ago};
// the species page
var box=document.getElementById('sp-who');
if(box){var sci=box.dataset.sci,auth=box.dataset.auth||'',st=box.querySelector('.sp-who-s'),pp=box.querySelector('.sp-who-p');
lookup([sci]).then(function(R){var r=R[sci];if(!r)return;var y=r.year||+box.dataset.y||null,ppl=r.people;
// a reviewed authority is the one shown: Wikidata's people are only added when they match it
if(auth){var a=auth.toLowerCase();ppl=ppl.filter(function(p){var s=p.label.split(/\s+/).pop().toLowerCase();return s&&a.indexOf(s)>=0})}
if(!auth&&(ppl.length||y)){st.textContent='';st.appendChild(document.createTextNode('First described'+(ppl.length?' by ':'')));
ppl.forEach(function(p,i){if(i)st.appendChild(document.createTextNode(i===ppl.length-1?' and ':', '));st.appendChild(el('b','',p.label))});
if(y){st.appendChild(document.createTextNode(' in '));st.appendChild(el('b','',String(y)));var g=ago(y);if(g)st.appendChild(el('span','sp-ago',' ('+g+')'))}
st.appendChild(document.createTextNode(', according to '));st.appendChild(link('https://www.wikidata.org/wiki/'+r.item,'Wikidata'));st.appendChild(document.createTextNode('.'))}
ppl.forEach(function(p){var c=el('div','sp-person');if(p.img){var i=new Image();i.src=img(p.img,120);i.alt='Portrait of '+p.label;i.width=64;i.height=80;i.loading='lazy';i.onerror=function(){i.remove()};c.appendChild(i)}
var t=el('div','sp-person-t');var h=el('p','sp-person-n');h.appendChild(link('https://www.wikidata.org/wiki/'+p.id,p.label));t.appendChild(h);
if(p.desc)t.appendChild(el('p','sp-person-d',p.desc.charAt(0).toUpperCase()+p.desc.slice(1)));
var b=[];if(p.born)b.push('Born '+p.born);if(p.died)b.push('died '+p.died+(p.born?' (aged about '+(p.died-p.born)+')':''));if(p.nat.length)b.push(p.nat.join(', '));
if(b.length)t.appendChild(el('p','sp-person-m',b.join(' · ')));
if(y&&p.born&&y>p.born&&(!p.died||y<=p.died+60))t.appendChild(el('p','sp-person-m','About '+(y-p.born)+' years old when '+(p.died&&y>p.died?'this name was published':'describing it')+'.'));
c.appendChild(t);pp.appendChild(c)});
if(ppl.length){var s=el('p','sp-note sp-who-src');s.appendChild(document.createTextNode('About the '+(ppl.length>1?'people':'person')+': '));s.appendChild(link('https://www.wikidata.org/wiki/'+r.item,'Wikidata'));
s.appendChild(document.createTextNode(' (CC0)'+(ppl.some(function(p){return p.img})?'; portraits from Wikimedia Commons.':'.')));pp.appendChild(s)}
if(ppl.length||!auth&&y)box.hidden=false}).catch(function(){})}
// region and city pages: the most recorded snakes' describers
[].forEach.call(document.querySelectorAll('.rg-who[data-wd]'),function(ul){var lis=[].filter.call(ul.children,function(li){var s=li.querySelector('.rg-by');return s&&!s.dataset.done});
if(!lis.length)return;lis.forEach(function(li){li.querySelector('.rg-by').textContent='looking it up...'});
lookup(lis.map(function(li){return li.dataset.sci})).then(function(R){lis.forEach(function(li){var s=li.querySelector('.rg-by'),r=R[li.dataset.sci];s.textContent='';
if(!r||(!r.people.length&&!r.year)){s.textContent='not found on Wikidata';s.className='rg-by rg-miss';return}
s.appendChild(document.createTextNode('described'+(r.people.length?' by ':'')));r.people.forEach(function(p,i){if(i)s.appendChild(document.createTextNode(i===r.people.length-1?' and ':', '));
s.appendChild(link('https://www.wikidata.org/wiki/'+p.id,p.label))});if(r.year){s.appendChild(document.createTextNode(' in '+r.year));var g=ago(r.year);if(g)s.appendChild(el('span','sp-ago',' ('+g+')'))}})})
.catch(function(){lis.forEach(function(li){var s=li.querySelector('.rg-by');s.textContent='could not reach Wikidata just now';s.className='rg-by rg-miss'})})});
})();
