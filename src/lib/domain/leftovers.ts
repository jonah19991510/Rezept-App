import { addDays } from "./week";

// Phase 11: Reste-Vorschläge. Kocht man an einem Tag etwas mit Reis, Nudeln oder Kartoffeln, bleibt oft
// etwas übrig; für die zwei Folgetage schlägt der Plan eigene Rezepte vor, die dieselbe Basis verwenden
// (z. B. Bratreis aus Reis vom Vortag).

export type BaseKey = "rice" | "pasta" | "potatoes";

export const BASE_LABELS: Record<BaseKey, string> = { rice: "Reis", pasta: "Nudeln", potatoes: "Kartoffeln" };

const PASTA = new Set([
  "pasta",
  "spaghetti",
  "penne",
  "fusilli",
  "farfalle",
  "tagliatelle",
  "makkaroni",
  "maccheroni",
  "rigatoni",
  "linguine",
  "orecchiette",
  "conchiglie",
  "gnocchi",
  "spätzle",
]);

function tokens(name: string): string[] {
  return name
    .toLocaleLowerCase("de-DE")
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
}

/** Basis-Zutat, die sich als Rest eignet, oder null. Erkennt z. B. „Basmatireis“, „Vollkornnudeln“, „Kartoffeln, festkochend“. */
export function baseOf(ingredientName: string): BaseKey | null {
  for (const t of tokens(ingredientName)) {
    if (t === "süßkartoffel" || t === "süßkartoffeln" || t.endsWith("stärke")) return null;
    if (t.endsWith("reis") && t !== "preis") return "rice";
    if (t.endsWith("nudeln") || t.endsWith("nudel") || PASTA.has(t)) return "pasta";
    if (t.endsWith("kartoffeln") || t.endsWith("kartoffel") || t === "drillinge") return "potatoes";
  }
  return null;
}

/** Alle Basen eines Rezepts (aus den Zutatennamen). */
export function recipeBases(ingredientNames: string[]): BaseKey[] {
  const found = new Set<BaseKey>();
  for (const name of ingredientNames) {
    const base = baseOf(name);
    if (base) found.add(base);
  }
  return [...found];
}

export type LeftoverIdea = {
  base: BaseKey;
  /** Tag, an dem die Basis gekocht wurde */
  fromDate: string;
  recipes: { id: string; title: string }[];
};

/**
 * Vorschläge für `date`: Basen, die an den zwei Vortagen gekocht wurden, und eigene Rezepte damit.
 * Nichts vorschlagen, wenn an `date` schon ein Rezept mit dieser Basis geplant ist; Rezepte, die an den drei
 * Tagen schon vorkommen, fallen weg. Höchstens `limit` Rezepte je Basis, Favoriten zuerst.
 */
export function leftoverIdeas(
  date: string,
  plannedByDate: Record<string, string[]>,
  basesByRecipe: Record<string, BaseKey[]>,
  candidates: { id: string; title: string; isFavorite: boolean }[],
  limit = 3,
): LeftoverIdea[] {
  const today = plannedByDate[date] ?? [];
  const usedToday = new Set(today.flatMap((id) => basesByRecipe[id] ?? []));
  const recent = new Set([...today, ...(plannedByDate[addDays(date, -1)] ?? []), ...(plannedByDate[addDays(date, -2)] ?? [])]);
  const ideas: LeftoverIdea[] = [];
  const seen = new Set<BaseKey>();
  for (const offset of [-1, -2]) {
    const fromDate = addDays(date, offset);
    for (const recipeId of plannedByDate[fromDate] ?? []) {
      for (const base of basesByRecipe[recipeId] ?? []) {
        if (seen.has(base) || usedToday.has(base)) continue;
        seen.add(base);
        const recipes = candidates
          .filter((c) => !recent.has(c.id) && (basesByRecipe[c.id] ?? []).includes(base))
          .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.title.localeCompare(b.title, "de"))
          .slice(0, limit)
          .map(({ id, title }) => ({ id, title }));
        if (recipes.length > 0) ideas.push({ base, fromDate, recipes });
      }
    }
  }
  return ideas;
}
