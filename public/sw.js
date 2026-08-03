// Minimal service worker: caches only the static app-shell assets needed to
// show *something* useful offline (the landing page's static shell, the
// manifest, and icons) plus a tiny offline fallback page.
//
// Deliberately never caches or intercepts:
//   - /api/**            (every authoritative game action and auth call)
//   - /room/**            (a game's live state is never something to serve
//                          from a stale cache — see docs/ARCHITECTURE.md)
// A queued "offline move" that might be illegal by the time connectivity
// returns is not allowed by this app's design, so this worker doesn't do
// background sync or request queueing of any kind.
const CACHE_NAME = "naija-whot-shell-v1";
const SHELL_URLS = ["/", "/manifest.webmanifest", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept API calls or in-game routes — always go straight to the
  // network so the app never silently serves stale/incorrect game state.
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/room/")) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html").then((res) => res ?? Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request)),
  );
});
