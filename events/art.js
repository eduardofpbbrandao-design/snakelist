/* SnakeList events preview - artwork, drawn as SVG (no image files). The SnakeList S on the rewards is the page's
   own logo symbol (#mark-snake), so every reward carries the real mark. */
(function () {
  "use strict";
  var EV = window.SL_EVENTS; if (!EV) return;
  var uid = 0;
  function id(p) { return p + "-" + (++uid); }
  var M = EV.mark;
  /* the Santa hat on the S's head (written by tools/build-christmas.py from tools/christmas_art.py - edit it there) */
  var XHAT = /*XM-HAT*/"<g transform=\"translate(-6.5 -16) rotate(-15) scale(0.3700 0.3700)\"><defs><linearGradient id=\"evh-r\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\".18\"><stop offset=\"0\" stop-color=\"#e24a5a\"/><stop offset=\".38\" stop-color=\"#c62c40\"/><stop offset=\".78\" stop-color=\"#8f1627\"/><stop offset=\"1\" stop-color=\"#6c0e1c\"/></linearGradient><linearGradient id=\"evh-d\" x1=\"0\" y1=\"0\" x2=\".25\" y2=\"1\"><stop offset=\"0\" stop-color=\"#d23a4c\"/><stop offset=\".5\" stop-color=\"#a51d31\"/><stop offset=\"1\" stop-color=\"#6a0d1b\"/></linearGradient><radialGradient id=\"evh-s\" cx=\".3\" cy=\".3\" r=\".55\"><stop offset=\"0\" stop-color=\"#ff9aa4\" stop-opacity=\".5\"/><stop offset=\"1\" stop-color=\"#ff9aa4\" stop-opacity=\"0\"/></radialGradient><linearGradient id=\"evh-f\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#ffffff\"/><stop offset=\".45\" stop-color=\"#f8f4ee\"/><stop offset=\"1\" stop-color=\"#d2c9ba\"/></linearGradient><linearGradient id=\"evh-e\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"0\"><stop offset=\"0\" stop-color=\"#8a7c68\" stop-opacity=\".5\"/><stop offset=\".22\" stop-color=\"#8a7c68\" stop-opacity=\"0\"/><stop offset=\".72\" stop-color=\"#8a7c68\" stop-opacity=\"0\"/><stop offset=\"1\" stop-color=\"#6e604e\" stop-opacity=\".55\"/></linearGradient><radialGradient id=\"evh-p\" cx=\".38\" cy=\".32\" r=\".72\"><stop offset=\"0\" stop-color=\"#ffffff\"/><stop offset=\".5\" stop-color=\"#f4efe6\"/><stop offset=\"1\" stop-color=\"#bfb4a2\"/></radialGradient><filter id=\"evh-z\" x=\"-15%\" y=\"-40%\" width=\"130%\" height=\"180%\" color-interpolation-filters=\"sRGB\"><feTurbulence type=\"fractalNoise\" baseFrequency=\".23\" numOctaves=\"3\" seed=\"4\" result=\"n\"/><feDisplacementMap in=\"SourceGraphic\" in2=\"n\" scale=\"6.5\" xChannelSelector=\"R\" yChannelSelector=\"G\" result=\"g\"/><feTurbulence type=\"fractalNoise\" baseFrequency=\".55\" numOctaves=\"2\" seed=\"9\"/><feGaussianBlur stdDeviation=\".45\" result=\"t\"/><feColorMatrix in=\"t\" type=\"matrix\" values=\"0 0 0 0 .55  0 0 0 0 .5  0 0 0 0 .45  1.9 0 0 0 -.9\" result=\"k\"/><feComposite in=\"k\" in2=\"g\" operator=\"in\" result=\"k2\"/><feMerge><feMergeNode in=\"g\"/><feMergeNode in=\"k2\"/></feMerge></filter><filter id=\"evh-b\" x=\"-30%\" y=\"-60%\" width=\"160%\" height=\"220%\"><feGaussianBlur stdDeviation=\"2.6\"/></filter><filter id=\"evh-v\" x=\"-30%\" y=\"-30%\" width=\"160%\" height=\"160%\"><feGaussianBlur stdDeviation=\"1.7\"/></filter></defs><g class=\"xm-hat\"><path d=\"M-47 5C-30 18 30 18 47 5L46 13C30 27-30 27-46 13Z\" fill=\"#06140c\" opacity=\".45\" filter=\"url(#evh-b)\"/><path d=\"M-41-2C-39-26-26-50-6-64C6-72 22-70 30-56C37-44 42-24 43-2Z\" fill=\"url(#evh-r)\"/><path d=\"M-41-2C-39-26-26-50-6-64C6-72 22-70 30-56C37-44 42-24 43-2Z\" fill=\"url(#evh-s)\"/><path d=\"M31-50C37-36 40-20 41-3\" stroke=\"#4d0812\" stroke-width=\"7\" fill=\"none\" stroke-linecap=\"round\" opacity=\".42\" filter=\"url(#evh-v)\"/><path d=\"M-27-9C-24-24-16-36-5-44\" stroke=\"#ffa3ac\" stroke-width=\"3.4\" fill=\"none\" stroke-linecap=\"round\" opacity=\".3\" filter=\"url(#evh-v)\"/><path d=\"M-34-40C-22-54-4-61 14-58\" stroke=\"#3e0610\" stroke-width=\"6\" fill=\"none\" stroke-linecap=\"round\" opacity=\".5\" filter=\"url(#evh-v)\"/><path d=\"M29-57C21-74-5-79-26-69C-42-61-54-46-61-30L-51-26C-46-39-36-51-22-57C-9-63 5-62 16-57Z\" fill=\"url(#evh-d)\"/><path d=\"M24-63C14-73-6-75-24-67C-38-60-49-48-56-34\" stroke=\"#f47c88\" stroke-width=\"2.8\" fill=\"none\" stroke-linecap=\"round\" opacity=\".55\" filter=\"url(#evh-v)\"/><path d=\"M-50-28C-45-40-35-51-22-57C-10-62 3-61 13-57\" stroke=\"#3a0510\" stroke-width=\"2.6\" fill=\"none\" stroke-linecap=\"round\" opacity=\".55\" filter=\"url(#evh-v)\"/><path d=\"M-41-4C-20 0 20 0 43-4L43-12C20-7-20-7-41-12Z\" fill=\"#3e0610\" opacity=\".38\" filter=\"url(#evh-v)\"/><g filter=\"url(#evh-z)\"><circle cx=\"-57\" cy=\"-26\" r=\"10.2\" fill=\"url(#evh-p)\"/></g><circle cx=\"-59.5\" cy=\"-29.5\" r=\"3.6\" fill=\"#fff\" opacity=\".8\" filter=\"url(#evh-v)\"/><g filter=\"url(#evh-z)\"><path d=\"M-50-8C-31 1 31 1 50-8C56-9 57 3 50 6C31 16-31 16-50 6C-57 3-56-9-50-8Z\" fill=\"url(#evh-f)\"/><path d=\"M-50-8C-31 1 31 1 50-8C56-9 57 3 50 6C31 16-31 16-50 6C-57 3-56-9-50-8Z\" fill=\"url(#evh-e)\"/></g><path d=\"M-44-3C-25 5 25 5 44-3\" stroke=\"#fff\" stroke-width=\"2.6\" fill=\"none\" stroke-linecap=\"round\" opacity=\".8\" filter=\"url(#evh-v)\"/><path d=\"M-46 7C-26 15 26 15 46 7\" stroke=\"#9d907c\" stroke-width=\"2.6\" fill=\"none\" stroke-linecap=\"round\" opacity=\".5\" filter=\"url(#evh-v)\"/></g></g>"/*/XM-HAT*/;

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

  /* ---------------- The Legendary Christmas Serpent ----------------
     A real 3D model, rendered once per size and kept as an image: a python-shaped snake (built on the anatomy of the
     green tree python / emerald tree boa - the classic resting coil over itself) in emerald with metallic gold.
       geometry  a spine in 3D: a two-turn coil resting on the ground (each turn stacked a little higher and further
                 in, never passing through another), a neck rising out of the middle in a natural S-curve, the head
                 raised and turned to face the viewer; the tail tip visible on the outside of the coil.
                 The body is a tube of elliptical rings along that spine (rotation-minimising frames), thickness
                 tapering from the neck to a fine tail tip; the head is its own shape on the same rings: broad
                 temples over the jaw muscles, narrowing to a rounded, slightly flattened snout.
       scales    every quad of the mesh is one scale: staggered rows on the back and flanks (overlapping, each with
                 its own lit edge and shaded rim, so they read as keeled scales and not paint), wide ventral scutes
                 underneath, large plates on the crown of the head, lip (labial) scales with the python's heat pits.
       face      eyes with an iris, a vertical slit pupil, a corneal highlight and the brow ridge above, nostrils at
                 the snout tip, the mouth line from the snout to the angle of the jaw.
       lighting  soft key light from the upper left, a cool fill, a golden rim light from behind and per-scale
                 specular gloss (metallic on the gold), all depth-sorted - so it looks right with every effect off.
       LOD       "s" (icons), "m" (panels, the Cabin) and "l" (the reveal); each is rendered once and cached.
     The tongue flick, slow breathing and a restrained glint are tiny CSS effects on top (none with reduce-motion). */
  var SERP = {};
  function serpentModel(lod) {
    if (SERP[lod]) return SERP[lod];
    var px = lod === "s" ? 200 : lod === "l" ? 760 : 420, M = lod === "s" ? 150 : lod === "l" ? 460 : 300, K = lod === "s" ? 12 : lod === "l" ? 24 : 18;
    var cv = document.createElement("canvas"); cv.width = cv.height = px;
    var x = cv.getContext && cv.getContext("2d"); if (!x) return (SERP[lod] = { url: "", tip: [100, 60] });
    function v(a, b, c) { return [a, b, c]; }
    function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function nrm(a) { var l = Math.sqrt(dot(a, a)) || 1; return mul(a, 1 / l); }
    // 1. the spine: the coil (tail on the outside, spiralling in and up), then the neck and head
    var pts = [], i, BR = .135;
    var turns = 2.35, R0 = .95, R1 = .5, th0 = 2.3;
    for (i = 0; i <= 400; i++) {
      var u = i / 400, th = th0 + u * turns * Math.PI * 2, r = R0 + (R1 - R0) * u;
      var y = BR * .92 + Math.max(0, u * turns - .55) * .14 + (u < .06 ? -.05 * (1 - u / .06) : 0);
      pts.push(v(Math.cos(th) * r, y, Math.sin(th) * r));
    }
    var e0 = pts[pts.length - 1], e1 = pts[pts.length - 2], t0 = nrm(sub(e0, e1));
    var hd = nrm(v(-.45, -.06, .89)), hStart = v(-.04, 1.12, .3);
    var c1 = add(e0, mul(add(t0, v(0, .9, 0)), .42)), c2 = sub(hStart, mul(nrm(add(hd, v(0, -.9, -.3))), .5));
    for (i = 1; i <= 120; i++) {
      var s = i / 120, a = 1 - s;
      pts.push(add(add(mul(e0, a * a * a), mul(c1, 3 * a * a * s)), add(mul(c2, 3 * a * s * s), mul(hStart, s * s * s))));
    }
    var HL = .64;
    for (i = 1; i <= 40; i++) pts.push(add(hStart, mul(hd, HL * i / 40)));
    // resample by arc length
    var acc = [0]; for (i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.sqrt(dot(sub(pts[i], pts[i - 1]), sub(pts[i], pts[i - 1]))));
    var LEN = acc[acc.length - 1], headFrom = 1 - HL / LEN, sp = [], j = 0;
    // more rings on the head (where the detail is)
    function tAt(k) { var q = k / (M - 1), h = .82; return q < h ? q / h * headFrom : headFrom + (q - h) / (1 - h) * (1 - headFrom); }
    for (var k = 0; k < M; k++) {
      var want = tAt(k) * LEN; while (j < acc.length - 2 && acc[j + 1] < want) j++;
      var f = (want - acc[j]) / ((acc[j + 1] - acc[j]) || 1); sp.push({ p: add(pts[j], mul(sub(pts[j + 1], pts[j]), f)), t: tAt(k) });
    }
    // 2. frames (rotation-minimising, starting with the back facing up)
    for (k = 0; k < M; k++) { var pa = sp[Math.max(0, k - 1)].p, pb = sp[Math.min(M - 1, k + 1)].p; sp[k].T = nrm(sub(pb, pa)); }
    var Nn = nrm(cross(cross(sp[0].T, v(0, 1, 0)), sp[0].T));
    for (k = 0; k < M; k++) { var T = sp[k].T; Nn = nrm(sub(Nn, mul(T, dot(Nn, T)))); sp[k].N = Nn; sp[k].B = cross(T, Nn); }
    // the head: keep its crown facing up (a snake holds its head level) - blend the frame towards world-up there
    for (k = 0; k < M; k++) {
      var w = Math.min(1, Math.max(0, (sp[k].t - (headFrom - .05)) / .05));
      if (w > 0) { var up = nrm(sub(v(0, 1, 0), mul(sp[k].T, sp[k].T[1]))); sp[k].N = nrm(add(mul(sp[k].N, 1 - w), mul(up, w))); sp[k].B = nrm(cross(sp[k].T, sp[k].N)); }
    }
    // 3. the profile: half-width (sideways) and half-height of each ring
    function prof(t) {
      var hw, hh;
      if (t < .3) hw = BR * Math.pow(t / .3, .62); else if (t < headFrom - .1) hw = BR; else hw = BR * (1 - .3 * Math.min(1, (t - (headFrom - .1)) / .08));
      hw = Math.max(hw, .006); hh = hw * .92;
      if (t >= headFrom - .012) {
        var q = (t - headFrom) / (1 - headFrom);    // 0 at the back of the head .. 1 at the snout
        var jaw = q < .3 ? .11 + .075 * Math.sin(Math.max(0, q + .04) / .34 * Math.PI / 2) : .185 - .11 * Math.pow((q - .3) / .7, 1.5);
        var cap = q > .9 ? Math.sqrt(Math.max(0, 1 - Math.pow((q - .9) / .1, 2))) : 1;
        hw = jaw * (q > .9 ? .35 + .65 * cap : 1); hh = hw * (.62 - .1 * q);
      }
      return [hw, hh];
    }
    // 4. the camera: three-quarter view, a little from above
    var az = -.32, el = .4, ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
    function cam(p) { var x1 = p[0] * ca - p[2] * sa, z1 = p[0] * sa + p[2] * ca; return [x1, p[1] * ce - z1 * se, p[1] * se + z1 * ce]; }
    var VIEW = v(0, 0, 1);
    function camDir(n) { var c = cam(n); return c; }
    // rings of vertices (staggered every other ring: overlapping scale rows)
    var rings = [];
    for (k = 0; k < M; k++) {
      var pr = prof(sp[k].t), ring = [], off = (k % 2) * .5;
      for (var m = 0; m <= K; m++) {
        var ph = (m + off) / K * Math.PI * 2, cs = Math.cos(ph), sn = Math.sin(ph);
        var P = add(sp[k].p, add(mul(sp[k].N, cs * pr[1]), mul(sp[k].B, sn * pr[0])));
        var Nm = nrm(add(mul(sp[k].N, cs / pr[1]), mul(sp[k].B, sn / pr[0])));
        ring.push({ c: cam(P), n: camDir(Nm), ph: ph });
      }
      rings.push(ring);
    }
    // 5. fit to the canvas
    var mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    rings.forEach(function (rg) { rg.forEach(function (q) { mnx = Math.min(mnx, q.c[0]); mxx = Math.max(mxx, q.c[0]); mny = Math.min(mny, -q.c[1]); mxy = Math.max(mxy, -q.c[1]); }); });
    var sc = px * .86 / Math.max(mxx - mnx, mxy - mny), ox = px / 2 - (mnx + mxx) / 2 * sc, oy = px * .54 - (mny + mxy) / 2 * sc;
    function scr(c) { return [ox + c[0] * sc, oy - c[1] * sc]; }
    // 6. lights
    var Lk = nrm(v(-.55, .7, .55)), Lf = nrm(v(.7, .2, .4)), Lr = nrm(v(.2, .5, -.9)), H = nrm(add(Lk, VIEW));
    function mix(a, b, f) { return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }
    var EM = [14, 122, 74], EMD = [6, 62, 38], GOLD = [233, 192, 74], BELLY = [236, 214, 150], LIP = [244, 226, 168];
    function hash(a, b) { var s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }
    // base colour of the scale at ring k, around-angle ph (0 = top of the back, pi = belly)
    function base(k, mi, ph) {
      var t = sp[k].t, d = Math.abs(((ph + Math.PI) % (Math.PI * 2)) - Math.PI), q = (t - headFrom) / (1 - headFrom);
      if (t >= headFrom) {
        if (d > 1.95) return { c: LIP, metal: .2, belly: 1 };
        if (d < .55 && q > .15 && q < .8) return { c: mix(EM, GOLD, .55), metal: .7 };         // gold crown plates
        return { c: mix(EM, [24, 150, 92], q), metal: .15 };
      }
      if (d > 2.25) return { c: mix(BELLY, [214, 186, 110], (k % 4 < 2) ? 0 : .35), metal: .25, belly: 1 };  // ventral scutes
      // a dorsal line of gold scales broken into dashes, and gold flecks on the flanks (like a green tree python's)
      if (d < .34 && (k % 18) < 4) return { c: GOLD, metal: 1 };
      if (d > 1.1 && d < 1.9 && hash(k, mi) > .9) return { c: GOLD, metal: 1 };
      var dark = d > 1.75 ? .35 : 0;
      return { c: mix(mix(EM, [32, 158, 96], hash(mi, k) * .3), EMD, dark), metal: .1 };
    }
    function shade(b, n) {
      var nd = Math.max(0, dot(n, Lk)), fd = Math.max(0, dot(n, Lf)) * .35, rim = Math.pow(1 - Math.max(0, n[2]), 2.6) * Math.max(0, dot(n, Lr) + .35);
      var spec = Math.pow(Math.max(0, dot(n, H)), b.metal > .5 ? 18 : 40) * (b.metal > .5 ? 1.1 : .45);
      var amb = .3 + .12 * n[1];
      var c = [0, 1, 2].map(function (i) {
        var lit = b.c[i] * (amb + nd * .82 + fd) + (b.metal > .5 ? b.c[i] : 255) * spec * (b.metal > .5 ? .9 : .5) + 230 * rim * .55 * (i === 2 ? .55 : i === 1 ? .82 : 1);
        return Math.max(0, Math.min(255, Math.round(lit)));
      });
      return c;
    }
    // 7. the quads (one per scale), back-face culled and painted far to near
    var quads = [];
    for (k = 0; k < M - 1; k++) for (m = 0; m < K; m++) {
      var a0 = rings[k][m], a1 = rings[k][m + 1], b0 = rings[k + 1][m], b1 = rings[k + 1][m + 1];
      var nn = nrm(add(add(a0.n, a1.n), add(b0.n, b1.n)));
      if (nn[2] < -.2) continue;
      quads.push({ z: (a0.c[2] + a1.c[2] + b0.c[2] + b1.c[2]) / 4, p: [scr(a0.c), scr(a1.c), scr(b1.c), scr(b0.c)], n: nn, k: k, m: m, ph: (a0.ph + a1.ph) / 2 });
    }
    quads.sort(function (p, q) { return p.z - q.z; });
    // the shadow on the ground
    var g0 = scr(cam(v(-.05, 0, .05))), gr = x.createRadialGradient(g0[0], g0[1], 0, g0[0], g0[1], sc * 1.35);
    gr.addColorStop(0, "rgba(0,0,0,.42)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    x.save(); x.translate(g0[0], g0[1]); x.scale(1, .42); x.translate(-g0[0], -g0[1]); x.fillStyle = gr; x.beginPath(); x.arc(g0[0], g0[1], sc * 1.35, 0, 7); x.fill(); x.restore();
    var lw = Math.max(.35, px / 900);
    x.lineJoin = "round";
    quads.forEach(function (q) {
      var b = base(q.k, q.m, q.ph), c = shade(b, q.n), p = q.p;
      x.beginPath(); x.moveTo(p[0][0], p[0][1]); x.lineTo(p[1][0], p[1][1]); x.lineTo(p[2][0], p[2][1]); x.lineTo(p[3][0], p[3][1]); x.closePath();
      x.fillStyle = "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; x.fill();
      // the scale's own rim: a darker edge where it overlaps the next one, a lit edge along its keel
      x.strokeStyle = "rgba(" + Math.round(c[0] * .45) + "," + Math.round(c[1] * .45) + "," + Math.round(c[2] * .45) + "," + (b.belly ? .55 : .7) + ")";
      x.lineWidth = lw * (b.belly ? 1.2 : 1); x.stroke();
      if (px > 300 && !b.belly && q.n[2] > .25) {
        var cx0 = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4, cy0 = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4;
        x.beginPath(); x.moveTo(cx0 + (p[3][0] - cx0) * .55, cy0 + (p[3][1] - cy0) * .55); x.lineTo(cx0 + (p[2][0] - cx0) * .55, cy0 + (p[2][1] - cy0) * .55);
        x.strokeStyle = "rgba(255,250,220," + (.1 + .25 * Math.max(0, dot(q.n, H))) + ")"; x.lineWidth = lw * 1.1; x.stroke();
      }
    });
    // 8. the face, on the head's surface (only the parts that face the viewer)
    function surf(t, ph, lift) {
      var kk = 0; while (kk < M - 1 && sp[kk].t < t) kk++;
      var pr = prof(t), cs = Math.cos(ph), sn = Math.sin(ph), l = lift || 1;
      var P = add(sp[kk].p, add(mul(sp[kk].N, cs * pr[1] * l), mul(sp[kk].B, sn * pr[0] * l)));
      var Nm = nrm(add(mul(sp[kk].N, cs / pr[1]), mul(sp[kk].B, sn / pr[0])));
      return { s: scr(cam(P)), n: cam(Nm), w: pr[0] * sc };
    }
    function hT(q) { return headFrom + q * (1 - headFrom); }
    // the mouth line from the snout to the angle of the jaw, and the labial pits below it
    [-1, 1].forEach(function (side) {
      var line = [], pits = [];
      for (var q = .08; q <= .985; q += .02) { var s0 = surf(hT(q), Math.PI / 2 * side + side * .62); line.push(s0); if (q > .55 && q < .93 && Math.round(q * 50) % 4 === 0) pits.push(surf(hT(q), Math.PI / 2 * side + side * .82)); }
      if (line[Math.floor(line.length / 2)].n[2] < 0) return;
      x.beginPath(); line.forEach(function (s0, ii) { if (ii) x.lineTo(s0.s[0], s0.s[1]); else x.moveTo(s0.s[0], s0.s[1]); });
      x.strokeStyle = "rgba(20,30,18,.85)"; x.lineWidth = lw * 2.2; x.lineCap = "round"; x.stroke();
      pits.forEach(function (s0) { if (s0.n[2] < .05) return; x.fillStyle = "rgba(25,30,20,.8)"; x.beginPath(); x.ellipse(s0.s[0], s0.s[1], s0.w * .05, s0.w * .022, 0, 0, 7); x.fill(); });
    });
    // nostrils
    [-1, 1].forEach(function (side) { var s0 = surf(hT(.95), side * .75); if (s0.n[2] < .05) return; x.fillStyle = "#0b1a10"; x.beginPath(); x.ellipse(s0.s[0], s0.s[1], s0.w * .16, s0.w * .1, -.4 * side, 0, 7); x.fill(); });
    // the eyes: socket, gold iris, vertical slit pupil, corneal highlight, the brow ridge (supraocular) above
    [-1, 1].forEach(function (side) {
      var s0 = surf(hT(.5), side * 1.02, 1.02); if (s0.n[2] < .02) return;
      var ex = s0.s[0], ey = s0.s[1], er = Math.max(1.2, s0.w * .3), sq = Math.max(.35, s0.n[2]);
      x.save(); x.translate(ex, ey); x.rotate(-.18 * side); x.scale(Math.max(.5, sq), 1);
      x.fillStyle = "#08140c"; x.beginPath(); x.arc(0, 0, er * 1.2, 0, 7); x.fill();
      var ig = x.createRadialGradient(-er * .25, -er * .3, er * .1, 0, 0, er);
      ig.addColorStop(0, "#fff1b0"); ig.addColorStop(.45, "#e9b23a"); ig.addColorStop(1, "#8a5a10");
      x.fillStyle = ig; x.beginPath(); x.arc(0, 0, er, 0, 7); x.fill();
      x.fillStyle = "#050806"; x.beginPath(); x.ellipse(0, 0, er * .2, er * .86, 0, 0, 7); x.fill();
      x.fillStyle = "rgba(255,255,255,.9)"; x.beginPath(); x.ellipse(-er * .38, -er * .42, er * .22, er * .15, -.5, 0, 7); x.fill();
      x.strokeStyle = "rgba(255,255,255,.25)"; x.lineWidth = lw; x.beginPath(); x.arc(0, 0, er * .95, 3.6, 5.4); x.stroke();
      x.restore();
      x.strokeStyle = "rgba(10,40,24,.8)"; x.lineWidth = lw * 2.4; x.beginPath(); x.arc(ex, ey + er * .25, er * 1.35, Math.PI * 1.12, Math.PI * 1.88); x.stroke();
    });
    // where the tongue comes out (for the overlay): the snout tip, in the 200 x 200 picture's units
    var tipS = scr(cam(add(sp[M - 1].p, mul(sp[M - 1].T, .01)))), dirS = scr(cam(add(sp[M - 1].p, mul(sp[M - 1].T, .3))));
    var ang = Math.atan2(dirS[1] - tipS[1], dirS[0] - tipS[0]) * 180 / Math.PI;
    var url = ""; try { url = cv.toDataURL(lod === "s" ? "image/png" : "image/webp", .92); if (url.indexOf("data:image/webp") !== 0 && lod !== "s") url = cv.toDataURL("image/png"); } catch (e) {}
    return (SERP[lod] = { url: url, tip: [tipS[0] / px * 200, tipS[1] / px * 200], ang: ang });
  }
  function serpent(cls, size) {
    var lod = size === "big" ? "l" : size === "small" ? "s" : "m", md = serpentModel(lod), s = id("ss");
    var tx = md.tip[0].toFixed(1), ty = md.tip[1].toFixed(1);
    return '<svg class="sl-ev-serpent ' + (cls || "") + '" viewBox="0 0 200 200" role="img" aria-label="The Legendary Christmas Serpent: a golden-emerald python coiled with its head raised"><defs>' +
      '<linearGradient id="' + s + '" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff6d8" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<mask id="' + s + 'm" style="mask-type:alpha"><image href="' + md.url + '" x="0" y="0" width="200" height="200"/></mask></defs>' +
      '<g class="breath"><image class="snake" href="' + md.url + '" x="0" y="0" width="200" height="200"/>' +
      // the tongue: a quick double flick now and then, from the snout tip
      '<g transform="translate(' + tx + " " + ty + ") rotate(" + md.ang.toFixed(0) + ')"><path class="tongue" d="M0 0h9l4-2.4M9 0l4 2.4" stroke="#b3263a" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>' +
      // a restrained glint passing over the scales (only on the snake itself)
      '<g mask="url(#' + s + 'm)" opacity=".7"><g transform="skewX(-20)"><rect class="shimmer" x="0" y="0" width="40" height="200" fill="url(#' + s + ')"/></g></g></g>' +
      '<path class="sparkle" d="M168 74l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#fff3c4"/><path class="sparkle" d="M30 66l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z" fill="#fff3c4"/></svg>';
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
