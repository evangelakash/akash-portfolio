/* Text drawn onto surfaces in the house (banners, labels, risers, boards).
   Content comes from [data-slot] elements in the page, so the words stay real HTML for
   screen readers and search; the canvas is only their picture on the wall. */
import * as THREE from 'three';

const INK = '#2A2A2E';
const MID = '#54545A';
const PAPER = '#EDE7D9';          // sRGB of the paper albedo used in Blender (0.84, 0.80, 0.70 linear)
const NOTE = '#F0E08C';

/* Tool logos for the pegboard tags. The painter runs synchronously, so the images are decoded up front
   and kept here by their src. */
const icons = new Map();
export async function iconsReady() {
  const srcs = [...document.querySelectorAll('[data-icon]')].map((el) => el.dataset.icon);
  await Promise.all([...new Set(srcs)].map((src) => new Promise((res) => {
    const img = new Image();
    img.onload = () => { icons.set(src, img); res(); };
    img.onerror = () => res();
    img.src = src;
  })));
}

export async function fontsReady() {
  const faces = ['300 64px Sora', '400 32px Literata', '400 24px "IBM Plex Mono"', '500 24px "IBM Plex Mono"'];
  await Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null)));
}

// set the largest font (up to size) at which text fits in maxW
function fit(ctx, text, maxW, weight, size, family) {
  let px = Math.round(size);
  ctx.font = `${weight} ${px}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) {
    px = Math.floor(px * maxW / w);
    ctx.font = `${weight} ${px}px ${family}`;
  }
  return px;
}

function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

const STYLES = {
  // hanging banner: one big figure, a mono label, a hand-drawn underline
  banner(ctx, W, H, el) {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    const big = el.querySelector('b')?.textContent || '';
    const label = el.querySelector('span')?.textContent || '';
    ctx.fillStyle = INK;
    ctx.font = `300 ${Math.round(H * 0.44)}px Sora`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(big, W / 2, H * 0.56);
    ctx.strokeStyle = INK; ctx.lineWidth = H * 0.012; ctx.lineCap = 'round';
    ctx.beginPath();
    const y = H * 0.66;
    ctx.moveTo(W * 0.3, y);
    ctx.bezierCurveTo(W * 0.42, y - H * 0.02, W * 0.58, y + H * 0.02, W * 0.7, y - H * 0.005);
    ctx.stroke();
    ctx.fillStyle = MID;
    ctx.font = `500 ${Math.round(H * 0.058)}px "IBM Plex Mono"`;
    const lines = wrap(ctx, label.toUpperCase(), W * 0.8);
    lines.forEach((l, i) => ctx.fillText(l, W / 2, H * 0.8 + i * H * 0.075));
  },
  // museum wall label: title, one line, a small arrow cue
  label(ctx, W, H, el) {
    ctx.fillStyle = '#F2F1EC'; ctx.fillRect(0, 0, W, H);
    const pad = W * 0.07;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = INK;
    ctx.font = `300 ${Math.round(H * 0.17)}px Sora`;
    const title = el.querySelector('b')?.textContent || '';
    wrap(ctx, title, W - pad * 2).slice(0, 2).forEach((l, i) => ctx.fillText(l, pad, pad + i * H * 0.2));
    ctx.fillStyle = MID;
    ctx.font = `400 ${Math.round(H * 0.095)}px "IBM Plex Mono"`;
    const sub = el.querySelector('span')?.textContent || '';
    wrap(ctx, sub, W - pad * 2).slice(0, 2).forEach((l, i) => ctx.fillText(l, pad, H * 0.58 + i * H * 0.13));
  },
  // stair riser: the date in a narrow left column, role and place set as large as the riser allows
  riser(ctx, W, H, el) {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    const when = (el.querySelector('time')?.textContent || '').toUpperCase();
    const title = el.querySelector('b')?.textContent || '';
    const sub = el.querySelector('span')?.textContent || '';
    const x1 = W * 0.27, maxW = W * 0.7;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = MID;
    fit(ctx, when, W * 0.19, '500', H * 0.24, '"IBM Plex Mono"');
    ctx.fillText(when, W * 0.035, H * 0.6);
    ctx.fillRect(W * 0.243, H * 0.22, Math.max(2, Math.round(W * 0.0012)), H * 0.56);
    ctx.fillStyle = INK;
    fit(ctx, title, maxW, '400', H * 0.34, 'Sora');
    ctx.fillText(title, x1, H * 0.53);
    ctx.fillStyle = MID;
    fit(ctx, sub, maxW, '400', H * 0.21, 'Literata');
    ctx.fillText(sub, x1, H * 0.85);
  },
  // project poster (frames without a screenshot yet): title set large, a quiet line under it
  poster(ctx, W, H, el) {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const pad = W * 0.08;
    ctx.font = `300 ${Math.round(W * 0.085)}px Sora`;
    wrap(ctx, el.querySelector('b')?.textContent || '', W - pad * 2).forEach((l, i) => ctx.fillText(l, pad, pad + i * W * 0.1));
    ctx.fillStyle = MID;
    ctx.font = `400 ${Math.round(W * 0.03)}px "IBM Plex Mono"`;
    ctx.fillText((el.querySelector('span')?.textContent || '').toUpperCase(), pad, H - pad - W * 0.03);
    ctx.fillStyle = NOTE;
    ctx.fillRect(W - pad - W * 0.14, H - pad - W * 0.14, W * 0.14, W * 0.14);
  },
  // whiteboard: marker title and a two-column checklist of capabilities
  whiteboard(ctx, W, H, el) {
    ctx.fillStyle = '#EEEFEC'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, H);          // faint gloss
    g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(.4, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const title = el.querySelector('b')?.textContent || '';
    const items = [...el.querySelectorAll('li')].map((li) => li.textContent);
    ctx.save();
    ctx.translate(W * 0.06, H * 0.2); ctx.rotate(-0.012);
    ctx.fillStyle = '#23252B'; ctx.font = `300 ${Math.round(H * 0.12)}px Sora`; ctx.textBaseline = 'alphabetic';
    ctx.fillText(title, 0, 0);
    const tw = ctx.measureText(title).width;
    ctx.strokeStyle = '#B5402A'; ctx.lineWidth = H * 0.009; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, H * 0.035); ctx.bezierCurveTo(tw * 0.3, H * 0.02, tw * 0.7, H * 0.05, tw * 1.04, H * 0.028); ctx.stroke();
    ctx.restore();
    const cols = 2, per = Math.ceil(items.length / cols);
    items.forEach((it, i) => {
      const col = Math.floor(i / per), row = i % per;
      const x = W * (0.07 + col * 0.46), y = H * (0.36 + row * 0.12);
      ctx.save(); ctx.translate(x, y); ctx.rotate(((i * 37) % 7 - 3) * 0.002);
      ctx.strokeStyle = '#2F4F7A'; ctx.lineWidth = H * 0.006;
      const s = H * 0.05;
      ctx.strokeRect(0, -s * 0.85, s, s);
      ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.4); ctx.lineTo(s * 0.45, -s * 0.12); ctx.lineTo(s * 1.05, -s * 1.05); ctx.stroke();
      ctx.fillStyle = '#23252B'; ctx.font = `400 ${Math.round(H * 0.058)}px Sora`;
      ctx.fillText(it, s * 1.7, 0);
      ctx.restore();
    });
  },
  // chalkboard: how I work, four steps joined by chalk arrows, the process list underneath
  chalk(ctx, W, H, el) {
    ctx.fillStyle = '#2B3531'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {                     // old erasing smears
      ctx.fillStyle = `rgba(210,215,205,${0.012 + (i % 5) * 0.004})`;
      const x = (i * 197) % W, y = (i * 113) % H;
      ctx.beginPath(); ctx.ellipse(x, y, W * 0.12, H * 0.05, (i % 7) * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    const chalk = 'rgba(236,236,228,.93)';
    ctx.fillStyle = chalk; ctx.strokeStyle = chalk; ctx.textBaseline = 'alphabetic';
    const title = el.querySelector('b')?.textContent || '';
    ctx.font = `300 ${Math.round(H * 0.1)}px Sora`;
    ctx.fillText(title, W * 0.05, H * 0.15);
    const steps = [...el.querySelectorAll('li')];
    const n = steps.length;
    const colW = W * 0.9 / n;
    steps.forEach((li, i) => {
      const x = W * 0.05 + i * colW, y = H * 0.32;
      ctx.lineWidth = H * 0.006;
      ctx.beginPath(); ctx.arc(x + H * 0.04, y, H * 0.035, 0, Math.PI * 2); ctx.stroke();
      ctx.font = `500 ${Math.round(H * 0.04)}px "IBM Plex Mono"`;
      ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x + H * 0.04, y + H * 0.014); ctx.textAlign = 'left';
      if (i < n - 1) {
        const ax = x + colW - W * 0.03, ay = y;
        ctx.beginPath(); ctx.moveTo(x + H * 0.1, ay); ctx.quadraticCurveTo((x + ax) / 2, ay - H * 0.04, ax, ay); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - H * 0.025, ay - H * 0.02); ctx.moveTo(ax, ay); ctx.lineTo(ax - H * 0.028, ay + H * 0.012); ctx.stroke();
      }
      ctx.font = `400 ${Math.round(H * 0.05)}px Sora`;
      wrap(ctx, li.querySelector('b')?.textContent || '', colW * 0.9).forEach((l, k) => ctx.fillText(l, x, y + H * (0.12 + k * 0.06)));
      ctx.font = `400 ${Math.round(H * 0.034)}px Literata`;
      wrap(ctx, li.querySelector('span')?.textContent || '', colW * 0.88).forEach((l, k) => ctx.fillText(l, x, y + H * (0.28 + k * 0.047)));
    });
    ctx.font = `500 ${Math.round(H * 0.032)}px "IBM Plex Mono"`;
    ctx.fillText((el.querySelector('small')?.textContent || '').toUpperCase(), W * 0.05, H * 0.9);
    // chalk grain: knock tiny holes out of everything drawn
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0, n = Math.round(W * H / 40); i < n; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.18 + ((i * 7) % 10) / 30})`;
      ctx.fillRect((i * 7919) % W, (i * 104729) % H, 2, 2);
    }
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#2B3531'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  },
  // kraft paper tag on the tool wall: punched and ringed, the tool's own logo above its name
  tag(ctx, W, H, el) {
    ctx.fillStyle = '#D6BA8C'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 1600; i++) {                     // paper fibres
      ctx.fillStyle = `rgba(110,74,36,${((i * 13) % 10) / 150})`;
      ctx.fillRect((i * 7919) % W, (i * 6007) % H, 3 + (i % 4), 1);
    }
    ctx.strokeStyle = 'rgba(90,62,32,.35)'; ctx.lineWidth = W * 0.012;   // worn edge
    ctx.strokeRect(W * 0.006, W * 0.006, W - W * 0.012, H - W * 0.012);
    ctx.fillStyle = '#EFE4CF';                            // reinforcement ring
    ctx.beginPath(); ctx.arc(W / 2, H * 0.1, W * 0.085, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2A1D10';
    ctx.beginPath(); ctx.arc(W / 2, H * 0.1, W * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const name = el.querySelector('b')?.textContent || '';
    const icon = icons.get(el.dataset.icon);
    if (icon) {                                          // the logo, fitted into the tag's upper half
      const box = W * 0.44;
      const k = Math.min(box / icon.width, box / icon.height);
      const iw = icon.width * k, ih = icon.height * k;
      ctx.drawImage(icon, (W - iw) / 2, H * 0.42 - ih / 2, iw, ih);
    }
    ctx.fillStyle = '#1A120A';
    const px = fit(ctx, name, W * 0.84, '400', W * 0.19, 'Sora');
    ctx.fillText(name, W / 2, H * 0.72);
    const tw = Math.min(W * 0.8, ctx.measureText(name).width);
    ctx.strokeStyle = '#1A120A'; ctx.lineWidth = Math.max(3, px * 0.06); ctx.lineCap = 'round';
    ctx.beginPath();
    const y = H * 0.72 + px * 0.28;
    ctx.moveTo(W / 2 - tw / 2, y + px * 0.02);
    ctx.bezierCurveTo(W / 2 - tw / 6, y - px * 0.05, W / 2 + tw / 6, y + px * 0.06, W / 2 + tw / 2, y - px * 0.01);
    ctx.stroke();
  },
};

/** Texture for a slot. aspect = width / height of the surface in the scene. */
export function slotTexture(slot, aspect, renderer, basePx = 1024) {
  const el = document.querySelector(`[data-slot="${slot}"]`);
  if (!el) return null;
  const style = STYLES[el.dataset.style] || STYLES.label;
  const W = aspect >= 1 ? basePx : Math.round(basePx * aspect);
  const H = aspect >= 1 ? Math.round(basePx / aspect) : basePx;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  style(ctx, W, H, el);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;          // glTF UV convention
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}
