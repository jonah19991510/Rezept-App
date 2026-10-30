import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Entwickler-Knopf „N“ ausblenden: verdeckt auf dem Handy sonst die Navigation.
  // Fehler beim Entwickeln zeigt Next trotzdem an. In der fertigen App gibt es den Knopf ohnehin nicht.
  devIndicators: false,
  // Nur für den Entwicklungsserver: Zugriff vom Handy im Heimnetz (npm run dev:lan, http://192.168.x.x:3000)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  experimental: {
    // Zwischenspeicher im Browser für Seitenwechsel (Sekunden). `static` gilt auch für die vorgeladenen Tabs der
    // unteren Navigation, `dynamic` für zuletzt besuchte Seiten (schnelles Hin- und Herwechseln). Eigene Änderungen
    // leeren ihn sofort (revalidatePath); Änderungen anderer sind höchstens so lange unsichtbar.
    staleTimes: {
      dynamic: 30,
      static: 60,
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Suchmaschinen sollen nichts indexieren (siehe SPEC „Nicht auffindbar“).
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // Service Worker: nie zwischenspeichern, damit Updates sofort ankommen
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
