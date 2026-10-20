import { describe, expect, it } from "vitest";
import { recipeInputSchema } from "@/lib/validation/recipe";
import type { ImportLine } from "./import-draft";
import { initialChoices } from "./import-draft";
import type { IngredientOption } from "./ingredient-option";
import { parseIngredientLine } from "./ingredient-line";
import { certainRecipeInput, markdownEditorInitial, reviewReasons, toImportDraft } from "./markdown-draft";
import { parseMarkdownFiles } from "./markdown-import";

const ing = (id: string, name: string, extra: Partial<IngredientOption> = {}): IngredientOption => ({
  id, name, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, food_group: "other", diet: "none",
  piece_weight_g: null, density_g_per_ml: null, source: "seed", is_staple: false, ...extra,
});

const MEHL = ing("11111111-1111-4111-8111-111111111111", "Mehl");
const EI = ing("22222222-2222-4222-8222-222222222222", "Ei", { piece_weight_g: 60 });
const SALZ = ing("33333333-3333-4333-8333-333333333333", "Salz");

const line = (raw: string, match: IngredientOption | null, exact = true, note = ""): ImportLine => {
  const parsed = parseIngredientLine(raw);
  return { ...parsed, note: [note, parsed.note].filter(Boolean).join(", "), match, exact };
};

const [pfannkuchen] = parseMarkdownFiles([
  {
    name: "p.md",
    text: "# Pfannkuchen\n\nPortionen: 2\nTags: schnell\n\n## Zutaten\n- 200 g Mehl\n- 2 Eier\n- Salz\n\n## Zubereitung\n1. Verrühren. *(Timer: 5 Min.)*\n2. Ausbacken.\n",
  },
]).recipes;

describe("reviewReasons", () => {
  it("ist leer, wenn alles sicher erkannt ist", () => {
    const lines = [line("200 g Mehl", MEHL), line("2 Eier", EI), line("Salz", SALZ)];
    expect(reviewReasons(pfannkuchen, lines)).toEqual([]);
  });

  it("nennt unsichere Zutaten: Vorschlag, fehlend oder ohne Grammumrechnung", () => {
    const lines = [line("200 g Mehl", MEHL, false), line("2 Eier", null), line("2 Stück Salz", SALZ)];
    expect(reviewReasons(pfannkuchen, lines)).toEqual(["3 Zutaten unsicher"]);
  });

  it("übernimmt die Hinweise des Parsers", () => {
    const [ohne] = parseMarkdownFiles([{ name: "x.md", text: "# X\n\n## Zutaten\n- 1 Ei\n" }]).recipes;
    expect(reviewReasons(ohne, [line("1 Ei", EI)])).toEqual(["Portionen fehlen", "Keine Schritte erkannt"]);
  });
});

describe("Entwurf und Speichern", () => {
  const lines = [line("200 g Mehl", MEHL), line("2 Eier", EI, true, "Teig"), line("Salz", SALZ)];

  it("Editor-Startwerte enthalten Tags, Portionen und Timer aus der Datei", () => {
    const draft = toImportDraft(pfannkuchen, lines);
    const { initial, dropped } = markdownEditorInitial(pfannkuchen, draft, initialChoices(draft));
    expect(dropped).toEqual([]);
    expect(initial).toMatchObject({ title: "Pfannkuchen", servings: 2, tags: ["schnell"], source_url: "" });
    expect(initial.steps).toEqual([
      { text: "Verrühren.", timer_seconds: 300 },
      { text: "Ausbacken.", timer_seconds: null },
    ]);
    expect(initial.ingredients.map((i) => [i.ingredient.name, i.amount, i.unit, i.note])).toEqual([
      ["Mehl", 200, "g", ""],
      ["Ei", 2, "piece", "Teig"],
      ["Salz", null, null, ""],
    ]);
  });

  it("die Eingabe für sichere Rezepte besteht die Prüfung des Servers", () => {
    const input = certainRecipeInput(pfannkuchen, lines);
    const parsed = recipeInputSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    expect(input.id).toBeUndefined();
    expect(input.ingredients).toHaveLength(3);
  });
});
