"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { todayInBerlin } from "@/lib/domain/week";
import { cookLogSchema, type CookLogInput } from "@/lib/validation/cooking";
import { manualCookLogSchema, type ManualCookLogInput } from "@/lib/validation/kitchen-log";

/** „Gekocht!“: Eintrag im Koch-Log (auch für öffentliche Rezepte anderer, RLS prüft die Lesbarkeit). */
export async function saveCookLogAction(input: CookLogInput): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  const parsed = cookLogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  const { recipeId, rating, note, servings } = parsed.data;

  const supabase = await createClient();
  const { data: recipe } = await supabase.from("recipes").select("current_version").eq("id", recipeId).maybeSingle();
  if (!recipe) return { ok: false, message: "Das Rezept gibt es nicht mehr." };

  const { error } = await supabase.from("cook_logs").insert({
    user_id: user.id,
    recipe_id: recipeId,
    recipe_version: recipe.current_version,
    rating,
    note: note || null,
    servings,
  });
  if (error) return { ok: false, message: "Der Eintrag konnte nicht gespeichert werden." };

  revalidateCooking(recipeId);
  return { ok: true };
}

function revalidateCooking(recipeId: string) {
  revalidatePath(`/rezepte/${recipeId}`);
  revalidatePath("/rezepte");
  revalidatePath("/wochenplan");
  revalidatePath("/statistik");
}

/**
 * Koch-Log-Eintrag direkt auf der Rezeptseite (Phase 12), auch nachträglich mit Datum.
 * Gespeichert wird die aktuelle Rezeptversion; ein Tag in der Vergangenheit bekommt 12 Uhr als Uhrzeit.
 */
export async function addCookLogAction(input: ManualCookLogInput): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  const parsed = manualCookLogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  const { recipeId, date, rating, note, servings } = parsed.data;
  const today = todayInBerlin();
  if (date > today) return { ok: false, message: "Das Datum liegt in der Zukunft." };

  const supabase = await createClient();
  const { data: recipe } = await supabase.from("recipes").select("current_version").eq("id", recipeId).maybeSingle();
  if (!recipe) return { ok: false, message: "Das Rezept gibt es nicht mehr." };

  const { error } = await supabase.from("cook_logs").insert({
    user_id: user.id,
    recipe_id: recipeId,
    recipe_version: recipe.current_version,
    cooked_at: date === today ? new Date().toISOString() : `${date}T12:00:00Z`,
    rating,
    note: note || null,
    servings,
  });
  if (error) return { ok: false, message: "Der Eintrag konnte nicht gespeichert werden." };

  revalidateCooking(recipeId);
  return { ok: true };
}

export async function deleteCookLogAction(id: string): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Ungültiger Eintrag." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("cook_logs").delete().eq("id", id).eq("user_id", user.id).select("recipe_id");
  if (error || !data?.length) return { ok: false, message: "Der Eintrag konnte nicht gelöscht werden." };
  revalidateCooking(data[0].recipe_id);
  return { ok: true };
}
