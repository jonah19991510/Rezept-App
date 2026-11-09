"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, NotebookPen, Plus } from "lucide-react";
import { GroupHeading } from "@/components/layout/list-blocks";
import { Button } from "@/components/ui/button";
import { longDate } from "@/lib/domain/drinks";
import {
  categoryOf,
  countOn,
  daySummary,
  formatDuration,
  nextCount,
  periodProgress,
  ROUTINES,
  slotLabel,
  todayGroups,
  type Habit,
  type HabitCheck,
  type ScheduleEntry,
} from "@/lib/domain/habits";
import { addDays } from "@/lib/domain/week";
import { cn } from "@/lib/utils";
import { CheckButton, HabitIcon } from "./habit-parts";
import { HabitSheet, type HabitDraft } from "./habit-sheet";
import { ROUTINE_STYLE, RoutineCard } from "./routine-card";
import { useHabitCounts } from "./use-habit-counts";

/**
 * Tab „Heute“: Fortschritt des Tages, geplantes Training aus dem Wochenplan, fällige Gewohnheiten und Supplemente
 * nach Tageszeit (dann „Diese Woche“, „Diesen Monat“), Morgen- und Abendroutine als eigene Karten (Reihenfolge per
 * Drag & Drop, einzeln oder alle auf einmal abhaken), dazu die eigenen Challenges. Antippen des Kreises hakt ab, antippen des Namens bearbeitet.
 * Mit den Pfeilen lassen sich frühere Tage nachtragen.
 */
export function HabitToday({
  habits,
  checks,
  schedule,
  date,
  today,
  challenges,
}: {
  habits: Habit[];
  checks: HabitCheck[];
  /** Einheiten aus dem Wochenplan für den Wochentag von `date` */
  schedule: ScheduleEntry[];
  date: string;
  today: string;
  /** eigene Challenges des Tages (Server-Komponente) */
  challenges?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Habit | HabitDraft | null>(null);
  const { index, setCount } = useHabitCounts(checks);
  const groups = todayGroups(habits, date);
  const summary = daySummary(habits, index, date);
  const active = habits.filter((h) => h.pausedOn == null);
  const isToday = date === today;
  // Routinen ohne Punkte: Knopf zum Anlegen des ersten Punkts
  const missingRoutines = ROUTINES.filter((r) => !active.some((h) => h.routine === r.key));

  function go(next: string) {
    startTransition(() => router.push(next === today ? pathname : `${pathname}?datum=${next}`, { scroll: false }));
  }

  function tap(h: Habit) {
    const current = countOn(index, h.id, date);
    const next = nextCount(current, h.target, h.frequency);
    if (next >= h.target && current < h.target) navigator.vibrate?.(12);
    setCount(h.id, date, next, current);
  }

  function setTo(h: Habit, next: number) {
    setCount(h.id, date, next, countOn(index, h.id, date));
  }

  const dayTitle = isToday ? "Heute" : date === addDays(today, -1) ? "Gestern" : longDate(date);

  return (
    <div className={cn("space-y-6 transition-opacity", pending && "opacity-60")}>
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="icon" onClick={() => go(addDays(date, -1))} aria-label="Tag davor">
          <ChevronLeft aria-hidden />
        </Button>
        <div className="min-w-0 text-center">
          <p className="font-heading text-xl font-semibold">{dayTitle}</p>
          <p className="text-sm text-muted-foreground">{isToday ? longDate(date) : "Nachtragen"}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => go(addDays(date, 1))} disabled={isToday} aria-label="Tag danach">
          <ChevronRight aria-hidden />
        </Button>
      </div>

      {summary.due > 0 ? (
        <section className="rounded-3xl border bg-card p-4" aria-label="Fortschritt">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-muted-foreground">{summary.done === summary.due ? "Alles erledigt" : "Erledigt"}</p>
            <p className="tabular-nums">
              <span className="font-heading text-2xl font-semibold">{summary.done}</span>
              <span className="text-muted-foreground"> von {summary.due}</span>
            </p>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={summary.done} aria-valuemin={0} aria-valuemax={summary.due} aria-label="Tägliche Gewohnheiten">
            <div className={cn("h-full rounded-full transition-all", summary.done === summary.due ? "bg-sage" : "bg-primary")} style={{ width: `${(summary.done / summary.due) * 100}%` }} />
          </div>
        </section>
      ) : null}

      {schedule.length > 0 ? (
        <section className="rounded-3xl border bg-sport-soft/60 p-4" aria-labelledby="training-heute">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="training-heute" className="flex items-center gap-2 font-semibold">
              <CalendarClock className="size-4 text-sport" aria-hidden />
              {isToday ? "Training heute" : "Geplantes Training"}
            </h2>
            <Link href="/sport/habits/wochenplan" className="text-sm font-medium text-primary hover:underline">
              Wochenplan
            </Link>
          </div>
          <ul className="space-y-1.5">
            {schedule.map((e) => (
              <li key={e.id} className="flex items-center gap-3 text-sm">
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: categoryOf(e.category).color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium wrap-anywhere">{e.title}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">{slotLabel(e)}</span>
                </span>
                {e.durationMin ? <span className="shrink-0 text-muted-foreground tabular-nums">{formatDuration(e.durationMin)}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {challenges}

      {active.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-6 text-center">
          <p className="font-medium">Noch keine Habits</p>
          <p className="mt-1 text-sm text-muted-foreground">Leg Gewohnheiten wie Dehnen oder Supplemente wie Kreatin an und hak sie hier jeden Tag ab.</p>
        </div>
      ) : groups.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-5 text-center text-sm text-muted-foreground">An diesem Tag ist nichts dran.</p>
      ) : (
        groups.map((g) =>
          g.routine ? (
            <RoutineCard
              key={g.key}
              routine={g.routine}
              items={g.habits}
              habits={habits}
              index={index}
              date={date}
              onSetCount={setTo}
              onTap={tap}
              onEdit={setEditing}
              onAdd={() => setEditing({ kind: "habit", routine: g.routine })}
            />
          ) : (
            <section key={g.key} aria-label={g.label}>
              <GroupHeading
                aside={
                  g.key === "woche" || g.key === "monat"
                    ? `${g.habits.filter((h) => periodProgress(h, index, date).met).length}/${g.habits.length} geschafft`
                    : `${g.habits.filter((h) => countOn(index, h.id, date) >= h.target).length}/${g.habits.length}`
                }
              >
                {g.label}
              </GroupHeading>
              <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
                {g.habits.map((h) => {
                  const count = countOn(index, h.id, date);
                  const progress = periodProgress(h, index, date);
                  const periodic = h.frequency !== "daily";
                  const detail = [
                    h.dose,
                    h.atTime,
                    periodic ? `${progress.done}/${progress.target} ${h.frequency === "weekly" ? "diese Woche" : "diesen Monat"}` : h.target > 1 ? `${h.target}× am Tag` : null,
                  ].filter(Boolean);
                  return (
                    <li key={h.id} className="flex items-center gap-3 py-2.5 pr-3 pl-3">
                      <button type="button" onClick={() => setEditing(h)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${h.name} bearbeiten`}>
                        <HabitIcon kind={h.kind} color={h.color} />
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate font-medium", count >= h.target && "text-muted-foreground line-through decoration-1")}>{h.name}</span>
                          {detail.length ? <span className="block truncate text-sm text-muted-foreground tabular-nums">{detail.join(" · ")}</span> : null}
                          {h.notes ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <NotebookPen className="size-3 shrink-0" aria-hidden />
                              <span className="truncate">{h.notes}</span>
                            </span>
                          ) : null}
                        </span>
                      </button>
                      <CheckButton
                        count={count}
                        target={periodic ? 1 : h.target}
                        color={h.color}
                        periodMet={periodic && progress.met}
                        onClick={() => tap(h)}
                        label={
                          periodic
                            ? `${h.name} ${count > 0 ? "nicht mehr abhaken" : "abhaken"} (${progress.done} von ${progress.target})`
                            : h.target > 1
                              ? `${h.name}: ${count} von ${h.target}, antippen zählt hoch`
                              : `${h.name} ${count > 0 ? "nicht mehr abhaken" : "abhaken"}`
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
        )
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" className="h-12 rounded-full" onClick={() => setEditing({ kind: "habit" })}>
          <Plus aria-hidden />
          Gewohnheit
        </Button>
        <Button type="button" variant="outline" className="h-12 rounded-full" onClick={() => setEditing({ kind: "supplement" })}>
          <Plus aria-hidden />
          Supplement
        </Button>
      </div>

      {missingRoutines.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {missingRoutines.map((r) => {
            const Icon = ROUTINE_STYLE[r.key].icon;
            return (
              <Button key={r.key} type="button" variant="ghost" className="h-12 rounded-full border border-dashed" onClick={() => setEditing({ kind: "habit", routine: r.key })}>
                <Icon aria-hidden />
                {r.label}
              </Button>
            );
          })}
        </div>
      ) : null}

      {editing ? (
        <HabitSheet
          key={"id" in editing ? editing.id : `${editing.kind}-${editing.routine ?? ""}`}
          habit={"id" in editing ? editing : null}
          defaultKind={"id" in editing ? undefined : editing.kind}
          defaultRoutine={"id" in editing ? undefined : editing.routine}
          habits={habits}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
