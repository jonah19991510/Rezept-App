import type { Enums } from "@/lib/supabase/database.types";

// Deutsche Anzeige-Namen für die (englischen) Enum-Werte der Datenbank.

export const CATEGORY_LABELS: Record<Enums<"recipe_category">, string> = {
  pasta: "Pasta",
  rice: "Reis",
  bowl: "Bowl",
  soup: "Suppe/Eintopf",
  salad: "Salat",
  casserole: "Auflauf",
  meat: "Fleischgericht",
  fish: "Fisch",
  breakfast: "Frühstück",
  snack: "Snack",
  dessert: "Dessert",
  drink: "Getränk",
};

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

/** Einheiten in der Auswahl beim Bearbeiten (Küche). Dash und Barlöffel kommen mit dem Bar-Bereich. */
export const KITCHEN_UNITS: Enums<"unit">[] = ["g", "ml", "piece", "tbsp", "tsp", "pinch", "cl", "dash", "barspoon"];

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
