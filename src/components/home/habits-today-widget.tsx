"use client";

import Link from "next/link";
import { ListChecks } from "lucide-react";
import { CheckButton, HabitIcon } from "@/components/sport/habits/habit-parts";
import { useHabitCounts } from "@/components/sport/habits/use-habit-counts";
import { countOn, daySummary, nextCount, periodProgress, todayGroups, type Habit, type HabitCheck } from "@/lib/domain/habits";
import { cn } from "@/lib/utils";
import { AsideLink, CARD, Empty, WidgetTitle } from "./widget-parts";

/** So viele Zeilen zeigt das Widget, der Rest steht unter „Habits“. */
const MAX_ROWS = 8;

/**
 * Habits heute: Fortschritt der täglichen Habits und die heute fälligen (nach Tageszeit, dann Woche und Monat) zum
 * direkten Abhaken, wie im Tab „Heute“ des Habit Trackers.
 */
export function HabitsTodayWidget({ habits, checks, today }: { habits: Habit[]; checks: HabitCheck[]; today: string }) {
  const { index, setCount } = useHabitCounts(checks);
  const rows = todayGroups(habits, today).flatMap((g) => g.habits.map((h) => ({ h, group: g.key === "jederzeit" ? null : g.label })));
  const shown = rows.slice(0, MAX_ROWS);
  const summary = daySummary(habits, index, today);
  const hasHabits = habits.some((h) => h.pausedOn == null);

  function tap(h: Habit) {
    const current = countOn(index, h.id, today);
    const next = nextCount(current, h.target, h.frequency);
    if (next >= h.target && current < h.target) navigator.vibrate?.(12);
    setCount(h.id, today, next, current);
  }

  return (
    <section className={CARD} aria-label="Habits heute">
      <WidgetTitle
        icon={ListChecks}
        title="Habits heute"
        aside={summary.due > 0 ? <span className="text-sm text-muted-foreground tabular-nums">{summary.done === summary.due ? "Alles erledigt" : `${summary.done} von ${summary.due}`}</span> : <AsideLink href="/sport/habits">Habits</AsideLink>}
      />
      {summary.due > 0 ? (
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={summary.done} aria-valuemin={0} aria-valuemax={summary.due} aria-label="Tägliche Habits erledigt">
          <div className={cn("h-full rounded-full transition-all", summary.done === summary.due ? "bg-sage" : "bg-sport")} style={{ width: `${(summary.done / summary.due) * 100}%` }} />
        </div>
      ) : null}

      {!hasHabits ? (
        <Empty>
          Noch keine Habits.{" "}
          <Link href="/sport/habits/liste" className="font-medium text-primary hover:underline">
            Jetzt anlegen
          </Link>
        </Empty>
      ) : rows.length === 0 ? (
        <Empty>Heute ist nichts dran.</Empty>
      ) : (
        <ul className="divide-y">
          {shown.map(({ h, group }) => {
            const count = countOn(index, h.id, today);
            const progress = periodProgress(h, index, today);
            const periodic = h.frequency !== "daily";
            const detail = periodic
              ? [h.dose, `${progress.done}/${progress.target} ${h.frequency === "weekly" ? "diese Woche" : "diesen Monat"}`]
              : [group, h.atTime, h.dose, h.target > 1 ? `${h.target}× am Tag` : null];
            return (
              <li key={h.id} className="flex min-h-14 items-center gap-3 py-1.5">
                <HabitIcon kind={h.kind} color={h.color} className="size-9 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate font-medium", count >= h.target && "text-muted-foreground line-through decoration-1")}>{h.name}</span>
                  <span className="block truncate text-xs text-muted-foreground tabular-nums">{detail.filter(Boolean).join(" · ")}</span>
                </span>
                <CheckButton
                  size="md"
                  count={count}
                  target={periodic ? 1 : h.target}
                  color={h.color}
                  periodMet={periodic && progress.met}
                  onClick={() => tap(h)}
                  label={h.target > 1 && !periodic ? `${h.name}: ${count} von ${h.target}, antippen zählt hoch` : `${h.name} ${count > 0 ? "nicht mehr abhaken" : "abhaken"}`}
                />
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > shown.length ? (
        <Link href="/sport/habits" className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
          +{rows.length - shown.length} weitere im Habit Tracker
        </Link>
      ) : null}
    </section>
  );
}
