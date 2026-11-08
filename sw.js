const CACHE_NAME = 'kurt-kool-randomizer-v1';
const ASSETS_TO_CACHE = ['./', './index.html', './style.css', './app.js', './manifest.json'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)));
    self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
    event.respondWith(caches.match(event.request).then((response) => response || fetch(event.request)));
});
self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then((cacheNames) => Promise.all(cacheNames.map((cacheName) => {
        if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
    }))));
    self.clients.claim();
});
