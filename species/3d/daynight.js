// SnakeList 3D: Day / Night (v6.14). One small button in the 3D viewer's toolbar (and in "See the spot") switches the
// scene between the daylight look and a night look, as when herping after dark:
//  - moonlit blue light and a dark blue sky with stars and a moon (the scene's own sun becomes the moon, low and behind
//    the snake, so it gets a soft cool rim of light);
//  - a torch: a warm spot of light from where you stand, aimed at what you look at, so the snake is always visible;
//  - eye shine in snakes with vertical (slit) pupils, the night hunters whose eyes throw back the torch light.
// Nothing of the day look is changed: the night values are swapped in just for each picture (scene.onBeforeRender)
// and the day values put back after it (onAfterRender), so whatever the viewer does to its own light (the habitat's
// panorama arriving, a new habitat) still works. The change is a smooth ~400 ms blend, at once with reduced motion.
// viewer.js makes one per 3D view: plugin(V, ui) -> { onBuild, camera, frame, set, dispose }.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => t * t * (3 - 2 * t);
const NIGHT = { sky: '#141f3a', bg: '#070d1c', hemi: '#33466e', hemiG: '#0b0f18', moon: '#a9bdf0' };
const ICON_MOON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"></path></svg>';
const ICON_SUN = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"></circle><path d="M12 2.4v2.2M12 19.4v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.4 12h2.2M19.4 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"></path></svg>';

// where the sun stands at a moment and place (the usual low-precision solar formulas, good to well under a degree):
// el = height above the horizon, az = compass bearing from north, clockwise (radians)
export function sunPos(date, lat, lon) {
  const rad = Math.PI / 180, d = date.getTime() / 86400000 - 10957.5; // days from J2000.0
  const g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24, H = (gmst * 15 + lon) * rad - ra, la = lat * rad;
  const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H) * Math.cos(dec), Math.sin(dec) * Math.cos(la) - Math.cos(dec) * Math.sin(la) * Math.cos(H));
  return { el, az: (az + Math.PI * 2) % (Math.PI * 2) };
}

export function plugin(V, ui = {}) {
  const THREE = V.THREE, reduce = V.reduce || (() => false);
  let t = 0, goal = 0, from = 0, t0 = 0, scene = null, torch = null, stars = null, moon = null, nightEnv = null, moonDir = null;
  let torchD = 1, lampK = 1, lampW = 0.34; // v6.35: See the spot's Inspection light sets how strong (0 = off: moonlight only) and wide the torch is
  const tmpC = new THREE.Color(), saved = {}, cols = {};
  for (const k in NIGHT) cols[k] = new THREE.Color(NIGHT[k]);

  // ---- the button (one, in the toolbar; it says what it switches to) ----
  const b = document.createElement('button'); b.type = 'button'; b.className = 'sp3d-b sp3d-dn';
  b.setAttribute('aria-pressed', 'false');
  const paint = () => { const n = goal > 0.5; b.innerHTML = (n ? ICON_SUN + '<span>Day</span>' : ICON_MOON + '<span>Night</span>'); b.setAttribute('aria-pressed', String(n)); b.setAttribute('aria-label', n ? 'Night on - switch back to day' : 'See it at night'); };
  paint();
  if (!document.getElementById('sp3d-dn-css')) {
    const st = document.createElement('style'); st.id = 'sp3d-dn-css';
    st.textContent = '.sp3d-dn{display:inline-flex;align-items:center;gap:5px}.sp3d-dn svg{flex:none}';
    document.head.appendChild(st);
  }
  const place = () => { const g = ui.group || V.bar; if (g && b.parentNode !== g) g.appendChild(b); };
  place();
  V.on(b, 'click', () => set(goal < 0.5));

  function set(night, instant) {
    goal = night ? 1 : 0; paint();
    if (night) aimMoon();
    from = t; t0 = performance.now();
    if (instant || reduce()) { t = goal; from = goal; }
    ensureNight();
    V.kick();
  }

  // the moon (and so the rim light) behind the snake as you see it now, 35 degrees up
  function aimMoon() {
    const cam = V.cam, info = V.info; if (!cam || !info) { moonDir = new THREE.Vector3(-0.5, 0.6, -0.6).normalize(); return; }
    const c = info.center, dx = c.x - cam.position.x, dz = c.z - cam.position.z, h = Math.hypot(dx, dz) || 1;
    moonDir = new THREE.Vector3((dx / h) * 0.82 + 0.2, 0.62, (dz / h) * 0.82).normalize();
  }

  // the night's own pieces, made the first time night is asked for (stars, moon, a dark sky light)
  function ensureNight() {
    const ctx = V.ctx; if (!ctx || !ctx.scene || goal < 0.5 && !stars) return;
    const sc = ctx.scene;
    const R = skyRadius(ctx) * 0.92;
    if (!stars) {
      const n = V.quality === 'low' ? 900 : 1800, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      let s = 1234567; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < n; i++) {
        const u = rnd(), y = 0.04 + Math.pow(u, 0.8) * 0.96, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - y * y);
        pos.set([Math.cos(a) * r * R, y * R, Math.sin(a) * r * R], i * 3);
        const k = 0.45 + Math.pow(rnd(), 3) * 0.75, w = rnd(); col.set([k * (0.85 + w * 0.15), k * 0.92, k * (1.05 - w * 0.12)], i * 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
      stars = new THREE.Points(g, m); stars.renderOrder = -0.5; stars.frustumCulled = false; stars.name = 'sl-stars';
    }
    if (!moon) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
      const gl = x.createRadialGradient(64, 64, 10, 64, 64, 64); gl.addColorStop(0, 'rgba(220,230,255,0.55)'); gl.addColorStop(0.35, 'rgba(170,190,240,0.16)'); gl.addColorStop(1, 'rgba(120,140,200,0)');
      x.fillStyle = gl; x.fillRect(0, 0, 128, 128);
      x.fillStyle = '#eef2ff'; x.beginPath(); x.arc(64, 64, 17, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(150,160,190,0.45)'; [[58, 58, 5], [70, 66, 4], [61, 72, 3], [69, 55, 2.5]].forEach(([a, c, r]) => { x.beginPath(); x.arc(a, c, r, 0, Math.PI * 2); x.fill(); });
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
      moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, opacity: 0, depthWrite: false, fog: false })); moon.renderOrder = -0.4; moon.frustumCulled = false; moon.name = 'sl-moon';
    }
    if (stars.parent !== sc) sc.add(stars);
    if (moon.parent !== sc) sc.add(moon);
    const md = moonDir || new THREE.Vector3(-0.5, 0.6, -0.6).normalize();
    moon.position.copy(md).multiplyScalar(R * 0.9); moon.scale.setScalar(R * 0.2);
    if (!nightEnv && ctx.renderer) {
      const es = new THREE.Scene(), eg = new THREE.SphereGeometry(10, 24, 12), ec = [], ep = eg.attributes.position;
      const top = new THREE.Color('#1b2a52'), hor = new THREE.Color('#0d1428'), gnd = new THREE.Color('#05070c');
      for (let i = 0; i < ep.count; i++) { const y = ep.getY(i) / 10, c = y > 0 ? hor.clone().lerp(top, clamp(y * 1.6, 0, 1)) : gnd; ec.push(c.r, c.g, c.b); }
      eg.setAttribute('color', new THREE.Float32BufferAttribute(ec, 3));
      const mm = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }); es.add(new THREE.Mesh(eg, mm));
      const pm = new THREE.PMREMGenerator(ctx.renderer); nightEnv = pm.fromScene(es, 0.02); pm.dispose(); eg.dispose(); mm.dispose();
    }
  }
  function skyRadius(ctx) {
    const s = ctx.skyMesh; if (!s) return 300;
    if (!s.geometry.boundingSphere) s.geometry.computeBoundingSphere();
    return s.geometry.boundingSphere.radius * Math.max(s.scale.x, 1e-6);
  }

  // each scene (the viewer makes a new one for a new habitat): the torch, and the swap round each picture
  function onBuild() {
    const ctx = V.ctx; scene = ctx && ctx.scene; if (!scene) return;
    stars && stars.parent && stars.parent.remove(stars); moon && moon.parent && moon.parent.remove(moon);
    if (stars) { stars.geometry.dispose(); stars.material.dispose(); stars = null; }
    if (moon) { moon.material.map.dispose(); moon.material.dispose(); moon = null; }
    // (a spot light is part of every scene, dark by day, so turning night on never has to rebuild the shaders)
    torch = new THREE.SpotLight('#ffe9c8', 0, 0, 0.34, 0.7, 2); torch.castShadow = false; torch.name = 'sl-torch';
    scene.add(torch); scene.add(torch.target);
    scene.onBeforeRender = before; scene.onAfterRender = after;
    place();
    if (goal > 0.5) { aimMoon(); ensureNight(); }
  }

  // the camera has just been placed: the torch is held a little to the side, pointing where you look
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  function camera(cam, target) {
    if (!torch) return;
    const d = Math.max(0.05, cam.position.distanceTo(target));
    v1.set(1, 0, 0).applyQuaternion(cam.quaternion); v2.set(0, 1, 0).applyQuaternion(cam.quaternion);
    torch.position.copy(cam.position).addScaledVector(v1, d * 0.06).addScaledVector(v2, -d * 0.03);
    torch.target.position.copy(target); torchD = d;
  }

  // a frame: the blend runs on (true keeps the frames coming)
  function frame() {
    if (t === goal) return false;
    const k = reduce() ? 1 : clamp((performance.now() - t0) / 400, 0, 1);
    t = from + (goal - from) * ease(k);
    if (k >= 1) t = goal;
    return true;
  }

  // ---- the swap ----
  function before(renderer) {
    if (torch) { torch.angle = lampW; torch.intensity = t > 0.0005 ? 2.4 * lampK * torchD * torchD * ease(t) : 0; } // (decay 2: about the same light on the snake from any distance; never hidden, so no shader is rebuilt)
    const ctx = V.ctx; if (!ctx || t <= 0.0005) return;
    const k = t, sun = ctx.sun, hemi = ctx.hemi;
    saved.on = true;
    if (sun) {
      saved.sunI = sun.intensity; saved.sunC = sun.color.clone(); saved.sunP = sun.position.clone();
      sun.intensity = saved.sunI * (1 - k * 0.86); sun.color.lerp(cols.moon, k);
      const len = sun.position.length(), md = moonDir || v2.set(-0.5, 0.6, -0.6).normalize();
      v1.copy(saved.sunP).normalize().lerp(md, k).normalize(); sun.position.copy(v1).multiplyScalar(len);
      sun.updateMatrixWorld(); sun.target.updateMatrixWorld();
    }
    if (hemi) { saved.hI = hemi.intensity; saved.hC = hemi.color.clone(); saved.hG = hemi.groundColor.clone(); hemi.intensity *= 1 - k * 0.55; hemi.color.lerp(cols.hemi, k); hemi.groundColor.lerp(cols.hemiG, k); }
    const sc = ctx.scene;
    if (sc.background && sc.background.isColor) { saved.bg = sc.background; sc.background = tmpC.copy(saved.bg).lerp(cols.bg, k); }
    if (sc.fog) { saved.fog = sc.fog.color.clone(); sc.fog.color.lerp(cols.bg, k); }
    if (ctx.skyMesh && ctx.skyMesh.material.color) { saved.sky = ctx.skyMesh.material.color.clone(); ctx.skyMesh.material.color.lerp(cols.sky, k); }
    if (nightEnv && k > 0.5) { saved.env = sc.environment; sc.environment = nightEnv.texture; }
    const L = ctx.skinLight; if (L && L.uFill) { saved.fill = L.uFill.value.clone(); saved.bounce = L.uBounce.value.clone(); L.uFill.value.multiplyScalar(1 - k * 0.8); L.uBounce.value.multiplyScalar(1 - k * 0.85); }
    if (stars) stars.material.opacity = k;
    if (moon) moon.material.opacity = k;
    saved.exp = renderer.toneMappingExposure; renderer.toneMappingExposure = saved.exp * (1 + k * 0.12);
    // eye shine: the slit-pupilled night hunters' eyes throw the torch light back, warm
    const ex = V.extras, eyes = ex && ex.eyes;
    if (eyes && V.P && V.P.head && V.P.head.pupil === 'slit') {
      saved.eyes = [];
      for (const m of eyes) { const mt = m.material; if (!mt || !mt.emissive) continue; saved.eyes.push([mt, mt.emissive.clone(), mt.emissiveIntensity]); mt.emissive.lerp(tmpC.set('#ffcf7a'), k * 0.9); mt.emissiveIntensity = 1 + k * 1.4; }
    }
  }
  function after(renderer) {
    if (!saved.on) return; saved.on = false;
    const ctx = V.ctx; if (!ctx) return;
    const sun = ctx.sun, hemi = ctx.hemi, sc = ctx.scene;
    if (sun && saved.sunC) { sun.intensity = saved.sunI; sun.color.copy(saved.sunC); sun.position.copy(saved.sunP); sun.updateMatrixWorld(); }
    if (hemi && saved.hC) { hemi.intensity = saved.hI; hemi.color.copy(saved.hC); hemi.groundColor.copy(saved.hG); }
    if (saved.bg) { sc.background = saved.bg; saved.bg = null; }
    if (saved.fog && sc.fog) { sc.fog.color.copy(saved.fog); saved.fog = null; }
    if (saved.sky && ctx.skyMesh) { ctx.skyMesh.material.color.copy(saved.sky); saved.sky = null; }
    if (saved.env !== undefined) { sc.environment = saved.env; delete saved.env; }
    const L = ctx.skinLight; if (L && saved.fill) { L.uFill.value.copy(saved.fill); L.uBounce.value.copy(saved.bounce); saved.fill = null; }
    if (saved.exp != null) { renderer.toneMappingExposure = saved.exp; saved.exp = null; }
    if (saved.eyes) { for (const [mt, c, i] of saved.eyes) { mt.emissive.copy(c); mt.emissiveIntensity = i; } saved.eyes = null; }
    saved.sunC = null; saved.hC = null;
  }

  function dispose() {
    if (stars) { stars.geometry.dispose(); stars.material.dispose(); stars = null; }
    if (moon) { moon.material.map.dispose(); moon.material.dispose(); moon = null; }
    if (nightEnv) { nightEnv.dispose(); nightEnv = null; }
    b.remove();
  }

  // v6.35: the torch as See the spot's labelled Inspection light (k: strength, 0 = off; w: the cone's half-angle)
  function lamp(k, w) { lampK = Math.max(0, +k || 0); if (w) lampW = w; V.kick(); }
  return { onBuild, camera, frame, set, dispose, lamp, button: b, get night() { return goal > 0.5; }, get t() { return t; } };
}
