import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { toBackupFile, type BackupFile, type RecipeRowForBackup } from "@/lib/domain/recipe-backup";
import { RECIPE_PHOTO_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

// „Meine Daten herunterladen“ (Recht auf Auskunft/Datenübertragbarkeit) und die Rezept-Sicherung.
// Alles läuft mit dem Client des Nutzers: RLS stellt zusätzlich sicher, dass nur eigene Daten kommen.

const BACKUP_INGREDIENT_COLUMNS =
  "id, name, kcal, protein, carbs, fat, fiber, sugar, food_group, diet, piece_weight_g, density_g_per_ml";

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

/** Vollständiger Export aller personenbezogenen Daten des Nutzers als ein JSON-Objekt. */
export async function buildPersonalDataExport(user: CurrentUser) {
  const supabase = await createClient();
  const id = user.id;
  const [
    profile, recipes, plan, batches, planDays, goals, settings, shopping, pantry, prices, cookLogs, favorites, ownIngredients,
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
  };
}

/** Alle eigenen Rezepte (Küche) als wieder importierbare Sicherung. */
export async function buildRecipeBackup(userId: string): Promise<BackupFile> {
  const supabase = await createClient();
  const result = await supabase
    .from("recipes")
    .select(
      `title, description, servings, prep_minutes, cook_minutes, category, tags, is_meal_prep, source_url,
       recipe_ingredients!recipe_ingredients_recipe_id_fkey(position, amount, unit, grams, note, step_position, ingredient:ingredients!recipe_ingredients_ingredient_id_fkey(${BACKUP_INGREDIENT_COLUMNS})),
       recipe_steps!recipe_steps_recipe_id_fkey(position, text, timer_seconds)`,
    )
    .eq("owner_id", userId)
    .eq("recipe_type", "dish")
    .order("created_at");
  const rows = must(result, "Rezepte") as RecipeRowForBackup[];
  return toBackupFile(rows, new Date());
}
