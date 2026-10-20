import Link from "next/link";
import { Euro } from "lucide-react";
import { missingPricesText } from "@/lib/domain/costs";
import { formatEuro } from "@/lib/format";
import type { RecipeCost as Cost } from "@/lib/server/kitchen-log";

/** Kosten gesamt und pro Portion nach den eigenen Preisen; fehlende Preise werden offen genannt. */
export function RecipeCost({ cost, unit = "Portion" }: { cost: Cost | null; unit?: "Portion" | "Drink" }) {
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
          <Link href="/preise" className="font-medium text-primary underline-offset-4 hover:underline">
            Preise eintragen
          </Link>
        </p>
      ) : (
        <>
          <p className="text-sm">
            {missing ? "mindestens " : "ca. "}
            <span className="font-heading text-2xl font-semibold">{formatEuro(cost.perServing)}</span> pro {unit} ·{" "}
            {formatEuro(cost.total)} gesamt
          </p>
          {missing ? (
            <p className="text-xs text-muted-foreground">
              {missing}.{" "}
              <Link href="/preise" className="font-medium text-primary underline-offset-4 hover:underline">
                Preise ergänzen
              </Link>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
