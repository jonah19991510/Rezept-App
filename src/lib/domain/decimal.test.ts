import { describe, expect, it } from "vitest";
import { formatDecimalInput, parseDecimal } from "./decimal";

describe("parseDecimal", () => {
  it("liest Komma und Punkt als Dezimaltrenner", () => {
    expect(parseDecimal("1,5")).toBe(1.5);
    expect(parseDecimal("1.5")).toBe(1.5);
    expect(parseDecimal(" 250 ")).toBe(250);
    expect(parseDecimal(",5")).toBe(0.5);
  });

  it("versteht Tausenderpunkte im deutschen Format", () => {
    expect(parseDecimal("1.234,5")).toBe(1234.5);
  });

  it("lehnt Unsinn ab", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("1,2,3")).toBeNull();
    expect(parseDecimal(null)).toBeNull();
  });
});

describe("formatDecimalInput", () => {
  it("schreibt Komma und kürzt", () => {
    expect(formatDecimalInput(1.5)).toBe("1,5");
    expect(formatDecimalInput(2)).toBe("2");
    expect(formatDecimalInput(0.3333)).toBe("0,33");
    expect(formatDecimalInput(null)).toBe("");
  });
});
