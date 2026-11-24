/* Christmas preview switch (built into the site by build-site.py and build_species.py - edit it here).
   ?christmas (or ?theme=christmas) turns the preview on for this tab, ?christmas=off turns it off; a build can turn it
   on for good with window.SL_XMAS_FORCE = true before this runs. Only while it is on does the page load
   christmas/xmas.css and christmas/xmas.js; without it nothing else is fetched or changed. In a page's own inline
   script (the app) they are written in as ordinary blocking tags, so the Christmas logo and hats are in place before
   the opening's first frame; from sp.js / country.js / sl-fx.js (deferred) they are added the usual way. */
(function(){var on=!!window.SL_XMAS_FORCE,K="sl-xmas-preview",L=location;try{var S=window.sessionStorage,m=/[?&](?:christmas(?:=([^&#]*))?|theme=christmas)(?=[&#]|$)/.exec(L.search);
if(m){if(m[1]==="off"||m[1]==="0")S.removeItem(K);else S.setItem(K,"1");var u=new URL(L.href);u.searchParams.delete("christmas");if(u.searchParams.get("theme")==="christmas")u.searchParams.delete("theme");history.replaceState(history.state,"",u.pathname+u.search+u.hash)}
on=on||S.getItem(K)==="1"}catch(e){}
try{if(!on||window.XM)return;var d=document,h=d.documentElement,root=__ROOT__,kind=__KIND__;
window.XM={root:root+"christmas/",kind:kind,forced:!!window.SL_XMAS_FORCE};h.classList.add("xm",kind);var p=d.head||h,c=root+"christmas/xmas.css",j=root+"christmas/xmas.js",cs=d.currentScript;
if(d.readyState==="loading"&&cs&&!cs.src){d.write('<link rel="stylesheet" href="'+c+'"><script src="'+j+'"><\/script>');return}
var l=d.createElement("link");l.rel="stylesheet";l.href=c;p.appendChild(l);var s=d.createElement("script");s.src=j;p.appendChild(s)}catch(e){}})();
