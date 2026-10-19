import { CATEGORY_LABELS, type AutoTag } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";
import { entryMacros, type DayMacros } from "./plan";

// Statistiken über das eigene Rezeptbuch und den Wochenplan. Reine Logik, getestet.

export type StatsRecipe = {
  id: string;
  title: string;
  category: Enums<"recipe_category"> | null;
  servings: number;
  isMealPrep: boolean;
  ingredientCount: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  isHighProtein: boolean;
  isLowCarb: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  /** Gramm je Zutatengruppe für das ganze Rezept */
  gramsByFoodGroup: Partial<Record<Enums<"food_group">, number>>;
};

/** Nur Rezepte mit Zutaten haben Nährwerte. */
export function withNutrition(recipes: StatsRecipe[]) {
  return recipes.filter((r) => r.ingredientCount > 0);
}

// ---------------------------------------------------------------------------
// Kategorien (Donut): die größten Kategorien einzeln, der Rest als „Weitere“
// ---------------------------------------------------------------------------

export type CategoryKey = Enums<"recipe_category"> | "none";

export type CategorySlice = {
  key: CategoryKey | "other";
  label: string;
  count: number;
  /** 1–5 = feste Diagrammfarbe, null = Grau („Weitere“) */
  colorSlot: number | null;
  /** Kategorien in „Weitere“ */
  members: CategoryKey[];
};

export const MAX_CATEGORY_SLICES = 5;

export function categoryLabel(key: CategoryKey): string {
  return key === "none" ? "Ohne Kategorie" : CATEGORY_LABELS[key];
}

export function categorySlices(recipes: StatsRecipe[], maxSlices = MAX_CATEGORY_SLICES): CategorySlice[] {
  const counts = new Map<CategoryKey, number>();
  for (const r of recipes) {
    const key: CategoryKey = r.category ?? "none";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || categoryLabel(a[0]).localeCompare(categoryLabel(b[0]), "de"));

  // Passt alles hinein, kein „Weitere“; sonst die letzte Scheibe für „Weitere“ freihalten
  const direct = sorted.length <= maxSlices ? sorted : sorted.slice(0, maxSlices - 1);
  const rest = sorted.slice(direct.length);

  const slices: CategorySlice[] = direct.map(([key, count], i) => ({
    key,
    label: categoryLabel(key),
    count,
    colorSlot: i + 1,
    members: [key],
  }));
  if (rest.length > 0) {
    slices.push({
      key: "other",
      label: "Weitere",
      count: rest.reduce((sum, [, c]) => sum + c, 0),
      colorSlot: null,
      members: rest.map(([key]) => key),
    });
  }
  return slices;
}

/** Alle Kategorien mit Anzahl (für die Tabelle neben dem Donut). */
export function categoryTable(recipes: StatsRecipe[]): { key: CategoryKey; label: string; count: number }[] {
  const counts = new Map<CategoryKey, number>();
  for (const r of recipes) counts.set(r.category ?? "none", (counts.get(r.category ?? "none") ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: categoryLabel(key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "de"));
}

// ---------------------------------------------------------------------------
// Auto-Tags: Anteil der Rezepte
// ---------------------------------------------------------------------------

export const AUTO_TAG_ORDER: AutoTag[] = ["high_protein", "vegetarian", "vegan", "low_carb", "meal_prep"];

export function hasAutoTag(r: StatsRecipe, tag: AutoTag): boolean {
  switch (tag) {
    case "high_protein":
      return r.isHighProtein;
    case "vegetarian":
      return r.isVegetarian;
    case "vegan":
      return r.isVegan;
    case "low_carb":
      return r.isLowCarb;
    case "meal_prep":
      return r.isMealPrep;
  }
}

export function autoTagShares(recipes: StatsRecipe[]): { tag: AutoTag; count: number; share: number }[] {
  const total = recipes.length;
  return AUTO_TAG_ORDER.map((tag) => {
    const count = recipes.filter((r) => hasAutoTag(r, tag)).length;
    return { tag, count, share: total ? count / total : 0 };
  });
}

// ---------------------------------------------------------------------------
// Zusammensetzung nach Zutatengruppe (gestapelte Balken), pro Portion
// ---------------------------------------------------------------------------

export const COMPOSITION_BUCKETS = [
  { key: "veg", label: "Gemüse & Obst", groups: ["vegetables", "fruit"] },
  { key: "grains", label: "Getreide, Pasta, Reis", groups: ["grains"] },
  { key: "meatfish", label: "Fleisch & Fisch", groups: ["meat", "fish"] },
  { key: "dairy", label: "Milch & Ei", groups: ["dairy", "egg"] },
  { key: "legumes", label: "Hülsenfrüchte & Nüsse", groups: ["legumes", "nuts_seeds"] },
  { key: "rest", label: "Sonstiges", groups: ["oils_fats", "spices_sauces", "syrups_juices", "spirits", "liqueurs_wine", "other"] },
] as const satisfies readonly { key: string; label: string; groups: readonly Enums<"food_group">[] }[];

export type BucketKey = (typeof COMPOSITION_BUCKETS)[number]["key"];

export type CompositionRow = { id: string; title: string; total: number } & Record<BucketKey, number>;

export function compositionRows(recipes: StatsRecipe[], sortBy: BucketKey | "total" = "veg"): CompositionRow[] {
  const rows = withNutrition(recipes).map((r) => {
    const perServing = (group: Enums<"food_group">) => (r.gramsByFoodGroup[group] ?? 0) / (r.servings || 1);
    const row = { id: r.id, title: r.title, total: 0 } as CompositionRow;
    for (const bucket of COMPOSITION_BUCKETS) {
      const value = Math.round(bucket.groups.reduce((sum, g) => sum + perServing(g), 0));
      row[bucket.key] = value;
      row.total += value;
    }
    return row;
  });
  return rows.sort((a, b) => b[sortBy] - a[sortBy] || a.title.localeCompare(b.title, "de"));
}

// ---------------------------------------------------------------------------
// Durchschnittliche Makroverteilung (Anteil an den kcal aus Makros)
// ---------------------------------------------------------------------------

export function averageMacroDistribution(recipes: StatsRecipe[]) {
  const list = withNutrition(recipes);
  if (list.length === 0) return null;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  for (const r of list) {
    const energy = r.protein * 4 + r.carbs * 4 + r.fat * 9;
    if (energy <= 0) continue;
    protein += (r.protein * 4) / energy;
    carbs += (r.carbs * 4) / energy;
    fat += (r.fat * 9) / energy;
  }
  const n = list.length;
  return {
    recipes: n,
    shares: { protein: protein / n, carbs: carbs / n, fat: fat / n },
    perServing: {
      kcal: list.reduce((s, r) => s + r.kcal, 0) / n,
      protein: list.reduce((s, r) => s + r.protein, 0) / n,
      carbs: list.reduce((s, r) => s + r.carbs, 0) / n,
      fat: list.reduce((s, r) => s + r.fat, 0) / n,
    },
  };
}

// ---------------------------------------------------------------------------
// Wochenplan: Durchschnitt pro geplantem Tag, Woche für Woche
// ---------------------------------------------------------------------------

export type StatsPlanEntry = {
  date: string;
  recipeId: string;
  servings: number;
  perServing: DayMacros | null;
};

export type WeekPoint = { monday: string; plannedDays: number; kcal: number | null; protein: number | null };

/** mondays aufsteigend; Wochen ohne Planung bekommen null (Lücke in der Linie). */
export function weeklyPlanSeries(entries: StatsPlanEntry[], mondays: string[], mondayOf: (iso: string) => string): WeekPoint[] {
  return mondays.map((monday) => {
    const week = entries.filter((e) => mondayOf(e.date) === monday);
    const days = new Set(week.map((e) => e.date));
    if (days.size === 0) return { monday, plannedDays: 0, kcal: null, protein: null };
    const sum = week.reduce(
      (acc, e) => {
        const m = entryMacros(e);
        return { kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein };
      },
      { kcal: 0, protein: 0 },
    );
    return { monday, plannedDays: days.size, kcal: sum.kcal / days.size, protein: sum.protein / days.size };
  });
}

/** Wie oft welches Rezept eingeplant wurde (Anzahl Einträge), die häufigsten zuerst. */
export function mostPlanned(entries: StatsPlanEntry[], titles: Map<string, string>, top = 5) {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.recipeId, (counts.get(e.recipeId) ?? 0) + 1);
  return [...counts.entries()]
    .map(([recipeId, count]) => ({ recipeId, title: titles.get(recipeId) ?? "Rezept", count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "de"))
    .slice(0, top);
}

// ---------------------------------------------------------------------------
// Auswahl durch Klick ins Diagramm → Rezeptliste darunter
// ---------------------------------------------------------------------------

export type StatsSelection =
  | { kind: "category"; label: string; members: CategoryKey[] }
  | { kind: "tag"; label: string; tag: AutoTag }
  | { kind: "recipes"; label: string; ids: string[] };

export function applySelection(recipes: StatsRecipe[], selection: StatsSelection | null): StatsRecipe[] {
  if (!selection) return recipes;
  switch (selection.kind) {
    case "category":
      return recipes.filter((r) => selection.members.includes(r.category ?? "none"));
    case "tag":
      return recipes.filter((r) => hasAutoTag(r, selection.tag));
    case "recipes":
      return recipes.filter((r) => selection.ids.includes(r.id));
  }
}
