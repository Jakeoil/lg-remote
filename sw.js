// sw.js — Service worker: cache static assets for instant page navigation
const CACHE = 'lg-remote-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/channels.html',
  '/prototype.html',
  '/styles.css',
  '/channels.css',
  '/app.js',
  '/channels-app.js',
  '/nav.js',
  '/rotary-knob.js',
  '/sliding-ruler.js',
  '/favicon.ico',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Only cache-first for same-origin navigation & static assets
  if (url.origin !== location.origin) return;
  // Don't cache API calls
  if (url.pathname.startsWith('/volume') ||
      url.pathname.startsWith('/sonos') ||
      url.pathname.startsWith('/tv') ||
      url.pathname.startsWith('/plug') ||
      url.pathname.startsWith('/mode') ||
      url.pathname.startsWith('/output') ||
      url.pathname.startsWith('/channel') ||
      url.pathname.startsWith('/app/') ||
      url.pathname.startsWith('/roku')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // Serve from cache, update in background (stale-while-revalidate)
      const fetchPromise = fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
