import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AreaTheme } from "@/components/layout/area-theme";
import { IntervalTimer } from "@/components/sport/interval/interval-timer";
import { requireUser } from "@/lib/auth";
import { isTimed } from "@/lib/domain/exercises";
import { nextPlanDay } from "@/lib/domain/workout";
import { getTrainingPlan } from "@/lib/server/sport";
import { getLastPlanDayId } from "@/lib/server/workouts";

export const metadata: Metadata = { title: "Intervall-Timer" };

/** Intervall-Timer zu einem Trainingsplan, als eigene Seite ohne Navigation (wie das Training), `id` = Plan. */
export default async function IntervalTimerPage({ params }: PageProps<"/training/intervall/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser();
  const plan = await getTrainingPlan(id, user.id);
  if (!plan) notFound();
  const lastDayId = await getLastPlanDayId(user.id, plan.id);
  const days = plan.days.map((d) => ({
    id: d.id,
    name: d.name,
    focus: d.focus,
    exercises: d.exercises.map((e) => ({ name: e.exercise.name, seconds: isTimed(e.exercise.tracking) ? e.targetSeconds : null })),
  }));
  return (
    <AreaTheme>
      <IntervalTimer planId={plan.id} planTitle={plan.title} days={days} nextDayId={nextPlanDay(plan.days, lastDayId)?.id ?? null} />
    </AreaTheme>
  );
}
