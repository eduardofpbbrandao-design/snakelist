/* SnakeList events preview - New Year 2026-2027 (preview key "newyear", tools/previews.js).
   Loaded with the other events modules (tools/events_loader.js loads them when the "events" OR the "newyear" preview
   is on); it only does anything while the "newyear" preview is on and the New Year event (config.js newyear2027)
   hasn't ended.

   What it shows, reusing the events infrastructure (theme tokens .sl-ev-t-newyear, the countdown's own clock
   EV.clock, EV.panel, EV.time, EV.reducedMotion):
     * the page in the New Year theme (html.sl-ny): midnight blue, deep green, gold and silver; the Christmas cover
       decorations step aside (the Christmas Cabin, Advent rewards and collection all stay - nothing is removed)
     * "HAPPY NEW YEAR 2026-2027!" above the SnakeList logo, with two little snakes in party hats ("HAPPY NEW YEAR!")
     * a New Year card above the tabs: a countdown to 1 January 2027 00:00 in the viewer's own time zone (the
       browser's; SnakeList has no time-zone setting of its own yet), tasteful fireworks inside the card only, and
       a reminder that the Christmas rewards are kept
     * at midnight (while the page is open) a short celebration with fireworks - skippable (button, Escape), shown once
       per browser; a still version with reduce motion. The card's "Play the midnight moment" shows it any time.
   The time is the server-checked time (EV.time) once known, else the device clock (display only - nothing unlocks).
   A future event's theme = its own tokens (.sl-ev-t-<theme>) + a module like this one. */
(function () {
  "use strict";
  var EV = window.SL_EVENTS; if (!EV || EV.pub) return;
  var D = document, esc = EV.esc, ic = EV.art.icon, H = D.documentElement;
  var E = EV.event("newyear2027"); if (!E) return;
  var KEY = "newyear", SEEN = "sl-ny-midnight-seen:2027";
  function on() {
    try { if (window.SL_PREVIEWS && SL_PREVIEWS.on) return SL_PREVIEWS.on(KEY); if (window.SL_PREVIEW_ON) return !!SL_PREVIEW_ON(KEY); return localStorage.getItem("sl-art-preview-" + KEY) === "1"; } catch (e) { return false; }
  }
  function now() { return EV.time.display(); }
  // midnight, 1 January 2027, in this viewer's own time zone
  function midnight() { return new Date(2027, 0, 1, 0, 0, 0).getTime(); }
  function tz() { return EV.tzName ? EV.tzName() : ""; }
  function active(t) { return on() && t < EV.ms(E.end); }

  /* ---------------- art: a little snake (SnakeList's S) in a party hat ---------------- */
  var hatN = 0;
  function partyHat(cx, cy, s, rot, c1, c2) {
    var g = "sl-ny-h" + (++hatN);
    return '<g transform="translate(' + cx + " " + cy + ") rotate(" + rot + ") scale(" + s + ')"><defs><linearGradient id="' + g + '" x1="0" x2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>' +
      '<path d="M-17 0L0-44 17 0Z" fill="url(#' + g + ')"/><path d="M-11.5-14.5L8-30M-6-29.5L4.5-38M-15.5-4.5L14.5-21" stroke="#FFF8ED" stroke-width="3.2" stroke-linecap="round" opacity=".85"/>' +
      '<ellipse cx="0" cy="0" rx="18.5" ry="4.6" fill="#C9D3DE"/><circle cx="0" cy="-45" r="6" fill="#FFF8ED"/><circle cx="-2" cy="-47" r="2" fill="#fff"/></g>';
  }
  function partySnake(flip, c1, c2) {
    return '<svg class="sl-ny-snake' + (flip ? " r" : "") + '" viewBox="-26 -40 162 188" aria-hidden="true"><g' + (flip ? ' transform="translate(110 0) scale(-1 1)"' : "") + '><use href="#mark-snake"></use>' + partyHat(84, 26, 1, 14, c1, c2) + "</g></svg>";
  }
  EV.art.partySnake = partySnake;

  /* ---------------- the banner above the logo ---------------- */
  var TOP = null;
  function topBanner() {
    var h1 = D.querySelector(".sl-header .sl-title"); if (!h1) return;
    if (!TOP) {
      TOP = D.createElement("div"); TOP.className = "sl-ny-top"; TOP.setAttribute("role", "note");
      TOP.innerHTML = partySnake(false, "#D8B76A", "#B08A3A") +
        '<p><span class="sl-ny-say" aria-hidden="true">HAPPY NEW YEAR!</span><b>HAPPY NEW YEAR 2026&ndash;2027!</b></p>' + partySnake(true, "#C9D3DE", "#8E9BAA");
    }
    if (TOP.nextElementSibling !== h1) h1.parentNode.insertBefore(TOP, h1);
  }

  /* ---------------- fireworks, drawn on one small canvas inside the card ---------------- */
  var COLS = ["#F3DC9C", "#D8B76A", "#E6ECF2", "#C9D3DE", "#9BD3B5"];
  function fireworks(host, opt) {
    opt = opt || {};
    var c = D.createElement("canvas"); c.className = "sl-ny-fw"; c.setAttribute("aria-hidden", "true"); host.appendChild(c);
    var g = c.getContext && c.getContext("2d"); if (!g) return { stop: function () {} };
    var W = 0, Hh = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.5), parts = [], rockets = [], raf = 0, last = 0, next = 0, alive = true, rate = opt.rate || 2600;
    function size() { var r = host.getBoundingClientRect(); W = Math.max(1, r.width); Hh = Math.max(1, r.height); c.width = Math.round(W * dpr); c.height = Math.round(Hh * dpr); }
    function burst(x, y, big) {
      var n = big ? 64 : 38, col = COLS[Math.floor(Math.random() * COLS.length)], col2 = COLS[Math.floor(Math.random() * COLS.length)];
      for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2 + Math.random() * .1, v = (big ? 95 : 70) * (.55 + Math.random() * .5);
        parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 1.3 + Math.random() * .7, c: i % 3 ? col : col2 }); }
    }
    function launch(big) { rockets.push({ x: W * (.15 + Math.random() * .7), y: Hh + 4, ty: Hh * (.18 + Math.random() * .3), v: Hh * 1.05, big: big }); }
    function still() {     // reduce motion: a few bursts drawn once, standing still
      size(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
      [[.2, .35], [.5, .22], [.8, .38]].forEach(function (p, k) { var x = W * p[0], y = Hh * p[1];
        for (var i = 0; i < 24; i++) { var a = i / 24 * Math.PI * 2; g.strokeStyle = COLS[(k + i) % COLS.length]; g.globalAlpha = .55; g.lineWidth = 1.4;
          g.beginPath(); g.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); g.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22); g.stroke(); } });
      g.globalAlpha = 1;
    }
    function frame(t) {
      raf = 0; if (!alive) return;
      var dt = last ? Math.min(.05, (t - last) / 1000) : 0; last = t;
      if (t > next) { launch(!!opt.big); next = t + rate * (.6 + Math.random() * .8); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
      for (var i = rockets.length - 1; i >= 0; i--) { var r = rockets[i]; r.y -= r.v * dt; g.fillStyle = "rgba(255,248,237,.8)"; g.fillRect(r.x - 1, r.y, 2, 6); if (r.y <= r.ty) { burst(r.x, r.y, r.big); rockets.splice(i, 1); } }
      for (i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life += dt; if (p.life > p.max) { parts.splice(i, 1); continue; }
        p.vx *= .985; p.vy = p.vy * .985 + 38 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        g.globalAlpha = Math.max(0, 1 - p.life / p.max); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 1.6, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      if (!D.hidden && host.isConnected) raf = requestAnimationFrame(frame); else last = 0;
    }
    function start() { size(); if (EV.reducedMotion()) { still(); return; } if (!raf) { last = 0; next = 0; raf = requestAnimationFrame(frame); } }
    var ro = window.ResizeObserver ? new ResizeObserver(function () { size(); if (EV.reducedMotion()) still(); }) : null; if (ro) ro.observe(host);
    D.addEventListener("visibilitychange", function () { if (!D.hidden && alive) start(); });
    start();
    return { stop: function () { alive = false; if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); c.remove(); }, burst: function () { if (!EV.reducedMotion()) { launch(true); launch(true); } } };
  }

  /* ---------------- the New Year card above the tabs ---------------- */
  var CARD = null, FW = null, lastPhase = "";
  function rewardsLine() {
    var s = EV.advent && EV.advent.stats ? EV.advent.stats() : null, n = s ? s.covered : 0;
    return n ? "Your Christmas rewards stay yours: " + n + " Advent door" + (n === 1 ? "" : "s") + " and everything in your collection." : "Your Christmas rewards and collection stay yours for good.";
  }
  function cardHtml(t) {
    var left = midnight() - t, after = left <= 0, z = tz();
    return '<div class="sl-ny-in">' +
      '<span class="sl-ny-art">' + EV.art.event("newyear") + "</span>" +
      '<div class="sl-ny-txt"><small>' + (after ? "Happy New Year!" : "New Year 2026&ndash;2027") + "</small>" +
      "<b>" + (after ? "Welcome to 2027!" : "Countdown to 2027") + "</b>" +
      '<em>' + esc(after ? rewardsLine() : "Midnight on 1 January 2027 · " + (z ? z.replace(/_/g, " ") + " time" : "your local time")) + "</em></div>" +
      (after ? "" : '<div class="sl-ny-clock">' + EV.clock.html(left, "sl-ev-mini") + '<span class="sl-ev-sr" data-sr aria-live="polite" aria-atomic="true">' + esc("Time until New Year: " + EV.clock.spokenMin(left)) + "</span></div>") +
      '<div class="sl-ny-acts"><button type="button" class="sl-ny-btn" data-ny="play">' + ic("spark", 15) + "<span>Play the midnight moment</span></button>" +
      (after ? "" : '<button type="button" class="sl-ny-btn sl-ny-ghost" data-ny="keep">' + ic("gift", 15) + "<span>My Christmas rewards</span></button>") + "</div></div>";
  }
  function card(t) {
    var tabs = D.querySelector(".tabs"); if (!tabs) return;
    if (!CARD) {
      CARD = D.createElement("section"); CARD.className = "sl-ny-card sl-ev-t-newyear"; CARD.setAttribute("aria-label", "New Year 2026 to 2027");
      CARD.addEventListener("click", function (e) {
        var b = e.target.closest("[data-ny]"); if (!b) return;
        var w = b.getAttribute("data-ny");
        if (w === "play") celebrate(true);
        if (w === "keep" && EV.advent && EV.advent.openInventory) EV.advent.openInventory();
      });
    }
    var pub = D.getElementById("sl-ev-pub"), ban = D.getElementById("sl-ev-banner"), anchor = (pub && pub.isConnected ? pub : ban && ban.isConnected ? ban : tabs);
    if (!CARD.isConnected || CARD.nextElementSibling !== anchor) anchor.parentNode.insertBefore(CARD, anchor);
    var ph = midnight() - t <= 0 ? "after" : "before";
    if (ph !== lastPhase) { CARD.innerHTML = cardHtml(t); lastPhase = ph; if (FW) FW.stop(); FW = fireworks(CARD, { rate: ph === "after" ? 1500 : 3200 }); }
    else if (ph === "before") {
      EV.clock.set(CARD, midnight() - t);
      var sr = CARD.querySelector("[data-sr]"), tx = "Time until New Year: " + EV.clock.spokenMin(midnight() - t); if (sr && sr.textContent !== tx) sr.textContent = tx;
    }
  }

  /* ---------------- midnight: a short celebration, skippable ---------------- */
  var CEL = null;
  function celebrate(manual) {
    if (CEL) return;
    if (!manual) EV.ls.set(SEEN, 1);
    var ov = CEL = D.createElement("div"); ov.className = "sl-ny-cel"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Happy New Year 2027");
    ov.innerHTML = '<div class="sl-ny-cel-in"><p class="sl-ny-cel-k">Midnight &middot; 1 January 2027</p><h2>Happy New Year 2027!</h2>' +
      '<div class="sl-ny-cel-snakes">' + partySnake(false, "#D8B76A", "#B08A3A") + partySnake(true, "#C9D3DE", "#8E9BAA") + "</div>" +
      "<p>Thank you for exploring snakes with SnakeList this year.</p>" +
      '<button type="button" class="sl-ny-btn" data-x>Skip</button></div>';
    D.body.appendChild(ov);
    var fw = fireworks(ov, { rate: 520, big: true }), t = setTimeout(close, EV.reducedMotion() ? 9000 : 6500), prev = D.activeElement;
    function close() {
      clearTimeout(t); fw.stop(); D.removeEventListener("keydown", key, true);
      ov.classList.add("out"); setTimeout(function () { ov.remove(); }, 250); CEL = null;
      try { if (prev && prev.focus) prev.focus({ preventScroll: true }); } catch (e) {}
    }
    function key(e) { if (e.key === "Escape") { e.preventDefault(); close(); } }
    ov.querySelector("[data-x]").addEventListener("click", close);
    D.addEventListener("keydown", key, true);
    try { ov.querySelector("[data-x]").focus({ preventScroll: true }); } catch (e) {}
  }
  EV.newYear = { celebrate: celebrate, midnight: midnight, active: function () { return active(now()); } };

  /* ---------------- keeping in step ---------------- */
  var was = null, prevT = null;
  function tick() {
    if (D.hidden) return;
    var t = now(), a = active(t);
    if (a !== was) {
      H.classList.toggle("sl-ny", a);
      if (!a) { if (TOP) TOP.remove(); if (CARD) CARD.remove(); if (FW) { FW.stop(); FW = null; } lastPhase = ""; }
      was = a;
    }
    if (!a) return;
    topBanner(); card(t);
    // the page was open as midnight came: the celebration, once (not for a page opened later that day)
    var m = midnight();
    if (prevT != null && prevT < m && t >= m && t - m < 60000 && !EV.ls.get(SEEN, 0)) celebrate(false);
    prevT = t;
  }
  setInterval(tick, 500);
  D.addEventListener("sl-previews-changed", tick);
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", tick); else tick();
})();
