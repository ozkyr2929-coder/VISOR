// Pure logic for VISOR. No DOM, no network: runs in the browser and in tests.

export const itemKey = (type, id) => `${type}:${id}`;

const live = items => Object.values(items || {}).filter(it => it && !it.deleted);

// ---------- Sync merge ----------

// Per title the most recent change wins (ties keep local). Settings likewise.
export function mergeStates(local = {}, remote = {}) {
  const a = local.items || {}, b = remote.items || {};
  const items = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[key], y = b[key];
    if (!x) items[key] = y;
    else if (!y) items[key] = x;
    else items[key] = (y.updatedAt || 0) > (x.updatedAt || 0) ? y : x;
  }
  const ls = local.settings || {}, rs = remote.settings || {};
  const [win, lose] = (rs.updatedAt || 0) > (ls.updatedAt || 0) ? [rs, ls] : [ls, rs];
  // An empty value never wipes a filled one (a new device has no TMDB key yet).
  const settings = { ...win };
  for (const [k, v] of Object.entries(lose)) if ((settings[k] === '' || settings[k] == null) && v !== '' && v != null) settings[k] = v;
  return { items, settings };
}

// ---------- Stats ----------

const yearOf = date => (date ? Number(date.slice(0, 4)) : null);
const monthOf = date => Number(date.slice(5, 7)) - 1;
const seasonMinutes = (s, fallback = 45) => (s.eps || 0) * (s.runtime || fallback);

export function computeStats(items, { year } = {}) {
  const out = { movies: 0, tvCompleted: 0, seasons: 0, minutes: 0, avgRating: null,
    byMonth: new Array(12).fill(0), ratingDist: {}, topGenres: [], bulk: 0 };
  const rated = [];
  const genres = new Map();
  const inYear = d => year == null || yearOf(d) === year;

  for (const it of live(items)) {
    let counted = false;
    if (it.type === 'movie') {
      const watches = it.watches || [];
      if (it.status !== 'watched' || !watches.length) continue;
      if (watches.some(w => w.date == null)) out.bulk++;
      const relevant = year == null ? watches : watches.filter(w => w.date && inYear(w.date));
      if (!relevant.length) continue;
      out.movies++;
      out.minutes += (it.runtime || 0) * relevant.length;
      for (const w of relevant) if (w.date && year != null) out.byMonth[monthOf(w.date)]++;
      counted = true;
    } else if (it.type === 'tv') {
      const seen = Object.entries(it.seen || {});
      if (seen.some(([, d]) => d == null)) out.bulk++;
      const relevant = year == null ? seen : seen.filter(([, d]) => d && inYear(d));
      const fallback = it.runtime || 45;
      for (const [n, d] of relevant) {
        out.seasons++;
        const s = (it.seasons || []).find(x => String(x.n) === String(n));
        if (s) out.minutes += seasonMinutes(s, fallback);
        if (d && year != null) out.byMonth[monthOf(d)]++;
      }
      if (it.status === 'completed') {
        const dates = seen.map(([, d]) => d).filter(Boolean).sort();
        const last = dates[dates.length - 1];
        if (year == null || (last && inYear(last))) out.tvCompleted++;
      }
      counted = relevant.length > 0 || (year == null && it.status === 'completed');
    }
    if (!counted) continue;
    if (it.rating != null) {
      rated.push(it.rating);
      out.ratingDist[String(it.rating)] = (out.ratingDist[String(it.rating)] || 0) + 1;
    }
    for (const g of it.genres || []) genres.set(g, (genres.get(g) || 0) + 1);
  }
  if (rated.length) out.avgRating = Math.round((rated.reduce((s, r) => s + r, 0) / rated.length) * 10) / 10;
  out.topGenres = [...genres].map(([id, count]) => ({ id, count }))
    .sort((p, q) => q.count - p.count || p.id - q.id).slice(0, 6);
  return out;
}

// ---------- Diary ----------

export function diaryEntries(items) {
  const out = [];
  for (const it of live(items)) {
    if (it.type === 'movie') {
      (it.watches || []).forEach((w, index) => {
        if (w.date) out.push({ date: w.date, key: it.key, kind: 'movie', index, rating: w.rating ?? it.rating ?? null });
      });
    } else if (it.type === 'tv') {
      for (const [n, d] of Object.entries(it.seen || {})) {
        if (d) out.push({ date: d, key: it.key, kind: 'season', season: Number(n), rating: it.rating ?? null });
      }
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.key < b.key ? -1 : 1));
}

// ---------- Series ----------

export function nextSeason(item) {
  const seen = item.seen || {};
  const list = (item.seasons || []).filter(s => s.n > 0).sort((a, b) => a.n - b.n);
  const next = list.find(s => !(String(s.n) in seen));
  return next ? next.n : null;
}

// ---------- Quick list ----------

export function parseQuickList(text) {
  let parts = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (parts.length === 1 && /[,;]/.test(parts[0])) parts = parts[0].split(/[,;]/).map(s => s.trim()).filter(Boolean);
  return parts.map(raw => {
    let q = raw.replace(/^(\d+\s*[.)\-:]|[-*•·])\s*/, '');
    let year = null;
    const m = q.match(/\((\d{4})\)\s*$/);
    if (m) { year = Number(m[1]); q = q.slice(0, m.index); }
    return { query: q.trim(), year };
  }).filter(x => x.query);
}

export function normalizeTitle(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

export function pickBestMatch(results, { query, year }) {
  if (!results || !results.length) return null;
  const q = normalizeTitle(query);
  const same = r => normalizeTitle(r.title) === q || normalizeTitle(r.original) === q;
  return (year != null && results.find(r => same(r) && r.year === year))
    || results.find(same)
    || (year != null && results.slice(0, 5).find(r => r.year === year))
    || results[0];
}

// ---------- Formatting ----------

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h >= 6 && h < 14) return 'Buenos días';
  if (h >= 14 && h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

export function formatMinutes(min) {
  const m = Math.round(min || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function starsText(r) {
  if (r == null) return '';
  return '★'.repeat(Math.floor(r)) + (r % 1 >= 0.5 ? '½' : '');
}

const pad = n => String(n).padStart(2, '0');
export function todayISO(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
