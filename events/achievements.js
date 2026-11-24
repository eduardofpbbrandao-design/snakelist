/* SnakeList events preview - seasonal achievements, shown in the app's own Achievements panel (a "Seasonal events"
   part under the usual groups), grouped by event, with icon, description, reward, dates, progress and status.
   Earned ones are kept for good (this browser + the account's eventProgress/{uid}/achievements, create-only),
   so they stay after the event; unearned ones of a finished event are marked "No longer obtainable".
   Fairness: doors recovered with SUBSCRIBER skips never count (see advent-logic stats: fairDoors, bestRun, door13). */
(function () {
  "use strict";
  var EV = window.SL_EVENTS; if (!EV) return;
  var D = document, CFG = EV.cfg, esc = EV.esc, ic = EV.art.icon;
  // TEST mode keeps its own copy, so trying things out never earns a real achievement
  function KEY() { return EV.testMode() ? "sl-ev-ach:test" : "sl-ev-ach"; }
  var VIS = "sl-ev-visits";
  var earned = EV.ls.get(KEY(), {}) || {};
  EV.on("mode", function () { earned = EV.ls.get(KEY(), {}) || {}; paint(); });

  function inWindow(ev, now) { return now != null && now >= EV.ms(ev.start) && now < EV.ms(ev.end); }
  // the numbers each achievement is measured against
  function stats() {
    var now = EV.time.now(), a = EV.advent ? EV.advent.stats() : { doors: 0, fairDoors: 0, onTime: 0, door13: 0, bestRun: 0 };
    var vis = EV.ls.get(VIS, {}) || {}, ny = EV.event("newyear2027"), s = {};
    s.doors = a.fairDoors; s.fairDoors = a.fairDoors; s.onTime = a.onTime; s.door13 = a.door13; s.bestRun = a.bestRun;
    s.visit = {}; CFG.events.forEach(function (e) { s.visit[e.id] = vis[e.id] ? 1 : 0; });
    s.nyVisit = vis.newyear2027 ? 1 : 0; s.nyMidnight = vis.nyMidnight ? 1 : 0;
    // New Beginnings: any regular SnakeList achievement dated inside New Year week
    var dates = EV.ls.get("sl-ach-dates", {}) || {}, n0 = EV.ms(ny.start), n1 = EV.ms(ny.end);
    s.nyAch = Object.keys(dates).some(function (k) { var t = Date.parse(dates[k]); return isFinite(t) && t >= n0 && t < n1; }) ? 1 : 0;
    s.now = now;
    return s;
  }
  function value(a, s) { return a.stat === "visit" ? s.visit[a.event] || 0 : s[a.stat] || 0; }
  // remember visits, judged by the trusted clock only
  function noteVisit() {
    var now = EV.time.now(); if (now == null) return;
    var vis = EV.ls.get(VIS, {}) || {}, ch = false;
    CFG.events.forEach(function (e) { if (!vis[e.id] && inWindow(e, now)) { vis[e.id] = new Date(now).toISOString(); ch = true; } });
    var ny = EV.event("newyear2027");
    // within 30 minutes of midnight on New Year's Eve, in the viewer's own time zone
    var localMid = new Date(2027, 0, 1, 0, 0, 0).getTime();
    if (!vis.nyMidnight && Math.abs(now - localMid) <= 30 * 60000 && inWindow(ny, now)) { vis.nyMidnight = new Date(now).toISOString(); ch = true; }
    if (ch) EV.ls.set(VIS, vis);
  }
  function evaluate() {
    noteVisit();
    var s = stats(), fresh = [];
    CFG.achievements.forEach(function (a) {
      if (earned[a.id]) return;
      var ev = EV.event(a.event);
      if (value(a, s) < a.goal) return;
      // nothing is earned from a time we can't trust
      if (s.now == null) return;
      if (ev && s.now < EV.ms(ev.start)) return;
      earned[a.id] = new Date(s.now).toISOString(); fresh.push(a);
    });
    if (fresh.length) {
      EV.ls.set(KEY(), earned);
      // each unlock pops in (a bigger, golden pop for the Legendary one)
      fresh.forEach(function (a, i) { setTimeout(function () { var t = EV.toast(ic(a.icon || "star", 15) + " Seasonal achievement unlocked: <b>" + esc(a.name) + "</b>"); t.classList.add("sl-ev-toast-ach"); if (a.legendary) t.classList.add("is-legend"); }, i * 900); });
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

  /* ---------------- in the Achievements panel ---------------- */
  function dateRange(ev) {
    var o = { day: "numeric", month: "short", year: "numeric" };
    return EV.localTime(ev.start, o) + " – " + EV.localTime(EV.ms(ev.end) - 1, o);
  }
  function row(a, s) {
    var ev = EV.event(a.event), now = s.now, got = earned[a.id] != null;
    var ended = now != null && now >= EV.ms(ev.end), before = now == null || now < EV.ms(ev.start);
    var cls = got ? "is-earned" : ended ? "is-locked is-gone" : "is-locked", have = Math.min(value(a, s), a.goal);
    var chip = got ? "Earned" : ended ? "No longer obtainable" : before ? "Coming" : "Locked";
    var when = got ? (earned[a.id] ? "Earned " + new Date(earned[a.id]).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "Earned")
      : ended ? "Could be earned " + dateRange(ev) : "Can be earned " + dateRange(ev);
    // Christmas rows use the forest-green reward box; only the Legendary Christmas Serpent gets the gold Legendary one
    var xm = ev.theme === "xmas", box = xm ? " sl-ev-rbox" + (a.legendary ? " sl-ev-legendary" : "") + (got ? " is-done" : have > 0 && !ended ? " is-progress" : " is-locked") : "";
    var art = a.legendary ? '<span class="sl-aic sl-ev-aic sl-ev-aic-art" aria-hidden="true">' + EV.art.serpent(got ? "" : "dim") + "</span>"
      : '<span class="sl-aic sl-ev-aic" aria-hidden="true">' + ic(got ? a.icon : ended ? "lock" : a.icon, 17) + (xm && got ? '<i class="sl-ev-done-mark">' + ic("check", 10) + "</i>" : "") + "</span>";
    return '<li class="sl-abadge ' + cls + box + '" data-ach="' + a.id + '"><div class="sl-abtn" style="cursor:default">' + art +
      '<span class="sl-at">' + esc(a.name) + (a.limited ? ' <span class="sl-ev-limited" title="Once in a lifetime: it can only be earned during ' + esc(ev.short || ev.name) + '">Limited</span>' : "") +
      '<small class="sl-asub" style="display:block;font-weight:500">' + esc(a.desc) + "</small></span>" +
      '<span class="sl-ast">' + chip + "</span></div>" +
      '<div class="sl-adet">' + (got || ended ? "" : '<span class="sl-abar" role="progressbar" aria-valuemin="0" aria-valuemax="' + a.goal + '" aria-valuenow="' + have + '"><i style="width:' + Math.round(have / a.goal * 100) + '%"></i></span><p class="sl-aprog">' + have + " / " + a.goal + "</p>") +
      '<p class="sl-ev-areward">Reward: ' + esc(a.reward) + " · " + esc(when) + "</p></div></li>";
  }
  function sectionHtml() {
    var s = stats(), groups = [];
    CFG.events.forEach(function (e) { var l = CFG.achievements.filter(function (a) { return a.event === e.id; }); if (l.length) groups.push([e, l]); });
    var nAll = CFG.achievements.length, nWon = CFG.achievements.filter(function (a) { return earned[a.id] != null; }).length;
    return '<h3 class="sl-ev-ach-h">' + ic("star", 18) + "Seasonal events <span class=\"sl-ev-muted\" style=\"margin-left:auto;font-family:Inter,sans-serif;font-size:12px\">" + nWon + " / " + nAll + "</span></h3>" +
      (s.now == null ? '<p class="sl-ev-muted">Checking the time with the server…</p>' : "") +
      groups.map(function (g) {
        var e = g[0], l = g[1], w = l.filter(function (a) { return earned[a.id] != null; }).length;
        return '<section class="sl-agrp sl-ev-agrp" data-event="' + e.id + '"><h3>' + esc(e.name) + "<span>" + w + " / " + l.length + "</span></h3>" +
          '<p class="sl-ev-muted" style="margin:-4px 0 6px">' + esc(dateRange(e)) + '</p><ul class="sl-alist">' + l.map(function (a) { return row(a, s); }).join("") + "</ul></section>";
      }).join("") + '<p class="sl-ev-muted">Seasonal achievements are the same for everyone: doors recovered with subscriber skips don’t count towards them.</p>';
  }
  function paint() {
    var dlg = D.getElementById("sl-achdlg"); if (!dlg || dlg.hidden) return;
    var box = dlg.querySelector(".sl-achbox"), body = D.getElementById("sl-achbody"); if (!box || !body) return;
    var sec = D.getElementById("sl-ev-ach");
    if (!sec) { sec = D.createElement("div"); sec.id = "sl-ev-ach"; body.parentNode.insertBefore(sec, body.nextSibling); }
    var h = sectionHtml(); if (sec._h !== h) { sec.innerHTML = h; sec._h = h; }
  }
  setInterval(function () { if (!D.hidden) paint(); }, 600);
  setInterval(function () { if (!D.hidden) evaluate(); }, 30000);
  EV.on("advent-claim", function () { setTimeout(evaluate, 1600); });
  EV.on("advent", function () { paint(); });
  EV.on("time", function (t) { if (t != null) evaluate(); });
  EV.on("auth", loadFromAccount);
  EV.seasonal = { evaluate: evaluate, earned: function () { return JSON.parse(JSON.stringify(earned)); }, stats: stats, paint: paint,
                  reset: function () { earned = {}; EV.ls.del(KEY()); EV.ls.del(VIS); paint(); } };
})();
