// Service Worker v2 — cache disabled for development
// Only cache truly static assets, never Supabase or API calls

const CACHE_NAME = "medai-v2";
const NEVER_CACHE = [
  "supabase.co",
  "localhost:8000",
  "/api/",
  "storage/v1",
  "rest/v1",
];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // Clear ALL old caches on activate
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => {
        console.log("[SW] Deleting cache:", k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = e.request.url;

  // NEVER cache these — always go to network
  if (NEVER_CACHE.some((pattern) => url.includes(pattern))) {
    e.respondWith(fetch(e.request));
    return;
  }

  // For everything else — network first, cache as fallback
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Only cache successful GET requests for static assets
        if (e.request.method === "GET" && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
