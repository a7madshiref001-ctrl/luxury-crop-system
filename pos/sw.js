/* Pages: network first, so the cashier always opens the newest version; the saved copy is used when the network is down or slow.
   Assets (scripts, styles, images, fonts): saved copy first, so a slow connection never holds the screen.
   Every script and style URL carries ?v=<version>, so a new release is a new URL and is fetched fresh. */
const CACHE = 'lcpos-v18';
const WAIT_MS = 2500;
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
  const asset = u.pathname.startsWith(ROOT + 'assets/');
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const save = (res) => { if (res.ok && res.type === 'basic') c.put(key, res.clone()); return res; };
    const hit = await c.match(key);
    if (asset) {
      if (!hit) return fetch(r).then(save);
      // versioned file: the saved copy is final. Unversioned (images, fonts): show it now, refresh quietly.
      if (!u.search) e.waitUntil(fetch(r).then(save).catch(() => {}));
      return hit;
    }
    const net = fetch(r).then(save);
    if (!hit) return net;
    return Promise.race([net.catch(() => hit), new Promise((ok) => setTimeout(() => ok(hit), WAIT_MS))]);
  })());
});
