// SnakeList "See the spot" (v6.14): a sighting's own place in 3D. Opened from a sighting's big view on the map. The
// species' 3D model (viewer.js, unchanged) lies at the exact point where it was seen, and round it is the REAL place,
// as far as free open data allows:
//  - the real height of the land (AWS Terrain Tiles: open elevation data, ~5 m apart),
//  - the ground painted with real satellite pictures (Esri World Imagery, the Satellite map's own pictures) at street
//    level close by (zoom 19 where it exists, else 18) and coarser further out,
//  - the roads, tracks and paths of OpenStreetMap as real road surfaces, and its lakes, ponds, rivers and streams as
//    water (Overpass API, a small circle round the point; kept on this device so a second visit asks nothing),
//  - trees, bushes and grass standing where the satellite picture shows them, of the kind the land cover there says
//    (forest, grassland, scrub, desert), and the close-up ground of that habitat (the viewer's own ground photos),
//  - a light beam, an accuracy ring and a label on the exact spot, and the date, observer and place in a card.
// Obscured sightings (iNaturalist hides the real spot of many snakes) say so: the general area is shown, not the spot.
// It is downloaded only when "See the spot" is pressed, and everything it made is let go when the view closes.
// v6.35 (audit, docs/audit/spot.md): honest about what is real - the point is the centre of an approximate observation
// area (its accuracy), the scene is "recreated from location data" and the card lists which data layers loaded (with
// Retry for the ones that didn't); the time is shown and lit in the place's own time zone (tz.js), not iNaturalist's
// zone when that is the observer's home setting. The preview "spot" (tools/previews.js) adds the inspection light at
// night, a livelier forest and the reworked photo comparison.
import { sunPos } from './daynight.js?r=635';
import { zoneOf, reread, offsetAt, utcTxt } from './tz.js?r=635';
// the preview switch (this module may run where tools/previews.js isn't loaded: then the switch's own key is read)
export const preview = () => { try { const P = window.SL_PREVIEWS; if (P && typeof P.on === 'function') return !!P.on('spot'); return localStorage.getItem('sl-art-preview-spot') === '1'; } catch (e) { return false; } };
const fmtM = (m) => (m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km');
// the sighting's time in the place's own time zone: { date (the moment, for the sun), txt, note, zone, est }
export function timeOf(sp) {
  if (!sp || !sp.when) return null;
  const d0 = new Date(sp.when); if (isNaN(d0)) return null;
  const z = zoneOf(+sp.lat, +sp.lon, sp.tz || '', d0);
  // iNaturalist's zone doesn't fit the place: the clock time the observer recorded is read as the place's own clock
  const date = z.moved && sp.tz ? reread(d0, sp.tz, z.zone) : d0;
  if (!z.zone) return { date, txt: sp.whenTxt || '', note: '', zone: '', est: false };
  let txt = '';
  try { txt = date.toLocaleString(undefined, { timeZone: z.zone, weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-' + 'digit', minute: '2-' + 'digit' }); } catch (e) { txt = sp.whenTxt || ''; }
  const off = utcTxt(offsetAt(z.zone, date)), city = z.zone.split('/').pop().replace(/_/g, ' ');
  txt += ' – local time at the spot (' + (z.est ? off + ', time zone estimated from the location' : city + ' time, ' + off) + ')';
  const note = z.moved ? 'iNaturalist lists it in ' + String(sp.tz).replace(/_/g, ' ') + ' time (not the place\'s zone), so the clock time recorded is read as local time.' : '';
  return { date, txt, note, zone: z.zone, est: z.est };
}

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/';
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const R_EARTH = 6378137, TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const phoneLike = () => typeof screen !== 'undefined' && (Math.min(screen.width, screen.height) < 820 && !!(window.matchMedia && matchMedia('(pointer: coarse)').matches) || Math.min(screen.width, screen.height) < 500);

// ---- the map's Web Mercator: 0..1 across the world; local metres east (x) and south (z) of the sighting ----
const mx = (lon) => (lon + 180) / 360;
const my = (lat) => { const s = Math.sin(clamp(lat, -85, 85) * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };

// ---- loading ----
const timeout = (p, ms, v) => Promise.race([p, new Promise((r) => setTimeout(() => r(v), ms))]);
function loadImg(url, live) {
  return new Promise((res) => {
    const im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
    const t = setTimeout(() => { im.src = ''; res(null); }, 15000);
    im.onload = () => { clearTimeout(t); res(im); }; im.onerror = () => { clearTimeout(t); res(null); };
    if (live) live.push(im);
    im.src = url;
  });
}
// Esri's "Map data not yet available" picture (light grey with pale writing) or an empty tile: no real picture here
function blank(im) {
  try { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 32, 32); const d = x.getImageData(0, 0, 32, 32).data;
    let s = 0, s2 = 0, grey = 0; const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2], l = r * 0.3 + g * 0.59 + b * 0.11; s += l; s2 += l * l; if (Math.abs(r - g) < 7 && Math.abs(g - b) < 7 && l > 185 && l < 245) grey++; }
    return s2 / n - (s / n) * (s / n) < 6 || grey / n > 0.8;
  } catch (e) { return false; }
}
// N x N tiles at zoom z round the point, drawn into one picture. Missing (or "no picture yet") tiles are left see-through
// in the close picture (fill: false; the coarser one shows there) and painted the average colour of the rest in the far one
async function mosaic(urlOf, z, N, lat, lon, live, sizeCap, fill = true, check = false) {
  const n = 2 ** z, fx = mx(lon) * n, fy = my(lat) * n, tx0 = Math.round(fx - N / 2), ty0 = Math.round(fy - N / 2);
  const px = Math.min(256, Math.floor((sizeCap || 4096) / N)), cv = document.createElement('canvas'); cv.width = cv.height = N * px;
  const x = cv.getContext('2d', { willReadFrequently: true });
  const jobs = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const tx = ((tx0 + i) % n + n) % n, ty = ty0 + j; jobs.push(ty < 0 || ty >= n ? Promise.resolve(null) : loadImg(urlOf(z, tx, ty), live).then((im) => [i, j, im && check && blank(im) ? null : im])); }
  const got = await Promise.all(jobs); let ok = 0;
  for (const g of got) if (g && g[2]) { x.drawImage(g[2], g[0] * px, g[1] * px, px, px); ok++; }
  if (fill && ok && ok < got.length) { // (fill the holes with the mean colour so no black squares show)
    const d = x.getImageData(0, 0, cv.width, cv.height).data; let r = 0, gg = 0, b = 0, c = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i + 3]) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; c++; }
    if (c) { x.fillStyle = `rgb(${r / c | 0},${gg / c | 0},${b / c | 0})`; for (const g of got) if (g && !g[2]) x.fillRect(g[0] * px, g[1] * px, px, px); }
  }
  return { cv, ok, all: got.length, z, N, tx0, ty0, n, px };
}
// ---- OpenStreetMap round the point (Overpass), kept on this device ----
const OSM_KEY = 'sl-spot-osm:';
function osmCached(k) { try { const v = localStorage.getItem(OSM_KEY + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function osmKeep(k, v) {
  try {
    const idx = JSON.parse(localStorage.getItem(OSM_KEY + 'idx') || '[]').filter((q) => q !== k); idx.push(k);
    while (idx.length > 12) { try { localStorage.removeItem(OSM_KEY + idx.shift()); } catch (e) { /* (gone) */ } }
    localStorage.setItem(OSM_KEY + k, JSON.stringify(v)); localStorage.setItem(OSM_KEY + 'idx', JSON.stringify(idx));
  } catch (e) { /* full or private mode: just not kept */ }
}
async function osmFetch(lat, lon, rad, signal) {
  const k = lat.toFixed(4) + ',' + lon.toFixed(4) + ',' + rad, c = osmCached(k); if (c) return c;
  const dLat = (rad * 1.6) / 111320, dLon = dLat / Math.max(0.05, Math.cos(lat * Math.PI / 180)), L = lat.toFixed(6) + ',' + lon.toFixed(6);
  const bb = [(lat - dLat).toFixed(5), (lon - dLon).toFixed(5), (lat + dLat).toFixed(5), (lon + dLon).toFixed(5)].join(',');
  const q = `[out:json][timeout:20];(way(around:${rad},${L})[highway];way(around:${Math.round(rad * 1.5)},${L})[waterway];way(around:${Math.round(rad * 1.5)},${L})[natural=water];way(around:${Math.round(rad * 1.5)},${L})[landuse~"^(reservoir|basin)$"];relation(around:${rad},${L})[natural=water];node(around:150,${L})[natural=tree];);out geom(${bb}) qt;is_in(${L})->.a;area.a[~"^(landuse|natural|leisure|landcover|wetland)$"~"."];out tags qt;`;
  let last = null;
  for (const url of OVERPASS) {
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 16000);
      if (signal) signal.addEventListener('abort', () => ctl.abort(), { once: true });
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) { last = new Error('overpass ' + r.status); continue; }
      const d = await r.json(), out = compactOsm(d);
      osmKeep(k, out); return out;
    } catch (e) { last = e; if (signal && signal.aborted) throw e; }
  }
  throw last || new Error('overpass');
}
// only what is drawn: ways as [lat, lon] lists with a few tags, relations' outer/inner rings, the areas at the point
function compactOsm(d) {
  const keep = ['highway', 'surface', 'tracktype', 'lanes', 'width', 'tunnel', 'bridge', 'layer', 'waterway', 'natural', 'landuse', 'water', 'name', 'intermittent', 'area'];
  const tg = (t) => { const o = {}; if (t) for (const k of keep) if (t[k] != null) o[k] = t[k]; return o; };
  const geo = (g) => (g || []).filter(Boolean).map((p) => [+p.lat.toFixed(6), +p.lon.toFixed(6)]);
  const out = { ways: [], rels: [], areas: [], trees: [] };
  for (const e of (d && d.elements) || []) {
    if (e.type === 'way' && e.geometry) out.ways.push({ t: tg(e.tags), g: geo(e.geometry) });
    else if (e.type === 'relation' && e.members) out.rels.push({ t: tg(e.tags), m: e.members.filter((m) => m.type === 'way' && m.geometry).map((m) => ({ r: m.role || 'outer', g: geo(m.geometry) })) });
    else if (e.type === 'area') out.areas.push(tg(e.tags));
    else if (e.type === 'node' && e.tags && e.tags.natural === 'tree') out.trees.push([e.lat, e.lon]);
  }
  return out;
}
// join a relation's member ways into closed rings (pieces cut off at the edge of the asked-for box are left out)
function rings(members) {
  const segs = members.map((m) => m.g.slice()), out = [];
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  while (segs.length) {
    let ring = segs.shift(), grew = true;
    while (!same(ring[0], ring[ring.length - 1]) && grew) {
      grew = false;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i], e = ring[ring.length - 1];
        if (same(s[0], e)) ring = ring.concat(s.slice(1)); else if (same(s[s.length - 1], e)) ring = ring.concat(s.slice(0, -1).reverse());
        else if (same(s[s.length - 1], ring[0])) ring = s.slice(0, -1).concat(ring); else if (same(s[0], ring[0])) ring = s.slice(1).reverse().concat(ring);
        else continue;
        segs.splice(i, 1); grew = true; break;
      }
    }
    if (ring.length > 3 && same(ring[0], ring[ring.length - 1])) out.push(ring);
  }
  return out;
}

// ---- what kind of place: OpenStreetMap's land cover at the point, else the satellite picture's colours ----
const ROAD_W = { motorway: 13, trunk: 11, primary: 9, secondary: 7.5, tertiary: 6.5, unclassified: 5.5, residential: 5.5, living_street: 4.5, service: 3.6, track: 3, motorway_link: 6, trunk_link: 6, primary_link: 6, secondary_link: 5.5, tertiary_link: 5, road: 5, pedestrian: 4, busway: 6, footway: 1.4, path: 1.2, bridleway: 1.8, cycleway: 2, steps: 1.6 };
const PAVED = /^(paved|asphalt|concrete|concrete:plates|paving_stones|sett|chipseal|metal)$/;
const UNPAVED = /^(unpaved|gravel|fine_gravel|compacted|dirt|earth|ground|grass|sand|mud|pebblestone|rock|woodchips)$/;
function kindFromOsm(areas) {
  for (const a of areas || []) {
    const n = a.natural, l = a.landuse, lc = a.landcover;
    if (n === 'wood' || l === 'forest' || lc === 'trees') return 'forest';
    if (n === 'wetland' || a.wetland) return 'swamp';
    if (n === 'water' || l === 'reservoir' || l === 'basin') return 'riverbank';
    if (n === 'sand' || n === 'beach' || n === 'dune') return 'sand';
    if (n === 'bare_rock' || n === 'scree' || n === 'desert' || n === 'shingle' || n === 'rock') return 'arid';
    if (n === 'scrub' || n === 'heath' || lc === 'scrub') return 'heath';
    if (n === 'grassland' || /^(meadow|grass|farmland|orchard|vineyard|recreation_ground|allotments|village_green|cemetery)$/.test(l || '') || lc === 'grass') return 'grass';
  }
  return null;
}
// a pixel's look: excess green and brightness
const pixLum = (r, g, b) => (r * 0.3 + g * 0.59 + b * 0.11) / 255;
const pixExg = (r, g, b) => (2 * g - r - b) / (r + g + b + 1);

// ======================================================================================================================
// prepare(sighting): starts every download at once (the button's press), returns what the 3D panel needs:
//   ready(ms) -> the habitat look to open the model in, plugin -> the viewer plugin, dispose()
// sighting: { id, name, lat, lon, acc, obscured, when (ISO time with offset), day, tz, observer, place, url, habs }
export function prepare(sp) {
  const lat = +sp.lat, lon = +sp.lon, phone = phoneLike();
  const live = [], ctlr = typeof AbortController === 'function' ? new AbortController() : null;
  let dead = false, TH = null, NAT = null, grassMesh = null; const plants = []; // (every tree and bush: hidden while it stands between you and the spot) // (three.js and nature.js, from the viewer)
  const Wm = TAU * R_EARTH * Math.cos(lat * Math.PI / 180), X0 = mx(lon), Y0 = my(lat);
  const toLocal = (la, lo) => [(mx(lo) - X0) * Wm, (my(la) - Y0) * Wm];
  const esriUrl = (z, x, y) => ESRI + z + '/' + y + '/' + x;
  const demUrl = (z, x, y) => DEM + z + '/' + x + '/' + y + '.png';

  // --- downloads ---
  // v6.28 (Eduardo: "See the spot takes too long to load"): lighter and in parallel - the four candidate zooms at the
  // spot are asked for at once (not one after another), and the close picture is 4 x 4 tiles (was 6 x 6 on a computer)
  const zNear = phone ? 18 : 19, nNear = 4;
  const getNear = () => (async () => {
    // the sharpest zoom that has real pictures at the spot (19 in most places, less in remote ones)
    const zs = []; for (let z = zNear; z > 15; z--) zs.push(z);
    const probes = zs.map((z) => { const n = 2 ** z; return loadImg(esriUrl(z, Math.floor(X0 * n), Math.floor(Y0 * n)), live).then((im) => !!(im && !blank(im))); });
    let z = 15; for (let i = 0; i < zs.length; i++) { if (await probes[i]) { z = zs[i]; break; } if (dead) return null; }
    const m = await mosaic(esriUrl, z, nNear, lat, lon, live, phone ? 1024 : 1280, false, true);
    return m.ok ? m : null;
  })().catch(() => null);
  const getFar = (np) => np.then((m) => mosaic(esriUrl, Math.min(zNear, m ? m.z : 18) - 3, 4, lat, lon, live, 1024, true, true)).then((m) => (m.ok ? m : null)).catch(() => null);
  const getDem = () => mosaic(demUrl, 15, 4, lat, lon, live, 1024).then((m) => (m.ok ? m : null)).catch(() => null);
  const getOsm = () => osmFetch(lat, lon, phone ? 320 : 450, ctlr && ctlr.signal).catch(() => null);
  let near = getNear(), far = getFar(near), dem = getDem(), osmP = getOsm();
  const rawP = Promise.all([timeout(osmP, 9000, null), timeout(near, 9000, null)]);
  // v6.35: Retry asks again for the layers that didn't come (the ones that did are kept)
  async function refetch() {
    const [n, f, d, o] = await Promise.all([near, far, dem, osmP].map((p) => timeout(p, 1, null)));
    if (!n) { near = getNear(); far = getFar(near); } else if (!f) far = getFar(near);
    if (!d) dem = getDem();
    if (!o) osmP = getOsm();
  }

  // the satellite picture round the spot, r metres: mean brightness and excess green, the share of green and of dark
  // (tree-shadowed) pixels. Measured on real places: forest E ~0.3 with ~40% dark; meadow and oak pasture E ~0.07;
  // desert scrub (Sonoran) E ~0.03, L ~0.4; dunes L ~0.68; both with almost no dark pixels
  function satStats(m, r) {
    if (!m) return null;
    try {
      const x = m.cv.getContext('2d', { willReadFrequently: true }), n = 2 ** m.z, cx = (X0 * n - m.tx0) * m.px, cy = (Y0 * n - m.ty0) * m.px, mpp = Wm / (n * m.px), rr = Math.max(2, Math.round(r / mpp));
      const x0 = clamp(cx - rr | 0, 0, m.cv.width - 2), y0 = clamp(cy - rr | 0, 0, m.cv.height - 2), w = Math.min(rr * 2, m.cv.width - x0), h = Math.min(rr * 2, m.cv.height - y0);
      const d = x.getImageData(x0, y0, w, h).data; let L = 0, E = 0, R = 0, B = 0, G = 0, D = 0, c = 0;
      for (let i = 0; i < d.length; i += 4 * 3) { if (d[i + 3] < 200) continue; const l = pixLum(d[i], d[i + 1], d[i + 2]), e = pixExg(d[i], d[i + 1], d[i + 2]); L += l; E += e; R += d[i]; B += d[i + 2]; if (e > 0.05) G++; if (l < 0.2) D++; c++; }
      if (c < 50) return null;
      return { L: L / c, E: E / c, R: R / c, B: B / c, green: G / c, dark: D / c };
    } catch (e) { return null; } // (a picture we may not read)
  }
  const dryOf = (q) => !!q && q.E < 0.06 && q.dark < 0.08 && q.L > 0.34 && q.green < 0.42;
  function chooseKind(o, m) {
    let k = o && kindFromOsm(o.areas), why = k ? 'map' : '';
    const q = satStats(m, 25), qw = satStats(m, 120);
    if (!k && q) { // the satellite picture's colours within ~25 m (and ~120 m for dry land)
      k = q.E > 0.12 && q.dark > 0.2 ? 'forest' : dryOf(qw || q) ? (q.L > 0.58 && q.green < 0.3 ? 'sand' : 'arid') : q.E > 0.05 && q.L < 0.3 ? 'forest' : q.E > 0.03 ? 'grass' : q.L > 0.55 && q.R > q.B * 1.15 ? 'sand' : q.R > q.B * 1.12 ? 'arid' : null; why = k ? 'satellite' : '';
    } else if (k && /^(grass|heath)$/.test(k) && dryOf(qw)) { k = 'arid'; why = 'satellite'; } // (a park or "grassland" in a desert is desert scrub)
    // open land without trees (no tree shadows, little green) where the snake is first of all a desert snake: desert scrub
    // (the green of a dry wash or of sparse shrubs reads like a meadow in the picture)
    const h0k = sp.habs && sp.habs[0] && sp.habs[0].k;
    if ((k === 'grass' || k === 'heath') && why === 'satellite' && /^(arid|sand|gibber|clay)$/.test(h0k || '') && qw && qw.dark < 0.08 && qw.E < 0.1) k = h0k === 'sand' ? 'sand' : 'arid';
    if (o && o.ways) { // water within ~25 m (a lake's or river's edge, or a stream): a riverbank
      const near = (g) => { for (let i = 0; i < g.length; i++) { const q = toLocal(g[i][0], g[i][1]); if (Math.hypot(q[0], q[1]) < 25) return true; if (i && segD(0, 0, toLocal(g[i - 1][0], g[i - 1][1]), q) < 25) return true; } return false; };
      const isW = (t) => t.natural === 'water' || t.landuse === 'reservoir' || t.landuse === 'basin' || /^(river|stream|canal|riverbank)$/.test(t.waterway || '');
      let wNear = o.ways.some((w) => isW(w.t) && near(w.g)) || (o.rels || []).some((r) => r.m.some((m) => near(m.g)));
      if (wNear && k !== 'swamp') k = 'riverbank';
    }
    const tropic = Math.abs(lat) < 23.5;
    if (k === 'forest' && tropic && (sp.habs || []).some((h) => h.k === 'rainforest')) k = 'rainforest';
    // the species' own habitats decide between near ones (a desert snake on a sandy place: its sand)
    const habs = sp.habs || [];
    if (k === 'arid' && habs.some((h) => h.k === 'sand') && !habs.some((h) => h.k === 'arid')) k = 'sand';
    if (!k) k = (habs[0] && habs[0].k) || 'grass';
    const L = { forest: 'Woodland', rainforest: 'Rainforest', grass: 'Grassland', heath: 'Scrub and heath', arid: 'Rocky desert', sand: 'Sand dunes', riverbank: 'Riverbank', swamp: 'Swamp' };
    const own = habs.find((h) => h.k === k);
    if (window.SL_3D_TEST) window.__slSpotSat = { q, qw };
    return Object.assign({ k, l: L[k] || k, why }, own && own.f ? { f: own.f } : {});
  }

  const S = {
    ready: (ms) => timeout(rawP.then(([o, m]) => chooseKind(o, m)), ms || 4000, null).then((h) => (S.pick = h || { k: (sp.habs && sp.habs[0] && sp.habs[0].k) || 'grass', l: '', why: 'species' })),
    plugin: (V, ui) => makePlugin(V, ui),
    refetch,
    dispose() { dead = true; if (ctlr) try { ctlr.abort(); } catch (e) { /* */ } for (const im of live) { im.onload = im.onerror = null; try { im.src = ''; } catch (e) { /* */ } } live.length = 0;
      for (const p of [near, far, dem]) p.then((m) => { if (m && m.cv) m.cv.width = m.cv.height = 0; }, () => {}); }, // (the big pictures' memory goes at once: iPads have little)
  };

  // ==================================================================================================================
  function makePlugin(V, ui) {
    const THREE = V.THREE; TH = THREE; NAT = V.NATURE || null;
    const R = rng(Math.round((lat + 90) * 1e5) ^ Math.round((lon + 180) * 1e5));
    let wantView = false, firstAz = null, built = null, first = true, label = null, card = null, credit = null, bArea = null, extent = 900, terrH = null, areaOn = false, beam = null, ring = null;
    const obsc = !!sp.obscured, PV = preview(), acc = +sp.acc || 0;
    // v6.35: the time in the place's own zone (iNaturalist's zone is often the observer's home setting), for the card and the sun
    const TM = timeOf(sp), sun = TM ? sunPos(TM.date, lat, lon) : null;
    css();

    // ---- the card, the label on the spot, the credits ----
    const st = V.stage;
    if (PV) st.classList.add('spot-pv');
    card = document.createElement('div'); card.className = 'spot-card'; card.setAttribute('role', 'note');
    // v6.35 (audit): never "exact spot" - the point is the centre of the area the observer gave (its accuracy), and an
    // obscured sighting's point is not the real spot at all (nothing is worked out from it)
    const accTxt = obsc ? 'Location hidden to protect the snake: iNaturalist shows this sighting only somewhere ' + (acc > 0 ? 'within about ' + fmtM(acc) + ' of this point' : 'near this point') + ', so this is the general area, not the real spot.'
      : acc > 0 ? 'Approximate observation area (±' + fmtM(acc) + '): the snake was somewhere in the yellow circle; it is drawn at its centre.' + (acc > 1500 ? ' The circle is wider than the land shown here.' : '')
      : 'Location accuracy not recorded, so the snake may have been some way from the point shown.';
    const sunTxt = sun ? (sun.el < -0.1 ? 'Seen after dark' : sun.el < 0.1 ? 'Seen at dusk or dawn' : 'Seen in daylight') : '';
    card.innerHTML = '<button type="button" class="spot-card-t" aria-expanded="true"><b>Where it was seen</b><span class="spot-miss" hidden></span><span class="spot-card-ch" aria-hidden="true"></span></button>' +
      '<div class="spot-card-b">' + (sp.photo && sp.photo.src ? '<button type="button" class="spot-ph" title="Show the real photo beside the 3D place"><img alt="' + esc(sp.photo.alt || 'The photo of this sighting') + '" src="' + esc(sp.photo.fb || sp.photo.src) + '" decoding="async"><span>The real photo of this sighting</span></button>' : '') +
      '<p class="spot-honest"><b class="spot-recon">Recreated scene based on location data.</b> The map layers below are real data; the plants, ground detail and the snake (a 3D model of its species) are recreated by SnakeList.</p>' +
      '<p class="spot-pl">' + esc(sp.place || 'No place name given') + '</p>' +
      '<p class="spot-when">' + esc((TM && TM.txt) || sp.whenTxt || 'Date not recorded') + (sunTxt ? ' <span class="spot-mut">· ' + esc(sunTxt) + '</span>' : '') + '</p>' +
      (TM && TM.note ? '<p class="spot-tzn">' + esc(TM.note) + '</p>' : '') +
      (sp.observer ? '<p>Found by ' + esc(sp.observer) + '</p>' : '') +
      '<p class="spot-acc' + (obsc ? ' spot-obsc' : '') + '">' + esc(accTxt) + '</p>' +
      '<div class="spot-layers" aria-live="polite"><p class="spot-lh">Map data layers</p><ul></ul><button type="button" class="spot-retry" hidden>Retry missing layers</button></div>' +
      '<p class="spot-st" aria-live="polite"></p></div>';
    const cT = card.querySelector('.spot-card-t'), cM = card.querySelector('.spot-miss'), cS = card.querySelector('.spot-st'), cL = card.querySelector('.spot-layers ul'), cR = card.querySelector('.spot-retry');
    V.on(cT, 'click', () => { const o = card.classList.toggle('spot-shut'); cT.setAttribute('aria-expanded', String(!o)); });
    { const pb = card.querySelector('.spot-ph'); if (pb) V.on(pb, 'click', () => { const hb = st.querySelector('.sp3d-hb'); if (hb && hb.getAttribute('aria-pressed') !== 'true') hb.click(); }); }
    if (phone || (st.clientWidth || 999) < 560) { card.classList.add('spot-shut'); cT.setAttribute('aria-expanded', 'false'); }
    label = document.createElement('div'); label.className = 'spot-pin'; label.setAttribute('aria-hidden', 'true');
    label.innerHTML = '<b>' + (obsc ? 'Somewhere in this area' : acc >= 15 ? 'Centre of the observation area' : 'Seen here') + '</b>' + (sp.dayTxt || (!obsc && acc >= 15) ? '<span>' + esc([!obsc && acc >= 15 ? '±' + fmtM(acc) : '', sp.dayTxt || ''].filter(Boolean).join(' · ')) + '</span>' : '');
    label.hidden = true;
    credit = document.createElement('p'); credit.className = 'spot-credit';
    credit.innerHTML = 'Satellite pictures <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics · Land height <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles</a> · Roads and water &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
    st.append(card, label, credit);
    const status = (t) => { cS.textContent = t || ''; cS.hidden = !t; };
    status('');
    // v6.35 (preview "spot"): a night scene stays night, but a labelled Inspection light (on at first) lights the snake
    // and the ground round it - turned off, only the moon lights the place, as it was
    let lampB = null;
    const lampSet = (on) => { if (!lampB) return; lampB.setAttribute('aria-pressed', String(on)); lampB.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"></path></svg><span>Inspection light: ' + (on ? 'on' : 'off') + '</span>';
      if (V.dayNight && V.dayNight.lamp) V.dayNight.lamp(on ? 1.9 : 0, on ? 0.52 : 0.34); };
    if (PV && sun && sun.el < -0.05) {
      lampB = document.createElement('button'); lampB.type = 'button'; lampB.className = 'spot-lamp';
      lampB.setAttribute('aria-label', 'Inspection light (a torch on the snake - the scene itself stays at night)');
      V.on(lampB, 'click', () => lampSet(lampB.getAttribute('aria-pressed') !== 'true'));
      st.appendChild(lampB); lampSet(true);
    }
    // v6.35: which data layers the scene has - loading, loaded or missing (never a spinner without end: each has a time limit)
    const LAYERS = [['sat', 'Satellite pictures'], ['dem', 'Land height'], ['osm', 'Roads and water (OpenStreetMap)']];
    const layers = (o) => {
      cL.innerHTML = LAYERS.map(([k, t]) => { const v = o ? o[k] : 'wait'; return '<li class="spot-ly spot-ly-' + (v === true ? 'ok' : v === 'wait' ? 'wait' : 'no') + '" data-k="' + k + '"><span aria-hidden="true"></span>' + esc(t) + ': ' + (v === true ? 'loaded' : v === 'wait' ? 'loading…' : 'couldn\'t load') + '</li>'; }).join('');
      const miss = !!o && LAYERS.some(([k]) => o[k] !== true); cR.hidden = !miss; cR.disabled = false; cR.textContent = 'Retry missing layers';
      card.classList.toggle('spot-partial', miss);
      // (what is missing is never hidden: the card's title says it even while the card is shut - on a phone the open card
      // would cover the whole scene, so it stays shut there)
      const nMiss = o ? LAYERS.filter(([k]) => o[k] !== true).length : 0; cM.textContent = nMiss ? nMiss + (nMiss > 1 ? ' layers' : ' layer') + ' missing' : ''; cM.hidden = !nMiss;
      if (miss && card.classList.contains('spot-shut') && !phone && (st.clientWidth || 999) >= 560) { card.classList.remove('spot-shut'); cT.setAttribute('aria-expanded', 'true'); }
    };
    layers(null);
    V.on(cR, 'click', () => {
      cR.disabled = true; cR.textContent = 'Trying again…'; layers(null); cR.hidden = false; cR.disabled = true; cR.textContent = 'Trying again…';
      S.refetch().then(() => { if (!dead && V.rebuild) V.rebuild(); });
    });
    const busyTxt = (t) => { const s = st.querySelector('.sp3d-busy span'); if (s) s.textContent = t; };

    // ---- "The area": the camera rises to see the whole place round the spot, and back ----
    // (v6.28: no "See the area" button - Eduardo asked for no buttons in See the spot but fullscreen; dragging and zooming
    // the view still shows the whole place round the spot)
    bArea = document.createElement('button'); bArea.type = 'button'; bArea.className = 'sp3d-b spot-area'; bArea.hidden = true;
    V.on(bArea, 'click', () => {
      const c = V.controls; if (!c) return; areaOn = !areaOn; bArea.setAttribute('aria-pressed', String(areaOn)); bArea.textContent = areaOn ? 'Back to the snake' : 'See the area';
      if (areaOn) { const tall = /^(forest|rainforest|swamp)$/.test(kindNow()); c.tween({ az: c.st.az, el: ((tall ? 58 : 38) * Math.PI) / 180, d: clamp(Math.max(tall ? 110 : 60, (sp.acc || 0) * 2.6), 60, extent * 0.4), px: 0, pz: 0 }, 1400); }
      else if (V.info) V.view({ el: (14 * Math.PI) / 180, d: V.info.dFit * 1.35, px: 0, pz: 0 }); else V.resetView();
    });

    // ---- the ground: called by viewer.js's buildScene in place of its own made-up surroundings ----
    function ground(A) {
      const { scene, Rb, F, poseInfo, dist2snake } = A, ctx = V.ctx, quality = A.quality;
      const sceneNow = scene, low = quality === 'low';
      busyTxt('Building the real place: land, satellite pictures, roads…');
      const job = (async () => {
        const [mN, mF, mD, osm] = await Promise.all([timeout(near, 25000, null), timeout(far, 25000, null), timeout(dem, 20000, null), timeout(osmP, 22000, null)]);
        if (dead || ctx.scene !== sceneNow) return;
        build({ scene, ctx, Rb, F, poseInfo, dist2snake, mN, mF, mD, osm, low, S: A.S });
      })().catch((e) => { console.warn('spot', e); status('The real place couldn\'t be built just now.'); layers({ sat: false, dem: false, osm: false }); });
      ctx.natureReady = job;
      return true;
    }
    ctx0().ground = ground;
    function ctx0() { return V.ctx; }

    function build(B) {
      const { scene, ctx, Rb, F, dist2snake, mN, mF, mD, osm, low } = B, track = ctx.track;
      plants.length = 0; grassMesh = null; beam = ring = null; lastCam.set(1e9, 0, 0); // (a new habitat: a new scene)
      const maxAniso = ctx.renderer.capabilities.getMaxAnisotropy();
      // -- land height --
      let H = () => 0;
      if (mD) {
        const x = mD.cv.getContext('2d', { willReadFrequently: true }), W = mD.cv.width, d = x.getImageData(0, 0, W, W).data, h = new Float32Array(W * W);
        for (let i = 0, j = 0; i < h.length; i++, j += 4) h[i] = d[j] * 256 + d[j + 1] + d[j + 2] / 256 - 32768;
        const n = 2 ** mD.z, sc = mD.px / 256;
        H = (lx, lz) => {
          const gx = ((X0 + lx / Wm) * n - mD.tx0) * 256 * sc - 0.5, gy = ((Y0 + lz / Wm) * n - mD.ty0) * 256 * sc - 0.5;
          const i = clamp(Math.floor(gx), 0, W - 2), j = clamp(Math.floor(gy), 0, W - 2), a = clamp(gx - i, 0, 1), b = clamp(gy - j, 0, 1), o = j * W + i;
          return (h[o] * (1 - a) + h[o + 1] * a) * (1 - b) + (h[o + W] * (1 - a) + h[o + W + 1] * a) * b;
        };
      }
      const h0 = H(0, 0);
      // how far the real land reaches (the far satellite picture and the heights both cover it)
      const edgeOf = (m) => { if (!m) return 1e9; const n = 2 ** m.z; return Math.min(X0 * n - m.tx0, m.tx0 + m.N - X0 * n, Y0 * n - m.ty0, m.ty0 + m.N - Y0 * n) / n * Wm; };
      extent = clamp(Math.min(edgeOf(mF), edgeOf(mD), edgeOf(mN) * 6) * 0.96, 250, 2600);
      if (!mF && !mN) extent = 400;
      // -- roads (and is the snake on one?) --
      const roads = [], waters = [], streams = [], treeNodes = [];
      if (osm) {
        for (const w of osm.ways) {
          const t = w.t, pts = w.g.map((p) => toLocal(p[0], p[1]));
          if (pts.length < 2) continue;
          if (t.highway && t.tunnel !== 'yes' && ROAD_W[t.highway] != null && t.area !== 'yes') {
            let wd = parseFloat(t.width) || (t.lanes ? Math.max(+t.lanes || 2, 1) * 3.3 : ROAD_W[t.highway]);
            if (!(wd > 0.5 && wd < 40)) wd = ROAD_W[t.highway];
            const smallRoad = /^(track|path|footway|bridleway|cycleway|steps)$/.test(t.highway);
            const paved = t.surface ? PAVED.test(t.surface) : !smallRoad && !(t.tracktype && t.tracktype !== 'grade1');
            roads.push({ pts, w: wd, paved, major: /^(motorway|trunk|primary|secondary|tertiary)/.test(t.highway), path: /^(path|footway|bridleway|cycleway|steps)$/.test(t.highway), hw: t.highway });
          } else if (t.waterway && /^(river|stream|canal|ditch|drain|brook|tidal_channel)$/.test(t.waterway) && t.tunnel !== 'yes' && !(pts.length > 3 && w.g[0][0] === w.g[w.g.length - 1][0] && w.g[0][1] === w.g[w.g.length - 1][1] && t.waterway === 'riverbank')) {
            const wd = parseFloat(t.width) || { river: 14, canal: 9, stream: 2.4, brook: 2, tidal_channel: 8, ditch: 1.4, drain: 1.6 }[t.waterway] || 2;
            streams.push({ pts, w: clamp(wd, 0.8, 60), dry: t.intermittent === 'yes' });
          } else if ((t.natural === 'water' || t.landuse === 'reservoir' || t.landuse === 'basin' || t.waterway === 'riverbank') && pts.length > 3) {
            const g0 = w.g[0], g1 = w.g[w.g.length - 1]; if (g0[0] === g1[0] && g0[1] === g1[1]) waters.push({ outer: pts, holes: [] });
          }
        }
        for (const r of osm.rels) {
          const outs = rings(r.m.filter((m) => m.r !== 'inner')).map((g) => g.map((p) => toLocal(p[0], p[1]))), ins = rings(r.m.filter((m) => m.r === 'inner')).map((g) => g.map((p) => toLocal(p[0], p[1])));
          for (const o of outs) waters.push({ outer: o, holes: ins.filter((h) => inPoly(h[0][0], h[0][1], o)) });
        }
        for (const p of osm.trees) treeNodes.push(toLocal(p[0], p[1]));
      }
      const segDist = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
      const roadDist = (x, z) => { let m = 1e9; for (const r of roads) { for (let i = 0; i < r.pts.length - 1; i++) { const d = segDist(x, z, r.pts[i], r.pts[i + 1]) - r.w / 2; if (d < m) m = d; } } return m; };
      const inWater = (x, z) => { for (const w of waters) if (inPoly(x, z, w.outer) && !w.holes.some((h) => inPoly(x, z, h))) return true; for (const s of streams) for (let i = 0; i < s.pts.length - 1; i++) if (segDist(x, z, s.pts[i], s.pts[i + 1]) < s.w / 2) return true; return false; };
      const onRoad = roads.some((r) => r.paved && r.pts.some((p, i) => i && segDist(0, 0, r.pts[i - 1], p) < r.w / 2 + 0.4));
      // the first view: water close by is shown behind the snake; on a road you look along it
      firstAz = null;
      { let best = 60, at = null;
        const edge = (pts) => { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9, t = clamp((-a[0] * dx - a[1] * dz) / l2, 0, 1), x = a[0] + dx * t, z = a[1] + dz * t, d = Math.hypot(x, z); if (d < best && d > 0.5) { best = d; at = [x, z]; } } };
        for (const w of waters) edge(w.outer); for (const st2 of streams) edge(st2.pts);
        if (at) firstAz = Math.atan2(-at[0], -at[1]);
        else if (onRoad) { let bd = 1e9; for (const r of roads) for (let i = 1; i < r.pts.length; i++) { const d = segDist(0, 0, r.pts[i - 1], r.pts[i]); if (d < bd) { bd = d; const dx = r.pts[i][0] - r.pts[i - 1][0], dz = r.pts[i][1] - r.pts[i - 1][1]; firstAz = Math.atan2(dx, dz) + 0.35; } } }
      }
      // the land, relative to the spot: flat right round the snake (it lies on level ground), real everywhere else
      const flatR = Math.max(Rb * 1.6, 1.2) + 2, sink = onRoad ? 0.025 : 0; // (+2 m: the first view's camera stands on the level part too, so it isn't lifted up a slope)
      const Tg = (x, z) => { const r = Math.hypot(x, z); return (H(x, z) - h0) * sstep(flatR, flatR + 10, r) - sink * (1 - sstep(flatR + 4, flatR + 10, r)); };
      terrH = Tg;

      // -- the ground mesh: one grid, fine near the spot and coarser out to the edge --
      const N = low ? 120 : phone ? 150 : 200, a = 0.03, f = (u) => Math.sign(u) * (a * Math.abs(u) + (1 - a) * Math.abs(u) ** 3) * extent;
      const g = new THREE.PlaneGeometry(2, 2, N, N); g.rotateX(-Math.PI / 2);
      const pp = g.attributes.position;
      for (const w of waters) {
        w.o = w.outer.map((p) => [clamp(p[0], -extent, extent), clamp(p[1], -extent, extent)]);
        let lv = 1e9; for (const p of w.o) lv = Math.min(lv, Tg(p[0], p[1]));
        let dn = 1e9; for (let i = 1; i < w.o.length; i++) dn = Math.min(dn, segDist(0, 0, w.o[i - 1], w.o[i]));
        if (inPoly(0, 0, w.o)) dn = 0;
        if (dn < 80) lv = Math.min(lv, dn < 1 ? -0.05 : -0.12);
        w.lv = lv; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of w.o) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); } w.bb = [x0, x1, z0, z1];
      }
      const carve = (x, z, y) => { for (const w of waters) { if (x < w.bb[0] || x > w.bb[1] || z < w.bb[2] || z > w.bb[3] || w.o.length < 4) continue; if (inPoly(x, z, w.o) && !w.holes.some((h) => inPoly(x, z, h))) y = Math.min(y, w.lv - 0.35); } return y; };
      for (let i = 0; i < pp.count; i++) { const x = f(pp.getX(i)), z = f(pp.getZ(i)); pp.setXYZ(i, x, carve(x, z, Tg(x, z)), z); }
      g.computeVertexNormals(); g.computeBoundingSphere();
      const tex = (m) => { if (!m) return null; const t = new THREE.CanvasTexture(m.cv); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = Math.min(8, maxAniso); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; track(t); return t; };
      const box = (m) => { if (!m) return new THREE.Vector4(-1e6, -1e6, 1, 1); const n = 2 ** m.z, x0 = (m.tx0 / n - X0) * Wm, z0 = (m.ty0 / n - Y0) * Wm, s = (m.N / n) * Wm; return new THREE.Vector4(x0, z0, s, s); };
      const tN = tex(mN), tF = tex(mF) || tN, base = new THREE.Color(B.S && B.S.fog ? B.S.fog : '#9a9a88');
      const U = { uSatN: { value: tN || tF }, uSatF: { value: tF }, uBoxN: { value: box(mN || mF) }, uBoxF: { value: box(mF || mN) }, uHasSat: { value: tN || tF ? 1 : 0 }, uBase: { value: base }, uFloor: { value: new THREE.Color(kindNow() === 'swamp' ? '#3f3a2a' : PV ? '#5e4a33' : '#4a3b2a') }, uFloorR: { value: /^(forest|rainforest|swamp)$/.test(kindNow()) ? 34 : 0 } };
      const gm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.97, metalness: 0, envMapIntensity: 0.45 });
      gm.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSpW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSpW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSpW; uniform sampler2D uSatN, uSatF; uniform vec4 uBoxN, uBoxF; uniform float uHasSat; uniform vec3 uBase; uniform vec3 uFloor; uniform float uFloorR;' + (PV ? '\nfloat spH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat spN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(spH(i), spH(i + vec2(1.0, 0.0)), f.x), mix(spH(i + vec2(0.0, 1.0)), spH(i + vec2(1.0, 1.0)), f.x), f.y); }' : ''))
          .replace('#include <map_fragment>', `#include <map_fragment>
{ vec2 qn = (vSpW.xz - uBoxN.xy) / uBoxN.zw, qf = (vSpW.xz - uBoxF.xy) / uBoxF.zw;
  vec3 cf = texture2D(uSatF, qf).rgb;
  vec4 cn4 = texture2D(uSatN, qn); vec2 en = min(qn, 1.0 - qn); float wn = smoothstep(0.0, 0.06, min(en.x, en.y)) * cn4.a;
  vec2 ef = min(qf, 1.0 - qf); float wf = smoothstep(0.0, 0.04, min(ef.x, ef.y));
  vec3 sat = mix(uBase, mix(cf, cn4.rgb, wn), wf);
  /* under the trees near the spot: the forest floor (leaf litter), not the crowns the satellite saw from above */
  if (uFloorR > 0.0) { float gr = clamp((2.0 * sat.g - sat.r - sat.b) / (sat.r + sat.g + sat.b + 0.01) * 6.0, 0.0, 1.0); sat = mix(sat, uFloor, gr * (1.0 - smoothstep(uFloorR * 0.45, uFloorR, length(vSpW.xz)))); }
  diffuseColor.rgb *= mix(uBase, sat * 1.12, uHasSat);${PV ? `
  /* v6.35 (preview): close up the satellite picture is a blur of 30-60 cm pixels - patches of damper and drier,
     barer and leafier ground at 0.3-6 m break it up (fading out by 70 m), so it doesn't look stretched */
  { vec2 gp = vSpW.xz; float gn = spN(gp * 0.17) * 0.5 + spN(gp * 0.55 + 7.3) * 0.3 + spN(gp * 2.1 + 3.1) * 0.2;
    float gk = 1.0 - smoothstep(25.0, 70.0, distance(cameraPosition.xz, vSpW.xz));
    diffuseColor.rgb *= mix(1.0, 0.78 + gn * 0.44, gk); }` : ''} }`);
      };
      if (V.NATURE && V.NATURE.groundDetail) {
        const det = { forest: 'litter', rainforest: 'litter', grass: 'dry', heath: 'heath', arid: 'gravel', sand: 'sand', riverbank: 'pebbles', swamp: 'soil', gibber: 'gibber', clay: 'soil', shore: 'pebbles' }[kindNow()] || 'soil';
        V.NATURE.groundDetail(THREE, gm, onRoad ? 'gravel' : det, ctx, { near: 2.5, far: 22, onLoad: () => V.kick() });
      }
      gm.customProgramCacheKey = () => 'sl-spot-ground' + (PV ? '-pv' : '');
      const gMesh = new THREE.Mesh(g, gm); gMesh.receiveShadow = true; gMesh.name = 'spot-ground'; scene.add(gMesh);

      // -- the sky reaches past the land; the haze starts well out --
      if (ctx.skyMesh) { const s = ctx.skyMesh; if (!s.geometry.boundingSphere) s.geometry.computeBoundingSphere(); s.scale.setScalar((extent * 2.4) / s.geometry.boundingSphere.radius); }
      ctx.farR = extent * 1.05; ctx.fogNear0 = Math.min(extent * 0.35, 260); if (scene.fog) { scene.fog.near = ctx.fogNear0; scene.fog.far = extent; }

      // -- road surfaces --
      const lift = (x, z) => 0.03 + 0.2 * sstep(20, 400, Math.hypot(x, z));
      const roadTex = (kind) => { // (asphalt: a wider picture so its painted lines are a real 10-15 cm, not a third of a metre)
        const S2 = 256, W = kind === 'asphalt' ? 256 : 128, k = W / 128, cv = document.createElement('canvas'); cv.width = W; cv.height = S2; const x = cv.getContext('2d'), rr = rng(kind.length * 31 + 7);
        const fill = { asphalt: [62, 63, 65], minor: [74, 73, 72], dirt: [146, 120, 92], path: [150, 130, 104] }[kind], soft = kind === 'dirt' || kind === 'path';
        x.fillStyle = `rgb(${fill})`; x.fillRect(0, 0, W, S2);
        for (let i = 0; i < 2600 * k; i++) { const v = (rr() - 0.5) * (soft ? 46 : 26); x.fillStyle = `rgba(${fill.map((c) => clamp(c + v, 0, 255) | 0)},0.9)`; x.fillRect(rr() * W, rr() * S2, 1 + rr() * 2.5, 1 + rr() * 2.5); }
        if (kind === 'dirt') { x.fillStyle = 'rgba(95,78,60,0.35)'; x.fillRect(26, 0, 16, S2); x.fillRect(86, 0, 16, S2); x.fillStyle = 'rgba(110,130,70,0.35)'; x.fillRect(58, 0, 12, S2); }
        if (kind === 'asphalt' || kind === 'minor') { x.fillStyle = 'rgba(0,0,0,0.10)'; x.fillRect(24 * k, 0, 20 * k, S2); x.fillRect(84 * k, 0, 20 * k, S2); } // (darker wheel tracks)
        if (kind === 'asphalt') {
          const yel = lon < -30; // (the Americas: a yellow centre line)
          x.fillStyle = 'rgba(232,232,222,0.9)'; x.fillRect(6, 0, 3, S2); x.fillRect(W - 9, 0, 3, S2);
          x.fillStyle = yel ? 'rgba(222,178,46,0.92)' : 'rgba(232,232,222,0.9)';
          if (yel) { x.fillRect(W / 2 - 4, 0, 3, S2); x.fillRect(W / 2 + 1, 0, 3, S2); } else x.fillRect(W / 2 - 2, 0, 4, S2 * 0.3);
        }
        if (soft) { const d = x.getImageData(0, 0, W, S2); for (let j = 0; j < S2; j++) for (let i = 0; i < W; i++) { const u = Math.abs(i / (W - 1) - 0.5) * 2; d.data[(j * W + i) * 4 + 3] = 255 * (1 - sstep(0.45, 1, u)); } x.putImageData(d, 0, 0); } // (soft edges into the picture)
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, maxAniso); track(t); return t;
      };
      const mats = {}, rMat = (kind, off) => mats[kind] || (mats[kind] = (() => {
        const m = new THREE.MeshStandardMaterial({ map: roadTex(kind), roughness: kind === 'asphalt' || kind === 'minor' ? 0.82 : 0.97, metalness: 0, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: off, transparent: kind === 'path' || kind === 'dirt', depthWrite: !(kind === 'path' || kind === 'dirt'), opacity: kind === 'path' ? 0.5 : kind === 'dirt' ? 0.6 : 1, envMapIntensity: 0.5 });
        if (V.NATURE && V.NATURE.groundDetail) { V.NATURE.groundDetail(THREE, m, kind === 'dirt' || kind === 'path' ? 'soil' : 'gravel', ctx, { near: 1.5, far: 14 }); m.customProgramCacheKey = () => 'sl-spot-road'; }
        track(m); return m; })());
      const ribbon = (pts, w, step, yOf, vScale) => { // a strip w wide along pts, its points on the land (every ~2.5 m across too)
        const P = [], UV = [], I = [], K = clamp(Math.ceil(w / 2.5), 1, 8); let along = 0;
        const dense = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), r = Math.min(Math.hypot(a[0], a[1]), Math.hypot(b[0], b[1])), s = r < 60 ? step : r < 300 ? step * 3 : step * 8, n = Math.max(1, Math.ceil(L / s)); for (let k = 0; k < n; k++) dense.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
        dense.push(pts[pts.length - 1]);
        for (let i = 0; i < dense.length; i++) {
          const p = dense[i], q0 = dense[Math.max(0, i - 1)], q1 = dense[Math.min(dense.length - 1, i + 1)];
          let tx = q1[0] - q0[0], tz = q1[1] - q0[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
          if (i) along += Math.hypot(p[0] - dense[i - 1][0], p[1] - dense[i - 1][1]);
          const nx = -tz * w / 2, nz = tx * w / 2;
          for (let j = 0; j <= K; j++) { const s = (j / K) * 2 - 1, x = p[0] + nx * s, z = p[1] + nz * s; P.push(x, yOf(x, z), z); UV.push(j / K, along / vScale); }
          if (i) for (let j = 0; j < K; j++) { const o = (i - 1) * (K + 1) + j, o2 = o + K + 1; I.push(o, o + 1, o2, o + 1, o2 + 1, o2); } // (facing up)
        }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); geo.setIndex(I); geo.computeVertexNormals(); return geo;
      };
      const clip = (pts) => pts.filter((p) => Math.abs(p[0]) < extent * 0.9 && Math.abs(p[1]) < extent * 0.9);
      for (const r of roads) {
        const kind = r.paved ? (r.major ? 'asphalt' : 'minor') : r.path ? 'path' : 'dirt', pts = clip(r.pts); if (pts.length < 2) continue;
        const geo = ribbon(pts, r.w, 1.5, (x, z) => Tg(x, z) + lift(x, z), kind === 'asphalt' ? 12 : 8);
        const m = new THREE.Mesh(geo, rMat(kind, r.major ? -6 : r.path ? -2 : -4)); m.receiveShadow = true; m.name = 'spot-road'; m.renderOrder = r.path ? 1 : 2; scene.add(m);
      }
      // -- water: lakes and ponds (flat, at their lowest shore), rivers and streams along the land --
      const rip = (() => { const S2 = 128, cv = document.createElement('canvas'); cv.width = cv.height = S2; const x = cv.getContext('2d'), id = x.createImageData(S2, S2), rr = rng(41), w = [];
        for (let k = 0; k < 7; k++) w.push([rr() * TAU, 1 + Math.floor(rr() * 4), 1 + Math.floor(rr() * 4), rr() * TAU]);
        for (let j = 0; j < S2; j++) for (let i = 0; i < S2; i++) { let dx = 0, dy = 0; for (const [, a, b, ph] of w) { const t = TAU * (a * i + b * j) / S2 + ph, c = Math.cos(t) * 0.12; dx += c * a; dy += c * b; } const o = (j * S2 + i) * 4; id.data[o] = 128 + clamp(dx * 40, -127, 127); id.data[o + 1] = 128 + clamp(dy * 40, -127, 127); id.data[o + 2] = 255; id.data[o + 3] = 255; }
        x.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; track(t); return t; })();
      const wm = new THREE.MeshStandardMaterial({ color: '#3f6873', roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.86, envMapIntensity: 1.7, normalMap: rip, normalScale: new THREE.Vector2(0.35, 0.35), polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -3 }); track(wm);
      for (const w of waters) {
        const o = w.o, lv = w.lv;
        if (o.length < 4) continue;
        const shape = o.slice(0, -1).map((p) => new THREE.Vector2(p[0], p[1])), holes = w.holes.map((h) => h.slice(0, -1).map((p) => new THREE.Vector2(p[0], p[1])));
        if (THREE.ShapeUtils.isClockWise(shape)) shape.reverse();
        let tri; try { tri = THREE.ShapeUtils.triangulateShape(shape, holes); } catch (e) { continue; }
        const all = shape.concat(...holes), P = [], UVw = []; for (const v of all) { P.push(v.x, lv + 0.06, v.y); UVw.push(v.x / 5, v.y / 5); }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UVw, 2)); geo.setIndex(tri.flat()); geo.computeVertexNormals();
        if (geo.attributes.normal.getY(0) < 0) { const idx = geo.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; } geo.computeVertexNormals(); }
        const m = new THREE.Mesh(geo, wm); m.renderOrder = 3; m.receiveShadow = true; m.name = 'spot-water'; scene.add(m);
      }
      for (const s of streams) {
        const pts = clip(s.pts); if (pts.length < 2) continue;
        const geo = ribbon(pts, s.w, 1.5, (x, z) => Tg(x, z) + 0.06 + 0.1 * sstep(25, 400, Math.hypot(x, z)), 10);
        const m = new THREE.Mesh(geo, s.dry ? rMat('dirt', -3) : wm); m.renderOrder = 3; m.name = 'spot-stream'; scene.add(m);
      }

      // -- plants where the satellite picture shows them, of the kind the land cover says --
      const kind = kindNow(); let isDry = /^(arid|sand|gibber|clay)$/.test(kind);
      let pix = null, pw = 0, pScale = 0, pOx = 0, pOz = 0;
      if (mN) { try { const x = mN.cv.getContext('2d', { willReadFrequently: true }); pw = mN.cv.width; pix = x.getImageData(0, 0, pw, pw).data; const n = 2 ** mN.z; pScale = pw / ((mN.N / n) * Wm); pOx = (mN.tx0 / n - X0) * Wm; pOz = (mN.ty0 / n - Y0) * Wm; } catch (e) { pix = null; } }
      const px = (x, z) => { if (!pix) return null; const i = Math.floor((x - pOx) * pScale), j = Math.floor((z - pOz) * pScale); if (i < 1 || j < 1 || i >= pw - 1 || j >= pw - 1) return null; const o = (j * pw + i) * 4; return pix[o + 3] > 200 ? [pix[o], pix[o + 1], pix[o + 2]] : null; };
      // the mean brightness round the spot (a dark bush on pale desert is darker than it)
      let meanL = 0.4; { let s = 0, c = 0; for (let i = 0; i < 400; i++) { const q = px((R() - 0.5) * 120, (R() - 0.5) * 120); if (q) { s += pixLum(q[0], q[1], q[2]); c++; } } if (c) meanL = s / c; }
      { let e = 0, c = 0; for (let i = 0; i < 400; i++) { const q = px((R() - 0.5) * 160, (R() - 0.5) * 160); if (q) { if (pixExg(q[0], q[1], q[2]) < 0.025 && pixLum(q[0], q[1], q[2]) > 0.33) e++; c++; } } if (c && e / c > 0.55 && !/^(forest|rainforest|swamp)$/.test(kind)) isDry = true; } // (pale land with little green, e.g. sagebrush desert: bushes, not trees)
      const vegR = low ? 120 : phone ? 170 : 240, spacing = isDry ? 3.2 : 4.2, trees = [], shrubs = [], conif = clamp((Math.abs(lat) - 38) / 22, 0, 0.75) + (h0 > 1300 ? 0.3 : 0), cap = low ? 700 : phone ? 1300 : 2600;
      const treeOK = (x, z, need) => dist2snake(x, z) > need && !inWater(x, z) && roadDist(x, z) > 1.2;
      if (pix) {
        // candidates on a jittered grid, nearest first (so a cap on the number only thins the far edge)
        const cand = [];
        for (let gz = -vegR; gz <= vegR; gz += spacing) for (let gx = -vegR; gx <= vegR; gx += spacing) { const x = gx + (R() - 0.5) * spacing * 0.9, z = gz + (R() - 0.5) * spacing * 0.9, r = Math.hypot(x, z); if (r <= vegR) cand.push([x, z, r]); }
        cand.sort((p, q) => p[2] - q[2]);
        const forestish = /^(forest|rainforest|swamp|riverbank)$/.test(kind), step = 1.6 / pScale;
        for (const [x, z] of cand) {
          if (trees.length + shrubs.length > cap) break;
          if (R() < sstep(vegR * 0.5, vegR, Math.hypot(x, z)) * 0.92) continue;
          const c = px(x, z); if (!c) continue;
          const L = pixLum(c[0], c[1], c[2]), E = pixExg(c[0], c[1], c[2]);
          // a tree crown is green and rough (its own shadows) in the picture; a lawn or field is smooth
          let v = 0; for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) { const q = px(x + dx, z + dz); if (q) v += Math.abs(pixLum(q[0], q[1], q[2]) - L); }
          const rough = v / 4 > 0.035;
          const canopy = (E > 0.035 && L < 0.32) || (L < 0.16 && c[1] >= c[0] * 0.92 && c[1] >= c[2] * 0.95) || (E > 0.0 && L < 0.5 && rough && (forestish || E > 0.02)) || (forestish && E > -0.02 && L < 0.4);
          if (!isDry && canopy) { if (R() < 0.85 && treeOK(x, z, 3)) trees.push({ x, z, c, con: R() < conif }); }
          else if (isDry && L < meanL * 0.74 && L < 0.42) { if (R() < 0.8 && treeOK(x, z, 1.2)) shrubs.push({ x, z, c }); }
          else if (!isDry && kind === 'heath' && L < meanL * 0.82 && E > -0.02) { if (R() < 0.35 && treeOK(x, z, 1.5)) shrubs.push({ x, z, c }); }
        }
      }
      for (const [x, z] of treeNodes) if (Math.hypot(x, z) < vegR && treeOK(x, z, 2.5)) trees.push({ x, z, c: px(x, z) || [70, 100, 60], con: false });
      if (!pix && /^(forest|rainforest)$/.test(kind)) for (let i = 0; i < 600; i++) { const a = R() * TAU, r = 6 + Math.sqrt(R()) * vegR, x = Math.cos(a) * r, z = Math.sin(a) * r; if (treeOK(x, z, 3)) trees.push({ x, z, c: [60, 90, 50], con: R() < conif }); }
      const occ = ctx.occ = [];
      plantTrees(scene, trees, kind, Tg, occ, track);
      plantShrubs(scene, shrubs, kind, Tg, occ, track);
      // -- low plants and stones right round the snake (where the ground is not road or water) --
      groundCover(scene, kind, Tg, dist2snake, roadDist, inWater, F, Rb, low, track, px);

      // -- the spot itself: a ring at the accuracy, a soft light beam seen from far off (not for a hidden location:
      // its point is not the real spot, so nothing marks it as one) --
      if (!obsc && acc > 1.5 && acc < extent * 0.8) {
        const n = 96, pts = []; for (let i = 0; i <= n; i++) { const a = (i / n) * TAU; pts.push([Math.cos(a) * acc, Math.sin(a) * acc]); }
        const geo = ribbon(pts, clamp(acc * 0.025, 0.1, 4), 1e9, (x, z) => Tg(x, z) + 0.08 + 0.1 * sstep(25, 400, acc), 1);
        const rm = new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -8, fog: false });
        ring = new THREE.Mesh(geo, rm); ring.renderOrder = 5; ring.name = 'spot-ring'; scene.add(ring);
      }
      if (!obsc) { const hgt = 60, geo = new THREE.CylinderGeometry(0.35, 0.35, hgt, 20, 8, true), col = [], gp = geo.attributes.position;
        for (let i = 0; i < gp.count; i++) { const k = 1 - (gp.getY(i) + hgt / 2) / hgt; col.push(1, 1, 1, k * k * 0.8); }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); geo.translate(0, hgt / 2, 0);
        const bm = new THREE.MeshBasicMaterial({ color: '#ffd23f', vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
        beam = new THREE.Mesh(geo, bm); beam.renderOrder = 6; beam.name = 'spot-beam'; beam.frustumCulled = false; scene.add(beam); }

      pix = null; // (the picture's pixels are let go)
      const notes = [];
      if (!mN && !mF) notes.push('Without the satellite pictures the ground is plain.');
      if (!mD) notes.push('Without the land height the land is drawn flat.');
      if (!osm) notes.push('Roads and water couldn\'t load just now, so any there are not shown.');
      if (notes.length) notes.unshift('This is not the full scene.');
      status(notes.join(' '));
      layers({ sat: !!(mN || mF), dem: !!mD, osm: !!osm });
      built = { roads: roads.length, waters: waters.length, streams: streams.length, trees: trees.length, trees40: trees.filter((t) => Math.hypot(t.x, t.z) < 40).length, shrubs: shrubs.length, extent, onRoad, kind, why: S.pick && S.pick.why, zNear: mN ? mN.z : null, zFar: mF ? mF.z : null, dem: !!mD, osm: !!osm };
      if (window.SL_3D_TEST) window.__slSpot = built;
    }
    // plants that stand between the camera and the spot (or right in front of the lens) step aside, so the spot is never
    // hidden in a forest; checked only when the camera has moved
    const lastCam = new THREE.Vector3(1e9, 0, 0), od = new THREE.Vector3(), ov = new THREE.Vector3(), zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
    function clearView(cam, t, d) {
      if (!plants.length || cam.position.distanceToSquared(lastCam) < 0.01) return; lastCam.copy(cam.position);
      od.subVectors(t, cam.position); const len2 = od.lengthSq(), wide = Math.max(0.6, d * 0.1), dirty = new Set();
      for (const o of plants) {
        ov.subVectors(o.c, cam.position); const tt = ov.dot(od) / len2;
        let hide = ov.length() < o.r * 1.3 + 0.5;
        if (!hide && tt > 0.01 && tt < 1.08) { const perp = ov.addScaledVector(od, -tt).length(); hide = perp < o.r + wide * Math.min(1, tt * 1.4) + o.h * 0.25; }
        if (hide === o.hid) continue; o.hid = hide;
        o.ims.forEach((im, k) => { im.setMatrixAt(o.is ? o.is[k] : o.i, hide ? zeroM : o.ms[k]); dirty.add(im); });
      }
      dirty.forEach((im) => { im.instanceMatrix.needsUpdate = true; });
    }
    function kindNow() { return (V.P && V.P.scene && V.P.scene.kind) || 'grass'; }

    // ---- hooks ----
    return {
      onBuild() {
        const ctx = V.ctx; if (!ctx || !ctx.scene) return;
        // the real sun for that moment (by day), and night if it was seen after dark
        const aim = () => {
          if (!sun || sun.el < 0.02 || !ctx.sun) return;
          const e = clamp(sun.el, 0.17, 1.2), len = ctx.sun.position.length();
          ctx.sun.position.set(Math.sin(sun.az) * Math.cos(e), Math.sin(e), -Math.cos(sun.az) * Math.cos(e)).multiplyScalar(len);
          ctx.sunAz = Math.atan2(ctx.sun.position.z, ctx.sun.position.x); if (ctx.paintSky) ctx.paintSky(); V.kick();
        };
        aim(); if (ctx.envReady) ctx.envReady.then(aim);
        if (first) {
          first = false; if (sun && sun.el < -0.05 && V.dayNight && V.dayNight.set) { V.dayNight.set(true, true); if (lampB) lampSet(true); }
          wantView = true; // (a lower first view than the plain viewer's, so the real place shows behind the snake: camera(), below)
        }
      },
      limits(info) { info.dMax = Math.max(info.dMax, extent * 0.45); },
      camera(cam, t) {
        if (wantView && built && V.info && V.view) { wantView = false; V.view(Object.assign({ el: (14 * Math.PI) / 180, d: V.info.dFit * 1.35 }, firstAz != null ? { az: firstAz } : {})); }
        if (terrH) { // never under the land
          const g = terrH(cam.position.x, cam.position.z) + Math.max(0.03, cam.position.distanceTo(t) * 0.02); // (a few cm: close views of a small snake stay low)
          if (cam.position.y < g) { cam.position.y = g; cam.lookAt(t); }
        }
        cam.far = Math.max(cam.far, extent * 3); cam.updateProjectionMatrix();
        const d = cam.position.distanceTo(t);
        if (grassMesh) grassMesh.visible = d < 32;
        clearView(cam, t, d);
        if (beam) beam.material.opacity = 0.5 * sstep(8, 40, d);
        if (beam) beam.scale.set(Math.max(0.6, d / 110), Math.max(0.4, d / 80), Math.max(0.6, d / 110));
        if (label) {
          const show = d > 4.5; label.hidden = !show;
          if (show) { cam.updateMatrixWorld(); const p = new THREE.Vector3(0, Math.max(1.2, d * 0.09), 0).project(cam), w = st.clientWidth, h = st.clientHeight;
            const vis = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1; label.style.visibility = vis ? '' : 'hidden';
            label.style.transform = `translate(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px) translate(-50%, -100%)`; }
        }
      },
      dispose() { S.dispose(); lampB && lampB.remove(); card && card.remove(); label && label.remove(); credit && credit.remove(); bArea && bArea.remove(); const c = V.ctx; if (c && c.ground === ground) delete c.ground; terrH = null; },
      get info() { return built; },
    };
  }
  return S;

  // ---------------------------------------------------------------------------------------------------- plants
  function leafTex(THREE, track, seed, dark) {
    const S2 = 256, cv = document.createElement('canvas'); cv.width = cv.height = S2; const x = cv.getContext('2d'), r = rng(seed);
    x.fillStyle = dark ? '#7b7b7b' : '#8a8a8a'; x.fillRect(0, 0, S2, S2);
    for (let i = 0; i < 2200; i++) { const v = 90 + r() * 150 | 0; x.fillStyle = `rgb(${v},${v},${v})`; const a = r() * TAU, l = 3 + r() * 7; x.beginPath(); x.ellipse(r() * S2, r() * S2, l, l * 0.45, a, 0, TAU); x.fill(); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; track(t); return t;
  }
  function blob(THREE, detail, seed, squash) {
    const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, r = rng(seed), k = [];
    for (let i = 0; i < 6; i++) k.push([r() * 6, r() * 6, r() * 6, 0.12 + r() * 0.1]);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); let s = 1; for (const q of k) s += Math.sin(x * 3.1 + q[0]) * Math.sin(y * 2.7 + q[1]) * Math.sin(z * 2.9 + q[2]) * q[3]; p.setXYZ(i, x * s, y * s * squash, z * s); }
    g.computeVertexNormals(); return g;
  }
  // a picture of a spray of leaves (or of needles), grey so each tree's own colour tints it, cut out round the edge
  function sprayTex(THREE, track, seed, needles) {
    const S2 = 256, cv = document.createElement('canvas'); cv.width = cv.height = S2; const x = cv.getContext('2d'), r = rng(seed);
    for (let i = 0; i < (needles ? 900 : 1000); i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * S2 * 0.42, px = S2 / 2 + Math.cos(a) * d, py = S2 / 2 + Math.sin(a) * d * 0.9, v = 150 + r() * 95 | 0;
      x.fillStyle = x.strokeStyle = `rgb(${v},${v},${v})`;
      if (needles) { const an = r() * TAU, l = 8 + r() * 14; x.lineWidth = 1.6; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(an) * l, py + Math.sin(an) * l); x.stroke(); }
      else { const l = 3.5 + r() * 4.5; x.beginPath(); x.ellipse(px, py, l, l * 0.48, r() * TAU, 0, TAU); x.fill(); }
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; track(t); return t;
  }
  // a crown: a solid core (so it never looks hollow) wrapped in sprays of leaves facing outwards, lit as one round mass
  function crownGeo(THREE, conifer, seed) {
    const r = rng(seed), P = [], N = [], UV = [], I = []; let n = 0;
    const core = conifer ? new THREE.ConeGeometry(0.62, 1, 9, 2) : new THREE.IcosahedronGeometry(0.72, 1);
    if (conifer) core.translate(0, 0.5, 0); else { core.scale(1, 0.85, 1); core.translate(0, 0.55, 0); }
    const cp = core.attributes.position, cn = core.attributes.normal;
    for (let i = 0; i < cp.count; i++) { P.push(cp.getX(i), cp.getY(i), cp.getZ(i)); N.push(cn.getX(i), cn.getY(i), cn.getZ(i)); UV.push(0.5, 0.5); }
    const ci = core.index ? core.index.array : [...Array(cp.count).keys()]; for (const v of ci) I.push(v); n = cp.count; const coreN = I.length; core.dispose();
    const q = new THREE.Quaternion(), m = new THREE.Matrix4(), v = new THREE.Vector3(), nr = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const cards = conifer ? 30 : 34;
    for (let k = 0; k < cards; k++) {
      let cx, cy, cz;
      if (conifer) { const y = 0.08 + r() * 0.86, rad = (1 - y) * 0.68 + 0.04, a = r() * TAU; cx = Math.cos(a) * rad; cz = Math.sin(a) * rad; cy = y; nr.set(cx, 0.35, cz).normalize(); }
      else { const a = r() * TAU, e = Math.asin(r() * 1.6 - 0.6), rad = 0.78 + r() * 0.2; cx = Math.cos(a) * Math.cos(e) * rad; cz = Math.sin(a) * Math.cos(e) * rad; cy = 0.55 + Math.sin(e) * rad * 0.85; nr.set(cx, cy - 0.55, cz).normalize(); }
      const sz = conifer ? 0.42 + r() * 0.2 : 0.62 + r() * 0.3;
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nr); const tw = new THREE.Quaternion().setFromAxisAngle(nr, r() * TAU); q.premultiply(tw);
      m.compose(v.set(cx, cy, cz), q, new THREE.Vector3(sz, sz, sz));
      const base = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
      for (const [bx, by] of base) { const w = new THREE.Vector3(bx, by, 0).applyMatrix4(m); P.push(w.x, w.y, w.z); const nn = new THREE.Vector3(w.x, conifer ? (w.y - 0.3) * 0.5 : w.y - 0.55, w.z).normalize().lerp(up, 0.25).normalize(); N.push(nn.x, nn.y, nn.z); UV.push(bx + 0.5, by + 0.5); }
      I.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I);
    g.addGroup(0, coreN, 0); g.addGroup(coreN, I.length - coreN, 1); return g;
  }
  function plantTrees(scene, trees, kind, Tg, occ, track) {
    const THREE = TH; if (!THREE || !trees.length) return;
    if (preview()) { plantTreesPv(scene, trees, kind, Tg, track); return; } // v6.35 (preview "spot"): trees of many shapes
    const leafT = sprayTex(THREE, track, 11, false), needT = sprayTex(THREE, track, 12, true);
    const coreM = new THREE.MeshStandardMaterial({ color: '#b4b8ac', roughness: 0.95, metalness: 0, envMapIntensity: 0.3 }); track(coreM);
    const leafM = new THREE.MeshStandardMaterial({ map: leafT, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, envMapIntensity: 0.35 }); track(leafM); bothSides(leafM);
    const needM = new THREE.MeshStandardMaterial({ map: needT, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, envMapIntensity: 0.35 }); track(needM); bothSides(needM);
    const barkM = new THREE.MeshStandardMaterial({ color: '#4a3b2e', roughness: 1, metalness: 0 }); track(barkM);
    const crownB = crownGeo(THREE, false, 5), crownC = crownGeo(THREE, true, 7);
    const trunk = new THREE.CylinderGeometry(0.6, 1, 1, 7, 1, true); trunk.translate(0, 0.5, 0);
    track(crownB); track(crownC); track(trunk);
    const groups = { b: [], c: [] }; for (const t of trees) groups[t.con ? 'c' : 'b'].push(t);
    const tall = { forest: [9, 20], rainforest: [14, 30], grass: [4, 9], heath: [4, 9], riverbank: [7, 16], swamp: [8, 18] }[kind] || [6, 14];
    const r = rng(77), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color(), hsl = {};
    for (const key of ['b', 'c']) {
      const list = groups[key]; if (!list.length) continue;
      const cg = key === 'b' ? crownB : crownC, mats = [coreM, key === 'b' ? leafM : needM], nearList = [], farList = [];
      for (const t of list) (Math.hypot(t.x, t.z) < 30 ? nearList : farList).push(t);
      for (const [L, cast] of [[nearList, true], [farList, false]]) {
        if (!L.length) continue;
        const ci = new THREE.InstancedMesh(cg, mats, L.length), ti = new THREE.InstancedMesh(trunk, barkM, L.length);
        L.forEach((t, i) => {
          const h = tall[0] + r() * (tall[1] - tall[0]), wdt = key === 'b' ? h * (0.3 + r() * 0.14) : h * (0.2 + r() * 0.06), y = Tg(t.x, t.z) - 0.2;
          e.set((r() - 0.5) * 0.06, r() * TAU, (r() - 0.5) * 0.06); q.setFromEuler(e);
          const cy = key === 'b' ? h * 0.38 : h * 0.16;
          m4.compose(v.set(t.x, y + cy, t.z), q, s.set(wdt * (0.8 + r() * 0.4), h - cy, wdt * (0.8 + r() * 0.4))); ci.setMatrixAt(i, m4);
          const c = t.c; col.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace); col.getHSL(hsl);
          // (the colour of the canopy in the picture, made a living green: shadowed or hazy pixels are often grey or brown)
          col.setHSL(clamp(lerpN(hsl.h, key === 'b' ? 0.25 : 0.3, 0.5), 0.2, 0.34), clamp(hsl.s * 0.8 + 0.18, 0.28, 0.55), clamp(hsl.l * 0.9 + 0.12, 0.2, 0.36) * (0.88 + r() * 0.24)); ci.setColorAt(i, col);
          const tm = new THREE.Matrix4().compose(v.set(t.x, y, t.z), q, s.set(Math.max(0.1, h * 0.018), cy + h * 0.25, Math.max(0.1, h * 0.018))); ti.setMatrixAt(i, tm);
          { const cm = new THREE.Matrix4(); ci.getMatrixAt(i, cm); plants.push({ ims: [ci, ti], i, ms: [cm, tm.clone()], c: new THREE.Vector3(t.x, y + h * 0.55, t.z), r: wdt * 0.55, h, hid: false }); }
        });
        ci.instanceMatrix.needsUpdate = true; if (ci.instanceColor) ci.instanceColor.needsUpdate = true; ti.instanceMatrix.needsUpdate = true;
        ci.castShadow = ti.castShadow = cast; ci.receiveShadow = ti.receiveShadow = cast; ci.name = 'spot-trees'; ti.name = 'spot-trunks';
        ci.computeBoundingSphere(); ti.computeBoundingSphere();
        scene.add(ci, ti);
      }
    }
  }
  // v6.35 (preview "spot", Eduardo to approve): a forest that isn't one tree copied - three crown shapes of different
  // fullness, trunks of their own thickness, lean, colour and flared base, a few limbs reaching into each near crown,
  // foliage of its own size, and a soft dark patch on the ground under each near tree (its contact shadow)
  function plantTreesPv(scene, trees, kind, Tg, track) {
    const THREE = TH;
    const leafTs = [sprayTex(THREE, track, 11, false), sprayTex(THREE, track, 19, false)], needT = sprayTex(THREE, track, 12, true);
    const coreM = new THREE.MeshStandardMaterial({ color: '#b4b8ac', roughness: 0.95, metalness: 0, envMapIntensity: 0.3 }); track(coreM);
    const leafMs = leafTs.map((lt) => { const m = new THREE.MeshStandardMaterial({ map: lt, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, envMapIntensity: 0.35 }); track(m); bothSides(m); return m; });
    const needM = new THREE.MeshStandardMaterial({ map: needT, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, envMapIntensity: 0.35 }); track(needM); bothSides(needM);
    const barkM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0 }); track(barkM);
    // a trunk that widens into its roots at the foot and narrows to the top (lathe: radius by height)
    const trunk = new THREE.LatheGeometry([[1.45, 0], [1.15, 0.025], [1.0, 0.08], [0.86, 0.4], [0.7, 0.8], [0.55, 1]].map(([r, y]) => new THREE.Vector2(r * 0.5, y)), 8); track(trunk);
    // four limbs from the top of the trunk, up and out into the crown (unit size: scaled with the crown)
    const limbs = (() => { const parts = []; for (let k = 0; k < 4; k++) { const c = new THREE.CylinderGeometry(0.018, 0.035, 1, 5, 1, true); c.translate(0, 0.5, 0); c.rotateZ(0.75 + (k % 2) * 0.25); c.rotateY((k / 4) * TAU + 0.4); parts.push(c); }
      const P = [], N = [], I = []; let n = 0; for (const c of parts) { const pa = c.attributes.position, na = c.attributes.normal; for (let q = 0; q < pa.count; q++) { P.push(pa.getX(q), pa.getY(q), pa.getZ(q)); N.push(na.getX(q), na.getY(q), na.getZ(q)); } for (const v3 of c.index.array) I.push(v3 + n); n += pa.count; c.dispose(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I); track(g); return g; })();
    // three broadleaf crowns (round and full, tall and loose, wide and flat) and two conifers
    const crowns = { b: [crownGeo(THREE, false, 5), crownGeo(THREE, false, 17), crownGeo(THREE, false, 29)], c: [crownGeo(THREE, true, 7), crownGeo(THREE, true, 23)] };
    crowns.b[1].scale(0.85, 1.15, 0.85); crowns.b[2].scale(1.2, 0.75, 1.2); crowns.c[1].scale(0.8, 1.1, 0.8);
    for (const k in crowns) crowns[k].forEach(track);
    // contact shadows: a soft round dark patch (no light reaches the ground right under a tree)
    const shT = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(cv); track(t); return t; })();
    const shG = new THREE.PlaneGeometry(1, 1); shG.rotateX(-Math.PI / 2); track(shG);
    const shM = new THREE.MeshBasicMaterial({ map: shT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -4, color: '#000000', opacity: 1 }); track(shM);
    const tall = { forest: [9, 22], rainforest: [12, 32], grass: [4, 10], heath: [4, 9], riverbank: [7, 17], swamp: [8, 18] }[kind] || [6, 15];
    const r = rng(77), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color(), hsl = {};
    const bins = new Map(), bin = (key) => bins.get(key) || (bins.set(key, []), bins.get(key));
    for (const t of trees) { const con = !!t.con, sh = con ? (r() < 0.5 ? 0 : 1) : (r() * 3) | 0, lf = r() < 0.5 ? 0 : 1, nearT = Math.hypot(t.x, t.z) < 30; bin((con ? 'c' : 'b') + sh + (con ? '' : lf) + (nearT ? 'n' : 'f')).push(t); }
    const nearAll = [];
    bins.forEach((L, key) => {
      const con = key[0] === 'c', cg = crowns[con ? 'c' : 'b'][+key[1]], lm = con ? needM : leafMs[+(key[2] || 0)], cast = key.endsWith('n');
      const ci = new THREE.InstancedMesh(cg, [coreM, lm], L.length), ti = new THREE.InstancedMesh(trunk, barkM, L.length);
      L.forEach((t, i) => {
        // height: most trees middling, a few tall emergents (rainforest) or young ones
        const u = r(), h = tall[0] + (u < 0.12 ? 1 : u < 0.3 ? 0.15 * r() : 0.25 + 0.55 * r()) * (tall[1] - tall[0]), y = Tg(t.x, t.z) - 0.15;
        const wdt = con ? h * (0.17 + r() * 0.1) : h * (0.22 + r() * 0.28) * (u < 0.12 ? 1.25 : 1);
        e.set((r() - 0.5) * 0.14, r() * TAU, (r() - 0.5) * 0.14); q.setFromEuler(e);
        const cy = con ? h * (0.1 + r() * 0.12) : h * (0.3 + r() * 0.25);
        m4.compose(v.set(t.x, y + cy, t.z), q, s.set(wdt * (0.75 + r() * 0.5), (h - cy) * (0.85 + r() * 0.3), wdt * (0.75 + r() * 0.5))); ci.setMatrixAt(i, m4);
        const c = t.c; col.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace); col.getHSL(hsl);
        col.setHSL(clamp(lerpN(hsl.h, con ? 0.3 : 0.25, 0.5) + (r() - 0.5) * 0.05, 0.18, 0.36), clamp(hsl.s * 0.8 + 0.14 + (r() - 0.5) * 0.12, 0.22, 0.58), clamp(hsl.l * 0.9 + 0.13, 0.2, 0.4) * (0.82 + r() * 0.36)); ci.setColorAt(i, col);
        const tr = h * (0.012 + r() * 0.016) * (u < 0.12 ? 1.5 : 1), tm = new THREE.Matrix4().compose(v.set(t.x, y, t.z), q, s.set(Math.max(0.08, tr), cy + h * 0.22, Math.max(0.08, tr))); ti.setMatrixAt(i, tm);
        // bark: grey-brown, some pale (lichen-covered rainforest trunks), some dark and wet
        col.setHSL(0.07 + r() * 0.05, 0.1 + r() * 0.14, kind === 'rainforest' && r() < 0.35 ? 0.4 + r() * 0.12 : 0.2 + r() * 0.16, THREE.SRGBColorSpace); ti.setColorAt(i, col);
        const cm = new THREE.Matrix4(); ci.getMatrixAt(i, cm); const pe = { ims: [ci, ti], i, is: [i, i], ms: [cm, tm.clone()], c: new THREE.Vector3(t.x, y + h * 0.55, t.z), r: wdt * 0.55, h, hid: false }; plants.push(pe);
        if (cast) nearAll.push({ x: t.x, z: t.z, y: y + cy * 0.92, w: wdt, tr, q: q.clone(), con, g: Tg(t.x, t.z), pe });
      });
      ci.instanceMatrix.needsUpdate = true; if (ci.instanceColor) ci.instanceColor.needsUpdate = true; ti.instanceMatrix.needsUpdate = true; if (ti.instanceColor) ti.instanceColor.needsUpdate = true;
      ci.castShadow = ti.castShadow = cast; ci.receiveShadow = ti.receiveShadow = cast; ci.name = 'spot-trees'; ti.name = 'spot-trunks';
      ci.computeBoundingSphere(); ti.computeBoundingSphere(); scene.add(ci, ti);
    });
    if (!nearAll.length) return;
    const bl = nearAll.filter((t) => !t.con), li = bl.length ? new THREE.InstancedMesh(limbs, barkM, bl.length) : null;
    bl.forEach((t, i) => { m4.compose(v.set(t.x, t.y, t.z), t.q, s.set(t.w * 0.5, t.w * 0.45, t.w * 0.5)); li.setMatrixAt(i, m4); t.pe.ims.push(li); t.pe.is.push(i); t.pe.ms.push(m4.clone()); col.setHSL(0.07, 0.14, 0.24 + r() * 0.1, THREE.SRGBColorSpace); li.setColorAt(i, col); });
    if (li) { li.instanceMatrix.needsUpdate = true; if (li.instanceColor) li.instanceColor.needsUpdate = true; li.castShadow = true; li.name = 'spot-limbs'; li.computeBoundingSphere(); scene.add(li); }
    const si = new THREE.InstancedMesh(shG, shM, nearAll.length);
    nearAll.forEach((t, i) => { const d = Math.max(t.tr * 9, t.w * 0.45); m4.compose(v.set(t.x, t.g + 0.03, t.z), q.identity(), s.set(d, 1, d)); si.setMatrixAt(i, m4); });
    si.instanceMatrix.needsUpdate = true; si.renderOrder = 1; si.name = 'spot-contact'; si.computeBoundingSphere(); scene.add(si);
  }
  function lerpN(a, b, t) { return a + (b - a) * t; }
  // a spray's back is lit like its front (its normals point out of the crown, not out of the card)
  function bothSides(m) { m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', TH.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '')); }; m.customProgramCacheKey = () => 'sl-spot-leaf'; }
  function plantShrubs(scene, shrubs, kind, Tg, occ, track) {
    const THREE = TH; if (!THREE || !shrubs.length) return;
    const leaf = sprayTex(THREE, track, 23, false), g = crownGeo(THREE, false, 13); g.translate(0, -0.12, 0);
    const core = new THREE.MeshStandardMaterial({ color: '#9a9c8e', roughness: 0.95, metalness: 0 }), m = new THREE.MeshStandardMaterial({ map: leaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95, metalness: 0 }); bothSides(m); track(core); track(m); track(g);
    const im = new THREE.InstancedMesh(g, [core, m], shrubs.length), r = rng(31), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
    const dry = /^(arid|sand|gibber|clay)$/.test(kind);
    shrubs.forEach((t, i) => {
      const sz = dry ? 0.5 + r() * 1.1 : 0.7 + r() * 1.4; e.set(0, r() * TAU, 0); q.setFromEuler(e);
      m4.compose(v.set(t.x, Tg(t.x, t.z) - 0.05, t.z), q, s.set(sz * (0.9 + r() * 0.4), sz * (0.8 + r() * 0.5), sz * (0.9 + r() * 0.4))); im.setMatrixAt(i, m4);
      col.setRGB(t.c[0] / 255, t.c[1] / 255, t.c[2] / 255, THREE.SRGBColorSpace); const hsl = {}; col.getHSL(hsl);
      col.setHSL(dry ? clamp(hsl.h, 0.12, 0.3) : clamp(hsl.h, 0.16, 0.34), dry ? 0.16 + r() * 0.12 : clamp(hsl.s, 0.2, 0.5), dry ? 0.2 + r() * 0.08 : clamp(hsl.l * 1.2, 0.1, 0.3)); im.setColorAt(i, col);
      plants.push({ ims: [im], i, ms: [m4.clone()], c: new THREE.Vector3(t.x, Tg(t.x, t.z) + sz * 0.5, t.z), r: sz * 0.7, h: sz, hid: false });
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; im.name = 'spot-shrubs'; im.computeBoundingSphere(); scene.add(im);
  }
  // fallen leaves: a drawn leaf (cut out) on flat cards, brown and ochre with a few green ones, densest near the snake
  function leafLitter(scene, kind, Tg, dist2snake, roadDist, inWater, F, Rb, low, track) {
    const THREE = TH; if (!THREE) return;
    const PV0 = preview(), big = kind === 'rainforest', rad = Math.max(7, Rb * 6), want = low ? 1400 : phone ? 2800 : 5600, r = rng(61), pts = [];
    for (let i = 0; i < want * 2 && pts.length < want; i++) { const a = r() * TAU, d = Math.max(Rb * 0.3, 0.05) + Math.pow(r(), 1.6) * rad, x = Math.cos(a) * d, z = Math.sin(a) * d; if (dist2snake(x, z) < F.w0 * 0.9 + 0.01 || roadDist(x, z) < 0.2 || inWater(x, z)) continue; pts.push([x, z]); }
    if (!pts.length) return;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    x.fillStyle = '#d8d8d8'; x.beginPath(); x.moveTo(32, 3); x.bezierCurveTo(54, 18, 52, 46, 32, 61); x.bezierCurveTo(12, 46, 10, 18, 32, 3); x.fill();
    x.strokeStyle = 'rgba(90,90,90,0.55)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(32, 5); x.lineTo(32, 60); x.stroke();
    x.lineWidth = 0.8; for (let k = 0; k < 6; k++) { const y = 14 + k * 7.5; x.beginPath(); x.moveTo(32, y + 4); x.lineTo(20 + k * 0.6, y - 2); x.moveTo(32, y + 4); x.lineTo(44 - k * 0.6, y - 2); x.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; track(t);
    const g = new THREE.PlaneGeometry(0.62, 1); g.rotateX(-Math.PI / 2); track(g);
    const m = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.92, metalness: 0 }); track(m);
    const im = new THREE.InstancedMesh(g, m, pts.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    const pal = kind === 'swamp' ? ['#5a4a32', '#6b5a3a', '#4a4030', '#7a6a48'] : ['#7a5532', '#94683a', '#a8804a', '#5e4128', '#6f4f2c', '#b08850', '#4f3a22', '#8a7a3a'];
    pts.forEach(([px2, pz], i) => {
      const L = PV0 ? (big ? 0.045 : 0.03) + r() ** 1.7 * (big ? 0.17 : 0.09) : (big ? 0.08 : 0.05) + r() * r() * (big ? 0.18 : 0.09); e.set((r() - 0.5) * 0.35, r() * TAU, (r() - 0.5) * 0.35); q.setFromEuler(e); // (v6.35 preview: more small leaves and bits, the odd big one)
      m4.compose(v.set(px2, Tg(px2, pz) + 0.004 + r() * 0.012, pz), q, sc.set(PV0 ? L * (0.6 + r() * 0.6) : L, 1, L)); im.setMatrixAt(i, m4);
      col.set(r() < 0.06 ? '#5f7a34' : pal[(r() * pal.length) | 0]).multiplyScalar(PV0 ? 0.68 + r() * 0.6 : 0.8 + r() * 0.35); im.setColorAt(i, col);
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.receiveShadow = true; im.castShadow = false; im.name = 'spot-litter'; scene.add(im);
  }
  // grass tufts (grassland, woods, scrub, wetland) or stones (desert), only close to the snake
  function groundCover(scene, kind, Tg, dist2snake, roadDist, inWater, F, Rb, low, track, colAt) {
    const THREE = TH; if (!THREE) return;
    const r = rng(53), dry = /^(arid|sand|gibber|clay)$/.test(kind), rad = Math.max(14, Rb * 8), pts = [];
    const want = dry ? (low ? 900 : 2600) : kind === 'forest' || kind === 'rainforest' ? (low ? 120 : 360) : (low ? 700 : 2200);
    for (let i = 0; i < want * 3 && pts.length < want; i++) { const a = r() * TAU, d = (dry ? 0.05 : Math.max(Rb * 1.1, 0.4)) + (dry ? r() ** 1.7 : Math.sqrt(r())) * rad, x = Math.cos(a) * d, z = Math.sin(a) * d; if (dist2snake(x, z) < F.w0 * 2.5 + 0.06) continue; if (roadDist(x, z) < 0.25 || inWater(x, z)) continue; pts.push([x, z]); }
    if (!pts.length) return;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
    if (dry) {
      // (v6.35: one displacement per corner, from its position - each triangle used to move its own copy of a corner, so the stones came out cracked and spiky)
      const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x0 = p.getX(i), y0 = p.getY(i), z0 = p.getZ(i), k = 0.86 + (Math.abs(Math.sin(Math.round(x0 * 1e3) * 0.0129898 + Math.round(y0 * 1e3) * 0.078233 + Math.round(z0 * 1e3) * 0.037719) * 43758.5453) % 1) * 0.28; p.setXYZ(i, x0 * k, y0 * k * 0.6, z0 * k); } g.computeVertexNormals();
      const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0 }); track(g); track(m);
      const im = new THREE.InstancedMesh(g, m, pts.length);
      // v6.35 (audit: "the ground's stones are oversized next to the snake"): real desert pavement is pebbles a few
      // centimetres across with the odd stone of 10-20 cm - these were up to half a metre (boulders bigger than a taipan's
      // head, all pale); now many small ones in the gibber colours (dark grey and red-brown), a few bigger
      pts.forEach(([x, z], i) => { const sz = 0.005 + r() ** 2 * 0.025 + (r() < 0.03 ? 0.02 + r() * 0.04 : 0); e.set(r(), r() * TAU, r()); q.setFromEuler(e); m4.compose(v.set(x, Tg(x, z) + sz * 0.1, z), q, s.set(sz, sz * (0.6 + r() * 0.4), sz * (0.8 + r() * 0.4))); im.setMatrixAt(i, m4); if (r() < 0.5) col.setHSL(0.03 + r() * 0.05, 0.3 + r() * 0.2, 0.26 + r() * 0.16, THREE.SRGBColorSpace); else col.setHSL(0.58 + r() * 0.06, 0.05 + r() * 0.08, 0.24 + r() * 0.16, THREE.SRGBColorSpace); im.setColorAt(i, col); });
      im.castShadow = im.receiveShadow = true; im.name = 'spot-stones'; im.instanceMatrix.needsUpdate = true; scene.add(im); return;
    }
    // under trees: fallen leaves lying flat all round the snake (the forest floor, not bare earth)
    if (/^(forest|rainforest|swamp)$/.test(kind)) leafLitter(scene, kind, Tg, dist2snake, roadDist, inWater, F, Rb, low, track);
    // a tuft: three crossed blades cards with a drawn grass picture (cut out), swaying with the viewer's own wind
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const x = cv.getContext('2d'), rr = rng(9);
    for (let i = 0; i < 46; i++) { const bx = 10 + rr() * 108, h = 40 + rr() * 86, lean = (rr() - 0.5) * 40, v2 = 140 + rr() * 110 | 0; x.strokeStyle = `rgb(${v2},${v2},${v2})`; x.lineWidth = 0.9 + rr() * 1.4; x.beginPath(); x.moveTo(bx, 128); x.quadraticCurveTo(bx + lean * 0.3, 128 - h * 0.6, bx + lean, 128 - h); x.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; track(t);
    const card = new THREE.PlaneGeometry(1, 1); card.translate(0, 0.5, 0); const parts = [];
    for (let k = 0; k < 3; k++) { const c = card.clone(); c.rotateY((k / 3) * Math.PI); parts.push(c); }
    const P = [], N = [], UV = [], I = []; let n = 0; for (const c of parts) { const pa = c.attributes.position, ua = c.attributes.uv; for (let i = 0; i < pa.count; i++) { P.push(pa.getX(i), pa.getY(i), pa.getZ(i)); N.push(0, 1, 0); UV.push(ua.getX(i), ua.getY(i)); } for (const v3 of c.index.array) I.push(v3 + n); n += pa.count; c.dispose(); }
    card.dispose();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); track(g);
    let m = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95, metalness: 0 });
    if (NAT && NAT.vegetation) m = NAT.vegetation(THREE, m, { near: true });
    track(m);
    const im = new THREE.InstancedMesh(g, m, pts.length), hue = kind === 'heath' ? 0.16 : kind === 'swamp' ? 0.2 : 0.2;
    pts.forEach(([x2, z], i) => { const h = (kind === 'swamp' ? 0.5 : 0.14) + r() * (kind === 'swamp' ? 0.6 : 0.26); e.set(0, r() * TAU, 0); q.setFromEuler(e); m4.compose(v.set(x2, Tg(x2, z) - 0.01, z), q, s.set(h * 1.1, h, h * 1.1)); im.setMatrixAt(i, m4); const c = colAt && colAt(x2, z); if (c) { col.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace); const hs = {}; col.getHSL(hs); col.setHSL(clamp(hs.h, 0.1, 0.3) + (r() - 0.5) * 0.03, clamp(hs.s * 0.9 + 0.08, 0.14, 0.45), clamp(hs.l * 0.85 + 0.04, 0.16, 0.42)); } else col.setHSL(hue + (r() - 0.5) * 0.05, 0.25 + r() * 0.15, 0.26 + r() * 0.12); im.setColorAt(i, col); });
    im.receiveShadow = true; im.castShadow = !low; im.name = 'spot-grass'; grassMesh = im; im.instanceMatrix.needsUpdate = true; scene.add(im);
  }
}
function segD(x, z, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); }
function inPoly(x, z, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1] || 1e-12) + a[0]) c = !c; } return c; }

function css() {
  if (document.getElementById('spot-css')) return;
  const s = document.createElement('style'); s.id = 'spot-css';
  s.textContent = `
.spot-card{position:absolute;z-index:5;left:10px;bottom:40px;max-width:min(330px,calc(100% - 20px));box-sizing:border-box;border-radius:12px;background:rgba(251,253,249,.93);color:#183020;font:500 13px/1.4 Inter,system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.22);overflow:hidden}
[data-sl-theme="dark"] .spot-card{background:rgba(24,58,40,.93);color:#e3eedf}
.spot-card-t{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:38px;padding:8px 12px;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;text-align:left}
.spot-card-t b{font-weight:700;font-size:13.5px;color:#1f7a3a}[data-sl-theme="dark"] .spot-card-t b{color:#a8ef94}
.spot-card-ch{width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(-135deg);margin-top:4px;flex:none}
.spot-card.spot-shut .spot-card-ch{transform:rotate(45deg);margin-top:-4px}
.spot-card{display:flex;flex-direction:column;max-height:calc(100% - 64px)}.spot-card-t{flex:none}.spot-card-b{padding:0 12px 10px;overflow:auto;min-height:0}
.spot-pv .spot-card{bottom:58px;max-height:calc(100% - 110px)}.spot-card.spot-shut .spot-card-b{display:none}
.spot-card p{margin:0 0 4px}.spot-ph{display:block;width:100%;margin:0 0 8px;padding:0;border:0;border-radius:10px;overflow:hidden;background:#0b1710;cursor:zoom-in;position:relative;color:#fff}.spot-ph img{display:block;width:100%;height:150px;object-fit:cover}.spot-ph span{position:absolute;left:0;right:0;bottom:0;padding:14px 8px 5px;font:600 11.5px/1.3 Inter,system-ui,sans-serif;text-align:left;background:linear-gradient(transparent,rgba(0,0,0,.7))}.spot-ph:focus-visible{outline:3px solid #9be07c;outline-offset:2px}.spot-honest{font-size:11.5px;opacity:.8;line-height:1.4}.sl3d-ov:has(.sp3d-side:not([hidden]) img) .spot-ph{display:none}.spot-pl{font-weight:650}.spot-mut{opacity:.75}
.spot-acc{font-size:12.5px;opacity:.9}.spot-obsc{background:#fff2c4;color:#4a3a06;border-radius:8px;padding:6px 8px;opacity:1}
[data-sl-theme="dark"] .spot-obsc{background:#4a4010;color:#ffeeb0}
.spot-st{font-size:12px;color:#8a4b12}.spot-st[hidden]{display:none}[data-sl-theme="dark"] .spot-st{color:#ffc98a}
.spot-card-t:focus-visible{outline:3px solid #9be07c;outline-offset:-3px}
.spot-tzn{font-size:11.5px;opacity:.85}.spot-recon{font-weight:700}
.spot-miss{margin-left:auto;padding:1px 8px;border-radius:999px;background:#fbe3cc;color:#7a3c08;font-size:11.5px;font-weight:700;white-space:nowrap}.spot-miss[hidden]{display:none}[data-sl-theme="dark"] .spot-miss{background:#5a3410;color:#ffd9b0}
.spot-layers{margin:6px 0 4px;padding:6px 8px;border-radius:8px;background:rgba(31,122,58,.07)}[data-sl-theme="dark"] .spot-layers{background:rgba(255,255,255,.06)}
.spot-layers .spot-lh{font-size:11.5px;font-weight:700;margin:0 0 2px;opacity:.85}.spot-layers ul{list-style:none;margin:0;padding:0;font-size:12px;line-height:1.45}
.spot-ly span{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:1px;background:#9aa69a}
.spot-ly-ok span{background:#3d9a46}.spot-ly-no span{background:#d0661c}.spot-ly-no{font-weight:600;color:#8a4b12}[data-sl-theme="dark"] .spot-ly-no{color:#ffc98a}
.spot-ly-wait span{animation:spot-bl 1.2s ease-in-out infinite}@keyframes spot-bl{50%{opacity:.25}}@media (prefers-reduced-motion:reduce){.spot-ly-wait span{animation:none}}
.spot-retry{margin-top:6px;min-height:34px;padding:4px 12px;border-radius:999px;border:0;background:#2e7d32;color:#fff;font:600 12.5px/1.2 Inter,system-ui,sans-serif;cursor:pointer}.spot-retry[hidden]{display:none}.spot-retry:disabled{opacity:.7;cursor:progress}.spot-retry:focus-visible{outline:3px solid #9be07c;outline-offset:2px}
.spot-lamp{position:absolute;z-index:5;right:58px;bottom:10px;display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:4px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(12,26,18,.74);color:#fff;font:600 13px/1.2 Inter,system-ui,sans-serif;cursor:pointer}
.spot-lamp[aria-pressed=true]{background:#b5842a;border-color:#e0b45a}.spot-lamp:focus-visible{outline:3px solid #9be07c;outline-offset:2px}
/* v6.35 preview: the credits in the top corner, readable, away from the instructions at the bottom */
.spot-pv .spot-credit{top:8px;bottom:auto;right:8px;font-size:11px;max-width:min(470px,60%);background:rgba(255,255,255,.86)}
.spot-pv .sp3d-hint{max-width:calc(100% - 140px)}
@media (max-width:560px){.spot-pv .spot-credit{top:6px;bottom:auto;left:6px;right:6px;font-size:10.5px}.spot-pv .spot-lamp{bottom:58px;right:10px}.spot-pv .spot-card{bottom:106px;max-height:calc(100% - 150px)}}
.spot-pin{position:absolute;z-index:4;left:0;top:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;padding:4px 10px 5px;border-radius:10px;background:rgba(20,32,24,.82);color:#fff;font:700 12.5px/1.25 Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3);margin-top:-8px}
.spot-pin::after{content:"";position:absolute;left:50%;bottom:-6px;margin-left:-6px;border:6px solid transparent;border-bottom:0;border-top-color:rgba(20,32,24,.82)}
.spot-pin span{font-weight:500;font-size:11.5px;opacity:.85}.spot-pin[hidden]{display:none}
.spot-credit{position:absolute;z-index:4;right:8px;bottom:6px;margin:0;max-width:min(430px,44%);padding:2px 7px;border-radius:6px;background:rgba(255,255,255,.72);color:#2a3a2e;font:500 10px/1.35 Inter,system-ui,sans-serif;text-align:right}
.spot-credit a{color:inherit}
[data-sl-theme="dark"] .spot-credit{background:rgba(10,24,16,.7);color:#d5e6d2}
@media (max-width:560px){.spot-credit{font-size:9px;left:8px;right:8px;bottom:58px;max-width:none;text-align:center}.spot-card{left:6px;bottom:92px;font-size:12.5px}}
`;
  document.head.appendChild(s);
}
