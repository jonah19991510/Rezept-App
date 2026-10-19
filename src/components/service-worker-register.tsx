"use client";

import { useEffect } from "react";

/**
 * Meldet den Service Worker an (nur im fertigen Build, nicht beim Entwickeln: dort würde er
 * neue Programmdateien verdecken). Funktioniert nur über HTTPS oder auf localhost.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Ohne Service Worker funktioniert die App genauso, nur ohne Offline-Hinweis
    });
  }, []);
  return null;
}
