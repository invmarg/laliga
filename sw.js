/* Liga · vista de jugadores: funciona sin conexión y muestra las notificaciones. */
var CACHE = 'liga-vista-v1';
var API = new URL(self.location.href).searchParams.get('api') || '';
var SHELL = ['./', './manifest.webmanifest', '../icons/icon-192.png', '../icons/badge-96.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('liga-vista-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
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

/* ---- notificaciones ---- */
function leerUltima() {
  return caches.open('liga-meta').then(function (c) { return c.match('ultima'); })
    .then(function (r) { return r ? r.text() : '0'; }).then(Number).catch(function () { return 0; });
}
function guardarUltima(id) {
  return caches.open('liga-meta').then(function (c) { return c.put('ultima', new Response(String(id))); }).catch(function () {});
}
function linkLiga() {
  var m = /\/macros\/s\/([^\/]+)\/exec/.exec(API);
  return new URL('./' + (m ? '?liga=' + encodeURIComponent(m[1]) : '') + '#novedades', self.location).href;
}
function mostrar() {
  var pedir = API
    ? fetch(API + (API.indexOf('?') < 0 ? '?' : '&') + 'accion=novedades&n=5&t=' + Date.now()).then(function (r) { return r.json(); }).catch(function () { return null; })
    : Promise.resolve(null);
  return Promise.all([pedir, leerUltima()]).then(function (v) {
    var lista = (v[0] && v[0].novedades) || [], ultima = v[1] || 0;
    var nuevas = lista.filter(function (n) { return n.id > ultima; });
    if (!nuevas.length && lista.length) nuevas = [lista[0]];
    var titulo = 'Liga', cuerpo = 'Hay novedades en la liga.', tag = 'liga';
    if (nuevas.length) {
      titulo = nuevas[0].titulo; cuerpo = nuevas[0].texto || ''; tag = 'liga-' + nuevas[0].id;
      if (nuevas.length > 1) cuerpo += (cuerpo ? '\n' : '') + '+ ' + (nuevas.length - 1) + (nuevas.length > 2 ? ' novedades más' : ' novedad más');
    }
    var fin = lista.length ? guardarUltima(lista[0].id) : Promise.resolve();
    return fin.then(function () {
      return self.registration.showNotification(titulo, {
        body: cuerpo, tag: tag, renotify: true,
        icon: new URL('../icons/icon-192.png', self.location).href,
        badge: new URL('../icons/badge-96.png', self.location).href,
        data: { url: linkLiga() }
      });
    });
  });
}
self.addEventListener('push', function (e) { e.waitUntil(mostrar()); });

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) {
      if (cs[i].url.indexOf(self.registration.scope) === 0 && 'focus' in cs[i]) {
        cs[i].postMessage({ tipo: 'abrir-novedades' });
        return cs[i].focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});

self.addEventListener('pushsubscriptionchange', function (e) {
  if (!API) return;
  e.waitUntil(fetch(API + (API.indexOf('?') < 0 ? '?' : '&') + 'accion=datos&t=' + Date.now()).then(function (r) { return r.json(); }).then(function (d) {
    if (!d || !d.vapid) return;
    var s = d.vapid.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var b = atob(s), key = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) key[i] = b.charCodeAt(i);
    return self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).then(function (sub) {
      return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ accion: 'suscribir', sub: sub.toJSON() }) });
    });
  }).catch(function () {}));
});
