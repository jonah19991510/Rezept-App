import { describe, expect, it } from "vitest";
import { buildPhases, clockLabel, DEFAULT_INTERVAL, locate, normalizeSettings, phaseStartMs, previousTargetMs, totalSeconds } from "./interval-timer";

const settings = { prepare: 10, work: 40, rest: 20, rounds: 2 };

describe("buildPhases", () => {
  it("wechselt ohne Übungen Belastung und Pause, nach der letzten Belastung ohne Pause", () => {
    const phases = buildPhases(settings);
    expect(phases.map((p) => p.kind)).toEqual(["prepare", "work", "rest", "work"]);
    expect(phases.map((p) => p.round)).toEqual([1, 1, 1, 2]);
    expect(totalSeconds(phases)).toBe(110);
  });

  it("läuft je Runde alle Übungen durch, feste Zeiten aus dem Plan gehen vor", () => {
    const phases = buildPhases({ ...settings, prepare: 0 }, [
      { name: "Liegestütze", seconds: null },
      { name: "Plank", seconds: 60 },
    ]);
    expect(phases.filter((p) => p.kind === "work").map((p) => [p.label, p.seconds, p.round])).toEqual([
      ["Liegestütze", 40, 1],
      ["Plank", 60, 1],
      ["Liegestütze", 40, 2],
      ["Plank", 60, 2],
    ]);
    expect(phases.at(-1)?.kind).toBe("work");
  });

  it("lässt Vorbereitung und Pause bei 0 Sekunden weg", () => {
    expect(buildPhases({ prepare: 0, work: 30, rest: 0, rounds: 2 }).map((p) => p.kind)).toEqual(["work", "work"]);
  });
});

describe("locate", () => {
  const phases = buildPhases(settings);

  it("findet Phase und Restzeit", () => {
    expect(locate(phases, 0)).toEqual({ index: 0, remainingMs: 10_000, done: false });
    expect(locate(phases, 10_000)).toEqual({ index: 1, remainingMs: 40_000, done: false });
    expect(locate(phases, 55_500)).toEqual({ index: 2, remainingMs: 14_500, done: false });
  });

  it("bleibt am Ende auf der letzten Phase stehen, auch nach langer Drosselung", () => {
    expect(locate(phases, 110_000)).toEqual({ index: 3, remainingMs: 0, done: true });
    expect(locate(phases, 9_999_999)).toEqual({ index: 3, remainingMs: 0, done: true });
  });
});

describe("Springen", () => {
  const phases = buildPhases(settings);

  it("kennt den Beginn jeder Phase", () => {
    expect(phaseStartMs(phases, 0)).toBe(0);
    expect(phaseStartMs(phases, 2)).toBe(50_000);
  });

  it("geht zurück an den Phasenanfang, kurz nach dem Anfang zur vorigen Phase", () => {
    expect(previousTargetMs(phases, 30_000)).toBe(10_000);
    expect(previousTargetMs(phases, 11_000)).toBe(0);
    expect(previousTargetMs(phases, 500)).toBe(0);
  });
});

describe("normalizeSettings", () => {
  it("nimmt für Unbrauchbares den Standard", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_INTERVAL);
    expect(normalizeSettings({ work: "viel", rest: Number.NaN })).toEqual(DEFAULT_INTERVAL);
  });

  it("begrenzt und rundet", () => {
    expect(normalizeSettings({ prepare: -5, work: 1, rest: 12.4, rounds: 999 })).toEqual({ prepare: 0, work: 5, rest: 12, rounds: 50 });
  });
});

describe("clockLabel", () => {
  it("zeigt Minuten und Sekunden", () => {
    expect(clockLabel(5)).toBe("0:05");
    expect(clockLabel(125)).toBe("2:05");
    expect(clockLabel(3700)).toBe("61:40");
  });
});
