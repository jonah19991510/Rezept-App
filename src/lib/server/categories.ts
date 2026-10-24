import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CategoryRow = { id: string; name: string; position: number };

/** Eigene Kategorien in ihrer Reihenfolge (Einstellungen → Kategorien). */
export async function getCategoryRows(userId: string): Promise<CategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_categories")
    .select("id, name, position")
    .eq("user_id", userId)
    .order("position")
    .order("created_at");
  if (error) throw new Error(`Kategorien konnten nicht geladen werden (${error.code})`);
  return data;
}

/** Nur die Namen, z. B. für Editor und Filter. */
export async function getCategoryNames(userId: string): Promise<string[]> {
  return (await getCategoryRows(userId)).map((c) => c.name);
}

/** Wie viele eigene Küchen-Rezepte je Kategorie (Name, Groß-/Kleinschreibung egal). */
export async function getCategoryCounts(userId: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("category_name")
    .eq("owner_id", userId)
    .eq("recipe_type", "dish")
    .not("category_name", "is", null);
  if (error) throw new Error(`Rezepte konnten nicht geladen werden (${error.code})`);
  const counts = new Map<string, number>();
  for (const r of data) {
    const key = r.category_name!.toLocaleLowerCase("de-DE");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
