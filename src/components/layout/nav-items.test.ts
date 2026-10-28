import { describe, expect, it } from "vitest";
import { areaForPath, isEditorPath, navItemsFor, sharedHref } from "./nav-items";

describe("isEditorPath", () => {
  it("erkennt Neu und Bearbeiten", () => {
    expect(isEditorPath("/rezepte/neu")).toBe(true);
    expect(isEditorPath("/rezepte/0b6c2f2e-1d6f-4a51-9a51-2b7b3c3f2a10/bearbeiten")).toBe(true);
    expect(isEditorPath("/sport/plaene/neu")).toBe(true);
    expect(isEditorPath("/sport/plaene/0b6c2f2e-1d6f-4a51-9a51-2b7b3c3f2a10/bearbeiten")).toBe(true);
  });
  it("andere Seiten nicht", () => {
    expect(isEditorPath("/rezepte")).toBe(false);
    expect(isEditorPath("/rezepte/bar")).toBe(false);
    expect(isEditorPath("/rezepte/0b6c2f2e-1d6f-4a51-9a51-2b7b3c3f2a10")).toBe(false);
    expect(isEditorPath("/einstellungen/import")).toBe(false);
    expect(isEditorPath("/sport/plaene")).toBe(false);
    expect(isEditorPath("/sport/plaene/0b6c2f2e-1d6f-4a51-9a51-2b7b3c3f2a10")).toBe(false);
  });
});

describe("areaForPath", () => {
  it("ordnet Seiten den Bereichen zu", () => {
    expect(areaForPath("/")).toBe("start");
    expect(areaForPath("/sport")).toBe("sport");
    expect(areaForPath("/sport/training")).toBe("sport");
    expect(areaForPath("/rezepte")).toBe("food");
    expect(areaForPath("/einstellungen")).toBe("food");
    expect(areaForPath("/sportlich")).toBe("food");
  });
});

describe("navItemsFor", () => {
  it("zeigt im Sport-Bereich die Sport-Navigation", () => {
    expect(navItemsFor("sport")[0].label).toBe("Pläne");
    expect(navItemsFor("food")[0].label).toBe("Rezepte");
    expect(navItemsFor("start").map((i) => i.label)).toEqual(["Start", "Ernährung", "Sport"]);
  });
});

describe("gemeinsame Seiten", () => {
  it("bleiben im Bereich aus ?bereich=", () => {
    expect(areaForPath("/einstellungen", "sport")).toBe("sport");
    expect(areaForPath("/einstellungen")).toBe("food");
    expect(areaForPath("/admin", "sport")).toBe("sport");
    expect(areaForPath("/rezepte", "sport")).toBe("food");
    expect(areaForPath("/einstellungen", "start")).toBe("start");
    expect(areaForPath("/einstellungen", "irgendwas")).toBe("food");
  });

  it("bekommen den Bereich im Link mit", () => {
    expect(sharedHref("/einstellungen", "sport")).toBe("/einstellungen?bereich=sport");
    expect(sharedHref("/einstellungen#daten", "sport")).toBe("/einstellungen?bereich=sport#daten");
    expect(sharedHref("/einstellungen", "food")).toBe("/einstellungen");
    expect(sharedHref("/einstellungen", "start")).toBe("/einstellungen?bereich=start");
  });
});
