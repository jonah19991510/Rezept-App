import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ActiveWorkoutBanner } from "@/components/sport/active-workout-banner";
import { LogPastWorkout } from "@/components/sport/log-past-workout";
import { SportTabs } from "@/components/sport/sport-tabs";
import { requireUser } from "@/lib/auth";
import { workoutDuration } from "@/lib/domain/workout";
import { formatDayShort, formatNumber } from "@/lib/format";
import { getTrainingPlans } from "@/lib/server/sport";
import { getActiveWorkout, getWorkoutHistory, type WorkoutListItem } from "@/lib/server/workouts";

export const metadata: Metadata = { title: "Verlauf" };

const month = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "Europe/Berlin" });

function duration(w: WorkoutListItem) {
  return w.endedAt ? workoutDuration(Math.round((new Date(w.endedAt).getTime() - new Date(w.startedAt).getTime()) / 1000)) : "läuft";
}

/** Alle Trainings, neueste zuerst, nach Monat gruppiert. */
export default async function HistoryPage() {
  const user = await requireUser();
  const [list, active, plans] = await Promise.all([getWorkoutHistory(user.id), getActiveWorkout(user.id), getTrainingPlans(user.id)]);
  // Für „Nachtragen“: aktive Pläne zuerst, nur Name und Tage
  const planOptions = [...plans]
    .sort((a, b) => Number(a.isArchived) - Number(b.isArchived))
    .map((p) => ({ id: p.id, title: p.isArchived ? `${p.title} (ausgeblendet)` : p.title, days: p.days.map((d) => ({ id: d.id, name: d.name })) }));
  const finished = list.filter((w) => w.endedAt);
  const groups = new Map<string, WorkoutListItem[]>();
  for (const w of finished) {
    const key = month.format(new Date(w.startedAt));
    groups.set(key, [...(groups.get(key) ?? []), w]);
  }

  return (
    <>
      {/* Knopf (44px) darf die Titelzeile (36px, md 40px) nicht höher machen, sonst springt „Training“ beim Tab-Wechsel */}
      <PageHeader
        title="Training"
        actions={
          <div className="-my-1 md:-my-0.5">
            <LogPastWorkout plans={planOptions} />
          </div>
        }
      />
      <SportTabs active="verlauf" />
      {active ? <ActiveWorkoutBanner workout={active} /> : null}
      {finished.length === 0 ? (
        <EmptyState icon={History} title="Noch kein Training">
          Starte ein Training über einen deiner Pläne oder trag ein vergangenes nach. Danach findest du es hier mit allen Sätzen.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {[...groups].map(([label, items]) => (
            <section key={label} aria-label={label}>
              <h2 className="mb-2 flex min-h-11 items-center justify-between px-1 font-sans text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                <span>{label}</span>
                <span className="font-medium tabular-nums normal-case">{items.length === 1 ? "1 Training" : `${items.length} Trainings`}</span>
              </h2>
              <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
                {items.map((w) => (
                  <li key={w.id}>
                    <Link href={`/sport/verlauf/${w.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition hover:bg-muted/40">
                      <span className="w-16 shrink-0 text-sm font-medium text-muted-foreground">{formatDayShort(w.startedAt)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{w.title}</span>
                        <span className="block truncate text-sm text-muted-foreground tabular-nums">
                          {duration(w)} · {w.sets === 1 ? "1 Satz" : `${w.sets} Sätze`}
                          {w.volumeKg > 0 ? ` · ${formatNumber(Math.round(w.volumeKg), 0)} kg` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
