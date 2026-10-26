import type { MealSlot } from "./plan";

// Startseite (26.10.2026): Widgets in eigener Reihenfolge, einzeln ein- und ausblendbar, gespeichert je Nutzer
// in user_settings.home_widgets als [{ id, visible }].

export const HOME_WIDGETS = [
  { id: "today", label: "Heute", description: "kcal und Protein von heute", visible: true },
  { id: "food", label: "Essen & Trinken", description: "Bereich mit Rezepte, Wochenplan, Einkauf, Bar", visible: true },
  { id: "sport", label: "Sport & Gesundheit", description: "Bereich (kommt bald)", visible: true },
  { id: "meals", label: "Heute geplant", description: "Mahlzeiten aus dem Wochenplan", visible: true },
  { id: "shopping", label: "Einkaufsliste", description: "Was noch fehlt", visible: true },
  { id: "ready", label: "Was kann ich kochen?", description: "Rezepte und Cocktails aus dem Vorrat", visible: true },
  { id: "expiring", label: "Läuft bald ab", description: "Vorrat mit Ablaufdatum", visible: false },
  { id: "longNotCooked", label: "Lange nicht gekocht", description: "Gut bewertete Rezepte von früher", visible: false },
] as const;

export type HomeWidgetId = (typeof HOME_WIDGETS)[number]["id"];
export type HomeWidget = { id: HomeWidgetId; visible: boolean };

const IDS = new Set<string>(HOME_WIDGETS.map((w) => w.id));

export function isHomeWidgetId(value: unknown): value is HomeWidgetId {
  return typeof value === "string" && IDS.has(value);
}

export function defaultHomeLayout(): HomeWidget[] {
  return HOME_WIDGETS.map(({ id, visible }) => ({ id, visible }));
}

/**
 * Gespeicherte Anordnung lesen: Unbekanntes und Doppeltes fällt weg, neue Widgets (später z. B. aus Sport)
 * kommen mit ihrer Standard-Sichtbarkeit hinten dazu. Ohne gespeicherte Anordnung gilt der Standard.
 */
export function normalizeHomeLayout(raw: unknown): HomeWidget[] {
  if (!Array.isArray(raw)) return defaultHomeLayout();
  const seen = new Set<HomeWidgetId>();
  const result: HomeWidget[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { id, visible } = item as { id?: unknown; visible?: unknown };
    if (!isHomeWidgetId(id) || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, visible: visible !== false });
  }
  for (const widget of defaultHomeLayout()) if (!seen.has(widget.id)) result.push(widget);
  return result;
}

/** Stunde in Deutschland (0–23). */
export function berlinHour(now: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("de-DE", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Berlin" }).format(now);
  return Number.parseInt(hour, 10);
}

export function greeting(hour: number): string {
  if (hour >= 5 && hour < 11) return "Guten Morgen";
  if (hour >= 11 && hour < 18) return "Hallo";
  return "Guten Abend";
}

/** Ab welcher Stunde eine Mahlzeit als vorbei gilt. Snacks gehen den ganzen Tag. */
const SLOT_ENDS: Record<MealSlot, number> = { breakfast: 11, lunch: 15, dinner: 22, snack: 24 };
const SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

export const SLOT_TODAY: Record<MealSlot, string> = {
  breakfast: "Heute früh",
  lunch: "Heute Mittag",
  dinner: "Heute Abend",
  snack: "Snack heute",
};

/** Nächste Mahlzeit des Tages (noch nicht vorbei); Snacks nur, wenn sonst nichts mehr kommt. */
export function upcomingEntry<E extends { slot: MealSlot }>(entries: E[], hour: number): E | null {
  const open = entries.filter((e) => hour < SLOT_ENDS[e.slot]);
  const sorted = [...open].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  return sorted[0] ?? null;
}
