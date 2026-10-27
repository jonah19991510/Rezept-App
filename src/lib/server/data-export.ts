import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { toBackupFile, type BackupFile, type RecipeRowForBackup } from "@/lib/domain/recipe-backup";
import type { MarkdownRecipe } from "@/lib/domain/recipe-markdown";
import { toSportBackupFile, type SportBackupFile } from "@/lib/domain/sport-backup";
import { RECIPE_PHOTO_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

// „Meine Daten herunterladen“ (Recht auf Auskunft/Datenübertragbarkeit) und die Rezept-Sicherung.
// Alles läuft mit dem Client des Nutzers: RLS stellt zusätzlich sicher, dass nur eigene Daten kommen.

const BACKUP_INGREDIENT_COLUMNS =
  "id, name, kcal, protein, carbs, fat, fiber, sugar, food_group, diet, piece_weight_g, density_g_per_ml, abv";

function must<T>(result: { data: T | null; error: { code?: string } | null }, what: string): T {
  if (result.error || result.data == null) throw new Error(`${what} konnte nicht gelesen werden (${result.error?.code ?? "leer"})`);
  return result.data;
}

/** Alle Dateien im eigenen Foto-Ordner (Unterordner je Rezept). */
async function listOwnPhotos(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string[]> {
  const bucket = supabase.storage.from(RECIPE_PHOTO_BUCKET);
  const { data: folders } = await bucket.list(userId, { limit: 1000 });
  const paths: string[] = [];
  for (const folder of folders ?? []) {
    if (folder.id !== null) continue; // nur Ordner
    const { data: files } = await bucket.list(`${userId}/${folder.name}`, { limit: 100 });
    for (const f of files ?? []) paths.push(`${userId}/${folder.name}/${f.name}`);
  }
  return paths;
}

/** Alle Getränke-Einträge; seitenweise, weil Supabase höchstens 1000 Zeilen je Abfrage liefert (~3 Monate). */
async function allDrinkEntries(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const rows: Record<string, unknown>[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from("drink_entries")
      .select("*")
      .eq("user_id", userId)
      .order("drunk_at")
      .order("id")
      .range(page * 1000, page * 1000 + 999);
    if (error) return { data: null, error };
    rows.push(...data);
    if (data.length < 1000) return { data: rows, error: null };
  }
}

/** Vollständiger Export aller personenbezogenen Daten des Nutzers als ein JSON-Objekt. */
export async function buildPersonalDataExport(user: CurrentUser) {
  const supabase = await createClient();
  const id = user.id;
  const [
    profile, recipes, plan, batches, planDays, goals, settings, shopping, pantry, prices, cookLogs, favorites, ownIngredients, categories,
    trainingPlans, ownExercises, workouts, drinks, drinkEntries,
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url, role, created_at").eq("id", id).maybeSingle(),
    supabase
      .from("recipes")
      .select(
        "*, recipe_ingredients!recipe_ingredients_recipe_id_fkey(*, ingredients!recipe_ingredients_ingredient_id_fkey(name)), recipe_steps!recipe_steps_recipe_id_fkey(*), cocktail_details!cocktail_details_recipe_id_fkey(*), recipe_versions!recipe_versions_recipe_id_fkey(*)",
      )
      .eq("owner_id", id)
      .order("created_at"),
    supabase.from("meal_plan_entries").select("*, recipes!meal_plan_entries_recipe_id_fkey(title)").eq("user_id", id).order("date"),
    supabase.from("meal_prep_batches").select("*").eq("user_id", id),
    supabase.from("plan_days").select("*").eq("user_id", id),
    supabase.from("user_goals").select("*").eq("user_id", id),
    supabase.from("user_settings").select("*").eq("user_id", id),
    supabase.from("shopping_list_items").select("*").eq("user_id", id).order("created_at"),
    supabase.from("pantry_items").select("*, ingredients!pantry_items_ingredient_id_fkey(name)").eq("user_id", id),
    supabase.from("ingredient_prices").select("*, ingredients!ingredient_prices_ingredient_id_fkey(name)").eq("user_id", id),
    supabase.from("cook_logs").select("*, recipes!cook_logs_recipe_id_fkey(title)").eq("user_id", id).order("cooked_at"),
    supabase.from("favorites").select("*, recipes!favorites_recipe_id_fkey(title)").eq("user_id", id),
    supabase.from("ingredients").select("*").eq("created_by", id).order("created_at"),
    supabase.from("recipe_categories").select("name, position, created_at").eq("user_id", id).order("position"),
    // Sport & Gesundheit (Phase S1)
    supabase
      .from("training_plans")
      .select(
        "*, training_plan_days!training_plan_days_plan_id_fkey(*, training_plan_exercises!training_plan_exercises_day_id_fkey(*, exercises!training_plan_exercises_exercise_id_fkey(name)))",
      )
      .eq("owner_id", id)
      .order("created_at"),
    supabase.from("exercises").select("*").eq("created_by", id).order("created_at"),
    supabase
      .from("workouts")
      .select(
        "*, workout_exercises!workout_exercises_workout_id_fkey(*, exercises!workout_exercises_exercise_id_fkey(name), workout_sets!workout_sets_workout_exercise_id_fkey(*))",
      )
      .eq("user_id", id)
      .order("started_at"),
    // Getränketracker
    supabase.from("drinks").select("*").eq("user_id", id).order("position"),
    allDrinkEntries(supabase, id),
  ]);

  return {
    hinweis:
      "Export aller Daten, die das Rezeptbuch über dich gespeichert hat. Passwörter speichert die App nicht im Klartext (nur Supabase Auth als Hash) und sie sind hier nicht enthalten. Fotos liegen als Dateien im Speicher; hier steht die Liste.",
    exportiert_am: new Date().toISOString(),
    konto: { id, email: user.email, ...must(profile, "Profil") },
    rezepte: must(recipes, "Rezepte"),
    fotos: await listOwnPhotos(supabase, id),
    wochenplan: must(plan, "Wochenplan"),
    meal_prep: must(batches, "Meal Prep"),
    plan_tage: must(planDays, "Plan-Tage"),
    ziele: must(goals, "Ziele"),
    einstellungen: must(settings, "Einstellungen"),
    einkaufsliste: must(shopping, "Einkaufsliste"),
    vorrat: must(pantry, "Vorrat"),
    preise: must(prices, "Preise"),
    koch_log: must(cookLogs, "Koch-Log"),
    favoriten: must(favorites, "Favoriten"),
    eigene_zutaten: must(ownIngredients, "Zutaten"),
    kategorien: must(categories, "Kategorien"),
    trainingsplaene: must(trainingPlans, "Trainingspläne"),
    eigene_uebungen: must(ownExercises, "Übungen"),
    trainings: must(workouts, "Trainings"),
    getraenke: must(drinks, "Getränke"),
    getraenke_eintraege: must(drinkEntries, "Getränke-Einträge"),
  };
}

/** Alle eigenen Rezepte (Küche und Bar) als wieder importierbare Sicherung (Format-Version 2). */
export async function buildRecipeBackup(userId: string): Promise<BackupFile> {
  const supabase = await createClient();
  const result = await supabase
    .from("recipes")
    .select(
      `recipe_type, title, description, servings, prep_minutes, cook_minutes, category:category_name, tags, is_meal_prep, source_url, side_dishes,
       recipe_ingredients!recipe_ingredients_recipe_id_fkey(position, amount, unit, grams, note, step_position, is_optional, ingredient:ingredients!recipe_ingredients_ingredient_id_fkey(${BACKUP_INGREDIENT_COLUMNS})),
       recipe_steps!recipe_steps_recipe_id_fkey(position, text, timer_seconds, timer_from_text),
       cocktail_details!cocktail_details_recipe_id_fkey(glass, method, ice, garnish)`,
    )
    .eq("owner_id", userId)
    .order("created_at");
  const rows = must(result, "Rezepte") as RecipeRowForBackup[];
  return toBackupFile(rows, new Date());
}

const MARKDOWN_SELECT = `id, recipe_type, title, description, servings, prep_minutes, cook_minutes, category:category_name, tags, is_meal_prep, source_url, side_dishes,
  recipe_ingredients!recipe_ingredients_recipe_id_fkey(position, amount, unit, note, is_optional, ingredient:ingredients!recipe_ingredients_ingredient_id_fkey(name)),
  recipe_steps!recipe_steps_recipe_id_fkey(position, text, timer_seconds),
  cocktail_details!cocktail_details_recipe_id_fkey(glass, method, ice, garnish)`;

type MarkdownRow = Omit<MarkdownRecipe, "perServing" | "ingredients" | "steps" | "cocktail" | "alcohol"> & {
  id: string;
  cocktail_details: MarkdownRecipe["cocktail"];
  recipe_ingredients: {
    position: number;
    amount: number | null;
    unit: MarkdownRecipe["ingredients"][number]["unit"];
    note: string | null;
    is_optional: boolean;
    ingredient: { name: string };
  }[];
  recipe_steps: { position: number; text: string; timer_seconds: number | null }[];
};

async function toMarkdownRecipes(supabase: Awaited<ReturnType<typeof createClient>>, rows: MarkdownRow[]): Promise<MarkdownRecipe[]> {
  if (rows.length === 0) return [];
  const nutrition = must(
    await supabase
      .from("recipe_nutrition")
      .select("recipe_id, kcal_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, fiber_per_serving")
      .in("recipe_id", rows.map((r) => r.id)),
    "Nährwerte",
  );
  const byId = new Map(nutrition.map((n) => [n.recipe_id, n]));
  // Phase 15: Alkoholgehalt der Cocktails
  const cocktailIds = rows.filter((r) => r.recipe_type === "cocktail").map((r) => r.id);
  const alcohol = cocktailIds.length
    ? must(await supabase.from("recipe_alcohol").select("recipe_id, abv_percent, alcohol_g_per_drink").in("recipe_id", cocktailIds), "Alkoholgehalt")
    : [];
  const alcoholById = new Map(alcohol.map((a) => [a.recipe_id, a]));
  return rows.map(({ id, recipe_ingredients, recipe_steps, cocktail_details, ...r }) => {
    const n = byId.get(id);
    const a = alcoholById.get(id);
    return {
      ...r,
      cocktail: r.recipe_type === "cocktail" ? cocktail_details : null,
      alcohol: a ? { abvPercent: a.abv_percent ?? 0, alcoholGrams: a.alcohol_g_per_drink ?? 0 } : null,
      perServing:
        n && n.kcal_per_serving != null
          ? {
              kcal: n.kcal_per_serving,
              protein: n.protein_per_serving ?? 0,
              carbs: n.carbs_per_serving ?? 0,
              fat: n.fat_per_serving ?? 0,
              fiber: n.fiber_per_serving ?? 0,
            }
          : null,
      ingredients: [...recipe_ingredients]
        .sort((a, b) => a.position - b.position)
        .map((l) => ({ amount: l.amount, unit: l.unit, name: l.ingredient.name, note: l.note, optional: l.is_optional })),
      steps: [...recipe_steps].sort((a, b) => a.position - b.position).map(({ text, timer_seconds }) => ({ text, timer_seconds })),
    };
  });
}

/** Ein lesbares Rezept (eigenes oder öffentliches, RLS) für den Markdown-Export. null, wenn nicht lesbar. */
export async function getRecipeForMarkdown(recipeId: string): Promise<MarkdownRecipe | null> {
  const supabase = await createClient();
  const result = await supabase.from("recipes").select(MARKDOWN_SELECT).eq("id", recipeId).maybeSingle();
  if (result.error) throw new Error(`Rezept konnte nicht gelesen werden (${result.error.code})`);
  if (!result.data) return null;
  const [recipe] = await toMarkdownRecipes(supabase, [result.data]);
  return recipe ?? null;
}

/** Alle eigenen Rezepte (Küche und Bar) für das Buch als Markdown. */
export async function getOwnRecipesForMarkdown(userId: string): Promise<MarkdownRecipe[]> {
  const supabase = await createClient();
  const result = await supabase.from("recipes").select(MARKDOWN_SELECT).eq("owner_id", userId);
  return toMarkdownRecipes(supabase, must(result, "Rezepte"));
}

/** Sport-Sicherung: eigene Trainingspläne (mit Tagen und Übungen) und eigene Übungen, wieder importierbar. */
export async function buildSportBackup(userId: string): Promise<SportBackupFile> {
  const supabase = await createClient();
  const [plans, exercises, workouts] = await Promise.all([
    supabase
      .from("training_plans")
      .select(
        "title, description, is_archived, training_plan_days!training_plan_days_plan_id_fkey(position, name, focus, training_plan_exercises!training_plan_exercises_day_id_fkey(position, sets, reps_min, reps_max, target_seconds, rest_seconds, warmup, note, exercises!training_plan_exercises_exercise_id_fkey(name, muscle_group, secondary_muscles, equipment, tracking)))",
      )
      .eq("owner_id", userId)
      .order("created_at"),
    supabase.from("exercises").select("name, muscle_group, secondary_muscles, equipment, tracking").eq("created_by", userId).order("name"),
    supabase
      .from("workouts")
      .select(
        "title, started_at, ended_at, note, training_plans!workouts_plan_id_fkey(title), training_plan_days!workouts_plan_day_id_fkey(name), workout_exercises!workout_exercises_workout_id_fkey(position, note, exercises!workout_exercises_exercise_id_fkey(name, muscle_group, secondary_muscles, equipment, tracking), workout_sets!workout_sets_workout_exercise_id_fkey(position, kind, done, weight_kg, reps, seconds, distance_m, speed_kmh))",
      )
      .eq("user_id", userId)
      .order("started_at"),
  ]);
  return toSportBackupFile(must(plans, "Trainingspläne"), must(exercises, "Übungen"), must(workouts, "Trainings"), new Date());
}
