/* SnakeList - Christmas preview: the moving and added parts of the theme (styles are in xmas.css).
   Loaded only by the pages under christmas/. XM_ART (the bulb positions and the sprig) is put in front of this
   file by tools/build-christmas.py. Everything here is decoration: it never takes clicks, never covers words,
   stops when it is off screen or the tab is hidden, and holds still for "reduce motion". */
(function () {
  "use strict";
  var XM = window.XM || (window.XM = {});
  var ART = window.XM_ART || {};
  var D = document, ROOT = XM.root || new URL("./", location.href).href;
  var RM = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false, addEventListener: function () {} };
  var store = { get: function (k) { try { return sessionStorage.getItem("sl-xmas-" + k); } catch (e) { return null; } },
                set: function (k, v) { try { sessionStorage.setItem("sl-xmas-" + k, v); } catch (e) {} } };

  /* ---------- the hat (normally put on by the inline call right after the logo's drawing) ---------- */
  if (XM.hat) XM.hat();

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
    var im = D.createElement("img"); im.src = ROOT + "xmas-corner-" + side + ".svg"; im.alt = ""; im.decoding = "async"; im.draggable = false;
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
  function pill() {
    if (D.querySelector(".xm-pill") || store.get("pill") === "off" || window.self !== window.top) return;
    var p = D.createElement("div"); p.className = "xm-pill"; p.setAttribute("role", "note"); p.setAttribute("aria-label", "Christmas preview of SnakeList");
    p.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" stroke="#D8B76A" stroke-width="2" stroke-linecap="round"/></svg>' +
      '<span>Christmas preview</span><a href="' + new URL("../", ROOT).href + '" title="Open the live SnakeList">Live site</a>' +
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

  /* ---------- links a script builds to a live page are kept inside the preview ---------- */
  function keepInside() {
    var R = new URL(ROOT), live = new URL("../", R).pathname;
    D.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]"); if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      var u; try { u = new URL(a.href); } catch (x) { return; }
      if (u.origin !== R.origin || u.pathname.indexOf(R.pathname) === 0 || u.pathname.indexOf(live) !== 0) return;
      var rest = u.pathname.slice(live.length);
      if (/\.(?!html?$)[a-z0-9]{1,8}$/i.test(rest)) return;          // a file, not a page
      if (a.closest(".xm-pill")) return;
      a.href = R.pathname + rest + u.search + u.hash;
    }, true);
  }

  function start() {
    sprigs();
    if (XM.kind === "xm-app") {
      decorate(D.getElementById("intro"), true);
      decorate(D.getElementById("sl-hero"), true);
      kick();
    }
    accents(); pill(); traceFallback(); pops(); keepInside();
    // the app builds parts of its header later: catch a wordmark drawn after this ran
    setTimeout(sprigs, 1500); setTimeout(sprigs, 5000);
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", start); else start();
})();
