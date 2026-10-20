"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setRecipeShareSchema, type SetRecipeShareInput } from "@/lib/validation/community";

export type SetRecipeShareResult = { ok: true; token: string | null } | { ok: false; message: string };

/** „Link teilen“ (Token erzeugen bzw. vorhandenen behalten) oder „Link widerrufen“. Nur der Owner. */
export async function setRecipeShareAction(input: SetRecipeShareInput): Promise<SetRecipeShareResult> {
  await requireUser();
  const parsed = setRecipeShareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Ungültige Eingabe." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_recipe_share", {
    p_recipe_id: parsed.data.recipeId,
    p_enabled: parsed.data.enabled,
  });
  if (error) {
    if (error.code === "P0002") return { ok: false, message: "Das Rezept gibt es nicht mehr oder es gehört dir nicht." };
    return { ok: false, message: "Das hat nicht geklappt. Bitte versuch es noch einmal." };
  }
  revalidatePath(`/rezepte/${parsed.data.recipeId}`);
  return { ok: true, token: data ?? null };
}
