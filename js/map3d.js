// 3D venue map of Oleander Farms, Karjat, built from the resort's own illustrated map.
// The picture (assets/venue-map.jpg) is draped over a terrain whose heights come from
// assets/venue-height.png: the paper is flat, the land is raised, lakes dip, Hill Top rises.
//
// Map coordinates are pixels on that map (2000 × 3000). The family panel stores each
// place as {id, name, desc, color, x, y} in those units, with v: MAP_VERSION on the doc.
//
//   const map = await createMap(el, { places, onSelect, onPick })
//   map.setPlaces(places); map.focus(id); map.setPickMode(true|false); map.resetView(); map.destroy()

const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const ORBIT_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
const TEX_URL = new URL('../assets/venue-map.jpg?v=3', import.meta.url).href;
const HEIGHT_URL = new URL('../assets/venue-height.png?v=2', import.meta.url).href;

export const MAP_VERSION = 2;
const PW = 2000, PH = 3000, S = 20;                 // plan px per world unit → world is 100 × 150
const LIFT = 1.9;                                    // world height of the land

export const DEFAULT_PLACES = [
  { id: 'ballroom', name: 'Banquet hall', desc: 'Oleander Farms Banquet, at the main entrance. Mameru (1 Dec, morning) and Mandap Ropan (2 Dec, morning).', color: '#8e3a5d', x: 694, y: 66 },
  { id: 'parking', name: 'Entrance & parking', desc: 'Gate 1 and Gate 2 open onto the main road. Car parking is just inside, on the left.', color: '#5b5550', x: 625, y: 486 },
  { id: 'lobby', name: 'Concierge', desc: 'Help desk for anything you need: keys, luggage, buggies, lost & found.', color: '#c99a5b', x: 908, y: 952 },
  { id: 'rooms', name: 'Guest rooms', desc: 'Rooms are around the pool and lawns, by the lake and in the cottages. Your room number is on your wedding pass.', color: '#a8894f', x: 745, y: 1030 },
  { id: 'lawn', name: 'Garden lawn', desc: 'Oleander Farms Garden. Sangeet (1 Dec, evening) and dinner.', color: '#3d8b4e', x: 940, y: 1134 },
  { id: 'food', name: 'Saltt Restaurant', desc: 'All-day dining with farm views.', color: '#b8322b', x: 658, y: 731 },
  { id: 'lake', name: 'The Lake Side', desc: 'Wedding venue on the water\'s edge (2 Dec). Walk or take a buggy down the path past the cottages.', color: '#2f6fb3', x: 1615, y: 2795 },
];

// Area names shown on the land
const AREAS = [
  { text: 'SOUTH NEST', x: 560, y: 640 },
  { text: 'NORTH NEST', x: 760, y: 1600 },
  { text: 'HILL TOP', x: 300, y: 2040 },
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
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D map of Oleander Farms, Karjat. Drag to turn, pinch to zoom, tap a pin.');
  renderer.domElement.setAttribute('role', 'img');

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;font-family:inherit';
  el.appendChild(overlay);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, W0 / H0, 0.5, 900);

  scene.add(new T.HemisphereLight('#ffffff', '#d8cfb4', 0.67));
  const sun = new T.DirectionalLight('#fff6e6', 0.42);
  sun.position.set(-60, 90, 40); scene.add(sun);

  // ---- terrain: the illustrated map draped over a height field ----
  const cv = document.createElement('canvas'); cv.width = hImg.width; cv.height = hImg.height;
  const cx = cv.getContext('2d'); cx.drawImage(hImg, 0, 0);
  const hd = cx.getImageData(0, 0, cv.width, cv.height).data, HW = cv.width, HH = cv.height;
  const heightAt = (px, py) => {             // plan px → world height (bilinear)
    const fx = Math.max(0, Math.min(HW - 1.001, px / PW * HW - 0.5)), fy = Math.max(0, Math.min(HH - 1.001, py / PH * HH - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, g = (x, y) => hd[(y * HW + x) * 4];
    const v = (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
    return v / 70 * LIFT;
  };
  const SEG_X = 200, SEG_Y = 300;
  const geo = new T.PlaneGeometry(PW / S, PH / S, SEG_X, SEG_Y);
  geo.rotateX(-Math.PI / 2);                  // plane now lies on x/z; uv (0,1) is the map's top-left
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const [px, py] = P(pos.getX(i), pos.getZ(i)); pos.setY(i, heightAt(px, py)); }
  geo.computeVertexNormals();
  const tex = new T.Texture(texImg); tex.encoding = T.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.minFilter = T.LinearMipmapLinearFilter; tex.needsUpdate = true;
  const terrain = new T.Mesh(geo, new T.MeshLambertMaterial({ map: tex }));
  scene.add(terrain);
  // paper beyond the map edges
  const paper = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshBasicMaterial({ color: new T.Color('#faf4e2').convertSRGBToLinear() }));
  paper.rotation.x = -Math.PI / 2; paper.position.y = -0.05; scene.add(paper);

  // ---- camera ----
  const HOME = { target: new T.Vector3(0, 0, 4), pos: new T.Vector3(0, 150, 105) };
  const fit = () => {               // pull back far enough that the whole map fits this box
    const aspect = (el.clientWidth || 360) / Math.max(1, el.clientHeight || 420);
    const t = Math.tan(T.MathUtils.degToRad(20));
    const d = Math.max(75 * 0.86 / t * 0.8, 51 / aspect / t);   // fit the map's height (it is tilted) and its full width
    HOME.pos.copy(HOME.target).add(new T.Vector3(0, 0.82, 0.57).setLength(d));
  };
  fit();
  camera.position.copy(HOME.pos);
  const controls = new T.OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME.target);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 14, maxDistance: 320, minPolarAngle: 0, maxPolarAngle: 1.2, screenSpacePanning: false, panSpeed: 1.2 });
  controls.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN };
  controls.update();
  const clampTarget = () => { const t = controls.target; t.x = Math.max(-50, Math.min(50, t.x)); t.z = Math.max(-75, Math.min(75, t.z)); t.y = 0; };

  // ---- places: pins + labels ----
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
      const stick = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 2.6, 6), new T.MeshLambertMaterial({ color: '#ffffff' })); stick.position.y = 1.3;
      const head = new T.Mesh(new T.SphereGeometry(0.75, 18, 14), new T.MeshLambertMaterial({ color }));
      head.position.y = 3;
      const ring = new T.Mesh(new T.RingGeometry(0.55, 1.05, 24), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
      g.add(stick, head, ring); [stick, head].forEach(m => m.userData.id = pl.id);
      pinGroup.add(g);
      const label = document.createElement('div');
      label.textContent = pl.name;
      label.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;padding:4px 9px;border-radius:999px;font-size:11.5px;font-weight:600;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.28);border:1.5px solid rgba(255,255,255,.9);will-change:transform';
      label.style.background = color;
      overlay.appendChild(label);
      pins.push({ id: pl.id, g, label, place: pl });
    }
    highlight();
  }
  const areaEls = AREAS.map(z => { const d = document.createElement('div'); d.textContent = z.text;
    d.style.cssText = 'position:absolute;left:0;top:0;font-size:10px;font-weight:700;letter-spacing:.22em;color:#3b5a2a;background:rgba(255,252,240,.78);padding:2px 7px;border-radius:6px;will-change:transform';
    overlay.appendChild(d); const [a, b] = W(z.x, z.y); return { d, v: new T.Vector3(a, heightAt(z.x, z.y) + 0.3, b) }; });
  function highlight() {
    for (const p of pins) {
      const on = !selected || p.id === selected;
      p.g.scale.setScalar(p.id === selected ? 1.4 : 1);
      p.label.style.opacity = on ? '1' : '0.5';
      p.label.style.zIndex = p.id === selected ? '3' : '2';
      p.label.style.fontSize = p.id === selected ? '13px' : '11.5px'; p.label._w = p.label._h = 0;
    }
  }

  // ---- tap: select a pin, or (pick mode) choose a spot ----
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
    offset.setLength(Math.min(Math.max(offset.length(), 55), 75));
    flyTo(to, to.clone().add(offset));
  }

  const v = new T.Vector3();
  // Project a label; returns its box on screen (or null when off screen).
  const place = (elx, vec, lift, up) => {
    v.copy(vec); v.y += lift; v.project(camera);
    if (!(v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15)) return null;
    const w = elx._w || (elx._w = elx.offsetWidth) || 9 * elx.textContent.length + 18, h = elx._h || (elx._h = elx.offsetHeight) || 24;
    const x = (v.x + 1) / 2 * el.clientWidth - w / 2, y = (1 - v.y) / 2 * el.clientHeight - (up ? h : h / 2);
    return { elx, x, y, w, h };
  };
  const overlaps = (a, b) => a.x < b.x + b.w + 4 && b.x < a.x + a.w + 4 && a.y < b.y + b.h + 2 && b.y < a.y + a.h + 2;
  let raf = 0, alive = true;
  const loop = now => {
    if (!alive) return;
    if (tween) tween(now);
    controls.update(); clampTarget();
    renderer.render(scene, camera);
    const order = [...pins].sort((a, b) => (b.id === selected) - (a.id === selected));
    const boxes = [...order.map(p => place(p.label, p.g.position, 4.3 * p.g.scale.y, true)), ...areaEls.map(z => place(z.d, z.v, 0, false))];
    const shown = [];
    [...order.map(p => p.label), ...areaEls.map(z => z.d)].forEach((elx, i) => {
      const b = boxes[i], ok = b && !shown.some(o => overlaps(o, b));
      elx.style.display = ok ? 'block' : 'none';
      if (ok) { shown.push(b); elx.style.transform = `translate(${b.x}px,${b.y}px)`; }
    });
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
