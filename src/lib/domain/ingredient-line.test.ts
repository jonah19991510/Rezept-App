import { describe, expect, it } from "vitest";
import { parseIngredientLine, searchTermsFor } from "./ingredient-line";

const p = (line: string) => {
  const { amount, unit, name, note } = parseIngredientLine(line);
  return { amount, unit, name, note };
};

describe("parseIngredientLine – deutsche Angaben", () => {
  it("Gramm, Milliliter, Löffel", () => {
    expect(p("200 g Mehl")).toEqual({ amount: 200, unit: "g", name: "Mehl", note: "" });
    expect(p("200g Mehl Type 405")).toEqual({ amount: 200, unit: "g", name: "Mehl Type 405", note: "" });
    expect(p("250 ml Milch")).toEqual({ amount: 250, unit: "ml", name: "Milch", note: "" });
    expect(p("2 EL Olivenöl")).toEqual({ amount: 2, unit: "tbsp", name: "Olivenöl", note: "" });
    expect(p("1 Teelöffel Zucker")).toEqual({ amount: 1, unit: "tsp", name: "Zucker", note: "" });
    expect(p("4 cl Gin")).toEqual({ amount: 4, unit: "cl", name: "Gin", note: "" });
  });

  it("rechnet kg, l und dl um", () => {
    expect(p("1 kg Kartoffeln")).toMatchObject({ amount: 1000, unit: "g", name: "Kartoffeln" });
    expect(p("1,5 l Gemüsebrühe")).toMatchObject({ amount: 1500, unit: "ml", name: "Gemüsebrühe" });
    expect(p("2 dl Sahne")).toMatchObject({ amount: 200, unit: "ml" });
    expect(p("0.5 Liter Wasser")).toMatchObject({ amount: 500, unit: "ml", name: "Wasser" });
  });

  it("Brüche, gemischte Zahlen und Bereiche", () => {
    expect(p("1/2 TL Salz")).toMatchObject({ amount: 0.5, unit: "tsp", name: "Salz" });
    expect(p("½ Zwiebel")).toMatchObject({ amount: 0.5, unit: "piece", name: "Zwiebel" });
    expect(p("1½ EL Honig")).toMatchObject({ amount: 1.5, unit: "tbsp", name: "Honig" });
    expect(p("1 1/2 Tassen Reis")).toMatchObject({ amount: 1.5, unit: "piece", name: "Reis", note: "Tassen" });
    expect(p("2-3 Knoblauchzehen")).toEqual({ amount: 2, unit: "piece", name: "Knoblauchzehen", note: "2–3" });
    expect(p("2 – 3 EL Öl")).toMatchObject({ amount: 2, unit: "tbsp", note: "2–3" });
  });

  it("Stück, Gebinde und Zählwörter", () => {
    expect(p("3 Eier")).toEqual({ amount: 3, unit: "piece", name: "Eier", note: "" });
    expect(p("2 Zwiebel(n), fein gewürfelt")).toEqual({ amount: 2, unit: "piece", name: "Zwiebel", note: "fein gewürfelt" });
    expect(p("1 Dose Tomaten (400 g)")).toEqual({ amount: 1, unit: "piece", name: "Tomaten", note: "Dose, 400 g" });
    expect(p("2 Zehen Knoblauch")).toMatchObject({ amount: 2, unit: "piece", name: "Knoblauch", note: "Zehen" });
    expect(p("1 Bund Petersilie")).toMatchObject({ unit: "piece", name: "Petersilie", note: "Bund" });
    expect(p("1 Lorbeerblatt")).toMatchObject({ amount: 1, unit: "piece", name: "Lorbeerblatt" });
    expect(p("1 Prise Salz")).toMatchObject({ amount: 1, unit: "pinch", name: "Salz" });
    expect(p("1 Msp. Muskat")).toMatchObject({ amount: 1, unit: "pinch", name: "Muskat", note: "Msp" });
  });

  it("ohne Menge", () => {
    expect(p("Salz und Pfeffer")).toEqual({ amount: null, unit: null, name: "Salz und Pfeffer", note: "" });
    expect(p("etwas Butter für die Form")).toMatchObject({ amount: null, unit: null, name: "Butter für die Form", note: "etwas" });
    expect(p("ca. 100 g Parmesan")).toMatchObject({ amount: 100, unit: "g", name: "Parmesan" });
  });
});

describe("parseIngredientLine – amerikanische Einheiten", () => {
  it("rechnet metrisch um und merkt sich die Originalangabe", () => {
    expect(p("2 cups flour")).toEqual({ amount: 480, unit: "ml", name: "flour", note: "aus 2 cup" });
    expect(p("1/2 cup of sugar")).toMatchObject({ amount: 120, unit: "ml", name: "sugar", note: "aus 1/2 cup" });
    expect(p("1.5 cups chicken broth ($0.20)")).toMatchObject({ amount: 360, unit: "ml", name: "chicken broth", note: "aus 1,5 cup, $0.20" });
    expect(p("3 oz. cream cheese*")).toMatchObject({ amount: 85, unit: "g", name: "cream cheese" });
    expect(p("8 oz cream cheese")).toMatchObject({ amount: 227, unit: "g", name: "cream cheese", note: "aus 8 oz" });
    expect(p("1 lb ground beef")).toMatchObject({ amount: 454, unit: "g" });
    expect(p("4 fl oz milk")).toMatchObject({ amount: 118, unit: "ml", note: "aus 4 fl oz" });
    expect(p("1 stick butter, softened")).toEqual({ amount: 113, unit: "g", name: "butter", note: "aus 1 stick, softened" });
    expect(p("2 tbsp olive oil")).toMatchObject({ amount: 2, unit: "tbsp", name: "olive oil" });
    expect(p("1 tsp vanilla extract")).toMatchObject({ amount: 1, unit: "tsp" });
  });
});

describe("searchTermsFor", () => {
  it("ganzer Name zuerst, dann lange Wörter", () => {
    expect(searchTermsFor("Mehl Type 405")).toEqual(["Mehl Type 405", "Mehl", "Type"]);
    expect(searchTermsFor("rote Zwiebel")).toEqual(["rote Zwiebel", "Zwiebel", "rote"]);
    expect(searchTermsFor("Ei")).toEqual(["Ei"]);
  });
});
