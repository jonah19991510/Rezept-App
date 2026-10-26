/**
 * Die Standard-Mailvorlagen von Supabase leiten nach dem Klick mit den
 * Session-Tokens im URL-Fragment zurück (…#access_token=…&refresh_token=…&type=invite)
 * oder mit einer Fehlermeldung (…#error=access_denied&error_code=otp_expired).
 * Das Fragment sieht nur der Browser, nie der Server.
 */
export type AuthHashResult =
  | { kind: "session"; accessToken: string; refreshToken: string; type: string | null }
  | { kind: "error"; code: string | null }
  | { kind: "none" };

export function parseAuthHash(hash: string): AuthHashResult {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

  if (params.has("error") || params.has("error_code")) {
    return { kind: "error", code: params.get("error_code") ?? params.get("error") };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    return { kind: "session", accessToken, refreshToken, type: params.get("type") };
  }

  return { kind: "none" };
}

/** Wohin es nach dem Einlösen des Links geht. */
export function targetForLinkType(type: string | null): string {
  switch (type) {
    case "invite":
      return "/passwort-setzen?neu=1";
    case "recovery":
      return "/passwort-setzen";
    case "email_change":
      return "/einstellungen";
    default:
      return "/";
  }
}

export function linkErrorMessage(code: string | null): string {
  if (code === "otp_expired") {
    return "Der Link ist abgelaufen oder wurde schon benutzt. Lass dir eine neue Einladung schicken oder setze dein Passwort erneut zurück.";
  }
  return "Der Link funktioniert leider nicht. Bitte fordere einen neuen an.";
}
