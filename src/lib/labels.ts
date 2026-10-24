import type { Enums } from "@/lib/supabase/database.types";

// Deutsche Anzeige-Namen für die (englischen) Enum-Werte der Datenbank.

export const FOOD_GROUP_LABELS: Record<Enums<"food_group">, string> = {
  vegetables: "Gemüse",
  fruit: "Obst",
  meat: "Fleisch",
  fish: "Fisch",
  dairy: "Milchprodukte",
  egg: "Ei",
  grains: "Getreide/Pasta/Reis",
  legumes: "Hülsenfrüchte",
  nuts_seeds: "Nüsse/Samen",
  oils_fats: "Öle/Fette",
  spices_sauces: "Gewürze/Saucen",
  spirits: "Spirituosen",
  liqueurs_wine: "Liköre/Wein",
  syrups_juices: "Sirup/Säfte",
  other: "Sonstiges",
};

/** Kurzform in Mengenangaben („2 EL“). */
export const UNIT_LABELS: Record<Enums<"unit">, string> = {
  g: "g",
  ml: "ml",
  cl: "cl",
  piece: "Stück",
  tbsp: "EL",
  tsp: "TL",
  pinch: "Prise",
  dash: "Dash",
  barspoon: "Barlöffel",
};

/** Einheiten in der Auswahl beim Bearbeiten (Küche). */
export const KITCHEN_UNITS: Enums<"unit">[] = ["g", "ml", "piece", "tbsp", "tsp", "pinch", "cl", "dash", "barspoon"];

/** Einheiten im Cocktail-Editor: Bar-Maße zuerst. */
export const BAR_UNITS: Enums<"unit">[] = ["cl", "ml", "dash", "barspoon", "tsp", "piece", "g", "tbsp", "pinch"];

export const GLASS_LABELS: Record<Enums<"glass">, string> = {
  tumbler: "Tumbler",
  coupette: "Coupette",
  highball: "Highball",
  martini: "Martini",
  tiki: "Tiki",
  other: "Sonstiges",
};

export const METHOD_LABELS: Record<Enums<"cocktail_method">, string> = {
  shaken: "geshaked",
  stirred: "gerührt",
  built: "gebaut",
  blended: "geblendet",
};

export const DIET_LABELS: Record<Enums<"ingredient_diet">, string> = {
  vegan: "vegan",
  vegetarian: "vegetarisch",
  none: "weder noch (Fleisch/Fisch)",
};

export const AUTO_TAG_LABELS = {
  high_protein: "High Protein",
  vegetarian: "Vegetarisch",
  vegan: "Vegan",
  low_carb: "Low Carb",
  meal_prep: "Meal-Prep",
} as const;

export type AutoTag = keyof typeof AUTO_TAG_LABELS;

/** Phase 15: Wörter, die sich zwischen Gericht und Cocktail unterscheiden (Rezeptseite, Koch-/Mix-Modus, Koch-Log). */
export const KIND_WORDS = {
  dish: {
    one: "Portion",
    many: "Portionen",
    done: "Gekocht",
    past: "gekocht",
    mode: "Kochmodus",
    start: "Kochen starten",
    doing: "kochen",
  },
  cocktail: {
    one: "Drink",
    many: "Drinks",
    done: "Gemixt",
    past: "gemixt",
    mode: "Mix-Modus",
    start: "Mixen starten",
    doing: "mixen",
  },
} as const satisfies Record<Enums<"recipe_type">, Record<string, string>>;

export type KindWords = (typeof KIND_WORDS)[Enums<"recipe_type">];

export function servingsLabel(n: number, kind: Enums<"recipe_type"> = "dish"): string {
  return n === 1 ? KIND_WORDS[kind].one : KIND_WORDS[kind].many;
}
