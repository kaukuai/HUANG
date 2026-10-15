const CACHE = 'spain-pocket-__BUILD_ID__';
const BASE = new URL('./', self.location).pathname;
const FILES = ['./', './index.html', './styles.css', './app.js', './time.js', './storage.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './data/share.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(Promise.all([
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('spain-pocket-') && k !== CACHE).map(k => caches.delete(k)))),
  self.clients.claim(),
])));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/data/share.json')) {
    e.respondWith(fetch(e.request).then(async response => {
      if (response.ok) (await caches.open(CACHE)).put(e.request, response.clone());
      return response;
    }).catch(async () => (await caches.match(e.request)) || (e.request.mode === 'navigate' ? await caches.match('./index.html') : Response.error())));
  } else e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});
