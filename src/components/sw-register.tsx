"use client";

import { useEffect } from "react";

/** Registers the service worker (public/sw.js) for basic PWA installability
 *  and an offline fallback shell — never for caching authoritative game
 *  data or API responses (see public/sw.js for exactly what it caches). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Best-effort — the app works fully without a service worker.
      });
    }
  }, []);

  return null;
}
