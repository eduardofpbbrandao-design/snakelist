/* SnakeList events preview - the event countdown: a compact banner on the homepage (just above the tabs) and the
   full panel it opens (countdown, artwork, description, start time in the viewer's own time, early-access badge,
   and the way in to the Advent Calendar, subscription, seasonal achievements and cursor customization).
   It heats up in the last minute, slams the last 10 seconds and bursts at zero. */
(function () {
  "use strict";
  var EV = window.SL_EVENTS; if (!EV) return;
  var D = document, esc = EV.esc, ic = EV.art.icon;
  var SEC = 1000, MIN = 60 * SEC, HR = 60 * MIN, DAY = 24 * HR;

  function parts(ms) { ms = Math.max(0, ms); return { d: Math.floor(ms / DAY), h: Math.floor(ms % DAY / HR), m: Math.floor(ms % HR / MIN), s: Math.floor(ms % MIN / SEC) }; }
  function two(n) { return n < 10 ? "0" + n : "" + n; }

  // what the countdown is counting to right now, for this viewer
  EV.countdownState = function (now) {
    if (now == null) now = EV.time.display();
    var ev = EV.featured(now); if (!ev) return null;
    var sub = EV.isSubscriber(), ph = EV.phase(ev, now, sub), st = { ev: ev, phase: ph, now: now };
    if (ph === "upcoming") {
      var early = ev.earlyAccess && sub && now < EV.ms(ev.earlyAccess);
      st.target = early ? EV.ms(ev.earlyAccess) : EV.ms(ev.start);
      st.label = early ? "Your early access starts in" : "Starts in";
      st.done = early ? "You're in early!" : ev.short + " has begun!";
    } else if (ph === "early") {
      st.target = EV.ms(ev.start); st.label = "Early access · opens for everyone in"; st.done = ev.short + " is open for everyone!";
    } else {
      var a = ev.advent, nd = a ? EV.logic.today(ev, now) + 1 : 0;
      if (a && nd >= 2 && nd <= a.days) { st.target = EV.logic.unlockAt(ev, nd); st.label = "Door " + nd + " opens in"; st.done = "Door " + nd + " is open!"; st.door = nd - 1; }
      else { st.target = EV.ms(ev.end); st.label = "Ends in"; st.done = ev.short + " has ended"; }
    }
    st.left = st.target - now;
    return st;
  };

  /* ---------------- the homepage banner ---------------- */
  var B = null, lastKey = "";
  function bannerHtml(st) {
    var ev = st.ev, p = parts(st.left), live = st.phase === "live" || st.phase === "early";
    var kick = live ? (st.phase === "early" ? "Early access · subscribers" : "Live now") + (st.door ? " · door " + st.door + " open" : "")
      : (ev.earlyAccess ? "Coming soon · early access for subscribers" : "Coming soon");
    return '<span class="sl-ev-b-art">' + EV.art.event(ev.theme) + '</span>' +
      '<span class="sl-ev-b-txt"><small>' + esc(kick) + '</small><b>' + esc(ev.name) + '</b></span>' +
      '<span class="sl-ev-b-clock" aria-hidden="true">' + (p.d ? '<span><i data-u="d">' + p.d + '</i><em>days</em></span>' : "") +
      '<span><i data-u="h">' + two(p.h) + '</i><em>hrs</em></span><span><i data-u="m">' + two(p.m) + '</i><em>min</em></span><span><i data-u="s">' + two(p.s) + '</i><em>sec</em></span></span>' +
      '<span class="sl-ev-b-go">' + ic("arrow") + '</span>' + (live && st.door ? '<span class="sl-ev-b-badge"></span>' : "");
  }
  function banner() {
    var tabs = D.querySelector(".tabs"); if (!tabs) return;
    var st = EV.countdownState();
    if (!st) { if (B) { B.remove(); B = null; } return; }
    if (!B) {
      B = D.createElement("button"); B.type = "button"; B.id = "sl-ev-banner";
      B.addEventListener("click", function () { EV.openCountdown(); });
    }
    if (!B.isConnected) tabs.parentNode.insertBefore(B, tabs);
    B.className = "sl-ev-banner sl-ev-t-" + st.ev.theme + heat(st.left);
    var key = st.ev.id + "|" + st.phase + "|" + st.label + "|" + (parts(st.left).d ? 1 : 0);
    if (key !== lastKey) { var keep = B.querySelector(".sl-ev-burst"); B.innerHTML = bannerHtml(st); if (keep) B.appendChild(keep); lastKey = key; }
    else setDigits(B, st.left);
    B.setAttribute("aria-label", st.ev.name + ": " + st.label + " " + spoken(st.left) + ". Open the event countdown.");
    crossing(B, st, B);
  }
  function heat(left) { return left <= 10 * SEC && left > 0 ? " sl-ev-hot sl-ev-final" : left <= MIN && left > 0 ? " sl-ev-hot" : ""; }
  function spoken(ms) { var p = parts(ms); return (p.d ? p.d + " days " : "") + p.h + " hours " + p.m + " minutes " + p.s + " seconds"; }
  function setDigits(root, left) {
    var p = parts(left);
    root.querySelectorAll("[data-u]").forEach(function (el) {
      var u = el.getAttribute("data-u"), v = u === "d" ? String(p.d) : two(p[u]);
      if (el.textContent !== v) {
        el.textContent = v;
        var tile = el.closest(".sl-ev-tile"); if (tile && !EV.reducedMotion()) { tile.classList.remove("tick"); void tile.offsetWidth; tile.classList.add("tick"); }
      }
    });
  }
  // the moment it reaches zero (the state moves on to its next target): a burst
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
      h += '<i style="--c:' + ["#e6c35c", "#c8323f", "#fff", "#5fbf56", "#8fd3ff"][i % 5] + ";--x:" + Math.round(Math.cos(a) * r) + "px;--y:" + Math.round(Math.sin(a) * r) + "px;--r:" + Math.round(Math.random() * 720) + "deg;animation-delay:" + (Math.random() * .2).toFixed(2) + 's"></i>';
    }
    b.innerHTML = h; host.appendChild(b); host.classList.add("sl-ev-done");
    EV.emit("countdown-zero", text);
    setTimeout(function () { b.remove(); host.classList.remove("sl-ev-done"); }, 3600);
  }

  /* ---------------- the full panel ---------------- */
  var P = null, pKey = "";
  function heroHtml(st) {
    var ev = st.ev, p = parts(st.left), sub = EV.isSubscriber();
    var tiles = [["d", p.d, "days"], ["h", two(p.h), "hours"], ["m", two(p.m), "minutes"], ["s", two(p.s), "seconds"]].map(function (t) {
      return '<div class="sl-ev-tile"><b data-u="' + t[0] + '">' + t[1] + "</b><small>" + t[2] + "</small></div>";
    }).join("");
    var startLocal = EV.localTime(ev.start), early = ev.earlyAccess ? EV.localTime(ev.earlyAccess, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";
    return '<div class="sl-ev-hero">' + '<span class="sl-ev-hero-art">' + EV.art.event(ev.theme) + "</span>" +
      '<p class="sl-ev-kick">' + (st.phase === "live" ? '<span class="sl-ev-live">Live now</span>' : st.phase === "early" ? '<span class="sl-ev-live">Early access</span>' : "Event countdown") + "</p>" +
      "<h3>" + esc(ev.name) + "</h3><p>" + esc(ev.description) + "</p>" +
      (ev.earlyAccess && st.phase !== "live" ? '<span class="sl-ev-early">' + ic("crown", 14) + (sub && st.phase === "early" ? "You're in early" : "Early access for subscribers · " + esc(early)) + "</span>" : "") +
      '<p class="sl-ev-when" style="margin-bottom:6px!important"><b>' + esc(st.label) + "</b></p>" +
      '<div class="sl-ev-clock" role="timer" aria-live="off">' + tiles + "</div>" +
      '<p class="sl-ev-when">Starts <b>' + esc(startLocal) + "</b> (your time)<br><span style=\"opacity:.75\">Same moment everywhere: " + esc(new Date(EV.ms(ev.start)).toUTCString().replace(" GMT", " UTC")) + "</span></p></div>";
  }
  function panelHtml(st) {
    var h = st ? heroHtml(st) : '<p class="sl-ev-muted">No event is coming up right now.</p>';
    h += '<div class="sl-ev-row">' +
      '<button type="button" class="sl-ev-btn pri" data-go="advent">' + ic("door") + "Advent Calendar</button>" +
      '<button type="button" class="sl-ev-btn" data-go="subscribe">' + ic("crown") + "Subscriber benefits</button>" +
      '<button type="button" class="sl-ev-btn" data-go="ach">' + ic("star") + "Seasonal achievements</button>" +
      '<button type="button" class="sl-ev-btn" data-go="cursor">' + ic("cursor") + "Cursor customization</button></div>";
    var up = EV.upcoming().filter(function (e) { return !st || e.id !== st.ev.id; });
    if (up.length) h += '<h3 class="sl-ev-h3">Coming up</h3><ul class="sl-ev-list">' + up.map(function (e) {
      return '<li class="sl-ev-t-' + e.theme + '"><span>' + EV.art.event(e.theme) + "</span><span><b>" + esc(e.name) + "</b><small>" +
        esc(EV.localTime(e.start, { day: "numeric", month: "long", year: "numeric" })) + (e.earlyAccess ? " · early access for subscribers" : "") + (e.promo && e.promo.label ? " · " + esc(e.promo.label) : "") + "</small></span></li>";
    }).join("") + "</ul>";
    h += '<p class="sl-ev-muted" style="margin-top:10px" data-timecheck>' + timeLine() + "</p>";
    return h;
  }
  function timeLine() {
    if (EV.time.trusted()) return ic("check", 13) + " Time checked with the SnakeList server - changing your device clock changes nothing.";
    if (EV.time.failed()) return "Couldn't check the time with the server, so nothing can be unlocked until you're back online. (The countdown uses this device's clock.)";
    return "Checking the time with the server…";
  }
  EV.openCountdown = function () {
    var st = EV.countdownState();
    P = EV.panel("sl-ev-cd", "Events", panelHtml(st), { cls: st ? "sl-ev-t-" + st.ev.theme : "", onClose: function () { P = null; } });
    pKey = st ? st.ev.id + st.phase + st.label : "";
    P.addEventListener("click", function (e) {
      var g = e.target.closest("[data-go]"); if (!g) return;
      var w = g.getAttribute("data-go");
      if (w === "advent" && EV.advent) EV.advent.open();
      if (w === "subscribe" && EV.subscribe) EV.subscribe.open();
      if (w === "cursor" && EV.cursor) EV.cursor.open();
      if (w === "ach") { P.close(); if (window.SL_openAch) window.SL_openAch(); setTimeout(function () { var s = D.getElementById("sl-ev-ach"); if (s) s.scrollIntoView({ block: "start" }); }, 80); }
    });
    return P;
  };
  function panelTick() {
    if (!P || !P.isConnected) return;
    var st = EV.countdownState(); if (!st) return;
    var key = st.ev.id + st.phase + st.label, hero = P.querySelector(".sl-ev-hero");
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
