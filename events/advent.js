/* SnakeList events preview - the Advent Calendar (Christmas 2026): 24 doors in the Christmas Cabin.
   Where progress is kept:
     signed in  -> Firestore eventProgress/{uid}/events/xmas2026 (+ /doors/{n}); the server stamps each door with
                   its own time and firebase/firestore.rules refuse future doors, duplicates, made-up skips.
     signed out -> this browser only, clearly labelled "Sign in to save your Advent Calendar"; still opened only
                   with the server's time (EV.time), never the device clock.
     TEST mode  -> (preview only) a separate local copy, so trying subscriber skips never touches the real calendar.
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
  var REWARD = {}; CFG.advent.forEach(function (r) { REWARD[r.day] = r; });
  var BONUS = {}; CFG.adventBonus.forEach(function (r) { BONUS[r.day] = r; });
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
      res[1].forEach(function (d) { var x = d.data(); doors[x.day] = { at: tsMs(x.at), via: x.via, run: x.run }; });
      ST.state = L.norm({ doors: doors, earned: s.earned, earnedUsed: s.earnedUsed, subUsed: s.subUsed });
      ST.loaded = true; changed(); return ST.state;
    }).catch(function (e) { ST.err = "Couldn't load your Advent Calendar from your account (" + (e.code || e.message) + ")."; ST.loaded = true; changed(); return ST.state; });
  }
  function reasonText(r) {
    return {
      "no-trusted-time": "Couldn't check the time with the SnakeList server - doors only open with the server's time. Check your connection and try again.",
      "already-claimed": "This door is already open.", "future": "No peeking! This door opens on its own day.",
      "event-over": "The Advent Calendar has closed.", "missed-needs-skip": "This day has passed - use a skip to recover it.",
      "not-missed": "Skips can only recover days that have already passed.", "open-today": "Today's door is open - just open it, no skip needed.", "no-earned-skips": "You have no free skips left. Open 3 days in a row to earn one.",
      "not-subscriber": "Subscriber skips are a subscriber benefit.", "subscriber-skip-cap": "You've used all 10 subscriber skips for this event.",
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
      // fresh from the server first, so the counters we send are the server's
      return Promise.all([r.sum.get(), r.doors.doc(String(day - 1)).get()]).then(function (res) {
        var s = res[0].exists ? res[0].data() : { earned: 0, earnedUsed: 0, subUsed: 0, claimed: 0 };
        // the streak counts only doors opened on their own day: a skip's door has run 0 and earns nothing
        var pv = res[1].exists ? res[1].data() : null, run = via !== "day" ? 0 : pv && pv.via === "day" ? pv.run + 1 : 1, TS = EV.serverTimestamp();
        var b = db.batch();
        b.set(r.doors.doc(String(day)), { day: day, at: TS, via: via, run: run });
        b.set(r.sum, { earned: (s.earned || 0) + (via === "day" && run % E.advent.streakForSkip === 0 ? 1 : 0), earnedUsed: (s.earnedUsed || 0) + (via === "skip" ? 1 : 0),
                       subUsed: (s.subUsed || 0) + (via === "sub" ? 1 : 0), claimed: (s.claimed || 0) + 1, last: day, at: TS });
        return b.commit();
      });
    }).then(function () { ST.busy = false; return load(); }).then(function (s) {
      return { state: s, day: day, via: via, earnedSkip: s.earned > before };
    }, function (e) {
      ST.busy = false; var rr = (e && e.code === "permission-denied") ? "permission-denied" : e.reason || e.code || "error";
      throw Object.assign(new Error(rr), { reason: rr });
    });
  }

  /* ---------------- the panel ---------------- */
  var P = null;
  function stats() { return L.stats(E, ST.state); }
  function modeNote() {
    if (ST.kind === "test") return EV.testBadge() + '<p class="sl-ev-muted">Test progress is kept apart from your real calendar, in this browser only.</p>';
    if (ST.kind === "local") return '<div class="sl-ev-note warn"><b>Sign in to save your Advent Calendar.</b> Until then, the doors you open are kept on this device only. ' +
      '<button type="button" class="sl-ev-btn" data-act="signin" style="min-height:30px;padding:4px 10px;margin-top:6px">Sign in</button></div>';
    var local = L.norm(EV.ls.get(lsKey("local"), null)).claimed;
    return '<p class="sl-ev-muted">' + ic("check", 13) + " Saved to your SnakeList account. Every door is checked against the server's clock." +
      (local ? " (" + local + " door" + (local === 1 ? "" : "s") + " opened on this device while signed out stay on this device - they couldn't be checked by the server.)" : "") + "</p>";
  }
  function statsHtml() {
    var now = EV.time.now(), sk = L.skipsLeft(E, ST.state), str = now == null ? 0 : L.streak(E, ST.state, now), nx = now == null ? { have: 0, need: 3 } : L.toNextSkip(E, ST.state, now);
    var dots = ""; for (var i = 0; i < nx.need; i++) dots += '<i class="' + (i < nx.have ? "on" : "") + '"></i>';
    var sub = EV.isSubscriber();
    return '<div class="sl-ev-adv-stats">' +
      '<div class="sl-ev-stat" title="Doors in a row, each opened on its own day"><small>Streak</small><b data-stat="streak">' + str + " day" + (str === 1 ? "" : "s") + '</b><span class="dots" aria-hidden="true">' + dots + '</span><span class="sl-ev-muted" style="font-size:10.5px">' + (nx.need - nx.have) + " more to a free skip</span></div>" +
      '<div class="sl-ev-stat"><small>Free skips</small><b data-stat="earned">' + sk.earned + '</b><span class="sl-ev-muted" style="font-size:10.5px">earned ' + sk.earnedTotal + "</span></div>" +
      '<div class="sl-ev-stat"><small>Subscriber skips</small>' + (sub ? '<b data-stat="sub">' + sk.sub + " / " + E.advent.subscriberSkips + "</b>" : '<b style="font-size:13px;margin-top:3px"><span class="sl-ev-lock">' + ic("lock", 11) + " Subscribers</span></b>") + "</div></div>";
  }
  function clockLine() {
    var now = EV.time.now();
    if (now == null) return EV.time.failed() ? '<p class="sl-ev-clockline">' + ic("clock", 14) + " Couldn't check the time with the server - doors stay shut until it can.</p>" : '<p class="sl-ev-clockline">' + ic("clock", 14) + " Checking the time…</p>";
    var t = L.today(E, now);
    if (t < 1) return '<p class="sl-ev-clockline">' + ic("clock", 14) + " Door 1 opens <b>" + esc(EV.localTime(E.advent.firstDoor)) + "</b> (<b data-cd>" + cd(L.unlockAt(E, 1) - now) + "</b>)</p>";
    if (now >= L.closesAt(E)) return '<p class="sl-ev-clockline">The Advent Calendar has closed. Thank you for taking part!</p>';
    if (t < E.advent.days) return '<p class="sl-ev-clockline">' + ic("clock", 14) + " Door " + (t + 1) + " opens in <b data-cd>" + cd(L.unlockAt(E, t + 1) - now) + "</b></p>";
    return '<p class="sl-ev-clockline">All 24 doors are open. Missed days can be recovered with skips until <b>' + esc(EV.localTime(E.advent.recoverUntil, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })) + "</b>.</p>";
  }
  function cd(ms) { ms = Math.max(0, ms); var h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3); return h + "h " + (m < 10 ? "0" : "") + m + "m " + (s < 10 ? "0" : "") + s + "s"; }
  function doorsHtml() {
    var now = EV.time.now();
    return '<div class="sl-ev-cal"><div class="sl-ev-doors" role="list">' + ORDER.map(function (d) {
      var st = L.status(E, ST.state, d, now), r = REWARD[d], c = ST.state.doors[d], early = st === "locked" && L.skipTarget(E, ST.state, d, now) === "early";
      var lab = "Door " + d + ": " + (st === "claimed" ? r.name + (c.via === "skip" ? " (opened with a free skip)" : c.via === "sub" ? " (opened with a subscriber skip)" : " (opened on its day)") :
        st === "open" ? "open today - open it!" : st === "missed" ? "missed - can be recovered with a skip" : st === "closed" ? "closed" :
        "opens " + EV.localTime(L.unlockAt(E, d), { day: "numeric", month: "long" }) + (early ? " (or now, with a skip)" : ""));
      var word = st === "open" ? "Open today" : st === "missed" ? "Missed" : "";
      return '<button type="button" role="listitem" class="sl-ev-door is-' + st + (c ? " via-" + c.via : "") + (early ? " can-early" : "") + '" data-day="' + d + '" aria-label="' + esc(lab) + '" title="' + esc(lab) + '">' +
        (word ? '<span class="st" aria-hidden="true">' + word + "</span>" : "") +
        (st === "claimed" ? '<span class="inside">' + EV.art.item(r) + "</span>" : "") +
        '<span class="leaf"><b>' + d + "</b>" + (st === "locked" ? '<span class="ic">' + ic("lock", 12) + "</span>" : "") + "</span>" +
        (st === "claimed" ? '<span class="tag">' + d + "</span>" : "") + "</button>";
    }).join("") + "</div></div>";
  }
  function grandHtml() {
    var n = ST.state.claimed, won = n >= E.advent.days;
    return '<div class="sl-ev-grand' + (won ? " won" : "") + '">' + EV.art.serpent(won ? "" : "dim") + '<div style="flex:1;min-width:0"><b>' + esc(CFG.grandPrize.name) + '</b><span class="sl-ev-muted" style="' + (won ? "color:#4a3500" : "") + '">' +
      (won ? "Unlocked! It's in your collection and can sit in your Cabin." : "Open all 24 doors - doors opened with a skip count too: " + n + " / 24 · " + (24 - n) + " to go") + "</span>" +
      '<span class="sl-abar" role="progressbar" aria-valuemin="0" aria-valuemax="24" aria-valuenow="' + n + '"><i style="width:' + Math.round(n / 24 * 100) + '%"></i></span></div></div>';
  }
  function html() {
    if (!ST.loaded) return '<p class="sl-ev-muted">Loading your Advent Calendar…</p>';
    return modeNote() + (ST.err ? '<div class="sl-ev-note warn">' + esc(ST.err) + "</div>" : "") + statsHtml() +
      '<p class="sl-ev-rule">' + ic("flame", 13) + " <span><b>Streak:</b> doors opened on their own day, in a row. Every " + E.advent.streakForSkip + " in a row earn a free skip. A door opened with a skip counts towards the 24 doors and the grand prize, but not towards the streak.</span></p>" +
      clockLine() + doorsHtml() +
      '<div class="sl-ev-skip" data-skip hidden></div>' + grandHtml() +
      '<div class="sl-ev-row"><button type="button" class="sl-ev-btn" data-act="inv">' + ic("gift") + 'My collection</button><button type="button" class="sl-ev-btn" data-act="sub">' + ic("crown") + "Subscriber benefits</button></div>" +
      '<p class="sl-ev-muted">Each door can be opened once. On its own day it simply opens. A skip covers one door you choose - a day you missed' + (E.advent.skipCanClaimFuture ? ", or an upcoming day opened early" : " (never a future one)") +
      " - and you'll always see what it does before it is used. Subscribers also get up to " + E.advent.subscriberSkips + " subscriber skips per event, counted separately from the free ones.</p>";
  }
  function render() {
    if (!P || !P.isConnected) return;
    var body = P.querySelector(".sl-ev-body"), sk = body.querySelector("[data-skip]"), openSkip = sk && !sk.hidden ? +sk.getAttribute("data-day") : null, y = body.scrollTop;
    body.innerHTML = html(); body.scrollTop = y;
    // keep the "recover with a skip" box only while that door is still missed
    if (openSkip && L.skipTarget(E, ST.state, openSkip, EV.time.now())) showSkip(openSkip);
  }
  function open() {
    if (!ST.loaded || ST.kind !== kind()) load();
    P = EV.panel("sl-ev-adv", ic("door", 18) + " Advent Calendar", html(), { cls: "sl-ev-t-xmas", onClose: function () { P = null; } });
    P.addEventListener("click", onClick);
    return P;
  }
  function onClick(e) {
    var a = e.target.closest("[data-act]");
    if (a) {
      var w = a.getAttribute("data-act");
      if (w === "signin") { var b = D.querySelector(".auth-btn, #auth-btn"); P.close(); if (b) b.click(); }
      if (w === "inv") openInventory();
      if (w === "sub" && EV.subscribe) EV.subscribe.open();
      if (w === "skip" || w === "subskip") doClaim(+a.getAttribute("data-day"), w === "skip" ? "skip" : "sub");
      if (w === "noskip") { var s = P.querySelector("[data-skip]"); if (s) s.hidden = true; }
      return;
    }
    var dEl = e.target.closest(".sl-ev-door"); if (!dEl) return;
    var d = +dEl.getAttribute("data-day"), st = L.status(E, ST.state, d, EV.time.now());
    if (st === "claimed") reveal(d, { again: true });
    else if (st === "open") doClaim(d, "day");
    else if (st === "missed" || L.skipTarget(E, ST.state, d, EV.time.now()) === "early") showSkip(d);
    else if (st === "closed") EV.toast("The Advent Calendar has closed.");
    else EV.toast(EV.time.now() == null ? reasonText("no-trusted-time") : "No peeking! Door " + d + " opens " + esc(EV.localTime(L.unlockAt(E, d))) + ".");
  }
  // the skip box: says exactly what one skip will do BEFORE it is spent (a missed day, or an upcoming day early)
  function showSkip(d) {
    var s = P && P.querySelector("[data-skip]"); if (!s) return;
    var now = EV.time.now(), tg = L.skipTarget(E, ST.state, d, now); if (!tg) return;
    var sk = L.skipsLeft(E, ST.state), sub = EV.isSubscriber(), when = esc(EV.localTime(L.unlockAt(E, d), { weekday: "long", day: "numeric", month: "long" }));
    var str = L.streak(E, ST.state, now);
    s.hidden = false; s.setAttribute("data-day", d);
    var head = tg === "missed"
      ? "<b>Door " + d + " was missed</b> (" + when + "). One skip recovers it now."
      : "<b>Door " + d + " opens on " + when + ".</b> One skip opens it now, early.";
    var what = '<ul class="sl-ev-skipwhat"><li>' + ic("check", 12) + "<span>It counts towards the 24 doors and " + esc(CFG.grandPrize.name) + ".</span></li>" +
      "<li>" + ic("flame", 12) + "<span>It does <b>not</b> count as a visit for your streak - only doors opened on their own day do." +
      (tg === "early" && str > 0 ? " On " + when + " there will be no door left to open, so your " + str + "-day streak will end then." : "") + "</span></li>" +
      "<li>" + ic("skip", 12) + "<span>It uses one skip and can't be undone.</span></li></ul>";
    s.innerHTML = '<div class="sl-ev-note">' + head + what +
      '<div class="sl-ev-row"><button type="button" class="sl-ev-btn pri" data-act="skip" data-day="' + d + '"' + (sk.earned ? "" : " disabled") + ">" + ic("skip") + "Use a free skip on door " + d + " (" + sk.earned + " left)</button>" +
      '<button type="button" class="sl-ev-btn" data-act="subskip" data-day="' + d + '"' + (sub && sk.sub ? "" : " disabled") + ">" + ic("crown") + (sub ? "Use a subscriber skip (" + sk.sub + " left)" : "Subscriber skip (subscribers)") + "</button></div>" +
      (sk.earned ? "" : '<p class="sl-ev-muted" style="margin:0">No free skips yet: open ' + E.advent.streakForSkip + " doors in a row, each on its own day, to earn one.</p>") +
      '<button type="button" class="sl-ev-btn" data-act="noskip" style="min-height:28px;padding:3px 10px">Not now</button></div>';
    try { s.scrollIntoView({ block: "nearest" }); } catch (e) {}
  }
  function doClaim(d, via) {
    claim(d, via).then(function (r) {
      render(); reveal(d, { earnedSkip: r.earnedSkip, via: via });
      EV.emit("advent-claim", r);
    }, function (e) { if (e.reason !== "busy") EV.toast(esc(reasonText(e.reason))); render(); });
  }

  /* ---------------- the reveal ---------------- */
  function reveal(d, o) {
    o = o || {};
    var r = REWARD[d], c = ST.state.doors[d], bn = BONUS[d], sub = EV.isSubscriber();
    var ov = D.createElement("div"); ov.className = "sl-ev-reveal"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Door " + d + ": " + r.name);
    var extra = "";
    if (o.earnedSkip) extra += '<div class="sl-ev-rv-extra">' + ic("flame", 28) + "<span><b>" + E.advent.streakForSkip + " days in a row!</b><br>You earned a free skip.</span></div>";
    if (bn) extra += '<div class="sl-ev-rv-extra">' + EV.art.item(bn) + "<span>" + (sub ? "<b>Subscriber bonus:</b> " + esc(bn.name) : '<span class="sl-ev-prem">Subscribers</span> ' + esc(bn.name) + " is behind this door for subscribers.") + "</span></div>";
    var how = c ? (c.via === "day" ? "Opened on its day" : c.via === "skip" ? "Recovered with a free skip" : "Recovered with a subscriber skip") + (c.at ? " · " + new Date(c.at).toLocaleDateString(undefined, { day: "numeric", month: "long" }) : "") : "";
    ov.innerHTML = '<div class="sl-ev-rv-card">' + (o.again || EV.reducedMotion() ? "" : '<div class="sl-ev-rv-door"><b>' + d + "</b></div>") + '<div class="sl-ev-rv-rays"></div>' +
      '<p class="k">Door ' + d + " · " + esc(r.kind) + '</p><div class="sl-ev-rv-art' + (r.glow ? " glow" : "") + '">' + EV.art.item(r, true) + "</div><h3>" + esc(r.name) + "</h3><p>" + esc(r.desc) + "</p>" +
      '<p style="opacity:.75;font-size:12px">' + (o.again ? esc(how) : "Added to your collection for good") + "</p>" + extra +
      '<button type="button" class="sl-ev-btn pri" data-close>' + (o.again ? "Close" : "Wonderful!") + "</button></div>";
    D.body.appendChild(ov);
    var btn = ov.querySelector("[data-close]"); try { btn.focus({ preventScroll: true }); } catch (e) {}
    function close() {
      ov.remove();
      if (!o.again && ST.state.claimed >= E.advent.days && !EV.ls.get("sl-ev-legend-seen:" + ST.kind, 0)) { EV.ls.set("sl-ev-legend-seen:" + ST.kind, 1); legend(); }
    }
    btn.addEventListener("click", close);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
  }
  // the grand prize, shown once
  function legend() {
    var ov = D.createElement("div"); ov.className = "sl-ev-reveal sl-ev-legend"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", CFG.grandPrize.name);
    ov.innerHTML = '<div class="sl-ev-rv-card"><div class="sl-ev-rv-rays"></div><p class="k">All 24 doors · Grand prize</p><div class="sl-ev-rv-art">' + EV.art.serpent() + "</div>" +
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
  function inventory() {
    var sub = EV.isSubscriber(), sh = shown(), out = [];
    CFG.advent.forEach(function (r) { out.push({ id: r.id, name: r.name, kind: r.kind, day: r.day, owned: !!ST.state.doors[r.day], def: r }); });
    CFG.adventBonus.forEach(function (r) { out.push({ id: r.id, name: r.name, kind: "Frost Edition", day: r.day, bonus: true, owned: !!ST.state.doors[r.day] && sub, def: r }); });
    out.push({ id: CFG.grandPrize.id, name: CFG.grandPrize.name, kind: "Grand prize", grand: true, owned: ST.state.claimed >= E.advent.days });
    CFG.premium.forEach(function (r) { out.push({ id: r.id, name: r.name, kind: "Premium decoration", premium: true, owned: sub, def: r }); });
    out.forEach(function (x) { x.shown = x.owned && sh.indexOf(x.id) >= 0; });
    return out;
  }
  function invItem(x) {
    var art = x.grand ? EV.art.serpent() : EV.art.item(x.def);
    return '<div class="sl-ev-item' + (x.owned ? "" : " locked") + (x.premium || x.bonus ? " prem" : "") + '">' + art + "<b>" + esc(x.name) + "</b><small>" +
      (x.owned ? esc(x.kind) : x.premium || x.bonus ? "Subscribers" : x.grand ? "All 24 doors" : "Door " + x.day) + "</small>" +
      (x.owned ? '<button type="button" class="show" data-show="' + x.id + '" aria-pressed="' + x.shown + '">' + (x.shown ? "In the Cabin" : "Show in Cabin") + "</button>" : "") + "</div>";
  }
  function invHtml() {
    var inv = inventory(), own = inv.filter(function (x) { return !x.premium && !x.bonus && x.owned; }).length;
    return (ST.kind === "test" ? EV.testBadge() : "") +
      '<p class="sl-ev-muted">Rewards stay yours for good. Choose up to 8 to show on the mantel in your Christmas Cabin.</p>' +
      '<h3 class="sl-ev-h3">Advent rewards <small>' + own + " / 25</small></h3><div class=\"sl-ev-inv\">" + inv.filter(function (x) { return !x.premium && !x.bonus; }).map(invItem).join("") + "</div>" +
      '<h3 class="sl-ev-h3"><span>Premium decorations <span class="sl-ev-prem">Subscribers</span></span></h3>' +
      (EV.isSubscriber() ? "" : '<p class="sl-ev-muted">Subscriber-only decorations. Shown here so you know what they are - they are locked without a subscription.</p>') +
      '<div class="sl-ev-inv">' + inv.filter(function (x) { return x.premium || x.bonus; }).map(invItem).join("") + "</div>" +
      '<p class="sl-ev-muted" style="margin-top:10px">' + esc(CFG.subscription.afterExpiry) + "</p>";
  }
  var IP = null;
  function openInventory() {
    IP = EV.panel("sl-ev-inv", ic("gift", 18) + " My collection", invHtml(), { onClose: function () { IP = null; } });
    IP.addEventListener("click", function (e) {
      var b = e.target.closest("[data-show]"); if (!b) return;
      var id = b.getAttribute("data-show"), s = shown().slice(), i = s.indexOf(id);
      if (i >= 0) s.splice(i, 1); else { if (s.length >= 8) { EV.toast("The mantel holds 8 - take one off first."); return; } s.push(id); }
      EV.ls.set(SHOW, s); IP.querySelector(".sl-ev-body").innerHTML = invHtml(); paintCabin();
    });
  }

  /* ---------------- the Cabin ---------------- */
  var CB = { bar: null, stage: null, auto: true };
  function cabinButton(bar) {
    if (!bar || bar.querySelector(".sl-ev-cabin-btn")) return;
    var b = D.createElement("button"); b.type = "button"; b.className = "xc-btn sl-ev-cabin-btn";
    b.innerHTML = ic("door", 20) + "<span>Advent Calendar</span>";
    b.addEventListener("click", open);
    bar.insertBefore(b, bar.firstChild);
  }
  function paintCabin() {
    if (CB.bar) {
      cabinButton(CB.bar);
      var btn = CB.bar.querySelector(".sl-ev-cabin-btn"), now = EV.time.now(), t = now == null ? 0 : L.today(E, now);
      var waiting = t >= 1 && t <= E.advent.days && L.status(E, ST.state, t, now) === "open";
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
  setInterval(function () {
    if (D.hidden) return;
    if (CB.auto) {
      var c = D.getElementById("xm-cabin");
      var bar = c && c.querySelector(".xc-bar"), stage = c && c.querySelector(".xc-stage");
      if (bar !== CB.bar || stage !== CB.stage) { CB.bar = bar; CB.stage = stage; }
    }
    if (CB.bar || CB.stage) paintCabin();
    // the countdown line inside the panel
    if (P && P.isConnected) { var el = P.querySelector("[data-cd]"), now = EV.time.now(); if (el && now != null) { var t = L.today(E, now), nx = t < 1 ? 1 : t + 1; el.textContent = cd(L.unlockAt(E, nx) - now); if (L.unlockAt(E, nx) - now <= 0) render(); } }
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
