import type { Metadata } from "next";
import { Brand } from "@/components/layout/brand";
import { AuthCard } from "@/components/layout/auth-card";
import { confirmSchema } from "@/lib/validation/auth";
import { ConfirmFallback } from "./confirm-fallback";
import { ConfirmForm } from "./confirm-form";

export const metadata: Metadata = { title: "Bestätigen" };

const COPY = {
  invite: { title: "Einladung annehmen", button: "Einladung annehmen" },
  recovery: { title: "Passwort zurücksetzen", button: "Weiter zum neuen Passwort" },
  signup: { title: "E-Mail bestätigen", button: "E-Mail bestätigen" },
  email: { title: "E-Mail bestätigen", button: "E-Mail bestätigen" },
  email_change: { title: "Neue E-Mail bestätigen", button: "Neue E-Mail bestätigen" },
  magiclink: { title: "Anmelden", button: "Anmelden" },
} as const;

/**
 * Ziel der Links aus Einladungs-, Passwort- und Bestätigungsmails.
 * Der Token wird erst nach einem Klick eingelöst, damit Link-Scanner in
 * Mailprogrammen ihn nicht vorab verbrauchen.
 */
export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const params = await searchParams;
  const parsed = confirmSchema.safeParse({ token_hash: params.token_hash, type: params.type });

  return (
    <div className="flex min-h-dvh flex-col px-4">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 py-10">
        <Brand href="/login" className="self-center" />
        {parsed.success ? (
          <AuthCard title={COPY[parsed.data.type].title} description="Tippe auf den Knopf, um fortzufahren.">
            <ConfirmForm
              tokenHash={parsed.data.token_hash}
              type={parsed.data.type}
              buttonLabel={COPY[parsed.data.type].button}
            />
          </AuthCard>
        ) : (
          <ConfirmFallback />
        )}
      </main>
    </div>
  );
}
