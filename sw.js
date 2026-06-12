/* FlorCWR · service worker
   Estrategia:
   - App shell (HTML, manifest, iconos): cache-first, para arranque offline garantizado.
   - Teselas del mapa (OpenStreetMap): stale-while-revalidate, para que las zonas
     ya visitadas queden disponibles sin cobertura.
*/
const SHELL_CACHE = 'florcwr-shell-v1';
const TILE_CACHE  = 'florcwr-tiles-v1';
const SHELL = [
  './',
  './FlorCWR.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== SHELL_CACHE && k !== TILE_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Teselas de mapa: servir de caché y refrescar en segundo plano
  if (/tile\.openstreetmap\.org/.test(url.hostname) || /\.tile\./.test(url.hostname)) {
    e.respondWith(
      caches.open(TILE_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        const network = fetch(e.request).then(resp => {
          if (resp && resp.status === 200) cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // App shell y resto: cache-first con respaldo a red
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      // cachear navegaciones del propio origen
      if (resp && resp.status === 200 && url.origin === self.location.origin) {
        const copy = resp.clone();
        caches.open(SHELL_CACHE).then(c => c.put(e.request, copy));
      }
      return resp;
    }).catch(() => caches.match('./FlorCWR.html')))
  );
});
