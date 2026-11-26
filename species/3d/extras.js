// SnakeList 3D viewer extras (v4.81): the things you can *do* with a model, kept apart from viewer.js
// (which builds the snake and its surroundings). mount() in viewer.js calls create(V) once and then:
//   fx.onBuild()  after every (re)build of the scene      fx.reset()   before the scene is thrown away
//   fx.step()     every frame, after the jaw has moved    fx.camera()  after the orbit camera is placed
//   fx.after()    after rendering (screen-space labels)   fx.dispose() when the viewer closes
// What lives here: a "rig" that bends the body along any path (slithering, striking, coiling, swallowing),
// the automatic shows (See it eat, See eye shield), Slither, the see-through Anatomy, a real-looking
// person for "Size vs person", the side panel (Compare photo / See countries) and double-click zoom.

let THREE = null;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
// v6.35: a touch-first device (phones and tablets, a big iPad too): 'tap' and 'pinch', not 'click' and 'scroll' (as viewer.js touchFirst)
const touchUI = () => { try { const mm = (q) => !!(window.matchMedia && window.matchMedia(q).matches); return window.innerWidth < 560 || (mm('(pointer: coarse)') && !mm('(any-pointer: fine)')) || ((navigator.maxTouchPoints || 0) > 0 && !mm('(hover: hover)')); } catch (e) { return false; } };
function rnd(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- styles (shared by species pages and the app)
const CSS = `
.sp3d-row{position:relative;display:flex;gap:8px;min-height:0}
.sp3d-row>.sp3d-stage{flex:1 1 auto;min-width:0}
.sl3d-host .sp3d-wrap>.sp3d-row,.sl3d-host .sp3d-row{flex:1 1 auto}
.sp3d-wrap:fullscreen .sp3d-row,.sp3d-max .sp3d-row{flex:1 1 auto}
.sp3d-side{flex:0 0 min(48%,560px);display:flex;flex-direction:column;border:1px solid var(--line);border-radius:14px;background:var(--bg);overflow:hidden;min-height:0;min-width:0}
.sp3d-side[hidden]{display:none}
.sp3d-side-hd{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 12px;border-bottom:1px solid var(--line);font:700 14px/1.3 Inter,system-ui,sans-serif;color:var(--text)}
.sp3d-side-hd span{flex:1;min-width:0}
.sp3d-side-x{flex:none;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--text);font-size:20px;line-height:1;cursor:pointer}
.sp3d-side-b{flex:1 1 auto;min-height:0;position:relative;display:flex;flex-direction:column}
.sp3d-side figure{margin:0;flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.sp3d-side figure img,.sp3d-side figure .sp3d-ph{flex:1 1 auto;min-height:0;width:100%;height:100%;object-fit:contain;background:#0f1a13 center/contain no-repeat;display:block}
.sp3d-pz{position:relative;flex:1 1 auto;min-height:0;overflow:hidden;touch-action:none;cursor:zoom-in;background:#0f1a13}.sp3d-pz.sp3d-pz-on{cursor:grab}.sp3d-pz img{transform-origin:50% 50%;user-select:none;-webkit-user-drag:none}
.sp3d-pzh{position:absolute;left:8px;bottom:8px;padding:3px 9px;border-radius:999px;background:rgba(12,26,18,.75);color:#fff;font:500 12px/1.4 Inter,system-ui,sans-serif;pointer-events:none}.sp3d-pz-on .sp3d-pzh{display:none}
.sp3d-side figcaption{flex:none;font:12px/1.4 Inter,system-ui,sans-serif;color:var(--muted);padding:6px 10px}
.sp3d-side iframe{flex:1 1 auto;display:block;width:100%;height:100%;min-height:260px;border:0;background:var(--card)}
.sp3d-side .sp3d-none2{padding:16px;font-size:14px;color:var(--muted)}
.sp3d-pzh-top{top:8px;bottom:auto;transition:opacity .4s}.sp3d-pzh-out{opacity:0}
.sp3d-cmp{flex:none;display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px 2px;border-top:1px solid var(--line)}
.sp3d-cb{min-height:34px;padding:4px 11px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--text);font:600 12.5px/1.2 Inter,system-ui,sans-serif;cursor:pointer}
.sp3d-cb:hover{border-color:#4fa64a}.sp3d-cb[aria-pressed=true]{background:#4fa64a;border-color:#4fa64a;color:#fff}.sp3d-cb:focus-visible,.sp3d-sg:focus-visible{outline:3px solid #9be07c;outline-offset:2px}
.sp3d-side figcaption.sp3d-credit2{font:500 12.5px/1.45 Inter,system-ui,sans-serif;color:var(--text);opacity:.85;padding:6px 10px 9px}
.sp3d-row.sp3d-wphoto>.sp3d-side{flex-basis:min(66%,900px)}.sp3d-row.sp3d-wscene>.sp3d-side{flex-basis:min(30%,380px)}
.sp3d-seg2{display:none}
@media (max-width:900px){.sp3d-row.sp3d-one{flex-direction:column}.sp3d-row.sp3d-one>.sp3d-seg2{display:flex;flex:none;align-self:center;gap:0;border:1px solid var(--line);border-radius:999px;overflow:hidden;background:var(--card)}
.sp3d-sg{min-height:38px;min-width:96px;padding:4px 16px;border:0;background:transparent;color:var(--text);font:600 14px Inter,system-ui,sans-serif;cursor:pointer}.sp3d-sg[aria-selected=true]{background:#4fa64a;color:#fff}
.sp3d-row.sp3d-one>.sp3d-side{flex:1 1 auto;height:auto;min-height:60vh}.sp3d-row.sp3d-one[data-one=photo]>.sp3d-stage{display:none}.sp3d-row.sp3d-one[data-one=scene]>.sp3d-side{display:none}.sp3d-row.sp3d-one .sp3d-cw{display:none}}
@media (max-width:640px){.sp3d-row{flex-direction:column}.sp3d-side{flex:0 0 auto;height:min(52vh,430px)}.sp3d-wrap:fullscreen .sp3d-side,.sp3d-max .sp3d-side{height:45%}}
.sp3d-hdb{display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;margin-right:auto}
.sp3d-b.sp3d-hb{min-height:32px;padding:4px 10px;font-size:12.5px;display:inline-flex;align-items:center;gap:5px}
.sp3d-hb svg,.sp3d-fs svg{width:15px;height:15px;flex:none}
.sp3d-fs{display:inline-flex;align-items:center;gap:6px}
.sp3d-fsc{position:absolute;right:10px;bottom:10px;z-index:3;width:40px;height:40px;display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:10px;background:rgba(12,26,18,.72);color:#fff;cursor:pointer}.sp3d-fsc:hover{background:rgba(12,26,18,.9)}.sp3d-fsc svg{width:22px;height:22px}.sp3d-fsc:focus-visible{outline:3px solid #9be07c;outline-offset:2px}
.sl3d-hd h2{flex:0 1 auto}
@media (max-width:640px){.sp-rl-hd,.sl3d-hd{flex-wrap:wrap}.sp-rl-hd .sp3d-hdb,.sl3d-hd .sp3d-hdb{order:3;flex-basis:100%}}
.sp3d-b:disabled{opacity:.6;cursor:default}
.sp3d-bar.sp3d-few .sp3d-more:not([aria-pressed=true]){display:none}
/* v5.50: like the map in fullscreen - every button sits INSIDE the 3D view: the main ones top-left, Compare photo and
   See countries top-right, the hint bottom-left, fullscreen bottom-right; Show more on its own line under the buttons */
.sp3d-stage>.sp3d-bar{position:absolute;left:10px;top:10px;right:300px;z-index:4;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px;align-items:center;pointer-events:none}
.sp3d-stage>.sp3d-bar>*{pointer-events:auto}
.sp3d-stage>.sp3d-hdb{position:absolute;right:10px;top:10px;z-index:4;margin:0;display:flex;flex-wrap:nowrap;gap:6px}
.sp3d-stage .sp3d-b,.sp3d-stage .sp3d-hb{min-height:34px;padding:5px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(12,26,18,.74);color:#fff;font:600 13px/1.2 Inter,system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.18);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.sp3d-stage .sp3d-b:hover,.sp3d-stage .sp3d-hb:hover{background:rgba(12,26,18,.9);border-color:rgba(155,224,124,.65);color:#fff}
.sp3d-stage .sp3d-b[aria-pressed=true],.sp3d-stage .sp3d-hb[aria-pressed=true]{background:#4fa64a;border-color:#4fa64a;color:#fff}
.sp3d-stage .sp3d-views{display:inline-flex;gap:6px;border:0;border-radius:0;overflow:visible}
.sp3d-stage .sp3d-views .sp3d-b{border:1px solid rgba(255,255,255,.16);border-radius:10px}
.sp3d-br{flex-basis:100%;height:0;order:1}.sp3d-bar .sp3d-morebtn{order:2}.sp3d-bar .sp3d-br+.sp3d-morebtn+.sp3d-br{order:3}.sp3d-bar .sp3d-more{order:4}
.sp3d-bar.sp3d-few>.sp3d-br:last-child{display:none}
.sp3d-stage .sp3d-b.sp3d-morebtn,.sp3d-stage .sp3d-b.sp3d-morebtn[aria-expanded=true]{display:inline-flex;align-items:center;gap:6px;min-height:0;padding:3px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(12,26,18,.6);color:rgba(255,255,255,.88);font:500 11.5px/1.35 Inter,system-ui,sans-serif;box-shadow:none}
.sp3d-stage .sp3d-b.sp3d-morebtn:hover{background:rgba(12,26,18,.82);border-color:rgba(255,255,255,.3);color:#fff}
.sp3d-b.sp3d-morebtn::after{content:"";width:6px;height:6px;border:solid currentColor;border-width:0 1.5px 1.5px 0;transform:translateY(-2px) rotate(45deg);transition:transform .15s ease}
.sp3d-b.sp3d-morebtn[aria-expanded=true]::after{transform:translateY(1px) rotate(-135deg)}
.sp3d-stage .sp3d-hint{top:auto;left:10px;bottom:10px;max-width:calc(100% - 80px);z-index:3}
.sp3d-stage:has(>.sp3d-capt:not([hidden])) .sp3d-hint{opacity:0}
.sp3d-stage:has(>.sp3d-tip:not([hidden])) .sp3d-hint{opacity:0}
.sp3d-stage .sp3d-tip{left:10px;bottom:10px;max-width:calc(100% - 80px)}
.sp3d-stage .sp3d-step{top:auto;right:10px;bottom:58px}
@media (max-width:820px){.sp3d-stage>.sp3d-bar{right:10px;top:56px}.sp3d-stage .sp3d-b,.sp3d-stage .sp3d-hb{min-height:32px;padding:4px 10px;font-size:12.5px}}
.sp3d-capt{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);width:max-content;max-width:min(calc(100% - 132px),580px);padding:8px 14px;border-radius:12px;background:rgba(12,26,18,.88);color:#fff;font:500 14px/1.45 Inter,system-ui,sans-serif;text-align:center;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.3);transition:opacity .35s}
.sp3d-capt[hidden]{display:none}.sp3d-capt b{color:#ffd66b}
.sp3d-step{position:absolute;right:10px;top:10px;padding:3px 10px;border-radius:999px;background:rgba(12,26,18,.8);color:#fff;font:600 12px/1.5 Inter,system-ui,sans-serif;pointer-events:none}
.sp3d-step[hidden]{display:none}
.sp3d-info[hidden],.sp3d-reg[hidden],.sp3d-list[hidden]{display:none}
.sp3d-info{position:absolute;left:0;top:0;width:min(270px,70%);padding:9px 12px 10px;border-radius:12px;background:rgba(12,26,18,.92);color:#fff;font:13px/1.45 Inter,system-ui,sans-serif;pointer-events:auto;border:2px solid #9be07c;box-shadow:0 4px 14px rgba(0,0,0,.35)}
.sp3d-info h4{margin:0 26px 3px 0;font:700 14.5px/1.3 Inter,system-ui,sans-serif;color:#9be07c}.sp3d-info p{margin:0}
.sp3d-info .sp3d-ix,.sp3d-list .sp3d-ix{position:absolute;right:5px;top:5px;width:26px;height:26px;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:16px;line-height:1;cursor:pointer}
.sp3d-reg{position:absolute;left:0;top:0;display:flex;align-items:center;gap:6px;padding:3px 4px 3px 10px;border-radius:999px;background:rgba(12,26,18,.86);border:2px solid #9be07c;color:#fff;font:700 12.5px/1.3 Inter,system-ui,sans-serif;pointer-events:auto;white-space:nowrap;transform:translate(-50%,-100%)}
.sp3d-reg button{font:600 11.5px/1.2 Inter,system-ui,sans-serif;padding:4px 9px;border-radius:999px;border:0;background:#9be07c;color:#10261a;cursor:pointer}
.sp3d-reg.sp3d-lab{transform:none;cursor:pointer;z-index:2}.sp3d-reg.sp3d-lab[hidden]{display:none}
.sp3d-ldot{position:absolute;left:0;top:0;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#9be07c;border:2px solid #10261a;box-shadow:0 0 0 1px rgba(255,255,255,.5);pointer-events:auto;cursor:pointer;z-index:2}.sp3d-ldot[hidden]{display:none}
.sp3d-lines{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:1}
.sp3d-ring{position:absolute;left:0;top:0;border:2px dashed #9be07c;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%)}
.sp3d-ring[hidden]{display:none}
.sp3d-list{position:absolute;left:8px;top:8px;max-height:calc(100% - 16px);overflow:auto;width:min(240px,48%);background:rgba(12,26,18,.9);color:#fff;border-radius:12px;padding:8px 8px 6px;pointer-events:auto;border:2px solid #9be07c;font:13px/1.4 Inter,system-ui,sans-serif}
.sp3d-list h4{margin:0 30px 6px 4px;font:700 14px/1.3 Inter,system-ui,sans-serif;color:#9be07c}
.sp3d-list button.sp3d-li{display:block;width:100%;text-align:left;margin:0 0 3px;padding:5px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font:500 12.5px/1.3 Inter,system-ui,sans-serif;cursor:pointer}
.sp3d-list button.sp3d-li:hover,.sp3d-list button.sp3d-li[aria-current=true]{border-color:#9be07c;background:rgba(155,224,124,.18)}
.sp3d-tip{position:absolute;left:8px;bottom:8px;max-width:calc(100% - 16px);padding:4px 10px;border-radius:999px;background:rgba(12,26,18,.8);color:#fff;font:500 12px/1.4 Inter,system-ui,sans-serif;pointer-events:none}
.sp3d-tip[hidden]{display:none}
@media (max-width:560px){.sp3d-list{width:min(175px,46%);max-height:calc(52% - 12px);font-size:12px}.sp3d-list button.sp3d-li{font-size:11.5px;padding:4px 6px}.sp3d-capt{font-size:12.5px;padding:6px 10px;bottom:8px}.sp3d-info{font-size:12px;width:min(230px,78%)}}
`;
// v6.35: the preview switch of "See the spot" (tools/previews.js; its own key where that isn't loaded) and touch screens
const spotPv = () => { try { const P = window.SL_PREVIEWS; if (P && typeof P.on === 'function') return !!P.on('spot'); return localStorage.getItem('sl-art-preview-spot') === '1'; } catch (e) { return false; } };
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
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); } // (v5.05: wound outwards)
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
  o.traverse((q) => { if (q.geometry) q.geometry.dispose(); const ms = Array.isArray(q.material) ? q.material : q.material ? [q.material] : []; for (const m of ms) { for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); } if (m.userData.fur) m.userData.fur.uFurD.value.dispose(); m.dispose(); } });
  if (o.parent) o.parent.remove(o);
}
function fadeTree(o, op) { o.traverse((q) => { if (q.material && q.userData.op != null) { q.material.opacity = q.userData.op * op; q.material.transparent = true; q.material.depthWrite = op > 0.98 && q.userData.op >= 1; q.visible = op > 0.005; } }); }
function markFade(o) { o.traverse((q) => { if (q.material && q.userData.op == null) q.userData.op = q.material.opacity != null ? q.material.opacity : 1; }); }

// ---------------------------------------------------------------- the person for "Size vs person"
// v5.83: Eduardo said the old one "looks like a 5 year old with clay made a human" (and the sculpted one after it still
// had a cap of hair and a heavy jaw). Now it is a real person: the Microsoft Rocketbox avatar "Male_Adult_05" (MIT
// licence; see CREDITS.txt) - a photo-scanned face and skin, eyes in their sockets, hair and beard made of strand cards,
// a field shirt, vest, trousers and boots - posed with the arms relaxed at the sides by tools/build-person.js and stored
// in person.bin (about 120 kB) with its textures in person/ (WebP, about 0.7 MB; loaded only when Size vs person is
// used). It stands exactly h tall (1.70 m from the soles to the top of the hair) on y = 0, facing +z, and lives a
// little: it breathes (the chest and belly rise and fall), sways very slightly over its feet as people do standing
// still, and blinks now and then (none of it with reduced motion).
let personData = null, personReq = null; const personWait = new Set();
const PERSON_TEX = { head: 'head.webp', headN: 'head_n.webp', headR: 'head_r.webp', body: 'body.webp', bodyN: 'body_n.webp', hair: 'hair.webp' };
const personURL = (f) => new URL(f + '?r=576', import.meta.url).href;
export function loadPerson() { // (the mesh is kept once loaded - about 0.3 MB; the pictures are not, see personImages)
  if (personData) return Promise.resolve(personData);
  if (!personReq) {
    personReq = fetch(personURL('person.bin')).then((r) => { if (!r.ok) throw new Error('person ' + r.status); return r.arrayBuffer(); })
      .then((b) => { personData = parsePerson(b); return personData; })
      .catch((e) => { personReq = null; throw e; });
    personImages().catch(() => {}); // (start them too: the browser keeps the files, and the next request is instant)
  }
  return personReq;
}
// the textures' pictures, decoded afresh for each person shown, so nothing big stays in memory once it is gone
function personImages() {
  const img = (f) => new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => rej(new Error('person ' + f)); im.src = personURL('person/' + f); });
  return Promise.all(Object.values(PERSON_TEX).map(img)).then((ims) => { const o = {}; Object.keys(PERSON_TEX).forEach((k, i) => { o[k] = ims[i]; }); return o; });
}
function parsePerson(buf) {
  const dv = new DataView(buf); if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'SLP2') throw new Error('person.bin');
  const jl = dv.getUint32(4, true), m = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jl))); let o = 8 + jl;
  const al = (n) => n + ((4 - (n % 4)) % 4);
  const q = new Uint16Array(buf, o, m.nv * 3); o += al(m.nv * 6); const nb = new Int8Array(buf, o, m.nv * 4); o += m.nv * 4;
  const ub = new Uint16Array(buf, o, m.nv * 2); o += al(m.nv * 4); const idx = new Uint16Array(buf.slice(o, o + m.nt * 6)); o += al(m.nt * 6);
  const bi = new Uint16Array(buf, o, m.blink.n); o += al(m.blink.n * 2); const bd = new Int16Array(buf, o, m.blink.n * 3);
  const pos = new Float32Array(m.nv * 3), nor = new Float32Array(m.nv * 3), uv = new Float32Array(m.nv * 2), blink = new Float32Array(m.nv * 3);
  for (let v = 0; v < m.nv; v++) { for (let c = 0; c < 3; c++) { pos[v * 3 + c] = m.lo[c] + (q[v * 3 + c] / 65535) * (m.hi[c] - m.lo[c]); nor[v * 3 + c] = nb[v * 4 + c] / 127; } for (let c = 0; c < 2; c++) uv[v * 2 + c] = m.uvlo[c] + (ub[v * 2 + c] / 65535) * (m.uvhi[c] - m.uvlo[c]); }
  for (let k = 0; k < m.blink.n; k++) for (let c = 0; c < 3; c++) blink[bi[k] * 3 + c] = bd[k * 3 + c] * m.blink.k;
  return { meta: m, pos, nor, uv, idx, blink };
}
function personFrom(data, img, h) {
  const m = data.meta, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.pos.slice(), 3)); geo.setAttribute('normal', new THREE.BufferAttribute(data.nor.slice(), 3)); geo.setAttribute('uv', new THREE.BufferAttribute(data.uv.slice(), 2)); geo.setIndex(new THREE.BufferAttribute(data.idx.slice(), 1));
  for (const [st, n, mi] of m.groups) geo.addGroup(st, n, mi);
  // breathing: the chest and belly move out along their normals (most at the breastbone, less at the belly, none on
  // the back or the arms)
  const br = new Float32Array(m.nv * 3), ch = m.chest;
  for (let v = 0; v < m.nv; v++) {
    const x = data.pos[v * 3], y = data.pos[v * 3 + 1], nz = data.nor[v * 3 + 2], ny = data.nor[v * 3 + 1];
    const k = sstep(ch[1] - 0.42, ch[1] - 0.2, y) * (1 - sstep(ch[1] + 0.12, ch[1] + 0.22, y)) * sstep(-0.2, 0.5, nz) * sstep(0.16, 0.1, Math.abs(x)) * (1 - Math.abs(ny) * 0.5);
    const amt = 0.0042 * k * lerp(0.6, 1, sstep(ch[1] - 0.3, ch[1], y));
    br[v * 3] = data.nor[v * 3] * amt * 0.5; br[v * 3 + 1] = amt * 0.35 * sstep(ch[1] - 0.1, ch[1] + 0.1, y); br[v * 3 + 2] = nz * amt;
  }
  geo.morphAttributes.position = [new THREE.BufferAttribute(data.blink.slice(), 3), new THREE.BufferAttribute(br, 3)]; geo.morphTargetsRelative = true;
  geo.computeBoundingSphere();
  const tex = (k, srgb) => { const t = new THREE.Texture(img[k]); t.flipY = true; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; };
  const body = new THREE.MeshPhysicalMaterial({ map: tex('body', true), normalMap: tex('bodyN'), roughness: 0.82, sheen: 0.35, sheenRoughness: 0.8, sheenColor: new THREE.Color('#5d5446'), specularIntensity: 0.35 });
  // skin: the scanned colour, its pores in the normal map, glossy eyes and lips from the roughness map, and a warm
  // sheen at grazing angles (light scattered under the skin)
  const head = new THREE.MeshPhysicalMaterial({ map: tex('head', true), normalMap: tex('headN'), roughnessMap: tex('headR'), roughness: 1, sheen: 0.3, sheenRoughness: 0.55, sheenColor: new THREE.Color('#d9776a'), specularIntensity: 0.55, clearcoat: 0.04, clearcoatRoughness: 0.4 });
  const hair = new THREE.MeshPhysicalMaterial({ map: tex('hair', true), alphaTest: 0.38, side: THREE.DoubleSide, roughness: 0.5, sheen: 0.22, sheenRoughness: 0.4, sheenColor: new THREE.Color('#6b5c50'), specularIntensity: 0.35 });
  // swaying over the ankles: a slight lean of the whole body, done on the graphics card (its outline, and so its measured
  // height, stays exactly h)
  const uSway = { value: new THREE.Vector2(0, 0) }, sway = (sh) => { sh.uniforms.uSway = uSway; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec2 uSway;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.xz += uSway * transformed.y;'); };
  body.onBeforeCompile = sway; hair.onBeforeCompile = sway;
  // (the skin's light wraps a little round into the shade, as it does through real skin)
  head.onBeforeCompile = (sh) => { sway(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n reflectedLight.directDiffuse += reflectedLight.indirectDiffuse * vec3(0.06, 0.018, 0.012);'); };
  const mats = m.mats.map((k) => (k === 'head' ? head : k === 'hair' ? hair : body));
  const mesh = new THREE.Mesh(geo, mats); mesh.name = 'person-skin'; mesh.castShadow = mesh.receiveShadow = true; mesh.morphTargetInfluences = [0, 0];
  const g = new THREE.Group(); g.add(mesh);
  const k = h / Math.max(1e-6, m.hi[1] - m.lo[1]); g.scale.setScalar(k); g.position.y = -m.lo[1] * k; // (exactly h from the soles to the top of the hair)
  const out = new THREE.Group(); out.add(g); out.userData.realPerson = true;
  // idle life, on its own clock (drawn with the scenery's gentle frames)
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let nextBlink = 1.5 + Math.random() * 2, blinkAt = -10;
  mesh.onBeforeRender = () => {
    if (calm) return;
    const t = performance.now() / 1000, inf = mesh.morphTargetInfluences;
    inf[1] = 0.5 - 0.5 * Math.cos((t * TAU) / 4.6); // about 13 breaths a minute
    if (t > nextBlink) { blinkAt = t; nextBlink = t + 2.5 + Math.random() * 4.5; }
    const b = (t - blinkAt) / 0.16; inf[0] = b < 0 || b > 2 ? 0 : b < 1 ? sstep(0, 1, b) : 1 - sstep(1, 2, b); // shut fast, open a little slower
    uSway.value.set(0.0045 * Math.sin((t * TAU) / 7.3) + 0.002 * Math.sin((t * TAU) / 3.1), 0.003 * Math.sin((t * TAU) / 9.7 + 1)); // (swaying over the ankles)
  };
  return out;
}
export function buildPerson(T, h = 1.7) {
  THREE = THREE || T;
  // an empty group now, filled as soon as person.bin and its pictures are ready (the simple person if they cannot load)
  const g = new THREE.Group(); g.userData.realPerson = 'loading';
  // (v6.13: built just after the next picture, never inside the click that asked for it - the button answers first)
  const afterPaint = (v) => new Promise((ok) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => setTimeout(() => ok(v), 0)) : setTimeout(() => ok(v), 0)));
  Promise.all([loadPerson(), personImages()]).then(afterPaint).then(([d, im]) => { g.add(personFrom(d, im, h)); g.userData.realPerson = true; }, () => { g.add(buildPersonSimple(T, h)); g.userData.realPerson = false; }).then(() => { personWait.forEach((f) => f()); });
  return g;
}

// the older, simple person (used only if person.bin cannot be loaded)
function buildPersonSimple(T, h = 1.5) {
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
// v5.78: the prey rebuilt "as carefully as the snake" (Eduardo: "the see it eat animation is horrible"): a rat or mouse
// with its pointed snout, cupped pink-lined ears, glossy eyes, whiskers, paws with toes and a long ringed tail, fur that
// runs along the body (dark back, pale belly); a frog with gold eyes and a horizontal pupil, eardrum, a moist mottled skin
// and folded webbed hind legs; a fish with scales, a lateral line, a forked tail and see-through fins; a small bird with
// feathered wings, a fanned tail and a two-part beak; a lizard with splayed five-toed legs and a long tail. Each moves
// as it would: the rodent sniffs (nose and whiskers twitch, head turning) and its tail sways, the frog's throat pumps,
// the fish swims with a wave down its body, the bird turns its head and flicks its tail, the lizard bobs and sways
// its tail. Caught, it struggles less and less (userData.anim(t, live), live from 1 to 0).
// a smooth body of rings along z (t = 0 rear to 1 front): each ring an ellipse - half-width w, half-height h, centre
// height c, x offset x, belly flattening bf (the lower half squashed) - all in the units given
function keyed(tab) { // keyframes [t, {..}] -> a smooth function of t (Catmull-Rom on every field)
  return (t) => {
    let i = 0; while (i < tab.length - 2 && tab[i + 1][0] < t) i++;
    const a = tab[Math.max(0, i - 1)][1], b = tab[i][1], c = tab[i + 1][1], d = tab[Math.min(tab.length - 1, i + 2)][1], u = clamp((t - tab[i][0]) / Math.max(1e-9, tab[i + 1][0] - tab[i][0]), 0, 1), out = {};
    for (const k in b) { const p0 = a[k] != null ? a[k] : b[k], p1 = b[k], p2 = c[k] != null ? c[k] : b[k], p3 = d[k] != null ? d[k] : p2; out[k] = 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u); }
    return out;
  };
}
function loft(prof, z0, z1, n, na, colFn) {
  const pos = new Float32Array((n + 1) * (na + 1) * 3), uv = new Float32Array((n + 1) * (na + 1) * 2), col = colFn ? new Float32Array((n + 1) * (na + 1) * 3) : null, idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, P = prof(t), z = lerp(z0, z1, t);
    for (let j = 0; j <= na; j++) {
      const a = (j / na) * TAU - Math.PI, s = Math.sin(a), c = Math.cos(a), v = i * (na + 1) + j;
      pos[v * 3] = (P.x || 0) + P.w * s; pos[v * 3 + 1] = P.c + P.h * (c < 0 ? c * (P.bf || 1) : c); pos[v * 3 + 2] = z; uv[v * 2] = j / na; uv[v * 2 + 1] = t;
      if (col) col.set(colFn(t, a, s, c), v * 3);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < na; j++) { const a = i * (na + 1) + j, b = a + na + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  // the seam where a ring closes: share its normals
  const nr = g.attributes.normal.array; for (let i = 0; i <= n; i++) { const a = i * (na + 1), b = a + na; for (let q = 0; q < 3; q++) { const m = (nr[a * 3 + q] + nr[b * 3 + q]) / 2; nr[a * 3 + q] = nr[b * 3 + q] = m; } }
  g.userData.base = pos.slice(); return g;
}
function renorm(g, n, na) { g.computeVertexNormals(); const nr = g.attributes.normal.array; for (let i = 0; i <= n; i++) { const a = i * (na + 1), b = a + na; for (let q = 0; q < 3; q++) { const m = (nr[a * 3 + q] + nr[b * 3 + q]) / 2; nr[a * 3 + q] = nr[b * 3 + q] = m; } } }
// a straight limb segment from p to q (radius r1 to r2), rounded at both ends
function limbGeo(p, q, r1, r2, radial = 8) {
  const d = q.clone().sub(p), l = d.length(), g = new THREE.CapsuleGeometry(1, 1, 3, radial), pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) { let y = pa.getY(i); const s = clamp(y + 0.5, 0, 1), r = lerp(r1, r2, s), half = y > 0.5 ? (y - 0.5) : y < -0.5 ? (y + 0.5) : 0, yy = y > 0.5 ? l + half * r2 * 2 : y < -0.5 ? half * r1 * 2 : s * l; pa.setXYZ(i, pa.getX(i) * r, yy, pa.getZ(i) * r); }
  g.computeVertexNormals(); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize())); g.translate(p.x, p.y, p.z); return g;
}
// a tube along points whose positions can be updated in place (tails)
function liveTube(n, radial, rf) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array((n + 1) * (radial + 1) * 3), uv = new Float32Array((n + 1) * (radial + 1) * 2), idx = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= radial; j++) { const v = i * (radial + 1) + j; uv[v * 2] = j / radial; uv[v * 2 + 1] = i / n; }
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  g.userData.set = (pts) => { // pts: n + 1 points
    for (let i = 0; i <= n; i++) {
      const p = pts[i], q = pts[Math.min(n, i + 1)], o = pts[Math.max(0, i - 1)]; T.subVectors(q, o).normalize(); N.copy(up).addScaledVector(T, -T.dot(up)); if (N.lengthSq() < 1e-8) N.set(1, 0, 0); N.normalize(); B.crossVectors(T, N);
      const r = rf(i / n);
      for (let j = 0; j <= radial; j++) { const a = (j / radial) * TAU, v = i * (radial + 1) + j; pos[v * 3] = p.x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * r; pos[v * 3 + 1] = p.y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * r; pos[v * 3 + 2] = p.z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * r; }
    }
    g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
  };
  return g;
}
const hexRGB = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function furTex(seed, dark, light, rx, ry) { // short hairs lying along v (along the body)
  const R = rnd(seed);
  return canvasTex(256, (x, s) => { x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, s, s); for (let i = 0; i < 5200; i++) { const px = R() * s, py = R() * s, l = 3 + R() * 9; x.strokeStyle = R() < 0.5 ? 'rgba(' + dark + ',' + (0.25 + R() * 0.4) + ')' : 'rgba(' + light + ',' + (0.2 + R() * 0.35) + ')'; x.lineWidth = 0.6 + R() * 0.9; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + (R() - 0.5) * 2, py + l * 0.5, px + (R() - 0.5) * 3, py + l); x.stroke(); } }, rx, ry);
}
// v5.83: limbs as one smooth piece each (a thick thigh or upper arm narrowing through the knee or elbow to the ankle
// and the paw - not capsules stuck together), coloured along their length (fur to bare pink paws, say)
function limbTube(pts, radii, cols, radial = 10, seg = 26) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), ls = [0]; for (let i = 1; i < pts.length; i++) ls.push(ls[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const tot = ls[ls.length - 1] || 1, at = (arr, t) => { const d = t * tot; let i = 0; while (i < ls.length - 2 && ls[i + 1] < d) i++; const u = clamp((d - ls[i]) / Math.max(1e-9, ls[i + 1] - ls[i]), 0, 1), w = u * u * (3 - 2 * u); return Array.isArray(arr[0]) ? mixRGB(arr[i], arr[i + 1], w) : lerp(arr[i], arr[i + 1], w); };
  const fr = curve.computeFrenetFrames(seg, false), pos = [], col = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, p = curve.getPointAt(t), N = fr.normals[i], B = fr.binormals[i], r = at(radii, t) * (i === 0 || i === seg ? 0.35 : i === seg - 1 ? 0.8 : 1), c = at(cols, t);
    for (let j = 0; j <= radial; j++) { const a = (j / radial) * TAU; pos.push(p.x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * r, p.y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * r, p.z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * r); col.push(c[0], c[1], c[2]); uv.push(j / radial, t * 3); }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// v5.83: fur that reads as fur: shells - the body drawn again a few times, each a little further out along its normals,
// keeping only the tips of the hairs (a field of hair dots; fewer survive the further out), darker at the roots. The
// shells follow the body as it breathes, struggles and is squeezed (they share its geometry).
let furDots = null;
function furShells(parent, geo, mat, n, len, rep, mesh) {
  if (!furDots) furDots = canvasTex(128, (x, s) => { const R = rnd(808); x.fillStyle = '#000'; x.fillRect(0, 0, s, s); for (let i = 0; i < 2600; i++) { const v = 40 + Math.floor(R() * 215); x.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; x.fillRect(Math.floor(R() * s), Math.floor(R() * s), 1, 1); } }, 1, false);
  const dots = furDots.clone(); dots.wrapS = dots.wrapT = THREE.RepeatWrapping; dots.magFilter = dots.minFilter = THREE.NearestFilter; dots.generateMipmaps = false; dots.needsUpdate = true;
  const out = [];
  for (let k = 1; k <= n; k++) {
    const m = mat.clone(), U = { uFurL: { value: k / n }, uFurLen: { value: len }, uFurD: { value: dots }, uFurRep: { value: new THREE.Vector2(rep[0], rep[1]) } };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uFurL, uFurLen;\nvarying vec2 vFurUv;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += objectNormal * uFurLen * uFurL;\nvFurUv = uv;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uFurL; uniform sampler2D uFurD; uniform vec2 uFurRep;\nvarying vec2 vFurUv;')
        .replace('#include <map_fragment>', '#include <map_fragment>\nfloat fh = texture2D(uFurD, vFurUv * uFurRep).r; if (fh < 0.16 + uFurL * 0.8) discard; diffuseColor.rgb *= mix(0.62, 1.08, uFurL);');
    };
    m.customProgramCacheKey = () => 'furshell'; m.userData.fur = U;
    const sm = mesh(geo, m, parent); sm.castShadow = false; sm.renderOrder = 1; out.push(sm);
  }
  return out;
}
function buildPrey2(kind, r, seed) {
  const g = new THREE.Group(), R = rnd(seed);
  const mesh = (geo, mat, parent = g) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const S = (rad, w = 18, h = 12) => new THREE.SphereGeometry(rad, w, h);
  const glossEye = (col = '#0b0807') => new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1 });
  if (kind === 'mouse' || kind === 'rat') {
    const rat = kind === 'rat', Lb = r * (rat ? 4.6 : 4.1), z0 = -Lb / 2, z1 = Lb / 2;
    const back = hexRGB(rat ? '#6b5847' : '#8a7560'), side = hexRGB(rat ? '#8a7663' : '#a38e78'), belly = hexRGB(rat ? '#d9cdbb' : '#e3d8c6'), snoutC = hexRGB('#b59a86');
    const prof = keyed([[0, { w: 0.12, h: 0.12, c: 1.0, bf: 1 }], [0.05, { w: 0.62, h: 0.62, c: 1.0, bf: 0.9 }], [0.15, { w: 0.9, h: 0.9, c: 1.04, bf: 0.85 }], [0.32, { w: 0.98, h: 0.95, c: 1.06, bf: 0.85 }], [0.48, { w: 0.9, h: 0.9, c: 1.08, bf: 0.85 }], [0.6, { w: 0.72, h: 0.77, c: 1.12, bf: 0.9 }], [0.67, { w: 0.6, h: 0.64, c: 1.17, bf: 0.95 }], [0.73, { w: 0.64, h: 0.62, c: 1.21, bf: 0.95 }], [0.81, { w: 0.55, h: 0.5, c: 1.19, bf: 1 }], [0.89, { w: 0.36, h: 0.35, c: 1.13, bf: 1 }], [0.955, { w: 0.18, h: 0.19, c: 1.07, bf: 1 }], [1, { w: 0.03, h: 0.04, c: 1.05, bf: 1 }]]);
    const prR = (t) => { const p = prof(t); return { w: p.w * r, h: p.h * r, c: p.c * r, bf: p.bf }; };
    const NZ = 44, NA = 28;
    const bodyG = loft(prR, z0, z1, NZ, NA, (t, a, s, c) => { const k = sstep(0.1, -0.55, c), sn = sstep(0.86, 0.97, t); return mixRGB(mixRGB(mixRGB(back, side, sstep(0.75, 0.2, c)), belly, k), snoutC, sn * 0.6); });
    const fur = new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, map: furTex(seed, '30,22,15', '240,230,215', 3, 6), roughness: 0.92, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(rat ? '#c9b49c' : '#ddc9b2') });
    const body = mesh(bodyG, fur); furShells(g, bodyG, fur, 6, r * 0.14, [34, 70], mesh);
    const pink = new THREE.MeshPhysicalMaterial({ color: '#e0a49e', roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color('#ffd0c8') }), dark = new THREE.MeshStandardMaterial({ color: '#2a1d16', roughness: 0.7 });
    // the head: everything that moves with it (eyes, ears, nose, whiskers) turns about the neck
    const zN = lerp(z0, z1, 0.64), head = new THREE.Group(); head.position.set(0, r * 1.15, zN); g.add(head);
    const hp = (t, x, yk) => { const p = prR(t); return V3(x, p.c + p.h * yk - r * 1.15, lerp(z0, z1, t) - zN); };
    for (const sg of [-1, 1]) {
      const ep = hp(0.835, sg * r * 0.36, 0.42), eye = mesh(S(r * 0.115, 16, 12), glossEye(), head); eye.position.copy(ep); eye.scale.set(0.8, 1, 1.05);
      const ear = new THREE.Group(); ear.position.copy(hp(0.73, sg * r * 0.4, 0.88)); ear.rotation.set(-0.35, sg * 0.75, sg * 0.25); head.add(ear);
      const eo = new THREE.SphereGeometry(r * (rat ? 0.32 : 0.38), 18, 10, 0, TAU, 0, Math.PI * 0.42); eo.rotateX(-Math.PI / 2); eo.scale(1, 1.1, 0.5);
      mesh(eo, fur, ear); const ei = eo.clone(); ei.scale(0.86, 0.86, 0.75); ei.translate(0, 0, r * 0.012); const inner = mesh(ei, new THREE.MeshPhysicalMaterial({ color: '#d99a95', roughness: 0.55, side: THREE.BackSide, sheen: 0.3, sheenColor: new THREE.Color('#ffc8c0') }), ear); inner.castShadow = false;
    }
    const nose = mesh(S(r * 0.075, 12, 10), pink, head); nose.position.copy(hp(1, 0, 0.1)).add(V3(0, 0, r * 0.01));
    const wg = new THREE.BufferGeometry(), wp = [], Rw = rnd(seed + 9), wb = hp(0.955, 0, 0);
    for (const sg of [-1, 1]) for (let i = 0; i < 7; i++) { const y = wb.y + (Rw() - 0.3) * r * 0.12, z = wb.z - r * 0.02, a = (Rw() - 0.5) * 0.9; wp.push(sg * r * 0.14, y, z, sg * r * (0.95 + Rw() * 0.7), y + Math.sin(a) * r * 0.6, z - r * (0.15 + Rw() * 0.45)); }
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); const wh = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#efe9df', transparent: true, opacity: 0.75 })); head.add(wh);
    // legs: the front ones under the shoulders, the hind ones folded with long flat feet; pink paws with toes
    const legs = [];
    for (const sg of [-1, 1]) for (const [t, hind] of [[0.6, false], [0.17, true]]) {
      const lg = new THREE.Group(), p = prR(t), top = V3(sg * p.w * 0.55, p.c - p.h * 0.45, lerp(z0, z1, t)); lg.position.copy(top); g.add(lg); legs.push({ g: lg, hind, sg, ph: (t > 0.4 ? 0 : Math.PI) + (sg > 0 ? 0 : Math.PI) });
      const foot = V3(sg * r * 0.12, -top.y + r * 0.06, hind ? -r * 0.15 : r * 0.12);
      // v5.83: one smooth leg each: a hind leg's big thigh and the knee forward, the heel up and the long flat foot on
      // the ground; a front leg's slim arm, the elbow back, the wrist and a small hand - furred above, pink below
      const furC = mixRGB(side, belly, 0.35), pinkC = hexRGB('#d9a29a');
      const lgPts = hind ? [V3(0, r * 0.25, r * 0.05), V3(sg * r * 0.08, -top.y * 0.45, r * 0.32), V3(sg * r * 0.1, foot.y + r * 0.18, -r * 0.2), V3(sg * r * 0.12, foot.y - r * 0.02, -r * 0.05), V3(sg * r * 0.13, foot.y - r * 0.04, r * 0.42)]
        : [V3(0, r * 0.15, 0), V3(sg * r * 0.06, -top.y * 0.45, -r * 0.1), V3(sg * r * 0.1, foot.y + r * 0.08, r * 0.08), V3(sg * r * 0.12, foot.y - r * 0.03, r * 0.2)];
      const lgR = hind ? [r * 0.4, r * 0.24, r * 0.09, r * 0.075, r * 0.06] : [r * 0.17, r * 0.11, r * 0.07, r * 0.06], lgC = hind ? [furC, furC, mixRGB(furC, pinkC, 0.6), pinkC, pinkC] : [furC, furC, mixRGB(furC, pinkC, 0.7), pinkC];
      const legM = mesh(limbTube(lgPts, lgR, lgC, 12, hind ? 30 : 22), fur, lg); if (hind) furShells(lg, legM.geometry, fur, 3, r * 0.1, [8, 10], mesh);
      for (let k = 0; k < (hind ? 5 : 4); k++) { const a = (k / ((hind ? 5 : 4) - 1) - 0.5) * 1.1, tp0 = lgPts[lgPts.length - 1].clone().add(V3(0, 0, -r * 0.04)); mesh(limbGeo(tp0, tp0.clone().add(V3(Math.sin(a) * r * 0.14, -r * 0.015, Math.cos(a) * r * 0.16)), r * 0.026, r * 0.016, 5), pink, lg); }
    }
    // the tail: about as long as the body (a little longer in a rat), scaly rings, swaying
    const tailN = 36, tailL = Lb * (rat ? 0.95 : 0.9), tailM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: canvasTex(64, (x, s) => { x.fillStyle = rat ? '#b58f86' : '#c79a90'; x.fillRect(0, 0, s, s); x.fillStyle = 'rgba(80,50,45,.35)'; for (let i = 0; i < s; i += 4) x.fillRect(0, i, s, 1); x.fillStyle = 'rgba(255,240,235,.2)'; for (let i = 2; i < s; i += 4) x.fillRect(0, i, s, 1); }, 1, 40), roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color('#ffe0d8') });
    const tg = liveTube(tailN, 8, (t) => r * 0.15 * (1 - t * 0.8)), tail = mesh(tg, tailM), tpts = Array.from({ length: tailN + 1 }, () => new THREE.Vector3());
    const tailAt = (tt) => { const p0 = V3(0, r * 0.75, z0 + r * 0.05); for (let i = 0; i <= tailN; i++) { const u = i / tailN; tpts[i].set(Math.sin(u * 2.6 + tt * 0.9) * r * 0.9 * u + Math.sin(tt * 2.3) * r * 0.25 * u * u, Math.max(r * 0.14 * (1 - u * 0.8), r * 0.75 * (1 - sstep(0, 0.25, u))), z0 + r * 0.05 - u * tailL * (1 - 0.15 * u)); } tpts[0].copy(p0); tg.userData.set(tpts); };
    tailAt(0); void tail;
    const base = bodyG.userData.base, pa = bodyG.attributes.position.array;
    g.userData = { len: Lb * 1.1, r, name: rat ? 'a rat' : 'a mouse', y: r * 1.06, body, bodyG, NZ, NA,
      anim(t, live) { // sniffing, a breath, the head turning, the tail swaying; caught: struggling less and less
        const br = 1 + 0.03 * Math.sin(t * 5.5) * (0.3 + 0.7 * live), sn = live * (Math.sin(t * 17) * 0.5 + 0.5) * (Math.sin(t * 1.3) > 0 ? 1 : 0.2), yaw = live * (0.28 * Math.sin(t * 0.8) + 0.06 * Math.sin(t * 3.1)), pitch = live * (0.12 * Math.sin(t * 1.1) - 0.04);
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        for (let v = 0; v < pa.length; v += 3) {
          const x = base[v], y = base[v + 1], z = base[v + 2], w = sstep(zN - r * 0.5, zN + r * 0.6, z), mid = sstep(z0, z0 + Lb * 0.3, z) * (1 - sstep(zN - r, zN, z));
          const dy = (y - r * 1.05) * (br - 1) * mid; let X = x, Y = y + dy, Z = z - zN;
          if (w > 0) { const a = yaw * w, ca = Math.cos(a), sa = Math.sin(a), b = pitch * w, Y0 = Y - r * 1.15; const Z1 = Z * Math.cos(b) - Y0 * Math.sin(b), Y1 = Z * Math.sin(b) + Y0 * Math.cos(b); X = x * ca + Z1 * sa; Z = -x * sa + Z1 * ca; Y = Y1 + r * 1.15; }
          pa[v] = X; pa[v + 1] = Y; pa[v + 2] = Z + zN;
        }
        bodyG.attributes.position.needsUpdate = true; renorm(bodyG, NZ, NA); bodyG.computeBoundingSphere();
        head.rotation.set(-pitch, yaw, 0); head.position.set(0, r * 1.15, zN); void cy; void sy;
        nose.scale.setScalar(1 + 0.12 * sn); wh.rotation.x = 0.06 * sn;
        const kick = (1 - live) > 0.02 && live > 0.02 ? Math.sin(t * 13) * 0.5 * live : 0;
        for (const L of legs) L.g.rotation.x = (L.hind ? 0.1 : -0.05) + kick * (L.hind ? 1 : 0.6) * Math.sin(L.ph + t * 3) + live * 0.05 * Math.sin(t * 2 + L.ph);
        tailAt(t * (0.3 + 0.7 * live));
      } };
    g.userData.anim(0, 1);
    return g;
  }
  if (kind === 'frog') {
    const Lb = r * 3.3, z0 = -Lb / 2, z1 = Lb / 2;
    const top = hexRGB('#5d7a37'), side = hexRGB('#7a8f45'), bel = hexRGB('#e9e1bd'), lip = hexRGB('#2c3518');
    const prof = keyed([[0, { w: 0.25, h: 0.2, c: 0.74, bf: 0.8 }], [0.1, { w: 0.78, h: 0.5, c: 0.8, bf: 0.75 }], [0.35, { w: 1.0, h: 0.62, c: 0.84, bf: 0.7 }], [0.58, { w: 0.97, h: 0.56, c: 0.86, bf: 0.7 }], [0.74, { w: 0.9, h: 0.45, c: 0.84, bf: 0.75 }], [0.88, { w: 0.66, h: 0.32, c: 0.8, bf: 0.8 }], [0.97, { w: 0.3, h: 0.17, c: 0.76, bf: 0.85 }], [1, { w: 0.06, h: 0.06, c: 0.75, bf: 1 }]]);
    const pr = (t) => { const p = prof(t); return { w: p.w * r * 1.25, h: p.h * r, c: p.c * r, bf: p.bf }; };
    const NZ = 36, NA = 28, Rb = rnd(seed + 3), spots = Array.from({ length: 14 }, () => [Rb() * 0.8 + 0.1, (Rb() - 0.5) * 2.2, 0.04 + Rb() * 0.06]);
    const bodyG = loft(pr, z0, z1, NZ, NA, (t, a, s, c) => {
      let col = mixRGB(mixRGB(top, side, sstep(0.6, 0.0, c)), bel, sstep(-0.05, -0.5, c));
      for (const [st, sa, sr] of spots) { const d = Math.hypot((t - st) * 1.6, angDiff(a, sa) * 0.25); if (c > -0.1 && d < sr) col = mixRGB(col, hexRGB('#2e3d1a'), 0.75 * sstep(sr, sr * 0.6, d)); }
      const jaw = sstep(0.025, 0.0, Math.abs(c + 0.05)) * sstep(0.62, 0.8, t); return mixRGB(col, lip, jaw * 0.85);
    });
    const skin = new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, map: speckle('#b8b8a8', 1800, 0.35, seed), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2, sheen: 0.2 });
    mesh(bodyG, skin);
    const legM = new THREE.MeshPhysicalMaterial({ color: '#6b8540', roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25, map: speckle('#8a9a6a', 900, 0.4, seed + 5) }), webM = new THREE.MeshPhysicalMaterial({ color: '#8a9a5a', roughness: 0.4, transparent: true, opacity: 0.85, side: THREE.DoubleSide, clearcoat: 0.6 });
    const throat = mesh(S(r * 0.42, 16, 10), new THREE.MeshPhysicalMaterial({ color: '#e7dfb7', roughness: 0.35, clearcoat: 0.6 })); throat.position.set(0, r * 0.5, lerp(z0, z1, 0.82)); throat.scale.set(1.3, 0.55, 1.1);
    for (const sg of [-1, 1]) {
      // eyes: gold iris, horizontal pupil, a lid of skin over the top
      const ep = V3(sg * r * 0.62, r * 1.18, lerp(z0, z1, 0.76));
      const iris = canvasTex(128, (x, s) => { const gr = x.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2); gr.addColorStop(0, '#d8b048'); gr.addColorStop(0.7, '#a07a28'); gr.addColorStop(1, '#3a2a10'); x.fillStyle = gr; x.fillRect(0, 0, s, s); x.fillStyle = '#050505'; x.beginPath(); x.ellipse(s / 2, s / 2, s * 0.32, s * 0.13, 0, 0, TAU); x.fill(); });
      iris.wrapS = iris.wrapT = THREE.ClampToEdgeWrapping;
      const eg = new THREE.SphereGeometry(r * 0.27, 20, 14); const uvA = eg.attributes.uv, pA = eg.attributes.position; for (let i = 0; i < pA.count; i++) uvA.setXY(i, 0.5 + pA.getZ(i) / (r * 0.27) * 0.5 * Math.sign(sg) * 0 + pA.getX(i) / (r * 0.27) * 0.5 * -sg, 0.5 + pA.getY(i) / (r * 0.27) * 0.5); // (iris facing outward)
      const eye = mesh(eg, new THREE.MeshPhysicalMaterial({ map: iris, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 })); eye.position.copy(ep);
      const lidG = new THREE.SphereGeometry(r * 0.29, 18, 8, 0, TAU, 0, Math.PI * 0.32); const lid = mesh(lidG, skin); lid.material = legM; lid.position.copy(ep); lid.rotation.z = -sg * 0.55;
      const ty = mesh(new THREE.CircleGeometry(r * 0.17, 20), new THREE.MeshPhysicalMaterial({ color: '#6b5530', roughness: 0.3, clearcoat: 0.7 })); ty.position.set(sg * r * 1.07, r * 0.95, lerp(z0, z1, 0.63)); ty.rotation.y = sg * Math.PI / 2 * 0.9;
      // hind legs folded under: thigh forward, shin back, the long foot forward again with webbed toes
      const hip = V3(sg * r * 0.7, r * 0.6, lerp(z0, z1, 0.12)), knee = V3(sg * r * 1.45, r * 0.42, lerp(z0, z1, 0.42)), ank = V3(sg * r * 1.3, r * 0.22, lerp(z0, z1, 0.05)), toe = V3(sg * r * 1.55, r * 0.05, lerp(z0, z1, 0.5));
      const fc = hexRGB('#ffffff'); mesh(limbTube([hip, knee, ank, toe], [r * 0.34, r * 0.2, r * 0.11, r * 0.07], [fc, fc, fc, fc], 12, 34), legM).geometry.deleteAttribute('color');
      const web = new THREE.Shape(); const toes = [];
      for (let k = 0; k < 5; k++) { const a = (k / 4 - 0.5) * 1.1 + sg * 0.1, d = V3(Math.sin(a) * sg, -0.05, Math.cos(a)).normalize(), e = toe.clone().addScaledVector(d, r * (0.45 + 0.15 * Math.sin(k))); toes.push(e); mesh(limbGeo(toe, e, r * 0.05, r * 0.03, 5), legM); }
      web.moveTo(0, 0); toes.forEach((e) => web.lineTo((e.x - toe.x), (e.z - toe.z))); web.lineTo(0, 0);
      const wgeo = new THREE.ShapeGeometry(web); wgeo.rotateX(Math.PI / 2); wgeo.translate(toe.x, toe.y + r * 0.005, toe.z); mesh(wgeo, webM);
      // front legs
      const sh = V3(sg * r * 0.75, r * 0.55, lerp(z0, z1, 0.66)), el2 = V3(sg * r * 1.0, r * 0.3, lerp(z0, z1, 0.7)), hd = V3(sg * r * 0.9, r * 0.05, lerp(z0, z1, 0.8));
      { const fc = hexRGB('#ffffff'); mesh(limbTube([sh, el2, hd], [r * 0.14, r * 0.1, r * 0.07], [fc, fc, fc], 10, 20), legM).geometry.deleteAttribute('color'); }
      for (let k = 0; k < 4; k++) { const a = (k / 3 - 0.5) * 1.4 + sg * 0.3; mesh(limbGeo(hd, hd.clone().add(V3(Math.sin(a) * r * 0.22, -r * 0.02, Math.cos(a) * r * 0.22)), r * 0.035, r * 0.025, 5), legM); }
    }
    g.userData = { len: Lb, r: r * 1.2, name: 'a frog', y: r * 0.82, bodyG, NZ, NA,
      anim(t, live) { throat.scale.set(1.3, 0.55 + 0.12 * live * Math.max(0, Math.sin(t * 7)), 1.1 + 0.05 * live * Math.max(0, Math.sin(t * 7))); g.children[0].scale.y = 1 + 0.025 * live * Math.sin(t * 2.2); } };
    return g;
  }
  if (kind === 'fish') {
    const Lb = r * 6.4, z0 = -Lb / 2, z1 = Lb / 2;
    const prof = keyed([[0, { w: 0.08, h: 0.2, c: 1 }], [0.12, { w: 0.14, h: 0.32, c: 1 }], [0.3, { w: 0.36, h: 0.78, c: 1.0 }], [0.55, { w: 0.48, h: 1.0, c: 1.0 }], [0.75, { w: 0.44, h: 0.9, c: 0.98 }], [0.9, { w: 0.3, h: 0.6, c: 0.96 }], [1, { w: 0.05, h: 0.12, c: 0.95 }]]);
    const pr = (t) => { const p = prof(t); return { w: p.w * r, h: p.h * r, c: p.c * r, bf: 1.05 }; };
    const NZ = 40, NA = 26;
    const tex = canvasTex(256, (x, s) => { // u around (0.5 = the back), v along: dark back, silver flanks, white belly; scales, a lateral line
      const gr = x.createLinearGradient(0, 0, s, 0); gr.addColorStop(0, '#f3f4f0'); gr.addColorStop(0.2, '#c6d0d2'); gr.addColorStop(0.36, '#8fa3a8'); gr.addColorStop(0.46, '#3d5560'); gr.addColorStop(0.5, '#2d4350'); gr.addColorStop(0.54, '#3d5560'); gr.addColorStop(0.64, '#8fa3a8'); gr.addColorStop(0.8, '#c6d0d2'); gr.addColorStop(1, '#f3f4f0');
      x.fillStyle = gr; x.fillRect(0, 0, s, s); x.strokeStyle = 'rgba(20,30,40,.2)'; x.lineWidth = 1;
      for (let yy = 0; yy < s + 6; yy += 6) for (let xx = (yy / 6) % 2 ? 3 : 0; xx < s; xx += 6) { x.beginPath(); x.arc(xx, yy, 4, 0.15, Math.PI - 0.15); x.stroke(); }
      x.strokeStyle = 'rgba(30,40,50,.45)'; for (const u of [0.31, 0.69]) { x.beginPath(); x.moveTo(u * s, 0); x.lineTo(u * s, s); x.stroke(); }
      x.fillStyle = 'rgba(40,50,60,.25)'; x.fillRect(0, s * 0.78, s, 3);
    }, 1, 1);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    const bodyG = loft(pr, z0, z1, NZ, NA, null);
    const fishM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: tex, roughness: 0.22, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, iridescence: 0.35, iridescenceIOR: 1.6 });
    mesh(bodyG, fishM);
    const finTex = canvasTex(64, (x, s) => { x.fillStyle = '#7c8f94'; x.fillRect(0, 0, s, s); x.strokeStyle = 'rgba(40,50,55,.5)'; for (let i = 0; i < s; i += 5) { x.beginPath(); x.moveTo(0, s / 2); x.lineTo(s, i); x.stroke(); } });
    const finM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: finTex, roughness: 0.35, transparent: true, opacity: 0.78, side: THREE.DoubleSide, clearcoat: 0.6 });
    const fin = (pts, at, ry, rx = 0, parent = g) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) sh.quadraticCurveTo(p[0], p[1], p[2], p[3]); const m = mesh(new THREE.ShapeGeometry(sh, 6), finM, parent); m.position.copy(at); m.rotation.set(rx, ry, 0); m.castShadow = false; return m; };
    const tailG = new THREE.Group(); tailG.position.set(0, r, z0 + r * 0.1); g.add(tailG);
    fin([[0, 0], [-r * 0.6, r * 0.5, -r * 1.5, r * 1.15], [-r * 0.9, 0, -r * 1.5, -r * 1.15], [-r * 0.6, -r * 0.5, 0, 0]], V3(0, 0, 0), -Math.PI / 2, 0, tailG);
    fin([[0, 0], [r * 0.3, r * 0.9, r * 1.6, r * 0.75], [r * 1.4, r * 0.3, r * 1.9, 0]], V3(0, r * 1.93, -r * 1.2), -Math.PI / 2);
    fin([[0, 0], [r * 0.3, -r * 0.6, r * 1.1, -r * 0.45], [r * 1.0, -r * 0.1, r * 1.2, 0]], V3(0, r * 0.2, -r * 1.9), -Math.PI / 2);
    for (const sg of [-1, 1]) {
      fin([[0, 0], [r * 0.2, -r * 0.5, r * 0.9, -r * 0.35], [r * 0.6, 0, 0, 0]], V3(sg * r * 0.42, r * 0.75, r * 1.2), -Math.PI / 2 - sg * 0.5, 0.3);
      fin([[0, 0], [r * 0.1, -r * 0.35, r * 0.6, -r * 0.25], [r * 0.4, 0, 0, 0]], V3(sg * r * 0.3, r * 0.25, r * 0.2), -Math.PI / 2 - sg * 0.3, 0.2);
      const ey = mesh(S(r * 0.19, 16, 12), new THREE.MeshPhysicalMaterial({ color: '#d8c890', roughness: 0.1, metalness: 0.3, clearcoat: 1 })); ey.position.set(sg * r * 0.3, r * 1.15, z1 - r * 0.85); ey.scale.set(0.5, 1, 1);
      const pu = mesh(S(r * 0.11, 12, 10), glossEye()); pu.position.set(sg * r * 0.38, r * 1.15, z1 - r * 0.85); pu.scale.set(0.5, 1, 1);
    }
    const base = bodyG.userData.base, pa = bodyG.attributes.position.array;
    g.userData = { len: Lb * 1.12, r, name: 'a fish', y: r,
      anim(t, live) { // a wave runs down the body, growing towards the tail
        const A = r * 0.35 * (0.35 + 0.65 * live), w = 7 * (0.4 + 0.6 * live);
        for (let v = 0; v < pa.length; v += 3) { const z = base[v + 2], u = (z1 - z) / Lb, amp = A * u * u; pa[v] = base[v] + amp * Math.sin(u * 5.5 - t * w); }
        bodyG.attributes.position.needsUpdate = true; renorm(bodyG, NZ, NA); bodyG.computeBoundingSphere();
        const tx = A * Math.sin(5.5 - t * w); tailG.position.x = tx; tailG.rotation.y = -Math.cos(5.5 - t * w) * 0.6 * (A / r);
      } };
    return g;
  }
  if (kind === 'bird') {
    const Lb = r * 3.6, z0 = -Lb / 2, z1 = Lb / 2;
    const prof = keyed([[0, { w: 0.05, h: 0.07, c: 1.12 }], [0.07, { w: 0.42, h: 0.5, c: 1.08 }], [0.2, { w: 0.84, h: 0.9, c: 1.0 }], [0.45, { w: 1.0, h: 1.0, c: 0.98 }], [0.7, { w: 0.8, h: 0.85, c: 1.08 }], [0.8, { w: 0.55, h: 0.6, c: 1.25 }], [0.85, { w: 0.58, h: 0.62, c: 1.38 }], [0.95, { w: 0.5, h: 0.52, c: 1.42 }], [1, { w: 0.08, h: 0.1, c: 1.4 }]]);
    const pr = (t) => { const p = prof(t); return { w: p.w * r, h: p.h * r, c: p.c * r, bf: 1 }; };
    const brown = hexRGB('#8f6c4a'), breast = hexRGB('#ece0c6'), cap = hexRGB('#5a3a22');
    const bodyG = loft(pr, z0, z1, 36, 24, (t, a, s, c) => mixRGB(mixRGB(brown, breast, sstep(0.0, -0.6, c) * sstep(0.2, 0.5, t)), cap, sstep(0.82, 0.88, t) * sstep(0.2, 0.7, c)));
    const fe = new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, map: furTex(seed + 2, '40,30,20', '235,220,195', 4, 5), roughness: 0.88, sheen: 0.9, sheenRoughness: 0.6, sheenColor: new THREE.Color('#e6d5b8') });
    mesh(bodyG, fe); furShells(g, bodyG, fe, 5, r * 0.08, [26, 34], mesh);
    const featherTex = canvasTex(128, (x, s) => { x.fillStyle = '#6a523a'; x.fillRect(0, 0, s, s); for (let i = 0; i < 9; i++) { const y = (i / 9) * s; x.fillStyle = i % 2 ? '#5a4430' : '#7d6448'; x.beginPath(); x.ellipse(s / 2, y + s / 18, s * 0.48, s / 12, 0, 0, TAU); x.fill(); x.strokeStyle = 'rgba(230,215,190,.55)'; x.lineWidth = 1.2; x.beginPath(); x.ellipse(s / 2, y + s / 18, s * 0.46, s / 13, 0, 0, Math.PI); x.stroke(); } x.strokeStyle = 'rgba(30,20,10,.5)'; x.beginPath(); x.moveTo(s / 2, 0); x.lineTo(s / 2, s); x.stroke(); });
    const wingM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: featherTex, roughness: 0.85, sheen: 0.6, sheenColor: new THREE.Color('#cdb894'), side: THREE.DoubleSide });
    for (const sg of [-1, 1]) {
      const wg = loft((t) => ({ w: r * 0.12 * Math.sin(Math.PI * clamp(t, 0.02, 0.98)) ** 0.5, h: r * 0.62 * Math.sin(Math.PI * clamp(t * 0.85 + 0.12, 0, 1)) ** 0.6, c: 0, bf: 1 }), -Lb * 0.62, Lb * 0.22, 16, 12, null);
      const w = mesh(wg, wingM); w.position.set(sg * r * 0.82, r * 1.12, 0); w.rotation.set(0.12, -sg * 0.06, sg * 0.18);
      const bp = V3(sg * r * 0.3, r * 0.45, z0 * 0.1), lc = hexRGB('#ffffff'); const lm = new THREE.MeshStandardMaterial({ color: '#b98a5c', roughness: 0.6 }); mesh(limbTube([bp, V3(sg * r * 0.33, r * 0.24, z0 * 0.16), V3(sg * r * 0.32, r * 0.02, z0 * 0.05)], [r * 0.09, r * 0.04, r * 0.035], [lc, lc, lc], 8, 14), lm).geometry.deleteAttribute('color');
      for (const a of [-0.5, 0, 0.5, Math.PI]) mesh(limbGeo(V3(sg * r * 0.32, r * 0.02, z0 * 0.05), V3(sg * r * 0.32 + Math.sin(a) * r * 0.3, r * 0.015, z0 * 0.05 + Math.cos(a) * r * 0.3), r * 0.025, r * 0.018, 4), lm);
    }
    const head = new THREE.Group(); head.position.set(0, r * 1.35, z1 - r * 0.55); g.add(head);
    const bk = new THREE.MeshPhysicalMaterial({ color: '#3a3226', roughness: 0.35, clearcoat: 0.5 });
    const up = new THREE.ConeGeometry(r * 0.17, r * 0.62, 12); up.rotateX(Math.PI / 2); up.scale(1, 0.55, 1); up.translate(0, r * 0.03, r * 0.72); mesh(up, bk, head);
    const lo = new THREE.ConeGeometry(r * 0.14, r * 0.5, 12); lo.rotateX(Math.PI / 2); lo.scale(1, 0.45, 1); lo.translate(0, -r * 0.05, r * 0.66); mesh(lo, bk, head);
    for (const sg of [-1, 1]) { const e = mesh(S(r * 0.1, 12, 10), glossEye(), head); e.position.set(sg * r * 0.34, r * 0.12, r * 0.2); const ring = mesh(new THREE.TorusGeometry(r * 0.11, r * 0.018, 6, 16), new THREE.MeshStandardMaterial({ color: '#e8dcc0' }), head); ring.position.copy(e.position); ring.rotation.y = sg * Math.PI / 2; }
    const tailG = new THREE.Group(); tailG.position.set(0, r * 1.15, z0 + r * 0.1); g.add(tailG);
    for (let k = -2; k <= 2; k++) { const fg = new THREE.PlaneGeometry(r * 0.32, r * 1.4); fg.translate(0, -r * 0.7, 0); const f = mesh(fg, wingM, tailG); f.rotation.set(Math.PI / 2 + 0.25, 0, k * 0.16); f.position.x = k * r * 0.05; }
    g.userData = { len: Lb * 1.1, r, name: 'a small bird', y: r * 1.02, bodyG, NZ: 36, NA: 24,
      anim(t, live) { head.rotation.set(0, live * (0.5 * Math.sin(t * 1.3) + 0.2 * Math.sin(t * 4.1)), live * 0.1 * Math.sin(t * 2.7)); tailG.rotation.x = -live * 0.15 * Math.max(0, Math.sin(t * 3.3)); g.children[0].scale.y = 1 + 0.03 * live * Math.sin(t * 7); } };
    return g;
  }
  if (kind === 'lizard') {
    const Lb = r * 7, z0 = -Lb * 0.62, z1 = Lb * 0.38; // (the snout-vent part in front, the tail behind)
    const prof = keyed([[0, { w: 0.04, h: 0.04, c: 0.62 }], [0.25, { w: 0.25, h: 0.22, c: 0.66 }], [0.5, { w: 0.55, h: 0.42, c: 0.72 }], [0.58, { w: 0.85, h: 0.55, c: 0.78 }], [0.72, { w: 0.95, h: 0.6, c: 0.8 }], [0.82, { w: 0.62, h: 0.48, c: 0.86 }], [0.86, { w: 0.68, h: 0.5, c: 0.9 }], [0.94, { w: 0.5, h: 0.36, c: 0.88 }], [1, { w: 0.06, h: 0.06, c: 0.84 }]]);
    const pr = (t) => { const p = prof(t); return { w: p.w * r, h: p.h * r, c: p.c * r, bf: 0.7 }; };
    const NZ = 60, NA = 20;
    const tex = canvasTex(256, (x, s) => { x.fillStyle = '#7a6845'; x.fillRect(0, 0, s, s); const R2 = rnd(seed + 7); for (let yy = 0; yy < s; yy += 5) for (let xx = (yy / 5) % 2 ? 2.5 : 0; xx < s; xx += 5) { x.fillStyle = 'rgba(' + (R2() < 0.5 ? '30,22,10' : '230,215,170') + ',' + R2() * 0.25 + ')'; x.beginPath(); x.ellipse(xx, yy, 2.2, 2.6, 0, 0, TAU); x.fill(); } x.fillStyle = 'rgba(235,220,170,.55)'; x.fillRect(s * 0.38, 0, s * 0.04, s); x.fillRect(s * 0.58, 0, s * 0.04, s); x.fillStyle = 'rgba(40,28,14,.4)'; for (let yy = 0; yy < s; yy += 18) x.fillRect(s * 0.44, yy, s * 0.12, 6); x.fillStyle = 'rgba(230,222,195,.85)'; x.fillRect(0, 0, s * 0.15, s); x.fillRect(s * 0.85, 0, s * 0.15, s); }, 1, 4);
    const lm = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: tex, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.35 });
    const bodyG = loft(pr, z0, z1, NZ, NA, null); mesh(bodyG, lm);
    const legM = new THREE.MeshPhysicalMaterial({ color: '#7d6b48', roughness: 0.5, clearcoat: 0.3, map: speckle('#8a7652', 700, 0.4, seed + 2) });
    const legs = [];
    for (const sg of [-1, 1]) for (const [t, hind] of [[0.79, false], [0.56, true]]) {
      const lg = new THREE.Group(), p = pr(t); lg.position.set(sg * p.w * 0.7, p.c - p.h * 0.2, lerp(z0, z1, t)); g.add(lg); legs.push({ g: lg, sg, hind });
      const el2 = V3(sg * r * (hind ? 0.8 : 0.65), r * 0.05, hind ? -r * 0.15 : r * 0.1), ft = V3(sg * r * (hind ? 0.95 : 0.75), -lg.position.y + r * 0.05, hind ? -r * 0.05 : r * 0.25);
      { const fc = hexRGB('#ffffff'); mesh(limbTube([V3(-sg * r * 0.15, r * 0.05, 0), el2.clone().add(V3(0, r * 0.08, 0)), ft], [r * (hind ? 0.2 : 0.15), r * 0.1, r * 0.065], [fc, fc, fc], 10, 22), legM, lg).geometry.deleteAttribute('color'); }
      for (let k = 0; k < 5; k++) { const a = (k / 4 - 0.5) * 1.6 + sg * 0.2 + (hind ? -0.3 * sg : 0.2 * sg), l = r * (0.18 + 0.12 * Math.sin((k / 4) * Math.PI)) * (hind && k === 3 ? 1.5 : 1); mesh(limbGeo(ft, ft.clone().add(V3(Math.sin(a) * l, -r * 0.03, Math.cos(a) * l)), r * 0.03, r * 0.018, 4), legM, lg); }
    }
    for (const sg of [-1, 1]) { const e = mesh(S(r * 0.1, 12, 10), glossEye('#2a1a0a')); e.position.set(sg * r * 0.36, r * 1.05, lerp(z0, z1, 0.935)); const lid = mesh(new THREE.TorusGeometry(r * 0.105, r * 0.025, 6, 16), legM); lid.position.copy(e.position); lid.rotation.y = sg * Math.PI / 2; }
    const base = bodyG.userData.base, pa = bodyG.attributes.position.array;
    g.userData = { len: Lb, r, name: 'a lizard', y: r * 0.74, bodyG, NZ, NA,
      anim(t, live) { const A = r * 0.45 * (0.3 + 0.7 * live); for (let v = 0; v < pa.length; v += 3) { const z = base[v + 2], u = clamp((z1 - Lb * 0.45 - z) / (Lb * 0.55), 0, 1); pa[v] = base[v] + A * u * u * Math.sin(u * 4 - t * 1.6); pa[v + 1] = base[v + 1] + (z > z1 - Lb * 0.2 ? r * 0.06 * live * Math.max(0, Math.sin(t * 2.4)) * sstep(z1 - Lb * 0.2, z1, z) : 0); }
        bodyG.attributes.position.needsUpdate = true; renorm(bodyG, NZ, NA); bodyG.computeBoundingSphere(); for (const L of legs) L.g.rotation.y = live * 0.08 * Math.sin(t * 2 + (L.hind ? 1 : 0) + (L.sg > 0 ? 0 : Math.PI)); } };
    // the lizard's centre is its body (tail behind): shift so the snout-vent part is centred
    g.children.forEach((c) => { c.position.z += Lb * 0.12; });
    return g;
  }
  return null;
}
function buildPrey(kind, r, seed) {
  { const nb = buildPrey2(kind, r, seed); if (nb) { const out = new THREE.Group(); nb.position.y = -nb.userData.y; out.add(nb); out.userData = nb.userData; return out; } } // (the origin on the body's axis, nb.userData.y above the feet)
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
  } else if (kind === 'bird') { // v5.57: a nestling or small bird (tree snakes and some mambas take birds)
    len = r * 3.6;
    const feath = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: speckle('#8a7356', 2600, 0.35, seed, 256, true), roughness: 0.9, sheen: 0.8, sheenRoughness: 0.7, sheenColor: new THREE.Color('#d9c8ad') });
    const beakM = new THREE.MeshStandardMaterial({ color: '#d8b04a', roughness: 0.45 }), eyeM = new THREE.MeshPhysicalMaterial({ color: '#0b0908', roughness: 0.08, clearcoat: 1 }), legM = new THREE.MeshStandardMaterial({ color: '#c98f5a', roughness: 0.6 });
    add(along(lathe([[0, -0.5], [0.5, -0.43], [0.86, -0.22], [1, 0.0], [0.9, 0.2], [0.55, 0.33], [0.5, 0.38], [0, 0.4]].map(([a, b]) => [a * r, b * len]), 28)), feath, 0, r, 0, 1, 0.92, 1); // body
    add(S(r * 0.62, 20, 14), feath, 0, r * 1.25, len * 0.42); // head
    add(new THREE.ConeGeometry(r * 0.2, r * 0.55, 10).rotateX(Math.PI / 2), beakM, 0, r * 1.18, len * 0.42 + r * 0.75);
    for (const sg of [-1, 1]) {
      add(S(r * 0.1, 12, 8), eyeM, sg * r * 0.4, r * 1.42, len * 0.47);
      add(S(r * 0.62, 18, 10), feath, sg * r * 0.78, r * 1.08, -len * 0.04, 0.32, 0.62, 1.25, 0.15, 0, 0); // folded wing
      add(new THREE.CapsuleGeometry(r * 0.06, r * 0.4, 3, 6), legM, sg * r * 0.3, r * 0.1, len * 0.02, 1, 1, 1, Math.PI / 2, 0, 0);
    }
    const tl = new THREE.Shape(); tl.moveTo(-r * 0.35, 0); tl.lineTo(r * 0.35, 0); tl.lineTo(r * 0.45, -r * 1.1); tl.lineTo(-r * 0.45, -r * 1.1); tl.lineTo(-r * 0.35, 0);
    add(new THREE.ShapeGeometry(tl), new THREE.MeshStandardMaterial({ color: '#6e5a42', roughness: 0.9, side: THREE.DoubleSide }), 0, r * 1.05, -len * 0.42, 1, 1, 1, -Math.PI / 2 - 0.2, 0, 0);
    g.userData = { len: len * 1.1, r, name: 'a small bird', y: r * 0.95 };
  } else if (kind === 'centipede' || kind === 'worm' || kind === 'slug' || kind === 'caterpillar') { // v5.57: small long prey of small snakes
    const cent = kind === 'centipede', slug = kind === 'slug';
    len = r * (cent ? 16 : slug ? 6 : kind === 'caterpillar' ? 9 : 22);
    const col = { centipede: '#9a5a2a', worm: '#c98b84', slug: '#7a6450', caterpillar: '#7fa04a' }[kind];
    const tex = canvasTex(128, (x, s2) => { x.fillStyle = col; x.fillRect(0, 0, s2, s2); x.fillStyle = cent ? 'rgba(40,20,8,.55)' : 'rgba(60,30,30,.25)'; for (let yy = 0; yy < s2; yy += 8) x.fillRect(0, yy, s2, cent ? 2 : 1); }, 1, cent ? 10 : slug ? 2 : 12);
    const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: tex, roughness: slug || kind === 'worm' ? 0.3 : 0.5, clearcoat: slug || kind === 'worm' ? 0.9 : 0.4 });
    const n = 30, pts = []; for (let i = 0; i <= n; i++) { const t = i / n; pts.push(V3(Math.sin(t * (slug ? 1.5 : 5)) * r * (slug ? 0.3 : 1.6) * t, r * (slug ? 0.7 : 0.9), len * (0.5 - t))); }
    const bt = new THREE.Mesh(varTube(pts, (t) => r * (slug ? Math.sin(Math.PI * clamp(t * 1.15, 0.08, 0.98)) * (1 - t * 0.3) : (t < 0.06 ? 0.65 + t * 6 : 1 - Math.max(0, t - 0.85) * 3.5)), 12, 60), m); bt.castShadow = true; g.add(bt);
    if (slug) bt.scale.set(1.15, 0.75, 1);
    if (cent) { // legs, a pair on each segment, and feelers
      const lm = new THREE.MeshStandardMaterial({ color: '#c88a4a', roughness: 0.6 }), lg = new THREE.CylinderGeometry(r * 0.08, r * 0.05, r * 1.4, 4);
      for (let i = 2; i < n - 1; i++) for (const sg of [-1, 1]) { const q = pts[i]; add(lg, lm, q.x + sg * r * 1.1, r * 0.35, q.z, 1, 1, 1, 0, 0, sg * 1.1); }
      for (const sg of [-1, 1]) add(new THREE.CylinderGeometry(r * 0.05, r * 0.03, r * 3, 4), lm, sg * r * 0.6, r * 1.1, len * 0.5 + r * 1.3, 1, 1, 1, Math.PI / 2 - 0.3, 0, sg * 0.5);
    }
    if (slug) for (const sg of [-1, 1]) add(new THREE.CylinderGeometry(r * 0.08, r * 0.1, r * 0.9, 6), m, sg * r * 0.3, r * 1.2, len * 0.42, 1, 1, 1, 0.6, 0, -sg * 0.3);
    g.userData = { len, r, name: { centipede: 'a centipede', worm: 'an earthworm', slug: 'a slug', caterpillar: 'a caterpillar' }[kind], y: r * 0.7 };
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
  // v5.57: small snakes that eat invertebrates (Ernst & Ernst 2003, Snakes of the United States and Canada; SnakeList species notes)
  if (/hook.?nose|centipede|black.?headed snake|ground snake|shovel.?nose|scorpion/.test(nm) || has(['gyalopion', 'tantilla', 'sonora', 'chionactis', 'stenorrhina', 'scolecophis', 'tantillita', 'ficimia', 'aparallactus'])) return 'centipede';
  if (/slug|snail/.test(nm) || has(['contia', 'dipsas', 'sibon', 'pareas', 'duberria', 'tropidodipsas', 'storeria'])) return 'slug';
  if (/worm ?snake|earth ?snake/.test(nm) || has(['carphophis', 'virginia', 'haldea', 'calamaria'])) return 'worm';
  if (/green snake/.test(nm) || has(['opheodrys'])) return 'caterpillar';
  if (has(['boiga', 'corallus', 'thelotornis']) || /green mamba|jameson.?s mamba|cat ?snake/.test(nm)) return 'bird';
  if (plan === 'sea' || /sea ?snake|sea ?krait|water ?snake|watersnake|mud ?snake|fishing|file ?snake|mangrove/.test(nm) || has(['hydrophis', 'laticauda', 'aipysurus', 'emydocephalus', 'nerodia', 'enhydris', 'homalopsis', 'cerberus', 'acrochordus', 'regina', 'erpeton', 'farancia', 'hypsirhina', 'myron', 'fordonia', 'agkistrodon'].filter((g) => g !== 'agkistrodon' || /cottonmouth|water/.test(nm)))) return 'fish';
  if (/king ?cobra|kingsnake|king snake|krait|coral ?snake|snake.?eater|mussurana/.test(nm) || has(['ophiophagus', 'lampropeltis', 'bungarus', 'micrurus', 'calliophis', 'micruroides', 'drymarchon', 'clelia', 'aspidelaps'])) return 'snake';
  if (/frog|toad|keelback|garter|ribbon|hognose|grass snake|cat.?eyed/.test(nm) || has(['thamnophis', 'natrix', 'rhabdophis', 'xenodon', 'leptodeira', 'heterodon', 'amphiesma', 'hebius', 'fowlea', 'xenochrophis', 'erythrolamprus', 'liophis', 'leioheterodon', 'tropidonophis', 'lycodryas'])) return 'frog';
  if (/whipsnake|racer|sand snake|lizard|smooth snake|leaf.?nosed|vine snake|tree snake|bronzeback|desert/.test(nm) || has(['coronella', 'psammophis', 'hemorrhois', 'masticophis', 'dendrelaphis', 'chrysopelea', 'ahaetulla', 'oxybelis', 'philodryas', 'macroprotodon', 'malpolon', 'acanthophis', 'demansia', 'eirenis', 'rhinocheilus', 'dispholidus'])) return 'lizard';
  return 'mouse';
}

// v6.13: how this snake handles its prey, by genus (Eduardo: "check if some snakes do or don't" wrap their prey; the
// sources are in tools/eating-behaviour.md): 'constrict' (boas, pythons, kingsnakes, rat snakes, gopher snakes...),
// 'alive' (garter and water snakes, racers, whipsnakes, hognoses: seized and swallowed, never coiled round), or '' for
// the general rule (venomous snakes use venom; other colubrids constrict mammals and birds)
const CONSTRICT_G = ['lampropeltis', 'pantherophis', 'elaphe', 'pituophis', 'zamenis', 'coronella', 'bogertophis', 'arizona', 'rhinocheilus', 'cemophora', 'euprepiophis', 'orthriophis', 'gonyosoma', 'oreocryptophis', 'senticolis', 'spilotes', 'pseudelaphe', 'pseustes', 'phrynonax', 'boaedon', 'lamprophis', 'clelia', 'oxyrhopus', 'lycodon', 'stilosoma'];
const ALIVE_G = ['thamnophis', 'nerodia', 'natrix', 'regina', 'storeria', 'opheodrys', 'heterodon', 'xenodon', 'farancia', 'liodytes', 'amphiesma', 'hebius', 'rhabdophis', 'fowlea', 'xenochrophis', 'tropidonophis',
  'coluber', 'masticophis', 'hierophis', 'dolichophis', 'platyceps', 'ptyas', 'drymarchon', 'drymobius', 'salvadora', 'psammophis', 'malpolon', 'dendrelaphis', 'ahaetulla', 'chrysopelea', 'oxybelis', 'philodryas', 'dasypeltis', 'elachistodon'];
function feedStyle(P, id) {
  const gen = String(id || '').toLowerCase().split('-')[0];
  if ((P.plan || 'colubrid') === 'python' || CONSTRICT_G.includes(gen)) return 'constrict';
  return ALIVE_G.includes(gen) ? 'alive' : '';
}

// ================================================================= create
export function create(V) {
  THREE = V.THREE; injectCSS();
  const P = V.P, el = V.el, on = V.on, labels = V.labels, stage = V.stage, wrap = V.wrap, bar = V.bar;
  const now = () => performance.now();
  let rig = null, show = null, slither = null, anat = null, sizeLay = null, camBlend = null, alive = true;
  const plan = P.plan || 'colubrid', venomous = ['viper', 'pitviper', 'elapid', 'sea'].includes(plan);
  const fanged = () => !!(V.extras && V.extras.mouth && V.extras.mouth.fanged);

  // ---- layout: the stage sits in a row so a photo or a map can open beside it
  const row = el('div', 'sp3d-row'), side = el('aside', 'sp3d-side'); side.hidden = true;
  const layout = () => { if (row.parentNode || !stage.parentNode) return; stage.parentNode.insertBefore(row, stage); row.append(stage, side); }; // once mount() has placed the stage
  const capt = el('div', 'sp3d-capt'); capt.hidden = true; capt.setAttribute('aria-live', 'polite'); stage.appendChild(capt);
  const stepTag = el('div', 'sp3d-step'); stepTag.hidden = true; stage.appendChild(stepTag);
  const tip = el('div', 'sp3d-tip'); tip.hidden = true; stage.appendChild(tip);
  function say(html) { if (!html) { capt.hidden = true; capt.dataset.k = ''; return; } if (capt.dataset.k === html) return; capt.dataset.k = html; capt.innerHTML = html; capt.hidden = false; }
  // v5.68: notes, lists and labels laid over the 3D view never cover its buttons (Compare photo, See countries, the main
  // buttons, Show more, fullscreen): the buttons' boxes in the stage's own pixels (looked up a few times a second)
  let btnR = [], btnT = 0;
  function buttonRects() {
    const t = now(); if (t - btnT < 300 && btnR.length) return btnR; btnT = t; btnR = [];
    const sr = stage.getBoundingClientRect();
    stage.querySelectorAll('.sp3d-bar .sp3d-b, .sp3d-hdb .sp3d-b, .sp3d-fsc').forEach((e) => {
      if (e.hidden || e.closest('[hidden]')) return; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
      btnR.push({ x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height });
    });
    return btnR;
  }
  // the lowest bottom edge of the buttons along the top of the view, in the columns x0..x1 (where a note may start)
  function belowButtons(x0, x1, h) { let y = 0; for (const r of buttonRects()) if (r.x < x1 + 6 && r.x + r.w > x0 - 6 && r.y < h * 0.5) y = Math.max(y, r.y + r.h); return y + 8; }
  // a box (top-left x, y; size w, h) moved down below any button it would cover (or up above one in the lower half)
  function keepClear(x, y, w, h) {
    const H = stage.clientHeight;
    for (let k = 0; k < 6; k++) {
      const r = buttonRects().find((q) => x < q.x + q.w + 4 && x + w + 4 > q.x && y < q.y + q.h + 4 && y + h + 4 > q.y); if (!r) break;
      y = r.y < H * 0.5 ? r.y + r.h + 6 : r.y - h - 6;
    }
    return [x, y];
  }

  // ---- buttons in the bar under the model (all .sp3d-b, so the NEW-tag logic of the pages and app keeps working)
  const before = bar.querySelector('.sp3d-views');
  const mk = (txt, title) => { const b = V.btn(txt, title); if (before) bar.insertBefore(b, before); return b; };
  const bEat = mk('See it eat', 'Watch it catch and swallow its usual food'); bEat.setAttribute('aria-pressed', 'false');
  const bSlither = mk('Slither', 'Watch it slither along the ground'); bSlither.setAttribute('aria-pressed', 'false');
  // v5.78: See it eat can be paused and replayed (they show only while it runs, next to Stop eating)
  const bPause = mk('Pause', 'Pause'); bPause.hidden = true; bPause.setAttribute('aria-pressed', 'false'); bPause.classList.add('sp3d-play');
  const bReplay = mk('Replay', 'Watch it again from the start'); bReplay.hidden = true; bReplay.classList.add('sp3d-play');
  // v5.12: Fullscreen is just its icon, in the bottom-right corner of the 3D view
  const bFull = el('button', 'sp3d-fsc'); bFull.type = 'button'; bFull.setAttribute('aria-label', 'Fullscreen'); bFull.setAttribute('aria-pressed', 'false'); bFull.innerHTML = ICON.full; stage.appendChild(bFull);
  const bAnat = V.bAnat;
  // v5.78: the person for Size vs person is fetched when you reach for that button (and the view redrawn when it arrives)
  personWait.add(V.kick);
  { const bSz = [...bar.querySelectorAll('.sp3d-b')].find((b) => /Size vs person/.test(b.textContent)); if (bSz) for (const ev of ['pointerenter', 'pointerdown', 'focus', 'touchstart']) on(bSz, ev, () => { loadPerson().catch(() => {}); }, { passive: true }); }

  // ---- header buttons beside the name: Compare photo, See countries
  let hdb = null; const hdbs = {};
  if (V.opts.head && V.opts.head.parentNode) {
    hdb = el('span', 'sp3d-hdb');
    const mkH = (k, txt, icon, title) => { const b = el('button', 'sp3d-b sp3d-hb'); b.type = 'button'; b.innerHTML = icon + '<span>' + txt + '</span>'; b.setAttribute('aria-pressed', 'false'); hdb.appendChild(b); on(b, 'click', () => toggleSide(k)); hdbs[k] = b; return b; };
    mkH('photo', 'Compare photo', ICON.photo, 'Show its real photo beside the 3D model');
    mkH('map', document.documentElement.classList.contains('sl-pv-design') ? 'See more info' : 'See countries', ICON.map, 'Show the countries where it lives beside the 3D model');
    stage.appendChild(hdb); // v5.50: inside the 3D view, in its top-right corner
  }
  let sideKind = null, sideRO = null;
  function toggleSide(k) {
    if (sideKind === k) { closeSide(); return; }
    sideKind = k; side.innerHTML = ''; side.hidden = false;
    for (const q in hdbs) hdbs[q].setAttribute('aria-pressed', String(q === k));
    const ph0 = k === 'photo' ? (typeof V.opts.photo === 'function' ? V.opts.photo() : V.opts.photo) : null;
    const hd = el('div', 'sp3d-side-hd'), t = el('span', '', k === 'photo' ? (ph0 && ph0.title ? ph0.title : (V.opts.name || '').trim() ? V.opts.name.trim() + ' photo' : 'Photo') : 'Where it lives'), x = el('button', 'sp3d-side-x', '×');
    x.type = 'button'; x.setAttribute('aria-label', 'Close'); on(x, 'click', closeSide); hd.append(t, x); side.appendChild(hd);
    const b = el('div', 'sp3d-side-b'); side.appendChild(b);
    if (k === 'photo') {
      const ph = ph0;
      if (ph && ph.src) {
        const f = el('figure'), im = new Image(); im.alt = ph.alt || ('Photo of ' + V.opts.name); im.decoding = 'async';
        // v5.12: the sharpest copy there is - iNaturalist's large photo (not the small medium one or the 540 px tile);
        // if it does not load, the photo SnakeList was given, then its saved tile
        const tries = [], it = window.SL_PHOTOS && window.SL_PHOTOS.items && window.SL_PHOTOS.items[V.opts.id], fn = it && /^\d+\.(jpe?g|png|webp)$/i.test(String(it[4] || '')) ? String(it[4]) : '';
        if (/inaturalist-open-data[^/]*\/photos\/\d+\/(medium|small|square)\./.test(ph.src)) tries.push(ph.src.replace(/\/(medium|small|square)\./, '/large.'));
        else if (fn && !ph.own) tries.push('https://inaturalist-open-data.s3.amazonaws.com/photos/' + fn.replace('.', '/large.')); // (v6.35: never in place of a sighting's OWN photo - See the spot showed the species' photo for every sighting)
        tries.push(ph.src); if (ph.fb) tries.push(ph.fb);
        let ti = 0; im.src = tries[0]; on(im, 'error', () => { if (++ti < tries.length) im.src = tries[ti]; });
        // v5.12: the photo zooms (wheel, pinch, double-click) and pans (drag) so you can compare the scales up close
        // v6.35 (preview "spot"): in See the spot the photo opens whole (fit, not a tall crop), with Fit photo / Reset camera /
        // Focus snake and a bigger photo or a bigger scene; its credit is a line of its own, apart from the instructions
        const pvC = spotPv() && !!stage.closest('.sl3d-spot');
        const vp = el('div', 'sp3d-pz'); vp.appendChild(im); f.appendChild(vp); const pz = panZoom(vp, im, pvC);
        const zh = el('div', 'sp3d-pzh', (touchUI() ? 'Pinch' : 'Scroll') + ' to zoom the photo, drag to move it, double-' + (touchUI() ? 'tap' : 'click') + ' to zoom in'); vp.appendChild(zh);
        if (pvC) { zh.classList.add('sp3d-pzh-top'); setTimeout(() => zh.classList.add('sp3d-pzh-out'), 6000); f.appendChild(compareBar(pz)); }
        if (ph.credit) { const c = el('figcaption'); if (pvC) c.className = 'sp3d-credit2'; c.innerHTML = ph.credit; f.appendChild(c); } b.appendChild(f);
      } else b.appendChild(el('p', 'sp3d-none2', 'SnakeList has no photo of this snake yet.'));
    } else {
      const u = typeof V.opts.mapUrl === 'function' ? V.opts.mapUrl() : V.opts.mapUrl;
      if (u) { const fr = document.createElement('iframe'); fr.title = 'Map of where ' + V.opts.name + ' lives'; fr.loading = 'lazy'; fr.src = u; b.appendChild(fr); }
      else b.appendChild(el('p', 'sp3d-none2', 'No map for this snake yet.'));
    }
    V.kick();
  }
  function panZoom(vp, im, contain) {
    let z = 1, tx = 0, ty = 0; const ptr = new Map(); let pinch = 0, z0 = 1, last = null;
    // the photo first fills the whole panel (cover); zooming out to 1 shows all of it (contain). v6.35 (preview "spot"):
    // contain first - the whole photo, never a tall crop of it
    const coverK = () => { const w = vp.clientWidth, h = vp.clientHeight, iw = im.naturalWidth, ih = im.naturalHeight; if (!w || !h || !iw || !ih) return 1; const a = Math.min(w / iw, h / ih), b = Math.max(w / iw, h / ih); return b / a; };
    const startK = () => (contain ? 1 : coverK());
    const fit = () => { z = startK(); tx = ty = 0; apply(); };
    on(im, 'load', fit);
    if (window.ResizeObserver) { if (sideRO) sideRO.disconnect(); const ro = sideRO = new ResizeObserver(() => { if (z <= startK() + 0.01) fit(); else apply(); }); ro.observe(vp); } // (v6.35: one watcher, let go with the panel)
    const clampT = () => { const w = vp.clientWidth, h = vp.clientHeight, iw = im.naturalWidth || w, ih = im.naturalHeight || h, a = Math.min(w / iw, h / ih), mx = Math.max(0, (z * a * iw - w) / 2), my = Math.max(0, (z * a * ih - h) / 2); tx = clamp(tx, -mx, mx); ty = clamp(ty, -my, my); };
    const apply = () => { clampT(); im.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + z + ')'; vp.classList.toggle('sp3d-pz-on', z > coverK() + 0.01); };
    const zoomAt = (nz, cx, cy) => { nz = clamp(nz, 1, coverK() * 6); const r = vp.getBoundingClientRect(), px = cx - r.left - r.width / 2, py = cy - r.top - r.height / 2; tx = px - ((px - tx) * nz) / z; ty = py - ((py - ty) * nz) / z; z = nz; apply(); };
    on(vp, 'wheel', (e) => { e.preventDefault(); zoomAt(z * Math.exp(-clamp(e.deltaY, -120, 120) * 0.0025), e.clientX, e.clientY); }, { passive: false });
    on(vp, 'dblclick', (e) => { e.preventDefault(); const c = coverK(); zoomAt(z > c * 1.4 ? c : c * 2.5, e.clientX, e.clientY); });
    on(vp, 'pointerdown', (e) => { try { vp.setPointerCapture(e.pointerId); } catch (er) { /* synthetic pointer */ } ptr.set(e.pointerId, [e.clientX, e.clientY]); if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); z0 = z; } last = [e.clientX, e.clientY]; });
    on(vp, 'pointermove', (e) => {
      if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptr.size === 2 && pinch) { const [a, b] = [...ptr.values()]; zoomAt(z0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); return; }
      if (last) { tx += e.clientX - last[0]; ty += e.clientY - last[1]; last = [e.clientX, e.clientY]; apply(); }
    });
    const up = (e) => { ptr.delete(e.pointerId); if (ptr.size < 2) pinch = 0; last = ptr.size ? [...ptr.values()][0] : null; };
    on(vp, 'pointerup', up); on(vp, 'pointercancel', up);
    return { fit, get fitted() { return Math.abs(z - startK()) < 0.01 && !tx && !ty; } };
  }
  // v6.35 (preview "spot"): the buttons under the photo in See the spot - Fit photo, Reset camera, Focus snake, and which
  // side is bigger (photo or scene). On a phone the two are not squeezed into narrow columns: a Photo | Scene switch
  // shows one at a time (row.sp3d-one)
  function compareBar(pz) {
    const bar2 = el('div', 'sp3d-cmp'); bar2.setAttribute('role', 'toolbar'); bar2.setAttribute('aria-label', 'Compare the photo with the scene');
    const mkB = (txt, fn, cls) => { const q = el('button', 'sp3d-cb' + (cls ? ' ' + cls : ''), txt); q.type = 'button'; on(q, 'click', fn); bar2.appendChild(q); return q; };
    mkB('Fit photo', () => pz.fit());
    mkB('Reset camera', () => { if (V.resetView) V.resetView(); V.kick(); });
    mkB('Focus snake', () => { const inf = V.info; if (inf && V.view) V.view({ el: (16 * Math.PI) / 180, d: inf.dFit * 0.9, px: 0, pz: 0 }); V.kick(); });
    const wide = (k) => { row.classList.toggle('sp3d-wphoto', k === 'photo'); row.classList.toggle('sp3d-wscene', k === 'scene'); bP.setAttribute('aria-pressed', String(k === 'photo')); bS.setAttribute('aria-pressed', String(k === 'scene')); setTimeout(() => V.kick(), 60); };
    const bP = mkB('Bigger photo', () => wide(bP.getAttribute('aria-pressed') === 'true' ? '' : 'photo'), 'sp3d-cw'), bS = mkB('Bigger scene', () => wide(bS.getAttribute('aria-pressed') === 'true' ? '' : 'scene'), 'sp3d-cw');
    bP.setAttribute('aria-pressed', 'false'); bS.setAttribute('aria-pressed', 'false');
    oneUI();
    return bar2;
  }
  // phones: Photo | Scene, one at a time (the switch sits at the top of the row)
  let seg = null;
  function oneUI() {
    if (seg) return;
    seg = el('div', 'sp3d-seg2'); seg.setAttribute('role', 'tablist'); seg.setAttribute('aria-label', 'Show');
    const tab = (txt, k) => { const q = el('button', 'sp3d-sg', txt); q.type = 'button'; q.setAttribute('role', 'tab'); on(q, 'click', () => showOne(k)); seg.appendChild(q); return q; };
    const tP = tab('Photo', 'photo'), tS = tab('Scene', 'scene');
    const showOne = (k) => { row.dataset.one = k; tP.setAttribute('aria-selected', String(k === 'photo')); tS.setAttribute('aria-selected', String(k === 'scene')); setTimeout(() => V.kick(), 60); };
    showOne('scene'); row.classList.add('sp3d-one'); row.insertBefore(seg, row.firstChild);
  }
  function closeSide() { sideKind = null; side.hidden = true; side.innerHTML = ''; if (sideRO) { sideRO.disconnect(); sideRO = null; } if (seg) { seg.remove(); seg = null; row.classList.remove('sp3d-one', 'sp3d-wphoto', 'sp3d-wscene'); delete row.dataset.one; } for (const q in hdbs) hdbs[q].setAttribute('aria-pressed', 'false'); V.kick(); }

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
    const hb = new Float32Array(N); for (let i = 0; i < N; i++) hb[i] = F.Hh(i * dx) * F.bf; // (v5.68: a swelling grows up and out from the belly, which stays on the ground)
    const xEnd = mo ? mo.headX * 1.3 : F.Hl * 0.95, xr = Math.min(L * 0.3, xEnd * 1.06);
    const ih = Math.max(2, Math.round(xr / dx)), it = N - 1 - Math.max(3, Math.round(N * 0.012));
    // rest headings and horizontal step lengths (for poses built from turning angles)
    const rth = new Float32Array(N), rh = new Float32Array(N);
    for (let i = 0; i < N - 1; i++) { const ax = rc[i * 3 + 3] - rc[i * 3], az = rc[i * 3 + 5] - rc[i * 3 + 2]; rth[i] = Math.atan2(az, ax); rh[i] = Math.max(1e-9, Math.hypot(ax, az)); }
    rth[N - 1] = rth[N - 2]; rh[N - 1] = rh[N - 2];
    for (let i = 1; i < N; i++) rth[i] = rth[i - 1] + angDiff(rth[i - 1], rth[i]); // unwrapped
    // v5.73: the real (3D) length of every step along the body, and the distance of each sample from the snout: every
    // pose keeps these, so the body never stretches or shrinks, however it bends, rises or coils
    const s3 = new Float32Array(N), S3 = new Float32Array(N);
    for (let i = 0; i < N - 1; i++) s3[i] = Math.max(1e-9, Math.hypot(rc[i * 3 + 3] - rc[i * 3], rc[i * 3 + 4] - rc[i * 3 + 1], rc[i * 3 + 5] - rc[i * 3 + 2]));
    s3[N - 1] = s3[N - 2]; for (let i = 1; i < N; i++) S3[i] = S3[i - 1] + s3[i - 1];
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
      const pa = geo.attributes.position, n = pa.count, src = opt.gpu ? null : pa.array.slice(), loc = opt.gpu ? null : new Float32Array(n * 3), fi = opt.gpu ? null : new Float32Array(n);
      const s = { geo, pa, src, loc, fi, n, bulge: !!opt.bulge, body: !!opt.body, rigid: opt.rigid || null, gpu: !!opt.gpu };
      if (!s.gpu) { for (let v = 0; v < n; v++) fi[v] = clamp(xs[v] / dx, 0, N - 1.0001); localize(s, 0, n, src); } skins.push(s); return s; // (v5.78: the body skin is bent on the graphics card - viewer.js skinGPU)
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
    const gpuSkin = !!(V.skinGPU && V.skinGPU.init(N, dx, rc, rT, rU, rS, hb));
    const bodySkin = addSkin(body.geo, bx, { bulge: true, body: true, gpu: gpuSkin });
    // v5.83: the sculpted head (viewer.js buildHeadSkin) bends with the body on the graphics card; here only when that is not possible
    const hMesh = !gpuSkin && group.children.find((o) => o.userData && o.userData.headSkin), headSkin = hMesh ? addSkin(hMesh.geometry, hMesh.geometry.attributes.aMet.array.filter((_, i) => i % 3 === 1)) : null;
    const mver = () => (mo ? (mo.ver != null ? mo.ver : mo.t) : 0); let lastT = mver(), active = false;
    const contact = V.scene && V.scene.children.find((o) => o.isMesh && o.renderOrder === 1 && o.material && o.material.map && o.material.transparent && o.geometry && o.geometry.type === 'PlaneGeometry');
    // v5.73: while the body is posed (slithering, hunting) a soft contact shadow follows it on the ground - darkest where
    // the belly touches, fading where the body lifts off (a coil, the raised head), and none on water - instead of the
    // painted one for the resting pose, which used to just disappear
    const rib = (() => {
      if (!contact || !V.scene) return null;
      const nS = 120, pos = new Float32Array((nS + 1) * 2 * 3), col = new Float32Array((nS + 1) * 2 * 4), uv = new Float32Array((nS + 1) * 2 * 2), idx = [];
      for (let k = 0; k <= nS; k++) { uv.set([0, k / nS, 1, k / nS], k * 4); col.fill(0, k * 8, k * 8 + 8); if (k < nS) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 4)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
      const tex = canvasTex(64, (x, S) => { const gr = x.createLinearGradient(0, 0, S, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, 'rgba(0,0,0,.55)'); gr.addColorStop(0.5, 'rgba(0,0,0,.8)'); gr.addColorStop(0.7, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.clearRect(0, 0, S, S); x.fillStyle = gr; x.fillRect(0, 0, S, S); });
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, depthWrite: false, color: '#ffffff', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.renderOrder = 1; m.frustumCulled = false; m.visible = false; m.userData.noRig = true; m.raycast = () => {}; V.scene.add(m);
      const wMesh = V.scene.children.find((o) => o.isMesh && o.renderOrder === 2 && o.material && o.material.transparent), wY = wMesh ? wMesh.position.y : -1e9, sea = !!(P.scene && P.scene.kind === 'sea');
      const fl = new Float32Array(nS + 1);
      function update() {
        if (sea) return;
        const step = (N - 1) / nS, win = Math.max(2, Math.round(nS * 0.06));
        for (let k = 0; k <= nS; k++) { const i = Math.round(k * step); fl[k] = nc[i * 3 + 1] - F.Hh(i * dx) * F.bf; }
        for (let k = 0; k <= nS; k++) {
          const i = Math.round(k * step), x = i * dx; let lo = 1e9; for (let q = Math.max(0, k - win); q <= Math.min(nS, k + win); q++) lo = Math.min(lo, fl[q]);
          const up = fl[k] - lo, a = (1 - sstep(F.Hh(x) * 0.15, F.Hh(x) * 1.6, up)) * (lo < wY + F.Hh(x) * 0.2 ? 0 : 1) * sstep(0, L * 0.02, x) * (1 - sstep(L * 0.9, L, x)) * 0.8;
          const cx = nc[i * 3], cz = nc[i * 3 + 2], j = Math.min(N - 1, i + 1), j0 = Math.max(0, i - 1); let tx = nc[j * 3] - nc[j0 * 3], tz = nc[j * 3 + 2] - nc[j0 * 3 + 2]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
          const w = F.W(x) * 1.35 * (1 + up / Math.max(1e-6, F.Hh(x)) * 0.4), y = lo + Math.max(1e-4, L * 0.0006);
          pos.set([cx - tz * w, y, cz + tx * w, cx + tz * w, y, cz - tx * w], k * 6); col[k * 8 + 3] = col[k * 8 + 7] = a;
        }
        g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
      }
      return { m, update };
    })();
    const mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), tv = new THREE.Vector3();
    const basis = (arr1, arr2, arr3, i, m) => m.set(arr1[i * 3], arr2[i * 3], arr3[i * 3], 0, arr1[i * 3 + 1], arr2[i * 3 + 1], arr3[i * 3 + 1], 0, arr1[i * 3 + 2], arr2[i * 3 + 2], arr3[i * 3 + 2], 0, 0, 0, 0, 1);
    function rigidAt(i, out) { // the move that carries rest frame i onto the new frame i
      basis(nT, nU, nS, i, mA); basis(rT, rU, rS, i, mB); mB.transpose(); out.multiplyMatrices(mA, mB);
      tv.set(rc[i * 3], rc[i * 3 + 1], rc[i * 3 + 2]).applyMatrix4(out); out.setPosition(nc[i * 3] - tv.x, nc[i * 3 + 1] - tv.y, nc[i * 3 + 2] - tv.z); return out;
    }
    const hM = new THREE.Matrix4(), tM = new THREE.Matrix4(), q3 = new THREE.Vector3(), fTol = Math.max(F.w0 * 1.5, L * 0.004);
    function frames() {
      for (let i = ih - 1; i < N; i++) {
        const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1);
        let Tx = nc[b * 3] - nc[a * 3], Ty = nc[b * 3 + 1] - nc[a * 3 + 1], Tz = nc[b * 3 + 2] - nc[a * 3 + 2]; const l = Math.hypot(Tx, Ty, Tz) || 1; Tx /= l; Ty /= l; Tz /= l;
        let Ux = -Tx * Ty, Uy = 1 - Ty * Ty, Uz = -Tz * Ty; let lu = Math.hypot(Ux, Uy, Uz) || 1; Ux /= lu; Uy /= lu; Uz /= lu;
        // v6.02: where the body is (nearly) back in its resting place it takes its resting frame again, so leaving and
        // coming back to the rest pose never makes the body twist or jump (a draped python's loops are rolled round the branch)
        const dd = Math.hypot(nc[i * 3] - rc[i * 3], nc[i * 3 + 1] - rc[i * 3 + 1], nc[i * 3 + 2] - rc[i * 3 + 2]);
        if (dd < fTol) {
          const w = 1 - sstep(0, fTol, dd);
          Tx = lerp(Tx, rT[i * 3], w); Ty = lerp(Ty, rT[i * 3 + 1], w); Tz = lerp(Tz, rT[i * 3 + 2], w); const lt = Math.hypot(Tx, Ty, Tz) || 1; Tx /= lt; Ty /= lt; Tz /= lt;
          Ux = lerp(Ux, rU[i * 3], w); Uy = lerp(Uy, rU[i * 3 + 1], w); Uz = lerp(Uz, rU[i * 3 + 2], w); const dt = Ux * Tx + Uy * Ty + Uz * Tz; Ux -= Tx * dt; Uy -= Ty * dt; Uz -= Tz * dt;
          lu = Math.hypot(Ux, Uy, Uz) || 1; Ux /= lu; Uy /= lu; Uz /= lu;
        }
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
        if (bb) { const k = bul[i] + (bul[i + 1] - bul[i]) * w; if (k !== 1) { const h0 = hb[i] + (hb[i + 1] - hb[i]) * w; l1 = (l1 + h0) * k - h0; l2 *= k; } }
        for (let c = 0; c < 3; c++) a[v * 3 + c] = nc[i3 + c] + (nc[j3 + c] - nc[i3 + c]) * w + (nT[i3 + c] + (nT[j3 + c] - nT[i3 + c]) * w) * l0 + (nU[i3 + c] + (nU[j3 + c] - nU[i3 + c]) * w) * l1 + (nS[i3 + c] + (nS[j3 + c] - nS[i3 + c]) * w) * l2;
      }
      s.pa.needsUpdate = true; s.geo.computeVertexNormals();
      if (s.body) seam(s.geo);
      s.geo.computeBoundingSphere();
    }
    function seam(geo) { const nr = geo.attributes.normal.array; for (let i = 0; i < body.nR; i++) { const a = i * (M + 1), b = a + M; for (let q = 0; q < 3; q++) { const m = (nr[a * 3 + q] + nr[b * 3 + q]) / 2; nr[a * 3 + q] = nr[b * 3 + q] = m; } } geo.attributes.normal.needsUpdate = true; }
    function apply(keepContact) {
      if (mo && mver() !== lastT) { if (!bodySkin.gpu) localize(bodySkin, 0, jawVerts, bodySkin.pa.array); if (headSkin) localize(headSkin, 0, headSkin.n, headSkin.pa.array); lastT = mver(); } // the jaw moved: take its new shape
      frames();
      headRig.matrix.copy(hM); headRig.matrixWorldNeedsUpdate = true; tailRig.matrix.copy(tM); tailRig.matrixWorldNeedsUpdate = true;
      for (const s of skins) { if (s.gpu) V.skinGPU.upload(nc, nT, nU, nS, bul); else deform(s); }
      if (!active) { active = true; if (contact && !keepContact) contact.visible = false; }
      if (rib) { rib.m.visible = !keepContact && V.sceneOn !== false && !(P.scene && P.scene.kind === 'sea'); if (rib.m.visible) rib.update(); }
    }
    function release() {
      if (!active) return; active = false;
      nc.set(rc); nT.set(rT); nU.set(rU); nS.set(rS); bul.fill(1);
      for (const s of skins) { if (s.gpu) { V.skinGPU.off(); continue; } s.pa.array.set(s.src); s.pa.needsUpdate = true; if (!s.body) { s.geo.computeVertexNormals(); s.geo.computeBoundingSphere(); } }
      if (bodySkin.gpu) lastT = mver(); else { if (mo) { mo.set(mo.t); mo.settle(); lastT = mver(); } else { body.geo.computeVertexNormals(); seam(body.geo); } body.geo.computeBoundingSphere(); }
      headRig.matrix.identity(); tailRig.matrix.identity(); headRig.matrixWorldNeedsUpdate = tailRig.matrixWorldNeedsUpdate = true;
      if (contact) contact.visible = true; if (rib) rib.m.visible = false;
    }
    // poses ------------------------------------------------------------
    // a centre line from turning angles th[i] (segment i -> i+1), anchored at sample a, heights ys
    // v5.73: each step keeps its real 3D length (where the body rises or drops, the step over the ground is shorter)
    function integrate(th, a, ax, az, ys) {
      const out = new Float32Array(N * 3); out[a * 3] = ax; out[a * 3 + 2] = az;
      const hz = (i) => { const dy = ys[i + 1] - ys[i], q = s3[i] * s3[i]; return Math.sqrt(Math.max(q * 0.04, q - dy * dy)); };
      for (let i = a + 1; i < N; i++) { const h = hz(i - 1); out[i * 3] = out[i * 3 - 3] + Math.cos(th[i - 1]) * h; out[i * 3 + 2] = out[i * 3 - 1] + Math.sin(th[i - 1]) * h; }
      for (let i = a - 1; i >= 0; i--) { const h = hz(i); out[i * 3] = out[i * 3 + 3] - Math.cos(th[i]) * h; out[i * 3 + 2] = out[i * 3 + 5] - Math.sin(th[i]) * h; }
      for (let i = 0; i < N; i++) out[i * 3 + 1] = ys[i];
      return out;
    }
    const restY = new Float32Array(N); for (let i = 0; i < N; i++) restY[i] = rc[i * 3 + 1];
    // v5.68: a snake up in a tree reaches out at the height of its branch, not down to the ground
    const perchY = V.info.tree && V.info.tree.userData.perch ? V.info.tree.userData.perch.a.y : 0; // (the top of its branch)
    const baseY = (i, fl = perchY) => F.Hh(i * dx) * F.bf + fl;
    // v5.73: a pose to build on (the rest pose, or wherever the snake has crawled or swum to): its headings, centre
    // line, heights and the level of the ground (or water) under its head
    function baseOf(pose, fl) {
      const th = new Float32Array(N), y = new Float32Array(N);
      for (let i = 0; i < N - 1; i++) th[i] = Math.atan2(pose[i * 3 + 5] - pose[i * 3 + 2], pose[i * 3 + 3] - pose[i * 3]);
      th[N - 1] = th[N - 2]; for (let i = 1; i < N; i++) th[i] = th[i - 1] + angDiff(th[i - 1], th[i]);
      for (let i = 0; i < N; i++) y[i] = pose[i * 3 + 1];
      return { th, c: pose, y, fl: fl != null ? fl : perchY };
    }
    const REST = { th: rth, c: rc, y: restY, fl: perchY };
    // the head-and-neck posture: forebody up to sample is pointed along heading phi (the direction T, from head to
    // tail, is phi + PI), curled into an S by amount 'coil'; lifted by 'lift' at the head; head turned by 'yaw'
    // (v5.73: built on o.base - by default the rest pose; the head itself is held level, aimed straight ahead)
    function fore(o) {
      const B = o.base || REST, bth = B.th, by = B.y, bc = B.c;
      const is = Math.min(N - 2, Math.round(o.len / dx)), th = bth.slice(), ys = by.slice(), phiT = o.phi + Math.PI, tr = Math.max(4, Math.round(is * 0.3)), hl0 = Math.min(is - 2, ih * 1.3);
      const base = bth[is] + angDiff(bth[is], phiT); // the reaching direction, unwrapped next to the body's own heading
      for (let i = is - 1; i >= 0; i--) {
        const k = sstep(is, is - tr, i); let a = base + angDiff(base, bth[is]) * (1 - k);
        const u = (is - i) / is, w = sstep(0, ih * 1.6, i) * (1 - sstep(is * 0.82, is, i));
        a += (o.coil || 0) * 1.25 * Math.sin(TAU * 1.5 * u) * w;
        if (o.yaw) a += o.yaw * (1 - sstep(ih * 0.9, ih * 2.4, i));
        th[i] = a;
        const ly = (o.lift || 0) * Math.pow(clamp((is - i) / Math.max(1, is - hl0), 0, 1), 1.6) * (1 - (o.coil || 0) * 0.25); // (level over the head and the neck just behind it)
        const bY = baseY(i, B.fl);
        ys[i] = lerp(by[i], bY + clamp(by[i] - bY, 0, F.Hh(F.Hl) * 0.6), sstep(is, is * 0.7, i)) + ly;
      }
      const out = integrate(th, is, bc[is * 3], bc[is * 3 + 2], ys);
      if (B !== REST) out.set(bc.subarray(is * 3), is * 3); // (behind the reach the body stays exactly where it is)
      return out;
    }
    // v5.73: blend two poses by their turning and climbing angles, from sample a (which moves straight between them):
    // the body bends from one shape into the other without ever changing length
    function ang3(pose) {
      const yw = new Float32Array(N), pt = new Float32Array(N);
      for (let i = 0; i < N - 1; i++) { const ax = pose[i * 3 + 3] - pose[i * 3], ay = pose[i * 3 + 4] - pose[i * 3 + 1], az = pose[i * 3 + 5] - pose[i * 3 + 2]; yw[i] = Math.atan2(az, ax); pt[i] = Math.atan2(ay, Math.hypot(ax, az)); }
      yw[N - 1] = yw[N - 2]; pt[N - 1] = pt[N - 2]; for (let i = 1; i < N; i++) yw[i] = yw[i - 1] + angDiff(yw[i - 1], yw[i]);
      return { yw, pt };
    }
    function blend3(P0, A0, P1, A1, e, a, ep = e) { // (ep: how far the climbing angles have got - the body can curl first and rise after)
      if (e <= 0) return P0.slice(); if (e >= 1) return P1.slice();
      let sm = 0; for (let i = 0; i < N; i++) sm += A0.yw[i] - A1.yw[i]; const off = Math.round(sm / N / TAU) * TAU;
      const out = new Float32Array(N * 3); for (let c = 0; c < 3; c++) out[a * 3 + c] = lerp(P0[a * 3 + c], P1[a * 3 + c], e);
      const st = (i, sg, j) => { const yw = lerp(A0.yw[i], A1.yw[i] + off, e), pt = lerp(A0.pt[i], A1.pt[i], ep), cp = Math.cos(pt) * s3[i]; out[j * 3] = out[(j - sg) * 3] + sg * Math.cos(yw) * cp; out[j * 3 + 1] = out[(j - sg) * 3 + 1] + sg * Math.sin(pt) * s3[i]; out[j * 3 + 2] = out[(j - sg) * 3 + 2] + sg * Math.sin(yw) * cp; };
      for (let i = a + 1; i < N; i++) st(i - 1, 1, i);
      for (let i = a - 1; i >= 0; i--) st(i, -1, i);
      return out;
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
    function sync() { if (active && mo && mver() !== lastT) apply(); } // the mouth opened or shut while the body is posed
    return { N, dx, ih, L, rc, rU, rth, cur: () => nc.slice(), rh, restY, bul, s3, S3, REST, baseOf, ang3, blend3, perchY, headRig, tailRig, addSkin, apply, release, sync, integrate, fore, headMatrixFor, setPose, blend, frameAtX, point, get active() { return active; }, rest: () => rc.slice() };
  }
  function ensureRig() { if (!rig && V.info && V.group) rig = makeRig(); return rig; }

  // ================================================================= camera takeover for the shows
  const cOrb = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
  function orbitAt(tgt, az, el, d) { return tgt.clone().add(V3(d * Math.cos(el) * Math.sin(az), d * Math.sin(el), d * Math.cos(el) * Math.cos(az))); }
  const curTarget = () => { const c = V.cam, d = V.controls.st.d; return c.position.clone().add(c.getWorldDirection(new THREE.Vector3()).multiplyScalar(d)); };
  function camera() {
    const cam = V.cam; let want = null;
    if (show && show.cam) want = show.cam(show.time);
    { const U = V.NATURE && V.NATURE.AMB && V.NATURE.AMB.uClr && V.NATURE.AMB.uClr.value; if (U) { if (want && show.clrR && show.cLast) U.set(show.cLast.tgt.x, show.cLast.tgt.y, show.cLast.tgt.z, show.clrR); else U.w = 0; } }
    if (want) {
      // v5.78: the show keeps the head, the prey and their contact framed (gliding smoothly), and you can still turn round
      // it and zoom in or out (drag, pinch, wheel, keys): what you do is kept as a turn and a zoom on top of its framing
      const st = V.controls.st, t = now();
      if (!show.cLast) { show.cLast = { pos: cam.position.clone(), tgt: curTarget(), t }; const o = cam.position.clone().sub(show.cLast.tgt), dd = o.length() || 1; show.az = Math.atan2(o.x, o.z); show.el = Math.asin(clamp(o.y / dd, -1, 1)); show.d = dd; }
      const c = show.cLast, inst = show.freeze != null && !show.paused, k = inst ? 1 : 1 - Math.exp(-Math.min(0.1, (t - c.t) / 1000) / 0.45); c.t = t;
      const off = want.pos.clone().sub(want.tgt), d0 = off.length() || 1, az0 = Math.atan2(off.x, off.z), el0 = Math.asin(clamp(off.y / d0, -1, 1));
      if (show.set) { show.uAz += angDiff(show.set.az, st.az); show.uEl += st.el - show.set.el; if (st.goal) { if (st.goal.d) show.uKg *= st.goal.d / Math.max(1e-9, show.set.d); if (st.goal.az != null) show.uAz += angDiff(st.az, st.goal.az); if (st.goal.el != null) show.uEl += st.goal.el - st.el; st.goal = null; } /* (wheel, pinch and the arrow keys) */ }
      show.uKg = clamp(show.uKg, 0.3, 3.5); show.uEl = clamp(show.uEl, -0.7, 0.9);
      show.uK += (show.uKg - show.uK) * (inst ? 1 : 1 - Math.exp(-Math.min(0.1, 0.016) / 0.12));
      show.az += angDiff(show.az, az0) * k; show.el += (el0 - show.el) * k; show.d += (d0 - show.d) * k;
      const p0 = c.pos.clone(); c.tgt.lerp(want.tgt, k);
      const az = show.az + show.uAz, el = clamp(show.el + show.uEl, 0.03, 1.48), d = show.d * show.uK;
      c.pos.copy(c.tgt).add(V3(d * Math.cos(el) * Math.sin(az), d * Math.sin(el), d * Math.cos(el) * Math.cos(az)));
      st.az = az; st.el = el; st.d = d; st.goal = null; show.set = { az, el, d };
      place(cam, c.pos, c.tgt);
      return !show.paused || p0.distanceTo(c.pos) > d * 2e-4 || Math.abs(show.uKg - show.uK) > 1e-3;
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
    idleStop(); stopShow(true); stopSlither(); if (anat && anat.on) anat.set(false, true); V.scaleOff();
    ensureRig();
    show = Object.assign({ t0: now(), lastF: now(), time: 0, freeze: null, objs: [], paused: false, uAz: 0, uEl: 0, uK: 1, uKg: 1, set: null }, def);
    { const st = V.controls.st; show.orbit0 = { az: st.az, el: st.el, d: st.goal ? st.goal.d : st.d, px: st.px, pz: st.pz }; }
    if (def.name === 'eat') { if (bEat.parentNode && bPause.previousElementSibling !== bEat) bEat.after(bPause, bReplay); bPause.hidden = bReplay.hidden = false; setPaused(false); }
    show.mouth0 = V.mouthGoal;
    V.controls.st.goal = null; V.controls.st.vaz = V.controls.st.vel = V.controls.st.vpx = V.controls.st.vpz = 0;
    bEat.disabled = true;
    show.btn.disabled = false; show.btn.dataset.lbl = show.btn.textContent; show.btn.textContent = 'Stop eating'; show.btn.setAttribute('aria-pressed', 'true');
    stepTag.hidden = true; V.kick();
  }
  function stopShow(quiet) {
    if (!show) return; const s = show; show = null;
    try { s.end && s.end(); } catch (e) { /* never leave the viewer stuck */ }
    for (const o of s.objs) disposeTree(o);
    (s.undo || []).forEach((f) => f());
    if (rig) rig.release();
    if (V.extras && V.extras.mouth) { V.extras.mouth.set(V.extras.mouth.t); V.mouthGoal = s.mouth0 || 0; flick(0); }
    say(''); stepTag.hidden = true; bPause.hidden = bReplay.hidden = true; setPaused(false, true);
    if (s.orbit0) { const st = V.controls.st, o = s.orbit0; st.az = o.az; st.el = o.el; st.d = o.d; st.px = o.px; st.pz = o.pz; st.goal = null; st.vaz = st.vel = st.vpx = st.vpz = 0; } // (back to the view you had; the glide below)
    for (const b of [bEat]) { b.disabled = false; b.setAttribute('aria-pressed', 'false'); if (b.dataset.lbl) { b.textContent = b.dataset.lbl; delete b.dataset.lbl; } }
    if (s.cLast && !quiet) camBlend = { t0: now(), pos: s.cLast.pos.clone(), tgt: s.cLast.tgt.clone() };
    if (anat) anat.refresh();
    V.kick();
  }
  function setPaused(v, quiet) {
    if (show && !quiet) { if (v && !show.paused) { show.paused = true; show.pauseAt = now(); show.t0 = show.pauseAt - show.time * 1000; } /* (it stops on the frame you see) */ else if (!v && show.paused) { show.paused = false; show.t0 += now() - (show.pauseAt || now()); show.lastF = now(); } }
    bPause.textContent = v ? 'Play' : 'Pause'; bPause.setAttribute('aria-pressed', String(!!v)); bPause.setAttribute('aria-label', v ? 'Play' : 'Pause');
    if (!quiet) V.kick();
  }
  on(bPause, 'click', () => { if (show) setPaused(!show.paused); });
  on(bReplay, 'click', () => { // from the start again, the camera gliding from where it is (your turn and zoom kept)
    if (!show || show.name !== 'eat') return;
    const keep = { cLast: show.cLast, orbit0: show.orbit0, uAz: show.uAz, uEl: show.uEl, uK: show.uK, uKg: show.uKg, az: show.az, el: show.el, d: show.d };
    stopShow(true); startShow({ name: 'eat', btn: bEat }); eat(); if (show) { Object.assign(show, keep); show.set = null; } V.kick();
  });
  function setMouth(t, opt) { const mo = V.extras.mouth; if (!mo) return; const sp = (opt && opt.spread) || 0, wk = (opt && opt.walk) || 0; if (Math.abs(mo.t - t) > 1e-4 || Math.abs((mo.spread || 0) - sp) > 1e-4 || Math.abs((mo.walk || 0) - wk) > 1e-4) mo.set(t, { spread: sp, walk: wk }); V.mouthGoal = t; }
  // v5.53: a tongue flick (s from 0 to 1: out through the notch in the lips, the tips wave, back in; 0 = in its sheath)
  function flick(s, o) { const mo = V.extras && V.extras.mouth; if (mo && mo.flick) mo.flick(s, o); }
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
  function aim(st, lift, base) {
    let phi = st.phi;
    for (let k = 0; k < 3; k++) { const hm = rig.headMatrixFor(rig.fore({ len: st.len, phi, lift, coil: 0, base })), d = V.info.headDir.clone().transformDirection(hm); phi -= angDiff(st.phi, Math.atan2(d.z, d.x)); }
    st.aim = phi; return phi;
  }

  // ---------------------------------------------------------------- See it eat
  // v5.73: the whole hunt, the way real snakes do it (Eduardo: "it does a attacking pose then launches itself and curls
  // around to start eating"):
  //  1. it notices the prey: tongue flicks, the head turns to follow it;
  //  2. it creeps up on it - or, beside water, slides in and swims out to it, waves running down its body (lateral
  //     undulation), leaving ripples;
  //  3. it draws its neck back into an S, the head level and aimed;
  //  4. strike: about a sixth of a second, the mouth opening wide just as it lands;
  //  5. constrictors (boas, pythons, rat snakes, kingsnakes...) throw two or three coils round the prey and squeeze,
  //     wait, loosen the coils, find the prey's head and swallow it head-first (jaw walking);
  //     vipers and elapids let go at once and wait for the venom, then follow the scent trail and swallow;
  //     the others (water snakes, garter snakes, sea snakes...) just swallow what they grabbed;
  //  6. afterwards it crawls on, round and back into its resting place (so the model ends where it began).
  // The prey only ever shows inside the open mouth and throat (cut off across the throat), never through the body.
  function eat() {
    const mo = V.extras.mouth; if (!mo) return;
    const R = rig, F = V.info.F, Hl = F.Hl, L = F.L, st = strikeSetup(0), N = R.N, NAT = V.NATURE || {};
    // v5.68: up in a tree the prey sits on the branch beyond the snake, and the snake reaches along the branch for it
    const perch = V.info.tree && V.info.tree.userData.perch;
    if (perch) {
      const tg = perch.a.clone().addScaledVector(perch.dir, Math.min(perch.len, st.len * 0.6)), d = tg.sub(V.info.headPos).setY(0);
      if (d.lengthSq() > 1e-8) { st.D = d.normalize(); st.phi = Math.atan2(st.D.z, st.D.x); st.perp = V3(-st.D.z, 0, st.D.x); if (st.perp.dot(V.info.center.clone().sub(V.info.headPos).setY(0)) > 0) st.perp.negate(); }
    }
    const onPerch = (p) => { const q = p.clone().sub(perch.a), u = clamp(q.dot(perch.dir), 0, perch.len * 1.6); return perch.a.clone().addScaledVector(perch.dir, u); }; // the nearest point on top of the branch
    const diet = dietOf(P, V.opts.id);
    const rB = (x) => Math.min(F.W(x), F.Hh(x));
    let kind = diet; if (kind === 'mouse' && L > 1.6) kind = 'rat';
    // v5.50: the prey is a real animal of its real size (body radius in metres: a mouse 1.1-1.7 cm, a rat 2.2-4.2 cm...),
    // never a mouse shrunk to fit a tiny snake or blown up for a python: a snake too small for the smallest real one
    // takes a smaller animal instead, and a giant takes the biggest of its kind
    // v5.57: and no wider than this snake's jaws can pass: measured against its own head (a prey's width over the head's
    // width, typical / at most: ~1-1.5 in colubrids and elapids, more in vipers, ~3 in big pythons, 3-4 for the eggs of
    // egg-eaters - Gans 1961, Am. Zool. 1:217; Arnold 1983, Copeia 1983:94; King 2002, Herpetol. Rev.)
    const REAL = { mouse: [0.011, 0.017], rat: [0.022, 0.042], frog: [0.006, 0.03], fish: [0.005, 0.045], lizard: [0.003, 0.025], snake: [0.002, 0.02], egg: [0.009, 0.028], bird: [0.012, 0.04], centipede: [0.0012, 0.006], worm: [0.001, 0.005], slug: [0.002, 0.008], caterpillar: [0.0015, 0.006] };
    let headR = 0; for (let k = 0; k <= 24; k++) headR = Math.max(headR, F.W(Hl * k / 24)); // half the head's width
    // v5.68: a typical meal, not the biggest it could manage (the old typical sizes looked like a giant rat in front of a small head)
    const RATIO = { python: [1.3, 3.0], viper: [1.2, 1.9], pitviper: [1.2, 1.9], elapid: [0.95, 1.35], sea: [0.85, 1.25], colubrid: [1.0, 1.5] }[plan] || [1.0, 1.5];
    const thin = { snake: 0.42, lizard: 0.7, centipede: 0.42, worm: 0.38, caterpillar: 0.5, slug: 0.6, fish: 0.85 };
    const typOf = (k) => k === 'egg' ? 2.4 : thin[k] ? Math.min(thin[k], RATIO[0]) : RATIO[0], maxOf = (k) => k === 'egg' ? 3.4 : thin[k] ? Math.min(thin[k] * 1.35, RATIO[1]) : RATIO[1];
    const fits = (k) => REAL[k][0] <= headR * maxOf(k);
    if (kind === 'mouse' && REAL.rat[0] <= headR * typOf('rat')) kind = 'rat'; // (a big-headed snake, like a ball python, takes a rat even if it is not long)
    for (const [a, b] of [['rat', 'mouse'], ['bird', 'lizard'], ['mouse', 'lizard'], ['frog', 'lizard'], ['fish', 'lizard'], ['lizard', 'centipede'], ['snake', 'worm']]) if (kind === a && !fits(a)) kind = b;
    const hiR = Math.min(REAL[kind][1], headR * maxOf(kind)), loR = Math.min(hiR, REAL[kind][0]);
    const pr = clamp(headR * typOf(kind), loR, hiR);
    const prey = buildPrey(kind, pr, 77); V.scene.add(prey); show.objs.push(prey);
    const longPrey = kind === 'snake' || kind === 'centipede' || kind === 'worm' || kind === 'caterpillar';
    const Lp = prey.userData.len * (longPrey ? 1 : 0.92), prR = prey.userData.r;
    // v5.57: how wide the jaws open, and how far the two halves of the lower jaw spread, for this prey
    const tNeed = mo.tFor ? mo.tFor(prR * 2 * 0.9) : 0.9, tHold = clamp(tNeed * 0.8, 0.3, 1.1), spreadNeed = clamp((prR * 0.95 - headR * 0.8) / headR, 0, 0.6);
    const restSnout = R.rest().subarray(0, 3);
    // v5.83: up in a tree the head is held high enough that the prey, lying along the head's own axis, sits on top of
    // the branch (it used to be pushed up out of the jaws, above and behind the head, cut off at the throat)
    const lift = perch ? Math.max(0, (prey.userData.y || prR) * 0.92 - F.Hh(Hl * 0.5) * F.bf) + Hl * 0.08 : Math.max(0, prR * 0.95 - restSnout[1]) + Hl * 0.05;
    // v6.13: by genus (feedStyle, tools/eating-behaviour.md): constrictors coil round anything with a body to grip (not an
    // egg, a worm, a slug, a centipede or a caterpillar); garter and water snakes, racers and whipsnakes never do
    const style = feedStyle(P, V.opts.id), grips = kind !== 'egg' && kind !== 'worm' && kind !== 'slug' && kind !== 'centipede' && kind !== 'caterpillar';
    const constrict = !perch && grips && style !== 'alive' && (style === 'constrict' || (plan === 'colubrid' && (kind === 'mouse' || kind === 'rat' || kind === 'bird' || (kind === 'snake' && !venomous))));
    const envenom = venomous && kind !== 'egg';
    // vipers, cobras, mambas and kraits let go of prey that could bite back (mammals, birds) and follow it when the venom
    // has worked; frogs, lizards and fish are held until they stop moving (a cottonmouth holds its fish), as in sea snakes
    const letGo = envenom && plan !== 'sea' && (kind === 'mouse' || kind === 'rat' || kind === 'bird');
    const strikes = kind !== 'egg' && kind !== 'worm' && kind !== 'slug' && kind !== 'caterpillar'; // (slow prey is just seized)
    const xp0 = Hl * 0.22;

    // ---- where it hunts: on the ground it creeps up on prey a little way ahead; beside water the prey is in the water
    // (a fish just under the surface, a frog floating, a rat at the water's edge) and it swims out to it
    const info = V.info, ctx = V.ctx || {}, wi = ctx.waterInfo;
    const wMesh = V.scene.children.find((o) => o.isMesh && o.renderOrder === 2 && o.material && o.material.transparent);
    const sea = !!(P.scene && P.scene.kind === 'sea'), waterY = wMesh ? wMesh.position.y : null;
    const travel = !V.info.tree; // (up in a tree, or draped on a branch, it reaches from where it lies)
    const wet = travel && waterY != null && (sea || !!wi);
    const yAt = (pts) => groundYAt(pts, true);
    const by0 = (i) => F.Hh(i * R.dx) * F.bf; // the centre line's height above what it lies on
    const W0 = F.W(L * 0.4), Hm = F.Hh(L * 0.4) * F.bf;
    // what the body rests on at a point: the ground, or (floating) the water surface
    const support = (g) => (!wet || sea ? g : Math.max(g, waterY - Hm * 0.45)); // (a swimming snake floats with its back out of the water)
    const head0 = V3(R.rc[0], 0, R.rc[2]), hd = V3(info.headDir.x, 0, info.headDir.z).normalize();
    let Q = null, gQ = 0, inWater = false;
    if (travel) {
      const out = head0.clone().sub(V3(info.center.x, 0, info.center.z)); if (out.lengthSq() > 1e-10) out.normalize();
      let u = hd.clone().addScaledVector(out, 0.6).normalize(), dist = clamp(L * 0.3, Hl * 4, 1.4);
      if (wet && !sea) { // towards the water, and out into it far enough for the prey
        const wd = V3(wi.dir.x, 0, wi.dir.y); u = wd.clone().addScaledVector(hd, 0.45).normalize(); if (u.dot(wd) < 0.4) u = wd.clone();
        const steps = 48, far = clamp(L * 1.1, 0.4, 3), list = []; for (let k = 1; k <= steps; k++) { const p = head0.clone().addScaledVector(u, (far * k) / steps); list.push([p.x, p.z]); }
        const gy = yAt(list), need = kind === 'fish' ? waterY - prR * 2.6 : kind === 'frog' ? waterY - prR * 1.2 : waterY + prR * 0.1;
        let k0 = gy.findIndex((y) => y < need); if (k0 < 0) k0 = steps - 1;
        dist = Math.max(Hl * 4, (far * (k0 + 1)) / steps + (kind === 'fish' || kind === 'frog' ? Math.max(prR * 4, L * 0.08) : 0));
      } else if (sea) { u = hd.clone().addScaledVector(out, 0.3).normalize(); dist = clamp(L * 0.45, Hl * 5, 2); }
      Q = head0.clone().addScaledVector(u, dist);
      gQ = yAt([[Q.x, Q.z]])[0];
      inWater = wet && (sea || gQ < waterY - prR * 0.3);
    }

    // ---- 1. it notices: the head turns towards the prey (tongue flicking)
    const aimAt = (base, from, to, liftK, len) => { const d = to.clone().sub(from).setY(0); if (d.lengthSq() < 1e-12) d.copy(hd); d.normalize(); const s2 = { phi: Math.atan2(d.z, d.x), len }; return aim(s2, liftK, base); };
    let N1 = R.rest(), B = R.REST, path = null, sh0 = 0, sh1 = 0, shEnd = 0, Lt = R.S3[N - 1], fol = null;
    if (travel) {
      const lenN = clamp(L * 0.2, Hl * 3.5, L * 0.35);
      N1 = R.fore({ len: lenN, phi: aimAt(R.REST, head0, Q, Hl * 0.12, lenN), lift: Hl * 0.12, coil: 0.12 });
      // ---- 2. the path it takes: its own body now (tail to head), then a curve from its head to the prey with waves
      // drawn into it, then (afterwards) round and back into its resting place. Every point of the body follows the
      // path of the head, as in real lateral undulation.
      const H0 = V3(N1[0], 0, N1[2]), t0 = V3(N1[0] - N1[6], 0, N1[2] - N1[8]).normalize();
      let D = Q.clone().sub(H0).setY(0); const dQ = D.length(); D.normalize();
      const E = Q.clone().addScaledVector(D, -(Lp / 2 - xp0) - Hl * 0.05); // the snout's goal: the prey's front just in its mouth
      const pts = [], gs = [];
      for (let i = N - 1; i >= 0; i--) { pts.push([N1[i * 3], N1[i * 3 + 2]]); gs.push(N1[i * 3 + 1] - by0(i)); }
      const hermite = (A, tA, Bp, tB, m, n, wave) => { // a smooth curve (plus optional waves across it), sampled finely
        const out = []; let s = 0, prev = null;
        for (let k = 1; k <= n; k++) {
          const t = k / n, h00 = 2 * t * t * t - 3 * t * t + 1, h10 = t * t * t - 2 * t * t + t, h01 = -2 * t * t * t + 3 * t * t, h11 = t * t * t - t * t;
          const p = A.clone().multiplyScalar(h00).addScaledVector(tA, h10 * m).addScaledVector(Bp, h01).addScaledVector(tB, h11 * m);
          if (prev) s += p.distanceTo(prev); prev = p.clone(); out.push([p, s]);
        }
        if (wave) { // waves across the path, growing in after the start and gone before the end (it ends straight at the prey)
          const tot = s, base = out.map((q) => q[0].clone()); // (directions from the smooth curve itself)
          for (let k = 0; k < out.length; k++) {
            const [p, s1] = out[k], q = base[Math.min(out.length - 1, k + 1)], q0 = base[Math.max(0, k - 1)], tg = q.clone().sub(q0).setY(0).normalize(), nx = V3(-tg.z, 0, tg.x);
            const env = sstep(0, wave.lam * 0.6, s1) * (1 - sstep(tot - wave.lam * 1.1, tot - wave.lam * 0.35, s1));
            p.addScaledVector(nx, wave.A * env * Math.sin((TAU * s1) / wave.lam));
          }
        }
        return out.map((q) => q[0]);
      };
      const lam = wet ? L * 0.5 : L * 0.62, A = Math.min(wet ? L * 0.055 : L * 0.03, lam * 0.12);
      const ext = hermite(H0, t0, E, D, Math.max(dQ * 0.7, Hl * 2), Math.max(60, Math.round(dQ / (R.dx * 0.5))), { lam, A });
      const T0 = V3(R.rc[(N - 1) * 3], 0, R.rc[(N - 1) * 3 + 2]), tT = V3(R.rc[(N - 2) * 3] - R.rc[(N - 1) * 3], 0, R.rc[(N - 2) * 3 + 2] - R.rc[(N - 1) * 3 + 2]).normalize();
      const dR = E.distanceTo(T0), ret = hermite(E, D, T0, tT, Math.max(dR * 1.1, L * 0.35), Math.max(80, Math.round((dR * 1.6) / (R.dx * 0.5))), dR > L * 0.4 ? { lam: L * 0.62, A: L * 0.025 } : null);
      const ge = yAt(ext.map((p) => [p.x, p.z])), gr = yAt(ret.map((p) => [p.x, p.z]));
      ext.forEach((p, k) => { pts.push([p.x, p.z]); gs.push(support(ge[k])); });
      ret.forEach((p, k) => { pts.push([p.x, p.z]); gs.push(support(gr[k])); });
      const nRest = pts.length;
      for (let i = N - 2; i >= 0; i--) { pts.push([R.rc[i * 3], R.rc[i * 3 + 2]]); gs.push(R.restY[i] - by0(i)); } // (back into its resting place, head last)
      // arc length along the path (the body's own parts keep their exact step lengths, so it ends exactly at rest)
      const n = pts.length, cum = new Float32Array(n);
      for (let k = 1; k < n; k++) cum[k] = cum[k - 1] + (k < N ? R.s3[N - 1 - k] : k >= nRest ? R.s3[N - 2 - (k - nRest)] : Math.max(1e-9, Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1], gs[k] - gs[k - 1])));
      sh0 = cum[N - 1]; sh1 = cum[N - 1 + ext.length]; shEnd = cum[n - 1];
      path = { pts, gs, cum, n };
      const at = (s, o) => { // [x, ground, z] at arc length s (straight on beyond the ends)
        let lo = 0, hi = n - 1; if (s <= 0) lo = 0, hi = 1; else if (s >= cum[n - 1]) lo = n - 2, hi = n - 1; else while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < s) lo = m; else hi = m; }
        const w = (s - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]); o[0] = lerp(pts[lo][0], pts[hi][0], w); o[1] = lerp(gs[lo], gs[hi], w); o[2] = lerp(pts[lo][1], pts[hi][1], w); return o;
      };
      const tmp = [0, 0, 0];
      fol = (sh) => { // the pose with the head at arc length sh along the path; the head is held up a little while it travels
        const out = new Float32Array(N * 3), kl = sstep(sh0, sh0 + L * 0.08, sh) * (1 - sstep(shEnd - L * 0.25, shEnd, sh)), up = F.Hh(Hl * 0.6) * (wet ? 0.9 : 0.45) * kl;
        for (let i = 0; i < N; i++) { at(sh - R.S3[i], tmp); const x = i * R.dx; out[i * 3] = tmp[0]; out[i * 3 + 1] = tmp[1] + by0(i) + up * (1 - sstep(Hl * 1.2, Hl * 3.5, x)); out[i * 3 + 2] = tmp[2]; }
        return out;
      };
      const Bp = fol(sh1); at(sh1, tmp); B = R.baseOf(Bp, tmp[1]);
      st.D = D; st.phi = Math.atan2(D.z, D.x); st.perp = V3(-D.z, 0, D.x); if (st.perp.dot(V3(info.center.x - E.x, 0, info.center.z - E.z)) > 0) st.perp.negate();
      const cl = []; for (let k = 0; k < n; k += 3) cl.push(pts[k]); const undo = clearProps(cl, Math.max(W0 * 2.5, prR * 2)); show.undo = (show.undo || []).concat([undo]);
      const fz = [[Q.x, Q.z], [E.x, E.z]]; for (let k = N; k < N - 1 + ext.length; k += 4) fz.push(pts[k]);
      show.undo.push(clearProps(fz, Math.max(prR * 5, W0 * 4, Hl * 2.2), { flat: true }));
      // v6.20: the leaves and grass give way where the prey lies and the snake strikes, coils and swallows (and along the
      // way it comes, a little), so the prey is in plain view on the ground, not under the litter
      show.undo.push(clearGround(cl, Math.max(W0 * 2.4, prR * 1.5)), clearGround(fz, Math.max(prR * 6, W0 * 7, Hl * 2.6)));
    }
    let phi = aim(st, lift, B);
    if (perch) { // up in a tree: turn the reach until the head comes down right over the branch (Newton steps on its distance from it)
      const nn = V3(-perch.dir.z, 0, perch.dir.x), off = (ph) => V.info.headPos.clone().applyMatrix4(R.headMatrixFor(R.fore({ len: st.len, phi: ph, lift, coil: 0 }))).sub(perch.a).dot(nn);
      for (let k = 0; k < 5; k++) { const e = off(phi); if (Math.abs(e) < F.w0 * 0.2) break; const de = (off(phi + 0.02) - e) / 0.02; if (Math.abs(de) < 1e-6) break; phi -= clamp(e / de, -0.5, 0.5); }
    }
    const ext = R.fore({ len: st.len, phi, lift, coil: 0, base: B }), coil = R.fore({ len: st.len, phi, lift: lift * 0.7, coil: 1, base: B }), rest = R.rest();
    const Bc = B.c;
    // the prey, held: its front at body position xp (x > 0 inside the mouth), its head pointing down the throat
    let held = false, xp = xp0, worldM = null, preyHide = false;
    // v5.05: while it is held and swallowed, the prey's girth is squeezed to fit inside the open mouth and the stretched
    // neck (nothing pokes out through the skin), and its whiskers are tucked away
    const whisk = []; prey.traverse((o) => { if (o.isLineSegments) whisk.push(o); });
    // v5.68: the prey only ever shows between the open jaws: it is cut off by a plane across the throat, just in front of
    // the corners of the mouth, so nothing of it can come through the neck or the body wall (the meal is the lump instead);
    // while held it lies along the head's own axis, so it goes in through the mouth, head first
    const xClip = mo.headX * 0.97, clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6); // (far away: nothing cut until it is held)
    prey.traverse((o) => { if (!o.material) return; for (const m of [].concat(o.material)) { m.clippingPlanes = [clip]; m.clipShadows = true; if (o.isMesh) m.side = THREE.DoubleSide; } });
    const unclip = () => { clip.normal.set(0, 1, 0); clip.constant = 1e6; };
    const fitScale = () => {
      let sc = 1; const xh = mo.headX;
      for (let k = 0; k <= 16; k++) {
        const u = -1 + k / 8, x = xp - Lp / 2 + (u * Lp) / 2; if (x <= Hl * 0.05 || x > xClip) continue; // (behind the cut nothing shows)
        const prof = prR * Math.sqrt(Math.max(0, 1 - u * u)); if (prof < prR * 0.05) continue;
        const i = clamp(Math.round(x / R.dx), 0, R.N - 1), cap = rB(x) * Math.max(1, R.bul[i]) * (x < xh ? lerp(1.7, 1.05, x / xh) * (1 + (mo.spread || 0)) : 1) * 0.92;
        sc = Math.min(sc, cap / prof);
      }
      return clamp(sc, 0.45, 1);
    };
    let levT = null;
    const placeHeld = () => {
      const xc = xp - Lp / 2, xa = Hl * 0.5, f = R.frameAtX(xa); f.c.addScaledVector(f.T, xc - xa); // along the head's own axis
      const m = new THREE.Matrix4().makeBasis(f.S.clone().negate(), f.U, f.T); prey.quaternion.setFromRotationMatrix(m); prey.position.copy(f.c);
      if (perch) { // v5.78: up in a tree the prey is held level, on top of its branch - never pushed down into the wood (out of sight)
        const top = onPerch(f.c).y + (prey.userData.y || prR) * 0.85;
        if (prey.position.y < top - prR * 0.6) { const Tf = V3(f.T.x, f.T.y * 0.15, f.T.z).normalize(), Uf = V3(0, 1, 0).addScaledVector(Tf, -Tf.y).normalize(), Sf = Tf.clone().cross(Uf); prey.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(Sf.negate(), Uf, Tf)); prey.position.copy(R.point(0)).addScaledVector(Tf, xc); prey.position.y = Math.max(top, R.point(0).y); levT = Tf; } // (straight out in front of the snout)
      }
      const sc = fitScale(); prey.scale.set(sc, sc, 1); whisk.forEach((w) => { w.visible = false; });
      const g = R.frameAtX(xClip); clip.normal.copy(levT || g.T).negate(); clip.constant = -clip.normal.dot(g.c); levT = null; // keep only what is in front of the throat (held level: cut square across)
    };
    // where the prey will sit when the strike lands: hold it there now (computed with the reaching pose)
    R.setPose(ext); R.apply(); placeHeld(); prey.updateMatrixWorld(true); worldM = prey.matrix.clone();
    // constrictors lift the prey a little in their coils: the coils go round the prey's own long axis
    // v6.13 (Eduardo: "he eats while wrapped his whole body on the prey not a bit"; tools/eating-behaviour.md): several
    // full coils, not one or two loops - laid side by side from just past the snout to the prey's hips (a small prey is
    // buried in three layers of them, the second going back over the first), as much of the body as the snake can spare
    const Wc = Math.max(F.W(L * 0.3), F.Hh(L * 0.3)) * 1.0;
    const pitch = 2.12 * Wc, rr0 = prR * 0.92 + Wc * 1.02, layW = 2.1 * Wc;
    let cz0 = 0, cSpan = 0, cTpl = 0, cL = 1;
    if (constrict) {
      cz0 = -Lp / 2 + Hl * 0.22 + Wc * 1.25; // the first coil just in front of the snout
      let ze = longPrey ? cz0 + Math.min(Lp * 0.6, Math.max(pitch * 3.2, Lp * 0.3)) : Lp / 2 - Wc * 0.15;
      if (ze - cz0 < pitch * 1.05) ze = cz0 + pitch * 1.05;
      cSpan = ze - cz0; cTpl = cSpan / pitch;
      const turnLen = (r) => Math.hypot(TAU * r, pitch), spare = (R.S3[R.N - 1] - R.S3[R.ih]) - (Hl * 1.6 + rr0) * 2 - L * 0.16; // (the neck's U-turn, and some tail left on the ground)
      const lenOf = (n, tpl) => { let s = 0; for (let j = 0; j < n; j++) s += tpl * turnLen(rr0 + j * layW); return s; };
      // (v6.13: two layers when one is not two and a half turns - a mouse in a corn snake's coils - three round a very short prey)
      if (cTpl < 1.3 && lenOf(3, cTpl) <= spare) cL = 3;
      else if (cTpl < 2.5 && lenOf(2, cTpl) <= spare) cL = 2;
      else if (cTpl < 2.5) { cTpl = clamp(spare / turnLen(rr0), cTpl, 2.5); cSpan = cTpl * pitch; } // (a stout snake: one layer, as many turns as its body allows - over the prey's hips and tail too)
      else if (lenOf(1, cTpl) > spare) { cTpl = Math.max(1.05, spare / turnLen(rr0)); cSpan = cTpl * pitch; } // (a short snake round a long meal: what it can)
      if (cL === 1 && cTpl > 3.6) { cTpl = 3.6; cSpan = cTpl * pitch; }
    }
    const rOut = rr0 + (cL - 1) * layW;
    const liftC = constrict ? Math.max(0, rOut + Wc * 1.8 - prR * 0.95) : 0; // (room for the eased-off coils too)
    let extHi = null, wrapP = null, wrapL = null, wrapLs = null, coilI1 = 0;
    const wrapAt = (e) => { const f = clamp(e, 0, 1) * 6, k = Math.min(5, Math.floor(f)); return R.blend(wrapLs[k], wrapLs[k + 1], f - k); }; // (the coils eased off by e, 0..1)
    if (constrict) {
      extHi = R.fore({ len: st.len, phi, lift: lift + liftC, coil: 0, base: B });
      R.setPose(extHi); R.apply(); placeHeld(); prey.updateMatrixWorld(true);
      const C = prey.position.clone(), ax = R.frameAtX(Hl * 0.5).T.clone().negate(); // (from the mouth out along the prey)
      ax.y = 0; ax.normalize();
      const up = V3(0, 1, 0), sd = st.perp.clone().sub(ax.clone().multiplyScalar(st.perp.dot(ax))).normalize();
      // f runs 0..cL (one unit per layer): along the prey and back, the corners rounded over a fifth of a turn while the
      // coil steps out onto the next layer
      const cc = Math.min(0.45, 0.22 / cTpl);
      let loose = 0; // (v6.13: how much looser than the squeeze: the coils ease off while it swallows)
      const zN = (f) => { const k = Math.round(f); if (k > 0 && k < cL && Math.abs(f - k) < cc) { const d = f - k, r = (d * d + cc * cc) / (2 * cc); return k % 2 ? 1 - r : r; } const fl = Math.min(Math.floor(f), cL - 1), fr = f - fl; return fl % 2 ? 1 - fr : fr; };
      const rAt = (f) => { let r = rr0 + loose; for (let k = 1; k < cL; k++) r += layW * sstep(k - cc, k + cc, f); return r; };
      const hel = (f) => { const th = TAU * cTpl * f, r = rAt(f); return C.clone().addScaledVector(ax, cz0 + cSpan * zN(f)).addScaledVector(sd, r * Math.cos(th)).addScaledVector(up, r * Math.sin(th)); };
      const hTan = (f) => { const e = 1e-3; return hel(Math.min(cL, f + e)).sub(hel(Math.max(0, f - e))).normalize(); };
      const P0 = V3(extHi[R.ih * 3], extHi[R.ih * 3 + 1], extHi[R.ih * 3 + 2]), T0w = V3(extHi[R.ih * 3 + 3] - P0.x, extHi[R.ih * 3 + 4] - P0.y, extHi[R.ih * 3 + 5] - P0.z).normalize();
      const mk = () => {
        const poly = [P0.clone()];
        const herm3 = (A, tA, Bq, tB, m, n) => { for (let k = 1; k <= n; k++) { const t = k / n, h00 = 2 * t * t * t - 3 * t * t + 1, h10 = t * t * t - 2 * t * t + t, h01 = -2 * t * t * t + 3 * t * t, h11 = t * t * t - t * t; poly.push(A.clone().multiplyScalar(h00).addScaledVector(tA, h10 * m).addScaledVector(Bq, h01).addScaledVector(tB, h11 * m)); } };
        const Hs = hel(0); herm3(P0, T0w, Hs, hTan(0), P0.distanceTo(Hs) * 1.6 + Wc * 2, 60); // a U-turn behind the head, past its side, to the prey
        const nT = Math.round(cL * cTpl * 160); for (let k = 1; k <= nT; k++) poly.push(hel((cL * k) / nT)); // the coils
        // down to the ground beyond the coils: behind the prey, or (an even number of layers ends at the front) on the side away from the neck
        const back = cL % 2 === 1, He = hel(cL), gC = support(gQ != null ? gQ : 0), zEnd = cz0 + cSpan * zN(cL), G = C.clone().addScaledVector(ax, zEnd + (longPrey ? Wc * 1.5 : back ? Wc * 5 : -Wc * 3)).addScaledVector(sd, back ? rOut + Wc * (longPrey ? 7 : 4) : -(rOut + Wc * 5)); G.y = gC + Hm; // (a long prey - a snake - lies on beyond the coils: the body leaves them sideways, clear of it)
        const tG = back ? ax.clone().addScaledVector(sd, longPrey ? 2.5 : 0.6).normalize() : sd.clone().negate().addScaledVector(ax, 0.5).normalize(); herm3(He, hTan(cL), G, tG, He.distanceTo(G) * 1.3, 60); // down to the ground
        { let p = G.clone(), d = tG.clone(); const k0 = 1 / Math.max(L * 0.3, Wc * 20), step = R.dx; for (let k = 0; k < N * 2; k++) { d.applyAxisAngle(up, k0 * step * (k < N * 0.6 ? 1 : -0.6)); p = p.clone().addScaledVector(d, step); p.y = gC + Hm; poly.push(p); } } // the rest of the body trails away on the ground
        // sample it by arc length (no stretching): the head and neck stay as in the lifted reach
        const pose = extHi.slice(); let k = 0, acc = 0;
        for (let i = R.ih + 1; i < N; i++) {
          const want = R.S3[i] - R.S3[R.ih];
          while (k < poly.length - 2 && acc + poly[k].distanceTo(poly[k + 1]) < want) { acc += poly[k].distanceTo(poly[k + 1]); k++; }
          const seg = Math.max(1e-9, poly[k].distanceTo(poly[k + 1])), w = clamp((want - acc) / seg, 0, 1), q = poly[k].clone().lerp(poly[k + 1], w);
          pose[i * 3] = q.x; pose[i * 3 + 1] = q.y; pose[i * 3 + 2] = q.z;
        }
        { let acc2 = 0; for (let q = 0; q < 61 + nT && q < poly.length - 1; q++) acc2 += poly[q].distanceTo(poly[q + 1]); return [pose, Math.min(N - 1, R.ih + Math.round(acc2 / R.dx))]; }
      };
      [wrapP, coilI1] = mk(); wrapLs = [wrapP]; for (let k = 1; k <= 6; k++) { loose = (Wc * 0.7 * k) / 6; wrapLs.push(mk()[0]); } wrapL = wrapLs[6]; // (wrapL: the same coils, eased off; in steps, so easing off never cuts a chord across the coils through the prey)
      R.setPose(ext); R.apply(); // (back to where the prey lies before the strike)
    }
    R.setPose(B === R.REST ? rest : Bc); R.apply();
    const Aext = R.ang3(ext), Awrap = wrapP ? R.ang3(wrapP) : null, AwrapL = wrapL ? R.ang3(wrapL) : null, AextHi = extHi ? R.ang3(extHi) : null;
    // lay it on the ground (its belly on the ground or the branch), or in the water
    const preyGround = () => (perch ? null : inWater ? (kind === 'fish' ? waterY - prR * 0.45 : waterY - prR * 0.55) : gQ);
    const lay = () => {
      unclip(); prey.matrix.copy(worldM); prey.matrix.decompose(prey.position, prey.quaternion, prey.scale); prey.scale.set(1, 1, 1);
      if (perch) { const q = onPerch(prey.position); prey.position.set(q.x, q.y + (prey.userData.y || prR * 0.95), q.z); }
      else { const gy = preyGround(); prey.position.y = inWater ? gy : Math.max(prey.position.y, gy + (prey.userData.y || prR * (kind === 'egg' ? 1.0 : 0.95))); }
      whisk.forEach((w) => { w.visible = true; });
    };
    lay(); const layPos = prey.position.clone(), layQ = prey.quaternion.clone();
    const worldY = new THREE.Vector3().setFromMatrixPosition(worldM).y;
    const rolled = (a) => { // let go: the prey rolls onto its side (a = 1) - a dead fish floats - or is picked up again (a = 0)
      unclip(); prey.matrix.copy(worldM); prey.matrix.decompose(prey.position, prey.quaternion, prey.scale); prey.scale.set(1, 1, 1);
      const gy = perch ? onPerch(prey.position).y : preyGround();
      prey.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(R.frameAtX(0).T, 1.3 * a)); prey.position.y = lerp(worldY, gy + prR * (inWater ? 0.15 : 0.7), a); whisk.forEach((w) => { w.visible = a > 0.5; });
    };
    // before it is caught the prey is alive: a fish circles slowly and wags its tail, a frog bobs, a mouse sniffs
    const pAnim = prey.userData.anim; let heldAt = -1, lastS = 0, lifeK = 1;
    const alivePrey = (s, k) => { // k: 1 = free, 0 = exactly where the strike will land
      prey.position.copy(layPos); prey.quaternion.copy(layQ); if (pAnim) pAnim(s, 1);
      if (kind === 'fish' && inWater) { const a = s * 0.9; prey.position.x += Math.cos(a) * prR * 5 * k - prR * 5 * k; prey.position.z += Math.sin(a) * prR * 5 * k; prey.position.y += Math.sin(s * 1.7) * prR * 0.2 * k; prey.rotateY(Math.sin(s * 9) * 0.18 + k * 0.25 * Math.sin(a)); }
      else if (kind === 'frog') { prey.position.y += (inWater ? Math.sin(s * 2.2) * prR * 0.12 : 0) * k; prey.rotateY(Math.sin(s * 0.7) * 0.15 * k); }
      else if (kind === 'mouse' || kind === 'rat' || kind === 'bird') prey.rotateY(Math.sin(s * 3.1) * 0.12 * k + Math.sin(s * 11) * 0.03 * k);
      else if (kind === 'lizard') prey.rotateY(Math.sin(s * 0.9) * 0.1 * k);
      if (inWater && s - (alivePrey.lt || 0) > 1.1 * (0.5 + k)) { alivePrey.lt = s; if (NAT.ripple) NAT.ripple(prey.position.x, prey.position.z, 0.5, prR * 1.2); }
    };
    markFade(prey); fadeTree(prey, 0);
    if (perch && V.occ) { const pp = prey.position.clone(), hp0 = V.info.headPos.clone(), rr = Math.max(prR * 9, 0.16); for (const o of V.occ) if (o.leaf && !o.force) { const dd = Math.min(o.c.distanceTo(pp), o.c.distanceTo(hp0), o.c.distanceTo(pp.clone().lerp(hp0, 0.5))); if (dd < rr + o.r) { o.force = true; show.undo = (show.undo || []).concat([() => { o.force = false; }]); } } } // (no leaf near the prey or the head while it hunts)
    if (!travel) { const zone = [[prey.position.x, prey.position.z]]; for (let i = 0; i < R.ih * 6 && i < R.N; i += 6) zone.push([ext[i * 3], ext[i * 3 + 2]]); const undo = clearProps(zone, Math.max(prR * 2.5, F.w0 * 3)); show.undo = (show.undo || []).concat([undo, clearProps(zone, Math.max(prR * 4, F.w0 * 4), { flat: true }), clearGround(zone, Math.max(prR * 6, F.w0 * 7, Hl * 2.6))]); } // (v5.05: no rock or grass in the way)
    // v5.83: where the coils squeeze, the prey's body gives: every point of it inside a coil is pushed back to the coil's
    // surface (a dent round its chest and belly that deepens with each squeeze and springs back when the coils let go)
    let squeezeK = 0, dented = false; const pBG = prey.userData.bodyG; let pBM = null; if (pBG) prey.traverse((o) => { if (o.isMesh && o.geometry === pBG && !pBM) pBM = o; });
    const pBase = pBG && pBG.userData.base, rewrites = kind === 'mouse' || kind === 'rat' || kind === 'lizard', wv = new THREE.Vector3(), cs = [];
    const dentPrey = () => {
      if (!pBM || !wrapP) return;
      const pa = pBG.attributes.position.array;
      if (!rewrites && pBase) pa.set(pBase);
      if (squeezeK <= 0.001) { if (dented) { dented = false; if (!rewrites && pBase) pa.set(pBase); pBG.attributes.position.needsUpdate = true; pBG.computeVertexNormals(); } return; }
      prey.updateMatrixWorld(true); const M = pBM.matrixWorld, Mi = M.clone().invert();
      cs.length = 0; for (let i = R.ih + 10; i <= coilI1; i += 4) { const x = i * R.dx, c = R.frameAtX(x).c; cs.push(c.x, c.y, c.z, rB(x) * Math.max(1, R.bul[i]) * (0.96 + 0.08 * squeezeK)); }
      let any = false;
      for (let v = 0; v < pa.length; v += 3) {
        wv.set(pa[v], pa[v + 1], pa[v + 2]).applyMatrix4(M); let best = 0, bx = 0, by = 0, bz = 0;
        for (let q = 0; q < cs.length; q += 4) { const dx = wv.x - cs[q], dy = wv.y - cs[q + 1], dz = wv.z - cs[q + 2], d2 = dx * dx + dy * dy + dz * dz, rr = cs[q + 3]; if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-6, pen = rr - d; if (pen > best) { best = pen; bx = dx / d; by = dy / d; bz = dz / d; } } }
        if (best > 0) { const k = Math.min(best, prR * 0.35) * squeezeK; wv.x += bx * k; wv.y += by * k; wv.z += bz * k; wv.applyMatrix4(Mi); pa[v] = wv.x; pa[v + 1] = wv.y; pa[v + 2] = wv.z; any = true; }
      }
      if (any || dented) { pBG.attributes.position.needsUpdate = true; pBG.computeVertexNormals(); }
      dented = any;
    };
    const sq = (k) => { if (!wrapP) return; const i0 = R.ih + 20, i1 = coilI1; for (let i = 0; i < R.N; i++) R.bul[i] = i >= i0 && i <= i1 ? 1 + k * 0.06 * sstep(i0, i0 + 14, i) * (1 - sstep(i1 - 14, i1, i)) : 1; };
    // v5.68: a modest, realistic lump - never a balloon: at most about 1.3-1.5 times the body's width (by prey), easing
    // into that limit (a big rat in a ball python shows as a firm swelling, the skin stretched between the scales)
    const CAP = { rat: 1.45, mouse: 1.4, bird: 1.42, egg: 1.5, frog: 1.36, fish: 1.3, lizard: 1.25, snake: 1.1, centipede: 1.08, worm: 1.08, caterpillar: 1.1, slug: 1.15 }[kind] || 1.35, cap1 = CAP - 1;
    const minLump = longPrey ? 0.04 : kind === "fish" || kind === "lizard" ? 0.1 : 0.16;
    const bodyLp = longPrey ? Lp : Lp * (kind === 'mouse' || kind === 'rat' ? 0.62 : 0.85); // (a tail or a bird's tail feathers make no lump)
    const bulgeAt = (xFront, extra) => { // the swelling where the prey is inside the body
      for (let i = 0; i < R.N; i++) {
        const x = i * R.dx, u = (x - (xFront - bodyLp / 2)) / (bodyLp / 2); let k = 1;
        if (Math.abs(u) < 1) { const sh = Math.pow(1 - u * u, 0.6), need = prR * sh * 1.05 / Math.max(1e-6, rB(x)); k = need > 1 ? 1 + cap1 * Math.tanh((need - 1) / cap1) : 1; k = Math.max(k, 1 + minLump * sh); /* (always a visible lump, even in a stout python) */ k = lerp(1, k, sstep(Hl * 1.0, Hl * 1.7, x)); } // v5.12: the head itself never swells (it used to swallow its own eyes)
        R.bul[i] = Math.max(1, lerp(1, k, extra));
      }
    };
    const xIn = Hl * 1.15 + Lp, xEnd = Math.max(xIn + Lp * 0.2, L * 0.45);
    // the camera: from the side away from the body, a little behind the head, looking at what matters in each step
    const camSide = (tg, d, el = 0.38, back = 0.25) => { const dir = st.perp.clone().addScaledVector(st.D, -back).normalize(); return { tgt: tg, pos: tg.clone().addScaledVector(dir, d * Math.cos(el)).add(V3(0, d * Math.sin(el), 0)) }; };
    const fitD = (sz) => sz / Math.tan(V.info.vf) * 0.62, wideD = fitD(Math.max(st.len * 1.25, Lp * 2.4));
    const headPt = () => R.point(Hl * 0.5);
    const preyPt = () => prey.position.clone();
    // (v6.20: framed close enough that the prey - a mouse is 2-3 cm - is plainly seen beside the head, not a speck in a
    // wide view of the whole floor)
    const near2 = (a, b) => fitD(Math.max(a.distanceTo(b) * 1.35, Lp * 6, Hl * 7));
    let camKey = camSide(prey.position.clone().lerp(V.info.headPos, 0.45), near2(prey.position, V.info.headPos), 0.72, 0.05);
    const nm = prey.userData.name;
    const T = {
      intro: { egg: 'Egg-eaters find <b>birds\' eggs</b> by smell.', fish: 'It hunts <b>' + nm + '</b>.', frog: 'It hunts <b>' + nm + '</b>, found by smell with its tongue.', snake: 'It hunts <b>' + nm + '</b> - some snakes eat other snakes!', lizard: 'It hunts <b>' + nm + '</b>.', bird: 'It hunts <b>' + nm + '</b>.', centipede: 'It hunts <b>' + nm + '</b> - small snakes like this one eat centipedes, scorpions and spiders.', worm: 'It finds <b>' + nm + '</b> by smell in damp soil.', slug: 'It finds <b>' + nm + '</b> by following its slime trail.', caterpillar: 'It hunts <b>' + nm + '</b> and other insects in the leaves.', mouse: 'It hunts <b>' + nm + '</b>, tracked by smell with its flicking tongue.', rat: 'It hunts <b>' + nm + '</b>, tracked by smell with its flicking tongue.' }[kind],
      stalk: inWater ? (sea ? 'It <b>swims</b> up to it:' : 'It slides into the water and <b>swims</b> towards it:') + ' waves run down its body and push against the water.' : 'It <b>creeps up</b> slowly, flicking its tongue to keep track of the scent.',
      aim: 'The <b>strike pose</b>: the neck pulled back into an S, the head level and aimed.',
      strike: 'Strike! Faster than you can blink, the mouth opening wide as it lands.',
      inject: '<b>Venom</b> flows through the fangs into the prey.',
      release: (plan === 'viper' || plan === 'pitviper' ? 'Vipers' : 'It') + ' <b>let' + (plan === 'viper' || plan === 'pitviper' ? '' : 's') + ' go</b> straight away, so the prey cannot bite back, and wait' + (plan === 'viper' || plan === 'pitviper' ? '' : 's') + ' for the venom to work.',
      track: 'Then it follows the scent trail with its tongue and finds the prey.',
      coil: '<b>Constricting:</b> it throws coils round the prey and squeezes a little tighter each time the prey breathes out, until its heart stops.',
      findHead: 'Still in its coils, it eases its bite and checks with its tongue for the prey\'s <b>head</b>: it swallows it head first, the coils loosening as it goes.',
      loosen: 'It loosens its coils and checks with its tongue for the prey\'s <b>head</b>, to swallow it head first.',
      swallow: kind === 'egg' ? 'Its jaws stretch round an egg much wider than its head - it has almost no teeth.' : '<b>Jaw walking:</b> the left and right jaws move forward in turn, pulling the prey in head-first. The windpipe pokes out so it can still breathe.',
      down: kind === 'egg' ? 'Spikes on its backbone crack the shell inside its throat; it swallows the egg and spits out the shell.' : 'Muscles push the meal down to the <b>stomach</b>. The skin between the scales stretches - you can see the bulge.',
      digest: 'Digesting a big meal can take days to weeks. Then it is hungry again.',
      yawn: 'It <b>"yawns"</b>: a wide gape, the lower jaws shifting side to side, settles its stretched jaws back in place.',
      grip: 'It works its jaws along until it holds the prey by the <b>head</b>, tongue flicking to check, then starts to swallow.',
      seize: 'It <b>seizes</b> it - slow prey like this needs no strike.',
    };
    // tongue flicks: two or three quick ones, now and then
    const flicks = (s, every = 1.6, n = 2) => { const d = Math.min(0.5 + 0.3 * n, every * 0.8), ph = (s % every) / d; return ph < 1 ? ph : 0; }; // (v5.93: one smooth flick, longer for n > 1)
    let ripT = 0, ripI = 0;
    const wake = (s) => { // ripples where the head and the body move through the water
      if (!wet || !NAT.ripple || s - ripT < 0.22) return; ripT = s; ripI++;
      const x = ripI % 3 === 0 ? L * (0.25 + 0.2 * ((ripI / 3) % 3)) : Hl * 0.6, p = R.point(x), g = yAt([[p.x, p.z]])[0];
      if (sea || g < waterY - F.Hh(x) * 0.3) NAT.ripple(p.x, p.z, ripI % 3 === 0 ? 0.7 : 1, Math.max(F.w0 * 1.6, 0.01));
    };
    const phases = [];
    // 1. notice
    phases.push([1.6, (u, s) => { fadeTree(prey, ease(u * 1.6)); alivePrey(s, 1); R.setPose(R.blend(rest, N1, ease(u))); R.apply(); say(T.intro); flick(flicks(s, 0.8, 2)); }]);
    // 2. approach (stalk, or swim)
    if (travel) {
      const dist = sh1 - sh0, spd = (inWater ? 0.24 : 0.13) * L, dA = clamp(dist / spd, 1.6, inWater ? 5 : 4.2);
      phases.push([dA, (u, s) => {
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, sh = lerp(sh0, sh1, lerp(u, e, 0.6)); // (a smooth start, then a steady glide)
        const fp = fol(sh), c = strikes ? sstep(0.62, 1, u) : 0; let pose = fp;
        if (c > 0) { const Bt = R.baseOf(fp, B.fl), cp = R.fore({ len: st.len, phi, lift: lift * 0.7, coil: 1, base: Bt }); pose = R.blend(fp, cp, ease(c)); }
        R.setPose(pose); R.apply(); alivePrey(s, 1 - sstep(0.5, 1, u)); say(T.stalk); flick(flicks(s, 1.3, 2)); wake(s);
        const h = R.point(Hl * 0.5); camKey = camSide(h.clone().lerp(preyPt(), 0.5), near2(h, preyPt()), 0.72, 0.05);
      }]);
    }
    if (!travel) { N1 = R.blend(rest, strikes ? coil : ext, 0.35); if (strikes) phases.push([0.9, (u, s) => { R.setPose(R.blend(N1, coil, ease(u))); R.apply(); flick(flicks(s, 0.9, 1)); say(T.aim); alivePrey(s, 1 - u); }]); }
    if (strikes) {
      // 3. the S-coil strike pose (a slight tremor of tension)
      phases.push([0.75, (u, s) => { R.setPose(R.fore({ len: st.len, phi, lift: lift * 0.7, coil: 1 + 0.04 * Math.sin(s * 11), base: B })); R.apply(); alivePrey(s, 0); say(T.aim); flick(u < 0.55 ? flicks(u * 0.55, 0.55, 1) : 0); camKey = camSide(headPt().lerp(preyPt(), 0.5), fitD(Math.max(headPt().distanceTo(preyPt()) * 1.6, Lp * 4, Hl * 5)), 0.6, 0.05); }]);
      // 4. strike: ~0.16 s, the mouth opening as it lands
      phases.push([0.16, (u) => { const e = u * u * (3 - 2 * u); R.setPose(R.blend(coil, ext, e)); R.apply(); setMouth(Math.max(0.75, tHold) * sstep(0.25, 0.85, u)); say(T.strike); if (u >= 0.98) held = true; }]);
      phases.push([0.45, (u, s) => {
        held = true; R.setPose(ext); R.apply(); setMouth(tHold); say(T.strike);
        if (u < 0.05 && inWater && NAT.ripple && !phases.splashed) { phases.splashed = true; NAT.ripple(prey.position.x, prey.position.z, 1.6, Math.max(prR * 1.5, 0.012)); NAT.ripple(R.point(Hl).x, R.point(Hl).z, 1.2, Math.max(prR, 0.01)); }
        camKey = camSide(headPt().lerp(preyPt(), 0.35), fitD(Hl * 2.4 + Lp * 1.3), 0.62); void s; // (v6.20: from higher - low down, fallen leaves near the lens filled half the view)
      }]);
      if (envenom && !letGo) phases.push([1.0, (u, s) => { R.setPose(ext); R.apply(); setMouth(tHold + 0.04 * Math.sin(s * 14)); say(T.inject); }]);
      if (letGo) {
        phases.push([0.5, (u, s) => { R.setPose(ext); R.apply(); setMouth(tHold + 0.04 * Math.sin(s * 14)); say(T.inject); }]);
        phases.push([0.6, (u) => { held = false; R.setPose(R.blend(ext, coil, ease(u))); R.apply(); setMouth(tHold * (1 - ease(u))); say(T.release); if (u > 0.5) camKey = camSide(preyPt().lerp(headPt(), 0.5), wideD); }]);
        phases.push([1.6, (u, s) => { R.setPose(coil); R.apply(); rolled(ease(u)); flick(flicks(s, 1.2, 1)); say(T.release); }]);
        phases.push([1.5, (u, s) => { R.setPose(R.blend(coil, ext, ease(u))); R.apply(); setMouth(tHold * ease(u)); say(T.track); rolled(1 - sstep(0.5, 0.97, u)); if (u > 0.97) held = true; const f2 = u / 0.7; flick(f2 < 1 ? f2 : 0); }]); // (picked up smoothly, no jump; flicking its tongue along the trail)
      }
      if (constrict) {
        const camC = () => camSide(preyPt().lerp(headPt(), 0.35), fitD(Math.max(rOut * 7, Wc * 12, Lp * 1.7)), 0.82, 0.1);
        // v6.13 (tools/eating-behaviour.md): 5. the coils are thrown round the prey right as the jaws land - one fast movement
        // (about three quarters of a second), not a slow wrap
        phases.push([0.75, (u, s) => { held = true; const e = sstep(0, 1, u); const pz = R.blend3(ext, Aext, wrapP, Awrap, e, R.ih, e * e); R.setPose(pz); R.apply(); placeHeld(); R.setPose(clearOfPrey(pz)); R.apply(); setMouth(tHold); say(T.coil); camKey = camC(); if (inWater) wake(s); squeezeK = sstep(0.7, 1, u) * 0.35; }]);
        // the squeeze: each time the prey breathes out (about every 0.8 s) the coils take up the slack - a pulse of the muscles,
        // and the grip (the dent in the prey) a step tighter that stays
        phases.push([3.2, (u, s) => { R.setPose(wrapP); const br = u * 4, n = Math.min(3, Math.floor(br)), ph = br - n, pulse = sstep(0, 0.25, ph) * (1 - sstep(0.4, 0.8, ph)); sq(0.35 + 0.65 * pulse); R.apply(); camKey = camC(); say(T.coil); squeezeK = Math.min(1, 0.35 + 0.165 * (n + sstep(0, 0.3, ph))); void s; }]);
        phases.push([0.7, () => { R.setPose(wrapP); sq(0.35); R.apply(); flick(0); say(T.coil); squeezeK = 1; }]); // ...and holds still: its heart has stopped
        // still in its coils, it eases its bite, finds the prey's head with its tongue and takes it head first
        phases.push([1.3, (u, s) => { R.setPose(wrapP); sq(0.3); R.apply(); setMouth(tHold * (1 - 0.3 * Math.sin(Math.PI * u)) + (tNeed - tHold) * sstep(0.6, 1, u) * 0.4); flick(u < 0.75 ? flicks(s, 0.7, 1) : 0); say(T.findHead); squeezeK = 1 - 0.15 * u; camKey = camSide(headPt().lerp(preyPt(), 0.4), fitD(Math.max(rOut * 6, Hl * 3 + Lp * 1.2)), 0.6, 0.1); }]);
      }
      // v6.20: a snake that holds its prey (not a constrictor, and not one that let go and tracked it) still has to find
      // the head before it swallows: it eases its grip and works its jaws along, flicking its tongue
      if (!constrict && !letGo && kind !== 'egg') phases.push([1.2, (u, s) => { held = true; R.setPose(R.fore({ len: st.len, phi, lift, coil: 0, yaw: 0.06 * Math.sin(u * TAU * 2), base: B })); R.apply(); setMouth(tHold * (1 - 0.35 * Math.sin(Math.PI * u)), { walk: Math.sin(u * TAU * 2) * 0.6 * Math.sin(Math.PI * u) }); flick(flicks(s, 0.6, 1)); say(T.grip); camKey = camSide(headPt().lerp(preyPt(), 0.4), fitD(Hl * 2.6 + Lp * 1.3), 0.45); }]);
    } else phases.push([1.2, (u) => { R.setPose(R.blend(travel ? Bc : R.blend(rest, ext, 0.3), ext, ease(u))); R.apply(); say(T.seize); setMouth(ease(u) * tNeed, { spread: spreadNeed * ease(u) }); if (u > 0.95) held = true; }]);
    phases.push([4.6, (u, s) => {
      // jaw walking: the prey goes in in small pulls, one side of the jaw then the other (the head turns a little each way)
      const e = ease(u), pull = e - Math.sin(e * TAU * 6) / (TAU * 6);
      held = true; xp = lerp(xp0, xIn, Math.pow(clamp(pull, 0, 1), 1.45)); /* (v5.78: slower at first, so you see the prey going in between the jaws) */ const yaw = 0.05 * Math.sin(e * TAU * 3) * (1 - sstep(0.85, 1, u));
      // v6.13: a constrictor starts swallowing still in its coils; they let go bit by bit as the jaws walk over the prey
      // (the prey slides forward out of them, so nothing passes through it; they unwind once it is inside)
      if (constrict) R.setPose(wrapAt(sstep(0, 0.5, u))); else R.setPose(R.fore({ len: st.len, phi, lift, coil: 0, yaw, base: B }));
      bulgeAt(xp, 1); R.apply();
      const inside = sstep(0, 0.15, u) * (1 - sstep(0.82, 1, u)); // the jaws spread round the prey and walk over it, one side then the other (the "pterygoid walk")
      setMouth(lerp(tHold, tNeed, Math.sin(Math.min(1, u * 1.2) * Math.PI)), { spread: spreadNeed * inside, walk: Math.sin(e * TAU * 3) * inside * (spreadNeed > 0.05 ? 1 : 0.6) }); say(T.swallow);
      camKey = camSide(headPt().lerp(R.point(xp - Lp * 0.5), 0.3), fitD(Hl * 1.8 + Lp * 1.0), 0.36);
      preyHide = xp - Lp > xClip; // (all of it past the cut)
      if (inWater && s % 1.3 < 0.05) wake(s);
    }]);
    // v6.18: while the coils are thrown, no loop may swing through the prey on its way: any part of the body (past the
    // neck) that would come inside the coils' own radius round the prey's long axis is pushed back out onto it
    const clearOfPrey = (pose) => {
      prey.updateMatrixWorld(true); const e = prey.matrixWorld.elements, ax = V3(e[8], e[9], e[10]).normalize(), c = V3(e[12], e[13], e[14]), hz = Lp / 2, rMin = rr0 * 0.97, p = V3(0, 0, 0), q = V3(0, 0, 0);
      for (let i = R.ih + 8; i < Math.min(N, coilI1 + 40); i++) {
        p.set(pose[i * 3], pose[i * 3 + 1], pose[i * 3 + 2]).sub(c); const z = clamp(p.dot(ax), -hz, hz); q.copy(p).addScaledVector(ax, -z); const d = q.length();
        if (d < rMin && d > 1e-6) { q.multiplyScalar(rMin / d).addScaledVector(ax, z).add(c); pose[i * 3] = q.x; pose[i * 3 + 1] = q.y; pose[i * 3 + 2] = q.z; }
      }
      return pose;
    };
    const settled = travel ? Bc : rest;
    // v6.20 ("go see how a snake eats"; tools/eating-behaviour.md): once the jaws are past the prey, the neck bends from
    // side to side in waves that run back down the body (and bunches up a little, concertina-like) - pushing the meal
    // down; Jackson et al. 2004 saw this in kingsnakes alongside the jaw walk, Moon 2000 in gopher and king snakes.
    // The waves follow the lump, so you see it pushed along.
    const neckWave = (pose, xc, amp) => {
      if (amp <= 1e-6) return pose; const out = pose.slice(), lam = Math.max(Lp * 1.6, Hl * 4), x0 = Hl * 1.3, x1 = xc + Lp * 0.9;
      for (let i = 1; i < N - 1; i++) {
        const x = i * R.dx; if (x < x0 || x > x1) continue;
        const tx = pose[(i + 1) * 3] - pose[(i - 1) * 3], tz = pose[(i + 1) * 3 + 2] - pose[(i - 1) * 3 + 2], tl = Math.hypot(tx, tz) || 1;
        const env = sstep(x0, x0 + Hl * 1.5, x) * (1 - sstep(x1 - Lp * 0.6, x1, x)), w = amp * env * Math.sin((TAU * (x - xc)) / lam);
        out[i * 3] += (-tz / tl) * w; out[i * 3 + 2] += (tx / tl) * w;
      }
      return out;
    };
    let downPose = null;
    phases.push([3.4, (u, s) => {
      xp = lerp(xIn, xEnd, ease(u)); const e1 = constrict ? sstep(0, 0.5, u) : 1, base = constrict ? R.blend3(wrapL, AwrapL, extHi, AextHi, e1, R.ih, e1) : ext; downPose = R.blend(base, settled, ease(constrict ? sstep(0.35, 1, u) : u) * (travel ? 1 : 0.6));
      R.setPose(neckWave(downPose, xp - Lp / 2, Math.max(F.w0 * 1.6, prR * 1.2) * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.7 + 0.3 * Math.sin(s * 5)))); bulgeAt(xp, 1); R.apply(); setMouth(lerp(tHold, 0, ease(u * 2))); say(T.down);
      preyHide = true; flick(0);
      camKey = camSide(R.point(xp - Lp / 2), fitD(Math.max(L * 0.22, Lp * 3.2)), 0.55);
    }]);
    // v6.20: then the "yawn": the mouth opens wide once or twice, the two halves of the lower jaw shifting from side to side,
    // to settle the jaws and their stretched ligaments back in place (and clear the windpipe) - then a few tongue flicks
    if (kind !== 'worm' && kind !== 'slug' && kind !== 'centipede' && kind !== 'caterpillar') phases.push([2.4, (u, s) => {
      if (downPose) R.setPose(downPose); bulgeAt(xEnd, 1); R.apply(); say(T.yawn);
      const y1 = sstep(0.02, 0.16, u) * (1 - sstep(0.44, 0.56, u)), y2 = 0.75 * sstep(0.6, 0.7, u) * (1 - sstep(0.8, 0.92, u)), y = Math.max(y1, y2); // (two gapes, each held a moment)
      setMouth(Math.min(1.05, Math.max(tNeed, 0.85)) * y, { spread: 0.25 * y, walk: Math.sin(u * TAU * 2.5) * y * 0.8 });
      flick(u > 0.88 ? (u - 0.88) / 0.12 : 0); void s;
      { const f = R.frameAtX(Hl * 0.5), side = f.S.clone().setY(0), fw = f.T.clone().setY(0).negate(); if (side.lengthSq() < 1e-10) side.copy(st.perp); side.normalize(); if (fw.lengthSq() > 1e-10) fw.normalize(); if (side.dot(st.perp) < 0) side.negate(); const dir = side.addScaledVector(fw, 0.8).normalize(), d = fitD(Hl * 3.6), tg = headPt(); camKey = { tgt: tg, pos: tg.clone().addScaledVector(dir, d * Math.cos(0.45)).add(V3(0, d * Math.sin(0.45), 0)) }; } // (from the side and a little in front: the gape is seen)
    }]);
    if (travel) { // 6. it crawls (or swims) on, round and back into its resting place, the meal a lump in its body
      const dR = shEnd - sh1, dRet = clamp(dR / (0.38 * L), 3, 6.5);
      phases.push([dRet, (u, s) => {
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, sh = lerp(sh1, shEnd, lerp(u, e, 0.7));
        R.setPose(fol(sh)); bulgeAt(xp, 1 - 0.4 * ease(u)); R.apply(); setMouth(0); say(T.digest); flick(flicks(s, 1.8, 2)); wake(s);
        let cx = 0, cz = 0; for (let i = 0; i < N; i += 24) { const p = R.point(i * R.dx); cx += p.x; cz += p.z; } const nn = Math.ceil(N / 24), c = V3(cx / nn, info.center.y, cz / nn);
        camKey = camSide(c.lerp(info.center, ease(u)), fitD(Math.max(L * 0.5, V.info.Rb * 1.5)), lerp(0.55, 0.6, u));
      }]);
      phases.push([0.8, (u) => { R.setPose(rest); bulgeAt(xp, 0.6 * (1 - ease(u))); R.apply(); say(T.digest); }]);
    } else {
      phases.push([1.8, (u) => { const b = R.blend(extHi || ext, rest, 0.6 + 0.4 * ease(u)); R.setPose(b); bulgeAt(xp, 1 - ease(u) * 0.5); R.apply(); setMouth(0); say(T.digest); camKey = camSide(V.info.center.clone(), fitD(V.info.Rb * 2.2), 0.6); }]);
      phases.push([0.8, (u) => { R.setPose(rest); bulgeAt(xp, 0.5 * (1 - ease(u))); R.apply(); say(T.digest); }]);
    }
    // v5.78: once caught it struggles, less and less (longer in the coils of a constrictor, briefly after a venomous bite)
    const struggle = constrict ? 3.6 : envenom ? 1.4 : 2.2;
    const stepPrey = (s) => {
      if (held && heldAt < 0) heldAt = s;
      if (heldAt >= 0) { lifeK = Math.min(lifeK, 1 - sstep(0, struggle, s - heldAt)); if (pAnim && !preyHide) pAnim(s, lifeK); }
      lastS = s;
      if (held) { placeHeld(); prey.visible = !preyHide; }
      if (constrict && (squeezeK > 0 || dented)) { if (!held || preyHide) squeezeK = 0; dentPrey(); }
      if (!held && prey.matrixAutoUpdate === false) prey.matrixAutoUpdate = true;
    };
    show.dur = total(phases);
    let shown = false;
    let lastI = -1;
    show.step = (s) => { const i0 = lastI; const i = runPhases(phases, s); if (i !== i0) { if (i0 >= 0) flick(0); lastI = i; } /* (a slow frame may skip the end of a flick) */ if (i > 0 && !shown) { shown = true; fadeTree(prey, 1); } stepPrey(s); void lastS; /* fully faded in even if a slow frame skipped the end of the first step */ stepTag.hidden = false; stepTag.textContent = (i + 1) + ' / ' + phases.length; return i; };
    show.cam = () => camKey;
    show.clrR = Math.max(prR * 3, Hl * 1.3, W0 * 3); // (v6.20: the grass between the camera and the action bows down)
    show.diet = kind;
    show.info = { kind, constrict, coils: constrict ? { layers: cL, turns: +(cL * cTpl).toFixed(2) } : null, style, letGo, envenom, travel, wet, inWater, phases: phases.length, mids: (() => { let t = 0; return phases.map(([d]) => { const m = +(t + d * 0.35).toFixed(2); t += d; return m; }); })(), waterY, gQ, Q: Q && [Q.x, Q.z], head: [head0.x, head0.z], prR };
  }

  // ---------------------------------------------------------------- Slither (loops until pressed again)
  // v6.02 (Eduardo: "when you click slither it should start slithering from where it is not spawn in somewhere else and
  // when going back it should slither back to where it was"): the snake follows a trail. The trail starts as the line its
  // body lies along at rest (tail to head), so the first frame is exactly the resting snake; then the head leads off from
  // where it lies and every part of the body follows the path of the head (lateral undulation: the waves are in the
  // path). On the ground it heads out onto a long oval round its resting place (so it stays in view); up in a tree it
  // crawls along its branch and round a side twig that leads back (it never leaves the wood); at sea it swims. Pressed
  // again (or Reset, or another button), it slithers back: it leaves the track where the way home is smoothest, comes
  // up to where its tail lay, heading the way its tail pointed, and crawls on along its own resting line, so it settles
  // into exactly its resting pose - no jump, no snap.
  function slitherTrail() {
    const S = [], X = [], Y = [], Z = [], UX = [], UY = [], UZ = [], all = [S, X, Y, Z, UX, UY, UZ];
    let lo = 0;
    const tr = {
      push(s, x, y, z, ux = 0, uy = 1, uz = 0) { S.push(s); X.push(x); Y.push(y); Z.push(z); UX.push(ux); UY.push(uy); UZ.push(uz); },
      add(x, y, z) { const n = S.length - 1, d = Math.hypot(x - X[n], y - Y[n], z - Z[n]); if (d > 1e-7) tr.push(S[n] + d, x, y, z); },
      get end() { return S[S.length - 1]; },
      idx(s) { let a = lo, b = S.length - 1; if (s <= S[a]) return a; if (s >= S[b]) return Math.max(lo, b - 1); while (b - a > 1) { const m = (a + b) >> 1; if (S[m] <= s) a = m; else b = m; } return a; },
      at(s, o) {
        const i = tr.idx(s), j = Math.min(S.length - 1, i + 1), w = j > i ? clamp((s - S[i]) / Math.max(1e-12, S[j] - S[i]), 0, 1) : 0;
        o[0] = lerp(X[i], X[j], w); o[1] = lerp(Y[i], Y[j], w); o[2] = lerp(Z[i], Z[j], w); o[3] = lerp(UX[i], UX[j], w); o[4] = lerp(UY[i], UY[j], w); o[5] = lerp(UZ[i], UZ[j], w);
        return o;
      },
      dir(s, h, flat) { const a = tr.at(s, [0, 0, 0, 0, 0, 0]), b = tr.at(s - h, [0, 0, 0, 0, 0, 0]), d = V3(a[0] - b[0], flat ? 0 : a[1] - b[1], a[2] - b[2]); return d.lengthSq() > 1e-14 ? d.normalize() : V3(1, 0, 0); },
      trim(s) { while (lo < S.length - 2 && S[lo + 1] < s) lo++; if (lo > 6000) { for (const a of all) a.splice(0, lo); lo = 0; } },
      cut(s) { const o = tr.at(s, [0, 0, 0, 0, 0, 0]), i = tr.idx(s); for (const a of all) a.length = i + 1; if (s - S[i] > 1e-9) tr.push(s, ...o); },
    };
    return tr;
  }
  const hermite = (p0, t0, p1, t1, n) => { const out = []; for (let k = 0; k <= n; k++) { const t = k / n, h00 = 2 * t * t * t - 3 * t * t + 1, h10 = t * t * t - 2 * t * t + t, h01 = -2 * t * t * t + 3 * t * t, h11 = t * t * t - t * t; out.push(p0.clone().multiplyScalar(h00).addScaledVector(t0, h10).addScaledVector(p1, h01).addScaledVector(t1, h11)); } return out; };
  const polyLen = (pts) => { let s = 0; for (let k = 1; k < pts.length; k++) s += pts[k].distanceTo(pts[k - 1]); return s; };
  const angBetween = (a, b) => Math.acos(clamp(a.dot(b) / Math.max(1e-12, a.length() * b.length()), -1, 1));
  function startSlither() {
    const p0 = rig && rig.active && !show && !(anat && anat.on) ? rig.cur() : null; // (whatever it was doing - a turn of the head - it eases out of)
    idleStop(); if (show) stopShow(); if (anat && anat.on) anat.set(false, true); ensureRig(); if (!rig) return;
    const R = rig, info = V.info, F = info.F, L = F.L, N = R.N, Hl = F.Hl, dx = R.dx, S3 = R.S3, Lr = S3[N - 1];
    const stout = !!(P.body && P.body.ld && P.body.ld < 11.5); // only the heaviest (Gaboon viper, puff adders) creep in a straight line
    const circ = info.tree && info.tree.userData.circuit, sea = !!(P.scene && P.scene.kind === 'sea');
    // how far the centre line is above what the belly rests on, and the head held up a little as it goes
    const off = new Float32Array(N), lift = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = i * dx; off[i] = F.Hh(x) * F.bf; lift[i] = circ ? 0 : F.Hh(Hl * 0.6) * 0.55 * (1 - sstep(Hl * 1.5, Hl * 4, x)); }
    // the resting line (what the belly lies on), tail to head, at the body's own spacing: the trail starts as this
    const rf = new Float32Array(N * 3); for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) rf[i * 3 + c] = R.rc[i * 3 + c] - R.rU[i * 3 + c] * off[i];
    const tr = slitherTrail();
    for (let i = N - 1; i >= 0; i--) tr.push(Lr - S3[i], rf[i * 3], rf[i * 3 + 1], rf[i * 3 + 2], R.rU[i * 3], R.rU[i * 3 + 1], R.rU[i * 3 + 2]);
    const H = V3(rf[0], rf[1], rf[2]), kh = Math.min(N - 1, Math.round(R.ih * 1.5)), hd = V3(R.rc[0] - R.rc[kh * 3], circ ? R.rc[1] - R.rc[kh * 3 + 1] : 0, R.rc[2] - R.rc[kh * 3 + 2]).normalize();
    const wMesh = V.scene.children.find((o) => o.isMesh && o.renderOrder === 2 && o.material && o.material.transparent), wY = wMesh ? wMesh.position.y : null;
    const floorAt = (list) => groundYAt(list).map((y) => (wY != null ? Math.max(y, wY) : y)); // (in water it swims at the surface)
    const S = { tr, off, lift, rf, circ, stout, sea, wY, span: 0, h: Lr, h0: Lr, vel: 0, v: (stout ? 0.07 : 0.22) * L * reduceK(), ret: false, t0: now(), tl: now(), pose: new Float32Array(N * 3), o: [0, 0, 0, 0, 0, 0] };
    S.vr = S.v * 2; S.amp = stout || circ ? 0 : L * (sea ? 0.08 : 0.065); S.lam = L * (sea ? 0.6 : 0.52); S.bArc = 0; S.bPrev = null;
    let span = 0; const cpts = [];
    if (circ) {
      // up in its tree: from its head onto the branch just ahead and on along the top of it towards the tip, as far as the
      // branch will carry it; then it backs along the same branch into exactly the place it came from (a snake on a branch
      // has no room to turn round) - and out again, until Slither is pressed again. It never leaves the wood.
      const line = circ.line.map((p) => V3(p[0], p[1], p[2]));
      let e = 0, bd = 1e9; const want = H.clone().addScaledVector(hd, Math.max(L * 0.08, Hl * 2));
      for (let k = 0; k < line.length; k++) { const d = line[k].distanceTo(want); if (d < bd) { bd = d; e = k; } }
      e = Math.min(line.length - 2, e);
      const ld = line[e + 1].clone().sub(line[e]).normalize(), dist = H.distanceTo(line[e]), m = Math.max(dist, L * 0.04) * 1.1;
      const lead = hermite(H, hd.clone().multiplyScalar(m), line[e], ld.multiplyScalar(m), Math.max(6, Math.ceil(dist / (L / 400))));
      S.leadLen = polyLen(lead);
      S.gen = (function* () { for (let k = 1; k < lead.length; k++) yield [lead[k].x, lead[k].y, lead[k].z, 0, 0]; for (let k = e + 1; k < line.length; k++) yield [line[k].x, line[k].y, line[k].z, 0, 0]; })();
      slFeed(S, 1e18, 100000); S.hK = tr.end - L * 0.01; S.ph = 'out'; S.wait = 0; // (the whole way along the branch, from the start)
      for (const p of line) cpts.push(p);
    } else {
      // on the ground (or in water): a long oval round its resting place, turned to face the camera
      const Pm = Math.max(L * 2.35, info.Rb * 4.2), eb = Pm / 9.69, ea = eb * 2;
      const az = V.controls.st.az, rx = Math.cos(az), rz = -Math.sin(az), fx0 = Math.sin(az), fz0 = Math.cos(az), cx = info.center.x, cz = info.center.z, M = 1200;
      const ov = []; for (let k = 0; k < M; k++) { const a = (k / M) * TAU, u = ea * Math.cos(a), v = eb * Math.sin(a); ov.push([cx + rx * u + fx0 * v, cz + rz * u + fz0 * v]); }
      const gy = floorAt(ov.filter((_, k) => k % 3 === 0)), track = ov.map((p, k) => { const g = k / 3, g0 = Math.floor(g) % gy.length, g1 = (g0 + 1) % gy.length; return V3(p[0], lerp(gy[g0], gy[g1], g - Math.floor(g)), p[1]); });
      // where to join it: ahead of the head, the way it is facing, turning as little as possible
      let best = null;
      for (let k = 0; k < M; k += 6) for (const sg of [1, -1]) {
        const E = track[k], tE = track[(k + sg + M) % M].clone().sub(E).setY(0).normalize(), dE = E.clone().sub(H).setY(0), dist = dE.length(); if (dist < L * 0.12) continue;
        const cost = dist / L * 0.5 + angBetween(hd, dE) * 0.9 + angBetween(dE, tE) * 0.7; if (!best || cost < best.cost) best = { cost, k, sg, dist, tE };
      }
      const { k: kE, sg, dist, tE } = best, m = Math.max(dist, L * 0.35) * 1.1;
      const lead = hermite(H, hd.clone().multiplyScalar(m), track[kE], tE.clone().multiplyScalar(m), Math.max(12, Math.ceil(dist * 1.6 / (L / 300))));
      const lg = floorAt(lead.map((p) => [p.x, p.z])), nl = lead.length - 1;
      lead.forEach((p, k) => { p.y = lerp(H.y, lg[k], sstep(0, 0.45, k / nl)); });
      S.leadLen = polyLen(lead); S.lap = polyLen(track.concat([track[0]])); span = Math.max(ea, eb);
      S.gen = (function* () { for (let k = 1; k <= nl; k++) yield [lead[k].x, lead[k].y, lead[k].z, sstep(0.05, 0.7, k / nl), 0]; for (let k = kE + sg; ; k += sg) { const q = track[((k % M) + M) % M]; yield [q.x, q.y, q.z, 1, 0]; } })();
      const pts = ov.filter((_, k) => k % 6 === 0).concat(lead.filter((_, k) => k % 3 === 0).map((p) => [p.x, p.z]));
      S.undo = clearProps(pts, F.w0 * 2.5 + S.amp * 1.2);
    }
    // the camera: far enough back to see the whole snake stretched out, gliding along after it as it goes (stepSlither),
    // and afterwards back to the view you had
    { const st = V.controls.st, g = st.goal || st; S.cam0 = { az: g.az, el: g.el, d: g.d, px: g.px, pz: g.pz };
      if (circ) { const c = info.center; for (const p of cpts) span = Math.max(span, Math.hypot(p.x - c.x, p.z - c.z)); }
      fx.reach = span + F.w0 * 4; // (the camera may follow it that far)
      const need = (L * 0.36 + F.w0 * 4) / Math.tan(Math.min(info.hf, info.vf)) + info.hMax;
      if (need > g.d && !circ) { fx.zoomOut = Math.max(1, need * 1.05 / info.dMax); V.controls.setGoal({ el: Math.max(g.el, 0.62), d: need }); } } // (up in a tree it only goes a little way: the camera stays as it is, following it)
    S.p0 = p0; S.t0 = S.tl = now(); // (the clock starts once the way is worked out: it starts off from exactly where it lies)
    slither = S;
    bSlither.setAttribute('aria-pressed', 'true'); bSlither.textContent = 'Stop slithering';
    tip.hidden = false; tip.textContent = circ ? 'Tree snakes crawl along branches, gripping with their belly scales and bridging the gaps between twigs.' : sea ? 'Sea snakes swim by sending waves down the body; the flat, paddle-shaped tail pushes against the water.' : stout ? 'Heavy snakes often creep in a straight line ("caterpillar" crawling): belly scales grip and push in waves.' : 'It slithers: waves run down the body and push against the ground, so every part follows the path of the head (lateral undulation).';
    V.kick();
  }
  const reduceK = () => (V.reduce() ? 0.5 : 1);
  function steadyHead(pose, R, w = 1) {
    const N = R.N, k0 = Math.min(N - 2, Math.round(R.ih * 2.6)), m = Math.min(N - 1 - k0, Math.round(N * 0.12));
    let ax = pose[k0 * 3] - pose[(k0 + m) * 3], az = pose[k0 * 3 + 2] - pose[(k0 + m) * 3 + 2]; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
    for (let i = k0 - 1; i >= 0; i--) {
      const wi = 0.55 * w * (1 - i / k0), dx0 = pose[i * 3] - pose[i * 3 + 3], dz0 = pose[i * 3 + 2] - pose[i * 3 + 5], h = Math.hypot(dx0, dz0) || 1e-9;
      let dx = lerp(dx0 / h, ax, wi), dz = lerp(dz0 / h, az, wi); const l2 = Math.hypot(dx, dz) || 1; dx /= l2; dz /= l2;
      pose[i * 3] = pose[i * 3 + 3] + dx * h; pose[i * 3 + 2] = pose[i * 3 + 5] + dz * h;
    }
    return pose;
  }
  function slFeed(S, upTo, maxN = 6000) { // add the path ahead (base points [x, y, z, waves 0..1]) until the trail reaches upTo
    let n = 0;
    while (S.gen && S.tr.end < upTo && n++ < maxN) {
      const r = S.gen.next(); if (r.done) { S.gen = null; break; }
      const p = r.value; let tx = 1, tz = 0;
      if (S.bPrev) { const d = Math.hypot(p[0] - S.bPrev[0], p[2] - S.bPrev[2]); if (d < 1e-7) continue; S.bArc += d; tx = (p[0] - S.bPrev[0]) / d; tz = (p[2] - S.bPrev[2]) / d; }
      S.bPrev = p; const o = S.amp * p[3] * Math.sin((TAU * S.bArc) / S.lam);
      S.tr.add(p[0] - tz * o, p[1], p[2] + tx * o);
    }
  }
  // the way home (on the ground or in water): from the track, where the way is smoothest, to where its tail lay, then along its resting line
  function slitherHomeRoute(S) {
    const R = rig, F = V.info.F, L = F.L, N = R.N, S3 = R.S3, Lr = S3[N - 1], tr = S.tr, rf = S.rf;
    const Pt = V3(rf[(N - 1) * 3], rf[(N - 1) * 3 + 1], rf[(N - 1) * 3 + 2]), j = Math.max(0, N - 1 - Math.round(N * 0.04));
    const tt = V3(rf[j * 3] - Pt.x, 0, rf[j * 3 + 2] - Pt.z).normalize(); // (the way its tail pointed)
    slFeed(S, S.h + S.lap * 1.05 + L, 40000);
    let best = null;
    for (let s = S.h + L * 0.08; s < S.h + S.lap; s += L * 0.025) {
      const q = tr.at(s, [0, 0, 0, 0, 0, 0]), Q = V3(q[0], 0, q[2]), tq = tr.dir(s, L * 0.02, true), dv = V3(Pt.x - Q.x, 0, Pt.z - Q.z), dist = dv.length();
      if (s + dist * 1.15 < S.h0 + Lr + S.leadLen * 0.6) continue; // (its own tail must have left the resting place first)
      const cost = angBetween(tq, dv) * 0.9 + angBetween(dv, tt) * 0.9 + (s - S.h) / L * 0.55 + Math.max(0, L * 0.35 - dist) / L * 4; // (the sooner the better)
      if (!best || cost < best.cost) best = { cost, s };
    }
    const sQ = best ? best.s : S.h + L * 0.1;
    tr.cut(sQ); S.gen = null;
    const q = tr.at(sQ, [0, 0, 0, 0, 0, 0]), Q = V3(q[0], q[1], q[2]), tq = tr.dir(sQ, L * 0.01, true), dist = Q.distanceTo(Pt), m = Math.max(dist, L * 0.3) * 1.05;
    const con = hermite(Q, tq.clone().multiplyScalar(m), Pt, tt.clone().multiplyScalar(m), Math.max(10, Math.ceil(dist * 1.5 / (L / 300)))), nc = con.length - 1;
    { const g = groundYAt(con.map((p) => [p.x, p.z])); con.forEach((p, k) => { const gk = S.wY != null ? Math.max(g[k], S.wY) : g[k]; p.y = lerp(lerp(Q.y, gk, sstep(0, 0.25, k / nc)), Pt.y, sstep(0.7, 1, k / nc)); }); }
    S.bPrev = null; S.bArc = 0;
    S.gen = (function* () { for (let k = 1; k <= nc; k++) yield [con[k].x, con[k].y, con[k].z, sstep(0, 0.3, k / nc) * (1 - sstep(0.6, 0.92, k / nc)), 0]; })();
    slFeed(S, 1e18, 100000);
    { const u = clearProps(con.filter((_, k) => k % 3 === 0).map((p) => [p.x, p.z]), F.w0 * 2.5 + S.amp * 1.2), u0 = S.undo; S.undo = () => { u(); if (u0) u0(); }; }
    // its resting line again, at exactly its own spacing: arriving, it lies exactly as it lay
    const Se = tr.end; for (let i = N - 2; i >= 0; i--) tr.push(Se + (Lr - S3[i]), rf[i * 3], rf[i * 3 + 1], rf[i * 3 + 2], R.rU[i * 3], R.rU[i * 3 + 1], R.rU[i * 3 + 2]);
    S.target = Se + Lr; S.ret = true; S.retT = now();
  }
  function stepSlither() {
    const S = slither, R = rig, N = R.N, L = R.L, S3 = R.S3, tn = now(), t = (tn - S.t0) / 1000, dt = clamp((tn - S.tl) / 1000, 0, 0.5); S.tl = tn; // (a long hitch moves it on along its path, never off it)
    if (S.circ) { // along the branch and back again (eased at both ends), a pause with a flick of the tongue at the far end
      if (S.ph === 'wait') { S.wait -= dt; S.vel = 0; if (S.wait <= 0) S.ph = S.ret ? 'back' : S.h > S.h0 + 1e-6 ? 'back' : 'out'; }
      else {
        const goal = S.ph === 'out' ? S.hK : S.h0, rem = Math.abs(goal - S.h), vmax = S.ret ? S.vr : S.v, dec = (vmax * vmax) / (2 * Math.max(L * 0.15, Math.min(L * 0.3, Math.abs(S.hK - S.h0) * 0.3)));
        S.vel = Math.min(S.vel + vmax * dt / 0.6, vmax, Math.sqrt(2 * dec * rem) + vmax * 0.04);
        const stepH = Math.min(rem, S.vel * dt); S.h += S.ph === 'out' ? stepH : -stepH;
        if (rem - stepH < 1e-7) { S.h = goal; S.vel = 0; if (S.ph === 'back' && S.ret) { S.h = S.h0; } else { S.wait = S.ret ? 0.25 : S.ph === 'out' ? 1.0 : 0.6; S.ph = 'wait'; } }
      }
    } else if (S.ret) {
      const rem = S.target - S.h, dec = (S.vr * S.vr) / (2 * L * 0.32);
      S.vel = Math.min(S.vel + S.vr * dt / 0.6, S.vr, Math.sqrt(2 * dec * Math.max(0, rem)) + S.vr * 0.04);
      S.h = Math.min(S.target, S.h + S.vel * dt);
    } else {
      const vT = S.v * (S.stout ? 1 : 1 + 0.12 * Math.sin(t * 2.3)); // (each wave gives a gentle surge)
      S.vel = Math.min(vT, S.vel + S.v * dt / 0.8); S.h += S.vel * dt; slFeed(S, S.h + L * 0.6);
    }
    if (!S.circ) S.tr.trim(S.h - S3[N - 1] - L * 0.05); // (up in a tree it backs along the same trail: all of it is kept)
    // the head held up a little and steadier than the body while it travels - none at all as it leaves and arrives
    const kW = S.circ ? sstep(0, L * 0.2, S.h - S.h0) : Math.min(sstep(0, L * 0.3, S.h - S.h0), S.ret ? sstep(0, L * 0.4, S.target - S.h) : 1);
    const pose = S.pose, o = S.o;
    for (let j = 0; j < N; j++) { S.tr.at(S.h - S3[j], o); const k = S.off[j] + S.lift[j] * kW; pose[j * 3] = o[0] + o[3] * k; pose[j * 3 + 1] = o[1] + o[4] * k; pose[j * 3 + 2] = o[2] + o[5] * k; }
    if (kW > 0 && !S.circ) steadyHead(pose, R, kW);
    if (S.p0) { const e = ease(t / 0.6); if (e >= 1) S.p0 = null; else for (let i = 0; i < pose.length; i++) pose[i] = lerp(S.p0[i], pose[i], e); }
    { // the camera glides along after the middle of the body (until you move it yourself)
      let mx = 0, mz = 0, n = 0; for (let j = 0; j < N; j += 24) { mx += pose[j * 3]; mz += pose[j * 3 + 2]; n++; }
      const st = V.controls.st, c = V.info.center, k = 1 - Math.exp(-dt * 1.6), tx = (mx / n - c.x) * kW, tz = (mz / n - c.z) * kW;
      if (!st.dragging) { st.px += (tx - st.px) * k; st.pz += (tz - st.pz) * k; if (st.goal) { st.goal.px = st.px; st.goal.pz = st.pz; } }
    }
    { const ph = S.ret || V.reduce() ? 1 : S.circ ? (S.ph === 'wait' && S.h > S.h0 ? clamp(1 - S.wait / 0.9, 0, 0.999) : 1) : ((t + 0.8) % 2.8) / 0.9; flick(ph < 1 ? ph : 0); } // v5.53: it flicks its tongue now and then as it goes
    if (S.stout) { for (let i = 0; i < N; i++) R.bul[i] = 1 + 0.03 * kW * Math.sin(TAU * (i * R.dx / (R.L * 0.1) - t * 1.4)) * sstep(R.ih, R.ih + 30, i); }
    if (S.ret && (S.circ ? S.ph === 'back' && Math.abs(S.h - S.h0) < 1e-7 : S.target - S.h < 1e-7)) { endSlither(S); return false; } // home: exactly its resting pose
    R.setPose(pose); R.apply();
    // swimming leaves rings on the water behind its head
    if (S.wY != null && V.NATURE && V.NATURE.ripple && t - (S.ripT || 0) > 0.3 && kW > 0.2) { const h = R.point(R.ih * R.dx * 0.6); if (h.y < S.wY + V.info.F.w0 * 3) { S.ripT = t; V.NATURE.ripple(h.x, h.z, 0.9, Math.max(V.info.F.w0 * 1.6, 0.01)); } }
    return true;
  }
  function endSlither(S) {
    slither = null; flick(0); if (rig) { rig.bul.fill(1); rig.release(); } tip.hidden = true; if (S.undo) S.undo();
    bSlither.setAttribute('aria-pressed', 'false'); bSlither.textContent = 'Slither';
    if (fx.zoomOut > 1) fx.zoomOut = 1; fx.reach = 0;
    if (S.cam0 && !S.keepCam) V.controls.setGoal(S.cam0);
    V.kick(); if (S.then) { const f = S.then; S.then = null; f(); }
  }
  // soft: it slithers home (then: what to do once it is back); otherwise it is back at once
  function stopSlither(soft, then) {
    if (!slither) return;
    const S = slither; bSlither.setAttribute('aria-pressed', 'false'); bSlither.textContent = 'Slither';
    if (soft && !V.reduce()) { if (!S.ret) { if (S.circ) { S.ret = true; if (S.ph === 'out') S.hK = Math.min(S.hK, S.h + S.vel * 0.45); else if (S.ph === 'wait') S.wait = Math.min(S.wait, 0.25); } else slitherHomeRoute(S); } if (then) { S.then = then; S.vr = Math.max(S.vr, S.v * 3.2); } V.kick(); return; }
    slither = null; flick(0); if (rig) { rig.bul.fill(1); rig.release(); } tip.hidden = true; if (fx.zoomOut > 1) fx.zoomOut = 1; fx.reach = 0; if (S.undo) S.undo(); if (S.cam0 && !S.keepCam) V.controls.setGoal(S.cam0);
  }
  // something else wants the body while it slithers: it slithers home first (quickly), then that happens
  function deferSlither(fn) { if (!slither || V.reduce()) return false; stopSlither(true, fn); return true; }
  function slitherHome(keepCam) { if (!slither) return false; if (keepCam) slither.keepCam = true; stopSlither(true); return true; }
  function unzoom() { if (fx.zoomOut > 1) { fx.zoomOut = 1; V.controls.setGoal({ d: Math.min(V.controls.st.goal ? V.controls.st.goal.d : V.controls.st.d, V.info.dMax), el: (V.info.portrait ? 40 : 30) * Math.PI / 180 }); } }

  // ================================================================= Anatomy: see-through skin, organs inside, tap to learn
  // v5.05: organs in their real order, sizes and natural colours (as fractions of the snout-vent length, after
  // dissections of vipers, colubrids and pythons): windpipe and gullet from the head, the heart about a quarter of
  // the way along, one long right lung (the left one tiny) ending in an air sac, a long liver, the stomach, gall
  // bladder, pancreas and spleen together just behind it, the small and large intestine, the gonads and the two
  // long kidneys one in front of the other. Many more ribs (one pair per vertebra). The skull, brain and jaw bones
  // move with their jaw when the mouth opens.
  function buildAnatomy() {
    const R = ensureRig(), info = V.info, F = info.F, B = info.body, L = F.L, Hl = F.Hl, mo = V.extras.mouth;
    const tail = (P.body && P.body.tail) || 0.12, svl = L * (1 - tail);
    const rB = (x) => Math.min(F.W(x), F.Hh(x));
    const grp = new THREE.Group(); grp.userData.noRig = true; grp.name = 'anatomy'; V.group.add(grp);
    const parts = [], own = [], toJaw = [];
    const om = (col, o = {}) => new THREE.MeshPhysicalMaterial(Object.assign({ color: col, roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.7 }, o));
    // a tube along the body from x0 to x1: centre offset (s across, u up, both as fractions of the body's half-size), radius r(x)
    const sweep = (x0, x1, fs, fu, fr, n = 64, m = 14, aspect = 1, fa = null) => {
      const pos = [], xs = [], idx = [];
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = lerp(x0, x1, t), c = B.spine(x), f = B.frameAt(x), w = F.W(x), h = F.Hh(x), env = Math.pow(Math.sin(Math.PI * clamp(t, 0.0005, 0.9995)), 0.3);
        const cc = c.clone().addScaledVector(f.S, (typeof fs === 'function' ? fs(x, t) : fs) * w).addScaledVector(f.U, (typeof fu === 'function' ? fu(x, t) : fu) * h), r = fr(x, t) * env;
        for (let j = 0; j <= m; j++) { const a = (j / m) * TAU, ra = fa ? r * fa(a, t, x) : r, p = cc.clone().addScaledVector(f.S, Math.cos(a) * ra * aspect).addScaledVector(f.U, Math.sin(a) * ra); pos.push(p.x, p.y, p.z); xs.push(x); }
      }
      for (let k = 0; k < n; k++) for (let j = 0; j < m; j++) { const a = k * (m + 1) + j, b = a + m + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); } // wound outwards
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
      const uv = g.attributes.uv; for (let k = 0, v = 0; k <= n; k++) for (let j = 0; j <= m; j++, v++) uv.setXY(v, j / m, k / n);
      g.setIndex(idx); g.computeVertexNormals(); g.userData.xs = new Float32Array(xs); return g;
    };
    const blob = (x, s, u, rx, ry, rz, seg = 22) => { // an ellipsoid sitting in the body at x
      const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), f = B.frameAt(x), c = B.spine(x).addScaledVector(f.S, s * F.W(x)).addScaledVector(f.U, u * F.Hh(x));
      g.scale(rz, ry, rx); const m = new THREE.Matrix4().makeBasis(f.S.clone().negate(), f.U, f.T).setPosition(c); g.applyMatrix4(m); g.userData.x = x; return g; // (a right-handed basis, so the faces stay outside)
    };
    const usedM = new Set();
    const add = (key, name, text, region, geo, mat0, opt = {}) => {
      const mat = usedM.has(mat0) ? mat0.clone() : mat0; usedM.add(mat); // (each part its own material, so one can fade while another is picked)
      const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = false; mesh.userData.part = key; mesh.userData.anat = true; grp.add(mesh); own.push(mesh);
      if (opt.detail) mesh.userData.detail = true; // v5.73: shown only when the camera comes close to it
      const xs = geo.userData.xs || new Float32Array(geo.attributes.position.count).fill(geo.userData.x || 0);
      if (opt.jaw) { R.headRig.add(mesh); toJaw.push([mesh, opt.jaw]); } else R.addSkin(geo, xs);
      let p = parts.find((q) => q.key === key); if (!p) { p = { key, name, text, region, meshes: [], x: opt.x != null ? opt.x : xs[xs.length >> 1] }; parts.push(p); } p.meshes.push(mesh); if (opt.detail) p.detail = true;
      return mesh;
    };
    const ringTex = (base, line, rep) => canvasTex(64, (x, s) => { x.fillStyle = base; x.fillRect(0, 0, s, s); x.fillStyle = line; for (let i = 0; i < s; i += 8) x.fillRect(0, i, s, 3); }, 1, rep);
    const C = { bone: '#eee5cf', heart: '#8e1b22', lung: '#e2a19d', sac: '#efe7e2', trachea: '#e9dcc6', gullet: '#d69a8e', liver: '#5c2119', stomach: '#d39488', gall: '#3f6a33', pancreas: '#e8d3a3', spleen: '#782735', small: '#e4bca3', large: '#c79a7d', kidney: '#7b3328', gonad: '#eee0c3', brain: '#e6bfb4', venom: '#efe3b5', jacob: '#d8a2a8', cloaca: '#a9655c', tailM: '#c98b7c' };
    // ---- head: the skull, brain and smell organ go up with the upper jaw, the lower jaw bones down with the lower jaw
    const bone = om(C.bone, { roughness: 0.6, clearcoat: 0.1 });
    const bc = blob(Hl * 0.66, 0, 0.25, Hl * 0.2, F.Hh(Hl * 0.66) * 0.42, F.W(Hl * 0.66) * 0.42);
    add('skull', 'Skull', 'Light, strong bones protect the brain. Many skull bones are only loosely joined, so the mouth can open very wide.', 'head', bc, new THREE.MeshPhysicalMaterial({ color: C.bone, roughness: 0.6, transparent: true, opacity: 0.45, depthWrite: false }), { jaw: 'upper', x: Hl * 0.6 });
    for (const sg of [1, -1]) {
      add('skull', 'Skull', '', 'head', sweep(Hl * 0.06, Hl * 0.72, sg * 0.42, 0.62, (x) => rB(x) * 0.07, 24, 6), bone, { jaw: 'upper', detail: true });                    // nasal and frontal bones
      add('skull', 'Skull', '', 'head', sweep(Hl * 0.08, Hl * 0.8, sg * 0.78, -0.06, (x) => rB(x) * 0.07, 24, 6), bone, { jaw: 'upper', detail: true });                    // upper jaw bones (maxilla)
      add('jaw', 'Lower jaw', 'Two separate halves joined at the chin by stretchy tissue, so each side can move forward on its own ("jaw walking").', 'head', sweep(Hl * 0.05, Hl * 0.8, sg * 0.66, -0.55, (x) => rB(x) * 0.075, 24, 6), bone, { jaw: 'lower', x: Hl * 0.5, detail: true });
      // v5.73: the palate bones (pterygoids), which carry the palate teeth and walk the prey in, and the quadrate, the
      // hinge bone that hangs from the back of the skull and lets the jaw swing down and out round big prey
      add('ptery', 'Palate bones (pterygoids)', 'Two long bones in the roof of the mouth. They carry rows of teeth and move forward and back in turn, "walking" the prey into the throat.', 'head', sweep(Hl * 0.3, (mo ? mo.headX : Hl) * 0.92, sg * 0.3, -0.22, (x) => rB(x) * 0.055, 20, 6), bone, { jaw: 'upper', x: Hl * 0.6, detail: true });
      { const xq = (mo ? mo.headX : Hl) * 0.93, q = []; for (let k = 0; k <= 6; k++) { const t = k / 6, x = xq - Hl * 0.06 + t * Hl * 0.1, f = B.frameAt(x); q.push(B.spine(x).addScaledVector(f.S, sg * F.W(x) * lerp(0.5, 0.74, t)).addScaledVector(f.U, F.Hh(x) * lerp(0.38, -0.5, t))); }
        const g = varTube(q, (t) => rB(xq) * lerp(0.085, 0.06, t), 6, 12); g.userData.x = xq;
        add('quadrate', 'Quadrate bone', 'A loose hinge bone between the skull and the lower jaw. It swings outwards, so the mouth can open far wider than the head.', 'head', g, bone, { jaw: 'upper', x: xq, detail: true }); }
    }
    add('brain', 'Brain', 'Small and long. The parts for smell and for sight are big; snakes rely mostly on smell, taste and feeling vibrations.', 'head', blob(Hl * 0.7, 0, 0.28, Hl * 0.14, F.Hh(Hl * 0.7) * 0.26, F.W(Hl * 0.7) * 0.24), om(C.brain), { jaw: 'upper', detail: true });
    add('jacobson', 'Jacobson\'s organ', 'Two small pits in the roof of the mouth. The forked tongue brings smell particles here, so the snake "tastes" the air.', 'head', mergeG([blob(Hl * 0.14, 0.18, -0.05, Hl * 0.05, F.Hh(Hl * 0.14) * 0.14, F.W(Hl * 0.14) * 0.1), blob(Hl * 0.14, -0.18, -0.05, Hl * 0.05, F.Hh(Hl * 0.14) * 0.14, F.W(Hl * 0.14) * 0.1)]), om(C.jacob), { jaw: 'upper', detail: true });
    if (venomous) add('venom', 'Venom glands', 'Changed saliva glands behind the eyes. Muscles squeeze the venom through a tube into the fangs.', 'head', mergeG([1, -1].map((sg) => blob(Hl * 0.62, sg * 0.6, -0.12, Hl * 0.17, F.Hh(Hl * 0.62) * 0.24, F.W(Hl * 0.62) * 0.2))), om(C.venom), { jaw: 'upper', detail: true });
    // ---- airways, gut and the rest (bend with the body). Behind the jaw hinge, so nothing is left behind when the mouth opens
    const x0 = Math.max(Hl * 1.08, mo ? mo.headX * 1.32 : 0), at = (f) => Math.max(x0, svl * f);
    // v5.57: where the organs lie depends on how the snake lives (as fractions of the snout-vent length, SVL):
    // the heart sits closer to the head in climbing snakes (15-25% of the length), about a quarter to a third of the
    // way along in ground snakes, and nearer the middle in sea snakes (Lillywhite 1987, Am. Zool. 27:81; Gartner et
    // al. 2010, Physiol. Biochem. Zool. 83:43). One long right lung runs from the heart to about mid-body, its
    // air-sac part on towards the vent (much further in sea snakes); the left lung is tiny or missing, except in boas
    // and pythons where it is 50-85% as long as the right (Wallach 1998, The lungs of snakes, Biology of the Reptilia
    // 19). Liver behind the heart, then the stomach, the gall bladder-pancreas-spleen cluster, the intestine, the
    // gonads and the kidneys, the right ones in front of the left (Lillywhite 2014, How Snakes Work).
    const climber = (P.pose && P.pose.kind === 'branch') || /vine ?snake|tree ?snake|bronzeback|boomslang|green mamba|tree ?boa|tree ?python|whip ?snake|flying/i.test(P.name || '');
    const marine = plan === 'sea' || (P.scene && P.scene.kind === 'sea'), aquatic = marine || (P.scene && P.scene.kind === 'riverbank');
    const heartC = marine ? 0.34 : climber ? 0.2 : aquatic ? 0.29 : plan === 'viper' || plan === 'pitviper' ? 0.27 : 0.265;
    const heart0 = svl * (heartC - 0.024), heart1 = svl * (heartC + 0.024);
    const lungEnd = svl * (marine ? 0.62 : plan === 'python' ? 0.55 : 0.5), sacEnd = svl * (marine ? 0.92 : plan === 'python' ? 0.7 : 0.72);
    const liverEnd = svl * Math.max(heartC + 0.2, 0.48), stom0 = liverEnd - svl * 0.005, stom1 = stom0 + svl * 0.105;
    add('trachea', 'Windpipe (trachea)', 'Stiff rings keep it open. Its opening, the glottis, can be pushed out of the side of the mouth so the snake breathes while swallowing big prey.', 'body', sweep(x0, heart0 + svl * 0.01, -0.06, -0.12, (x) => rB(x) * 0.11 * (1 + 0.16 * Math.pow(Math.max(0, Math.cos((x / Math.max(1e-4, rB(x) * 0.22)) * TAU)), 3)), Math.round(clamp((heart0 - x0) / (F.w0 * 0.025), 140, 900)), 10), om(C.trachea, { map: ringTex('#e9dcc6', 'rgba(150,120,100,.3)', 70), roughness: 0.45 }));
    if (plan !== 'python' && plan !== 'blind') add('tlung', 'Tracheal lung', 'Extra breathing tissue along the windpipe in front of the heart, which many snakes have.', 'body', sweep(Math.max(x0 * 1.3, heart0 * 0.45), heart0 * 0.99, -0.08, -0.08, (x) => rB(x) * 0.2, 40, 12), om(C.lung, { transparent: true, opacity: 0.8, roughness: 0.75 }), { detail: true });
    add('oesophagus', 'Gullet (oesophagus)', 'A long, very stretchy tube from the mouth to the stomach. Food is pushed along it by muscles.', 'body', sweep(x0, stom0 + svl * 0.01, 0.1, 0.24, (x) => rB(x) * 0.15, 170, 10), om(C.gullet));
    const hx = (heart0 + heart1) / 2;
    // v5.78: the heart with its shape: a ventricle tapering to a point towards the tail, two atria in front of it, the
    // aortic arches leaving forwards
    const heartGeo = (hx0) => { const hl = (heart1 - heart0) * 0.5, rr = rB(hx0), parts = [];
      // (v5.83: the ventricle a smooth teardrop - broad and round in front, tapering to a blunt apex towards the tail -
      // slightly flattened top to bottom; the atria two plump lobes over its front; the aortic arches tubes)
      const v = new THREE.SphereGeometry(1, 36, 26), pa = v.attributes.position; for (let i = 0; i < pa.count; i++) { const zz = pa.getZ(i), k = zz > 0 ? 1 - 0.42 * zz * zz : 1 - 0.06 * zz * zz; pa.setX(i, pa.getX(i) * k); pa.setY(i, pa.getY(i) * k * 0.86); }
      const fv = B.frameAt(hx0 + hl * 0.2), cv = B.spine(hx0 + hl * 0.2).addScaledVector(fv.U, -0.32 * F.Hh(hx0)); v.scale(rr * 0.31, rr * 0.31, Math.min(hl * 0.7, rr * 0.62)); v.computeVertexNormals(); v.applyMatrix4(new THREE.Matrix4().makeBasis(fv.S.clone().negate(), fv.U, fv.T).setPosition(cv)); v.userData.x = hx0; parts.push(v);
      for (const sg of [1, -1]) { { const xa = hx0 + hl * 0.2 - Math.min(hl * 0.7, rr * 0.62) * 0.85; parts.push(blob(xa, sg * 0.17, -0.12, rr * 0.19, rr * 0.21, rr * 0.17, 22)); } }
      for (const sg of [1, -1]) { const q = []; for (let k = 0; k <= 8; k++) { const t = k / 8, x = hx0 + hl * 0.2 - Math.min(hl * 0.7, rr * 0.62) * (0.9 + t * 0.85), f = B.frameAt(x); q.push(B.spine(x).addScaledVector(f.S, sg * F.W(x) * lerp(0.04, 0.26, t)).addScaledVector(f.U, F.Hh(x) * lerp(-0.2, 0.32, Math.sin(t * Math.PI * 0.5)))); } const g2 = varTube(q, (t) => rr * lerp(0.07, 0.045, t), 8, 16); g2.userData.x = hx0; parts.push(g2); }
      return mergeG(parts); };
    add('heart', 'Heart', (climber ? 'Close to the head in climbing snakes, so blood still reaches the brain when they hold the head up. ' : marine ? 'Nearer the middle of the body in sea snakes. ' : 'About a quarter of the way along the body. ') + 'It has three chambers and can slide a little, so big prey can squeeze past.', 'body', heartGeo(hx), om(C.heart, { roughness: 0.38, clearcoat: 0.6 }));
    const lungTex = canvasTex(256, (x, s2) => { const R2 = rnd(71); x.fillStyle = '#e7aaa4'; x.fillRect(0, 0, s2, s2); const cs = 9;
      for (let yy = 0; yy < s2 + cs; yy += cs * 0.87) for (let xx = ((yy / (cs * 0.87)) % 2) * cs * 0.5; xx < s2 + cs; xx += cs) { x.fillStyle = 'rgba(' + (150 + R2() * 40) + ',' + (60 + R2() * 30) + ',' + (60 + R2() * 25) + ',' + (0.25 + R2() * 0.2) + ')'; x.beginPath(); x.arc(xx, yy, cs * 0.36, 0, TAU); x.fill(); }
      x.strokeStyle = 'rgba(120,30,40,.45)'; for (let i = 0; i < 26; i++) { x.lineWidth = 0.6 + R2() * 1.6; x.beginPath(); let px = R2() * s2, py = R2() * s2; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (R2() - 0.5) * 40; py += (R2() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); } }, 2, 12);
    const lungM = () => om(C.lung, { roughness: 0.62, map: lungTex, bumpMap: lungTex, bumpScale: 0.8, sheen: 0.4, sheenColor: new THREE.Color('#ffd0cc'), clearcoat: 0.5, clearcoatRoughness: 0.3 });
    add('lung', 'Right lung', 'Snakes have one long working lung on the right (the left one is tiny or missing), because their body is so narrow.', 'body', sweep(heart1 * 1.0, lungEnd, -0.2, 0.22, (x, t) => rB(x) * 0.36 * (1 - t * 0.2) * (1 + 0.035 * Math.sin(x / Math.max(1e-4, rB(x) * 0.5))), 120, 16, 1.1, (a) => 1 - 0.12 * Math.max(0, -Math.sin(a))), lungM());
    if (plan === 'python') add('lungL', 'Left lung', 'Boas and pythons still have a good left lung, more than half as long as the right one.', 'body', sweep(heart1 * 1.01, heart1 + (lungEnd - heart1) * 0.62, 0.24, 0.2, (x, t) => rB(x) * 0.26 * (1 - t * 0.25), 80, 14, 1.1), lungM());
    else add('lungL', 'Left lung', 'Tiny in most snakes (and missing in many): there is only room for one big lung.', 'body', sweep(heart1 * 1.01, heart1 + svl * 0.035, 0.26, 0.18, (x) => rB(x) * 0.12, 16, 10), om(C.lung, { roughness: 0.75 }), { detail: true });
    add('airsac', 'Air sac', 'The back part of the lung has no blood vessels: it is a thin bag that stores air, like a balloon.', 'body', sweep(lungEnd - svl * 0.01, sacEnd, -0.12, 0.3, (x, t) => rB(x) * 0.25 * (1 - t * 0.6), 70, 12), new THREE.MeshPhysicalMaterial({ color: C.sac, roughness: 0.25, transparent: true, opacity: 0.42, depthWrite: false, clearcoat: 1 }));
    add('liver', 'Liver', 'Long and thin to fit the body. It cleans the blood and stores energy.', 'body', sweep(heart1 + svl * 0.008, liverEnd, -0.06, -0.3, (x, t) => rB(x) * 0.34 * Math.min(1, 0.55 + t * 1.4) * (1 - 0.3 * t) * (1 - 0.1 * Math.pow(Math.abs(Math.sin(t * 9.5)), 12)), 140, 16, 1.18, (a) => 1 - 0.22 * Math.max(0, -Math.sin(a)) + 0.04 * Math.cos(2 * a)), om(C.liver, { roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.4, map: speckle('#6a2a20', 900, 0.18, 12) }));
    add('stomach', 'Stomach', 'Very stretchy. Strong acid digests the whole prey - even bones.', 'body', sweep(stom0, stom1, 0.04, -0.12, (x, t) => rB(x) * 0.38 * (1 - Math.abs(t - 0.4) * 0.6) * (1 - 0.45 * sstep(0.82, 1, t)), 70, 28, 1, (a, t) => 1 + 0.07 * Math.cos(a * 9 + t * 2) * Math.sin(Math.PI * t)), om(C.stomach, { map: canvasTex(64, (x, s) => { x.fillStyle = '#d6998d'; x.fillRect(0, 0, s, s); x.strokeStyle = 'rgba(140,60,50,.3)'; x.lineWidth = 2; for (let i = 0; i < s; i += 7) { x.beginPath(); x.moveTo(0, i); x.bezierCurveTo(s * 0.3, i + 4, s * 0.6, i - 4, s, i); x.stroke(); } }, 2, 3) }));
    const g0 = Math.max(svl * 0.605, stom1 + svl * 0.006);
    add('gall', 'Gall bladder', 'A small green bag just behind the stomach. It keeps bile, which helps to digest fat.', 'body', blob(g0, -0.18, -0.22, rB(g0) * 0.2, rB(g0) * 0.17, F.W(g0) * 0.15), om(C.gall, { roughness: 0.3, clearcoat: 0.8 }), { detail: true });
    add('pancreas', 'Pancreas', 'Makes juices that digest food and a hormone (insulin) that controls sugar in the blood.', 'body', blob(g0 + rB(g0) * 0.5, 0.05, -0.12, rB(g0) * 0.24, rB(g0) * 0.15, F.W(g0) * 0.17), om(C.pancreas), { detail: true });
    add('spleen', 'Spleen', 'A small dark red organ that helps to fight germs and cleans old blood cells.', 'body', blob(g0 - rB(g0) * 0.2, 0.22, 0.02, rB(g0) * 0.16, rB(g0) * 0.14, F.W(g0) * 0.13), om(C.spleen, { roughness: 0.4 }), { detail: true });
    add('intestine', 'Small intestine', 'Takes the goodness out of the digested food. In snakes it is fairly short and loops gently along the body.', 'body', sweep(Math.max(svl * 0.625, g0 + svl * 0.02), svl * 0.86, (x) => 0.2 * Math.sin((x / svl) * 210), (x) => -0.2 + 0.14 * Math.cos((x / svl) * 210) + 0.04 * Math.sin((x / svl) * 37), (x, t) => rB(x) * 0.17 * (1.12 - 0.2 * t), 420, 10), om(C.small, { roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25, map: speckle('#e0b69c', 700, 0.12, 21) }));
    add('colon', 'Large intestine', 'The last part of the gut. It takes water back out of what is left, then it goes out through the cloaca.', 'body', sweep(svl * 0.855, svl * 0.99, 0, -0.18, (x, t) => rB(x) * 0.19 * (1 - 0.3 * t), 40, 10), om(C.large));
    for (const [sg, a] of [[-1, 0.63], [1, 0.67]]) add('gonads', 'Ovaries or testes', 'The organs that make eggs (females) or sperm (males). One sits a little in front of the other, to fit the long body.', 'body', sweep(svl * a, svl * (a + 0.06), sg * 0.3, 0.3, (x) => rB(x) * 0.13, 24, 10), om(C.gonad), { detail: true });
    for (const [sg, a] of [[-1, 0.78], [1, 0.83]]) add('kidneys', 'Kidneys', 'Long and lobed, one in front of the other. They clean the blood; snakes save water by making a white paste (urates) instead of runny urine.', 'body', sweep(svl * a, svl * (a + 0.085), sg * 0.3, 0.3, (x, t) => rB(x) * 0.15 * (0.78 + 0.22 * Math.pow(Math.abs(Math.cos(t * 22)), 0.6)), 90, 14, 1.2, (an) => 1 - 0.18 * Math.max(0, Math.sin(an))), om(C.kidney, { roughness: 0.4, clearcoat: 0.5 }), { detail: true });
    // ---- backbone and ribs: one pair of ribs on every vertebra from the neck to the vent (none in the tail)
    const ribs = []; const xr0 = Math.max(Hl * 1.3, x0 * 1.08), nRib = Math.round(clamp((svl - xr0) / (F.w0 * 0.2), 110, 220));
    for (let k = 0; k < nRib; k++) {
      const x = lerp(xr0, svl * 0.995, k / (nRib - 1)), f = B.frameAt(x), c = B.spine(x), w = F.W(x), h = F.Hh(x), sp = c.clone().addScaledVector(f.U, h * 0.58);
      for (const sg of [1, -1]) { const pts = [sp.clone()]; for (let j = 0; j <= 6; j++) { const a = 0.2 + (j / 6) * 2.2; pts.push(c.clone().addScaledVector(f.S, sg * Math.sin(a) * w * 0.82).addScaledVector(f.U, Math.cos(a) * h * 0.76).addScaledVector(f.T, (j / 6) * w * 0.22)); } const g = varTube(pts, (t) => rB(x) * 0.028 * (1 - 0.4 * t), 4, 10, false); g.userData.x = x; ribs.push(g); }
    }
    add('ribs', 'Ribs', 'Snakes can have 100 to more than 400 pairs of ribs - one pair on every bone of the backbone! They are not joined underneath, so the body can stretch round a big meal, and they help the snake to crawl and climb.', 'ribs', mergeG(ribs), om(C.bone, { roughness: 0.55, clearcoat: 0.15 }), { x: svl * 0.4 });
    { // v5.83: one bone per vertebra (a spool-shaped body, a ridge on top and short side wings where the ribs join)
      const vs = [], nV = Math.round(clamp((L * 0.995 - Hl * 1.05) / (F.w0 * 0.2), 140, 320)), unit = new THREE.CylinderGeometry(1, 1, 1, 8, 1); unit.rotateX(Math.PI / 2);
      { const pa = unit.attributes.position; for (let i = 0; i < pa.count; i++) { const z = pa.getZ(i), k = 1 - 0.28 * (1 - 4 * z * z); pa.setX(i, pa.getX(i) * k); pa.setY(i, pa.getY(i) * k); } }
      const spineU = new THREE.SphereGeometry(0.5, 8, 6), wing = new THREE.SphereGeometry(0.5, 10, 6); spineU.scale(0.35, 1.4, 0.8); wing.scale(2.6, 0.4, 0.55);
      const mm = new THREE.Matrix4(), sm = new THREE.Matrix4(), tm = new THREE.Matrix4();
      for (let k = 0; k < nV; k++) {
        const x = lerp(Hl * 1.05, L * 0.995, k / (nV - 1)), f = B.frameAt(x), r0 = rB(x), step = (L * 0.995 - Hl * 1.05) / nV, c = B.spine(x).addScaledVector(f.U, F.Hh(x) * 0.58);
        mm.makeBasis(f.S.clone().negate(), f.U, f.T).setPosition(c);
        for (const [geo, sx, sy, sz, oy] of [[unit, r0 * 0.1, r0 * 0.1, step * 0.86, 0], [spineU, r0 * 0.1, r0 * 0.12, step * 0.7, r0 * 0.12], [wing, r0 * 0.1, r0 * 0.1, step * 0.5, r0 * 0.02]]) {
          if (x > svl && geo === wing) continue; // (no ribs, so no rib joints, in the tail)
          const g = geo.clone(); sm.makeScale(sx, sy, sz); tm.makeTranslation(0, oy, 0); g.applyMatrix4(sm).applyMatrix4(tm).applyMatrix4(mm); g.userData.x = x; vs.push(g);
        }
      }
      unit.dispose(); spineU.dispose(); wing.dispose();
      add('spine', 'Backbone (vertebrae)', 'A chain of 100 to more than 400 small bones (vertebrae) from the head to the tip of the tail, joined so the body can bend in every direction.', 'ribs', mergeG(vs), om(C.bone, { roughness: 0.55, clearcoat: 0.15 }), { x: svl * 0.45 });
    }
    // v5.78: the long back muscles either side of the backbone (they bend the body and pull on the ribs), see-through red
    { const mt = canvasTex(64, (x, s2) => { x.fillStyle = '#b4544c'; x.fillRect(0, 0, s2, s2); x.strokeStyle = 'rgba(255,215,200,.35)'; x.lineWidth = 1; for (let i = 0; i < s2; i += 3) { x.beginPath(); x.moveTo(0, i); x.lineTo(s2, i + 6); x.stroke(); } x.fillStyle = 'rgba(240,225,215,.55)'; for (let i = 0; i < s2; i += 16) x.fillRect(0, i, s2, 2); }, 1, 160);
      for (const sg of [1, -1]) add('muscle', 'Back muscles', 'Long bands of muscle along both sides of the backbone, joined to every vertebra and rib. Tightening one side bends the body - that is how a snake crawls, climbs and squeezes.', 'ribs', sweep(Hl * 1.25, L * 0.96, sg * 0.3, 0.38, (x, t) => rB(x) * 0.27 * (1 - t * 0.3), 220, 10, 1.25), om('#b4544c', { map: mt, transparent: true, opacity: 0.6, depthWrite: false, roughness: 0.55, clearcoat: 0.25 }), { x: svl * 0.35 }); }
    // ---- tail
    add('cloaca', 'Cloaca (vent)', 'One opening for droppings, urates, eggs and mating. The tail starts here.', 'tail', blob(svl, 0, -0.5, rB(svl) * 0.45, rB(svl) * 0.2, F.W(svl) * 0.3), om(C.cloaca), { detail: true });
    add('tailp', 'Tail', 'From the vent to the tip. It has backbone but no ribs and no big organs (in males, the mating organs sit inside its base).' + (P.tail && P.tail.rattle ? ' Rattlesnakes add a new rattle segment each time they shed.' : ''), 'tail', sweep(svl * 1.01, L * 0.97, 0, 0.05, (x) => rB(x) * 0.42, 60, 10), om(C.tailM, { transparent: true, opacity: 0.35, depthWrite: false, roughness: 0.6 }));
    // the head parts go with their jaw (their shapes are made with the mouth shut: the jaw group carries them from there,
    // whether the mouth is open or shut right now)
    const jawOf = (k) => { const a = mo && mo.anchors; return a ? (k === 'upper' ? a.teeth && a.teeth.parent : a.glottis && a.glottis.parent) : null; };
    for (const [m, k] of toJaw) { const j = jawOf(k); if (j) { m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1); j.add(m); } }
    // the mouth's own parts (teeth, fangs, glottis, tongue and its sheath), tagged when the mouth was built
    const INFO = {
      fang: ['Fangs', plan === 'viper' || plan === 'pitviper' ? 'Long and hollow, like needles. They fold back against the roof of the mouth when it closes and swing forward to bite.' : 'Short and fixed at the front of the mouth, with a groove or channel that carries the venom.'],
      teeth: ['Teeth', 'Many small teeth that curve backwards to hold prey. Snakes don\'t chew - they swallow food whole. Lost teeth grow back.'],
      palate: ['Palate teeth', 'Two extra rows of teeth on the roof of the mouth. They "walk" the food into the throat.'],
      glottis: ['Glottis', 'The opening of the windpipe on the floor of the mouth. It can be pushed forward so the snake keeps breathing while swallowing.'],
      sheath: ['Tongue sheath', 'A pocket on the floor of the mouth where the forked tongue is kept.'],
      tongue: ['Forked tongue', 'Flicks out to collect smells and brings them to the Jacobson\'s organ. The two tips tell left from right, so it can follow a scent trail.'],
    };
    if (mo && mo.anchors && mo.anchors.teeth && mo.anchors.teeth.parent) {
      mo.anchors.teeth.parent.parent.traverse((o) => {
        const key = o.isMesh && !o.userData.anat && o.userData.mpart; if (!key || !INFO[key]) return;
        let p = parts.find((q) => q.key === key); if (!p) { p = { key, name: INFO[key][0], text: INFO[key][1], region: 'head', meshes: [], x: Hl * 0.3 }; parts.push(p); } p.meshes.push(o); o.userData.part = key;
      });
    }
    (V.extras.eyes || []).forEach((e) => { let p = parts.find((q) => q.key === 'eye'); if (!p) { p = { key: 'eye', name: 'Eye', text: 'No eyelids: a clear scale, the spectacle, covers and protects it. ' + (P.head && P.head.pupil === 'slit' ? 'Slit pupils open wide at night - most snakes with them hunt in the dark.' : 'Round pupils are common in snakes that hunt by day.'), region: 'head', meshes: [], x: Hl * 0.3 }; parts.push(p); } p.meshes.push(e); e.userData.part = 'eye'; });
    if (P.head && P.head.pits) parts.push({ key: 'pits', name: 'Heat pits', text: 'Pits that "see" the warmth of animals, even in total darkness - like a heat camera.', region: 'head', meshes: [], x: Hl * 0.15 });
    const mesh = V.group.children.find((o) => o.isMesh && o.geometry === info.body.geo);
    parts.push({ key: 'skin', name: 'Skin and scales', text: (P.scales && P.scales.keel > 0.3 ? 'Keeled scales (each has a ridge). ' : 'Smooth scales. ') + 'Scales are made of keratin, like your fingernails. The wide belly scales grip the ground. The whole skin is shed in one piece as the snake grows.', region: 'body', meshes: mesh ? [mesh].concat(V.group.children.filter((o) => o.userData && o.userData.headSkin)) : [], x: L * 0.4, skin: true });
    if (P.tail && P.tail.rattle) parts.push({ key: 'rattle', name: 'Rattle', text: 'Hollow, loosely linked segments of keratin. Shaking them makes a buzz that warns animals to keep away.', region: 'tail', meshes: R.tailRig.children.filter((o) => o.isMesh), x: L });
    if (R.active) R.apply();
    return { grp, parts, svl, own };
  }

  // the outline drawn round the part you tap: the part's own surface pushed out a few pixels and drawn behind it,
  // so only a green rim shows round its edge (its colours stay as they are)
  function outlineMat(px) {
    const m = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: px }, uRes: { value: new THREE.Vector2(V.canvas.width || 1, V.canvas.height || 1) }, uCol: { value: new THREE.Color('#5fd35a') } },
      vertexShader: 'uniform float uPx; uniform vec2 uRes;\nvoid main() { vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal); vec4 cn = projectionMatrix * vec4(n, 0.0); vec2 d = cn.xy; float l = length(d); d = l > 1e-6 ? d / l : vec2(0.0); c.xy += d * uPx * 2.0 / uRes * c.w; gl_Position = c; }',
      fragmentShader: 'uniform vec3 uCol;\nvoid main() { gl_FragColor = vec4(uCol, 1.0); }',
      side: THREE.BackSide, depthWrite: false, depthTest: true,
    });
    m.toneMapped = false; return m;
  }

  // the long, gently curved pose Anatomy shows the snake in (organs in a row along it), and props cleared from under it
  // v6.13 (Eduardo: "I clicked see it eat and it did not load fast"): the ground's height under a point used to be found
  // by casting a ray against every triangle of the ground - hundreds of thousands, for each of hundreds of points: the
  // seconds-long freeze on the first click of See it eat, Slither and Anatomy. Now the ground's triangles are sorted once
  // into a grid over the ground (built while the view is idle, kept for the scene) and each point only tests the few in
  // its own cell. Same answers: the highest ground under the point (below the old ray's start, 50 m up).
  let gIdx = null;
  function groundIndex() {
    const scene = V.scene; if (!scene) return null;
    if (gIdx && gIdx.scene === scene) return gIdx;
    const grounds = []; scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.receiveShadow && o.geometry && (o.geometry.type === 'RingGeometry' || o.geometry.type === 'PlaneGeometry') && o.material && !o.material.transparent) grounds.push(o); });
    let nTri = 0; for (const m of grounds) { const g = m.geometry; nTri += (g.index ? g.index.count : g.attributes.position.count) / 3; }
    const tri = new Float32Array(nTri * 9); let t = 0, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; const v = new THREE.Vector3();
    for (const m of grounds) {
      m.updateMatrixWorld(true); const g = m.geometry, pa = g.attributes.position, ix = g.index, n = ix ? ix.count : pa.count, w = new Float32Array(pa.count * 3);
      for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld); w[i * 3] = v.x; w[i * 3 + 1] = v.y; w[i * 3 + 2] = v.z; if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x; if (v.z < z0) z0 = v.z; if (v.z > z1) z1 = v.z; }
      for (let k = 0; k < n; k++) { const j = (ix ? ix.getX(k) : k) * 3; tri[t++] = w[j]; tri[t++] = w[j + 1]; tri[t++] = w[j + 2]; }
    }
    const G = Math.max(1, Math.min(320, Math.round(Math.sqrt(nTri / 3)))), sx = G / Math.max(1e-6, x1 - x0), sz = G / Math.max(1e-6, z1 - z0);
    const cell = (x, z) => [clamp(Math.floor((x - x0) * sx), 0, G - 1), clamp(Math.floor((z - z0) * sz), 0, G - 1)];
    const cnt = new Uint32Array(G * G + 1);
    const span = (q, f) => { const a = cell(Math.min(tri[q], tri[q + 3], tri[q + 6]), Math.min(tri[q + 2], tri[q + 5], tri[q + 8])), b = cell(Math.max(tri[q], tri[q + 3], tri[q + 6]), Math.max(tri[q + 2], tri[q + 5], tri[q + 8])); for (let cz = a[1]; cz <= b[1]; cz++) for (let cx = a[0]; cx <= b[0]; cx++) f(cz * G + cx); };
    for (let q = 0; q < nTri; q++) span(q * 9, (c) => { cnt[c + 1]++; });
    for (let c = 0; c < G * G; c++) cnt[c + 1] += cnt[c];
    const ids = new Uint32Array(cnt[G * G]), fill = cnt.slice(0, G * G);
    for (let q = 0; q < nTri; q++) span(q * 9, (c) => { ids[fill[c]++] = q; });
    gIdx = { scene, nTri, height(x, z, below) { // the highest ground under (x, z), as the old ray found it
      if (!nTri || x < x0 || x > x1 || z < z0 || z > z1) return 0;
      const [cx, cz] = cell(x, z), c = cz * G + cx; let best = -Infinity;
      for (let k = cnt[c]; k < cnt[c + 1]; k++) {
        const q = ids[k] * 9, ax = tri[q], az = tri[q + 2], bx = tri[q + 3] - ax, bz = tri[q + 5] - az, ex = tri[q + 6] - ax, ez = tri[q + 8] - az, d = bx * ez - bz * ex; if (Math.abs(d) < 1e-14) continue;
        const px = x - ax, pz = z - az, u = (px * ez - pz * ex) / d, w2 = (bx * pz - bz * px) / d; if (u < -1e-7 || w2 < -1e-7 || u + w2 > 1 + 1e-7) continue;
        const y = tri[q + 1] + u * (tri[q + 4] - tri[q + 1]) + w2 * (tri[q + 7] - tri[q + 1]); if (y < 50 && y > best) best = y;
      }
      return best === -Infinity ? 0 : Math.max(below ? -1e9 : 0, best);
    } };
    return gIdx;
  }
  function groundYAt(list, below) { // ground heights under points [x, z] (the 3D ground has ripples and lumps; below: also under water)
    const gi = groundIndex(); return list.map(([x, z]) => (gi ? gi.height(x, z, below) : 0));
  }
  function clearProps(pts, rad, opt) { // hide scenery standing on a path ([x, z] points); returns the undo
    const undo = [], m4 = new THREE.Matrix4(), p = new THREE.Vector3(), sc = new THREE.Vector3(), q = new THREE.Quaternion();
    const near = opt && opt.test ? opt.test : (x, z, r) => pts.some((c) => (c[0] - x) ** 2 + (c[1] - z) ** 2 < (rad + r) ** 2); // (v5.74: or any area, e.g. in front of Size vs person)
    // v5.09: only solid things (rocks, logs, twigs) move out of the way; grass, ferns and heather stay - a snake lies
    // among them, and taking them away left a bare, oddly lit patch in the meadow
    const soft = (m) => !(opt && opt.all) && !!m && (m.side === THREE.DoubleSide || m.alphaTest > 0 || m.transparent);
    const occ = V.occ || [];
    const solidNear = opt && opt.solid ? opt.solid : near; // (v6.00: solid things may have an area of their own, e.g. only right under a person's feet)
    for (const o of occ) if (!soft(o.im && o.im.material) && solidNear(o.c.x, o.c.z, o.r * 0.6)) { o.force = true; undo.push(() => { o.force = false; }); }
    V.scene.children.forEach((o) => {
      if (o === V.group || o.isLight || !o.visible) return;
      if (o.isInstancedMesh) {
        // v5.78 (opt.flat): grass and plants where the hunt happens are pressed down flat (as a snake and its prey would
        // leave them), so the prey and the snake's head are never hidden - instead of being taken away, leaving a bare patch
        const flat = opt && opt.flat && soft(o.material);
        if (o.count > 60000 || (soft(o.material) && !flat)) return; let changed = false; if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const gr = o.geometry.boundingSphere.radius;
        for (let i = 0; i < o.count; i++) {
          if (!flat && occ.some((c) => c.im === o && c.i === i)) continue;
          o.getMatrixAt(i, m4); m4.decompose(p, q, sc); const r = gr * Math.max(sc.x, sc.z) * 0.7;
          if (sc.x === 0 || sc.y === 0 || !(flat || !opt || !opt.solid ? near : solidNear)(p.x, p.z, flat ? 0 : r)) continue;
          // (v6.00, opt.press: how far down each plant is pressed, 0-1 of its height, by where it stands - e.g. flat under
          // a person's shoes, trodden round them, untouched a little further out)
          const fy = flat && opt.press ? opt.press(p.x, p.z) : 0.16; if (fy >= 0.999) continue;
          const keep = m4.clone();
          if (flat) { sc.y *= fy; if (fy < 0.5) { sc.x *= 1.1; sc.z *= 1.1; } o.setMatrixAt(i, m4.compose(p, q, sc)); for (const c of occ) if (c.im === o && c.i === i) { const m0 = c.m.clone(); c.m.copy(m4); undo.push(() => { c.m.copy(m0); }); } }
          else o.setMatrixAt(i, m4.makeScale(0, 0, 0));
          changed = true; undo.push(() => { o.setMatrixAt(i, keep); o.instanceMatrix.needsUpdate = true; });
        }
        if (changed) o.instanceMatrix.needsUpdate = true;
      } else if (o.isMesh && o.geometry && o.geometry.type === 'CylinderGeometry' && near(o.position.x, o.position.z, 0.05)) { o.visible = false; undo.push(() => { o.visible = true; }); }
    });
    V.kick(); return () => { undo.forEach((f) => f()); V.kick(); };
  }

  // v6.20 (Eduardo: "in the see it eat animation you can't even see the snake's prey because its under leafs"): the ground
  // cover where the hunt happens gives way, as it would under a struggling animal and a snake's coils - fallen leaves are
  // pushed aside to the edge of the patch (a little heaped there), grass and heather are bent down flat, leaning outwards.
  // pts: [x, z] points; rad: the radius kept clear round each (bare in the middle, the cover rising again just past it).
  // Returns the undo.
  function clearGround(pts, rad) {
    const undo = [], m4 = new THREE.Matrix4(), p = new THREE.Vector3(), sc = new THREE.Vector3(), q = new THREE.Quaternion(), qa = new THREE.Quaternion(), ax = new THREE.Vector3(), occ = V.occ || [];
    const COVER = { litter: 1, carpet: 1, grass: 1, heather: 1, spinifex: 1, lignum: 1 };
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const c of pts) { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); z0 = Math.min(z0, c[1]); z1 = Math.max(z1, c[1]); }
    const reach = rad * 1.5;
    const nearest = (x, z) => { let b = 1e18, bx = 0, bz = 0; for (const c of pts) { const d = (c[0] - x) ** 2 + (c[1] - z) ** 2; if (d < b) { b = d; bx = c[0]; bz = c[1]; } } return [Math.sqrt(b), bx, bz]; };
    V.scene.children.forEach((o) => {
      if (!o.isInstancedMesh || !o.visible || !COVER[o.name]) return;
      const litter = o.name === 'litter'; let changed = false;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m4); const e = m4.elements, x = e[12], z = e[14];
        if (x < x0 - reach || x > x1 + reach || z < z0 - reach || z > z1 + reach) continue;
        const [d, cx, cz] = nearest(x, z); if (d > reach) continue;
        const keep = m4.clone(); m4.decompose(p, q, sc); if (sc.x === 0 || sc.y === 0) continue;
        let dx = x - cx, dz = z - cz; const l = Math.hypot(dx, dz) || 1e-6; dx /= l; dz /= l;
        if (litter) { // pushed out to the edge of the patch, the nearer the centre the further it goes; a little heaped up
          if (d >= rad * 1.12) continue;
          const nd = rad * (1.05 + 0.3 * (1 - d / rad) * ((i * 0.618) % 1)), hx = ((i * 0.37) % 1) - 0.5;
          p.x = cx + dx * nd + dz * hx * rad * 0.15; p.z = cz + dz * nd - dx * hx * rad * 0.15; p.y += sc.x * 0.04 * (1 - d / rad);
          ax.set(-dz, 0, dx); qa.setFromAxisAngle(ax, -0.35 * (1 - d / rad)); q.premultiply(qa); // (tipped up against the heap)
        } else { // bent down flat, away from the action
          const k = sstep(rad * 0.85, reach, d), fy = lerp(0.05, 1, k); if (fy > 0.98) continue;
          sc.y *= fy; ax.set(dz, 0, -dx); qa.setFromAxisAngle(ax, -1.25 * (1 - k)); q.premultiply(qa);
        }
        o.setMatrixAt(i, m4.compose(p, q, sc)); changed = true;
        for (const c of occ) if (c.im === o && c.i === i) { const m0 = c.m.clone(); c.m.copy(m4); undo.push(() => { c.m.copy(m0); }); }
        undo.push(() => { o.setMatrixAt(i, keep); o.instanceMatrix.needsUpdate = true; });
      }
      if (changed) { o.instanceMatrix.needsUpdate = true; if (o.boundingSphere) o.computeBoundingSphere(); }
    });
    V.kick(); return () => { undo.forEach((f) => f()); V.kick(); };
  }

  function anatomyCtl() {
    const st = { on: false, data: null, sel: null, outline: [], mat0: null, list: null, regs: [], selC: null, k: 0, pose: null, undoProps: null, t: 0, skinOpaque: null };
    const card = el('div', 'sp3d-info'); card.hidden = true; card.setAttribute('role', 'note'); labels.appendChild(card);
    const ring = el('div', 'sp3d-ring'); ring.hidden = true; labels.appendChild(ring);
    function skinSeeThrough(v) {
      const m = V.extras.mat; if (!m) return;
      if (v) { if (!st.mat0) st.mat0 = { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite }; const op = st.skinOpaque ? 1 : 0.24; if (m.transparent && m.opacity === op) return; m.transparent = true; m.opacity = op; m.depthWrite = !!st.skinOpaque; }
      else if (st.mat0) { Object.assign(m, st.mat0); st.mat0 = null; } else return;
      m.needsUpdate = true;
    }
    // v5.57: the soft lining of the mouth (roof, floor, the folds and the back wall) is see-through too, like the skin: it
    // used to stay solid and filled the see-through head with a pale pink block. It firms up as the mouth opens.
    function liningMats() {
      const mo = V.extras.mouth; if (!mo || !mo.anchors || !mo.anchors.teeth || !mo.anchors.teeth.parent) return [];
      const out = []; for (const c of mo.anchors.teeth.parent.parent.children) if (c.isMesh && !c.userData.mpart && !c.userData.anat && c.material && !out.includes(c.material)) out.push(c.material);
      return out;
    }
    function liningSeeThrough(v) {
      if (v) { if (!st.lin0) st.lin0 = liningMats().map((m) => [m, { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite }]); for (const [m] of st.lin0) if (!m.transparent) { m.transparent = true; m.depthWrite = false; m.needsUpdate = true; } }
      else if (st.lin0) { for (const [m, o] of st.lin0) { Object.assign(m, o); m.needsUpdate = true; } st.lin0 = null; }
    }
    function insideVisible() { // the mouth's inside shows through the skin
      const mo = V.extras.mouth; if (!st.on || !mo || !mo.anchors || !mo.anchors.teeth || !mo.anchors.teeth.parent) return;
      const ins = mo.anchors.teeth.parent.parent; ins.visible = true;
      if (!st.lin0) liningSeeThrough(true);
      // (v5.93: an open mouth is solid inside - at 88% the lining let the ground and the organs show through the roof and floor
      // as see-through holes; it is see-through only while nearly shut, where it would hide the skull in the see-through head)
      const op = st.skinOpaque ? 1 : lerp(0.3, 1, sstep(0.05, 0.55, mo.t)), solid = op > 0.995;
      for (const [m] of st.lin0) { m.opacity = solid ? 1 : op; if (m.transparent === solid) { m.transparent = !solid; m.depthWrite = solid; m.needsUpdate = true; } }
    }
    // the Head / Ribs / Body / Tail pills sit on their part of the body (v5.05: and hide while a part is picked)
    // v5.09: every label is just a short name and a green Show more pill (the explanation shows only when tapped).
    // Tapping the dot, the name or Show more picks that part (green outline + its card). The labels stack in rows
    // ABOVE the snake (below it only when there is no room), each with a line down to a dot on its part, so they
    // never cover the snake. Zoomed out: Head, Ribs, Body and Tail; zoomed in: the parts in view.
    const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); lines.setAttribute('class', 'sp3d-lines'); lines.setAttribute('aria-hidden', 'true'); labels.insertBefore(lines, labels.firstChild);
    const REG = {
      head: ['Head', 'The head holds the brain, the eyes, the smell organ, the teeth' + (venomous ? ', the fangs and venom glands' : '') + ' and jaws that open very wide.'],
      ribs: null,
      body: ['Body', 'Most of the snake: the heart, the long lung, the liver, stomach, intestines and kidneys all lie one behind the other inside it.'],
      tail: ['Tail', 'From the vent to the tip: backbone and muscles, but no ribs and no big organs.'],
    };
    function mkLabel(name, act) {
      const e = el('div', 'sp3d-reg sp3d-lab'); e.appendChild(el('span', '', name)); const b = el('button', '', 'Show more'); b.type = 'button'; b.setAttribute('aria-label', 'Show more about: ' + name); e.appendChild(b); e.hidden = true; labels.appendChild(e);
      const dot = el('div', 'sp3d-ldot'); dot.hidden = true; dot.setAttribute('aria-label', name); labels.appendChild(dot);
      const go = (ev) => { ev.stopPropagation(); ev.preventDefault(); act(); };
      on(e, 'click', go); on(dot, 'click', go);
      return { el: e, dot, sz: null };
    }
    function regions() {
      st.regs.forEach((r) => { r.el.remove(); r.dot.remove(); }); st.regs = [];
      const F = V.info.F, L = F.L, svl = st.data.svl;
      for (const [k, name, x] of [['head', 'Head', F.Hl * 0.5], ['ribs', 'Ribs', svl * 0.2], ['body', 'Body', svl * 0.55], ['tail', 'Tail', (svl + L) / 2]]) {
        const lb = mkLabel(name, () => seeMore(k)); lb.region = k; lb.rname = name; lb.anchor = () => rig.point(x, 0, F.Hh(clamp(x, 0, L)) * 0.8); st.regs.push(lb);
      }
      for (const p of st.data.parts) { const lb = mkLabel(p.name, () => select(p)); lb.part = p; lb.anchor = () => partAnchor(p); st.regs.push(lb); }
    }
    // where a part is now (its meshes bend with the body and move with the jaws)
    const av = new THREE.Vector3(), aw = new THREE.Vector3();
    function meshAnchor(m, out) {
      const pa = m.geometry && m.geometry.attributes.position; if (!pa) return null;
      const n = pa.count, mid = n >> 1, span = n <= 2400 ? n : Math.min(n, 120), a = n <= 2400 ? 0 : Math.max(0, mid - 60);
      out.set(0, 0, 0); for (let i = a; i < a + span; i++) out.add(av.fromBufferAttribute(pa, i)); out.multiplyScalar(1 / span);
      return out.applyMatrix4(m.matrixWorld);
    }
    // v5.73: anchors are cached - the parts only move when the body is posed or the jaw moves (never when the view turns)
    let ancKey = '', ancMap = new Map();
    function partAnchor(p) {
      if (rig && rig.active) return partAnchor0(p);
      const mo = V.extras.mouth, key = String(mo ? (mo.ver != null ? mo.ver : mo.t) : 0);
      if (key !== ancKey) { ancKey = key; ancMap = new Map(); }
      let a = ancMap.get(p); if (a === undefined) { a = partAnchor0(p); ancMap.set(p, a ? a.clone() : null); return a; }
      return a ? a.clone() : null;
    }
    function partAnchor0(p) {
      const F = V.info.F;
      if (p.key === 'pits') return rig.point(F.Hl * 0.15, F.W(F.Hl * 0.15) * 0.9, 0);
      if (p.skin) return rig.point(F.L * 0.42, F.W(F.L * 0.42), 0);
      if (p.key === 'ribs') return rig.point(p.x, F.W(p.x) * 0.8, 0);
      const out = new THREE.Vector3(); let n = 0;
      for (const m of p.meshes.slice(0, 6)) { if (meshAnchor(m, aw)) { out.add(aw); n++; } }
      return n ? out.multiplyScalar(1 / n) : rig.point(p.x);
    }
    function seeMore(k) {
      const F = V.info.F, L = F.L, svl = st.data.svl;
      const x = k === 'head' ? F.Hl * 0.5 : k === 'ribs' ? svl * 0.3 : k === 'body' ? svl * 0.55 : (svl + L) / 2;
      const p = rig.point(x), d = k === 'head' ? Math.max(V.info.dMin * 1.3, F.Hl * 3.2) : k === 'tail' ? Math.max(V.info.dMin * 1.5, (L - svl) * 2.2) : Math.max(V.info.dMin * 1.5, svl * 0.55);
      V.focus(p, d, 0.6);
      if (st.list) st.list.remove();
      const ls = el('div', 'sp3d-list'); ls.setAttribute('role', 'dialog'); ls.setAttribute('aria-label', k + ' parts');
      ls.appendChild(el('h4', '', { head: 'Head', ribs: 'Ribs and backbone', body: 'Body', tail: 'Tail' }[k] + ': its parts'));
      const x2 = el('button', 'sp3d-ix', '×'); x2.type = 'button'; x2.setAttribute('aria-label', 'Close'); on(x2, 'click', () => { ls.remove(); st.list = null; }); ls.appendChild(x2);
      for (const p2 of st.data.parts.filter((q) => q.region === k)) { const b = el('button', 'sp3d-li', p2.name); b.type = 'button'; on(b, 'click', () => select(p2)); ls.appendChild(b); p2.li = b; }
      labels.appendChild(ls); st.list = ls; st.listK = k;
      if (k === 'ribs') { const rp = st.data.parts.find((q) => q.key === 'ribs'); if (rp) select(rp, true); }
      else { const ps = st.data.parts.filter((q) => q.region === k && !q.skin); select({ key: 'region-' + k, name: REG[k][0], text: REG[k][1], region: k, meshes: [].concat(...ps.map((q) => q.meshes)), x }, true); }
      V.kick();
    }
    function clearSel() {
      st.outline.forEach((o) => { if (o.parent) o.parent.remove(o); o.material.dispose(); }); st.outline = [];
      if (st.skinOpaque) { st.skinOpaque = null; if (st.on) { const m = V.extras.mat; m.opacity = 0.24; m.depthWrite = false; m.needsUpdate = true; } }
      st.sel = null; st.selC = null; card.hidden = ring.hidden = true;
      if (st.list) st.list.querySelectorAll('.sp3d-li').forEach((b) => b.removeAttribute('aria-current'));
      V.kick();
    }
    const pxScale = () => (V.canvas.width || 1) / Math.max(1, V.canvas.clientWidth || 1);
    function partCenter(p) {
      if (p.key === 'pits') return rig.point(V.info.F.Hl * 0.15);
      if (p.skin) return null;
      const bx = new THREE.Box3(), tb = new THREE.Box3(); let n = 0;
      for (const m of p.meshes) { if (!m.geometry) continue; m.updateMatrixWorld(); m.geometry.computeBoundingBox(); tb.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); bx.union(tb); n++; }
      return n ? { c: bx.getCenter(new THREE.Vector3()), r: bx.getSize(new THREE.Vector3()).length() / 2 } : null;
    }
    function select(p, noZoom) {
      // v5.93: picking something that is not part of the region whose Show more list is open closes that list (and its text)
      if (st.list && p && p.region !== st.listK) { st.list.remove(); st.list = null; st.listK = null; }
      clearSel(); st.sel = p;
      if (p.li) p.li.setAttribute('aria-current', 'true');
      const thin = /^(ribs|spine|teeth|palate|fang|tongue|jaw|skull)$/.test(p.key), px = (thin ? 1.6 : 3) * pxScale();
      for (const m of p.meshes) {
        if (!m.geometry) continue;
        m.geometry.computeBoundingSphere();
        // the green rim, drawn over everything; then the part itself on top of it (so you see all of it, in its own colours, even behind other organs)
        const ol = new THREE.Mesh(m.geometry, outlineMat(px)); ol.renderOrder = 9; ol.raycast = () => {}; ol.userData.anat = true; ol.frustumCulled = false;
        if (!p.skin) { ol.material.depthTest = false; const fm = m.material.clone(); fm.depthTest = false; fm.depthWrite = false; fm.side = THREE.DoubleSide; if (fm.transparent) fm.opacity = Math.max(fm.opacity, 0.92); const front = new THREE.Mesh(m.geometry, fm); front.renderOrder = 10; front.raycast = () => {}; front.userData.anat = true; front.frustumCulled = false; m.add(front); st.outline.push(front); }
        m.add(ol); st.outline.push(ol);
      }
      if (p.skin) { st.skinOpaque = true; const m = V.extras.mat; m.opacity = 1; m.depthWrite = true; m.needsUpdate = true; } // the skin shows again, outlined
      card.innerHTML = ''; card.appendChild(el('h4', '', p.name)); card.appendChild(el('p', '', p.text || ''));
      const x = el('button', 'sp3d-ix', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); on(x, 'click', clearSel); card.appendChild(x);
      card.hidden = false;
      // the camera turns to the part and comes close enough to see it well
      const pc = partCenter(p); st.selC = pc ? (pc.c || pc) : null;
      if (pc && !noZoom && pc.c) { const st2 = V.controls.st, want = Math.max(V.info.dMin * 1.2, pc.r * 3.2); V.focus(pc.c, Math.min(st2.goal ? st2.goal.d : st2.d, want)); }
      V.kick();
    }
    const ndc = new THREE.Vector3();
    function after() {
      if (!st.on) return;
      insideVisible();
      const w = stage.clientWidth, h = stage.clientHeight, F = V.info.F;
      const busy = !!show || !!st.sel || st.k < 0.98;
      if (!slither) tip.hidden = !!st.sel;
      detailFade(); // (v5.78: also while a part is picked - the others fade back)
      layoutLabels(busy, w, h);
      for (const o of st.outline) if (o.material.uniforms && o.material.uniforms.uRes) o.material.uniforms.uRes.value.set(V.canvas.width || 1, V.canvas.height || 1);
      placeNotes(w, h);
      if (!st.sel) return;
      // heat pits have no mesh: a green ring marks them
      if (st.sel.key === 'pits') { ndc.copy(rig.point(F.Hl * 0.15, F.W(F.Hl * 0.15) * 0.9, 0)).project(V.cam); ring.hidden = !(ndc.z < 1); const rr = 26; ring.style.width = ring.style.height = rr * 2 + 'px'; ring.style.left = ((ndc.x * 0.5 + 0.5) * w) + 'px'; ring.style.top = ((-ndc.y * 0.5 + 0.5) * h) + 'px'; }
    }
    // v5.68: the parts list (top left) and the part's card (top right; on phones bottom left) start below the buttons
    // over the view and stay clear of fullscreen, so they never cover Compare photo, See countries or the main buttons
    function placeNotes(w, h) {
      const cw = card.offsetWidth || 240, ch = card.offsetHeight || 90, phone = w < 520;
      let cx = w - cw - 10, cy = belowButtons(w - cw - 10, w - 10, h);
      if (phone) { cx = 8; cy = h - ch - 8; } // phones: bottom left (clear of the fullscreen button; the tip line hides meanwhile)
      // v5.78: never over the part it describes: if the part is under the card, the card goes to the other side (or the other end)
      if (st.selC && !card.hidden) { ndc.copy(st.selC).project(V.cam); const sx = (ndc.x * 0.5 + 0.5) * w, sy = (-ndc.y * 0.5 + 0.5) * h, m = 28;
        if (ndc.z < 1 && sx > cx - m && sx < cx + cw + m && sy > cy - m && sy < cy + ch + m) { if (phone) cy = Math.max(8, belowButtons(8, cw + 8, h)); else { const lw = st.list ? (st.list.offsetWidth || 240) + 16 : 0; cx = 8 + lw; cy = belowButtons(cx, cx + cw, h); if (sx > cx - m && sx < cx + cw + m && sy > cy - m && sy < cy + ch + m) { cx = w - cw - 10; cy = h - ch - 60; } } } }
      if (!card.hidden) card.style.transform = 'translate(' + cx.toFixed(1) + 'px,' + Math.max(8, cy).toFixed(1) + 'px)';
      if (st.list) {
        const lw = st.list.offsetWidth || 240, top = Math.max(8, belowButtons(8, 8 + lw, h)), floor = !card.hidden && phone ? cy - 8 : h - 50;
        st.list.style.top = top + 'px'; st.list.style.maxHeight = Math.max(60, floor - top) + 'px';
      }
    }
    // v5.57: each label goes close to its own point - just above or just below the snake there, alternating along the
    // body - sliding sideways only as much as it must to keep clear of the other labels, the snake, the buttons on the
    // view and the leader lines already drawn (it used to stack in rows above the whole snake, with long crossing lines)
    let obst = [], obstT = 0;
    function obstacles() { // the buttons and notes laid over the 3D view (looked up a few times a second, not every frame)
      const t = now(); if (t - obstT < 400) return obst; obstT = t; const sr = stage.getBoundingClientRect(); obst = [];
      stage.querySelectorAll('.sp3d-bar .sp3d-b, .sp3d-bar .sp3d-morebtn, .sp3d-hdb .sp3d-b, .sp3d-fsc, .sp3d-tip, .sp3d-capt, .sp3d-list, .sp3d-info').forEach((e) => {
        if (e.hidden || e.closest('[hidden]')) return; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
        obst.push({ x: r.left - sr.left - 4, y: r.top - sr.top - 4, w: r.width + 8, h: r.height + 8 });
      });
      return obst;
    }
    const segX = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
    const segRect = (a, b, r) => { // does the segment a-b pass through the box r?
      const inR = (p) => p[0] > r.x && p[0] < r.x + r.w && p[1] > r.y && p[1] < r.y + r.h; if (inR(a) || inR(b)) return true;
      const c = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
      for (let i = 0; i < 4; i++) if (segX(a, b, c[i], c[(i + 1) % 4])) return true; return false;
    };
    // v5.73: zoom decides how much you see (Eduardo: "you zoom in at a certain point in the head it should show all parts
    // of head but when you going around it shouldnt start flying everywhere"). Each region (head, body, tail) has
    // small detail parts - skull and jaw bones, quadrate, palate bones, brain, smell organ, venom glands; the little
    // lung, gall bladder, pancreas, spleen, gonads and kidneys; the vent - that fade in as the camera comes close to
    // them, and their labels with them; far away only the big organs and the region names show. Nothing in the snake
    // ever moves when you turn the view: the parts stay where they are in the body, and each label keeps its place
    // beside its part (sliding there smoothly when it has to move to keep clear), fading in and out instead of jumping.
    const camDist = (p) => { const a = partAnchor(p); return a ? V.cam.position.distanceTo(a) : 1e9; };
    function zoneOf(p) {
      const F = V.info.F, L = F.L, svl = st.data.svl, Hl = F.Hl;
      if (p.region === 'head') return [Hl * 4.5, Hl * 9.5];
      if (p.region === 'tail') return [Math.max(Hl * 3, (L - svl) * 1.4), Math.max(Hl * 6, (L - svl) * 2.8)];
      return [Math.max(Hl * 4, svl * 0.16), Math.max(Hl * 8, svl * 0.3)];
    }
    const lookAt = new THREE.Vector3(), lookDir = new THREE.Vector3();
    function detailFade() {
      if (!st.data) return;
      const dC = V.controls.st.d; lookAt.copy(V.cam.position).addScaledVector(V.cam.getWorldDirection(lookDir), dC); // (what the view is centred on)
      for (const p of st.data.parts) {
        const [n0, n1] = zoneOf(p), dist = camDist(p), a = partAnchor(p), near = a ? 1 - sstep(dC * 0.55, dC * 1.15, a.distanceTo(lookAt)) : 0;
        p.rev = st.sel === p || (st.sel && st.sel.key === 'region-' + p.region) ? 1 : 1 - sstep(n0, n1, dist);
        // labels: detail parts with their parts; the big organs from a bit further away; head parts only near the head
        p.lr = (p.detail || p.region === 'head' ? p.rev : 1 - sstep(n0 * 2.2, n1 * 2.2, dist)) * lerp(near, 1, sstep(Math.max(st.data.svl * 0.2, V.info.F.Hl * 4), Math.max(st.data.svl * 0.4, V.info.F.Hl * 8), dC)); // (close in: only what you are looking at)
        // v5.78: a part you pick stands out: the other organs and bones fade back (to about a fifth) while it is picked
        const picked = !st.sel || st.sel === p || (st.sel.key === 'region-' + p.region) || p.skin;
        const dimT = now(), dimDt = clamp((dimT - (p.dimT || dimT)) / 1000, 0, 0.25); p.dimT = dimT; p.dimK = lerp(p.dimK == null ? 1 : p.dimK, picked ? 1 : 0.2, 1 - Math.exp(-dimDt / 0.12)); if (Math.abs(p.dimK - (picked ? 1 : 0.2)) > 0.01) V.kick();
        if (!p.detail && p.dimK > 0.995 && !p.dimmed) continue;
        p.dimmed = p.dimK < 0.995;
        for (const m of p.meshes) {
          if (!m.material || !(m.userData.detail || (m.userData.anat && !p.detail))) continue;
          const mt = m.material; if (mt.userData.op0 == null) mt.userData.op0 = { op: mt.opacity, tr: mt.transparent, dw: mt.depthWrite };
          const o = mt.userData.op0, v = (p.detail ? p.rev : 1) * p.dimK, tr = o.tr || v < 0.99;
          if (mt.transparent !== tr) { mt.transparent = tr; mt.needsUpdate = true; }
          mt.opacity = o.op * v; mt.depthWrite = o.dw && v > 0.99; m.visible = v > 0.01;
        }
      }
    }
    function restoreDetail() { if (st.data) for (const p of st.data.parts) for (const m of p.meshes) { const mt = m.material, o = mt && mt.userData.op0; if (!o) continue; mt.opacity = o.op; mt.transparent = o.tr; mt.depthWrite = o.dw; mt.needsUpdate = true; delete mt.userData.op0; } }
    function layoutLabels(busy, w, h) {
      const F = V.info.F, tn = now(), dt = clamp((tn - (st.lt || tn)) / 1000, 0, 0.1), kS = 1 - Math.exp(-dt * 10), kO = 1 - Math.exp(-dt * 7);
      st.lt = tn;
      const hide = (r) => { r.el.hidden = true; r.dot.hidden = true; r.opc = 0; r.off = r.offC = null; r.shown = false; };
      while (lines.firstChild) lines.removeChild(lines.firstChild);
      if (busy) { st.regs.forEach(hide); return; }
      // the snake on screen: points along it with their half-thickness in pixels
      const snk = []; let any = false;
      for (let i = 0; i <= 100; i++) {
        const x = (i / 100) * F.L, c = rig.point(x); ndc.copy(c).project(V.cam); if (ndc.z > 1) continue;
        const sx = (ndc.x * 0.5 + 0.5) * w, sy = (-ndc.y * 0.5 + 0.5) * h; ndc.copy(c).addScaledVector(V3(0, 1, 0), Math.max(F.Hh(x), F.W(x))).project(V.cam);
        const rr = Math.max(3, Math.abs((-ndc.y * 0.5 + 0.5) * h - sy)); snk.push([sx, sy, rr]); if (sx > -20 && sx < w + 20 && sy > -20 && sy < h + 20) any = true;
      }
      if (!any) { st.regs.forEach(hide); return; }
      const hitsSnake = (r) => snk.some(([sx, sy, rr]) => sx > r.x - rr && sx < r.x + r.w + rr && sy > r.y - rr && sy < r.y + r.h + rr);
      const localSpan = (x0, x1) => { let t = 1e9, b = -1e9; for (const [sx, sy, rr] of snk) if (sx > x0 && sx < x1) { t = Math.min(t, sy - rr); b = Math.max(b, sy + rr); } return [t, b]; };
      // how much each label matters now: the region names far out, the parts as you come close to them
      const d = V.controls.st.d, regK = sstep(st.data.svl * 0.26, st.data.svl * 0.46, d);
      const cand = [];
      for (const r of st.regs) {
        const lr = r.region ? regK : r.part.lr || 0;
        r.lr = lr;
        const a = r.anchor(); if (!a) { r.want = false; continue; } ndc.copy(a).project(V.cam);
        r.sx = (ndc.x * 0.5 + 0.5) * w; r.sy = (-ndc.y * 0.5 + 0.5) * h;
        const onS = ndc.z <= 1 && r.sx > 4 && r.sx < w - 4 && r.sy > 4 && r.sy < h - 4;
        r.want = onS && lr > (r.shown ? 0.15 : 0.4);
        if (r.want) cand.push(r);
      }
      // (v6.20, S12: never two labels with the same name - the Tail and Ribs regions and the Tail and Ribs parts showed
      // side by side: the part, the more exact one, wins)
      { const pn = new Set(cand.filter((r) => r.part).map((r) => r.part.name)); for (let i = cand.length - 1; i >= 0; i--) if (cand[i].region && pn.has(cand[i].rname)) { cand[i].want = false; cand.splice(i, 1); } }
      // the most relevant (then the nearest the middle of the view) first, fewer on a phone; labels already showing first
      const most = w < 520 ? 7 : 12;
      cand.sort((p, q) => (q.shown - p.shown) || (q.lr - p.lr) || (Math.abs(p.sx - w / 2) + Math.abs(p.sy - h / 2)) - (Math.abs(q.sx - w / 2) + Math.abs(q.sy - h / 2)));
      cand.slice(most).forEach((r) => { r.want = false; });
      const list = cand.slice(0, most);
      const boxes = obstacles().slice(), gap = 6;
      const overOk = d < Math.max(st.data.svl * 0.2, F.Hl * 4.2); // (right up close the see-through body fills the view: labels may lie over it, just not over the other labels' dots)
      const dots = overOk ? list.map((r) => [r.sx, r.sy]) : [];
      const free = (box) => box.y >= 4 && box.y + box.h <= h - 4 && box.x >= 4 && box.x + box.w <= w - 4 && !boxes.some((q) => box.x < q.x + q.w + gap && box.x + box.w + gap > q.x && box.y < q.y + q.h + gap && box.y + box.h + gap > q.y) && (overOk ? !dots.some(([x, y]) => x > box.x - 8 && x < box.x + box.w + 8 && y > box.y - 8 && y < box.y + box.h + 8) : !hitsSnake(box));
      list.forEach((r, n) => {
        const e = r.el; e.hidden = false; if (!r.sz || !r.sz[0]) r.sz = [e.offsetWidth || 120, e.offsetHeight || 26];
        const [lw, lh] = r.sz;
        // keep its place beside its part while that place is still clear
        if (r.off) { const box = { x: r.sx + r.off[0], y: r.sy + r.off[1], w: lw, h: lh }; if (free(box)) { boxes.push(box); r.shown = true; return; } }
        const pref = r.off ? (r.off[1] < 0 ? -1 : 1) : (n % 2 ? 1 : -1); // (the side it was on, or alternate above / below along the body)
        let best = null;
        const tryBox = (x, y, extra) => {
          const box = { x, y, w: lw, h: lh }; if (!free(box)) return;
          let cost = Math.hypot(x + lw / 2 - r.sx, y + lh / 2 - r.sy) + extra;
          if (r.off) cost += Math.hypot(x - r.sx - r.off[0], y - r.sy - r.off[1]) * 0.6; // (move as little as it can)
          if (!best || cost < best.cost) best = { box, cost };
        };
        search: for (let k = 0; k < 6; k++) {
          for (const dir of [pref, -pref]) for (const sh of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1]) {
            if (best && best.cost < 40 + lh) break search;
            const x = clamp(r.sx - lw / 2 + sh * lw, 4, w - lw - 4);
            const [t0, b0] = localSpan(x - 6, x + lw + 6), top = Math.min(t0, r.sy - 6), bot = Math.max(b0, r.sy + 6);
            tryBox(x, dir < 0 ? top - 12 - lh - k * (lh + gap) : bot + 12 + k * (lh + gap), (dir !== pref ? 18 : 0) + Math.abs(sh) * 8);
          }
          for (const side of [1, -1]) for (const v of [0, -1, 1, -2, 2]) tryBox(side > 0 ? r.sx + 18 + k * 40 : r.sx - 18 - lw - k * 40, r.sy - lh / 2 + v * (lh + gap), 14 + Math.abs(v) * 6);
        }
        if (!best) { r.want = false; return; }
        boxes.push(best.box); r.off = [best.box.x - r.sx, best.box.y - r.sy]; if (!r.offC) r.offC = r.off.slice(); r.shown = true;
      });
      // draw: each label slides smoothly to its place beside its part and fades in or out (never jumps)
      for (const r of st.regs) {
        const goal = r.want ? Math.min(1, 0.35 + r.lr) : 0;
        r.opc = (r.opc || 0) + (goal - (r.opc || 0)) * kO;
        if (!r.off || r.sx == null || (r.opc < 0.03 && !r.want)) { if (!r.want) hide(r); continue; }
        if (!r.offC) r.offC = r.off.slice(); r.offC[0] += (r.off[0] - r.offC[0]) * kS; r.offC[1] += (r.off[1] - r.offC[1]) * kS;
        const [lw, lh] = r.sz || [120, 26], x = r.sx + r.offC[0], y = r.sy + r.offC[1];
        const e = r.el; e.hidden = false; e.style.opacity = r.opc.toFixed(3); e.style.pointerEvents = r.opc > 0.5 ? '' : 'none';
        e.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        const dt2 = r.dot; dt2.hidden = false; dt2.style.opacity = r.opc.toFixed(3); dt2.style.transform = 'translate(' + r.sx.toFixed(1) + 'px,' + r.sy.toFixed(1) + 'px)';
        const lx = x + lw < r.sx ? x + lw : x > r.sx ? x : clamp(r.sx, x + 10, x + lw - 10), ly = y + lh < r.sy ? y + lh : y > r.sy ? y : clamp(r.sy, y + 6, y + lh - 6);
        for (const [col, wid] of [['rgba(12,26,18,.75)', 3.5], ['#9be07c', 1.6]]) { const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line'); ln.setAttribute('x1', lx); ln.setAttribute('y1', ly); ln.setAttribute('x2', r.sx); ln.setAttribute('y2', r.sy); ln.setAttribute('stroke', col); ln.setAttribute('stroke-width', wid); ln.setAttribute('stroke-linecap', 'round'); ln.setAttribute('stroke-opacity', r.opc.toFixed(3)); lines.appendChild(ln); }
      }
      if (st.regs.some((r) => r.opc > 0.03 && Math.abs((r.want ? Math.min(1, 0.35 + r.lr) : 0) - r.opc) > 0.02 || (r.offC && r.off && Math.abs(r.offC[0] - r.off[0]) + Math.abs(r.offC[1] - r.off[1]) > 0.5))) V.kick(); // (keep animating until settled)
    }
    const ray = new THREE.Raycaster();
    function pick(e) {
      if (!st.on || !st.data) return null;
      const r = V.canvas.getBoundingClientRect(), m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(m, V.cam);
      const objs = []; for (const p of st.data.parts) for (const o of p.meshes) if (!p.skin) { if (o.geometry) o.geometry.computeBoundingSphere(); objs.push(o); }
      V.scene.updateMatrixWorld();
      const hit = ray.intersectObjects(objs, false).find((h) => h.object.visible !== false && h.object.parent && h.object.parent.visible !== false);
      if (hit) return st.data.parts.find((p) => p.meshes.includes(hit.object));
      const sk = st.data.parts.find((p) => p.skin); if (sk && sk.meshes[0]) { sk.meshes[0].geometry.computeBoundingSphere(); if (ray.intersectObject(sk.meshes[0], false).length) return sk; }
      return null;
    }
    // ---- the stretched-out pose
    function makeStretch() {
      const R = rig, N = R.N, info = V.info, F = info.F, az = V.controls.st.az, base0 = -az; // head on the left of the screen, tail on the right
      const thT = new Float32Array(N), A = 0.22;
      for (let i = 0; i < N; i++) { const u = i / (N - 1); thT[i] = base0 + A * Math.sin(TAU * u + 0.3) * (0.4 + 0.6 * sstep(0, 0.2, u)); }
      let sum = 0; for (let i = 0; i < N; i++) sum += R.rth[i] - thT[i];
      const off = Math.round(sum / N / TAU) * TAU; for (let i = 0; i < N; i++) thT[i] += off;
      const a = N >> 1, flat = new Float32Array(N); for (let i = 0; i < N; i++) flat[i] = F.Hh(i * R.dx) * F.bf;
      let pose = R.integrate(thT, a, 0, 0, flat), cx = 0, cz = 0; for (let i = 0; i < N; i++) { cx += pose[i * 3]; cz += pose[i * 3 + 2]; } cx /= N; cz /= N;
      const sx = info.center.x - cx, sz = info.center.z - cz; for (let i = 0; i < N; i++) { pose[i * 3] += sx; pose[i * 3 + 2] += sz; }
      // lie on the 3D ground (it has ripples and lumps)
      const step = 12, pts = []; for (let i = 0; i < N; i += step) pts.push([pose[i * 3], pose[i * 3 + 2]]);
      const gy = groundYAt(pts), ys = new Float32Array(N);
      const Hl = F.Hl, lift = Math.max(F.Hh(Hl * 0.6) * 0.9, Hl * 0.32); // the head held up a little, so the lower jaw can drop without going into the ground
      for (let i = 0; i < N; i++) { const f = i / step, j = Math.min(gy.length - 1, f | 0), j2 = Math.min(gy.length - 1, j + 1); ys[i] = flat[i] + lerp(gy[j], gy[j2], f - j) + lift * (1 - sstep(Hl * 0.8, Hl * 3.2, i * R.dx)); }
      for (let i = 0; i < N; i++) pose[i * 3 + 1] = ys[i];
      let x0 = 1e9, x1 = -1e9; const rx = Math.cos(az), rz = -Math.sin(az); for (let i = 0; i < N; i++) { const s = (pose[i * 3] - info.center.x) * rx + (pose[i * 3 + 2] - info.center.z) * rz; x0 = Math.min(x0, s); x1 = Math.max(x1, s); }
      return { thT, ys, a, ax: pose[a * 3], az: pose[a * 3 + 2], pose, half: Math.max(-x0, x1), pts: pts.map((q) => q) };
    }
    function poseAt(e) { // e = 0 coiled (rest) .. 1 stretched; turning angles blended so the body keeps its length
      const R = rig, N = R.N, S = st.pose, th = new Float32Array(N), ys = new Float32Array(N);
      for (let i = 0; i < N; i++) { th[i] = R.rth[i] + (S.thT[i] - R.rth[i]) * e; ys[i] = R.restY[i] + (S.ys[i] - R.restY[i]) * e; }
      return R.integrate(th, S.a, lerp(R.rc[S.a * 3], S.ax, e), lerp(R.rc[S.a * 3 + 2], S.az, e), ys);
    }
    function stepPose() {
      // v5.12: Anatomy shows the snake as it is (no stretching out): nothing to animate
      st.k = st.on ? 1 : 0; return false;
      // eslint-disable-next-line no-unreachable
      const tn = now(), dt = st.t ? Math.min(0.1, (tn - st.t) / 1000) : 0; st.t = tn;
      if (!rig || show || slither) { st.k = 0; return false; }
      const goal = st.on ? 1 : 0; if (st.k === goal) return false;
      if (goal && !st.pose) return false;
      st.k = V.reduce() ? goal : clamp(st.k + (goal ? 1 : -1) * dt / 1.6, 0, 1);
      if (st.k <= 0) { rig.release(); if (st.undoProps) { st.undoProps(); st.undoProps = null; } st.pose = null; return true; }
      rig.setPose(poseAt(ease(st.k))); rig.apply(); return true;
    }
    function set(v, instant) {
      if (v === st.on) return; st.on = v; V.bAnat.setAttribute('aria-pressed', String(v));
      if (v) {
        idleStop(); if (show) stopShow(true); if (slither) stopSlither();
        if (!st.data) st.data = buildAnatomy();
        skinSeeThrough(true); setOrganVis(true); regions();
        const hint = stage.querySelector('.sp3d-hint'); if (hint) hint.classList.add('sp3d-hint-off');
        tip.hidden = false; tip.textContent = 'A simplified model: organs at their usual places along a snake\'s long body, not to exact scale. ' + (touchUI() ? 'Tap' : 'Click') + ' any part to learn what it is.'; // (v6.20: S12 - say that it is simplified)
        // v5.12: the snake stays as it is (Eduardo: "don't stretch the snake"); the whole snake in view, from a little higher
        st.k = 1;
        if (!V.scaleOn()) { st.view = { az: V.controls.st.az, el: 0.72, d: V.info.dFit * 1.1 }; V.view(st.view); }
      } else {
        clearSel(); skinSeeThrough(false); liningSeeThrough(false); restoreDetail(); setOrganVis(false); st.regs.forEach((r) => { r.el.remove(); r.dot.remove(); }); st.regs = []; while (lines.firstChild) lines.removeChild(lines.firstChild); if (st.list) { st.list.remove(); st.list = null; }
        const mo = V.extras.mouth; if (mo && mo.anchors && mo.anchors.teeth && mo.anchors.teeth.parent) { const ins = mo.anchors.teeth.parent.parent; ins.visible = mo.t > 0.01; ins.children.forEach((c) => { c.visible = true; }); }
        if (!slither) tip.hidden = true;
        fx.reach = 0; if (fx.zoomOut > 1) { fx.zoomOut = 1; if (!instant) V.controls.setGoal({ d: V.info.dFit, px: 0, pz: 0, el: (V.info.portrait ? 40 : 30) * Math.PI / 180 }); }
        if (instant) { st.k = 0; if (rig) rig.release(); if (st.undoProps) { st.undoProps(); st.undoProps = null; } st.pose = null; } // a show or Slither takes over the body now
      }
      V.kick();
    }
    function setOrganVis(v) { if (st.data) st.data.own.forEach((m) => { m.visible = v; }); }
    function refresh() { if (st.on) { skinSeeThrough(true); insideVisible(); } }
    function reset() { liningSeeThrough(false); restoreDetail(); clearSel(); st.regs.forEach((r) => { r.el.remove(); r.dot.remove(); }); st.regs = []; lines.remove(); if (st.list) st.list.remove(); st.list = null; if (st.undoProps) st.undoProps(); st.undoProps = null; st.on = false; st.data = null; st.mat0 = null; st.pose = null; st.k = 0; card.remove(); ring.remove(); }
    function resetView() { if (!st.on || !st.view) return false; clearSel(); V.view(st.view); return true; } // Reset shows the whole stretched-out snake again
    // v6.13: made ready while the view is idle - the parts built and hidden, and their shaders and the see-through skin's
    // compiled - so the first Anatomy click only shows them
    function warm() {
      if (st.on) return; if (!st.data) { st.data = buildAnatomy(); setOrganVis(false); }
      const m = V.extras.mat, m0 = m && { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite };
      if (m) { m.transparent = true; m.opacity = 0.24; m.depthWrite = false; m.needsUpdate = true; }
      const lin = liningMats().filter((q) => !q.transparent).map((q) => [q, q.depthWrite]); for (const [q] of lin) { q.transparent = true; q.depthWrite = false; q.needsUpdate = true; } // (the mouth's lining, see-through too)
      try { compileAll(V.group); } finally { if (m) { Object.assign(m, m0); m.needsUpdate = true; } for (const [q, dw] of lin) { q.transparent = false; q.depthWrite = dw; q.needsUpdate = true; } }
    }
    return { get on() { return st.on; }, get k() { return st.k; }, set, warm, resetView, toggle: () => set(!st.on), after, pick, select, clearSel, refresh, reset, seeMore, stepPose, get parts() { return st.data && st.data.parts; }, get selCenter() { return st.sel ? st.selC : null; } };
  }

  // ================================================================= Size vs person: the snake laid out loosely (v5.74)
  // The body uncoils into a long, loose S lying on the ground across the view (head on the left), its length kept: the
  // turning angles and step lengths are blended from the rest pose to the laid-out one, and every step of the laid-out
  // centre line is one arc-length step of the body, so its length along the body is the model's own length.
  function sizeLayCtl() {
    const st = { e: 0, from: 0, to: 0, t0: 0, dur: 0, lay: null };
    function start(o) {
      if (show || slither || (anat && anat.on)) return null;
      const R = ensureRig(); if (!R) return null;
      const info = V.info, F = info.F, N = R.N, dx = R.dx, az = o.az, base0 = Math.atan2(-Math.sin(az), Math.cos(az)); // heading of T (head to tail) = the screen's right
      const A = o.portrait ? 0.42 : 0.24, waves = o.portrait ? 1.75 : 1.25, thT = new Float32Array(N);
      for (let i = 0; i < N; i++) { const u = i / (N - 1); thT[i] = base0 + A * Math.sin(TAU * waves * u + 0.5) * (0.35 + 0.65 * sstep(0, 0.15, u)); }
      let sum = 0; for (let i = 0; i < N; i++) sum += R.rth[i] - thT[i];
      const off = Math.round(sum / N / TAU) * TAU; for (let i = 0; i < N; i++) thT[i] += off;
      const a = N >> 1, hT = new Float32Array(N).fill(dx), flat = new Float32Array(N); for (let i = 0; i < N; i++) flat[i] = F.Hh(i * dx) * F.bf;
      const pose = integ(thT, hT, a, 0, 0, flat);
      let cx = 0, cz = 0; for (let i = 0; i < N; i++) { cx += pose[i * 3]; cz += pose[i * 3 + 2]; } cx /= N; cz /= N;
      const sx = info.center.x - cx, sz = info.center.z - cz; for (let i = 0; i < N; i++) { pose[i * 3] += sx; pose[i * 3 + 2] += sz; }
      // on the 3D ground (ripples and lumps), the head held just clear of it
      const step = 12, pts = []; for (let i = 0; i < N; i += step) pts.push([pose[i * 3], pose[i * 3 + 2]]); pts.push([pose[(N - 1) * 3], pose[(N - 1) * 3 + 2]]);
      const gy = groundYAt(pts), ys = new Float32Array(N), Hl = F.Hl, lift = F.Hh(Hl * 0.6) * 0.25;
      for (let i = 0; i < N; i++) { const f = i / step, j = Math.min(gy.length - 1, f | 0), j2 = Math.min(gy.length - 1, j + 1); ys[i] = flat[i] + lerp(gy[j], gy[j2], f - j) + lift * (1 - sstep(Hl * 0.8, Hl * 3, i * dx)); pose[i * 3 + 1] = ys[i]; }
      let arc = 0; for (let i = 1; i < N; i++) arc += Math.hypot(pose[i * 3] - pose[i * 3 - 3], pose[i * 3 + 1] - pose[i * 3 - 2], pose[i * 3 + 2] - pose[i * 3 - 1]);
      if (st.undo) st.undo(); st.undo = clearProps(pts, F.w0 * 2.5);
      st.lay = { thT, ys, a, ax: pose[a * 3], az: pose[a * 3 + 2], pose, pts, arc };
      let mx = 0, mz = 0; for (const p of pts) { mx += p[0]; mz += p[1]; }
      return { pts, arc, center: V3(mx / pts.length, 0, mz / pts.length), head: V3(pose[0], pose[1], pose[2]), tail: V3(pose[(N - 1) * 3], pose[(N - 1) * 3 + 1], pose[(N - 1) * 3 + 2]) };
    }
    function integ(th, h, a, ax, az, ys) { // a centre line from turning angles and step lengths, anchored at sample a
      const N = rig.N, out = new Float32Array(N * 3); out[a * 3] = ax; out[a * 3 + 2] = az;
      for (let i = a + 1; i < N; i++) { out[i * 3] = out[i * 3 - 3] + Math.cos(th[i - 1]) * h[i - 1]; out[i * 3 + 2] = out[i * 3 - 1] + Math.sin(th[i - 1]) * h[i - 1]; }
      for (let i = a - 1; i >= 0; i--) { out[i * 3] = out[i * 3 + 3] - Math.cos(th[i]) * h[i]; out[i * 3 + 2] = out[i * 3 + 5] - Math.sin(th[i]) * h[i]; }
      for (let i = 0; i < N; i++) out[i * 3 + 1] = ys[i];
      return out;
    }
    function poseAt(e) {
      const R = rig, N = R.N, S = st.lay, th = new Float32Array(N), h = new Float32Array(N), ys = new Float32Array(N);
      for (let i = 0; i < N; i++) { th[i] = R.rth[i] + (S.thT[i] - R.rth[i]) * e; h[i] = R.rh[i] + (R.dx - R.rh[i]) * e; ys[i] = R.restY[i] + (S.ys[i] - R.restY[i]) * e; }
      return integ(th, h, S.a, lerp(R.rc[S.a * 3], S.ax, e), lerp(R.rc[S.a * 3 + 2], S.az, e), ys);
    }
    const cur = () => { const u = st.dur > 0 ? clamp((now() - st.t0) / st.dur, 0, 1) : 1, k = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; return st.from + (st.to - st.from) * k; };
    function go(to, dur) { st.from = cur(); st.to = to; st.t0 = now(); st.dur = V.reduce() ? 0 : dur; V.kick(); }
    function step() {
      if (!st.lay || !rig) return false;
      if (show || slither) { end(true); return false; } // (something else took the body)
      const e = cur(), moving = Math.abs(e - st.to) > 1e-4; st.e = e;
      if (e <= 1e-4 && st.to === 0) { end(true); return true; }
      rig.setPose(poseAt(e)); rig.apply(); return moving;
    }
    function end(instant) {
      if (!instant) { go(0, 900); return; }
      const had = !!st.lay; st.lay = null; st.e = st.from = st.to = 0; st.dur = 0;
      if (had && rig && !show && !slither) rig.release();
      if (st.undo) { st.undo(); st.undo = null; }
    }
    return { start, go, step, end, get e() { return st.lay ? st.e : 0; }, get moving() { return !!st.lay && Math.abs(cur() - st.to) > 1e-4; }, get on() { return !!st.lay; } };
  }

  // ================================================================= events
  // v6.13: the button answers at once (green, "Stop eating"); the hunt itself (the prey, the paths) is planned just after that
  // is on screen, so the click never waits for it
  const eatSoon = () => { const s0 = show; requestAnimationFrame(() => setTimeout(() => { if (!alive || show !== s0 || !show || show.step) return; eat(); if (show === s0) { if (!show.step) stopShow(); else show.t0 = show.lastF = now(); } V.kick(); }, 0)); };
  on(bEat, 'click', () => { if (deferSlither(() => bEat.click())) return; if (show && show.name === 'eat') { stopShow(); return; } startShow({ name: 'eat', btn: bEat }); eatSoon(); });
  // v6.02: pressed while it slithers home, it sets off again as soon as it is back
  on(bSlither, 'click', () => { if (slither && !slither.ret) stopSlither(true); else if (slither) { slither.then = () => { exclusive('slither'); startSlither(); }; bSlither.setAttribute('aria-pressed', 'true'); } else { exclusive('slither'); startSlither(); } });
  on(bAnat, 'click', () => { if (deferSlither(() => bAnat.click())) return; if (!anat) return; if (!anat.on) exclusive('anatomy'); anat.toggle(); });
  // v5.09: starting one thing turns off whatever else is on - except the ones that go together (Anatomy and Open mouth)
  function exclusive(kind) {
    if (show) stopShow(true);
    if (slither && kind !== 'slither') { if (kind === 'view') slitherHome(true); else stopSlither(); } // (v6.02: callers that take over the body slither it home first: deferSlither)
    if (kind === 'view') { if (V.scaleBack) V.scaleBack(true); } else if (kind !== 'scale') V.scaleOff(); // (v5.74: a camera button lets Size vs person glide back)
    if (anat && anat.on && kind !== 'mouth' && kind !== 'view' && kind !== 'anatomy') anat.set(false, true);
    if (kind === 'slither' || kind === 'scale') V.closeMouth();
    return false;
  }
  on(bFull, 'click', () => V.toggleFull());
  // a tap (not a drag) picks a part while Anatomy is on; a double-click zooms in, or back out
  // v5.68: a plain click or tap on empty space (no snake, part or label under it) leaves whatever is on - Anatomy, See it
  // eat, Slither, Open mouth, Size vs person - and goes back to the normal model, like Reset. Only a real click counts:
  // little movement, short, one finger (dragging to turn or move, and pinching, never reset); a double-click still zooms.
  let down = null, ptrs = 0, multi = false, leaveT = 0, lastTap = null;
  on(V.canvas, 'pointerdown', (e) => { ptrs++; if (ptrs > 1) multi = true; else multi = false; down = [e.clientX, e.clientY, e.timeStamp || now()]; }); // (the events' own times: how long the button was really held)
  const ptrOff = () => { ptrs = Math.max(0, ptrs - 1); };
  on(V.canvas, 'pointercancel', () => { ptrOff(); multi = true; down = null; });
  const anyMode = () => !!(show || slither || (anat && anat.on) || V.mouthGoal > 0.01 || V.scaleOn());
  function hitsSnake(e) {
    const r = V.canvas.getBoundingClientRect(), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), V.cam);
    const objs = []; if (V.group) V.group.traverse((o) => { if (o.isMesh && o.visible !== false) { if (o.geometry && !o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); objs.push(o); } });
    if (show) for (const o of show.objs) o.traverse((q) => { if (q.isMesh) objs.push(q); });
    { const pe = V.scene.getObjectByName('sizePerson'); if (pe) pe.traverse((q) => { if (q.isMesh) objs.push(q); }); } // (v5.74: tapping the person in Size vs person is not empty space)
    V.scene.updateMatrixWorld(); return ray.intersectObjects(objs, false).length > 0;
  }
  function leaveModes() {
    if (!anyMode()) return false;
    if (show) stopShow(); if (slither) slitherHome(true); if (anat && anat.on) anat.set(false, true); // (v6.02: it slithers back home)
    V.closeMouth(); if (V.scaleBack && V.scaleBack()) { V.kick(); return true; } // (v5.74: from Size vs person, back to exactly the view you had)
    V.scaleOff(); if (V.resetView) V.resetView(); V.kick(); return true;
  }
  on(V.canvas, 'pointerup', (e) => {
    ptrOff(); if (!down) return; const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]), dt = (e.timeStamp || now()) - down[2]; down = null;
    lastTap = { moved, dt, multi, button: e.button };
    if (moved > 6 || dt > 650 || multi || e.button > 0) return;
    if (anat && anat.on && !show) { const p = anat.pick(e); if (p) { lastTap.part = p.name; anat.select(p); return; } }
    else if (hitsSnake(e)) { lastTap.snake = true; return; }
    if (!anyMode()) return;
    clearTimeout(leaveT); leaveT = setTimeout(() => { if (alive) leaveModes(); }, 280); // (a second click makes it a double-click: no reset)
  });
  on(wrap, 'click', (e) => { if (e.target === wrap || e.target === row) leaveModes(); }); // (the empty space round the view)
  on(V.canvas, 'dblclick', (e) => {
    clearTimeout(leaveT); e.preventDefault(); if (show) return;
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

  // ================================================================= v5.73: idle life
  // A resting snake is never quite still: it breathes (the trunk swells a little and settles every few seconds - done in
  // the skin's vertex shader, no work on the CPU), flicks its tongue now and then, and every so often lifts and turns
  // its head a touch (that bends the body on the CPU, so only at the High detail setting).
  const idle = { next: 0, flickAt: 0, head: null, uB: { value: 0 }, mat: null }; let lightOnly = false;
  function idleSetup() {
    idle.next = now() + 2500; idle.flickAt = now() + 1500 + Math.random() * 2000; idle.head = null; idle.uB.value = 0; idle.br = null; idle.nFl = 0;
    const m = V.extras && V.extras.mat, F = V.info && V.info.F; if (!m || !F || m.userData.slBreath) return;
    const prev = m.onBeforeCompile, L = F.L, amp = F.w0 * 0.03;
    m.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(this, sh, r);
      if (!/attribute vec3 aMet;/.test(sh.vertexShader)) return; // (the skin's own measures along the body)
      sh.uniforms.uSlBreath = idle.uB;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uSlBreath;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += objectNormal * uSlBreath * ' + amp.toExponential(4) + ' * smoothstep(' + (L * 0.12).toExponential(4) + ', ' + (L * 0.24).toExponential(4) + ', aMet.y) * (1.0 - smoothstep(' + (L * 0.45).toExponential(4) + ', ' + (L * 0.62).toExponential(4) + ', aMet.y));');
    };
    m.userData.slBreath = true; m.needsUpdate = true; idle.mat = m;
  }
  function idleStep() {
    const t = now(), busy = !!show || !!slither || !!(anat && anat.on) || V.mouthGoal > 0.01 || V.reduce();
    // breathing: in for about 1.6 s, out for 2.2 s, then a pause (a snake at rest breathes only a few times a minute)
    // (v6.26: no two breaths alike - each a little longer or shorter and deeper or shallower, with a pause of 1.5-5 s between;
    // a fixed 6.5 s cycle read as a machine. It starts breathed in, so the body first settles as the view opens.)
    { const b = idle.br || (idle.br = { t0: t - 1600, inn: 1600, out: 2600, cyc: 6500, amp: 1 }); let c = t - b.t0;
      if (c >= b.cyc) { b.t0 = t; c = 0; b.inn = 1300 + Math.random() * 700; b.out = 1900 + Math.random() * 900; b.cyc = b.inn + b.out + 1500 + Math.random() * 3500; b.amp = 0.65 + Math.random() * 0.45; }
      idle.uB.value = V.reduce() ? 0 : b.amp * (c < b.inn ? sstep(0, b.inn, c) : c < b.inn + b.out ? 1 - sstep(b.inn, b.inn + b.out, c) : 0); }
    if (busy) { idleStop(); idle.next = Math.max(idle.next, t + 3000); idle.flickAt = Math.max(idle.flickAt, t + 2500); return; }
    // tongue flicks (v5.93): one smooth flick of about 0.9 s - out, the tips waving up and down, back in - and now and then a
    // second one after a short pause, every 4-9 s. (It used to be two quick flicks back to back, each snapping back into the
    // mouth and straight out again, at the scenery's slower frame rate: the tongue seemed to 'reload' every half second.)
    const ft = (t - idle.flickAt) / 1000, fd = idle.flickD || 0.9;
    if (ft >= 0) {
      if (!idle.fo) idle.fo = { w: 3.6, r: 1 };
      if (ft < fd) { flick(ft / fd, idle.fo); idle.flicking = true; }
      else { // (v6.26: each flick its own length, reach and number of waves; one, two or now and then three in a row)
        flick(0); idle.flicking = false; idle.nFl = (idle.nFl || 0) + 1; const again = idle.nFl < 3 && Math.random() < (idle.nFl === 1 ? 0.45 : 0.25); if (!again) idle.nFl = 0;
        idle.flickD = 0.55 + Math.random() * 0.6; idle.fo = { w: 2.4 + Math.random() * 2.4, r: 0.7 + Math.random() * 0.3 };
        idle.flickAt = t + (again ? 250 + Math.random() * 400 : 3500 + Math.random() * 7000); }
    }
    // a slight lift and turn of the head, now and then (High detail only)
    if (V.quality === 'low' || !V.info || V.info.tree) return;
    // (v6.20: no new turn of the head while you are turning the view)
    if (!idle.head && t > idle.next && !(V.controls && V.controls.st.dragging)) { ensureRig(); if (rig) idle.head = { t0: t, yaw: (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.1), dur: 2600 }; }
    if (idle.head) {
      const R = rig, u = (t - idle.head.t0) / idle.head.dur;
      if (u >= 1) { idle.head = null; R.release(); idle.next = t + 7000 + Math.random() * 7000; return; }
      const F = V.info.F, is = Math.min(R.N - 2, Math.round((F.Hl * 4.5) / R.dx)), th = R.rth.slice(), ys = R.restY.slice(), e = Math.sin(Math.PI * sstep(0, 1, u));
      for (let i = 0; i < is; i++) { const k = Math.pow(1 - i / is, 1.5); th[i] += idle.head.yaw * e * k; ys[i] += F.Hl * 0.07 * e * k; }
      R.setPose(R.integrate(th, is, R.rc[is * 3], R.rc[is * 3 + 2], ys)); R.apply(true);
    }
  }
  function idleStop() { if (idle.flicking) { idle.flicking = false; flick(0); } if (idle.head) { idle.head = null; if (rig) rig.release(); } }

  // ================================================================= warm-up (v6.13)
  // Eduardo: "I clicked see it eat button in 3D and it did not load fast for all buttons". While the view sits idle after
  // it is built, everything a button would otherwise build or compile on its first click is made ready, one small step per
  // idle moment (never in the way of a frame or a click): the ground's height grid, the body rig, the shaders of the parts
  // that stay hidden until a button shows them (the inside of the mouth, the tongue...), the prey for See it eat (kept,
  // hidden, so its shaders stay compiled for every later meal), and the person for Size vs person.
  let warmT = 0, warmOn = false; const keepers = [];
  const idleCall = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 2500 }) : setTimeout(f, 300));
  const idleCancel = (t) => { if (window.cancelIdleCallback) cancelIdleCallback(t); clearTimeout(t); };
  function compileAll(root) { // compile the shaders of everything under root, hidden parts too (nothing is drawn)
    const r = V.ctx && V.ctx.renderer; if (!r || !V.cam || !root || !V.scene) return;
    const hid = []; root.traverse((o) => { if (!o.visible) { hid.push(o); o.visible = true; } });
    // (compile only starts each shader: where the browser compiles in the background nothing waits for it here, and the
    // first use comes later, idle - not compileAsync, whose polling throws if a part is thrown away before it is ready)
    try { r.compile(root, V.cam, V.scene); } finally { for (const o of hid) o.visible = false; }
  }
  function warmPrey() { // a prey like the one See it eat makes, set up as it does (fading, cut off at the throat), kept hidden
    const k0 = dietOf(P, V.opts.id), kinds = k0 === 'mouse' ? ['mouse', 'rat'] : k0 === 'rat' ? ['rat', 'mouse'] : [k0];
    for (const k of kinds) {
      const p = buildPrey(k, 0.02, 77); markFade(p); fadeTree(p, 0.5);
      const clip = new THREE.Plane(V3(0, -1, 0), 1e3); p.traverse((o) => { if (!o.material) return; for (const m of [].concat(o.material)) { m.clippingPlanes = [clip]; m.clipShadows = true; if (o.isMesh) m.side = THREE.DoubleSide; } });
      V.scene.add(p); compileAll(p); p.visible = false; p.userData.keeper = true; keepers.push(p);
    }
  }
  // v6.18: what compiling leaves for the first click: the shadow pass's own shaders, the prey's shaders with its cut at
  // the throat switched on (compiling outside a frame sees no cut), and each shader's first use (the browser may finish
  // linking it only then, which on a slow graphics driver held See it eat up for seconds). So, idle: one real frame drawn
  // into a tiny hidden target with the hidden parts shown, set up to need exactly the shaders the screen does (same
  // colours and tone mapping: three.js draws a target flagged as XR like the screen), then each shader's first use, one
  // per idle moment.
  function shadowWarm() {
    const r = V.ctx && V.ctx.renderer, sc = V.scene; if (!r || !V.cam || !sc) return;
    const hid = [], reveal = (root) => root && root.traverse((o) => { if (!o.visible) { hid.push(o); o.visible = true; } });
    reveal(V.group); keepers.forEach(reveal); for (const o of sc.children) if (!o.visible && o.isMesh && o.userData.noRig) reveal(o);
    const rt = new THREE.WebGLRenderTarget(4, 4, { colorSpace: r.outputColorSpace }), prev = r.getRenderTarget(), au = r.shadowMap.autoUpdate;
    rt.texture.colorSpace = r.outputColorSpace; rt.isXRRenderTarget = true;
    try { r.setRenderTarget(rt); r.shadowMap.autoUpdate = true; r.render(sc, V.cam); }
    finally { r.setRenderTarget(prev); r.shadowMap.autoUpdate = au; r.shadowMap.needsUpdate = true; for (const o of hid) o.visible = false; rt.dispose(); }
  }
  let useQ = null;
  function firstUse() { // returns 'more' while there are shaders left to use for the first time
    const r = V.ctx && V.ctx.renderer; if (!r) return '';
    if (!useQ) useQ = r.info.programs.slice();
    const t0 = performance.now(); while (useQ.length && performance.now() - t0 < 8) { const p = useQ.shift(); try { if (p.getUniforms) p.getUniforms(); } catch (e) { /* (a broken shader shows its error when drawn) */ } }
    if (useQ.length) return 'more'; useQ = null; return '';
  }
  function warmSoon() {
    warmStop(); warmOn = true; fx.warmed = false; const scene0 = V.scene;
    const steps = [() => groundIndex(), () => { ensureRig(); for (const o of V.scene.children) if (!o.visible && o.isMesh && o.userData.noRig) compileAll(o); }, () => compileAll(V.group), () => warmPrey(), () => { if (anat && anat.warm && V.extras && V.extras.mouth) anat.warm(); }, () => { // the person for Size vs person: loaded, built once and its shaders compiled, then kept hidden
      if (!man) { man = buildPerson(THREE, 1.7); man.visible = false; return 'wait'; }
      if (man.userData.realPerson === 'loading') return 'wait';
      V.scene.add(man); compileAll(man); man.visible = false; man.userData.keeper = true; keepers.push(man); man = null; return '';
    }, () => { useQ = null; shadowWarm(); }, () => firstUse()];
    let man = null;
    let i = 0;
    const run = () => {
      warmT = 0; if (!alive || !warmOn || V.scene !== scene0) return; if (i >= steps.length) { fx.warmed = true; return; }
      if (show || slither || (anat && anat.on)) { warmT = setTimeout(() => { warmT = idleCall(run); }, 1000); return; } // (busy: later)
      let r = ''; try { r = steps[i](); } catch (e) { /* a warm-up never breaks the view */ }
      if (r === 'wait') { warmT = setTimeout(() => { warmT = idleCall(run); }, 400); return; } // (still downloading)
      if (r === 'more') { warmT = idleCall(run); return; } // (the same step again, at the next idle moment)
      i++; warmT = idleCall(run);
    };
    // (only once the surroundings' light, the plants and the skin's pattern are in: they change which shaders are needed)
    const ready = V.ctx && V.ctx.envReady;
    Promise.resolve(ready).catch(() => {}).then(() => { if (alive && warmOn && V.scene === scene0 && !warmT) warmT = setTimeout(() => { warmT = idleCall(run); }, 800); });
  }
  function warmStop() { warmOn = false; if (warmT) { idleCancel(warmT); warmT = 0; } for (const p of keepers.splice(0)) disposeTree(p); }

  // ================================================================= frame hooks
  const fx = {
    onBuild() {
      layout();
      if (anat) anat.reset(); if (sizeLay) sizeLay.end(true); rig = null; anat = anatomyCtl(); sizeLay = sizeLayCtl(); show = null; slither = null; camBlend = null; fx.zoomOut = 1; fx.reach = 0;
      const has = !!(V.extras && V.extras.mouth);
      bEat.hidden = !has;
      bAnat.hidden = !has; bAnat.setAttribute('aria-pressed', 'false');
      for (const b of [bEat]) { b.disabled = false; b.setAttribute('aria-pressed', 'false'); if (b.dataset.lbl) { b.textContent = b.dataset.lbl; delete b.dataset.lbl; } }
      bPause.hidden = bReplay.hidden = true; setPaused(false, true);
      bSlither.setAttribute('aria-pressed', 'false'); bSlither.textContent = 'Slither';
      say(''); stepTag.hidden = true; tip.hidden = true;
      idleSetup();
      // v5.78: the tree's leaves step aside (like the plants on the ground) whenever they come between the camera and what
      // it is looking at - the head, the prey, a part in Anatomy - so they never hide the snake
      { const tr = V.info && V.info.tree, occ = V.occ; if (tr && occ) { tr.updateMatrixWorld(true); const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
        tr.traverse((o) => { if (!o.isInstancedMesh) return; for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); m4.decompose(p, q, sc); const c = p.clone().applyMatrix4(o.matrixWorld); occ.push({ im: o, i, m: m4.clone(), c, r: Math.max(sc.x, sc.y, sc.z) * 0.8, hid: false, leaf: true }); } }); } }
      warmSoon(); // v6.13: what the buttons need, made ready while the view is idle
    },
    reset() { if (show) { const s = show; show = null; for (const o of s.objs) disposeTree(o); (s.undo || []).forEach((f) => f()); } slither = null; if (sizeLay) sizeLay.end(true); sizeLay = null; if (anat) anat.reset(); anat = null; rig = null; camBlend = null; say(''); warmStop(); },
    step() {
      if (!alive) return false;
      let moving = false;
      if (show && !show.step) moving = true; // (v6.13: the show is being planned)
      else if (show) {
        if (show.freeze == null && !show.paused) { const tn = now(); if (show.lastF && tn - show.lastF > 250) show.t0 += tn - show.lastF - 50; show.lastF = tn; } // (v5.73: a long hitch - a shader compiling - never skips part of the show; v5.78: paused, time stands still)
        const tPrev = show.time; show.time = show.freeze != null ? show.freeze : show.paused ? show.time : (now() - show.t0) / 1000;
        if (!show.paused || show.time !== tPrev || !show.stepped) { show.step(show.time); show.stepped = true; } moving = !show.paused;
        if (show.freeze == null && show.time >= show.dur) stopShow();
      } else if (slither) moving = stepSlither() || !!slither;
      if (camBlend) moving = true;
      const mv0 = moving; idleStep(); if (idle.flicking || idle.head) moving = true; // (v5.93: a flick or a turn of the head is drawn at the full frame rate)
      lightOnly = !mv0 && idle.flicking && !idle.head; // (v6.20: only the tongue moves - viewer.js keeps the shadows)
      if (anat && anat.stepPose()) moving = true, lightOnly = false;
      if (sizeLay && sizeLay.step()) moving = true, lightOnly = false; // v5.74: Size vs person lays the snake out (and coils it back)
      if (rig) rig.sync();
      if (anat && anat.on) { anat.refresh(); }
      { const tr = V.info && V.info.tree, down = !!(slither && !slither.circ) || !!(anat && anat.on) || !!(sizeLay && sizeLay.on); if (tr && tr.visible === down) { tr.visible = !down; moving = true; lightOnly = false; } } // v5.68: the tree goes while it is down on the ground
      return moving;
    },
    camera() { return camera(); },
    lightMove: () => lightOnly,
    camTarget() { return show && show.cLast ? show.cLast.tgt : null; },
    moreButtons: [],
    buttons: { eat: bEat, slither: bSlither }, // v5.74: grouped with Open mouth by viewer.js
    get sizeLay() { return sizeLay; },
    groundY: (list, below) => groundYAt(list, below),
    clearProps: (pts, rad, opt) => clearProps(pts, rad, opt),
    exclusive: (k) => exclusive(k),
    defer: (f) => deferSlither(f), slitherHome: (keepCam) => slitherHome(keepCam), // v6.02: other buttons let it slither home first
    after() { if (anat) anat.after(); },
    get locked() { return false; }, // (v5.78: you can turn and zoom during See it eat too)
    // v5.05: zooming in goes towards the part picked in Anatomy (or the head where it now is), and the camera keeps
    // clear of the body as it is posed now (stretched out, slithering), not only of the coiled rest pose
    focusPoint() { if (anat && anat.on && anat.selCenter) return anat.selCenter; if (rig && rig.active) return rig.point(V.info.F.Hl * 0.45); return null; },
    collide() { if (!rig || !rig.active) return null; const F = V.info.F, out = []; for (let i = 0; i <= 120; i++) { const x = (i / 120) * F.L; out.push({ p: rig.point(x), r: Math.max(F.W(x), F.Hh(x)) * 1.05 }); } return out; },
    reach: 0,
    resetView: () => !!(anat && anat.resetView()),
    zoomOut: 1, // > 1 while slithering: the camera may go further out to see the whole track
    anatOn: () => !!(anat && anat.on),
    leaveModes: () => leaveModes(), // v5.68: a click on empty space around the view
    keepClear: (x, y, w, h) => keepClear(x, y, w, h), // v5.68: labels never on the buttons over the view
    syncFull(f) { bFull.innerHTML = f ? ICON.exit : ICON.full; bFull.setAttribute('aria-label', f ? 'Exit fullscreen' : 'Fullscreen'); bFull.setAttribute('aria-pressed', String(f)); },
    // scale labels never sit on the snake: move a label (x, y = its anchor; the box hangs above it, centred) out of the way
    avoid(x, y, w, h, extra) {
      // v5.09: a label always sits ABOVE the snake (below it only when there is no room above), never on it
      const info = V.info; if (!info || !V.cam) return [x, y];
      const W = stage.clientWidth, H = stage.clientHeight, v = new THREE.Vector3(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i <= 40; i++) { const xx = (i / 40) * info.F.L, p = rig && rig.active ? rig.point(xx) : info.body.spine(xx); for (const u of [1, -1]) { v.copy(p); v.y += u * info.F.Hh(xx); v.project(V.cam); if (v.z > 1) continue; const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H; x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy); } }
      for (const p of extra || []) { v.copy(p).project(V.cam); if (v.z > 1) continue; const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H; x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy); } // (and the ruler)
      x = clamp(x, w / 2 + 4, W - w / 2 - 4); y -= 8; // (a little above its own point, clear of the ruler)
      if (x1 < x0) return [x, Math.max(h + 4, y)];
      const m = 12; x0 -= m; y0 -= m; x1 += m; y1 += m;
      const L = x - w / 2, Rr = x + w / 2;
      if (Rr < x0 || L > x1 || y < y0) return [x, Math.max(h + 4, y)]; // beside the snake or already above it
      if (y0 - h > 4) return [x, y0]; // just above the snake
      if (y1 + h + 4 < H) return [x, y1 + h]; // no room above: just below it
      return [x < (x0 + x1) / 2 ? Math.max(w / 2 + 4, x0 - w / 2 - 4) : Math.min(W - w / 2 - 4, x1 + w / 2 + 4), y];
    },
    dispose() { alive = false; personWait.delete(V.kick); fx.reset(); if (hdb) hdb.remove(); closeSide(); },
    // for tests: freeze a show at s seconds
    test: { get P() { return P; }, freeze(s) { if (show && !show.step && show.name === 'eat') eat(); if (show) show.freeze = s; V.kick(); }, /* (v6.13: a hunt still being planned is planned now) */ get show() { return show && { name: show.name, time: show.time, dur: show.dur, diet: show.diet }; }, get slither() { return !!slither; }, get slitherState() { return slither && { h: slither.h, h0: slither.h0, ret: slither.ret, target: slither.target, tree: !!slither.circ, hK: slither.hK, ph: slither.ph }; }, get showInfo() { return show && show.info; }, get anat() { return anat; }, get rig() { return rig; }, get lastTap() { return lastTap; }, dietOf: () => dietOf(P, V.opts.id), side: (k) => toggleSide(k) },
  };
  return fx;
}
