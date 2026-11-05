// TMDB API v3 client (Spanish, Spain). Works with the short API key or the long read token.
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';
const MAX_PAGES = 500; // TMDB never serves pages beyond 500

export const img = (path, size = 'w342') => (path ? `${IMG}${size}${path}` : null);

const yearFrom = d => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null);

export function normalize(raw, type) {
  return {
    type: raw.media_type || type,
    id: raw.id,
    title: raw.title || raw.name || '',
    original: raw.original_title || raw.original_name || '',
    year: yearFrom(raw.release_date || raw.first_air_date),
    poster: raw.poster_path || null,
    backdrop: raw.backdrop_path || null,
    genres: raw.genre_ids || (raw.genres || []).map(g => g.id),
    vote: raw.vote_average ?? null,
    overview: raw.overview || '',
  };
}

const qs = params => Object.entries(params)
  .filter(([, v]) => v !== undefined && v !== null && v !== '')
  .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

function apiError(code, message) { const e = new Error(message); e.code = code; return e; }

export function createTmdb({ getKey, fetch }) {
  const cache = new Map();

  async function request(path, params = {}, keyOverride) {
    const key = (keyOverride ?? getKey() ?? '').trim();
    if (!key) throw apiError('nokey', 'Falta la clave de TMDB');
    const bearer = key.startsWith('eyJ');
    const url = `${BASE}${path}?${qs({ language: 'es-ES', ...params, api_key: bearer ? undefined : key })}`;
    if (!keyOverride && cache.has(url)) return cache.get(url);
    const headers = bearer ? { Authorization: `Bearer ${key}` } : {};
    let res;
    try { res = await fetch(url, { headers }); } catch { throw apiError('offline', 'Sin conexión'); }
    if (res.status === 401) throw apiError('unauthorized', 'La clave de TMDB no es válida');
    if (!res.ok) throw apiError('http', `TMDB respondió ${res.status}`);
    const data = await res.json();
    if (!keyOverride) cache.set(url, data);
    return data;
  }

  const list = (data, type, filter) => ({
    results: (data.results || []).filter(filter || (() => true)).map(r => normalize(r, type)),
    page: data.page || 1,
    totalPages: Math.min(data.total_pages || 1, MAX_PAGES),
  });

  async function details(type, id) {
    const d = await request(`/${type}/${id}`, { append_to_response: 'credits,watch/providers' });
    const meta = normalize(d, type);
    const runtime = type === 'movie' ? d.runtime || null
      : (d.episode_run_time && d.episode_run_time[0]) || (d.last_episode_to_air && d.last_episode_to_air.runtime) || null;
    const es = ((d['watch/providers'] || {}).results || {}).ES || {};
    const prov = arr => (arr || []).map(p => ({ name: p.provider_name, logo: p.logo_path }));
    return {
      ...meta,
      runtime,
      tagline: d.tagline || '',
      genreNames: (d.genres || []).map(g => g.name),
      people: type === 'movie'
        ? ((d.credits || {}).crew || []).filter(c => c.job === 'Director').map(c => c.name)
        : (d.created_by || []).map(c => c.name),
      cast: ((d.credits || {}).cast || []).slice(0, 12).map(c => ({ name: c.name, character: c.character || '', photo: c.profile_path || null })),
      providers: { link: es.link || null, flatrate: prov(es.flatrate), rent: prov(es.rent), buy: prov(es.buy) },
      seasons: type === 'tv' ? (d.seasons || []).map(s => ({
        n: s.season_number, eps: s.episode_count || 0, runtime, name: s.name || `Temporada ${s.season_number}`, air: s.air_date || null,
      })) : undefined,
      numberOfSeasons: d.number_of_seasons || null,
      showStatus: d.status || '',
    };
  }

  return {
    async validate(key) {
      try { await request('/genre/movie/list', {}, key); return true; }
      catch (e) { if (e.code === 'unauthorized' || e.code === 'nokey') return false; throw e; }
    },
    async search(query, page = 1) {
      const d = await request('/search/multi', { query, page, include_adult: false });
      return list(d, undefined, r => r.media_type === 'movie' || r.media_type === 'tv');
    },
    async trending(type, page = 1) { return list(await request(`/trending/${type}/week`, { page }), type); },
    async top(type, page = 1) { return list(await request(`/${type}/top_rated`, { page, region: 'ES' }), type); },
    async discover(type, f = {}, page = 1) {
      const date = type === 'movie' ? 'primary_release_date' : 'first_air_date';
      const params = {
        page, include_adult: false, sort_by: f.sort || 'vote_count.desc',
        [`${date}.gte`]: f.from, [`${date}.lte`]: f.to,
        with_genres: f.genre, with_companies: f.company, 'vote_count.gte': f.voteMin,
      };
      if (f.provider) Object.assign(params, { with_watch_providers: f.provider, watch_region: 'ES', with_watch_monetization_types: 'flatrate' });
      return list(await request(`/discover/${type}`, params), type);
    },
    details,
    async collectionByName(name) {
      const s = await request('/search/collection', { query: name });
      const rs = s.results || [];
      // "Alien - Colección" must beat "Alien vs. Predator - Colección" for the query "Alien".
      const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\b(collection|coleccion|saga)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/^(the|el|la|los|las) /, '');
      const q = norm(name);
      const hit = rs.find(r => norm(r.name) === q) || rs.find(r => norm(r.name).startsWith(q)) || rs[0];
      if (!hit) return null;
      const c = await request(`/collection/${hit.id}`);
      const parts = (c.parts || []).map(p => normalize(p, 'movie'))
        .filter(p => p.year).sort((a, b) => a.year - b.year);
      return { id: c.id, name: c.name, poster: c.poster_path || null, backdrop: c.backdrop_path || null, parts };
    },
    async companyByName(name) {
      const s = await request('/search/company', { query: name });
      const rs = s.results || [];
      const hit = rs.find(r => r.name.toLowerCase() === name.toLowerCase()) || rs[0];
      return hit ? { id: hit.id, name: hit.name } : null;
    },
    async genres(type) { return ((await request(`/genre/${type}/list`)).genres || []).map(g => ({ id: g.id, name: g.name })); },
    async providers(type) {
      const d = await request(`/watch/providers/${type}`, { watch_region: 'ES' });
      return (d.results || []).map(p => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path,
        priority: (p.display_priorities || {}).ES ?? p.display_priority ?? 999 }))
        .sort((a, b) => a.priority - b.priority);
    },
  };
}
