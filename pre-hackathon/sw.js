// Offline-capable service worker. Caches the whole app shell on install, then serves
// network-first with a short timeout and a cache fallback.
//
// It used to serve cache-first, which meant a device kept showing whatever it downloaded
// the very first time: a fix could not reach the child's tablet without clearing website
// data by hand. Network-first keeps the app current while still running with no network
// at all, because a failed — or merely slow — fetch falls straight back to the cache.
const CACHE = 'count-play-v7';
const NET_TIMEOUT = 3000;   // beyond this, assume no usable network and use the cache
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './audio.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Reject rather than hang on a network that accepts the connection but never answers —
// a captive portal or a weak signal would otherwise leave the child staring at nothing.
function fromNetwork(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), NET_TIMEOUT);
    fetch(request).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fromNetwork(e.request)
      .then((res) => {
        // Keep the cache warm for the next launch, but never store an error page.
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});
