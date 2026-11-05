// Cinema effects: projector dust, poster tilt, backdrop slideshow. All respect reduced motion.
import { img } from './tmdb.js';
import { h } from './ui.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Floating light dust, like the beam of a projector.
export function startDust(canvas) {
  if (!canvas || reduced()) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let w = 0, hgt = 0, motes = [], running = true, last = 0;
  const resize = () => {
    w = canvas.clientWidth; hgt = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = hgt * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = w < 700 ? 22 : 42;
    motes = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * hgt, r: 0.5 + Math.random() * 1.4,
      vx: 4 + Math.random() * 8, vy: -3 - Math.random() * 6, a: Math.random() * Math.PI * 2, s: 0.6 + Math.random() * 1.2 }));
  };
  const frame = t => {
    if (!running) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    ctx.clearRect(0, 0, w, hgt);
    for (const m of motes) {
      m.x += m.vx * dt; m.y += m.vy * dt; m.a += m.s * dt;
      if (m.x > w + 4) m.x = -4;
      if (m.y < -4) m.y = hgt + 4;
      const alpha = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(m.a));
      ctx.beginPath();
      ctx.fillStyle = `rgba(170, 236, 255, ${alpha})`;
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  };
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    const was = running;
    running = document.visibilityState === 'visible';
    if (running && !was) requestAnimationFrame(frame);
  });
  requestAnimationFrame(frame);
}

// Posters lean towards the pointer and catch the light (mouse and trackpad only).
export function initTilt() {
  if (reduced() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let current = null;
  const reset = el => { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); el.classList.remove('tilting'); };
  document.addEventListener('pointermove', e => {
    const poster = e.target.closest && e.target.closest('.tilt');
    if (current && current !== poster) { reset(current); current = null; }
    if (!poster) return;
    current = poster;
    const r = poster.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    poster.classList.add('tilting');
    poster.style.setProperty('--rx', `${(0.5 - py) * 10}deg`);
    poster.style.setProperty('--ry', `${(px - 0.5) * 12}deg`);
    poster.style.setProperty('--gx', `${px * 100}%`);
    poster.style.setProperty('--gy', `${py * 100}%`);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (current) reset(current); current = null; });
}

// Crossfading backdrops with a slow push-in. Returns a node and a stop function.
export function projector(backdrops, { size = 'w1280', every = 7000 } = {}) {
  const paths = backdrops.filter(Boolean);
  const stage = h('div', { class: 'projector', 'aria-hidden': 'true' });
  if (!paths.length) return { node: stage, stop() {} };
  const layers = [0, 1].map(() => h('img', { alt: '', crossorigin: 'anonymous', decoding: 'async' }));
  stage.append(...layers, h('div', { class: 'projector-shade' }));
  let i = 0, front = 0, timer = null;
  const show = () => {
    const layer = layers[front];
    layer.onload = () => {
      layer.classList.add('on');
      layers[1 - front].classList.remove('on');
      front = 1 - front;
    };
    layer.src = img(paths[i % paths.length], size);
    i++;
  };
  show();
  if (paths.length > 1 && !reduced()) timer = setInterval(show, every);
  return { node: stage, stop() { clearInterval(timer); } };
}

export const shuffle = (arr, seed = Date.now()) => {
  const a = arr.slice();
  let s = seed % 2147483647 || 1;
  for (let k = a.length - 1; k > 0; k--) { s = (s * 16807) % 2147483647; const j = s % (k + 1); [a[k], a[j]] = [a[j], a[k]]; }
  return a;
};
