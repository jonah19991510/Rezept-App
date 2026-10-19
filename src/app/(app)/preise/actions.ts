"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { paidPriceSchema, priceSchema, type PriceInput } from "@/lib/validation/kitchen-log";

export type PriceResult = { ok: true; message?: string } | { ok: false; message: string };

function revalidateCosts() {
  revalidatePath("/preise");
  revalidatePath("/einkauf");
  revalidatePath("/wochenplan");
  revalidatePath("/rezepte", "layout");
  revalidatePath("/statistik");
}

/** Preis für eine Zutat speichern; ein vorhandener Preis derselben Zutat wird ersetzt. */
export async function savePriceAction(input: PriceInput): Promise<PriceResult> {
  const user = await requireUser();
  const parsed = priceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Bitte prüfe die Eingaben." };
  const { ingredientId, price, packageAmount, packageUnit, store } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("ingredient_prices").upsert(
    {
      user_id: user.id,
      ingredient_id: ingredientId,
      price,
      package_amount: packageAmount,
      package_unit: packageUnit,
      store: store || null,
    },
    { onConflict: "user_id,ingredient_id" },
  );
  if (error) return { ok: false, message: "Der Preis konnte nicht gespeichert werden." };
  revalidateCosts();
  return { ok: true };
}

export async function deletePriceAction(id: string): Promise<PriceResult> {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Ungültiger Eintrag." };
  const supabase = await createClient();
  const { error } = await supabase.from("ingredient_prices").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Der Preis konnte nicht gelöscht werden." };
  revalidateCosts();
  return { ok: true };
}

const SHOPPING_TO_PRICE_UNIT: Record<string, "g" | "ml" | "piece"> = { g: "g", ml: "ml", Stück: "piece" };

/**
 * Schnelleingabe aus der Einkaufsliste: bezahlter Preis für die Menge des Eintrags (z. B. 2,49 € für 500 g).
 * Der Laden eines vorhandenen Preises bleibt erhalten.
 */
export async function savePaidPriceAction(input: { itemId: string; price: number }): Promise<PriceResult> {
  const user = await requireUser();
  const parsed = paidPriceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ungültiger Preis." };

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("shopping_list_items")
    .select("ingredient_id, amount, unit, name")
    .eq("id", parsed.data.itemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!item?.ingredient_id) return { ok: false, message: "Für eigene Einträge ohne Zutat lässt sich kein Preis speichern." };
  const unit = item.unit ? SHOPPING_TO_PRICE_UNIT[item.unit] : undefined;
  if (item.amount == null || !unit) return { ok: false, message: "Ohne Menge lässt sich der Preis nicht umrechnen. Trag ihn unter Preise ein." };

  const { error } = await supabase.from("ingredient_prices").upsert(
    { user_id: user.id, ingredient_id: item.ingredient_id, price: parsed.data.price, package_amount: item.amount, package_unit: unit },
    { onConflict: "user_id,ingredient_id" },
  );
  if (error) return { ok: false, message: "Der Preis konnte nicht gespeichert werden." };
  revalidateCosts();
  return { ok: true, message: `Preis für ${item.name} gespeichert.` };
}
