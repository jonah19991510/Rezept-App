import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePhotoPath, photoPaths, staleFilesInFolder, thumbPathOf } from "@/lib/domain/photo";
import { RECIPE_PHOTO_BUCKET } from "@/lib/storage";
import type { Database } from "@/lib/supabase/database.types";

// Alle Funktionen arbeiten mit dem Client des angemeldeten Nutzers: Die Storage-Policies gelten.

type Client = SupabaseClient<Database>;

/** Gibt es die Datei im Storage (und darf der Nutzer sie sehen)? */
export async function photoExists(supabase: Client, path: string): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  const { data, error } = await supabase.storage
    .from(RECIPE_PHOTO_BUCKET)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 2 });
  return !error && data.some((f) => f.name === path.slice(slash + 1));
}

/**
 * Löscht Dateien im Storage. Ein Fehler bricht die Aktion nicht ab (das Rezept ist schon gespeichert), landet aber
 * im Server-Log (Vercel → Logs); übrig gebliebene Dateien räumt das nächste Ersetzen oder Löschen mit weg.
 */
async function removeFiles(supabase: Client, paths: string[], context: string): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(RECIPE_PHOTO_BUCKET).remove(paths);
  if (error) console.error(`Rezeptfoto: Löschen im Storage fehlgeschlagen (${context})`, { paths, message: error.message });
}

/** Löscht Foto und Vorschaubild (z. B. ein gerade hochgeladenes Foto, das sich nicht eintragen ließ). */
export async function removePhotoFiles(supabase: Client, fullPath: string): Promise<void> {
  await removeFiles(supabase, [fullPath, thumbPathOf(fullPath)], "Foto");
}

/**
 * Räumt den Ordner <owner>/<rezept>/ auf: löscht alles außer `keepFullPath` und dessen Vorschaubild, also auch alte
 * Fotos und Reste abgebrochener Uploads. Ohne `keepFullPath` wird der Ordner geleert (Foto entfernen, Rezept löschen).
 */
export async function cleanRecipePhotoFolder(
  supabase: Client,
  userId: string,
  recipeId: string,
  keepFullPath: string | null,
): Promise<void> {
  const folder = `${userId}/${recipeId}`;
  const { data, error } = await supabase.storage.from(RECIPE_PHOTO_BUCKET).list(folder, { limit: 100 });
  if (error) {
    console.error("Rezeptfoto: Ordner im Storage nicht lesbar", { folder, message: error.message });
    return;
  }
  await removeFiles(supabase, staleFilesInFolder(folder, data.map((f) => f.name), keepFullPath), `Ordner ${folder}`);
}

/**
 * Kopiert das Foto eines Rezepts in den eigenen Ordner der Kopie (Duplizieren, Übernehmen) und setzt den Pfad.
 * Ohne Erfolg bleibt die Kopie ohne Foto; das Rezept selbst ist dann trotzdem angelegt.
 */
export async function copyPhotoToRecipe(
  supabase: Client,
  sourcePath: string | null,
  userId: string,
  newRecipeId: string,
): Promise<void> {
  const source = sourcePath ? parsePhotoPath(sourcePath) : null;
  if (!sourcePath || !source) return;
  const target = photoPaths(userId, newRecipeId, crypto.randomUUID(), source.ext);
  const bucket = supabase.storage.from(RECIPE_PHOTO_BUCKET);

  const full = await bucket.copy(sourcePath, target.full);
  if (full.error) return;
  const thumb = await bucket.copy(thumbPathOf(sourcePath), target.thumb);
  if (thumb.error) {
    await bucket.remove([target.full]);
    return;
  }
  const { error } = await supabase.from("recipes").update({ image_url: target.full }).eq("id", newRecipeId).eq("owner_id", userId);
  if (error) await bucket.remove([target.full, target.thumb]);
}
