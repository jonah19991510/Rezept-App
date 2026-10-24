import { describe, expect, it } from "vitest";
import {
  backupFileName,
  backupFileSchema,
  completeMapping,
  resolveBackupIngredients,
  toBackupFile,
  type BackupIngredient,
  type RecipeRowForBackup,
} from "./recipe-backup";

const ing = (id: string, name: string): BackupIngredient => ({
  id, name, kcal: 100, protein: 10, carbs: 10, fat: 1, fiber: 1, sugar: 1, food_group: "legumes", diet: "vegan",
  piece_weight_g: null, density_g_per_ml: null, abv: null,
});

const LINSEN = ing("11111111-1111-4111-8111-111111111111", "Rote Linsen");
const KOKOS = ing("22222222-2222-4222-8222-222222222222", "Kokosmilch");
const SPEZIAL = ing("33333333-3333-4333-8333-333333333333", "Omas Gewürzmischung");

const row: RecipeRowForBackup = {
  recipe_type: "dish",
  cocktail_details: null,
  title: "Dal",
  description: null,
  servings: 4,
  prep_minutes: 10,
  cook_minutes: 25,
  category: "Suppe/Eintopf",
  tags: ["Klassiker"],
  is_meal_prep: true,
  source_url: null,
  side_dishes: ["Naan"],
  recipe_ingredients: [
    { position: 1, ingredient: KOKOS, amount: 400, unit: "ml", grams: 400, note: null, step_position: null, is_optional: false },
    { position: 0, ingredient: LINSEN, amount: 200, unit: "g", grams: 200, note: "gewaschen", step_position: 1, is_optional: false },
    { position: 2, ingredient: SPEZIAL, amount: 1, unit: "tsp", grams: 3, note: null, step_position: null, is_optional: false },
  ],
  recipe_steps: [
    { position: 2, text: "Kochen.", timer_seconds: 1200 },
    { position: 1, text: "Waschen.", timer_seconds: null },
  ],
};

const now = new Date("2026-10-19T12:00:00Z");

describe("toBackupFile", () => {
  const file = toBackupFile([row], now);

  it("sortiert Zutaten und Schritte und erfüllt das eigene Schema", () => {
    expect(file.recipes[0].ingredients.map((l) => l.ingredient.name)).toEqual(["Rote Linsen", "Kokosmilch", "Omas Gewürzmischung"]);
    expect(file.recipes[0].steps).toEqual([{ text: "Waschen.", timer_seconds: null }, { text: "Kochen.", timer_seconds: 1200 }]);
    expect(file.recipes[0].ingredients[0]).not.toHaveProperty("position");
    expect(backupFileSchema.safeParse(JSON.parse(JSON.stringify(file))).success).toBe(true);
  });

  it("lehnt fremde oder kaputte Dateien verständlich ab", () => {
    const wrong = backupFileSchema.safeParse({ ...file, format: "etwas-anderes" });
    expect(wrong.success).toBe(false);
    expect(wrong.error?.issues[0].message).toMatch(/keine Rezept-Sicherung/);
    expect(backupFileSchema.safeParse({ ...file, recipes: [] }).success).toBe(false);
    expect(backupFileSchema.safeParse({ ...file, recipes: [{ ...file.recipes[0], servings: 0 }] }).success).toBe(false);
  });

  it("Version 2 mit Cocktail-Feldern und Alkoholgehalt", () => {
    const rum: BackupIngredient = { ...ing("66666666-6666-4666-8666-666666666666", "Rum, weiß"), food_group: "spirits", abv: 40 };
    const daiquiri: RecipeRowForBackup = {
      ...row,
      recipe_type: "cocktail",
      cocktail_details: { glass: "coupette", method: "shaken", ice: null, garnish: "Limettenrad" },
      title: "Daiquiri",
      category: "drink",
      recipe_ingredients: [{ position: 0, ingredient: rum, amount: 6, unit: "cl", grams: 57, note: null, step_position: null, is_optional: false }],
    };
    const v2 = toBackupFile([daiquiri, row], now);
    expect(v2.version).toBe(2);
    expect(v2.recipes[0]).toMatchObject({ recipe_type: "cocktail", cocktail: { method: "shaken", garnish: "Limettenrad" } });
    expect(v2.recipes[0].ingredients[0].ingredient.abv).toBe(40);
    expect(v2.recipes[1]).toMatchObject({ recipe_type: "dish", cocktail: null });
    const parsed = backupFileSchema.parse(JSON.parse(JSON.stringify(v2)));
    expect(parsed.recipes[0].cocktail?.glass).toBe("coupette");
  });

  it("Gerichte haben keine Cocktail-Felder, auch wenn die Datenbank welche liefert", () => {
    const odd = toBackupFile([{ ...row, cocktail_details: { glass: "tiki", method: null, ice: null, garnish: null } }], now);
    expect(odd.recipes[0].cocktail).toBeNull();
  });

  it("Dateien der Version 1 bleiben importierbar (Gericht, Alkoholgehalt unbekannt)", () => {
    // Datei wie aus Phase 8–14: ohne recipe_type, cocktail und abv
    const v1 = JSON.parse(JSON.stringify({ ...file, version: 1 }));
    for (const r of v1.recipes) {
      delete r.recipe_type;
      delete r.cocktail;
      for (const l of r.ingredients) delete l.ingredient.abv;
    }
    const parsed = backupFileSchema.safeParse(v1);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.recipes[0]).toMatchObject({ recipe_type: "dish", cocktail: null });
    expect(parsed.data?.recipes[0].ingredients[0].ingredient.abv).toBeNull();
    expect(backupFileSchema.safeParse({ ...v1, version: 3 }).success).toBe(false);
  });

  it("Dateiname mit Datum", () => {
    expect(backupFileName("rezeptbuch-rezepte", now)).toBe("rezeptbuch-rezepte-2026-10-19.json");
  });
});

describe("resolveBackupIngredients / completeMapping", () => {
  const file = toBackupFile([row, { ...row, title: "Dal 2" }], now);

  it("ID zuerst, dann Name (ohne Groß/klein), Rest einmal anlegen", () => {
    const existing = [
      { id: LINSEN.id, name: "Rote Linsen" },
      { id: "44444444-4444-4444-8444-444444444444", name: "kokosmilch" },
    ];
    const { mapping, toCreate } = resolveBackupIngredients(file, existing);
    expect(mapping.get(LINSEN.id)).toBe(LINSEN.id);
    expect(mapping.get(KOKOS.id)).toBe("44444444-4444-4444-8444-444444444444");
    expect(toCreate.map((i) => i.name)).toEqual(["Omas Gewürzmischung"]);

    const full = completeMapping(file, mapping, [{ id: "55555555-5555-4555-8555-555555555555", name: "Omas Gewürzmischung" }]);
    expect(full.get(SPEZIAL.id)).toBe("55555555-5555-4555-8555-555555555555");
    expect(full.size).toBe(3);
  });
});
