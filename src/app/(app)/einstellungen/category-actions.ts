"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { categoryNameSchema } from "@/lib/domain/categories";
import { createClient } from "@/lib/supabase/server";

export type CategoryResult = { ok: true; message?: string } | { ok: false; message: string };

const DUPLICATE = "Diese Kategorie gibt es schon.";

function refresh() {
  revalidatePath("/einstellungen");
  revalidatePath("/rezepte");
}

/** Neue eigene Kategorie, hinten an die Liste. */
export async function addCategoryAction(name: string): Promise<CategoryResult> {
  const user = await requireUser();
  const parsed = categoryNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ungültiger Name." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("recipe_categories")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("recipe_categories").insert({ name: parsed.data, position: (last?.position ?? 0) + 1 });
  if (error) return { ok: false, message: error.code === "23505" ? DUPLICATE : "Die Kategorie konnte nicht angelegt werden." };
  refresh();
  return { ok: true };
}

const renameSchema = z.object({ id: z.uuid(), name: categoryNameSchema });

/** Umbenennen; die eigenen Rezepte in dieser Kategorie ziehen mit (Funktion rename_recipe_category). */
export async function renameCategoryAction(input: { id: string; name: string }): Promise<CategoryResult> {
  await requireUser();
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ungültiger Name." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_recipe_category", { p_id: parsed.data.id, p_name: parsed.data.name });
  if (error) return { ok: false, message: error.code === "23505" ? DUPLICATE : "Die Kategorie konnte nicht umbenannt werden." };
  refresh();
  return { ok: true };
}

const deleteSchema = z.object({ id: z.uuid(), moveTo: z.string().trim().max(40).nullable() });

/** Löschen; Rezepte darin wandern in `moveTo` (andere eigene Kategorie) oder sind danach ohne Kategorie. */
export async function deleteCategoryAction(input: { id: string; moveTo: string | null }): Promise<CategoryResult> {
  await requireUser();
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Ungültige Angabe." };

  const supabase = await createClient();
  const { data: moved, error } = await supabase.rpc("delete_recipe_category", {
    p_id: parsed.data.id,
    p_move_to: parsed.data.moveTo ?? "",
  });
  if (error) return { ok: false, message: "Die Kategorie konnte nicht gelöscht werden." };
  refresh();
  const target = parsed.data.moveTo ? `„${parsed.data.moveTo}“` : "„ohne Kategorie“";
  return {
    ok: true,
    message: moved ? `Gelöscht. ${moved === 1 ? "1 Rezept steht" : `${moved} Rezepte stehen`} jetzt unter ${target}.` : "Gelöscht.",
  };
}
