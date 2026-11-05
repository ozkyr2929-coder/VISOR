// Local state for VISOR: the user's log of movies and series.
// Synced part: items + settings. Device-only part: GitHub token, gist id, last sync.
import { itemKey } from './model.js';

const STATE_KEY = 'visor.state.v1';
const DEVICE_KEY = 'visor.device.v1';
const META_FIELDS = ['title', 'original', 'year', 'poster', 'backdrop', 'genres', 'runtime'];

const emptyState = () => ({ items: {}, settings: { name: '', tmdbKey: '', updatedAt: 0 } });
const clone = v => JSON.parse(JSON.stringify(v));

function readJSON(storage, key) {
  try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeJSON(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: keep in memory */ }
}
function validState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s) || typeof s.items !== 'object' || Array.isArray(s.items)) return emptyState();
  return { items: s.items || {}, settings: { ...emptyState().settings, ...(s.settings || {}) } };
}

export function createStore(storage, now = Date.now) {
  let state = validState(readJSON(storage, STATE_KEY));
  let device = readJSON(storage, DEVICE_KEY) || {};
  const subs = new Set();

  const emit = local => { for (const fn of subs) { try { fn({ local }); } catch (e) { console.error(e); } } };
  const save = (local = true) => { writeJSON(storage, STATE_KEY, state); emit(local); };

  const getItem = key => { const it = state.items[key]; return it && !it.deleted ? it : null; };

  // Returns a fresh copy of the item for `meta`, creating it if needed and refreshing its metadata.
  function draft(meta) {
    const key = itemKey(meta.type, meta.id);
    const existing = getItem(key);
    const it = existing ? clone(existing) : meta.type === 'tv'
      ? { key, type: 'tv', id: meta.id, status: null, seasons: [], seen: {}, rating: null, note: '', addedAt: now() }
      : { key, type: 'movie', id: meta.id, status: null, watches: [], rating: null, note: '', addedAt: now() };
    for (const f of META_FIELDS) if (meta[f] != null) it[f] = meta[f];
    if (meta.type === 'tv' && meta.seasons && meta.seasons.length) it.seasons = meta.seasons;
    return it;
  }
  const isEmpty = it => !it.favorite && (it.type === 'movie'
    ? !it.watches.length && it.status !== 'watchlist' && it.rating == null && !it.note
    : !Object.keys(it.seen).length && !it.status && it.rating == null && !it.note);
  function commit(it) {
    it.updatedAt = now();
    state.items[it.key] = isEmpty(it) ? { key: it.key, deleted: true, updatedAt: it.updatedAt } : it;
    save();
    return getItem(it.key);
  }
  const realSeasons = it => (it.seasons || []).filter(s => s.n > 0);
  function autoTvStatus(it) {
    const seasons = realSeasons(it);
    const seenCount = seasons.filter(s => String(s.n) in it.seen).length;
    if (seasons.length && seenCount === seasons.length) it.status = 'completed';
    else if (seenCount > 0 && it.status !== 'dropped') it.status = 'watching';
  }
  function fillBulkSeasons(it) {
    for (const s of realSeasons(it)) if (!(String(s.n) in it.seen)) it.seen[s.n] = null;
    if (realSeasons(it).length) delete it.bulkPending;
  }

  return {
    getState: () => state,
    getItem,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    replaceState(next) { state = validState(clone(next)); save(false); },

    setSettings(patch) { state.settings = { ...state.settings, ...patch, updatedAt: now() }; save(); },
    getDevice: () => device,
    setDevice(patch) { device = { ...device, ...patch }; writeJSON(storage, DEVICE_KEY, device); },

    markMovieWatched(meta, { date = null, rating = null, note = '' } = {}) {
      const it = draft(meta);
      it.watches.push({ date, rating, note: note || '' });
      it.status = 'watched';
      if (rating != null) it.rating = rating;
      return commit(it);
    },

    // One tap in the catalog: mark as seen without a date, or undo it.
    toggleBulkWatched(meta) {
      const it = draft(meta);
      if (it.type === 'movie') {
        if (it.status === 'watched') {
          if (it.watches.some(w => w.date)) return true;
          it.watches = []; it.status = null;
          commit(it); return false;
        }
        it.watches.push({ date: null, rating: null, note: '' });
        it.status = 'watched';
        commit(it); return true;
      }
      if (it.status === 'completed') {
        if (Object.values(it.seen).some(Boolean)) return true;
        it.seen = {}; it.status = null; delete it.bulkPending;
        commit(it); return false;
      }
      it.status = 'completed';
      it.bulkPending = true;
      fillBulkSeasons(it);
      commit(it); return true;
    },

    setWatchlist(meta, on) {
      const it = draft(meta);
      if (on) { if (it.status !== 'watched' && it.status !== 'completed') it.status = 'watchlist'; }
      else if (it.status === 'watchlist') it.status = null;
      return commit(it);
    },

    setFavorite(meta, on) {
      const it = draft(meta);
      it.favorite = Boolean(on);
      it.favoriteAt = on ? now() : null;
      return commit(it);
    },

    setTvStatus(meta, status) { const it = draft(meta); it.status = status; return commit(it); },

    setSeasonSeen(meta, n, date) {
      const it = draft(meta);
      if (date === false) {
        delete it.seen[n];
        if (it.status === 'completed') it.status = Object.keys(it.seen).length ? 'watching' : null;
      } else it.seen[n] = date;
      autoTvStatus(it);
      return commit(it);
    },

    setSeasonsUpTo(meta, n, date) {
      const it = draft(meta);
      for (const s of realSeasons(it)) if (s.n <= n && !(String(s.n) in it.seen)) it.seen[s.n] = date;
      autoTvStatus(it);
      return commit(it);
    },

    // Season metadata arrives later for series marked in bulk from the catalog.
    setSeasons(key, seasons) {
      const cur = getItem(key);
      if (!cur || cur.type !== 'tv') return null;
      const it = clone(cur);
      it.seasons = seasons;
      if (it.bulkPending && it.status === 'completed') fillBulkSeasons(it);
      return commit(it);
    },

    setRating(key, r) { const cur = getItem(key); if (!cur) return null; const it = clone(cur); it.rating = r; return commit(it); },
    setNote(key, note) { const cur = getItem(key); if (!cur) return null; const it = clone(cur); it.note = note; return commit(it); },

    deleteWatch(key, index) {
      const cur = getItem(key);
      if (!cur || cur.type !== 'movie') return null;
      const it = clone(cur);
      it.watches.splice(index, 1);
      if (!it.watches.length && it.status === 'watched') it.status = null;
      return commit(it);
    },

    removeItem(key) { state.items[key] = { key, deleted: true, updatedAt: now() }; save(); },

    // Tombstones (not a reset) so the deletion also reaches the other devices.
    clearAll() {
      const t = now();
      for (const key of Object.keys(state.items)) state.items[key] = { key, deleted: true, updatedAt: t };
      save();
    },
  };
}
