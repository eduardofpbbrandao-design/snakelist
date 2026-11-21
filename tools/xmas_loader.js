/* Christmas preview switch (built into the site by build-site.py and build_species.py - edit it here).
   ?christmas (or ?theme=christmas) turns the preview on for this tab, ?christmas=off turns it off. Only while it is on
   does the page load christmas/xmas.css and christmas/xmas.js; without it nothing else is fetched or changed. */
(function(){try{var K="sl-xmas-preview",S=window.sessionStorage,L=location,m=/[?&](?:christmas(?:=([^&#]*))?|theme=christmas)(?=[&#]|$)/.exec(L.search);
if(m){if(m[1]==="off"||m[1]==="0")S.removeItem(K);else S.setItem(K,"1");var u=new URL(L.href);u.searchParams.delete("christmas");if(u.searchParams.get("theme")==="christmas")u.searchParams.delete("theme");history.replaceState(history.state,"",u.pathname+u.search+u.hash)}
if(S.getItem(K)!=="1"||window.XM)return;var d=document,h=d.documentElement,root=__ROOT__,kind=__KIND__;
window.XM={root:root+"christmas/",kind:kind};h.classList.add("xm",kind);var p=d.head||h,l=d.createElement("link");l.rel="stylesheet";l.href=root+"christmas/xmas.css";p.appendChild(l);
var s=d.createElement("script");s.src=root+"christmas/xmas.js";p.appendChild(s)}catch(e){}})();
