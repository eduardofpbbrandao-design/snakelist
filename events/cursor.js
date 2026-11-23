/* SnakeList events preview - Cursor Customization (Settings -> Cursor Customization): a colour for the mouse pointer
   and an optional effect. A subscriber benefit, only on devices with a real mouse or trackpad ((pointer: fine) and
   hover), never on touch screens. Effects are drawn on one transparent canvas that ignores clicks; the drawing loop
   only runs while something is moving and stops by itself. With "reduce motion" on, moving effects become a still glow.
   The choice is kept in this browser and, when signed in, in the account (prefs/{uid}). If the subscription ends, the
   normal pointer comes back but the choice is remembered.
   Hooks: SL_EVENTS.cursor.open(), SL_EVENTS.cursor.mountSettings(container) (the Settings panel can call this;
   otherwise a "Cursor Customization" row is added to a settings panel found as #sl-settings / .sl-settings / [data-sl-settings]). */
(function () {
  "use strict";
  var EV = window.SL_EVENTS; if (!EV) return;
  var D = document, CFG = EV.cfg.cursor, esc = EV.esc, ic = EV.art.icon, KEY = "sl-ev-cursor";
  var MQ = window.matchMedia ? matchMedia("(pointer: fine) and (hover: hover)") : { matches: false };
  var pref = Object.assign({ colour: "green", effect: "none" }, EV.ls.get(KEY, {}) || {});
  function colourOf(k) { var c = CFG.colours.filter(function (x) { return x[0] === k; })[0]; return c ? c[2] : "#4CAF50"; }
  function supported() { return !!MQ.matches; }
  function active() { return supported() && EV.isSubscriber(); }

  /* ---------------- the pointer itself ---------------- */
  function cursorSvg(k) {
    var c = colourOf(k), fill = c === "rainbow" ? "url(#g)" : c;
    var defs = c === "rainbow" ? '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d4d"/><stop offset=".25" stop-color="#ffd23f"/><stop offset=".5" stop-color="#3ddc84"/><stop offset=".75" stop-color="#3b82f6"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs>' : "";
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">' + defs + '<path d="M3 2l17 9.5-7.2 1.8L9 21z" fill="' + fill + '" stroke="' + (k === "white" ? "#1d2b22" : "#fff") + '" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") 3 2, auto';
  }
  var styleEl = null;
  function applyPointer() {
    var on = active();
    D.documentElement.classList.toggle("sl-ev-cur", on);
    if (!on) { if (styleEl) { styleEl.remove(); styleEl = null; } return; }
    if (!styleEl) { styleEl = D.createElement("style"); styleEl.id = "sl-ev-cur-style"; D.head.appendChild(styleEl); }
    styleEl.textContent = "html.sl-ev-cur, html.sl-ev-cur body { cursor: " + cursorSvg(pref.colour) + "; }";
  }

  /* ---------------- effects engine (one per canvas) ---------------- */
  function Fx(canvas, box) {
    this.c = canvas; this.box = box; this.ctx = canvas.getContext("2d"); this.parts = []; this.trail = []; this.x = null; this.y = null;
    this.raf = 0; this.effect = "none"; this.colour = "green"; this.hue = 0; this.last = 0; this.size();
  }
  Fx.prototype.size = function () {
    var r = this.box(), dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height; this.c.width = Math.max(1, Math.round(r.width * dpr)); this.c.height = Math.max(1, Math.round(r.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  Fx.prototype.set = function (effect, colour) { this.effect = effect; this.colour = colour; this.parts.length = 0; this.trail.length = 0; this.ctx.clearRect(0, 0, this.w, this.h); };
  Fx.prototype.still = function () { return EV.reducedMotion() && this.effect !== "none"; };
  Fx.prototype.move = function (x, y) {
    if (this.effect === "none") return;
    var px = this.x, py = this.y; this.x = x; this.y = y;
    var e = this.still() ? "glow" : this.effect, col = colourOf(this.colour), n, i;
    if (e === "trail" || e === "rainbow") { this.trail.push({ x: x, y: y, t: performance.now() }); if (this.trail.length > 28) this.trail.shift(); }
    else if (e === "sparkle" || e === "golden" || e === "snow") {
      var dist = px == null ? 0 : Math.hypot(x - px, y - py);
      n = Math.min(3, 1 + Math.floor(dist / 18));
      for (i = 0; i < n && this.parts.length < 80; i++) this.parts.push({ x: x + (Math.random() - .5) * 8, y: y + (Math.random() - .5) * 8, vx: (Math.random() - .5) * (e === "snow" ? .6 : 1.6), vy: e === "snow" ? .4 + Math.random() * .7 : (Math.random() - .5) * 1.6 - .3,
        life: 1, r: e === "snow" ? 2 + Math.random() * 2.5 : 1.4 + Math.random() * 2.2, c: e === "golden" ? (Math.random() < .5 ? "#E0B13B" : "#fff3c4") : e === "snow" ? "#ffffff" : col === "rainbow" ? "hsl(" + Math.floor(Math.random() * 360) + ",90%,65%)" : col });
    }
    this.kick();
  };
  Fx.prototype.kick = function () { var self = this; if (!this.raf) this.raf = requestAnimationFrame(function (t) { self.frame(t); }); };
  Fx.prototype.frame = function (t) {
    this.raf = 0;
    var ctx = this.ctx, e = this.still() ? "glow" : this.effect, col = colourOf(this.colour), alive = false, now = performance.now(), i;
    ctx.clearRect(0, 0, this.w, this.h);
    if ((e === "glow" || e === "emerald") && this.x != null) {
      var gc = e === "emerald" ? "#10B981" : col === "rainbow" ? "hsl(" + ((now / 20) % 360) + ",90%,60%)" : col, R = e === "emerald" ? 34 : 24;
      var g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, R); g.addColorStop(0, hexA(gc, .55)); g.addColorStop(1, hexA(gc, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, 7); ctx.fill();
      if (col === "rainbow" && !EV.reducedMotion()) alive = true;
    }
    if (e === "trail" || e === "rainbow") {
      this.trail = this.trail.filter(function (p) { return now - p.t < 420; });
      var n = this.trail.length;
      for (i = 1; i < n; i++) {
        var a = this.trail[i - 1], b = this.trail[i], k = i / n;
        ctx.strokeStyle = e === "rainbow" || col === "rainbow" ? "hsla(" + ((i * 14 + now / 6) % 360) + ",90%,60%," + k + ")" : hexA(col, k * .9);
        ctx.lineWidth = 1 + k * 7; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      if (n > 1) { var hd = this.trail[n - 1]; ctx.fillStyle = e === "rainbow" ? "#fff" : col === "rainbow" ? "#fff" : col; ctx.beginPath(); ctx.arc(hd.x, hd.y, 4.5, 0, 7); ctx.fill(); }
      alive = alive || n > 0;
    }
    if (this.parts.length) {
      for (i = this.parts.length - 1; i >= 0; i--) {
        var p = this.parts[i]; p.x += p.vx; p.y += p.vy; p.life -= e === "snow" ? .012 : .028;
        if (p.life <= 0 || p.y > this.h + 10) { this.parts.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
        if (e === "snow") { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
        else star(ctx, p.x, p.y, p.r * (1 + (1 - p.life)));
      }
      ctx.globalAlpha = 1; alive = alive || this.parts.length > 0;
    }
    if (alive) this.kick();
  };
  function star(ctx, x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r * 2); ctx.lineTo(x + r * .5, y - r * .5); ctx.lineTo(x + r * 2, y); ctx.lineTo(x + r * .5, y + r * .5); ctx.lineTo(x, y + r * 2); ctx.lineTo(x - r * .5, y + r * .5); ctx.lineTo(x - r * 2, y); ctx.lineTo(x - r * .5, y - r * .5); ctx.closePath(); ctx.fill(); }
  function hexA(c, a) {
    if (/^hsl\(/.test(c)) return c.replace("hsl(", "hsla(").replace(")", "," + a + ")");
    var m = /^#?([0-9a-f]{6})$/i.exec(c); if (!m) return c; var n = parseInt(m[1], 16);
    return "rgba(" + (n >> 16) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  }

  /* ---------------- the page-wide effect ---------------- */
  var G = null;
  function applyFx() {
    var want = active() && pref.effect !== "none";
    if (!want) { if (G) { cancelAnimationFrame(G.raf); G.c.remove(); G = null; } return; }
    if (!G) {
      var c = D.createElement("canvas"); c.className = "sl-ev-curfx"; c.setAttribute("aria-hidden", "true"); D.body.appendChild(c);
      G = new Fx(c, function () { return { width: window.innerWidth, height: window.innerHeight }; });
    }
    G.set(pref.effect, pref.colour);
  }
  window.addEventListener("pointermove", function (e) { if (G && e.pointerType !== "touch") G.move(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener("resize", function () { if (G) G.size(); });
  function apply() { applyPointer(); applyFx(); EV.emit("cursor", { pref: pref, active: active() }); }

  /* ---------------- saving ---------------- */
  function save() {
    EV.ls.set(KEY, pref); apply();
    var u = EV.user(); if (!u || EV.testMode()) return;
    EV.db().then(function (db) { return db.collection("prefs").doc(u.uid).set({ cursor: { colour: pref.colour, effect: pref.effect }, updated: EV.serverTimestamp() }); }).catch(function () {});
  }
  EV.on("auth", function (u) {
    if (!u) return;
    EV.db().then(function (db) { return db.collection("prefs").doc(u.uid).get(); }).then(function (d) {
      var c = d.exists && d.data().cursor; if (c && c.colour) { pref = { colour: c.colour, effect: c.effect || "none" }; EV.ls.set(KEY, pref); apply(); }
    }).catch(function () {});
  });
  EV.on("sub", apply);
  if (MQ.addEventListener) MQ.addEventListener("change", apply);

  /* ---------------- the settings panel ---------------- */
  var P = null, PF = null;
  function html() {
    var sup = supported(), sub = EV.isSubscriber();
    var h = (EV.testMode() ? EV.testBadge() : "") +
      (!sup ? '<div class="sl-ev-note">Cursor customization works on computers with a mouse or trackpad. This device uses touch, so the normal pointer stays.</div>' : "") +
      (sup && !sub ? '<div class="sl-ev-note">' + ic("crown", 14) + ' <b>A subscriber benefit.</b> You can try every colour and effect in the preview box below; they show across SnakeList once you subscribe. <button type="button" class="sl-ev-btn" data-act="sub" style="min-height:28px;padding:3px 10px;margin-top:6px">See subscription</button></div>' : "") +
      '<h3 class="sl-ev-h3">Colour</h3><div class="sl-ev-swatches" role="group" aria-label="Cursor colour">' + CFG.colours.map(function (c) {
        var bg = c[2] === "rainbow" ? "conic-gradient(#ff4d4d,#ffd23f,#3ddc84,#3b82f6,#a855f7,#ff4d4d)" : c[2];
        return '<button type="button" class="sl-ev-sw" data-colour="' + c[0] + '" aria-pressed="' + (pref.colour === c[0]) + '"><i style="background:' + bg + '"></i>' + esc(c[1]) + "</button>";
      }).join("") + "</div>" +
      '<h3 class="sl-ev-h3">Effect</h3><div class="sl-ev-fxlist" role="group" aria-label="Cursor effect">' + CFG.effects.map(function (f) {
        return '<button type="button" class="sl-ev-sw" data-effect="' + f[0] + '" aria-pressed="' + (pref.effect === f[0]) + '">' + esc(f[1]) + "</button>";
      }).join("") + "</div>" +
      (EV.reducedMotion() ? '<p class="sl-ev-muted" style="margin-top:6px">Your device asks for reduced motion, so moving effects are shown as a still glow.</p>' : "") +
      '<div class="sl-ev-curprev" data-prev>' + (sup ? "Move your pointer here to preview" : "Preview needs a mouse or trackpad") + "<canvas></canvas></div>" +
      '<div class="sl-ev-row"><button type="button" class="sl-ev-btn" data-act="reset">Reset to the normal pointer</button></div>' +
      '<p class="sl-ev-muted">' + (sub ? (sup ? "Saved automatically" + (EV.user() ? " to your account." : " on this device.") : "") : "Your choice is remembered.") + " If a subscription ends, the normal pointer comes back and your choice is kept for later.</p>";
    return h;
  }
  function open() {
    P = EV.panel("sl-ev-cur", ic("cursor", 18) + " Cursor Customization", html(), { onClose: function () { if (PF) cancelAnimationFrame(PF.raf); P = PF = null; } });
    wire();
    P.addEventListener("click", function (e) {
      var c = e.target.closest("[data-colour]"), f = e.target.closest("[data-effect]"), a = e.target.closest("[data-act]");
      if (c) pref.colour = c.getAttribute("data-colour");
      else if (f) pref.effect = f.getAttribute("data-effect");
      else if (a && a.getAttribute("data-act") === "reset") pref = { colour: "green", effect: "none" };
      else if (a && a.getAttribute("data-act") === "sub") { if (EV.subscribe) EV.subscribe.open(); return; }
      else return;
      save(); repaint();
    });
    return P;
  }
  function wire() {
    var box = P.querySelector("[data-prev]"), cv = box.querySelector("canvas");
    PF = new Fx(cv, function () { return box.getBoundingClientRect(); }); PF.set(pref.effect, pref.colour);
    box.style.cursor = supported() ? cursorSvg(pref.colour) : "";
    box.addEventListener("pointermove", function (e) { if (e.pointerType === "touch") return; var r = box.getBoundingClientRect(); PF.move(e.clientX - r.left, e.clientY - r.top); });
  }
  function repaint() {
    if (!P || !P.isConnected) return;
    var b = P.querySelector(".sl-ev-body"), y = b.scrollTop; if (PF) cancelAnimationFrame(PF.raf);
    b.innerHTML = html(); b.scrollTop = y; wire();
  }
  // Settings -> Cursor Customization
  function mountSettings(container) {
    if (!container || container.querySelector(".sl-ev-cur-row")) return;
    var row = D.createElement("div"); row.className = "sl-ev-cur-row";
    row.innerHTML = '<button type="button" class="sl-ev-btn" style="width:100%;justify-content:flex-start">' + ic("cursor") + "Cursor Customization <span class=\"sl-ev-prem\" style=\"margin-left:auto\">Subscribers</span></button>";
    row.querySelector("button").addEventListener("click", open);
    container.appendChild(row);
  }
  var autoSettings = true;
  setInterval(function () {
    if (!autoSettings || D.hidden) return;
    var s = D.querySelector("#sl-settings, .sl-settings, [data-sl-settings]");
    if (s) { var inner = s.querySelector(".sl-settings-body, [data-sl-settings-body]") || s; mountSettings(inner); }
  }, 1500);
  EV.on("sub", repaint);
  if (D.body) apply(); else D.addEventListener("DOMContentLoaded", apply);
  EV.cursor = { open: open, apply: apply, pref: function () { return Object.assign({}, pref); }, active: active, supported: supported,
                mountSettings: function (c) { autoSettings = false; mountSettings(c); }, _fx: function () { return G; } };
})();
