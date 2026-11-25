/* SnakeList cookie and ad consent - the ONE source for every page (build-site.py puts it inside the app's <head>,
   tools/add_adsense.py adds <script src="sl-consent.js" defer> to the other pages). See docs/ADS-CONSENT-SETUP.md.
   - Google Consent Mode v2: everything is "denied" before any Google tag runs; it changes only with the visitor's choice.
   - Europe (EEA, UK, Switzerland - guessed from the time zone): Google's own certified consent message (AdSense >
     Privacy & messaging) decides about ads. When it is there, SnakeList's own banner is not shown at all and the
     visitor's answer to Google's message is used for analytics too. Until it is switched on, ads there stay
     non-personalised and SnakeList's banner asks only about analytics.
   - Everywhere else: SnakeList's banner (Accept / Reject / Manage). The ads script loads only after an answer; with
     Reject, ads are limited / non-personalised and use no ad cookies.
   - Auto-placed ads are never left inside the header, the map, the cards and photos, the 3D viewer, the events or
     any panel (a MutationObserver that only runs once the ads script is on the page).
   PREVIEW (Settings > Previews > "Cookie bar", localStorage sl-art-preview-cookies = "1"): everything a visitor SEES of
   this file - the new Reject / Manage / Accept bar on the other pages, the Manage panel, the "Cookie choices" links -
   shows only with that switch on. The protective part (Consent Mode v2 "denied" defaults, Google's consent message in
   Europe, the ad placement guard, and in the app no ads script before an answer outside Europe) runs for everyone.
   On the other pages, with the switch off, nobody is asked there yet, so the ads script still loads (as before), but
   with everything "denied" and non-personalised ads until the visitor answers in SnakeList. */
(function () {
  "use strict";
  var W = window, D = document;
  if (W.SLC) return;
  var CLIENT = "ca-pub-0736553562389933";
  var me = D.currentScript, APP = !!W.SLC_APP;
  var ROOT = (me && me.getAttribute("data-root")) || "";
  W.dataLayer = W.dataLayer || [];
  if (typeof W.gtag !== "function") W.gtag = function () { W.dataLayer.push(arguments); };
  var gtag = W.gtag;

  // the cookies preview (see above): only its visible part waits for this switch
  function PV() { try { return localStorage.getItem("sl-art-preview-cookies") === "1"; } catch (e) { return false; } }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  // ---- where the visitor probably is (EEA / UK / Switzerland need Google's certified consent message) ----
  var tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  var STRICT = !tz || (/^(Europe\/|Atlantic\/(Canary|Madeira|Azores|Reykjavik|Faroe|Faeroe)|Arctic\/Longyearbyen|Asia\/(Nicosia|Famagusta)|America\/(Guadeloupe|Martinique|Cayenne|Marigot|St_Barthelemy)|Indian\/(Reunion|Mayotte))/.test(tz)
    && !/^Europe\/(Moscow|Kirov|Volgograd|Saratov|Ulyanovsk|Astrakhan|Samara|Kaliningrad|Istanbul|Minsk|Kiev|Kyiv|Simferopol|Chisinau)$/.test(tz));

  // ---- Consent Mode v2: denied until the visitor says otherwise ----
  gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied",
    functionality_storage: "granted", security_storage: "granted", wait_for_update: 500 });
  gtag("set", "ads_data_redaction", true);

  // the stored choice: sl-consent = "yes" / "no" (analytics + "Picked for you"), sl-ads = "yes" / "no" (ad personalisation).
  // An older answer (before ads were asked about) counts as answered, with ads not personalised.
  function analytics() { return ls("sl-consent") === "yes"; }
  function adsOk() { return !STRICT && ls("sl-ads") === "yes"; }
  function answered() { return ls("sl-consent") != null; }
  var cmp = null;          // null: not known yet, true: Google's consent message handles this visitor, false: it doesn't
  var known = !STRICT, waiting = [], adsWanted = false, adsIn = false;

  function push() {
    var u = { analytics_storage: analytics() ? "granted" : "denied" };
    if (!cmp) { var a = adsOk() ? "granted" : "denied"; u.ad_storage = a; u.ad_user_data = a; u.ad_personalization = a; }
    gtag("consent", "update", u);
    // (in Europe Google's consent message decides: forcing non-personalised ads there would overrule a "yes" given to it)
    if (!STRICT) (W.adsbygoogle = W.adsbygoogle || []).requestNonPersonalizedAds = adsOk() ? 0 : 1;
  }
  if (answered()) push();

  // remove cookies Google already set on this site, when the visitor turns that part off
  function drop(re) {
    D.cookie.split(";").forEach(function (c) {
      var n = c.split("=")[0].trim(); if (!re.test(n)) return;
      var h = location.hostname.split(".");
      for (var i = 0; i < h.length - 1; i++) D.cookie = n + "=; Max-Age=0; path=/; domain=." + h.slice(i).join(".");
      D.cookie = n + "=; Max-Age=0; path=/";
    });
  }
  function emit(fromCmp) {
    try { D.dispatchEvent(new CustomEvent("sl-consent-change", { detail: { analytics: analytics(), ads: adsOk(), cmp: !!fromCmp } })); } catch (e) {}
    try { D.dispatchEvent(new Event("sl-consent-answered")); } catch (e) {}
  }
  // o: { analytics: bool, ads: bool (left out = unchanged) }
  function choose(o) {
    ls("sl-consent", o.analytics ? "yes" : "no");
    if (o.ads !== undefined) ls("sl-ads", o.ads ? "yes" : "no");
    if (!o.analytics) { drop(/^(_ga|_gid|_gat)/); ls("sl-interests", null); }
    if (!adsOk()) drop(/^(__gads|__gpi|__eoi|_gcl_)/);
    ls("sl-consent-at", String(Date.now()));
    push(); hideBar(); emit(false);
    if (adsWanted) loadAds();
  }

  // ---- Google's certified consent message (TCF v2.2), when the AdSense account has it switched on ----
  function setCmp(v) {
    if (cmp === true) return; cmp = v; known = true;
    if (v) hideBar();
    var q = waiting; waiting = []; q.forEach(function (f) { try { f(); } catch (e) {} });
  }
  function fromTcf(tc) {
    var P = (tc.purpose && tc.purpose.consents) || {}, V = (tc.vendor && tc.vendor.consents) || {}, g = !!V[755];
    var st = !!(P[1] && g), ok = function (b) { return b ? "granted" : "denied"; };
    gtag("consent", "update", { ad_storage: ok(st), ad_user_data: ok(P[1] && P[7] && g), ad_personalization: ok(P[3] && P[4] && g), analytics_storage: ok(st) });
    if (ls("sl-consent") !== (st ? "yes" : "no") || tc.eventStatus === "useractioncomplete") {
      ls("sl-consent", st ? "yes" : "no"); if (!st) { drop(/^(_ga|_gid|_gat)/); ls("sl-interests", null); }
      emit(true);
    }
  }
  function watchCmp() {
    var n = 0;
    (function look() {
      if (typeof W.__tcfapi === "function") {
        try {
          W.__tcfapi("addEventListener", 2, function (tc, ok) {
            if (!ok || !tc) return;
            if (tc.gdprApplies === false) { if (cmp === null) setCmp(false); return; }
            if (tc.gdprApplies) { setCmp(true); if (tc.eventStatus === "tcloaded" || tc.eventStatus === "useractioncomplete") fromTcf(tc); }
          });
        } catch (e) { setCmp(false); }
        // a message that never answers (switched off, blocked) must not keep SnakeList's own question away for ever
        setTimeout(function () { if (cmp === null) setCmp(false); }, 6000);
        return;
      }
      if (++n < 25) setTimeout(look, 300); else if (cmp === null) setCmp(false);
    })();
  }

  // ---- the ads script: only after the defaults above, and (outside Europe) only after an answer ----
  function loadAds() {
    adsWanted = true;
    // (the other pages without the cookies preview have no question to answer yet: denied + non-personalised until then)
    if (adsIn || (!STRICT && !answered() && (APP || PV()))) return;
    adsIn = true; push(); guard();
    var s = D.createElement("script"); s.async = true; s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + CLIENT;
    if (STRICT) { s.onload = watchCmp; s.onerror = function () { setCmp(false); }; }
    (D.head || D.documentElement).appendChild(s);
  }

  // ---- ad placement safety ----
  var NOADS = "header, nav, dialog, [role=dialog], [aria-modal=true], [data-sl-noads], #sl-hero, #grid, .card, figure, .map-wrap, .map-sheet, " +
    ".lmap, .leaflet-container, .quiz-map-box, .sl3d-bd, .sl-achdlg, .sl-achbox, [id^=sl-ev-], [class*=sl-ev-], [class*=xm-], .sp-head, .sp-photo, .sp-gal, .ck-bar, .slc-bar, .slc-panel";
  var guarded = false;
  function fix(n) {
    var el = n.classList && n.classList.contains("google-auto-placed") ? n : (n.tagName === "INS" && n.className.indexOf("adsbygoogle") >= 0 ? n : null);
    if (!el || el.hasAttribute("data-anchor-status") || el.hasAttribute("data-vignette-loaded")) return; // overlays: see the CSS below
    // (html and body don't count: the events put their own classes on them)
    for (var p = el.parentElement; p && p !== D.body && p !== D.documentElement; p = p.parentElement) if (p.matches(NOADS)) { el.remove(); return; }
  }
  function guard() {
    if (guarded) return; guarded = true;
    var css = D.createElement("style"); css.id = "slc-ads-css";
    css.textContent = "ins.adsbygoogle,.google-auto-placed{max-width:100%!important;overflow:hidden}" +
      // an anchor or vignette ad never stays over an open panel, the photo viewer, the 3D viewer or the events
      "html.sl-modal-on ins.adsbygoogle[data-anchor-status],html.sl-achdlg-on ins.adsbygoogle[data-anchor-status],html.slc-open ins.adsbygoogle[data-anchor-status]{visibility:hidden!important}";
    (D.head || D.documentElement).appendChild(css);
    var go = function () {
      if (!D.body) return setTimeout(go, 200);
      new MutationObserver(function (rs) {
        for (var i = 0; i < rs.length; i++) { var a = rs[i].addedNodes; for (var j = 0; j < a.length; j++) { var n = a[j]; if (n.nodeType === 1 && (n.tagName === "INS" || n.tagName === "DIV" && n.className && typeof n.className === "string" && n.className.indexOf("google-auto-placed") >= 0)) fix(n); } }
      }).observe(D.body, { childList: true, subtree: true });
    };
    go();
  }

  // ---- SnakeList's own banner (the app has its own markup, #ck-bar; the other pages get this one) ----
  var bar = null, panel = null, lastFocus = null;
  var STYLE = ".slc-bar{position:fixed;left:16px;right:16px;bottom:16px;z-index:9200;max-width:760px;margin:0 auto;display:flex;gap:14px;align-items:center;padding:12px 14px 12px 16px;border-radius:16px;font:13px/1.45 Inter,system-ui,sans-serif;animation:slcUp .3s ease-out}" +
    ".slc-bar p{margin:0;flex:1}.slc-bar b{font-weight:600}.slc-bar a{color:inherit}" +
    ".slc-btns{display:flex;gap:8px;flex:none}" +
    ".slc-btns button,.slc-acts button{padding:9px 14px;border-radius:10px;font:600 13px Inter,system-ui,sans-serif;cursor:pointer;border:1px solid rgba(88,179,81,.55);background:transparent;color:inherit}" +
    ".slc-btns .slc-yes,.slc-acts .slc-yes{background:#58b351;color:#fff;border-color:#58b351}" +
    ".slc-btns button:focus-visible,.slc-acts button:focus-visible,.slc-sw:focus-visible,.slc-x:focus-visible{outline:2px solid #58b351;outline-offset:2px}" +
    "@keyframes slcUp{from{transform:translateY(16px);opacity:0}}" +
    "@media (prefers-reduced-motion:reduce){.slc-bar,.slc-panel{animation:none!important}}" +
    "@media (max-width:600px){.slc-bar{flex-direction:column;align-items:stretch;gap:10px;left:10px;right:10px;bottom:10px;padding:12px;font-size:12.5px}.slc-btns button{flex:1;padding:9px 6px}}" +
    ".slc-bd{position:fixed;inset:0;z-index:10060;background:rgba(10,30,15,.45);display:flex;align-items:center;justify-content:center;padding:16px}" +
    ".slc-panel{box-sizing:border-box;width:100%;max-width:440px;max-height:calc(100vh - 32px);overflow:auto;border-radius:18px;padding:18px 18px 16px;font:14px/1.45 Inter,system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.35);animation:slcUp .25s ease-out}" +
    ".slc-panel h2{margin:0;font:700 18px Inter,system-ui,sans-serif}.slc-panel .slc-sub{margin:4px 0 12px;font-size:13px;opacity:.85}" +
    ".slc-hd{display:flex;align-items:flex-start;gap:10px}.slc-hd>div{flex:1}" +
    ".slc-x{flex:none;border:0;background:none;color:inherit;font-size:24px;line-height:1;cursor:pointer;padding:0 4px;border-radius:8px}" +
    ".slc-row{display:flex;gap:12px;align-items:center;padding:11px 12px;border-radius:12px;margin-bottom:8px}" +
    ".slc-row span{flex:1}.slc-row b{display:block;font-weight:600}.slc-row small{display:block;font-size:12.5px;opacity:.85;margin-top:2px}" +
    ".slc-on{flex:none;font:600 12px Inter,system-ui,sans-serif;color:#58b351;white-space:nowrap}" +
    ".slc-sw{flex:none;position:relative;width:46px;height:26px;border-radius:99px;border:0;padding:0;cursor:pointer;background:rgba(120,130,120,.45);transition:background-color .2s}" +
    ".slc-sw::after{content:'';position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s}" +
    ".slc-sw[aria-checked=true]{background:#58b351}.slc-sw[aria-checked=true]::after{transform:translateX(20px)}" +
    ".slc-acts{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}.slc-acts button{flex:1 1 auto}" +
    ".slc-note{font-size:12.5px;opacity:.85;margin:6px 2px 0}.slc-note a{color:inherit}" +
    "@media (max-width:600px){.slc-bd{align-items:flex-end;padding:0}.slc-panel{max-width:none;border-radius:18px 18px 0 0;max-height:88vh;padding-bottom:calc(16px + env(safe-area-inset-bottom))}}" +
    // light (SnakeList's light pop-ups) and dark (its deep green)
    ".slc-bar,.slc-panel{background:linear-gradient(160deg,#f6fbf1,#e1eed5);color:#1c3a22;border:1px solid rgba(47,107,51,.25);box-shadow:0 14px 40px rgba(20,50,25,.25)}.slc-row{background:rgba(88,179,81,.10)}.slc-on{color:#2f7a35}" +
    "html[data-sl-theme=dark] .slc-bar,html[data-sl-theme=dark] .slc-panel{background:linear-gradient(160deg,#256846,#22623f);color:#f0f8ec;border-color:rgba(160,222,140,.3);box-shadow:0 14px 40px rgba(0,0,0,.4)}" +
    "html[data-sl-theme=dark] .slc-row{background:rgba(0,0,0,.14)}html[data-sl-theme=dark] .slc-on{color:#a8ef94}" +
    "@media (prefers-color-scheme:dark){html:not([data-sl-theme]) .slc-bar,html:not([data-sl-theme]) .slc-panel{background:linear-gradient(160deg,#256846,#22623f);color:#f0f8ec;border-color:rgba(160,222,140,.3);box-shadow:0 14px 40px rgba(0,0,0,.4)}html:not([data-sl-theme]) .slc-row{background:rgba(0,0,0,.14)}html:not([data-sl-theme]) .slc-on{color:#a8ef94}}";
  function css() { if (D.getElementById("slc-css")) return; var s = D.createElement("style"); s.id = "slc-css"; s.textContent = STYLE; D.head.appendChild(s); }
  function privacy() { return (APP ? "https://snakelist.com/" : ROOT) + "privacy.html#analytics"; }
  function hideBar() { if (bar) bar.hidden = true; var a = D.getElementById("ck-bar"); if (a && cmp) a.hidden = true; }
  function showBar() {
    if (APP || answered() || cmp || !PV()) return;
    css();
    if (!bar) {
      bar = D.createElement("div"); bar.className = "slc-bar"; bar.id = "slc-bar"; bar.setAttribute("role", "dialog"); bar.setAttribute("aria-label", "Cookies");
      bar.innerHTML = "<p><b>Cookies?</b> " + (STRICT ? "With your OK, Google Analytics may use cookies to count visits." :
        "With your OK, Google Analytics may use cookies to count visits and Google may personalise the ads. Without it, those cookies stay off.") +
        ' <a href="' + privacy() + '">Privacy</a></p><div class="slc-btns"><button type="button" class="slc-no">Reject</button><button type="button" class="slc-more">Manage</button><button type="button" class="slc-yes">Accept cookies</button></div>';
      bar.querySelector(".slc-no").onclick = function () { choose({ analytics: false, ads: false }); };
      bar.querySelector(".slc-yes").onclick = function () { choose({ analytics: true, ads: true }); };
      bar.querySelector(".slc-more").onclick = function () { manage(); };
      D.body.appendChild(bar);
    }
    bar.hidden = false;
  }

  // ---- Manage: a small panel with the three switches ----
  function manage() {
    if (cmp && W.googlefc && typeof W.googlefc.showRevocationMessage === "function") { W.googlefc.showRevocationMessage(); return; }
    css(); closePanel(true);
    var a = answered() ? analytics() : false, ad = answered() ? ls("sl-ads") === "yes" : false;
    lastFocus = D.activeElement;
    var bd = D.createElement("div"); bd.className = "slc-bd"; bd.id = "slc-manage";
    var adsRow = STRICT
      ? '<p class="slc-note">Ads: in Europe, Google\'s own consent message asks about ads. Until you say yes there, any ads on SnakeList are not personalised.</p>'
      : '<div class="slc-row"><span><b>Advertising personalisation</b><small>Lets Google use cookies to show ads based on your interests. Off: ads may still appear, but they aren\'t personalised and use no ad cookies.</small></span>' +
        '<button type="button" class="slc-sw" role="switch" id="slc-ads" aria-label="Advertising personalisation" aria-checked="' + ad + '"></button></div>';
    bd.innerHTML = '<div class="slc-panel" role="dialog" aria-modal="true" aria-labelledby="slc-h"><div class="slc-hd"><div><h2 id="slc-h">Cookie choices</h2>' +
      '<p class="slc-sub">Choose what SnakeList may use. You can change it any time from Cookie choices.</p></div><button type="button" class="slc-x" aria-label="Close">&times;</button></div>' +
      '<div class="slc-row"><span><b>Essential</b><small>Keeps your list, your settings and this choice on this device.</small></span><span class="slc-on" style="flex:none">Always on</span></div>' +
      '<div class="slc-row"><span><b>Analytics</b><small>Google Analytics counts visits with cookies, and SnakeList remembers what you look at (on this device only) for Picked for you.</small></span>' +
      '<button type="button" class="slc-sw" role="switch" id="slc-an" aria-label="Analytics" aria-checked="' + a + '"></button></div>' + adsRow +
      '<div class="slc-acts"><button type="button" class="slc-no">Reject all</button><button type="button" class="slc-save">Save choices</button><button type="button" class="slc-yes">Accept all</button></div>' +
      '<p class="slc-note"><a href="' + privacy() + '" target="_blank" rel="noopener">How SnakeList uses cookies</a></p></div>';
    D.body.appendChild(bd); panel = bd; D.documentElement.classList.add("slc-open");
    var sw = function (id) { var b = bd.querySelector("#" + id); return b && b.getAttribute("aria-checked") === "true"; };
    [].forEach.call(bd.querySelectorAll(".slc-sw"), function (b) { b.onclick = function () { b.setAttribute("aria-checked", String(b.getAttribute("aria-checked") !== "true")); }; });
    bd.querySelector(".slc-x").onclick = function () { closePanel(); };
    bd.onclick = function (e) { if (e.target === bd) closePanel(); };
    bd.querySelector(".slc-no").onclick = function () { closePanel(); choose({ analytics: false, ads: false }); };
    bd.querySelector(".slc-yes").onclick = function () { closePanel(); choose({ analytics: true, ads: !STRICT }); };
    bd.querySelector(".slc-save").onclick = function () { var o = { analytics: sw("slc-an") }; if (!STRICT) o.ads = sw("slc-ads"); closePanel(); choose(o); };
    bd.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePanel(); }
      if (e.key === "Tab") { var f = bd.querySelectorAll("button, a"), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && D.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && D.activeElement === last) { e.preventDefault(); first.focus(); } }
    });
    setTimeout(function () { try { bd.querySelector("#slc-an").focus({ preventScroll: true }); } catch (e) {} }, 30);
    // Escape closes this panel first, wherever the focus is (opened from Settings, the focus may still be there)
    escH = function (e) { if (e.key === "Escape" && panel) { e.preventDefault(); e.stopImmediatePropagation(); closePanel(); } };
    D.addEventListener("keydown", escH, true);
  }
  var escH = null;
  function closePanel(quiet) {
    if (!panel) return; panel.remove(); panel = null; D.documentElement.classList.remove("slc-open");
    if (escH) { D.removeEventListener("keydown", escH, true); escH = null; }
    if (!quiet && lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }

  function whenKnown(f) { if (known) f(); else waiting.push(f); }
  W.SLC = {
    strict: STRICT, choose: choose, manage: manage, loadAds: loadAds, whenKnown: whenKnown, answered: answered,
    known: function () { return known; }, cmpHandles: function () { return cmp === true; },
    state: function () { return { analytics: analytics(), ads: adsOk(), answered: answered(), strict: STRICT, cmp: cmp }; }
  };

  // "Cookie choices" links: any element with data-slc-open (or href="#cookie-choices") opens the choices
  D.addEventListener("click", function (e) {
    var t = e.target && e.target.closest && e.target.closest("[data-slc-open], a[href='#cookie-choices']");
    if (t) { e.preventDefault(); manage(); }
  });

  // the other pages: a "Cookie choices" link in the footer, the ads once the page has loaded, and the question
  if (!APP) {
    var start = function () {
      var f = D.querySelector(".sl-foot .sl-flinks, .site-foot .links, footer");
      if (f && PV() && !f.querySelector("[data-slc-open]")) { var l = D.createElement("a"); l.href = "#cookie-choices"; l.setAttribute("data-slc-open", ""); l.textContent = "Cookie choices"; if (f.tagName === "FOOTER" && !f.classList.contains("links")) { f.appendChild(D.createTextNode(" ")); } f.appendChild(l); }
      if (!answered()) whenKnown(function () { setTimeout(showBar, 600); });
      var later = function () { loadAds(); };
      if (D.readyState === "complete") setTimeout(later, 300); else W.addEventListener("load", function () { setTimeout(later, 300); }, { once: true });
    };
    if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", start, { once: true }); else start();
  }
})();
