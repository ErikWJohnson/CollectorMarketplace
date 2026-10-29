/* Static shell only: never cache account, chat, payment, delivery, or API data. */
const CACHE_NAME = 'collector-marketplace-shell-v2';
const SHELL_ASSETS = [
  '/', '/index.html', '/offline.html', '/site.js', '/site.css', '/layout-fixes.css',
  '/full-width.css', '/immersive-feed.css', '/persistent-dock.css', '/mobile-responsive.css',
  '/pwa-mobile.css', '/professional-polish.css', '/favicon.png', '/favicon-512.png',
  '/public/logo-three-cards.png'
];
const SENSITIVE_PREFIXES = /^\/(?:api|auth|account|paypal|membership|trade|delivery|chat|voice|notifications|shipping|tax|listing\/[^/]+\/(?:statistics|promotion))/i;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.all(SHELL_ASSETS.map(asset => cache.add(asset).catch(() => undefined)))));
});
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || SENSITIVE_PREFIXES.test(url.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }
  if (!SHELL_ASSETS.includes(url.pathname)) return;
  event.respondWith(caches.match(url.pathname, { ignoreSearch: true }).then(cached => {
    const refresh = fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(url.pathname, response.clone()));
      return response;
    }).catch(() => cached);
    return cached || refresh;
  }));
});
