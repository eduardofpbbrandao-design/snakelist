/* Events switch (built into the site by build-site.py and into the claude.ai testing copy by
   tools/build_artifact.py - edit it here).
     https://snakelist.com/?preview=events       turns the events preview on in this browser (remembered)
     https://snakelist.com/?preview=events-off   turns it off again (?preview=off too)
   In the testing copy the Previews panel's "Events" switch does the same (window.SL_PREVIEW_ON). On the website the
   switch is one of tools/previews.js's previews (it follows the signed-in account; Settings > Previews switches it).
   window.SL_EV_PREVIEW_LOAD() loads the preview later in the page (it arrived with the account) - false if the public
   countdown is already running (then the page needs one reload).
   PREVIEW ON ("events", or "newyear" - the New Year 2026-27 preview, events/newyear.js, which needs the same modules):
   the page loads events/events.css and every events/*.js module (countdown, Advent Calendar, seasonal
   achievements, subscription page, cursor customization) straight away, as before.
   PREVIEW OFF (every normal visitor): only the PUBLIC countdown, and only once the opening has completely finished
   (sl-intro-done, then the opening photo left behind, then a quiet moment) - nothing is fetched or run during the
   opening. It first fetches events/config.js; only if publicCountdown is true and one of its publicEvents is in its
   countdown window does it add events.css, core.js, art.js and countdown.js (SL_EV.pub = true). Nothing else from
   events/ (and nothing from christmas/) is ever fetched for a normal visitor. */
(function(){try{var K="sl-art-preview-events",L=location,S=window.localStorage,m=/[?&]preview=([^&#]*)/.exec(L.search),on;
if(m){var v=decodeURIComponent(m[1]);if(v==="events")S.setItem(K,"1");else if(v==="events-off"||v==="off"||v==="none")S.setItem(K,"0");var u=new URL(L.href);u.searchParams.delete("preview");history.replaceState(history.state,"",u.pathname+u.search+u.hash)}
on=window.SL_PREVIEW_ON?(window.SL_PREVIEW_ON("events")||window.SL_PREVIEW_ON("newyear")):(S.getItem(K)==="1"||S.getItem("sl-art-preview-newyear")==="1");
if(window.SL_EV)return;var d=document,h=d.documentElement,root=__ROOT__+"events/",q="?v="+__EVV__,p=d.head||h;
function css(){var l=d.createElement("link");l.rel="stylesheet";l.href=root+"events.css"+q;p.appendChild(l)}
function js(n,f){var s=d.createElement("script");s.src=root+n+".js"+q;s.async=false;if(f)s.onload=f;p.appendChild(s)}
function full(){window.SL_EV={on:true,root:root};h.classList.add("sl-ev-on");css();
["config","advent-logic","core","art","countdown","advent","achievements","subscribe","cursor","newyear"].forEach(function(n){js(n)})}
window.SL_EV_PREVIEW_LOAD=function(){if(window.SL_EV)return!!window.SL_EV.on;full();return true};
if(on){full();return}
var ran=0;function start(){if(ran)return;ran=1;var idle=window.requestIdleCallback||function(f){setTimeout(f,60)};
setTimeout(function(){idle(function(){if(window.SL_EV)return;js("config",function(){var C=window.SL_EVENTS_CONFIG,t=Date.now(),M=2*864e5;
if(!C||!C.publicCountdown||window.SL_EV)return;
if(!(C.events||[]).some(function(e){return(C.publicEvents||[]).indexOf(e.id)>=0&&t>=Date.parse(e.countdownFrom||e.start)-M&&t<Date.parse(e.end)+M}))return;
window.SL_EV={on:false,pub:true,root:root};h.classList.add("sl-ev-pub");css();["core","art","countdown"].forEach(function(n){js(n)})})},{timeout:4000})},1500)}
function hero(){var x=d.getElementById("sl-hero");if(window.__heroEntered||!x||x.hidden)start();else d.addEventListener("sl-hero-entered",start,{once:true})}
if(window.__introDone)hero();else{d.addEventListener("sl-intro-done",hero,{once:true});
window.addEventListener("load",function(){setTimeout(function(){if(!window.__introDone&&!d.getElementById("intro"))start()},60000)})}}catch(e){}})();
