// Minimal service worker: enables installability + a network-first strategy with
// an offline fallback. Paths are derived from the registration scope so it works
// under a GitHub Pages base path (e.g. /asistenteperso/) or at the root.

const CACHE = "claudio-v1";
const SCOPE = new URL(self.registration.scope).pathname; // e.g. "/asistenteperso/" or "/"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([`${SCOPE}today/`, `${SCOPE}manifest.webmanifest`, `${SCOPE}icon-192.png`]))
      .catch(() => {}),
  );
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
  if (request.method !== "GET") return;
  // Never cache cross-origin integration reads (raw.githubusercontent etc.).
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match(`${SCOPE}today/`))),
  );
});
