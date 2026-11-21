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
(function(){function nf(t){if(!t||t.tagName!=='IMG'||t.dataset.nf)return;t.dataset.nf=1;var d=document.createElement('span');d.className='sl-nophoto';d.setAttribute('role','img');d.setAttribute('aria-label',t.alt||'Photo unavailable');d.textContent='Photo unavailable';if(t.width&&t.height)d.style.aspectRatio=t.width+'/'+t.height;t.replaceWith(d)}
window.addEventListener('error',function(e){nf(e.target)},true);[].forEach.call(document.images,function(i){if(i.complete&&!i.naturalWidth&&i.getAttribute('src'))nf(i)})})();
(function(){
var grid=document.getElementById('cy-grid'),PAGE=60,shown=PAGE;
// the country picker: every country page, typed to search
var jump=document.getElementById('cy-jump'),jq=document.getElementById('cy-jq'),dl=document.getElementById('cy-clist'),C=null;
function loadC(){if(C)return;C={};fetch('../countries.json').then(function(r){return r.ok?r.json():{}}).then(function(o){C=o;dl.innerHTML=Object.keys(o).map(function(n){return '<option value="'+n.replace(/"/g,'&quot;')+'">'}).join('')}).catch(function(){})}
if(jq){jq.addEventListener('focus',loadC);jq.addEventListener('change',function(){go(false)})}
function go(sub){var v=(jq.value||'').trim().toLowerCase(),hit=null;for(var k in C)if(k.toLowerCase()===v){hit=k;break}
if(!hit&&sub){for(var k2 in C)if(k2.toLowerCase().indexOf(v)===0){hit=k2;break}}if(hit){location.href=C[hit];return true}return false}
if(jump)jump.addEventListener('submit',function(e){e.preventDefault();loadC();if(!go(true)&&C&&Object.keys(C).length)jq.setCustomValidity('No country called that in SnakeList'),jq.reportValidity(),setTimeout(function(){jq.setCustomValidity('')},1500)});
if(!grid)return;
var items=[].slice.call(grid.children),total=items.length,count=document.getElementById('cy-count'),empty=document.getElementById('cy-empty'),more=document.getElementById('cy-more');
var q=document.getElementById('cy-q'),fv=document.getElementById('cy-v'),ff=document.getElementById('cy-f'),fs=document.getElementById('cy-s'),reset=document.getElementById('cy-reset');
items.forEach(function(li,i){li._t=(li.textContent+' '+li.dataset.f).toLowerCase();li._i=i});
function cmp(a,b){var s=fs?fs.value:'n',x,y;
if(s==='s'){x=a.dataset.s;y=b.dataset.s}else if(s==='f'){x=(a.dataset.f||'~')+' '+a.dataset.n;y=(b.dataset.f||'~')+' '+b.dataset.n}else{x=a.dataset.n;y=b.dataset.n}
var r=x<y?-1:x>y?1:(a.dataset.s<b.dataset.s?-1:a.dataset.s>b.dataset.s?1:0);if(s==='nr'){r=-r;if(a.dataset.n.charAt(0)==='~'!==(b.dataset.n.charAt(0)==='~'))r=-r}return r}
function vok(li,v){var h=li.dataset.h;return v==='1'||v==='0'?li.dataset.v===v:v==='h'?(h==='dv'||h==='gc'):h===v}
// the app's other checklist filters (type, habitat, constrictor, popular, rare...): one at a time, from the counts above
var xf='',xl='',xfp=document.getElementById('cy-xfp');
function xok(li){var p=xf.split(':');if(p[0]==='k')return (li.dataset.k||'').indexOf(p[1])>=0;if(p[0]==='t')return li.dataset.t===p[1];if(p[0]==='hb')return (' '+(li.dataset.hb||'')+' ').indexOf(' '+p[1]+' ')>=0;return true}
var dbtn=[].slice.call(document.querySelectorAll('button.cy-dbtn'));
dbtn.forEach(function(b){b.addEventListener('click',function(){var d=b.dataset;
if(d.fv!=null){if(!fv)return;fv.value=fv.value===d.fv?'':d.fv}else if(d.ff!=null){if(!ff)return;ff.value=ff.value===d.ff?'':d.ff}else if(d.xf!=null){if(xf===d.xf){xf='';xl=''}else{xf=d.xf;xl=d.xl}}
apply();var l=document.getElementById('cy-list-h');if(l&&b.getAttribute('aria-pressed')==='true'){var sec=l.parentNode,r=sec.getBoundingClientRect();if(r.top>innerHeight*.6||r.top<0)sec.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'})}})});
if(xfp)xfp.addEventListener('click',function(){xf='';xl='';apply()});
function apply(keep){
var t=q?q.value.trim().toLowerCase():'',v=fv?fv.value:'',f=ff?ff.value:'';
var hit=items.filter(function(li){return (!t||li._t.indexOf(t)>=0)&&(!v||vok(li,v))&&(!f||(f==='-'?!li.dataset.f:li.dataset.f===f))&&(!xf||xok(li))});
hit.sort(cmp);if(!keep)shown=PAGE;
var frag=document.createDocumentFragment();hit.forEach(function(li){frag.appendChild(li)});
items.forEach(function(li){li.hidden=true});grid.appendChild(frag);
hit.forEach(function(li,i){li.hidden=i>=shown});
var vis=Math.min(hit.length,shown);
if(count)count.textContent=hit.length===total?(vis===total?'Showing '+total+' species':'Showing '+vis+' of '+total+' species'):
(vis<hit.length?'Showing '+vis+' of '+hit.length+' matching species ('+total+' in all)':'Showing '+hit.length+' of '+total+' species');
empty.hidden=hit.length>0;more.hidden=hit.length<=shown;if(!more.hidden)more.textContent='Show more ('+(hit.length-shown)+' left)';
if(reset)reset.hidden=!(t||v||f||xf||(fs&&fs.value!=='n'));
if(xfp){xfp.hidden=!xf;xfp.textContent=xl+' ✕';xfp.setAttribute('aria-label','Remove the filter: '+xl)}
dbtn.forEach(function(b){var d=b.dataset;b.setAttribute('aria-pressed',String(d.fv!=null?d.fv===v:d.ff!=null?d.ff===f:d.xf===xf))})}
var qT=0;[q,fv,ff,fs].forEach(function(el){if(el)el.addEventListener(el===q?'input':'change',function(){clearTimeout(qT);if(el===q)qT=setTimeout(apply,150);else apply()})});
function clear(){xf='';xl='';if(q)q.value='';if(fv)fv.value='';if(ff)ff.value='';if(fs)fs.value='n';apply();(q||grid).focus&&q&&q.focus()}
if(reset)reset.addEventListener('click',clear);var cl=document.getElementById('cy-clear');if(cl)cl.addEventListener('click',clear);
more.addEventListener('click',function(){var first=shown;shown+=PAGE;apply(true);var li=grid.children[first];if(li){var a=li.querySelector('a');if(a)a.focus({preventScroll:true})}});
apply(true);
})();

(function(){[].forEach.call(document.querySelectorAll('.rg-pl'),function(w){var ul=w.querySelector('.rg-pul'),q=w.querySelector('.rg-pq input'),more=w.querySelector('.rg-pmore'),none=w.querySelector('.rg-pempty'),P=+w.dataset.page||60,shown=P;
var li=[].slice.call(ul.children);li.forEach(function(e){e._t=(e.dataset.t||e.textContent).toLowerCase()});
function run(){var t=q?q.value.trim().toLowerCase():'',k=0;li.forEach(function(e){var m=!t||e._t.indexOf(t)>=0;e.hidden=!m||k>=shown;if(m)k++});
none.hidden=k>0;more.hidden=k<=shown;if(!more.hidden)more.textContent='Show more ('+(k-shown)+' left)'}
if(q)q.addEventListener('input',function(){shown=P;run()});more.addEventListener('click',function(){var f=shown;shown+=P;run();var e=li.filter(function(x){return !x.hidden})[f];var a=e&&e.querySelector('a');if(a)a.focus({preventScroll:true})});run()})})();

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
// v5.57: a text box with suggestions (<input list="...">) shows them in a SnakeList panel - the green one the
// Language button opens - not the browser's plain white list. The <datalist> stays as the list of options.
(function(){
if(!document.querySelector||window.__slSug)return;window.__slSug=1;
var st=document.createElement('style');st.textContent=
'.sl-sug-host{position:relative}'+
'.sl-sug{position:absolute;z-index:3000;left:0;top:calc(100% + 6px);min-width:100%;width:max-content;max-width:min(360px,calc(100vw - 24px));max-height:min(320px,55vh);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;margin:0;padding:6px;list-style:none;box-sizing:border-box;'+
'background:linear-gradient(160deg,#256846,#22623f);border:1px solid #37855f;border-radius:14px;box-shadow:0 14px 34px rgba(0,0,0,.3);color:#eef6ee;font:500 14.5px/1.35 Inter,system-ui,sans-serif;text-align:left;scrollbar-width:thin}'+
'.sl-sug[hidden]{display:none}.sl-sug-up>.sl-sug{top:auto;bottom:calc(100% + 6px)}'+
'.sl-sug li{display:block;margin:0;padding:9px 11px;border-radius:8px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#eef6ee}'+
'.sl-sug li b{font-weight:700;color:#fff}.sl-sug li:hover,.sl-sug li.act{background:#2c7a57}'+
'@media (pointer:coarse){.sl-sug li{padding:11px 12px;font-size:16px}}';
document.head.appendChild(st);
function esc(t){return String(t).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function fold(t){return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')}
var n=0;
function enhance(inp){
  var lid=inp.getAttribute('list');if(!lid||inp.dataset.slSug)return;
  inp.dataset.slSug=lid;inp.removeAttribute('list');inp.setAttribute('autocomplete','off');
  var id='sl-sug-'+(++n),host=inp.parentNode;host.classList.add('sl-sug-host');
  var ul=document.createElement('ul');ul.className='sl-sug';ul.id=id;ul.setAttribute('role','listbox');ul.hidden=true;host.appendChild(ul);
  inp.setAttribute('role','combobox');inp.setAttribute('aria-autocomplete','list');inp.setAttribute('aria-expanded','false');inp.setAttribute('aria-controls',id);
  var items=[],act=-1;
  function opts(){var dl=document.getElementById(lid);return dl?[].map.call(dl.getElementsByTagName('option'),function(o){return o.value}).filter(Boolean):[]}
  function show(on){ul.hidden=!on;inp.setAttribute('aria-expanded',on?'true':'false');if(!on){act=-1;inp.removeAttribute('aria-activedescendant');return}
    var r=inp.getBoundingClientRect();host.classList.toggle('sl-sug-up',r.bottom+Math.min(320,ul.scrollHeight)+12>innerHeight&&r.top>innerHeight/2)}
  function render(){
    var q=fold(inp.value.trim()),all=opts(),a=[],b=[];
    for(var i=0;i<all.length&&a.length<300;i++){var f=fold(all[i]);if(!q||f.indexOf(q)===0)a.push(all[i]);else if(f.indexOf(q)>0&&b.length<100)b.push(all[i])}
    items=a.concat(b).slice(0,300);
    if(items.length===1&&fold(items[0])===q)items=[]; // exactly what's typed: nothing left to suggest
    ul.innerHTML=items.map(function(v,i){var f=fold(v),k=q?f.indexOf(q):-1;
      return '<li role="option" id="'+id+'-'+i+'" data-i="'+i+'">'+(k>=0&&v.length===f.length?esc(v.slice(0,k))+'<b>'+esc(v.slice(k,k+q.length))+'</b>'+esc(v.slice(k+q.length)):esc(v))+'</li>'}).join('');
    ul.scrollTop=0;act=-1;show(items.length>0&&document.activeElement===inp)}
  function hi(i){var ls=ul.children;if(ls[act])ls[act].classList.remove('act');act=i;if(ls[act]){ls[act].classList.add('act');inp.setAttribute('aria-activedescendant',ls[act].id);
    var r=ls[act];if(r.offsetTop<ul.scrollTop)ul.scrollTop=r.offsetTop-6;else if(r.offsetTop+r.offsetHeight>ul.scrollTop+ul.clientHeight)ul.scrollTop=r.offsetTop+r.offsetHeight-ul.clientHeight+6}}
  function pick(i){var v=items[i];if(v==null)return;inp.value=v;show(false);inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}))}
  inp.addEventListener('input',function(e){if(e.isTrusted)render()});
  inp.addEventListener('focus',render);
  inp.addEventListener('click',function(){if(ul.hidden)render()});
  inp.addEventListener('blur',function(){setTimeout(function(){if(document.activeElement!==inp)show(false)},150)});
  inp.addEventListener('keydown',function(e){var k=e.key;if(e.isComposing)return;
    if(k==='ArrowDown'||k==='ArrowUp'){e.preventDefault();if(ul.hidden)render();if(items.length)hi(act<0?(k==='ArrowDown'?0:items.length-1):(act+(k==='ArrowDown'?1:-1)+items.length)%items.length)}
    else if(k==='Enter'&&!ul.hidden&&act>=0){e.preventDefault();e.stopPropagation();pick(act)}
    else if(k==='Enter')show(false);
    else if(k==='Escape'&&!ul.hidden){e.preventDefault();e.stopPropagation();show(false)}
    else if(k==='Tab')show(false)});
  ul.addEventListener('mousedown',function(e){e.preventDefault()});
  ul.addEventListener('click',function(e){var li=e.target.closest('li');if(li)pick(+li.dataset.i)});
  ul.addEventListener('mousemove',function(e){var li=e.target.closest('li');if(li&&+li.dataset.i!==act)hi(+li.dataset.i)});
  // options that arrive later (a list loaded the first time the box is used): shown as soon as they're there
  var dl=document.getElementById(lid);if(dl&&window.MutationObserver)new MutationObserver(function(){if(document.activeElement===inp)render()}).observe(dl,{childList:true});
}
function scan(root){var ins=(root||document).getElementsByTagName('input');for(var i=0;i<ins.length;i++)if(ins[i].hasAttribute('list'))enhance(ins[i])}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){scan()});else scan();
if(window.MutationObserver)new MutationObserver(function(ms){for(var j=0;j<ms.length;j++){var a=ms[j].addedNodes;for(var i=0;i<a.length;i++){var nd=a[i];if(nd.nodeType!==1)continue;if(nd.tagName==='INPUT'){if(nd.hasAttribute('list'))enhance(nd)}else if(nd.getElementsByTagName&&nd.firstElementChild)scan(nd)}}}).observe(document.documentElement,{childList:true,subtree:true});
})();

// v5.78: every button, the same hover: the 3D viewer's Open mouth / See it eat colours (CSS above, class sl-hov). v5.93: the thin
// light mint line that travels once round the border over 1.5 s, then fades (on hover, a tap and keyboard focus) is only on .sl-trace-on.
// One SVG over the whole page, moved with the button - nothing is added inside the buttons, so their own layout, ::before/::after
// and positions stay exactly as they were. Reduced motion: the line just fades in and out where it is, without travelling.
(function () {
  if (window.__slFx || !document.addEventListener) return; window.__slFx = true;
  var SEL = 'button, [role="button"], input[type="button"], input[type="submit"], a[class*="btn"], a.btn, a.chip, .chip, .sp-tags a, .sp-pills a, .sx-chips a';
  var RM = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var svg = null, rect = null, cur = null, anim = null, fade = null, raf = 0, hov = null;
  function looksLikeButton(el) {
    if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return false;
    var r = el.getBoundingClientRect(); if (r.width < 14 || r.height < 14 || r.width > 640 || r.height > 140) return false;
    var cs = getComputedStyle(el);
    if (/url\(/.test(cs.backgroundImage)) return false; // a photo you can tap, not a button
    var bg = cs.backgroundColor, m = /rgba?\(([^)]+)\)/.exec(bg), a = m ? (m[1].split(",")[3] === undefined ? 1 : parseFloat(m[1].split(",")[3])) : 0;
    var bw = parseFloat(cs.borderTopWidth) || 0;
    return a > 0.04 || (bw > 0 && cs.borderTopStyle !== "none" && !/rgba\([^)]*,\s*0\)/.test(cs.borderTopColor)) || /gradient/.test(cs.backgroundImage);
  }
  function target(e) { var t = e.target; if (!t || !t.closest) return null; var b = t.closest(SEL); return b && looksLikeButton(b) ? b : null; }
  // v5.93: the travelling line is kept only for the choices marked sl-trace-on; buttons marked sl-own-hov keep their own hover colours
  var TRACE = ".sl-trace-on";
  function traceTarget(e) { var t = e.target; if (!t || !t.closest) return null; var b = t.closest(TRACE); return b && !b.disabled ? b : null; }
  function ensure() {
    if (svg && svg.isConnected) return;
    var NS = "http://www.w3.org/2000/svg"; svg = document.createElementNS(NS, "svg"); svg.setAttribute("class", "sl-trace"); svg.setAttribute("aria-hidden", "true");
    rect = document.createElementNS(NS, "rect"); rect.setAttribute("pathLength", "100"); svg.appendChild(rect); document.body.appendChild(svg);
  }
  function place() {
    if (!cur || !cur.isConnected) return false;
    var r = cur.getBoundingClientRect(); if (!r.width) return false;
    var cs = getComputedStyle(cur), rad = parseFloat(cs.borderTopLeftRadius) || 0;
    if (/%/.test(cs.borderTopLeftRadius)) rad = Math.min(r.width, r.height) * parseFloat(cs.borderTopLeftRadius) / 100;
    var w = r.width, h = r.height; rad = Math.min(rad, w / 2, h / 2);
    svg.style.transform = "translate(" + r.left + "px," + r.top + "px)"; svg.setAttribute("width", w); svg.setAttribute("height", h);
    rect.setAttribute("x", 0.8); rect.setAttribute("y", 0.8); rect.setAttribute("width", Math.max(0, w - 1.6)); rect.setAttribute("height", Math.max(0, h - 1.6));
    rect.setAttribute("rx", Math.max(0, rad - 0.8)); rect.setAttribute("ry", Math.max(0, rad - 0.8));
    return true;
  }
  function follow() { raf = 0; if (!cur) return; if (!place()) { stop(); return; } raf = requestAnimationFrame(follow); }
  function stop() { if (anim) anim.cancel(); if (fade) fade.cancel(); anim = fade = null; if (raf) cancelAnimationFrame(raf); raf = 0; cur = null; if (svg) svg.style.opacity = "0"; }
  function trace(el) {
    if (!el.animate) return;
    stop(); ensure(); cur = el; if (!place()) return;
    var still = RM.matches;
    // a bright segment a third of the way round, travelling once round the border
    rect.setAttribute("stroke-dasharray", still ? "100 0" : "34 66");
    if (!still) anim = rect.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -100 }], { duration: 1500, easing: "cubic-bezier(.45,.05,.4,1)", fill: "forwards" });
    fade = svg.animate(still ? [{ opacity: 0 }, { opacity: 0.9, offset: 0.25 }, { opacity: 0.9, offset: 0.6 }, { opacity: 0 }]
      : [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.72 }, { opacity: 0 }], { duration: still ? 1200 : 1950, easing: "ease-in-out", fill: "forwards" });
    fade.onfinish = function () { if (cur === el) stop(); };
    raf = requestAnimationFrame(follow);
  }
  function setHov(el) {
    if (hov === el) return;
    if (hov) hov.classList.remove("sl-hov", "sl-hov-nb");
    hov = el;
    if (el) { var cs = getComputedStyle(el); el.classList.add("sl-hov"); if (!(parseFloat(cs.borderTopWidth) > 0) || cs.borderTopStyle === "none") el.classList.add("sl-hov-nb"); }
  }
  var canHover = window.matchMedia ? window.matchMedia("(hover: hover)") : { matches: true };
  document.addEventListener("pointerover", function (e) {
    if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    var b = target(e); if (b && b.closest(".sl-own-hov")) b = null;
    var tb = traceTarget(e);
    if (tb !== trHov) { trHov = tb; if (tb) trace(tb); }
    if (b && b === hov) return;
    setHov(b);
  }, true);
  var trHov = null;
  document.addEventListener("pointerout", function (e) {
    var to = e.relatedTarget;
    if (trHov && (!to || !trHov.contains(to))) trHov = null;
    if (!hov) return;
    if (!to || !hov.contains(to)) setHov(null);
  }, true);
  // a tap (phones, tablets): the line runs round the tapped button
  document.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") return; var b = traceTarget(e); if (b) trace(b); }, true);
  // the keyboard: the button you Tab to
  document.addEventListener("focusin", function (e) { var t = e.target; try { if (!t.matches || !t.matches(":focus-visible")) return; } catch (x) { return; } var b = t.closest && t.closest(TRACE); if (b) trace(b); }, true);
  // a button that goes away or is replaced (menus closing) never leaves the line or the colours behind
  window.addEventListener("blur", function () { setHov(null); });
  document.addEventListener("visibilitychange", function () { if (document.hidden) { setHov(null); stop(); } });
})();
// v5.93: a snake whose common name in SnakeList is Chinese (tools/chinese_names.py lists them) gets a small
// "Translate to <your language>" button at the top right of its name - on its card, in the map's lists, in the 3D
// window and on its own page. It shows the English name (Wikidata / English Wikipedia / the genus's English name,
// worked out once, offline); with SnakeList in another language, Google Translate (the Language button) turns that into
// your language. Then the button says "Translate back". The names are found with a CSS animation (no page-wide watching).
(function () {
  if (window.__slZh || !document.addEventListener) return; window.__slZh = true;
  var ZH = {"opisthotropis-hungtai": {"zh": "\u5f20\u6c0f\u540e\u68f1\u86c7", "en": "Hung-ta Chang's Mountain Keelback"}}; // zh-names (tools/chinese_names.py)
  var ids = Object.keys(ZH); if (!ids.length) return;
  function lang() { var l = ""; try { l = localStorage.getItem("sl-lang") || ""; } catch (e) {} if (!l || l === "auto") l = (navigator.language || "en"); return String(l).toLowerCase().split(/[-_]/)[0] || "en"; }
  function langName(c) { try { var n = new Intl.DisplayNames(["en"], { type: "language" }).of(c); if (n && n.toLowerCase() !== c) return n; } catch (e) {} return "English"; }
  var sel = [];
  ids.forEach(function (id) { sel.push('.card[data-id="' + id + '"] .card-name', '[data-sp="' + id + '"] > b', '.sl3d-ov[data-sp-id="' + id + '"] .sl3d-name', '.sp-main[data-id="' + id + '"] h1'); });
  var st = document.createElement("style");
  st.textContent = "@keyframes slZhIn{from{outline-color:transparent}to{outline-color:transparent}}" + sel.join(",") + "{animation:slZhIn 1ms}" +
    ".sl-tr{display:inline-flex;align-items:center;vertical-align:super;margin-left:6px;padding:2px 7px;border-radius:999px;border:1px solid rgba(88,179,81,.55);" +
    "background:rgba(88,179,81,.12);color:inherit;font:600 10px/1.3 Inter,system-ui,sans-serif;letter-spacing:.01em;white-space:nowrap;cursor:pointer;-webkit-text-fill-color:currentColor;font-style:normal}" +
    ".sl-tr:hover{background:rgba(88,179,81,.28)}h1 .sl-tr{font-size:12px;padding:3px 9px;vertical-align:top;margin:6px 0 0 10px}" +
    ".card-name .sl-tr{position:relative;top:-1px}";
  (document.head || document.documentElement).appendChild(st);
  function idOf(el) { var h = el.closest("[data-id],[data-sp],[data-sp-id]"); return h ? (h.getAttribute("data-sp-id") || h.getAttribute("data-id") || h.getAttribute("data-sp")) : ""; }
  function textNode(el, s) { var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n; while ((n = w.nextNode())) if (n.nodeValue.indexOf(s) >= 0 && !(n.parentNode.closest && n.parentNode.closest(".sl-tr"))) return n; return null; }
  function label(b) { b.textContent = b.getAttribute("data-on") === "1" ? "Translate back" : "Translate to " + langName(lang()); }
  function decorate(el) {
    if (!el || el.querySelector(".sl-tr") || (el.nextElementSibling && el.nextElementSibling.classList.contains("sl-tr"))) return;
    var id = idOf(el), d = ZH[id]; if (!d || lang() === "zh" || el.textContent.indexOf(d.zh) < 0) return;
    var b = document.createElement("button"); b.type = "button"; b.className = "sl-tr sl-own-hov"; b.setAttribute("data-zh", id); label(b);
    // in the 3D window the name is a link: the button goes just after it
    if (el.tagName === "A") el.parentNode.insertBefore(b, el.nextSibling); else el.appendChild(b);
  }
  document.addEventListener("animationstart", function (e) { if (e.animationName === "slZhIn") decorate(e.target); }, true);
  function flip(b) {
    var d = ZH[b.getAttribute("data-zh")]; if (!d) return;
    var host = b.previousElementSibling && b.previousElementSibling.classList.contains("sl3d-name") ? b.previousElementSibling : b.parentNode;
    var on = b.getAttribute("data-on") !== "1", from = on ? d.zh : d.en, to = on ? d.en : d.zh, n = textNode(host, from);
    if (n) n.nodeValue = n.nodeValue.replace(from, to);
    b.setAttribute("data-on", on ? "1" : "0"); label(b);
    b.setAttribute("aria-label", on ? "Show the Chinese name again" : "Translate the Chinese name");
  }
  // capture, so the card / the map row / the 3D link under it never opens as well
  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest(".sl-tr"); if (!b) return; e.preventDefault(); e.stopPropagation(); flip(b); }, true);
  ["pointerdown", "mousedown", "touchstart"].forEach(function (t) { document.addEventListener(t, function (e) { if (e.target.closest && e.target.closest(".sl-tr")) e.stopPropagation(); }, { capture: true, passive: true }); });
})();

// v5.93: the Report button (the same as the app's): a short form that opens a pre-filled email to the creator
(function(){if(!document.querySelector||document.querySelector('.sl-report,#report-btn'))return;
var nav=document.querySelector('header.sl-top nav, header.site-top nav');if(!nav)return;
var INBOX='eduardo.fpb.brandao@gmail.com',kind='Bug';
var b=document.createElement('button');b.type='button';b.className='sl-report';b.setAttribute('aria-label','Report a bug or suggest an idea');b.title='Report a bug or suggest an idea';
b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v4"/><path d="M12 14h.01"/></svg>';
nav.appendChild(b);
var s=document.createElement('div');s.className='sl-rep-sheet';s.setAttribute('role','dialog');s.setAttribute('aria-modal','true');s.setAttribute('aria-label','Report a bug or suggest an idea');
s.innerHTML='<div class="sl-rep-card"><h2>Help make SnakeList better</h2><p>Found a bug, have an idea, or anything else? It goes straight to the SnakeList creator.</p>'+
'<div class="sl-rep-kinds"><button type="button" class="on" data-kind="Bug">&#128027; Something’s broken</button><button type="button" data-kind="Idea">&#128161; An idea to make it better</button><button type="button" data-kind="Other">&#128172; Other</button></div>'+
'<textarea rows="5" placeholder="What happened, or what would you change?" aria-label="Your message"></textarea><p class="sl-rep-note" aria-live="polite"></p>'+
'<div class="sl-rep-acts"><button type="button" class="no">Cancel</button><button type="button" class="go">Send</button></div></div>';
document.body.appendChild(s);var t=s.querySelector('textarea'),n=s.querySelector('.sl-rep-note');
function open(){s.classList.add('open');n.textContent='';setTimeout(function(){t.focus()},30)}function close(){s.classList.remove('open');try{b.focus()}catch(e){}}
b.addEventListener('click',open);s.querySelector('.no').addEventListener('click',close);s.addEventListener('click',function(e){if(e.target===s)close()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&s.classList.contains('open'))close()});
[].forEach.call(s.querySelectorAll('.sl-rep-kinds button'),function(x){x.addEventListener('click',function(){kind=x.getAttribute('data-kind');[].forEach.call(s.querySelectorAll('.sl-rep-kinds button'),function(y){y.classList.toggle('on',y===x)})})});
s.querySelector('.go').addEventListener('click',function(){var m=t.value.trim();if(!m){n.textContent='Write a few words first.';t.focus();return}
var subj='SnakeList '+(kind==='Bug'?'bug report':kind==='Idea'?'idea':'message')+': '+m.split('\n')[0].slice(0,60);
var body=m+'\n\n---\nType: '+kind+'\nPage: '+location.href+'\nScreen: '+innerWidth+'x'+innerHeight+'\nBrowser: '+navigator.userAgent;
var mail='mailto:'+INBOX+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(body);try{window.open(mail,'_blank')}catch(e){}
n.innerHTML='Your email app should open with it ready to send. If it didn’t, <a href="'+mail+'" target="_blank" rel="noopener">tap here to send it</a>.'})})();
(function(){try{var K="sl-xmas-preview",S=window.sessionStorage,L=location,m=/[?&](?:christmas(?:=([^&#]*))?|theme=christmas)(?=[&#]|$)/.exec(L.search);
if(m){if(m[1]==="off"||m[1]==="0")S.removeItem(K);else S.setItem(K,"1");var u=new URL(L.href);u.searchParams.delete("christmas");if(u.searchParams.get("theme")==="christmas")u.searchParams.delete("theme");history.replaceState(history.state,"",u.pathname+u.search+u.hash)}
if(S.getItem(K)!=="1"||window.XM)return;var d=document,h=d.documentElement,root=new URL("../",document.currentScript&&document.currentScript.src||L.href).href,kind=(L.href.indexOf(root+"species/")===0?"xm-sp":"xm-site");
window.XM={root:root+"christmas/",kind:kind};h.classList.add("xm",kind);var p=d.head||h,l=d.createElement("link");l.rel="stylesheet";l.href=root+"christmas/xmas.css";p.appendChild(l);
var s=d.createElement("script");s.src=root+"christmas/xmas.js";p.appendChild(s)}catch(e){}})();
