import type { Metadata } from "next";
import { ShoppingBasket } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { GenerateDialog, type RangePreset } from "@/components/shopping/generate-dialog";
import { ShoppingList } from "@/components/shopping/shopping-list";
import { ShoppingTabs } from "@/components/shopping/shopping-tabs";
import { requireUser } from "@/lib/auth";
import { addDays, mondayOf, todayInBerlin } from "@/lib/domain/week";
import { missingPricesText, shoppingEstimate } from "@/lib/domain/costs";
import { coverShoppingItem, type PantryAmount } from "@/lib/domain/pantry";
import { formatEuro } from "@/lib/format";
import { getPrices } from "@/lib/server/kitchen-log";
import { getPantry } from "@/lib/server/pantry";
import { getShoppingList } from "@/lib/server/shopping";

export const metadata: Metadata = { title: "Einkauf" };

export default async function ShoppingPage() {
  const user = await requireUser();
  const [{ items, hideStaples }, pantry, prices] = await Promise.all([getShoppingList(user.id), getPantry(user.id), getPrices(user.id)]);
  // Vorrat je Zutat (Küche und Bar zusammen) für „hast du schon“
  const pantryByIngredient: Record<string, PantryAmount[]> = {};
  for (const p of pantry) (pantryByIngredient[p.ingredientId] ??= []).push({ amount: p.amount, unit: p.unit });

  const today = todayInBerlin();
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const presets: RangePreset[] = [
    ...(today !== sunday ? [{ label: "Rest dieser Woche", from: today, to: sunday }] : []),
    { label: "Ganze Woche", from: monday, to: sunday },
    { label: "Nächste Woche", from: addDays(monday, 7), to: addDays(monday, 13) },
    { label: "Nächste 7 Tage", from: today, to: addDays(today, 6) },
  ];

  // Was noch gekauft werden muss (teilweise im Vorrat: nur der Rest)
  const toBuy = items.flatMap((i) => {
    if (i.checked || (hideStaples && i.isStaple)) return [];
    const cov = i.ingredientId ? coverShoppingItem(i, pantryByIngredient[i.ingredientId] ?? []) : null;
    if (cov?.status === "have") return [];
    return [{ ...i, amount: cov?.status === "partial" ? cov.remaining : i.amount }];
  });
  const openCount = toBuy.length;

  // Phase 12: geschätzte Kosten, falls Preise hinterlegt sind
  const estimate = shoppingEstimate(
    toBuy,
    new Map(prices.flatMap((p) => (p.perGram != null ? [[p.ingredientId, { perGram: p.perGram, info: p.info }] as const] : []))),
  );
  const missing = missingPricesText(estimate.priced, estimate.count);
  const generate = <GenerateDialog presets={presets} hasPlanItems={items.some((i) => i.source === "plan")} />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Einkauf"
        description={items.length > 0 ? `${openCount} ${openCount === 1 ? "Sache" : "Sachen"} noch zu besorgen` : undefined}
        actions={generate}
      />
      <ShoppingTabs active="/einkauf" />
      {estimate.priced > 0 ? (
        <p className="mb-4 rounded-2xl bg-muted/60 px-4 py-2.5 text-sm">
          Geschätzt {missing ? "mindestens" : "ca."} <span className="font-semibold">{formatEuro(estimate.total)}</span>
          {missing ? <span className="text-muted-foreground"> · {missing}</span> : null}
        </p>
      ) : null}
      {items.length === 0 ? (
        <div className="space-y-6">
          <EmptyState icon={ShoppingBasket} title="Die Einkaufsliste ist leer">
            Erstell sie aus deinem Wochenplan („Aus Wochenplan“) oder trag unten selbst etwas ein. Gleiche Zutaten werden
            zusammengerechnet und nach Supermarkt-Abteilung sortiert.
          </EmptyState>
          <ShoppingList items={items} hideStaples={hideStaples} pantry={pantryByIngredient} today={today} />
        </div>
      ) : (
        <ShoppingList items={items} hideStaples={hideStaples} pantry={pantryByIngredient} today={today} />
      )}
    </div>
  );
}
