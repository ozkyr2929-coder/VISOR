// Small DOM kit for VISOR: element builder, icons, poster cards, stars, sheets, toasts.
import { img } from './tmdb.js';

export function h(tag, attrs = {}, ...children) {
  const el = tag === 'svg' || attrs.svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false || k === 'svg') continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'value' && 'value' in el) el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = Boolean(v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}
// replaceChildren() turns null into the text "null": this drops empty slots first.
export function fill(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter(c => c != null && c !== false));
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const ICONS = {
  home: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.5" stroke-dasharray="3.4 2.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1"/>',
  archive: '<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  hexcheck: '<path d="M12 2.5 20.5 7.3v9.4L12 21.5 3.5 16.7V7.3z"/><path d="m8 12.3 2.8 2.8L16.3 9.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  sync: '<path d="M20 12a8 8 0 0 1-14.3 4.9M4 12A8 8 0 0 1 18.3 7.1"/><path d="M18.5 3v4.5H14M5.5 21v-4.5H10"/>',
  bookmark: '<path d="M6 3h12v18l-6-4.5L6 21z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M4 4h16"/>',
  profile: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/><path d="M2.5 6V3.5h2.5M21.5 6V3.5H19M2.5 18v2.5h2.5M21.5 18v2.5H19"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.8 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.2 0 5.4 3.1 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/>',
  scan: '<path d="M3 8V4h4M21 8V4h-4M3 16v4h4M21 16v4h-4"/><path d="M3 12h18"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M7 4v16M17 4v16M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4.2M16 6h3a3 3 0 0 1-3 4.2M12 13v3.5M8.5 20.5h7M10 16.5h4"/>',
  star: '<path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.6l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/>',
};
const STAR = '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/>';

export function icon(name, extra = {}) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', extra.width || '1.6');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name] || '';
  return s;
}
function starSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'currentColor');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = STAR;
  return s;
}

// ---------- Posters ----------

const placeholderCache = new Map();
export function posterPlaceholder(title = '') {
  if (placeholderCache.has(title)) return placeholderCache.get(title);
  const words = String(title).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 14 && line) { lines.push(line); line = w; } else line = (line + ' ' + w).trim();
    if (lines.length === 4) break;
  }
  if (line && lines.length < 5) lines.push(line);
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const text = lines.map((l, i) => `<text x="100" y="${150 + i * 26 - (lines.length - 1) * 13}" text-anchor="middle">${esc(l)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a2238"/><stop offset="1" stop-color="#030a14"/></linearGradient></defs><rect width="200" height="300" fill="url(#g)"/><circle cx="100" cy="150" r="80" fill="none" stroke="#63e3ff" stroke-opacity=".12" stroke-width="2" stroke-dasharray="6 6"/><g fill="#93b6ca" font-family="Saira, sans-serif" font-size="19">${text}</g></svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  placeholderCache.set(title, url);
  return url;
}

// Actor photo, or a HUD silhouette with initials when TMDB has none.
export function personImg(person, size = 'w185') {
  const src = img(person.photo, size);
  if (src) {
    const el = h('img', { src, alt: '', loading: 'lazy', decoding: 'async', crossorigin: 'anonymous' });
    el.addEventListener('error', () => el.replaceWith(silhouette(person.name)), { once: true });
    return el;
  }
  return silhouette(person.name);
}
function silhouette(name = '') {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return h('div', { class: 'silhouette', 'aria-hidden': 'true' }, icon('profile', { width: '1.2' }), h('span', {}, initials));
}

export function posterImg(meta, size = 'w342', alt = '') {
  const src = img(meta.poster, size) || posterPlaceholder(meta.title);
  const el = h('img', { src, alt, loading: 'lazy', decoding: 'async', crossorigin: 'anonymous' });
  el.addEventListener('error', () => { el.src = posterPlaceholder(meta.title); }, { once: true });
  return el;
}

const TYPE_LABEL = { movie: 'PELI', tv: 'SERIE' };
export const STATUS_LABEL = { watchlist: 'Pendiente', watching: 'Viendo', completed: 'Terminada', dropped: 'Abandonada', watched: 'Vista' };

// Catalog card: tapping the poster runs onTap (bulk toggle), the "i" button runs onInfo.
export function posterCard(meta, { watched = false, badge = null, onTap, onInfo, showType = false, tapLabel } = {}) {
  const card = h('div', { class: `card${watched ? ' is-watched' : ''}`, dataset: { key: `${meta.type}:${meta.id}` } },
    h('div', { class: 'poster tilt' },
      posterImg(meta, 'w342'),
      h('div', { class: 'stamp', 'aria-hidden': 'true' }, icon('hexcheck', { width: '1.4' }), 'VISTA'),
      badge ? h('span', { class: 'badge' }, badge) : null,
    ),
    h('div', { class: 'title' }, meta.title),
    h('div', { class: 'sub' }, [meta.year || '—', showType ? ` · ${TYPE_LABEL[meta.type]}` : ''].join('')),
  );
  const tap = h('button', { class: 'tap', type: 'button', 'aria-pressed': String(watched),
    'aria-label': tapLabel || `${meta.title}${meta.year ? ` (${meta.year})` : ''}: marcar como vista` });
  tap.addEventListener('click', () => onTap && onTap(card, meta));
  card.append(tap);
  if (onInfo) {
    const info = h('button', { class: 'info', type: 'button', 'aria-label': `Ficha de ${meta.title}` }, icon('info'));
    info.addEventListener('click', e => { e.stopPropagation(); onInfo(meta); });
    card.append(info);
  }
  return card;
}

export function setCardWatched(card, watched) {
  card.classList.toggle('is-watched', watched);
  const tap = card.querySelector('.tap');
  if (tap) tap.setAttribute('aria-pressed', String(watched));
  card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
}

// ---------- Stars (0.5 steps) ----------

export function starsInput(value, onChange, { small = false, label = 'Tu nota' } = {}) {
  let current = value ?? null;
  const wrap = h('div', { class: `stars${small ? ' small' : ''}`, role: 'slider', tabindex: '0', 'aria-label': label,
    'aria-valuemin': '0', 'aria-valuemax': '5' });
  const paint = () => {
    wrap.setAttribute('aria-valuenow', String(current ?? 0));
    wrap.setAttribute('aria-valuetext', current == null ? 'Sin nota' : `${String(current).replace('.', ',')} de 5 estrellas`);
    [...wrap.children].forEach((b, i) => {
      const n = i + 1;
      b.classList.toggle('full', current != null && current >= n);
      b.querySelector('.half').hidden = !(current != null && current === n - 0.5);
    });
  };
  const set = v => { current = v === current ? null : v; paint(); onChange && onChange(current); };
  for (let i = 1; i <= 5; i++) {
    const b = h('button', { type: 'button', tabindex: '-1', 'aria-hidden': 'true' }, starSvg(), h('span', { class: 'half' }, starSvg()));
    b.addEventListener('click', e => {
      const r = b.getBoundingClientRect();
      set(e.clientX && e.clientX - r.left < r.width / 2 ? i - 0.5 : i);
    });
    wrap.append(b);
  }
  wrap.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); current = Math.min(5, (current || 0) + 0.5); paint(); onChange && onChange(current); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); current = (current || 0) - 0.5 <= 0 ? null : current - 0.5; paint(); onChange && onChange(current); }
  });
  paint();
  return wrap;
}

export function starsLabel(r) {
  if (r == null) return null;
  return h('span', { class: 'stars-text', 'aria-label': `${String(r).replace('.', ',')} estrellas` }, '★'.repeat(Math.floor(r)) + (r % 1 ? '½' : ''));
}

// ---------- Sheet ----------

let openSheets = 0;
export function openSheet(content, { onClose, label = 'Detalle' } = {}) {
  const prevFocus = document.activeElement;
  const wrap = h('div', { class: 'sheet-wrap', role: 'dialog', 'aria-modal': 'true', 'aria-label': label });
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const closeBtn = h('button', { class: 'icon-btn sheet-close', type: 'button', 'aria-label': 'Cerrar' }, icon('close'));
  const sheet = h('div', { class: 'sheet' }, closeBtn, content);
  wrap.append(backdrop, sheet);
  document.getElementById('overlay').append(wrap);
  openSheets++;
  document.body.style.overflow = 'hidden';
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.remove();
    openSheets--;
    if (!openSheets) document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
    onClose && onClose();
  };
  // Keep keyboard focus inside the sheet while it is open.
  const onKey = e => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const focusable = [...sheet.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(el => el.offsetParent !== null || el === document.activeElement);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  setTimeout(() => closeBtn.focus({ preventScroll: true }), 0);
  return { close, sheet };
}

// ---------- Toast ----------

export function toast(text, { error = false, ms = 2600 } = {}) {
  const box = document.getElementById('toasts');
  const t = h('div', { class: `toast${error ? ' err' : ''}` }, text);
  box.append(t);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, ms);
}

// ---------- Helpers ----------

export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
export function formatDate(iso) {
  if (!iso) return 'Antes de VISOR';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}
export function loading(text = 'Consultando base de datos') {
  return h('div', { class: 'loading' }, h('div', { class: 'spinner' }), text.toUpperCase());
}
export function emptyState(title, text, action) {
  return h('div', { class: 'frame quiet empty' }, h('p', { class: 'h3' }, title), text ? h('p', { class: 'muted' }, text) : null, action || null);
}
export function errorText(e) {
  if (!e) return 'Algo ha fallado.';
  if (e.code === 'nokey') return 'Falta tu clave de TMDB. Añádela en Ajustes para buscar pelis y series.';
  if (e.code === 'unauthorized') return 'TMDB no acepta la clave. Revísala en Ajustes.';
  if (e.code === 'offline') return 'Sin conexión. Tu registro sigue disponible; la búsqueda volverá con la red.';
  return 'TMDB no ha respondido. Prueba de nuevo en un momento.';
}
