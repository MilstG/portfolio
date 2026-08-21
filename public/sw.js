/**
 * Service worker: makes the app installable and keeps the last dashboard
 * readable without a connection.
 *
 * The rules are deliberately narrow, because this app shows money:
 *
 *  - `/_server*` is never cached. Those are the server functions: balances,
 *    prices and the auth check. A stale balance served from disk is worse than
 *    no balance, and caching them would also cache the session's answers.
 *  - Only GET is touched at all. Anything that mutates goes straight out.
 *  - Navigations are network-first, so an online visit always shows live data
 *    and the cache is only the fallback.
 *  - Hashed build assets are cache-first: their URL changes when they change,
 *    so a hit is never stale.
 *
 * The cached HTML belongs to a signed-in session, so `logout` posts PURGE and
 * everything is dropped — otherwise the next person offline on this device
 * would see the previous holder's dashboard.
 */

const VERSION = "v1";
const SHELL_CACHE = `pat-shell-${VERSION}`;
const PAGE_CACHE = `pat-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";

/** Static, safe to serve from disk on a cold start. */
const SHELL = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one missing icon cannot fail the whole install.
      .then((cache) =>
        Promise.all(
          SHELL.map((url) =>
            cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== PAGE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Dropping every cache on sign-out; see the header note. */
self.addEventListener("message", (event) => {
  if (event.data === "PURGE") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
    );
  }
});

function isAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    /\.(?:js|css|png|svg|webmanifest|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Server functions: live data and the session check. Never cached.
  if (url.pathname.startsWith("/_server")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only a clean 200 is worth keeping: a redirect to /login is the
          // auth gate, not a page.
          if (response.ok && !response.redirected) {
            const copy = response.clone();
            // Held open with waitUntil: a bare promise here can be cut short
            // when the worker is terminated after responding, which silently
            // left the page cache empty and offline broken.
            event.waitUntil(
              caches.open(PAGE_CACHE).then((c) => c.put(request, copy)),
            );
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // Deliberately no "fall back to the home page": serving the dashboard
          // under /cashflow puts the wrong page behind the right URL, and the
          // client router would hydrate against a route whose data is absent.
          // Say there is nothing instead.
          return (
            (await caches.match(OFFLINE_URL)) ||
            new Response("Sin conexión", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }),
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              event.waitUntil(
                caches.open(SHELL_CACHE).then((c) => c.put(request, copy)),
              );
            }
            return response;
          }),
      ),
    );
  }
});
