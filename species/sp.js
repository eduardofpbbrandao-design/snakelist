(function(){
var m=document.querySelector('.sp-map');
if(m){fetch('world.svg').then(function(r){if(!r.ok)throw 0;return r.text()}).then(function(t){m.innerHTML=t;var s=m.querySelector('svg'),NS='http://www.w3.org/2000/svg';
s.removeAttribute('width');s.removeAttribute('height');s.setAttribute('preserveAspectRatio','xMidYMid meet');s.setAttribute('aria-hidden','true');
[['intro','in'],['codes','on']].forEach(function(a){(m.dataset[a[0]]||'').split(' ').forEach(function(c){var p=c&&s.getElementById('c-'+c);if(p){p.setAttribute('class',a[1]);s.appendChild(p)}})});
var tp=document.querySelector('template.sp-ishapes');if(tp&&tp.innerHTML.trim()){var g=new DOMParser().parseFromString('<svg xmlns="'+NS+'">'+tp.innerHTML+'</svg>','image/svg+xml').documentElement;[].slice.call(g.childNodes).forEach(function(n){s.appendChild(document.importNode(n,true))})}
var dots=[];(m.dataset.dots||'').split(' ').forEach(function(d){var q=d.split(',');if(q.length<3)return;var c=document.createElementNS(NS,'circle');c.setAttribute('cx',q[0]);c.setAttribute('cy',q[1]);c.setAttribute('class',q[2]);c._s=+q[3]||0;s.appendChild(c);dots.push(c)});
var W=1440,HH=720,f=(m.dataset.view||'0 0 1440 720').split(' ').map(Number),v={x:0,y:0,w:W,h:HH},minW=Math.max(30,f[2]/12),maxW=W,A=.5;
var z=document.createElement('div');z.className='sp-zoom';z.innerHTML='<button type="button" aria-label="Zoom in">+</button><button type="button" aria-label="Zoom out">−</button>';m.appendChild(z);
var bi=z.children[0],bo=z.children[1];
function asp(){var w=m.clientWidth,h=m.clientHeight;A=w&&h?h/w:.5}
function draw(){asp();v.w=Math.min(maxW,Math.max(minW,v.w));v.h=v.w*A;
if(v.h>HH&&v.w>=maxW){v.x=0;v.y=(HH-v.h)/2}else{v.x=Math.min(W-v.w,Math.max(0,v.x));v.y=v.h>=HH?(HH-v.h)/2:Math.min(HH-v.h,Math.max(0,v.y))}
s.setAttribute('viewBox',v.x+' '+v.y+' '+v.w+' '+v.h);var k=v.w/Math.max(1,m.clientWidth);dots.forEach(function(c){c.setAttribute('r',(4*k).toFixed(3));c.style.display=c._s/k>12?'none':''});
bi.disabled=v.w<=minW+.01;bo.disabled=v.w>=maxW-.01}
function fit(){asp();var w=f[2],h=f[3],cx=f[0]+w/2,cy=f[1]+h/2;if(h>w*A)w=h/A;w=Math.min(maxW,Math.max(minW,w));v.w=w;v.h=w*A;v.x=cx-w/2;v.y=cy-v.h/2;draw()}
function pt(cx,cy){var r=s.getBoundingClientRect();return[v.x+(cx-r.left)/r.width*v.w,v.y+(cy-r.top)/r.height*v.h]}
function zoom(k,cx,cy){var r=s.getBoundingClientRect(),p=cx==null?[v.x+v.w/2,v.y+v.h/2]:pt(cx,cy),fx=(p[0]-v.x)/v.w,fy=(p[1]-v.y)/v.h,nw=Math.min(maxW,Math.max(minW,v.w/k));
v.w=nw;v.h=nw*A;v.x=p[0]-fx*nw;v.y=p[1]-fy*v.h;draw()}
bi.addEventListener('click',function(){zoom(1.6)});bo.addEventListener('click',function(){zoom(1/1.6)});
s.addEventListener('wheel',function(e){e.preventDefault();var d=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?400:1);zoom(Math.exp(-Math.max(-300,Math.min(300,d))*(e.ctrlKey?.01:.002)),e.clientX,e.clientY)},{passive:false});
var P={},last=null;
function mid(){var k=Object.keys(P),a=P[k[0]],b=P[k[1]]||a;return{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,d:Math.hypot(a[0]-b[0],a[1]-b[1])}}
s.addEventListener('pointerdown',function(e){if(e.button>0)return;try{s.setPointerCapture(e.pointerId)}catch(x){}P[e.pointerId]=[e.clientX,e.clientY];last=mid();s.classList.add('drag')});
s.addEventListener('pointermove',function(e){if(!P[e.pointerId])return;e.preventDefault();P[e.pointerId]=[e.clientX,e.clientY];var n=mid(),r=s.getBoundingClientRect();
if(last){if(Object.keys(P).length>1&&last.d>0&&n.d>0)zoom(n.d/last.d,n.x,n.y);v.x-=(n.x-last.x)/r.width*v.w;v.y-=(n.y-last.y)/r.height*v.h;draw()}last=n});
function up(e){delete P[e.pointerId];last=Object.keys(P).length?mid():null;if(!last)s.classList.remove('drag')}
s.addEventListener('pointerup',up);s.addEventListener('pointercancel',up);s.addEventListener('lostpointercapture',up);
['gesturestart','gesturechange'].forEach(function(n){s.addEventListener(n,function(e){e.preventDefault()})});
var rw=m.clientWidth;window.addEventListener('resize',function(){if(m.clientWidth!==rw){rw=m.clientWidth;draw()}});fit()}).catch(function(){})}
var im=document.querySelector('.sp-photo img');
if(im){im.style.cursor='zoom-in';im.addEventListener('click',function(){var o=document.createElement('div');o.className='sp-lb';o.setAttribute('role','dialog');
var big=new Image();big.alt=im.alt;big.src=im.src.replace('/medium.','/original.');big.onerror=function(){big.onerror=null;big.src=im.src.replace('/medium.','/large.')};
var x=document.createElement('button');x.type='button';x.className='sp-lb-x';x.textContent='×';x.setAttribute('aria-label','Close');
o.appendChild(big);o.appendChild(x);document.body.appendChild(o);function close(){o.remove();document.removeEventListener('keydown',k)}function k(e){if(e.key==='Escape')close()}
o.addEventListener('click',function(e){if(e.target!==big)close()});document.addEventListener('keydown',k)})}
var main=document.querySelector('.sp-main[data-sci]'),w=document.getElementById('sp-wiki');
if(main&&w){fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(main.dataset.sci.replace(/ /g,'_'))).then(function(r){return r.ok?r.json():null}).then(function(d){
if(!d||!d.extract||d.type==='disambiguation')return;var p=document.createElement('p');p.textContent=d.extract;w.appendChild(p);
var s=document.createElement('p');s.className='src';s.innerHTML='From <a href="'+d.content_urls.desktop.page+'" rel="noopener" target="_blank">Wikipedia</a> (CC BY-SA)';w.appendChild(s)}).catch(function(){})}
})();
