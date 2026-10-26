import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WorkoutView } from "@/components/sport/workout/workout-view";
import { requireUser } from "@/lib/auth";
import { getExercises } from "@/lib/server/sport";
import { getLastSets, getWorkoutSession } from "@/lib/server/workouts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Training" };

/** Training im Gym als eigene Seite ohne Navigation (wie der Kochmodus), damit Zurück und Neuladen funktionieren. */
export default async function TrainingPage({ params }: PageProps<"/training/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const session = await getWorkoutSession(id, user.id);
  if (!session) notFound();
  if (session.endedAt) redirect(`/sport/verlauf/${id}`);

  const [exercises, last] = await Promise.all([
    getExercises(user.id),
    getLastSets([...new Set(session.exercises.map((e) => e.exercise.id))], id),
  ]);
  return <WorkoutView initial={session} exercises={exercises} last={last} />;
}
