// 2D venue map of Oleander Farms, Karjat: the clean redrawn map (assets/venue-map.jpg) with
// every building drawn on top (js/venue-data.js), labels that stay readable at any zoom,
// and pins for the wedding's places. Drag to move, pinch / scroll / + − to zoom, double-tap to zoom in.
//
// Map coordinates are pixels on the resort's map (2000 × 3000). The family panel stores each
// pin as {id, name, desc, color, x, y} in those units, with v: MAP_VERSION on the doc.
// A pin may also carry `sub` (a second line, e.g. which functions happen there).
//
//   const map = await createMap(el, { places, onSelect, onPick })
//   map.setPlaces(places); map.focus(id); map.setPickMode(true|false); map.resetView(); map.destroy()

import { FEATURES, GROUPS, TREES } from './venue-data.js?v=1';

const TEX_URL = new URL('../assets/venue-map.jpg?v=4', import.meta.url).href;
export const MAP_VERSION = 2;
export { GROUPS };
// Guess a room group from a wing name ("Lake View", "Cottage 3" …) when the family hasn't linked it.
export const guessBlock = w => /cottage/i.test(w) ? 'cottage' : /plunge/i.test(w) ? 'room-pp' : /lake/i.test(w) ? 'room-lv' : /pool|lawn/i.test(w) ? 'room-pl' : '';
const PW = 2000, PH = 2980;

export const DEFAULT_PLACES = [
  { id: 'ballroom', name: 'Banquet hall', desc: 'Oleander Farms Banquet, right at the main entrance.', color: '#8e3a5d', x: 712, y: 66 },
  { id: 'lawn', name: 'Garden lawn', desc: 'Oleander Farms Garden, the big lawn in South Nest.', color: '#3d8b4e', x: 942, y: 1135 },
  { id: 'lake', name: 'The Lake Side', desc: 'On the water\'s edge, at the far end. Walk or take a buggy along the road past the cottages, then down the boardwalk.', color: '#2f6fb3', x: 1612, y: 2846 },
  { id: 'parking', name: 'Entrance & parking', desc: 'Come in through Gate 1 or Gate 2. The car park is just inside, on the left.', color: '#5b5550', x: 625, y: 503 },
  { id: 'lobby', name: 'Concierge', desc: 'Help desk for keys, luggage, buggies and lost & found.', color: '#c99a5b', x: 908, y: 950 },
];

const KIND = {
  venue:     { roof: '#8e3a5d', chip: '#ffffff', ink: '#6d2745', pri: 4 },
  'room-pl': { roof: '#c8553d', chip: '#c8553d', ink: '#fff', pri: 5 },
  'room-pp': { roof: '#4f4440', chip: '#4f4440', ink: '#fff', pri: 5 },
  'room-lv': { roof: '#7f8c99', chip: '#5f6c79', ink: '#fff', pri: 5 },
  cottage:   { roof: '#8b5a2b', chip: '#8b5a2b', ink: '#fff', pri: 5 },
  food:      { roof: '#c99a5b', chip: '#ffffff', ink: '#8a5a1c', pri: 3, icon: '🍽 ' },
  spot:      { roof: '#6b8f71', chip: '#ffffff', ink: '#41613f', pri: 1 },
  pool:      { chip: '#ffffff', ink: '#2b6f9e', pri: 1 },
  parking:   { chip: '#2f6fb3', ink: '#fff', pri: 2, icon: 'P', short: 1 },
  buggy:     { chip: '#ffffff', ink: '#44403b', pri: 1, icon: '🛺 ' },
  wc:        { chip: '#44403b', ink: '#fff', pri: 2, icon: '🚻', short: 1 },
  concierge: { chip: '#ffffff', ink: '#8a5a1c', pri: 2, icon: '🛎 ' },
  gate:      { chip: '#5b3b26', ink: '#fff', pri: 3 },
};
const AREAS = [
  { text: 'SOUTH NEST', x: 560, y: 640 }, { text: 'NORTH NEST', x: 560, y: 1700 },
  { text: 'HILL TOP', x: 300, y: 2300 }, { text: 'LAKE SIDE', x: 1660, y: 2240 },
];
const shade = (hex, f) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const div = (parent, css, html = '') => { const d = document.createElement('div'); d.style.cssText = css; d.innerHTML = html; parent.appendChild(d); return d; };

export async function createMap(el, opts = {}) {
  el.innerHTML = '';
  el.style.position = el.style.position || 'relative';
  el.style.overflow = 'hidden'; el.style.touchAction = 'none'; el.style.background = '#faf4e2'; el.style.userSelect = 'none';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'Map of Oleander Farms, Karjat, with roads, rooms and venues. Drag to move, pinch or use + and − to zoom.');

  // ---- the map itself (plan px, scaled as one) ----
  const stage = div(el, `position:absolute;left:0;top:0;width:${PW}px;height:${PH}px;transform-origin:0 0;will-change:transform`);
  const img = document.createElement('img');
  img.src = TEX_URL; img.alt = ''; img.draggable = false;
  img.style.cssText = `position:absolute;left:0;top:0;width:${PW}px;height:3000px;pointer-events:none`;
  stage.appendChild(img);
  await new Promise(res => { if (img.complete) res(); else { img.onload = res; img.onerror = res; } });

  for (const [x, y] of TREES) {
    const s = 13 + ((x * 7 + y * 13) % 6);
    div(stage, `position:absolute;left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;border-radius:50%;background:#5f9e5c;box-shadow:inset -2px -3px 0 rgba(0,0,0,.14);opacity:.9`);
  }
  for (const f of FEATURES) {
    const k = KIND[f.t]; if (!k) continue;
    const w = f.w || 30, d = f.d || 30, base = `position:absolute;left:${f.x - w / 2}px;top:${f.y - d / 2}px;width:${w}px;height:${d}px;transform:rotate(${f.r || 0}deg);box-sizing:border-box;`;
    if (f.t === 'pool') div(stage, base + 'background:#4aa3df;border:4px solid #fff;border-radius:5px;box-shadow:0 1px 3px rgba(0,0,0,.2)');
    else if (f.n === 'Helipad') div(stage, base + 'border-radius:50%;background:#7d7a74;border:3px solid #fff;color:#fff;font:700 26px/52px sans-serif;text-align:center', 'H');
    else if (f.t === 'gate') div(stage, `position:absolute;left:${f.x - 24}px;top:${f.y - 8}px;width:48px;height:16px;background:repeating-linear-gradient(90deg,#6b4a2e 0 5px,#a07a52 5px 9px);border-radius:3px`);
    else if (f.h) div(stage, base + `background:${k.roof};border:2px solid ${shade(k.roof, 0.72)};border-radius:4px;box-shadow:3px 4px 0 rgba(60,40,20,.18);background-image:linear-gradient(135deg,rgba(255,255,255,.22) 0 50%,rgba(0,0,0,.06) 50%)`);
  }

  // ---- screen layer: labels and pins (never scaled, always readable) ----
  const overlay = div(el, 'position:absolute;inset:0;pointer-events:none;overflow:hidden;font-family:inherit');
  const chip = 'position:absolute;left:0;top:0;z-index:2;white-space:nowrap;border-radius:999px;font-weight:600;line-height:1.15;box-shadow:0 1px 4px rgba(0,0,0,.22);will-change:transform';
  const items = [];
  const addStatic = (f, k, text) => {
    const short = k.short;
    const d = div(overlay, chip + `;background:${k.chip};color:${k.ink};font-size:${short ? 10 : k.pri >= 4 ? 11.5 : 10.5}px;padding:${short ? '2px 5px' : '3px 8px'};${short ? 'border-radius:6px;' : ''}${k.chip === '#ffffff' ? 'border:1px solid rgba(0,0,0,.08);' : ''}`,
      esc(short ? k.icon : (k.icon || '') + text));
    items.push({ el: d, x: f.x, y: f.y, lift: (f.d || 20) / 2, pri: k.pri, kind: 'static' });
  };
  for (const g of GROUPS) addStatic(g, KIND[g.t], g.n);
  for (const f of FEATURES) { const k = KIND[f.t]; if (k && f.n && !f.nolabel) addStatic(f, k, f.n); }
  for (const a of AREAS) items.push({ el: div(overlay, chip + ';font-size:10px;font-weight:700;letter-spacing:.22em;color:#3b5a2a;background:rgba(255,252,240,.82);padding:2px 7px;border-radius:6px;box-shadow:none', a.text), x: a.x, y: a.y, lift: 0, pri: 0, kind: 'area', mid: 1 });

  let pins = [], selected = opts.selectedId || null, pickMode = false;
  function setPlaces(places) {
    pins.forEach(p => { p.el.remove(); p.mark.remove(); }); pins = [];
    for (const pl of places || []) {
      if (pl.x == null || pl.y == null) continue;
      const color = pl.color || '#8e3a5d';
      const mark = div(overlay, 'position:absolute;left:0;top:0;width:28px;height:38px;will-change:transform;z-index:1',
        `<svg viewBox="0 0 28 38" width="28" height="38"><path d="M14 37C14 37 2 22 2 13a12 12 0 0 1 24 0c0 9-12 24-12 24z" fill="${esc(color)}" stroke="#fff" stroke-width="2.5"/><circle cx="14" cy="13" r="4.5" fill="#fff"/></svg>`);
      const el2 = div(overlay, chip + `;background:${esc(color)};color:#fff;padding:4px 10px;border-radius:12px;border:1.5px solid rgba(255,255,255,.95);text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.3)`,
        `<span style="font-size:12px">${esc(pl.name)}</span>${pl.sub ? `<br><span style="font-size:10px;font-weight:500;opacity:.92">${esc(pl.sub)}</span>` : ''}`);
      pins.push({ id: pl.id, place: pl, el: el2, mark });
    }
    for (const it of items) it.dup = it.kind === 'static' && pins.some(p => Math.hypot(p.place.x - it.x, p.place.y - it.y) < 70);
    draw();
  }

  // ---- view: k = screen px per map px, (tx, ty) = where the map's top-left sits ----
  let k = 0.2, tx = 0, ty = 0, fitK = 0.2;
  const size = () => [el.clientWidth || 360, el.clientHeight || 480];
  const fitView = () => { const [w, h] = size(); fitK = Math.min(w / PW, h / PH) * 0.96; return { k: fitK, tx: (w - PW * fitK) / 2, ty: (h - PH * fitK) / 2 }; };
  const MAXK = 1.6;
  const clamp = () => {
    const [w, h] = size(); k = Math.max(fitK * 0.9, Math.min(MAXK, k));
    const mw = PW * k, mh = PH * k;
    tx = mw <= w ? (w - mw) / 2 : Math.min(40, Math.max(w - mw - 40, tx));
    ty = mh <= h ? (h - mh) / 2 : Math.min(40, Math.max(h - mh - 40, ty));
  };
  const zoomAt = (f, sx, sy) => { const nk = Math.max(fitK * 0.9, Math.min(MAXK, k * f)); tx = sx - (sx - tx) * nk / k; ty = sy - (sy - ty) * nk / k; k = nk; };

  const overlaps = (a, b) => a.x < b.x + b.w + 3 && b.x < a.x + a.w + 3 && a.y < b.y + b.h + 2 && b.y < a.y + a.h + 2;
  const measure = e => [e._w || (e._w = e.offsetWidth) || 80, e._h || (e._h = e.offsetHeight) || 22];
  let queued = false;
  function draw() {
    queued = false; clamp();
    stage.style.transform = `translate(${tx}px,${ty}px) scale(${k})`;
    const [W, H] = size(), z = k / fitK;      // z = how far zoomed in (1 = whole map)
    const list = [
      ...pins.map(p => ({ el: p.el, pri: p.id === selected ? 99 : 10, x: p.place.x, y: p.place.y, lift: 0, pin: p })),
      ...items.map(it => ({ ...it, pri: it.dup ? -1 : it.kind === 'area' ? (z < 1.8 ? 6 : 0.5) : it.pri })),
    ].sort((a, b) => b.pri - a.pri);
    const shown = [];
    for (const it of list) {
      const sx = tx + it.x * k, sy = ty + it.y * k;
      if (it.pin) {      // the marker itself always shows
        const big = it.pin.id === selected ? 1.25 : 1;
        it.pin.mark.style.transform = `translate(${sx - 14}px,${sy - 38}px) scale(${big})`; it.pin.mark.style.transformOrigin = '50% 100%';
        it.pin.mark.style.opacity = !selected || it.pin.id === selected ? '1' : '.7';
      }
      const hide = it.pri < 0 || (it.pri <= 2 && z < 2.2) || (it.pri <= 1 && z < 3.2) || (it.pri === 3 && z < 1.5) || (it.pri === 4 && z < 1.2);
      let b = null;
      if (!hide) {
        const [w, h] = measure(it.el);
        const top = it.pin ? sy - 40 * (it.pin.id === selected ? 1.25 : 1) - h - 2 : it.mid ? sy - h / 2 : sy - it.lift * k - h - 3;
        const x = Math.max(3, Math.min(W - w - 3, sx - w / 2));
        if (sx > -40 && sx < W + 40 && top > -h - 50 && top < H) b = { x, y: Math.max(3, top), w, h };
      }
      const ok = b && !shown.some(o => overlaps(o, b));
      it.el.style.display = ok ? 'block' : 'none';
      if (ok) { shown.push(b); it.el.style.transform = `translate(${b.x}px,${b.y}px)`; it.el.style.opacity = it.pin && selected && it.pin.id !== selected ? '.75' : '1'; }
    }
  }
  const redraw = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };

  let anim = 0;
  const animateTo = (to, ms = 380) => {
    cancelAnimationFrame(anim);
    const from = { k, tx, ty }, t0 = performance.now();
    const step = now => { const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3);
      k = from.k + (to.k - from.k) * e; tx = from.tx + (to.tx - from.tx) * e; ty = from.ty + (to.ty - from.ty) * e; draw();
      if (p < 1) anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step);
  };
  const centreOn = (x, y, nk) => { const [w, h] = size(); return { k: nk, tx: w / 2 - x * nk, ty: h / 2 - y * nk }; };

  // ---- gestures: drag, pinch, wheel, double-tap ----
  const ptrs = new Map(); let start = null, moved = 0, lastTap = 0;
  el.addEventListener('pointerdown', e => {
    if (e.target.closest('[data-mapbtn]')) return;
    el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); cancelAnimationFrame(anim);
    if (ptrs.size === 1) { start = [e.clientX, e.clientY]; moved = 0; }
  });
  el.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const prev = ptrs.get(e.pointerId), r = el.getBoundingClientRect();
    if (ptrs.size === 1) { tx += e.clientX - prev[0]; ty += e.clientY - prev[1]; }
    else if (ptrs.size === 2) {
      const other = [...ptrs.entries()].find(([id]) => id !== e.pointerId)[1];
      const d0 = Math.hypot(prev[0] - other[0], prev[1] - other[1]), d1 = Math.hypot(e.clientX - other[0], e.clientY - other[1]);
      const m0 = [(prev[0] + other[0]) / 2 - r.left, (prev[1] + other[1]) / 2 - r.top], m1 = [(e.clientX + other[0]) / 2 - r.left, (e.clientY + other[1]) / 2 - r.top];
      if (d0 > 0) zoomAt(d1 / d0, m0[0], m0[1]);
      tx += m1[0] - m0[0]; ty += m1[1] - m0[1];
    }
    moved += Math.hypot(e.clientX - prev[0], e.clientY - prev[1]);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]); redraw();
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    const single = ptrs.size === 1; ptrs.delete(e.pointerId);
    if (!single || moved > 8) return;
    const r = el.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const mx = (sx - tx) / k, my = (sy - ty) / k;
    if (pickMode) { if (mx >= 0 && my >= 0 && mx <= PW && my <= PH) opts.onPick && opts.onPick(Math.round(mx), Math.round(my)); return; }
    // tap on a pin (marker or its label)?
    const hit = pins.find(p => { const px = tx + p.place.x * k, py = ty + p.place.y * k; if (Math.abs(sx - px) < 18 && sy > py - 44 && sy < py + 6) return true;
      const b = p.el.style.display === 'block' && p.el.getBoundingClientRect(); return b && e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom; });
    if (hit) { focus(hit.id); opts.onSelect && opts.onSelect(hit.id); return; }
    const now = performance.now();
    if (now - lastTap < 320) { const nk = Math.min(MAXK, k * 2); animateTo({ k: nk, tx: sx - (sx - tx) * nk / k, ty: sy - (sy - ty) * nk / k }); lastTap = 0; }
    else lastTap = now;
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', e => ptrs.delete(e.pointerId));
  el.addEventListener('wheel', e => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0018), e.clientX - r.left, e.clientY - r.top); redraw(); }, { passive: false });

  // ---- + / − / whole map buttons ----
  const bar = div(el, 'position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:6px;z-index:5');
  const btn = (label, aria, fn) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.mapbtn = '1'; b.textContent = label; b.setAttribute('aria-label', aria);
    b.style.cssText = 'width:38px;height:38px;border-radius:12px;border:1px solid rgba(0,0,0,.12);background:#fffdf8;color:#5e1f3a;font:600 20px/1 inherit;box-shadow:0 2px 6px rgba(0,0,0,.15);cursor:pointer';
    b.onclick = e => { e.stopPropagation(); fn(); }; bar.appendChild(b); return b; };
  btn('+', 'Zoom in', () => { const [w, h] = size(); const nk = Math.min(MAXK, k * 1.8); animateTo({ k: nk, tx: w / 2 - (w / 2 - tx) * nk / k, ty: h / 2 - (h / 2 - ty) * nk / k }); });
  btn('−', 'Zoom out', () => { const [w, h] = size(); const nk = Math.max(fitK, k / 1.8); animateTo({ k: nk, tx: w / 2 - (w / 2 - tx) * nk / k, ty: h / 2 - (h / 2 - ty) * nk / k }); });
  btn('⤢', 'Show the whole map', () => resetView());

  function focus(id) {
    selected = id;
    const p = pins.find(x => x.id === id); if (!p) return draw();
    animateTo(centreOn(p.place.x, p.place.y, Math.max(k, fitK * 3)));
  }
  function resetView() { selected = null; animateTo(fitView()); }

  const ro = new ResizeObserver(() => { const wasFit = Math.abs(k - fitK) < 1e-6; const f = fitView(); if (wasFit) ({ k, tx, ty } = f); redraw(); });
  ro.observe(el);
  ({ k, tx, ty } = fitView());
  setPlaces(opts.places || DEFAULT_PLACES);

  return {
    setPlaces, focus, resetView,
    select(id) { selected = id; draw(); },
    setPickMode(on) { pickMode = !!on; el.style.cursor = on ? 'crosshair' : 'grab'; },
    destroy() { ro.disconnect(); cancelAnimationFrame(anim); el.innerHTML = ''; },
  };
}
