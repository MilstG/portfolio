/**
 * Service worker registration.
 *
 * Registered from the client after load so it never competes with the first
 * paint, and skipped entirely in dev — a caching layer in front of HMR only
 * produces confusing stale modules.
 */

const SW_URL = "/sw.js";

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_URL).catch((err) => {
      // Not fatal: the app works fine without it, just without offline.
      console.error("[pwa] no se pudo registrar el service worker:", err);
    });
  });
}

/**
 * Drop every cached page.
 *
 * The cached HTML is a signed-in dashboard, so it must not outlive the session:
 * without this, someone opening the app offline on a shared device would still
 * see the previous holder's balances.
 */
export async function purgeOfflineCache() {
  if (typeof window === "undefined") return;
  try {
    navigator.serviceWorker?.controller?.postMessage("PURGE");
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* best effort — sign-out must not fail because a cache would not clear */
  }
}
