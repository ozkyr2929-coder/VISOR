// Device library: a brief sheet per title (runtime, directors, top cast with photos), filled from TMDB.
// Used by the character of the day, the profile, the director trophies and the hours of titles
// marked in bulk. It fills itself little by little in the background; nothing here is synced.
const KEY = 'visor.library.v1';
const OLD_KEY = 'visor.credits.v1';
const MAX = 2500;
const SAVE_EVERY_MS = 3000;

export function createLibrary({ tmdb, store, storage, now = Date.now, setTimer = setTimeout }) {
  let cache = {};
  try { cache = JSON.parse(storage.getItem(KEY) || '{}') || {}; } catch { cache = {}; }
  // The 1.1 cast cache had no person ids; the library replaces it.
  try { if (storage.removeItem) storage.removeItem(OLD_KEY); } catch { /* ignore */ }

  const inflight = new Map();
  const failed = new Set();
  const listeners = new Set();
  let saveTimer = 0, dirty = false;

  const isSeen = it => it && !it.deleted && it.type === 'movie' && it.status === 'watched';
  function flush() {
    if (!dirty) return;
    dirty = false;
    const keys = Object.keys(cache);
    if (keys.length > MAX) {
      // Titles in the log stay; the oldest of the rest go first.
      const items = store.getState().items;
      keys.filter(k => !(items[k] && !items[k].deleted)).sort((a, b) => cache[a].at - cache[b].at)
        .slice(0, keys.length - MAX).forEach(k => delete cache[k]);
    }
    try { storage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage full: keep in memory */ }
  }
  const scheduleSave = () => {
    dirty = true;
    if (!saveTimer) saveTimer = setTimer(() => { saveTimer = 0; flush(); }, SAVE_EVERY_MS) || 0;
  };
  let notifyTimer = 0;
  const notify = () => {
    if (notifyTimer) return;
    notifyTimer = setTimer(() => { notifyTimer = 0; for (const fn of listeners) { try { fn(); } catch (e) { console.error(e); } } }, 1500) || 0;
  };

  function get(type, id) {
    const key = `${type}:${id}`;
    if (cache[key]) return Promise.resolve(cache[key]);
    if (inflight.has(key)) return inflight.get(key);
    const p = tmdb.brief(type, id).then(d => {
      cache[key] = {
        title: d.title, year: d.year, backdrop: d.backdrop || null, runtime: d.runtime || null, collection: d.collection || null,
        directors: (d.directors || []).map(x => ({ id: x.id, name: x.name })),
        cast: (d.cast || []).slice(0, 8).map(c => ({ id: c.id, name: c.name, character: c.character || '', photo: c.photo || null })),
        at: now(),
      };
      scheduleSave();
      notify();
      return cache[key];
    }).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  // Fetches the missing ones (three at a time); failures are skipped.
  async function many(items) {
    const queue = items.filter(it => !cache[`${it.type}:${it.id}`]);
    const worker = async () => { while (queue.length) { const it = queue.shift(); try { await get(it.type, it.id); } catch { /* skip */ } } };
    await Promise.all([worker(), worker(), worker()]);
    return cache;
  }

  // Runtime for titles marked in bulk, taken from the library without a request.
  function patchRuntimes(keys) {
    const items = store.getState().items, patches = {};
    for (const key of keys) {
      const it = items[key], entry = cache[key];
      if (isSeen(it) && !it.runtime && entry && entry.runtime) patches[key] = { runtime: entry.runtime };
    }
    if (Object.keys(patches).length) store.patchMeta(patches);
  }

  const missing = () => Object.values(store.getState().items)
    .filter(it => isSeen(it) && !cache[it.key] && !failed.has(it.key))
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

  // Background fill of the films in the log, newest first. Returns how many were added.
  async function enrich({ limit = 60, workers = 2 } = {}) {
    patchRuntimes(Object.keys(cache));
    const queue = missing().slice(0, limit);
    let added = 0;
    const done = [];
    const worker = async () => {
      while (queue.length) {
        const it = queue.shift();
        try { await get('movie', it.id); added++; done.push(it.key); }
        catch { failed.add(it.key); }
        if (done.length >= 10) patchRuntimes(done.splice(0));
      }
    };
    await Promise.all(Array.from({ length: workers }, worker));
    patchRuntimes(done);
    return added;
  }

  return {
    get, many, enrich, flush,
    all: () => cache,
    pending: () => missing().length,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
