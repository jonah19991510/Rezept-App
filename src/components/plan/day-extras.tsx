"use client";

import { useOptimistic, useTransition } from "react";
import { Boxes, Dumbbell, Lightbulb, Plus, Repeat } from "lucide-react";
import { toast } from "sonner";
import { addLeftoverAction, setTrainingDayAction } from "@/app/(app)/wochenplan/actions";
import { Button } from "@/components/ui/button";
import { BASE_LABELS, type LeftoverIdea } from "@/lib/domain/leftovers";
import { openBatchesFor } from "@/lib/domain/mealprep";
import { SLOT_LABELS, type DayMacros, type Goals, type MealSlot } from "@/lib/domain/plan";
import { dayGap, gapSuggestions } from "@/lib/domain/training";
import { daysBetween } from "@/lib/domain/week";
import { formatNumber } from "@/lib/format";
import type { PlanBatch, PlanEntry } from "@/lib/server/plan";
import { cn } from "@/lib/utils";
import type { PlanRecipeChoices, SlotTarget } from "./types";

/** Freier Platz für einen Vorschlag: kleine Sachen als Snack, sonst die erste freie Hauptmahlzeit. */
export function suggestSlot(dayEntries: PlanEntry[], kcal: number | null): MealSlot {
  const used = new Set(dayEntries.map((e) => e.slot));
  if (kcal != null && kcal < 400) return "snack";
  return (["lunch", "dinner", "breakfast"] as const).find((s) => !used.has(s)) ?? "snack";
}

function relativeDay(from: string, to: string): string {
  const diff = daysBetween(from, to);
  return diff === 1 ? "gestern" : diff === 2 ? "vorgestern" : `vor ${diff} Tagen`;
}

/** Hantel-Schalter: Tag als Trainingstag (eigenes Zielset). */
export function TrainingToggle({ date, training, compact = false }: { date: string; training: boolean; compact?: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(training);
  const [, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      setOptimistic(!optimistic);
      const result = await setTrainingDayAction({ date, training: !optimistic });
      if (!result.ok) toast.error(result.message);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={optimistic}
      title={optimistic ? "Trainingstag – antippen zum Ausschalten" : "Als Trainingstag markieren"}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full border text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        compact ? "size-8" : "min-h-11 px-3",
        optimistic ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      <Dumbbell className="size-4" aria-hidden />
      {compact ? <span className="sr-only">Trainingstag</span> : optimistic ? "Trainingstag" : "Kein Training"}
    </button>
  );
}

/** Unter dem Tagesfortschritt: was zum Ziel fehlt (mit Vorschlägen), übrige Meal-Prep-Portionen, Reste-Ideen. */
export function DayExtras({
  date,
  actual,
  goals,
  dayEntries,
  recipes,
  batches,
  ideas,
  onPlan,
}: {
  date: string;
  actual: DayMacros;
  goals: Goals;
  dayEntries: PlanEntry[];
  recipes: PlanRecipeChoices;
  batches: PlanBatch[];
  ideas: LeftoverIdea[];
  onPlan: (target: SlotTarget) => void;
}) {
  const gap = dayGap(actual, goals);
  const plannedIds = new Set(dayEntries.map((e) => e.recipeId));
  const suggestions = gap
    ? gapSuggestions(
        actual,
        goals,
        [...recipes.own, ...recipes.community].filter((r) => !plannedIds.has(r.id)),
      )
    : [];
  const open = openBatchesFor(date, batches);
  if (!gap && open.length === 0 && ideas.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3">
      {gap ? (
        <section className="rounded-3xl border bg-card p-4" aria-label="Lücke zum Ziel">
          <p className="flex items-start gap-2 text-sm">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0">
              Bis zum Ziel fehlen noch{" "}
              <span className="font-semibold">
                {[
                  gap.protein != null ? `${formatNumber(Math.round(gap.protein), 0)} g Protein` : null,
                  gap.kcal != null ? `${formatNumber(Math.round(gap.kcal), 0)} kcal` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              .
            </span>
          </p>
          {suggestions.length > 0 ? (
            <ul className="mt-3 divide-y rounded-2xl border">
              {suggestions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    {/* Zeilenumbruch statt Abschneiden: lange Titel bleiben lesbar und sprengen die Breite nicht */}
                    <span className="block text-sm font-medium wrap-anywhere">{s.title}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {s.servings === 0.5 ? "½ Portion · " : ""}+{formatNumber(Math.round(s.adds.protein), 0)} g Protein · +
                      {formatNumber(Math.round(s.adds.kcal), 0)} kcal
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => onPlan({ date, slot: suggestSlot(dayEntries, s.adds.kcal), recipeId: s.id, servings: s.servings })}
                    aria-label={`${s.title} einplanen`}
                  >
                    <Plus aria-hidden />
                    Einplanen
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">In deinem Buch passt gerade nichts, ohne über das Ziel zu kommen.</p>
          )}
        </section>
      ) : null}

      {open.map((b) => (
        <LeftoverBatch key={b.id} batch={b} date={date} slot={suggestSlot(dayEntries, null)} />
      ))}

      {ideas.map((idea) => (
        <section key={idea.base} className="rounded-3xl border bg-card p-4" aria-label={`Reste: ${BASE_LABELS[idea.base]}`}>
          <p className="flex items-start gap-2 text-sm">
            <Repeat className="mt-0.5 size-4 shrink-0 text-sage" aria-hidden />
            <span>
              {BASE_LABELS[idea.base]} von {relativeDay(idea.fromDate, date)} übrig? Damit passt:
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {idea.recipes.map((r) => (
              <Button
                key={r.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto min-h-9 max-w-full py-1.5 text-left whitespace-normal"
                onClick={() => onPlan({ date, slot: suggestSlot(dayEntries, null), recipeId: r.id })}
              >
                <Plus aria-hidden />
                {r.title}
              </Button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LeftoverBatch({ batch, date, slot }: { batch: PlanBatch; date: string; slot: MealSlot }) {
  const [pending, startTransition] = useTransition();
  const servings = Math.min(1, batch.remaining);

  function plan() {
    startTransition(async () => {
      const result = await addLeftoverAction({ batchId: batch.id, date, slot, servings });
      if (result.ok) toast.success(result.message ?? "Reste eingeplant.");
      else toast.error(result.message);
    });
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-card p-4" aria-label="Meal-Prep-Reste">
      <p className="flex min-w-0 flex-1 basis-56 items-start gap-2 text-sm">
        <Boxes className="mt-0.5 size-4 shrink-0 text-sage" aria-hidden />
        <span>
          Vom Meal Prep <span className="font-medium">{batch.title}</span> {batch.remaining === 1 ? "ist" : "sind"} noch{" "}
          {formatNumber(batch.remaining, 2)} {batch.remaining === 1 ? "Portion" : "Portionen"} übrig.
        </span>
      </p>
      <Button type="button" variant="outline" size="sm" onClick={plan} disabled={pending}>
        <Plus aria-hidden />
        Als {SLOT_LABELS[slot]} einplanen
      </Button>
    </section>
  );
}
