"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cookLogSchema, type CookLogInput } from "@/lib/validation/cooking";

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

  revalidatePath(`/rezepte/${recipeId}`);
  return { ok: true };
}
