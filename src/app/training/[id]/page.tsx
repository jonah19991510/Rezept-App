import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AreaTheme } from "@/components/layout/area-theme";
import { WorkoutView } from "@/components/sport/workout/workout-view";
import { requireUser } from "@/lib/auth";
import { getExercises } from "@/lib/server/sport";
import { getLastSets, getWorkoutSession } from "@/lib/server/workouts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Training" };

/**
 * Training im Gym als eigene Seite ohne Navigation (wie der Kochmodus), damit Zurück und Neuladen funktionieren.
 * Beendete Trainings öffnen mit ?bearbeiten=1 die Bearbeiten-Ansicht (auch fürs Nachtragen).
 */
export default async function TrainingPage({ params, searchParams }: PageProps<"/training/[id]">) {
  const { id } = await params;
  const edit = (await searchParams).bearbeiten === "1";
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const session = await getWorkoutSession(id, user.id);
  if (!session) notFound();
  if (session.endedAt && !edit) redirect(`/sport/verlauf/${id}`);
  if (!session.endedAt && edit) redirect(`/training/${id}`);

  const [exercises, last] = await Promise.all([
    getExercises(user.id),
    getLastSets([...new Set(session.exercises.map((e) => e.exercise.id))], id),
  ]);
  // Sport-Akzent (Petrol) wie im übrigen Sport-Bereich
  return (
    <AreaTheme>
      <WorkoutView initial={session} exercises={exercises} last={last} mode={edit ? "edit" : "live"} />
    </AreaTheme>
  );
}
