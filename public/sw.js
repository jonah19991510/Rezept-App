// Service Worker des Rezeptbuchs (Phase 8).
// Bewusst schlicht und datensparsam:
// - Seiten (HTML) werden NIE zwischengespeichert, sie enthalten persönliche Daten. Ohne Netz erscheint
//   stattdessen die Seite „Du bist offline“.
// - Nur die unveränderlichen Programmdateien unter /_next/static/ (Dateinamen mit Hash) werden gespeichert,
//   damit die App schneller startet.
// - Fotos (/foto/…) speichert der Browser selbst (privater HTTP-Cache), nicht der Service Worker.
// - Ausnahme (Sport, Phase S2): Die Seite eines laufenden Trainings (/training/<id>) wird beim Laden gespeichert, damit
//   sie im Gym auch ohne Netz neu geladen werden kann. Die App löscht sie beim Beenden, Verwerfen und Abmelden; die
//   Sätze selbst liegen ohnehin im Speicher des Browsers, bis sie hochgeladen sind.

const VERSION = "v2";
const STATIC_CACHE = `rezeptbuch-static-${VERSION}`;
const SHELL_CACHE = `rezeptbuch-shell-${VERSION}`;
const TRAINING_CACHE = "rezeptbuch-training";
const OFFLINE_URL = "/offline.html";
const SHELL = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("rezeptbuch-") && ![STATIC_CACHE, SHELL_CACHE, TRAINING_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Laufendes Training: aus dem Netz und dabei speichern, ohne Netz die gespeicherte Fassung
  if (request.mode === "navigate" && url.pathname.startsWith("/training/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !response.redirected) {
            const copy = response.clone();
            event.waitUntil(caches.open(TRAINING_CACHE).then((cache) => cache.put(url.pathname, copy)));
          }
          return response;
        })
        .catch(async () => (await caches.match(url.pathname, { cacheName: TRAINING_CACHE })) ?? caches.match(OFFLINE_URL)),
    );
    return;
  }

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
