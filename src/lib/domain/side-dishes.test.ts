import { describe, expect, it } from "vitest";
import { linkSideDishes } from "./side-dishes";

describe("linkSideDishes", () => {
  const recipes = [
    { id: "a", title: "Spätzle" },
    { id: "b", title: "Gulasch" },
    { id: "c", title: "Kartoffel  Kroketten" },
  ];

  it("verlinkt gleichnamige Rezepte ohne Groß-/Kleinschreibung und doppelte Leerzeichen", () => {
    expect(linkSideDishes(["spätzle", "Kartoffel Kroketten", "Rotkohl"], recipes)).toEqual([
      { name: "spätzle", recipeId: "a" },
      { name: "Kartoffel Kroketten", recipeId: "c" },
      { name: "Rotkohl", recipeId: null },
    ]);
  });

  it("verlinkt nie das Rezept selbst und lässt leere Einträge weg", () => {
    expect(linkSideDishes(["Gulasch", " ", " Spätzle "], recipes, "b")).toEqual([
      { name: "Gulasch", recipeId: null },
      { name: "Spätzle", recipeId: "a" },
    ]);
  });
});
