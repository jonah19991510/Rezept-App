import type { Enums } from "@/lib/supabase/database.types";
import type { CookRecipe } from "./pantry";
import { UNIT_ML, type Unit } from "./units";

// Phase 15: Cocktails. Alkoholgehalt pro Drink (dieselbe Formel steht in der Postgres-View recipe_alcohol,
// Liste, Statistik und geteilte Karte lesen aus der View; Editor und Tests rechnen hier), Basisspirituose,
// „Was kann ich mixen?“ mit der einen Flasche, die die meisten neuen Cocktails freischaltet.

export type CocktailMethod = Enums<"cocktail_method">;
export type Glass = Enums<"glass">;
export type FoodGroup = Enums<"food_group">;

/** Verdünnung durch Eis je Methode (Anteil des Volumens). Zentral in app_config „cocktail_dilution“. */
export type DilutionConfig = Record<CocktailMethod, number>;

export const DEFAULT_DILUTION: DilutionConfig = { stirred: 0.2, shaken: 0.25, built: 0.1, blended: 0.3 };

/** Dichte von Ethanol in g/ml (für Gramm Alkohol). */
export const ETHANOL_DENSITY = 0.789;

/** Zutatengruppen, die als Getränk zählen (Volumen auch aus Gramm, Bar-Bestand, „Flasche“). */
export const BAR_GROUPS: ReadonlySet<FoodGroup> = new Set<FoodGroup>(["spirits", "liqueurs_wine", "syrups_juices"]);

export function isBarGroup(group: FoodGroup): boolean {
  return BAR_GROUPS.has(group);
}

/** Verdünnung aus den app_config-Zeilen (fehlende oder unplausible Werte → Standard). */
export function dilutionFromConfig(rows: { key: string; value: unknown }[]): DilutionConfig {
  const raw = rows.find((r) => r.key === "cocktail_dilution")?.value;
  const result = { ...DEFAULT_DILUTION };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const method of Object.keys(result) as CocktailMethod[]) {
      const value = (raw as Record<string, unknown>)[method];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1) result[method] = value;
    }
  }
  return result;
}

export type AlcoholIngredient = {
  abv: number | null;
  food_group: FoodGroup;
  density_g_per_ml: number | null;
};

export type AlcoholLine = { amount: number | null; unit: Unit | null; ingredient: AlcoholIngredient };

/**
 * Flüssigkeitsmenge einer Zeile in ml. Volumen-Einheiten über feste Werte (cl, Dash, Barlöffel …),
 * Gramm nur bei Getränkezutaten (über die Dichte). Stück und Prise (Limettenspalte, Minze) zählen nicht.
 */
export function lineVolumeMl(line: AlcoholLine): number {
  const { amount, unit, ingredient } = line;
  if (amount == null || !Number.isFinite(amount) || amount <= 0 || !unit) return 0;
  const ml = UNIT_ML[unit];
  if (ml != null) return amount * ml;
  if (unit === "g" && (ingredient.abv != null || isBarGroup(ingredient.food_group))) {
    const density = ingredient.density_g_per_ml && ingredient.density_g_per_ml > 0 ? ingredient.density_g_per_ml : 1;
    return amount / density;
  }
  return 0;
}

export type AlcoholResult = {
  /** Verdünnung, die angewendet wurde (0 ohne Methode) */
  dilution: number;
  /** Volumen im Glas pro Drink inkl. Schmelzwasser, ml */
  drinkVolumeMl: number;
  alcoholMlPerDrink: number;
  alcoholGramsPerDrink: number;
  /** Alkoholgehalt des fertigen (verdünnten) Drinks in % vol */
  abvPercent: number;
};

const round = (value: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/**
 * Alkoholgehalt pro Drink: Alkohol (ml) = Σ Volumen × abv / 100; % vol = Alkohol / (Volumen × (1 + Verdünnung)).
 * Gramm = ml × 0,789. Gerundet wie in der View (Volumen und Gramm 1 Stelle, ml 2 Stellen, % vol 1 Stelle).
 */
export function computeAlcohol(
  lines: AlcoholLine[],
  method: CocktailMethod | null,
  servings: number,
  config: DilutionConfig = DEFAULT_DILUTION,
): AlcoholResult {
  const drinks = servings > 0 ? servings : 1;
  let volume = 0;
  let alcohol = 0;
  for (const line of lines) {
    const ml = lineVolumeMl(line);
    volume += ml;
    alcohol += (ml * (line.ingredient.abv ?? 0)) / 100;
  }
  const dilution = method ? config[method] : 0;
  const diluted = volume * (1 + dilution);
  return {
    dilution,
    drinkVolumeMl: round(diluted / drinks, 1),
    alcoholMlPerDrink: round(alcohol / drinks, 2),
    alcoholGramsPerDrink: round((alcohol * ETHANOL_DENSITY) / drinks, 1),
    abvPercent: diluted > 0 ? round((alcohol / diluted) * 100, 1) : 0,
  };
}

/** „Rum, weiß“ → „Rum“, „Tequila (Blanco)“ → „Tequila“: für die Gruppierung nach Basisspirituose. */
export function spiritLabel(name: string): string {
  return name.split(/[,(]/)[0].trim() || name.trim();
}

/**
 * Basisspirituose: die Spirituose mit dem größten Volumen, sonst Likör/Wein mit dem größten Volumen.
 * null bei alkoholfreien Drinks.
 */
export function baseSpirit(lines: (AlcoholLine & { name: string })[]): string | null {
  const pick = (groups: FoodGroup[]) => {
    let best: { name: string; ml: number } | null = null;
    for (const line of lines) {
      if (!groups.includes(line.ingredient.food_group)) continue;
      const ml = lineVolumeMl(line);
      if (ml > 0 && (!best || ml > best.ml)) best = { name: line.name, ml };
    }
    return best ? spiritLabel(best.name) : null;
  };
  return pick(["spirits"]) ?? pick(["liqueurs_wine"]);
}

export const ABV_BUCKETS = [
  { key: "none", label: "alkoholfrei" },
  { key: "light", label: "bis 10 %" },
  { key: "medium", label: "10–20 %" },
  { key: "strong", label: "20–30 %" },
  { key: "very-strong", label: "über 30 %" },
] as const;

export type AbvBucket = (typeof ABV_BUCKETS)[number]["key"];

/** Einordnung für die Statistik: unter 0,5 % alkoholfrei, obere Grenzen jeweils einschließlich. */
export function abvBucket(abvPercent: number): AbvBucket {
  if (abvPercent < 0.5) return "none";
  if (abvPercent <= 10) return "light";
  if (abvPercent <= 20) return "medium";
  if (abvPercent <= 30) return "strong";
  return "very-strong";
}

export type MixRecipe = CookRecipe & {
  lines: (CookRecipe["lines"][number] & { foodGroup: FoodGroup })[];
};

export type BottleHint = { ingredientId: string; name: string; unlocks: string[] };

/**
 * Welche EINE zusätzliche Flasche (Spirituose, Likör/Wein, Sirup/Saft) die meisten neuen Cocktails freischaltet:
 * gezählt werden Cocktails, denen genau diese eine Zutat fehlt. Sortiert nach Anzahl, dann Name.
 */
export function bottleHints(recipes: MixRecipe[], pantryIds: Set<string>): BottleHint[] {
  const byBottle = new Map<string, BottleHint>();
  for (const recipe of recipes) {
    const missing = new Map<string, { name: string; group: FoodGroup }>();
    for (const line of recipe.lines) {
      if (line.isStaple || pantryIds.has(line.ingredientId)) continue;
      missing.set(line.ingredientId, { name: line.name, group: line.foodGroup });
    }
    if (missing.size !== 1) continue;
    const [[id, { name, group }]] = [...missing];
    if (!isBarGroup(group)) continue;
    const hint = byBottle.get(id) ?? { ingredientId: id, name, unlocks: [] };
    hint.unlocks.push(recipe.title);
    byBottle.set(id, hint);
  }
  return [...byBottle.values()]
    .map((h) => ({ ...h, unlocks: [...h.unlocks].sort((a, b) => a.localeCompare(b, "de")) }))
    .sort((a, b) => b.unlocks.length - a.unlocks.length || a.name.localeCompare(b.name, "de"));
}

const METHOD_WORDS: Record<CocktailMethod, string> = { shaken: "geshaked", stirred: "gerührt", built: "gebaut", blended: "geblendet" };

/** Erklärung unter dem Alkoholgehalt, z. B. „geshaked: +25 % Schmelzwasser eingerechnet“. */
export function dilutionNote(method: CocktailMethod | null, dilution: number): string {
  if (!method) return "Ohne Methode ohne Schmelzwasser gerechnet.";
  const percent = Math.round(dilution * 100);
  return percent > 0
    ? `${METHOD_WORDS[method][0].toUpperCase()}${METHOD_WORDS[method].slice(1)}: +${percent} % Schmelzwasser eingerechnet.`
    : `${METHOD_WORDS[method][0].toUpperCase()}${METHOD_WORDS[method].slice(1)}: ohne Schmelzwasser gerechnet.`;
}
