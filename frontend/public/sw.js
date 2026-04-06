const CACHE_VERSION = "HealthMate-v3";
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const API_CACHE     = `${CACHE_VERSION}-api`;

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Never cache these - always fresh from network
const BYPASS_PATTERNS = [
  "supabase.co",
  "googleapis.com",
  "duckduckgo.com",
  "overpass-api.de",
  "openstreetmap.org",
  "/api/",
];

// Cache API responses briefly (30 sec) for offline resilience
const CACHE_API_PATTERNS = [
  "/news/medical",
];

// ── Install ───────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[SW] Precache partial failure:", err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("HealthMate-") && k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => {
            console.log("[SW] Deleting old cache:", k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = request.url;

  // Skip non-GET and non-http
  if (request.method !== "GET" || !url.startsWith("http")) return;

  // BYPASS - always network
  if (BYPASS_PATTERNS.some((p) => url.includes(p))) {
    e.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: "offline" }), {
          headers: { "Content-Type": "application/json" },
          status: 503,
        })
      )
    );
    return;
  }

  // API news - short cache (30 seconds for offline support)
  if (CACHE_API_PATTERNS.some((p) => url.includes(p))) {
    e.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            cache.put(request, clone);
            // Expire after 30 seconds
            setTimeout(() => cache.delete(request), 30000);
          }
          return res;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Static assets - cache first, then network
  e.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const res   = await fetch(request);
        const clone = res.clone();
        // Only cache successful responses for same-origin assets
        if (res.ok && url.includes(self.location.origin)) {
          cache.put(request, clone);
        }
        return res;
      } catch {
        // Offline fallback for navigation requests
        if (request.mode === "navigate") {
          return caches.match("/index.html");
        }
        return new Response("Offline", { status: 503 });
      }
    })
  );
});

// ── Push notifications (for medication reminders) ─────────────
self.addEventListener("push", (e) => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || "HealthMate Reminder", {
      body:    data.body || "Time to take your medication",
      icon:    "/icons/icon-192.png",
      badge:   "/icons/icon-96.png",
      tag:     "HealthMate-reminder",
      vibrate: [200, 100, 200],
      data:    { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window" }).then((cls) => {
      const url = e.notification.data?.url || "/";
      const existing = cls.find((c) => c.url === url && "focus" in c);
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
