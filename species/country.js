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
[q,fv,ff,fs].forEach(function(el){if(el)el.addEventListener(el===q?'input':'change',function(){apply()})});
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
