import { describe, expect, it } from "vitest";
import {
  aggregateShopping,
  departmentIndex,
  formatShoppingAmount,
  roundShoppingAmount,
  type ShoppingSourceLine,
} from "./shopping";

const base = { foodGroup: "vegetables" as const, isStaple: false, factor: 1, grams: null };
const line = (p: Partial<ShoppingSourceLine> & Pick<ShoppingSourceLine, "ingredientId" | "name">): ShoppingSourceLine => ({
  ...base,
  amount: null,
  unit: null,
  ...p,
});

describe("aggregateShopping", () => {
  it("summiert gleiche Zutaten in derselben Einheit", () => {
    const [item] = aggregateShopping([
      line({ ingredientId: "z", name: "Zwiebel", amount: 1, unit: "piece" }),
      line({ ingredientId: "z", name: "Zwiebel", amount: 2, unit: "piece" }),
    ]);
    expect(item).toMatchObject({ amount: 3, unit: "Stück" });
  });

  it("berücksichtigt den Portionsfaktor", () => {
    // Rezept für 4, geplant 2 Portionen → Faktor 0,5
    const [item] = aggregateShopping([line({ ingredientId: "s", name: "Spaghetti", amount: 400, unit: "g", factor: 0.5 })]);
    expect(item).toMatchObject({ amount: 200, unit: "g" });
  });

  it("rechnet Löffel und cl in ml um", () => {
    const [item] = aggregateShopping([
      line({ ingredientId: "o", name: "Olivenöl", amount: 2, unit: "tbsp" }),
      line({ ingredientId: "o", name: "Olivenöl", amount: 1, unit: "tsp" }),
      line({ ingredientId: "o", name: "Olivenöl", amount: 1, unit: "cl" }),
    ]);
    expect(item).toMatchObject({ amount: 45, unit: "ml" });
  });

  it("nimmt bei gemischten Einheiten die Grammwerte", () => {
    const [item] = aggregateShopping([
      line({ ingredientId: "z", name: "Zwiebel", amount: 1, unit: "piece", grams: 80 }),
      line({ ingredientId: "z", name: "Zwiebel", amount: 100, unit: "g", grams: 100 }),
    ]);
    expect(item).toMatchObject({ amount: 180, unit: "g" });
  });

  it("listet Zutaten ohne Menge ohne Mengenangabe", () => {
    const [item] = aggregateShopping([line({ ingredientId: "p", name: "Pfeffer" })]);
    expect(item).toMatchObject({ amount: null, unit: null });
  });

  it("hält verschiedene Zutaten getrennt und merkt sich Grundzutaten", () => {
    const items = aggregateShopping([
      line({ ingredientId: "a", name: "Salz", isStaple: true, amount: 1, unit: "pinch" }),
      line({ ingredientId: "b", name: "Tomate", amount: 2, unit: "piece" }),
    ]);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.name === "Salz")?.isStaple).toBe(true);
  });
});

describe("roundShoppingAmount", () => {
  it("rundet Stück auf halbe nach oben", () => {
    expect(roundShoppingAmount(2.25, "Stück")).toBe(2.5);
    expect(roundShoppingAmount(2, "Stück")).toBe(2);
    expect(roundShoppingAmount(0.3, "Stück")).toBe(0.5);
  });

  it("rundet große Grammmengen auf 5, kleine auf ganze", () => {
    expect(roundShoppingAmount(312, "g")).toBe(315);
    expect(roundShoppingAmount(13.2, "g")).toBe(14);
    expect(roundShoppingAmount(0.5, "g")).toBe(1);
  });
});

describe("formatShoppingAmount", () => {
  it("zeigt kg und l ab 1000", () => {
    expect(formatShoppingAmount(1250, "g")).toBe("1,25 kg");
    expect(formatShoppingAmount(1500, "ml")).toBe("1,5 l");
    expect(formatShoppingAmount(500, "g")).toBe("500 g");
  });

  it("zeigt halbe Stück als Bruch", () => {
    expect(formatShoppingAmount(2.5, "Stück")).toBe("2 ½ Stück");
    expect(formatShoppingAmount(0.5, "Stück")).toBe("½ Stück");
  });

  it("übernimmt freie Einheiten von Hand angelegter Einträge", () => {
    expect(formatShoppingAmount(2, "Packungen")).toBe("2 Packungen");
    expect(formatShoppingAmount(null, null)).toBe("");
  });
});

describe("departmentIndex", () => {
  it("sortiert Obst und Gemüse vorne, Manuelles ans Ende", () => {
    expect(departmentIndex("fruit")).toBeLessThan(departmentIndex("dairy"));
    expect(departmentIndex(null)).toBeGreaterThan(departmentIndex("other"));
  });
});
