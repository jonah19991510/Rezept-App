import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader title="Einstellungen" />
      <section className="mb-6 rounded-3xl border bg-card p-5">
        <h2 className="mb-3 text-lg font-semibold">Profil</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Anzeigename</dt>
          <dd className="font-medium">{user.displayName}</dd>
          <dt className="text-muted-foreground">E-Mail</dt>
          <dd className="font-medium break-all">{user.email ?? "–"}</dd>
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">Deine E-Mail-Adresse siehst nur du.</p>
      </section>
      <EmptyState icon={Settings} title="Weitere Einstellungen folgen">
        Anzeigename und Passwort ändern, Tagesziele, Daten herunterladen und Account löschen kommen hier hin.
      </EmptyState>
    </>
  );
}
