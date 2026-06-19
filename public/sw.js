// Service worker: installability + offline shell, and Web Push so reminders
// arrive even when the app is closed. Paths derive from the registration scope
// so it works under a GitHub Pages base path or at the root.

const CACHE = "claudio-v2";
const SCOPE = new URL(self.registration.scope).pathname; // "/asistenteperso/" or "/"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([SCOPE, `${SCOPE}manifest.webmanifest`, `${SCOPE}icon-192.png`])).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {}); return res; })
      .catch(() => caches.match(request).then((hit) => hit || caches.match(SCOPE))),
  );
});

// ---- Web Push ----
self.addEventListener("push", (event) => {
  let data = { title: "Claudio", body: "Time for your next thing.", url: SCOPE };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch { if (event.data) data.body = event.data.text(); }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: `${SCOPE}icon-192.png`,
      badge: `${SCOPE}icon-192.png`,
      tag: data.tag || data.title,
      data: { url: data.url || SCOPE },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || SCOPE;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) { if ("focus" in c) return c.focus(); }
      return self.clients.openWindow(url);
    }),
  );
});
