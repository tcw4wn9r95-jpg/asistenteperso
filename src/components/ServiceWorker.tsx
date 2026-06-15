"use client";

import { useEffect } from "react";

// Registers the service worker that makes the app installable (Add to Home
// Screen) and provides a basic offline shell.
export function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration is best-effort */
    });
  }, []);
  return null;
}
