// Minimal service worker: enables installability + a network-first strategy
// with an offline fallback to whatever is cached. Intentionally simple — the
// app is dynamic (auth + API), so we don't aggressively cache data.

const CACHE = "claudio-v1";
const SHELL = ["/today", "/manifest.webmanifest", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only handle GET navigations/assets; never cache API or auth calls.
  if (request.method !== "GET" || new URL(request.url).pathname.startsWith("/api")) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("/today"))),
  );
});
