// SnakeList 3D viewer extras (v4.81): the things you can *do* with a model, kept apart from viewer.js
// (which builds the snake and its surroundings). mount() in viewer.js calls create(V) once and then:
//   fx.onBuild()  after every (re)build of the scene      fx.reset()   before the scene is thrown away
//   fx.step()     every frame, after the jaw has moved    fx.camera()  after the orbit camera is placed
//   fx.after()    after rendering (screen-space labels)   fx.dispose() when the viewer closes
// What lives here: a "rig" that bends the body along any path (slithering, striking, coiling, swallowing),
// the automatic shows (See bite, See it eat, See eye shield), Slither, the see-through Anatomy, a real-looking
// person for "Size vs person", the side panel (Compare photo / See countries) and double-click zoom.

let THREE = null;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
function rnd(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- styles (shared by species pages and the app)
const CSS = `
.sp3d-row{position:relative;display:flex;gap:8px;min-height:0}
.sp3d-row>.sp3d-stage{flex:1 1 auto;min-width:0}
.sl3d-host .sp3d-wrap>.sp3d-row,.sl3d-host .sp3d-row{flex:1 1 auto}
.sp3d-wrap:fullscreen .sp3d-row,.sp3d-max .sp3d-row{flex:1 1 auto}
.sp3d-side{flex:0 0 min(44%,460px);display:flex;flex-direction:column;border:1px solid var(--line);border-radius:14px;background:var(--bg);overflow:hidden;min-height:0;min-width:0}
.sp3d-side[hidden]{display:none}
.sp3d-side-hd{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 12px;border-bottom:1px solid var(--line);font:700 14px/1.3 Inter,system-ui,sans-serif;color:var(--text)}
.sp3d-side-hd span{flex:1;min-width:0}
.sp3d-side-x{flex:none;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--text);font-size:20px;line-height:1;cursor:pointer}
.sp3d-side-b{flex:1 1 auto;min-height:0;position:relative;display:flex;flex-direction:column}
.sp3d-side figure{margin:0;flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.sp3d-side figure img,.sp3d-side figure .sp3d-ph{flex:1 1 auto;min-height:0;width:100%;height:100%;object-fit:contain;background:#0f1a13 center/contain no-repeat;display:block}
.sp3d-side figcaption{flex:none;font:12px/1.4 Inter,system-ui,sans-serif;color:var(--muted);padding:6px 10px}
.sp3d-side iframe{flex:1 1 auto;display:block;width:100%;height:100%;min-height:260px;border:0;background:var(--card)}
.sp3d-side .sp3d-none2{padding:16px;font-size:14px;color:var(--muted)}
@media (max-width:640px){.sp3d-row{flex-direction:column}.sp3d-side{flex:0 0 auto;height:min(52vh,430px)}.sp3d-wrap:fullscreen .sp3d-side,.sp3d-max .sp3d-side{height:45%}}
.sp3d-hdb{display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;margin-right:auto}
.sp3d-b.sp3d-hb{min-height:32px;padding:4px 10px;font-size:12.5px;display:inline-flex;align-items:center;gap:5px}
.sp3d-hb svg,.sp3d-fs svg{width:15px;height:15px;flex:none}
.sp3d-fs{display:inline-flex;align-items:center;gap:6px}
.sl3d-hd h2{flex:0 1 auto}
@media (max-width:640px){.sp-rl-hd,.sl3d-hd{flex-wrap:wrap}.sp-rl-hd .sp3d-hdb,.sl3d-hd .sp3d-hdb{order:3;flex-basis:100%}}
.sp3d-b:disabled{opacity:.6;cursor:default}
.sp3d-capt{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);width:max-content;max-width:min(92%,580px);padding:8px 14px;border-radius:12px;background:rgba(12,26,18,.88);color:#fff;font:500 14px/1.45 Inter,system-ui,sans-serif;text-align:center;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.3);transition:opacity .35s}
.sp3d-capt[hidden]{display:none}.sp3d-capt b{color:#ffd66b}
.sp3d-step{position:absolute;right:10px;top:10px;padding:3px 10px;border-radius:999px;background:rgba(12,26,18,.8);color:#fff;font:600 12px/1.5 Inter,system-ui,sans-serif;pointer-events:none}
.sp3d-step[hidden]{display:none}
.sp3d-hl{position:absolute;left:0;top:0;border:3px solid #ffd54a;border-radius:12px;box-shadow:0 0 0 2px rgba(0,0,0,.45),inset 0 0 0 1px rgba(0,0,0,.35);pointer-events:none}
.sp3d-hl[hidden],.sp3d-info[hidden],.sp3d-reg[hidden],.sp3d-list[hidden]{display:none}
.sp3d-info{position:absolute;left:0;top:0;width:min(270px,70%);padding:9px 12px 10px;border-radius:12px;background:rgba(12,26,18,.92);color:#fff;font:13px/1.45 Inter,system-ui,sans-serif;pointer-events:auto;border:2px solid #ffd54a;box-shadow:0 4px 14px rgba(0,0,0,.35)}
.sp3d-info h4{margin:0 26px 3px 0;font:700 14.5px/1.3 Inter,system-ui,sans-serif;color:#ffd54a}.sp3d-info p{margin:0}
.sp3d-info .sp3d-ix,.sp3d-list .sp3d-ix{position:absolute;right:5px;top:5px;width:26px;height:26px;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:16px;line-height:1;cursor:pointer}
.sp3d-reg{position:absolute;left:0;top:0;display:flex;align-items:center;gap:6px;padding:3px 4px 3px 10px;border-radius:999px;background:rgba(12,26,18,.86);border:2px solid #9be07c;color:#fff;font:700 12.5px/1.3 Inter,system-ui,sans-serif;pointer-events:auto;white-space:nowrap;transform:translate(-50%,-100%)}
.sp3d-reg button{font:600 11.5px/1.2 Inter,system-ui,sans-serif;padding:4px 9px;border-radius:999px;border:0;background:#9be07c;color:#10261a;cursor:pointer}
.sp3d-ring{position:absolute;left:0;top:0;border:2px dashed #9be07c;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%)}
.sp3d-ring[hidden]{display:none}
.sp3d-list{position:absolute;left:8px;top:8px;max-height:calc(100% - 16px);overflow:auto;width:min(240px,48%);background:rgba(12,26,18,.9);color:#fff;border-radius:12px;padding:8px 8px 6px;pointer-events:auto;border:2px solid #9be07c;font:13px/1.4 Inter,system-ui,sans-serif}
.sp3d-list h4{margin:0 30px 6px 4px;font:700 14px/1.3 Inter,system-ui,sans-serif;color:#9be07c}
.sp3d-list button.sp3d-li{display:block;width:100%;text-align:left;margin:0 0 3px;padding:5px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font:500 12.5px/1.3 Inter,system-ui,sans-serif;cursor:pointer}
.sp3d-list button.sp3d-li:hover,.sp3d-list button.sp3d-li[aria-current=true]{border-color:#ffd54a;background:rgba(255,213,74,.16)}
.sp3d-tip{position:absolute;left:8px;bottom:8px;max-width:calc(100% - 16px);padding:4px 10px;border-radius:999px;background:rgba(12,26,18,.8);color:#fff;font:500 12px/1.4 Inter,system-ui,sans-serif;pointer-events:none}
.sp3d-tip[hidden]{display:none}
@media (max-width:560px){.sp3d-list{width:min(175px,46%);max-height:calc(100% - 120px);font-size:12px}.sp3d-list button.sp3d-li{font-size:11.5px;padding:4px 6px}.sp3d-capt{font-size:12.5px;padding:6px 10px;bottom:8px}.sp3d-info{font-size:12px;width:min(230px,78%)}}
`;
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('sp3d-x-css')) return;
  const s = document.createElement('style'); s.id = 'sp3d-x-css'; s.textContent = CSS; document.head.appendChild(s);
}
const ICON = {
  full: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  exit: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  photo: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg>',
  map: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
};

// ---------------------------------------------------------------- small texture and geometry helpers
function canvasTex(S, draw, repX = 1, repY = 1) {
  const c = document.createElement('canvas'); c.width = c.height = S; draw(c.getContext('2d'), S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repX, repY); t.anisotropy = 4; return t;
}
function speckle(base, n, k, seed, S = 256, strokes) {
  const R = rnd(seed);
  return canvasTex(S, (x, s) => {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) {
      const v = (R() - 0.5) * k, c = v > 0 ? `rgba(255,240,225,${v})` : `rgba(40,20,10,${-v})`;
      x.fillStyle = c; x.strokeStyle = c;
      if (strokes) { const px = R() * s, py = R() * s, l = s * (0.02 + R() * 0.05); x.lineWidth = 0.6 + R(); x.beginPath(); x.moveTo(px, py); x.lineTo(px + (R() - 0.5) * l * 0.4, py + l); x.stroke(); }
      else { x.beginPath(); x.arc(R() * s, R() * s, 0.5 + R() * 1.8, 0, TAU); x.fill(); }
    }
  });
}
function skinMat(color = '#c8906f', seed = 7) {
  return new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: speckle(color, 2600, 0.16, seed), roughness: 0.55, sheen: 0.45, sheenRoughness: 0.45, sheenColor: new THREE.Color('#ff9f86'), clearcoat: 0.06, clearcoatRoughness: 0.6 });
}
function fabricMat(color, seed = 3, rough = 0.92) {
  const t = canvasTex(128, (x, s) => {
    x.fillStyle = color; x.fillRect(0, 0, s, s); const R = rnd(seed);
    for (let i = 0; i < s; i += 2) { x.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.05})`; x.fillRect(0, i, s, 1); x.fillStyle = `rgba(255,255,255,${0.03 + R() * 0.03})`; x.fillRect(i, 0, 1, s); }
  }, 6, 6);
  return new THREE.MeshStandardMaterial({ color: '#ffffff', map: t, roughness: rough, metalness: 0 });
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function lathe(profile, seg = 28) { return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), seg); }
// a tube that follows a list of points, its radius varying along it (r(t), t in 0..1); ends rounded off
function varTube(pts, rf, radial = 10, seg = 48, closedEnds = true) {
  const curve = new THREE.CatmullRomCurve3(pts), frames = curve.computeFrenetFrames(seg, false), pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, p = curve.getPointAt(t), N = frames.normals[i], B = frames.binormals[i];
    let r = rf(t); if (closedEnds) r *= Math.pow(Math.sin(Math.PI * clamp(t, 0.0001, 0.9999)), 0.28);
    for (let j = 0; j <= radial; j++) { const a = (j / radial) * TAU; pos.push(p.x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * r, p.y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * r, p.z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * r); }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function mergeG(list) { // position + normal (+ optional per-vertex x in userData.xs)
  let n = 0, ni = 0; for (const g of list) { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), xs = new Float32Array(n), idx = new Uint32Array(ni); let o = 0, oi = 0;
  for (const g of list) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const c = g.attributes.position.count; pos.set(g.attributes.position.array.subarray(0, c * 3), o * 3); nrm.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
    if (g.userData.xs) xs.set(g.userData.xs, o); else xs.fill(g.userData.x || 0, o, o + c);
    if (g.index) { for (let k = 0; k < g.index.count; k++) idx[oi++] = g.index.array[k] + o; } else for (let k = 0; k < c; k++) idx[oi++] = o + k;
    o += c; g.dispose();
  }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); m.setIndex(new THREE.BufferAttribute(idx, 1)); m.userData.xs = xs; return m;
}
function disposeTree(o) {
  o.traverse((q) => { if (q.geometry) q.geometry.dispose(); const ms = Array.isArray(q.material) ? q.material : q.material ? [q.material] : []; for (const m of ms) { for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); } m.dispose(); } });
  if (o.parent) o.parent.remove(o);
}
function fadeTree(o, op) { o.traverse((q) => { if (q.material && q.userData.op != null) { q.material.opacity = q.userData.op * op; q.material.transparent = true; q.material.depthWrite = op > 0.98 && q.userData.op >= 1; q.visible = op > 0.005; } }); }
function markFade(o) { o.traverse((q) => { if (q.material && q.userData.op == null) q.userData.op = q.material.opacity != null ? q.material.opacity : 1; }); }

// ---------------------------------------------------------------- a real-looking person 1.5 m tall (for "Size vs person")
// Built in metres for h = 1.5 (scaled for other heights), standing on y = 0 and facing +z. Proportions of a
// slim adult/teenager about 7 heads tall: T-shirt, jeans, trainers, skin with soft sheen, hair, a simple face.
export function buildPerson(T, h = 1.5) {
  THREE = THREE || T;
  const k = h / 1.5, g = new THREE.Group();
  const skin = skinMat('#c58e6c', 11), shirt = fabricMat('#3d6f8e', 5), jeans = fabricMat('#34435f', 9, 0.86);
  const shoe = new THREE.MeshStandardMaterial({ color: '#efeee9', roughness: 0.6 }), sole = new THREE.MeshStandardMaterial({ color: '#4a4a4a', roughness: 0.8 });
  const hair = new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.7, map: speckle('#3a2618', 3000, 0.25, 21, 256, true) });
  const add = (geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x * k, y * k, z * k); m.scale.set(sx * k, sy * k, sz * k); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const S = (r, w = 24, hh = 16) => new THREE.SphereGeometry(r, w, hh);
  for (const sg of [-1, 1]) {
    // legs in jeans: ankle, calf, knee, thigh, hip (lathe around y)
    add(lathe([[0.043, 0.075], [0.05, 0.12], [0.058, 0.28], [0.052, 0.4], [0.054, 0.45], [0.07, 0.6], [0.079, 0.74], [0.08, 0.8]]), jeans, sg * 0.082, 0, 0, 1, 1, 0.92);
    // trainers
    add(S(1, 20, 12), shoe, sg * 0.082, 0.04, 0.035, 0.05, 0.042, 0.125);
    add(new THREE.CylinderGeometry(1, 1, 1, 20), sole, sg * 0.082, 0.009, 0.035, 0.052, 0.018, 0.128);
    // arms: short sleeve, bare upper arm, elbow, forearm, hand (hanging slightly out from the body)
    const arm = new THREE.Group(); arm.position.set(sg * 0.19 * k, 1.205 * k, 0); arm.rotation.z = sg * 0.07; g.add(arm);
    const a = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x * k, y * k, z * k); m.scale.set(sx * k, sy * k, sz * k); m.rotation.set(rx, 0, rz); m.castShadow = true; arm.add(m); return m; };
    a(lathe([[0.0, 0.02], [0.05, 0.0], [0.056, -0.06], [0.05, -0.13], [0.047, -0.15]].reverse()), shirt, 0, 0, 0);
    a(lathe([[0.037, -0.12], [0.036, -0.2], [0.032, -0.26], [0.033, -0.29], [0.036, -0.34], [0.031, -0.43], [0.024, -0.5], [0.022, -0.52]].reverse()), skin, 0, 0, 0, 1, 1, 0.9);
    const hand = new THREE.Group(); hand.position.set(0, -0.52 * k, 0.004 * k); arm.add(hand);
    const hm = (geo, x, y, z, sx, sy, sz, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, skin); m.position.set(x * k, y * k, z * k); m.scale.set(sx * k, sy * k, sz * k); m.rotation.set(rx, 0, rz); m.castShadow = true; hand.add(m); return m; };
    hm(S(1, 16, 12), 0, -0.045, 0, 0.022, 0.05, 0.034);           // palm
    for (let f = 0; f < 4; f++) hm(new THREE.CapsuleGeometry(1, 3.4, 4, 8), 0, -0.1 - (f === 1 || f === 2 ? 0.006 : 0), -0.022 + f * 0.0145, 0.0072, 0.0105, 0.0072, -0.08 + f * 0.05, 0); // fingers
    hm(new THREE.CapsuleGeometry(1, 3, 4, 8), 0.004 * sg, -0.06, 0.03, 0.008, 0.011, 0.008, 0.6, 0);   // thumb
  }
  // hips and belt
  add(S(1, 28, 14), jeans, 0, 0.8, 0, 0.165, 0.1, 0.105);
  add(new THREE.CylinderGeometry(1, 1, 1, 28, 1, true), new THREE.MeshStandardMaterial({ color: '#2a1d14', roughness: 0.5 }), 0, 0.865, 0, 0.158, 0.03, 0.104);
  // torso in a T-shirt
  add(lathe([[0.15, 0.84], [0.152, 0.92], [0.148, 1.0], [0.162, 1.09], [0.172, 1.16], [0.17, 1.205], [0.13, 1.235], [0.075, 1.255], [0.05, 1.262]]), shirt, 0, 0, 0, 1, 1, 0.64);
  add(new THREE.TorusGeometry(0.047, 0.006, 8, 24), shirt, 0, 1.258, 0.004, 1, 1, 0.9, Math.PI / 2);
  // neck and head
  add(new THREE.CylinderGeometry(0.041, 0.046, 0.1, 18), skin, 0, 1.3, -0.004);
  add(S(1, 32, 24), skin, 0, 1.4, 0, 0.081, 0.104, 0.094);                  // skull and face
  add(S(1, 20, 14), skin, 0, 1.346, 0.024, 0.06, 0.045, 0.06);               // jaw and chin
  add(new THREE.ConeGeometry(0.012, 0.03, 10), skin, 0, 1.393, 0.094, 1, 1, 1, Math.PI / 2 + 0.15); // nose
  for (const sg of [-1, 1]) {
    add(S(1, 12, 10), skin, sg * 0.08, 1.395, -0.004, 0.012, 0.024, 0.016);  // ears
    add(S(0.0105, 14, 10), new THREE.MeshStandardMaterial({ color: '#f4efe8', roughness: 0.25 }), sg * 0.031, 1.414, 0.078);
    add(S(0.0062, 12, 8), new THREE.MeshStandardMaterial({ color: '#3b2516', roughness: 0.2 }), sg * 0.031, 1.414, 0.087);
    add(new THREE.BoxGeometry(0.03, 0.005, 0.008), hair, sg * 0.032, 1.432, 0.084, 1, 1, 1, 0, 0, sg * -0.12); // eyebrows
  }
  add(new THREE.BoxGeometry(0.03, 0.005, 0.006), new THREE.MeshStandardMaterial({ color: '#a8645a', roughness: 0.5 }), 0, 1.358, 0.083); // lips
  const hg = new THREE.SphereGeometry(1, 32, 18, 0, TAU, 0, Math.PI * 0.56); add(hg, hair, 0, 1.408, -0.006, 0.087, 0.108, 0.1, -0.3); // hair
  add(S(1, 20, 14), hair, 0, 1.39, -0.05, 0.08, 0.09, 0.06);                 // hair at the back
  return g;
}

// ---------------------------------------------------------------- prey models (forward = +z, up = +y, centre at origin)
// r is the body radius; each animal gets its natural proportions from it
function buildPrey(kind, r, seed) {
  const g = new THREE.Group(); let len = r * 4;
  const S = (rad, w = 22, h = 14) => new THREE.SphereGeometry(rad, w, h);
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const along = (geo) => geo.rotateX(Math.PI / 2); // lathe axis y -> z
  if (kind === 'mouse' || kind === 'rat') {
    len = r * (kind === 'rat' ? 4.6 : 4.1);
    const fur = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: speckle(kind === 'rat' ? '#7d6a58' : '#9a8571', 5200, 0.42, seed, 256, true), roughness: 0.95, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#d8c4ad') });
    const pink = new THREE.MeshStandardMaterial({ color: '#d99a95', roughness: 0.55 }), black = new THREE.MeshPhysicalMaterial({ color: '#0b0908', roughness: 0.08, clearcoat: 1 });
    const P = [[0, -0.5], [0.42, -0.47], [0.78, -0.36], [0.96, -0.15], [0.98, 0.05], [0.88, 0.2], [0.68, 0.3], [0.6, 0.36], [0.56, 0.42], [0.42, 0.5], [0.22, 0.56], [0.06, 0.6], [0, 0.605]];
    add(along(lathe(P.map(([a, b]) => [a * r, b * len]), 30)), fur, 0, r * 0.95, 0, 1, 0.88, 1);
    add(S(r * 0.09), pink, 0, r * 0.97, len * 0.6);                                    // nose
    for (const sg of [-1, 1]) {
      add(S(r * 0.1, 14, 10), black, sg * r * 0.33, r * 1.25, len * 0.43);              // eyes
      const ear = add(S(r * 0.3, 16, 10), fur, sg * r * 0.42, r * 1.55, len * 0.3, 1, 1, 0.28, 0, sg * 0.5, 0);
      add(S(r * 0.24, 14, 10), pink, sg * r * 0.43, r * 1.55, len * 0.3 + r * 0.03 * 0 + r * 0.05, 1, 1, 0.12, 0, sg * 0.5, 0); void ear;
      for (const fz of [0.32, -0.3]) add(new THREE.CapsuleGeometry(r * 0.08, r * 0.16, 4, 8), pink, sg * r * 0.55, r * 0.12, len * fz, 1, 1, 1, Math.PI / 2, 0, 0); // feet
    }
    const tp = []; for (let i = 0; i <= 14; i++) { const t = i / 14; tp.push(V3(Math.sin(t * 3) * r * 0.5, r * 0.25 * (1 - t) + r * 0.08, -len * 0.48 - t * len * 1.0)); }
    const tail = new THREE.Mesh(varTube(tp, (t) => r * 0.13 * (1 - t * 0.75), 8, 40, false), new THREE.MeshStandardMaterial({ color: '#c99189', roughness: 0.6, map: speckle('#c99189', 600, 0.2, seed + 3) })); tail.castShadow = true; g.add(tail);
    const wg = new THREE.BufferGeometry(), wp = []; const Rw = rnd(seed + 9);
    for (const sg of [-1, 1]) for (let i = 0; i < 5; i++) { const y = r * (0.9 + Rw() * 0.15), z = len * 0.56; wp.push(sg * r * 0.12, y, z, sg * r * (0.9 + Rw() * 0.6), y + (Rw() - 0.5) * r * 0.5, z - r * (0.1 + Rw() * 0.3)); }
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); g.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#ece7de', transparent: true, opacity: 0.8 })));
    g.userData = { len: len * 1.1, r, name: kind === 'rat' ? 'a rat' : 'a mouse', y: r * 0.95 };
  } else if (kind === 'frog') {
    len = r * 3.4;
    const skinF = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: canvasTex(256, (x, s) => { x.fillStyle = '#5f7d3a'; x.fillRect(0, 0, s, s); const R = rnd(seed); for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(40,50,20,${0.4 + R() * 0.4})`; x.beginPath(); x.ellipse(R() * s, R() * s, 4 + R() * 12, 3 + R() * 9, R() * 3, 0, TAU); x.fill(); } for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,200,${R() * 0.12})`; x.fillRect(R() * s, R() * s, 2, 2); } }), roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25 });
    const belly = new THREE.MeshPhysicalMaterial({ color: '#e7dfb8', roughness: 0.5, clearcoat: 0.4 }), gold = new THREE.MeshPhysicalMaterial({ color: '#c99a2e', roughness: 0.15, clearcoat: 1 }), black = new THREE.MeshStandardMaterial({ color: '#080808', roughness: 0.1 });
    add(along(lathe([[0, -0.5], [0.55, -0.42], [0.92, -0.18], [1, 0.05], [0.85, 0.28], [0.6, 0.42], [0.25, 0.5], [0, 0.52]].map(([a, b]) => [a * r * 1.25, b * len]), 30)), skinF, 0, r * 0.75, 0, 1, 0.62, 1);
    add(S(r, 22, 14), belly, 0, r * 0.52, 0, 1.05, 0.38, len / r * 0.42);
    for (const sg of [-1, 1]) {
      add(S(r * 0.28), gold, sg * r * 0.55, r * 1.2, len * 0.28); add(S(r * 0.14), black, sg * r * 0.66, r * 1.24, len * 0.33, 0.6, 1, 0.6);
      add(new THREE.CapsuleGeometry(r * 0.26, r * 0.9, 4, 10), skinF, sg * r * 1.05, r * 0.42, -len * 0.18, 1, 1, 1, Math.PI / 2, sg * 0.35, 0);     // thigh
      add(new THREE.CapsuleGeometry(r * 0.17, r * 1.0, 4, 10), skinF, sg * r * 1.25, r * 0.22, len * 0.02, 1, 1, 1, Math.PI / 2, -sg * 0.25, 0);    // shin
      add(S(r * 0.3, 14, 10), skinF, sg * r * 1.1, r * 0.08, len * 0.3, 0.7, 0.18, 1.3);                                                       // foot
      add(new THREE.CapsuleGeometry(r * 0.1, r * 0.45, 4, 8), skinF, sg * r * 0.7, r * 0.25, len * 0.3, 1, 1, 1, 0.3, 0, sg * 0.4);               // arm
    }
    g.userData = { len, r: r * 1.15, name: 'a frog', y: r * 0.75 };
  } else if (kind === 'fish') {
    len = r * 6.2;
    const scaleT = canvasTex(256, (x, s) => { const gr = x.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#30434f'); gr.addColorStop(0.45, '#7f97a2'); gr.addColorStop(0.6, '#c9d3d6'); gr.addColorStop(1, '#eef1ef'); x.fillStyle = gr; x.fillRect(0, 0, s, s); x.strokeStyle = 'rgba(20,30,40,.18)'; for (let yy = 0; yy < s; yy += 10) for (let xx = (yy / 10) % 2 ? 5 : 0; xx < s; xx += 10) { x.beginPath(); x.arc(xx, yy, 6, 0.2, Math.PI - 0.2); x.stroke(); } }, 1, 1);
    scaleT.wrapS = scaleT.wrapT = THREE.ClampToEdgeWrapping;
    const fishM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: scaleT, roughness: 0.25, metalness: 0.25, clearcoat: 1, iridescence: 0.4 });
    const bodyG = along(lathe([[0, -0.5], [0.18, -0.42], [0.55, -0.25], [0.9, -0.02], [1, 0.12], [0.86, 0.3], [0.5, 0.45], [0, 0.5]].map(([a, b]) => [a * r, b * len]), 32));
    // texture: v from top (dorsal) to belly = map the cylinder's own around-coordinate
    const pa = bodyG.attributes.position, uv = bodyG.attributes.uv; for (let i = 0; i < pa.count; i++) { const yy = pa.getY(i), xx = pa.getX(i), a = Math.atan2(xx, yy); uv.setXY(i, pa.getZ(i) / len + 0.5, Math.abs(a) / Math.PI); }
    add(bodyG, fishM, 0, r * 1.0, 0, 0.5, 1, 1);
    const finM = new THREE.MeshPhysicalMaterial({ color: '#6d838c', roughness: 0.4, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const tailS = new THREE.Shape(); tailS.moveTo(0, 0); tailS.lineTo(-r * 1.4, r * 1.0); tailS.quadraticCurveTo(-r * 0.9, 0, -r * 1.4, -r * 1.0); tailS.lineTo(0, 0);
    add(new THREE.ShapeGeometry(tailS), finM, 0, r * 1.0, -len * 0.48, 1, 1, 1, 0, Math.PI / 2, 0);
    const dS = new THREE.Shape(); dS.moveTo(0, 0); dS.lineTo(r * 0.5, r * 0.75); dS.lineTo(r * 1.4, 0); dS.lineTo(0, 0);
    add(new THREE.ShapeGeometry(dS), finM, 0, r * 1.9, -len * 0.12, 1, 1, 1, 0, -Math.PI / 2, 0);
    for (const sg of [-1, 1]) { add(S(r * 0.17), new THREE.MeshPhysicalMaterial({ color: '#d9d2a8', roughness: 0.1, clearcoat: 1 }), sg * r * 0.36, r * 1.18, len * 0.33); add(S(r * 0.1), new THREE.MeshStandardMaterial({ color: '#050505' }), sg * r * 0.42, r * 1.18, len * 0.34); }
    g.userData = { len: len * 1.1, r, name: 'a fish', y: r * 1.0 };
  } else if (kind === 'egg') {
    len = r * 2.6;
    const eggM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: speckle('#efe6d2', 500, 0.25, seed), roughness: 0.42, clearcoat: 0.3 });
    add(along(lathe([[0, -0.5], [0.55, -0.42], [0.88, -0.2], [1, 0.05], [0.9, 0.25], [0.6, 0.42], [0, 0.5]].map(([a, b]) => [a * r, b * len]), 32)), eggM, 0, r, 0);
    g.userData = { len, r, name: 'a bird\'s egg', y: r };
  } else { // lizard or a small snake
    const snake = kind === 'snake'; len = r * (snake ? 26 : 7);
    const lt = canvasTex(256, (x, s) => { x.fillStyle = snake ? '#6b6250' : '#7b6a45'; x.fillRect(0, 0, s, s); const R = rnd(seed); for (let yy = 0; yy < s; yy += 6) for (let xx = 0; xx < s; xx += 6) { x.fillStyle = `rgba(${R() < 0.5 ? '30,20,10' : '230,220,170'},${R() * 0.22})`; x.fillRect(xx + 1, yy + 1, 4, 4); } if (snake) { x.fillStyle = 'rgba(25,20,15,.55)'; for (let yy = 0; yy < s; yy += 32) x.fillRect(0, yy, s, 9); } else { x.fillStyle = 'rgba(235,225,180,.5)'; x.fillRect(s * 0.42, 0, s * 0.16, s); } }, 1, snake ? 8 : 2);
    const lm = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: lt, roughness: 0.45, clearcoat: 0.5 });
    const n = 30, pts = []; for (let i = 0; i <= n; i++) { const t = i / n; pts.push(V3(Math.sin(t * (snake ? 9 : 3)) * r * (snake ? 2.2 : 0.4) * t, r * 0.8, len * (0.5 - t))); }
    const bt = new THREE.Mesh(varTube(pts, snake ? (t) => r * (t < 0.04 ? 0.6 + t * 10 : 1 - Math.max(0, t - 0.8) * 4) : (t) => r * (t < 0.12 ? 0.55 + t * 3 : t < 0.42 ? 1 : 1 - (t - 0.42) * 1.6), 14, 80), lm); bt.castShadow = true; g.add(bt);
    for (const sg of [-1, 1]) add(S(r * 0.13), new THREE.MeshPhysicalMaterial({ color: '#100c08', roughness: 0.1, clearcoat: 1 }), sg * r * 0.45, r * 1.05, len * 0.45);
    if (!snake) for (const sg of [-1, 1]) for (const fz of [0.3, -0.05]) { add(new THREE.CapsuleGeometry(r * 0.16, r * 0.8, 4, 8), lm, sg * r * 1.05, r * 0.45, len * fz, 1, 1, 1, 0, 0, sg * 1.05); add(S(r * 0.2, 12, 8), lm, sg * r * 1.5, r * 0.08, len * fz + r * 0.2, 1, 0.3, 1.2); }
    g.userData = { len, r, name: snake ? 'another snake' : 'a lizard', y: r * 0.8 };
  }
  g.traverse((q) => { if (q.isMesh) q.position.y -= g.userData.y; });
  return g;
}
// what it eats: from its group, its genus and words in its name
function dietOf(P, id) {
  const sci = String(id || '').toLowerCase(), nm = String(P.name || '').toLowerCase(), gen = sci.split('-')[0], plan = P.plan || 'colubrid';
  const has = (list) => list.includes(gen);
  if (/egg.?eater/.test(nm) || has(['dasypeltis', 'elachistodon'])) return 'egg';
  if (plan === 'sea' || /sea ?snake|sea ?krait|water ?snake|watersnake|mud ?snake|fishing|file ?snake|mangrove/.test(nm) || has(['hydrophis', 'laticauda', 'aipysurus', 'emydocephalus', 'nerodia', 'enhydris', 'homalopsis', 'cerberus', 'acrochordus', 'regina', 'erpeton', 'farancia', 'hypsirhina', 'myron', 'fordonia', 'agkistrodon'].filter((g) => g !== 'agkistrodon' || /cottonmouth|water/.test(nm)))) return 'fish';
  if (/king ?cobra|kingsnake|king snake|krait|coral ?snake|snake.?eater|mussurana/.test(nm) || has(['ophiophagus', 'lampropeltis', 'bungarus', 'micrurus', 'calliophis', 'micruroides', 'drymarchon', 'clelia', 'aspidelaps'])) return 'snake';
  if (/frog|toad|keelback|garter|ribbon|hognose|grass snake|cat.?eyed/.test(nm) || has(['thamnophis', 'natrix', 'rhabdophis', 'xenodon', 'leptodeira', 'heterodon', 'amphiesma', 'hebius', 'fowlea', 'xenochrophis', 'erythrolamprus', 'liophis', 'leioheterodon', 'tropidonophis', 'lycodryas'])) return 'frog';
  if (/whipsnake|racer|sand snake|lizard|smooth snake|leaf.?nosed|vine snake|tree snake|bronzeback|desert/.test(nm) || has(['coronella', 'psammophis', 'hemorrhois', 'masticophis', 'dendrelaphis', 'chrysopelea', 'ahaetulla', 'oxybelis', 'philodryas', 'macroprotodon', 'malpolon', 'acanthophis', 'demansia', 'eirenis', 'rhinocheilus', 'chionactis', 'sonora', 'tantilla'])) return 'lizard';
  return 'mouse';
}

// ---------------------------------------------------------------- the forearm and hand used by See bite
// axis: +y from the elbow (y = 0) to the fingertips; the forearm is flattened top-to-bottom (local z is up)
function buildArm(R) {
  const g = new THREE.Group(), skin = skinMat('#cf9a78', 31); skin.transparent = true;
  const A = 0.26 / 0.035 * R; // forearm length for this radius (about 26 cm)
  const prof = [[0.9, -0.05], [1.0, 0.0], [1.06, 0.12], [1.02, 0.3], [0.9, 0.55], [0.74, 0.8], [0.64, 0.97], [0.63, 1.0]];
  const fore = new THREE.Mesh(lathe(prof.map(([r, y]) => [r * R, y * A]), 36), skin); fore.scale.set(1, 1, 0.8); fore.castShadow = true; g.add(fore);
  // the upper arm, rising out of the picture
  const up = new THREE.Mesh(new THREE.CapsuleGeometry(R * 1.02, A * 1.6, 8, 28), skin); up.position.set(0, -A * 0.62, A * 0.62); up.rotation.x = -0.85; up.castShadow = true; g.add(up);
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 24, 16), skin); elbow.scale.set(1, 1, 0.85); g.add(elbow);
  const hand = new THREE.Group(); hand.position.y = A; g.add(hand);
  const hm = (geo, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, skin); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; hand.add(m); return m; };
  hm(new THREE.SphereGeometry(1, 24, 16), 0, R * 1.35, 0, R * 1.02, R * 1.55, R * 0.5);   // palm and back of the hand
  hm(new THREE.SphereGeometry(1, 16, 12), 0, R * 0.25, 0, R * 0.7, R * 0.6, R * 0.5);     // wrist
  for (let f = 0; f < 4; f++) { const x = (-0.66 + f * 0.44) * R, l = R * (f === 0 ? 0.95 : f === 3 ? 0.8 : 1.12); hm(new THREE.CapsuleGeometry(1, 4.5, 4, 10), x, R * 2.7 + l * 0.5, -R * 0.08, R * 0.2, l * 0.2, R * 0.19, -0.18, 0, 0); }
  hm(new THREE.CapsuleGeometry(1, 3.5, 4, 10), R * 1.05, R * 1.55, -R * 0.12, R * 0.22, R * 0.32, R * 0.21, 0, 0, -0.65); // thumb
  g.userData.skin = skin; g.userData.A = A;
  return g;
}

// ================================================================= create
export function create(V) {
  THREE = V.THREE; injectCSS();
  const P = V.P, el = V.el, on = V.on, labels = V.labels, stage = V.stage, wrap = V.wrap, bar = V.bar;
  const now = () => performance.now();
  let rig = null, show = null, slither = null, anat = null, camBlend = null, alive = true;
  const plan = P.plan || 'colubrid', venomous = ['viper', 'pitviper', 'elapid', 'sea'].includes(plan);
  const fanged = () => !!(V.extras && V.extras.mouth && V.extras.mouth.fanged);

  // ---- layout: the stage sits in a row so a photo or a map can open beside it
  const row = el('div', 'sp3d-row'), side = el('aside', 'sp3d-side'); side.hidden = true;
  const layout = () => { if (row.parentNode || !stage.parentNode) return; stage.parentNode.insertBefore(row, stage); row.append(stage, side); }; // once mount() has placed the stage
  const capt = el('div', 'sp3d-capt'); capt.hidden = true; capt.setAttribute('aria-live', 'polite'); stage.appendChild(capt);
  const stepTag = el('div', 'sp3d-step'); stepTag.hidden = true; stage.appendChild(stepTag);
  const tip = el('div', 'sp3d-tip'); tip.hidden = true; stage.appendChild(tip);
  function say(html) { if (!html) { capt.hidden = true; capt.dataset.k = ''; return; } if (capt.dataset.k === html) return; capt.dataset.k = html; capt.innerHTML = html; capt.hidden = false; }

  // ---- buttons in the bar under the model (all .sp3d-b, so the NEW-tag logic of the pages and app keeps working)
  const before = bar.querySelector('.sp3d-views');
  const mk = (txt, title) => { const b = V.btn(txt, title); if (before) bar.insertBefore(b, before); return b; };
  const bEat = mk('See it eat', 'Watch it catch and swallow its usual food');
  const bSlither = mk('Slither', 'Watch it slither along the ground'); bSlither.setAttribute('aria-pressed', 'false');
  const bEye = mk('See eye shield', 'Snakes have no eyelids: see the clear scale that covers each eye');
  const bFull = V.btn('Fullscreen', 'Show the 3D view on the whole screen'); bFull.classList.add('sp3d-fs'); bFull.setAttribute('aria-pressed', 'false'); bFull.innerHTML = ICON.full + '<span>Fullscreen</span>';
  const bBite = V.bBite, bAnat = V.bAnat;
  bBite.title = 'Watch it strike an arm, then look inside the arm to see how deep the fang goes';
  bAnat.title = 'Show the parts of this snake: see-through skin with its organs inside, plus teeth, fangs and tongue - tap any part';

  // ---- header buttons beside the name: Compare photo, See countries
  let hdb = null; const hdbs = {};
  if (V.opts.head && V.opts.head.parentNode) {
    hdb = el('span', 'sp3d-hdb');
    const mkH = (k, txt, icon, title) => { const b = el('button', 'sp3d-b sp3d-hb'); b.type = 'button'; b.title = title; b.innerHTML = icon + '<span>' + txt + '</span>'; b.setAttribute('aria-pressed', 'false'); hdb.appendChild(b); on(b, 'click', () => toggleSide(k)); hdbs[k] = b; return b; };
    mkH('photo', 'Compare photo', ICON.photo, 'Show its real photo beside the 3D model');
    mkH('map', 'See countries', ICON.map, 'Show the countries where it lives beside the 3D model');
    V.opts.head.parentNode.insertBefore(hdb, V.opts.head.nextSibling);
  }
  let sideKind = null;
  function toggleSide(k) {
    if (sideKind === k) { closeSide(); return; }
    sideKind = k; side.innerHTML = ''; side.hidden = false;
    for (const q in hdbs) hdbs[q].setAttribute('aria-pressed', String(q === k));
    const hd = el('div', 'sp3d-side-hd'), t = el('span', '', k === 'photo' ? 'Real photo' : 'Where it lives'), x = el('button', 'sp3d-side-x', '×');
    x.type = 'button'; x.setAttribute('aria-label', 'Close'); on(x, 'click', closeSide); hd.append(t, x); side.appendChild(hd);
    const b = el('div', 'sp3d-side-b'); side.appendChild(b);
    if (k === 'photo') {
      const ph = typeof V.opts.photo === 'function' ? V.opts.photo() : V.opts.photo;
      if (ph && ph.src) {
        const f = el('figure'), im = new Image(); im.alt = ph.alt || ('Photo of ' + V.opts.name); im.decoding = 'async'; im.src = ph.src;
        if (ph.fb) im.addEventListener('error', () => { if (im.src !== ph.fb) im.src = ph.fb; }, { once: true });
        f.appendChild(im); if (ph.credit) { const c = el('figcaption'); c.innerHTML = ph.credit; f.appendChild(c); } b.appendChild(f);
      } else b.appendChild(el('p', 'sp3d-none2', 'SnakeList has no photo of this snake yet.'));
    } else {
      const u = typeof V.opts.mapUrl === 'function' ? V.opts.mapUrl() : V.opts.mapUrl;
      if (u) { const fr = document.createElement('iframe'); fr.title = 'Map of where ' + V.opts.name + ' lives'; fr.loading = 'lazy'; fr.src = u; b.appendChild(fr); }
      else b.appendChild(el('p', 'sp3d-none2', 'No map for this snake yet.'));
    }
    V.kick();
  }
  function closeSide() { sideKind = null; side.hidden = true; side.innerHTML = ''; for (const q in hdbs) hdbs[q].setAttribute('aria-pressed', 'false'); V.kick(); }

  // ================================================================= the rig: bends the body along any path
  // N samples along the body (rest centre line and frames). A pose is a new centre line; every vertex keeps its
  // offset from the centre line in the local frame (T along, U up, S sideways), so scales and markings stay put.
  // The head (everything the jaw moves) stays rigid, as do the eyes, teeth and the rattle (moved as a whole).
  function makeRig() {
    const info = V.info, F = info.F, body = info.body, group = V.group, L = F.L, mo = V.extras.mouth;
    const mesh = group.children.find((o) => o.isMesh && o.geometry === body.geo);
    const N = 720, dx = L / (N - 1);
    const rc = new Float32Array(N * 3), rT = new Float32Array(N * 3), rU = new Float32Array(N * 3), rS = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const x = i * dx, c = body.spine(x), f = body.frameAt(x); rc.set([c.x, c.y, c.z], i * 3); rT.set([f.T.x, f.T.y, f.T.z], i * 3); rU.set([f.U.x, f.U.y, f.U.z], i * 3); rS.set([f.S.x, f.S.y, f.S.z], i * 3); }
    const nc = rc.slice(), nT = rT.slice(), nU = rU.slice(), nS = rS.slice(), bul = new Float32Array(N).fill(1);
    const xEnd = mo ? mo.headX * 1.3 : F.Hl * 0.95, xr = Math.min(L * 0.3, xEnd * 1.06);
    const ih = Math.max(2, Math.round(xr / dx)), it = N - 1 - Math.max(3, Math.round(N * 0.012));
    // rest headings and horizontal step lengths (for poses built from turning angles)
    const rth = new Float32Array(N), rh = new Float32Array(N);
    for (let i = 0; i < N - 1; i++) { const ax = rc[i * 3 + 3] - rc[i * 3], az = rc[i * 3 + 5] - rc[i * 3 + 2]; rth[i] = Math.atan2(az, ax); rh[i] = Math.max(1e-9, Math.hypot(ax, az)); }
    rth[N - 1] = rth[N - 2]; rh[N - 1] = rh[N - 2];
    for (let i = 1; i < N; i++) rth[i] = rth[i - 1] + angDiff(rth[i - 1], rth[i]); // unwrapped
    // the rigid parts: everything on the snake except its body mesh
    const headRig = new THREE.Group(), tailRig = new THREE.Group(); headRig.name = 'headRig'; tailRig.name = 'tailRig';
    headRig.matrixAutoUpdate = tailRig.matrixAutoUpdate = false; headRig.userData.noRig = tailRig.userData.noRig = true;
    group.updateMatrixWorld(true);
    const nearX = (p) => { let b = 0, bd = 1e18; for (let i = 0; i < N; i += 2) { const d = (rc[i * 3] - p.x) ** 2 + (rc[i * 3 + 1] - p.y) ** 2 + (rc[i * 3 + 2] - p.z) ** 2; if (d < bd) { bd = d; b = i; } } return b * dx; };
    const box = new THREE.Box3();
    for (const ch of group.children.slice()) {
      if (ch === mesh || ch.userData.noRig) continue;
      box.setFromObject(ch); const p = box.isEmpty() ? ch.position.clone() : box.getCenter(new THREE.Vector3()), x = nearX(p);
      if (x < Math.max(xr * 1.7, F.Hl * 1.4)) headRig.add(ch); else if (x > L * 0.88) tailRig.add(ch);
    }
    group.add(headRig, tailRig);
    // skins: geometries whose vertices follow the centre line
    const skins = [];
    function addSkin(geo, xs, opt = {}) {
      const pa = geo.attributes.position, n = pa.count, src = pa.array.slice(), loc = new Float32Array(n * 3), fi = new Float32Array(n);
      const s = { geo, pa, src, loc, fi, n, bulge: !!opt.bulge, body: !!opt.body, rigid: opt.rigid || null };
      for (let v = 0; v < n; v++) fi[v] = clamp(xs[v] / dx, 0, N - 1.0001);
      localize(s, 0, n, src); skins.push(s); return s;
    }
    function localize(s, a, b, arr) {
      for (let v = a; v < b; v++) {
        const f = s.fi[v], i = f | 0, w = f - i, i3 = i * 3, j3 = i3 + 3;
        const cx = rc[i3] + (rc[j3] - rc[i3]) * w, cy = rc[i3 + 1] + (rc[j3 + 1] - rc[i3 + 1]) * w, cz = rc[i3 + 2] + (rc[j3 + 2] - rc[i3 + 2]) * w;
        const dx0 = arr[v * 3] - cx, dy0 = arr[v * 3 + 1] - cy, dz0 = arr[v * 3 + 2] - cz;
        const Tx = rT[i3] + (rT[j3] - rT[i3]) * w, Ty = rT[i3 + 1] + (rT[j3 + 1] - rT[i3 + 1]) * w, Tz = rT[i3 + 2] + (rT[j3 + 2] - rT[i3 + 2]) * w;
        const Ux = rU[i3] + (rU[j3] - rU[i3]) * w, Uy = rU[i3 + 1] + (rU[j3 + 1] - rU[i3 + 1]) * w, Uz = rU[i3 + 2] + (rU[j3 + 2] - rU[i3 + 2]) * w;
        const Sx = rS[i3] + (rS[j3] - rS[i3]) * w, Sy = rS[i3 + 1] + (rS[j3 + 1] - rS[i3 + 1]) * w, Sz = rS[i3 + 2] + (rS[j3 + 2] - rS[i3 + 2]) * w;
        s.loc[v * 3] = dx0 * Tx + dy0 * Ty + dz0 * Tz; s.loc[v * 3 + 1] = dx0 * Ux + dy0 * Uy + dz0 * Uz; s.loc[v * 3 + 2] = dx0 * Sx + dy0 * Sy + dz0 * Sz;
      }
    }
    const M = body.M, bx = new Float32Array(body.nR * (M + 1));
    let jawVerts = 0;
    for (let i = 0; i < body.nR; i++) { bx.fill(body.ringX[i], i * (M + 1), (i + 1) * (M + 1)); if (body.ringX[i] <= xEnd) jawVerts = (i + 1) * (M + 1); }
    const bodySkin = addSkin(body.geo, bx, { bulge: true, body: true });
    let lastT = mo ? mo.t : 0, active = false;
    const contact = V.scene && V.scene.children.find((o) => o.isMesh && o.renderOrder === 1 && o.material && o.material.map && o.material.transparent && o.geometry && o.geometry.type === 'PlaneGeometry');
    const mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), tv = new THREE.Vector3();
    const basis = (arr1, arr2, arr3, i, m) => m.set(arr1[i * 3], arr2[i * 3], arr3[i * 3], 0, arr1[i * 3 + 1], arr2[i * 3 + 1], arr3[i * 3 + 1], 0, arr1[i * 3 + 2], arr2[i * 3 + 2], arr3[i * 3 + 2], 0, 0, 0, 0, 1);
    function rigidAt(i, out) { // the move that carries rest frame i onto the new frame i
      basis(nT, nU, nS, i, mA); basis(rT, rU, rS, i, mB); mB.transpose(); out.multiplyMatrices(mA, mB);
      tv.set(rc[i * 3], rc[i * 3 + 1], rc[i * 3 + 2]).applyMatrix4(out); out.setPosition(nc[i * 3] - tv.x, nc[i * 3 + 1] - tv.y, nc[i * 3 + 2] - tv.z); return out;
    }
    const hM = new THREE.Matrix4(), tM = new THREE.Matrix4(), q3 = new THREE.Vector3();
    function frames() {
      for (let i = ih - 1; i < N; i++) {
        const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1);
        let Tx = nc[b * 3] - nc[a * 3], Ty = nc[b * 3 + 1] - nc[a * 3 + 1], Tz = nc[b * 3 + 2] - nc[a * 3 + 2]; const l = Math.hypot(Tx, Ty, Tz) || 1; Tx /= l; Ty /= l; Tz /= l;
        let Ux = -Tx * Ty, Uy = 1 - Ty * Ty, Uz = -Tz * Ty; const lu = Math.hypot(Ux, Uy, Uz) || 1; Ux /= lu; Uy /= lu; Uz /= lu;
        nT[i * 3] = Tx; nT[i * 3 + 1] = Ty; nT[i * 3 + 2] = Tz; nU[i * 3] = Ux; nU[i * 3 + 1] = Uy; nU[i * 3 + 2] = Uz;
        nS[i * 3] = Ty * Uz - Tz * Uy; nS[i * 3 + 1] = Tz * Ux - Tx * Uz; nS[i * 3 + 2] = Tx * Uy - Ty * Ux;
      }
      rigidAt(ih, hM);
      for (let i = 0; i < ih; i++) {
        q3.set(rc[i * 3], rc[i * 3 + 1], rc[i * 3 + 2]).applyMatrix4(hM); nc.set([q3.x, q3.y, q3.z], i * 3);
        for (const [r, n] of [[rT, nT], [rU, nU], [rS, nS]]) { q3.set(r[i * 3], r[i * 3 + 1], r[i * 3 + 2]).transformDirection(hM); n.set([q3.x, q3.y, q3.z], i * 3); }
      }
      rigidAt(it, tM);
    }
    function deform(s) {
      const a = s.pa.array, loc = s.loc, fi = s.fi, bb = s.bulge;
      for (let v = 0; v < s.n; v++) {
        const f = fi[v], i = f | 0, w = f - i, i3 = i * 3, j3 = i3 + 3, l0 = loc[v * 3]; let l1 = loc[v * 3 + 1], l2 = loc[v * 3 + 2];
        if (bb) { const k = bul[i] + (bul[i + 1] - bul[i]) * w; l1 *= k; l2 *= k; }
        for (let c = 0; c < 3; c++) a[v * 3 + c] = nc[i3 + c] + (nc[j3 + c] - nc[i3 + c]) * w + (nT[i3 + c] + (nT[j3 + c] - nT[i3 + c]) * w) * l0 + (nU[i3 + c] + (nU[j3 + c] - nU[i3 + c]) * w) * l1 + (nS[i3 + c] + (nS[j3 + c] - nS[i3 + c]) * w) * l2;
      }
      s.pa.needsUpdate = true; s.geo.computeVertexNormals();
      if (s.body) seam(s.geo);
      s.geo.computeBoundingSphere();
    }
    function seam(geo) { const nr = geo.attributes.normal.array; for (let i = 0; i < body.nR; i++) { const a = i * (M + 1), b = a + M; for (let q = 0; q < 3; q++) { const m = (nr[a * 3 + q] + nr[b * 3 + q]) / 2; nr[a * 3 + q] = nr[b * 3 + q] = m; } } geo.attributes.normal.needsUpdate = true; }
    function apply() {
      if (mo && mo.t !== lastT) { localize(bodySkin, 0, jawVerts, bodySkin.pa.array); lastT = mo.t; } // the jaw moved: take its new shape
      frames();
      headRig.matrix.copy(hM); headRig.matrixWorldNeedsUpdate = true; tailRig.matrix.copy(tM); tailRig.matrixWorldNeedsUpdate = true;
      for (const s of skins) deform(s);
      if (!active) { active = true; if (contact) contact.visible = false; }
    }
    function release() {
      if (!active) return; active = false;
      nc.set(rc); nT.set(rT); nU.set(rU); nS.set(rS); bul.fill(1);
      for (const s of skins) { s.pa.array.set(s.src); s.pa.needsUpdate = true; if (!s.body) { s.geo.computeVertexNormals(); s.geo.computeBoundingSphere(); } }
      if (mo) { mo.set(mo.t); mo.settle(); lastT = mo.t; } else { body.geo.computeVertexNormals(); seam(body.geo); }
      body.geo.computeBoundingSphere();
      headRig.matrix.identity(); tailRig.matrix.identity(); headRig.matrixWorldNeedsUpdate = tailRig.matrixWorldNeedsUpdate = true;
      if (contact) contact.visible = true;
    }
    // poses ------------------------------------------------------------
    // a centre line from turning angles th[i] (segment i -> i+1), anchored at sample a, heights ys
    function integrate(th, a, ax, az, ys) {
      const out = new Float32Array(N * 3); out[a * 3] = ax; out[a * 3 + 2] = az;
      for (let i = a + 1; i < N; i++) { out[i * 3] = out[i * 3 - 3] + Math.cos(th[i - 1]) * rh[i - 1]; out[i * 3 + 2] = out[i * 3 - 1] + Math.sin(th[i - 1]) * rh[i - 1]; }
      for (let i = a - 1; i >= 0; i--) { out[i * 3] = out[i * 3 + 3] - Math.cos(th[i]) * rh[i]; out[i * 3 + 2] = out[i * 3 + 5] - Math.sin(th[i]) * rh[i]; }
      for (let i = 0; i < N; i++) out[i * 3 + 1] = ys[i];
      return out;
    }
    const restY = new Float32Array(N); for (let i = 0; i < N; i++) restY[i] = rc[i * 3 + 1];
    const baseY = (i) => F.Hh(i * dx) * F.bf;
    // the head-and-neck posture: forebody up to sample is pointed along heading phi (the direction T, from head to
    // tail, is phi + PI), curled into an S by amount 'coil'; lifted by 'lift' at the head; head turned by 'yaw'
    function fore(o) {
      const is = Math.round(o.len / dx), th = rth.slice(), ys = restY.slice(), phiT = o.phi + Math.PI, tr = Math.max(4, Math.round(is * 0.3));
      const base = rth[is] + angDiff(rth[is], phiT); // the reaching direction, unwrapped next to the body's own heading
      for (let i = is - 1; i >= 0; i--) {
        const k = sstep(is, is - tr, i); let a = base + angDiff(base, rth[is]) * (1 - k);
        const u = (is - i) / is, w = sstep(0, ih * 1.6, i) * (1 - sstep(is * 0.82, is, i));
        a += (o.coil || 0) * 1.25 * Math.sin(TAU * 1.5 * u) * w;
        if (o.yaw) a += o.yaw * (1 - sstep(ih * 0.9, ih * 2.4, i));
        th[i] = a;
        const ly = (o.lift || 0) * Math.pow(1 - i / is, 1.6) * (1 - (o.coil || 0) * 0.25);
        ys[i] = lerp(restY[i], baseY(i) + Math.min(restY[i] - baseY(i), F.Hh(F.Hl) * 0.6), sstep(is, is * 0.7, i)) + ly;
      }
      for (let i = is; i < N - 1; i++) th[i] = rth[i];
      return integrate(th, is, rc[is * 3], rc[is * 3 + 2], ys);
    }
    // the move of the head for a pose (to place things where the head will be)
    function headMatrixFor(pose) {
      const sv = [nc.slice(), nT.slice(), nU.slice(), nS.slice()];
      nc.set(pose); frames(); const m = hM.clone(); nc.set(sv[0]); nT.set(sv[1]); nU.set(sv[2]); nS.set(sv[3]); return m;
    }
    function setPose(pose) { nc.set(pose); }
    function blend(a, b, t) { const o = new Float32Array(N * 3); for (let i = 0; i < o.length; i++) o[i] = a[i] + (b[i] - a[i]) * t; return o; }
    // the current frame at body position x (x < 0: in front of the snout)
    function frameAtX(x) {
      const xe = clamp(x, 0, L), f = clamp(xe / dx, 0, N - 1.0001), i = f | 0, w = f - i, g3 = (arr) => V3(arr[i * 3] + (arr[i * 3 + 3] - arr[i * 3]) * w, arr[i * 3 + 1] + (arr[i * 3 + 4] - arr[i * 3 + 1]) * w, arr[i * 3 + 2] + (arr[i * 3 + 5] - arr[i * 3 + 2]) * w);
      const T = g3(nT).normalize(), U = g3(nU).normalize(), S = g3(nS).normalize(), c = g3(nc);
      if (x < 0) c.addScaledVector(T, x); else if (x > L) c.addScaledVector(T, x - L);
      return { c, T, U, S };
    }
    function point(x, s = 0, u = 0) { const f = frameAtX(x); return f.c.addScaledVector(f.S, s).addScaledVector(f.U, u); }
    return { N, dx, ih, L, rc, rth, restY, bul, headRig, tailRig, addSkin, apply, release, integrate, fore, headMatrixFor, setPose, blend, frameAtX, point, get active() { return active; }, rest: () => rc.slice() };
  }
  function ensureRig() { if (!rig && V.info && V.group) rig = makeRig(); return rig; }

  // ================================================================= camera takeover for the shows
  const cOrb = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
  function orbitAt(tgt, az, el, d) { return tgt.clone().add(V3(d * Math.cos(el) * Math.sin(az), d * Math.sin(el), d * Math.cos(el) * Math.cos(az))); }
  const curTarget = () => { const c = V.cam, d = V.controls.st.d; return c.position.clone().add(c.getWorldDirection(new THREE.Vector3()).multiplyScalar(d)); };
  function camera() {
    const cam = V.cam; let want = null;
    if (show && show.cam) want = show.cam(show.time);
    if (want) { // glide towards where the show wants the camera
      const t = now(); if (!show.cLast) show.cLast = { pos: cam.position.clone(), tgt: curTarget(), t };
      const c = show.cLast, k = show.freeze != null ? 1 : 1 - Math.exp(-Math.min(0.1, (t - c.t) / 1000) / 0.42); c.t = t;
      c.pos.lerp(want.pos, k); c.tgt.lerp(want.tgt, k);
      place(cam, c.pos, c.tgt); return true;
    }
    if (camBlend) { // back to the orbit camera
      const k = ease((now() - camBlend.t0) / 1000);
      const pos = camBlend.pos.clone().lerp(cam.position, k), tgt = camBlend.tgt.clone().lerp(curTarget(), k);
      place(cam, pos, tgt); if (k >= 1) camBlend = null; return true;
    }
    return false;
  }
  function place(cam, pos, tgt) { const d = pos.distanceTo(tgt); cam.position.copy(pos); cam.near = Math.max(d * 0.01, 1e-4); cam.far = Math.max(V.info.Rb * 40, 300); cam.updateProjectionMatrix(); cam.lookAt(tgt); }

  // ================================================================= shows (automatic: the camera moves by itself)
  function startShow(def) {
    if (!V.info || !V.extras) return;
    stopShow(true); stopSlither();
    ensureRig();
    show = Object.assign({ t0: now(), time: 0, freeze: null, objs: [] }, def);
    show.mouth0 = V.mouthGoal;
    V.controls.st.goal = null; V.controls.st.vaz = V.controls.st.vel = V.controls.st.vpx = V.controls.st.vpz = 0;
    for (const b of [bBite, bEat, bEye]) b.disabled = true;
    show.btn.disabled = false; show.btn.dataset.lbl = show.btn.textContent; show.btn.textContent = 'Stop'; show.btn.setAttribute('aria-pressed', 'true');
    stepTag.hidden = true; V.kick();
  }
  function stopShow(quiet) {
    if (!show) return; const s = show; show = null;
    try { s.end && s.end(); } catch (e) { /* never leave the viewer stuck */ }
    for (const o of s.objs) disposeTree(o);
    if (rig) rig.release();
    if (V.extras && V.extras.mouth) { V.extras.mouth.set(V.extras.mouth.t); V.mouthGoal = s.mouth0 || 0; }
    say(''); stepTag.hidden = true;
    for (const b of [bBite, bEat, bEye]) { b.disabled = false; b.removeAttribute('aria-pressed'); if (b.dataset.lbl) { b.textContent = b.dataset.lbl; delete b.dataset.lbl; } }
    if (s.cLast && !quiet) camBlend = { t0: now(), pos: s.cLast.pos.clone(), tgt: s.cLast.tgt.clone() };
    if (anat) anat.refresh();
    V.kick();
  }
  function setMouth(t) { const mo = V.extras.mouth; if (!mo) return; if (Math.abs(mo.t - t) > 1e-4) mo.set(t); V.mouthGoal = t; }
  // a show is a list of [duration, fn(u, s)] phases
  function runPhases(list, s) { let t = 0; for (let i = 0; i < list.length; i++) { const [d, f] = list[i]; if (s < t + d || i === list.length - 1) { f(clamp((s - t) / d, 0, 1), s, i); return i; } t += d; } return -1; }
  const total = (list) => list.reduce((a, p) => a + p[0], 0);

  // common geometry for strikes: where the head points, how far the forebody reaches
  function strikeSetup(extraLift) {
    const info = V.info, F = info.F, hd = info.headDir, D = V3(hd.x, 0, hd.z).normalize(), phi = Math.atan2(D.z, D.x);
    const len = clamp(F.L * 0.33, F.Hl * 4.5, F.L * 0.55);
    const perp = V3(-D.z, 0, D.x); const away = info.center.clone().sub(info.headPos).setY(0);
    if (perp.dot(away) > 0) perp.negate(); // the camera goes on the side away from the coils
    return { F, D, phi, len, perp, lift: extraLift };
  }

  // the neck's heading that makes the head itself (not just the neck) point along D
  function aim(st, lift) {
    let phi = st.phi;
    for (let k = 0; k < 3; k++) { const hm = rig.headMatrixFor(rig.fore({ len: st.len, phi, lift, coil: 0 })), d = V.info.headDir.clone().transformDirection(hm); phi -= angDiff(st.phi, Math.atan2(d.z, d.x)); }
    st.aim = phi; return phi;
  }

  // ---------------------------------------------------------------- See bite
  function bite() {
    const mo = V.extras.mouth; if (!mo) return;
    const R = rig, A = mo.anchors, st = strikeSetup(0), F = st.F, Hl = F.Hl, OPEN = 0.85, armR = 0.035;
    const t0 = mo.t; mo.set(OPEN); V.group.updateMatrixWorld(true);
    const tipRest = A.fang.getWorldPosition(new THREE.Vector3()), fx0 = Hl * 0.1, sp = V.info.body.spine(fx0), Sx = V.info.body.frameAt(fx0).S;
    const tipRest2 = tipRest.clone().addScaledVector(Sx, -2 * tipRest.clone().sub(sp).dot(Sx));
    mo.set(t0);
    const lift = Math.max(0, armR * 1.3 - tipRest.y) + Hl * 0.15;
    const phi = aim(st, lift), ext = R.fore({ len: st.len, phi, lift, coil: 0 }), coil = R.fore({ len: st.len, phi, lift: lift * 0.8, coil: 1 }), rest = R.rest();
    const hm = R.headMatrixFor(ext), tip = tipRest.clone().applyMatrix4(hm), tip2 = tipRest2.clone().applyMatrix4(hm);
    const D = st.D, depth = Math.min(A.fangLen * (mo.fanged ? 0.85 : 0.75), armR * 0.9), dy = -armR * 0.25, half = Math.sqrt(armR * armR - dy * dy);
    const mid = tip.clone().add(tip2).multiplyScalar(0.5), axis = st.perp.clone(), up = V3(0, 1, 0); // the elbow goes away from the camera
    // the arm: its axis crosses in front of the head; the bite lands on the forearm a little above the wrist
    const arm = buildArm(armR), A2 = arm.userData.A, X = new THREE.Vector3().crossVectors(axis, up).normalize();
    arm.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, axis, up));
    const c = mid.clone().addScaledVector(D, half - depth); c.y = mid.y + dy; // the arm's centre a little below the fang tips
    arm.position.copy(c).addScaledVector(axis, -A2 * 0.72);
    V.scene.add(arm); show.objs.push(arm); arm.updateMatrixWorld(true);
    // inside the arm (shown when the skin turns see-through): muscle, bone, fat, veins (blue) and arteries (red)
    const inner = new THREE.Group(); arm.add(inner);
    const q = arm.worldToLocal(mid.clone()), qa = Math.atan2(q.z, q.x), yb = q.y;
    const mat = (col, op = 1, extra = {}) => new THREE.MeshPhysicalMaterial(Object.assign({ color: col, roughness: 0.45, transparent: true, opacity: 0, depthWrite: false }, extra));
    const fat = new THREE.Mesh(lathe([[0.86, -0.02], [0.93, 0.05], [0.92, 0.3], [0.82, 0.55], [0.66, 0.8], [0.57, 0.98]].map(([r, y]) => [r * armR, y * A2]), 36), mat('#f0d29a', 1, { side: THREE.DoubleSide })); fat.scale.set(1, 1, 0.8); fat.userData.op = 0.28; inner.add(fat);
    const musT = canvasTex(128, (x, s) => { x.fillStyle = '#b8473f'; x.fillRect(0, 0, s, s); for (let i = 0; i < s; i += 3) { x.fillStyle = `rgba(${i % 2 ? '255,190,180' : '90,20,20'},.18)`; x.fillRect(i, 0, 1, s); } }, 3, 1);
    for (let m = 0; m < 4; m++) { const a = qa + (m - 1.5) * 0.9, rr = armR * 0.42; const g = new THREE.Mesh(lathe([[0, 0.03], [0.28, 0.12], [0.36, 0.35], [0.3, 0.6], [0.12, 0.85], [0, 0.9]].map(([r, y]) => [r * armR, y * A2]), 20), mat('#ffffff', 1, { map: musT })); g.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr * 0.8); g.userData.op = 0.5; inner.add(g); }
    for (const bo of [-1, 1]) { const g = new THREE.Mesh(new THREE.CylinderGeometry(armR * 0.12, armR * 0.14, A2 * 1.02, 14), mat('#efe8d8')); g.position.set(Math.cos(qa + Math.PI) * armR * 0.12 + bo * armR * 0.2, A2 * 0.5, Math.sin(qa + Math.PI) * armR * 0.08 - armR * 0.1); g.userData.op = 0.8; inner.add(g); }
    const vessel = (col, depthK, da, wig, rad) => {
      const pts = []; for (let i = 0; i <= 24; i++) { const y = -0.02 * A2 + (i / 24) * A2 * 1.02, a = qa + da + Math.sin(i * 0.7 + da * 5) * wig, rr = armR * depthK; pts.push(V3(Math.cos(a) * rr, y, Math.sin(a) * rr * 0.8)); }
      const g = new THREE.Mesh(varTube(pts, () => armR * rad, 10, 96, false), mat(col, 1, { emissive: col, emissiveIntensity: 0.25, roughness: 0.3, clearcoat: 0.6 })); g.userData.op = 1; inner.add(g); return pts;
    };
    const veinPts = vessel('#2f5bd3', 0.8, 0.18, 0.12, 0.05); vessel('#3a62c8', 0.78, -0.55, 0.1, 0.04); vessel('#2d55c0', 0.82, 0.85, 0.08, 0.035);
    vessel('#d2232c', 0.55, -0.15, 0.06, 0.055); vessel('#c41f2a', 0.58, 0.55, 0.05, 0.045);
    // tiny branches (capillaries) around where the fang goes in
    const Rr = rnd(5);
    for (let k = 0; k < 16; k++) { const a = qa + (Rr() - 0.5) * 1.2, y = yb + (Rr() - 0.5) * armR * 2.4, r0 = armR * (0.55 + Rr() * 0.3), r1 = r0 + armR * (0.1 + Rr() * 0.15), a1 = a + (Rr() - 0.5) * 0.5; const pts = [V3(Math.cos(a) * r0, y, Math.sin(a) * r0 * 0.8), V3(Math.cos((a + a1) / 2) * (r0 + r1) / 2, y + (Rr() - 0.5) * armR * 0.6, Math.sin((a + a1) / 2) * (r0 + r1) / 2 * 0.8), V3(Math.cos(a1) * r1, y + (Rr() - 0.5) * armR, Math.sin(a1) * r1 * 0.8)]; const col = k % 2 ? '#c8333a' : '#3c64cf'; const g = new THREE.Mesh(varTube(pts, () => armR * 0.018, 5, 12, false), mat(col, 1, { emissive: col, emissiveIntensity: 0.3 })); g.userData.op = 0.9; inner.add(g); }
    markFade(inner); fadeTree(inner, 0); inner.traverse((o) => { o.renderOrder = 1; });
    arm.userData.skin.opacity = 0; arm.renderOrder = 3; arm.children.forEach((o) => { if (o !== inner) o.renderOrder = 3; });
    // venom (yellow) spreading from the fang tips, and blood at the two punctures
    const venM = new THREE.MeshPhysicalMaterial({ color: '#d9e04a', emissive: '#7a7a10', emissiveIntensity: 0.5, transparent: true, opacity: 0, depthWrite: false, roughness: 0.3 });
    const ven = new THREE.Group(); V.scene.add(ven); show.objs.push(ven);
    const drops = []; const Rv = rnd(9);
    for (let k = 0; k < 46; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), venM); const dir = V3(Rv() - 0.5, Rv() - 0.5, Rv() - 0.5).normalize(); m.userData = { dir, d: 0.2 + Rv() * 0.8, s: 0.5 + Rv(), from: k % 2 ? tip : tip2 }; m.renderOrder = 2; ven.add(m); drops.push(m); }
    const cloudM = new THREE.MeshPhysicalMaterial({ color: '#e8ec6a', transparent: true, opacity: 0, depthWrite: false, roughness: 0.6 });
    const clouds = [tip, tip2].map((p) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), cloudM); m.position.copy(p); m.renderOrder = 2; ven.add(m); return m; });
    // venom travelling along the nearest vein
    const vw = veinPts.map((p) => arm.localToWorld(p.clone())); const flow = [];
    for (let k = 0; k < 8; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(armR * 0.06, 10, 8), venM); m.renderOrder = 2; ven.add(m); flow.push(m); }
    const bloodM = new THREE.MeshPhysicalMaterial({ color: '#8e0d14', roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0 });
    const blood = [tip, tip2].map((p) => { const m = new THREE.Mesh(new THREE.SphereGeometry(armR * 0.07, 12, 10), bloodM); m.position.copy(p).addScaledVector(D, -depth * 0.95); m.scale.set(1, 1.6, 1); ven.add(m); return m; });
    const mm = Math.max(1, Math.round(depth * 1000));
    const kind = mo.fanged ? (plan === 'viper' || plan === 'pitviper' ? 'viper' : 'elapid') : plan === 'python' ? 'python' : 'colubrid';
    const T1 = 'The snake pulls its neck back into an <b>S-shape</b>, ready to strike.';
    const T2 = 'Strike! It takes less than a tenth of a second.';
    const T3 = { viper: 'Its long <b>hollow fangs</b> swing forward and go in about <b>' + mm + ' mm</b>.', elapid: 'Its short, fixed <b>front fangs</b> go in about <b>' + mm + ' mm</b>.', python: 'No fangs: rows of sharp, backward-curved <b>teeth</b> grip about <b>' + mm + ' mm</b> deep.', colubrid: 'Its small <b>teeth</b> only go in about <b>' + mm + ' mm</b>.' }[kind];
    const T4 = mo.fanged ? '<b>Venom</b> (yellow) is pushed through the fang into the tissue. <b>Veins</b> (blue) and <b>arteries</b> (red) can carry it round the body.' : 'Most bites like this are harmless: no venom, just small punctures that should be cleaned.';
    const T5 = mo.fanged ? 'That is why a venomous bite needs a <b>hospital fast</b>: keep still and calm - doctors treat it with <b>antivenom</b>.' : (kind === 'python' ? 'Pythons have <b>no venom</b>. They hold on with their teeth and squeeze.' : 'A few rear-fanged snakes have mild venom, so any bite should still be checked by a doctor.');
    const camWide = () => { const tg = c.clone().lerp(V.info.headPos, 0.45); const d = Math.max(st.len * 1.25, armR * 9) / Math.tan(V.info.vf) * 0.75; const dir = st.perp.clone().multiplyScalar(0.8).addScaledVector(D, -0.6).normalize(); return { tgt: tg, pos: tg.clone().addScaledVector(dir, d * Math.cos(0.45)).add(V3(0, d * Math.sin(0.45), 0)) }; };
    const camClose = () => { const tg = mid.clone().addScaledVector(D, -depth); const dir = st.perp.clone().multiplyScalar(0.85).addScaledVector(up, 0.5).addScaledVector(D, -0.45).normalize(); return { tgt: tg, pos: tg.clone().addScaledVector(dir, armR * 6.5) }; };
    // through the see-through arm, facing the snake: the fangs inside, the venom spreading
    const camXray = () => { const tg = mid.clone().addScaledVector(D, depth * 0.2); const dir = st.perp.clone().multiplyScalar(0.5).addScaledVector(up, 0.55).addScaledVector(D, 0.75).normalize(); return { tgt: tg, pos: tg.clone().addScaledVector(dir, armR * 5.2) }; };
    let camKey = camWide();
    const xray = (k) => { arm.userData.skin.opacity = 1 - k * 0.8; arm.userData.skin.depthWrite = k < 0.01; fadeTree(inner, k); };
    const venomOn = mo.fanged;
    const phases = [
      [1.2, (u) => { R.setPose(R.blend(rest, coil, ease(u))); R.apply(); arm.userData.skin.opacity = ease(u * 1.4); arm.userData.skin.depthWrite = u > 0.7; say(T1); stepTag.hidden = false; stepTag.textContent = '1 / 5'; camKey = camWide(); }],
      [0.8, (u, s) => { R.setPose(R.fore({ len: st.len, phi, lift: lift * 0.8, coil: 1 + 0.06 * Math.sin(s * 9) })); R.apply(); setMouth(0); arm.userData.skin.opacity = 1; arm.userData.skin.depthWrite = true; }],
      [0.28, (u) => { const k = ease(u * 1.15); R.setPose(R.blend(coil, ext, k)); R.apply(); setMouth(OPEN * ease(u * 3)); say(T2); stepTag.textContent = '2 / 5'; }],
      [1.3, (u) => { R.setPose(ext); R.apply(); setMouth(OPEN); say(T3); stepTag.textContent = '3 / 5'; if (u > 0.25) camKey = camClose(); blood.forEach((b) => { b.material.opacity = ease(u * 2); }); }],
      [1.0, (u) => { xray(ease(u)); if (u > 0.3) camKey = camXray(); }],
      [venomOn ? 4.2 : 2.6, (u, s) => {
        xray(1); say(u < 0.55 ? T4 : T5); stepTag.textContent = u < 0.55 ? '4 / 5' : '5 / 5';
        if (venomOn) {
          const k = ease(u * 1.3); venM.opacity = 0.85 * Math.min(1, u * 4); cloudM.opacity = 0.22 * k;
          clouds.forEach((m) => m.scale.setScalar(armR * (0.08 + 0.5 * k)));
          drops.forEach((m) => { const f = m.userData.from, dd = armR * m.userData.d * 0.75 * k; m.position.copy(f).addScaledVector(m.userData.dir, dd); m.scale.setScalar(armR * 0.022 * m.userData.s * (0.4 + k)); });
          flow.forEach((m, j) => { const ph = ((s * 0.35 + j / flow.length) % 1) * clamp(u * 2, 0, 1), idx = ph * (vw.length - 1), i0 = Math.floor(idx), w = idx - i0; m.position.copy(vw[i0]).lerp(vw[Math.min(vw.length - 1, i0 + 1)], w); m.visible = u > 0.15; });
        }
      }],
      [1.0, (u) => { const k = ease(u); xray(1 - k); venM.opacity = 0.85 * (1 - k); cloudM.opacity = 0.22 * (1 - k); R.setPose(R.blend(ext, coil, k)); R.apply(); setMouth(OPEN * (1 - k)); camKey = camWide(); say(''); stepTag.hidden = true; }],
      [1.3, (u) => { R.setPose(R.blend(coil, rest, ease(u))); R.apply(); arm.userData.skin.opacity = 1 - ease(u); arm.userData.skin.depthWrite = false; blood.forEach((b) => { b.material.opacity = 1 - ease(u); }); }],
    ];
    show.dur = total(phases);
    show.step = (s) => runPhases(phases, s);
    show.cam = () => camKey;
    show.end = () => { say(''); };
  }

  // ---------------------------------------------------------------- See it eat
  function eat() {
    const mo = V.extras.mouth; if (!mo) return;
    const R = rig, F = V.info.F, Hl = F.Hl, L = F.L, st = strikeSetup(0), D = st.D;
    const diet = dietOf(P, V.opts.id);
    const rB = (x) => Math.min(F.W(x), F.Hh(x));
    let kind = diet; if (kind === 'mouse' && L > 1.6) kind = 'rat';
    const pr = clamp(rB(L * 0.35) * (kind === 'egg' ? 1.3 : kind === 'snake' ? 0.55 : kind === 'fish' ? 1.1 : 1.3), Hl * 0.18, Hl * 0.8);
    const prey = buildPrey(kind, pr, 77); V.scene.add(prey); show.objs.push(prey);
    const Lp = prey.userData.len * (kind === 'snake' ? 1 : 0.92), prR = prey.userData.r;
    const restSnout = R.rest().subarray(0, 3);
    const lift = Math.max(0, prR * 0.95 - restSnout[1]) + Hl * 0.05;
    const phi = aim(st, lift), ext = R.fore({ len: st.len, phi, lift, coil: 0 }), coil = R.fore({ len: st.len, phi, lift: lift * 0.7, coil: 1 }), rest = R.rest();
    const constrict = (plan === 'python' || (plan === 'colubrid' && (kind === 'mouse' || kind === 'rat' || (kind === 'snake' && !venomous)))) && kind !== 'egg';
    const envenom = venomous && kind !== 'egg', viperWait = envenom && (plan === 'viper' || plan === 'pitviper') && (kind === 'mouse' || kind === 'rat');
    const strikes = kind !== 'egg';
    // the prey, held: its front at body position xp (x > 0 inside the mouth), its head pointing down the throat
    const xp0 = Hl * 0.22;
    let held = false, xp = xp0, worldM = null, preyHide = false;
    const placeHeld = () => { const xc = xp - Lp / 2, xa = Math.max(xc, Hl * 0.55), f = R.frameAtX(xa); if (xc < xa) f.c.addScaledVector(f.T, xc - xa); /* in front of the head: along its own axis (the snout tip dips) */ const m = new THREE.Matrix4().makeBasis(f.S.clone().negate(), f.U, f.T); prey.quaternion.setFromRotationMatrix(m); prey.position.copy(f.c); if (kind === 'snake') prey.position.addScaledVector(f.T, 0); };
    // where the prey will sit when the strike lands: hold it there now (computed with the reaching pose)
    R.setPose(ext); R.apply(); placeHeld(); prey.updateMatrixWorld(true); worldM = prey.matrix.clone(); R.setPose(rest); R.apply();
    // lay it on the ground (its belly on y = 0)
    const lay = () => { prey.matrix.copy(worldM); prey.matrix.decompose(prey.position, prey.quaternion, prey.scale); prey.position.y = Math.max(prey.position.y, prR * (kind === 'egg' ? 1.0 : 0.95)); };
    lay(); markFade(prey); fadeTree(prey, 0);
    // a spiral round the prey for constricting
    let spiral = null;
    if (constrict) {
      const C = prey.position.clone(), ih = R.ih, N = R.N, th = new Float32Array(N), base = ext, W = F.W(L * 0.35);
      // the coil's centre line, from the neck (sample ih) outwards round the prey
      const p0 = V3(base[ih * 3], 0, base[ih * 3 + 2]), r0 = Math.hypot(p0.x - C.x, p0.z - C.z), ph0 = Math.atan2(p0.z - C.z, p0.x - C.x);
      const r1 = Math.max(prR + W * 1.6, r0 + W * 0.7), b = W * 2.3 / TAU, turnSign = st.perp.dot(V3(-Math.sin(ph0), 0, Math.cos(ph0))) > 0 ? 1 : -1;
      const pts = []; for (let k = 0; k <= 900; k++) { const u = (k / 900) * TAU * 1.35, r = r0 + (r1 - r0) * (1 - Math.exp(-u * 5)) + b * u; pts.push([C.x + Math.cos(ph0 + turnSign * u) * r, C.z + Math.sin(ph0 + turnSign * u) * r]); }
      const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      const angAt = (s) => { let k = 1; while (k < cum.length - 1 && cum[k] < s) k++; return Math.atan2(pts[k][1] - pts[k - 1][1], pts[k][0] - pts[k - 1][0]); };
      const extTh = new Float32Array(N); for (let i = 0; i < N - 1; i++) extTh[i] = Math.atan2(base[i * 3 + 5] - base[i * 3 + 2], base[i * 3 + 3] - base[i * 3]);
      for (let i = 1; i < N - 1; i++) extTh[i] = extTh[i - 1] + angDiff(extTh[i - 1], extTh[i]);
      const sLen = cum[cum.length - 1]; let endA = 0;
      for (let i = 0; i < N - 1; i++) {
        if (i < ih) { th[i] = extTh[i]; continue; }
        const s = (i - ih) * R.dx;
        if (s < sLen) { const a = angAt(s); th[i] = th[i - 1] + angDiff(th[i - 1], lerp(extTh[i], a, sstep(0, Hl * 1.2, s))); endA = th[i]; }
        else th[i] = R.rth[i] + (endA - R.rth[Math.min(N - 1, ih + Math.round(sLen / R.dx))]);
      }
      th[N - 1] = th[N - 2];
      const ys = new Float32Array(N); for (let i = 0; i < N; i++) { const s = (i - ih) * R.dx; ys[i] = i < ih ? base[i * 3 + 1] : lerp(base[i * 3 + 1], F.Hh(i * R.dx) * F.bf + prR * 0.35 * (1 - sstep(sLen * 0.6, sLen, s)), sstep(0, Hl * 2, s)); }
      spiral = R.integrate(th, 0, base[0], base[2], ys);
      spiral.sLen = sLen;
    }
    const sq = (k) => { if (!spiral) return; const i0 = R.ih, i1 = Math.min(R.N - 1, R.ih + Math.round(spiral.sLen / R.dx)); for (let i = 0; i < R.N; i++) R.bul[i] = i >= i0 && i <= i1 ? 1 + k * 0.07 * sstep(i0, i0 + 12, i) * (1 - sstep(i1 - 12, i1, i)) : R.bul[i]; };
    const bulgeAt = (xFront, extra) => { // the swelling where the prey is inside the body
      for (let i = 0; i < R.N; i++) {
        const x = i * R.dx, u = (x - (xFront - Lp / 2)) / (Lp / 2); let k = 1;
        if (Math.abs(u) < 1) { const need = prR * Math.sqrt(1 - u * u) * 1.12 / Math.max(1e-6, rB(x)); k = Math.max(1, need); if (x < Hl * 1.1) k = Math.min(k, 1.3); }
        R.bul[i] = Math.max(1, lerp(1, k, extra));
      }
    };
    const xIn = Hl * 1.15 + Lp, xEnd = Math.max(xIn + Lp * 0.2, L * 0.45);
    const anatOn = () => !!(anat && anat.on);
    const camSide = (tg, d, el = 0.38, back = 0.25) => { const dir = st.perp.clone().addScaledVector(D, -back).normalize(); return { tgt: tg, pos: tg.clone().addScaledVector(dir, d * Math.cos(el)).add(V3(0, d * Math.sin(el), 0)) }; };
    const fitD = (sz) => sz / Math.tan(V.info.vf) * 0.62, wideD = fitD(Math.max(st.len * 1.25, Lp * 2.4));
    let camKey = camSide(prey.position.clone().lerp(V.info.headPos, 0.5), wideD);
    const headPt = () => R.point(Hl * 0.5);
    const nm = prey.userData.name;
    const T = {
      intro: { egg: 'Egg-eaters find <b>birds\' eggs</b> by smell.', fish: 'It hunts <b>' + nm + '</b>.', frog: 'It hunts <b>' + nm + '</b>, found by smell with its tongue.', snake: 'It hunts <b>' + nm + '</b> - some snakes eat other snakes!', lizard: 'It hunts <b>' + nm + '</b>.', mouse: 'It hunts <b>' + nm + '</b>, tracked by smell with its flicking tongue.', rat: 'It hunts <b>' + nm + '</b>, tracked by smell with its flicking tongue.' }[kind],
      strike: 'Strike! It grabs the prey with its backward-curved teeth.',
      inject: '<b>Venom</b> flows through the fangs into the prey.',
      release: 'Vipers <b>let go</b> straight away, so the prey cannot bite back, and wait for the venom to work.',
      track: 'Then it follows the scent trail with its tongue and finds the prey.',
      coil: '<b>Constricting:</b> it wraps its body round the prey and squeezes until the heart stops.',
      swallow: kind === 'egg' ? 'Its jaws stretch round an egg much wider than its head - it has almost no teeth.' : '<b>Jaw walking:</b> the left and right jaws move forward in turn, pulling the prey in head-first. The windpipe pokes out so it can still breathe.',
      down: kind === 'egg' ? 'Spikes on its backbone crack the shell inside its throat; it swallows the egg and spits out the shell.' : 'Muscles push the meal down to the <b>stomach</b>. The skin between the scales stretches - you can see the bulge.',
      digest: 'Digesting a big meal can take days to weeks. Then it is hungry again.',
    };
    const phases = [];
    phases.push([1.3, (u) => { fadeTree(prey, ease(u * 1.5)); R.setPose(R.blend(rest, strikes ? coil : ext, ease(u) * (strikes ? 1 : 0.3))); R.apply(); say(T.intro); }]);
    if (strikes) {
      phases.push([0.9, (u, s) => { R.setPose(R.fore({ len: st.len, phi, lift: lift * 0.7, coil: 1 + 0.05 * Math.sin(s * 9) })); R.apply(); }]);
      phases.push([0.3, (u) => { R.setPose(R.blend(coil, ext, ease(u * 1.15))); R.apply(); setMouth(0.75 * ease(u * 3)); say(T.strike); if (u >= 0.98) held = true; }]);
      phases.push([0.5, () => { held = true; R.setPose(ext); R.apply(); setMouth(0.55); camKey = camSide(headPt().lerp(prey.position, 0.35), fitD(Hl * 2.4 + Lp * 1.3)); }]);
      if (envenom) phases.push([1.2, (u, s) => { R.setPose(ext); R.apply(); setMouth(0.55 + 0.04 * Math.sin(s * 14)); say(T.inject); }]);
      if (viperWait) {
        phases.push([0.6, (u) => { held = false; R.setPose(R.blend(ext, coil, ease(u))); R.apply(); setMouth(0.55 * (1 - ease(u))); say(T.release); if (u > 0.5) camKey = camSide(prey.position.clone().lerp(V.info.headPos, 0.5), wideD); }]);
        phases.push([1.6, (u) => { R.setPose(coil); R.apply(); const q = new THREE.Quaternion().setFromAxisAngle(R.frameAtX(0).T, 1.3 * ease(u)); prey.matrix.copy(worldM); prey.matrix.decompose(prey.position, prey.quaternion, prey.scale); prey.quaternion.premultiply(q); prey.position.y = prR * (0.95 - 0.25 * ease(u)); }]);
        phases.push([1.5, (u) => { R.setPose(R.blend(coil, ext, ease(u))); R.apply(); setMouth(0.6 * ease(u)); say(T.track); if (u > 0.95) held = true; }]);
      }
      if (constrict) {
        phases.push([1.5, (u) => { held = true; R.setPose(R.blend(ext, spiral, ease(u))); R.apply(); setMouth(0.55); say(T.coil); camKey = camSide(prey.position.clone(), fitD(Math.max(prR * 7, F.W(L * 0.3) * 14)), 0.85, 0.1); }]);
        phases.push([1.8, (u, s) => { R.setPose(spiral); sq(0.5 + 0.5 * Math.sin(s * 5)); R.apply(); }]);
        phases.push([1.2, (u) => { R.bul.fill(1); R.setPose(R.blend(spiral, ext, ease(u))); R.apply(); }]);
      }
    } else phases.push([1.2, (u) => { R.setPose(R.blend(R.blend(rest, ext, 0.3), ext, ease(u))); R.apply(); setMouth(ease(u) * 0.9); if (u > 0.95) held = true; }]);
    phases.push([4.6, (u, s) => {
      held = true; xp = lerp(xp0, xIn, ease(u)); const yaw = 0.13 * Math.sin(s * 6.5) * (1 - sstep(0.85, 1, u));
      R.setPose(R.fore({ len: st.len, phi, lift, coil: 0, yaw })); bulgeAt(xp, 1); R.apply(); setMouth(lerp(0.75, 1, Math.sin(Math.min(1, u * 1.2) * Math.PI))); say(T.swallow);
      camKey = camSide(headPt().lerp(R.point(xp - Lp * 0.5), 0.3), fitD(Hl * 2.4 + Lp * 1.2), 0.42);
      preyHide = !anatOn() && xp - Lp > Hl * 0.95;
    }]);
    phases.push([3.4, (u) => {
      xp = lerp(xIn, xEnd, ease(u)); R.setPose(R.blend(ext, rest, ease(u) * 0.6)); bulgeAt(xp, 1); R.apply(); setMouth(lerp(0.75, 0, ease(u * 2))); say(T.down);
      preyHide = !anatOn();
      camKey = camSide(R.point(xp - Lp / 2), fitD(Math.max(L * 0.22, Lp * 3.2)), 0.55);
    }]);
    phases.push([1.8, (u) => { const b = R.blend(ext, rest, 0.6 + 0.4 * ease(u)); R.setPose(b); bulgeAt(xp, 1 - ease(u) * 0.5); R.apply(); setMouth(0); say(T.digest); camKey = camSide(V.info.center.clone(), fitD(V.info.Rb * 2.2), 0.6); }]);
    phases.push([0.8, (u) => { R.setPose(rest); bulgeAt(xp, 0.5 * (1 - ease(u))); R.apply(); }]);
    const stepPrey = () => {
      if (held) { placeHeld(); prey.visible = !preyHide; }
      if (!held && prey.matrixAutoUpdate === false) prey.matrixAutoUpdate = true;
    };
    show.dur = total(phases);
    show.step = (s) => { const i = runPhases(phases, s); stepPrey(); stepTag.hidden = false; stepTag.textContent = (i + 1) + ' / ' + phases.length; return i; };
    show.cam = () => camKey;
    show.diet = kind;
  }

  // ---------------------------------------------------------------- See eye shield (the spectacle)
  function eyeShow() {
    const eye = V.extras.eyes && V.extras.eyes[0]; if (!eye) return;
    eye.geometry.computeBoundingSphere(); const er = eye.geometry.boundingSphere.radius;
    const capG = new THREE.SphereGeometry(er * 1.1, 40, 20, 0, TAU, 0, Math.PI * 0.42).rotateX(Math.PI / 2);
    const clearM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, transmission: 0, transparent: true, opacity: 0.18, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.5 });
    const oldM = new THREE.MeshPhysicalMaterial({ color: '#a7c3df', roughness: 0.55, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const rimM = new THREE.MeshBasicMaterial({ color: '#ffd54a', transparent: true, opacity: 0, depthWrite: false });
    const cap = new THREE.Mesh(capG, clearM), old = new THREE.Mesh(capG, oldM), rim = new THREE.Mesh(new THREE.TorusGeometry(er * 1.1 * Math.sin(Math.PI * 0.42), er * 0.035, 8, 48), rimM);
    rim.position.z = er * 1.1 * Math.cos(Math.PI * 0.42); old.scale.setScalar(1.03); cap.renderOrder = old.renderOrder = rim.renderOrder = 4;
    eye.add(cap, old, rim); show.objs.push(cap, old, rim);
    const mat = V.extras.mat, col0 = mat.color.clone(), dull = new THREE.Color('#b9c7d6');
    const eyeW = () => eye.getWorldPosition(new THREE.Vector3());
    const out = () => V3(0, 0, 1).transformDirection(eye.matrixWorld).normalize();
    const camEye = (d, sideK = 0.35) => { const p = eyeW(), o = out(), hd = V.info.headDir.clone(); const dir = o.clone().addScaledVector(hd, sideK).add(V3(0, 0.25, 0)).normalize(); return { tgt: p, pos: p.clone().addScaledVector(dir, d) }; };
    const T = [
      'Snakes have <b>no eyelids</b>, so they can\'t blink or close their eyes - not even to sleep.',
      'Each eye is covered by a clear scale called the <b>spectacle</b> (or <b>brille</b>), like a built-in contact lens.',
      'Before shedding, fluid builds up under the old skin and the spectacle turns <b>cloudy blue</b>. For a few days the snake can hardly see.',
      'When it <b>sheds</b>, the old spectacle comes off together with the rest of its old skin...',
      '...and a <b>brand-new clear spectacle</b> is underneath. That is why snake eyes always look glassy.',
    ];
    let camKey = camEye(er * 16);
    const phases = [
      [1.4, (u) => { say(T[0]); camKey = camEye(er * 16); }],
      [3.2, (u) => { say(T[0]); rimM.opacity = 0; }],
      [3.4, (u, s) => { say(T[1]); rimM.opacity = 0.9 * ease(u * 3) * (0.75 + 0.25 * Math.sin(s * 5)); clearM.opacity = 0.18 + 0.12 * ease(u * 3); camKey = camEye(er * 10, 0.55); }],
      [3.8, (u) => { say(T[2]); rimM.opacity = 0.6 * (1 - ease(u * 3)); oldM.opacity = 0.82 * ease(u * 1.6); mat.color.copy(col0).lerp(dull, ease(u * 1.6) * 0.55); }],
      [3.4, (u) => { say(T[3]); const k = ease(u); old.position.set(-er * 1.6 * k, 0, er * 0.25 * k); old.rotation.y = -0.9 * k; /* peels off backwards with the old skin */ oldM.opacity = 0.82 * (1 - ease((u - 0.35) / 0.65)); mat.color.copy(col0).lerp(dull, 0.55 * (1 - k)); }],
      [3.4, (u, s) => { say(T[4]); oldM.opacity = 0; mat.color.copy(col0); rimM.opacity = 0.9 * ease(u * 3) * (0.75 + 0.25 * Math.sin(s * 5)); }],
      [1.2, (u) => { rimM.opacity = 0.9 * (1 - ease(u)); }],
    ];
    show.dur = total(phases);
    show.step = (s) => { const i = runPhases(phases, s); stepTag.hidden = false; stepTag.textContent = Math.min(5, Math.max(1, i)) + ' / 5'; return i; };
    show.cam = () => camKey;
    show.end = () => { mat.color.copy(col0); };
  }

  // ---------------------------------------------------------------- Slither (loops until pressed again)
  function startSlither() {
    if (show) stopShow(); ensureRig(); if (!rig) return;
    const R = rig, info = V.info, F = info.F, L = F.L, N = R.N, Hl = F.Hl;
    const stout = plan === 'python' || ((plan === 'viper' || plan === 'pitviper') && (P.body && P.body.ld ? P.body.ld < 14 : L / (F.w0 * 2) < 16));
    // an oval track, long across the screen, with the waves of its body drawn into it
    const Pm = Math.max(L * 2.35, info.Rb * 4.2), eb = Pm / 9.69, ea = eb * 2, waves = Math.max(3, Math.round(Pm / (L / 1.7))), A = stout ? 0 : Math.min(L * 0.07, eb * 0.35);
    const az = V.controls.st.az, rx = Math.cos(az), rz = -Math.sin(az), fx0 = Math.sin(az), fz0 = Math.cos(az);
    const cx = info.center.x, cz = info.center.z, M = 4000, pts = [], cum = [0];
    for (let k = 0; k <= M; k++) { const a = (k / M) * TAU, w = A * Math.sin(a * waves), u = (ea + w) * Math.cos(a), v = (eb + w) * Math.sin(a); pts.push([cx + rx * u + fx0 * v, cz + rz * u + fz0 * v]); if (k) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])); }
    const need = Math.max((ea + A + F.w0 * 2) * 1.12 / Math.tan(info.hf), (eb + A + F.w0 * 2) * 1.5 / Math.tan(info.vf)) + info.hMax;
    fx.zoomOut = Math.max(1, need * 1.08 / info.dMax);
    V.controls.setGoal({ el: 0.8, d: need, px: 0, pz: 0 });
    const tot = cum[M], at = (s) => { s = ((s % tot) + tot) % tot; let lo = 0, hi = M; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < s) lo = m; else hi = m; } const w = (s - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]); return [lerp(pts[lo][0], pts[hi][0], w), lerp(pts[lo][1], pts[hi][1], w)]; };
    // start where the path passes closest to the head
    const hx = R.rc[0], hz = R.rc[2]; let s0 = 0, bd = 1e18; for (let k = 0; k < M; k += 4) { const d = (pts[k][0] - hx) ** 2 + (pts[k][1] - hz) ** 2; if (d < bd) { bd = d; s0 = cum[k]; } }
    const ys = new Float32Array(N); for (let i = 0; i < N; i++) { const x = i * R.dx, b = F.Hh(x) * F.bf; ys[i] = b + clamp(R.restY[i] - b, 0, F.Hh(Hl * 0.6) * 0.9) * (1 - sstep(Hl * 1.5, Hl * 4, x)); }
    const speed = (stout ? 0.07 : 0.24) * L * (reduceK());
    const rest = R.rest();
    slither = { t0: now(), stout, pose: (t) => { const sh = s0 + speed * t, out = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const p = at(sh - i * R.dx); out[i * 3] = p[0]; out[i * 3 + 1] = ys[i]; out[i * 3 + 2] = p[1]; } return out; }, rest, stopping: 0 };
    bSlither.setAttribute('aria-pressed', 'true'); bSlither.textContent = 'Stop slithering';
    tip.hidden = false; tip.textContent = stout ? 'Heavy snakes often creep in a straight line ("caterpillar" crawling): belly scales grip and push in waves.' : 'Lateral undulation: waves run down the body and push against the ground, so every part follows the path of the head.';
    V.kick();
  }
  const reduceK = () => (V.reduce() ? 0.5 : 1);
  function stepSlither() {
    const S = slither, R = rig, t = (now() - S.t0) / 1000;
    let pose = S.pose(t);
    const inK = ease(t / 1.6);
    if (S.stopping) { const k = ease((now() - S.stopping) / 1200); pose = R.blend(S.lastPose || pose, S.rest, k); if (k >= 1) { slither = null; R.release(); tip.hidden = true; unzoom(); return false; } }
    else { S.lastPose = pose; if (inK < 1) pose = R.blend(S.rest, pose, inK); }
    if (S.stout) { const N = R.N; for (let i = 0; i < N; i++) R.bul[i] = 1 + 0.03 * Math.sin(TAU * (i * R.dx / (R.L * 0.1) - t * 1.4)) * sstep(R.ih, R.ih + 30, i); }
    R.setPose(pose); R.apply(); return true;
  }
  function stopSlither(soft) {
    if (!slither) return;
    bSlither.setAttribute('aria-pressed', 'false'); bSlither.textContent = 'Slither';
    if (soft && !V.reduce()) { if (!slither.stopping) slither.stopping = now(); V.kick(); return; }
    slither = null; if (rig) rig.release(); tip.hidden = true; unzoom();
  }
  function unzoom() { if (fx.zoomOut > 1) { fx.zoomOut = 1; V.controls.setGoal({ d: Math.min(V.controls.st.goal ? V.controls.st.goal.d : V.controls.st.d, V.info.dMax), el: (V.info.portrait ? 40 : 30) * Math.PI / 180 }); } }

  // ================================================================= Anatomy: see-through skin, organs inside, tap to learn
  function buildAnatomy() {
    const R = ensureRig(), info = V.info, F = info.F, B = info.body, L = F.L, Hl = F.Hl, mo = V.extras.mouth;
    const tail = (P.body && P.body.tail) || 0.12, svl = L * (1 - tail);
    const rB = (x) => Math.min(F.W(x), F.Hh(x));
    const grp = new THREE.Group(); grp.userData.noRig = true; grp.name = 'anatomy'; V.group.add(grp);
    const parts = [], own = [];
    const om = (col, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: 0.42, metalness: 0, emissive: col, emissiveIntensity: 0.12 }, o));
    // a tube along the body from x0 to x1: centre offset (s across, u up, both as fractions of the body's half-size), radius r(x)
    const sweep = (x0, x1, fs, fu, fr, n = 64, m = 14, aspect = 1) => {
      const pos = [], xs = [], idx = [];
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = lerp(x0, x1, t), c = B.spine(x), f = B.frameAt(x), w = F.W(x), h = F.Hh(x), env = Math.pow(Math.sin(Math.PI * clamp(t, 0.0005, 0.9995)), 0.3);
        const cc = c.clone().addScaledVector(f.S, (typeof fs === 'function' ? fs(x, t) : fs) * w).addScaledVector(f.U, (typeof fu === 'function' ? fu(x, t) : fu) * h), r = fr(x, t) * env;
        for (let j = 0; j <= m; j++) { const a = (j / m) * TAU, p = cc.clone().addScaledVector(f.S, Math.cos(a) * r * aspect).addScaledVector(f.U, Math.sin(a) * r); pos.push(p.x, p.y, p.z); xs.push(x); }
      }
      for (let k = 0; k < n; k++) for (let j = 0; j < m; j++) { const a = k * (m + 1) + j, b = a + m + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); g.userData.xs = new Float32Array(xs); return g;
    };
    const blob = (x, s, u, rx, ry, rz) => { // an ellipsoid sitting in the body at x
      const g = new THREE.SphereGeometry(1, 20, 14), f = B.frameAt(x), c = B.spine(x).addScaledVector(f.S, s * F.W(x)).addScaledVector(f.U, u * F.Hh(x));
      g.scale(rz, ry, rx); const m = new THREE.Matrix4().makeBasis(f.S, f.U, f.T).setPosition(c); g.applyMatrix4(m); g.userData.x = x; return g;
    };
    const add = (key, name, text, region, geo, mat, opt = {}) => {
      const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = false; mesh.userData.part = key; grp.add(mesh); own.push(mesh);
      const xs = geo.userData.xs || new Float32Array(geo.attributes.position.count).fill(geo.userData.x || 0);
      if (opt.rigid) { R.headRig.add(mesh); } else R.addSkin(geo, xs);
      let p = parts.find((q) => q.key === key); if (!p) { p = { key, name, text, region, meshes: [], x: opt.x != null ? opt.x : xs[xs.length >> 1] }; parts.push(p); } p.meshes.push(mesh);
      return mesh;
    };
    const venomG = venomous;
    // ---- head (rigid: moves with the head)
    const bone = om('#efe6d0', { roughness: 0.6, emissiveIntensity: 0.05 });
    const bc = blob(Hl * 0.68, 0, 0.25, Hl * 0.2, F.Hh(Hl * 0.68) * 0.42, F.W(Hl * 0.68) * 0.42);
    add('skull', 'Skull', 'Light, strong bones protect the brain. Many skull bones are only loosely joined, so the mouth can open very wide.', 'head', bc, new THREE.MeshStandardMaterial({ color: '#efe6d0', roughness: 0.6, transparent: true, opacity: 0.55, depthWrite: false }), { rigid: true, x: Hl * 0.6 });
    for (const sg of [1, -1]) {
      add('skull', 'Skull', '', 'head', sweep(Hl * 0.06, Hl * 0.72, sg * 0.42, 0.62, (x) => rB(x) * 0.07, 24, 6), bone, { rigid: true });                    // nasal / frontal ridge
      add('skull', 'Skull', '', 'head', sweep(Hl * 0.08, Hl * 0.95, sg * 0.82, -0.12, (x) => rB(x) * 0.07, 24, 6), bone, { rigid: true });                   // upper jaw bones
      add('jaw', 'Lower jaw', 'Two separate halves joined at the chin by stretchy tissue, so each side can move forward on its own ("jaw walking").', 'head', sweep(Hl * 0.05, Hl * 1.0, sg * 0.72, -0.62, (x) => rB(x) * 0.075, 24, 6), bone, { rigid: true, x: Hl * 0.5 });
    }
    add('brain', 'Brain', 'Small and long. The parts for smell and for sight are big; snakes rely mostly on smell, taste and feeling vibrations.', 'head', blob(Hl * 0.7, 0, 0.28, Hl * 0.14, F.Hh(Hl * 0.7) * 0.26, F.W(Hl * 0.7) * 0.24), om('#e7b2a9'), { rigid: true });
    add('jacobson', 'Jacobson\'s organ', 'Two small pits in the roof of the mouth. The forked tongue brings smell particles here, so the snake "tastes" the air.', 'head', mergeG([blob(Hl * 0.14, 0.18, -0.05, Hl * 0.05, F.Hh(Hl * 0.14) * 0.14, F.W(Hl * 0.14) * 0.1), blob(Hl * 0.14, -0.18, -0.05, Hl * 0.05, F.Hh(Hl * 0.14) * 0.14, F.W(Hl * 0.14) * 0.1)]), om('#d77fa4'), { rigid: true });
    if (venomG) add('venom', 'Venom glands', 'Changed saliva glands behind the eyes. Muscles squeeze the venom through a tube into the fangs.', 'head', mergeG([1, -1].map((sg) => blob(Hl * 0.66, sg * 0.62, -0.18, Hl * 0.17, F.Hh(Hl * 0.66) * 0.24, F.W(Hl * 0.66) * 0.2))), om('#e9cf63'), { rigid: true });
    const tongue = add('tongue', 'Forked tongue', 'Flicks out to collect smells from the air and the ground. The two tips tell left from right, so it can follow a scent trail. It lives in a sheath when not in use.', 'head', mergeG([sweep(Hl * 0.12, Hl * 0.95, 0, -0.42, (x) => rB(x) * 0.06, 20, 6), ...[1, -1].map((sg) => sweep(Hl * 0.02, Hl * 0.16, (x) => sg * 0.25 * (1 - x / (Hl * 0.16)), -0.42, (x) => rB(x) * 0.03, 8, 5))]), om('#3b1d2a'), { rigid: true, x: Hl * 0.3 });
    void tongue;
    // ---- airways, gut and the rest (bend with the body)
    add('trachea', 'Windpipe (trachea) and glottis', 'Stiff rings keep it open. Its opening, the glottis, can be pushed out of the side of the mouth so the snake breathes while swallowing big prey.', 'body', sweep(Hl * 0.32, svl * 0.25, 0.1, -0.32, (x) => rB(x) * 0.12, 120, 10), om('#e7dcc9', { map: canvasTex(64, (x, s) => { x.fillStyle = '#e9dfcc'; x.fillRect(0, 0, s, s); x.fillStyle = 'rgba(150,120,100,.45)'; for (let i = 0; i < s; i += 8) x.fillRect(0, i, s, 3); }, 1, 60) }));
    if (plan !== 'python' && plan !== 'blind') add('tlung', 'Tracheal lung', 'Extra breathing tissue along the windpipe that many snakes have, in front of the heart.', 'body', sweep(svl * 0.12, svl * 0.22, 0.05, -0.12, (x) => rB(x) * 0.22, 40, 10), om('#f0a4a4', { transparent: true, opacity: 0.75 }));
    add('oesophagus', 'Gullet (oesophagus)', 'A long, very stretchy tube from the mouth to the stomach. Food is pushed along it by muscles.', 'body', sweep(Hl * 0.95, svl * 0.47, -0.05, 0.18, (x) => rB(x) * 0.17, 160, 10), om('#e8a69a'));
    const hx = svl * 0.24;
    add('heart', 'Heart', 'About a quarter of the way along the body. It has three chambers and can slide a little, so big prey can squeeze past.', 'body', blob(hx, 0, -0.32, Math.max(rB(hx) * 0.9, svl * 0.022), rB(hx) * 0.38, F.W(hx) * 0.34), om('#b3121f', { emissiveIntensity: 0.25 }));
    add('lung', 'Right lung', 'Snakes have one long working lung (the left one is tiny or missing), because their body is so narrow.', 'body', sweep(svl * 0.26, svl * 0.56, -0.32, 0.12, (x, t) => rB(x) * 0.34 * (1 - t * 0.25), 90, 12), om('#ee8e8e', { roughness: 0.75, map: speckle('#ee9b98', 1600, 0.3, 4) }));
    add('airsac', 'Air sac', 'The back part of the lung has no blood vessels: it is a thin bag that stores air, like a balloon.', 'body', sweep(svl * 0.55, svl * 0.8, -0.32, 0.12, (x, t) => rB(x) * 0.3 * (1 - t * 0.5), 70, 12), new THREE.MeshPhysicalMaterial({ color: '#dfe9f2', roughness: 0.2, transparent: true, opacity: 0.45, depthWrite: false, clearcoat: 1 }));
    add('liver', 'Liver', 'Long and thin to fit the body. It cleans the blood and stores energy.', 'body', sweep(svl * 0.32, svl * 0.57, 0.24, -0.12, (x, t) => rB(x) * 0.33 * Math.min(1, 0.6 + t), 80, 12), om('#6d1f1b', { roughness: 0.35 }));
    add('stomach', 'Stomach', 'Very stretchy. Strong acid digests the whole prey - even bones.', 'body', sweep(svl * 0.57, svl * 0.68, 0, -0.05, (x, t) => rB(x) * 0.34 * (1 - Math.abs(t - 0.4) * 0.5), 40, 14), om('#d99383', { map: canvasTex(64, (x, s) => { x.fillStyle = '#dd9a8c'; x.fillRect(0, 0, s, s); x.strokeStyle = 'rgba(140,60,50,.35)'; x.lineWidth = 2; for (let i = 0; i < s; i += 7) { x.beginPath(); x.moveTo(0, i); x.bezierCurveTo(s * 0.3, i + 4, s * 0.6, i - 4, s, i); x.stroke(); } }, 2, 3) }));
    add('triad', 'Gallbladder, pancreas and spleen', 'A small cluster just behind the stomach: the gallbladder (green) and pancreas help digest fat and food, the spleen fights germs.', 'body', mergeG([blob(svl * 0.69, 0.1, -0.1, rB(svl * 0.69) * 0.24, rB(svl * 0.69) * 0.2, F.W(svl * 0.69) * 0.18)]), om('#4f8a3a'));
    add('triad', 'Gallbladder, pancreas and spleen', '', 'body', blob(svl * 0.705, -0.15, -0.05, rB(svl * 0.7) * 0.22, rB(svl * 0.7) * 0.16, F.W(svl * 0.7) * 0.16), om('#e6c98a'));
    add('triad', 'Gallbladder, pancreas and spleen', '', 'body', blob(svl * 0.715, 0.12, 0.1, rB(svl * 0.71) * 0.16, rB(svl * 0.71) * 0.14, F.W(svl * 0.71) * 0.14), om('#7a2033'));
    add('intestine', 'Intestines', 'Take the goodness out of the digested food. In snakes they are fairly short and loop gently along the body.', 'body', sweep(svl * 0.72, svl * 0.985, (x) => 0.28 * Math.sin((x / svl) * 120), (x) => -0.1 + 0.2 * Math.cos((x / svl) * 120), (x) => rB(x) * 0.16, 160, 8), om('#e3b19a'));
    for (const [sg, a] of [[-1, 0.73], [1, 0.77]]) add('gonads', 'Ovaries or testes', 'The organs that make eggs (females) or sperm (males). One sits a little in front of the other, to fit the long body.', 'body', sweep(svl * a, svl * (a + 0.06), sg * 0.3, 0.22, (x) => rB(x) * 0.15, 24, 10), om('#f1e1bf'));
    for (const [sg, a] of [[-1, 0.84], [1, 0.87]]) add('kidneys', 'Kidneys', 'Long and lobed, one in front of the other. They clean the blood; snakes save water by making a white paste (urates) instead of runny urine.', 'body', sweep(svl * a, svl * (a + 0.08), sg * 0.3, 0.36, (x, t) => rB(x) * 0.17 * (0.8 + 0.2 * Math.cos(t * 40)), 40, 10), om('#8c3434'));
    // backbone and ribs
    const ribs = []; const nRib = Math.round(clamp(L / F.w0 / 3.2, 40, 110));
    for (let k = 0; k < nRib; k++) {
      const x = lerp(Hl * 1.25, svl * 0.995, k / (nRib - 1)), f = B.frameAt(x), c = B.spine(x), w = F.W(x), h = F.Hh(x);
      for (const sg of [1, -1]) { const pts = []; for (let j = 0; j <= 6; j++) { const a = 0.12 + (j / 6) * 2.25; pts.push(c.clone().addScaledVector(f.S, sg * Math.sin(a) * w * 0.84).addScaledVector(f.U, Math.cos(a) * h * 0.78).addScaledVector(f.T, (j / 6) * w * 0.25)); } const g = varTube(pts, () => rB(x) * 0.035, 4, 8, false); g.userData.x = x; ribs.push(g); }
    }
    add('spine', 'Backbone and ribs', 'Snakes have 100 to over 400 vertebrae, each with a pair of ribs (none in the tail). The ribs are not joined underneath, so the body can stretch round big meals.', 'body', mergeG([sweep(Hl * 1.0, L * 0.995, 0, 0.58, (x) => rB(x) * 0.11, 260, 8), ...ribs]), om('#efe8d6', { roughness: 0.55, emissiveIntensity: 0.05 }));
    // ---- tail
    add('cloaca', 'Cloaca (vent)', 'One opening for droppings, urates, eggs and mating. The tail starts here.', 'tail', blob(svl, 0, -0.55, rB(svl) * 0.45, rB(svl) * 0.22, F.W(svl) * 0.3), om('#b05a5a'));
    add('tailp', 'Tail', 'From the vent to the tip. It has backbone but no ribs and no big organs (in males, the mating organs sit inside its base).' + (P.tail && P.tail.rattle ? ' Rattlesnakes add a new rattle segment each time they shed.' : ''), 'tail', sweep(svl * 1.01, L * 0.97, 0, 0.1, (x) => rB(x) * 0.2, 60, 8), om('#d6b8a0', { transparent: true, opacity: 0.6 }));
    // the mouth's own parts (teeth, fangs, glottis, tongue sheath), classified by shape
    const extra = [];
    if (mo && mo.anchors && mo.anchors.teeth) {
      const inside = mo.anchors.teeth.parent.parent;
      inside.traverse((o) => {
        if (!o.isMesh) return; const ty = o.geometry.type;
        let key = null;
        if (ty === 'ConeGeometry') key = mo.fanged && o.scale.y >= mo.anchors.fangLen * 0.9 ? 'fang' : 'teeth';
        else if (ty === 'CylinderGeometry' && o.geometry.parameters.openEnded) key = 'glottis';
        else if (ty === 'TorusGeometry' || ty === 'CircleGeometry' && o.material.color && o.material.color.r < 0.25 && o.parent !== inside) key = 'glottis';
        else if (ty === 'SphereGeometry') key = 'sheath';
        else if (ty === 'CylinderGeometry') key = 'tongue';
        else if (ty === 'TubeGeometry') key = 'palate';
        if (!key) return; extra.push([key, o]);
      });
    }
    const INFO = {
      fang: ['Fangs', plan === 'viper' || plan === 'pitviper' ? 'Long and hollow, like needles. They fold back against the roof of the mouth when it closes and swing forward to bite.' : 'Short and fixed at the front of the mouth, with a groove or channel that carries the venom.'],
      teeth: ['Teeth', 'Many small teeth that curve backwards to hold prey. Snakes don\'t chew - they swallow food whole. Lost teeth grow back.'],
      palate: ['Palate teeth', 'Two extra rows of teeth on the roof of the mouth. They "walk" the food into the throat.'],
      glottis: ['Glottis', 'The opening of the windpipe on the floor of the mouth. It can be pushed forward so the snake keeps breathing while swallowing.'],
      sheath: ['Tongue sheath', 'A pocket on the floor of the mouth where the forked tongue is kept.'],
      tongue: ['Forked tongue', 'Flicks out to collect smells and brings them to the Jacobson\'s organ.'],
    };
    for (const [key, o] of extra) { let p = parts.find((q) => q.key === key); if (!p) { p = { key, name: INFO[key][0], text: INFO[key][1], region: 'head', meshes: [], x: Hl * 0.3 }; parts.push(p); } p.meshes.push(o); o.userData.part = key; }
    (V.extras.eyes || []).forEach((e) => { let p = parts.find((q) => q.key === 'eye'); if (!p) { p = { key: 'eye', name: 'Eye', text: 'No eyelids: a clear scale, the spectacle, covers and protects it. ' + (P.head && P.head.pupil === 'slit' ? 'Slit pupils open wide at night - most snakes with them hunt in the dark.' : 'Round pupils are common in snakes that hunt by day.'), region: 'head', meshes: [], x: Hl * 0.3 }; parts.push(p); } p.meshes.push(e); e.userData.part = 'eye'; });
    if (P.head && P.head.pits) parts.push({ key: 'pits', name: 'Heat pits', text: 'Pits that "see" the warmth of animals, even in total darkness - like a heat camera.', region: 'head', meshes: [], x: Hl * 0.15 });
    const mesh = V.group.children.find((o) => o.isMesh && o.geometry === info.body.geo);
    parts.push({ key: 'skin', name: 'Skin and scales', text: (P.scales && P.scales.keel > 0.3 ? 'Keeled scales (each has a ridge). ' : 'Smooth scales. ') + 'Scales are made of keratin, like your fingernails. The wide belly scales grip the ground. The whole skin is shed in one piece as the snake grows.', region: 'body', meshes: mesh ? [mesh] : [], x: L * 0.4, skin: true });
    if (P.tail && P.tail.rattle) parts.push({ key: 'rattle', name: 'Rattle', text: 'Hollow, loosely linked segments of keratin. Shaking them makes a buzz that warns animals to keep away.', region: 'tail', meshes: R.tailRig.children.filter((o) => o.isMesh), x: L });
    if (R.active) R.apply();
    return { grp, parts, svl, own };
  }

  function anatomyCtl() {
    const st = { on: false, data: null, sel: null, outline: [], mat0: null, list: null, regs: [], ring: null };
    const hl = el('div', 'sp3d-hl'); hl.hidden = true; labels.appendChild(hl);
    const card = el('div', 'sp3d-info'); card.hidden = true; card.setAttribute('role', 'note'); labels.appendChild(card);
    const ring = el('div', 'sp3d-ring'); ring.hidden = true; labels.appendChild(ring);
    function skinSeeThrough(v) {
      const m = V.extras.mat; if (!m) return;
      if (v) { if (!st.mat0) st.mat0 = { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite }; if (m.transparent && m.opacity === 0.26) return; m.transparent = true; m.opacity = 0.26; m.depthWrite = false; }
      else if (st.mat0) { Object.assign(m, st.mat0); st.mat0 = null; } else return;
      m.needsUpdate = true;
    }
    function insideVisible() { const mo = V.extras.mouth; if (st.on && mo && mo.anchors && mo.anchors.teeth) mo.anchors.teeth.parent.parent.visible = true; }
    function regions() {
      st.regs.forEach((r) => r.el.remove()); st.regs = [];
      const F = V.info.F, L = F.L, svl = st.data.svl;
      for (const [k, name, x, u] of [['head', 'Head', F.Hl * 0.5, 2.6], ['body', 'Body', svl * 0.45, 2.4], ['tail', 'Tail', (svl + L) / 2, 3]]) {
        const e = el('div', 'sp3d-reg'); e.appendChild(el('span', '', name)); const b = el('button', '', 'See more'); b.type = 'button'; e.appendChild(b); labels.appendChild(e);
        on(b, 'click', (ev) => { ev.stopPropagation(); seeMore(k); });
        st.regs.push({ el: e, k, x, u });
      }
    }
    function seeMore(k) {
      const F = V.info.F, L = F.L, svl = st.data.svl, R = rig;
      const x = k === 'head' ? F.Hl * 0.5 : k === 'body' ? svl * 0.45 : (svl + L) / 2;
      const p = R.point(x), d = k === 'head' ? Math.max(V.info.dMin * 1.25, F.Hl * 6) : k === 'body' ? V.info.dFit * 0.7 : Math.max(V.info.dMin * 1.4, (L - svl) * 2.4);
      V.focus(p, d, k === 'body' ? 0.75 : 0.5);
      if (st.list) st.list.remove();
      const ls = el('div', 'sp3d-list'); ls.setAttribute('role', 'dialog'); ls.setAttribute('aria-label', k + ' parts');
      ls.appendChild(el('h4', '', { head: 'Head', body: 'Body', tail: 'Tail' }[k] + ': its parts'));
      const x2 = el('button', 'sp3d-ix', '×'); x2.type = 'button'; x2.setAttribute('aria-label', 'Close'); on(x2, 'click', () => { ls.remove(); st.list = null; }); ls.appendChild(x2);
      for (const p of st.data.parts.filter((q) => q.region === k)) { const b = el('button', 'sp3d-li', p.name); b.type = 'button'; on(b, 'click', () => select(p)); ls.appendChild(b); p.li = b; }
      labels.appendChild(ls); st.list = ls; V.kick();
    }
    function clearSel() {
      st.outline.forEach((o) => { if (o.parent) o.parent.remove(o); o.material.dispose(); }); st.outline = [];
      st.sel = null; hl.hidden = card.hidden = ring.hidden = true;
      if (st.list) st.list.querySelectorAll('.sp3d-li').forEach((b) => b.removeAttribute('aria-current'));
    }
    function outlineMat(w) {
      const m = new THREE.MeshBasicMaterial({ color: '#ffd54a', side: THREE.BackSide, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false });
      m.onBeforeCompile = (sh) => { sh.uniforms.uW = { value: w }; sh.vertexShader = 'uniform float uW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uW;'); };
      return m;
    }
    function select(p) {
      clearSel(); st.sel = p;
      if (p.li) p.li.setAttribute('aria-current', 'true');
      const F = V.info.F, w = Math.min(F.W(clamp(p.x, 0, F.L)), F.Hh(clamp(p.x, 0, F.L))) * 0.07;
      for (const m of p.meshes) {
        if (p.skin) continue;
        const s = m.getWorldScale(new THREE.Vector3()), ol = new THREE.Mesh(m.geometry, outlineMat(w / Math.max(1e-6, (s.x + s.y + s.z) / 3))); ol.renderOrder = 9; ol.raycast = () => {}; m.add(ol); st.outline.push(ol);
      }
      card.innerHTML = ''; card.appendChild(el('h4', '', p.name)); card.appendChild(el('p', '', p.text || ''));
      const x = el('button', 'sp3d-ix', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); on(x, 'click', clearSel); card.appendChild(x);
      card.hidden = false; card.dataset.sz = '';
      V.kick();
    }
    const ndc = new THREE.Vector3(), wv = new THREE.Vector3();
    function screenBox(p) { // the selected part's outline on screen
      const w = stage.clientWidth, h = stage.clientHeight; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0;
      const addP = (v) => { ndc.copy(v).project(V.cam); if (ndc.z > 1) return; const sx = (ndc.x * 0.5 + 0.5) * w, sy = (-ndc.y * 0.5 + 0.5) * h; x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy); n++; };
      if (p.key === 'pits') { addP(rig.point(V.info.F.Hl * 0.15, V.info.F.W(V.info.F.Hl * 0.15) * 0.9, 0)); addP(rig.point(V.info.F.Hl * 0.15, -V.info.F.W(V.info.F.Hl * 0.15) * 0.9, 0)); }
      else if (p.skin) { for (let i = 0; i <= 40; i++) addP(rig.point((i / 40) * V.info.F.L)); }
      else for (const m of p.meshes) { const pa = m.geometry.attributes.position, step = Math.max(1, Math.floor(pa.count / 160)); m.updateMatrixWorld(); for (let i = 0; i < pa.count; i += step) addP(wv.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld)); }
      return n ? [x0, y0, x1, y1] : null;
    }
    function after() {
      if (!st.on) return;
      insideVisible();
      const w = stage.clientWidth, h = stage.clientHeight;
      for (const r of st.regs) { ndc.copy(rig.point(r.x, 0, V.info.F.Hh(clamp(r.x, 0, V.info.F.L)) * r.u)).project(V.cam); const vis = ndc.z < 1 && Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1; r.el.hidden = !vis || !!show; if (vis) r.el.style.transform = 'translate(' + ((ndc.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-ndc.y * 0.5 + 0.5) * h).toFixed(1) + 'px) translate(-50%,-100%)'; }
      if (!st.sel) return;
      const b = screenBox(st.sel); if (!b) { hl.hidden = true; return; }
      const pad = 6, bx = clamp(b[0] - pad, 2, w - 10), by = clamp(b[1] - pad, 2, h - 10), bw = Math.max(16, Math.min(w - 2, b[2] + pad) - bx), bh = Math.max(16, Math.min(h - 2, b[3] + pad) - by);
      hl.hidden = false; hl.style.transform = 'translate(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px)'; hl.style.width = bw.toFixed(1) + 'px'; hl.style.height = bh.toFixed(1) + 'px';
      const cw = card.offsetWidth || 240, ch = card.offsetHeight || 90;
      let cx = bx + bw + 10, cy = clamp(by, 6, h - ch - 6);
      if (cx + cw > w - 6) cx = bx - cw - 10;
      if (cx < 6) { cx = clamp(bx, 6, w - cw - 6); cy = by + bh + 10 + ch < h ? by + bh + 10 : Math.max(6, by - ch - 10); }
      if (w < 520) { cx = w - cw - 8; cy = h - ch - 34; } // phones: the card sits at the bottom right, clear of the parts list
      card.style.transform = 'translate(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px)';
    }
    const ray = new THREE.Raycaster();
    function pick(e) {
      if (!st.on || !st.data) return null;
      const r = V.canvas.getBoundingClientRect(), m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(m, V.cam);
      const objs = []; for (const p of st.data.parts) for (const o of p.meshes) if (!p.skin) { if (o.geometry && !o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); objs.push(o); }
      V.scene.updateMatrixWorld();
      const hit = ray.intersectObjects(objs, false).find((h) => h.object.visible !== false);
      if (hit) return st.data.parts.find((p) => p.meshes.includes(hit.object));
      const sk = st.data.parts.find((p) => p.skin); if (sk && sk.meshes[0]) { sk.meshes[0].geometry.computeBoundingSphere(); if (ray.intersectObject(sk.meshes[0], false).length) return sk; }
      return null;
    }
    function set(v) {
      if (v === st.on) return; st.on = v; V.bAnat.setAttribute('aria-pressed', String(v));
      if (v) {
        if (!st.data) st.data = buildAnatomy();
        skinSeeThrough(true); setOrganVis(true); regions();
        tip.hidden = false; tip.textContent = (window.innerWidth < 560 ? 'Tap' : 'Click') + ' any part to learn what it is.';
        if (!V.scaleOn() && !show) V.view({ el: 0.62 });
      } else {
        clearSel(); skinSeeThrough(false); setOrganVis(false); st.regs.forEach((r) => r.el.remove()); st.regs = []; if (st.list) { st.list.remove(); st.list = null; }
        const mo = V.extras.mouth; if (mo && mo.anchors && mo.anchors.teeth) mo.anchors.teeth.parent.parent.visible = mo.t > 0.01;
        if (!slither) tip.hidden = true;
      }
      V.kick();
    }
    function setOrganVis(v) { if (st.data) st.data.own.forEach((m) => { m.visible = v; }); }
    function refresh() { if (st.on) { skinSeeThrough(true); insideVisible(); } }
    function reset() { clearSel(); st.regs.forEach((r) => r.el.remove()); st.regs = []; if (st.list) st.list.remove(); st.list = null; st.on = false; st.data = null; st.mat0 = null; hl.remove(); card.remove(); ring.remove(); }
    return { get on() { return st.on; }, set, toggle: () => set(!st.on), after, pick, select, refresh, reset, seeMore, get parts() { return st.data && st.data.parts; } };
  }

  // ================================================================= events
  on(bBite, 'click', () => { if (show && show.name === 'bite') { stopShow(); return; } startShow({ name: 'bite', btn: bBite }); bite(); });
  on(bEat, 'click', () => { if (show && show.name === 'eat') { stopShow(); return; } startShow({ name: 'eat', btn: bEat }); eat(); });
  on(bEye, 'click', () => { if (show && show.name === 'eye') { stopShow(); return; } startShow({ name: 'eye', btn: bEye }); eyeShow(); });
  on(bSlither, 'click', () => { if (slither && !slither.stopping) stopSlither(true); else startSlither(); });
  on(bAnat, 'click', () => anat && anat.toggle());
  on(bFull, 'click', () => V.toggleFull());
  // a tap (not a drag) picks a part while Anatomy is on; a double-click zooms in, or back out
  let down = null;
  on(V.canvas, 'pointerdown', (e) => { down = [e.clientX, e.clientY, now()]; });
  on(V.canvas, 'pointerup', (e) => {
    if (!down || !anat || !anat.on || show) return; const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]); down = null; if (moved > 6) return;
    const p = anat.pick(e); if (p) anat.select(p);
  });
  on(V.canvas, 'dblclick', (e) => {
    e.preventDefault(); if (show) return;
    if (anat && anat.on && anat.pick(e)) return; // double-tapping a part only selects it
    const st = V.controls.st, info = V.info;
    if ((st.goal ? st.goal.d : st.d) < info.dFit * 0.8) { V.controls.setGoal({ d: info.dFit, px: 0, pz: 0, el: Math.max(st.el, (info.portrait ? 40 : 30) * Math.PI / 180) }); return; }
    // zoom in towards the point under the pointer (on the snake or the ground)
    const r = V.canvas.getBoundingClientRect(), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), V.cam);
    const body = V.group.children.find((o) => o.isMesh && o.geometry === info.body.geo); let p = null;
    if (body) { body.geometry.computeBoundingSphere(); const h = ray.intersectObject(body, false)[0]; if (h) p = h.point; }
    if (!p) { const t = -ray.ray.origin.y / (ray.ray.direction.y || -1e-6); if (t > 0) p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t); }
    const d = Math.max(info.dMin * 1.4, info.dFit * 0.32);
    if (p && p.distanceTo(info.center) < info.Rb * 1.5) V.focus(p, d); else V.controls.setGoal({ d });
  });

  // ================================================================= frame hooks
  const fx = {
    onBuild() {
      layout();
      if (anat) anat.reset(); rig = null; anat = anatomyCtl(); show = null; slither = null; camBlend = null; fx.zoomOut = 1;
      const has = !!(V.extras && V.extras.mouth);
      bEat.hidden = bBite.hidden = !has; bEye.hidden = !(V.extras && V.extras.eyes && V.extras.eyes.length);
      bAnat.hidden = !has; bAnat.setAttribute('aria-pressed', 'false');
      for (const b of [bBite, bEat, bEye]) { b.disabled = false; b.removeAttribute('aria-pressed'); if (b.dataset.lbl) { b.textContent = b.dataset.lbl; delete b.dataset.lbl; } }
      bSlither.setAttribute('aria-pressed', 'false'); bSlither.textContent = 'Slither';
      say(''); stepTag.hidden = true; tip.hidden = true;
    },
    reset() { if (show) { const s = show; show = null; for (const o of s.objs) disposeTree(o); } slither = null; if (anat) anat.reset(); anat = null; rig = null; camBlend = null; say(''); },
    step() {
      if (!alive) return false;
      let moving = false;
      if (show) {
        show.time = show.freeze != null ? show.freeze : (now() - show.t0) / 1000;
        show.step(show.time); moving = true;
        if (show.freeze == null && show.time >= show.dur) stopShow();
      } else if (slither) moving = stepSlither() || !!slither;
      if (camBlend) moving = true;
      if (anat && anat.on) { anat.refresh(); }
      return moving;
    },
    camera() { return camera(); },
    after() { if (anat) anat.after(); },
    get locked() { return !!show; },
    zoomOut: 1, // > 1 while slithering: the camera may go further out to see the whole track
    anatOn: () => !!(anat && anat.on),
    syncFull(f) { if (hdb) { if (f) bar.appendChild(hdb); else if (V.opts.head && V.opts.head.parentNode) V.opts.head.parentNode.insertBefore(hdb, V.opts.head.nextSibling); } bFull.innerHTML = (f ? ICON.exit : ICON.full) + '<span>' + (f ? 'Exit fullscreen' : 'Fullscreen') + '</span>'; bFull.setAttribute('aria-pressed', String(f)); },
    // scale labels never sit on the snake: move a label (x, y = its anchor; the box hangs above it, centred) out of the way
    avoid(x, y, w, h) {
      const info = V.info; if (!info || !V.cam) return [x, y];
      const W = stage.clientWidth, H = stage.clientHeight, v = new THREE.Vector3(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i <= 30; i++) { const p = rig && rig.active ? rig.point((i / 30) * info.F.L) : info.body.spine((i / 30) * info.F.L); v.copy(p).project(V.cam); if (v.z > 1) continue; const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H; x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy); }
      const m = 10; x0 -= m; y0 -= m * 1.6; x1 += m; y1 += m;
      const L = x - w / 2, Rr = x + w / 2, T = y - h, Bm = y;
      if (Rr < x0 || L > x1 || Bm < y0 || T > y1) return [x, y];
      const up = y0 - 4, dn = y1 + h + 4;
      if (up - h > 2) return [x, up]; if (dn < H - 2) return [x, dn];
      return [x < (x0 + x1) / 2 ? Math.max(w / 2 + 2, x0 - w / 2 - 4) : Math.min(W - w / 2 - 2, x1 + w / 2 + 4), y];
    },
    dispose() { alive = false; fx.reset(); if (hdb) hdb.remove(); closeSide(); },
    // for tests: freeze a show at s seconds
    test: { freeze(s) { if (show) show.freeze = s; V.kick(); }, get show() { return show && { name: show.name, time: show.time, dur: show.dur, diet: show.diet }; }, get slither() { return !!slither; }, get anat() { return anat; }, get rig() { return rig; }, dietOf: () => dietOf(P, V.opts.id), side: (k) => toggleSide(k) },
  };
  return fx;
}
