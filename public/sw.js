// Service Worker des Rezeptbuchs (Phase 8).
// Bewusst schlicht und datensparsam:
// - Seiten (HTML) werden NIE zwischengespeichert, sie enthalten persönliche Daten. Ohne Netz erscheint
//   stattdessen die Seite „Du bist offline“.
// - Nur die unveränderlichen Programmdateien unter /_next/static/ (Dateinamen mit Hash) werden gespeichert,
//   damit die App schneller startet.
// - Fotos (/foto/…) speichert der Browser selbst (privater HTTP-Cache), nicht der Service Worker.

const VERSION = "v1";
const STATIC_CACHE = `rezeptbuch-static-${VERSION}`;
const SHELL_CACHE = `rezeptbuch-shell-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const SHELL = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("rezeptbuch-") && ![STATIC_CACHE, SHELL_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Seitenaufrufe: immer aus dem Netz, ohne Netz die Offline-Seite
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Programmdateien mit Hash im Namen ändern sich nie: zuerst aus dem Cache
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
