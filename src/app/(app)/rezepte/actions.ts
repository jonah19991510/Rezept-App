"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { toListSort } from "@/lib/domain/recipe-filter";
import { resolveLineGrams, type Unit } from "@/lib/domain/units";
import { Constants } from "@/lib/supabase/database.types";
import { copyPhotoToRecipe, removeRecipePhotoFolder } from "@/lib/server/photos";
import { createClient } from "@/lib/supabase/server";
import { parseSnapshot } from "@/lib/domain/versions";
import { forkRecipeSchema, setRecipePublicSchema, type SetRecipePublicInput } from "@/lib/validation/community";
import { restoreVersionSchema } from "@/lib/validation/kitchen-log";
import { flattenIssues, recipeInputSchema, type RecipeInput } from "@/lib/validation/recipe";

export type SaveRecipeResult = { ok: false; message?: string; fieldErrors?: Record<string, string[]> };
export type SaveRecipeStayResult = SaveRecipeResult | { ok: true; recipeId: string };

/**
 * Rezept anlegen oder ändern. Bei Erfolg Weiterleitung zur Rezeptseite – außer mit `stay`
 * (Markdown-Import: danach geht es mit dem nächsten Rezept weiter), dann kommt die ID zurück.
 */
export async function saveRecipeAction(input: RecipeInput, options?: { stay?: boolean }): Promise<SaveRecipeStayResult> {
  await requireUser();
  const result = await persistRecipe(input);
  if (!result.ok) return result;
  revalidatePath("/rezepte");
  revalidatePath(`/rezepte/${result.recipeId}`);
  if (options?.stay) return result;
  redirect(`/rezepte/${result.recipeId}`);
}

const MAX_BATCH_SAVE = 20;

/** Markdown-Import: mehrere sicher erkannte Rezepte direkt speichern (neu, privat). */
export async function saveRecipesBatchAction(
  inputs: RecipeInput[],
): Promise<{ ok: true; saved: number; failed: number } | { ok: false; message: string }> {
  await requireUser();
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > MAX_BATCH_SAVE) {
    return { ok: false, message: "Ungültige Auswahl." };
  }
  let saved = 0;
  let failed = 0;
  // Nacheinander: save_recipe legt je Rezept auch die erste Version an
  for (const input of inputs) {
    const result = await persistRecipe({ ...input, id: undefined });
    if (result.ok) saved++;
    else failed++;
  }
  if (saved > 0) revalidatePath("/rezepte");
  return { ok: true, saved, failed };
}

async function persistRecipe(input: RecipeInput): Promise<SaveRecipeStayResult> {
  const parsed = recipeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Bitte prüfe die markierten Felder.", fieldErrors: flattenIssues(parsed.error) };
  }
  const recipe = parsed.data;
  const supabase = await createClient();

  // Gramm immer auf dem Server berechnen, nicht dem Browser vertrauen
  const ingredientIds = [...new Set(recipe.ingredients.map((l) => l.ingredient_id))];
  const { data: infos, error: infoError } = ingredientIds.length
    ? await supabase.from("ingredients").select("id, density_g_per_ml, piece_weight_g").in("id", ingredientIds)
    : { data: [], error: null };
  if (infoError) return { ok: false, message: "Die Zutaten konnten nicht geprüft werden." };
  const infoById = new Map(infos.map((i) => [i.id, i]));
  if (infoById.size !== ingredientIds.length) {
    return { ok: false, message: "Mindestens eine Zutat gibt es nicht mehr. Bitte wähle sie neu aus." };
  }

  const ingredients = recipe.ingredients.map((line) => ({
    ingredient_id: line.ingredient_id,
    amount: line.amount,
    unit: line.amount == null ? null : line.unit,
    grams: resolveLineGrams(line.amount, line.unit, infoById.get(line.ingredient_id) ?? {}, line.manual_grams),
    note: line.note,
    step_position: line.step_position,
    is_optional: line.is_optional,
  }));

  const { data: recipeId, error } = await supabase.rpc("save_recipe", {
    p_recipe: {
      id: recipe.id ?? null,
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prep_minutes: recipe.prep_minutes,
      cook_minutes: recipe.cook_minutes,
      // Name der Kategorie (eigene Liste); die Datenbank setzt die alte Enum-Spalte für die ältere App selbst
      category_name: recipe.category,
      tags: recipe.tags,
      is_meal_prep: recipe.is_meal_prep,
      source_url: recipe.source_url,
      side_dishes: recipe.side_dishes,
      // Phase 15: ohne Angabe behält die Datenbank den Typ; Cocktail-Felder nur bei Cocktails
      ...(recipe.recipe_type ? { recipe_type: recipe.recipe_type } : {}),
      ...(recipe.recipe_type === "cocktail" && recipe.cocktail ? { cocktail: recipe.cocktail } : {}),
    },
    p_ingredients: ingredients,
    p_steps: recipe.steps,
    p_change_note: recipe.change_note,
  });

  if (error || !recipeId) {
    if (error?.code === "P0002") return { ok: false, message: "Das Rezept gibt es nicht mehr oder es gehört dir nicht." };
    return { ok: false, message: "Das Rezept konnte nicht gespeichert werden. Bitte versuche es noch einmal." };
  }
  return { ok: true, recipeId };
}

const idSchema = z.uuid();
const UNITS = new Set<string>(Constants.public.Enums.unit);

/**
 * Alte Version wiederherstellen (Phase 12): Titel, Portionen, Zutaten und Schritte der Version werden zum
 * aktuellen Stand; dabei entsteht eine neue Version, die alte bleibt im Verlauf. Gramm rechnet der Server neu.
 */
export async function restoreVersionAction(input: { recipeId: string; version: number }): Promise<{ ok: false; message: string } | { ok: true; message: string }> {
  await requireUser();
  const parsed = restoreVersionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Ungültige Version." };
  const { recipeId, version } = parsed.data;

  const supabase = await createClient();
  const [{ data: recipe }, { data: row }] = await Promise.all([
    supabase
      .from("recipes")
      // category_name unter diesem Namen: save_recipe liest ihn so (category wäre die alte Enum-Spalte)
      .select("id, description, prep_minutes, cook_minutes, category_name, tags, is_meal_prep, source_url")
      .eq("id", recipeId)
      .maybeSingle(),
    supabase.from("recipe_versions").select("snapshot").eq("recipe_id", recipeId).eq("version", version).maybeSingle(),
  ]);
  if (!recipe || !row) return { ok: false, message: "Diese Version gibt es nicht (mehr)." };
  const snapshot = parseSnapshot(row.snapshot);

  // Zutaten, die inzwischen gelöscht wurden, fallen weg
  const ids = [...new Set(snapshot.ingredients.map((i) => i.ingredient_id))];
  const { data: infos } = ids.length
    ? await supabase.from("ingredients").select("id, density_g_per_ml, piece_weight_g").in("id", ids)
    : { data: [] };
  const infoById = new Map((infos ?? []).map((i) => [i.id, i]));
  const ingredients = snapshot.ingredients
    .filter((i) => infoById.has(i.ingredient_id))
    .map((i) => {
      const unit = i.unit && UNITS.has(i.unit) ? (i.unit as Unit) : null;
      return {
        ingredient_id: i.ingredient_id,
        amount: i.amount,
        unit: i.amount == null ? null : unit,
        grams: resolveLineGrams(i.amount, unit, infoById.get(i.ingredient_id) ?? {}, i.grams),
        note: i.note,
        step_position: i.step_position,
        is_optional: i.is_optional,
      };
    });
  const dropped = snapshot.ingredients.length - ingredients.length;

  const { error } = await supabase.rpc("save_recipe", {
    p_recipe: {
      ...recipe,
      title: snapshot.title || "Rezept",
      servings: Math.max(1, Math.round(snapshot.servings)),
      // Phase 15: Cocktail-Felder der Version (ältere Versionen haben keine, dann bleiben die aktuellen)
      ...(snapshot.cocktail ? { cocktail: snapshot.cocktail } : {}),
    },
    p_ingredients: ingredients,
    p_steps: snapshot.steps,
    p_change_note: `Version ${version} wiederhergestellt`,
  });
  if (error) return { ok: false, message: "Die Version konnte nicht wiederhergestellt werden." };

  revalidatePath("/rezepte");
  revalidatePath(`/rezepte/${recipeId}`);
  return {
    ok: true,
    message: dropped
      ? `Version ${version} wiederhergestellt. ${dropped} ${dropped === 1 ? "Zutat gibt" : "Zutaten gibt"} es nicht mehr.`
      : `Version ${version} wiederhergestellt.`,
  };
}

export async function deleteRecipeAction(recipeId: string): Promise<{ ok: false; message: string }> {
  const user = await requireUser();
  if (!idSchema.safeParse(recipeId).success) return { ok: false, message: "Ungültiges Rezept." };

  const supabase = await createClient();
  // Fotos verschwinden nicht per Cascade: vorher den Ordner des Rezepts leeren
  await removeRecipePhotoFolder(supabase, user.id, recipeId);
  const { data, error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", recipeId)
    .eq("owner_id", user.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Das Rezept konnte nicht gelöscht werden." };

  revalidatePath("/rezepte");
  redirect("/rezepte");
}

/** Kopiert das Foto des Originals (falls vorhanden) in den Ordner der neuen Kopie. */
async function copySourcePhoto(supabase: Awaited<ReturnType<typeof createClient>>, sourceId: string, userId: string, newId: string) {
  const { data: source } = await supabase.from("recipes").select("image_url").eq("id", sourceId).maybeSingle();
  await copyPhotoToRecipe(supabase, source?.image_url ?? null, userId, newId);
}

export async function duplicateRecipeAction(recipeId: string): Promise<{ ok: false; message: string }> {
  const user = await requireUser();
  if (!idSchema.safeParse(recipeId).success) return { ok: false, message: "Ungültiges Rezept." };

  const supabase = await createClient();
  const { data: newId, error } = await supabase.rpc("duplicate_recipe", { p_recipe_id: recipeId });
  if (error || !newId) return { ok: false, message: "Das Rezept konnte nicht kopiert werden." };
  await copySourcePhoto(supabase, recipeId, user.id, newId);

  revalidatePath("/rezepte");
  redirect(`/rezepte/${newId}/bearbeiten`);
}

export async function setFavoriteAction(recipeId: string, favorite: boolean): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!idSchema.safeParse(recipeId).success) return { ok: false };

  const supabase = await createClient();
  const { error } = favorite
    ? await supabase.from("favorites").upsert({ user_id: user.id, recipe_id: recipeId }, { ignoreDuplicates: true })
    : await supabase.from("favorites").delete().eq("user_id", user.id).eq("recipe_id", recipeId);

  revalidatePath("/rezepte");
  revalidatePath("/rezepte/bar");
  revalidatePath("/entdecken");
  revalidatePath("/entdecken/bar");
  revalidatePath(`/rezepte/${recipeId}`);
  return { ok: !error };
}

/** Gewählte Sortierung merken (Küche und Bar getrennt), gilt auch in Entdecken. */
export async function setRecipeSortAction(mode: "kitchen" | "bar", sort: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (mode !== "kitchen" && mode !== "bar") return { ok: false };
  const value = toListSort(sort, mode);
  if (value !== sort) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, ...(mode === "bar" ? { cocktail_sort: value } : { recipe_sort: value }) }, { onConflict: "user_id" });
  revalidatePath(mode === "bar" ? "/rezepte/bar" : "/rezepte");
  revalidatePath(mode === "bar" ? "/entdecken/bar" : "/entdecken");
  return { ok: !error };
}

/** Rezeptliste nebeneinander oder untereinander anzeigen (gilt für Küche, Bar und Entdecken). */
export async function setRecipeViewAction(view: "grid" | "list"): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (view !== "grid" && view !== "list") return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").upsert({ user_id: user.id, recipe_view: view }, { onConflict: "user_id" });
  revalidatePath("/rezepte");
  revalidatePath("/rezepte/bar");
  revalidatePath("/entdecken");
  revalidatePath("/entdecken/bar");
  return { ok: !error };
}

/** Veröffentlichen-Schalter: nur der Owner (RLS + Filter auf owner_id). */
export async function setRecipePublicAction(input: SetRecipePublicInput): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  const parsed = setRecipePublicSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Ungültige Eingabe." };
  const { recipeId, isPublic } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .update({ is_public: isPublic })
    .eq("id", recipeId)
    .eq("owner_id", user.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Die Einstellung konnte nicht gespeichert werden." };

  revalidatePath("/rezepte");
  revalidatePath(`/rezepte/${recipeId}`);
  revalidatePath("/entdecken");
  return { ok: true };
}

/** „In mein Rezeptbuch übernehmen“: private, bearbeitbare Kopie mit forked_from_id, danach zur Kopie. */
export async function forkRecipeAction(recipeId: string): Promise<{ ok: false; message: string }> {
  const user = await requireUser();
  const parsed = forkRecipeSchema.safeParse({ recipeId });
  if (!parsed.success) return { ok: false, message: "Ungültiges Rezept." };

  const supabase = await createClient();
  // duplicate_recipe sieht per RLS nur eigene und öffentliche Rezepte und setzt bei fremden forked_from_id
  const { data: newId, error } = await supabase.rpc("duplicate_recipe", { p_recipe_id: parsed.data.recipeId });
  if (error || !newId) {
    if (error?.code === "P0002") return { ok: false, message: "Das Rezept ist nicht mehr öffentlich." };
    return { ok: false, message: "Das Rezept konnte nicht übernommen werden." };
  }
  // Eigene Kopie des Fotos: bleibt, auch wenn das Original privat wird oder verschwindet
  await copySourcePhoto(supabase, parsed.data.recipeId, user.id, newId);

  revalidatePath("/rezepte");
  revalidatePath("/entdecken");
  redirect(`/rezepte/${newId}?uebernommen=1`);
}
