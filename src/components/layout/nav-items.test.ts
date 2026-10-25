import { describe, expect, it } from "vitest";
import { isEditorPath } from "./nav-items";

describe("isEditorPath", () => {
  it("erkennt Neu und Bearbeiten", () => {
    expect(isEditorPath("/rezepte/neu")).toBe(true);
    expect(isEditorPath("/rezepte/0b6c2f2e-1d6f-4a51-9a51-2b7b3c3f2a10/bearbeiten")).toBe(true);
  });
  it("andere Seiten nicht", () => {
    expect(isEditorPath("/rezepte")).toBe(false);
    expect(isEditorPath("/rezepte/bar")).toBe(false);
    expect(isEditorPath("/rezepte/0b6c2f2e-1d6f-4a51-9a51-2b7b3c3f2a10")).toBe(false);
    expect(isEditorPath("/einstellungen/import")).toBe(false);
  });
});
