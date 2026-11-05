// VISOR boot: wires store, TMDB, sync and the screens; routes on the URL hash.
import { createStore } from './store.js';
import { createTmdb } from './tmdb.js';
import { createSync } from './sync.js';
import { icon, toast, h, fill } from './ui.js';
import { telemetryText } from './model.js';
import { createLibrary } from './library.js';
import { evaluateTrophies, withHistory, newlyUnlocked } from './trophies.js';
import { startDust, initTilt } from './fx.js';

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
const library = createLibrary({ tmdb, store, storage: safeStorage });

const VIEWS = {
  inicio: () => import('./view-home.js'),
  catalogo: () => import('./view-catalog.js'),
  archivo: () => import('./view-archive.js'),
  perfil: () => import('./view-profile.js'),
  informe: () => import('./view-report.js'),
  trofeos: () => import('./view-trophies.js'),
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

// ---------- Trophies ----------
// Evaluated on demand and cached until the log or the library changes. What has been won is
// remembered on this device (with the date) so a trophy, once won, stays won.
const TROPHY_KEY = 'visor.trophies.v1';
const trophyLog = (() => { try { return JSON.parse(safeStorage.getItem(TROPHY_KEY) || 'null') || { ready: false, seen: {} }; } catch { return { ready: false, seen: {} }; } })();
let trophyMemo = null;
let pendingTrophy = null;
const trophies = () => {
  if (!trophyMemo) trophyMemo = withHistory(evaluateTrophies(store.getState().items, { library: library.all() }), trophyLog.seen);
  return trophyMemo;
};
let trophyTimer = 0;
function checkTrophies() {
  clearTimeout(trophyTimer);
  trophyTimer = setTimeout(() => {
    const items = store.getState().items;
    // A new device waits for its first sync before opening the trophy room.
    if (!trophyLog.ready && !Object.values(items).some(it => !it.deleted)) return;
    const raw = evaluateTrophies(items, { library: library.all() });
    const fresh = newlyUnlocked(raw.list, trophyLog.seen);
    if (!fresh.length && trophyLog.ready) return;
    const now = Date.now();
    for (const id of fresh) trophyLog.seen[id] = now;
    const first = !trophyLog.ready;
    trophyLog.ready = true;
    try { safeStorage.setItem(TROPHY_KEY, JSON.stringify(trophyLog)); } catch { /* ignore */ }
    trophyMemo = null;
    if (current.handle && current.handle.update) current.handle.update();
    if (!fresh.length) return;
    if (first) {
      // First time with the trophy room: no fireworks for everything already earned, just one note.
      const box = document.getElementById('toasts');
      const btn = h('button', { class: 'btn solid small', type: 'button', onClick: () => { ctx.go('trofeos'); } }, 'Ver');
      box.append(h('div', { class: 'toast', style: { pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' } },
        `Sala de trofeos inaugurada: ya tiene ${fresh.length} ${fresh.length === 1 ? 'trofeo' : 'trofeos'}.`, btn));
      return;
    }
    const list = trophies().list.filter(t => fresh.includes(t.id));
    import('./view-trophies.js').then(m => m.celebrate(ctx, list)).catch(() => {});
  }, 1200);
}
library.onChange(() => { trophyMemo = null; checkTrophies(); });

const ctx = {
  store, tmdb, sync, library, toast,
  trophies,
  openTrophy(id) {
    if (current.name === 'trofeos') { import('./view-trophies.js').then(m => m.openTrophy(ctx, id)); return; }
    pendingTrophy = id;
    location.hash = '#trofeos';
  },
  takePendingTrophy() { const id = pendingTrophy; pendingTrophy = null; return id; },
  async openPerson(person) { (await import('./view-person.js')).openPerson(ctx, person); },
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
  fill(viewRoot);
  current = { name, handle: mod.render(viewRoot, ctx) || {} };
  document.querySelectorAll('.dock a').forEach(a => {
    if (a.dataset.route === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  viewRoot.focus({ preventScroll: true });
}

let routeCount = 0;
async function route() {
  if (updateReady) { location.reload(); return; }
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
  trophyMemo = null;
  checkTrophies();
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
  const t = telemetryText({ count, online: navigator.onLine, state: st.state, lastSync: st.lastSync });
  fill(telemetry, 
    h('b', { class: t.status === 'EN LÍNEA' ? '' : 'warn' }, '● '),
    h('span', { class: t.status === 'EN LÍNEA' ? '' : 'warn' }, t.status),
    ...t.parts.map((p, i) => h('span', { class: t.warn && i > 0 ? 'warn' : '' }, ` · ${p}`)));
}
sync.onStatus(updateTelemetry);
window.addEventListener('online', () => { updateTelemetry(); sync.syncNow(); });
window.addEventListener('offline', updateTelemetry);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync.syncNow(); });

// ---------- Cinema layer ----------
startDust(document.getElementById('dust'));
initTilt();

// ---------- Icons in static markup ----------
document.querySelectorAll('[data-icon]').forEach(el => el.prepend(icon(el.dataset.icon)));

// ---------- Service worker (offline + install) ----------
// A new version installs in the background. The next screen change loads it; meanwhile a toast offers it.
let updateReady = false;
if ('serviceWorker' in navigator && !params.has('mock') && !params.has('nosw')) {
  // The first take-over (first visit) is not an update; every later one is.
  let controlled = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register('sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) { controlled = true; return; }
    if (updateReady) return;
    updateReady = true;
    const box = document.getElementById('toasts');
    const btn = h('button', { class: 'btn solid small', type: 'button', onClick: () => location.reload() }, 'Actualizar');
    box.append(h('div', { class: 'toast', style: { pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' } }, 'Nueva versión de VISOR lista.', btn));
  });
}

// ---------- Boot ----------
// The countdown plays only the very first time; after that the app opens straight away.
const boot = document.getElementById('boot');
const firstRun = (() => { try { return !localStorage.getItem('visor.booted'); } catch { return false; } })();
const hideBoot = () => { boot.classList.add('done'); setTimeout(() => boot.remove(), 500); try { localStorage.setItem('visor.booted', '1'); } catch { /* ignore */ } };
if (!firstRun || matchMedia('(prefers-reduced-motion: reduce)').matches) hideBoot();
else setTimeout(hideBoot, 900);

updateTelemetry();
await route();
sync.syncNow().then(retryPendingSeasons);
checkTrophies();

// ---------- Background library ----------
// Little by little, fetch runtime, director and cast of the films in the log (for hours and trophies).
let enriching = false;
async function enrichSoon() {
  if (enriching || document.visibilityState !== 'visible' || !navigator.onLine || !store.getState().settings.tmdbKey) return;
  enriching = true;
  try { await library.enrich({ limit: 60 }); } catch { /* next time */ }
  enriching = false;
}
setTimeout(enrichSoon, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') setTimeout(enrichSoon, 3000);
  else library.flush();
});
window.addEventListener('pagehide', () => library.flush());

if (!store.getDevice().welcomed && !store.getState().settings.name && !Object.keys(store.getState().items).length) {
  const mod = await import('./view-settings.js');
  mod.openWelcome(ctx);
}
