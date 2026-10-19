"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isOwnPhotoPath, photoPaths } from "@/lib/domain/photo";
import { photoExists, removePhotoFiles } from "@/lib/server/photos";
import { createClient } from "@/lib/supabase/server";
import { preparePhotoSchema, removePhotoSchema, setPhotoSchema } from "@/lib/validation/photo";

type Fail = { ok: false; message: string };

function revalidateRecipe(recipeId: string) {
  revalidatePath("/rezepte");
  revalidatePath(`/rezepte/${recipeId}`);
  revalidatePath("/entdecken");
}

/**
 * Schritt 1 des Uploads: prüft, dass das Rezept dem Nutzer gehört, und vergibt die Pfade.
 * Hochgeladen wird danach direkt aus dem Browser in den Storage (Policies prüfen den Ordner erneut).
 */
export async function preparePhotoUploadAction(input: {
  recipeId: string;
  ext: "webp" | "jpg";
}): Promise<{ ok: true; full: string; thumb: string } | Fail> {
  const user = await requireUser();
  const parsed = preparePhotoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Ungültige Eingabe." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", parsed.data.recipeId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!data) return { ok: false, message: "Das Rezept gibt es nicht mehr oder es gehört dir nicht." };

  return { ok: true, ...photoPaths(user.id, parsed.data.recipeId, crypto.randomUUID(), parsed.data.ext) };
}

/** Schritt 2: hochgeladenes Foto am Rezept eintragen, das alte Foto löschen. */
export async function setRecipePhotoAction(input: { recipeId: string; path: string }): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const parsed = setPhotoSchema.safeParse(input);
  if (!parsed.success || !isOwnPhotoPath(parsed.data.path, user.id, parsed.data.recipeId)) {
    return { ok: false, message: "Ungültiges Foto." };
  }
  const { recipeId, path } = parsed.data;

  const supabase = await createClient();
  if (!(await photoExists(supabase, path))) return { ok: false, message: "Das Foto ist nicht angekommen. Bitte noch einmal versuchen." };

  const { data: before } = await supabase
    .from("recipes")
    .select("image_url")
    .eq("id", recipeId)
    .eq("owner_id", user.id)
    .maybeSingle();
  const { data, error } = await supabase
    .from("recipes")
    .update({ image_url: path })
    .eq("id", recipeId)
    .eq("owner_id", user.id)
    .select("id");
  if (error || !data?.length) {
    await removePhotoFiles(supabase, path);
    return { ok: false, message: "Das Foto konnte nicht gespeichert werden." };
  }
  if (before?.image_url && before.image_url !== path) await removePhotoFiles(supabase, before.image_url);

  revalidateRecipe(recipeId);
  return { ok: true };
}

/** Foto entfernen (Datei und Verweis). */
export async function removeRecipePhotoAction(input: { recipeId: string }): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const parsed = removePhotoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Ungültiges Rezept." };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("recipes")
    .select("image_url")
    .eq("id", parsed.data.recipeId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!before) return { ok: false, message: "Das Rezept gibt es nicht mehr oder es gehört dir nicht." };

  const { error } = await supabase
    .from("recipes")
    .update({ image_url: null })
    .eq("id", parsed.data.recipeId)
    .eq("owner_id", user.id);
  if (error) return { ok: false, message: "Das Foto konnte nicht entfernt werden." };
  if (before.image_url) await removePhotoFiles(supabase, before.image_url);

  revalidateRecipe(parsed.data.recipeId);
  return { ok: true };
}
