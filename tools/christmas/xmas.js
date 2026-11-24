/* SnakeList - Christmas preview: the decorations (styles are in xmas.css, the Christmas Cabin in cabin.js).
   Loaded only while the preview switch is on (?christmas - see tools/xmas_loader.js). XM_ART (the hat, the stocking,
   the snow on the logo's S, the photo hats, the cover's lights, the cabin's layout) is put in front of this file by
   tools/build-christmas.py.
   SnakeList keeps its own look - its colours, buttons, hovers and layout are not changed. The preview only ADDS
   decoration: the Christmas logo (a Santa hat on the snake S, snow on the letters, a stocking with presents in place
   of the tick), a Santa hat on the cover photo's snake, pine corners and snow on the cover, a tiny Santa-hat snake
   icon by each snake's name, Christmas music, the welcome panel and the Christmas Cabin. Nothing here takes clicks
   away from SnakeList, stops when hidden, and holds still for "reduce motion". */
(function () {
  "use strict";
  var XM = window.XM || (window.XM = { forced: !!window.SL_XMAS_FORCE });
  var ART = window.XM_ART || {};
  var D = document, me = D.currentScript && D.currentScript.src;
  if (!XM.root) XM.root = me ? new URL("./", me).href : new URL("christmas/", location.href).href;
  if (!XM.kind) XM.kind = D.querySelector(".sp-main, .sl-top") ? "xm-sp" : "xm-app";
  D.documentElement.classList.add("xm", XM.kind);
  var ROOT = XM.root;
  if (!D.querySelector('link[href*="xmas.css"], style[data-xmas]')) { var css = D.createElement("link"); css.rel = "stylesheet"; css.href = ROOT + "xmas.css"; (D.head || D.documentElement).appendChild(css); }
  function asset(n) { return (ART.files && ART.files[n]) || ROOT + n; }
  XM.asset = asset;
  var RM = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false, addEventListener: function () {} };
  var store = { get: function (k) { try { return sessionStorage.getItem("sl-xmas-" + k); } catch (e) { return null; } },
                set: function (k, v) { try { sessionStorage.setItem("sl-xmas-" + k, v); } catch (e) {} } };
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var NS = "http://www.w3.org/2000/svg";
  XM.esc = esc;

  /* ================= the Christmas logo ================= */
  /* the Santa hat and the snow go into the logo's own drawing (#mark-snake), so every logo that shows it gets them */
  XM.hat = function () {
    var g = D.getElementById("mark-snake"); if (!g || !ART.hat) return !!g;
    if (g.querySelector(".xm-hat")) return true;
    var e = null, cs = g.getElementsByTagName("circle");
    for (var i = 0; i < cs.length; i++) if (/sl-eye/.test(cs[i].getAttribute("fill") || "")) { e = cs[i]; break; }
    if (!e) return false;
    // the hat's gradients and filters: in a little drawing of their own, straight in <body>. Inside #mark-snake (or
    // anywhere in the app's root, which is not drawn during the opening) the <use> copies could not reach them until
    // the page restyled itself, a few seconds in - the hat showed as a bare outline over the opening.
    if (ART.hatDefs && !D.getElementById("xmh-r") && D.body) {
      var ds = D.createElementNS(NS, "svg"); ds.setAttribute("class", "xm-defs"); ds.setAttribute("aria-hidden", "true");
      ds.setAttribute("style", "position:absolute;left:0;top:0;width:0;height:0;overflow:hidden;pointer-events:none");
      ds.innerHTML = "<defs>" + ART.hatDefs + "</defs>"; D.body.appendChild(ds);
    }
    var t = D.createElementNS(NS, "g"); t.setAttribute("style", "opacity:var(--xm-hat-o,1)"); t.innerHTML = ART.hat; e.parentNode.appendChild(t);
    if (ART.ssnow) { var s = D.createElementNS(NS, "path"); s.setAttribute("d", ART.ssnow); s.setAttribute("class", "xm-ssnow"); s.setAttribute("fill", "#fff"); s.setAttribute("style", "opacity:var(--xm-hat-o,1)"); g.appendChild(s); }
    return true;
  };
  /* the tick, dressed as a Christmas stocking: still the tick's own shape, in red knit with a fur cuff and a candy cane
     (the tick's own drawing is only hidden by xmas.css while the stocking is there, never removed) */
  var stkN = 0;
  function stockings() {
    if (!ART.stocking) return;
    [].forEach.call(D.querySelectorAll("svg.sl-tick, .intro-box svg:not(.tick-detail)"), function (sv) {
      if (sv.querySelector(".xm-stk")) return;
      sv.classList.add("xm-has-stk"); sv.style.overflow = "visible";
      // its own gradient names in each copy (a copy inside a hidden logo could not lend them to the others)
      var n = ++stkN; sv.insertAdjacentHTML("beforeend", ART.stocking.replace(/xms-/g, "xms" + n + "-"));
    });
  }

  /* snow on top of the letters: each letter's real outline is measured from the font itself (drawn once on a
     canvas, upper-case where the page shows it upper-case), then snow is laid only where that outline faces up and
     is flat enough to hold it - thickest in the middle of a flat top, thinning out towards its ends, none on the
     curves and slopes, with now and then a small drip over the edge. The same rule as the logo S's snow
     (christmas_art.snow_cap). Also on the cover's other words and on the top of the snake's name button. */
  var gCache = {}, cv = null;
  function glyph(ch, font, T) {
    var k = font + "|" + ch + "|" + T; if (gCache[k]) return gCache[k];
    var R = 120, W = R * 2, H = R * 2;
    if (!cv) { cv = D.createElement("canvas"); cv.width = W; cv.height = H; }
    var g = cv.getContext("2d", { willReadFrequently: true });
    g.clearRect(0, 0, W, H); g.font = font.replace("@", R + "px"); g.textBaseline = "alphabetic"; g.fillStyle = "#000";
    var ox = R * .3, oy = R * 1.4; g.fillText(ch, ox, oy);
    var m = g.measureText(ch), asc = (m.fontBoundingBoxAscent || R * .9) / R;
    var d = g.getImageData(0, 0, W, H).data, tops = [], step = 2;
    for (var x = 0; x < W; x += step) { var t = null; for (var y = 0; y < H; y++) if (d[(y * W + x) * 4 + 3] > 140) { t = (y - oy) / R; break; } tops.push(t); }
    return (gCache[k] = { asc: asc, p: snowCap(tops, -ox / R, step / R, T, ch.charCodeAt(0)) });
  }
  /* tops: the top edge's y per column (null where empty) -> polygons [[x, y]...] (a port of christmas_art.snow_cap) */
  function snowCap(tops, x0, step, T, seed) {
    var n = tops.length, th = new Array(n).fill(0), sm = new Array(n).fill(0), out = [], c, k;
    var ph0 = (seed * 1.7) % 6.28, ph1 = (seed * 2.9) % 6.28, rnd = (seed * 9301 + 49297) % 233280 / 233280;
    for (c = 0; c < n; c++) {
      if (tops[c] == null) continue;
      var a = Math.max(0, c - 3), b = Math.min(n - 1, c + 3);
      while (tops[a] == null) a++; while (tops[b] == null) b--;
      // snow only holds where the edge is nearly level: none past a slope of about 30 degrees
      var slope = (tops[b] - tops[a]) / Math.max(1e-6, (b - a) * step), f = Math.pow(Math.max(0, 1 - Math.abs(slope) / .85), 1.5), x = x0 + c * step;
      th[c] = T * f * (.86 + .14 * Math.sin(x / (T * 2.3) + ph0) + .08 * Math.sin(x / (T * .9) + ph1));
    }
    for (c = 0; c < n; c++) { if (tops[c] == null) continue; var s = 0, q = 0; for (k = Math.max(0, c - 2); k < Math.min(n, c + 3); k++) if (tops[k] != null) { s += th[k]; q++; } sm[c] = s / q; }
    c = 0;
    while (c < n) {
      if (tops[c] == null || sm[c] < T * .3) { c++; continue; }
      var e = c;
      while (e + 1 < n && tops[e + 1] != null && sm[e + 1] >= T * .3 && Math.abs(tops[e + 1] - tops[e]) < T * .6) e++;
      var L = e - c + 1, len = L * step;
      if (len >= T * 1.5) {
        // a long flat top holds more snow in its middle; a short one only a thin cap
        var full = Math.min(1, len / (T * 7)), up = [], dn = [];
        var drip = len > T * 5 && ((rnd * 7 + c) % 1) < .55 ? (((rnd * 13 + e) % 1) < .5 ? .18 + .1 * rnd : .72 + .1 * rnd) : -1;
        for (var j = 0; j < L; j++) {
          var kk = c + j, u = (j + .5) / L, tp = Math.pow(Math.sin(Math.PI * u), .7), xx = x0 + kk * step;
          var dr = drip < 0 ? 0 : T * .95 * Math.exp(-Math.pow((u - drip) * len / (T * .45), 2));
          up.push([xx, tops[kk] - sm[kk] * tp * (.7 + .3 * full)]); dn.push([xx, tops[kk] + T * .16 * tp + dr]);
        }
        out.push(up.concat(dn.reverse()));
      }
      c = e + 1;
    }
    return out;
  }
  function polyD(poly, fx, fy) { return "M" + poly.map(function (p) { return fx(p[0]).toFixed(1) + " " + fy(p[1]).toFixed(1); }).join("L") + "Z"; }
  /* where snow lies: [selector, depth of the snow as a part of the font size, the least depth in px] - the logos get a
     proper layer, the small words of the cover a light dusting */
  var SNOW_SPOTS = [
    [".sl-header .sl-titletext, .intro-title, .hero-title .intro-title, .hero-mark, .signin-title .sl-titletext, .sl-brand, .site-logo", .07, 1.6],
    ["#sl-hero .hero-sub, #intro .hero-sub", .17, 2.4],
    ["#sl-hero .hero-cue > span, #intro .hero-cue > span", .2, 2]
  ];
  var PILLS = "#sl-hero .hero-sp";           // a button: the snow lies along its rounded top
  var SNOW_HOSTS = SNOW_SPOTS.map(function (s) { return s[0]; }).join(", ") + ", " + PILLS;
  function capHost(host) {
    var o = host.querySelector(":scope > .xm-snowcap");
    if (!o) { o = D.createElementNS(NS, "svg"); o.setAttribute("class", "xm-snowcap"); o.setAttribute("aria-hidden", "true"); o.innerHTML = "<path/>"; host.appendChild(o); }
    return o;
  }
  function snowText(host, Tem, Tpx) {
    if (!host || !host.isConnected) return;
    var hr = host.getBoundingClientRect(); if (!hr.width || !host.offsetWidth) return;
    var sc = hr.width / host.offsetWidth || 1, parts = [];
    var w = D.createTreeWalker(host, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return n.parentNode.closest("svg, .sr-only, .xm-snowcap, .hw-dot") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
    var rg = D.createRange(), n;
    while ((n = w.nextNode())) {
      var el = n.parentNode, cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
      if (!fs || cs.visibility === "hidden") continue;
      var font = cs.fontStyle + " " + cs.fontWeight + " @ " + cs.fontFamily, T = Math.max(Tem, Tpx / fs);
      T = Math.round(T * 200) / 200;
      for (var i = 0; i < n.length; i++) {
        var ch = n.data[i]; if (!/[A-Za-z0-9]/.test(ch)) continue;
        if (cs.textTransform === "uppercase") ch = ch.toUpperCase();
        rg.setStart(n, i); rg.setEnd(n, i + 1);
        var r = rg.getBoundingClientRect(); if (!r.width) continue;
        var G = glyph(ch, font, T), ox = (r.left - hr.left) / sc, base = (r.top - hr.top) / sc + G.asc * fs;
        G.p.forEach(function (poly) { parts.push(polyD(poly, function (x) { return ox + x * fs; }, function (y) { return base + y * fs; })); });
      }
    }
    capHost(host).firstChild.setAttribute("d", parts.join(""));
  }
  function snowPill(host) {
    if (!host || !host.isConnected || !host.offsetWidth) return;
    var W = host.offsetWidth, H = host.offsetHeight, r = Math.min(H / 2, parseFloat(getComputedStyle(host).borderTopLeftRadius) || 0), tops = [], st = 1;
    for (var x = 0; x <= W; x += st) { var dx = x < r ? r - x : x > W - r ? x - (W - r) : 0; tops.push(r - Math.sqrt(Math.max(0, r * r - dx * dx))); }
    capHost(host).firstChild.setAttribute("d", snowCap(tops, 0, st, 3.2, 7).map(function (p) { return polyD(p, function (x) { return x; }, function (y) { return y + 2.6; }); }).join(""));
  }
  var snowT = 0;
  function snowAll() {
    clearTimeout(snowT);
    snowT = setTimeout(function () {
      SNOW_SPOTS.forEach(function (s) { [].forEach.call(D.querySelectorAll(s[0]), function (h) { snowText(h, s[1], s[2]); }); });
      [].forEach.call(D.querySelectorAll(PILLS), snowPill);
    }, 60);
  }
  XM.snowLetters = snowAll;
  function logo() {
    XM.hat(); stockings(); snowAll();
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(snowAll);
    if ("ResizeObserver" in window) { var ro = new ResizeObserver(snowAll); [].forEach.call(D.querySelectorAll(SNOW_HOSTS), function (h) { ro.observe(h); }); }
    window.addEventListener("resize", snowAll);
    D.addEventListener("sl-intro-done", function () { stockings(); snowAll(); setTimeout(snowAll, 1400); setTimeout(snowAll, 3200); });
    [800, 2500, 5000].forEach(function (t) { setTimeout(function () { stockings(); snowAll(); }, t); });
  }

  /* ================= the Christmas icon: browser tab, home screen and the page headers' square icon ================= */
  function icons() {
    var head = D.head; if (!head) return;
    if (!D.querySelector("link[data-xm-icon]")) {
      [].slice.call(D.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')).forEach(function (l) { l.remove(); });
      [["icon", "xmas-icon.svg", "image/svg+xml"], ["icon", "xmas-icon-48.png", "image/png"], ["apple-touch-icon", "xmas-icon-180.png"]].forEach(function (a) {
        var l = D.createElement("link"); l.rel = a[0]; l.href = asset(a[1]); if (a[2]) l.type = a[2]; l.setAttribute("data-xm-icon", ""); head.appendChild(l);
      });
    }
    [].slice.call(D.querySelectorAll(".sl-brand img, .site-logo img, .ins-card > img")).forEach(function (im) {
      // the square app icon becomes the Christmas icon; the pages' wordmark logo becomes the Christmas wordmark
      if (im.dataset.xm) return; var src = im.getAttribute("src") || "", lg = /logo-(light|dark)\.svg/.exec(src);
      if (lg) { im.dataset.xm = "1"; im.src = asset("xmas-logo-" + lg[1] + ".svg"); return; }   // the pages' wordmark logo, dressed the same way
      if (/logo/i.test(src)) return;
      im.dataset.xm = "1"; im.src = asset("xmas-icon.svg");
    });
  }

  /* ================= a Santa hat on the cover photo's snake =================
     Where the hat goes is data, per photo (XM_ART.photoHats, from tools/christmas/photo-hats.json): the brim's middle
     (x, y as parts of the photo's width and height), its width (part of the photo's width), its turn in degrees and
     whether it is flipped (snake looking left). A photo with no entry gets no hat (never a hat floating in the air).
     The photo is found by its file name (rough-green-hq-2560.webp -> "rough-green-hq") or a data-photo-id on it. */
  function photoId(im) {
    var id = im.getAttribute("data-photo-id") || (im.closest("[data-photo-id]") || {}).getAttribute && im.closest("[data-photo-id]") && im.closest("[data-photo-id]").getAttribute("data-photo-id");
    if (id) return id;
    var u = im.currentSrc || im.src || ""; u = u.split(/[?#]/)[0].split("/").pop();
    return u.replace(/\.(webp|jpe?g|png|avif)$/i, "").replace(/-\d+w?$/, "");
  }
  // the photo's own load, caught however early it comes (load does not bubble: listened for on the way down)
  D.addEventListener("load", function (e) { var t = e.target; if (t && t.tagName === "IMG" && t.closest && t.closest("#sl-hero .hero-media")) placePhotoHat(); }, true);
  function placePhotoHat() {
    var hero = D.getElementById("sl-hero"); if (!hero || !ART.hatSvg) return;
    var im = hero.querySelector(".hero-media img:not(.hero-fill)"); if (!im) return;
    var L = hero.querySelector(".xm-phat");
    var P = (ART.photoHats || {})[photoId(im)];
    if (!P || !im.naturalWidth) { if (L) L.hidden = true; return; }
    if (!L) { L = D.createElement("div"); L.className = "xm-phat"; L.setAttribute("aria-hidden", "true"); L.innerHTML = '<svg viewBox="-72 -84 144 116" preserveAspectRatio="xMidYMid meet">' + ART.hatSvg + "</svg>"; im.parentNode.insertBefore(L, im.nextSibling); }
    L.hidden = false;
    var bw = im.offsetWidth, bh = im.offsetHeight, nw = im.naturalWidth, nh = im.naturalHeight, cs = getComputedStyle(im);
    var k = cs.objectFit === "cover" ? Math.max(bw / nw, bh / nh) : Math.min(bw / nw, bh / nh), cw = nw * k, ch = nh * k;
    var pos = cs.objectPosition.split(" "), px = parseFloat(pos[0]) / 100, py = parseFloat(pos[1] || "50%") / 100;
    if (isNaN(px)) px = .5; if (isNaN(py)) py = .5;
    var ox = (bw - cw) * px, oy = (bh - ch) * py;
    L.style.left = im.offsetLeft + "px"; L.style.top = im.offsetTop + "px"; L.style.width = bw + "px"; L.style.height = bh + "px";
    var w = P.w * cw, sv = L.firstChild;
    sv.style.width = (w * 1.44) + "px"; sv.style.height = (w * 1.16) + "px";
    sv.style.left = (ox + P.x * cw - w * .72) + "px"; sv.style.top = (oy + P.y * ch - w * .84) + "px";
    sv.style.transformOrigin = (w * .72) + "px " + (w * .84) + "px";
    sv.style.transform = "rotate(" + (P.a || 0) + "deg)" + (P.flip ? " scaleX(-1)" : "");
  }
  // wired the moment the photo is in the page (from dressCover, while the page is still loading), so the hat is
  // placed as soon as the photo has its size - before the opening dissolves into it, never popping in afterwards
  var phIm = null;
  function photoHat() {
    var hero = D.getElementById("sl-hero"); if (!hero) return;
    var im = hero.querySelector(".hero-media img:not(.hero-fill)"); if (!im || phIm === im) return;
    phIm = im;
    im.addEventListener("load", placePhotoHat);
    new MutationObserver(placePhotoHat).observe(im, { attributes: true, attributeFilter: ["src", "srcset", "style", "class", "data-photo-id"] });
    if ("ResizeObserver" in window) new ResizeObserver(placePhotoHat).observe(im);
    placePhotoHat(); setTimeout(placePhotoHat, 1200);
  }

  /* ================= snow: small flakes at three depths, drawn on one canvas per cover ================= */
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
  function makeSnow(host, opt) {
    var c = D.createElement("canvas"); c.className = "xm-snow"; c.setAttribute("aria-hidden", "true");
    host.appendChild(c);
    var S = { host: host, cv: c, g: c.getContext("2d"), w: 0, h: 0, dpr: 1, fl: [], on: true, dens: (opt && opt.dens) || 1 };
    size(S); snows.push(S);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { S.on = es[0].isIntersecting; kick(); }).observe(host);
    kick();
    return S;
  }
  XM.makeSnow = makeSnow;
  function size(S) {
    var r = S.host.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === S.w && h === S.h && dpr === S.dpr) return;
    S.w = w; S.h = h; S.dpr = dpr; S.cv.width = Math.round(w * dpr); S.cv.height = Math.round(h * dpr);
    var n = Math.round(Math.min(130, Math.max(28, w * h / 9500)) * S.dens);
    S.fl = [];
    for (var i = 0; i < n; i++) {
      var z = Math.random(), layer = z < 0.5 ? 0 : z < 0.85 ? 1 : 2;
      S.fl.push({ x: Math.random() * w, y: Math.random() * h, l: layer, v: [14, 28, 46][layer] * (0.75 + Math.random() * 0.5),
        a: [0.42, 0.62, 0.82][layer] * (0.8 + Math.random() * 0.25), ph: Math.random() * 6.28, sw: 0.35 + Math.random() * 0.6, amp: [6, 11, 16][layer] });
    }
    draw(S, 0);
  }
  XM.sizeSnow = size;
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
    if (D.documentElement.classList.contains("sl3d-lock")) { last = 0; setTimeout(kick, 800); return; }
    for (var i = 0; i < snows.length; i++) { var S = snows[i]; if (!S.on || S.off || !S.host.isConnected || S.host.offsetParent === null && getComputedStyle(S.host).position !== "fixed") continue; any = true; draw(S, dt); }
    if (any && !D.hidden && !RM.matches) raf = requestAnimationFrame(frame); else last = 0;
  }
  function kick() { if (!raf && !RM.matches && !D.hidden) { last = 0; raf = requestAnimationFrame(frame); } else if (RM.matches) snows.forEach(function (S) { draw(S, 0); }); }
  XM.kickSnow = kick;
  D.addEventListener("visibilitychange", kick);
  if (RM.addEventListener) RM.addEventListener("change", kick);
  var rt = 0; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { snows.forEach(size); kick(); }, 150); });

  /* ================= the cover's pine corners (baubles hung on the branches), fairy lights and snow ================= */
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

  /* ================= the "Christmas preview" pill ================= */
  function exitUrl() { var u = new URL(location.href); u.searchParams.set("christmas", "off"); return u.pathname + u.search + u.hash; }
  function pill() {
    if (D.querySelector(".xm-pill") || store.get("pill") === "off" || window.self !== window.top) return;
    var p = D.createElement("div"); p.className = "xm-pill"; p.setAttribute("role", "note"); p.setAttribute("aria-label", "Christmas preview of SnakeList");
    p.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" stroke="#D8B76A" stroke-width="2" stroke-linecap="round"/></svg>' +
      '<span>Christmas preview</span>' + (XM.forced ? "" : '<a href="' + exitUrl() + '">Exit preview</a>') +
      '<button type="button" aria-label="Hide the Christmas preview label">&times;</button>';
    p.tabIndex = 0;
    p.querySelector("button").onclick = function () { p.remove(); store.set("pill", "off"); };
    D.body.appendChild(p);
    setTimeout(function () { p.classList.add("xm-pill-min"); }, 6000);
  }

  /* ================= small pine / snowflake accents on a few headings of the SnakeList pages ================= */
  function accents() {
    var hs = [];
    if (XM.kind === "xm-sp") hs = [].slice.call(D.querySelectorAll(".sp-sec > h2")).slice(0, 3);
    else if (XM.kind === "xm-site") hs = [].slice.call(D.querySelectorAll("main h2")).slice(0, 3);
    hs.forEach(function (h, i) { h.classList.add(i % 2 ? "xm-flake" : "xm-acc"); });
  }

  /* ================= a tiny Santa-hat snake by each snake's name =================
     A small portrait of that species: its own colours, pattern and head shape (from the 3D models: christmas/
     xmas-sp.json, 11 characters per species, fetched once), wearing a Santa hat.
     Each look is drawn once as an SVG symbol and reused (<use>), so even long lists stay light. */
  var SP = null, spP = null, symDone = {}, sprite = null;
  function spData() {
    if (SP) return Promise.resolve(SP);
    if (!spP) spP = fetch(asset("xmas-sp.json")).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (d) { SP = d || {}; return SP; });
    return spP;
  }
  /* the little snake: a round, shaded body rising in an S from a loop on the ground, thick through the middle and
     thin to the tail, with its species' pattern and belly colour, a head of the right shape (a viper's wide
     triangle, a python's long broad head, a colubrid's slender one...), an eye, and the Santa hat worn on its head.
     The body's outline is worked out once (a tube round its middle line); each species' look is one <symbol>. */
  var MID = [[2.6, 20.6], [6.2, 22.4], [13.8, 22.6], [16.2, 19.6], [18.2, 17.0], [15.2, 15.3], [11.6, 14.6], [8.6, 14.0], [7.6, 11.4], [9.4, 9.6], [10.8, 8.2], [12.8, 7.9], [14.2, 8.4]];
  var TUBE = null;
  function tube() {
    if (TUBE) return TUBE;
    var pts = [], i, t;
    for (i = 0; i + 3 < MID.length; i += 3) for (t = i ? .05 : 0; t <= 1.0001; t += .05) {
      var u = 1 - t, p0 = MID[i], p1 = MID[i + 1], p2 = MID[i + 2], p3 = MID[i + 3];
      pts.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    }
    var n = pts.length, L = [], R = [], B = [], H = [];
    for (i = 0; i < n; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      var nx = -dy / l, ny = dx / l, f = i / (n - 1);
      // thickness: a thin tail, full through the coil and the body, a little narrower at the neck
      var w = 2.15 * Math.min(1, .18 + f * 3.2) * (f > .86 ? 1 - (f - .86) * 1.4 : 1);
      L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
      // the belly side and the lit side (light from above: whichever side faces down is the belly)
      var s = ny > 0 ? 1 : -1;
      B.push([pts[i][0] + nx * w * .62 * s, pts[i][1] + ny * w * .62 * s]); H.push([pts[i][0] - nx * w * .45 * s, pts[i][1] - ny * w * .45 * s]);
    }
    function d(a) { return "M" + a.map(function (p) { return p[0].toFixed(2) + " " + p[1].toFixed(2); }).join("L"); }
    var mid = d(pts);
    TUBE = { body: d(L) + "L" + R.slice().reverse().map(function (p) { return p[0].toFixed(2) + " " + p[1].toFixed(2); }).join("L") + "Z", mid: mid, belly: d(B), lit: d(H) };
    return TUBE;
  }
  // the pattern along the body (C = pattern colour, B = belly colour), clipped to the body
  var PAT = {
    p: "", b: '<path d="#M" stroke="#C" stroke-width="5" stroke-dasharray="1.1 1.9" fill="none"/>',
    c: '<path d="#M" stroke="#C" stroke-width="5" stroke-dasharray="1.2 4.2" fill="none"/><path d="#M" stroke="#B" stroke-width="5" stroke-dasharray=".7 4.7" stroke-dashoffset="-1.6" fill="none"/>',
    s: '<path d="#M" stroke="#C" stroke-width=".9" fill="none"/><path d="#L" stroke="#C" stroke-width=".55" fill="none" opacity=".8"/>',
    k: '<path d="#M" stroke="#C" stroke-width="3.4" stroke-dasharray=".01 1.25" stroke-linecap="round" fill="none" opacity=".9"/>',
    o: '<path d="#M" stroke="#C" stroke-width="2.6" stroke-dasharray="1.5 1.5" stroke-linecap="round" fill="none"/>',
    z: '<path d="#M" stroke="#C" stroke-width="2.4" stroke-dasharray="1 .9" stroke-linejoin="round" fill="none"/>',
    l: '<path d="#M" stroke="#C" stroke-width="5" stroke-dasharray="0 31 1.4 60" fill="none"/>'
  };
  // head shapes, facing right from the neck at (0, 0): [outline, eye x, eye y, eye r, slit pupil]
  var HEADS = {
    c: ["M-.6-1.7C1.2-2.5 3.6-2.4 5.1-1.4 5.9-.8 6.1.2 5.5.8 4.3 1.9 1.4 2.2-.6 1.7Z", 3.2, -.75, .78, 0],
    e: ["M-.6-1.8C1.3-2.6 3.5-2.5 4.8-1.5 5.7-.8 5.8.4 5.1 1 3.9 2 1.3 2.2-.6 1.8Z", 3, -.8, .72, 0],
    v: ["M-.5-1.3C.2-3.3 2.6-3.6 4.6-2.3 5.8-1.5 6.4-.5 6.2.3 5.9 1.2 4.4 2.3 2.6 3 1.2 3.5-.2 3-.5 1.6Z", 3.3, -1.15, .8, 1],
    b: ["M-.6-1.8C1.4-2.7 4.4-2.6 6-1.6 6.8-1 6.9.3 6.2.9 4.8 2.1 1.4 2.4-.6 1.8Z", 3.9, -.9, .74, 1],
    n: ["M-.4-1.5C1-1.9 2.8-1.8 3.8-1.1 4.5-.5 4.5.6 3.8 1.1 2.7 1.8 .9 1.9-.4 1.5Z", 2.6, -.5, .34, 0],
    s: ["M-.6-1.7C1.2-2.4 3.4-2.3 4.8-1.4 5.6-.8 5.8.3 5.2.9 4 1.9 1.4 2.1-.6 1.7Z", 3, -.75, .74, 0]
  };
  function spSym(code) {
    var id = "xsi-" + code.replace(/[^a-z0-9]/gi, "");
    if (symDone[id]) return id;
    if (!sprite) { sprite = D.createElementNS(NS, "svg"); sprite.setAttribute("aria-hidden", "true"); sprite.setAttribute("class", "xm-sprite"); D.body.appendChild(sprite); }
    var T = tube(), d = "#" + code.slice(0, 3), c = "#" + code.slice(3, 6), b = "#" + code.slice(6, 9), t = code.charAt(9) || "p", h = HEADS[code.charAt(10)] || HEADS.c;
    var pat = (PAT[t] || "").replace(/#M/g, T.mid).replace(/#L/g, T.lit).replace(/#C/g, c).replace(/#B/g, b);
    var defs = "";
    if (!symDone.base) {
      // shared once: the body's clip, its round shading and the small Santa hat (a light version, no filters)
      defs = '<defs><clipPath id="xsi-clip"><path d="' + T.body + '"/></clipPath>' +
        '<linearGradient id="xsi-sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".75" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>' +
        '<radialGradient id="xsi-hd" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient>' +
        '<g id="xsi-hat">' + (ART.hatMini || "") + "</g></defs>";
      symDone.base = 1;
    }
    sprite.insertAdjacentHTML("beforeend", defs + '<symbol id="' + id + '" viewBox="0 0 24 24">' +
      '<ellipse cx="10.6" cy="22.9" rx="8.6" ry="1.1" fill="#000" opacity=".22"/>' +
      '<path d="' + T.body + '" fill="' + d + '" stroke="rgba(0,0,0,.45)" stroke-width=".45" stroke-linejoin="round"/>' +
      '<g clip-path="url(#xsi-clip)">' + pat +
        // round, like a real body: darker towards both edges, a soft sheen along the back
        '<path d="' + T.body + '" stroke="#000" stroke-width="1.7" fill="none" opacity=".26"/>' +
        '<path d="' + T.mid + '" stroke="#fff" stroke-width="1.1" fill="none" opacity=".16" stroke-linecap="round"/></g>' +
      // the head, turned a little up, with its eye; the hat sits on it (its brim over the crown, the tip behind)
      '<g transform="translate(13.7 8.3) rotate(-14) scale(1.22)"><path d="' + h[0] + '" fill="' + d + '" stroke="rgba(0,0,0,.5)" stroke-width=".4"/>' +
        (t === "s" || t === "l" ? '<path d="' + h[0] + '" fill="' + c + '" opacity=".35"/>' : "") +
        '<path d="' + h[0] + '" fill="url(#xsi-hd)"/>' +
        '<path d="M.4 1.3C2 1.9 4 1.7 5.2.9" stroke="' + b + '" stroke-width=".55" fill="none" opacity=".75"/>' +
        '<circle cx="' + h[1] + '" cy="' + h[2] + '" r="' + h[3] + '" fill="' + (h[4] ? "#c9a24a" : "#111") + '"/>' +
        (h[4] ? '<ellipse cx="' + h[1] + '" cy="' + h[2] + '" rx="' + (h[3] * .28).toFixed(2) + '" ry="' + (h[3] * .85).toFixed(2) + '" fill="#111"/>' : "") +
        '<circle cx="' + (h[1] + h[3] * .35).toFixed(2) + '" cy="' + (h[2] - h[3] * .4).toFixed(2) + '" r="' + (h[3] * .3).toFixed(2) + '" fill="#fff" opacity=".85"/>' +
        '<use href="#xsi-hat" transform="translate(1.6 -1.55) rotate(-6) scale(.058)"/></g>' +
      "</symbol>");
    symDone[id] = 1; return id;
  }
  var DEF_CODE = "6b5142edboc";   // SnakeList's own green S when a species has no colours yet
  function slug(s) { return String(s || "").trim().toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-+|-+$/g, ""); }
  function addIcon(el, id) {
    if (!el || el.querySelector(":scope > .xm-spi")) return;
    var code = (SP && SP[id]) || DEF_CODE;
    var s = D.createElementNS(NS, "svg"); s.setAttribute("class", "xm-spi"); s.setAttribute("aria-hidden", "true"); s.setAttribute("viewBox", "0 0 24 24");
    s.innerHTML = '<use href="#' + spSym(code) + '"/>';
    el.insertBefore(s, el.firstChild);
  }
  XM.spIcon = function (el, id) { spData().then(function () { addIcon(el, id); }); };
  function spIcons() {
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!e.isIntersecting) return; io.unobserve(e.target); var c = e.target; addIcon(c.querySelector(".card-name"), c.getAttribute("data-id")); });
    }, { rootMargin: "400px 0px" }) : null;
    var seenCards = new WeakSet();
    function scan(root) {
      root = root || D;
      if (io) [].forEach.call(root.querySelectorAll ? root.querySelectorAll("#grid .card[data-id]") : [], function (c) { if (!seenCards.has(c)) { seenCards.add(c); io.observe(c); } });
      [].forEach.call(D.querySelectorAll(".cp-row[data-sp] > b:first-of-type"), function (b) { addIcon(b, b.parentNode.getAttribute("data-sp")); });
      [].forEach.call(D.querySelectorAll(".sl3d-name"), function (a) { var i = a.querySelector("i"); addIcon(a, slug(i ? i.textContent : a.textContent)); });
      var sp = D.querySelector(".sp-main[data-id]"); if (sp) addIcon(sp.querySelector("h1"), sp.getAttribute("data-id"));
    }
    spData().then(function () {
      scan(D);
      var t = 0; new MutationObserver(function () { if (!t) t = setTimeout(function () { t = 0; scan(D); }, 120); }).observe(D.body, { childList: true, subtree: true });
    });
  }

  /* ================= "Show me": a tutorial-style pointer (a ring round the thing and a note beside it) ================= */
  var pt = null;
  XM.point = function (target, text, opt) {
    opt = opt || {};
    XM.unpoint();
    var el = typeof target === "string" ? D.querySelector(target) : target;
    if (!el) return false;
    try { el.scrollIntoView({ block: "center", behavior: RM.matches ? "auto" : "smooth" }); } catch (e) {}
    var ring = D.createElement("div"); ring.className = "xm-pt-ring"; ring.setAttribute("aria-hidden", "true");
    var bub = D.createElement("div"); bub.className = "xm-pt"; bub.setAttribute("role", "status");
    bub.innerHTML = '<i class="xm-pt-arrow" aria-hidden="true"></i>' + (opt.title ? "<b>" + esc(opt.title) + "</b>" : "") + "<p>" + esc(text) + '</p><button type="button" class="xm-pt-ok">Got it</button>';
    D.body.appendChild(ring); D.body.appendChild(bub);
    var cur = { el: el, ring: ring, bub: bub, raf: 0 };
    function place() {
      if (pt !== cur) return;
      if (!el.isConnected) { XM.unpoint(); return; }
      var r = el.getBoundingClientRect(), pad = 6;
      ring.style.left = (r.left - pad) + "px"; ring.style.top = (r.top - pad) + "px"; ring.style.width = (r.width + pad * 2) + "px"; ring.style.height = (r.height + pad * 2) + "px";
      var bw = bub.offsetWidth, bh = bub.offsetHeight, vw = innerWidth, vh = innerHeight;
      var below = r.bottom + 14 + bh < vh - 8 || r.top - 14 - bh < 8;
      var x = Math.max(10, Math.min(vw - bw - 10, r.left + r.width / 2 - bw / 2)), y = below ? r.bottom + 14 : r.top - 14 - bh;
      bub.style.left = x + "px"; bub.style.top = Math.max(8, Math.min(vh - bh - 8, y)) + "px";
      bub.classList.toggle("up", !below);
      bub.querySelector(".xm-pt-arrow").style.left = Math.max(14, Math.min(bw - 14, r.left + r.width / 2 - x)) + "px";
      cur.raf = requestAnimationFrame(place);
    }
    pt = cur; place();
    bub.querySelector(".xm-pt-ok").onclick = XM.unpoint;
    cur.key = function (e) { if (e.key === "Escape") XM.unpoint(); };
    cur.down = function (e) { if (bub.contains(e.target)) return; if (el.contains(e.target)) setTimeout(XM.unpoint, 250); };
    D.addEventListener("keydown", cur.key, true); D.addEventListener("pointerdown", cur.down, true);
    if (opt.ms) cur.t = setTimeout(XM.unpoint, opt.ms);
    try { bub.querySelector(".xm-pt-ok").focus({ preventScroll: true }); } catch (e) {}
    return true;
  };
  XM.unpoint = function () {
    if (!pt) return; var c = pt; pt = null; cancelAnimationFrame(c.raf); clearTimeout(c.t);
    D.removeEventListener("keydown", c.key, true); D.removeEventListener("pointerdown", c.down, true);
    c.ring.remove(); c.bub.remove();
  };
  /* a short message at the bottom of the screen (with an optional button) */
  XM.toast = function (html, btn, fn, ms) {
    var old = D.getElementById("xm-toast"); if (old) old.remove();
    var t = D.createElement("div"); t.id = "xm-toast"; t.setAttribute("role", "status");
    t.innerHTML = '<span class="xm-t-msg">' + html + "</span>" + (btn ? '<button type="button" class="xm-t-go">' + esc(btn) + "</button>" : "") + '<button type="button" class="xm-t-x" aria-label="Close">&times;</button>';
    if (btn) t.querySelector(".xm-t-go").onclick = function () { t.remove(); fn && fn(); };
    t.querySelector(".xm-t-x").onclick = function () { t.remove(); };
    D.body.appendChild(t);
    setTimeout(function () { if (t.isConnected) { t.classList.add("xm-t-out"); setTimeout(function () { t.remove(); }, 400); } }, ms || 7000);
    return t;
  };

  /* ================= Christmas audio: the fireplace and the Christmas music, mixed together =================
     The music is real recorded performances of Christmas songs (Kevin MacLeod, incompetech.com, CC BY 4.0 - see
     CREDITS.txt): a playlist that plays in order and repeats, streamed from christmas/music/ and loaded only when
     the music button is first pressed (nothing is preloaded). It goes through Web Audio, so its volume works on
     iPad / iPhone too (Safari ignores an audio element's own volume). The fire is made on the spot with Web Audio.
     The fire sits in the background and the music on top; each has its own volume. Volumes are kept in
     this browser (sl-xmas-audio); nothing ever starts playing by itself. window.SL_XMAS_AUDIO is for SnakeList's
     Settings: SL_XMAS_AUDIO.panel(el) puts the two volume controls into any element. */
  var AU = (function () {
    var st = { fire: false, music: false, fv: .7, mv: .6, away: false };
    try { var sv = JSON.parse(lsGet("sl-xmas-audio") || "{}"); if (sv.fv != null) st.fv = +sv.fv; if (sv.mv != null) st.mv = +sv.mv; } catch (e) {}
    var ctx = null, master = null, fireG = null, musicG = null, crT = 0, ls = [];
    function save() { lsSet("sl-xmas-audio", JSON.stringify({ fv: st.fv, mv: st.mv })); }
    function ac() {
      if (ctx) { if (ctx.state === "suspended") ctx.resume(); return ctx; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = .9;
      var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
      master.connect(comp); comp.connect(ctx.destination);
      fireG = ctx.createGain(); fireG.gain.value = 0; fireG.connect(master);
      musicG = ctx.createGain(); musicG.gain.value = 0; musicG.connect(master);
      // the fire: a low rumble of brown noise...
      var len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), last = 0;
      for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }
      var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
      src.connect(lp); lp.connect(fireG); src.start();
      return ctx;
    }
    function pop(vol) {
      var n = Math.floor(ctx.sampleRate * .03), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
      var s = ctx.createBufferSource(); s.buffer = b; var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1200 + Math.random() * 2000;
      var g = ctx.createGain(); g.gain.value = vol; s.connect(hp); hp.connect(g); g.connect(fireG); s.start();
    }
    function crackle() { if (!st.fire) return; pop(.3 + Math.random() * .45); crT = setTimeout(crackle, 180 + Math.random() * 900); }
    function fireLevel() { return st.fire ? st.fv * .32 * (st.away ? .45 : 1) : 0; }
    function musicLevel() { return st.music ? st.mv * .85 : 0; }
    function apply() { if (!ctx) return; fireG.gain.setTargetAtTime(fireLevel(), ctx.currentTime, .25); musicG.gain.setTargetAtTime(musicLevel(), ctx.currentTime, .15); }
    function emit() { ls.forEach(function (f) { try { f(st); } catch (e) {} }); }

    /* ---- the songs: recordings, one after another, then round again ---- */
    var SONGS = ["jingle-bells", "we-wish-you", "deck-the-halls", "o-christmas-tree", "silent-night"];
    var el = null, song = 0, ext = null;
    function songUrl(i) {
      if (!ext) {
        var t = D.createElement("audio"), ua = navigator.userAgent, apple = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Firefox/.test(ua));
        ext = !apple && t.canPlayType && t.canPlayType('audio/webm; codecs="opus"') === "probably" ? "webm" : "m4a";
      }
      return asset("music/" + SONGS[i % SONGS.length] + "." + ext);
    }
    function player() {
      if (el) return el;
      el = new Audio(); el.preload = "none"; el.setAttribute("playsinline", "");
      function next() { song = (song + 1) % SONGS.length; el.src = songUrl(song); if (st.music) el.play().catch(function () {}); }
      el.addEventListener("ended", next);
      // a song that cannot be fetched: on to the next one (and stop after a whole round of failures)
      var fails = 0;
      el.addEventListener("error", function () { if (++fails >= SONGS.length) { fails = 0; api.setMusic(false); return; } next(); });
      el.addEventListener("playing", function () { fails = 0; });
      try { ctx.createMediaElementSource(el).connect(musicG); } catch (e) { el.volume = st.mv; }
      el.src = songUrl(song);
      return el;
    }
    function startMusic() { var pr = player().play(); if (pr && pr.catch) pr.catch(function (e) { if (e && e.name === "NotAllowedError") api.setMusic(false); }); }
    function stopMusic() { if (el) el.pause(); }
    XM.songs = function () { return { list: SONGS.slice(), now: song, src: el && el.currentSrc, paused: !el || el.paused }; };

    var api = {
      state: function () { return { fire: st.fire, music: st.music, fireVolume: st.fv, musicVolume: st.mv }; },
      setFire: function (on) {
        on = !!on; if (on === st.fire) return; if (on && !ac()) return;
        st.fire = on; clearTimeout(crT); if (on) crackle(); apply(); emit();
      },
      setMusic: function (on) {
        on = !!on; if (on === st.music) return; if (on && !ac()) return;
        st.music = on; if (on) startMusic(); else stopMusic(); apply(); emit();
      },
      toggleFire: function () { api.setFire(!st.fire); }, toggleMusic: function () { api.setMusic(!st.music); },
      setVolume: function (which, v) { v = Math.max(0, Math.min(1, +v)); if (which === "fire") st.fv = v; else st.mv = v; save(); apply(); emit(); },
      setAway: function (a) { st.away = !!a; apply(); },
      burst: function () { if (!st.fire || !ctx) return; for (var i = 0; i < 6; i++) setTimeout(function () { pop(.8); }, i * 90 + Math.random() * 60); },
      on: function (f) { ls.push(f); },
      /* the two volume controls (and on/off buttons) in any element - SnakeList's Settings can call this */
      panel: function (host, opt) {
        opt = opt || {};
        var w = D.createElement("div"); w.className = "xm-audio" + (opt.dark ? " xm-audio-dark" : "") + (opt.compact ? " xm-audio-compact" : "");
        w.innerHTML = [["music", "Christmas music", '<path d="M9 18V5l10-2v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.6" fill="currentColor"/><circle cx="16.5" cy="16" r="2.6" fill="currentColor"/>'],
                       ["fire", "Fireplace", '<path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 1-8z" fill="currentColor"/>']].map(function (r) {
          return '<div class="xm-au-row" data-k="' + r[0] + '"><button type="button" class="xm-au-on" aria-pressed="false" aria-label="' + r[1] + ': on or off"><svg viewBox="0 0 24 24" aria-hidden="true">' + r[2] + '</svg></button>' +
            '<label><span>' + r[1] + '</span><input type="range" class="xm-vol" min="0" max="100" step="1" aria-label="' + r[1] + ' volume"></label></div>';
        }).join("");
        function sync() {
          [].forEach.call(w.querySelectorAll(".xm-au-row"), function (row) {
            var k = row.getAttribute("data-k"), on = k === "fire" ? st.fire : st.music, v = Math.round((k === "fire" ? st.fv : st.mv) * 100), inp = row.querySelector("input");
            row.querySelector(".xm-au-on").setAttribute("aria-pressed", String(on)); row.classList.toggle("on", on);
            if (D.activeElement !== inp) inp.value = v; inp.style.setProperty("--v", inp.value + "%");
          });
        }
        w.addEventListener("input", function (e) { var inp = e.target.closest(".xm-vol"); if (!inp) return; var k = inp.closest(".xm-au-row").getAttribute("data-k"); inp.style.setProperty("--v", inp.value + "%"); api.setVolume(k, inp.value / 100);
          if (!(k === "fire" ? st.fire : st.music) && +inp.value > 0) (k === "fire" ? api.setFire : api.setMusic)(true); });
        w.addEventListener("click", function (e) { var b = e.target.closest(".xm-au-on"); if (!b) return; var k = b.closest(".xm-au-row").getAttribute("data-k"); if (k === "fire") api.toggleFire(); else api.toggleMusic(); });
        api.on(sync); sync(); host.appendChild(w); return w;
      }
    };
    return api;
  })();
  window.SL_XMAS_AUDIO = XM.audio = AU;

  /* the Christmas music button, next to SnakeList's Settings (or, until there is a Settings button, at the end of the
     header's row of round buttons); a tap turns the music on or off and shows the two volume controls for a moment */
  var MUSIC_IC = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 18V5l10-2v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.7" fill="currentColor"/><circle cx="16.5" cy="16" r="2.7" fill="currentColor"/>' +
    '<path class="xm-mb-off" d="M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var GEAR = "#sl-settings-btn, #settings-btn, [data-sl-settings], .sl-settings-btn, .settings-btn";
  function musicBtn() {
    var row = D.querySelector(".hdr-actions"); if (!row) return false;
    var b = D.getElementById("xm-music-btn");
    if (!b) {
      b = D.createElement("button"); b.type = "button"; b.id = "xm-music-btn"; b.className = "theme-btn xm-music-btn"; b.setAttribute("aria-pressed", "false"); b.setAttribute("aria-label", "Christmas music");
      b.innerHTML = MUSIC_IC;
      b.addEventListener("click", function () { AU.toggleMusic(); popAudio(b); });
      AU.on(function (s) { b.setAttribute("aria-pressed", String(s.music)); b.classList.toggle("on", s.music); });
    }
    var gear = row.querySelector(GEAR) || D.querySelector(GEAR), anchor = gear || D.getElementById("theme-btn");
    if (anchor && anchor.parentNode && b.nextSibling !== anchor) anchor.parentNode.insertBefore(b, anchor);
    else if (!b.parentNode) row.appendChild(b);
    return true;
  }
  var pop = null, popT = 0;
  function popAudio(anchor) {
    if (!pop) {
      pop = D.createElement("div"); pop.className = "xm-aupop"; pop.setAttribute("role", "group"); pop.setAttribute("aria-label", "Christmas audio volume");
      AU.panel(pop); D.body.appendChild(pop);
      pop.addEventListener("pointerenter", function () { clearTimeout(popT); });
      pop.addEventListener("pointerleave", function () { popT = setTimeout(hidePop, 1600); });
      pop.addEventListener("focusin", function () { clearTimeout(popT); });
      D.addEventListener("pointerdown", function (e) { if (pop && !pop.hidden && !pop.contains(e.target) && !e.target.closest("#xm-music-btn")) hidePop(); }, true);
    }
    var r = anchor.getBoundingClientRect();
    pop.hidden = false;
    pop.style.top = (r.bottom + 8 + scrollY) + "px";
    pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth)) + "px";
    clearTimeout(popT); popT = setTimeout(hidePop, 4500);
  }
  function hidePop() { if (pop) pop.hidden = true; }
  /* SnakeList's Settings panel (when there is one): the Christmas audio controls go in, under its audio part */
  function settingsHook() {
    function add(panel) {
      if (!panel || panel.querySelector(".xm-set-audio")) return;
      var sec = D.createElement("section"); sec.className = "xm-set-audio";
      sec.innerHTML = "<h3>Christmas audio</h3>";
      AU.panel(sec);
      var audio = panel.querySelector('[data-section="audio"], [data-sl-settings-section="audio"], .sl-set-audio, #sl-settings-audio');
      (audio || panel).appendChild(sec);
    }
    D.addEventListener("sl-settings-open", function (e) { add((e && e.detail && e.detail.panel) || D.getElementById("sl-settings")); });
    new MutationObserver(function () { var p = D.getElementById("sl-settings"); if (p) add(p); if (!D.getElementById("xm-music-btn") || (D.querySelector(GEAR) && D.getElementById("xm-music-btn").nextSibling !== D.querySelector(GEAR))) musicBtn(); })
      .observe(D.body, { childList: true, subtree: true });
    var p0 = D.getElementById("sl-settings"); if (p0) add(p0);
  }

  /* ================= "Merry Christmas from SnakeList!" - once per person =================
     It waits its turn like the app's own pop-ups. Each new thing in the list can be tapped: the panel closes and
     SnakeList shows it (goes there and points at it). */
  var WKEY = "sl-xmas-welcome-seen", wOpen = false;
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
    var wn = D.getElementById("wn-sheet");
    if (wn) {
      var auto = function () { return wn.classList.contains("open") && !wn.classList.contains("wn-v") && (D.getElementById("wn-x") || {}).hidden && /What's new/.test((D.getElementById("wn-h") || {}).textContent || ""); };
      var userAsked = false;
      D.addEventListener("click", function (e) { if (e.target.closest && e.target.closest(".sl-ver, #updates-btn, #wn-all")) userAsked = true; }, true);
      new MutationObserver(function () { if (!userAsked && auto()) wn.classList.remove("open"); }).observe(wn, { attributes: true, attributeFilter: ["class"] });
      if (auto()) wn.classList.remove("open");
    }
    var orig = window.SL_canPrompt;
    if (orig && !orig.__xm) { window.SL_canPrompt = function (ex) { return !wOpen && orig(ex); }; window.SL_canPrompt.__xm = 1; }
    var tries = 0;
    (function wait() {
      var ready = orig ? (window.SL_promptsReady ? window.SL_promptsReady() : true) && orig() : !!window.__introDone;
      if (ready && !othersOpen()) { if (++tries >= 3) return show(); } else tries = 0;
      setTimeout(wait, 400);
    })();
  }
  function firstCard() { var cs = D.querySelectorAll("#grid .card[data-id]"); for (var i = 0; i < cs.length; i++) if (cs[i].offsetParent) return cs[i]; return null; }
  function goTab(id) { var t = D.getElementById(id); if (t && !t.classList.contains("active")) t.click(); if (XM.cabin && id !== "tab-cabin") XM.cabin.close(); }
  var NEWS = [
    ["cover", "A festive cover", "pine branches with hanging baubles, fairy lights, snow and a Santa hat on the photo's snake", function () {
      scrollTo({ top: 0, behavior: RM.matches ? "auto" : "smooth" }); setTimeout(function () { XM.point(D.querySelector("#sl-hero .xm-phat svg") || D.querySelector("#sl-hero .xm-corner.l") || D.getElementById("sl-hero"), "The cover is dressed for Christmas - and the snake has its Santa hat on.", { ms: 9000 }); }, 700); }],
    ["logo", "The Christmas logo", "a Santa hat on the snake S, snow on the letters and a stocking full of presents", function () {
      var l = D.querySelector(".sl-header .sl-titletext") || D.querySelector(".sl-header .sl-title"); XM.point(l, "SnakeList's own logo, with a Santa hat, a little snow and a stocking full of presents.", { ms: 9000 }); }],
    ["icons", "Little Santa snakes", "a tiny snake in each species' own colours, in a Santa hat, by every name", function () {
      goTab("tab-guide"); setTimeout(function () { var c = firstCard(), i = c && c.querySelector(".xm-spi"); XM.point(i || (c && c.querySelector(".card-name")), "Every snake has a tiny Santa-hat snake in its own colours by its name.", { ms: 9000 }); }, 400); }],
    ["music", "Christmas music", "real recordings of Christmas songs by the fire - the music button is up by the other buttons", function () {
      var b = D.getElementById("xm-music-btn"); XM.point(b, "Tap here for Christmas music. It plays along with the cabin's fireplace - each has its own volume.", { ms: 9000 }); }],
    ["cabin", "The Christmas Cabin", "a new tab: do Christmas tasks, open presents and decorate your tree", function () {
      if (XM.cabin) XM.cabin.open(true); setTimeout(function () { XM.point(D.querySelector("#xm-cabin .xc-stage"), "Your Christmas Cabin. Do Christmas tasks to earn presents for your tree.", { ms: 9000 }); }, 500); }],
    ["tasks", "Christmas tasks", "each one puts a present under your tree - tap Show me to see how", function () {
      if (XM.cabin) { XM.cabin.open(true); setTimeout(function () { XM.cabin.showTasks(); }, 400); } }]
  ];
  function show() {
    if (D.getElementById("xm-welcome")) return;
    var w = D.createElement("div"); w.id = "xm-welcome"; w.className = "xm-panel-wrap xm-wl"; w.setAttribute("role", "dialog"); w.setAttribute("aria-modal", "true"); w.setAttribute("aria-labelledby", "xm-wl-h");
    w.innerHTML = '<div class="xm-panel-bg"></div><div class="xm-panel xm-wl-card">' +
      '<div class="xm-ph"><h2 id="xm-wl-h">Merry Christmas from SnakeList!</h2><button type="button" class="xm-px" aria-label="Close"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>' +
      '<p class="xm-wl-msg">SnakeList is dressed for the holidays. Every snake, map and list is right where you left it &ndash; just a little more festive.</p>' +
      '<p class="xm-wl-sub">New for Christmas &ndash; tap one to see it</p>' +
      '<ul class="xm-wl-list">' + NEWS.map(function (n, i) { return '<li><button type="button" data-news="' + i + '"><b>' + n[1] + "</b><span>" + n[2] + '</span><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></li>'; }).join("") + "</ul>" +
      '<button type="button" class="xm-wl-go">Explore SnakeList</button></div>';
    var prev = D.activeElement;
    function close() {
      lsSet(WKEY, "1"); wOpen = false; D.documentElement.classList.remove("xm-welcome-open");
      w.classList.add("xm-out"); setTimeout(function () { w.remove(); }, 200);
      D.removeEventListener("keydown", key, true);
      try { if (prev && prev.focus && D.contains(prev)) prev.focus({ preventScroll: true }); } catch (e) {}
    }
    function key(e) { if (e.key === "Escape") { e.preventDefault(); close(); } }
    w.querySelector(".xm-wl-go").onclick = close;
    w.querySelector(".xm-px").onclick = close;
    w.querySelector(".xm-panel-bg").onclick = close;
    w.addEventListener("click", function (e) { var b = e.target.closest("[data-news]"); if (!b) return; close(); var n = NEWS[+b.getAttribute("data-news")]; setTimeout(n[3], 260); });
    D.addEventListener("keydown", key, true);
    D.body.appendChild(w); wOpen = true; D.documentElement.classList.add("xm-welcome-open");
    if (window.SL_promptShown) window.SL_promptShown();
    try { w.querySelector(".xm-wl-go").focus({ preventScroll: true }); } catch (e) {}
  }
  XM.welcome = show;

  /* the cover and the logo are dressed the moment they arrive, while the (large) page is still loading */
  function dressCover() {
    var hat = XM.hat();
    if (XM.kind === "xm-app") { decorate(D.getElementById("intro"), true); decorate(D.getElementById("sl-hero"), true); kick(); stockings(); photoHat(); }
    icons();
    return hat && (XM.kind !== "xm-app" || D.getElementById("sl-hero"));
  }
  if (D.readyState === "loading" && "MutationObserver" in window) {
    var mo = new MutationObserver(function () { if (dressCover()) mo.disconnect(); });
    mo.observe(D.documentElement, { childList: true, subtree: true });
    D.addEventListener("DOMContentLoaded", function () { mo.disconnect(); });
  }
  if (D.title && D.title.indexOf("Christmas preview") < 0) D.title += " · Christmas preview";

  function start() {
    dressCover(); logo(); photoHat();
    accents(); pill(); spIcons(); welcome();
    if (XM.kind === "xm-app") { var n = 0; (function m() { if (!musicBtn() && n++ < 40) setTimeout(m, 250); })(); settingsHook(); }
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", start); else start();
})();
