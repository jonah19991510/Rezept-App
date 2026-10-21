"use client";

import { useMemo, useRef, useState, type TouchEvent } from "react";
import { Boxes, ChevronLeft, ChevronRight, Dumbbell, Plus, Repeat } from "lucide-react";
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
import type { LeftoverIdea } from "@/lib/domain/leftovers";
import { goalsForDay } from "@/lib/domain/training";
import { dayMonth, weekdayLong, weekdayShort } from "@/lib/domain/week";
import { formatEuro, formatNumber } from "@/lib/format";
import type { PlanBatch, PlanEntry } from "@/lib/server/plan";
import { cn } from "@/lib/utils";
import { AddEntryDialog } from "./add-entry-dialog";
import { DayExtras, suggestSlot, TrainingToggle } from "./day-extras";
import { LongNotCooked, type LongNotCookedItem } from "./long-not-cooked";
import { EntryDialog } from "./entry-dialog";
import { GoalProgress } from "./goal-progress";
import { MacroDot } from "@/components/recipes/macro-dot";
import type { PlanRecipeChoices, SlotTarget } from "./types";

export function WeekPlanner({
  days,
  today,
  entries,
  goals,
  trainingDays,
  batches,
  leftoverIdeas,
  recipes,
  costs = {},
  longNotCooked = { items: [], weeks: 6 },
}: {
  days: string[];
  today: string;
  entries: PlanEntry[];
  /** Standard- und Trainingstag-Ziel (Phase 11) */
  goals: { default: Goals; training: Goals };
  trainingDays: Record<string, boolean>;
  batches: PlanBatch[];
  leftoverIdeas: Record<string, LeftoverIdea[]>;
  recipes: PlanRecipeChoices;
  /** Phase 12: Kosten pro Portion je Rezept (nur Rezepte mit mindestens einem Preis) */
  costs?: Record<string, { perServing: number; complete: boolean }>;
  longNotCooked?: { items: LongNotCookedItem[]; weeks: number };
}) {
  const [selectedDay, setSelectedDay] = useState(days.includes(today) ? today : days[0]);
  const [addTarget, setAddTarget] = useState<SlotTarget | null>(null);
  const [editEntry, setEditEntry] = useState<PlanEntry | null>(null);

  const byDay = useMemo(() => totalsByDay(days, entries), [days, entries]);
  const plannedDates = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);
  const summary = useMemo(() => summarizeWeek(byDay, plannedDates), [byDay, plannedDates]);
  const goalsFor = (day: string) => goalsForDay(trainingDays[day] ?? false, goals.default, goals.training);
  // Wochenschnitt gegen den Schnitt der Tagesziele (Trainingstage haben andere Ziele)
  const averageGoals = averageOf([...plannedDates].filter((d) => days.includes(d)).map(goalsFor));
  // Kosten: Summe der Einträge mit Preis; „mindestens“, wenn Einträgen oder Zutaten ein Preis fehlt
  const costOf = (list: PlanEntry[]) => {
    let total = 0;
    let complete = list.length > 0;
    for (const e of list) {
      const c = costs[e.recipeId];
      if (!c) complete = false;
      else {
        total += c.perServing * e.servings;
        if (!c.complete) complete = false;
      }
    }
    return total > 0 ? { total, complete } : null;
  };
  const dayCost = (day: string) => costOf(entries.filter((e) => e.date === day));
  const weekCost = costOf(entries);
  const planFromList = (recipeId: string) =>
    setAddTarget({ date: selectedDay, slot: suggestSlot(entries.filter((e) => e.date === selectedDay), null), recipeId });

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
            const p = goalProgress(byDay[day].kcal, goalsFor(day).kcal, "kcal");
            const active = day === selectedDay;
            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "relative flex min-h-14 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 text-sm transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-card",
                  day === today && !active && "border-primary",
                )}
              >
                {trainingDays[day] ? (
                  <Dumbbell className="absolute top-1 right-0.5 size-2.5 opacity-80" aria-label="Trainingstag" />
                ) : null}
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
          className="min-w-0 touch-pan-y space-y-4"
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
            <h2 className="min-w-0 text-center text-xl font-semibold">
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
            <div className="mb-3 flex justify-end">
              <TrainingToggle key={selectedDay} date={selectedDay} training={trainingDays[selectedDay] ?? false} />
            </div>
            <GoalProgress actual={byDay[selectedDay]} goals={goalsFor(selectedDay)} />
            <CostLine cost={dayCost(selectedDay)} label="Kosten an diesem Tag" />
          </div>

          <DayExtras
            date={selectedDay}
            actual={byDay[selectedDay]}
            goals={goalsFor(selectedDay)}
            dayEntries={entries.filter((e) => e.date === selectedDay)}
            recipes={recipes}
            batches={batches}
            ideas={leftoverIdeas[selectedDay] ?? []}
            onPlan={setAddTarget}
          />

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
            const dayGoals = goalsFor(day);
            const p = goalProgress(total.kcal, dayGoals.kcal, "kcal");
            return (
              <div
                key={day}
                className={cn(
                  "relative rounded-2xl border bg-card p-2 text-center",
                  day === today && "border-primary",
                  day === selectedDay && "ring-2 ring-primary/40",
                )}
              >
                <div className="absolute top-1.5 right-1.5">
                  <TrainingToggle date={day} training={trainingDays[day] ?? false} compact />
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  aria-pressed={day === selectedDay}
                  aria-label={`${weekdayLong(day)} im Detail zeigen`}
                  className="rounded-lg px-1 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="text-sm font-semibold">{weekdayShort(day)}</div>
                  <div className="text-xs text-muted-foreground">{dayMonth(day)}</div>
                </button>
                <div className="mt-1 text-xs tabular-nums">
                  <span className="font-semibold">{formatNumber(Math.round(total.kcal), 0)}</span>
                  {dayGoals.kcal ? <span className="text-muted-foreground"> / {formatNumber(dayGoals.kcal, 0)}</span> : null}
                </div>
                <div className="flex items-center justify-center gap-1 text-xs tabular-nums">
                  <MacroDot macro="protein" />
                  {formatNumber(total.protein, 0)} g P
                </div>
                {dayCost(day) ? (
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {dayCost(day)!.complete ? "" : "≥ "}
                    {formatEuro(dayCost(day)!.total)}
                  </div>
                ) : null}
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

        {/* Gewählter Tag im Detail: Ziele, Lücke, Reste */}
        <section className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" aria-label={`${weekdayLong(selectedDay)} im Detail`}>
          <div className="rounded-3xl border bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold">
              {weekdayLong(selectedDay)}, {dayMonth(selectedDay)}
              {trainingDays[selectedDay] ? <span className="ml-2 text-sm font-normal text-primary">Trainingstag</span> : null}
            </h2>
            <GoalProgress actual={byDay[selectedDay]} goals={goalsFor(selectedDay)} />
            <CostLine cost={dayCost(selectedDay)} label="Kosten an diesem Tag" />
          </div>
          <DayExtras
            date={selectedDay}
            actual={byDay[selectedDay]}
            goals={goalsFor(selectedDay)}
            dayEntries={entries.filter((e) => e.date === selectedDay)}
            recipes={recipes}
            batches={batches}
            ideas={leftoverIdeas[selectedDay] ?? []}
            onPlan={setAddTarget}
          />
        </section>
      </div>

      {/* Wochenübersicht */}
      <section className="mt-8 rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="woche-summe">
        <h2 id="woche-summe" className="mb-1 text-xl font-semibold">
          Diese Woche
        </h2>
        {summary.plannedDays === 0 ? (
          <p className="text-sm text-muted-foreground">Noch nichts geplant. Tipp auf „planen“, um ein Rezept einzutragen.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm text-muted-foreground">
                Durchschnitt pro geplantem Tag ({summary.plannedDays} {summary.plannedDays === 1 ? "Tag" : "Tage"})
              </p>
              <GoalProgress actual={summary.averagePerPlannedDay} goals={averageGoals} compact />
              <CostLine cost={weekCost} label="Kosten diese Woche" />
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

      <LongNotCooked items={longNotCooked.items} weeks={longNotCooked.weeks} onPlan={planFromList} />

      <AddEntryDialog target={addTarget} days={days} recipes={recipes} onClose={() => setAddTarget(null)} />
      <EntryDialog entry={editEntry} days={days} batches={batches} onClose={() => setEditEntry(null)} />
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
        {entry.batchId ? (
          entry.isLeftover ? (
            <Repeat className="mr-1 inline size-3.5 align-[-2px] text-sage" aria-label="Reste" />
          ) : (
            <Boxes className="mr-1 inline size-3.5 align-[-2px] text-sage" aria-label="Meal Prep, Kochtag" />
          )
        ) : null}
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

/** Durchschnitt der Tagesziele; ein Feld bleibt leer, wenn es an keinem Tag ein Ziel gibt. */
function averageOf(list: Goals[]): Goals {
  const avg = (key: keyof Goals) => {
    const values = list.map((g) => g[key]).filter((v): v is number => v != null);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  return { kcal: avg("kcal"), protein: avg("protein"), carbs: avg("carbs"), fat: avg("fat") };
}

/** „Kosten an diesem Tag: ca. 6,40 €“ (oder „mindestens“, wenn Preise fehlen); ohne Preise nichts. */
function CostLine({ cost, label }: { cost: { total: number; complete: boolean } | null; label: string }) {
  if (!cost) return null;
  return (
    <p className="mt-3 border-t pt-3 text-sm">
      {label}: {cost.complete ? "ca." : "mindestens"} <span className="font-semibold tabular-nums">{formatEuro(cost.total)}</span>
    </p>
  );
}
