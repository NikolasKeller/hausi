// Minimal service worker: makes the app installable everywhere and keeps a
// copy of the shell + hashed assets for offline loads. API calls always hit
// the network.
//
// The cache name carries a per-build id (postexport.mjs replaces __BUILD_ID__
// with a hash of the exported JS on each `expo export`). A new build ⇒ a new
// cache name ⇒ `activate` drops every prior cache ⇒ clients refetch the fresh
// bundle. This is required because Expo's `entry-<hash>.js` filename is NOT
// content-derived — the same filename can ship different code across deploys,
// so a static cache name would pin installed PWAs to stale JS forever.
const CACHE = 'iykyk-__BUILD_ID__';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add('/'))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  // Every navigation serves the same SPA shell; cache it under '/'.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Safe to serve cache-first: the cache name is bumped every build, so a hit
  // here always belongs to the currently-deployed build (see CACHE above).
  if (
    url.pathname.startsWith('/_expo/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ??
          fetch(event.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            return res;
          })
      )
    );
  }
});
