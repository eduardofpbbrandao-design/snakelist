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
function apply(keep){
var t=q?q.value.trim().toLowerCase():'',v=fv?fv.value:'',f=ff?ff.value:'';
var hit=items.filter(function(li){return (!t||li._t.indexOf(t)>=0)&&(!v||li.dataset.v===v)&&(!f||(f==='-'?!li.dataset.f:li.dataset.f===f))});
hit.sort(cmp);if(!keep)shown=PAGE;
var frag=document.createDocumentFragment();hit.forEach(function(li){frag.appendChild(li)});
items.forEach(function(li){li.hidden=true});grid.appendChild(frag);
hit.forEach(function(li,i){li.hidden=i>=shown});
var vis=Math.min(hit.length,shown);
if(count)count.textContent=hit.length===total?(vis===total?'Showing '+total+' species':'Showing '+vis+' of '+total+' species'):
(vis<hit.length?'Showing '+vis+' of '+hit.length+' matching species ('+total+' in all)':'Showing '+hit.length+' of '+total+' species');
empty.hidden=hit.length>0;more.hidden=hit.length<=shown;if(!more.hidden)more.textContent='Show more ('+(hit.length-shown)+' left)';
if(reset)reset.hidden=!(t||v||f||(fs&&fs.value!=='n'))}
var qT=0;[q,fv,ff,fs].forEach(function(el){if(el)el.addEventListener(el===q?'input':'change',function(){clearTimeout(qT);if(el===q)qT=setTimeout(apply,150);else apply()})});
function clear(){if(q)q.value='';if(fv)fv.value='';if(ff)ff.value='';if(fs)fs.value='n';apply();(q||grid).focus&&q&&q.focus()}
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
