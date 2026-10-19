import { describe, expect, it } from "vitest";
import { parseIngredientLine, refineUsLine } from "./ingredient-line";
import { convertFahrenheitInText, convertUsAmount, fahrenheitToCelsius, isLiquidDensity } from "./us-units";

describe("convertUsAmount", () => {
  it("Gewicht in Gramm", () => {
    expect(convertUsAmount(8, "oz")).toEqual({ amount: 227, unit: "g" });
    expect(convertUsAmount(1, "lb")).toEqual({ amount: 454, unit: "g" });
    expect(convertUsAmount(0.5, "stick")).toEqual({ amount: 57, unit: "g" });
  });

  it("Löffel bleiben EL/TL", () => {
    expect(convertUsAmount(2, "tbsp")).toEqual({ amount: 2, unit: "tbsp" });
    expect(convertUsAmount(0.5, "tsp")).toEqual({ amount: 0.5, unit: "tsp" });
  });

  it("cup über die Dichte: feste Zutaten in Gramm, Flüssigkeiten in ml", () => {
    expect(convertUsAmount(1, "cup", 0.53)).toEqual({ amount: 127, unit: "g" }); // Mehl
    expect(convertUsAmount(1, "cup", 0.85)).toEqual({ amount: 204, unit: "g" }); // Zucker
    expect(convertUsAmount(0.5, "cup", 0.91)).toEqual({ amount: 109, unit: "g" }); // Butter
    expect(convertUsAmount(1, "cup", 1.03)).toEqual({ amount: 240, unit: "ml" }); // Milch
    expect(convertUsAmount(1, "cup")).toEqual({ amount: 240, unit: "ml" }); // ohne Dichte
    expect(convertUsAmount(4, "fl_oz")).toEqual({ amount: 118, unit: "ml" });
    expect(convertUsAmount(1, "quart")).toEqual({ amount: 946, unit: "ml" });
  });

  it("Flüssigkeitsgrenze", () => {
    expect(isLiquidDensity(1)).toBe(true);
    expect(isLiquidDensity(0.92)).toBe(false); // Öl wird gewogen
    expect(isLiquidDensity(1.42)).toBe(false); // Honig
    expect(isLiquidDensity(null)).toBe(true);
  });
});

describe("Fahrenheit", () => {
  it("rechnet Backofentemperaturen auf 5 °C gerundet um", () => {
    expect(fahrenheitToCelsius(350)).toBe(175);
    expect(fahrenheitToCelsius(400)).toBe(205);
    expect(fahrenheitToCelsius(425)).toBe(220);
    expect(fahrenheitToCelsius(212)).toBe(100);
  });

  it("ersetzt Angaben im Schritttext", () => {
    expect(convertFahrenheitInText("Preheat the oven to 350°F.")).toBe("Preheat the oven to 175 °C.");
    expect(convertFahrenheitInText("Bake at 375 degrees F for 20 minutes")).toBe("Bake at 190 °C for 20 minutes");
    expect(convertFahrenheitInText("Heat oil to 350-375 °F")).toBe("Heat oil to 175–190 °C");
    expect(convertFahrenheitInText("Ofen auf 400 Grad Fahrenheit")).toBe("Ofen auf 205 °C");
    expect(convertFahrenheitInText("Bei 180 °C backen, 2 F-Löffel")).toBe("Bei 180 °C backen, 2 F-Löffel");
  });
});

describe("refineUsLine", () => {
  it("rechnet cups nach der Zuordnung über die Dichte um, behält die Notiz", () => {
    const flour = refineUsLine(parseIngredientLine("2 cups flour"), 0.53);
    expect(flour).toMatchObject({ amount: 254, unit: "g", note: "aus 2 cup", us: { amount: 2, unit: "cup" } });
    expect(refineUsLine(parseIngredientLine("1 cup milk"), 1.03)).toMatchObject({ amount: 240, unit: "ml" });
    // Gewicht und Löffel ändern sich nicht
    expect(refineUsLine(parseIngredientLine("8 oz cream cheese"), 0.98)).toMatchObject({ amount: 227, unit: "g" });
    expect(refineUsLine(parseIngredientLine("200 g Mehl"), 0.53)).toMatchObject({ amount: 200, unit: "g", us: null });
  });
});
