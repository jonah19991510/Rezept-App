// Schutz beim Import per Link: Der Server lädt nur öffentliche Webseiten, keine Adressen im eigenen
// Netz (localhost, Router, Cloud-Metadaten …). Sonst könnte man über die App interne Dienste abfragen (SSRF).

function ipv4Parts(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : Number.NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

function isPrivateIpv4([a, b]: number[]): boolean {
  return (
    a === 0 || // „dieses Netz“
    a === 10 ||
    a === 127 || // Loopback
    (a === 100 && b >= 64 && b <= 127) || // Carrier-NAT
    (a === 169 && b === 254) || // Link-local, Cloud-Metadaten
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) || // Benchmark-Netz
    a >= 224 // Multicast und reserviert
  );
}

/** true für Adressen, die nicht öffentlich im Internet liegen (IPv4 und IPv6). */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ipv4Parts(ip);
  if (v4) return isPrivateIpv4(v4);

  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (!v6.includes(":")) return true; // unbekanntes Format: lieber ablehnen
  if (v6 === "::" || v6 === "::1") return true;
  // IPv4 in IPv6 (::ffff:10.0.0.1 oder ::ffff:a00:1)
  const mapped = /^(?:0*:)*:?ffff:(.+)$/.exec(v6);
  if (mapped) {
    const inner = ipv4Parts(mapped[1]);
    if (inner) return isPrivateIpv4(inner);
    const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(mapped[1]);
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      return isPrivateIpv4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
    }
    return true;
  }
  const first = parseInt(v6.split(":")[0] || "0", 16);
  return (
    (first & 0xfe00) === 0xfc00 || // fc00::/7 Unique Local
    (first & 0xffc0) === 0xfe80 || // fe80::/10 Link-local
    (first & 0xff00) === 0xff00 || // Multicast
    v6.startsWith("64:ff9b:") || // NAT64
    v6.startsWith("2001:db8:") // Dokumentation
  );
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; message: string };

/** Prüft eine eingegebene Adresse, bevor der Server sie lädt (DNS-Auflösung prüft der Server danach). */
export function checkImportUrl(input: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, message: "Das ist keine gültige Webadresse." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, message: "Bitte eine Webadresse mit http:// oder https:// angeben." };
  }
  if (url.username || url.password) return { ok: false, message: "Adressen mit Zugangsdaten werden nicht geladen." };
  if (url.port && url.port !== "80" && url.port !== "443") {
    return { ok: false, message: "Diese Adresse kann nicht geladen werden." };
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host.endsWith(".home.arpa") ||
    (!host.includes(".") && !host.includes(":"))
  ) {
    return { ok: false, message: "Nur öffentliche Webseiten können importiert werden." };
  }
  if ((ipv4Parts(host) || host.startsWith("[")) && isPrivateAddress(host)) {
    return { ok: false, message: "Nur öffentliche Webseiten können importiert werden." };
  }
  url.hash = "";
  return { ok: true, url };
}
