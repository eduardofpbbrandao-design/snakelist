/* SnakeList events preview - the subscription page (a panel): benefits, price (configurable placeholder), billing
   period, renewal, cancellation, refund + EU/Portuguese withdrawal-right statement with the two express consents,
   the premium decorations (labelled, locked), the Anniversary promotion and - in the preview only - a TEST switch.
   There is NO payment backend yet: the Subscribe button never activates anything. A real subscription can only come
   from Firestore customers/{uid}/subscriptions, which only the Stripe extension can write (firebase/firestore.rules). */
(function () {
  "use strict";
  var EV = window.SL_EVENTS; if (!EV) return;
  var D = document, CFG = EV.cfg, SC = CFG.subscription, esc = EV.esc, ic = EV.art.icon;

  function money(v) { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: SC.currency }).format(v); } catch (e) { return "€" + v.toFixed(2); } }
  // December: the discount in % is the day of the month; rounded to whole cents (half up)
  EV.priceOn = function (t) {
    var d = new Date(t), p = SC.price, note = "";
    if (SC.decemberDayDiscount && d.getUTCMonth() === 11) { var day = d.getUTCDate(); p = Math.round(SC.price * (100 - day)) / 100; note = day + "% off today (December " + day + ")"; }
    return { price: Math.round(p * 100) / 100, note: note };
  };
  var ICONS = { early: "crown", deco: "gift", extra: "door", skips: "skip", cursor: "cursor", cosmetic: "spark" };
  function per() { return (SC.intervalCount > 1 ? SC.intervalCount + " " : "") + SC.interval + (SC.intervalCount > 1 ? "s" : ""); }
  function html() {
    var sub = EV.subscription(), now = EV.time.now(), pr = EV.priceOn(now == null ? EV.time.display() : now);
    var status = sub.real ? '<div class="sl-ev-note">' + ic("check", 14) + " <b>Your subscription is active.</b>" + (sub.periodEnd ? " Current period ends " + esc(EV.localTime(sub.periodEnd, { day: "numeric", month: "long", year: "numeric" })) + "." : "") + "</div>"
      : sub.test ? EV.testBadge() : "";
    var h = status +
      '<p class="sl-ev-kick">' + esc(SC.name) + "</p>" +
      '<div class="sl-ev-price"><b>' + esc(money(pr.price)) + '</b><span class="sl-ev-muted">/ ' + esc(per()) + "</span>" + (SC.priceStatus === "placeholder" ? ' <span class="sl-ev-lock">price not final</span>' : "") + "</div>" +
      (pr.note ? '<p class="sl-ev-muted">' + esc(pr.note) + " - in December the discount is the day of the month (1 December 1% … 31 December 31%).</p>" : "") +
      '<p class="sl-ev-muted">Billed every ' + esc(per()) + ". " + esc(SC.renewal) + "</p>" +
      '<div class="sl-ev-note warn"><b>Subscriptions are coming soon.</b> Payments aren’t switched on yet, so nothing can be bought and nothing is charged.</div>' +
      '<h3 class="sl-ev-h3">What you get</h3><ul class="sl-ev-ben">' + SC.benefits.map(function (b) {
        return "<li><span>" + ic(ICONS[b[0]] || "star") + "</span><span><b>" + esc(b[1]) + "</b><small>" + esc(b[2]) + "</small></span></li>";
      }).join("") + "</ul>" +
      '<p class="sl-ev-muted" style="margin-top:8px">' + ic("check", 13) + " " + esc(SC.alwaysFree) + "</p>" +
      '<h3 class="sl-ev-h3"><span>Premium decorations <span class="sl-ev-prem">Subscribers</span></span></h3><div class="sl-ev-inv">' + CFG.premium.map(function (p) {
        return '<div class="sl-ev-item prem' + (sub.active ? "" : " locked") + '">' + EV.art.item(p) + "<b>" + esc(p.name) + "</b><small>" + (sub.active ? "Unlocked" : ic("lock", 10) + " Subscribers") + "</small></div>";
      }).join("") + "</div>" +
      '<p class="sl-ev-muted" style="margin-top:8px">' + esc(SC.afterExpiry) + "</p>" +
      '<h3 class="sl-ev-h3">Cancelling</h3><p>' + esc(SC.cancellation) + "</p>" +
      '<h3 class="sl-ev-h3">' + esc(SC.refund.heading) + '</h3><div class="sl-ev-legal"><ul>' + SC.refund.lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>" +
      '<label class="sl-ev-check"><input type="checkbox" data-consent="start"> <span>' + esc(SC.refund.consentStart) + "</span></label>" +
      '<label class="sl-ev-check"><input type="checkbox" data-consent="lose"> <span>' + esc(SC.refund.consentLose) + "</span></label></div>" +
      '<button type="button" class="sl-ev-btn pri" data-act="buy" aria-disabled="true" style="width:100%;margin-top:6px">' + ic("lock") + "Subscriptions are coming soon</button>" +
      '<p class="sl-ev-muted" style="margin-top:6px">When payments are switched on you will see the final price, tax and billing period here before paying, and get a confirmation email with this information.</p>' +
      promoHtml() +
      '<h3 class="sl-ev-h3">Preview test switch</h3><div class="sl-ev-note"><div class="sl-ev-switch"><span><b>Pretend to be a subscriber</b><br><span class="sl-ev-muted">Test mode &mdash; not a real subscription. Only in this preview, only in this browser; it never changes your account, and test progress is kept apart.</span></span>' +
      '<button type="button" class="sl-ev-btn" data-act="test" aria-pressed="' + sub.test + '">' + (sub.test ? "On" : "Off") + "</button></div></div>";
    return h;
  }
  function promoHtml() {
    var ev = EV.event("anniversary2027"); if (!ev || !ev.promo) return "";
    var pm = ev.promo, now = EV.time.now(), inWin = now != null && now >= EV.ms(ev.start) && now < EV.ms(ev.end), before = now == null || now < EV.ms(ev.start);
    var claimed = EV.ls.get("sl-ev-promo:" + pm.id + ":" + ((EV.user() || {}).uid || "-"), 0);
    var btn = !EV.user() ? '<button type="button" class="sl-ev-btn" aria-disabled="true">Sign in to claim (once per account)</button>'
      : claimed ? '<button type="button" class="sl-ev-btn" aria-disabled="true">' + ic("check") + "Claimed</button>"
      : inWin ? '<button type="button" class="sl-ev-btn pri" data-act="promo">Claim ' + esc(pm.label) + "</button>"
      : '<button type="button" class="sl-ev-btn" aria-disabled="true">' + (before ? "Opens " + esc(EV.localTime(ev.start, { day: "numeric", month: "long", year: "numeric" })) : "This promotion has ended") + "</button>";
    return '<h3 class="sl-ev-h3">' + esc(ev.name) + '</h3><div class="sl-ev-note sl-ev-t-anniversary"><b>' + esc(pm.label) + "</b><br>" + esc(pm.disclosure) +
      (before && now != null ? '<br><span class="sl-ev-muted">Starts in <b data-promo-cd>' + left(EV.ms(ev.start) - now) + "</b></span>" : "") + '<div class="sl-ev-row">' + btn + "</div></div>";
  }
  function left(ms) { var d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4); return d + "d " + h + "h " + m + "m"; }
  var P = null;
  function open() {
    P = EV.panel("sl-ev-sub", ic("crown", 18) + " Subscription", html(), { onClose: function () { P = null; } });
    P.addEventListener("click", function (e) {
      var a = e.target.closest("[data-act]"); if (!a) return;
      var w = a.getAttribute("data-act");
      if (w === "buy") {
        // never a fake activation
        var c = P.querySelectorAll("[data-consent]:checked").length;
        EV.toast(c < 2 ? "Before subscribing you would need to tick both boxes above. Subscriptions are coming soon - nothing was charged." : "Subscriptions are coming soon - nothing was charged and nothing was activated.");
      }
      if (w === "test") { EV.setTestMode(!EV.testMode()); render(); }
      if (w === "promo") claimPromo();
    });
    return P;
  }
  function render() { if (P && P.isConnected) { var b = P.querySelector(".sl-ev-body"), y = b.scrollTop; b.innerHTML = html(); b.scrollTop = y; } }
  function claimPromo() {
    var ev = EV.event("anniversary2027"), pm = ev.promo, u = EV.user(); if (!u) return;
    EV.db().then(function (db) {
      return db.collection("promoClaims").doc(u.uid).collection("promos").doc(pm.id).set({ promo: pm.id, at: EV.serverTimestamp(), paidAfter: false });
    }).then(function () {
      EV.ls.set("sl-ev-promo:" + pm.id + ":" + u.uid, 1); render();
      EV.toast("Claimed! (The free period itself is applied by the payment system, which isn't set up yet.)");
    }, function (e) { EV.toast(e && e.code === "permission-denied" ? "This promotion can only be claimed once per account, during the anniversary week." : "Couldn't claim it - please try again."); });
  }
  EV.on("sub", render);
  setInterval(function () { if (P && P.isConnected) { var el = P.querySelector("[data-promo-cd]"), ev = EV.event("anniversary2027"), now = EV.time.now(); if (el && now != null) el.textContent = left(EV.ms(ev.start) - now); } }, 30000);
  EV.subscribe = { open: open, priceOn: EV.priceOn };
})();
