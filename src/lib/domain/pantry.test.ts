import { describe, expect, it } from "vitest";
import {
  pantryChecklist,
  consumePantry,
  cookability,
  coverShoppingItem,
  defaultLocation,
  expiryLabel,
  expiryStatus,
  mergeIntoPantry,
  neededInUnit,
  shoppingListText,
  type CookRecipe,
} from "./pantry";
import { daysBetween } from "./week";

describe("Bereiche und Ablaufdatum", () => {
  it("Bar für Spirituosen, Liköre, Sirupe/Säfte", () => {
    expect(defaultLocation("spirits")).toBe("bar");
    expect(defaultLocation("syrups_juices")).toBe("bar");
    expect(defaultLocation("vegetables")).toBe("kitchen");
  });

  it("abgelaufen, bald, ok", () => {
    expect(daysBetween("2026-10-19", "2026-10-22")).toBe(3);
    expect(expiryStatus("2026-10-18", "2026-10-19")).toBe("expired");
    expect(expiryStatus("2026-10-19", "2026-10-19")).toBe("soon");
    expect(expiryStatus("2026-10-22", "2026-10-19")).toBe("soon");
    expect(expiryStatus("2026-10-23", "2026-10-19")).toBe("ok");
    expect(expiryStatus(null, "2026-10-19")).toBeNull();
  });
});

describe("coverShoppingItem", () => {
  it("nichts im Vorrat", () => {
    expect(coverShoppingItem({ amount: 500, unit: "g" }, [])).toEqual({ status: "none", pantryText: null, remaining: null });
  });

  it("„vorhanden“ ohne Menge gilt als da", () => {
    expect(coverShoppingItem({ amount: 500, unit: "g" }, [{ amount: null, unit: null }])).toEqual({
      status: "have",
      pantryText: "im Vorrat",
      remaining: null,
    });
  });

  it("reicht, reicht teilweise, Bereiche werden addiert", () => {
    expect(coverShoppingItem({ amount: 500, unit: "g" }, [{ amount: 1000, unit: "g" }])).toMatchObject({ status: "have", pantryText: "1 kg im Vorrat" });
    expect(coverShoppingItem({ amount: 500, unit: "g" }, [{ amount: 200, unit: "g" }])).toEqual({
      status: "partial",
      pantryText: "200 g im Vorrat",
      remaining: 300,
    });
    expect(
      coverShoppingItem({ amount: 3, unit: "Stück" }, [
        { amount: 1, unit: "Stück" },
        { amount: 2, unit: "Stück" },
      ]),
    ).toMatchObject({ status: "have" });
  });

  it("andere Einheit: nicht vergleichbar, nur Hinweis", () => {
    expect(coverShoppingItem({ amount: 2, unit: "Stück" }, [{ amount: 300, unit: "g" }])).toEqual({
      status: "unknown",
      pantryText: "300 g im Vorrat",
      remaining: null,
    });
  });

  it("Eintrag ohne Menge auf der Liste ist gedeckt, sobald etwas im Vorrat ist", () => {
    expect(coverShoppingItem({ amount: null, unit: "2 Packungen" }, [{ amount: 1, unit: "Stück" }])).toMatchObject({ status: "have" });
  });
});

describe("mergeIntoPantry", () => {
  it("addiert gleiche Einheit, sonst gilt der Einkauf", () => {
    expect(mergeIntoPantry({ amount: 200, unit: "g" }, { amount: 500, unit: "g" })).toEqual({ amount: 700, unit: "g" });
    expect(mergeIntoPantry({ amount: 2, unit: "Stück" }, { amount: 500, unit: "g" })).toEqual({ amount: 500, unit: "g" });
    expect(mergeIntoPantry(null, { amount: 1.5, unit: "Stück" })).toEqual({ amount: 1.5, unit: "Stück" });
    expect(mergeIntoPantry({ amount: null, unit: null }, { amount: 250, unit: "ml" })).toEqual({ amount: 250, unit: "ml" });
  });

  it("eigene Einträge ohne messbare Menge: „vorhanden“", () => {
    expect(mergeIntoPantry(null, { amount: null, unit: "2 Packungen" })).toEqual({ amount: null, unit: null });
    expect(mergeIntoPantry({ amount: 300, unit: "g" }, { amount: null, unit: null })).toEqual({ amount: 300, unit: "g" });
  });
});

describe("neededInUnit und consumePantry", () => {
  const onion = { density_g_per_ml: null, piece_weight_g: 80 };
  const milk = { density_g_per_ml: 1.03, piece_weight_g: null };

  it("rechnet die Rezeptmenge in die Vorrats-Einheit um", () => {
    expect(neededInUnit({ amount: 250, unit: "g", grams: 250 }, 2, "g", {})).toBe(500);
    expect(neededInUnit({ amount: 2, unit: "piece", grams: 160 }, 0.5, "Stück", onion)).toBe(1);
    expect(neededInUnit({ amount: 160, unit: "g", grams: 160 }, 1, "Stück", onion)).toBe(2);
    expect(neededInUnit({ amount: 2, unit: "tbsp", grams: 31 }, 1, "ml", milk)).toBe(30);
    expect(neededInUnit({ amount: 103, unit: "g", grams: 103 }, 1, "ml", milk)).toBeCloseTo(100);
    expect(neededInUnit({ amount: 1, unit: "piece", grams: null }, 1, "g", {})).toBeNull();
  });

  it("zieht ab, entfernt Reste, lässt „vorhanden“ stehen", () => {
    expect(consumePantry({ amount: 500, unit: "g" }, 200)).toEqual({ action: "update", amount: 300 });
    expect(consumePantry({ amount: 500, unit: "g" }, 499.5)).toEqual({ action: "remove" });
    expect(consumePantry({ amount: 2, unit: "Stück" }, 3)).toEqual({ action: "remove" });
    expect(consumePantry({ amount: 3, unit: "Stück" }, 0.5)).toEqual({ action: "update", amount: 2.5 });
    expect(consumePantry({ amount: null, unit: null }, 200)).toEqual({ action: "keep" });
    expect(consumePantry({ amount: 500, unit: "g" }, null)).toEqual({ action: "keep" });
  });
});

describe("cookability", () => {
  const recipes: CookRecipe[] = [
    { id: "a", title: "Dal", lines: [{ ingredientId: "linsen", name: "Linsen", isStaple: false }, { ingredientId: "salz", name: "Salz", isStaple: true }] },
    { id: "b", title: "Bolognese", lines: [
      { ingredientId: "hack", name: "Hackfleisch", isStaple: false },
      { ingredientId: "nudeln", name: "Spaghetti", isStaple: false },
      { ingredientId: "tomaten", name: "Tomaten", isStaple: false },
    ] },
    { id: "c", title: "Shakshuka", lines: [{ ingredientId: "eier", name: "Eier", isStaple: false }, { ingredientId: "tomaten", name: "Tomaten", isStaple: false }] },
    { id: "d", title: "Curry", lines: [
      { ingredientId: "x1", name: "A", isStaple: false },
      { ingredientId: "x2", name: "B", isStaple: false },
      { ingredientId: "x3", name: "C", isStaple: false },
      { ingredientId: "x4", name: "D", isStaple: false },
    ] },
    { id: "e", title: "Leer", lines: [] },
  ];

  it("ordnet nach fehlenden Zutaten, ignoriert Grundzutaten und Rezepte ohne Zutaten", () => {
    const result = cookability(recipes, new Set(["linsen", "tomaten", "nudeln"]), new Set());
    expect(result.map((r) => [r.title, r.status, r.missing.map((m) => m.name)])).toEqual([
      ["Dal", "all", []],
      ["Bolognese", "one", ["Hackfleisch"]],
      ["Shakshuka", "one", ["Eier"]],
      ["Curry", "many", ["A", "B", "C", "D"]],
    ]);
  });

  it("bald ablaufende Zutaten werden bevorzugt", () => {
    const result = cookability(recipes, new Set(["linsen", "tomaten", "nudeln"]), new Set(["tomaten"]));
    expect(result.filter((r) => r.status === "one").map((r) => r.title)).toEqual(["Bolognese", "Shakshuka"]);
    const result2 = cookability(recipes, new Set(["tomaten", "eier"]), new Set(["eier"]));
    expect(result2[0]).toMatchObject({ title: "Shakshuka", status: "all", usesExpiring: 1 });
  });
});

describe("shoppingListText", () => {
  it("Überschrift, Abteilungen, Mengen", () => {
    expect(
      shoppingListText(
        [
          { label: "Obst & Gemüse", items: [{ name: "Zwiebeln", amount: 2, unit: "Stück" }, { name: "Kartoffeln", amount: 1500, unit: "g" }] },
          { label: "Leer", items: [] },
          { label: "Eigene Einträge", items: [{ name: "Spülmittel", amount: null, unit: "1 Flasche" }, { name: "Brot", amount: null, unit: null }] },
        ],
        "Einkaufsliste (Mo, 19.10.)",
      ),
    ).toBe("Einkaufsliste (Mo, 19.10.)\n\nObst & Gemüse\n- 2 Stück Zwiebeln\n- 1,5 kg Kartoffeln\n\nEigene Einträge\n- 1 Flasche Spülmittel\n- Brot");
  });
});

describe("pantryChecklist", () => {
  const c = (ingredientId: string, name: string, foodGroup: "fish" | "spirits" | "spices_sauces" | "dairy", isStaple = false) => ({
    ingredientId,
    name,
    foodGroup,
    isStaple,
  });
  const candidates = [c("1", "Lachs", "fish"), c("2", "Gin", "spirits"), c("3", "Salz", "spices_sauces", true), c("4", "Butter", "dairy")];
  const entries = [{ ...c("4", "Butter", "dairy"), id: "e4", location: "kitchen" as const }];

  it("zeigt Vorhandenes und fehlende Zutaten des Bereichs, ohne Grundzutaten", () => {
    const rows = pantryChecklist(candidates, entries, "kitchen");
    expect(rows.map((r) => [r.item.name, r.entry?.id ?? null])).toEqual([
      ["Butter", "e4"],
      ["Lachs", null],
    ]);
  });

  it("ordnet Spirituosen der Bar zu und listet Vorhandenes nicht doppelt", () => {
    expect(pantryChecklist(candidates, entries, "bar").map((r) => r.item.name)).toEqual(["Gin"]);
    const ginInKitchen = [{ ...c("2", "Gin", "spirits"), id: "e2", location: "kitchen" as const }];
    expect(pantryChecklist(candidates, ginInKitchen, "bar")).toEqual([]);
  });

  it("blendet Grundzutaten nur auf Wunsch ein, auch vorhandene", () => {
    const withSalt = [...entries, { ...c("3", "Salz", "spices_sauces", true), id: "e3", location: "kitchen" as const }];
    expect(pantryChecklist(candidates, withSalt, "kitchen").map((r) => r.item.name)).toEqual(["Butter", "Lachs"]);
    expect(pantryChecklist(candidates, withSalt, "kitchen", { includeStaples: true }).map((r) => [r.item.name, r.entry?.id ?? null])).toEqual([
      ["Butter", "e4"],
      ["Lachs", null],
      ["Salz", "e3"],
    ]);
    expect(pantryChecklist(candidates, entries, "kitchen", { includeStaples: true }).map((r) => r.item.name)).toContain("Salz");
  });
});

describe("expiryLabel", () => {
  it("nennt die Tage bis zum Ablauf, höchstens 3 Tage vorher", () => {
    expect(expiryLabel("2026-10-24", "2026-10-24")).toBe("Läuft heute ab");
    expect(expiryLabel("2026-10-25", "2026-10-24")).toBe("Läuft morgen ab");
    expect(expiryLabel("2026-10-27", "2026-10-24")).toBe("Läuft in 3 Tagen ab");
    expect(expiryLabel("2026-10-28", "2026-10-24")).toBeNull();
    expect(expiryLabel("2026-10-23", "2026-10-24")).toBe("Abgelaufen");
    expect(expiryLabel(null, "2026-10-24")).toBeNull();
  });
});
