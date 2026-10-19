import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth";
import { getDefaultGoals } from "@/lib/server/plan";
import { DataSection, DeleteAccount, DisplayNameForm, PasswordForm } from "./account-forms";
import { GoalsForm } from "./goals-form";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const user = await requireUser();
  const goals = await getDefaultGoals(user.id);

  return (
    <>
      <PageHeader title="Einstellungen" />
      <section className="mb-6 rounded-3xl border bg-card p-5" aria-labelledby="sec-profil">
        <h2 id="sec-profil" className="mb-3 text-lg font-semibold">
          Profil
        </h2>
        <div className="grid gap-5">
          <DisplayNameForm current={user.displayName} />
          <p className="text-sm">
            <span className="text-muted-foreground">E-Mail:</span>{" "}
            <span className="font-medium break-all">{user.email ?? "–"}</span>
            <span className="block text-muted-foreground">Deine E-Mail-Adresse siehst nur du.</span>
          </p>
        </div>
      </section>

      <section className="mb-6 rounded-3xl border bg-card p-5" aria-labelledby="sec-passwort">
        <h2 id="sec-passwort" className="mb-3 text-lg font-semibold">
          Passwort ändern
        </h2>
        <PasswordForm />
      </section>

      <section id="ziele" className="mb-6 scroll-mt-20 rounded-3xl border bg-card p-5" aria-labelledby="sec-ziele">
        <h2 id="sec-ziele" className="mb-1 text-lg font-semibold">
          Tagesziele
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Der Wochenplan zeigt dir pro Tag, wie nah du diesen Zielen kommst. Felder, die du leer lässt, werden nicht
          ausgewertet.
        </p>
        <GoalsForm initial={goals} />
      </section>

      <section className="mb-6 rounded-3xl border bg-card p-5" aria-labelledby="sec-daten">
        <h2 id="sec-daten" className="mb-1 text-lg font-semibold">
          Deine Daten
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">Als JSON-Datei herunterladen oder eine Rezept-Sicherung einspielen.</p>
        <DataSection />
      </section>

      <section className="mb-6 rounded-3xl border border-destructive/30 bg-card p-5" aria-labelledby="sec-loeschen">
        <h2 id="sec-loeschen" className="mb-1 text-lg font-semibold">
          Account löschen
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Löscht deinen Zugang und alle deine Daten endgültig. Das lässt sich nicht rückgängig machen.
        </p>
        <DeleteAccount displayName={user.displayName} />
      </section>

      <p className="text-sm text-muted-foreground">Trainingstage und weitere Einstellungen kommen in späteren Phasen dazu.</p>
    </>
  );
}
