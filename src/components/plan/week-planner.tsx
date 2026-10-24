"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState, type TouchEvent } from "react";
import { Boxes, ChevronLeft, ChevronRight, CookingPot, Dumbbell, Plus, Repeat } from "lucide-react";
import { GroupHeading, ListCard, TagLabel } from "@/components/layout/list-blocks";
import { GenerateDialog } from "@/components/shopping/generate-dialog";
import {
  entryMacros,
  goalProgress,
  inKcalTarget,
  kcalBar,
  MEAL_SLOTS,
  SLOT_LABELS,
  summarizeWeek,
  totalsByDay,
  type Goals,
  type MealSlot,
} from "@/lib/domain/plan";
import type { LeftoverIdea } from "@/lib/domain/leftovers";
import { photoUrl } from "@/lib/domain/photo";
import { goalsForDay } from "@/lib/domain/training";
import { addDays, dayMonth, relativeWeekLabel, weekdayLong, weekdayShort, weekRangeLabel } from "@/lib/domain/week";
import { formatEuro, formatNumber } from "@/lib/format";
import type { PlanBatch, PlanEntry } from "@/lib/server/plan";
import { cn } from "@/lib/utils";
import { AddEntryDialog } from "./add-entry-dialog";
import { DayExtras, ProteinGapCard, suggestSlot, TrainingToggle } from "./day-extras";
import { GoalCard } from "./goal-card";
import { LongNotCooked, type LongNotCookedItem } from "./long-not-cooked";
import { EntryDialog } from "./entry-dialog";
import { MacroDot } from "@/components/recipes/macro-dot";
import type { PlanRecipeChoices, SlotTarget } from "./types";

type Cost = { total: number; complete: boolean } | null;

export function WeekPlanner({
  monday,
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
  hasPlanShoppingItems = false,
}: {
  monday: string;
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
  /** Einkaufsliste hat schon Einträge aus dem Plan (Hinweis „werden ersetzt“) */
  hasPlanShoppingItems?: boolean;
}) {
  const [selectedDay, setSelectedDay] = useState(days.includes(today) ? today : days[0]);
  const [addTarget, setAddTarget] = useState<SlotTarget | null>(null);
  const [editEntry, setEditEntry] = useState<PlanEntry | null>(null);

  const byDay = useMemo(() => totalsByDay(days, entries), [days, entries]);
  const plannedDates = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);
  const summary = useMemo(() => summarizeWeek(byDay, plannedDates), [byDay, plannedDates]);
  const goalsFor = (day: string) => goalsForDay(trainingDays[day] ?? false, goals.default, goals.training);
  const daysInTarget = days.filter((d) => plannedDates.has(d) && inKcalTarget(byDay[d].kcal, goalsFor(d).kcal)).length;
  // Kosten: Summe der Einträge mit Preis; „mindestens“, wenn Einträgen oder Zutaten ein Preis fehlt
  const costOf = (list: PlanEntry[]): Cost => {
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
  const dayEntries = entries.filter((e) => e.date === selectedDay);
  const selectedIndex = days.indexOf(selectedDay);
  const isCurrentWeek = days.includes(today);

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

  const dayDetail = (
    <>
      <GoalCard actual={byDay[selectedDay]} goals={goalsFor(selectedDay)} training={trainingDays[selectedDay] ?? false}>
        <CostLine cost={dayCost(selectedDay)} label="Kosten an diesem Tag" />
      </GoalCard>
      <ProteinGapCard
        key={selectedDay}
        date={selectedDay}
        actual={byDay[selectedDay]}
        goals={goalsFor(selectedDay)}
        dayEntries={dayEntries}
        recipes={recipes}
      />
      <DayExtras date={selectedDay} dayEntries={dayEntries} batches={batches} ideas={leftoverIdeas[selectedDay] ?? []} onPlan={setAddTarget} />
    </>
  );

  return (
    <>
      <WeekNav monday={monday} today={today} onToday={() => isCurrentWeek && setSelectedDay(today)} />

      {/* Handy und Tablet: Tagesansicht */}
      <div className="lg:hidden">
        <div className="mb-5 grid grid-cols-7 gap-1" role="tablist" aria-label="Wochentage">
          {days.map((day) => (
            <DayTile
              key={day}
              day={day}
              active={day === selectedDay}
              isToday={day === today}
              training={trainingDays[day] ?? false}
              bar={kcalBar(byDay[day].kcal, goalsFor(day).kcal, plannedDates.has(day))}
              onSelect={() => setSelectedDay(day)}
            />
          ))}
        </div>

        <section
          className="min-w-0 touch-pan-y space-y-4"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          aria-label={`${weekdayLong(selectedDay)}, ${dayMonth(selectedDay)}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
            <h2 className="flex min-w-0 items-center gap-2 text-xl font-semibold">
              <span className="truncate">
                {weekdayLong(selectedDay)}, {dayMonth(selectedDay)}
              </span>
              {selectedDay === today ? <TagLabel>Heute</TagLabel> : null}
            </h2>
            <div className="ml-auto">
              <TrainingToggle key={selectedDay} date={selectedDay} training={trainingDays[selectedDay] ?? false} />
            </div>
          </div>

          {dayDetail}

          {MEAL_SLOTS.map((slot) => (
            <SlotSection
              key={slot}
              slot={slot}
              entries={entriesFor(selectedDay, slot)}
              onAdd={() => setAddTarget({ date: selectedDay, slot })}
              onEdit={setEditEntry}
            />
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
                    <div className="h-full rounded-full bg-macro-kcal" style={{ width: `${Math.min(100, p.ratio * 100)}%` }} />
                  </div>
                ) : null}
              </div>
            );
          })}

          {MEAL_SLOTS.map((slot) => (
            <SlotRow key={slot} slot={slot} days={days} entriesFor={entriesFor} onAdd={setAddTarget} onEdit={setEditEntry} />
          ))}
        </div>

        {/* Gewählter Tag im Detail: Ziel, Lücke, Reste */}
        <section className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" aria-label={`${weekdayLong(selectedDay)} im Detail`}>
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              {weekdayLong(selectedDay)}, {dayMonth(selectedDay)}
              {selectedDay === today ? <TagLabel>Heute</TagLabel> : null}
            </h2>
            <GoalCard actual={byDay[selectedDay]} goals={goalsFor(selectedDay)} training={trainingDays[selectedDay] ?? false}>
              <CostLine cost={dayCost(selectedDay)} label="Kosten an diesem Tag" />
            </GoalCard>
          </div>
          <div className="space-y-4 md:pt-12">
            <ProteinGapCard
              key={selectedDay}
              date={selectedDay}
              actual={byDay[selectedDay]}
              goals={goalsFor(selectedDay)}
              dayEntries={dayEntries}
              recipes={recipes}
            />
            <DayExtras date={selectedDay} dayEntries={dayEntries} batches={batches} ideas={leftoverIdeas[selectedDay] ?? []} onPlan={setAddTarget} />
          </div>
        </section>
      </div>

      {/* Wochenübersicht */}
      <section className="mt-8 rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="woche-summe">
        <h2 id="woche-summe" className="mb-3 text-xl font-semibold">
          {relativeWeekLabel(monday, today)}
        </h2>
        <dl className="grid grid-cols-3 gap-2">
          <Stat label="Ø kcal / Tag" value={summary.plannedDays ? formatNumber(Math.round(summary.averagePerPlannedDay.kcal), 0) : "–"} />
          <Stat
            label="Ø Protein / Tag"
            value={summary.plannedDays ? `${formatNumber(Math.round(summary.averagePerPlannedDay.protein), 0)} g` : "–"}
          />
          <Stat label="Tage im Ziel" value={`${daysInTarget} / ${days.length}`} />
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          {summary.plannedDays === 0
            ? "Noch nichts geplant. Tipp auf „Rezept einplanen“, um ein Rezept einzutragen."
            : `Durchschnitt über ${summary.plannedDays} ${summary.plannedDays === 1 ? "Tag" : "Tage"} mit Einträgen. Im Ziel: 90–110 % der kcal.`}
        </p>
        <CostLine cost={weekCost} label="Kosten diese Woche" />
        <GenerateDialog
          presets={[{ label: relativeWeekLabel(monday, today), from: monday, to: addDays(monday, 6) }]}
          hasPlanItems={hasPlanShoppingItems}
          triggerLabel="Einkaufsliste aus dieser Woche"
          triggerClassName="mt-4 w-full rounded-full"
          openListAfter
        />
      </section>

      <LongNotCooked items={longNotCooked.items} weeks={longNotCooked.weeks} onPlan={planFromList} />

      <AddEntryDialog target={addTarget} days={days} recipes={recipes} onClose={() => setAddTarget(null)} />
      <EntryDialog entry={editEntry} days={days} batches={batches} onClose={() => setEditEntry(null)} />
    </>
  );
}

/**
 * Wochenwechsel als eine Leiste: Pfeile links und rechts, in der Mitte KW mit Zeitraum und „Diese Woche“ bzw.
 * „Nächste Woche“ usw. Die Mitte führt zur aktuellen Woche und zum heutigen Tag.
 */
function WeekNav({ monday, today, onToday }: { monday: string; today: string; onToday: () => void }) {
  const relative = relativeWeekLabel(monday, today);
  const current = relative === "Diese Woche";
  const arrowClass =
    "grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
  return (
    <nav className="mb-4 flex items-center gap-1 rounded-full border bg-card p-1" aria-label="Wochen">
      <Link href={`/wochenplan?woche=${addDays(monday, -7)}`} className={arrowClass} aria-label="Vorherige Woche">
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
      <Link
        href="/wochenplan"
        onClick={onToday}
        aria-current={current ? "page" : undefined}
        title="Zur aktuellen Woche und zu heute"
        className="flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-full px-2 text-center transition hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="truncate text-sm font-semibold tabular-nums">{weekRangeLabel(monday)}</span>
        <span className={cn("text-xs font-medium", current ? "text-primary" : "text-muted-foreground")}>{relative}</span>
      </Link>
      <Link href={`/wochenplan?woche=${addDays(monday, 7)}`} className={arrowClass} aria-label="Nächste Woche">
        <ChevronRight className="size-5" aria-hidden />
      </Link>
    </nav>
  );
}

/** Kachel der Tagesleiste: Wochentag, Tagesnummer, kleiner kcal-Balken; Hantel bei Trainingstagen. */
function DayTile({
  day,
  active,
  isToday,
  training,
  bar,
  onSelect,
}: {
  day: string;
  active: boolean;
  isToday: boolean;
  training: boolean;
  bar: ReturnType<typeof kcalBar>;
  onSelect: () => void;
}) {
  const fill =
    bar.state === "target"
      ? "bg-sage"
      : bar.state === "over"
        ? active
          ? "bg-primary-foreground"
          : "bg-primary"
        : active
          ? "bg-primary-foreground/60"
          : "bg-muted-foreground/50";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={`${weekdayLong(day)}, ${dayMonth(day)}${isToday ? ", heute" : ""}${training ? ", Trainingstag" : ""}`}
      onClick={onSelect}
      className={cn(
        "relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border bg-card transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active && "border-primary bg-primary text-primary-foreground",
        isToday && !active && "border-primary",
      )}
    >
      {training ? <Dumbbell className="absolute top-1 right-0.5 size-3 opacity-80" aria-hidden /> : null}
      <span className={cn("text-xs font-medium", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{weekdayShort(day)}</span>
      <span className="text-lg leading-none font-semibold tabular-nums">{day.slice(8)}</span>
      <span
        className={cn(
          "h-1 w-6 overflow-hidden rounded-full",
          bar.state === "empty" ? "bg-transparent" : active ? "bg-primary-foreground/25" : "bg-muted",
        )}
        aria-hidden
      >
        {bar.state !== "empty" ? <span className={cn("block h-full rounded-full", fill)} style={{ width: `${bar.ratio * 100}%` }} /> : null}
      </span>
    </button>
  );
}

/** Ein Slot der Tagesansicht: Überschrift mit kcal-Summe, Einträge in einer Karte oder ein gestrichelter Knopf. */
function SlotSection({
  slot,
  entries,
  onAdd,
  onEdit,
}: {
  slot: MealSlot;
  entries: PlanEntry[];
  onAdd: () => void;
  onEdit: (e: PlanEntry) => void;
}) {
  const kcal = entries.reduce((sum, e) => sum + (e.perServing ? entryMacros(e).kcal : 0), 0);
  return (
    <section aria-label={SLOT_LABELS[slot]}>
      <GroupHeading aside={entries.length > 0 ? `${formatNumber(Math.round(kcal), 0)} kcal` : undefined}>{SLOT_LABELS[slot]}</GroupHeading>
      {entries.length > 0 ? (
        <ListCard className="mt-1">
          {entries.map((entry) => (
            <li key={entry.id}>
              <PlanEntryRow entry={entry} onClick={() => onEdit(entry)} />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={onAdd}
              aria-label={`Hinzufügen (${SLOT_LABELS[slot]})`}
              className="flex min-h-12 w-full items-center justify-center gap-1.5 text-sm font-medium text-primary transition hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
            >
              <Plus className="size-4" aria-hidden />
              Hinzufügen
            </button>
          </li>
        </ListCard>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Rezept einplanen (${SLOT_LABELS[slot]})`}
          className="mt-1 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed text-sm font-medium text-muted-foreground transition hover:border-primary/60 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Plus className="size-4" aria-hidden />
          Rezept einplanen
        </button>
      )}
    </section>
  );
}

/** Labels für Meal Prep: „Rest“ bei Folge-Einträgen, „Meal Prep“ am Kochtag. */
function EntryLabels({ entry }: { entry: PlanEntry }) {
  if (!entry.batchId) return null;
  return entry.isLeftover ? (
    <TagLabel tone="sage" icon={Repeat}>
      Rest
    </TagLabel>
  ) : (
    <TagLabel tone="sage" icon={Boxes}>
      Meal Prep
    </TagLabel>
  );
}

/** Zeile eines Eintrags: Vorschaubild, Name, Portionen und Protein, rechts die kcal. Antippen öffnet die Bearbeitung. */
function PlanEntryRow({ entry, onClick }: { entry: PlanEntry; onClick: () => void }) {
  const m = entryMacros(entry);
  const servings = `${formatNumber(entry.servings, 2)} ${entry.servings === 1 ? "Portion" : "Portionen"}`;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-17 w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
    >
      <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
        {entry.imagePath ? (
          <Image src={photoUrl(entry.imagePath, "klein")} alt="" fill unoptimized sizes="48px" className="object-cover" />
        ) : (
          <CookingPot className="size-6 text-muted-foreground/60" strokeWidth={1.5} aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn("truncate font-medium", !entry.available && "text-muted-foreground italic")}>{entry.recipeTitle}</span>
          <EntryLabels entry={entry} />
        </span>
        <span className="block truncate text-xs text-muted-foreground tabular-nums">
          {servings}
          {entry.perServing ? ` · ${formatNumber(Math.round(m.protein), 0)} g Protein` : " · keine Nährwerte"}
        </span>
      </span>
      {entry.perServing ? (
        <span className="shrink-0 text-right tabular-nums">
          <span className="block font-semibold">{formatNumber(Math.round(m.kcal), 0)}</span>
          <span className="block text-xs text-muted-foreground">kcal</span>
        </span>
      ) : null}
    </button>
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
      <div className="flex items-start pt-2 font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">{SLOT_LABELS[slot]}</div>
      {days.map((day) => (
        <div key={day} className="flex min-h-20 flex-col gap-1 rounded-2xl bg-muted/40 p-1">
          {entriesFor(day, slot).map((entry) => (
            <CompactEntry key={entry.id} entry={entry} onClick={() => onEdit(entry)} />
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

/** Eintrag in der Desktop-Wochenansicht (schmale Spalte). */
function CompactEntry({ entry, onClick }: { entry: PlanEntry; onClick: () => void }) {
  const m = entryMacros(entry);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border bg-card p-2 text-left shadow-sm shadow-foreground/5 transition hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className={cn("line-clamp-3 block text-xs leading-snug font-medium", !entry.available && "text-muted-foreground italic")}>
        {entry.recipeTitle}
      </span>
      {entry.batchId ? (
        <span className="mt-1 block">
          <EntryLabels entry={entry} />
        </span>
      ) : null}
      <span className="mt-1 block text-[0.7rem] text-muted-foreground tabular-nums">
        {entry.servings !== 1 ? `${formatNumber(entry.servings, 2)} × · ` : ""}
        {entry.perServing ? `${formatNumber(Math.round(m.kcal), 0)} kcal · ${formatNumber(Math.round(m.protein), 0)} g P` : "–"}
      </span>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-1 rounded-2xl bg-muted/60 p-3">
      <dt className="text-xs leading-snug text-muted-foreground">{label}</dt>
      <dd className="font-heading text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** „Kosten an diesem Tag: ca. 6,40 €“ (oder „mindestens“, wenn Preise fehlen); ohne Preise nichts. */
function CostLine({ cost, label }: { cost: Cost; label: string }) {
  if (!cost) return null;
  return (
    <p className="mt-3 border-t pt-3 text-sm">
      {label}: {cost.complete ? "ca." : "mindestens"} <span className="font-semibold tabular-nums">{formatEuro(cost.total)}</span>
    </p>
  );
}
