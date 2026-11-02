import { describe, expect, it } from "vitest";
import { lexiconEntrySchema } from "@/lib/validation/lexicon";
import {
  backlinks,
  canWriteLexicon,
  categoryCounts,
  categoryTree,
  cleanBlocks,
  cleanFacts,
  entryCategories,
  entryLetter,
  entryPreview,
  filterEntries,
  groupByCategory,
  groupByLetter,
  linkedTerms,
  parseInline,
  parseKeywords,
  parseRichText,
  plainText,
  termIndex,
  type LexiconCategory,
  type LexiconEntry,
} from "./lexicon";

const cat = (id: string, name: string, position: number, parentId: string | null = null): LexiconCategory => ({ id, parentId, name, color: "blau", position });
const categories = [cat("ern", "Ernährung", 1), cat("sup", "Supplements", 2), cat("amino", "Aminosäuren", 0, "ern"), cat("trn", "Training", 0)];

const entry = (patch: Partial<LexiconEntry> = {}): LexiconEntry => ({
  id: "e1",
  term: "Aspartam",
  facts: [],
  blocks: [],
  keywords: [],
  source: null,
  isPublic: true,
  categoryIds: [],
  createdBy: "u1",
  updatedAt: "2026-11-02T10:00:00Z",
  ...patch,
});

describe("Rechte", () => {
  it("vorerst schreiben nur Admins", () => {
    expect(canWriteLexicon("admin")).toBe(true);
    expect(canWriteLexicon("user")).toBe(false);
  });
});

describe("parseInline", () => {
  it("erkennt fett und Links, auch Links in fett", () => {
    expect(parseInline("Mehr zu **[[Kreatin]] und Co** bei [[Koffein|Kaffee]]!")).toEqual([
      { kind: "text", text: "Mehr zu " },
      { kind: "bold", children: [{ kind: "link", term: "Kreatin", label: "Kreatin" }, { kind: "text", text: " und Co" }] },
      { kind: "text", text: " bei " },
      { kind: "link", term: "Koffein", label: "Kaffee" },
      { kind: "text", text: "!" },
    ]);
  });

  it("lässt unvollständige Auszeichnung als Text stehen", () => {
    expect(parseInline("2 ** 3 und [[offen")).toEqual([{ kind: "text", text: "2 ** 3 und [[offen" }]);
    expect(parseInline("[[ ]]")).toEqual([{ kind: "text", text: "[[ ]]" }]);
  });
});

describe("parseRichText", () => {
  it("trennt Zwischenüberschriften, Absätze und Aufzählungen", () => {
    const blocks = parseRichText("## Aminosäuren\nPhenylalanin und\nAsparaginsäure.\n## Methanol\n- Giftig\n- 250g Äpfel\n\nNeuer Absatz");
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "heading", "list", "paragraph"]);
    expect(blocks[1]).toEqual({ kind: "paragraph", lines: [[{ kind: "text", text: "Phenylalanin und" }], [{ kind: "text", text: "Asparaginsäure." }]] });
    expect(blocks[3]).toEqual({ kind: "list", items: [[{ kind: "text", text: "Giftig" }], [{ kind: "text", text: "250g Äpfel" }]] });
  });

  it("Leerzeile beendet eine Aufzählung", () => {
    expect(parseRichText("- a\n\n- b").map((b) => b.kind)).toEqual(["list", "list"]);
  });
});

describe("plainText und Vorschau", () => {
  it("entfernt die Auszeichnung", () => {
    expect(plainText("## Titel\n- **fett** und [[Koffein|Kaffee]]\n[[Kreatin]]")).toBe("Titel fett und Kaffee Kreatin");
  });

  it("nimmt das erste Textfeld, sonst den ersten Fakt, sonst nichts", () => {
    expect(entryPreview(entry({ blocks: [{ type: "table", rows: [["a"]] }, { type: "text", text: "## Kurz\nText" }] }))).toBe("Kurz Text");
    expect(entryPreview(entry({ facts: [{ label: "Höchstmenge:", value: "40 mg/kg" }] }))).toBe("Höchstmenge: 40 mg/kg");
    expect(entryPreview(entry())).toBeNull();
  });
});

describe("Links", () => {
  const kreatin = entry({ id: "k", term: "Kreatin" });
  const aspartam = entry({
    id: "a",
    facts: [{ label: "Siehe", value: "[[kreatin]]" }],
    blocks: [{ type: "table", rows: [["[[Koffein|Kaffee]]", "[[Kreatin]]"]] }],
  });

  it("findet Begriffe ohne Rücksicht auf Groß-/Kleinschreibung", () => {
    expect(termIndex([kreatin]).get("kreatin")).toBe("k");
    expect(linkedTerms(aspartam)).toEqual(["kreatin", "Koffein"]);
  });

  it("listet Einträge, die hierher verlinken", () => {
    expect(backlinks(kreatin, [kreatin, aspartam]).map((e) => e.id)).toEqual(["a"]);
    expect(backlinks(aspartam, [kreatin, aspartam])).toEqual([]);
  });
});

describe("Kategorien", () => {
  it("baut den Baum nach Reihenfolge", () => {
    const tree = categoryTree(categories);
    expect(tree.map((c) => c.id)).toEqual(["trn", "ern", "sup"]);
    expect(tree[1].children.map((c) => c.id)).toEqual(["amino"]);
  });

  it("zählt Unterkategorien bei der Hauptkategorie mit, jeden Eintrag einmal", () => {
    const entries = [entry({ id: "1", categoryIds: ["ern", "amino"] }), entry({ id: "2", categoryIds: ["amino"] }), entry({ id: "3", categoryIds: ["sup"] })];
    const counts = categoryCounts(entries, categories);
    expect(counts.get("ern")).toBe(2);
    expect(counts.get("amino")).toBe(2);
    expect(counts.get("sup")).toBe(1);
    expect(counts.get("trn")).toBe(0);
  });

  it("zeigt Unterkategorie statt Hauptkategorie", () => {
    const shown = entryCategories(entry({ categoryIds: ["sup", "ern", "amino"] }), categories);
    expect(shown.map((s) => [s.category.id, s.parent?.id ?? null])).toEqual([
      ["amino", "ern"],
      ["sup", null],
    ]);
  });
});

describe("filterEntries", () => {
  const entries = [
    entry({ id: "a", term: "Aspartam", categoryIds: ["ern"], keywords: ["Süßstoff"] }),
    entry({ id: "k", term: "Kreatin", categoryIds: ["sup"], blocks: [{ type: "text", text: "Wirkt wie **Aspartam**? Nein." }] }),
    entry({ id: "p", term: "Phenylalanin", categoryIds: ["amino"] }),
    entry({ id: "e", term: "Ernährung und Aspartam-Mythen", categoryIds: [] }),
  ];

  it("ohne Suche alphabetisch, mit Kategorie samt Unterkategorien", () => {
    expect(filterEntries(entries, categories, { query: "", categoryId: null }).map((e) => e.id)).toEqual(["a", "e", "k", "p"]);
    expect(filterEntries(entries, categories, { query: "", categoryId: "ern" }).map((e) => e.id)).toEqual(["a", "p"]);
    expect(filterEntries(entries, categories, { query: "", categoryId: "amino" }).map((e) => e.id)).toEqual(["p"]);
  });

  it("Begriffe vor Treffern im Text; Umlaute und Groß-/Kleinschreibung egal", () => {
    expect(filterEntries(entries, categories, { query: "aspartam", categoryId: null }).map((e) => e.id)).toEqual(["a", "e", "k"]);
    expect(filterEntries(entries, categories, { query: "SÜSSSTOFF", categoryId: null }).map((e) => e.id)).toEqual(["a"]);
    expect(filterEntries(entries, categories, { query: "kreatin nein", categoryId: null }).map((e) => e.id)).toEqual(["k"]);
  });
});

describe("Gruppen", () => {
  it("A–Z mit Umlauten beim Grundbuchstaben und Ziffern unter #", () => {
    expect(entryLetter("Ölsäure")).toBe("O");
    expect(entryLetter("1RM")).toBe("#");
    const groups = groupByLetter([entry({ term: "1RM" }), entry({ term: "Aspartam" }), entry({ term: "Ölsäure" }), entry({ term: "Omega-3" })]);
    expect(groups.map((g) => [g.letter, g.items.length])).toEqual([
      ["#", 1],
      ["A", 1],
      ["O", 2],
    ]);
  });

  it("nach Kategorie: Unterkategorien als Abschnitte, ohne Kategorie am Ende", () => {
    const entries = [
      entry({ id: "1", categoryIds: ["ern"] }),
      entry({ id: "2", categoryIds: ["ern", "amino"] }),
      entry({ id: "3", categoryIds: ["sup", "trn"] }),
      entry({ id: "4", categoryIds: ["geloescht"] }),
    ];
    const groups = groupByCategory(entries, categories);
    expect(groups.map((g) => [g.category?.id ?? null, g.items.map((e) => e.id), g.sub.map((s) => [s.category.id, s.items.map((e) => e.id)])])).toEqual([
      ["trn", ["3"], []],
      ["ern", ["1"], [["amino", ["2"]]]],
      ["sup", ["3"], []],
      [null, ["4"], []],
    ]);
  });
});

describe("Eingaben aufräumen", () => {
  it("Stichworte", () => {
    expect(parseKeywords(" Hypertrophie, Kraft ,, kraft;  Muskel  aufbau ")).toEqual(["Hypertrophie", "Kraft", "Muskel aufbau"]);
  });

  it("Fakten ohne leere Zeilen", () => {
    expect(cleanFacts([{ label: " A: ", value: " 1 " }, { label: "", value: " " }])).toEqual([{ label: "A:", value: "1" }]);
  });

  it("Textfelder und Tabellen", () => {
    expect(
      cleanBlocks([
        { type: "text", text: "\n\nZeile  \r\nZwei\n\n" },
        { type: "text", text: "   " },
        { type: "table", rows: [["Kopf", "B", ""], ["", "", ""], ["1", "", ""], ["2"]] },
        { type: "table", rows: [["", ""]] },
      ]),
    ).toEqual([
      { type: "text", text: "Zeile\nZwei" },
      {
        type: "table",
        rows: [
          ["Kopf", "B"],
          ["1", ""],
          ["2", ""],
        ],
      },
    ]);
  });

  it("Schema: Begriff Pflicht, Fakt mit Wert braucht Bezeichnung", () => {
    const base = { term: "  Aspartam ", categoryIds: [], facts: [], blocks: [], keywords: "", source: " ", isPublic: false };
    const ok = lexiconEntrySchema.safeParse(base);
    expect(ok.success && ok.data).toMatchObject({ term: "Aspartam", source: null, keywords: [] });
    expect(lexiconEntrySchema.safeParse({ ...base, term: " " }).success).toBe(false);
    const missing = lexiconEntrySchema.safeParse({ ...base, facts: [{ label: "", value: "16 L" }] });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0].path).toEqual(["facts", 0, "label"]);
  });
});
