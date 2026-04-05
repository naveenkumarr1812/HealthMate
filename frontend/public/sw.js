const CACHE_NAME = "medai-v1";
const STATIC_ASSETS = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // API calls — always network first
  if (e.request.url.includes("/api/")) {
    e.respondWith(fetch(e.request).catch(() => new Response("Offline", { status: 503 })));
    return;
  }
  // Static assets — cache first
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
      return res;
    }))
  );
});
