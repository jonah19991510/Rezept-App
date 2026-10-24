"use client";

import { useOptimistic, useTransition } from "react";
import { Boxes, Dumbbell, Plus, Repeat, Target } from "lucide-react";
import { toast } from "sonner";
import { addLeftoverAction, addPlanEntryAction, setTrainingDayAction } from "@/app/(app)/wochenplan/actions";
import { chipClass } from "@/components/recipes/chip-select";
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

/** Ab so viel fehlendem Protein erscheint der Lücken-Hinweis über den Mahlzeiten */
const MIN_PROTEIN_GAP = 25;

/** Hantel-Schalter: Tag als Trainingstag (eigenes Zielset); an = Akzent-Rahmen und getönte Fläche. */
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
        chipClass(optimistic),
        !optimistic && "text-muted-foreground hover:text-foreground",
        compact ? "size-8 justify-center px-0" : "px-3",
      )}
    >
      <Dumbbell className="size-4" aria-hidden />
      {compact ? <span className="sr-only">Trainingstag</span> : optimistic ? "Trainingstag" : "Kein Training"}
    </button>
  );
}

/**
 * Lücke beim Protein: Fehlen noch mindestens 25 g, der beste Vorschlag aus dem eigenen Buch (bzw. öffentlichen
 * Rezepten) mit Knopf „Einplanen“: direkt in den Abend-Slot, oder als Snack, falls am Abend schon etwas steht.
 */
export function ProteinGapCard({
  date,
  actual,
  goals,
  dayEntries,
  recipes,
}: {
  date: string;
  actual: DayMacros;
  goals: Goals;
  dayEntries: PlanEntry[];
  recipes: PlanRecipeChoices;
}) {
  const [pending, startTransition] = useTransition();
  const gap = dayGap(actual, goals);
  if (!gap?.protein || gap.protein < MIN_PROTEIN_GAP) return null;
  const plannedIds = new Set(dayEntries.map((e) => e.recipeId));
  const [best] = gapSuggestions(actual, goals, [...recipes.own, ...recipes.community].filter((r) => !plannedIds.has(r.id)), 1);
  const slot: MealSlot = dayEntries.some((e) => e.slot === "dinner") ? "snack" : "dinner";

  function plan() {
    if (!best) return;
    startTransition(async () => {
      const result = await addPlanEntryAction({ date, slot, recipe_id: best.id, servings: best.servings });
      if (result.ok) toast.success(`${best.title} eingeplant (${SLOT_LABELS[slot]}).`);
      else toast.error(result.message);
    });
  }

  return (
    <section className="flex items-center gap-3 rounded-3xl border border-primary/30 bg-primary/10 p-3.5" aria-label="Lücke beim Protein">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
        <Target className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="leading-snug font-semibold">Noch {formatNumber(Math.round(gap.protein), 0)} g Protein offen</p>
        {best ? (
          <p className="truncate text-sm text-primary">
            {best.title} · {best.servings === 0.5 ? "½ Portion · " : ""}+{formatNumber(Math.round(best.adds.protein), 0)} g ·{" "}
            {SLOT_LABELS[slot]}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">In deinem Buch passt gerade nichts, ohne über das Ziel zu kommen.</p>
        )}
      </div>
      {best ? (
        <button
          type="button"
          onClick={plan}
          disabled={pending}
          aria-label={`${best.title} einplanen (${SLOT_LABELS[slot]})`}
          className="inline-flex h-11 shrink-0 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
        >
          Einplanen
        </button>
      ) : null}
    </section>
  );
}

/** Unter dem Tagesziel: übrige Meal-Prep-Portionen und Reste-Ideen. */
export function DayExtras({
  date,
  dayEntries,
  batches,
  ideas,
  onPlan,
}: {
  date: string;
  dayEntries: PlanEntry[];
  batches: PlanBatch[];
  ideas: LeftoverIdea[];
  onPlan: (target: SlotTarget) => void;
}) {
  const open = openBatchesFor(date, batches);
  if (open.length === 0 && ideas.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3">
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
