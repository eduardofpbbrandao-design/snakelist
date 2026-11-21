/* SnakeList - Christmas preview: the Christmas Cabin (a tab beside the Species Checklist) and its tasks.
   Only ever runs inside the preview (xmas.js is only loaded with the Christmas switch on). Everything is saved in
   this browser under keys starting "sl-xmas-cabin-"; presents, rewards and decorations stay earned for good.
   The task progress comes from things people really do in SnakeList: the app's own quiz counters (sl-quiz-rounds,
   sl-quiz-correct - the same numbers the Achievements use), the species pages and species boxes opened, the
   Compare panel, the 3D viewer and the Want to see / seen lists. Nothing here changes how SnakeList itself works. */
(function () {
  "use strict";
  var XM = window.XM || {}, D = document;
  var RM = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var KEY = "sl-xmas-cabin-state";
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  var S = load();
  S.species = S.species || []; S.done = S.done || {}; S.opened = S.opened || {}; S.unlocked = S.unlocked || {}; S.deco = S.deco || {};
  if (S.logs == null) S.logs = 3;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function num(k) { try { return +localStorage.getItem(k) || 0; } catch (e) { return 0; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------------- rewards: every one can be put on the tree ---------------- */
  // cat: where it goes; the first of each category with free:true is there from the start
  var ITEMS = {
    "lights-warm":   { cat: "lights",   name: "Warm white fairy lights", free: true },
    "lights-multi":  { cat: "lights",   name: "Coloured fairy lights" },
    "lights-gold":   { cat: "lights",   name: "Twinkling gold lights" },
    "baubles-none":  { cat: "baubles",  name: "No baubles", free: true },
    "baubles-cran":  { cat: "baubles",  name: "Cranberry & gold baubles" },
    "baubles-frost": { cat: "baubles",  name: "Frosted ivory baubles" },
    "baubles-pine":  { cat: "baubles",  name: "Evergreen glass baubles" },
    "ribbon-none":   { cat: "ribbon",   name: "No ribbon", free: true },
    "ribbon-red":    { cat: "ribbon",   name: "Cranberry ribbon bows" },
    "ribbon-gold":   { cat: "ribbon",   name: "Gold ribbon garland" },
    "orn-none":      { cat: "ornament", name: "No snake ornament", free: true },
    "orn-snake":     { cat: "ornament", name: "Coiled snake ornament" },
    "orn-glow":      { cat: "ornament", name: "Glowing snake ornament", special: "5 presents" },
    "top-none":      { cat: "topper",   name: "No topper", free: true },
    "top-star":      { cat: "topper",   name: "Golden star topper" },
    "top-snake":     { cat: "topper",   name: "Gold snake topper", special: "all presents" },
    "stock-plain":   { cat: "stocking", name: "Plain ivory stockings", free: true },
    "stock-knit":    { cat: "stocking", name: "Cranberry knit stockings" },
    "stock-flake":   { cat: "stocking", name: "Evergreen snowflake stockings" },
    "wrap-classic":  { cat: "wrap",     name: "Classic red wrapping", free: true },
    "wrap-gold":     { cat: "wrap",     name: "Gold stripe wrapping" },
    "wrap-tartan":   { cat: "wrap",     name: "Evergreen tartan wrapping" }
  };
  var CATS = [["topper", "Tree topper"], ["lights", "Fairy lights"], ["baubles", "Baubles"], ["ribbon", "Ribbons"], ["ornament", "Snake ornament"], ["stocking", "Stockings"], ["wrap", "Gift wrapping"]];
  Object.keys(ITEMS).forEach(function (k) { if (ITEMS[k].free) S.unlocked[k] = 1; });
  CATS.forEach(function (c) { if (!S.deco[c[0]]) S.deco[c[0]] = Object.keys(ITEMS).filter(function (k) { return ITEMS[k].cat === c[0] && ITEMS[k].free; })[0]; });

  /* ---------------- tasks ---------------- */
  function wantOrSeen() {
    var n = 0; try { n = D.querySelectorAll("#grid .card.wish, #grid .card.done").length; } catch (e) {}
    if (n > (S.want || 0)) { S.want = n; save(); }
    return S.want || 0;
  }
  var TASKS = [
    { id: "quiz-round",  name: "Finish a quiz round",                    goal: 1,  now: function () { return num("sl-quiz-rounds"); }, gifts: ["baubles-cran"], how: "quiz" },
    { id: "quiz-5",      name: "Answer 5 quiz questions correctly",      goal: 5,  now: function () { return num("sl-quiz-correct"); }, gifts: ["ribbon-red"], how: "quiz", note: "across any number of rounds" },
    { id: "species-3",   name: "Explore 3 different species",            goal: 3,  now: function () { return S.species.length; }, gifts: ["orn-snake"], how: "species", note: "species pages or See more info" },
    { id: "compare",     name: "Compare two snakes",                     goal: 1,  now: function () { return S.cmp ? 1 : 0; }, gifts: ["top-star"], how: "compare" },
    { id: "view-3d",     name: "View a snake in 3D",                     goal: 1,  now: function () { return S.v3d ? 1 : 0; }, gifts: ["lights-multi"], how: "3d" },
    { id: "quiz-15",     name: "Answer 15 quiz questions correctly",     goal: 15, now: function () { return num("sl-quiz-correct"); }, gifts: ["stock-knit", "stock-flake"], how: "quiz" },
    { id: "species-10",  name: "Explore 10 different species",           goal: 10, now: function () { return S.species.length; }, gifts: ["wrap-gold", "wrap-tartan", "baubles-frost"], how: "species" },
    { id: "want",        name: "Add a snake to Want to see",             goal: 1,  now: wantOrSeen, gifts: ["lights-gold", "ribbon-gold", "baubles-pine"], how: "want", note: "or mark one you have really seen - optional" }
  ];
  var GLOW_AT = 5;
  function opened() { return TASKS.filter(function (t) { return S.opened[t.id]; }).length; }
  function waiting() { return TASKS.filter(function (t) { return S.done[t.id] && !S.opened[t.id]; }); }

  var lastQuiz = null;
  function evaluate(quiet) {
    var changed = false, fresh = [];
    // a little wood for the basket from every bit of quiz activity
    var q = num("sl-quiz-rounds") + num("sl-quiz-correct");
    if (S.qseen == null) S.qseen = q;
    if (q > S.qseen) { addLogs(Math.min(3, q - S.qseen)); S.qseen = q; changed = true; }
    TASKS.forEach(function (t) {
      if (S.done[t.id]) return;
      if (t.now() >= t.goal) { S.done[t.id] = Date.now(); fresh.push(t); changed = true; }
    });
    if (fresh.length) { addLogs(fresh.length); save(); if (!quiet) toast(); paint(); }
    else if (changed) { save(); paint(); }
  }
  function addLogs(n) { S.logs = Math.min(8, (S.logs || 0) + n); }
  XM.cabinTrack = function (kind, v) {
    if (kind === "species" && v && S.species.indexOf(v) < 0) { S.species.push(v); addLogs(1); }
    else if (kind === "compare" && !S.cmp) { S.cmp = 1; addLogs(1); }
    else if (kind === "3d" && !S.v3d) { S.v3d = 1; addLogs(1); }
    else return;
    save(); evaluate();
  };

  /* ---------------- listening to what people do ---------------- */
  function hooks() {
    // a species page (with the switch on)
    var sp = D.querySelector(".sp-main[data-id]");
    if (sp) XM.cabinTrack("species", sp.getAttribute("data-id"));
    // the app's species boxes: See more info / the species' name on its card
    D.addEventListener("click", function (e) {
      var t = e.target; if (!t.closest) return;
      var c = t.closest("#grid .card[data-id], .cp-row[data-id], [data-sp-id]");
      if (c && (t.closest(".map-btn, .td-card-btn, .card-name, .card-sci") || /See more info/i.test(t.textContent || ""))) XM.cabinTrack("species", c.getAttribute("data-id") || c.getAttribute("data-sp-id"));
      if (t.closest(".sp-realbtn, .sp-anatbtn, .sp3d-open")) XM.cabinTrack("3d");
    }, true);
    var wrapInfo = function () { var f = window.SL_MAP_SPECIES_INFO; if (f && !f.__xm) { var g = function (id) { var r = f.apply(this, arguments); if (r !== false) XM.cabinTrack("species", id); return r; }; g.__xm = 1; window.SL_MAP_SPECIES_INFO = g; } };
    wrapInfo(); setTimeout(wrapInfo, 3000);
    // the 3D viewer (the app's panel locks the page while it is open)
    new MutationObserver(function () { if (D.documentElement.classList.contains("sl3d-lock")) XM.cabinTrack("3d"); })
      .observe(D.documentElement, { attributes: true, attributeFilter: ["class"] });
    // Compare: its sheet open with two snakes side by side
    var cmpWatch = function () {
      var sh = D.querySelector(".cmp-sheet"); if (!sh) return false;
      new MutationObserver(function () { if (sh.classList.contains("open") && sh.querySelectorAll(".cmp-col").length >= 2) XM.cabinTrack("compare"); })
        .observe(sh, { attributes: true, childList: true, subtree: true });
      return true;
    };
    if (!cmpWatch()) setTimeout(cmpWatch, 3000);
    // the quiz counters and the lists: checked now and then (they are the app's own saved numbers)
    evaluate(true);
    setInterval(function () { if (!D.hidden) evaluate(); }, 2500);
  }

  /* ---------------- "A present is waiting in your cabin!" ---------------- */
  function toast() {
    var old = D.getElementById("xm-cabin-toast"); if (old) old.remove();
    var t = D.createElement("div"); t.id = "xm-cabin-toast"; t.setAttribute("role", "status");
    var inApp = XM.kind === "xm-app";
    t.innerHTML = '<span class="xm-ct-gift" aria-hidden="true">' + giftIcon() + '</span><span>A present is waiting in your cabin!</span>' +
      (inApp ? '<button type="button">Open the cabin</button>' : '<a href="' + XM.root + '../?tab=cabin">Open the cabin</a>') + '<button type="button" class="xm-ct-x" aria-label="Close">&times;</button>';
    var b = t.querySelector("button:not(.xm-ct-x)"); if (b) b.onclick = function () { t.remove(); openCabin(true); };
    t.querySelector(".xm-ct-x").onclick = function () { t.remove(); };
    D.body.appendChild(t);
    setTimeout(function () { if (t.isConnected) t.classList.add("xm-ct-out"); setTimeout(function () { t.remove(); }, 400); }, 7000);
  }
  function giftIcon() { return '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="12" rx="2" fill="#A92E3E"/><rect x="2" y="7" width="20" height="4" rx="1.5" fill="#C24555"/><rect x="10.6" y="7" width="2.8" height="14" fill="#E4C57A"/><path d="M12 7c-2-4-6-3-5 0zM12 7c2-4 6-3 5 0z" fill="none" stroke="#E4C57A" stroke-width="1.8"/></svg>'; }
  function treeIcon() { return '<svg class="xm-tree-ic" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 2.5l3.6 5.2h-2.1l3.9 5.3h-2.3l4.4 5.8H4.5l4.4-5.8H6.6l3.9-5.3H8.4z" fill="currentColor"/><rect x="10.7" y="18.8" width="2.6" height="3" rx=".6" fill="currentColor"/><circle cx="12" cy="2.4" r="1.3" fill="#D8B76A"/></svg>'; }

  /* ---------------- the scene ---------------- */
  var C = { root: null, svg: null, fire: null };
  function scene() {
    var planks = "", i;
    for (i = 0; i < 15; i++) planks += '<rect x="' + (i * 70) + '" y="0" width="70" height="470" fill="url(#xc-plank' + (i % 3) + ')"/><path d="M' + (i * 70) + ' 0V470" stroke="#3b2414" stroke-width="2.5" opacity=".6"/>' +
      '<circle cx="' + (i * 70 + 35) + '" cy="' + (60 + (i * 97) % 340) + '" r="3" fill="#5a3820" opacity=".5"/>';
    var boards = ""; for (i = 0; i < 6; i++) boards += '<rect x="0" y="' + (470 + i * 22) + '" width="1000" height="22" fill="' + (i % 2 ? "#6b4226" : "#734829") + '"/><path d="M0 ' + (470 + i * 22) + 'H1000" stroke="#3b2414" stroke-width="1.5" opacity=".55"/>';
    // the garland along the beam, with its fairy lights
    var gl = "", gb = ""; for (i = 0; i < 14; i++) { var x0 = i * 75, xm = x0 + 37; gl += (i ? "" : "M0 40") + "Q" + xm + " 70 " + (x0 + 75) + " 40"; gb += '<circle class="xc-gl xc-gl' + (i % 3) + '" cx="' + xm + '" cy="56" r="4.2"/>'; }
    var stones = "", sc = ["#8d8579", "#7d766b", "#958d80", "#857e72", "#9a9184"];
    for (var row = 0; row < 7; row++) for (var k = 0; k < 5; k++) { var sx = 680 + k * 38 + (row % 2 ? -19 : 0); if (sx < 676 || sx > 836) continue; stones += '<rect x="' + sx + '" y="' + (40 + row * 37) + '" width="35" height="33" rx="6" fill="' + sc[(row * 5 + k) % 5] + '"/>'; }
    for (i = 0; i < 26; i++) { var r = i % 6, col = Math.floor(i / 6); stones += '<rect x="' + (640 + (r * 44) + (col % 2 ? 22 : 0)) + '" y="' + (318 + col * 38) + '" width="40" height="34" rx="7" fill="' + sc[i % 5] + '"/>'; }
    var snow = ""; for (i = 0; i < 28; i++) snow += '<circle class="xc-sn" style="--d:' + (4 + (i * 7) % 6) + "s;--o:-" + ((i * 1.3) % 6).toFixed(1) + 's" cx="' + (95 + (i * 37) % 200) + '" cy="' + (90 + (i * 53) % 200) + '" r="' + (1.2 + (i % 3) * .6) + '"/>';
    return '<svg class="xc-svg" viewBox="0 0 1000 600" role="img" aria-label="A warm wooden cabin with a Christmas tree, presents and a fireplace">' +
      '<defs>' +
      '<linearGradient id="xc-plank0" x1="0" x2="1"><stop offset="0" stop-color="#7a4a2a"/><stop offset=".5" stop-color="#8a5732"/><stop offset="1" stop-color="#754628"/></linearGradient>' +
      '<linearGradient id="xc-plank1" x1="0" x2="1"><stop offset="0" stop-color="#83512e"/><stop offset=".5" stop-color="#93603a"/><stop offset="1" stop-color="#7d4c2b"/></linearGradient>' +
      '<linearGradient id="xc-plank2" x1="0" x2="1"><stop offset="0" stop-color="#704326"/><stop offset=".5" stop-color="#7f4e2d"/><stop offset="1" stop-color="#6b4024"/></linearGradient>' +
      '<radialGradient id="xc-warm" cx=".76" cy=".72" r=".75"><stop offset="0" stop-color="#ffb347" stop-opacity=".42"/><stop offset=".45" stop-color="#ff9a3c" stop-opacity=".12"/><stop offset="1" stop-color="#1a0d05" stop-opacity=".45"/></radialGradient>' +
      '<radialGradient id="xc-treeglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe7a8" stop-opacity=".35"/><stop offset="1" stop-color="#ffe7a8" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="xc-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e2240"/><stop offset="1" stop-color="#2b4a6e"/></linearGradient>' +
      '<linearGradient id="xc-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff7a1a"/><stop offset=".5" stop-color="#ffb02e"/><stop offset="1" stop-color="#fff1a8" stop-opacity=".2"/></linearGradient>' +
      '<linearGradient id="xc-flame2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffd36b"/><stop offset="1" stop-color="#fff6d0" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="xc-tree" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b7a50"/><stop offset=".6" stop-color="#1d5c3c"/><stop offset="1" stop-color="#123d2a"/></linearGradient>' +
      '<pattern id="xc-wrap-classic" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#A92E3E"/><circle cx="4" cy="4" r="1.6" fill="#E4C57A" opacity=".8"/><circle cx="12" cy="12" r="1.6" fill="#FFF8ED" opacity=".7"/></pattern>' +
      '<pattern id="xc-wrap-gold" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="14" height="14" fill="#FFF8ED"/><rect width="6" height="14" fill="#D8B76A"/></pattern>' +
      '<pattern id="xc-wrap-tartan" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#216B45"/><rect y="7" width="20" height="6" fill="#123D2A" opacity=".8"/><rect x="7" width="6" height="20" fill="#123D2A" opacity=".6"/><rect y="9.4" width="20" height="1.2" fill="#A92E3E"/><rect x="9.4" width="1.2" height="20" fill="#E4C57A"/></pattern>' +
      '<clipPath id="xc-win"><rect x="92" y="92" width="206" height="196" rx="4"/></clipPath>' +
      '</defs>' +
      planks + boards +
      // window with a snowy night outside
      '<g><rect x="78" y="78" width="234" height="224" rx="8" fill="#4a2c17"/><g clip-path="url(#xc-win)"><rect x="92" y="92" width="206" height="196" fill="url(#xc-night)"/>' +
      '<circle cx="250" cy="125" r="13" fill="#fff6d8" opacity=".85"/><path d="M92 250Q150 215 210 240T298 228V288H92z" fill="#e8eef2"/><path d="M92 268Q170 245 298 262V288H92z" fill="#f7fafc"/>' +
      '<path d="M120 244l12-34 12 34zM150 236l9-26 9 26zM236 238l10-30 10 30z" fill="#16352a"/><path d="M126 228l6-16 6 16zM241 222l5-14 5 14z" fill="#e8eef2" opacity=".8"/>' + snow + '</g>' +
      '<path d="M195 92V288M92 190H298" stroke="#4a2c17" stroke-width="9"/><rect x="70" y="298" width="250" height="16" rx="4" fill="#5a3620"/><path d="M74 298q60-12 120-2t122 0" fill="none" stroke="#fdfdfd" stroke-width="7" stroke-linecap="round"/></g>' +
      // fireplace
      '<g class="xc-fireplace"><rect x="672" y="20" width="198" height="300" fill="#5e574d"/>' +
      stones + '<path d="M700 470V400Q700 352 770 352Q840 352 840 400V470z" fill="#1c1410"/>' +
      '<rect x="626" y="296" width="290" height="26" rx="5" fill="#5a3620"/><rect x="626" y="296" width="290" height="6" rx="3" fill="#7a4d2c"/>' +
      '<g class="xc-stockings"></g>' +
      '<g class="xc-firelight"><ellipse cx="770" cy="452" rx="62" ry="16" fill="#ff8a2a" opacity=".35"/></g>' +
      '<g class="xc-logs-in"><rect x="726" y="440" width="88" height="16" rx="8" fill="#5b3a22"/><rect x="738" y="430" width="70" height="14" rx="7" fill="#6e4628" transform="rotate(-8 773 437)"/></g>' +
      '<g class="xc-fire"><path class="xc-f1" d="M732 446Q726 410 750 386Q748 410 762 418Q760 380 784 360Q782 398 800 410Q806 392 804 380Q824 410 810 446z" fill="url(#xc-flame)"/>' +
      '<path class="xc-f2" d="M748 446Q744 420 760 404Q762 424 774 428Q774 402 790 392Q792 420 800 430Q806 440 796 446z" fill="url(#xc-flame2)"/>' +
      '<path class="xc-f3" d="M760 446Q758 432 768 424Q772 436 780 436Q784 426 792 422Q796 438 788 446z" fill="#fff3c4" opacity=".9"/></g>' +
      '<g class="xc-sparks"></g>' +
      '<rect x="690" y="462" width="160" height="14" rx="3" fill="#4b4339"/></g>' +
      // the log basket
      '<g class="xc-basket" transform="translate(880 488)"><g class="xc-basket-logs"></g><path d="M-6 30H96L88 80H2z" fill="#9a6b3a"/><path d="M-6 30H96L88 80H2z" fill="none" stroke="#6b4423" stroke-width="3"/>' +
      '<path d="M0 42H92M2 54H90M3 66H89" stroke="#6b4423" stroke-width="2" opacity=".7"/><path d="M14 30V80M34 30V80M54 30V80M74 30V80" stroke="#6b4423" stroke-width="1.5" opacity=".5"/></g>' +
      // the beam and garland
      '<rect x="0" y="0" width="1000" height="34" fill="#4a2c17"/><rect x="0" y="30" width="1000" height="6" fill="#3a2212"/>' +
      '<path d="' + gl + '" fill="none" stroke="#174d33" stroke-width="15" stroke-linecap="round"/><path d="' + gl + '" fill="none" stroke="#2b7a50" stroke-width="9" stroke-dasharray="2 4" stroke-linecap="round"/>' +
      '<g class="xc-glights">' + gb + '</g>' +
      '<ellipse cx="470" cy="548" rx="260" ry="40" fill="#8d2233" opacity=".85"/><ellipse cx="470" cy="548" rx="236" ry="32" fill="none" stroke="#E4C57A" stroke-width="3" stroke-dasharray="10 8" opacity=".7"/>' +
      // the tree
      '<g class="xc-tree"><ellipse cx="460" cy="300" rx="190" ry="250" fill="url(#xc-treeglow)"/><rect x="446" y="480" width="28" height="44" fill="#5b3a22"/>' +
      '<path d="M460 70L560 200H520L600 310H545L630 440H560L650 500H270L360 440H290L375 310H320L400 200H360z" fill="url(#xc-tree)"/>' +
      '<path d="M460 70L400 200H430L375 310H410L360 440H400L340 500H460z" fill="#0f3323" opacity=".28"/>' +
      '<path d="M360 200L375 214 392 204 410 216 430 206 450 218 470 206 490 218 510 206 528 216 545 204 560 214 560 200z M320 310L338 326 358 314 380 328 402 316 425 330 448 318 470 330 492 318 515 330 538 316 560 328 582 314 600 326 600 310z M290 440L312 458 338 444 362 460 388 446 414 462 440 448 466 462 492 448 518 462 544 446 570 460 596 444 622 458 630 440z" fill="#174d33"/>' +
      '<g class="xc-ribbon"></g><g class="xc-tlights"></g><g class="xc-baubles"></g><g class="xc-orn"></g><g class="xc-topper"></g></g>' +
      '<g class="xc-presents"></g>' +
      '<rect class="xc-warmth" x="0" y="0" width="1000" height="600" fill="url(#xc-warm)" pointer-events="none"/>' +
      '</svg>';
  }

  /* ---------------- decorations on the tree ---------------- */
  var LIGHT_PTS = [[440, 128], [478, 150], [420, 178], [500, 186], [398, 236], [452, 252], [520, 246], [372, 288], [430, 296], [494, 300], [556, 284], [350, 352], [412, 372], [478, 380], [540, 370], [590, 352], [330, 420], [392, 440], [458, 452], [526, 446], [600, 424], [312, 486], [380, 492], [540, 492], [610, 484]];
  var BAUBLE_PTS = [[452, 160], [404, 222], [512, 214], [360, 298], [462, 330], [566, 304], [404, 404], [520, 412], [336, 470], [460, 478], [590, 462]];
  function renderTree() {
    if (!C.svg) return;
    var q = function (s) { return C.svg.querySelector(s); };
    var d = S.deco;
    // lights
    var lc = d.lights === "lights-multi" ? ["#ff5d5d", "#ffd34d", "#5dd0ff", "#7dff8a", "#ff8cf0"] : d.lights === "lights-gold" ? ["#ffd46b", "#f5c04a", "#ffe7a1"] : ["#ffe9a8", "#fff1c4", "#ffd98a"];
    q(".xc-tlights").innerHTML = LIGHT_PTS.map(function (p, i) { var c = lc[i % lc.length]; return '<g class="xc-tl xc-tl' + (i % 3) + (d.lights === "lights-gold" ? " xc-tw" : "") + '"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="12" fill="' + c + '" opacity=".4"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="' + c + '"/></g>'; }).join("");
    // baubles
    var bc = { "baubles-cran": ["#A92E3E", "#D8B76A"], "baubles-frost": ["#FFF8ED", "#dfe8ee"], "baubles-pine": ["#2B7A50", "#5fb0d8"] }[d.baubles];
    q(".xc-baubles").innerHTML = bc ? BAUBLE_PTS.map(function (p, i) { var c = bc[i % 2]; return '<g><line x1="' + p[0] + '" y1="' + (p[1] - 16) + '" x2="' + p[0] + '" y2="' + (p[1] - 10) + '" stroke="#D8B76A" stroke-width="1.5"/><rect x="' + (p[0] - 4) + '" y="' + (p[1] - 13) + '" width="8" height="5" rx="1.5" fill="#D8B76A"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="10" fill="' + c + '"/><circle cx="' + (p[0] - 3.5) + '" cy="' + (p[1] - 3.5) + '" r="3" fill="#fff" opacity=".55"/>' + (d.baubles === "baubles-frost" ? '<path d="M' + (p[0] - 6) + " " + p[1] + "h12M" + p[0] + " " + (p[1] - 6) + "v12" + '" stroke="#c9d8e2" stroke-width="1.4"/>' : "") + "</g>"; }).join("") : "";
    // ribbon
    var rb = "";
    if (d.ribbon === "ribbon-red") rb = [[430, 230], [500, 268], [380, 356], [560, 340], [430, 420], [520, 470]].map(function (p) { return bow(p[0], p[1], "#A92E3E", "#7c1d2b"); }).join("");
    else if (d.ribbon === "ribbon-gold") rb = '<path d="M408 150Q470 190 520 170M380 250Q470 300 560 262M350 360Q470 420 590 372M318 450Q470 520 622 462" fill="none" stroke="#D8B76A" stroke-width="7" stroke-linecap="round" opacity=".95"/><path d="M408 150Q470 190 520 170M380 250Q470 300 560 262M350 360Q470 420 590 372M318 450Q470 520 622 462" fill="none" stroke="#fff1c2" stroke-width="2" stroke-linecap="round" opacity=".7"/>';
    q(".xc-ribbon").innerHTML = rb;
    // snake ornament
    q(".xc-orn").innerHTML = d.ornament === "orn-snake" ? snakeOrn(540, 236, false) : d.ornament === "orn-glow" ? snakeOrn(540, 236, true) : "";
    // topper
    q(".xc-topper").innerHTML = d.topper === "top-star" ? '<g class="xc-star"><path d="M460 34l10 22 24 2-18 16 6 24-22-13-22 13 6-24-18-16 24-2z" fill="#E4C57A" stroke="#a8842f" stroke-width="2"/><circle cx="460" cy="60" r="30" fill="#ffe7a8" opacity=".25"/></g>' :
      d.topper === "top-snake" ? '<g class="xc-gsnake"><circle cx="460" cy="56" r="38" fill="#ffe7a8" opacity=".3"/><path d="M440 88c-10-22 36-20 30-40s-40-10-30-26 36-8 40 4" fill="none" stroke="#b8902f" stroke-width="11" stroke-linecap="round"/><path d="M440 88c-10-22 36-20 30-40s-40-10-30-26 36-8 40 4" fill="none" stroke="#F1D58A" stroke-width="7" stroke-linecap="round"/><ellipse cx="482" cy="28" rx="10" ry="7" fill="#E4C57A" stroke="#b8902f" stroke-width="2"/><circle cx="485" cy="26" r="1.8" fill="#123D2A"/><path d="M491 30l7 2m0 0l3-2m-3 2l3 3" stroke="#A92E3E" stroke-width="1.4" stroke-linecap="round"/></g>' : "";
    // stockings on the mantel
    q(".xc-stockings").innerHTML = [672, 740, 808, 872].map(function (x, i) { return stocking(x, 316, d.stocking, i); }).join("");
    renderPresents(); renderLogs();
  }
  function bow(x, y, c, dk) { return '<g><path d="M' + x + " " + y + "c-14-10-18 6-4 6zM" + x + " " + y + 'c14-10 18 6 4 6z" fill="' + c + '" stroke="' + dk + '" stroke-width="1"/><path d="M' + (x - 2) + " " + (y + 3) + "l-6 12M" + (x + 2) + " " + (y + 3) + 'l6 12" stroke="' + c + '" stroke-width="3" stroke-linecap="round"/><circle cx="' + x + '" cy="' + (y + 2) + '" r="3" fill="' + dk + '"/></g>'; }
  function snakeOrn(x, y, glow) {
    var body = glow ? "#bdf5a8" : "#58b351", pat = glow ? "#4fd36a" : "#1e3a24";
    return '<g class="' + (glow ? "xc-glow" : "") + '">' + (glow ? '<circle cx="' + x + '" cy="' + (y + 8) + '" r="34" fill="#c9ffb0" opacity=".35" class="xc-halo"/>' : "") +
      '<line x1="' + x + '" y1="' + (y - 26) + '" x2="' + x + '" y2="' + (y - 12) + '" stroke="#D8B76A" stroke-width="1.5"/>' +
      '<path d="M' + (x - 14) + " " + (y + 20) + "c-8-14 30-12 26-26s-28-8-22-18 24-4 26 4" + '" fill="none" stroke="' + body + '" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M' + (x - 14) + " " + (y + 20) + "c-8-14 30-12 26-26s-28-8-22-18 24-4 26 4" + '" fill="none" stroke="' + pat + '" stroke-width="2.2" stroke-dasharray="2 5" stroke-linecap="round"/>' +
      '<ellipse cx="' + (x + 16) + '" cy="' + (y - 18) + '" rx="7" ry="5" fill="' + body + '"/><circle cx="' + (x + 18) + '" cy="' + (y - 19) + '" r="1.4" fill="#123D2A"/></g>';
  }
  function stocking(x, y, kind, i) {
    var c = kind === "stock-knit" ? "#A92E3E" : kind === "stock-flake" ? "#216B45" : "#FFF8ED", cuff = kind === "stock-plain" ? "#D8B76A" : "#FFF8ED";
    var deco = kind === "stock-knit" ? '<path d="M' + (x - 8) + " " + (y + 30) + "h20M" + (x - 8) + " " + (y + 40) + 'h20" stroke="#E4C57A" stroke-width="2" stroke-dasharray="3 3"/>' :
      kind === "stock-flake" ? '<g stroke="#FFF8ED" stroke-width="1.6" stroke-linecap="round"><path d="M' + (x + 2) + " " + (y + 28) + "v14M" + (x - 5) + " " + (y + 35) + "h14M" + (x - 3) + " " + (y + 30) + "l10 10M" + (x + 7) + " " + (y + 30) + 'l-10 10"/></g>' : "";
    return '<g><path d="M' + (x - 10) + " " + (y + 4) + "h24v38c0 8 4 10 12 12 8 2 8 14-2 14h-18c-10 0-16-6-16-16z" + '" fill="' + c + '" stroke="#5a3620" stroke-width="1.5"/>' + deco +
      '<rect x="' + (x - 13) + '" y="' + y + '" width="30" height="11" rx="4" fill="' + cuff + '" stroke="#5a3620" stroke-width="1"/></g>';
  }
  var PRESENT_PTS = [[330, 516, 54, 40], [392, 528, 46, 34], [520, 520, 58, 44], [588, 530, 44, 32], [446, 534, 40, 30], [274, 534, 42, 30], [640, 536, 40, 28], [480, 552, 36, 24]];
  function renderPresents() {
    if (!C.svg) return;
    var w = waiting(), wrap = S.deco.wrap || "wrap-classic", rib = wrap === "wrap-gold" ? "#A92E3E" : wrap === "wrap-tartan" ? "#E4C57A" : "#E4C57A";
    C.svg.querySelector(".xc-presents").innerHTML = w.map(function (t, i) {
      var p = PRESENT_PTS[i % PRESENT_PTS.length], x = p[0], y = p[1], pw = p[2], ph = p[3];
      return '<g class="xc-present" tabindex="0" role="button" data-task="' + t.id + '" aria-label="Open the present for: ' + esc(t.name) + '" style="--px:' + x + 'px;--py:' + y + 'px">' +
        '<ellipse class="xc-pglow" cx="' + x + '" cy="' + (y + ph / 2) + '" rx="' + (pw * .8) + '" ry="10" fill="#ffe7a8" opacity=".5"/>' +
        '<rect x="' + (x - pw / 2) + '" y="' + (y - ph / 2) + '" width="' + pw + '" height="' + ph + '" rx="3" fill="url(#xc-' + wrap + ')" stroke="rgba(0,0,0,.25)"/>' +
        '<rect x="' + (x - pw / 2 - 3) + '" y="' + (y - ph / 2 - 8) + '" width="' + (pw + 6) + '" height="10" rx="2" fill="url(#xc-' + wrap + ')" stroke="rgba(0,0,0,.25)"/>' +
        '<rect x="' + (x - 3) + '" y="' + (y - ph / 2 - 8) + '" width="6" height="' + (ph + 8) + '" fill="' + rib + '"/>' +
        '<path d="M' + x + " " + (y - ph / 2 - 8) + "c-10-12-20-2-6 2zM" + x + " " + (y - ph / 2 - 8) + 'c10-12 20-2 6 2z" fill="none" stroke="' + rib + '" stroke-width="3"/>' +
        '<path class="xc-shine" d="M' + (x - pw / 2 + 4) + " " + (y - ph / 2 + 4) + "l10 0" + '" stroke="#fff" stroke-width="2" opacity=".6"/></g>';
    }).join("");
  }
  function renderLogs() {
    if (!C.svg) return;
    var n = S.logs || 0, out = "";
    for (var i = 0; i < n; i++) { var row = Math.floor(i / 3), col = i % 3; out += '<g transform="translate(' + (8 + col * 27 + (row % 2) * 12) + " " + (24 - row * 14) + ')"><rect width="30" height="14" rx="7" fill="#6e4628" stroke="#4b2e18"/><ellipse cx="28" cy="7" rx="5" ry="6" fill="#c9a06b" stroke="#4b2e18"/></g>'; }
    C.svg.querySelector(".xc-basket-logs").innerHTML = out;
    var b = C.root && C.root.querySelector(".xc-log"); if (b) { b.disabled = !n; b.querySelector("b").textContent = n; }
  }

  /* ---------------- the cabin panel ---------------- */
  function progressText() {
    var o = opened(), all = TASKS.length;
    if (o >= all) return "All " + all + " presents opened - the Christmas collection is complete!";
    if (o < GLOW_AT) return o + " of " + GLOW_AT + " presents opened";
    return o + " of " + all + " presents opened";
  }
  function goalText() {
    var o = opened();
    if (o < GLOW_AT) return "Open " + GLOW_AT + " presents for a glowing snake ornament";
    if (o < TASKS.length) return "Open all " + TASKS.length + " for the gold snake tree topper";
    return "Gold snake topper unlocked";
  }
  function build() {
    if (C.root) return C.root;
    var r = D.createElement("section"); r.id = "xm-cabin"; r.className = "xc"; r.hidden = true; r.setAttribute("aria-label", "Christmas Cabin");
    r.innerHTML = '<div class="xc-head"><h2>' + treeIcon() + ' Christmas Cabin</h2><p class="xc-prog" aria-live="polite"></p></div>' +
      '<div class="xc-stage">' + scene() + '<div class="xc-celebrate" hidden></div></div>' +
      '<p class="xc-goal"></p>' +
      '<div class="xc-bar">' +
      '<button type="button" class="xc-btn xc-tasks">' + giftIcon() + '<span>Christmas tasks</span><i class="xc-badge" hidden></i></button>' +
      '<button type="button" class="xc-btn xc-decos"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="14" r="7" fill="#A92E3E"/><rect x="9.5" y="4.5" width="5" height="3" rx="1" fill="#D8B76A"/><circle cx="9.5" cy="11.5" r="2" fill="#fff" opacity=".6"/></svg><span>My decorations</span></button>' +
      '<button type="button" class="xc-btn xc-log"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 1-8z" fill="#ff9a3c"/><rect x="4" y="18" width="16" height="4" rx="2" fill="#6e4628"/></svg><span>Add a log</span><b>0</b></button>' +
      '<button type="button" class="xc-btn xc-sound" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path class="xc-snd-on" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path class="xc-snd-off" d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Fireplace sound: off</span></button>' +
      '</div>' +
      '<div class="xc-dlg xc-dlg-tasks" role="dialog" aria-modal="true" aria-labelledby="xc-t-h" hidden><div class="xc-card"><button type="button" class="xc-x" aria-label="Close">&times;</button><h3 id="xc-t-h">Christmas tasks</h3><p class="xc-sub">Each task puts a wrapped present under the tree - every present can be opened once.</p><ol class="xc-tlist"></ol></div></div>' +
      '<div class="xc-dlg xc-dlg-decos" role="dialog" aria-modal="true" aria-labelledby="xc-d-h" hidden><div class="xc-card"><button type="button" class="xc-x" aria-label="Close">&times;</button><h3 id="xc-d-h">My decorations</h3><p class="xc-sub">Choose what goes on your tree. Open presents to unlock more.</p><div class="xc-dlist"></div></div></div>' +
      '<div class="xc-open" role="dialog" aria-modal="true" aria-label="Opening a present" hidden></div>';
    C.root = r; C.svg = r.querySelector(".xc-svg");
    r.querySelector(".xc-tasks").onclick = function () { showDlg("tasks"); };
    r.querySelector(".xc-decos").onclick = function () { showDlg("decos"); };
    r.querySelector(".xc-log").onclick = addLog;
    r.querySelector(".xc-sound").onclick = toggleSound;
    r.addEventListener("click", function (e) {
      if (e.target.closest(".xc-x")) { hideDlgs(); return; }
      if (e.target.classList && e.target.classList.contains("xc-dlg")) { hideDlgs(); return; }
      var p = e.target.closest(".xc-present"); if (p) openPresent(p.getAttribute("data-task"));
      var tb = e.target.closest("[data-open-task]"); if (tb) { hideDlgs(); openPresent(tb.getAttribute("data-open-task")); }
      var hw = e.target.closest("[data-how]"); if (hw) { hideDlgs(); how(hw.getAttribute("data-how")); }
      var dc = e.target.closest("[data-deco]"); if (dc && !dc.disabled) { var it = ITEMS[dc.getAttribute("data-deco")]; S.deco[it.cat] = dc.getAttribute("data-deco"); save(); renderTree(); paintDecos(); }
    });
    r.addEventListener("keydown", function (e) {
      var p = e.target.closest && e.target.closest(".xc-present");
      if (p && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openPresent(p.getAttribute("data-task")); }
      if (e.key === "Escape") { if (!r.querySelector(".xc-open").hidden) closeOpen(); else hideDlgs(); }
    });
    renderTree(); paint();
    return r;
  }
  function paint() {
    if (!C.root) return;
    C.root.querySelector(".xc-prog").textContent = progressText();
    C.root.querySelector(".xc-goal").textContent = goalText();
    var w = waiting().length, bd = C.root.querySelector(".xc-badge"); bd.hidden = !w; bd.textContent = w;
    renderPresents(); renderLogs(); paintTasks(); paintDecos();
    var tab = D.getElementById("tab-cabin"); if (tab) tab.classList.toggle("xm-has-gift", !!w);
  }
  function paintTasks() {
    var ol = C.root && C.root.querySelector(".xc-tlist"); if (!ol) return;
    ol.innerHTML = TASKS.map(function (t) {
      var done = !!S.done[t.id], op = !!S.opened[t.id], n = done ? t.goal : Math.min(t.now(), t.goal);   // done stays done
      var reward = t.gifts.map(function (g) { return ITEMS[g].name; }).join(", ");
      var act = op ? '<span class="xc-st xc-st-op">Opened</span>' : done ? '<button type="button" class="xc-st xc-st-go" data-open-task="' + t.id + '">Open present</button>' :
        '<button type="button" class="xc-st xc-st-how" data-how="' + t.how + '">Show me how</button>';
      return '<li class="' + (op ? "op" : done ? "ready" : "") + '"><div class="xc-tt"><b>' + esc(t.name) + "</b>" + (t.note ? "<small>" + esc(t.note) + "</small>" : "") +
        '<span class="xc-rw">Reward: ' + esc(reward) + '</span><span class="xc-pbar" role="progressbar" aria-valuemin="0" aria-valuemax="' + t.goal + '" aria-valuenow="' + n + '" aria-label="' + esc(t.name) + '"><i style="width:' + (n / t.goal * 100) + '%"></i></span><span class="xc-pn">' + n + " / " + t.goal + "</span></div>" + act + "</li>";
    }).join("") +
      '<li class="xc-ms ' + (S.unlocked["orn-glow"] ? "op" : "") + '"><div class="xc-tt"><b>Open ' + GLOW_AT + ' presents</b><span class="xc-rw">Reward: Glowing snake ornament</span></div><span class="xc-st ' + (S.unlocked["orn-glow"] ? "xc-st-op" : "") + '">' + (S.unlocked["orn-glow"] ? "Unlocked" : opened() + " / " + GLOW_AT) + "</span></li>" +
      '<li class="xc-ms ' + (S.unlocked["top-snake"] ? "op" : "") + '"><div class="xc-tt"><b>Complete the Christmas collection</b><span class="xc-rw">Reward: Gold snake tree topper</span></div><span class="xc-st ' + (S.unlocked["top-snake"] ? "xc-st-op" : "") + '">' + (S.unlocked["top-snake"] ? "Unlocked" : opened() + " / " + TASKS.length) + "</span></li>";
  }
  function paintDecos() {
    var box = C.root && C.root.querySelector(".xc-dlist"); if (!box) return;
    box.innerHTML = CATS.map(function (c) {
      var ks = Object.keys(ITEMS).filter(function (k) { return ITEMS[k].cat === c[0]; });
      return '<fieldset><legend>' + c[1] + '</legend><div class="xc-opts">' + ks.map(function (k) {
        var it = ITEMS[k], un = !!S.unlocked[k], on = S.deco[c[0]] === k;
        var hint = un ? "" : it.special ? "Open " + it.special : "Open a present";
        return '<button type="button" class="xc-opt' + (on ? " on" : "") + '" data-deco="' + k + '" aria-pressed="' + on + '"' + (un ? "" : " disabled") + '>' + swatch(k) + '<span>' + esc(it.name) + (hint ? "<small>" + hint + "</small>" : "") + "</span></button>";
      }).join("") + "</div></fieldset>";
    }).join("");
  }
  function swatch(k) {
    var m = { "lights-warm": "#fff1c4", "lights-multi": "conic-gradient(#ff5d5d 0 25%,#ffd34d 0 50%,#5dd0ff 0 75%,#7dff8a 0)", "lights-gold": "#E4C57A", "baubles-none": "transparent", "baubles-cran": "linear-gradient(135deg,#A92E3E 50%,#D8B76A 0)",
      "baubles-frost": "#FFF8ED", "baubles-pine": "linear-gradient(135deg,#2B7A50 50%,#5fb0d8 0)", "ribbon-none": "transparent", "ribbon-red": "#A92E3E", "ribbon-gold": "#D8B76A", "orn-none": "transparent", "orn-snake": "#58b351",
      "orn-glow": "radial-gradient(#e8ffd8,#4fd36a)", "top-none": "transparent", "top-star": "#E4C57A", "top-snake": "linear-gradient(135deg,#F1D58A,#b8902f)", "stock-plain": "#FFF8ED", "stock-knit": "#A92E3E", "stock-flake": "#216B45",
      "wrap-classic": "radial-gradient(#E4C57A 20%,#A92E3E 22%)", "wrap-gold": "repeating-linear-gradient(35deg,#D8B76A 0 5px,#FFF8ED 0 10px)", "wrap-tartan": "linear-gradient(#216B45,#123D2A)" };
    return '<i class="xc-sw" style="background:' + m[k] + '"></i>';
  }
  function showDlg(n) { hideDlgs(); var d = C.root.querySelector(".xc-dlg-" + n); paint(); d.hidden = false; var x = d.querySelector(".xc-x"); try { x.focus({ preventScroll: true }); } catch (e) {} }
  function hideDlgs() { if (!C.root) return; [].forEach.call(C.root.querySelectorAll(".xc-dlg"), function (d) { d.hidden = true; }); }

  /* ---------------- show me how: straight to the real feature ---------------- */
  function how(k) {
    if (k === "quiz") { var q = D.getElementById("tab-quiz"); if (q) q.click(); return; }
    if (k === "want" || k === "species") { var g = D.getElementById("tab-guide"); if (g) g.click(); setTimeout(function () { var c = D.querySelector("#grid .card"); if (c) c.scrollIntoView({ block: "center", behavior: RM.matches ? "auto" : "smooth" }); }, 300); return; }
    var id = randomSpecies();
    if (k === "compare" && window.SL_compare && id) { window.SL_compare(id); return; }
    if (k === "3d" && window.SL_3D && window.SL_3D.panel) { var cs = D.querySelectorAll("#grid .card[data-id]"), c2 = cs[Math.floor(Math.random() * Math.min(cs.length, 30))], sci = c2 && ((c2.querySelector(".card-sci") || c2.querySelector(".card-name") || {}).textContent || "");
      var key = String(sci).trim().toLowerCase().split(/\s+/).slice(0, 2).join("-").replace(/[^a-z-]+/g, "") || "oxyuranus-microlepidotus";
      window.SL_3D.panel(key, null, (c2 && (c2.querySelector(".card-name") || {}).textContent) || ""); }
  }
  function randomSpecies() { var cs = D.querySelectorAll("#grid .card[data-id]"); if (!cs.length) return null; return cs[Math.floor(Math.random() * Math.min(cs.length, 40))].getAttribute("data-id"); }

  /* ---------------- opening a present ---------------- */
  var openT = [];
  function openPresent(id) {
    var t = TASKS.filter(function (x) { return x.id === id; })[0]; if (!t || !S.done[id] || S.opened[id]) return;
    // the reward is the person's straight away, whatever happens to the animation
    S.opened[id] = Date.now(); var got = t.gifts.slice();
    got.forEach(function (g) { S.unlocked[g] = 1; });
    var o = opened();
    if (o >= GLOW_AT && !S.unlocked["orn-glow"]) { S.unlocked["orn-glow"] = 1; got.push("orn-glow"); }
    if (o >= TASKS.length && !S.unlocked["top-snake"]) { S.unlocked["top-snake"] = 1; got.push("top-snake"); S.celebrate = 1; }
    save(); paint();
    var ov = C.root.querySelector(".xc-open"), wrap = S.deco.wrap || "wrap-classic";
    ov.innerHTML = '<div class="xc-ob"><div class="xc-gift xc-gift-' + wrap + '"><i class="xc-lid"></i><i class="xc-box"></i><i class="xc-rib"></i><i class="xc-bow"></i><i class="xc-paper l"></i><i class="xc-paper r"></i></div>' +
      '<div class="xc-reveal" hidden><p class="xc-rk">You unwrapped</p>' + got.map(function (g) { return '<div class="xc-ritem">' + swatch(g) + "<b>" + esc(ITEMS[g].name) + "</b></div>"; }).join("") +
      '<p class="xc-rsub">Added to My decorations' + (o >= TASKS.length ? "" : "") + '.</p><div class="xc-racts"><button type="button" class="xc-btn xc-use">Put it on the tree</button><button type="button" class="xc-btn xc-done">Close</button></div></div>' +
      '<button type="button" class="xc-skip">Open now</button><button type="button" class="xc-x" aria-label="Close">&times;</button></div>';
    ov.hidden = false; ov.className = "xc-open"; void ov.offsetWidth;
    var reveal = function () { openT.forEach(clearTimeout); openT = []; ov.classList.add("xc-o3"); ov.querySelector(".xc-reveal").hidden = false; ov.querySelector(".xc-skip").hidden = true; try { ov.querySelector(".xc-use").focus({ preventScroll: true }); } catch (e) {} };
    ov.querySelector(".xc-skip").onclick = reveal;
    ov.querySelector(".xc-x").onclick = closeOpen;
    ov.querySelector(".xc-done").onclick = closeOpen;
    ov.querySelector(".xc-use").onclick = function () { got.forEach(function (g) { S.deco[ITEMS[g].cat] = g; }); save(); renderTree(); closeOpen(); };
    if (RM.matches) { reveal(); return; }
    try { ov.querySelector(".xc-skip").focus({ preventScroll: true }); } catch (e) {}
    ov.classList.add("xc-o1");                                         // forward and a little wobble
    var slow = window.XM_CABIN_SLOW || 1;                               // (screenshots of the in-between steps can slow it down)
    openT.push(setTimeout(function () { ov.classList.add("xc-o2"); }, 700 * slow));   // ribbon off, lid up, paper parts
    openT.push(setTimeout(reveal, 1700 * slow));
  }
  function closeOpen() {
    openT.forEach(clearTimeout); openT = [];
    var ov = C.root.querySelector(".xc-open"); ov.hidden = true; ov.innerHTML = "";
    if (S.celebrate) { S.celebrate = 0; save(); celebrate(); }
  }
  function celebrate() {
    var c = C.root.querySelector(".xc-celebrate"); c.hidden = false;
    var sp = ""; for (var i = 0; i < (RM.matches ? 0 : 40); i++) sp += '<i style="--x:' + (Math.random() * 100).toFixed(1) + "%;--d:" + (1.6 + Math.random() * 1.6).toFixed(2) + "s;--w:" + (Math.random() * .8).toFixed(2) + 's"></i>';
    c.innerHTML = sp + '<div class="xc-cmsg" role="status"><b>The Christmas collection is complete!</b><span>The gold snake topper is yours - it is on your tree now.</span><button type="button" class="xc-btn">Lovely</button></div>';
    S.deco.topper = "top-snake"; save(); renderTree();
    c.querySelector("button").onclick = function () { c.hidden = true; c.innerHTML = ""; };
  }

  /* ---------------- the fire ---------------- */
  function addLog() {
    if (!(S.logs > 0)) return;
    S.logs--; save(); renderLogs();
    var st = C.root.querySelector(".xc-stage"); st.classList.remove("xc-roar"); void st.offsetWidth; st.classList.add("xc-roar");
    setTimeout(function () { st.classList.remove("xc-roar"); }, 2600);
    if (!RM.matches) {
      var g = C.svg.querySelector(".xc-sparks"), s = "";
      for (var i = 0; i < 12; i++) s += '<circle class="xc-spk" cx="' + (750 + Math.random() * 40) + '" cy="420" r="' + (1.5 + Math.random() * 1.8).toFixed(1) + '" style="--dx:' + (Math.random() * 40 - 20).toFixed(0) + "px;--dl:" + (Math.random() * .6).toFixed(2) + 's"/>';
      g.innerHTML = s; setTimeout(function () { g.innerHTML = ""; }, 2800);
    }
    if (snd.on) snd.burst();
  }
  // fireplace sound: made on the spot with Web Audio (soft filtered noise and the odd crackle) - nothing downloaded
  var snd = { on: false, ctx: null, gain: null, t: 0 };
  snd.start = function () {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    if (!snd.ctx) {
      snd.ctx = new AC(); var ctx = snd.ctx, len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), last = 0;
      for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }   // brown noise: a low rumble
      var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
      snd.gain = ctx.createGain(); snd.gain.gain.value = 0;
      src.connect(lp); lp.connect(snd.gain); snd.gain.connect(ctx.destination); src.start();
    }
    if (snd.ctx.state === "suspended") snd.ctx.resume();
    snd.gain.gain.setTargetAtTime(0.16, snd.ctx.currentTime, 0.4);
    var crackle = function () { if (!snd.on) return; snd.pop(0.05 + Math.random() * 0.08); snd.t = setTimeout(crackle, 180 + Math.random() * 900); };
    crackle(); return true;
  };
  snd.pop = function (vol) {
    var ctx = snd.ctx; if (!ctx) return;
    var n = Math.floor(ctx.sampleRate * 0.03), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
    var s = ctx.createBufferSource(); s.buffer = b; var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1200 + Math.random() * 2000;
    var g = ctx.createGain(); g.gain.value = vol; s.connect(hp); hp.connect(g); g.connect(ctx.destination); s.start();
  };
  snd.burst = function () { for (var i = 0; i < 6; i++) setTimeout(function () { snd.pop(0.12); }, i * 90 + Math.random() * 60); };
  snd.stop = function () { clearTimeout(snd.t); if (snd.ctx && snd.gain) snd.gain.gain.setTargetAtTime(0, snd.ctx.currentTime, 0.2); };
  function toggleSound() {
    var b = C.root.querySelector(".xc-sound");
    snd.on = !snd.on;
    if (snd.on && !snd.start()) snd.on = false;
    if (!snd.on) snd.stop();
    b.setAttribute("aria-pressed", String(snd.on)); b.querySelector("span").textContent = "Fireplace sound: " + (snd.on ? "on" : "off");
  }

  /* ---------------- the tab ---------------- */
  function tabBtn() {
    var g = D.getElementById("tab-guide"); if (!g || D.getElementById("tab-cabin")) return !!g;
    var b = D.createElement("button"); b.className = "tab-btn xm-tab-cabin"; b.id = "tab-cabin"; b.type = "button";
    b.innerHTML = treeIcon() + " Christmas Cabin";
    g.parentNode.insertBefore(b, g.nextSibling);
    b.addEventListener("click", function () { openCabin(false); });
    // any other tab leaves the cabin
    g.parentNode.addEventListener("click", function (e) { var t = e.target.closest && e.target.closest(".tab-btn"); if (t && t.id !== "tab-cabin") closeCabin(); });
    window.addEventListener("popstate", function () { var q = new URLSearchParams(location.search).get("tab"); if (q === "cabin") openCabin(false); else closeCabin(); });
    return true;
  }
  function openCabin(push) {
    var r = build();
    if (!r.isConnected) { var tabs = D.querySelector(".tabs"); tabs.parentNode.insertBefore(r, tabs.nextSibling); }
    r.hidden = false; D.body.classList.add("xm-cabin-on");
    var b = D.getElementById("tab-cabin"); if (b) { b.classList.add("xm-active"); b.setAttribute("aria-current", "page"); }
    if (push && new URLSearchParams(location.search).get("tab") !== "cabin") { var u = new URL(location.href); u.searchParams.set("tab", "cabin"); try { history.pushState({ slTab: "cabin" }, "", u.pathname + u.search + u.hash); } catch (e) {} }
    evaluate(true); paint(); renderTree();
    var tabs2 = D.querySelector(".tabs"); if (tabs2 && push) tabs2.scrollIntoView({ block: "start", behavior: RM.matches ? "auto" : "smooth" });
  }
  function closeCabin() {
    if (!C.root || C.root.hidden) return;
    C.root.hidden = true; D.body.classList.remove("xm-cabin-on"); hideDlgs();
    var b = D.getElementById("tab-cabin"); if (b) { b.classList.remove("xm-active"); b.removeAttribute("aria-current"); }
    if (snd.on) toggleSound();
  }
  XM.cabin = { open: openCabin, close: closeCabin, state: function () { return S; }, evaluate: evaluate, tasks: TASKS, items: ITEMS };

  function start() {
    hooks();
    if (XM.kind !== "xm-app") return;
    var tries = 0;
    (function t() { if (!tabBtn() && tries++ < 40) setTimeout(t, 250); else if (new URLSearchParams(location.search).get("tab") === "cabin") {
      (function w(n) { if (!window.__introDone && D.getElementById("intro") && n < 40) { setTimeout(function () { w(n + 1); }, 300); return; } openCabin(false); })(0); } })();
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", start); else start();
})();
