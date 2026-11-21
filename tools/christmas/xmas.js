/* SnakeList - Christmas preview: the moving and added parts of the theme (styles are in xmas.css).
   Loaded only while the preview switch is on (?christmas - see tools/xmas_loader.js). XM_ART (bulb positions,
   sprig, hat) is put in front of this file by tools/build-christmas.py. Everything here is decoration: it never takes clicks, never covers words,
   stops when it is off screen or the tab is hidden, and holds still for "reduce motion". */
(function () {
  "use strict";
  // normally the switch (tools/xmas_loader.js) sets XM up; a build that includes these files directly (with
  // window.SL_XMAS_FORCE = true) gets the same from here: the folder this script came from, the app, the classes
  var XM = window.XM || (window.XM = { forced: !!window.SL_XMAS_FORCE });
  var ART = window.XM_ART || {};
  var D = document, me = D.currentScript && D.currentScript.src;
  if (!XM.root) XM.root = me ? new URL("./", me).href : new URL("christmas/", location.href).href;
  if (!XM.kind) XM.kind = D.querySelector(".sp-main, .sl-top") ? "xm-sp" : "xm-app";
  D.documentElement.classList.add("xm", XM.kind);
  var ROOT = XM.root;   // the christmas/ folder
  // its styles, if nothing has loaded them yet
  if (!D.querySelector('link[href*="xmas.css"], style[data-xmas]')) { var css = D.createElement("link"); css.rel = "stylesheet"; css.href = ROOT + "xmas.css"; (D.head || D.documentElement).appendChild(css); }
  // a file of the theme (a build may hand them over as data: URLs in XM_ART.files)
  function asset(n) { return (ART.files && ART.files[n]) || ROOT + n; }
  XM.asset = asset;
  var RM = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false, addEventListener: function () {} };
  var store = { get: function (k) { try { return sessionStorage.getItem("sl-xmas-" + k); } catch (e) { return null; } },
                set: function (k, v) { try { sessionStorage.setItem("sl-xmas-" + k, v); } catch (e) {} } };

  /* ---------- the Santa hat on the logo snake: found by its eye, sized to its head, never over the eye ---------- */
  XM.hat = function () {
    var g = D.getElementById("mark-snake"); if (!g || !ART.hat || g.querySelector(".xm-hat")) return !!g;
    var e = null, cs = g.getElementsByTagName("circle");
    for (var i = 0; i < cs.length; i++) if (/sl-eye/.test(cs[i].getAttribute("fill") || "")) { e = cs[i]; break; }
    if (!e) return false;
    var h = e.parentNode, hp = h.getElementsByTagName("path")[0], k = 1, y0 = -16.5, d = hp && hp.getAttribute("d") || "", n = d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || [];
    if (n.length > 5 && n.length % 2 === 0 && !/[AaHhVv]/.test(d)) { var ys = []; for (i = 1; i < n.length; i += 2) ys.push(+n[i]); y0 = Math.min.apply(0, ys); k = (Math.max.apply(0, ys) - y0) / 33 || 1; }
    var ex = +e.getAttribute("cx") || 9, t = D.createElementNS("http://www.w3.org/2000/svg", "g");
    t.setAttribute("transform", "translate(" + (ex - 9 * k).toFixed(2) + " " + (y0 + 16.5 * k).toFixed(2) + ") scale(" + k.toFixed(3) + ")");
    t.setAttribute("style", "opacity:var(--xm-hat-o,1)"); t.innerHTML = ART.hat; h.appendChild(t);
    return true;
  };

  /* ---------- the Christmas icon: browser tab, home screen and the icon pictures on the pages ---------- */
  function icons() {
    var head = D.head; if (!head) return;
    if (!D.querySelector("link[data-xm-icon]")) {
      [].slice.call(D.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')).forEach(function (l) { l.remove(); });
      [["icon", "xmas-icon.svg", "image/svg+xml"], ["icon", "xmas-icon-48.png", "image/png"], ["apple-touch-icon", "xmas-icon-180.png"]].forEach(function (a) {
        var l = D.createElement("link"); l.rel = a[0]; l.href = asset(a[1]); if (a[2]) l.type = a[2]; l.setAttribute("data-xm-icon", ""); head.appendChild(l);
      });
    }
    [].slice.call(D.querySelectorAll(".sl-brand img, .site-logo img, .ins-card > img")).forEach(function (im) { if (!im.dataset.xm) { im.dataset.xm = "1"; im.src = asset("xmas-icon.svg"); } });
  }

  /* ---------- a pine sprig at the end of each SnakeList wordmark ---------- */
  function sprigs() {
    if (!ART.sprig) return;
    var marks = D.querySelectorAll(".sl-title, .intro-line, .hero-title, .hero-mark");
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      if (m.querySelector(".xm-sprig") || (m.classList.contains("hero-mark") && m.closest(".hero-title"))) continue;
      var s = D.createElement("span"); s.className = "xm-sprig"; s.setAttribute("aria-hidden", "true"); s.innerHTML = ART.sprig;
      m.appendChild(s);
    }
  }

  /* ---------- snow: small flakes at three depths, drawn on one canvas per cover ---------- */
  var flakesImg = null;
  function flakeSprites() {
    if (flakesImg) return flakesImg;
    flakesImg = [1.2, 2, 3.1].map(function (r) {
      var c = D.createElement("canvas"), s = Math.ceil(r * 4 + 2); c.width = c.height = s * 2;
      var g = c.getContext("2d"), gr = g.createRadialGradient(s, s, 0, s, s, r * 2);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,252,244,.85)"); gr.addColorStop(1, "rgba(255,248,237,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(s, s, r * 2, 0, Math.PI * 2); g.fill();
      return { c: c, s: s };
    });
    return flakesImg;
  }
  var snows = [], raf = 0, last = 0;
  function makeSnow(host) {
    var cv = D.createElement("canvas"); cv.className = "xm-snow"; cv.setAttribute("aria-hidden", "true");
    host.appendChild(cv);
    var S = { host: host, cv: cv, g: cv.getContext("2d"), w: 0, h: 0, dpr: 1, fl: [], on: true };
    size(S); snows.push(S);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { S.on = es[0].isIntersecting; kick(); }).observe(host);
    return S;
  }
  function size(S) {
    var r = S.host.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === S.w && h === S.h && dpr === S.dpr) return;
    S.w = w; S.h = h; S.dpr = dpr; S.cv.width = Math.round(w * dpr); S.cv.height = Math.round(h * dpr);
    var n = Math.round(Math.min(130, Math.max(28, w * h / 9500)));
    S.fl = [];
    for (var i = 0; i < n; i++) {
      var z = Math.random(), layer = z < 0.5 ? 0 : z < 0.85 ? 1 : 2;
      S.fl.push({ x: Math.random() * w, y: Math.random() * h, l: layer, v: [14, 28, 46][layer] * (0.75 + Math.random() * 0.5),
        a: [0.42, 0.62, 0.82][layer] * (0.8 + Math.random() * 0.25), ph: Math.random() * 6.28, sw: 0.35 + Math.random() * 0.6, amp: [6, 11, 16][layer] });
    }
    draw(S, 0);
  }
  function draw(S, dt) {
    var g = S.g, sp = flakeSprites(), w = S.w, h = S.h, t = performance.now() / 1000;
    g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); g.clearRect(0, 0, w, h);
    for (var i = 0; i < S.fl.length; i++) {
      var f = S.fl[i];
      if (dt) { f.y += f.v * dt; if (f.y > h + 8) { f.y = -8; f.x = Math.random() * w; } }
      var x = f.x + Math.sin(t * f.sw + f.ph) * f.amp, im = sp[f.l];
      g.globalAlpha = f.a; g.drawImage(im.c, x - im.s, f.y - im.s);
    }
    g.globalAlpha = 1;
  }
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
    var any = false;
    // the 3D viewer (or another full-screen panel) is open: the cover is hidden behind it, so the snow waits
    if (D.documentElement.classList.contains("sl3d-lock")) { last = 0; setTimeout(kick, 800); return; }
    for (var i = 0; i < snows.length; i++) { var S = snows[i]; if (!S.on || !S.host.isConnected || S.host.offsetParent === null && getComputedStyle(S.host).position !== "fixed") continue; any = true; draw(S, dt); }
    if (any && !D.hidden && !RM.matches) raf = requestAnimationFrame(frame); else last = 0;
  }
  function kick() { if (!raf && !RM.matches && !D.hidden) { last = 0; raf = requestAnimationFrame(frame); } else if (RM.matches) snows.forEach(function (S) { draw(S, 0); }); }
  D.addEventListener("visibilitychange", kick);
  if (RM.addEventListener) RM.addEventListener("change", kick);
  var rt = 0; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { snows.forEach(size); kick(); }, 150); });

  /* ---------- the cover's pine corners, fairy lights and snow ---------- */
  function corner(side) {
    var c = D.createElement("div"); c.className = "xm-corner " + side;
    var im = D.createElement("img"); im.src = asset("xmas-corner-" + side + ".svg"); im.alt = ""; im.decoding = "async"; im.draggable = false;
    c.appendChild(im);
    (ART.bulbs && ART.bulbs[side] || []).forEach(function (p) {
      var b = D.createElement("i"); b.className = "xm-bulb"; b.style.left = (p[0] * 100) + "%"; b.style.top = (p[1] * 100) + "%"; c.appendChild(b);
    });
    return c;
  }
  function decorate(host, withSnow) {
    if (!host || host.querySelector(":scope > .xm-deco")) return;
    var d = D.createElement("div"); d.className = "xm-deco"; d.setAttribute("aria-hidden", "true");
    host.insertBefore(d, host.querySelector(":scope > .intro-content, :scope > .hero-copy") || host.firstChild.nextSibling || null);
    if (withSnow) makeSnow(d);
    d.appendChild(corner("l")); d.appendChild(corner("r"));
  }

  /* ---------- the "Christmas preview" pill ---------- */
  function exitUrl() { var u = new URL(location.href); u.searchParams.set("christmas", "off"); return u.pathname + u.search + u.hash; }
  function pill() {
    if (D.querySelector(".xm-pill") || store.get("pill") === "off" || window.self !== window.top) return;
    var p = D.createElement("div"); p.className = "xm-pill"; p.setAttribute("role", "note"); p.setAttribute("aria-label", "Christmas preview of SnakeList");
    p.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" stroke="#D8B76A" stroke-width="2" stroke-linecap="round"/></svg>' +
      '<span>Christmas preview</span>' + (XM.forced ? "" : '<a href="' + exitUrl() + '" title="Back to the normal SnakeList">Exit preview</a>') +
      '<button type="button" aria-label="Hide the Christmas preview label">&times;</button>';
    p.tabIndex = 0;
    p.querySelector("button").onclick = function () { p.remove(); store.set("pill", "off"); };
    D.body.appendChild(p);
    // after a few seconds it folds to a small gold star (it opens again when pointed at or focused)
    setTimeout(function () { p.classList.add("xm-pill-min"); }, 6000);
  }

  /* ---------- small pine / snowflake accents on a few section headings ---------- */
  function accents() {
    var hs = [];
    if (XM.kind === "xm-sp") hs = [].slice.call(D.querySelectorAll(".sp-sec > h2")).slice(0, 3);
    else if (XM.kind === "xm-site") hs = [].slice.call(D.querySelectorAll("main h2")).slice(0, 3);
    hs.forEach(function (h, i) { h.classList.add(i % 2 ? "xm-flake" : "xm-acc"); });
  }

  /* ---------- the gold line round the Show colours button (when the site's own button effect is not there) ---------- */
  var TRACE_SEL = ".area-btn, .quiz-level-btn, .sp-btn, .install-btn, .hero-cue";
  function traceFallback() {
    var svg = null, rect = null, cur = null, a1 = null, a2 = null, rf = 0;
    function place() {
      if (!cur || !cur.isConnected) return false;
      var r = cur.getBoundingClientRect(); if (!r.width) return false;
      var rad = parseFloat(getComputedStyle(cur).borderTopLeftRadius) || 0; rad = Math.min(rad, r.width / 2, r.height / 2);
      svg.style.transform = "translate(" + r.left + "px," + r.top + "px)"; svg.setAttribute("width", r.width); svg.setAttribute("height", r.height);
      rect.setAttribute("x", .8); rect.setAttribute("y", .8); rect.setAttribute("width", Math.max(0, r.width - 1.6)); rect.setAttribute("height", Math.max(0, r.height - 1.6));
      rect.setAttribute("rx", Math.max(0, rad - .8)); return true;
    }
    function follow() { rf = 0; if (cur && place()) rf = requestAnimationFrame(follow); }
    function run(el) {
      if (window.__slFx || !el.animate) return;
      if (!svg) { var NS = "http://www.w3.org/2000/svg"; svg = D.createElementNS(NS, "svg"); svg.setAttribute("class", "xm-trace"); svg.setAttribute("aria-hidden", "true");
        rect = D.createElementNS(NS, "rect"); rect.setAttribute("pathLength", "100"); rect.setAttribute("fill", "none"); svg.appendChild(rect); D.body.appendChild(svg); }
      if (a1) a1.cancel(); if (a2) a2.cancel();
      cur = el; if (!place()) return;
      var still = RM.matches;
      rect.setAttribute("stroke-dasharray", still ? "100 0" : "34 66");
      if (!still) a1 = rect.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -100 }], { duration: 1500, easing: "cubic-bezier(.45,.05,.4,1)", fill: "forwards" });
      a2 = svg.animate([{ opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: 1, offset: .72 }, { opacity: 0 }], { duration: still ? 1200 : 1950, fill: "forwards" });
      a2.onfinish = function () { if (cur === el) cur = null; };
      if (!rf) rf = requestAnimationFrame(follow);
    }
    XM.trace = run;
    D.addEventListener("pointerover", function (e) { var b = e.target.closest && e.target.closest(TRACE_SEL); if (b && b !== cur && (!e.relatedTarget || !b.contains(e.relatedTarget))) run(b); }, true);
    D.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") return; var b = e.target.closest && e.target.closest(TRACE_SEL); if (b) run(b); }, true);
    D.addEventListener("focusin", function (e) { var t = e.target; try { if (!t.matches(":focus-visible")) return; } catch (x) { return; } var b = t.closest && t.closest(TRACE_SEL); if (b) run(b); }, true);
  }

  /* ---------- pop-ups: a quick fade with a small movement as they open ---------- */
  function pops() {
    var SEL = ".tour-callout, .map-card, .wn-card, .note-sheet.open > *, .sl-menu, .lang-menu, .leaflet-popup";
    if (!("MutationObserver" in window)) return;
    var seen = new WeakSet();
    function check(el) { if (el.nodeType !== 1) return; var list = el.matches && el.matches(SEL) ? [el] : []; if (el.querySelectorAll) list = list.concat([].slice.call(el.querySelectorAll(SEL)));
      list.forEach(function (x) { if (seen.has(x) || !x.getClientRects().length) return; seen.add(x); x.classList.remove("xm-pop"); void x.offsetWidth; x.classList.add("xm-pop"); }); }
    new MutationObserver(function (ms) { ms.forEach(function (m) { if (m.type === "childList") m.addedNodes.forEach(check); else check(m.target); }); })
      .observe(D.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "open"] });
  }

  /* ---------- the Christmas hover: colour rises from the bottom of the button with a soft-gold edge ----------
     Red (cranberry -> warm red) on the seasonal highlight buttons, green (evergreen -> pine) on every other button.
     The fill is a background layer whose height is transitioned (CSS), so leaving half-way runs it back from where
     it is. The gold line round the border (the site's own, or ours) starts at the same moment. Touch: a short tap
     version that finishes by itself. Reduced motion: a plain colour fade (xmas.css). */
  var HOV_SEL = 'button, [role="button"], a[class*="btn"], a.chip, .chip, .sp-tags a, .sp-pills a, .sx-chips a, .sp-ftag a, .hero-cue, .hero-sp';
  var HOV_SKIP = ".card, .tab-btn, .photo-btn-clear, .note-btn, .chip-pic-btn, .xm-pill *, .sl3d-x.xm-skip, [data-xm-nohover]";
  var RED_SEL = ".install-btn, .sp-realbtn, .xm-cranberry, .quiz-level-btn.impossible, [data-level='impossible'], .venom";
  function hoverable(el) {
    if (!el || el.disabled || el.getAttribute("aria-disabled") === "true" || el.matches(HOV_SKIP)) return false;
    var r = el.getBoundingClientRect(); if (r.width < 14 || r.height < 14 || r.width > 640 || r.height > 140) return false;
    var cs = getComputedStyle(el);
    if (/url\(/.test(cs.backgroundImage)) return false;               // a photo you can tap, not a button
    return true;
  }
  function hovTarget(t) { if (!t || !t.closest) return null; var b = t.closest(HOV_SEL); return b && hoverable(b) ? b : null; }
  var hovEl = null, offT = new WeakMap();
  function prime(el) {
    // remember the button's own look before anything changes it, then lay the (empty) fill over it
    if (!el.classList.contains("xm-hv")) {
      var cs = getComputedStyle(el);
      el.style.setProperty("--xm-base", cs.backgroundImage === "none" ? "linear-gradient(transparent,transparent)" : cs.backgroundImage);
      el.style.setProperty("--xm-bgc", cs.backgroundColor);
      el.classList.toggle("xm-red", el.matches(RED_SEL));
      el.classList.add("xm-hv");
    }
    clearTimeout(offT.get(el));
  }
  function on(el) {
    prime(el);
    void el.offsetWidth;                                                // the empty fill is drawn first, so it rises
    el.classList.add("xm-on");
    if (!window.__slFx && XM.trace) XM.trace(el);
    // the site's own every-button hover (sl-fx) would paint it near-black: its class is taken off again at once
    Promise.resolve().then(function () { el.classList.remove("sl-hov", "sl-hov-nb"); });
  }
  function off(el) {
    el.classList.remove("xm-on");
    offT.set(el, setTimeout(function () { if (!el.classList.contains("xm-on")) { el.classList.remove("xm-hv", "xm-red"); el.style.removeProperty("--xm-base"); el.style.removeProperty("--xm-bgc"); } }, 320));
  }
  function hoverFx() {
    window.addEventListener("pointerover", function (e) {
      if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      var b = hovTarget(e.target); if (b === hovEl) return;
      if (hovEl) off(hovEl);
      hovEl = b; if (b) on(b);
    }, true);
    window.addEventListener("pointerout", function (e) {
      if (!hovEl) return; var to = e.relatedTarget;
      if (!to || !hovEl.contains(to)) { off(hovEl); hovEl = null; }
    }, true);
    // a tap: the colour rises, holds a moment and goes back by itself
    window.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return; var b = hovTarget(e.target); if (!b) return;
      on(b); setTimeout(function () { if (b !== hovEl) off(b); }, 420);
    }, true);
    window.addEventListener("blur", function () { if (hovEl) { off(hovEl); hovEl = null; } });
    // the site's hover class is never left on a button in the preview
    new MutationObserver(function (ms) { ms.forEach(function (m) { var t = m.target; if (t.classList && t.classList.contains("sl-hov") && (t.classList.contains("xm-hv") || XM.kind)) t.classList.remove("sl-hov", "sl-hov-nb"); }); })
      .observe(D.documentElement, { attributes: true, attributeFilter: ["class"], subtree: true });
  }

  /* ---------- "Merry Christmas from SnakeList!" - once per person, the first time they open SnakeList in the preview ----------
     It waits its turn like the app's own pop-ups (never over the opening, the photo, the "How well do you know snakes?"
     choice, the tutorial, What's new or the cookie bar), and the automatic What's new is left out for that visit. */
  var WKEY = "sl-xmas-welcome-seen", wOpen = false;
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function visible(el) { if (!el || el.hidden || el.closest("[hidden]")) return false; var cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < .05) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function othersOpen() {
    if (visible(D.querySelector(".tour-callout")) || visible(D.querySelector("#sl-level.open")) || visible(D.querySelector("#wn-sheet.open"))) return true;
    var ds = D.querySelectorAll('[role="dialog"][aria-modal="true"]');
    for (var i = 0; i < ds.length; i++) if (ds[i].id !== "xm-welcome" && visible(ds[i])) return true;
    return D.documentElement.classList.contains("sl3d-lock");
  }
  function welcome() {
    if (XM.kind !== "xm-app" || lsGet(WKEY)) return;
    var html = D.documentElement; html.classList.add("xm-welcome-visit");
    // the automatic What's new is left out this visit (the update history stays on its usual button)
    var wn = D.getElementById("wn-sheet");
    if (wn) {
      var auto = function () { return wn.classList.contains("open") && !wn.classList.contains("wn-v") && (D.getElementById("wn-x") || {}).hidden && /What's new/.test((D.getElementById("wn-h") || {}).textContent || ""); };
      var userAsked = false;
      D.addEventListener("click", function (e) { if (e.target.closest && e.target.closest(".sl-ver, #updates-btn, #wn-all")) userAsked = true; }, true);
      new MutationObserver(function () { if (!userAsked && auto()) wn.classList.remove("open"); }).observe(wn, { attributes: true, attributeFilter: ["class"] });
      if (auto()) wn.classList.remove("open");
    }
    // while it is open, the other pop-ups wait (the app asks SL_canPrompt before showing one)
    var orig = window.SL_canPrompt;
    if (orig && !orig.__xm) { window.SL_canPrompt = function (ex) { return !wOpen && orig(ex); }; window.SL_canPrompt.__xm = 1; }
    var tries = 0;
    (function wait() {
      var ready = orig ? (window.SL_promptsReady ? window.SL_promptsReady() : true) && orig() : !!window.__introDone;
      if (ready && !othersOpen()) { if (++tries >= 3) return show(); } else tries = 0;   // calm for a moment first
      setTimeout(wait, 400);
    })();
  }
  function show() {
    if (D.getElementById("xm-welcome")) return;
    var w = D.createElement("div"); w.id = "xm-welcome"; w.className = "xm-wl"; w.setAttribute("role", "dialog"); w.setAttribute("aria-modal", "true"); w.setAttribute("aria-labelledby", "xm-wl-h");
    w.innerHTML = '<div class="xm-wl-card xm-pop">' +
      '<span class="xm-wl-pine l" aria-hidden="true"></span><span class="xm-wl-pine r" aria-hidden="true"></span>' +
      '<p class="xm-wl-kicker">Christmas on SnakeList</p>' +
      '<h2 id="xm-wl-h">Merry Christmas from SnakeList!</h2>' +
      '<p class="xm-wl-msg">SnakeList is dressed for the holidays. Every snake, map and list is right where you left it &ndash; just a little more festive.</p>' +
      '<p class="xm-wl-sub">New in the Christmas theme</p>' +
      '<ul class="xm-wl-list">' +
      '<li><b>A festive cover</b> &ndash; pine branches, fairy lights and gentle snow around the opening photo</li>' +
      '<li><b>A Christmas logo</b> &ndash; the snake S in a Santa hat, with a sprig of pine</li>' +
      '<li><b>Seasonal colours</b> &ndash; evergreen, cranberry, warm ivory and soft gold, by day and by night</li>' +
      '<li><b>Decorations</b> &ndash; small touches on buttons, cards, the map and the 3D viewer</li>' +
      '<li><b>The Christmas Cabin</b> &ndash; a new tab where SnakeList activities earn presents to decorate your tree</li>' +
      '</ul>' +
      '<button type="button" class="xm-wl-go">Explore SnakeList</button></div>';
    var prev = D.activeElement;
    function close() {
      lsSet(WKEY, "1"); wOpen = false; D.documentElement.classList.remove("xm-welcome-open");
      w.classList.add("xm-wl-out"); setTimeout(function () { w.remove(); }, 220);
      D.removeEventListener("keydown", key, true);
      try { if (prev && prev.focus && D.contains(prev)) prev.focus({ preventScroll: true }); } catch (e) {}
    }
    function key(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "Tab") { e.preventDefault(); w.querySelector(".xm-wl-go").focus(); }   // one button: focus stays on it
    }
    w.querySelector(".xm-wl-go").onclick = close;
    w.addEventListener("click", function (e) { if (e.target === w) close(); });
    D.addEventListener("keydown", key, true);
    D.body.appendChild(w); wOpen = true; D.documentElement.classList.add("xm-welcome-open");
    if (window.SL_promptShown) window.SL_promptShown();
    try { w.querySelector(".xm-wl-go").focus({ preventScroll: true }); } catch (e) {}
  }
  XM.welcome = show;

  // the cover and the logo are dressed the moment they arrive, while the (large) page is still loading
  var early = false;
  function dressCover() {
    var hat = XM.hat();
    if (XM.kind === "xm-app") { decorate(D.getElementById("intro"), true); decorate(D.getElementById("sl-hero"), true); kick(); }
    sprigs(); icons();
    return hat && (XM.kind !== "xm-app" || D.getElementById("sl-hero"));
  }
  if (D.readyState === "loading" && "MutationObserver" in window) {
    var mo = new MutationObserver(function () { if (dressCover()) { mo.disconnect(); early = true; } });
    mo.observe(D.documentElement, { childList: true, subtree: true });
    D.addEventListener("DOMContentLoaded", function () { mo.disconnect(); });
  }
  if (D.title && D.title.indexOf("Christmas preview") < 0) D.title += " \u00b7 Christmas preview";

  function start() {
    dressCover();
    accents(); pill(); traceFallback(); pops(); hoverFx(); welcome();
    // the app builds parts of its header later: catch a wordmark drawn after this ran
    setTimeout(sprigs, 1500); setTimeout(sprigs, 5000);
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", start); else start();
})();
