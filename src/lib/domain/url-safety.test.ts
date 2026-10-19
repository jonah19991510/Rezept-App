import { describe, expect, it } from "vitest";
import { checkImportUrl, isPrivateAddress } from "./url-safety";

describe("isPrivateAddress", () => {
  it("erkennt private und besondere IPv4-Adressen", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.178.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "224.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("lässt öffentliche IPv4-Adressen durch", () => {
    for (const ip of ["8.8.8.8", "172.32.0.1", "93.184.216.34", "192.169.0.1"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("IPv6: Loopback, lokal, Link-local, eingebettetes IPv4", () => {
    for (const ip of ["::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:192.168.0.1", "[::1]"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    expect(isPrivateAddress("2a00:1450:4001:80b::2003")).toBe(false);
    expect(isPrivateAddress("::ffff:8.8.8.8")).toBe(false);
  });
});

describe("checkImportUrl", () => {
  it("nimmt normale Rezeptseiten an und entfernt den Anker", () => {
    const r = checkImportUrl(" https://www.chefkoch.de/rezepte/123/dal.html#kommentare ");
    expect(r.ok && r.url.toString()).toBe("https://www.chefkoch.de/rezepte/123/dal.html");
  });

  it("lehnt lokale, interne und seltsame Adressen ab", () => {
    for (const input of [
      "ftp://example.com/x",
      "javascript:alert(1)",
      "http://localhost:3000/",
      "http://127.0.0.1/",
      "http://2130706433/", // = 127.0.0.1
      "http://0x7f000001/",
      "http://[::1]/",
      "http://192.168.178.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://fritz.box.local/",
      "http://intranet/",
      "https://user:pw@example.com/",
      "https://example.com:8080/",
      "kein link",
    ]) {
      expect(checkImportUrl(input).ok, input).toBe(false);
    }
  });
});
