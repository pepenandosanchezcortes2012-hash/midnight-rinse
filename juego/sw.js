/**
 * Service worker: el juego funciona sin internet después de la primera visita.
 * - La página (index.html) va primero a la red (para recibir actualizaciones) y, sin conexión, sale de la caché.
 * - Los scripts y estilos llevan ?v=<versión> (herramientas/sellar_version.py): son inmutables, así que salen de la
 *   caché si están; al guardar una versión nueva se borran las viejas del mismo archivo.
 * - Nada de otros sitios (YouTube) pasa por aquí.
 */
'use strict';

var CACHE = 'midnight-rinse-v1';

// Al instalarse guarda todo lo que index.html necesita: listo sin conexión desde la primera visita.
self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(fetch('index.html', { cache: 'no-store' }).then(function (res) {
    return res.text();
  }).then(function (html) {
    var urls = ['./', 'index.html', 'manifest.webmanifest'];
    html.replace(/(?:src|href)="([^"]+)"/g, function (m, u) {
      if (!/^(https?:|#|data:|mailto:)/.test(u)) { urls.push(u); }
      return m;
    });
    return caches.open(CACHE).then(function (cache) { return cache.addAll(urls); });
  }).catch(function () { /* sin red al instalar: se guardará al jugar */ }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (names) {
    return Promise.all(names.filter(function (n) { return n.indexOf('midnight-rinse-') === 0 && n !== CACHE; })
      .map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

function sameFileOtherVersion(a, b) {
  var ua = new URL(a);
  var ub = new URL(b);
  return ua.origin === ub.origin && ua.pathname === ub.pathname && ua.search !== ub.search;
}

function store(request, response) {
  if (!response || !response.ok || response.type !== 'basic') { return; }
  var copy = response.clone();
  caches.open(CACHE).then(function (cache) {
    cache.put(request, copy);
    // Limpieza: versiones viejas del mismo archivo (no las páginas, que se guardan sin ?).
    if (new URL(request.url).search) {
      cache.keys().then(function (keys) {
        keys.forEach(function (k) { if (sameFileOtherVersion(k.url, request.url)) { cache.delete(k); } });
      });
    }
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') { return; }
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) { return; }

  if (req.mode === 'navigate') {
    // La página: red primero; sin red, la última guardada (sin parámetros, para que ?app=1 también funcione).
    var pageKey = new Request(url.origin + url.pathname);
    event.respondWith(fetch(req).then(function (res) {
      store(pageKey, res);
      return res;
    }).catch(function () {
      return caches.match(pageKey).then(function (hit) { return hit || caches.match(new Request(url.origin + url.pathname + 'index.html')); });
    }));
    return;
  }

  if (/[?&]v=/.test(url.search)) {
    // Recursos versionados: caché primero (son inmutables); si no están, red y se guardan.
    event.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) { store(req, res); return res; });
    }));
    return;
  }
  // Lo demás (iconos, manifiesto, pruebas): red primero, caché si no hay conexión.
  event.respondWith(fetch(req).then(function (res) { store(req, res); return res; })
    .catch(function () { return caches.match(req); }));
});
