"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { portionsToBuy } from "@/lib/domain/mealprep";
import { aggregateShopping, type ShoppingSourceLine } from "@/lib/domain/shopping";
import { isIsoDate } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";

export type ShoppingResult = { ok: true; message?: string } | { ok: false; message: string };

const isoDate = z.string().refine(isIsoDate);

const generateSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((v) => v.from <= v.to, { message: "Das Enddatum liegt vor dem Startdatum." });

/**
 * Einkaufsliste aus dem Wochenplan im gewählten Zeitraum erstellen.
 * Ersetzt frühere Plan-Einträge, eigene Einträge bleiben.
 */
export async function generateFromPlanAction(input: { from: string; to: string }): Promise<ShoppingResult> {
  const user = await requireUser();
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ungültiger Zeitraum." };
  const { from, to } = parsed.data;

  const supabase = await createClient();
  const [{ data: entries, error }, { data: batches, error: batchError }] = await Promise.all([
    supabase.from("meal_plan_entries").select("recipe_id, servings, batch_id").eq("user_id", user.id).gte("date", from).lte("date", to),
    // Meal Prep: am Kochtag einmal alle gekochten Portionen (nur Batches, deren Kochtag noch im Plan steht)
    supabase
      .from("meal_prep_batches")
      .select("id, recipe_id, cook_date, servings_cooked, meal_plan_entries!meal_plan_entries_batch_id_fkey(is_leftover)")
      .eq("user_id", user.id)
      .gte("cook_date", from)
      .lte("cook_date", to),
  ]);
  if (error || batchError) return { ok: false, message: "Der Wochenplan konnte nicht gelesen werden." };
  if (entries.length === 0) return { ok: false, message: "In diesem Zeitraum ist nichts geplant." };

  const portions = portionsToBuy(
    entries.map((e) => ({ recipeId: e.recipe_id, servings: e.servings, batchId: e.batch_id })),
    batches
      .filter((b) => b.meal_plan_entries.some((e) => !e.is_leftover))
      .map((b) => ({ id: b.id, recipeId: b.recipe_id, cookDate: b.cook_date, servingsCooked: b.servings_cooked })),
    from,
    to,
  );
  if (portions.length === 0) return { ok: false, message: "In diesem Zeitraum stehen nur Reste, dafür ist schon eingekauft." };
  const recipeIds = [...new Set(portions.map((e) => e.recipeId))];
  const { data: recipes, error: recipeError } = await supabase
    .from("recipes")
    .select(
      "id, servings, recipe_ingredients!recipe_ingredients_recipe_id_fkey(amount, unit, grams, ingredient_id, ingredients(name, food_group, is_staple))",
    )
    .in("id", recipeIds);
  if (recipeError) return { ok: false, message: "Die Rezepte konnten nicht gelesen werden." };
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  const lines: ShoppingSourceLine[] = [];
  for (const entry of portions) {
    const recipe = recipeById.get(entry.recipeId);
    if (!recipe) continue;
    // Geplante Portionen im Verhältnis zu den Portionen des Rezepts
    const factor = entry.servings / (recipe.servings || 1);
    for (const ri of recipe.recipe_ingredients) {
      lines.push({
        ingredientId: ri.ingredient_id,
        name: ri.ingredients.name,
        foodGroup: ri.ingredients.food_group,
        isStaple: ri.ingredients.is_staple,
        amount: ri.amount,
        unit: ri.unit,
        grams: ri.grams,
        factor,
      });
    }
  }

  const drafts = aggregateShopping(lines);
  const { data: count, error: saveError } = await supabase.rpc("replace_plan_shopping_items", {
    p_items: drafts.map((d) => ({ ingredient_id: d.ingredientId, name: d.name, amount: d.amount, unit: d.unit })),
  });
  if (saveError) return { ok: false, message: "Die Einkaufsliste konnte nicht gespeichert werden." };

  revalidatePath("/einkauf");
  return { ok: true, message: `${count ?? drafts.length} Zutaten aus ${entries.length} geplanten Mahlzeiten.` };
}

const manualSchema = z.object({
  name: z.string().trim().min(1, "Bitte gib einen Namen ein.").max(200, "Der Name ist zu lang."),
  amount: z.string().trim().max(40).default(""),
});

/**
 * Eigener Eintrag. Die Menge ist frei: „2“, „2 Packungen“, „500 g“.
 * Eine führende Zahl wird als Menge gespeichert, der Rest als Einheit.
 */
export async function addManualItemAction(input: { name: string; amount: string }): Promise<ShoppingResult> {
  const user = await requireUser();
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };

  const match = parsed.data.amount.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  const amount = match ? Number(match[1].replace(",", ".")) : null;
  const unit = match ? match[2].trim() || null : parsed.data.amount || null;

  const supabase = await createClient();
  const { error } = await supabase.from("shopping_list_items").insert({
    user_id: user.id,
    name: parsed.data.name,
    amount: amount != null && amount > 0 ? amount : null,
    unit,
    source: "manual",
  });
  if (error) return { ok: false, message: "Der Eintrag konnte nicht gespeichert werden." };

  revalidatePath("/einkauf");
  return { ok: true };
}

const idSchema = z.uuid();

export async function setItemCheckedAction(id: string, checked: boolean): Promise<ShoppingResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Ungültiger Eintrag." };

  const supabase = await createClient();
  const { error } = await supabase.from("shopping_list_items").update({ checked }).eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Das Abhaken hat nicht geklappt. Bitte versuch es noch einmal." };

  revalidatePath("/einkauf");
  return { ok: true };
}

export async function deleteItemAction(id: string): Promise<ShoppingResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Ungültiger Eintrag." };

  const supabase = await createClient();
  const { error } = await supabase.from("shopping_list_items").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Der Eintrag konnte nicht gelöscht werden." };

  revalidatePath("/einkauf");
  return { ok: true };
}

/** Erledigte oder alle Einträge löschen. */
export async function clearItemsAction(scope: "checked" | "all"): Promise<ShoppingResult> {
  const user = await requireUser();
  if (scope !== "checked" && scope !== "all") return { ok: false, message: "Ungültige Anfrage." };

  const supabase = await createClient();
  let query = supabase.from("shopping_list_items").delete().eq("user_id", user.id);
  if (scope === "checked") query = query.eq("checked", true);
  const { error } = await query;
  if (error) return { ok: false, message: "Das Aufräumen hat nicht geklappt." };

  revalidatePath("/einkauf");
  return { ok: true };
}

/** Grundzutaten (Salz, Öl …) ein- oder ausblenden. Wird in den Einstellungen des Nutzers gemerkt. */
export async function setHideStaplesAction(hide: boolean): Promise<ShoppingResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").update({ hide_staples: Boolean(hide) }).eq("user_id", user.id);
  if (error) return { ok: false, message: "Die Einstellung konnte nicht gespeichert werden." };

  revalidatePath("/einkauf");
  return { ok: true };
}
