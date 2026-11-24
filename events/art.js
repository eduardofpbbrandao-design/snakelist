/* SnakeList events preview - artwork, drawn as SVG (no image files). The SnakeList S on the rewards is the page's
   own logo symbol (#mark-snake), so every reward carries the real mark. */
(function () {
  "use strict";
  var EV = window.SL_EVENTS; if (!EV) return;
  var uid = 0;
  function id(p) { return p + "-" + (++uid); }
  var M = EV.mark;
  /* the Santa hat on the S's head (written by tools/build-christmas.py from tools/christmas_art.py - edit it there) */
  var XHAT = /*XM-HAT*/"<g transform=\"translate(-5 -15.4) rotate(-10) scale(0.4000 0.4000)\"><defs><linearGradient id=\"evh-r\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\".18\"><stop offset=\"0\" stop-color=\"#e24a5a\"/><stop offset=\".38\" stop-color=\"#c62c40\"/><stop offset=\".78\" stop-color=\"#8f1627\"/><stop offset=\"1\" stop-color=\"#6c0e1c\"/></linearGradient><linearGradient id=\"evh-d\" x1=\"0\" y1=\"0\" x2=\".25\" y2=\"1\"><stop offset=\"0\" stop-color=\"#d23a4c\"/><stop offset=\".5\" stop-color=\"#a51d31\"/><stop offset=\"1\" stop-color=\"#6a0d1b\"/></linearGradient><radialGradient id=\"evh-s\" cx=\".3\" cy=\".3\" r=\".55\"><stop offset=\"0\" stop-color=\"#ff9aa4\" stop-opacity=\".5\"/><stop offset=\"1\" stop-color=\"#ff9aa4\" stop-opacity=\"0\"/></radialGradient><linearGradient id=\"evh-f\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#ffffff\"/><stop offset=\".45\" stop-color=\"#f8f4ee\"/><stop offset=\"1\" stop-color=\"#d2c9ba\"/></linearGradient><linearGradient id=\"evh-e\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"0\"><stop offset=\"0\" stop-color=\"#8a7c68\" stop-opacity=\".5\"/><stop offset=\".22\" stop-color=\"#8a7c68\" stop-opacity=\"0\"/><stop offset=\".72\" stop-color=\"#8a7c68\" stop-opacity=\"0\"/><stop offset=\"1\" stop-color=\"#6e604e\" stop-opacity=\".55\"/></linearGradient><radialGradient id=\"evh-p\" cx=\".38\" cy=\".32\" r=\".72\"><stop offset=\"0\" stop-color=\"#ffffff\"/><stop offset=\".5\" stop-color=\"#f4efe6\"/><stop offset=\"1\" stop-color=\"#bfb4a2\"/></radialGradient><filter id=\"evh-z\" x=\"-15%\" y=\"-40%\" width=\"130%\" height=\"180%\" color-interpolation-filters=\"sRGB\"><feTurbulence type=\"fractalNoise\" baseFrequency=\".23\" numOctaves=\"3\" seed=\"4\" result=\"n\"/><feDisplacementMap in=\"SourceGraphic\" in2=\"n\" scale=\"6.5\" xChannelSelector=\"R\" yChannelSelector=\"G\" result=\"g\"/><feTurbulence type=\"fractalNoise\" baseFrequency=\".55\" numOctaves=\"2\" seed=\"9\"/><feGaussianBlur stdDeviation=\".45\" result=\"t\"/><feColorMatrix in=\"t\" type=\"matrix\" values=\"0 0 0 0 .55  0 0 0 0 .5  0 0 0 0 .45  1.9 0 0 0 -.9\" result=\"k\"/><feComposite in=\"k\" in2=\"g\" operator=\"in\" result=\"k2\"/><feMerge><feMergeNode in=\"g\"/><feMergeNode in=\"k2\"/></feMerge></filter><filter id=\"evh-b\" x=\"-30%\" y=\"-60%\" width=\"160%\" height=\"220%\"><feGaussianBlur stdDeviation=\"2.6\"/></filter><filter id=\"evh-v\" x=\"-30%\" y=\"-30%\" width=\"160%\" height=\"160%\"><feGaussianBlur stdDeviation=\"1.7\"/></filter></defs><g class=\"xm-hat\"><path d=\"M-47 5C-30 18 30 18 47 5L46 13C30 27-30 27-46 13Z\" fill=\"#06140c\" opacity=\".45\" filter=\"url(#evh-b)\"/><path d=\"M-41-2C-39-26-26-50-6-64C6-72 22-70 30-56C37-44 42-24 43-2Z\" fill=\"url(#evh-r)\"/><path d=\"M-41-2C-39-26-26-50-6-64C6-72 22-70 30-56C37-44 42-24 43-2Z\" fill=\"url(#evh-s)\"/><path d=\"M31-50C37-36 40-20 41-3\" stroke=\"#4d0812\" stroke-width=\"7\" fill=\"none\" stroke-linecap=\"round\" opacity=\".42\" filter=\"url(#evh-v)\"/><path d=\"M-27-9C-24-24-16-36-5-44\" stroke=\"#ffa3ac\" stroke-width=\"3.4\" fill=\"none\" stroke-linecap=\"round\" opacity=\".3\" filter=\"url(#evh-v)\"/><path d=\"M-34-40C-22-54-4-61 14-58\" stroke=\"#3e0610\" stroke-width=\"6\" fill=\"none\" stroke-linecap=\"round\" opacity=\".5\" filter=\"url(#evh-v)\"/><path d=\"M29-57C21-74-5-79-26-69C-42-61-54-46-61-30L-51-26C-46-39-36-51-22-57C-9-63 5-62 16-57Z\" fill=\"url(#evh-d)\"/><path d=\"M24-63C14-73-6-75-24-67C-38-60-49-48-56-34\" stroke=\"#f47c88\" stroke-width=\"2.8\" fill=\"none\" stroke-linecap=\"round\" opacity=\".55\" filter=\"url(#evh-v)\"/><path d=\"M-50-28C-45-40-35-51-22-57C-10-62 3-61 13-57\" stroke=\"#3a0510\" stroke-width=\"2.6\" fill=\"none\" stroke-linecap=\"round\" opacity=\".55\" filter=\"url(#evh-v)\"/><path d=\"M-41-4C-20 0 20 0 43-4L43-12C20-7-20-7-41-12Z\" fill=\"#3e0610\" opacity=\".38\" filter=\"url(#evh-v)\"/><g filter=\"url(#evh-z)\"><circle cx=\"-57\" cy=\"-26\" r=\"10.2\" fill=\"url(#evh-p)\"/></g><circle cx=\"-59.5\" cy=\"-29.5\" r=\"3.6\" fill=\"#fff\" opacity=\".8\" filter=\"url(#evh-v)\"/><g filter=\"url(#evh-z)\"><path d=\"M-50-8C-31 1 31 1 50-8C56-9 57 3 50 6C31 16-31 16-50 6C-57 3-56-9-50-8Z\" fill=\"url(#evh-f)\"/><path d=\"M-50-8C-31 1 31 1 50-8C56-9 57 3 50 6C31 16-31 16-50 6C-57 3-56-9-50-8Z\" fill=\"url(#evh-e)\"/></g><path d=\"M-44-3C-25 5 25 5 44-3\" stroke=\"#fff\" stroke-width=\"2.6\" fill=\"none\" stroke-linecap=\"round\" opacity=\".8\" filter=\"url(#evh-v)\"/><path d=\"M-46 7C-26 15 26 15 46 7\" stroke=\"#9d907c\" stroke-width=\"2.6\" fill=\"none\" stroke-linecap=\"round\" opacity=\".5\" filter=\"url(#evh-v)\"/></g></g>"/*/XM-HAT*/;

  /* ---------------- event artwork (banner + countdown panel) ---------------- */
  function eventArt(theme) {
    var g = id("g");
    // Christmas: just SnakeList's own S (logo B's snake, in its real colours) wearing the Santa hat - the hat is the
    // same drawing as the Christmas preview's (tools/christmas_art.py, put in below by tools/build-christmas.py)
    if (theme === "xmas") return '<svg class="sl-ev-xmark" viewBox="-26 -24 162 172" aria-hidden="true"><use href="#mark-snake"></use>' +
      '<g class="sl-ev-xhat" transform="translate(88 34) rotate(6) translate(-24 0) scale(1.07) translate(24 0)">' + XHAT + "</g></svg>";
    if (theme === "newyear") return '<svg viewBox="0 0 100 100" aria-hidden="true">' + [[30, 30, "#f1d27a"], [70, 24, "#8fd3ff"], [55, 55, "#ff8fd1"]].map(function (f) {
        var s = ""; for (var a = 0; a < 12; a++) { var r = a * Math.PI / 6; s += '<line x1="' + f[0] + '" y1="' + f[1] + '" x2="' + (f[0] + Math.cos(r) * 16).toFixed(1) + '" y2="' + (f[1] + Math.sin(r) * 16).toFixed(1) + '" stroke="' + f[2] + '" stroke-width="2" stroke-linecap="round"/>'; }
        return s + '<circle cx="' + f[0] + '" cy="' + f[1] + '" r="3" fill="#fff"/>';
      }).join("") + M(24, 60, 36) + '<text x="64" y="92" font-family="Inter,sans-serif" font-weight="900" font-size="16" fill="#f1d27a" text-anchor="middle">2027</text></svg>';
    if (theme === "halloween") return '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="70" cy="28" r="18" fill="#f6e7b0"/><circle cx="62" cy="24" r="16" fill="#22123a"/>' +
      '<ellipse cx="44" cy="70" rx="30" ry="24" fill="#ff8a3c"/><path d="M44 46v-8q4-4 8-2" stroke="#3b7a2a" stroke-width="4" fill="none"/>' +
      '<path d="M30 64l7-6 7 6zM50 64l7-6 7 6z" fill="#3a1500"/><path d="M28 78q16 10 32 0l-4 4-4-3-4 4-4-4-4 4-4-3z" fill="#3a1500"/>' + M(66, 62, 28, ' opacity=".9"') + '</svg>';
    if (theme === "anniversary") return '<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="18" y="52" width="64" height="34" rx="6" fill="#ff8fa3"/><rect x="18" y="52" width="64" height="10" rx="5" fill="#fff"/>' +
      '<rect x="47" y="32" width="6" height="20" rx="2" fill="#ffd56b"/><path d="M50 20q5 6 0 11q-5-5 0-11z" fill="#ff9a3c"/>' + M(30, 60, 40) + '<text x="50" y="98" font-family="Inter,sans-serif" font-weight="900" font-size="10" fill="#ffd56b" text-anchor="middle">21 AUG</text></svg>';
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="34" fill="#1d7a5a" stroke="#b9f27a" stroke-width="3"/>' +
      '<path d="M26 40q10-8 20 0t20 0M24 60q12 8 24 0t26 0" stroke="#b9f27a" stroke-width="3" fill="none" opacity=".6"/>' + M(28, 30, 44) + '<path d="M70 20q10 2 12 12q-10 0-12-12z" fill="#ffd166"/></svg>';
  }

  /* ---------------- reward artwork ---------------- */
  function item(def, big) {
    var a = def.art || ["ornament", "#3f7d43", "#fff"], s = a[0], c1 = a[1], c2 = a[2], g = id("r"), h = id("h");
    var defs = '<defs><radialGradient id="' + g + '" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="' + c2 + '"/><stop offset=".35" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + shade(c1, -.35) + '"/></radialGradient>' +
      '<linearGradient id="' + h + '" x1="0" x2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + shade(c1, -.3) + '"/></linearGradient></defs>';
    var body = "";
    switch (s) {
      case "ornament": body = '<path d="M50 6v10" stroke="#a88a3a" stroke-width="2"/><rect x="42" y="14" width="16" height="9" rx="2" fill="#d8b24a"/><circle cx="50" cy="58" r="34" fill="url(#' + g + ')"/>' +
          '<path d="M18 52q32 14 64 0" stroke="' + c2 + '" stroke-width="4" fill="none" opacity=".75"/>' + M(32, 42, 36) + '<ellipse cx="38" cy="40" rx="7" ry="4" fill="#fff" opacity=".45" transform="rotate(-30 38 40)"/>'; break;
      case "sticker": body = '<circle cx="50" cy="52" r="40" fill="' + c2 + '" stroke="' + c1 + '" stroke-width="5"/>' + M(26, 34, 48) + '<path d="M44 26l14-14 12 18z" fill="' + c1 + '"/><circle cx="70" cy="30" r="5" fill="#fff"/><path d="M40 27q16-6 32 3" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/>'; break;
      case "badge": body = '<path d="M50 6l36 14v26c0 24-16 38-36 48C30 84 14 70 14 46V20z" fill="url(#' + h + ')" stroke="' + c2 + '" stroke-width="3"/>' +
          '<path d="M30 40l10 6 10-6 10 6 10-6M30 56l10 6 10-6 10 6 10-6" stroke="' + c2 + '" stroke-width="2.5" fill="none" opacity=".7"/>' + M(34, 30, 32); break;
      case "garland": body = '<path d="M6 30q44 50 88 0" stroke="url(#' + h + ')" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M6 30q44 50 88 0" stroke="' + shade(c1, .25) + '" stroke-width="3" stroke-dasharray="2 7" fill="none"/>' +
          '<circle cx="28" cy="50" r="5" fill="' + c2 + '"/><circle cx="50" cy="56" r="5" fill="#c8323f"/><circle cx="72" cy="50" r="5" fill="' + c2 + '"/><path d="M88 28q8-4 8 4l-4 2z" fill="' + c1 + '"/><circle cx="92" cy="29" r="1.5" fill="#111"/>'; break;
      case "egg": body = '<path d="M50 8C30 8 18 40 18 60a32 30 0 0 0 64 0C82 40 70 8 50 8z" fill="url(#' + g + ')"/><path d="M28 56l8-6 8 6 8-6 8 6 8-6 8 6" stroke="' + c2 + '" stroke-width="2.5" fill="none" opacity=".7"/>' +
          '<ellipse cx="40" cy="30" rx="6" ry="10" fill="#fff" opacity=".4" transform="rotate(20 40 30)"/>'; break;
      case "bell": body = '<path d="M50 10c-4 0-6 3-6 6-14 4-20 16-20 32 0 14-6 20-10 26h72c-4-6-10-12-10-26 0-16-6-28-20-32 0-3-2-6-6-6z" fill="url(#' + g + ')"/>' +
          '<rect x="12" y="72" width="76" height="8" rx="4" fill="' + shade(c1, -.25) + '"/><circle cx="50" cy="86" r="7" fill="' + shade(c1, -.2) + '"/><path d="M28 30q-6 10-4 24" stroke="#fff" stroke-width="3" opacity=".5" fill="none"/>' +
          '<path d="M30 10q8 4 6 10M70 10q-8 4-6 10" stroke="' + c2 + '" stroke-width="3" fill="none"/>' + M(38, 38, 24, ' opacity=".9"'); break;
      case "notebook": body = '<rect x="18" y="8" width="64" height="84" rx="5" fill="url(#' + h + ')"/><rect x="18" y="8" width="10" height="84" fill="rgba(0,0,0,.25)"/>' +
          '<rect x="34" y="20" width="40" height="26" rx="3" fill="' + c2 + '"/>' + M(40, 22, 28) + '<path d="M18 86q20-8 32 0t32 0v6H18z" fill="#fff"/><circle cx="40" cy="64" r="2" fill="#fff"/><circle cx="60" cy="72" r="2" fill="#fff"/><circle cx="70" cy="58" r="2" fill="#fff"/>'; break;
      case "cookie": body = '<path d="M20 70q-8-30 20-44q20-10 34 4q14 14 2 30q8 20-14 22q-30 4-42-12z" fill="url(#' + g + ')"/>' +
          '<path d="M26 66q-4-22 16-34q16-8 28 4" stroke="#fff" stroke-width="3.5" stroke-dasharray="5 5" fill="none" stroke-linecap="round"/><path d="M70 30l10-8 4 6-8 6" fill="' + c1 + '"/>' +
          '<circle cx="74" cy="34" r="2.5" fill="#3a1d0a"/><path d="M42 50l6 6M56 46l-4 8" stroke="#c8323f" stroke-width="3" stroke-linecap="round"/>'; break;
      case "wreath": body = '<circle cx="50" cy="50" r="30" fill="none" stroke="' + c1 + '" stroke-width="16"/><circle cx="50" cy="50" r="30" fill="none" stroke="' + shade(c1, .3) + '" stroke-width="4" stroke-dasharray="3 9"/>' +
          '<circle cx="50" cy="50" r="30" fill="none" stroke="' + c2 + '" stroke-width="5" stroke-dasharray="14 10"/><circle cx="50" cy="50" r="30" fill="none" stroke="#111" stroke-width="5" stroke-dasharray="3 21" stroke-dashoffset="-14"/>' +
          '<path d="M50 78l-12 14 12-6 12 6z" fill="#c8323f"/><circle cx="50" cy="80" r="5" fill="#c8323f"/>'; break;
      case "lantern": body = '<path d="M40 10h20l-2 8H42z" fill="' + c1 + '"/><path d="M50 2v8" stroke="' + c1 + '" stroke-width="3"/><rect x="30" y="18" width="40" height="58" rx="8" fill="' + c1 + '"/>' +
          '<rect x="36" y="24" width="28" height="46" rx="5" fill="' + c2 + '" opacity=".95"/><circle cx="50" cy="50" r="22" fill="' + c2 + '" opacity=".25"/>' + M(38, 36, 24) + '<rect x="26" y="76" width="48" height="8" rx="3" fill="' + c1 + '"/>'; break;
      case "gem": body = '<path d="M30 14h40l18 22-38 56L12 36z" fill="url(#' + g + ')"/><path d="M12 36h76M30 14l10 22 10-22 10 22 10-22M40 36l10 56 10-56" stroke="' + c2 + '" stroke-width="1.6" fill="none" opacity=".8"/>' +
          (def.glow ? '<circle cx="50" cy="48" r="40" fill="' + c2 + '" opacity=".18"/>' : "") + '<path d="M36 22l-8 12" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/>'; break;
      case "stocking": body = '<path d="M34 8h32v50q0 6 6 10l8 6q6 6 0 14-6 8-16 4L36 76q-6-4-4-12z" fill="url(#' + h + ')"/><rect x="30" y="6" width="40" height="16" rx="5" fill="' + c2 + '"/>' +
          '<path d="M42 30q6 8 0 16t0 16" stroke="' + c2 + '" stroke-width="4" fill="none" opacity=".85" stroke-linecap="round"/><path d="M48 4q10-8 12 4" stroke="#c9b28a" stroke-width="3" fill="none"/>'; break;
      case "globe": body = '<rect x="26" y="78" width="48" height="14" rx="4" fill="#6e4628"/><circle cx="50" cy="48" r="34" fill="' + c1 + '" opacity=".55"/><circle cx="50" cy="48" r="34" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/>' +
          '<path d="M20 64q30-12 60 0v10H20z" fill="#fff"/>' + M(36, 46, 28) + '<path d="M30 30l2 2M60 24l2 2M70 44l2 2M40 22l2 2" stroke="#fff" stroke-width="3" stroke-linecap="round"/><ellipse cx="36" cy="30" rx="6" ry="10" fill="#fff" opacity=".3" transform="rotate(30 36 30)"/>'; break;
      case "frame": body = '<rect x="10" y="10" width="80" height="80" rx="16" fill="url(#' + h + ')"/><rect x="22" y="22" width="56" height="56" rx="10" fill="' + c2 + '" opacity=".9"/>' + M(30, 30, 40) +
          '<path d="M14 26l6-6M80 14l6 6M14 80l6 6M80 86l6-6" stroke="' + c2 + '" stroke-width="3" stroke-linecap="round"/>'; break;
      case "bow": body = '<path d="M50 50C30 26 12 28 14 44s20 18 36 6zM50 50C70 26 88 28 86 44s-20 18-36 6z" fill="url(#' + h + ')"/><path d="M50 50l-18 40 10-4 6 8zM50 50l18 40-10-4-6 8z" fill="' + c1 + '"/>' +
          '<path d="M20 40q14 6 28 10M80 40q-14 6-28 10" stroke="' + c2 + '" stroke-width="3" fill="none" opacity=".8"/><circle cx="50" cy="50" r="8" fill="' + shade(c1, -.25) + '"/>'; break;
      case "plush": body = '<ellipse cx="50" cy="66" rx="36" ry="22" fill="url(#' + g + ')"/><ellipse cx="50" cy="56" rx="26" ry="15" fill="' + shade(c1, .15) + '"/><ellipse cx="50" cy="46" rx="16" ry="10" fill="' + c1 + '"/>' +
          '<ellipse cx="70" cy="34" rx="13" ry="10" fill="' + c1 + '"/><circle cx="74" cy="31" r="2.4" fill="#111"/><path d="M80 37l6 2" stroke="#c8323f" stroke-width="1.6"/>' +
          '<path d="M28 60q22 14 46 0" stroke="' + c2 + '" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M62 64l4 16M70 62l6 14" stroke="' + c2 + '" stroke-width="5" stroke-linecap="round"/>'; break;
      case "star": body = '<path d="M50 6l12 28 30 3-23 20 7 30-26-16-26 16 7-30L8 37l30-3z" fill="url(#' + h + ')" stroke="' + c2 + '" stroke-width="2"/>' + M(36, 38, 28) +
          '<path d="M50 6l12 28 30 3" stroke="#fff" stroke-width="1.5" fill="none" opacity=".6"/>'; break;
      case "moon": body = '<circle cx="50" cy="50" r="40" fill="' + c2 + '"/><circle cx="50" cy="50" r="26" fill="' + c1 + '"/><circle cx="42" cy="44" r="4" fill="' + shade(c1, -.12) + '"/><circle cx="58" cy="58" r="6" fill="' + shade(c1, -.12) + '"/>' +
          '<circle cx="50" cy="50" r="34" fill="none" stroke="#3f9b4a" stroke-width="6" stroke-dasharray="190 24"/><path d="M76 30q8-2 6 6" stroke="#3f9b4a" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="80" cy="30" r="1.6" fill="#111"/>'; break;
      case "tree": body = '<path d="M50 8 76 46H64l18 24H18l18-24H24z" fill="url(#' + h + ')"/><rect x="44" y="70" width="12" height="14" fill="#6e4628"/><path d="M50 2l2.5 5 5.5.5-4 3.5 1 5.5-5-3-5 3 1-5.5-4-3.5 5.5-.5z" fill="#fff6c8"/>' +
          '<circle cx="40" cy="54" r="3" fill="#fff6c8"/><circle cx="60" cy="60" r="3" fill="#fff6c8"/><circle cx="52" cy="38" r="2.6" fill="#fff6c8"/>'; break;
      case "aurora": body = '<rect x="6" y="10" width="88" height="80" rx="10" fill="#0b1630"/><path d="M6 50q22-30 44-10t44-20v30q-22 20-44 0T6 70z" fill="' + c1 + '" opacity=".6"/><path d="M6 40q30-26 60-6t28-10v14q-20 16-44 4T6 56z" fill="' + c2 + '" opacity=".5"/>' +
          '<path d="M6 80l20-14 14 10 20-16 34 20v10H6z" fill="#e8f3ff"/>'; break;
      case "fire": body = '<rect x="10" y="22" width="80" height="70" rx="4" fill="' + c2 + '"/><rect x="22" y="38" width="56" height="54" rx="3" fill="#1b0d06"/><path d="M50 50q12 12 8 26q-4 10-8 10t-8-10q-4-14 8-26z" fill="' + c1 + '"/>' +
          '<path d="M50 62q6 6 4 14q-2 6-4 6t-4-6q-2-8 4-14z" fill="#ffd56b"/><rect x="6" y="16" width="88" height="10" rx="3" fill="#a0603a"/>'; break;
      case "snow": body = '<rect x="6" y="6" width="88" height="88" rx="12" fill="' + c2 + '" opacity=".35"/>' + [[30, 30], [66, 24], [48, 52], [24, 70], [74, 66]].map(function (p) {
          return '<g stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M' + p[0] + ' ' + (p[1] - 8) + 'v16M' + (p[0] - 7) + ' ' + (p[1] - 4) + 'l14 8M' + (p[0] - 7) + ' ' + (p[1] + 4) + 'l14-8"/></g>'; }).join(""); break;
      default: body = '<circle cx="50" cy="50" r="38" fill="url(#' + g + ')"/>' + M(30, 32, 40);
    }
    return '<svg viewBox="0 0 100 100" role="img" aria-label="' + EV.esc(def.name || "") + '"' + (big ? ' class="big"' : "") + ">" + defs + body + "</svg>";
  }
  function shade(hex, f) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return hex;
    var n = parseInt(m[1], 16), r = n >> 16, g = n >> 8 & 255, b = n & 255;
    var t = f < 0 ? 0 : 255, p = Math.abs(f);
    return "#" + [r, g, b].map(function (c) { return ("0" + Math.round((t - c) * p + c).toString(16)).slice(-2); }).join("");
  }

  /* ---------------- The Legendary Christmas Serpent (animated) ---------------- */
  function serpent(cls) {
    var g = id("sg"), s = id("ss");
    return '<svg class="sl-ev-serpent ' + (cls || "") + '" viewBox="0 0 200 200" role="img" aria-label="The Legendary Christmas Serpent"><defs>' +
      '<linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".35" stop-color="#e9c04a"/><stop offset=".7" stop-color="#b8861f"/><stop offset="1" stop-color="#f7e3a1"/></linearGradient>' +
      '<linearGradient id="' + s + '" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<clipPath id="' + s + 'c"><path d="M40 160c-20-30 10-60 50-50s70-10 60-40-50-30-60-10"/></clipPath></defs>' +
      '<ellipse cx="100" cy="176" rx="70" ry="10" fill="#000" opacity=".25"/>' +
      '<path class="body" pathLength="100" d="M30 168c-24-34 8-70 56-58s74-12 62-44-52-30-62-8" fill="none" stroke="url(#' + g + ')" stroke-width="22" stroke-linecap="round"/>' +
      '<path class="body" pathLength="100" d="M30 168c-24-34 8-70 56-58s74-12 62-44-52-30-62-8" fill="none" stroke="#8a6414" stroke-width="22" stroke-linecap="round" stroke-dasharray=".6 2.4" opacity=".3"/>' +
      '<path pathLength="100" d="M30 168c-24-34 8-70 56-58s74-12 62-44-52-30-62-8" fill="none" stroke="#fff6c8" stroke-width="5" stroke-linecap="round" opacity=".45" transform="translate(-3 -4)"/>' +
      '<g transform="skewX(-20)" opacity=".55"><rect class="shimmer" x="0" y="0" width="50" height="200" fill="url(#' + s + ')"/></g>' +
      '<g class="head"><path d="M86 58c-6-18 10-34 28-30 16 4 18 20 6 28-10 6-26 10-34 2z" fill="url(#' + g + ')" stroke="#8a6414" stroke-width="2"/>' +
      '<circle cx="110" cy="40" r="4" fill="#123320"/><circle cx="111" cy="39" r="1.3" fill="#fff"/><path d="M122 50l10 2-6 3 6 3-10-2" stroke="#c8323f" stroke-width="2" fill="none"/>' +
      '<path d="M90 34l26-22 14 26z" fill="#c8323f"/><path d="M88 34q22-8 44 2" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="130" cy="12" r="7" fill="#fff"/></g>' +
      '<path class="sparkle" d="M160 110l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#fff6c8"/><path class="sparkle" d="M40 80l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#fff6c8"/><path class="sparkle" d="M150 160l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff6c8"/></svg>';
  }

  /* ---------------- small line icons ---------------- */
  var I = {
    door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14 12h.01"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    flame: '<path d="M12 3c2 3 6 5.5 6 10a6 6 0 0 1-12 0c0-2.5 1.2-4 2.5-5 0 2 1 3 2.2 3.2C10 8.5 11 5.5 12 3z"/>',
    gift: '<rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1.5S12 8 12 8zm0 0c2-4 6-4 6-1.5S12 8 12 8z"/>',
    gem: '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M12 20 8 9l4-5 4 5z"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    serpent: '<path d="M5 19c-2-3 1-6 5-5s7-1 6-4-5-3-6-1"/><path d="M10 9c-1-2 1-4 3-4s3 2 2 3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sprout: '<path d="M12 21v-9M12 12c0-4-3-6-7-6 0 4 3 6 7 6zm0 0c0-3 2-5 6-5 0 3-2 5-6 5z"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    cake: '<path d="M4 21h16v-8H4zM4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1 4 0M12 13V9M12 6.5l.01 0"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    cursor: '<path d="M5 3l14 7-6 2-2 6z"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
    snow: '<path d="M12 2v20M4 7l16 10M4 17 20 7"/>',
    skip: '<path d="M5 5v14l9-7zM16 5v14"/>'
  };
  function icon(n, size) { return '<svg viewBox="0 0 24 24" width="' + (size || 16) + '" height="' + (size || 16) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[n] || I.star) + "</svg>"; }

  EV.art = { event: eventArt, item: item, serpent: serpent, icon: icon, shade: shade };
})();
