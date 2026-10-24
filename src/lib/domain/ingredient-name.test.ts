import { describe, expect, it } from "vitest";
import { ingredientLabel, splitIngredientName } from "./ingredient-name";

describe("splitIngredientName", () => {
  it("nimmt Siegel, Handelsklasse und Marke aus dem Namen", () => {
    expect(splitIngredientName("Bio Staudensellerie Klasse II (Edeka)")).toEqual({
      short: "Staudensellerie",
      detail: "Bio · Klasse II · Edeka",
    });
  });

  it("erkennt Mengenangaben, Bio-Präfix und Schreibweisen", () => {
    expect(splitIngredientName("BIO Karotten 1 kg")).toEqual({ short: "Karotten", detail: "Bio · 1 kg" });
    expect(splitIngredientName("Bio-Joghurt mild 3,8% 500g")).toEqual({ short: "Joghurt mild 3,8%", detail: "Bio · 500g" });
    expect(splitIngredientName("Tomaten handelsklasse i 6 x 250 g")).toEqual({ short: "Tomaten", detail: "Handelsklasse I · 6 x 250 g" });
  });

  it("schiebt alles nach Komma oder Gedankenstrich in die Zusatzzeile", () => {
    expect(splitIngredientName("Gouda, jung, gerieben")).toEqual({ short: "Gouda", detail: "jung · gerieben" });
    expect(splitIngredientName("Kidneybohnen – abgetropft (ja!)")).toEqual({ short: "Kidneybohnen", detail: "abgetropft · ja!" });
  });

  it("lässt kurze Namen in Ruhe und fällt nie auf einen leeren Namen", () => {
    expect(splitIngredientName("Haferflocken")).toEqual({ short: "Haferflocken", detail: null });
    expect(splitIngredientName("Bio")).toEqual({ short: "Bio", detail: null });
    expect(splitIngredientName("Biomilch")).toEqual({ short: "Biomilch", detail: null });
  });
});

describe("ingredientLabel", () => {
  it("kürzt nur Open-Food-Facts-Namen automatisch", () => {
    expect(ingredientLabel({ name: "Bio Staudensellerie (Edeka)", source: "openfoodfacts" }).short).toBe("Staudensellerie");
    expect(ingredientLabel({ name: "Paprika, rot", source: "user" })).toEqual({ short: "Paprika, rot", detail: null });
  });

  it("nimmt den Kurznamen von Hand und zeigt den Rest darunter", () => {
    expect(ingredientLabel({ name: "Bio Staudensellerie Klasse II", displayName: " Sellerie ", source: "openfoodfacts" })).toEqual({
      short: "Sellerie",
      detail: "Bio · Klasse II",
    });
    expect(ingredientLabel({ name: "Isey Skyr Natur", displayName: "Skyr", source: "openfoodfacts" })).toEqual({
      short: "Skyr",
      detail: "Isey Skyr Natur",
    });
    expect(ingredientLabel({ name: "Skyr", displayName: "skyr", source: "user" })).toEqual({ short: "skyr", detail: null });
  });
});
