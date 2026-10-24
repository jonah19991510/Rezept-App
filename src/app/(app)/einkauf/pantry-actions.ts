"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { consumePantry, defaultLocation, isPantryUnit, mergeIntoPantry, type PantryEntry } from "@/lib/domain/pantry";
import { scaleFactor } from "@/lib/domain/scaling";
import { aggregateShopping, formatShoppingAmount } from "@/lib/domain/shopping";
import { getPantry, getRecipeLinesForPantry, neededForEntry } from "@/lib/server/pantry";
import { createClient } from "@/lib/supabase/server";
import {
  consumeSchema,
  displayNameSchema,
  pantryItemSchema,
  recipeIdSchema,
  shoppingToggleSchema,
  type PantryItemInput,
} from "@/lib/validation/pantry";

export type PantryResult = { ok: true; message?: string } | { ok: false; message: string };

function revalidatePantry() {
  revalidatePath("/einkauf");
  revalidatePath("/einkauf/vorrat");
  revalidatePath("/einkauf/was-kochen");
  revalidatePath("/einkauf/was-mixen");
  // Banner „sofort kochbar/mixbar“ über der Rezeptliste
  revalidatePath("/rezepte");
  revalidatePath("/rezepte/bar");
}

/** Zutat in den Vorrat legen oder ändern. Gleiche Zutat im selben Bereich wird überschrieben. */
export async function savePantryItemAction(input: PantryItemInput): Promise<PantryResult> {
  const user = await requireUser();
  const parsed = pantryItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Bitte prüfe die Eingaben." };
  const { id, ingredientId, location, amount, unit, expiresOn } = parsed.data;
  const values = { ingredient_id: ingredientId, location, amount, unit: amount == null ? null : unit, expires_on: expiresOn };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("pantry_items").update(values).eq("id", id).eq("user_id", user.id)
    : await supabase.from("pantry_items").upsert({ ...values, user_id: user.id }, { onConflict: "user_id,ingredient_id,location" });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Diese Zutat steht in diesem Bereich schon im Vorrat." };
    return { ok: false, message: "Der Vorrat konnte nicht gespeichert werden." };
  }
  revalidatePantry();
  return { ok: true };
}

export async function deletePantryItemAction(id: string): Promise<PantryResult> {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Ungültiger Eintrag." };
  const supabase = await createClient();
  const { error } = await supabase.from("pantry_items").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Der Eintrag konnte nicht gelöscht werden." };
  revalidatePantry();
  return { ok: true };
}

/**
 * Vorrat, Knopf „Liste“: fehlende Zutat auf die Einkaufsliste setzen (wie „Fehlende auf die Liste“ ohne Menge,
 * nie doppelt) bzw. mit „Auf Liste“ wieder herunternehmen. Herunter gehen nur offene Einträge dieser Zutat;
 * schon Abgehaktes bleibt für „In Vorrat übernehmen“ stehen.
 */
export async function setOnShoppingListAction(input: { ingredientId: string; onList: boolean }): Promise<PantryResult> {
  const user = await requireUser();
  const parsed = shoppingToggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Ungültige Zutat." };
  const { ingredientId, onList } = parsed.data;
  const supabase = await createClient();

  if (!onList) {
    const { error } = await supabase
      .from("shopping_list_items")
      .delete()
      .eq("user_id", user.id)
      .eq("ingredient_id", ingredientId)
      .eq("checked", false);
    if (error) return { ok: false, message: "Die Einkaufsliste konnte nicht geändert werden." };
    revalidatePantry();
    return { ok: true };
  }

  const [existing, ingredient] = await Promise.all([
    supabase
      .from("shopping_list_items")
      .select("id")
      .eq("user_id", user.id)
      .eq("ingredient_id", ingredientId)
      .eq("checked", false)
      .limit(1),
    supabase.from("ingredients").select("name").eq("id", ingredientId).maybeSingle(),
  ]);
  if (existing.error || ingredient.error) return { ok: false, message: "Die Einkaufsliste konnte nicht gelesen werden." };
  if (!ingredient.data) return { ok: false, message: "Die Zutat gibt es nicht mehr." };
  if (existing.data.length === 0) {
    const { error } = await supabase.from("shopping_list_items").insert({
      user_id: user.id,
      ingredient_id: ingredientId,
      name: ingredient.data.name,
      // „manual“: bleibt stehen, wenn die Liste neu aus dem Wochenplan erstellt wird
      source: "manual",
    });
    if (error) return { ok: false, message: "Die Einkaufsliste konnte nicht ergänzt werden." };
  }
  revalidatePantry();
  return { ok: true };
}

/** Kurznamen einer Zutat setzen; leer = wieder automatisch. Die Datenbankfunktion prüft, ob man die Zutat nutzt. */
export async function setIngredientDisplayNameAction(input: { ingredientId: string; displayName: string }): Promise<PantryResult> {
  await requireUser();
  const parsed = displayNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_ingredient_display_name", {
    p_ingredient_id: parsed.data.ingredientId,
    p_display_name: parsed.data.displayName,
  });
  if (error?.code === "42501") return { ok: false, message: "Diese Zutat kannst du nicht umbenennen." };
  if (error) return { ok: false, message: "Der Kurzname konnte nicht gespeichert werden." };
  revalidatePantry();
  revalidatePath("/zutaten");
  return { ok: true };
}

/**
 * „In Vorrat übernehmen“: abgehakte Einkäufe mit Zutat wandern in den Vorrat (gleiche Einheit wird addiert)
 * und verschwinden von der Liste. Eigene Einträge ohne Zutat bleiben stehen.
 */
export async function moveCheckedToPantryAction(): Promise<PantryResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("shopping_list_items")
    .select("id, ingredient_id, amount, unit, ingredients!shopping_list_items_ingredient_id_fkey(food_group)")
    .eq("user_id", user.id)
    .eq("checked", true)
    .not("ingredient_id", "is", null);
  if (error) return { ok: false, message: "Die Einkaufsliste konnte nicht gelesen werden." };
  if (items.length === 0) return { ok: false, message: "Abgehakt ist nichts, das zu einer Zutat gehört." };

  const pantry = await getPantry(user.id);
  const upserts = new Map<string, { ingredient_id: string; location: "kitchen" | "bar"; amount: number | null; unit: string | null }>();
  for (const item of items) {
    if (!item.ingredient_id || !item.ingredients) continue;
    const location = defaultLocation(item.ingredients.food_group);
    const key = `${item.ingredient_id}:${location}`;
    const existing =
      upserts.get(key) ?? pantry.find((p) => p.ingredientId === item.ingredient_id && p.location === location) ?? null;
    const merged = mergeIntoPantry(
      existing ? { amount: existing.amount, unit: isPantryUnit(existing.unit) ? existing.unit : null } : null,
      item,
    );
    upserts.set(key, { ingredient_id: item.ingredient_id, location, amount: merged.amount, unit: merged.unit });
  }

  const { error: upsertError } = await supabase
    .from("pantry_items")
    .upsert([...upserts.values()].map((v) => ({ ...v, user_id: user.id })), { onConflict: "user_id,ingredient_id,location" });
  if (upsertError) return { ok: false, message: "Der Vorrat konnte nicht aktualisiert werden." };

  const { error: deleteError } = await supabase
    .from("shopping_list_items")
    .delete()
    .eq("user_id", user.id)
    .in(
      "id",
      items.map((i) => i.id),
    );
  if (deleteError) return { ok: false, message: "Im Vorrat ist alles angekommen, die Liste konnte aber nicht aufgeräumt werden." };

  revalidatePantry();
  return { ok: true, message: `${upserts.size} ${upserts.size === 1 ? "Zutat" : "Zutaten"} in den Vorrat übernommen.` };
}

/** „Was kann ich kochen?“: fehlende Zutaten eines Rezepts (ohne Grundzutaten) auf die Einkaufsliste. */
export async function addMissingToShoppingAction(input: { recipeId: string }): Promise<PantryResult> {
  const user = await requireUser();
  const parsed = recipeIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Ungültiges Rezept." };

  const recipe = await getRecipeLinesForPantry(parsed.data.recipeId);
  if (!recipe) return { ok: false, message: "Das Rezept gibt es nicht mehr." };
  const supabase = await createClient();
  const [pantry, list] = await Promise.all([
    getPantry(user.id),
    supabase.from("shopping_list_items").select("ingredient_id").eq("user_id", user.id).eq("checked", false),
  ]);
  const have = new Set(pantry.map((p) => p.ingredientId));
  const onList = new Set((list.data ?? []).map((i) => i.ingredient_id));
  const missing = recipe.lines.filter((l) => !l.isStaple && !have.has(l.ingredientId) && !onList.has(l.ingredientId));
  if (missing.length === 0) return { ok: true, message: "Es fehlt nichts, oder es steht schon auf der Liste." };

  const drafts = aggregateShopping(missing.map((l) => ({ ...l, factor: 1 })));
  const { error } = await supabase.from("shopping_list_items").insert(
    drafts.map((d) => ({
      user_id: user.id,
      ingredient_id: d.ingredientId,
      name: d.name,
      amount: d.amount,
      unit: d.unit,
      // „manual“: bleibt stehen, wenn die Liste neu aus dem Wochenplan erstellt wird
      source: "manual" as const,
    })),
  );
  if (error) return { ok: false, message: "Die Einkaufsliste konnte nicht ergänzt werden." };

  revalidatePantry();
  return { ok: true, message: `${drafts.map((d) => d.name).join(", ")} auf die Einkaufsliste gesetzt.` };
}

export type ConsumptionRow = {
  pantryId: string;
  name: string;
  /** „500 g“ bzw. „vorhanden“ */
  before: string;
  /** „300 g“, „aufgebraucht“ oder null (Menge unbekannt: nur als aufgebraucht markierbar) */
  after: string | null;
};

function describe(entry: PantryEntry, needed: number | null): string | null {
  const result = consumePantry(entry, needed);
  if (result.action === "remove") return "aufgebraucht";
  if (result.action === "update") return formatShoppingAmount(result.amount, entry.unit);
  return null;
}

/** Vorschau für „Gekocht!“: welche Vorrats-Einträge dieses Rezept betrifft und was danach übrig ist. */
export async function previewConsumptionAction(input: { recipeId: string; servings: number }): Promise<ConsumptionRow[]> {
  const user = await requireUser();
  const parsed = consumeSchema.omit({ pantryIds: true }).safeParse(input);
  if (!parsed.success) return [];
  const recipe = await getRecipeLinesForPantry(parsed.data.recipeId);
  if (!recipe) return [];
  const factor = scaleFactor(parsed.data.servings, recipe.servings);
  const ids = new Set(recipe.lines.filter((l) => !l.isStaple).map((l) => l.ingredientId));
  const pantry = (await getPantry(user.id)).filter((p) => ids.has(p.ingredientId));
  return pantry.map((p) => ({
    pantryId: p.id,
    name: p.name,
    before: p.amount != null ? formatShoppingAmount(p.amount, p.unit) : "vorhanden",
    after: describe(p, neededForEntry(p, recipe.lines, factor)),
  }));
}

/**
 * Ausgewählte Vorrats-Einträge nach dem Kochen aktualisieren. Mengen rechnet der Server neu aus dem Rezept;
 * Einträge ohne bekannte Menge werden entfernt (der Nutzer hat sie als aufgebraucht markiert).
 */
export async function consumeAfterCookingAction(input: { recipeId: string; servings: number; pantryIds: string[] }): Promise<PantryResult> {
  const user = await requireUser();
  const parsed = consumeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Ungültige Eingabe." };
  const recipe = await getRecipeLinesForPantry(parsed.data.recipeId);
  if (!recipe) return { ok: false, message: "Das Rezept gibt es nicht mehr." };
  const factor = scaleFactor(parsed.data.servings, recipe.servings);
  const selected = (await getPantry(user.id)).filter((p) => parsed.data.pantryIds.includes(p.id));

  const supabase = await createClient();
  const removeIds: string[] = [];
  for (const entry of selected) {
    const result = consumePantry(entry, neededForEntry(entry, recipe.lines, factor));
    if (result.action === "update") {
      await supabase.from("pantry_items").update({ amount: result.amount }).eq("id", entry.id).eq("user_id", user.id);
    } else removeIds.push(entry.id); // aufgebraucht oder Menge unbekannt und ausgewählt
  }
  if (removeIds.length) await supabase.from("pantry_items").delete().eq("user_id", user.id).in("id", removeIds);

  revalidatePantry();
  return { ok: true, message: "Vorrat aktualisiert." };
}
