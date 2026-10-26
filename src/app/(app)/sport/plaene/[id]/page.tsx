import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Flame, Pencil } from "lucide-react";
import { PlanMenu } from "@/components/sport/plan-menu";
import { ActiveWorkoutBanner } from "@/components/sport/active-workout-banner";
import { StartTraining } from "@/components/sport/start-training";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/domain/exercises";
import { planSummary, restLabel, targetLabel, totalSets } from "@/lib/domain/training-plan";
import { getTrainingPlan } from "@/lib/server/sport";
import { getActiveWorkout, getLastPlanDayId } from "@/lib/server/workouts";
import { nextPlanDay } from "@/lib/domain/workout";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/sport/plaene/[id]">): Promise<Metadata> {
  const user = await requireUser();
  const plan = await getTrainingPlan((await params).id, user.id);
  return { title: plan?.title ?? "Trainingsplan" };
}

export default async function PlanPage({ params }: PageProps<"/sport/plaene/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const plan = await getTrainingPlan(id, user.id);
  // Fremde öffentliche Pläne kommen mit „Entdecken“ (Phase S4)
  if (!plan || !plan.isOwn) notFound();
  const [lastDayId, active] = await Promise.all([getLastPlanDayId(user.id, plan.id), getActiveWorkout(user.id)]);
  const nextDay = nextPlanDay(plan.days, lastDayId);

  return (
    <article className="space-y-6">
      <div>
        <Link href="/sport/plaene" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden />
          Pläne
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-3xl font-semibold wrap-anywhere md:text-4xl">{plan.title}</h1>
            <p className="text-muted-foreground">
              {planSummary(plan.days)}
              {plan.isArchived ? " · ausgeblendet" : ""}
            </p>
          </div>
          <PlanMenu planId={plan.id} title={plan.title} archived={plan.isArchived} />
        </div>
        {plan.description ? <p className="mt-3 whitespace-pre-line">{plan.description}</p> : null}
      </div>

      {active ? <ActiveWorkoutBanner workout={active} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <StartTraining
          planId={plan.id}
          days={plan.days.map((d) => ({ id: d.id, name: d.name, focus: d.focus, exerciseCount: d.exercises.length }))}
          nextDayId={nextDay?.id ?? null}
        />
        <Link href={`/sport/plaene/${plan.id}/bearbeiten`} className={cn(buttonVariants({ variant: "outline" }), "h-12 rounded-full px-5")}>
          <Pencil aria-hidden />
          Bearbeiten
        </Link>
        {nextDay ? (
          <p className="basis-full text-sm text-muted-foreground">
            Als Nächstes: {nextDay.name}
            {nextDay.focus ? ` · ${nextDay.focus}` : ""}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {plan.days.map((day) => (
          <section key={day.id} className="rounded-3xl border bg-card" aria-labelledby={`tag-${day.id}`}>
            <header className="flex items-baseline justify-between gap-3 border-b px-4 py-3 md:px-5">
              <h2 id={`tag-${day.id}`} className="min-w-0 text-xl font-semibold wrap-anywhere">
                {day.name}
                {day.focus ? <span className="font-sans text-base font-normal text-muted-foreground"> · {day.focus}</span> : null}
              </h2>
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{totalSets(day.exercises)} Sätze</span>
            </header>
            {day.exercises.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground md:px-5">Noch keine Übungen.</p>
            ) : (
              <ol className="divide-y">
                {day.exercises.map((e, i) => {
                  const rest = restLabel(e.restSeconds);
                  return (
                    <li key={e.id} className="flex gap-3 px-4 py-3 md:px-5">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sport-soft text-sm font-semibold text-sport tabular-nums">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="min-w-0 font-medium wrap-anywhere">{e.exercise.name}</p>
                          <p className="shrink-0 font-semibold tabular-nums">{targetLabel({ ...e, tracking: e.exercise.tracking })}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {MUSCLE_LABELS[e.exercise.muscleGroup]} · {EQUIPMENT_LABELS[e.exercise.equipment]}
                          {rest ? ` · ${rest}` : ""}
                        </p>
                        {e.warmup ? (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Flame className="size-3.5 text-primary" aria-hidden />
                            mit Aufwärmsätzen
                          </p>
                        ) : null}
                        {e.note ? <p className="mt-1 text-sm whitespace-pre-line">{e.note}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
