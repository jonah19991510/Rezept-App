import { Euro } from "lucide-react";
import { MissingPrices, type MissingPrice } from "@/components/prices/missing-prices";
import { missingPricesText } from "@/lib/domain/costs";
import { formatEuro } from "@/lib/format";
import type { RecipeCost as Cost } from "@/lib/server/kitchen-log";

/**
 * Kosten pro Portion und gesamt nach den eigenen Preisen; fehlende Preise werden offen genannt. „Gesamt“ folgt dem
 * Portionen-Schalter des Rezepts (`factor` = gewählte / Rezeptportionen), pro Portion bleibt gleich.
 */
export function RecipeCost({
  cost,
  missingPrices,
  unit = "Portion",
  factor = 1,
  totalLabel,
}: {
  cost: Cost | null;
  /** Zutaten, die noch nicht in die Kosten eingehen („Preise ergänzen“ zeigt sie zum Eintragen) */
  missingPrices: MissingPrice[];
  unit?: "Portion" | "Drink";
  factor?: number;
  /** z. B. „für 4 Portionen“ */
  totalLabel?: string;
}) {
  if (!cost || cost.count === 0) return null;
  const missing = missingPricesText(cost.priced, cost.count);

  return (
    <section aria-labelledby="kosten" className="space-y-2 rounded-3xl border bg-card p-4 md:p-5">
      <h2 id="kosten" className="flex items-center gap-2 text-xl font-semibold">
        <Euro className="size-5 text-primary" aria-hidden />
        Kosten
      </h2>
      {cost.priced === 0 ? (
        <p className="text-sm text-muted-foreground">
          Für keine Zutat ist ein Preis hinterlegt.{" "}
          <MissingPrices items={missingPrices} label="Preise eintragen" />
        </p>
      ) : (
        <>
          <p className="text-sm">
            {missing ? "mindestens " : "ca. "}
            <span className="font-heading text-2xl font-semibold">{formatEuro(cost.perServing)}</span> pro {unit} ·{" "}
            <span aria-live="polite">
              {formatEuro(cost.total * factor)} gesamt{totalLabel ? ` ${totalLabel}` : ""}
            </span>
          </p>
          {missing ? (
            <p className="text-xs text-muted-foreground">
              {missing}.{" "}
              <MissingPrices items={missingPrices} label="Preise ergänzen" />
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
