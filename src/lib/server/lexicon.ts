import "server-only";
import type { LexiconBlock, LexiconCategory, LexiconEntry, LexiconFact } from "@/lib/domain/lexicon";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// Lexikon lesen. Mit dem Client des Nutzers: die RLS liefert Entwürfe nur an Ersteller und Admins.

const ENTRY_COLUMNS = "id, term, facts, blocks, keywords, source, is_public, created_by, updated_at, lexicon_entry_categories(category_id)";

const isRecord = (v: Json): v is { [key: string]: Json | undefined } => typeof v === "object" && v !== null && !Array.isArray(v);

function toFacts(value: Json): LexiconFact[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((f) => ({ label: String(f.label ?? ""), value: String(f.value ?? "") }));
}

function toBlocks(value: Json): LexiconBlock[] {
  if (!Array.isArray(value)) return [];
  const out: LexiconBlock[] = [];
  for (const b of value.filter(isRecord)) {
    if (b.type === "text") out.push({ type: "text", text: String(b.text ?? "") });
    else if (b.type === "table" && Array.isArray(b.rows))
      out.push({ type: "table", rows: b.rows.filter(Array.isArray).map((r) => r.map((c) => (c == null ? "" : String(c)))) });
  }
  return out;
}

/** Alle sichtbaren Einträge (mit Inhalt) und alle Kategorien. */
export async function getLexicon(): Promise<{ entries: LexiconEntry[]; categories: LexiconCategory[] }> {
  const supabase = await createClient();
  const [entries, categories] = await Promise.all([
    supabase.from("lexicon_entries").select(ENTRY_COLUMNS).order("term"),
    supabase.from("lexicon_categories").select("id, parent_id, name, color, position").order("position"),
  ]);
  if (entries.error) throw new Error(`Lexikon konnte nicht gelesen werden (${entries.error.code})`);
  if (categories.error) throw new Error(`Lexikon-Kategorien konnten nicht gelesen werden (${categories.error.code})`);
  return {
    entries: entries.data.map((e) => ({
      id: e.id,
      term: e.term,
      facts: toFacts(e.facts),
      blocks: toBlocks(e.blocks),
      keywords: e.keywords ?? [],
      source: e.source,
      isPublic: e.is_public,
      categoryIds: e.lexicon_entry_categories.map((c) => c.category_id),
      createdBy: e.created_by,
      updatedAt: e.updated_at,
    })),
    categories: categories.data.map((c) => ({ id: c.id, parentId: c.parent_id, name: c.name, color: c.color, position: c.position })),
  };
}
