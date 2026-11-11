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
cg=document.createElementNS(NS,'g');var k=v.w/Math.max(1,m.clientWidth);cs.forEach(function(c){var d=document.createElementNS(NS,'circle');d.setAttribute('cx',((c[1]+180)*4).toFixed(1));d.setAttribute('cy',((90-c[0])*4).toFixed(1));d.setAttribute('r',(4.5*k).toFixed(2));d.setAttribute('class','ct');var t=document.createElementNS(NS,'title');t.textContent=c[2];d.appendChild(t);cg.appendChild(d)});s.appendChild(cg)}
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
})();

(function(){var b=document.querySelector('.sp-realbtn'),m=document.querySelector('.sp-main[data-sci]');if(!b||!m)return;
var sci=m.dataset.sci,sid=m.dataset.id,name=(document.querySelector('h1')||{}).textContent||sci,dlg=null,me=document.currentScript&&document.currentScript.src||location.href;
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function lic(c){c=String(c||'').toLowerCase();return c==='cc0'?'CC0':c.replace(/^cc-/,'CC ').toUpperCase()}
function size(){var lo=+m.dataset.lenlo,hi=+m.dataset.lenhi;if(!hi)return null;var W=340,P=1.5,s=Math.min((W-40)/(hi+0.55),74),NS='http://www.w3.org/2000/svg',ph=P*s,H=Math.max(ph+46,128),g=H-26;
var svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('role','img');
svg.setAttribute('aria-label',name+': about '+rng(lo,hi)+' long, next to a person 1.5 m tall');
function a(t,o,p){var e=document.createElementNS(NS,t);for(var k in o)e.setAttribute(k,o[k]);(p||svg).appendChild(e);return e}
var px=14+0.2*s,hr=Math.max(3,0.11*s),x0=px+0.2*s+18,th=Math.max(5,Math.min(12,0.06*s)),y=g-th/2-1;
a('line',{x1:6,y1:g,x2:W-6,y2:g,'class':'gr'});
a('circle',{cx:px,cy:g-ph+hr,r:hr,'class':'pp'});a('path',{d:'M'+(px-0.2*s)+' '+g+'L'+(px-0.13*s)+' '+(g-ph*0.52)+'L'+(px-0.2*s)+' '+(g-ph*0.82)+'Q'+px+' '+(g-ph*0.9)+' '+(px+0.2*s)+' '+(g-ph*0.82)+'L'+(px+0.13*s)+' '+(g-ph*0.52)+'L'+(px+0.2*s)+' '+g+'Z','class':'pp'});
var t=a('text',{x:px,y:g+16,'text-anchor':'middle'});t.textContent='1.5 m';
var st=[0.1,0.25,0.5,1,2].filter(function(v){return v*s>=34})[0]||2;
for(var v=0;v<=hi+1e-9;v+=st){a('line',{x1:x0+v*s,y1:g,x2:x0+v*s,y2:g+4,'class':'gr'});var tk=a('text',{x:x0+v*s,y:g+16,'text-anchor':'middle','class':'tk'});tk.textContent=v?fmt(v):'0'}
function body(L,c){var hl=Math.min(th*1.7,L/3),tl=Math.min(L*0.35,th*6),h=th/2;if(L<th*2)return a('rect',{x:x0,y:y-h,width:Math.max(L,1),height:th,rx:h,'class':c});
return a('path',{d:'M'+x0+' '+y+'L'+(x0+tl)+' '+(y-h)+'L'+(x0+L-hl)+' '+(y-h)+'C'+(x0+L-hl*0.4)+' '+(y-h*1.5)+' '+(x0+L)+' '+(y-h)+' '+(x0+L)+' '+y+'C'+(x0+L)+' '+(y+h)+' '+(x0+L-hl*0.4)+' '+(y+h*1.5)+' '+(x0+L-hl)+' '+(y+h)+'L'+(x0+tl)+' '+(y+h)+'Z','class':c})}
if(hi>lo)body(hi*s,'sn2');body(lo*s,'sn');if(lo*s>=th*2)a('circle',{cx:x0+lo*s-Math.min(th*1.7,lo*s/3)*0.45,cy:y-th*0.18,r:Math.max(1,th*0.13),'class':'eye'});
var t2=a('text',{x:Math.min(Math.max(x0+hi*s/2,x0+30),W-50),y:y-th/2-7,'text-anchor':'middle','class':'ln'});t2.textContent=rng(lo,hi);
return svg}
function fmt(v){return v<1?Math.round(v*100)+' cm':(Math.round(v*100)/100)+' m'}
function rng(lo,hi){if(lo===hi)return fmt(hi);if(lo>=1)return (Math.round(lo*100)/100)+'–'+fmt(hi);if(hi<1)return Math.round(lo*100)+'–'+fmt(hi);return fmt(lo)+'–'+fmt(hi)}
// the model profiles and the viewer code are fetched only when the viewer is opened
var models=null,modP=null,viewer=null,tabs,p3d,pph,host,about,note,stat,grid,got=0,busy=0;
function getModels(){if(models)return Promise.resolve(models);return fetch(new URL('3d/models.json',me).href).then(function(r){if(!r.ok)throw new Error('models '+r.status);return r.json()}).then(function(d){models=d;return d})}
var tries=0;function getViewer(){if(!modP){var imp,q=tries++?'?r='+tries:'';try{imp=new Function('u','return import(u)')}catch(e){return Promise.reject(e)}
modP=Promise.all([imp(new URL('3d/three.module.min.js'+q,me).href),imp(new URL('3d/viewer.js'+q,me).href)]).then(function(r){r[1].useThree(r[0]);return r[1]}).catch(function(e){modP=null;throw e})}return modP}
function gl(){try{var c=document.createElement('canvas');return !!(window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl')))}catch(e){return false}}
function open(){if(!dlg)build();if(dlg.showModal){if(!dlg.open)dlg.showModal()}else dlg.setAttribute('open','');start()}
function close(){if(dlg.close)dlg.close();else{dlg.removeAttribute('open');closed()}}
function closed(){if(viewer){viewer.dispose();viewer=null}busy=0;b.focus();if(location.hash==='#real')history.replaceState(null,'',location.pathname+location.search)}
function pick(which){var is3=which==='3d';tabs[0].setAttribute('aria-selected',is3);tabs[1].setAttribute('aria-selected',!is3);tabs[0].tabIndex=is3?0:-1;tabs[1].tabIndex=is3?-1:0;p3d.hidden=!is3;pph.hidden=is3;if(!is3)load()}
function msg(t,retry,photos){host.innerHTML='';var d=el('div','sp3d-msg');d.setAttribute('role','alert');d.appendChild(el('p','',t));if(retry){var r=el('button','sp-btn sp-btn2','Retry');r.type='button';r.addEventListener('click',start);d.appendChild(r)}
if(photos){var q=el('button','sp-btn sp-btn2','See photos instead');q.type='button';q.addEventListener('click',function(){pick('ph');tabs[1].focus()});d.appendChild(q)}host.appendChild(d)}
function start(){if(viewer||busy)return;busy=1;host.innerHTML='';var ld=el('div','sp3d-msg sp3d-loading');ld.setAttribute('role','status');ld.appendChild(el('span','sp3d-spin'));ld.appendChild(el('p','','Loading the 3D model...'));host.appendChild(ld);
getModels().then(function(d){var p=d&&d.species&&d.species[sid];
if(!p){busy=0;nomodel();return}
fillAbout(p);
if(!gl()){busy=0;msg('This browser or device cannot show 3D graphics (WebGL is turned off or not supported), so the 3D model cannot be shown. The photos are still available.',false,true);return}
return getViewer().then(function(mod){if(!dlg.open&&!dlg.hasAttribute('open')){busy=0;return}host.innerHTML='';
try{viewer=mod.mount(host,{profile:p,id:sid,name:name,testing:!!window.SL_3D_TEST})}catch(e){viewer=null;busy=0;msg(e&&e.message==='webgl'?'The 3D view could not start on this device (WebGL is not available). The photos are still available.':'The 3D view could not start.',true,true);return}busy=0})})
.catch(function(){busy=0;msg(navigator.onLine===false?'You seem to be offline, and the 3D viewer has not been downloaded yet.':'The 3D viewer could not be loaded just now.',true,true)})}
function nomodel(){tabs[0].parentNode.hidden=true;p3d.hidden=true;pph.hidden=false;note.hidden=false;load()}
function fillAbout(p){if(about.dataset.done)return;about.dataset.done=1;var s=el('summary','','About this model and its sources');about.appendChild(s);
about.appendChild(el('p','','A reconstruction built by SnakeList from the sources below: body proportions, head shape, scale rows and keels, colours and markings of a typical adult. It is not a scan of a real snake, and individual snakes vary.'));
if(p.scene&&p.scene.basis)about.appendChild(el('p','','Surroundings: '+p.scene.basis));var ul=el('ul');(p.refs||[]).forEach(function(r){var li=el('li'),a=el('a','',r.t);a.href=r.acct?'#sources':r.u;if(!r.acct){a.rel='noopener';a.target='_blank'}else a.addEventListener('click',close);li.appendChild(a);ul.appendChild(li)});about.appendChild(ul)}
function build(){dlg=el('dialog','sp-rl');dlg.setAttribute('aria-labelledby','sp-rl-h');var inn=el('div','sp-rl-in'),hd=el('div','sp-rl-hd'),h=el('h2','','Explore in 3D: ');h.appendChild(el('span','sp-rl-nm',name));h.id='sp-rl-h';
var x=el('button','sp-rl-x','×');x.type='button';x.setAttribute('aria-label','Close');x.addEventListener('click',close);hd.appendChild(h);hd.appendChild(x);inn.appendChild(hd);
var tl=el('div','sp-rl-tabs');tl.setAttribute('role','tablist');tl.setAttribute('aria-label','View');tabs=[el('button','sp-rl-tab','3D model'),el('button','sp-rl-tab','Photos')];
tabs.forEach(function(t,i){t.type='button';t.setAttribute('role','tab');t.id='sp-rl-t'+i;t.setAttribute('aria-controls','sp-rl-p'+i);t.addEventListener('click',function(){pick(i?'ph':'3d')});
t.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();var j=1-i;pick(j?'ph':'3d');tabs[j].focus()}});tl.appendChild(t)});inn.appendChild(tl);
p3d=el('section','sp-rl-p');p3d.id='sp-rl-p0';p3d.setAttribute('role','tabpanel');p3d.setAttribute('aria-labelledby','sp-rl-t0');host=el('div','sp3d-host');p3d.appendChild(host);about=el('details','sp3d-about');p3d.appendChild(about);inn.appendChild(p3d);
pph=el('section','sp-rl-p');pph.id='sp-rl-p1';pph.setAttribute('role','tabpanel');pph.setAttribute('aria-labelledby','sp-rl-t1');pph.hidden=true;
note=el('p','sp3d-none','No accurate 3D model of this snake exists yet. SnakeList only shows a 3D model when it can be built from reliable descriptions and photos of the species, so here are photos of it instead.');note.hidden=true;pph.appendChild(note);
var pf=document.querySelector('.sp-photo img'),pc=document.querySelector('.sp-photo figcaption');if(pf){var f0=el('figure','sp-rl-own'),im=new Image();im.src=pf.getAttribute('data-fb')||pf.src;im.alt=pf.alt;im.width=540;im.height=360;f0.appendChild(im);if(pc)f0.appendChild(pc.cloneNode(true));pph.appendChild(f0)}
stat=el('p','sp-rl-st','Loading photos from iNaturalist...');stat.setAttribute('role','status');pph.appendChild(stat);grid=el('ul','sp-rl-grid');pph.appendChild(grid);
var sz=size();if(sz){var f=el('figure','sp-rl-size');f.appendChild(el('h3','','How big is it?'));f.appendChild(sz);var cap=el('figcaption');cap.appendChild(document.createTextNode('Adult length: '+(m.dataset.lentxt||'')+' '));
var src=m.dataset.lensrc;if(src){var p=src.split('|');var aa=el('a','',p[0]);if(p[1]){aa.href=p[1];aa.rel='noopener'}cap.appendChild(document.createTextNode('(source: '));cap.appendChild(p[1]?aa:document.createTextNode(p[0]));cap.appendChild(document.createTextNode(')'))}
cap.appendChild(el('span','sp-note',' Drawn stretched out, to scale with a person 1.5 m tall. Real snakes vary.'));f.appendChild(cap);pph.appendChild(f)}
var n=el('p','sp-note sp-rl-n');n.appendChild(document.createTextNode('Research-grade observations shared on '));var ia=el('a','','iNaturalist');ia.href='https://www.inaturalist.org/observations?taxon_name='+encodeURIComponent(sci)+'&quality_grade=research';ia.rel='noopener';n.appendChild(ia);
n.appendChild(document.createTextNode('. Only photos their photographers shared under an open licence are shown; each links to its observation.'));pph.appendChild(n);inn.appendChild(pph);pick('3d');
dlg.appendChild(inn);document.body.appendChild(dlg);dlg.addEventListener('click',function(e){if(e.target===dlg)close()});dlg.addEventListener('close',closed)}
function load(){if(got)return;if(navigator.onLine===false){stat.textContent='You seem to be offline. These photos come from iNaturalist, so they need an internet connection.';return}got=1;stat.textContent='Loading photos from iNaturalist...';
var c=window.AbortController?new AbortController():null,t=setTimeout(function(){if(c)c.abort()},12000);
fetch('https://api.inaturalist.org/v1/observations?taxon_name='+encodeURIComponent(sci)+'&photos=true&quality_grade=research&per_page=12',c?{signal:c.signal}:{}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){clearTimeout(t);var k=0;
((d&&d.results)||[]).forEach(function(o){var ph=(o.photos||[])[0];if(!ph||!ph.license_code||!ph.url)return;var who=(o.user&&(o.user.name||o.user.login))||'an iNaturalist user',u='https://www.inaturalist.org/observations/'+o.id;
var li=el('li'),f=el('figure'),a=el('a');a.href=u;a.rel='noopener';a.target='_blank';var i=new Image();i.src=ph.url.replace('/square.','/medium.');i.alt='Photo of '+name+' by '+who;i.loading='lazy';i.width=320;i.height=240;a.appendChild(i);f.appendChild(a);
var cap=el('figcaption');cap.appendChild(document.createTextNode('© '+who+' ('+lic(ph.license_code)+') '));var l2=el('a','','observation'+(o.observed_on?' from '+o.observed_on.slice(0,4):''));l2.href=u;l2.rel='noopener';l2.target='_blank';cap.appendChild(l2);f.appendChild(cap);li.appendChild(f);grid.appendChild(li);k++});
stat.textContent=k?k+' more photo'+(k>1?'s':'')+' of '+name+' by iNaturalist observers.':'No openly licensed research-grade photos of this snake are on iNaturalist yet.'})
.catch(function(){clearTimeout(t);got=0;stat.textContent='Could not reach iNaturalist just now (it may be offline or blocked on this network). Try again later.'})}
b.addEventListener('click',open);if(location.hash==='#real')open();window.addEventListener('hashchange',function(){if(location.hash==='#real')open()})})();
