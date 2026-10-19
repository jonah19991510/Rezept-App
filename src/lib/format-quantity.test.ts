import { describe, expect, it } from "vitest";
import { formatMinutes, formatQuantity } from "./format-quantity";

describe("formatQuantity", () => {
  it("zeigt Menge und deutsche Einheit", () => {
    expect(formatQuantity(250, "g")).toBe("250 g");
    expect(formatQuantity(2, "tbsp")).toBe("2 EL");
    expect(formatQuantity(1.5, "g")).toBe("1,5 g");
  });

  it("nutzt Brüche bei Stück und Löffeln", () => {
    expect(formatQuantity(0.5, "piece")).toBe("½ Stück");
    expect(formatQuantity(1.5, "tsp")).toBe("1 ½ TL");
  });

  it("ohne Menge bleibt es leer", () => {
    expect(formatQuantity(null, "g")).toBe("");
  });
});

describe("formatMinutes", () => {
  it("formatiert Minuten und Stunden", () => {
    expect(formatMinutes(45)).toBe("45 Min.");
    expect(formatMinutes(60)).toBe("1 Std.");
    expect(formatMinutes(75)).toBe("1 Std. 15 Min.");
    expect(formatMinutes(null)).toBeNull();
    expect(formatMinutes(0)).toBeNull();
  });
});
