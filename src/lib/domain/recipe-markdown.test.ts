import { describe, expect, it } from "vitest";
import {
  bookToMarkdown,
  createSlugger,
  escapeMarkdown,
  groupByCategory,
  markdownFileName,
  recipeToMarkdown,
  type MarkdownRecipe,
} from "./recipe-markdown";

const recipe = (over: Partial<MarkdownRecipe> = {}): MarkdownRecipe => ({
  title: "Linsen-Dal",
  description: "Schnell und wärmend.",
  servings: 4,
  prep_minutes: 10,
  cook_minutes: 25,
  category: "Suppe/Eintopf",
  tags: ["schnell"],
  is_meal_prep: true,
  source_url: null,
  perServing: { kcal: 412.6, protein: 21.2, carbs: 50.4, fat: 12.1, fiber: 9.8 },
  ingredients: [
    { amount: 250, unit: "g", name: "Rote Linsen", note: null },
    { amount: 0.5, unit: "tsp", name: "Kurkuma", note: "gemahlen" },
    { amount: null, unit: null, name: "Salz", note: "nach Geschmack" },
  ],
  steps: [
    { text: "Linsen waschen.", timer_seconds: null },
    { text: "Alles köcheln lassen.\nAb und zu umrühren.", timer_seconds: 1200 },
  ],
  ...over,
});

const EXPORTED = new Date("2026-10-20T10:00:00Z");

describe("recipeToMarkdown", () => {
  it("baut Kopf, Zutaten und nummerierte Schritte", () => {
    const md = recipeToMarkdown(recipe());
    expect(md).toBe(
      [
        "# Linsen-Dal",
        "",
        "*Suppe/Eintopf* · 4 Portionen · Vorbereitung 10 Min. · Kochen 25 Min. · Meal-Prep",
        "",
        "Schnell und wärmend.",
        "",
        "**Tags:** schnell",
        "",
        "**Pro Portion:** 413 kcal · 21 g Eiweiß · 50 g Kohlenhydrate · 12 g Fett · 10 g Ballaststoffe",
        "",
        "## Zutaten",
        "",
        "- 250 g Rote Linsen",
        "- ½ TL Kurkuma, gemahlen",
        "- Salz, nach Geschmack",
        "",
        "## Zubereitung",
        "",
        "1. Linsen waschen.",
        "2. Alles köcheln lassen.",
        "   Ab und zu umrühren. *(Timer: 20 Min.)*",
        "",
      ].join("\n"),
    );
  });

  it("lässt leere Angaben weg und nennt fehlende Zutaten/Schritte", () => {
    const md = recipeToMarkdown(
      recipe({ description: null, tags: [], perServing: null, category: null, is_meal_prep: false, prep_minutes: null, cook_minutes: null, ingredients: [], steps: [], servings: 1 }),
    );
    expect(md).toContain("# Linsen-Dal\n\n1 Portion\n\n## Zutaten\n\n*Keine Zutaten eingetragen.*");
    expect(md).toContain("*Keine Schritte eingetragen.*");
    expect(md).not.toContain("Tags");
    expect(md).not.toContain("Pro Portion");
  });

  it("maskiert Markdown-Zeichen und hängt die Quelle an", () => {
    const md = recipeToMarkdown(recipe({ title: "Omas *beste* [Suppe]", source_url: "https://example.org/x" }));
    expect(md.startsWith("# Omas \\*beste\\* \\[Suppe\\]\n")).toBe(true);
    expect(md.trimEnd().endsWith("Quelle: <https://example.org/x>")).toBe(true);
  });
});

describe("createSlugger", () => {
  it("bildet Sprungmarken wie GitHub, inkl. Umlauten und Doppelten", () => {
    const slug = createSlugger();
    expect(slug("Käsespätzle & Röstzwiebeln")).toBe("käsespätzle--röstzwiebeln");
    expect(slug("Zutaten")).toBe("zutaten");
    expect(slug("Zutaten")).toBe("zutaten-1");
    expect(slug("Zutaten")).toBe("zutaten-2");
    expect(slug("Zutaten 1")).toBe("zutaten-1-1");
  });
});

describe("groupByCategory", () => {
  it("sortiert nach Kategorie-Reihenfolge, ohne Kategorie zuletzt, darin alphabetisch", () => {
    const groups = groupByCategory([
      recipe({ title: "Zucchini-Suppe", category: "Suppe/Eintopf" }),
      recipe({ title: "Brot", category: null }),
      recipe({ title: "Arrabbiata", category: "Pasta" }),
      recipe({ title: "Äpfel-Suppe", category: "Suppe/Eintopf" }),
    ]);
    expect(groups.map((g) => [g.label, g.recipes.map((r) => r.title)])).toEqual([
      ["Pasta", ["Arrabbiata"]],
      ["Suppe/Eintopf", ["Äpfel-Suppe", "Zucchini-Suppe"]],
      ["Ohne Kategorie", ["Brot"]],
    ]);
  });
});

describe("bookToMarkdown", () => {
  it("setzt ein Inhaltsverzeichnis mit funktionierenden Sprungmarken oben hin", () => {
    const md = bookToMarkdown(
      [recipe({ title: "Dal", category: "Suppe/Eintopf" }), recipe({ title: "Pasta", category: "Pasta" }), recipe({ title: "Dal", category: "Suppe/Eintopf" })],
      { title: "Unser Rezeptbuch", exportedAt: EXPORTED },
    );
    const [head] = md.split("\n---\n");
    expect(head).toBe(
      [
        "# Unser Rezeptbuch",
        "",
        "Exportiert am 20.10.2026 · 3 Rezepte",
        "",
        "## Inhalt",
        "",
        "**Pasta**",
        "",
        "- [Pasta](#pasta)",
        "",
        "**Suppe/Eintopf**",
        "",
        "- [Dal](#dal)",
        "- [Dal](#dal-1)",
        "",
      ].join("\n"),
    );
    // Rezepte als ##, Unterüberschriften als ###, Trennlinien dazwischen
    expect(md.match(/^## (?!Inhalt)/gm)).toHaveLength(3);
    expect(md.match(/^### Zutaten$/gm)).toHaveLength(3);
    expect(md.match(/^---$/gm)).toHaveLength(3);
  });

  it("kommt ohne Rezepte aus", () => {
    const md = bookToMarkdown([], { title: "Leer", exportedAt: EXPORTED });
    expect(md).toBe("# Leer\n\nExportiert am 20.10.2026 · 0 Rezepte\n\n## Inhalt\n\n*Noch keine Rezepte.*\n");
  });
});

describe("Hilfsfunktionen", () => {
  it("escapeMarkdown", () => {
    expect(escapeMarkdown("a_b #1 `x`")).toBe("a\\_b \\#1 \\`x\\`");
  });

  it("markdownFileName", () => {
    expect(markdownFileName("Käsespätzle mit Röstzwiebeln")).toBe("kaesespaetzle-mit-roestzwiebeln.md");
    expect(markdownFileName("Crème brûlée!")).toBe("creme-brulee.md");
    expect(markdownFileName("???")).toBe("rezept.md");
  });
});
