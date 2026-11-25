/* Previews registry (built into the site's <head> by build-site.py, BEFORE tools/events_loader.js - edit it here).
   Previews are features still being tried out (not public yet). Each one is a switch kept in this browser as
   localStorage "sl-art-preview-<key>" ("1" on, "0" off - the events preview's old key stays the same), and - when
   someone is signed in - in their SnakeList account too: snakelist-synced.html syncs these keys with the list (the
   same way as favourites), so on any device where that account signs in the same previews turn on.
     window.SL_PREVIEWS.on(key)            is it on here?
     window.SL_PREVIEWS.set(key, bool)     switch it (the account follows at the next sync)
     window.SL_PREVIEWS.list()             [{key, label, about, on}] - every known preview
     window.SL_PREVIEWS.any()              is at least one on? (only then does Settings show its Previews section)
     window.SL_PREVIEW_ON(key)             the same as .on() (the claude.ai testing copy defines its own - kept as it is)
   URL switches: ?preview=<key> turns one on, ?preview=<key>-off turns it off, ?preview=off (or none) turns all off,
   ?preview=all turns on the five waiting for approval (opening, design, cookies, tutorial, finale).
   Each preview that is on when the page starts puts the class sl-pv-<key> on <html> here, before anything is drawn (the
   app's SL_PV_ON(key) reads that class): the design preview's styles, the new cookie bar and the new tutorial follow it.
   Settings > Previews shows when a preview is on, or - for someone signed in - once ?preview=all has been used in this
   browser or account ("sl-art-preview-menu", synced like the switches; Settings' "Turn all previews on" sets it too).
   Their own switches work as well: ?opening=collage (new opening) and ?countdown-finale-preview=1 (countdown finale).
   A new preview = one more entry in DEFS below (its key must be here for it to follow the account), and its own code
   asks SL_PREVIEWS.on(key). For a normal visitor (nothing switched on) this does nothing and loads nothing. */
(function(){try{var W=window,S=W.localStorage,L=location,PRE="sl-art-preview-",P=W.SL_PREVIEWS;
if(P&&typeof P.on==="function")return;
var DEFS=[
 {key:"events",label:"Christmas events",about:"Countdown, Advent Calendar, seasonal achievements, subscription page, cursor",
  live:function(){return W.SL_EV_PREVIEW_LOAD?W.SL_EV_PREVIEW_LOAD():false}},
 {key:"opening",label:"New opening",about:"The opening as a poster collage",
  apply:function(v){try{var ss=W.sessionStorage;if(v){if(!/[?&]opening=/.test(L.search)&&!ss.getItem("sl-opening-style"))ss.setItem("sl-opening-style","collage")}else if(ss.getItem("sl-opening-style")==="collage")ss.removeItem("sl-opening-style")}catch(e){}},
  live:function(){return true}},
 {key:"design",label:"New design",about:"The design overhaul: clearer colours and contrast, fonts, cards, dialogs, bigger touch targets, phone tabs, wording - and your own photo with \"Taken on\" in My sightings",
  live:function(){return false}},
 {key:"cookies",label:"New cookie bar",about:"Accept / Reject / Manage, Cookie choices in Settings and at the bottom of the page",
  live:function(){return false}},
 {key:"tutorial",label:"New tutorial",about:"Quick Tour, Full Tutorial and short guides, with Back and a progress bar (the ? button opens it)",
  live:function(){return false}},
 {key:"finale",label:"Countdown finale + time zone",about:"The countdown's last minute plays about 70 seconds after SnakeList opens (pretend time, nothing unlocks), and Settings gets a Time zone choice",
  apply:function(v){if(v)W.__slCdFinPv=1},
  live:function(){return !W.SL_EV}}
];
var ALL=["opening","design","cookies","tutorial","finale"],MENU=PRE+"menu";
function def(k){for(var i=0;i<DEFS.length;i++)if(DEFS[i].key===k)return DEFS[i];return null}
function on(k){try{return S.getItem(PRE+k)==="1"}catch(e){return false}}
function emit(){try{document.dispatchEvent(new CustomEvent("sl-previews-changed"))}catch(e){}}
function set(k,v){v=!!v;if(!def(k))return;try{S.setItem(PRE+k,v?"1":"0")}catch(e){}var d=def(k);if(d.apply&&!v)d.apply(false);emit()}
// the switches in the address (each one is then taken out of it, except the opening's, which its own code reads)
var q=L.search,m=/[?&]preview=([^&#]*)/.exec(q);
if(m){var v=decodeURIComponent(m[1]),k=v.replace(/-off$/,"");
 if(v==="off"||v==="none")DEFS.forEach(function(x){if(S.getItem(PRE+x.key)!==null)S.setItem(PRE+x.key,"0")});
 else if(v==="all"){ALL.forEach(function(x){S.setItem(PRE+x,"1")});S.setItem(MENU,"1")}
 else if(def(k))S.setItem(PRE+k,k===v?"1":"0");
 var u=new URL(L.href);u.searchParams.delete("preview");history.replaceState(history.state,"",u.pathname+u.search+u.hash)}
var o=/[?&]opening=([^&#]*)/.exec(q);if(o){if(o[1]==="collage")S.setItem(PRE+"opening","1");else if(/^(off|classic|none|default)$/.test(o[1]))S.setItem(PRE+"opening","0")}
if(/[?&]countdown-finale-preview=1(&|$)/.test(q))S.setItem(PRE+"finale","1");
else if(/[?&]countdown-finale-preview=0(&|$)/.test(q))S.setItem(PRE+"finale","0");
// what this page started with: a preview that arrives later (from the account) is switched on in place, or with one reload
var loaded={},H=document.documentElement;DEFS.forEach(function(x){loaded[x.key]=on(x.key);if(loaded[x.key]){H.classList.add("sl-pv-"+x.key);if(x.apply)x.apply(true)}});
var R={
 on:on,set:set,
 list:function(){return DEFS.map(function(x){return{key:x.key,label:x.label,about:x.about,on:on(x.key)}})},
 any:function(){return DEFS.some(function(x){return on(x.key)})},
 keys:function(){return DEFS.map(function(x){return PRE+x.key}).concat([MENU])},
 // Settings shows its Previews section for someone signed in once this is set (see above)
 menu:function(v){try{if(v)S.setItem(MENU,"1");return S.getItem(MENU)==="1"}catch(e){return false}},
 loaded:function(k){return!!loaded[k]},
 // called by the account sync (snakelist-synced.html) after the account's switches were put in this browser.
 // signedInHere: someone signed in on this page just now - then, if a preview can't start in place, one quiet reload
 synced:function(info){var fresh=DEFS.filter(function(x){return on(x.key)&&!loaded[x.key]});if(!fresh.length)return;
  var need=false;fresh.forEach(function(x){if(x.apply)x.apply(true);var ok=false;try{ok=x.live?!!x.live():false}catch(e){}if(ok)loaded[x.key]=true;else need=true});
  emit();if(!need||!(info&&info.signedInHere))return;
  try{if(W.sessionStorage.getItem("sl-prev-reloaded"))return;W.sessionStorage.setItem("sl-prev-reloaded","1")}catch(e){return}
  var go=function(){setTimeout(function(){L.reload()},400)},h=document.getElementById("sl-hero");
  if(W.__introDone&&!(h&&!h.hidden&&!W.__heroEntered))go();else document.addEventListener(W.__introDone?"sl-hero-entered":"sl-intro-done",go,{once:true})},
 define:function(x){if(x&&x.key&&!def(x.key)){DEFS.push(x);loaded[x.key]=on(x.key)}}
};
if(Array.isArray(P)){for(var n in R)P[n]=R[n];R=P}
W.SL_PREVIEWS=R;
if(!W.SL_PREVIEW_ON)W.SL_PREVIEW_ON=on;
}catch(e){}})();
