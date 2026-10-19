import type { Unit } from "./units";

// Phase 12: Kosten. Preise trägt jeder Nutzer selbst ein (Preis für eine Packung, z. B. 3,49 € für 500 g).
// Daraus ein Preis pro Gramm; Rezeptkosten rechnet die View `recipe_costs` genauso (Gramm × Preis pro Gramm).

/** Einheiten, in denen man eine Packung angeben kann */
export const PRICE_UNITS = ["g", "ml", "piece"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];
export const PRICE_UNIT_LABELS: Record<PriceUnit, string> = { g: "g", ml: "ml", piece: "Stück" };

export type IngredientWeights = { density_g_per_ml: number | null; piece_weight_g: number | null };

/** Packungsinhalt in Gramm; null, wenn er sich nicht umrechnen lässt (Stück ohne Stückgewicht). */
export function packageGrams(amount: number, unit: Unit, info: IngredientWeights): number | null {
  switch (unit) {
    case "g":
      return amount;
    case "ml":
      return amount * (info.density_g_per_ml ?? 1);
    case "cl":
      return amount * 10 * (info.density_g_per_ml ?? 1);
    case "piece":
      return info.piece_weight_g ? amount * info.piece_weight_g : null;
    default:
      return null;
  }
}

/** Preis pro Gramm aus einer Packungsangabe. */
export function pricePerGram(price: { price: number; packageAmount: number; packageUnit: Unit }, info: IngredientWeights): number | null {
  const grams = packageGrams(price.packageAmount, price.packageUnit, info);
  return grams && grams > 0 ? price.price / grams : null;
}

/** Kosten von Rezeptzeilen (Gramm je Zeile) mit Anzahl der Zeilen ohne Preis. */
export function linesCost(lines: { ingredientId: string; grams: number | null }[], perGram: Map<string, number>) {
  let total = 0;
  let priced = 0;
  for (const line of lines) {
    const p = perGram.get(line.ingredientId);
    if (line.grams == null || p == null) continue;
    total += line.grams * p;
    priced++;
  }
  return { total, priced, count: lines.length };
}

/** Menge eines Einkaufslisten-Eintrags (g, ml oder Stück) in Gramm. */
export function shoppingGrams(amount: number | null, unit: string | null, info: IngredientWeights): number | null {
  if (amount == null) return null;
  if (unit === "g") return amount;
  if (unit === "ml") return amount * (info.density_g_per_ml ?? 1);
  if (unit === "Stück") return info.piece_weight_g ? amount * info.piece_weight_g : null;
  return null;
}

/** Geschätzte Kosten der offenen Einkaufsliste. */
export function shoppingEstimate(
  items: { ingredientId: string | null; amount: number | null; unit: string | null }[],
  prices: Map<string, { perGram: number; info: IngredientWeights }>,
) {
  let total = 0;
  let priced = 0;
  for (const item of items) {
    if (!item.ingredientId) continue;
    const p = prices.get(item.ingredientId);
    const grams = p ? shoppingGrams(item.amount, item.unit, p.info) : null;
    if (p == null || grams == null) continue;
    total += grams * p.perGram;
    priced++;
  }
  return { total, priced, count: items.length };
}

/** Preis pro 100 g bzw. 100 ml (für die Preisliste). */
export function pricePer100(perGram: number, unit: PriceUnit, info: IngredientWeights): number {
  return unit === "ml" ? perGram * 100 * (info.density_g_per_ml ?? 1) : perGram * 100;
}

/** „3 von 9 Zutaten ohne Preis“, oder null, wenn alles einen Preis hat. */
export function missingPricesText(priced: number, count: number): string | null {
  const missing = count - priced;
  if (missing <= 0) return null;
  return `${missing} von ${count} ${count === 1 ? "Zutat" : "Zutaten"} ohne Preis`;
}
