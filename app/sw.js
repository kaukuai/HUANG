const CACHE = 'spain-pocket-__BUILD_ID__';
const BUILD = CACHE.slice('spain-pocket-'.length);
const BASE = new URL('./', self.location).pathname;
const FILES = ['./', './index.html', './styles.css', './app.js', './time.js', './presentation.js', './storage.js', './updates.js', './version.json', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './data/share.json'];
const acknowledged = new Set();
self.addEventListener('message', event => {
  if (event.data?.type === 'CLIENT_VERSION' && event.source?.id) acknowledged.add(event.source.id);
});
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('spain-pocket-') && key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
  const windows = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
  const clients = windows.filter(client => new URL(client.url).pathname.startsWith(BASE));
  for (const client of clients) client.postMessage({ type:'APP_VERSION', build:BUILD });
  // Legacy clients have no update listener; refresh them once after caching the new shell.
  // Current clients acknowledge and can defer while importing a companion pack.
  await new Promise(resolve => setTimeout(resolve,700));
  // Navigation requests wait for activation to finish, so do not await them here.
  for (const client of clients.filter(client => !acknowledged.has(client.id))) client.navigate(client.url).catch(() => {});
})()));
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (!response.ok) throw new Error('Server unavailable');
    await (await caches.open(CACHE)).put(request,response.clone());
    return response;
  } catch {
    const cached = await caches.match(request) || (request.mode === 'navigate' ? await caches.match('./index.html') : null);
    if (!cached) return Response.error();
    const headers = new Headers(cached.headers);
    headers.set('X-Spain-Offline','1');
    return new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers});
  }
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (event.request.mode === 'navigate' || url.pathname.endsWith('/data/share.json') || url.pathname.endsWith('/version.json')) event.respondWith(networkFirst(event.request));
  else event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
