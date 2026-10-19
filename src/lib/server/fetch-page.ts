import "server-only";
import { lookup } from "node:dns/promises";
import { checkImportUrl, isPrivateAddress } from "@/lib/domain/url-safety";

// Lädt eine Rezeptseite für den Import per Link. Es werden keine Nutzerdaten mitgeschickt
// (keine Cookies, kein Referer), nur ein neutraler User-Agent.

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0 (compatible; Rezeptbuch/0.1; private Familien-App)";

export class FetchPageError extends Error {}

async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new FetchPageError("Diese Webseite wurde nicht gefunden. Stimmt die Adresse?");
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new FetchPageError("Nur öffentliche Webseiten können importiert werden.");
  }
}

async function readLimited(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new FetchPageError("Die Seite ist zu groß zum Importieren.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function decode(bytes: Uint8Array, contentType: string): string {
  const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase() ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** Lädt die Seite (Weiterleitungen werden einzeln geprüft) und gibt HTML und endgültige Adresse zurück. */
export async function fetchPublicPage(input: string): Promise<{ html: string; url: string }> {
  const first = checkImportUrl(input);
  if (!first.ok) throw new FetchPageError(first.message);
  let url = first.url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
        },
      });
    } catch (e) {
      throw new FetchPageError(
        e instanceof Error && e.name === "TimeoutError"
          ? "Die Webseite antwortet nicht. Bitte später noch einmal versuchen."
          : "Die Webseite konnte nicht geladen werden.",
      );
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) throw new FetchPageError("Die Webseite leitet ins Leere weiter.");
      const next = checkImportUrl(new URL(location, url).toString());
      if (!next.ok) throw new FetchPageError(next.message);
      url = next.url;
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new FetchPageError(
        [401, 402, 403, 429, 451].includes(res.status)
          ? "Die Webseite lässt sich nicht automatisch abrufen. Du kannst das Rezept von Hand anlegen."
          : `Die Webseite antwortet mit einem Fehler (${res.status}).`,
      );
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !/html|xml/i.test(contentType)) {
      await res.body?.cancel();
      throw new FetchPageError("Unter dieser Adresse liegt keine Webseite.");
    }
    return { html: decode(await readLimited(res), contentType), url: url.toString() };
  }
  throw new FetchPageError("Zu viele Weiterleitungen.");
}
