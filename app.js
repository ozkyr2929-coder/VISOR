// VISOR boot: wires store, TMDB, sync and the screens; routes on the URL hash.
import { createStore } from './store.js';
import { createTmdb } from './tmdb.js';
import { createSync } from './sync.js';
import { icon, toast, h } from './ui.js';

const params = new URLSearchParams(location.search);
if (params.has('mock')) {
  try { await import('../dev/dev-mock.js'); } catch { /* dev file not deployed */ }
}

const safeStorage = (() => {
  try { const k = '__visor'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; }
  catch { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; }
})();

const store = createStore(safeStorage);
const netFetch = (...a) => window.fetch(...a);
const tmdb = createTmdb({ getKey: () => store.getState().settings.tmdbKey, fetch: netFetch });
const sync = createSync({ store, fetch: netFetch });

const VIEWS = {
  inicio: () => import('./view-home.js'),
  catalogo: () => import('./view-catalog.js'),
  archivo: () => import('./view-archive.js'),
  informe: () => import('./view-report.js'),
  ajustes: () => import('./view-settings.js'),
};

// Series marked in bulk need their season list; fetch it quietly, three at a time.
const seasonQueue = [];
let seasonWorkers = 0;
function ensureSeasons(meta) {
  const it = store.getItem(`tv:${meta.id}`);
  if (!it || (it.seasons && it.seasons.length)) return;
  if (seasonQueue.some(m => m.id === meta.id)) return;
  seasonQueue.push(meta);
  pumpSeasons();
}
function pumpSeasons() {
  while (seasonWorkers < 3 && seasonQueue.length) {
    const meta = seasonQueue.shift();
    seasonWorkers++;
    tmdb.details('tv', meta.id)
      .then(d => { store.setSeasons(`tv:${meta.id}`, d.seasons || []); })
      .catch(() => { /* retried next time the item is touched */ })
      .finally(() => { seasonWorkers--; pumpSeasons(); });
  }
}
function retryPendingSeasons() {
  for (const it of Object.values(store.getState().items)) {
    if (!it.deleted && it.type === 'tv' && it.bulkPending) ensureSeasons(it);
  }
}

const ctx = {
  store, tmdb, sync, toast,
  name: () => store.getState().settings.name || 'señor',
  go: route => { location.hash = `#${route}`; },
  openDetail: (type, id) => { location.hash = `#ficha/${type}/${id}`; },
  // One tap: mark as seen without a date (or undo). Returns the new watched state.
  toggleSeen(meta) {
    const before = store.getItem(`${meta.type}:${meta.id}`);
    const wasSeen = Boolean(before && (before.status === 'watched' || before.status === 'completed'));
    const now = store.toggleBulkWatched(meta);
    if (meta.type === 'tv' && now) ensureSeasons(meta);
    if (wasSeen && now) toast('Tiene visionados con fecha. Edítelo desde su ficha.');
    return { seen: now, changed: wasSeen !== now };
  },
  ensureSeasons,
};

// ---------- Router ----------
const viewRoot = document.getElementById('view');
let current = { name: null, handle: null };
let detail = null;
let renderToken = 0;

function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  const m = raw.match(/^ficha\/(movie|tv)\/(\d+)$/);
  if (m) return { detail: { type: m[1], id: Number(m[2]) } };
  return { view: VIEWS[raw] ? raw : 'inicio' };
}

async function showView(name) {
  if (current.name === name) return;
  const token = ++renderToken;
  const mod = await VIEWS[name]();
  if (token !== renderToken) return;
  if (current.handle && current.handle.destroy) current.handle.destroy();
  viewRoot.replaceChildren();
  current = { name, handle: mod.render(viewRoot, ctx) || {} };
  document.querySelectorAll('.dock a').forEach(a => {
    if (a.dataset.route === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  viewRoot.focus({ preventScroll: true });
}

let routeCount = 0;
async function route() {
  routeCount++;
  const r = parseHash();
  if (r.detail) {
    // A detail opened from a shared/bookmarked link has no app page behind it to go back to.
    const direct = routeCount === 1;
    if (!current.name) await showView('inicio');
    if (detail) detail.close(true);
    const mod = await import('./view-detail.js');
    detail = mod.openDetail(ctx, r.detail.type, r.detail.id, () => {
      detail = null;
      if (direct) location.hash = `#${current.name || 'inicio'}`; else history.back();
    });
    return;
  }
  if (detail) { const d = detail; detail = null; d.close(true); }
  await showView(r.view);
}
window.addEventListener('hashchange', route);

// Re-render the visible screen when data changes (local edits or sync).
let pending = false;
store.subscribe(() => {
  updateTelemetry();
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    if (current.handle && current.handle.update) current.handle.update();
  });
});

// ---------- Telemetry line ----------
const telemetry = document.getElementById('telemetry');
function updateTelemetry() {
  const count = Object.values(store.getState().items).filter(i => !i.deleted).length;
  const st = sync.status();
  let syncText = '';
  if (!navigator.onLine) syncText = '<span class="warn">SIN CONEXIÓN</span>';
  else if (st.state === 'syncing') syncText = 'SINCRONIZANDO…';
  else if (st.state === 'unauthorized') syncText = '<span class="warn">REVISAR SINCRONIZACIÓN</span>';
  else if (st.state === 'error') syncText = '<span class="warn">SINC. PENDIENTE</span>';
  else if (st.lastSync) syncText = `SINC. ${new Date(st.lastSync).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  telemetry.innerHTML = `<b>●</b> EN LÍNEA · ${count} REGISTROS${syncText ? ` · ${syncText}` : ''}`;
}
sync.onStatus(updateTelemetry);
window.addEventListener('online', () => { updateTelemetry(); sync.syncNow(); });
window.addEventListener('offline', updateTelemetry);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync.syncNow(); });

// ---------- Icons in static markup ----------
document.querySelectorAll('[data-icon]').forEach(el => el.prepend(icon(el.dataset.icon)));

// ---------- Service worker (offline + install) ----------
if ('serviceWorker' in navigator && !params.has('mock') && !params.has('nosw')) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    const box = document.getElementById('toasts');
    const btn = h('button', { class: 'btn solid small', type: 'button', onClick: () => location.reload() }, 'Actualizar');
    box.append(h('div', { class: 'toast', style: { pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' } }, 'Nueva versión de VISOR lista.', btn));
  });
}

// ---------- Boot ----------
const boot = document.getElementById('boot');
const bootSeen = (() => { try { return sessionStorage.getItem('visor.boot'); } catch { return '1'; } })();
const hideBoot = () => { boot.classList.add('done'); setTimeout(() => boot.remove(), 600); try { sessionStorage.setItem('visor.boot', '1'); } catch { /* ignore */ } };
if (bootSeen || matchMedia('(prefers-reduced-motion: reduce)').matches) hideBoot();
else setTimeout(hideBoot, 900);

updateTelemetry();
await route();
sync.syncNow().then(retryPendingSeasons);

if (!store.getDevice().welcomed && !store.getState().settings.name && !Object.keys(store.getState().items).length) {
  const mod = await import('./view-settings.js');
  mod.openWelcome(ctx);
}
