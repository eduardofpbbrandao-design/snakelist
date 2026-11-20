// v5.78: every button, the same hover: the 3D viewer's Open mouth / See it eat colours (CSS above, class sl-hov) and a thin
// light mint line that travels once round its border over 1.5 s, then fades (on hover, on a tap and on keyboard focus).
// One SVG over the whole page, moved with the button - nothing is added inside the buttons, so their own layout, ::before/::after
// and positions stay exactly as they were. Reduced motion: the line just fades in and out where it is, without travelling.
(function () {
  if (window.__slFx || !document.addEventListener) return; window.__slFx = true;
  var SEL = 'button, [role="button"], input[type="button"], input[type="submit"], a[class*="btn"], a.btn, a.chip, .chip, .sp-tags a, .sp-pills a, .sx-chips a';
  var RM = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var svg = null, rect = null, cur = null, anim = null, fade = null, raf = 0, hov = null;
  function looksLikeButton(el) {
    if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return false;
    var r = el.getBoundingClientRect(); if (r.width < 14 || r.height < 14 || r.width > 640 || r.height > 140) return false;
    var cs = getComputedStyle(el);
    if (/url\(/.test(cs.backgroundImage)) return false; // a photo you can tap, not a button
    var bg = cs.backgroundColor, m = /rgba?\(([^)]+)\)/.exec(bg), a = m ? (m[1].split(",")[3] === undefined ? 1 : parseFloat(m[1].split(",")[3])) : 0;
    var bw = parseFloat(cs.borderTopWidth) || 0;
    return a > 0.04 || (bw > 0 && cs.borderTopStyle !== "none" && !/rgba\([^)]*,\s*0\)/.test(cs.borderTopColor)) || /gradient/.test(cs.backgroundImage);
  }
  function target(e) { var t = e.target; if (!t || !t.closest) return null; var b = t.closest(SEL); return b && looksLikeButton(b) ? b : null; }
  function ensure() {
    if (svg && svg.isConnected) return;
    var NS = "http://www.w3.org/2000/svg"; svg = document.createElementNS(NS, "svg"); svg.setAttribute("class", "sl-trace"); svg.setAttribute("aria-hidden", "true");
    rect = document.createElementNS(NS, "rect"); rect.setAttribute("pathLength", "100"); svg.appendChild(rect); document.body.appendChild(svg);
  }
  function place() {
    if (!cur || !cur.isConnected) return false;
    var r = cur.getBoundingClientRect(); if (!r.width) return false;
    var cs = getComputedStyle(cur), rad = parseFloat(cs.borderTopLeftRadius) || 0;
    if (/%/.test(cs.borderTopLeftRadius)) rad = Math.min(r.width, r.height) * parseFloat(cs.borderTopLeftRadius) / 100;
    var w = r.width, h = r.height; rad = Math.min(rad, w / 2, h / 2);
    svg.style.transform = "translate(" + r.left + "px," + r.top + "px)"; svg.setAttribute("width", w); svg.setAttribute("height", h);
    rect.setAttribute("x", 0.8); rect.setAttribute("y", 0.8); rect.setAttribute("width", Math.max(0, w - 1.6)); rect.setAttribute("height", Math.max(0, h - 1.6));
    rect.setAttribute("rx", Math.max(0, rad - 0.8)); rect.setAttribute("ry", Math.max(0, rad - 0.8));
    return true;
  }
  function follow() { raf = 0; if (!cur) return; if (!place()) { stop(); return; } raf = requestAnimationFrame(follow); }
  function stop() { if (anim) anim.cancel(); if (fade) fade.cancel(); anim = fade = null; if (raf) cancelAnimationFrame(raf); raf = 0; cur = null; if (svg) svg.style.opacity = "0"; }
  function trace(el) {
    if (!el.animate) return;
    stop(); ensure(); cur = el; if (!place()) return;
    var still = RM.matches;
    // a bright segment a third of the way round, travelling once round the border
    rect.setAttribute("stroke-dasharray", still ? "100 0" : "34 66");
    if (!still) anim = rect.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -100 }], { duration: 1500, easing: "cubic-bezier(.45,.05,.4,1)", fill: "forwards" });
    fade = svg.animate(still ? [{ opacity: 0 }, { opacity: 0.9, offset: 0.25 }, { opacity: 0.9, offset: 0.6 }, { opacity: 0 }]
      : [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.72 }, { opacity: 0 }], { duration: still ? 1200 : 1950, easing: "ease-in-out", fill: "forwards" });
    fade.onfinish = function () { if (cur === el) stop(); };
    raf = requestAnimationFrame(follow);
  }
  function setHov(el) {
    if (hov === el) return;
    if (hov) hov.classList.remove("sl-hov", "sl-hov-nb");
    hov = el;
    if (el) { var cs = getComputedStyle(el); el.classList.add("sl-hov"); if (!(parseFloat(cs.borderTopWidth) > 0) || cs.borderTopStyle === "none") el.classList.add("sl-hov-nb"); }
  }
  var canHover = window.matchMedia ? window.matchMedia("(hover: hover)") : { matches: true };
  document.addEventListener("pointerover", function (e) {
    if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    var b = target(e);
    if (b && b === hov) return;
    setHov(b);
    if (b) trace(b);
  }, true);
  document.addEventListener("pointerout", function (e) {
    if (!hov) return; var to = e.relatedTarget;
    if (!to || !hov.contains(to)) setHov(null);
  }, true);
  // a tap (phones, tablets): the line runs round the tapped button
  document.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") return; var b = target(e); if (b) trace(b); }, true);
  // the keyboard: the button you Tab to
  document.addEventListener("focusin", function (e) { var t = e.target; try { if (!t.matches || !t.matches(":focus-visible")) return; } catch (x) { return; } var b = t.closest && t.closest(SEL); if (b && looksLikeButton(b)) trace(b); }, true);
  // a button that goes away or is replaced (menus closing) never leaves the line or the colours behind
  window.addEventListener("blur", function () { setHov(null); });
  document.addEventListener("visibilitychange", function () { if (document.hidden) { setHov(null); stop(); } });
})();
