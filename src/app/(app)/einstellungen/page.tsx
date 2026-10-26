import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AreaTile } from "@/components/layout/area-tile";
import { AREA_PARAM, AREAS, areaForPath } from "@/components/layout/nav-items";
import { requireUser } from "@/lib/auth";
import { getCategoryCounts, getCategoryRows } from "@/lib/server/categories";
import { getLongNotCookedWeeks } from "@/lib/server/kitchen-log";
import { getAllGoals, getTrainingWeekdays } from "@/lib/server/plan";
import { DataSection, DeleteAccount, DisplayNameForm, PasswordForm } from "./account-forms";
import { CategoriesForm } from "./categories-form";
import { GoalsForm } from "./goals-form";
import { LongNotCookedForm } from "./long-not-cooked-form";
import { SportDataSection } from "./sport-data-section";
import { TrainingDaysForm } from "./training-days-form";

export const metadata: Metadata = { title: "Einstellungen" };

/**
 * Einstellungen: Profil, Passwort und Account gelten für alles; dazwischen die Einstellungen des Bereichs, aus dem man
 * kommt (`?bereich=sport` Sport & Gesundheit, `?bereich=start` von der Startseite: beide Bereiche zusammen, sonst
 * Essen & Trinken).
 */
export default async function SettingsPage({ searchParams }: PageProps<"/einstellungen">) {
  const user = await requireUser();
  const param = (await searchParams)[AREA_PARAM];
  const area = areaForPath("/einstellungen", typeof param === "string" ? param : null);

  if (area === "sport") {
    return (
      <>
        <PageHeader title="Einstellungen" description="Sport & Gesundheit" />
        <AccountSections user={user} />
        <SportSettings showAllData />
        <DeleteSection user={user} />
      </>
    );
  }
  if (area === "start") {
    return (
      <>
        <PageHeader title="Einstellungen" description="Alle Bereiche" />
        <AccountSections user={user} />
        <AreaHeading area="food" />
        <FoodSettings userId={user.id} />
        <AreaHeading area="sport" />
        <SportSettings showAllData={false} />
        <DeleteSection user={user} />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Einstellungen" description="Essen & Trinken" />
      <AccountSections user={user} />
      <FoodSettings userId={user.id} />
      <DeleteSection user={user} />
    </>
  );
}

/** Zwischenüberschrift mit Bereichs-Kachel (Einstellungen von der Startseite). */
function AreaHeading({ area }: { area: "food" | "sport" }) {
  const a = AREAS.find((x) => x.key === area)!;
  return (
    <h2 className="mt-10 mb-4 flex items-center gap-3 text-2xl font-semibold">
      <AreaTile area={a} size="sm" />
      {a.label}
    </h2>
  );
}

/** Einstellungen von Essen & Trinken. */
async function FoodSettings({ userId }: { userId: string }) {
  const [goals, trainingWeekdays, longWeeks, categories, categoryCounts] = await Promise.all([
    getAllGoals(userId),
    getTrainingWeekdays(userId),
    getLongNotCookedWeeks(userId),
    getCategoryRows(userId),
    getCategoryCounts(userId),
  ]);

  return (
    <>
      <section id="ziele" className="mb-6 scroll-mt-20 rounded-3xl border bg-card p-5" aria-labelledby="sec-ziele">
        <h2 id="sec-ziele" className="mb-1 text-lg font-semibold">
          Tagesziele
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Der Wochenplan zeigt dir pro Tag, wie nah du diesen Zielen kommst. Felder, die du leer lässt, werden nicht
          ausgewertet.
        </p>
        <GoalsForm initial={goals.default} />
      </section>

      <section id="training" className="mb-6 scroll-mt-20 rounded-3xl border bg-card p-5" aria-labelledby="sec-training">
        <h2 id="sec-training" className="mb-1 text-lg font-semibold">
          Trainingstage
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          An diesen Wochentagen nutzt der Wochenplan das Ziel für Trainingstage. Im Plan kannst du jeden Tag mit der
          Hantel einzeln umschalten.
        </p>
        <TrainingDaysForm initial={trainingWeekdays} />
        <h3 className="mt-6 mb-1 font-semibold">Ziel an Trainingstagen</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Zum Beispiel mehr Protein und kcal. Leere Felder übernehmen das normale Tagesziel.
        </p>
        <GoalsForm initial={goals.training} goalType="training" />
      </section>

      <section id="kategorien" className="mb-6 scroll-mt-20 rounded-3xl border bg-card p-5" aria-labelledby="sec-kategorien">
        <h2 id="sec-kategorien" className="mb-1 text-lg font-semibold">
          Kategorien
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Deine Kategorien für Rezepte (Küche), z. B. für den Filter auf der Startseite. Umbenennen ändert sie auch in
          deinen Rezepten; beim Löschen wählst du, wohin die Rezepte wandern.
        </p>
        <CategoriesForm
          items={categories.map((c) => ({ id: c.id, name: c.name, count: categoryCounts.get(c.name.toLocaleLowerCase("de-DE")) ?? 0 }))}
        />
      </section>

      <section className="mb-6 rounded-3xl border bg-card p-5" aria-labelledby="sec-lange">
        <h2 id="sec-lange" className="mb-1 text-lg font-semibold">
          Lange nicht gekocht
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Der Wochenplan schlägt gut bewertete Rezepte (ab 4 Sternen) vor, die du so lange nicht mehr gekocht hast.
        </p>
        <LongNotCookedForm initial={longWeeks} />
      </section>

      <section id="daten" className="mb-6 scroll-mt-20 rounded-3xl border bg-card p-5" aria-labelledby="sec-daten">
        <h2 id="sec-daten" className="mb-1 text-lg font-semibold">
          Deine Daten
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Rezepte von Webseiten oder aus Markdown/Notion importieren, alles als Datei herunterladen oder eine
          Rezept-Sicherung einspielen.
        </p>
        <DataSection />
      </section>
    </>
  );
}

type User = Awaited<ReturnType<typeof requireUser>>;

function AccountSections({ user }: { user: User }) {
  return (
    <>
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
    </>
  );
}

function DeleteSection({ user }: { user: User }) {
  return (
    <section className="mb-6 rounded-3xl border border-destructive/30 bg-card p-5" aria-labelledby="sec-loeschen">
      <h2 id="sec-loeschen" className="mb-1 text-lg font-semibold">
        Account löschen
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Löscht deinen Zugang und alle deine Daten endgültig. Das lässt sich nicht rückgängig machen.
      </p>
      <DeleteAccount displayName={user.displayName} />
    </section>
  );
}

/** Einstellungen von Sport & Gesundheit. showAllData: „Meine Daten herunterladen“ (fehlt, wenn Essen & Trinken ihn zeigt). */
function SportSettings({ showAllData }: { showAllData: boolean }) {
  return (
    <section id="trainingsdaten" className="mb-6 scroll-mt-20 rounded-3xl border bg-card p-5" aria-labelledby="sec-sport-daten">
      <h2 id="sec-sport-daten" className="mb-1 text-lg font-semibold">
        Trainingsdaten
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Deine Trainingspläne und eigenen Übungen als Datei sichern oder eine Sicherung einspielen.
      </p>
      <SportDataSection showAllData={showAllData} />
    </section>
  );
}
