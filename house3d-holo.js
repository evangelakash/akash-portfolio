/* The living room hologram, in the manner of a Stark workshop projection: a tinted glass panel with a
   glowing frame and grid, his portrait and About drawn in cyan light, a HUD ring floating behind the
   portrait, and a fan of light with drifting motes rising from the bar. It boots as the camera arrives:
   the beam comes up, the panel unfolds from a line, then a scan line writes the content in.
   Words come from [data-holo] in the page, so they stay real HTML for screen readers and search. */
import * as THREE from 'three';

const CYAN = new THREE.Color(0.3, 0.84, 1.0);
const DEEP = new THREE.Color(0.1, 0.45, 1.0);

/* ------------------------------------------------------------------ canvases */
function wrapLines(ctx, text, maxW) {
  const out = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

// the panel's content: white on black (the shader turns luminance into light)
function drawContent(img, el, W, H) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const m = Math.round(H * 0.07);
  // portrait in a bracketed frame on the left
  const px = m, py = m, pw = Math.round(W * 0.3), ph = H - 2 * m;
  if (img && img.width) {
    // the photo is low-key (dark shirt, hair, foliage) and the hologram turns brightness into light,
    // so lift its shadows and put a soft key light on the face before it goes in
    const s = Math.max(pw / img.width, ph / img.height);
    const iw = img.width * s, ih = img.height * s;
    ctx.save();
    ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    ctx.filter = 'grayscale(1) contrast(1.12) brightness(1.75)';
    ctx.drawImage(img, px + (pw - iw) / 2, py + (ph - ih) / 2 - ih * 0.04, iw, ih);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgb(58,58,58)'; ctx.fillRect(px, py, pw, ph);
    const key = ctx.createRadialGradient(px + pw * 0.48, py + ph * 0.3, 0, px + pw * 0.48, py + ph * 0.3, ph * 0.42);
    key.addColorStop(0, 'rgba(255,255,255,.34)'); key.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = key; ctx.fillRect(px, py, pw, ph);
    ctx.globalCompositeOperation = 'source-over';
    // fade only the outer edge of the frame
    for (const [x0, y0, x1, y1, w, h] of [[px, 0, px + pw * 0.1, 0, pw * 0.1, 0], [px + pw, 0, px + pw * 0.9, 0, pw * 0.1, 0]]) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(0,0,0,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), py, w, ph);
    }
    const gb = ctx.createLinearGradient(0, py + ph, 0, py + ph * 0.86);
    gb.addColorStop(0, 'rgba(0,0,0,.75)'); gb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gb; ctx.fillRect(px, py + ph * 0.86, pw, ph * 0.14);
    ctx.restore();
  }
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(2, H * 0.004);
  const L = H * 0.05;
  for (const [x, y, dx, dy] of [[px, py, 1, 1], [px + pw, py, -1, 1], [px, py + ph, 1, -1], [px + pw, py + ph, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y); ctx.stroke();
  }
  // ticks down the portrait's edge, like a measuring scale
  ctx.globalAlpha = 0.6;
  for (let i = 0; i <= 20; i++) {
    const y = py + (ph * i) / 20, len = i % 5 === 0 ? W * 0.012 : W * 0.006;
    ctx.fillRect(px + pw + W * 0.012, y, len, Math.max(1, H * 0.002));
  }
  ctx.globalAlpha = 1;
  // text column
  const x = px + pw + W * 0.055, maxW = W - x - m;
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'top';
  ctx.font = `500 ${Math.round(H * 0.034)}px "IBM Plex Mono"`;
  ctx.globalAlpha = 0.75;
  ctx.fillText((el.dataset.kicker || '').toUpperCase(), x, m + H * 0.01);
  ctx.globalAlpha = 1;
  ctx.font = `300 ${Math.round(H * 0.13)}px Sora`;
  ctx.fillText(el.dataset.name || '', x, m + H * 0.06);
  ctx.fillRect(x, m + H * 0.225, maxW * 0.18, Math.max(2, H * 0.004));
  ctx.font = `400 ${Math.round(H * 0.047)}px Literata`;
  let y = m + H * 0.27;
  const lh = H * 0.066;
  const lead = el.querySelector(':scope > p:not(.h3-kicker)')?.textContent || '';
  for (const l of wrapLines(ctx, lead, maxW)) { ctx.fillText(l, x, y); y += lh; }
  const quote = el.querySelector('blockquote');
  if (quote) {
    y += lh * 0.5;
    const qx = x + W * 0.02;
    ctx.globalAlpha = 0.85;
    ctx.font = `italic 400 ${Math.round(H * 0.037)}px Literata`;
    const y0 = y;
    for (const l of wrapLines(ctx, quote.querySelector('p')?.textContent || '', maxW - W * 0.02)) { ctx.fillText(l, qx, y); y += lh * 0.78; }
    ctx.fillRect(x, y0, Math.max(2, W * 0.003), y - y0 - lh * 0.2);
    ctx.font = `500 ${Math.round(H * 0.028)}px "IBM Plex Mono"`;
    ctx.fillText((quote.querySelector('cite')?.textContent || '').toUpperCase(), qx, y + lh * 0.2);
    ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// the HUD ring: concentric arcs, dashes and ticks
function drawRing(S) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);
  ctx.strokeStyle = '#fff';
  const r = S * 0.46;
  const arc = (rad, a0, a1, w, alpha = 1) => {
    ctx.globalAlpha = alpha; ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(0, 0, rad, a0, a1); ctx.stroke();
  };
  arc(r, 0, Math.PI * 2, S * 0.004, 0.55);
  arc(r * 0.93, -0.3, 1.9, S * 0.012, 0.9);
  arc(r * 0.93, 2.4, 3.3, S * 0.012, 0.9);
  arc(r * 0.93, 3.9, 5.6, S * 0.012, 0.9);
  arc(r * 0.84, 0, Math.PI * 2, S * 0.002, 0.4);
  for (let i = 0; i < 120; i++) {                 // tick ring
    const a = (i / 120) * Math.PI * 2, long = i % 10 === 0;
    ctx.globalAlpha = long ? 0.9 : 0.45; ctx.lineWidth = S * (long ? 0.004 : 0.002);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.76, Math.sin(a) * r * 0.76);
    ctx.lineTo(Math.cos(a) * r * (long ? 0.7 : 0.73), Math.sin(a) * r * (long ? 0.7 : 0.73));
    ctx.stroke();
  }
  for (let i = 0; i < 36; i++) {                  // dashed outer band
    const a = (i / 36) * Math.PI * 2;
    arc(r * 0.99, a, a + 0.08, S * 0.006, 0.7);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ shaders */
const vert = `varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

// light written by the content texture: cyan, scanlines, a reveal sweep, the odd glitch
const contentFrag = `uniform sampler2D map; uniform float power; uniform float reveal; uniform float time; uniform float glitch;
uniform vec3 tint; varying vec2 vUv;
void main(){
  vec2 uv = vUv;
  float gy = fract(time * .37) ;
  uv.x += glitch * step(abs(uv.y - gy), .018) * .012;
  vec3 c = texture2D(map, uv).rgb;
  float lum = dot(c, vec3(.3, .59, .11));
  float scan = .82 + .18 * sin(uv.y * 820. - time * 5.);
  float edge = smoothstep(0., .01, uv.x) * smoothstep(1., .99, uv.x);
  float shown = step(1. - uv.y, reveal);                         // written from the top down
  float front = smoothstep(.02, 0., abs((1. - uv.y) - reveal)) * step(reveal, .995);
  float a = (lum * 1.25 * shown * scan + front * .9) * edge * power;
  vec3 col = tint * (lum * 1.3 * shown * scan + front * 1.8);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

// the panel's light: a thin bright rim, a glow falling off from it, a faint grid, corner marks
const frameFrag = `uniform float power; uniform float time; uniform float aspect; uniform vec3 tint; uniform vec3 deep; varying vec2 vUv;
void main(){
  vec2 p = vUv;
  float dx = min(p.x, 1. - p.x) * aspect, dy = min(p.y, 1. - p.y);
  float d = min(dx, dy);
  float rim = smoothstep(.006, .0, abs(d - .006));
  float glow = exp(-d * 26.) * .35;
  vec2 g = abs(fract(vec2(p.x * aspect, p.y) * 14.) - .5);
  float grid = (smoothstep(.49, .5, g.x) + smoothstep(.49, .5, g.y)) * .05;
  float corner = step(dx, .07) * step(dy, .07) * smoothstep(.01, .0, abs(d - .02)) * 1.2;
  float sweep = smoothstep(.06, 0., abs(fract(p.y * .5 - time * .12) - .5)) * .06;
  vec3 col = tint * (rim * 1.1 + corner * .9) + deep * (glow + grid + sweep);
  float a = (rim * .9 + corner * .8 + glow + grid + sweep) * power;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

// soft light spilling past the panel's edge
const haloFrag = `uniform float power; uniform float aspect; uniform float inset; uniform vec3 deep; varying vec2 vUv;
void main(){
  vec2 p = (vUv - .5) * vec2(aspect, 1.);
  vec2 h = vec2(aspect, 1.) * (.5 - inset);
  vec2 q = abs(p) - h;
  float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.);
  float a = d > 0. ? exp(-d * 30.) * .55 * (1. - smoothstep(inset * .6, inset * .95, d)) : 0.;
  gl_FragColor = vec4(deep * 1.2, a * power);
  #include <colorspace_fragment>
}`;

const ringFrag = `uniform sampler2D map; uniform float power; uniform vec3 tint; varying vec2 vUv;
void main(){
  float lum = texture2D(map, vUv).r;
  gl_FragColor = vec4(tint * lum * 1.4, lum * .8 * power);
  #include <colorspace_fragment>
}`;

const beamFrag = `uniform float power; uniform float time; uniform vec3 tint; varying vec2 vUv;
void main(){
  float up = smoothstep(0., 1., vUv.y);
  float sides = smoothstep(0., .3, vUv.x) * smoothstep(1., .7, vUv.x);
  float streak = .75 + .25 * sin(vUv.x * 60. + time * 1.3) * sin(vUv.x * 23. - time * .7);
  gl_FragColor = vec4(tint, (.05 + .2 * up) * sides * streak * power);
  #include <colorspace_fragment>
}`;

const moteVert = `uniform float time; uniform float height; uniform float size; attribute float speed; attribute float seed;
varying float vA;
void main(){
  vec3 p = position;
  float t = fract(seed + time * speed / height);
  p.y = -height + t * height;
  p.x *= mix(.25, 1., t);                                         // the fan widens as it rises
  vA = smoothstep(0., .15, t) * smoothstep(1., .75, t);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_PointSize = size * (1. / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const moteFrag = `uniform float power; uniform vec3 tint; varying float vA;
void main(){
  float d = length(gl_PointCoord - .5);
  float a = smoothstep(.5, .0, d) * vA * power;
  gl_FragColor = vec4(tint * 1.2, a * .7);
  #include <colorspace_fragment>
}`;

const additive = (uniforms, fragmentShader, vertexShader = vert) => new THREE.ShaderMaterial({
  uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
});

/* ------------------------------------------------------------------ the rig */
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makeHologram({ center, width = 2.0, height = 1.125, facing = new THREE.Vector3(1, 0, 0), barTop }) {
  const el = document.querySelector('[data-holo]');
  const group = new THREE.Group();       // placed at the panel centre, facing the camera
  const panel = new THREE.Group();       // unfolds from a line
  group.add(panel);
  // time and colours are shared; each layer fades on its own power
  const shared = { time: { value: 0 }, tint: { value: CYAN.clone() }, deep: { value: DEEP.clone() } };
  const own = (extra = {}) => ({ ...shared, power: { value: 0 }, ...extra });

  // dark glass behind the light, so the words read against the cedar
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.0, 0.045, 0.075), transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
  }));
  glass.renderOrder = 1;
  panel.add(glass);
  const frameU = own({ aspect: { value: width / height } });
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(width, height), additive(frameU, frameFrag));
  frame.renderOrder = 2;
  panel.add(frame);
  const contentU = own({ map: { value: null }, reveal: { value: 0 }, glitch: { value: 0 } });
  const content = new THREE.Mesh(new THREE.PlaneGeometry(width, height), additive(contentU, contentFrag));
  content.position.z = 0.025;
  content.renderOrder = 3;
  panel.add(content);
  // soft light around the panel
  const haloPad = 0.18;
  const haloU = own({ aspect: { value: (width + 2 * haloPad) / (height + 2 * haloPad) }, inset: { value: haloPad / (height + 2 * haloPad) } });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(width + 2 * haloPad, height + 2 * haloPad), additive(haloU, haloFrag));
  halo.position.z = -0.01;
  halo.renderOrder = 0;
  panel.add(halo);
  // HUD ring floating behind the portrait (the portrait sits in the left third of the panel)
  const ringU = own({ map: { value: drawRing(1024) } });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(height * 0.98, height * 0.98), additive(ringU, ringFrag));
  ring.position.set(-width / 2 + height * 0.07 + width * 0.15, 0.02, -0.07);
  ring.renderOrder = 0;
  panel.add(ring);

  // fan of light from the strip in the bar up to the panel's lower edge
  const beamH = Math.max(0.05, center.y - height / 2 - barTop);
  const fan = new THREE.BufferGeometry();
  const bw = width * 0.08, tw = width * 0.98;
  fan.setAttribute('position', new THREE.Float32BufferAttribute([-bw / 2, -beamH, 0, bw / 2, -beamH, 0, tw / 2, 0, 0, -tw / 2, 0, 0], 3));
  fan.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  fan.setIndex([0, 1, 2, 0, 2, 3]);
  const beamU = own();
  const beam = new THREE.Mesh(fan, additive(beamU, beamFrag));
  beam.position.y = -height / 2;
  beam.renderOrder = 0;
  group.add(beam);
  // motes drifting up the beam
  const N = 90;
  const pos = new Float32Array(N * 3), speed = new Float32Array(N), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * tw;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
    speed[i] = 0.05 + Math.random() * 0.12;
    seed[i] = Math.random();
  }
  const motesU = own({ height: { value: beamH + height * 0.35 }, size: { value: 14 } });
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  mg.setAttribute('speed', new THREE.BufferAttribute(speed, 1));
  mg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const motes = new THREE.Points(mg, new THREE.ShaderMaterial({
    uniforms: motesU,
    vertexShader: moteVert, fragmentShader: moteFrag, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  motes.position.y = -height / 2 + height * 0.35;
  motes.renderOrder = 4;
  motes.frustumCulled = false;
  group.add(motes);

  group.position.copy(center);
  group.lookAt(center.clone().add(facing));

  if (el) {
    const img = new Image();
    img.onload = () => { contentU.map.value = drawContent(img, el, 1600, 900); };
    img.src = el.dataset.photo;
    contentU.map.value = drawContent(null, el, 1600, 900);
  }

  return {
    group,
    // power 0..1 runs the boot: beam, unfold, then the scan writes the content; t drives the idle motion
    set(power, t) {
      const beamOn = smooth(0.0, 0.3, power);
      const unfold = smooth(0.2, 0.65, power);
      const flick = power < 0.98 ? 0.65 + 0.35 * Math.abs(Math.sin(t * 37.0) * Math.sin(t * 13.0)) : 1;
      shared.time.value = t;
      beamU.power.value = beamOn * flick;
      motesU.power.value = beamOn;
      panel.scale.y = Math.max(0.004, unfold);
      frameU.power.value = smooth(0.2, 0.4, power) * flick;
      glass.material.opacity = 0.5 * unfold;
      haloU.power.value = smooth(0.3, 0.6, power) * flick;
      contentU.reveal.value = smooth(0.55, 0.95, power) * 1.02;
      contentU.power.value = smooth(0.5, 0.7, power) * flick;
      contentU.glitch.value = power >= 0.98 && Math.sin(t * 0.9) > 0.985 ? 1 : 0;
      ring.rotation.z = t * 0.12;
      ringU.power.value = smooth(0.6, 0.9, power);
      panel.position.y = Math.sin(t * 0.8) * 0.006;
      group.visible = power > 0.001;
    },
  };
}
