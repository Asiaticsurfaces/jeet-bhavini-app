// 3D venue map of Oleander, Karjat, traced from the resort's site plan.
// Map coordinates are pixels on that plan (about 1240 × 1240); the family
// panel stores each place as {id, name, desc, color, x, y} in those units.
//
//   const map = await createMap(el, { places, onSelect, onPick, labels })
//   map.setPlaces(places); map.focus(id); map.setPickMode(true|false); map.destroy()

const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const ORBIT_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';

let loading = null;
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
export function ensureThree() {
  if (window.THREE && window.THREE.OrbitControls) return Promise.resolve();
  return loading || (loading = (window.THREE ? Promise.resolve() : loadScript(THREE_URL)).then(() => loadScript(ORBIT_URL)));
}

// ---- the site plan, traced (plan pixels) ----
const CX = 600, CY = 680, S = 10;           // plan px → world units
const PALE = '#97c1aa', BASE = '#e2ebe4';
export const ZONES = [
  // surrounding land
  { h: 0.5, c: PALE, p: [[55,665],[110,640],[175,520],[210,470],[300,458],[300,525],[345,420],[390,410],[395,520],[350,612],[450,650],[520,680],[600,700],[660,700],[720,690],[800,690],[880,705],[960,740],[1055,790],[1050,830],[1015,865],[960,840],[900,790],[850,760],[840,740],[745,700],[655,710],[640,760],[600,760],[560,720],[480,700],[420,700],[330,770],[315,775],[290,740],[225,760],[160,720],[80,700]] },
  { h: 0.5, c: PALE, p: [[640,790],[700,840],[690,890],[670,950],[700,1000],[735,1065],[760,1080],[800,1100],[850,1140],[855,1200],[800,1215],[700,1200],[670,1160],[700,1110],[660,1060],[650,1020],[640,950],[610,900],[625,840]] },
  { h: 0.5, c: PALE, p: [[545,420],[560,370],[600,330],[620,400],[660,470],[700,440],[780,425],[830,440],[840,480],[800,520],[760,540],[720,560],[700,560],[655,485],[600,470],[545,480]] },
  // South Nest
  { h: 1.6, c: '#58a46a', label: 'SOUTH NEST', lx: 398, ly: 330, p: [[378,118],[540,124],[518,240],[495,262],[500,300],[530,340],[552,400],[545,480],[520,520],[420,522],[408,470],[385,410],[382,300],[376,210]] },
  { h: 1.9, c: '#a9d68e', p: [[390,122],[520,130],[505,235],[470,250],[420,262],[394,262],[388,200]] },
  { h: 1.9, c: '#a9d68e', p: [[397,268],[470,254],[488,264],[470,287],[420,300],[398,296]] },
  { h: 2.3, c: '#1d6b40', ellipse: [500, 410, 30, 46] },
  // North Nest (with its lake as a hole)
  { h: 1.6, c: '#17803f', label: 'NORTH NEST', lx: 410, ly: 590,
    p: [[350,612],[410,522],[545,522],[655,485],[700,560],[720,690],[600,700],[520,672],[450,645],[420,625]],
    hole: [[490,622],[530,602],[640,578],[690,562],[698,650],[600,662],[530,656],[495,650]] },
  // south-east green and the western grove
  { h: 1.6, c: '#17803f', p: [[658,712],[745,700],[838,742],[848,920],[836,990],[795,995],[772,955],[748,880],[730,800],[662,764]] },
  { h: 1.8, c: '#0f5c35', p: [[195,860],[222,762],[292,738],[318,772],[272,822]] },
];
export const WATER = [
  [[490,622],[530,602],[640,578],[690,562],[698,650],[600,662],[530,656],[495,650]],
  [[665,472],[780,430],[818,447],[826,478],[780,500],[668,532]],
  [[690,895],[718,900],[770,968],[790,1062],[760,1076],[735,1062],[700,1000],[668,950]],
];
const ROADS = [
  [[110,805],[160,700],[160,640],[240,632],[310,560],[372,505],[392,430],[388,330],[380,230]],
  [[320,770],[380,712],[432,662],[470,650]],
  [[470,650],[560,690],[660,706],[745,700],[838,742],[895,768]],
  [[545,522],[600,505],[655,486]],
];

export const DEFAULT_PLACES = [
  { id: 'lobby', name: 'Lobby & help desk', desc: 'Check-in, welcome kits, lost & found and the hospitality team.', color: '#c99a5b', x: 445, y: 205 },
  { id: 'parking', name: 'Parking & main gate', desc: 'Car parking and the station shuttle stop.', color: '#5b5550', x: 492, y: 170 },
  { id: 'ballroom', name: 'Ballroom', desc: 'Mameru (1 Dec, 9 AM) and Mandap Ropan (2 Dec, 8 AM).', color: '#8e3a5d', x: 432, y: 300 },
  { id: 'wash', name: 'Washrooms', desc: 'Next to the Ballroom and near the Lawn.', color: '#7d7a74', x: 470, y: 345 },
  { id: 'rooms', name: 'Guest rooms', desc: 'Your room number is on your wedding pass.', color: '#a8894f', x: 445, y: 470 },
  { id: 'lawn', name: 'Lawn', desc: 'Sangeet (1 Dec, 7 PM) and dinner.', color: '#3d8b4e', x: 585, y: 545 },
  { id: 'lake', name: 'Lake Side', desc: 'Wedding: Jaan 3:30 PM, Hastamelap 5:41 PM (2 Dec).', color: '#2f6fb3', x: 560, y: 615 },
];

const W = (x, y) => [(x - CX) / S, (y - CY) / S];  // plan → world x/z

function insidePoly(x, y, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export async function createMap(el, opts = {}) {
  await ensureThree();
  const T = window.THREE;
  el.style.position = el.style.position || 'relative';
  el.style.touchAction = 'none';
  const W0 = el.clientWidth || 360, H0 = el.clientHeight || 420;

  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W0, H0);
  renderer.setClearColor('#dfe9e2');
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  el.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D map of Oleander, Karjat. Drag to rotate, pinch to zoom.');
  renderer.domElement.setAttribute('role', 'img');

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;font-family:inherit';
  el.appendChild(overlay);

  const scene = new T.Scene();
  scene.fog = new T.Fog('#dfe9e2', 150, 280);
  const camera = new T.PerspectiveCamera(42, W0 / H0, 0.5, 600);
  camera.position.set(-14, 62, 30);

  scene.add(new T.HemisphereLight('#ffffff', '#9fb5a8', 0.62));
  scene.add(new T.AmbientLight('#ffffff', 0.12));
  const sun = new T.DirectionalLight('#fff1d6', 0.8);
  sun.position.set(-40, 80, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 200 });
  scene.add(sun);

  const ground = [];
  const base = new T.Mesh(new T.PlaneGeometry(260, 260), new T.MeshLambertMaterial({ color: BASE }));
  base.rotation.x = -Math.PI / 2; base.receiveShadow = true; scene.add(base); ground.push(base);

  const shapeOf = pts => { const s = new T.Shape(); pts.forEach(([x, y], i) => { const [a, b] = W(x, y); i ? s.lineTo(a, -b) : s.moveTo(a, -b); }); s.closePath(); return s; };
  const addSlab = (shape, h, color, y0 = 0) => {
    const g = new T.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 1 });
    const m = new T.Mesh(g, new T.MeshLambertMaterial({ color }));
    m.rotation.x = -Math.PI / 2; m.position.y = y0; m.castShadow = true; m.receiveShadow = true;
    scene.add(m); ground.push(m); return m;
  };
  const zoneLabels = [];
  for (const z of ZONES) {
    let shape;
    if (z.ellipse) { const [x, y, rx, ry] = z.ellipse; const [a, b] = W(x, y); shape = new T.Shape(); shape.absellipse(a, -b, rx / S, ry / S, 0, Math.PI * 2, false, 0); }
    else { shape = shapeOf(z.p); if (z.hole) shape.holes.push(shapeOf(z.hole)); }
    addSlab(shape, z.h, z.c);
    if (z.label) zoneLabels.push({ text: z.label, x: z.lx, y: z.ly, h: z.h });
  }
  const waterMat = new T.MeshPhongMaterial({ color: '#5b93d6', shininess: 90, specular: '#cfe3ff' });
  for (const w of WATER) { const g = new T.ExtrudeGeometry(shapeOf(w), { depth: 0.6, bevelEnabled: false }); const m = new T.Mesh(g, waterMat); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; scene.add(m); ground.push(m); }

  // roads: flat ribbons
  const roadMat = new T.MeshLambertMaterial({ color: '#ffffff' });
  for (const r of ROADS) for (let i = 1; i < r.length; i++) {
    const [ax, az] = W(...r[i - 1]), [bx, bz] = W(...r[i]);
    const len = Math.hypot(bx - ax, bz - az);
    const m = new T.Mesh(new T.BoxGeometry(len + 0.6, 0.12, 1.1), roadMat);
    m.position.set((ax + bx) / 2, 0.62, (az + bz) / 2); m.rotation.y = -Math.atan2(bz - az, bx - ax); m.receiveShadow = true; scene.add(m);
  }

  // trees on the green areas (deterministic)
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const greens = ZONES.filter(z => z.p && z.h >= 1.6 && z.h < 2.3);
  const spots = [];
  for (let i = 0; i < 2600 && spots.length < 170; i++) {
    const x = 180 + rnd() * 700, y = 110 + rnd() * 900;
    const z = greens.find(z => insidePoly(x, y, z.p) && !(z.hole && insidePoly(x, y, z.hole)));
    if (z && !WATER.some(w => insidePoly(x, y, w))) spots.push([x, y, z.h]);
  }
  const trunkG = new T.CylinderGeometry(0.12, 0.16, 0.7, 5), leafG = new T.ConeGeometry(0.75, 1.8, 7);
  const trunks = new T.InstancedMesh(trunkG, new T.MeshLambertMaterial({ color: '#6b4f33' }), spots.length);
  const leaves = new T.InstancedMesh(leafG, new T.MeshLambertMaterial({ color: '#2e7d47' }), spots.length);
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3();
  spots.forEach(([x, y, h], i) => {
    const [a, b] = W(x, y), s = 0.7 + rnd() * 0.6;
    M4.compose(new T.Vector3(a, h + 0.5, b), Q, V.set(s, s, s)); trunks.setMatrixAt(i, M4);
    M4.compose(new T.Vector3(a, h + 0.5 + 1.1 * s, b), Q, V.set(s, s, s)); leaves.setMatrixAt(i, M4);
  });
  leaves.castShadow = true; scene.add(trunks, leaves);

  const controls = new T.OrbitControls(camera, renderer.domElement);
  controls.target.set(-9, 0, -18);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 25, maxDistance: 150, minPolarAngle: 0.25, maxPolarAngle: 1.25, screenSpacePanning: false });
  controls.update();

  // ---- places: pins + labels ----
  const ray = new T.Raycaster(), down = new T.Vector3(0, -1, 0);
  const topAt = (a, b) => { scene.updateMatrixWorld(true); ray.set(new T.Vector3(a, 50, b), down); const hit = ray.intersectObjects(ground)[0]; return hit ? hit.point.y : 0.5; };
  let pins = [], selected = opts.selectedId || null, pickMode = false;
  const pinGroup = new T.Group(); scene.add(pinGroup);
  function setPlaces(places) {
    pinGroup.clear(); pins.forEach(p => p.label.remove()); pins = [];
    for (const pl of places || []) {
      if (pl.x == null || pl.y == null) continue;
      const [a, b] = W(pl.x, pl.y), y = topAt(a, b);
      const g = new T.Group(); g.position.set(a, y, b); g.userData.id = pl.id;
      const mat = new T.MeshLambertMaterial({ color: pl.color || '#8e3a5d' });
      const stick = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 3.2, 6), new T.MeshLambertMaterial({ color: '#ffffff' })); stick.position.y = 1.6;
      const head = new T.Mesh(new T.SphereGeometry(0.85, 18, 14), mat); head.position.y = 3.6; head.castShadow = true;
      const ring = new T.Mesh(new T.RingGeometry(0.7, 1.2, 24), new T.MeshBasicMaterial({ color: pl.color || '#8e3a5d', transparent: true, opacity: 0.45, side: T.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
      g.add(stick, head, ring); [stick, head].forEach(m => m.userData.id = pl.id);
      pinGroup.add(g);
      const label = document.createElement('div');
      label.textContent = pl.name;
      label.style.cssText = 'position:absolute;left:0;top:0;transform:translate(-50%,-100%);white-space:nowrap;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:600;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.25)';
      label.style.background = pl.color || '#8e3a5d';
      overlay.appendChild(label);
      pins.push({ id: pl.id, g, head, label, place: pl });
    }
    highlight();
  }
  const zoneEls = zoneLabels.map(z => { const d = document.createElement('div'); d.textContent = z.text;
    d.style.cssText = 'position:absolute;left:0;top:0;transform:translate(-50%,-50%);font-size:10px;font-weight:700;letter-spacing:.18em;color:rgba(255,255,255,.95);text-shadow:0 1px 3px rgba(0,0,0,.45)';
    overlay.appendChild(d); const [a, b] = W(z.x, z.y); return { d, v: new T.Vector3(a, z.h + 0.3, b) }; });
  function highlight() {
    for (const p of pins) {
      const on = !selected || p.id === selected;
      p.g.scale.setScalar(p.id === selected ? 1.35 : 1);
      p.label.style.opacity = on ? '1' : '0.45';
      p.label.style.zIndex = p.id === selected ? '2' : '1';
    }
  }

  // ---- tap: select a pin, or (pick mode) choose a location ----
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    if (pickMode) {
      const hit = ray.intersectObjects(ground)[0]; if (!hit) return;
      opts.onPick && opts.onPick(Math.round(hit.point.x * S + CX), Math.round(hit.point.z * S + CY));
      return;
    }
    const hit = ray.intersectObjects(pinGroup.children, true)[0];
    const id = hit ? hit.object.userData.id || hit.object.parent.userData.id : null;
    if (id) { focus(id); opts.onSelect && opts.onSelect(id); }
  });

  let tween = null;
  function focus(id) {
    selected = id; highlight();
    const p = pins.find(x => x.id === id); if (!p) return;
    const to = p.g.position.clone(), from = controls.target.clone(), t0 = performance.now();
    const offset = camera.position.clone().sub(controls.target);
    const dist = Math.min(offset.length(), 55); offset.setLength(dist);
    tween = now => { const k = Math.min(1, (now - t0) / 650), e = k * (2 - k);
      controls.target.lerpVectors(from, to, e); camera.position.copy(controls.target).add(offset); if (k >= 1) tween = null; };
  }

  const v = new T.Vector3();
  const place = (elx, vec, lift) => {
    v.copy(vec); v.y += lift; v.project(camera);
    const vis = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
    elx.style.display = vis ? 'block' : 'none';
    if (vis) elx.style.transform = `translate(${(v.x + 1) / 2 * el.clientWidth}px, ${(1 - v.y) / 2 * el.clientHeight}px) translate(-50%,-100%)`;
  };
  let raf = 0, alive = true;
  const loop = now => {
    if (!alive) return;
    if (tween) tween(now);
    controls.update(); renderer.render(scene, camera);
    for (const p of pins) place(p.label, p.g.position, 5.2);
    for (const z of zoneEls) { place(z.d, z.v, 0); z.d.style.transform += ' translate(0,50%)'; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  const ro = new ResizeObserver(() => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); });
  ro.observe(el);

  setPlaces(opts.places || DEFAULT_PLACES);
  return {
    setPlaces, focus,
    select(id) { selected = id; highlight(); },
    setPickMode(on) { pickMode = !!on; renderer.domElement.style.cursor = on ? 'crosshair' : 'grab'; },
    resetView() { controls.target.set(-9, 0, -18); camera.position.set(-14, 62, 30); selected = null; highlight(); },
    destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); el.innerHTML = ''; },
  };
}
