"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChefHat, RotateCcw, TriangleAlert } from "lucide-react";
import { MacroSummary, type MacroValues } from "@/components/recipes/macro-summary";
import { Button, buttonVariants } from "@/components/ui/button";
import { scaleAmount, scaleFactor } from "@/lib/domain/scaling";
import type { Unit } from "@/lib/domain/units";
import { formatGrams } from "@/lib/format";
import { formatScaledQuantity } from "@/lib/format-quantity";
import { cn } from "@/lib/utils";
import { PortionStepper } from "./portion-stepper";

export type ScalableLine = {
  id: string;
  amount: number | null;
  unit: Unit | null;
  grams: number | null;
  name: string;
  note: string | null;
};

/**
 * Nährwerte und Zutaten mit Portionen-Schalter. Das Skalieren ist nur eine Ansicht:
 * gespeichert wird nichts. Die Schritte (unverändert) kommen als `steps` herein.
 */
export function ScaledRecipeContent({
  recipeId,
  servings,
  perServing,
  lines,
  missingGramsNames,
  steps,
  showCookButton = true,
}: {
  recipeId: string;
  servings: number;
  perServing: MacroValues | null;
  lines: ScalableLine[];
  missingGramsNames: string[];
  steps: ReactNode;
  /** Geteilte Rezeptkarte: ohne Kochmodus (braucht Login und ein lesbares Rezept) */
  showCookButton?: boolean;
}) {
  const [target, setTarget] = useState(servings);
  const factor = scaleFactor(target, servings);
  const changed = target !== servings;
  const portionsLabel = `für ${String(target).replace(".", ",")} ${target === 1 ? "Portion" : "Portionen"}`;

  return (
    <>
      {showCookButton ? (
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/kochen/${recipeId}?portionen=${target}`} className={buttonVariants({ size: "lg" })}>
            <ChefHat aria-hidden />
            Kochen starten
          </Link>
        </div>
      ) : null}

      {perServing ? (
        <section aria-labelledby="makros" className="rounded-3xl border bg-card p-4 md:p-5">
          <h2 id="makros" className="mb-3 text-xl font-semibold">
            Nährwerte
          </h2>
          <MacroSummary
            values={perServing}
            total={{
              kcal: perServing.kcal * target,
              protein: perServing.protein * target,
              carbs: perServing.carbs * target,
              fat: perServing.fat * target,
            }}
            totalLabel={portionsLabel}
          />
        </section>
      ) : null}

      <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-labelledby="zutaten" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="zutaten" className="text-xl font-semibold">
              Zutaten
            </h2>
            {changed ? (
              <Button type="button" variant="ghost" size="sm" className="print:hidden" onClick={() => setTarget(servings)}>
                <RotateCcw aria-hidden />
                Original ({String(servings).replace(".", ",")})
              </Button>
            ) : null}
          </div>
          <div className="print:hidden">
            <PortionStepper value={target} onChange={setTarget} />
          </div>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Zutaten eingetragen.</p>
          ) : (
            <ul className={cn("divide-y rounded-2xl border bg-card", changed && "border-primary/40")} aria-live="polite">
              {lines.map((line) => {
                const scaled = scaleAmount(line.amount, line.unit, factor);
                const grams = line.grams != null ? line.grams * factor : null;
                return (
                  <li key={line.id} className="flex gap-3 px-4 py-3">
                    <span className="w-24 shrink-0 font-medium tabular-nums">
                      {formatScaledQuantity(scaled.amount, line.unit, scaled.approx) || "–"}
                    </span>
                    <span className="min-w-0">
                      {line.name}
                      {line.note ? <span className="text-muted-foreground">, {line.note}</span> : null}
                      {grams != null && grams >= 1 && line.unit !== "g" ? (
                        <span className="block text-xs text-muted-foreground">≈ {formatGrams(grams, 0)}</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {changed ? (
            <p className="text-xs text-muted-foreground">
              Umgerechnet {portionsLabel}, sinnvoll gerundet. Gespeichert wird nichts.
            </p>
          ) : null}
          {missingGramsNames.length > 0 ? (
            <p className="flex gap-2 text-sm text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Für {missingGramsNames.join(", ")} fehlt das Gewicht. Diese Zutaten zählen in den Nährwerten nicht mit.
            </p>
          ) : null}
        </section>

        {steps}
      </div>
    </>
  );
}
