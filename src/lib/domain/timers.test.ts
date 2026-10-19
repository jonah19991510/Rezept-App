import { describe, expect, it } from "vitest";
import { detectTimers, formatCountdown, formatDuration, splitStepText } from "./timers";

const t = (text: string) => detectTimers(text).map(({ label, seconds, maxSeconds }) => ({ label, seconds, maxSeconds }));

describe("detectTimers", () => {
  it("Minuten, Stunden, Sekunden in üblichen Schreibweisen", () => {
    expect(t("Die Nudeln 10 Minuten kochen.")).toEqual([{ label: "10 Minuten", seconds: 600, maxSeconds: null }]);
    expect(t("Im Ofen 1 Std. backen")).toEqual([{ label: "1 Std.", seconds: 3600, maxSeconds: null }]);
    expect(t("30 Sek. rühren")).toEqual([{ label: "30 Sek.", seconds: 30, maxSeconds: null }]);
    expect(t("5 Min. ziehen lassen, dann 15min ruhen")).toEqual([
      { label: "5 Min.", seconds: 300, maxSeconds: null },
      { label: "15min", seconds: 900, maxSeconds: null },
    ]);
    expect(t("1,5 Stunden schmoren")).toEqual([{ label: "1,5 Stunden", seconds: 5400, maxSeconds: null }]);
    expect(t("1½ Std. garen")).toEqual([{ label: "1½ Std.", seconds: 5400, maxSeconds: null }]);
  });

  it("Bereiche mit „ca.“: Timer zur kürzeren Zeit, obere Grenze gemerkt", () => {
    expect(t("ca. 20–25 Min. backen")).toEqual([{ label: "ca. 20–25 Min.", seconds: 1200, maxSeconds: 1500 }]);
    expect(t("2-3 Minuten anbraten")).toEqual([{ label: "2-3 Minuten", seconds: 120, maxSeconds: 180 }]);
    expect(t("10 bis 12 Minuten")).toEqual([{ label: "10 bis 12 Minuten", seconds: 600, maxSeconds: 720 }]);
  });

  it("Zahlwörter und feste Ausdrücke", () => {
    expect(t("eine Minute aufschlagen")).toEqual([{ label: "eine Minute", seconds: 60, maxSeconds: null }]);
    expect(t("zwei Stunden marinieren")).toEqual([{ label: "zwei Stunden", seconds: 7200, maxSeconds: null }]);
    expect(t("eine halbe Stunde gehen lassen")).toEqual([{ label: "eine halbe Stunde", seconds: 1800, maxSeconds: null }]);
    expect(t("eine Viertelstunde ruhen")).toEqual([{ label: "Viertelstunde", seconds: 900, maxSeconds: null }]);
  });

  it("Stunden und Minuten hintereinander werden ein Timer", () => {
    expect(t("1 Std. 30 Min. im Ofen")).toEqual([{ label: "1 Std. 30 Min.", seconds: 5400, maxSeconds: null }]);
    expect(t("1 Stunde und 20 Minuten")).toEqual([{ label: "1 Stunde und 20 Minuten", seconds: 4800, maxSeconds: null }]);
  });

  it("englische Rezepte", () => {
    expect(t("Simmer for 10 minutes.")).toEqual([{ label: "10 minutes", seconds: 600, maxSeconds: null }]);
    expect(t("Bake about 25-30 mins")).toEqual([{ label: "about 25-30 mins", seconds: 1500, maxSeconds: 1800 }]);
    expect(t("Let rest for an hour")).toEqual([{ label: "an hour", seconds: 3600, maxSeconds: null }]);
    expect(t("Chill for half an hour")).toEqual([{ label: "half an hour", seconds: 1800, maxSeconds: null }]);
  });

  it("keine Fehltreffer", () => {
    expect(t("Mit Minze garnieren")).toEqual([]);
    expect(t("Auf 180 Grad vorheizen, 200 g Mehl")).toEqual([]);
    expect(t("Über Nacht ziehen lassen")).toEqual([]);
    expect(t("einige Minuten")).toEqual([]);
    expect(t("Ein Ei aufschlagen")).toEqual([]);
  });
});

describe("splitStepText", () => {
  it("Text und Timer im Wechsel", () => {
    const parts = splitStepText("Erst 5 Min. anbraten, dann 20 Minuten köcheln.");
    expect(parts.map((p) => (p.type === "text" ? p.text : `[${p.timer.label}]`))).toEqual([
      "Erst ",
      "[5 Min.]",
      " anbraten, dann ",
      "[20 Minuten]",
      " köcheln.",
    ]);
  });
});

describe("Formatierung", () => {
  it("Restzeit und Dauer", () => {
    expect(formatCountdown(245_000)).toBe("4:05");
    expect(formatCountdown(3_723_000)).toBe("1:02:03");
    expect(formatCountdown(-5)).toBe("0:00");
    expect(formatCountdown(1)).toBe("0:01");
    expect(formatDuration(600)).toBe("10 Min.");
    expect(formatDuration(5400)).toBe("1 Std. 30 Min.");
    expect(formatDuration(45)).toBe("45 Sek.");
    expect(formatDuration(3600)).toBe("1 Std.");
  });
});
