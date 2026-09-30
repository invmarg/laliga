/* Liga · administración: permite abrirla como app y sin conexión. */
var CACHE = 'liga-admin-v1';
var SHELL = ['./', './manifest.webmanifest', './icons/admin-icon-192.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('liga-admin-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url), base = new URL('./', self.location);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.indexOf(base.pathname + 'view/') === 0) return; // la vista de jugadores tiene su propio service worker
  if (req.mode === 'navigate') {
    if (url.pathname !== base.pathname && url.pathname !== base.pathname + 'index.html') return;
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok) { var copia = res.clone(); caches.open(CACHE).then(function (c) { c.put('./', copia); }); }
      return res;
    }).catch(function () { return caches.match('./'); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (guardado) {
    var red = fetch(req).then(function (res) {
      if (res.ok) { var copia = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copia); }); }
      return res;
    }).catch(function () { return guardado; });
    return guardado || red;
  }));
});
