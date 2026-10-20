import "server-only";
import { cache } from "react";
import sharp from "sharp";
import { parsePhotoPath, thumbPathOf } from "@/lib/domain/photo";
import { isShareToken, parseSharedRecipe, type SharedRecipe } from "@/lib/domain/shared-recipe";
import { RECIPE_PHOTO_BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { copyPhotoToRecipe } from "./photos";

// Teilen per Link (Phase 14). Gelesen wird nur über die Datenbankfunktion get_shared_recipe (Token prüft
// die Datenbank). Fotos liegen im privaten Bucket; für geteilte Rezepte liefert sie der Server mit dem
// Admin-Client aus – aber nur den Pfad, den get_shared_recipe zu einem gültigen Token zurückgibt.
// Der Speicherpfad (enthält die Nutzer-ID) verlässt dabei nie den Server.

/** Geteiltes Rezept zu einem Token; null, wenn der Link ungültig oder widerrufen ist. Einmal pro Request. */
export const getSharedRecipe = cache(async (token: string): Promise<SharedRecipe | null> => {
  if (!isShareToken(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_recipe", { p_token: token });
  if (error) throw new Error(`Geteiltes Rezept konnte nicht geladen werden (${error.code})`);
  return parseSharedRecipe(data);
});

/** Foto eines geteilten Rezepts (groß oder Vorschaubild) als Datei; null ohne Foto. */
export async function getSharedPhoto(
  token: string,
  size: "gross" | "klein" = "gross",
): Promise<{ data: Blob; contentType: string } | null> {
  const recipe = await getSharedRecipe(token);
  const path = recipe?.image_url;
  const parsed = path ? parsePhotoPath(path) : null;
  if (!path || !parsed) return null;
  const { data, error } = await createAdminClient()
    .storage.from(RECIPE_PHOTO_BUCKET)
    .download(size === "klein" ? thumbPathOf(path) : path);
  if (error || !data) return null;
  return { data, contentType: parsed.ext === "webp" ? "image/webp" : "image/jpeg" };
}

/**
 * Foto als JPEG-data:-URL für ImageResponse (Open-Graph- und Story-Bild), passend zugeschnitten.
 * Umwandeln ist nötig: Satori erkennt WebP, der Renderer (resvg) zeichnet es aber nicht.
 */
export async function getSharedPhotoDataUrl(token: string, box: { width: number; height: number }): Promise<string | null> {
  const photo = await getSharedPhoto(token, "gross");
  if (!photo) return null;
  try {
    const jpeg = await sharp(Buffer.from(await photo.data.arrayBuffer()))
      .resize(box.width, box.height, { fit: "cover" })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null; // Bild ohne Foto ist besser als gar keins
  }
}

export type ForkSharedResult = { ok: true; recipeId: string } | { ok: false; message: string };

/**
 * „In mein Rezeptbuch übernehmen“ von der geteilten Karte: Kopie per fork_shared_recipe (prüft Token und
 * Login), danach das Foto in den eigenen Ordner kopieren. Das Original kann privat sein, daher kopiert der
 * Admin-Client die Datei – Quelle ist nur der Pfad, den die Datenbank zum gültigen Token liefert.
 */
export async function forkSharedRecipe(token: string, userId: string): Promise<ForkSharedResult> {
  if (!isShareToken(token)) return { ok: false, message: "Der Link ist ungültig." };
  const supabase = await createClient();
  const { data: newId, error } = await supabase.rpc("fork_shared_recipe", { p_token: token });
  if (error || !newId) {
    if (error?.code === "P0002") return { ok: false, message: "Der Link wurde widerrufen." };
    return { ok: false, message: "Das Rezept konnte nicht übernommen werden." };
  }
  const shared = await getSharedRecipe(token);
  await copyPhotoToRecipe(createAdminClient(), shared?.image_url ?? null, userId, newId);
  return { ok: true, recipeId: newId };
}
