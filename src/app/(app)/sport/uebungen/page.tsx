import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ExerciseLibrary } from "@/components/sport/exercise-library";
import { requireUser } from "@/lib/auth";
import { getExerciseLibrary } from "@/lib/server/sport";

export const metadata: Metadata = { title: "Übungen" };

/** Profilmenü (Sport) → Übungen: die ganze Übungsdatenbank; eigene (als Admin auch der Grundbestand) bearbeitbar. */
export default async function ExercisesPage() {
  const user = await requireUser();
  const exercises = await getExerciseLibrary(user.id);
  const own = exercises.filter((e) => e.origin === "own").length;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Übungen" description={`${exercises.length} Übungen${own ? `, davon ${own} eigene` : ""}`} />
      <ExerciseLibrary exercises={exercises} isAdmin={user.role === "admin"} />
    </div>
  );
}
