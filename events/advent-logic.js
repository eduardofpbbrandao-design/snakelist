/* SnakeList Advent Calendar - the rules, with no page and no storage (also run by the Node tests).
   The same rules are enforced for signed-in accounts by firebase/firestore.rules; this file and the
   rules must agree. A claim is { at: ms (trusted time), via: "day" | "skip" | "sub", run: n, ahead: n, bonus: bool }:
     "day"  - opened during its own 24 hours (door N: firstDoor + N-1 days ... + N days)
     "skip" - one door covered with a free skip (earned with streaks, below)
     "sub"  - one door covered with a subscriber skip (max advent.subscriberSkips per event, counted apart)
   A skip covers ONE door the person chooses (Eduardo, 2026-11-24):
     a MISSED door  -> RECOVERED: its reward is given straight away;
     a FUTURE door  -> RESERVED (only once the calendar has started, while advent.skipCanClaimFuture is true):
                       the door is covered now, but its reward stays hidden until the door's own day.
   Today's door is never a skip's target (it can simply be opened).
   bonus: a subscription was active when the door was covered - the door's subscriber bonus rewards are then kept.

   The streak and free skips: every door that is covered - opened on its day OR covered by a skip - counts.
   Free skips = for every block of consecutive covered doors, one per 3 doors in it (floor(length / 3)).
   It is worked out exactly and only once, when a door is covered: with L covered doors right before it and R right
   after it, the new door joins them into one block of L + 1 + R and earns
       floor((L + 1 + R) / 3) - floor(L / 3) - floor(R / 3)    (always 0 or 1)
   so the total is always exactly "one per 3 in a row", whatever order the doors are covered in, and no door can
   ever earn twice. No loophole: a skip spent to join a block earns at most that one skip back (never more), every
   door is covered once (create-only), and the time is always the server's - so at most 8 free skips can ever be
   earned (24 / 3).
     run = L + 1 (the block ending with this door when it was covered), ahead = R.
   mask: 24 characters, "1" for a covered door (the Firestore rules check L and R against the stored mask). */
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
      o.doors[+k] = { at: +d.at || 0, via: d.via || "day", run: d.run != null ? +d.run : 1, ahead: +d.ahead || 0, bonus: !!d.bonus };
    });
    o.earned = +s.earned || 0; o.earnedUsed = +s.earnedUsed || 0; o.subUsed = +s.subUsed || 0; o.claimed = Object.keys(o.doors).length;
    return o;
  }
  function covered(s, d) { return !!s.doors[d]; }
  function mask(s, days) { var m = ""; for (var d = 1; d <= (days || 24); d++) m += covered(s, d) ? "1" : "0"; return m; }
  // the covered doors right before / right after `day`
  function left(s, day) { var n = 0; for (var d = day - 1; d >= 1 && covered(s, d); d--) n++; return n; }
  function right(ev, s, day) { var n = 0; for (var d = day + 1; d <= ev.advent.days && covered(s, d); d++) n++; return n; }
  // free skips a newly covered door earns (0 or 1); k = advent.streakForSkip
  function gain(k, L, R) { return Math.floor((L + 1 + R) / k) - Math.floor(L / k) - Math.floor(R / k); }
  // the free skips the covered doors are worth in total (one per k in a row)
  function earnedFor(ev, s) {
    var k = ev.advent.streakForSkip, n = 0, cur = 0;
    for (var d = 1; d <= ev.advent.days + 1; d++) { if (d <= ev.advent.days && covered(s, d)) cur++; else { n += Math.floor(cur / k); cur = 0; } }
    return n;
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
  // a door covered ahead of its day whose day hasn't come yet: it counts, but its reward is still hidden
  function reserved(ev, s, day, now) {
    var c = s.doors[day];
    return !!c && c.via !== "day" && (now == null || now < unlockAt(ev, day));
  }
  // was it covered ahead of its day (a reservation, whether or not the day has come since)?
  function wasReserved(ev, s, day) { var c = s.doors[day]; return !!c && c.via !== "day" && c.at < unlockAt(ev, day); }
  // may a skip cover an upcoming door right now?
  function futureSkips(ev, now) {
    return !!ev.advent.skipCanClaimFuture && now != null && now >= unlockAt(ev, 1) && now < closesAt(ev);
  }
  // what a skip could do now: "missed" (recover it), "reserve" (reserve an upcoming door) or "" (nothing)
  function skipTarget(ev, s, day, now) {
    var st = status(ev, s, day, now);
    if (st === "missed") return "missed";
    if (st === "locked" && futureSkips(ev, now) && day >= 1 && day <= ev.advent.days) return "reserve";
    return "";
  }
  function skipsLeft(ev, s) {
    return { earned: Math.max(0, s.earned - s.earnedUsed), sub: Math.max(0, ev.advent.subscriberSkips - s.subUsed), subUsed: s.subUsed,
             earnedTotal: s.earned, cap: ev.advent.subscriberSkips };
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
    if (!tg) return { ok: false, reason: "future" };                                 // an upcoming door, while skips can't reserve
    if (via === "skip") return skipsLeft(ev, s).earned > 0 ? { ok: true, target: tg } : { ok: false, reason: "no-earned-skips" };
    if (!subscriber) return { ok: false, reason: "not-subscriber" };
    return s.subUsed < ev.advent.subscriberSkips ? { ok: true, target: tg } : { ok: false, reason: "subscriber-skip-cap" };
  }
  // what covering `day` now would give: { run, ahead, gain }
  function claimInfo(ev, s, day) {
    var L = left(s, day), R = right(ev, s, day);
    return { run: L + 1, ahead: R, gain: gain(ev.advent.streakForSkip, L, R) };
  }
  function runFor(s, day) { return left(s, day) + 1; }
  // returns the new state (the old one is not changed); throws when check() says no.
  // subscriber: a subscription is active right now (needed for "sub"; it also keeps the door's subscriber bonus rewards)
  function apply(ev, s, day, now, via, subscriber) {
    var c = check(ev, s, day, now, via, subscriber);
    if (!c.ok) { var e = new Error(c.reason); e.reason = c.reason; throw e; }
    var n = norm(s), ci = claimInfo(ev, n, day);
    n.doors[day] = { at: now, via: via, run: ci.run, ahead: ci.ahead, bonus: !!subscriber };
    n.earned += ci.gain;
    if (via === "skip") n.earnedUsed++;
    if (via === "sub") n.subUsed++;
    n.claimed++;
    return n;
  }
  function onDay(s, d) { var x = s.doors[d]; return !!x && x.via === "day"; }
  // covered doors in a row up to today (today's door not opened yet doesn't break it until the day is over)
  function streak(ev, s, now) {
    var t = Math.min(today(ev, now), ev.advent.days), d = covered(s, t) ? t : t - 1, n = 0;
    while (d >= 1 && covered(s, d)) { n++; d--; }
    return n;
  }
  // the longest run of doors opened on their own day (the "Three-Day Streak" achievement: real visits only)
  function bestRun(s) {
    var best = 0, cur = 0;
    for (var d = 1; d <= 31; d++) { if (onDay(s, d)) { cur++; best = Math.max(best, cur); } else cur = 0; }
    return best;
  }
  // progress towards the next free skip: the covered doors in a row that end today (or yesterday), in steps of k
  function toNextSkip(ev, s, now) {
    var k = ev.advent.streakForSkip;
    return { have: streak(ev, s, now) % k, need: k };
  }
  // A reserved door counts for the 24 and the grand-prize progress at once (covered), but its reward - and anything
  // that reward unlocks - only once its day has come. With `now` the counts leave out doors still reserved; without
  // it every covered door counts.
  function stats(ev, s, now) {
    var all = Object.keys(s.doors).map(Number);
    var shown = now === undefined ? all : all.filter(function (d) { return !reserved(ev, s, d, now); });
    var fair = shown.filter(function (d) { return s.doors[d].via !== "sub"; });
    var nRes = all.length - shown.length;
    return {
      doors: shown.length, fairDoors: fair.length, covered: all.length, reserved: nRes,
      onTime: all.filter(function (d) { return s.doors[d].via === "day"; }).length,
      skipped: all.filter(function (d) { return s.doors[d].via !== "day"; }).length,
      door13: s.doors[13] && s.doors[13].via !== "sub" && shown.indexOf(13) >= 0 ? 1 : 0,
      bestRun: bestRun(s), complete: all.length >= ev.advent.days && nRes === 0
    };
  }
  return { DAY: DAY, unlockAt: unlockAt, closesAt: closesAt, empty: empty, norm: norm, today: today, status: status, skipsLeft: skipsLeft,
           futureSkips: futureSkips, skipTarget: skipTarget, check: check, apply: apply, runFor: runFor, claimInfo: claimInfo, gain: gain,
           earnedFor: earnedFor, mask: mask, reserved: reserved, wasReserved: wasReserved,
           streak: streak, bestRun: bestRun, toNextSkip: toNextSkip, stats: stats };
});
