// SnakeList "Explore in 3D": a procedural, species-specific snake model in a small habitat scene.
// Loaded on demand by sp.js (species pages) only when the viewer is opened. Everything is built in
// the browser from a per-species profile (species/3d/models.json, made from data/snake-models.json):
// spine and pose, a swept body with a real taper and a species head, eyes, a scale normal map and a
// pattern texture generated from the profile's parameters. Units are metres.
// three.js (species/3d/three.module.min.js, vendored) is loaded by the page next to this module and
// handed in with useThree(), so a failed download can be retried under a fresh URL
let THREE = null;
// v4.80: the realistic scenery (trees, 3D leaf litter, rocks, sky) lives in nature.js
import * as NATURE from './nature.js?r=630'; // (a new name whenever these change, so no browser keeps an old copy)
import * as EXTRA from './extras.js?r=635'; // v4.81: Slither, See it eat, See eye shield, Anatomy, photo/map beside the model
import * as DAYNIGHT from './daynight.js?r=614'; // v6.14: Day / Night (and the plugin hooks "See the spot", spot.js, uses)
export function useThree(t) { THREE = t; }
// v6.13: Array .at() for iPads on iPadOS 15.0-15.3 (it came in 15.4); the species pages load this without SnakeList's own copy
if (!Array.prototype.at) Object.defineProperty(Array.prototype, 'at', { value(i) { const n = this.length >>> 0; i = Math.trunc(i) || 0; if (i < 0) i += n; return i < 0 || i >= n ? undefined : this[i]; }, writable: true, configurable: true });
// v5.93: the habitats each snake can be shown in (tools/habitat_looks.py: the first is shown first; snakes with only one are
// not listed). Loaded with this module - it waits for it up to 3 s, so the first scene is already the right one (if it comes
// later, the Habitats button is added then)
const HAB_P = typeof fetch === 'function' ? fetch(new URL('habitats.json?r=587', import.meta.url).href).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null);
let HAB_LOOKS = await Promise.race([HAB_P, new Promise((res) => setTimeout(() => res(null), 3000))]);
HAB_P.then((d) => { HAB_LOOKS = d; });
const habPick = (d, id) => { const l = d && d.sp && d.sp[id]; return Array.isArray(l) && l.length > 1 ? l : null; };
export function habitatsOf(id) { return habPick(HAB_LOOKS, id); }

const TAU = Math.PI * 2;
// v6.35: a touch-first device (phone, tablet - also a big iPad, which got the keyboard-and-mouse instructions): the
// instructions speak of fingers, not W A S D and right-drag
export function touchFirst() {
  try {
    const mm = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
    return window.innerWidth < 520 || (mm('(pointer: coarse)') && !mm('(any-pointer: fine)')) || ((navigator.maxTouchPoints || 0) > 0 && !mm('(hover: hover)'));
  } catch (e) { return false; }
}
// load-time profiling (tests only): window.__slPerf = { step: ms }
const perfT = (name, t0) => { if (typeof window !== 'undefined' && window.SL_3D_TEST) { const p = window.__slPerf || (window.__slPerf = {}); p[name] = Math.round((p[name] || 0) + performance.now() - t0); } };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- random numbers and noise ----------
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function strSeed(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hash3(x, y, z, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
function hash1(n, s) { return hash3(n | 0, (n * 0.5) | 0, 7, s); }
function vnoise(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const a = hash3(xi, yi, zi, s), b = hash3(xi + 1, yi, zi, s), c = hash3(xi, yi + 1, zi, s), d = hash3(xi + 1, yi + 1, zi, s);
  const e = hash3(xi, yi, zi + 1, s), f = hash3(xi + 1, yi, zi + 1, s), g = hash3(xi, yi + 1, zi + 1, s), h = hash3(xi + 1, yi + 1, zi + 1, s);
  const x1 = a + (b - a) * fx, x2 = c + (d - c) * fx, x3 = e + (f - e) * fx, x4 = g + (h - g) * fx;
  const y1 = x1 + (x2 - x1) * fy, y2 = x3 + (x4 - x3) * fy;
  return y1 + (y2 - y1) * fz;
}
function fbm(x, y, z, s, oct) { let v = 0, a = 0.5, n = 0; for (let i = 0; i < oct; i++) { v += a * vnoise(x, y, z, s + i * 31); n += a; x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; } return v / n; }
// tileable 2D noise (period p cells in both directions), for ground and water textures
function tnoise(x, y, p, s) {
  const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const m = (v) => ((v % p) + p) % p, h = (i, j) => hash3(m(i), m(j), 3, s);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}
function tfbm(x, y, p, s, oct) { let v = 0, a = 0.5, n = 0; for (let i = 0; i < oct; i++) { v += a * tnoise(x, y, p, s + i * 17); n += a; x *= 2; y *= 2; p *= 2; a *= 0.5; } return v / n; }

function hex(c) { const v = parseInt(String(c || '#888').slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

// monotone cubic interpolation through [x, y] points (no overshoot, so the taper never bulges)
function pchip(pts) {
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-9, xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (d[i - 1] + d[i])) / ((2 * d[i] + d[i - 1]) / d[i - 1] + (d[i] + 2 * d[i - 1]) / d[i]);
  return (x) => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// ---------- body plans: defaults that each species profile overrides ----------
const PLANS = {
  viper:    { body: { ld: 15, neck: 0.42, peak: 0.45, vent: 0.62, tail: 0.10, xs: 1.32, bf: 0.72 }, head: { shape: 'tri', len: 0.074, chin: 0.55, tipR: 0.07, snoutH: 0.7, w: 1.05, h: 0.58, snout: 0.5, jaw: 0.78, eyeX: 0.27, eyeA: 70, taper: 0.3, eye: 0.13, pupil: 'slit', brow: 0.13, canthus: 3.0 }, scales: { rows: 31, keel: 0.85, gloss: 0.14, aV: 0.73 }, pose: { kind: 'stack', pitch: 1.0, lead: 0.3, lift: 0.25, tight: 0.58 } }, // (v5.62: an ambush pile, not a flat spiral)
  pitviper: { body: { ld: 22, neck: 0.48, peak: 0.45, vent: 0.62, tail: 0.085, xs: 1.25, bf: 0.74 }, head: { shape: 'tri', len: 0.06, chin: 0.55, tipR: 0.07, snoutH: 0.7, w: 1.0, h: 0.6, snout: 0.5, jaw: 0.8, eyeX: 0.3, eyeA: 70, taper: 0.3, eye: 0.12, pupil: 'slit', brow: 0.13, canthus: 3.0, pits: 'loreal' }, scales: { rows: 27, keel: 0.85, gloss: 0.14, aV: 0.73 }, pose: { kind: 'stack', pitch: 1.0, lead: 0.32, lift: 0.25, tight: 0.6 } },
  python:   { body: { ld: 30, neck: 0.55, peak: 0.5, vent: 0.62, tail: 0.12, xs: 1.18, bf: 0.76, ridge: 0.025 }, head: { len: 0.04, chin: 0.62, tipR: 0.13, snoutH: 0.7, w: 0.68, h: 0.6, snout: 0.62, jaw: 0.78, eyeX: 0.3, eyeA: 62, eye: 0.13, pupil: 'slit', brow: 0.03, canthus: 3.0, pits: 'labial' }, scales: { rows: 71, keel: 0, gloss: 0.5, aV: 0.77 }, pose: { kind: 'stack', pitch: 1.05, lead: 0.3, lift: 0.2, tight: 0.62 } }, // (v5.62: a heavy resting pile)
  colubrid: { body: { ld: 36, neck: 0.78, peak: 0.42, vent: 0.62, tail: 0.24, xs: 1.08, bf: 0.8, ridge: 0.02 }, head: { len: 0.035, w: 1.05, h: 0.64, snout: 0.57, chin: 0.66, jaw: 0.72, eyeX: 0.3, eyeA: 60, eye: 0.16, pupil: 'round', brow: 0.04, canthus: 3.1 }, scales: { rows: 19, keel: 0, gloss: 0.5, aV: 0.73 }, pose: { kind: 'wave' } },
  elapid:   { body: { ld: 45, neck: 0.85, peak: 0.45, vent: 0.62, tail: 0.18, xs: 1.05, bf: 0.8, ridge: 0.015 }, head: { len: 0.032, w: 0.95, h: 0.6, snout: 0.56, chin: 0.66, jaw: 0.75, eyeX: 0.3, eyeA: 60, eye: 0.15, pupil: 'round', brow: 0.035, canthus: 3.1 }, scales: { rows: 17, keel: 0, gloss: 0.55, aV: 0.73 }, pose: { kind: 'wave' } },
  blind:    { body: { ld: 42, neck: 1.0, peak: 0.5, vent: 0.97, tail: 0.022, xs: 1.0, bf: 0.9, blunt: true }, head: { shape: 'blunt', len: 0.022, w: 0.98, h: 0.8, snout: 0.9, jaw: 0.6, eyeX: 0.32, eyeA: 55, eye: 0.16, pupil: 'none', brow: 0, canthus: 2.0 }, scales: { rows: 20, keel: 0, gloss: 0.85, aV: 0.97, kind: 'cycloid' }, pose: { kind: 'wave' } },
  sea:      { body: { ld: 30, neck: 0.62, peak: 0.55, vent: 0.75, tail: 0.11, xs: 0.72, bf: 0.85, paddle: true }, head: { len: 0.045, w: 0.75, h: 0.72, snout: 0.6, jaw: 0.75, eyeX: 0.3, eyeA: 52, eye: 0.13, pupil: 'round', brow: 0, canthus: 2.2, nostrilA: 32 }, scales: { rows: 47, keel: 0, gloss: 0.35, aV: 0.95, kind: 'juxta' }, pose: { kind: 'wave' } },
};
function merge(a, b) { const o = Object.assign({}, a); for (const k in b) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a && typeof a[k] === 'object' ? merge(a[k], b[k]) : b[k]; return o; }
// v5.73: head proportions by group (field-guide measurements and photos): lw head length over head width, hb the head's
// width against the thickest part of the body [min, max], hn head width over neck width, len head length over total length
// [min, max]. Colubrid heads were as wide as long and wider than the body (lw 1.1, hb 1.1): a bulbous, cobra-like blob.
// Natricines and racers have a long, narrow head barely wider than the neck; vipers a broad triangle on a thin neck;
// cobras a head about as wide as the neck, mambas a long coffin-shaped one; blind snakes no distinct head at all.
const HEAD_FORM = {
  natricine: { lw: 1.75, hb: [0.62, 0.85], hn: 1.25, len: [0.028, 0.044], h: 0.76, hl: 0.44, cheek: 0.05, lor: 0.022, crown: 0.05, smile: 0.06 },
  colubrine: { lw: 1.7, hb: [0.6, 0.86], hn: 1.2, len: [0.026, 0.044], h: 0.74, hl: 0.43, cheek: 0.045, lor: 0.02, crown: 0.045, smile: 0.05 },
  broad: { lw: 1.42, hb: [0.68, 1.15], hn: 1.5, len: [0.026, 0.05], hl: 0.45, cheek: 0.08, lor: 0.018, crown: 0.06, smile: 0.05 }, // cat-eyed and tree snakes, snail-eaters, hognoses: a broad head on a thin neck
  vine: { lw: 2.0, hb: [0.6, 1.7], hn: 1.5, len: [0.03, 0.055], hl: 0.34, cheek: 0.05, lor: 0.035, crown: 0.03, smile: 0.06 }, // (a long head on a thin neck)
  burrow: { lw: 1.35, hb: [0.6, 0.9], hn: 1.0, len: [0.02, 0.04], hl: 0.5, cheek: 0, lor: 0, crown: 0.02, smile: 0.015 },
  elapid: { lw: 1.65, hb: [0.6, 0.9], hn: 1.1, len: [0.025, 0.04], h: 0.7, hl: 0.44, cheek: 0.055, lor: 0.014, crown: 0.05, smile: 0.04 },
  cobra: { lw: 1.55, hb: [0.65, 0.95], hn: 1.05, len: [0.025, 0.04], h: 0.68, hl: 0.42, cheek: 0.04, lor: 0.012, crown: 0.04, smile: 0.03 },
  mamba: { lw: 2.05, hb: [0.6, 0.88], hn: 1.15, len: [0.025, 0.04], h: 0.72, hl: 0.4, cheek: 0.035, lor: 0.03, crown: 0.035, smile: 0.08 },
  deathadder: { lw: 1.2, hb: [0.85, 1.25], hn: 1.75, len: [0.04, 0.07], hl: 0.4, cheek: 0.07, lor: 0.02, crown: 0.03, smile: 0.03 },
  sea: { lw: 1.7, hb: [0.5, 0.8], hn: 1.05, len: [0.025, 0.05], hl: 0.42, cheek: 0.02, lor: 0, crown: 0.03, smile: 0.02 },
  viper: { lw: 1.18, hb: [0.62, 1.2], hn: 2.0, len: [0.04, 0.06], hl: 0.4, lor: 0.03, crown: 0.02, smile: 0.05 }, // (v5.93: broader - from above the heads read as long narrow shields)
  bitis: { lw: 1.05, hb: [0.6, 1.25], hn: 2.1, len: [0.045, 0.075], hl: 0.36, lor: 0.025, crown: 0.015, smile: 0.04 },
  pitviper: { lw: 1.18, hb: [0.7, 1.2], hn: 1.9, len: [0.04, 0.062], hl: 0.42, lor: 0.04, crown: 0.02, smile: 0.05 },
  python: { lw: 1.55, hb: [0.5, 0.8], hn: 1.45, len: [0.03, 0.055], hl: 0.42, cheek: 0.07, lor: 0.03, crown: 0.05, smile: 0.035 },
  boa: { lw: 1.65, hb: [0.5, 0.8], hn: 1.4, len: [0.03, 0.055], hl: 0.44, cheek: 0.07, lor: 0.028, crown: 0.05, smile: 0.025 },
  sandboa: { lw: 1.25, hb: [0.6, 0.95], hn: 1.05, len: [0.025, 0.04], hl: 0.48, cheek: 0.02, lor: 0, crown: 0.03, smile: 0.0 },
};
// v6.26 (heads, species by species): hand-set head shapes for the best-known species, from field-guide proportions; about 40
// of them were rendered from the side, the front and above and checked against their SnakeList photos. Keys: hl head depth (crown to chin) over head length, as measured on the built
// head; sn snout width at the nostrils over head width; sh snout height over head height; eye eye diameter over head length;
// ex the eye's place along the head (0 snout tip, 1 back of the head); ea how far round from the top the eye sits (degrees);
// ck cheeks (jaw muscles); lor the loreal hollow; cr the crown's dome; sm the mouth line's curve; br the brow over the eye;
// up an upturned snout tip; lips the lip colouring ('none': the coral snakes' black snout - their red belly colour was
// painted on the lip scales, so the snout read red). Anything not given keeps the group's value.
const HEAD_SET_SRC = `
oxyuranus-microlepidotus sm .03 cr .06
oxyuranus-scutellatus hl .40 sn .52 eye .16 ex .31 lor .025 sm .05
opheodrys-vernalis eye .2 sm .04
opheodrys-aestivus hl .36 sn .5 eye .22 ex .32 sm .06
pseudonaja-textilis hl .42 sn .55 eye .15 ck .035 sm .04
notechis-scutatus hl .47 sn .66 sh .8 eye .12 ck .07 cr .06
pseudechis-porphyriacus hl .40 sn .62 eye .12 ck .045 sm .035
pseudechis-australis hl .45 sn .68 eye .11 ck .08
acanthophis-antarcticus hl .40 sn .6 eye .1 ex .33 br .1
dendroaspis-polylepis hl .42 sn .62 sh .75 eye .14 ex .32 lor .035 cr .04 sm .09
dendroaspis-angusticeps hl .38 sn .6 eye .15 sm .06
dendroaspis-viridis hl .38 sn .6 eye .15 sm .06
dendroaspis-jamesoni hl .38 sn .6 eye .15 sm .06
naja-naja hl .40 sn .62 sh .72 eye .13 ck .05 cr .035 sm .025
naja-kaouthia hl .40 sn .64 sh .72 eye .13 ck .05 cr .035 sm .025
naja-haje hl .42 sn .66 eye .12 ck .06
naja-nivea hl .42 sn .6 eye .14
naja-nigricollis hl .42 sn .64 eye .13 ck .05
naja-mossambica hl .42 sn .64 eye .13 ck .05
naja-atra hl .40 sn .62 sh .72 eye .13 ck .05 sm .025
naja-oxiana hl .40 sn .62 eye .13 ck .05
ophiophagus-hannah hl .42 sn .62 eye .12 ck .06 cr .06 sm .035
hemachatus-haemachatus hl .44 eye .12
bungarus-fasciatus hl .42 sn .68 eye .09
bungarus-caeruleus hl .42 sn .62 eye .1
bungarus-multicinctus hl .42 sn .64 eye .09
micrurus-fulvius hl .45 eye .1 ck .02 sm .015 lips none
micrurus-tener hl .45 sn .72 eye .1 ck .02 sm .015 lips none
micruroides-euryxanthus hl .45 sn .72 eye .1 ck .02 sm .015 lips none
laticauda-colubrina hl .44 eye .08
hydrophis-platurus hl .36 sn .5 eye .07 sm .01
aipysurus-laevis hl .42 eye .08
crotalus-atrox hl .40 sn .52 br .15
crotalus-adamanteus hl .40 sn .55 br .15
crotalus-horridus hl .38 sn .55
crotalus-cerastes hl .36 sn .6 ex .33 br .22
crotalus-viridis hl .40 sn .52
crotalus-oreganus hl .40 sn .52
crotalus-scutulatus hl .40 sn .52
crotalus-durissus hl .42 sn .52
sistrurus-miliarius hl .42 eye .12
agkistrodon-piscivorus hl .44 sn .58 sh .8 eye .1 br .15
agkistrodon-contortrix hl .42 eye .11
bothrops-asper hl .38 sn .42 eye .09
bothrops-atrox hl .38 sn .44 eye .09
bothrops-jararaca hl .38 sn .45 eye .09
bothriechis-schlegelii hl .42 eye .12 br .22
lachesis-muta hl .40 sn .55 eye .08
trimeresurus-albolabris hl .44 eye .13
tropidolaemus-wagleri hl .40 eye .11
calloselasma-rhodostoma hl .36 sn .45 up .12
deinagkistrodon-acutus hl .38 sn .4 up .6
protobothrops-mucrosquamatus hl .38 sn .45
gloydius-blomhoffii hl .42
vipera-berus hl .40 sn .55 eye .12
vipera-aspis hl .40 sn .52 up .12
vipera-ammodytes hl .40 sn .52
daboia-russelii hl .38 sn .55 eye .11
bitis-arietans hl .34 sn .6 eye .1 ex .3
bitis-gabonica hl .36 sn .62 eye .09
bitis-nasicornis hl .38 sn .58
cerastes-cerastes hl .40 sn .62 eye .12 ex .33
echis-carinatus hl .42 sn .6 eye .14
echis-ocellatus hl .42 sn .6 eye .13
atheris-squamigera hl .42 eye .14
causus-rhombeatus eye .12
pseudocerastes-urarachnoides hl .38
python-regius hl .45 sn .62 eye .09 ex .33 ck .08 sm .04
python-molurus hl .40 sn .6 eye .08
python-bivittatus hl .40 sn .6 eye .08
python-sebae hl .38 sn .55 eye .08
malayopython-reticulatus hl .38 sn .55 eye .09
morelia-viridis hl .48 sn .68 sh .8 eye .1 ck .09
morelia-spilota hl .42 sn .6
aspidites-melanocephalus hl .44 sn .68 ck .03
antaresia-childreni hl .42 eye .1
boa-constrictor hl .40 sn .52 eye .09 ex .33
boa-imperator hl .40 sn .54 eye .09 ex .33
eunectes-murinus hl .38 sn .62
eunectes-notaeus hl .38 sn .62 ea 45
corallus-caninus hl .48 sn .7 eye .1 ck .09
corallus-hortulana hl .46 eye .12 ck .08
epicrates-cenchria hl .42 eye .1
chilabothrus-inornatus hl .42
sanzinia-madagascariensis hl .45 ck .08
candoia-carinata hl .40 sn .55
xenopeltis-unicolor hl .38 sn .75 eye .08 ck .02
pantherophis-guttatus hl .42 eye .17
pantherophis-obsoletus hl .42 eye .18
pantherophis-alleghaniensis hl .42 eye .18
pantherophis-spiloides hl .42 eye .18
lampropeltis-getula hl .44 sn .65 eye .15 ck .03
lampropeltis-californiae hl .44 sn .65 eye .15 ck .03
lampropeltis-triangulum hl .44 sn .62 eye .15
lampropeltis-elapsoides hl .44 sn .62 eye .15
pituophis-catenifer hl .44 sn .52 eye .15
pituophis-melanoleucus hl .44 sn .52 eye .15
drymarchon-couperi hl .45 eye .18
drymarchon-corais hl .45 eye .18
coluber-constrictor hl .42
masticophis-flagellum hl .40
thamnophis-sirtalis hl .44
thamnophis-elegans hl .44
thamnophis-proximus hl .42 eye .2
nerodia-sipedon hl .42 eye .15 ea 55
nerodia-fasciata hl .42 eye .15 ea 55
natrix-natrix hl .44
natrix-helvetica hl .44
natrix-tessellata hl .42 ea 55
coronella-austriaca hl .42
zamenis-longissimus hl .42 sn .55
elaphe-quatuorlineata hl .42
hierophis-viridiflavus hl .42 eye .21
malpolon-monspessulanus hl .40 br .12 lor .04
dispholidus-typus hl .45 sn .62 eye .26
ahaetulla-prasina hl .30
ahaetulla-nasuta hl .30
chrysopelea-paradisi hl .40 eye .21 ck .06
chrysopelea-ornata hl .40 eye .21 ck .06
imantodes-cenchoa hl .42 eye .28
leptophis-ahaetulla hl .33 eye .22
boiga-dendrophila eye .21
boiga-irregularis eye .22
dasypeltis-scabra hl .45 eye .14
gonyosoma-oxycephalum hl .38 sn .5 eye .17
spilotes-pullatus hl .44 eye .19
ptyas-mucosa hl .42 eye .21
xenochrophis-piscator hl .42 ea 55
rhabdophis-tigrinus hl .44
diadophis-punctatus hl .40 eye .15
storeria-dekayi hl .44 eye .16
farancia-abacura hl .42 sn .7 eye .1
cemophora-coccinea hl .42 sn .5
boaedon-fuliginosus hl .42 eye .14
psammophis-sibilans hl .38 eye .22 br .1 lor .035
acrochordus-javanicus hl .40 ea 45
`;
const HEAD_SET = {};
{ const K = { lips: 'lips', hl: 'hl', sn: 'snout', sh: 'snoutH', eye: 'eyeL', ex: 'eyeX', ea: 'eyeA', ck: 'cheek', lor: 'lor', cr: 'crown', sm: 'smile', br: 'brow', up: 'snoutUp' };
  for (const line of HEAD_SET_SRC.split('\n')) { const w = line.trim().split(/\s+/); if (w.length < 3) continue; const o = {}; for (let i = 1; i + 1 < w.length; i += 2) if (K[w[i]]) o[K[w[i]]] = isNaN(+w[i + 1]) ? w[i + 1] : +w[i + 1]; if (o.hl != null) o.hlSet = 1; HEAD_SET[w[0]] = o; } }
const ROWS_GENUS = { // v6.26: typical dorsal scale rows at mid-body, for genera tools/auto_models.py GENUS_ROWS lacks
  erythrolamprus: 17, apostolepis: 15, pareas: 15, opisthotropis: 17, stegonotus: 17, achalinus: 23, toxicocalamus: 15, eirenis: 17, lycophidion: 17, thamnodynastes: 19,
  atractaspis: 23, rhadinaea: 17, rhadinella: 17, helicops: 19, tropidonophis: 15, prosymna: 17, coniophanes: 19, leptodeira: 21, phalotris: 15, philodryas: 19, oxyrhopus: 19,
  polemon: 15, telescopus: 19, mastigodryas: 17, dipsadoboa: 17, xenodon: 19, suta: 19, pseudoxyrhopus: 19, aparallactus: 15, pseudalsophis: 17, salvadora: 17,
  liophidium: 17, lycodryas: 19, elapsoidea: 13, aspidura: 15, lycodonomorphus: 19, asthenodipsas: 15, adelphicos: 15, bothrocophias: 25, arrhyton: 17, tropidodipsas: 17,
  porthidium: 23, taeniophallus: 17, synophis: 19, hypsiglena: 21, alsophis: 19, sibynophis: 17, amblyodipsas: 15, liopeltis: 15, macrocalamus: 15, brachyurophis: 15,
  lygophis: 17, liopholidophis: 17, urotheca: 17, hypsirhynchus: 17, pseudoboa: 19, trachischium: 13, lamprophis: 21, trimorphodon: 23, ficimia: 17, tropidophis: 25,
  epictia: 14, myriopholis: 14, leptotyphlops: 14, rena: 14, trilepida: 14, anilios: 22, letheobia: 24, afrotyphlops: 28, gerrhopilus: 20, ramphotyphlops: 22,
  liotyphlops: 24, amerotyphlops: 20, madatyphlops: 20, argyrophis: 22, malayotyphlops: 22, antillotyphlops: 20, cubatyphlops: 20, indotyphlops: 20, typhlops: 20,
};
const HF_GENUS = {};
for (const [k, l] of Object.entries({
  natricine: 'natrix nerodia thamnophis regina storeria virginia clonophis tropidoclonion liodytes seminatrix hebius rhabdophis fowlea xenochrophis amphiesma sinonatrix trimerodytes tropidonophis atretium herpetoreas opisthotropis afronatrix limnophis natriciteres hydraethiops lycognathophis anoplohydrus parahelicops',
  broad: 'boiga toxicodryas dipsadoboa telescopus crotaphopeltis leptodeira dipsas sibon tropidodipsas sibynomorphus pareas aplopeltura asthenodipsas heterodon paleoheterodon xenodon lystrophis waglerophis hypsiglena trimorphodon',
  vine: 'ahaetulla thelotornis oxybelis langaha uromacer imantodes dryophiops xenoxybelis',
  burrow: 'atractaspis amblyodipsas aparallactus polemon xenocalamus macrelaps micrelaps homoroselaps chilorhinophis brachyophis hypoptophis poecilopholis uropeltis rhinophis plectrurus melanophidium platyplectrurus teretrurus pseudoplectrurus plecturus cylindrophis anilius calamaria carphophis',
  cobra: 'naja ophiophagus hemachatus pseudohaje walterinnesia aspidelaps',
  mamba: 'dendroaspis', deathadder: 'acanthophis',
  bitis: 'bitis cerastes pseudocerastes eristicophis',
  colubrine: 'causus azemiops', // (narrow, colubrid-like viper heads)
  boa: 'boa acrantophis sanzinia candoia epicrates chilabothrus eunectes corallus',
  sandboa: 'eryx gongylophis charina lichanura calabaria',
})) for (const g of l.split(' ')) HF_GENUS[g] = k;
// v6.20: body builds by genus - arboreal (laterally compressed, sloping sides), krait (a raised vertebral ridge)
const BUILD_GENUS = {};
for (const [k, l] of Object.entries({
  arboreal: 'ahaetulla thelotornis oxybelis langaha uromacer imantodes dryophiops xenoxybelis boiga toxicodryas dipsadoboa dispholidus thrasops philothamnus hapsidophrys rhamnophis dendrelaphis chrysopelea leptophis chironius dendrophidion gonyosoma rhadinophis corallus sanzinia candoia trimeresurus bothriechis atheris tropidolaemus craspedocephalus popeia cryptelytrops parias',
  arborealHeavy: 'morelia corallus',
  krait: 'bungarus',
})) for (const g of l.split(' ')) BUILD_GENUS[g] = { arboreal: { tri: 0.55, xs: 0.88 }, arborealHeavy: { tri: 0.4, xs: 0.95 }, krait: { tri: 0.75, xs: 1.0, ridge: 0.05 } }[k];
BUILD_GENUS.morelia = { tri: 0.25, xs: 1.05 }; // (only the green tree python is arboreal; carpet pythons a little)
function headForm(plan, id) {
  const k = HF_GENUS[String(id || '').split('-')[0]];
  if (k) return HEAD_FORM[k];
  return HEAD_FORM[{ colubrid: 'colubrine', elapid: 'elapid', sea: 'sea', viper: 'viper', pitviper: 'pitviper', python: 'python' }[plan] || ''] || null;
}
// v5.73: pupils by genus where they differ from the family's: vertical slits in the night-hunting colubrids (cat, lyre,
// egg-eating, snail-eating, house and wolf snakes) and some Australian elapids; a horizontal keyhole in the vine snakes;
// round in the night adders (Causus), the one viper genus with them
const PUPIL_GENUS = {};
for (const [k, l] of Object.entries({
  slit: 'boiga toxicodryas dipsadoboa telescopus crotaphopeltis leptodeira imantodes dipsas sibon sibynomorphus tropidodipsas hypsiglena trimorphodon pareas aplopeltura asthenodipsas dasypeltis lycodon lycophidion boaedon lamprophis psammodynastes leioheterodon madagascarophis ithycyphus acanthophis suta denisonia hoplocephalus cryptophis paroplocephalus azemiops',
  hslit: 'ahaetulla oxybelis thelotornis dryophiops xenoxybelis',
  round: 'causus',
})) for (const g of l.split(' ')) PUPIL_GENUS[g] = k;
// ---------- v6.35 (the "3d" preview): the shared realism pass ----------
// Eduardo: the snakes "still look like worms with eyes". Rendered side by side with photos, group by group: the body was a
// long cone from a thin neck to the middle of the body (a real snake is near its full girth a fifth to a quarter of the way
// along and keeps it to the vent - the forebody read as a worm's), tails ran out to a needle point, the jawline and the
// brow were too faint to read at a normal distance, the gloss coat and the eyes' reflections read as plastic, and some groups
// lacked their own silhouette (vine snakes' long pointed snouts, sea snakes' flattened bodies, burrowers' and blind snakes'
// tiny eyes, the stout hognoses' shovel snouts). It only changes the profile (P) - the pattern worker gets P, so it builds the
// same body - and only while the preview is on (tools/previews.js "3d"; window.SL_3D_REALISM true/false overrides it).
export function realismOn() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.SL_3D_REALISM != null) return !!window.SL_3D_REALISM;
    const S = window.SL_PREVIEWS; if (S && typeof S.on === 'function') return !!S.on('3d');
    return window.localStorage.getItem('sl-art-preview-3d') === '1';
  } catch (e) { return false; }
}
// (tools/3d_inventory.py reads these three lists: keep their form)
const RACER_GENERA = 'coluber masticophis drymarchon drymobius drymoluber ptyas dendrelaphis philothamnus hapsidophrys opheodrys leptophis chironius dendrophidion mastigodryas hierophis dolichophis platyceps psammophis malpolon salvadora spalerosophis orientocoluber thrasops rhamnophis gonyosoma rhadinophis cyclophiops eirenis bamanophis masticophis dispholidus chrysopelea';
const HOG_GENERA = 'heterodon paleoheterodon xenodon lystrophis waglerophis';
const LONGSNOUT_GENERA = 'ahaetulla oxybelis thelotornis langaha dryophiops xenoxybelis';
const RACER_SET = new Set(RACER_GENERA.split(' ')), HOG_SET = new Set(HOG_GENERA.split(' ')), LONGSNOUT_SET = new Set(LONGSNOUT_GENERA.split(' '));
// the group (tools/3d_inventory.py group_of mirrors this)
function realGroup(q, id) {
  const g = String(id || '').split('-')[0], hf = Object.keys(HEAD_FORM).find((k) => HEAD_FORM[k] === headForm(q.plan, id)) || '', HG = HF_GENUS[g];
  if (q.plan === 'blind') return 'blind';
  if (q.plan === 'sea') return 'sea';
  if (q.plan === 'viper' || q.plan === 'pitviper') return g === 'crotalus' || g === 'sistrurus' ? 'rattlesnake' : HG === 'colubrine' ? 'colubrine' : q.plan;
  if (q.plan === 'python') return HG === 'boa' || HG === 'sandboa' ? HG : 'python';
  if (q.plan === 'elapid') return HG === 'cobra' || HG === 'mamba' || HG === 'deathadder' || HG === 'burrow' ? HG : 'elapid';
  if (HOG_SET.has(g)) return 'hognose';
  if (LONGSNOUT_SET.has(g) || HG === 'vine') return 'vine';
  if (HG === 'broad' || HG === 'burrow' || HG === 'natricine') return HG;
  if (RACER_SET.has(g)) return 'racer';
  return hf === 'natricine' ? 'natricine' : 'colubrine';
}
// per group: fore [where along the body (of its length), the width there (of the thickest)] - the forebody filled out
// early; tail - the tail's taper when the profile names none; ld - stouter (<1) or more slender (>1), the head and neck
// keeping their real size; lip, sock, brow - the jawline crease, the eye socket's depth and the brow ridge, as factors;
// eye - eye size factor; xs - flatter from side to side (<1)
const REAL = {
  viper: { fore: [0.2, 0.93], tail: 'abrupt', ld: 0.95, lip: 1.6, sock: 1.25, brow: 1.3 },
  pitviper: { fore: [0.2, 0.92], tail: 'abrupt', ld: 0.96, lip: 1.6, sock: 1.25, brow: 1.3 },
  rattlesnake: { fore: [0.2, 0.93], ld: 0.96, lip: 1.6, sock: 1.25, brow: 1.3 },
  deathadder: { fore: [0.18, 0.94], ld: 0.96, lip: 1.5, sock: 1.2, brow: 1.2 },
  python: { fore: [0.22, 0.9], tail: 'prehensile', ld: 0.96, lip: 1.5, sock: 1.2, brow: 1.4 },
  boa: { fore: [0.22, 0.9], tail: 'prehensile', ld: 0.96, lip: 1.5, sock: 1.2, brow: 1.4 },
  sandboa: { fore: [0.12, 0.97], tail: 'blunt', lip: 1.2, sock: 1.1 },
  cobra: { fore: [0.24, 0.9], lip: 1.5, sock: 1.15, brow: 1.25 },
  mamba: { fore: [0.28, 0.86], tail: 'whip', ld: 1.03, lip: 1.5, sock: 1.15, brow: 1.25 },
  elapid: { fore: [0.22, 0.9], lip: 1.5, sock: 1.15, brow: 1.25 },
  colubrine: { fore: [0.22, 0.9], lip: 1.5, sock: 1.15, brow: 1.25 },
  natricine: { fore: [0.2, 0.92], lip: 1.5, sock: 1.15, brow: 1.25 },
  racer: { fore: [0.26, 0.88], tail: 'whip', ld: 1.03, lip: 1.5, sock: 1.15, brow: 1.3 },
  vine: { fore: [0.3, 0.85], tail: 'whip', ld: 1.04, lip: 1.4, sock: 1.1, brow: 1.3, snout: 1 },
  broad: { fore: [0.22, 0.9], lip: 1.5, sock: 1.15, brow: 1.25 },
  hognose: { fore: [0.16, 0.95], ld: 0.96, lip: 1.4, sock: 1.1, brow: 1.2, hog: 1 },
  burrow: { fore: [0.1, 0.98], tail: 'blunt', eye: 0.75, lip: 1.1 },
  blind: { fore: [0.08, 1.0], eye: 0.6 },
  sea: { fore: [0.3, 0.86], xs: 0.9, lip: 1.3, sock: 1.1 },
};
// species remodelled in the preview, against photos and field-guide accounts (applied to the raw profile, as SPECIES_LOOK is)
const REAL_LOOK = {
  // inland taipan (Australian Museum account; research-grade iNaturalist photos): a long, fairly narrow head with a rounded
  // snout - not deep and bulbous - set off from a slimmer neck; medium-slender body; brown to olive with dark-edged scales
  // (darker in winter, the head glossy black-brown); a dark iris with the round pupil still showing
  'oxyuranus-microlepidotus': { h: { w: 0.8, wFixed: 1, len: 0.04, h: 0.64, hFixed: 1, snoutH: 0.7, snout: 0.5, capK: 0.85, jaw: 0.8, eyeL: 0.17, iris: '#3a2617', irisInner: '#5c3f26', brow: 0.06, cheek: 0.03, lor: 0.02, headRelief: 0.22 },
    body: { neck: 0.66, ld: 37 }, scales: { gloss: 0.52 } },
  // smooth green snake (field guides; SnakeList photo): small and very slender, plain bright green above, pale yellow to
  // white below, smooth satin scales (not wet plastic), a round black pupil in a dark iris
  'opheodrys-vernalis': { h: { iris: '#262414', irisInner: '#3a3a1e', lw: 1.8 }, scales: { gloss: 0.62 }, colors: { belly: '#eceebf' } },
};
function realLook(p, id) {
  const L = REAL_LOOK[id]; if (!L || !p) return p;
  const q = JSON.parse(JSON.stringify(p)), tgt = q.auto ? (q.auto.h = q.auto.h || {}) : (q.head = q.head || {});
  Object.assign(tgt, L.h || {});
  if (L.body) Object.assign(q.auto ? (q.auto.bx = q.auto.bx || {}) : (q.body = q.body || {}), L.body);
  if (L.scales) Object.assign(q.auto ? (q.auto.sx = q.auto.sx || {}) : (q.scales = q.scales || {}), L.scales);
  if (L.colors) Object.assign(q.auto ? (q.auto.cx = q.auto.cx || {}) : (q.colors = q.colors || {}), L.colors);
  return q;
}
function realism(q, id) {
  const g = String(id || '').split('-')[0], grp = realGroup(q, id), R = REAL[grp] || REAL.colubrine;
  const B = Object.assign({}, q.body), H = Object.assign({}, q.head), S = Object.assign({}, q.scales), tri = (H.shape || 'oval') === 'tri';
  // (head and neck widths are fractions of the body's width: they are scaled back so they keep their real size)
  if (R.ld) { B.ld *= R.ld; H.w *= R.ld; B.neck = Math.min(1.05, B.neck * R.ld); }
  if (R.xs) { B.xs *= R.xs; const k = 1 / Math.sqrt(R.xs); H.w *= k; B.neck = Math.min(1.05, B.neck * k); }
  if (R.fore && !B.fore) B.fore = R.fore;
  if (R.tail && !B.tailShape && !(q.tail && q.tail.rattle) && !B.paddle && !B.blunt) B.tailShape = R.tail;
  if (B.tipRound == null) B.tipRound = B.tailShape === 'whip' ? 0.16 : 0.24; // (the tail's tip rounded off, not a needle)
  if (R.lip) H.lipK = R.lip;
  if (R.sock) H.sockK = R.sock;
  if (R.brow) { if (H.brow) H.brow *= R.brow; H.browGeo = (H.browGeo != null ? H.browGeo : tri ? 0.16 : 0.09) * R.brow; }
  if (R.eye) H.eyeK = (H.eyeK || 0.9) * R.eye;
  H.specK = 0.72; // (the spectacle's reflections restrained)
  if (R.snout && LONGSNOUT_SET.has(g)) Object.assign(H, { len: Math.min(0.058, H.len * 1.12), snout: Math.min(H.snout, 0.36), tip: 0.24, tipR: 0.06, capK: 0.6 }); // (a little longer, the snout drawn out to a point; the head was already narrow)
  if (R.hog && !H.snoutUp) Object.assign(H, { snoutUp: 0.45, upturn: 0.5, upLen: 0.34, tip: 0.3 });
  // the head and neck held a little off the ground in a resting, alert snake on the ground (a head laid flat in line with the
  // body was much of the worm look) - not in burrowers, sea snakes, or snakes in trees, on a coil or rearing
  const Po = Object.assign({}, q.pose || {}); if ((Po.kind || 'wave') === 'wave' && !['blind', 'burrow', 'sea', 'sandboa'].includes(grp)) { Po.lift = Math.max(Po.lift != null ? Po.lift : 0.35, 0.9); Po.liftLen = Math.max(Po.liftLen || 2.6, 4.2); }
  if (grp !== 'blind') { S.gloss = (S.gloss != null ? S.gloss : 0.5) * 0.84; S.coatK = 0.8; } // (less of a plastic coat; blind snakes really are glassy)
  return Object.assign({}, q, { body: B, head: H, scales: S, pose: Po, realism: grp });
}
function normProfile(p, id) {
  { const hs = HEAD_SET[id || p.id]; if (hs) p = Object.assign({}, p, { head: Object.assign({}, p.head, hs) }); } // v6.26: the hand-set heads
  const base = PLANS[p.plan] || PLANS.colubrid;
  const q = merge(merge(base, { colors: { dorsal: '#776655', lateral: null, belly: '#d8cfb8', mottle: 0.08, var: 0.05 }, pattern: [], tail: {}, scene: { kind: 'litter' } }), p);
  q.colors.lateral = q.colors.lateral || q.colors.dorsal;
  // v6.26: the usual mid-body scale rows of genera the generator had no count for (they took their family's, so a dwarf boa
  // had a python's 71 rows of tiny scales, and thread snakes the 20 of other blind snakes)
  { const r = ROWS_GENUS[String(id || p.id || '').split('-')[0]]; if (r && !(p.scales && p.scales.rows)) q.scales = Object.assign({}, q.scales, { rows: r }); }
  // v5.27: viper heads are broad triangles behind a narrow neck (they were barely wider than the neck from above)
  if ((q.head.shape || 'oval') === 'tri' && !q.head.wFixed) q.head = Object.assign({}, q.head, { w: q.head.w * 1.1 });
  // v5.73: the head's length, width and neck from its group (HEAD_FORM): the length kept within the group's range, the
  // width set by the length-to-width ratio (never broader: a slender colubrid's head is long and narrow, not bulbous) and
  // kept within its range against the body; then the neck from the head-to-neck ratio (body.hn when the profile has one)
  { const pu = PUPIL_GENUS[String(id || p.id || '').split('-')[0]]; if (pu && q.plan !== 'blind' && !(p.head && p.head.pupil)) q.head = Object.assign({}, q.head, { pupil: pu }); }
  const form = q.plan === 'blind' ? null : headForm(q.plan, id || p.id);
  if (form && !q.head.wFixed) {
    const sx = Math.sqrt(q.body.xs), lwT = q.head.lw != null ? q.head.lw : q.head.minR != null ? Math.max(q.head.minR, 1.2) : form.lw;
    let len = clamp(q.head.len, form.len[0], form.len[1]), w = q.head.w;
    if ((len * q.body.ld) / (w * sx) < lwT) w = (len * q.body.ld) / (lwT * sx); // (too broad for its length: narrower)
    w = Math.min(w, form.hb[1]);
    if (w < form.hb[0]) { w = form.hb[0]; len = Math.min(Math.max(len, (lwT * w * sx) / q.body.ld), form.len[1]); }
    // (a width-based eye was sized for the old head: a much narrower head takes its family's eye size instead)
    const eyeL = q.head.eyeL == null && w < q.head.w * 0.92 && EYE_L[q.plan] ? EYE_L[q.plan] : q.head.eyeL;
    q.head = Object.assign({}, q.head, { len, w, eyeL, h: form.h && q.head.h < form.h && !q.head.hFixed ? form.h : q.head.h }); // (h: a narrow head is about three quarters as deep as wide)
    const hn = q.body.hn || form.hn;
    if (hn) q.body = Object.assign({}, q.body, { neck: clamp(w / hn, 0.25, 1.05) });
  }
  // v5.31: heads at least as long as they are wide (vipers), longer still in pythons: a short broad head reads as a blob
  // from every side. Too short a head is made a little longer and narrower, keeping its area
  { const minR = q.head.minR != null ? q.head.minR : (q.head.shape || 'oval') === 'tri' ? 1.05 : q.plan === 'python' ? 1.3 : q.plan === 'blind' ? 0 : 1.1;
    const r = q.head.len / (q.head.w * Math.sqrt(q.body.xs) / q.body.ld);
    if (minR && r < minR) { const k = Math.sqrt(minR / r); q.head = Object.assign({}, q.head, { len: q.head.len * k, w: q.head.w / k }); } }
  // v4.81: colubrids, elapids and sea snakes have big head shields: their sutures are drawn on the head, and the
  // small-scale relief is left off it
  // v5.53: the plates are now real scales in the head's own textures (headData), not painted lines
  if ((q.plan === 'colubrid' || q.plan === 'elapid' || q.plan === 'sea' || !PLANS[q.plan]) && q.head.plates == null) q.head = Object.assign({}, q.head, { plates: true });
  // v5.83: blind snakes' head shields are smooth and glassy, the sutures between them faint (they read as tiles)
  if (q.plan === 'blind') q.head = Object.assign({ groove: 0.14, headRelief: 0.3 }, q.head);
  // ---- v5.62 (model accuracy) ----
  // body.hn: the documented ratio of head width to neck width sets the neck (vipers ~2-3, colubrids ~1.3, pipe snakes 1)
  if (q.body.hn && !form) q.body = Object.assign({}, q.body, { neck: clamp(q.head.w / q.body.hn, 0.25, 1.05) });
  // eye size against head LENGTH (head.eyeL = eye diameter / head length), the family's usual size unless the profile
  // gives one; a profile that sets the old width-based 'eye' keeps exactly the size it had (see eyeRadOf)
  if (q.head.eyeL == null && !(p.head && p.head.eye != null) && EYE_L[q.plan]) q.head = Object.assign({}, q.head, { eyeL: EYE_L[q.plan] });
  // v6.20 (head silhouettes): side by side with photos nearly every head was a flat spatula - its depth (crown to chin) a
  // third of its length or less, and lower than the neck behind it, so in profile the neck rose above the head. Real heads
  // are 0.35-0.5 as deep as long (depth group by group in HEAD_FORM.hl; head.hl per species). The head is made deeper (never
  // deeper than it is wide, a little more in burrowers), and each group's own sculpting is passed on: cheeks (the jaw
  // muscles swelling low at the back of the head), the loreal hollow under the canthus between nostril and eye, and the
  // crown's dome over the parietals (each overridable per species as head.cheek, head.lor, head.crown)
  // v6.20 (body cross-sections by build): tree snakes are deeper than wide, with the sides sloping in to the spine (a
  // loaf or a narrow arch, not a round hose - they bridge gaps between branches on it); kraits have their raised, triangular
  // backbone ridge. Was set for one species only.
  { const g = String(id || p.id || '').split('-')[0], bu = BUILD_GENUS[g], pb = p.body || {};
    if (bu && q.plan !== 'sea' && q.plan !== 'blind') q.body = Object.assign({}, q.body, { tri: pb.tri != null ? pb.tri : bu.tri, xs: pb.xs != null ? pb.xs : Math.min(q.body.xs, bu.xs), ridge: Math.max(q.body.ridge || 0, bu.ridge || 0) }); }
  if (form || q.plan === 'blind') {
    const f = form || { hl: 0.5, cheek: 0, lor: 0, crown: 0.02 }, H = q.head, B = q.body;
    const w0 = (1 / B.ld) / 2 * Math.sqrt(B.xs), chin = H.chin != null ? H.chin : B.bf, hlT = H.hl != null ? H.hl : f.hl * 0.93; // (the estimate below reads a little shallow: measured on the built head the group targets land ~7% deeper)
    const depth = (h) => H.w * w0 * h * (1 + chin * 0.92) / H.len; // (crown to chin over the head's length; L cancels)
    const hMax = q.plan === 'blind' || f === HEAD_FORM.burrow ? 1.1 : 1.0;
    let h = H.h; if (hlT && depth(h) < hlT) h = Math.min(hMax, Math.max(h, hlT / depth(1)));
    if (H.hlSet) h = clamp((H.hl * 0.93) / depth(1), 0.42, hMax); // (v6.26: a hand-set depth is met both ways - some heads, the puff adder's, are flatter than their group's)
    q.head = Object.assign({}, H, { h, cheek: H.cheek != null ? H.cheek : f.cheek || 0, lor: H.lor != null ? H.lor : f.lor || 0, crown: H.crown != null ? H.crown : f.crown || 0, smile: H.smile != null ? H.smile : f.smile || 0 });
  }
  return q;
}
// v5.62: eye diameter / head length by family (field-guide norms): diurnal colubrids have big eyes, burrowers tiny ones
// (v5.73: colubrids 0.2 - a natricine's or racer's eye is a fifth to a quarter of its head's length)
const EYE_L = { colubrid: 0.18, elapid: 0.13, viper: 0.11, pitviper: 0.1, python: 0.09, sea: 0.07 };
function eyeRadOf(P, F) {
  const Hd = P.head, x = Hd.eyeX * F.Hl;
  // v5.88: about 10% smaller than before - side by side with photos the eyes read a little too big (the dark rim of the
  // socket round them adds to their apparent size)
  const k = Hd.eyeK || 0.9;
  if (Hd.eyeL == null) return (Hd.eye || 0.15) * F.W(x) * 1.04 * k;
  return Math.min((Hd.eyeL * F.Hl) / 2 * k, 0.64 * F.Hh(x), 0.85 * F.W(x)); // (never wider than the side of the head)
}

// ---------- generated profiles (v4.63): every species without a hand-made profile ----------
// tools/auto_models.py writes a short entry ({ auto: { p plan, L length, d/c/b colours, t pattern, n marks,
// s scene, k keeled, x flags } }); this turns it into a full profile with the same layer types the
// hand-made ones use. Flags: f fossil, e extinct, g colours guessed, l length typical for its group.
function mixHex(a, b, t) { return hexOf(mixc(hex(a), hex(b), t)); }
function hexOf(rgb) { return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function shade(c, k) { const v = hex(c); return hexOf(k >= 1 ? mixc(v, [255, 250, 235], Math.min(1, k - 1)) : v.map((x) => x * k)); }
function lumOf(c) { const v = hex(c); return (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]) / 255; }
export function autoProfile(p) {
  if (!p || !p.auto) return p;
  const a = p.auto, x = a.x || '', d = a.d, c = a.c, b = a.b, n = a.n || 36, fossil = x.includes('f');
  const pale = lumOf(c) > lumOf(d) ? c : shade(d, 1.45), dark = lumOf(c) < lumOf(d) ? c : shade(d, 0.45);
  const pat = [];
  const T = (o) => pat.push(Object.assign({ t: [0.06, 0.97], warp: 0.55, jit: 0.14, sj: 0.2, aj: 0.04 }, o));
  switch (a.t) {
    case 'blotch':
      T({ type: 'blotch', count: n, a: 0, wid: 0.27, len: 0.62, shape: 'round', color: c, edgeColor: shade(c, 0.6), edge: 0.12 }); // (v5.43: narrower - wider ones met over the back and read as bands)
      T({ type: 'blotch', count: n, phase: 0.5, a: 0.56, mirror: true, wid: 0.13, len: 0.42, shape: 'round', color: c, alpha: 0.85, jit: 0.22, sj: 0.3 }); break;
    case 'saddle': T({ type: 'blotch', count: n, a: 0, wid: 0.44, len: 0.42, shape: 'saddle', color: c, edgeColor: shade(c, 0.65), edge: 0.1 }); break;
    case 'diamond':
      // v5.20: closed diamonds centred on the spine, joined tip to tip, a pale border round each, the ground between paler
      // v5.62 (model accuracy): the diamonds cover most of the back (about scale row 5 to row 5: they were a thin chain)
      T({ type: 'blotch', t: [0.06, 0.86], count: Math.round(n * 0.75), a: 0, wid: 0.42, len: 1.1, shape: 'diamond', color: c, edgeColor: pale, edge: 0.12, edgeOut: true, inner: { r: 0.6, color: mixHex(c, d, 0.45) }, warp: 0.2, jit: 0.02, sj: 0.08 });
      T({ type: 'blotch', t: [0.06, 0.86], count: Math.round(n * 0.75), phase: 0.5, a: 0.62, mirror: true, wid: 0.08, len: 0.55, shape: 'diamond', color: shade(c, 1.15), alpha: 0.45, warp: 0.3, jit: 0.04 });
      T({ type: 'band', t: [0.87, 0.985], count: 6, len: a.bl || 0.5, color: '#17130f', warp: 0.2, jit: 0.02 }); break;
    case 'hourglass': T({ type: 'blotch', count: Math.round(n * 0.8), a: 0, wid: 0.62, len: 0.82, shape: 'hourglass', color: c, edgeColor: pale, edge: 0.12, edgeOut: true, warp: 0.4 }); break;
    // v5.19: copperhead-type crossbands (narrow over the spine, wide on the flanks), kingsnake chains, a reticulated net
    // v5.20: rattlesnake blotches (rounded, dark, with a pale rim), a row of smaller ones on each flank, banded tail
    case 'rblotch':
      T({ type: 'blotch', t: [0.07, 0.86], count: Math.round(n * 0.85), a: 0, wid: 0.25, len: 0.58, shape: 'saddle', color: c, edgeColor: a.pe || pale, edge: a.pe ? 0.2 : 0.14, edgeOut: true, warp: 0.35, jit: 0.06 }); // (v5.62: pe - a white edge, prairie rattlesnakes)
      T({ type: 'blotch', t: [0.07, 0.86], count: Math.round(n * 0.85), phase: 0.5, a: 0.5, mirror: true, wid: 0.12, len: 0.42, shape: 'round', color: c, alpha: 0.8, warp: 0.35 });
      T({ type: 'band', t: [0.87, 0.985], count: 5, len: 0.45, color: shade(c, 0.7), warp: 0.2, jit: 0.02 }); break;
    // v5.20: Russell's vipers - three rows of dark ovals, each ringed in black and edged in white
    case 'daboia':
      T({ type: 'blotch', t: [0.06, 0.95], count: Math.round(n * 0.7), a: 0, wid: 0.2, len: 0.66, shape: 'round', color: c, edgeColor: '#f2ecdc', edge: 0.18, edgeOut: true, inner: { r: 0.8, color: shade(c, 1.35) }, warp: 0.15, jit: 0.04 });
      T({ type: 'blotch', t: [0.06, 0.95], count: Math.round(n * 0.7), phase: 0.5, a: 0.45, mirror: true, wid: 0.15, len: 0.6, shape: 'round', color: c, edgeColor: '#f2ecdc', edge: 0.18, edgeOut: true, inner: { r: 0.8, color: shade(c, 1.35) }, warp: 0.15, jit: 0.04 }); break;
    // v5.20: saw-scaled vipers - pale saddles over the back and a pale wavy line low on each flank
    case 'echis':
      T({ type: 'blotch', t: [0.06, 0.95], count: Math.round(n * 0.9), a: 0, wid: 0.22, len: 0.45, shape: 'saddle', color: pale, alpha: 0.85, edgeColor: c, edge: 0.18, edgeOut: true, warp: 0.3 });
      T({ type: 'zigzag', count: Math.round(n * 1.2), a: 0.55, mirror: true, amp: 0.07, wid: 0.03, color: pale, warp: 0.3 }); break;
    // v5.20: garter snakes - a pale stripe down the spine, one low on each flank (scale rows 2-3), dark checks between
    case 'garter': { const gs = lumOf(pale) < 0.4 ? '#d9c26a' : pale; // (a dark garter snake still has bright stripes)
      // (v5.99: the stripes a scale row wider and the checks between them darker - side by side with photos the generated
      // garter snakes read as plain brown snakes from a normal distance, their stripes and checks lost)
      T({ type: 'stripe', t: [0.04, 1], a: 0, wid: 0.068, color: gs, aa: 0.3 });
      T({ type: 'stripe', t: [0.04, 1], a: 0.6, mirror: true, wid: 0.07, color: gs, aa: 0.3, alpha: 0.92 }); }
      T({ type: 'blotch', count: Math.round(n * 2), a: 0.3, mirror: true, alt: true, wid: 0.07, len: 0.34, shape: 'rect', color: shade(d, 0.32), alpha: 0.82 }); break;
    // v5.21: saddles with a black border (rat snakes, corn and fox snakes), rings with paler centres (rainbow boas),
    // boa saddles (dark on the back, oval on the flanks), and narrow crossbands (snail-eaters, death adders)
    // v5.22: lanceheads (Bothrops) - dark triangles/trapezoids on each flank, pale-edged, their tips meeting over the back
    case 'trap':
      T({ type: 'blotch', count: Math.round(n * 0.6), a: 0.36, mirror: true, alt: true, wid: 0.34, len: 0.85, shape: 'diamond', color: c, edgeColor: pale, edge: 0.14, edgeOut: true, warp: 0.3, jit: 0.05 }); break;
    case 'esaddle':
      T({ type: 'blotch', count: Math.round(n * 0.85), a: 0, wid: 0.36, len: 0.6, shape: 'saddle', color: c, edgeColor: shade(c, 0.35), edge: 0.14, warp: 0.35, jit: 0.08 });
      T({ type: 'blotch', count: Math.round(n * 0.85), phase: 0.5, a: 0.6, mirror: true, wid: 0.1, len: 0.42, shape: 'round', color: c, edgeColor: shade(c, 0.35), edge: 0.18, alpha: 0.85 }); break;
    case 'rings':
      T({ type: 'blotch', count: Math.round(n * 0.9), a: 0, wid: 0.2, len: 0.66, shape: 'round', color: shade(c, 0.35), inner: { r: 0.62, color: d }, warp: 0.2, jit: 0.05 });
      T({ type: 'blotch', count: Math.round(n * 0.9), phase: 0.5, a: 0.48, mirror: true, wid: 0.14, len: 0.52, shape: 'round', color: shade(c, 0.35), inner: { r: 0.55, color: pale }, warp: 0.2, jit: 0.05 }); break;
    case 'boa':
      T({ type: 'blotch', t: [0.06, 0.7], count: Math.round(n * 0.55), a: 0, wid: 0.4, len: 0.55, shape: 'saddle', color: c, edgeColor: pale, edge: 0.12, edgeOut: true, warp: 0.4 });
      T({ type: 'blotch', t: [0.7, 0.98], count: 6, a: 0, wid: 0.5, len: 0.6, shape: 'saddle', color: '#7a2e22', edgeColor: '#e6d8b8', edge: 0.12, edgeOut: true, warp: 0.3 });
      T({ type: 'blotch', count: Math.round(n * 0.6), phase: 0.5, a: 0.6, mirror: true, wid: 0.12, len: 0.45, shape: 'diamond', color: c, warp: 0.4 }); break;
    case 'xband': T({ type: 'band', count: Math.round(n * 0.75), len: 0.32, color: c, warp: 0.35, jit: 0.06, dorsalWide: 0.25, aMax: a.rg ? undefined : 0.7 }); break; // (v5.62: crossbands stop at the belly)
    case 'hourglass2': T({ type: 'blotch', count: Math.round(n * 0.5), a: 0, wid: 0.95, len: 0.75, shape: 'hourglass2', color: c, edgeColor: shade(c, 0.7), edge: 0.12, warp: 0.25, jit: 0.06 }); break;
    case 'chain': T({ type: 'chain', count: Math.round(n * 0.6), na: 1.6, wid: 0.1, color: c, warp: 0.25 }); break;
    case 'net': T({ type: 'net', count: Math.round(n * 0.8), na: 2.0, wid: 0.09, color: c, edgeColor: pale, edge: 0.5, warp: 0.3 }); break;
    case 'chevron': T({ type: 'blotch', count: Math.round(n * 0.7), a: 0, wid: 0.42, len: 0.55, shape: 'chevron', color: c, edgeColor: pale, edge: 0.14, edgeOut: true }); break;
    case 'zigzag':
      T({ type: 'zigzag', count: n, amp: 0.12, wid: 0.075, color: c, warp: 0.6, aa: 0.2 });
      T({ type: 'blotch', count: n, a: 0.5, mirror: true, wid: 0.09, len: 0.4, shape: 'round', color: c, alpha: 0.8 }); break;
    case 'band': T({ type: 'band', count: Math.round(n * 0.7), len: a.bl || 0.36, color: c, warp: 0.3, jit: 0.06, aMax: a.rg ? undefined : 0.72 }); break; // (v5.62: only true rings - kraits, bandy-bandies, sea kraits - go round the belly)
    case 'coral':
      T({ type: 'band', count: Math.round(n * 0.55), len: 0.42, color: '#141110', edgeColor: '#e9c94e', edge: 0.32, edgeOut: true, warp: 0.15, jit: 0.04 });
      pat.push({ type: 'cap', x0: 0, x1: 0.62, wid: 1, color: '#141110' }); break;
    case 'stripe':
      T({ type: 'stripe', t: [0.04, 1], a: 0, wid: 0.05, color: pale, aa: 0.3 });
      T({ type: 'stripe', t: [0.04, 1], a: 0.42, mirror: true, wid: 0.045, color: pale, aa: 0.3, alpha: 0.85 });
      T({ type: 'stripe', t: [0.04, 1], a: 0.2, mirror: true, wid: 0.06, color: dark, aa: 0.35, alpha: 0.55 }); break;
    case 'spot':
      T({ type: 'blotch', count: Math.round(n * 1.2), a: 0.2, mirror: true, alt: true, wid: 0.11, len: 0.28, shape: 'round', color: c, jit: 0.3, sj: 0.3, aj: 0.06 });
      T({ type: 'blotch', count: Math.round(n * 1.2), phase: 0.5, a: 0.5, mirror: true, wid: 0.08, len: 0.22, shape: 'round', color: c, alpha: 0.8, jit: 0.3, sj: 0.3 }); break;
    case 'collar': T({ type: 'band', t: [0.05, 0.085], count: 1, len: 0.95, color: c === d ? pale : (lumOf(c) > lumOf(d) ? c : dark), warp: 0.1, jit: 0 }); break;
    case 'plain': T({ type: 'tint', t: [0.55, 1], ramp: 0.35, color: shade(d, 0.8), alpha: 0.35 }); break;
    // v4.81: more of the patterns real snakes have (chosen by tools/auto_models.py, often for a named species)
    case 'vert': // a vertebral row of pale scales and a few pale flecks (green tree python)
      T({ type: 'blotch', count: Math.round(n * 2.4), a: 0, wid: 0.035, len: 0.42, shape: 'round', color: c, jit: 0.25, sj: 0.4, skip: 0.25, warp: 0.2 });
      T({ type: 'blotch', count: Math.round(n * 1.2), a: 0.16, mirror: true, alt: true, wid: 0.03, len: 0.3, shape: 'round', color: c, alpha: 0.85, jit: 0.4, sj: 0.4, aj: 0.12, skip: 0.45, warp: 0.2 }); break;
    case 'crossbar': // pale bars across the back from a pale vertebral line, not reaching the belly (emerald tree boa)
      T({ type: 'blotch', count: Math.round(n * 0.8), a: 0, wid: 0.34, len: 0.17, shape: 'chevron', color: c, warp: 0.6, jit: 0.3, sj: 0.45, aj: 0.05, skip: 0.08 });
      T({ type: 'stripe', a: 0, wid: 0.022, color: c, aa: 0.3, alpha: 0.9 }); break;
    case 'tricolor': // red, black and yellow (or white) rings, the red bordered by black (milk and scarlet kingsnakes)
      T({ type: 'band', count: Math.round(n * 0.55), len: 0.5, color: '#121010', warp: 0.15, jit: 0.03 });
      T({ type: 'band', count: Math.round(n * 0.55), len: 0.2, color: c, warp: 0.15, jit: 0.03 }); break;
    case 'collar2': // a pale collar with a black one behind it (grass snake), small dark bars down the flanks
      T({ type: 'blotch', t: [0.045, 0.075], count: 1, a: 0.42, mirror: true, wid: 0.2, len: 0.9, shape: 'round', color: c, warp: 0.15, jit: 0 });
      T({ type: 'blotch', t: [0.07, 0.1], count: 1, a: 0.4, mirror: true, wid: 0.24, len: 0.9, shape: 'round', color: '#141210', warp: 0.15, jit: 0 });
      T({ type: 'blotch', t: [0.1, 0.95], count: Math.round(n * 1.3), a: 0.5, mirror: true, alt: true, wid: 0.06, len: 0.3, shape: 'rect', color: shade(d, 0.35), alpha: 0.8 }); break;
    // ---- v5.62 (model accuracy): patterns the audit found missing ----
    case 'carpet': // carpet and jungle pythons: pale-centred blotches with heavy dark rims, linked into bands, a dark band low on the flanks
      T({ type: 'blotch', count: Math.round(n * 0.75), a: 0, wid: 0.34, len: 0.62, shape: 'saddle', color: c, inner: { r: 0.55, color: a.ic || pale }, warp: 0.7, jit: 0.22, sj: 0.35, aj: 0.05 });
      T({ type: 'blotch', count: Math.round(n * 0.75), phase: 0.5, a: 0.3, mirror: true, alt: true, wid: 0.1, len: 0.55, shape: 'round', color: c, warp: 0.7, jit: 0.3, sj: 0.4, skip: 0.35 });
      T({ type: 'blotch', count: Math.round(n * 0.9), phase: 0.25, a: 0.58, mirror: true, wid: 0.11, len: 0.45, shape: 'round', color: c, inner: { r: 0.5, color: a.ic || pale }, warp: 0.6, jit: 0.3, sj: 0.35 });
      T({ type: 'stripe', a: 0.68, mirror: true, wid: 0.035, color: c, alpha: 0.45, aa: 0.4 }); break;
    case 'irregular': // rock and blood pythons: big blotches of uneven size that join their neighbours into a wavy band here and there
      T({ type: 'blotch', count: Math.round(n * 0.8), a: 0, wid: 0.34, len: 0.72, shape: 'round', color: c, edgeColor: a.ec || shade(c, 0.55), edge: 0.14, warp: 0.9, jit: 0.3, sj: 0.45, aj: 0.06 });
      T({ type: 'blotch', count: Math.round(n * 0.8), phase: 0.5, a: 0, wid: 0.13, len: 0.9, shape: 'round', color: c, alpha: 0.9, warp: 0.8, jit: 0.2, skip: 0.45 });
      T({ type: 'blotch', count: Math.round(n * 0.9), phase: 0.5, a: 0.55, mirror: true, wid: 0.15, len: 0.5, shape: 'round', color: a.lc || c, edgeColor: a.ec || shade(c, 0.55), edge: 0.12, warp: 0.8, jit: 0.3, sj: 0.4 }); break;
    case 'tsaddle': // longnose snakes: black saddles flecked with pale scales, red or pink between them
      T({ type: 'blotch', count: Math.round(n * 0.7), a: 0, wid: 0.56, len: 0.58, shape: 'saddle', color: c, speck: { p: 0.35, color: a.sc || '#e8dcc0' }, warp: 0.4, jit: 0.08, sj: 0.15 });
      T({ type: 'blotch', count: Math.round(n * 0.7), phase: 0.5, a: 0.62, mirror: true, wid: 0.09, len: 0.4, shape: 'round', color: c, alpha: 0.75, speck: { p: 0.3, color: a.sc || '#e8dcc0' }, jit: 0.3 }); break;
    case 'rhomb': // egg-eaters (Causus and Echis mimics): a row of dark rhombs down the back, dark bars on the flanks
      T({ type: 'blotch', count: n, a: 0, wid: 0.22, len: 0.78, shape: 'diamond', color: c, edgeColor: pale, edge: 0.12, edgeOut: true, warp: 0.35, jit: 0.06 });
      T({ type: 'blotch', count: n, phase: 0.5, a: 0.48, mirror: true, wid: 0.2, len: 0.26, shape: 'rect', color: c, alpha: 0.85, warp: 0.4, jit: 0.1 }); break;
    case 'chevronF': // king cobras: pale chevrons pointing forward, strongest on the forebody
      T({ type: 'blotch', t: [0.08, 0.92], count: Math.round(n * 0.9), a: 0, wid: 0.62, len: 0.3, shape: 'chevronF', color: c, alpha: 0.85, warp: 0.4, jit: 0.06 }); break;
    case 'nerodia': // northern water snakes: crossbands on the forebody, then dark blotches on the back alternating with ones on the flanks
      T({ type: 'band', t: [0.06, 0.33], count: Math.round(n * 0.3), len: 0.42, color: c, warp: 0.4, jit: 0.08, dorsalWide: 0.2, aMax: 0.7 });
      T({ type: 'blotch', t: [0.33, 0.97], count: Math.round(n * 0.55), a: 0, wid: 0.3, len: 0.55, shape: 'saddle', color: c, warp: 0.5, jit: 0.1 });
      T({ type: 'blotch', t: [0.33, 0.97], count: Math.round(n * 0.55), phase: 0.5, a: 0.55, mirror: true, wid: 0.15, len: 0.5, shape: 'round', color: c, warp: 0.5, jit: 0.15 }); break;
    case 'ocelli': // big round dark spots on the back, pale-centred ones along the flanks (anacondas)
      // (v5.62: the back's spots are large paired ovals, the flank ocelli bigger)
      T({ type: 'blotch', count: Math.round(n * 0.9), a: 0.14, mirror: true, alt: true, wid: 0.17, len: 0.62, shape: 'round', color: c, warp: 0.4, jit: 0.2, sj: 0.25 });
      T({ type: 'blotch', count: Math.round(n * 1.3), a: 0.52, mirror: true, wid: 0.13, len: 0.4, shape: 'round', color: c, inner: { r: 0.6, color: a.oc || shade(b, 0.95) }, warp: 0.4, jit: 0.3, sj: 0.3 }); break;
    case 'uniform': break; // v5.58: one even colour from head to tail (smooth green snake): not even the darker tail of 'plain'
  }
  // optional extras on any pattern: a pale upper lip, a stripe along the flanks or the spine, a coloured tail tip or head
  if (a.lip) pat.push({ type: 'line', p0: [0.03, 0.5], p1: [1.15, 0.54], wid: 0.05, color: a.lip, mirror: true, aa: 0.4 });
  if (a.ls) T({ type: 'stripe', t: [0.03, 0.9], a: a.ls[1] != null ? a.ls[1] : 0.6, mirror: true, wid: a.ls[2] || 0.03, color: a.ls[0], aa: 0.35 });
  if (a.vs) T({ type: 'stripe', t: [0.03, 0.97], a: 0, wid: a.vs[1] || 0.03, color: a.vs[0], aa: 0.35 });
  if (a.tt) T({ type: 'tint', t: [a.tts || 0.86, 1], ramp: a.tts ? 0.01 : 0.06, color: a.tt, alpha: 0.95 }); // (v5.62: tts - where the tip colour starts; a death adder's lure is only the last few cm)
  // v5.62 (model accuracy): head and neck marks for generated species, in head lengths (xn) and round the head (a: 0 top,
  // ~0.56 the lip line, 1 the chin). es: a dark stripe from the snout through the eye to the jaw angle [colour, width,
  // from the snout too]; sp: a crown spearhead [colour]; ub: a dark mark under the eye [colour]; tb: bands across the
  // throat or neck [[colour, x0, x1, aMin], ...]; lb: dark bars between the lip scales [colour]
  { const hd = Object.assign({}, (PLANS[a.p] || PLANS.colubrid).head, a.h || {}), eX = hd.eyeX, eA = hd.eyeA / 180;
    if (a.es) { pat.push({ type: 'line', p0: [eX + 0.04, eA + 0.02], p1: [a.es[3] || 1.05, 0.6], wid: a.es[1] || 0.05, color: a.es[0], mirror: true, aa: 0.35, warp: 0.2 }); if (a.es[2]) pat.push({ type: 'line', p0: [0.06, eA + 0.04], p1: [eX - 0.03, eA], wid: (a.es[1] || 0.05) * 0.8, color: a.es[0], mirror: true, aa: 0.35, warp: 0.2 }); }
    if (Array.isArray(a.sp)) pat.push({ type: 'poly', mirror: true, warp: 0.3, color: a.sp[0], pts: [[eX - 0.02, 0], [eX + 0.15, 0.09], [0.85, 0.15], [1.25, 0.13], [a.sp[1] || 2.1, 0.11], [a.sp[1] || 2.1, 0.04], [1.25, 0.05], [0.9, 0.06], [eX + 0.15, 0.035], [eX + 0.08, 0]] });
    if (a.ub) pat.push({ type: 'poly', mirror: true, warp: 0.15, color: a.ub[0], pts: [[eX - 0.08, eA + 0.06], [eX + 0.08, eA + 0.06], [eX + (a.ub[1] || 0.12), 0.6], [eX - 0.06, 0.6]] });
    if (a.tb) for (const b of a.tb) pat.push({ type: 'hband', x0: b[1], x1: b[2], aMin: b[3] != null ? b[3] : 0.5, belly: true, color: b[0], xMax: b[2] + 0.5, warp: 0.25, alpha: b[4] || 1 });
  }
  if (a.hc) pat.push({ type: 'cap', x0: 0, x1: a.hcx || 1.0, wid: 0.62, color: a.hc });
  if (a.pat) for (const l of a.pat) pat.push(Object.assign({}, l));
  if (a.ck) pat.push({ type: 'checker', belly: true, color: a.ck === 1 ? '#161412' : a.ck, alpha: 0.85, skip: 0.15 }); // v5.19: chequered belly
  const colors = { dorsal: d, lateral: hexOf(mixc(hex(d), hex(b), 0.18)), belly: b, mottle: 0.08, var: 0.05 };
  if (a.t === 'speckle') { colors.speckle = { p: 0.16, color: c, k: 0.6 }; colors.mottle = 0.14; }
  if (a.t === 'coral') colors.lateral = d;
  const o = { name: p.name, plan: a.p, length: a.L, colors, pattern: pat, scene: { kind: a.s }, generated: x, details: [] };
  if (a.k) o.scales = { keel: 0.7 };
  else if (a.p === 'colubrid' || a.p === 'elapid') o.scales = { keel: 0 };
  if (a.o) o.body = { tail: 0.05 };
  // v4.72: the iris takes its group's typical eye colour (see IRIS), not a darker copy of the body
  if (a.p === 'blind') o.head = {};
  // v4.81: hand-checked details for well-known species (tools/auto_models.py CURATED): eye, head, scales, body, scene
  if (a.h) o.head = Object.assign(o.head || {}, a.h);
  if (a.lb) o.head = Object.assign(o.head || {}, { lips: 'barred', barColor: a.lb[0] }); // (v5.62: dark bars between the lip scales)
  if (a.cx) Object.assign(colors, a.cx);
  if (a.sx) o.scales = Object.assign(o.scales || {}, a.sx);
  if (a.bx) o.body = Object.assign(o.body || {}, a.bx);
  if (a.ps) o.pose = a.ps;
  if (a.sp && !Array.isArray(a.sp)) Object.assign(o.scene, a.sp); // (v5.73: sp is the scene's extras when an object, a crown spearhead when a list - the smooth green snake's grass colours drew a garbage-coloured spearhead down its neck)
  if (a.lat) colors.lateral = a.lat;
  if (a.tl) o.tail = a.tl;
  if (a.mx) o.max = a.mx; // v5.58: the longest recorded (said under the model, not shown)
  if (x.includes('l')) o.lengthNote = 'a typical size for its group - SnakeList has no measured length for this species yet';
  else if (fossil) o.lengthNote = 'estimated from its fossil bones';
  o.details = fossil ? [['back', 'Colours of its living relatives: fossils keep no colour']] : x.includes('g') ? [['back', 'Colours are a guess: no photo yet']] : [];
  return o;
}

// ---------- the snake: body profile functions ----------
// v5.62 (model accuracy): tail outlines, [fraction of the tail from its tip, width over the vent's] (1 = the tip itself)
const TAIL_SHAPES = {
  whip: [[0.7, 0.55], [0.4, 0.3], [0.12, 0.1], [1.01, 0]],
  abrupt: [[0.78, 0.48], [0.4, 0.24], [0.1, 0.1], [1.01, 0]],
  blunt: [[0.45, 0.94], [0.12, 0.8], [1.01, 0]],
  prehensile: [[0.6, 0.66], [0.25, 0.36], [0.06, 0.13], [1.01, 0]],
  lure: [[0.75, 0.42], [0.4, 0.2], [0.14, 0.1], [0.03, 0.065], [1.01, 0]],
};
function makeBodyFns(P, quality) {
  const L = P.length, B = P.body, Hd = P.head;
  const D = L / B.ld, w0 = (D / 2) * Math.sqrt(B.xs);     // half-width at the thickest point
  const Hl = Hd.len * L;
  const hw = Hd.w;                                          // head width relative to body width
  // width ratio (relative to w0) from snout tip (x=0) to tail tip (x=L)
  // head outline seen from above: 'tri' (vipers: straight sides widening to the jaw angles, then a sharp
  // step down to a thin neck), 'oval' (most other snakes: sides curve out quickly), 'blunt' (blind snakes)
  const shape = Hd.shape || 'oval', jaw = Hd.jaw, sn = Hd.snout;
  const mid = Hd.mid != null ? Hd.mid : shape === 'tri' ? lerp(sn, 1, (0.45 - 0.13) / (jaw - 0.13)) : shape === 'blunt' ? 1 : lerp(sn, 1, 0.72);
  const back = Hd.back != null ? Hd.back : shape === 'blunt' ? 1 : lerp(0.92, 0.8, (hw - B.neck) / Math.max(0.01, hw)) * (shape === 'tri' ? 0.9 : 1); // v5.28: viper heads end in a sharp step to the neck (v5.93: with rounded rear corners - the bulge of the temporal muscles and venom glands - easing into the neck: it was a hard step that read as a box on a stick)
  const neckLen = Hd.neckLen != null ? Hd.neckLen : shape === 'tri' ? 0.3 : 0.5;
  const tip = Hd.tip != null ? Hd.tip : shape === 'blunt' ? 0.75 : shape === 'tri' ? 0.66 : 0.55; // (v5.93: a viper's snout ends blunt and broad, not in a point)
  const pts = [
    [0, 0], [Hl * 0.012, hw * sn * tip], [Hl * 0.045, hw * sn * lerp(tip, 1, 0.6)], [Hl * 0.13, hw * sn],
    [Hl * 0.45, hw * mid], [Hl * jaw, hw], [Hl * 1.0, hw * back],
    [Hl * (1.0 + neckLen), Math.min(hw * back, B.neck)],
    [L * Math.max(B.peak, (Hl * 2.6) / L), 1], [L * (1 - B.tail), B.vent]];
  // v6.35 (preview): the forebody near its full girth early on (B.fore), so the neck reads as a neck and the body is not a cone
  if (B.fore) { const xn = Hl * (1.0 + neckLen), xf = Math.max(B.fore[0] * L, xn * 1.6), xp = pts[8][0]; if (xf < xp * 0.92) pts.splice(8, 0, [xf, clamp(B.fore[1], pts[7][1], 1)]); }
  if (B.blunt) pts.push([L * (1 - B.tail * 0.35), B.vent * 0.92], [L * (1 - B.tail * 0.06), B.vent * 0.7], [L, 0]);
  else if (P.tail.rattle) pts.push([L * (1 - B.tail * 0.5), B.vent * 0.62], [L, B.vent * 0.36]);
  else if (B.paddle) pts.push([L * (1 - B.tail * 0.5), B.vent * 0.42], [L * (1 - B.tail * 0.08), 0.18], [L, 0]);
  // v5.62 (model accuracy): the tail's taper by species - a whip (racers, vine and green snakes), abrupt behind the vent
  // (vipers), blunt (rubber and sand boas, kraits, bandy-bandies, pipe snakes), prehensile (tree boas and pythons, tree
  // vipers: thick and muscular almost to the tip) or a death adder's lure (abrupt, then a thin worm-like tip)
  else if (TAIL_SHAPES[B.tailShape]) for (const [f, w] of TAIL_SHAPES[B.tailShape]) pts.push(f >= 1 ? [L, 0] : [L * (1 - B.tail * f), B.vent * w]);
  else pts.push([L * (1 - B.tail * 0.55), B.vent * 0.5], [L * (1 - B.tail * 0.12), B.vent * 0.16], [L, 0]);
  // keep x strictly increasing
  for (let i = 1; i < pts.length; i++) if (pts[i][0] <= pts[i - 1][0]) pts[i][0] = pts[i - 1][0] + 1e-6 * L;
  const wr = pchip(pts); let xr = Hl * (Hd.tipR != null ? Hd.tipR : Hd.shape === 'blunt' ? 0.12 : Hd.shape === 'tri' ? 0.16 : 0.2);
  // v5.43: the dome at the snout tip is at least nearly as long as it is wide (half-width): a short dome on a broad snout
  // read as a flat round face, like the end of a cylinder
  { const capK = Hd.capK != null ? Hd.capK : shape === 'tri' ? 0.6 : 0.9; for (let i = 0; i < 4; i++) xr = Math.max(xr, Math.min(Hl * 0.45, capK * wr(xr) * w0)); }
  const rattleEnd = !!P.tail.rattle;
  // v5.62 (model accuracy): a cobra's hood - the long neck ribs swing out and flatten the neck into a broad disc behind the
  // head (body.hood {x0, xm, x1 in head lengths, w: widest width over the neck's, flat: its depth then}). It is spread in the
  // raised pose (pose.hood, default 0.85 of its full width), and only a little (hood.rest) when the cobra lies flat
  const hoodK = B.hood ? clamp((P.pose && P.pose.kind === 'raised' ? (P.pose.hood != null ? P.pose.hood : 0.85) : (B.hood.rest || 0)), 0, 1) : 0;
  const hoodB = (x) => { const h = B.hood, xn = x / Hl, x0 = h.x0 || 1.4, xm = h.xm || 3.2, x1 = h.x1 || 7; return sstep(x0, xm, xn) * (1 - sstep(xm + (x1 - xm) * 0.2, x1, xn)); };
  const hoodW = (x) => 1 + ((B.hood.w || 2.4) - 1) * hoodK * hoodB(x);
  const hoodXS = (x) => hoodW(x) / lerp(1, B.hood.flat || 0.5, hoodK * hoodB(x)); // (wider and flatter)
  const W = (x) => {
    let v = wr(x) * w0;
    // v5.12: the snout ends in a rounded dome (the rostral scale), not a point: within xr of the tip the outline is a
    // quarter ellipse, so seen from the front the head is round, with no flat plate or wedge under the snout
    if (x < xr) { const t = clamp(x / xr, 0, 1); v = wr(xr) * w0 * Math.sqrt(1 - (1 - t) * (1 - t)); }
    if (!rattleEnd) { const e = L - x, r = B.blunt || B.tailShape === 'blunt' ? w0 * (B.blunt ? 0.5 : 0.3) : w0 * (B.tipRound || 0.12); if (e < r) v *= Math.sqrt(clamp(e / r, 0, 1)); }
    if (hoodK) v *= hoodW(x);
    return Math.max(v, 0);
  };
  // height/width ratio: head (flattened), body, and a paddle-shaped tail for sea snakes
  const xsHead = 1 / Hd.h, xsBody = B.xs;
  const XS = (x) => {
    let k = lerp(xsHead, xsBody, shape === 'tri' ? sstep(Hl * 0.7, Hl * 1.3, x) : sstep(Hl * 0.75, Hl * 1.6, x)); // (v5.93: a viper's neck is round, not still flattened like the head - that pinched it into a waist under a hump)
    if (B.paddle) k = lerp(k, 0.2, sstep(L * (1 - B.tail * 1.4), L * (1 - B.tail * 0.6), x));
    if (B.tailFlat) k = lerp(k, k * (1 + B.tailFlat), sstep(L * (1 - B.tail * 1.6), L * (1 - B.tail * 0.5), x)); // v5.62: pipe snakes' flattened tail
    if (hoodK) k *= hoodXS(x);
    return k;
  };
  // the head's depth follows its own profile (low snout, flat crown), not its outline, so a broad
  // viper head does not bulge upward at the jaw angles; it then blends into the neck
  const headH = hw * w0 * Hd.h, snH = Hd.snoutH != null ? Hd.snoutH : 0.62;
  const Hh = (x) => {
    let h = W(x) / XS(x);
    if (x < Hl * (1 + neckLen)) {
      const tipF = x < xr ? Math.sqrt(clamp(W(x) / (wr(xr) * w0), 0, 1)) : 1; // (the dome is round from the side too)
      const cr = Hd.crown ? 1 + Hd.crown * Math.exp(-(((x / Hl - 0.68) / 0.3) ** 2)) : 1; // v6.20: the crown domed a little over the parietals, not a flat board
      const hd = headH * lerp(snH, 1, sstep(0, Hl * 0.55, x)) * tipF * cr;
      h = lerp(hd, h, sstep(Hl * 0.85, Hl * (1 + neckLen * 0.9), x));
    }
    if (B.paddle) { const e = L - x, r = w0 * 0.9; if (e < r) h *= Math.sqrt(clamp(e / r, 0, 1)); }
    return h;
  };
  // v5.31: the lower jaw's depth against the upper head's (vipers and pythons: a shallow jaw under a deep upper head),
  // blending into the body's belly depth along the neck
  const chin = Hd.chin != null ? Hd.chin : B.bf;
  const BF = (x) => lerp(chin * (shape === 'blunt' ? 1 : lerp(0.6, 1, sstep(0, Hl * 0.5, x))), B.bf, sstep(Hl * 0.8, Hl * (1 + neckLen), x)); // (the lower jaw thins towards the chin)
  return { L, D, w0, Hl, W, Hh, XS, bf: B.bf, BF, xr };
}

// ---------- pose: a 2D centre line on the ground (x from snout to tail) ----------
function makePose(P, F, seed) {
  const L = F.L, N = 900, ds = L / (N - 1), R = rng(seed), pose = P.pose || {};
  const maxW = (x) => F.W(x);
  let wMax = 0; for (let i = 0; i < 60; i++) wMax = Math.max(wMax, maxW((i / 59) * L));
  function overlaps(pts) {
    // any two parts of the body that are far apart along it but closer than their half-widths add up to
    const step = 3, n = pts.length;
    for (let i = 0; i < n; i += step) {
      const wi = maxW(i * ds);
      for (let j = i + step; j < n; j += step) {
        const wj = maxW(j * ds), along = (j - i) * ds;
        if (along < (wi + wj) * 2.6) continue;
        const dx = pts[i][0] - pts[j][0], dz = pts[i][1] - pts[j][1], lim = (wi + wj) * 1.12 + wMax * 0.05;
        if (dx * dx + dz * dz < lim * lim) return true;
      }
    }
    return false;
  }
  let pts = null, special = null;
  // v5.62 (model accuracy): a cobra standing up (the forebody raised, hood spread) and a tree boa or python draped over a branch
  if (pose.kind === 'raised') special = raisedPose(P, F, pose, R, N, ds, wMax);
  else if (pose.kind === 'drape') special = drapePose(P, F, pose, R, N, ds, wMax);
  if (special) pts = special.pts;
  else if (pose.kind === 'coil') {
    // a loose flat coil: the tail in the middle, the forebody leaving the outer turn, head resting forward
    const lead = pose.lead != null ? pose.lead : 0.3;
    for (let pitchK = pose.pitch || 2.35; pitchK < 6 && !pts; pitchK += 0.25) {
      const pitch = wMax * pitchK, b = pitch / TAU, out = [];
      let r = pitch * (pose.inner || 0.75), th = 0, x = L;
      const coilLen = L * (1 - lead);
      let px = r, pz = 0, s = 0, heading;
      const tailPts = [];
      // tail tip first: walk outwards along the spiral
      const wob = pose.wobble != null ? pose.wobble : 0.35, ph0 = R() * TAU, sq = 1 - (pose.squash != null ? pose.squash : 0.1);
      while (s < coilLen) {
        tailPts.push([Math.cos(th) * r, Math.sin(th) * r * sq]);
        // a real coil is not a perfect spiral: the spacing between turns varies
        const dth = ds / Math.sqrt(r * r + b * b); th += dth; r += b * dth * (1 + wob * Math.sin(th * 1.6 + ph0)); s += ds;
      }
      // forebody: keep turning, but less and less, then a gentle head bend
      let cx = Math.cos(th) * r, cz = Math.sin(th) * r * sq;
      heading = Math.atan2(Math.cos(th) * r * sq, -Math.sin(th) * r) + Math.atan2(b, r);
      const k0 = 1 / r, kEnd = (pose.headBend || -0.6) / (L * lead);
      const nLead = Math.round((L * lead) / ds);
      for (let i = 0; i < nLead; i++) {
        tailPts.push([cx, cz]);
        const f = i / nLead, k = lerp(k0 * 0.75, 0, sstep(0, 0.55, f)) + kEnd * sstep(0.55, 1, f) * 2;
        heading += k * ds; cx += Math.cos(heading) * ds; cz += Math.sin(heading) * ds;
      }
      const p = tailPts.reverse().slice(0, N);
      while (p.length < N) p.push(p[p.length - 1]);
      if (!overlaps(p)) pts = p;
    }
  } else if (pose.kind !== 'stack') {
    // a sine-generated curve: the classic resting/crawling S-shape of a snake
    // v5.62 (model accuracy): the species' seed varies the curve (it was the same S for every generated colubrid and elapid)
    const vary = pose.fixed || P.generated == null ? 0 : 1, rW = R(), rA = R(), rP = R(), rB = R();
    const waves = pose.waves || clamp(L / (wMax * 2 * 14), 1.2, 3.2) * (1 + vary * (rW - 0.5) * 0.35);
    let amp = ((pose.amp || 62 * (1 + vary * (rA - 0.5) * 0.3)) * Math.PI) / 180;
    const bend = ((pose.bend || 50) * Math.PI) / 180 * (vary && rB < 0.5 && pose.bend == null ? -1 : 1), ph = pose.phase != null ? pose.phase : 0.15 + vary * (rP - 0.5) * 0.5;
    for (let tries = 0; tries < 14 && !pts; tries++, amp *= 0.9) {
      const p = []; let x = 0, z = 0;
      for (let i = 0; i < N; i++) {
        p.push([x, z]);
        const s = i * ds, f = s / L;
        // the head end is calmer than the body: the neck holds a gentle curve
        const a = amp * lerp(0.55, 1, sstep(0, 0.2, f)) * lerp(1, 0.75, sstep(0.75, 1, f));
        const hdg = a * Math.sin(TAU * (waves * f + ph)) + bend * f;
        x += Math.cos(hdg) * ds; z += Math.sin(hdg) * ds;
      }
      if (!overlaps(p)) pts = p;
    }
  }
  let stacked = false;
  if (pose.kind === 'stack') {
    // a resting pile: the tail end is laid down first as a tight spiral whose turns touch, then the
    // forebody leaves the outer turn and swings back across the coil, so the neck and head rest on top
    const pitch = wMax * 2 * (pose.pitch || 1.08), b = pitch / TAU, out = [];
    let r = pitch * (pose.inner || 0.9), th = R() * TAU, s = 0;
    const coilLen = L * (1 - (pose.lead != null ? pose.lead : 0.32)), sq = 1 - (pose.squash != null ? pose.squash : 0.12);
    const wob = pose.wobble != null ? pose.wobble : 0.25, ph0 = R() * TAU;
    // v6.20: a real pile is not a lathe-turned disc - the turns follow a lumpy, slightly oval outline (the same for every turn, so
    // neighbouring turns are scaled alike and never cut into each other); the line is made
    // finely, then laid out again at the body's even steps
    const pK = pose.pitch || 1.08, lumpA = pose.lumpy != null ? pose.lumpy : Math.max(0, Math.min(0.06, (1 - 1 / pK) / 1.5 + 0.005)), lp1 = R() * TAU, lp2 = R() * TAU, lump = (t) => 1 + lumpA * (Math.sin(2 * t + lp1) + 0.5 * Math.sin(3 * t + lp2)); // (about 1 on average - the pile keeps its turns - and never pinched by more than the slack between the turns)
    { const fine = []; let sl = 0, lx = null, lz = null;
      while (sl < coilLen) { const g = lump(th), px = Math.cos(th) * r * g, pz = Math.sin(th) * r * sq * g; if (lx != null) sl += Math.hypot(px - lx, pz - lz); fine.push([px, pz]); lx = px; lz = pz; const dth = ds * 0.5 / Math.sqrt(r * r + b * b); th += dth; r += b * dth * (1 + wob * Math.sin(th * 1.3 + ph0)); }
      const n = Math.max(3, Math.round(coilLen / ds)); for (const q of resample(fine, n, ds)) out.push(q); s = coilLen; r *= lump(th); }
    let cx = out[out.length - 1][0], cz = out[out.length - 1][1];
    const a0 = out[out.length - 2]; let heading = Math.atan2(cz - a0[1], cx - a0[0]);
    const nLead = N - out.length, tight = pose.tight || 0.6, bendEnd = (pose.headBend || 0) / (L * 0.1);
    for (let i = 0; i < nLead; i++) {
      out.push([cx, cz]);
      const f = i / nLead;
      // keep curling the same way but tighter than the coil, so the forebody crosses back over it;
      // the neck straightens and the head ends with a slight turn
      const k = lerp(1 / r, 1 / (r * tight), sstep(0.05, 0.3, f)) * (1 - sstep(0.7, 0.95, f)) + bendEnd * sstep(0.9, 1, f);
      heading += k * ds; cx += Math.cos(heading) * ds; cz += Math.sin(heading) * ds;
    }
    pts = out.reverse().slice(0, N); stacked = true;
  }
  if (!pts) { pts = []; for (let i = 0; i < N; i++) pts.push([i * ds, 0]); }
  // centre the footprint at the origin
  let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
  for (const p of pts) { mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mnz = Math.min(mnz, p[1]); mxz = Math.max(mxz, p[1]); }
  const cx = (mnx + mxx) / 2, cz = (mnz + mxz) / 2, rot = (pose.rot || 0) * Math.PI / 180;
  for (const p of pts) { const x = p[0] - cx, z = p[1] - cz; p[0] = x * Math.cos(rot) - z * Math.sin(rot); p[1] = x * Math.sin(rot) + z * Math.cos(rot); }
  if (special && special.N) for (const n of special.N) { const x = n[0], z = n[2]; n[0] = x * Math.cos(rot) - z * Math.sin(rot); n[2] = x * Math.sin(rot) + z * Math.cos(rot); } // (v5.62)
  if (special && special.drape) { const d = special.drape, tr = (u, v) => { const x = u - cx, z = v - cz; return [x * Math.cos(rot) - z * Math.sin(rot), x * Math.sin(rot) + z * Math.cos(rot)]; }; d.a = tr(d.u0, 0); d.b = tr(d.u1, 0); }
  const at = (x) => { const f = clamp(x / ds, 0, N - 1.0001), i = Math.floor(f), t = f - i; return [lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)]; };
  // a slight lift of the head and neck off the ground (in head heights)
  const lift = (pose.lift != null ? pose.lift : 0.35) * F.Hh(F.Hl * 0.6) * 2, liftLen = F.Hl * (pose.liftLen || 2.6);
  // drape: wherever the body crosses a part laid down before it (the tail end is laid first), it rests
  // on top of it; the rise and fall are smoothed so the body bends over the coil like a real one
  const E = new Float32Array(N);
  if (stacked) {
    const H = new Float32Array(N), Wd = new Float32Array(N);
    for (let i = 0; i < N; i++) { H[i] = F.Hh(i * ds); Wd[i] = F.W(i * ds); }
    const cell = wMax * 2, grid = new Map(), key = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
    for (let i = 0; i < N; i += 2) { const k = key(pts[i][0], pts[i][1]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
    const need = new Float32Array(N);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = N - 1; i >= 0; i--) {
        let m = 0; const p = pts[i], gx = Math.floor(p[0] / cell), gz = Math.floor(p[1] / cell);
        for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
          const l = grid.get((gx + ox) + ',' + (gz + oz)); if (!l) continue;
          for (const j of l) {
            if (j <= i + 2 || (j - i) * ds < (Wd[i] + Wd[j]) * 3) continue; // only parts laid earlier (nearer the tail), and not its own neighbourhood
            const d = Math.hypot(p[0] - pts[j][0], p[1] - pts[j][1]), rr = (Wd[i] + Wd[j]) * 0.98; if (d >= rr) continue;
            const top = E[j] + H[j] * F.bf + (H[j] + H[i] * F.bf) * Math.sqrt(1 - (d / rr) ** 2) - H[i] * F.bf;
            if (top > m) m = top;
          }
        }
        need[i] = m;
        E[i] = Math.max(m, pass ? E[i] : 0);
      }
      // slope limit, then smoothing that never sinks below what is needed
      const sl = (pose.slope || 0.55) * ds;
      for (let i = 1; i < N; i++) E[i] = Math.max(E[i], E[i - 1] - sl);
      for (let i = N - 2; i >= 0; i--) E[i] = Math.max(E[i], E[i + 1] - sl);
      for (let it = 0; it < 30; it++) for (let i = 1; i < N - 1; i++) E[i] = Math.max(need[i], (E[i - 1] + E[i] * 2 + E[i + 1]) / 4);
    }
    // v5.83: the head rests on top of the coil, not down in the hole in its middle (where it lay hidden behind the turns, so
    // the first view of a coiled rattlesnake or viper often missed its head): when the head ends up over the coil, the head
    // and neck are raised to the top of the turns under it, the neck sloping down to where the forebody lies
    const iT = Math.round(N * (pose.lead != null ? pose.lead : 0.32)), hN = Math.max(2, Math.round(F.Hl * 0.6 / ds));
    let ccx = 0, ccz = 0, nc = 0; for (let i = iT; i < N; i++) { ccx += pts[i][0]; ccz += pts[i][1]; nc++; } ccx /= nc; ccz /= nc;
    let rOut = 0, top = 0; for (let i = iT; i < N; i++) { rOut = Math.max(rOut, Math.hypot(pts[i][0] - ccx, pts[i][1] - ccz) + Wd[i]); top = Math.max(top, E[i] + H[i] * (1 + F.bf)); }
    const hx = pts[hN][0], hz = pts[hN][1];
    if (Math.hypot(hx - ccx, hz - ccz) < rOut * 0.92) {
      const want = top - H[hN] * F.bf + H[hN] * 0.15, k1 = Math.round(F.Hl * 1.1 / ds), k2 = Math.round(F.Hl * 4.5 / ds);
      for (let i = 0; i < Math.min(N, k2); i++) E[i] = Math.max(E[i], want * (1 - sstep(k1, k2, i)));
      const sl = (pose.slope || 0.55) * ds; for (let i = 1; i < N; i++) E[i] = Math.max(E[i], E[i - 1] - sl);
    }
  }
  if (special) E.set(special.E);
  const eAt = (x) => { const f = clamp(x / ds, 0, N - 1.0001), i = Math.floor(f), t = f - i; return lerp(E[i], E[i + 1], t); };
  // v5.35: tree snakes lie along a branch above the ground (see addBranch)
  const perch = pose.kind === 'branch' ? (pose.perch != null ? pose.perch : clamp(L * 0.55, 0.45, 1.1)) : 0; // (v5.68: up in a shrub or tree)
  // v5.83: a real branch is not level: it droops towards its thin end (past the head) and rises gently into the tree,
  // with a slight bow along the way - and the snake lying on it follows it
  const bY = perch ? (x) => { const f = clamp(x / L, 0, 1); return -Math.min(0.1, L * 0.06) * (1 - f) * (1 - f) + Math.min(0.025, L * 0.014) * Math.sin(f * 5.1 + 0.6); } : null;
  const Ly = special ? eAt : (x) => lift * (1 - sstep(F.Hl * 0.7, liftLen, x)) + eAt(x) + perch + (bY ? bY(x) : 0);
  // (v5.62: a draped snake's 'up' at each point is away from the branch, so the belly lies on it)
  const upAt = special && special.N ? (x) => { const f = clamp(x / ds, 0, N - 1.0001), i = Math.floor(f), t = f - i, a = special.N[i], b = special.N[i + 1]; return new THREE.Vector3(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)).normalize(); } : null;
  return { pts, at, Ly, bY, ds, N, stacked, perch, upAt, raised: !!(special && special.raised), drape: special && special.drape };
}

// ---------- v5.62 (model accuracy): special resting poses ----------
// resample a polyline at equal steps ds (n points), carrying on straight past its end
function resample(line, n, ds) {
  const out = [[line[0][0], line[0][1]]]; let i = 1, px = line[0][0], pz = line[0][1], need = ds;
  while (out.length < n) {
    if (i >= line.length) { const a = line[line.length - 2], b = line[line.length - 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, l = out[out.length - 1]; out.push([l[0] + (b[0] - a[0]) / d * ds, l[1] + (b[1] - a[1]) / d * ds]); continue; }
    const q = line[i], d = Math.hypot(q[0] - px, q[1] - pz);
    if (d >= need) { const t = need / d; px += (q[0] - px) * t; pz += (q[1] - pz) * t; out.push([px, pz]); need = ds; }
    else { need -= d; px = q[0]; pz = q[1]; i++; }
  }
  return out;
}
// an outward spiral of length len (tail end at its centre), points about ds apart, from (0,0) round the origin
function spiralLine(len, ds, pitch, r0, sqx, sqz, R, wob, th0) {
  const b = pitch / TAU, out = []; let r = r0, th = th0 != null ? th0 : R() * TAU, s = 0; const ph0 = R() * TAU;
  while (s < len * 1.3) { out.push([Math.cos(th) * r * sqx, Math.sin(th) * r * sqz]); const dth = (ds * 0.5) / Math.sqrt(r * r + b * b); th += dth; r += b * dth * (1 + wob * Math.sin(th * 1.6 + ph0)); s += ds * 0.5; }
  return out;
}
// a cobra or rinkhals standing its ground: the last two thirds lie in a loose coil, the forebody rises from its outer turn
// almost upright (pose.incl degrees), the neck bends forward and the head is held level, facing out over the coil
function raisedPose(P, F, pose, R, N, ds, wMax) {
  const L = F.L, Hl = F.Hl, hood = P.body.hood || {}, xR = clamp(Math.max(L * (pose.rise || 0.25), Hl * ((hood.x1 || 7) + 2.5)), Hl * 5, L * 0.42);
  const nR = Math.min(N - 40, Math.round(xR / ds)), nG = N - nR, inc = ((pose.incl || 74) * Math.PI) / 180;
  let wB = 0; for (let i = 0; i <= 40; i++) wB = Math.max(wB, F.W(L * (0.3 + 0.7 * i / 40))); wMax = wB; // (the body's width, not the spread hood's)
  // the coil on the ground (tail at its centre), its outer end where the body rises
  const pitch = wMax * 2 * (pose.pitch || 1.25), sp = spiralLine(nG * ds, ds, pitch, pitch * (pose.inner || 0.8), 1, 1 - (pose.squash || 0.08), R, 0.2);
  const ground = resample(sp, nG, ds).reverse(); // index 0: the outer end (the base of the raised part)
  const a = ground[0], b = ground[3], th = Math.atan2(a[1] - b[1], a[0] - b[0]) + (pose.turn || 0.5); // facing on round the coil, a little outward
  // the inclination along the raised part (radians; positive: rising toward the head), from the base up to the snout
  const phi = (x) => { const up = 1 - sstep(xR - Hl * 3.2, xR, x), neck = sstep(Hl * 1.05, Hl * 2.9, x); return lerp(-0.08, inc, neck) * up; };
  const pts = new Array(N), E = new Float32Array(N); pts[nR] = ground[0].slice(); E[nR] = 0;
  for (let i = 0; i < nG; i++) { pts[nR + i] = ground[i]; E[nR + i] = 0; }
  for (let i = nR - 1; i >= 0; i--) { const f = phi((i + 0.5) * ds), c = Math.cos(f); pts[i] = [pts[i + 1][0] + Math.cos(th) * c * ds, pts[i + 1][1] + Math.sin(th) * c * ds]; E[i] = E[i + 1] + Math.sin(f) * ds; }
  return { pts, E, raised: true };
}
// a tree boa or python resting on a horizontal branch: a flat coil, longer across the branch than along it, folded over
// the branch so its loops hang down on both sides in saddles, the head resting on top in the middle. The fold is a true
// unrolling (over a cylinder, then straight down), so the body keeps its length. pts: x along the branch, z across it
function drapePose(P, F, pose, R, N, ds, wMax) {
  const L = F.L, rB = clamp(F.w0 * (pose.branchK || 1.1), 0.008, 0.03), cOff = F.Hh(L * 0.45) * F.bf, Rr = rB + cOff;
  const pitch = wMax * 2 * (pose.pitch || 1.02);
  // the coil: head at its centre, walking outward; a rounder centre, loops longer across the branch
  // v5.83: the tail is tucked in the middle of the coil and the body spirals outward; the neck leaves the outer loop and
  // comes back across the top of the coil, the head resting level on the loops in the middle - the way a real emerald
  // tree boa or green tree python sits (the head used to curl into the middle, rolled onto its side by the fold)
  const r0 = pitch * (pose.inner || 0.75), sqx = pose.sqx || 1.0, sqz = pose.sqz || 1.5, Lh = Math.min(L * 0.17, F.Hl * 2.8), m = Math.max(F.W(L * 0.2) * 2.2, pitch * 0.9);
  const aMax = 1.95, q1 = aMax * Rr; // (how far round the branch each hanging side hugs it - see the fold below)
  let tailFirst, nLead = Math.round((Lh + m * 1.6) / ds);
  if (pose.spiral) { // (the v5.83 flat spiral, kept for poses that ask for it)
    const Ls = L - Lh - (Math.PI / 2) * m, wSeed = Math.floor(R() * 4294967295); let th0 = 0, sp0 = null; // (one draw from the species' own numbers, as before)
    for (let it = 0; it < 4; it++) { // (the coil's outer end on the far side of the branch's middle line, heading across it)
      sp0 = resample(spiralLine(Ls, ds, pitch, r0, sqx, sqz, rng(wSeed), 0.12, th0), Math.round(Ls / ds), ds);
      const e = sp0[sp0.length - 1], ang = Math.atan2(e[1] / sqz, e[0] / sqx); th0 -= Math.atan2(Math.sin(ang), Math.cos(ang));
    }
    tailFirst = sp0.slice(); { const e = sp0[sp0.length - 1], f = sp0[sp0.length - 2], tl = Math.hypot(e[0] - f[0], e[1] - f[1]) || 1, t0 = [(e[0] - f[0]) / tl, (e[1] - f[1]) / tl];
      const sg = t0[1] >= 0 ? 1 : -1, E2 = [e[0] - m, e[1] + sg * m], mm = m * 1.6;
      for (let k = 1; k <= 24; k++) { const t = k / 24, h00 = 2 * t * t * t - 3 * t * t + 1, h10 = t * t * t - 2 * t * t + t, h01 = -2 * t * t * t + 3 * t * t, h11 = t * t * t - t * t; tailFirst.push([e[0] * h00 + t0[0] * mm * h10 + E2[0] * h01 - mm * h11, e[1] * h00 + t0[1] * mm * h10 + E2[1] * h01]); }
      for (let k = 1; k <= 40; k++) tailFirst.push([E2[0] - (Lh * 1.2 * k) / 40, E2[1]]); }
  } else {
    // v5.88: the saddle real green tree pythons and emerald tree boas sit in. Laid flat, the body runs back and forth across the
    // branch (x along it, z across), each crossing next to the last and joined to it by a U-turn; folded over the branch every
    // crossing becomes a loop draped evenly over it, the U-turns hanging side by side at the same depth on both sides. The tail
    // starts low on one side; the last crossing stops on top, and the neck turns along the top of the loops so the head rests
    // in the middle of the coil (a flat spiral folded over the branch gave a few deep, round, nested loops hanging low)
    // (v6.26: each U-turn tight - its two sides lie against each other, as a resting coil's do - and hanging less deep: with
    // a gap of more than a body width inside every U, the loops read as closed rings threaded on the branch, not a body
    // resting in saddles over it)
    const eX = pitch * 0.08, rU = pitch / 2 + eX, hangMax = Math.max(L * 0.032, wMax * 2 * 1.25); // (each loop hangs only a little below the branch; eX: each crossing runs a little slantwise, so the U-turns below are rounder than the gap between crossings on top)
    let n = 2, Z = 0, Lead = Lh, Lc = 0;
    for (let it = 0; it < 3; it++) {
      Lc = L - Lead - (Math.PI / 2) * m;
      for (n = 2; n < 12; n++) { Z = (Lc - n * Math.PI * rU + m) / (2 * n + 1); if (Z <= q1 + hangMax) break; }
      Lead = clamp((n * pitch) / 2 + F.Hl * 0.6, F.Hl * 2, Lh * 1.15); // (the head ends over the middle of the coil)
    }
    nLead = Math.round((Lead + m * 1.6) / ds);
    const pts0 = [], st = ds * 0.5, line = (x0, z0, x1, z1) => { const l = Math.hypot(x1 - x0, z1 - z0), k = Math.max(1, Math.ceil(l / st)); for (let i = 1; i <= k; i++) pts0.push([lerp(x0, x1, i / k), lerp(z0, z1, i / k)]); };
    const Rz = rng(strSeed(P.name || 'drape') + 3), Zk = []; for (let k = 0; k <= n; k++) Zk.push(Z * (0.88 + 0.24 * Rz())); // (no two loops hang exactly alike)
    let x = 0, sgn = 1; pts0.push([eX, -Zk[0]]);
    for (let k = 0; k < n; k++) {
      line(x + eX, -sgn * Zk[k], x - eX, sgn * Zk[k + 1]); // a crossing, slantwise over the branch
      const cx = x + pitch / 2, k2 = Math.max(6, Math.ceil((Math.PI * rU) / st)); // the U-turn, hanging on the far side
      for (let i = 1; i <= k2; i++) { const a = Math.PI - (i / k2) * Math.PI; pts0.push([cx + Math.cos(a) * rU, sgn * (Zk[k + 1] + Math.sin(a) * rU * 0.7)]); }
      x += pitch; sgn = -sgn;
    }
    line(x + eX, -sgn * Zk[n], x, -sgn * m); // the last crossing, up onto the top
    // the neck turns along the top of the loops, back over the middle of the coil
    const e = pts0[pts0.length - 1], t0 = [0, sgn], E2 = [e[0] - m, 0], mm = m * 1.6;
    for (let k = 1; k <= 24; k++) { const t = k / 24, h00 = 2 * t * t * t - 3 * t * t + 1, h10 = t * t * t - 2 * t * t + t, h01 = -2 * t * t * t + 3 * t * t, h11 = t * t * t - t * t; pts0.push([e[0] * h00 + t0[0] * mm * h10 + E2[0] * h01 - mm * h11, e[1] * h00 + t0[1] * mm * h10 + E2[1] * h01]); }
    for (let k = 1; k <= 40; k++) pts0.push([E2[0] - (Lead * 1.3 * k) / 40, 0]);
    const xc = (n * pitch) / 2; tailFirst = pts0.map((q) => [q[0] - xc, q[1]]); // (the coil centred on the branch's middle)
  }
  const flat = resample(tailFirst.reverse(), N, ds);
  // v5.88: the loops saddle the branch the way real ones do - the coil is longer along the branch than across it (more, shallower
  // saddles side by side, not a few deep round loops), and each hanging side keeps hugging the branch round past its widest
  // point before it falls, tucked in under it (they used to drop straight down from the branch's sides, low and round)
  const bl = Rr * 1.6, fall = (d) => { // the hanging part, d past the end of the wrap: [hz, y, beta]
    let hz = Rr * Math.sin(aMax), y = Rr * Math.cos(aMax), b = aMax; const n = Math.max(2, Math.ceil(Math.min(d, bl) / (bl / 16)));
    const dd = Math.min(d, bl) / n; for (let k = 0; k < n; k++) { const tm = (k + 0.5) * dd; b = aMax + (Math.PI / 2 - aMax) * sstep(0, bl, tm); hz += Math.cos(b) * dd; y -= Math.sin(b) * dd; }
    if (d > bl) { b = Math.PI / 2; y -= d - bl; } return [hz, y, b]; };
  let hang = 0; for (const p of flat) { const sv = Math.abs(p[1]); if (sv > q1) hang = Math.max(hang, -fall(sv - q1)[1] - Rr); }
  // v5.68: up in a tree - the branch at a real perching height (about 0.5-1.3 m), never just off the ground
  const hB = Math.max(hang + Rr + F.Hh(L * 0.5) * 2 + L * 0.03, clamp(L * 0.65, 0.5, 1.3));
  const pts = new Array(N), E = new Float32Array(N), Nn = new Array(N);
  for (let i = 0; i < N; i++) {
    const u = flat[i][0], v = flat[i][1], sg = v < 0 ? -1 : 1, s = Math.abs(v), q = (Math.PI / 2) * Rr;
    let hz, y, n;
    if (s <= q1) { const al = s / Rr; hz = Rr * Math.sin(al); y = hB + Rr * Math.cos(al); n = [0, Math.cos(al), sg * Math.sin(al)]; }
    else { const f2 = fall(s - q1); hz = f2[0]; y = hB + f2[1]; n = [0, Math.cos(f2[2]), sg * Math.sin(f2[2])]; }
    const x = i * ds; pts[i] = [u, sg * hz]; E[i] = y - F.Hh(x) * F.BF(x); Nn[i] = n;
  }
  { // the head and neck rest on top of the loops that cross under them (and ease down onto the branch where none do)
    const need = new Float32Array(N), Y = new Float32Array(N); for (let i = 0; i < N; i++) Y[i] = E[i] + F.Hh(i * ds) * F.BF(i * ds);
    for (let i = 0; i < Math.min(N, nLead + 20); i++) {
      let m = Y[i]; const wi = F.W(i * ds);
      for (let j = i + 20; j < N; j += 2) { const wj = F.W(j * ds), d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]), rr = (wi + wj) * 1.05; if (d < rr) m = Math.max(m, Y[j] + (F.Hh(j * ds) + F.Hh(i * ds)) * F.bf * Math.sqrt(1 - (d / rr) ** 2)); }
      need[i] = m;
    }
    const nn = Math.min(N, nLead + 20), Z = need.slice(0, nn);
    for (let it = 0; it < 3; it++) { for (let i = 1; i < nn; i++) Z[i] = Math.max(Z[i], Z[i - 1] - ds * 0.5); for (let i = nn - 2; i >= 0; i--) Z[i] = Math.max(Z[i], Z[i + 1] - ds * 0.5); }
    const hd = Math.max(...Z.slice(0, Math.round(Lh * 0.6 / ds))); // (the head itself held level)
    for (let i = 0; i < nn; i++) { const k = 1 - sstep(Lh * 0.45, Lh * 0.7, i * ds); Z[i] = Math.max(Z[i], lerp(Z[i], hd, k)); }
    for (let it = 0; it < 20; it++) for (let i = 1; i < nn - 1; i++) Z[i] = Math.max(need[i], (Z[i - 1] + Z[i] * 2 + Z[i + 1]) / 4);
    for (let i = 0; i < nn; i++) { const w = 1 - sstep(nn - 20, nn, i); E[i] = lerp(E[i], Z[i] - F.Hh(i * ds) * F.BF(i * ds), w); if (i < nLead) Nn[i] = [0, 1, 0]; }
  }
  let u0 = 1e9, u1 = -1e9; for (const p of pts) { u0 = Math.min(u0, p[0]); u1 = Math.max(u1, p[0]); }
  return { pts, E, N: Nn, drape: { hB, rB, u0, u1 } };
}

// v5.68: tree snakes live up in a real tree: a trunk rising from the ground, the branch they lie on growing out of it
// (it used to be a branch lying on the forest floor). One bark material per tree, drawn once.
function barkMaterial(P, seed) {
  const R = rng(seed + 5), col = P.scene.barkColor || '#6b5a47';
  const map = canvasTex(256, (x, S) => {
    x.fillStyle = col; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) { const y = R() * S, w = 2 + R() * 7, len = S * (0.2 + R() * 0.6), x0 = R() * S; x.fillStyle = R() < 0.6 ? 'rgba(20,14,8,' + (0.18 + R() * 0.3) + ')' : 'rgba(255,240,215,' + (0.06 + R() * 0.1) + ')'; x.fillRect(x0, y, len, w * 0.35); } // furrows along the wood
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(' + (R() < 0.5 ? '70,90,40' : '120,120,90') + ',' + (0.08 + R() * 0.12) + ')'; x.beginPath(); x.ellipse(R() * S, R() * S, 4 + R() * 14, 3 + R() * 8, 0, 0, TAU); x.fill(); } // moss and lichen
  });
  return new THREE.MeshStandardMaterial({ color: '#ffffff', map, bumpMap: map, bumpScale: 0.6, roughness: 0.95 });
}
// a tube along points whose radius follows rad(t), t 0..1 along it (bark repeated along its length)
function woodTube(pts, rad, mat, seg, radial, repLen) {
  const curve = new THREE.CatmullRomCurve3(pts), tg = new THREE.TubeGeometry(curve, seg, 1, radial, false), pa = tg.attributes.position, tmp = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) { const t = i / seg, c = curve.getPointAt(t), r = rad(t); for (let j = 0; j <= radial; j++) { const q = i * (radial + 1) + j; tmp.fromBufferAttribute(pa, q).sub(c).multiplyScalar(r).add(c); pa.setXYZ(q, tmp.x, tmp.y, tmp.z); } }
  tg.computeVertexNormals();
  const uv = tg.attributes.uv, k = curve.getLength() / repLen; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * 2);
  const m = new THREE.Mesh(tg, mat); m.castShadow = m.receiveShadow = true; return m;
}
// leaves in a few loose clusters (instanced, a few dozen at most)
function leafClusters(g, centres, size, seed, cols) {
  const R = rng(seed + 9), per = 18, im = new THREE.InstancedMesh(leafGeometry(), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.8 }), centres.length * per);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), c = new THREE.Color(); let n = 0;
  for (const [cp, rr] of centres) for (let i = 0; i < per; i++) {
    pv.set((R() - 0.5) * 2, (R() - 0.3) * 1.2, (R() - 0.5) * 2).multiplyScalar(rr).add(cp); e.set((R() - 0.5) * 1.2, R() * TAU, (R() - 0.5) * 1.2); q.setFromEuler(e);
    const sz = size * (0.7 + R() * 0.6); sv.set(sz, sz, sz * 0.45); m4.compose(pv, q, sv); im.setMatrixAt(n, m4); c.set(cols[n % cols.length]).multiplyScalar(0.85 + R() * 0.3); im.setColorAt(n, c); n++;
  }
  im.castShadow = true; im.receiveShadow = true; g.add(im);
}
// the trunk: from just under the ground up past the branch it carries (root flare at the foot, tapering, leaning a little),
// with an upper limb or two going on up out of the view, and leaves
function addTrunk(g, P, base, hJoin, rT, seed, bark, away) {
  const R = rng(seed + 13), top = hJoin + Math.max(1.1, hJoin * 0.9), lean = new THREE.Vector3((R() - 0.5) * 0.12, 0, (R() - 0.5) * 0.12);
  const pts = []; for (let k = 0; k <= 8; k++) { const f = k / 8, y = -0.08 + (top + 0.08) * f; pts.push(new THREE.Vector3(base.x + lean.x * f * top + Math.sin(f * 5 + seed) * rT * 0.3, y, base.z + lean.z * f * top + Math.cos(f * 4 + seed) * rT * 0.3)); }
  const trunkAt = (y) => { const f = clamp((y + 0.08) / (top + 0.08), 0, 1); return new THREE.Vector3(base.x + lean.x * f * top + Math.sin(f * 5 + seed) * rT * 0.3, y, base.z + lean.z * f * top + Math.cos(f * 4 + seed) * rT * 0.3); };
  g.add(woodTube(pts, (t) => rT * lerp(1, 0.45, t) * (1 + 0.7 * Math.pow(1 - clamp(t * (top + 0.08) / 0.35, 0, 1), 2.5)), bark, 64, 16, rT * 6));
  // roots spreading into the ground
  for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + R() * 0.8, d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); g.add(woodTube([base.clone().setY(0.06), base.clone().addScaledVector(d, rT * 1.6).setY(0.015), base.clone().addScaledVector(d, rT * 3.2).setY(-0.02)], (t) => rT * 0.4 * (1 - t * 0.8), bark, 10, 8, rT * 4)); }
  // upper limbs going on up out of the picture, with leaves
  const leaves = [];
  for (let k = 0; k < 2; k++) {
    const y0 = hJoin + (top - hJoin) * (0.35 + k * 0.35), o = trunkAt(y0), a = Math.atan2(away.z, away.x) + Math.PI * (k ? 0.7 : -0.6) + (R() - 0.5) * 0.5, d = new THREE.Vector3(Math.cos(a), 0.9, Math.sin(a)).normalize(), len = 0.6 + R() * 0.5;
    const e = o.clone().addScaledVector(d, len); g.add(woodTube([o, o.clone().addScaledVector(d, len * 0.5).add(new THREE.Vector3(0, len * 0.05, 0)), e], (t) => rT * 0.32 * (1 - t * 0.75), bark, 16, 8, rT * 5));
    leaves.push([e, 0.16], [o.clone().addScaledVector(d, len * 0.65), 0.12]);
  }
  leaves.push([trunkAt(top), 0.2]);
  leafClusters(g, leaves, 0.07 * (P.scene.leafSize || 1), seed, ['#4f7a2e', '#5f8a35', '#3f6626', '#6c9440']);
  return trunkAt;
}
// v5.62 (model accuracy): the straight, level branch a tree boa or python is draped over.
// v5.68: it grows out of a tree trunk at one end and runs on, level, to a thin leafy tip at the other
function addDrapeBranch(P, F, pose, seed) {
  const d = pose.drape, g = new THREE.Group(); let A = new THREE.Vector3(d.a[0], d.hB, d.a[1]), B = new THREE.Vector3(d.b[0], d.hB, d.b[1]);
  { // the trunk stands at the end of the branch away from the first view (drapeAz in mount), so it is seen behind the snake
    const az = Math.atan2(-(d.b[1] - d.a[1]), d.b[0] - d.a[0]) + 0.45, cd = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
    if (B.clone().sub(A).dot(cd) > 0) { const t = A; A = B; B = t; }
  }
  const dir = B.clone().sub(A).normalize(), span = A.distanceTo(B), rB = d.rB, bark = barkMaterial(P, seed);
  const tipL = Math.max(span * 0.45, 0.45), gap = Math.max(span * 0.3, 0.22), rT = clamp(rB * 3.2, 0.06, 0.16);
  const base = B.clone().addScaledVector(dir, gap + rT).setY(0), hJoin = d.hB - Math.min(0.12, d.hB * 0.12);
  const trunkAt = addTrunk(g, P, base, hJoin, rT, seed, bark, dir.clone().negate());
  const J = trunkAt(hJoin), tipE = A.clone().addScaledVector(dir, -tipL).add(new THREE.Vector3(0, -tipL * 0.08, 0));
  // from the thin tip, level under the snake, then curving down a little into the trunk
  const pts = [tipE, A.clone().addScaledVector(dir, -tipL * 0.55), A, B, B.clone().addScaledVector(dir, gap * 0.55).add(new THREE.Vector3(0, -(d.hB - hJoin) * 0.35, 0)), J];
  const curve = new THREE.CatmullRomCurve3(pts), total = curve.getLength(), uTip = (tipL * 0.98) / total, uB = (tipL + span) / total;
  g.add(woodTube(pts, (t) => rB * (t < uTip ? lerp(0.45, 1, t / uTip) : t > uB ? lerp(1, 1.5, (t - uB) / (1 - uB)) : 1) * (1 + 0.03 * Math.sin(t * 53)), bark, 140, 12, rB * 8)); // (full thickness under the coils, so they rest on it with no gap)
  // a twig and leaves near the tip
  const tw = A.clone().addScaledVector(dir, -tipL * 0.75), td = new THREE.Vector3(-dir.z, 0.6, dir.x).normalize(), te = tw.clone().addScaledVector(td, 0.18);
  g.add(woodTube([tw, tw.clone().addScaledVector(td, 0.09), te], (t) => rB * 0.3 * (1 - t * 0.7), bark, 8, 6, rB * 8));
  leafClusters(g, [[tipE, 0.08], [te, 0.08]], 0.06 * (P.scene.leafSize || 1), seed + 1, ['#4f7a2e', '#5f8a35', '#3f6626', '#6c9440']);
  g.userData.noRig = true; g.name = 'tree';
  // where prey can sit on the branch: the level part beyond the snake, towards the tip (used by See it eat)
  g.userData.perch = { a: A.clone().setY(d.hB + rB), dir: dir.clone().negate(), len: tipL * 0.6, rB };
  return g;
}
// v5.35: the branch a tree snake lies along: it follows the snake's line just under its belly and reaches past its head
// to a thin tip, with a few side twigs. v5.68: past its tail it curves into a tree trunk standing on the ground
function addBranch(P, F, pose, seed) {
  // v5.50: a real branch, 2-6 cm thick (thinner towards its tip), not one scaled to the snake
  const R = rng(seed + 77), L = F.L, h = pose.perch, rB = clamp(F.w0 * 1.5, 0.011, 0.03), g = new THREE.Group(), bark = barkMaterial(P, seed);
  const pt = (x) => { const a = pose.at(clamp(x, 0, L)); return new THREE.Vector3(a[0], h - rB * 0.92, a[1]); };
  const dirAt = (x0, x1) => pt(x1).sub(pt(x0)).setY(0).normalize();
  const pts = [], d0 = dirAt(F.Hl * 0.5, 0), d1 = dirAt(L * 0.9, L);
  const reachH = Math.max(F.Hl * 3, L * 0.35), gap = Math.max(0.2, L * 0.12), rT = clamp(rB * 3.5, 0.05, 0.12);
  for (let k = 6; k >= 1; k--) pts.push(pt(0).addScaledVector(d0, reachH * k / 6).add(new THREE.Vector3(0, -reachH * 0.03 * (k / 6) ** 2, 0)));
  for (let k = 0; k <= 40; k++) pts.push(pt((k / 40) * L));
  const base = pt(L).addScaledVector(d1, gap + rT).setY(0), hJoin = h - rB - Math.min(0.1, h * 0.1);
  const trunkAt = addTrunk(g, P, base, hJoin, rT, seed, bark, d1.clone().negate());
  pts.push(pt(L).addScaledVector(d1, gap * 0.5).add(new THREE.Vector3(0, -(h - rB - hJoin) * 0.4, 0)), trunkAt(hJoin));
  const curve = new THREE.CatmullRomCurve3(pts), n = 160, uH = reachH / curve.getLength();
  g.add(woodTube(pts, (t) => rB * (t < uH ? lerp(0.35, 1, t / uH) : lerp(1, 1.25, (t - uH) / (1 - uH))) * (1 + 0.06 * Math.sin(t * 61)), bark, n, 10, rB * 8));
  // side twigs, angled away from the snake, some with leaves
  const lv = [[pts[0], 0.07]];
  for (let k = 0; k < 5; k++) {
    const t = 0.12 + R() * 0.7, c = curve.getPointAt(t), T = curve.getTangentAt(t), side = new THREE.Vector3(-T.z, 0, T.x).multiplyScalar(R() < 0.5 ? 1 : -1);
    const dir = side.addScaledVector(T, 0.6).add(new THREE.Vector3(0, 0.3 + R() * 0.4, 0)).normalize(), len = rB * (8 + R() * 10);
    const cg = new THREE.CylinderGeometry(rB * 0.12, rB * 0.45, len, 6); cg.translate(0, len / 2, 0);
    const tw = new THREE.Mesh(cg, bark); tw.position.copy(c).addScaledVector(dir, rB * 0.5); tw.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); tw.castShadow = true; g.add(tw);
    if (k % 2 === 0) lv.push([c.clone().addScaledVector(dir, len), 0.05]);
  }
  leafClusters(g, lv, 0.055 * (P.scene.leafSize || 1), seed + 2, ['#4f7a2e', '#5f8a35', '#3f6626', '#6c9440']);
  g.userData.noRig = true; g.name = 'tree';
  g.userData.perch = { a: pt(0).setY(h), dir: d0.clone(), len: reachH * 0.7, rB };
  return g;
}

// ---------- the body mesh (snout, head, neck, body and tail are one seamless sweep) ----------
// girth units: distance along the body measured in circumferences, so scales and markings keep
// a natural size as the body narrows (scale rows around the body are constant in real snakes)
function girthOf(F) {
  const L = F.L, NX = 6000, xs = new Float64Array(NX), gs = new Float64Array(NX);
  let Cmax = 0; const circ = (x) => { const a = F.W(x), b = F.Hh(x); return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))); };
  for (let i = 0; i < 40; i++) Cmax = Math.max(Cmax, circ((i / 39) * F.Hl));
  let g = 0;
  for (let i = 0; i < NX; i++) { const x = (i / (NX - 1)) * L; xs[i] = x; if (i) g += (L / (NX - 1)) / Math.max(circ(x - L / (NX - 1) / 2), Cmax * 0.32); gs[i] = g; }
  const gOf = (x) => { const f = clamp(x / L, 0, 1) * (NX - 1), i = Math.min(NX - 2, Math.floor(f)); return lerp(gs[i], gs[i + 1], f - i); };
  const xOf = (gv) => { let lo = 0, hi = NX - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (gs[m] < gv) lo = m; else hi = m; } const t = (gv - gs[lo]) / Math.max(1e-12, gs[hi] - gs[lo]); return lerp(xs[lo], xs[hi], clamp(t, 0, 1)); };
  return { gTotal: g, gOf, xOf, circ };
}
function buildBody(P, F, pose, quality) {
  const L = F.L, M = quality === 'low' ? 48 : 96;
  const NX = 6000, xs = new Float64Array(NX), gs = new Float64Array(NX);
  let Cmax = 0; const circ = (x) => { const a = F.W(x), b = F.Hh(x); return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))); };
  for (let i = 0; i < 40; i++) Cmax = Math.max(Cmax, circ((i / 39) * F.Hl));
  let g = 0;
  for (let i = 0; i < NX; i++) { const x = (i / (NX - 1)) * L; xs[i] = x; if (i) g += (L / (NX - 1)) / Math.max(circ(x - L / (NX - 1) / 2), Cmax * 0.32); gs[i] = g; }
  const gTotal = g;
  const gOf = (x) => { const f = clamp(x / L, 0, 1) * (NX - 1), i = Math.min(NX - 2, Math.floor(f)); return lerp(gs[i], gs[i + 1], f - i); };
  const xOf = (gv) => { let lo = 0, hi = NX - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (gs[m] < gv) lo = m; else hi = m; } const t = (gv - gs[lo]) / Math.max(1e-12, gs[hi] - gs[lo]); return lerp(xs[lo], xs[hi], clamp(t, 0, 1)); };
  // rings: equal steps in girth units, so quads keep their shape everywhere
  const nR0 = clamp(Math.round(gTotal * M / 2.2), 220, quality === 'low' ? 900 : 2400);
  let ringX = []; for (let i = 0; i < nR0; i++) ringX.push(xOf((i / (nR0 - 1)) * gTotal));
  ringX[0] = 0; ringX[nR0 - 1] = L;
  // v5.12: extra rings over the rounded snout tip (they bunch up towards the tip, where the dome curves fastest)
  { const xt = Math.max(F.Hl * 0.26, F.xr * 1.15), extra = []; for (let k = 1; k < 20; k++) extra.push(xt * (1 - Math.cos((k / 20) * Math.PI / 2))); ringX = [0].concat(extra, ringX.filter((x) => x >= xt)); }
  const nR = ringX.length;

  const Hd = P.head, eyeA = (Hd.eyeA * Math.PI) / 180, mouthA = Math.PI * 0.56;
  const bumps = [];
  if (Hd.brow) bumps.push({ x: Hd.eyeX * F.Hl, xs: F.Hl * 0.16, th: eyeA - 0.42, ts: 0.32, amp: Hd.brow, mirror: true });
  if (Hd.pits === 'loreal') bumps.push({ x: F.Hl * ((0.075 + Hd.eyeX - 0.06) / 2 + 0.01), xs: F.Hl * 0.025, th: Math.PI * Math.min(0.47, ((Hd.nostrilA != null ? Hd.nostrilA / 180 : 0.44) + Hd.eyeA / 180) / 2 + 0.06), ts: 0.06, amp: -0.05, mirror: true }); // (v5.53: between the nostril and the eye, above the lip scales)
  // heat pits only where the species has them: one loreal pit (pit vipers), a row in the lip scales (pythons)
  if (Hd.pits === 'labial') for (let k = 0; k < 5; k++) bumps.push({ x: F.Hl * (0.03 + k * 0.06), xs: F.Hl * 0.016, th: Math.PI * (k ? 0.52 : 0.2), ts: 0.05, amp: -0.05, mirror: true });
  bumps.push({ x: F.Hl * (Hd.nostrilX || 0.07), xs: F.Hl * nostrilR(P), th: Hd.nostrilA != null ? (Hd.nostrilA * Math.PI) / 180 : Math.PI * 0.44, ts: 0.06, amp: -0.035, mirror: true }); // v5.28: on the side of the snout near the tip // nostril (upward-facing in water snakes)
  // v5.30: the hognose's upturned, keeled rostral: a narrow ridge rising at the snout tip
  if (Hd.snoutUp) { bumps.push({ x: F.Hl * 0.04, xs: F.Hl * 0.06, th: 0, ts: 0.9, amp: Hd.snoutUp * 0.45 }); bumps.push({ x: F.Hl * 0.05, xs: F.Hl * 0.06, th: 0, ts: 0.35, amp: Hd.snoutUp * 0.35 }); }
  // v5.30: vipers - a sharp canthus ridge from the eye to the snout, a ledge (supraocular) over each eye, and cheeks that
  // bulge at the jaw angles over the venom glands
  if ((Hd.shape || 'oval') === 'tri') {
    const eX = Hd.eyeX * F.Hl;
    bumps.push({ x: eX, xs: F.Hl * 0.1, th: eyeA - 0.3, ts: 0.12, amp: 0.05, mirror: true });
    // v5.93: the jowls - the cheeks swell low on each side towards the back of the head, over the venom glands and the jaw
    // muscles, so the head is wider at the lips than at the crown there (a trapezoid from behind, a broad triangle from above)
    bumps.push({ x: F.Hl * 0.8, xs: F.Hl * 0.2, th: Math.PI * 0.43, ts: 0.42, amp: Hd.jowl != null ? Hd.jowl : 0.07, mirror: true });
  }
  // v6.20 (head silhouettes): the cheeks - the jaw muscles swell low on each side at the back of the head, so from above
  // the head widens to the angle of the jaw and from behind it is broader at the lips than at the crown (vipers have their
  // jowls above); and the loreal hollow - the side of the snout dips in between nostril and eye, under the canthus ridge,
  // so the head is not a smooth bar of soap from the front
  if (Hd.cheek && (Hd.shape || 'oval') !== 'tri') bumps.push({ x: F.Hl * Math.min(0.86, (Hd.jaw || 0.75) * 1.02), xs: F.Hl * 0.17, th: Math.PI * 0.5, ts: 0.42, amp: Hd.cheek, mirror: true });
  if (Hd.lor && Hd.pupil !== 'none') bumps.push({ x: F.Hl * (0.1 + Hd.eyeX) * 0.5, xs: F.Hl * Math.max(0.05, (Hd.eyeX - 0.1) * 0.3), th: eyeA + 0.04, ts: 0.2, amp: -Hd.lor, mirror: true });
  const nTop = (x) => lerp(Hd.canthus * ((Hd.shape || 'oval') === 'tri' ? 1.35 : 1), 2.15, sstep(F.Hl * 0.8, F.Hl * 1.6, x)); // (v5.30: vipers' crowns flat; v5.93: the crown's edges rounder - at 1.7 the head was a box)
  // v4.81: an eye socket - the skin dips gently where the eye sits, so the domed eye under its clear
  // spectacle scale lies flush with the head (never standing out of its outline)
  const eyeX0 = Hd.eyeX * F.Hl, eyeRad = eyeRadOf(P, F), eyeRl = (F.W(eyeX0) + F.Hh(eyeX0)) / 2;
  if (Hd.pupil !== 'none') bumps.push({ x: eyeX0, xs: eyeRad * 1.1, th: eyeA, ts: (eyeRad * 1.1) / eyeRl, amp: -(eyeRad * 0.27 * (Hd.sockK || 1)) / eyeRl, mirror: true, sock: true }); // (v5.58: a little wider and deeper, so the whole round eye shows; v5.62: eye size from eyeRadOf)

  // spine point & frame at x
  // v5.09: towards the snout tip the centre line keeps the height it has a little further back (it used to dip to the
  // ground with the shrinking head, tilting the last cross-sections forward: the top of the snout jutted out over the
  // chin and left a wedge/notch at the front of the jaw)
  const xa = F.Hl * 0.1, hX = (x) => (x < 2 * xa ? xa + (x * x) / (4 * xa) : x);
  const spine = (x) => { const p = pose.at(x); return new THREE.Vector3(p[0], F.Hh(hX(x)) * F.BF(hX(x)) + pose.Ly(x), p[1]); };
  const frameAt = (x) => {
    const e = Math.max(L * 0.0015, 1e-5), a = spine(Math.max(0, x - e)), b = spine(Math.min(L, x + e));
    const T = b.sub(a).normalize(), n0 = pose.upAt ? pose.upAt(x) : new THREE.Vector3(0, 1, 0); const U = n0.addScaledVector(T, -T.dot(n0)).normalize(); // (v5.62: a draped body's up is away from the branch)
    const S = new THREE.Vector3().crossVectors(T, U).normalize(); return { T, U, S };
  };
  const upK = Hd.upturn || 0, upL = F.Hl * (Hd.upLen || 0.4), upH = F.Hh(F.Hl * 0.5);
  // the cross-section point at x and angle th (0 = top of the back, +/-pi = belly midline)
  // v5.83: as a function of th for one x (ringAt), so everything that depends only on x - the outline's splines, the bumps
  // near that x - is worked out once per ring, not once per vertex (it was most of the time spent building the body)
  const triH = Hd.shape === 'tri', blunt = P.body.blunt ? 0 : 1, ridge = P.body.ridge || 0, btri = P.body.tri || 0, taper = Hd.taper || 0.2;
  const ringAt = (x, noSock) => {
    const W = F.W(x), H = F.Hh(x), BFx = F.BF(x);
    const bodyF = sstep(F.Hl * 1.3, F.Hl * 2.6, x) * (1 - sstep(L * 0.86, L * 0.99, x)); // (v5.34: body shape away from head and tail tip)
    const n0 = triH ? 2.7 : 2.3, nUp = nTop(x), nDn = 3.0 + 0.7 * bodyF * blunt, nk = sstep(0, F.Hl * (triH ? 0.12 : 0.2), x); // v5.28: a squarer snout from the front in vipers // v5.17: the nose is a smooth round dome (no box edges meeting in a crease at the chin)
    const pUp = 2 / lerp(n0, nUp, nk), pDn = 2 / lerp(n0, nDn, nk);
    const jawK = lerp(0.9, 1, sstep(F.Hl * 0.75, F.Hl * 1.1, x)), tapK = taper * (1 - sstep(F.Hl * 0.85, F.Hl * 1.25, x)), triK = btri * 0.45 * bodyF, ridK = ridge * bodyF;
    const bl = []; for (const b of bumps) { const dx = (x - b.x) / b.xs; if (Math.abs(dx) > 3 || (noSock && b.sock)) continue; bl.push(b, b.amp * Math.exp(-dx * dx)); }
    const mouthK = x < F.Hl * Hd.jaw * 1.1 && x > F.Hl * 0.02 ? 0.03 * (Hd.lipK || 1) /* v5.53: a fine crease (a deep one read as a separate shell) */ * sstep(F.Hl * 0.1, F.Hl * 0.26, x) /* v5.12: the lip line fades out over the rounded snout tip */ * (1 - sstep(F.Hl * Hd.jaw * 0.85, F.Hl * Hd.jaw * 1.1, x)) : 0;
    const upF = upK && x < upL ? upK * upH * (1 - sstep(0, upL, x)) : 0;
    return (th) => {
      const st = Math.sin(th), ct = Math.cos(th), pw = ct >= 0 ? pUp : pDn;
      let sx = Math.sign(st) * Math.abs(st) ** pw, sy = Math.sign(ct) * Math.abs(ct) ** pw;
      // v5.09: the lower jaw narrows smoothly from the side of the head towards the chin (it used to step in by 14% right at
      // the side line, which left a notch - a little triangle - at the front of the jaw under the snout)
      // (v5.83: both fade out smoothly behind the head - they used to stop at 1.05 head lengths, a step all round the neck that
      // showed as a dark ring behind the head)
      if (ct < 0) { sy *= BFx; if (jawK < 1) sx *= lerp(1, jawK, sstep(0, 0.7, -ct)); } // (v5.27: the lower jaw tucked in under the upper one)
      if (ct > 0 && tapK) sx *= 1 - tapK * sy;
      // v5.34: snakes are flat underneath (above), most have a low ridge along the spine, and tree snakes and kraits a
      // slightly triangular body - sides sloping in to the ridge
      if (ct > 0 && triK) sx *= 1 - triK * sy * sy;
      let k = 1 + (ridK ? ridK * Math.exp(-((th / 0.2) ** 2)) : 0);
      for (let i = 0; i < bl.length; i += 2) {
        const b = bl[i], dth1 = Math.atan2(Math.sin(th - b.th), Math.cos(th - b.th));
        let e = Math.exp(-((dth1 / b.ts) ** 2)); if (b.mirror) { const dth2 = Math.atan2(Math.sin(th + b.th), Math.cos(th + b.th)); e += Math.exp(-((dth2 / b.ts) ** 2)); }
        k += bl[i + 1] * e;
      }
      if (mouthK) { const dm = Math.min(Math.abs(Math.abs(th) - mouthA), 1); k -= mouthK * Math.exp(-((dm / 0.07) ** 2)); } // the mouth line
      // v5.43: an upturned rostral (hognose snakes): the front of the snout is lifted, its top more than its underside, so
      // the narrow snout tip points forward and up like a shovel, with the chin left low beneath it
      if (upF) return [W * sx * k, H * sy * k + upF * (ct >= 0 ? 1 : lerp(1, 0.3, -ct))];
      return [W * sx * k, H * sy * k];
    };
  };
  const section = (x, th, noSock) => ringAt(x, noSock)(th);

  const nV = nR * (M + 1), pos = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), hd = new Float32Array(nV), met = new Float32Array(nV * 3);
  const plates = 1; // v5.53: every head has its own scales (headData): the body's scale relief fades out on it
  const frames = [];
  for (let i = 0; i < nR; i++) {
    const x = ringX[i], c = spine(x), f = frameAt(x), ring = ringAt(x); frames.push({ x, c, f });
    const v = gOf(x) / gTotal, cx = circ(x), headW = (1 - plates) * (1 - sstep(F.Hl * 0.82, F.Hl * 1.18, x));
    for (let j = 0; j <= M; j++) {
      const u = j / M, th = TAU * u - Math.PI, s = ring(th), k = (i * (M + 1) + j);
      pos[k * 3] = c.x + f.S.x * s[0] + f.U.x * s[1]; pos[k * 3 + 1] = c.y + f.S.y * s[0] + f.U.y * s[1]; pos[k * 3 + 2] = c.z + f.S.z * s[0] + f.U.z * s[1];
      uv[k * 2] = u; uv[k * 2 + 1] = v; hd[k] = plates * hdFade(x, th, F.Hl) * (Math.abs(th) < Math.PI * 0.62 ? 1 : 0.85);
      // v4.81: true distances on the skin (around, along) for the small head scales drawn in the shader
      met[k * 3] = (u - 0.5) * cx; met[k * 3 + 1] = x; met[k * 3 + 2] = headW;
    }
  }
  const idx = [];
  for (let i = 0; i < nR - 1; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('aHead', new THREE.BufferAttribute(hd, 1)); geo.setAttribute('aMet', new THREE.BufferAttribute(met, 3));
  geo.setIndex(nV > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  // seam (belly midline) and the two tips: make the normals continuous
  const nrm = geo.attributes.normal.array;
  for (let i = 0; i < nR; i++) {
    const a = i * (M + 1), b = a + M; for (let q = 0; q < 3; q++) { const m = (nrm[a * 3 + q] + nrm[b * 3 + q]) / 2; nrm[a * 3 + q] = nrm[b * 3 + q] = m; }
  }
  for (const [i, sgn] of [[0, -1], [nR - 1, 1]]) { const T = frames[i].f.T; for (let j = 0; j <= M; j++) { const k = i * (M + 1) + j; nrm[k * 3] = T.x * sgn; nrm[k * 3 + 1] = T.y * sgn; nrm[k * 3 + 2] = T.z * sgn; } }
  // smooth the normals of the rings next to the tips toward the cap direction
  geo.attributes.normal.needsUpdate = true;
  geo.computeBoundingBox(); geo.computeBoundingSphere();

  const surf = (x, th, noSock) => { const c = spine(x), f = frameAt(x), s = section(x, th, noSock); return { p: c.clone().addScaledVector(f.S, s[0]).addScaledVector(f.U, s[1]), f }; };
  const surfNormal = (x, th) => {
    const e = 0.02, a = surf(x, th - e).p, b = surf(x, th + e).p, dx = F.Hl * 0.02, c = surf(Math.max(0, x - dx), th).p, d = surf(x + dx, th).p;
    return new THREE.Vector3().crossVectors(b.sub(a), d.sub(c)).normalize();
  };
  const occS = occSpheres(F, spine), xr = new Float32Array(nV); for (let i = 0; i < nR; i++) xr.fill(ringX[i], i * (M + 1), (i + 1) * (M + 1));
  geo.setAttribute('aOcc', new THREE.BufferAttribute(bakeOcc(F, occS, pos, nrm, xr), 2));
  return { geo, gTotal, gOf, xOf, nR, M, ringX, spine, frameAt, section, ringAt, surf, surfNormal, eyeA, mouthA, eyeRad, eyeRl, occS };
}

// v6.26 (contact and coil shading): where one part of the body lies against another - turns of a coil resting on each other,
// a loop crossing the body - the skin there sees little of the sky, so it gets little of the soft light from all round (it
// lit those gaps as brightly as the open back: coils looked pasted together, not resting one on another). Worked out once
// per pose on the CPU, per vertex, from a chain of spheres along the body (the occlusion of a sphere seen from a point on a
// surface is (r/d)^2 x cos). aOcc = (how much is hidden, the body's own radius there); the shader adds the ground's share
// itself from the height of the skin above it, so that part follows the body when it moves.
function occSpheres(F, spine) {
  const L = F.L, ds = Math.max(F.w0 * 0.6, L / 1500), xs = [], cs = [], rs = [];
  for (let x = F.Hl * 0.3; x < L; x += ds) { const r = (F.W(x) + F.Hh(x)) / 2; if (r < F.w0 * 0.12) continue; const c = spine(x); xs.push(x); cs.push(c.x, c.y, c.z); rs.push(r); }
  return { xs: Float32Array.from(xs), cs: Float32Array.from(cs), rs: Float32Array.from(rs), ds, rMax: Math.max(1e-6, ...rs) };
}
function bakeOcc(F, S, pos, nrm, xv) { const t0 = performance.now(), o = bakeOcc0(F, S, pos, nrm, xv); perfT('occ', t0); return o; }
function bakeOcc0(F, S, pos, nrm, xv) {
  const n = xv.length, out = new Float32Array(n * 2), { xs, cs, rs, ds, rMax } = S, N = xs.length, cell = rMax * 9;
  const grid = new Map(), key = (i, j, k) => (i * 73856093) ^ (j * 19349663) ^ (k * 83492791);
  for (let s = 0; s < N; s++) { const kk = key(Math.floor(cs[s * 3] / cell), Math.floor(cs[s * 3 + 1] / cell), Math.floor(cs[s * 3 + 2] / cell)); let a = grid.get(kk); if (!a) grid.set(kk, (a = [])); a.push(s); }
  const cand = [], skip = []; let lastX = -1;
  for (let v = 0; v < n; v++) {
    const x = xv[v], rv = Math.max(F.W(x), F.Hh(x), 1e-6); out[v * 2 + 1] = (F.W(x) + F.Hh(x)) / 2;
    const px = pos[v * 3], py = pos[v * 3 + 1], pz = pos[v * 3 + 2];
    if (x !== lastX) { // (the candidate spheres are found once per ring: those near the ring's centre, not its own neighbours along the body)
      lastX = x; cand.length = 0;
      const gi = Math.floor(px / cell), gj = Math.floor(py / cell), gk = Math.floor(pz / cell);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const l = grid.get(key(gi + a, gj + b, gk + c)); if (l) for (const s of l) {
        if (Math.abs(xs[s] - x) <= (rv + rs[s]) * 2.6) continue;
        const dx = cs[s * 3] - px, dy = cs[s * 3 + 1] - py, dz = cs[s * 3 + 2] - pz, rr = 2.2 * rv + 4 * rs[s]; if (dx * dx + dy * dy + dz * dz < rr * rr) cand.push(s); } } // (only spheres that can reach some point of this ring)
    }
    if (!cand.length) continue;
    if (v & 1 && v + 1 < n && xv[v - 1] === x && xv[v + 1] === x) { skip.push(v); continue; } // (every other point round a ring: filled in between its neighbours below)
    const nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2]; let sum = 0;
    for (const s of cand) {
      const dx = cs[s * 3] - px, dy = cs[s * 3 + 1] - py, dz = cs[s * 3 + 2] - pz, r = rs[s], d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 16 * r * r) continue;
      const d = Math.sqrt(d2) || 1e-6, c = (nx * dx + ny * dy + nz * dz) / d; if (c <= 0) continue;
      sum += Math.min(1, (r * r) / d2) * c * (1 - sstep(2.6 * r, 4 * r, d)) * Math.min(1, ds / (1.6 * r));
    }
    out[v * 2] = Math.min(0.82, 1 - Math.exp(-1.6 * sum));
  }
  for (const v of skip) out[v * 2] = (out[v * 2 - 2] + out[v * 2 + 2]) / 2;
  return out;
}

// ---------- v5.83: the sculpted head ----------
// The front of the snake (snout tip to just behind the jaws) is its own, much finer mesh, sculpted instead of painted:
// every head scale of the species' layout (headLayout: rostral, internasals, prefrontals, frontal, supraoculars,
// parietals, nasal, loreal, pre- and postoculars, temporals, the upper and lower lip scales, mental and chin shields - or
// the small, overlapping and keeled scales of vipers and pythons) is a raised plate with a real groove round it; the
// nostrils and heat pits are real hollows with a rim; the brow (supraocular) stands out over the eye; and the upper and
// lower jaws are separate surfaces that meet along the lip line - the upper lip scales swell a little and roll in over the
// lower ones, as in a real snake - so the mouth opens with no cut and a fine shadowed lip line shows when it is shut. It
// uses the body's own material and attributes, so it bends, shades and takes the pattern exactly as the body does; the
// body's own coarser rings there are simply not drawn (drawRange). The sculpting (headSkinHeights) does not depend on the
// pose, so it is done in the pattern worker, while the loading cover is up.
// v6.20: where the head's own scales give way to the body's (aHead): over a fifth of a head length, further back along
// the crown than on the throat - real head shields end in a V at the nape; a straight ring all round read as a helmet
function hdFade(x, th, Hl) { const t = 1 - Math.abs(th) / Math.PI; return (1 - sstep(Hl * (0.84 + 0.14 * t), Hl * (1.02 + 0.14 * t), x)); }
function headSkinGrid(F, xCut, M, hi) {
  const NX = hi ? 220 : 140, Mh = M * (hi ? 4 : 5), mA = Math.PI * 0.56, uA = (Math.PI - mA) / TAU, uB = (Math.PI + mA) / TAU, cols = [];
  // columns round the head: an even grid, plus the mouth line on each side twice (the upper and the lower jaw's edge)
  for (let j = 0; j <= Mh; j++) { const u = j / Mh; if (Math.abs(u - uA) < 0.4 / Mh || Math.abs(u - uB) < 0.4 / Mh) continue; cols.push({ u, s: Math.abs(TAU * u - Math.PI) > mA ? -1 : 1 }); }
  cols.push({ u: uA, s: -1 }, { u: uA, s: 1 }, { u: uB, s: 1 }, { u: uB, s: -1 });
  cols.sort((p, q) => p.u - q.u); // (stable: each mouth-line pair keeps its order - lower jaw, then upper, on the left; upper, then lower, on the right)
  const xs = []; for (let k = 0; k <= NX; k++) xs.push(xCut * Math.pow(k / NX, 1.3)); // (rings bunched towards the snout tip)
  return { NX, nC: cols.length, cols, xs, xCut };
}
// the height of the sculpted skin over the smooth head at every vertex of the grid (in metres, along the normal)
function headSkinHeights(P, F, G) {
  const Hl = F.Hl, H = P.head, { NX, nC, cols, xs, xCut } = G, nV = (NX + 1) * nC;
  const Lo = headLayout(P, F, eyeOf(P, F)), { seeds, hc, J, wrapA } = Lo, mAa = Lo.mA, fd = new Float32Array(nV), d1 = new Float32Array(nV), id1 = new Int32Array(nV).fill(-1);
  // the scales: a weighted Voronoi tiling of the layout's scales (as headData does for the textures); the small scales are
  // diamonds (|dx| + |da|), as the real overlapping ones lie - round cells in staggered rows left straight rings of groove
  let cMid = 0; while (cMid < nC && cols[cMid].u < 0.5 - 1e-9) cMid++;
  let b1 = 0, b2 = 0, i1 = -1, xT = 0, aT = 0, lowT = false, jawT = false;
  const test = (s) => { if (jawT && s.low !== lowT) return; const da = wrapA(aT - s.a) / s.ra; if (da > 2.6 || da < -2.6) return; const dx = (xT - s.x) / s.rx; let d;
    if (s.small) { const l1 = (Math.abs(dx) + Math.abs(da)) * 0.8; d = l1 * l1; } else d = dx * dx + da * da;
    if (d < b1) { b2 = b1; b1 = d; i1 = s.id; } else if (d < b2) b2 = d; };
  for (let k = 1; k <= NX; k++) {
    const x = xs[k], bigC = [], sm = []; xT = x; jawT = x < J * Hl * 1.02;
    for (const s of seeds) { if (Math.abs(x - s.x) > s.rx * 2.6) continue; if (!s.small) bigC.push(s); else { sm.push([s.a, s]); if (s.a < -0.5) sm.push([s.a + 2, s]); if (s.a > 0.5) sm.push([s.a - 2, s]); } }
    sm.sort((p, q) => p[0] - q[0]); let wR = 0; for (const e of sm) wR = Math.max(wR, e[1].ra * 2.6);
    let lo = 0;
    for (let ci = cMid; ci < nC; ci++) {
      aT = 2 * cols[ci].u - 1; lowT = cols[ci].s < 0; b1 = b2 = 1e9; i1 = -1;
      for (let q = 0; q < bigC.length; q++) test(bigC[q]);
      while (lo < sm.length && sm[lo][0] < aT - wR) lo++;
      for (let q = lo; q < sm.length && sm[q][0] <= aT + wR; q++) test(sm[q][1]);
      const o1 = k * nC + ci, o2 = k * nC + (nC - 1 - ci), f0 = b2 > 1e8 ? 9 : Math.sqrt(b2) - Math.sqrt(b1);
      fd[o1] = fd[o2] = f0; d1[o1] = d1[o2] = Math.sqrt(b1); id1[o1] = id1[o2] = i1;
    }
  }
  // heights: plates raised and gently domed, with a soft groove round each; small scales overlapping backwards, some keeled
  // (head.headGeo: how strong; by default from head.headRelief - smooth, glossy shields in green snakes, crisp ones in vipers)
  const rel = H.headGeo != null ? H.headGeo : P.plan === 'blind' ? 0.3 /* (blind snakes: smooth, glassy shields - earthworm-like, not tiled) */ : H.headRelief != null ? clamp(0.4 + 1.5 * H.headRelief, 0.45, 1) : 1, step = xCut / NX, plates = Lo.plates;
  const Ap = Hl * 0.005 * rel, gwP = Math.max(GW * Hl * 1.1, step * 1.4), /* v6.20: finer, shallower sutures - the head shields read as carved wood, not smooth glossy plates */ xh = Hl * (H.jaw || 0.75) * 1.02;
  const eX = H.eyeX * Hl, eA = Lo.eA, eR = eyeRadOf(P, F), noEye = H.pupil === 'none', browK = H.browGeo != null ? H.browGeo : (H.shape || 'oval') === 'tri' ? 0.16 : 0.09;
  const holes = [];
  { const nr = Hl * nostrilR(P) * 1.05; holes.push({ x: Lo.nX * Hl, a: Lo.nA, r: nr, dep: nr * 0.9, rim: nr * 0.16 }); }
  if (H.pits === 'loreal') holes.push({ x: Hl * ((Lo.nX + Lo.E - Lo.erx) / 2 + 0.01), a: Math.min(mAa - 0.09, (Lo.nA + Lo.eA) / 2 + 0.06), r: Hl * 0.026, dep: Hl * 0.04, rim: Hl * 0.004 });
  if (H.pits === 'labial') { for (const s of seeds) if ((s.k === 'lab' && (s.n < 4 || s.n > Lo.nLab - 5)) || (s.k === 'ilab' && s.n > Lo.nLab - 6)) { if (s.a < 0) continue; holes.push({ x: s.x, a: s.low ? s.a - 0.012 : s.a + 0.012, r: Math.min(s.rx * 0.45, Hl * 0.016), dep: Hl * 0.018, rim: Hl * 0.002 }); } holes.push({ x: Hl * 0.02, a: 0.3, r: Hl * 0.014, dep: Hl * 0.016, rim: Hl * 0.002 }); }
  const hgt = new Float32Array(nV);
  for (let k = 1; k < NX; k++) {
    const x = xs[k], hx = hc(x), rl = (F.W(x) + F.Hh(x)) / 2, kp = k + 1, km = k - 1, dX = xs[kp] - xs[km];
    const fade0 = sstep(0, Hl * 0.03, x), lipF = sstep(Hl * 0.015, Hl * 0.07, x) * (1 - sstep(xh * 0.86, xh * 1.06, x)) * (P.plan === 'blind' ? 0.3 : 1);
    for (let ci = 0; ci < nC; ci++) {
      const o = k * nC + ci, u = cols[ci].u, a = 2 * u - 1, aa = Math.abs(a);
      let cp = ci + 1; if (cp < nC && cols[cp].u - u < 1e-9) cp++; let cm = ci - 1; if (cm >= 0 && u - cols[cm].u < 1e-9) cm--;
      const up = cp >= nC ? cols[1].u + 1 : cols[cp].u, um = cm < 0 ? cols[nC - 2].u - 1 : cols[cm].u; if (cp >= nC) cp = 1; if (cm < 0) cm = nC - 2;
      const gx = (fd[kp * nC + ci] - fd[km * nC + ci]) / dX, gy = (fd[k * nC + cp] - fd[k * nC + cm]) / (2 * (up - um) * hx);
      const g = fd[o] / Math.max(1e-9, Math.hypot(gx, gy)), s = seeds[id1[o]];
      let h = 0;
      if (s) {
        // v5.88: no two scales alike - each its own height, a slight tilt, and a little wear on its surface (they were all
        // the same even, CG-looking plates up close)
        const hv = hash1(s.id + 1, 311), tilt = 1 + 0.4 * ((hash1(s.id + 1, 517) - 0.5) * clamp((x - s.x) / s.rx, -1, 1) + (hash1(s.id + 1, 733) - 0.5) * clamp(wrapA(a - s.a) / s.ra, -1, 1));
        const wear = 1 + 0.05 * (vnoise(x / Hl * 70, a * 34, 3.7, 977) - 0.5) + 0.04 * (vnoise(x / Hl * 160, a * 80, 1.3, 983) - 0.5);
        // (v6.26: flatter plates with a steeper edge into a narrower suture - real head shields are smooth, glossy and nearly
        // flat; the domed plates with a wide bevel looked modelled in clay)
        if (!s.small) { const e = sstep(0, 1.0, g / gwP); h = Ap * (Math.pow(e, 0.35) + 0.18 * (1 - Math.min(1, d1[o]) ** 2)) * (s.k === 'lab' || s.k === 'ilab' ? 0.75 : 1) * (0.8 + 0.4 * hv) * tilt * wear; }
        else { const As = Math.min(s.rx, s.ra * hx) * (plates ? 0.1 : s.keel ? 0.2 : 0.14) * rel * (0.78 + 0.44 * hv), gw = Math.max(s.gw * 1.35, step * 1.4), e = sstep(0, 1.15, g / gw), lx = clamp((x - s.x) / s.rx, -1, 1);
          h = As * (0.55 * Math.sqrt(e) + 0.45 * e * (lx + 1) / 2) * tilt * wear + (plates ? Ap * 0.5 : 0); // (each scale rises towards its free rear edge, which overlaps the next)
          if (s.keel) h += As * 0.7 * s.keel * e * Math.exp(-((wrapA(a - s.a) * hx / (s.rx * 0.2)) ** 2)) * sstep(-0.9, 0.2, lx); }
      }
      if (!noEye) { const rho = Math.hypot(x - eX, (aa - eA) * hx) / eR; h *= sstep(1.08, 1.5, rho); // (flat under the scales that ring the eye: it sits in its socket as before)
        // the brow: the supraocular stands out over the top of the eye (a ledge in vipers and pit vipers)
        if (rho > 1.0 && rho < 2.4 && aa < eA) h += eR * browK * Math.exp(-(((rho - 1.32) / 0.32) ** 2)) * sstep(0.1, 0.9, (eA - aa) * hx / eR + 0.4); }
      for (const q of holes) { const d = Math.hypot(x - q.x, (aa - q.a) * hx) / q.r; if (d < 2) h += -q.dep * (1 - sstep(0.45, 1.0, d)) + q.rim * Math.exp(-(((d - 1.15) / 0.3) ** 2)); }
      // the lip line: the upper lip scales swell a little, then roll in to the edge; the lower jaw's edge slopes in under them
      if (lipF > 0) { const lk = H.lipK || 1; if (cols[ci].s > 0) { const dm = Math.max(0, mAa - aa); h += rl * lipF * lk * (0.012 * Math.exp(-(((dm - 0.045) / 0.03) ** 2)) - 0.045 * (1 - sstep(0, 0.022, dm))); }
        else { const dm = Math.max(0, aa - mAa); h += rl * lipF * lk * (-0.045 * (1 - sstep(0, 0.03, dm))); } }
      { const tk = 1 - aa; hgt[o] = h * fade0 * (1 - sstep(xCut * (0.7 + 0.1 * tk), xCut * (0.86 + 0.1 * tk), x)); } // (v6.20: fades out further back on the crown than on the throat - a V at the nape, not a ring)
    }
  }
  return hgt;
}
// vertex normals of an indexed geometry, area-weighted (as computeVertexNormals, without its per-vertex object calls)
function fastNormals(geo) {
  const pa = geo.attributes.position.array, ia = geo.index.array; let na = geo.attributes.normal && geo.attributes.normal.array;
  if (!na || na.length !== pa.length) { na = new Float32Array(pa.length); geo.setAttribute('normal', new THREE.BufferAttribute(na, 3)); } else na.fill(0);
  for (let k = 0; k < ia.length; k += 3) {
    const a = ia[k] * 3, b = ia[k + 1] * 3, c = ia[k + 2] * 3;
    const ux = pa[b] - pa[a], uy = pa[b + 1] - pa[a + 1], uz = pa[b + 2] - pa[a + 2], vx = pa[c] - pa[a], vy = pa[c + 1] - pa[a + 1], vz = pa[c + 2] - pa[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    na[a] += nx; na[a + 1] += ny; na[a + 2] += nz; na[b] += nx; na[b + 1] += ny; na[b + 2] += nz; na[c] += nx; na[c + 1] += ny; na[c + 2] += nz;
  }
  for (let i = 0; i < na.length; i += 3) { const l = Math.hypot(na[i], na[i + 1], na[i + 2]) || 1; na[i] /= l; na[i + 1] /= l; na[i + 2] /= l; }
  geo.attributes.normal.needsUpdate = true; return na;
}
function buildHeadSkin(P, F, body, quality) {
  const Hl = F.Hl, H = P.head, M = body.M, bpos = body.geo.attributes.position.array, bnrm = body.geo.attributes.normal.array;
  let iCut = 0; while (iCut < body.nR - 2 && body.ringX[iCut] < Hl * 1.2) iCut++;
  const G = headSkinGrid(F, body.ringX[iCut], M, quality === 'high'), { NX, nC, cols, xs } = G;
  const nV = (NX + 1) * nC, pos = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), hd = new Float32Array(nV), met = new Float32Array(nV * 3), xv = new Float32Array(nV), thv = new Float32Array(nV), side = new Int8Array(nV);
  const circ = (x) => { const a = F.W(x), b = F.Hh(x); return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))); };
  const Mc = M * 2, cs = new Float64Array((Mc + 1) * 2);
  // v6.26 (the mouth line): not a straight cut along the head but a gentle curve - it dips a little under the eye and comes
  // back up towards the corner of the mouth (head.smile, by group: the black mamba's well-known 'smile', the nearly straight
  // line of sea snakes). The lips are bent up or down by a fraction of the head's depth there, fading out above and below
  // the line; zero at the snout tip and at the jaw's hinge, so the open mouth hinges exactly where it did.
  const smile = H.smile || 0, xHinge = Hl * (H.jaw || 0.75) * 1.02, mA0 = body.mouthA;
  const lipBend = (x, th) => { if (!smile || x <= 0 || x >= xHinge) return 0; const u = x / xHinge, d = (Math.abs(th) - mA0) / 0.42; return -smile * F.Hh(x) * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 1.3) * Math.exp(-d * d); };
  for (let k = 0; k <= NX; k++) {
    const x = xs[k], c = body.spine(x), f = body.frameAt(x), v = body.gOf(x) / body.gTotal, cx = circ(x), ring = body.ringAt(x);
    if (k < NX) for (let j = 0; j <= Mc; j++) { const sc = ring(TAU * (j / Mc) - Math.PI); cs[j * 2] = sc[0]; cs[j * 2 + 1] = sc[1]; }
    for (let ci = 0; ci < nC; ci++) {
      const o = k * nC + ci, u = cols[ci].u, th = TAU * u - Math.PI;
      if (k === NX) { const fj = u * M, j0 = Math.min(M - 1, Math.floor(fj)), t = fj - j0, a = (iCut * (M + 1) + j0) * 3; for (let q = 0; q < 3; q++) pos[o * 3 + q] = lerp(bpos[a + q], bpos[a + 3 + q], t); } // (the last ring lies exactly on the body's: no crack)
      else { let s; const fj = u * Mc, j0 = Math.min(Mc - 1, Math.floor(fj)), t = fj - j0; // (the smooth head sampled at half the columns, in between on the chord: well under a micron)
        if (t < 1e-6) s = [cs[j0 * 2], cs[j0 * 2 + 1]]; else if (cols[ci].u === cols[ci + (ci + 1 < nC ? 1 : 0)].u || (ci && cols[ci].u === cols[ci - 1].u)) s = ring(th); else s = [lerp(cs[j0 * 2], cs[j0 * 2 + 2], t), lerp(cs[j0 * 2 + 1], cs[j0 * 2 + 3], t)];
        const sb = s[1] + lipBend(x, th); pos[o * 3] = c.x + f.S.x * s[0] + f.U.x * sb; pos[o * 3 + 1] = c.y + f.S.y * s[0] + f.U.y * sb; pos[o * 3 + 2] = c.z + f.S.z * s[0] + f.U.z * sb; }
      uv[o * 2] = u; uv[o * 2 + 1] = v; xv[o] = x; thv[o] = th; side[o] = cols[ci].s;
      hd[o] = hdFade(x, th, Hl) * (Math.abs(th) < Math.PI * 0.62 ? 1 : 0.85); met[o * 3] = (u - 0.5) * cx; met[o * 3 + 1] = x; met[o * 3 + 2] = 0;
    }
  }
  // the last ring lies on the body's coarse ring (on its flat facets, a hair inside the true round surface): the rings just
  // before it ease onto those facets, so there is no little step - it caught the light as a pale ring round the neck
  { const ring = body.ringAt(G.xCut), c = body.spine(G.xCut), f = body.frameAt(G.xCut), kB = xs.findIndex((x) => x > G.xCut * 0.85);
    for (let ci = 0; ci < nC; ci++) { const sc = ring(TAU * cols[ci].u - Math.PI), o = (NX * nC + ci) * 3;
      const dx = pos[o] - (c.x + f.S.x * sc[0] + f.U.x * sc[1]), dy = pos[o + 1] - (c.y + f.S.y * sc[0] + f.U.y * sc[1]), dz = pos[o + 2] - (c.z + f.S.z * sc[0] + f.U.z * sc[1]);
      for (let k = kB; k < NX; k++) { const w = sstep(G.xCut * 0.85, G.xCut, xs[k]), q = (k * nC + ci) * 3; pos[q] += dx * w; pos[q + 1] += dy * w; pos[q + 2] += dz * w; } } }
  const idx = new Uint32Array(NX * (nC - 1) * 6); let ni = 0;
  for (let k = 0; k < NX; k++) for (let ci = 0; ci < nC - 1; ci++) { if (cols[ci + 1].u - cols[ci].u < 1e-9) continue; const a = k * nC + ci, b = a + nC; idx[ni++] = a; idx[ni++] = a + 1; idx[ni++] = b; idx[ni++] = a + 1; idx[ni++] = b + 1; idx[ni++] = b; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(new THREE.BufferAttribute(idx.subarray(0, ni), 1));
  fastNormals(geo);
  const pairs = []; for (let ci = 0; ci < nC - 1; ci++) if (cols[ci + 1].u - cols[ci].u < 1e-9) pairs.push(ci);
  const avg = (n, a, b) => { for (let q = 0; q < 3; q++) { const m = (n[a * 3 + q] + n[b * 3 + q]) / 2; n[a * 3 + q] = n[b * 3 + q] = m; } };
  const bn = geo.attributes.normal.array.slice(), base = pos.slice(), rest = pos.slice();
  for (let k = 0; k <= NX; k++) { avg(bn, k * nC, k * nC + nC - 1); for (const ci of pairs) avg(bn, k * nC + ci, k * nC + ci + 1); } // (both copies of the lip line move the same way: no crack)
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('aHead', new THREE.BufferAttribute(hd, 1)); geo.setAttribute('aMet', new THREE.BufferAttribute(met, 3));
  if (body.occS) geo.setAttribute('aOcc', new THREE.BufferAttribute(bakeOcc(F, body.occS, pos, bn, xv), 2)); // (v6.26: as the body's)
  // normals: from the sculpted surface; the lip line stays a crease in front of the corners of the mouth, the belly seam and
  // the snout tip are smooth, and the last ring takes the body's own normals (no seam in the shading)
  const T0 = body.frameAt(0).T, lastB = iCut * (M + 1), xh = Hl * (H.jaw || 0.75) * 1.02;
  function fixNormals() {
    const n = fastNormals(geo); // (on the arrays themselves: three's general version took ~20x longer on this many vertices)
    for (let k = 0; k <= NX; k++) { const b = k * nC; avg(n, b, b + nC - 1); if (xs[k] > xh * 0.9) for (const ci of pairs) avg(n, b + ci, b + ci + 1); }
    // (the body's own normals at the seam come from its coarse rings, a few degrees off the fine head's: over the last tenth
    // of the head mesh its normals blend into them, or the seam showed as a pale ring round the neck)
    const kB = xs.findIndex((x) => x > G.xCut * 0.9);
    for (let ci = 0; ci < nC; ci++) { n[ci * 3] = -T0.x; n[ci * 3 + 1] = -T0.y; n[ci * 3 + 2] = -T0.z;
      const fj = cols[ci].u * M, j0 = Math.min(M - 1, Math.floor(fj)), t = fj - j0, a = (lastB + j0) * 3;
      let X = lerp(bnrm[a], bnrm[a + 3], t), Y = lerp(bnrm[a + 1], bnrm[a + 4], t), Z = lerp(bnrm[a + 2], bnrm[a + 5], t); const l = Math.hypot(X, Y, Z) || 1; X /= l; Y /= l; Z /= l;
      for (let k = kB; k <= NX; k++) { const o = (k * nC + ci) * 3, w = sstep(G.xCut * 0.9, G.xCut, xs[k]), x2 = lerp(n[o], X, w), y2 = lerp(n[o + 1], Y, w), z2 = lerp(n[o + 2], Z, w), l2 = Math.hypot(x2, y2, z2) || 1; n[o] = x2 / l2; n[o + 1] = y2 / l2; n[o + 2] = z2 / l2; } }
    geo.attributes.normal.needsUpdate = true;
  }
  const hs = { geo, xv, thv, side, nC, NX, iCut, grid: G, rest, fixNormals, drawFrom: iCut * M * 6, onRest: null,
    // the sculpted heights (from the worker, or worked out here): the rest shape moves out along the smooth head's normals
    setHeights(hgt) { for (let o = 0; o < nV; o++) { const h = hgt[o]; for (let q = 0; q < 3; q++) rest[o * 3 + q] = base[o * 3 + q] + bn[o * 3 + q] * h; }
      if (hs.onRest) hs.onRest(); else { pos.set(rest); geo.attributes.position.needsUpdate = true; fixNormals(); } geo.computeBoundingSphere(); },
  };
  geo.computeBoundingBox(); geo.computeBoundingSphere(); // (the normals are made when the sculpted heights arrive: setHeights)
  return hs;
}

// ---------- textures generated per species ----------
function scaleLattice(P, gTotal) {
  const S = P.scales, aV = S.aV, R = S.rows, rw = (2 * aV) / R;
  // v5.23: an enlarged vertebral row (kraits, cat snakes, bronzebacks): the middle row is vert x wider, the others share the rest
  // v5.25: and the lowest rows on each flank a little larger than those on the back (as in most snakes)
  const lk = S.latK != null ? S.latK : (S.kind === 'juxta' || S.kind === 'cycloid' ? 0 : 0.35), wts = [];
  for (let i = 0; i < R; i++) { const u = Math.abs(i - (R - 1) / 2) / Math.max(1, (R - 1) / 2); wts.push((i === (R - 1) / 2 && S.vert && R % 2 ? S.vert : 1) * (1 + lk * u ** 3)); }
  const wsum = wts.reduce((p, q) => p + q, 0), RB = [-aV]; for (let i = 0; i < R; i++) RB.push(RB[i] + (2 * aV) * wts[i] / wsum);
  const vk = lk > 0 || (S.vert && R % 2) ? 2 : 1; // (2: use the row table)
  const rowOf = (a) => { if (vk === 1) return Math.floor((a + aV) / rw); let lo = 0, hi = R; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (RB[m] <= a) lo = m; else hi = m; } return lo; };
  const Wt = R > 40 ? 2048 : 1024; // v4.72: twice as sharp
  // scale pitch along the body (girth units), rounded so the tile has a whole number of pixels
  let Ht = Math.max(8, Math.round(Wt * (S.kind === 'juxta' ? 1.0 : 1.25) * aV / R * (S.pitch || 1)));
  if (Ht % 2) Ht++;
  const Pt = Ht / Wt;
  const cell = (a, g) => {
    if (Math.abs(a) > aV) { const j = Math.floor(g / Pt); return { ac: a, gc: (j + 0.5) * Pt, id: j * 7919 + (a > 0 ? 1 : 2), v: true, w: 1 }; }
    // v5.58 (rendering): DIAMOND scale cells. The rows are staggered by half a pitch, so the scale whose centre is nearest in
    // the diamond measure |da|/width + |dg|/(pitch/2) tiles the skin exactly with rhombi, as the real overlapping scales lie;
    // the old brick-shaped cells (one row, one pitch) gave every scale a square block of colour - "digital camouflage"
    const i0 = rowOf(a); let best = null;
    for (let di = -1; di <= 1; di++) {
      const i = i0 + di; if (i < 0 || i >= R) continue;
      const wI = vk === 1 ? rw : RB[i + 1] - RB[i], off = (i & 1) * Pt / 2, ac = vk === 1 ? -aV + (i + 0.5) * rw : (RB[i] + RB[i + 1]) / 2;
      const jm = Math.floor((g - off) / Pt);
      for (let dj = 0; dj <= 1; dj++) { const j = jm + dj - ((g - off) / Pt - jm < 0.5 ? 1 : 0), gc = off + (j + 0.5) * Pt;
        const d = Math.abs(a - ac) / wI + Math.abs(g - gc) / (Pt / 2);
        if (!best || d < best.d) best = { d, i, j, ac, gc, wI }; }
    }
    const { i, j, ac, gc, wI } = best, lx = (a - ac) / wI, ly = (g - gc) / Pt;
    // (pattern edges still step along the scale ROWS - the cell in the texel's own row - so a stripe keeps a straight edge
    // instead of a saw-tooth; only colour, shading and the scale's own variation follow the diamonds)
    const o0 = (i0 & 1) * Pt / 2, qac = vk === 1 ? -aV + (i0 + 0.5) * rw : (RB[i0] + RB[i0 + 1]) / 2, qgc = o0 + (Math.floor((g - o0) / Pt) + 0.5) * Pt;
    // w: how far inside the scale (1 in the middle, 0 at its edges), so per-scale colour blends softly
    return { ac, gc, qac, qgc, id: i * 100003 + j * 7, v: false, i, j, w: clamp(1 - Math.pow(best.d, 1.6), 0, 1) * clamp(1 - (lx * lx * 0.6 + ly * ly * 0.4), 0, 1) };
  };
  return { aV, R, rw, Wt, Ht, Pt, cell, rowOf, RB, vk };
}

// the scale tile: normal map (rgb) plus a cavity/roughness map, one tile = full circumference x one scale pitch
function scaleTextures(P, lat) {
  const { Wt, Ht, aV, rw, Pt, rowOf, RB, vk } = lat, S = P.scales, keel = S.keel || 0, kind = S.kind || 'imbricate';
  const h = new Float32Array(Wt * Ht);
  // v5.58: edge (scales.edge = { k, dir: [towards the head, towards the belly], from, pow }): how dark each scale's own visible
  // edge is, on one side (the inland taipan's blackish lower front edges that line up into a herringbone) - kept in the cavity
  // map's blue channel, so the dark edge follows the scale's real outline (the colour texture's square cells did not)
  const SE = S.edge, ed = SE ? new Float32Array(Wt * Ht) : null, tb = new Float32Array(Wt * Ht).fill(1); // tb: where in its scale each point lies, base (0) to free tip (1)
  for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) {
    const a = ((x + 0.5) / Wt) * 2 - 1, g = ((y + 0.5) / Ht) * Pt;
    let best = 0, bE = 0, bT = 1;
    if (Math.abs(a) > aV) { // ventral scutes: wide plates
      // v5.99 (overlapping scales): each ventral scute is a plate tilted up towards its rear edge, which lies over the front
      // of the next one - a small step with a rounded lip (the seam pass below shades the step), not a groove
      const yy = g / Pt; best = 0.4 + 0.36 * Math.pow(yy, 1.3) - 0.1 * Math.exp(-(((1 - yy) / 0.04) ** 2)) - 0.08 * Math.exp(-((yy / 0.05) ** 2));
      best -= 0.4 * Math.exp(-(((Math.abs(a) - aV) / 0.01) ** 2));
      bT = 0.35 + 0.65 * yy; // (v5.88: each ventral plate's front edge lies under the free edge of the one in front)
    } else {
      const i0 = rowOf(a);
      for (let di = -1; di <= 1; di++) {
        const i = i0 + di, wI = vk === 1 || i < 0 || i >= RB.length - 1 ? rw : RB[i + 1] - RB[i], ac = vk === 1 || i < 0 || i >= RB.length - 1 ? -aV + (i + 0.5) * rw : (RB[i] + RB[i + 1]) / 2, off = (((i % 2) + 2) % 2) * Pt / 2;
        for (let dj = -1; dj <= 2; dj++) {
          const j = Math.floor((g - off) / Pt) + dj - 1, gc = off + (j + 0.5) * Pt;
          const lx = (a - ac) / wI, ly = (g - gc) / Pt;
          let hv;
          if (kind === 'juxta' || kind === 'cycloid') {
            const wx = kind === 'juxta' ? 0.52 : 0.66, wy = kind === 'juxta' ? 0.52 : 0.72;
            const d = (lx / wx) ** 2 + (ly / wy) ** 2; if (d >= 1) continue;
            hv = Math.sqrt(1 - d) * (kind === 'cycloid' ? 0.6 + 0.4 * (ly / wy + 1) / 2 : 1);
          } else {
            const wy = 0.92, t = clamp((ly / wy + 1) / 2, 0, 1), wx = 0.64 * (1 - 0.55 * t * t);
            const d = (lx / wx) ** 2 + (ly / wy) ** 2; if (d >= 1) continue;
            // v5.99 (overlapping scales, Eduardo): real dorsal scales are imbricate - each a thin plate tucked in under the one in
            // front and tilted up to a free rear edge that lies over the next. So the height climbs steadily from the scale's base
            // to its rear edge and keeps most of it right up to the outline (only a narrow rounded lip), and the scale behind -
            // and those of the next rows, offset by half a scale - start low under it: a real step at every free edge, in
            // diagonal rows (the old profile was a dome that ran down to nothing at the edge, so the skin read as a flat mosaic)
            hv = (0.14 + 0.86 * Math.pow(t, 1.25)) * (0.8 + 0.2 * Math.sqrt(1 - d)) * (1 - 0.2 * sstep(0.86, 1, d));
            if (keel) hv += keel * 0.4 * Math.exp(-((lx / 0.065) ** 2)) * sstep(-0.9, -0.2, ly / wy) * (1 - 0.35 * sstep(0.6, 0.95, t)); // (v5.88: a crisper keel, fading at the very tip as on real scales)
            if (SE && hv > best) { const dir = SE.dir || [1, 1], sd = clamp(0.5 + dir[0] * -ly * 1.3 + dir[1] * Math.sign(a || 1) * lx * 2.2, 0, 1);
              bE = Math.pow(sstep(SE.from != null ? SE.from : 0.3, 0.97, Math.sqrt(d)), SE.pow || 1) * sstep(0.2, 0.85, sd); }
          }
          if (hv > best) { best = hv; bT = kind === 'juxta' || kind === 'cycloid' ? 1 : clamp((ly / 0.92 + 1) / 2, 0, 1); }
        }
      }
    }
    h[y * Wt + x] = best; tb[y * Wt + x] = bT; if (ed) ed[y * Wt + x] = bE;
  }
  // v5.58: a light blur (one pixel each way) so the overlapping edges are soft steps, not one-pixel cliffs that flicker
  { const t = new Float32Array(Wt * Ht);
    for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) t[y * Wt + x] = (h[y * Wt + ((x + Wt - 1) % Wt)] + 2 * h[y * Wt + x] + h[y * Wt + ((x + 1) % Wt)]) / 4;
    for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) h[y * Wt + x] = (t[((y + Ht - 1) % Ht) * Wt + x] + 2 * t[y * Wt + x] + t[((y + 1) % Ht) * Wt + x]) / 4;
    if (ed) for (let pass = 0; pass < 2; pass++) { // (the dark edges too, twice: they were saw-toothed)
      for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) t[y * Wt + x] = (ed[y * Wt + ((x + Wt - 1) % Wt)] + 2 * ed[y * Wt + x] + ed[y * Wt + ((x + 1) % Wt)]) / 4;
      for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) ed[y * Wt + x] = (t[((y + Ht - 1) % Ht) * Wt + x] + 2 * t[y * Wt + x] + t[((y + 1) % Ht) * Wt + x]) / 4; } }
  // v5.99 (overlapping scales): the seam - the skin just behind every free edge lies in the shadow of the edge over it. A
  // texel is shaded by any higher point a little way towards the head (straight forward and along the two diagonals, as the
  // scale rows run), more the higher that point stands above the slope of the light: a dark line that follows each scale's
  // free edge, which still reads when the scales are only a few pixels across (the relief itself fades out there)
  const seam = new Float32Array(Wt * Ht);
  if (kind === 'imbricate') {
    const K = Math.max(4, Math.round(Ht * 0.16)), slope = 0.3 / Math.max(3, Ht * 0.12), dirs = [[0, 1], [0.6, 0.8], [-0.6, 0.8]];
    const ox = new Int32Array(3 * K), oy = new Int32Array(3 * K);
    for (let di = 0; di < 3; di++) for (let k = 1; k <= K; k++) { ox[di * K + k - 1] = Math.round(-dirs[di][0] * k * 0.8); oy[di * K + k - 1] = -Math.round(dirs[di][1] * k); }
    const xb0 = Math.floor((1 - aV) / 2 * Wt), xb1 = Wt - xb0;
    for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) {
      const h0 = h[y * Wt + x], nd = x < xb0 || x >= xb1 ? K : 3 * K; let occ = 0;
      for (let q = 0; q < nd; q++) {
        let xx = x + ox[q], yy = y + oy[q]; if (xx < 0) xx += Wt; else if (xx >= Wt) xx -= Wt; if (yy < 0) yy += Ht;
        const o = h[yy * Wt + xx] - h0 - ((q % K) + 1) * slope; if (o > occ) occ = o;
      }
      seam[y * Wt + x] = occ > 0 ? sstep(0.0, 0.2, occ) : 0;
    }
  }
  const seamK = S.seam != null ? S.seam : keel > 0.3 ? 0.55 : 0.42; // (smooth scales lie flatter and tighter: a finer seam)
  const nData = new Uint8Array(Wt * Ht * 4), cData = new Uint8Array(Wt * Ht * 4);
  const str = (S.normal || 1) * (kind === 'imbricate' ? 2.2 : 1.6);
  const H = (x, y) => h[((y + Ht) % Ht) * Wt + ((x + Wt) % Wt)];
  for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * str, dy = (H(x, y + 1) - H(x, y - 1)) * str;
    const l = Math.hypot(dx, dy, 1), k = (y * Wt + x) * 4;
    nData[k] = (-dx / l * 0.5 + 0.5) * 255; nData[k + 1] = (-dy / l * 0.5 + 0.5) * 255; nData[k + 2] = (1 / l * 0.5 + 0.5) * 255; nData[k + 3] = 255;
    const hv = H(x, y), cav = sstep(0.0, 0.3, hv);
    cData[k] = (0.35 + 0.65 * cav) * lerp(0.8, 1, sstep(0.0, 0.55, tb[y * Wt + x])) * (1 - seamK * seam[y * Wt + x]) * 255; // cavity (darkens the skin between scales; v5.88: and the base of each scale, tucked under the free edge of the one in front - the overlap reads up close)
    cData[k + 1] = (lerp(1.0, 0.82, cav) + keel * 0.08) * 230; // roughness
    cData[k + 2] = ed ? ed[y * Wt + x] * 255 : 0; cData[k + 3] = 255; // (blue: the dark scale edge, see S.edge)
  }
  const mk = (d) => { const t = new THREE.DataTexture(d, Wt, Ht, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  return { normal: mk(nData), cavity: mk(cData) };
}

// ---------- v5.53: the scales of the head ----------
// The head gets its own two small textures, laid over it from the snout tip to just behind the jaws (rows by the
// distance along the head, columns all the way round it, like the body's): the relief (normal, the dark grooves between
// scales, how shiny each is) and a colour layer (pale lip scales, dark bars between them, nostrils, heat pits, spots).
// The scales are cells round hand-placed centres, each with its own size (a weighted Voronoi tiling): the big plates of
// colubrids and elapids (rostral, internasals, prefrontals, frontal, supraoculars, parietals, nasal, loreal, pre- and
// postoculars, temporals, the upper and lower lip scales, mental and chin shields), the few enlarged scales of vipers and
// pythons with small ones everywhere else, the big rostral and ocular scales of blind snakes - and small scales where the
// head meets the neck. The grooves between cells are the same width everywhere on the skin.
const HEAD_GENUS = { // v5.53: head colours some snakes are known by
  thamnophis: { lips: 'barred', lipColor: '#c4bf8c', napeSpots: true, tongue: '#c0262e', tongueTip: '#141012' }, // garter snakes: pale lip scales with black bars between them, two pale spots on the parietals, a red tongue with black tips
  nerodia: { lips: 'barred' }, regina: { lips: 'barred' }, natrix: { lips: 'barred' }, storeria: { lips: 'pale' },
  pantherophis: { lips: 'barred' }, lampropeltis: { lips: 'barred' }, pituophis: { lips: 'barred' }, coronella: { lips: 'pale' },
};
function eyeOf(P, F) { // the eye's size and place, and the mouth line (as buildBody makes them; the pattern worker has no body)
  const Hd = P.head, x = Hd.eyeX * F.Hl;
  return { eyeRad: eyeRadOf(P, F), eyeRl: (F.W(x) + F.Hh(x)) / 2, mouthA: Math.PI * 0.56 };
}
function headLayout(P, F, body) {
  const H = P.head, Hl = F.Hl, plan = P.plan || 'colubrid', tri = (H.shape || 'oval') === 'tri', pit = plan === 'pitviper';
  const hc = (x) => Math.max(Hl * 0.004, Math.PI * (2 * F.W(x) + F.Hh(x) * (1 + F.BF(x))) / 4); // half the girth round the head at x
  const E = H.eyeX, eA = H.eyeA / 180, noEye = H.pupil === 'none';
  const erx = body.eyeRad / Hl, era = body.eyeRad / body.eyeRl / Math.PI, mA = body.mouthA / Math.PI, J = H.jaw || 0.75;
  const nA = H.nostrilA != null ? H.nostrilA / 180 : 0.44, nX = H.nostrilX ? H.nostrilX + 0.005 : 0.075;
  const plates = plan === 'colubrid' || plan === 'elapid' || plan === 'sea' || (H.plates && plan !== 'blind');
  const seeds = [], big = [];
  // one scale: centre (x in head lengths, a round the head: 0 top, 1 belly), half-sizes (rx in head lengths, ra in a)
  const S = (x, a, rx, ra, k, o) => { for (const sg of a > 0.004 && a < 0.996 ? [1, -1] : [1]) { const s = Object.assign({ x: x * Hl, a: a * sg, rx: rx * Hl, ra, k, low: a > mA, id: seeds.length, gw: GW * Hl }, o); seeds.push(s); big.push(s); } };
  const wrapA = (d) => d - 2 * Math.round(d / 2);
  const dist = (s, x, a) => Math.hypot((x - s.x) / s.rx, wrapA(a - s.a) / s.ra);
  const nLab = H.labials || (plan === 'python' ? 13 : tri ? 12 : plan === 'blind' ? 4 : plan === 'elapid' || plan === 'sea' ? 7 : 8);
  if (plan === 'blind') {
    S(0.0, 0, 0.2, 0.55, 'rost'); S(0.17, nA * 0.8, 0.07, 0.16, 'nas'); S(E, eA, 0.12, 0.15, 'ocu'); S(E - 0.1, eA + 0.08, 0.05, 0.1, 'pre');
    S(E + 0.2, 0.08, 0.1, 0.12, 'pla'); S(0.03, 1, 0.08, 0.3, 'ment');
    for (let k = 0; k < nLab; k++) S(0.12 + k * 0.1, mA - 0.06, 0.05, 0.07, 'lab');
  } else {
    S(0.0, 0, tri ? 0.055 : 0.07, mA * 1.15, 'rost');
    S(0.012, 1, 0.06, 0.26, 'ment');
    const x0 = 0.075, x1 = J * 0.97, sp = (x1 - x0) / nLab;
    for (let k = 0; k < nLab; k++) { const xc = x0 + (k + 0.5) * sp, under = noEye ? 0 : Math.exp(-(((xc - E) / Math.max(0.06, erx * 1.3)) ** 2)), ra = 0.055 + (plates ? 0.035 : 0.012) * under; S(xc, mA - ra * 0.92, sp * 0.56, ra, 'lab', { n: k }); }
    const nI = nLab + (plates ? 1 : 2), y0 = 0.045, y1 = J * 0.95, sq = (y1 - y0) / nI;
    for (let k = 0; k < nI; k++) S(y0 + (k + 0.5) * sq, mA + 0.06, sq * 0.56, 0.055, 'ilab', { n: k });
    if (plates) {
      if (nA > 0.3) S(0.085, 0.1, 0.045, 0.12, 'pla'); // internasals (sea snakes: the nasals meet on top instead)
      S(nX, Math.max(0.09, nA), 0.05, 0.11, 'nas');
      S(0.185, 0.12, 0.055, 0.14, 'pla'); // prefrontals
      if (plan === 'colubrid') S((0.12 + E - erx) / 2 + 0.02, Math.min(eA + 0.08, mA - 0.13), 0.04, 0.07, 'pla'); // loreal (elapids have none)
      if (!noEye) {
        S(E - erx * 1.3, eA, 0.022, Math.max(0.05, era * 0.95), 'pre');
        S(E + erx * 1.3, eA - era * 0.45, 0.02, Math.max(0.035, era * 0.5), 'post'); S(E + erx * 1.3, eA + era * 0.5, 0.02, Math.max(0.035, era * 0.5), 'post');
      }
      const sa = Math.max(0.135, eA - era - 0.055);
      S(E + 0.02, sa, 0.1, Math.max(0.05, Math.min(0.08, sa - 0.07)), 'sup');
      S(E + 0.07, 0, 0.15, Math.max(0.055, sa - 0.075), 'pla'); // frontal
      S(E + 0.38, 0.115, 0.2, 0.135, 'pla'); // parietals
      S(E + erx * 1.3 + 0.11, Math.min(eA + 0.06, mA - 0.1), 0.07, 0.06, 'pla'); S(E + 0.47, Math.min(eA + 0.02, mA - 0.14), 0.07, 0.06, 'pla'); S(E + 0.47, Math.min(eA + 0.13, mA - 0.06), 0.07, 0.055, 'pla'); // temporals
      S(0.17, 0.86, 0.075, 0.1, 'chin'); S(0.33, 0.88, 0.08, 0.085, 'chin'); // chin shields
    } else {
      S(0.07, 0.09, 0.035, 0.09, 'pla'); S(0.06, Math.max(0.1, nA), 0.04, 0.1, 'nas'); // internasals, nasal
      if (pit || plan === 'python') S(0.16, 0.11, 0.045, 0.1, 'pla'); // canthals / prefrontals
      if (!noEye) {
        const sa = Math.max(0.12, eA - era - 0.045);
        S(E + 0.01, sa, pit ? 0.11 : plan === 'python' ? 0.085 : 0.065, pit ? 0.07 : 0.05, 'sup');
        S(E - erx * 1.3, eA - era * 0.4, 0.02, Math.max(0.03, era * 0.5), 'pre'); S(E - erx * 1.3, eA + era * 0.45, 0.02, Math.max(0.03, era * 0.5), 'pre');
        // v5.73: the ring of small circumorbital scales (post- and suboculars) that frame a viper's or python's eye
        for (let k = 0; k < 9; k++) { const t = -0.35 * Math.PI + (k / 8) * 1.3 * Math.PI, cx = E + Math.cos(t) * erx * 1.32, ca = eA + Math.sin(t) * era * 1.32; if (ca < mA - 0.03) S(cx, ca, Math.max(0.016, erx * 0.38), Math.max(0.022, era * 0.4), 'post'); }
      }
      S(0.15, 0.87, 0.06, 0.08, 'chin');
    }
  }
  // small scales everywhere the big ones leave free: a jittered staggered lattice (mirrored left/right)
  const R = rng(strSeed(P.name || 'head') + 7), rows = Math.max(12, P.scales.rows || 19);
  const sBody = (2 * hc(Hl * 1.15)) / rows / Hl; // a body scale's width, in head lengths
  const lattice = (xa, xb, aLo, aHi, s, k, keel) => {
    let row = 0;
    for (let xn = xa; xn <= xb; xn += s * 0.87, row++) {
      const h = hc(xn * Hl), sa = (s * Hl) / h; if (sa > 0.5) continue;
      for (let a = aLo + sa * ((row & 1) * 0.5); a <= aHi + 1e-6; a += sa) {
        const q = { x: (xn + (R() - 0.5) * 0.3 * s) * Hl, a: clamp(a + (R() - 0.5) * 0.3 * sa, 0, 1), rx: s * Hl * 0.6, ra: sa * 0.6, k, small: true, keel, gw: Math.min(GW * Hl, s * Hl * 0.14) };
        q.low = q.a > mA;
        let inside = false; for (const b of big) if (b.low === q.low && dist(b, q.x, q.a) < 1.08) { inside = true; break; }
        if (inside) continue;
        for (const sg of q.a > sa * 0.35 && q.a < 1 - sa * 0.35 ? [1, -1] : [1]) seeds.push(Object.assign({}, q, { a: q.a * sg, id: seeds.length }));
      }
    }
  };
  const keel = Math.min(1, P.scales.keel || 0);
  if (plan === 'blind') lattice(0.25, 1.32, 0, 1, Math.max(0.09, sBody), 'sm', 0);
  else if (plates) { const xs = Math.max(0.8, E + 0.5); lattice(xs, 1.32, 0, 1, sBody, 'sm', keel); lattice(0.42, xs - 0.02, mA + 0.02, 1, Math.max(sBody * 0.8, 0.05), 'gul', 0); }
  else { const s = plan === 'python' ? Math.max(0.034, sBody * 0.62) /* (v6.20: 0.045 - cobbles twice a body scale's size) */ : Math.max(0.038, sBody * 0.6); lattice(0.02, 1.32, 0, 1, s, 'sm', plan === 'python' ? 0 : keel); }
  return { seeds, big, hc, mA, J, E, eA, erx, era, nA, nX, plates, dist, wrapA, nLab };
}
// v5.62 (model accuracy): nostril radius in head lengths (large in pythons and boas, small valved ones in sea snakes)
function nostrilR(P) { return P.head.nostrilR || { python: 0.019, sea: 0.011 }[P.plan] || 0.014; }
const HEAD_X = 1.3; // the head textures run from the snout tip to 1.3 head lengths
// v5.73: the grooves between head scales, in head lengths (0.011 drew thick cartoon outlines round every shield; a real
// suture is a fine line)
const GW = 0.0075;
function headData(P, F, quality) {
  const Hl = F.Hl, Xh = Hl * HEAD_X, low = quality === 'low', Wh = low ? 256 : quality === 'high' ? 1024 : 512, Hh = Wh / 2; // (v5.78: twice as sharp at High - the head scales stay crisp at the closest zoom)
  const Lo = headLayout(P, F, eyeOf(P, F)), { seeds, hc, mA, J, wrapA } = Lo, H = P.head, plan = P.plan || 'colubrid';
  const n = Wh * Hh, fd = new Float32Array(n), id1 = new Int32Array(n), id2 = new Int32Array(n), d1a = new Float32Array(n);
  const hcR = new Float32Array(Hh); for (let r = 0; r < Hh; r++) hcR[r] = hc(((r + 0.5) / Hh) * Xh); // (the girth per row, worked out once)
  // candidates per row: the scales near that x (the search is limited to them)
  const half = Wh >> 1;
  for (let r = 0; r < Hh; r++) {
    const x = ((r + 0.5) / Hh) * Xh, jawSplit = x < J * Hl * 1.02;
    // the big scales near this row, and the small ones sorted round the head (searched in a window that slides with a)
    const bigC = [], sm = [];
    for (const s of seeds) { if (Math.abs(x - s.x) > s.rx * 2.6) continue; if (!s.small) bigC.push(s); else { sm.push([s.a, s]); if (s.a < -0.5) sm.push([s.a + 2, s]); } }
    sm.sort((p, q) => p[0] - q[0]); let wR = 0; for (const [, s2] of sm) wR = Math.max(wR, s2.ra * 2.6);
    let lo = 0;
    for (let c = half; c < Wh; c++) {
      const a = ((c + 0.5) / Wh) * 2 - 1, lowSide = a > mA;
      let b1 = 1e9, b2 = 1e9, i1 = -1, i2 = -1;
      for (let q = 0, nb = bigC.length + sm.length; q < nb; q++) {
        let s;
        if (q < bigC.length) s = bigC[q]; else { const qq = q - bigC.length; if (qq === 0) { while (lo < sm.length && sm[lo][0] < a - wR) lo++; q = bigC.length + lo; if (q >= nb) break; } s = sm[q - bigC.length][1]; if (sm[q - bigC.length][0] > a + wR) break; }
        if (jawSplit && s.low !== lowSide) continue;
        const da = wrapA(a - s.a) / s.ra; if (da > 2.6 || da < -2.6) continue;
        const dx = (x - s.x) / s.rx, d = dx * dx + da * da;
        if (d < b1) { b2 = b1; i2 = i1; b1 = d; i1 = s.id; } else if (d < b2) { b2 = d; i2 = s.id; }
      }
      b1 = Math.sqrt(b1); b2 = Math.sqrt(b2);
      const k = r * Wh + c, m = r * Wh + (Wh - 1 - c);
      fd[k] = fd[m] = i2 < 0 ? 9 : b2 - b1; d1a[k] = d1a[m] = b1; id1[k] = id1[m] = i1; id2[k] = id2[m] = i2; // (the other side is its mirror image)
    }
  }
  // distance to the nearest groove on the skin (the field's value over its slope, both measured on the skin)
  const hgt = new Float32Array(n), gdist = new Float32Array(n), dX = Xh / Hh;
  const lipCol = [], bars = H.lips === 'barred';
  for (let r = 0; r < Hh; r++) {
    const x = ((r + 0.5) / Hh) * Xh, hx0 = hcR[r], dY = (2 / Wh) * hx0, rp = Math.min(Hh - 1, r + 1), rm = Math.max(0, r - 1);
    for (let c = 0; c < Wh; c++) {
      const k = r * Wh + c, cp = r * Wh + ((c + 1) % Wh), cm = r * Wh + ((c - 1 + Wh) % Wh);
      const gx = (fd[rp * Wh + c] - fd[rm * Wh + c]) / ((rp - rm) * dX), gy = (fd[cp] - fd[cm]) / (2 * dY);
      let g = fd[k] / Math.max(1e-9, Math.hypot(gx, gy));
      const a = ((c + 0.5) / Wh) * 2 - 1, aa = Math.abs(a);
      if (x < J * Hl) g = Math.min(g, Math.abs(aa - mA) * hx0 * 0.8); // the edge of the mouth
      const s = seeds[id1[k]] || {}, gw = s.gw || GW * Hl;
      gdist[k] = g / gw;
      let h = sstep(0, 1.5, g / gw) * 0.75 + (s.small ? 0.25 : 0.12) * (1 - Math.min(1, d1a[k]) ** 2); // (v5.73: the big shields flatter)
      if (s.small) { const lx = (x - s.x) / s.rx; h += 0.25 * clamp(lx, -1, 1); if (s.keel) h += s.keel * 0.45 * Math.exp(-((wrapA(a - s.a) * hx0 / (s.rx * 0.22)) ** 2)) * sstep(-0.9, 0.1, lx); } // (small scales overlap backwards, some are keeled)
      hgt[k] = h * gw * 0.9 * (H.headRelief != null ? H.headRelief : 1) * (s.k === 'lab' || s.k === 'ilab' ? 0.6 : 1); // (v5.58: headRelief - flatter, smoother shields in some snakes; v5.73: lip scales flatter still)
    }
  }
  // the nostrils and heat pits: dark, sunk into the skin
  const holes = [];
  { const nr = Hl * nostrilR(P) * 1.15, x = Lo.nX * Hl; holes.push({ x, a: Lo.nA, rx: nr * 1.1, ry: nr * 0.8, dark: 0.85 }); }
  if (plan !== 'blind') holes.push({ x: Hl * 0.012, a: mA, rx: Hl * 0.012, ry: Hl * 0.006, dark: 0.7 }); // the notch in the lips the tongue comes out through
  if (H.pits === 'loreal') holes.push({ x: Hl * ((Lo.nX + Lo.E - Lo.erx) / 2 + 0.01), a: Math.min(mA - 0.09, (Lo.nA + Lo.eA) / 2 + 0.06), rx: Hl * 0.026, ry: Hl * 0.022, dark: 0.92 });
  if (H.pits === 'labial') {
    for (const s of seeds) if ((s.k === 'lab' && (s.n < 4 || s.n > Lo.nLab - 5)) || (s.k === 'ilab' && s.n > Lo.nLab - 6)) { if (s.a < 0) continue; holes.push({ x: s.x, a: s.low ? s.a - 0.012 : s.a + 0.012, rx: Math.min(s.rx * 0.45, Hl * 0.016), ry: Hl * 0.014, dark: 0.8 }); }
    holes.push({ x: Hl * 0.02, a: 0.3, rx: Hl * 0.012, ry: Hl * 0.02, dark: 0.75 });
  }
  // (drawn once into a field over their own small boxes; the passes below read it)
  const hf = new Float32Array(n);
  for (const o of holes) {
    const r0 = Math.max(0, Math.floor(((o.x - o.rx * 1.4) / Xh) * Hh)), r1 = Math.min(Hh - 1, Math.ceil(((o.x + o.rx * 1.4) / Xh) * Hh));
    for (let r = r0; r <= r1; r++) {
      const x = ((r + 0.5) / Hh) * Xh, wa = (o.ry * 1.4) / hcR[r];
      for (const sg of [1, -1]) {
        const c0 = Math.max(0, Math.floor(((sg * o.a - wa + 1) / 2) * Wh)), c1 = Math.min(Wh - 1, Math.ceil(((sg * o.a + wa + 1) / 2) * Wh));
        for (let c = c0; c <= c1; c++) { const a = ((c + 0.5) / Wh) * 2 - 1, d = Math.hypot((x - o.x) / o.rx, (Math.abs(a) - o.a) * hcR[r] / o.ry); if (d < 1.1) hf[r * Wh + c] = Math.max(hf[r * Wh + c], o.dark * (1 - sstep(0.55, 1.05, d))); }
      }
    }
  }
  const holeAt = (r, c) => hf[clamp(r, 0, Hh - 1) * Wh + ((c + Wh) % Wh)];
  // colours: pale lip scales where the belly is paler than the flanks (dark bars between them in some snakes)
  const lat = hex(P.colors.lateral || P.colors.dorsal), bel = hex(P.colors.belly), dor = hex(P.colors.dorsal);
  const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255, paler = lum(bel) - lum(lat);
  // v5.62 (model accuracy): viper lips toned down - a band of pale tall lip scales split by dark grooves read as bared teeth
  const triL = (H.shape || 'oval') === 'tri' && !H.lips;
  // v5.73: subtler still everywhere - pale lip scales a little lighter than the flanks, thin dark sutures between them, no
  // white blocks split by black bars (they read as teeth on ribbon, corn, pipe and water snakes)
  const lipK = H.lips === 'none' ? 0 : H.lips ? (H.lipColor ? 0.75 : 0.62) : paler > 0.12 ? (triL ? 0.12 : { colubrid: 0.45, elapid: 0.4, viper: 0.25, pitviper: 0.25, python: 0.3 }[plan] || 0) : 0;
  const lipC = H.lipColor ? hex(H.lipColor) : mixc(lat, bel, bars ? 0.62 : triL ? 0.4 : 0.6), barC = H.barColor ? hex(H.barColor) : mixc(dor, [8, 8, 8], 0.45);
  const barSegs = []; // [x at the lip, a at the lip, a at the top, half-width, x at the top]
  if (bars) for (const k of ['lab', 'ilab']) { const row = seeds.filter((q) => q.k === k && q.a > 0).sort((p, q) => p.x - q.x);
    for (let i = 0; i + 1 < row.length; i++) { const p = row[i], q = row[i + 1], xm = (p.x + q.x) / 2, up = k === 'lab', aTop = up ? Math.max(mA - 0.12, Math.min(p.a - p.ra * 0.9, q.a - q.ra * 0.9)) : mA + (Math.max(p.a + p.ra * 0.8, q.a + q.ra * 0.8) - mA) * 0.5; barSegs.push([xm, mA, aTop, Hl * (up ? 0.009 : 0.007), xm + (up ? 0.25 : 0.15) * (q.x - p.x) * 0.3, up ? 1 : 0.35]); } } // (v5.73: thin - a dark suture, not a black bar)
  const nData = new Uint8Array(n * 4), cData = new Uint8Array(n * 4);
  for (let r = 0; r < Hh; r++) {
    const x = ((r + 0.5) / Hh) * Xh, dY = (2 / Wh) * hcR[r], rp = Math.min(Hh - 1, r + 1), rm = Math.max(0, r - 1);
    for (let c = 0; c < Wh; c++) {
      const k = r * Wh + c, a = ((c + 0.5) / Wh) * 2 - 1, hole = hf[k];
      const hx = (hgt[rp * Wh + c] - hgt[rm * Wh + c]) / ((rp - rm) * dX), hy = (hgt[r * Wh + ((c + 1) % Wh)] - hgt[r * Wh + ((c - 1 + Wh) % Wh)]) / (2 * dY);
      let nx = -hy, ny = -hx; const hl = holeAt(r + 1, c) - holeAt(r - 1, c), hh2 = holeAt(r, c + 1) - holeAt(r, c - 1); nx += hh2 * 0.35; ny += hl * 0.35; // (the rim of a pit)
      const l = Math.hypot(nx, ny, 1); nData[k * 4] = (nx / l * 0.5 + 0.5) * 255; nData[k * 4 + 1] = (ny / l * 0.5 + 0.5) * 255;
      const s = seeds[id1[k]] || {}, groove = 1 - sstep(0.12, 1.45, gdist[k]), hs = hash1(id1[k] + 1, 913), mn = vnoise(x / Hl * 120, a * 60, 2.1, 641), mn2 = vnoise(x / Hl * 300, a * 150, 5.3, 643); // (v5.88: softer grooves, wear)
      nData[k * 4 + 2] = clamp((1 - (H.groove != null ? H.groove * 0.8 : 0.34) * (s.k === 'lab' || s.k === 'ilab' ? (triL ? 0.4 : 0.5) : 1) * groove) * (0.89 + 0.18 * hs) * (0.95 + 0.08 * mn) * (1 - hole * 0.6), 0, 1) * 255; // cavity: the grooves dark (v5.62: shallower between viper lip scales)
      nData[k * 4 + 3] = clamp((s.small ? 0.62 : 0.5) + 0.12 * hs + 0.3 * groove + 0.22 * (mn - 0.5) + 0.16 * (mn2 - 0.5) + 0.1 * hash1(id1[k] + 1, 919), 0, 1) * 255; // roughness (v5.88: broken up - worn and dusty in patches, as real shields shine unevenly)
      // the colour layer
      let col = null, al = 0;
      const lab = s.k === 'lab' || s.k === 'ilab' || (s.k === 'rost' && Math.abs(a) > mA - 0.16) || s.k === 'ment';
      // (pale along the lips, fading out higher up the lip scales; v5.73: a soft wash from the mouth line, not filling each
      // lip scale to its top edge - a row of pale blocks with hard tops read as bared teeth)
      if (lipK && (lab || (x < J * Hl * 1.02 && Math.abs(Math.abs(a) - mA) < 0.1))) { const dm = Math.abs(Math.abs(a) - mA); col = lipC; al = lipK * (s.k === 'rost' && Math.abs(a) > mA - 0.16 ? 1 - sstep(0.06, 0.16, dm) * 0.6 : 1 - sstep(0.015, Math.abs(a) > mA ? 0.07 : bars ? 0.11 : 0.075, dm)) * (1 - sstep(J * 0.9, J * 1.02, x / Hl)); }
      // v5.78: head.lipFull - the whole upper and lower lip scales and the chin pale, with the sharp edge real green snakes have
      if (H.lipFull && x < J * Hl * 1.05) { const band = H.lipFull > 0.01 && H.lipFull < 1 ? H.lipFull : 0.12, aa2 = Math.abs(a); // (band: how far above the mouth line the upper lip scales are pale)
        // v5.88: the pale edge follows the real scales - the whole of each upper lip scale (and the lower part of the rostral)
        // is pale, and the green starts at the groove above it, not at a painted line across the scales
        let k2 = aa2 >= mA ? 1 : s.k === 'lab' ? 1 : s.k === 'rost' ? sstep(mA - band - 0.03, mA - band + 0.01, aa2) : 0;
        if (k2 > 0 && aa2 < mA && s.k === 'lab') { const s2 = seeds[id2[k]]; if (s2 && s2.k !== 'lab' && s2.k !== 'ilab' && s2.k !== 'rost') k2 *= 0.55 + 0.45 * sstep(0.2, 0.9, gdist[k]); } // (soft right at the suture)
        if (k2 > 0.001) { col = lipC; al = 0.95 * k2 * (1 - sstep(J * 0.92, J * 1.05, x / Hl)); } }
      if (bars && x < J * Hl * 1.05) { // dark bars along the sutures between lip scales, widest at the lip
        let bd = 1e9, bk = 1, aa = Math.abs(a); for (const b of barSegs) { if (Math.abs(x - b[0]) > b[3] * 3) continue; const t = clamp((aa - b[1]) / (b[2] - b[1]), 0, 1), w = lerp(b[3], b[3] * 0.45, t), e = Math.hypot(x - lerp(b[0], b[4], t), (aa - lerp(b[1], b[2], t)) * hcR[r]) / w; if (e < bd) { bd = e; bk = b[5]; } }
        if (bd < 1.4) { const w2 = 0.6 * bk * (1 - sstep(0.6, 1.3, bd)); col = col ? mixc(col, barC, w2 / Math.max(w2, al || w2)) : barC; al = Math.max(al, w2); } // (v5.73: bk - fainter and shorter on the lower lip; seen from below they read as teeth)
      }
      if (H.napeSpots) { const d = Math.hypot((x - Hl * 0.86) / (Hl * 0.035), (Math.abs(a) - 0.045) * hcR[r] / (Hl * 0.028)); if (d < 1.2) { col = lipC; al = 0.95 * (1 - sstep(0.7, 1.1, d)); } }
      if (hole > 0.01) { const hc2 = [18, 12, 10]; col = col ? mixc(col, hc2, hole) : hc2; al = Math.max(al, hole); }
      if (col) { cData[k * 4] = col[0]; cData[k * 4 + 1] = col[1]; cData[k * 4 + 2] = col[2]; cData[k * 4 + 3] = al * 255; }
    }
  }
  return { relief: nData, color: cData, Wh, Hh, Xh };
}
function headTex(d) {
  const mk = (a, srgb) => { const t = new THREE.DataTexture(a, d.Wh, d.Hh, THREE.RGBAFormat); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
  return { relief: mk(d.relief, false), color: mk(d.color, true), Xh: d.Xh };
}

// the colour pattern, generated from the profile's layers over the whole body (no tiling, no seam)
function patternTexture(P, F, body, lat, quality, seed) {
  const d = patternData(P, F, body, lat, quality, seed);
  return patternTex(d);
}
function patternTex(d) {
  const tex = new THREE.DataTexture(d.data, d.Wp, d.Hp, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}
// v4.81: the full-detail pattern is painted in a background worker (this same module) while the model is already
// on screen with a quick, coarser one; on its own the full one took 1-2 s before anything could be shown
function patternInWorker(P, quality, seed, hsq) {
  return new Promise((res, rej) => {
    let w; try { w = new Worker(import.meta.url, { type: 'module' }); } catch (e) { rej(e); return; }
    const t = setTimeout(() => { w.terminate(); rej(new Error('timeout')); }, 30000);
    w.onmessage = (e) => { clearTimeout(t); w.terminate(); if (e.data && e.data.data) res(e.data); else rej(new Error('worker')); };
    w.onerror = (e) => { clearTimeout(t); w.terminate(); rej(e); };
    w.postMessage({ slPattern: 1, P, quality, seed, hsq });
  });
}
if (typeof window === 'undefined' && typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = (e) => {
    const m = e.data; if (!m || !m.slPattern) return;
    try {
      const F = makeBodyFns(m.P, m.quality), g = girthOf(F), lat = scaleLattice(m.P, g.gTotal), d = patternData(m.P, F, g, lat, m.quality, m.seed);
      d.head = headData(m.P, F, m.quality); // v5.53: and the sharp head scales
      if (m.hsq) d.headH = headSkinHeights(m.P, F, headSkinGrid(F, m.hsq.xCut, m.hsq.M, m.hsq.hi)); // v5.83: and the sculpted head
      self.postMessage(d, [d.data.buffer, d.head.relief.buffer, d.head.color.buffer].concat(d.headH ? [d.headH.buffer] : []));
    } catch (err) { self.postMessage({ error: String(err) }); }
  };
}
function patternData(P, F, body, lat, quality, seed) {
  const Wp = quality === 'low' ? 192 : quality === 'preview' ? 160 : 512; // v4.72: twice as sharp on good devices
  const Hp = clamp(Math.round(body.gTotal * Wp * 0.62), 256, quality === 'high' ? 8192 : 2048);
  const C = P.colors, dors = hex(C.dorsal), latc = hex(C.lateral), bel = hex(C.belly);
  const bellyA = C.bellyA || 0.74, bs = C.bellySharp || 0.06, mott = C.mottle, vari = C.var;
  const deepK = C.deepen != null ? C.deepen : 0.95, satK = C.sat != null ? C.sat : 1.07;
  const Cref = refGirth(F); // v5.62: one mid-body girth, for marks spaced by length
  const lumc = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], chinUp = C.chin !== false && bellyA > 0.6 && lumc(bel) - lumc(latc) > 30;
  const layers = (P.pattern || []).filter((l) => l.type !== 'shields').map((l) => prepLayer(l, F, body)); // (v5.53: head plates are in the head textures)
  const quant = P.quant != null ? P.quant : 0.32; // v5.29: pattern edges follow the scales (a blotch edge is made of whole scales, stepped)
  const data = new Uint8ClampedArray(Wp * Hp * 4);
  const L = F.L, Hl = F.Hl;
  const tHead = (Hl * 1.15) / L;
  const cosA = new Float32Array(Wp), sinA = new Float32Array(Wp);
  for (let c = 0; c < Wp; c++) { const a = ((c + 0.5) / Wp) * 2 - 1; cosA[c] = Math.cos(Math.PI * a); sinA[c] = Math.sin(Math.PI * a); }
  for (let r = 0; r < Hp; r++) {
    const g = ((r + 0.5) / Hp) * body.gTotal, x = body.xOf(g), t = x / L, xn = x / Hl, xC = x / Cref;
    // v4.81: on the narrowing head the noise follows the real girth, so it does not streak towards the snout
    const rk = x < Hl * 1.6 ? clamp((F.W(x) + F.Hh(x)) / (F.W(Hl * 1.6) + F.Hh(Hl * 1.6)), 0.12, 1) : 1;
    for (let c = 0; c < Wp; c++) {
      const a = ((c + 0.5) / Wp) * 2 - 1, cl = lat.cell(a, g);
      const q = x < Hl * 1.1 ? 0.25 : quant;
      const aq = a + ((cl.qac != null ? cl.qac : cl.ac) - a) * q, gq = g + ((cl.qgc != null ? cl.qgc : cl.gc) - g) * q;
      const nx = Math.cos(Math.PI * aq) * 0.9 * rk, ny = Math.sin(Math.PI * aq) * 0.9 * rk;
      const wn = vnoise(nx * 2.2, ny * 2.2, gq * 4.1, seed) - 0.5, wn2 = vnoise(nx * 6, ny * 6, gq * 11, seed + 9) - 0.5;
      const warp = wn + wn2 * 0.45;
      const aa = Math.abs(aq);
      let col = mixc(dors, latc, sstep(0.18, 0.62, aa));
      // v5.58: under the head the pale belly colour reaches up to the lower lip (the chin and throat), as in most snakes with a
      // paler belly; it eases back down to the belly's own edge along the neck
      // (v5.73: to the lower lip only, with a soft edge - reaching higher, it drew a hard-edged pale band over the upper lip
      // scales, which read as a row of teeth; the pale upper lip is the head texture's own soft wash)
      // (and a belly colour that reaches high on the flanks stops at a narrow strip along the lip on the head - except in sea
      // snakes, whose pale lower half runs over the lips and the side of the head, as in the yellow-bellied sea snake)
      const hk = P.plan === 'sea' ? 0 : 1 - sstep(Hl * 0.85, Hl * 1.7, x), bA = Math.max(chinUp ? lerp(0.66, bellyA, 1 - hk) : bellyA, lerp(bellyA, 0.53, hk)), bs2 = bs + 0.03 * hk;
      col = mixc(col, bel, sstep(bA - bs2, bA + bs2, aa + warp * (C.bellyWarp || 0.04)));
      const m = 1 + mott * (fbm(nx * 3, ny * 3, gq * 5.5, seed + 3, 3) - 0.5) * 2.4;
      col = [col[0] * m, col[1] * m, col[2] * m];
      for (const Ly of layers) {
        if (Ly.head) { if (xn > (Ly.xMax || 2.2)) continue; } else if (t < Ly.t0 - 0.02 || t > Ly.t1 + 0.02) continue; // (v5.62: head and neck marks may reach further back - hood marks, throat bands)
        // v5.62 (model accuracy): marks fade out softly at the edge of the belly (they were cut along a straight line); a band
        // can stop at the belly (aMax) or be on the throat and belly only (aMin), true rings go right round
        let fb = 1;
        if (Ly.aMin) { fb = sstep(Ly.aMin - 0.04, Ly.aMin + 0.04, aa + warp * 0.04); if (Ly.aMax != null) fb *= 1 - sstep(Ly.aMax - 0.04, Ly.aMax + 0.04, aa); if (fb <= 0) continue; }
        else if (Ly.type === 'band') { if (Ly.aMax != null) { fb = 1 - sstep(Ly.aMax - 0.06, Ly.aMax + 0.06, aa + warp * 0.08); if (fb <= 0) continue; } }
        else if (!Ly.belly) { fb = 1 - sstep(bellyA - 0.05, bellyA + 0.05, aa + warp * 0.03); if (fb <= 0) continue; }
        const res = evalLayer(Ly, aq, gq, t, xn, warp, cl, seed, xC);
        if (res) col = mixc(col, res[0], res[1] * fb);
      }
      const sv = 1 + (vari != null ? vari : 0.05) * (hash1(cl.id, seed + 5) - 0.5) * 2 * (0.2 + 0.8 * cl.w) /* v5.58 (rendering): no forced floor (it was +-8%): each species' own var */ * sstep(Hl * 0.95, Hl * 1.15, x); // (v4.81: none on the head, where the body's scale cells would show as stripes)
      col = [col[0] * sv, col[1] * sv, col[2] * sv];
      if (C.scaleEdge && !cl.v && x > Hl * 1.05) col = mixc(col, hex(C.scaleEdge.color), (C.scaleEdge.k || 0.8) * Math.pow(1 - cl.w, 1.6));
      // v5.18: every scale reads as a scale - a soft darker rim round each dorsal scale (the skin between scales), and the
      // edge of each wide belly scute; snakes with granular or glassy skin (file snakes, blind snakes) much less
      else if (x > Hl * 1.05 && !C.noEdge) {
        const kE = (P.scales.kind === 'juxta' || P.scales.kind === 'cycloid' ? 0.12 : 0.3) * (C.edgeK != null ? C.edgeK : 1) * (0.45 + 1.1 * hash1(cl.id, seed + 17)); // v5.29: no two scales alike - each its own edge
        // a few scales carry tiny flecks of a darker or paler tone, and some a lighter rim, as in close-up photos
        if (!cl.v && C.flecks !== 0) { // (v5.58: none on snakes whose scales are clean, plain and glossy)
          const hf = hash1(cl.id, seed + 19);
          if (hf < 0.3 && hash3(r, c, 7, seed + 23) < 0.06 * cl.w) { const k2 = hf < 0.15 ? 0.72 : 1.18; col = [col[0] * k2, col[1] * k2, col[2] * k2]; }
          if (hf > 0.85) col = mixc(col, [Math.min(255, col[0] * 1.25), Math.min(255, col[1] * 1.25), Math.min(255, col[2] * 1.25)], 0.5 * Math.pow(1 - cl.w, 3));
        }
        if (!cl.v) col = mixc(col, [col[0] * 0.5, col[1] * 0.5, col[2] * 0.5], kE * Math.pow(1 - cl.w, 2.2));
        else {
          const vy = Math.abs(g - cl.gc) / lat.Pt; col = mixc(col, [col[0] * 0.55, col[1] * 0.55, col[2] * 0.55], kE * 1.4 * Math.exp(-(((0.5 - vy) / 0.07) ** 2)));
          // v5.23: under the tail the scutes are paired (subcaudals): a seam down the middle, the pairs offset by half a scute
          if (x > L * (1 - (P.body.tail || 0.12)) && !P.body.blunt) { const am = 1 - aa; col = mixc(col, [col[0] * 0.5, col[1] * 0.5, col[2] * 0.5], kE * 1.6 * Math.exp(-((am / 0.012) ** 2))); }
        }
      }
      // v5.35: dot - one small spot centred on each scale, as in speckled kingsnakes
      // v5.99 (Eduardo: "not the same pattern over and over"): no two spots alike and no repeat along the body - in photos of
      // speckled kingsnakes each scale's spot has its own size (a pin-prick to most of the scale), brightness and place, a few
      // scales have none, and the spots come in patches that are denser and bolder or sparser and fainter. So each scale's
      // spot takes its own size, brightness, tint and offset from the scale's own hash, a slow noise along and round the body
      // sets how many and how big, and a fine noise roughens each spot's outline (all seeded by position: nothing repeats)
      if (C.speckle && !cl.v && x > Hl) {
        const Sp = C.speckle, hs = hash1(cl.id, seed + 11), h2 = hash1(cl.id, seed + 12), h3 = hash1(cl.id, seed + 13);
        const nf = vnoise(nx * 1.7, ny * 1.7, gq * 1.6, seed + 71), nf2 = vnoise(nx * 3.3, ny * 3.3, gq * 3.4, seed + 73);
        const pE = Sp.vary === 0 ? Sp.p : Math.min(Sp.p >= 0.999 ? 0.96 : 1, Sp.p * (0.64 + 0.62 * nf));
        if (hs < pE) {
          let cov;
          if (Sp.dot) {
            // the spot sits a little off the scale's centre (its own way on each scale), with a ragged edge
            const ox = (h3 - 0.5) * 0.35 * lat.rw, oy = (h2 - 0.5) * 0.3 * lat.Pt, c2 = lat.cell(a - ox, g - oy);
            const w2 = (c2.id === cl.id ? c2.w : cl.w * 0.5) + (vnoise(a / lat.rw * 3.1, g / lat.Pt * 3.1, h2 * 7, seed + 77) - 0.5) * 0.26;
            const thr = clamp(Sp.dot + (Sp.vary === 0 ? 0 : (h2 - 0.5) * 0.9 + (0.5 - nf2) * 0.5 - 0.16 * sstep(0.3, 0.68, aa) + 0.08 * (1 - sstep(0.1, 0.3, aa))), 0.12, 0.95); // (bigger on the flanks, as in photos)
            cov = sstep(thr, thr + 0.16, w2);
          } else cov = Math.sqrt(cl.w) * (Sp.vary === 0 ? 1 : sstep(0.15, 0.4, cl.w + (h3 - 0.5) * 0.3));
          const sc = hex(Sp.color), b = Sp.vary === 0 ? 1 : 0.86 + 0.24 * h3;
          const k = Math.min(1, (Sp.k || 0.6) * (Sp.vary === 0 ? 0.6 + hs / Sp.p * 0.4 : 0.62 + 0.3 * h2 + 0.2 * nf));
          col = mixc(col, [Math.min(255, sc[0] * b), Math.min(255, sc[1] * b), Math.min(255, sc[2] * (b + (h3 - 0.5) * 0.12))], k * cov);
        }
      }
      // v5.93: side by side with photos the models read a little pale and washed out under the scene's light: the skin's colour a
      // touch deeper and richer (colors.deepen / colors.sat per species)
      const lm = 0.2126 * col[0] + 0.7152 * col[1] + 0.0722 * col[2];
      const k = (r * Wp + c) * 4; data[k] = (lm + (col[0] - lm) * satK) * deepK; data[k + 1] = (lm + (col[1] - lm) * satK) * deepK; data[k + 2] = (lm + (col[2] - lm) * satK) * deepK; data[k + 3] = 255;
    }
  }
  // v5.12: the texture wraps round the body, so towards the snout tip (where the girth shrinks to nothing) every
  // marking bunches up into a dark star on the front of the head. The rounded tip (the rostral scale) takes the
  // colours the snout has a little further back instead: dorsal colour on top, the lip colour round the sides
  // v5.17: and on the whole rounded nose the skin is one smooth colour field - dorsal colour on top, the lip and chin colour
  // below, meeting in a clean lip line across the front - with no per-scale cells (they fanned out into a star there)
  const xN0 = Hl * 0.1, xN1 = Hl * 0.26;
  // (v6.26: the field's colours are those the snout really has just behind it - the average of the top and of the sides of the
  // first row past the tip - not the body's plain dorsal colour: a coral snake's black snout came out red, a dark-headed
  // snake's snout pale)
  let rN = 0; while (rN < Hp - 1 && body.xOf(((rN + 0.5) / Hp) * body.gTotal) < xN1) rN++;
  const topC = [0, 0, 0], sideC = [0, 0, 0], lipR = [0, 0, 0]; let nT = 0, nS = 0, nL = 0;
  for (let c = 0; c < Wp; c++) { const aa = Math.abs(((c + 0.5) / Wp) * 2 - 1), k = (rN * Wp + c) * 4, to = aa < 0.35 ? topC : aa > 0.4 && aa < 0.52 ? sideC : aa > 0.57 && aa < 0.7 ? lipR : null; if (!to) continue; for (let q = 0; q < 3; q++) to[q] += data[k + q]; if (to === topC) nT++; else if (to === sideC) nS++; else nL++; }
  for (let q = 0; q < 3; q++) { topC[q] /= Math.max(1, nT); sideC[q] /= Math.max(1, nS); lipR[q] /= Math.max(1, nL); }
  for (let r = 0; r < Hp; r++) {
    const x = body.xOf(((r + 0.5) / Hp) * body.gTotal); if (x >= xN1) break;
    const w = x <= xN0 ? 1 : 1 - sstep(xN0, xN1, x);
    for (let c = 0; c < Wp; c++) {
      const aa = Math.abs(((c + 0.5) / Wp) * 2 - 1), base = mixc(mixc(topC, sideC, sstep(0.18, 0.5, aa)), lipR, sstep(0.52, 0.62, aa)), k = (r * Wp + c) * 4;
      for (let q = 0; q < 3; q++) data[k + q] = data[k + q] + (base[q] - data[k + q]) * w; // (they already have the deepening)
    }
  }
  // (v5.53: the lip line, lip scales, nostrils and heat pits are drawn by headData)
  return { data, Wp, Hp };
}

function prepLayer(l, F, body) {
  const o = Object.assign({ t0: (F.Hl * 1.25) / F.L, t1: 1, a: 0, wid: 0.3, len: 0.6, phase: 0, warp: 0.5, edge: 0, aa: 0.1, jit: 0.12, sj: 0.18, aj: 0.05 }, l);
  if (l.t) { o.t0 = l.t[0]; o.t1 = l.t[1]; }
  o.col = hex(o.color); o.ecol = o.edgeColor ? hex(o.edgeColor) : null; o.icol = o.inner ? hex(o.inner.color) : null;
  o.head = ['line', 'poly', 'spot', 'cap', 'shields', 'ring', 'hband'].includes(o.type);
  if (!o.head && o.type !== 'tint' && o.type !== 'checker') o.t0 = Math.max(o.t0, (F.Hl * 0.97) / F.L); // v5.53: body markings start behind the head plates (a stripe ran on over the crown)
  o.g0 = body.gOf(o.t0 * F.L); o.g1 = body.gOf(o.t1 * F.L);
  // v5.62 (model accuracy): marks along the body are spaced by a mix of girth and length (space: 'girth' | 'length' | 'mix'),
  // so a thin tail no longer ends in a barcode of tiny bands - real snakes have about as many scales between marks there
  const Cref = refGirth(F);
  o.m = o.space === 'girth' ? 0 : o.space === 'length' ? 1 : o.space != null && typeof o.space === 'number' ? o.space : 0.6;
  o.s0 = lerp(o.g0, (o.t0 * F.L) / Cref, o.m); o.s1 = lerp(o.g1, (o.t1 * F.L) / Cref, o.m);
  if (o.count) o.period = (o.s1 - o.s0) / o.count;
  if (o.speck) o.scol = hex(o.speck.color); if (o.fill) o.fcol = hex(o.fill);
  if (o.type === 'poly' && o.pts) o.pts2 = o.pts;
  return o;
}
function refGirth(F) { // v5.62: the girth round the thickest part of the body (cached on F)
  if (F._cref) return F._cref; let c = 0;
  for (let i = 0; i <= 48; i++) { const x = F.L * (0.2 + 0.6 * i / 48), a = F.W(x), b = F.Hh(x); c = Math.max(c, Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))); }
  return (F._cref = c);
}
function shapeD(shape, dv, da, L) {
  const v = Math.abs(dv), u = Math.abs(da), vk = (L && L.vk) || 1.1; // (v5.88: L.vk - how far a chevron's arms run forward; L.h0/h1 - an hourglass's waist and flare)
  switch (shape) {
    case 'diamond': return v + u;
    case 'rect': return Math.pow(v ** 4 + u ** 4, 0.25);
    case 'hourglass': return Math.max(v / (0.35 + 0.65 * u), u);
    case 'hourglass2': return Math.max(v / ((L && L.h0 != null ? L.h0 : 0.18) + (L && L.h1 != null ? L.h1 : 0.82) * u * u), u); // v5.19: copperhead crossbands - narrow over the spine, wide on the flanks
    case 'chevron': return Math.max(Math.abs(dv + vk * u), u); // a V whose arms run forward down the flanks (apex toward the tail)
    case 'chevronF': return Math.max(Math.abs(dv - vk * u), u); // v5.62: a V pointing forward, its arms running back down the flanks (king cobra)
    case 'chevronU': return Math.max(Math.abs(dv + vk * u * u), u); // v5.93: a rounded U (apex toward the tail), flat over the spine, the arms curving forward (puff adder)
    case 'saddle': return Math.max(Math.pow(v ** 3 + u ** 3, 1 / 3), u);
    case 'round': return Math.pow(v ** 2.6 + u ** 2.6, 1 / 2.6);
    default: return Math.sqrt(v * v + u * u);
  }
}
function cover(d, aa) { return 1 - sstep(1 - aa, 1 + aa, d); }
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
function inPoly(x, y, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }

function evalLayer(Ly, a, g0, t, xn, warp, cl, seed, xC) {
  const g = Ly.m && xC != null ? g0 + (xC - g0) * Ly.m : g0; // (v5.62: the spacing coordinate, girth and length mixed)
  if (Ly.type === 'checker') {
    // chequered belly: each ventral plate is dark on one side and light on the other, alternating
    if (!cl.v) return null; const j = Math.floor(cl.id / 7919), side = cl.id % 7919;
    if (((j + side) & 1) === 0 && hash1(j * 13 + side, seed + 41) > (Ly.skip || 0)) return [Ly.col, (Ly.alpha || 0.9) * (0.75 + 0.25 * hash1(j, seed + 43))];
    return null;
  }
  const fadeT = Ly.head ? 1 : sstep(Ly.t0 - 0.02, Ly.t0 + 0.01, t) * (1 - sstep(Ly.t1 - 0.01, Ly.t1 + 0.02, t));
  if (fadeT <= 0) return null;
  const sides = Ly.mirror ? [1, -1] : [1];
  let best = null;
  if (Ly.type === 'stripe') {
    for (const sg of sides) { const d = Math.abs(a - Ly.a * sg + warp * Ly.warp * 0.05) / Ly.wid; const c = cover(d, Ly.aa) * fadeT; if (c > 0.001 && (!best || c > best[1])) best = [Ly.col, c * (Ly.alpha || 1)]; }
    return best;
  }
  if (Ly.type === 'tint') {
    const aw = Ly.aRange || [0, 1]; const k = sstep(Ly.t0, Ly.t0 + (Ly.ramp || 0.1), t) * (1 - sstep(Ly.t1 - (Ly.fade || 0.001), Ly.t1, t)) /* (v5.58: fade - a soft end) */ * (Math.abs(a) >= aw[0] && Math.abs(a) <= aw[1] ? 1 : 0);
    return k > 0 ? [Ly.col, k * (Ly.alpha || 1)] : null;
  }
  if (Ly.type === 'zigzag') {
    for (const sg of sides) {
      // v5.99 (no repeats): the zigzag's turns drift along the body and each has its own reach (an adder's zigzag is irregular)
      const p0 = (g - Ly.s0) / Ly.period, dr = Ly.drift != null ? Ly.drift : 0.25, ph = p0 + Ly.phase + (sg < 0 && Ly.alt ? 0.5 : 0) + dr * (vnoise(p0 * 0.41, sg, 2.5, seed + 95) - 0.5) * 2, tri = 2 * Math.abs(2 * (ph - Math.floor(ph + 0.5))) - 1;
      const ac = (Ly.a + Ly.amp * tri * (1 + dr * (vnoise(ph * 2, sg, 4.5, seed + 97) - 0.5))) * sg + warp * Ly.warp * 0.06, w = Ly.wid * (1 + warp * 0.3);
      const d = Math.abs(a - ac) / w;
      let r = null;
      if (Ly.ecol && d < 1 + Ly.edge + Ly.aa && d >= 1 - Ly.aa) r = [Ly.ecol, (1 - sstep(1 + Ly.edge - Ly.aa, 1 + Ly.edge + Ly.aa, d)) * fadeT];
      else { const c = cover(d, Ly.aa) * fadeT; if (c > 0.001) r = [Ly.col, c * (Ly.alpha || 1)]; }
      if (r && (!best || r[1] > best[1])) best = r;
    }
    return best;
  }
  if (Ly.type === 'line' || Ly.type === 'spot' || Ly.type === 'poly' || Ly.type === 'cap' || Ly.type === 'ring' || Ly.type === 'hband') {
    // head markings: xn = position along the head (0 snout tip, 1 back of the head), a = around
    for (const sg of sides) {
      let c = 0;
      if (Ly.type === 'line') { const d = segDist(xn, a * sg, Ly.p0[0], Ly.p0[1], Ly.p1[0], Ly.p1[1]) / Ly.wid; c = cover(d + warp * Ly.warp * 0.3, Ly.aa); }
      else if (Ly.type === 'spot') { const d = Math.hypot((xn - Ly.p[0]) / Ly.r[0], (a * sg - Ly.p[1]) / Ly.r[1]); c = cover(d + warp * Ly.warp * 0.3, Ly.aa); }
      else if (Ly.type === 'cap') { const cs = Ly.soft || 0.06; c = (1 - sstep(Ly.x1 - cs, Ly.x1 + cs, xn + warp * 0.1 * (1 + cs * 6) - (Ly.vee || 0) * (1 - Math.abs(a)))) * sstep(Ly.x0 - 0.03, Ly.x0 + 0.03, xn) * (1 - sstep(Ly.wid - 0.04, Ly.wid + 0.04, Math.abs(a) + warp * 0.05)); }
      // v5.62 (model accuracy): a ring (the cobra's spectacle and monocle: a dark outline, often pale inside) and a band
      // across the neck or throat measured in head lengths (x0-x1), limited round the body by the aMin/aMax fade
      else if (Ly.type === 'ring') {
        const d = Math.hypot((xn - Ly.p[0]) / Ly.r[0], (a * sg - Ly.p[1]) / Ly.r[1]) + warp * Ly.warp * 0.12;
        c = cover(Math.abs(d - 1) / (Ly.w || 0.25), Ly.aa);
        if (Ly.fcol && d < 1) { const cf = cover(d / Math.max(0.05, 1 - (Ly.w || 0.25)), Ly.aa); if (cf > c && (!best || cf * (Ly.falpha || 1) > best[1])) { best = [Ly.fcol, cf * (Ly.falpha || 1)]; continue; } }
      }
      else if (Ly.type === 'hband') { const e = Ly.soft || 0.12, w = warp * Ly.warp * 0.25; c = sstep(Ly.x0 - e, Ly.x0 + e, xn + w) * (1 - sstep(Ly.x1 - e, Ly.x1 + e, xn + w)); if (sg < 0) c = 0; }
      else { c = inPoly(xn + warp * Ly.warp * 0.05, a * sg, Ly.pts2) ? 1 : 0; }
      if (c > 0.001 && (!best || c > best[1])) best = [Ly.col, c * (Ly.alpha || 1)];
    }
    return best;
  }
  // v5.19: a net of dark lines (reticulated python) and the chain of kingsnakes: pale crossbands over the back that fork
  // on the flanks and join their neighbours (a chain-link pattern). per: length of one link; na: links around the body
  if (Ly.type === 'net' || Ly.type === 'chain') {
    const per = Ly.period; if (!per) return null;
    // v5.99 (no repeats): the links are not evenly spaced - a slow drift along the body stretches and squeezes them - and
    // each link's line has its own width (real chains and nets are irregular: bands fork, thicken and thin)
    const u0 = (g - Ly.s0) / per, dr = Ly.drift != null ? Ly.drift : 0.3;
    const u = u0 + Ly.phase + warp * Ly.warp * 0.25 + dr * (vnoise(u0 * 0.43, 0.5, 1.5, seed + 91) - 0.5) * 2, aa = Math.abs(a), na = Ly.na || 2.2;
    const fr = (z) => Math.abs(z - Math.floor(z + 0.5)); // distance to the nearest whole number
    const wv = Ly.wid * (dr ? 0.8 + 0.4 * vnoise(u * 1.0 + 0.5, aa * 2.5, 3.5, seed + 93) : 1);
    let d;
    if (Ly.type === 'net') { const v = aa * na; d = Math.min(fr(u + v), fr(u - v)) / wv; }
    else { const a0 = Ly.a0 != null ? Ly.a0 : 0.32; d = aa < a0 ? fr(u) / wv : Math.min(fr(u + (aa - a0) * na), fr(u - (aa - a0) * na)) / wv; if (aa > (Ly.a1 || 0.8)) d = 9; }
    let c = cover(d, Ly.aa || 0.25), col = Ly.col;
    if (Ly.ecol && d >= 1 - Ly.aa && d < 1 + Ly.edge + Ly.aa) { const ce = 1 - sstep(1 + Ly.edge - Ly.aa, 1 + Ly.edge + Ly.aa, d); if (ce > c) { col = Ly.ecol; c = ce; } }
    c *= fadeT * (Ly.alpha || 1);
    return c > 0.001 ? [col, c] : null;
  }
  // periodic marks: blotch / band / diamond ... along the body
  const per = Ly.period; if (!per) return null;
  for (const sg of sides) {
    const ph = Ly.phase + (Ly.alt && sg < 0 ? 0.5 : 0);
    const k0 = Math.floor((g - Ly.s0) / per - ph);
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const r1 = hash1(k * 3 + (sg < 0 ? 101 : 0), seed + 21), r2 = hash1(k * 5 + 7 + (sg < 0 ? 211 : 0), seed + 22), r3 = hash1(k * 11 + 3, seed + 23);
      if (Ly.skip && r3 < Ly.skip) continue;
      // v5.99 (no repeats): besides each mark's own jitter, a slow drift shifts runs of neighbouring marks closer together or
      // further apart (real spacing waxes and wanes along the body), each mark gets its own width as well as its own size,
      // and a band runs a little askew or bulges on one side - less in snakes whose rings are regular (kraits, coral snakes:
      // drift / tilt per layer)
      const r4 = hash1(k * 13 + 5 + (sg < 0 ? 307 : 0), seed + 24), r5 = hash1(k * 17 + 11 + (sg < 0 ? 401 : 0), seed + 25);
      if (Ly.count === 1 && k !== 0) continue; // (v5.99: a single mark - a collar - is just that one, not its neighbours just outside its range)
      const dr = Ly.count <= 2 ? 0 : Ly.drift != null ? Ly.drift : Ly.type === 'band' ? 0.1 : 0.22;
      const gc = Ly.s0 + (k + ph + 0.5 + (r1 - 0.5) * Ly.jit * 2 + dr * (vnoise(k * 0.37 + 0.5, sg, 0.5, seed + 26) - 0.5) * 2) * per;
      const sz = 1 + (r2 - 0.5) * Ly.sj * 2, szw = sz * (1 + (r5 - 0.5) * (Ly.wj != null ? Ly.wj : 0.24));
      const halfLen = (Ly.len * per) / 2 * sz;
      const ac = Ly.type === 'band' ? 0 : (Ly.a + (r1 - 0.5) * Ly.aj * 2) * sg;
      const dv = (g - gc) / halfLen;
      if (Math.abs(dv) > 2.2 + (Ly.vk || 0) + (Ly.h1 || 0) * 0.6) continue;
      let d;
      if (Ly.type === 'band') { const tl = (Ly.tilt != null ? Ly.tilt : 0.35) * (r4 - 0.5); d = Math.abs(dv + tl * a + tl * 0.6 * (r5 - 0.5) * Math.abs(a)) + warp * Ly.warp * 0.5 + (Ly.dorsalWide ? -Ly.dorsalWide * (1 - Math.abs(a)) : 0); }
      else d = shapeD(Ly.shape, dv, (a - ac) / (Ly.wid * szw), Ly) + warp * Ly.warp;
      let col = null, c = 0;
      if (Ly.icol && d < Ly.inner.r) { col = Ly.icol; c = cover(d / Ly.inner.r, Ly.aa * 2); col = mixc(Ly.col, Ly.icol, c); c = 1; }
      else if (d < 1 + Ly.aa) { col = Ly.col; c = cover(d, Ly.aa); if (Ly.scol && d < 1 - Ly.aa && hash1(cl.id, seed + 61 + k) < Ly.speck.p) col = Ly.scol; } // (v5.62: speck - pale flecks on some scales inside a mark, as in longnose snakes)
      if (Ly.ecol) {
        const eo = Ly.edgeOut;
        if (eo && d >= 1 - Ly.aa && d < 1 + Ly.edge + Ly.aa) { const ce = cover(d / (1 + Ly.edge), Ly.aa * 0.7) * (d > 1 - Ly.aa ? sstep(1 - Ly.aa, 1 + Ly.aa, d) : 0); if (ce > c) { col = Ly.ecol; c = Math.max(c, ce); } }
        if (!eo && d < 1 + Ly.aa && d > 1 - Ly.edge - Ly.aa) { const ce = sstep(1 - Ly.edge - Ly.aa, 1 - Ly.edge + Ly.aa, d) * cover(d, Ly.aa); col = mixc(col || Ly.col, Ly.ecol, ce / Math.max(c, 1e-3)); }
      }
      c *= fadeT * (Ly.alpha || 1);
      if (col && c > 0.001 && (!best || c > best[1])) best = [col, c];
    }
  }
  return best;
}

// v4.72: real coloured eyes, not dark dots - each group's typical iris colour (golden in vipers and
// pythons, amber in most colubrids, bronze in elapids), kept bright even on a dark snake
// v6.20: the family defaults muted - a bright gold iris round a black pupil on every unchecked snake read as a cartoon
// target; most snakes' irises are bronze to brown, finely flecked, only a little paler round the pupil
const IRIS = { viper: ['#b08a44', '#d8b872'], pitviper: ['#b49046', '#dcc078'], python: ['#957046', '#c49d64'], colubrid: ['#86602f', '#b88d4c'],
  elapid: ['#6e5232', '#a17c4a'], sea: ['#7a6c4c', '#ad9c70'], blind: ['#5a4a3a', '#8a7a62'] };
function brightIris(P) {
  const def = IRIS[P.plan] || IRIS.colubrid, H = P.head || {};
  let c = new THREE.Color(H.iris || def[0]), inner = new THREE.Color(H.irisInner || def[1]);
  if (H.irisDark) return ['#' + c.getHexString(), '#' + inner.getHexString()]; // v4.81: some snakes really have a near-black iris (green snakes)
  const hsl = {}; c.getHSL(hsl); if (hsl.l < 0.3) c.setHSL(hsl.h, Math.max(hsl.s, 0.4), 0.34); // a dark iris read as a black dot (v6.20: only lifted a little)
  // v5.88: vipers' and pit vipers' irises are gold to copper in photos (a grey-brown one read as a dull disc)
  if (P.plan === 'viper' || P.plan === 'pitviper') { c.getHSL(hsl); if (hsl.s < 0.38) c.setHSL(hsl.h > 0.02 && hsl.h < 0.16 ? hsl.h : 0.1, 0.38, Math.max(0.46, hsl.l)); }
  inner.getHSL(hsl); { const cl = {}; c.getHSL(cl); const want = Math.min(0.56, cl.l + 0.14); if (hsl.l < want) inner.setHSL(hsl.h, Math.max(hsl.s, 0.4), want); } // (v6.20: a little paler than the iris, not a cream ring)
  return ['#' + c.getHexString(), '#' + inner.getHexString()];
}
// v4.81: the iris drawn like a real snake's - fine radial fibres and flecks, a darker rim, the pupil the species has
// (round, vertical slit, or the horizontal keyhole of vine snakes), an optional pale ring or a dark stripe through it
const EYE_TEX = new Map();
function eyeTexture(P) {
  const H = P.head, [iris, irisIn] = brightIris(P), key = [iris, irisIn, H.pupil, H.eyeStripe, H.eyeRing, H.pupilW].join('|');
  if (!EYE_TEX.has(key)) {
    const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d'), R = rng(strSeed(key));
    const C = S / 2, RI = S * 0.47;
    x.fillStyle = '#070605'; x.fillRect(0, 0, S, S);
    const g = x.createRadialGradient(C, C, S * 0.04, C, C, RI);
    g.addColorStop(0, irisIn); g.addColorStop(0.6, iris); g.addColorStop(0.9, shade(iris, 0.74)); g.addColorStop(0.985, shade(iris, 0.4)); g.addColorStop(1, '#070605'); // (v5.88: a thinner, less black rim)
    x.fillStyle = g; x.beginPath(); x.arc(C, C, RI, 0, TAU); x.fill();
    // radial fibres, then small dark and gold flecks
    for (let i = 0; i < 520; i++) { const a = R() * TAU, r0 = RI * (0.18 + R() * 0.4), r1 = r0 + RI * (0.12 + R() * 0.38); x.strokeStyle = R() < 0.55 ? 'rgba(0,0,0,.16)' : 'rgba(255,244,210,.13)'; x.lineWidth = 0.6 + R() * 1.6; x.beginPath(); x.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0); x.quadraticCurveTo(C + Math.cos(a + 0.05) * (r0 + r1) / 2, C + Math.sin(a + 0.05) * (r0 + r1) / 2, C + Math.cos(a) * r1, C + Math.sin(a) * r1); x.stroke(); }
    for (let i = 0; i < 90; i++) { const a = R() * TAU, r = RI * (0.25 + R() * 0.62); x.fillStyle = R() < 0.6 ? 'rgba(10,6,2,.22)' : 'rgba(255,236,170,.18)'; x.beginPath(); x.arc(C + Math.cos(a) * r, C + Math.sin(a) * r, 1 + R() * 3.5, 0, TAU); x.fill(); }
    if (H.eyeStripe) { x.save(); x.beginPath(); x.arc(C, C, RI, 0, TAU); x.clip(); x.fillStyle = H.eyeStripe; x.globalAlpha = 0.78; x.fillRect(0, S * 0.37, S, S * 0.26); x.restore(); }
    if (H.eyeRing) { x.strokeStyle = H.eyeRing; x.lineWidth = S * 0.016; x.globalAlpha = 0.85; x.beginPath(); x.arc(C, C, RI * 0.84, 0, TAU); x.stroke(); x.globalAlpha = 1; } // (v5.58: inside the rim the spectacle's edge tints, so it shows)
    // the pupil, with a soft dark halo so its edge is not a hard cut-out
    const pupil = (grow, col) => { x.fillStyle = col; x.beginPath();
      if (H.pupil === 'slit') x.ellipse(C, C, S * (H.pupilW || 0.045) + grow, S * 0.36 + grow, 0, 0, TAU);
      else if (H.pupil === 'hslit') { x.ellipse(C, C, S * 0.3 + grow, S * 0.07 + grow, 0, 0, TAU); x.ellipse(C, C, S * 0.11 + grow, S * 0.11 + grow, 0, 0, TAU); }
      else if (H.pupil === 'round') x.arc(C, C, S * (H.pupilW || 0.2) + grow, 0, TAU);
      x.fill(); };
    if (H.pupil && H.pupil !== 'none') { pupil(S * 0.018, 'rgba(0,0,0,.35)'); pupil(0, '#020202'); }
    // v5.78: no painted catch-light any more - the clear spectacle over the eye reflects the real sky and sun (buildEyes), so
    // the highlight moves as you go round the head; a soft shadow inside the rim instead, where the socket's edge overhangs
    { const rs = x.createRadialGradient(C, C, RI * 0.7, C, C, RI); rs.addColorStop(0, 'rgba(0,0,0,0)'); rs.addColorStop(1, 'rgba(0,0,0,.28)'); x.fillStyle = rs; x.beginPath(); x.arc(C, C, RI, 0, TAU); x.fill(); }
    EYE_TEX.set(key, cv);
  }
  const t = new THREE.CanvasTexture(EYE_TEX.get(key)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------- v4.81: the eyes ----------
// Each eye is a shallow dome laid on the head's own surface (not a ball pushed into it): its rim is tucked
// under the skin of a gentle socket (see buildBody) and its top rises only a hair above the head's outline,
// so it can never stand out from any side. Over it lies the spectacle (brille), the clear scale snakes have
// instead of eyelids: a glossy cap that blends into the skin colour of the scales round the eye.
function buildEyes(P, F, body, pat) {
  const H = P.head, xe = H.eyeX * F.Hl, R0 = body.eyeRad, NR = 22, NA = 56, out = [];
  const et = eyeTexture(P); et.wrapS = et.wrapT = THREE.ClampToEdgeWrapping;
  // v5.53: the eye under it is not shiny itself (a broad sheen over the iris made it look like a pale painted disc); the
  // spectacle on top gives the small sharp highlight
  // v5.78: a real cornea. The iris lies deep in the socket (a little cupped, matt); over it the spectacle is a clear curved dome
  // that only REFLECTS - black, glossy and added on top of what is under it (additive), so it is fully see-through yet keeps all
  // its reflections of the sky and the sun, strongest at grazing angles (Fresnel). The gap between them gives the eye depth:
  // the iris shifts under the dome as you go round the head.
  // (the iris lies in the socket's shade: a faint glow of its own colours stands in for the light that reaches it through the
  // clear spectacle from every side, so its fibres and the pupil's edge still read - it was a black hole)
  const em = new THREE.MeshPhysicalMaterial({ map: et, emissiveMap: et, emissive: new THREE.Color(0.2, 0.2, 0.2), roughness: 0.5, /* v6.20: about half - a self-lit iris glowed as a pale painted disc in the shaded socket */ metalness: 0, envMapIntensity: 0.3, specularIntensity: 0.35 });
  const sm = new THREE.MeshPhysicalMaterial({ color: '#000000', vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, roughness: 0.05, metalness: 0, ior: 1.4, specularIntensity: 0.85 * (H.specK || 1), envMapIntensity: 1.5 * (H.specK || 1), /* v6.20: restrained - the whole eye flashed white from most angles */ depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const lm = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.6, metalness: 0, depthWrite: false, envMapIntensity: 0.8 });
  // the skin colour right round the eye, read from the body's own pattern texture
  const img = pat && pat.image, skinAt = (x, th) => {
    if (!img || !img.data) return [0.4, 0.4, 0.35];
    const u = clamp((th + Math.PI) / TAU, 0, 0.999), v = clamp(body.gOf(x) / body.gTotal, 0, 0.999), k = (Math.floor(v * img.height) * img.width + Math.floor(u * img.width)) * 4;
    const lin = (c) => Math.pow(c / 255, 2.2); return [lin(img.data[k]), lin(img.data[k + 1]), lin(img.data[k + 2])];
  };
  const bulge = H.bulge != null ? H.bulge : 0.06; // how far the spectacle rises above the head's outline (in eye radii; v5.73: flush with the head, not a bulging ball)
  for (const sg of [1, -1]) {
    const th0 = sg * body.eyeA, c = body.surf(xe, th0, true).p;
    // v5.78: the eye is round on the skin itself - the grid's steps round the head and along it are measured on the surface
    // there (the head's average radius made it an oval or a teardrop on a flat-sided head)
    const eA0 = 0.01, arcA = body.surf(xe, th0 + eA0, true).p.distanceTo(body.surf(xe, th0 - eA0, true).p) / (2 * eA0), arcX = body.surf(xe + R0 * 0.05, th0, true).p.distanceTo(body.surf(xe - R0 * 0.05, th0, true).p) / (R0 * 0.1);
    const eye = [], spec = [], uv = [], col = [], spa = [], lidP = [];
    for (let i = 0; i <= NR; i++) {
      const rho = (i / NR) * 1.18;
      for (let j = 0; j <= NA; j++) {
        const ph = (j / NA) * TAU, a = rho * Math.cos(ph), b = rho * Math.sin(ph);
        const x = xe + a * R0 / Math.max(0.5, arcX), th = th0 - sg * b * (R0 / Math.max(1e-9, arcA));
        const p = body.surf(x, th, true).p, n = body.surfNormal(x, th);
        if (n.dot(p.clone().sub(body.spine(x))) < 0) n.negate();
        // v5.78: the spectacle is a dome that rises from the socket's own rim (where the skin dips round the eye) to a little
        // above the head's outline, then tucks steeply under the skin past it; the iris is a shallow cup a sixth of the eye's
        // radius under the dome, its rim hidden under the skin; the scales round the eye (the lid) lie on the socket's skin
        const dep = p.distanceTo(body.surf(x, th).p), r2 = Math.min(1, rho * rho);
        const h = rho <= 1 ? R0 * bulge * (1 - r2) - dep * r2 * r2 : -dep - R0 * 1.6 * (rho - 1);
        const hi = rho <= 1 ? h - R0 * (0.16 * (1 - r2) + 0.035) : h - R0 * 0.035;
        const pe = p.clone().addScaledVector(n, hi).sub(c), ps = p.clone().addScaledVector(n, h).sub(c);
        const pl = p.clone().addScaledVector(n, rho < 0.9 ? h + R0 * 0.004 : lerp(h, -dep, sstep(0.9, 1.0, rho)) + R0 * 0.006).sub(c);
        eye.push(pe.x, pe.y, pe.z); spec.push(ps.x, ps.y, ps.z); lidP.push(pl.x, pl.y, pl.z);
        uv.push(0.5 + a * 0.47 * sg, 0.5 + b * 0.47);
        // the spectacle: clear in the middle, taking on the skin's colour at its rim, where the scales round the eye overlap it
        const rim = sstep(0.84, 1.0, rho) * (1 - sstep(1.06, 1.14, rho)), sk = skinAt(x, th);
        if (H.lipFull) { const band = H.lipFull > 0.01 && H.lipFull < 1 ? H.lipFull : 0.12, mAn = Math.PI * 0.56 / Math.PI, k = sstep(mAn - band - 0.015, mAn - band + 0.015, Math.abs(th) / Math.PI), lc = hex(H.lipColor || P.colors.belly).map((v) => Math.pow(v / 255, 2.2)); for (let q = 0; q < 3; q++) sk[q] = lerp(sk[q], lc[q], k); } // (v5.78: the pale lip scales reach up to the eye: the scales round it take that colour there too)
        col.push(sk[0], sk[1], sk[2], rim); spa.push(1 - sstep(0.76, 0.97, rho)); // (v5.78: the spectacle's reflections fade out at its rim, where its steep edge flared into a bright ring) // (v5.53: a clear spectacle - a milky one made the eye a pale disc)
      }
    }
    const idx = [];
    for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const mk = (arr, withUv, withCol) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); if (withUv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); if (withCol) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); g.computeVertexNormals(); return g; };
    const eg = mk(eye, true, false), sgeo = mk(spec, false, true), lgeo = mk(lidP, false, true);
    // wind the triangles so they face out of the head on both sides
    const fixFacing = (g) => { const nr = g.attributes.normal, mid = Math.round(NR * 0.3) * (NA + 1), q = new THREE.Vector3(nr.getX(mid), nr.getY(mid), nr.getZ(mid)), want = body.surfNormal(xe, th0);
      if (want.dot(c.clone().sub(body.spine(xe))) < 0) want.negate();
      if (q.dot(want) < 0) { const ia = g.index.array; for (let k = 0; k < ia.length; k += 3) { const t = ia[k + 1]; ia[k + 1] = ia[k + 2]; ia[k + 2] = t; } g.index.needsUpdate = true; g.computeVertexNormals(); } };
    fixFacing(eg); fixFacing(sgeo); fixFacing(lgeo);
    const m = new THREE.Mesh(eg, em); m.position.copy(c); m.receiveShadow = true; m.castShadow = false;
    // the clear glossy spectacle, and round its edge the skin of the scales that ring the eye, overlapping it
    const sg2 = sgeo, ca = sg2.attributes.color; for (let i = 0; i < ca.count; i++) ca.setXYZW(i, 1, 1, 1, spa[i]);
    const sp = new THREE.Mesh(sg2, sm); sp.renderOrder = 3; sp.receiveShadow = false; m.add(sp);
    const lid = new THREE.Mesh(lgeo, lm); lid.renderOrder = 2; lid.receiveShadow = true; m.add(lid);
    const n0 = body.surfNormal(xe, th0); if (n0.dot(c.clone().sub(body.spine(xe))) < 0) n0.negate();
    m.userData.spectacle = sp; m.userData.n = n0; m.userData.r = R0; out.push(m); // n: the way the eye looks out (v5.05: See eye shield frames it from there)
  }
  return out;
}

// ---------- v4.72: the mouth, opened with "Open mouth" ----------
// The lower jaw swings down about its hinge at the back of the head (the throat skin stretches
// behind it); inside are the pink mouth lining, the gullet, rows of small backward-pointing
// teeth on both jaws, and the fangs each group really has: long folding fangs at the very front
// in vipers and pit vipers, short fixed front fangs in elapids and sea snakes, none in pythons,
// colubrids and blind snakes (pythons have many more and bigger teeth instead).
// v5.88: the mouth lining's wet detail, made once: a normal map and a roughness map over a jaw's lining (u across it, lip to
// lip; v from the snout to the hinge). up: the roof (transverse palatal folds), false: the floor (soft lengthwise wrinkles),
// null: the tongue sheath (fine folds round it). Fine bumps everywhere, stippled gums, wetter in the hollows.
const MOUTH_MAPS = new Map();
function mouthMaps(up) {
  const key = String(up); if (MOUTH_MAPS.has(key)) return MOUTH_MAPS.get(key);
  const N = 192, h = new Float32Array(N * N), nd = new Uint8Array(N * N * 4), rd = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, inner = sstep(0.1, 0.17, u) * (1 - sstep(0.83, 0.9, u)), gum = Math.exp(-(((u - 0.156) / 0.02) ** 2)) + Math.exp(-(((u - 0.844) / 0.02) ** 2));
    let hv = 0.22 * vnoise(u * 64, v * 64, 1, 11) + 0.12 * vnoise(u * 150, v * 150, 2, 13) + gum * 0.45 * vnoise(u * 220, v * 160, 3, 17);
    if (up === true) { const ph = v * 13 + 1.6 * Math.abs(u - 0.5) + 0.25 * vnoise(u * 5, v * 5, 4, 19), w = Math.pow(0.5 + 0.5 * Math.sin(TAU * ph), 3); hv += inner * w * (1 - sstep(0.55, 0.9, v)) * (0.4 + 0.6 * sstep(0.03, 0.09, Math.abs(u - 0.5))) * 0.9; }
    else if (up === false) { const ph = u * 18 + 0.4 * vnoise(u * 4, v * 6, 5, 23); hv += inner * Math.pow(0.5 + 0.5 * Math.sin(TAU * ph), 2) * 0.35 * (0.5 + 0.5 * vnoise(u * 3, v * 8, 6, 29)); }
    else { hv += 0.5 * Math.pow(0.5 + 0.5 * Math.sin(TAU * (u * 14 + 0.3 * vnoise(u * 4, v * 4, 7, 31))), 2); }
    h[y * N + x] = hv;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = y * N + x, hx = h[y * N + ((x + 1) % N)] - h[y * N + ((x - 1 + N) % N)], hy = h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x];
    const nx = -hx * 3, ny = -hy * 3, l = Math.hypot(nx, ny, 1); nd[k * 4] = (nx / l * 0.5 + 0.5) * 255; nd[k * 4 + 1] = (ny / l * 0.5 + 0.5) * 255; nd[k * 4 + 2] = 255 / l; nd[k * 4 + 3] = 255;
    const lap = h[k] - (h[y * N + ((x + 1) % N)] + h[y * N + ((x - 1 + N) % N)] + h[((y + 1) % N) * N + x] + h[((y - 1 + N) % N) * N + x]) / 4; // (hollows: wetter)
    const wet = 0.5 + 0.5 * vnoise(x / N * 7, y / N * 7, 8, 37), r = clamp(0.16 + 0.3 * wet * wet + lap * 2.5, 0.08, 0.7);
    rd[k * 4] = rd[k * 4 + 1] = rd[k * 4 + 2] = r * 255; rd[k * 4 + 3] = 255;
  }
  const mk = (a) => { const t = new THREE.DataTexture(a, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  const out = { normal: mk(nd), rough: mk(rd) }; MOUTH_MAPS.set(key, out); return out;
}
function buildMouth(P, F, body, group, eyes, pat) {
  const geo = body.geo, pos = geo.attributes.position, orig = pos.array.slice(), M = body.M, Hl = F.Hl;
  const xh = Hl * (P.head.jaw || 0.75) * 1.02, xEnd = xh * 1.3, mA = body.mouthA;
  const plan = P.plan || 'colubrid', gape = { viper: 1.25, pitviper: 1.25, python: 1.0, colubrid: 0.85, elapid: 0.8, sea: 0.7, blind: 0.35 }[plan] || 0.85;
  // the hinge: the mouth corners at the back of the jaw; turning axis across the head
  const cL = body.surf(xh, mA).p, cR = body.surf(xh, -mA).p, hinge = cL.clone().add(cR).multiplyScalar(0.5);
  const fr = body.frameAt(xh), axis = fr.S.clone().normalize();
  // pick the turning direction that drops the tip of the jaw
  const tip0 = body.surf(Hl * 0.03, Math.PI).p, q = new THREE.Quaternion();
  q.setFromAxisAngle(axis, 0.5); const test = tip0.clone().sub(hinge).applyQuaternion(q);
  const sign = test.dot(fr.U) < tip0.clone().sub(hinge).dot(fr.U) ? 1 : -1;
  const weight = (x) => 1 - sstep(xh * 0.92, xEnd, x);
  // v5.05: behind the corner of the mouth the skin along the mouth line stays put (it used to turn with the jaws,
  // so the upper and lower skin crossed over each other there and left a flap - the "triangle at the corner")
  const skinW = (x, th) => x <= xh ? weight(x) : weight(x) * Math.min(1, 1.4 * Math.abs(Math.abs(th) - mA));
  // the head's vertices: upper jaw (lifts, like a real gape) or lower jaw (drops a little - it rests on the ground)
  const lower = [], upper = [];
  for (let i = 0; i < body.nR; i++) { const x = body.ringX[i]; if (x > xEnd) break;
    for (let j = 0; j <= M; j++) { const th = TAU * (j / M) - Math.PI; (Math.abs(th) > mA ? lower : upper).push(i * (M + 1) + j, skinW(x, th)); } }
  // v5.83: the sculpted head (buildHeadSkin): its two jaws are separate surfaces, each vertex knows which jaw it is on
  const hs = body.headSkin, hsPos = hs ? hs.geo.attributes.position : null, hsOrig = hs ? hs.rest : null, hLow = [], hUp = [];
  if (hs) for (let v = 0; v < hs.xv.length; v++) { const x = hs.xv[v]; if (x > xEnd) continue; (hs.side[v] < 0 ? hLow : hUp).push(v, skinW(x, hs.thv[v])); }
  // share of the gape: top of the head up, lower jaw down (v5.78: the lower jaw drops only as far as the ground under the chin
  // allows - it used to swing down through the ground; the skull lifts the rest, as a real snake's does)
  const chinH = Math.max(0, body.surf(Hl * 0.06, Math.PI).p.y), DN = clamp(Math.asin(clamp((chinH + F.Hh(Hl * 0.3) * 0.25) / Math.max(1e-6, xh * 0.95), 0, 1)) / Math.max(0.1, gape), 0.05, 0.28), UP = 1 - DN;
  // the skin along the mouth line is cut while the mouth is open (otherwise it stretches across and hides the inside)
  const ix = geo.index, cut = [];
  const isLow = (j) => Math.abs(TAU * (j / M) - Math.PI) > mA;
  for (let i = 0; i < body.nR - 1 && body.ringX[i] < xh; i++) for (let j = 0; j < M; j++) if (isLow(j) !== isLow(j + 1)) { const at = (i * M + j) * 6; cut.push(at, ix.array.slice(at, at + 6)); }
  let isCut = false;
  const setCut = (v) => { if (v === isCut) return; isCut = v; for (let k = 0; k < cut.length; k += 2) { const at = cut[k], o = cut[k + 1]; for (let q2 = 0; q2 < 6; q2++) ix.array[at + q2] = v ? o[0] : o[q2]; } ix.needsUpdate = true; };
  const eyeOrig = (eyes || []).map((m) => ({ m, p: m.position.clone(), q: m.quaternion.clone() }));
  const headRings = (() => { let n = 0; while (n < body.nR && body.ringX[n] <= xEnd * 1.05) n++; return n; })();
  // v4.81: the inside of the mouth is modelled, not two flat strips. Each jaw has rounded lips (the lip scales
  // roll inwards from the skin to the gums, so the edge of the upper jaw is no longer a thin shell), a vaulted pink
  // roof with the two rows of palate teeth on low ridges, a soft floor with the tongue sheath and glottis on a raised
  // midline, wet-looking lining that darkens towards the throat (and in the grooves beside the gums), a soft back
  // wall with the gullet in it (v5.53) and soft folds of skin at the corners of the mouth. Everything turns with its own jaw.
  const n = 44, xs = []; for (let k = 0; k <= n; k++) xs.push(Hl * 0.03 + (xh - Hl * 0.03) * Math.pow(k / n, 0.9));
  const img = pat && pat.image, skinAt = (x, th) => {
    if (!img || !img.data) return new THREE.Color(P.colors.lateral || P.colors.dorsal);
    const u = clamp((th + Math.PI) / TAU, 0, 0.999), v = clamp(body.gOf(x) / body.gTotal, 0, 0.999), k = (Math.floor(v * img.height) * img.width + Math.floor(u * img.width)) * 4;
    return new THREE.Color().setRGB(img.data[k] / 255, img.data[k + 1] / 255, img.data[k + 2] / 255, THREE.SRGBColorSpace);
  };
  const pink = new THREE.Color(P.head.mouthColor || (plan === 'python' ? '#e8a49c' : '#ec9f9a')), deep = new THREE.Color('#a24f5a'), black = new THREE.Color('#3a1219'); // (v5.53: pink right back to the gullet, as in real snakes)
  if (P.head.mouthColor && /^#[0-3]/.test(P.head.mouthColor)) deep.set('#120c0c'); // a black mouth (black mamba) stays black
  const chord = (x, th, s2, inset) => { const a = body.surf(x, th).p, b = body.surf(x, -th).p; return a.lerp(b, s2).lerp(body.spine(x), inset); };
  const bump = (s, c, w) => Math.exp(-(((s - c) / w) ** 2));
  const labN = P.head.labials || (plan === 'python' ? 13 : plan === 'viper' || plan === 'pitviper' ? 11 : 8), labLen = (xh * 0.95) / labN;
  // one jaw's lining: lip (outer edge -> rolled under -> gum), then the roof or floor across, then the other lip
  function jawLining(upper) {
    const NS = 40, NL = 5, rows = [], cols = [], xv = [], uvs = [];
    const sgU = upper ? -1 : 1; // the lips roll towards the opening: down for the upper jaw, up for the lower
    for (const x of xs) {
      const f = body.frameAt(x), Hh = F.Hh(x), W = F.W(x), back = sstep(xh * 0.5, xh * 1.0, x);
      const thE = upper ? mA - 0.015 : mA + 0.015, thI = upper ? mA - 0.07 : mA + 0.09;
      const across = (s) => { // the roof (vaulted, two ridges for the palate teeth) or the floor (a raised soft midline)
        const p = chord(x, thI, s, upper ? 0.2 : 0.22);
        // v5.83: the gums - a soft ridge just inside each lip that the outer row of teeth stands in - and on the roof the two
        // tooth-bearing ridges of the palate with the groove of the inner nostrils (choanae) between them; the floor sags
        // between the two halves of the lower jaw, each with its gum, round the raised tongue sheath on the midline
        const gum = bump(s, 0.07, 0.045) + bump(s, 0.93, 0.045);
        if (upper) p.addScaledVector(f.U, Hh * (0.2 * Math.sin(Math.PI * s) * (1 - 0.4 * back) - 0.06 * (bump(s, 0.27, 0.05) + bump(s, 0.73, 0.05)) + 0.035 * bump(s, 0.5, 0.06) - 0.07 * gum));
        else p.addScaledVector(f.U, Hh * (0.07 * bump(s, 0.5, 0.12) - 0.17 * Math.sin(Math.PI * s) * (1 - 0.5 * back) + 0.07 * gum));
        return p;
      };
      const lip = (side, k) => { // k = 0 at the skin's cut edge, 1 at the gum
        const A = body.surf(x, side * thE).p, B = across(side > 0 ? 0 : 1);
        if (hs) { const tk = (F.W(x) + F.Hh(x)) / 2 * 0.05 * sstep(Hl * 0.015, Hl * 0.07, x) * (1 - sstep(xh * 0.86, xh * 1.06, x)), sp = body.spine(x); A.addScaledVector(sp.sub(A).normalize(), tk); } // (v5.83: from the sculpted head's lip edge, which rolls in a little)
        const lr = Hh * (upper ? 0.16 : 0.12) * (1 - 0.5 * back) * (1 - sstep(xh * 0.62, xh * 0.97, x)); // v5.05: the rolled lip flattens out towards the corner (it used to hang there like a flap)
        const C = A.clone().addScaledVector(f.U, sgU * lr).lerp(B, 0.25), t2 = k;
        return A.clone().multiplyScalar((1 - t2) ** 2).addScaledVector(C, 2 * (1 - t2) * t2).addScaledVector(B, t2 * t2);
      };
      const row = [];
      for (let k = 0; k < NL; k++) row.push([lip(1, k / NL), 'lip', k / NL, 1]);
      for (let k = 0; k <= NS; k++) row.push([across(k / NS), 'in', k / NS, 0]);
      for (let k = NL - 1; k >= 0; k--) row.push([lip(-1, k / NL), 'lip', k / NL, -1]);
      // colours: the lip scales take the skin colour with dark sutures between them; the lining is pink, darker
      // in the grooves beside the gums, on the ridges a little lighter, and fading to deep red and black in the throat
      const suture = 1 - 0.45 * Math.pow(Math.abs(Math.cos(Math.PI * x / labLen)), 14) * sstep(Hl * 0.05, Hl * 0.12, x);
      for (let ri = 0; ri < row.length; ri++) { const [p, kind, s, side] = row[ri]; uvs.push(ri / (row.length - 1), x / xh);
        let c;
        if (kind === 'lip') { const sk = skinAt(x, side * (upper ? mA - 0.06 : mA + 0.08)), lipC = sk.clone().lerp(new THREE.Color(P.colors.belly), upper ? 0.25 : 0.5); c = lipC.multiplyScalar(suture * lerp(1, 0.7, sstep(0.55, 1, s))).lerp(pink, sstep(0.8, 1, s) * 0.6); }
        else {
          c = pink.clone().lerp(new THREE.Color(upper ? '#f8dcd8' : '#f4cdc8'), P.head.mouthColor ? 0.04 : 0.5); // (v5.62: a species' own mouth colour - black mamba, cottonmouth - is not paled) // (v5.53: paler, as the roof of a real snake's mouth)
          const groove = Math.max(bump(s, 0, 0.05), bump(s, 1, 0.05)), ridge = upper ? bump(s, 0.27, 0.05) + bump(s, 0.73, 0.05) : bump(s, 0.5, 0.1), gum = bump(s, 0.07, 0.045) + bump(s, 0.93, 0.045);
          c.multiplyScalar((1 - 0.35 * groove) * (1 + 0.12 * ridge) * (0.94 + 0.12 * hash1((x / Hl * 300) | 0, (s * 97) | 0)));
          c.lerp(gumC, 0.55 * gum); // (v5.83: the gums paler, almost white round the teeth)
          c.lerp(deep, sstep(0.6, 1.0, x / xh) * 0.38).lerp(black, sstep(0.92, 1.02, x / xh) * 0.2 * (1 - 0.5 * ridge)); // (v5.83: paler, as a real snake's mouth, darkening only deep in the throat)
        }
        rows.push(p.x, p.y, p.z); cols.push(c.r, c.g, c.b); xv.push(x);
      }
    }
    const per = 2 * NL + NS + 1, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(rows, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const idx = []; for (let i = 0; i < xs.length - 1; i++) for (let k = 0; k < per - 1; k++) { const a = i * per + k, b = a + per; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    g.setIndex(idx); g.computeVertexNormals();
    return { g, o: g.attributes.position.array.slice(), xv, per, row: (x, s) => { const f0 = xs.findIndex((q) => q >= x), i = f0 < 0 ? xs.length - 1 : f0, k = NL + Math.round(s * NS); return new THREE.Vector3().fromArray(rows, (i * per + k) * 3); }, gum: (x, side) => { const f0 = xs.findIndex((q) => q >= x), i = f0 < 0 ? xs.length - 1 : f0, k = side > 0 ? NL - 1 : per - NL; return new THREE.Vector3().fromArray(rows, (i * per + k) * 3); } };
  }
  const lining = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.2, sheen: 0.3, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffd6d6'), /* (v5.78: a wet, restrained sheen) */ emissive: P.head.mouthColor ? new THREE.Color(P.head.mouthColor).multiplyScalar(0.25) : new THREE.Color('#8a4448'), emissiveIntensity: 0.38, /* (v5.62: the glow takes the species' mouth colour; v5.78: fainter - the soft shadows inside give the depth) */ side: THREE.DoubleSide, envMapIntensity: 0.22 }); // (a faint glow stands in for light passing through the soft tissue)
  const gumC = new THREE.Color(P.head.mouthColor && /^#[0-3]/.test(P.head.mouthColor) ? '#2a2224' : '#f7dcd6');
  const roof = jawLining(true), floorJ = jawLining(false);
  const roofM = lining.clone(); roofM.emissive.set(P.head.mouthColor && /^#[0-3]/.test(P.head.mouthColor) ? '#1a1214' : '#c27e80'); roofM.emissiveIntensity = 0.7; // (v5.53: the roof faces down, away from the light: a little more glow keeps it pink, not maroon)
  // v5.88: wet detail - the roof's transverse palatal folds, the floor's soft lengthwise wrinkles, the stippled gums and fine
  // bumps of the lining, and a sheen that is wetter in the folds and drier on their crests (it was smooth, evenly shiny pink)
  const floorM = lining.clone();
  for (const [m, up] of [[roofM, true], [floorM, false]]) { const mm = mouthMaps(up); m.normalMap = mm.normal; m.normalScale = new THREE.Vector2(0.9, 0.9); m.roughnessMap = mm.rough; m.roughness = 1; m.clearcoatRoughnessMap = mm.rough; m.clearcoatRoughness = 0.6; m.clearcoat = 0.6; }
  const palate = new THREE.Mesh(roof.g, roofM), floor = new THREE.Mesh(floorJ.g, floorM);
  palate.receiveShadow = floor.receiveShadow = true;
  palate.castShadow = floor.castShadow = true; // v5.09: with the mouth open the head is an open shell; the lining closes it in the shadow too (no thin loop on the ground)
  // the corners of the mouth: a short fold of skin between the two jaws, just in front of the hinge
  const cheekX = xs.filter((x) => x >= xh * 0.84), cheekK = 10, cheekPts = [], cheekCols = [], cheekInfo = [];
  for (const x of cheekX) for (const side of [1, -1]) {
    const a = roof.gum(x, side), b = floorJ.gum(x, side), mid = body.spine(x), reach = sstep(xh * 0.84, xh * 1.0, x);
    for (let k = 0; k <= cheekK; k++) { const s = k / cheekK, p = a.clone().lerp(b, s).lerp(mid, 0.4 * Math.sin(Math.PI * s) * (0.35 + 0.65 * reach)); cheekPts.push(p.x, p.y, p.z); const c = pink.clone().lerp(deep, 0.3 + 0.6 * Math.sin(Math.PI * s) * reach); /* v5.05: a soft fold tucked in towards the throat, not a flat dark plate */ cheekCols.push(c.r, c.g, c.b); cheekInfo.push(s, reach, x); }
  }
  const cheekG = new THREE.BufferGeometry(); cheekG.setAttribute('position', new THREE.Float32BufferAttribute(cheekPts, 3)); cheekG.setAttribute('color', new THREE.Float32BufferAttribute(cheekCols, 3));
  { const idx = [], per = (cheekK + 1); for (let i = 0; i < cheekX.length - 1; i++) for (const sd of [0, 1]) for (let k = 0; k < cheekK; k++) { const a = (i * 2 + sd) * per + k, b = a + 2 * per; idx.push(a, a + 1, b, a + 1, b + 1, b); } cheekG.setIndex(idx); cheekG.computeVertexNormals(); }
  let cheekOrig = cheekG.attributes.position.array.slice(); const cheeks = new THREE.Mesh(cheekG, lining); cheeks.castShadow = true;
  const inside = new THREE.Group(); inside.add(palate, floor, cheeks); inside.visible = false; group.add(inside); // (v5.53: the soft back wall below closes the mouth; the dark tunnel and plug that stood in front of it are gone)
  // v5.53: the back of the mouth is closed by soft pink tissue stretched between the jaws, with the gullet a dark slit in
  // its middle (it was a big black hole). It is part of the folds' mesh, so it stretches with them as the mouth opens.
  { const xb = xs[xs.length - 1], CW = 28, MW = 18, base = cheekPts.length / 3, fT = body.frameAt(xb).T, depth = F.Hh(xb) * 0.35;
    for (let m = 0; m <= MW; m++) for (let c = 0; c <= CW; c++) {
      const u = c / CW, w = m / MW, A2 = roof.row(xb, u), B2 = floorJ.row(xb, u), pp = A2.clone().lerp(B2, w).addScaledVector(fT, depth * Math.sin(Math.PI * w) * (0.35 + 0.65 * Math.sin(Math.PI * u)));
      cheekPts.push(pp.x, pp.y, pp.z); const g = Math.hypot((u - 0.5) / 0.14, (w - 0.5) / 0.09), cc = pink.clone().lerp(deep, 0.4 + 0.25 * Math.sin(Math.PI * w)).lerp(black, 0.6 * (1 - sstep(0.2, 1.5, g))); // (v5.58: the gullet a narrow closed slit, as in real snakes, not a big dark hole)
      cheekCols.push(cc.r, cc.g, cc.b); cheekInfo.push(w, 1, xb); }
    const idx = Array.from(cheekG.index.array);
    for (let m = 0; m < MW; m++) for (let c = 0; c < CW; c++) { const a = base + m * (CW + 1) + c, b = a + CW + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    cheekG.setAttribute('position', new THREE.Float32BufferAttribute(cheekPts, 3)); cheekG.setAttribute('color', new THREE.Float32BufferAttribute(cheekCols, 3)); cheekG.setIndex(idx); cheekG.computeVertexNormals(); cheekOrig = cheekG.attributes.position.array.slice(); }
  // teeth (v5.53): many small, sharp, backward-curved teeth in the rows each family has - on the upper jaw the maxillary row
  // just inside the lip (none in vipers: their maxilla carries only the fang), two inner rows on the palate (palatine and
  // pterygoid), and the dentary row in the lower jaw. Each row is one merged mesh (a few draw calls, not one per tooth).
  const toothM = new THREE.MeshPhysicalMaterial({ color: '#f3eee0', roughness: 0.3, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const upperT = new THREE.Group(), lowerT = new THREE.Group(); inside.add(upperT, lowerT);
  const py = plan === 'python', vip = plan === 'viper' || plan === 'pitviper', el = plan === 'elapid' || plan === 'sea';
  const tK = P.head.teeth || {}, tl = Hl * (py ? 0.055 : plan === 'colubrid' ? 0.032 : 0.03) * (tK.len || 1); // (v5.62: head.teeth {n, len} - egg-eaters have only a few tiny teeth)
  const curvedTooth = (bend) => { // a cone along a gentle curve, its tip turned back (local +y = base to tip)
    const pts = []; for (let k = 0; k <= 6; k++) { const s2 = k / 6; pts.push(new THREE.Vector3(0, s2, bend * s2 * s2)); }
    const crv = new THREE.CatmullRomCurve3(pts), g = new THREE.TubeGeometry(crv, 6, 1, 6, false), p = g.attributes.position, q = new THREE.Vector3();
    // taper the tube to a point (TubeGeometry is a constant radius: pull each ring to its centre line)
    for (let i = 0; i < p.count; i++) { const ring = Math.floor(i / 7), s2 = ring / 6; crv.getPointAt(s2, q); const cx = q.x, cy = q.y, cz = q.z, k = Math.pow(1 - s2, 0.85) + 0.02; p.setXYZ(i, cx + (p.getX(i) - cx) * k, cy + (p.getY(i) - cy) * k, cz + (p.getZ(i) - cz) * k); }
    g.computeVertexNormals(); return g;
  };
  const toothG = curvedTooth(0.45), qT = new THREE.Quaternion();
  const toothMatrix = (base, dir, len, rad, back) => { const y = dir.clone().normalize(), z = back.clone().addScaledVector(y, -back.dot(y)).normalize(), xx = new THREE.Vector3().crossVectors(y, z); qT.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xx, y, z)); return new THREE.Matrix4().compose(base, qT, new THREE.Vector3(rad, len, rad)); };
  const tooth = (parent, base, dir, len, rad, back, g) => { const m = new THREE.Mesh(g || toothG, toothM); toothMatrix(base, dir, len, rad, back).decompose(m.position, m.quaternion, m.scale); m.castShadow = false; parent.add(m); return m; };
  const toothRow = (parent, list, part) => { // many teeth merged into one mesh
    if (!list.length) return null;
    const pc = toothG.attributes.position.count, ic = toothG.index.count, P3 = new Float32Array(list.length * pc * 3), N3 = new Float32Array(list.length * pc * 3), I = new (list.length * pc > 65535 ? Uint32Array : Uint16Array)(list.length * ic);
    const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    list.forEach((M4, t) => { nm.getNormalMatrix(M4); for (let i = 0; i < pc; i++) { v.fromBufferAttribute(toothG.attributes.position, i).applyMatrix4(M4); P3.set([v.x, v.y, v.z], (t * pc + i) * 3); v.fromBufferAttribute(toothG.attributes.normal, i).applyMatrix3(nm).normalize(); N3.set([v.x, v.y, v.z], (t * pc + i) * 3); } for (let i = 0; i < ic; i++) I[t * ic + i] = toothG.index.array[i] + t * pc; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P3, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N3, 3)); g.setIndex(new THREE.BufferAttribute(I, 1));
    const m = new THREE.Mesh(g, toothM); m.castShadow = false; m.userData.mpart = part; parent.add(m); return m;
  };
  const rowTeeth = (J, x0, x1, n, s2, len, up, rake) => { const out = [];
    for (let k = 0; k < n; k++) { const x = x0 + (x1 - x0) * (k / Math.max(1, n - 1)), f = body.frameAt(x), sz = (1 - 0.3 * (k / n)) * (0.85 + 0.3 * hash1(k * 7 + Math.round(s2 * 100), 77));
      for (const ss of [s2, 1 - s2]) { const b = J.row(x, ss).addScaledVector(f.U, up ? Hl * 0.003 : -Hl * 0.003), dir = f.U.clone().multiplyScalar(up ? -1 : 1).addScaledVector(f.T, rake).addScaledVector(f.S, (ss < 0.5 ? 1 : -1) * 0.12); out.push(toothMatrix(b, dir, len * sz, len * sz * 0.2, f.T)); } }
    return out; };
  const many = (py ? 1.3 : 1) * (tK.n || 1), nMax = Math.round((vip ? 0 : el ? 7 : 18) * many), nPal = Math.round((vip ? 12 : el ? 12 : 16) * many), nDen = Math.round((vip ? 14 : el ? 14 : 18) * many);
  if (plan !== 'blind') {
    toothRow(upperT, rowTeeth(roof, el ? Hl * 0.24 : Hl * 0.1, xh * 0.8, nMax, 0.07, tl, true, 0.55), 'teeth'); // (v5.83: set in the gums)
    toothRow(upperT, rowTeeth(roof, Hl * 0.17, xh * 0.86, nPal, 0.27, tl * 0.72, true, 0.65), 'palate');
    toothRow(lowerT, rowTeeth(floorJ, Hl * 0.07, xh * 0.8, nDen, 0.07, tl * 0.9, false, 0.55), 'teeth');
  }
  // the glottis, the tongue sheath and the tongue
  const anchors = { teeth: new THREE.Object3D(), palate: new THREE.Object3D(), glottis: new THREE.Object3D(), sheath: new THREE.Object3D(), fang: null, hinge: new THREE.Object3D(), tongue: null };
  let tongueUpd = null;
  if (plan !== 'blind') {
    anchors.palate.position.copy(roof.row(xh * 0.45, 0.5)); upperT.add(anchors.palate);
    anchors.teeth.position.copy(roof.gum(Hl * 0.3, 1)); upperT.add(anchors.teeth);
    const softM = new THREE.MeshPhysicalMaterial({ color: pink.clone().multiplyScalar(0.95), roughness: 1, roughnessMap: mouthMaps(null).rough, normalMap: mouthMaps(null).normal, normalScale: new THREE.Vector2(0.7, 0.7), clearcoat: 0.6, clearcoatRoughness: 0.25 }); // (v5.88: the tongue sheath's soft folds)
    const fAt = (x) => body.frameAt(x), fl = (x) => { const xc = Math.min(x, xs[xs.length - 1]); return floorJ.row(xc, 0.5).addScaledVector(fAt(xc).T, x - xc); }; // (past the hinge: straight on back)
    // the tongue sheath: a low soft ridge along the floor of the mouth, open at its front end just behind the chin
    const r0 = Math.max(Hl * 0.019, F.W(Hl * 0.2) * 0.07); // the tongue's thickness (v5.78: a little fuller - it read as a black thread)
    const shx0 = Hl * 0.075, shx1 = Hl * 0.42, shW = Math.max(F.W(Hl * 0.2) * 0.12, r0 * 2.4), shH = Math.max(F.Hh(Hl * 0.2) * 0.05, r0 * 1.5), fS0 = fAt((shx0 + shx1) / 2);
    const sheath = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), softM); sheath.scale.set(shW, shH, (shx1 - shx0) / 2); sheath.position.copy(fl((shx0 + shx1) / 2));
    sheath.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fS0.S.clone().normalize().negate(), fS0.U, fS0.T)); // (a right-handed basis: S, U, T is left-handed)
    lowerT.add(sheath); sheath.userData.mpart = 'sheath'; // (v5.58: this was inside the comment above, so the sheath was never shown)
    const opening = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({ color: '#2a0a10', side: THREE.DoubleSide }));
    { const f0 = fAt(shx0 + Hl * 0.02); opening.scale.set(shW * 0.55, shH * 0.6, 1); opening.position.copy(fl(shx0 + Hl * 0.02)).addScaledVector(f0.U, shH * 0.35).addScaledVector(f0.T, -Hl * 0.005); opening.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f0.S.clone().normalize().negate(), f0.U, f0.T)); lowerT.add(opening); opening.userData.mpart = 'sheath'; }
    anchors.sheath.position.copy(fl(Hl * 0.2)).addScaledVector(fS0.U, shH); lowerT.add(anchors.sheath);
    // the glottis: a small tube lying on the sheath just behind its opening, its slit facing forward and up
    const gx0 = Hl * 0.14, gx1 = Hl * 0.27, gr = F.W((gx0 + gx1) / 2) * 0.05, gU = fAt((gx0 + gx1) / 2).U;
    const gA = fl(gx0).addScaledVector(gU, shH + gr * 0.9), gB = fl(gx1).addScaledVector(gU, shH * 0.6 + gr * 0.4);
    const glottis = new THREE.Mesh(new THREE.CylinderGeometry(gr, gr * 1.3, gA.distanceTo(gB), 16, 1, true), softM);
    glottis.position.copy(gA).add(gB).multiplyScalar(0.5); glottis.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), gA.clone().sub(gB).normalize()); lowerT.add(glottis); glottis.userData.mpart = 'glottis';
    const hole = new THREE.Mesh(new THREE.CircleGeometry(gr * 0.75, 16).scale(0.35, 1, 1), new THREE.MeshBasicMaterial({ color: '#1e070b', side: THREE.DoubleSide }));
    hole.position.copy(gA); hole.lookAt(gA.clone().add(gA.clone().sub(gB))); lowerT.add(hole); hole.userData.mpart = 'glottis';
    const rim = new THREE.Mesh(new THREE.TorusGeometry(gr * 0.9, gr * 0.22, 8, 20), softM); rim.position.copy(gA); rim.lookAt(gA.clone().add(gA.clone().sub(gB))); rim.scale.set(0.6, 1, 1); lowerT.add(rim); rim.userData.mpart = 'glottis';
    anchors.glottis.position.copy(gA).add(gB).multiplyScalar(0.5).addScaledVector(gU, gr); lowerT.add(anchors.glottis);
    // the forked tongue (v5.53): one tongue, its base deep in the sheath. At rest only the tips show at the sheath's opening;
    // a flick slides it forward along a fixed track - out of the sheath, up through the notch at the front of the lips
    // (the mouth can stay shut) and out in front of the snout - where the two tips spread and wave, then it slides back.
    const tongueK = P.head.tongueLen || { colubrid: 1.25, elapid: 1.1, viper: 0.8, pitviper: 0.8, sea: 0.75 }[plan] || 1; // v5.62: tongue length in head lengths (longer in active colubrids)
    const tongueCol = new THREE.Color(P.head.tongue || { python: '#2b1d24', viper: '#22191d', pitviper: '#1f1a20', elapid: '#141015', sea: '#2a2226' }[plan] || '#16121a'), tipCol = new THREE.Color(P.head.tongueTip || P.head.tongue || '#16121a').multiplyScalar(P.head.tongueTip ? 1 : 0.7);
    const tongueM = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 });
    const fN = fAt(Hl * 0.05), notch = body.surf(Hl * 0.012, mA).p.add(body.surf(Hl * 0.012, -mA).p).multiplyScalar(0.5), fwd0 = fN.T.clone().negate(), fwd = fwd0.clone().lerp(new THREE.Vector3(fwd0.x, 0, fwd0.z).normalize(), 0.75).normalize(), dn = fN.U.clone().negate(); // (out nearly level, even from a head that rests tilted on its coils)
    const pOpen = fl(Hl * 0.095).addScaledVector(fN.U, shH * 0.45);
    const trackPts = [fl(Hl * 0.95).addScaledVector(fAt(Hl * 0.95).U, -F.Hh(Hl * 0.9) * 0.1), fl(Hl * 0.55).addScaledVector(fAt(Hl * 0.55).U, -shH * 1.2), fl(Hl * 0.3).addScaledVector(fAt(Hl * 0.3).U, -shH * 0.25), fl(Hl * 0.17).addScaledVector(fAt(Hl * 0.17).U, shH * 0.15),
      pOpen, notch.clone().addScaledVector(fwd0, -Hl * 0.025).addScaledVector(dn, Hl * 0.004), notch.clone(), notch.clone().addScaledVector(fwd, Hl * 0.4).addScaledVector(dn, Hl * 0.05), notch.clone().addScaledVector(fwd, Hl * 1.2).addScaledVector(dn, Hl * 0.12)];
    const crv = new THREE.CatmullRomCurve3(trackPts, false, 'centripetal'), NTk = 160, tk = crv.getSpacedPoints(NTk), cum = [0];
    for (let i = 1; i <= NTk; i++) cum.push(cum[i - 1] + tk[i].distanceTo(tk[i - 1]));
    const along = (d, out) => { if (d <= 0) return out.copy(tk[1]).sub(tk[0]).normalize().multiplyScalar(d).add(tk[0]); if (d >= cum[NTk]) return out.copy(tk[NTk]).sub(tk[NTk - 1]).normalize().multiplyScalar(d - cum[NTk]).add(tk[NTk]);
      let lo = 0, hi = NTk; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < d) lo = m; else hi = m; } return out.copy(tk[lo]).lerp(tk[hi], (d - cum[lo]) / Math.max(1e-12, cum[hi] - cum[lo])); };
    const nearestD = (p) => { let b = 0, bd = 1e18; for (let i = 0; i <= NTk; i++) { const d = tk[i].distanceToSquared(p); if (d < bd) { bd = d; b = i; } } return cum[b]; };
    const dOpen = nearestD(pOpen), dNotch = nearestD(notch), Lt = Hl * tongueK, Lf = Lt * 0.24, tipRest = dOpen + Hl * 0.025, tipOut = dNotch + Hl * 0.62 * tongueK;
    const side = fN.S.clone().normalize(), NS = 28, NT2 = 12, RS = 7;
    const nV = (NS + 1) * RS + 2 * (NT2 + 1) * RS, tPos = new Float32Array(nV * 3), tCol = new Float32Array(nV * 3), tIdx = [];
    const ringIdx = (o, n) => { for (let i = 0; i < n; i++) for (let k = 0; k < RS; k++) { const a = o + i * RS + k, b = o + i * RS + (k + 1) % RS, c = a + RS, d = b + RS; tIdx.push(a, c, b, b, c, d); } };
    ringIdx(0, NS); ringIdx((NS + 1) * RS, NT2); ringIdx((NS + 1) * RS + (NT2 + 1) * RS, NT2);
    for (let v = 0; v < nV; v++) { const c = v >= (NS + 1) * RS ? tipCol : tongueCol; tCol.set([c.r, c.g, c.b], v * 3); }
    const tG = new THREE.BufferGeometry(); tG.setAttribute('position', new THREE.BufferAttribute(tPos, 3)); tG.setAttribute('color', new THREE.BufferAttribute(tCol, 3)); tG.setIndex(tIdx);
    const tongue = new THREE.Mesh(tG, tongueM); tongue.frustumCulled = false; tongue.castShadow = false; lowerT.add(tongue); tongue.userData.mpart = 'tongue';
    const q0 = new THREE.Vector3(), q1 = new THREE.Vector3(), tv = new THREE.Vector3(), nv = new THREE.Vector3(), bv = new THREE.Vector3();
    // ext: 0 in the sheath .. 1 fully out; ph: the phase of the up-and-down wave of the tips
    tongueUpd = (ext, ph) => {
      const dTip = lerp(tipRest, tipOut, ext), spread = sstep(dNotch + Hl * 0.05, dNotch + Hl * 0.4, dTip) * Hl * 0.09;
      const wave = (d) => { const o = d - dNotch; return o <= 0 ? 0 : Hl * 0.06 * sstep(0, Hl * 0.35, o) * Math.sin(ph - o / (Hl * 0.25)) * sstep(0.2, 0.6, ext); };
      const at = (d, lat, out) => along(d, out).addScaledVector(dn, -wave(d)).addScaledVector(side, lat);
      const ring = (o, d, lat, r, latBack) => { at(d - Hl * 0.01, latBack, q0); at(d + Hl * 0.01, lat, q1); tv.subVectors(q1, q0).normalize(); bv.crossVectors(tv, side).normalize(); nv.crossVectors(bv, tv).normalize(); at(d, lat, q0);
        for (let k = 0; k < RS; k++) { const an = (k / RS) * TAU, ca = Math.cos(an) * r, sa = Math.sin(an) * r * 0.75; tPos[(o + k) * 3] = q0.x + bv.x * ca + nv.x * sa; tPos[(o + k) * 3 + 1] = q0.y + bv.y * ca + nv.y * sa; tPos[(o + k) * 3 + 2] = q0.z + bv.z * ca + nv.z * sa; } };
      const dFork = dTip - Lf;
      for (let i = 0; i <= NS; i++) { const s2 = i / NS, d = dTip - Lt + (Lt - Lf) * s2; ring(i * RS, d, 0, r0 * lerp(1, 0.62, s2), 0); }
      for (const [o, sg] of [[(NS + 1) * RS, 1], [(NS + 1) * RS + (NT2 + 1) * RS, -1]])
        for (let i = 0; i <= NT2; i++) { const s2 = i / NT2, d = dFork + Lf * s2, latOf = (z) => sg * (spread * Math.pow(Math.max(0, z), 1.4) + r0 * 0.3 * Math.max(0, z)); ring(o + i * RS, d, latOf(s2), r0 * 0.6 * Math.pow(1 - s2, 0.8) + Hl * 0.0015, latOf(s2 - 0.01 / Lf * Hl)); }
      tG.attributes.position.needsUpdate = true; tG.computeVertexNormals(); tG.computeBoundingSphere();
    };
    tongueUpd(0, 0);
    anchors.tongue = tongue;
    anchors.hinge.position.copy(hinge); group.add(anchors.hinge);
  }
  const fangs = [];
  if (plan === 'viper' || plan === 'pitviper' || plan === 'elapid' || plan === 'sea') {
    const big = plan === 'viper' || plan === 'pitviper', x = Hl * (big ? 0.1 : 0.12), f = body.frameAt(x);
    const fangG = curvedTooth(big ? 0.28 : 0.18), sheathM = new THREE.MeshPhysicalMaterial({ color: pink.clone().lerp(new THREE.Color('#ffffff'), 0.15), roughness: 0.4, transparent: true, opacity: 0.88, clearcoat: 0.5 });
    for (const sg of [1, -1]) {
      // v5.62 (model accuracy): the species' own fang length (head.fangMm, documented adult sizes), else a family fraction
      const len = P.head.fangMm ? clamp(P.head.fangMm / 1000, Hl * 0.04, Hl * 0.42) : Hl * ({ viper: 0.2, pitviper: 0.16, elapid: 0.1, sea: 0.05 }[plan] || 0.12), r = Math.max(len * (big ? 0.075 : 0.13), Hl * 0.007);
      const base = roof.gum(x, sg), dir = f.U.clone().negate().addScaledVector(f.T, big ? 0.35 : 0.2);
      const fg = tooth(upperT, base, dir, len, r, f.T, fangG); fangs.push(fg); fg.userData.mpart = 'fang';
      if (big) { // the soft sheath of gum the folded fang rests in, pushed up round its base
        const sh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), sheathM); sh.scale.set(r * 2.1, len * 0.3, r * 2.4); sh.position.copy(base).addScaledVector(dir.clone().normalize(), len * 0.16); sh.quaternion.copy(fg.quaternion); upperT.add(sh); fangs.push(sh); sh.userData.mpart = 'fang';
      }
    }
    // the fang tip (for the labels)
    const fg = fangs[0]; anchors.fang = new THREE.Object3D(); fg.updateMatrix(); anchors.fang.position.copy(new THREE.Vector3(0, 1, 0.28 * (big ? 1 : 0.6)).applyMatrix4(fg.matrix)); upperT.add(anchors.fang);
    anchors.fangLen = fg.scale.y; for (const f2 of fangs) f2.visible = false; // (folded away while the mouth is shut, as set() does)
  } else {
    const x = Hl * 0.14, f = body.frameAt(x); anchors.fang = new THREE.Object3D(); anchors.fang.position.copy(roof.gum(x, 1)).addScaledVector(f.U, -tl); upperT.add(anchors.fang); anchors.fangLen = tl;
  }
  // v5.62 (model accuracy): rear fangs - a pair of enlarged, grooved teeth at the back of the upper jaw (boomslang, twig,
  // cat and vine snakes, mangrove snakes): head.rearFang in mm
  if (P.head.rearFang && plan !== 'blind') {
    const x = xh * 0.72, f = body.frameAt(x), len = clamp(P.head.rearFang / 1000, tl * 1.3, Hl * 0.2), fg2 = curvedTooth(0.3);
    for (const sg of [1, -1]) { const m = tooth(upperT, roof.gum(x, sg), f.U.clone().negate().addScaledVector(f.T, 0.45), len, len * 0.12, f.T, fg2); m.userData.mpart = 'teeth'; }
  }
  // v5.88: a few thin strands of saliva between the jaws near the corners of the mouth: they stretch as it opens, thinning in
  // the middle and sagging a little, and are gone by a wide gape (as they break in a real mouth)
  const saliva = (() => {
    const R2 = rng(strSeed(P.name || 'mouth') + 91), list = [], NSg = 10, NRd = 5;
    for (let k = 0; k < 5; k++) { const side = k % 2 ? 1 : -1; list.push({ x: xh * (0.55 + 0.33 * R2()), s: side > 0 ? 0.1 + 0.12 * R2() : 0.9 - 0.12 * R2(), r: Hl * (0.0035 + 0.003 * R2()), sag: 0.15 + 0.25 * R2(), brk: 0.55 + 0.4 * R2() }); }
    const nV = list.length * (NSg + 1) * NRd, g = new THREE.BufferGeometry(), pa = new Float32Array(nV * 3), idx = [];
    for (let q = 0; q < list.length; q++) for (let i = 0; i < NSg; i++) for (let j = 0; j < NRd; j++) { const a = (q * (NSg + 1) + i) * NRd + j, b = a + NRd, j1 = (j + 1) % NRd, a1 = (q * (NSg + 1) + i) * NRd + j1, b1 = a1 + NRd; idx.push(a, b, a1, a1, b, b1); }
    g.setAttribute('position', new THREE.BufferAttribute(pa, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: '#f4e6e4', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.55, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4, depthWrite: false }));
    m.frustumCulled = false; m.castShadow = false; m.renderOrder = 3; m.userData.mpart = 'saliva';
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), d = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), c = new THREE.Vector3();
    const at = (J, x, sv, out) => { const f0 = xs.findIndex((q) => q >= x), i = f0 < 0 ? xs.length - 1 : f0, kk = 5 + Math.round(sv * 40), per = 2 * 5 + 40 + 1; return out.fromArray(J.g.attributes.position.array, (i * per + kk) * 3); };
    return { m, update(tt) {
      m.visible = tt > 0.06 && tt < 1.05;
      if (!m.visible) return;
      for (let q = 0; q < list.length; q++) { const S2 = list[q]; at(roof, S2.x, S2.s, vA); at(floorJ, S2.x, S2.s, vB); d.subVectors(vB, vA); const L2 = d.length(); d.normalize();
        e1.set(0, 1, 0).cross(d); if (e1.lengthSq() < 1e-8) e1.set(1, 0, 0); e1.normalize(); e2.crossVectors(d, e1).normalize();
        const alive = 1 - sstep(S2.brk, S2.brk + 0.12, tt); // (the strand thins and snaps as the gape grows)
        for (let i = 0; i <= NSg; i++) { const u = i / NSg, thin = alive * lerp(1, 0.28, Math.sin(Math.PI * u) ** 0.7);
          c.copy(vA).addScaledVector(d, L2 * u).addScaledVector(e2, -L2 * S2.sag * 0.25 * Math.sin(Math.PI * u)).addScaledVector(e1, L2 * 0.05 * Math.sin(Math.PI * u) * (S2.s < 0.5 ? 1 : -1));
          for (let j = 0; j < NRd; j++) { const an = (j / NRd) * TAU, o = ((q * (NSg + 1) + i) * NRd + j) * 3, r = S2.r * Math.max(0.02, thin);
            pa[o] = c.x + (e1.x * Math.cos(an) + e2.x * Math.sin(an)) * r; pa[o + 1] = c.y + (e1.y * Math.cos(an) + e2.y * Math.sin(an)) * r; pa[o + 2] = c.z + (e1.z * Math.cos(an) + e2.z * Math.sin(an)) * r; } } }
      g.attributes.position.needsUpdate = true; g.computeVertexNormals();
    } };
  })();
  if (plan !== 'blind') inside.add(saliva.m);
  let t = 0, ver = 0, spread = 0, walk = 0;
  // v5.57: swallowing a big meal the two halves of the lower jaw spread apart (the stretchy chin and the swinging quadrate
  // bones) and walk forward in turn: warp a point of the lower jaw (rest shape) by its side of the head, w = its jaw weight
  const jawC = hinge.clone(), jawT = fr.T.clone().normalize(), jawHalf = Math.max(1e-6, F.W(xh * 0.7));
  const jw = new THREE.Vector3();
  const jawWarp = (v, w) => {
    if ((!spread && !walk) || w <= 0) return v;
    const l = jw.subVectors(v, jawC).dot(axis), side = Math.tanh(l / (jawHalf * 0.35));
    const along = Math.max(0, -jw.dot(jawT)) / xh; // 0 at the hinge .. 1 at the chin
    v.addScaledVector(axis, l * spread * (0.55 + 0.45 * (1 - along)) * w);
    v.addScaledVector(jawT, -walk * side * Hl * 0.07 * w);
    return v;
  };
  const lowT = []; // the lower teeth rows, warped with the jaw (they stay in their gums)
  lowerT.traverse((o) => { if (o.isMesh && o.userData.mpart === 'teeth') lowT.push({ g: o.geometry, o: o.geometry.attributes.position.array.slice() }); });
  function set(v, opt) {
    const sp2 = opt && opt.spread || 0, wk2 = opt && opt.walk || 0, warpChanged = sp2 !== spread || wk2 !== walk; spread = sp2; walk = wk2; ver++;
    t = clamp(v, 0, 1.45); inside.visible = t > 0.01 || flickShut; setCut(t > 0.01); if (flickShut && t > 0.01) showOnlyTongue(false);
    const ang = sign * gape * (t <= 1 ? 1 - Math.pow(1 - t, 2) : 1 + (t - 1) * 1.1), /* past 1: the extra-wide gape of a strike */ a = pos.array, aD = ang * DN, aU = -ang * UP;
    const qq = new THREE.Quaternion(), v3 = new THREE.Vector3();
    // (v5.83: the turn about the hinge worked out on the numbers - one rotation per distinct weight, most of the jaw has weight 1)
    const ax = axis.x, ay = axis.y, az = axis.z, hx = hinge.x, hy = hinge.y, hz = hinge.z, warp = spread || walk;
    const turn = (list, an, o = orig, out = a, low = list === lower) => { let lw = -1, m0 = 1, m1 = 0, m2 = 0, m3 = 0, m4 = 1, m5 = 0, m6 = 0, m7 = 0, m8 = 1;
      for (let k = 0; k < list.length; k += 2) { const vi = list[k] * 3, w = list[k + 1];
        let x = o[vi], y = o[vi + 1], z = o[vi + 2];
        if (low && warp) { v3.set(x, y, z); jawWarp(v3, w); x = v3.x; y = v3.y; z = v3.z; }
        if (w > 0 && an) {
          if (w !== lw) { lw = w; const g = an * w, c = Math.cos(g), sn = Math.sin(g), t1 = 1 - c; m0 = t1 * ax * ax + c; m1 = t1 * ax * ay - sn * az; m2 = t1 * ax * az + sn * ay; m3 = t1 * ax * ay + sn * az; m4 = t1 * ay * ay + c; m5 = t1 * ay * az - sn * ax; m6 = t1 * ax * az - sn * ay; m7 = t1 * ay * az + sn * ax; m8 = t1 * az * az + c; }
          const dx = x - hx, dy = y - hy, dz = z - hz; x = hx + m0 * dx + m1 * dy + m2 * dz; y = hy + m3 * dx + m4 * dy + m5 * dz; z = hz + m6 * dx + m7 * dy + m8 * dz;
        }
        out[vi] = x; out[vi + 1] = y; out[vi + 2] = z; } };
    turn(lower, aD); turn(upper, aU);
    if (hs) { turn(hLow, aD, hsOrig, hsPos.array, true); turn(hUp, aU, hsOrig, hsPos.array, false); hsPos.needsUpdate = true; }
    pos.clearUpdateRanges(); pos.addUpdateRange(0, Math.min(body.nR, headRings + 1) * (M + 1) * 3); pos.needsUpdate = true; // (v5.78: only the head's part of the buffer goes to the graphics card)
    // the mouth lining and the teeth go with their jaws
    const strip2 = (J, an) => { const fp = J.g.attributes.position.array, o = J.o;
      for (let k = 0, i = 0; k < fp.length; k += 3, i++) { v3.set(o[k], o[k + 1], o[k + 2]); if (J === floorJ) jawWarp(v3, weight(J.xv[i])); qq.setFromAxisAngle(axis, an * weight(J.xv[i])); v3.sub(hinge).applyQuaternion(qq).add(hinge); fp[k] = v3.x; fp[k + 1] = v3.y; fp[k + 2] = v3.z; }
      J.g.attributes.position.needsUpdate = true; J.g.computeVertexNormals(); };
    strip2(floorJ, aD); strip2(roof, aU); saliva.update(t);
    // the folds at the corners of the mouth stretch between the two jaws
    { const fp = cheekG.attributes.position.array;
      for (let k = 0, i = 0; k < fp.length; k += 3, i++) { const s = cheekInfo[i * 3], reach = cheekInfo[i * 3 + 1], x = cheekInfo[i * 3 + 2], an = lerp(aU, aD, sstep(0.5 - 0.5 * reach - 1e-3, 0.5 + 0.5 * reach + 1e-3, s)) * weight(x);
        v3.set(cheekOrig[k], cheekOrig[k + 1], cheekOrig[k + 2]); qq.setFromAxisAngle(axis, an); v3.sub(hinge).applyQuaternion(qq).add(hinge); fp[k] = v3.x; fp[k + 1] = v3.y; fp[k + 2] = v3.z; }
      cheekG.attributes.position.needsUpdate = true; cheekG.computeVertexNormals(); }
    const place = (grp, an) => { qq.setFromAxisAngle(axis, an); grp.position.copy(hinge).sub(hinge.clone().applyQuaternion(qq)); grp.quaternion.copy(qq); };
    place(lowerT, aD); place(upperT, aU);
    if (warpChanged) for (const q of lowT) { const a2 = q.g.attributes.position.array; for (let k = 0; k < a2.length; k += 3) { v3.set(q.o[k], q.o[k + 1], q.o[k + 2]); jawWarp(v3, 1); a2[k] = v3.x; a2[k + 1] = v3.y; a2[k + 2] = v3.z; } q.g.attributes.position.needsUpdate = true; q.g.computeBoundingSphere(); }
    for (const e of eyeOrig) { qq.setFromAxisAngle(axis, aU); e.m.position.copy(e.p).sub(hinge).applyQuaternion(qq).add(hinge); e.m.quaternion.copy(qq).multiply(e.q); }
    // fangs swing forward as the mouth opens (vipers fold them flat when it is shut)
    for (const fg of fangs) fg.visible = t > 0.25;
  }
  // normals once the jaw stops (the seam along the belly kept smooth, like buildBody does). v5.78: only the head's rings - the
  // whole body's 200 000 vertices took 50-100 ms, a visible hitch at the end of every Open mouth / Close mouth
  const nRh = Math.min(body.nR - 1, headRings + 1), acc = new Float32Array((nRh + 1) * (M + 1) * 3);
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  function settle() {
    const ia = geo.index.array, pa = pos.array, nrm = geo.attributes.normal.array, nT = Math.min(body.nR - 1, nRh + 1) * M * 6; acc.fill(0);
    const lim = (nRh + 1) * (M + 1);
    for (let k = 0; k < nT; k += 3) {
      const a = ia[k], b = ia[k + 1], c = ia[k + 2]; if (a === b || b === c) continue;
      va.fromArray(pa, a * 3); vb.fromArray(pa, b * 3).sub(va); vc.fromArray(pa, c * 3).sub(va); vb.cross(vc);
      for (const v of [a, b, c]) if (v < lim) { acc[v * 3] += vb.x; acc[v * 3 + 1] += vb.y; acc[v * 3 + 2] += vb.z; }
    }
    const nV = nRh * (M + 1);
    for (let v = 0; v < nV; v++) { const x = acc[v * 3], y = acc[v * 3 + 1], z = acc[v * 3 + 2], l = Math.hypot(x, y, z) || 1; nrm[v * 3] = x / l; nrm[v * 3 + 1] = y / l; nrm[v * 3 + 2] = z / l; }
    for (let i = 0; i < nRh; i++) { const a = i * (M + 1), b = a + M; for (let q2 = 0; q2 < 3; q2++) { const m = (nrm[a * 3 + q2] + nrm[b * 3 + q2]) / 2; nrm[a * 3 + q2] = nrm[b * 3 + q2] = m; } }
    { const T = body.frameAt(0).T; for (let j = 0; j <= M; j++) { nrm[j * 3] = -T.x; nrm[j * 3 + 1] = -T.y; nrm[j * 3 + 2] = -T.z; } } // (the snout tip's cap, as buildBody makes it)
    const nn = geo.attributes.normal; nn.clearUpdateRanges(); nn.addUpdateRange(0, nV * 3); nn.needsUpdate = true;
    if (hs) hs.fixNormals();
  }
  // v5.53: a tongue flick, s from 0 to 1 (out, the tips wave up and down, back in); 0 or 1 leaves it in its sheath. With the
  // mouth shut only the tongue of everything inside is shown: it comes out through the notch at the front of the lips.
  if (hs) hs.onRest = () => { set(t, { spread, walk }); settle(); }; // (the sculpted head's shape arrives from the worker: the jaws take it up)
  let flickShut = false; const hidden = [];
  function showOnlyTongue(on) { // v5.57: puts back only what it hid (Anatomy's jaw bones live in the jaw groups too, and stay hidden outside Anatomy)
    if (on === flickShut || !anchors.tongue) return; flickShut = on;
    if (on) { hidden.length = 0; for (const c of inside.children.concat(lowerT.children)) if (c !== lowerT && c !== anchors.tongue && c.visible) { c.visible = false; hidden.push(c); } }
    else { for (const c of hidden) c.visible = true; hidden.length = 0; }
    inside.visible = t > 0.01 || on;
  }
  function flick(s, o) { // (v6.26: o - this flick's own reach and number of waves, so no two flicks are alike)
    if (!tongueUpd) return;
    // (v5.93: out quickly and smoothly, held while the tips wave three or four times, then drawn back in - one flick per call
    // from 0 to 1, as extras.js now times them; the wave keeps going smoothly while it is out)
    const on = s > 0 && s < 1, ext = on ? (1 - Math.pow(1 - sstep(0, 0.16, s), 2)) * (1 - sstep(0.8, 1, s)) : 0;
    tongueUpd(ext * (o && o.r || 1), s * TAU * (o && o.w || 3.6));
    showOnlyTongue(on && t <= 0.01);
  }
  // v5.57: how far the mouth must open (t) for the jaws to part by 'sep' near their front, for prey of that width
  const angOf = (v) => gape * (v <= 1 ? 1 - Math.pow(1 - v, 2) : 1 + (v - 1) * 1.1);
  function tFor(sep) { for (let k = 0; k <= 58; k++) { const v = k / 40; if (xh * 0.85 * Math.sin(Math.min(1.5, angOf(v))) >= sep) return Math.max(0.3, v); } return 1.45; }
  return { set, settle, flick, tFor, get t() { return t; }, get ver() { return ver; }, get spread() { return spread; }, get walk() { return walk; }, headX: xh, anchors, fanged: fangs.length > 0 };
}

// ---------- ground and props ----------
// v5.88: light the snake as a photographer would (it used to sit in deep shade in a sunny scene: a black mamba, a garter
// snake or a milk snake came out nearly black). Only the snake's skin gets these, the scene keeps its own light:
// - shadows cast on the snake (grass blades, its own coils) are lifted part way, as open sky and nearby ground do outdoors;
// - a soft fill from the viewer's side (a reflector), and light bounced up from the ground onto the belly and lips;
// - light wraps a little past the shadow line, tinted warm, as it does in thin living skin (the belly, the lips)
const SKIN_LIGHT_GLSL = `#include <lights_fragment_end>
{
 vec3 slAlb = BRDF_Lambert(material.diffuseColor);
#if NUM_DIR_LIGHTS > 0
 vec3 slSunC = directionalLights[0].color; float slNL = dot(normal, directionalLights[0].direction);
 float slSh = clamp(dot(directLight.color, vec3(1.0)) / max(1e-4, dot(slSunC, vec3(1.0))), 0.0, 1.0);
 reflectedLight.directDiffuse += (1.0 - slSh) * uShLift * slSunC * max(slNL, 0.0) * slAlb;
 float slW = clamp((slNL + uWrap) / (1.0 + uWrap), 0.0, 1.0) * (1.0 - clamp(slNL * 2.0, 0.0, 1.0));
 reflectedLight.directDiffuse += slW * mix(1.0, slSh, 0.5) * slSunC * slAlb * uSSS * (0.6 + 0.4 * slAlb * 3.14159);
#endif
 vec3 slUpV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
 reflectedLight.indirectDiffuse += material.diffuseColor * (uFill * (0.55 + 0.45 * max(dot(normal, geometryViewDir), 0.0)) + uBounce * max(0.0, -dot(normal, slUpV)));
}`;
// v6.26 (reptile skin): after the material is set up - every body scale's own shine and gloss coat (slSpecV, slCoatV from
// the scale's hash), none of either down in the skin between the scales (slCavV: the cavity map), and the belly's wide
// plates a little glossier than the back (uGloss: the species' base gloss and coat, for the belly's own share)
const SKIN_SHINE_GLSL = `
{ float slBody = (1.0 - vHead) * (1.0 - vMet.z) * slTip * (1.0 - slHW), slGap = smoothstep(0.32, 0.8, slCavV);
  material.specularColor *= mix(1.0, slSpecV * mix(0.3, 1.0, slGap), slBody);
  material.roughness = mix(material.roughness, min(1.0, material.roughness * mix(1.35, 0.92, slGap)), slBody);
#ifdef USE_CLEARCOAT
  material.clearcoat = mix(material.clearcoat, saturate(material.clearcoat * slCoatV * slGap * mix(1.0, 1.25, slBelly) + 0.08 * slBelly * uGloss.y), slBody);
#endif
}
`;
// v6.26 (contact shading): the soft light from all round is cut where the skin faces another part of the body (aOcc, baked
// per pose) or lies close above the ground and faces it (worked out here from the skin's height, so it follows any movement)
const SKIN_OCC_GLSL = `
{ float slR = max(vSlOcc.y, 1e-5), slNy = dot(nonPerturbedNormal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
  float slG = uGroundAO * (0.5 - 0.5 * slNy) * exp(-max(vSlY, 0.0) / (0.75 * slR)) * step(1e-4, vSlOcc.y);
  float slO = 1.0 - (1.0 - vSlOcc.x) * (1.0 - 0.65 * slG);
  reflectedLight.indirectDiffuse *= 1.0 - slO; reflectedLight.indirectSpecular *= 1.0 - 0.8 * slO;
  reflectedLight.directDiffuse *= 1.0 - 0.35 * slO * slO; reflectedLight.directSpecular *= 1.0 - 0.5 * slO;
}`;
const SCENES = {
  litter:   { sky: ['#b9c7b0', '#d7ddcc'], fog: '#c3cbb9', sun: 1.6, hemi: 0.75, sunEl: 55, tile: 1.1, ground: 'litter', props: { leaves: 1, twigs: 1, rocks: 0.15, grass: 0.1 } },
  forest:   { sky: ['#a9bca6', '#ccd6c3'], fog: '#b9c6b2', sun: 1.7, hemi: 0.75, sunEl: 52, tile: 1.2, ground: 'litter', props: { leaves: 1, twigs: 1, log: 1, rocks: 0.2, grass: 0.15 } },
  // gibber (stony) plains of inland Australia, like the Moon Plain: red clay under a pavement of shiny stones
  gibber:   { sky: ['#8fb6dc', '#f1dcc4'], fog: '#ead2b8', sun: 2.4, hemi: 0.5, sunEl: 46, tile: 0.9, ground: 'gibber', props: { rocks: 0.35, grass: 0.06 } },
  arid:     { sky: ['#9fc0dd', '#efe3cf'], fog: '#e6dccb', sun: 2.2, hemi: 0.55, sunEl: 48, tile: 0.8, ground: 'gravel', props: { rocks: 1, grass: 0.5, twigs: 0.4 } },
  heath:    { sky: ['#a8bfd4', '#e4e7e3'], fog: '#d9ddd8', sun: 1.8, hemi: 0.6, sunEl: 40, tile: 0.8, ground: 'heath', props: { heather: 1, grass: 0.7, rocks: 0.1, twigs: 0.3 } },
  riverbank:{ sky: ['#a6c2d8', '#e2e9e4'], fog: '#d4ddd7', sun: 2.2, hemi: 0.7, sunEl: 46, tile: 0.9, ground: 'pebbles', water: 'river', props: { rocks: 0.6, reeds: 1, grass: 0.4, pebbles: 1 } },
  // v6.26: the blind snakes' and burrowers' ground, as they are found - turned up under a stone on moist, crumbly soil, with
  // decaying leaf fragments, fine roots, grit and a little moss (it was a flat brown floor with a few big painted leaves)
  soil:     { sky: ['#b3bfae', '#d8dccf'], fog: '#c8cec0', sun: 1.5, hemi: 0.8, sunEl: 58, tile: 0.35, ground: 'soil', leafSize: 0.55, leafCols: ['#4a3624', '#5a4230', '#3a2a1c', '#6b5236', '#433526', '#2f2418', '#5e4a2e'], props: { leaves: 1.1, twigs: 0.8, crumbs: 1, clods: 1, roots: 1, moss: 0.6, stone: 1 } },
  sea:      { sky: ['#7fb0d6', '#e3eef2'], fog: '#cfdfe6', sun: 2.6, hemi: 0.7, sunEl: 50, tile: 1, ground: null, water: 'sea', props: { drift: 1 } },
  grass:    { sky: ['#a3c1da', '#e6ead9'], fog: '#dde2d2', sun: 2.0, hemi: 0.6, sunEl: 48, tile: 0.9, ground: 'dry', props: { grass: 2.6, rocks: 0.2, twigs: 0.3 } },
  sand:     { sky: ['#9cc0de', '#f2e6cf'], fog: '#efe2cb', sun: 2.2, hemi: 0.5, sunEl: 50, tile: 1.0, ground: 'sand', props: { rocks: 0.3, grass: 0.3, twigs: 0.3 } },
  rainforest:{ sky: ['#9fb39b', '#c3cfbb'], fog: '#aebba7', sun: 1.3, hemi: 0.85, sunEl: 60, tile: 1.1, ground: 'litter', props: { leaves: 1.3, twigs: 1, rocks: 0.1, ferns: 1 } },
  // v5.93: more habitats (the Habitats button): the cracking-clay floodplains of the Channel Country (grey-brown clay
  // split into a net of deep cracks, a few gibber stones, sparse saltbush, lignum and Mitchell grass, coolibahs far off)
  clay:     { sky: ['#8db4dc', '#f0dcc8'], fog: '#e4d2c0', sun: 2.4, hemi: 0.5, sunEl: 46, tile: 1.6, ground: 'clay', props: { rocks: 0.08, twigs: 0.25 } },
  // a swamp: still dark (tea-coloured) water among buttressed trees - bald cypress with Spanish moss and knees in North
  // America, palms and broadleaf trees in the tropics - wet mud with fallen needles and leaves at the edge, sawgrass and reeds
  swamp:    { sky: ['#a7b8a4', '#d2d8c6'], fog: '#b6bfab', sun: 1.7, hemi: 0.8, sunEl: 54, tile: 1.0, ground: 'mud', water: 'river', waterCol: '#2e2a17', waterOp: 0.86, depth: 0.35, rough: 0.68, props: { twigs: 0.6, reeds: 1 } },
  // a rocky shore by a warm sea (sea kraits come ashore on rocks): dark wave-worn boulders and pebbles, clear blue-green water
  shore:    { sky: ['#7fb0d6', '#e3eef2'], fog: '#cfdfe6', sun: 2.5, hemi: 0.7, sunEl: 50, tile: 0.9, ground: 'pebbles', water: 'river', waterCol: '#1d6470', waterOp: 0.62, depth: 0.45, rock: '#5d5954', props: { rocks: 1.6, pebbles: 1.2 } },
};

// v6.02: a habitat's flavour can change how it looks: 'forest:savanna' is the open savanna woodland of Africa (dry grass
// under scattered flat-topped acacia-like trees, a few fallen leaves) where twig snakes and boomslangs live; 'forest:eucalypt'
// is Australia's open eucalypt woodland (gum trees over leaf litter and tussock grass)
const SCENE_FLAVOR = {
  'forest:eucalypt': { sky: ['#9fc0dc', '#e6e6d6'], fog: '#d6dbcc', sun: 2.0, hemi: 0.65, sunEl: 50, tile: 1.1, ground: 'litter', props: { leaves: 0.8, twigs: 1, log: 1, rocks: 0.25, grass: 0.9 } },
  'forest:savanna': { sky: ['#a3c1da', '#e8e9d6'], fog: '#dfe0cc', sun: 2.1, hemi: 0.6, sunEl: 50, tile: 0.9, ground: 'dry', props: { grass: 1.5, leaves: 0.3, twigs: 0.8, rocks: 0.25 } },
};
const sceneOf = (sc) => { const b = SCENES[sc && sc.kind] || SCENES.litter, f = sc && sc.flavor && SCENE_FLAVOR[sc.kind + ':' + sc.flavor]; return f ? Object.assign({}, b, f) : b; };
const envOf = (sc) => (sc.kind === 'forest' && (sc.flavor === 'savanna' || sc.flavor === 'eucalypt') ? 'sunrise' : ENV_FOR[sc.kind]);

// ---------- photographic surroundings: CC0 Polyhaven panoramas (via @pmndrs/assets), see CREDITS.txt ----------
// each habitat gets the panorama that fits it best; the snake's own ground is drawn up close and fades
// into the photo's ground, which is projected onto a flat floor so it meets the horizon without a seam
const ENV_FOR = { clay: 'dawn', swamp: 'forest', shore: 'sky', gibber: 'dawn', riverbank: 'park', forest: 'forest', rainforest: 'forest', litter: 'forest', soil: 'forest', grass: 'sunrise', heath: 'sunrise', arid: 'dawn', sand: 'dawn', sea: 'sky' };
const ENV_CACHE = new Map();
function parseHDR(buf) {
  const b = new Uint8Array(buf); let p = 0, line = '';
  const readLine = () => { let s = ''; while (p < b.length && b[p] !== 10) s += String.fromCharCode(b[p++]); p++; return s; };
  if (!readLine().startsWith('#?')) throw new Error('hdr');
  while ((line = readLine()) !== '') { /* header lines */ }
  const m = readLine().match(/-Y (\d+) \+X (\d+)/); if (!m) throw new Error('hdr size');
  const h = +m[1], w = +m[2], px = new Uint8Array(w * h * 4), sc = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    if (b[p] === 2 && b[p + 1] === 2 && ((b[p + 2] << 8) | b[p + 3]) === w) {
      p += 4;
      for (let c = 0; c < 4; c++) { let x = 0; while (x < w) { let n = b[p++]; if (n > 128) { n -= 128; const v = b[p++]; while (n--) sc[(x++) * 4 + c] = v; } else { while (n--) sc[(x++) * 4 + c] = b[p++]; } } }
      px.set(sc, y * w * 4);
    } else { px.set(b.subarray(p, p + w * 4), y * w * 4); p += w * 4; }
  }
  // float RGBA, bottom row first (v = 0 is straight down, as three.js samples equirectangular maps)
  const f = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((h - 1 - y) * w + x) * 4, d = (y * w + x) * 4, e = px[s + 3];
    const k = e ? Math.pow(2, e - 136) : 0; f[d] = px[s] * k; f[d + 1] = px[s + 1] * k; f[d + 2] = px[s + 2] * k; f[d + 3] = 1;
  }
  return { w, h, f };
}
function prepEnv(raw) {
  // normalise the sky to an average luminance of 1, find the sun, and take the sun out of the map
  // (a directional light with shadows stands in for it, so it is not counted twice)
  const { w, h, f } = raw, lum = (i) => f[i] * 0.2126 + f[i + 1] * 0.7152 + f[i + 2] * 0.0722;
  let sum = 0, n = 0, best = -1, bi = 0;
  for (let y = h >> 1; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, l = lum(i), wgt = Math.cos(((y + 0.5) / h - 0.5) * Math.PI); sum += Math.min(l, 50) * wgt; n += wgt; }
  for (let y = 1; y < h - 1; y++) for (let x = 0; x < w; x++) { let l = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) l += lum(((y + dy) * w + ((x + dx + w) % w)) * 4); if (l > best) { best = l; bi = y * w + x; } }
  const k = 0.45 / Math.max(1e-6, sum / n), peak = (best / 9) * k / 0.45;
  const sx = bi % w, sy = Math.floor(bi / w), phi = ((sx + 0.5) / w - 0.5) * TAU, th = ((sy + 0.5) / h - 0.5) * Math.PI;
  const sunDir = new THREE.Vector3(Math.cos(th) * Math.cos(phi), Math.sin(th), Math.cos(th) * Math.sin(phi)).normalize();
  // (the sun disc in these files is clipped to an unusable colour, so its colour comes from its height: warmer when low)
  const sunCol = new THREE.Color('#ffcf9a').lerp(new THREE.Color('#fff5e8'), sstep(0.05, 0.6, sunDir.y));
  // white balance, as a camera would: most of the cast of a blue sky is taken out (a little is kept)
  const avg = [0, 0, 0]; for (let y = 0; y < h; y++) { const wgt = Math.cos(((y + 0.5) / h - 0.5) * Math.PI); for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, l = Math.max(f[i], f[i + 1], f[i + 2]), s = l > 20 ? 20 / l : 1; avg[0] += f[i] * s * wgt; avg[1] += f[i + 1] * s * wgt; avg[2] += f[i + 2] * s * wgt; } }
  const al = avg[0] * 0.2126 + avg[1] * 0.7152 + avg[2] * 0.0722, wb = avg.map((v) => Math.pow(al / Math.max(v, 1e-6), 0.8));
  const cap = 3.5, data = new Float32Array(f.length);
  const hot = [sunCol.r * cap, sunCol.g * cap, sunCol.b * cap];
  for (let i = 0; i < f.length; i += 4) {
    const r = f[i] * k * wb[0], g = f[i + 1] * k * wb[1], b = f[i + 2] * k * wb[2], m = Math.max(r, g, b);
    if (m > cap * 4) { data[i] = hot[0]; data[i + 1] = hot[1]; data[i + 2] = hot[2]; } // the sun disc itself
    else { const s = m > cap ? cap / m : 1; data[i] = r * s; data[i + 1] = g * s; data[i + 2] = b * s; }
    data[i + 3] = 1;
  }
  // colour just above the horizon (for fog and the far edge of the water)
  const hor = [0, 0, 0]; { const y = Math.round(h * 0.53); for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; hor[0] += data[i]; hor[1] += data[i + 1]; hor[2] += data[i + 2]; } }
  return { w, h, data, sunDir, sunCol, sunny: clamp(Math.log10(Math.max(1, peak)) / 2.2, 0.25, 1), horizon: new THREE.Color(hor[0] / w, hor[1] / w, hor[2] / w) };
}
function loadEnv(name) {
  if (ENV_CACHE.has(name)) return ENV_CACHE.get(name);
  const pr = fetch(new URL('env/' + name + '.hdr', import.meta.url).href).then((r) => { if (!r.ok) throw new Error('env ' + r.status); return r.arrayBuffer(); }).then((b) => { const t0 = performance.now(), e = prepEnv(parseHDR(b)); perfT('envParse', t0); return e; });
  pr.catch(() => ENV_CACHE.delete(name)); ENV_CACHE.set(name, pr); return pr;
}
// a sphere whose lower half is pressed flat onto the ground: the panorama's own ground then lies on a
// floor at the camera height it was shot from (as three.js's GroundedSkybox does)
function groundedSkyGeometry(height, radius) {
  const g = new THREE.SphereGeometry(radius, 96, 48); g.scale(1, 1, -1);
  const pos = g.attributes.position, v = new THREE.Vector3(), y1 = -height * 1.5;
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); if (v.y < 0) { const f = v.y < y1 ? -height / v.y : 1 - (v.y * v.y) / (3 * y1 * y1); v.multiplyScalar(f); v.toArray(pos.array, i * 3); } }
  pos.needsUpdate = true; g.computeBoundingSphere(); return g;
}

function canvasTex(S, draw, rep, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d'); draw(x, S);
  const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep, rep);
  t.anisotropy = 4; return t;
}
// v4.81: each kind of ground is drawn once per visit and reused (opening another species is much faster)
const GROUND_CACHE = new Map();
function groundTexture(kind, seed0, hi) {
  const key = kind + (hi ? '@hi' : '@lo'), hit = GROUND_CACHE.get(key);
  if (hit) { const t = new THREE.CanvasTexture(hit); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
  if (GROUND_CACHE.size > 1) GROUND_CACHE.delete(GROUND_CACHE.keys().next().value);
  const seed = strSeed(kind) + 5, R = rng(seed);
  // v4.72: drawn at twice the resolution on good devices (same layout, finer detail)
  const out = canvasTex(hi ? 2048 : 1024, (x, SS) => {
    const S = 1024; x.scale(SS / S, SS / S);
    // draw fn at the position and at its wrapped copies, so the texture tiles without seams
    const wrapAt = (cx, cy, r, fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const X = cx + ox, Y = cy + oy; if (X + r < 0 || X - r > S || Y + r < 0 || Y - r > S) continue; x.save(); x.translate(X, Y); fn(); x.restore(); } };
    const base = { clay: '#8b7160', mud: '#3b3226', gibber: '#a8613a', litter: '#3b2e22', gravel: '#b7a58c', heath: '#6f5f4a', pebbles: '#6f675a', soil: '#3f3024', dry: '#6f6a44', sand: '#d8c39a' }[kind] || '#777';
    // v4.81: light and dark patches from a small tileable noise image drawn scaled up (no per-pixel work and no
    // read-back), and leaves and stones stamped from a few pre-drawn sprites: about 10x faster to make
    const NG = 128, noiseCanvas = (fn) => {
      const c = document.createElement('canvas'); c.width = c.height = NG + 2; const g = c.getContext('2d'), img = g.createImageData(NG + 2, NG + 2);
      for (let j = 0; j < NG + 2; j++) for (let i = 0; i < NG + 2; i++) { const n = tfbm(((i + NG - 1) % NG) / NG * 6, ((j + NG - 1) % NG) / NG * 6, 6, seed + 1, 5) - 0.5, v = fn(n), k = (j * (NG + 2) + i) * 4; img.data[k] = v[0]; img.data[k + 1] = v[1]; img.data[k + 2] = v[2]; img.data[k + 3] = 255; }
      g.putImageData(img, 0, 0); return c;
    };
    const bc = hex(base);
    x.drawImage(noiseCanvas((n) => bc.map((v) => v * (1 + n * (kind === 'sand' ? 0.25 : 0.4)))), 1, 1, NG, NG, 0, 0, S, S);
    const tone = (amt) => { x.save(); x.globalCompositeOperation = 'soft-light'; x.drawImage(noiseCanvas((n) => { const v = clamp(128 + n * amt * 2 * 255, 0, 255); return [v, v, v]; }), 1, 1, NG, NG, 0, 0, S, S); x.restore(); };
    const shade = (hexc, k) => { const c = hex(hexc); return 'rgb(' + c.map((v) => Math.round(clamp(v * k, 0, 255))).join(',') + ')'; };
    const sprite = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.translate(w / 2, h / 2); draw(g); return c; };
    const LS = new Map(), leafSprite = (col, curl) => { const k = col + (curl * 3 | 0); if (!LS.has(k)) LS.set(k, sprite(256, 128, (g) => {
      // soft shadow, then the blade with a light-to-dark gradient, an edge and veins (drawn at l = 220, w = 40)
      const l = 220, w = 40, cu = (curl * 3 | 0) / 3;
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(l * 0.04, w * 0.35, l * 0.52, w * 1.05, 0, 0, TAU); g.fill();
      const gr = g.createLinearGradient(-l / 2, -w, l / 2, w); gr.addColorStop(0, shade(col, 1.12 + cu * 0.1)); gr.addColorStop(1, shade(col, 0.78));
      g.fillStyle = gr; g.beginPath(); g.moveTo(-l / 2, 0); g.bezierCurveTo(-l * 0.25, -w * 1.3, l * 0.25, -w * 1.1, l / 2, 0); g.bezierCurveTo(l * 0.25, w * 1.1, -l * 0.25, w * 1.3, -l / 2, 0); g.fill();
      g.strokeStyle = 'rgba(20,12,6,.35)'; g.lineWidth = 1.6; g.stroke();
      g.strokeStyle = 'rgba(255,235,200,.18)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-l / 2, 0); g.lineTo(l / 2, 0); for (let v = -0.3; v < 0.4; v += 0.14) { g.moveTo(l * v, 0); g.lineTo(l * (v + 0.1), -w * 0.7); g.moveTo(l * v, 0); g.lineTo(l * (v + 0.1), w * 0.7); } g.stroke();
    })); return LS.get(k); };
    const leaf = (l, w, col, curl) => { x.drawImage(leafSprite(col, curl), -l * 128 / 220, -(w / 40) * 64, l * 256 / 220, (w / 40) * 128); };
    const SS2 = new Map(), stoneSprite = (c0, c1, wet, v) => { const k = c0 + c1 + (wet ? 1 : 0) + v; if (!SS2.has(k)) SS2.set(k, sprite(128, 128, (g) => {
      const r = 52, Rr = rng(seed + v * 7 + c0.length);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(r * 0.12, r * 0.15, r * 1.04, r * 1.04, 0, 0, TAU); g.fill();
      const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r * 1.05); gr.addColorStop(0, c0); gr.addColorStop(0.7, c1); gr.addColorStop(1, shade(c1, 0.7));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      if (wet) { g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.ellipse(-r * 0.35, -r * 0.45, r * 0.25, r * 0.12, -0.4, 0, TAU); g.fill(); }
      for (let i = 0; i < 4; i++) { g.fillStyle = Rr() < 0.5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'; g.beginPath(); g.arc((Rr() - 0.5) * r, (Rr() - 0.5) * r, r * 0.12, 0, TAU); g.fill(); }
    })); return SS2.get(k); };
    const stone = (r, ry, c0, c1, wet) => { x.drawImage(stoneSprite(c0, c1, wet, (R() * 3) | 0), -r * 64 / 52, -ry * 64 / 52, r * 128 / 52, ry * 128 / 52); };
    if (kind === 'litter' || kind === 'soil') {
      const pal = kind === 'litter' ? ['#6a4a2e', '#7d5a36', '#8c6a42', '#55402a', '#6b5536', '#3e2e20', '#86663f', '#9a7a4e', '#5e5032', '#4a3a26'] : ['#4a3826', '#3e2e20', '#5a4532', '#33261a', '#55402c'];
      // (v5.50: the soil tile is only 35 cm across, so its few leaves are drawn big - 4-9 cm, their real size - not as crumbs;
      // v6.26: on soil, many small dark decaying fragments, 1-3 cm, instead of a few whole leaves as big as a blind snake
      // lying flat like stickers)
      const n = kind === 'litter' ? 2600 : 160;
      for (let i = 0; i < n; i++) {
        const cx = R() * S, cy = R() * S, big = R() < 0.15, l = kind === 'litter' ? 18 + R() * (big ? 70 : 34) : 30 + R() * 60, w = l * (0.25 + R() * 0.3), a = R() * TAU, col = pal[(R() * pal.length) | 0], curl = R();
        wrapAt(cx, cy, l, () => { x.rotate(a); leaf(l, w, col, curl); });
      }
      for (let i = 0; i < (kind === 'litter' ? 90 : 40); i++) {
        const cx = R() * S, cy = R() * S, l = 20 + R() * 110, a = R() * TAU, w = 1 + R() * 2.5;
        wrapAt(cx, cy, l, () => { x.rotate(a); x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = w + 1.5; x.beginPath(); x.moveTo(1, 2); x.lineTo(l + 1, 2); x.stroke(); x.strokeStyle = R() < 0.5 ? '#4a3826' : '#6a5438'; x.lineWidth = w; x.beginPath(); x.moveTo(0, 0); x.lineTo(l, 0); x.stroke(); });
      }
      // v5.12: cushions of moss between the leaves, as on a real damp forest floor (many tiny green tufts in soft patches)
      if (kind === 'litter') {
        const mossC = ['#4d6a26', '#5f7d2e', '#6f8f36', '#3f5a22', '#87a046', '#56722a'];
        for (let pch = 0; pch < 22; pch++) {
          const px = R() * S, py = R() * S, pr = 40 + R() * 110;
          for (let i = 0; i < pr * 9; i++) {
            const a = R() * TAU, rr = pr * Math.sqrt(R()) * (0.75 + 0.25 * Math.sin(a * 3 + pch)), cx = px + Math.cos(a) * rr, cy = py + Math.sin(a) * rr, r = 1.5 + R() * 3.5 * (1 - rr / pr * 0.6);
            wrapAt(cx, cy, r, () => { x.fillStyle = mossC[(R() * mossC.length) | 0]; x.globalAlpha = 0.55 + R() * 0.45; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.fill(); x.globalAlpha = 1; });
          }
        }
      }
      if (kind === 'soil') { // (v6.26: crumbs of earth, dull - the glossy highlight on each read as drops of water - and fine pale rootlets)
        for (let i = 0; i < 1800; i++) { const cx = R() * S, cy = R() * S, r = 1.5 + R() ** 2 * 5, c = R() < 0.5; wrapAt(cx, cy, r * 2, () => stone(r, r * (0.6 + R() * 0.4), c ? '#5e4a38' : '#4a3a2c', c ? '#2e2219' : '#241a12', false)); }
        for (let i = 0; i < 30; i++) { const cx = R() * S, cy = R() * S, l = 40 + R() * 160, a = R() * TAU; wrapAt(cx, cy, l, () => { x.rotate(a); x.strokeStyle = R() < 0.5 ? 'rgba(150,118,84,.55)' : 'rgba(110,86,60,.6)'; x.lineWidth = 0.8 + R() * 1.4; x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(l * 0.3, (R() - 0.5) * 30, l * 0.7, (R() - 0.5) * 30, l, (R() - 0.5) * 20); x.stroke(); }); }
      }
      tone(0.25);
    } else if (kind === 'gravel' || kind === 'sand') {
      const cols = [['#d8cab4', '#9c8b76'], ['#c4b29a', '#7d6d5a'], ['#e0d6c8', '#a39a8b'], ['#b29c85', '#6c5a48'], ['#cdb593', '#8a7254'], ['#a8a39a', '#6a665e']];
      const n = kind === 'gravel' ? 2600 : 250;
      for (let i = 0; i < n; i++) { const cx = R() * S, cy = R() * S, r = 2.5 + R() ** 3 * (kind === 'gravel' ? 8 : 3), c = cols[(R() * cols.length) | 0]; wrapAt(cx, cy, r * 2, () => { x.rotate(R() * 3); stone(r, r * (0.55 + R() * 0.4), c[0], c[1]); }); }
      for (let i = 0; i < 30; i++) { const cx = R() * S, cy = R() * S, l = 20 + R() * 60, a = R() * TAU; wrapAt(cx, cy, l, () => { x.rotate(a); x.strokeStyle = 'rgba(70,55,35,.7)'; x.lineWidth = 1 + R(); x.beginPath(); x.moveTo(0, 0); x.lineTo(l, (R() - 0.5) * 8); x.stroke(); }); }
    } else if (kind === 'gibber') {
      // a close pavement of rounded, wind-polished stones in reds, browns and near-black, with red clay between
      const cols = [['#8c3f26', '#5a2416'], ['#7a3a22', '#4a2012'], ['#5e3324', '#33190f'], ['#9a5233', '#62301c'], ['#3d2a22', '#1e130d'], ['#a8683f', '#6e3d22']];
      for (let i = 0; i < 1500; i++) { const cx = R() * S, cy = R() * S, r = 5 + R() ** 2 * 18, c = cols[(R() * cols.length) | 0]; wrapAt(cx, cy, r * 2, () => { x.rotate(R() * 3); stone(r, r * (0.6 + R() * 0.35), c[0], c[1], R() < 0.5); }); }
      tone(0.12);
    } else if (kind === 'pebbles') {
      const cols = [['#8f877a', '#6a6357'], ['#857b6b', '#5f564a'], ['#959087', '#716c63'], ['#7f7262', '#5a4d3f'], ['#7d807a', '#5b5e58'], ['#8e7c66', '#665441']];
      for (let i = 0; i < 2600; i++) { const cx = R() * S, cy = R() * S, r = 3 + R() ** 2.5 * 16, c = cols[(R() * cols.length) | 0]; wrapAt(cx, cy, r * 2, () => { x.rotate(R() * 3); stone(r, r * (0.6 + R() * 0.35), c[0], c[1], R() < 0.12); }); }
      tone(0.15);
    } else if (kind === 'clay') {
      // v5.93: cracking clay (the Channel Country's floodplains as they dry): grey-brown plates 15-40 cm across, split by
      // wandering cracks 1-3 cm wide (wider where they meet), each plate broken again by fine shallow cracks, its edges a
      // little paler where they curl up; a few small gibber stones and wisps of dry grass. The crack nets are two wobbly
      // Voronoi patterns (big plates, then small ones) worked out on a small tileable grid.
      const G = 512, img = x.createImageData(G, G);
      const net = (cellN, sd) => { const R2 = rng(seed + sd), pts = []; for (let j = 0; j < cellN; j++) for (let i = 0; i < cellN; i++) pts.push([(i + 0.1 + R2() * 0.8) / cellN, (j + 0.1 + R2() * 0.8) / cellN, R2()]); return { cellN, pts }; };
      const N1 = net(6, 21), N2 = net(15, 23);
      const vor = (N, u, v) => {
        const cN = N.cellN, ci = Math.floor(u * cN), cj = Math.floor(v * cN); let d1 = 9, d2 = 9, id = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const a = ci + di, b = cj + dj, p = N.pts[((b % cN) + cN) % cN * cN + ((a % cN) + cN) % cN];
          const d = Math.hypot(u - (p[0] + Math.floor(a / cN)), v - (p[1] + Math.floor(b / cN)));
          if (d < d1) { d2 = d1; d1 = d; id = p[2]; } else if (d < d2) d2 = d;
        }
        return [(d2 - d1) * cN, id, d1 * cN];
      };
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const u0 = i / G, v0 = j / G, wx = (tfbm(u0 * 6, v0 * 6, 6, seed + 11, 3) - 0.5) * 0.09, wy = (tfbm(u0 * 6 + 3.1, v0 * 6, 6, seed + 13, 3) - 0.5) * 0.09;
        const [e1, id1] = vor(N1, u0 + wx, v0 + wy), [e2] = vor(N2, u0 + wx * 1.6 + 0.013, v0 + wy * 1.6);
        const wN = tfbm(u0 * 14, v0 * 14, 14, seed + 19, 2), w1 = 0.025 + 0.05 * wN;
        const crack = 1 - sstep(w1 * 0.6, w1 * 1.6, e1), fine = (1 - sstep(0.015, 0.05, e2)) * (0.5 + 0.5 * wN) * (1 - crack), rim = sstep(w1 * 1.6, w1 * 3, e1) * (1 - sstep(w1 * 3, w1 * 7, e1));
        const n = (tfbm(u0 * 32, v0 * 32, 32, seed + 17, 3) - 0.5) * 0.2, tn = 0.86 + id1 * 0.22;
        const b = (tn + n + rim * 0.1) * (1 - crack * 0.62) * (1 - fine * 0.28), k = (j * G + i) * 4;
        img.data[k] = clamp(128 * b, 0, 255); img.data[k + 1] = clamp(110 * b, 0, 255); img.data[k + 2] = clamp(95 * b, 0, 255); img.data[k + 3] = 255;
      }
      const cc = document.createElement('canvas'); cc.width = cc.height = G; cc.getContext('2d').putImageData(img, 0, 0);
      x.save(); x.imageSmoothingEnabled = true; x.drawImage(cc, 0, 0, S, S); x.restore();
      const cols = [['#6e4a38', '#3a2418'], ['#5a4a42', '#2e2620'], ['#7a5a44', '#44301e']];
      for (let i = 0; i < 28; i++) { const cx = R() * S, cy = R() * S, r = 3 + R() ** 2 * 8, c = cols[(R() * cols.length) | 0]; wrapAt(cx, cy, r * 2, () => { x.rotate(R() * 3); stone(r, r * (0.6 + R() * 0.35), c[0], c[1], R() < 0.4); }); }
      for (let i = 0; i < 120; i++) { const cx = R() * S, cy = R() * S, l = 10 + R() * 40, a = R() * TAU; wrapAt(cx, cy, l, () => { x.rotate(a); x.strokeStyle = ['#b9a679', '#a08d62', '#c8b88e'][(R() * 3) | 0]; x.globalAlpha = 0.6; x.lineWidth = 0.8 + R(); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(l * 0.5, (R() - 0.5) * 6, l, (R() - 0.5) * 8); x.stroke(); x.globalAlpha = 1; }); }
      tone(0.12);
      // v5.93: swamp mud at the water's edge: dark and wet, with fallen leaves, thin cypress needles and bits of twig pressed in
      for (let i = 0; i < 1400; i++) { const cx = R() * S, cy = R() * S, l = 8 + R() * 16, a = R() * TAU, col = ['#7a4a26', '#8c5a2e', '#5e3a20', '#a0703c'][(R() * 4) | 0]; wrapAt(cx, cy, l, () => { x.rotate(a); x.strokeStyle = col; x.globalAlpha = 0.55 + R() * 0.35; x.lineWidth = 1.2 + R() * 0.8; x.beginPath(); x.moveTo(0, 0); x.lineTo(l, (R() - 0.5) * 2); x.stroke(); x.globalAlpha = 1; }); }
      const pal = ['#4a3622', '#5c4428', '#3c2c1c', '#6a5030', '#55452a'];
      for (let i = 0; i < 260; i++) { const cx = R() * S, cy = R() * S, l = 22 + R() * 46, w = l * (0.22 + R() * 0.15), a = R() * TAU, col = pal[(R() * pal.length) | 0], curl = R(); wrapAt(cx, cy, l, () => { x.rotate(a); x.globalAlpha = 0.85; leaf(l, w, col, curl); x.globalAlpha = 1; }); }
      for (let i = 0; i < 40; i++) { const cx = R() * S, cy = R() * S, r = 30 + R() * 90; wrapAt(cx, cy, r, () => { const g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(20,16,10,.35)'); g.addColorStop(1, 'rgba(20,16,10,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, r, r * 0.7, R() * 3, 0, TAU); x.fill(); }); }
      tone(0.22);
    } else if (kind === 'heath' || kind === 'dry') {
      const strokes = kind === 'heath' ? ['#3a2f25', '#5a4a38', '#8a7a5c', '#b4a27c', '#4a3f30', '#6b4f5a'] : ['#a89a66', '#7d7a46', '#b8aa78', '#5d6634', '#8c8a52', '#4f5a2c'];
      for (let i = 0; i < 5200; i++) { const cx = R() * S, cy = R() * S, l = 6 + R() * 30, a = R() * TAU, col = strokes[(R() * strokes.length) | 0], w = 0.6 + R() * 1.4; wrapAt(cx, cy, l, () => { x.rotate(a); x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(l * 0.5, (R() - 0.5) * 6, l, (R() - 0.5) * 4); x.stroke(); }); }
      if (kind === 'heath') for (let i = 0; i < 40; i++) { const cx = R() * S, cy = R() * S, r = 14 + R() * 34; wrapAt(cx, cy, r * 1.3, () => { for (let k = 0; k < 160; k++) { const a = R() * TAU, rr = r * Math.sqrt(R()); x.fillStyle = ['rgba(62,78,36,.55)', 'rgba(84,98,46,.5)', 'rgba(48,60,30,.5)'][k % 3]; x.beginPath(); x.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.75, 1 + R() * 2.2, 0, TAU); x.fill(); } }); }
      tone(0.2);
    }
  }, 1);
  GROUND_CACHE.set(key, out.image); return out;
}
function waterNormal(seed) {
  const S = 256, d = new Uint8Array(S * S * 4), h = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) h[j * S + i] = tfbm(i / S * 6, j / S * 6, 6, seed, 4);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = (h[j * S + (i + 1) % S] - h[j * S + (i + S - 1) % S]) * 6, dy = (h[((j + 1) % S) * S + i] - h[((j + S - 1) % S) * S + i]) * 6, l = Math.hypot(dx, dy, 1), k = (j * S + i) * 4;
    d[k] = (-dx / l * 0.5 + 0.5) * 255; d[k + 1] = (-dy / l * 0.5 + 0.5) * 255; d[k + 2] = (1 / l * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; return t;
}

function weld(g) {
  // the polyhedron geometries are not indexed: join equal vertices so the rock is smooth-shaded
  const p = g.attributes.position, map = new Map(), pos = [], idx = [];
  for (let i = 0; i < p.count; i++) { const k = Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4); let j = map.get(k); if (j == null) { j = pos.length / 3; map.set(k, j); pos.push(p.getX(i), p.getY(i), p.getZ(i)); } idx.push(j); }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setIndex(idx); g.dispose(); return o;
}
function rockGeometry(seed, detail) {
  const g = weld(new THREE.IcosahedronGeometry(1, detail)), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = fbm(v.x * 1.6 + 3, v.y * 1.6, v.z * 1.6, seed, 3); v.multiplyScalar(0.72 + n * 0.6); v.y *= 0.62; p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals();
  const uv = []; for (let i = 0; i < p.count; i++) uv.push(p.getX(i) * 0.5 + 0.5, p.getZ(i) * 0.5 + 0.5 + p.getY(i) * 0.3); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
function bladeTuft(seed, n, h, colA, colB, spread, o = {}) {
  const R = rng(seed), pos = [], col = [], ca = new THREE.Color(colA), cb = new THREE.Color(colB), tip = o.tip ? new THREE.Color(o.tip) : null, grn = o.green ? new THREE.Color(o.green) : null;
  for (let b = 0; b < n; b++) {
    const a = R() * TAU, r = R() * spread, x0 = Math.cos(a) * r, z0 = Math.sin(a) * r, hh = h * (0.55 + R() * 0.6), lean = (o.lean || 0.3) * (0.4 + R() * 1.1), la = o.lean ? a + (R() - 0.5) : R() * TAU, w = h * (o.w || 0.025) * (0.7 + R() * 0.6);
    const seg = 4; let prev = null; const c = (grn && R() < 0.35 ? grn.clone() : ca.clone().lerp(cb, R()));
    for (let s = 0; s <= seg; s++) {
      const f = s / seg, y = hh * f * (1 - 0.25 * lean * f), off = lean * hh * f * f * 0.6, cx = x0 + Math.cos(la) * off, cz = z0 + Math.sin(la) * off, ww = w * (1 - f * (o.tip ? 0.4 : 0.9));
      const L = [cx - Math.sin(la) * ww, y, cz + Math.cos(la) * ww], Rr = [cx + Math.sin(la) * ww, y, cz - Math.cos(la) * ww];
      if (prev) { pos.push(...prev[0], ...prev[1], ...L, ...prev[1], ...Rr, ...L); const cc = (tip && f > 0.5 ? c.clone().lerp(tip, (f - 0.5) * 1.6) : c.clone()).multiplyScalar(0.55 + 0.45 * f); for (let k = 0; k < 6; k++) col.push(cc.r, cc.g, cc.b); }
      prev = [L, Rr];
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
function leafGeometry() {
  const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.quadraticCurveTo(0, 0.3, 0.5, 0); s.quadraticCurveTo(0, -0.3, -0.5, 0);
  const g = new THREE.ShapeGeometry(s, 6); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 0.06 * (1 - (2 * x) ** 2) + 0.12 * z * z * 4 * 0.25); }
  g.computeVertexNormals(); return g;
}

function buildScene(ctx, P, F, body, poseInfo, seed, quality) {
  if (NATURE.resetAmbient) NATURE.resetAmbient(); // v5.73: the wind and water clocks start afresh with each scene
  const { scene } = ctx, S = sceneOf(P.scene), R = rng(seed + 77);
  const Rb = poseInfo.radius, L = F.L;
  const envR = poseInfo.envR || Rb, groundR = Math.max(Rb * 16, envR * 9);
  const sky = new THREE.Color(S.sky[0]), hor = new THREE.Color(S.fog);
  // sky dome (gradient, no image): believable from any angle, fades into the same haze as the fog
  // v4.72: a real 3D world all round (hills, trees or rocks out to farR), no photo backdrop
  const farR = Math.max(groundR * 4, 60), skyR = farR * 1.3;
  const skyGeo = new THREE.SphereGeometry(skyR, 48, 24), cols = [], p = skyGeo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / skyR, c = hor.clone().lerp(sky, sstep(0.0, 0.5, y)); if (y < 0) c.copy(hor); cols.push(c.r, c.g, c.b); }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const skyMesh = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  skyMesh.renderOrder = -1; scene.add(skyMesh);
  // (v4.72: a sun glow and clouds were tried here, but the big see-through sprites washed out half the view - removed)
  ctx.skyMesh = skyMesh; ctx.groundR = groundR; ctx.fadeMats = [];
  // v5.50: the sky is blue above a low band of haze (it used to stay the haze's grey up to 30 degrees, so a low view
  // showed a flat grey sky), deeper overhead, and warmer and brighter towards the sun; repainted when the sun moves
  const skyDeep = sky.clone().multiplyScalar(0.8).lerp(new THREE.Color('#5d8fc4'), 0.25), warm = new THREE.Color('#fff0d2'), sv0 = new THREE.Vector3(), sc0 = new THREE.Color();
  ctx.paintSky = (horizon) => {
    if (horizon) ctx.skyHor = horizon.clone();
    const hz = ctx.skyHor || hor, sd = ctx.sun ? ctx.sun.position.clone().normalize() : null, pp = skyGeo.attributes.position, cc = skyGeo.attributes.color;
    for (let i = 0; i < pp.count; i++) {
      sv0.fromBufferAttribute(pp, i).normalize(); const y = sv0.y;
      sc0.copy(hz).lerp(sky, sstep(-0.01, 0.3, y)).lerp(skyDeep, sstep(0.35, 1, y) * 0.5);
      if (sd && y > -0.05) sc0.lerp(warm, Math.pow(Math.max(0, sv0.dot(sd)), 6) * 0.45 * (1 - sstep(0.15, 0.7, y)));
      if (y < 0) sc0.copy(hz);
      cc.setXYZ(i, sc0.r, sc0.g, sc0.b);
    }
    cc.needsUpdate = true;
  };
  scene.fog = new THREE.Fog(hor, Math.max(Rb * 6, envR * 3.5), farR * 0.95); ctx.farR = farR; ctx.fogNear0 = scene.fog.near;
  scene.background = hor;

  // environment light from a simple sky/ground gradient (soft reflections; no image is fetched)
  const envScene = new THREE.Scene();
  const eg = new THREE.SphereGeometry(10, 32, 16), ec = [], ep = eg.attributes.position, gcol = new THREE.Color(S.ground ? ({ clay: '#7d6553', mud: '#3a3125', gibber: '#9a5a38', litter: '#4a3a29', gravel: '#b49f86', heath: '#7d6b52', pebbles: '#8f8677', soil: '#4a3828', dry: '#9b8a62', sand: '#d8c39a' }[S.ground]) : '#2c5d7a');
  for (let i = 0; i < ep.count; i++) { const y = ep.getY(i) / 10, c = y > 0 ? hor.clone().lerp(sky, sstep(0, 0.6, y)).multiplyScalar(1.15) : gcol.clone().multiplyScalar(0.7); ec.push(c.r, c.g, c.b); }
  eg.setAttribute('color', new THREE.Float32BufferAttribute(ec, 3));
  envScene.add(new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pm = new THREE.PMREMGenerator(ctx.renderer); const envRT = pm.fromScene(envScene, 0.02); pm.dispose(); eg.dispose(); envScene.children[0].material.dispose();
  scene.environment = envRT.texture; ctx.track(envRT);

  // lights
  const hemi = new THREE.HemisphereLight(sky.clone().lerp(new THREE.Color('#ffffff'), 0.4), gcol, S.hemi); scene.add(hemi); ctx.hemi = hemi; ctx.envRT = envRT;
  const sun = new THREE.DirectionalLight('#fff4e2', S.sun);
  const el = (S.sunEl * Math.PI) / 180, az = 0.9;
  // v5.50: the shadows reach the real-size grass, stones and logs round a small snake too (not only its own few cm)
  const sunD = Math.max(Rb * 6, 3), shExt = Math.max(Rb * 1.5, quality === 'low' ? 0.45 : 0.55); // (v5.78: a little tighter round a small snake, so the 2048 map stays as sharp as the old 4096 one)
  sun.position.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(sunD);
  sun.castShadow = true;
  const sm = quality === 'high' ? 2048 : 1024; sun.shadow.mapSize.set(sm, sm); // v5.78: 2048 (4096 took 128 MB of graphics memory for no visible gain over the snake's small area)
  const sc = sun.shadow.camera; sc.left = sc.bottom = -shExt; sc.right = sc.top = shExt; sc.near = Math.max(0.01, sunD - Math.max(Rb * 5.5, 2.5)); sc.far = sunD + Math.max(Rb * 8, 3);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = F.w0 * 0.04; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  ctx.sun = sun; ctx.paintSky();

  // ground
  const waterY = { y: null };
  const dist2snake = (x, z) => { let m = 1e9; for (let i = 0; i < poseInfo.pts.length; i += 6) { const q = poseInfo.pts[i], d = Math.hypot(q[0] - x, q[1] - z) - F.W(i * poseInfo.ds); if (d < m) m = d; } return m; };
  if (ctx.ground && ctx.ground({ THREE, scene, S, P, F, poseInfo, Rb, seed, quality, sky, hor, gcol, dist2snake, fbm, rng, sstep })) return; // v6.14: "See the spot" (spot.js) makes the real ground itself
  // v5.50: the world round the snake is real-world size, never scaled to the snake (a thread snake used to get tiny
  // leaves, pebbles and hummocks and so looked as big as a python): the land's gentle rise is about a metre over
  // 10-20 m, and it starts beyond the snake (and beyond a few metres round a small one)
  const rise0 = Math.max(Rb * 7, 3), rise = (x, z, r) => (fbm(x / 12, z / 12, 1, seed + 53, 3) - 0.35) * 0.9 * sstep(rise0, rise0 + 9, r);
  ctx.rise = rise;
  let groundH = (x, z) => rise(x, z, Math.hypot(x, z)); // (what props stand on; the river bank sets its own below)
  if (S.ground) {
    const gg = new THREE.CircleGeometry(groundR, 128, 0, TAU); gg.rotateX(-Math.PI / 2);
    // finer rings near the middle so the riverbank slope is smooth
    const tG = performance.now(); const tex = groundTexture(S.ground, seed + 5, quality !== 'low'); perfT('groundTex', tG); tex.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy(); const rep = (groundR * 2) / S.tile; tex.repeat.set(rep, rep); // v5.50: the leaves and stones painted on the ground keep their real size (S.tile metres per tile) for every snake
    const gm = new THREE.MeshStandardMaterial({ map: tex, roughness: S.rough || 0.96, metalness: 0, bumpMap: tex, bumpScale: Math.min(1, L * 0.5) * 0.6 });
    if (NATURE.groundDetail) NATURE.groundDetail(THREE, gm, S.ground, ctx, { onLoad: () => ctx.afterNature && ctx.afterNature() }); // v5.83: sharp close up
    if (S.water === 'river') {
      // the bank slopes down into shallow water on one side, away from the snake
      const geo = new THREE.PlaneGeometry(groundR * 2, groundR * 2, 160, 160); geo.rotateX(-Math.PI / 2);
      // v5.50: a real bank (the water about 20 cm deep a little way out, the shore wandering by a few tens of cm), the
      // same for every snake; the water's edge is just past the snake, wherever the wavy shoreline puts it
      const dir = new THREE.Vector2(Math.cos(poseInfo.waterDir), Math.sin(poseInfo.waterDir)), depth = S.depth || 0.2;
      const wob = (al) => (fbm(al / 2.4, 3.1, 0.7, seed + 19, 3) - 0.5) * 1.1;
      let edge = -1e9; for (let i = 0; i < poseInfo.pts.length; i += 3) { const q = poseInfo.pts[i]; edge = Math.max(edge, q[0] * dir.x + q[1] * dir.y + wob(-q[0] * dir.y + q[1] * dir.x)); }
      edge += F.w0 * 2.5 + 0.06;
      const pp = geo.attributes.position, uvs = geo.attributes.uv;
      for (let i = 0; i < pp.count; i++) {
        // squeeze the grid toward the middle: fine cells near the snake for a smooth, irregular shoreline
        let x = pp.getX(i) / groundR, z = pp.getZ(i) / groundR; x = Math.sign(x) * x * x * groundR; z = Math.sign(z) * z * z * groundR;
        pp.setX(i, x); pp.setZ(i, z); uvs.setXY(i, x / (2 * groundR) + 0.5, 0.5 - z / (2 * groundR));
        const along = -x * dir.y + z * dir.x, s = x * dir.x + z * dir.y + wob(along); // a wavy shoreline
        pp.setY(i, -depth * sstep(edge - 0.06, edge + 0.55, s) + (fbm(x * 2.5, z * 2.5, 1, seed, 2) - 0.5) * 0.025 * sstep(0.15, 0.5, Math.abs(s - edge)));
      }
      geo.computeVertexNormals();
      const g2 = new THREE.Mesh(geo, gm); g2.receiveShadow = true; scene.add(g2); ctx.fadeMats.push(gm);
      const wm = new THREE.MeshPhysicalMaterial({ color: S.waterCol || '#2f4d48', roughness: 0.16, metalness: 0, transparent: true, opacity: S.waterOp || 0.72, envMapIntensity: 0.45, normalMap: waterNormal(seed), normalScale: new THREE.Vector2(0.35, 0.35) }); // v4.72: clear dark river water (not a pale sheet)
      wm.normalMap.repeat.set(groundR * 2 / 1.6, groundR * 2 / 1.6); // ripples at their real size (the pattern repeats every 1.6 m)
      const wSeg = quality === 'low' ? 40 : 80, wg = new THREE.PlaneGeometry(groundR * 2, groundR * 2, wSeg, wSeg); wg.rotateX(-Math.PI / 2);
      const water = new THREE.Mesh(wg, wm); water.position.y = -depth * 0.35; water.renderOrder = 2; scene.add(water); ctx.fadeMats.push(wm);
      if (NATURE.water) NATURE.water(THREE, water, { swell: 0.003, calmR: Math.max(Rb * 0.6, 0.15), drift: 0.025, refract: quality !== 'low', size: groundR * 2, track: ctx.track, bed: (x, z) => -depth * sstep(edge - 0.06, edge + 0.55, x * dir.x + z * dir.y + wob(-x * dir.y + z * dir.x)) }); // v5.73: gentle moving ripples on the river (v5.83: refraction, foam at the shore)
      if (gm.userData.caustics) gm.userData.caustics(water.position.y); // v5.83: caustics on the bed
      ctx.waterInfo = { dir, edge, wob, depth };
      groundH = (x, z) => -depth * sstep(edge - 0.06, edge + 0.55, x * dir.x + z * dir.y + wob(-x * dir.y + z * dir.x));
    } else {
      // v4.72: the floor is real 3D - sand in ripples, litter and soil in little lumps, flat right under the snake
      const rg = new THREE.RingGeometry(0, groundR, 160, quality === 'low' ? 60 : 110); rg.rotateX(-Math.PI / 2);
      const kind = S.ground, rip = kind === 'sand' || kind === 'gibber' || kind === 'gravel'; // (v4.81: no sand ripples under grass)
      const fineR = kind === 'sand' ? Math.max(Rb * 2.3, Math.min(1.4, Rb * 7)) : 0; // v4.81: real sand ripples close to the snake (finer mesh below)
      // v5.50: ripples and lumps at their real size (a few mm to a cm high, 10-30 cm apart), not scaled to the snake;
      // where the mesh is too coarse to draw them (round a big snake) they are wider but no higher
      const cell = groundR / (quality === 'low' ? 60 : 110), ripL = Math.max(0.1, cell * 6) / TAU, lumpL = Math.max(0.2, cell * 5);
      const pp = rg.attributes.position, w0 = F.w0, ripA = (kind === 'sand' ? 0.006 : 0.003) * Math.min(1, 0.1 / (ripL * TAU)), lumpA = 0.01 * Math.min(1, 0.25 / lumpL);
      for (let i = 0; i < pp.count; i++) {
        const x = pp.getX(i), z = pp.getZ(i), r = Math.hypot(x, z);
        const near = sstep(w0 * 1.5, w0 * 6, r < Rb * 3 ? dist2snake(x, z) : 1e9); // nothing lifts under or right beside the snake
        let y = 0;
        if (rip) { const u = x * 0.8 + z * 0.6 + (fbm(x / 0.8, z / 0.8, 1, seed + 41, 2) - 0.5) * 0.5; y += Math.sin(u / ripL) * ripA * (0.6 + fbm(x / 1.2, z / 1.2, 1, seed + 43, 2) * 0.8); }
        else y += (fbm(x / lumpL, z / lumpL, 1, seed + 47, 3) - 0.5) * 2 * lumpA;
        y *= near;
        if (fineR) y = lerp(-ripA - 0.02, y, sstep(fineR * 0.82, fineR * 1.02, r)); // tucked under the fine sand
        y += rise(x, z, r); // gentle rise to the hills
        pp.setY(i, y);
      }
      rg.computeVertexNormals();
      const edge = canvasTex(256, (x2, s2) => { const g = x2.createRadialGradient(s2 / 2, s2 / 2, s2 * 0.36, s2 / 2, s2 / 2, s2 * 0.5); g.addColorStop(0, '#fff'); g.addColorStop(1, '#000'); x2.fillStyle = g; x2.fillRect(0, 0, s2, s2); }, 1, false);
      edge.dispose(); // (a see-through edge made things behind it look washed out - the hills and the haze hide the edge instead)
      const g2 = new THREE.Mesh(rg, gm); g2.receiveShadow = true; scene.add(g2); ctx.fadeMats.push(gm);
      if (fineR) {
        // wind ripples at their real size (about 8-12 cm apart, a centimetre high): a gentle slope up the windward
        // side and a steep drop on the lee side, crests that wander, fork and fade; smoothed flat under the snake
        const segs = quality === 'low' ? 170 : 280, side = fineR * 2, lam = Math.max(0.085, (side / segs) * 6), A = lam * 0.15;
        const fg = new THREE.PlaneGeometry(side, side, segs, segs); fg.rotateX(-Math.PI / 2);
        const fp = fg.attributes.position, dirA = R() * TAU, ca = Math.cos(dirA), sa = Math.sin(dirA);
        for (let i = 0; i < fp.count; i++) {
          const x = fp.getX(i), z = fp.getZ(i), r = Math.hypot(x, z);
          if (r > fineR * 1.04) { fp.setY(i, -ripA * 2 - A * 2); continue; }
          const along = x * ca + z * sa, across = -x * sa + z * ca;
          const ph = along / lam + (fbm(across / (lam * 9), along / (lam * 14), 3, seed + 61, 2) - 0.5) * 3.2 + (vnoise(x / (lam * 3), z / (lam * 3), 5, seed + 63) - 0.5) * 0.5;
          const f = ph - Math.floor(ph), prof = f < 0.72 ? sstep(0, 0.72, f) : 1 - sstep(0.72, 1, f);
          const amp = A * (0.55 + 0.9 * vnoise(x / (lam * 6), z / (lam * 6), 7, seed + 67)), near = sstep(F.w0 * 0.6, F.w0 * 2.6, dist2snake(x, z));
          fp.setY(i, ((prof - 0.35) * amp * near + A * 0.3) * (1 - sstep(fineR * 0.8, fineR, r)) - (0.02 + ripA) * sstep(fineR * 0.97, fineR * 1.03, r));
        }
        fg.computeVertexNormals();
        const uvs = fg.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, fp.getX(i) / (2 * groundR) + 0.5, 0.5 - fp.getZ(i) / (2 * groundR));
        const fm = new THREE.Mesh(fg, gm); fm.receiveShadow = true; scene.add(fm);
      }
    }
    // nature.js can take over the far scenery (return true) and add its own realistic details
    // v4.81: the far scenery (trees, shrubs, ground cover) is built just after the first picture is shown, so the
    // snake appears without waiting for it; it fades in a moment later
    const runNature = () => {
      if (ctx.scene !== scene) return;
      const tN = performance.now();
      const natureOwnsFar = NATURE.build ? NATURE.build({ THREE, ctx, scene, S, kind: P.scene.kind, groundR, farR, Rb, F, L, seed, quality, gcol, rng, fbm, sstep, clamp, dist2snake, poseInfo, sceneP: P.scene, rise }) : false;
      perfT('nature', tN);
      if (!natureOwnsFar) farScenery(ctx, S, groundR, farR, Rb, seed, gcol, quality, rise);
      if (ctx.afterNature) ctx.afterNature();
    };
    ctx.natureReady = typeof requestAnimationFrame === 'function' ? new Promise((res) => requestAnimationFrame(() => setTimeout(() => { try { runNature(); } finally { res(); } }, 0))) : (runNature(), Promise.resolve());
  }
  if (S.water === 'sea') {
    const wm = new THREE.MeshPhysicalMaterial({ color: '#1f4e63', roughness: 0.12, metalness: 0, transparent: true, opacity: 0.82, normalMap: waterNormal(seed), normalScale: new THREE.Vector2(0.35, 0.35) });
    wm.normalMap.repeat.set(groundR * 2 / 2.4, groundR * 2 / 2.4); // v5.50: ripples at their real size (repeating every 2.4 m)
    const wg = new THREE.RingGeometry(0, groundR, 96, quality === 'low' ? 18 : 40); wg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(wg, wm); water.position.y = poseInfo.seaLevel; water.receiveShadow = true; water.renderOrder = 2; scene.add(water);
    if (NATURE.water) NATURE.water(THREE, water, { swell: 0.006, calmR: Rb * 1.1, drift: 0.035 }); // v5.73: a gentle swell and moving ripples on the sea
    // v5.93: the sea floor shows through the clear water: pale sand about 1.3 m down with heads of coral and rock, blue-green
    // with depth (it used to be one flat dark disc)
    const bedT = groundTexture('sand', seed + 5, quality !== 'low'); bedT.repeat.set((groundR * 2) / 1.0, (groundR * 2) / 1.0);
    const bedM = new THREE.MeshStandardMaterial({ map: bedT, color: '#8f9c8e', roughness: 1, metalness: 0 }); // (tinted blue-green: the water over it takes the red out of the light; v6.26: less - the water above already tints it, and twice over it came out a flat cartoon blue)
    const bedG = new THREE.CircleGeometry(groundR, 64); bedG.rotateX(-Math.PI / 2);
    { const pp = bedG.attributes.position; for (let i = 0; i < pp.count; i++) pp.setY(i, (fbm(pp.getX(i) / 3, pp.getZ(i) / 3, 2, seed + 31, 3) - 0.5) * 0.5 - sstep(groundR * 0.3, groundR, Math.hypot(pp.getX(i), pp.getZ(i))) * 1.5); bedG.computeVertexNormals(); }
    const deep = new THREE.Mesh(bedG, bedM); deep.position.y = -1.7; deep.receiveShadow = true; scene.add(deep);
    // v6.26: the sand's own grain, and the moving net of light the ripples focus onto the bed (caustics), as on the river bed
    if (NATURE.groundDetail) { NATURE.groundDetail(THREE, bedM, 'sand', ctx, { near: 2.5, far: 14 }); if (bedM.userData.caustics) bedM.userData.caustics(water.position.y, 1.3); }
    // (v6.26: real reef colours - pale coral heads, ochre and grey rubble, dark rock with a little green growth - only slightly
    // shaded by the water, and lying flatter: they were all mixed 40% with blue, a scatter of cartoon-blue pebbles)
    const corals = ['#b3a283', '#9c8b6c', '#857659', '#6c6452', '#a89a7c', '#5f5d4c', '#8d8a6a', '#c2b394'], blue = new THREE.Color('#566f68'), cg = [rockGeometry(seed + 41, 3), rockGeometry(seed + 42, 3)], cm = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, color: '#ffffff' });
    const cM = new THREE.Matrix4(), cQ = new THREE.Quaternion(), cE = new THREE.Euler(), cS = new THREE.Vector3(), cP = new THREE.Vector3();
    cg.forEach((g) => { const n = quality === 'low' ? 18 : 40, im = new THREE.InstancedMesh(g, cm, n), cc = new THREE.Color();
      for (let i = 0; i < n; i++) { const a = R() * TAU, r = Math.max(Rb * 1.5, 1) + R() * groundR * 0.4, s = 0.08 + R() ** 2 * 0.3; cE.set(R() * 0.3, R() * TAU, R() * 0.3); cQ.setFromEuler(cE); cS.set(s * (1 + R() * 0.6), s * (0.35 + R() * 0.45), s * (1 + R() * 0.6)); cP.set(Math.cos(a) * r, -1.7 - 0.05 + s * 0.2, Math.sin(a) * r); cM.compose(cP, cQ, cS); im.setMatrixAt(i, cM); im.setColorAt(i, cc.set(corals[(R() * corals.length) | 0]).lerp(blue, 0.12).multiplyScalar(0.85 + R() * 0.25)); }
      im.receiveShadow = true; scene.add(im); });
    if (NATURE.groundDetail) { NATURE.groundDetail(THREE, cm, 'rock', ctx, { tri: true, near: 2.5, far: 14 }); if (cm.userData.caustics) cm.userData.caustics(water.position.y, 1.3); }
    wm.opacity = 0.8; // (v6.26: a little less clear, so the body under the surface reads as under it)
  }

  // props: placed around the snake, never touching it, denser near it and fading out with distance
  const PR = S.props || {};
  // props tall enough to hide the snake are hidden while they stand between the camera and the snake
  const occ = ctx.occ = [];
  const addOcc = (im, i, mtx, r) => { const c = new THREE.Vector3().setFromMatrixPosition(mtx); c.y += r * 0.5; occ.push({ im, i, m: mtx.clone(), c, r, hid: false }); };
  // v4.63: the surroundings reach twice as far (more of the habitat around the snake)
  const place = (n, rMin, rMax, clear, tries = 40) => {
    const out = []; n = Math.round(n * (quality === 'low' ? 1.6 : 2.4)); rMax = rMin + (rMax - rMin) * 2;
    for (let i = 0; i < n; i++) for (let t = 0; t < tries; t++) {
      const a = R() * TAU, r = rMin + (rMax - rMin) * Math.sqrt(R()), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (dist2snake(x, z) < clear) continue;
      if (ctx.waterInfo && PR.reeds == null && x * ctx.waterInfo.dir.x + z * ctx.waterInfo.dir.y > ctx.waterInfo.edge) continue;
      out.push([x, z]); break;
    }
    return out;
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  // v5.50: every prop has its real-world size, whatever the snake's size: fallen leaves 4-11 cm, grass 20-45 cm,
  // pebbles 1-5 cm, rocks 10-60 cm, twigs 12-45 cm, a log 16-34 cm thick, reeds over a metre. Only how far round the
  // snake they are spread follows the snake (the camera sees more ground round a big one), and how many there are
  // follows that area (a real density per square metre), capped so a big snake's wide view stays fast
  const veg = (m, near) => (NATURE.vegetation ? NATURE.vegetation(THREE, m, { near }) : m); // (v5.50: matt, lit the same from every side)
  const lowQ = quality === 'low', perM2 = (dens, rMin, rMax, cap) => { const r1 = rMin + (rMax - rMin) * 2; return Math.round(Math.min(cap * (lowQ ? 0.45 : 1), dens * Math.PI * (r1 * r1 - rMin * rMin) * (lowQ ? 0.6 : 1))); };
  const wiP = ctx.waterInfo, wet = (x, z) => !!wiP && x * wiP.dir.x + z * wiP.dir.y + wiP.wob(-x * wiP.dir.y + z * wiP.dir.x) > wiP.edge - 0.02;
  const placeN = (n, rMin, rMax, clear, o = {}) => { // n real spots (place() above multiplies its count)
    const out = []; rMax = rMin + (rMax - rMin) * 2;
    for (let i = 0; i < n; i++) for (let t = 0; t < (o.tries || 12); t++) {
      const a = R() * TAU, r = rMin + (rMax - rMin) * Math.sqrt(R()), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (dist2snake(x, z) < clear) continue;
      if (o.dry && wet(x, z)) continue;
      out.push([x, z]); break;
    }
    return out;
  };
  if (PR.rocks) {
    // v5.05: only a few rocks, well apart and never crowding round the snake (there used to be dozens)
    // v5.50: 10-60 cm across (smaller right beside a small snake, so none lies over it), clear of the body by their own size
    const rsK = P.scene.rockSize || 1, spots = [];
    for (const sp of place(Math.round(3 + 4 * PR.rocks), Rb * 1.7, Rb * 5, Rb * 0.9 + F.w0 * 4, 60)) {
      if (spots.length >= Math.round(2 + 3 * PR.rocks) || !spots.every((q) => Math.hypot(q[0] - sp[0], q[1] - sp[1]) > Math.max(Rb * 1.6, 0.8))) continue;
      const d = dist2snake(sp[0], sp[1]), s = Math.min((0.05 + R() ** 2.2 * 0.25) * rsK, Math.max(0.03, (d - F.w0 * 3) / 1.5));
      spots.push([sp[0], sp[1], s]);
    }
    const geos = [rockGeometry(seed + 1, 3), rockGeometry(seed + 2, 3), rockGeometry(seed + 3, 2)];
    const rt = canvasTex(256, (x, s) => { const img = x.createImageData(s, s); for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const n = tfbm(i / s * 6, j / s * 6, 6, seed + 9, 4), k = (j * s + i) * 4, v = 120 + n * 110; img.data[k] = v; img.data[k + 1] = v * 0.96; img.data[k + 2] = v * 0.9; img.data[k + 3] = 255; } x.putImageData(img, 0, 0); }, 2);
    const rm = new THREE.MeshStandardMaterial({ map: rt, roughness: 0.92, color: P.scene.rock || S.rock || (S.ground === 'pebbles' ? '#7a7368' : '#b4aa9c') });
    geos.forEach((g, gi) => {
      const mine = spots.filter((_, i) => i % 3 === gi); if (!mine.length) return;
      const im = new THREE.InstancedMesh(g, rm, mine.length); im.castShadow = im.receiveShadow = true;
      mine.forEach(([x, z, s], i) => { e.set(R() * 0.3, R() * TAU, R() * 0.3); q.setFromEuler(e); sv.set(s * (0.8 + R() * 0.5), s * (0.9 + R() * 0.4), s * (0.8 + R() * 0.5)); pv.set(x, groundH(x, z) + s * 0.12, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); addOcc(im, i, m4, s * 1.2); });
      scene.add(im);
    });
  }
  if (PR.pebbles) {
    const n = perM2(70 * PR.pebbles, Rb * 0.5, Rb * 4, 1600), spots = placeN(n, Rb * 0.5, Rb * 4, F.w0 * 1.5 + 0.035), g = rockGeometry(seed + 7, 1); // (small: 80 triangles each is plenty)
    const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.8, color: '#ffffff' }), spots.length); im.castShadow = im.receiveShadow = true;
    const pc = new THREE.Color();
    // and a few cobbles, 10-25 cm, scattered further out (real size: round a giant they read as small stones)
    const cob = placeN(perM2(0.8 * PR.pebbles, Rb * 1.2, Rb * 4, 260), Rb * 1.2, Rb * 4, F.w0 * 3 + 0.15, { dry: true }), cg = rockGeometry(seed + 8, lowQ ? 1 : 2);
    if (cob.length) { const ci = new THREE.InstancedMesh(cg, im.material, cob.length); ci.castShadow = ci.receiveShadow = true; cob.forEach(([x, z], i) => { const s = Math.min(0.05 + R() ** 2 * 0.075, Math.max(0.02, (dist2snake(x, z) - F.w0 * 3) / 1.5)); e.set((R() - 0.5) * 0.3, R() * TAU, (R() - 0.5) * 0.3); q.setFromEuler(e); sv.set(s * 1.25, s * (0.8 + R() * 0.3), s); pv.set(x, groundH(x, z) + s * 0.1, z); m4.compose(pv, q, sv); ci.setMatrixAt(i, m4); pc.setHSL(0.08 + R() * 0.05, 0.05 + R() * 0.07, 0.14 + R() * 0.12); ci.setColorAt(i, pc); }); scene.add(ci); }
    spots.forEach(([x, z], i) => { const s = 0.005 + R() ** 2 * 0.014; e.set((R() - 0.5) * 0.3, R() * TAU, (R() - 0.5) * 0.3); q.setFromEuler(e); sv.set(s * 1.25, s * (0.85 + R() * 0.35), s); pv.set(x, groundH(x, z) + s * 0.12, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); pc.setHSL(0.08 + R() * 0.05, 0.06 + R() * 0.08, 0.12 + R() * 0.14); /* linear: mid-grey river stones, not white */ im.setColorAt(i, pc); });
    scene.add(im);
  }
  // a clump of grass (or ferns, heather): real height; tall plants keep back from the snake, and the ones nearest it
  // are shorter (trodden, grazed), so a small snake lies in a little clearing in grass that towers over it, in view
  const grassTuft = (n, h, cA, cB, rMin, rMax, clear, spread, o = {}) => {
    const spots = placeN(n, rMin, rMax, clear, { dry: true }); if (!spots.length) return;
    const g = bladeTuft(seed + n, o.blades || 14, h, cA, cB, spread || h * 0.12, o), im = new THREE.InstancedMesh(g, veg(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: o.rough || 0.9 }), true), spots.length);
    im.castShadow = true; im.receiveShadow = true;
    spots.forEach(([x, z], i) => { const k = 0.4 + 0.6 * sstep(clear, clear + h * 2.5, dist2snake(x, z)), s = (0.7 + R() * 0.6) * k; e.set(0, R() * TAU, 0); q.setFromEuler(e); sv.set(s, s * (o.sy ? o.sy[0] + R() * (o.sy[1] - o.sy[0]) : 1), s); pv.set(x, groundH(x, z), z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); }); // (v6.00: grass is never hidden by where the camera stands - it popped in and out as you went round)
    scene.add(im);
  };
  if (PR.grass) { const h = 0.3 * (P.scene.grassH || 1); grassTuft(perM2(5 * PR.grass, Rb * 0.8, Rb * 4.5, 700), h, P.scene.grassA || '#6f7a3a', P.scene.grassB || '#c2b47a', Rb * 0.8, Rb * 4.5, F.w0 * 3 + h * 0.7); }
  if (PR.reeds && ctx.waterInfo) {
    // reeds and rushes along the water's edge, behind the snake: 0.8-1.6 m tall
    const spots = [], wi = ctx.waterInfo, tng = new THREE.Vector2(-wi.dir.y, wi.dir.x), span = Math.max(Rb * 14, 6), hR = 1.1, nR = clamp(Math.round(span / 0.35), 52, lowQ ? 90 : 220);
    for (let i = 0; i < nR; i++) { const s = (R() - 0.5) * span, off = wi.edge + 0.1 + R() * Math.max(Rb * 0.9, 0.9); const x = wi.dir.x * off + tng.x * s, z = wi.dir.y * off + tng.y * s; if (dist2snake(x, z) > Math.max(Rb * 0.5, hR * 0.5)) spots.push([x, z]); }
    const g = bladeTuft(seed + 3, lowQ ? 26 : 40, hR, '#55693a', '#a6a46a', 0.06, { w: 0.01, lean: 0.25 }), im = new THREE.InstancedMesh(g, veg(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 })), spots.length);
    im.castShadow = false; // (v5.50: the long shadows of the thin blades lay across the bank and the snake as dark streaks)
    spots.forEach(([x, z], i) => { const s = 0.7 + R() * 0.6; e.set(0, R() * TAU, 0); q.setFromEuler(e); sv.set(s, s, s); pv.set(x, groundH(x, z) - 0.02, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); addOcc(im, i, m4, hR * s * 0.7); });
    scene.add(im);
  }
  if (PR.heather) { const hh = 0.28; grassTuft(perM2(4 * PR.heather, Rb * 0.9, Rb * 4.2, 160), hh, '#4f5a33', '#6f6a45', Rb * 0.9, Rb * 4.2, F.w0 * 4 + hh * 0.6, hh * 0.55, { blades: lowQ ? 90 : 160, lean: 0.8, w: 0.012, tip: '#9a6f8c', green: '#5f7036', rough: 0.95, sy: [0.7, 1.2] }); } // v4.80: living heather green with purple tips, not black
  if (PR.leaves || PR.drift) {
    const drift = !!PR.drift, n = drift ? Math.round(60 * PR.drift * (lowQ ? 0.6 : 1)) : perM2(70 * PR.leaves, Rb * 0.25, Rb * 4.5, 3500);
    const spots = drift ? [] : placeN(n, Rb * 0.25, Rb * 4.5, F.w0 * 1.2, { tries: 6, dry: true });
    if (drift) { const ang = R() * TAU, dx = Math.cos(ang), dz = Math.sin(ang), off = Math.max(Rb * 1.4, 0.3); for (let i = 0; i < n; i++) { const s = (R() - 0.5) * Math.max(Rb * 8, 2), w = (R() - 0.5) * Math.max(Rb * 0.5, 0.15); spots.push([-dz * off + dx * s + -dz * w, dx * off + dz * s + dx * w]); } }
    const lt = canvasTex(128, (x, s) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, s, s); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, s / 2); x.lineTo(s, s / 2); x.stroke(); x.lineWidth = 1; for (let i = 1; i < 7; i++) { x.beginPath(); x.moveTo(i * s / 7, s / 2); x.lineTo(i * s / 7 + 12, s / 2 - 22); x.moveTo(i * s / 7, s / 2); x.lineTo(i * s / 7 + 12, s / 2 + 22); x.stroke(); } });
    const lg = leafGeometry(), lm = new THREE.MeshStandardMaterial({ map: lt, side: THREE.DoubleSide, roughness: 0.85 });
    const im = new THREE.InstancedMesh(lg, lm, spots.length); im.castShadow = !drift; im.receiveShadow = true;
    const lc = new THREE.Color(), lsize = drift ? 0.04 : 0.075 * (P.scene.leafSize || S.leafSize || 1); // v5.50: real leaves, 4-11 cm (bits of weed on the sea, about 4 cm)
    const pal = drift ? ['#5d4a2a', '#6b5a32', '#4a5a2a', '#7a6a3a'] : (P.scene.leafCols || S.leafCols || ['#7a5532', '#94683a', '#a8804a', '#5e4128', '#6f4f2c', '#b08850', '#4f3a22']);
    spots.forEach(([x, z], i) => { const s = lsize * (0.6 + R() * 0.8); e.set((R() - 0.5) * 0.4, R() * TAU, (R() - 0.5) * 0.4); q.setFromEuler(e); sv.set(s, s * (0.6 + R() * 0.8), s * (0.45 + R() * 0.3)); pv.set(x, drift ? poseInfo.seaLevel + 0.002 : groundH(x, z) + s * 0.02, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); lc.set(pal[(R() * pal.length) | 0]); im.setColorAt(i, lc); });
    scene.add(im);
  }
  if (PR.twigs || PR.log) {
    const bark = canvasTex(256, (x, s) => { x.fillStyle = '#5a4632'; x.fillRect(0, 0, s, s); for (let i = 0; i < 300; i++) { x.strokeStyle = ['#3a2c1e', '#6f5a40', '#4a3a28', '#7d6a50'][(R() * 4) | 0]; x.lineWidth = 1 + R() * 3; const y = R() * s; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(s * 0.3, y + (R() - 0.5) * 20, s * 0.6, y + (R() - 0.5) * 20, s, y); x.stroke(); } });
    const bm = new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95 });
    // twigs 12-45 cm long and about a centimetre thick, one instanced mesh; never across the snake
    const spots = placeN(perM2(2.5 * (PR.twigs || 0), Rb * 0.6, Rb * 4, 260), Rb * 0.6, Rb * 4, F.w0 * 3, { dry: true }), tw = [];
    spots.forEach(([x, z]) => { const len = 0.12 + R() * 0.33, rad = 0.003 + len * 0.012, ry = R() * TAU, cx = Math.cos(ry) * len / 2, cz = -Math.sin(ry) * len / 2; for (let k = -4; k <= 4; k++) if (dist2snake(x + cx * k / 4, z + cz * k / 4) < F.w0 * 1.5 + rad * 2) return; /* v5.25: no twig across the snake */ tw.push([x, z, len, rad, ry]); });
    if (tw.length) {
      const g = new THREE.CylinderGeometry(0.6, 1, 1, 7, 1); g.rotateZ(Math.PI / 2); const im = new THREE.InstancedMesh(g, bm, tw.length); im.castShadow = im.receiveShadow = true;
      tw.forEach(([x, z, len, rad, ry], i) => { e.set(0, ry, (R() - 0.5) * 0.08); q.setFromEuler(e); sv.set(len, rad, rad); pv.set(x, groundH(x, z) + rad, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); });
      scene.add(im);
    }
    if (PR.log) {
      // one fallen log at a safe distance behind the snake: 1.2-2.4 m long, 16-34 cm thick
      const len = 1.2 + R() * 1.2, rad = 0.08 + R() * 0.09;
      const g = new THREE.CylinderGeometry(rad * 0.92, rad, len, 18, 6, false), pp = g.attributes.position;
      for (let i = 0; i < pp.count; i++) { const y = pp.getY(i), a = Math.atan2(pp.getZ(i), pp.getX(i)), k = 1 + (vnoise(a * 2, y / len * 6, 1, seed) - 0.5) * 0.18; pp.setX(i, pp.getX(i) * k); pp.setZ(i, pp.getZ(i) * k); }
      g.computeVertexNormals(); g.rotateZ(Math.PI / 2);
      for (let t = 0; t < 80; t++) {
        const a = R() * TAU, r = Math.max(Rb * (1.15 + R() * 0.8), rad * 3 + F.w0 * 4 + R() * len * 0.4), x = Math.cos(a) * r, z = Math.sin(a) * r; const ry = R() * TAU, dx = Math.cos(ry) * len / 2, dz = -Math.sin(ry) * len / 2;
        let bad = false; for (let k = -6; k <= 6 && !bad; k++) bad = dist2snake(x + dx * k / 6, z + dz * k / 6) < rad * 2.2 + F.w0 * 3 || wet(x + dx * k / 6, z + dz * k / 6); if (bad) continue;
        // (v5.50: the bark's grain runs along the log, at its real scale, not in rings round it)
        const lt = bark.clone(); lt.wrapS = lt.wrapT = THREE.RepeatWrapping; lt.center.set(0.5, 0.5); lt.rotation = Math.PI / 2; lt.repeat.set(len / 0.5, 2); lt.needsUpdate = true;
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: lt, roughness: 0.95, color: '#ffffff' })); m.position.set(x, groundH(x, z) + rad * 0.85, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; scene.add(m); occ.push({ mesh: m, c: m.position.clone(), r: Math.max(rad * 2, len * 0.35), hid: false }); break;
      }
    }
  }
  if (PR.ferns) { const hF = 0.45; grassTuft(perM2(2.5, Rb * 1.4, Rb * 4, 120), hF, '#3f6a2c', '#7a9a48', Rb * 1.4, Rb * 4, F.w0 * 3 + hF * 0.6, 0.03); }
  if (PR.crumbs) {
    // crumbs of soil and grit, 2-10 mm (v6.26: many more, moist and dry, so the soil has a real crumbly surface round the snake)
    const spots = placeN(perM2(PR.clods ? 1400 : 250, Rb * 0.2, Rb * 3, PR.clods ? 5000 : 2000), Rb * 0.2, Rb * 3, F.w0 * 1.2, { tries: 8 }), g = rockGeometry(seed + 4, lowQ ? 0 : 1);
    const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), spots.length); im.castShadow = im.receiveShadow = true; const cc = new THREE.Color();
    spots.forEach(([x, z], i) => { const s = 0.001 + R() ** 2 * (PR.clods ? 0.006 : 0.004); e.set(R() * 0.5, R() * TAU, R() * 0.5); q.setFromEuler(e); sv.set(s, s * 0.7, s); pv.set(x, groundH(x, z) + s * 0.1, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); im.setColorAt(i, cc.setHSL(0.07 + R() * 0.03, 0.22 + R() * 0.15, 0.06 + R() ** 1.5 * 0.13)); });
    scene.add(im);
  }
  if (PR.clods) {
    // v6.26: clods and lumps of earth, 1-3 cm, half sunk in the soil
    const spots = placeN(perM2(90 * PR.clods, Rb * 0.5, Rb * 3, 400), Rb * 0.5, Rb * 3, F.w0 * 2 + 0.01, { tries: 8 }), g = rockGeometry(seed + 14, lowQ ? 1 : 2);
    const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), spots.length); im.castShadow = im.receiveShadow = true; const cc = new THREE.Color();
    spots.forEach(([x, z], i) => { const s = Math.min(0.005 + R() ** 2 * 0.012, Math.max(0.003, (dist2snake(x, z) - F.w0 * 1.5) * 0.5)); e.set(R() * 0.6, R() * TAU, R() * 0.6); q.setFromEuler(e); sv.set(s * (0.9 + R() * 0.5), s * (0.5 + R() * 0.3), s); pv.set(x, groundH(x, z) - s * 0.15, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); im.setColorAt(i, cc.setHSL(0.07 + R() * 0.02, 0.25 + R() * 0.1, 0.05 + R() * 0.07)); });
    scene.add(im);
  }
  if (PR.roots) {
    // v6.26: fine roots and rootlets, 1-3 mm thick, running along the surface and dipping into it
    const nV = 4, gs = [];
    for (let v = 0; v < nV; v++) { const pts = [], len = 1, n = 7; let a = 0, y = -0.01; for (let k = 0; k <= n; k++) { a += (R() - 0.5) * 0.9; y = k === 0 || k === n ? -0.02 : Math.max(-0.02, Math.min(0.012, y + (R() - 0.45) * 0.02)); pts.push(new THREE.Vector3((k / n - 0.5) * len, y, Math.sin(a) * 0.08)); }
      gs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0035, 5, false)); }
    const g = mergeGeos(gs), spots = placeN(perM2(14 * PR.roots, Rb * 0.4, Rb * 3, 120), Rb * 0.4, Rb * 3, F.w0 * 2.5, { tries: 10 });
    const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), spots.length); im.castShadow = im.receiveShadow = true; const cc = new THREE.Color();
    spots.forEach(([x, z], i) => { const L = 0.05 + R() * 0.14, ry = R() * TAU, cx = Math.cos(ry) * L / 2, cz = -Math.sin(ry) * L / 2; let ok = true; for (let k = -4; k <= 4 && ok; k++) ok = dist2snake(x + cx * k / 4, z + cz * k / 4) > F.w0 * 1.6 + 0.004; const t = 0.4 + R() * 0.8;
      e.set(0, ry, 0); q.setFromEuler(e); sv.set(ok ? L : 1e-5, t * 0.3 + 0.3, t * 0.5); pv.set(x, groundH(x, z), z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); im.setColorAt(i, cc.setHSL(0.08 + R() * 0.03, 0.25 + R() * 0.15, 0.18 + R() * 0.16)); });
    scene.add(im);
  }
  if (PR.moss) {
    // v6.26: small soft cushions of moss, 2-8 cm, a little way from the snake
    const spots = placeN(perM2(10 * PR.moss, Rb * 1.2, Rb * 3.5, 60), Rb * 1.2, Rb * 3.5, F.w0 * 4 + 0.03, { tries: 10 }), g = rockGeometry(seed + 24, lowQ ? 1 : 2);
    const im = new THREE.InstancedMesh(g, veg(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), true), spots.length); im.receiveShadow = true; const cc = new THREE.Color();
    spots.forEach(([x, z], i) => { const s = 0.006 + R() * 0.016; e.set(0, R() * TAU, 0); q.setFromEuler(e); sv.set(s * (1 + R() * 0.6), s * 0.35, s); pv.set(x, groundH(x, z) - s * 0.08, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); im.setColorAt(i, cc.setHSL(0.21 + R() * 0.05, 0.3 + R() * 0.15, 0.04 + R() * 0.04)); });
    scene.add(im);
  }
  if (PR.stone) {
    // v6.26: the flat stone it was found under, 15-30 cm across, lying close by on the soil, its edge a few body widths off
    const g = rockGeometry(seed + 33, lowQ ? 2 : 3), m = new THREE.MeshStandardMaterial({ color: '#5e564d', roughness: 0.93, map: canvasTex(128, (x, S) => { const img = x.createImageData(S, S); for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const v = 150 + (tfbm(i / S * 8, j / S * 8, 8, seed + 33, 4) - 0.5) * 160, k = (j * S + i) * 4; img.data[k] = v; img.data[k + 1] = v * 0.97; img.data[k + 2] = v * 0.92; img.data[k + 3] = 255; } x.putImageData(img, 0, 0); }, 2) });
    for (let t = 0; t < 60; t++) {
      const s = clamp(Math.max(Rb * 0.9, 0.08), 0.08, 0.16) * (0.85 + R() * 0.3), a = R() * TAU, r = Rb * 1.1 + s * 1.2 + R() * Rb * 0.6, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (dist2snake(x, z) < s * 1.15 + F.w0 * 4) continue;
      const st = new THREE.Mesh(g, m); st.scale.set(s * 1.25, s * 0.26, s); st.rotation.set((R() - 0.5) * 0.12, R() * TAU, (R() - 0.5) * 0.12); st.position.set(x, groundH(x, z) + s * 0.05, z); st.castShadow = st.receiveShadow = true; scene.add(st);
      occ.push({ mesh: st, c: st.position.clone(), r: s * 1.2, hid: false }); break;
    }
  }
}
// swap the stand-in gradient sky for the panorama: image-based light, a grounded photo background,
// v5.90: where the sun stands round the snake (az: three.js angle in the ground plane, el: height), kept 40-60 degrees up
const SUN_SIDE = 0.85, SUN_EL = [(40 * Math.PI) / 180, (60 * Math.PI) / 180];
function placeSun(ctx, az, el) {
  const sun = ctx.sun; if (!sun) return; const r = sun.position.length(), e = clamp(el, SUN_EL[0], SUN_EL[1]);
  sun.position.set(Math.cos(e) * Math.cos(az), Math.sin(e), Math.cos(e) * Math.sin(az)).multiplyScalar(r);
}
// the panorama turned round the vertical by da radians (whole columns), so its bright sky sits where the sun now is
function turnEnv(env, da) {
  const w = env.w, h = env.h, sh = ((Math.round((da / TAU) * w) % w) + w) % w; if (!sh) return env.half;
  const out = new Uint16Array(env.half.length), row = w * 4;
  for (let y = 0; y < h; y++) { const o = y * row; out.set(env.half.subarray(o, o + (w - sh) * 4), o + sh * 4); out.set(env.half.subarray(o + (w - sh) * 4, o + row), o); }
  return out;
}
// the sun where the photo has it, and the near ground fading into the photo's ground
function applyEnv(ctx, P, F, poseInfo, env) {
  const { scene, renderer } = ctx, S = sceneOf(P.scene), sea = S.water === 'sea';
  if (!env.half) { env.half = new Uint16Array(env.data.length); for (let i = 0; i < env.data.length; i++) env.half[i] = THREE.DataUtils.toHalfFloat(env.data[i]); }
  const envAz = Math.atan2(env.sunDir.z, env.sunDir.x), sunAz = ctx.sunAz != null ? ctx.sunAz : envAz;
  const tex = new THREE.DataTexture(turnEnv(env, sunAz - envAz), env.w, env.h, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true; ctx.track(tex);
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromEquirectangular(tex); pm.dispose(); ctx.track(rt);
  if (ctx.envRT) ctx.envRT.dispose();
  scene.environment = rt.texture;
  // v4.72: the panorama only lights the scene (reflections, sun direction and colour); what you see all round
  // is the 3D world built in buildScene - sky dome, rolling ground, trees or rocks - not a photo backdrop
  // light: the sun from the photo, sky light from the panorama; the gradient hemisphere light stays only as a faint fill
  const sun = ctx.sun; placeSun(ctx, sunAz, Math.asin(env.sunDir.y)); // (v5.90: high and to the side of the view, see SUN_SIDE)
  sun.color.copy(env.sunCol).lerp(new THREE.Color('#ffffff'), 0.35); sun.intensity = 6.5 * env.sunny; // about three times the sky's light on a sunlit face, as outdoors
  sun.shadow.radius = lerp(8, 3, env.sunny); sun.shadow.blurSamples = 16;
  if (ctx.skinLight) { // v5.88: the snake's own fill and bounce (SKIN_LIGHT_GLSL), from this panorama's light
    const L = ctx.skinLight, w = new THREE.Color('#fbf6ee');
    L.uFill.value.copy(w).lerp(env.horizon.clone().multiplyScalar(1 / Math.max(0.05, Math.max(env.horizon.r, env.horizon.g, env.horizon.b))), 0.25).multiplyScalar(0.08 + 0.06 * env.sunny); // (v6.26: lower again - the shading between scales and the contact shading now keep dark snakes readable, and this flat fill washed every colour out to a pastel) (v5.90: about half - with the sun now at the photographer's shoulder the extra fill flattened and paled every skin: a mid-brown boa came out cream)
    L.uBounce.value.copy(ctx.hemi ? ctx.hemi.groundColor : w).lerp(w, 0.3).multiplyScalar(0.24 * env.sunny);
  }
  if (ctx.hemi) ctx.hemi.intensity *= 0.4; // (v5.58: a little more fill, so the shaded side of a dark snake keeps its scales and colour)
  ctx.envName = env.name;
  if (ctx.paintSky) ctx.paintSky(); // (the glow follows the sun)
}

// v4.72: the 3D land all round: a ring of rolling hills out to farR, with trees (forest, grass, heath, riverbank)
// or boulders (desert, sand, gibber) standing on it; the fog melts it into the sky
function farScenery(ctx, S, groundR, farR, Rb, seed, gcol, quality, rise) {
  const { scene } = ctx, R = rng(seed + 991), low = quality === 'low';
  const r0 = groundR * 0.92, hillA = farR * 0.06;
  const hillH = (x, z) => { const r = Math.hypot(x, z); return (fbm(x / (farR * 0.18), z / (farR * 0.18), 1, seed + 71, 4) - 0.3) * hillA * sstep(r0, r0 + farR * 0.25, r) + (rise ? rise(x, z, r) : 0); }; // the same gentle rise as the near ground, so they meet without a step
  const ring = new THREE.RingGeometry(r0, farR, 128, low ? 24 : 40); ring.rotateX(-Math.PI / 2);
  const pp = ring.attributes.position, cols = [], base = gcol.clone(), tint = new THREE.Color(S.fog);
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i), y = hillH(x, z); pp.setY(i, y - Rb * 0.05);
    const c = base.clone().lerp(tint, 0.15 + 0.25 * fbm(x / farR * 6, z / farR * 6, 1, seed + 77, 2)); cols.push(c.r, c.g, c.b); }
  ring.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); ring.computeVertexNormals();
  const land = new THREE.Mesh(ring, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); land.receiveShadow = true; scene.add(land);
  const leafy = { litter: 1, soil: 1, pebbles: 0.6, heath: 0.3, dry: 0.35 }[S.ground] || 0; // trees where trees grow; bare land gets boulders
  const tall = 10; // v5.50: trees about 6-14 m tall, whatever the snake's size
  const put = (geo, mat, n, rMin, rMax, size) => {
    if (n <= 0) return; const im = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sv = new THREE.Vector3();
    for (let i = 0; i < n; i++) { const a = R() * TAU, r = rMin + (rMax - rMin) * Math.sqrt(R()), x = Math.cos(a) * r, z = Math.sin(a) * r, k = size * (0.6 + R() * 0.8);
      q.setFromEuler(e.set((R() - 0.5) * 0.08, R() * TAU, (R() - 0.5) * 0.08)); v.set(x, hillH(x, z) - k * 0.05, z); sv.set(k, k * (0.8 + R() * 0.5), k); m4.compose(v, q, sv); im.setMatrixAt(i, m4); }
    im.instanceMatrix.needsUpdate = true; im.castShadow = false; im.receiveShadow = true; scene.add(im); ctx.track && ctx.track(geo);
  };
  if (leafy > 0) {
    const pine = S.ground === 'heath' || S.ground === 'pebbles', parts = [];
    const add = (g, col) => { const c = new THREE.Color(col), n = g.attributes.position.count, a = []; for (let i = 0; i < n; i++) a.push(c.r, c.g, c.b); g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); parts.push(g.toNonIndexed ? g.toNonIndexed() : g); };
    add(new THREE.CylinderGeometry(0.035, 0.05, 0.45, 12).translate(0, 0.225, 0), '#5a4330');
    if (pine) { add(new THREE.ConeGeometry(0.3, 0.55, 18).translate(0, 0.55, 0), '#3d5a36'); add(new THREE.ConeGeometry(0.22, 0.45, 18).translate(0, 0.85, 0), '#46663c'); }
    else { add(new THREE.IcosahedronGeometry(0.32, 3).scale(1, 0.85, 1).translate(0, 0.72, 0), S.ground === 'dry' ? '#7a8a4a' : '#4c6a3a'); add(new THREE.IcosahedronGeometry(0.22, 3).translate(0.16, 0.92, 0.05), S.ground === 'dry' ? '#8a9a55' : '#58783f'); }
    let n = 0; for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
    for (const g of parts) { pos.set(g.attributes.position.array, o); col.set(g.attributes.color.array, o); o += g.attributes.position.array.length; }
    const tree = new THREE.BufferGeometry(); tree.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tree.setAttribute('color', new THREE.BufferAttribute(col, 3)); tree.computeVertexNormals();
    put(tree, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), Math.round((low ? 90 : 180) * leafy), groundR * 1.1, farR * 0.92, tall);
  } else {
    const rock = new THREE.IcosahedronGeometry(1, 3), rp = rock.attributes.position; for (let i = 0; i < rp.count; i++) { const x0 = rp.getX(i), y0 = rp.getY(i), z0 = rp.getZ(i), f = 0.8 + fbm(x0 * 1.7, y0 * 1.7, z0 * 1.7, seed + 13, 3) * 0.45; rp.setXYZ(i, x0 * f, y0 * f * 0.6, z0 * f); } rock.computeVertexNormals(); // smooth, weathered boulders
    put(rock, new THREE.MeshStandardMaterial({ color: gcol.clone().multiplyScalar(0.8), roughness: 0.93 }), low ? 40 : 80, groundR * 1.1, farR * 0.9, 1.2);
  }
}

function mergeGeos(list) {
  let n = 0; for (const g of list) n += g.index ? g.index.count : g.attributes.position.count;
  const pos = new Float32Array(n * 3); let o = 0;
  for (const g of list) { const ng = g.index ? g.toNonIndexed() : g; pos.set(ng.attributes.position.array, o); o += ng.attributes.position.array.length; if (ng !== g) ng.dispose(); g.dispose(); }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.computeVertexNormals(); return m;
}

// a soft dark contact patch under the body, so it sits on the ground rather than floating
function contactShadow(poseInfo, F, Rb) {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d');
  const ext = Rb * 1.25, toPx = (v) => ((v + ext) / (2 * ext)) * S;
  x.lineCap = 'round'; x.lineJoin = 'round';
  // (v6.26: two narrow, darker passes first - the tight dark line right where the belly touches the ground, which the soft
  // wide shadow alone lacked, so the body seemed to hover a hair above it)
  for (let pass = -2; pass < 5; pass++) {
    x.strokeStyle = `rgba(0,0,0,${pass < 0 ? 0.16 : 0.13 - pass * 0.02})`;
    for (let i = 0; i < poseInfo.pts.length - 4; i += 4) {
      const xx = i * poseInfo.ds, lift = poseInfo.Ly(xx); if (lift > F.Hh(xx) * (pass < 0 ? 0.25 : 0.8)) continue;
      const a = poseInfo.pts[i], b = poseInfo.pts[i + 4];
      x.lineWidth = Math.max(1, (F.W(xx) * 2 * (pass < 0 ? 0.55 + (pass + 2) * 0.15 : 0.9 + pass * 0.16)) / (2 * ext) * S);
      // canvas rows run toward -z once the plane is laid flat
      x.beginPath(); x.moveTo(toPx(a[0]), toPx(-a[1])); x.lineTo(toPx(b[0]), toPx(-b[1])); x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ext * 2, ext * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.8, color: '#ffffff' }));
  t.flipY = false; m.position.y = Math.max(1e-4, F.L * 0.0006); m.renderOrder = 1;
  return m;
}

// ---------- camera control: bounded orbit, limited zoom, no panning ----------
function Controls(dom, cam, opt) {
  // v4.72: px/pz = how far you have flown from the snake (sideways, along the ground), never further than panMax
  const st = { az: 0, el: 0.5, d: 1, vaz: 0, vel: 0, px: 0, pz: 0, vpx: 0, vpz: 0, goal: null, dragging: false };
  // v5.74: an eased glide (ease-in-out, about a second) for the big camera moves (Size vs person and back, the camera
  // buttons, Reset); any drag, pinch, wheel or key takes over at once
  let tw = null;
  const user = () => { tw = null; if (opt.user) opt.user(); };
  const ptrs = new Map(); let pinch0 = 0, d0 = 0, last = null, panBtn = false, mid0 = null;
  const locked = () => !!(opt.locked && opt.locked()); // v4.81: while a show runs, the camera moves by itself
  const held = new Set(); let kv = [0, 0], lastU = 0; // v4.81: W A S D held down glide smoothly
  const panMax = () => (opt.panMax ? opt.panMax() : 0);
  function clampPan() { const m = panMax(), l = Math.hypot(st.px, st.pz); if (l > m && l > 0) { st.px *= m / l; st.pz *= m / l; } }
  // move along the ground: dx to the right of the view, dy away from you (screen pixels)
  function pan(dx, dy) {
    const k = st.d * 0.0021, ca = Math.cos(st.az), sa = Math.sin(st.az);
    const mx = -dx * k * ca - dy * k * sa, mz = dx * k * sa - dy * k * ca;
    st.px += mx; st.pz += mz; clampPan(); return [mx, mz];
  }
  const reduce = opt.reduce;
  const limitEl = (el, d) => clamp(el, opt.minEl(d), opt.maxEl);
  function setGoal(g, instant) { tw = null; if (g.az != null) g = Object.assign({}, g, { az: st.az + Math.atan2(Math.sin(g.az - st.az), Math.cos(g.az - st.az)) }); // always the short way round
    st.goal = { az: g.az != null ? g.az : st.az, el: g.el != null ? g.el : st.el, d: g.d != null ? clamp(g.d, opt.dMin(), opt.dMax()) : st.d, px: g.px != null ? g.px : st.px, pz: g.pz != null ? g.pz : st.pz }; if (instant || reduce()) { st.az = st.goal.az; st.d = st.goal.d; st.el = limitEl(st.goal.el, st.d); st.px = st.goal.px; st.pz = st.goal.pz; st.goal = null; } opt.kick(); }
  function rot(dx, dy) { st.az -= dx; st.el = limitEl(st.el + dy, st.d); st.goal = null; }
  function zoom(f) { const d = clamp((st.goal ? st.goal.d : st.d) * f, opt.dMin(), opt.dMax()); setGoal({ d, az: st.goal ? st.goal.az : st.az, el: st.goal ? st.goal.el : st.el }); }
  const onDown = (e) => { if (e.button === 1 || e.button > 2 || locked()) return; user(); panBtn = e.button === 2 || e.shiftKey || e.ctrlKey; try { dom.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already released pointer */ } ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); d0 = st.d; mid0 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; } st.dragging = true; st.vaz = st.vel = st.vpx = st.vpz = 0; last = performance.now(); st.goal = null; };
  const onCtx = (e) => e.preventDefault();
  const onMove = (e) => {
    if (!ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    const now = performance.now(), dt = Math.max(8, now - last);
    if (ptrs.size === 1 && panBtn) { const m = pan(dx, dy); last = now; st.vpx = m[0] / dt * 16; st.vpz = m[1] / dt * 16; opt.kick(); }
    else if (ptrs.size === 1) { const k = (2.6 * Math.PI) / Math.max(400, dom.clientWidth * 1.6); rot(dx * k * 1.5, dy * k * 0.6); last = now; st.vaz = (-dx * k * 1.5) / dt * 16; st.vel = (dy * k * 0.6) / dt * 16; opt.kick(); }
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], pd = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0 > 0) { const nd = clamp(d0 * (pinch0 / pd), opt.dMin(), opt.dMax()), f = nd / Math.max(1e-9, st.d); if (!(opt.pointZoom && opt.pointZoom((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, f, true))) st.d = nd; st.el = limitEl(st.el, st.d); }
      // two fingers moving together fly you along the ground
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (mid0) { const m = pan(mid[0] - mid0[0], mid[1] - mid0[1]); last = now; st.vpx = m[0] / dt * 16; st.vpz = m[1] / dt * 16; } mid0 = mid; opt.kick(); }
  };
  const onUp = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) { pinch0 = 0; mid0 = null; } if (!ptrs.size) { st.dragging = false; panBtn = false; if (reduce() || performance.now() - last > 80) { st.vaz = st.vel = st.vpx = st.vpz = 0; } opt.kick(); } };
  const onWheel = (e) => { e.preventDefault(); if (locked()) return; user(); const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1), f = Math.exp(clamp(dy, -120, 120) * 0.0016); /* (v5.78: line and page scrolling (Firefox) zoom as much as pixel scrolling) */ if (!(opt.pointZoom && opt.pointZoom(e.clientX, e.clientY, f))) zoom(f); }; // v5.12: towards the point under the pointer
  const onKey = (e) => {
    const k = e.key, s = 0.17;
    if (locked()) return;
    if (/^(Arrow(Left|Right|Up|Down)|[-+=_wasdWASD]|Add|Subtract)$/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey) user();
    if (k === 'ArrowLeft') setGoal({ az: (st.goal ? st.goal.az : st.az) + s });
    else if (k === 'ArrowRight') setGoal({ az: (st.goal ? st.goal.az : st.az) - s });
    else if (k === 'ArrowUp') setGoal({ el: limitEl((st.goal ? st.goal.el : st.el) + s, st.d) });
    else if (k === 'ArrowDown') setGoal({ el: limitEl((st.goal ? st.goal.el : st.el) - s, st.d) });
    else if (k === '+' || k === '=' || k === 'Add') zoom(0.82);
    else if (k === '-' || k === '_' || k === 'Subtract') zoom(1.22);
    else if (k === 'r' || k === 'R') opt.reset();
    // W A S D: W moves towards where you look (along the ground), S back, A and D sideways - smoothly while held
    else if (k === 'w' || k === 'W' || k === 's' || k === 'S' || k === 'a' || k === 'A' || k === 'd' || k === 'D') {
      if (e.ctrlKey || e.metaKey || e.altKey) return; held.add(k.toLowerCase()); lastU = 0; opt.kick();
    }
    else return;
    e.preventDefault();
  };
  dom.addEventListener('pointerdown', onDown); dom.addEventListener('pointermove', onMove); dom.addEventListener('pointerup', onUp); dom.addEventListener('pointercancel', onUp); dom.addEventListener('contextmenu', onCtx);
  const onKeyUp = (e) => { if (held.delete(String(e.key).toLowerCase())) e.preventDefault(); };
  const onBlur = () => held.clear();
  dom.addEventListener('wheel', onWheel, { passive: false }); dom.addEventListener('keydown', onKey); dom.addEventListener('keyup', onKeyUp); dom.addEventListener('blur', onBlur);
  // returns true while still moving
  function update() {
    let moving = false;
    const tnow = performance.now(), dt = lastU && tnow - lastU < 120 ? clamp((tnow - lastU) / 1000, 1 / 250, 0.12) : 1 / 60; lastU = tnow; // (after a pause the first step is a normal one, not a jump)
    if (held.size && locked()) held.clear();
    if (held.size || kv[0] || kv[1]) {
      const f = (held.has('w') ? 1 : 0) - (held.has('s') ? 1 : 0), r = (held.has('d') ? 1 : 0) - (held.has('a') ? 1 : 0), n = Math.hypot(f, r) || 1;
      const sp = st.d * 0.85, ca = Math.cos(st.az), sa = Math.sin(st.az); // the camera looks along -(sin az, cos az); its right is (cos az, -sin az)
      const wx = ((-sa * f + ca * r) / n) * sp, wz = ((-ca * f - sa * r) / n) * sp, a = reduce() ? 1 : 1 - Math.exp(-dt * (held.size ? 9 : 7));
      kv[0] += (wx - kv[0]) * a; kv[1] += (wz - kv[1]) * a; st.px += kv[0] * dt; st.pz += kv[1] * dt; clampPan();
      if (st.goal) { st.goal.px = st.px; st.goal.pz = st.pz; }
      if (!held.size && Math.hypot(kv[0], kv[1]) < st.d * 0.01) kv = [0, 0]; else moving = true;
    }
    // a fling keeps gliding a little longer (smoother than it was)
    // (v5.78: every glide below is timed by the clock, not by frames: the same smooth motion at 30, 60 or 120 frames a second)
    const f60 = dt * 60;
    if (!st.dragging && (st.vaz || st.vel)) { st.az += st.vaz * f60; st.el = limitEl(st.el + st.vel * f60, st.d); const dk = Math.pow(0.92, f60); st.vaz *= dk; st.vel *= dk; if (Math.abs(st.vaz) < 1e-4 && Math.abs(st.vel) < 1e-4) st.vaz = st.vel = 0; else moving = true; }
    if (!st.dragging && (st.vpx || st.vpz)) { st.px += st.vpx * f60; st.pz += st.vpz * f60; clampPan(); const dk = Math.pow(0.9, f60); st.vpx *= dk; st.vpz *= dk; if (Math.hypot(st.vpx, st.vpz) < st.d * 1e-5) st.vpx = st.vpz = 0; else moving = true; }
    if (tw) { // the eased glide: every channel together, the short way round
      const u = clamp((tnow - tw.t0) / tw.dur, 0, 1), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      for (const q of ['az', 'el', 'd', 'px', 'pz']) st[q] = tw.from[q] + (tw.to[q] - tw.from[q]) * e;
      if (u >= 1) tw = null; else moving = true;
    }
    if (st.goal) {
      const k = 1 - Math.exp(-dt * 12); st.az += (st.goal.az - st.az) * k; st.d *= Math.pow(st.goal.d / st.d, k); /* (v5.78: zoom glides in proportion - the same feel close up and far away) */ st.el = limitEl(st.el + (st.goal.el - st.el) * k, st.d); st.px += (st.goal.px - st.px) * k; st.pz += (st.goal.pz - st.pz) * k;
      if (Math.abs(st.goal.az - st.az) < 1e-4 && Math.abs(st.goal.d - st.d) / st.d < 1e-4 && Math.abs(st.goal.el - st.el) < 1e-4 && Math.hypot(st.goal.px - st.px, st.goal.pz - st.pz) < st.d * 1e-4) { st.az = st.goal.az; st.d = st.goal.d; st.px = st.goal.px; st.pz = st.goal.pz; st.goal = null; } else moving = true;
    }
    st.el = limitEl(st.el, st.d);
    // v6.20 (Eduardo: "too laggy when going around"): a drag turns the camera in the pointer handler, not here - so this
    // said "not moving" all through a drag, and every frame of it redrew the whole shadow map (and the dynamic resolution
    // never stepped in). Any change since the last frame counts as camera movement.
    const pv = st._pv || (st._pv = [NaN, 0, 0, 0, 0]);
    if (pv[0] !== st.az || pv[1] !== st.el || pv[2] !== st.d || pv[3] !== st.px || pv[4] !== st.pz) { if (pv[0] === pv[0]) moving = true; pv[0] = st.az; pv[1] = st.el; pv[2] = st.d; pv[3] = st.px; pv[4] = st.pz; }
    return moving;
  }
  function dispose() { dom.removeEventListener('pointerdown', onDown); dom.removeEventListener('pointermove', onMove); dom.removeEventListener('pointerup', onUp); dom.removeEventListener('pointercancel', onUp); dom.removeEventListener('wheel', onWheel); dom.removeEventListener('keydown', onKey); dom.removeEventListener('keyup', onKeyUp); dom.removeEventListener('blur', onBlur); dom.removeEventListener('contextmenu', onCtx); }
  function tween(g, dur = 1000) {
    const from = { az: st.az, el: st.el, d: st.d, px: st.px, pz: st.pz }, to = Object.assign({}, from);
    for (const q in to) if (g[q] != null) to[q] = g[q];
    to.az = st.az + Math.atan2(Math.sin(to.az - st.az), Math.cos(to.az - st.az)); to.d = clamp(to.d, opt.dMin(), opt.dMax());
    st.goal = null; st.vaz = st.vel = st.vpx = st.vpz = 0;
    if (reduce() || dur <= 0) { Object.assign(st, to); tw = null; } else tw = { from, to, t0: performance.now(), dur };
    opt.kick();
  }
  return { st, setGoal, update, dispose, zoom, tween, get tweening() { return !!tw; }, get aim() { return tw ? Object.assign({}, tw.to) : st.goal ? Object.assign({}, st.goal) : { az: st.az, el: st.el, d: st.d, px: st.px, pz: st.pz }; } };
}

// ---------- the person / ruler used for "Scale" ----------
function personShape(h) {
  const s = new THREE.Shape(), k = h / 1.5;
  const pts = [[0.1, 0], [0.12, 0.7], [0.16, 0.82], [0.2, 1.22], [0.18, 1.3], [0.07, 1.33], [0.06, 1.36], [0.1, 1.42], [0.09, 1.49], [0, 1.5]];
  s.moveTo(-pts[0][0] * k, 0); for (const [x, y] of pts) s.lineTo(x * k, y * k); for (let i = pts.length - 1; i >= 0; i--) s.lineTo(-pts[i][0] * k, pts[i][1] * k);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18 * k, bevelEnabled: true, bevelThickness: 0.03 * k, bevelSize: 0.03 * k, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -0.09 * k); return g;
}

// ---------- v5.74: the buttons over the 3D view, in groups, and the Size vs person overlays ----------
// (injected after extras.js's styles, so these win; the look stays SnakeList's: dark see-through pills, green when on)
// v5.78: the body bends on the graphics card. extras.js's rig (Slither, See it eat, the idle head turns, Size vs person)
// hands over its centre line and frames (720 samples) as a small float texture; the vertex shader moves every vertex of
// the skin from its rest frame onto the new one (and turns its normal with it). Before, all ~200 000 vertices were moved
// and their normals recomputed on the main thread every frame - the cause of the stutter in every animation.
// Texture rows: 0-3 rest centre (w: belly height), T, U, S; 4-7 the new centre (w: swelling), T, U, S.
const RIG_GLSL = `
uniform sampler2D uRigTex; uniform float uRigOn; uniform float uRigN; uniform float uRigDx;
vec4 slRT(float i, float r) { return texture2D(uRigTex, vec2((i + 0.5) / uRigN, (r + 0.5) / 8.0)); }
vec3 slRigP(vec3 p, float x, inout vec3 n) {
  float f = clamp(x / uRigDx, 0.0, uRigN - 1.0001), i = floor(f), w = f - i;
  vec4 r0 = mix(slRT(i, 0.0), slRT(i + 1.0, 0.0), w); vec3 rT = mix(slRT(i, 1.0).xyz, slRT(i + 1.0, 1.0).xyz, w), rU = mix(slRT(i, 2.0).xyz, slRT(i + 1.0, 2.0).xyz, w), rS = mix(slRT(i, 3.0).xyz, slRT(i + 1.0, 3.0).xyz, w);
  vec4 c4 = mix(slRT(i, 4.0), slRT(i + 1.0, 4.0), w); vec3 nT = mix(slRT(i, 5.0).xyz, slRT(i + 1.0, 5.0).xyz, w), nU = mix(slRT(i, 6.0).xyz, slRT(i + 1.0, 6.0).xyz, w), nS = mix(slRT(i, 7.0).xyz, slRT(i + 1.0, 7.0).xyz, w);
  vec3 d = p - r0.xyz; float l0 = dot(d, rT), l1 = dot(d, rU), l2 = dot(d, rS);
  if (abs(c4.w - 1.0) > 1e-4) { l1 = (l1 + r0.w) * c4.w - r0.w; l2 *= c4.w; }
  n = nT * dot(n, rT) + nU * dot(n, rU) + nS * dot(n, rS);
  return c4.xyz + nT * l0 + nU * l1 + nS * l2;
}`;
const RIG_V = `if (uRigOn > 0.5) {
#ifdef SL_RIG_N
  vec3 slN = objectNormal;
#else
  vec3 slN = vec3(0.0, 1.0, 0.0);
#endif
  transformed = slRigP(transformed, aMet.y, slN);
#ifdef SL_RIG_N
  transformedNormal = normalMatrix * normalize(slN);
  #ifdef FLIP_SIDED
  transformedNormal = - transformedNormal;
  #endif
  #ifndef FLAT_SHADED
  vNormal = normalize(transformedNormal);
  #endif
#endif
}
`;
const UI_CSS = `
.sp3d-stage>.sp3d-bar{gap:8px 14px}
.sp3d-stage>.sp3d-bar>.sp3d-grp{display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;pointer-events:auto}
.sp3d-stage>.sp3d-bar>.sp3d-grp:empty,.sp3d-stage>.sp3d-bar>.sp3d-grp[hidden]{display:none}
.sp3d-stage>.sp3d-bar>.sp3d-seg{gap:0;padding:2px;border-radius:12px;background:rgba(12,26,18,.74);border:1px solid rgba(255,255,255,.16);box-shadow:0 2px 8px rgba(0,0,0,.18);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.sp3d-stage>.sp3d-bar>.sp3d-seg>.sp3d-b{background:transparent;border-color:transparent;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none;border-radius:10px}
.sp3d-stage>.sp3d-bar>.sp3d-seg>.sp3d-b:hover{background:rgba(255,255,255,.1);border-color:transparent}
.sp3d-stage>.sp3d-bar>.sp3d-seg>.sp3d-b[hidden]{display:none}
.sp3d-stage .sp3d-b{transition:background-color .15s ease,border-color .15s ease,transform .08s ease;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.sp3d-stage .sp3d-b:active:not(:disabled){transform:scale(.95)}
.sp3d-stage .sp3d-b:focus-visible{outline:3px solid #9be07c;outline-offset:2px}
.sp3d-stage>.sp3d-bar>.sp3d-grp .sp3d-b[aria-pressed=true],.sp3d-stage>.sp3d-bar>.sp3d-seg>.sp3d-b[aria-pressed=true],.sp3d-stage .sp3d-b.sp3d-backchip:active{background:#4fa64a;border-color:#4fa64a;color:#fff}
.sp3d-stage>.sp3d-bar>.sp3d-seg>.sp3d-b[aria-pressed=true]{box-shadow:0 1px 4px rgba(0,0,0,.25)}
.sp3d-bar.sp3d-few .sp3d-more{display:none}
.sp3d-stage .sp3d-habgrp .sp3d-b[hidden]{display:none}
.sp3d-stage .sp3d-b.sp3d-habbtn{display:inline-flex;align-items:center;gap:7px}
.sp3d-stage .sp3d-b.sp3d-habbtn::after{content:"";width:6px;height:6px;border:solid currentColor;border-width:0 1.5px 1.5px 0;transform:rotate(-45deg);transition:transform .15s ease}
.sp3d-stage .sp3d-b.sp3d-habbtn[aria-expanded=true]::after{transform:rotate(135deg)}
.sp3d-stage .sp3d-b.sp3d-habbtn[aria-expanded=true]{border-color:rgba(155,224,124,.65)}
.sp3d-stage .sp3d-backchip{position:absolute;left:10px;bottom:10px;z-index:5;display:inline-flex;align-items:center;gap:6px}
.sp3d-stage .sp3d-backchip[hidden]{display:none}
.sp3d-stage.sp3d-sizing .sp3d-hint{opacity:0}
.sp3d-sizecap{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);z-index:4;width:max-content;max-width:min(calc(100% - 200px),620px);padding:7px 14px;border-radius:12px;background:rgba(12,26,18,.86);color:#fff;font:500 13.5px/1.45 Inter,system-ui,sans-serif;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.3)}
.sp3d-sizecap[hidden]{display:none}.sp3d-sizecap a{color:#b8f0a0;text-decoration:underline;text-underline-offset:2px}
.sp3d-szring{position:absolute;left:0;top:0;z-index:2;border:3px solid #ffd66b;border-radius:50%;box-shadow:0 0 0 2px rgba(12,26,18,.55),inset 0 0 0 2px rgba(12,26,18,.35);pointer-events:none}
.sp3d-szring[hidden],.sp3d-szinset[hidden]{display:none}
.sp3d-szlab{position:absolute;left:50%;bottom:100%;transform:translate(-50%,-6px);padding:2px 9px;border-radius:999px;background:rgba(12,26,18,.88);color:#fff;font:600 12.5px/1.4 Inter,system-ui,sans-serif;white-space:nowrap}
.sp3d-labels .sp3d-mk.sp3d-off{visibility:hidden}
.sp3d-szinset{position:absolute;left:0;top:0;z-index:3;border:3px solid #ffd66b;border-radius:6px;box-shadow:0 0 0 2px rgba(12,26,18,.6),0 4px 14px rgba(0,0,0,.35);pointer-events:none;box-sizing:border-box}
.sp3d-szzoom{position:absolute;left:6px;top:6px;padding:2px 8px;border-radius:999px;background:rgba(12,26,18,.86);color:#ffd66b;font:700 12px/1.4 Inter,system-ui,sans-serif}
@media (max-width:820px){.sp3d-sizecap{left:10px;right:10px;bottom:62px;transform:none;width:auto;max-width:none;font-size:12.5px;padding:6px 10px}}
/* the buttons follow the 3D view's own width (Compare photo narrows it, the window stays the same): a narrow view puts
   Compare photo and See countries on the first line of the buttons, at the same left edge and spacing as the rest; a
   very narrow one swaps Normal / Anatomy / Size vs person for one "See more" button with a small menu */
.sp3d-stage.sp3d-lay>.sp3d-bar{top:10px;right:var(--sp3d-barR,10px)}
.sp3d-stage>.sp3d-bar>.sp3d-hdb{order:-1;flex:0 0 100%;display:flex;flex-wrap:wrap;gap:6px;margin:0;pointer-events:none}
.sp3d-stage>.sp3d-bar>.sp3d-hdb>*{pointer-events:auto}
.sp3d-stage>.sp3d-bar>.sp3d-vgrp{display:none;position:relative}
.sp3d-stage.sp3d-narrow>.sp3d-bar>.sp3d-vgrp{display:inline-flex}
.sp3d-stage.sp3d-narrow>.sp3d-bar>.sp3d-seg{display:none}
.sp3d-stage .sp3d-b.sp3d-vmore{display:inline-flex;align-items:center;gap:8px}
.sp3d-stage .sp3d-b.sp3d-vmore::after{content:"";width:6px;height:6px;border:solid currentColor;border-width:0 1.5px 1.5px 0;transform:translateY(-2px) rotate(45deg);transition:transform .15s ease}
.sp3d-stage .sp3d-b.sp3d-vmore[aria-expanded=true]{background:rgba(12,26,18,.9);border-color:rgba(155,224,124,.65);color:#fff}
.sp3d-stage .sp3d-b.sp3d-vmore[aria-expanded=true]::after{transform:translateY(1px) rotate(-135deg)}
.sp3d-vmenu{position:absolute;left:0;top:calc(100% + 6px);z-index:6;display:flex;flex-direction:column;gap:2px;min-width:176px;padding:4px;border-radius:12px;background:rgba(12,26,18,.94);border:1px solid rgba(255,255,255,.16);box-shadow:0 6px 18px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.sp3d-vmenu[hidden],.sp3d-vmi[hidden]{display:none}
.sp3d-vmi{display:flex;align-items:center;gap:8px;width:100%;min-height:36px;margin:0;padding:6px 14px 6px 8px;border:0;border-radius:9px;background:transparent;color:#fff;font:600 13px/1.2 Inter,system-ui,sans-serif;text-align:left;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent}
.sp3d-vmi:hover{background:rgba(255,255,255,.1)}
.sp3d-vmi[aria-checked=true]{background:#4fa64a}
.sp3d-vmi:focus-visible{outline:3px solid #9be07c;outline-offset:-2px}
.sp3d-vmk{flex:none;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center}
.sp3d-vmi[aria-checked=true] .sp3d-vmk::before{content:"";width:5px;height:9px;border:solid #fff;border-width:0 2px 2px 0;transform:translateY(-1px) rotate(45deg)}
/* phones and tablets: every button at least 44 px tall, with room between them */
@media (max-width:820px),(pointer:coarse){
.sp3d-stage .sp3d-b,.sp3d-stage .sp3d-hb,.sp3d-stage .sp3d-b.sp3d-morebtn,.sp3d-stage .sp3d-b.sp3d-morebtn[aria-expanded=true]{min-height:44px;padding:0 13px;font-size:13px}
.sp3d-stage .sp3d-b.sp3d-morebtn,.sp3d-stage .sp3d-b.sp3d-morebtn[aria-expanded=true]{padding:0 14px;font-size:12.5px}
.sp3d-stage>.sp3d-bar>.sp3d-seg{padding:0}
.sp3d-stage>.sp3d-bar{gap:8px 10px}
.sp3d-stage .sp3d-fsc{width:44px;height:44px}
.sp3d-vmi{min-height:44px}
}
`;
function uiCSSInject() {
  if (typeof document === 'undefined' || document.getElementById('sp3d-ui-css')) return;
  const s = document.createElement('style'); s.id = 'sp3d-ui-css'; s.textContent = UI_CSS; document.head.appendChild(s);
}

// ---------- the viewer ----------
// v5.78: species rebuilt against photos in this version, ahead of the next models.json build (the same values are in
// tools/auto_models.py CURATED, so a rebuild gives the same result): they override the profile's head
const SPECIES_LOOK = {
  'opheodrys-vernalis': { h: { iris: '#16150d', irisInner: '#232110', eyeRing: null, pupilW: 0.22, eye: null, eyeL: 0.19, eyeX: 0.36, eyeA: 50, len: 0.031, w: 0.9, h: 0.78, snoutH: 0.64, jaw: 0.82, lips: 'pale', lipColor: '#bcd672', bulge: 0.045, brow: 0.07, taper: 0.3, tongue: '#c42a38', tongueTip: '#141012', lw: 1.65, hFixed: 1, groove: 0.16, headRelief: 0.14, snout: 0.52, lipFull: null }, body: { hn: 1.3 },
    scales: { cavity: 0.22, gloss: 0.78, relief: 0.55 }, colors: { edgeK: 0.25 } },
  // the inland taipan against its SnakeList photo (will-hunt) and the Australian Museum account: a deep, rounded "coffin" head
  // (deeper than the body's own depth, the snout high and rounded), glossy smooth scales, and a warmer olive-brown
  // (v5.93: against research-grade iNaturalist photos of adults: a longer, less bulbous head - deep, but the snout tapering to a
  // rounded point, not a high round dome - and an olive grey-brown body, not golden; the head and neck darker and glossy)
  'oxyuranus-microlepidotus': { h: { h: 0.74, hFixed: 1, snoutH: 0.74, snout: 0.5, len: 0.04, groove: 0.22, headRelief: 0.24, taper: 0.16, bulge: 0.04, brow: 0.05, eyeL: 0.18 },
    scales: { cavity: 0.3 }, colors: { dorsal: '#6b5a3c', lateral: '#73603f' },
    // v6.20: the dark head grades into the neck over a few scale rows, further back along the crown than on the lips (it
    // ended in a ruler-straight ring right behind the head)
    patch: (q) => { for (const l of q.pattern || []) if (l.type === 'cap') Object.assign(l, { x1: 1.15, soft: 0.28, vee: 0.25 }); } },
};
function withLook(p, id) {
  const L = SPECIES_LOOK[id]; if (!L || !p) return p;
  const q = JSON.parse(JSON.stringify(p)), tgt = q.auto ? (q.auto.h = q.auto.h || {}) : (q.head = q.head || {});
  for (const k in L.h) { if (L.h[k] == null) delete tgt[k]; else tgt[k] = L.h[k]; }
  if (L.body) Object.assign(q.auto ? (q.auto.bx = q.auto.bx || {}) : (q.body = q.body || {}), L.body);
  if (L.scales) Object.assign(q.auto ? (q.auto.sx = q.auto.sx || {}) : (q.scales = q.scales || {}), L.scales);
  if (L.colors) Object.assign(q.auto ? (q.auto.cx = q.auto.cx || {}) : (q.colors = q.colors || {}), L.colors);
  if (L.patch) L.patch(q); // v6.20: a species' pattern layers adjusted in place
  return q;
}
export function mount(host, opts) {
  const RZ = opts.realism != null ? !!opts.realism : realismOn(); // v6.35: the "3d" preview's realism pass
  const P0 = normProfile(autoProfile(RZ ? realLook(withLook(opts.profile, opts.id), opts.id) : withLook(opts.profile, opts.id)), opts.id), P = RZ ? realism(P0, opts.id) : P0, seed = strSeed(opts.id || P.name || 'snake');
  { const gH = HEAD_GENUS[String(opts.id || '').split('-')[0]]; if (gH) P.head = Object.assign({}, gH, P.head); } // v5.53
  const reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduce = () => reduceMQ.matches;
  // v5.78: three quality tiers, chosen by the device: High (computers with a graphics card), Medium (phones and tablets),
  // Light (weak devices, software rendering). v5.93: no Detail button any more - the tier is always the device's own, and
  // while the view runs it adapts by itself (adaptive(): the sharpness, the plants' density and the frame pacing step
  // smoothly up or down from the measured frame time, so it stays smooth without visible jumps)
  const lowDevice = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;
  const phoneLike = Math.min(screen.width, screen.height) < 820 && !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || Math.min(screen.width, screen.height) < 500;
  // software rendering (no GPU: SwiftShader, llvmpipe) is treated as a low-end device
  const softGL = (() => { try { const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl'), e = g && g.getExtension('WEBGL_debug_renderer_info'), r = e ? String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)) : ''; if (g && g.getExtension('WEBGL_lose_context')) g.getExtension('WEBGL_lose_context').loseContext(); return /swiftshader|llvmpipe|software/i.test(r); } catch (err) { return false; } })();
  const autoQ = softGL || lowDevice || (phoneLike && ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3)) ? 'low' : phoneLike ? 'medium' : 'high';
  try { localStorage.removeItem('sl-3d-quality'); } catch (e) { /* private mode */ } // (the old Detail button's choice)
  const quality = opts.quality || window.SL_3D_QUALITY || autoQ;
  // v5.93: the snake's habitats (Habitats, behind Show more, when it has more than one); the last one you chose for this
  // snake is remembered on this device
  let habList = habitatsOf(opts.id); const scene0 = P.scene;
  const lookOf = (o) => (o.k === scene0.kind ? Object.assign({}, scene0, o.f ? { flavor: o.f } : {}) : Object.assign({ kind: o.k }, o.f ? { flavor: o.f } : {}, scene0.barkColor ? { barkColor: scene0.barkColor } : {}, scene0.leafSize ? { leafSize: scene0.leafSize } : {}));
  let habI = 0;
  // v6.09: opened from the map's 3D Habitats ("See snakes here in 3D"): that habitat's look first (it joins the snake's own list when it isn't in it)
  const want = opts.habitat && opts.habitat.k ? opts.habitat : null;
  if (want && habList) { const i = habList.findIndex((o) => o.k === want.k && (o.f || '') === (want.f || '')); if (i < 0) habList = [want].concat(habList); }
  const habChoose = () => { habI = 0; if (want) { habI = Math.max(0, habList.findIndex((o) => o.k === want.k && (o.f || '') === (want.f || ''))); P.scene = lookOf(habList[habI]); return; } try { const k = localStorage.getItem('sl-3d-hab:' + opts.id); const i = habList.findIndex((o) => o.k === k); if (i >= 0) habI = i; } catch (e) { /* private mode */ } P.scene = lookOf(habList[habI]); };
  if (habList) habChoose();
  else if (want) P.scene = lookOf(want);
  else { const one = HAB_LOOKS && HAB_LOOKS.sp && HAB_LOOKS.sp[opts.id]; if (Array.isArray(one) && one.length === 1) P.scene = lookOf(one[0]); } // (v6.02: one habitat, but its own look - e.g. eucalypt woodland)
  const disposables = new Set(), cleanups = [];
  const track = (o) => { disposables.add(o); return o; };
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); cleanups.push(() => t.removeEventListener(ev, fn, o)); };

  // DOM
  host.innerHTML = '';
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const wrap = el('div', 'sp3d-wrap'), stage = el('div', 'sp3d-stage'), labels = el('div', 'sp3d-labels'), status = el('div', 'sp3d-status');
  const hint = el('p', 'sp3d-hint', (touchFirst() ? 'Drag to go round it · two fingers to move · pinch or double-tap to zoom' : 'Drag to go round the snake · W A S D or right-drag to move around it · scroll or double-click to zoom'));
  status.setAttribute('role', 'status'); status.hidden = true;
  const canvas = document.createElement('canvas'); canvas.className = 'sp3d-canvas'; canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '3D model of ' + opts.name + '. Arrow keys rotate, plus and minus zoom, R resets the view.');
  stage.append(canvas, labels, hint, status);
  // v5.43: one loading cover over the whole 3D view while the snake and its surroundings are being built - it
  // stays until everything is ready and the first full picture is drawn, then goes with it
  if (!document.getElementById('sp3d-busy-css')) { const st = document.createElement('style'); st.id = 'sp3d-busy-css';
    st.textContent = '.sp3d-busy{position:absolute;inset:0;z-index:6;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:12px;background:var(--bg,#f1f6ec);color:var(--ink,#24321f);font:500 15px/1.3 Inter,system-ui,sans-serif;border-radius:inherit;transition:opacity .3s ease}'
      + '.sp3d-busy.out{opacity:0;pointer-events:none}.sp3d-busy i{flex:none;width:34px;height:34px;border-radius:50%;border:4px solid rgba(87,171,69,.22);border-top-color:#57ab45;animation:sp3dbusy .8s linear infinite;box-sizing:border-box}'
      + '@keyframes sp3dbusy{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.sp3d-busy i{animation-duration:2.4s}.sp3d-busy{transition:none}}';
    document.head.appendChild(st); }
  const busy = el('div', 'sp3d-busy'); busy.setAttribute('role', 'status'); busy.append(el('i'), el('span', '', 'Loading the 3D model\u2026'));
  if (getComputedStyle(stage).position === 'static') stage.style.position = 'relative';
  stage.appendChild(busy);
  let busyFor = null;
  const busyShow = () => { busy.hidden = false; busy.classList.remove('out'); };
  const busyHide = (pr) => { if (pr !== busyFor) return; requestAnimationFrame(() => requestAnimationFrame(() => { if (pr !== busyFor) return; busy.classList.add('out'); setTimeout(() => { if (pr === busyFor) busy.hidden = true; }, 320); })); };
  const bar = el('div', 'sp3d-bar'); bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', '3D view controls');
  // (v5.74: no title - SnakeList shows no text when you rest the pointer on a button; every button says what it does)
  const btn = (txt, title, cls) => { const b = el('button', 'sp3d-b' + (cls ? ' ' + cls : ''), txt); b.type = 'button'; bar.appendChild(b); return b; };
  const vg = el('span', 'sp3d-views'); vg.setAttribute('role', 'group'); vg.setAttribute('aria-label', 'Views');
  const bFront = btn('Front', 'View the head from the front'), bSide = btn('Side', 'View from the side'), bTop = btn('Top', 'View from above');
  vg.append(bFront, bSide, bTop); bar.appendChild(vg);
  const bReset = btn('Reset', 'Reset the view (R)'), bFull = btn('Fullscreen', 'Fullscreen'), bScale = btn('Scale', 'Compare with a typical adult\'s length'), bDet = btn('Details', 'Show what to look for');
  const bSet = btn('Settings', 'Settings', 'sp3d-set'); bSet.setAttribute('aria-expanded', 'false');
  bScale.setAttribute('aria-pressed', 'false'); bDet.setAttribute('aria-pressed', 'false');
  // v4.63: only Reset stayed under the model. v4.72: Open mouth next to it, then three camera views
  // (Full body, Head close-up, Pattern from above) and Size (a ruler and a 1.5 m person); still no Fullscreen, Details or Settings
  [vg, bFull, bScale, bDet, bSet].forEach((b) => b.remove());
  const bMouth = btn('Open mouth', 'Open the mouth to see the teeth and fangs'); bMouth.setAttribute('aria-pressed', 'false');
  // v4.80: Anatomy (labelled parts, mouth open). (v5.68: See bite was taken out)
  const bAnat = btn('Anatomy', 'Show the parts of this snake: fangs, teeth, glottis, tongue, scales and more'); bAnat.setAttribute('aria-pressed', 'false');
  const vg2 = el('span', 'sp3d-views'); vg2.setAttribute('role', 'group'); vg2.setAttribute('aria-label', 'Camera views');
  const bVBody = btn('Full body', 'See the whole snake'), bVHead = btn('Head close-up', 'Close up on the head and its scales'), bVTop = btn('Pattern from above', 'Look down on the pattern of its back');
  vg2.append(bVBody, bVHead, bVTop); bar.appendChild(vg2); bar.appendChild(bScale); bScale.textContent = 'Size vs person';
  // v5.74: Normal - the plain model (no Anatomy, no Size vs person); with Anatomy and Size vs person it makes the View group
  const bNormal = btn('Normal'); bNormal.setAttribute('aria-pressed', 'true');
  let mouthGoal = 0;
  // v4.81: everything you can do with the model beyond looking at it lives in extras.js (Slither, See it eat,
  // See eye shield, Anatomy, Fullscreen, Compare photo / See countries beside the model, double-click zoom)
  const V = { THREE, P, opts, el, on, wrap, stage, labels, bar, canvas, btn, bAnat, reduce,
    get cam() { return cam; }, get controls() { return controls; }, get info() { return info; }, get extras() { return extras; }, get group() { return snakeGroup; }, get scene() { return ctx.scene; },
    kick: () => kick(), toggleFull: () => toggleFull(), scaleOn: () => sizeSt.on,
    get occ() { return ctx.occ; }, get ctx() { return ctx; }, get quality() { return quality; }, get skinGPU() { return skinGPU; }, get sceneOn() { return cScene.checked; }, NATURE, scaleOff: () => { if (bScale.getAttribute('aria-pressed') === 'true') toggleScale(false, { instant: true }); }, // (at once: something else takes over the snake and the camera)
    scaleBack: (keepCam) => { if (bScale.getAttribute('aria-pressed') === 'true') { toggleScale(false, { keepCam }); return true; } return false; }, /* (gliding back to the view you had) */ closeMouth: () => { if (mouthGoal) toggleMouth(false); }, get mouthGoal() { return mouthGoal; }, set mouthGoal(v) { mouthGoal = v; bMouth.setAttribute('aria-pressed', String(v > 0.01)); bMouth.textContent = v > 0.01 ? 'Close mouth' : 'Open mouth'; },
    resetView: () => resetView(),     focus: (p, d, elv) => focusOn(p, d, elv), view: (g) => controls.setGoal(Object.assign({ az: controls.st.az, d: info.dFit, px: 0, pz: 0 }, g)) };
  const fx = EXTRA.create(V);
  uiCSSInject();
  // v5.74: the buttons in groups - View (Normal / Anatomy / Size vs person, one at a time), Actions (Open mouth / See it
  // eat / Slither) and Reset on the main lines; the camera buttons (Full body / Head close-up / Pattern from above)
  // behind Show more. Every button that turns something on is green and aria-pressed while it is on.
  const grp = (label, cls, list) => { const g = el('span', 'sp3d-grp' + (cls ? ' ' + cls : '')); g.setAttribute('role', 'group'); g.setAttribute('aria-label', label); list.filter(Boolean).forEach((b) => g.appendChild(b)); bar.appendChild(g); return g; };
  const fb = fx.buttons || {};
  [bMouth, fb.eat, fb.slither].forEach((b) => b && !b.hasAttribute('aria-pressed') && b.setAttribute('aria-pressed', 'false'));
  const gView = grp('View', 'sp3d-seg', [bNormal, bAnat, bScale]), gAct = grp('Actions', '', [bMouth, fb.eat, fb.slither]), gReset = grp('Reset', '', [bReset]);
  vg2.className = 'sp3d-grp sp3d-cam'; vg2.setAttribute('aria-label', 'Camera'); bar.appendChild(vg2);
  // v5.93: Habitats (only for a snake that lives in more than one): Habitats opens the list of its habitats beside it, the
  // one shown is green; choosing another rebuilds the surroundings round the same snake and view
  // v6.02 (Eduardo: "make the habitats button next to reset but to the left of reset"): on the main line, just left of
  // Reset, in the same style (it used to be behind Show more); the list opens right after Reset
  const gHab = el('span', 'sp3d-grp sp3d-habgrp'); gHab.setAttribute('role', 'group'); gHab.setAttribute('aria-label', 'Habitats'); gHab.hidden = true;
  const habBtns = [];
  gReset.after(gHab);
  const habUI = () => {
    const bHab = el('button', 'sp3d-b sp3d-habbtn', 'Habitats'); bHab.type = 'button'; bHab.setAttribute('aria-expanded', 'false'); gReset.insertBefore(bHab, bReset); gReset.setAttribute('aria-label', 'Habitats and Reset');
    habList.forEach((o, i) => { const b = el('button', 'sp3d-b sp3d-habopt', o.l); b.type = 'button'; b.hidden = true; b.setAttribute('aria-pressed', String(i === habI)); gHab.appendChild(b); habBtns.push(b);
      on(b, 'click', () => { if (i === habI) return; habI = i; habBtns.forEach((q, j) => q.setAttribute('aria-pressed', String(j === i))); try { localStorage.setItem('sl-3d-hab:' + opts.id, o.k); } catch (e) { /* private mode */ } P.scene = lookOf(o); rebuild(); }); });
    on(bHab, 'click', () => { const open = bHab.getAttribute('aria-expanded') !== 'true'; bHab.setAttribute('aria-expanded', String(open)); gHab.hidden = !open; habBtns.forEach((b) => { b.hidden = !open; }); });
  };
  if (habList) habUI();
  else HAB_P.then((d) => { let l = habPick(d, opts.id); if (!alive || !l || habList) return; if (want && l.findIndex((o) => o.k === want.k && (o.f || '') === (want.f || '')) < 0) l = [want].concat(l); habList = l; const k0 = P.scene.kind; habChoose(); habUI(); if (P.scene.kind !== k0 && ctx.scene) rebuild(); }); // (arrived late)
  [...bar.children].forEach((c) => { if (c.classList.contains('sp3d-b') && c !== bReset) gAct.appendChild(c); }); // (any other action button extras.js adds)
  // v5.05: the main buttons stay in view; the camera buttons are behind Show more / Show less
  const bMore = el('button', 'sp3d-b sp3d-morebtn', 'Show more'); bMore.type = 'button'; bMore.setAttribute('aria-expanded', 'false');
  [vg2].concat(fx.moreButtons || []).forEach((b) => b.classList.add('sp3d-more'));
  bar.classList.add('sp3d-few');
  // v5.50: Show more sits on its own line under the main buttons (like See all families), and the extra buttons open below it
  const br1 = el('span', 'sp3d-br'), br2 = el('span', 'sp3d-br'); br1.setAttribute('aria-hidden', 'true'); br2.setAttribute('aria-hidden', 'true');
  bar.append(br1, bMore, br2);
  on(bMore, 'click', () => { const open = bar.classList.toggle('sp3d-few') === false; bMore.textContent = open ? 'Show less' : 'Show more'; bMore.setAttribute('aria-expanded', String(open)); });
  // the View group always agrees with what is on: Normal is pressed when neither Anatomy nor Size vs person is
  const syncViews = () => { const v = bAnat.getAttribute('aria-pressed') !== 'true' && bScale.getAttribute('aria-pressed') !== 'true'; if (bNormal.getAttribute('aria-pressed') !== String(v)) bNormal.setAttribute('aria-pressed', String(v)); };
  if (window.MutationObserver) { const mo = new MutationObserver(syncViews); mo.observe(bAnat, { attributes: true, attributeFilter: ['aria-pressed', 'hidden'] }); mo.observe(bScale, { attributes: true, attributeFilter: ['aria-pressed'] }); cleanups.push(() => mo.disconnect()); }
  // v6.13 (Eduardo: Compare photo and See countries the wrong size and place when the photo is open beside the model; "say
  // see more where it says anatomy normal and size vs person but only appears when the screen is very small"): the buttons
  // follow the 3D view's OWN width (the photo beside it narrows it while the window stays the same). Narrow: Compare photo
  // and See countries become the first line of the buttons, at the same left edge and spacing. Very narrow: one "See more"
  // in place of Normal / Anatomy / Size vs person, opening a small menu of the three (the one on is green, with a tick).
  const gVM = el('span', 'sp3d-grp sp3d-vgrp'); gVM.setAttribute('role', 'group'); gVM.setAttribute('aria-label', 'View');
  const bVMore = el('button', 'sp3d-b sp3d-vmore', 'See more'); bVMore.type = 'button'; bVMore.setAttribute('aria-haspopup', 'menu'); bVMore.setAttribute('aria-expanded', 'false');
  const vMenu = el('div', 'sp3d-vmenu'); vMenu.hidden = true; vMenu.id = 'sp3d-vmenu-' + seed; vMenu.setAttribute('role', 'menu'); vMenu.setAttribute('aria-label', 'View');
  bVMore.setAttribute('aria-controls', vMenu.id); gVM.append(bVMore, vMenu); gView.after(gVM);
  const vClose = (refocus) => { if (vMenu.hidden) return; vMenu.hidden = true; bVMore.setAttribute('aria-expanded', 'false'); if (refocus) bVMore.focus({ preventScroll: true }); };
  const vItems = [[bNormal, 'Normal'], [bAnat, 'Anatomy'], [bScale, 'Size vs person']].map(([b, t]) => {
    const m = el('button', 'sp3d-vmi'); m.type = 'button'; m.setAttribute('role', 'menuitemradio'); m.append(el('span', 'sp3d-vmk'), el('span', '', t)); vMenu.appendChild(m);
    on(m, 'click', () => { vClose(true); if (b.getAttribute('aria-pressed') !== 'true') b.click(); });
    return [m, b];
  });
  const vShown = () => vItems.map((x) => x[0]).filter((m) => !m.hidden);
  on(bVMore, 'click', () => {
    if (!vMenu.hidden) { vClose(); return; }
    for (const [m, b] of vItems) { m.hidden = b.hidden; m.setAttribute('aria-checked', String(b.getAttribute('aria-pressed') === 'true')); }
    vMenu.hidden = false; bVMore.setAttribute('aria-expanded', 'true');
    const sh = vShown(); (sh.find((m) => m.getAttribute('aria-checked') === 'true') || sh[0]).focus({ preventScroll: true });
  });
  on(vMenu, 'keydown', (e) => {
    const sh = vShown(), i = sh.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sh[(i + (e.key === 'ArrowDown' ? 1 : sh.length - 1)) % sh.length].focus(); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); sh[e.key === 'Home' ? 0 : sh.length - 1].focus(); }
    else if (e.key === 'Tab') vClose();
  });
  on(document, 'pointerdown', (e) => { if (!vMenu.hidden && !gVM.contains(e.target)) vClose(); }, true);
  // Escape closes only the menu (caught on the window first, before the app's panel or the page's dialog closes on it)
  on(window, 'keydown', (e) => { if (e.key === 'Escape' && !vMenu.hidden) { e.preventDefault(); e.stopImmediatePropagation(); vClose(gVM.contains(document.activeElement)); } }, true);
  const hdbEl = stage.querySelector(':scope>.sp3d-hdb');
  const barFit = () => {
    const w = stage.clientWidth; if (!w) return;
    const tight = w < 760, narrow = w <= 560; // (tight: Compare photo / See countries no longer fit beside the first line)
    stage.classList.add('sp3d-lay'); stage.classList.toggle('sp3d-tight', tight); stage.classList.toggle('sp3d-narrow', narrow);
    if (hdbEl) { if (tight && hdbEl.parentNode !== bar) bar.prepend(hdbEl); else if (!tight && hdbEl.parentNode !== stage) stage.appendChild(hdbEl); }
    stage.style.setProperty('--sp3d-barR', (!tight && hdbEl ? hdbEl.offsetWidth + 20 : 10) + 'px');
    if (!narrow) vClose();
  };
  if (window.ResizeObserver) { const roBar = new ResizeObserver(barFit); roBar.observe(stage); cleanups.push(() => roBar.disconnect()); } else { on(window, 'resize', barFit); setTimeout(barFit, 0); }
  // a camera button stays green while the camera is where it put it; turning or zooming yourself clears it
  let camBtn = null;
  const setCamBtn = (b) => { camBtn = b; for (const q of [bVBody, bVHead, bVTop]) q.setAttribute('aria-pressed', String(q === b)); };
  setCamBtn(null);
  const panel = el('div', 'sp3d-panel'); panel.hidden = true; panel.id = 'sp3d-panel-' + seed; bSet.setAttribute('aria-controls', panel.id);
  const mkCheck = (label, checked) => { const l = el('label', 'sp3d-opt'), c = document.createElement('input'); c.type = 'checkbox'; c.checked = checked; l.append(c, document.createTextNode(' ' + label)); panel.appendChild(l); return c; };
  const cScene = mkCheck('Show surroundings', true);
  // v5.68: no caption under the 3D view (the length and the reconstruction note were a line of text below the snake)
  // v5.50: the buttons live INSIDE the 3D view, like the map's buttons in fullscreen
  stage.appendChild(bar);
  wrap.append(stage, panel);
  host.append(wrap);

  // renderer
  let renderer;
  try {
    // v5.78: multisampling only where pixels are big (at a pixel ratio of 1.75 or more the 4x samples cost about 100 MB of
    // graphics memory and much fill rate for little gain)
    renderer = new THREE.WebGLRenderer({ canvas, antialias: Math.min(window.devicePixelRatio || 1, { high: 2, medium: 1.5, low: 1 }[quality] || 1.5) < 1.75, powerPreference: quality === 'high' ? 'high-performance' : 'default', preserveDrawingBuffer: !!opts.testing });
  } catch (err) { host.innerHTML = ''; throw new Error('webgl'); }
  // v5.78: the pixel ratio has a cap per tier, and drops a little by itself while the view moves if frames come too slowly
  // (dynamic resolution, see frame()); it goes back to full sharpness as soon as the view is still
  const basePR = () => Math.min(window.devicePixelRatio || 1, { high: 2, medium: 1.5, low: 1 }[quality] || 1.5);
  let dynK = 1; renderer.setPixelRatio(basePR());
  renderer.localClippingEnabled = true; // v5.68: See it eat cuts the prey off at the throat (only the part in the open mouth shows)
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.86; // (v5.78: a touch brighter - ACES darkened and dulled the greens and browns of the skin; v5.90: a little lower again (was 0.94) now the sun lights the side we look at - sunlit skins came out washed pale)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = quality === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  const ctx = { renderer, scene: null, track };
  // v6.14: plugins - Day / Night (daynight.js) in every 3D view, and "See the spot" (spot.js: the real place of a sighting)
  const plugs = [DAYNIGHT.plugin].concat(opts.plugins || []).map((f) => { try { return f(V, { group: gReset }) || {}; } catch (e) { console.warn('3D plugin', e); return {}; } });
  V.dayNight = plugs[0]; V.plugs = plugs;
  function plugRun(k, a, b) { let r = false; for (const p of plugs) if (p[k]) { try { if (p[k](a, b)) r = true; } catch (e) { console.warn('3D plugin', k, e); } } return r; }
  let skinGPU = null, snakeGroup, cam, controls, info, extras, raf = 0, dirty = true, lost = false, alive = true, scaleObj = null, markers = [];

  function build() {
    const scene = new THREE.Scene(); ctx.scene = scene;
    { const en = !opts.noEnv && (P.scene.env || envOf(P.scene)); if (en) loadEnv(en).catch(() => {}); } // v4.81: start downloading the panorama now
    let t0 = performance.now();
    // (v5.78: Medium - phones - builds the body and the surroundings as Light does, and keeps High's sharper textures and soft shadows)
    const gq = quality === 'high' ? 'high' : 'low';
    const F = makeBodyFns(P, gq), pose = makePose(P, F, seed); perfT('pose', t0); t0 = performance.now();
    const body = buildBody(P, F, pose, gq); perfT('body', t0); t0 = performance.now();
    // v5.83: the sculpted head (buildHeadSkin: real raised head scales, grooves, nostrils, pits, brow and two jaws) in place
    // of the body's own coarser rings there (not drawn: drawRange); Light keeps the plain head. Its sculpting comes from the
    // pattern worker with the pattern.
    const headSkin = quality !== 'low' ? buildHeadSkin(P, F, body, gq) : null; if (headSkin) { body.headSkin = headSkin; body.geo.setDrawRange(headSkin.drawFrom, Infinity); } perfT('headSkin', t0); t0 = performance.now();
    const lat = scaleLattice(P, body.gTotal), tiles = scaleTextures(P, lat); perfT('scaleTex', t0); t0 = performance.now();
    // v4.81: on good devices a quick pattern first, the full-detail one painted in a worker and swapped in when ready
    const hiPat = quality !== 'low', pat = patternTexture(P, F, body, lat, hiPat ? 'preview' : 'low', seed); perfT('patternTex', t0);
    // v5.53: the scales of the head (on good devices a quick version first; the sharp one comes from the worker with the pattern)
    t0 = performance.now(); let headT = headTex(headData(P, F, hiPat ? 'low' : quality)); perfT('headTex', t0);
    const headAniso = (h) => { for (const t of [h.relief, h.color]) { t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); track(t); } };
    headAniso(headT);
    const rep = body.gTotal / lat.Pt;
    for (const t of [tiles.normal, tiles.cavity]) { t.repeat.set(1, rep); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); }
    pat.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const S = P.scales, gl = S.gloss;
    const mat = new THREE.MeshPhysicalMaterial({
      // v4.72: raised 3D scales - stronger relief, deeper gaps between them, and real bumps on good devices
      map: pat, normalMap: tiles.normal, normalScale: new THREE.Vector2(2.1, 2.1).multiplyScalar(S.relief != null ? S.relief : (S.keel || 0) > 0.3 ? 1.25 : 0.9), // (v5.58: smooth scales lie flatter than keeled ones; v5.90: both a little deeper - at normal viewing distance the scales and keels were lost)
      aoMap: tiles.cavity, aoMapIntensity: 0.3 + 1.2 * (S.cavity != null ? S.cavity : 0.45), roughnessMap: tiles.cavity, // (v5.78: smooth, tightly overlapping scales hide less skin between them)
      ...(quality !== 'high' || P.scales.rows > 40 ? {} : { displacementMap: tiles.cavity, displacementScale: F.w0 * 0.035, displacementBias: -F.w0 * 0.03 }),
      roughness: lerp(0.66, 0.32, gl), metalness: 0, clearcoat: (0.18 + gl * 0.7) * (S.coatK || 1), clearcoatRoughness: lerp(0.32, 0.08, gl), /* (v5.78: glossy snakes get the crisp, mirror-like highlights of real smooth scales; v6.26: a little glossier all round - the coat now breaks up scale by scale (SKIN_SHINE_GLSL), so it never reads as a wet film) */ sheen: S.sheen != null ? S.sheen : 0.04, /* (v5.78: the default sheen laid a grey haze over every skin at grazing angles) */ sheenRoughness: S.sheenRough || 0.7, sheenColor: new THREE.Color(S.sheenColor || '#ffffff').multiplyScalar(S.sheen != null ? 0.6 : 0.12), // velvety skins (Gaboon viper) get a strong sheen
      iridescence: S.iridescence || 0, iridescenceIOR: 1.6, envMapIntensity: 1.0, ior: 1.55, /* (v6.26: keratin) */
    });
    // the cavity map also darkens the skin between scales in direct light (as in real snakes)
    // v4.81: heads without big shields (vipers, pythons, boas) get small scales of their own, drawn in the shader
    // from true distances on the skin, so they keep their shape right to the tip of the snout (the body's scale
    // texture used to stretch into stripes there); they fade out where they would be smaller than a pixel
    const qS = (TAU * F.w0 * 0.92) / Math.max(12, S.rows) * (P.head.scaleK || (P.plan === 'python' ? 0.9 : 0.62));
    // v5.30: the scale rows' edges around the body (for the per-scale variation in the shader)
    const rbArr = new Float32Array(96); lat.RB.forEach((v, i) => { if (i < 96) rbArr[i] = v; });
    const hsU = { uRB: { value: rbArr }, uRows: { value: Math.min(95, lat.R) }, uAV: { value: lat.aV }, uTip: { value: F.Hl * 0.32 }, uHS: { value: new THREE.Vector2(1 / qS, 1 / (qS * 0.82)) }, uKeel: { value: Math.min(1, S.keel || 0) }, uCavH: { value: S.cavity != null ? S.cavity : 0.45 }, uEdgeC: { value: new THREE.Color(S.edge && S.edge.color || '#000000') }, uEdgeK: { value: S.edge ? (S.edge.k != null ? S.edge.k : 0.8) : 0 }, uHeadN: { value: headT.relief }, uHeadC: { value: headT.color }, uHX: { value: headT.Xh }, uRigTex: { value: null }, uRigOn: { value: 0 }, uRigN: { value: 2 }, uRigDx: { value: 1 }, uFill: { value: new THREE.Color(0.3, 0.3, 0.3) }, uBounce: { value: new THREE.Color(0.2, 0.18, 0.15) }, uShLift: { value: 0.2 } /* (v5.90: was 0.4 - cast shadows on the body were washed out; real ones in sun are deep) */, uWrap: { value: 0.35 }, uSSS: { value: new THREE.Color(0.32, 0.12, 0.07) }, uGroundAO: { value: P.scene.kind === 'sea' ? 0 : 1 }, uGloss: { value: new THREE.Vector2(gl, mat.clearcoat) } };
    ctx.skinLight = hsU;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, hsU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aHead;\nvarying float vHead;\nattribute vec3 aMet;\nvarying vec3 vMet;\nattribute vec2 aOcc;\nvarying vec2 vSlOcc;\nvarying float vSlY;' + RIG_GLSL).replace('#include <project_vertex>', '#define SL_RIG_N\nvec3 slP0 = transformed;\n' + RIG_V + 'vSlOcc = vec2(aOcc.x * (1.0 - smoothstep(0.3, 1.5, length(transformed - slP0) / max(aOcc.y, 1e-5))), aOcc.y); vSlY = transformed.y; /* v6.26: the coils\' shading fades where the body has moved away from the pose it was worked out for */\n#include <project_vertex>').replace('#include <uv_vertex>', '#include <uv_vertex>\nvHead = aHead; vMet = aMet;')
        .replace('#include <common>\nattribute float aHead;', '#include <common>\nuniform float uTip;\nattribute float aHead;').replace('#include <displacementmap_vertex>', THREE.ShaderChunk.displacementmap_vertex.replace('displacementScale + displacementBias )', 'displacementScale + displacementBias ) * (1.0 - aMet.z) * (1.0 - aHead) * smoothstep(uTip * 0.45, uTip, aMet.y)'));
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying float vHead; varying vec3 vMet; varying vec2 vSlOcc; varying float vSlY; uniform float uGroundAO; uniform vec2 uGloss; uniform vec2 uHS; uniform float uKeel; uniform float uCavH; uniform float uTip; uniform vec3 uEdgeC; uniform float uEdgeK;
uniform vec3 uFill; uniform vec3 uBounce; uniform float uShLift; uniform float uWrap; uniform vec3 uSSS;
uniform float uRB[96]; uniform int uRows; uniform float uAV; uniform sampler2D uHeadN; uniform sampler2D uHeadC; uniform float uHX;
float slHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float slScale(vec2 m) {
  float row = floor(m.y), off = mod(row, 2.0) * 0.5;
  vec2 l = m - vec2(floor(m.x + off) - off + 0.5, row + 0.5);
  float t = clamp(l.y + 0.5, 0.0, 1.0), wx = 0.52 * (1.0 - 0.4 * t * t), d = (l.x / wx) * (l.x / wx) + (l.y / 0.56) * (l.y / 0.56);
  float h = d < 1.0 ? sqrt(1.0 - d) * 0.55 + 0.45 * t : 0.0;
  return h + (d < 1.0 ? uKeel * 0.32 * exp(-pow(l.x / 0.09, 2.0)) * smoothstep(-0.45, 0.25, l.y) : 0.0);
}`)
        .replace('#include <map_fragment>', `#include <map_fragment>
 float slTip = smoothstep(uTip * 0.45, uTip, vMet.y); /* v5.12: the rounded snout tip (the rostral scale) is smooth skin */
 /* v5.30: no two scales alike - find this point's scale (row around the body, step along it) and give the scale its own
    small shift and size of the relief (an irregular outline), its own relief strength, tilt and shine */
 vec2 slUv = vNormalMapUv; float slStr = 1.0, slRough = 1.0; vec2 slTilt = vec2(0.0);
 float slSpecV = 1.0, slCoatV = 1.0, slBelly = 0.0, slCavV = 1.0; /* v6.26: each scale's own shine (see lights_physical_fragment) */
 { float sa = vNormalMapUv.x * 2.0 - 1.0;
   if (abs(sa) < uAV) {
     int si = 0; float r0 = -uAV, r1 = -uAV;
     for (int q = 0; q < 95; q++) { if (q >= uRows) break; r0 = uRB[q]; r1 = uRB[q + 1]; si = q; if (sa < r1) break; }
     float off = mod(float(si), 2.0) * 0.5, sj = floor(vNormalMapUv.y - off);
     vec2 cid = vec2(float(si), sj); float h1 = slHash(cid), h2 = slHash(cid + 17.3), h3 = slHash(cid + 41.7), h4 = slHash(cid + 73.1);
     vec2 cen = vec2((r0 + r1) * 0.25 + 0.5, sj + off + 0.5), wid = vec2((r1 - r0) * 0.5, 1.0);
     /* v5.58: the variation fades out towards the edges of the scale's cell, so neighbouring cells meet without a step (it
        used to cut each scale's relief along straight lines: a patchwork of light and dark squares) */
     vec2 l0 = (vNormalMapUv - cen) / wid; float slE = (1.0 - smoothstep(0.24, 0.5, abs(l0.x))) * (1.0 - smoothstep(0.24, 0.5, abs(l0.y)));
     vec2 l = l0 * (1.0 + (h3 - 0.5) * 0.12 * slE) + vec2((h1 - 0.5) * 0.08, (h2 - 0.5) * 0.07) * slE;
     slUv = cen + l * wid;
     slStr = mix(1.0, 0.78 + 0.44 * h4, slE); slRough = mix(1.0, 0.8 + 0.4 * h1, slE);
     /* v6.26 (reptile skin): every scale is a small separate plate, tilted its own way - so in any light some scales flash
        and their neighbours do not (it was one even sheen sliding over the body, like clay or plastic) - with its own
        shine, and its own thin coat of gloss (stronger on some, almost none on others: never uniformly wet) */
     slTilt = (vec2(h2, h3) - 0.5) * (0.2 - 0.08 * uKeel) * slE;
     float h5 = slHash(cid + 91.3); slSpecV = mix(1.0, 0.55 + 0.9 * h4 * h4 + 0.2 * h5, slE); slCoatV = mix(1.0, 0.3 + 1.1 * h5, slE);
   } else { float h = slHash(vec2(sign(sa), floor(vNormalMapUv.y))); slStr = 0.85 + 0.3 * h; slRough = 0.78 + 0.2 * h; slBelly = 1.0; slSpecV = 0.9 + 0.25 * h; slCoatV = 0.85 + 0.3 * h; /* the belly's wide plates: smoother, each with its own sheen */
     slTilt = vec2(0.0, (h - 0.5) * 0.12); }
 }
 vec2 slM = vMet.xy * uHS; float slFade = vMet.z * slTip * (1.0 - smoothstep(0.3, 0.75, length(fwidth(slM))));
 float slH = 0.0, slDa = 0.0, slDx = 0.0;
 if (slFade > 0.001) { slH = slScale(slM); slDa = (slScale(slM + vec2(0.03, 0.0)) - slScale(slM - vec2(0.03, 0.0))) / 0.06; slDx = (slScale(slM + vec2(0.0, 0.03)) - slScale(slM - vec2(0.0, 0.03))) / 0.06;
   diffuseColor.rgb *= mix(1.0, 0.55 + 0.45 * smoothstep(0.0, 0.3, slH), uCavH * slFade); }
#ifdef USE_AOMAP
 { vec4 slCv = texture2D(aoMap, slUv); slCavV = slCv.r;
   diffuseColor.rgb *= mix(1.0, slCv.r, uCavH * (1.0 - vHead * 0.9) * (1.0 - vMet.z) * slTip);
   if (uEdgeK > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, uEdgeC, uEdgeK * slCv.b * (1.0 - vHead) * slTip); } /* v5.58: the scales' own dark edges */
#endif
 /* v5.53: the head's own scales - their colours, the dark grooves between them, their shine and relief */
 float slHW = 0.0; vec4 slHN = vec4(0.5, 0.5, 1.0, 0.5);
 if (vMet.y < uHX) {
   float slTopK = 1.0 - abs(vMapUv.x * 2.0 - 1.0); slHW = 1.0 - smoothstep(uHX * (0.64 + 0.11 * slTopK), uHX * (0.8 + 0.1 * slTopK), vMet.y); /* v6.20: a V at the nape */
   vec2 slHUv = vec2(vMapUv.x, vMet.y / uHX); slHN = texture2D(uHeadN, slHUv); vec4 slHC = texture2D(uHeadC, slHUv);
   diffuseColor.rgb = mix(diffuseColor.rgb, slHC.rgb, slHC.a * slHW);
   diffuseColor.rgb *= mix(1.0, slHN.b, slHW);
 }`)
        .replace('#include <aomap_fragment>', THREE.ShaderChunk.aomap_fragment.replace('aoMapIntensity + 1.0', 'aoMapIntensity * slTip * (1.0 - slHW) + 1.0'))
        .replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace('vRoughnessMapUv', 'slUv') + '\n roughnessFactor *= mix(1.0, slRough, (1.0 - vMet.z) * slTip);\n roughnessFactor = mix(roughnessFactor, roughness * (0.9 + 0.25 * slH), vMet.z); roughnessFactor = mix(roughness, roughnessFactor, slTip);\n roughnessFactor = mix(roughnessFactor, max(roughness * 0.85, 0.3) * (0.6 + 0.8 * slHN.a), slHW);')
        .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace(/vNormalMapUv/g, 'slUv').replace('mapN.xy *= normalScale;', 'mapN.xy = mapN.xy * mix(1.0, slStr, 1.0 - vMet.z) + slTilt * (1.0 - vMet.z) * slTip;\n mapN.xy *= normalScale * (1.0 - vHead * 0.88) * slTip;\n { vec2 mp = vec2(vNormalMapUv.x * float(uRows) * 6.0, vNormalMapUv.y * 7.0); float mf = (1.0 - smoothstep(0.2, 0.5, length(fwidth(mp)))) * (1.0 - vHead) * (1.0 - vMet.z) * slTip; /* v6.26: the fine micro-relief on each scale, seen only up close (it breaks a highlight into a glint) */\n   mapN.xy += mf * 0.07 * vec2(sin(mp.x * 6.2832 + 3.0 * sin(mp.y * 2.1)), sin(mp.y * 6.2832 + 2.0 * sin(mp.x * 1.7))); }\n mapN = normalize(mix(mapN, normalize(vec3(-slDa * 0.55, -slDx * 0.55, 1.0)), vMet.z));\n mapN = normalize(mix(vec3(0.0, 0.0, 1.0), mapN, smoothstep(uTip * 0.5, uTip * 1.6, vMet.y))); /* v5.17: the scale relief fans out into a star on the rounded nose: none there */').replace('normal = normalize( tbn * mapN );', 'normal = normalize( tbn * mapN );\n if (slHW > 0.0) { vec2 hn = slHN.xy * 2.0 - 1.0; vec3 hT = tbn[0], hB = tbn[1]; float lT = length(hT), lB = length(hB);\n   if (lT > 1e-6 && lB > 1e-6) { vec3 nH = normalize(hT / lT * hn.x + hB / lB * hn.y + nonPerturbedNormal * sqrt(max(0.0, 1.0 - dot(hn, hn)))); normal = normalize(mix(normal, nH, slHW)); } }'))
        .replace('#include <clearcoat_normal_fragment_begin>', '#ifdef USE_CLEARCOAT\n vec3 clearcoatNormal = normalize(mix(nonPerturbedNormal, normal, max(0.75 * slHW, 0.85 * slTip * (1.0 - vHead) * (1.0 - vMet.z)))); /* v5.99: the gloss breaks up scale by scale (each overlapping scale its own little mirror), not one smooth streak down the body */\n#endif')
        .replace('#include <lights_fragment_end>', SKIN_LIGHT_GLSL + SKIN_OCC_GLSL).replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\n material.clearcoat *= 1.0 - 0.2 * slHW; material.clearcoatRoughness = mix(material.clearcoatRoughness, max(material.clearcoatRoughness, 0.16), slHW);\n#endif\n' + SKIN_SHINE_GLSL);
    };
    mat.customProgramCacheKey = () => 'sl-skin-v626';
    const mesh = new THREE.Mesh(body.geo, mat); mesh.castShadow = mesh.receiveShadow = true;
    // v5.78: the bending on the graphics card (RIG_GLSL): the shadow pass bends the same way, and while posed the body is
    // never culled by its rest-pose bounds, and clicks and zooming meet it where it is now (its chain of spheres)
    // (the shadow pass also takes the skin's scale displacement, exactly as the skin does - without it the displaced skin lay
    // a little inside its own shadow caster: a dark band round the neck and speckled self-shadowing)
    { const depthM = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, displacementMap: mat.displacementMap || null, displacementScale: mat.displacementScale, displacementBias: mat.displacementBias });
      depthM.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, { uRigTex: hsU.uRigTex, uRigOn: hsU.uRigOn, uRigN: hsU.uRigN, uRigDx: hsU.uRigDx, uTip: hsU.uTip });
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aMet;\nattribute float aHead;\nuniform float uTip;' + RIG_GLSL).replace('#include <project_vertex>', RIG_V + '#include <project_vertex>')
          .replace('#include <displacementmap_vertex>', THREE.ShaderChunk.displacementmap_vertex.replace('displacementScale + displacementBias )', 'displacementScale + displacementBias ) * (1.0 - aMet.z) * (1.0 - aHead) * smoothstep(uTip * 0.45, uTip, aMet.y)')); };
      depthM.customProgramCacheKey = () => 'sl-skin-depth-v578'; mesh.customDepthMaterial = depthM;
      let tex = null, data = null, live = null, N = 0;
      const invM = new THREE.Matrix4(), lRay = new THREE.Ray();
      mesh.raycast = (rc, hits) => { invM.copy(mesh.matrixWorld).invert(); lRay.copy(rc.ray).applyMatrix4(invM); const p = raySnake(lRay); if (p) { p.applyMatrix4(mesh.matrixWorld); const d = p.distanceTo(rc.ray.origin); if (d >= rc.near && d <= rc.far) hits.push({ distance: d, point: p, object: mesh }); } };
      skinGPU = {
        init(n, dx, rc, rT, rU, rS, hb) {
          if (!renderer.capabilities.isWebGL2 && !renderer.extensions.get('OES_texture_float')) return false;
          N = n; data = new Float32Array(N * 8 * 4);
          const row = (r, arr, wArr) => { for (let i = 0; i < N; i++) { const o = (r * N + i) * 4; data[o] = arr[i * 3]; data[o + 1] = arr[i * 3 + 1]; data[o + 2] = arr[i * 3 + 2]; data[o + 3] = wArr ? wArr[i] : 1; } };
          row(0, rc, hb); row(1, rT); row(2, rU); row(3, rS); row(4, rc); row(5, rT); row(6, rU); row(7, rS);
          if (tex) tex.dispose();
          tex = track(new THREE.DataTexture(data, N, 8, THREE.RGBAFormat, THREE.FloatType)); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
          hsU.uRigTex.value = tex; hsU.uRigN.value = N; hsU.uRigDx.value = dx; return true;
        },
        upload(nc, nT, nU, nS, bul) {
          if (!data) return;
          for (let i = 0; i < N; i++) { const i3 = i * 3; for (const [r, a] of [[4, nc], [5, nT], [6, nU], [7, nS]]) { const o = (r * N + i) * 4; data[o] = a[i3]; data[o + 1] = a[i3 + 1]; data[o + 2] = a[i3 + 2]; } data[(4 * N + i) * 4 + 3] = bul ? bul[i] : 1; }
          tex.needsUpdate = true; hsU.uRigOn.value = 1; mesh.frustumCulled = false; live = nc;
        },
        off() { hsU.uRigOn.value = 0; mesh.frustumCulled = true; live = null; },
        get on() { return !!live; },
      };
    }
    if (hiPat) {
      const sceneNow = ctx.scene, swap = (d) => { if (!alive || ctx.scene !== sceneNow) return; const t = patternTex(d); t.anisotropy = pat.anisotropy; mat.map = t; pat.dispose(); track(t);
        if (d.head) { const h = headTex(d.head); headAniso(h); hsU.uHeadN.value = h.relief; hsU.uHeadC.value = h.color; headT.relief.dispose(); headT.color.dispose(); headT = h; }
        if (d.headH && headSkin) headSkin.setHeights(d.headH);
        dirty = true; kick(); };
      const hsq = headSkin ? { xCut: headSkin.grid.xCut, M: body.M, hi: gq === 'high' } : null;
      ctx.patternReady = patternInWorker(P, quality, seed, hsq).then(swap).catch(() => new Promise((r) => setTimeout(() => { if (alive && ctx.scene === sceneNow) { const d = patternData(P, F, body, lat, quality, seed); d.head = headData(P, F, quality); if (headSkin) d.headH = headSkinHeights(P, F, headSkin.grid); swap(d); } r(); }, 60)));
    } else ctx.patternReady = Promise.resolve();
    snakeGroup = new THREE.Group(); snakeGroup.add(mesh);
    // v5.83: the sculpted head (buildHeadSkin: real raised head scales, grooves, nostrils, pits, brow and two jaws) in place
    // of the body's own coarser rings there (not drawn: drawRange); Light keeps the plain head
    if (headSkin) {
      const hm = new THREE.Mesh(headSkin.geo, mat); hm.name = 'headSkin'; hm.castShadow = hm.receiveShadow = true; hm.customDepthMaterial = mesh.customDepthMaterial;
      hm.frustumCulled = false; hm.userData.noRig = true; hm.userData.headSkin = true; hm.raycast = () => {}; snakeGroup.add(hm);
    }

    // eyes (v4.81: domed eyes sunk flush into sockets, under a clear spectacle scale; see buildEyes)
    const H = P.head, eyePos = [], eyeMeshes = H.pupil !== 'none' ? buildEyes(P, F, body, pat) : [];
    for (const m of eyeMeshes) { snakeGroup.add(m); eyePos.push(m.position.clone()); }
    // horns, rattle
    const keratin = new THREE.MeshStandardMaterial({ color: P.tail.rattleColor || '#b8a589', roughness: 0.55 });
    // v4.81: horns are scales of the upper jaw - they go up with it when the mouth opens (headParts -> buildMouth)
    const headParts = [], hornM = new THREE.MeshStandardMaterial({ color: P.head.hornColor || P.colors.dorsal, roughness: 0.75 });
    const hornGeo = (r, h) => { const g = new THREE.ConeGeometry(r, h, 14, 4); g.translate(0, h / 2, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h, k = Math.pow(1 - y, 0.6) / Math.max(1e-3, 1 - y); if (y < 0.999) { p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } } g.computeVertexNormals(); return g; };
    if (H.horns === 'nasal') {
      for (const sg of [1, -1]) { const x = F.Hl * 0.06, th = sg * 0.32, s = body.surf(x, th), hh = F.W(x) * 0.55; const m = new THREE.Mesh(hornGeo(hh * 0.26, hh), hornM); m.position.copy(s.p).addScaledVector(s.f.U, -hh * 0.12); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), s.f.U.clone().addScaledVector(s.f.T, -0.5).normalize()); m.castShadow = true; snakeGroup.add(m); headParts.push(m); }
    }
    if (H.horns === 'supraocular') {
      for (const sg of [1, -1]) { const x = H.eyeX * F.Hl, th = sg * (body.eyeA - 0.55), s = body.surf(x, th), hh = F.W(x) * 0.42; const m = new THREE.Mesh(hornGeo(hh * 0.3, hh), hornM); m.position.copy(s.p).addScaledVector(s.f.U, -hh * 0.1); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), s.f.U.clone().addScaledVector(s.f.S, sg * 0.45).addScaledVector(s.f.T, 0.25).normalize()); m.castShadow = true; snakeGroup.add(m); headParts.push(m); }
    }
    // v5.62 (model accuracy): the tentacled snake's two soft scaly tentacles on the snout, the single nose horn of the
    // nose-horned viper, and the long flat nasal appendage of the leaf-nosed snakes (Langaha): hornLen in head lengths
    if (H.horns === 'tentacles') {
      for (const sg of [1, -1]) { const x = F.Hl * 0.035, s = body.surf(x, sg * 0.42), hh = F.Hl * (H.hornLen || 0.22); const m = new THREE.Mesh(hornGeo(hh * 0.16, hh), hornM); m.position.copy(s.p).addScaledVector(s.f.T, hh * 0.05); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), s.f.T.clone().negate().addScaledVector(s.f.S, sg * 0.55).addScaledVector(s.f.U, 0.15).normalize()); m.castShadow = true; snakeGroup.add(m); headParts.push(m); }
    }
    if (H.horns === 'rostral') {
      const x = F.Hl * 0.03, s = body.surf(x, 0), hh = F.Hl * (H.hornLen || 0.25), up = H.hornUp != null ? H.hornUp : 0.9, g = hornGeo(hh * (H.hornFlat ? 0.2 : 0.17), hh);
      if (H.hornFlat) g.scale(1, 1, H.hornFlat); // (a flat blade, wide side to side - Langaha)
      const m = new THREE.Mesh(g, hornM); m.position.copy(s.p).addScaledVector(s.f.U, -hh * 0.06); const dir = s.f.T.clone().negate().addScaledVector(s.f.U, up).normalize();
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); m.castShadow = true; snakeGroup.add(m); headParts.push(m);
    }
    if (P.tail.rattle) {
      const n = P.tail.rattle, f = body.frameAt(F.L), c = body.spine(F.L), w = F.W(F.L * 0.999) * 1.15;
      let off = -w * 0.25;
      for (let i = 0; i < n; i++) {
        const k = 1 - i * 0.035, sw = w * k, len = sw * 0.95;
        const g = new THREE.SphereGeometry(1, 20, 12); g.scale(len * 0.62, sw * 1.3, sw * 0.95);
        const m = new THREE.Mesh(g, keratin); m.position.copy(c).addScaledVector(f.T, off + len * 0.5);
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.T, f.U, f.S)); m.castShadow = m.receiveShadow = true; snakeGroup.add(m); off += len * 0.62;
      }
    }

    let tree = null; // v5.68: tree snakes are up in a tree
    const perchTree = (kind, old) => { if (NATURE.perchTree) { try { return NATURE.perchTree(THREE, { kind, P, F, pose, seed, quality, spine: (x) => body.spine(x) }); } catch (e) { console.warn('perchTree', e); } } return old(); }; // v5.78: a real tree (nature.js)
    if (pose.perch) snakeGroup.add(tree = perchTree('branch', () => addBranch(P, F, pose, seed)));
    if (P.tail.spine) { const f = body.frameAt(F.L), c = body.spine(F.L), r = F.w0 * 0.14, g = new THREE.ConeGeometry(r, r * 3, 8); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#6a5246', roughness: 0.5 })); m.position.copy(c).addScaledVector(f.T, r * 1.2); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), f.T); snakeGroup.add(m); }
    // bounds
    if (tree) snakeGroup.remove(tree); // (the view frames the snake, not the whole tree)
    const bb = new THREE.Box3().setFromObject(snakeGroup), bb0 = bb.clone(), size = bb.getSize(new THREE.Vector3()), center = bb.getCenter(new THREE.Vector3());
    if (tree) snakeGroup.add(tree);
    if (pose.drape) snakeGroup.add(tree = perchTree('drape', () => addDrapeBranch(P, F, pose, seed))); // v5.62 (after the bounds: the view frames the snake, not the whole branch)
    const Rb = Math.max(size.x, size.z) / 2 * 1.05 + F.w0;
    const hMax = bb.max.y;
    const poseInfo = { pts: pose.pts, ds: pose.ds, Ly: pose.Ly, radius: Rb, envR: P.length >= 0.4 ? Rb + 1.0 : Rb * 1.3, seaLevel: F.Hh(F.L * 0.5) * F.bf * Math.max(P.scene.float || 1.55, 1.45) }; // (v6.26: at least 1.45 - about two thirds of the body under the surface, only the back and head breaking it, as a resting sea snake lies; at 1.1, and the 0.3 some profiles had, it lay on the water like a toy)
    // water side for riverbank: the side of the snake with most open space
    if (sceneOf(P.scene).water === 'river') { let best = 0, bd = -1; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; let m = -1e9; for (const p of pose.pts) m = Math.max(m, p[0] * Math.cos(a) + p[1] * Math.sin(a)); if (bd < 0 || m < bd) { bd = m; best = a; } } poseInfo.waterDir = best; poseInfo.waterDist = bd + F.w0 * 2.5 + Rb * 0.12; }
    scene.add(snakeGroup);
    if (P.scene.kind !== 'sea') scene.add(contactShadow(poseInfo, F, Rb));
    ctx.natureReady = null; ctx.afterNature = () => { if (!cScene.checked) setSceneVisible(false); dirty = true; shadowDirty = true; kick(); };
    t0 = performance.now(); buildScene(ctx, P, F, body, poseInfo, seed, gq); perfT('scene', t0);
    if (!cScene.checked) setSceneVisible(false);
    // the photographic surroundings arrive a moment later (cached after the first time)
    const envName = P.scene.env || envOf(P.scene), myScene = scene;
    ctx.envReady = envName && !opts.noEnv ? loadEnv(envName).then((env) => {
      if (!alive || ctx.scene !== myScene) return false;
      const tE = performance.now(); env.name = envName; applyEnv(ctx, P, F, poseInfo, env); perfT('applyEnv', tE); if (!cScene.checked) setSceneVisible(false); dirty = true; shadowDirty = true; kick(); return true;
    }).catch(() => false) : Promise.resolve(false);
    // v5.78: nothing is drawn behind the loading cover (each hidden frame used to cost a full render with shadows while the
    // pattern, the plants and the sky were still being made); once all is ready the shaders are compiled in the background
    // (compileAsync: the browser compiles them off the main thread where it can), then the first picture is drawn
    holdRender = true; const sceneB = scene;
    ctx.envReady = Promise.all([ctx.envReady, ctx.natureReady, ctx.patternReady]).then((r) => {
      const go = () => { if (ctx.scene === sceneB) { holdRender = false; kick(); } return r[0]; };
      if (!renderer.compileAsync || !cam || ctx.scene !== sceneB || !renderer.extensions.has('KHR_parallel_shader_compile')) return go();
      return Promise.race([renderer.compileAsync(ctx.scene, cam).catch(() => {}), new Promise((res) => setTimeout(res, 5000))]).then(go);
    }).catch(() => { if (ctx.scene === sceneB) { holdRender = false; kick(); } return false; }); // (tests wait for everything)
    { const pr = ctx.envReady; busyFor = pr; busyShow(); pr.finally(() => busyHide(pr)); }

    const headPos = body.surf(F.Hl * 0.45, 0).p;
    const headDir = body.frameAt(F.Hl * 0.5).T.clone().negate(); // pointing out of the snout
    // main body axis (for the side view): principal direction of the footprint
    let sxx = 0, szz = 0, sxz = 0; for (const p of pose.pts) { sxx += p[0] * p[0]; szz += p[1] * p[1]; sxz += p[0] * p[1]; }
    const axisAng = 0.5 * Math.atan2(2 * sxz, sxx - szz);
    const up = !!(pose.drape || pose.perch);
    info = { F, body, tree, center: new THREE.Vector3(center.x, up ? center.y : Math.min(center.y, hMax * 0.5), center.z), Rb, hMax: up ? hMax - bb0.min.y : hMax, raised: pose.raised, drapeAz: pose.drape ? Math.atan2(-(pose.drape.b[1] - pose.drape.a[1]), pose.drape.b[0] - pose.drape.a[0]) + 0.45 : null, headPos, headDir, axisAng, eyePos, size };
    // v5.90: the sun stands high (40-60 degrees) and about 50 degrees to one side of the first view, as in a good field
    // photo: never flat from the front, from behind or from low down, so the body is modelled by light and shade and the
    // scales glint along the lit side (the panorama is turned to match in applyEnv)
    { const az = viewAz('default'); ctx.sunAz = Math.atan2(Math.cos(az), Math.sin(az)) + SUN_SIDE; placeSun(ctx, ctx.sunAz, (sceneOf(P.scene).sunEl * Math.PI) / 180); }
    info.collide = []; for (let i = 0, n = 240; i <= n; i++) { const x = (i / n) * F.L; info.collide.push({ p: body.spine(x), r: Math.max(F.W(x), F.Hh(x)) * 1.05 }); }
    t0 = performance.now();
    extras = { mat, eyes: eyeMeshes, mouth: P.plan === 'blind' ? null : buildMouth(P, F, body, snakeGroup, eyeMeshes.concat(headParts), pat) }; perfT('mouth', t0);
    bAnat.hidden = !extras.mouth;
    if (bAnat.getAttribute('aria-pressed') === 'true') { bAnat.setAttribute('aria-pressed', 'false'); markers.filter((m) => m.anat).forEach((m) => m.el.remove()); markers = markers.filter((m) => !m.anat); }
    if (bMouth) { bMouth.hidden = !extras.mouth; mouthGoal = 0; bMouth.setAttribute('aria-pressed', 'false'); bMouth.textContent = 'Open mouth'; }
    // camera
    cam = new THREE.PerspectiveCamera(38, 1, Rb * 0.001, Rb * 40);
    if (!controls) {
      controls = Controls(canvas, cam, {
        reduce, maxEl: (80 * Math.PI) / 180,
        minEl: (d) => { const near = sstep(info.dFit * 0.6, Math.max(info.dMin * 2, info.F.Hl * 4), d); return Math.max(lerp(8, 2, near) * Math.PI / 180, Math.asin(clamp((lerp(info.hMax * 1.3, info.F.w0 * 0.6, near) - targetFor(d).y) / d, 0, 0.95))); }, // v5.05: close up you can look from the side (at the eyes, the mouth, the organs)
        dMin: () => info.dMin, dMax: () => info.dMax * Math.max(sizeBusy() ? info.scaleK : 1, fx.zoomOut), kick: () => kick(), reset: () => { if (fx.slitherHome) fx.slitherHome(true); setCamBtn(null); if (sizeSt.on) sizeFrame(); else resetView(); }, // (R: like Reset)
        panMax: () => Math.max(info.Rb * 1.4, (fx.reach || 0) * 1.1), // you can fly around the snake, never away from it
        locked: () => fx.locked,
        user: () => { if (camBtn) setCamBtn(null); }, // v5.74: you moved the camera yourself: no camera button is lit any more
        // v5.12: zooming goes towards the part of the snake under the pointer (or between the fingers); the point it zooms
        // to is always on the snake, so you can never zoom away from it or lose it
        pointZoom: (cx, cy, f, now) => {
          const st = controls.st, d0 = st.goal ? st.goal.d : st.d, d = clamp(d0 * f, info.dMin, info.dMax * Math.max(sizeBusy() ? info.scaleK : 1, fx.zoomOut));
          if (Math.abs(d - d0) < 1e-9) return true;
          const r = canvas.getBoundingClientRect(), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), cam);
          // (v5.78: the ray meets the body's chain of spheres, not its 200 000 triangles - that raycast took tens of
          // milliseconds on every turn of the wheel and made zooming stutter)
          let p = raySnake(ray.ray, snakeGroup.scale.x);
          if (!p) { const t = -ray.ray.origin.y / (ray.ray.direction.y || -1e-6); if (t > 0) p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t); }
          if (!p) return false;
          // the nearest point of the snake to it (zooming in on bare ground homes in on the snake instead)
          const list = (fx.collide && fx.collide()) || info.collide; let best = null, bd = 1e18; for (const c of list) { const q = p.distanceTo(c.p) - c.r; if (q < bd) { bd = q; best = c; } }
          if (best && bd > info.F.w0 * 2) p = best.p.clone();
          const gpx = st.goal ? st.goal.px : st.px, gpz = st.goal ? st.goal.pz : st.pz, T = targetFor(d0); T.x += gpx - st.px; T.z += gpz - st.pz; // (where the camera is heading, not where it is mid-glide)
          const k = 1 - d / d0, Tn = T.clone().lerp(p, f < 1 ? k : 0);
          const b = targetFor(d); b.x -= st.px; b.z -= st.pz; // (the target at that distance, without any panning)
          let px = Tn.x - b.x, pz = Tn.z - b.z;
          if (f > 1) { const g = Math.pow(d0 / d, 2); px = gpx * g; pz = gpz * g; } // zooming out drifts back to the whole snake
          if (now) { st.d = d; st.px = px; st.pz = pz; if (st.goal) Object.assign(st.goal, { d, px, pz }); kick(); }
          else controls.setGoal({ d, px, pz, az: st.goal ? st.goal.az : st.az, el: st.goal ? st.goal.el : st.el });
          return true;
        },
      });
    }
    fitLimits();
    resetView(true);
    if (bDet.getAttribute('aria-pressed') === 'true') buildMarkers();
    plugRun('onBuild'); // v6.14
    shadowDirty = true; kick();
  }
  function setSceneVisible(v) { if (!ctx.scene) return; (ctx.occ || []).forEach((o) => { if (o.hid) { o.hid = false; if (o.im) { o.im.setMatrixAt(o.i, o.m); o.im.instanceMatrix.needsUpdate = true; } } }); ctx.scene.traverse((o) => { if (o !== ctx.scene && o.parent === ctx.scene && o !== snakeGroup && !o.isLight && o !== scaleObj) o.visible = v; }); shadowDirty = true; kick(); }

  function fitLimits() {
    const r = Math.max(info.Rb, info.hMax * (P.pose && P.pose.kind === 'drape' ? 1.3 : 0.8)), asp = Math.max(0.4, (stage.clientWidth || 1) / (stage.clientHeight || 1)); // (v5.62: a raised cobra or a snake up on a branch is taller than it is wide)
    const vf = (cam.fov * Math.PI) / 360, hf = Math.atan(Math.tan(vf) * asp);
    info.portrait = asp < 0.8; info.vf = vf; info.hf = hf;
    // the snake lies flat: fit its footprint across the view, and its foreshortened depth (seen from above at an angle) up and down
    info.dFit = Math.max((r * (info.portrait ? 0.98 : 1.2)) / Math.tan(hf), (r * (info.portrait ? 0.8 : 0.66)) / Math.tan(vf)) + r * 0.4; // (v6.20: a little more room round the snake - its head was often right at the edge of the first view)
    info.dMax = info.dFit * 1.55;
    info.dMin = Math.max(info.F.Hl * 0.9, info.F.w0 * 1.6); // v5.05: zoom right in (organs, eyes and scales up close)
    info.scaleK = 1;
    plugRun('limits', info); // v6.14: See the spot zooms out over the real place
  }
  function targetFor(d) {
    // zooming in moves the point you orbit around from the middle of the snake to its head
    const fp = fx.focusPoint && fx.focusPoint(), k = sstep(info.dFit * 0.75, Math.max(info.dMin * 1.2, info.F.Hl * 3.8), d), t = info.center.clone().lerp(fp || info.headPos, k);
    if (controls) { t.x += controls.st.px; t.z += controls.st.pz; }
    const sk = sizeBusy() ? skNow() : 0; // v5.74: Size vs person looks at the snake and the person together (blended in and out with the glide)
    if (sk > 0) { const s2 = sizeSt.tgt.clone(); if (controls) { s2.x += controls.st.px; s2.z += controls.st.pz; } t.lerp(s2, sk); }
    return t;
  }
  function viewAz(kind) {
    const hd = info.headDir; const a = Math.atan2(hd.x, hd.z);
    if (kind === 'front') return a; if (kind === 'side') return -info.axisAng + Math.PI / 2; if (info.drapeAz != null) return info.drapeAz; /* (v5.62: a draped snake is seen across its branch, the loops hanging on both sides) */ return a + (info.raised ? 0.5 : 0.9); // (v5.62: a raised cobra is seen nearly from the front, its hood spread toward you)
  }
  function resetGoal() { const g = { az: viewAz('default'), el: ((info.tree ? (info.portrait ? 20 : 12) : info.portrait ? 40 : 30) * Math.PI) / 180, d: info.dFit * (P.pose && P.pose.kind === 'branch' ? 1.05 : 1), px: 0, pz: 0 }; return headInView(g); }
  // v5.83: the first view always shows the head. A coiled snake (rattlesnakes, vipers resting in a pile) often lay with its
  // head down inside the coil on the far side, hidden behind the near turns: try other directions round it (and a little
  // higher) until the line from the camera to the head is clear of the body
  function headInView(g) {
    const F = info.F, B = info.body, list = info.collide, n = list.length - 1, d0 = new THREE.Vector3(), hd = info.headDir;
    const pts = [B.surf(F.Hl * 0.03, 0).p, B.surf(F.Hl * P.head.eyeX, B.eyeA).p, B.surf(F.Hl * P.head.eyeX, -B.eyeA).p]; // (the snout and the two eyes)
    const seen = (c, hp, skip) => { const dir = d0.subVectors(hp, c), len = dir.length(); dir.divideScalar(len);
      for (let i = 0; i <= n; i++) { if ((i / n) * F.L < F.Hl * skip) continue; const q = list[i], v = q.p.clone().sub(c), tc = v.dot(dir); if (tc <= 0 || tc >= len) continue; if (v.lengthSq() - tc * tc < q.r * q.r) return false; } return true; };
    const clear = (az, el) => {
      const t = info.center.clone(), c = new THREE.Vector3(t.x + g.d * Math.cos(el) * Math.sin(az), t.y + g.d * Math.sin(el), t.z + g.d * Math.cos(el) * Math.cos(az));
      if (c.clone().sub(pts[0]).normalize().dot(hd) < -0.2) return false; // (seen from in front or the side, not from behind)
      return seen(c, pts[0], 1.6) && (seen(c, pts[1], 1.6) || seen(c, pts[2], 1.6));
    };
    if (clear(g.az, g.el)) return g;
    for (const del of [0, 10, 22]) for (const da of [0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 1.9, -1.9, 2.5, -2.5, Math.PI]) { const el = g.el + (del * Math.PI) / 180; if (del === 0 && !da) continue; if (clear(g.az + da, el)) return Object.assign(g, { az: g.az + da, el }); }
    return Object.assign(g, { el: g.el + (22 * Math.PI) / 180 });
  }
  function resetView(instant) { if (!instant && fx.resetView && fx.resetView()) return; if (instant) controls.setGoal(resetGoal(), true); else controls.tween(resetGoal(), 1000); } // (v5.74: an eased glide) // (v5.68: a snake up in a tree is seen from nearly level, so the trunk and the drop below show) // (v5.35: thread-thin tree snakes start closer, head in view)
  function setView(kind) {
    if (kind === 'front') controls.setGoal({ az: viewAz('front'), el: (14 * Math.PI) / 180, d: Math.max(info.dMin * 1.6, info.dFit * 0.42) });
    else if (kind === 'side') controls.setGoal({ az: viewAz('side'), el: (12 * Math.PI) / 180, d: info.dFit * 1.0 });
    else controls.setGoal({ az: controls.st.az, el: (80 * Math.PI) / 180, d: (info.Rb * 1.12) / Math.tan(Math.min(info.vf, info.hf)) + info.hMax });
  }

  // the camera never enters the body: its distance to the body's centre line must exceed the body's
  // half-thickness there plus a margin for the near plane; if not, it backs away along its line of sight
  function bodyClearance(p) {
    const list = colList || (colList = (fx.collide && fx.collide()) || info.collide); // (v5.78: once per frame, not up to 40 times)
    let m = 1e9; for (const c of list) { const d = p.distanceTo(c.p) - c.r; if (d < m) m = d; } return m;
  }
  // the nearest point where a ray meets the snake's body, as a chain of spheres along its centre line (posed or at rest)
  const rsV = new THREE.Vector3();
  function raySnake(r, k = 1) {
    const list = colList || (colList = (fx.collide && fx.collide()) || info.collide); let best = Infinity;
    for (const c of list) { rsV.subVectors(c.p, r.origin); const tc = rsV.dot(r.direction), d2 = rsV.lengthSq() - tc * tc, rr = c.r * k * 0.95; if (d2 > rr * rr) continue; const t = tc - Math.sqrt(rr * rr - d2); if (t > 0 && t < best) best = t; }
    return best < Infinity ? r.origin.clone().addScaledVector(r.direction, best) : null;
  }
  function placeCamera() {
    const st = controls.st;
    let t = targetFor(st.d);
    const put = () => cam.position.set(t.x + st.d * Math.cos(st.el) * Math.sin(st.az), t.y + st.d * Math.sin(st.el), t.z + st.d * Math.cos(st.el) * Math.cos(st.az));
    put();
    for (let k = 0; k < 40 && bodyClearance(cam.position) < Math.min(st.d * 0.06, info.F.w0 * 0.25); k++) { st.d = Math.min(st.d * 1.05, info.dMax); if (st.goal && st.goal.d < st.d) st.goal.d = st.d; t = targetFor(st.d); put(); if (st.d >= info.dMax) break; }
    if (NATURE.AMB && NATURE.AMB.uNear) NATURE.AMB.uNear.value = clamp(st.d * 0.55, 0.04, 1.4); // (v6.00: grass in the first half of the way to the snake bows down out of the lens's way, smoothly by its distance from it: no blade fills the view, none pops)
    cam.near = Math.max(Math.min(st.d * 0.02, Math.max(1e-4, bodyClearance(cam.position) * 0.5)), 1e-4); cam.far = Math.max(info.Rb * 40, 300); cam.updateProjectionMatrix(); cam.lookAt(t);
    // v4.72: the haze begins beyond the snake from wherever you look, never on it
    const fog = ctx.scene && ctx.scene.fog; if (fog && ctx.fogNear0 != null) { fog.near = Math.max(ctx.fogNear0, st.d * 1.6); fog.far = Math.max((ctx.farR || 60) * 0.95, fog.near * 3); }
    plugRun('camera', cam, t); // v6.14
  }
  function resize() {
    const w = stage.clientWidth || 300, h = stage.clientHeight || 200;
    renderer.setSize(w, h, false); if (cam) { cam.aspect = w / h; cam.updateProjectionMatrix(); fitLimits(); controls && (controls.st.d = clamp(controls.st.d, info.dMin, controls.st.goal ? 1e9 : info.dMax * Math.max(sizeBusy() ? info.scaleK : 1, fx.zoomOut))); }
    kick();
  }
  function frame() {
    raf = 0; kicked = false; if (!alive || lost || !cam) return;
    if (document.hidden || !host.isConnected || host.offsetParent === null && !document.fullscreenElement) { dirty = true; return; } // paused while hidden
    if (holdRender) return; // (still loading: see build)
    const tF0 = performance.now(); colList = null;
    const camMoving = controls.update(); let moving = false;
    // v5.73: wind, water and the snake's idle life run on a clock of their own (no motion at all with reduced motion)
    const amb = !reduce(); if (NATURE.tick) { NATURE.tick(performance.now() / 1000); NATURE.AMB.uWind.value = amb && cScene.checked ? (quality === 'low' ? 0.6 : 1) : 0; if (NATURE.AMB.uDens) { const u = NATURE.AMB.uDens, dd = pace.dens - u.value; u.value = Math.abs(dd) < 0.004 ? pace.dens : u.value + dd * 0.05; } } // (v6.00: the far plants thin out and come back gradually, never in one step)
    // the jaw opens and shuts smoothly
    const mo = extras && extras.mouth;
    // (v5.78: eased, and timed by the clock - not a fixed step per frame - so it opens at the same smooth pace at any frame rate)
    if (mo && Math.abs(mo.t - mouthGoal) > 1e-3) { const dtm = clamp((tF0 - (lastF || tF0)) / 1000, 1 / 240, 0.1), nt = reduce() ? mouthGoal : mo.t + clamp(mouthGoal - mo.t, -dtm * 2.2, dtm * 2.2) * (0.35 + 0.65 * sstep(0, 0.35, Math.abs(mouthGoal - mo.t))); mo.set(Math.abs(nt - mouthGoal) < 2e-3 ? mouthGoal : nt); if (Math.abs(mo.t - mouthGoal) <= 1e-3) mo.settle(); moving = true; }
    if (fx.step()) moving = true; // v4.81: slithering, the shows (they may move the jaw and bend the body)
    if (sizeStep()) moving = true; // v5.74: Size vs person: the snake's scale, the person fading in or out
    const sceneMoving = moving; moving = moving || camMoving; // (anything but the camera moved: the shadows must follow)
    placeCamera();
    if (plugRun('frame')) moving = true; // v6.14: Day / Night's blend, See the spot
    if (fx.camera()) moving = true; // a show moves the camera by itself
    if (opts.testing && window.__sp3dCam) { const o = window.__sp3dCam; cam.position.copy(o.pos); cam.near = o.near || cam.near; cam.updateProjectionMatrix(); cam.lookAt(o.tgt); } // (tests: a fixed camera)
    updateOccluders();
    // (v5.73: frames that only move leaves and water reuse the shadows; v5.78: so do frames where only the camera moves - turning
    // or zooming used to redraw the whole shadow map every frame)
    const viaAmb = ambOnly; if (viaAmb) paceMeasure(tF0);
    // (v6.20: while the camera turns, the shadows of the swaying plants are not refreshed every few frames either: those
    // refreshes made every 5th frame of a turn much slower than the others - a regular stutter - for a change nobody sees
    // while the view moves; and a tongue flick alone (fx.lightMove) never redraws them: its shadow is a few pixels)
    // (while you turn the view, the snake's own small idle movements redraw the shadows every third frame, not every frame)
    // (and a frame in the middle of a turn that happens to get no pointer movement - a 120 Hz screen with a 60 Hz mouse, or
    // a finger held still for a moment - still counts as turning: it used to redraw the shadows, every other frame)
    const scMove = sceneMoving && !(fx.lightMove && fx.lightMove());
    if (camMoving) lastCamT = tF0;
    const camActive = camMoving || controls.st.dragging || tF0 - lastCamT < 250;
    if (camActive && !camMoving) { clearTimeout(camSettleT); camSettleT = setTimeout(() => { shadowDirty = true; kick(); }, 300); } // (once it is still: the shadows catch up)
    { ambOnly = false; const shUp = shadowDirty || (scMove && (!camActive || shadowAge++ >= 2)) || (!viaAmb && !camActive && !sceneMoving) || (!camActive && shadowAge++ > (quality === 'high' ? 4 : 12)); if (shUp) shadowAge = 0; shadowDirty = false; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = shUp; }
    dynRes(tF0, moving || camActive, amb); // (v6.20: a still frame inside a turn no longer snaps the resolution back up - that reallocated the picture every other frame)
    renderer.render(ctx.scene, cam);
    sizeAfter(); // v5.74: the magnified inset of a small snake
    updateMarkers();
    fx.after();
    if (window.SL_3D_TEST) (window.__slFrames || (window.__slFrames = [])).push(performance.now() - tF0);
    lastF = tF0;
    if (moving) kick();
    else if (amb && alive && !raf) raf = requestAnimationFrame(ambTick); // v5.73: the scenery keeps moving gently (v5.93: paced, below)
  }
  // v5.93: the wind in the grass and the water are drawn on the screen's own beat - every frame, or every 2nd, 3rd or 4th
  // frame - never on a timer (the old 30-50 ms timer drifted against the screen's refresh, so the grass moved in uneven
  // steps: it looked laggy even when the device had time to spare). How many frames apart adapts to the device (pace):
  // when the scenery frames come late it draws them further apart, then thins the far plants a little (fading them out
  // from 20 m, never near the snake), then the sharpness (only while nothing else moves, at most to 75%); when there is
  // time to spare it steps back up the same way. Each step is small and slow, so nothing visibly jumps.
  function ambTick(ts) {
    raf = 0; if (!alive) return;
    if (pace.lastTs) { const d = ts - pace.lastTs; if (d > 4 && d < 60) pace.vs += (d - pace.vs) * 0.1; } pace.lastTs = ts;
    const per = Math.max(1, Math.round(16.7 / pace.vs)), need = per * Math.max(pace.skip, performance.now() - lastUser > 45000 ? 4 : 1); // (left alone for a while: slower, to save the battery)
    if (kicked || ++pace.cnt >= need) { pace.cnt = 0; ambOnly = !kicked; frame(); }
    else raf = requestAnimationFrame(ambTick);
  }
  function paceMeasure(t) {
    const d = pace.lastR ? t - pace.lastR : 0; pace.lastR = t; if (!d || d > 400) return;
    const want = pace.vs * Math.max(1, Math.round(16.7 / pace.vs)) * pace.skip; pace.n++;
    if (d > want * 1.45) pace.slow++; else if (d < want * 1.15) pace.fast++;
    if (pace.n < 24) return;
    const slow = pace.slow > 9, fast = pace.slow < 2 && pace.fast > 19; pace.n = pace.slow = pace.fast = 0;
    if (slow) { if (pace.skip < 3) pace.skip++; else if (pace.dens > 0.45) pace.dens = Math.max(0.45, pace.dens - 0.15); else if (pace.kIdle > 0.75) pace.kIdle = Math.max(0.75, pace.kIdle - 0.08); }
    else if (fast) { if (pace.kIdle < 1) pace.kIdle = Math.min(1, pace.kIdle + 0.08); else if (pace.dens < 1) pace.dens = Math.min(1, pace.dens + 0.15); else if (pace.skip > pace.skip0) pace.skip--; }
  }
  const pace = { skip0: quality === 'low' ? 2 : 1, skip: quality === 'low' ? 2 : 1, cnt: 0, vs: 16.7, lastTs: 0, lastR: 0, n: 0, slow: 0, fast: 0, dens: 1, kIdle: 1 };
  let kicked = false;
  let lastCamT = -1e9, camSettleT = 0; let holdRender = false, ambT = 0, shadowAge = 0, ambOnly = false, lastUser = performance.now(), lastF = 0, colList = null, shadowDirty = true;
  // v5.78: dynamic resolution - while the view moves, if frames take too long (under ~40 per second) the picture is drawn with
  // fewer pixels (down to 60% of the full pixel ratio), and as soon as it is still again it is drawn once more at full
  // sharpness. The change is gradual and has a dead band, so the resolution never flickers up and down.
  const dyn = { ema: 16, n: 0, still: 0, lastT: 0, frames: 0 };
  function dynRes(t, moving, amb) {
    const dt = dyn.lastT ? t - dyn.lastT : 16; dyn.lastT = t;
    if (moving && dt < 250) { dyn.ema += (dt - dyn.ema) * 0.15; dyn.frames++; dyn.still = 0; }
    else if (!moving) dyn.still++;
    let k = dynK;
    if (moving && dyn.frames > 8) {
      if (dyn.ema > 26 && k > 0.6) { k = Math.max(0.6, k * 0.85); dyn.frames = 0; }
      else if (dyn.ema < 15 && k < 1) { k = Math.min(1, k / 0.9); dyn.frames = 0; }
    }
    if (!moving && dyn.still >= 1 && k !== pace.kIdle) { k = amb ? (k < pace.kIdle ? Math.min(pace.kIdle, k + 0.1) : pace.kIdle) : pace.kIdle; dyn.frames = 0; dyn.ema = 16; } // still: full sharpness (v5.93: in a few small steps, not one jump)
    if (k !== dynK) { dynK = k; const w = stage.clientWidth || 300, h = stage.clientHeight || 200; renderer.setPixelRatio(basePR() * dynK); renderer.setSize(w, h, false); }
  }
  for (const ev of ['pointerdown', 'wheel', 'keydown', 'touchstart']) on(stage, ev, () => { lastUser = performance.now(); }, { passive: true });
  const zeroM = new THREE.Matrix4().makeScale(0, 0, 0), ov = new THREE.Vector3(), od = new THREE.Vector3();
  // v5.93: during See it eat a tree snake's own tree fades (to a quarter) while any of it stands between the camera and the
  // head and prey, and comes back when it no longer does (it is one mesh: tested against its triangles every 6th frame)
  const treeOcc = { n: 0, hit: false, k: 1, ray: null };
  function fadeTree() {
    const tr = info && info.tree, tgt = fx.camTarget && fx.camTarget();
    if (tr && tr.visible && tgt) {
      if (treeOcc.n++ % 6 === 0) { const r = treeOcc.ray || (treeOcc.ray = new THREE.Raycaster()), d = tgt.clone().sub(cam.position), l = d.length(); r.set(cam.position, d.divideScalar(l || 1)); r.near = 0; r.far = l * 0.88; treeOcc.hit = r.intersectObject(tr, true).length > 0; }
    } else treeOcc.hit = false;
    const want = treeOcc.hit ? 0.25 : 1; if (!tr || Math.abs(treeOcc.k - want) < 0.005) return;
    treeOcc.k = Math.abs(want - treeOcc.k) < 0.02 ? want : treeOcc.k + (want - treeOcc.k) * 0.18; const k = treeOcc.k;
    tr.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { const tp = k < 0.995; if (m.transparent !== tp) { m.transparent = tp; m.needsUpdate = true; } m.opacity = k; m.depthWrite = !tp; } });
    kick();
  }
  function updateOccluders() {
    fadeTree();
    const list = ctx.occ; if (!list || !list.length) return;
    const t = (fx.camTarget && fx.camTarget()) || targetFor(controls.st.d), cp = cam.position; od.subVectors(t, cp); const len2 = od.lengthSq(), sr = Math.min(info.Rb, Math.sqrt(len2) * 0.3); // (what the camera is really looking at, also during a show)
    const dirty = new Set();
    for (const o of list) {
      ov.subVectors(o.c, cp); const tt = ov.dot(od) / len2; let hide = !!o.force || ov.length() < o.r * 1.6; // also anything right in front of the lens (o.force: under the stretched-out snake)
      if (!hide && tt > 0.02 && tt < 1.05) { const perp = ov.addScaledVector(od, -tt).length(); hide = perp < o.r + sr * Math.min(1, tt) * 0.9; }
      if (hide === o.hid) continue; o.hid = hide;
      if (o.mesh) o.mesh.visible = !hide && (cScene.checked); else { o.im.setMatrixAt(o.i, hide ? zeroM : o.m); dirty.add(o.im); }
    }
    dirty.forEach((im) => { im.instanceMatrix.needsUpdate = true; });
  }
  function kick() { kicked = true; if (!raf && alive) raf = requestAnimationFrame(frame); }

  // ---------------------------------------------------------------- Size vs person (v5.74)
  // The snake and a person 1.70 m tall at the SAME scale, side by side on the same ground: the snake laid out loosely
  // (extras.js bends it with the rig, keeping its length) and shown at its documented typical adult length - the same
  // number and source as the Information tab (adultLength) - measured along its body (the arc length of its centre
  // line, not its bounding box). The camera glides (eased, ~1 s) to a slightly raised three-quarter view with both fully
  // in view; a small snake gets a ring and a magnified inset. Back to model (the same button) or the Back chip glides
  // back to exactly the angle and zoom you had.
  const sizeSt = { on: false, leaving: false, saved: null, len: null, lay: null, k: 1, piv: new THREE.Vector3(), tgt: new THREE.Vector3(), sk: { v: 0, from: 0, to: 0, t0: 0, dur: 0 }, undo: null, ready: false, pts: null, mid: new THREE.Vector3(), headTop: new THREE.Vector3(), small: false, N: 1 };
  let pageLen = null; // the species page's own length (the Information tab's): given by the page, or read from it once
  if (opts.len && +opts.len.hi > 0) pageLen = opts.len;
  else if (typeof opts.pageLen === 'function') { try { Promise.resolve(opts.pageLen()).then((v) => { if (v && +v.hi > 0) pageLen = v; }, () => {}); } catch (e) { /* no page: the profile's own length */ } }
  const lenInfo = () => adultLength(opts.profile, pageLen, opts.id);
  const sizeBusy = () => sizeSt.on || sizeSt.leaving;
  const easeIO = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  function skNow() { const a = sizeSt.sk, u = a.dur > 0 ? clamp((performance.now() - a.t0) / a.dur, 0, 1) : 1; a.v = a.from + (a.to - a.from) * easeIO(u); return a.v; }
  function skGo(to, dur) { const a = sizeSt.sk; skNow(); a.from = a.v; a.to = to; a.t0 = performance.now(); a.dur = reduce() ? 0 : dur; kick(); }
  const skMoving = () => Math.abs(skNow() - sizeSt.sk.to) > 1e-4;
  // the overlays: a caption with the length and its source, the Back chip, a ring round a small snake and the magnified inset
  const sizeCap = el('div', 'sp3d-sizecap'); sizeCap.hidden = true; sizeCap.setAttribute('aria-live', 'polite');
  const sizeChip = el('button', 'sp3d-b sp3d-backchip'); sizeChip.type = 'button'; sizeChip.innerHTML = '<span aria-hidden="true">←</span> Back'; sizeChip.setAttribute('aria-label', 'Back to the model'); sizeChip.hidden = true;
  const sizeRing = el('div', 'sp3d-szring'); sizeRing.hidden = true; const ringLab = el('span', 'sp3d-szlab'); sizeRing.appendChild(ringLab); // (a small snake's label sits on its ring)
  const sizeInset = el('div', 'sp3d-szinset'); sizeInset.hidden = true; sizeInset.setAttribute('aria-hidden', 'true'); const insetTag = el('span', 'sp3d-szzoom'); sizeInset.appendChild(insetTag);
  stage.append(sizeRing, sizeInset, sizeCap, sizeChip);
  on(sizeChip, 'click', () => V.scaleBack());
  const insetCam = new THREE.PerspectiveCamera(30, 1, 0.001, 100);
  function sizeOverlays(show) {
    sizeChip.hidden = !show; sizeCap.hidden = !show; if (!show) { sizeRing.hidden = true; sizeInset.hidden = true; }
    stage.classList.toggle('sp3d-sizing', show);
  }
  function sizeCaption(L) {
    sizeCap.innerHTML = ''; sizeCap.appendChild(el('span', '', L.line.replace(/ \(source: .*\)$/, '')));
    if (L.src) { sizeCap.appendChild(document.createTextNode(' (source: ')); if (L.src[1]) { const a = el('a', '', L.src[0]); a.href = L.src[1]; a.target = '_blank'; a.rel = 'noopener'; sizeCap.appendChild(a); } else sizeCap.appendChild(document.createTextNode(L.src[0])); sizeCap.appendChild(document.createTextNode(')')); }
    else { const m = L.line.match(/ \(source: .*\)$/); if (m) sizeCap.appendChild(document.createTextNode(m[0])); }
  }
  function personFade(op) { if (!scaleObj) return; scaleObj.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [], blob = !!o.userData.blob; for (const m of ms) { m.transparent = blob || op < 0.999; m.opacity = op * (m.userData.blobA != null ? m.userData.blobA : 1); m.depthWrite = !blob && op >= 0.999; } if (o !== scaleObj) o.visible = op > 0.004; }); }
  function sizeDropPerson() { if (!scaleObj) return; const g = scaleObj; scaleObj = null; if (g.parent) g.parent.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach((m) => { for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); } m.dispose(); }); }); }
  // where everything goes: the snake laid out across the view (head on the left), the person a step beyond its tail
  function sizeLayout() {
    const L = sizeSt.len = lenInfo(), az = controls.aim.az;
    const lay = fx.sizeLay ? fx.sizeLay.start({ az, portrait: info.portrait }) : null;
    sizeSt.lay = lay;
    const arc = lay ? lay.arc : info.F.L;
    sizeSt.k = Math.abs(L.m / arc - 1) < 0.004 ? 1 : L.m / arc; // shown at exactly its documented length, measured along the body
    sizeSt.piv.copy(lay ? lay.center : info.center).setY(0);
    const R = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az)), Fw = new THREE.Vector3(Math.sin(az), 0, Math.cos(az)), k = sizeSt.k, piv = sizeSt.piv;
    const world = (q) => new THREE.Vector3(piv.x + (q[0] - piv.x) * k, 0, piv.z + (q[1] - piv.z) * k);
    const pts = (lay ? lay.pts : [[info.center.x - info.Rb, info.center.z], [info.center.x + info.Rb, info.center.z]]).map(world);
    let s0 = 1e9, s1 = -1e9, f0 = 1e9, f1 = -1e9;
    for (const p of pts) { const d = p.clone().sub(piv); s0 = Math.min(s0, d.dot(R)); s1 = Math.max(s1, d.dot(R)); f0 = Math.min(f0, d.dot(Fw)); f1 = Math.max(f1, d.dot(Fw)); }
    sizeSt.pts = pts; sizeSt.arc = arc * k;
    sizeSt.mid = piv.clone().addScaledVector(R, (s0 + s1) / 2).addScaledVector(Fw, (f0 + f1) / 2); sizeSt.mid.y = info.F.w0 * k * 0.5;
    const PH = 1.7, gap = Math.max(0.3, L.m * 0.1); let px = s1 + gap + 0.22, pf = 0;
    // v6.00: by a river or the sea the person stands on the dry bank, not in (or on) the water: the nearest dry spot a
    // little further along or a step forward or back
    const wiP = ctx.waterInfo, at = (a, f) => piv.clone().addScaledVector(R, a).addScaledVector(Fw, f);
    const wetAt = (q) => !!wiP && q.x * wiP.dir.x + q.z * wiP.dir.y + (wiP.wob ? wiP.wob(-q.x * wiP.dir.y + q.z * wiP.dir.x) : 0) > wiP.edge - 0.3;
    if (wetAt(at(px, 0))) { find: for (const da of [0, 0.3, 0.6, 1]) for (const f of [-0.4, 0.4, -0.8, 0.8, -1.2, 1.2]) if (!wetAt(at(px + da, f))) { px += da; pf = f; break find; } }
    const pp = at(px, pf), gy = fx.groundY ? fx.groundY([[pp.x, pp.z]], true)[0] : 0; pp.y = gy || 0;
    sizeSt.person = pp; sizeSt.headTop = pp.clone().add(new THREE.Vector3(0, PH + 0.04, 0));
    sizeSt.box = { s0: s0 - Math.max(0.05, L.m * 0.04), s1: px + 0.3, ss1: s1, sm: (s0 + s1) / 2, pm: px, f0: Math.min(f0, pf - 0.2, -0.2), f1: Math.max(f1, pf + 0.2, 0.2), h: PH + 0.08, R };
    // the person: natural proportions (extras.js buildPerson), 1.70 m, turned towards the camera
    sizeDropPerson();
    scaleObj = new THREE.Group(); scaleObj.name = 'sizePerson';
    const man = EXTRA.buildPerson ? EXTRA.buildPerson(THREE, PH) : new THREE.Mesh(personShape(PH), new THREE.MeshStandardMaterial({ color: '#7d8a80' }));
    { const bb = new THREE.Box3().setFromObject(man), hgt = bb.max.y - bb.min.y; if (hgt > 0) man.scale.setScalar(PH / hgt); } // (exactly 1.70 m from the soles to the top of the hair)
    man.position.copy(pp); man.rotation.y = az + 0.25; scaleObj.add(man); scaleObj.userData.man = man; ctx.scene.add(scaleObj); personFade(0);
    scaleObj.userData.labels = [
      { p: sizeSt.headTop.clone(), t: 'Person 1.70 m' },
      { p: sizeSt.mid.clone().add(new THREE.Vector3(0, info.F.w0 * 2 * k, 0)), t: 'Snake ' + fmtAdult(L.m) + ' (along its body)', snake: true },
    ];
    scaleObj.userData.ends = pts.filter((_, i) => i % 6 === 0);
    sizeCaption(L);
  }
  // v6.00: the person stands in the scene like a real person - both soles on the actual ground under them (sampled at the
  // heel to toe of each foot, also on dunes and on the bed at the water's edge: never floating, never sunk), the
  // grass flattened under the shoes, trodden lower round them and untouched a little further out (so blades stand round
  // and partly over the shoes), stones right under a foot moved aside, and a soft contact shadow under each foot. Done
  // once the person's model is there (it loads on its own): its feet are found in its own mesh
  const PERSON_R = 0.8;
  function sizePlant() {
    const man = scaleObj.userData.man; if (!man || man.userData.realPerson === 'loading' || !man.children.length) return;
    scaleObj.userData.planted = true;
    man.updateMatrixWorld(true);
    const inv = man.matrixWorld.clone().invert(), v = new THREE.Vector3(), lv = new THREE.Vector3(), feet = [[], []];
    man.traverse((o) => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return; const pa = o.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); lv.copy(v).applyMatrix4(inv); if (lv.y < 0.035) feet[lv.x < 0 ? 0 : 1].push([v.x, v.z, lv.z, lv.x]); } });
    const ry = man.rotation.y, fw = [Math.sin(ry), Math.cos(ry)], sd = [Math.cos(ry), -Math.sin(ry)], soles = [];
    for (const f of feet) {
      if (!f.length) continue; let cx = 0, cz = 0, a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const q of f) { cx += q[0]; cz += q[1]; a0 = Math.min(a0, q[2]); a1 = Math.max(a1, q[2]); b0 = Math.min(b0, q[3]); b1 = Math.max(b1, q[3]); }
      cx /= f.length; cz /= f.length; soles.push({ x: cx, z: cz, len: Math.max(0.2, a1 - a0), w: Math.max(0.08, b1 - b0) });
    }
    if (!soles.length) soles.push({ x: man.position.x, z: man.position.z, len: 0.27, w: 0.1 });
    const smp = []; for (const s of soles) for (const a of [-0.42, 0, 0.42]) for (const b of [-0.35, 0, 0.35]) smp.push([s.x + fw[0] * a * s.len + sd[0] * b * s.w, s.z + fw[1] * a * s.len + sd[1] * b * s.w]); // (heel to toe, side to side: 9 points a foot)
    const gy = fx.groundY ? fx.groundY(smp, true) : smp.map(() => 0), avg = (a) => a.reduce((p, q) => p + q, 0) / a.length;
    // the soles on the ground's average height under them, half a centimetre into the soil or sand (a person's weight):
    // in rippled sand the crests press into the soles and the hollows show a sliver of shadow, as under a real shoe
    const y = avg(gy) - 0.005, dy = y - man.position.y; man.position.y = y; sizeSt.person.y = y;
    sizeSt.headTop.y += dy; const lab = scaleObj.userData.labels && scaleObj.userData.labels[0]; if (lab) lab.p.y += dy;
    // grass: gone under the soles (the shoe stands on it), bent down to about 40% right round them, rising to its full height about
    // 45 cm out (so blades stand round and partly over the shoes); stones under the feet aside
    if (fx.clearProps) {
      const dFoot = (x, z) => Math.min(...soles.map((s) => { const dx = x - s.x, dz = z - s.z, a = Math.abs(dx * fw[0] + dz * fw[1]) - s.len * 0.5, b = Math.abs(dx * sd[0] + dz * sd[1]) - s.w * 0.5; return Math.hypot(Math.max(a, 0), Math.max(b, 0)); }));
      const P = sizeSt.person, un = fx.clearProps(null, 0, { flat: true, test: (x, z) => Math.hypot(x - P.x, z - P.z) < PERSON_R, press: (x, z) => { const d = dFoot(x, z); return d < 0.02 ? 0 : 0.4 + 0.6 * sstep(0.02, 0.45, d); }, solid: (x, z, r) => dFoot(x, z) < r + 0.03 });
      const u0 = sizeSt.undo; sizeSt.undo = () => { un(); if (u0) u0(); };
    }
    // contact shadows: soft and dark right under each shoe, a fainter one round where the person stands
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c2 = cv.getContext('2d'), gr = c2.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,.72)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c2.fillStyle = gr; c2.fillRect(0, 0, 64, 64);
    // (each a small grid laid on the ground itself, a few millimetres above it, so it follows a dune or a lump exactly)
    const tex = new THREE.CanvasTexture(cv), cr = Math.cos(ry), sr = Math.sin(ry), blob = (x, z, sx, sz, a) => {
      const g = new THREE.PlaneGeometry(1, 1, 8, 8); g.rotateX(-Math.PI / 2); const pa = g.attributes.position, pts = [];
      for (let i = 0; i < pa.count; i++) { const lx = pa.getX(i) * sx, lz = pa.getZ(i) * sz; pts.push([x + lx * cr + lz * sr, z - lx * sr + lz * cr]); }
      const hs = fx.groundY ? fx.groundY(pts, true) : pts.map(() => y); pts.forEach((q, i) => pa.setXYZ(i, q[0], hs[i] + 0.004, q[1])); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, color: '#000000', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.material.userData.blobA = a; m.userData.blob = true; m.renderOrder = 1; m.raycast = () => {};
      scaleObj.add(m);
    };
    const P = sizeSt.person; blob(P.x, P.z, 0.8, 0.62, 0.42);
    for (const s of soles) blob(s.x, s.z, s.w * 2.2, s.len * 1.5, 0.8);
    // the same sunlight as the snake: the sun's shadow reaches far enough for the person's own shadow too (it covered only
    // the snake's few metres, and the person's shadow was cut off at its edge) - put back as it was afterwards
    const sun = ctx.sun; if (sun && sun.castShadow && !sizeSt.shSave) {
      const sc = sun.shadow.camera; let rr = Math.hypot(P.x - sun.target.position.x, P.z - sun.target.position.z) + 1.9;
      for (const q of sizeSt.pts || []) rr = Math.max(rr, Math.hypot(q.x - sun.target.position.x, q.z - sun.target.position.z) + 0.3);
      if (rr > sc.right) { sizeSt.shSave = [sc.left, sc.right, sc.top, sc.bottom, sc.near, sc.far]; sc.left = sc.bottom = -rr; sc.right = sc.top = rr; sc.near = Math.max(0.01, sc.near - 2); sc.far += 2; sc.updateProjectionMatrix(); }
    }
    shadowDirty = true; kick();
  }
  // the view that shows both whole: slightly raised, three-quarter, clear of the buttons on top and the caption below
  function sizeGoal() {
    const B = sizeSt.box, sr = stage.getBoundingClientRect(), br = bar.getBoundingClientRect(), H = Math.max(1, sr.height);
    const cr = sizeCap.getBoundingClientRect(), top = clamp((br.bottom - sr.top + 10) / H, 0.06, 0.5), bot = clamp((cr.height ? sr.bottom - cr.top + 12 : 70) / H, 0.06, 0.32);
    const YAW = 0, azF = Math.atan2(B.R.x, B.R.z) - Math.PI / 2 + YAW, elF = (12 * Math.PI) / 180; // (side-on, a little raised, looking at the point halfway between the snake and the person: both the same distance away, so both are seen at the same scale)
    const D = B.f1 - B.f0, hh = B.h;
    const cS = (B.sm + B.pm) / 2, half = Math.max(cS - B.s0, B.s1 - cS); // (centred halfway between the snake's middle and the person)
    const dW = (half * 1.12) / Math.tan(info.hf) + D * 0.5;
    const dH = (hh * 1.08) / ((1 - top - bot) * 2 * Math.tan(info.vf)) + D * 0.5;
    const d = Math.max(dW, dH, info.dMin * 2);
    const visH = 2 * d * Math.tan(info.vf), c = sizeSt.piv.clone().addScaledVector(B.R, cS);
    sizeSt.tgt.set(c.x, hh * 0.5 + ((top - bot) / 2) * visH, c.z);
    info.scaleK = Math.max(1, (d * 1.35) / info.dMax);
    return { az: azF, el: elF, d, px: 0, pz: 0 };
  }
  function sizeFrame() { controls.tween(sizeGoal(), 1000); }
  function toggleScale(force, o = {}) {
    const onv = force != null ? !!force : !sizeSt.on;
    if (onv === sizeSt.on) { if (!onv && o.instant && sizeSt.leaving) sizeFinish(); return; }
    if (onv) {
      if (!info || !controls) return;
      const wasLeaving = sizeSt.leaving; if (wasLeaving) sizeFinish(); // (pressed again while gliding back: keep the view saved before)
      if (!wasLeaving || !sizeSt.saved) sizeSt.saved = controls.aim;
      sizeSt.on = true; sizeSt.ready = false; bScale.setAttribute('aria-pressed', 'true'); bScale.textContent = 'Back to model'; setCamBtn(null);
      sizeLayout(); sizeOverlays(true);
      if (fx.sizeLay && sizeSt.lay) fx.sizeLay.go(1, 1000);
      const g = sizeGoal(); skGo(1, 1000); controls.tween(g, 1000);
      // nothing stands between you and them: scenery in front of the snake and the person steps aside (put back after)
      if (sizeSt.undo) sizeSt.undo(); sizeSt.undo = null;
      // (v6.00: only in front of the snake now - the person stands in the grass, see sizePlant)
      if (fx.clearProps) { const B = sizeSt.box, C = new THREE.Vector3(Math.sin(g.az), 0, Math.cos(g.az)), pv = sizeSt.piv, P = sizeSt.person;
        const pR = Math.min(PERSON_R, Math.max(0.3, B.pm - B.ss1 - 0.15)); // (the grass round the person stays - but never over the snake's tail)
        sizeSt.undo = fx.clearProps(null, 0, { all: true, test: (x, z, r) => { if (Math.hypot(x - P.x, z - P.z) < pR) return false; const dx = x - pv.x, dz = z - pv.z, sR = dx * B.R.x + dz * B.R.z, tC = dx * C.x + dz * C.z; return sR > B.s0 - 0.25 - r && sR < B.ss1 + 0.25 + r && tC > B.f0 - 0.3 - r && tC < g.d; } });
        // (and rocks and logs between the person and the camera, as before: only grass and plants stay round the person)
        const u1 = sizeSt.undo, u2 = fx.clearProps(null, 0, { test: (x, z, r) => { const dx = x - pv.x, dz = z - pv.z, sR = dx * B.R.x + dz * B.R.z, tC = dx * C.x + dz * C.z; return sR > B.s0 - 0.25 - r && sR < B.s1 + 0.25 + r && tC > B.f0 - 0.3 - r && tC < g.d; } });
        sizeSt.undo = () => { u2(); u1(); }; }
    } else {
      sizeSt.on = false; bScale.setAttribute('aria-pressed', 'false'); bScale.textContent = 'Size vs person'; sizeOverlays(false); sizeSt.ready = false;
      markers.filter((m) => m.scale).forEach((m) => m.el.remove()); markers = markers.filter((m) => !m.scale);
      if (o.instant) { sizeFinish(); return; }
      sizeSt.leaving = true;
      if (fx.sizeLay && sizeSt.lay) fx.sizeLay.go(0, 900);
      skGo(0, o.keepCam ? 700 : 1000);
      if (!o.keepCam && sizeSt.saved) controls.tween(sizeSt.saved, 1000);
    }
    kick();
  }
  function sizeFinish() { // everything back as it was: the pose, the scale, no person, the props back where they stood
    sizeSt.leaving = false; sizeSt.ready = false;
    if (fx.sizeLay) fx.sizeLay.end(true);
    sizeSt.k = 1; if (snakeGroup) { snakeGroup.scale.setScalar(1); snakeGroup.position.set(0, 0, 0); }
    const a = sizeSt.sk; a.v = a.from = a.to = 0; a.dur = 0;
    sizeDropPerson(); if (sizeSt.undo) { sizeSt.undo(); sizeSt.undo = null; }
    if (sizeSt.shSave && ctx.sun) { const sc = ctx.sun.shadow.camera, v = sizeSt.shSave; [sc.left, sc.right, sc.top, sc.bottom, sc.near, sc.far] = v; sc.updateProjectionMatrix(); shadowDirty = true; } sizeSt.shSave = null;
    if (info) info.scaleK = 1; sizeSt.lay = null; sizeSt.pts = null; sizeOverlays(false);
    markers.filter((m) => m.scale).forEach((m) => m.el.remove()); markers = markers.filter((m) => !m.scale);
    kick();
  }
  // every frame while Size vs person is on or leaving: the snake's scale follows its pose, the person fades in or out,
  // and the labels, the ring and the inset come once the glide is over
  function sizeStep() {
    if (!sizeBusy() || !snakeGroup) return false;
    const e = fx.sizeLay && sizeSt.lay ? fx.sizeLay.e : skNow(), kk = 1 + (sizeSt.k - 1) * e, pv = sizeSt.piv;
    snakeGroup.scale.setScalar(kk); snakeGroup.position.set(pv.x * (1 - kk), 0, pv.z * (1 - kk));
    if (scaleObj && sizeSt.on && !scaleObj.userData.planted) sizePlant();
    personFade(clamp(skNow() * 1.4 - 0.2, 0, 1));
    const moving = skMoving() || !!(fx.sizeLay && sizeSt.lay && fx.sizeLay.moving);
    if (sizeSt.leaving && !moving) { sizeFinish(); return true; }
    if (sizeSt.on && !moving && !sizeSt.ready) { sizeSt.ready = true; rebuildMarkers(); }
    return moving;
  }
  const v3s = new THREE.Vector3();
  function sizeAfter() { // the ring round a small snake, and the magnified inset (drawn into the same canvas)
    if (!sizeSt.on || !sizeSt.ready || !sizeSt.pts) { sizeRing.hidden = true; sizeInset.hidden = true; return; }
    const w = stage.clientWidth, h = stage.clientHeight; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of sizeSt.pts) { v3s.copy(p).project(cam); if (v3s.z > 1) continue; const x = (v3s.x * 0.5 + 0.5) * w, y = (-v3s.y * 0.5 + 0.5) * h; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const span = Math.hypot(x1 - x0, y1 - y0), small = x1 > x0 && span < Math.max(90, w * 0.16);
    sizeSt.small = small; sizeRing.hidden = !small; sizeInset.hidden = !small;
    for (const m of markers) if (m.sizeSnake) m.el.classList.toggle('sp3d-off', small);
    if (!small) return;
    ringLab.textContent = 'Snake ' + fmtAdult(sizeSt.len.m);
    const r = Math.max(30, span / 2 + 16); sizeRing.style.width = sizeRing.style.height = r * 2 + 'px';
    sizeRing.style.transform = 'translate(' + ((x0 + x1) / 2 - r).toFixed(1) + 'px,' + ((y0 + y1) / 2 - r).toFixed(1) + 'px)';
    // the inset: the same snake close up, in a box on the right, saying how much it is magnified
    // (top-left, under the buttons: the snake is on the left and the person on the right, so the sky above the snake is free)
    const sr = stage.getBoundingClientRect(), br = bar.getBoundingClientRect(); let iw = Math.round(clamp(w * 0.42, 150, 280)), ih = Math.round(iw * 0.62); const ix = 12, iy = Math.round(br.bottom - sr.top + 14);
    { const cr = sizeCap.getBoundingClientRect(), room = (cr.height ? cr.top - sr.top : h) - 10 - iy; if (room < ih) { if (room < 80) { sizeInset.hidden = true; return; } ih = Math.round(room); iw = Math.round(ih / 0.62); } } // (a short view: a smaller inset, or none - the ring still marks it)
    sizeInset.style.width = iw + 'px'; sizeInset.style.height = ih + 'px'; sizeInset.style.transform = 'translate(' + ix + 'px,' + iy + 'px)';
    const L = (sizeSt.arc || sizeSt.len.m) * 0.82, dirC = cam.position.clone().sub(sizeSt.mid); dirC.y = Math.max(dirC.y, dirC.length() * 0.35); dirC.normalize();
    insetCam.aspect = iw / ih; const di = (L * 0.6) / Math.tan((insetCam.fov * Math.PI) / 360) / Math.min(1, insetCam.aspect) * 0.62;
    insetCam.near = Math.max(1e-4, di * 0.02); insetCam.far = di * 60; insetCam.position.copy(sizeSt.mid).addScaledVector(dirC, di); insetCam.lookAt(sizeSt.mid); insetCam.updateProjectionMatrix();
    // magnification: the inset's pixels per metre at the snake over the main view's
    const mainPx = h / (2 * Math.tan((cam.fov * Math.PI) / 360) * cam.position.distanceTo(sizeSt.mid)), insPx = ih / (2 * Math.tan((insetCam.fov * Math.PI) / 360) * di);
    const N = Math.max(2, Math.round(insPx / mainPx)); sizeSt.N = N; insetTag.textContent = '×' + N + ' zoom';
    renderer.setScissorTest(true); renderer.setScissor(ix, h - iy - ih, iw, ih); renderer.setViewport(ix, h - iy - ih, iw, ih);
    const vis = scaleObj ? scaleObj.visible : false; if (scaleObj) scaleObj.visible = false; // (the person never fills the inset)
    renderer.render(ctx.scene, insetCam); if (scaleObj) scaleObj.visible = vis;
    renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h);
  }

  // appearance details: labelled markers at anatomical points
  function anchorPos(name) {
    const F = info.F, b = info.body, Hl = F.Hl, th = b.eyeA;
    switch (name) {
      case 'eye': return info.eyePos[0] ? { p: info.eyePos[0].clone(), n: b.surfNormal(P.head.eyeX * Hl, th) } : { p: b.surf(P.head.eyeX * Hl, th).p, n: b.surfNormal(P.head.eyeX * Hl, th) };
      case 'postocular': return { p: b.surf(Hl * 0.7, th * 1.25).p, n: b.surfNormal(Hl * 0.7, th * 1.25) };
      case 'pit': return { p: b.surf(Hl * 0.15, Math.PI * 0.5).p, n: b.surfNormal(Hl * 0.15, Math.PI * 0.5) };
      case 'lip': return { p: b.surf(Hl * 0.35, Math.PI * 0.6).p, n: b.surfNormal(Hl * 0.35, Math.PI * 0.6) };
      case 'nostril': return { p: b.surf(Hl * 0.05, 0.4).p, n: b.surfNormal(Hl * 0.05, 0.4) };
      case 'crown': return { p: b.surf(Hl * 0.6, 0).p, n: new THREE.Vector3(0, 1, 0) };
      case 'snout': return { p: b.surf(Hl * 0.08, 0).p, n: new THREE.Vector3(0, 1, 0) };
      case 'neck': return { p: b.surf(Hl * 1.6, 0).p, n: new THREE.Vector3(0, 1, 0) };
      case 'back': return { p: b.surf(F.L * 0.4, 0).p, n: new THREE.Vector3(0, 1, 0) };
      case 'side': return { p: b.surf(F.L * 0.35, Math.PI * 0.5).p, n: b.surfNormal(F.L * 0.35, Math.PI * 0.5) };
      case 'belly': return { p: b.surf(F.L * 0.3, Math.PI * 0.82).p, n: b.surfNormal(F.L * 0.3, Math.PI * 0.82) };
      case 'tail': return { p: b.surf(F.L * (1 - P.body.tail * 0.5), 0).p, n: new THREE.Vector3(0, 1, 0) };
      case 'tip': return { p: b.surf(F.L * 0.995, 0).p, n: new THREE.Vector3(0, 1, 0) };
      case 'rattle': { const f = b.frameAt(F.L); return { p: b.spine(F.L).addScaledVector(f.T, F.W(F.L * 0.99) * 2.5), n: new THREE.Vector3(0, 1, 0) }; }
      default: return { p: b.surf(F.L * 0.4, 0).p, n: new THREE.Vector3(0, 1, 0) };
    }
  }
  function buildMarkers() {
    markers.forEach((m) => m.el.remove()); markers = [];
    for (const [a, txt] of P.details || []) { const e = el('div', 'sp3d-mk'); e.appendChild(el('span', 'sp3d-dot')); e.appendChild(el('span', 'sp3d-mt', txt)); labels.appendChild(e); markers.push(Object.assign({ el: e }, anchorPos(a))); }
    rebuildMarkers();
  }
  function rebuildMarkers() {
    labels.querySelectorAll('.sp3d-sl').forEach((e) => e.remove());
    if (scaleObj && sizeSt.on && sizeSt.ready) for (const l of scaleObj.userData.labels) { const e = el('div', 'sp3d-mk sp3d-sl'); e.appendChild(el('span', 'sp3d-mt', l.t)); labels.appendChild(e); markers.push({ el: e, p: l.p, n: null, scale: true, sizeSnake: !!l.snake }); }
    markers = markers.filter((m) => m.el.isConnected);
  }
  const v3 = new THREE.Vector3();
  function updateMarkers() {
    if (!markers.length) return; const w = stage.clientWidth, h = stage.clientHeight, placed = [], sBoxes = [];
    for (const m of markers) if (m.fn) m.p = m.fn();
    const list = markers.map((m) => { v3.copy(m.p).project(cam); return { m, x: (v3.x * 0.5 + 0.5) * w, y: (-v3.y * 0.5 + 0.5) * h, vis: v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05 }; }).sort((a, b) => a.y - b.y);
    for (const o of list) {
      const m = o.m; m.el.hidden = !o.vis; if (!o.vis) continue;
      if (!m.sz) m.sz = [m.el.offsetWidth || 120, m.el.offsetHeight || 20];
      let x = Math.min(o.x, w - m.sz[0] + 6), y = o.y;
      if (!m.scale) { for (const q of placed) if (x < q[0] + q[2] && x + m.sz[0] > q[0] && y < q[1] + q[3] && y + m.sz[1] > q[1]) y = q[1] + q[3] + 2; }
      else { const mt = m.el.firstChild, wl = (mt && mt.offsetWidth) || m.sz[0], hl = (mt && mt.offsetHeight) || m.sz[1]; [x, y] = fx.avoid(clamp(o.x, wl / 2 + 2, w - wl / 2 - 2), y, wl, hl, scaleObj && scaleObj.userData.ends); for (let t = 0; t < 4 && (m._sb = sBoxes.find((q) => Math.abs(q[0] - x) < (q[2] + wl) / 2 + 4 && Math.abs(q[1] - y) < Math.max(q[3], hl) + 4)); t++) y = m._sb[1] - m._sb[3] - 6; sBoxes.push([x, y, wl, hl]); } // (and never on another size label) // v4.81: a size label never covers the snake
      if (fx.keepClear) { // v5.68: never over the buttons laid on the view (Compare photo, See countries, the main buttons, fullscreen)
        if (m.scale) { const mt = m.el.firstChild, wl = (mt && mt.offsetWidth) || m.sz[0], hl = (mt && mt.offsetHeight) || m.sz[1]; const q = fx.keepClear(x - wl / 2, y - hl, wl, hl); x = q[0] + wl / 2; y = q[1] + hl; }
        else { const q = fx.keepClear(x - 6, y - 6, m.sz[0], m.sz[1]); x = q[0] + 6; y = q[1] + 6; }
      }
      placed.push([x, y, m.sz[0], m.sz[1]]);
      m.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      m.el.classList.toggle('sp3d-moved', Math.abs(y - o.y) > 1 || Math.abs(x - o.x) > 1);
      if (m.n) { const facing = m.n.dot(cam.position.clone().sub(m.p).normalize()); m.el.classList.toggle('sp3d-back', facing < -0.1); }
    }
  }
  function toggleDetails() {
    const onv = bDet.getAttribute('aria-pressed') !== 'true'; bDet.setAttribute('aria-pressed', String(onv));
    if (onv) buildMarkers(); else { markers.filter((m) => !m.scale).forEach((m) => m.el.remove()); markers = markers.filter((m) => m.scale); }
    kick();
  }

  // fullscreen (the Fullscreen API where it exists, otherwise a full-window layout)
  function isFull() { return document.fullscreenElement === wrap || document.webkitFullscreenElement === wrap || wrap.classList.contains('sp3d-max'); }
  function toggleFull() {
    if (isFull()) { if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else { wrap.classList.remove('sp3d-max'); syncFull(); } }
    else { const rq = wrap.requestFullscreen || wrap.webkitRequestFullscreen; if (rq) { try { const pr = rq.call(wrap); if (pr && pr.catch) pr.catch(() => { wrap.classList.add('sp3d-max'); syncFull(); }); } catch (e) { wrap.classList.add('sp3d-max'); syncFull(); } } else { wrap.classList.add('sp3d-max'); syncFull(); } }
  }
  function syncFull() { const f = isFull(); bFull.textContent = f ? 'Exit fullscreen' : 'Fullscreen'; bFull.setAttribute('aria-pressed', String(f)); fx.syncFull(f); setTimeout(resize, 30); }
  // v4.81: centre the view on a point (along the ground) at distance d
  function focusOn(p, d, elv) { d = clamp(d, info.dMin, info.dMax * Math.max(1, fx.zoomOut)); const fp = fx.focusPoint && fx.focusPoint(), k = sstep(info.dFit * 0.75, Math.max(info.dMin * 1.2, info.F.Hl * 3.8), d), b = info.center.clone().lerp(fp || info.headPos, k); controls.setGoal(Object.assign({ d, px: p.x - b.x, pz: p.z - b.z }, elv != null ? { el: elv } : {})); }

  // events
  on(bFront, 'click', () => setView('front')); on(bSide, 'click', () => setView('side')); on(bTop, 'click', () => setView('top'));
  // v4.81: Reset only resets the view (the mouth, size and anatomy stay as they are; in Size vs person it frames the snake and the person again)
  on(bReset, 'click', () => { if (fx.slitherHome) fx.slitherHome(true); setCamBtn(null); if (sizeSt.on) sizeFrame(); else resetView(); });
  // v5.74: Normal - back to the plain model: Anatomy off, Size vs person glides back to the view you had
  on(bNormal, 'click', () => { if (fx.anatOn()) bAnat.click(); V.scaleBack(); syncViews(); });
  function toggleMouth(force) {
    if (!extras || !extras.mouth) return;
    const v = force != null ? force : !mouthGoal; mouthGoal = v ? 1 : 0;
    bMouth.setAttribute('aria-pressed', String(v)); bMouth.textContent = v ? 'Close mouth' : 'Open mouth';
    // (v6.20: also whenever the head is off to the side or too far to see into the mouth - from the first view the head
    // could be at the very edge, or out of the picture, and Open mouth then showed nothing)
    const hp = (fx.focusPoint && fx.focusPoint()) || info.headPos, ndc = hp.clone().project(cam), headOk = ndc.z < 1 && Math.abs(ndc.x) < 0.6 && Math.abs(ndc.y) < 0.6 && cam.position.distanceTo(hp) < info.F.Hl * 9;
    if (v && !sizeSt.on && !fx.anatOn() && (controls.st.d > info.dFit * 0.55 || !headOk)) { // turn to face the head, close enough to see inside (v4.81: only from the whole-snake view; Open mouth changes nothing else)
      controls.setGoal({ az: viewAz('front') + 0.55, el: (16 * Math.PI) / 180, d: Math.max(info.dMin * 1.5, info.F.Hl * 3.4), px: 0, pz: 0 }); // (close enough to see inside; plants in the way step aside)
    }
    kick();
  }
  on(bMouth, 'click', () => { if (fx.defer && fx.defer(() => bMouth.click())) return; if (!mouthGoal) fx.exclusive('mouth'); toggleMouth(); }); // v5.09: one thing at a time (Open mouth goes with Anatomy)
  // v4.81: Anatomy moved to extras.js (see-through anatomy you can tap)
  // v5.74: the camera buttons glide there (eased, about a second); leaving Size vs person first if it is on
  const camGo = (b, g) => { fx.exclusive('view'); V.scaleBack(true); setCamBtn(b); controls.tween(g, 1000); };
  on(bVBody, 'click', () => { if (fx.anatOn() && fx.resetView && fx.resetView()) { setCamBtn(bVBody); return; } camGo(bVBody, resetGoal()); }); // (in Anatomy: the whole snake as Anatomy shows it)
  on(bVHead, 'click', () => camGo(bVHead, { az: viewAz('front') + 0.9, el: (20 * Math.PI) / 180, d: Math.max(info.dMin * 1.3, info.F.Hl * 4.5), px: 0, pz: 0 }));
  on(bVTop, 'click', () => camGo(bVTop, { az: controls.st.az, el: (80 * Math.PI) / 180, d: (info.Rb * 1.12) / Math.tan(Math.min(info.vf, info.hf)) + info.hMax, px: 0, pz: 0 }));
  on(bFull, 'click', toggleFull); on(bDet, 'click', toggleDetails);
  on(bScale, 'click', () => { if (fx.defer && fx.defer(() => bScale.click())) return; if (bScale.getAttribute('aria-pressed') !== 'true') { fx.exclusive('scale'); toggleScale(true); } else toggleScale(false); });
  on(bSet, 'click', () => { panel.hidden = !panel.hidden; bSet.setAttribute('aria-expanded', String(!panel.hidden)); });
  on(cScene, 'change', () => setSceneVisible(cScene.checked));
  on(document, 'fullscreenchange', syncFull); on(document, 'webkitfullscreenchange', syncFull);
  on(document, 'visibilitychange', () => { if (!document.hidden) kick(); });
  on(canvas, 'keydown', (e) => { if (e.key === 'Escape' && wrap.classList.contains('sp3d-max')) { e.stopPropagation(); e.preventDefault(); toggleFull(); } });
  on(canvas, 'webglcontextlost', (e) => { e.preventDefault(); lost = true; status.hidden = false; status.textContent = 'The 3D view was interrupted by the graphics system. Restoring it...'; if (raf) cancelAnimationFrame(raf); raf = 0; });
  on(canvas, 'webglcontextrestored', () => { lost = false; status.hidden = true; rebuild(); });
  on(canvas, 'pointerdown', () => { hint.classList.add('sp3d-hint-off'); }, { once: true });
  const ro = window.ResizeObserver ? new ResizeObserver(() => resize()) : null; if (ro) { ro.observe(stage); cleanups.push(() => ro.disconnect()); } else on(window, 'resize', resize);

  function disposeScene() {
    if (!ctx.scene) return;
    const seen = new Set();
    ctx.scene.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) { if (seen.has(m)) continue; seen.add(m); for (const k in m) { const v = m[k]; if (v && v.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); } } m.dispose(); }
      if (o.customDepthMaterial && !seen.has(o.customDepthMaterial)) { seen.add(o.customDepthMaterial); o.customDepthMaterial.dispose(); }
      if (o.dispose && o.isInstancedMesh) o.dispose();
      if (o.shadow && o.shadow.map) o.shadow.map.dispose();
    });
    for (const d of disposables) d.dispose && d.dispose(); disposables.clear();
    ctx.scene.clear(); ctx.scene = null; scaleObj = null; sizeSt.shSave = null; sizeSt.on = sizeSt.leaving = false; sizeSt.lay = sizeSt.pts = null; sizeSt.undo = null; sizeSt.k = 1; sizeSt.sk.v = sizeSt.sk.from = sizeSt.sk.to = 0; sizeSt.sk.dur = 0;
    bScale.setAttribute('aria-pressed', 'false'); bScale.textContent = 'Size vs person'; sizeOverlays(false);
    markers.forEach((m) => m.el.remove()); markers = [];
  }
  // (v6.20, S12: a new habitat keeps the view you had - the zoom and the point you moved to as well, not only the angle)
  function rebuild() { const st = controls ? { az: controls.st.az, el: controls.st.el, d: controls.st.d, px: controls.st.px, pz: controls.st.pz } : null; if (sizeBusy()) toggleScale(false, { instant: true }); fx.reset(); disposeScene(); build(); fx.onBuild(); resize(); if (st) controls.setGoal({ az: st.az, el: st.el, d: clamp(st.d, info.dMin, info.dMax), px: st.px, pz: st.pz }, true); kick(); }

  build(); fx.onBuild(); resize();
  if (opts.testing) window.__sp3d = { THREE, renderer, get P() { return P; }, get ctx() { return ctx; }, bodyClearance: () => bodyClearance(cam.position), get envReady() { return ctx.envReady; }, extras: () => extras, setScene: (v) => { cScene.checked = v; setSceneVisible(v); }, get scene() { return ctx.scene; }, get cam() { return cam; }, controls, info: () => info, setView, resetView, toggleScale, toggleDetails, toggleAnatomy: () => bAnat.click(), fx, size: () => ({ on: sizeSt.on, leaving: sizeSt.leaving, k: sizeSt.k, arc: sizeSt.arc, len: sizeSt.len, small: sizeSt.small, N: sizeSt.N, person: !!scaleObj, saved: sizeSt.saved }), get group() { return snakeGroup; }, get show() { return fx.test.show; }, get mouthGoal() { return mouthGoal; }, frame: () => { controls.update(); fx.step(); placeCamera(); fx.camera(); if (window.__sp3dCam) { const o = window.__sp3dCam; cam.position.copy(o.pos); cam.near = o.near || cam.near; cam.updateProjectionMatrix(); cam.lookAt(o.tgt); } updateOccluders(); renderer.shadowMap.needsUpdate = true; renderer.render(ctx.scene, cam); updateMarkers(); fx.after(); } };

  return {
    canvas,
    leaveModes: () => fx.leaveModes(), // v5.68: a click on the panel's empty background leaves Anatomy, See it eat and the rest
    dispose() {
      alive = false; if (raf) cancelAnimationFrame(raf); raf = 0; clearTimeout(ambT);
      if (document.fullscreenElement === wrap) { try { document.exitFullscreen(); } catch (e) {} }
      controls && controls.dispose(); fx.dispose(); cleanups.forEach((f) => f()); cleanups.length = 0;
      plugRun('dispose'); disposeScene(); renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss();
      host.innerHTML = '';
      if (window.__sp3d && window.__sp3d.renderer === renderer) delete window.__sp3d;
    },
  };
}
function fmtLen(m) { return m < 1 ? Math.round(m * 100) + ' cm' : (Math.round(m * 100) / 100) + ' m'; }
// v5.74: lengths written the way the species pages write them (build_species.py fmt_len): cm under a metre, else metres to 0.1
export function fmtAdult(m) { return m < 1 ? Math.round(m * 100) + ' cm' : (+m.toFixed(1)) + ' m'; }
// v5.74: THE typical adult length of a species, for Size vs person - the same number and source as the Information tab
// and the species page's "Size" line (build_species.py size_class(), in the same order):
//   1. its reviewed species account (the page's data-lenlo/-hi, the middle of the usual range, and that account's source),
//   2. a hand-made 3D profile's documented length (with the reference it was taken from),
//   3. a documented length for that species or a fossil's estimate (tools/auto_models.py),
//   4. otherwise the typical adult length of its genus (or family) - "estimated from its genus".
// page = { lo, hi, txt, src: 'Publisher|url' } (the species page's own numbers), or null when SnakeList has no account.
const SPECIES_LEN_SRC = { // tools/auto_models.py SPECIES_LEN: where those lengths come from
  'gyalopion-canum': ['Arizona Game and Fish Department, after Degenhardt et al. 1996', 'https://www.azgfd.com/'],
  'gyalopion-quadrangulare': ['Arizona Game and Fish Department', 'https://www.azgfd.com/'],
};
// the usual range from the account's own words ("About 1.8-2.5 m" -> "usually 1.8-2.5 m"); nothing when it gives no range
function rangeNote(t) { t = String(t || '').replace(/;.*$/, '').replace(/^((about|usually|commonly|typically|average|averages|adults?|mostly|around|up to)\s+)+/i, '').trim(); return /\d\s*(-|\u2013|to)\s*\d/.test(t) ? 'usually ' + t.replace(/(\d)\s*-\s*(\d)/g, '$1\u2013$2') : ''; }
export function adultLength(p, page, id) {
  p = p || {}; const a = p.auto, x = (a && a.x) || '';
  const out = (m, how, note, src) => {
    const L = fmtAdult(m), s = src && src[0] ? src : null;
    const lead = how === 'fossil' ? 'Estimated length ' : 'Typical adult length ';
    const line = lead + L + (how === 'genus' ? ', estimated from its genus (no measurements of this species yet)' : how === 'fossil' ? ', estimated from its fossil bones' : '') + (note ? ' · ' + note : '') + (s ? ' (source: ' + s[0] + ')' : how === 'genus' || how === 'fossil' ? '' : ' (source: SnakeList species data)');
    return { m, how, note: note || '', src: s, text: L, line };
  };
  if (page && +page.hi > 0) { const lo = +page.lo || +page.hi, hi = +page.hi, sp = String(page.src || '').split('|'); return out((lo + hi) / 2, 'account', rangeNote(page.txt), sp[0] ? [sp[0], sp[1] || ''] : null); }
  if (!a && +p.length > 0) { const r = (p.refs || []).find((q) => /\b(size|length|long|cm\b|m\b)/i.test(q.t || '')) || null; return out(+p.length, 'model', p.lengthNote || '', r ? [String(r.t).replace(/^[^:]*:\s*/, '') || r.t, r.u || ''] : null); }
  if (a && +a.L > 0) {
    if (x.indexOf('f') >= 0) return out(+a.L, 'fossil', '', null);
    if (x.indexOf('l') < 0) return out(+a.L, 'species', '', SPECIES_LEN_SRC[id] || null);
    return out(+a.L, 'genus', '', null);
  }
  return out(+p.length || 1, 'genus', '', null);
}
export function webglAvailable() { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } }
export const _internals = { realism, realLook, realGroup, buildHeadSkin, headSkinHeights, normProfile, makeBodyFns, makePose, loadEnv, autoProfile, withLook, buildBody, buildEyes, buildMouth, headData, scaleLattice, patternData }; // for offline checks
