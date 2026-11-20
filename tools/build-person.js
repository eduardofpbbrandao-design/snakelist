// Builds species/3d/person.bin: the 1.70 m person of the 3D viewer's "Size vs person" (SnakeList's own model, made here
// from scratch - no outside assets). The body is "sculpted" as a signed distance field: anatomical masses (skull, jaw,
// cheekbones, nose, lips, eyelids, ears, neck muscles, ribcage, deltoids, biceps, forearms, a palm and jointed fingers,
// thighs, calves) blended with smooth unions, and the clothes as offset shells of it (a T-shirt with a crew neck, short
// sleeves and drape folds, jeans with creases bunching at the ankle, trainers with soles) plus short hair with combed
// grooves and eyebrows. Each part is meshed with surface nets in a narrow band at millimetre resolution, its vertices
// pulled onto the surface, simplified (meshoptimizer), and stored with SDF normals and baked ambient occlusion.
//
// Run (dev only): npm i meshoptimizer@0.22.0 (anywhere on NODE_PATH), then  node tools/build-person.js
// Output: species/3d/person.bin (format: see writeBin below; read by species/3d/extras.js loadPerson()).
'use strict';
const fs = require('fs'), path = require('path');
const { MeshoptSimplifier } = require('meshoptimizer');

// ---------------------------------------------------------------- tiny vector + SDF kit
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function smin(a, b, k) { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function smax(a, b, k) { return -smin(-a, -b, k); }
const V = (x, y, z) => [x, y, z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const nrm = (a) => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
// round cone between a and b (radii r1, r2) - Inigo Quilez
function RC(a, b, r1, r2) {
  const ba = sub(b, a), l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const lo = [Math.min(a[0] - r1, b[0] - r2), Math.min(a[1] - r1, b[1] - r2), Math.min(a[2] - r1, b[2] - r2)], hi = [Math.max(a[0] + r1, b[0] + r2), Math.max(a[1] + r1, b[1] + r2), Math.max(a[2] + r1, b[2] + r2)];
  const f = (x, y, z) => {
    const px = x - a[0], py = y - a[1], pz = z - a[2], yy = px * ba[0] + py * ba[1] + pz * ba[2], zz = yy - l2;
    const qx = px * l2 - ba[0] * yy, qy = py * l2 - ba[1] * yy, qz = pz * l2 - ba[2] * yy, x2 = qx * qx + qy * qy + qz * qz, y2 = yy * yy * l2, z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
  };
  f.lo = lo; f.hi = hi; return f;
}
// ellipsoid (centre c, radii r), optionally in a rotated frame (ax: three unit axes for the radii)
function EL(c, r, ax) {
  const f = (x, y, z) => {
    let px = x - c[0], py = y - c[1], pz = z - c[2];
    if (ax) { const u = px * ax[0][0] + py * ax[0][1] + pz * ax[0][2], v = px * ax[1][0] + py * ax[1][1] + pz * ax[1][2], w = px * ax[2][0] + py * ax[2][1] + pz * ax[2][2]; px = u; py = v; pz = w; }
    const a = px / r[0], b = py / r[1], d = pz / r[2], k0 = Math.sqrt(a * a + b * b + d * d), a1 = a / r[0], b1 = b / r[1], d1 = d / r[2], k1 = Math.sqrt(a1 * a1 + b1 * b1 + d1 * d1);
    return k1 < 1e-12 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
  };
  const m = Math.max(r[0], r[1], r[2]); f.lo = [c[0] - m, c[1] - m, c[2] - m]; f.hi = [c[0] + m, c[1] + m, c[2] + m]; return f;
}
const SPH = (c, r) => { const f = (x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r; f.lo = [c[0] - r, c[1] - r, c[2] - r]; f.hi = [c[0] + r, c[1] + r, c[2] + r]; return f; };
// a frame from a main axis (y of the shape) and a hint for its z
function frame(yAxis, zHint) { const yv = nrm(yAxis), zv = nrm(sub(zHint, mul(yv, dot(zHint, yv)))), xv = cross(yv, zv); return [xv, yv, zv]; }
// smooth union of a list, skipping members whose box is further than the best distance (+k) - exact enough near the surface
function U(list, k) {
  const f = (x, y, z) => {
    let d = 1e9;
    for (const g of list) {
      if (g.lo) { const bx = Math.max(g.lo[0] - x, 0, x - g.hi[0]), by = Math.max(g.lo[1] - y, 0, y - g.hi[1]), bz = Math.max(g.lo[2] - z, 0, z - g.hi[2]); if (Math.sqrt(bx * bx + by * by + bz * bz) > d + k) continue; }
      d = smin(d, g(x, y, z), k);
    }
    return d;
  };
  f.lo = [0, 1, 2].map((i) => Math.min(...list.map((g) => (g.lo ? g.lo[i] : -1e9))) - k); f.hi = [0, 1, 2].map((i) => Math.max(...list.map((g) => (g.hi ? g.hi[i] : 1e9))) + k);
  return f;
}
// mirror: a shape built for the +x side, used on both sides
const MIR = (g) => { const f = (x, y, z) => g(Math.abs(x), y, z); f.lo = [-g.hi[0], g.lo[1], g.lo[2]]; f.hi = [g.hi[0], g.hi[1], g.hi[2]]; return f; };
// value noise
function hash(i, j, k) { let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function noise(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const n = (a, b, c) => hash(i + a, j + b, k + c);
  return mix(mix(mix(n(0, 0, 0), n(1, 0, 0), u), mix(n(0, 1, 0), n(1, 1, 0), u), v), mix(mix(n(0, 0, 1), n(1, 0, 1), u), mix(n(0, 1, 1), n(1, 1, 1), u), v), w) * 2 - 1;
}
const fbm = (x, y, z) => noise(x, y, z) * 0.6 + noise(x * 2.03 + 7, y * 2.03 + 3, z * 2.03 + 1) * 0.3 + noise(x * 4.1 + 2, y * 4.1 + 9, z * 4.1 + 5) * 0.1;

// ---------------------------------------------------------------- the body (metres; feet on y = 0, facing +z, x to its left)
const EYE = V(0.0315, 1.586, 0.0705), EYE_R = 0.0121;
// --- head
const cranium = EL(V(0, 1.603, -0.014), V(0.073, 0.086, 0.097));
const headParts = [
  cranium,
  EL(V(0, 1.622, 0.03), V(0.064, 0.05, 0.052)),          // forehead
  EL(V(0, 1.57, 0.03), V(0.057, 0.064, 0.058)),           // face
  MIR(EL(V(0.042, 1.556, 0.05), V(0.024, 0.024, 0.028))), // cheeks
  MIR(EL(V(0.048, 1.574, 0.054), V(0.02, 0.011, 0.02))), // cheekbones
  MIR(RC(V(0.051, 1.53, -0.016), V(0.02, 1.484, 0.056), 0.011, 0.011)), // the jaw line
  EL(V(0, 1.487, 0.068), V(0.02, 0.016, 0.015)),         // chin
  EL(V(0, 1.524, 0.073), V(0.03, 0.027, 0.024)),         // round the mouth
  MIR(EL(V(0.031, 1.6135, 0.08), V(0.026, 0.009, 0.012))), // brow ridge
  RC(V(0, 1.6, 0.088), V(0, 1.557, 0.11), 0.0062, 0.0082), // nose bridge
  EL(V(0, 1.553, 0.1075), V(0.0108, 0.0095, 0.0098)),     // nose tip
  MIR(EL(V(0.0115, 1.548, 0.098), V(0.0072, 0.0068, 0.0082))), // nostril wings
  EL(V(0, 1.5215, 0.0935), V(0.0232, 0.0068, 0.0088)),    // upper lip
  EL(V(0, 1.5103, 0.0905), V(0.02, 0.0078, 0.0094)),      // lower lip
];
const earAx = frame(V(0, 1, 0), V(-0.34, 0, 0.94));
const ear = MIR((() => {
  const shell = EL(V(0.0765, 1.574, -0.012), V(0.0075, 0.031, 0.0195), earAx), bowl = EL(V(0.0815, 1.571, -0.008), V(0.0046, 0.02, 0.012), earAx), lobe = EL(V(0.0772, 1.548, -0.008), V(0.0062, 0.0095, 0.0085));
  const f = (x, y, z) => smax(smin(shell(x, y, z), lobe(x, y, z), 0.004), -bowl(x, y, z), 0.002); f.lo = [0.06, 1.53, -0.04]; f.hi = [0.095, 1.615, 0.015]; return f;
})());
const socket = MIR(EL(V(0.0315, 1.586, 0.087), V(0.0205, 0.0122, 0.0125)));
const lid = MIR((() => { const s = SPH(EYE, EYE_R + 0.0012), op = EL(V(0.0315, 1.5862, 0.083), V(0.0145, 0.0049, 0.0112)); const f = (x, y, z) => smax(s(x, y, z), -op(x, y, z), 0.0012); f.lo = s.lo; f.hi = s.hi; return f; })());
const nostril = MIR(EL(V(0.0068, 1.5425, 0.1045), V(0.0038, 0.0025, 0.0048)));
const mouthLine = EL(V(0, 1.5163, 0.0985), V(0.0238, 0.0011, 0.0085));
const neck = RC(V(0, 1.392, -0.02), V(0, 1.53, -0.028), 0.058, 0.05);
const scm = MIR(RC(V(0.05, 1.52, -0.026), V(0.012, 1.405, 0.04), 0.0075, 0.0065));
function headSD(x, y, z) {
  let d = 1e9;
  for (const g of headParts) d = smin(d, g(x, y, z), 0.011);
  d = smin(d, ear(x, y, z), 0.006);
  d = smax(d, -socket(x, y, z), 0.008);
  d = smin(d, lid(x, y, z), 0.0025);
  d = smax(d, -nostril(x, y, z), 0.0015);
  d = smax(d, -mouthLine(x, y, z), 0.0016);
  return d;
}
// --- torso
const torsoParts = [
  MIR(RC(V(0.035, 1.47, -0.036), V(0.15, 1.415, -0.022), 0.03, 0.032)), // trapezius
  EL(V(0, 1.27, -0.005), V(0.135, 0.155, 0.095)),            // ribcage
  MIR(EL(V(0.058, 1.297, 0.048), V(0.068, 0.052, 0.042))),   // chest
  EL(V(0, 1.31, -0.055), V(0.125, 0.11, 0.05)),              // upper back
  EL(V(0, 1.085, 0.004), V(0.122, 0.135, 0.088)),            // belly
  EL(V(0, 0.93, -0.01), V(0.15, 0.095, 0.098)),              // pelvis
  MIR(EL(V(0.062, 0.865, -0.058), V(0.07, 0.075, 0.058))),   // seat
  MIR(EL(V(0.178, 1.382, -0.008), V(0.048, 0.06, 0.052))),   // deltoids
  MIR(RC(V(0.02, 1.41, 0.03), V(0.16, 1.425, 0.004), 0.01, 0.011)), // collarbones
];
// --- arms (relaxed, hanging, a soft bend at the elbow), palms towards the thighs
const S = V(0.178, 1.39, -0.012), E = V(0.21, 1.105, -0.04), W = V(0.222, 0.862, -0.008);
const armParts = [
  RC(S, E, 0.046, 0.034),
  EL(add(lerp3(S, E, 0.55), V(-0.002, 0, 0.015)), V(0.032, 0.075, 0.033), frame(sub(E, S), V(0, 0, 1))), // biceps
  EL(add(lerp3(S, E, 0.45), V(0.004, 0, -0.018)), V(0.033, 0.08, 0.03), frame(sub(E, S), V(0, 0, 1))),  // triceps
  RC(E, W, 0.036, 0.0235),
  EL(add(lerp3(E, W, 0.28), V(0, 0, 0.006)), V(0.038, 0.065, 0.034), frame(sub(W, E), V(0, 0, 1))),    // forearm muscles
  EL(lerp3(E, W, 0.86), V(0.0185, 0.05, 0.0265), frame(sub(W, E), V(0, 0, 1))),                        // the flat wrist
];
// --- hand: D down the hand, Fv towards the thumb (forward), X outwards; the palm faces -X
const D = nrm(sub(W, E)), Fv = nrm(sub(V(0, 0, 1), mul(D, D[2]))), X = cross(Fv, D);
const H = (u, v, w) => add(W, add(mul(D, u), add(mul(Fv, v), mul(X, w))));
const handAx = [X, D, Fv];
const palm = U([
  EL(H(0.052, 0.0, -0.002), V(0.0135, 0.047, 0.041), handAx),
  EL(H(0.036, 0.024, -0.008), V(0.014, 0.03, 0.017), handAx),  // ball of the thumb
  EL(H(0.05, -0.028, -0.004), V(0.012, 0.035, 0.012), handAx), // the little-finger side
], 0.012);
const fingers = [];
const FING = [[0.027, 0.097, [0.04, 0.024, 0.02], 0.07], [0.0085, 0.099, [0.045, 0.028, 0.021], 0.0], [-0.0105, 0.097, [0.042, 0.026, 0.02], -0.06], [-0.0285, 0.091, [0.032, 0.019, 0.018], -0.13]];
const fingerTips = [];
for (const [v0, u0, segs, spread] of FING) {
  const k = v0 < -0.02 ? 0.86 : 1, curl = [0.26, 0.42, 0.26];
  let p = H(u0, v0, 0.0), th = 0, dir;
  const rad = [0.0088 * k, 0.0079 * k, 0.007 * k, 0.0062 * k];
  for (let s = 0; s < 3; s++) {
    th += curl[s]; dir = nrm(add(add(mul(D, Math.cos(th)), mul(X, -Math.sin(th))), mul(Fv, spread * (s === 0 ? 1 : 0.4))));
    const q = add(p, mul(dir, segs[s])); fingers.push(RC(p, q, rad[s], rad[s + 1])); if (s === 2) fingerTips.push([p, q, dir]); p = q;
  }
}
{ // the thumb, resting along the side of the index finger
  const a = H(0.022, 0.022, -0.006), b = H(0.058, 0.045, -0.013), c = H(0.08, 0.06, -0.017), d = H(0.098, 0.066, -0.021);
  fingers.push(RC(a, b, 0.013, 0.0105), RC(b, c, 0.0098, 0.0088), RC(c, d, 0.0087, 0.0068)); fingerTips.push([c, d, nrm(sub(d, c))]);
}
const fingerU = (x, y, z) => { let d = 1e9; for (const f of fingers) d = Math.min(d, f(x, y, z)); return d; };
fingerU.lo = [0.15, 0.6, -0.07]; fingerU.hi = [0.3, 0.9, 0.09];
const handSD = (x, y, z) => smin(palm(x, y, z), fingerU(x, y, z), 0.007);
handSD.lo = [0.17, 0.66, -0.06]; handSD.hi = [0.28, 0.88, 0.08];
const armU = U(armParts, 0.025);
const arm = (x, y, z) => smin(armU(x, y, z), handSD(x, y, z), 0.01);
arm.lo = [0.12, 0.66, -0.1]; arm.hi = [0.3, 1.45, 0.08];
// --- legs
const Hj = V(0.088, 0.89, -0.002), K = V(0.087, 0.49, 0.012), A = V(0.082, 0.088, -0.03);
const legParts = [
  RC(Hj, K, 0.084, 0.053),
  EL(add(lerp3(Hj, K, 0.45), V(0.004, 0, 0.022)), V(0.06, 0.15, 0.05), frame(sub(K, Hj), V(0, 0, 1))),
  EL(add(lerp3(Hj, K, 0.3), V(-0.025, 0, 0)), V(0.045, 0.12, 0.05), frame(sub(K, Hj), V(0, 0, 1))),
  EL(add(K, V(0, 0, 0.012)), V(0.045, 0.04, 0.04)),
  RC(K, A, 0.051, 0.031),
  EL(V(0.086, 0.37, -0.022), V(0.046, 0.085, 0.044)),
];
const legU = U(legParts, 0.03);
const torsoU = U(torsoParts, 0.04);
function bodySD(x, y, z) { // everything but the head: torso, neck, arms, legs
  const ax = Math.abs(x);
  let d = torsoU(x, y, z);
  d = smin(d, smin(neck(x, y, z), scm(x, y, z), 0.02), 0.03);
  if (ax > 0.1 || y > 0.6) d = smin(d, arm(ax, y, z), 0.03);
  if (y < 1.0) d = smin(d, legU(ax, y, z), 0.035);
  return d;
}
function skinSD(x, y, z) {
  let d = bodySD(x, y, z);
  if (y > 1.43) d = smin(d, headSD(x, y, z), 0.014);
  return d;
}
// --- clothes
const sleeveA = S, sleeveB = lerp3(S, E, 0.44);
const shirtParts = [
  ...torsoParts.slice(0, 8).map((g) => { const f = (x, y, z) => g(x, y, z) - 0.009; f.lo = g.lo.map((v) => v - 0.02); f.hi = g.hi.map((v) => v + 0.02); return f; }),
  MIR(RC(sleeveA, sleeveB, 0.06, 0.05)), // short sleeves, a little wider than the arm
  MIR(EL(V(0.095, 0.875, -0.008), V(0.105, 0.075, 0.115))), // over the hips
];
const shirtU = U(shirtParts, 0.05);
const collar = U([RC(V(0, 1.38, -0.014), V(0, 1.62, -0.024), 0.071, 0.071), EL(V(0, 1.448, 0.012), V(0.074, 0.05, 0.075))], 0.02);
function shirtSD(x, y, z) {
  let d = shirtU(x, y, z) - 0.007 * sstep(1.0, 0.86, y);
  // drape folds: soft diagonal ripples from the chest and shoulders to the waist, wrinkles under the arms and at the hem
  const ax = Math.abs(x), n = fbm(x * 18, y * 18, z * 18);
  const side = sstep(0.06, 0.13, ax) * sstep(1.32, 1.15, y);
  d += 0.0032 * Math.sin((y * 1.0 + ax * 0.8) * 95 + n * 3) * side * sstep(0.88, 0.98, y);
  d += 0.0022 * Math.sin(y * 140 + n * 4) * sstep(0.95, 0.88, y);
  d += 0.0018 * n;
  // the hem (a gentle wave) and the round neck
  d = smax(d, 0.818 + 0.004 * Math.sin(x * 40 + z * 30) - y, 0.004);
  d = smax(d, -collar(x, y, z), 0.005);
  return d;
}
const jeansParts = [
  EL(V(0, 0.93, -0.01), V(0.158, 0.103, 0.106)),
  MIR(EL(V(0.062, 0.865, -0.058), V(0.076, 0.081, 0.064))),
  MIR(RC(Hj, K, 0.096, 0.07)),
  MIR(RC(K, V(0.082, 0.07, -0.022), 0.07, 0.056)),
];
const jeansU = U(jeansParts, 0.045);
function jeansSD(x, y, z) {
  let d = jeansU(x, y, z);
  const ax = Math.abs(x), n = fbm(x * 22 + 4, y * 22, z * 22);
  // stacking at the ankle, creases behind the knee and across the hips
  d -= 0.0045 * sstep(0.22, 0.09, y) * (0.5 + 0.5 * Math.sin(y * 150 + n * 5));
  const kn = sstep(0.07, 0.0, Math.abs(y - 0.5)); d += 0.0028 * Math.sin(y * 210 + n * 4) * kn * sstep(0.0, -0.03, z - 0.012);
  d += 0.0022 * Math.sin((y - ax * 0.6) * 120 + n * 3) * sstep(0.9, 0.82, y) * sstep(0.74, 0.8, y) * sstep(0.03, 0.08, z);
  d += 0.0014 * n;
  d = smax(d, y - 0.91, 0.004); // waist (under the T-shirt)
  d = smax(d, 0.066 - y, 0.003); // hem, over the shoe
  return d;
}
const shoeUpper = MIR(U([
  EL(V(0.082, 0.062, -0.058), V(0.044, 0.052, 0.054)),
  RC(V(0.083, 0.058, -0.03), V(0.09, 0.045, 0.1), 0.046, 0.04),
  EL(V(0.091, 0.04, 0.125), V(0.046, 0.033, 0.05)),
  RC(V(0.082, 0.06, -0.035), V(0.082, 0.112, -0.038), 0.047, 0.044),
], 0.03));
function shoeSD(x, y, z) { const d = shoeUpper(x, y, z); return smax(d, 0.02 - y, 0.003); }
function soleSD(x, y, z) {
  const ax = Math.abs(x), yy = y - 0.014 * sstep(0.1, 0.175, z) - 0.006 * sstep(-0.06, -0.11, z);
  const a = [0.082, -0.07], b = [0.093, 0.13], ba = [b[0] - a[0], b[1] - a[1]], pa = [ax - a[0], z - a[1]], h = clamp((pa[0] * ba[0] + pa[1] * ba[1]) / (ba[0] * ba[0] + ba[1] * ba[1]), 0, 1);
  const r = mix(0.043, 0.05, sstep(0.3, 0.9, h)), d2 = Math.hypot(pa[0] - ba[0] * h, pa[1] - ba[1] * h) - r;
  const dy = Math.abs(yy - 0.013) - 0.012, ox = Math.max(d2, 0), oy = Math.max(dy, 0);
  return Math.min(Math.max(d2, dy), 0) + Math.hypot(ox, oy) - 0.004;
}
// --- hair: short, with volume on top, combed back from a slight side parting; grooves flow out from the crown
const hairCap = U([EL(V(0, 1.61, -0.017), V(0.081, 0.096, 0.106)), EL(V(0.012, 1.676, 0.026), V(0.06, 0.026, 0.06)), EL(V(-0.02, 1.664, 0.06), V(0.045, 0.02, 0.035)), MIR(EL(V(0.058, 1.632, -0.012), V(0.027, 0.04, 0.066)))], 0.028);
const faceCut = U([EL(V(0, 1.53, 0.074), V(0.078, 0.118, 0.07)), MIR(EL(V(0.06, 1.62, 0.07), V(0.03, 0.03, 0.03)))], 0.01);
const earCut = MIR(EL(V(0.076, 1.572, -0.012), V(0.03, 0.034, 0.032)));
const CROWN = V(-0.012, 1.69, -0.045);
function hairSD(x, y, z) {
  let d = hairCap(x, y, z);
  d = smax(d, -faceCut(x, y, z), 0.008);
  d = smax(d, -earCut(x, y, z), 0.006);
  d = smax(d, 1.505 + 0.02 * sstep(-0.02, 0.06, z) - y, 0.01); // the nape
  const hx = x - CROWN[0], hz = z - CROWN[2], ph = Math.atan2(hx, hz), n = fbm(x * 40, y * 40, z * 40), clump = 0.6 + 0.4 * noise(ph * 6, y * 30, 3);
  d -= 0.0021 * clump * (0.5 + 0.5 * Math.sin(ph * 46 + n * 3.2)) - 0.0012 * noise(x * 90, y * 90, z * 90);
  return d;
}
const brows = MIR(EL(V(0.0318, 1.6148, 0.0868), V(0.02, 0.0031, 0.0072), frame(V(0.3, 1, 0), V(0, 0, 1))));
function browSD(x, y, z) { return brows(x, y, z) - 0.0006 * noise(x * 600, y * 600, z * 600); }
function allSD(x, y, z) { return Math.min(skinSD(x, y, z), shirtSD(x, y, z), jeansSD(x, y, z), shoeSD(x, y, z), soleSD(x, y, z), hairSD(x, y, z)); }

// ---------------------------------------------------------------- surface nets in a narrow band
function mesh(sd, box, h, keep) {
  const [x0, y0, z0] = box[0], [x1, y1, z1] = box[1];
  const NX = Math.ceil((x1 - x0) / h) + 2, NY = Math.ceil((y1 - y0) / h) + 2, NZ = Math.ceil((z1 - z0) / h) + 2;
  const idx = (i, j, k) => i + NX * (j + NY * k);
  const vals = new Map(), val = (i, j, k) => { const key = idx(i, j, k); let v = vals.get(key); if (v === undefined) { v = sd(x0 + i * h, y0 + j * h, z0 + k * h); vals.set(key, v); } return v; };
  // coarse pass: blocks of B cells that the surface may cross
  const B = 8, Hb = h * B, cells = [];
  for (let bk = 0; bk * B < NZ - 1; bk++) for (let bj = 0; bj * B < NY - 1; bj++) for (let bi = 0; bi * B < NX - 1; bi++) {
    const cx = x0 + (bi + 0.5) * Hb, cy = y0 + (bj + 0.5) * Hb, cz = z0 + (bk + 0.5) * Hb, d = sd(cx, cy, cz);
    if (Math.abs(d) > Hb * 0.9 + h) continue;
    if (keep && !keep(cx, cy, cz, Hb)) continue;
    for (let k = bk * B; k < Math.min(NZ - 1, bk * B + B); k++) for (let j = bj * B; j < Math.min(NY - 1, bj * B + B); j++) for (let i = bi * B; i < Math.min(NX - 1, bi * B + B); i++) cells.push(i, j, k);
  }
  const vmap = new Map(), pos = [];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const EDG = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float64Array(8);
  for (let c = 0; c < cells.length; c += 3) {
    const i = cells[c], j = cells[c + 1], k = cells[c + 2]; let neg = 0;
    for (let q = 0; q < 8; q++) { cv[q] = val(i + C[q][0], j + C[q][1], k + C[q][2]); if (cv[q] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of EDG) { if ((cv[a] < 0) === (cv[b] < 0)) continue; const t = cv[a] / (cv[a] - cv[b]); sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++; }
    vmap.set(idx(i, j, k), pos.length / 3); pos.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h);
  }
  const tri = [];
  const quad = (a, b, c, d, flip) => { if (a === undefined || b === undefined || c === undefined || d === undefined) return; if (flip) tri.push(a, c, b, a, d, c); else tri.push(a, b, c, a, c, d); };
  for (let c = 0; c < cells.length; c += 3) {
    const i = cells[c], j = cells[c + 1], k = cells[c + 2]; if (!vmap.has(idx(i, j, k))) continue;
    const v0 = val(i, j, k);
    if (j > 0 && k > 0) { const v1 = val(i + 1, j, k); if ((v0 < 0) !== (v1 < 0)) quad(vmap.get(idx(i, j - 1, k - 1)), vmap.get(idx(i, j, k - 1)), vmap.get(idx(i, j, k)), vmap.get(idx(i, j - 1, k)), v0 >= 0); }
    if (i > 0 && k > 0) { const v1 = val(i, j + 1, k); if ((v0 < 0) !== (v1 < 0)) quad(vmap.get(idx(i - 1, j, k - 1)), vmap.get(idx(i - 1, j, k)), vmap.get(idx(i, j, k)), vmap.get(idx(i, j, k - 1)), v0 >= 0); }
    if (i > 0 && j > 0) { const v1 = val(i, j, k + 1); if ((v0 < 0) !== (v1 < 0)) quad(vmap.get(idx(i - 1, j - 1, k)), vmap.get(idx(i, j - 1, k)), vmap.get(idx(i, j, k)), vmap.get(idx(i - 1, j, k)), v0 >= 0); }
  }
  return { pos: new Float64Array(pos), tri: new Uint32Array(tri) };
}
const grad = (sd, x, y, z, e = 2e-4) => nrm([sd(x + e, y, z) - sd(x - e, y, z), sd(x, y + e, z) - sd(x, y - e, z), sd(x, y, z + e) - sd(x, y, z - e)]);
function project(sd, m) { const p = m.pos; for (let v = 0; v < p.length; v += 3) for (let it = 0; it < 3; it++) { const d = sd(p[v], p[v + 1], p[v + 2]); if (Math.abs(d) < 1e-6) break; const g = grad(sd, p[v], p[v + 1], p[v + 2]); p[v] -= g[0] * d; p[v + 1] -= g[1] * d; p[v + 2] -= g[2] * d; } }
function dropTris(m, bad) { const out = []; const p = m.pos; for (let t = 0; t < m.tri.length; t += 3) { const a = m.tri[t] * 3, b = m.tri[t + 1] * 3, c = m.tri[t + 2] * 3; if (bad((p[a] + p[b] + p[c]) / 3, (p[a + 1] + p[b + 1] + p[c + 1]) / 3, (p[a + 2] + p[b + 2] + p[c + 2]) / 3)) continue; out.push(m.tri[t], m.tri[t + 1], m.tri[t + 2]); } m.tri = new Uint32Array(out); }
function simplify(m, target, err) {
  const p32 = new Float32Array(m.pos), cur = m.tri.length / 3;
  let tri = m.tri;
  if (cur > target) tri = MeshoptSimplifier.simplify(m.tri, p32, 3, target * 3, err, ['ErrorAbsolute'])[0];
  // compact the vertices
  const remap = new Int32Array(m.pos.length / 3).fill(-1), pos = []; const out = new Uint32Array(tri.length);
  for (let i = 0; i < tri.length; i++) { const v = tri[i]; if (remap[v] < 0) { remap[v] = pos.length / 3; pos.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]); } out[i] = remap[v]; }
  return { pos: new Float64Array(pos), tri: out };
}
function ao(x, y, z, n) { let occ = 0, w = 1; for (let i = 1; i <= 5; i++) { const s = 0.006 * i, d = allSD(x + n[0] * s, y + n[1] * s, z + n[2] * s); occ += w * Math.max(0, s - d); w *= 0.6; } return clamp(1 - occ * 22, 0.35, 1); }

// ---------------------------------------------------------------- parts
const parts = [
  { n: 'skin', sd: skinSD, box: [[-0.32, 0.6, -0.16], [0.32, 1.72, 0.16]], h: 0.0013, target: 30000, err: 0.0007,
    keep: (x, y, z, Hb) => !(shirtSD(x, y, z) < -Hb || jeansSD(x, y, z) < -Hb),
    drop: (x, y, z) => shirtSD(x, y, z) < -0.0008 || jeansSD(x, y, z) < -0.0008 || hairSD(x, y, z) < -0.0025 || y < 0.62,
    col: (x, y, z) => { // lips, a touch of colour in the cheeks and ears, nails, darker knuckle creases
      const ax = Math.abs(x); let r = 1, g = 1, b = 1;
      const lip = sstep(0.009, 0.0035, Math.hypot((ax) / 2.6, (y - 1.516) * 1.15, Math.max(0, 0.085 - z) * 0.8)); r *= mix(1, 0.86, lip); g *= mix(1, 0.6, lip); b *= mix(1, 0.62, lip);
      const ck = sstep(0.03, 0.0, Math.hypot(ax - 0.045, y - 1.55, (z - 0.072) * 0.6)); g *= 1 - 0.07 * ck; b *= 1 - 0.06 * ck;
      const er = sstep(0.025, 0.0, Math.hypot(ax - 0.078, y - 1.574, z + 0.01)); g *= 1 - 0.06 * er; b *= 1 - 0.05 * er;
      for (const [p, q, dir] of fingerTips) { // nails on the back of the last joint (both hands)
        const P = [ax, y, z], t = clamp(dot(sub(P, p), dir) / len(sub(q, p)), 0, 1.2), c = add(p, mul(dir, t * len(sub(q, p)))), off = sub(P, c), side = dot(nrm(off), X);
        if (t > 0.35 && len(off) < 0.012 && side > 0.55) { const k = sstep(0.35, 0.5, t) * sstep(0.55, 0.8, side); r = mix(r, 1.04, k); g = mix(g, 0.9, k); b = mix(b, 0.88, k); }
      }
      return [r, g, b];
    } },
  { n: 'shirt', sd: shirtSD, box: [[-0.29, 0.79, -0.16], [0.29, 1.5, 0.16]], h: 0.0028, target: 9000, err: 0.0015,
    col: (x, y, z) => { const ax = Math.abs(x), c = collar(x, y, z), band = sstep(0.016, 0.006, Math.abs(c + 0.0)) * sstep(1.38, 1.42, y); const hem = sstep(0.835, 0.82, y); const sl = sstep(0.012, 0.0, Math.abs(dot(sub([ax, y, z], sleeveB), nrm(sub(sleeveB, sleeveA))))) * sstep(0.1, 0.16, ax); const k = 1 - 0.1 * Math.max(band, hem, sl); return [k, k, k]; } },
  { n: 'jeans', sd: jeansSD, box: [[-0.2, 0.05, -0.15], [0.2, 0.97, 0.14]], h: 0.0028, target: 9000, err: 0.0015,
    col: (x, y, z) => { // the outer seam and the waistband stitching, lighter wear on the thighs and knees
      const ax = Math.abs(x), seam = sstep(0.006, 0.0015, Math.abs(z - (-0.006 + 0.04 * (0.5 - y) * 0.1))) * sstep(0.06, 0.1, ax) * sstep(0.95, 0.9, y);
      const wb = sstep(0.003, 0.0, Math.abs(y - 0.88)) * 0.7, wear = 0.08 * sstep(0.04, 0.0, Math.abs(y - 0.6)) * sstep(0.0, 0.04, z) + 0.06 * sstep(0.03, 0.0, Math.abs(y - 0.49)) * sstep(0.02, 0.05, z);
      const k = 1 + wear; return [k * (1 + 0.5 * seam + 0.4 * wb), k * (1 + 0.35 * seam + 0.3 * wb), k * (1 + 0.1 * seam)];
    } },
  { n: 'shoe', sd: shoeSD, box: [[-0.15, 0.0, -0.13], [0.15, 0.17, 0.19]], h: 0.0022, target: 4000, err: 0.001, drop: (x, y, z) => jeansSD(x, y, z) < -0.001,
    col: (x, y, z) => { const ax = Math.abs(x), stripe = sstep(0.006, 0.0, Math.abs(y - 0.045 - (z + 0.05) * 0.25)) * sstep(0.0, 0.02, ax - 0.09) * sstep(-0.06, 0.0, z) * sstep(0.1, 0.05, z); const lace = sstep(0.004, 0.0, Math.abs(((z + 0.2) * 70) % 1 - 0.5) * 0.02) * sstep(0.02, 0.0, Math.abs(ax - 0.088)) * sstep(0.0, 0.03, z) * sstep(0.1, 0.07, z) * sstep(0.06, 0.075, y); const k = 1 - 0.55 * stripe - 0.25 * lace; return [k, k * 1.0, k * 1.02]; } },
  { n: 'sole', sd: soleSD, box: [[-0.15, -0.005, -0.13], [0.15, 0.06, 0.19]], h: 0.0022, target: 2200, err: 0.001,
    col: (x, y, z) => { const k = y < 0.006 ? 0.7 : 1; return [k, k, k]; } },
  { n: 'hair', sd: hairSD, box: [[-0.1, 1.48, -0.14], [0.1, 1.71, 0.11]], h: 0.0012, target: 10000, err: 0.0012, drop: (x, y, z) => skinSD(x, y, z) > 0.03 && false,
    col: () => [1, 1, 1] },
  { n: 'brow', sd: browSD, box: [[-0.06, 1.6, 0.07], [0.06, 1.63, 0.1]], h: 0.0007, target: 900, err: 0.0004, drop: (x, y, z) => headSD(x, y, z) < -0.0004,
    col: () => [1, 1, 1] },
];

(async () => {
  await MeshoptSimplifier.ready;
  const out = [];
  for (const P of parts) {
    const t0 = Date.now();
    let m = mesh(P.sd, P.box, P.h, P.keep);
    project(P.sd, m);
    if (P.drop) dropTris(m, P.drop);
    const raw = m.tri.length / 3;
    m = simplify(m, P.target, P.err);
    const nv = m.pos.length / 3, nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    for (let v = 0; v < nv; v++) {
      const x = m.pos[v * 3], y = m.pos[v * 3 + 1], z = m.pos[v * 3 + 2], g = grad(P.sd, x, y, z, 4e-4); nor.set(g, v * 3);
      const a = ao(x, y, z, g), c = P.col(x, y, z); col.set([c[0] * a, c[1] * a, c[2] * a], v * 3);
    }
    out.push({ n: P.n, pos: m.pos, tri: m.tri, nor, col });
    console.log(P.n, 'raw', raw, 'tris', m.tri.length / 3, 'verts', nv, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  writeBin(out, path.join(__dirname, '..', 'species', '3d', 'person.bin'));
})();

// format: 'SLP1', u32 JSON length, JSON {eye:[x,y,z,r], parts:[{n,v,t,lo,hi}]}, padded to 4; then per part:
// positions u16 x3 (in the part's box), normals i8 x3 + pad, colours u8 x3 + pad (u8x4 each), indices u16 (or u32 if v > 65535)
function writeBin(list, file) {
  const meta = { eye: [...EYE, EYE_R], h: 1.7, parts: [] }, chunks = [];
  for (const p of list) {
    const nv = p.pos.length / 3, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let v = 0; v < nv; v++) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], p.pos[v * 3 + c]); hi[c] = Math.max(hi[c], p.pos[v * 3 + c]); }
    const q = new Uint16Array(nv * 3); for (let v = 0; v < nv; v++) for (let c = 0; c < 3; c++) q[v * 3 + c] = Math.round(((p.pos[v * 3 + c] - lo[c]) / Math.max(1e-9, hi[c] - lo[c])) * 65535);
    const nb = new Int8Array(nv * 4), cb = new Uint8Array(nv * 4);
    for (let v = 0; v < nv; v++) { for (let c = 0; c < 3; c++) { nb[v * 4 + c] = Math.round(clamp(p.nor[v * 3 + c], -1, 1) * 127); cb[v * 4 + c] = Math.round(clamp(p.col[v * 3 + c] / 1.1, 0, 1) * 255); } }
    const ib = nv > 65535 ? new Uint32Array(p.tri) : new Uint16Array(p.tri);
    meta.parts.push({ n: p.n, v: nv, t: p.tri.length, lo: lo.map((x) => +x.toFixed(6)), hi: hi.map((x) => +x.toFixed(6)) });
    chunks.push(Buffer.from(q.buffer), Buffer.from(nb.buffer), Buffer.from(cb.buffer), Buffer.from(ib.buffer), Buffer.alloc((4 - (ib.byteLength % 4)) % 4));
  }
  const js = Buffer.from(JSON.stringify(meta)), pad = Buffer.alloc((4 - ((8 + js.length) % 4)) % 4, 32), hd = Buffer.alloc(8); hd.write('SLP1', 0); hd.writeUInt32LE(js.length + pad.length, 4);
  const buf = Buffer.concat([hd, js, pad, ...chunks]); fs.writeFileSync(file, buf); console.log('wrote', file, buf.length, 'bytes');
}
