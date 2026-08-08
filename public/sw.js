// Service worker minimo: solo habilita la instalacion (PWA) cacheando
// assets realmente estaticos (manifest, iconos). A diferencia de la app
// original (un solo HTML estatico que hablaba con Firebase desde el
// cliente), acá cada página se renderiza en el servidor según la sesión
// del usuario — cachear HTML genérico podría filtrar datos entre cuentas
// en un dispositivo compartido, así que el resto de las requests van
// siempre a la red, sin cache ni fallback offline.
var CACHE = "gratinata-shell-v1";
var SHELL = ["/manifest.json", "/icon-192.png", "/icon-512.png", "/icon-512-maskable.png", "/apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (SHELL.indexOf(url.pathname) === -1) return;

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return (
        cached ||
        fetch(e.request).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
          return res;
        })
      );
    })
  );
});
