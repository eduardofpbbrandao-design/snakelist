/* SnakeList events preview - the Advent Calendar (Christmas 2026): 24 doors in the Christmas Cabin.
   Where progress is kept:
     signed in  -> Firestore eventProgress/{uid}/events/xmas2026 (+ /doors/{n}); the server stamps each door with
                   its own time and firebase/firestore.rules refuse future doors, duplicates, made-up skips.
     signed out -> this browser only, clearly labelled "Sign in to save your Advent Calendar"; still opened only
                   with the server's time (EV.time), never the device clock.
     TEST mode  -> (preview only) a separate local copy, so trying subscriber skips never touches the real calendar.
   Three ways to cover a door, always said in words before anything is spent (events/advent-logic.js has the rules):
     CLAIM    - today's door, opened on its own day (free, nothing spent)
     RECOVER  - a missed day, with one skip: its reward is given straight away
     RESERVE  - an upcoming day, with one skip: it counts at once, but its reward stays wrapped until its own day
   Every skip is confirmed first ("Spend 1 free skip to recover door 4? You'll have 0 left.").
   Every door has one reward for everybody plus subscriber bonus rewards (config.js adventBonus; three on special
   days), kept for good when a subscription was active as the door was covered.
   API for the Cabin (window.SL_EVENTS.advent / .cabin):
     SL_EVENTS.advent.open()                     open the calendar panel
     SL_EVENTS.advent.state() / .stats()         the claims and counts
     SL_EVENTS.advent.inventory()                [{id, name, kind, owned, premium, bonus, shown}]
     SL_EVENTS.cabin.mount({ bar, stage })       put the Advent button in `bar` and the chosen decorations on `stage`
                                                 (done automatically for #xm-cabin .xc-bar / .xc-stage if nobody calls it) */
(function () {
  "use strict";
  var EV = window.SL_EVENTS; if (!EV) return;
  var D = document, L = EV.logic, CFG = EV.cfg, esc = EV.esc, ic = EV.art.icon;
  var E = EV.event("xmas2026"); if (!E || !E.advent) return;
  var N = E.advent.days;
  var REWARD = {}; CFG.advent.forEach(function (r) { REWARD[r.day] = r; });
  var BONUS = {}; CFG.adventBonus.forEach(function (r) { (BONUS[r.day] = BONUS[r.day] || []).push(r); });
  var ORDER = [7, 18, 3, 22, 11, 1, 15, 9, 24, 5, 13, 20, 2, 17, 10, 6, 21, 14, 8, 23, 4, 12, 19, 16];

  /* ---------------- where the progress lives ---------------- */
  var ST = { kind: null, state: L.empty(), loaded: false, busy: false, err: null, uid: null };
  function kind() { return EV.testMode() ? "test" : EV.user() ? "account" : "local"; }
  function lsKey(k) { return "sl-ev-advent:" + E.id + ":" + k; }
  function refs(db, uid) {
    var sum = db.collection("eventProgress").doc(uid).collection("events").doc(E.id);
    return { sum: sum, doors: sum.collection("doors") };
  }
  function tsMs(t) { return t && t.toMillis ? t.toMillis() : +t || 0; }
  function load() {
    var k = kind(), u = EV.user();
    ST.kind = k; ST.uid = u ? u.uid : null; ST.err = null;
    if (k !== "account") { ST.state = L.norm(EV.ls.get(lsKey(k), null)); ST.loaded = true; changed(); return Promise.resolve(ST.state); }
    ST.loaded = false; changed();
    var uid = ST.uid;
    return EV.db().then(function (db) {
      var r = refs(db, uid);
      return Promise.all([r.sum.get(), r.doors.get()]);
    }).then(function (res) {
      if (ST.uid !== uid) return ST.state;
      var s = res[0].exists ? res[0].data() : {}, doors = {};
      res[1].forEach(function (d) { var x = d.data(); doors[x.day] = { at: tsMs(x.at), via: x.via, run: x.run, ahead: x.ahead, bonus: x.bonus }; });
      ST.state = L.norm({ doors: doors, earned: s.earned, earnedUsed: s.earnedUsed, subUsed: s.subUsed });
      ST.loaded = true; changed(); return ST.state;
    }).catch(function (e) { ST.err = "Couldn't load your Advent Calendar from your account (" + (e.code || e.message) + ")."; ST.loaded = true; changed(); return ST.state; });
  }
  function reasonText(r) {
    return {
      "no-trusted-time": "Couldn't check the time with the SnakeList server - doors only open with the server's time. Check your connection and try again.",
      "already-claimed": "This door is already covered.", "future": "No peeking! This door opens on its own day.",
      "event-over": "The Advent Calendar has closed.", "missed-needs-skip": "This day has passed - use a skip to recover it.",
      "open-today": "Today's door is open - just claim it, no skip needed.", "no-earned-skips": "You have no free skips left. Cover 3 doors in a row to earn one.",
      "not-subscriber": "Subscriber skips are a subscriber benefit.", "subscriber-skip-cap": "You've used all " + E.advent.subscriberSkips + " subscriber skips for this event.",
      "permission-denied": "The server refused this door (it checks the date and your skips).", "no-such-door": "There's no such door."
    }[r] || "Something went wrong - please try again.";
  }
  // claim a door: resolves with { state, day, via, earnedSkip }
  function claim(day, via) {
    if (ST.busy) return Promise.reject(Object.assign(new Error("busy"), { reason: "busy" }));
    var k = kind(); if (k !== ST.kind) return load().then(function () { return claim(day, via); });
    var now = EV.time.now(), sub = EV.isSubscriber();
    var c = L.check(E, ST.state, day, now, via, sub);
    if (!c.ok) return Promise.reject(Object.assign(new Error(c.reason), { reason: c.reason }));
    if (k !== "account") {
      var ns = L.apply(E, ST.state, day, now, via, sub), got = ns.earned > ST.state.earned;
      ST.state = ns; EV.ls.set(lsKey(k), ns); changed();
      return Promise.resolve({ state: ns, day: day, via: via, earnedSkip: got });
    }
    ST.busy = true;
    var uid = ST.uid, before = ST.state.earned;
    return EV.db().then(function (db) {
      var r = refs(db, uid);
      // fresh from the server first, so the counters and the covered-doors mask we send are the server's
      return r.sum.get().then(function (res) {
        var s = res.exists ? res.data() : { earned: 0, earnedUsed: 0, subUsed: 0, claimed: 0 };
        var m = typeof s.mask === "string" && s.mask.length === N ? s.mask : L.mask(ST.state, N);
        // covered doors right before / after this one: the run it joins (the Firestore rules check both against the mask)
        var l = 0; while (day - 2 - l >= 0 && m.charAt(day - 2 - l) === "1") l++;
        var a = 0; while (day + a < N && m.charAt(day + a) === "1") a++;
        var TS = EV.serverTimestamp(), b = db.batch();
        b.set(r.doors.doc(String(day)), { day: day, at: TS, via: via, run: l + 1, ahead: a, bonus: !!sub });
        b.set(r.sum, { earned: (s.earned || 0) + L.gain(E.advent.streakForSkip, l, a), earnedUsed: (s.earnedUsed || 0) + (via === "skip" ? 1 : 0),
                       subUsed: (s.subUsed || 0) + (via === "sub" ? 1 : 0), claimed: (s.claimed || 0) + 1, last: day, at: TS,
                       mask: m.slice(0, day - 1) + "1" + m.slice(day) });
        return b.commit();
      });
    }).then(function () { ST.busy = false; return load(); }).then(function (s) {
      return { state: s, day: day, via: via, earnedSkip: s.earned > before };
    }, function (e) {
      ST.busy = false; var rr = (e && e.code === "permission-denied") ? "permission-denied" : e.reason || e.code || "error";
      throw Object.assign(new Error(rr), { reason: rr });
    });
  }

  /* ---------------- reserved doors: "unwrapped" on their day ---------------- */
  function seenKey() { return "sl-ev-adv-unwrapped:" + ST.kind; }
  function unwrapped() { var s = EV.ls.get(seenKey(), null); return Array.isArray(s) ? s : []; }
  function markUnwrapped(d) { var s = unwrapped(); if (s.indexOf(d) < 0) { s.push(d); EV.ls.set(seenKey(), s); } }
  // a reserved door whose day has come but whose reward hasn't been unwrapped yet
  function ready(d, now) { return L.wasReserved(E, ST.state, d) && !L.reserved(E, ST.state, d, now) && unwrapped().indexOf(d) < 0; }

  /* ---------------- the panel ---------------- */
  var P = null;
  function stats() { return L.stats(E, ST.state, EV.time.now()); }
  function modeNote() {
    if (ST.kind === "test") return EV.testBadge() + '<p class="sl-ev-muted">Test progress is kept apart from your real calendar, in this browser only.</p>';
    // the notice in big letters, the Sign in button next to it (not inside)
    if (ST.kind === "local") return '<div class="sl-ev-signin"><div class="sl-ev-note warn sl-ev-signin-note"><b>Sign in to save your Advent Calendar.</b>' +
      "<span>Until then, the doors you open are kept on this device only.</span></div>" +
      '<button type="button" class="sl-ev-btn pri sl-ev-signin-btn" data-act="signin">Sign in</button></div>';
    var local = L.norm(EV.ls.get(lsKey("local"), null)).claimed;
    return '<p class="sl-ev-muted">' + ic("check", 13) + " Saved to your SnakeList account. Every door is checked against the server's clock." +
      (local ? " (" + local + " door" + (local === 1 ? "" : "s") + " opened on this device while signed out stay on this device - they couldn't be checked by the server.)" : "") + "</p>";
  }
  function statsHtml() {
    var now = EV.time.now(), sk = L.skipsLeft(E, ST.state), str = now == null ? 0 : L.streak(E, ST.state, now), nx = now == null ? { have: 0, need: 3 } : L.toNextSkip(E, ST.state, now);
    var dots = ""; for (var i = 0; i < nx.need; i++) dots += '<i class="' + (i < nx.have ? "on" : "") + '"></i>';
    var sub = EV.isSubscriber();
    return '<div class="sl-ev-adv-stats">' +
      '<div class="sl-ev-stat" title="Doors in a row, opened on their day or covered with a skip"><small>Streak</small><b data-stat="streak">' + str + " day" + (str === 1 ? "" : "s") + '</b><span class="dots" aria-hidden="true">' + dots + '</span><span class="sl-ev-stat-sub">' + (nx.need - nx.have) + " more to a free skip</span></div>" +
      '<div class="sl-ev-stat"><small>Free skips left</small><b data-stat="earned">' + sk.earned + '</b><span class="sl-ev-stat-sub">' + sk.earnedTotal + " earned so far</span></div>" +
      '<div class="sl-ev-stat"><small>Subscriber skips left</small>' + (sub ? '<b data-stat="sub">' + sk.sub + " / " + sk.cap + '</b><span class="sl-ev-stat-sub">for this event</span>' : '<b class="sl-ev-stat-lock"><span class="sl-ev-lock">' + ic("lock", 11) + " Subscribers</span></b>") + "</div></div>";
  }
  function clockLine() {
    var now = EV.time.now();
    if (now == null) return EV.time.failed() ? '<p class="sl-ev-clockline">' + ic("clock", 14) + " Couldn't check the time with the server - doors stay shut until it can.</p>" : '<p class="sl-ev-clockline">' + ic("clock", 14) + " Checking the time…</p>";
    var t = L.today(E, now);
    if (t < 1) return '<p class="sl-ev-clockline">' + ic("clock", 14) + " Door 1 opens <b>" + esc(EV.localTime(E.advent.firstDoor)) + "</b> - " + esc(EV.tzNote()) + " (<b data-cd>" + cd(L.unlockAt(E, 1) - now) + "</b>)</p>";
    if (now >= L.closesAt(E)) return '<p class="sl-ev-clockline">The Advent Calendar has closed. Thank you for taking part!</p>';
    if (t < N) return '<p class="sl-ev-clockline">' + ic("clock", 14) + " Door " + (t + 1) + " opens in <b data-cd>" + cd(L.unlockAt(E, t + 1) - now) + "</b> - at " + esc(EV.localTime(L.unlockAt(E, t + 1), { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })) + ", " + esc(EV.tzNote()) + "</p>";
    return '<p class="sl-ev-clockline">All 24 doors are open. Missed days can be recovered with skips until <b>' + esc(EV.localTime(E.advent.recoverUntil, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })) + "</b> (" + esc(EV.tzNote()) + ").</p>";
  }
  function cd(ms) { ms = Math.max(0, ms); var h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3); return h + "h " + (m < 10 ? "0" : "") + m + "m " + (s < 10 ? "0" : "") + s + "s"; }
  function dayName(d, o) { return EV.localTime(L.unlockAt(E, d), o || { weekday: "long", day: "numeric", month: "long" }); }
  // what each kind of door looks like: every state has its own icon and word as well as its colour (never colour alone)
  function keyHtml() {
    return '<ul class="sl-ev-key" aria-label="What the doors show">' +
      '<li class="k-claim">' + ic("gift", 13) + "<span><b>Today</b> - claim it</span></li>" +
      '<li class="k-done">' + ic("check", 13) + "<span><b>Opened</b></span></li>" +
      '<li class="k-recover">' + ic("skip", 13) + "<span><b>Missed</b> - recover with a skip</span></li>" +
      '<li class="k-reserve">' + ic("gift", 13) + "<span><b>Reserved</b> - unwraps on its day</span></li>" +
      '<li class="k-locked">' + ic("lock", 13) + "<span><b>Coming</b>" + (E.advent.skipCanClaimFuture ? " - a skip can reserve it" : "") + "</span></li></ul>";
  }
  // skips, explained once: unfolded the first time the calendar is seen, then folded away (remembered in this browser)
  var EXPLAINED = "sl-ev-adv-skips-explained", helpOpen = null;
  function skipsHelp() {
    var first = helpOpen != null ? helpOpen : !EV.ls.get(EXPLAINED, 0);
    return '<details class="sl-ev-howskip"' + (first ? " open" : "") + "><summary>" + ic("skip", 13) + "<span>How skips work</span></summary><ul>" +
      "<li>A skip covers <b>one door you choose</b>: <b>recover</b> a day you missed (its reward is yours at once)" + (E.advent.skipCanClaimFuture ? " or <b>reserve</b> a future day (its reward unwraps on that day)" : "") + ". You confirm first.</li>" +
      "<li><b>Free skips</b>: everyone earns 1 for every " + E.advent.streakForSkip + " doors in a row. Each door counts once.</li>" +
      "<li><b>Subscriber skips</b>: up to " + E.advent.subscriberSkips + " per event, kept separate from the free ones.</li>" +
      "<li>Each door can be covered once. Covered doors count towards the 24 and the grand prize.</li></ul></details>";
  }
  // "Jump to today": scrolls today's door into view, focuses it and lights it up for a moment
  function jumpHtml() {
    var now = EV.time.now(), t = now == null ? 0 : L.today(E, now);
    if (t < 1 || t > N || now >= L.closesAt(E)) return "";
    return '<button type="button" class="sl-ev-btn sl-ev-btn-sm sl-ev-jump" data-act="today">' + ic("gift", 14) + "Jump to today &middot; door " + t + "</button>";
  }
  function jumpToday() {
    var now = EV.time.now(), t = now == null ? 0 : L.today(E, now), el = P && P.querySelector('.sl-ev-door[data-day="' + t + '"]');
    if (!el) return;
    try { el.scrollIntoView({ block: "center", behavior: EV.reducedMotion() ? "auto" : "smooth" }); el.focus({ preventScroll: true }); } catch (e) {}
    el.classList.remove("sl-ev-pulse"); void el.offsetWidth; el.classList.add("sl-ev-pulse");
    setTimeout(function () { el.classList.remove("sl-ev-pulse"); }, 1800);
  }
  function doorsHtml() {
    var now = EV.time.now();
    return '<div class="sl-ev-cal"><div class="sl-ev-doors" role="list">' + ORDER.map(function (d) {
      var st = L.status(E, ST.state, d, now), r = REWARD[d], c = ST.state.doors[d], tg = st === "locked" ? L.skipTarget(E, ST.state, d, now) : "";
      var rsv = st === "claimed" && L.reserved(E, ST.state, d, now), rdy = st === "claimed" && !rsv && ready(d, now);
      var cls = rsv ? "is-reserved" : rdy ? "is-ready" : "is-" + st;
      var lab = "Door " + d + ": " + (rsv ? "reserved - its reward is unwrapped on " + dayName(d, { day: "numeric", month: "long" }) :
        rdy ? "reserved, and its day has come - unwrap it!" :
        st === "claimed" ? r.name + (c.via === "skip" ? " (covered with a free skip)" : c.via === "sub" ? " (covered with a subscriber skip)" : " (opened on its day)") :
        st === "open" ? "today's door - claim it!" : st === "missed" ? "missed - recover it with a skip" : st === "closed" ? "closed" :
        "opens " + EV.localTime(L.unlockAt(E, d), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) + (tg === "reserve" ? " (or reserve it now with a skip)" : ""));
      var word = rsv ? ic("gift", 10) + "Reserved" : rdy ? ic("gift", 10) + "Unwrap!" : st === "open" ? ic("gift", 10) + "Claim" : st === "missed" ? ic("skip", 10) + "Missed" : "";
      var showInside = st === "claimed" && !rsv && !rdy, isToday = now != null && d === L.today(E, now);
      return '<button type="button" role="listitem" class="sl-ev-door ' + cls + (c ? " via-" + c.via : "") + (tg === "reserve" ? " can-reserve" : "") + (isToday ? " is-today" : "") + '" data-day="' + d + '" aria-label="' + esc((isToday ? "Today. " : "") + lab) + '" title="' + esc(lab) + '">' +
        (isToday ? '<span class="today" aria-hidden="true">Today</span>' : "") +
        (word ? '<span class="st" aria-hidden="true">' + word + "</span>" : "") +
        (showInside ? '<span class="inside">' + EV.art.item(r) + "</span>" : "") +
        '<span class="leaf"><b>' + d + "</b>" + (st === "locked" ? '<span class="ic">' + ic("lock", 12) + "</span>" : "") + "</span>" +
        (rsv || rdy ? '<span class="bow" aria-hidden="true"></span>' : "") +
        (showInside ? '<span class="tag">' + d + "</span>" : "") + "</button>";
    }).join("") + "</div></div>";
  }
  // the grand prize: the Legendary variant of the reward box (gold), with the LIMITED label - it can only ever be
  // earned during Christmas 2026. Never looks unlocked before all 24 doors are covered and unwrapped.
  function grandHtml() {
    var s = stats(), n = s.covered, won = s.complete, stc = won ? "is-done" : n ? "is-progress" : "is-locked";
    return '<div class="sl-ev-rbox sl-ev-legendary sl-ev-grand ' + stc + (won ? " won" : "") + '">' +
      '<div class="sl-ev-rbox-art">' + EV.art.serpent(won ? "" : "dim", won ? "big" : "") + "</div>" +
      '<div class="sl-ev-rbox-txt"><div class="sl-ev-rbox-t"><b>' + esc(CFG.grandPrize.name) + '</b><span class="sl-ev-limited" title="Once in a lifetime: it can only be earned during Christmas 2026">Limited</span></div>' +
      "<p>" + (won ? "Unlocked! It's in your collection and can sit in your Cabin."
        : "Cover all 24 doors - doors recovered or reserved with a skip count too. Once in a lifetime: it can only be earned during Christmas 2026.") + "</p>" +
      '<span class="sl-ev-rbar" role="progressbar" aria-label="Doors covered" aria-valuemin="0" aria-valuemax="' + N + '" aria-valuenow="' + n + '"><i style="width:' + Math.round(n / N * 100) + '%"></i></span>' +
      '<small class="sl-ev-rbox-p">' + (won ? ic("check", 12) + " All 24 doors" : n + " / " + N + " doors · " + (N - n) + " to go" + (s.reserved ? " · " + s.reserved + " reserved" : "")) + "</small></div></div>";
  }
  function html() {
    if (!ST.loaded) return '<p class="sl-ev-muted">Loading your Advent Calendar…</p>';
    var h = EV.earlyNoteHtml(E) + modeNote() + (ST.err ? '<div class="sl-ev-note warn">' + esc(ST.err) + "</div>" : "") + statsHtml() + skipsHelp() +
      '<div class="sl-ev-calhead">' + clockLine() + jumpHtml() + "</div>" + keyHtml() + doorsHtml() +
      '<div class="sl-ev-skip" data-skip hidden></div>' +
      '<p class="sl-ev-h4">' + ic("star", 13) + "Final reward &middot; for all 24 doors</p>" + grandHtml() +
      '<p class="sl-ev-muted sl-ev-notcabin">' + ic("gift", 12) + " Behind every door: a reward for everyone" + (BONUS[1] ? ", plus subscriber bonus rewards" : "") + ". (The Cabin's presents under the tree are separate - they come from Christmas tasks.)</p>" +
      '<div class="sl-ev-row"><button type="button" class="sl-ev-btn" data-act="inv">' + ic("gift") + 'My collection</button><button type="button" class="sl-ev-btn" data-act="sub">' + ic("crown") + "Subscriber benefits</button></div>";
    if (helpOpen == null) helpOpen = !EV.ls.get(EXPLAINED, 0); EV.ls.set(EXPLAINED, 1);
    return h;
  }
  function render() {
    if (!P || !P.isConnected) return;
    var body = P.querySelector(".sl-ev-body"), sk = body.querySelector("[data-skip]"), openSkip = sk && !sk.hidden ? +sk.getAttribute("data-day") : null, y = body.scrollTop;
    var hs = body.querySelector(".sl-ev-howskip"); if (hs) helpOpen = hs.open;
    body.innerHTML = html(); body.scrollTop = y;
    // keep the skip box only while that door can still take a skip
    if (openSkip && L.skipTarget(E, ST.state, openSkip, EV.time.now())) showSkip(openSkip);
  }
  function open() {
    if (!ST.loaded || ST.kind !== kind()) load();
    P = EV.panel("sl-ev-adv", ic("door", 18) + " Advent Calendar", html(), { cls: "sl-ev-t-xmas sl-ev-xpanel", onClose: function () { P = null; } });
    P.addEventListener("click", onClick);
    return P;
  }
  function onClick(e) {
    var a = e.target.closest("[data-act]");
    if (a) {
      var w = a.getAttribute("data-act");
      if (w === "signin") { var b = D.querySelector(".auth-btn, #auth-btn"); P.close(); if (b) b.click(); }
      if (w === "inv") openInventory();
      if (w === "today") jumpToday();
      if (w === "sub" && EV.subscribe) EV.subscribe.open();
      if (w === "skip" || w === "subskip") confirmSkip(+a.getAttribute("data-day"), w === "skip" ? "skip" : "sub");
      if (w === "confirm") doClaim(+a.getAttribute("data-day"), a.getAttribute("data-via"));
      if (w === "back") showSkip(+a.getAttribute("data-day"));
      if (w === "noskip") { var s = P.querySelector("[data-skip]"); if (s) { s.hidden = true; s.innerHTML = ""; } }
      return;
    }
    var dEl = e.target.closest(".sl-ev-door"); if (!dEl) return;
    var d = +dEl.getAttribute("data-day"), now = EV.time.now(), st = L.status(E, ST.state, d, now);
    if (st === "claimed" && L.reserved(E, ST.state, d, now)) EV.toast(ic("lock", 14) + " Door " + d + " is reserved. Its reward will be unwrapped on <b>" + esc(dayName(d)) + "</b>.");
    else if (st === "claimed") { var first = ready(d, now); markUnwrapped(d); reveal(d, { again: !first, unwrap: first }); if (first) render(); }
    else if (st === "open") doClaim(d, "day");
    else if (st === "missed" || L.skipTarget(E, ST.state, d, now) === "reserve") showSkip(d);
    else if (st === "closed") EV.toast("The Advent Calendar has closed.");
    else EV.toast(now == null ? reasonText("no-trusted-time") : "No peeking! Door " + d + " opens " + esc(EV.localTime(L.unlockAt(E, d))) + ".");
  }
  // step 1, the skip box: what a skip would do to this door - RECOVER a missed day or RESERVE a future one - and the
  // skips left, BEFORE anything is spent
  function showSkip(d) {
    var s = P && P.querySelector("[data-skip]"); if (!s) return;
    var now = EV.time.now(), tg = L.skipTarget(E, ST.state, d, now); if (!tg) return;
    var sk = L.skipsLeft(E, ST.state), sub = EV.isSubscriber(), when = esc(dayName(d)), ci = L.claimInfo(E, ST.state, d), rec = tg === "missed";
    s.hidden = false; s.setAttribute("data-day", d);
    var head = '<p class="sl-ev-act-k">' + (rec ? ic("skip", 13) + "Recover a missed day" : ic("lock", 13) + "Reserve a future day") + "</p>" +
      (rec ? "<b>Door " + d + " was missed</b> (" + when + "). One skip recovers it now, and its reward is yours straight away."
           : "<b>Door " + d + " opens on " + when + ".</b> One skip reserves it now: it counts straight away, but its reward stays wrapped until " + when + ".");
    var what = '<ul class="sl-ev-skipwhat"><li>' + ic("check", 12) + "<span>It counts towards the 24 doors and " + esc(CFG.grandPrize.name) + ".</span></li>" +
      "<li>" + ic("flame", 12) + "<span>It counts for your streak too." + (ci.gain ? " <b>It completes " + E.advent.streakForSkip + " in a row, so you get a free skip back.</b>" : "") + "</span></li>" +
      "<li>" + ic("skip", 12) + "<span>It uses one skip and can't be undone. You'll be asked to confirm first.</span></li></ul>";
    s.innerHTML = '<div class="sl-ev-act ' + (rec ? "is-recover" : "is-reserve") + '">' + head + what +
      '<p class="sl-ev-act-left">Skips left: <b>' + sk.earned + " free</b>" + (sub ? " · <b>" + sk.sub + " / " + sk.cap + " subscriber</b>" : "") + "</p>" +
      '<div class="sl-ev-row"><button type="button" class="sl-ev-btn pri" data-act="skip" data-day="' + d + '"' + (sk.earned ? "" : " disabled") + ">" + ic("skip") + (rec ? "Recover" : "Reserve") + " with a free skip</button>" +
      '<button type="button" class="sl-ev-btn" data-act="subskip" data-day="' + d + '"' + (sub && sk.sub ? "" : " disabled") + ">" + ic("crown") + (sub ? (rec ? "Recover" : "Reserve") + " with a subscriber skip" : "Subscriber skip (subscribers)") + "</button></div>" +
      (sk.earned ? "" : '<p class="sl-ev-muted" style="margin:0 0 6px">No free skips yet: cover ' + E.advent.streakForSkip + " doors in a row to earn one.</p>") +
      '<button type="button" class="sl-ev-btn sl-ev-btn-sm" data-act="noskip">Not now</button></div>';
    try { s.scrollIntoView({ block: "nearest" }); } catch (e) {}
  }
  // step 2: confirm before spending
  function confirmSkip(d, via) {
    var s = P && P.querySelector("[data-skip]"); if (!s) return;
    var now = EV.time.now(), tg = L.skipTarget(E, ST.state, d, now); if (!tg) return;
    var sk = L.skipsLeft(E, ST.state), rec = tg === "missed", free = via === "skip", ci = L.claimInfo(E, ST.state, d);
    var left = free ? sk.earned - 1 + ci.gain : sk.sub - 1, kindW = free ? "free skip" : "subscriber skip";
    s.hidden = false; s.setAttribute("data-day", d);
    s.innerHTML = '<div class="sl-ev-act sl-ev-confirm ' + (rec ? "is-recover" : "is-reserve") + '" role="alertdialog" aria-label="Confirm">' +
      '<p class="sl-ev-act-k">' + (rec ? ic("skip", 13) + "Recover" : ic("lock", 13) + "Reserve") + " · please confirm</p>" +
      "<b>Spend 1 " + kindW + " to " + (rec ? "recover" : "reserve") + " door " + d + "?</b>" +
      "<p>" + (rec ? "Its reward is given straight away." : "Its reward stays wrapped until " + esc(dayName(d)) + ".") +
      " You'll have <b>" + left + " " + kindW + (left === 1 ? "" : "s") + "</b> left. This can't be undone.</p>" +
      '<div class="sl-ev-row"><button type="button" class="sl-ev-btn pri" data-act="confirm" data-via="' + via + '" data-day="' + d + '">' + ic("check") + "Yes, " + (rec ? "recover" : "reserve") + " door " + d + "</button>" +
      '<button type="button" class="sl-ev-btn" data-act="back" data-day="' + d + '">Cancel</button></div></div>';
    try { s.querySelector('[data-act="confirm"]').focus({ preventScroll: true }); s.scrollIntoView({ block: "nearest" }); } catch (e) {}
  }
  function doClaim(d, via) {
    var tg = via === "day" ? "" : L.skipTarget(E, ST.state, d, EV.time.now());
    claim(d, via).then(function (r) {
      var sk = P && P.querySelector("[data-skip]"); if (sk) { sk.hidden = true; sk.innerHTML = ""; }
      render();
      if (tg === "reserve") reserveCard(d, r.earnedSkip); else { markUnwrapped(d); reveal(d, { earnedSkip: r.earnedSkip, via: via }); }
      EV.emit("advent-claim", r);
    }, function (e) { if (e.reason !== "busy") EV.toast(esc(reasonText(e.reason))); render(); });
  }

  /* ---------------- the reveal ---------------- */
  function overlay(cls, label) {
    var ov = D.createElement("div"); ov.className = "sl-ev-reveal " + (cls || ""); ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", label);
    return ov;
  }
  function sparkles() {
    if (EV.reducedMotion()) return "";
    var h = '<div class="sl-ev-rv-sparks" aria-hidden="true">';
    for (var i = 0; i < 14; i++) { var a = i / 14 * Math.PI * 2 + Math.random() * .3, r = 70 + Math.random() * 70; h += '<i style="--x:' + Math.round(Math.cos(a) * r) + "px;--y:" + Math.round(Math.sin(a) * r) + "px;animation-delay:" + (1.05 + Math.random() * .35).toFixed(2) + 's"></i>'; }
    return h + "</div>";
  }
  // the door's subscriber bonus rewards, shown apart from the regular one
  function bonusHtml(d, c) {
    var list = BONUS[d] || []; if (!list.length) return "";
    var kept = !!(c && c.bonus);
    return '<div class="sl-ev-rv-bonus' + (kept ? "" : " locked") + '"><p class="sl-ev-rv-bk">' + ic("crown", 12) + (kept ? "Subscriber bonus" + (list.length > 1 ? "es" : "") : "Subscriber bonus" + (list.length > 1 ? "es" : "") + " - for subscribers") + "</p>" +
      '<div class="sl-ev-rv-blist">' + list.map(function (b) { return '<div class="sl-ev-rv-bitem">' + EV.art.item(b) + "<span>" + esc(b.name) + "</span></div>"; }).join("") + "</div>" +
      (kept ? "" : '<p class="sl-ev-rv-bnote">Subscribers who cover this door get ' + (list.length > 1 ? "these too" : "this too") + ".</p>") + "</div>";
  }
  function reveal(d, o) {
    o = o || {};
    var r = REWARD[d], c = ST.state.doors[d];
    var ov = overlay("", "Door " + d + ": " + r.name), anim = !o.again && !EV.reducedMotion();
    var extra = "";
    if (o.earnedSkip) extra += '<div class="sl-ev-rv-extra">' + ic("flame", 28) + "<span><b>" + E.advent.streakForSkip + " in a row!</b><br>You earned a free skip.</span></div>";
    var how = c ? (c.via === "day" ? "Claimed on its day" : L.wasReserved(E, ST.state, d) ? (c.via === "skip" ? "Reserved with a free skip" : "Reserved with a subscriber skip") : (c.via === "skip" ? "Recovered with a free skip" : "Recovered with a subscriber skip")) +
      (c.at ? " · " + new Date(c.at).toLocaleDateString(undefined, { day: "numeric", month: "long" }) : "") : "";
    ov.innerHTML = '<div class="sl-ev-rv-card' + (anim ? " is-opening" : "") + '">' + (anim ? '<div class="sl-ev-rv-door" aria-hidden="true"><span class="l"><b>' + d + '</b></span><span class="r"></span></div>' : "") + '<div class="sl-ev-rv-rays"></div>' + (anim ? sparkles() : "") +
      (anim ? '<button type="button" class="sl-ev-rv-skipanim" data-skipanim>Skip animation</button>' : "") +
      '<p class="k">Door ' + d + " · " + esc(r.kind) + (o.unwrap ? " · unwrapped" : "") + '</p><div class="sl-ev-rv-art' + (r.glow ? " glow" : "") + '">' + EV.art.item(r, true) + "</div>" +
      '<p class="sl-ev-rv-who">' + ic("gift", 12) + "Your reward &middot; everyone gets this one</p><h3>" + esc(r.name) + "</h3><p>" + esc(r.desc) + "</p>" +
      '<p class="sl-ev-rv-how">' + (o.again ? esc(how) : "Added to your collection for good") + "</p>" + bonusHtml(d, c) + extra +
      '<button type="button" class="sl-ev-btn pri" data-close>' + (o.again ? "Close" : "Wonderful!") + "</button></div>";
    D.body.appendChild(ov);
    var btn = ov.querySelector("[data-close]"), card = ov.querySelector(".sl-ev-rv-card"), sk = ov.querySelector("[data-skipanim]"), endT = 0;
    // the opening plays once; "Skip animation" (or Enter / Space while it plays) jumps straight to the reward
    function settle() {
      clearTimeout(endT); if (!card.classList.contains("is-opening")) return;
      card.classList.remove("is-opening"); card.classList.add("is-settled");
      [].forEach.call(card.querySelectorAll(".sl-ev-rv-door, .sl-ev-rv-sparks"), function (x) { x.remove(); });
      if (sk) sk.remove();
      try { btn.focus({ preventScroll: true }); } catch (e) {}
    }
    if (sk) { sk.addEventListener("click", settle); endT = setTimeout(settle, 1900); try { sk.focus({ preventScroll: true }); } catch (e) {} }
    else try { btn.focus({ preventScroll: true }); } catch (e) {}
    function close() {
      clearTimeout(endT);
      ov.remove();
      if (!o.again && stats().complete && !EV.ls.get("sl-ev-legend-seen:" + ST.kind, 0)) { EV.ls.set("sl-ev-legend-seen:" + ST.kind, 1); legend(); }
    }
    btn.addEventListener("click", close);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
  }
  // a reserved door: a wrapped present, its reward still hidden
  function reserveCard(d, earnedSkip) {
    var ov = overlay("sl-ev-rsv", "Door " + d + " reserved");
    ov.innerHTML = '<div class="sl-ev-rv-card"><div class="sl-ev-rv-rays"></div><p class="k">Door ' + d + " · reserved</p>" +
      '<div class="sl-ev-rv-art sl-ev-present" aria-hidden="true">' + present(d) + "</div><h3>Door " + d + " is reserved!</h3>" +
      "<p>It already counts towards the 24 doors. Its reward stays wrapped until <b>" + esc(dayName(d)) + "</b> - come back then to unwrap it.</p>" +
      (earnedSkip ? '<div class="sl-ev-rv-extra">' + ic("flame", 28) + "<span><b>" + E.advent.streakForSkip + " in a row!</b><br>You earned a free skip.</span></div>" : "") +
      '<button type="button" class="sl-ev-btn pri" data-close>OK</button></div>';
    D.body.appendChild(ov);
    var b = ov.querySelector("[data-close]"); try { b.focus({ preventScroll: true }); } catch (e) {}
    function close() { ov.remove(); }
    b.addEventListener("click", close);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
  }
  function present(d) {
    return '<svg viewBox="0 0 100 100"><defs><linearGradient id="sl-ev-pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f8a57"/><stop offset="1" stop-color="#174A31"/></linearGradient></defs>' +
      '<rect x="16" y="40" width="68" height="50" rx="5" fill="url(#sl-ev-pg)"/><rect x="11" y="30" width="78" height="16" rx="4" fill="#2A7048"/>' +
      '<rect x="45" y="30" width="10" height="60" fill="#D9B66F"/><rect x="11" y="35" width="78" height="6" fill="#D9B66F" opacity=".85"/>' +
      '<path d="M50 30C38 14 22 18 28 28c3 5 14 3 22 2zM50 30C62 14 78 18 72 28c-3 5-14 3-22 2z" fill="#F0CC7A" stroke="#B8902F" stroke-width="1.5"/>' +
      '<circle cx="50" cy="30" r="5" fill="#D9B66F"/><text x="50" y="74" text-anchor="middle" font-family="Fraunces,serif" font-style="italic" font-weight="900" font-size="22" fill="#F5F5EA">' + d + "</text></svg>";
  }
  // the grand prize, shown once - the Legendary golden pop-up
  function legend() {
    var ov = overlay("sl-ev-legend", CFG.grandPrize.name);
    ov.innerHTML = '<div class="sl-ev-rv-card"><div class="sl-ev-rv-rays"></div>' + sparkles() + '<p class="k">All 24 doors · Grand prize · <span class="sl-ev-limited">Limited</span></p><div class="sl-ev-rv-art">' + EV.art.serpent("", "big") + "</div>" +
      "<h3>" + esc(CFG.grandPrize.name) + "</h3><p>" + esc(CFG.grandPrize.desc) + '</p><div class="sl-ev-rv-extra">' + ic("serpent", 28) + "<span><b>Legendary Serpent badge</b><br>Now in your collection.</span></div>" +
      '<button type="button" class="sl-ev-btn pri" data-close>Legendary!</button></div>';
    D.body.appendChild(ov);
    var b = ov.querySelector("[data-close]"); try { b.focus({ preventScroll: true }); } catch (e) {}
    b.addEventListener("click", function () { ov.remove(); });
    EV.emit("grand-prize");
  }

  /* ---------------- collection ---------------- */
  var SHOW = "sl-ev-cabin-show";
  function shown() { var s = EV.ls.get(SHOW, null); return Array.isArray(s) ? s : ["santa-sticker", "golden-egg", "legendary-serpent", "p-snowfall"]; }
  // a door's reward is yours once it is covered and, for a reserved door, once its day has come
  function have(d, now) { return !!ST.state.doors[d] && !L.reserved(E, ST.state, d, now); }
  function inventory() {
    var sub = EV.isSubscriber(), sh = shown(), out = [], now = EV.time.now();
    CFG.advent.forEach(function (r) { out.push({ id: r.id, name: r.name, kind: r.kind, day: r.day, owned: have(r.day, now), def: r }); });
    CFG.adventBonus.forEach(function (r) { var c = ST.state.doors[r.day]; out.push({ id: r.id, name: r.name, kind: r.kind || "Subscriber bonus", day: r.day, bonus: true, owned: have(r.day, now) && !!c && !!c.bonus, def: r }); });
    out.push({ id: CFG.grandPrize.id, name: CFG.grandPrize.name, kind: "Grand prize", grand: true, owned: L.stats(E, ST.state, now).complete });
    CFG.premium.forEach(function (r) { out.push({ id: r.id, name: r.name, kind: "Premium decoration", premium: true, owned: sub, def: r }); });
    out.forEach(function (x) { x.shown = x.owned && sh.indexOf(x.id) >= 0; });
    return out;
  }
  function invItem(x) {
    var art = x.grand ? EV.art.serpent(x.owned ? "" : "dim") : EV.art.item(x.def);
    return '<div class="sl-ev-item sl-ev-rbox' + (x.owned ? " is-done" : " locked is-locked") + (x.premium || x.bonus ? " prem" : "") + (x.grand ? " sl-ev-legendary" : "") + '">' + art + "<b>" + esc(x.name) + "</b><small>" +
      (x.owned ? esc(x.kind) : x.premium ? "Subscribers" : x.bonus ? "Door " + x.day + " · subscribers" : x.grand ? "All 24 doors" : "Door " + x.day) + "</small>" +
      (x.grand ? '<span class="sl-ev-limited">Limited</span>' : "") +
      (x.owned ? '<button type="button" class="show" data-show="' + x.id + '" aria-pressed="' + x.shown + '">' + (x.shown ? "In the Cabin" : "Show in Cabin") + "</button>" : "") + "</div>";
  }
  function invHtml() {
    var inv = inventory(), own = inv.filter(function (x) { return !x.premium && !x.bonus && x.owned; }).length;
    var bon = inv.filter(function (x) { return x.bonus; }), bown = bon.filter(function (x) { return x.owned; }).length;
    return (ST.kind === "test" ? EV.testBadge() : "") +
      '<p class="sl-ev-muted">Rewards stay yours for good. Choose up to 8 to show on the mantel in your Christmas Cabin.</p>' +
      '<h3 class="sl-ev-h3">Advent rewards <small>' + own + " / " + (CFG.advent.length + 1) + "</small></h3><div class=\"sl-ev-inv\">" + inv.filter(function (x) { return !x.premium && !x.bonus; }).map(invItem).join("") + "</div>" +
      '<h3 class="sl-ev-h3"><span>Subscriber bonus rewards <span class="sl-ev-prem">Subscribers</span></span><small>' + bown + " / " + bon.length + "</small></h3>" +
      '<p class="sl-ev-muted">Behind every door - three on special days. Kept for good when you were subscribed as the door was covered.</p>' +
      '<div class="sl-ev-inv">' + bon.map(invItem).join("") + "</div>" +
      '<h3 class="sl-ev-h3"><span>Premium decorations <span class="sl-ev-prem">Subscribers</span></span></h3>' +
      (EV.isSubscriber() ? "" : '<p class="sl-ev-muted">Subscriber-only decorations. Shown here so you know what they are - they are locked without a subscription.</p>') +
      '<div class="sl-ev-inv">' + inv.filter(function (x) { return x.premium; }).map(invItem).join("") + "</div>" +
      '<p class="sl-ev-muted" style="margin-top:10px">' + esc(CFG.subscription.afterExpiry) + "</p>";
  }
  var IP = null;
  function openInventory() {
    IP = EV.panel("sl-ev-inv", ic("gift", 18) + " My collection", invHtml(), { cls: "sl-ev-t-xmas sl-ev-xpanel", onClose: function () { IP = null; } });
    IP.addEventListener("click", function (e) {
      var b = e.target.closest("[data-show]"); if (!b) return;
      var id = b.getAttribute("data-show"), s = shown().slice(), i = s.indexOf(id);
      if (i >= 0) s.splice(i, 1); else { if (s.length >= 8) { EV.toast("The mantel holds 8 - take one off first."); return; } s.push(id); }
      EV.ls.set(SHOW, s); IP.querySelector(".sl-ev-body").innerHTML = invHtml(); paintCabin();
      // the decoration pops as it is placed (or taken off)
      var nb = IP.querySelector('[data-show="' + id + '"]'), card = nb && nb.closest(".sl-ev-item");
      if (card && !EV.reducedMotion()) { card.classList.add("sl-ev-popped"); setTimeout(function () { card.classList.remove("sl-ev-popped"); }, 500); }
    });
  }

  /* ---------------- the Cabin ---------------- */
  var CB = { bar: null, stage: null, auto: true };
  function cabinButton(bar) {
    if (!bar || bar.querySelector(".sl-ev-cabin-btn")) return;
    var b = D.createElement("button"); b.type = "button"; b.className = "xc-btn sl-ev-cabin-btn";
    b.innerHTML = ic("door", 20) + "<span>Advent Calendar<small class=\"xc-bsub\">" + N + " doors, one a day</small></span>";
    b.addEventListener("click", open);
    bar.insertBefore(b, bar.firstChild);
  }
  function paintCabin() {
    if (CB.bar) {
      cabinButton(CB.bar);
      var btn = CB.bar.querySelector(".sl-ev-cabin-btn"), now = EV.time.now(), t = now == null ? 0 : L.today(E, now);
      var waiting = t >= 1 && t <= N && (L.status(E, ST.state, t, now) === "open" || ready(t, now));
      var dot = btn.querySelector(".sl-ev-dot");
      if (waiting && !dot) { dot = D.createElement("i"); dot.className = "sl-ev-dot"; dot.setAttribute("aria-hidden", "true"); btn.appendChild(dot); btn.setAttribute("aria-label", "Advent Calendar - today's door is waiting"); }
      if (!waiting && dot) { dot.remove(); btn.removeAttribute("aria-label"); }
    }
    if (CB.stage) {
      var inv = inventory().filter(function (x) { return x.shown; });
      var sh = CB.stage.querySelector(".sl-ev-shelf");
      var key = inv.map(function (x) { return x.id; }).join(",");
      if (!sh) { sh = D.createElement("div"); sh.className = "sl-ev-shelf"; sh.setAttribute("aria-hidden", "true"); CB.stage.appendChild(sh); }
      if (sh._k !== key) {
        sh._k = key;
        sh.innerHTML = inv.filter(function (x) { return x.id !== "p-snowfall"; }).map(function (x) { return x.grand ? EV.art.serpent("serp") : EV.art.item(x.def); }).join("");
      }
      var snowOn = inv.some(function (x) { return x.id === "p-snowfall"; }) && !EV.reducedMotion(), sn = CB.stage.querySelector(".sl-ev-snow");
      if (snowOn && !sn) {
        sn = D.createElement("div"); sn.className = "sl-ev-snow"; sn.setAttribute("aria-hidden", "true");
        var h = ""; for (var i = 0; i < 40; i++) h += '<i style="left:' + (Math.random() * 100).toFixed(1) + "%;animation-duration:" + (6 + Math.random() * 8).toFixed(1) + "s;animation-delay:-" + (Math.random() * 12).toFixed(1) + "s;transform:scale(" + (.4 + Math.random() * .8).toFixed(2) + ')"></i>';
        sn.innerHTML = h; CB.stage.appendChild(sn);
      } else if (!snowOn && sn) sn.remove();
    }
  }
  EV.cabin = {
    // the Cabin helper can call this with its own elements (then the automatic lookup stops)
    mount: function (o) { CB.auto = false; CB.bar = o && o.bar || null; CB.stage = o && o.stage || null; paintCabin(); },
    refresh: paintCabin
  };
  var lastToday = -1;
  setInterval(function () {
    if (D.hidden) return;
    if (CB.auto) {
      var c = D.getElementById("xm-cabin");
      var bar = c && c.querySelector(".xc-bar"), stage = c && c.querySelector(".xc-stage");
      if (bar !== CB.bar || stage !== CB.stage) { CB.bar = bar; CB.stage = stage; }
    }
    if (CB.bar || CB.stage) paintCabin();
    // the countdown line inside the panel; a new day re-draws the doors (a reserved door's day may have come)
    if (P && P.isConnected) {
      var el = P.querySelector("[data-cd]"), now = EV.time.now();
      if (now != null) {
        var t = L.today(E, now), nx = t < 1 ? 1 : t + 1;
        if (el) el.textContent = cd(L.unlockAt(E, nx) - now);
        if (lastToday >= 0 && t !== lastToday) render();
        lastToday = t;
      }
    }
  }, 1000);

  /* ---------------- keeping in step ---------------- */
  function changed() { render(); paintCabin(); if (IP && IP.isConnected) IP.querySelector(".sl-ev-body").innerHTML = invHtml(); EV.emit("advent", ST.state); }
  EV.on("auth", function () { load(); });
  EV.on("mode", function () { load(); });
  EV.on("sub", function () { render(); paintCabin(); });
  EV.on("time", function () { render(); });
  load();

  EV.advent = { open: open, claim: claim, load: load, state: function () { return ST.state; }, kind: function () { return ST.kind; }, stats: stats,
                inventory: inventory, openInventory: openInventory, reasonText: reasonText, event: E };
})();
