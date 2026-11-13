// Realistic scenery for the SnakeList 3D viewer (v4.80): rolling textured land, real-looking trees (bark, branches,
// crowns of leaf sprays), undergrowth, rocks, a carpet of 3D fallen leaves and only a gentle haze far away.
// viewer.js calls build(args) once per scene, right after the near ground is made.
// Return true to replace viewer.js's own far scenery (hills + simple trees/boulders), false to keep it.

const TAU = Math.PI * 2;

// what grows where. trees: [type, share]; spacing: metres between trees; clump: trees only in groves (open land)
const HAB = {
  litter:     { forest: 1, trees: [['broad', 0.8], ['spruce', 0.2]], spacing: 6.5, hills: 0.05, under: 'forest', rock: 'moss', litter: 1, haze: '#55654c' },
  forest:     { forest: 1, trees: [['broad', 0.6], ['spruce', 0.4]], spacing: 6, hills: 0.06, under: 'forest', rock: 'moss', litter: 1, haze: '#526249' },
  soil:       { forest: 1, trees: [['broad', 0.9], ['spruce', 0.1]], spacing: 7, hills: 0.05, under: 'forest', rock: 'moss', litter: 0.6, haze: '#58664f' },
  rainforest: { forest: 1, trees: [['tropic', 0.6], ['palm', 0.25], ['broad', 0.15]], spacing: 5.5, hills: 0.07, under: 'jungle', rock: 'moss', litter: 1.2, haze: '#4b5d45' },
  riverbank:  { trees: [['broad', 0.8], ['spruce', 0.2]], spacing: 8, clump: 0.5, hills: 0.05, under: 'meadow', rock: 'grey' },
  grass:      { trees: [['savanna', 1]], spacing: 15, clump: 0.58, hills: 0.05, under: 'grass', rock: 'grey' },
  heath:      { trees: [['pine', 0.65], ['spruce', 0.35]], spacing: 8, clump: 0.55, hills: 0.09, under: 'heath', rock: 'grey' },
  arid:       { trees: null, hills: 0.07, ridge: 0.2, under: 'arid', rock: 'red' },
  sand:       { trees: null, dunes: 1, under: 'sand', rock: 'sandstone' },
  gibber:     { trees: null, hills: 0.012, mesas: 1, under: 'gibber', rock: 'gibber' },
};
const BY_GROUND = { litter: 'litter', soil: 'soil', gravel: 'arid', heath: 'heath', pebbles: 'riverbank', dry: 'grass', sand: 'sand', gibber: 'gibber' };

export function build(A) {
  const { S, scene } = A;
  if (!S || !S.ground || S.water === 'sea' || typeof document === 'undefined') return false;
  const before = new Set(scene.children);
  try { buildAll(A); return true; } catch (e) {
    console.warn('nature.js: using the simple scenery instead', e);
    for (const o of scene.children.slice()) if (!before.has(o)) scene.remove(o);
    return false;
  }
}

function buildAll(A) {
  const { THREE, ctx, scene, S, kind, groundR, farR, Rb, F, L, seed, quality, rng, fbm, sstep, clamp, dist2snake, poseInfo } = A;
  const low = quality === 'low';
  const K = HAB[kind] || HAB[BY_GROUND[S.ground]] || HAB.litter;
  const R = rng(seed + 4421);
  const lerp = (a, b, t) => a + (b - a) * t;
  const track = (o) => { if (o && ctx.track) ctx.track(o); return o; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = V(0, 1, 0), WHITE = new THREE.Color(1, 1, 1);
  const stats = {};
  const addTris = (k, n) => { stats[k] = (stats[k] || 0) + Math.round(n); };

  // ---------- the near ground viewer.js made (its texture continues onto the far land, without a seam) ----------
  let nearMesh = null, water = null;
  for (const o of scene.children) {
    if (!o.isMesh || !o.material) continue;
    if (!nearMesh && o.material.map && o.material.bumpMap === o.material.map) nearMesh = o;
    if (o.renderOrder === 2 && o.material.transparent) water = o;
  }
  if (!nearMesh) throw new Error('no near ground');
  const nearH = ringSampler(nearMesh);

  // ---------- one height function for the whole land ----------
  const wi = S.water === 'river' ? ctx.waterInfo : null;
  const depth = Math.max(0.03, Rb * 0.12), riverW = clamp(groundR * 1.1, 6, 26);
  const riverS = (x, z) => { const al = -x * wi.dir.y + z * wi.dir.x; return x * wi.dir.x + z * wi.dir.y + (fbm(al / Rb * 1.3, 3.1, 0.7, seed + 19, 3) - 0.5) * Rb * 1.8; };
  const inRiver = (x, z, m = 1) => { if (!wi) return false; const s = riverS(x, z); return s > wi.edge - m && s < wi.edge + riverW + m; };
  const hs = wi ? groundR * 1.45 : groundR;
  const rEnd = farR * (K.forest ? 1.6 : 3);
  const base = (x, z, r) => {
    if (wi) {
      const s = riverS(x, z), e = wi.edge;
      return -depth * sstep(e - Rb * 0.25, e + Rb * 0.7, s) - depth * 0.8 * sstep(e + Rb, e + Rb * 4, s) * (1 - sstep(e + riverW - 2, e + riverW, s))
        + (depth * 1.8 + 0.35) * sstep(e + riverW, e + riverW + Math.max(2, riverW * 0.2), s);
    }
    return (fbm(x / (Rb * 6), z / (Rb * 6), 1, seed + 53, 3) - 0.35) * Rb * 0.9 * sstep(Rb * 7, groundR * 0.95, r); // the near ground's own gentle rise
  };
  const drop = (r) => (Rb * 0.04 + F.w0 * 0.3) * (1 - sstep(groundR, groundR * 1.25, r)); // tucked just under the near ground's edge
  const amp = (K.hills || 0) * farR;
  const hills = (x, z, r) => {
    const m = sstep(hs, hs + farR * 0.35, r); if (m <= 0) return 0;
    let h = 0;
    if (amp) h += (fbm(x / (farR * 0.25), z / (farR * 0.25), 1, seed + 71, 4) - 0.32) * amp;
    if (K.ridge) h += Math.max(0, fbm(x / (farR * 0.45), z / (farR * 0.45), 2, seed + 81, 4) - 0.42) * farR * K.ridge * 3 * sstep(farR * 0.5, farR * 1.3, r);
    if (K.dunes) {
      const u = x * 0.8 + z * 0.6, v = -x * 0.6 + z * 0.8, n = fbm(u / 24, v / 70, 3, seed + 61, 3), ridge = 1 - Math.abs(2 * n - 1);
      h += Math.pow(ridge, 1.8) * lerp(1.2, 7, sstep(hs, farR * 1.2, r)) + (fbm(x / 90, z / 90, 4, seed + 63, 3) - 0.45) * 5;
    }
    if (K.mesas) { const n = fbm(x / (farR * 0.3), z / (farR * 0.3), 5, seed + 91, 3); h += sstep(0.58, 0.68, n) * (4 + 4 * fbm(x / 40, z / 40, 6, seed + 93, 2)) * sstep(farR * 1.0, farR * 1.5, r); }
    if (wi) { const s = riverS(x, z); h = Math.max(0, h) * ((1 - sstep(wi.edge - 6, wi.edge - 1, s)) + sstep(wi.edge + riverW + 2, wi.edge + riverW + 10, s)); }
    return h * m;
  };
  const Hgt = (x, z) => { const r = Math.hypot(x, z); return base(x, z, r) - drop(r) + hills(x, z, r); };
  // the ground right under something, wherever it is (the near ground where there is near ground)
  const groundAt = (x, z) => { const r = Math.hypot(x, z); if (r < groundR * 0.985) { if (nearH) return nearH(x, z); if (wi && r < groundR) return base(x, z, r); } return Hgt(x, z); };

  // ---------- small helpers ----------
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), ee = new THREE.Euler(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
  function inst(geo, mat, list, o = {}) {
    if (!list.length || !mat || (geo.index && !geo.index.count)) { geo.dispose(); return null; }
    const im = new THREE.InstancedMesh(geo, mat, list.length), anyCol = list.some((t) => t.col);
    list.forEach((t, i) => {
      ee.set(t.rx || 0, t.ry || 0, t.rz || 0, 'YXZ'); qq.setFromEuler(ee); pv.set(t.x, t.y, t.z);
      sv.set(t.s * (t.sx || 1), t.s * (t.sy || 1), t.s * (t.sz || 1)); m4.compose(pv, qq, sv); im.setMatrixAt(i, m4);
      if (anyCol) im.setColorAt(i, t.col || WHITE);
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = !!o.cast; im.receiveShadow = !!o.recv; scene.add(im); track(geo); track(mat);
    addTris(o.tag || 'misc', ((geo.index ? geo.index.count : geo.attributes.position.count) / 3) * list.length);
    return im;
  }
  // points scattered between rMin and rMax ('area': even cover, 'lin': thinning out with distance), at least minD apart
  function scatter(n, rMin, rMax, minD, ok, distr = 'area', tries = 24) {
    const out = [], grid = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663;
    for (let k = 0; k < n; k++) for (let t = 0; t < tries; t++) {
      const a = R() * TAU, r = distr === 'lin' ? lerp(rMin, rMax, R()) : Math.sqrt(lerp(rMin * rMin, rMax * rMax, R())), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (ok && !ok(x, z, r)) continue;
      if (minD > 0) {
        const ci = Math.floor(x / minD), cj = Math.floor(z / minD); let bad = false;
        for (let di = -1; di <= 1 && !bad; di++) for (let dj = -1; dj <= 1 && !bad; dj++) { const c = grid.get(key(ci + di, cj + dj)); if (c) for (const p of c) if ((p.x - x) ** 2 + (p.z - z) ** 2 < minD * minD) { bad = true; break; } }
        if (bad) continue;
        const kk = key(ci, cj); if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push({ x, z });
      }
      out.push({ x, z, r }); break;
    }
    return out;
  }
  const tex = makeTextures(THREE, rng, fbm, seed, track);

  // ---------- geometry builders ----------
  class GB {
    constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; }
    v(x, y, z, nx, ny, nz, u, v, c) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.u.push(u, v); this.c.push(c[0], c[1], c[2]); return this.p.length / 3 - 1; }
    tri(a, b, c) { this.i.push(a, b, c); }
    geo() {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setIndex(this.i); g.computeBoundingSphere(); return g;
    }
  }
  const W1 = [1, 1, 1];
  // a tube along a line of points: trunks, branches, logs
  function tube(gb, pts, rads, seg, o = {}) {
    const n = pts.length, T = V(0, 0, 0), B = V(0, 0, 0), d = V(0, 0, 0); let N = null, vAcc = 0; const start = gb.p.length / 3;
    for (let k = 0; k < n; k++) {
      T.subVectors(pts[Math.min(n - 1, k + 1)], pts[Math.max(0, k - 1)]).normalize();
      if (!N) N = (Math.abs(T.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)).cross(T).normalize(); else N.addScaledVector(T, -N.dot(T)).normalize();
      B.crossVectors(T, N); if (k) vAcc += pts[k].distanceTo(pts[k - 1]);
      const p = pts[k], col = o.col ? o.col(p.y, k / (n - 1)) : W1;
      for (let s = 0; s <= seg; s++) {
        const th = (s / seg) * TAU, c = Math.cos(th), sn = Math.sin(th);
        d.set(N.x * c + B.x * sn, N.y * c + B.y * sn, N.z * c + B.z * sn);
        const r = rads[k] * (o.flare ? o.flare(th, p.y) : 1);
        gb.v(p.x + d.x * r, p.y + d.y * r, p.z + d.z * r, d.x, d.y, d.z, (s / seg) * (o.uRep || 1), vAcc / (o.vLen || 1), col);
      }
    }
    for (let k = 0; k < n - 1; k++) for (let s = 0; s < seg; s++) { const a = start + k * (seg + 1) + s, b = a + 1, c = a + seg + 1, e = c + 1; gb.tri(a, b, c); gb.tri(b, e, c); }
  }
  function spine(p0, dir, len, n, Rn, up, wob) {
    const pts = [p0.clone()], d = dir.clone().normalize(), p = p0.clone();
    for (let k = 1; k <= n; k++) { d.x += (Rn() - 0.5) * wob; d.z += (Rn() - 0.5) * wob; d.y += (Rn() - 0.5) * wob * 0.5 + up / n; d.normalize(); p.addScaledVector(d, len / n); pts.push(p.clone()); }
    return pts;
  }
  const along = (pts, t) => { const f = clamp(t, 0, 1) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)); return pts[i].clone().lerp(pts[i + 1], f - i); };
  const dirAt = (pts, t) => { const f = clamp(t, 0, 1) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)); return pts[i + 1].clone().sub(pts[i]).normalize(); };
  // a leaf spray card; its normals point out of the crown, so a crown is lit like a soft mass of leaves
  const _a1 = V(0, 0, 0), _a2 = V(0, 0, 0), _o = V(0, 0, 0), _n = V(0, 0, 0), _q = V(0, 0, 0);
  function card(gb, c, w, h, nrm, upv, ctr, crR, o = {}) {
    _a2.copy(upv).addScaledVector(nrm, -upv.dot(nrm)); if (_a2.lengthSq() < 1e-8) _a2.set(0, 1, 0).addScaledVector(nrm, -nrm.y); _a2.normalize();
    _a1.crossVectors(_a2, nrm).normalize();
    const i0 = gb.p.length / 3, sq = o.sq || 1;
    for (const [sx, sy, u, v] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
      _q.copy(c).addScaledVector(_a1, sx * w * 0.5).addScaledVector(_a2, sy * h * 0.5);
      _o.copy(_q).sub(ctr); _o.y *= sq; const dd = _o.length() / Math.max(1e-6, crR); _o.normalize();
      _n.copy(_o).multiplyScalar(0.8).addScaledVector(nrm, nrm.dot(_o) < 0 ? -0.25 : 0.25).normalize();
      if (o.upN) _n.lerp(UP, o.upN).normalize();
      const sh = clamp(0.42 + 0.62 * dd, 0.4, 1.06) * (o.dark || 1);
      gb.v(_q.x, _q.y, _q.z, _n.x, _n.y, _n.z, u, v, [sh, sh, sh]);
    }
    gb.tri(i0, i0 + 1, i0 + 2); gb.tri(i0, i0 + 2, i0 + 3);
  }
  // a long bent strip: palm fronds, fern fronds, big leaves (a slight V fold along the middle)
  function ribbon(gb, p0, d, len, segs, wK, droop, Rn, o = {}) {
    let across = V(0, 0, 0).crossVectors(d, UP); if (across.lengthSq() < 1e-6) across.set(1, 0, 0); across.normalize().applyAxisAngle(d, (Rn() - 0.5) * 0.7);
    const i0 = gb.p.length / 3, t = V(0, 0, 0), nn = V(0, 0, 0), p = V(0, 0, 0);
    for (let k = 0; k <= segs; k++) {
      const s = k / segs; p.copy(p0).addScaledVector(d, len * s); p.y -= droop * len * s * s;
      t.copy(d).multiplyScalar(len); t.y -= 2 * droop * len * s; t.normalize(); nn.crossVectors(across, t).normalize(); if (nn.y < 0) nn.negate();
      const w = wK(s) * len, fold = w * (o.fold || 0.18), sh = (o.base || 0.7) + 0.35 * s;
      const nOut = V(nn.x * 0.6 + d.x * 0.5, nn.y * 0.6 + 0.2, nn.z * 0.6 + d.z * 0.5).normalize();
      gb.v(p.x - across.x * w * 0.5, p.y - across.y * w * 0.5, p.z - across.z * w * 0.5, nOut.x, nOut.y, nOut.z, 0, s, [sh, sh, sh]);
      gb.v(p.x + nn.x * fold, p.y + nn.y * fold, p.z + nn.z * fold, nOut.x, nOut.y, nOut.z, 0.5, s, [sh, sh, sh]);
      gb.v(p.x + across.x * w * 0.5, p.y + across.y * w * 0.5, p.z + across.z * w * 0.5, nOut.x, nOut.y, nOut.z, 1, s, [sh, sh, sh]);
    }
    for (let k = 0; k < segs; k++) { const a = i0 + k * 3; gb.tri(a, a + 3, a + 1); gb.tri(a + 1, a + 3, a + 4); gb.tri(a + 1, a + 4, a + 2); gb.tri(a + 2, a + 4, a + 5); }
  }
  const woodCol = (moss) => (y) => { const ao = 0.55 + 0.45 * sstep(-0.3, 1.6, y), m = moss * (1 - sstep(0.2, 3.5, y)); return [ao * lerp(1, 0.62, m), ao * lerp(1, 0.86, m), ao * lerp(1, 0.5, m)]; };

  // ---------- trees ----------
  const TREE = {
    broad:   { H: [14, 23], o: { trunkFrac: 0.33, leader: 0.82, spread: 0.36, el0: 28, elR: 32, up: 0.35, card: 0.085, perM: 3.4, nMain: 6, rK: 0.022, moss: 0.5 }, bark: 'furrow', barkTint: '#a59a8c', spray: 'broad' },
    tropic:  { H: [20, 32], o: { trunkFrac: 0.58, leader: 0.8, spread: 0.3, el0: 42, elR: 30, up: 0.2, card: 0.075, perM: 3.2, nMain: 6, rK: 0.019, buttress: 1, moss: 0.9 }, bark: 'smooth', barkTint: '#a8a294', spray: 'tropic' },
    savanna: { H: [6, 10.5], o: { trunkFrac: 0.3, leader: 0.55, spread: 0.55, el0: 52, elR: 26, up: 0.08, card: 0.14, perM: 3.6, nMain: 5, rK: 0.03, moss: 0 }, bark: 'furrow', barkTint: '#8d8070', spray: 'olive' },
    pine:    { H: [10, 18], o: { trunkFrac: 0.6, leader: 0.9, spread: 0.24, el0: 48, elR: 34, up: 0.45, card: 0.075, perM: 3.8, nMain: 6, rK: 0.02, moss: 0.15 }, bark: 'plates', barkTint: '#d7a07a', spray: 'needle' },
    spruce:  { H: [14, 25], spruce: 1, bark: 'plates', barkTint: '#8f8074', spray: 'needle' },
    palm:    { H: [9, 16], palm: 1, bark: 'rings', barkTint: '#a09484', spray: 'palm' },
  };
  function broadTree(Rn, Ht, lod, o) {
    const wood = new GB(), fol = new GB(), rT = Ht * o.rK * (0.85 + Rn() * 0.3), wc = woodCol(o.moss || 0);
    const segT = [12, 7, 5][lod], segB = [6, 4, 3][lod], segS = [4, 3, 3][lod], top = Ht * o.leader, nT = [10, 6, 3][lod];
    const tp = spine(V(0, -0.6, 0), V((Rn() - 0.5) * 0.12, 1, (Rn() - 0.5) * 0.12), top + 0.6, nT, Rn, 0, 0.08);
    const bPh = Rn() * TAU;
    const flare = (th, y) => 1 + Math.exp(-Math.max(0, y) / (rT * (o.buttress ? 5 : 2.4))) * (o.buttress && lod < 2 ? 0.25 + 2.8 * Math.pow(Math.abs(Math.cos(th * 2.5 + bPh)), 8) : 0.5);
    tube(wood, tp, tp.map((p, i) => rT * (1 - 0.75 * (i / nT))), segT, { flare, uRep: Math.max(2, Math.round((TAU * rT) / 0.55)), vLen: 1.1, col: wc });
    const leafy = [], nMain = Math.max(3, o.nMain + ((Rn() * 2) | 0) - (lod === 2 ? 2 : 0));
    for (let b = 0; b < nMain; b++) {
      const y0 = Ht * lerp(o.trunkFrac, o.leader * 0.93, (b + Rn() * 0.8) / nMain), org = along(tp, (y0 + 0.6) / (top + 0.6));
      const az = b * 2.4 + Rn() * 0.8, el = ((o.el0 + Rn() * o.elR) * Math.PI) / 180, hf = clamp((y0 / Ht - o.trunkFrac) / (1 - o.trunkFrac), 0, 1);
      const dir = V(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az));
      const len = Ht * o.spread * (0.75 + Rn() * 0.5) * (1 - 0.5 * hf), bp = spine(org, dir, len, [5, 3, 2][lod], Rn, o.up, 0.3), rb = rT * (0.62 - 0.25 * hf);
      tube(wood, bp, bp.map((_, i) => rb * (1 - (0.85 * i) / (bp.length - 1)) + 0.012), segB, { uRep: 2, vLen: 1.1, col: wc });
      leafy.push({ pts: bp, t0: 0.4, len });
      const nSub = [4, 3, 2][lod];
      for (let s = 0; s < nSub; s++) {
        const ts = 0.3 + (0.62 * (s + Rn() * 0.7)) / nSub, o2 = along(bp, ts), bd = dirAt(bp, ts);
        const side = V(Rn() - 0.5, Rn() * 0.5, Rn() - 0.5); side.addScaledVector(bd, -side.dot(bd)).normalize();
        const d2 = bd.clone().multiplyScalar(0.6).add(side.multiplyScalar(0.8)).normalize(), l2 = len * (0.35 + Rn() * 0.3);
        const sp = spine(o2, d2, l2, [3, 2, 1][lod], Rn, o.up, 0.35);
        if (lod < 2) tube(wood, sp, sp.map((_, i) => rb * 0.42 * (1 - (0.8 * i) / (sp.length - 1)) + 0.006), segS, { uRep: 1, vLen: 1.1, col: wc });
        leafy.push({ pts: sp, t0: 0.1, len: l2 });
      }
    }
    leafy.push({ pts: tp.slice(Math.floor(tp.length * 0.6)), t0: 0, len: top * 0.4 });
    const c = V(0, 0, 0); let cnt = 0, crR = 0;
    for (const lb of leafy) for (const p of lb.pts) { c.add(p); cnt++; }
    c.divideScalar(cnt); for (const lb of leafy) for (const p of lb.pts) crR = Math.max(crR, p.distanceTo(c));
    const cs = Ht * o.card * [1, 1.5, 2.4][lod], per = o.perM * [1, 0.34, 0.1][lod] / (Ht * o.card / 1.5);
    const nrm = V(0, 0, 0), upv = V(0, 0, 0);
    for (const lb of leafy) {
      const n = Math.max(1, Math.round(lb.len * per));
      for (let k = 0; k < n; k++) {
        const t = lerp(lb.t0, 1, Math.pow(Rn(), 0.6)), p = along(lb.pts, t).add(V(Rn() - 0.5, Rn() - 0.5, Rn() - 0.5).multiplyScalar(cs * 0.7));
        const out = p.clone().sub(c); out.y *= 0.7; out.normalize();
        nrm.set(Rn() - 0.5, Rn() - 0.5, Rn() - 0.5).normalize().lerp(out, 0.35).normalize();
        upv.copy(out).add(dirAt(lb.pts, t)).addScaledVector(UP, 0.5);
        const s = cs * (0.7 + Rn() * 0.6); card(fol, p, s, s, nrm, upv, c, crR, { sq: 1.3 });
      }
    }
    return { wood: wood.geo(), fol: fol.geo() };
  }
  function spruceTree(Rn, Ht, lod) {
    const wood = new GB(), fol = new GB(), rT = Ht * 0.017 * (0.85 + Rn() * 0.3), nT = [8, 5, 3][lod], wc = woodCol(0.3);
    const tp = spine(V(0, -0.5, 0), V((Rn() - 0.5) * 0.04, 1, (Rn() - 0.5) * 0.04), Ht + 0.5, nT, Rn, 0, 0.02);
    tube(wood, tp, tp.map((_, i) => rT * (1 - 0.9 * (i / nT)) + 0.01), [10, 6, 4][lod], { flare: (th, y) => 1 + 0.5 * Math.exp(-Math.max(0, y) / (rT * 2.5)), uRep: Math.max(2, Math.round((TAU * rT) / 0.5)), vLen: 1.1, col: wc });
    const bare = Ht * (0.1 + Rn() * 0.18), dy = ([0.55, 0.95, 1.7][lod] * Ht) / 20, cs = Ht * 0.068 * [1, 1.35, 2][lod], nrm = V(0, 0, 0);
    for (let y = bare; y < Ht * 0.96; y += dy * (0.8 + Rn() * 0.4)) {
      const f = (y - bare) / (Ht - bare), len = (1 - f) * Ht * 0.3 * (0.85 + Rn() * 0.3) + 0.35, nb = [5, 4, 3][lod], org = along(tp, (y + 0.5) / (Ht + 0.5));
      for (let b = 0; b < nb; b++) {
        const az = (b / nb) * TAU + Rn() * 0.7 + y * 1.7, dir = V(Math.cos(az), lerp(-0.3, 0.3, f), Math.sin(az)).normalize();
        const bp = spine(org, dir, len, 2, Rn, -0.25 * (1 - f), 0.12);
        if (lod === 0) tube(wood, bp, [rT * 0.28 * (1 - f) + 0.015, 0.012, 0.005], 3, { uRep: 1, vLen: 1, col: wc });
        const nC = lod === 2 ? (b % 2 ? 0 : 1) : Math.max(1, Math.round(len / (cs * (lod ? 0.95 : 0.65))));
        for (let k = 0; k < nC; k++) {
          const t = (k + 0.6) / (nC + 0.2), p = along(bp, t), bd = dirAt(bp, t), side = V(-bd.z, 0, bd.x).normalize();
          nrm.crossVectors(bd, side).normalize(); if (nrm.y < 0) nrm.negate(); nrm.applyAxisAngle(bd, (Rn() - 0.5) * 1.0);
          const s = cs * (0.8 + Rn() * 0.4) * (0.75 + 0.5 * (1 - f));
          card(fol, p, s * 0.8, s * 1.15, nrm, bd, V(0, y - len * 0.5, 0), len + 0.5, { upN: 0.25 });
        }
      }
    }
    for (let k = 0; k < (lod === 2 ? 1 : 3); k++) { const a = (k / 3) * Math.PI; card(fol, V(0, Ht * 0.97, 0), cs * 0.6, cs * 1.2, V(Math.cos(a), 0, Math.sin(a)), UP, V(0, Ht * 0.8, 0), cs); }
    return { wood: wood.geo(), fol: fol.geo() };
  }
  function palmTree(Rn, Ht, lod) {
    const wood = new GB(), fol = new GB(), rT = clamp(Ht * 0.014, 0.08, 0.2), nT = [8, 5, 3][lod], la = Rn() * TAU, lean = 0.1 + Rn() * 0.25;
    const tp = spine(V(0, -0.4, 0), V(Math.cos(la) * lean, 1, Math.sin(la) * lean), Ht + 0.4, nT, Rn, 0.15, 0.03);
    tube(wood, tp, tp.map(() => rT), [9, 6, 4][lod], { flare: (th, y) => 1 + 0.6 * Math.exp(-Math.max(0, y) / 0.5), uRep: 2, vLen: 1, col: woodCol(0.4) });
    const topP = tp[tp.length - 1], nF = [15, 10, 7][lod], fl = clamp(Ht * 0.32, 1.4, 5), segs = [7, 4, 3][lod];
    for (let f = 0; f < nF; f++) {
      const az = f * 2.4 + Rn() * 0.5, el = lerp(0.35, 1.9, Math.pow(Rn(), 0.8)), d = V(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az));
      ribbon(fol, topP, d, fl * (0.8 + Rn() * 0.4), segs, (s) => 0.3 * Math.pow(Math.sin(Math.PI * (0.08 + 0.92 * s)), 0.7), 0.35 + Rn() * 0.4, Rn, { fold: 0.22, base: 0.55 });
    }
    return { wood: wood.geo(), fol: fol.geo() };
  }
  function shrubGeo(Rn, h, lod, o = {}) {
    const wood = new GB(), fol = new GB(), wc = woodCol(0);
    if (lod === 0 && o.stems !== 0) for (let k = 0; k < 4; k++) { const a = Rn() * TAU, sp = spine(V(0, -0.05, 0), V(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4), h * 0.7, 2, Rn, 0, 0.3); tube(wood, sp, [h * 0.02, h * 0.014, h * 0.006], 3, { col: wc }); }
    const c = V(0, h * 0.5, 0), rx = h * 0.62 * (o.wide || 1), ry = h * 0.5, n = Math.round((o.n || 34) * [1, 0.45, 0.22][lod]), cs = h * (o.card || 0.5) * [1, 1.35, 1.8][lod], nrm = V(0, 0, 0);
    for (let k = 0; k < n; k++) {
      let p; for (let t = 0; t < 20; t++) { p = V(Rn() * 2 - 1, Rn() * 2 - 1, Rn() * 2 - 1); if (p.lengthSq() < 1) break; }
      p.multiplyScalar(Math.pow(p.length(), -0.45) || 1); p.set(p.x * rx, Math.max(p.y * ry, -ry * 0.75), p.z * rx).add(c);
      const out = p.clone().sub(c).normalize(); nrm.set(Rn() - 0.5, Rn() - 0.5, Rn() - 0.5).normalize().lerp(out, 0.4).normalize();
      card(fol, p, cs * (0.75 + Rn() * 0.5), cs * (0.75 + Rn() * 0.5), nrm, out.clone().addScaledVector(UP, 0.8), c, Math.max(rx, ry), { dark: o.bright || 1 });
    }
    return { wood: wood.geo(), fol: fol.geo() };
  }
  function rosetteGeo(Rn, h, lod, o) { // ferns and big-leaved plants: fronds arching out of the middle
    const fol = new GB(), nF = Math.max(3, Math.round(o.n * [1, 0.6][Math.min(1, lod)])), segs = [5, 3][Math.min(1, lod)];
    for (let f = 0; f < nF; f++) {
      const az = f * 2.4 + Rn() * 0.6, el = lerp(o.el0, o.el1, Rn()), d = V(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az));
      ribbon(fol, V(0, 0, 0), d, h * (0.75 + Rn() * 0.5), segs, o.wK, o.droop * (0.7 + Rn() * 0.6), Rn, { fold: o.fold || 0.15, base: 0.55 });
    }
    return fol.geo();
  }
  function tuftGeo(Rn, n, h, cA, cB, spread, o = {}) { // blades of grass, reeds, heather, spinifex
    const pos = [], col = [], ca = new THREE.Color(cA), cb = new THREE.Color(cB), tip = o.tip ? new THREE.Color(o.tip) : null, seg = o.seg || 3;
    for (let b = 0; b < n; b++) {
      const a = Rn() * TAU, r = Math.sqrt(Rn()) * spread, x0 = Math.cos(a) * r, z0 = Math.sin(a) * r, hh = h * (0.5 + Rn() * 0.65);
      const lean = (o.lean || 0.35) * (0.4 + Rn() * 1.1) * (o.outward ? 0.4 + r / Math.max(1e-6, spread) : 1), la = o.outward ? a + (Rn() - 0.5) * 0.6 : Rn() * TAU, w = h * (o.w || 0.03) * (0.7 + Rn() * 0.6);
      const c = ca.clone().lerp(cb, Rn()); let prev = null;
      for (let s = 0; s <= seg; s++) {
        const f = s / seg, y = hh * f * (1 - 0.3 * lean * f), off = lean * hh * f * f * 0.7, cx = x0 + Math.cos(la) * off, cz = z0 + Math.sin(la) * off, ww = w * (1 - f * 0.85);
        const Lp = [cx - Math.sin(la) * ww, y, cz + Math.cos(la) * ww], Rp = [cx + Math.sin(la) * ww, y, cz - Math.cos(la) * ww];
        if (prev) { pos.push(...prev[0], ...prev[1], ...Lp, ...prev[1], ...Rp, ...Lp); const cc = (tip && f > 0.55 ? c.clone().lerp(tip, (f - 0.55) * 1.8) : c.clone()).multiplyScalar(0.45 + 0.55 * f); for (let k = 0; k < 6; k++) col.push(cc.r, cc.g, cc.b); }
        prev = [Lp, Rp];
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    // blades are lit mostly from above, like a meadow (not by their own random facing)
    const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) { const v = V(nr.getX(i), nr.getY(i), nr.getZ(i)); if (v.y < 0) v.negate(); v.lerp(UP, 0.55).normalize(); nr.setXYZ(i, v.x, v.y, v.z); }
    return g;
  }
  function clumpGeo(Rn, nC, o = {}) { // a clump of grass: crossed upright cards, each a tuft of many blades
    const gb = new GB(), nrm = V(0, 0, 0);
    for (let k = 0; k < nC; k++) {
      const a = (k / nC) * Math.PI + Rn() * 0.4, w = (o.w || 1.2) * (0.8 + Rn() * 0.4), h = 0.8 + Rn() * 0.4, off = V((Rn() - 0.5) * 0.25, 0, (Rn() - 0.5) * 0.25);
      nrm.set(Math.cos(a), 0, Math.sin(a)); const lean = V(Math.cos(a + 1.57), 0, Math.sin(a + 1.57)).multiplyScalar((Rn() - 0.5) * 0.3).add(UP).normalize();
      card(gb, off.clone().addScaledVector(lean, h * 0.5).setY(h * 0.48), w, h, nrm, lean, V(0, -0.6, 0), 1.2, { upN: 0.65 });
    }
    return gb.geo();
  }
  function rockGeo(sd, detail, o = {}) {
    const g = weld(THREE, new THREE.IcosahedronGeometry(1, detail)), p = g.attributes.position, v = V(0, 0, 0);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); const n = fbm(v.x * 1.4 + 5, v.y * 1.4, v.z * 1.4, sd, 4), n2 = fbm(v.x * 4, v.y * 4, v.z * 4, sd + 7, 2);
      v.multiplyScalar(0.68 + n * 0.62 + (n2 - 0.5) * 0.12); v.y *= o.flat || 0.7; if (v.y < -0.22) v.y = -0.22 - (v.y + 0.22) * 0.15;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const nr = g.attributes.normal, uv = [], col = [], moss = new THREE.Color(o.moss || '#6f8a4a'), cc = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      uv.push(p.getX(i) * 0.6 + p.getZ(i) * 0.35, p.getY(i) * 0.8 + p.getZ(i) * 0.5);
      const m = o.moss ? sstep(0.35, 0.85, nr.getY(i) + (fbm(p.getX(i) * 3, p.getY(i) * 3, p.getZ(i) * 3, sd + 3, 2) - 0.5) * 0.8) : 0, ao = 0.6 + 0.4 * sstep(-0.25, 0.3, p.getY(i));
      cc.setRGB(1, 1, 1).lerp(moss, m * 0.85).multiplyScalar(ao); col.push(cc.r, cc.g, cc.b);
    }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeBoundingSphere();
    return g;
  }
  // foliage keeps its crown-shaped normals on both faces (no dark backs), so a crown reads as one soft mass
  const foliageMat = (map, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ map, alphaTest: o.alphaTest || 0.42, side: THREE.DoubleSide, vertexColors: true, roughness: 0.8, metalness: 0, color: o.color || '#ffffff' });
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '')); };
    m.customProgramCacheKey = () => 'sl-foliage';
    return track(m);
  };
  const barkMat = (map, tint) => track(new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 1.5, roughness: 0.95, metalness: 0, vertexColors: true, color: tint }));

  // ---------- 1. the land ----------
  {
    const r0 = groundR * 0.9, nT = low ? 120 : 240, nR = low ? 44 : 96, nm = nearMesh.material;
    const cnt = (nT + 1) * (nR + 1), pos = new Float32Array(cnt * 3), uv = new Float32Array(cnt * 2), col = new Float32Array(cnt * 3);
    const dark = K.forest ? 0.78 : 0.92;
    for (let j = 0, k = 0; j <= nR; j++) {
      const r = r0 * Math.pow(rEnd / r0, j / nR);
      for (let i = 0; i <= nT; i++, k++) {
        const th = (i / nT) * TAU + (j % 2) * (Math.PI / nT) * 0, x = Math.cos(th) * r, z = Math.sin(th) * r, y = Hgt(x, z);
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = x / (2 * groundR) + 0.5; uv[k * 2 + 1] = 0.5 - z / (2 * groundR);
        // patches of lighter and darker ground, mossy hints in woods, wet dark bed under the river - fading in past the near ground
        const n1 = fbm(x / 9, z / 9, 7, seed + 101, 3), n2 = fbm(x / 23, z / 23, 9, seed + 107, 3), fade = sstep(groundR, groundR * 1.6, r);
        let cr = 1, cg = 1, cb = 1; const b = lerp(1, (0.8 + (n1 - 0.5) * 0.5 + (n2 - 0.5) * 0.35) * dark, fade);
        cr *= b; cg *= b; cb *= b;
        if (K.forest) { const m = sstep(0.55, 0.72, n2) * 0.5 * fade; cr *= 1 - m * 0.3; cg *= 1 + m * 0.05; cb *= 1 - m * 0.45; }
        if (K.under === 'grass' || K.under === 'meadow') { const m = sstep(0.45, 0.7, n1) * 0.35 * fade; cr *= 1 - m * 0.25; cb *= 1 - m * 0.4; }
        if (wi && y < -depth * 0.4) { cr *= 0.5; cg *= 0.5; cb *= 0.45; }
        if (K.mesas) { const s = sstep(1.5, 6, y); cr *= 1 - 0.18 * s; cg *= 1 - 0.28 * s; cb *= 1 - 0.3 * s; }
        col[k * 3] = cr; col[k * 3 + 1] = cg; col[k * 3 + 2] = cb;
      }
    }
    const idx = new Uint32Array(nT * nR * 6);
    for (let j = 0, k = 0; j < nR; j++) for (let i = 0; i < nT; i++) { const a = j * (nT + 1) + i, b = a + 1, c = a + nT + 1, d = c + 1; idx[k++] = a; idx[k++] = b; idx[k++] = c; idx[k++] = b; idx[k++] = d; idx[k++] = c; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    const mat = track(new THREE.MeshStandardMaterial({ map: nm.map, bumpMap: nm.bumpMap, bumpScale: nm.bumpScale, roughness: 0.97, metalness: 0, vertexColors: true }));
    const land = new THREE.Mesh(g, mat); land.receiveShadow = false; scene.add(land); track(g); addTris('land', idx.length / 3);
  }

  // ---------- 2. trees ----------
  const tint = (k0, k1, hueJ) => { const k = lerp(k0, k1, R()); return new THREE.Color(k * (1 + (R() - 0.5) * hueJ), k, k * (1 + (R() - 0.5) * hueJ * 1.4)); };
  const notWet = (x, z) => !inRiver(x, z, 1.5);
  if (K.trees) {
    const rT = farR * (K.forest ? (low ? 1.25 : 1.5) : (low ? 1.6 : 2.1)), sp = K.spacing * (low ? 1.3 : 1), lod0 = low ? 16 : 22, lod1 = low ? 42 : 58;
    const grove = (x, z) => !K.clump || sstep(K.clump - 0.04, K.clump + 0.04, fbm(x / 34, z / 34, 0, seed + 200, 3)) > R() || R() < 0.025;
    const nTry = Math.round((Math.PI * (rT * rT - groundR * groundR)) / (sp * sp) * (K.clump ? 0.6 : 1.05));
    const spots = scatter(nTry, groundR * 1.05 + 0.5, rT, sp * 0.72, (x, z) => notWet(x, z) && grove(x, z), 'area', 6);
    const types = K.trees, pick = () => { let u = R() * types.reduce((s, t) => s + t[1], 0); for (const t of types) { u -= t[1]; if (u <= 0) return t[0]; } return types[0][0]; };
    const nVar = low ? [2, 2, 1] : [3, 2, 2], groups = new Map();
    for (const p of spots) { const ty = pick(), lod = p.r < lod0 ? 0 : p.r < lod1 ? 1 : 2, v = (R() * nVar[lod]) | 0, key = ty + '|' + lod + '|' + v; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(p); }
    const mats = {};
    for (const [key, list] of groups) {
      const [ty, lodS, vS] = key.split('|'), lod = +lodS, T = TREE[ty], Rn = rng(seed + 3000 + ty.length * 97 + lod * 13 + +vS * 7), Ht = lerp(T.H[0], T.H[1], (+vS + 0.5) / nVar[lod] * 0.7 + Rn() * 0.3);
      const geo = T.palm ? palmTree(Rn, Ht, lod) : T.spruce ? spruceTree(Rn, Ht, lod) : broadTree(Rn, Ht, lod, T.o);
      if (!mats[ty]) mats[ty] = { bark: barkMat(tex.bark(T.bark), T.barkTint), fol: foliageMat(tex.spray(T.spray)) };
      const items = list.map((p) => ({ x: p.x, y: Hgt(p.x, p.z) - 0.05, z: p.z, ry: R() * TAU, rx: (R() - 0.5) * 0.05, rz: (R() - 0.5) * 0.05, s: 0.78 + R() * 0.4, col: null }));
      inst(geo.wood, mats[ty].bark, items.map((t) => ({ ...t, col: tint(0.85, 1.1, 0.06) })), { tag: 'trees' });
      inst(geo.fol, mats[ty].fol, items.map((t) => ({ ...t, col: tint(0.78, 1.12, ty === 'savanna' ? 0.2 : 0.14) })), { tag: 'trees' });
    }
    stats.treeCount = spots.length;
  }

  // ---------- 3. undergrowth, shrubs, grass, rocks, logs ----------
  const U = K.under, q = low ? 0.3 : 1, near0 = groundR * 0.9;
  const put = (name, makeGeo, mat, n, rMin, rMax, size, o = {}) => {
    const spots = scatter(Math.round(n * q), rMin, rMax, o.minD || 0, (x, z, r) => notWet(x, z) && (!o.ok || o.ok(x, z, r)), o.distr || 'lin', 8);
    if (!spots.length) return;
    const nv = o.variants || 2, lists = Array.from({ length: nv }, () => []);
    for (const p of spots) {
      const s = size[0] + (size[1] - size[0]) * R();
      if (o.span) { // long things (logs) lie along the slope, both ends on the ground
        const ry = R() * TAU, hl = o.span * s, c = Math.cos(ry), sn = Math.sin(ry), h1 = groundAt(p.x + c * hl, p.z - sn * hl), h2 = groundAt(p.x - c * hl, p.z + sn * hl);
        lists[(R() * nv) | 0].push({ x: p.x, y: (h1 + h2) / 2 + (o.lift || 0) * s, z: p.z, ry, rz: Math.atan2(h1 - h2, 2 * hl), s }); continue;
      }
      lists[(R() * nv) | 0].push({ x: p.x, y: groundAt(p.x, p.z) + (o.lift || 0) * s, z: p.z, ry: R() * TAU, rx: (R() - 0.5) * (o.tilt || 0.1), rz: (R() - 0.5) * (o.tilt || 0.1), s, sy: o.sy ? lerp(o.sy[0], o.sy[1], R()) : 1, col: o.col ? o.col() : null }); }
    lists.forEach((lst, v) => { if (!lst.length) return; const g = makeGeo(rng(seed + name.length * 131 + v * 17), v); if (g.wood) { inst(g.wood, o.wmat, lst, { tag: name }); inst(g.fol, mat, lst, { tag: name }); } else inst(g, mat, lst, { tag: name, cast: o.cast, recv: o.recv }); });
  };
  const grassMat = () => track(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.92, metalness: 0 }));
  const twigMat = () => barkMat(tex.bark('furrow'), '#8a7d6c');
  const rockStyle = { moss: ['#8d8a80', '#6f8a4a'], grey: ['#9a958a', null], red: ['#9a5a3e', null], sandstone: ['#b98e62', null], gibber: ['#6e3422', null] }[K.rock];
  const rockMat = track(new THREE.MeshStandardMaterial({ map: tex.rock(), bumpMap: tex.rock(), bumpScale: 2, roughness: 0.9, metalness: 0, vertexColors: true, color: rockStyle[0] }));
  const rocks = (n, rMin, rMax, size, o = {}) => put('rocks', (Rn, v) => rockGeo(seed + 500 + v * 11 + (o.detail != null ? 50 : 0), o.detail != null ? o.detail : low ? 2 : 3, { moss: rockStyle[1], flat: o.flat || 0.7 }), rockMat, n, rMin, rMax, size, { variants: 3, lift: -0.18, tilt: 0.4, col: () => tint(0.8, 1.1, 0.08), ...o });
  const fernW = (s) => 0.22 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.1 + s)), 0.8);
  if (U === 'forest' || U === 'jungle') {
    const jungle = U === 'jungle';
    put('ferns', (Rn, v) => rosetteGeo(Rn, 1, low ? 1 : 0, { n: 11, el0: 0.5, el1: 1.2, wK: fernW, droop: 0.45 }), foliageMat(tex.spray('fern')), jungle ? 170 : 140, near0, 38, [0.5, 1.1], { variants: 3, tilt: 0.15, col: () => tint(0.8, 1.1, 0.1) });
    put('shrubs', (Rn, v) => shrubGeo(Rn, 1, low ? 1 : 0, { n: 30 }), foliageMat(tex.spray(jungle ? 'tropic' : 'broad')), jungle ? 130 : 110, groundR * 1.05, 45, [0.8, 2.4], { variants: 2, wmat: twigMat(), col: () => tint(0.8, 1.1, 0.12) });
    if (jungle) {
      put('bigleaf', (Rn, v) => rosetteGeo(Rn, 1, low ? 1 : 0, { n: 7, el0: 0.35, el1: 1.1, wK: (s) => 0.36 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.04 + s * 0.98)), 0.7), droop: 0.3, fold: 0.1 }), foliageMat(tex.spray('bigleaf')), 220, near0, 36, [0.7, 1.6], { variants: 3, tilt: 0.15, col: () => tint(0.8, 1.1, 0.1) });
      put('palmlets', (Rn) => palmTree(Rn, 2.5 + Rn() * 2.5, low ? 2 : 1), foliageMat(tex.spray('palm')), 45, groundR * 1.1, 40, [0.8, 1.2], { variants: 2, wmat: barkMat(tex.bark('rings'), '#a09484') });
    }
    // fallen logs, mossy
    const logGeo = (Rn) => { const gb = new GB(), len = 2 + Rn() * 2.5, pts = []; for (let k = 0; k <= 6; k++) pts.push(V(-len / 2 + (len * k) / 6, 0, (Rn() - 0.5) * 0.15)); tube(gb, pts, pts.map((_, k) => 0.22 * (1 - k / 14)), low ? 7 : 12, { uRep: 3, vLen: 1, col: (y, t) => { const m = 0.4 + 0.3 * Math.sin(t * 9); return [lerp(1, 0.66, m), lerp(1, 0.86, m), lerp(1, 0.52, m)]; } }); return gb.geo(); };
    put('logs', logGeo, barkMat(tex.bark('furrow'), '#9a8e7c'), 14, groundR * 1.1, 40, [0.7, 1.3], { variants: 2, lift: 0.06, span: 1.5 });
    rocks(30, groundR * 1.05, 45, [0.3, 1.6]);
  } else if (U === 'meadow') {
    put('grass', (Rn) => clumpGeo(Rn, low ? 2 : 3), foliageMat(tex.spray('grassG'), { alphaTest: 0.35 }), 1700, near0, 36, [0.5, 1.1], { variants: 3, tilt: 0.12, col: () => tint(0.8, 1.12, 0.1) });
    put('shrubs', (Rn) => shrubGeo(Rn, 1, low ? 1 : 0, { n: 30 }), foliageMat(tex.spray('broad')), 60, groundR * 1.1, 45, [0.8, 2.2], { variants: 2, wmat: twigMat(), col: () => tint(0.8, 1.1, 0.12) });
    rocks(40, groundR * 1.0, 30, [0.2, 0.8]);
  } else if (U === 'grass') {
    put('grass', (Rn) => clumpGeo(Rn, low ? 2 : 3), foliageMat(tex.spray('grassD'), { alphaTest: 0.35 }), 3200, near0, 45, [0.6, 1.2], { variants: 3, tilt: 0.12, col: () => tint(0.8, 1.12, 0.1) });
    put('grass', (Rn) => clumpGeo(Rn, low ? 2 : 3), foliageMat(tex.spray('grassD'), { alphaTest: 0.35 }), 1600, 45, 90, [0.8, 1.4], { variants: 3, tilt: 0.12, col: () => tint(0.8, 1.12, 0.1) });
    put('shrubs', (Rn) => shrubGeo(Rn, 1, low ? 1 : 0, { n: 28 }), foliageMat(tex.spray('olive')), 70, groundR * 1.1, 60, [0.8, 2.0], { variants: 2, wmat: twigMat(), col: () => tint(0.8, 1.1, 0.12) });
    rocks(20, groundR * 1.0, 45, [0.3, 1.2]);
  } else if (U === 'heath') {
    put('heather', (Rn) => shrubGeo(Rn, 1, low ? 1 : 0, { n: 24, wide: 1.25, stems: 0, card: 0.55 }), foliageMat(tex.spray('heather')), 1100, near0, 45, [0.35, 0.8], { variants: 3, sy: [0.55, 0.85], lift: -0.12, col: () => tint(0.8, 1.15, 0.12) });
    put('grass', (Rn) => clumpGeo(Rn, low ? 2 : 3), foliageMat(tex.spray('grassG'), { alphaTest: 0.35 }), 800, near0, 40, [0.35, 0.7], { variants: 3, tilt: 0.12, col: () => tint(0.8, 1.12, 0.1) });
    put('shrubs', (Rn) => shrubGeo(Rn, 1, low ? 1 : 0, { n: 26, card: 0.45 }), foliageMat(tex.spray('needle')), 90, groundR * 1.1, 55, [0.7, 1.8], { variants: 2, wmat: twigMat(), col: () => tint(0.75, 1.0, 0.1) });
    rocks(30, groundR * 1.0, 50, [0.3, 1.5]);
  } else if (U === 'arid') {
    put('spinifex', (Rn) => tuftGeo(Rn, low ? 30 : 70, 0.55, '#8a8a52', '#c9b98a', 0.25, { lean: 0.9, w: 0.012, outward: 1 }), grassMat(), 500, near0, 50, [0.6, 1.4], { variants: 3, sy: [0.6, 0.9], col: () => tint(0.8, 1.1, 0.1) });
    put('shrubs', (Rn) => shrubGeo(Rn, 1, low ? 1 : 0, { n: 34, wide: 1.2, bright: 1.35 }), foliageMat(tex.spray('saltbush')), 160, groundR * 1.0, 60, [0.5, 1.4], { variants: 2, wmat: twigMat(), col: () => tint(0.85, 1.1, 0.08) });
    // outcrops: clusters of big boulders, and stones between
    const centres = scatter(Math.round(14 * (low ? 0.6 : 1)), groundR * 1.6, farR * 1.1, 10, null, 'area');
    const okNear = (x, z) => centres.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < 36);
    rocks(90, groundR * 1.3, farR * 1.15, [0.6, 3.8], { ok: okNear, minD: 1.2 });
    rocks(160, groundR * 1.0, 45, [0.08, 0.5], { variants: 2, detail: 1 });
  } else if (U === 'sand') {
    put('grass', (Rn) => clumpGeo(Rn, low ? 2 : 3), foliageMat(tex.spray('grassD'), { alphaTest: 0.35 }), 260, near0, 50, [0.35, 0.8], { variants: 3, tilt: 0.12, col: () => tint(0.8, 1.12, 0.1) });
    put('shrubs', (Rn) => shrubGeo(Rn, 1, low ? 1 : 0, { n: 30, wide: 1.3, bright: 1.35 }), foliageMat(tex.spray('saltbush')), 40, groundR * 1.1, 60, [0.4, 1.0], { variants: 2, wmat: twigMat(), col: () => tint(0.85, 1.1, 0.08) });
    rocks(16, groundR * 1.2, 60, [0.3, 1.4]);
  } else if (U === 'gibber') {
    rocks(2200, near0, 32, [0.04, 0.22], { variants: 3, lift: -0.2, flat: 0.55, recv: false, detail: 0 });
    put('shrubs', (Rn) => shrubGeo(Rn, 1, low ? 1 : 0, { n: 30, wide: 1.3, stems: 0, bright: 1.35 }), foliageMat(tex.spray('saltbush')), 140, groundR * 1.0, 60, [0.3, 0.8], { variants: 2, wmat: twigMat(), col: () => tint(0.85, 1.1, 0.08) });
    put('grass', (Rn) => clumpGeo(Rn, low ? 2 : 3), foliageMat(tex.spray('grassD'), { alphaTest: 0.35 }), 220, near0, 45, [0.25, 0.5], { variants: 3, tilt: 0.12, col: () => tint(0.8, 1.12, 0.1) });
    rocks(18, groundR * 1.3, 60, [0.3, 1.0]);
  }
  if (wi) { // reeds along both banks of the river beyond the near ground
    const tng = V(-wi.dir.y, 0, wi.dir.x), list = [];
    for (let k = 0; k < (low ? 120 : 420); k++) {
      const far = R() < 0.5, s = far ? wi.edge + riverW + (R() - 0.6) * 1.6 : wi.edge + (R() - 0.4) * 1.6, a = (R() - 0.5) * rEnd * 1.4;
      const x = wi.dir.x * s + tng.x * a, z = wi.dir.y * s + tng.z * a; if (Math.hypot(x, z) < groundR * 1.1) continue;
      list.push({ x, y: Hgt(x, z) - 0.05, z, ry: R() * TAU, s: 0.8 + R() * 0.6 });
    }
    inst(tuftGeo(rng(seed + 77), low ? 12 : 18, 1.5, '#55693a', '#a6a46a', 0.25, { w: 0.008, lean: 0.25 }), grassMat(), list, { tag: 'reeds' });
  }

  // ---------- 4. a carpet of real 3D fallen leaves ----------
  if (K.litter && (S.ground === 'litter' || S.ground === 'soil')) leafCarpet();
  function leafCarpet() {
    const dens = K.litter * (S.props && S.props.leaves ? Math.min(1.3, 0.5 + S.props.leaves * 0.5) : 0.5);
    const atlas = tex.litter(), mat = track(new THREE.MeshStandardMaterial({ map: atlas, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, metalness: 0 }));
    const len0 = clamp(0.035 + L * 0.025, 0.05, 0.16) * (kind === 'rainforest' ? 1.25 : 1);
    const rIn = clamp(Math.max(Rb * 3.2, len0 * 14), 0, groundR * 0.6), rOut = groundR * 1.1;
    const leafA = 0.3 * len0 * len0, capIn = (low ? 900 : 3600) * Math.min(1, dens), capOut = (low ? 2400 : 9000) * Math.min(1, dens);
    const nIn = Math.round(Math.min(capIn, ((Math.PI * rIn * rIn * 1.7) / leafA) * dens)), dIn = nIn / (Math.PI * rIn * rIn);
    const nOut = Math.round(Math.min(capOut, dIn * TAU * rIn * (rOut - rIn)));
    let poseR = 0; for (const p of poseInfo.pts) poseR = Math.max(poseR, Math.hypot(p[0], p[1]));
    poseR += F.w0 * 2 + len0;
    const clear = (x, z, l) => Math.hypot(x, z) > poseR + l || dist2snake(x, z) > F.w0 * 0.6 + l * 0.45;
    const pal = kind === 'soil' ? ['#5a4532', '#6b5236', '#4a3826', '#7a6044', '#584430', '#6e5a40']
      : ['#7a5532', '#94683a', '#a8804a', '#5e4128', '#6f4f2c', '#b08850', '#4f3a22', '#8c6a42', '#6b5536', '#9a7a4e', '#5e5032', '#86663f'];
    if (kind === 'rainforest') pal.push('#6f6a3a', '#857a40', '#5c5a30', '#8a6a3a');
    // leaf shapes x curl: detailed near the snake, simpler further out (and fewer triangles on phones)
    const det = [], simp = [];
    for (let sh = 0; sh < 4; sh++) {
      det.push(litterGeo(sh, low ? 2 : 4, low ? 2 : 3, 0.09, 0.05, 0.03), litterGeo(sh, low ? 2 : 4, low ? 2 : 3, 0.24, 0.1, -0.05));
      simp.push(low ? litterGeo(sh, 1, 1, 0, 0, 0) : litterGeo(sh, 2, 2, 0.12, 0.06, 0));
    }
    const bucketsD = det.map(() => []), bucketsS = simp.map(() => []);
    const qy = new THREE.Quaternion(), qx = new THREE.Quaternion(), qz = new THREE.Quaternion(), X = V(1, 0, 0), Z = V(0, 0, 1), cc = new THREE.Color();
    const addLeaf = (x, z, detailed) => {
      const sh = (R() * 4) | 0, l = len0 * (0.6 + R() * 0.8) * [1, 0.95, 1.2, 1.05][sh];
      if (!clear(x, z, l)) return false;
      const gi = detailed ? sh * 2 + (R() < 0.45 ? 1 : 0) : sh, geo = detailed ? det[gi] : simp[gi], flip = R() < 0.3;
      qy.setFromAxisAngle(UP, R() * TAU); qx.setFromAxisAngle(X, (flip ? Math.PI : 0) + (R() - 0.5) * 0.35); qz.setFromAxisAngle(Z, (R() - 0.5) * 0.3);
      qq.copy(qy).multiply(qx).multiply(qz);
      const y = groundAt(x, z) + l * (0.012 + R() * 0.05) + (flip ? geo.userData.maxY * l : 0);
      pv.set(x, y, z); sv.set(l, l, l); m4.compose(pv, qq, sv);
      cc.set(pal[(R() * pal.length) | 0]).multiplyScalar(0.82 + R() * 0.3);
      (detailed ? bucketsD : bucketsS)[gi].push([m4.clone(), cc.clone()]); return true;
    };
    for (let i = 0; i < nIn; i++) for (let t = 0; t < 6; t++) { const a = R() * TAU, r = rIn * Math.sqrt(R()); if (addLeaf(Math.cos(a) * r, Math.sin(a) * r, true)) break; }
    for (let i = 0; i < nOut; i++) for (let t = 0; t < 4; t++) { const a = R() * TAU, r = lerp(rIn, rOut, R()); if (addLeaf(Math.cos(a) * r, Math.sin(a) * r, r < rIn * 1.6 && !low)) break; }
    const mk = (geos, buckets, cast) => geos.forEach((g, i) => {
      const b = buckets[i]; if (!b.length) { g.dispose(); return; }
      const im = new THREE.InstancedMesh(g, mat, b.length); b.forEach(([mm, c], k) => { im.setMatrixAt(k, mm); im.setColorAt(k, c); });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.castShadow = cast; im.receiveShadow = true; scene.add(im); track(g);
      addTris('leaves', (g.index.count / 3) * b.length);
    });
    mk(det, bucketsD, !low); mk(simp, bucketsS, false);
    stats.leafCount = bucketsD.reduce((s, b) => s + b.length, 0) + bucketsS.reduce((s, b) => s + b.length, 0);
  }
  function litterGeo(cell, nu, nv, cup, bend, twist) {
    const pos = [], uv = [], idx = [], u0 = (cell % 2) * 0.5, v0 = 0.5 - Math.floor(cell / 2) * 0.5;
    let minY = 1e9, maxY = -1e9;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const fx = i / nu - 0.5, fz = j / nv - 0.5, y = cup * (2 * fz) ** 2 + bend * (2 * fx) ** 2 + twist * fx * fz * 4;
      pos.push(fx, y, fz); uv.push(u0 + 0.01 + (i / nu) * 0.48, v0 + 0.01 + (1 - j / nv) * 0.48); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    for (let k = 1; k < pos.length; k += 3) pos[k] -= minY;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    g.userData.maxY = maxY - minY; return g;
  }

  // ---------- 5. haze: gentle, and only far away; the sky's horizon matches it ----------
  const fogCol = new THREE.Color(S.fog);
  if (K.haze) fogCol.lerp(new THREE.Color(K.haze), 0.5);
  else fogCol.lerp(A.gcol.clone().multiplyScalar(0.8), 0.28); // a touch of the land's own colour, so far hills never go pale
  if (scene.fog) {
    scene.fog.color.copy(fogCol); scene.background = scene.fog.color;
    ctx.fogNear0 = Math.max(ctx.fogNear0 || 0, groundR * 1.15);
    const far = K.forest ? farR * 1.45 : farR * 2.9; ctx.farR = far / 0.95; scene.fog.near = ctx.fogNear0; scene.fog.far = far;
  }
  const sk = ctx.skyMesh;
  if (sk && sk.geometry.attributes.color) {
    const p = sk.geometry.attributes.position, c = sk.geometry.attributes.color, rad = sk.geometry.parameters.radius || 1, top = new THREE.Color(S.sky[0]), t = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / rad; t.copy(fogCol).lerp(top, sstep(0, 0.5, y)); c.setXYZ(i, t.r, t.g, t.b); }
    c.needsUpdate = true;
  }
  if (wi && water) { const k = rEnd / groundR; water.scale.set(k, 1, k); const nmap = water.material.normalMap; if (nmap) nmap.repeat.multiplyScalar(k); }
  stats.total = Object.keys(stats).filter((k) => !/Count|total/.test(k)).reduce((s, k) => s + stats[k], 0);
  if (typeof window !== 'undefined' && window.SL_3D_TEST) window.__natureStats = stats;
}

// height of a RingGeometry ground (rotated flat) at x, z, read straight from its vertices
function ringSampler(mesh) {
  const g = mesh.geometry, P = g.parameters, pos = g.attributes.position;
  if (!P || P.thetaSegments == null || P.innerRadius !== 0) return null;
  const nt = P.thetaSegments, np = P.phiSegments, R0 = P.outerRadius;
  const Y = (j, i) => pos.getY(j * (nt + 1) + i);
  return (x, z) => {
    const r = Math.hypot(x, z); let th = Math.atan2(-z, x); if (th < 0) th += TAU;
    const fi = (th / TAU) * nt, fj = Math.min(np - 1e-6, (r / R0) * np), i = Math.min(nt - 1, Math.floor(fi)), j = Math.floor(fj), a = fi - i, b = fj - j;
    return (Y(j, i) * (1 - a) + Y(j, i + 1) * a) * (1 - b) + (Y(j + 1, i) * (1 - a) + Y(j + 1, i + 1) * a) * b;
  };
}
function weld(THREE, g) {
  const p = g.attributes.position, map = new Map(), pos = [], idx = [];
  for (let i = 0; i < p.count; i++) { const k = Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4); let j = map.get(k); if (j == null) { j = pos.length / 3; map.set(k, j); pos.push(p.getX(i), p.getY(i), p.getZ(i)); } idx.push(j); }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setIndex(idx); g.dispose(); return o;
}

// ---------- procedural textures (drawn once per scene, cached by name) ----------
function makeTextures(THREE, rng, fbm, seed, track) {
  const cache = new Map(), once = (k, f) => { if (!cache.has(k)) cache.set(k, track(f())); return cache.get(k); };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const canvasTex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  // see-through textures: the clear pixels take the average leaf colour, so distant (mip-mapped) edges don't go dark
  const alphaTex = (c) => {
    const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data, out = new Uint8Array(w * h * 4);
    let sr = 0, sg = 0, sb = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++; }
    n = Math.max(1, n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = ((h - 1 - y) * w + x) * 4, o = (y * w + x) * 4;
      if (d[s + 3] < 8) { out[o] = sr / n; out[o + 1] = sg / n; out[o + 2] = sb / n; out[o + 3] = 0; } else { out[o] = d[s]; out[o + 1] = d[s + 1]; out[o + 2] = d[s + 2]; out[o + 3] = d[s + 3]; }
    }
    const t = new THREE.DataTexture(out, w, h, THREE.RGBAFormat); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; t.needsUpdate = true; return t;
  };
  const leafPath = (x, l, w) => { x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(l * 0.25, -w * 0.62, l * 0.7, -w * 0.52, l, 0); x.bezierCurveTo(l * 0.7, w * 0.52, l * 0.25, w * 0.62, 0, 0); x.closePath(); };
  const shade = (hex, k) => { const v = parseInt(hex.slice(1), 16); return 'rgb(' + [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => Math.max(0, Math.min(255, Math.round(c * k)))).join(',') + ')'; };
  const SPR = {
    broad: { pal: ['#3c5a26', '#4a6b2c', '#56782f', '#2f4a20', '#66843a', '#44622a', '#587a34'], l: [44, 66], w: 0.48, tw: 6 },
    tropic: { pal: ['#2f5224', '#3b6328', '#254a1e', '#4a7030', '#35582a'], l: [58, 84], w: 0.42, tw: 5 },
    olive: { pal: ['#5f6e3a', '#6e7c44', '#58663a', '#7d8a52', '#4f5e32'], l: [26, 40], w: 0.4, tw: 7 },
    heather: { pal: ['#3c4426', '#4a5230', '#5a4048', '#6e4a62', '#34401f', '#7a5272'], l: [12, 20], w: 0.5, tw: 9 },
    saltbush: { pal: ['#7f8a6c', '#8f9a7e', '#6f7a60', '#9aa38a', '#76806a'], l: [26, 38], w: 0.62, tw: 9, twig: '#7a7262' },
    needle: { pal: ['#263f22', '#2f4a28', '#3a5530', '#22381e', '#34502c'], needle: 1, tw: 7 },
  };
  function sprayCanvas(style) {
    const P = SPR[style], Rn = rng(seed + 900 + style.length * 31), S = 512, [c, x] = mk(S, S);
    const twigs = [], main = []; let px = S / 2, py = S - 6, a = -Math.PI / 2 + (Rn() - 0.5) * 0.2;
    for (let k = 0; k < 24; k++) { main.push([px, py]); a += (Rn() - 0.5) * 0.12; px += Math.cos(a) * 20; py += Math.sin(a) * 20; if (py < 40) break; }
    twigs.push({ pts: main, w: 5 });
    for (let k = 0; k < P.tw; k++) {
      const i0 = Math.floor(main.length * (0.12 + 0.75 * (k + Rn() * 0.6) / P.tw)), side = k % 2 ? 1 : -1, pts = []; let [qx, qy] = main[i0], b = -Math.PI / 2 + side * (0.6 + Rn() * 0.5);
      const len = (main.length - i0) * 20 * (0.45 + Rn() * 0.3) + 60;
      for (let s = 0; s < len; s += 16) { pts.push([qx, qy]); b -= side * 0.05; qx += Math.cos(b) * 16; qy += Math.sin(b) * 16; if (qx < 30 || qx > S - 30 || qy < 30) break; }
      if (pts.length > 1) twigs.push({ pts, w: 2.5 });
    }
    x.lineCap = 'round';
    for (const t of twigs) { x.strokeStyle = P.twig || '#4a3a2a'; x.lineWidth = t.w; x.beginPath(); t.pts.forEach(([u, v], i) => (i ? x.lineTo(u, v) : x.moveTo(u, v))); x.stroke(); }
    const walk = (fn, step) => { for (const t of twigs) { let acc = 0; for (let i = 1; i < t.pts.length; i++) { const [x0, y0] = t.pts[i - 1], [x1, y1] = t.pts[i], dl = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0); for (let s = 0; s < dl; s += step) { acc++; fn(x0 + (x1 - x0) * (s / dl), y0 + (y1 - y0) * (s / dl), ang, acc, i / t.pts.length); } } } };
    if (P.needle) {
      walk((u, v, ang, k) => { for (const sd of [-1, 1]) { const l = 16 + Rn() * 12, an = ang + sd * (0.7 + Rn() * 0.4); x.strokeStyle = shade(P.pal[(Rn() * P.pal.length) | 0], 0.8 + Rn() * 0.5); x.lineWidth = 2.2; x.beginPath(); x.moveTo(u, v); x.lineTo(u + Math.cos(an) * l, v + Math.sin(an) * l); x.stroke(); } }, 3.2);
    } else {
      for (const layer of [0, 1]) walk((u, v, ang, k, f) => {
        if (Rn() < 0.35) return;
        const sd = k % 2 ? 1 : -1, l = (P.l[0] + Rn() * (P.l[1] - P.l[0])) * (layer ? 1 : 1.1), w = l * P.w, an = ang + sd * (0.55 + Rn() * 0.5), col = P.pal[(Rn() * P.pal.length) | 0], lit = (layer ? 0.9 + Rn() * 0.45 : 0.6 + Rn() * 0.25) * (P.twig ? 1.15 : 1);
        x.save(); x.translate(u, v); x.rotate(an); leafPath(x, l, w);
        const g = x.createLinearGradient(0, -w / 2, 0, w / 2); g.addColorStop(0, shade(col, lit * 1.15)); g.addColorStop(1, shade(col, lit * 0.8)); x.fillStyle = g; x.fill();
        if (!P.twig) { x.strokeStyle = 'rgba(20,30,10,.35)'; x.lineWidth = 1; x.stroke(); }
        x.strokeStyle = 'rgba(230,240,190,.22)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(1, 0); x.lineTo(l * 0.92, 0); x.stroke();
        x.restore();
      }, layer ? 24 : 30);
    }
    return c;
  }
  function grassCanvas(dry) { // a tuft of blades, bases together at the bottom
    const Rn = rng(seed + 1300 + (dry ? 1 : 0)), W = 256, H = 256, [c, x] = mk(W, H);
    const pal = dry ? ['#8a8450', '#a39a62', '#c2b47a', '#7a7a44', '#b8a870', '#6f7440'] : ['#4f6a2c', '#5d7a34', '#6f8a3c', '#8a9a52', '#47602a', '#a3a46a'];
    x.lineCap = 'round';
    for (let k = 0; k < 120; k++) {
      const x0 = W / 2 + (Rn() - 0.5) * 70, h = H * (0.45 + Rn() * 0.52), bend = (Rn() - 0.5) * 140, col = pal[(Rn() * pal.length) | 0], lit = 0.75 + Rn() * 0.45;
      const g = x.createLinearGradient(0, H, 0, H - h); g.addColorStop(0, shade(col, lit * 0.55)); g.addColorStop(1, shade(col, lit * 1.1));
      x.strokeStyle = g; x.lineWidth = 2 + Rn() * 2.5; x.beginPath(); x.moveTo(x0, H); x.quadraticCurveTo(x0 + bend * 0.3, H - h * 0.6, x0 + bend, H - h); x.stroke();
    }
    return c;
  }
  function frondCanvas(kind) { // palm, fern and big leaf, drawn base at the bottom
    const Rn = rng(seed + 1200 + kind.length), W = 256, H = kind === 'bigleaf' ? 512 : 1024, [c, x] = mk(W, H), cx = W / 2;
    x.lineCap = 'round';
    if (kind === 'bigleaf') {
      const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#2a4a1e'); g.addColorStop(0.5, '#3f6a2a'); g.addColorStop(1, '#2c4c20');
      x.fillStyle = g; x.beginPath(); x.moveTo(cx, H - 4); x.bezierCurveTo(-30, H * 0.7, 10, H * 0.15, cx, 6); x.bezierCurveTo(W - 10, H * 0.15, W + 30, H * 0.7, cx, H - 4); x.fill();
      x.strokeStyle = 'rgba(210,230,160,.35)'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx, H - 4); x.lineTo(cx, 10); x.stroke();
      x.lineWidth = 1.5; for (let y = H - 40; y > 40; y -= 26) for (const sd of [-1, 1]) { x.beginPath(); x.moveTo(cx, y); x.quadraticCurveTo(cx + sd * 50, y - 20, cx + sd * 100, y - 50); x.stroke(); }
      for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(${Rn() < 0.5 ? '255,255,220' : '0,20,0'},${0.04 + Rn() * 0.05})`; x.beginPath(); x.arc(Rn() * W, Rn() * H, 6 + Rn() * 20, 0, Math.PI * 2); x.fill(); }
      x.globalCompositeOperation = 'destination-in'; x.beginPath(); x.moveTo(cx, H - 4); x.bezierCurveTo(-30, H * 0.7, 10, H * 0.15, cx, 6); x.bezierCurveTo(W - 10, H * 0.15, W + 30, H * 0.7, cx, H - 4); x.fill(); x.globalCompositeOperation = 'source-over';
      return c;
    }
    const palm = kind === 'palm', pal = palm ? ['#3d5a28', '#4a6a2e', '#36522a', '#56733a'] : ['#3f6a2c', '#4d7a34', '#5a8a3c', '#467030'];
    x.strokeStyle = palm ? '#6a6a3a' : '#4a5a2a'; x.lineWidth = palm ? 7 : 4; x.beginPath(); x.moveTo(cx, H); x.lineTo(cx, 8); x.stroke();
    for (let y = H - 30; y > 16; y -= palm ? 13 : 22) {
      const f = 1 - y / H, len = (palm ? 122 : 116) * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + f * 0.95)), 0.7);
      for (const sd of [-1, 1]) {
        const col = pal[(Rn() * pal.length) | 0], ex = cx + sd * len, ey = y - len * (palm ? 0.55 : 0.3);
        if (palm) { x.strokeStyle = shade(col, 0.85 + Rn() * 0.35); x.lineWidth = 6 * (1 - f * 0.5); x.beginPath(); x.moveTo(cx, y); x.quadraticCurveTo(cx + sd * len * 0.5, y - len * 0.45, ex, ey + 8); x.stroke(); }
        else for (let s = 0.12; s < 1; s += 0.11) { const lx = cx + sd * len * s, ly = y - len * 0.3 * s, r = 9 * (1 - s * 0.6); x.fillStyle = shade(col, 0.85 + Rn() * 0.3); x.beginPath(); x.ellipse(lx, ly - 2, r * 0.9, r * 0.55, sd * 0.5 - 0.3, 0, Math.PI * 2); x.fill(); }
      }
    }
    return c;
  }
  function barkCanvas(style) {
    const Rn = rng(seed + 1500 + style.length * 13), W = 256, H = 512, [c, x] = mk(W, H);
    const wrap = (fn) => { for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) { x.save(); x.translate(ox, oy); fn(); x.restore(); } };
    const baseCol = { furrow: '#6e6152', smooth: '#857f72', plates: '#6a5546', rings: '#7a6c5a' }[style];
    x.fillStyle = baseCol; x.fillRect(0, 0, W, H);
    for (let k = 0; k < 900; k++) { const u = Rn() * W, v = Rn() * H, l = 10 + Rn() * 70, col = Rn() < 0.5 ? `rgba(30,22,14,${0.1 + Rn() * 0.15})` : `rgba(200,190,170,${0.06 + Rn() * 0.1})`, w = 1 + Rn() * 3; wrap(() => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(u, v); x.lineTo(u + (Rn() - 0.5) * 4, v + l); x.stroke(); }); }
    if (style === 'furrow') for (let k = 0; k < 26; k++) {
      let u = Rn() * W; const pts = []; for (let v = -20; v < H + 20; v += 10) { u += (Rn() - 0.5) * 7; pts.push([u, v]); }
      const w = 2 + Rn() * 5;
      wrap(() => { x.strokeStyle = 'rgba(25,18,12,.85)'; x.lineWidth = w; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke(); x.strokeStyle = 'rgba(190,180,160,.25)'; x.lineWidth = 1.5; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a + w, b) : x.moveTo(a + w, b))); x.stroke(); });
    }
    if (style === 'plates') for (let v = 0; v < H; v += 26 + Rn() * 20) for (let u = Rn() * 30; u < W; u += 30 + Rn() * 24) {
      const w = 22 + Rn() * 20, h = 18 + Rn() * 22, col = shade(['#9a6a4a', '#8a6a52', '#7a5a44', '#a07858'][(Rn() * 4) | 0], 0.85 + Rn() * 0.3);
      wrap(() => { x.fillStyle = 'rgba(20,14,10,.8)'; x.fillRect(u - 2, v - 2, w + 4, h + 4); x.fillStyle = col; x.beginPath(); x.moveTo(u, v + Rn() * 4); x.lineTo(u + w, v + Rn() * 4); x.lineTo(u + w - Rn() * 4, v + h); x.lineTo(u + Rn() * 4, v + h); x.fill(); });
    }
    if (style === 'rings') for (let v = 0; v < H; v += 16 + Rn() * 10) { x.strokeStyle = 'rgba(30,22,14,.6)'; x.lineWidth = 2 + Rn() * 3; x.beginPath(); x.moveTo(0, v); for (let u = 0; u <= W; u += 16) x.lineTo(u, v + (Rn() - 0.5) * 3); x.stroke(); }
    if (style === 'smooth' || style === 'furrow') for (let k = 0; k < 50; k++) { const u = Rn() * W, v = Rn() * H, r = 4 + Rn() * 18, col = Rn() < 0.6 ? `rgba(120,140,90,${0.15 + Rn() * 0.2})` : `rgba(170,170,150,${0.12 + Rn() * 0.15})`; wrap(() => { x.fillStyle = col; x.beginPath(); x.ellipse(u, v, r, r * (0.6 + Rn() * 0.6), 0, 0, Math.PI * 2); x.fill(); }); }
    return c;
  }
  function rockCanvas() {
    const S = 256, [c, x] = mk(S, S), img = x.createImageData(S, S), Rn = rng(seed + 1700), f = (u, v) => fbm(u * 6, v * 6, 0.5, seed + 1701, 4);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const u = i / S, v = j / S, n = f(u, v) * (1 - u) * (1 - v) + f(u - 1, v) * u * (1 - v) + f(u, v - 1) * (1 - u) * v + f(u - 1, v - 1) * u * v;
      const g = 150 + (n - 0.5) * 230 + (Rn() - 0.5) * 26, k = (j * S + i) * 4; img.data[k] = g; img.data[k + 1] = g * 0.97; img.data[k + 2] = g * 0.92; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    for (let k = 0; k < 40; k++) { let u = Rn() * S, v = Rn() * S; x.strokeStyle = `rgba(20,15,10,${0.2 + Rn() * 0.3})`; x.lineWidth = 0.8 + Rn() * 1.5; x.beginPath(); x.moveTo(u, v); for (let s = 0; s < 6; s++) { u += (Rn() - 0.5) * 30; v += (Rn() - 0.5) * 30; x.lineTo(u, v); } x.stroke(); }
    for (let k = 0; k < 120; k++) { x.fillStyle = Rn() < 0.5 ? `rgba(0,0,0,${0.08 + Rn() * 0.1})` : `rgba(255,250,230,${0.05 + Rn() * 0.08})`; x.beginPath(); x.arc(Rn() * S, Rn() * S, 1 + Rn() * 4, 0, Math.PI * 2); x.fill(); }
    return c;
  }
  function litterCanvas() { // four kinds of fallen leaf (oak, beech, willow/eucalypt, maple) in a 2 x 2 atlas, pale - tinted per leaf
    const S = 512, [c, x] = mk(S, S), Rn = rng(seed + 1900);
    const outline = (cell) => {
      const pts = [], N = 64;
      if (cell === 3) { for (let k = 0; k <= N * 2; k++) { const a = (k / (N * 2)) * Math.PI * 2, r = 100 * (0.42 + 0.58 * Math.pow(Math.abs(Math.cos(2.5 * a + Math.PI / 2)), 0.55)) * (1 + 0.06 * Math.sin(a * 30)); pts.push([Math.cos(a) * r * 1.05 + 6, Math.sin(a) * r]); } return pts; }
      const half = (t, sd) => {
        if (cell === 0) return 46 * Math.pow(Math.sin(Math.PI * t), 0.6) * (0.6 + 0.4 * Math.abs(Math.sin(Math.PI * t * 4.5 + (sd > 0 ? 0 : 0.4))));
        if (cell === 1) return 50 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.75) + 1.8 * Math.sin(t * 70);
        return 22 * Math.pow(Math.sin(Math.PI * t), 1.1);
      };
      const bow = (t) => (cell === 2 ? 22 * Math.sin(Math.PI * t) - 11 : 0);
      for (let k = 0; k <= N; k++) { const t = k / N; pts.push([-112 + 224 * t, bow(t) - half(t, 1)]); }
      for (let k = N; k >= 0; k--) { const t = k / N; pts.push([-112 + 224 * t, bow(t) + half(t, -1)]); }
      return pts;
    };
    for (let cell = 0; cell < 4; cell++) {
      const pts = outline(cell); x.save(); x.translate((cell % 2) * 256 + 128, Math.floor(cell / 2) * 256 + 128);
      const path = () => { x.beginPath(); pts.forEach(([u, v], i) => (i ? x.lineTo(u, v) : x.moveTo(u, v))); x.closePath(); };
      // petiole
      x.strokeStyle = '#8a7a64'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(cell === 3 ? 0 : -108, cell === 2 ? -11 : 0); x.lineTo(-124, cell === 2 ? -14 : 2); x.stroke();
      path(); x.fillStyle = '#ece3d2'; x.fill(); x.save(); path(); x.clip();
      for (let k = 0; k < 70; k++) { const u = (Rn() - 0.5) * 230, v = (Rn() - 0.5) * 230, r = 6 + Rn() * 30, g = x.createRadialGradient(u, v, 0, u, v, r); const dk = Rn() < 0.6; g.addColorStop(0, dk ? `rgba(60,40,20,${0.12 + Rn() * 0.22})` : `rgba(255,250,235,${0.15 + Rn() * 0.2})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(u - r, v - r, r * 2, r * 2); }
      x.strokeStyle = 'rgba(70,45,22,.45)'; x.lineWidth = 9; path(); x.stroke();
      x.strokeStyle = 'rgba(90,60,30,.5)'; x.lineWidth = 3; x.beginPath();
      if (cell === 3) { for (let k = 0; k < 5; k++) { const a = Math.PI + (k - 2) * 1.05; x.moveTo(6, 0); x.lineTo(6 + Math.cos(a + Math.PI) * 95, Math.sin(a + Math.PI) * 95); } }
      else { const bw = (t) => (cell === 2 ? 22 * Math.sin(Math.PI * t) - 11 : 0); for (let k = 0; k <= 20; k++) { const t = k / 20; k ? x.lineTo(-112 + 224 * t, bw(t)) : x.moveTo(-112, bw(0)); } }
      x.stroke(); x.lineWidth = 1.3; x.strokeStyle = 'rgba(90,60,30,.35)'; x.beginPath();
      if (cell !== 3) for (let t = 0.1; t < 0.92; t += cell === 2 ? 0.07 : 0.1) for (const sd of [-1, 1]) { const u = -112 + 224 * t, v = cell === 2 ? 22 * Math.sin(Math.PI * t) - 11 : 0; x.moveTo(u, v); x.lineTo(u + 30, v + sd * (cell === 2 ? 16 : 40)); }
      x.stroke();
      for (let k = 0; k < 5; k++) { x.fillStyle = `rgba(40,25,12,${0.3 + Rn() * 0.3})`; x.beginPath(); x.arc((Rn() - 0.5) * 140, (Rn() - 0.5) * 50, 2 + Rn() * 5, 0, Math.PI * 2); x.fill(); }
      x.globalCompositeOperation = 'destination-out'; for (let k = 0; k < (cell === 1 ? 3 : 1); k++) { x.beginPath(); x.arc((Rn() - 0.5) * 120, (Rn() - 0.5) * 40, 3 + Rn() * 6, 0, Math.PI * 2); x.fill(); } x.globalCompositeOperation = 'source-over';
      x.restore(); x.restore();
    }
    return c;
  }
  return {
    spray: (style) => once('spray-' + style, () => alphaTex(style === 'grassG' || style === 'grassD' ? grassCanvas(style === 'grassD') : style === 'palm' || style === 'fern' || style === 'bigleaf' ? frondCanvas(style) : sprayCanvas(style))),
    bark: (style) => once('bark-' + style, () => canvasTex(barkCanvas(style))),
    rock: () => once('rock', () => canvasTex(rockCanvas())),
    litter: () => once('litter', () => alphaTex(litterCanvas())),
  };
}
