/* SnakeList events preview - the event countdown: a compact banner on the homepage (just above the tabs) and the
   full panel it opens. The countdown says plainly what it counts to: the public opening, or (for a subscriber) their
   early access. The numbers are Outfit (self-hosted, events/fonts/), each digit in its own fixed cell, and only a
   digit that changes moves (a short slide, about 200 ms; an instant swap for "reduce motion") - nothing flashes,
   bounces or pulses. Once the event is open for the viewer, the timer gives way to an "Explore the Christmas event"
   button and the clock then counts on to Christmas, then to New Year (events/config.js: countdown.after).
   Times come from EV.time (the server's clock, see core.js) - the device clock is never trusted.
   PUBLIC mode (EV.pub, every visitor; config.js publicCountdown): the same banner and panel, but nothing about
   subscriptions, early access, Advent, achievements or cursor, a minimise button (remembered in this browser), and
   the "Explore" button only when the Christmas event is really switched on for everyone (EV.xmasOpener()); until
   then it says the event is coming today / soon. */
(function () {
  "use strict";
  var EV = window.SL_EVENTS; if (!EV) return;
  var D = document, esc = EV.esc, ic = EV.art.icon;
  var SEC = 1000, MIN = 60 * SEC, HR = 60 * MIN, DAY = 24 * HR, PUB = !!EV.pub;

  function parts(ms) { ms = Math.max(0, ms); return { d: Math.floor(ms / DAY), h: Math.floor(ms % DAY / HR), m: Math.floor(ms % HR / MIN), s: Math.floor(ms % MIN / SEC) }; }
  function two(n) { return n < 10 ? "0" + n : "" + n; }
  function cdc(ev) { return ev.countdown || {}; }

  /* what the countdown is about right now, for this viewer:
     kind "early-access" (a subscriber's early access is coming), "public" (the opening for everyone), or once open
     "open" (the clock counts on to the next of countdown.after, else to the end) */
  EV.countdownState = function (now) {
    if (now == null) now = EV.time.display();
    var ev = EV.featured(now); if (!ev) return null;
    var sub = EV.isSubscriber(), ph = EV.phase(ev, now, sub), st = { ev: ev, phase: ph, now: now, open: ph === "live" || ph === "early" };
    var ea = ev.earlyAccess ? EV.ms(ev.earlyAccess) : null;
    if (ph === "upcoming") {
      var early = ea != null && sub && now < ea;
      st.kind = early ? "early-access" : "public";
      st.target = early ? ea : EV.ms(ev.start);
      st.label = early ? "Your subscriber early access opens in" : PUB ? "Opens in" : "Public opening in";
      st.done = early ? "You're in early!" : ev.short + " has begun!";
      if (PUB && !EV.xmasOpener()) st.done = cdc(ev).publicZero || st.done;
    } else if (ph === "early") {
      st.kind = "open"; st.target = EV.ms(ev.start); st.label = "Opens for everyone in"; st.done = ev.short + " is open for everyone!";
    } else {
      st.kind = "open";
      var next = (cdc(ev).after || []).filter(function (a) { return EV.ms(a.at) > now; })[0];
      if (next) { st.target = EV.ms(next.at); st.label = next.label; st.done = next.label.replace(/^Time until /, "") + "!"; }
      else { st.target = EV.ms(ev.end); st.label = "Ends in"; st.done = ev.short + " has ended"; }
      var a = ev.advent && EV.logic && (!PUB || EV.xmasOpener()) ? ev.advent : null, nd = a ? EV.logic.today(ev, now) + 1 : 0;
      if (a && nd >= 2 && nd <= a.days + 1) st.door = nd - 1;     // doors open so far
    }
    st.left = st.target - now;
    // once open: what the button opens (null = nothing can yet, so no button - see EV.xmasOpener in core.js)
    st.go = st.open ? EV.xmasOpener() : null;
    return st;
  };

  /* the early-access line, worded from the configured dates so it can never promise more than they give */
  function earlyLine(ev) {
    if (!ev.earlyAccess || PUB) return "";
    var days = Math.round((EV.ms(ev.start) - EV.ms(ev.earlyAccess)) / DAY);
    var from = EV.localTime(ev.earlyAccess, { day: "numeric", month: "long" });
    return days >= 10 ? "Subscribers get early access 10 or more days before · from " + from
      : "Early access for subscribers · " + days + " day" + (days === 1 ? "" : "s") + " before, from " + from;
  }
  function tzName() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; } }

  /* ---------------- the clock: four groups, each digit in its own cell ---------------- */
  var UNITS = [["d", "Days"], ["h", "Hours"], ["m", "Minutes"], ["s", "Seconds"]];
  function vals(ms) { var p = parts(ms); return { d: String(p.d), h: two(p.h), m: two(p.m), s: two(p.s) }; }
  function clockHtml(ms, cls) {
    var v = vals(ms);
    return '<div class="sl-ev-clock ' + (cls || "") + '" role="timer" aria-live="off">' + UNITS.map(function (u) {
      return '<div class="sl-ev-g" data-u="' + u[0] + '"><div class="sl-ev-num">' + v[u[0]].split("").map(function (c) {
        return '<span class="sl-ev-dg" data-v="' + c + '"><i>' + c + "</i></span>"; }).join("") + "</div><small>" + u[1] + "</small></div>";
    }).join("") + "</div>";
  }
  // only the digits that change move: the old one slides up and out, the new one slides in from below
  function setDigits(root, left) {
    var v = vals(left), rm = EV.reducedMotion();
    root.querySelectorAll(".sl-ev-g[data-u]").forEach(function (g) {
      var s = v[g.getAttribute("data-u")], cells = g.querySelectorAll(".sl-ev-dg");
      if (cells.length !== s.length) {   // a digit more or fewer (100 days -> 99): redraw this group
        g.querySelector(".sl-ev-num").innerHTML = s.split("").map(function (c) { return '<span class="sl-ev-dg" data-v="' + c + '"><i>' + c + "</i></span>"; }).join("");
        return;
      }
      for (var k = 0; k < s.length; k++) {
        var cell = cells[k], c = s.charAt(k);
        if (cell.getAttribute("data-v") === c) continue;
        cell.setAttribute("data-v", c);
        if (rm) { cell.innerHTML = "<i>" + c + "</i>"; continue; }
        [].forEach.call(cell.querySelectorAll("i.out"), function (o) { o.remove(); });
        var old = cell.querySelector("i"); if (old) { old.className = "out"; setTimeout(function (o) { o.remove(); }.bind(null, old), 240); }
        var n = D.createElement("i"); n.className = "in"; n.textContent = c; cell.appendChild(n);
      }
    });
  }
  function spoken(ms) { var p = parts(ms); return (p.d ? p.d + " days " : "") + p.h + " hours " + p.m + " minutes " + p.s + " seconds"; }
  function heat(left) { return left <= 10 * SEC && left > 0 ? " sl-ev-hot sl-ev-final" : left <= MIN && left > 0 ? " sl-ev-hot" : ""; }

  /* ---------------- the Christmas frame: pine branches with warm fairy lights round the outside, sparse snow ---------------- */
  var frameSvg = null;
  function branch(flip) {
    var r = 7, rnd = function () { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    var stem = "M-4 18C40 22 90 14 150 2", needles = { "#123d2a": "", "#1d5c3c": "", "#2a7a4e": "" }, keys = Object.keys(needles);
    for (var t = 0; t <= 1.0001; t += .018) {
      var x = -4 + 154 * t, y = 18 - 16 * t * t + 6 * Math.sin(t * 3), len = 15 - 9 * t;
      for (var k = 0; k < 2; k++) {
        var a = (k ? 1 : -1) * (.75 + rnd() * .5) + (-.35), col = keys[Math.floor(rnd() * 3)];
        needles[col] += "M" + x.toFixed(1) + " " + y.toFixed(1) + "l" + (Math.cos(a) * len * .55 + 3).toFixed(1) + " " + (Math.sin(a) * len).toFixed(1);
      }
    }
    var g = '<path d="' + stem + '" stroke="#4a3220" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      keys.map(function (c) { return '<path d="' + needles[c] + '" stroke="' + c + '" stroke-width="2.1" stroke-linecap="round" fill="none"/>'; }).join("");
    // a string of warm fairy lights draped along it
    var lights = '<path d="M4 26Q40 44 78 30T150 14" stroke="#2b2a1e" stroke-width="1" fill="none" opacity=".7"/>';
    [[14, 31], [40, 38], [64, 35], [92, 27], [118, 22], [142, 16]].forEach(function (p) {
      lights += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="7" fill="url(#sl-ev-glow)"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.1" fill="#fff3cf"/>';
    });
    return '<g' + (flip ? ' transform="translate(1000 0) scale(-1 1)"' : "") + ">" + g + lights + "</g>";
  }
  function frame() {
    if (!frameSvg) frameSvg = [false, true].map(function (f) {
      return '<svg class="sl-ev-pine' + (f ? " r" : "") + '" viewBox="0 0 160 52" aria-hidden="true">' + (f ? "" : '<defs><radialGradient id="sl-ev-glow">' +
        '<stop offset="0" stop-color="#ffe6a6" stop-opacity=".95"/><stop offset=".4" stop-color="#ffd27a" stop-opacity=".35"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>') +
        branch(false) + "</svg>"; }).join("");
    var flakes = "", r = 3;
    for (var i = 0; i < 14; i++) { r = (r * 9301 + 49297) % 233280; var q = r / 233280;
      flakes += '<i style="left:' + (4 + q * 92).toFixed(1) + "%;animation-duration:" + (11 + (i % 5) * 2.3).toFixed(1) + "s;animation-delay:-" + (q * 14).toFixed(1) + "s;--z:" + (.5 + (i % 3) * .25) + '"></i>'; }
    return '<div class="sl-ev-fx" aria-hidden="true">' + frameSvg + '<div class="sl-ev-flakes">' + flakes + "</div></div>";
  }

  /* ---------------- the homepage banner ---------------- */
  var B = null, lastKey = "";
  // public mode, open but the Christmas event isn't switched on for everyone yet: "coming today" (its first day) / "soon"
  function comingText(st) { var c = cdc(st.ev); return st.now < EV.ms(st.ev.start) + DAY ? (c.publicToday || "Coming today") : (c.publicSoon || "Coming soon"); }
  function tagText(st) {
    if (PUB) return !st.open ? (cdc(st.ev).publicTag || "Coming soon") : st.go ? "Live now" + (st.door ? " · door " + st.door + " open" : "") : st.now < EV.ms(st.ev.start) + DAY ? "Coming today" : "Coming soon";
    if (st.phase === "early") return "Subscriber early access · open now";
    if (st.phase === "live") return "Live now" + (st.door ? " · door " + st.door + " open" : "");
    return st.kind === "early-access" ? "Subscriber early access" : "Public opening";
  }
  function bannerHtml(st) {
    var ev = st.ev, c = cdc(ev);
    var sub = st.open ? (PUB && !st.go ? comingText(st) : (c.openButton || "Explore the event")) : (c.comes || EV.localTime(ev.start, { day: "numeric", month: "long" }));
    return '<span class="sl-ev-b-art">' + EV.art.event(ev.theme) + "</span>" +
      '<span class="sl-ev-b-txt"><small>' + esc(tagText(st)) + "</small><b>" + esc(ev.name) + "</b><em>" + esc(sub) + "</em></span>" +
      '<span class="sl-ev-b-right"><span class="sl-ev-b-lab">' + esc(st.label) + "</span>" + clockHtml(st.left, "sl-ev-mini") + "</span>" +
      '<span class="sl-ev-b-go">' + ic("arrow") + "</span>" + (st.phase === "live" && st.door ? '<span class="sl-ev-b-badge"></span>' : "");
  }
  function banner() {
    var tabs = D.querySelector(".tabs"); if (!tabs) return;
    var st = EV.countdownState();
    if (!st) { if (B) { B.remove(); B = null; } if (W) { W.remove(); W = null; } return; }
    if (!B) {
      B = D.createElement("button"); B.type = "button"; B.id = "sl-ev-banner";
      B.addEventListener("click", function () { EV.openCountdown(); });
    }
    if (PUB) { if (pubWrap(tabs, st)) return; }
    else if (!B.isConnected) tabs.parentNode.insertBefore(B, tabs);
    B.className = "sl-ev-banner sl-ev-t-" + st.ev.theme + (st.open ? " sl-ev-is-open" : "") + heat(st.left);
    var key = st.ev.id + "|" + st.phase + "|" + st.kind + "|" + st.label + "|" + st.door + "|" + !!st.go + "|" + (st.open && PUB && !st.go ? comingText(st) : "");
    if (key !== lastKey) { var keep = B.querySelector(".sl-ev-burst"); B.innerHTML = bannerHtml(st); if (keep) B.appendChild(keep); lastKey = key; }
    else setDigits(B, st.left);
    B.setAttribute("aria-label", st.ev.name + ": " + st.label + " " + spoken(st.left) + ". Open the event countdown.");
    crossing(B, st, B);
  }
  /* public mode: the banner sits in a wrapper with a small minimise button; minimised, it is a slim pill instead
     (remembered in this browser, per event: localStorage sl-ev-cd-min = the event's id) */
  var W = null, PILL = null, MINK = "sl-ev-cd-min";
  function isMin(st) { return EV.ls.get(MINK, null) === st.ev.id; }
  function setMin(st, on) {
    if (on) EV.ls.set(MINK, st.ev.id); else EV.ls.del(MINK);
    lastKey = ""; pillTxt = ""; banner();
    try { (on ? PILL : B).focus({ preventScroll: true }); } catch (e) {}
  }
  function compact(ms) { var p = parts(ms); return (p.d ? p.d + "d " : "") + two(p.h) + "h " + two(p.m) + "m"; }
  var pillTxt = "";
  // returns true when minimised (the banner itself needn't be drawn)
  function pubWrap(tabs, st) {
    if (!W) {
      W = D.createElement("div"); W.id = "sl-ev-pub"; W.className = "sl-ev-pubwrap";
      var mn = D.createElement("button"); mn.type = "button"; mn.className = "sl-ev-min";
      mn.setAttribute("aria-label", "Minimise the countdown"); mn.title = "Minimise";
      mn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12"/></svg>';
      mn.addEventListener("click", function () { var s2 = EV.countdownState(); if (s2) setMin(s2, true); });
      PILL = D.createElement("button"); PILL.type = "button"; PILL.className = "sl-ev-pill"; PILL.id = "sl-ev-pill";
      PILL.addEventListener("click", function () { var s2 = EV.countdownState(); if (s2) setMin(s2, false); });
      W.appendChild(B); W.appendChild(mn); W.appendChild(PILL);
    }
    if (!W.isConnected || W.nextElementSibling !== tabs) tabs.parentNode.insertBefore(W, tabs);
    var min = isMin(st);
    W.className = "sl-ev-pubwrap sl-ev-t-" + st.ev.theme + (min ? " is-min" : "");
    B.hidden = min; PILL.hidden = !min; W.querySelector(".sl-ev-min").hidden = min;
    if (!min) return false;
    var t = st.ev.short + " · " + (st.open && !st.go ? (st.now < EV.ms(st.ev.start) + DAY ? "coming today" : "coming soon") : compact(st.left));
    if (t !== pillTxt) {
      pillTxt = t;
      PILL.innerHTML = '<span class="sl-ev-pill-art">' + EV.art.event(st.ev.theme) + "</span><span>" + esc(t) + "</span>" + ic("arrow", 14);
      PILL.setAttribute("aria-label", st.ev.name + ": " + (st.open && !st.go ? comingText(st) : st.label + " " + spoken(st.left)) + ". Show the countdown again.");
    }
    return true;
  }
  // the moment it reaches zero (the state moves on to its next target): a burst, once
  function crossing(el, st, host) {
    var pt = el._evTarget, pd = el._evDone;
    el._evTarget = st.target; el._evDone = st.done;
    if (pt != null && pt !== st.target && st.now >= pt && st.now - pt < 5000) burst(host, pd);
  }
  function burst(host, text) {
    if (!host || !host.isConnected) return;
    host.style.position = host.style.position || "relative";
    var b = D.createElement("div"); b.className = "sl-ev-burst"; b.setAttribute("role", "status");
    var h = '<span class="ring"></span><span class="ring" style="animation-delay:.2s"></span><span class="sl-ev-boom">' + esc(text) + "</span>";
    if (!EV.reducedMotion()) for (var i = 0; i < 36; i++) {
      var a = Math.random() * Math.PI * 2, r = 80 + Math.random() * 160;
      h += '<i style="--c:' + ["#E4C57A", "#B63848", "#FFF8ED", "#5fbf56", "#E4C57A"][i % 5] + ";--x:" + Math.round(Math.cos(a) * r) + "px;--y:" + Math.round(Math.sin(a) * r) + "px;--r:" + Math.round(Math.random() * 720) + "deg;animation-delay:" + (Math.random() * .2).toFixed(2) + 's"></i>';
    }
    b.innerHTML = h; host.appendChild(b); host.classList.add("sl-ev-done");
    EV.emit("countdown-zero", text);
    setTimeout(function () { b.remove(); host.classList.remove("sl-ev-done"); }, 3600);
  }

  /* ---------------- the full panel ---------------- */
  var P = null, pKey = "";
  function heroHtml(st) {
    var ev = st.ev, c = cdc(ev), sub = EV.isSubscriber(), el = earlyLine(ev), tz = tzName();
    var opens = st.kind === "early-access" ? ev.earlyAccess : ev.start;
    var whenLab = st.kind === "early-access" ? "Your early access opens" : PUB ? "Starts" : "Opens for everyone";
    var tag = '<p class="sl-ev-tag' + (st.open ? " is-live" : "") + '">' + esc(tagText(st)) + "</p>";
    var body = st.open && PUB && !st.go
      ? '<p class="sl-ev-comes sl-ev-soon">' + esc(comingText(st)) + "</p>" +
        '<p class="sl-ev-for">' + esc(st.label) + "</p>" + clockHtml(st.left, "sl-ev-after")
      : st.open
      ? '<button type="button" class="sl-ev-cta" data-go="advent">' + esc(c.openButton || "Explore the event") + ic("arrow", 18) + "</button>" +
        '<p class="sl-ev-for">' + esc(st.label) + "</p>" + clockHtml(st.left, "sl-ev-after")
      : (c.comes ? '<p class="sl-ev-comes">' + esc(c.comes) + "</p>" : "") +
        '<p class="sl-ev-for">' + esc(st.label) + "</p>" + clockHtml(st.left);
    return '<div class="sl-ev-hero sl-ev-hx sl-ev-t-' + ev.theme + '">' + (ev.theme === "xmas" ? frame() : "") +
      '<div class="sl-ev-hx-in">' +
      '<span class="sl-ev-hero-art">' + EV.art.event(ev.theme) + "</span>" + tag +
      "<h3>" + esc(ev.name) + "</h3>" + (!PUB && st.phase === "early" && sub ? EV.earlyNoteHtml(ev) : "") + body +
      '<p class="sl-ev-when">' + esc(whenLab) + " <b>" + esc(EV.localTime(opens, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })) + "</b>" +
      (tz ? '<span class="sl-ev-tz">Your time zone: ' + esc(tz) + "</span>" : "") +
      '<span class="sl-ev-utc">Same moment everywhere: ' + esc(new Date(EV.ms(opens)).toUTCString().replace(" GMT", " UTC")) + "</span></p>" +
      (el && !(sub && st.open) ? '<p class="sl-ev-early">' + ic("crown", 14) + esc(el) + "</p>" : "") +
      '<p class="sl-ev-desc">' + esc(PUB && ev.publicDescription && !st.go ? ev.publicDescription : ev.description) + "</p></div></div>";
  }
  function panelHtml(st) {
    var h = st ? heroHtml(st) : '<p class="sl-ev-muted">No event is coming up right now.</p>';
    if (!PUB) h += '<div class="sl-ev-row">' +
      '<button type="button" class="sl-ev-btn pri" data-go="advent">' + ic("door") + "Advent Calendar</button>" +
      '<button type="button" class="sl-ev-btn" data-go="subscribe">' + ic("crown") + "Subscriber benefits</button>" +
      '<button type="button" class="sl-ev-btn" data-go="ach">' + ic("star") + "Seasonal achievements</button>" +
      '<button type="button" class="sl-ev-btn" data-go="cursor">' + ic("cursor") + "Cursor customization</button></div>";
    var up = EV.upcoming().filter(function (e) { return !st || e.id !== st.ev.id; });
    if (up.length) h += '<h3 class="sl-ev-h3">Coming up</h3><ul class="sl-ev-list">' + up.map(function (e) {
      return '<li class="sl-ev-t-' + e.theme + '"><span>' + EV.art.event(e.theme) + "</span><span><b>" + esc(e.name) + "</b><small>" +
        esc(EV.localTime(e.start, { day: "numeric", month: "long", year: "numeric" })) + (!PUB && e.earlyAccess ? " · early access for subscribers" : "") + (!PUB && e.promo && e.promo.label ? " · " + esc(e.promo.label) : "") + "</small></span></li>";
    }).join("") + "</ul>";
    h += '<p class="sl-ev-muted" style="margin-top:10px" data-timecheck>' + timeLine() + "</p>";
    return h;
  }
  function timeLine() {
    if (EV.time.trusted()) return ic("check", 13) + " Time checked with the SnakeList server - changing your device clock changes nothing.";
    if (EV.time.failed()) return "Couldn't check the time with the server, so nothing can be unlocked until you're back online. (The countdown uses this device's clock.)";
    return "Checking the time with the server…";
  }
  function pkey(st) { return st ? st.ev.id + st.phase + st.kind + st.label + !!st.go + (st.open && PUB && !st.go ? comingText(st) : "") : ""; }
  EV.openCountdown = function () {
    var st = EV.countdownState();
    P = EV.panel("sl-ev-cd", "Events", panelHtml(st), { cls: st ? "sl-ev-t-" + st.ev.theme : "", onClose: function () { P = null; } });
    pKey = pkey(st);
    P.addEventListener("click", function (e) {
      var g = e.target.closest("[data-go]"); if (!g) return;
      var w = g.getAttribute("data-go");
      if (w === "advent") { var go = EV.xmasOpener(); if (go) go(); }
      if (w === "subscribe" && EV.subscribe) EV.subscribe.open();
      if (w === "cursor" && EV.cursor) EV.cursor.open();
      if (w === "ach") { P.close(); if (window.SL_openAch) window.SL_openAch(); setTimeout(function () { var s = D.getElementById("sl-ev-ach"); if (s) s.scrollIntoView({ block: "start" }); }, 80); }
    });
    return P;
  };
  function panelTick() {
    if (!P || !P.isConnected) return;
    var st = EV.countdownState(); if (!st) return;
    var key = pkey(st), hero = P.querySelector(".sl-ev-hero");
    var box = P.querySelector(".sl-ev-box"); box.className = "sl-achbox sl-ev-box" + heat(st.left);
    if (key !== pKey && hero) {
      var fresh = D.createElement("div"); fresh.innerHTML = heroHtml(st); fresh = fresh.firstChild;
      fresh._evTarget = hero._evTarget; fresh._evDone = hero._evDone;
      hero.replaceWith(fresh); hero = fresh; pKey = key;
      [].slice.call(P.classList).forEach(function (c) { if (/^sl-ev-t-/.test(c)) P.classList.remove(c); });
      P.classList.add("sl-ev-t-" + st.ev.theme);
    } else if (hero) setDigits(hero, st.left);
    if (hero) crossing(hero, st, hero);
    var tl = P.querySelector("[data-timecheck]"); if (tl) { var t = timeLine(); if (tl._t !== t) { tl.innerHTML = t; tl._t = t; } }
  }

  /* ---------------- ticking ---------------- */
  function tick() { if (D.hidden) return; try { banner(); panelTick(); } catch (e) { console.error(e); } }
  setInterval(tick, 250);
  EV.on("sub", function () { lastKey = ""; pKey = "~"; tick(); });
  EV.on("time", function () { lastKey = ""; tick(); });
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", tick); else tick();
})();
