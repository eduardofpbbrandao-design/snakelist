(function(){
var m=document.querySelector('.sp-map');
if(m){fetch('world.svg').then(function(r){return r.text()}).then(function(t){m.innerHTML=t;var s=m.querySelector('svg');
s.setAttribute('viewBox',m.dataset.view||'0 0 1440 720');s.setAttribute('preserveAspectRatio','xMidYMid meet');
(m.dataset.codes||'').split(' ').forEach(function(c){var p=c&&s.getElementById('c-'+c);if(p){p.classList.add('on');s.appendChild(p)}})}).catch(function(){})}
var main=document.querySelector('.sp-main[data-sci]'),w=document.getElementById('sp-wiki');
if(main&&w){fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(main.dataset.sci.replace(/ /g,'_'))).then(function(r){return r.ok?r.json():null}).then(function(d){
if(!d||!d.extract||d.type==='disambiguation')return;var p=document.createElement('p');p.textContent=d.extract;w.appendChild(p);
var s=document.createElement('p');s.className='src';s.innerHTML='From <a href="'+d.content_urls.desktop.page+'" rel="noopener" target="_blank">Wikipedia</a> (CC BY-SA)';w.appendChild(s)}).catch(function(){})}
})();
