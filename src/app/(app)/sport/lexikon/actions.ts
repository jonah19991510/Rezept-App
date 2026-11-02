"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canWriteLexicon } from "@/lib/domain/lexicon";
import { createClient } from "@/lib/supabase/server";
import { lexiconCategorySchema, lexiconEntrySchema, type LexiconCategoryInput, type LexiconEntryInput } from "@/lib/validation/lexicon";
import { flattenIssues } from "@/lib/validation/recipe";

// Lexikon schreiben. Vorerst nur Admins (`canWriteLexicon`); die RLS prüft dasselbe (`private.can_write_lexicon()`).

const idSchema = z.uuid();

type Result = { ok: true } | { ok: false; message: string };
export type SaveResult = { ok: true; id: string } | { ok: false; message?: string; fieldErrors?: Record<string, string[]> };

const NO_RIGHTS = "Das Lexikon bearbeiten vorerst nur Admins.";

async function requireWriter() {
  const user = await requireUser();
  return canWriteLexicon(user.role) ? user : null;
}

function revalidateLexicon() {
  revalidatePath("/sport/lexikon");
}

/** Eintrag anlegen (`entryId` null) oder ändern, samt Kategorien. */
export async function saveEntryAction(entryId: string | null, input: LexiconEntryInput): Promise<SaveResult> {
  if (!(await requireWriter())) return { ok: false, message: NO_RIGHTS };
  if (entryId && !idSchema.safeParse(entryId).success) return { ok: false, message: "Ungültiger Eintrag." };
  const parsed = lexiconEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: flattenIssues(parsed.error) };
  const d = parsed.data;
  const row = { term: d.term, facts: d.facts, blocks: d.blocks, keywords: d.keywords, source: d.source, is_public: d.isPublic };

  const supabase = await createClient();
  const result = entryId
    ? await supabase.from("lexicon_entries").update(row).eq("id", entryId).select("id")
    : await supabase.from("lexicon_entries").insert(row).select("id");
  if (result.error?.code === "23505") return { ok: false, fieldErrors: { term: ["Diesen Begriff gibt es schon."] } };
  if (result.error) return { ok: false, message: "Der Eintrag konnte nicht gespeichert werden." };
  if (!result.data.length) return { ok: false, message: "Den Eintrag gibt es nicht mehr." };
  const id = result.data[0].id;

  // Kategorien: nur Unterschiede schreiben
  const current = await supabase.from("lexicon_entry_categories").select("category_id").eq("entry_id", id);
  if (current.error) return { ok: false, message: "Die Kategorien konnten nicht gespeichert werden." };
  const before = new Set(current.data.map((c) => c.category_id));
  const after = new Set(d.categoryIds);
  const removed = [...before].filter((c) => !after.has(c));
  const added = [...after].filter((c) => !before.has(c));
  const [del, ins] = await Promise.all([
    removed.length ? supabase.from("lexicon_entry_categories").delete().eq("entry_id", id).in("category_id", removed) : null,
    added.length ? supabase.from("lexicon_entry_categories").insert(added.map((category_id) => ({ entry_id: id, category_id }))) : null,
  ]);
  revalidateLexicon();
  if (del?.error || ins?.error) return { ok: false, message: "Gespeichert, aber die Kategorien nicht vollständig. Bitte noch einmal speichern." };
  return { ok: true, id };
}

/** Eintrag schnell veröffentlichen bzw. zurück zum Entwurf machen. */
export async function setEntryPublicAction(entryId: string, isPublic: boolean): Promise<Result> {
  if (!(await requireWriter())) return { ok: false, message: NO_RIGHTS };
  if (!idSchema.safeParse(entryId).success) return { ok: false, message: "Ungültiger Eintrag." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("lexicon_entries").update({ is_public: isPublic === true }).eq("id", entryId).select("id");
  if (error || !data.length) return { ok: false, message: "Das konnte nicht gespeichert werden." };
  revalidateLexicon();
  return { ok: true };
}

export async function deleteEntryAction(entryId: string): Promise<Result> {
  if (!(await requireWriter())) return { ok: false, message: NO_RIGHTS };
  if (!idSchema.safeParse(entryId).success) return { ok: false, message: "Ungültiger Eintrag." };
  const supabase = await createClient();
  const { error } = await supabase.from("lexicon_entries").delete().eq("id", entryId);
  if (error) return { ok: false, message: "Der Eintrag konnte nicht gelöscht werden." };
  revalidateLexicon();
  return { ok: true };
}

/** Kategorie anlegen (`categoryId` null, ans Ende ihrer Ebene) oder umbenennen/umfärben. */
export async function saveCategoryAction(categoryId: string | null, input: LexiconCategoryInput): Promise<SaveResult> {
  if (!(await requireWriter())) return { ok: false, message: NO_RIGHTS };
  if (categoryId && !idSchema.safeParse(categoryId).success) return { ok: false, message: "Ungültige Kategorie." };
  const parsed = lexiconCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: flattenIssues(parsed.error) };
  const d = parsed.data;

  const supabase = await createClient();
  let result;
  if (categoryId) {
    result = await supabase.from("lexicon_categories").update({ name: d.name, color: d.color }).eq("id", categoryId).select("id");
  } else {
    const siblings = supabase.from("lexicon_categories").select("position").order("position", { ascending: false }).limit(1);
    const last = await (d.parentId ? siblings.eq("parent_id", d.parentId) : siblings.is("parent_id", null)).maybeSingle();
    result = await supabase
      .from("lexicon_categories")
      .insert({ name: d.name, color: d.color, parent_id: d.parentId, position: (last.data?.position ?? -1) + 1 })
      .select("id");
  }
  if (result.error?.code === "23505") return { ok: false, fieldErrors: { name: ["Diese Kategorie gibt es hier schon."] } };
  if (result.error?.code === "23514") return { ok: false, message: "Unterkategorien gibt es nur eine Ebene tief." };
  if (result.error) return { ok: false, message: "Die Kategorie konnte nicht gespeichert werden." };
  if (!result.data.length) return { ok: false, message: "Die Kategorie gibt es nicht mehr." };
  revalidateLexicon();
  return { ok: true, id: result.data[0].id };
}

/** Reihenfolge einer Ebene speichern: Position = Index in `ids`. */
export async function reorderCategoriesAction(ids: string[]): Promise<Result> {
  if (!(await requireWriter())) return { ok: false, message: NO_RIGHTS };
  const parsed = z.array(idSchema).max(200).safeParse(ids);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) return { ok: false, message: "Ungültige Reihenfolge." };
  const supabase = await createClient();
  const results = await Promise.all(parsed.data.map((id, position) => supabase.from("lexicon_categories").update({ position }).eq("id", id)));
  if (results.some((r) => r.error)) return { ok: false, message: "Die Reihenfolge konnte nicht gespeichert werden." };
  revalidateLexicon();
  return { ok: true };
}

/** Kategorie löschen (Unterkategorien mit); die Einträge bleiben, nur die Zuordnung fällt weg. */
export async function deleteCategoryAction(categoryId: string): Promise<Result> {
  if (!(await requireWriter())) return { ok: false, message: NO_RIGHTS };
  if (!idSchema.safeParse(categoryId).success) return { ok: false, message: "Ungültige Kategorie." };
  const supabase = await createClient();
  const { error } = await supabase.from("lexicon_categories").delete().eq("id", categoryId);
  if (error) return { ok: false, message: "Die Kategorie konnte nicht gelöscht werden." };
  revalidateLexicon();
  return { ok: true };
}
