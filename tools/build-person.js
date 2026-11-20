// Builds species/3d/person.bin: the 1.70 m person of the 3D viewer's "Size vs person".
// v5.83: the person is the Microsoft Rocketbox avatar "Male_Adult_05" (a photo-scanned head with a real face, hair made
// of strand cards, a field shirt, vest and trousers; MIT licence, https://github.com/microsoft/Microsoft-Rocketbox).
// It replaces SnakeList's own sculpted person (the old tools/build-person.js is in git history), which Eduardo said
// "looks like a 5 year old made a human with clay". The avatar is posed here (arms relaxed at the sides, hands turned
// to the thighs), its skinned mesh baked to a still mesh, plus one blend shape: the eyelids shut (for blinking).
//
// Run (dev only), with Playwright + Chromium available:
//   1. put Male_Adult_05.fbx (Assets/Avatars/Adults/Male_Adult_05/Export/) in a folder <dir>, with three r160's
//      examples/jsm/loaders/FBXLoader.js, libs/fflate.module.js, curves/NURBSCurve.js, curves/NURBSUtils.js flattened
//      into <dir>/jsm/ (their relative imports changed to ./)
//   2. node tools/build-person.js <dir>          -> species/3d/person.bin
//   3. python3 tools/person_textures.py <dir with the m009_*.tga textures>   -> species/3d/person/*.webp
// Format of person.bin ('SLP2'): u32 JSON length, JSON { h, nv, nt, lo, hi, uvlo, uvhi, groups: [[start, count, mat]],
// mats, blink: { n, k }, eyes, chest }, padded to 4; then positions u16 x3 (in lo..hi), normals i8 x4, uvs u16 x2 (in
// uvlo..uvhi), indices u16 (padded to 4), the blink's vertex numbers u16 (padded) and its moves i16 x3 (padded), times k.
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const dir = path.resolve(process.argv[2] || '.'), root = path.join(__dirname, '..');
const H = 1.7;

const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/three.module.min.js"}}</script>
<script type="module">
import * as THREE from 'three'; import { FBXLoader } from '/jsm/FBXLoader.js';
const mgr = new THREE.LoadingManager(); mgr.setURLModifier((u) => /\\.tga$/i.test(u) ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' : u);
window.THREE = THREE; window.load = (n) => new Promise((res, rej) => new FBXLoader(mgr).load(n, (o) => { window.obj = o; res(o); }, undefined, rej)); window.ready = true;
</script>`;

// in the page: pose, bake, blend shape
function bakeInPage() {
  const THREE = window.THREE, o = window.obj; o.updateMatrixWorld(true);
  let mesh = null; o.traverse((c) => { if (c.isSkinnedMesh) mesh = c; });
  const B = {}; o.traverse((c) => { if (c.isBone) B[c.name] = c; });
  const wq = (b) => b.getWorldQuaternion(new THREE.Quaternion()), wp = (b) => b.getWorldPosition(new THREE.Vector3());
  const aimBone = (b, c, d) => { // turn bone b so that its child c lies along world direction d
    o.updateMatrixWorld(true);
    const cur = wp(c).sub(wp(b)).normalize(), q = new THREE.Quaternion().setFromUnitVectors(cur, d.clone().normalize()), pq = b.parent ? wq(b.parent) : new THREE.Quaternion();
    b.quaternion.copy(pq.clone().invert().multiply(q).multiply(wq(b))); o.updateMatrixWorld(true);
  };
  for (const sd of ['L', 'R']) {
    const ua = B['Bip01_' + sd + '_UpperArm'], fa = B['Bip01_' + sd + '_Forearm'], hd = B['Bip01_' + sd + '_Hand'], sx = Math.sign(wp(ua).x);
    aimBone(ua, fa, new THREE.Vector3(sx * 0.2, -1, -0.04)); aimBone(fa, hd, new THREE.Vector3(sx * 0.1, -1, 0.22)); aimBone(hd, B['Bip01_' + sd + '_Finger2'], new THREE.Vector3(sx * 0.05, -1, 0.12));
  }
  const g = mesh.geometry, n = g.attributes.position.count, pa = g.attributes.position, na = g.attributes.normal, v = new THREE.Vector3(), w = new THREE.Vector3();
  const bake = () => {
    o.updateMatrixWorld(true); mesh.skeleton.update(); const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pa, i); w.copy(v).addScaledVector(new THREE.Vector3().fromBufferAttribute(na, i), 0.5); mesh.applyBoneTransform(i, v); mesh.applyBoneTransform(i, w); v.applyMatrix4(mesh.matrixWorld); w.applyMatrix4(mesh.matrixWorld); pos.set([v.x, v.y, v.z], i * 3); w.sub(v).normalize(); nor.set([w.x, w.y, w.z], i * 3); }
    return { pos, nor };
  };
  const base = bake();
  for (const s of ['L', 'R']) for (const [nm, k] of [['Top', -1], ['Bottom', 0.25]]) { const b = B['Bip01_' + s + 'EyeBlink' + nm], p = wp(b).add(new THREE.Vector3(0, k, 0.08 * Math.abs(k))); b.parent.worldToLocal(p); b.position.copy(p); }
  const shut = bake(), idx = [], d = [];
  for (let i = 0; i < n; i++) { const dx = shut.pos[i * 3] - base.pos[i * 3], dy = shut.pos[i * 3 + 1] - base.pos[i * 3 + 1], dz = shut.pos[i * 3 + 2] - base.pos[i * 3 + 2]; if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 0.002) { idx.push(i); d.push(dx, dy, dz); } }
  const J = (nm) => wp(B[nm]).toArray();
  return { pos: Array.from(base.pos), nor: Array.from(base.nor), uv: Array.from(g.attributes.uv.array), groups: g.groups, mats: [].concat(mesh.material).map((m) => m.name), blink: { idx, d }, eyes: [J('Bip01_LEye'), J('Bip01_REye')], chest: J('Bip01_Spine2') };
}

(async () => {
  const types = { '.js': 'text/javascript', '.fbx': 'application/octet-stream', '.html': 'text/html' };
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]); let f;
    if (u === '/') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(PAGE); }
    if (u === '/three.module.min.js') f = path.join(root, 'species/3d/three.module.min.js'); else f = path.join(dir, u);
    if (!f.startsWith(dir) && !f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  }).listen(0, '127.0.0.1');
  await new Promise((res) => srv.on('listening', res));
  const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
  const br = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pg = await br.newPage(); await pg.goto('http://127.0.0.1:' + srv.address().port + '/'); await pg.waitForFunction(() => window.ready);
  await pg.evaluate(() => window.load('/Male_Adult_05.fbx'));
  const r = await pg.evaluate(bakeInPage); await br.close(); srv.close();
  write(r);
})().catch((e) => { console.error(e); process.exit(1); });

function write(r) {
  const n0 = r.pos.length / 3;
  // metres, 1.70 m from the soles to the top of the hair, standing on y = 0 centred on x = z = 0, facing +z
  let y0 = 1e9, y1 = -1e9; for (let i = 0; i < n0; i++) { y0 = Math.min(y0, r.pos[i * 3 + 1]); y1 = Math.max(y1, r.pos[i * 3 + 1]); }
  const k = H / (y1 - y0), tf = (p) => [p[0] * k, (p[1] - y0) * k, p[2] * k];
  for (let i = 0; i < n0; i++) { const p = tf(r.pos.slice(i * 3, i * 3 + 3)); r.pos[i * 3] = p[0]; r.pos[i * 3 + 1] = p[1]; r.pos[i * 3 + 2] = p[2]; }
  for (let i = 0; i < r.blink.d.length; i++) r.blink.d[i] *= k;
  // triangles sorted by material; corners welded (same place, normal and uv)
  const tris = []; for (const gr of r.groups) for (let t = gr.start; t < gr.start + gr.count; t += 3) tris.push([gr.materialIndex, t]);
  tris.sort((a, b) => a[0] - b[0]);
  const key = new Map(), map = new Int32Array(n0), V = [], idx = [];
  for (let i = 0; i < n0; i++) { const kk = [0, 1, 2].map((c) => Math.round(r.pos[i * 3 + c] * 2e4)).concat([0, 1, 2].map((c) => Math.round(r.nor[i * 3 + c] * 50)), [Math.round(r.uv[i * 2] * 1e4), Math.round(r.uv[i * 2 + 1] * 1e4)]).join(','); let j = key.get(kk); if (j == null) { j = V.length; key.set(kk, j); V.push(i); } map[i] = j; }
  const groups = []; let cur = -1;
  for (const [m, t] of tris) { if (m !== cur) { groups.push([idx.length, 0, m]); cur = m; } idx.push(map[t], map[t + 1], map[t + 2]); groups[groups.length - 1][1] += 3; }
  const nv = V.length, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], uvlo = [1e9, 1e9], uvhi = [-1e9, -1e9];
  for (const i of V) { for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], r.pos[i * 3 + c]); hi[c] = Math.max(hi[c], r.pos[i * 3 + c]); } for (let c = 0; c < 2; c++) { uvlo[c] = Math.min(uvlo[c], r.uv[i * 2 + c]); uvhi[c] = Math.max(uvhi[c], r.uv[i * 2 + c]); } }
  const pos = new Uint16Array(nv * 3), nor = new Int8Array(nv * 4), uv = new Uint16Array(nv * 2);
  V.forEach((i, j) => { for (let c = 0; c < 3; c++) { pos[j * 3 + c] = Math.round(((r.pos[i * 3 + c] - lo[c]) / (hi[c] - lo[c])) * 65535); nor[j * 4 + c] = Math.round(Math.max(-1, Math.min(1, r.nor[i * 3 + c])) * 127); } for (let c = 0; c < 2; c++) uv[j * 2 + c] = Math.round(((r.uv[i * 2 + c] - uvlo[c]) / (uvhi[c] - uvlo[c])) * 65535); });
  // the blink, on the welded vertices
  const bl = new Map(); r.blink.idx.forEach((i, q) => bl.set(map[i], [r.blink.d[q * 3], r.blink.d[q * 3 + 1], r.blink.d[q * 3 + 2]]));
  let bm = 0; for (const d of bl.values()) for (const x of d) bm = Math.max(bm, Math.abs(x));
  const bk = bm / 32000, bi = new Uint16Array(bl.size), bd = new Int16Array(bl.size * 3); let q = 0; for (const [j, d] of bl) { bi[q] = j; for (let c = 0; c < 3; c++) bd[q * 3 + c] = Math.round(d[c] / bk); q++; }
  const meta = { h: H, nv, nt: idx.length / 3, lo, hi, uvlo, uvhi, groups, mats: r.mats.map((m) => /head/.test(m) ? 'head' : /opacity/.test(m) ? 'hair' : 'body'), blink: { n: bl.size, k: bk }, eyes: r.eyes.map(tf), chest: tf(r.chest), src: 'Microsoft Rocketbox Male_Adult_05 (MIT)' };
  const pad = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
  const js = Buffer.from(JSON.stringify(meta)), jsP = Buffer.concat([js, Buffer.alloc((4 - ((8 + js.length) % 4)) % 4, 32)]), hd = Buffer.alloc(8); hd.write('SLP2', 0); hd.writeUInt32LE(jsP.length, 4);
  const buf = Buffer.concat([hd, jsP, pad(Buffer.from(pos.buffer)), Buffer.from(nor.buffer), pad(Buffer.from(uv.buffer)), pad(Buffer.from(new Uint16Array(idx).buffer)), pad(Buffer.from(bi.buffer)), pad(Buffer.from(bd.buffer))]);
  const file = path.join(root, 'species', '3d', 'person.bin'); fs.writeFileSync(file, buf); console.log('wrote', file, buf.length, 'bytes', nv, 'vertices', idx.length / 3, 'triangles');
}
