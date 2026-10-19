"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { resolveLineGrams } from "@/lib/domain/units";
import { createClient } from "@/lib/supabase/server";
import { forkRecipeSchema, setRecipePublicSchema, type SetRecipePublicInput } from "@/lib/validation/community";
import { flattenIssues, recipeInputSchema, type RecipeInput } from "@/lib/validation/recipe";

export type SaveRecipeResult = { ok: false; message?: string; fieldErrors?: Record<string, string[]> };

/** Rezept anlegen oder ändern. Bei Erfolg Weiterleitung zur Rezeptseite. */
export async function saveRecipeAction(input: RecipeInput): Promise<SaveRecipeResult> {
  await requireUser();
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
  }));

  const { data: recipeId, error } = await supabase.rpc("save_recipe", {
    p_recipe: {
      id: recipe.id ?? null,
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prep_minutes: recipe.prep_minutes,
      cook_minutes: recipe.cook_minutes,
      category: recipe.category,
      tags: recipe.tags,
      is_meal_prep: recipe.is_meal_prep,
      source_url: recipe.source_url,
    },
    p_ingredients: ingredients,
    p_steps: recipe.steps,
  });

  if (error || !recipeId) {
    if (error?.code === "P0002") return { ok: false, message: "Das Rezept gibt es nicht mehr oder es gehört dir nicht." };
    return { ok: false, message: "Das Rezept konnte nicht gespeichert werden. Bitte versuche es noch einmal." };
  }

  revalidatePath("/rezepte");
  revalidatePath(`/rezepte/${recipeId}`);
  redirect(`/rezepte/${recipeId}`);
}

const idSchema = z.uuid();

export async function deleteRecipeAction(recipeId: string): Promise<{ ok: false; message: string }> {
  const user = await requireUser();
  if (!idSchema.safeParse(recipeId).success) return { ok: false, message: "Ungültiges Rezept." };

  const supabase = await createClient();
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

export async function duplicateRecipeAction(recipeId: string): Promise<{ ok: false; message: string }> {
  await requireUser();
  if (!idSchema.safeParse(recipeId).success) return { ok: false, message: "Ungültiges Rezept." };

  const supabase = await createClient();
  const { data: newId, error } = await supabase.rpc("duplicate_recipe", { p_recipe_id: recipeId });
  if (error || !newId) return { ok: false, message: "Das Rezept konnte nicht kopiert werden." };

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
  revalidatePath(`/rezepte/${recipeId}`);
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
  await requireUser();
  const parsed = forkRecipeSchema.safeParse({ recipeId });
  if (!parsed.success) return { ok: false, message: "Ungültiges Rezept." };

  const supabase = await createClient();
  // duplicate_recipe sieht per RLS nur eigene und öffentliche Rezepte und setzt bei fremden forked_from_id
  const { data: newId, error } = await supabase.rpc("duplicate_recipe", { p_recipe_id: parsed.data.recipeId });
  if (error || !newId) {
    if (error?.code === "P0002") return { ok: false, message: "Das Rezept ist nicht mehr öffentlich." };
    return { ok: false, message: "Das Rezept konnte nicht übernommen werden." };
  }

  revalidatePath("/rezepte");
  revalidatePath("/entdecken");
  redirect(`/rezepte/${newId}?uebernommen=1`);
}
