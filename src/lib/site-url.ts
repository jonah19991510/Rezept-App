import "server-only";
import { headers } from "next/headers";

/**
 * Basis-URL der App für Links in E-Mails (Einladung, Passwort zurücksetzen).
 * Bevorzugt SITE_URL aus der Umgebung, sonst der Host der aktuellen Anfrage.
 */
export async function getSiteUrl(): Promise<string> {
  const fromEnv = process.env.SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
