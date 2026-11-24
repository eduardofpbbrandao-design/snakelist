/* SnakeList events preview - shared core: window.SL_EVENTS (trusted time, events and phases, subscription
   status, account storage, panels). Loaded only by tools/events_loader.js when the "events" preview is on.

   Trusted time: the device clock is never trusted for anything that unlocks. The time comes from the web
   server's Date header (a HEAD request to this page) and then runs on performance.now(), so changing the
   device clock afterwards changes nothing. With no answer from the server, nothing unlocks.
   Subscription status: read ONLY from Firestore customers/{uid}/subscriptions (written by the Stripe
   extension; the rules let nobody else write there). The preview's TEST switch is local, clearly labelled,
   never touches the account and is ignored outside the preview. */
(function () {
  "use strict";
  if (window.SL_EVENTS) return;
  var CFG = window.SL_EVENTS_CONFIG, L = window.SL_ADVENT_LOGIC, D = document;
  var EV = window.SL_EVENTS = { cfg: CFG, logic: L, version: CFG.version };
  var RM = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  EV.reducedMotion = function () { return !!RM.matches; };

  /* ---------------- tiny helpers ---------------- */
  var esc = EV.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  EV.ls = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  var subs = {};
  EV.on = function (n, f) { (subs[n] = subs[n] || []).push(f); return function () { subs[n] = subs[n].filter(function (x) { return x !== f; }); }; };
  EV.emit = function (n, a) { (subs[n] || []).slice().forEach(function (f) { try { f(a); } catch (e) { console.error(e); } }); };
  EV.ms = function (x) { return typeof x === "number" ? x : Date.parse(x); };
  EV.event = function (id) { return CFG.events.filter(function (e) { return e.id === id; })[0] || null; };

  /* ---------------- trusted time ---------------- */
  var T = { base: null, perf: 0, at: 0, source: null, pending: null, failed: false };
  function probeUrl() { var u = CFG.timeProbe || location.href.split("#")[0]; return u + (u.indexOf("?") < 0 ? "?" : "&") + "sl-time=" + Math.random().toString(36).slice(2); }
  EV.time = {
    // trusted ms since 1970, or null when there is no trusted time yet
    now: function () { return T.base == null ? null : T.base + (performance.now() - T.perf); },
    trusted: function () { return T.base != null; },
    failed: function () { return T.failed && T.base == null; },
    source: function () { return T.source; },
    // for countdown digits only (never for unlocking): the trusted time, else the device clock
    display: function () { var n = EV.time.now(); return n == null ? Date.now() : n; },
    sync: function () {
      if (T.pending) return T.pending;
      var t0 = performance.now();
      T.pending = fetch(probeUrl(), { method: "HEAD", cache: "no-store", credentials: "same-origin" }).then(function (r) {
        var t1 = performance.now(), h = r.headers.get("Date"), d = h ? Date.parse(h) : NaN;
        if (!isFinite(d)) throw new Error("no Date header");
        // the header is whole seconds, stamped about halfway through the round trip
        T.base = d + 500 + (t1 - t0) / 2; T.perf = t1; T.source = "server"; T.failed = false; T.at = t1;
        EV.emit("time", EV.time.now());
        return EV.time.now();
      }).catch(function (e) { T.failed = true; EV.emit("time", null); return null; }).then(function (v) { T.pending = null; return v; });
      return T.pending;
    }
  };
  EV.time.sync();
  setInterval(function () { if (!D.hidden) EV.time.sync(); }, CFG.timeResync || 600000);
  D.addEventListener("visibilitychange", function () { if (!D.hidden) EV.time.sync(); });   // a sleeping device may pause performance.now()

  /* ---------------- events and phases ---------------- */
  // upcoming -> early (subscribers, from earlyAccess) -> live -> ended
  EV.phase = function (ev, now, subscriber) {
    if (typeof ev === "string") ev = EV.event(ev);
    if (!ev || now == null) return "unknown";
    var s = EV.ms(ev.start), e = EV.ms(ev.end), ea = ev.earlyAccess ? EV.ms(ev.earlyAccess) : null;
    if (now >= e) return "ended";
    if (now >= s) return "live";
    if (subscriber && ea != null && now >= ea) return "early";
    return "upcoming";
  };
  EV.isOpen = function (id) { var p = EV.phase(id, EV.time.now(), EV.isSubscriber()); return p === "live" || p === "early"; };
  // the event the homepage countdown is about: the soonest one (not a meta badge) that hasn't ended and whose countdown has begun
  EV.featured = function (now) {
    if (now == null) now = EV.time.display();
    var list = CFG.events.filter(function (e) { return !e.meta && now < EV.ms(e.end) && now >= EV.ms(e.countdownFrom || e.start) - 0; });
    list.sort(function (a, b) { return EV.ms(a.start) - EV.ms(b.start); });
    return list[0] || null;
  };
  EV.upcoming = function (now) {
    if (now == null) now = EV.time.display();
    return CFG.events.filter(function (e) { return !e.meta && now < EV.ms(e.end); }).sort(function (a, b) { return EV.ms(a.start) - EV.ms(b.start); });
  };
  // the viewer's own time zone, said in words next to a local time ("your local time, Europe/Lisbon")
  EV.tzName = function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; } };
  EV.tzNote = function () { var z = EV.tzName(); return "your local time" + (z ? ", " + z.replace(/_/g, " ") : ""); };
  EV.localTime = function (t, opts) {
    try { return new Date(EV.ms(t)).toLocaleString(undefined, opts || { weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }); }
    catch (e) { return new Date(EV.ms(t)).toString(); }
  };

  /* ---------------- account (Firebase, through the app's own SL_FB) ---------------- */
  var A = { uid: null, db: null, unsubSub: null };
  EV.user = function () { var u = window.SL_FB && window.SL_FB.user && window.SL_FB.user(); return u || null; };
  EV.db = function () { return window.SL_FB && window.SL_FB.load ? window.SL_FB.load() : Promise.reject(new Error("no accounts here")); };
  EV.serverTimestamp = function () { return window.firebase && firebase.firestore && firebase.firestore.FieldValue.serverTimestamp(); };
  function authTick() {
    var u = EV.user(), id = u ? u.uid : null;
    if (id === A.uid) return;
    A.uid = id; S.real = false; S.realEnd = null;
    if (A.unsubSub) { try { A.unsubSub(); } catch (e) {} A.unsubSub = null; }
    if (id) watchSubscription(id);
    EV.emit("auth", u); EV.emit("sub", EV.isSubscriber());
  }
  setInterval(authTick, 1500); setTimeout(authTick, 0);

  /* ---------------- subscription status ---------------- */
  var S = { real: false, realEnd: null };
  function watchSubscription(uid) {
    EV.db().then(function (db) {
      if (A.uid !== uid) return;
      var sc = CFG.subscription;
      A.unsubSub = db.collection(sc.customersCollection).doc(uid).collection("subscriptions").where("status", "in", sc.activeStatuses)
        .onSnapshot(function (q) {
          var now = EV.time.now(), act = false, end = null;
          q.forEach(function (d) {
            var x = d.data() || {}, pe = x.current_period_end && x.current_period_end.toMillis ? x.current_period_end.toMillis() : null;
            if (pe == null || now == null || pe > now) { act = true; end = pe; }
          });
          S.real = act; S.realEnd = end; EV.emit("sub", EV.isSubscriber());
        }, function () { S.real = false; EV.emit("sub", EV.isSubscriber()); });
    }).catch(function () {});
  }
  // the preview-only TEST switch: local to this browser, labelled everywhere, never written to the account
  EV.testMode = function () { return !!(window.SL_EV && window.SL_EV.on) && EV.ls.get("sl-ev-test-sub", 0) === 1; };
  EV.setTestMode = function (on) { if (on) EV.ls.set("sl-ev-test-sub", 1); else EV.ls.del("sl-ev-test-sub"); EV.emit("sub", EV.isSubscriber()); EV.emit("mode"); };
  EV.isSubscriber = function () { return S.real || EV.testMode(); };
  EV.subscription = function () { return { active: EV.isSubscriber(), real: S.real, test: EV.testMode(), periodEnd: S.realEnd }; };

  /* ---------------- panels (the same size and look as the Achievements panel) ---------------- */
  var open = [];
  EV.panel = function (id, title, html, opts) {
    opts = opts || {};
    var old = D.getElementById(id); if (old) old.remove();
    var dlg = D.createElement("div"); dlg.className = "sl-achdlg sl-ev-dlg " + (opts.cls || ""); dlg.id = id;
    dlg.innerHTML = '<div class="sl-achdlg-bg"></div><div class="sl-achbox sl-ev-box" role="dialog" aria-modal="true" aria-labelledby="' + id + '-t">' +
      '<div class="sl-ahead"><h2 id="' + id + '-t">' + title + '</h2><button type="button" class="sl-aclose" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg></button></div>' +
      '<div class="sl-ev-body">' + html + "</div></div>";
    D.body.appendChild(dlg);
    var last = D.activeElement;
    function close() { if (!dlg.isConnected) return; dlg.remove(); open = open.filter(function (x) { return x !== dlg; }); if (!open.length) D.documentElement.classList.remove("sl-achdlg-on"); if (opts.onClose) opts.onClose(); if (last && last.focus) try { last.focus({ preventScroll: true }); } catch (e) {} }
    dlg.querySelector(".sl-achdlg-bg").addEventListener("click", close);
    dlg.querySelector(".sl-aclose").addEventListener("click", close);
    dlg.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } });
    D.documentElement.classList.add("sl-achdlg-on"); open.push(dlg);
    try { dlg.querySelector(".sl-aclose").focus({ preventScroll: true }); } catch (e) {}
    dlg.close = close;
    return dlg;
  };
  EV.toast = function (html, ms) {
    var t = D.createElement("div"); t.className = "sl-ev-toast"; t.setAttribute("role", "status"); t.innerHTML = html;
    // several at once stack upwards instead of covering each other
    var up = 0; D.querySelectorAll(".sl-ev-toast:not(.out)").forEach(function (o) { up += o.offsetHeight + 8; });
    t.style.bottom = (22 + up) + "px";
    D.body.appendChild(t); setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove(); }, 400); }, ms || 4200);
    return t;
  };
  EV.testBadge = function () { return EV.testMode() ? '<span class="sl-ev-test">TEST MODE &mdash; not a real subscription</span>' : ""; };

  /* ---------------- art shared by the panels ---------------- */
  // the official SnakeList S (the page's own #mark-snake), placed in a box
  EV.mark = function (x, y, w, extra) { return '<svg x="' + x + '" y="' + y + '" width="' + w + '" height="' + (w * 0.93) + '" viewBox="-23.5 2 156 145.5"' + (extra || "") + '><use href="#mark-snake"></use></svg>'; };
  EV.hooks = {};   // other helpers (the Cabin) can register mount points here; see advent.js
})();
