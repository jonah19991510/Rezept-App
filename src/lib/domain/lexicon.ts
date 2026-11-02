// Lexikon (Sport & Gesundheit, 02.11.2026): reine Logik ohne Datenbank.
// Einträge mit Fakten, Textfeldern und Tabellen; Kategorien mit einer Ebene Unterkategorien; [[Begriff]]-Links.

import type { Enums } from "@/lib/supabase/database.types";
import { normalizeSearch } from "./exercises";

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export type LexiconCategory = { id: string; parentId: string | null; name: string; color: string; position: number };
export type LexiconFact = { label: string; value: string };
export type LexiconBlock = { type: "text"; text: string } | { type: "table"; rows: string[][] };

export type LexiconEntry = {
  id: string;
  term: string;
  facts: LexiconFact[];
  blocks: LexiconBlock[];
  keywords: string[];
  source: string | null;
  /** false = Entwurf, nur für Ersteller und Admins sichtbar */
  isPublic: boolean;
  categoryIds: string[];
  createdBy: string | null;
  /** ISO-Zeitpunkt der letzten Änderung */
  updatedAt: string;
};

export type CategoryNode = LexiconCategory & { children: LexiconCategory[] };

/** Grenzen (wie in der Migration bzw. großzügig darunter). */
export const LEXICON_LIMITS = {
  term: 80,
  facts: 50,
  factLabel: 80,
  factValue: 1000,
  blocks: 50,
  text: 20000,
  tableRows: 60,
  tableCols: 8,
  cell: 500,
  keywords: 30,
  keyword: 40,
  source: 1000,
  categoryName: 40,
} as const;

// ---------------------------------------------------------------------------
// Rechte
// ---------------------------------------------------------------------------

/**
 * Wer Einträge und Kategorien schreiben darf. Vorerst nur Admins (Wunsch des Nutzers). Muss zu
 * `private.can_write_lexicon()` in der Datenbank passen; zum Freigeben beides ändern.
 */
export function canWriteLexicon(role: Enums<"user_role">): boolean {
  return role === "admin";
}

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

const byPosition = (a: LexiconCategory, b: LexiconCategory) => a.position - b.position || a.name.localeCompare(b.name, "de");

/** Hauptkategorien mit ihren Unterkategorien, beide nach Reihenfolge. Verwaiste Unterkategorien fallen weg. */
export function categoryTree(categories: LexiconCategory[]): CategoryNode[] {
  return categories
    .filter((c) => c.parentId == null)
    .sort(byPosition)
    .map((c) => ({ ...c, children: categories.filter((s) => s.parentId === c.id).sort(byPosition) }));
}

/** IDs, die zu einer gewählten Kategorie zählen: bei Hauptkategorien auch alle Unterkategorien. */
export function categoryScope(categoryId: string, categories: LexiconCategory[]): Set<string> {
  return new Set([categoryId, ...categories.filter((c) => c.parentId === categoryId).map((c) => c.id)]);
}

/** Einträge je Kategorie (Hauptkategorien zählen ihre Unterkategorien mit, jeder Eintrag einmal). */
export function categoryCounts(entries: LexiconEntry[], categories: LexiconCategory[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of categories) {
    const scope = categoryScope(c.id, categories);
    counts.set(c.id, entries.filter((e) => e.categoryIds.some((id) => scope.has(id))).length);
  }
  return counts;
}

/**
 * Kategorien eines Eintrags zum Anzeigen, in Baum-Reihenfolge. Ist eine Unterkategorie gewählt, steht sie (mit
 * ihrer Hauptkategorie als `parent`) statt der Hauptkategorie da.
 */
export function entryCategories(entry: LexiconEntry, categories: LexiconCategory[]): { category: LexiconCategory; parent: LexiconCategory | null }[] {
  const out: { category: LexiconCategory; parent: LexiconCategory | null }[] = [];
  for (const node of categoryTree(categories)) {
    const subs = node.children.filter((s) => entry.categoryIds.includes(s.id));
    if (subs.length) for (const s of subs) out.push({ category: s, parent: node });
    else if (entry.categoryIds.includes(node.id)) out.push({ category: node, parent: null });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Text: Absätze, Aufzählungen, Zwischenüberschriften, **fett**, [[Begriff]]
// ---------------------------------------------------------------------------

export type Inline = { kind: "text"; text: string } | { kind: "bold"; children: Inline[] } | { kind: "link"; term: string; label: string };
export type RichBlock = { kind: "heading"; inline: Inline[] } | { kind: "paragraph"; lines: Inline[][] } | { kind: "list"; items: Inline[][] };

const LINK = /\[\[([^[\]\n]+?)\]\]/g;

function parseLinks(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    // [[Ziel|Anzeigetext]]
    const [target, label] = m[1].split("|", 2).map((s) => s.trim());
    if (target) out.push({ kind: "link", term: target, label: label || target });
    else out.push({ kind: "text", text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/** Eine Zeile: **fett** (darf Links enthalten) und [[Begriff]] bzw. [[Begriff|Text]]. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(/\*\*(.+?)\*\*/g)) {
    if (m.index > last) out.push(...parseLinks(text.slice(last, m.index)));
    out.push({ kind: "bold", children: parseLinks(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...parseLinks(text.slice(last)));
  return out;
}

const LIST_ITEM = /^\s*[-•*]\s+/;
const HEADING = /^\s*#{1,3}\s+/;

/** Text eines Textfelds in Blöcke: „## “ Zwischenüberschrift, „- “ Aufzählung, Leerzeile trennt Absätze. */
export function parseRichText(text: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  let current: RichBlock | null = null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flush();
    } else if (HEADING.test(line)) {
      flush();
      blocks.push({ kind: "heading", inline: parseInline(line.replace(HEADING, "")) });
    } else if (LIST_ITEM.test(line)) {
      if (current?.kind !== "list") {
        flush();
        current = { kind: "list", items: [] };
      }
      current.items.push(parseInline(line.replace(LIST_ITEM, "")));
    } else {
      if (current?.kind !== "paragraph") {
        flush();
        current = { kind: "paragraph", lines: [] };
      }
      current.lines.push(parseInline(line.trim()));
    }
  }
  flush();
  return blocks;
}

/** Text ohne Auszeichnung (für Vorschau und Suche). */
export function plainText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(HEADING, "").replace(LIST_ITEM, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(LINK, (_, inner: string) => {
      const [target, label] = inner.split("|", 2).map((s) => s.trim());
      return label || target;
    });
}

/** Vorschau in der Liste: erstes Textfeld, sonst erster Fakt; null = noch kein Text. */
export function entryPreview(entry: LexiconEntry): string | null {
  const text = entry.blocks.find((b): b is Extract<LexiconBlock, { type: "text" }> => b.type === "text" && b.text.trim() !== "");
  if (text) return plainText(text.text);
  const fact = entry.facts[0];
  if (fact) return plainText(`${fact.label} ${fact.value}`);
  return null;
}

// ---------------------------------------------------------------------------
// Links zwischen Einträgen
// ---------------------------------------------------------------------------

/** Schlüssel für Begriffe: wie der eindeutige Index in der Datenbank (Groß-/Kleinschreibung egal). */
export function termKey(term: string): string {
  return term.trim().replace(/\s+/g, " ").toLocaleLowerCase("de");
}

/** Begriff → Eintrag, für [[Begriff]]-Links. */
export function termIndex(entries: LexiconEntry[]): Map<string, string> {
  return new Map(entries.map((e) => [termKey(e.term), e.id]));
}

/** Begriffe, auf die ein Eintrag verlinkt (in Fakten, Texten und Tabellen), ohne Doppelte. */
export function linkedTerms(entry: LexiconEntry): string[] {
  const texts = [
    ...entry.facts.flatMap((f) => [f.label, f.value]),
    ...entry.blocks.flatMap((b) => (b.type === "text" ? [b.text] : b.rows.flat())),
  ];
  const seen = new Map<string, string>();
  for (const t of texts)
    for (const m of t.matchAll(LINK)) {
      const target = m[1].split("|", 1)[0].trim();
      if (target && !seen.has(termKey(target))) seen.set(termKey(target), target);
    }
  return [...seen.values()];
}

/** Einträge, die auf diesen verlinken („Verweise hierher“), alphabetisch. */
export function backlinks(entry: LexiconEntry, entries: LexiconEntry[]): LexiconEntry[] {
  const key = termKey(entry.term);
  return entries
    .filter((e) => e.id !== entry.id && linkedTerms(e).some((t) => termKey(t) === key))
    .sort((a, b) => a.term.localeCompare(b.term, "de"));
}

// ---------------------------------------------------------------------------
// Suche, Filter, Gruppen
// ---------------------------------------------------------------------------

function searchText(entry: LexiconEntry): string {
  return normalizeSearch(
    [
      ...entry.keywords,
      ...entry.facts.flatMap((f) => [f.label, f.value]),
      ...entry.blocks.flatMap((b) => (b.type === "text" ? [plainText(b.text)] : b.rows.flat().map(plainText))),
      entry.source ?? "",
    ].join(" "),
  );
}

/**
 * Einträge nach Suche und Kategorie. Ohne Suche alphabetisch; mit Suche zuerst Begriffe, die mit der Suche beginnen,
 * dann Begriffe, die sie enthalten, dann Treffer in Stichworten, Fakten und Text. Alle Suchwörter müssen vorkommen.
 */
export function filterEntries(
  entries: LexiconEntry[],
  categories: LexiconCategory[],
  { query, categoryId }: { query: string; categoryId: string | null },
): LexiconEntry[] {
  const scope = categoryId ? categoryScope(categoryId, categories) : null;
  const inScope = scope ? entries.filter((e) => e.categoryIds.some((id) => scope.has(id))) : entries;
  const alpha = (a: LexiconEntry, b: LexiconEntry) => a.term.localeCompare(b.term, "de");
  const q = normalizeSearch(query);
  if (!q) return [...inScope].sort(alpha);
  const words = q.split(" ");
  const ranked: { entry: LexiconEntry; rank: number }[] = [];
  for (const entry of inScope) {
    const term = normalizeSearch(entry.term);
    const all = `${term} ${searchText(entry)}`;
    if (!words.every((w) => all.includes(w))) continue;
    const rank = term.startsWith(q) ? 0 : term.includes(q) ? 1 : words.every((w) => term.includes(w)) ? 2 : 3;
    ranked.push({ entry, rank });
  }
  return ranked.sort((a, b) => a.rank - b.rank || alpha(a.entry, b.entry)).map((r) => r.entry);
}

/** Anfangsbuchstabe fürs A–Z: Umlaute unter dem Grundbuchstaben, Ziffern und Zeichen unter „#“. */
export function entryLetter(term: string): string {
  const first = normalizeSearch(term).charAt(0).toUpperCase();
  return first >= "A" && first <= "Z" ? first : "#";
}

/** A–Z-Gruppen in Reihenfolge („#“ zuerst), Einträge in der gegebenen Reihenfolge. */
export function groupByLetter(entries: LexiconEntry[]): { letter: string; items: LexiconEntry[] }[] {
  const groups = new Map<string, LexiconEntry[]>();
  for (const e of entries) {
    const letter = entryLetter(e.term);
    groups.set(letter, [...(groups.get(letter) ?? []), e]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "#" ? -1 : b === "#" ? 1 : a.localeCompare(b)))
    .map(([letter, items]) => ({ letter, items }));
}

export type CategoryGroup = {
  category: LexiconCategory | null;
  /** direkt in der Hauptkategorie (bzw. ohne Kategorie) */
  items: LexiconEntry[];
  sub: { category: LexiconCategory; items: LexiconEntry[] }[];
};

/**
 * Ansicht „Kategorien“: je Hauptkategorie die Einträge direkt darin und je Unterkategorie ein Abschnitt. Ein Eintrag
 * in mehreren Kategorien steht in jeder. Leere Gruppen fallen weg; Einträge ohne Kategorie stehen am Ende.
 */
export function groupByCategory(entries: LexiconEntry[], categories: LexiconCategory[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const node of categoryTree(categories)) {
    const sub = node.children.map((s) => ({ category: s as LexiconCategory, items: entries.filter((e) => e.categoryIds.includes(s.id)) })).filter((s) => s.items.length);
    const inSub = new Set(sub.flatMap((s) => s.items.map((e) => e.id)));
    // Steht ein Eintrag schon in einer Unterkategorie, nicht noch einmal direkt darüber
    const items = entries.filter((e) => e.categoryIds.includes(node.id) && !inSub.has(e.id));
    if (items.length || sub.length) groups.push({ category: { id: node.id, parentId: null, name: node.name, color: node.color, position: node.position }, items, sub });
  }
  const known = new Set(categories.map((c) => c.id));
  const loose = entries.filter((e) => !e.categoryIds.some((id) => known.has(id)));
  if (loose.length) groups.push({ category: null, items: loose, sub: [] });
  return groups;
}

// ---------------------------------------------------------------------------
// Eingaben aufräumen (vor dem Speichern)
// ---------------------------------------------------------------------------

/** Stichworte aus „Hypertrophie, Kraft“: getrimmt, ohne leere und doppelte (Groß-/Kleinschreibung egal). */
export function parseKeywords(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,;\n]/)) {
    const k = raw.trim().replace(/\s+/g, " ");
    const key = k.toLocaleLowerCase("de");
    if (k && !seen.has(key)) {
      seen.add(key);
      out.push(k);
    }
  }
  return out;
}

/** Fakten ohne ganz leere Zeilen, Ränder getrimmt. */
export function cleanFacts(facts: LexiconFact[]): LexiconFact[] {
  return facts.map((f) => ({ label: f.label.trim(), value: f.value.trim() })).filter((f) => f.label || f.value);
}

/**
 * Inhalt ohne leere Textfelder und leere Tabellen. Tabellen: Zellen getrimmt, leere Zeilen und leere Spalten am Ende
 * weg, alle Zeilen gleich lang.
 */
export function cleanBlocks(blocks: LexiconBlock[]): LexiconBlock[] {
  const out: LexiconBlock[] = [];
  for (const b of blocks) {
    if (b.type === "text") {
      const text = b.text.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/^\n+|\n+$/g, "");
      if (text.trim()) out.push({ type: "text", text });
      continue;
    }
    let rows = b.rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
    if (!rows.length) continue;
    let width = Math.max(...rows.map((r) => r.length));
    while (width > 1 && rows.every((r) => !r[width - 1])) width--;
    rows = rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
    out.push({ type: "table", rows });
  }
  return out;
}
