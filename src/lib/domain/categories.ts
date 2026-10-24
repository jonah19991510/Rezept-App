import { z } from "zod";

// Eigene Kategorien (24.10.2026): Jeder Nutzer pflegt seine Liste in den Einstellungen (Tabelle recipe_categories).
// Am Rezept steht der Name als Text (recipes.category_name). Die Startliste sind die bisherigen festen Kategorien.

/** Startliste für jeden Nutzer (wie in der Migration …20261024130000; „Getränk“ hatten nur Cocktails) */
export const DEFAULT_CATEGORIES = [
  "Pasta",
  "Reis",
  "Bowl",
  "Suppe/Eintopf",
  "Salat",
  "Auflauf",
  "Fleischgericht",
  "Fisch",
  "Frühstück",
  "Snack",
  "Dessert",
] as const;

/** Schlüssel der früheren festen Liste (Enum) → Name; für alte Backups, Links und geteilte Karten */
export const LEGACY_CATEGORY_NAMES: Record<string, string> = {
  pasta: "Pasta",
  rice: "Reis",
  bowl: "Bowl",
  soup: "Suppe/Eintopf",
  salad: "Salat",
  casserole: "Auflauf",
  meat: "Fleischgericht",
  fish: "Fisch",
  breakfast: "Frühstück",
  snack: "Snack",
  dessert: "Dessert",
  drink: "Getränk",
};

export const CATEGORY_MAX = 40;

/** Name einer Kategorie: ohne Leerzeichen am Rand, 1–40 Zeichen */
export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Bitte einen Namen eingeben.")
  .max(CATEGORY_MAX, `Höchstens ${CATEGORY_MAX} Zeichen.`);

/** Text oder alter Schlüssel („pasta“) → Name; leer → null. */
export function normalizeCategory(value: string | null | undefined): string | null {
  const text = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!text) return null;
  return LEGACY_CATEGORY_NAMES[text] ?? text.slice(0, CATEGORY_MAX);
}

const key = (name: string) => name.toLocaleLowerCase("de-DE");

/** Gleiche Kategorie (Groß-/Kleinschreibung egal, wie der eindeutige Index in der Datenbank). */
export function sameCategory(a: string | null | undefined, b: string | null | undefined): boolean {
  return a != null && b != null && key(a) === key(b);
}

/** Name aus der eigenen Liste (in deren Schreibweise), sonst null; z. B. für Vorschläge beim Import. */
export function matchCategory(value: string | null | undefined, own: readonly string[]): string | null {
  const name = normalizeCategory(value);
  return own.find((c) => sameCategory(c, name)) ?? null;
}

const collator = new Intl.Collator("de-DE", { sensitivity: "base" });

/**
 * Auswahl für Filter und Editor: die eigene Liste in ihrer Reihenfolge, danach weitere Kategorien, die in Rezepten
 * vorkommen (z. B. übernommene), alphabetisch. Ohne Doppelte.
 */
export function categoryOptions(own: readonly string[], present: readonly (string | null | undefined)[] = []): string[] {
  const result = [...own];
  const extra = present
    .filter((c): c is string => Boolean(c))
    .filter((c, i, all) => !result.some((o) => sameCategory(o, c)) && all.findIndex((x) => sameCategory(x, c)) === i)
    .sort(collator.compare);
  return [...result, ...extra];
}
