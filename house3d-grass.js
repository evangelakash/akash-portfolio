/* The lawn, painted the way anime paints a meadow (Ghibli, Shinkai): broad blades that run from a deep teal
   root to a bright yellow-green tip, clean colour rather than photographic sparkle, crisp shadows gone blue, and
   wind you can see: gusts roll across the lawn and the grass they press down turns pale in the light.
   Blades are instanced in 8 m tiles; the camera culls tiles it cannot see and thins far tiles (the blades that
   stay grow wider, so the lawn keeps its body). Each blade is a curved, tapering strip in one of two tip colours
   by patch, with a few straw-coloured ones.
   Light: the sun (22 degrees up, east-south-east, the same sun as the bake) warms each blade, a little more on the
   side facing it; the baked lawn says where the house and trees cast shade, so their shadows carry on through the
   grass, with painted edges.
   Wind, in three layers: a slow sway, gust waves rolling across the lawn, and a quick flutter.
   Colours are display colours (no tone mapping). Blender (x, y, z) is three (x, z, -y). */
import * as THREE from 'three';

const SUN = new THREE.Vector3(0.882, 0.375, 0.287).normalize();   // toward the sun, as in build_house.py
const PALETTE = {
  root: '#2a6a33', mid: '#4a9a3a', tipA: '#8cc84a', tipB: '#b6dc58', dry: '#e0d56a',
  deep: '#33713a', top: '#5fa33e', streak: '#eaf8a2',
};
const SUNLIGHT = [1.0, 0.96, 0.84];
const SKYLIGHT = [0.42, 0.56, 0.82];       // shade in anime is blue

const NOISE = /* glsl */`
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1., 0.)), u.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), u.x), u.y); }
// gust waves: long bands across the wind rolling downwind, faster ripples riding on them; 0..1
float gust(vec2 xz, float t, vec2 dir){
  vec2 q = vec2(dot(xz, dir), dot(xz, vec2(-dir.y, dir.x)));
  return vnoise(vec2(q.x * .085 - t * .5, q.y * .03)) * .62 + vnoise(vec2(q.x * .19 - t * 1.05, q.y * .07) + 7.3) * .38;
}
// the bake as light: x = sun 0..1 (with a painted, fairly crisp edge), y = sky 0..1, from the lawn's baked
// brightness relative to open sun
vec2 bakeLight(float ratio){ return vec2(smoothstep(.62, .82, ratio), clamp(ratio * 2., .45, 1.)); }
// patches, shared by the blades and the ground: lighter and darker, yellower and bluer, from 30 cm to 15 m across
vec3 patchTint(vec2 xz){
  float m = vnoise(xz * .18) * .55 + vnoise(xz * .7 + 4.1) * .45;
  float hue = vnoise(xz * .06 + 2.3) * .6 + vnoise(xz * .31 + 8.1) * .4;
  return mix(.82, 1.14, m) * mix(vec3(.93, 1., 1.1), vec3(1.12, 1.04, .86), hue);
}
`;

const bladeVert = /* glsl */`
uniform float time; uniform vec2 wind; uniform float strength;
uniform sampler2D lawn; uniform vec3 uvU; uniform vec3 uvV; uniform float litLum;
uniform vec3 cam; uniform vec3 sun; uniform vec3 sunCol; uniform vec3 skyCol;
uniform vec3 lod;            // all blades out to x m, thinned to z of them by y m
uniform vec2 fade;           // blades shrink away between these distances
uniform vec4 bounds;         // grass area, world x/z: min x, min z, max x, max z (edges fade over 6 m)
uniform vec3 cRoot; uniform vec3 cMid; uniform vec3 cTipA; uniform vec3 cTipB; uniform vec3 cDry; uniform vec3 cStreak;
attribute vec2 tv;           // t along the blade 0..1, side -1 / 0 / 1
attribute vec3 offset;       // root, world
attribute vec4 blade;        // yaw, height, width, lean
attribute vec2 seeds;        // random 0..1, rank in its tile 0..1 (thinning drops the highest ranks)
varying vec3 vCol;
${NOISE}
void main(){
  float t = tv.x, side = tv.y, seed = seeds.x;
  float d = distance(offset, cam);
  float keep = mix(1., lod.z, smoothstep(lod.x, lod.y, d));
  float edge = min(min(offset.x - bounds.x, bounds.z - offset.x), min(offset.z - bounds.y, bounds.w - offset.z));
  float h = blade.y * (1. - smoothstep(keep * .8, keep, seeds.y)) * (1. - smoothstep(fade.x, fade.y, d)) * smoothstep(0., 6., edge);
  float w = blade.z * min(inversesqrt(keep), 2.2);
  vec2 face = vec2(cos(blade.x), sin(blade.x));
  vec2 across = vec2(-face.y, face.x);
  // wind: slow sway, gust waves, flutter
  float g = gust(offset.xz, time, wind);
  float press = smoothstep(.45, .88, g);
  float sway = sin(time * 1.1 - dot(offset.xz, wind) * .35 + seed * 1.3) * .13;
  float flutter = sin(time * 7.3 + seed * 43.) * .05 * (1. - .5 * press);
  float bend = (.12 + sway + press * 1.1) * strength + flutter;
  // shape: a quadratic curve to a tip pushed by lean and wind; the blade keeps its length
  vec2 D = (face * blade.w + wind * bend) * h;
  D *= min(1., .88 * h / max(length(D), 1e-5));
  vec3 p1 = vec3(D.x * .15, h * .62, D.y * .15);
  vec3 p2 = vec3(D.x, sqrt(max(h * h - dot(D, D), 0.)), D.y);
  float u = 1. - t;
  vec3 T = normalize(2. * u * p1 + 2. * t * (p2 - p1) + vec3(0., 1e-5, 0.));
  vec3 W = vec3(across.x, 0., across.y);
  vec3 pos = offset + 2. * u * t * p1 + t * t * p2 + W * side * w * .5 * (1. - pow(t, 1.4));
  // light: the side we see, rounded across the blade
  vec3 V = normalize(cam - pos);
  vec3 N = normalize(cross(W, T));
  if (dot(N, V) < 0.) N = -N;
  N = normalize(N + W * side * .55);
  float ndl = dot(N, sun);
  float diff = ndl * .5 + .5; diff *= diff;
  float through = pow(clamp(dot(-V, sun), 0., 1.), 3.) * (1. - .5 * abs(ndl));
  vec2 luv = vec2(dot(uvU, vec3(offset.xz, 1.)), dot(uvV, vec3(offset.xz, 1.)));
  vec2 bl = bakeLight(dot(texture2D(lawn, luv).rgb, vec3(.2126, .7152, .0722)) / litLum);
  // colour: a deep teal root to a bright tip, two tip colours by patch, a few straw tips, each blade a little different
  vec3 tip = mix(cTipA, cTipB, smoothstep(.3, .75, vnoise(offset.xz * .3 + 3.1)));
  tip = mix(tip, cDry, step(.965, fract(seed * 13.7)) * .8);
  vec3 alb = mix(cRoot, cMid, smoothstep(0., .45, t));
  alb = mix(alb, tip, smoothstep(.35, 1., t));
  alb *= mix(.92, 1.08, seed) * patchTint(offset.xz);
  // light: warm sun or blue shade, only gently changed by the way the blade faces
  vec3 col = mix(alb * skyCol * bl.y, alb * sunCol * mix(.84, 1.12, diff), bl.x);
  col += cStreak * smoothstep(.55, 1., t) * max(ndl, 0.) * bl.x * .18;       // sunlit tips
  col += alb * vec3(.9, 1., .35) * through * bl.x * t * .5;
  // gusts: the grass they press down turns to the light in a pale sweep
  col = mix(col, cStreak * mix(.55, 1., bl.x), press * smoothstep(.25, 1., t) * .55);
  vCol = col;
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.);
}`;

const bladeFrag = /* glsl */`
varying vec3 vCol;
void main(){
  gl_FragColor = vec4(vCol, 1.);
  #include <colorspace_fragment>
}`;

// least-squares affine map from world (x, z) to the lawn's baked UVs
function fitUV(mesh) {
  const pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
  mesh.updateWorldMatrix(true, false);
  const v = new THREE.Vector3();
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bu = [0, 0, 0], bv = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const r = [v.x, v.z, 1];
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) A[a][b] += r[a] * r[b];
      bu[a] += r[a] * uv.getX(i);
      bv[a] += r[a] * uv.getY(i);
    }
  }
  const M = new THREE.Matrix3().set(...A[0], ...A[1], ...A[2]).invert();
  const solve = (b) => new THREE.Vector3(...b).applyMatrix3(M);
  return { U: solve(bu), V: solve(bv) };
}

// the baked lawn's brightness in open sun (its 85th percentile, linear), to read the bake as light and shade
function sunlitLuminance(map) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(map.image, 0, 0, S, S);
  const d = ctx.getImageData(0, 0, S, S).data;
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = [];
  for (let i = 0; i < d.length; i += 4) L.push(0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]));
  L.sort((a, b) => a - b);
  return Math.max(1e-3, L[Math.floor(L.length * 0.85)]);
}

// one blade: a row of two vertices per level and a tip
function bladeGeometry(levels) {
  const tv = [];
  for (const t of levels) tv.push(t, -1, t, 1);
  tv.push(1, 0);
  const index = [];
  for (let i = 0; i < levels.length - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const last = (levels.length - 1) * 2;
  index.push(last, last + 1, last + 2);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(tv.length / 2 * 3), 3));
  g.setAttribute('tv', new THREE.Float32BufferAttribute(tv, 2));
  g.setIndex(index);
  return g;
}

// a metre of turf seen from above, painted as thousands of tapering blades, lower layers darker (tiles seamlessly);
// the ground shows it up close, between the real blades
function paintTurf(canvas) {
  const S = canvas.width, g = canvas.getContext('2d');
  g.fillStyle = '#383838';
  g.fillRect(0, 0, S, S);
  let s = 3141592653;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  const N = 7000;
  for (let i = 0; i < N; i++) {
    const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI * 2;
    const len = 18 + rnd() * 42, w = 3 + rnd() * 3, bow = (rnd() - 0.5) * 0.5;
    const v = Math.round(55 + 160 * (i / N) + (rnd() - 0.5) * 50);
    g.fillStyle = `rgb(${v},${v},${v})`;
    const dx = Math.cos(a), dy = Math.sin(a);
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const bx = x + ox, by = y + oy;
        if (bx < -70 || bx > S + 70 || by < -70 || by > S + 70) continue;
        const tx = bx + dx * len, ty = by + dy * len, cx = bx + dx * len * 0.5 - dy * len * bow, cy = by + dy * len * 0.5 + dx * len * bow;
        g.beginPath();
        g.moveTo(bx - dy * w / 2, by + dx * w / 2);
        g.quadraticCurveTo(cx, cy, tx, ty);
        g.quadraticCurveTo(cx, cy, bx + dy * w / 2, by - dx * w / 2);
        g.fill();
      }
    }
  }
}

/* Blender-space rectangles the grass stays out of: the house, deck, paths, steps */
const KEEP_OUT = [
  [-0.16, -0.18, 13.16, 17.96],       // house walls and plinth
  [7.5, -3.45, 13.5, 0.0],            // deck and its step
  [2.72, -14.1, 4.08, -0.8],          // front path
  [2.52, -1.02, 4.28, 0.0],           // door step
  [3.92, -3.5, 8.28, -2.52],          // path to the deck
];
// distance to the nearest of them (negative inside one)
function keepOutDistance(x, y) {
  let d = Infinity;
  for (const r of KEEP_OUT) {
    const dx = Math.max(r[0] - x, x - r[2]), dy = Math.max(r[1] - y, y - r[3]);
    const e = dx > 0 && dy > 0 ? Math.sqrt(dx * dx + dy * dy) : Math.max(dx, dy);
    if (e < d) d = e;
  }
  return d;
}
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
// how thick the grass grows: fullest where the camera comes down to it (the front lawn, the east lawn it flies
// over), under half 10 m away, a quarter out at the edges of the lawn
const FULL = [[-8, -30, 24, 0], [13, -30, 32, 12]];
function fullDistance(x0, y0, x1, y1) {           // from a rectangle (or a point) to the nearest full area
  let d = Infinity;
  for (const r of FULL) {
    const dx = Math.max(r[0] - x1, 0, x0 - r[2]), dy = Math.max(r[1] - y1, 0, y0 - r[3]);
    d = Math.min(d, Math.sqrt(dx * dx + dy * dy));
  }
  return d;
}
const density = (d) => (1 - 0.55 * smooth(0, 10, d)) * (1 - 0.45 * smooth(10, 30, d));
// clumps: a smooth 0..1 field so the lawn grows in tufts rather than evenly (value noise on a 2.9 m grid)
const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
function clumpField(x0, y0, x1, y1) {
  const F = 0.35, cx = Math.floor(x0 * F) - 1, cy = Math.floor(y0 * F) - 1;
  const w = Math.ceil(x1 * F) - cx + 3, h = Math.ceil(y1 * F) - cy + 3;
  const cells = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cells[j * w + i] = hash(i + cx, j + cy);
  return (x, y) => {
    const fx = x * F - cx, fy = y * F - cy, ix = Math.floor(fx), iy = Math.floor(fy), ux = fx - ix, uy = fy - iy;
    const sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy);
    const o = iy * w + ix, a = cells[o], b = cells[o + 1], c = cells[o + w], d = cells[o + w + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

export function makeGrass({ lawnMesh, perSqm = 150, width = 1, windDir = [1, 0.35] }) {
  const map = lawnMesh.material.map;
  const { U, V } = fitUV(lawnMesh);
  const litLum = sunlitLuminance(map);                       // raw map units: the blades read the map directly
  const extent = new THREE.Box3().setFromObject(lawnMesh);
  const gy = extent.max.y;                                     // the lawn is flat
  const TILE = 8;                                              // Blender metres, over the whole lawn
  const X0 = extent.min.x, X1 = extent.max.x, Y0 = -extent.max.z, Y1 = -extent.min.z;
  const LOD = new THREE.Vector3(14, 55, 0.2);
  const col = (hex) => new THREE.Color(hex);
  const uniforms = {
    time: { value: 0 }, wind: { value: new THREE.Vector2(...windDir).normalize() }, strength: { value: 0.75 },
    lawn: { value: map }, uvU: { value: U }, uvV: { value: V }, litLum: { value: litLum },
    cam: { value: new THREE.Vector3() }, sun: { value: SUN }, lod: { value: LOD }, fade: { value: new THREE.Vector2(70, 95) },
    sunCol: { value: new THREE.Vector3(...SUNLIGHT) }, skyCol: { value: new THREE.Vector3(...SKYLIGHT) },
    bounds: { value: new THREE.Vector4(X0, -Y1, X1, -Y0) },
    cRoot: { value: col(PALETTE.root) }, cMid: { value: col(PALETTE.mid) }, cTipA: { value: col(PALETTE.tipA) },
    cTipB: { value: col(PALETTE.tipB) }, cDry: { value: col(PALETTE.dry) }, cStreak: { value: col(PALETTE.streak) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: bladeVert, fragmentShader: bladeFrag, side: THREE.DoubleSide, toneMapped: false,
  });
  const nearGeo = bladeGeometry([0, 0.15, 0.32, 0.5, 0.68, 0.84]);   // smooth bends up close
  const farGeo = bladeGeometry([0, 0.4, 0.75]);
  const group = new THREE.Group();
  group.name = 'grass';
  const tiles = [];
  let s = 2463534242;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };   // xorshift32
  const clump = clumpField(X0, Y0, X1, Y1);
  let total = 0;
  // one 8 m tile of blades
  function growTile(tx, ty) {
    const most = density(fullDistance(tx, ty, tx + TILE, ty + TILE));    // the thickest this tile grows
    const n = Math.round(TILE * TILE * perSqm * most);
    const off = new Float32Array(n * 3), bl = new Float32Array(n * 4), sd = new Float32Array(n * 2);
    let count = 0;
    for (let i = 0; i < n; i++) {
      const x = tx + rnd() * TILE, y = ty + rnd() * TILE;
      if (x > X1 || y > Y1) continue;
      const k = clump(x, y), edge = keepOutDistance(x, y);
      if (edge < 0.02 || rnd() * most > density(fullDistance(x, y, x, y)) * (0.45 + 0.55 * k)) continue;
      // thicker tufts grow taller; along walls, the deck and paths the grass is short, so it cannot lean through
      const tall = (rnd() < 0.06 ? 1.4 : 1) * (0.8 + 0.4 * k) * (0.35 + 0.65 * smooth(0, 0.6, edge));
      const o = count * 3, b = count * 4;
      off[o] = x; off[o + 1] = gy; off[o + 2] = -y;
      bl[b] = rnd() * Math.PI * 2; bl[b + 1] = (0.14 + rnd() * 0.2) * tall; bl[b + 2] = (0.032 + rnd() * 0.02) * width; bl[b + 3] = rnd() * 0.5;
      sd[count * 2] = rnd();
      count++;
    }
    if (!count) return;
    for (let i = 0; i < count; i++) sd[i * 2 + 1] = i / count;         // blades are in random order already
    const attrs = {
      offset: new THREE.InstancedBufferAttribute(off.slice(0, count * 3), 3),
      blade: new THREE.InstancedBufferAttribute(bl.slice(0, count * 4), 4),
      seeds: new THREE.InstancedBufferAttribute(sd.slice(0, count * 2), 2),
    };
    const box = new THREE.Box3(new THREE.Vector3(tx, gy, -(ty + TILE)), new THREE.Vector3(tx + TILE, gy + 0.45, -ty));
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    sphere.radius += 0.3;
    const lods = [nearGeo, farGeo].map((base) => {
      const g = base.clone();
      g.instanceCount = count;
      for (const [k, a] of Object.entries(attrs)) g.setAttribute(k, a);
      g.boundingSphere = sphere;
      return g;
    });
    const mesh = new THREE.Mesh(lods[1], material);
    group.add(mesh);
    tiles.push({ mesh, lods, box, count });
    total += count;
  }
  const turfCanvas = document.createElement('canvas');
  turfCanvas.width = turfCanvas.height = 512;
  const turf = new THREE.CanvasTexture(turfCanvas);
  turf.wrapS = turf.wrapT = THREE.RepeatWrapping;
  turf.colorSpace = THREE.NoColorSpace;
  turf.anisotropy = 8;
  // tiles are grown a few at a time, so the page never stalls while the lawn is made
  const ready = (async () => {
    paintTurf(turfCanvas);
    turf.needsUpdate = true;
    await new Promise((r) => setTimeout(r, 0));
    let t0 = performance.now();
    for (let tx = X0; tx < X1; tx += TILE) {
      for (let ty = Y0; ty < Y1; ty += TILE) {
        growTile(tx, ty);
        if (performance.now() - t0 > 10) { await new Promise((r) => setTimeout(r, 0)); t0 = performance.now(); }
      }
    }
  })();

  // the ground under the blades: the same greens, deep between blades up close, the lawn's own colour from afar,
  // mottled, in the bake's light and shade, with the same gusts passing over it
  const lawnMat = lawnMesh.material;
  lawnMat.toneMapped = false;
  lawnMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      time: uniforms.time, wind: uniforms.wind, litLum: { value: litLum * lawnMat.color.r },
      sunCol: uniforms.sunCol, skyCol: uniforms.skyCol, gDeep: { value: col(PALETTE.deep) }, gTop: { value: col(PALETTE.top) },
      cStreak: uniforms.cStreak, turf: { value: turf },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float time; uniform vec2 wind; uniform float litLum; uniform vec3 sunCol; uniform vec3 skyCol; uniform vec3 gDeep; uniform vec3 gTop;
uniform sampler2D turf; uniform vec3 cStreak;
varying vec3 vWorld;
${NOISE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec2 xz = vWorld.xz;
  vec2 bl = bakeLight(dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)) / litLum);
  // grain: tufts a few centimetres across, faded out where they get smaller than a pixel
  float fw = length(fwidth(xz));
  float grain = (vnoise(xz * 13.) - .5) * (1. - smoothstep(.05, .15, fw)) + (vnoise(xz * 4.3 + 1.7) - .5) * (1. - smoothstep(.15, .45, fw));
  vec3 top = gTop * patchTint(xz) * (1. + .2 * grain);
  // up close, painted turf between the blades (two scales, one turned, so it never repeats visibly)
  float dist = distance(vWorld, cameraPosition);
  float tf = texture2D(turf, xz * .9).r * .5 + texture2D(turf, mat2(.8, -.6, .6, .8) * xz * .55 + .37).r * .5;
  vec3 deep = gDeep * patchTint(xz) * mix(1., mix(.5, 1.5, tf), 1. - smoothstep(6., 22., dist));
  vec3 alb = mix(deep, top, smoothstep(10., 50., dist));
  vec3 c = mix(alb * skyCol * bl.y, alb * sunCol, bl.x);
  c = mix(c, mix(alb, cStreak, .55) * mix(.6, 1., bl.x), smoothstep(.5, .9, gust(xz, time, wind)) * .3);
  diffuseColor.rgb = c;
}`);
  };
  lawnMat.needsUpdate = true;

  const near = new THREE.Vector3();
  return {
    group,
    ready,
    get count() { return total; },
    update(t, camPos) {
      uniforms.time.value = t;
      uniforms.cam.value.copy(camPos);
      for (const tile of tiles) {
        const d = tile.box.clampPoint(camPos, near).distanceTo(camPos);
        const keep = 1 + (LOD.z - 1) * smooth(LOD.x, LOD.y, d);
        const want = tile.lods[d < 26 ? 0 : 1];
        if (tile.mesh.geometry !== want) tile.mesh.geometry = want;
        want.instanceCount = Math.min(tile.count, Math.ceil(tile.count * keep) + 1);
      }
    },
  };
}
