import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Entwickler-Knopf „N“ ausblenden: verdeckt auf dem Handy sonst die Navigation.
  // Fehler beim Entwickeln zeigt Next trotzdem an. In der fertigen App gibt es den Knopf ohnehin nicht.
  devIndicators: false,
  // Nur für den Entwicklungsserver: Zugriff vom Handy im Heimnetz (npm run dev:lan, http://192.168.x.x:3000)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
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
    ];
  },
};

export default nextConfig;
