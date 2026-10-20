import type { MetadataRoute } from "next";

// Die App ist privat: alle Bots aussperren. Ausnahme: Link-Vorschau-Bots der Messenger dürfen geteilte
// Rezeptkarten (/r/…) lesen, damit beim Teilen ein Vorschaubild erscheint. Indexiert wird trotzdem nichts
// (noindex per Meta-Tag und X-Robots-Tag, siehe next.config.ts).
const PREVIEW_BOTS = [
  "facebookexternalhit", // WhatsApp, Facebook, Instagram
  "WhatsApp",
  "TelegramBot",
  "Twitterbot",
  "Slackbot-LinkExpanding",
  "Discordbot",
  "LinkedInBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: PREVIEW_BOTS, allow: "/r/", disallow: "/" },
      { userAgent: "*", disallow: "/" },
    ],
  };
}
