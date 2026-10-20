"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isShareToken } from "@/lib/domain/shared-recipe";
import { forkSharedRecipe } from "@/lib/server/shared-recipes";

/** „In mein Rezeptbuch übernehmen“ auf der geteilten Karte. Ohne Login geht es zur Anmeldung und zurück. */
export async function forkSharedRecipeAction(token: string): Promise<{ ok: false; message: string }> {
  if (!isShareToken(token)) return { ok: false, message: "Der Link ist ungültig." };
  const user = await getCurrentUser();
  if (!user) redirect(`/login?weiter=${encodeURIComponent(`/r/${token}`)}`);
  const result = await forkSharedRecipe(token, user.id);
  if (!result.ok) return result;
  revalidatePath("/rezepte");
  redirect(`/rezepte/${result.recipeId}?uebernommen=1`);
}
