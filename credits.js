// Device-only cache of cast and directors per title, fetched from TMDB when first needed.
const KEY = 'visor.credits.v1';
const MAX = 300;

export function createCredits({ tmdb, storage }) {
  let cache = {};
  try { cache = JSON.parse(storage.getItem(KEY) || '{}') || {}; } catch { cache = {}; }
  const save = () => {
    const keys = Object.keys(cache);
    if (keys.length > MAX) keys.sort((a, b) => cache[a].at - cache[b].at).slice(0, keys.length - MAX).forEach(k => delete cache[k]);
    try { storage.setItem(KEY, JSON.stringify(cache)); } catch { /* full: keep in memory */ }
  };
  const inflight = new Map();

  async function get(type, id) {
    const key = `${type}:${id}`;
    if (cache[key]) return cache[key];
    if (inflight.has(key)) return inflight.get(key);
    const p = tmdb.details(type, id).then(d => {
      cache[key] = { title: d.title, year: d.year, backdrop: d.backdrop, cast: d.cast.slice(0, 10), directors: d.people, at: Date.now() };
      save();
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

  return { get, many, all: () => cache };
}
