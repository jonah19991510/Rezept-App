"use client";

import { useMemo, useRef, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  entryMacros,
  goalProgress,
  MEAL_SLOTS,
  SLOT_LABELS,
  summarizeWeek,
  totalsByDay,
  type Goals,
  type MealSlot,
} from "@/lib/domain/plan";
import { dayMonth, weekdayLong, weekdayShort } from "@/lib/domain/week";
import { formatNumber } from "@/lib/format";
import type { PlanEntry } from "@/lib/server/plan";
import { cn } from "@/lib/utils";
import { AddEntryDialog } from "./add-entry-dialog";
import { EntryDialog } from "./entry-dialog";
import { GoalProgress } from "./goal-progress";
import { MacroDot } from "@/components/recipes/macro-dot";
import type { PlanRecipeChoices, SlotTarget } from "./types";

export function WeekPlanner({
  days,
  today,
  entries,
  goals,
  recipes,
}: {
  days: string[];
  today: string;
  entries: PlanEntry[];
  goals: Goals;
  recipes: PlanRecipeChoices;
}) {
  const [selectedDay, setSelectedDay] = useState(days.includes(today) ? today : days[0]);
  const [addTarget, setAddTarget] = useState<SlotTarget | null>(null);
  const [editEntry, setEditEntry] = useState<PlanEntry | null>(null);

  const byDay = useMemo(() => totalsByDay(days, entries), [days, entries]);
  const plannedDates = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);
  const summary = useMemo(() => summarizeWeek(byDay, plannedDates), [byDay, plannedDates]);

  const entriesFor = (date: string, slot: MealSlot) => entries.filter((e) => e.date === date && e.slot === slot);
  const selectedIndex = days.indexOf(selectedDay);

  // Wischen zwischen den Tagen (Handy)
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dy) > 50) return;
    const next = selectedIndex + (dx < 0 ? 1 : -1);
    if (next >= 0 && next < days.length) setSelectedDay(days[next]);
  }

  return (
    <>
      {/* Handy und Tablet: Tagesansicht */}
      <div className="lg:hidden">
        <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Wochentage">
          {days.map((day) => {
            const p = goalProgress(byDay[day].kcal, goals.kcal, "kcal");
            const active = day === selectedDay;
            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "flex min-h-14 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 text-sm transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-card",
                  day === today && !active && "border-primary",
                )}
              >
                <span className="font-medium">{weekdayShort(day)}</span>
                <span className={cn("text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {dayMonth(day).slice(0, 3)}
                </span>
                <span
                  className={cn(
                    "h-1 w-6 rounded-full",
                    plannedDates.has(day) ? (p.state === "over" ? "bg-destructive" : active ? "bg-primary-foreground" : "bg-sage") : "bg-transparent",
                  )}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>

        <section
          className="space-y-4"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          aria-label={`${weekdayLong(selectedDay)}, ${dayMonth(selectedDay)}`}
        >
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSelectedDay(days[selectedIndex - 1])}
              disabled={selectedIndex === 0}
              aria-label="Vorheriger Tag"
            >
              <ChevronLeft aria-hidden />
            </Button>
            <h2 className="text-xl font-semibold">
              {weekdayLong(selectedDay)}, {dayMonth(selectedDay)}
              {selectedDay === today ? <span className="ml-2 text-sm font-normal text-primary">heute</span> : null}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSelectedDay(days[selectedIndex + 1])}
              disabled={selectedIndex === days.length - 1}
              aria-label="Nächster Tag"
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>

          <div className="rounded-3xl border bg-card p-4">
            <GoalProgress actual={byDay[selectedDay]} goals={goals} />
          </div>

          {MEAL_SLOTS.map((slot) => (
            <div key={slot} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{SLOT_LABELS[slot]}</h3>
              {entriesFor(selectedDay, slot).map((entry) => (
                <EntryCard key={entry.id} entry={entry} onClick={() => setEditEntry(entry)} />
              ))}
              <button
                type="button"
                onClick={() => setAddTarget({ date: selectedDay, slot })}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Plus className="size-4" aria-hidden />
                {SLOT_LABELS[slot]} planen
              </button>
            </div>
          ))}
        </section>
      </div>

      {/* Desktop: ganze Woche */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-[5.5rem_repeat(7,minmax(0,1fr))] gap-1.5">
          <div />
          {days.map((day) => {
            const total = byDay[day];
            const p = goalProgress(total.kcal, goals.kcal, "kcal");
            return (
              <div
                key={day}
                className={cn("rounded-2xl border bg-card p-2 text-center", day === today && "border-primary")}
              >
                <div className="text-sm font-semibold">{weekdayShort(day)}</div>
                <div className="text-xs text-muted-foreground">{dayMonth(day)}</div>
                <div className="mt-1 text-xs tabular-nums">
                  <span className="font-semibold">{formatNumber(Math.round(total.kcal), 0)}</span>
                  {goals.kcal ? <span className="text-muted-foreground"> / {formatNumber(goals.kcal, 0)}</span> : null}
                </div>
                <div className="flex items-center justify-center gap-1 text-xs tabular-nums">
                  <MacroDot macro="protein" />
                  {formatNumber(total.protein, 0)} g P
                </div>
                {p.state !== "none" ? (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div
                      className={cn("h-full rounded-full", p.state === "over" ? "bg-destructive" : "bg-macro-kcal")}
                      style={{ width: `${Math.min(100, p.ratio * 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}

          {MEAL_SLOTS.map((slot) => (
            <SlotRow key={slot} slot={slot} days={days} entriesFor={entriesFor} onAdd={setAddTarget} onEdit={setEditEntry} />
          ))}
        </div>
      </div>

      {/* Wochenübersicht */}
      <section className="mt-8 rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="woche-summe">
        <h2 id="woche-summe" className="mb-1 text-xl font-semibold">
          Diese Woche
        </h2>
        {summary.plannedDays === 0 ? (
          <p className="text-sm text-muted-foreground">Noch nichts geplant. Tipp auf „planen“, um ein Rezept einzutragen.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm text-muted-foreground">
                Durchschnitt pro geplantem Tag ({summary.plannedDays} {summary.plannedDays === 1 ? "Tag" : "Tage"})
              </p>
              <GoalProgress actual={summary.averagePerPlannedDay} goals={goals} compact />
            </div>
            <dl className="grid grid-cols-2 content-start gap-3 text-sm">
              <div className="rounded-2xl bg-muted/60 p-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <MacroDot macro="kcal" />
                  kcal gesamt
                </dt>
                <dd className="font-heading text-xl font-semibold">
                  {formatNumber(Math.round(summary.total.kcal), 0)}
                </dd>
              </div>
              <div className="rounded-2xl bg-muted/60 p-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <MacroDot macro="protein" />
                  Protein gesamt
                </dt>
                <dd className="font-heading text-xl font-semibold">
                  {formatNumber(summary.total.protein, 0)} g
                </dd>
              </div>
              <div className="rounded-2xl bg-muted/60 p-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <MacroDot macro="carbs" />
                  Kohlenhydrate
                </dt>
                <dd className="font-heading text-xl font-semibold">
                  {formatNumber(summary.total.carbs, 0)} g
                </dd>
              </div>
              <div className="rounded-2xl bg-muted/60 p-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <MacroDot macro="fat" />
                  Fett
                </dt>
                <dd className="font-heading text-xl font-semibold">
                  {formatNumber(summary.total.fat, 0)} g
                </dd>
              </div>
            </dl>
          </div>
        )}
      </section>

      <AddEntryDialog target={addTarget} days={days} recipes={recipes} onClose={() => setAddTarget(null)} />
      <EntryDialog entry={editEntry} days={days} onClose={() => setEditEntry(null)} />
    </>
  );
}

function SlotRow({
  slot,
  days,
  entriesFor,
  onAdd,
  onEdit,
}: {
  slot: MealSlot;
  days: string[];
  entriesFor: (date: string, slot: MealSlot) => PlanEntry[];
  onAdd: (t: SlotTarget) => void;
  onEdit: (e: PlanEntry) => void;
}) {
  return (
    <>
      <div className="flex items-start pt-2 text-sm font-medium text-muted-foreground">{SLOT_LABELS[slot]}</div>
      {days.map((day) => (
        <div key={day} className="flex min-h-20 flex-col gap-1 rounded-2xl bg-muted/40 p-1">
          {entriesFor(day, slot).map((entry) => (
            <EntryCard key={entry.id} entry={entry} onClick={() => onEdit(entry)} compact />
          ))}
          <button
            type="button"
            onClick={() => onAdd({ date: day, slot })}
            className="mt-auto grid min-h-9 place-items-center rounded-xl text-muted-foreground hover:bg-card hover:text-primary"
            aria-label={`${SLOT_LABELS[slot]} am ${weekdayLong(day)} planen`}
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </>
  );
}

function EntryCard({ entry, onClick, compact = false }: { entry: PlanEntry; onClick: () => void; compact?: boolean }) {
  const m = entryMacros(entry);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border bg-card text-left shadow-sm shadow-foreground/5 transition hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        compact ? "p-2" : "flex min-h-14 items-center justify-between gap-3 px-3 py-2",
      )}
    >
      <span
        className={cn(
          "block font-medium",
          compact ? "line-clamp-3 text-xs leading-snug" : "min-w-0 truncate",
          !entry.available && "text-muted-foreground italic",
        )}
      >
        {entry.recipeTitle}
      </span>
      <span className={cn("block text-muted-foreground tabular-nums", compact ? "mt-1 text-[0.7rem]" : "shrink-0 text-right text-xs")}>
        {entry.servings !== 1 ? `${formatNumber(entry.servings, 2)} × · ` : ""}
        {entry.perServing ? `${formatNumber(Math.round(m.kcal), 0)} kcal` : "–"}
        {!compact && entry.perServing ? (
          <>
            <br />
            {formatNumber(m.protein, 0)} g P
          </>
        ) : null}
      </span>
    </button>
  );
}
