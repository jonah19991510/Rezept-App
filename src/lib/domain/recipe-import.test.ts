import { describe, expect, it } from "vitest";
import { cleanText, decodeEntities, extractRecipe, guessCategory, parseInstructions, parseIsoDuration, parseYield } from "./recipe-import";

const page = (json: unknown, extra = "") =>
  `<html><head><title>x</title>${extra}<script type="application/ld+json">${JSON.stringify(json)}</script></head><body></body></html>`;

describe("Hilfsfunktionen", () => {
  it("Dauer im ISO-Format", () => {
    expect(parseIsoDuration("PT1H30M")).toBe(90);
    expect(parseIsoDuration("PT20M")).toBe(20);
    expect(parseIsoDuration("P0DT0H45M")).toBe(45);
    expect(parseIsoDuration("PT0S")).toBeNull();
    expect(parseIsoDuration("30 Minuten")).toBeNull();
    expect(parseIsoDuration(undefined)).toBeNull();
  });

  it("Portionen", () => {
    expect(parseYield("4 Portionen")).toBe(4);
    expect(parseYield(["4", "4 servings"])).toBe(4);
    expect(parseYield(6)).toBe(6);
    expect(parseYield("ein Blech")).toBeNull();
    expect(parseYield(null)).toBeNull();
  });

  it("Entities und HTML", () => {
    expect(decodeEntities("Salz &amp; Pfeffer &#8211; n. B. &auml;&uuml; &amp;amp;")).toBe("Salz & Pfeffer – n. B. äü &");
    expect(cleanText("<p>Zwiebeln <b>fein</b> hacken.</p><p>Dann&nbsp;braten.</p>")).toBe("Zwiebeln fein hacken.\nDann braten.");
  });

  it("Zubereitung in allen üblichen Formen", () => {
    expect(parseInstructions("Erst das.\nDann das.")).toEqual(["Erst das.", "Dann das."]);
    expect(
      parseInstructions([
        { "@type": "HowToStep", text: "Wasser kochen." },
        { "@type": "HowToStep", name: "Nudeln rein." },
      ]),
    ).toEqual(["Wasser kochen.", "Nudeln rein."]);
    expect(
      parseInstructions([
        { "@type": "HowToSection", name: "Teig", itemListElement: [{ "@type": "HowToStep", text: "Mehl sieben." }, { "@type": "HowToStep", text: "Kneten." }] },
        { "@type": "HowToSection", name: "Füllung", itemListElement: [{ "@type": "HowToStep", text: "Äpfel schneiden." }] },
      ]),
    ).toEqual(["Teig: Mehl sieben.", "Kneten.", "Füllung: Äpfel schneiden."]);
    // nur ein Abschnitt: kein Präfix
    expect(
      parseInstructions([{ "@type": "HowToSection", name: "Zubereitung", itemListElement: [{ "@type": "HowToStep", text: "Kochen." }] }]),
    ).toEqual(["Kochen."]);
  });

  it("Kategorie raten", () => {
    expect(guessCategory("Hauptspeise", "Spaghetti Carbonara")).toBe("Pasta");
    expect(guessCategory("", "Gebratener Reis mit Ei")).toBe("Reis");
    expect(guessCategory("Dessert")).toBe("Dessert");
    expect(guessCategory("", "Linsen-Dal")).toBeNull();
  });
});

describe("extractRecipe", () => {
  it("liest ein einfaches Rezept", () => {
    const recipe = extractRecipe(
      page({
        "@context": "https://schema.org",
        "@type": "Recipe",
        name: "Rote-Linsen-Dal",
        description: "Schnell &amp; würzig",
        recipeYield: "4 Portionen",
        prepTime: "PT10M",
        totalTime: "PT35M",
        recipeCategory: "Hauptgericht",
        recipeIngredient: ["200 g rote Linsen", "1 Dose Kokosmilch", "  "],
        recipeInstructions: [{ "@type": "HowToStep", text: "Linsen waschen." }, { "@type": "HowToStep", text: "Kochen." }],
      }),
    );
    expect(recipe).toEqual({
      title: "Rote-Linsen-Dal",
      description: "Schnell & würzig",
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 25,
      category: null,
      ingredientLines: ["200 g rote Linsen", "1 Dose Kokosmilch"],
      steps: ["Linsen waschen.", "Kochen."],
    });
  });

  it("findet das Rezept in @graph (WordPress/Yoast) und mit Typ-Liste", () => {
    const html = page(
      {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebPage", name: "Blog" },
          { "@type": ["Recipe", "NewsArticle"], name: "Shakshuka", recipeIngredient: ["4 Eier"], recipeInstructions: "Alles in die Pfanne." },
        ],
      },
      '<script type="application/ld+json">{ kaputt </script>',
    );
    expect(extractRecipe(html)).toMatchObject({ title: "Shakshuka", ingredientLines: ["4 Eier"], steps: ["Alles in die Pfanne."], servings: null });
  });

  it("entfernt „von <Autor>“ aus dem Titel", () => {
    const html = page({ "@type": "Recipe", name: "Kirschtaschen von Chefkoch_Anna", author: { "@type": "Person", name: "Chefkoch_Anna" }, recipeIngredient: ["1 Glas Kirschen"] });
    expect(extractRecipe(html)?.title).toBe("Kirschtaschen");
    // Chefkoch: Autor nur als Verweis, „von …“ wird anhand der Seite entfernt
    const chefkoch = page({ "@type": "Recipe", name: "Apfelkuchen vom Blech von heresbach", author: { "@id": "#author" }, recipeIngredient: ["300 g Mehl"] });
    expect(extractRecipe(chefkoch, "https://www.chefkoch.de/rezepte/1/x.html")?.title).toBe("Apfelkuchen vom Blech");
    expect(extractRecipe(chefkoch, "https://example.com/x")?.title).toBe("Apfelkuchen vom Blech von heresbach");
  });

  it("gibt null zurück, wenn kein Rezept da ist", () => {
    expect(extractRecipe(page({ "@type": "Recipe", name: "Herbstgerichte – die besten Rezepte" }))).toBeNull();
    expect(extractRecipe(page({ "@type": "Article", name: "News" }))).toBeNull();
    expect(extractRecipe("<html><body>Kein JSON-LD</body></html>")).toBeNull();
  });
});
