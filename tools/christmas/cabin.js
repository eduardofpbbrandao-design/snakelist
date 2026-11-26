/* SnakeList - Christmas preview: the Christmas Cabin (a tab beside the Species Checklist) and its tasks.
   Only ever runs inside the preview (xmas.js is only loaded with the Christmas switch on). Everything is saved in
   this browser under keys starting "sl-xmas-cabin-"; presents, rewards and decorations stay earned for good.
   The task progress comes from things people really do in SnakeList: the app's own quiz counters (sl-quiz-rounds,
   sl-quiz-correct - the same numbers the Achievements use), the species pages and species boxes opened, the
   Compare panel, the 3D viewer and the Want to see / seen lists. Nothing here changes how SnakeList itself works.
   The room itself is a picture painted at build time (xmas-cabin.webp, tools/christmas_art.py cabin_svg); the
   living parts - fire, lights, snow outside, the tree's decorations, stockings, presents, logs - are drawn over it
   at the places in XM_ART.cabin. */
(function () {
  "use strict";
  var XM = window.XM || {}, D = document, ART = (window.XM_ART || {}).cabin || {};
  var RM = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var KEY = "sl-xmas-cabin-state", LOG_MAX = 8;   // LOG_MAX: how many logs the basket holds
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  var S = load();
  S.species = S.species || []; S.done = S.done || {}; S.opened = S.opened || {}; S.unlocked = S.unlocked || {}; S.deco = S.deco || {}; S.opt = S.opt || {};
  if (S.logs == null) S.logs = 3;
  if (S.opt.lights == null) S.opt.lights = true;
  if (S.opt.snow == null) S.opt.snow = true;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function num(k) { try { return +localStorage.getItem(k) || 0; } catch (e) { return 0; } }
  var esc = XM.esc || function (s) { return String(s); };

  /* ---------------- rewards: every one can be put on the tree ---------------- */
  var ITEMS = {
    "top-none":      { cat: "topper",   name: "No topper", free: true },
    "top-star":      { cat: "topper",   name: "Golden star" },
    "top-snake":     { cat: "topper",   name: "Gold snake topper", special: "all" },
    "lights-warm":   { cat: "lights",   name: "Warm white lights", free: true },
    "lights-multi":  { cat: "lights",   name: "Coloured lights" },
    "lights-gold":   { cat: "lights",   name: "Twinkling gold lights" },
    "baubles-none":  { cat: "baubles",  name: "No baubles", free: true },
    "baubles-cran":  { cat: "baubles",  name: "Cranberry & gold baubles" },
    "baubles-frost": { cat: "baubles",  name: "Frosted ivory baubles" },
    "baubles-pine":  { cat: "baubles",  name: "Evergreen glass baubles" },
    "ribbon-none":   { cat: "ribbon",   name: "No ribbon", free: true },
    "ribbon-red":    { cat: "ribbon",   name: "Cranberry bows" },
    "ribbon-gold":   { cat: "ribbon",   name: "Gold garland" },
    "orn-bell":      { cat: "ornament", name: "Gold bell", free: true },
    "orn-candy":     { cat: "ornament", name: "Candy cane snake" },
    "orn-flake":     { cat: "ornament", name: "Silver snowflake" },
    "orn-snake":     { cat: "ornament", name: "Coiled green snake" },
    "orn-cone":      { cat: "ornament", name: "Frosted pine cone" },
    "orn-icicle":    { cat: "ornament", name: "Glass icicle" },
    "orn-globe":     { cat: "ornament", name: "Snow globe" },
    "orn-ginger":    { cat: "ornament", name: "Gingerbread snake" },
    "orn-hat":       { cat: "ornament", name: "Little Santa hat" },
    "orn-glow":      { cat: "ornament", name: "Glowing snake", special: 5 },
    "stock-plain":   { cat: "stocking", name: "Classic red stockings", free: true },
    "stock-knit":    { cat: "stocking", name: "Cranberry knit stockings" },
    "stock-flake":   { cat: "stocking", name: "Snowflake stockings" },
    "wrap-classic":  { cat: "wrap",     name: "Classic red wrapping", free: true },
    "wrap-gold":     { cat: "wrap",     name: "Gold stripe wrapping" },
    "wrap-tartan":   { cat: "wrap",     name: "Tartan wrapping" }
  };
  // [category, its name in the list, what one of them is called]
  var CATS = [["ornament", "Ornaments", "Ornament"], ["topper", "Tree topper", "Tree topper"], ["lights", "Fairy lights", "Lights"], ["baubles", "Baubles", "Baubles"],
              ["ribbon", "Ribbons", "Ribbon"], ["stocking", "Stockings", "Stockings"], ["wrap", "Gift wrapping", "Gift wrap"]];
  var MAX_ORN = 6;
  Object.keys(ITEMS).forEach(function (k) { if (ITEMS[k].free) S.unlocked[k] = 1; });
  // earlier versions: one "snake ornament" choice -> the ornaments now hang together (up to six kinds)
  if (!Array.isArray(S.orns)) { S.orns = ["orn-bell"]; var o0 = S.deco.ornament; if (o0 === "orn-snake" || o0 === "orn-glow") S.orns.push(o0); }
  delete S.deco.ornament;
  CATS.forEach(function (c) { if (c[0] !== "ornament" && !S.deco[c[0]]) S.deco[c[0]] = Object.keys(ITEMS).filter(function (k) { return ITEMS[k].cat === c[0] && ITEMS[k].free; })[0]; });

  /* ---------------- tasks ---------------- */
  function wantOrSeen() {
    var n = 0; try { n = D.querySelectorAll("#grid .card.wish, #grid .card.done").length; } catch (e) {}
    if (n > (S.want || 0)) { S.want = n; save(); }
    return S.want || 0;
  }
  var TASKS = [
    { id: "quiz-round",  name: "Finish a quiz round",                goal: 1,  now: function () { return num("sl-quiz-rounds"); }, gifts: ["baubles-cran", "orn-candy"], how: "quiz" },
    { id: "quiz-5",      name: "Answer 5 quiz questions correctly",  goal: 5,  now: function () { return num("sl-quiz-correct"); }, gifts: ["ribbon-red", "orn-flake"], how: "quiz", note: "across any number of rounds" },
    { id: "species-3",   name: "Explore 3 different species",        goal: 3,  now: function () { return S.species.length; }, gifts: ["orn-snake", "orn-cone"], how: "species", note: "species pages or See more info" },
    { id: "compare",     name: "Compare two snakes",                 goal: 1,  now: function () { return S.cmp ? 1 : 0; }, gifts: ["top-star", "orn-icicle"], how: "compare" },
    { id: "view-3d",     name: "View a snake in 3D",                 goal: 1,  now: function () { return S.v3d ? 1 : 0; }, gifts: ["lights-multi", "orn-globe"], how: "3d" },
    { id: "quiz-15",     name: "Answer 15 quiz questions correctly", goal: 15, now: function () { return num("sl-quiz-correct"); }, gifts: ["stock-knit", "stock-flake", "orn-ginger"], how: "quiz" },
    { id: "species-10",  name: "Explore 10 different species",       goal: 10, now: function () { return S.species.length; }, gifts: ["wrap-gold", "wrap-tartan", "baubles-frost", "orn-hat"], how: "species" },
    { id: "want",        name: "Add a snake to Want to see",         goal: 1,  now: wantOrSeen, gifts: ["lights-gold", "ribbon-gold", "baubles-pine"], how: "want", note: "or mark one you have really seen" }
  ];
  var GLOW_AT = 5;
  function task(id) { return TASKS.filter(function (t) { return t.id === id; })[0]; }
  function opened() { return TASKS.filter(function (t) { return S.opened[t.id]; }).length; }
  function waiting() { return TASKS.filter(function (t) { return S.done[t.id] && !S.opened[t.id]; }); }
  function source(k) { return TASKS.filter(function (t) { return t.gifts.indexOf(k) >= 0; })[0]; }

  function evaluate(quiet) {
    var changed = false, fresh = [];
    var q = num("sl-quiz-rounds") + num("sl-quiz-correct");
    if (S.qseen == null) S.qseen = q;
    if (q > S.qseen) { addLogs(Math.min(3, q - S.qseen)); S.qseen = q; changed = true; }
    TASKS.forEach(function (t) { if (!S.done[t.id] && t.now() >= t.goal) { S.done[t.id] = Date.now(); fresh.push(t); changed = true; } });
    if (fresh.length) { addLogs(fresh.length); save(); if (!quiet) congrats(fresh[fresh.length - 1]); paint(); }
    else if (changed) { save(); paint(); }
  }
  function addLogs(n) { S.logs = Math.min(LOG_MAX, (S.logs || 0) + n); }
  XM.cabinTrack = function (kind, v) {
    if (kind === "species" && v && S.species.indexOf(v) < 0) { S.species.push(v); addLogs(1); }
    else if (kind === "compare" && !S.cmp) { S.cmp = 1; addLogs(1); }
    else if (kind === "3d" && !S.v3d) { S.v3d = 1; addLogs(1); }
    else return;
    save(); evaluate();
  };

  /* ---------------- listening to what people do ---------------- */
  function hooks() {
    var sp = D.querySelector(".sp-main[data-id]");
    if (sp) XM.cabinTrack("species", sp.getAttribute("data-id"));
    D.addEventListener("click", function (e) {
      var t = e.target; if (!t.closest) return;
      var c = t.closest("#grid .card[data-id], .cp-row[data-id], [data-sp-id]");
      if (c && (t.closest(".map-btn, .td-card-btn, .card-name, .card-sci") || /See more info/i.test(t.textContent || ""))) XM.cabinTrack("species", c.getAttribute("data-id") || c.getAttribute("data-sp-id"));
      if (t.closest(".sp-realbtn, .sp-anatbtn, .sp3d-open")) XM.cabinTrack("3d");
    }, true);
    var wrapInfo = function () { var f = window.SL_MAP_SPECIES_INFO; if (f && !f.__xm) { var g = function (id) { var r = f.apply(this, arguments); if (r !== false) XM.cabinTrack("species", id); return r; }; g.__xm = 1; window.SL_MAP_SPECIES_INFO = g; } };
    wrapInfo(); setTimeout(wrapInfo, 3000);
    new MutationObserver(function () { if (D.documentElement.classList.contains("sl3d-lock")) XM.cabinTrack("3d"); })
      .observe(D.documentElement, { attributes: true, attributeFilter: ["class"] });
    var cmpWatch = function () {
      var sh = D.querySelector(".cmp-sheet"); if (!sh) return false;
      new MutationObserver(function () { if (sh.classList.contains("open") && sh.querySelectorAll(".cmp-col").length >= 2) XM.cabinTrack("compare"); })
        .observe(sh, { attributes: true, childList: true, subtree: true });
      return true;
    };
    if (!cmpWatch()) setTimeout(cmpWatch, 3000);
    evaluate(true);
    setInterval(function () { if (!D.hidden) evaluate(); }, 2500);
  }

  /* ---------------- "Congrats! You finished the ... task!" ---------------- */
  function congrats(t) {
    if (XM.unpoint) XM.unpoint();
    var inApp = XM.kind === "xm-app";
    XM.toast('<span aria-hidden="true">' + giftIcon() + "</span><span>Congrats! You finished the <b>" + esc(t.name) + "</b> task!</span>", "See present", function () {
      if (!inApp) { location.href = XM.root + "../?tab=cabin"; return; }
      openCabin(true); setTimeout(function () { seePresent(t.id); }, 450);
    }, 9000);
  }
  function giftIcon() { return '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="9" width="18" height="12" rx="2" fill="#A92E3E"/><rect x="2" y="7" width="20" height="4" rx="1.5" fill="#C24555"/><rect x="10.6" y="7" width="2.8" height="14" fill="#E4C57A"/><path d="M12 7c-2-4-6-3-5 0zM12 7c2-4 6-3 5 0z" fill="none" stroke="#E4C57A" stroke-width="1.8"/></svg>'; }
  function treeIcon() { return '<svg class="xm-tree-ic" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 2.5l3.6 5.2h-2.1l3.9 5.3h-2.3l4.4 5.8H4.5l4.4-5.8H6.6l3.9-5.3H8.4z" fill="currentColor"/><rect x="10.7" y="18.8" width="2.6" height="3" rx=".6" fill="currentColor"/><circle cx="12" cy="2.4" r="1.3" fill="#D8B76A"/></svg>'; }

  /* ---------------- drawings of every decoration (on the tree and as the pictures in My decorations) ---------------- */
  // ornaments: drawn hanging from (0, 0) on a short wire, about 30 units tall
  function hook(len) { return '<path d="M-2.4 1.4q1-4.2 4-1.8" stroke="#7d6324" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M1.2 .2V' + len + '" stroke="#e2c77e" stroke-width=".9"/>'; }
  var ORN = {
    "orn-bell": function () { return hook(6) + '<path d="M0 6c-5 0-6.5 4-7 9-.4 4-2.4 5.4-3 7h20c-.6-1.6-2.6-3-3-7-.5-5-2-9-7-9z" fill="#E2BE5C" stroke="#9a7424" stroke-width="1"/><circle cx="0" cy="23.4" r="2.2" fill="#9a7424"/><path d="M-3.6 10c-1 2-1.3 5-1.6 8" stroke="#fff3c8" stroke-width="1.4" stroke-linecap="round" opacity=".8"/><path d="M-6 6.5l12 0" stroke="#A92E3E" stroke-width="2.4" stroke-linecap="round"/>'; },
    "orn-candy": function () { return hook(4) + '<path d="M3.5 30V11a4.6 4.6 0 0 0-9.2 0" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round"/><path d="M3.5 30V11a4.6 4.6 0 0 0-9.2 0" fill="none" stroke="#C8303F" stroke-width="4.2" stroke-linecap="round" stroke-dasharray="2.2 2.4"/><circle cx="-6.4" cy="12.6" r="1.6" fill="#2f6e3b"/><circle cx="-6.9" cy="12.1" r=".5" fill="#111"/>'; },
    "orn-flake": function () { var p = ""; for (var a = 0; a < 360; a += 60) p += '<path d="M0 0V-10M0-6.5l-3-3M0-6.5l3-3" transform="translate(0 16) rotate(' + a + ')"/>'; return hook(5) + '<g stroke="#E8F1FA" stroke-width="2" stroke-linecap="round" fill="none" style="filter:drop-shadow(0 0 1.5px #8fb4d8)">' + p + '</g><circle cx="0" cy="16" r="2" fill="#fff"/>'; },
    "orn-snake": function () { return hook(4) + '<path d="M-6 26c-5-6 12-6 10-13s-12-4-9-9 9-1 9 2" fill="none" stroke="#3E8E3A" stroke-width="5" stroke-linecap="round"/><path d="M-6 26c-5-6 12-6 10-13s-12-4-9-9 9-1 9 2" fill="none" stroke="#173d27" stroke-width="1.6" stroke-dasharray="1.6 3" stroke-linecap="round"/><ellipse cx="5.5" cy="6.5" rx="4" ry="3" fill="#58b351"/><circle cx="6.8" cy="5.8" r=".9" fill="#111"/>'; },
    "orn-cone": function () { var s = ""; for (var r = 0; r < 6; r++) for (var c = -2; c <= 2; c++) { var w = 9 - Math.abs(r - 2.4) * 2; if (Math.abs(c) * 3 > w) continue; s += '<ellipse cx="' + (c * 3.1) + '" cy="' + (9 + r * 3.6) + '" rx="2.2" ry="1.8" fill="' + (r % 2 ? "#7a4a26" : "#8f5a2f") + '" stroke="#4a2a12" stroke-width=".5"/><path d="M' + (c * 3.1 - 1.6) + " " + (8.2 + r * 3.6) + 'q1.6-1 3.2 0" stroke="#fff" stroke-width=".9" fill="none" opacity=".85"/>'; } return hook(5) + s; },
    "orn-icicle": function () { return hook(4) + '<path d="M-4 5h8l-1.4 9-1 8L0 32l-1.6-10-1-8z" fill="rgba(210,235,255,.85)" stroke="#9cc4e6" stroke-width=".8"/><path d="M-1.6 7l.6 14" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>'; },
    "orn-globe": function () { return hook(4) + '<circle cx="0" cy="15" r="10" fill="rgba(190,225,255,.45)" stroke="#d6ecff" stroke-width="1"/><path d="M-8 19q8-4 16 0v1.4a10 10 0 0 1-16 0z" fill="#fff"/><path d="M0 9l3 7h-6z" fill="#2f6e3b"/><circle cx="-4" cy="12" r=".8" fill="#fff"/><circle cx="4" cy="10" r=".7" fill="#fff"/><circle cx="2" cy="14" r=".6" fill="#fff"/><path d="M-6.4 26h12.8l-1.6 3h-9.6z" fill="#A92E3E"/><path d="M-4 9a8 8 0 0 1 4-2" stroke="#fff" stroke-width="1.4" stroke-linecap="round" fill="none"/>'; },
    "orn-ginger": function () { return hook(4) + '<path d="M-7 27c-4-6 13-5 11-12s-12-3-9-8 8-1 8 1" fill="none" stroke="#B5763A" stroke-width="6" stroke-linecap="round"/><path d="M-7 27c-4-6 13-5 11-12s-12-3-9-8 8-1 8 1" fill="none" stroke="#fff" stroke-width="1.1" stroke-dasharray="2 2.6" stroke-linecap="round"/><ellipse cx="3.6" cy="8.2" rx="4" ry="3.1" fill="#C08144"/><circle cx="4.8" cy="7.6" r=".8" fill="#fff"/><circle cx="-1" cy="16" r="1.1" fill="#C8303F"/>'; },
    "orn-hat": function () { return hook(4) + '<path d="M-8 22C-7 14-4 8 1 6c4-1 7 2 7 7v9z" fill="#C8303F"/><path d="M1 6c-4-.6-7 1-9 4" stroke="#9c1d2e" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="-8.4" cy="10.6" r="2.4" fill="#fff"/><rect x="-10" y="20.6" width="20" height="5" rx="2.5" fill="#fff"/>'; },
    "orn-glow": function () { return '<g class="xc-glow">' + hook(4) + '<circle cx="0" cy="16" r="15" fill="#c9ffb0" opacity=".3" class="xc-halo"/><path d="M-6 26c-5-6 12-6 10-13s-12-4-9-9 9-1 9 2" fill="none" stroke="#c7f7b0" stroke-width="5" stroke-linecap="round"/><path d="M-6 26c-5-6 12-6 10-13s-12-4-9-9 9-1 9 2" fill="none" stroke="#4fd36a" stroke-width="1.6" stroke-dasharray="1.6 3" stroke-linecap="round"/><ellipse cx="5.5" cy="6.5" rx="4" ry="3" fill="#c7f7b0"/><circle cx="6.8" cy="5.8" r=".9" fill="#123D2A"/></g>'; }
  };
  // the tip of a pine branch drawn over an ornament's hook, so every ornament hangs from a branch (not in the air)
  var TWIGS = {};
  function twig(y) {
    if (TWIGS[y]) return TWIGS[y];
    var n = { "#163d26": "", "#22573a": "", "#2f7048": "" }, cs = Object.keys(n), r = 3;
    for (var x = -11; x <= 11; x += 1.6) {
      var yy = y + 1 - x * .09 + (x * x) * .006;
      for (var k = -1; k <= 1; k += 2) { r = (r * 9301 + 49297) % 233280; var q = r / 233280;
        n[cs[Math.floor(q * 3)]] += "M" + x.toFixed(1) + " " + yy.toFixed(1) + "l" + (2.6 + q * 1.6).toFixed(1) + " " + (k * (2.4 + q * 2)).toFixed(1); }
    }
    return (TWIGS[y] = '<g class="xc-twig" aria-hidden="true"><path d="M-12 ' + (y + 2) + "Q0 " + (y - 1) + " 12 " + (y - 1) + '" stroke="#3a2a18" stroke-width="1.4" fill="none"/>' +
      cs.map(function (c) { return '<path d="' + n[c] + '" stroke="' + c + '" stroke-width="1.5" stroke-linecap="round" fill="none"/>'; }).join("") + "</g>");
  }
  function bauble(c, frost) { return '<path d="M0-10V-6" stroke="#D8B76A" stroke-width="1.2"/><rect x="-3.2" y="-7.6" width="6.4" height="4" rx="1.2" fill="#D8B76A"/><circle cx="0" cy="5" r="9" fill="' + c + '"/><circle cx="-3" cy="2" r="2.6" fill="#fff" opacity=".55"/>' + (frost ? '<path d="M-5 5h10M0 0v10" stroke="#c9d8e2" stroke-width="1.3"/>' : ""); }
  function bow(c, dk) { return '<path d="M0 0c-12-9-16 5-3.6 5.2zM0 0c12-9 16 5 3.6 5.2z" fill="' + c + '" stroke="' + dk + '" stroke-width="1"/><path d="M-2 3l-5 10M2 3l5 10" stroke="' + c + '" stroke-width="2.8" stroke-linecap="round"/><circle cx="0" cy="1.6" r="2.6" fill="' + dk + '"/>'; }
  // a classic Christmas stocking (like the logo's): a velvet boot - straight leg, rounded heel bulging out at the back,
  // a round toe - under a thick, fluffy white fur cuff, hung from a little loop. The free one is the traditional red.
  function stockingG(kind) {
    var c = kind === "stock-knit" ? "#8E2233" : kind === "stock-flake" ? "#216B45" : "#B8293B", dk = kind === "stock-flake" ? "#123D2A" : "#5C0A16";
    var deco = kind === "stock-knit" ? '<path d="M-10 26h24M-10 34h24" stroke="#E4C57A" stroke-width="2" stroke-dasharray="3 3"/>' :
      kind === "stock-flake" ? '<g stroke="#FFF8ED" stroke-width="1.6" stroke-linecap="round"><path d="M2 24v14M-5 31h14M-3 26l10 10M7 26l-10 10"/></g>' : "";
    var body = "M-10 8H14V40C14 45 17 47 23 48C31 49 36 55 34 61C32 67 27 69 21 69H-1C-11 69-17 63-16 55C-15 49-10 46-10 40Z";
    var fur = ""; [[-13, 0], [-8, -1.6], [-2, -2], [4, -2], [10, -1.6], [15, 0], [-13, 11], [-7, 12.4], [-1, 12.8], [5, 12.8], [11, 12.4], [16, 11], [-15, 5.5], [18, 5.5]].forEach(function (q) { fur += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="3.4"/>'; });
    return '<path d="M14 2C16-6 24-5 22 2" fill="none" stroke="' + dk + '" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="' + body + '" fill="' + c + '" stroke="' + dk + '" stroke-width="1.6" stroke-linejoin="round"/>' + deco +
      '<path d="M-5 16V40M-11 58C-9 64-4 66 2 66" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".22"/>' +
      '<path d="M9 18V40C9 46 13 50 22 51" stroke="' + dk + '" stroke-width="2.4" fill="none" opacity=".35"/>' +
      '<g fill="#FFF8ED"><rect x="-15" y="-1" width="33" height="14" rx="6"/>' + fur + '</g>' +
      '<path d="M-13 9.5Q2 12.5 17 9.5" stroke="#d9cdb8" stroke-width="1.4" fill="none" stroke-linecap="round"/>';
  }
  var WRAP = { "wrap-classic": ["#A92E3E", "#E4C57A"], "wrap-gold": ["#F3E2B6", "#A92E3E"], "wrap-tartan": ["#216B45", "#E4C57A"] };
  function present(x, y, w, h, wrap) {
    var c = WRAP[wrap] || WRAP["wrap-classic"], pat = "";
    if (wrap === "wrap-gold") for (var i = -h; i < w; i += 9) pat += '<path d="M' + (x - w / 2 + i) + " " + (y + h / 2) + "l" + h + " " + (-h) + '" stroke="#D8B76A" stroke-width="3.4"/>';
    else if (wrap === "wrap-tartan") pat = '<path d="M' + (x - w / 2) + " " + (y - h / 6) + "h" + w + "M" + (x - w / 2) + " " + (y + h / 4) + "h" + w + "M" + (x - w / 4) + " " + (y - h / 2) + "v" + h + "M" + (x + w / 4) + " " + (y - h / 2) + "v" + h + '" stroke="#123D2A" stroke-width="3" opacity=".7"/><path d="M' + (x - w / 2) + " " + y + "h" + w + '" stroke="#A92E3E" stroke-width="1.2"/>';
    else for (var j = 0; j < 5; j++) pat += '<circle cx="' + (x - w / 2 + 6 + (j * 13) % (w - 8)) + '" cy="' + (y - h / 2 + 7 + (j * 9) % (h - 8)) + '" r="1.6" fill="#E4C57A" opacity=".8"/>';
    var id = "xcp" + Math.round(x) + "-" + Math.round(y);
    return '<clipPath id="' + id + '"><rect x="' + (x - w / 2) + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="3"/></clipPath>' +
      '<rect x="' + (x - w / 2) + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="3" fill="' + c[0] + '"/><g clip-path="url(#' + id + ')">' + pat + "</g>" +
      '<rect x="' + (x - w / 2) + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="3" fill="url(#xc-shade)"/>' +
      '<rect x="' + (x - w / 2 - 3) + '" y="' + (y - h / 2 - 8) + '" width="' + (w + 6) + '" height="10" rx="2" fill="' + c[0] + '" stroke="rgba(0,0,0,.25)"/>' +
      '<rect x="' + (x - 3) + '" y="' + (y - h / 2 - 8) + '" width="6" height="' + (h + 8) + '" fill="' + c[1] + '"/>' +
      '<path d="M' + x + " " + (y - h / 2 - 8) + "c-10-12-20-2-6 2zM" + x + " " + (y - h / 2 - 8) + 'c10-12 20-2 6 2z" fill="none" stroke="' + c[1] + '" stroke-width="3"/>';
  }
  var LIGHTC = { "lights-warm": ["#ffe9a8", "#fff1c4", "#ffd98a"], "lights-multi": ["#ff5d5d", "#ffd34d", "#5dd0ff", "#7dff8a", "#ff8cf0"], "lights-gold": ["#ffd46b", "#f5c04a", "#ffe7a1"] };
  var BAUBC = { "baubles-cran": ["#A92E3E", "#D8B76A"], "baubles-frost": ["#FFF8ED", "#dfe8ee"], "baubles-pine": ["#2B7A50", "#5fb0d8"] };
  function topperG(k) {
    if (k === "top-star") return '<g class="xc-star"><circle cx="0" cy="-4" r="30" fill="#ffe7a8" opacity=".25"/><path d="M0-30l8.6 18 19.8 2-14.8 13.4 4.4 19.6L0 13 -18 23l4.4-19.6L-28.4-10l19.8-2z" fill="#E4C57A" stroke="#a8842f" stroke-width="2"/></g>';
    if (k === "top-snake") return '<g class="xc-gsnake"><circle cx="0" cy="-8" r="34" fill="#ffe7a8" opacity=".3"/><path d="M-20 22c-10-22 36-20 30-40s-40-10-30-26 36-8 40 4" fill="none" stroke="#b8902f" stroke-width="11" stroke-linecap="round"/><path d="M-20 22c-10-22 36-20 30-40s-40-10-30-26 36-8 40 4" fill="none" stroke="#F1D58A" stroke-width="7" stroke-linecap="round"/><ellipse cx="22" cy="-38" rx="10" ry="7" fill="#E4C57A" stroke="#b8902f" stroke-width="2"/><circle cx="25" cy="-40" r="1.8" fill="#123D2A"/></g>';
    return "";
  }
  /* a picture of one decoration, for My decorations and the presents (40 x 40) */
  function thumb(k) {
    var it = ITEMS[k], g = "";
    if (/-none$/.test(k)) g = '<circle cx="20" cy="20" r="12" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3" opacity=".55"/><path d="M12 28L28 12" stroke="currentColor" stroke-width="2" opacity=".55"/>';
    else if (it.cat === "ornament") g = '<g transform="translate(20 4) scale(1.05)">' + ORN[k]() + "</g>";
    else if (it.cat === "baubles") { var bc = BAUBC[k]; g = '<g transform="translate(13 15) scale(.85)">' + bauble(bc[0], k === "baubles-frost") + '</g><g transform="translate(27 19) scale(.85)">' + bauble(bc[1], k === "baubles-frost") + "</g>"; }
    else if (it.cat === "lights") { var lc = LIGHTC[k]; g = '<path d="M3 12q9 12 17 4t17 4" stroke="#2a3a2a" stroke-width="1.3" fill="none"/>' + [[8, 17], [15, 19.5], [23, 15.5], [31, 17.8]].map(function (p, i) { return '<circle cx="' + p[0] + '" cy="' + (p[1] + 4) + '" r="6" fill="' + lc[i % lc.length] + '" opacity=".35"/><ellipse cx="' + p[0] + '" cy="' + (p[1] + 4) + '" rx="2.6" ry="3.6" fill="' + lc[i % lc.length] + '"/>'; }).join(""); }
    else if (it.cat === "ribbon") g = k === "ribbon-red" ? '<g transform="translate(20 15) scale(1.2)">' + bow("#A92E3E", "#7c1d2b") + "</g>" : '<path d="M3 14q9 14 17 6t17 2M3 26q9 10 17 4t17 2" stroke="#D8B76A" stroke-width="4" fill="none" stroke-linecap="round"/>';
    else if (it.cat === "topper") g = '<g transform="translate(20 22) scale(.55)">' + topperG(k) + "</g>";
    else if (it.cat === "stocking") g = '<g transform="translate(14 4) scale(.48)">' + stockingG(k) + "</g>";
    else if (it.cat === "wrap") g = present(20, 24, 26, 20, k);
    return '<svg class="xc-th" viewBox="0 0 40 40" aria-hidden="true">' + g + "</svg>";
  }
  XM.cabinThumb = thumb;

  /* ---------------- the scene ---------------- */
  var C = { root: null, svg: null };
  // a part of the room you can touch: an invisible hit area, the outline that lights up on hover / focus / press,
  // and a small label saying what it does
  function hot(k, label, d, lx, ly) {
    var vis = label.replace(/^The fire: /, ""), w; vis = vis.charAt(0).toUpperCase() + vis.slice(1); w = vis.length * 7.4 + 22;
    return '<g class="xc-hot xc-hot-' + k + '" data-hot="' + k + '" role="button" tabindex="0" aria-label="' + esc(label) + '">' +
      '<path class="xc-hotarea" d="' + d + '"/><path class="xc-hotline" d="' + d + '"/>' +
      '<g class="xc-hotlab" transform="translate(' + lx + " " + ly + ')"><rect x="' + (-w / 2) + '" y="-13" width="' + w + '" height="26" rx="13"/><text y="5" text-anchor="middle">' + esc(vis) + "</text></g></g>";
  }
  function scene() {
    var A = ART, W = A.win || [112, 96, 322, 306], f = A.fire || [780, 446], fx = f[0], fy = f[1], i, snow = "";
    for (i = 0; i < 46; i++) snow += '<circle class="xc-sn" style="--d:' + (5 + (i * 7) % 6) + "s;--o:-" + ((i * 1.37) % 7).toFixed(2) + "s;--dx:" + (((i * 13) % 9) - 4) + 'px" cx="' + (W[0] + (i * 37.3) % (W[2] - W[0])).toFixed(1) + '" cy="' + (W[1] - 10) + '" r="' + (0.9 + (i % 3) * .55) + '"/>';
    var beam = (A.beam || []), gl = "", gb = "";
    beam.forEach(function (p, k) { gl += (k ? "L" : "M") + p[0] + " " + p[1]; gb += '<g class="xc-bl xc-gl' + (k % 3) + '"><circle cx="' + p[0] + '" cy="' + (p[1] + 5) + '" r="9" class="xc-bglow"/><ellipse cx="' + p[0] + '" cy="' + (p[1] + 5) + '" rx="2.8" ry="3.8" class="xc-bulb"/></g>'; });
    return '<svg class="xc-svg" viewBox="0 0 1000 600" role="img" aria-label="A log cabin at night with a Christmas tree, a stone fireplace and snow outside the window">' +
      '<defs>' +
      '<radialGradient id="xc-fl" cx="' + fx + '" cy="' + (fy - 20) + '" r="420" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffb04a" stop-opacity=".5"/><stop offset=".3" stop-color="#ff8c2a" stop-opacity=".16"/><stop offset="1" stop-color="#ff8c2a" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="xc-treeglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe7a8" stop-opacity=".2"/><stop offset="1" stop-color="#ffe7a8" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="xc-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff6a10"/><stop offset=".45" stop-color="#ffa42a"/><stop offset="1" stop-color="#fff1a8" stop-opacity=".1"/></linearGradient>' +
      '<linearGradient id="xc-flame2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffd36b"/><stop offset="1" stop-color="#fff6d0" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="xc-shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>' +
      '<filter id="xc-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>' +
      '<clipPath id="xc-wclip"><rect x="' + W[0] + '" y="' + W[1] + '" width="' + (W[2] - W[0]) + '" height="' + (W[3] - W[1]) + '"/></clipPath>' +
      '</defs>' +
      '<image href="' + XM.asset("xmas-cabin.webp") + '" x="0" y="0" width="1000" height="600" preserveAspectRatio="none"/>' +
      '<g class="xc-wsnow" clip-path="url(#xc-wclip)">' + snow + '</g>' +
      // the fire, its glowing embers and the light it throws round the room
      '<rect class="xc-firelight" x="0" y="0" width="1000" height="600" fill="url(#xc-fl)"/>' +
      '<g class="xc-embers"><ellipse cx="' + fx + '" cy="' + (fy - 6) + '" rx="54" ry="7" fill="#ff7a1a" filter="url(#xc-blur)" opacity=".9"/><path d="M' + (fx - 40) + " " + (fy - 9) + "h80M" + (fx - 30) + " " + (fy - 22) + 'l60-8" stroke="#ffb347" stroke-width="2" stroke-dasharray="6 9 3 7" opacity=".85"/></g>' +
      '<g class="xc-fire" transform="translate(' + (fx - 780) + ' ' + (fy - 446) + ')"><ellipse cx="780" cy="410" rx="60" ry="46" fill="#ff9a3c" opacity=".35" filter="url(#xc-blur)"/>' +
      '<path class="xc-f1" d="M738 446Q730 408 754 384Q752 408 766 416Q764 378 788 356Q786 396 804 408Q810 390 808 378Q830 410 816 446z" fill="url(#xc-flame)"/>' +
      '<path class="xc-f4" d="M756 446Q748 424 760 410Q764 426 772 430Q770 410 782 398Q790 422 798 430Q804 420 806 412Q816 432 806 446z" fill="url(#xc-flame)" opacity=".9"/>' +
      '<path class="xc-f2" d="M752 446Q748 420 764 404Q766 424 778 428Q778 402 794 392Q796 420 804 430Q810 440 800 446z" fill="url(#xc-flame2)"/>' +
      '<path class="xc-f3" d="M764 446Q762 432 772 424Q776 436 784 436Q788 426 796 422Q800 438 792 446z" fill="#fff3c4" opacity=".9"/></g>' +
      '<g class="xc-sparks"></g>' +
      // the garland of lights along the beam
      '<path d="' + gl + '" fill="none" stroke="#1b3a26" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="' + gl + '" fill="none" stroke="#2f6b43" stroke-width="7" stroke-dasharray="2 4" stroke-linecap="round"/>' +
      '<g class="xc-glights">' + gb + '</g>' +
      '<g class="xc-stockings"></g><g class="xc-basket-logs" transform="translate(' + (A.basket || [902, 470]).join(" ") + ')"></g>' +
      '<g class="xc-tree"><ellipse class="xc-tglow" cx="452" cy="300" rx="230" ry="260" fill="url(#xc-treeglow)"/><g class="xc-ribbon"></g><g class="xc-tlights"></g><g class="xc-baubles"></g><g class="xc-orn"></g><g class="xc-topper"></g></g>' +
      // the firelight falling on what is near it: the hearth floor, the stone breast, the mantel's underside and the rug's edge
      '<g class="xc-warm" aria-hidden="true"><ellipse cx="' + fx + '" cy="' + (fy + 38) + '" rx="200" ry="44" fill="#ffad4a" opacity=".3" filter="url(#xc-blur)"/>' +
      '<ellipse cx="' + fx + '" cy="' + (fy - 70) + '" rx="150" ry="118" fill="#ff9a3c" opacity=".13" filter="url(#xc-blur)"/>' +
      '<rect x="' + (fx - 150) + '" y="' + ((A.mantel || 300) + 30) + '" width="300" height="16" rx="8" fill="#ffb04a" opacity=".2" filter="url(#xc-blur)"/>' +
      '<ellipse cx="' + (fx - 120) + '" cy="' + (fy + 96) + '" rx="150" ry="22" fill="#ffb04a" opacity=".16" filter="url(#xc-blur)"/></g>' +
      // things you can touch: the tree (decorations), the fire (a log) and the log basket - each lights up on hover, focus and touch
      hot("tree", "Decorate the tree", "M" + 452 + " 54L" + 640 + " 470H" + 262 + "Z", 452, 34) +
      hot("fire", "The fire: add a log", "M" + (fx - 86) + " " + (fy + 6) + "V" + (fy - 74) + "Q" + fx + " " + (fy - 130) + " " + (fx + 86) + " " + (fy - 74) + "V" + (fy + 6) + "Z", fx, fy - 140) +
      hot("basket", "The log basket", "M" + ((A.basket || [902, 470])[0] - 12) + " " + ((A.basket || [902, 470])[1] + 14) + "h112v76h-112Z", (A.basket || [902, 470])[0] + 44, (A.basket || [902, 470])[1] + 4) +
      '<g class="xc-presents"></g>' +
      '</svg>';
  }

  /* ---------------- decorations on the tree ---------------- */
  function renderTree() {
    if (!C.svg) return;
    var q = function (s) { return C.svg.querySelector(s); }, d = S.deco, A = ART;
    var lc = LIGHTC[d.lights] || LIGHTC["lights-warm"];
    q(".xc-tlights").innerHTML = (A.lights || []).map(function (p, i) { var c = lc[i % lc.length]; return '<g class="xc-tl xc-tl' + (i % 3) + (d.lights === "lights-gold" ? " xc-tw" : "") + '"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="8.5" fill="' + c + '" class="xc-lglow"/><ellipse cx="' + p[0] + '" cy="' + (p[1] + .5) + '" rx="3" ry="4" fill="' + c + '" class="xc-lb"/></g>'; }).join("");
    var bc = BAUBC[d.baubles];
    q(".xc-baubles").innerHTML = bc ? (A.baubles || []).map(function (p, i) { return '<g transform="translate(' + p[0] + " " + (p[1] + 12) + ')">' + bauble(bc[i % 2], d.baubles === "baubles-frost") + twig(-12) + "</g>"; }).join("") : "";
    var rb = "";
    if (d.ribbon === "ribbon-red") rb = (A.baubles || []).filter(function (p, i) { return i % 2; }).map(function (p) { return '<g transform="translate(' + (p[0] + 16) + " " + (p[1] - 4) + ')">' + bow("#A92E3E", "#7c1d2b") + "</g>"; }).join("");
    else if (d.ribbon === "ribbon-gold") rb = (A.garland || []).map(function (g) { return '<path d="' + g + '" fill="none" stroke="#B8913F" stroke-width="7" stroke-linecap="round"/><path d="' + g + '" fill="none" stroke="#F1D58A" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 5"/>'; }).join("");
    q(".xc-ribbon").innerHTML = rb;
    // the ornaments: every kind chosen hangs in several places round the tree
    var sel = (S.orns || []).filter(function (k) { return S.unlocked[k] && ORN[k]; }), slots = A.orns || [], out = "";
    if (sel.length) { var n = Math.min(slots.length, Math.max(sel.length * 2, 6)); for (var i = 0; i < n; i++) { var p = slots[Math.floor(i * slots.length / n)]; out += '<g transform="translate(' + p[0] + " " + p[1] + ')">' + ORN[sel[i % sel.length]]() + twig(-1) + "</g>"; } }
    q(".xc-orn").innerHTML = out;
    var tp = A.top || [452, 62];
    q(".xc-topper").innerHTML = d.topper && d.topper !== "top-none" ? '<g transform="translate(' + tp[0] + " " + (tp[1] + 6) + ')">' + topperG(d.topper) + "</g>" : "";
    var my = (A.mantel || 300) + 24;
    q(".xc-stockings").innerHTML = (A.stockings || [684, 742, 818, 876]).map(function (x) { return '<g transform="translate(' + x + " " + my + ') scale(.8)">' + stockingG(d.stocking) + "</g>"; }).join("");
    renderPresents(); renderLogs(); lightsOpt();
  }
  var PRESENT_PTS = [[372, 520, 54, 40], [522, 524, 58, 44], [432, 536, 44, 32], [596, 534, 44, 32], [318, 540, 42, 30], [478, 552, 38, 26], [650, 548, 40, 28], [270, 552, 40, 28]];
  function renderPresents() {
    if (!C.svg) return;
    var w = waiting(), wrap = S.deco.wrap || "wrap-classic";
    C.svg.querySelector(".xc-presents").innerHTML = w.map(function (t, i) {
      var p = PRESENT_PTS[i % PRESENT_PTS.length];
      return '<g class="xc-present" tabindex="0" role="button" data-task="' + t.id + '" aria-label="Open the present for: ' + esc(t.name) + '">' +
        '<ellipse class="xc-pglow" cx="' + p[0] + '" cy="' + (p[1] + p[3] / 2) + '" rx="' + (p[2] * .8) + '" ry="9" fill="#ffe7a8" opacity=".5"/>' + present(p[0], p[1], p[2], p[3], wrap) + "</g>";
    }).join("");
  }
  function renderLogs() {
    if (!C.svg) return;
    var n = S.logs || 0, out = "";
    for (var i = 0; i < n; i++) { var row = Math.floor(i / 3), col = i % 3; out += '<g transform="translate(' + (8 + col * 27 + (row % 2) * 12) + " " + (24 - row * 14) + ')"><rect width="30" height="14" rx="7" fill="#6e4628" stroke="#4b2e18"/><ellipse cx="28" cy="7" rx="5" ry="6" fill="#c9a06b" stroke="#4b2e18"/><path d="M27 4.5a3 3 0 1 1 0 5" stroke="#8a6238" fill="none"/></g>'; }
    C.svg.querySelector(".xc-basket-logs").innerHTML = out;
    if (!C.root) return;
    // the count in words, how logs are earned, and a friendly line (not a dead button) when the basket is empty
    var b = C.root.querySelector(".xc-log"), lg = C.root.querySelector(".xc-logs"), h = C.root.querySelector(".xc-loghint");
    if (b) { b.setAttribute("aria-disabled", String(!n)); b.classList.toggle("xc-empty", !n); b.setAttribute("aria-label", n ? "Add a log to the fire (" + n + " left)" : "Add a log - the basket is empty"); }
    if (lg) { lg.querySelector("b").textContent = n; lg.querySelector(".xc-logw").textContent = (n === 1 ? "log" : "logs") + " in the basket" + (n >= LOG_MAX ? " (full)" : ""); }
    if (h) h.innerHTML = n ? "Earn more by answering quiz questions, exploring snakes and finishing Christmas tasks. The basket holds " + LOG_MAX + "."
      : "<b>The basket is empty</b> - the fire keeps burning. Answer a quiz question, explore a snake or finish a Christmas task to collect more logs.";
    var hf = C.svg.querySelector(".xc-hot-fire"); if (hf) hf.setAttribute("aria-label", n ? "The fire: add a log (" + n + " left)" : "The fire: the log basket is empty");
  }
  function lightsOpt() {
    if (!C.root) return;
    C.root.classList.toggle("xc-lights-off", !S.opt.lights);
    C.root.classList.toggle("xc-snow-off", !S.opt.snow);
    [].forEach.call(C.root.querySelectorAll("[data-opt]"), function (b) { b.setAttribute("aria-pressed", String(!!S.opt[b.getAttribute("data-opt")])); });
  }

  /* ---------------- the cabin panel ---------------- */
  function progressText() {
    var o = opened(), all = TASKS.length;
    if (o >= all) return "Tree presents: all " + all + " opened - the Christmas collection is complete!";
    if (o < GLOW_AT) return "Tree presents: " + o + " of " + all + " opened \u00b7 open " + GLOW_AT + " for a glowing snake ornament";
    return "Tree presents: " + o + " of " + all + " opened \u00b7 open all " + all + " for the gold snake tree topper";
  }
  var FS_ON = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  var FS_OFF = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  var X_IC = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function panel(cls, title, sub) {
    return '<div class="xm-panel-wrap xc-dlg ' + cls + '" role="dialog" aria-modal="true" aria-label="' + title + '" hidden><div class="xm-panel-bg xc-close"></div><div class="xm-panel">' +
      '<div class="xm-ph"><h3>' + title + '</h3><button type="button" class="xm-px xc-close" aria-label="Close">' + X_IC + "</button></div>" + (sub ? '<p class="xc-sub">' + sub + "</p>" : "") + '<div class="xc-body"></div></div></div>';
  }
  function build() {
    if (C.root) return C.root;
    var r = D.createElement("section"); r.id = "xm-cabin"; r.className = "xc"; r.hidden = true; r.setAttribute("aria-label", "Christmas Cabin");
    // the room: one dark evergreen card holding the scene and, beside it on wide screens (under it on narrow ones),
    // a compact control area in labelled groups - the Cabin's own things, the fire, the room, the sound
    r.innerHTML = '<div class="xc-head"><h2>' + treeIcon() + ' Christmas Cabin</h2></div>' +
      '<div class="xc-room">' +
      '<div class="xc-stage">' + scene() + '<button type="button" class="xc-fs" aria-label="Full screen" aria-pressed="false">' + FS_ON + '</button><div class="xc-celebrate" hidden></div></div>' +
      '<div class="xc-ctrl">' +
      '<div class="xc-grp xc-grp-main"><p class="xc-gh">In your Cabin</p>' +
      '<div class="xc-bar">' +
      '<button type="button" class="xc-btn xc-tasks">' + giftIcon() + '<span>Christmas tasks<small class="xc-bsub">' + TASKS.length + ' presents to earn</small></span><i class="xc-badge" hidden></i></button>' +
      '<button type="button" class="xc-btn xc-decos"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="14" r="7" fill="#A92E3E"/><rect x="9.5" y="4.5" width="5" height="3" rx="1" fill="#D8B76A"/><circle cx="9.5" cy="11.5" r="2" fill="#fff" opacity=".6"/></svg><span>My decorations<small class="xc-bsub">Decorate the tree</small></span></button>' +
      '</div><p class="xc-prog" aria-live="polite"></p></div>' +
      '<div class="xc-grp xc-grp-fire"><p class="xc-gh">Fireplace</p>' +
      '<div class="xc-fireline"><span class="xc-logs" aria-live="polite"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="9" width="17" height="7" rx="3.5" fill="#7a4d2b" stroke="#4b2e18"/><ellipse cx="18.5" cy="12.5" rx="3" ry="3.5" fill="#d4ab74" stroke="#4b2e18"/></svg><b>0</b> <span class="xc-logw">logs in the basket</span></span>' +
      '<button type="button" class="xc-btn xc-btn-sm xc-log"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 1-8z" fill="#ff9a3c"/></svg><span>Add a log</span></button></div>' +
      '<p class="xc-note xc-loghint"></p></div>' +
      '<div class="xc-grp xc-grp-room"><p class="xc-gh">The room</p><div class="xc-chips">' +
      '<button type="button" class="xc-btn xc-btn-sm xc-chip" data-opt="lights" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6q9 9 18 0" stroke="currentColor" stroke-width="1.5" fill="none"/><ellipse cx="7" cy="11" rx="2.2" ry="3" fill="#ffd34d"/><ellipse cx="12" cy="12.4" rx="2.2" ry="3" fill="#ff5d5d"/><ellipse cx="17" cy="11" rx="2.2" ry="3" fill="#5dd0ff"/></svg><span>Festive lights</span></button>' +
      '<button type="button" class="xc-btn xc-btn-sm xc-chip" data-opt="snow" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#9cc4e6" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/></g></svg><span>Snow outside</span></button>' +
      '</div></div>' +
      '<div class="xc-grp xc-grp-sound"><p class="xc-gh">Sound <small>remembered on this device</small></p><div class="xc-audio"></div></div>' +
      '</div></div>' +
      panel("xc-dlg-tasks", "Christmas tasks", "Each task puts a wrapped present under the tree - every present can be opened once.") +
      panel("xc-dlg-decos", "My decorations", "Choose what goes on your tree. Locked ones come in presents - tap one to see how to get it.") +
      '<div class="xm-panel-wrap xc-open" role="dialog" aria-modal="true" aria-label="Opening a present" hidden><div class="xm-panel-bg"></div><div class="xm-panel xc-ob"></div></div>';
    C.root = r; C.svg = r.querySelector(".xc-svg");
    if (XM.audio) XM.audio.panel(r.querySelector(".xc-audio"), { dark: true });
    r.querySelector(".xc-tasks").onclick = function () { showDlg("tasks"); };
    r.querySelector(".xc-decos").onclick = function () { showDlg("decos"); };
    r.querySelector(".xc-log").onclick = addLog;
    r.querySelector(".xc-fs").onclick = function () { setFull(!r.classList.contains("xc-full")); };
    r.addEventListener("click", function (e) {
      var t = e.target;
      if (t.closest(".xc-close")) { hideDlgs(); return; }
      var op = t.closest("[data-opt]"); if (op) { var k = op.getAttribute("data-opt"); S.opt[k] = !S.opt[k]; save(); lightsOpt(); return; }
      var p = t.closest(".xc-present"); if (p) { openPresent(p.getAttribute("data-task")); return; }
      var ht = t.closest(".xc-hot"); if (ht) { hotAct(ht.getAttribute("data-hot")); return; }
      var sp = t.closest("[data-see-present]"); if (sp) { hideDlgs(); seePresent(sp.getAttribute("data-see-present")); return; }
      var hw = t.closest("[data-how]"); if (hw) { hideDlgs(); how(hw.getAttribute("data-how"), hw.getAttribute("data-task")); return; }
      var dc = t.closest("[data-deco]"); if (dc) { pickDeco(dc.getAttribute("data-deco")); return; }
    });
    r.addEventListener("keydown", function (e) {
      var p = e.target.closest && e.target.closest(".xc-present");
      var ht2 = e.target.closest && e.target.closest(".xc-hot");
      if (ht2 && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); hotAct(ht2.getAttribute("data-hot")); }
      if (p && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openPresent(p.getAttribute("data-task")); }
      if (e.key === "Escape") { if (!r.querySelector(".xc-open").hidden) { closeOpen(); e.stopPropagation(); } else if (r.querySelector(".xc-dlg:not([hidden])")) { hideDlgs(); e.stopPropagation(); } else if (r.classList.contains("xc-full")) setFull(false); }
    });
    renderTree(); paint();
    return r;
  }
  /* full screen, like the map's: the cabin fills the screen, its buttons over the bottom of the scene */
  function setFull(on) {
    var r = C.root; if (!r) return;
    r.classList.toggle("xc-full", on); D.body.classList.toggle("xm-cabin-full", on); D.documentElement.classList.toggle("xm-cabin-full", on);
    var b = r.querySelector(".xc-fs"); b.innerHTML = on ? FS_OFF : FS_ON; b.setAttribute("aria-label", on ? "Leave full screen" : "Full screen"); b.setAttribute("aria-pressed", String(on));
    // (the sound controls are always the dark version now: the controls sit on the dark Cabin card)
  }
  D.addEventListener("keydown", function (e) { if (e.key === "Escape" && C.root && C.root.classList.contains("xc-full") && !C.root.querySelector(".xm-panel-wrap:not([hidden])") && !D.querySelector(".xm-pt")) setFull(false); });
  function paint() {
    if (!C.root) return;
    C.root.querySelector(".xc-prog").textContent = progressText();
    var w = waiting().length, bd = C.root.querySelector(".xc-badge"); bd.hidden = !w; bd.textContent = w;
    renderPresents(); renderLogs(); paintTasks(); paintDecos();
    var tab = D.getElementById("tab-cabin"); if (tab) tab.classList.toggle("xm-has-gift", !!w);
  }
  function paintTasks(hi) {
    var ol = C.root && C.root.querySelector(".xc-dlg-tasks .xc-body"); if (!ol) return;
    var o = opened();
    ol.innerHTML = (hi ? '<p class="xc-hint">' + hi.html + "</p>" : "") + '<ol class="xc-tlist">' + TASKS.map(function (t) {
      var done = !!S.done[t.id], op = !!S.opened[t.id], n = done ? t.goal : Math.min(t.now(), t.goal);
      var act = op ? '<span class="xc-st xc-st-op">Opened</span>' : done ? '<button type="button" class="xc-st xc-st-go" data-see-present="' + t.id + '">See present</button>' :
        '<button type="button" class="xc-st xc-st-how" data-how="' + t.how + '" data-task="' + t.id + '">Show me</button>';
      return '<li class="' + (op ? "op" : done ? "ready" : "") + (hi && hi.task === t.id ? " xc-hi" : "") + '" data-tid="' + t.id + '"><div class="xc-tt"><b>' + esc(t.name) + "</b>" + (t.note ? "<small>" + esc(t.note) + "</small>" : "") +
        '<span class="xc-rw">' + t.gifts.map(function (g) { return '<i class="xc-rwi">' + thumb(g) + esc(ITEMS[g].name) + "</i>"; }).join("") + '</span><span class="xc-pbar" role="progressbar" aria-valuemin="0" aria-valuemax="' + t.goal + '" aria-valuenow="' + n + '" aria-label="' + esc(t.name) + '"><i style="width:' + (n / t.goal * 100) + '%"></i></span><span class="xc-pn">' + n + " / " + t.goal + "</span></div>" + act + "</li>";
    }).join("") +
      '<li class="xc-ms' + (S.unlocked["orn-glow"] ? " op" : "") + (hi && hi.task === "glow" ? " xc-hi" : "") + '"><div class="xc-tt"><b>Open ' + GLOW_AT + ' presents</b><span class="xc-rw"><i class="xc-rwi">' + thumb("orn-glow") + 'Glowing snake</i></span></div><span class="xc-st ' + (S.unlocked["orn-glow"] ? "xc-st-op" : "") + '">' + (S.unlocked["orn-glow"] ? "Unlocked" : Math.min(o, GLOW_AT) + " / " + GLOW_AT) + "</span></li>" +
      '<li class="xc-ms' + (S.unlocked["top-snake"] ? " op" : "") + (hi && hi.task === "all" ? " xc-hi" : "") + '"><div class="xc-tt"><b>Complete the Christmas collection</b><span class="xc-rw"><i class="xc-rwi">' + thumb("top-snake") + 'Gold snake topper</i></span></div><span class="xc-st ' + (S.unlocked["top-snake"] ? "xc-st-op" : "") + '">' + (S.unlocked["top-snake"] ? "Unlocked" : o + " / " + TASKS.length) + "</span></li></ol>";
  }
  function paintDecos() {
    var box = C.root && C.root.querySelector(".xc-dlg-decos .xc-body"); if (!box) return;
    box.innerHTML = CATS.map(function (c) {
      var ks = Object.keys(ITEMS).filter(function (k) { return ITEMS[k].cat === c[0]; }), real = ks.filter(function (k) { return !/-none$/.test(k); });
      var have = real.filter(function (k) { return S.unlocked[k]; }).length;
      return '<fieldset class="xc-cat xc-cat-' + c[0] + '"><legend>' + c[1] + ' <small>' + have + " of " + real.length + " collected" + (c[0] === "ornament" ? " &middot; hang up to " + MAX_ORN + " kinds" : "") + "</small></legend><div class=\"xc-opts\">" + ks.map(function (k) {
        var it = ITEMS[k], un = !!S.unlocked[k], on = c[0] === "ornament" ? (S.orns || []).indexOf(k) >= 0 : S.deco[c[0]] === k;
        return '<button type="button" class="xc-opt' + (on ? " on" : "") + (un ? "" : " locked") + '" data-deco="' + k + '" aria-pressed="' + on + '">' + thumb(k) +
          '<span><b>' + esc(it.name) + "</b><small>" + (un ? (on ? (c[0] === "ornament" ? "On the tree" : "Chosen") : c[2]) : '<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2" fill="none"/></svg> ' + c[2] + " &middot; how to get it") + "</small></span></button>";
      }).join("") + "</div></fieldset>";
    }).join("");
  }
  function pickDeco(k) {
    var it = ITEMS[k]; if (!it) return;
    if (!S.unlocked[k]) { howToGet(k); return; }
    if (it.cat === "ornament") {
      var a = S.orns || (S.orns = []), i = a.indexOf(k);
      if (i >= 0) a.splice(i, 1); else { a.push(k); if (a.length > MAX_ORN) a.shift(); }
    } else S.deco[it.cat] = k;
    save(); renderTree(); paintDecos();
  }
  /* a decoration not earned yet: to the Christmas tasks, the task (or present) that gives it marked */
  function howToGet(k) {
    var it = ITEMS[k], t = source(k), hi;
    if (it.special === 5) hi = { task: "glow", html: "<b>" + esc(it.name) + "</b> is the reward for opening " + GLOW_AT + " presents - " + opened() + " opened so far." };
    else if (it.special === "all") hi = { task: "all", html: "<b>" + esc(it.name) + "</b> is the reward for opening every present." };
    else if (t && S.done[t.id] && !S.opened[t.id]) hi = { task: t.id, html: "<b>" + esc(it.name) + "</b> is in a present waiting under your tree - tap <b>See present</b>." };
    else if (t) hi = { task: t.id, html: "<b>" + esc(it.name) + "</b> comes in the present for <b>" + esc(t.name) + "</b> - tap <b>Show me</b> to see how." };
    showDlg("tasks", hi);
  }
  function showDlg(n, hi) {
    hideDlgs(); var d = C.root.querySelector(".xc-dlg-" + n); paint(); if (hi) paintTasks(hi); d.hidden = false;
    var row = hi && d.querySelector(".xc-hi"); if (row) setTimeout(function () { row.scrollIntoView({ block: "center", behavior: RM.matches ? "auto" : "smooth" }); }, 60);
    var x = d.querySelector(".xm-px"); try { x.focus({ preventScroll: true }); } catch (e) {}
  }
  function hideDlgs() { if (!C.root) return; [].forEach.call(C.root.querySelectorAll(".xc-dlg"), function (d) { d.hidden = true; }); }

  /* ---------------- "See present": the panel closes and the cabin shows the present waiting under the tree ---------------- */
  function seePresent(id) {
    hideDlgs();
    var go = function () {
      var p = C.svg && C.svg.querySelector('.xc-present[data-task="' + id + '"]');
      if (p && XM.point) XM.point(p, "Tap your present to open it!", { title: (task(id) || {}).name });
    };
    if (!C.root || C.root.hidden) { openCabin(true); setTimeout(go, 500); } else go();
  }
  /* ---------------- "Show me": SnakeList goes there and points at what to do ---------------- */
  function visibleCard() { var cs = D.querySelectorAll("#grid .card[data-id]"); for (var i = 0; i < cs.length; i++) { var r = cs[i].getBoundingClientRect(); if (cs[i].offsetParent && r.height) return cs[i]; } return null; }
  function toTab(id) { setFull(false); closeCabin(); var t = D.getElementById(id); if (t && !t.classList.contains("active")) t.click(); }
  function how(k, tid) {
    var t = task(tid) || {}, title = t.name;
    var point = function (sel, text, wait) {
      var n = 0; (function tryIt() {
        var el = typeof sel === "function" ? sel() : D.querySelector(sel);
        if (el && el.getBoundingClientRect().height) { XM.point(el, text, { title: title }); return; }
        if (n++ < 20) setTimeout(tryIt, 200);
      })();
    };
    if (k === "quiz") { toTab("tab-quiz"); point(function () { var b = D.querySelectorAll("#quiz-levels .quiz-level-btn"); for (var i = 0; i < b.length; i++) if (b[i].offsetParent) return b[i]; return null; }, "Pick a level here and answer the questions" + (t.goal > 1 ? " - get " + t.goal + " right in all." : " - finish the round.")); return; }
    if (k === "species") { toTab("tab-guide"); point(function () { var c = visibleCard(); return c && c.querySelector(".map-btn"); }, "Tap See more info on any snake to explore it. Each different snake counts" + (t.goal ? " (" + Math.min(t.goal, S.species.length) + " of " + t.goal + " so far)." : ".")); return; }
    if (k === "want") { toTab("tab-guide"); point(function () { var c = visibleCard(); return c && c.querySelector(".wish-btn"); }, "Tap Want to see on a snake you would love to find."); return; }
    if (k === "3d") { toTab("tab-guide"); point(function () { var c = visibleCard(); if (!c) return null; var bs = c.querySelectorAll("button"); for (var i = 0; i < bs.length; i++) if (bs[i].textContent.trim() === "3D") return bs[i]; return c.querySelector(".map-btn"); }, "Tap 3D to see this snake as a 3D model."); return; }
    if (k === "compare") {
      setFull(false); var c = visibleCard() || D.querySelector("#grid .card[data-id]"), id = c && c.getAttribute("data-id");
      if (window.SL_compare && id) { window.SL_compare(id); point(".cmp-sheet.open .cmp-pick, .cmp-sheet.open .cmp-card", "Choose a second snake here to compare the two side by side."); }
      return;
    }
  }

  /* ---------------- opening a present ---------------- */
  var openT = [];
  function openPresent(id) {
    var t = task(id); if (!t || !S.done[id] || S.opened[id]) return;
    if (XM.unpoint) XM.unpoint();
    S.opened[id] = Date.now(); var got = t.gifts.slice();
    got.forEach(function (g) { S.unlocked[g] = 1; });
    var o = opened();
    if (o >= GLOW_AT && !S.unlocked["orn-glow"]) { S.unlocked["orn-glow"] = 1; got.push("orn-glow"); }
    if (o >= TASKS.length && !S.unlocked["top-snake"]) { S.unlocked["top-snake"] = 1; got.push("top-snake"); S.celebrate = 1; }
    save(); paint();
    var wrapEl = C.root.querySelector(".xc-open"), ov = wrapEl.querySelector(".xc-ob"), wrap = S.deco.wrap || "wrap-classic";
    ov.innerHTML = '<div class="xm-ph"><h3>' + esc(t.name) + '</h3><button type="button" class="xm-px xc-ox" aria-label="Close">' + X_IC + "</button></div>" +
      '<div class="xc-ostage"><div class="xc-gift xc-gift-' + wrap + '"><i class="xc-lid"></i><i class="xc-box"></i><i class="xc-rib"></i><i class="xc-bow"></i><i class="xc-paper l"></i><i class="xc-paper r"></i></div>' +
      '<div class="xc-reveal" hidden><p class="xc-rk">You unwrapped</p><div class="xc-ritems">' + got.map(function (g) { return '<div class="xc-ritem">' + thumb(g) + "<b>" + esc(ITEMS[g].name) + "</b><small>" + CATS.filter(function (c) { return c[0] === ITEMS[g].cat; })[0][2] + "</small></div>"; }).join("") +
      '</div><p class="xc-rsub">Added to My decorations.</p><div class="xc-racts"><button type="button" class="xc-btn xc-use">Put it on the tree</button><button type="button" class="xc-btn xc-done">Close</button></div></div>' +
      '<button type="button" class="xc-skip">Open now</button></div>';
    wrapEl.hidden = false; ov.classList.remove("xc-o1", "xc-o2", "xc-o3"); void ov.offsetWidth;
    var reveal = function () { openT.forEach(clearTimeout); openT = []; ov.classList.add("xc-o3"); ov.querySelector(".xc-reveal").hidden = false; ov.querySelector(".xc-skip").hidden = true; try { ov.querySelector(".xc-use").focus({ preventScroll: true }); } catch (e) {} };
    ov.querySelector(".xc-skip").onclick = reveal;
    ov.querySelector(".xc-ox").onclick = closeOpen; wrapEl.querySelector(".xm-panel-bg").onclick = closeOpen;
    ov.querySelector(".xc-done").onclick = closeOpen;
    ov.querySelector(".xc-use").onclick = function () { got.forEach(function (g) { var c = ITEMS[g].cat; if (c === "ornament") { if (S.orns.indexOf(g) < 0) { S.orns.push(g); if (S.orns.length > MAX_ORN) S.orns.shift(); } } else S.deco[c] = g; }); save(); renderTree(); closeOpen(); };
    if (RM.matches) { reveal(); return; }
    try { ov.querySelector(".xc-skip").focus({ preventScroll: true }); } catch (e) {}
    ov.classList.add("xc-o1");
    var slow = window.XM_CABIN_SLOW || 1;
    openT.push(setTimeout(function () { ov.classList.add("xc-o2"); }, 700 * slow));
    openT.push(setTimeout(reveal, 1700 * slow));
  }
  function closeOpen() {
    openT.forEach(clearTimeout); openT = [];
    var w = C.root.querySelector(".xc-open"); w.hidden = true; w.querySelector(".xc-ob").innerHTML = "";
    if (S.celebrate) { S.celebrate = 0; save(); celebrate(); }
  }
  function celebrate() {
    var c = C.root.querySelector(".xc-celebrate"); c.hidden = false;
    var sp = ""; for (var i = 0; i < (RM.matches ? 0 : 40); i++) sp += '<i style="--x:' + (Math.random() * 100).toFixed(1) + "%;--d:" + (1.6 + Math.random() * 1.6).toFixed(2) + "s;--w:" + (Math.random() * .8).toFixed(2) + 's"></i>';
    c.innerHTML = sp + '<div class="xc-cmsg" role="status"><b>The Christmas collection is complete!</b><span>The gold snake topper is yours - it is on your tree now.</span><button type="button" class="xc-btn">Lovely</button></div>';
    S.deco.topper = "top-snake"; save(); renderTree();
    c.querySelector("button").onclick = function () { c.hidden = true; c.innerHTML = ""; };
  }

  /* ---------------- the room's touchable parts ---------------- */
  function hotAct(k) {
    if (k === "tree") showDlg("decos");
    else if (k === "fire") addLog();
    else if (k === "basket") addLog();       // a log from the basket onto the fire (or, empty, how to get more)
  }

  /* ---------------- the fire ---------------- */
  function addLog() {
    // an empty basket: no dead button - the line saying how to get more logs lights up instead
    if (!(S.logs > 0)) { var h = C.root.querySelector(".xc-loghint"); if (h) { h.classList.remove("xc-flash"); void h.offsetWidth; h.classList.add("xc-flash"); } return; }
    S.logs--; save(); renderLogs();
    var st = C.root.querySelector(".xc-stage"); st.classList.remove("xc-roar"); void st.offsetWidth; st.classList.add("xc-roar");
    setTimeout(function () { st.classList.remove("xc-roar"); }, 2600);
    if (!RM.matches) {
      var f = ART.fire || [780, 446], g = C.svg.querySelector(".xc-sparks"), s = "";
      for (var i = 0; i < 12; i++) s += '<circle class="xc-spk" cx="' + (f[0] - 20 + Math.random() * 40) + '" cy="' + (f[1] - 26) + '" r="' + (1.5 + Math.random() * 1.8).toFixed(1) + '" style="--dx:' + (Math.random() * 40 - 20).toFixed(0) + "px;--dl:" + (Math.random() * .6).toFixed(2) + 's"/>';
      g.innerHTML = s; setTimeout(function () { g.innerHTML = ""; }, 2800);
    }
    if (XM.audio) XM.audio.burst();
  }

  /* ---------------- the tab ---------------- */
  function tabBtn() {
    var g = D.getElementById("tab-guide"); if (!g || D.getElementById("tab-cabin")) return !!g;
    var b = D.createElement("button"); b.className = "tab-btn xm-tab-cabin"; b.id = "tab-cabin"; b.type = "button";
    b.innerHTML = treeIcon() + " Christmas Cabin";
    g.parentNode.insertBefore(b, g.nextSibling);
    b.addEventListener("click", function () { openCabin(false); });
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
    if (XM.audio) XM.audio.setAway(false);
    evaluate(true); paint(); renderTree();
    var tabs2 = D.querySelector(".tabs"); if (tabs2 && push) tabs2.scrollIntoView({ block: "start", behavior: RM.matches ? "auto" : "smooth" });
  }
  // leaving the cabin: the fire keeps crackling, quieter, until it is turned off
  function closeCabin() {
    if (!C.root || C.root.hidden) return;
    setFull(false);
    C.root.hidden = true; D.body.classList.remove("xm-cabin-on"); hideDlgs();
    var b = D.getElementById("tab-cabin"); if (b) { b.classList.remove("xm-active"); b.removeAttribute("aria-current"); }
    if (XM.audio) XM.audio.setAway(true);
  }
  XM.cabin = { open: openCabin, close: closeCabin, state: function () { return S; }, evaluate: evaluate, tasks: TASKS, items: ITEMS,
    showTasks: function () { build(); showDlg("tasks"); }, showDecos: function () { build(); showDlg("decos"); }, full: setFull, seePresent: seePresent, how: how };

  function start() {
    hooks();
    if (XM.kind !== "xm-app") return;
    var tries = 0;
    (function t() { if (!tabBtn() && tries++ < 40) setTimeout(t, 250); else if (new URLSearchParams(location.search).get("tab") === "cabin") {
      (function w(n) { if (!window.__introDone && D.getElementById("intro") && n < 40) { setTimeout(function () { w(n + 1); }, 300); return; } openCabin(false); })(0); } })();
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", start); else start();
})();
