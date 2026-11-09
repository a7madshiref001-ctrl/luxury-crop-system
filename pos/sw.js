/* Network first, so the cashier always runs the newest version; the saved copy is used only without internet. */
const CACHE = 'lcpos-v6';
const WAIT_MS = 4000;
const ROOT = new URL(self.registration.scope).pathname;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('lcpos-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
const clean = (p) => (p.endsWith('/') ? p + 'index' : p.replace(/\.html$/, ''));
self.addEventListener('fetch', (e) => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith(ROOT)) return;
  const key = clean(u.pathname) + u.search;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const net = fetch(r).then((res) => { if (res.ok && res.type === 'basic') c.put(key, res.clone()); return res; });
    const hit = await c.match(key);
    if (!hit) return net;
    return Promise.race([net.catch(() => hit), new Promise((ok) => setTimeout(() => ok(hit), WAIT_MS))]);
  })());
});
