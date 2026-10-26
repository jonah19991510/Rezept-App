/**
 * Prüft ein Weiterleitungsziel aus der URL (z. B. ?weiter=/wochenplan).
 * Erlaubt sind nur relative Pfade innerhalb der App, damit niemand einen
 * Login-Link bauen kann, der auf eine fremde Seite weiterleitet.
 */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/")) return fallback;
  // "//evil.com" und "/\evil.com" werden von Browsern als fremder Host gelesen
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
