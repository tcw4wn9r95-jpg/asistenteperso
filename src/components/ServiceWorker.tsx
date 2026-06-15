"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/basePath";

// Registers the service worker that makes the app installable (Add to Home
// Screen) and provides a basic offline shell.
export function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch(() => {
      /* registration is best-effort */
    });
  }, []);
  return null;
}
