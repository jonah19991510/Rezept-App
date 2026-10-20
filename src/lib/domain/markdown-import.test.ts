import { describe, expect, it } from "vitest";
import {
  categoryFor,
  parseDuration,
  parseMarkdownFiles,
  plainText,
  preselect,
  splitIngredientList,
  titleFromFileName,
  titleKey,
} from "./markdown-import";
import { bookToMarkdown, recipeToMarkdown, type MarkdownRecipe } from "./recipe-markdown";

// Aufbau wie im Notion-Export des Nutzers („Markdown & CSV“ mit Unterseiten): Eigenschaften als Zeilen,
// graue Kästen als Zitate, Spalten hintereinander, Bild, Trennlinien, Zutaten und Zubereitung als Listen.
const ALFREDO = `# Pasta Alfredo

Art: Pasta
Created: 5. Januar 2023 15:10
Eiweiß pro Person: 46,9 g
Fett pro Person: 44 g
Kategorie: Mittag/Abend
Kcal pro Person: 972 kcal
Kohlenhydrate pro Person: 97 g

> Vorbereitung: 10 min

> Koch- / Backzeit: 30 min

> Anzahl Personen: 4

---

![alfredo-penne-pasta.jpg](Pasta%20Alfredo%2049d86cd950e94a41b90219ebd07bd607/alfredo-penne-pasta.jpg)

### Zutaten

- 500 g Penne
- 350 g  Hähncheninnenfilets
- 850 ml Gemüsebrühe
- 4-6 Knoblauchzehen
- Paprikapulver, Salz, Pfeffer, Olivenöl

---

### Zubereitung

- Knoblauch und Hähnchen klein Schneiden
- Hähnchen mit Olivenöl, Salz, Pfeffer und Paprikapulver würzen
`;

const ROLLE = `# Gefüllte Low Carb Rolle

Art: Wrap
Kcal pro Person: Wrap 618 Kcal; Big Mac 640 Kcal

> Vorbereitung:
> Küche:

### Zutaten

Teig:

- 250g Skyr
- 2 Eier

Für die Füllung: Wrap

- 80g Frischkäse Fettarm
- 1 Dose Thunfisch

**Optionale Zutat**

- Rucola
-

---

### Zubereitung

Teig:

1. Skyr, Eier und Käse zu einem Teig vermischen
2. Masse auf einem Backblech ausstreichen

Big Mac Rolle:

1. Hackfleisch anbraten
`;

const LENDCHEN = `# Schweinelendchen **in cremiger Pilzrahmsauce**

Art: Pasta
Kategorie: Mittag/Abend

> Vorbereitung: 10 Min
> Küche: Deutschland

> Koch- / Backzeit: 30 Min
> Anzahl Personen: 3

### Zutaten

- 600 g Schweinefilet
- Salz und Pfeffer

### Zubereitung

- Das Schweinefilet in Scheiben schneiden.

**Optionaler Zubereitungsschritt**

- Wer mag, löscht mit Weißwein ab.
- Mit Sahne ablöschen.
`;

// Leere Vorlage („Page 3“) und die Übersichtsseite der Datenbank
const VORLAGE = `# Page 3

> Vorbereitung:
> Anzahl Personen:

---

### Zutaten

-

**Optionale Zutat**

-

### Zubereitung

-
`;
const UEBERSICHT = `# Rezepte

[Rezepte](Rezepte%204a003a20514b4e308f346d3655ffdca8.csv)
`;

const file = (name: string, text: string) => ({ name, text });

describe("parseMarkdownFiles – Notion-Export", () => {
  const { recipes, skippedEmpty } = parseMarkdownFiles([
    file("Rezepte ba1135fadd254b79aae5353755a1393a.md", UEBERSICHT),
    file("Rezepte/Pasta Alfredo 49d86cd950e94a41b90219ebd07bd607.md", ALFREDO),
    file("Rezepte/Gefüllte Low Carb Rolle e7fa54a737e94678ac7c71a8dc8e5356.md", ROLLE),
    file("Rezepte/Schweinelendchen 6198385ef43941d09881a2e174d1d4f8.md", LENDCHEN),
    file("Rezepte/Page 3 9c584201ebd24951b4e0b667e9830a05.md", VORLAGE),
  ]);

  it("überspringt leere Seiten und die Übersicht", () => {
    expect(recipes.map((r) => r.title)).toEqual(["Pasta Alfredo", "Gefüllte Low Carb Rolle", "Schweinelendchen in cremiger Pilzrahmsauce"]);
    expect(skippedEmpty).toEqual(["Rezepte", "Page 3"]);
  });

  it("liest Eigenschaften, Zeiten, Portionen und Kategorie", () => {
    const [alfredo] = recipes;
    expect(alfredo).toMatchObject({
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 30,
      category: "pasta",
      tags: [],
      description: "",
      warnings: [],
    });
    expect(alfredo.reference).toBe("972 kcal · Eiweiß 46,9 g · Fett 44 g · Kohlenhydrate 97 g");
  });

  it("zerlegt Zutaten und teilt Aufzählungen ohne Menge auf", () => {
    expect(recipes[0].ingredients.map((i) => i.text)).toEqual([
      "500 g Penne",
      "350 g Hähncheninnenfilets",
      "850 ml Gemüsebrühe",
      "4-6 Knoblauchzehen",
      "Paprikapulver",
      "Salz",
      "Pfeffer",
      "Olivenöl",
    ]);
    expect(recipes[0].steps.map((s) => s.text)).toEqual([
      "Knoblauch und Hähnchen klein Schneiden",
      "Hähnchen mit Olivenöl, Salz, Pfeffer und Paprikapulver würzen",
    ]);
  });

  it("übernimmt Gruppen und „optional“ in die Notiz, Gruppen in Schritten als Präfix", () => {
    const rolle = recipes[1];
    expect(rolle.ingredients).toEqual([
      { text: "250g Skyr", extraNote: "Teig" },
      { text: "2 Eier", extraNote: "Teig" },
      { text: "80g Frischkäse Fettarm", extraNote: "Für die Füllung: Wrap" },
      { text: "1 Dose Thunfisch", extraNote: "Für die Füllung: Wrap" },
      { text: "Rucola", extraNote: "Für die Füllung: Wrap, optional" },
    ]);
    expect(rolle.steps.map((s) => s.text)).toEqual([
      "Teig: Skyr, Eier und Käse zu einem Teig vermischen",
      "Masse auf einem Backblech ausstreichen",
      "Big Mac Rolle: Hackfleisch anbraten",
    ]);
    // Wrap ist keine eigene Kategorie: Tag; mehrere Werte in den Nährwerten bleiben als Text
    expect(rolle.category).toBeNull();
    expect(rolle.tags).toEqual(["Wrap"]);
    expect(rolle.reference).toBe("Wrap 618 Kcal; Big Mac 640 Kcal");
    expect(rolle.warnings).toEqual(["Portionen fehlen"]);
  });

  it("entfernt Formatierung im Titel, liest „Küche“ als Tag und optionale Schritte", () => {
    const lendchen = recipes[2];
    expect(lendchen.servings).toBe(3);
    expect(lendchen.tags).toEqual(["Deutschland"]);
    expect(lendchen.ingredients.map((i) => i.text)).toEqual(["600 g Schweinefilet", "Salz", "Pfeffer"]);
    expect(lendchen.steps.map((s) => s.text)).toEqual([
      "Das Schweinefilet in Scheiben schneiden.",
      "Optional: Wer mag, löscht mit Weißwein ab.",
      "Mit Sahne ablöschen.",
    ]);
  });
});

describe("parseMarkdownFiles – eine Datei mit mehreren Rezepten", () => {
  it("nimmt jede Überschrift der obersten Ebene als Rezept", () => {
    const { recipes } = parseMarkdownFiles([
      file(
        "sammlung.md",
        `# Pfannkuchen\n\nFür 2 Personen, schnell gemacht.\n\nPortionen: 2\n\n## Zutaten\n- 200 g Mehl\n- 2 Eier\n\n## Zubereitung\n1. Verrühren.\n2. Ausbacken.\n\n# Rührei\n\n## Zutaten\n- 3 Eier\n## Zubereitung\nEier verquirlen und stocken lassen.\n`,
      ),
    ]);
    expect(recipes.map((r) => [r.title, r.servings, r.ingredients.length, r.steps.length])).toEqual([
      ["Pfannkuchen", 2, 2, 2],
      ["Rührei", null, 1, 1],
    ]);
    expect(recipes[0].description).toBe("Für 2 Personen, schnell gemacht.");
    expect(recipes[1].steps[0].text).toBe("Eier verquirlen und stocken lassen.");
  });

  it("erkennt einen Buchtitel über den Rezepten, auch ohne Abschnitte", () => {
    const { recipes } = parseMarkdownFiles([
      file("buch.md", "# Omas Rezepte\n\nVorwort.\n\n## Kartoffelsalat\n\n- 1 kg Kartoffeln\n\n## Rotkohl\n\n- 1 Rotkohl\n"),
    ]);
    expect(recipes.map((r) => r.title)).toEqual(["Kartoffelsalat", "Rotkohl"]);
    // Ohne Abschnitt „Zutaten“ landen Listen in der Beschreibung
    expect(recipes[0].description).toBe("– 1 kg Kartoffeln");
  });

  it("nimmt den Dateinamen als Titel, wenn es keine Überschrift gibt", () => {
    const { recipes } = parseMarkdownFiles([file("Linsensuppe 0123456789abcdef0123456789abcdef.md", "Zutaten:\n\nEinfach lecker.")]);
    expect(recipes[0].title).toBe("Linsensuppe");
  });

  it("liest Tabellen in den Zutaten", () => {
    const { recipes } = parseMarkdownFiles([
      file("t.md", "# Brot\n\n### Zutaten\n\n| Menge | Zutat |\n| --- | --- |\n| 500 g | Mehl |\n| 1 TL | Salz |\n\n### Zubereitung\n\n- Backen\n"),
    ]);
    expect(recipes[0].ingredients.map((i) => i.text)).toEqual(["Menge Zutat", "500 g Mehl", "1 TL Salz"]);
  });
});

describe("Rundreise mit dem eigenen Markdown-Export", () => {
  const dal: MarkdownRecipe = {
    title: "Linsen-Dal",
    description: "Schnell und wärmend.",
    servings: 4,
    prep_minutes: 10,
    cook_minutes: 25,
    category: "soup",
    tags: ["schnell", "würzig"],
    is_meal_prep: true,
    source_url: "https://example.org/dal",
    perServing: { kcal: 412, protein: 21, carbs: 50, fat: 12, fiber: 10 },
    ingredients: [
      { amount: 250, unit: "g", name: "Rote Linsen", note: null },
      { amount: 0.5, unit: "tsp", name: "Kurkuma", note: "gemahlen" },
    ],
    steps: [
      { text: "Linsen waschen.", timer_seconds: null },
      { text: "Alles köcheln lassen.\nAb und zu umrühren.", timer_seconds: 1200 },
    ],
  };

  it("einzelnes Rezept", () => {
    const [r] = parseMarkdownFiles([file("linsen-dal.md", recipeToMarkdown(dal))]).recipes;
    expect(r).toMatchObject({
      title: "Linsen-Dal",
      description: "Schnell und wärmend.",
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 25,
      category: "soup",
      tags: ["schnell", "würzig"],
      isMealPrep: true,
      sourceUrl: "https://example.org/dal",
      warnings: [],
    });
    expect(r.ingredients.map((i) => i.text)).toEqual(["250 g Rote Linsen", "½ TL Kurkuma, gemahlen"]);
    expect(r.steps).toEqual([
      { text: "Linsen waschen.", timer_seconds: null },
      { text: "Alles köcheln lassen.\nAb und zu umrühren.", timer_seconds: 1200 },
    ]);
    expect(r.reference).toContain("412 kcal");
  });

  it("ganzes Buch mit Inhaltsverzeichnis", () => {
    const md = bookToMarkdown([dal, { ...dal, title: "Pasta *speciale*", category: "pasta" }], {
      title: "Rezeptbuch von Jonah",
      exportedAt: new Date("2026-10-20T08:00:00Z"),
    });
    const { recipes, skippedEmpty } = parseMarkdownFiles([file("rezeptbuch-2026-10-20.md", md)]);
    expect(recipes.map((r) => [r.title, r.category])).toEqual([
      ["Pasta *speciale*", "pasta"],
      ["Linsen-Dal", "soup"],
    ]);
    expect(skippedEmpty).toEqual([]);
    expect(recipes[0].steps).toHaveLength(2);
  });
});

describe("Hilfsfunktionen", () => {
  it("parseDuration", () => {
    expect(parseDuration("10 min")).toBe(10);
    expect(parseDuration("1 Std. 15 Min.")).toBe(75);
    expect(parseDuration("1,5 h")).toBe(90);
    expect(parseDuration("90 Minuten")).toBe(90);
    expect(parseDuration("30")).toBe(30);
    expect(parseDuration("20-25 Min")).toBe(20);
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("nach Gefühl")).toBeNull();
  });

  it("plainText", () => {
    expect(plainText('<span color="gray">**Optionale Zutat**</span>')).toBe("Optionale Zutat");
    expect(plainText("[Link](https://x.de) mit \\*Stern\\* und _kursiv_")).toBe("Link mit *Stern* und kursiv");
  });

  it("titleFromFileName", () => {
    expect(titleFromFileName("Rezepte/Pasta Alfredo 49d86cd950e94a41b90219ebd07bd607.md")).toBe("Pasta Alfredo");
  });

  it("categoryFor", () => {
    expect(categoryFor("Suppe")).toBe("soup");
    expect(categoryFor("Auflauf")).toBe("casserole");
    expect(categoryFor("Frühstück")).toBe("breakfast");
    expect(categoryFor("Pizza/Flammenkuchen")).toBeNull();
  });

  it("splitIngredientList", () => {
    expect(splitIngredientList("Salz und Pfeffer")).toEqual(["Salz", "Pfeffer"]);
    expect(splitIngredientList("Zwiebel, gewürfelt")).toEqual(["Zwiebel, gewürfelt"]);
    expect(splitIngredientList("1 Zwiebel, gewürfelt")).toEqual(["1 Zwiebel, gewürfelt"]);
    expect(splitIngredientList("Petersilie zur Deko")).toEqual(["Petersilie zur Deko"]);
  });

  it("preselect: keine Doppelten und keine Seiten ohne Titel", () => {
    const [r] = parseMarkdownFiles([file("a.md", ALFREDO)]).recipes;
    expect(preselect(r, new Set())).toBe(true);
    expect(preselect(r, new Set([titleKey("pasta alfredo")]))).toBe(false);
    const [page] = parseMarkdownFiles([file("p.md", "# Page 3 (1)\n\n### Zutaten\n- 1 Ei\n")]).recipes;
    expect(page.warnings).toContain("Kein richtiger Titel");
    expect(preselect(page, new Set())).toBe(false);
  });
});

describe("Cocktails (Phase 15)", () => {
  const daiquiri: MarkdownRecipe = {
    title: "Daiquiri",
    description: "Der Klassiker.",
    servings: 1,
    prep_minutes: 5,
    cook_minutes: null,
    category: "drink",
    tags: ["sauer"],
    is_meal_prep: false,
    source_url: null,
    perServing: { kcal: 152.4, protein: 0.1, carbs: 15, fat: 0, fiber: 0 },
    ingredients: [
      { amount: 6, unit: "cl", name: "Rum, weiß", note: null },
      { amount: 3, unit: "cl", name: "Limettensaft", note: "frisch" },
      { amount: 2, unit: "dash", name: "Angostura Bitter", note: null },
    ],
    steps: [{ text: "Alles auf Eis shaken.", timer_seconds: null }],
    recipe_type: "cocktail",
    cocktail: { glass: "coupette", method: "shaken", ice: "ohne, vorgekühltes Glas", garnish: "Limettenrad" },
    alcohol: { abvPercent: 17.5, alcoholGrams: 18.9 },
  };

  it("Export zeigt Drinks, Methode, Glas, Eis, Garnitur und Alkohol pro Drink", () => {
    const md = recipeToMarkdown(daiquiri);
    expect(md).toContain("*Cocktail* · 1 Drink · geshaked · Glas Coupette · Zubereitung 5 Min.");
    expect(md).toContain("**Eis:** ohne, vorgekühltes Glas");
    expect(md).toContain("**Garnitur:** Limettenrad");
    expect(md).toContain("**Pro Drink:** 17,5 % vol · 18,9 g Alkohol · 152 kcal");
    expect(md).toContain("- 2 Dash Angostura Bitter");
    expect(md).not.toContain("Pro Portion");
  });

  it("der eigene Export wird wieder als Cocktail erkannt", () => {
    const [r] = parseMarkdownFiles([file("daiquiri.md", recipeToMarkdown(daiquiri))]).recipes;
    expect(r).toMatchObject({
      title: "Daiquiri",
      recipeType: "cocktail",
      servings: 1,
      prepMinutes: 5,
      category: "drink",
      cocktail: { glass: "coupette", method: "shaken", ice: "ohne, vorgekühltes Glas", garnish: "Limettenrad" },
      warnings: [],
    });
    expect(r.reference).toBe("17,5 % vol · 18,9 g Alkohol · 152 kcal");
    expect(r.ingredients.map((i) => i.text)).toEqual(["6 cl Rum, weiß", "3 cl Limettensaft, frisch", "2 Dash Angostura Bitter"]);
  });

  it("im Buch eigene Gruppe „Cocktails“ am Ende; Gerichte bleiben Gerichte", () => {
    const dish: MarkdownRecipe = { ...daiquiri, title: "Dal", recipe_type: "dish", cocktail: null, alcohol: null, category: "soup", servings: 4 };
    const md = bookToMarkdown([daiquiri, dish], { title: "Buch", exportedAt: new Date("2026-10-20T10:00:00Z") });
    expect(md.indexOf("**Suppe/Eintopf**")).toBeLessThan(md.indexOf("**Cocktails**"));
    const recipes = parseMarkdownFiles([file("buch.md", md)]).recipes;
    expect(recipes.map((x) => [x.title, x.recipeType])).toEqual([
      ["Dal", "dish"],
      ["Daiquiri", "cocktail"],
    ]);
  });

  it("Eigenschaften aus anderen Quellen: Glas, Methode, Garnitur, Art: Cocktail", () => {
    const [r] = parseMarkdownFiles([
      file(
        "negroni.md",
        "# Negroni\n\nArt: Cocktail\nGlas: Tumbler\nMethode: gerührt\nGarnitur: Orangenzeste\n\n## Zutaten\n- 3 cl Gin\n\n## Zubereitung\n1. Rühren.\n",
      ),
    ]).recipes;
    expect(r).toMatchObject({ recipeType: "cocktail", category: "drink", cocktail: { glass: "tumbler", method: "stirred", garnish: "Orangenzeste" } });
    expect(r.tags).not.toContain("Cocktail");
  });
});
