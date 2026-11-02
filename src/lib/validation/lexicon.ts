import { z } from "zod";
import { DRINK_COLOR_KEYS, type DrinkColor } from "@/lib/domain/drinks";
import { cleanBlocks, cleanFacts, LEXICON_LIMITS as L, parseKeywords } from "@/lib/domain/lexicon";

// Lexikon: Eingaben. Leere Fakten, Textfelder und Tabellen fallen beim Speichern weg.

const fact = z.object({
  label: z.string().max(L.factLabel, `Bezeichnung höchstens ${L.factLabel} Zeichen.`),
  value: z.string().max(L.factValue, `Wert höchstens ${L.factValue} Zeichen.`),
});

const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().max(L.text, `Ein Textfeld hat höchstens ${L.text} Zeichen.`) }),
  z.object({
    type: z.literal("table"),
    rows: z
      .array(z.array(z.string().max(L.cell, `Eine Zelle hat höchstens ${L.cell} Zeichen.`)).max(L.tableCols, `Höchstens ${L.tableCols} Spalten.`))
      .max(L.tableRows, `Höchstens ${L.tableRows} Zeilen.`),
  }),
]);

export const lexiconEntrySchema = z
  .object({
    term: z.string().trim().min(1, "Bitte einen Begriff eingeben.").max(L.term, `Höchstens ${L.term} Zeichen.`),
    categoryIds: z.array(z.uuid()).max(30),
    facts: z.array(fact).max(L.facts, `Höchstens ${L.facts} Fakten.`).transform(cleanFacts),
    blocks: z.array(block).max(L.blocks, `Höchstens ${L.blocks} Text- und Tabellenfelder.`).transform(cleanBlocks),
    keywords: z.string().max(2000).transform(parseKeywords),
    source: z
      .string()
      .trim()
      .max(L.source, `Höchstens ${L.source} Zeichen.`)
      .transform((v) => v || null),
    isPublic: z.boolean(),
  })
  .superRefine((v, ctx) => {
    v.facts.forEach((f, i) => {
      if (!f.label) ctx.addIssue({ code: "custom", path: ["facts", i, "label"], message: "Bitte eine Bezeichnung eingeben." });
    });
    if (v.keywords.length > L.keywords) ctx.addIssue({ code: "custom", path: ["keywords"], message: `Höchstens ${L.keywords} Stichworte.` });
    if (v.keywords.some((k) => k.length > L.keyword)) ctx.addIssue({ code: "custom", path: ["keywords"], message: `Ein Stichwort hat höchstens ${L.keyword} Zeichen.` });
  });
export type LexiconEntryInput = z.input<typeof lexiconEntrySchema>;

export const lexiconCategorySchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(L.categoryName, `Höchstens ${L.categoryName} Zeichen.`),
  color: z.enum(DRINK_COLOR_KEYS as [DrinkColor, ...DrinkColor[]]),
  parentId: z.uuid().nullable(),
});
export type LexiconCategoryInput = z.input<typeof lexiconCategorySchema>;
