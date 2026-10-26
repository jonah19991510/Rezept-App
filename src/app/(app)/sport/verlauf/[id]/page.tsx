import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, PartyPopper } from "lucide-react";
import { ApplyToPlan, DeleteWorkout } from "@/components/sport/workout-actions";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { MUSCLE_LABELS } from "@/lib/domain/exercises";
import { differsFromPlan, formatSet, planDayFromWorkout, resolveSet, summarizeSession, workoutDuration } from "@/lib/domain/workout";
import { formatDayShort, formatNumber } from "@/lib/format";
import { getTrainingPlan } from "@/lib/server/sport";
import { getWorkoutSession } from "@/lib/server/workouts";
import { cn } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

export const metadata: Metadata = { title: "Training" };

/** Ein Training mit allen Sätzen; direkt nach dem Abschluss (?fertig=1) mit Zusammenfassung und „in den Plan übernehmen“. */
export default async function WorkoutPage({ params, searchParams }: PageProps<"/sport/verlauf/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const session = await getWorkoutSession(id, user.id);
  if (!session) notFound();
  const justFinished = query.fertig === "1" && session.endedAt != null;
  const summary = summarizeSession(session, new Date());

  // Weicht das Training vom Plan-Tag ab? Dann „übernehmen“ anbieten (nur eigene Pläne)
  let applyDay: string | null = null;
  if (session.endedAt && session.planId && session.planDayId) {
    const plan = await getTrainingPlan(session.planId, user.id);
    const day = plan?.isOwn ? plan.days.find((d) => d.id === session.planDayId) : undefined;
    if (day) {
      const current = day.exercises.map((e) => ({
        exerciseId: e.exercise.id,
        sets: e.sets,
        repsMin: e.repsMin,
        repsMax: e.repsMax,
        targetSeconds: e.targetSeconds,
        restSeconds: e.restSeconds,
        warmup: e.warmup,
        note: e.note,
      }));
      const next = planDayFromWorkout(
        current,
        session.exercises.map((e) => ({
          exerciseId: e.exercise.id,
          normalSets: e.sets.filter((s) => s.kind === "normal").length,
          repsMin: e.repsMin,
          repsMax: e.repsMax,
          targetSeconds: e.targetSeconds,
          restSeconds: e.restSeconds,
          warmup: e.warmup,
          note: e.note || null,
        })),
      );
      if (differsFromPlan(current, next)) applyDay = day.name;
    }
  }

  return (
    <article className="space-y-6">
      <div>
        <Link href="/sport/verlauf" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden />
          Verlauf
        </Link>
        {justFinished ? (
          <p className="mb-1 flex items-center gap-2 font-medium text-sport">
            <PartyPopper className="size-5" aria-hidden />
            Training gespeichert. Stark!
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold wrap-anywhere md:text-4xl">{session.title}</h1>
        <p className="text-muted-foreground">
          {formatDayShort(session.startedAt)}, {time.format(new Date(session.startedAt))}
          {session.endedAt ? `–${time.format(new Date(session.endedAt))} Uhr` : " Uhr · läuft"}
        </p>
      </div>

      {session.endedAt ? null : (
        <Link href={`/training/${session.id}`} className={cn(buttonVariants(), "h-12 rounded-full px-6 text-base")}>
          Training fortsetzen
        </Link>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Dauer", value: workoutDuration(summary.durationSeconds) },
          { label: "Übungen", value: String(summary.exercises) },
          { label: "Sätze", value: String(summary.sets) },
          { label: "Volumen", value: `${formatNumber(Math.round(summary.volumeKg), 0)} kg` },
        ].map((s) => (
          <div key={s.label} className="rounded-3xl border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{s.label}</dt>
            <dd className="font-heading text-2xl font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      {applyDay ? (
        <section className="space-y-3 rounded-3xl border border-sport/40 bg-sport-soft/60 p-4 md:p-5" aria-labelledby="plan-uebernehmen">
          <h2 id="plan-uebernehmen" className="text-xl font-semibold">
            Änderungen in den Plan übernehmen?
          </h2>
          <p className="text-sm text-muted-foreground">
            Du hast andere Übungen, eine andere Reihenfolge oder eine andere Satzzahl trainiert als im Plan. Übernehmen ändert
            „{applyDay}“ entsprechend; Wiederholungen, Pausen und Notizen bleiben.
          </p>
          <ApplyToPlan workoutId={session.id} dayName={applyDay} />
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {session.exercises.map((e) => {
          let n = 0;
          return (
            <section key={e.id} className="rounded-3xl border bg-card" aria-label={e.exercise.name}>
              <header className="border-b px-4 py-3 md:px-5">
                <h2 className="font-sans text-lg font-semibold tracking-normal wrap-anywhere">{e.exercise.name}</h2>
                <p className="text-sm text-muted-foreground">{MUSCLE_LABELS[e.exercise.muscleGroup]}</p>
              </header>
              <ol className="divide-y">
                {e.sets.map((s) => {
                  const label = s.kind === "warmup" ? "A" : String(++n);
                  return (
                    <li key={s.id} className={cn("flex items-center gap-3 px-4 py-2 md:px-5", !s.done && "opacity-50")}>
                      <span className={cn("w-6 text-center text-sm font-semibold tabular-nums", s.kind === "warmup" ? "text-primary" : "text-muted-foreground")}>{label}</span>
                      <span className="font-medium tabular-nums">{formatSet(resolveSet(s, null), e.exercise.tracking)}</span>
                      {s.kind === "warmup" ? <span className="text-xs text-muted-foreground">Aufwärmen</span> : null}
                    </li>
                  );
                })}
              </ol>
              {e.note ? <p className="border-t px-4 py-2 text-sm text-muted-foreground md:px-5">{e.note}</p> : null}
            </section>
          );
        })}
      </div>

      {session.note ? (
        <section className="rounded-3xl border bg-card p-4 md:p-5">
          <h2 className="mb-1 font-sans text-sm font-semibold tracking-normal text-muted-foreground">Notiz</h2>
          <p className="whitespace-pre-line">{session.note}</p>
        </section>
      ) : null}

      <DeleteWorkout workoutId={session.id} />
    </article>
  );
}
