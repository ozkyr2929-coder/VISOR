// VISOR service worker: opens offline, keeps the app fresh, caches posters and fonts.
const VERSION = 'visor-1.1.0';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'model.js', 'store.js', 'tmdb.js', 'sync.js', 'ui.js', 'voice.js', 'genres.js',
  'credits.js', 'fx.js', 'view-profile.js', 'view-home.js', 'view-catalog.js', 'view-quicklist.js', 'view-detail.js', 'view-archive.js', 'view-report.js', 'view-settings.js',
  'manifest.webmanifest', 'favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
];
const IMAGES = 'visor-images';
const FONTS = 'visor-fonts';
const MAX_IMAGES = 400;
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (![VERSION, IMAGES, FONTS].includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

// App files: network first (always the latest version), cached copy when offline or slow.
async function appFile(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
    ]);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match('index.html');
    return Response.error();
  }
}

// Posters and fonts: cache first; posters are capped so the cache does not grow forever.
async function cacheFirst(request, name, limit) {
  const cache = await caches.open(name);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      await cache.put(request, response.clone());
      if (limit) {
        const keys = await cache.keys();
        for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
      }
    }
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) { event.respondWith(appFile(request)); return; }
  if (url.hostname === 'image.tmdb.org') { event.respondWith(cacheFirst(request, IMAGES, MAX_IMAGES)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { event.respondWith(cacheFirst(request, FONTS)); return; }
  // TMDB and GitHub APIs go straight to the network.
});
