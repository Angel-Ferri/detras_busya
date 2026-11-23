const CACHE_VERSION = 'busya-v15-2';
const CORE_CACHE = CACHE_VERSION + '-core';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

const CORE_ASSETS = [
  './',
  './index.html',
  './como_llegar.html',
  './mapa.html',
  './paradas.html',
  './chofer.html',
  './panel.html',
  './panel_paradas.html',
  './manifest.webmanifest',
  './estilos/style.css',
  './script/dias.js',
  './script/app.js',
  './script/nativo.js',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './datos/coordenadas/lineas_unificadas.json',
  './datos/paradas_manuales.json',
  './datos/datos-unificados.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) =>
      // addAll falla si un archivo no existe; usamos add individual.
      Promise.allSettled(CORE_ASSETS.map((u) => cache.add(u).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CORE_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isTile(url) { return url.pathname.includes('/tiles/osm/'); }
function isData(url) { return url.pathname.includes('/datos/') && url.pathname.endsWith('.json'); }

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Tiles: cache-first, guardar en runtime.
  if (isTile(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => caches.match(req));
      })
    );
    return;
  }

  // Datos JSON: stale-while-revalidate.
  if (isData(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Navegación / JS / CSS: network-first con fallback a cache.
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.status === 200 && (req.destination === 'document' || req.destination === 'script' || req.destination === 'style')) {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
  );
});
EOF