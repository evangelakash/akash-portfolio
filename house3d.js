/* House (3D): baked-light scene, scroll-driven camera.
   Blender (x, y, z) maps to three (x, z, -y); the manifest is already in three space. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { openCase } from './house3d-popup.js?v=4';
import { fontsReady, slotTexture } from './house3d-text.js?v=4';
import { makeHologram } from './house3d-holo.js?v=8';
import { makeGrass } from './house3d-grass.js?v=17';

const BASE = 'img/house3d/';
const doc = document.documentElement;
const stage = document.querySelector('.h3-stage');
const canvas = document.getElementById('h3-canvas');
const track = document.querySelector('.h3-track');
const loadBar = document.querySelector('.h3-load');
const copies = [...document.querySelectorAll('.h3-copy')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ renderer */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 600);

/* sky: vertical gradient on a large sphere (matches the Blender sky roughly) */
{
  const g = new THREE.SphereGeometry(400, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
    uniforms: {
      top: { value: new THREE.Color('#7fa6c9') },
      mid: { value: new THREE.Color('#c7dae6') },
      bot: { value: new THREE.Color('#e9ece6') },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0. ? mix(mid, top, pow(h, .6)) : mix(mid, bot, pow(-h, .5));
      gl_FragColor = vec4(c, 1.);
      #include <colorspace_fragment>
      }`,
  });
  scene.add(new THREE.Mesh(g, m));
}

/* ------------------------------------------------------------------ loading */
const manager = new THREE.LoadingManager();
manager.onProgress = (_u, done, total) => loadBar && loadBar.style.setProperty('--p', `${Math.round(100 * done / total)}%`);
const draco = new DRACOLoader(manager).setDecoderPath('vendor/three/examples/jsm/libs/draco/gltf/');
const gltfLoader = new GLTFLoader(manager).setDRACOLoader(draco);
const texLoader = new THREE.TextureLoader(manager);
const maxAniso = renderer.capabilities.getMaxAnisotropy();

// every file the scene loads carries the bake's build id, so a new bake never meets a cached old lightmap
let V = '';
function lightmap(name) {
  const t = texLoader.load(BASE + name + V, () => requestRender());
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.channel = 1;
  return t;
}

function extrasOf(o) {
  for (let p = o; p; p = p.parent) if (p.userData && p.userData.web_mode) return p.userData;
  return {};
}

function convert(mesh, man) {
  const ex = extrasOf(mesh);
  const mode = ex.web_mode || 'flat';
  const lmRange = man.lm_range || 4;
  const cbRange = man.cb_range || 2;
  const lmName = mode === 'lm' ? ((man.groups[ex.group] || {}).map || ex.web_map) : null;
  const lm = lmName ? (lmCache[lmName] ||= lightmap(lmName)) : null;
  const one = (src) => {
    if (src.map) src.map.anisotropy = maxAniso;
    const base = {
      map: src.map || null,
      color: src.color ? src.color.clone() : new THREE.Color(1, 1, 1),
      transparent: src.transparent, alphaTest: src.alphaTest || 0, side: src.side,
    };
    // words on surfaces: the paper albedo is replaced by a canvas drawn from the page's [data-slot] copy
    const slot = src.userData && src.userData.text_slot;
    if (slot) {
      const asp = src.userData.aspect || 1;
      const big = asp > 4 || /^(wb_|cb_)/.test(slot);       // long risers and the two wall boards get more pixels
      const tex = slotTexture(slot, asp, renderer, big ? 2048 : 1024);
      if (tex) { base.map = tex; base.color.setRGB(1, 1, 1); }
    }
    if (mode === 'lm') {
      if (ex.web_alpha || src.alphaTest > 0 || src.transparent) {
        // hair cards and leaves: soft edges via alpha to coverage (needs the antialiased canvas)
        Object.assign(base, { alphaTest: 0.25, transparent: false, side: THREE.DoubleSide, alphaToCoverage: true });
      }
      return new THREE.MeshBasicMaterial({ ...base, lightMap: lm, lightMapIntensity: lmRange * Math.PI });
    }
    if (mode === 'vc') {
      // small scanned props and indoor plants: light baked into vertex colours (value / range)
      base.color.multiplyScalar(lmRange);
      if (src.alphaTest > 0 || src.transparent) {
        Object.assign(base, { alphaTest: 0.25, transparent: false, side: THREE.DoubleSide, alphaToCoverage: true });
      }
      return new THREE.MeshBasicMaterial({ ...base, vertexColors: true });
    }
    if (mode === 'cb') {
      base.color.setScalar(cbRange);
      if (ex.web_alpha) { Object.assign(base, { alphaTest: 0.3, transparent: false, alphaToCoverage: true }); }
      return new THREE.MeshBasicMaterial(base);
    }
    if (mode === 'glass') {
      return new THREE.MeshBasicMaterial({ color: 0xdfe8ec, transparent: true, opacity: 0.1, depthWrite: false });
    }
    if (mode === 'screen') {
      if (src.emissiveMap || src.map) {
        return new THREE.MeshBasicMaterial({ map: src.emissiveMap || src.map, color: new THREE.Color(1.15, 1.15, 1.15) });
      }
      // a plain emitter (the projector strip in the living room bar): its own colour, brightened with the hologram
      const m = new THREE.MeshBasicMaterial({ color: (src.emissive || src.color).clone(), toneMapped: false });
      if (src.name === 'holo_emitter') { holoStrip = m; m.userData.base = m.color.clone(); }
      return m;
    }
    base.color.multiplyScalar(0.3);
    return new THREE.MeshBasicMaterial(base);
  };
  const tagged = (src) => {
    const m = one(src);
    if (src.userData && src.userData.frame_id) m.userData.frameId = src.userData.frame_id;
    return m;
  };
  mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tagged) : tagged(mesh.material);
  if (mesh.isSkinnedMesh) {
    mesh.frustumCulled = false;
  } else {
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
  }
}
const lmCache = {};
let holoStrip = null;
let grass = null;

/* ------------------------------------------------------------------ journey
   Stops are where the camera settles (with their copy); travels join them through waypoints.
   Lengths are in viewport heights of scroll. Portrait screens blend in pp/pt/plens. */
const B = (x, y, z) => new THREE.Vector3(x, z, -y);       // Blender -> three
let journey = null;
let manifest = null;
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const portraitMix = () => smoothstep(1.0, 0.62, camera.aspect);
const SENSOR = 36;

function journeyDef(cam, portrait) {
  const P = (c) => new THREE.Vector3(...c.pos);
  const stops = [
    { id: 'aerial', hold: 0.7, copy: '.h3-intro', wind: true,
      key: { p: P(cam.CAM_aerial), t: B(6.5, 8.6, 5.4), lens: cam.CAM_aerial.lens,
        // portrait: closer, house centred, room above for the name
        pp: B(39.5, -24.4, 31.4), pt: B(7.4, 7.0, 4.2), plens: 58 } },
    { travel: 3.0, via: [
      { p: B(26, -17, 11), t: B(11.0, 0.6, 1.6), lens: 46, at: 0.38 },
      { p: B(13.1, -4.2, 2.2), t: B(11.1, 1.2, 1.55), lens: 32, at: 0.66 },
      { p: B(11.55, -0.45, 1.86), t: B(10.7, 3.0, 1.4), lens: 30, at: 0.8 },
    ] },
    { id: 'studio', hold: 1.1, copy: '.h3-studio', idle: true,
      // aimed a little left of the Blender camera, so he, the laptop and the sunflower sit right of the text card
      key: { p: P(cam.CAM_studio), t: B(9.84, 4.78, 1.17), lens: cam.CAM_studio.lens,
        // portrait: step back a little and centre between laptop and sunflower
        pp: B(10.9, 3.5, 1.66), pt: B(10.2, 4.95, 1.2), plens: 27 } },
    // step back, turn to the doorway, line up with the corridor
    { travel: 1.8, via: [
      { p: B(10.35, 3.15, 1.66), t: B(8.9, 5.7, 1.56), lens: 28, at: 0.35 },
      { p: B(7.85, 3.75, 1.6), t: B(7.8, 9.5, 1.7), lens: 26, at: 0.78 },
    ] },
    // one-point perspective down the corridor: the camera stops just past each banner to read the next,
    // looking up a little, then walks on under it
    { id: 'hall', hold: 0.55, copy: '.h3-roomlabel[data-for="hall"]',
      key: { p: B(7.8, 4.35, 1.6), t: B(7.8, 6.9, 2.05), lens: 24, plens: 22 } },
    { travel: 1.1, via: [] },
    { id: 'hall2', hold: 0.55, copy: '.h3-roomlabel[data-for="hall"]',
      key: { p: B(7.8, 7.05, 1.6), t: B(7.8, 9.0, 2.08), lens: 24, plens: 22 } },
    { travel: 1.1, via: [] },
    { id: 'hall3', hold: 0.55, copy: '.h3-roomlabel[data-for="hall"]',
      key: { p: B(7.8, 9.15, 1.6), t: B(7.8, 11.1, 2.08), lens: 24, plens: 22 } },
    { travel: 1.6, via: [
      { p: B(7.8, 11.7, 1.58), t: B(7.8, 17.0, 1.6), lens: 24, plens: 22, at: 0.55 },
    ] },
  ];
  if (!portrait) {
    stops.push({ id: 'gallery', hold: 1.4, copy: '.h3-gallery', frames: true,
      key: { p: B(7.8, 12.75, 1.55), t: B(7.8, 17.6, 1.48), lens: 23 } });
  } else {
    stops.push(
      { id: 'gallery', hold: 1.0, copy: '.h3-gallery', frames: true,
        key: { p: B(6.1, 12.95, 1.5), t: B(6.1, 17.6, 1.52), lens: 26 } },
      { travel: 1.0, via: [] },
      { id: 'gallery2', hold: 0.8, copy: '.h3-gallery', frames: true,
        key: { p: B(9.5, 12.95, 1.5), t: B(9.5, 17.6, 1.52), lens: 26 } },
    );
  }
  stops.push(
    // pan away to the lounge: two sofas face each other, the bar between them lights up
    { travel: 1.6, via: [
      { p: B(7.1, 13.7, 1.5), t: B(4.2, 15.2, 1.2), lens: 26, at: 0.5 },
    ] },
    { id: 'living', hold: 1.4, holo: true, copy: '.h3-about, .h3-roomlabel[data-for="living"]',
      key: { p: B(5.35, 14.9, 1.42), t: B(2.2, 14.9, 1.1), lens: 26, pp: B(5.45, 14.9, 1.3), pt: B(2.2, 14.9, 1.16), plens: 22 } },
    // turn to the stair opening
    { travel: 1.6, via: [
      { p: B(5.95, 14.5, 1.5), t: B(5.9, 12.0, 1.5), lens: 25, at: 0.55 },
    ] },
    // look along the flight so the risers ahead can be read as they come
    { id: 'stairs', hold: 0.5, copy: '.h3-roomlabel[data-for="stairs"]',
      key: { p: B(6.35, 14.3, 1.55), t: B(6.35, 9.8, 1.6), lens: 24, plens: 20 } },
    // eye 1.55 m over the tread underfoot, looking 3 m ahead and a little down, so each milestone
    // riser rises through the middle of the view about two metres before the foot reaches it
    { travel: 4.2, linear: true, keepCopy: true, via: [
      { p: B(6.35, 12.4, 1.56), t: B(6.35, 9.4, 1.08), lens: 24, plens: 20, at: 0.2 },
      { p: B(6.35, 11.1, 2.27), t: B(6.35, 8.1, 1.77), lens: 24, plens: 20, at: 0.42 },
      { p: B(6.35, 9.9, 2.99), t: B(6.35, 6.9, 2.5), lens: 24, plens: 20, at: 0.64 },
      { p: B(6.35, 8.7, 3.72), t: B(6.35, 5.7, 3.3), lens: 24, plens: 20, at: 0.86 },
    ] },
    { id: 'landing', hold: 0.6,
      key: { p: B(6.35, 7.2, 4.82), t: B(6.0, 3.0, 4.72), lens: 24, plens: 20 } },
    // the workshop: turn to each wall in turn
    { travel: 1.5, via: [
      { p: B(6.7, 5.6, 4.85), t: B(9.0, 3.6, 4.8), lens: 27, at: 0.5 },
    ] },
    { id: 'whiteboard', hold: 1.1, copy: '.h3-roomlabel[data-for="whiteboard"]',
      key: { p: B(6.95, 4.1, 4.85), t: B(9.875, 4.1, 4.85), lens: 30, pp: B(5.9, 4.1, 4.85), plens: 22 } },
    { travel: 1.4, via: [
      { p: B(6.6, 3.7, 4.88), t: B(7.9, 1.2, 4.8), lens: 30, at: 0.5 },
    ] },
    { id: 'toolrail', hold: 1.1, copy: '.h3-roomlabel[data-for="toolrail"]',
      key: { p: B(5.75, 3.85, 4.9), t: B(5.75, 1.125, 4.65), lens: 30, pp: B(5.75, 6.05, 5.0), pt: B(5.75, 1.125, 4.7), plens: 24 } },
    { travel: 1.4, via: [
      { p: B(4.8, 3.6, 4.88), t: B(2.6, 2.6, 4.8), lens: 30, at: 0.5 },
    ] },
    { id: 'chalkboard', hold: 1.1, copy: '.h3-roomlabel[data-for="chalkboard"]',
      key: { p: B(4.55, 4.1, 4.85), t: B(1.625, 4.1, 4.85), lens: 30, pp: B(5.8, 4.1, 4.85), plens: 22 } },
    // back out through the gable window, still facing the house, and pull away to the front
    { travel: 3.4, via: [
      { p: B(5.35, 3.4, 5.1), t: B(5.6, 8.5, 4.9), lens: 28, at: 0.2 },
      { p: B(5.35, 1.6, 6.15), t: B(5.6, 8.5, 5.2), lens: 28, at: 0.36 },
      { p: B(5.35, 0.1, 6.25), t: B(5.6, 8.5, 5.0), lens: 28, at: 0.46 },
      { p: B(5.9, -6.5, 5.3), t: B(6.3, 8.0, 3.8), lens: 30, at: 0.72 },
    ] },
    { id: 'front', hold: 1.2, copy: '.h3-contact', wind: true,
      key: { p: B(6.5, -17.5, 2.6), t: B(6.5, 6.0, 3.5), lens: 30, pp: B(6.5, -26, 3.2), plens: 30 } },
  );
  return stops;
}

function resolveKey(key, k) {
  const out = { p: key.p.clone(), t: key.t.clone(), lens: key.lens };
  if (key.pp) out.p.lerp(key.pp, k);
  if (key.pt) out.t.lerp(key.pt, k);
  if (key.plens) out.lens += (key.plens - key.lens) * k;
  return out;
}

let skipUntil = Infinity;
function buildJourney(man) {
  const def = journeyDef(man.cameras, portraitMix() > 0.5);
  const k = portraitMix();
  const segs = [];
  let s = 0;
  let prevStop = null;
  for (let i = 0; i < def.length; i++) {
    const d = def[i];
    if (d.key) {
      const key = resolveKey(d.key, k);
      segs.push({ type: 'hold', s0: s, s1: s + d.hold, key, stop: d });
      s += d.hold;
      prevStop = { key, stop: d };
    } else if (d.travel) {
      const next = def[i + 1];
      const to = resolveKey(next.key, k);
      const keys = [prevStop.key, ...d.via.map((v) => resolveKey(v, k)), to];
      const times = [0, ...d.via.map((v) => v.at), 1];
      segs.push({
        type: 'travel', s0: s, s1: s + d.travel, keys, times, from: prevStop.stop, to: next, linear: !!d.linear,
        keepCopy: !!d.keepCopy,
        pc: new THREE.CatmullRomCurve3(keys.map((q) => q.p), false, 'centripetal'),
        tc: new THREE.CatmullRomCurve3(keys.map((q) => q.t), false, 'centripetal'),
        lens: keys.map((q) => Math.log(q.lens)),
      });
      s += d.travel;
    }
  }
  journey = { segs, length: s };
  const studioHold = segs.find((g) => g.type === 'hold' && g.stop.id === 'studio');
  skipUntil = studioHold ? studioHold.s1 : Infinity;
  track.style.height = `${(s + 1) * 100}vh`;
}

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const smooth = (x) => x * x * (3 - 2 * x);
const _t = new THREE.Vector3();
let idle = false;

function segAt(s) {
  const segs = journey.segs;
  for (const g of segs) if (s <= g.s1) return g;
  return segs[segs.length - 1];
}

function setLens(lens) {
  const hfov = 2 * Math.atan(SENSOR / 2 / lens);
  let vfov = 2 * Math.atan(Math.tan(hfov / 2) / camera.aspect);
  vfov = Math.min(vfov, THREE.MathUtils.degToRad(72));
  camera.fov = THREE.MathUtils.radToDeg(vfov);
  camera.updateProjectionMatrix();
}

function place(u) {             // u: 0..1 along the whole journey
  const s = Math.min(1, Math.max(0, u)) * journey.length;
  const g = segAt(s);
  idle = false;
  if (g.type === 'hold') {
    camera.position.copy(g.key.p);
    _t.copy(g.key.t);
    setLens(g.key.lens);
    idle = !!g.stop.idle;
  } else {
    let f = (s - g.s0) / (g.s1 - g.s0);
    if (reduced) f = f < 0.5 ? 0 : 1;
    const e = g.linear ? smooth(smooth(f)) * 0.35 + f * 0.65 : ease(f);
    const { times } = g;
    const n = times.length - 1;
    let i = 0;
    while (i < n - 1 && e > times[i + 1]) i++;
    const ff = Math.min(1, Math.max(0, (e - times[i]) / (times[i + 1] - times[i])));
    const t = (i + ff) / n;
    g.pc.getPoint(t, camera.position);
    g.tc.getPoint(t, _t);
    setLens(Math.exp(g.lens[i] + (g.lens[i + 1] - g.lens[i]) * smooth(ff)));
    idle = !!g.to.idle && f > 0.96;
  }
  if (idle && !reduced) {
    const tt = performance.now() / 1000;
    camera.position.x += Math.sin(tt * 0.53) * 0.004;
    camera.position.y += Math.sin(tt * 0.71 + 1.3) * 0.003;
  }
  camera.lookAt(_t.add(look));
  return g;
}

/* gentle look-around with the pointer (fine pointers only) */
const look = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
if (!reduced && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  addEventListener('pointermove', (e) => {
    const nx = e.clientX / innerWidth - 0.5;
    const ny = e.clientY / innerHeight - 0.5;
    lookTarget.set(nx * 0.35, -ny * 0.2, 0);
    requestRender();
  }, { passive: true });
}

/* ------------------------------------------------------------------ scroll and copy */
function progress() {
  const r = track.getBoundingClientRect();
  const total = track.offsetHeight - innerHeight;
  return Math.min(1, Math.max(0, -r.top / total));
}
function copyOpacity(stop, s) {
  // visible through the stop's hold; fades in over the end of the travel before it, out over the start of the one after.
  // A travel between two stops that share a heading, or one marked keepCopy, keeps it up the whole way.
  let o = 0;
  for (const g of journey.segs) {
    if (g.type === 'hold' && g.stop === stop && s >= g.s0 && s <= g.s1) o = 1;
    if (g.type === 'travel' && g.from === stop && s >= g.s0 && s <= g.s1 &&
        (g.from.copy === g.to.copy || g.keepCopy)) {
      o = Math.max(o, g.keepCopy && g.from.copy !== g.to.copy ? 1 - smoothstep(0.88, 1.0, (s - g.s0) / (g.s1 - g.s0)) : 1);
    }
    if (g.type === 'travel' && g.to === stop && s >= g.s0 && s < g.s1) o = Math.max(o, smoothstep(0.85, 1.0, (s - g.s0) / (g.s1 - g.s0)));
    if (g.type === 'travel' && g.from === stop && s >= g.s0 && s <= g.s1) o = Math.max(o, 1 - smoothstep(0.0, 0.12, (s - g.s0) / (g.s1 - g.s0)));
  }
  return o;
}
function beats(u) {
  const s = u * journey.length;
  const byEl = new Map();
  for (const g of journey.segs) {
    if (g.type !== 'hold' || !g.stop.copy) continue;
    byEl.set(g.stop.copy, Math.max(byEl.get(g.stop.copy) || 0, copyOpacity(g.stop, s)));
  }
  for (const [sel, o] of byEl) {
    for (const el of document.querySelectorAll(sel)) {
      el.style.setProperty('--o', o.toFixed(3));
      el.classList.toggle('is-live', o > 0.6);
    }
  }
}

/* ------------------------------------------------------------------ nav: fly to a room
   Links carry data-stop (and an href to the same section of the text page, for no-JS). */
function stopScrollY(id) {
  const g = journey && journey.segs.find((q) => q.type === 'hold' && q.stop.id === id);
  if (!g) return null;
  const total = track.offsetHeight - innerHeight;
  return track.offsetTop + ((g.s0 + g.s1) / 2) / journey.length * total;
}
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('[data-stop]');
  if (!a) return;
  const y = stopScrollY(a.dataset.stop);
  if (y == null) return;
  e.preventDefault();
  const menu = a.closest('details');
  if (menu) menu.open = false;
  scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
});

/* ------------------------------------------------------------------ project frames
   A material named FRAME_<id> is a project on the gallery wall. The pointer can click it;
   keyboard users get a real button placed over it while it is on screen. */
const FRAMES = {
  console: { url: 'case-study.html', title: 'Enterprise Console' },
  apb: { url: 'apb.html', title: 'APB: Agentic Process Builder' },
};
const clickables = [];
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function frameIdAt(hit) {
  const m = Array.isArray(hit.object.material) ? hit.object.material[hit.face.materialIndex] : hit.object.material;
  const id = m && m.userData && m.userData.frameId;
  return id && FRAMES[id] ? id : null;
}
function registerFrames(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => m.userData.frameId)) clickables.push(o);
  });
}
canvas.addEventListener('click', (e) => {
  if (!clickables.length) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(clickables, false)[0];
  const id = hit && frameIdAt(hit);
  if (id) openCase(FRAMES[id].url, FRAMES[id].title, canvas);
});
canvas.addEventListener('pointermove', (e) => {
  if (!clickables.length) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(clickables, false)[0];
  canvas.style.cursor = hit && frameIdAt(hit) ? 'pointer' : '';
}, { passive: true });


/* living room hologram */
let holo = null;
function holoPower(s) {
  let pw = 0;
  for (const g of journey.segs) {
    if (g.type === 'hold' && g.stop.holo && s >= g.s0 && s <= g.s1) pw = 1;
    if (g.type === 'travel' && g.to.holo && s >= g.s0 && s < g.s1) pw = Math.max(pw, smoothstep(0.55, 1.0, (s - g.s0) / (g.s1 - g.s0)));
    if (g.type === 'travel' && g.from.holo && s >= g.s0 && s <= g.s1) pw = Math.max(pw, 1 - smoothstep(0.0, 0.35, (s - g.s0) / (g.s1 - g.s0)));
  }
  return reduced ? (pw > 0.5 ? 1 : 0) : pw;
}

/* accessible buttons over the framed projects (world size and position from the Blender layout) */
const FRAME_BOXES = {
  console: { c: B(5.25, 17.674, 1.55), w: 1.25, h: 0.95 },
  apb: { c: B(6.95, 17.674, 1.55), w: 1.25, h: 0.95 },
};
const _v = new THREE.Vector3();
function placeFrameButtons(active) {
  const r = canvas.getBoundingClientRect();
  for (const btn of document.querySelectorAll('.h3-frame')) {
    const box = FRAME_BOXES[btn.dataset.frame];
    btn.tabIndex = active ? 0 : -1;
    if (!active || !box) { btn.style.setProperty('--x', '-999px'); continue; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = false;
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      _v.set(box.c.x + dx * box.w / 2, box.c.y + dy * box.h / 2, box.c.z).project(camera);
      if (_v.z > 1) behind = true;
      const sx = (_v.x + 1) / 2 * r.width, sy = (1 - _v.y) / 2 * r.height;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    if (behind) { btn.style.setProperty('--x', '-999px'); continue; }
    btn.style.setProperty('--x', `${x0.toFixed(1)}px`);
    btn.style.setProperty('--y', `${y0.toFixed(1)}px`);
    btn.style.setProperty('--w', `${(x1 - x0).toFixed(1)}px`);
    btn.style.setProperty('--h', `${(y1 - y0).toFixed(1)}px`);
  }
}

/* ------------------------------------------------------------------ render loop */
let needs = true;
let lastCut = -1;
let mixer = null;
const clock = new THREE.Clock();
let raf = 0;
function requestRender() { needs = true; if (!raf) raf = requestAnimationFrame(frame); }
function frame() {
  raf = 0;
  if (!journey) return;
  const p = progress();
  look.lerp(lookTarget, 0.08);
  const g = place(p);
  if (reduced) {
    const where = g.type === 'hold' ? g.stop.id : ((p * journey.length - g.s0) / (g.s1 - g.s0) < 0.5 ? g.from.id : g.to.id);
    if (where !== lastCut) {
      if (lastCut !== -1) { stage.classList.remove('h3-cut'); void stage.offsetWidth; stage.classList.add('h3-cut'); }
      lastCut = where;
    }
  }
  beats(p);
  // the skip link is for the opening; past the studio the nav carries the section links
  stage.classList.toggle('h3-skip-off', p * journey.length > skipUntil);
  placeFrameButtons(g.type === 'hold' && !!g.stop.frames && copyOpacity(g.stop, p * journey.length) > 0.6);
  let glowing = false;
  if (holo) {
    const pw = holoPower(p * journey.length);
    holo.set(pw, reduced ? 0 : performance.now() / 1000);
    if (holoStrip) holoStrip.color.copy(holoStrip.userData.base).multiplyScalar(0.45 + 0.9 * pw);
    glowing = pw > 0.001 && !reduced;
  }
  // wind in the grass, while the lawn is what we are looking at (outside, flying in, flying out)
  const outdoors = g.type === 'hold' ? !!g.stop.wind : !!(g.from.wind || g.to.wind);
  const windy = !!grass && outdoors && !reduced;
  if (grass) grass.update(reduced ? 0 : performance.now() / 1000, camera.position);
  const dt = Math.min(clock.getDelta(), 0.05);
  const typing = (mixer && !reduced && idle || glowing || windy) && document.visibilityState === 'visible';
  if (typing && mixer && idle) mixer.update(dt);
  renderer.render(scene, camera);
  const settling = look.distanceTo(lookTarget) > 0.002;
  if (settling || typing || needs) { needs = false; if (settling || typing) requestRender(); }
}

let lastMix = -1;
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const m = portraitMix();
  if (manifest && Math.abs(m - lastMix) > 0.01) { buildJourney(manifest); lastMix = m; }
  requestRender();
}
addEventListener('resize', resize);
addEventListener('scroll', requestRender, { passive: true });

/* ------------------------------------------------------------------ boot */
(async function boot() {
  resize();
  const man = await fetch(BASE + 'house.json', { cache: 'no-cache' }).then(r => r.json());
  manifest = man;
  V = man.build ? `?v=${man.build}` : '';
  buildJourney(man);
  lastMix = portraitMix();
  const [gltf] = await Promise.all([gltfLoader.loadAsync(BASE + 'house.glb' + V), fontsReady()]);
  gltf.scene.traverse((o) => { if (o.isMesh) convert(o, man); });
  registerFrames(gltf.scene);
  scene.add(gltf.scene);
  // grass on the lawn: fewer blades on phones
  let lawnMesh = null;
  gltf.scene.traverse((o) => { if (!lawnMesh && o.isMesh && o.name.startsWith('G_lawn') && o.material.map) lawnMesh = o; });
  if (lawnMesh) {
    const small = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
    const q = new URLSearchParams(location.search);          // debug: ?grass=<blades per m²>
    grass = makeGrass({ lawnMesh, perSqm: q.has('grass') ? Number(q.get('grass')) : small ? 75 : 150, width: small ? 1.15 : 1 });
    scene.add(grass.group);
  }
  holo = makeHologram({ center: B(2.2, 14.9, 1.16), width: 2.0, height: 1.125, facing: new THREE.Vector3(1, 0, 0), barTop: 0.412 });
  scene.add(holo.group);
  if (gltf.animations.length) {
    mixer = new THREE.AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) mixer.clipAction(clip).play();
    mixer.update(0);
  }
  const spriteTex = {};
  for (const t of man.trees || []) {
    let tex = spriteTex[t.sprite];
    if (!tex) {
      tex = spriteTex[t.sprite] = texLoader.load(BASE + t.sprite + V, () => requestRender());
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.4, toneMapped: false }));
    s.position.set(...t.pos);
    s.scale.set(t.size, t.size, 1);
    scene.add(s);
  }
  await Promise.all([new Promise((res) => (manager.onLoad = res, setTimeout(res, 4000))), grass && grass.ready]);
  doc.classList.add('h3-ready');
  const q = new URLSearchParams(location.search);
  if (q.has('p')) {                     // debug: jump to a point on the flight (0..1 of the track)
    const total = track.offsetHeight - innerHeight;
    scrollTo(0, track.offsetTop + Number(q.get('p')) * total);
  }
  requestRender();
  // debug capture: render the flight at u (0..1, or 'stop:<id>' / 'travel:<from id>:<fraction>') at w x h
  // and send it to the local shot sink
  const resolveU = (u) => {
    if (typeof u === 'number') return u;
    const [kind, id, f] = u.split(':');
    const g = journey.segs.find((q) => (kind === 'stop' ? q.type === 'hold' && q.stop.id === id : q.type === 'travel' && q.from.id === id));
    if (!g) return 0;
    const k = kind === 'stop' ? 0.5 : Number(f);
    return (g.s0 + k * (g.s1 - g.s0)) / journey.length;
  };
  const shot = (name, u, w = 1600, h = 900, t) => new Promise((res) => {
    if (mixer && t !== undefined) mixer.setTime(t);
    const prev = [stage.clientWidth, stage.clientHeight];
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    buildJourney(manifest);
    look.set(0, 0, 0);
    const uu = resolveU(u);
    place(uu);
    if (grass) grass.update(t ?? 5, camera.position);
    if (holo) holo.set(holoPower(uu * journey.length), 10);
    renderer.render(scene, camera);
    canvas.toBlob(async (b) => {
      await fetch(`http://localhost:8799/save?name=${encodeURIComponent(name)}`, { method: 'POST', body: b });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(prev[0], prev[1], false);
      camera.aspect = prev[0] / prev[1];
      buildJourney(manifest);
      requestRender();
      res(name);
    }, 'image/png');
  });
  window.__h3 = { renderer, scene, camera, progress, place, shot, journey: () => journey };
})().catch((err) => {
  console.error(err);
  doc.classList.add('h3-failed');
});
