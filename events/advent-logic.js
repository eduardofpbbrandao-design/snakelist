/* SnakeList Advent Calendar - the rules, with no page and no storage (also run by the Node tests).
   The same rules are enforced for signed-in accounts by firebase/firestore.rules; this file and the
   rules must agree. A claim is { at: ms (trusted time), via: "day" | "skip" | "sub", run: n }:
     "day"  - opened during its own 24 hours (door N: firstDoor + N-1 days ... + N days)
     "skip" - one door covered with a free skip (earned: 1 per 3 doors in a row opened on their own day)
     "sub"  - one door covered with a subscriber skip (max 10 per event, counted apart)
   A skip covers ONE eligible door the person chooses: a missed past door, or - while the event's
   advent.skipCanClaimFuture is true - an upcoming door claimed early (only once the calendar has started).
   Today's door is never a skip's target (it can simply be opened).
   The streak: only doors opened on their own day are real visits. A door covered by a skip counts for the
   calendar, the 24 doors and the grand prize, but NOT for the streak - so it neither continues nor starts one.
     run = for a "day" claim: how many doors in a row, each opened on its own day, end with this one
           (the previous door's run + 1 when the previous door was also opened on its day, else 1);
           for a skip claim: 0.
   A free skip is earned whenever a "day" claim's run is a multiple of 3. */
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
    Object.keys(s.doors || {}).forEach(function (k) {
      var d = s.doors[k]; if (!d) return;
      var via = d.via || "day";
      o.doors[+k] = { at: +d.at || 0, via: via, run: d.run != null ? +d.run : via === "day" ? 1 : 0 };
    });
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
    if (now == null || now < unlockAt(ev, day)) return "locked";   // never opened from an unknown or future time (except by a skip, below)
    if (now >= closesAt(ev)) return "closed";
    if (now < unlockAt(ev, day + 1)) return "open";
    return "missed";
  }
  // may a skip cover an upcoming door right now?
  function futureSkips(ev, now) {
    return !!ev.advent.skipCanClaimFuture && now != null && now >= unlockAt(ev, 1) && now < closesAt(ev);
  }
  // what a skip could cover now: "missed" (recover), "early" (claim an upcoming door early) or "" (nothing)
  function skipTarget(ev, s, day, now) {
    var st = status(ev, s, day, now);
    if (st === "missed") return "missed";
    if (st === "locked" && futureSkips(ev, now) && day >= 1 && day <= ev.advent.days) return "early";
    return "";
  }
  function skipsLeft(ev, s) {
    return { earned: Math.max(0, s.earned - s.earnedUsed), sub: Math.max(0, ev.advent.subscriberSkips - s.subUsed), subUsed: s.subUsed, earnedTotal: s.earned };
  }
  // can `day` be claimed now, this way?  -> { ok, reason, target }
  function check(ev, s, day, now, via, subscriber) {
    day = +day;
    if (!(day >= 1 && day <= ev.advent.days && Math.floor(day) === day)) return { ok: false, reason: "no-such-door" };
    if (now == null || !isFinite(now)) return { ok: false, reason: "no-trusted-time" };
    var st = status(ev, s, day, now);
    if (st === "claimed") return { ok: false, reason: "already-claimed" };
    if (st === "closed") return { ok: false, reason: "event-over" };
    if (via === "day") return st === "open" ? { ok: true } : { ok: false, reason: st === "locked" ? "future" : "missed-needs-skip" };
    if (via !== "skip" && via !== "sub") return { ok: false, reason: "bad-kind" };
    if (st === "open") return { ok: false, reason: "open-today" };                // today's door: just open it
    var tg = skipTarget(ev, s, day, now);
    if (!tg) return { ok: false, reason: "future" };                                 // an upcoming door, while skips can't claim ahead
    if (via === "skip") return skipsLeft(ev, s).earned > 0 ? { ok: true, target: tg } : { ok: false, reason: "no-earned-skips" };
    if (!subscriber) return { ok: false, reason: "not-subscriber" };
    return s.subUsed < ev.advent.subscriberSkips ? { ok: true, target: tg } : { ok: false, reason: "subscriber-skip-cap" };
  }
  // the run a new claim of `day` this way gets
  function runFor(s, day, via) {
    if (via && via !== "day") return 0;
    var p = s.doors[day - 1];
    return p && p.via === "day" ? p.run + 1 : 1;
  }
  // returns the new state (the old one is not changed); throws when check() says no
  function apply(ev, s, day, now, via, subscriber) {
    var c = check(ev, s, day, now, via, subscriber);
    if (!c.ok) { var e = new Error(c.reason); e.reason = c.reason; throw e; }
    var n = norm(s), run = runFor(n, day, via);
    n.doors[day] = { at: now, via: via, run: run };
    if (via === "day" && run % ev.advent.streakForSkip === 0) n.earned++;
    if (via === "skip") n.earnedUsed++;
    if (via === "sub") n.subUsed++;
    n.claimed++;
    return n;
  }
  function onDay(s, d) { var x = s.doors[d]; return !!x && x.via === "day"; }
  // doors in a row opened on their own day, up to today (today's door not opened yet doesn't break it until the day is over)
  function streak(ev, s, now) {
    var t = Math.min(today(ev, now), ev.advent.days), d = onDay(s, t) ? t : t - 1, n = 0;
    while (d >= 1 && onDay(s, d)) { n++; d--; }
    return n;
  }
  // the longest run of doors opened on their own day
  function bestRun(s) {
    var best = 0, cur = 0;
    for (var d = 1; d <= 31; d++) { if (onDay(s, d)) { cur++; best = Math.max(best, cur); } else cur = 0; }
    return best;
  }
  // progress towards the next free skip: the current streak, counted in steps of streakForSkip
  function toNextSkip(ev, s, now) {
    var k = ev.advent.streakForSkip, t = Math.min(today(ev, now), ev.advent.days), d = onDay(s, t) ? t : t - 1;
    var r = onDay(s, d) ? s.doors[d].run : 0;
    return { have: r % k, need: k };
  }
  function stats(ev, s) {
    var all = Object.keys(s.doors).map(Number), fair = all.filter(function (d) { return s.doors[d].via !== "sub"; });
    return {
      doors: all.length, fairDoors: fair.length,
      onTime: all.filter(function (d) { return s.doors[d].via === "day"; }).length,
      skipped: all.filter(function (d) { return s.doors[d].via !== "day"; }).length,
      door13: s.doors[13] && s.doors[13].via !== "sub" ? 1 : 0,
      bestRun: bestRun(s), complete: all.length >= ev.advent.days
    };
  }
  return { DAY: DAY, unlockAt: unlockAt, closesAt: closesAt, empty: empty, norm: norm, today: today, status: status, skipsLeft: skipsLeft,
           futureSkips: futureSkips, skipTarget: skipTarget, check: check, apply: apply, runFor: runFor, streak: streak, bestRun: bestRun,
           toNextSkip: toNextSkip, stats: stats };
});
