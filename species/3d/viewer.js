// SnakeList "Explore in 3D": a procedural, species-specific snake model in a small habitat scene.
// Loaded on demand by sp.js (species pages) only when the viewer is opened. Everything is built in
// the browser from a per-species profile (species/3d/models.json, made from data/snake-models.json):
// spine and pose, a swept body with a real taper and a species head, eyes, a scale normal map and a
// pattern texture generated from the profile's parameters. Units are metres.
// three.js (species/3d/three.module.min.js, vendored) is loaded by the page next to this module and
// handed in with useThree(), so a failed download can be retried under a fresh URL
let THREE = null;
export function useThree(t) { THREE = t; }

const TAU = Math.PI * 2;
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
  return q;
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
function buildBody(P, F, pose, quality) {
  const L = F.L, M = quality === 'low' ? 48 : 64;
  // girth units: distance along the body measured in circumferences, so scales and markings keep
  // a natural size as the body narrows (scale rows around the body are constant in real snakes)
  const NX = 6000, xs = new Float64Array(NX), gs = new Float64Array(NX);
  let Cmax = 0; const circ = (x) => { const a = F.W(x), b = F.Hh(x); return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))); };
  for (let i = 0; i < 40; i++) Cmax = Math.max(Cmax, circ((i / 39) * F.Hl));
  let g = 0;
  for (let i = 0; i < NX; i++) { const x = (i / (NX - 1)) * L; xs[i] = x; if (i) g += (L / (NX - 1)) / Math.max(circ(x - L / (NX - 1) / 2), Cmax * 0.32); gs[i] = g; }
  const gTotal = g;
  const gOf = (x) => { const f = clamp(x / L, 0, 1) * (NX - 1), i = Math.min(NX - 2, Math.floor(f)); return lerp(gs[i], gs[i + 1], f - i); };
  const xOf = (gv) => { let lo = 0, hi = NX - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (gs[m] < gv) lo = m; else hi = m; } const t = (gv - gs[lo]) / Math.max(1e-12, gs[hi] - gs[lo]); return lerp(xs[lo], xs[hi], clamp(t, 0, 1)); };
  // rings: equal steps in girth units, so quads keep their shape everywhere
  const nR = clamp(Math.round(gTotal * M / 2.2), 220, quality === 'low' ? 900 : 1500);
  const ringX = []; for (let i = 0; i < nR; i++) ringX.push(xOf((i / (nR - 1)) * gTotal));
  ringX[0] = 0; ringX[nR - 1] = L;

  const Hd = P.head, eyeA = (Hd.eyeA * Math.PI) / 180, mouthA = Math.PI * 0.56;
  const bumps = [];
  if (Hd.brow) bumps.push({ x: Hd.eyeX * F.Hl, xs: F.Hl * 0.16, th: eyeA - 0.42, ts: 0.32, amp: Hd.brow, mirror: true });
  if (Hd.pits === 'loreal') bumps.push({ x: F.Hl * 0.15, xs: F.Hl * 0.035, th: Math.PI * 0.5, ts: 0.09, amp: -0.07, mirror: true });
  bumps.push({ x: F.Hl * 0.05, xs: F.Hl * 0.022, th: Hd.nostrilA != null ? (Hd.nostrilA * Math.PI) / 180 : eyeA * 0.62, ts: 0.1, amp: -0.06, mirror: true }); // nostril (upward-facing in water snakes)
  if (Hd.snoutUp) bumps.push({ x: F.Hl * 0.03, xs: F.Hl * 0.05, th: 0, ts: 0.7, amp: Hd.snoutUp });
  const nTop = (x) => lerp(Hd.canthus, 2.15, sstep(F.Hl * 0.8, F.Hl * 1.6, x));

  // spine point & frame at x
  const spine = (x) => { const p = pose.at(x); return new THREE.Vector3(p[0], F.Hh(x) * F.bf + pose.Ly(x), p[1]); };
  const frameAt = (x) => {
    const e = Math.max(L * 0.0015, 1e-5), a = spine(Math.max(0, x - e)), b = spine(Math.min(L, x + e));
    const T = b.sub(a).normalize(); const U = new THREE.Vector3(0, 1, 0).addScaledVector(T, -T.y).normalize();
    const S = new THREE.Vector3().crossVectors(T, U).normalize(); return { T, U, S };
  };
  // the cross-section point at x and angle th (0 = top of the back, +/-pi = belly midline)
  const section = (x, th) => {
    const W = F.W(x), H = F.Hh(x), st = Math.sin(th), ct = Math.cos(th), head = x < F.Hl * 1.05;
    const n = ct >= 0 ? nTop(x) : 3.0;
    let sx = Math.sign(st) * Math.abs(st) ** (2 / n), sy = Math.sign(ct) * Math.abs(ct) ** (2 / n);
    if (ct < 0) { sy *= F.bf; if (head) sx *= lerp(0.86, 1, sstep(F.Hl * 0.6, F.Hl * 1.1, x)); }
    if (head && ct > 0) sx *= 1 - (Hd.taper || 0.2) * sy * (1 - sstep(F.Hl * 0.85, F.Hl * 1.25, x));
    let k = 1;
    for (const b of bumps) {
      const dx = (x - b.x) / b.xs; if (Math.abs(dx) > 3) continue;
      const dth1 = Math.atan2(Math.sin(th - b.th), Math.cos(th - b.th)), dth2 = Math.atan2(Math.sin(th + b.th), Math.cos(th + b.th));
      k += b.amp * Math.exp(-dx * dx) * (Math.exp(-((dth1 / b.ts) ** 2)) + (b.mirror ? Math.exp(-((dth2 / b.ts) ** 2)) : 0));
    }
    if (x < F.Hl * Hd.jaw * 1.1 && x > F.Hl * 0.02) { // the mouth line
      const dm = Math.min(Math.abs(Math.abs(th) - mouthA), 1);
      k -= 0.055 * Math.exp(-((dm / 0.085) ** 2)) * sstep(F.Hl * 0.02, F.Hl * 0.1, x) * (1 - sstep(F.Hl * Hd.jaw * 0.85, F.Hl * Hd.jaw * 1.1, x));
    }
    return [W * sx * k, H * sy * k];
  };

  const nV = nR * (M + 1), pos = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), hd = new Float32Array(nV);
  const plates = P.head.plates ? 1 : 0; // big head shields: the small body-scale relief fades out on the head
  const frames = [];
  for (let i = 0; i < nR; i++) {
    const x = ringX[i], c = spine(x), f = frameAt(x); frames.push({ x, c, f });
    const v = gOf(x) / gTotal;
    for (let j = 0; j <= M; j++) {
      const u = j / M, th = TAU * u - Math.PI, s = section(x, th), k = (i * (M + 1) + j);
      pos[k * 3] = c.x + f.S.x * s[0] + f.U.x * s[1]; pos[k * 3 + 1] = c.y + f.S.y * s[0] + f.U.y * s[1]; pos[k * 3 + 2] = c.z + f.S.z * s[0] + f.U.z * s[1];
      uv[k * 2] = u; uv[k * 2 + 1] = v; hd[k] = plates * (1 - sstep(F.Hl * 0.92, F.Hl * 1.12, x)) * (Math.abs(th) < Math.PI * 0.62 ? 1 : 0.4);
    }
  }
  const idx = [];
  for (let i = 0; i < nR - 1; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('aHead', new THREE.BufferAttribute(hd, 1));
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

  const surf = (x, th) => { const c = spine(x), f = frameAt(x), s = section(x, th); return { p: c.clone().addScaledVector(f.S, s[0]).addScaledVector(f.U, s[1]), f }; };
  const surfNormal = (x, th) => {
    const e = 0.02, a = surf(x, th - e).p, b = surf(x, th + e).p, dx = F.Hl * 0.02, c = surf(Math.max(0, x - dx), th).p, d = surf(x + dx, th).p;
    return new THREE.Vector3().crossVectors(b.sub(a), d.sub(c)).normalize();
  };
  return { geo, gTotal, gOf, xOf, nR, M, spine, frameAt, section, surf, surfNormal, eyeA, mouthA };
}

// ---------- textures generated per species ----------
function scaleLattice(P, gTotal) {
  const S = P.scales, aV = S.aV, R = S.rows, rw = (2 * aV) / R;
  const Wt = R > 40 ? 1024 : 512;
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
  const Wp = quality === 'low' ? 192 : 256;
  const Hp = clamp(Math.round(body.gTotal * Wp * 0.62), 256, quality === 'low' ? 2048 : 4096);
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
    for (let c = 0; c < Wp; c++) {
      const a = ((c + 0.5) / Wp) * 2 - 1, cl = lat.cell(a, g);
      const q = x < Hl * 1.1 ? 0.25 : quant;
      const aq = a + (cl.ac - a) * q, gq = g + (cl.gc - g) * q;
      const nx = Math.cos(Math.PI * aq) * 0.9, ny = Math.sin(Math.PI * aq) * 0.9;
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
      const sv = 1 + vari * (hash1(cl.id, seed + 5) - 0.5) * 2 * (0.35 + 0.65 * cl.w) * (P.head.plates ? sstep(Hl * 0.95, Hl * 1.1, x) : 1);
      col = [col[0] * sv, col[1] * sv, col[2] * sv];
      if (C.scaleEdge && !cl.v) col = mixc(col, hex(C.scaleEdge.color), (C.scaleEdge.k || 0.8) * Math.pow(1 - cl.w, 1.6));
      if (C.speckle && !cl.v && x > Hl) { const hs = hash1(cl.id, seed + 11); if (hs < C.speckle.p) col = mixc(col, hex(C.speckle.color), (C.speckle.k || 0.6) * (0.6 + hs / C.speckle.p * 0.4) * Math.sqrt(cl.w)); }
      const k = (r * Wp + c) * 4; data[k] = col[0]; data[k + 1] = col[1]; data[k + 2] = col[2]; data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, Wp, Hp, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
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

function eyeTexture(P) {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d');
  const H = P.head, iris = H.iris || '#9a8a5a', R = rng(strSeed(iris));
  x.fillStyle = '#0b0a08'; x.fillRect(0, 0, S, S);
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S * 0.47);
  g.addColorStop(0, H.irisInner || iris); g.addColorStop(0.75, iris); g.addColorStop(1, '#14100a');
  x.fillStyle = g; x.beginPath(); x.arc(S / 2, S / 2, S * 0.47, 0, TAU); x.fill();
  for (let i = 0; i < 160; i++) { const a = R() * TAU, r0 = S * (0.12 + R() * 0.2), r1 = r0 + S * (0.05 + R() * 0.12); x.strokeStyle = R() < 0.5 ? 'rgba(0,0,0,.18)' : 'rgba(255,240,200,.12)'; x.lineWidth = 1 + R(); x.beginPath(); x.moveTo(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0); x.lineTo(S / 2 + Math.cos(a) * r1, S / 2 + Math.sin(a) * r1); x.stroke(); }
  if (H.eyeStripe) { x.fillStyle = H.eyeStripe; x.globalAlpha = 0.75; x.fillRect(0, S * 0.36, S, S * 0.28); x.globalAlpha = 1; }
  if (H.eyeRing) { x.strokeStyle = H.eyeRing; x.lineWidth = S * 0.09; x.beginPath(); x.arc(S / 2, S / 2, S * 0.43, 0, TAU); x.stroke(); }
  x.fillStyle = '#050505';
  if (H.pupil === 'slit') { x.beginPath(); x.ellipse(S / 2, S / 2, S * 0.055, S * 0.36, 0, 0, TAU); x.fill(); }
  else if (H.pupil === 'round') { x.beginPath(); x.arc(S / 2, S / 2, S * 0.2, 0, TAU); x.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- ground and props ----------
const SCENES = {
  litter:   { sky: ['#b9c7b0', '#d7ddcc'], fog: '#c3cbb9', sun: 1.6, hemi: 0.75, sunEl: 55, tile: 1.1, ground: 'litter', props: { leaves: 1, twigs: 1, rocks: 0.15, grass: 0.1 } },
  forest:   { sky: ['#a9bca6', '#ccd6c3'], fog: '#b9c6b2', sun: 1.7, hemi: 0.75, sunEl: 52, tile: 1.2, ground: 'litter', props: { leaves: 1, twigs: 1, log: 1, rocks: 0.2, grass: 0.15 } },
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
const ENV_FOR = { riverbank: 'park', forest: 'forest', rainforest: 'forest', litter: 'forest', soil: 'forest', grass: 'sunrise', heath: 'sunrise', arid: 'dawn', sand: 'dawn', sea: 'sky' };
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
  const pr = fetch(new URL('env/' + name + '.hdr', import.meta.url).href).then((r) => { if (!r.ok) throw new Error('env ' + r.status); return r.arrayBuffer(); }).then((b) => prepEnv(parseHDR(b)));
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
function groundTexture(kind, seed) {
  const R = rng(seed);
  return canvasTex(1024, (x, S) => {
    // draw fn at the position and at its wrapped copies, so the texture tiles without seams
    const wrapAt = (cx, cy, r, fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const X = cx + ox, Y = cy + oy; if (X + r < 0 || X - r > S || Y + r < 0 || Y - r > S) continue; x.save(); x.translate(X, Y); fn(); x.restore(); } };
    const base = { litter: '#3b2e22', gravel: '#b7a58c', heath: '#6f5f4a', pebbles: '#6f675a', soil: '#3f3024', dry: '#6f6a44', sand: '#d8c39a' }[kind] || '#777';
    x.fillStyle = base; x.fillRect(0, 0, S, S);
    const tone = (amt, fine) => {
      const img = x.getImageData(0, 0, S, S), d = img.data;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const n = tfbm(i / S * 6, j / S * 6, 6, seed + 1, 5) - 0.5, f = 1 + n * amt, g = 1 + (R() - 0.5) * fine, k = (j * S + i) * 4;
        d[k] *= f * g; d[k + 1] *= f * g; d[k + 2] *= f * g;
      }
      x.putImageData(img, 0, 0);
    };
    tone(kind === 'sand' ? 0.25 : 0.4, kind === 'sand' || kind === 'gravel' ? 0.2 : 0.1);
    const shade = (hexc, k) => { const c = hex(hexc); return 'rgb(' + c.map((v) => Math.round(clamp(v * k, 0, 255))).join(',') + ')'; };
    const leaf = (l, w, col, curl) => {
      // soft shadow, then the blade with a light-to-dark gradient, an edge and veins
      x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(l * 0.04, w * 0.35, l * 0.52, w * 1.05, 0, 0, TAU); x.fill();
      const g = x.createLinearGradient(-l / 2, -w, l / 2, w); g.addColorStop(0, shade(col, 1.12 + curl * 0.1)); g.addColorStop(1, shade(col, 0.78));
      x.fillStyle = g; x.beginPath(); x.moveTo(-l / 2, 0); x.bezierCurveTo(-l * 0.25, -w * 1.3, l * 0.25, -w * 1.1, l / 2, 0); x.bezierCurveTo(l * 0.25, w * 1.1, -l * 0.25, w * 1.3, -l / 2, 0); x.fill();
      x.strokeStyle = 'rgba(20,12,6,.35)'; x.lineWidth = 0.8; x.stroke();
      x.strokeStyle = 'rgba(255,235,200,.18)'; x.beginPath(); x.moveTo(-l / 2, 0); x.lineTo(l / 2, 0); for (let v = -0.3; v < 0.4; v += 0.14) { x.moveTo(l * v, 0); x.lineTo(l * (v + 0.1), -w * 0.7); x.moveTo(l * v, 0); x.lineTo(l * (v + 0.1), w * 0.7); } x.stroke();
    };
    const stone = (r, ry, c0, c1, wet) => {
      x.fillStyle = 'rgba(0,0,0,.2)'; x.beginPath(); x.ellipse(r * 0.12, r * 0.15, r * 1.04, ry * 1.04, 0, 0, TAU); x.fill();
      const g = x.createRadialGradient(-r * 0.35, -ry * 0.4, r * 0.05, 0, 0, r * 1.05); g.addColorStop(0, c0); g.addColorStop(0.7, c1); g.addColorStop(1, shade(c1, 0.7));
      x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, r, ry, 0, 0, TAU); x.fill();
      if (wet) { x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.ellipse(-r * 0.35, -ry * 0.45, r * 0.25, ry * 0.12, -0.4, 0, TAU); x.fill(); }
      for (let i = 0; i < 4; i++) { x.fillStyle = R() < 0.5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'; x.beginPath(); x.arc((R() - 0.5) * r, (R() - 0.5) * ry, r * 0.12, 0, TAU); x.fill(); }
    };
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
      if (kind === 'soil') for (let i = 0; i < 3500; i++) { const cx = R() * S, cy = R() * S, r = 0.8 + R() ** 2 * 5; wrapAt(cx, cy, r * 2, () => stone(r, r * (0.6 + R() * 0.4), '#6e5845', '#3a2b20', true)); }
      tone(0.25, 0);
    } else if (kind === 'gravel' || kind === 'sand') {
      const cols = [['#d8cab4', '#9c8b76'], ['#c4b29a', '#7d6d5a'], ['#e0d6c8', '#a39a8b'], ['#b29c85', '#6c5a48'], ['#cdb593', '#8a7254'], ['#a8a39a', '#6a665e']];
      const n = kind === 'gravel' ? 7000 : 600;
      for (let i = 0; i < n; i++) { const cx = R() * S, cy = R() * S, r = 1 + R() ** 3 * (kind === 'gravel' ? 6 : 3), c = cols[(R() * cols.length) | 0]; wrapAt(cx, cy, r * 2, () => { x.rotate(R() * 3); stone(r, r * (0.55 + R() * 0.4), c[0], c[1]); }); }
      for (let i = 0; i < 30; i++) { const cx = R() * S, cy = R() * S, l = 20 + R() * 60, a = R() * TAU; wrapAt(cx, cy, l, () => { x.rotate(a); x.strokeStyle = 'rgba(70,55,35,.7)'; x.lineWidth = 1 + R(); x.beginPath(); x.moveTo(0, 0); x.lineTo(l, (R() - 0.5) * 8); x.stroke(); }); }
    } else if (kind === 'pebbles') {
      const cols = [['#8f877a', '#6a6357'], ['#857b6b', '#5f564a'], ['#959087', '#716c63'], ['#7f7262', '#5a4d3f'], ['#7d807a', '#5b5e58'], ['#8e7c66', '#665441']];
      for (let i = 0; i < 2600; i++) { const cx = R() * S, cy = R() * S, r = 3 + R() ** 2.5 * 16, c = cols[(R() * cols.length) | 0]; wrapAt(cx, cy, r * 2, () => { x.rotate(R() * 3); stone(r, r * (0.6 + R() * 0.35), c[0], c[1], R() < 0.12); }); }
      tone(0.15, 0);
    } else if (kind === 'heath' || kind === 'dry') {
      const strokes = kind === 'heath' ? ['#3a2f25', '#5a4a38', '#8a7a5c', '#b4a27c', '#4a3f30', '#6b4f5a'] : ['#a89a66', '#7d7a46', '#b8aa78', '#5d6634', '#8c8a52', '#4f5a2c'];
      for (let i = 0; i < 5200; i++) { const cx = R() * S, cy = R() * S, l = 6 + R() * 30, a = R() * TAU, col = strokes[(R() * strokes.length) | 0], w = 0.6 + R() * 1.4; wrapAt(cx, cy, l, () => { x.rotate(a); x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(l * 0.5, (R() - 0.5) * 6, l, (R() - 0.5) * 4); x.stroke(); }); }
      if (kind === 'heath') for (let i = 0; i < 40; i++) { const cx = R() * S, cy = R() * S, r = 14 + R() * 34; wrapAt(cx, cy, r * 1.3, () => { for (let k = 0; k < 160; k++) { const a = R() * TAU, rr = r * Math.sqrt(R()); x.fillStyle = ['rgba(62,78,36,.55)', 'rgba(84,98,46,.5)', 'rgba(48,60,30,.5)'][k % 3]; x.beginPath(); x.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.75, 1 + R() * 2.2, 0, TAU); x.fill(); } }); }
      tone(0.2, 0);
    }
  }, 1);
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
  const skyGeo = new THREE.SphereGeometry(groundR * 1.6, 32, 16), cols = [], p = skyGeo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / (groundR * 1.6), c = hor.clone().lerp(sky, sstep(0.0, 0.55, y)); if (y < 0) c.copy(hor); cols.push(c.r, c.g, c.b); }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const skyMesh = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  skyMesh.renderOrder = -1; scene.add(skyMesh); ctx.skyMesh = skyMesh; ctx.groundR = groundR; ctx.fadeMats = [];
  scene.fog = new THREE.Fog(hor, Math.max(Rb * 5.5, envR * 3.2), groundR * 0.72);
  scene.background = hor;

  // environment light from a simple sky/ground gradient (soft reflections; no image is fetched)
  const envScene = new THREE.Scene();
  const eg = new THREE.SphereGeometry(10, 32, 16), ec = [], ep = eg.attributes.position, gcol = new THREE.Color(S.ground ? ({ litter: '#4a3a29', gravel: '#b49f86', heath: '#7d6b52', pebbles: '#8f8677', soil: '#4a3828', dry: '#9b8a62', sand: '#d8c39a' }[S.ground]) : '#2c5d7a');
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
  const sm = quality === 'low' ? 1024 : 2048; sun.shadow.mapSize.set(sm, sm);
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
    const tex = groundTexture(S.ground, seed + 5); tex.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy(); const rep = (groundR * 2) / clamp(Math.min(S.tile, L * 1.1), S.tile * 0.5, S.tile); tex.repeat.set(rep, rep);
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
        const along = -x * dir.y + z * dir.x, s = x * dir.x + z * dir.y + (fbm(along / Rb * 1.3, 3.1, 0.7, seed + 19, 3) - 0.5) * Rb * 0.7;
        pp.setY(i, -depth * sstep(edge - Rb * 0.25, edge + Rb * 0.7, s) + (fbm(x / Rb * 2, z / Rb * 2, 1, seed, 2) - 0.5) * Rb * 0.02 * sstep(Rb * 0.3, Rb * 0.9, Math.abs(s - edge)));
      }
      geo.computeVertexNormals();
      const g2 = new THREE.Mesh(geo, gm); g2.receiveShadow = true; scene.add(g2); ctx.fadeMats.push(gm);
      const wm = new THREE.MeshPhysicalMaterial({ color: '#4d6d6a', roughness: 0.06, metalness: 0, transparent: true, opacity: 0.55, normalMap: waterNormal(seed), normalScale: new THREE.Vector2(0.25, 0.25) });
      wm.normalMap.repeat.set(groundR / Math.max(0.6, Rb), groundR / Math.max(0.6, Rb));
      const wg = new THREE.PlaneGeometry(groundR * 2, groundR * 2); wg.rotateX(-Math.PI / 2);
      const water = new THREE.Mesh(wg, wm); water.position.y = -depth * 0.35; water.renderOrder = 2; scene.add(water); ctx.fadeMats.push(wm);
      ctx.waterInfo = { dir, edge };
    } else {
      const g2 = new THREE.Mesh(gg, gm); g2.receiveShadow = true; scene.add(g2); ctx.fadeMats.push(gm);
    }
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
  const place = (n, rMin, rMax, clear, tries = 40) => {
    const out = [];
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
    for (let i = 0; i < 26; i++) { const s = (R() - 0.5) * Rb * 7, off = wi.edge + Rb * (0.15 + R() * 0.9); const x = wi.dir.x * off + tng.x * s, z = wi.dir.y * off + tng.y * s; if (dist2snake(x, z) > Math.max(Rb * 0.5, clamp(L * 0.9, 0.4, 1.2) * 0.5)) spots.push([x, z]); }
    const g = bladeTuft(seed + 3, 40, clamp(L * 0.9, 0.4, 1.2), '#55693a', '#a6a46a', 0.06, { w: 0.01, lean: 0.25 }), im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 }), spots.length);
    im.castShadow = true;
    spots.forEach(([x, z], i) => { const s = 0.7 + R() * 0.6; e.set(0, R() * TAU, 0); q.setFromEuler(e); sv.set(s, s, s); pv.set(x, -0.02, z); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); addOcc(im, i, m4, clamp(L * 0.9, 0.4, 1.2) * s * 0.7); });
    scene.add(im);
  }
  if (PR.heather) {
    const spots = place(Math.round(26 * PR.heather), Rb * 0.9, Rb * 4.2, F.w0 * 4 + clamp(L * 0.3, 0.12, 0.35) * 0.4);
    const hh = clamp(L * 0.22, 0.08, 0.25), g = bladeTuft(seed + 31, 160, hh, '#2f2a1e', '#4a3d34', hh * 0.55, { lean: 0.8, w: 0.008, tip: '#5e4a56', green: '#3b4524' });
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
  if (ctx.skyMesh) { scene.remove(ctx.skyMesh); ctx.skyMesh.geometry.dispose(); ctx.skyMesh.material.dispose(); ctx.skyMesh = null; }
  // the photo world is at real size: shot from about 1.7 m up, floor out to 120 m
  const camH = 1.7, skyR = 120, sky = new THREE.Mesh(sea ? new THREE.SphereGeometry(skyR, 64, 32).scale(1, 1, -1) : groundedSkyGeometry(camH, skyR), new THREE.MeshBasicMaterial({ map: tex, depthWrite: false, fog: false }));
  sky.position.y = sea ? 0 : camH - 0.002; sky.renderOrder = -2; scene.add(sky); ctx.track(sky.geometry); ctx.track(sky.material);
  scene.background = env.horizon.clone();
  // fade the near ground (and water) into the projected photo ground
  const gR = ctx.groundR, fade = canvasTex(256, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.36); g.addColorStop(0, '#fff'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, s, s); }, 1, false);
  fade.wrapS = fade.wrapT = THREE.ClampToEdgeWrapping; fade.repeat.set(1, 1); ctx.track(fade);
  if (!sea) for (const m of ctx.fadeMats) { m.alphaMap = fade; if (m.transparent) { m.opacity *= 1; } else m.alphaHash = true; m.needsUpdate = true; }
  scene.fog = sea ? new THREE.Fog(env.horizon, gR * 0.4, gR * 0.98) : null;
  // light: the sun from the photo, sky light from the panorama; the gradient hemisphere light stays only as a faint fill
  const sun = ctx.sun, el = Math.max(Math.asin(env.sunDir.y), (22 * Math.PI) / 180), az = Math.atan2(env.sunDir.z, env.sunDir.x), r = sun.position.length();
  sun.position.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(r);
  sun.color.copy(env.sunCol).lerp(new THREE.Color('#ffffff'), 0.35); sun.intensity = 6.5 * env.sunny; // about three times the sky's light on a sunlit face, as outdoors
  sun.shadow.radius = lerp(8, 3, env.sunny); sun.shadow.blurSamples = 16;
  if (ctx.hemi) ctx.hemi.intensity *= 0.25;
  ctx.envName = env.name;
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
  const st = { az: 0, el: 0.5, d: 1, vaz: 0, vel: 0, goal: null, dragging: false };
  const ptrs = new Map(); let pinch0 = 0, d0 = 0, last = null;
  const reduce = opt.reduce;
  const limitEl = (el, d) => clamp(el, opt.minEl(d), opt.maxEl);
  function setGoal(g, instant) { if (g.az != null) g = Object.assign({}, g, { az: st.az + Math.atan2(Math.sin(g.az - st.az), Math.cos(g.az - st.az)) }); // always the short way round
    st.goal = { az: g.az != null ? g.az : st.az, el: g.el != null ? g.el : st.el, d: g.d != null ? clamp(g.d, opt.dMin(), opt.dMax()) : st.d }; if (instant || reduce()) { st.az = st.goal.az; st.d = st.goal.d; st.el = limitEl(st.goal.el, st.d); st.goal = null; } opt.kick(); }
  function rot(dx, dy) { st.az -= dx; st.el = limitEl(st.el + dy, st.d); st.goal = null; }
  function zoom(f) { const d = clamp((st.goal ? st.goal.d : st.d) * f, opt.dMin(), opt.dMax()); setGoal({ d, az: st.goal ? st.goal.az : st.az, el: st.goal ? st.goal.el : st.el }); }
  const onDown = (e) => { if (e.button > 0) return; try { dom.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already released pointer */ } ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); d0 = st.d; } st.dragging = true; st.vaz = st.vel = 0; last = performance.now(); st.goal = null; };
  const onMove = (e) => {
    if (!ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 1) { const k = (2.6 * Math.PI) / Math.max(400, dom.clientWidth * 1.6); rot(dx * k, dy * k); const now = performance.now(), dt = Math.max(8, now - last); last = now; st.vaz = (-dx * k) / dt * 16; st.vel = (dy * k) / dt * 16; opt.kick(); }
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], pd = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0 > 0) { st.d = clamp(d0 * (pinch0 / pd), opt.dMin(), opt.dMax()); st.el = limitEl(st.el, st.d); opt.kick(); } }
  };
  const onUp = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; if (!ptrs.size) { st.dragging = false; if (reduce() || performance.now() - last > 80) { st.vaz = st.vel = 0; } opt.kick(); } };
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
    else return;
    e.preventDefault();
  };
  dom.addEventListener('pointerdown', onDown); dom.addEventListener('pointermove', onMove); dom.addEventListener('pointerup', onUp); dom.addEventListener('pointercancel', onUp);
  dom.addEventListener('wheel', onWheel, { passive: false }); dom.addEventListener('keydown', onKey);
  // returns true while still moving
  function update() {
    let moving = false;
    if (!st.dragging && (st.vaz || st.vel)) { st.az += st.vaz; st.el = limitEl(st.el + st.vel, st.d); st.vaz *= 0.86; st.vel *= 0.86; if (Math.abs(st.vaz) < 1e-4 && Math.abs(st.vel) < 1e-4) st.vaz = st.vel = 0; else moving = true; }
    if (st.goal) {
      const k = 0.2; st.az += (st.goal.az - st.az) * k; st.d += (st.goal.d - st.d) * k; st.el = limitEl(st.el + (st.goal.el - st.el) * k, st.d);
      if (Math.abs(st.goal.az - st.az) < 1e-4 && Math.abs(st.goal.d - st.d) / st.d < 1e-4 && Math.abs(st.goal.el - st.el) < 1e-4) { st.az = st.goal.az; st.d = st.goal.d; st.goal = null; } else moving = true;
    }
    st.el = limitEl(st.el, st.d);
    return moving;
  }
  function dispose() { dom.removeEventListener('pointerdown', onDown); dom.removeEventListener('pointermove', onMove); dom.removeEventListener('pointerup', onUp); dom.removeEventListener('pointercancel', onUp); dom.removeEventListener('wheel', onWheel); dom.removeEventListener('keydown', onKey); }
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
  const P = normProfile(opts.profile), seed = strSeed(opts.id || P.name || 'snake');
  const reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduce = () => reduceMQ.matches;
  const lowDevice = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || Math.min(screen.width, screen.height) < 500;
  let quality = opts.quality || (lowDevice ? 'low' : 'high');
  const disposables = new Set(), cleanups = [];
  const track = (o) => { disposables.add(o); return o; };
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); cleanups.push(() => t.removeEventListener(ev, fn, o)); };

  // DOM
  host.innerHTML = '';
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const wrap = el('div', 'sp3d-wrap'), stage = el('div', 'sp3d-stage'), labels = el('div', 'sp3d-labels'), status = el('div', 'sp3d-status');
  const hint = el('p', 'sp3d-hint', (window.innerWidth < 520 ? 'Drag to rotate around it · pinch to zoom' : 'Drag to rotate around the snake · pinch or scroll to zoom · arrow keys work too'));
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
  const panel = el('div', 'sp3d-panel'); panel.hidden = true; panel.id = 'sp3d-panel-' + seed; bSet.setAttribute('aria-controls', panel.id);
  const mkCheck = (label, checked) => { const l = el('label', 'sp3d-opt'), c = document.createElement('input'); c.type = 'checkbox'; c.checked = checked; l.append(c, document.createTextNode(' ' + label)); panel.appendChild(l); return c; };
  const cScene = mkCheck('Show surroundings', true);
  const ql = el('label', 'sp3d-opt'), qs = document.createElement('select');
  [['high', 'High detail'], ['low', 'Light (faster)']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === quality) o.selected = true; qs.appendChild(o); });
  ql.append(document.createTextNode('Quality '), qs); panel.appendChild(ql);
  const cap = el('div', 'sp3d-cap');
  const recon = el('p', 'sp3d-recon', 'Representative reconstruction - not a photograph of a real encounter.');
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
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const ctx = { renderer, scene: null, track };
  let snakeGroup, cam, controls, info, extras, raf = 0, dirty = true, lost = false, alive = true, scaleObj = null, markers = [];

  function build() {
    const scene = new THREE.Scene(); ctx.scene = scene;
    const F = makeBodyFns(P, quality), pose = makePose(P, F, seed), body = buildBody(P, F, pose, quality);
    const lat = scaleLattice(P, body.gTotal), tiles = scaleTextures(P, lat), pat = patternTexture(P, F, body, lat, quality, seed);
    const rep = body.gTotal / lat.Pt;
    for (const t of [tiles.normal, tiles.cavity]) { t.repeat.set(1, rep); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); }
    pat.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const S = P.scales, gl = S.gloss;
    const mat = new THREE.MeshPhysicalMaterial({
      map: pat, normalMap: tiles.normal, normalScale: new THREE.Vector2(1.25, 1.25), aoMap: tiles.cavity, aoMapIntensity: 0.9, roughnessMap: tiles.cavity,
      roughness: lerp(0.82, 0.58, gl), metalness: 0, clearcoat: gl * 0.35, clearcoatRoughness: lerp(0.55, 0.3, gl), sheen: 0.12, sheenRoughness: 0.7, sheenColor: new THREE.Color('#ffffff').multiplyScalar(0.12),
      iridescence: S.iridescence || 0, iridescenceIOR: 1.6, envMapIntensity: 0.65,
    });
    // the cavity map also darkens the skin between scales in direct light (as in real snakes)
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aHead;\nvarying float vHead;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvHead = aHead;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vHead;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_AOMAP\n diffuseColor.rgb *= mix(1.0, texture2D(aoMap, vAoMapUv).r, ' + (S.cavity != null ? S.cavity : 0.45).toFixed(2) + ' * (1.0 - vHead * 0.9));\n#endif')
        .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * (1.0 - vHead * 0.88);');
    };
    const mesh = new THREE.Mesh(body.geo, mat); mesh.castShadow = mesh.receiveShadow = true;
    snakeGroup = new THREE.Group(); snakeGroup.add(mesh);

    // eyes
    const H = P.head, eyeX = H.eyeX * F.Hl, eyeR = H.eye * F.W(eyeX) * 2 * 0.5;
    const eyePos = [];
    if (H.pupil !== 'none') {
      const et = eyeTexture(P), em = new THREE.MeshPhysicalMaterial({ map: et, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2 });
      const eg = new THREE.SphereGeometry(eyeR, 32, 24), ep = eg.attributes.position, euv = eg.attributes.uv;
      for (let i = 0; i < ep.count; i++) { const x = ep.getX(i) / eyeR, y = ep.getY(i) / eyeR; euv.setXY(i, 0.5 + x * 0.5, 0.5 + y * 0.5); }
      for (const sg of [1, -1]) {
        const th = sg * body.eyeA, s = body.surf(eyeX, th), n = body.surfNormal(eyeX, th);
        if (sg < 0) n.negate();
        const out = n.clone().addScaledVector(s.f.T, -0.22).normalize();
        const up = s.f.U.clone().addScaledVector(out, -s.f.U.dot(out)).normalize(), xa = new THREE.Vector3().crossVectors(up, out);
        const m = new THREE.Mesh(eg, em); m.position.copy(s.p).addScaledVector(n, -eyeR * (H.embed || 0.62));
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa, up, out)); m.castShadow = false; m.receiveShadow = true;
        snakeGroup.add(m); eyePos.push(m.position.clone());
      }
    }
    // horns, rattle
    const keratin = new THREE.MeshStandardMaterial({ color: P.tail.rattleColor || '#b8a589', roughness: 0.55 });
    if (H.horns === 'nasal') {
      for (const sg of [1, -1]) { const x = F.Hl * 0.06, th = sg * 0.32, s = body.surf(x, th), hh = F.W(x) * 0.55; const g = new THREE.ConeGeometry(hh * 0.28, hh, 10); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: P.head.hornColor || P.colors.dorsal, roughness: 0.8 })); m.position.copy(s.p).addScaledVector(s.f.U, hh * 0.3); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), s.f.U.clone().addScaledVector(s.f.T, -0.5).normalize()); m.castShadow = true; snakeGroup.add(m); }
    }
    if (H.horns === 'supraocular') {
      for (const sg of [1, -1]) { const x = H.eyeX * F.Hl, th = sg * (body.eyeA - 0.55), s = body.surf(x, th), hh = F.W(x) * 0.42; const g = new THREE.ConeGeometry(hh * 0.3, hh, 10); g.translate(0, hh / 2, 0); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: P.head.hornColor || P.colors.dorsal, roughness: 0.8 })); m.position.copy(s.p).addScaledVector(s.f.U, -hh * 0.1); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), s.f.U.clone().addScaledVector(s.f.S, sg * 0.45).addScaledVector(s.f.T, 0.25).normalize()); m.castShadow = true; snakeGroup.add(m); }
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
    buildScene(ctx, P, F, body, poseInfo, seed, quality);
    if (!cScene.checked) setSceneVisible(false);
    // the photographic surroundings arrive a moment later (cached after the first time)
    const envName = P.scene.env || ENV_FOR[P.scene.kind], myScene = scene;
    ctx.envReady = envName && !opts.noEnv ? loadEnv(envName).then((env) => {
      if (!alive || ctx.scene !== myScene) return false;
      env.name = envName; applyEnv(ctx, P, F, poseInfo, env); if (!cScene.checked) setSceneVisible(false); dirty = true; kick(); return true;
    }).catch(() => false) : Promise.resolve(false);

    const headPos = body.surf(F.Hl * 0.45, 0).p;
    const headDir = body.frameAt(F.Hl * 0.5).T.clone().negate(); // pointing out of the snout
    // main body axis (for the side view): principal direction of the footprint
    let sxx = 0, szz = 0, sxz = 0; for (const p of pose.pts) { sxx += p[0] * p[0]; szz += p[1] * p[1]; sxz += p[0] * p[1]; }
    const axisAng = 0.5 * Math.atan2(2 * sxz, sxx - szz);
    info = { F, body, center: new THREE.Vector3(center.x, Math.min(center.y, hMax * 0.5), center.z), Rb, hMax, headPos, headDir, axisAng, eyePos, size };
    info.collide = []; for (let i = 0, n = 240; i <= n; i++) { const x = (i / n) * F.L; info.collide.push({ p: body.spine(x), r: Math.max(F.W(x), F.Hh(x)) * 1.05 }); }
    extras = { mat };
    // camera
    cam = new THREE.PerspectiveCamera(38, 1, Rb * 0.001, Rb * 40);
    if (!controls) {
      controls = Controls(canvas, cam, {
        reduce, maxEl: (80 * Math.PI) / 180,
        minEl: (d) => Math.max((8 * Math.PI) / 180, Math.asin(clamp((info.hMax * 1.3 - targetFor(d).y) / d, 0, 0.95))),
        dMin: () => info.dMin, dMax: () => info.dMax * (scaleObj && scaleObj.visible ? info.scaleK : 1), kick: () => kick(), reset: () => resetView(),
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
    if (scaleObj && scaleObj.visible && info.F.L >= 0.4) t.y += 0.55 * sstep(info.dFit, info.dFit * 1.6, d); // keep the 1.5 m figure in view
    return t;
  }
  function viewAz(kind) {
    const hd = info.headDir; const a = Math.atan2(hd.x, hd.z);
    if (kind === 'front') return a; if (kind === 'side') return -info.axisAng + Math.PI / 2; return a + 0.9;
  }
  function resetView(instant) { controls.setGoal({ az: viewAz('default'), el: ((info.portrait ? 40 : 30) * Math.PI) / 180, d: info.dFit }, instant); }
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
  }
  function resize() {
    const w = stage.clientWidth || 300, h = stage.clientHeight || 200;
    renderer.setSize(w, h, false); if (cam) { cam.aspect = w / h; cam.updateProjectionMatrix(); fitLimits(); controls && (controls.st.d = clamp(controls.st.d, info.dMin, controls.st.goal ? 1e9 : info.dMax * (scaleObj && scaleObj.visible ? info.scaleK : 1))); }
    kick();
  }
  function frame() {
    raf = 0; if (!alive || lost || !cam) return;
    if (document.hidden || !host.isConnected || host.offsetParent === null && !document.fullscreenElement) { dirty = true; return; } // paused while hidden
    const moving = controls.update();
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
  on(bReset, 'click', () => resetView()); on(bFull, 'click', toggleFull); on(bScale, 'click', () => toggleScale()); on(bDet, 'click', toggleDetails);
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
  if (opts.testing) window.__sp3d = { THREE, renderer, bodyClearance: () => bodyClearance(cam.position), get envReady() { return ctx.envReady; }, extras: () => extras, setScene: (v) => { cScene.checked = v; setSceneVisible(v); }, get scene() { return ctx.scene; }, get cam() { return cam; }, controls, info: () => info, setView, resetView, toggleScale, toggleDetails, frame: () => { controls.update(); placeCamera(); updateOccluders(); renderer.render(ctx.scene, cam); updateMarkers(); } };

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
