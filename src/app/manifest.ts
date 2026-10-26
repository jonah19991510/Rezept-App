import type { MetadataRoute } from "next";
import { BRAND_BACKGROUND, BRAND_TERRACOTTA } from "@/lib/app-icon";

/** Web-App-Manifest: macht die App auf dem Handy installierbar („Zum Home-Bildschirm“). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rezeptbuch",
    short_name: "Rezeptbuch",
    description: "Rezepte, Makros, Wochenplan und Einkaufsliste für Freunde und Familie.",
    lang: "de-DE",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND_BACKGROUND,
    theme_color: BRAND_TERRACOTTA,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Wochenplan", url: "/wochenplan" },
      { name: "Einkaufsliste", url: "/einkauf" },
    ],
  };
}
