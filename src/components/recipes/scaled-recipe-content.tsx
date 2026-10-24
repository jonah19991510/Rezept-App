"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChefHat, Martini, RotateCcw, TriangleAlert, UtensilsCrossed } from "lucide-react";
import { MacroSummary, type MacroValues } from "@/components/recipes/macro-summary";
import { Button, buttonVariants } from "@/components/ui/button";
import { scaleAmount, scaleFactor } from "@/lib/domain/scaling";
import type { Unit } from "@/lib/domain/units";
import { formatGrams, formatNumber } from "@/lib/format";
import { formatScaledQuantity } from "@/lib/format-quantity";
import { KIND_WORDS, servingsLabel } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import type { MissingPrice } from "@/components/prices/missing-prices";
import type { RecipeCost as Cost } from "@/lib/server/kitchen-log";
import { PortionStepper } from "./portion-stepper";
import { RecipeCost } from "./recipe-cost";

/** Phase 15: Alkoholgehalt pro Drink (aus der View recipe_alcohol) */
export type CocktailFacts = {
  abvPercent: number;
  alcoholGrams: number;
  volumeMl: number;
  /** z. B. „geshaked: +25 % Schmelzwasser eingerechnet“ */
  dilutionNote: string;
};

export type ScalableLine = {
  id: string;
  amount: number | null;
  unit: Unit | null;
  grams: number | null;
  name: string;
  note: string | null;
  /** Optionale Zutat: eigene Liste unter den Zutaten, zählt nicht in den Nährwerten */
  optional?: boolean;
};

/** Knöpfe neben „Kochen starten“ (Bearbeiten, Übernehmen): gleiche Höhe, etwas schmaler */
export const sideActionClass = "h-12 flex-[2_1_8rem] rounded-full";

/** Beilage als Vorschlag; href, wenn es ein passendes Rezept gibt */
export type SideDishLink = { name: string; href: string | null };

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
  actions = null,
  kind = "dish",
  cocktail = null,
  sideDishes = [],
  cost = null,
}: {
  recipeId: string;
  servings: number;
  perServing: MacroValues | null;
  lines: ScalableLine[];
  missingGramsNames: string[];
  steps: ReactNode;
  /** Geteilte Rezeptkarte: ohne Kochmodus (braucht Login und ein lesbares Rezept) */
  showCookButton?: boolean;
  /** neben „Kochen starten“, z. B. Bearbeiten (Klasse `sideActionClass`) */
  actions?: ReactNode;
  /** Phase 15: Cocktail mit Drinks, Mix-Modus und Alkoholgehalt */
  kind?: Enums<"recipe_type">;
  cocktail?: CocktailFacts | null;
  /** Beilagen („Passt dazu“), gehören nicht zum Rezept */
  sideDishes?: SideDishLink[];
  /** Kosten nach eigenen Preisen; „gesamt“ rechnet mit der gewählten Portionenzahl */
  cost?: { cost: Cost | null; missingPrices: MissingPrice[] } | null;
}) {
  const w = KIND_WORDS[kind];
  const isCocktail = kind === "cocktail";
  const [target, setTarget] = useState(servings);
  const factor = scaleFactor(target, servings);
  const changed = target !== servings;
  const portionsLabel = `für ${String(target).replace(".", ",")} ${servingsLabel(target, kind)}`;
  const required = lines.filter((l) => !l.optional);
  const optional = lines.filter((l) => l.optional);

  const renderLine = (line: ScalableLine) => {
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
          {!isCocktail && grams != null && grams >= 1 && line.unit !== "g" ? (
            <span className="block text-xs text-muted-foreground">≈ {formatGrams(grams, 0)}</span>
          ) : null}
        </span>
      </li>
    );
  };

  return (
    <>
      {showCookButton || actions ? (
        // dicht unter dem Kopf der Rezeptseite (der Seitenabstand dort ist größer)
        <div className="-mt-4 flex flex-wrap gap-2">
          {showCookButton ? (
            <Link href={`/kochen/${recipeId}?portionen=${target}`} className={cn(buttonVariants({ size: "lg" }), "h-12 flex-[3_1_10rem] rounded-full")}>
              {isCocktail ? <Martini aria-hidden /> : <ChefHat aria-hidden />}
              {w.start}
            </Link>
          ) : null}
          {actions}
        </div>
      ) : null}

      {cocktail ? (
        <section aria-labelledby="alkohol" className="rounded-3xl border bg-card p-4 md:p-5">
          <h2 id="alkohol" className="mb-3 flex items-baseline justify-between gap-3 text-xl font-semibold">
            Pro Drink
            {perServing ? <KcalAside kcal={perServing.kcal} /> : null}
          </h2>
          <dl className="grid grid-cols-3 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground">Alkoholgehalt</dt>
              <dd className="font-heading text-xl font-semibold whitespace-nowrap tabular-nums sm:text-2xl">{formatNumber(cocktail.abvPercent, 1)} % vol</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Alkohol</dt>
              <dd className="font-heading text-xl font-semibold whitespace-nowrap tabular-nums sm:text-2xl">{formatNumber(cocktail.alcoholGrams, 1)} g</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Im Glas</dt>
              <dd className="font-heading text-xl font-semibold whitespace-nowrap tabular-nums sm:text-2xl">≈ {formatNumber(Math.round(cocktail.volumeMl), 0)} ml</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">{cocktail.dilutionNote}</p>
          {perServing ? (
            <div className="mt-4 border-t pt-4">
              <MacroSummary
                values={perServing}
                hideKcal
                caption="pro Drink"
                total={{
                  kcal: perServing.kcal * target,
                  protein: perServing.protein * target,
                  carbs: perServing.carbs * target,
                  fat: perServing.fat * target,
                }}
                totalLabel={portionsLabel}
              />
            </div>
          ) : null}
        </section>
      ) : perServing ? (
        <section aria-labelledby="makros" className="rounded-3xl border bg-card p-4 md:p-5">
          <h2 id="makros" className="mb-3 flex items-baseline justify-between gap-3 text-xl font-semibold">
            Pro Portion
            <KcalAside kcal={perServing.kcal} />
          </h2>
          <MacroSummary
            values={perServing}
            hideKcal
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
            <PortionStepper value={target} onChange={setTarget} kind={kind} />
          </div>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Zutaten eingetragen.</p>
          ) : (
            <>
              {required.length > 0 ? (
                <ul className={cn("divide-y rounded-2xl border bg-card", changed && "border-primary/40")} aria-live="polite">
                  {required.map(renderLine)}
                </ul>
              ) : null}
              {optional.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Optional</h3>
                  <ul
                    className={cn("divide-y rounded-2xl border border-dashed bg-card", changed && "border-primary/40")}
                    aria-live="polite"
                  >
                    {optional.map(renderLine)}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Zählen nicht in den Nährwerten{isCocktail ? " und im Alkoholgehalt" : ""} und kommen nicht auf die Einkaufsliste.
                  </p>
                </div>
              ) : null}
            </>
          )}
          {changed ? (
            <p className="text-xs text-muted-foreground">
              Umgerechnet {portionsLabel}, sinnvoll gerundet. Gespeichert wird nichts.
            </p>
          ) : null}
          {missingGramsNames.length > 0 ? (
            <p className="flex gap-2 text-sm text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Für {missingGramsNames.join(", ")} fehlt das Gewicht. {missingGramsNames.length === 1 ? "Diese Zutat zählt" : "Diese Zutaten zählen"} in den Nährwerten nicht mit.
            </p>
          ) : null}
          {sideDishes.length > 0 ? (
            <div className="space-y-2 rounded-2xl bg-muted/50 p-4 break-inside-avoid">
              <h3 className="flex items-center gap-1.5 font-semibold">
                <UtensilsCrossed className="size-4 text-primary" aria-hidden />
                Passt dazu
              </h3>
              <ul className="flex flex-wrap gap-2">
                {sideDishes.map((side) => (
                  <li key={side.name} className="max-w-full">
                    {side.href ? (
                      <Link
                        href={side.href}
                        className="inline-flex min-h-9 max-w-full items-center rounded-full border border-primary/40 bg-card px-3 text-sm text-primary hover:bg-primary/10"
                      >
                        <span className="truncate">{side.name}</span>
                      </Link>
                    ) : (
                      <span className="inline-flex min-h-9 max-w-full items-center rounded-full border bg-card px-3 text-sm">
                        <span className="truncate">{side.name}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Vorschläge, gehören nicht zum Rezept und zählen nicht in den Nährwerten.</p>
            </div>
          ) : null}
        </section>

        {steps}
      </div>

      {cost ? (
        <RecipeCost
          cost={cost.cost}
          missingPrices={cost.missingPrices}
          unit={isCocktail ? "Drink" : "Portion"}
          factor={factor}
          totalLabel={portionsLabel}
        />
      ) : null}
    </>
  );
}

/** „780 kcal“ rechts in der Überschrift der Nährwert-Karte */
function KcalAside({ kcal }: { kcal: number }) {
  return (
    <span className="shrink-0 tabular-nums">
      {formatNumber(Math.round(kcal), 0)} <span className="font-sans text-sm font-normal text-muted-foreground">kcal</span>
    </span>
  );
}
