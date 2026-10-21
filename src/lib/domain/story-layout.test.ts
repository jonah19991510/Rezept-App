import { describe, expect, it } from "vitest";
import { STORY_MAX_HEIGHT, STORY_MIN_HEIGHT, storyHeight, wrappedLines, type StoryContent } from "./story-layout";

describe("wrappedLines", () => {
  it("bricht an Wortgrenzen um", () => {
    expect(wrappedLines("", 10)).toBe(1);
    expect(wrappedLines("eins zwei", 10)).toBe(1);
    expect(wrappedLines("eins zwei drei", 10)).toBe(2);
    expect(wrappedLines("Donaudampfschifffahrt", 10)).toBe(3);
    expect(wrappedLines("a\nb", 10)).toBe(2);
  });
});

describe("storyHeight", () => {
  const base: StoryContent = {
    hasPhoto: true,
    hasKicker: true,
    title: "Gulasch",
    meta: "4 Portionen · 2 Std.",
    hasMacros: true,
    ingredients: ["Rindfleisch", "Zwiebeln", "Paprikapulver"],
    steps: ["Fleisch würfeln.", "Anbraten und schmoren."],
    sides: null,
  };

  it("bleibt bei kurzen Rezepten im Story-Format", () => {
    expect(storyHeight(base)).toBe(STORY_MIN_HEIGHT);
  });

  it("wird mit vielen Schritten länger, aber nie länger als das Maximum", () => {
    const step = "Die Zwiebeln in feine Streifen schneiden und in reichlich Butterschmalz langsam goldbraun anbraten. ".repeat(3);
    const long = storyHeight({ ...base, steps: Array.from({ length: 10 }, () => step) });
    expect(long).toBeGreaterThan(STORY_MIN_HEIGHT);
    expect(storyHeight({ ...base, steps: Array.from({ length: 10 }, () => step), sides: "Passt dazu: Spätzle" })).toBeGreaterThan(long);
    expect(storyHeight({ ...base, steps: Array.from({ length: 60 }, () => step.repeat(3)) })).toBe(STORY_MAX_HEIGHT);
  });
});
