"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { INGREDIENT_OPTION_COLUMNS, toIngredientOption, type IngredientOption } from "@/lib/domain/ingredient-option";
import { defaultDiet } from "@/lib/domain/my-ingredients";
import { createClient } from "@/lib/supabase/server";
import { flattenIssues, ingredientInputSchema, type IngredientInput } from "@/lib/validation/recipe";

export type UpdateIngredientResult =
  | { ok: true; ingredient: IngredientOption }
  | { ok: false; message?: string; fieldErrors?: Record<string, string[]> };

/**
 * Selbst angelegte Zutat ändern (Name, Nährwerte, Gruppe, Ernährungsform, Stückgewicht, Dichte, Alkoholgehalt).
 * RLS lässt nur eigene Zutaten mit Quelle „user“ zu; ändern sich Dichte oder Stückgewicht, rechnet ein Trigger
 * die Gramm in allen Rezepten mit dieser Zutat neu. Nährwerte wirken über die View sofort überall.
 */
export async function updateIngredientAction(id: string, input: IngredientInput): Promise<UpdateIngredientResult> {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Ungültige Zutat." };
  const parsed = ingredientInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: flattenIssues(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredients")
    // Barcode (external_id), Quelle und Grundzutat-Markierung bleiben, wie sie sind
    .update({
      name: v.name,
      kcal: v.kcal,
      protein: v.protein,
      carbs: v.carbs,
      fat: v.fat,
      fiber: v.fiber,
      sugar: v.sugar,
      food_group: v.food_group,
      diet: v.diet ?? defaultDiet(v.food_group),
      piece_weight_g: v.piece_weight_g,
      density_g_per_ml: v.density_g_per_ml,
      abv: v.abv,
    })
    .eq("id", id)
    .eq("created_by", user.id)
    .eq("source", "user")
    .select(INGREDIENT_OPTION_COLUMNS)
    .maybeSingle();
  if (error) return { ok: false, message: "Die Zutat konnte nicht gespeichert werden. Bitte versuche es noch einmal." };
  if (!data) return { ok: false, message: "Diese Zutat kannst du nicht bearbeiten." };

  revalidateIngredientPages();
  return { ok: true, ingredient: toIngredientOption(data) };
}

function revalidateIngredientPages() {
  revalidatePath("/zutaten");
  revalidatePath("/rezepte", "layout");
  revalidatePath("/wochenplan");
  revalidatePath("/statistik");
  revalidatePath("/einkauf");
  revalidatePath("/preise");
}

/**
 * Eigene Zutat löschen (selbst erstellt oder aus Open Food Facts übernommen). Eigener Preis und Vorrats-Eintrag
 * gehen mit (Cascade), Einkaufslisten behalten den Namen. Die Datenbank lehnt ab, wenn die Zutat noch in einem Rezept steckt (auch bei anderen, Fremdschlüssel) oder
 * andere sie im Vorrat bzw. mit Preis haben (Trigger ingredients_protect_shared_delete).
 */
export async function deleteIngredientAction(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Ungültige Zutat." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .delete()
    .eq("id", id)
    .eq("created_by", user.id)
    .in("source", ["user", "openfoodfacts"])
    .select("id");
  if (error?.code === "23503") {
    return {
      ok: false,
      message: "Die Zutat steckt noch in einem Rezept (bei dir oder bei jemand anderem) und kann deshalb nicht gelöscht werden.",
    };
  }
  if (error?.code === "P0001") {
    return { ok: false, message: "Andere nutzen diese Zutat noch (im Vorrat oder mit Preis). Sie bleibt deshalb bestehen." };
  }
  if (error) return { ok: false, message: "Die Zutat konnte nicht gelöscht werden. Bitte versuche es noch einmal." };
  if (!data?.length) return { ok: false, message: "Diese Zutat kannst du nicht löschen." };

  revalidateIngredientPages();
  return { ok: true };
}
