// Service worker minimo: solo habilita la instalacion y cachea el
// "cascaron" de la app (HTML/manifest/iconos) para que abra rapido.
// Las llamadas a Firebase/Firestore NUNCA se interceptan: siempre van
// a la red, para no mostrar datos de inventario desactualizados.
var CACHE = "gratinata-shell-v1";
var SHELL = ["./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(e) {
  var url = e.request.url;
  // Nunca cachear Firebase/Firestore/Google APIs: siempre a la red.
  if (url.indexOf("firestore.googleapis.com") !== -1 ||
      url.indexOf("googleapis.com") !== -1 ||
      url.indexOf("gstatic.com") !== -1) {
    return;
  }
  // Cascaron propio: red primero, si falla usa el cache (soporte offline basico).
  e.respondWith(
    fetch(e.request).then(function(res) {
      var copy = res.clone();
      caches.open(CACHE).then(function(c) { c.put(e.request, copy); });
      return res;
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});
