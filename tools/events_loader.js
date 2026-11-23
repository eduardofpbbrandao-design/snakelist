/* Events preview switch (built into the site by build-site.py and into the claude.ai testing copy by
   tools/build_artifact.py - edit it here). Nothing happens for normal visitors.
     https://snakelist.com/?preview=events       turns the events preview on in this browser (remembered)
     https://snakelist.com/?preview=events-off   turns it off again (?preview=off too)
   In the testing copy the Previews panel's "Events" switch does the same (window.SL_PREVIEW_ON). Only while it is on
   does the page load events/events.css and the events/*.js modules (countdown, Advent Calendar, seasonal
   achievements, subscription page, cursor customization); without it nothing is fetched or changed. */
(function(){try{var K="sl-art-preview-events",L=location,S=window.localStorage,m=/[?&]preview=([^&#]*)/.exec(L.search),on;
if(m){var v=decodeURIComponent(m[1]);if(v==="events")S.setItem(K,"1");else if(v==="events-off"||v==="off"||v==="none")S.setItem(K,"0");var u=new URL(L.href);u.searchParams.delete("preview");history.replaceState(history.state,"",u.pathname+u.search+u.hash)}
on=window.SL_PREVIEW_ON?window.SL_PREVIEW_ON("events"):S.getItem(K)==="1";
if(!on||window.SL_EV)return;var d=document,h=d.documentElement,root=__ROOT__+"events/",q="?v="+__EVV__;window.SL_EV={on:true,root:root};h.classList.add("sl-ev-on");
var p=d.head||h,l=d.createElement("link");l.rel="stylesheet";l.href=root+"events.css"+q;p.appendChild(l);
["config","advent-logic","core","art","countdown","advent","achievements","subscribe","cursor"].forEach(function(n){var s=d.createElement("script");s.src=root+n+".js"+q;s.async=false;p.appendChild(s)})}catch(e){}})();
