// Offline support. App files: served from cache, refreshed in the background.
// Data (data/*.json): network first, cache as fallback. Documents: cached the first time they're opened.
const VERSION = 'shopbook-v1';
const SHELL = ['./', 'index.html', 'app/style.css', 'app/main.js', 'app/store.js', 'app/ui.js', 'app/md.js', 'app/views.js', 'app/views2.js', 'app/actions.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'data/index.json', 'data/car.json', 'data/log.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('message', e => {
  if (e.data?.type === 'precache') {
    e.waitUntil(caches.open(VERSION).then(async c => {
      for (const u of e.data.urls) { try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch { } }
    }));
  }
});

function networkFirst(req, key) {
  return fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(key, copy)); }
    return r;
  }).catch(() => caches.match(key).then(r => r || caches.match(req)));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.github.com') return; // never cache API calls
  const sameOrigin = url.origin === location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;

  if (sameOrigin && url.pathname.includes('/data/')) {
    // network first
    e.respondWith(networkFirst(req, url.pathname));
    return;
  }
  // App code: network first too, so a new version takes effect on the next load.
  if (sameOrigin && !url.pathname.includes('/files/')) {
    e.respondWith(networkFirst(req, url.pathname));
    return;
  }
  // Documents, photos and fonts: cache first, refreshed in the background.
  e.respondWith(caches.open(VERSION).then(async c => {
    const key = sameOrigin ? url.pathname : req;
    const hit = await c.match(key) || await c.match(req);
    const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(key, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
