"use client";

import { useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { getInitialHash } from "@/components/auth-hash-handler";
import { AuthCard } from "@/components/layout/auth-card";
import { parseAuthHash } from "@/lib/auth-hash";

const subscribe = () => () => {};

/**
 * Ohne token_hash in der URL kommt der Link aus einer Standard-Mail: Die Tokens
 * stehen dann im Fragment und der AuthHashHandler löst sie ein. Hier nur die
 * passende Anzeige dazu. Server-Snapshot "pending", damit nichts falsch aufblitzt.
 */
export function ConfirmFallback() {
  const state = useSyncExternalStore(
    subscribe,
    () => parseAuthHash(getInitialHash()).kind,
    () => "pending" as const,
  );

  if (state === "pending" || state === "session") {
    return (
      <AuthCard title="Einen Moment …" description="Dein Link wird geprüft.">
        <Loader2 className="mx-auto size-6 animate-spin text-primary" aria-label="Wird geladen" />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Link nicht nutzbar"
      description="Dieser Link ist unvollständig, abgelaufen oder wurde schon benutzt. Lass dir eine neue Einladung schicken oder setze dein Passwort erneut zurück."
    >
      <a href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Zur Anmeldung
      </a>
    </AuthCard>
  );
}
