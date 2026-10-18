import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RECIPE_PHOTO_BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type AdminClient = SupabaseClient<Database>;

/**
 * Löscht einen Nutzer vollständig: zuerst seine Fotos im Storage (die
 * verschwinden nicht per Cascade), dann den Auth-User. Alle Tabellenzeilen
 * hängen per ON DELETE CASCADE an profiles → auth.users und gehen mit.
 * Wird von der Admin-Seite und später von „Account löschen“ genutzt.
 */
export async function deleteUserCompletely(userId: string): Promise<void> {
  const admin = createAdminClient();
  await removeStorageFolder(admin, RECIPE_PHOTO_BUCKET, userId);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`Auth-User konnte nicht gelöscht werden: ${error.message}`);
}

async function removeStorageFolder(admin: AdminClient, bucket: string, folder: string): Promise<void> {
  const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
  if (bucketError) throw new Error(`Storage nicht erreichbar: ${bucketError.message}`);
  if (!buckets.some((b) => b.id === bucket)) return; // Bucket gibt es noch nicht (vor Phase 7)

  const paths = await listFilesRecursive(admin, bucket, folder);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) throw new Error(`Fotos konnten nicht gelöscht werden: ${error.message}`);
  }
}

async function listFilesRecursive(admin: AdminClient, bucket: string, folder: string): Promise<string[]> {
  const files: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: pageSize, offset });
    if (error) throw new Error(`Fotos konnten nicht gelistet werden: ${error.message}`);
    for (const entry of data) {
      const path = `${folder}/${entry.name}`;
      // Ordner haben keine id
      if (entry.id === null) files.push(...(await listFilesRecursive(admin, bucket, path)));
      else files.push(path);
    }
    if (data.length < pageSize) break;
  }
  return files;
}
