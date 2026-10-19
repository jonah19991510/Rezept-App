import type { Enums } from "@/lib/supabase/database.types";

// Umwandlung von Open-Food-Facts-Treffern (search.openfoodfacts.org) in Zutaten-Vorschläge.
// Reine Logik ohne Netzwerk, damit sie testbar ist.

export type OffHit = {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  generic_name_de?: string;
  brands?: string[] | string;
  quantity?: string;
  categories_tags?: string[];
  ingredients_analysis_tags?: string[];
  nutriments?: Record<string, number | string | undefined>;
};

export type IngredientCandidate = {
  externalId: string;
  name: string;
  brand: string | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  food_group: Enums<"food_group">;
  diet: Enums<"ingredient_diet"> | null;
};

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Reihenfolge ist wichtig: Spezielles vor Allgemeinem (z. B. Pflanzendrink vor Milch, Butter = Milchprodukt). */
const GROUP_RULES: [Enums<"food_group">, (tags: string[]) => boolean][] = [
  ["spirits", (t) => t.some((x) => /spirits|liquors|vodkas|gins|rums|whiskies|brandies|tequilas/.test(x))],
  ["liqueurs_wine", (t) => t.some((x) => /liqueurs|wines|vermouths|sparkling-wines/.test(x))],
  ["syrups_juices", (t) => t.some((x) => /syrups|juices|nectars/.test(x))],
  ["other", (t) => t.some((x) => /plant-based-milk|milk-substitute|yogurt-alternative|dairy-substitute/.test(x))],
  ["fish", (t) => t.some((x) => /fishes|seafood|fish-and-seafood|tunas|salmons|shrimps|prawns/.test(x))],
  ["meat", (t) => t.some((x) => /meats|poultries|sausages|hams|chickens|beef|pork/.test(x))],
  ["egg", (t) => t.includes("en:eggs") || t.includes("en:chicken-eggs")],
  ["dairy", (t) => t.some((x) => /dairies|cheeses|yogurts|milks|creams|butters|quarks|skyrs/.test(x))],
  ["legumes", (t) => t.some((x) => /legumes|pulses|lentils|chickpeas|beans|tofus/.test(x))],
  ["nuts_seeds", (t) => t.some((x) => /nuts|seeds|nut-butters|almonds|peanut/.test(x))],
  ["oils_fats", (t) => t.some((x) => /vegetable-oils|olive-oils|fats|oils|margarines/.test(x))],
  ["fruit", (t) => t.some((x) => /^en:fruits|fresh-fruits|dried-fruits|berries/.test(x))],
  ["vegetables", (t) => t.some((x) => /vegetables|potatoes|tomatoes|mushrooms/.test(x))],
  ["grains", (t) => t.some((x) => /cereals|pastas|rices|breads|flours|oat-flakes|grains|noodles/.test(x))],
  ["spices_sauces", (t) => t.some((x) => /condiments|sauces|spices|salts|seasonings|mustards|ketchup|broths/.test(x))],
];

/** Sammelkategorien, die nichts über die Supermarkt-Abteilung aussagen (z. B. „cereals-and-potatoes“). */
const UMBRELLA_TAGS = new Set([
  "en:cereals-and-potatoes",
  "en:plant-based-foods",
  "en:plant-based-foods-and-beverages",
  "en:fruits-and-vegetables-based-foods",
]);

export function guessFoodGroup(categories: string[] = []): Enums<"food_group"> {
  const specific = categories.filter((t) => !UMBRELLA_TAGS.has(t));
  for (const [group, test] of GROUP_RULES) if (test(specific)) return group;
  return "other";
}

export function guessDiet(analysisTags: string[] = []): Enums<"ingredient_diet"> | null {
  if (analysisTags.includes("en:vegan")) return "vegan";
  if (analysisTags.includes("en:non-vegetarian")) return "none";
  if (analysisTags.includes("en:vegetarian")) return "vegetarian";
  return null; // unbekannt: die Datenbank leitet es aus der Zutatengruppe ab
}

export function mapOffHit(hit: OffHit): IngredientCandidate | null {
  const name = (hit.product_name_de || hit.product_name || hit.generic_name_de || "").trim();
  if (!hit.code || !name) return null;

  const n = hit.nutriments ?? {};
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  const fiber = num(n.fiber_100g) ?? 0;
  const sugar = num(n.sugars_100g) ?? 0;

  let kcal = num(n["energy-kcal_100g"]);
  if (kcal == null) {
    const kj = num(n["energy-kj_100g"]) ?? num(n.energy_100g);
    if (kj != null) kcal = kj / 4.184;
  }
  if (kcal == null && protein != null && carbs != null && fat != null) {
    kcal = protein * 4 + carbs * 4 + fat * 9 + fiber * 2;
  }
  // Ohne Nährwerte ist der Treffer für uns nutzlos
  if (kcal == null || protein == null || carbs == null || fat == null) return null;

  const brands = Array.isArray(hit.brands) ? hit.brands : (hit.brands ?? "").split(",");
  const brand = brands.map((b) => b.trim()).find(Boolean) ?? null;

  return {
    externalId: hit.code,
    name: name.slice(0, 160),
    brand,
    kcal: round1(kcal),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
    fiber: round1(fiber),
    sugar: round1(sugar),
    food_group: guessFoodGroup(hit.categories_tags),
    diet: guessDiet(hit.ingredients_analysis_tags),
  };
}

/** Name, unter dem der Treffer gespeichert wird, z. B. „Haferflocken (ja!)“. */
export function candidateDisplayName(c: Pick<IngredientCandidate, "name" | "brand">): string {
  if (!c.brand || c.name.toLocaleLowerCase("de").includes(c.brand.toLocaleLowerCase("de"))) return c.name;
  return `${c.name} (${c.brand})`.slice(0, 200);
}
