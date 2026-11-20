// v5.68 (Eduardo): no text pops up when you rest the mouse on a button or link, on any SnakeList page. A title on a
// button, link or other control (in the page or added later, e.g. by the 3D viewer) is taken off; when the control has
// no words of its own, its text becomes its name for screen readers. The map's own place names (inside the map drawing) stay.
(function(){if(window.__slNoTips)return;window.__slNoTips=1;var H='http://www.w3.org/1999/xhtml';
function fix(el){if(!el||el.nodeType!==1||el.namespaceURI!==H||el.tagName==='IFRAME'||!el.hasAttribute('title'))return;var t=el.getAttribute('title');el.removeAttribute('title');
if(t&&!el.hasAttribute('aria-label')&&!el.hasAttribute('aria-labelledby')&&!(el.textContent||'').trim())el.setAttribute('aria-label',t);}
function sweep(r){if(!r||r.nodeType!==1)return;fix(r);var l=r.querySelectorAll('[title]');for(var i=0;i<l.length;i++)fix(l[i]);}
sweep(document.documentElement);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){sweep(document.documentElement);});
new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var m=ms[i];if(m.type==='attributes')fix(m.target);else for(var j=0;j<m.addedNodes.length;j++)sweep(m.addedNodes[j]);}})
.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['title']});})();
// links back to SnakeList go Back instead of loading it again when SnakeList is the page just before
// this one, so the app comes back instantly, as it was (no reload on iPads/phones). A link that asks
// SnakeList for something (?q= ?fam= ?map= ...) is left in sessionStorage for the app to open once it's back.
(function(){var s=document.currentScript,root,moved=false;try{root=new URL('../',s&&s.src||location.href)}catch(e){return}
function isRoot(u){return u.origin===root.origin&&(u.pathname===root.pathname||u.pathname===root.pathname+'index.html')}
addEventListener('hashchange',function(){moved=true});
document.addEventListener('click',function(e){if(e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||moved)return;
var a=e.target.closest&&e.target.closest('a[href]');if(!a||a.target&&a.target!=='_self'||a.hasAttribute('download'))return;
var u;try{u=new URL(a.href)}catch(x){return}if(!isRoot(u)||u.hash||u.search&&!/^\?([^#]*&)?(map|f|hab|type|fam|q|tab)=/.test(u.search))return;
var r;try{r=new URL(document.referrer)}catch(x){return}if(!isRoot(r)||history.length<2)return;
e.preventDefault();try{if(u.search)sessionStorage.setItem('sl-open-link',JSON.stringify({s:u.search,t:Date.now()}));else sessionStorage.removeItem('sl-open-link')}catch(x){}
var left=false;addEventListener('pagehide',function(){left=true},{once:true});history.back();
setTimeout(function(){if(!left){try{sessionStorage.removeItem('sl-open-link')}catch(x){}location.href=a.href}},700)},true);
document.addEventListener('keydown',function(e){var t=e.target;if(e.key!=='Enter'||e.isComposing||!t||t.tagName!=='INPUT'||t.type!=='search')return;
if(window.matchMedia&&matchMedia('(pointer: coarse)').matches)setTimeout(function(){t.blur()},60)})})();
// v5.68: the small See more under the key tags shows the rest of the checklist's values (and Show less hides them)
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.sp-fmore');if(!b)return;var l=document.getElementById(b.getAttribute('aria-controls'));if(!l)return;
var o=!l.classList.contains('open');l.classList.toggle('open',o);b.setAttribute('aria-expanded',String(o));b.textContent=o?'Show less':'See more';});
// v4.81: ?embed=map shows only the range map (with See states / See cities and the list of countries), for the 3D viewer's "See countries" panel
(function(){if(!/[?&]embed=map(&|$)/.test(location.search))return;var r=document.getElementById('range');if(!r)return;var de=document.documentElement;de.classList.add('sp-embed');
for(var n=r;n&&n!==document.body;n=n.parentNode)[].forEach.call(n.parentNode.children,function(c){if(c!==n&&c.tagName!=='SCRIPT'&&c.tagName!=='TEMPLATE')c.style.display='none'});
var mh=[].filter.call(r.querySelectorAll(':scope>h3'),function(h){return /^Map/.test(h.textContent)})[0];if(mh)for(var k=r.firstElementChild;k&&k!==mh.nextElementSibling;k=k.nextElementSibling)k.style.display='none';
var b=document.createElement('base');b.target='_blank';document.head.appendChild(b);var st=document.createElement('style');
st.textContent='html.sp-embed body>*:not(main){display:none!important}html.sp-embed body{margin:0;padding:8px 10px 12px;min-width:0}html.sp-embed main,html.sp-embed article{margin:0;padding:0;max-width:none;width:auto}html.sp-embed #range{margin:0;padding:0;border:0;box-shadow:none;background:none}html.sp-embed #range>h2{font-size:17px;margin:0 0 6px}html.sp-embed #range h3{margin:10px 0 4px}html.sp-embed .sp-map{max-height:none}';
document.head.appendChild(st)})();
(function(){function nf(t){if(!t||t.tagName!=='IMG'||t.dataset.nf)return;if(t.dataset.fb){var fb=t.dataset.fb;t.removeAttribute('data-fb');t.src=fb;return}t.dataset.nf=1;var d=document.createElement('span');d.className='sl-nophoto';d.setAttribute('role','img');d.setAttribute('aria-label',t.alt||'Photo unavailable');d.textContent='Photo unavailable';if(t.width&&t.height)d.style.aspectRatio=t.width+'/'+t.height;t.replaceWith(d)}
window.addEventListener('error',function(e){nf(e.target)},true);[].forEach.call(document.images,function(i){if(i.complete&&!i.naturalWidth&&i.getAttribute('src'))nf(i)})})();
(function(){
var m=document.querySelector('.sp-map');
if(m){fetch('world.svg').then(function(r){if(!r.ok)throw 0;return r.text()}).then(function(t){m.innerHTML=t;var s=m.querySelector('svg'),NS='http://www.w3.org/2000/svg';
s.removeAttribute('width');s.removeAttribute('height');s.setAttribute('preserveAspectRatio','xMidYMid meet');s.setAttribute('aria-hidden','true');
[['intro','in'],['codes','on']].forEach(function(a){(m.dataset[a[0]]||'').split(' ').forEach(function(c){var p=c&&s.getElementById('c-'+c);if(p){p.setAttribute('class',a[1]);s.appendChild(p)}})});var mk=document.createComment('states');s.appendChild(mk);
var tp=document.querySelector('template.sp-ishapes');if(tp&&tp.innerHTML.trim()){var g=new DOMParser().parseFromString('<svg xmlns="'+NS+'">'+tp.innerHTML+'</svg>','image/svg+xml').documentElement;[].slice.call(g.childNodes).forEach(function(n){s.appendChild(document.importNode(n,true))})}
var dots=[];(m.dataset.dots||'').split(' ').forEach(function(d){var q=d.split(',');if(q.length<3)return;var c=document.createElementNS(NS,'circle');c.setAttribute('cx',q[0]);c.setAttribute('cy',q[1]);c.setAttribute('class',q[2]);c._s=+q[3]||0;s.appendChild(c);dots.push(c)});
var W=1440,HH=720,V=function(a){return(a||'0 0 1440 720').split(' ').map(Number)},f=V(m.dataset.view),v={x:0,y:0,w:W,h:HH},minW=Math.max(80,f[2]),maxW=W,A=.5;
function asp(){var w=m.clientWidth,h=m.clientHeight;A=w&&h?h/w:.5}
function draw(){asp();v.w=Math.min(maxW,Math.max(minW,v.w));v.h=v.w*A;
if(v.h>HH&&v.w>=maxW){v.x=0;v.y=(HH-v.h)/2}else{v.x=Math.min(W-v.w,Math.max(0,v.x));v.y=v.h>=HH?(HH-v.h)/2:Math.min(HH-v.h,Math.max(0,v.y))}
s.setAttribute('viewBox',v.x+' '+v.y+' '+v.w+' '+v.h);var k=v.w/Math.max(1,m.clientWidth);dots.forEach(function(c){c.setAttribute('r',(4*k).toFixed(3));c.style.display=c._s/k>12?'none':''})}
function fit(){asp();var w=f[2],h=f[3],cx=f[0]+w/2,cy=f[1]+h/2;if(h>w*A)w=h/A;w=Math.min(maxW,Math.max(minW,w));v.w=w;v.h=w*A;v.x=cx-w/2;v.y=cy-v.h/2;draw()}
var rw=m.clientWidth;window.addEventListener('resize',function(){if(m.clientWidth!==rw){rw=m.clientWidth;fit()}});fit();
var sb=document.querySelector('.sp-stbtn'),sl=document.querySelector('.sp-states'),sg=null,off=[],busy=0,st=[];try{st=JSON.parse(m.dataset.st||'[]')}catch(e){}
if(sb)sb.addEventListener('click',function(){if(busy)return;var on=!sg;
if(!on){sg.remove();sg=null;[].forEach.call(document.querySelectorAll('.sp-inat'),function(e){e.remove()});var sh=document.querySelector('.sp-shade');if(sh)sh.remove();off.forEach(function(p){p[0].setAttribute('class',p[1])});off=[];f=V(m.dataset.view);fit();done(0);return}
busy=1;Promise.all(st.map(function(x){return fetch('prov/'+x[0]+'.json').then(function(r){return r.ok?r.json():{}}).catch(function(){return{}})})).then(function(J){busy=0;
sg=document.createElementNS(NS,'g');var mx=1,mn=1e9;st.forEach(function(x){if(x[1]==='on')(x[3]||[]).forEach(function(k){if(k>mx)mx=k;if(k<mn)mn=k})});if(mn>mx)mn=mx;
st.forEach(function(x,i){var n=0;x[2].forEach(function(nm,j){var d=J[i][nm];if(!d)return;var p=document.createElementNS(NS,'path');p.setAttribute('d',d);p.setAttribute('class',x[1]);
var k=(x[3]||[])[j]||0;if(x[1]==='on'&&mx>mn){var t=Math.sqrt((k-mn)/(mx-mn)),a=[184,226,170],b=[31,92,40];p.style.fill='rgb('+a.map(function(v,q){return Math.round(v+(b[q]-v)*t)}).join(',')+')'}
var tt=document.createElementNS(NS,'title');tt.textContent=((x[4]||[])[j]||nm).replace(/ \(\d+\)$/,'')+(k?': '+k+' snake species live here':'');p.appendChild(tt);sg.appendChild(p);n++});
var c=n&&s.getElementById('c-'+x[0]);if(c&&c.getAttribute('class')){off.push([c,c.getAttribute('class')]);c.removeAttribute('class')}});
s.insertBefore(sg,mk.nextSibling);f=V(m.dataset.sview);fit();done(1);
inat();var lg=document.querySelector('.sp-legend');if(lg&&mx>mn&&!document.querySelector('.sp-shade')){var e=document.createElement('span');e.className='sp-shade';e.innerHTML='<i class="sp-ramp"></i>Lighter: fewer snake species live there · darker: more';lg.appendChild(e)}})});
// countries with no state data on record: their states come from where it has actually been
// seen - iNaturalist's verified wild sightings, each one placed in the state it falls in
var ns=[];try{ns=JSON.parse(m.dataset.ns||'[]')}catch(e){}
function inat(){if(!ns.length||!sg)return;var sci=(document.querySelector('.sp-main')||{dataset:{}}).dataset.sci,my=sg,q=ns.slice(0,40),i=0,live=0,got=[];
var ul=sl&&sl.querySelector('.sp-where'),note=document.createElement('p');note.className='sp-note sp-inat';note.textContent='Looking up where it has been seen on iNaturalist...';if(sl)sl.appendChild(note);
function fin(){if(live||i<q.length)return;if(!got.length)note.textContent='No iNaturalist sightings to place in the other countries yet - they stay shaded whole.';else note.textContent='States and provinces marked from verified wild sightings on iNaturalist.'}
function one(){if(sg!==my)return;if(i>=q.length){fin();return}var x=q[i++];live++;
Promise.all([fetch('prov/'+x[0]+'.json').then(function(r){return r.ok?r.json():{}}),fetch('https://api.inaturalist.org/v1/observations?taxon_name='+encodeURIComponent(sci)+'&verifiable=true&captive=false&per_page=200&swlng='+x[1]+'&nelng='+x[2]+'&swlat='+x[3]+'&nelat='+x[4]).then(function(r){return r.ok?r.json():{}})]).then(function(R){live--;if(sg!==my)return;
var P=R[0]||{},pts=((R[1]||{}).results||[]).map(function(o){return o.geojson&&o.geojson.coordinates}).filter(Boolean),g=document.createElementNS(NS,'g'),names=[];
if(pts.length){sg.appendChild(g);Object.keys(P).forEach(function(nm){var p=document.createElementNS(NS,'path');p.setAttribute('d',P[nm]);p.setAttribute('class','on');g.appendChild(p);var k=0;
pts.forEach(function(c){var pt=s.createSVGPoint();pt.x=(c[0]+180)*4;pt.y=(90-c[1])*4;if(p.isPointInFill(pt))k++});
if(!k){p.remove();return}var nm2=nm.replace(/ \(\d+\)$/,''),t=document.createElementNS(NS,'title');t.textContent=nm2+': seen '+k+(k===1?' time':' times')+' on iNaturalist';p.appendChild(t);names.push(nm2)});
if(names.length){var c=s.getElementById('c-'+x[0]);if(c&&c.getAttribute('class')){off.push([c,c.getAttribute('class')]);c.removeAttribute('class')}got.push(x[5]);
if(ul){var li=document.createElement('li');li.className='sp-inat';li.innerHTML='<b></b> <span></span> <small class="sp-n">from iNaturalist sightings</small>';li.firstChild.textContent=x[5]+':';li.children[1].textContent=names.sort().join(', ');ul.appendChild(li)}}else g.remove()}
one();fin()},function(){live--;one();fin()})}
one();one();one()}
function done(o){sb.textContent=o?'Hide states & provinces':'Show states & provinces';sb.setAttribute('aria-pressed',o?'true':'false')}
var cz=null,cb=document.querySelector('.sp-ctbtn'),cl=document.querySelector('.sp-cities'),cg=null,cs=[];try{cs=JSON.parse(m.dataset.cities||'[]')}catch(e){}
if(cb)cb.addEventListener('click',function(){var on=!cg;
if(!on){cg.remove();cg=null;if(cz){f=cz[0];minW=cz[1];cz=null;fit()}}else{
if(cs.length){var X=cs.map(function(c){return(c[1]+180)*4}),Y=cs.map(function(c){return(90-c[0])*4}),x0=Math.min.apply(0,X),x1=Math.max.apply(0,X),y0=Math.min.apply(0,Y),y1=Math.max.apply(0,Y),
bw=Math.max((x1-x0)*1.5,110),bh=Math.max((y1-y0)*1.5,55);cz=[f,minW];f=[(x0+x1)/2-bw/2,(y0+y1)/2-bh/2,bw,bh];minW=Math.min(minW,110);fit()}
cg=document.createElementNS(NS,'g');var k=v.w/Math.max(1,m.clientWidth);cs.forEach(function(c){var d=document.createElementNS(NS,'circle');d.setAttribute('cx',((c[1]+180)*4).toFixed(1));d.setAttribute('cy',((90-c[0])*4).toFixed(1));d.setAttribute('r',(4.5*k).toFixed(2));d.setAttribute('class','ct');var t=document.createElementNS(NS,'title');t.textContent=c[2];d.appendChild(t);
// v4.80: click a city to see its name on the map
d.addEventListener('click',function(ev){ev.stopPropagation();var old=cg.querySelector('text.ctl');if(old)old.remove();[].forEach.call(cg.querySelectorAll('circle.on'),function(x){x.classList.remove('on')});d.classList.add('on');
var lb=document.createElementNS(NS,'text');lb.setAttribute('class','ctl');lb.setAttribute('x',(+d.getAttribute('cx')+7*k).toFixed(1));lb.setAttribute('y',(+d.getAttribute('cy')+4*k).toFixed(1));lb.setAttribute('font-size',(13*k).toFixed(2));lb.setAttribute('stroke-width',(3.5*k).toFixed(2));lb.textContent=c[2];cg.appendChild(lb)});cg.appendChild(d)});s.appendChild(cg)}
cb.textContent=on?'Hide cities':'See cities';cb.setAttribute('aria-pressed',on?'true':'false');if(cl)cl.classList.toggle('sp-open',on)});
}).catch(function(){})}
[].forEach.call(document.querySelectorAll('.sp-all[data-all]'),function(b){b.addEventListener('click',function(){var l=b.previousElementSibling,o=!l.classList.contains('sp-open');l.classList.toggle('sp-open',o);b.textContent=o?'Show less':b.dataset.all;b.setAttribute('aria-expanded',o?'true':'false')})});
var im=document.querySelector('.sp-photo img');
if(im){im.style.cursor='zoom-in';im.addEventListener('click',function(){var o=document.createElement('div');o.className='sp-lb';o.setAttribute('role','dialog');
var big=new Image();big.alt=im.alt;big.src=im.src.replace('/medium.','/original.');big.onerror=function(){big.onerror=null;big.src=im.src.replace('/medium.','/large.')};
var x=document.createElement('button');x.type='button';x.className='sp-lb-x';x.textContent='×';x.setAttribute('aria-label','Close');
o.appendChild(big);o.appendChild(x);document.body.appendChild(o);function close(){o.remove();document.removeEventListener('keydown',k)}function k(e){if(e.key==='Escape')close()}
o.addEventListener('click',function(e){if(e.target!==big)close()});document.addEventListener('keydown',k)})}
// no photo built in: find one now - its best sighting marked Alive (never a dead snake), else
// iNaturalist's photo of the species, else its Wikipedia picture (never a map, range map or drawing)
var nf=document.querySelector('.sp-nophoto'),sm=document.querySelector('.sp-main[data-sci]');
if(nf&&sm){var sci=sm.dataset.sci,API='https://api.inaturalist.org/v1/';
function bad(u){var f='';try{f=decodeURIComponent(String(u).split('?')[0].split('/').pop())}catch(e){f=String(u)}return !u||/map|range|distrib|locat|verbreit|carte|mapa|karte|areal|zone|world|globe/i.test(f)||(/wiki(pedia|media)/.test(u)&&/\.(svg|png|gif)\b/i.test(f))}
function J(u){return fetch(u).then(function(r){return r.ok?r.json():null})}
function show(url,credit,via){if(!url||bad(url))return false;var f=document.createElement('figure');f.className='sp-photo';
var i=new Image();i.src=url;i.alt='Photo of '+sci;i.width=500;i.height=333;var c=document.createElement('figcaption');c.textContent='Photo: '+credit+', via '+via;
f.appendChild(i);f.appendChild(c);nf.replaceWith(f);return true}
J(API+'taxa?per_page=10&is_active=true&q='+encodeURIComponent(sci)).then(function(d){
var t=d&&(d.results||[]).filter(function(x){return (x.name||'').toLowerCase()===sci.toLowerCase()})[0];
return (t?J(API+'observations?photos=true&quality_grade=research&term_id=17&term_value_id=18&order_by=votes&per_page=3&taxon_id='+t.id):Promise.resolve(null)).then(function(o){
var r=o&&(o.results||[]).filter(function(x){return x.photos&&x.photos[0]})[0];
if(r&&show(r.photos[0].url.replace('/square.','/medium.'),(r.photos[0].attribution||'iNaturalist').replace(/^\(c\)\s*/i,''),'iNaturalist'))return true;
if(t&&t.default_photo&&show((t.default_photo.medium_url||t.default_photo.url),(t.default_photo.attribution||'iNaturalist').replace(/^\(c\)\s*/i,''),'iNaturalist'))return true;
return J('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(sci.replace(/ /g,'_'))).then(function(w){
var img=w&&(w.originalimage||w.thumbnail);if(img&&!bad(img.source)&&w.thumbnail)show(w.thumbnail.source,'Wikipedia','Wikipedia')})})}).catch(function(){})}
var main=document.querySelector('.sp-main[data-sci]'),w=document.getElementById('sp-wiki');
if(main&&w){fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(main.dataset.sci.replace(/ /g,'_'))).then(function(r){return r.ok?r.json():null}).then(function(d){
if(!d||!d.extract||d.type==='disambiguation')return;var p=document.createElement('p');p.textContent=d.extract;w.appendChild(p);
var s=document.createElement('p');s.className='src';s.innerHTML='From <a href="'+d.content_urls.desktop.page+'" rel="noopener" target="_blank">Wikipedia</a> (CC BY-SA)';w.appendChild(s)}).catch(function(){})}
})();// a numbered citation, or a link to a place inside closed details (references, states): open it first
function opn(h){var t=h&&h.charAt(0)==='#'&&document.getElementById(h.slice(1));if(!t)return;for(var e=t.parentNode;e&&e!==document;e=e.parentNode)if(e.tagName==='DETAILS')e.open=true}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^="#"]');if(a)opn(a.getAttribute('href'))});opn(location.hash);

(function(){var b=document.querySelector('.sp-realbtn'),m=document.querySelector('.sp-main[data-sci]');if(!b||!m)return;
var sci=m.dataset.sci,sid=m.dataset.id,name=(document.querySelector('h1')||{}).textContent||sci,dlg=null,me=document.currentScript&&document.currentScript.src||location.href;
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function lic(c){c=String(c||'').toLowerCase();return c==='cc0'?'CC0':c.replace(/^cc-/,'CC ').toUpperCase()}
function size(){var lo=+m.dataset.lenlo,hi=+m.dataset.lenhi;if(!hi)return null;var W=340,P=1.7,s=Math.min((W-40)/(hi+0.55),74),NS='http://www.w3.org/2000/svg',ph=P*s,H=Math.max(ph+46,128),g=H-26;
var svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('role','img');
svg.setAttribute('aria-label',name+': about '+rng(lo,hi)+' long, next to a person 1.70 m tall');
function a(t,o,p){var e=document.createElementNS(NS,t);for(var k in o)e.setAttribute(k,o[k]);(p||svg).appendChild(e);return e}
var px=14+0.2*s,hr=Math.max(3,0.11*s),x0=px+0.2*s+18,th=Math.max(5,Math.min(12,0.06*s)),y=g-th/2-1;
a('line',{x1:6,y1:g,x2:W-6,y2:g,'class':'gr'});
a('circle',{cx:px,cy:g-ph+hr,r:hr,'class':'pp'});a('path',{d:'M'+(px-0.2*s)+' '+g+'L'+(px-0.13*s)+' '+(g-ph*0.52)+'L'+(px-0.2*s)+' '+(g-ph*0.82)+'Q'+px+' '+(g-ph*0.9)+' '+(px+0.2*s)+' '+(g-ph*0.82)+'L'+(px+0.13*s)+' '+(g-ph*0.52)+'L'+(px+0.2*s)+' '+g+'Z','class':'pp'});
var t=a('text',{x:px,y:g+16,'text-anchor':'middle'});t.textContent='1.70 m';
var st=[0.1,0.25,0.5,1,2].filter(function(v){return v*s>=34})[0]||2;
for(var v=0;v<=hi+1e-9;v+=st){a('line',{x1:x0+v*s,y1:g,x2:x0+v*s,y2:g+4,'class':'gr'});var tk=a('text',{x:x0+v*s,y:g+16,'text-anchor':'middle','class':'tk'});tk.textContent=v?fmt(v):'0'}
function body(L,c){var hl=Math.min(th*1.7,L/3),tl=Math.min(L*0.35,th*6),h=th/2;if(L<th*2)return a('rect',{x:x0,y:y-h,width:Math.max(L,1),height:th,rx:h,'class':c});
return a('path',{d:'M'+x0+' '+y+'L'+(x0+tl)+' '+(y-h)+'L'+(x0+L-hl)+' '+(y-h)+'C'+(x0+L-hl*0.4)+' '+(y-h*1.5)+' '+(x0+L)+' '+(y-h)+' '+(x0+L)+' '+y+'C'+(x0+L)+' '+(y+h)+' '+(x0+L-hl*0.4)+' '+(y+h*1.5)+' '+(x0+L-hl)+' '+(y+h)+'L'+(x0+tl)+' '+(y+h)+'Z','class':c})}
if(hi>lo)body(hi*s,'sn2');body(lo*s,'sn');if(lo*s>=th*2)a('circle',{cx:x0+lo*s-Math.min(th*1.7,lo*s/3)*0.45,cy:y-th*0.18,r:Math.max(1,th*0.13),'class':'eye'});
var t2=a('text',{x:Math.min(Math.max(x0+hi*s/2,x0+30),W-50),y:y-th/2-7,'text-anchor':'middle','class':'ln'});t2.textContent=rng(lo,hi);
return svg}
function photo3d(){var pf=document.querySelector('.sp-photo img'),pc=document.querySelector('.sp-photo figcaption');if(!pf)return null;var fb=pf.getAttribute('data-fb');return{src:pf.currentSrc||pf.src,fb:fb?new URL(fb,location.href).href:'',alt:pf.alt,credit:pc?pc.innerHTML:''}}
function fmt(v){return v<1?Math.round(v*100)+' cm':(Math.round(v*100)/100)+' m'}
function rng(lo,hi){if(lo===hi)return fmt(hi);if(lo>=1)return (Math.round(lo*100)/100)+'–'+fmt(hi);if(hi<1)return Math.round(lo*100)+'–'+fmt(hi);return fmt(lo)+'–'+fmt(hi)}
// the model profiles and the viewer code are fetched only when the viewer is opened
var models=null,modP=null,viewer=null,tabs,p3d,pph,host,about,note,stat,grid,got=0,busy=0,toTop=0;
function getModels(){if(models)return Promise.resolve(models);return fetch(new URL('3d/models.json',me).href).then(function(r){if(!r.ok)throw new Error('models '+r.status);return r.json()}).then(function(d){models=d;return d})}
var tries=0;function getViewer(){if(!modP){var imp,q=tries++?'?r='+tries:'';try{imp=new Function('u','return import(u)')}catch(e){return Promise.reject(e)}
modP=Promise.all([imp(new URL('3d/three.module.min.js'+q,me).href),imp(new URL('3d/viewer.js'+q,me).href)]).then(function(r){r[1].useThree(r[0]);return r[1]}).catch(function(e){modP=null;throw e})}return modP}
function gl(){try{var c=document.createElement('canvas');return !!(window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl')))}catch(e){return false}}
function open(){if(!dlg)build();if(dlg.showModal){if(!dlg.open)dlg.showModal()}else dlg.setAttribute('open','');document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';start()}
function close(){if(dlg.close)dlg.close();else{dlg.removeAttribute('open');closed()}}
function closed(){document.documentElement.style.overflow='';document.body.style.overflow='';if(viewer){viewer.dispose();viewer=null}busy=0;
if(toTop){toTop=0;try{b.focus({preventScroll:true})}catch(e){}window.scrollTo(0,0)}else b.focus();if(location.hash==='#real')history.replaceState(null,'',location.pathname+location.search)}
// the 3D tab is folded away, not hidden (display:none), while Information shows: the viewer keeps its size, so
// nothing resizes or refits the camera, and the snake is seen from the same angle and zoom on coming back
function pick(which){var is3=which==='3d';tabs[0].setAttribute('aria-selected',is3);tabs[1].setAttribute('aria-selected',!is3);tabs[0].tabIndex=is3?0:-1;tabs[1].tabIndex=is3?-1:0;
p3d.classList.toggle('sp-rl-off',!is3);if(is3)p3d.removeAttribute('aria-hidden');else p3d.setAttribute('aria-hidden','true');if('inert' in p3d)p3d.inert=!is3;pph.hidden=is3;if(!is3)load()}
function msg(t,retry,photos){host.innerHTML='';var d=el('div','sp3d-msg');d.setAttribute('role','alert');d.appendChild(el('p','',t));if(retry){var r=el('button','sp-btn sp-btn2','Retry');r.type='button';r.addEventListener('click',start);d.appendChild(r)}
if(photos){var q=el('button','sp-btn sp-btn2','See information instead');q.type='button';q.addEventListener('click',function(){pick('ph');tabs[1].focus()});d.appendChild(q)}host.appendChild(d)}
function start(){if(viewer||busy)return;busy=1;host.innerHTML='';var ld=el('div','sp3d-msg sp3d-loading');ld.setAttribute('role','status');ld.appendChild(el('span','sp3d-spin'));ld.appendChild(el('p','','Loading\u2026'));host.appendChild(ld);
getModels().then(function(d){var p=d&&d.species&&d.species[sid];
if(!p){busy=0;nomodel();return}
fillAbout(p);
if(!gl()){busy=0;msg('This browser or device cannot show 3D graphics (WebGL is turned off or not supported), so the 3D model cannot be shown. The information about it is still there.',false,true);return}
return getViewer().then(function(mod){if(!dlg.open&&!dlg.hasAttribute('open')){busy=0;return}host.innerHTML='';
try{viewer=mod.mount(host,{profile:p,id:sid,name:name,testing:!!window.SL_3D_TEST,head:document.getElementById('sp-rl-h'),photo:photo3d,mapUrl:location.pathname+'?embed=map',len:{lo:+m.dataset.lenlo||0,hi:+m.dataset.lenhi||0,txt:m.dataset.lentxt||'',src:m.dataset.lensrc||''}});anat()}catch(e){viewer=null;busy=0;msg(e&&e.message==='webgl'?'The 3D view could not start on this device (WebGL is not available). The information about it is still there.':'The 3D view could not start.',true,true);return}busy=0})})
.catch(function(){busy=0;msg(navigator.onLine===false?'You seem to be offline, and the 3D viewer has not been downloaded yet.':'The 3D viewer could not be loaded just now.',true,true)})}
function nomodel(){tabs[0].parentNode.hidden=true;p3d.hidden=true;pph.hidden=false;note.hidden=false;load()}
function fillAbout(p){if(about.dataset.done)return;about.dataset.done=1;var s=el('summary','','About this model and its sources');about.appendChild(s);
if(p.auto){var x=p.auto.x||'';about.appendChild(el('p','',x.indexOf('f')>=0?'A reconstruction of how this fossil snake may have looked alive: built like its closest living relatives (body, head, scales, colours and markings), at the size estimated from its fossil bones. Fossils keep no colour, so the colours are those of its living relatives.':'A model generated by SnakeList: the body shape, head and scales of its family, '+(x.indexOf('l')>=0?'a typical size for its group, ':'its recorded size, ')+(x.indexOf('g')>=0?'and colours that are a guess for its group (SnakeList has no photo of it yet).':'and colours and markings taken from its SnakeList photo and its name.')+' It is not a scan of a real snake, and individual snakes vary.'));return}
about.appendChild(el('p','','A reconstruction built by SnakeList from the sources below: body proportions, head shape, scale rows and keels, colours and markings of a typical adult. It is not a scan of a real snake, and individual snakes vary.'));
if(p.scene&&p.scene.basis)about.appendChild(el('p','','Surroundings: '+p.scene.basis));var ul=el('ul');(p.refs||[]).forEach(function(r){var li=el('li'),a=el('a','',r.t);a.href=r.acct?'#sources':r.u;if(!r.acct){a.rel='noopener';a.target='_blank'}else a.addEventListener('click',close);li.appendChild(a);ul.appendChild(li)});about.appendChild(ul)}
function build(){var D={};try{var dn=document.querySelector('.sp-info-data');if(dn)D=JSON.parse(dn.textContent)||{}}catch(e){D={}}
dlg=el('dialog','sp-rl');dlg.setAttribute('aria-labelledby','sp-rl-h');var inn=el('div','sp-rl-in'),hd=el('div','sp-rl-hd'),h=el('h2','','');h.appendChild(el('span','sp-rl-nm',name));if(D.sci&&D.sci!==name){h.appendChild(document.createTextNode(' '));h.appendChild(el('i','sp-rl-sci',D.sci))}h.id='sp-rl-h';
var x=el('button','sp-rl-x','×');x.type='button';x.setAttribute('aria-label','Close');x.addEventListener('click',close);hd.appendChild(h);hd.appendChild(x);inn.appendChild(hd);
var tl=el('div','sp-rl-tabs');tl.setAttribute('role','tablist');tl.setAttribute('aria-label','View');tabs=[el('button','sp-rl-tab','3D model'),el('button','sp-rl-tab','Information')];
tabs.forEach(function(t,i){t.type='button';t.setAttribute('role','tab');t.id='sp-rl-t'+i;t.setAttribute('aria-controls','sp-rl-p'+i);t.addEventListener('click',function(){pick(i?'ph':'3d')});
t.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();var j=1-i;pick(j?'ph':'3d');tabs[j].focus()}});tl.appendChild(t)});inn.appendChild(tl);
p3d=el('section','sp-rl-p');p3d.id='sp-rl-p0';p3d.setAttribute('role','tabpanel');p3d.setAttribute('aria-labelledby','sp-rl-t0');host=el('div','sp3d-host');p3d.appendChild(host);about=el('details','sp3d-about');p3d.appendChild(about);inn.appendChild(p3d);
pph=el('section','sp-rl-p');pph.id='sp-rl-p1';pph.setAttribute('role','tabpanel');pph.setAttribute('aria-labelledby','sp-rl-t1');pph.hidden=true;
note=el('p','sp3d-none','No accurate 3D model of this snake exists yet. SnakeList only shows a 3D model when it can be built from reliable descriptions and photos of the species, so here is what SnakeList knows about it instead.');note.hidden=true;pph.appendChild(note);
var top=el('div','sp-rl-top'),c2=el('div','sp-rl-sum');
var pf=document.querySelector('.sp-photo img'),pc=document.querySelector('.sp-photo figcaption');if(pf){var f0=el('figure','sp-rl-own'),im=new Image();im.src=pf.getAttribute('data-fb')||pf.src;im.alt=pf.alt;im.width=540;im.height=360;f0.appendChild(im);if(pc)f0.appendChild(pc.cloneNode(true));top.appendChild(f0)}else top.className+=' sp-rl-top1';
top.appendChild(c2);pph.appendChild(top);info(c2,top,pph,D);
var fb=el('div','sp-rl-fullrow'),fu=el('button','sp-btn sp-rl-full','Read the full page about '+(D.sci?'the ':'')+name);fu.type='button';fu.addEventListener('click',function(){toTop=1;close()});fb.appendChild(fu);
fb.appendChild(el('span','sp-note','with every fact’s sources listed.'));pph.appendChild(fb);
inn.appendChild(pph);pick('3d');
dlg.appendChild(inn);document.body.appendChild(dlg);dlg.addEventListener('click',function(e){if(e.target===dlg)close()});dlg.addEventListener('close',closed)}
function load(){}
// the Information tab: only what this page already says (the data block written with the page)
// (the page's data block: desc, quick [[key, label, text]], fun, rec [{t, l?}], recsrc, more [{id, h, p, src}] -
// written by build_species.py; anything without data is simply not there)
function srcs(w,L){if(!L||!L.length)return;var p=el('p','sp-rl-src',L.length>1?'Sources: ':'Source: ');L.forEach(function(s,i){if(i)p.appendChild(document.createTextNode(', '));if(s[1]){var a=el('a','',s[0]);a.href=s[1];a.rel='noopener';a.target='_blank';p.appendChild(a)}else p.appendChild(document.createTextNode(s[0]))});w.appendChild(p)}
function para(x,tag){var p=el(tag||'p');if(x.l)p.appendChild(el('b','',x.l+(/\?$/.test(x.l)?' ':': ')));p.appendChild(document.createTextNode(x.t));return p}
var nMore=0;
function info(w,top,box,D){if(D.desc)w.appendChild(el('p','sp-rl-desc',D.desc));
if(D.limited)w.appendChild(el('p','sp-note','Little is known about this species: only a few published studies describe it.'));
if(D.quick&&D.quick.length){var dl=el('dl','sp-rl-q');D.quick.forEach(function(q){var d=el('div','sp-rl-q-'+q[0]),dd=el('dd','',q[2]);d.appendChild(el('dt','',q[1]));
// the size picture right beside the length it shows (only for a length from a reviewed account)
var sv=q[0]==='len'&&size();if(sv){var f=el('figure','sp-rl-size');f.appendChild(sv);var cap=el('figcaption','sp-note','Drawn stretched out, next to a person 1.70 m tall.'),src=m.dataset.lensrc;
if(src){var s2=src.split('|');cap.appendChild(document.createTextNode(' Length: '));if(s2[1]){var aa=el('a','',s2[0]);aa.href=s2[1];aa.rel='noopener';aa.target='_blank';cap.appendChild(aa)}else cap.appendChild(document.createTextNode(s2[0]));cap.appendChild(document.createTextNode('.'))}
f.appendChild(cap);dd.appendChild(f)}
d.appendChild(dd);dl.appendChild(d)});w.appendChild(dl)}
if(D.fun&&D.fun.length)w.appendChild(para({l:'Did you know?',t:D.fun[0]},'p')).className='sp-rl-fun';
// How to recognise it: things to check in the photo, or on the model when it is turned around
if(D.rec&&D.rec.length){var s=el('div','sp-rl-rec'),hh=el('h3','','How to recognise it');hh.id='sp-rl-rech';s.appendChild(hh);
s.appendChild(el('p','sp-rl-hint','Look for these in the photo, or on the 3D model as you turn it around.'));var ul=el('ul');D.rec.forEach(function(x){ul.appendChild(para(x,'li'))});s.appendChild(ul);srcs(s,D.recsrc);top.appendChild(s)}
// Habitat, Behaviour, Life cycle, Teeth: closed until tapped
if(D.more&&D.more.length){var mw=el('div','sp-rl-mores');D.more.forEach(function(x){var i=nMore++,sec=el('div','sp-rl-more'),h3=el('h3'),bt=el('button','sp-rl-mb'),body=el('div','sp-rl-mbody');
bt.type='button';bt.id='sp-rl-mb'+i;bt.setAttribute('aria-expanded','false');bt.setAttribute('aria-controls','sp-rl-m'+i);bt.appendChild(el('span','',x.h));h3.appendChild(bt);sec.appendChild(h3);
body.id='sp-rl-m'+i;body.hidden=true;body.setAttribute('role','region');body.setAttribute('aria-labelledby',bt.id);(x.p||[]).forEach(function(y){body.appendChild(para(y))});srcs(body,x.src);sec.appendChild(body);
bt.addEventListener('click',function(){var o=bt.getAttribute('aria-expanded')!=='true';bt.setAttribute('aria-expanded',String(o));body.hidden=!o});mw.appendChild(sec)});box.appendChild(mw)}}
b.addEventListener('click',open);var ab=document.querySelector('.sp-anatbtn'),wantA=0;function anat(){if(!wantA)return;var x=document.querySelector('.sp3d-wrap .sp3d-b[title^="Show the parts"]');if(x){wantA=0;if(x.getAttribute('aria-pressed')!=='true')setTimeout(function(){x.click()},300)}}if(ab)ab.addEventListener('click',function(){wantA=1;open();anat()});if(location.hash==='#real')open();window.addEventListener('hashchange',function(){if(location.hash==='#real')open()})})();

(function(){var T={'3d':{v:480,sel:'.sp-realbtn,.sp-anatbtn,.sp-rl'}},V=578,d=document.documentElement;try{var a=+localStorage.getItem('sl-ver-n');if(a>V)V=a}catch(e){}
Object.keys(T).forEach(function(k){var seen=0;try{seen=localStorage.getItem('sl-new-seen-'+k)}catch(e){}if(V&&V<T[k].v+20&&!seen)d.classList.add('sl-new-'+k);
document.addEventListener('click',function(e){if(!d.classList.contains('sl-new-'+k)||!e.target.closest||!e.target.closest(T[k].sel))return;try{localStorage.setItem('sl-new-seen-'+k,'1')}catch(x){}d.classList.remove('sl-new-'+k)},true)})})();
