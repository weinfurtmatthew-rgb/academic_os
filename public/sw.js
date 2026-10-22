/* Academic OS service worker — offline-first app shell caching. */
const VERSION = 'aos-v5';
const PRECACHE = `${VERSION}-precache`;
const RUNTIME = `${VERSION}-runtime`;

const ROUTES = [
  '/', '/courses/', '/assignments/', '/lectures/', '/exams/',
  '/notes/', '/flashcards/', '/planner/', '/grades/', '/calendar/', '/analytics/', '/settings/', '/schedule/', '/study/', '/sync/', '/more/', '/canvas/',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(ROUTES)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // live data (the Canvas feed) is never cached
  if (url.pathname.startsWith('/api/')) return;

  // page navigations: network-first, fall back to cache, then app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match(url.pathname) || caches.match('/')),
        ),
    );
    return;
  }

  // static assets (JS/CSS/fonts/images): cache-first with background fill
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
