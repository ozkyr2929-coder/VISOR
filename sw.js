// VISOR service worker.
// App files: served from the copy installed with this version (instant start, works offline).
// A new version is downloaded in the background; the page offers to reload into it.
// TMDB answers are kept 12 hours so lists open at once; posters and fonts are kept too.
const VERSION = 'visor-1.2.0';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'model.js', 'store.js', 'tmdb.js', 'sync.js', 'ui.js', 'voice.js', 'genres.js',
  'fx.js', 'sagas.js', 'trophies.js', 'trophy-art.js', 'library.js', 'view-person.js', 'view-trophies.js',
  'view-profile.js', 'view-home.js', 'view-catalog.js', 'view-quicklist.js', 'view-detail.js', 'view-archive.js', 'view-report.js', 'view-settings.js',
  'manifest.webmanifest', 'favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
];
const IMAGES = 'visor-images';
const FONTS = 'visor-fonts';
const API = 'visor-api';
const MAX_IMAGES = 600;
const MAX_API = 400;
const API_FRESH_MS = 12 * 60 * 60 * 1000;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (![VERSION, IMAGES, FONTS, API].includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function appFile(request) {
  const cache = await caches.open(VERSION);
  const cached = request.mode === 'navigate'
    ? await cache.match('index.html')
    : await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && request.mode !== 'navigate') cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

// Trimming walks the whole cache, so it runs every few writes rather than on each one.
const writes = {};
async function trim(cache, name, limit) {
  writes[name] = (writes[name] || 0) + 1;
  if (writes[name] % 25) return;
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request, name, limit) {
  const cache = await caches.open(name);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      await cache.put(request, response.clone());
      if (limit) trim(cache, name, limit);
    }
    return response;
  } catch {
    return Response.error();
  }
}

// TMDB: fresh copy → straight away; old copy → straight away and refreshed behind; none → network.
async function api(event) {
  const { request } = event;
  const auth = request.headers.get('Authorization');
  // The read token travels in a header, not the URL: part of it goes in the key so another token never gets this answer.
  const key = new Request(auth ? `${request.url}&__a=${encodeURIComponent(auth.slice(-16))}` : request.url);
  const cache = await caches.open(API);
  const cached = await cache.match(key, { ignoreVary: true });
  const age = cached ? Date.now() - Number(cached.headers.get('x-visor-time') || 0) : Infinity;
  const network = fetch(request).then(async response => {
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('x-visor-time', String(Date.now()));
      await cache.put(key, new Response(await response.clone().blob(), { status: response.status, statusText: response.statusText, headers }));
      trim(cache, API, MAX_API);
    }
    return response;
  });
  if (cached && age < API_FRESH_MS) return cached;
  if (cached) { event.waitUntil(network.catch(() => {})); return cached; }
  return network;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) { event.respondWith(appFile(request)); return; }
  // The background library keeps its own copy of the brief sheets, so those skip this cache.
  if (url.hostname === 'api.themoviedb.org' && url.searchParams.get('append_to_response') !== 'credits') { event.respondWith(api(event)); return; }
  if (url.hostname === 'image.tmdb.org') { event.respondWith(cacheFirst(request, IMAGES, MAX_IMAGES)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { event.respondWith(cacheFirst(request, FONTS)); return; }
  // GitHub (sync) goes straight to the network.
});
