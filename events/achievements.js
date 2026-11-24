/* SnakeList events preview - seasonal, Cabin and anniversary achievements (definitions: config.js achievements).
   They are shown in the app's own Achievements panel: this file registers window.SL_ACH_EXTRA, which hands the panel
   every one of them in the panel's own shape (category, sub-group per event and year, rarity, icon, progress,
   status, dates, reward). Seasonal ones sit under "Seasonal Events" (Cabin ones under "Cabin & Decorations",
   anniversary ones under "SnakeList Anniversaries"); once an event is over they move to "Legacy & Limited Edition",
   where unearned ones say "No longer obtainable".
   Earned ones are kept for good (this browser + the account's eventProgress/{uid}/achievements, create-only).
   Fairness: doors recovered with SUBSCRIBER skips never count (see advent-logic stats: fairDoors, bestRun, door13);
   days covered by the free (streak) skips do. Nothing is earned from a time that isn't the server's.
   Christmas stays hidden from the public until config.js xmasPublic is true. */
(function () {
  "use strict";
  var EV = window.SL_EVENTS; if (!EV) return;
  var D = document, CFG = EV.cfg, esc = EV.esc, ic = EV.art.icon;
  // TEST mode keeps its own copy, so trying things out never earns a real achievement
  function KEY() { return EV.testMode() ? "sl-ev-ach:test" : "sl-ev-ach"; }
  var VIS = "sl-ev-visits";
  var earned = EV.ls.get(KEY(), {}) || {};
  EV.on("mode", function () { earned = EV.ls.get(KEY(), {}) || {}; paint(); });

  // Christmas (and its Cabin) only where the Christmas event is switched on for this viewer
  function shownEvent(id) { return !(EV.pub && !CFG.xmasPublic && id === "xmas2026") && !!EV.event(id); }
  function defs() { return CFG.achievements.filter(function (a) { return shownEvent(a.event); }); }
  function inWindow(ev, now) { return now != null && now >= EV.ms(ev.start) && now < EV.ms(ev.end); }
  function dayKey(t) { var d = new Date(t); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  // the numbers each achievement is measured against
  function stats() {
    var now = EV.time.now(), a = EV.advent ? EV.advent.stats() : { doors: 0, fairDoors: 0, onTime: 0, door13: 0, bestRun: 0 };
    var vis = EV.ls.get(VIS, {}) || {}, s = {};
    s.doors = a.fairDoors; s.fairDoors = a.fairDoors; s.onTime = a.onTime; s.door13 = a.door13; s.bestRun = a.bestRun;
    s.visit = {}; CFG.events.forEach(function (e) { s.visit[e.id] = vis[e.id] ? 1 : 0; });
    s.nyVisit = vis.newyear2027 ? 1 : 0; s.nyEve = vis.nyEve || vis.nyMidnight ? 1 : 0;
    s.nyDays = Object.keys(vis.nyDays || {}).length; s.annDays = Object.keys(vis.annDays || {}).length;
    s.cabinVisit = vis.cabin ? 1 : 0;
    // achievements of the app itself dated inside an event's window (New Year: Fresh Start; anniversary: Collector)
    var dates = EV.ls.get("sl-ach-dates", {}) || {};
    function achIn(id) { var ev = EV.event(id); if (!ev) return 0; var n0 = EV.ms(ev.start), n1 = EV.ms(ev.end); return Object.keys(dates).filter(function (k) { var t = Date.parse(dates[k]); return isFinite(t) && t >= n0 && t < n1; }).length; }
    s.nyAch = achIn("newyear2027") ? 1 : 0; s.annAch = achIn("anniversary2027");
    // the Cabin: what is unlocked (free rewards + the grand prize; subscriber extras don't count) and what is shown
    var inv = []; try { inv = EV.advent && EV.advent.inventory ? EV.advent.inventory() || [] : []; } catch (e) { inv = []; }
    var fair = inv.filter(function (x) { return x.owned && !x.premium && !x.bonus; });
    s.owned = fair.length; s.shown = inv.filter(function (x) { return x.owned && x.shown; }).length;
    s.glowShown = inv.some(function (x) { return x.id === "glow-scale" && x.owned && x.shown; }) ? 1 : 0;
    s.grandShown = inv.some(function (x) { return x.grand && x.owned && x.shown; }) ? 1 : 0;
    s.golden = fair.filter(function (x) { return /^(golden-egg|holly-king-orn|fang-bell)$/.test(x.id); }).length;
    // completionists: every other achievement of the same event (and category)
    function others(evId, cat) { return CFG.achievements.filter(function (x) { return x.event === evId && (x.cat || "seasonal") === cat && !/All$/.test(x.stat); }); }
    s.xmasAll = others("xmas2026", "seasonal").filter(function (x) { return earned[x.id] != null; }).length;
    s.nyAll = others("newyear2027", "seasonal").filter(function (x) { return earned[x.id] != null; }).length;
    s.annAll = others("anniversary2027", "anniv").filter(function (x) { return earned[x.id] != null; }).length;
    s.now = now;
    return s;
  }
  function value(a, s) { return a.stat === "visit" ? s.visit[a.event] || 0 : s[a.stat] || 0; }
  // remember visits, judged by the trusted clock only
  function noteVisit() {
    var now = EV.time.now(); if (now == null) return;
    var vis = EV.ls.get(VIS, {}) || {}, ch = false;
    CFG.events.forEach(function (e) { if (!vis[e.id] && inWindow(e, now)) { vis[e.id] = new Date(now).toISOString(); ch = true; } });
    var ny = EV.event("newyear2027"), an = EV.event("anniversary2027"), xm = EV.event("xmas2026");
    if (ny && inWindow(ny, now)) {
      var dk = dayKey(now); vis.nyDays = vis.nyDays || {}; if (!vis.nyDays[dk]) { vis.nyDays[dk] = 1; ch = true; }
      // New Year's Eve or New Year's Day in the viewer's own time zone (no need to be online at midnight)
      var d = new Date(now), eve = (d.getMonth() === 11 && d.getDate() === 31) || (d.getMonth() === 0 && d.getDate() === 1);
      if (eve && !vis.nyEve) { vis.nyEve = new Date(now).toISOString(); ch = true; }
    }
    if (an && inWindow(an, now)) { var ak = dayKey(now); vis.annDays = vis.annDays || {}; if (!vis.annDays[ak]) { vis.annDays[ak] = 1; ch = true; } }
    // Welcome Home: the Christmas Cabin on screen while the event is open
    var cab = D.getElementById("xm-cabin");
    if (!vis.cabin && cab && cab.offsetParent !== null && xm && now >= EV.ms(xm.earlyAccess || xm.start) && now < EV.ms(xm.end)) { vis.cabin = new Date(now).toISOString(); ch = true; }
    if (ch) EV.ls.set(VIS, vis);
  }
  function evaluate() {
    noteVisit();
    var fresh = [];
    for (var pass = 0; pass < 2; pass++) {   // twice, so a completionist can follow the ones it depends on
      var s = stats();
      defs().forEach(function (a) {
        if (earned[a.id]) return;
        var ev = EV.event(a.event);
        if (value(a, s) < a.goal) return;
        // nothing is earned from a time we can't trust, or before the event starts
        if (s.now == null) return;
        if (ev && s.now < EV.ms(ev.start)) return;
        earned[a.id] = new Date(s.now).toISOString(); fresh.push(a);
      });
    }
    if (fresh.length) {
      EV.ls.set(KEY(), earned);
      fresh.forEach(function (a, i) {
        var it = item(a, stats());
        if (window.SL_ACH && window.SL_ACH.celebrate && ["rare", "epic", "legendary", "mythic"].indexOf(it.rar) >= 0) window.SL_ACH.celebrate(it);
        // the others pop in as a toast (a golden pop for the Legendary Christmas Serpent)
        else setTimeout(function () { var t = EV.toast(ic(a.icon || "star", 15) + " Seasonal achievement unlocked: <b>" + esc(a.name) + "</b>"); t.classList.add("sl-ev-toast-ach"); if (a.legendary) t.classList.add("is-legend"); }, i * 900);
      });
      saveToAccount(fresh);
      EV.emit("seasonal-achievement", fresh.map(function (a) { return a.id; }));
    }
    paint();
    return fresh.map(function (a) { return a.id; });
  }
  function saveToAccount(list) {
    var u = EV.user(); if (!u || EV.testMode()) return;
    EV.db().then(function (db) {
      list.forEach(function (a) {
        var ref = db.collection("eventProgress").doc(u.uid).collection("achievements").doc(a.id);
        ref.get().then(function (d) { if (!d.exists) return ref.set({ id: a.id, event: a.event, at: EV.serverTimestamp() }); }).catch(function () {});
      });
    }).catch(function () {});
  }
  function loadFromAccount() {
    var u = EV.user(); if (!u || EV.testMode()) return;
    EV.db().then(function (db) { return db.collection("eventProgress").doc(u.uid).collection("achievements").get(); }).then(function (q) {
      var ch = false;
      q.forEach(function (d) { var x = d.data(); if (!earned[x.id]) { earned[x.id] = x.at && x.at.toDate ? x.at.toDate().toISOString() : ""; ch = true; } });
      if (ch) { EV.ls.set(KEY(), earned); paint(); }
    }).catch(function () {});
  }

  /* ---------------- for the Achievements panel ---------------- */
  function dateRange(ev) {
    var o = { day: "numeric", month: "short", year: "numeric" };
    return EV.localTime(ev.start, o) + " – " + EV.localTime(EV.ms(ev.end) - 1, o);
  }
  var SUB = { xmas2026: "Christmas 2026", newyear2027: "New Year 2026–2027", anniversary2027: "Anniversary 2027", halloween2027: "Halloween 2027", snakeday2027: "World Snake Day 2027" };
  var ORDER = ["xmas2026", "newyear2027", "anniversary2027", "halloween2027", "snakeday2027"];
  function item(a, s) {
    var ev = EV.event(a.event), now = s.now, got = earned[a.id] != null;
    var ended = now != null && now >= EV.ms(ev.end), before = now == null || now < EV.ms(ev.start), have = Math.min(value(a, s), a.goal);
    var cat = a.cat || "seasonal";
    if (ended && cat === "seasonal") cat = "legacy";
    return { id: a.id, cat: cat, sub: (SUB[a.event] || ev.short) + (cat === "legacy" ? " · Limited edition" : ""), event: a.event, eventStart: ev.start,
      dates: (got || ended ? "Could be earned " : "Can be earned ") + dateRange(ev), name: a.name, note: a.desc, rar: a.rar || "common", ic: a.icon,
      goal: a.goal, have: have, got: got ? earned[a.id] : null, limited: true,
      status: got ? "earned" : ended ? "gone" : before ? "coming" : have > 0 ? "progress" : "locked",
      reward: a.reward ? { text: a.reward + (a.cursor && EV.cursor && EV.cursor.nameOf && !/cursor/i.test(a.reward) ? " + " + EV.cursor.nameOf(a.cursor) : ""), cursor: a.cursor || null } : null,
      // Christmas round 3: Christmas cards get the forest-green reward box, the Legendary Christmas Serpent the gold
      // Legendary one with a LIMITED label (applied to the app's cards by dress() below)
      xmas: ev.theme === "xmas", legendary: !!a.legendary, limitedLabel: !!a.limited };
  }
  // the app draws the cards (.sla-card[data-ach]); the Christmas ones are dressed afterwards, every time it redraws
  function dress() {
    var dlg = D.getElementById("sl-achdlg"); if (!dlg || dlg.hidden) return;
    defs().forEach(function (a) {
      var ev = EV.event(a.event); if (!ev || ev.theme !== "xmas") return;
      [].forEach.call(dlg.querySelectorAll('.sla-card[data-ach="' + a.id + '"]'), function (c) {
        if (c._xmd) return; c._xmd = 1;
        var got = earned[a.id] != null;
        c.classList.add("sl-ev-rbox", got ? "is-done" : c.classList.contains("is-progress") ? "is-progress" : "is-locked");
        if (a.legendary) c.classList.add("sl-ev-legendary");
        var nm = c.querySelector(".sla-cname");
        if (a.limited && nm && !c.querySelector(".sl-ev-limited")) nm.insertAdjacentHTML("afterend", '<span class="sl-ev-limited" title="Once in a lifetime: it can only be earned during ' + esc(ev.short || ev.name) + '">Limited</span>');
      });
    });
  }
  // (watched only while the Achievements panel is open: its own list, not the whole page)
  var dressMO = null;
  function dressWatch() {
    var dlg = D.getElementById("sl-achdlg"), open = dlg && !dlg.hidden;
    if (open && !dressMO && "MutationObserver" in window) { dressMO = new MutationObserver(dress); dressMO.observe(dlg, { childList: true, subtree: true }); dress(); }
    if (!open && dressMO) { dressMO.disconnect(); dressMO = null; }
  }
  function items() {
    var s = stats();
    return defs().slice().sort(function (x, y) { return ORDER.indexOf(x.event) - ORDER.indexOf(y.event); }).map(function (a) { return item(a, s); });
  }
  window.SL_ACH_EXTRA = items;
  var lastSig = "";
  function paint() {
    var sig = JSON.stringify(earned) + "|" + (EV.time.now() == null ? 0 : 1);
    var dlg = D.getElementById("sl-achdlg"); if (!dlg || dlg.hidden) { lastSig = ""; return; }
    if (sig === lastSig) return; lastSig = sig;
    if (window.SL_ACH && window.SL_ACH.refresh) window.SL_ACH.refresh();
  }
  setInterval(function () { if (!D.hidden) { paint(); dressWatch(); } }, 600);
  setInterval(function () { if (!D.hidden) evaluate(); }, 30000);
  EV.on("advent-claim", function () { setTimeout(evaluate, 1600); });
  EV.on("advent", function () { lastSig = ""; paint(); });
  EV.on("time", function (t) { lastSig = ""; if (t != null) evaluate(); });
  EV.on("auth", loadFromAccount);
  D.addEventListener("sl-ach-earned", function () { setTimeout(evaluate, 300); });
  EV.seasonal = { evaluate: evaluate, earned: function () { return JSON.parse(JSON.stringify(earned)); }, stats: stats, paint: paint, items: items,
                  reset: function () { earned = {}; EV.ls.del(KEY()); EV.ls.del(VIS); paint(); } };
})();
