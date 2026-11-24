// v5.78: the button under the mouse gets the class sl-hov (no look of its own any more - each button keeps its own hover). v5.93: the thin
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
(function(){var on=!!window.SL_XMAS_FORCE,K="sl-xmas-preview",L=location;try{var S=window.sessionStorage,m=/[?&](?:christmas(?:=([^&#]*))?|theme=christmas)(?=[&#]|$)/.exec(L.search);
if(m){if(m[1]==="off"||m[1]==="0")S.removeItem(K);else S.setItem(K,"1");var u=new URL(L.href);u.searchParams.delete("christmas");if(u.searchParams.get("theme")==="christmas")u.searchParams.delete("theme");history.replaceState(history.state,"",u.pathname+u.search+u.hash)}
on=on||S.getItem(K)==="1"}catch(e){}
try{if(!on||window.XM)return;var d=document,h=d.documentElement,root=new URL("../",document.currentScript&&document.currentScript.src||L.href).href,kind=(L.href.indexOf(root+"species/")===0?"xm-sp":"xm-site");
window.XM={root:root+"christmas/",kind:kind,forced:!!window.SL_XMAS_FORCE};h.classList.add("xm",kind);var p=d.head||h,c=root+"christmas/xmas.css",j=root+"christmas/xmas.js",cs=d.currentScript;
if(d.readyState==="loading"&&cs&&!cs.src){d.write('<link rel="stylesheet" href="'+c+'"><script src="'+j+'"><\/script>');return}
var l=d.createElement("link");l.rel="stylesheet";l.href=c;p.appendChild(l);var s=d.createElement("script");s.src=j;p.appendChild(s)}catch(e){}})();
