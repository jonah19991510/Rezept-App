"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { linkErrorMessage, parseAuthHash, targetForLinkType } from "@/lib/auth-hash";
import { createClient } from "@/lib/supabase/client";

// Beim Laden der Seite festhalten, bevor der Handler das Fragment aus der Adresszeile entfernt
const initialHash = typeof window === "undefined" ? "" : window.location.hash;

/** Das URL-Fragment, mit dem die Seite geöffnet wurde. */
export function getInitialHash() {
  return initialHash;
}

/**
 * Verarbeitet Links aus den Standard-Mails von Supabase (Einladung, Passwort
 * zurücksetzen, E-Mail bestätigen), egal auf welcher Seite sie landen: Tokens
 * aus dem URL-Fragment lesen, sofort aus der Adresszeile entfernen, Session
 * setzen und zur passenden Seite weiterleiten.
 */
export function AuthHashHandler() {
  useEffect(() => {
    const result = parseAuthHash(window.location.hash);
    if (result.kind === "none") return;

    // Tokens nicht in der Adresszeile oder im Verlauf stehen lassen
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    if (result.kind === "error") {
      toast.error(linkErrorMessage(result.code), { duration: 10000 });
      return;
    }

    const supabase = createClient();
    supabase.auth
      .setSession({ access_token: result.accessToken, refresh_token: result.refreshToken })
      .then(({ error }) => {
        if (error) {
          // Zur Anmeldung; dort zeigt dieser Handler die Fehlermeldung an
          window.location.replace("/login#error_code=invalid_link");
          return;
        }
        // Volle Navigation, damit der Server die neuen Session-Cookies sieht
        window.location.assign(targetForLinkType(result.type));
      });
  }, []);

  return null;
}
