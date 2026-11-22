// 3D venue map of Oleander Farms, Karjat, redrawn cleanly from the resort's map:
// flat-colour land, lakes, roads and car parks (assets/venue-map.jpg) over a height field
// (assets/venue-height.png), with every building as a 3D block (js/venue-data.js),
// labels for venues, rooms, food, parking and restrooms, and pins for the wedding's places.
//
// Map coordinates are pixels on the resort's map (2000 × 3000). The family panel stores each
// pin as {id, name, desc, color, x, y} in those units, with v: MAP_VERSION on the doc.
// A pin may also carry `sub` (a second line, e.g. which functions happen there).
//
//   const map = await createMap(el, { places, onSelect, onPick })
//   map.setPlaces(places); map.focus(id); map.setPickMode(true|false); map.resetView(); map.topView(); map.destroy()

import { FEATURES, GROUPS, TREES } from './venue-data.js?v=1';

const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const ORBIT_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
const TEX_URL = new URL('../assets/venue-map.jpg?v=4', import.meta.url).href;
const HEIGHT_URL = new URL('../assets/venue-height.png?v=2', import.meta.url).href;

export const MAP_VERSION = 2;
const PW = 2000, PH = 3000, S = 20;                 // plan px per world unit → world is 100 × 150
const LIFT = 1.9;                                    // world height of the land

export const DEFAULT_PLACES = [
  { id: 'ballroom', name: 'Banquet hall', desc: 'Oleander Farms Banquet, right at the main entrance.', color: '#8e3a5d', x: 712, y: 66 },
  { id: 'lawn', name: 'Garden lawn', desc: 'Oleander Farms Garden, the big lawn in South Nest.', color: '#3d8b4e', x: 942, y: 1135 },
  { id: 'lake', name: 'The Lake Side', desc: 'On the water\'s edge, at the far end. Walk or take a buggy along the road past the cottages, then down the boardwalk.', color: '#2f6fb3', x: 1612, y: 2846 },
  { id: 'parking', name: 'Entrance & parking', desc: 'Come in through Gate 1 or Gate 2. The car park is just inside, on the left.', color: '#5b5550', x: 625, y: 503 },
  { id: 'lobby', name: 'Concierge', desc: 'Help desk for keys, luggage, buggies and lost & found.', color: '#c99a5b', x: 908, y: 950 },
];

// Look of each kind of building/spot.
const KIND = {
  venue:   { roof: '#8e3a5d', body: '#fff8ef', chip: '#ffffff', ink: '#6d2745', pri: 4, icon: '' },
  'room-pl': { roof: '#c8553d', body: '#fffaf2', chip: '#c8553d', ink: '#fff', pri: 5 },
  'room-pp': { roof: '#4f4440', body: '#f6f1ea', chip: '#4f4440', ink: '#fff', pri: 5 },
  'room-lv': { roof: '#7f8c99', body: '#f7f7f5', chip: '#5f6c79', ink: '#fff', pri: 5 },
  cottage: { roof: '#8b5a2b', body: '#fff6e8', chip: '#8b5a2b', ink: '#fff', pri: 5 },
  food:    { roof: '#c99a5b', body: '#fffaf0', chip: '#ffffff', ink: '#8a5a1c', pri: 3, icon: '🍽 ' },
  spot:    { roof: '#6b8f71', body: '#fbfaf5', chip: '#ffffff', ink: '#41613f', pri: 1, icon: '' },
  pool:    { chip: '#ffffff', ink: '#2b6f9e', pri: 1, icon: '' },
  parking: { chip: '#2f6fb3', ink: '#fff', pri: 2, icon: 'P', short: 1 },
  buggy:   { chip: '#ffffff', ink: '#44403b', pri: 1, icon: '🛺 ' },
  wc:      { chip: '#44403b', ink: '#fff', pri: 2, icon: '🚻', short: 1 },
  concierge: { chip: '#ffffff', ink: '#8a5a1c', pri: 2, icon: '🛎 ' },
  gate:    { chip: '#5b3b26', ink: '#fff', pri: 3, icon: '' },
};
const AREAS = [
  { text: 'SOUTH NEST', x: 560, y: 640 },
  { text: 'NORTH NEST', x: 560, y: 1700 },
  { text: 'HILL TOP', x: 300, y: 2300 },
  { text: 'LAKE SIDE', x: 1660, y: 2240 },
];

let loading = null;
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
export function ensureThree() {
  if (window.THREE && window.THREE.OrbitControls) return Promise.resolve();
  return loading || (loading = (window.THREE ? Promise.resolve() : loadScript(THREE_URL)).then(() => loadScript(ORBIT_URL)));
}
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });

const W = (x, y) => [(x - PW / 2) / S, (y - PH / 2) / S];   // plan → world x/z
const P = (a, b) => [Math.round(a * S + PW / 2), Math.round(b * S + PH / 2)];
const chipCss = 'position:absolute;left:0;top:0;white-space:nowrap;border-radius:999px;font-weight:600;will-change:transform;box-shadow:0 1px 4px rgba(0,0,0,.22);line-height:1.15';

export async function createMap(el, opts = {}) {
  await ensureThree();
  const T = window.THREE;
  const [hImg, texImg] = await Promise.all([loadImg(HEIGHT_URL), loadImg(TEX_URL)]);

  el.style.position = el.style.position || 'relative';
  el.style.touchAction = 'none';
  const W0 = el.clientWidth || 360, H0 = el.clientHeight || 420;

  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W0, H0);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.setClearColor('#faf4e2');
  el.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D map of Oleander Farms, Karjat, with roads, rooms and venues. Drag to turn, pinch to zoom, tap a pin.');
  renderer.domElement.setAttribute('role', 'img');

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;font-family:inherit';
  el.appendChild(overlay);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, W0 / H0, 0.5, 900);
  scene.add(new T.HemisphereLight('#ffffff', '#d8cfb4', 0.67));
  const sun = new T.DirectionalLight('#fff6e6', 0.42);
  sun.position.set(-60, 90, 40); scene.add(sun);

  // ---- terrain ----
  const cv = document.createElement('canvas'); cv.width = hImg.width; cv.height = hImg.height;
  const cx = cv.getContext('2d'); cx.drawImage(hImg, 0, 0);
  const hd = cx.getImageData(0, 0, cv.width, cv.height).data, HW = cv.width, HH = cv.height;
  const heightAt = (px, py) => {             // plan px → world height (bilinear)
    const fx = Math.max(0, Math.min(HW - 1.001, px / PW * HW - 0.5)), fy = Math.max(0, Math.min(HH - 1.001, py / PH * HH - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, g = (x, y) => hd[(y * HW + x) * 4];
    const v = (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
    return v / 70 * LIFT;
  };
  const geo = new T.PlaneGeometry(PW / S, PH / S, 200, 300);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const [px, py] = P(pos.getX(i), pos.getZ(i)); pos.setY(i, heightAt(px, py)); }
  geo.computeVertexNormals();
  const tex = new T.Texture(texImg); tex.encoding = T.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.minFilter = T.LinearMipmapLinearFilter; tex.needsUpdate = true;
  const terrain = new T.Mesh(geo, new T.MeshLambertMaterial({ map: tex }));
  scene.add(terrain);
  const paper = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshBasicMaterial({ color: new T.Color('#faf4e2').convertSRGBToLinear() }));
  paper.rotation.x = -Math.PI / 2; paper.position.y = -0.05; scene.add(paper);

  // ---- buildings ----
  const mats = {}; const mat = c => mats[c] || (mats[c] = new T.MeshLambertMaterial({ color: c }));
  const boxG = new T.BoxGeometry(1, 1, 1), roofG = new T.ConeGeometry(Math.SQRT1_2, 1, 4, 1); roofG.rotateY(Math.PI / 4);
  const ground = (f) => { // lowest ground under the footprint, so buildings sit on slopes
    const hw = (f.w || 30) / 2, hd2 = (f.d || 30) / 2;
    return Math.min(...[[0, 0], [hw, hd2], [-hw, hd2], [hw, -hd2], [-hw, -hd2]].map(([dx, dy]) => heightAt(f.x + dx, f.y + dy)));
  };
  for (const f of FEATURES) {
    const k = KIND[f.t]; if (!k) continue;
    const [a, b] = W(f.x, f.y), y0 = ground(f), rot = -(f.r || 0) * Math.PI / 180;
    const w = (f.w || 30) / S, d = (f.d || 30) / S;
    if (f.t === 'pool') {
      const m = new T.Mesh(boxG, mat('#4aa3df')); m.scale.set(w, 0.12, d); m.position.set(a, heightAt(f.x, f.y) + 0.06, b); m.rotation.y = rot; scene.add(m);
      const rim = new T.Mesh(boxG, mat('#ffffff')); rim.scale.set(w + 0.3, 0.08, d + 0.3); rim.position.set(a, heightAt(f.x, f.y) + 0.02, b); rim.rotation.y = rot; scene.add(rim);
    } else if (f.t === 'gate') {
      for (const dx of [-0.9, 0.9]) { const p = new T.Mesh(boxG, mat('#6b4a2e')); p.scale.set(0.35, 1.4, 0.35); p.position.set(a + dx, 0.7, b); scene.add(p); }
      const bar = new T.Mesh(boxG, mat('#8a6440')); bar.scale.set(2.2, 0.25, 0.25); bar.position.set(a, 1.3, b); scene.add(bar);
    } else if (f.h) {
      const h = f.h / 10;
      const body = new T.Mesh(boxG, mat(k.body)); body.scale.set(w, h, d); body.position.set(a, y0 + h / 2, b); body.rotation.y = rot; scene.add(body);
      const roof = new T.Mesh(roofG, mat(k.roof)); roof.scale.set(w * 1.12, Math.min(w, d) * 0.55, d * 1.12); roof.position.set(a, y0 + h + Math.min(w, d) * 0.275, b); roof.rotation.y = rot; scene.add(roof);
    }
  }
  const heli = FEATURES.find(f => f.n === 'Helipad');   // helipad disc
  if (heli) { const [a, b] = W(heli.x, heli.y); const m = new T.Mesh(new T.CylinderGeometry(1.5, 1.5, 0.1, 28), mat('#7d7a74')); m.position.set(a, heightAt(heli.x, heli.y) + 0.05, b); scene.add(m); }
  // trees
  const trunkG = new T.CylinderGeometry(0.08, 0.11, 0.5, 5), leafG = new T.ConeGeometry(0.55, 1.4, 7);
  const trunks = new T.InstancedMesh(trunkG, mat('#6b4f33'), TREES.length), leaves = new T.InstancedMesh(leafG, mat('#3f8a4f'), TREES.length);
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3();
  TREES.forEach(([x, y], i) => {
    const [a, b] = W(x, y), h = heightAt(x, y), s = 0.8 + ((x * 7 + y * 13) % 10) / 20;
    M4.compose(new T.Vector3(a, h + 0.25 * s, b), Q, V.set(s, s, s)); trunks.setMatrixAt(i, M4);
    M4.compose(new T.Vector3(a, h + 1.1 * s, b), Q, V.set(s, s, s)); leaves.setMatrixAt(i, M4);
  });
  scene.add(trunks, leaves);

  // ---- camera ----
  const HOME = { target: new T.Vector3(0, 0, 4), pos: new T.Vector3(0, 150, 105) };
  const fit = () => {
    const aspect = (el.clientWidth || 360) / Math.max(1, el.clientHeight || 420);
    const t = Math.tan(T.MathUtils.degToRad(20));
    const d = Math.max(75 * 0.86 / t * 0.8, 51 / aspect / t);
    HOME.pos.copy(HOME.target).add(new T.Vector3(0, 0.82, 0.57).setLength(d));
  };
  fit();
  camera.position.copy(HOME.pos);
  const controls = new T.OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME.target);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 10, maxDistance: 320, minPolarAngle: 0, maxPolarAngle: 1.2, screenSpacePanning: false, panSpeed: 1.2 });
  controls.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN };
  controls.update();
  const clampTarget = () => { const t = controls.target; t.x = Math.max(-50, Math.min(50, t.x)); t.z = Math.max(-75, Math.min(75, t.z)); t.y = 0; };

  // ---- fixed labels: venues, room groups, food, parking, restrooms … ----
  const mkLabel = (html, css) => { const d = document.createElement('div'); d.innerHTML = html; d.style.cssText = chipCss + ';' + css; overlay.appendChild(d); return d; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const statics = [];
  const addStatic = (f, k, text, lift) => {
    const short = k.short;
    const d = mkLabel(esc(short ? k.icon : (k.icon || '') + text),
      `background:${k.chip};color:${k.ink};font-size:${short ? 10 : k.pri >= 4 ? 11 : 10}px;padding:${short ? '2px 5px' : '3px 8px'};${short ? 'border-radius:6px;' : ''}${k.chip === '#ffffff' ? 'border:1px solid rgba(0,0,0,.08);' : ''}`);
    if (short) d.title = text;
    const [a, b] = W(f.x, f.y);
    statics.push({ el: d, pri: k.pri, x: f.x, y: f.y, v: new T.Vector3(a, ground(f) + lift, b) });
  };
  for (const g of GROUPS) addStatic(g, KIND[g.t], g.n, 2.2);
  for (const f of FEATURES) { const k = KIND[f.t]; if (!k || !f.n || f.nolabel) continue; addStatic(f, k, f.n, f.h ? f.h / 10 + 1.4 : 0.6); }
  const areaEls = AREAS.map(z => { const d = mkLabel(z.text, 'font-size:10px;font-weight:700;letter-spacing:.22em;color:#3b5a2a;background:rgba(255,252,240,.8);padding:2px 7px;border-radius:6px;box-shadow:none');
    const [a, b] = W(z.x, z.y); return { el: d, pri: 0, v: new T.Vector3(a, heightAt(z.x, z.y) + 0.3, b) }; });

  // ---- pins for the wedding's places ----
  const ray = new T.Raycaster();
  let pins = [], selected = opts.selectedId || null, pickMode = false;
  const pinGroup = new T.Group(); scene.add(pinGroup);
  function setPlaces(places) {
    pinGroup.clear(); pins.forEach(p => p.label.remove()); pins = [];
    for (const pl of places || []) {
      if (pl.x == null || pl.y == null) continue;
      const [a, b] = W(pl.x, pl.y), y = heightAt(pl.x, pl.y);
      const g = new T.Group(); g.position.set(a, y, b); g.userData.id = pl.id;
      const color = pl.color || '#8e3a5d';
      const stick = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 3.4, 6), mat('#ffffff')); stick.position.y = 1.7;
      const head = new T.Mesh(new T.SphereGeometry(0.8, 18, 14), new T.MeshLambertMaterial({ color })); head.position.y = 3.9;
      const ring = new T.Mesh(new T.RingGeometry(0.6, 1.2, 24), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08;
      g.add(stick, head, ring); [stick, head].forEach(m => m.userData.id = pl.id);
      pinGroup.add(g);
      const label = mkLabel(`<span style="font-size:12px">${esc(pl.name)}</span>${pl.sub ? `<br><span style="font-size:10px;font-weight:500;opacity:.92">${esc(pl.sub)}</span>` : ''}`,
        `background:${color};color:#fff;padding:4px 10px;border-radius:12px;border:1.5px solid rgba(255,255,255,.95);text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.3)`);
      pins.push({ id: pl.id, g, label, place: pl });
    }
    // hide fixed labels that a pin already names (same spot)
    for (const s of statics) s.dup = pins.some(p => Math.hypot(p.place.x - s.x, p.place.y - s.y) < 70);
    highlight();
  }
  function highlight() {
    for (const p of pins) {
      p.g.scale.setScalar(p.id === selected ? 1.35 : 1);
      p.label.style.opacity = !selected || p.id === selected ? '1' : '0.6';
    }
  }

  // ---- tap ----
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    if (pickMode) {
      const hit = ray.intersectObject(terrain)[0]; if (!hit) return;
      const [px, py] = P(hit.point.x, hit.point.z);
      if (px < 0 || py < 0 || px > PW || py > PH) return;
      opts.onPick && opts.onPick(px, py);
      return;
    }
    const hit = ray.intersectObjects(pinGroup.children, true)[0];
    const id = hit ? hit.object.userData.id || hit.object.parent.userData.id : null;
    if (id) { focus(id); opts.onSelect && opts.onSelect(id); }
  });

  let tween = null;
  const flyTo = (toTarget, toPos, ms = 700) => {
    const ft = controls.target.clone(), fp = camera.position.clone(), t0 = performance.now();
    tween = now => { const k = Math.min(1, (now - t0) / ms), e = k * (2 - k);
      controls.target.lerpVectors(ft, toTarget, e); camera.position.lerpVectors(fp, toPos, e); if (k >= 1) tween = null; };
  };
  function focus(id) {
    selected = id; highlight();
    const p = pins.find(x => x.id === id); if (!p) return;
    const to = p.g.position.clone(); to.y = 0;
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(Math.min(Math.max(offset.length(), 45), 65));
    flyTo(to, to.clone().add(offset));
  }

  // ---- label layout: most important first, skip any that would overlap ----
  const v = new T.Vector3();
  const box = (elx, vec, lift, up) => {
    v.copy(vec); v.y += lift; v.project(camera);
    if (!(v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1)) return null;
    const w = elx._w || (elx._w = elx.offsetWidth) || 9 * elx.textContent.length + 18, h = elx._h || (elx._h = elx.offsetHeight) || 22;
    const x = (v.x + 1) / 2 * el.clientWidth - w / 2;   // keep labels inside the box
    return { x: Math.max(3, Math.min(el.clientWidth - w - 3, x)), y: (1 - v.y) / 2 * el.clientHeight - (up ? h : h / 2), w, h };
  };
  const overlaps = (a, b) => a.x < b.x + b.w + 3 && b.x < a.x + a.w + 3 && a.y < b.y + b.h + 2 && b.y < a.y + a.h + 2;
  let raf = 0, alive = true;
  const loop = now => {
    if (!alive) return;
    if (tween) tween(now);
    controls.update(); clampTarget();
    renderer.render(scene, camera);
    const dist = camera.position.distanceTo(controls.target);
    const items = [
      ...pins.map(p => ({ el: p.label, pri: p.id === selected ? 99 : 10, b: () => box(p.label, p.g.position, 4.9 * p.g.scale.y, true) })),
      ...statics.map(s => ({ el: s.el, pri: s.dup ? -1 : s.pri, b: () => box(s.el, s.v, 0, true) })),
      ...areaEls.map(z => ({ el: z.el, pri: dist > 90 ? 6 : 0.5, b: () => box(z.el, z.v, 0, false) })),
    ].sort((a, b) => b.pri - a.pri);
    const shown = [];
    for (const it of items) {
      // small labels only once you zoom in a little
      const b = it.pri < 0 || (it.pri <= 2 && dist > 120) || (it.pri <= 1 && dist > 75) ? null : it.b();
      const ok = b && !shown.some(o => overlaps(o, b));
      it.el.style.display = ok ? 'block' : 'none';
      if (ok) { shown.push(b); it.el.style.transform = `translate(${b.x}px,${b.y}px)`; }
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  const ro = new ResizeObserver(() => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); fit(); });
  ro.observe(el);

  setPlaces(opts.places || DEFAULT_PLACES);
  return {
    setPlaces, focus,
    select(id) { selected = id; highlight(); },
    setPickMode(on) { pickMode = !!on; renderer.domElement.style.cursor = on ? 'crosshair' : 'grab'; },
    resetView() { selected = null; highlight(); fit(); flyTo(HOME.target.clone(), HOME.pos.clone()); },
    topView() { const t = controls.target.clone(); flyTo(t, t.clone().add(new T.Vector3(0, camera.position.distanceTo(t), 0.01))); },
    destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); el.innerHTML = ''; },
  };
}
