import { describe, expect, it } from "vitest";
import { parseAuthHash, targetForLinkType } from "./auth-hash";

describe("parseAuthHash", () => {
  it("liest Tokens aus einem Einladungslink", () => {
    expect(parseAuthHash("#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=invite")).toEqual({
      kind: "session",
      accessToken: "abc",
      refreshToken: "def",
      type: "invite",
    });
  });

  it("erkennt abgelaufene Links", () => {
    expect(parseAuthHash("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid")).toEqual({
      kind: "error",
      code: "otp_expired",
    });
  });

  it("ignoriert normale Anker und unvollständige Tokens", () => {
    expect(parseAuthHash("")).toEqual({ kind: "none" });
    expect(parseAuthHash("#zutaten")).toEqual({ kind: "none" });
    expect(parseAuthHash("#access_token=abc")).toEqual({ kind: "none" });
  });
});

describe("targetForLinkType", () => {
  it("führt je nach Link-Art zur passenden Seite", () => {
    expect(targetForLinkType("invite")).toBe("/passwort-setzen?neu=1");
    expect(targetForLinkType("recovery")).toBe("/passwort-setzen");
    expect(targetForLinkType("signup")).toBe("/rezepte");
    expect(targetForLinkType(null)).toBe("/rezepte");
  });
});
