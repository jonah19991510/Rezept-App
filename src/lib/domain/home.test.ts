import { describe, expect, it } from "vitest";
import { berlinHour, defaultHomeLayout, greeting, HOME_WIDGETS, normalizeHomeLayout, upcomingEntry } from "./home";

describe("normalizeHomeLayout", () => {
  it("nimmt ohne gespeicherte Anordnung den Standard", () => {
    expect(normalizeHomeLayout(null)).toEqual(defaultHomeLayout());
    expect(normalizeHomeLayout("kaputt")).toEqual(defaultHomeLayout());
  });

  it("behält Reihenfolge und Sichtbarkeit und hängt fehlende Widgets an", () => {
    const layout = normalizeHomeLayout([
      { id: "shopping", visible: true },
      { id: "today", visible: false },
    ]);
    expect(layout.slice(0, 2)).toEqual([
      { id: "shopping", visible: true },
      { id: "today", visible: false },
    ]);
    expect(layout).toHaveLength(HOME_WIDGETS.length);
    expect(layout.find((w) => w.id === "expiring")).toEqual({ id: "expiring", visible: false });
  });

  it("verwirft Unbekanntes und Doppeltes", () => {
    const layout = normalizeHomeLayout([{ id: "gibtsnicht" }, { id: "food" }, { id: "food", visible: false }, 3, null]);
    expect(layout[0]).toEqual({ id: "food", visible: true });
    expect(layout.filter((w) => w.id === "food")).toHaveLength(1);
  });
});

describe("greeting", () => {
  it("passt zur Tageszeit", () => {
    expect(greeting(7)).toBe("Guten Morgen");
    expect(greeting(13)).toBe("Hallo");
    expect(greeting(20)).toBe("Guten Abend");
    expect(greeting(2)).toBe("Guten Abend");
  });
});

describe("berlinHour", () => {
  it("rechnet in deutscher Zeit", () => {
    expect(berlinHour(new Date("2026-10-26T07:30:00Z"))).toBe(8); // Winterzeit, UTC+1
    expect(berlinHour(new Date("2026-07-01T22:30:00Z"))).toBe(0); // Sommerzeit, UTC+2
  });
});

describe("upcomingEntry", () => {
  const entries = [
    { slot: "snack" as const, title: "Nüsse" },
    { slot: "dinner" as const, title: "Bratreis" },
    { slot: "breakfast" as const, title: "Porridge" },
  ];

  it("nimmt die nächste Mahlzeit, die noch nicht vorbei ist", () => {
    expect(upcomingEntry(entries, 8)?.title).toBe("Porridge");
    expect(upcomingEntry(entries, 12)?.title).toBe("Bratreis");
  });

  it("zeigt spät nur noch den Snack, sonst nichts", () => {
    expect(upcomingEntry(entries, 23)?.title).toBe("Nüsse");
    expect(upcomingEntry([{ slot: "lunch" as const }], 16)).toBeNull();
  });
});
