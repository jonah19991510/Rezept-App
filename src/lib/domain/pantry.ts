import { daysBetween } from "./week";
import { formatShoppingAmount, type FoodGroup, type ShoppingUnit } from "./shopping";
import { UNIT_ML, type Unit } from "./units";

// Vorratsschrank (Phase 10): Abgleich mit Einkaufsliste und Rezepten, Übernehmen von Einkäufen,
// Abziehen nach dem Kochen. Mengen im Vorrat sind freiwillig („vorhanden“ reicht) und nutzen
// dieselben Einheiten wie die Einkaufsliste: g, ml oder Stück.

export type PantryUnit = ShoppingUnit;
export const PANTRY_UNITS: PantryUnit[] = ["g", "ml", "Stück"];
export type PantryLocation = "kitchen" | "bar";

export type PantryAmount = { amount: number | null; unit: PantryUnit | null };
export type PantryEntry = PantryAmount & {
  id: string;
  ingredientId: string;
  location: PantryLocation;
  expiresOn: string | null;
};

export function isPantryUnit(unit: string | null | undefined): unit is PantryUnit {
  return unit === "g" || unit === "ml" || unit === "Stück";
}

/** Spirituosen, Liköre/Wein und Sirupe/Säfte landen im Bereich Bar, alles andere in der Küche. */
export function defaultLocation(group: FoodGroup): PantryLocation {
  return group === "spirits" || group === "liqueurs_wine" || group === "syrups_juices" ? "bar" : "kitchen";
}

/** Zutat, die im Vorrat zum Abhaken angeboten wird (aus den eigenen Rezepten oder selbst angelegt). */
export type PantryCandidate = { ingredientId: string; name: string; foodGroup: FoodGroup; isStaple: boolean };

/**
 * Abhakliste eines Bereichs: alles, was dort im Vorrat steht, plus die eigenen Zutaten, die in diesen Bereich
 * gehören und nirgends vorhanden sind. Grundzutaten wie Salz (fehlen bei „Was kann ich kochen?“ nie) nur mit
 * includeStaples, dann auch vorhandene. Alphabetisch.
 */
export function pantryChecklist<E extends PantryCandidate & { location: PantryLocation }>(
  candidates: PantryCandidate[],
  entries: E[],
  area: PantryLocation,
  { includeStaples = false }: { includeStaples?: boolean } = {},
): { item: PantryCandidate; entry: E | null }[] {
  const present = new Set(entries.map((e) => e.ingredientId));
  const rows: { item: PantryCandidate; entry: E | null }[] = entries
    .filter((e) => e.location === area && (includeStaples || !e.isStaple))
    .map((e) => ({ item: e, entry: e }));
  for (const c of candidates) {
    if (present.has(c.ingredientId) || (c.isStaple && !includeStaples) || defaultLocation(c.foodGroup) !== area) continue;
    present.add(c.ingredientId);
    rows.push({ item: c, entry: null });
  }
  return rows.sort((a, b) => a.item.name.localeCompare(b.item.name, "de"));
}

export const EXPIRY_SOON_DAYS = 3;

/** „abgelaufen“, „bald“ (in höchstens 3 Tagen) oder „ok“; ohne Datum null. */
export function expiryStatus(expiresOn: string | null, today: string): "expired" | "soon" | "ok" | null {
  if (!expiresOn) return null;
  const days = daysBetween(today, expiresOn);
  if (days < 0) return "expired";
  return days <= EXPIRY_SOON_DAYS ? "soon" : "ok";
}

/** Zusatzzeile im Vorrat: „Läuft heute ab“, „Läuft morgen ab“, „Läuft in 3 Tagen ab“, „Abgelaufen“; früher nichts. */
export function expiryLabel(expiresOn: string | null, today: string): string | null {
  if (!expiresOn) return null;
  const days = daysBetween(today, expiresOn);
  if (days < 0) return "Abgelaufen";
  if (days > EXPIRY_SOON_DAYS) return null;
  return days === 0 ? "Läuft heute ab" : days === 1 ? "Läuft morgen ab" : `Läuft in ${days} Tagen ab`;
}

function roundPantry(amount: number, unit: PantryUnit): number {
  return unit === "Stück" ? Math.round(amount * 4) / 4 : Math.round(amount);
}

export type Coverage = {
  /** none: nichts im Vorrat; have: reicht („hast du schon“); partial: es fehlt noch etwas; unknown: im Vorrat, aber nicht vergleichbar */
  status: "none" | "have" | "partial" | "unknown";
  /** Text wie „200 g im Vorrat“ bzw. „im Vorrat“ */
  pantryText: string | null;
  /** Noch zu kaufen (nur bei partial) */
  remaining: number | null;
};

/** Wie viel von einem Einkaufslisten-Eintrag schon im Vorrat ist (alle Bereiche zusammen). */
export function coverShoppingItem(item: { amount: number | null; unit: string | null }, entries: PantryAmount[]): Coverage {
  if (entries.length === 0) return { status: "none", pantryText: null, remaining: null };
  const unknownAmount = entries.some((e) => e.amount == null);
  const sameUnit = isPantryUnit(item.unit) ? entries.filter((e) => e.amount != null && e.unit === item.unit) : [];
  const total = sameUnit.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const known = entries.find((e) => e.amount != null);
  const pantryText =
    sameUnit.length > 0
      ? `${formatShoppingAmount(total, item.unit)} im Vorrat`
      : known
        ? `${formatShoppingAmount(known.amount, known.unit)} im Vorrat`
        : "im Vorrat";

  // Ohne Menge auf der Liste oder „vorhanden“ ohne Menge im Vorrat: gilt als vorhanden
  if (item.amount == null || (unknownAmount && sameUnit.length === 0)) return { status: "have", pantryText, remaining: null };
  if (sameUnit.length === 0) return { status: "unknown", pantryText, remaining: null };
  if (total >= item.amount - 1e-9) return { status: "have", pantryText, remaining: null };
  return { status: "partial", pantryText, remaining: roundPantry(item.amount - total, item.unit as PantryUnit) };
}

/** Eingekauftes in den Vorrat: gleiche Einheit wird addiert, sonst gilt die neue Angabe. */
export function mergeIntoPantry(existing: PantryAmount | null, bought: { amount: number | null; unit: string | null }): PantryAmount {
  const unit = isPantryUnit(bought.unit) ? bought.unit : null;
  const amount = unit && bought.amount != null && bought.amount > 0 ? bought.amount : null;
  if (amount == null || unit == null) return existing ?? { amount: null, unit: null };
  if (existing?.amount != null && existing.unit === unit) return { amount: roundPantry(existing.amount + amount, unit), unit };
  return { amount: roundPantry(amount, unit), unit };
}

/**
 * Menge einer Rezeptzeile (mal Faktor) in der Einheit des Vorrats. null, wenn sich das nicht umrechnen lässt.
 * `grams` ist das gespeicherte Gewicht der Zeile (aus Menge, Dichte bzw. Stückgewicht).
 */
export function neededInUnit(
  line: { amount: number | null; unit: Unit | null; grams: number | null },
  factor: number,
  target: PantryUnit,
  info: { density_g_per_ml?: number | null; piece_weight_g?: number | null },
): number | null {
  if (target === "g") return line.grams != null ? line.grams * factor : null;
  if (target === "ml") {
    if (line.amount != null && line.unit && UNIT_ML[line.unit] != null) return line.amount * UNIT_ML[line.unit]! * factor;
    if (line.grams != null) return (line.grams / (info.density_g_per_ml || 1)) * factor;
    return null;
  }
  if (line.unit === "piece" && line.amount != null) return line.amount * factor;
  if (line.grams != null && info.piece_weight_g) return (line.grams / info.piece_weight_g) * factor;
  return null;
}

export type ConsumeResult = { action: "keep" } | { action: "remove" } | { action: "update"; amount: number };

/** Nach dem Kochen: Vorrat um die verbrauchte Menge verringern (Reste unter 1 g/ml bzw. ¼ Stück: aufgebraucht). */
export function consumePantry(entry: PantryAmount, needed: number | null): ConsumeResult {
  if (entry.amount == null || entry.unit == null || needed == null || needed <= 0) return { action: "keep" };
  const rest = entry.amount - needed;
  const minimum = entry.unit === "Stück" ? 0.25 : 1;
  if (rest < minimum) return { action: "remove" };
  return { action: "update", amount: roundPantry(rest, entry.unit) };
}

export type CookRecipe = {
  id: string;
  title: string;
  lines: { ingredientId: string; name: string; isStaple: boolean }[];
};

export type CookOption = {
  id: string;
  title: string;
  /** Benötigte Zutaten ohne Grundzutaten */
  required: number;
  missing: { ingredientId: string; name: string }[];
  /** Wie viele Zutaten aus dem Vorrat bald ablaufen (werden bevorzugt) */
  usesExpiring: number;
  status: "all" | "one" | "few" | "many";
};

/**
 * „Was kann ich kochen?“: Rezepte nach Abdeckung durch den Vorrat. Grundzutaten (Salz, Öl …) zählen nicht.
 * Reihenfolge: alles da, 1 fehlt, 2–3 fehlen, mehr; innerhalb: zuerst Rezepte mit bald ablaufenden Zutaten.
 */
export function cookability(recipes: CookRecipe[], pantryIds: Set<string>, expiringIds: Set<string>): CookOption[] {
  const order = { all: 0, one: 1, few: 2, many: 3 } as const;
  return recipes
    .filter((r) => r.lines.length > 0)
    .map((r) => {
      const needed = new Map<string, string>();
      for (const l of r.lines) if (!l.isStaple) needed.set(l.ingredientId, l.name);
      const missing = [...needed].filter(([id]) => !pantryIds.has(id)).map(([ingredientId, name]) => ({ ingredientId, name }));
      const usesExpiring = [...needed.keys()].filter((id) => pantryIds.has(id) && expiringIds.has(id)).length;
      const status: CookOption["status"] =
        missing.length === 0 ? "all" : missing.length === 1 ? "one" : missing.length <= 3 ? "few" : "many";
      return { id: r.id, title: r.title, required: needed.size, missing, usesExpiring, status };
    })
    .sort(
      (a, b) =>
        order[a.status] - order[b.status] ||
        b.usesExpiring - a.usesExpiring ||
        a.missing.length - b.missing.length ||
        a.title.localeCompare(b.title, "de"),
    );
}

/** Einkaufsliste als Text zum Kopieren/Teilen (nur offene Einträge, nach Abteilung). */
export function shoppingListText(
  sections: { label: string; items: { name: string; amount: number | null; unit: string | null }[] }[],
  heading: string,
): string {
  const parts = [heading];
  for (const section of sections) {
    if (section.items.length === 0) continue;
    parts.push("", section.label);
    for (const item of section.items) {
      const amount = formatShoppingAmount(item.amount, item.unit);
      parts.push(`- ${amount ? `${amount} ` : ""}${item.name}`);
    }
  }
  return parts.join("\n");
}
