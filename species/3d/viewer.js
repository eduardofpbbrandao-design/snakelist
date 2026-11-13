// SnakeList "Explore in 3D": a procedural, species-specific snake model in a small habitat scene.
// Loaded on demand by sp.js (species pages) only when the viewer is opened. Everything is built in
// the browser from a per-species profile (species/3d/models.json, made from data/snake-models.json):
// spine and pose, a swept body with a real taper and a species head, eyes, a scale normal map and a
// pattern texture generated from the profile's parameters. Units are metres.
// three.js (species/3d/three.module.min.js, vendored) is loaded by the page next to this module and
// handed in with useThree(), so a failed download can be retried under a fresh URL
let THREE = null;
// v4.80: the realistic scenery (trees, 3D leaf litter, rocks, sky) lives in nature.js
import * as NATURE from './nature.js';
export function useThree(t) { THREE = t; }

const TAU = Math.PI * 2;
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
  viper:    { body: { ld: 15, neck: 0.42, peak: 0.45, vent: 0.62, tail: 0.10, xs: 1.32, bf: 0.72 }, head: { shape: 'tri', len: 0.065, w: 1.05, h: 0.58, snout: 0.5, jaw: 0.78, eyeX: 0.27, eyeA: 70, taper: 0.3, eye: 0.13, pupil: 'slit', brow: 0.10, canthus: 3.0 }, scales: { rows: 31, keel: 0.85, gloss: 0.12, aV: 0.76 }, pose: { kind: 'coil' } },
  pitviper: { body: { ld: 22, neck: 0.48, peak: 0.45, vent: 0.62, tail: 0.085, xs: 1.25, bf: 0.74 }, head: { shape: 'tri', len: 0.05, w: 1.0, h: 0.6, snout: 0.5, jaw: 0.8, eyeX: 0.3, eyeA: 70, taper: 0.3, eye: 0.12, pupil: 'slit', brow: 0.10, canthus: 3.0, pits: 'loreal' }, scales: { rows: 27, keel: 0.85, gloss: 0.12, aV: 0.76 }, pose: { kind: 'coil' } },
  python:   { body: { ld: 30, neck: 0.55, peak: 0.5, vent: 0.62, tail: 0.12, xs: 1.18, bf: 0.76 }, head: { len: 0.035, w: 0.68, h: 0.6, snout: 0.62, jaw: 0.78, eyeX: 0.3, eyeA: 62, eye: 0.13, pupil: 'slit', brow: 0.03, canthus: 2.6, pits: 'labial' }, scales: { rows: 71, keel: 0, gloss: 0.5, aV: 0.8 }, pose: { kind: 'coil' } },
  colubrid: { body: { ld: 36, neck: 0.78, peak: 0.42, vent: 0.62, tail: 0.24, xs: 1.08, bf: 0.8 }, head: { len: 0.035, w: 1.05, h: 0.68, snout: 0.7, jaw: 0.72, eyeX: 0.3, eyeA: 60, eye: 0.16, pupil: 'round', brow: 0.02, canthus: 2.4 }, scales: { rows: 19, keel: 0, gloss: 0.4, aV: 0.76 }, pose: { kind: 'wave' } },
  elapid:   { body: { ld: 45, neck: 0.85, peak: 0.45, vent: 0.62, tail: 0.18, xs: 1.05, bf: 0.8 }, head: { len: 0.032, w: 0.95, h: 0.62, snout: 0.62, jaw: 0.75, eyeX: 0.3, eyeA: 60, eye: 0.15, pupil: 'round', brow: 0.02, canthus: 2.6 }, scales: { rows: 17, keel: 0, gloss: 0.45, aV: 0.76 }, pose: { kind: 'wave' } },
  blind:    { body: { ld: 42, neck: 1.0, peak: 0.5, vent: 0.97, tail: 0.022, xs: 1.0, bf: 0.9, blunt: true }, head: { shape: 'blunt', len: 0.022, w: 0.98, h: 0.8, snout: 0.9, jaw: 0.6, eyeX: 0.32, eyeA: 55, eye: 0.16, pupil: 'none', brow: 0, canthus: 2.0 }, scales: { rows: 20, keel: 0, gloss: 0.85, aV: 0.97, kind: 'cycloid' }, pose: { kind: 'wave' } },
  sea:      { body: { ld: 30, neck: 0.62, peak: 0.55, vent: 0.75, tail: 0.11, xs: 0.72, bf: 0.85, paddle: true }, head: { len: 0.045, w: 0.75, h: 0.72, snout: 0.6, jaw: 0.75, eyeX: 0.3, eyeA: 52, eye: 0.13, pupil: 'round', brow: 0, canthus: 2.2 }, scales: { rows: 47, keel: 0, gloss: 0.35, aV: 0.95, kind: 'juxta' }, pose: { kind: 'wave' } },
};
function merge(a, b) { const o = Object.assign({}, a); for (const k in b) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a && typeof a[k] === 'object' ? merge(a[k], b[k]) : b[k]; return o; }
function normProfile(p) {
  const base = PLANS[p.plan] || PLANS.colubrid;
  const q = merge(merge(base, { colors: { dorsal: '#776655', lateral: null, belly: '#d8cfb8', mottle: 0.08, var: 0.05 }, pattern: [], tail: {}, scene: { kind: 'litter' } }), p);
  q.colors.lateral = q.colors.lateral || q.colors.dorsal;
  // v4.81: colubrids, elapids and sea snakes have big head shields: their sutures are drawn on the head, and the
  // small-scale relief is left off it
  if ((q.plan === 'colubrid' || q.plan === 'elapid' || q.plan === 'sea' || !PLANS[q.plan]) && q.head.plates == null) {
    q.head = Object.assign({}, q.head, { plates: true });
    if (!q.pattern.some((l) => l.type === 'shields')) q.pattern = q.pattern.concat([{ type: 'shields', color: shade(q.colors.dorsal, 0.55), alpha: 0.3, wid: 0.009, barColor: shade(q.colors.dorsal, 0.5), barAlpha: 0.22, barWid: 0.009, labials: q.plan === 'elapid' ? 7 : 8 }]);
  }
  return q;
}

// ---------- generated profiles (v4.63): every species without a hand-made profile ----------
// tools/auto_models.py writes a short entry ({ auto: { p plan, L length, d/c/b colours, t pattern, n marks,
// s scene, k keeled, x flags } }); this turns it into a full profile with the same layer types the
// hand-made ones use. Flags: f fossil, e extinct, g colours guessed, l length typical for its group.
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
      T({ type: 'blotch', count: n, a: 0, wid: 0.34, len: 0.62, shape: 'round', color: c, edgeColor: shade(c, 0.6), edge: 0.12 });
      T({ type: 'blotch', count: n, phase: 0.5, a: 0.56, mirror: true, wid: 0.13, len: 0.42, shape: 'round', color: c, alpha: 0.85, jit: 0.22, sj: 0.3 }); break;
    case 'saddle': T({ type: 'blotch', count: n, a: 0, wid: 0.44, len: 0.42, shape: 'saddle', color: c, edgeColor: shade(c, 0.65), edge: 0.1 }); break;
    case 'diamond':
      T({ type: 'blotch', t: [0.06, 0.86], count: Math.round(n * 0.8), a: 0, wid: 0.44, len: 1.0, shape: 'diamond', color: c, edgeColor: pale, edge: 0.16, edgeOut: true, warp: 0.35, jit: 0.05 });
      T({ type: 'band', t: [0.87, 0.985], count: 6, len: 0.5, color: '#17130f', warp: 0.2, jit: 0.02 }); break;
    case 'hourglass': T({ type: 'blotch', count: Math.round(n * 0.8), a: 0, wid: 0.62, len: 0.82, shape: 'hourglass', color: c, edgeColor: pale, edge: 0.12, edgeOut: true, warp: 0.4 }); break;
    case 'chevron': T({ type: 'blotch', count: Math.round(n * 0.7), a: 0, wid: 0.42, len: 0.55, shape: 'chevron', color: c, edgeColor: pale, edge: 0.14, edgeOut: true }); break;
    case 'zigzag':
      T({ type: 'zigzag', count: n, amp: 0.12, wid: 0.075, color: c, warp: 0.6, aa: 0.2 });
      T({ type: 'blotch', count: n, a: 0.5, mirror: true, wid: 0.09, len: 0.4, shape: 'round', color: c, alpha: 0.8 }); break;
    case 'band': T({ type: 'band', count: Math.round(n * 0.7), len: 0.36, color: c, warp: 0.3, jit: 0.06 }); break;
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
    case 'ocelli': // big round dark spots on the back, pale-centred ones along the flanks (anacondas)
      T({ type: 'blotch', count: Math.round(n * 1.1), a: 0.12, mirror: true, alt: true, wid: 0.14, len: 0.5, shape: 'round', color: c, warp: 0.4, jit: 0.2, sj: 0.25 });
      T({ type: 'blotch', count: Math.round(n * 1.6), a: 0.52, mirror: true, wid: 0.1, len: 0.32, shape: 'round', color: c, inner: { r: 0.55, color: a.oc || shade(b, 0.95) }, warp: 0.4, jit: 0.3, sj: 0.3 }); break;
  }
  // optional extras on any pattern: a pale upper lip, a stripe along the flanks or the spine, a coloured tail tip or head
  if (a.lip) pat.push({ type: 'line', p0: [0.03, 0.5], p1: [1.15, 0.54], wid: 0.05, color: a.lip, mirror: true, aa: 0.4 });
  if (a.ls) T({ type: 'stripe', t: [0.03, 0.9], a: a.ls[1] != null ? a.ls[1] : 0.6, mirror: true, wid: a.ls[2] || 0.03, color: a.ls[0], aa: 0.35 });
  if (a.vs) T({ type: 'stripe', t: [0.03, 0.97], a: 0, wid: a.vs[1] || 0.03, color: a.vs[0], aa: 0.35 });
  if (a.tt) T({ type: 'tint', t: [0.86, 1], ramp: 0.06, color: a.tt, alpha: 0.95 });
  if (a.hc) pat.push({ type: 'cap', x0: 0, x1: a.hcx || 1.0, wid: 0.62, color: a.hc });
  if (a.pat) for (const l of a.pat) pat.push(Object.assign({}, l));
  const colors = { dorsal: d, lateral: hexOf(mixc(hex(d), hex(b), 0.18)), belly: b, mottle: fossil ? 0.12 : 0.08, var: 0.05 };
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
  if (a.cx) Object.assign(colors, a.cx);
  if (a.sx) o.scales = Object.assign(o.scales || {}, a.sx);
  if (a.bx) o.body = Object.assign(o.body || {}, a.bx);
  if (a.ps) o.pose = a.ps;
  if (a.sp) Object.assign(o.scene, a.sp);
  if (a.lat) colors.lateral = a.lat;
  if (a.tl) o.tail = a.tl;
  if (x.includes('l')) o.lengthNote = 'a typical size for its group - SnakeList has no measured length for this species yet';
  else if (fossil) o.lengthNote = 'estimated from its fossil bones';
  o.details = fossil ? [['back', 'Colours are a guess: fossils keep no colour']] : x.includes('g') ? [['back', 'Colours are a guess: no photo yet']] : [];
  return o;
}

// ---------- the snake: body profile functions ----------
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
  const back = Hd.back != null ? Hd.back : shape === 'blunt' ? 1 : lerp(0.92, 0.8, (hw - B.neck) / Math.max(0.01, hw)) * (shape === 'tri' ? 0.95 : 1);
  const neckLen = Hd.neckLen != null ? Hd.neckLen : shape === 'tri' ? 0.32 : 0.5;
  const tip = Hd.tip != null ? Hd.tip : shape === 'blunt' ? 0.75 : 0.55;
  const pts = [
    [0, 0], [Hl * 0.012, hw * sn * tip], [Hl * 0.045, hw * sn * lerp(tip, 1, 0.6)], [Hl * 0.13, hw * sn],
    [Hl * 0.45, hw * mid], [Hl * jaw, hw], [Hl * 1.0, hw * back],
    [Hl * (1.0 + neckLen), Math.min(hw * back, B.neck)],
    [L * Math.max(B.peak, (Hl * 2.6) / L), 1], [L * (1 - B.tail), B.vent]];
  if (B.blunt) pts.push([L * (1 - B.tail * 0.35), B.vent * 0.92], [L * (1 - B.tail * 0.06), B.vent * 0.7], [L, 0]);
  else if (P.tail.rattle) pts.push([L * (1 - B.tail * 0.5), B.vent * 0.62], [L, B.vent * 0.36]);
  else if (B.paddle) pts.push([L * (1 - B.tail * 0.5), B.vent * 0.42], [L * (1 - B.tail * 0.08), 0.18], [L, 0]);
  else pts.push([L * (1 - B.tail * 0.55), B.vent * 0.5], [L * (1 - B.tail * 0.12), B.vent * 0.16], [L, 0]);
  // keep x strictly increasing
  for (let i = 1; i < pts.length; i++) if (pts[i][0] <= pts[i - 1][0]) pts[i][0] = pts[i - 1][0] + 1e-6 * L;
  const wr = pchip(pts);
  const rattleEnd = !!P.tail.rattle;
  const W = (x) => {
    let v = wr(x) * w0;
    if (x < Hl * 0.03) v *= Math.sqrt(clamp(x / (Hl * 0.03), 0, 1)) * 0.25 + 0.75 * clamp(x / (Hl * 0.03), 0, 1) ** 0.35;
    if (!rattleEnd) { const e = L - x, r = B.blunt ? w0 * 0.5 : w0 * 0.12; if (e < r) v *= Math.sqrt(clamp(e / r, 0, 1)); }
    return Math.max(v, 0);
  };
  // height/width ratio: head (flattened), body, and a paddle-shaped tail for sea snakes
  const xsHead = 1 / Hd.h, xsBody = B.xs;
  const XS = (x) => {
    let k = lerp(xsHead, xsBody, sstep(Hl * 0.75, Hl * 1.6, x));
    if (B.paddle) k = lerp(k, 0.2, sstep(L * (1 - B.tail * 1.4), L * (1 - B.tail * 0.6), x));
    return k;
  };
  // the head's depth follows its own profile (low snout, flat crown), not its outline, so a broad
  // viper head does not bulge upward at the jaw angles; it then blends into the neck
  const headH = hw * w0 * Hd.h, snH = Hd.snoutH != null ? Hd.snoutH : 0.62;
  const Hh = (x) => {
    let h = W(x) / XS(x);
    if (x < Hl * (1 + neckLen)) {
      const tipF = x < Hl * 0.13 ? Math.sqrt(clamp(W(x) / (hw * w0 * sn), 0, 1)) : 1;
      const hd = headH * lerp(snH, 1, sstep(0, Hl * 0.55, x)) * tipF;
      h = lerp(hd, h, sstep(Hl * 0.85, Hl * (1 + neckLen * 0.9), x));
    }
    if (B.paddle) { const e = L - x, r = w0 * 0.9; if (e < r) h *= Math.sqrt(clamp(e / r, 0, 1)); }
    return h;
  };
  return { L, D, w0, Hl, W, Hh, XS, bf: B.bf };
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
  let pts = null;
  if (pose.kind === 'coil') {
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
  } else {
    // a sine-generated curve: the classic resting/crawling S-shape of a snake
    const waves = pose.waves || clamp(L / (wMax * 2 * 14), 1.2, 3.2);
    let amp = ((pose.amp || 62) * Math.PI) / 180;
    const bend = ((pose.bend || 50) * Math.PI) / 180, ph = pose.phase != null ? pose.phase : 0.15;
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
    while (s < coilLen) { out.push([Math.cos(th) * r, Math.sin(th) * r * sq]); const dth = ds / Math.sqrt(r * r + b * b); th += dth; r += b * dth * (1 + wob * Math.sin(th * 1.3 + ph0)); s += ds; }
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
  }
  const eAt = (x) => { const f = clamp(x / ds, 0, N - 1.0001), i = Math.floor(f), t = f - i; return lerp(E[i], E[i + 1], t); };
  const Ly = (x) => lift * (1 - sstep(F.Hl * 0.7, liftLen, x)) + eAt(x);
  return { pts, at, Ly, ds, N, stacked };
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
  const nR = clamp(Math.round(gTotal * M / 2.2), 220, quality === 'low' ? 900 : 2400);
  const ringX = []; for (let i = 0; i < nR; i++) ringX.push(xOf((i / (nR - 1)) * gTotal));
  ringX[0] = 0; ringX[nR - 1] = L;

  const Hd = P.head, eyeA = (Hd.eyeA * Math.PI) / 180, mouthA = Math.PI * 0.56;
  const bumps = [];
  if (Hd.brow) bumps.push({ x: Hd.eyeX * F.Hl, xs: F.Hl * 0.16, th: eyeA - 0.42, ts: 0.32, amp: Hd.brow, mirror: true });
  if (Hd.pits === 'loreal') bumps.push({ x: F.Hl * 0.15, xs: F.Hl * 0.035, th: Math.PI * 0.5, ts: 0.09, amp: -0.07, mirror: true });
  // heat pits only where the species has them: one loreal pit (pit vipers), a row in the lip scales (pythons)
  if (Hd.pits === 'labial') for (let k = 0; k < 5; k++) bumps.push({ x: F.Hl * (0.03 + k * 0.06), xs: F.Hl * 0.016, th: Math.PI * (k ? 0.52 : 0.2), ts: 0.05, amp: -0.05, mirror: true });
  bumps.push({ x: F.Hl * 0.05, xs: F.Hl * 0.022, th: Hd.nostrilA != null ? (Hd.nostrilA * Math.PI) / 180 : eyeA * 0.62, ts: 0.1, amp: -0.06, mirror: true }); // nostril (upward-facing in water snakes)
  if (Hd.snoutUp) bumps.push({ x: F.Hl * 0.03, xs: F.Hl * 0.05, th: 0, ts: 0.7, amp: Hd.snoutUp });
  const nTop = (x) => lerp(Hd.canthus, 2.15, sstep(F.Hl * 0.8, F.Hl * 1.6, x));
  // v4.81: an eye socket - the skin dips gently where the eye sits, so the domed eye under its clear
  // spectacle scale lies flush with the head (never standing out of its outline)
  const eyeX0 = Hd.eyeX * F.Hl, eyeRad = (Hd.eye || 0.15) * F.W(eyeX0) * 1.04, eyeRl = (F.W(eyeX0) + F.Hh(eyeX0)) / 2;
  if (Hd.pupil !== 'none') bumps.push({ x: eyeX0, xs: eyeRad * 0.95, th: eyeA, ts: (eyeRad * 0.95) / eyeRl, amp: -(eyeRad * 0.2) / eyeRl, mirror: true, sock: true });

  // spine point & frame at x
  const spine = (x) => { const p = pose.at(x); return new THREE.Vector3(p[0], F.Hh(x) * F.bf + pose.Ly(x), p[1]); };
  const frameAt = (x) => {
    const e = Math.max(L * 0.0015, 1e-5), a = spine(Math.max(0, x - e)), b = spine(Math.min(L, x + e));
    const T = b.sub(a).normalize(); const U = new THREE.Vector3(0, 1, 0).addScaledVector(T, -T.y).normalize();
    const S = new THREE.Vector3().crossVectors(T, U).normalize(); return { T, U, S };
  };
  // the cross-section point at x and angle th (0 = top of the back, +/-pi = belly midline)
  const section = (x, th, noSock) => {
    const W = F.W(x), H = F.Hh(x), st = Math.sin(th), ct = Math.cos(th), head = x < F.Hl * 1.05;
    const n = ct >= 0 ? nTop(x) : 3.0;
    let sx = Math.sign(st) * Math.abs(st) ** (2 / n), sy = Math.sign(ct) * Math.abs(ct) ** (2 / n);
    if (ct < 0) { sy *= F.bf; if (head) sx *= lerp(0.86, 1, sstep(F.Hl * 0.6, F.Hl * 1.1, x)); }
    if (head && ct > 0) sx *= 1 - (Hd.taper || 0.2) * sy * (1 - sstep(F.Hl * 0.85, F.Hl * 1.25, x));
    let k = 1;
    for (const b of bumps) {
      const dx = (x - b.x) / b.xs; if (Math.abs(dx) > 3 || (noSock && b.sock)) continue;
      const dth1 = Math.atan2(Math.sin(th - b.th), Math.cos(th - b.th)), dth2 = Math.atan2(Math.sin(th + b.th), Math.cos(th + b.th));
      k += b.amp * Math.exp(-dx * dx) * (Math.exp(-((dth1 / b.ts) ** 2)) + (b.mirror ? Math.exp(-((dth2 / b.ts) ** 2)) : 0));
    }
    if (x < F.Hl * Hd.jaw * 1.1 && x > F.Hl * 0.02) { // the mouth line
      const dm = Math.min(Math.abs(Math.abs(th) - mouthA), 1);
      k -= 0.055 * Math.exp(-((dm / 0.085) ** 2)) * sstep(F.Hl * 0.02, F.Hl * 0.1, x) * (1 - sstep(F.Hl * Hd.jaw * 0.85, F.Hl * Hd.jaw * 1.1, x));
    }
    return [W * sx * k, H * sy * k];
  };

  const nV = nR * (M + 1), pos = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), hd = new Float32Array(nV), met = new Float32Array(nV * 3);
  const plates = P.head.plates ? 1 : 0; // big head shields: the small body-scale relief fades out on the head
  const frames = [];
  for (let i = 0; i < nR; i++) {
    const x = ringX[i], c = spine(x), f = frameAt(x); frames.push({ x, c, f });
    const v = gOf(x) / gTotal, cx = circ(x), headW = (1 - plates) * (1 - sstep(F.Hl * 0.82, F.Hl * 1.18, x));
    for (let j = 0; j <= M; j++) {
      const u = j / M, th = TAU * u - Math.PI, s = section(x, th), k = (i * (M + 1) + j);
      pos[k * 3] = c.x + f.S.x * s[0] + f.U.x * s[1]; pos[k * 3 + 1] = c.y + f.S.y * s[0] + f.U.y * s[1]; pos[k * 3 + 2] = c.z + f.S.z * s[0] + f.U.z * s[1];
      uv[k * 2] = u; uv[k * 2 + 1] = v; hd[k] = plates * (1 - sstep(F.Hl * 0.92, F.Hl * 1.12, x)) * (Math.abs(th) < Math.PI * 0.62 ? 1 : 0.85);
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
  return { geo, gTotal, gOf, xOf, nR, M, ringX, spine, frameAt, section, surf, surfNormal, eyeA, mouthA, eyeRad, eyeRl };
}

// ---------- textures generated per species ----------
function scaleLattice(P, gTotal) {
  const S = P.scales, aV = S.aV, R = S.rows, rw = (2 * aV) / R;
  const Wt = R > 40 ? 2048 : 1024; // v4.72: twice as sharp
  // scale pitch along the body (girth units), rounded so the tile has a whole number of pixels
  let Ht = Math.max(8, Math.round(Wt * (S.kind === 'juxta' ? 1.0 : 1.25) * aV / R * (S.pitch || 1)));
  if (Ht % 2) Ht++;
  const Pt = Ht / Wt;
  const cell = (a, g) => {
    if (Math.abs(a) > aV) { const j = Math.floor(g / Pt); return { ac: a, gc: (j + 0.5) * Pt, id: j * 7919 + (a > 0 ? 1 : 2), v: true, w: 1 }; }
    const i = Math.floor((a + aV) / rw), off = (i & 1) * Pt / 2, j = Math.floor((g - off) / Pt);
    const ac = -aV + (i + 0.5) * rw, gc = off + (j + 0.5) * Pt, lx = (a - ac) / rw, ly = (g - gc) / Pt;
    // w: how far inside the scale (1 in the middle, 0 at its edges), so per-scale colour blends softly
    return { ac, gc, id: i * 100003 + j * 7, v: false, i, j, w: clamp(1 - (lx * lx * 3.2 + ly * ly * 2.6), 0, 1) };
  };
  return { aV, R, rw, Wt, Ht, Pt, cell };
}

// the scale tile: normal map (rgb) plus a cavity/roughness map, one tile = full circumference x one scale pitch
function scaleTextures(P, lat) {
  const { Wt, Ht, aV, rw, Pt } = lat, S = P.scales, keel = S.keel || 0, kind = S.kind || 'imbricate';
  const h = new Float32Array(Wt * Ht);
  for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) {
    const a = ((x + 0.5) / Wt) * 2 - 1, g = ((y + 0.5) / Ht) * Pt;
    let best = 0;
    if (Math.abs(a) > aV) { // ventral scutes: wide plates
      const yy = g / Pt; best = 0.55 + 0.35 * yy - 0.5 * Math.exp(-(((yy) / 0.06) ** 2)) - 0.5 * Math.exp(-(((1 - yy) / 0.04) ** 2));
      best -= 0.4 * Math.exp(-(((Math.abs(a) - aV) / 0.01) ** 2));
    } else {
      const i0 = Math.floor((a + aV) / rw);
      for (let di = -1; di <= 1; di++) {
        const i = i0 + di, ac = -aV + (i + 0.5) * rw, off = (((i % 2) + 2) % 2) * Pt / 2;
        for (let dj = -1; dj <= 2; dj++) {
          const j = Math.floor((g - off) / Pt) + dj - 1, gc = off + (j + 0.5) * Pt;
          const lx = (a - ac) / rw, ly = (g - gc) / Pt;
          let hv;
          if (kind === 'juxta' || kind === 'cycloid') {
            const wx = kind === 'juxta' ? 0.52 : 0.66, wy = kind === 'juxta' ? 0.52 : 0.72;
            const d = (lx / wx) ** 2 + (ly / wy) ** 2; if (d >= 1) continue;
            hv = Math.sqrt(1 - d) * (kind === 'cycloid' ? 0.6 + 0.4 * (ly / wy + 1) / 2 : 1);
          } else {
            const wy = 0.92, t = clamp((ly / wy + 1) / 2, 0, 1), wx = 0.64 * (1 - 0.55 * t * t);
            const d = (lx / wx) ** 2 + (ly / wy) ** 2; if (d >= 1) continue;
            hv = Math.sqrt(1 - d) * 0.45 + 0.55 * t; // rises toward the free (rear) tip that overlaps the next scale
            if (keel) hv += keel * 0.38 * Math.exp(-((lx / 0.075) ** 2)) * sstep(-0.9, -0.2, ly / wy);
          }
          if (hv > best) best = hv;
        }
      }
    }
    h[y * Wt + x] = best;
  }
  const nData = new Uint8Array(Wt * Ht * 4), cData = new Uint8Array(Wt * Ht * 4);
  const str = (S.normal || 1) * (kind === 'imbricate' ? 2.2 : 1.6);
  const H = (x, y) => h[((y + Ht) % Ht) * Wt + ((x + Wt) % Wt)];
  for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * str, dy = (H(x, y + 1) - H(x, y - 1)) * str;
    const l = Math.hypot(dx, dy, 1), k = (y * Wt + x) * 4;
    nData[k] = (-dx / l * 0.5 + 0.5) * 255; nData[k + 1] = (-dy / l * 0.5 + 0.5) * 255; nData[k + 2] = (1 / l * 0.5 + 0.5) * 255; nData[k + 3] = 255;
    const hv = H(x, y), cav = sstep(0.0, 0.3, hv);
    cData[k] = (0.35 + 0.65 * cav) * 255;                    // cavity (darkens the skin between scales)
    cData[k + 1] = (lerp(1.0, 0.82, cav) + keel * 0.08) * 230; // roughness
    cData[k + 2] = 255; cData[k + 3] = 255;
  }
  const mk = (d) => { const t = new THREE.DataTexture(d, Wt, Ht, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  return { normal: mk(nData), cavity: mk(cData) };
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
function patternInWorker(P, quality, seed) {
  return new Promise((res, rej) => {
    let w; try { w = new Worker(import.meta.url, { type: 'module' }); } catch (e) { rej(e); return; }
    const t = setTimeout(() => { w.terminate(); rej(new Error('timeout')); }, 30000);
    w.onmessage = (e) => { clearTimeout(t); w.terminate(); if (e.data && e.data.data) res(e.data); else rej(new Error('worker')); };
    w.onerror = (e) => { clearTimeout(t); w.terminate(); rej(e); };
    w.postMessage({ slPattern: 1, P, quality, seed });
  });
}
if (typeof window === 'undefined' && typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = (e) => {
    const m = e.data; if (!m || !m.slPattern) return;
    try {
      const F = makeBodyFns(m.P, m.quality), g = girthOf(F), lat = scaleLattice(m.P, g.gTotal), d = patternData(m.P, F, g, lat, m.quality, m.seed);
      self.postMessage(d, [d.data.buffer]);
    } catch (err) { self.postMessage({ error: String(err) }); }
  };
}
function patternData(P, F, body, lat, quality, seed) {
  const Wp = quality === 'low' ? 192 : quality === 'preview' ? 160 : 512; // v4.72: twice as sharp on good devices
  const Hp = clamp(Math.round(body.gTotal * Wp * 0.62), 256, quality === 'high' ? 8192 : 2048);
  const C = P.colors, dors = hex(C.dorsal), latc = hex(C.lateral), bel = hex(C.belly);
  const bellyA = C.bellyA || 0.74, bs = C.bellySharp || 0.06, mott = C.mottle, vari = C.var;
  const layers = (P.pattern || []).map((l) => prepLayer(l, F, body));
  for (const Ly of layers) if (Ly.type === 'shields') { Ly.segs = shieldSegs(P.head, Ly); Ly.bcol = Ly.barColor ? hex(Ly.barColor) : Ly.col; }
  const quant = P.quant != null ? P.quant : 0.15;
  const data = new Uint8ClampedArray(Wp * Hp * 4);
  const L = F.L, Hl = F.Hl;
  const tHead = (Hl * 1.15) / L;
  const cosA = new Float32Array(Wp), sinA = new Float32Array(Wp);
  for (let c = 0; c < Wp; c++) { const a = ((c + 0.5) / Wp) * 2 - 1; cosA[c] = Math.cos(Math.PI * a); sinA[c] = Math.sin(Math.PI * a); }
  for (let r = 0; r < Hp; r++) {
    const g = ((r + 0.5) / Hp) * body.gTotal, x = body.xOf(g), t = x / L, xn = x / Hl;
    // v4.81: on the narrowing head the noise follows the real girth, so it does not streak towards the snout
    const rk = x < Hl * 1.6 ? clamp((F.W(x) + F.Hh(x)) / (F.W(Hl * 1.6) + F.Hh(Hl * 1.6)), 0.12, 1) : 1;
    for (let c = 0; c < Wp; c++) {
      const a = ((c + 0.5) / Wp) * 2 - 1, cl = lat.cell(a, g);
      const q = x < Hl * 1.1 ? 0.25 : quant;
      const aq = a + (cl.ac - a) * q, gq = g + (cl.gc - g) * q;
      const nx = Math.cos(Math.PI * aq) * 0.9 * rk, ny = Math.sin(Math.PI * aq) * 0.9 * rk;
      const wn = vnoise(nx * 2.2, ny * 2.2, gq * 4.1, seed) - 0.5, wn2 = vnoise(nx * 6, ny * 6, gq * 11, seed + 9) - 0.5;
      const warp = wn + wn2 * 0.45;
      const aa = Math.abs(aq);
      let col = mixc(dors, latc, sstep(0.18, 0.62, aa));
      col = mixc(col, bel, sstep(bellyA - bs, bellyA + bs, aa + warp * (C.bellyWarp || 0.04)));
      const m = 1 + mott * (fbm(nx * 3, ny * 3, gq * 5.5, seed + 3, 3) - 0.5) * 2.4;
      col = [col[0] * m, col[1] * m, col[2] * m];
      for (const Ly of layers) {
        if (Ly.head) { if (xn > 2.2) continue; } else if (t < Ly.t0 - 0.02 || t > Ly.t1 + 0.02) continue;
        if (!Ly.belly && aa > bellyA + 0.02 && Ly.type !== 'band') continue;
        const res = evalLayer(Ly, aq, gq, t, xn, warp, cl, seed);
        if (res) col = mixc(col, res[0], res[1]);
      }
      const sv = 1 + vari * (hash1(cl.id, seed + 5) - 0.5) * 2 * (0.35 + 0.65 * cl.w) * sstep(Hl * 0.95, Hl * 1.15, x); // (v4.81: none on the head, where the body's scale cells would show as stripes)
      col = [col[0] * sv, col[1] * sv, col[2] * sv];
      if (C.scaleEdge && !cl.v && x > Hl * 1.05) col = mixc(col, hex(C.scaleEdge.color), (C.scaleEdge.k || 0.8) * Math.pow(1 - cl.w, 1.6));
      if (C.speckle && !cl.v && x > Hl) { const hs = hash1(cl.id, seed + 11); if (hs < C.speckle.p) col = mixc(col, hex(C.speckle.color), (C.speckle.k || 0.6) * (0.6 + hs / C.speckle.p * 0.4) * Math.sqrt(cl.w)); }
      const k = (r * Wp + c) * 4; data[k] = col[0]; data[k + 1] = col[1]; data[k + 2] = col[2]; data[k + 3] = 255;
    }
  }
  return { data, Wp, Hp };
}

function prepLayer(l, F, body) {
  const o = Object.assign({ t0: (F.Hl * 1.25) / F.L, t1: 1, a: 0, wid: 0.3, len: 0.6, phase: 0, warp: 0.5, edge: 0, aa: 0.1, jit: 0.12, sj: 0.18, aj: 0.05 }, l);
  if (l.t) { o.t0 = l.t[0]; o.t1 = l.t[1]; }
  o.col = hex(o.color); o.ecol = o.edgeColor ? hex(o.edgeColor) : null; o.icol = o.inner ? hex(o.inner.color) : null;
  o.head = ['line', 'poly', 'spot', 'cap', 'shields'].includes(o.type);
  o.g0 = body.gOf(o.t0 * F.L); o.g1 = body.gOf(o.t1 * F.L);
  if (o.count) o.period = (o.g1 - o.g0) / o.count;
  if (o.type === 'poly' && o.pts) o.pts2 = o.pts;
  return o;
}
function shapeD(shape, dv, da) {
  const v = Math.abs(dv), u = Math.abs(da);
  switch (shape) {
    case 'diamond': return v + u;
    case 'rect': return Math.pow(v ** 4 + u ** 4, 0.25);
    case 'hourglass': return Math.max(v / (0.35 + 0.65 * u), u);
    case 'chevron': return Math.max(Math.abs(dv + 1.1 * u), u); // a V whose arms run forward down the flanks (apex toward the tail)
    case 'saddle': return Math.max(Math.pow(v ** 3 + u ** 3, 1 / 3), u);
    case 'round': return Math.pow(v ** 2.6 + u ** 2.6, 1 / 2.6);
    default: return Math.sqrt(v * v + u * u);
  }
}
function cover(d, aa) { return 1 - sstep(1 - aa, 1 + aa, d); }
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
function inPoly(x, y, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }

// the large head plates of colubrids and elapids, as suture lines in (xn along the head, a around it),
// placed relative to the eye: rostral, internasals, prefrontals, frontal, supraoculars, parietals,
// pre- and postoculars, loreal, and the rows of upper and lower lip scales
function shieldSegs(H, Ly) {
  const E = H.eyeX, eA = H.eyeA / 180, er = (H.eye || 0.15) * 0.55, mA = 0.56, n = Ly.labials || 8, segs = [];
  const S = (x0, a0, x1, a1, bar) => segs.push([x0, a0, x1, a1, bar ? 1 : 0]);
  const f0 = E - er * 0.6, f1 = E + 0.3;               // frontal from beside the front of the eye to behind it
  S(0.0, 0, 0.055, 0); S(0.055, 0, f0, 0); S(f1, 0, 0.98, 0);  // midline sutures (none across the frontal)
  S(0.05, 0, 0.05, 0.2);                               // rostral / internasals
  S(0.13, 0, 0.13, 0.24);                              // internasals / prefrontals
  S(f0, 0, f0, eA - er * 0.7);                         // prefrontals / frontal and supraoculars
  S(f0, 0.085, E + 0.12, 0.08); S(E + 0.12, 0.08, f1, 0);       // frontal outline (a shield narrowing behind)
  S(E + 0.16, 0.085, E + 0.18, eA - er * 0.5);                // supraocular back edge
  S(f0, eA - er * 0.7, E + 0.16, eA - er * 0.5);              // supraocular rim over the eye
  S(E + 0.16, 0.24, 0.98, 0.36); S(E + 0.18, eA - er * 0.4, E + 0.3, eA + 0.02); // parietal outer edge, temporals
  S(E - er * 1.1, eA - er * 0.3, E - er * 1.1, eA + er * 0.6);  // preocular
  S(E + er * 1.1, eA - er * 0.6, E + er * 1.2, eA + er * 0.7);  // postoculars
  S(E + er * 1.15, eA, E + er * 1.7, eA + 0.01);
  S(0.13, 0.24, 0.13, 0.42); S(0.05, 0.2, 0.06, 0.44); S(0.13, 0.33, E - er * 1.1, 0.33); // nasal, loreal
  S(0.03, mA - 0.13, E + 0.3, mA - 0.13);                     // top edge of the upper lip scales
  for (let k = 1; k < n; k++) { const x = 0.04 + (k / n) * (E + 0.48); S(x, mA - 0.14, x + 0.01, mA - 0.005, 1); S(x - 0.02, mA + 0.005, x - 0.03, mA + 0.1, 2); }
  return segs;
}

function evalLayer(Ly, a, g, t, xn, warp, cl, seed) {
  if (Ly.type === 'shields') {
    if (xn > 1.05) return null;
    let d = 1e9, bar = 0; const aa = Math.abs(a);
    for (const q of Ly.segs) { const v = segDist(xn, aa, q[0], q[1], q[2], q[3]) / (q[4] ? Ly.barWid || Ly.wid * 2.2 : Ly.wid); if (v < d) { d = v; bar = q[4]; } }
    const c = cover(d + warp * 0.15, Ly.aa || 0.35); return c > 0.01 ? [bar ? Ly.bcol : Ly.col, c * (bar ? (Ly.barAlpha || 0.85) * (bar === 2 ? 0.45 : 1) : Ly.alpha || 0.6)] : null;
  }
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
    const aw = Ly.aRange || [0, 1]; const k = sstep(Ly.t0, Ly.t0 + (Ly.ramp || 0.1), t) * (1 - sstep(Ly.t1 - 0.001, Ly.t1, t)) * (Math.abs(a) >= aw[0] && Math.abs(a) <= aw[1] ? 1 : 0);
    return k > 0 ? [Ly.col, k * (Ly.alpha || 1)] : null;
  }
  if (Ly.type === 'zigzag') {
    for (const sg of sides) {
      const ph = (g - Ly.g0) / Ly.period + Ly.phase + (sg < 0 && Ly.alt ? 0.5 : 0), tri = 2 * Math.abs(2 * (ph - Math.floor(ph + 0.5))) - 1;
      const ac = (Ly.a + Ly.amp * tri) * sg + warp * Ly.warp * 0.06, w = Ly.wid * (1 + warp * 0.3);
      const d = Math.abs(a - ac) / w;
      let r = null;
      if (Ly.ecol && d < 1 + Ly.edge + Ly.aa && d >= 1 - Ly.aa) r = [Ly.ecol, (1 - sstep(1 + Ly.edge - Ly.aa, 1 + Ly.edge + Ly.aa, d)) * fadeT];
      else { const c = cover(d, Ly.aa) * fadeT; if (c > 0.001) r = [Ly.col, c * (Ly.alpha || 1)]; }
      if (r && (!best || r[1] > best[1])) best = r;
    }
    return best;
  }
  if (Ly.type === 'line' || Ly.type === 'spot' || Ly.type === 'poly' || Ly.type === 'cap') {
    // head markings: xn = position along the head (0 snout tip, 1 back of the head), a = around
    for (const sg of sides) {
      let c = 0;
      if (Ly.type === 'line') { const d = segDist(xn, a * sg, Ly.p0[0], Ly.p0[1], Ly.p1[0], Ly.p1[1]) / Ly.wid; c = cover(d + warp * Ly.warp * 0.3, Ly.aa); }
      else if (Ly.type === 'spot') { const d = Math.hypot((xn - Ly.p[0]) / Ly.r[0], (a * sg - Ly.p[1]) / Ly.r[1]); c = cover(d + warp * Ly.warp * 0.3, Ly.aa); }
      else if (Ly.type === 'cap') { c = (1 - sstep(Ly.x1 - 0.06, Ly.x1 + 0.06, xn + warp * 0.1)) * sstep(Ly.x0 - 0.03, Ly.x0 + 0.03, xn) * (1 - sstep(Ly.wid - 0.04, Ly.wid + 0.04, Math.abs(a) + warp * 0.05)); }
      else { c = inPoly(xn + warp * Ly.warp * 0.05, a * sg, Ly.pts2) ? 1 : 0; }
      if (c > 0.001 && (!best || c > best[1])) best = [Ly.col, c * (Ly.alpha || 1)];
    }
    return best;
  }
  // periodic marks: blotch / band / diamond ... along the body
  const per = Ly.period; if (!per) return null;
  for (const sg of sides) {
    const ph = Ly.phase + (Ly.alt && sg < 0 ? 0.5 : 0);
    const k0 = Math.floor((g - Ly.g0) / per - ph);
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const r1 = hash1(k * 3 + (sg < 0 ? 101 : 0), seed + 21), r2 = hash1(k * 5 + 7 + (sg < 0 ? 211 : 0), seed + 22), r3 = hash1(k * 11 + 3, seed + 23);
      if (Ly.skip && r3 < Ly.skip) continue;
      const gc = Ly.g0 + (k + ph + 0.5 + (r1 - 0.5) * Ly.jit * 2) * per;
      const sz = 1 + (r2 - 0.5) * Ly.sj * 2;
      const halfLen = (Ly.len * per) / 2 * sz;
      const ac = Ly.type === 'band' ? 0 : (Ly.a + (r1 - 0.5) * Ly.aj * 2) * sg;
      const dv = (g - gc) / halfLen;
      if (Math.abs(dv) > 2.2) continue;
      let d;
      if (Ly.type === 'band') d = Math.abs(dv) + warp * Ly.warp * 0.5 + (Ly.dorsalWide ? -Ly.dorsalWide * (1 - Math.abs(a)) : 0);
      else d = shapeD(Ly.shape, dv, (a - ac) / (Ly.wid * sz)) + warp * Ly.warp;
      let col = null, c = 0;
      if (Ly.icol && d < Ly.inner.r) { col = Ly.icol; c = cover(d / Ly.inner.r, Ly.aa * 2); col = mixc(Ly.col, Ly.icol, c); c = 1; }
      else if (d < 1 + Ly.aa) { col = Ly.col; c = cover(d, Ly.aa); }
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
const IRIS = { viper: ['#c79a3e', '#f0d27a'], pitviper: ['#c9a23a', '#f2dc7e'], python: ['#b98a46', '#e9c784'], colubrid: ['#c8862f', '#f1c063'],
  elapid: ['#8f6a3a', '#d9b06a'], sea: ['#8a7b56', '#cdbb88'], blind: ['#5a4a3a', '#8a7a62'] };
function brightIris(P) {
  const def = IRIS[P.plan] || IRIS.colubrid, H = P.head || {};
  let c = new THREE.Color(H.iris || def[0]), inner = new THREE.Color(H.irisInner || def[1]);
  if (H.irisDark) return ['#' + c.getHexString(), '#' + inner.getHexString()]; // v4.81: some snakes really have a near-black iris (green snakes)
  const hsl = {}; c.getHSL(hsl); if (hsl.l < 0.38) c.setHSL(hsl.h, Math.max(hsl.s, 0.45), 0.42); // a dark iris read as a black dot
  inner.getHSL(hsl); if (hsl.l < 0.55) inner.setHSL(hsl.h, Math.max(hsl.s, 0.5), 0.62);
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
    g.addColorStop(0, irisIn); g.addColorStop(0.55, iris); g.addColorStop(0.86, shade(iris, 0.62)); g.addColorStop(0.97, '#1a130b'); g.addColorStop(1, '#070605');
    x.fillStyle = g; x.beginPath(); x.arc(C, C, RI, 0, TAU); x.fill();
    // radial fibres, then small dark and gold flecks
    for (let i = 0; i < 520; i++) { const a = R() * TAU, r0 = RI * (0.18 + R() * 0.4), r1 = r0 + RI * (0.12 + R() * 0.38); x.strokeStyle = R() < 0.55 ? 'rgba(0,0,0,.16)' : 'rgba(255,244,210,.13)'; x.lineWidth = 0.6 + R() * 1.6; x.beginPath(); x.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0); x.quadraticCurveTo(C + Math.cos(a + 0.05) * (r0 + r1) / 2, C + Math.sin(a + 0.05) * (r0 + r1) / 2, C + Math.cos(a) * r1, C + Math.sin(a) * r1); x.stroke(); }
    for (let i = 0; i < 90; i++) { const a = R() * TAU, r = RI * (0.25 + R() * 0.62); x.fillStyle = R() < 0.6 ? 'rgba(10,6,2,.22)' : 'rgba(255,236,170,.18)'; x.beginPath(); x.arc(C + Math.cos(a) * r, C + Math.sin(a) * r, 1 + R() * 3.5, 0, TAU); x.fill(); }
    if (H.eyeStripe) { x.save(); x.beginPath(); x.arc(C, C, RI, 0, TAU); x.clip(); x.fillStyle = H.eyeStripe; x.globalAlpha = 0.78; x.fillRect(0, S * 0.37, S, S * 0.26); x.restore(); }
    if (H.eyeRing) { x.strokeStyle = H.eyeRing; x.lineWidth = S * 0.035; x.beginPath(); x.arc(C, C, RI * 0.97, 0, TAU); x.stroke(); }
    // the pupil, with a soft dark halo so its edge is not a hard cut-out
    const pupil = (grow, col) => { x.fillStyle = col; x.beginPath();
      if (H.pupil === 'slit') x.ellipse(C, C, S * (H.pupilW || 0.045) + grow, S * 0.36 + grow, 0, 0, TAU);
      else if (H.pupil === 'hslit') { x.ellipse(C, C, S * 0.3 + grow, S * 0.07 + grow, 0, 0, TAU); x.ellipse(C, C, S * 0.11 + grow, S * 0.11 + grow, 0, 0, TAU); }
      else if (H.pupil === 'round') x.arc(C, C, S * (H.pupilW || 0.2) + grow, 0, TAU);
      x.fill(); };
    if (H.pupil && H.pupil !== 'none') { pupil(S * 0.018, 'rgba(0,0,0,.35)'); pupil(0, '#020202'); }
    // a faint painted catch-light (the real reflections come from the glossy spectacle over the eye)
    const sh = x.createRadialGradient(S * 0.38, S * 0.34, 0, S * 0.38, S * 0.34, S * 0.1); sh.addColorStop(0, 'rgba(255,255,255,.35)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = sh; x.beginPath(); x.arc(S * 0.38, S * 0.34, S * 0.1, 0, TAU); x.fill();
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
  const H = P.head, xe = H.eyeX * F.Hl, R0 = body.eyeRad, rl = body.eyeRl, NR = 14, NA = 40, out = [];
  const et = eyeTexture(P); et.wrapS = et.wrapT = THREE.ClampToEdgeWrapping;
  const em = new THREE.MeshPhysicalMaterial({ map: et, roughness: 0.35, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: 0.9 });
  const sm = new THREE.MeshPhysicalMaterial({ vertexColors: true, transparent: true, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4, depthWrite: false, specularIntensity: 1 });
  const lm = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.6, metalness: 0, depthWrite: false, envMapIntensity: 0.8 });
  // the skin colour right round the eye, read from the body's own pattern texture
  const img = pat && pat.image, skinAt = (x, th) => {
    if (!img || !img.data) return [0.4, 0.4, 0.35];
    const u = clamp((th + Math.PI) / TAU, 0, 0.999), v = clamp(body.gOf(x) / body.gTotal, 0, 0.999), k = (Math.floor(v * img.height) * img.width + Math.floor(u * img.width)) * 4;
    const lin = (c) => Math.pow(c / 255, 2.2); return [lin(img.data[k]), lin(img.data[k + 1]), lin(img.data[k + 2])];
  };
  const bulge = H.bulge != null ? H.bulge : 0.1; // how far the spectacle rises above the head's outline (in eye radii)
  for (const sg of [1, -1]) {
    const th0 = sg * body.eyeA, c = body.surf(xe, th0, true).p;
    const eye = [], spec = [], uv = [], col = [], spa = [];
    for (let i = 0; i <= NR; i++) {
      const rho = (i / NR) * 1.18;
      for (let j = 0; j <= NA; j++) {
        const ph = (j / NA) * TAU, a = rho * Math.cos(ph), b = rho * Math.sin(ph);
        const x = xe + a * R0, th = th0 - sg * b * (R0 / rl);
        const p = body.surf(x, th, true).p, n = body.surfNormal(x, th);
        if (n.dot(p.clone().sub(body.spine(x))) < 0) n.negate();
        // dome over the eye, then a steep tuck under the skin past the rim
        const h = rho <= 1 ? R0 * (bulge * (1 - rho * rho) - 0.035) : R0 * (-0.035 - 1.6 * (rho - 1));
        const pe = p.clone().addScaledVector(n, h - R0 * 0.02).sub(c), ps = p.clone().addScaledVector(n, h + R0 * 0.025).sub(c);
        eye.push(pe.x, pe.y, pe.z); spec.push(ps.x, ps.y, ps.z);
        uv.push(0.5 + a * 0.47 * sg, 0.5 + b * 0.47);
        // the spectacle: clear in the middle, taking on the skin's colour at its rim, where the scales round the eye overlap it
        const rim = sstep(0.82, 1.06, rho), sk = skinAt(x, th);
        col.push(sk[0], sk[1], sk[2], rim); spa.push(0.16 * (1 - sstep(0.88, 1.02, rho)));
      }
    }
    const idx = [];
    for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const mk = (arr, withUv, withCol) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); if (withUv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); if (withCol) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); g.computeVertexNormals(); return g; };
    const eg = mk(eye, true, false), sgeo = mk(spec, false, true);
    // wind the triangles so they face out of the head on both sides
    const fixFacing = (g) => { const nr = g.attributes.normal, mid = Math.round(NR * 0.3) * (NA + 1), q = new THREE.Vector3(nr.getX(mid), nr.getY(mid), nr.getZ(mid)), want = body.surfNormal(xe, th0);
      if (want.dot(c.clone().sub(body.spine(xe))) < 0) want.negate();
      if (q.dot(want) < 0) { const ia = g.index.array; for (let k = 0; k < ia.length; k += 3) { const t = ia[k + 1]; ia[k + 1] = ia[k + 2]; ia[k + 2] = t; } g.index.needsUpdate = true; g.computeVertexNormals(); } };
    fixFacing(eg); fixFacing(sgeo);
    const m = new THREE.Mesh(eg, em); m.position.copy(c); m.receiveShadow = true; m.castShadow = false;
    // the clear glossy spectacle, and round its edge the skin of the scales that ring the eye, overlapping it
    const sg2 = sgeo.clone(), ca = sg2.attributes.color; for (let i = 0; i < ca.count; i++) ca.setXYZW(i, 1, 1, 1, spa[i]);
    const sp = new THREE.Mesh(sg2, sm); sp.renderOrder = 3; sp.receiveShadow = false; m.add(sp);
    const lid = new THREE.Mesh(sgeo, lm); lid.renderOrder = 2; lid.receiveShadow = true; m.add(lid);
    m.userData.spectacle = sp; out.push(m);
  }
  return out;
}

// ---------- v4.72: the mouth, opened with "Open mouth" ----------
// The lower jaw swings down about its hinge at the back of the head (the throat skin stretches
// behind it); inside are the pink mouth lining, the dark throat, rows of small backward-pointing
// teeth on both jaws, and the fangs each group really has: long folding fangs at the very front
// in vipers and pit vipers, short fixed front fangs in elapids and sea snakes, none in pythons,
// colubrids and blind snakes (pythons have many more and bigger teeth instead).
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
  // the head's vertices: upper jaw (lifts, like a real gape) or lower jaw (drops a little - it rests on the ground)
  const lower = [], upper = [];
  for (let i = 0; i < body.nR; i++) { const x = body.ringX[i]; if (x > xEnd) break;
    for (let j = 0; j <= M; j++) { const th = TAU * (j / M) - Math.PI; (Math.abs(th) > mA ? lower : upper).push(i * (M + 1) + j, weight(x)); } }
  const UP = 0.72, DN = 0.28; // share of the gape: top of the head up, lower jaw down
  // the skin along the mouth line is cut while the mouth is open (otherwise it stretches across and hides the inside)
  const ix = geo.index, cut = [];
  const isLow = (j) => Math.abs(TAU * (j / M) - Math.PI) > mA;
  for (let i = 0; i < body.nR - 1 && body.ringX[i] < xh * 0.97; i++) for (let j = 0; j < M; j++) if (isLow(j) !== isLow(j + 1)) { const at = (i * M + j) * 6; cut.push(at, ix.array.slice(at, at + 6)); }
  let isCut = false;
  const setCut = (v) => { if (v === isCut) return; isCut = v; for (let k = 0; k < cut.length; k += 2) { const at = cut[k], o = cut[k + 1]; for (let q2 = 0; q2 < 6; q2++) ix.array[at + q2] = v ? o[0] : o[q2]; } ix.needsUpdate = true; };
  const eyeOrig = (eyes || []).map((m) => ({ m, p: m.position.clone(), q: m.quaternion.clone() }));
  const headRings = (() => { let n = 0; while (n < body.nR && body.ringX[n] <= xEnd * 1.05) n++; return n; })();
  // v4.81: the inside of the mouth is modelled, not two flat strips. Each jaw has rounded lips (the lip scales
  // roll inwards from the skin to the gums, so the edge of the upper jaw is no longer a thin shell), a vaulted pink
  // roof with the two rows of palate teeth on low ridges, a soft floor with the tongue sheath and glottis on a raised
  // midline, wet-looking lining that darkens towards the throat (and in the grooves beside the gums), a dark throat
  // tunnel at the back and soft folds of skin at the corners of the mouth. Everything turns with its own jaw.
  const n = 44, xs = []; for (let k = 0; k <= n; k++) xs.push(Hl * 0.03 + (xh - Hl * 0.03) * Math.pow(k / n, 0.9));
  const img = pat && pat.image, skinAt = (x, th) => {
    if (!img || !img.data) return new THREE.Color(P.colors.lateral || P.colors.dorsal);
    const u = clamp((th + Math.PI) / TAU, 0, 0.999), v = clamp(body.gOf(x) / body.gTotal, 0, 0.999), k = (Math.floor(v * img.height) * img.width + Math.floor(u * img.width)) * 4;
    return new THREE.Color().setRGB(img.data[k] / 255, img.data[k + 1] / 255, img.data[k + 2] / 255, THREE.SRGBColorSpace);
  };
  const pink = new THREE.Color(P.head.mouthColor || (plan === 'python' ? '#e8a49c' : '#ec9f9a')), deep = new THREE.Color('#5b1a24'), black = new THREE.Color('#1a0608');
  if (P.head.mouthColor && /^#[0-3]/.test(P.head.mouthColor)) deep.set('#120c0c'); // a black mouth (black mamba) stays black
  const chord = (x, th, s2, inset) => { const a = body.surf(x, th).p, b = body.surf(x, -th).p; return a.lerp(b, s2).lerp(body.spine(x), inset); };
  const bump = (s, c, w) => Math.exp(-(((s - c) / w) ** 2));
  const labN = P.head.labials || (plan === 'python' ? 13 : plan === 'viper' || plan === 'pitviper' ? 11 : 8), labLen = (xh * 0.95) / labN;
  // one jaw's lining: lip (outer edge -> rolled under -> gum), then the roof or floor across, then the other lip
  function jawLining(upper) {
    const NS = 18, NL = 5, rows = [], cols = [], xv = [];
    const sgU = upper ? -1 : 1; // the lips roll towards the opening: down for the upper jaw, up for the lower
    for (const x of xs) {
      const f = body.frameAt(x), Hh = F.Hh(x), W = F.W(x), back = sstep(xh * 0.5, xh * 1.0, x);
      const thE = upper ? mA - 0.015 : mA + 0.015, thI = upper ? mA - 0.07 : mA + 0.09;
      const across = (s) => { // the roof (vaulted, two ridges for the palate teeth) or the floor (a raised soft midline)
        const p = chord(x, thI, s, upper ? 0.2 : 0.22);
        if (upper) p.addScaledVector(f.U, Hh * (0.16 * Math.sin(Math.PI * s) * (1 - 0.4 * back) - 0.045 * (bump(s, 0.3, 0.07) + bump(s, 0.7, 0.07))));
        else p.addScaledVector(f.U, Hh * (0.07 * bump(s, 0.5, 0.14) - 0.13 * Math.sin(Math.PI * s) * (1 - 0.5 * back)));
        return p;
      };
      const lip = (side, k) => { // k = 0 at the skin's cut edge, 1 at the gum
        const A = body.surf(x, side * thE).p, B = across(side > 0 ? 0 : 1), lr = Hh * (upper ? 0.16 : 0.12) * (1 - 0.5 * back);
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
      for (const [p, kind, s, side] of row) {
        let c;
        if (kind === 'lip') { const sk = skinAt(x, side * (upper ? mA - 0.06 : mA + 0.08)), lipC = sk.clone().lerp(new THREE.Color(P.colors.belly), upper ? 0.25 : 0.5); c = lipC.multiplyScalar(suture * lerp(1, 0.7, sstep(0.55, 1, s))).lerp(pink, sstep(0.8, 1, s) * 0.6); }
        else {
          c = pink.clone();
          const groove = Math.max(bump(s, 0, 0.12), bump(s, 1, 0.12)), ridge = upper ? bump(s, 0.3, 0.06) + bump(s, 0.7, 0.06) : bump(s, 0.5, 0.1);
          c.multiplyScalar((1 - 0.35 * groove) * (1 + 0.12 * ridge) * (0.94 + 0.12 * hash1((x / Hl * 300) | 0, (s * 97) | 0)));
          c.lerp(deep, sstep(0.45, 0.95, x / xh) * 0.85).lerp(black, sstep(0.8, 1.0, x / xh) * 0.7 * (1 - 0.5 * ridge));
        }
        rows.push(p.x, p.y, p.z); cols.push(c.r, c.g, c.b); xv.push(x);
      }
    }
    const per = 2 * NL + NS + 1, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(rows, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const idx = []; for (let i = 0; i < xs.length - 1; i++) for (let k = 0; k < per - 1; k++) { const a = i * per + k, b = a + per; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    g.setIndex(idx); g.computeVertexNormals();
    return { g, o: g.attributes.position.array.slice(), xv, per, row: (x, s) => { const i = clamp(Math.round(xs.findIndex((q) => q >= x)), 0, xs.length - 1), k = NL + Math.round(s * NS); return new THREE.Vector3().fromArray(rows, (i * per + k) * 3); }, gum: (x, side) => { const i = Math.max(0, xs.findIndex((q) => q >= x)), k = side > 0 ? NL - 1 : per - NL; return new THREE.Vector3().fromArray(rows, (i * per + k) * 3); } };
  }
  const lining = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.28, emissive: new THREE.Color('#2a0709'), emissiveIntensity: 0.6, side: THREE.DoubleSide, envMapIntensity: 0.45 }); // (a faint glow stands in for light passing through the soft tissue)
  const roof = jawLining(true), floorJ = jawLining(false);
  const palate = new THREE.Mesh(roof.g, lining), floor = new THREE.Mesh(floorJ.g, lining);
  palate.receiveShadow = floor.receiveShadow = true;
  // the corners of the mouth: a short fold of skin between the two jaws, just in front of the hinge
  const cheekX = xs.filter((x) => x >= xh * 0.84), cheekK = 6, cheekPts = [], cheekCols = [], cheekInfo = [];
  for (const x of cheekX) for (const side of [1, -1]) {
    const a = roof.gum(x, side), b = floorJ.gum(x, side), mid = body.spine(x), reach = sstep(xh * 0.84, xh * 1.0, x);
    for (let k = 0; k <= cheekK; k++) { const s = k / cheekK, p = a.clone().lerp(b, s).lerp(mid, 0.12 * Math.sin(Math.PI * s)); cheekPts.push(p.x, p.y, p.z); const c = pink.clone().lerp(deep, 0.75 + 0.25 * Math.sin(Math.PI * s)).multiplyScalar(0.7); cheekCols.push(c.r, c.g, c.b); cheekInfo.push(s, reach, x); }
  }
  const cheekG = new THREE.BufferGeometry(); cheekG.setAttribute('position', new THREE.Float32BufferAttribute(cheekPts, 3)); cheekG.setAttribute('color', new THREE.Float32BufferAttribute(cheekCols, 3));
  { const idx = [], per = (cheekK + 1); for (let i = 0; i < cheekX.length - 1; i++) for (const sd of [0, 1]) for (let k = 0; k < cheekK; k++) { const a = (i * 2 + sd) * per + k, b = a + 2 * per; idx.push(a, a + 1, b, a + 1, b + 1, b); } cheekG.setIndex(idx); cheekG.computeVertexNormals(); }
  const cheekOrig = cheekG.attributes.position.array.slice(), cheeks = new THREE.Mesh(cheekG, lining);
  // the throat: a dark tunnel going back into the neck
  const thrR = F.W(xh) * 0.5, thrH = F.Hh(xh) * 0.42, thrL = Hl * 0.35, thrG = new THREE.CylinderGeometry(1, 0.35, 1, 24, 6, true), tp = thrG.attributes.position, tc = [];
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i) + 0.5, c = deep.clone().lerp(black, 0.4 + 0.6 * (1 - y)); tc.push(c.r, c.g, c.b); }
  thrG.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3));
  const throat = new THREE.Mesh(thrG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
  { const p0 = body.spine(xh * 0.9), ft = body.frameAt(xh * 0.9); throat.position.copy(p0).addScaledVector(ft.T, thrL * 0.5).addScaledVector(ft.U, -F.Hh(xh) * 0.08); throat.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ft.S, ft.T.clone().negate(), ft.U)); throat.scale.set(thrR, thrL, thrH); }
  const inside = new THREE.Group(); inside.add(palate, floor, cheeks, throat); inside.visible = false; group.add(inside);
  // teeth: slim, slightly curved, backward-pointing; fangs at the front of the upper jaw
  const toothM = new THREE.MeshPhysicalMaterial({ color: '#f6f1e4', roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.4, sheenColor: new THREE.Color('#fff8e8') });
  const upperT = new THREE.Group(), lowerT = new THREE.Group(); inside.add(upperT, lowerT);
  const many = plan === 'python' ? 1.6 : plan === 'blind' ? 0 : 1, tl = Hl * (plan === 'python' ? 0.07 : plan === 'colubrid' ? 0.036 : 0.042), tr = Hl * (plan === 'python' ? 0.011 : 0.008);
  const curvedTooth = (bend) => { // a cone along a gentle curve, its tip turned back (local +y = base to tip)
    const pts = []; for (let k = 0; k <= 6; k++) { const s = k / 6; pts.push(new THREE.Vector3(0, s, bend * s * s)); }
    const crv = new THREE.CatmullRomCurve3(pts), g = new THREE.TubeGeometry(crv, 8, 1, 8, false), p = g.attributes.position, q = new THREE.Vector3();
    // taper the tube to a point (TubeGeometry is a constant radius: pull each ring to its centre line)
    for (let i = 0; i < p.count; i++) { const ring = Math.floor(i / 9), s = ring / 8; crv.getPointAt(s, q); const cx = q.x, cy = q.y, cz = q.z, k = Math.pow(1 - s, 0.85) + 0.02; p.setXYZ(i, cx + (p.getX(i) - cx) * k, cy + (p.getY(i) - cy) * k, cz + (p.getZ(i) - cz) * k); }
    g.computeVertexNormals(); return g;
  };
  const toothG = curvedTooth(0.35);
  const tooth = (parent, base, dir, len, rad, back, g) => { const m = new THREE.Mesh(g || toothG, toothM); m.position.copy(base); m.scale.set(rad, len, rad); const y = dir.clone().normalize(), z = back.clone().addScaledVector(y, -back.dot(y)).normalize(), xx = new THREE.Vector3().crossVectors(y, z); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xx, y, z)); m.castShadow = false; parent.add(m); return m; };
  const nT = Math.round(10 * many);
  for (let k = 0; k < nT; k++) {
    const x = Hl * 0.14 + (xh * 0.78 - Hl * 0.14) * (k / Math.max(1, nT - 1)), f = body.frameAt(x), sz = 1 - 0.35 * (k / nT);
    for (const sg of [1, -1]) {
      tooth(upperT, roof.gum(x, sg), f.U.clone().negate().addScaledVector(f.T, 0.45), tl * sz, tr * sz, f.T);   // pointing down and back
      tooth(lowerT, floorJ.gum(x, sg), f.U.clone().addScaledVector(f.T, 0.45), tl * 0.85 * sz, tr * sz, f.T);  // pointing up and back
    }
  }
  // v4.80: two inner rows of palate teeth on the ridges (palatine and pterygoid), the glottis and the tongue sheath
  const anchors = { teeth: new THREE.Object3D(), palate: new THREE.Object3D(), glottis: new THREE.Object3D(), sheath: new THREE.Object3D(), fang: null, hinge: new THREE.Object3D(), tongue: null };
  if (plan !== 'blind') {
    for (const s2 of [0.3, 0.7]) {
      const nI = Math.round(8 * many);
      for (let k = 0; k < nI; k++) { const x = Hl * 0.2 + (xh * 0.72 - Hl * 0.2) * (k / Math.max(1, nI - 1)), f = body.frameAt(x);
        tooth(upperT, roof.row(x, s2), f.U.clone().negate().addScaledVector(f.T, 0.6), tl * 0.62, tr * 0.8, f.T); }
    }
    anchors.palate.position.copy(roof.row(xh * 0.45, 0.5)); upperT.add(anchors.palate);
    anchors.teeth.position.copy(roof.gum(Hl * 0.3, 1)); upperT.add(anchors.teeth);
    const softM = new THREE.MeshPhysicalMaterial({ color: pink.clone().multiplyScalar(0.92), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    // the glottis: a short tube lying on the floor of the mouth, open towards the front
    const gx0 = Hl * 0.24, gx1 = Hl * 0.42, fl = (x) => floorJ.row(x, 0.5), gr = F.W((gx0 + gx1) / 2) * 0.07;
    const fU = body.frameAt((gx0 + gx1) / 2).U;
    const gA = fl(gx0).addScaledVector(fU, gr * 0.9), gB = fl(gx1).addScaledVector(fU, gr * 0.6);
    const glottis = new THREE.Mesh(new THREE.CylinderGeometry(gr, gr * 1.25, gA.distanceTo(gB), 18, 1, true), softM);
    glottis.position.copy(gA).add(gB).multiplyScalar(0.5); glottis.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), gA.clone().sub(gB).normalize()); lowerT.add(glottis);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(gr * 0.6, 16).scale(0.4, 1, 1), new THREE.MeshBasicMaterial({ color: '#1a0508', side: THREE.DoubleSide }));
    hole.position.copy(gA); hole.lookAt(gA.clone().add(gA.clone().sub(gB))); lowerT.add(hole);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(gr * 0.85, gr * 0.25, 10, 24), softM); rim.position.copy(gA); rim.lookAt(gA.clone().add(gA.clone().sub(gB))); lowerT.add(rim);
    anchors.glottis.position.copy(gA).add(gB).multiplyScalar(0.5).addScaledVector(fU, gr); lowerT.add(anchors.glottis);
    // the tongue sheath just in front, and the forked tongue: dark, thin, its two tines slightly apart and lifted
    const sx = Hl * 0.17, fT = body.frameAt(sx).T, fS = body.frameAt(sx).S.clone().normalize(), fU2 = body.frameAt(sx).U, sp = fl(sx).addScaledVector(fU2, gr * 0.3);
    const sheath = new THREE.Mesh(new THREE.SphereGeometry(gr * 1.2, 20, 12), softM); sheath.scale.set(1, 0.42, 1.8); sheath.position.copy(sp);
    sheath.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fS, fU2, fT)); lowerT.add(sheath);
    anchors.sheath.position.copy(sp).addScaledVector(fU2, gr * 0.6); lowerT.add(anchors.sheath);
    const tongueCol = P.head.tongue || { python: '#2b1d24', viper: '#22191d', pitviper: '#1f1a20', elapid: '#141015', sea: '#2a2226' }[plan] || '#16121a';
    const tongueM = new THREE.MeshPhysicalMaterial({ color: tongueCol, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    const tongue = new THREE.Group(), tLen = Hl * 0.38, tr0 = gr * 0.32, stem = Hl * 0.2;
    const pts = []; for (let k = 0; k <= 8; k++) { const s = k / 8; pts.push(new THREE.Vector3(0, gr * 0.5 * Math.sin(Math.PI * s * 0.8), -stem * s)); }
    const tube = (curvePts, r0, r1) => { const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts), 16, 1, 8, false), p = g.attributes.position; const c = new THREE.CatmullRomCurve3(curvePts);
      for (let i = 0; i < p.count; i++) { const ring = Math.floor(i / 9), s = ring / 16, q = c.getPointAt(s), k = lerp(r0, r1, s); p.setXYZ(i, q.x + (p.getX(i) - q.x) * k, q.y + (p.getY(i) - q.y) * k, q.z + (p.getZ(i) - q.z) * k); } g.computeVertexNormals(); return g; };
    tongue.add(new THREE.Mesh(tube(pts, tr0, tr0 * 0.75), tongueM));
    const fork = pts[pts.length - 1];
    for (const sg of [1, -1]) { const tp2 = []; for (let k = 0; k <= 6; k++) { const s = k / 6; tp2.push(new THREE.Vector3(sg * (tLen - stem) * 0.32 * s * s, fork.y + gr * 0.25 * s, fork.z - (tLen - stem) * s)); } tongue.add(new THREE.Mesh(tube(tp2, tr0 * 0.72, tr0 * 0.12), tongueM)); }
    // the tongue lies in the sheath and its tips just show past the front of the lower jaw
    tongue.position.copy(sp).addScaledVector(fT, gr * 1.4).addScaledVector(fU2, gr * 0.2);
    tongue.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fS, fU2, fT));
    lowerT.add(tongue); anchors.tongue = tongue;
    anchors.hinge.position.copy(hinge); group.add(anchors.hinge);
  }
  const fangs = [];
  if (plan === 'viper' || plan === 'pitviper' || plan === 'elapid' || plan === 'sea') {
    const big = plan === 'viper' || plan === 'pitviper', x = Hl * (big ? 0.1 : 0.12), f = body.frameAt(x);
    const fangG = curvedTooth(big ? 0.28 : 0.18), sheathM = new THREE.MeshPhysicalMaterial({ color: pink.clone().lerp(new THREE.Color('#ffffff'), 0.15), roughness: 0.4, transparent: true, opacity: 0.88, clearcoat: 0.5 });
    for (const sg of [1, -1]) {
      const base = roof.gum(x, sg), len = Hl * (big ? 0.34 : 0.12), r = Hl * (big ? 0.022 : 0.018), dir = f.U.clone().negate().addScaledVector(f.T, big ? 0.35 : 0.2);
      const fg = tooth(upperT, base, dir, len, r, f.T, fangG); fangs.push(fg);
      if (big) { // the soft sheath of gum the folded fang rests in, pushed up round its base
        const sh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), sheathM); sh.scale.set(r * 2.1, len * 0.3, r * 2.4); sh.position.copy(base).addScaledVector(dir.clone().normalize(), len * 0.16); sh.quaternion.copy(fg.quaternion); upperT.add(sh); fangs.push(sh);
      }
    }
    // the fang tip (for the labels and the bite)
    const fg = fangs[0]; anchors.fang = new THREE.Object3D(); fg.updateMatrix(); anchors.fang.position.copy(new THREE.Vector3(0, 1, 0.28 * (big ? 1 : 0.6)).applyMatrix4(fg.matrix)); upperT.add(anchors.fang);
    anchors.fangLen = fg.scale.y;
  } else {
    const x = Hl * 0.14, f = body.frameAt(x); anchors.fang = new THREE.Object3D(); anchors.fang.position.copy(roof.gum(x, 1)).addScaledVector(f.U, -tl); upperT.add(anchors.fang); anchors.fangLen = tl;
  }
  let t = 0;
  function set(v) {
    t = clamp(v, 0, 1); inside.visible = t > 0.01; setCut(t > 0.01);
    const ang = sign * gape * (1 - Math.pow(1 - t, 2)), a = pos.array, aD = ang * DN, aU = -ang * UP;
    const qq = new THREE.Quaternion(), v3 = new THREE.Vector3();
    const turn = (list, an) => { for (let k = 0; k < list.length; k += 2) { const vi = list[k], w = list[k + 1];
      v3.set(orig[vi * 3], orig[vi * 3 + 1], orig[vi * 3 + 2]);
      if (w > 0 && an) { qq.setFromAxisAngle(axis, an * w); v3.sub(hinge).applyQuaternion(qq).add(hinge); }
      a[vi * 3] = v3.x; a[vi * 3 + 1] = v3.y; a[vi * 3 + 2] = v3.z; } };
    turn(lower, aD); turn(upper, aU);
    pos.needsUpdate = true;
    // the mouth lining and the teeth go with their jaws
    const strip2 = (J, an) => { const fp = J.g.attributes.position.array, o = J.o;
      for (let k = 0, i = 0; k < fp.length; k += 3, i++) { v3.set(o[k], o[k + 1], o[k + 2]); qq.setFromAxisAngle(axis, an * weight(J.xv[i])); v3.sub(hinge).applyQuaternion(qq).add(hinge); fp[k] = v3.x; fp[k + 1] = v3.y; fp[k + 2] = v3.z; }
      J.g.attributes.position.needsUpdate = true; J.g.computeVertexNormals(); };
    strip2(floorJ, aD); strip2(roof, aU);
    // the folds at the corners of the mouth stretch between the two jaws
    { const fp = cheekG.attributes.position.array;
      for (let k = 0, i = 0; k < fp.length; k += 3, i++) { const s = cheekInfo[i * 3], reach = cheekInfo[i * 3 + 1], x = cheekInfo[i * 3 + 2], an = lerp(aU, aD, sstep(0.5 - 0.5 * reach - 1e-3, 0.5 + 0.5 * reach + 1e-3, s)) * weight(x);
        v3.set(cheekOrig[k], cheekOrig[k + 1], cheekOrig[k + 2]); qq.setFromAxisAngle(axis, an); v3.sub(hinge).applyQuaternion(qq).add(hinge); fp[k] = v3.x; fp[k + 1] = v3.y; fp[k + 2] = v3.z; }
      cheekG.attributes.position.needsUpdate = true; cheekG.computeVertexNormals(); }
    const place = (grp, an) => { qq.setFromAxisAngle(axis, an); grp.position.copy(hinge).sub(hinge.clone().applyQuaternion(qq)); grp.quaternion.copy(qq); };
    place(lowerT, aD); place(upperT, aU);
    for (const e of eyeOrig) { qq.setFromAxisAngle(axis, aU); e.m.position.copy(e.p).sub(hinge).applyQuaternion(qq).add(hinge); e.m.quaternion.copy(qq).multiply(e.q); }
    // fangs swing forward as the mouth opens (vipers fold them flat when it is shut)
    for (const fg of fangs) fg.visible = t > 0.25;
  }
  function settle() { // normals once the jaw stops (the seam along the belly kept smooth, like buildBody does)
    geo.computeVertexNormals(); const nrm = geo.attributes.normal.array;
    for (let i = 0; i < body.nR; i++) { const a = i * (M + 1), b = a + M; for (let q2 = 0; q2 < 3; q2++) { const m = (nrm[a * 3 + q2] + nrm[b * 3 + q2]) / 2; nrm[a * 3 + q2] = nrm[b * 3 + q2] = m; } }
    geo.attributes.normal.needsUpdate = true;
  }
  return { set, settle, get t() { return t; }, headX: xh, anchors, fanged: fangs.length > 0 };
}

// ---------- ground and props ----------
const SCENES = {
  litter:   { sky: ['#b9c7b0', '#d7ddcc'], fog: '#c3cbb9', sun: 1.6, hemi: 0.75, sunEl: 55, tile: 1.1, ground: 'litter', props: { leaves: 1, twigs: 1, rocks: 0.15, grass: 0.1 } },
  forest:   { sky: ['#a9bca6', '#ccd6c3'], fog: '#b9c6b2', sun: 1.7, hemi: 0.75, sunEl: 52, tile: 1.2, ground: 'litter', props: { leaves: 1, twigs: 1, log: 1, rocks: 0.2, grass: 0.15 } },
  // gibber (stony) plains of inland Australia, like the Moon Plain: red clay under a pavement of shiny stones
  gibber:   { sky: ['#8fb6dc', '#f1dcc4'], fog: '#ead2b8', sun: 2.4, hemi: 0.5, sunEl: 46, tile: 0.9, ground: 'gibber', props: { rocks: 0.35, grass: 0.06 } },
  arid:     { sky: ['#9fc0dd', '#efe3cf'], fog: '#e6dccb', sun: 2.2, hemi: 0.55, sunEl: 48, tile: 0.8, ground: 'gravel', props: { rocks: 1, grass: 0.5, twigs: 0.4 } },
  heath:    { sky: ['#a8bfd4', '#e4e7e3'], fog: '#d9ddd8', sun: 1.8, hemi: 0.6, sunEl: 40, tile: 0.8, ground: 'heath', props: { heather: 1, grass: 0.7, rocks: 0.1, twigs: 0.3 } },
  riverbank:{ sky: ['#a6c2d8', '#e2e9e4'], fog: '#d4ddd7', sun: 2.2, hemi: 0.7, sunEl: 46, tile: 0.9, ground: 'pebbles', water: 'river', props: { rocks: 0.6, reeds: 1, grass: 0.4, pebbles: 1 } },
  soil:     { sky: ['#b3bfae', '#d8dccf'], fog: '#c8cec0', sun: 1.5, hemi: 0.8, sunEl: 58, tile: 0.35, ground: 'soil', props: { leaves: 0.5, twigs: 0.6, crumbs: 1 } },
  sea:      { sky: ['#7fb0d6', '#e3eef2'], fog: '#cfdfe6', sun: 2.6, hemi: 0.7, sunEl: 50, tile: 1, ground: null, water: 'sea', props: { drift: 1 } },
  grass:    { sky: ['#a3c1da', '#e6ead9'], fog: '#dde2d2', sun: 2.0, hemi: 0.6, sunEl: 48, tile: 0.9, ground: 'dry', props: { grass: 2.6, rocks: 0.2, twigs: 0.3 } },
  sand:     { sky: ['#9cc0de', '#f2e6cf'], fog: '#efe2cb', sun: 2.2, hemi: 0.5, sunEl: 50, tile: 1.0, ground: 'sand', props: { rocks: 0.3, grass: 0.3, twigs: 0.3 } },
  rainforest:{ sky: ['#9fb39b', '#c3cfbb'], fog: '#aebba7', sun: 1.3, hemi: 0.85, sunEl: 60, tile: 1.1, ground: 'litter', props: { leaves: 1.3, twigs: 1, rocks: 0.1, ferns: 1 } },
};

// ---------- photographic surroundings: CC0 Polyhaven panoramas (via @pmndrs/assets), see CREDITS.txt ----------
// each habitat gets the panorama that fits it best; the snake's own ground is drawn up close and fades
// into the photo's ground, which is projected onto a flat floor so it meets the horizon without a seam
const ENV_FOR = { gibber: 'dawn', riverbank: 'park', forest: 'forest', rainforest: 'forest', litter: 'forest', soil: 'forest', grass: 'sunrise', heath: 'sunrise', arid: 'dawn', sand: 'dawn', sea: 'sky' };
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
    const base = { gibber: '#a8613a', litter: '#3b2e22', gravel: '#b7a58c', heath: '#6f5f4a', pebbles: '#6f675a', soil: '#3f3024', dry: '#6f6a44', sand: '#d8c39a' }[kind] || '#777';
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
      const pal = kind === 'litter' ? ['#6a4a2e', '#7d5a36', '#8c6a42', '#55402a', '#6b5536', '#3e2e20', '#86663f', '#9a7a4e', '#5e5032', '#4a3a26'] : ['#5a4532', '#6b5236', '#4a3826', '#7a6044'];
      const n = kind === 'litter' ? 2600 : 220;
      for (let i = 0; i < n; i++) {
        const cx = R() * S, cy = R() * S, big = R() < 0.15, l = (kind === 'litter' ? 18 : 10) + R() * (kind === 'litter' ? (big ? 70 : 34) : 16), w = l * (0.18 + R() * 0.17), a = R() * TAU, col = pal[(R() * pal.length) | 0], curl = R();
        wrapAt(cx, cy, l, () => { x.rotate(a); leaf(l, w, col, curl); });
      }
      for (let i = 0; i < (kind === 'litter' ? 90 : 40); i++) {
        const cx = R() * S, cy = R() * S, l = 20 + R() * 110, a = R() * TAU, w = 1 + R() * 2.5;
        wrapAt(cx, cy, l, () => { x.rotate(a); x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = w + 1.5; x.beginPath(); x.moveTo(1, 2); x.lineTo(l + 1, 2); x.stroke(); x.strokeStyle = R() < 0.5 ? '#4a3826' : '#6a5438'; x.lineWidth = w; x.beginPath(); x.moveTo(0, 0); x.lineTo(l, 0); x.stroke(); });
      }
      if (kind === 'soil') for (let i = 0; i < 700; i++) { const cx = R() * S, cy = R() * S, r = 2.5 + R() ** 2 * 6; wrapAt(cx, cy, r * 2, () => stone(r, r * (0.6 + R() * 0.4), '#6e5845', '#3a2b20', true)); }
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
  const { scene } = ctx, S = SCENES[P.scene.kind] || SCENES.litter, R = rng(seed + 77);
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
  scene.fog = new THREE.Fog(hor, Math.max(Rb * 6, envR * 3.5), farR * 0.95); ctx.farR = farR; ctx.fogNear0 = scene.fog.near;
  scene.background = hor;

  // environment light from a simple sky/ground gradient (soft reflections; no image is fetched)
  const envScene = new THREE.Scene();
  const eg = new THREE.SphereGeometry(10, 32, 16), ec = [], ep = eg.attributes.position, gcol = new THREE.Color(S.ground ? ({ gibber: '#9a5a38', litter: '#4a3a29', gravel: '#b49f86', heath: '#7d6b52', pebbles: '#8f8677', soil: '#4a3828', dry: '#9b8a62', sand: '#d8c39a' }[S.ground]) : '#2c5d7a');
  for (let i = 0; i < ep.count; i++) { const y = ep.getY(i) / 10, c = y > 0 ? hor.clone().lerp(sky, sstep(0, 0.6, y)).multiplyScalar(1.15) : gcol.clone().multiplyScalar(0.7); ec.push(c.r, c.g, c.b); }
  eg.setAttribute('color', new THREE.Float32BufferAttribute(ec, 3));
  envScene.add(new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pm = new THREE.PMREMGenerator(ctx.renderer); const envRT = pm.fromScene(envScene, 0.02); pm.dispose(); eg.dispose(); envScene.children[0].material.dispose();
  scene.environment = envRT.texture; ctx.track(envRT);

  // lights
  const hemi = new THREE.HemisphereLight(sky.clone().lerp(new THREE.Color('#ffffff'), 0.4), gcol, S.hemi); scene.add(hemi); ctx.hemi = hemi; ctx.envRT = envRT;
  const sun = new THREE.DirectionalLight('#fff4e2', S.sun);
  const el = (S.sunEl * Math.PI) / 180, az = 0.9;
  sun.position.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(Rb * 6);
  sun.castShadow = true;
  const sm = quality === 'low' ? 1024 : 4096; sun.shadow.mapSize.set(sm, sm); // v4.72: crisper shadows
  const sc = sun.shadow.camera; sc.left = sc.bottom = -Rb * 1.5; sc.right = sc.top = Rb * 1.5; sc.near = Rb * 0.5; sc.far = Rb * 14;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = F.w0 * 0.04; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  ctx.sun = sun;

  // ground
  const waterY = { y: null };
  const dist2snake = (x, z) => { let m = 1e9; for (let i = 0; i < poseInfo.pts.length; i += 6) { const q = poseInfo.pts[i], d = Math.hypot(q[0] - x, q[1] - z) - F.W(i * poseInfo.ds); if (d < m) m = d; } return m; };
  if (S.ground) {
    const gg = new THREE.CircleGeometry(groundR, 128, 0, TAU); gg.rotateX(-Math.PI / 2);
    // finer rings near the middle so the riverbank slope is smooth
    const tG = performance.now(); const tex = groundTexture(S.ground, seed + 5, quality !== 'low'); perfT('groundTex', tG); tex.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy(); const rep = (groundR * 2) / (clamp(Math.min(S.tile, L * 1.1), S.tile * 0.5, S.tile) * clamp(L / 2, 1, 4)); tex.repeat.set(rep, rep); // big snakes: bigger ground detail, never a fine grain
    const gm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96, metalness: 0, bumpMap: tex, bumpScale: Math.min(1, L * 0.5) * 0.6 });
    if (S.water === 'river') {
      // the bank slopes down into shallow water on one side, away from the snake
      const geo = new THREE.PlaneGeometry(groundR * 2, groundR * 2, 160, 160); geo.rotateX(-Math.PI / 2);
      const dir = new THREE.Vector2(Math.cos(poseInfo.waterDir), Math.sin(poseInfo.waterDir)), edge = poseInfo.waterDist, depth = Math.max(0.03, Rb * 0.12);
      const pp = geo.attributes.position, uvs = geo.attributes.uv;
      for (let i = 0; i < pp.count; i++) {
        // squeeze the grid toward the middle: fine cells near the snake for a smooth, irregular shoreline
        let x = pp.getX(i) / groundR, z = pp.getZ(i) / groundR; x = Math.sign(x) * x * x * groundR; z = Math.sign(z) * z * z * groundR;
        pp.setX(i, x); pp.setZ(i, z); uvs.setXY(i, x / (2 * groundR) + 0.5, 0.5 - z / (2 * groundR));
        const along = -x * dir.y + z * dir.x, s = x * dir.x + z * dir.y + (fbm(along / Rb * 1.3, 3.1, 0.7, seed + 19, 3) - 0.5) * Rb * 1.8; // a wavy shoreline
        pp.setY(i, -depth * sstep(edge - Rb * 0.25, edge + Rb * 0.7, s) + (fbm(x / Rb * 2, z / Rb * 2, 1, seed, 2) - 0.5) * Rb * 0.02 * sstep(Rb * 0.3, Rb * 0.9, Math.abs(s - edge)));
      }
      geo.computeVertexNormals();
      const g2 = new THREE.Mesh(geo, gm); g2.receiveShadow = true; scene.add(g2); ctx.fadeMats.push(gm);
      const wm = new THREE.MeshPhysicalMaterial({ color: '#2f4d48', roughness: 0.16, metalness: 0, transparent: true, opacity: 0.72, envMapIntensity: 0.45, normalMap: waterNormal(seed), normalScale: new THREE.Vector2(0.35, 0.35) }); // v4.72: clear dark river water (not a pale sheet)
      wm.normalMap.repeat.set(groundR / Math.max(0.6, Rb), groundR / Math.max(0.6, Rb));
      const wg = new THREE.PlaneGeometry(groundR * 2, groundR * 2); wg.rotateX(-Math.PI / 2);
      const water = new THREE.Mesh(wg, wm); water.position.y = -depth * 0.35; water.renderOrder = 2; scene.add(water); ctx.fadeMats.push(wm);
      ctx.waterInfo = { dir, edge };
    } else {
      // v4.72: the floor is real 3D - sand in ripples, litter and soil in little lumps, flat right under the snake
      const rg = new THREE.RingGeometry(0, groundR, 160, quality === 'low' ? 60 : 110); rg.rotateX(-Math.PI / 2);
      const kind = S.ground, rip = kind === 'sand' || kind === 'gibber' || kind === 'gravel'; // (v4.81: no sand ripples under grass)
      const fineR = kind === 'sand' ? Math.max(Rb * 2.3, Math.min(1.4, Rb * 7)) : 0; // v4.81: real sand ripples close to the snake (finer mesh below)
      const pp = rg.attributes.position, w0 = F.w0, ripA = w0 * (kind === 'sand' ? 0.4 : 0.25), lumpA = w0 * 0.45;
      for (let i = 0; i < pp.count; i++) {
        const x = pp.getX(i), z = pp.getZ(i), r = Math.hypot(x, z);
        const near = sstep(w0 * 1.5, w0 * 6, r < Rb * 3 ? dist2snake(x, z) : 1e9); // nothing lifts under or right beside the snake
        let y = 0;
        if (rip) { const u = x * 0.8 + z * 0.6 + (fbm(x / Rb, z / Rb, 1, seed + 41, 2) - 0.5) * Rb * 0.6; y += Math.sin(u / (w0 * 5)) * ripA * (0.6 + fbm(x / Rb * 0.7, z / Rb * 0.7, 1, seed + 43, 2) * 0.8); }
        else y += (fbm(x / (w0 * 6), z / (w0 * 6), 1, seed + 47, 3) - 0.5) * 2 * lumpA;
        y *= near;
        if (fineR) y = lerp(-ripA - 0.02, y, sstep(fineR * 0.82, fineR * 1.02, r)); // tucked under the fine sand
        y += (fbm(x / (Rb * 6), z / (Rb * 6), 1, seed + 53, 3) - 0.35) * Rb * 0.9 * sstep(Rb * 7, groundR * 0.95, r); // gentle rise to the hills
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
      const natureOwnsFar = NATURE.build ? NATURE.build({ THREE, ctx, scene, S, kind: P.scene.kind, groundR, farR, Rb, F, L, seed, quality, gcol, rng, fbm, sstep, clamp, dist2snake, poseInfo, sceneP: P.scene }) : false;
      perfT('nature', tN);
      if (!natureOwnsFar) farScenery(ctx, S, groundR, farR, Rb, seed, gcol, quality);
      if (ctx.afterNature) ctx.afterNature();
    };
    ctx.natureReady = typeof requestAnimationFrame === 'function' ? new Promise((res) => requestAnimationFrame(() => setTimeout(() => { try { runNature(); } finally { res(); } }, 0))) : (runNature(), Promise.resolve());
  }
  if (S.water === 'sea') {
    const wm = new THREE.MeshPhysicalMaterial({ color: '#1f4e63', roughness: 0.12, metalness: 0, transparent: true, opacity: 0.82, normalMap: waterNormal(seed), normalScale: new THREE.Vector2(0.35, 0.35) });
    wm.normalMap.repeat.set(groundR / Math.max(0.3, Rb * 0.6), groundR / Math.max(0.3, Rb * 0.6));
    const wg = new THREE.CircleGeometry(groundR, 96); wg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(wg, wm); water.position.y = poseInfo.seaLevel; water.receiveShadow = true; water.renderOrder = 2; scene.add(water);
    const deep = new THREE.Mesh(new THREE.CircleGeometry(groundR, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#0f2f3d' }));
    deep.position.y = -Rb * 0.6; scene.add(deep);
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
  const realK = clamp(L / 1.2, 0.15, 3.5); // prop scale follows the scene a little, but stays in real-world sizes
  if (PR.rocks) {
    const spots = place(Math.round(14 * PR.rocks + 4), Rb * 1.0, Rb * 4.5, F.w0 * 4 + 0.32 * realK * (P.scene.rockSize || 1)); // clear of the largest rock
    const geos = [rockGeometry(seed + 1, 3), rockGeometry(seed + 2, 3), rockGeometry(seed + 3, 2)];
    const rt = canvasTex(256, (x, s) => { const img = x.createImageData(s, s); for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const n = tfbm(i / s * 6, j / s * 6, 6, seed + 9, 4), k = (j * s + i) * 4, v = 120 + n * 110; img.data[k] = v; img.data[k + 1] = v * 0.96; img.data[k + 2] = v * 0.9; img.data[k + 3] = 255; } x.putImageData(img, 0, 0); }, 2);
    const rm = new THREE.MeshStandardMaterial({ map: rt, roughness: 0.92, color: P.scene.rock || (S.ground === 'pebbles' ? '#8f887c' : '#b4aa9c') });
    geos.forEach((g, gi) => {
      const mine = spots.filter((_, i) => i % 3 === gi); if (!mine.length) return;
      const im = new THREE.InstancedMesh(g, rm, mine.length); im.castShadow = im.receiveShadow = true;
      mine.forEach(([x, z], i) => { const s = (0.03 + R() ** 2.5 * 0.16) * realK * (P.scene.rockSize || 1); e.set(R() * 0.3, R() * TAU, R() * 0.3); q.setFromEuler(e); sv.set(s * (0.8 + R() * 0.5), s, s * (0.8 + R() * 0.5)); pv.set(x, s * 0.25, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); addOcc(im, i, m4, s * 1.2); });
      scene.add(im);
    });
  }
  if (PR.pebbles) {
    const spots = place(Math.round(70 * PR.pebbles), Rb * 0.5, Rb * 4, F.w0 * 1.5 + 0.06 * realK, 10), g = rockGeometry(seed + 7, 2);
    const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.8, color: '#ffffff' }), spots.length); im.castShadow = im.receiveShadow = true;
    const pc = new THREE.Color();
    spots.forEach(([x, z], i) => { const s = (0.012 + R() * 0.03) * realK; e.set(0, R() * TAU, 0); q.setFromEuler(e); sv.set(s * 1.3, s * 0.8, s); pv.set(x, s * 0.2, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); pc.setHSL(0.08 + R() * 0.05, 0.06 + R() * 0.08, 0.12 + R() * 0.14); /* linear: mid-grey river stones, not white */ im.setColorAt(i, pc); });
    scene.add(im);
  }
  const grassTuft = (n, h, cA, cB, rMin, rMax, clear, spread) => {
    const spots = place(n, rMin, rMax, clear); if (!spots.length) return;
    const g = bladeTuft(seed + n, 14, h, cA, cB, spread || h * 0.12), im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }), spots.length);
    im.castShadow = true; im.receiveShadow = true;
    spots.forEach(([x, z], i) => { const s = 0.7 + R() * 0.6; e.set(0, R() * TAU, 0); q.setFromEuler(e); sv.set(s, s, s); pv.set(x, 0, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); addOcc(im, i, m4, h * s * 0.8); });
    scene.add(im);
  };
  const tuftH = clamp(L * 0.12, 0.04, 0.35) * (P.scene.grassH || 1);
  if (PR.grass) grassTuft(Math.round(40 * PR.grass), tuftH, P.scene.grassA || '#6f7a3a', P.scene.grassB || '#c2b47a', Rb * 0.8, Rb * 4.5, F.w0 * 3 + tuftH * 0.3);
  if (PR.reeds && ctx.waterInfo) {
    // reeds and rushes along the water's edge, behind the snake
    const spots = []; const wi = ctx.waterInfo, tng = new THREE.Vector2(-wi.dir.y, wi.dir.x);
    for (let i = 0; i < 52; i++) { const s = (R() - 0.5) * Rb * 14, off = wi.edge + Rb * (0.15 + R() * 0.9); const x = wi.dir.x * off + tng.x * s, z = wi.dir.y * off + tng.y * s; if (dist2snake(x, z) > Math.max(Rb * 0.5, clamp(L * 0.9, 0.4, 1.2) * 0.5)) spots.push([x, z]); }
    const g = bladeTuft(seed + 3, 40, clamp(L * 0.9, 0.4, 1.2), '#55693a', '#a6a46a', 0.06, { w: 0.01, lean: 0.25 }), im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 }), spots.length);
    im.castShadow = true;
    spots.forEach(([x, z], i) => { const s = 0.7 + R() * 0.6; e.set(0, R() * TAU, 0); q.setFromEuler(e); sv.set(s, s, s); pv.set(x, -0.02, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); addOcc(im, i, m4, clamp(L * 0.9, 0.4, 1.2) * s * 0.7); });
    scene.add(im);
  }
  if (PR.heather) {
    const spots = place(Math.round(26 * PR.heather), Rb * 0.9, Rb * 4.2, F.w0 * 4 + clamp(L * 0.3, 0.12, 0.35) * 0.4);
    const hh = clamp(L * 0.22, 0.08, 0.25), g = bladeTuft(seed + 31, 160, hh, '#4f5a33', '#6f6a45', hh * 0.55, { lean: 0.8, w: 0.012, tip: '#9a6f8c', green: '#5f7036' }); // v4.80: living heather green with purple tips, not black
    const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.95 }), spots.length); im.castShadow = im.receiveShadow = true;
    spots.forEach(([x, z], i) => { const s = 0.6 + R() * 0.7; e.set(0, R() * TAU, 0); q.setFromEuler(e); sv.set(s, s * (0.7 + R() * 0.5), s); pv.set(x, 0, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); addOcc(im, i, m4, hh * s * 0.8); });
    scene.add(im);
  }
  if (PR.leaves || PR.drift) {
    const drift = !!PR.drift, n = Math.round((drift ? 60 : 260) * (PR.leaves || PR.drift) * (quality === 'low' ? 0.6 : 1));
    const spots = drift ? [] : place(n, Rb * 0.25, Rb * 4.5, F.w0 * 1.2, 6);
    if (drift) { const ang = R() * TAU, dx = Math.cos(ang), dz = Math.sin(ang), off = Rb * 1.4; for (let i = 0; i < n; i++) { const s = (R() - 0.5) * Rb * 8, w = (R() - 0.5) * Rb * 0.5; spots.push([-dz * off + dx * s + -dz * w, dx * off + dz * s + dx * w]); } }
    const lt = canvasTex(128, (x, s) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, s, s); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, s / 2); x.lineTo(s, s / 2); x.stroke(); x.lineWidth = 1; for (let i = 1; i < 7; i++) { x.beginPath(); x.moveTo(i * s / 7, s / 2); x.lineTo(i * s / 7 + 12, s / 2 - 22); x.moveTo(i * s / 7, s / 2); x.lineTo(i * s / 7 + 12, s / 2 + 22); x.stroke(); } });
    const lg = leafGeometry(), lm = new THREE.MeshStandardMaterial({ map: lt, side: THREE.DoubleSide, roughness: 0.85 });
    const im = new THREE.InstancedMesh(lg, lm, spots.length); im.castShadow = !drift; im.receiveShadow = true;
    const lc = new THREE.Color(), lsize = drift ? clamp(L * 0.06, 0.02, 0.06) : clamp(L * 0.08, 0.03, 0.14) * (P.scene.leafSize || 1);
    const pal = drift ? ['#5d4a2a', '#6b5a32', '#4a5a2a', '#7a6a3a'] : (P.scene.leafCols || ['#7a5532', '#94683a', '#a8804a', '#5e4128', '#6f4f2c', '#b08850', '#4f3a22']);
    spots.forEach(([x, z], i) => { const s = lsize * (0.6 + R() * 0.8); e.set((R() - 0.5) * 0.4, R() * TAU, (R() - 0.5) * 0.4); q.setFromEuler(e); sv.set(s, s * (0.6 + R() * 0.8), s * (0.45 + R() * 0.3)); pv.set(x, drift ? poseInfo.seaLevel + 0.002 : s * 0.02, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); lc.set(pal[(R() * pal.length) | 0]); im.setColorAt(i, lc); });
    scene.add(im);
  }
  if (PR.twigs || PR.log) {
    const bark = canvasTex(256, (x, s) => { x.fillStyle = '#5a4632'; x.fillRect(0, 0, s, s); for (let i = 0; i < 300; i++) { x.strokeStyle = ['#3a2c1e', '#6f5a40', '#4a3a28', '#7d6a50'][(R() * 4) | 0]; x.lineWidth = 1 + R() * 3; const y = R() * s; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(s * 0.3, y + (R() - 0.5) * 20, s * 0.6, y + (R() - 0.5) * 20, s, y); x.stroke(); } });
    const bm = new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95 });
    const nT = Math.round(10 * (PR.twigs || 0)), spots = place(nT, Rb * 0.6, Rb * 4, F.w0 * 3);
    spots.forEach(([x, z]) => { const len = clamp(L * 0.25, 0.05, 0.9) * (0.5 + R()), rad = len * 0.025; const g = new THREE.CylinderGeometry(rad * 0.6, rad, len, 7, 1); g.rotateZ(Math.PI / 2); const m = new THREE.Mesh(g, bm); m.position.set(x, rad, z); m.rotation.y = R() * TAU; m.castShadow = m.receiveShadow = true; scene.add(m); });
    if (PR.log) {
      // one fallen log at a safe distance behind the snake
      const len = clamp(L * 0.55, 0.4, 3), rad = clamp(L * 0.045, 0.03, 0.25);
      const g = new THREE.CylinderGeometry(rad * 0.92, rad, len, 18, 6, false), pp = g.attributes.position;
      for (let i = 0; i < pp.count; i++) { const y = pp.getY(i), a = Math.atan2(pp.getZ(i), pp.getX(i)), k = 1 + (vnoise(a * 2, y / len * 6, 1, seed) - 0.5) * 0.18; pp.setX(i, pp.getX(i) * k); pp.setZ(i, pp.getZ(i) * k); }
      g.computeVertexNormals(); g.rotateZ(Math.PI / 2);
      for (let t = 0; t < 60; t++) { const a = R() * TAU, r = Rb * (1.15 + R() * 0.8), x = Math.cos(a) * r, z = Math.sin(a) * r; const ry = R() * TAU, dx = Math.cos(ry) * len / 2, dz = -Math.sin(ry) * len / 2; if (dist2snake(x + dx, z + dz) < rad * 3 || dist2snake(x - dx, z - dz) < rad * 3 || dist2snake(x, z) < rad * 3) continue; const m = new THREE.Mesh(g, bm); m.position.set(x, rad * 0.85, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; scene.add(m); occ.push({ mesh: m, c: m.position.clone(), r: Math.max(rad * 2, len * 0.35), hid: false }); break; }
    }
  }
  if (PR.ferns) grassTuft(10, clamp(L * 0.3, 0.15, 0.5), '#3f6a2c', '#7a9a48', Rb * 1.4, Rb * 4, Rb * 0.6, 0.02);
  if (PR.crumbs) {
    const spots = place(90, Rb * 0.2, Rb * 3, F.w0 * 1.2, 8), g = rockGeometry(seed + 4, 1);
    const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: '#4a382a', roughness: 1 }), spots.length); im.castShadow = im.receiveShadow = true;
    spots.forEach(([x, z], i) => { const s = (0.0008 + R() ** 2 * 0.0025) * (L / 0.12); e.set(R() * 0.5, R() * TAU, R() * 0.5); q.setFromEuler(e); sv.set(s, s * 0.7, s); pv.set(x, s * 0.2, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); });
    scene.add(im);
  }
}
// swap the stand-in gradient sky for the panorama: image-based light, a grounded photo background,
// the sun where the photo has it, and the near ground fading into the photo's ground
function applyEnv(ctx, P, F, poseInfo, env) {
  const { scene, renderer } = ctx, S = SCENES[P.scene.kind] || SCENES.litter, sea = S.water === 'sea';
  if (!env.half) { env.half = new Uint16Array(env.data.length); for (let i = 0; i < env.data.length; i++) env.half[i] = THREE.DataUtils.toHalfFloat(env.data[i]); }
  const tex = new THREE.DataTexture(env.half, env.w, env.h, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true; ctx.track(tex);
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromEquirectangular(tex); pm.dispose(); ctx.track(rt);
  if (ctx.envRT) ctx.envRT.dispose();
  scene.environment = rt.texture;
  // v4.72: the panorama only lights the scene (reflections, sun direction and colour); what you see all round
  // is the 3D world built in buildScene - sky dome, rolling ground, trees or rocks - not a photo backdrop
  // light: the sun from the photo, sky light from the panorama; the gradient hemisphere light stays only as a faint fill
  const sun = ctx.sun, el = Math.max(Math.asin(env.sunDir.y), (22 * Math.PI) / 180), az = Math.atan2(env.sunDir.z, env.sunDir.x), r = sun.position.length();
  sun.position.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(r);
  sun.color.copy(env.sunCol).lerp(new THREE.Color('#ffffff'), 0.35); sun.intensity = 6.5 * env.sunny; // about three times the sky's light on a sunlit face, as outdoors
  sun.shadow.radius = lerp(8, 3, env.sunny); sun.shadow.blurSamples = 16;
  if (ctx.hemi) ctx.hemi.intensity *= 0.25;
  ctx.envName = env.name;
}

// v4.72: the 3D land all round: a ring of rolling hills out to farR, with trees (forest, grass, heath, riverbank)
// or boulders (desert, sand, gibber) standing on it; the fog melts it into the sky
function farScenery(ctx, S, groundR, farR, Rb, seed, gcol, quality) {
  const { scene } = ctx, R = rng(seed + 991), low = quality === 'low';
  const r0 = groundR * 0.92, hillA = Math.min(farR * 0.08, Rb * 6 + farR * 0.04);
  const hillH = (x, z) => { const r = Math.hypot(x, z); return (fbm(x / (farR * 0.18), z / (farR * 0.18), 1, seed + 71, 4) - 0.3) * hillA * sstep(r0, r0 + farR * 0.25, r) + (fbm(x / (Rb * 6), z / (Rb * 6), 1, seed + 53, 3) - 0.35) * Rb * 0.9 * sstep(Rb * 7, groundR * 0.95, r); }; // the same gentle rise as the near ground, so they meet without a step
  const ring = new THREE.RingGeometry(r0, farR, 128, low ? 24 : 40); ring.rotateX(-Math.PI / 2);
  const pp = ring.attributes.position, cols = [], base = gcol.clone(), tint = new THREE.Color(S.fog);
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i), y = hillH(x, z); pp.setY(i, y - Rb * 0.05);
    const c = base.clone().lerp(tint, 0.15 + 0.25 * fbm(x / farR * 6, z / farR * 6, 1, seed + 77, 2)); cols.push(c.r, c.g, c.b); }
  ring.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); ring.computeVertexNormals();
  const land = new THREE.Mesh(ring, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); land.receiveShadow = true; scene.add(land);
  const leafy = { litter: 1, soil: 1, pebbles: 0.6, heath: 0.3, dry: 0.35 }[S.ground] || 0; // trees where trees grow; bare land gets boulders
  const tall = Math.max(Rb * 3, Math.min(14, farR * 0.18)); // trees about 6-14 m, never tiny next to a big snake
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
    put(rock, new THREE.MeshStandardMaterial({ color: gcol.clone().multiplyScalar(0.8), roughness: 0.93 }), low ? 40 : 80, groundR * 1.1, farR * 0.9, Math.max(Rb * 0.8, farR * 0.02));
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
  for (let pass = 0; pass < 5; pass++) {
    x.strokeStyle = `rgba(0,0,0,${0.13 - pass * 0.02})`;
    for (let i = 0; i < poseInfo.pts.length - 4; i += 4) {
      const xx = i * poseInfo.ds, lift = poseInfo.Ly(xx); if (lift > F.Hh(xx) * 0.8) continue;
      const a = poseInfo.pts[i], b = poseInfo.pts[i + 4];
      x.lineWidth = Math.max(1, (F.W(xx) * 2 * (0.9 + pass * 0.16)) / (2 * ext) * S);
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
  const ptrs = new Map(); let pinch0 = 0, d0 = 0, last = null, panBtn = false, mid0 = null;
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
  function setGoal(g, instant) { if (g.az != null) g = Object.assign({}, g, { az: st.az + Math.atan2(Math.sin(g.az - st.az), Math.cos(g.az - st.az)) }); // always the short way round
    st.goal = { az: g.az != null ? g.az : st.az, el: g.el != null ? g.el : st.el, d: g.d != null ? clamp(g.d, opt.dMin(), opt.dMax()) : st.d, px: g.px != null ? g.px : st.px, pz: g.pz != null ? g.pz : st.pz }; if (instant || reduce()) { st.az = st.goal.az; st.d = st.goal.d; st.el = limitEl(st.goal.el, st.d); st.px = st.goal.px; st.pz = st.goal.pz; st.goal = null; } opt.kick(); }
  function rot(dx, dy) { st.az -= dx; st.el = limitEl(st.el + dy, st.d); st.goal = null; }
  function zoom(f) { const d = clamp((st.goal ? st.goal.d : st.d) * f, opt.dMin(), opt.dMax()); setGoal({ d, az: st.goal ? st.goal.az : st.az, el: st.goal ? st.goal.el : st.el }); }
  const onDown = (e) => { if (e.button === 1 || e.button > 2) return; panBtn = e.button === 2 || e.shiftKey || e.ctrlKey; try { dom.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already released pointer */ } ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); d0 = st.d; mid0 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; } st.dragging = true; st.vaz = st.vel = st.vpx = st.vpz = 0; last = performance.now(); st.goal = null; };
  const onCtx = (e) => e.preventDefault();
  const onMove = (e) => {
    if (!ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    const now = performance.now(), dt = Math.max(8, now - last);
    if (ptrs.size === 1 && panBtn) { const m = pan(dx, dy); last = now; st.vpx = m[0] / dt * 16; st.vpz = m[1] / dt * 16; opt.kick(); }
    else if (ptrs.size === 1) { const k = (2.6 * Math.PI) / Math.max(400, dom.clientWidth * 1.6); rot(dx * k * 1.5, dy * k * 0.6); last = now; st.vaz = (-dx * k * 1.5) / dt * 16; st.vel = (dy * k * 0.6) / dt * 16; opt.kick(); }
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], pd = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0 > 0) { st.d = clamp(d0 * (pinch0 / pd), opt.dMin(), opt.dMax()); st.el = limitEl(st.el, st.d); }
      // two fingers moving together fly you along the ground
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (mid0) { const m = pan(mid[0] - mid0[0], mid[1] - mid0[1]); last = now; st.vpx = m[0] / dt * 16; st.vpz = m[1] / dt * 16; } mid0 = mid; opt.kick(); }
  };
  const onUp = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) { pinch0 = 0; mid0 = null; } if (!ptrs.size) { st.dragging = false; panBtn = false; if (reduce() || performance.now() - last > 80) { st.vaz = st.vel = st.vpx = st.vpz = 0; } opt.kick(); } };
  const onWheel = (e) => { e.preventDefault(); zoom(Math.exp(clamp(e.deltaY, -120, 120) * 0.0016)); };
  const onKey = (e) => {
    const k = e.key, s = 0.17;
    if (k === 'ArrowLeft') setGoal({ az: (st.goal ? st.goal.az : st.az) + s });
    else if (k === 'ArrowRight') setGoal({ az: (st.goal ? st.goal.az : st.az) - s });
    else if (k === 'ArrowUp') setGoal({ el: limitEl((st.goal ? st.goal.el : st.el) + s, st.d) });
    else if (k === 'ArrowDown') setGoal({ el: limitEl((st.goal ? st.goal.el : st.el) - s, st.d) });
    else if (k === '+' || k === '=' || k === 'Add') zoom(0.82);
    else if (k === '-' || k === '_' || k === 'Subtract') zoom(1.22);
    else if (k === 'r' || k === 'R') opt.reset();
    // W A S D fly along the ground around the snake
    else if (k === 'w' || k === 'W' || k === 's' || k === 'S' || k === 'a' || k === 'A' || k === 'd' || k === 'D') {
      const step = 60, kk = k.toLowerCase(); pan(kk === 'a' ? -step : kk === 'd' ? step : 0, kk === 'w' ? -step : kk === 's' ? step : 0); opt.kick();
    }
    else return;
    e.preventDefault();
  };
  dom.addEventListener('pointerdown', onDown); dom.addEventListener('pointermove', onMove); dom.addEventListener('pointerup', onUp); dom.addEventListener('pointercancel', onUp); dom.addEventListener('contextmenu', onCtx);
  dom.addEventListener('wheel', onWheel, { passive: false }); dom.addEventListener('keydown', onKey);
  // returns true while still moving
  function update() {
    let moving = false;
    // a fling keeps gliding a little longer (smoother than it was)
    if (!st.dragging && (st.vaz || st.vel)) { st.az += st.vaz; st.el = limitEl(st.el + st.vel, st.d); st.vaz *= 0.92; st.vel *= 0.92; if (Math.abs(st.vaz) < 1e-4 && Math.abs(st.vel) < 1e-4) st.vaz = st.vel = 0; else moving = true; }
    if (!st.dragging && (st.vpx || st.vpz)) { st.px += st.vpx; st.pz += st.vpz; clampPan(); st.vpx *= 0.9; st.vpz *= 0.9; if (Math.hypot(st.vpx, st.vpz) < st.d * 1e-5) st.vpx = st.vpz = 0; else moving = true; }
    if (st.goal) {
      const k = 0.2; st.az += (st.goal.az - st.az) * k; st.d += (st.goal.d - st.d) * k; st.el = limitEl(st.el + (st.goal.el - st.el) * k, st.d); st.px += (st.goal.px - st.px) * k; st.pz += (st.goal.pz - st.pz) * k;
      if (Math.abs(st.goal.az - st.az) < 1e-4 && Math.abs(st.goal.d - st.d) / st.d < 1e-4 && Math.abs(st.goal.el - st.el) < 1e-4 && Math.hypot(st.goal.px - st.px, st.goal.pz - st.pz) < st.d * 1e-4) { st.az = st.goal.az; st.d = st.goal.d; st.px = st.goal.px; st.pz = st.goal.pz; st.goal = null; } else moving = true;
    }
    st.el = limitEl(st.el, st.d);
    return moving;
  }
  function dispose() { dom.removeEventListener('pointerdown', onDown); dom.removeEventListener('pointermove', onMove); dom.removeEventListener('pointerup', onUp); dom.removeEventListener('pointercancel', onUp); dom.removeEventListener('wheel', onWheel); dom.removeEventListener('keydown', onKey); dom.removeEventListener('contextmenu', onCtx); }
  return { st, setGoal, update, dispose, zoom };
}

// ---------- the person / ruler used for "Scale" ----------
function personShape(h) {
  const s = new THREE.Shape(), k = h / 1.5;
  const pts = [[0.1, 0], [0.12, 0.7], [0.16, 0.82], [0.2, 1.22], [0.18, 1.3], [0.07, 1.33], [0.06, 1.36], [0.1, 1.42], [0.09, 1.49], [0, 1.5]];
  s.moveTo(-pts[0][0] * k, 0); for (const [x, y] of pts) s.lineTo(x * k, y * k); for (let i = pts.length - 1; i >= 0; i--) s.lineTo(-pts[i][0] * k, pts[i][1] * k);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18 * k, bevelEnabled: true, bevelThickness: 0.03 * k, bevelSize: 0.03 * k, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -0.09 * k); return g;
}

// ---------- the viewer ----------
export function mount(host, opts) {
  const P = normProfile(autoProfile(opts.profile)), seed = strSeed(opts.id || P.name || 'snake');
  const reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduce = () => reduceMQ.matches;
  const lowDevice = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || Math.min(screen.width, screen.height) < 500;
  // software rendering (no GPU: SwiftShader, llvmpipe) is treated as a low-end device
  const softGL = (() => { try { const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl'), e = g && g.getExtension('WEBGL_debug_renderer_info'), r = e ? String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)) : ''; if (g && g.getExtension('WEBGL_lose_context')) g.getExtension('WEBGL_lose_context').loseContext(); return /swiftshader|llvmpipe|software/i.test(r); } catch (err) { return false; } })();
  let quality = opts.quality || window.SL_3D_QUALITY || (lowDevice || softGL ? 'low' : 'high');
  const disposables = new Set(), cleanups = [];
  const track = (o) => { disposables.add(o); return o; };
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); cleanups.push(() => t.removeEventListener(ev, fn, o)); };

  // DOM
  host.innerHTML = '';
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const wrap = el('div', 'sp3d-wrap'), stage = el('div', 'sp3d-stage'), labels = el('div', 'sp3d-labels'), status = el('div', 'sp3d-status');
  const hint = el('p', 'sp3d-hint', (window.innerWidth < 520 ? 'Drag to go round it · two fingers to fly around · pinch to zoom' : 'Drag to go round the snake · right-drag, Shift-drag or W A S D to fly around it · scroll to zoom'));
  status.setAttribute('role', 'status'); status.hidden = true;
  const canvas = document.createElement('canvas'); canvas.className = 'sp3d-canvas'; canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '3D model of ' + opts.name + '. Arrow keys rotate, plus and minus zoom, R resets the view.');
  stage.append(canvas, labels, hint, status);
  const bar = el('div', 'sp3d-bar'); bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', '3D view controls');
  const btn = (txt, title, cls) => { const b = el('button', 'sp3d-b' + (cls ? ' ' + cls : ''), txt); b.type = 'button'; if (title) b.title = title; bar.appendChild(b); return b; };
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
  // v4.80: Anatomy (labelled parts, mouth open) and See bite (a gentle demonstration of a bite on an arm)
  const bAnat = btn('Anatomy', 'Show the parts of this snake: fangs, teeth, glottis, tongue, scales and more'); bAnat.setAttribute('aria-pressed', 'false');
  const bBite = btn('See bite', 'Watch how it bites: the arm turns see-through to show the fang going in');
  const vg2 = el('span', 'sp3d-views'); vg2.setAttribute('role', 'group'); vg2.setAttribute('aria-label', 'Camera views');
  const bVBody = btn('Full body', 'See the whole snake'), bVHead = btn('Head close-up', 'Close up on the head and its scales'), bVTop = btn('Pattern from above', 'Look down on the pattern of its back');
  vg2.append(bVBody, bVHead, bVTop); bar.appendChild(vg2); bar.appendChild(bScale); bScale.textContent = 'Size vs person'; bScale.title = 'Show its adult length next to a ruler and a person 1.5 m tall';
  let mouthGoal = 0;
  const panel = el('div', 'sp3d-panel'); panel.hidden = true; panel.id = 'sp3d-panel-' + seed; bSet.setAttribute('aria-controls', panel.id);
  const mkCheck = (label, checked) => { const l = el('label', 'sp3d-opt'), c = document.createElement('input'); c.type = 'checkbox'; c.checked = checked; l.append(c, document.createTextNode(' ' + label)); panel.appendChild(l); return c; };
  const cScene = mkCheck('Show surroundings', true);
  const ql = el('label', 'sp3d-opt'), qs = document.createElement('select');
  [['high', 'High detail'], ['low', 'Light (faster)']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === quality) o.selected = true; qs.appendChild(o); });
  ql.append(document.createTextNode('Quality '), qs); panel.appendChild(ql);
  const cap = el('div', 'sp3d-cap');
  const gx = P.generated, gf = gx != null && gx.includes('f');
  const recon = el('p', 'sp3d-recon', gx == null ? 'Representative reconstruction - not a photograph of a real encounter.'
    : gf ? 'Reconstruction of how it may have looked: body shape from its family and size from its fossils. Colours are a guess - fossils keep no colour.'
    : 'Generated model: body shape from its family' + (gx.includes('g') ? ', colours a guess for its group (no photo yet).' : ', colours from its SnakeList photo.') + ' Not a scan of a real snake.');
  const lenP = el('p', 'sp3d-len'); const scaleP = el('p', 'sp3d-scale'); scaleP.hidden = true;
  cap.append(recon, lenP, scaleP);
  wrap.append(stage, bar, panel);
  host.append(wrap, cap);
  lenP.textContent = 'Modelled at ' + fmtLen(P.length) + ', a typical adult' + (P.lengthNote ? ' (' + P.lengthNote + ')' : '') + '.' + (P.max ? ' Longest recorded: ' + P.max + ' (not shown).' : '');

  // renderer
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'default', preserveDrawingBuffer: !!opts.testing });
  } catch (err) { host.innerHTML = ''; throw new Error('webgl'); }
  const maxPR = quality === 'low' ? 1.25 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPR));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.86;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = quality === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  const ctx = { renderer, scene: null, track };
  let snakeGroup, cam, controls, info, extras, raf = 0, dirty = true, lost = false, alive = true, scaleObj = null, markers = [], bite = null;

  function build() {
    const scene = new THREE.Scene(); ctx.scene = scene;
    { const en = !opts.noEnv && (P.scene.env || ENV_FOR[P.scene.kind]); if (en) loadEnv(en).catch(() => {}); } // v4.81: start downloading the panorama now
    let t0 = performance.now();
    const F = makeBodyFns(P, quality), pose = makePose(P, F, seed); perfT('pose', t0); t0 = performance.now();
    const body = buildBody(P, F, pose, quality); perfT('body', t0); t0 = performance.now();
    const lat = scaleLattice(P, body.gTotal), tiles = scaleTextures(P, lat); perfT('scaleTex', t0); t0 = performance.now();
    // v4.81: on good devices a quick pattern first, the full-detail one painted in a worker and swapped in when ready
    const hiPat = quality !== 'low', pat = patternTexture(P, F, body, lat, hiPat ? 'preview' : 'low', seed); perfT('patternTex', t0);
    const rep = body.gTotal / lat.Pt;
    for (const t of [tiles.normal, tiles.cavity]) { t.repeat.set(1, rep); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); }
    pat.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const S = P.scales, gl = S.gloss;
    const mat = new THREE.MeshPhysicalMaterial({
      // v4.72: raised 3D scales - stronger relief, deeper gaps between them, and real bumps on good devices
      map: pat, normalMap: tiles.normal, normalScale: new THREE.Vector2(2.1, 2.1), aoMap: tiles.cavity, aoMapIntensity: 1.15, roughnessMap: tiles.cavity,
      ...(quality === 'low' || P.scales.rows > 40 ? {} : { displacementMap: tiles.cavity, displacementScale: F.w0 * 0.035, displacementBias: -F.w0 * 0.03 }),
      roughness: lerp(0.82, 0.58, gl), metalness: 0, clearcoat: 0.12 + gl * 0.5, clearcoatRoughness: lerp(0.5, 0.22, gl), sheen: S.sheen != null ? S.sheen : 0.12, sheenRoughness: S.sheenRough || 0.7, sheenColor: new THREE.Color(S.sheenColor || '#ffffff').multiplyScalar(S.sheen != null ? 0.6 : 0.12), // velvety skins (Gaboon viper) get a strong sheen
      iridescence: S.iridescence || 0, iridescenceIOR: 1.6, envMapIntensity: 0.85,
    });
    // the cavity map also darkens the skin between scales in direct light (as in real snakes)
    // v4.81: heads without big shields (vipers, pythons, boas) get small scales of their own, drawn in the shader
    // from true distances on the skin, so they keep their shape right to the tip of the snout (the body's scale
    // texture used to stretch into stripes there); they fade out where they would be smaller than a pixel
    const qS = (TAU * F.w0 * 0.92) / Math.max(12, S.rows) * (P.head.scaleK || (P.plan === 'python' ? 0.9 : 0.62));
    const hsU = { uHS: { value: new THREE.Vector2(1 / qS, 1 / (qS * 0.82)) }, uKeel: { value: Math.min(1, S.keel || 0) }, uCavH: { value: S.cavity != null ? S.cavity : 0.45 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, hsU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aHead;\nvarying float vHead;\nattribute vec3 aMet;\nvarying vec3 vMet;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvHead = aHead; vMet = aMet;')
        .replace('displacementScale + displacementBias )', 'displacementScale + displacementBias ) * (1.0 - aMet.z)');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying float vHead; varying vec3 vMet; uniform vec2 uHS; uniform float uKeel; uniform float uCavH;
float slScale(vec2 m) {
  float row = floor(m.y), off = mod(row, 2.0) * 0.5;
  vec2 l = m - vec2(floor(m.x + off) - off + 0.5, row + 0.5);
  float t = clamp(l.y + 0.5, 0.0, 1.0), wx = 0.52 * (1.0 - 0.4 * t * t), d = (l.x / wx) * (l.x / wx) + (l.y / 0.56) * (l.y / 0.56);
  float h = d < 1.0 ? sqrt(1.0 - d) * 0.55 + 0.45 * t : 0.0;
  return h + (d < 1.0 ? uKeel * 0.32 * exp(-pow(l.x / 0.09, 2.0)) * smoothstep(-0.45, 0.25, l.y) : 0.0);
}`)
        .replace('#include <map_fragment>', `#include <map_fragment>
 vec2 slM = vMet.xy * uHS; float slFade = vMet.z * (1.0 - smoothstep(0.3, 0.75, length(fwidth(slM))));
 float slH = 0.0, slDa = 0.0, slDx = 0.0;
 if (slFade > 0.001) { slH = slScale(slM); slDa = (slScale(slM + vec2(0.03, 0.0)) - slScale(slM - vec2(0.03, 0.0))) / 0.06; slDx = (slScale(slM + vec2(0.0, 0.03)) - slScale(slM - vec2(0.0, 0.03))) / 0.06;
   diffuseColor.rgb *= mix(1.0, 0.55 + 0.45 * smoothstep(0.0, 0.3, slH), uCavH * slFade); }
#ifdef USE_AOMAP
 diffuseColor.rgb *= mix(1.0, texture2D(aoMap, vAoMapUv).r, uCavH * (1.0 - vHead * 0.9) * (1.0 - vMet.z));
#endif`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, roughness * (0.9 + 0.25 * slH), vMet.z);')
        .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * (1.0 - vHead * 0.88);\n mapN = normalize(mix(mapN, normalize(vec3(-slDa * 0.55, -slDx * 0.55, 1.0)), vMet.z));');
    };
    mat.customProgramCacheKey = () => 'sl-skin-v481';
    const mesh = new THREE.Mesh(body.geo, mat); mesh.castShadow = mesh.receiveShadow = true;
    if (hiPat) {
      const sceneNow = ctx.scene, swap = (d) => { if (!alive || ctx.scene !== sceneNow) return; const t = patternTex(d); t.anisotropy = pat.anisotropy; mat.map = t; pat.dispose(); track(t); dirty = true; kick(); };
      ctx.patternReady = patternInWorker(P, quality, seed).then(swap).catch(() => new Promise((r) => setTimeout(() => { if (alive && ctx.scene === sceneNow) swap(patternData(P, F, body, lat, quality, seed)); r(); }, 60)));
    } else ctx.patternReady = Promise.resolve();
    snakeGroup = new THREE.Group(); snakeGroup.add(mesh);

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

    if (P.tail.spine) { const f = body.frameAt(F.L), c = body.spine(F.L), r = F.w0 * 0.14, g = new THREE.ConeGeometry(r, r * 3, 8); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#6a5246', roughness: 0.5 })); m.position.copy(c).addScaledVector(f.T, r * 1.2); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), f.T); snakeGroup.add(m); }
    // bounds
    const bb = new THREE.Box3().setFromObject(snakeGroup), size = bb.getSize(new THREE.Vector3()), center = bb.getCenter(new THREE.Vector3());
    const Rb = Math.max(size.x, size.z) / 2 * 1.05 + F.w0;
    const hMax = bb.max.y;
    const poseInfo = { pts: pose.pts, ds: pose.ds, Ly: pose.Ly, radius: Rb, envR: P.length >= 0.4 ? Rb + 1.0 : Rb * 1.3, seaLevel: F.Hh(F.L * 0.5) * F.bf * (P.scene.float || 1.1) };
    // water side for riverbank: the side of the snake with most open space
    if ((SCENES[P.scene.kind] || {}).water === 'river') { let best = 0, bd = -1; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; let m = -1e9; for (const p of pose.pts) m = Math.max(m, p[0] * Math.cos(a) + p[1] * Math.sin(a)); if (bd < 0 || m < bd) { bd = m; best = a; } } poseInfo.waterDir = best; poseInfo.waterDist = bd + F.w0 * 2.5 + Rb * 0.12; }
    scene.add(snakeGroup);
    if (P.scene.kind !== 'sea') scene.add(contactShadow(poseInfo, F, Rb));
    ctx.natureReady = null; ctx.afterNature = () => { if (!cScene.checked) setSceneVisible(false); dirty = true; kick(); };
    t0 = performance.now(); buildScene(ctx, P, F, body, poseInfo, seed, quality); perfT('scene', t0);
    if (!cScene.checked) setSceneVisible(false);
    // the photographic surroundings arrive a moment later (cached after the first time)
    const envName = P.scene.env || ENV_FOR[P.scene.kind], myScene = scene;
    ctx.envReady = envName && !opts.noEnv ? loadEnv(envName).then((env) => {
      if (!alive || ctx.scene !== myScene) return false;
      const tE = performance.now(); env.name = envName; applyEnv(ctx, P, F, poseInfo, env); perfT('applyEnv', tE); if (!cScene.checked) setSceneVisible(false); dirty = true; kick(); return true;
    }).catch(() => false) : Promise.resolve(false);
    ctx.envReady = Promise.all([ctx.envReady, ctx.natureReady, ctx.patternReady]).then((r) => r[0]); // (tests wait for everything)

    const headPos = body.surf(F.Hl * 0.45, 0).p;
    const headDir = body.frameAt(F.Hl * 0.5).T.clone().negate(); // pointing out of the snout
    // main body axis (for the side view): principal direction of the footprint
    let sxx = 0, szz = 0, sxz = 0; for (const p of pose.pts) { sxx += p[0] * p[0]; szz += p[1] * p[1]; sxz += p[0] * p[1]; }
    const axisAng = 0.5 * Math.atan2(2 * sxz, sxx - szz);
    info = { F, body, center: new THREE.Vector3(center.x, Math.min(center.y, hMax * 0.5), center.z), Rb, hMax, headPos, headDir, axisAng, eyePos, size };
    info.collide = []; for (let i = 0, n = 240; i <= n; i++) { const x = (i / n) * F.L; info.collide.push({ p: body.spine(x), r: Math.max(F.W(x), F.Hh(x)) * 1.05 }); }
    t0 = performance.now();
    extras = { mat, eyes: eyeMeshes, mouth: P.plan === 'blind' ? null : buildMouth(P, F, body, snakeGroup, eyeMeshes.concat(headParts), pat) }; perfT('mouth', t0);
    bite = null; bBite.disabled = false; bBite.textContent = 'See bite'; bAnat.hidden = bBite.hidden = !extras.mouth;
    if (bAnat.getAttribute('aria-pressed') === 'true') { bAnat.setAttribute('aria-pressed', 'false'); markers.filter((m) => m.anat).forEach((m) => m.el.remove()); markers = markers.filter((m) => !m.anat); }
    if (bMouth) { bMouth.hidden = !extras.mouth; mouthGoal = 0; bMouth.setAttribute('aria-pressed', 'false'); bMouth.textContent = 'Open mouth'; }
    // camera
    cam = new THREE.PerspectiveCamera(38, 1, Rb * 0.001, Rb * 40);
    if (!controls) {
      controls = Controls(canvas, cam, {
        reduce, maxEl: (80 * Math.PI) / 180,
        minEl: (d) => Math.max((8 * Math.PI) / 180, Math.asin(clamp((info.hMax * 1.3 - targetFor(d).y) / d, 0, 0.95))),
        dMin: () => info.dMin, dMax: () => info.dMax * (scaleObj && scaleObj.visible ? info.scaleK : 1), kick: () => kick(), reset: () => resetView(),
        panMax: () => info.Rb * 1.4, // you can fly around the snake, never away from it
      });
    }
    fitLimits();
    resetView(true);
    if (bScale.getAttribute('aria-pressed') === 'true') toggleScale(true);
    if (bDet.getAttribute('aria-pressed') === 'true') buildMarkers();
    kick();
  }
  function setSceneVisible(v) { if (!ctx.scene) return; (ctx.occ || []).forEach((o) => { if (o.hid) { o.hid = false; if (o.im) { o.im.setMatrixAt(o.i, o.m); o.im.instanceMatrix.needsUpdate = true; } } }); ctx.scene.traverse((o) => { if (o !== ctx.scene && o.parent === ctx.scene && o !== snakeGroup && !o.isLight && o !== scaleObj) o.visible = v; }); kick(); }

  function fitLimits() {
    const r = info.Rb, asp = Math.max(0.4, (stage.clientWidth || 1) / (stage.clientHeight || 1));
    const vf = (cam.fov * Math.PI) / 360, hf = Math.atan(Math.tan(vf) * asp);
    info.portrait = asp < 0.8; info.vf = vf; info.hf = hf;
    // the snake lies flat: fit its footprint across the view, and its foreshortened depth (seen from above at an angle) up and down
    info.dFit = Math.max((r * (info.portrait ? 0.98 : 1.1)) / Math.tan(hf), (r * (info.portrait ? 0.8 : 0.62)) / Math.tan(vf)) + r * 0.4;
    info.dMax = info.dFit * 1.55;
    info.dMin = Math.max(info.F.Hl * 3.2, info.F.w0 * 5);
    info.scaleK = 1;
  }
  function targetFor(d) {
    // zooming in moves the point you orbit around from the middle of the snake to its head
    const k = sstep(info.dFit * 0.75, info.dMin * 1.2, d), t = info.center.clone().lerp(info.headPos, k);
    if (controls) { t.x += controls.st.px; t.z += controls.st.pz; }
    if (scaleObj && scaleObj.visible && info.F.L >= 0.4) t.y += 0.55 * sstep(info.dFit, info.dFit * 1.6, d); // keep the 1.5 m figure in view
    return t;
  }
  function viewAz(kind) {
    const hd = info.headDir; const a = Math.atan2(hd.x, hd.z);
    if (kind === 'front') return a; if (kind === 'side') return -info.axisAng + Math.PI / 2; return a + 0.9;
  }
  function resetView(instant) { controls.setGoal({ az: viewAz('default'), el: ((info.portrait ? 40 : 30) * Math.PI) / 180, d: info.dFit, px: 0, pz: 0 }, instant); }
  function setView(kind) {
    if (kind === 'front') controls.setGoal({ az: viewAz('front'), el: (14 * Math.PI) / 180, d: Math.max(info.dMin * 1.6, info.dFit * 0.42) });
    else if (kind === 'side') controls.setGoal({ az: viewAz('side'), el: (12 * Math.PI) / 180, d: info.dFit * 1.0 });
    else controls.setGoal({ az: controls.st.az, el: (80 * Math.PI) / 180, d: (info.Rb * 1.12) / Math.tan(Math.min(info.vf, info.hf)) + info.hMax });
  }

  // the camera never enters the body: its distance to the body's centre line must exceed the body's
  // half-thickness there plus a margin for the near plane; if not, it backs away along its line of sight
  function bodyClearance(p) {
    let m = 1e9; for (const c of info.collide) { const d = p.distanceTo(c.p) - c.r; if (d < m) m = d; } return m;
  }
  function placeCamera() {
    const st = controls.st;
    let t = targetFor(st.d);
    const put = () => cam.position.set(t.x + st.d * Math.cos(st.el) * Math.sin(st.az), t.y + st.d * Math.sin(st.el), t.z + st.d * Math.cos(st.el) * Math.cos(st.az));
    put();
    for (let k = 0; k < 40 && bodyClearance(cam.position) < st.d * 0.06; k++) { st.d = Math.min(st.d * 1.05, info.dMax); if (st.goal && st.goal.d < st.d) st.goal.d = st.d; t = targetFor(st.d); put(); if (st.d >= info.dMax) break; }
    cam.near = Math.max(st.d * 0.02, 1e-4); cam.far = Math.max(info.Rb * 40, 300); cam.updateProjectionMatrix(); cam.lookAt(t);
    // v4.72: the haze begins beyond the snake from wherever you look, never on it
    const fog = ctx.scene && ctx.scene.fog; if (fog && ctx.fogNear0 != null) { fog.near = Math.max(ctx.fogNear0, st.d * 1.6); fog.far = Math.max((ctx.farR || 60) * 0.95, fog.near * 3); }
  }
  function resize() {
    const w = stage.clientWidth || 300, h = stage.clientHeight || 200;
    renderer.setSize(w, h, false); if (cam) { cam.aspect = w / h; cam.updateProjectionMatrix(); fitLimits(); controls && (controls.st.d = clamp(controls.st.d, info.dMin, controls.st.goal ? 1e9 : info.dMax * (scaleObj && scaleObj.visible ? info.scaleK : 1))); }
    kick();
  }
  function frame() {
    raf = 0; if (!alive || lost || !cam) return;
    if (document.hidden || !host.isConnected || host.offsetParent === null && !document.fullscreenElement) { dirty = true; return; } // paused while hidden
    let moving = controls.update();
    // the jaw opens and shuts smoothly
    const mo = extras && extras.mouth;
    if (bite && stepBite()) moving = true;
    if (mo && Math.abs(mo.t - mouthGoal) > 1e-3) { const nt = reduce() ? mouthGoal : mo.t + clamp(mouthGoal - mo.t, -0.07, 0.07); mo.set(nt); if (Math.abs(nt - mouthGoal) <= 1e-3) mo.settle(); moving = true; }
    placeCamera();
    updateOccluders();
    renderer.render(ctx.scene, cam);
    updateMarkers();
    if (moving) kick();
  }
  const zeroM = new THREE.Matrix4().makeScale(0, 0, 0), ov = new THREE.Vector3(), od = new THREE.Vector3();
  function updateOccluders() {
    const list = ctx.occ; if (!list || !list.length) return;
    const t = targetFor(controls.st.d), cp = cam.position; od.subVectors(t, cp); const len2 = od.lengthSq(), sr = Math.min(info.Rb, controls.st.d * 0.4);
    const dirty = new Set();
    for (const o of list) {
      ov.subVectors(o.c, cp); const tt = ov.dot(od) / len2; let hide = ov.length() < o.r * 1.6; // also anything right in front of the lens
      if (!hide && tt > 0.02 && tt < 1.05) { const perp = ov.addScaledVector(od, -tt).length(); hide = perp < o.r + sr * Math.min(1, tt) * 0.9; }
      if (hide === o.hid) continue; o.hid = hide;
      if (o.mesh) o.mesh.visible = !hide && (cScene.checked); else { o.im.setMatrixAt(o.i, hide ? zeroM : o.m); dirty.add(o.im); }
    }
    dirty.forEach((im) => { im.instanceMatrix.needsUpdate = true; });
  }
  function kick() { if (!raf && alive) raf = requestAnimationFrame(frame); }

  // scale comparison: a 1.5 m person (or a ruler for small snakes), both at true size
  function toggleScale(force) {
    const onv = force != null ? force : bScale.getAttribute('aria-pressed') !== 'true';
    bScale.setAttribute('aria-pressed', String(onv));
    if (onv && !scaleObj) {
      scaleObj = new THREE.Group(); const L = info.F.L, side = new THREE.Vector3(Math.cos(info.axisAng), 0, Math.sin(info.axisAng)), perp = new THREE.Vector3(-side.z, 0, side.x);
      const m = new THREE.MeshStandardMaterial({ color: '#5b6b62', roughness: 0.8 });
      const rulerAt = info.center.clone().addScaledVector(perp, info.Rb * 1.05); rulerAt.y = 0;
      // ruler: the typical adult length laid straight
      const tickT = canvasTex(1024, (x, s) => { x.fillStyle = '#f3efe2'; x.fillRect(0, 0, s, s); x.fillStyle = '#2b2b2b'; const n = L >= 2 ? Math.round(L * 2) : L >= 0.5 ? Math.round(L * 10) : Math.round(L * 100); for (let i = 0; i <= n; i++) { const px = (i / n) * s * (n / (L >= 2 ? L * 2 : L >= 0.5 ? L * 10 : L * 100)); x.fillRect(Math.min(s - 4, px), 0, 4, i % (L >= 2 ? 2 : 5) === 0 ? s * 0.7 : s * 0.4); } });
      tickT.wrapS = tickT.wrapT = THREE.ClampToEdgeWrapping; tickT.repeat.set(1, 1);
      const rw = Math.max(L * 0.025, 0.004), rg = new THREE.BoxGeometry(L, rw * 0.25, rw);
      const ruler = new THREE.Mesh(rg, [m, m, new THREE.MeshStandardMaterial({ map: tickT, roughness: 0.7 }), m, m, m]);
      ruler.position.copy(rulerAt).addScaledVector(new THREE.Vector3(0, 1, 0), rw * 0.125); ruler.rotation.y = -info.axisAng; ruler.castShadow = true; scaleObj.add(ruler);
      scaleObj.userData.labels = [{ p: ruler.position.clone().addScaledVector(side, L * 0.5).add(new THREE.Vector3(0, rw * 2, 0)), t: fmtLen(L) + ' ruler (typical adult, laid straight)' }];
      if (L >= 0.4) {
        const pg = personShape(1.5), person = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: '#4d5a52', roughness: 0.9 }));
        const pp = info.center.clone().addScaledVector(side, info.Rb + 0.45); pp.y = 0; person.position.copy(pp); person.lookAt(new THREE.Vector3(info.center.x, 0, info.center.z)); person.rotateY(Math.PI / 2); person.castShadow = true; scaleObj.add(person);
        scaleObj.userData.labels.push({ p: pp.clone().add(new THREE.Vector3(0, 1.58, 0)), t: 'Person 1.5 m' });

      }
      ctx.scene.add(scaleObj);
    }
    if (scaleObj) scaleObj.visible = onv;
    scaleP.hidden = !onv;
    scaleP.textContent = onv ? 'Scale: the ruler is ' + fmtLen(info.F.L) + ' long, the length of a typical adult' + (P.lengthNote ? ' (' + P.lengthNote + ')' : '') + (info.F.L >= 0.4 ? '; the figure is a person 1.5 m tall.' : '.') + (P.max ? ' The longest recorded was ' + P.max + '; that is not drawn.' : '') : '';
    if (onv) {
      const Rf = info.F.L >= 0.4 ? Math.max(info.Rb + 0.8, 1.0) : info.Rb * 1.35, dS = Math.max((Rf * 1.12) / Math.sin(Math.min(info.vf, info.hf)), info.F.L >= 0.4 ? 1.0 / Math.tan(info.vf) : 0);
      info.scaleK = Math.max(1, (dS * 1.25) / info.dMax);
      // look across the ruler, with the person standing beside the snake rather than in front of it
      const pa = info.axisAng + Math.PI / 2;
      controls.setGoal({ d: Math.max(dS, info.dFit), el: (22 * Math.PI) / 180, az: Math.atan2(Math.cos(pa), Math.sin(pa)) });
    } else controls.setGoal({ d: Math.min(controls.st.d, info.dMax) });
    rebuildMarkers(); kick();
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
    if (scaleObj && scaleObj.visible) for (const l of scaleObj.userData.labels) { const e = el('div', 'sp3d-mk sp3d-sl'); e.appendChild(el('span', 'sp3d-mt', l.t)); labels.appendChild(e); markers.push({ el: e, p: l.p, n: null, scale: true }); }
    markers = markers.filter((m) => m.el.isConnected);
  }
  const v3 = new THREE.Vector3();
  function updateMarkers() {
    if (!markers.length) return; const w = stage.clientWidth, h = stage.clientHeight, placed = [];
    for (const m of markers) if (m.fn) m.p = m.fn();
    const list = markers.map((m) => { v3.copy(m.p).project(cam); return { m, x: (v3.x * 0.5 + 0.5) * w, y: (-v3.y * 0.5 + 0.5) * h, vis: v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05 }; }).sort((a, b) => a.y - b.y);
    for (const o of list) {
      const m = o.m; m.el.hidden = !o.vis; if (!o.vis) continue;
      if (!m.sz) m.sz = [m.el.offsetWidth || 120, m.el.offsetHeight || 20];
      let x = Math.min(o.x, w - m.sz[0] + 6), y = o.y;
      if (!m.scale) for (const q of placed) if (x < q[0] + q[2] && x + m.sz[0] > q[0] && y < q[1] + q[3] && y + m.sz[1] > q[1]) y = q[1] + q[3] + 2;
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
  function syncFull() { const f = isFull(); bFull.textContent = f ? 'Exit fullscreen' : 'Fullscreen'; bFull.setAttribute('aria-pressed', String(f)); setTimeout(resize, 30); }

  // events
  on(bFront, 'click', () => setView('front')); on(bSide, 'click', () => setView('side')); on(bTop, 'click', () => setView('top'));
  on(bReset, 'click', () => { resetView(); if (mouthGoal) toggleMouth(false); });
  function toggleMouth(force) {
    if (!extras || !extras.mouth) return;
    const v = force != null ? force : !mouthGoal; mouthGoal = v ? 1 : 0;
    bMouth.setAttribute('aria-pressed', String(v)); bMouth.textContent = v ? 'Close mouth' : 'Open mouth';
    if (v) { // turn to face the head, close enough to see inside
      controls.setGoal({ az: viewAz('front') + 0.55, el: (16 * Math.PI) / 180, d: Math.max(info.dMin * 1.5, info.F.Hl * 5.5), px: 0, pz: 0 });
    }
    kick();
  }
  on(bMouth, 'click', () => toggleMouth());
  // ---- v4.80: Anatomy ----
  const wpos = (o) => () => o.getWorldPosition(new THREE.Vector3());
  function anatomyList() {
    const mo = extras.mouth, A = mo.anchors, F = info.F, b = info.body, L = [], ap = (k) => { const a = anchorPos(k); return () => a.p.clone().add(snakeGroup.position); };
    if (extras.eyes[0]) L.push(['Eye: no eyelids - a clear scale covers it', wpos(extras.eyes[0])]);
    L.push(['Nostril', ap('nostril')]);
    if (P.head.pits) L.push(['Heat pit: feels the warmth of prey', ap('pit')]);
    if (A.fang) L.push([mo.fanged ? 'Fang: hollow, injects venom' : 'Teeth: curved backwards to hold prey', wpos(A.fang)]);
    if (mo.fanged) L.push(['Teeth: hold prey, no venom', wpos(A.teeth)]);
    L.push(['Palate teeth: walk food into the throat', wpos(A.palate)]);
    L.push(['Glottis: breathing tube - it can breathe while swallowing', wpos(A.glottis)]);
    L.push(['Tongue sheath: the forked tongue smells the air', wpos(A.sheath)]);
    L.push(['Jaw hinge: very loose, to swallow big prey', wpos(A.hinge)]);
    L.push([P.scales.keel > 0.3 ? 'Keeled scales (each has a ridge)' : 'Smooth scales', ap('back')]);
    L.push(['Belly scales: grip the ground to move', ap('belly')]);
    const vx = F.L * (1 - P.body.tail), vp = b.surf(vx, Math.PI * 0.92).p; L.push(['Vent: where the tail begins', () => vp.clone().add(snakeGroup.position)]);
    L.push(P.tail.rattle ? ['Rattle: buzzes to warn enemies', ap('rattle')] : ['Tail', ap('tail')]);
    return L;
  }
  function toggleAnatomy(force) {
    if (!extras || !extras.mouth) return;
    const onv = force != null ? force : bAnat.getAttribute('aria-pressed') !== 'true'; bAnat.setAttribute('aria-pressed', String(onv));
    markers.filter((m) => m.anat).forEach((m) => m.el.remove()); markers = markers.filter((m) => !m.anat);
    if (onv) {
      for (const [txt, fn] of anatomyList()) { const e = el('div', 'sp3d-mk sp3d-an'); e.appendChild(el('span', 'sp3d-dot')); e.appendChild(el('span', 'sp3d-mt', txt)); labels.appendChild(e); markers.push({ el: e, fn, p: fn(), n: null, anat: true }); }
      toggleMouth(true);
      const d = Math.max(info.dMin * 2.2, info.F.Hl * 9), kk = sstep(info.dFit * 0.75, info.dMin * 1.2, d), tg = info.headPos.clone().sub(info.center.clone().lerp(info.headPos, kk));
      controls.setGoal({ az: viewAz('front') + 0.75, el: (32 * Math.PI) / 180, d, px: tg.x, pz: tg.z }); // the head in the middle, far enough for the labels to spread out
    }
    kick();
  }
  on(bAnat, 'click', () => toggleAnatomy());
  // ---- v4.80: See bite - the snake strikes a (see-through) arm so you can see how deep the fang goes ----
  const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  function startBite() {
    if (!extras || !extras.mouth || bite) return;
    const mo = extras.mouth, A = mo.anchors, Hl = info.F.Hl, OPEN = 0.8;
    const t0 = mo.t; mo.set(OPEN); snakeGroup.updateMatrixWorld(true); const tip = A.fang.getWorldPosition(new THREE.Vector3()).sub(snakeGroup.position); mo.set(t0);
    const hd = info.headDir.clone().setY(0).normalize(), side = new THREE.Vector3().crossVectors(hd, new THREE.Vector3(0, 1, 0)).normalize();
    const R = Math.max(0.035, Hl * 0.9), depth = A.fangLen * 0.85, lunge = Hl * 0.9, dy = R * 0.45, half = Math.sqrt(R * R - dy * dy);
    const c = tip.clone().addScaledVector(hd, lunge + half - depth); c.y = tip.y + dy;
    // the arm runs away from the camera, its near end just past the bite, so you look into it along its length
    const arm = new THREE.Group(); arm.position.copy(c).addScaledVector(side, R * 1.0); arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), side);
    const mk = (r, len, col, op) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 24), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.6, transparent: true, opacity: op, depthWrite: false })); arm.add(m); return m; };
    const skin = mk(R, R * 4, '#d8a888', 0), muscle = mk(R * 0.8, R * 3.8, '#c97a70', 0), bone = mk(R * 0.2, R * 3.7, '#efe6d2', 0);
    skin.renderOrder = 3; muscle.renderOrder = 2; bone.renderOrder = 1;
    const venom = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: '#f0cf55', emissive: '#6b5410', transparent: true, opacity: 0.8 })); venom.visible = false; ctx.scene.add(venom);
    ctx.scene.add(arm);
    const az = Math.atan2(-side.x, -side.z) - 0.75, d = Math.max(info.dMin * 1.1, (Hl * 1.2 + R * 1.6) / Math.tan(info.vf));
    const kk = sstep(info.dFit * 0.75, info.dMin * 1.2, d), tg = tip.clone().addScaledVector(hd, lunge * 0.6).sub(info.center.clone().lerp(info.headPos, kk)); // look at the bite
    controls.setGoal({ az, el: 0.22, d, px: tg.x, pz: tg.z });
    const e = el('div', 'sp3d-mk sp3d-an'); e.appendChild(el('span', 'sp3d-dot')); e.appendChild(el('span', 'sp3d-mt', (mo.fanged ? 'Fang' : 'Tooth') + ' goes in about ' + Math.max(1, Math.round(depth * 1000)) + ' mm')); e.hidden = true; labels.appendChild(e);
    const lab = { el: e, fn: wpos(A.fang), p: tip.clone(), n: null, anat: true, bite: true };
    bite = { start: performance.now(), arm, skin, muscle, bone, venom, hd, lunge, R, lab, wasAnat: bAnat.getAttribute('aria-pressed') === 'true', fanged: mo.fanged };
    mouthGoal = OPEN; bMouth.setAttribute('aria-pressed', 'true'); bMouth.textContent = 'Close mouth';
    bBite.disabled = true; bBite.textContent = 'Biting...'; kick();
  }
  function stepBite() {
    const B = bite, s2 = ((B.freeze != null ? B.start + B.freeze : performance.now()) - B.start) / 1000 / (reduce() ? 0.6 : 1), A = extras.mouth.anchors;
    const arm = ease(s2 / 0.8) * (1 - ease((s2 - 5.0) / 0.7)), strike = ease((s2 - 1.0) / 0.22) * (1 - ease((s2 - 4.4) / 0.5)), xr = ease((s2 - 1.4) / 0.7) * (1 - ease((s2 - 4.4) / 0.6));
    snakeGroup.position.copy(B.hd).multiplyScalar(B.lunge * strike);
    B.skin.material.opacity = arm * (1 - xr * 0.75); B.skin.material.depthWrite = arm > 0.99 && xr < 0.01;
    B.muscle.material.opacity = arm * xr * 0.35; B.bone.material.opacity = arm * xr * 0.6;
    const vk = B.fanged ? ease((s2 - 2.0) / 1.5) * xr : 0; B.venom.visible = vk > 0.01;
    if (B.venom.visible) { B.venom.position.copy(A.fang.getWorldPosition(new THREE.Vector3())); B.venom.scale.setScalar(B.R * 0.18 * vk); }
    if (!markers.includes(B.lab) && s2 > 1.8 && s2 < 4.4) markers.push(B.lab);
    if (markers.includes(B.lab) && s2 >= 4.4) { B.lab.el.remove(); markers = markers.filter((m) => m !== B.lab); }
    if (s2 > 4.5 && mouthGoal) { mouthGoal = B.wasAnat ? 1 : 0; bMouth.setAttribute('aria-pressed', String(!!mouthGoal)); bMouth.textContent = mouthGoal ? 'Close mouth' : 'Open mouth'; }
    if (s2 > 5.8) {
      B.lab.el.remove(); markers = markers.filter((m) => m !== B.lab); snakeGroup.position.set(0, 0, 0);
      for (const o of [B.arm, B.venom]) { ctx.scene.remove(o); o.traverse((q) => { if (q.geometry) q.geometry.dispose(); if (q.material) q.material.dispose(); }); }
      bite = null; bBite.disabled = false; bBite.textContent = 'See bite'; return true;
    }
    return true;
  }
  on(bBite, 'click', startBite);
  on(bVBody, 'click', () => resetView());
  on(bVHead, 'click', () => controls.setGoal({ az: viewAz('front') + 0.9, el: (20 * Math.PI) / 180, d: Math.max(info.dMin * 1.3, info.F.Hl * 4.5), px: 0, pz: 0 }));
  on(bVTop, 'click', () => controls.setGoal({ az: controls.st.az, el: (80 * Math.PI) / 180, d: (info.Rb * 1.12) / Math.tan(Math.min(info.vf, info.hf)) + info.hMax, px: 0, pz: 0 })); on(bFull, 'click', toggleFull); on(bScale, 'click', () => toggleScale()); on(bDet, 'click', toggleDetails);
  on(bSet, 'click', () => { panel.hidden = !panel.hidden; bSet.setAttribute('aria-expanded', String(!panel.hidden)); });
  on(cScene, 'change', () => setSceneVisible(cScene.checked));
  on(qs, 'change', () => { quality = qs.value; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1.25 : 2)); rebuild(); });
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
      if (o.dispose && o.isInstancedMesh) o.dispose();
      if (o.shadow && o.shadow.map) o.shadow.map.dispose();
    });
    for (const d of disposables) d.dispose && d.dispose(); disposables.clear();
    ctx.scene.clear(); ctx.scene = null; scaleObj = null;
    markers.forEach((m) => m.el.remove()); markers = [];
  }
  function rebuild() { const st = controls ? { az: controls.st.az, el: controls.st.el } : null; disposeScene(); build(); resize(); if (st) controls.setGoal({ az: st.az, el: st.el, d: info.dFit }, true); kick(); }

  build(); resize();
  if (opts.testing) window.__sp3d = { THREE, renderer, bodyClearance: () => bodyClearance(cam.position), get envReady() { return ctx.envReady; }, extras: () => extras, setScene: (v) => { cScene.checked = v; setSceneVisible(v); }, get scene() { return ctx.scene; }, get cam() { return cam; }, controls, info: () => info, setView, resetView, toggleScale, toggleDetails, toggleAnatomy, startBite, get bite() { return bite; }, frame: () => { controls.update(); placeCamera(); updateOccluders(); renderer.render(ctx.scene, cam); updateMarkers(); } };

  return {
    canvas,
    dispose() {
      alive = false; if (raf) cancelAnimationFrame(raf); raf = 0;
      if (document.fullscreenElement === wrap) { try { document.exitFullscreen(); } catch (e) {} }
      controls && controls.dispose(); cleanups.forEach((f) => f()); cleanups.length = 0;
      disposeScene(); renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss();
      host.innerHTML = '';
      if (window.__sp3d && window.__sp3d.renderer === renderer) delete window.__sp3d;
    },
  };
}
function fmtLen(m) { return m < 1 ? Math.round(m * 100) + ' cm' : (Math.round(m * 100) / 100) + ' m'; }
export function webglAvailable() { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } }
export const _internals = { normProfile, makeBodyFns, makePose, loadEnv }; // for offline checks
