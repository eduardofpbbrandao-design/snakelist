/* SnakeList Advent Calendar - the rules, with no page and no storage (also run by the Node tests).
   The same rules are enforced for signed-in accounts by firebase/firestore.rules; this file and the
   rules must agree. A claim is { at: ms (trusted time), via: "day" | "skip" | "sub", run: n }:
     "day"  - opened during its own 24 hours (door N: firstDoor + N-1 days ... + N days)
     "skip" - a missed past door recovered with a free skip (earned: 1 per 3 claimed days in a row)
     "sub"  - a missed past door recovered with a subscriber skip (max 10 per event, counted apart)
   run = how many claimed days in a row end with this one, when it was claimed (prev door's run + 1).
   A skip is earned whenever a claim's run is a multiple of 3. Future doors can never be opened. */
(function (root, f) {
  if (typeof module === "object" && module.exports) module.exports = f(); else root.SL_ADVENT_LOGIC = f();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  var DAY = 864e5;
  function ms(x) { return typeof x === "number" ? x : Date.parse(x); }
  function unlockAt(ev, day) { return ms(ev.advent.firstDoor) + (day - 1) * DAY; }
  function closesAt(ev) { return ms(ev.advent.recoverUntil); }
  function empty() { return { doors: {}, earned: 0, earnedUsed: 0, subUsed: 0, claimed: 0 }; }
  function norm(s) {
    s = s || {};
    var o = empty();
    Object.keys(s.doors || {}).forEach(function (k) { var d = s.doors[k]; if (d) o.doors[+k] = { at: +d.at || 0, via: d.via || "day", run: +d.run || 1 }; });
    o.earned = +s.earned || 0; o.earnedUsed = +s.earnedUsed || 0; o.subUsed = +s.subUsed || 0; o.claimed = Object.keys(o.doors).length;
    return o;
  }
  // the door whose own 24 hours contain `now` (0 before the first, days+1 after the last)
  function today(ev, now) {
    if (now == null) return 0;
    var d = Math.floor((now - ms(ev.advent.firstDoor)) / DAY) + 1;
    return d < 1 ? 0 : Math.min(d, ev.advent.days + 1);
  }
  function status(ev, s, day, now) {
    if (s.doors[day]) return "claimed";
    if (now == null || now < unlockAt(ev, day)) return "locked";   // never opened from an unknown or future time
    if (now >= closesAt(ev)) return "closed";
    if (now < unlockAt(ev, day + 1)) return "open";
    return "missed";
  }
  function skipsLeft(ev, s) {
    return { earned: Math.max(0, s.earned - s.earnedUsed), sub: Math.max(0, ev.advent.subscriberSkips - s.subUsed), subUsed: s.subUsed, earnedTotal: s.earned };
  }
  // can `day` be claimed now, this way?  -> { ok, reason }
  function check(ev, s, day, now, via, subscriber) {
    day = +day;
    if (!(day >= 1 && day <= ev.advent.days && Math.floor(day) === day)) return { ok: false, reason: "no-such-door" };
    if (now == null || !isFinite(now)) return { ok: false, reason: "no-trusted-time" };
    var st = status(ev, s, day, now);
    if (st === "claimed") return { ok: false, reason: "already-claimed" };
    if (st === "locked") return { ok: false, reason: "future" };
    if (st === "closed") return { ok: false, reason: "event-over" };
    if (via === "day") return st === "open" ? { ok: true } : { ok: false, reason: "missed-needs-skip" };
    if (st !== "missed") return { ok: false, reason: "not-missed" };          // skips only recover PAST missed days
    if (via === "skip") return skipsLeft(ev, s).earned > 0 ? { ok: true } : { ok: false, reason: "no-earned-skips" };
    if (via === "sub") {
      if (!subscriber) return { ok: false, reason: "not-subscriber" };
      return s.subUsed < ev.advent.subscriberSkips ? { ok: true } : { ok: false, reason: "subscriber-skip-cap" };
    }
    return { ok: false, reason: "bad-kind" };
  }
  function runFor(s, day) { var p = s.doors[day - 1]; return p ? p.run + 1 : 1; }
  // returns the new state (the old one is not changed); throws when check() says no
  function apply(ev, s, day, now, via, subscriber) {
    var c = check(ev, s, day, now, via, subscriber);
    if (!c.ok) { var e = new Error(c.reason); e.reason = c.reason; throw e; }
    var n = norm(s), run = runFor(n, day);
    n.doors[day] = { at: now, via: via, run: run };
    if (run % ev.advent.streakForSkip === 0) n.earned++;
    if (via === "skip") n.earnedUsed++;
    if (via === "sub") n.subUsed++;
    n.claimed++;
    return n;
  }
  // days in a row up to today (today's door not claimed yet doesn't break it until the day is over)
  function streak(ev, s, now) {
    var t = Math.min(today(ev, now), ev.advent.days), d = s.doors[t] ? t : t - 1, n = 0;
    while (d >= 1 && s.doors[d]) { n++; d--; }
    return n;
  }
  function bestRun(s, onlyFair) {
    var best = 0, cur = 0;
    for (var d = 1; d <= 31; d++) { var x = s.doors[d]; if (x && !(onlyFair && x.via === "sub")) { cur++; best = Math.max(best, cur); } else cur = 0; }
    return best;
  }
  // progress towards the next free skip: the run of the newest claim in the current streak
  function toNextSkip(ev, s, now) {
    var t = Math.min(today(ev, now), ev.advent.days), d = s.doors[t] ? t : t - 1;
    var r = s.doors[d] ? s.doors[d].run : 0, k = ev.advent.streakForSkip;
    return { have: r % k, need: k };
  }
  function stats(ev, s) {
    var all = Object.keys(s.doors).map(Number), fair = all.filter(function (d) { return s.doors[d].via !== "sub"; });
    return {
      doors: all.length, fairDoors: fair.length,
      onTime: all.filter(function (d) { return s.doors[d].via === "day"; }).length,
      door13: s.doors[13] && s.doors[13].via !== "sub" ? 1 : 0,
      bestRun: bestRun(s, true), complete: all.length >= ev.advent.days
    };
  }
  return { DAY: DAY, unlockAt: unlockAt, closesAt: closesAt, empty: empty, norm: norm, today: today, status: status, skipsLeft: skipsLeft,
           check: check, apply: apply, runFor: runFor, streak: streak, bestRun: bestRun, toNextSkip: toNextSkip, stats: stats };
});
