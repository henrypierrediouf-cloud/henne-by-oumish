const CACHE = 'henne-oumish-v1';

const PRECACHE = [
  '/',
  '/index.html',
  '/a-propos.html',
  '/galerie.html',
  '/prestations.html',
  '/reservation.html',
  '/mentions-legales.html',
  '/politique-confidentialite.html',
  '/style.css',
  '/nav.js',
  '/favicon.svg',
  '/icon-maskable.svg',
  '/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas mettre en cache les appels API
  if (url.pathname.startsWith('/api/')) return;

  // Ressources externes (Google Fonts, images CDN) : réseau d'abord
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Assets locaux : cache d'abord, puis réseau avec mise en cache
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
