import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it("erlaubt relative Pfade in der App", () => {
    expect(safeRedirectPath("/wochenplan")).toBe("/wochenplan");
    expect(safeRedirectPath("/rezepte/123?x=1")).toBe("/rezepte/123?x=1");
  });

  it("blockt fremde Ziele", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/rezepte");
    expect(safeRedirectPath("//evil.example")).toBe("/rezepte");
    expect(safeRedirectPath("/\\evil.example")).toBe("/rezepte");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/rezepte");
  });

  it("fällt bei leeren oder ungültigen Werten zurück", () => {
    expect(safeRedirectPath(null)).toBe("/rezepte");
    expect(safeRedirectPath("")).toBe("/rezepte");
    expect(safeRedirectPath("/a\nb")).toBe("/rezepte");
  });
});
