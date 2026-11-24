/* SnakeList events preview - Cursor customization (Settings -> Appearance -> Cursor, and SL_EVENTS.cursor.open()).
   A pointer STYLE (real cursor shapes with an exact hotspot - including "My Snake", a snake of the species you
   choose), a SIZE, a COLOUR (or a colour mode), a TRAIL, a CLICK effect and a HOVER effect, plus Advanced settings,
   named saved presets ("Save" under "Reset to the normal pointer") and seasonal collections (Christmas, New Year,
   Halloween, Anniversary).
   Locks: some items are earned with achievements, Advent doors or seasonal events (see CAT below). Locked ones show
   what earns them and can be PREVIEWED, never equipped, until earned; once earned they stay earned (sl-ev-cursor-unlocks,
   also kept in the account). An unlock shows a message with a Preview button - it never changes the cursor by itself.
   Who gets it: the whole set is a subscriber benefit (as before); items you EARNED work for everyone.
   Only on devices with a real mouse or trackpad (any-pointer: fine + any-hover: hover); touch input is ignored, so
   hybrid laptops keep a normal finger experience. Text fields, disabled controls and anything with its own cursor
   (map dragging, 3D rotating, resizing) keep the system cursor.
   Effects are drawn on ONE transparent canvas that ignores clicks; its drawing loop only runs while something is
   moving and stops by itself (and when the tab is hidden). With "reduce motion" on, moving trails become a still glow
   and click effects a quick fade.
   Saved in this browser and, when signed in, in the account (prefs/{uid}.cursor, as 4 short strings - the Firestore
   rule allows a map of at most 4 keys). If a subscription ends, the normal pointer comes back; choices are kept.
   Christmas items stay hidden while the Christmas event isn't public (config.js xmasPublic). */
(function () {
  "use strict";
  var EV = window.SL_EVENTS; if (!EV) return;
  var D = document, CFG = EV.cfg, esc = EV.esc, ic = EV.art.icon, KEY = "sl-ev-cursor", PKEY = "sl-ev-cursor-presets", UKEY = "sl-ev-cursor-unlocks";
  var MQ = window.matchMedia ? matchMedia("(any-pointer: fine) and (any-hover: hover)") : { matches: false };
  var MAXP = (CFG.cursor && CFG.cursor.maxPresets) || 12;

  /* ================= the catalogue ================= */
  // lock: { ach: id } an app achievement, { sea: id } a seasonal achievement (config.js), { door: n } an Advent door
  // season: which seasonal collection it belongs to (shown in the Seasonal tab)
  var STYLES = [
    { id: "classic", name: "Classic Pointer" }, { id: "modern", name: "Modern Arrow" }, { id: "dot", name: "Minimal Dot" },
    { id: "cross", name: "Precision Crosshair" }, { id: "diamond", name: "Emerald Diamond" }, { id: "head", name: "Snake Head" },
    { id: "leaf", name: "Leaf Pointer" }, { id: "snake", name: "My Snake", note: "a snake of the species you choose" },
    { id: "fang", name: "Snake Fang", lock: { ach: "xMystery" } }, { id: "camera", name: "Camera Accent", lock: { ach: "ph25" } },
    { id: "compass", name: "Compass", lock: { ach: "rng250" } }, { id: "gserpent", name: "Golden Serpent", lock: { ach: "sp500" } },
    { id: "xstar", name: "Christmas Star", season: "xmas", lock: { sea: "f-pioneer" } }, { id: "candycane", name: "Candy Cane", season: "xmas", lock: { sea: "x-enth15" } },
    { id: "gsnake", name: "Golden Snake", season: "xmas", lock: { door: 5 } }, { id: "flake", name: "Snowflake", season: "xmas", lock: { door: 20 } },
    { id: "festive", name: "Festive Emerald", season: "xmas", lock: { door: 13 } }, { id: "winter", name: "Winter Serpent", season: "xmas", lock: { door: 10 } },
    { id: "xserpent", name: "Legendary Christmas Serpent", season: "xmas", lock: { sea: "x-perfect" }, legendary: true },
    { id: "ny2027", name: "Golden 2027 Pointer", season: "ny", lock: { sea: "n-collector" } }, { id: "midstar", name: "Midnight Star", season: "ny", lock: { sea: "n-midnight" } },
    { id: "nyserpent", name: "New Year Serpent", season: "ny", lock: { sea: "n-explorer" } }, { id: "silverc", name: "Silver Celebration", season: "ny", lock: { sea: "n-begin" } },
    { id: "eyes", name: "Glowing Eyes", season: "halloween", lock: { sea: "h-spooky" } }
  ];
  var COLOURS = [
    { id: "emerald", name: "Classic Emerald", hex: "#16A34A" }, { id: "forest", name: "Forest Green", hex: "#166534" }, { id: "lime", name: "Lime", hex: "#84CC16" },
    { id: "ocean", name: "Ocean Blue", hex: "#0284C7" }, { id: "ice", name: "Ice Blue", hex: "#7DD3FC" }, { id: "purple", name: "Royal Purple", hex: "#9333EA" },
    { id: "red", name: "Ruby Red", hex: "#DC2626" }, { id: "orange", name: "Sunset Orange", hex: "#F97316" }, { id: "gold", name: "Christmas Gold", hex: "#EAB308" },
    { id: "white", name: "Snow White", hex: "#F8FAFC" }, { id: "black", name: "Midnight Black", hex: "#111827" }, { id: "pink", name: "Rose Pink", hex: "#EC4899" },
    { id: "silver", name: "Silver Celebration", hex: "#C0C7D1", season: "ny", lock: { sea: "n-complete" } },
    { id: "anniv", name: "Anniversary Gold", hex: "#D4A017", season: "anniv", lock: { sea: "a-birthday" } }
  ];
  var MODES = [
    { id: "solid", name: "Single colour" }, { id: "rainbow", name: "Rainbow" }, { id: "gradient", name: "Gradient" }, { id: "adaptive", name: "Adaptive contrast" },
    { id: "twotone", name: "Two-tone" }, { id: "metal", name: "Metallic gold" }, { id: "frost", name: "Frosted" }
  ];
  // trails: id, name, and how it is drawn (see Fx)
  var TRAILS = [
    { id: "none", name: "None" }, { id: "glow", name: "Soft Glow" }, { id: "trail", name: "Snake Trail" }, { id: "golden", name: "Golden Sparkles" },
    { id: "snow", name: "Snowflake" }, { id: "rainbow", name: "Rainbow" }, { id: "firefly", name: "Firefly" }, { id: "leaves", name: "Forest Leaves" },
    { id: "frost", name: "Frost" }, { id: "sparkle", name: "Star Dust" }, { id: "ripple", name: "Water Ripple" },
    { id: "emerald", name: "Emerald Glow", lock: { ach: "sp25" } }, { id: "scales", name: "Serpent Scales", lock: { ach: "fam10" } },
    { id: "aurora", name: "Aurora", lock: { ach: "cont5" } }, { id: "gserpent", name: "Golden Serpent", lock: { ach: "sp1000" } },
    { id: "lights", name: "Christmas Lights", season: "xmas", lock: { sea: "x-streak3" } }, { id: "snowfall", name: "Falling Snowflakes", season: "xmas", lock: { sea: "x-almost20" } },
    { id: "gholiday", name: "Golden Holiday Sparkles", season: "xmas", lock: { door: 24 } }, { id: "frostsnake", name: "Frosted Snake", season: "xmas", lock: { door: 3 } },
    { id: "candy", name: "Candy Cane Particles", season: "xmas", lock: { door: 2 } },
    { id: "fireworks", name: "Golden Fireworks", season: "ny", lock: { sea: "n-explorer" } }, { id: "midstars", name: "Midnight Stars", season: "ny", lock: { sea: "n-midnight" } },
    { id: "celebr", name: "Celebration Sparkles", season: "ny", lock: { sea: "n-begin" } }, { id: "goldpulse", name: "Gold Pulse", season: "ny", lock: { sea: "n-collector" } },
    { id: "ember", name: "Ember", season: "halloween", lock: { sea: "h-spooky" } }
  ];
  var CLICKS = [
    { id: "none", name: "None" }, { id: "ripple", name: "Soft Ripple" }, { id: "pulse", name: "Emerald Pulse" }, { id: "spark", name: "Golden Spark" },
    { id: "rainbow", name: "Rainbow Pulse" }, { id: "scaleburst", name: "Snake Scale Burst" }, { id: "frostring", name: "Frost Ring" }, { id: "leafburst", name: "Leaf Burst" },
    { id: "star", name: "Star Flash", lock: { ach: "qMaster" } }, { id: "ring", name: "Rotating Ring", lock: { ach: "m3d25" } },
    { id: "snowburst", name: "Snow Burst", season: "xmas", lock: { sea: "x-explorer" } }, { id: "magic", name: "Christmas Magic", season: "xmas", lock: { door: 12 } },
    { id: "starpulse", name: "Star Pulse", season: "xmas", lock: { door: 22 } }, { id: "festive", name: "Festive Sparkle", season: "xmas", lock: { door: 9 } },
    { id: "ornament", name: "Golden Ornament Glow", season: "xmas", lock: { sea: "x-deco" } },
    { id: "firework", name: "Firework Pulse", season: "ny", lock: { sea: "n-begin" } }, { id: "goldring", name: "Golden Ring", season: "ny", lock: { sea: "n-explorer" } },
    { id: "starburst", name: "Star Burst", season: "ny", lock: { sea: "n-midnight" } }, { id: "nysparkle", name: "New Year Sparkle", season: "ny", lock: { sea: "n-collector" } }
  ];
  var HOVERS = [
    { id: "classic", name: "Classic", note: "the usual hand on links and buttons" }, { id: "glow", name: "Subtle Glow" }, { id: "ring", name: "Ring Highlight" },
    { id: "expand", name: "Gentle Expansion" }, { id: "accent", name: "Accent Change" }, { id: "dotexp", name: "Minimal Dot Expansion" }
  ];
  var SEASONS = [["xmas", "Christmas"], ["ny", "New Year"], ["halloween", "Halloween"], ["anniv", "Anniversary"]];
  var KINDS = { style: STYLES, colour: COLOURS, trail: TRAILS, click: CLICKS, hover: HOVERS, mode: MODES };
  var PKEYS = { style: "style", colour: "colour", trail: "effect", click: "click", hover: "hover", mode: "mode" };
  function find(kind, id) { return (KINDS[kind] || []).filter(function (x) { return x.id === id; })[0] || null; }
  var DEF = { style: "classic", size: "normal", colour: "emerald", custom: "#16A34A", mode: "solid", effect: "none", click: "none", hover: "classic", snake: "",
              len: 50, intensity: 60, fade: 50, psize: 100, speed: 100, clickOn: true, hoverOn: true, reduced: false };
  // older saves ({ colour, effect } with the first set of colours) carry over
  var OLDC = { green: "emerald", blue: "ocean" };
  function norm(p) {
    p = Object.assign({}, DEF, p || {});
    if (OLDC[p.colour]) p.colour = OLDC[p.colour];
    if (p.colour === "rainbow") { p.colour = "emerald"; p.mode = "rainbow"; }
    if (p.colour !== "custom" && !find("colour", p.colour)) p.colour = "emerald";
    ["style", "trail", "click", "hover", "mode"].forEach(function (k) { if (!find(k, p[PKEYS[k]])) p[PKEYS[k]] = DEF[PKEYS[k]]; });
    if (["small", "normal", "large"].indexOf(p.size) < 0) p.size = "normal";
    if (!/^#[0-9a-f]{6}$/i.test(p.custom)) p.custom = DEF.custom;
    ["len", "intensity", "fade"].forEach(function (k) { p[k] = Math.max(10, Math.min(100, +p[k] || DEF[k])); });
    ["psize", "speed"].forEach(function (k) { p[k] = Math.max(50, Math.min(150, +p[k] || DEF[k])); });
    p.clickOn = p.clickOn !== false; p.hoverOn = p.hoverOn !== false; p.reduced = !!p.reduced;
    return p;
  }
  var pref = norm(EV.ls.get(KEY, {}) || {});
  var presets = (EV.ls.get(PKEY, []) || []).filter(function (x) { return x && x.name; }).slice(0, MAXP);
  var unlocks = EV.ls.get(UKEY, {}) || {};

  /* ================= locks ================= */
  function xmasShown() { return !(EV.pub && !CFG.xmasPublic); }
  function visible(it) { return !(it.season === "xmas" && !xmasShown()); }
  function seaEarned() { return EV.seasonal ? EV.seasonal.earned() : {}; }
  function doorOpen(n) { try { var st = EV.advent && EV.advent.state(); return !!(st && st.doors && st.doors[n]); } catch (e) { return false; } }
  function lockMet(l) {
    if (!l) return true;
    if (l.ach) return !!(window.SL_ACH && window.SL_ACH.earned(l.ach) != null);
    if (l.sea) return seaEarned()[l.sea] != null;
    if (l.door) return doorOpen(l.door);
    return false;
  }
  function ukey(kind, id) { return kind + ":" + id; }
  function unlocked(kind, it) { return !it.lock || unlocks[ukey(kind, it.id)] != null || lockMet(it.lock); }
  function lockText(l) {
    if (!l) return "";
    if (l.ach) { var a = window.SL_ACH && window.SL_ACH.list().filter(function (x) { return x.id === l.ach; })[0]; return "Earn the “" + (a ? a.name : l.ach) + "” achievement" + (a ? " (" + a.note.replace(/\.$/, "") + ")" : ""); }
    if (l.sea) { var s = CFG.achievements.filter(function (x) { return x.id === l.sea; })[0]; return "Earn the “" + (s ? s.name : l.sea) + "” seasonal achievement" + (s ? " (" + s.desc.replace(/\.$/, "") + ")" : ""); }
    if (l.door) return "Open Advent Calendar door " + l.door + " (Christmas 2026)";
    return "";
  }
  // notice new unlocks: kept for good, with a message that offers a preview (never equips by itself)
  var firstCheck = true;
  function checkUnlocks() {
    var fresh = [];
    Object.keys(KINDS).forEach(function (kind) {
      KINDS[kind].forEach(function (it) {
        if (!it.lock || unlocks[ukey(kind, it.id)] != null || !visible(it)) return;
        if (lockMet(it.lock)) { unlocks[ukey(kind, it.id)] = new Date().toISOString(); fresh.push([kind, it]); }
      });
    });
    if (fresh.length) {
      EV.ls.set(UKEY, unlocks); saveAccount();
      if (!firstCheck && supported()) fresh.slice(0, 3).forEach(function (f, i) {
        setTimeout(function () {
          var t = EV.toast(ic("cursor", 15) + " New cursor unlocked: <b>" + esc(f[1].name) + '</b> <button type="button" class="sl-ev-btn sl-ev-curtoast" data-show="' + f[0] + ":" + f[1].id + '">Preview</button>', 7000);
          var b = t.querySelector("[data-show]"); if (b) b.addEventListener("click", function () { showItem(b.getAttribute("data-show")); t.remove(); });
        }, i * 1200);
      });
      repaintAll();
    }
    firstCheck = false;
  }
  function supported() { return !!MQ.matches; }
  // everything chosen is either the plain default or something this person earned
  function allEarned(p) {
    function ok(kind, id, def) { var it = find(kind, id); return id === def || !!(it && it.lock && unlocked(kind, it)); }
    return ok("style", p.style, "classic") && ok("trail", p.effect, "none") && ok("click", p.click, "none") && p.hover === "classic" &&
      (p.colour === "emerald" || ok("colour", p.colour, "emerald")) && p.mode === "solid";
  }
  function entitled(p) { return EV.isSubscriber() || allEarned(p); }
  function active() { return supported() && entitled(pref) && !touchNow; }
  var touchNow = false;

  /* ================= colours ================= */
  function hexOf(p) { if (p.colour === "custom") return p.custom; var c = find("colour", p.colour); return c ? c.hex : "#16A34A"; }
  function lum(h) { var n = parseInt(h.slice(1), 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255; return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  function shade(h, k) { var n = parseInt(h.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255;
    function f(x) { return Math.max(0, Math.min(255, Math.round(k > 0 ? x + (255 - x) * k : x * (1 + k)))); }
    return "#" + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1); }
  function darkPage() { return D.documentElement.getAttribute("data-sl-theme") === "dark"; }
  // fill (a colour or a gradient id), the outline and the halo that keeps it visible on any background
  function paint(p, accent) {
    var h = hexOf(p), m = p.mode, defs = "", fill = h, f2 = shade(h, .45);
    if (accent) { h = lum(h) > .45 && Math.abs(lum(h) - lum("#EAB308")) < .1 ? "#16A34A" : "#EAB308"; fill = h; m = "solid"; }
    if (m === "rainbow") { defs = '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d4d"/><stop offset=".25" stop-color="#ffd23f"/><stop offset=".5" stop-color="#3ddc84"/><stop offset=".75" stop-color="#3b82f6"/><stop offset="1" stop-color="#a855f7"/></linearGradient>'; fill = "url(#g)"; }
    else if (m === "gradient") { defs = '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + shade(h, .5) + '"/><stop offset="1" stop-color="' + shade(h, -.3) + '"/></linearGradient>'; fill = "url(#g)"; }
    else if (m === "metal") { h = "#D4A017"; defs = '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".35" stop-color="#e3b341"/><stop offset=".6" stop-color="#a87a10"/><stop offset="1" stop-color="#f5d76e"/></linearGradient>'; fill = "url(#g)"; f2 = "#fff3b0"; }
    else if (m === "frost") { defs = '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".5" stop-color="' + shade(h, .65) + '" stop-opacity=".85"/><stop offset="1" stop-color="' + shade(h, .2) + '" stop-opacity=".9"/></linearGradient>'; fill = "url(#g)"; f2 = "#ffffff"; }
    else if (m === "adaptive") { h = darkPage() ? "#F8FAFC" : "#111827"; fill = h; f2 = darkPage() ? "#cbd5e1" : "#475569"; }
    var light = m === "frost" || m === "metal" ? true : lum(h) > .55;
    return { fill: fill, base: h, two: m === "twotone" ? (light ? "#111827" : "#ffffff") : f2, twotone: m === "twotone", defs: defs, line: light ? "#1d2b22" : "#ffffff", halo: light ? "rgba(255,255,255,.9)" : "rgba(0,0,0,.55)" };
  }

  /* ================= snakes for "My Snake" ================= */
  // colours and pattern: a few well-known snakes by hand, then the checklist's colour/pattern data, then the family
  var SNAKES = {
    "oxyuranus-microlepidotus": ["#9a7a45", "#3a2a1c", "band"], "dendroaspis-polylepis": ["#6f6a5e", "#8f8a7c", "plain"], "morelia-viridis": ["#2fa84f", "#e8f7d9", "spot"],
    "micrurus-fulvius": ["#d7261e", "#141414", "coral"], "lampropeltis-triangulum": ["#c8321f", "#141414", "coral"], "ophiophagus-hannah": ["#4b4a2a", "#d9cf8a", "band"],
    "python-regius": ["#3b2a1a", "#c9a05a", "blotch"], "pantherophis-guttatus": ["#e0743a", "#b22e1e", "blotch"], "crotalus-atrox": ["#a8906a", "#5a4632", "blotch"],
    "boa-constrictor": ["#b9a07a", "#6b3b22", "blotch"], "naja-naja": ["#5a4a2e", "#7a6a46", "plain"], "dispholidus-typus": ["#3f8f3a", "#2a5a26", "plain"],
    "bitis-gabonica": ["#8b6a4c", "#e2d2a8", "blotch"], "vipera-berus": ["#8a8a80", "#1e1e1e", "zig"], "thamnophis-sirtalis": ["#2f3a2a", "#e4d24a", "stripe"],
    "eunectes-murinus": ["#5c6b2e", "#1e1e12", "spot"], "chrysopelea-ornata": ["#4a8a2a", "#111111", "band"], "ahaetulla-nasuta": ["#45b02f", "#d8f5c0", "stripe"],
    "hydrophis-platurus": ["#151515", "#e9c932", "stripe"], "agkistrodon-contortrix": ["#c08050", "#7a4426", "band"], "lampropeltis-getula": ["#151515", "#f2efe2", "band"],
    "dendroaspis-angusticeps": ["#2fbf4a", "#a5e86a", "plain"], "pseudonaja-textilis": ["#9a6a3a", "#b88452", "plain"], "notechis-scutatus": ["#3a3a2a", "#d8c878", "band"],
    "atheris-squamigera": ["#4f9a2a", "#c8d84a", "plain"], "trimeresurus-albolabris": ["#3fb04a", "#e8f0a0", "stripe"], "bothriechis-schlegelii": ["#e8c22a", "#a8702a", "spot"],
    "corallus-caninus": ["#2f9a3a", "#f2f2e0", "band"], "heterodon-platirhinos": ["#a88a4a", "#3a2a1a", "blotch"], "natrix-natrix": ["#5a6a4a", "#f0d23a", "plain"]
  };
  var TC = { black: "#2b2b2b", blue: "#3b6fb6", brown: "#8a6a45", green: "#3f8f3a", grey: "#8a8d8a", orange: "#e07a2f", purple: "#7a4a9a", red: "#c43a2e", white: "#eeeeea", yellow: "#e2c84a" };
  var TD = null;
  function traits() { if (TD) return TD; TD = { col: {}, pat: {} }; try { var d = JSON.parse(D.getElementById("trait-data").textContent); ["col", "pat"].forEach(function (k) { Object.keys(d[k] || {}).forEach(function (c) { (d[k][c] || []).forEach(function (id) { (TD[k][id] = TD[k][id] || []).push(c); }); }); }); } catch (e) {} return TD; }
  function card(id) { return id ? D.querySelector('#grid .card[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]') : null; }
  function snakeLook(id) {
    if (SNAKES[id]) return SNAKES[id];
    var t = traits(), cs = (t.col[id] || []).filter(function (c) { return TC[c]; }), ps = t.pat[id] || [], c = card(id), fam = c ? c.getAttribute("data-family") : "";
    var main = cs.filter(function (x) { return x !== "white" && x !== "black"; })[0] || cs[0], other = cs.filter(function (x) { return x !== main; })[0];
    var pat = ps[0] === "banded" ? "band" : ps[0] === "striped" ? "stripe" : ps[0] === "blotched" ? "blotch" : ps[0] === "spotted" ? "spot" : ps[0] === "zigzag" ? "zig" : ps[0] === "checkered" ? "blotch" : "";
    if (main) return [TC[main], other ? TC[other] : shade(TC[main], -.35), pat || "plain"];
    if (fam === "Viperidae") return ["#8b6e4e", "#4a3826", "blotch"];
    if (fam === "Elapidae") return ["#3f3a30", "#6a6250", "plain"];
    if (fam === "Pythonidae" || fam === "Boidae") return ["#7a5a36", "#c9a05a", "blotch"];
    return ["#6a6a3a", "#4a4a28", "plain"];
  }
  function snakeName(id) { var c = card(id); return c ? c.getAttribute("data-name") : ""; }
  var SNAKE_SUGGEST = ["oxyuranus-microlepidotus", "dendroaspis-polylepis", "morelia-viridis", "ophiophagus-hannah", "pantherophis-guttatus", "python-regius", "micrurus-fulvius", "crotalus-atrox"];

  /* ================= drawing the pointer (SVG, 32 x 32, hotspot in the same units) ================= */
  function snakeBody(col, col2, pat, P, extra) {
    var path = "M5.5 5.5C12 5 9.5 13 16 14.5S20 24.5 28 27.5";
    var o = '<path d="' + path + '" fill="none" stroke="' + P.halo + '" stroke-width="8.5" stroke-linecap="round"/>' +
      '<path d="' + path + '" fill="none" stroke="' + P.line + '" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="5.2" stroke-linecap="round"/>';
    if (pat === "band") o += '<path d="' + path + '" fill="none" stroke="' + col2 + '" stroke-width="5.2" stroke-dasharray="2.2 3.4"/>';
    else if (pat === "coral") o += '<path d="' + path + '" fill="none" stroke="#f2d23a" stroke-width="5.2" stroke-dasharray="1.2 6.8" stroke-dashoffset="2"/><path d="' + path + '" fill="none" stroke="' + col2 + '" stroke-width="5.2" stroke-dasharray="2.4 5.6"/>';
    else if (pat === "stripe") o += '<path d="' + path + '" fill="none" stroke="' + col2 + '" stroke-width="1.5" stroke-linecap="round"/>';
    else if (pat === "blotch") o += '<path d="' + path + '" fill="none" stroke="' + col2 + '" stroke-width="3.4" stroke-dasharray="3 3.6" stroke-linecap="round"/>';
    else if (pat === "spot") o += '<path d="' + path + '" fill="none" stroke="' + col2 + '" stroke-width="2.4" stroke-dasharray=".1 3.6" stroke-linecap="round"/>';
    else if (pat === "zig") o += '<path d="' + path + '" fill="none" stroke="' + col2 + '" stroke-width="2" stroke-dasharray="1.6 1.6"/>';
    else if (pat === "scale") o += '<path d="' + path + '" fill="none" stroke="' + col2 + '" stroke-width="2.2" stroke-dasharray=".1 2.4" stroke-linecap="round" opacity=".8"/>';
    else o += '<path d="' + path + '" fill="none" stroke="' + shade(col.charAt(0) === "#" ? col : "#16A34A", .35) + '" stroke-width="1.1" stroke-linecap="round" opacity=".7"/>';
    // the head, its eye and a forked tongue whose tip is the hotspot
    o += '<path d="M1.2 1.2 3.2 2.4M1.2 1.2 2.4 3.2M2.6 2.6 4.6 4.6" stroke="#d6283a" stroke-width="1" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="7" cy="7" rx="4.6" ry="3.4" transform="rotate(45 7 7)" fill="' + col + '" stroke="' + P.line + '" stroke-width="1.3"/>' +
      '<circle cx="6.3" cy="8.6" r=".95" fill="#111"/><circle cx="8.6" cy="6.3" r=".95" fill="#111"/>' + (extra || "");
    return { d: o, x: 1, y: 1, big: true };
  }
  function ink(P, d) { return '<path d="' + d + '" fill="none" stroke="' + P.halo + '" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/><path d="' + d + '" fill="' + P.fill + '" stroke="' + P.line + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>'; }
  var ARROW = "M4 3v21.5l5.6-5.3 3.9 8.6 3.6-1.6-3.9-8.4H21z";
  function shape(id, P, p) {
    var two = P.twotone ? '<path d="M6.2 7.5v11l2.4-2.3" fill="none" stroke="' + P.two + '" stroke-width="1.6" stroke-linecap="round"/>' : "";
    switch (id) {
      case "modern": return { d: ink(P, "M5 4l21 9.2-9.4 3.4L13 26z") + (P.twotone ? '<path d="M8 7.5l9.5 4.3" stroke="' + P.two + '" stroke-width="1.6" stroke-linecap="round"/>' : ""), x: 5, y: 4 };
      case "dot": return { d: '<circle cx="16" cy="16" r="6.6" fill="' + P.halo + '"/><circle cx="16" cy="16" r="5" fill="' + P.fill + '" stroke="' + P.line + '" stroke-width="1.5"/>' + (P.twotone ? '<circle cx="16" cy="16" r="1.8" fill="' + P.two + '"/>' : ""), x: 16, y: 16 };
      case "cross": var cr = "M16 3.5v8.5M16 20v8.5M3.5 16H12M20 16h8.5";
        return { d: '<path d="' + cr + '" stroke="' + P.halo + '" stroke-width="4.4" stroke-linecap="round"/><path d="' + cr + '" stroke="' + (P.fill.indexOf("url") === 0 ? P.base : P.fill) + '" stroke-width="2.2" stroke-linecap="round"/><circle cx="16" cy="16" r="2.6" fill="none" stroke="' + P.line + '" stroke-width="1.4"/><circle cx="16" cy="16" r="1" fill="' + (P.twotone ? P.two : P.line) + '"/>', x: 16, y: 16 };
      case "diamond": return { d: ink(P, "M4 3l17 5.5-6 6.5-6.5 6z") + '<path d="M4 3l11 12M21 8.5 8.5 21" stroke="' + (P.twotone ? P.two : P.line) + '" stroke-width=".9" opacity=".75"/>', x: 4, y: 3 };
      case "head": return { d: ink(P, "M3.5 3.5C11 2.5 19.5 6 23 12.5c2.4 4.6-.6 9.5-5.6 9.5-5.2 0-9.4-4.6-11.6-9.6C4.4 9.4 3.6 6.8 3.5 3.5z") + '<circle cx="10.5" cy="9.6" r="1.3" fill="#111"/><circle cx="15.8" cy="8.4" r="1.3" fill="#111"/>' + (P.twotone ? '<path d="M7 7.5c4 1.5 8 5 9.5 10" fill="none" stroke="' + P.two + '" stroke-width="1.4" stroke-linecap="round"/>' : ""), x: 4, y: 4 };
      case "fang": return { d: ink(P, "M4 3c6.5 0 11 4.5 11 10.5 0 3.2-1.4 6.8-3.6 12.5L9.8 15.8C9.3 10.7 7.4 6.4 4 3z") + '<circle cx="12.4" cy="25.2" r="1.2" fill="#7dd3fc" stroke="' + P.line + '" stroke-width=".6"/>', x: 4, y: 3 };
      case "leaf": return { d: ink(P, "M4 4c11.5 0 21.5 6.5 21.5 16.5 0 4.3-3.3 7.5-8 7.5C9.5 28 4 17.5 4 4z") + '<path d="M4 4l15.5 18M11 13.5l-1 5M15 18l4-1" stroke="' + (P.twotone ? P.two : P.line) + '" stroke-width="1.1" stroke-linecap="round" fill="none"/>', x: 4, y: 4 };
      case "camera": return { d: ink(P, ARROW) + two + '<rect x="17" y="19.5" width="12" height="9" rx="2" fill="#1f2937" stroke="#fff" stroke-width="1"/><circle cx="23" cy="24" r="2.6" fill="#7dd3fc" stroke="#fff" stroke-width=".9"/><rect x="19" y="18" width="3.5" height="2" rx=".6" fill="#1f2937"/>', x: 4, y: 3 };
      case "compass": return { d: '<circle cx="18" cy="18" r="10" fill="' + P.halo + '"/><circle cx="18" cy="18" r="8.8" fill="#fffaf0" stroke="' + P.line + '" stroke-width="1.3"/><path d="M18 10.5v2M18 23.5v2M10.5 18h2M23.5 18h2" stroke="#6b7280" stroke-width="1"/>' +
        '<path d="M3.5 3.5 20.5 16.5 16.5 20.5z" fill="' + P.fill + '" stroke="' + P.line + '" stroke-width="1.2" stroke-linejoin="round"/><path d="M20.5 16.5 27 27 16.5 20.5z" fill="#9ca3af" stroke="' + P.line + '" stroke-width="1"/><circle cx="18.5" cy="18.5" r="1.4" fill="' + P.line + '"/>', x: 4, y: 4 };
      case "xstar": case "midstar": var st = "M13 2.5l3.1 7 7.6.7-5.8 5 1.8 7.4L13 18.7l-6.7 3.9 1.8-7.4-5.8-5 7.6-.7z";
        var sp = id === "xstar" ? { fill: "#facc15", line: "#7a5a00", halo: P.halo } : { fill: "#c7d2fe", line: "#1e1b4b", halo: "rgba(10,10,40,.6)" };
        return { d: '<path d="' + st + '" fill="none" stroke="' + sp.halo + '" stroke-width="3.4" stroke-linejoin="round"/><path d="' + st + '" fill="' + sp.fill + '" stroke="' + sp.line + '" stroke-width="1.3" stroke-linejoin="round"/><circle cx="13" cy="12.6" r="1.3" fill="#fff"/>' + (id === "midstar" ? '<path d="M24 22a4 4 0 1 0 4 5 3.2 3.2 0 0 1-4-5z" fill="#fde68a" stroke="#1e1b4b" stroke-width=".8"/>' : ""), x: 13, y: 12 };
      case "candycane": return { d: '<path d="M4 4 19.5 19.5a5 5 0 1 0 7-7" fill="none" stroke="' + P.halo + '" stroke-width="7" stroke-linecap="round"/><path d="M4 4 19.5 19.5a5 5 0 1 0 7-7" fill="none" stroke="#b91c1c" stroke-width="5" stroke-linecap="round"/><path d="M4 4 19.5 19.5a5 5 0 1 0 7-7" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="2.6 2.6"/>', x: 4, y: 4 };
      case "flake": var fl = "M16 3v26M4.7 9.5l22.6 13M4.7 22.5l22.6-13M16 3l-2.5 2.5M16 3l2.5 2.5M16 29l-2.5-2.5M16 29l2.5-2.5";
        return { d: '<path d="' + fl + '" stroke="rgba(15,40,70,.6)" stroke-width="4" stroke-linecap="round"/><path d="' + fl + '" stroke="#e0f2fe" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="16" r="2" fill="#7dd3fc"/>', x: 16, y: 16 };
      case "festive": return { d: ink({ fill: "#16A34A", line: "#fff", halo: P.halo }, ARROW) + '<circle cx="20" cy="25" r="3.6" fill="#dc2626" stroke="#fff" stroke-width="1"/><rect x="19" y="20.4" width="2" height="1.6" fill="#facc15"/><path d="M8 7l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z" fill="#facc15"/>', x: 4, y: 3 };
      case "ny2027": return { d: ink({ fill: "url(#gg)", line: "#5a4100", halo: P.halo }, ARROW) + '<text x="17.5" y="30" font-family="Arial,sans-serif" font-weight="700" font-size="8" fill="#fde68a" stroke="#5a4100" stroke-width=".5">27</text>',
        defs: '<linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#e3b341"/><stop offset="1" stop-color="#a87a10"/></linearGradient>', x: 4, y: 3 };
      case "silverc": return { d: ink({ fill: "url(#gs)", line: "#334155", halo: P.halo }, ARROW) + '<path d="M22 6l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="#e2e8f0" stroke="#334155" stroke-width=".5"/>',
        defs: '<linearGradient id="gs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#cbd5e1"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>', x: 4, y: 3 };
      case "eyes": return { d: '<path d="M3 3h26v14H3z" fill="none"/><ellipse cx="9" cy="10" rx="6" ry="4.4" fill="#111" stroke="' + P.halo + '" stroke-width="1.5"/><ellipse cx="23" cy="10" rx="6" ry="4.4" fill="#111" stroke="' + P.halo + '" stroke-width="1.5"/><ellipse cx="9" cy="10" rx="4.4" ry="3" fill="#facc15"/><ellipse cx="23" cy="10" rx="4.4" ry="3" fill="#facc15"/><path d="M9 7.2v5.6M23 7.2v5.6" stroke="#111" stroke-width="1.6" stroke-linecap="round"/>', x: 16, y: 10 };
      case "snake": var lk = snakeLook(p.snake || "oxyuranus-microlepidotus"); return snakeBody(lk[0], lk[1], lk[2], P);
      case "gserpent": return withDefs(snakeBody("url(#gold)", "#fff3b0", "scale", { line: "#5a4100", halo: P.halo }), GOLD);
      case "gsnake": return withDefs(snakeBody("url(#gold)", "#a87a10", "band", { line: "#5a4100", halo: P.halo }), GOLD);
      case "winter": return snakeBody("#bae6fd", "#ffffff", "spot", { line: "#0c4a6e", halo: P.halo });
      case "nyserpent": return withDefs(snakeBody("#cbd5e1", "url(#gold)", "band", { line: "#334155", halo: P.halo }), GOLD);
      case "xserpent": return withDefs(snakeBody("url(#gold)", "#fff3b0", "scale", { line: "#5a4100", halo: P.halo },
        '<path d="M5.5 3.8 11.5 2.2 10.8 8.4z" fill="#c8323f" stroke="#7a1020" stroke-width=".6"/><path d="M5 4.8q3.6-2 7-2.4" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="2.2" r="1.4" fill="#fff"/>'), GOLD);
      default: return { d: ink(P, ARROW) + two, x: 4, y: 3 };
    }
  }
  var GOLD = '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".4" stop-color="#e3b341"/><stop offset=".75" stop-color="#a87a10"/><stop offset="1" stop-color="#f5d76e"/></linearGradient>';
  function withDefs(s, d) { s.defs = (s.defs || "") + d; return s; }
  var PX = { small: 22, normal: 28, large: 36 };
  // the CSS value for a pointer: variant "" (normal) or the hover look (glow, ring, expand, accent, dotexp)
  function cursorCss(p, variant) {
    var P = paint(p, variant === "accent"), s = shape(p.style, P, p), px = PX[p.size] || 28;
    if (s.big) px = Math.round(px * 1.18);
    if (variant === "expand" || variant === "dotexp") px = Math.round(px * 1.22);
    px = Math.min(px, 64);
    var k = px / 32, hx = Math.round(s.x * k), hy = Math.round(s.y * k), under = "";
    if (variant === "glow") under = '<radialGradient id="hg"><stop offset="0" stop-color="' + P.base + '" stop-opacity=".55"/><stop offset="1" stop-color="' + P.base + '" stop-opacity="0"/></radialGradient><circle cx="' + s.x + '" cy="' + s.y + '" r="9" fill="url(#hg)"/>';
    if (variant === "ring") under = '<circle cx="' + s.x + '" cy="' + s.y + '" r="6.5" fill="none" stroke="' + P.halo + '" stroke-width="3"/><circle cx="' + s.x + '" cy="' + s.y + '" r="6.5" fill="none" stroke="' + P.base + '" stroke-width="1.6"/>';
    if (variant === "dotexp") under = '<circle cx="' + s.x + '" cy="' + s.y + '" r="5.5" fill="' + P.base + '" opacity=".45"/>';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + px + '" height="' + px + '" viewBox="0 0 32 32" fill="none"><defs>' + P.defs + (s.defs || "") + "</defs>" + under + s.d + "</svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") ' + hx + " " + hy;
  }
  function iconSvg(p, size) {   // the same drawing as a little picture for the buttons
    var P = paint(p), s = shape(p.style, P, p);
    return '<svg viewBox="0 0 32 32" width="' + (size || 26) + '" height="' + (size || 26) + '" fill="none" aria-hidden="true"><defs>' + P.defs + (s.defs || "") + "</defs>" + s.d + "</svg>";
  }

  /* ================= applying it to the page ================= */
  var INTER = "a[href], button, [role=button], [role=tab], [role=switch], summary, label[for], select, .card";
  var TEXTY = 'input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), textarea, [contenteditable=""], [contenteditable="true"]';
  function pageCss(p, scope) {
    var root = scope || "html.sl-ev-cur", base = cursorCss(p, ""), hov = !p.hoverOn || p.hover === "classic" ? "pointer" : cursorCss(p, p.hover) + ", pointer";
    var sel = function (list) { return list.split(",").map(function (x) { return root + " " + x.trim(); }).join(", "); };
    return (scope ? root : "html.sl-ev-cur, html.sl-ev-cur body") + " { cursor: " + base + ", auto; }\n" +
      sel(INTER) + " { cursor: " + hov + "; }\n" +
      sel(TEXTY) + " { cursor: text; }\n" +
      sel("button:disabled, input:disabled, select:disabled, textarea:disabled, [aria-disabled=true]") + " { cursor: not-allowed; }\n";
  }
  var styleEl = null;
  function applyPointer() {
    var on = active();
    D.documentElement.classList.toggle("sl-ev-cur", on);
    if (!on) { if (styleEl) { styleEl.remove(); styleEl = null; } return; }
    if (!styleEl) { styleEl = D.createElement("style"); styleEl.id = "sl-ev-cur-style"; D.head.appendChild(styleEl); }
    var css = pageCss(pref);
    if (styleEl.textContent !== css) styleEl.textContent = css;
  }

  /* ================= effects engine (one per canvas) ================= */
  // trails: glow = a soft light at the pointer; ribbon = a fading line; parts = particles; rings = ripples; lights = bulbs on a wire
  var TR = {
    glow: { glow: { r: 24 } }, emerald: { glow: { r: 34, col: "#10B981" }, parts: { k: "dot", cols: ["#34d399", "#a7f3d0"], rate: .35, life: .03, size: 1.6, vy: -.25 } },
    trail: { ribbon: { w: 7 } }, rainbow: { ribbon: { w: 7, col: "rainbow" } }, aurora: { ribbon: { w: 11, col: "aurora", a: .55 } },
    gserpent: { ribbon: { w: 6, col: "#E0B13B", scales: "#fff3b0" }, parts: { k: "star", cols: ["#fff3c4"], rate: .25, life: .03, size: 1.4 } },
    frostsnake: { ribbon: { w: 7, col: "#bae6fd", scales: "#ffffff" }, parts: { k: "flake", cols: ["#e0f2fe"], rate: .2, life: .02, size: 1.8 } },
    golden: { parts: { k: "star", cols: ["#E0B13B", "#fff3c4"], rate: 1, life: .028, size: 1.8, spread: 1.6 } },
    sparkle: { parts: { k: "star", cols: ["$"], rate: 1, life: .028, size: 1.8, spread: 1.6 } },
    snow: { parts: { k: "flake", cols: ["#ffffff", "#dbeafe"], rate: .8, life: .012, size: 2.6, vy: .55, spread: .6 } },
    snowfall: { parts: { k: "flake", cols: ["#ffffff"], rate: .6, life: .008, size: 3.2, vy: 1.1, spread: .5 } },
    firefly: { parts: { k: "glowdot", cols: ["#facc15", "#bef264"], rate: .45, life: .012, size: 2, spread: 1.2, wander: 1 } },
    leaves: { parts: { k: "leaf", cols: ["#16a34a", "#65a30d", "#a16207"], rate: .45, life: .011, size: 3, vy: .7, spread: .8, spin: 1 } },
    frost: { glow: { r: 18, col: "#7dd3fc" }, parts: { k: "flake", cols: ["#bae6fd", "#e0f2fe"], rate: .7, life: .03, size: 1.8, spread: 1 } },
    ripple: { rings: { col: "#38bdf8", every: 40 } },
    ember: { parts: { k: "spark", cols: ["#f97316", "#fbbf24", "#ef4444"], rate: .9, life: .03, size: 1.6, vy: -.9, spread: 1 } },
    scales: { parts: { k: "scale", cols: ["$"], rate: .5, life: .022, size: 3.2, spread: .5 } },
    lights: { lights: { cols: ["#ef4444", "#22c55e", "#facc15", "#3b82f6"] } },
    gholiday: { parts: { k: "star", cols: ["#facc15", "#fde68a", "#ffffff"], rate: 1.1, life: .024, size: 1.9, spread: 1.6 } },
    candy: { parts: { k: "dot", cols: ["#ef4444", "#ffffff"], rate: .9, life: .026, size: 2.2, spread: 1.2 } },
    fireworks: { parts: { k: "spark", cols: ["#facc15", "#fde68a", "#fb923c"], rate: .8, life: .03, size: 1.7, spread: 2.6 } },
    midstars: { parts: { k: "star", cols: ["#c7d2fe", "#ffffff", "#fde68a"], rate: .7, life: .02, size: 1.6, spread: .8 } },
    celebr: { parts: { k: "dot", cols: ["#f43f5e", "#facc15", "#22c55e", "#3b82f6", "#a855f7"], rate: .9, life: .022, size: 1.8, spread: 1.8, vy: .5 } },
    goldpulse: { glow: { r: 26, col: "#EAB308", pulse: 1 } }
  };
  // click effects: short (about half a second) and small (never more than about 30 px across the pointer)
  var CL = {
    ripple: { ring: { r: 22, w: 2 } }, pulse: { ring: { r: 18, w: 4, col: "#16A34A", fill: 1 } }, spark: { burst: { k: "spark", cols: ["#facc15", "#fde68a"], n: 10 } },
    rainbow: { ring: { r: 22, w: 3, col: "rainbow" } }, scaleburst: { burst: { k: "scale", cols: ["$"], n: 8 } }, frostring: { ring: { r: 20, w: 2.5, col: "#7dd3fc" }, burst: { k: "flake", cols: ["#e0f2fe"], n: 4 } },
    leafburst: { burst: { k: "leaf", cols: ["#16a34a", "#65a30d", "#84cc16"], n: 7 } }, star: { flash: { col: "#fde68a", r: 11 } }, ring: { spin: { r: 15 } },
    snowburst: { burst: { k: "flake", cols: ["#ffffff", "#bae6fd"], n: 8 } }, magic: { ring: { r: 18, w: 2, col: "#facc15" }, burst: { k: "star", cols: ["#ef4444", "#22c55e", "#facc15"], n: 9 } },
    starpulse: { flash: { col: "#facc15", r: 10 }, ring: { r: 20, w: 2, col: "#facc15" } }, festive: { burst: { k: "dot", cols: ["#ef4444", "#22c55e", "#facc15", "#ffffff"], n: 12 } },
    ornament: { glowc: { col: "#EAB308", r: 20 } }, firework: { burst: { k: "spark", cols: ["#facc15", "#fb923c", "#fde68a"], n: 14, fast: 1 } }, goldring: { ring: { r: 20, w: 3, col: "#EAB308" } },
    starburst: { burst: { k: "star", cols: ["#fde68a", "#ffffff"], n: 8 } }, nysparkle: { burst: { k: "star", cols: ["#e2e8f0", "#facc15"], n: 10 }, ring: { r: 16, w: 1.5, col: "#e2e8f0" } }
  };
  function Fx(canvas, box) {
    this.c = canvas; this.box = box; this.ctx = canvas.getContext("2d"); this.parts = []; this.trail = []; this.rings = []; this.clicks = []; this.x = null; this.y = null; this.dist = 0;
    this.raf = 0; this.effect = "none"; this.p = pref; this.size();
  }
  Fx.prototype.size = function () {
    var r = this.box(), dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height; this.c.width = Math.max(1, Math.round(r.width * dpr)); this.c.height = Math.max(1, Math.round(r.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  Fx.prototype.set = function (p) { this.p = p; this.effect = p.effect; this.colour = p.colour; this.stop(); };
  Fx.prototype.stop = function () { cancelAnimationFrame(this.raf); this.raf = 0; this.parts.length = 0; this.trail.length = 0; this.rings.length = 0; this.clicks.length = 0; this.ctx.clearRect(0, 0, this.w, this.h); };
  Fx.prototype.calm = function () { return EV.reducedMotion() || this.p.reduced; };
  Fx.prototype.still = function () { return this.calm() && this.effect !== "none"; };
  Fx.prototype.col = function (c) { var h = hexOf(this.p); return c === "$" ? (this.p.mode === "rainbow" ? "hsl(" + Math.floor(Math.random() * 360) + ",90%,62%)" : this.p.mode === "metal" ? "#E3B341" : h) : c; };
  Fx.prototype.move = function (x, y) {
    if (this.effect === "none") return;
    var px = this.x, py = this.y; this.x = x; this.y = y;
    var T = TR[this.still() ? "glow" : this.effect] || {}, p = this.p, now = performance.now(), d = px == null ? 0 : Math.hypot(x - px, y - py), i;
    if (T.ribbon || T.lights) { this.trail.push({ x: x, y: y, t: now }); var mx = 8 + Math.round(p.len * .45); while (this.trail.length > mx) this.trail.shift(); }
    if (T.rings) { this.dist += d; if (this.dist > T.rings.every) { this.dist = 0; if (this.rings.length < 8) this.rings.push({ x: x, y: y, t: now }); } }
    if (T.parts) {
      var P = T.parts, n = Math.min(3, Math.max(d > 2 ? 1 : 0, Math.round((d / 18 + .4) * P.rate * p.intensity / 60))), sz = p.psize / 100, sp = p.speed / 100;
      for (i = 0; i < n && this.parts.length < 80; i++) {
        var s = (P.spread || 1) * sp;
        this.parts.push({ k: P.k, x: x + (Math.random() - .5) * 8, y: y + (Math.random() - .5) * 8, vx: (Math.random() - .5) * 1.6 * s, vy: (P.vy || 0) * sp + (Math.random() - .5) * 1.6 * s * (P.vy ? .4 : 1) - (P.vy ? 0 : .3),
          life: 1, dl: P.life * (.5 + p.fade / 100), r: P.size * sz * (.8 + Math.random() * .5), c: this.col(P.cols[Math.floor(Math.random() * P.cols.length)]), a: Math.random() * 6, wander: P.wander, spin: P.spin });
      }
    }
    this.kick();
  };
  Fx.prototype.click = function (x, y) {
    var c = CL[this.p.click]; if (!c || !this.p.clickOn) return;
    if (this.clicks.length > 6) this.clicks.shift();
    var now = performance.now(), sp = this.p.speed / 100;
    this.clicks.push({ x: x, y: y, t: now, c: c, dur: (this.calm() ? 260 : 560) / sp });
    if (c.burst && !this.calm()) for (var i = 0; i < c.burst.n && this.parts.length < 80; i++) {
      var a = i / c.burst.n * Math.PI * 2 + Math.random() * .3, v = (c.burst.fast ? 2.6 : 1.8) * sp * (.7 + Math.random() * .5);
      this.parts.push({ k: c.burst.k, x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, dl: .045 * sp, r: (c.burst.k === "leaf" || c.burst.k === "scale" ? 2.6 : 1.7) * this.p.psize / 100, c: this.col(c.burst.cols[i % c.burst.cols.length]), a: a, spin: 1, drag: .92 });
    }
    this.kick();
  };
  Fx.prototype.kick = function () { var self = this; if (!this.raf && !D.hidden) this.raf = requestAnimationFrame(function (t) { self.frame(t); }); };
  Fx.prototype.frame = function () {
    this.raf = 0;
    var ctx = this.ctx, e = this.still() ? "glow" : this.effect, T = TR[e] || {}, p = this.p, base = hexOf(p), alive = false, now = performance.now(), i, rb = p.mode === "rainbow";
    ctx.clearRect(0, 0, this.w, this.h);
    var life = 280 + p.len * 4 * (1.5 - p.fade / 100);
    if (T.glow && this.x != null) {
      var gc = T.glow.col || (rb ? "hsl(" + ((now / 20) % 360) + ",90%,60%)" : base), R = T.glow.r * (.7 + p.intensity / 200) * (T.glow.pulse && !this.calm() ? 1 + .15 * Math.sin(now / 160) : 1);
      var g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, R); g.addColorStop(0, hexA(gc, .5 * p.intensity / 60)); g.addColorStop(1, hexA(gc, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, 7); ctx.fill();
      if ((rb || T.glow.pulse) && !this.calm()) alive = true;
    }
    if (T.ribbon || T.lights) {
      this.trail = this.trail.filter(function (q) { return now - q.t < life; });
      var n = this.trail.length, Rb = T.ribbon || {};
      for (i = 1; i < n; i++) {
        var a = this.trail[i - 1], b = this.trail[i], k = i / n;
        if (T.lights) { ctx.strokeStyle = hexA("#14532d", k * .8); ctx.lineWidth = 1.4; }
        else {
          var col = Rb.col === "rainbow" || (!Rb.col && rb) ? "hsla(" + ((i * 14 + now / 6) % 360) + ",90%,60%," + k + ")" : Rb.col === "aurora" ? "hsla(" + (140 + 120 * Math.sin(i / 6 + now / 900)) + ",80%,60%," + (k * (Rb.a || 1)) + ")" : hexA(Rb.col || base, k * .9);
          ctx.strokeStyle = col; ctx.lineWidth = 1 + k * Rb.w * p.psize / 100;
        }
        ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (Rb.scales && i % 3 === 0) { ctx.fillStyle = hexA(Rb.scales, k * .9); ctx.beginPath(); ctx.arc(b.x, b.y, 1 + k * 1.6, 0, 7); ctx.fill(); }
        if (T.lights && i % 4 === 0) { ctx.fillStyle = hexA(T.lights.cols[(i / 4) % 4], k); ctx.beginPath(); ctx.arc(b.x, b.y + 3, 2.6 * p.psize / 100, 0, 7); ctx.fill(); }
      }
      if (n > 1 && !T.lights) { var hd = this.trail[n - 1]; ctx.fillStyle = Rb.col && Rb.col.charAt(0) === "#" ? Rb.col : rb || Rb.col ? "#fff" : base; ctx.beginPath(); ctx.arc(hd.x, hd.y, 4.5 * p.psize / 100, 0, 7); ctx.fill(); }
      alive = alive || n > 0;
    }
    if (this.rings.length) {
      var self = this;
      this.rings = this.rings.filter(function (r) { return now - r.t < 900; });
      this.rings.forEach(function (r) { var k = (now - r.t) / 900; ctx.strokeStyle = hexA(T.rings ? T.rings.col : "#38bdf8", (1 - k) * .7); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(r.x, r.y, 4 + k * 22, 2 + k * 9, 0, 0, 7); ctx.stroke(); });
      alive = alive || this.rings.length > 0;
    }
    if (this.clicks.length) {
      this.clicks = this.clicks.filter(function (c) { return now - c.t < c.dur; });
      for (i = 0; i < this.clicks.length; i++) {
        var C = this.clicks[i], q = (now - C.t) / C.dur, fade = 1 - q, cc = C.c, calm = this.calm();
        if (cc.ring) { var rc = cc.ring.col === "rainbow" ? "hsl(" + ((now / 3) % 360) + ",90%,60%)" : cc.ring.col || base, rr = calm ? cc.ring.r * .6 : 4 + q * cc.ring.r;
          if (cc.ring.fill) { ctx.fillStyle = hexA(rc, fade * .25); ctx.beginPath(); ctx.arc(C.x, C.y, rr, 0, 7); ctx.fill(); }
          ctx.strokeStyle = hexA(rc, fade * .9); ctx.lineWidth = cc.ring.w * fade + .5; ctx.beginPath(); ctx.arc(C.x, C.y, rr, 0, 7); ctx.stroke(); }
        if (cc.spin) { var sr = cc.spin.r * (calm ? .8 : 1 - q * .4), a0 = calm ? 0 : q * Math.PI * 3; ctx.strokeStyle = hexA(base, fade); ctx.lineWidth = 2.4; ctx.lineCap = "round";
          ctx.beginPath(); ctx.arc(C.x, C.y, sr, a0, a0 + 2.2); ctx.stroke(); ctx.beginPath(); ctx.arc(C.x, C.y, sr, a0 + Math.PI, a0 + Math.PI + 2.2); ctx.stroke(); }
        if (cc.flash) { ctx.globalAlpha = fade; ctx.fillStyle = cc.flash.col; star(ctx, C.x, C.y, cc.flash.r * (calm ? .5 : .3 + Math.sin(q * Math.PI) * .7) / 2); ctx.globalAlpha = 1; }
        if (cc.glowc) { var gr = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, cc.glowc.r); gr.addColorStop(0, hexA(cc.glowc.col, fade * .7)); gr.addColorStop(1, hexA(cc.glowc.col, 0)); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(C.x, C.y, cc.glowc.r, 0, 7); ctx.fill(); }
      }
      alive = alive || this.clicks.length > 0;
    }
    if (this.parts.length) {
      for (i = this.parts.length - 1; i >= 0; i--) {
        var pt = this.parts[i];
        if (pt.wander) { pt.vx += (Math.random() - .5) * .3; pt.vy += (Math.random() - .5) * .3; }
        if (pt.drag) { pt.vx *= pt.drag; pt.vy *= pt.drag; }
        pt.x += pt.vx; pt.y += pt.vy; pt.life -= pt.dl; if (pt.spin) pt.a += .12;
        if (pt.life <= 0 || pt.y > this.h + 10 || pt.y < -10) { this.parts.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, Math.min(1, pt.life)); ctx.fillStyle = pt.c; ctx.strokeStyle = pt.c;
        drawPart(ctx, pt);
      }
      ctx.globalAlpha = 1; alive = alive || this.parts.length > 0;
    }
    if (alive) this.kick();
  };
  function drawPart(ctx, p) {
    var r = p.r;
    if (p.k === "star") star(ctx, p.x, p.y, r * (1 + (1 - p.life)));
    else if (p.k === "flake") { ctx.lineWidth = Math.max(.8, r * .4); ctx.beginPath(); for (var j = 0; j < 3; j++) { var a = p.a + j * Math.PI / 3; ctx.moveTo(p.x - Math.cos(a) * r, p.y - Math.sin(a) * r); ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); } ctx.stroke(); }
    else if (p.k === "leaf") { ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 1.3, r * .6, p.a, 0, 7); ctx.fill(); }
    else if (p.k === "scale") { ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(p.x, p.y, r, Math.PI * .1 + p.a * .2, Math.PI * .9 + p.a * .2); ctx.stroke(); }
    else if (p.k === "spark") { ctx.lineWidth = Math.max(1, r * .6); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); ctx.stroke(); }
    else if (p.k === "glowdot") { var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3); g.addColorStop(0, p.c); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 3, 0, 7); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); }
  }
  function star(ctx, x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r * 2); ctx.lineTo(x + r * .5, y - r * .5); ctx.lineTo(x + r * 2, y); ctx.lineTo(x + r * .5, y + r * .5); ctx.lineTo(x, y + r * 2); ctx.lineTo(x - r * .5, y + r * .5); ctx.lineTo(x - r * 2, y); ctx.lineTo(x - r * .5, y - r * .5); ctx.closePath(); ctx.fill(); }
  function hexA(c, a) {
    if (/^hsl\(/.test(c)) return c.replace("hsl(", "hsla(").replace(")", "," + a + ")");
    if (/^hsla?\(/.test(c) || /^rgba?\(/.test(c)) return c;
    var m = /^#?([0-9a-f]{6})$/i.exec(c); if (!m) return c; var n = parseInt(m[1], 16);
    return "rgba(" + (n >> 16) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + Math.max(0, Math.min(1, a)) + ")";
  }

  /* ================= the page-wide effect ================= */
  var G = null;
  function applyFx() {
    var want = active() && (pref.effect !== "none" || (pref.click !== "none" && pref.clickOn));
    if (!want) { if (G) { G.stop(); G.c.remove(); G = null; } return; }
    if (!G) {
      var c = D.createElement("canvas"); c.className = "sl-ev-curfx"; c.setAttribute("aria-hidden", "true"); D.body.appendChild(c);
      G = new Fx(c, function () { return { width: window.innerWidth, height: window.innerHeight }; });
    }
    G.set(pref);
  }
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch" || e.pointerType === "pen") { if (!touchNow && e.pointerType === "touch") { touchNow = true; apply(true); } return; }
    if (touchNow) { touchNow = false; apply(true); }
    if (G) G.move(e.clientX, e.clientY);
  }, { passive: true });
  window.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse" && G) G.click(e.clientX, e.clientY); }, { passive: true, capture: true });
  window.addEventListener("resize", function () { if (G) G.size(); });
  D.addEventListener("visibilitychange", function () { if (D.hidden && G) G.stop(); });
  function apply(quiet) { applyPointer(); applyFx(); if (!quiet) EV.emit("cursor", { pref: pref, active: active() }); }
  // the "adaptive contrast" colour follows the light/dark look
  if (window.MutationObserver) new MutationObserver(function () { if (pref.mode === "adaptive") { applyPointer(); repaintAll(); } }).observe(D.documentElement, { attributes: true, attributeFilter: ["data-sl-theme"] });

  /* ================= saving ================= */
  function saveAccount() {
    var u = EV.user(); if (!u || EV.testMode()) return;
    var data = { cursor: { v: 2, p: JSON.stringify(pref), presets: JSON.stringify(presets), u: JSON.stringify(unlocks) }, updated: EV.serverTimestamp() };
    EV.db().then(function (db) { return db.collection("prefs").doc(u.uid).set(data); }).catch(function () {});
  }
  function save() { EV.ls.set(KEY, pref); apply(); saveAccount(); }
  EV.on("auth", function (u) {
    if (!u) return;
    EV.db().then(function (db) { return db.collection("prefs").doc(u.uid).get(); }).then(function (d) {
      var c = d.exists && d.data().cursor; if (!c) return;
      try {
        if (c.v === 2) {
          pref = norm(JSON.parse(c.p || "{}"));
          var ps = JSON.parse(c.presets || "[]"); if (Array.isArray(ps)) { var have = {}; presets.forEach(function (x) { have[x.name] = 1; }); ps.forEach(function (x) { if (x && x.name && !have[x.name]) presets.push(x); }); presets = presets.slice(0, MAXP); }
          var uu = JSON.parse(c.u || "{}"); Object.keys(uu || {}).forEach(function (k) { if (unlocks[k] == null) unlocks[k] = uu[k]; });
        } else if (c.colour) pref = norm({ colour: c.colour, effect: c.effect || "none" });
      } catch (e) { return; }
      EV.ls.set(KEY, pref); EV.ls.set(PKEY, presets); EV.ls.set(UKEY, unlocks); apply(); repaintAll();
    }).catch(function () {});
  });
  EV.on("sub", function () { apply(); repaintAll(); });
  if (MQ.addEventListener) MQ.addEventListener("change", function () { apply(); repaintAll(); });

  /* ================= the settings UI (in Settings, and in its own panel) ================= */
  var TABS = [["styles", "Cursor Styles"], ["colours", "Colours"], ["trails", "Trails"], ["clicks", "Click Effects"], ["hover", "Hover Effects"], ["seasonal", "Seasonal"], ["advanced", "Advanced"]];
  var UIS = [];
  function UI(root, inPanel) { this.root = root; this.tab = "styles"; this.prev = null; this.saving = false; this.q = ""; this.inPanel = inPanel; this.PF = null; UIS.push(this); this.render(); this.wire(); }
  function repaintAll() { UIS = UIS.filter(function (u) { return u.root.isConnected; }); UIS.forEach(function (u) { u.render(); }); }
  // what the preview shows: what is equipped, or a locked/unequipped item being tried
  UI.prototype.view = function () { var p = Object.assign({}, pref); if (this.prev) p[PKEYS[this.prev.kind]] = this.prev.id; return norm(p); };
  function sw(kind, it, on, inner, extraCls, style) {
    var lk = it.lock && !unlocked(kind, it);
    return '<button type="button" class="sl-ev-sw' + (extraCls || "") + (lk ? " is-locked" : "") + '" data-' + (kind === "trail" ? "effect" : kind) + '="' + it.id + '" aria-pressed="' + on + '"' + (style ? ' style="' + style + '"' : "") +
      (lk ? ' aria-label="' + esc(it.name) + ' (locked: ' + esc(lockText(it.lock)) + ')" title="Locked: ' + esc(lockText(it.lock)) + '"' : "") + ">" + inner + (lk ? '<span class="sl-ev-swlock">' + ic("lock", 11) + "</span>" : "") + "</button>";
  }
  function styleSw(it, cur) { var p = Object.assign({}, pref, { style: it.id }); return sw("style", it, cur === it.id, '<span class="sl-ev-swic">' + iconSvg(norm(p), 26) + "</span><span>" + esc(it.name) + "</span>", " sl-ev-stsw"); }
  function colourSw(it, cur) {
    var h = it.hex;
    // the circle around each colour button is that colour (Eduardo)
    return sw("colour", it, cur === it.id, '<i style="background:' + h + '"></i><span>' + esc(it.name) + "</span>", " sl-ev-colsw", "--sw:" + h);
  }
  function listSw(kind, it, cur) { return sw(kind, it, cur === it.id, '<span class="sl-ev-fxdot sl-ev-fx-' + kind + "-" + it.id + '" aria-hidden="true"></span><span>' + esc(it.name) + "</span>"); }
  function std(list) { return list.filter(function (x) { return !x.season; }); }
  UI.prototype.pane = function () {
    var v = this.view(), t = this.tab, h = "";
    if (t === "styles") {
      if (presets.length) h += '<h3 class="sl-ev-h3">Your saved cursors</h3><div class="sl-ev-presets">' + presets.map(function (ps, i) {
        return '<span class="sl-ev-preset"><button type="button" class="sl-ev-sw" data-preset="' + i + '"><span class="sl-ev-swic">' + iconSvg(norm(ps.p), 24) + "</span><span>" + esc(ps.name) + '</span></button><button type="button" class="sl-ev-pdel" data-pdel="' + i + '" aria-label="Delete ' + esc(ps.name) + '">' + '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></span>';
      }).join("") + "</div>";
      h += '<h3 class="sl-ev-h3">Style</h3><div class="sl-ev-stylegrid" role="group" aria-label="Cursor style">' + std(STYLES).map(function (s) { return styleSw(s, v.style); }).join("") + "</div>";
      h += '<div class="sl-ev-snakepick"><h3 class="sl-ev-h3">My Snake <small>' + (pref.snake ? "Chosen: " + esc(snakeName(pref.snake)) : "Choose which snake your pointer becomes") + "</small></h3>" +
        '<input type="search" class="sl-ev-snakeq" placeholder="Find a snake, e.g. inland taipan" aria-label="Find a snake for your cursor" value="' + esc(this.q) + '"><div class="sl-ev-snakelist" role="group" aria-label="Snakes">' + this.snakes() + "</div></div>";
      h += '<h3 class="sl-ev-h3">Size</h3><div class="sl-ev-swatches" role="group" aria-label="Cursor size">' + [["small", "Small"], ["normal", "Normal"], ["large", "Large"]].map(function (s) { return '<button type="button" class="sl-ev-sw" data-size="' + s[0] + '" aria-pressed="' + (pref.size === s[0]) + '">' + s[1] + "</button>"; }).join("") + "</div>";
    } else if (t === "colours") {
      h += '<h3 class="sl-ev-h3">Colour</h3><div class="sl-ev-swatches" role="group" aria-label="Cursor colour">' + std(COLOURS).map(function (c) { return colourSw(c, v.colour); }).join("") +
        '<label class="sl-ev-sw sl-ev-colsw sl-ev-custom" style="--sw:' + pref.custom + '"><i style="background:' + pref.custom + '"></i><span>Custom</span><input type="color" data-custom value="' + pref.custom + '" aria-label="Pick your own colour"></label></div>';
      h += '<h3 class="sl-ev-h3">Colour mode</h3><div class="sl-ev-fxlist" role="group" aria-label="Colour mode">' + MODES.map(function (m) { return listSw("mode", m, v.mode); }).join("") + "</div>";
    } else if (t === "trails") {
      h += '<h3 class="sl-ev-h3">Trail</h3><div class="sl-ev-fxlist" role="group" aria-label="Cursor trail">' + std(TRAILS).map(function (f) { return listSw("trail", f, v.effect); }).join("") + "</div>";
      h += this.sliders(["len", "intensity", "fade", "psize"]);
    } else if (t === "clicks") {
      h += '<h3 class="sl-ev-h3">Click effect</h3><div class="sl-ev-fxlist" role="group" aria-label="Click effect">' + std(CLICKS).map(function (f) { return listSw("click", f, v.click); }).join("") + "</div>" + this.sliders(["speed"]);
    } else if (t === "hover") {
      h += '<h3 class="sl-ev-h3">On links and buttons</h3><div class="sl-ev-fxlist" role="group" aria-label="Hover effect">' + HOVERS.map(function (f) { return listSw("hover", f, v.hover); }).join("") + "</div>" +
        '<p class="sl-ev-muted">Text boxes, the map while you drag it, 3D models while you turn them and anything that can’t be used keep their usual pointers.</p>';
    } else if (t === "seasonal") {
      var any = false;
      SEASONS.forEach(function (s) {
        var all = [["style", STYLES], ["trail", TRAILS], ["click", CLICKS], ["colour", COLOURS]].map(function (k) { return [k[0], k[1].filter(function (x) { return x.season === s[0] && visible(x); })]; }).filter(function (k) { return k[1].length; });
        if (!all.length) return; any = true;
        h += '<h3 class="sl-ev-h3">' + esc(s[1]) + "</h3>" + all.map(function (k) {
          return '<div class="' + (k[0] === "style" ? "sl-ev-stylegrid" : k[0] === "colour" ? "sl-ev-swatches" : "sl-ev-fxlist") + '" role="group" aria-label="' + esc(s[1] + " " + k[0]) + '">' + k[1].map(function (it) {
            return k[0] === "style" ? styleSw(it, v.style) : k[0] === "colour" ? colourSw(it, v.colour) : listSw(k[0], it, k[0] === "trail" ? v.effect : v.click);
          }).join("") + "</div>";
        }).join("");
      });
      if (!any) h += '<p class="sl-ev-muted">Seasonal cursors arrive with SnakeList’s events.</p>';
      h += '<p class="sl-ev-muted">Seasonal cursors are earned with event achievements and Advent doors. Once earned, they are yours for good.</p>';
    } else if (t === "advanced") {
      h += '<details class="sl-ev-adv" open><summary>Size and effects</summary><div class="sl-ev-swatches" role="group" aria-label="Cursor size" style="margin:8px 0">' + [["small", "Small"], ["normal", "Normal"], ["large", "Large"]].map(function (s) { return '<button type="button" class="sl-ev-sw" data-size="' + s[0] + '" aria-pressed="' + (pref.size === s[0]) + '">' + s[1] + "</button>"; }).join("") + "</div>" +
        this.sliders(["len", "intensity", "psize", "speed", "fade"]) + "</details>" +
        '<details class="sl-ev-adv" open><summary>Switches</summary>' +
        [["clickOn", "Click effects"], ["hoverOn", "Hover effects"], ["reduced", "Reduced effects (calmer, shorter)"]].map(function (s) { return '<label class="sl-ev-tog"><input type="checkbox" data-tog="' + s[0] + '"' + (pref[s[0]] ? " checked" : "") + "><span>" + s[1] + "</span></label>"; }).join("") + "</details>" +
        '<details class="sl-ev-adv"><summary>Custom colour</summary><label class="sl-ev-tog"><input type="color" data-custom value="' + pref.custom + '"><span>Your own colour (chosen as “Custom” in Colours)</span></label></details>';
    }
    return h;
  };
  var SL = { len: ["Trail length", 10, 100], intensity: ["Intensity", 10, 100], fade: ["Fade speed", 10, 100], psize: ["Particle size", 50, 150], speed: ["Effect speed", 50, 150] };
  UI.prototype.sliders = function (keys) {
    return '<div class="sl-ev-sliders">' + keys.map(function (k) { var s = SL[k]; return '<label class="sl-ev-slider"><span>' + s[0] + '</span><input type="range" min="' + s[1] + '" max="' + s[2] + '" step="5" value="' + pref[k] + '" data-range="' + k + '"></label>'; }).join("") + "</div>";
  };
  UI.prototype.snakes = function () {
    var q = this.q.trim().toLowerCase(), out = [];
    if (!q) out = SNAKE_SUGGEST.filter(function (id) { return card(id); }).map(function (id) { return [id, snakeName(id)]; });
    else { var cs = D.querySelectorAll("#grid .card"); for (var i = 0; i < cs.length && out.length < 8; i++) { var n = cs[i].getAttribute("data-name") || "", id = cs[i].getAttribute("data-id") || ""; if (n.toLowerCase().indexOf(q) >= 0 || id.replace(/-/g, " ").indexOf(q) >= 0) out.push([id, n]); } }
    if (!out.length) return '<p class="sl-ev-muted">No snake found.</p>';
    return out.map(function (s) {
      var p = norm(Object.assign({}, pref, { style: "snake", snake: s[0] }));
      return '<button type="button" class="sl-ev-sw sl-ev-stsw" data-snake="' + esc(s[0]) + '" aria-pressed="' + (pref.style === "snake" && pref.snake === s[0]) + '"><span class="sl-ev-swic">' + iconSvg(p, 26) + "</span><span>" + esc(s[1]) + "</span></button>";
    }).join("");
  };
  UI.prototype.html = function () {
    var sup = supported(), sub = EV.isSubscriber(), self = this, v = this.view();
    var lkItem = this.prev ? find(this.prev.kind, this.prev.id) : null, lk = lkItem && lkItem.lock && !unlocked(this.prev.kind, lkItem);
    return (EV.testMode() ? EV.testBadge() : "") +
      (!sup ? '<div class="sl-ev-note">Cursor customization works on computers with a mouse or trackpad. This device uses touch, so the normal pointer stays.</div>' : "") +
      (sup && !sub ? '<div class="sl-ev-note">' + ic("crown", 14) + ' <b>A subscriber benefit.</b> You can try every style, colour and effect in the preview below; they show across SnakeList once you subscribe. Cursors you <b>earn</b> with achievements work for everyone. <button type="button" class="sl-ev-btn" data-act="sub" style="min-height:28px;padding:3px 10px;margin-top:6px">See subscription</button></div>' : "") +
      '<div class="sl-ev-ctabs" role="tablist" aria-label="Cursor settings">' + TABS.map(function (t) { return '<button type="button" role="tab" data-ctab="' + t[0] + '" aria-selected="' + (self.tab === t[0]) + '">' + t[1] + "</button>"; }).join("") + "</div>" +
      '<label class="sl-ev-ctabsel"><span class="sr-only">Cursor settings section</span><select data-ctabsel aria-label="Cursor settings section">' + TABS.map(function (t) { return '<option value="' + t[0] + '"' + (self.tab === t[0] ? " selected" : "") + ">" + t[1] + "</option>"; }).join("") + "</select></label>" +
      (this.prev ? '<div class="sl-ev-note sl-ev-prevnote">' + ic(lk ? "lock" : "spark", 14) + " Previewing <b>" + esc(lkItem ? lkItem.name : "") + "</b>" + (lk ? " - locked. " + esc(lockText(lkItem.lock)) + "." : ".") +
        ' <span class="sl-ev-row" style="margin:6px 0 0"><button type="button" class="sl-ev-btn pri" data-act="equip"' + (lk ? " disabled" : "") + ">Equip</button>" +
        '<button type="button" class="sl-ev-btn" data-act="unprev">Reset preview</button></span></div>' : "") +
      '<div class="sl-ev-cpane" role="tabpanel">' + this.pane() + "</div>" +
      '<div class="sl-ev-curprev" data-prev><div class="sl-ev-pv-half sl-ev-pv-dark"><button type="button" class="sl-ev-pvbtn" tabindex="-1">Button</button><a href="#" class="sl-ev-pvlink" tabindex="-1" onclick="return false">A link</a></div>' +
        '<div class="sl-ev-pv-half sl-ev-pv-light"><input type="text" class="sl-ev-pvin" tabindex="-1" aria-label="Sample text field" placeholder="Text field"><span class="sl-ev-pvtarget" aria-hidden="true"></span></div>' +
        '<span class="sl-ev-pvtip">' + (sup ? "Move your pointer here to preview, and click to see the click effect" : "Preview needs a mouse or trackpad") + "</span><canvas></canvas></div>" +
      '<div class="sl-ev-row"><button type="button" class="sl-ev-btn" data-act="reset">Reset to the normal pointer</button></div>' +
      '<div class="sl-ev-row"><button type="button" class="sl-ev-btn" data-act="save">' + ic("check", 15) + " Save</button></div>" +
      (this.saving ? '<div class="sl-ev-savebox"><label>Name this cursor <input type="text" maxlength="32" data-pname placeholder="e.g. Inland taipan + green glow" value="' + esc(this.suggestName()) + '"></label><button type="button" class="sl-ev-btn pri" data-act="psave">Save to my cursors</button><button type="button" class="sl-ev-btn" data-act="pcancel">Cancel</button></div>' : "") +
      '<p class="sl-ev-muted">' + (sub ? (sup ? "Changes are saved straight away" + (EV.user() ? " to your account." : " on this device.") : "") : "Your choice is remembered.") + " Save keeps the whole look (style, colour, trail, click and hover) as a named cursor you can pick again. If a subscription ends, the normal pointer comes back and your choices are kept.</p>" +
      (EV.reducedMotion() ? '<p class="sl-ev-muted">Your device asks for reduced motion, so moving trails are shown as a still glow and click effects as a quick fade.</p>' : "");
  };
  UI.prototype.suggestName = function () {
    var v = pref, st = v.style === "snake" && v.snake ? snakeName(v.snake) : (find("style", v.style) || {}).name, tr = v.effect !== "none" ? " + " + (find("trail", v.effect) || {}).name : "";
    return ((st || "Cursor") + tr).slice(0, 32);
  };
  UI.prototype.render = function () {
    if (!this.root.isConnected) return;
    var y = this.root.closest(".sl-ev-body, .sl-pbody"), sy = y ? y.scrollTop : 0, f = D.activeElement, fq = f && f.classList && f.classList.contains("sl-ev-snakeq");
    if (this.PF) this.PF.stop();
    this.root.innerHTML = this.html();
    if (y) y.scrollTop = sy;
    var box = this.root.querySelector("[data-prev]"), cv = box.querySelector("canvas"), v = this.view();
    this.PF = new Fx(cv, function () { return box.getBoundingClientRect(); }); this.PF.set(v);
    // the preview area shows the pointer, its hover look on the sample button and link, and the system cursor in the text field
    var sc = this.root.querySelector("style.sl-ev-pvcss") || D.createElement("style"); sc.className = "sl-ev-pvcss";
    var id = this.root.id || (this.root.id = "sl-ev-cui-" + UIS.indexOf(this));
    sc.textContent = supported() ? pageCss(v, "#" + id + " .sl-ev-curprev").replace(/\.card/g, ".sl-ev-pvtarget") : "";
    this.root.appendChild(sc);
    if (fq) { var q = this.root.querySelector(".sl-ev-snakeq"); if (q) { q.focus({ preventScroll: true }); q.setSelectionRange(q.value.length, q.value.length); } }
  };
  UI.prototype.wire = function () {
    var self = this, R = this.root;
    R.addEventListener("pointermove", function (e) { if (e.pointerType === "touch" || !self.PF || !e.target.closest("[data-prev]")) return; var r = R.querySelector("[data-prev]").getBoundingClientRect(); self.PF.move(e.clientX - r.left, e.clientY - r.top); });
    R.addEventListener("pointerdown", function (e) { if (e.pointerType === "touch" || !self.PF || !e.target.closest("[data-prev]")) return; var r = R.querySelector("[data-prev]").getBoundingClientRect(); self.PF.click(e.clientX - r.left, e.clientY - r.top); });
    R.addEventListener("click", function (e) {
      var t = e.target.closest("button"); if (!t || !R.contains(t)) return;
      var kinds = ["style", "colour", "effect", "click", "hover", "mode"], k, kind = null, id = null;
      for (var i = 0; i < kinds.length; i++) { k = kinds[i]; if (t.hasAttribute("data-" + k)) { kind = k === "effect" ? "trail" : k; id = t.getAttribute("data-" + k); break; } }
      if (kind) { self.pick(kind, id); return; }
      if (t.hasAttribute("data-ctab")) { self.tab = t.getAttribute("data-ctab"); self.render(); var nb = R.querySelector('[data-ctab="' + self.tab + '"]'); if (nb) nb.focus({ preventScroll: true }); return; }
      if (t.hasAttribute("data-size")) { pref.size = t.getAttribute("data-size"); save(); repaintAll(); return; }
      if (t.hasAttribute("data-snake")) { pref.snake = t.getAttribute("data-snake"); self.pick("style", "snake"); return; }
      if (t.hasAttribute("data-preset")) { var ps = presets[+t.getAttribute("data-preset")]; if (ps) { var np = norm(ps.p); if (EV.isSubscriber() || allEarned(np) || !supported()) { pref = np; self.prev = null; save(); } else { pref = np; save(); } repaintAll(); } return; }
      if (t.hasAttribute("data-pdel")) { presets.splice(+t.getAttribute("data-pdel"), 1); EV.ls.set(PKEY, presets); saveAccount(); repaintAll(); return; }
      var a = t.getAttribute("data-act");
      if (a === "reset") { pref = norm({}); self.prev = null; save(); repaintAll(); }
      else if (a === "sub") { if (EV.subscribe) EV.subscribe.open(); }
      else if (a === "save") { self.saving = true; self.render(); var n = R.querySelector("[data-pname]"); if (n) { n.focus(); n.select(); } }
      else if (a === "pcancel") { self.saving = false; self.render(); }
      else if (a === "psave") {
        var nm = (R.querySelector("[data-pname]").value || "").trim().slice(0, 32) || self.suggestName();
        presets = presets.filter(function (x) { return x.name !== nm; }); presets.unshift({ name: nm, p: Object.assign({}, pref) }); presets = presets.slice(0, MAXP);
        EV.ls.set(PKEY, presets); saveAccount(); self.saving = false; self.tab = "styles"; repaintAll();
        EV.toast(ic("check", 15) + " Saved “" + esc(nm) + "” to your cursors.");
      }
      else if (a === "equip" && self.prev) { var it = find(self.prev.kind, self.prev.id); if (it && unlocked(self.prev.kind, it)) { pref[PKEYS[self.prev.kind]] = self.prev.id; self.prev = null; save(); repaintAll(); } }
      else if (a === "unprev") { self.prev = null; self.render(); }
    });
    R.addEventListener("change", function (e) {
      var t = e.target;
      if (t.hasAttribute("data-ctabsel")) { self.tab = t.value; self.render(); var s = R.querySelector("[data-ctabsel]"); if (s) s.focus(); }
      else if (t.hasAttribute("data-tog")) { pref[t.getAttribute("data-tog")] = t.checked; save(); repaintAll(); }
      else if (t.hasAttribute("data-range")) { pref[t.getAttribute("data-range")] = +t.value; save(); repaintAll(); }
      else if (t.hasAttribute("data-custom")) { pref.custom = t.value; pref.colour = "custom"; save(); repaintAll(); }
    });
    R.addEventListener("input", function (e) {
      var t = e.target;
      if (t.classList.contains("sl-ev-snakeq")) { self.q = t.value; var l = R.querySelector(".sl-ev-snakelist"); if (l) l.innerHTML = self.snakes(); }
      else if (t.hasAttribute("data-range") && self.PF) { var p = self.view(); p[t.getAttribute("data-range")] = +t.value; self.PF.set(p); }
    });
    R.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.hasAttribute && e.target.hasAttribute("data-pname")) { e.preventDefault(); var b = R.querySelector('[data-act="psave"]'); if (b) b.click(); } });
  };
  // a click on an item: equip it when it's available, otherwise preview it (locked: only a preview, never equipped)
  UI.prototype.pick = function (kind, id) {
    var it = find(kind, id); if (!it) return;
    if (it.lock && !unlocked(kind, it)) { this.prev = { kind: kind, id: id }; this.render(); return; }
    this.prev = null; pref[PKEYS[kind]] = id; save(); repaintAll();
  };

  /* ================= where it lives ================= */
  var P = null;
  function open(tab) {
    P = EV.panel("sl-ev-cur", ic("cursor", 18) + " Cursor", '<div class="sl-ev-cui"></div>', { onClose: function () { P = null; repaintAll(); } });
    var u = new UI(P.querySelector(".sl-ev-cui"), true);
    if (tab) { u.tab = tab; u.render(); }
    return P;
  }
  // from an achievement's or unlock message's "Preview": open the cursor settings on that item, previewing it
  function showItem(key) {
    var m = /^(style|trail|click|colour):(.+)$/.exec(key || ""); if (!m) { open(); return; }
    var kind = m[1], it = find(kind, m[2]); open(it && it.season ? "seasonal" : { style: "styles", trail: "trails", click: "clicks", colour: "colours" }[kind]);
    var u = UIS[UIS.length - 1]; if (it) { u.prev = { kind: kind, id: it.id }; u.render(); }
  }
  // Settings -> Appearance -> Cursor: the whole panel sits inside Settings (a section with its own tabs)
  function mountSettings(container) {
    if (!container || container.querySelector(".sl-ev-cur-sec")) return;
    var sec = D.createElement("section"); sec.className = "sl-sgrp sl-ev-cur-sec"; sec.setAttribute("data-section", "cursor"); sec.setAttribute("data-group", "appearance");
    sec.innerHTML = '<h3>' + ic("cursor", 15) + ' Cursor <span class="sl-ev-prem" style="margin-left:auto">Subscribers</span></h3><div class="sl-ev-cui" id="sl-ev-cur-set"></div>';
    var look = container.querySelector('[data-section="appearance"], [data-section="look"]') || container.querySelector(".sl-sgrp");
    if (look && look.parentNode === container) container.insertBefore(sec, look.nextSibling); else container.appendChild(sec);
    new UI(sec.querySelector(".sl-ev-cui"), false);
  }
  var autoSettings = true;
  function lookForSettings() {
    if (!autoSettings) return;
    // only the Settings panel's own content - never the header's gear button (which carries data-sl-settings too)
    var inner = D.querySelector("#sl-settings .sl-pbody, #sl-settings [data-sl-settings-body]");
    if (inner && inner.tagName !== "BUTTON" && !inner.closest("button")) mountSettings(inner);
  }
  D.addEventListener("sl-settings-open", function () { setTimeout(lookForSettings, 0); setTimeout(repaintAll, 30); });
  setInterval(function () { if (!D.hidden) lookForSettings(); }, 1500);
  // unlocks: when an achievement is earned, an Advent door opens, or every so often
  D.addEventListener("sl-ach-earned", function () { setTimeout(checkUnlocks, 200); });
  EV.on("seasonal-achievement", function () { setTimeout(checkUnlocks, 200); });
  EV.on("advent-claim", function () { setTimeout(checkUnlocks, 1800); });
  EV.on("advent", function () { setTimeout(checkUnlocks, 300); });
  setInterval(function () { if (!D.hidden) checkUnlocks(); }, 20000);
  setTimeout(checkUnlocks, 2500);
  if (D.body) apply(); else D.addEventListener("DOMContentLoaded", function () { apply(); });
  function nameOf(key) { var m = /^(style|trail|click|colour):(.+)$/.exec(key || ""), it = m && find(m[1], m[2]); return it ? it.name + " " + { style: "cursor", trail: "cursor trail", click: "click effect", colour: "cursor colour" }[m[1]] : ""; }
  EV.cursor = { open: open, showItem: showItem, apply: apply, pref: function () { return Object.assign({}, pref); }, presets: function () { return presets.slice(); },
                active: active, supported: supported, nameOf: nameOf, unlocked: function (key) { var m = /^(style|trail|click|colour):(.+)$/.exec(key || ""), it = m && find(m[1], m[2]); return !!(it && unlocked(m[1], it)); },
                catalogue: KINDS, check: checkUnlocks, css: function (p, v) { return cursorCss(norm(p || pref), v || ""); },
                mountSettings: function (c) { autoSettings = false; mountSettings(c); }, _fx: function () { return G; } };
})();
