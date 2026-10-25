// Reine Logik für den Rezept-Editor (Design vom 25.10.2026): kompakte Listen, Sheets, Drag & Drop.
// Zutaten verweisen über den stabilen Schlüssel ihres Schritts (stepKey) auf ihn. Beim Speichern wird daraus die
// Schrittnummer (step_position); so wandert die Zuordnung beim Verschieben von Schritten automatisch mit.

import type { Unit } from "./units";
import { detectTimers, formatDuration, type DetectedTimer } from "./timers";

export type StepRef = { key: number };
export type LineRef = { key: number; stepKey: number | null };

/** Element von Index `from` nach `to` verschieben (wie arrayMove von dnd-kit). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/** Nummer des Schritts (1, 2, …) zu einem Schlüssel; null ohne Schritt oder wenn der Schritt nicht mehr existiert. */
export function stepNumberOf(stepKey: number | null, steps: readonly StepRef[]): number | null {
  if (stepKey == null) return null;
  const index = steps.findIndex((s) => s.key === stepKey);
  return index >= 0 ? index + 1 : null;
}

/** step_position je Zutat für das Speichern. */
export function stepPositions(lines: readonly LineRef[], steps: readonly StepRef[]): (number | null)[] {
  return lines.map((l) => stepNumberOf(l.stepKey, steps));
}

/** Schritt löschen: Zutaten dieses Schritts landen bei „Ohne Schritt“. */
export function removeStep<S extends StepRef, L extends LineRef>(steps: readonly S[], lines: readonly L[], stepKey: number) {
  return {
    steps: steps.filter((s) => s.key !== stepKey),
    lines: lines.map((l) => (l.stepKey === stepKey ? { ...l, stepKey: null } : l)),
  };
}

export type LineGroup<L> = { stepKey: number | null; number: number | null; lines: L[] };

/** Zutaten nach Schritt gruppiert (alle Schritte, auch ohne Zutaten), am Ende „Ohne Schritt“. */
export function groupLinesByStep<L extends LineRef>(lines: readonly L[], steps: readonly StepRef[]): LineGroup<L>[] {
  const known = new Set(steps.map((s) => s.key));
  const groups: LineGroup<L>[] = steps.map((s, i) => ({ stepKey: s.key, number: i + 1, lines: lines.filter((l) => l.stepKey === s.key) }));
  groups.push({ stepKey: null, number: null, lines: lines.filter((l) => l.stepKey == null || !known.has(l.stepKey)) });
  return groups;
}

/**
 * Zutat in der Ansicht „Nach Schritt“ ablegen: auf eine andere Zutat (nimmt deren Schritt und Platz) oder auf eine
 * Gruppe (ans Ende dieser Gruppe). Die Reihenfolge der Gesamtliste folgt dabei der Ablage.
 */
export function dropLine<L extends LineRef>(
  lines: readonly L[],
  activeKey: number,
  target: { overLineKey: number } | { groupStepKey: number | null },
): L[] {
  const from = lines.findIndex((l) => l.key === activeKey);
  if (from < 0) return [...lines];
  if ("overLineKey" in target) {
    const to = lines.findIndex((l) => l.key === target.overLineKey);
    if (to < 0) return [...lines];
    const stepKey = lines[to].stepKey;
    return moveItem(lines, from, to).map((l) => (l.key === activeKey ? { ...l, stepKey } : l));
  }
  const stepKey = target.groupStepKey;
  const moved = { ...lines[from], stepKey };
  const rest = lines.filter((l) => l.key !== activeKey);
  const lastInGroup = rest.map((l) => l.stepKey).lastIndexOf(stepKey);
  // Leere Gruppe: Platz in der Gesamtliste bleibt
  const at = lastInGroup >= 0 ? lastInGroup + 1 : Math.min(from, rest.length);
  return [...rest.slice(0, at), moved, ...rest.slice(at)];
}

/** Chip-Text für die Zutaten eines Schritts: „Zwiebeln, Knoblauch +2“. */
export function ingredientChipText(names: readonly string[], max = 2): string {
  if (names.length === 0) return "";
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown} +${names.length - max}` : shown;
}

/** Schrittweite für −/+ an der Menge, je Einheit und Größe. */
export function amountStep(unit: Unit | null, value: number | null): number {
  const v = value ?? 0;
  switch (unit) {
    case "g":
    case "ml":
      return v < 10 ? 1 : v < 100 ? 5 : v < 500 ? 10 : 50;
    case "piece":
      return v > 0 && v < 1 ? 0.5 : 1;
    case "tbsp":
    case "tsp":
    case "cl":
      return 0.5;
    default:
      return 1;
  }
}

/** Menge um eine Stufe ändern, auf das Raster der Schrittweite; nie unter eine Stufe. */
export function stepAmount(value: number | null, unit: Unit | null, direction: 1 | -1): number {
  const current = value ?? 0;
  // Beim Verringern zählt die Stufe unterhalb des Werts (100 g − → 95 g, nicht 90 g)
  const step = amountStep(unit, direction > 0 ? current : current - 1e-9);
  const next = direction > 0 ? Math.floor(current / step + 1e-9) * step + step : Math.ceil(current / step - 1e-9) * step - step;
  const min = amountStep(unit, 1e-9);
  return Math.round(Math.max(min, next) * 100) / 100;
}

/** Anteile von Protein, Kohlenhydraten und Fett an den kcal (4/4/9 kcal je g), zusammen 1 (oder alle 0). */
export function macroEnergyShares(m: { protein: number; carbs: number; fat: number }) {
  const p = Math.max(0, m.protein) * 4;
  const c = Math.max(0, m.carbs) * 4;
  const f = Math.max(0, m.fat) * 9;
  const sum = p + c + f;
  if (sum <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return { protein: p / sum, carbs: c / sum, fat: f / sum };
}

/** Minuten als „45 Min.“, „3 Std.“, „3 Std. 30 Min.“; null bei 0 oder leer. */
export function formatMinutes(minutes: number | null): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  return formatDuration(Math.round(minutes) * 60);
}

export type TimerMode = "text" | "custom" | "none";

/** Timer-Modus aus den gespeicherten Feldern. */
export function timerModeOf(step: { timer_seconds: number | null; timer_from_text?: boolean }): TimerMode {
  if (step.timer_seconds) return "custom";
  return step.timer_from_text === false ? "none" : "text";
}

/** Kurzform eines erkannten Timers für Chips: „10 Min.“, „2–3 Std.“, „20–25 Min.“. */
export function timerShortLabel(timer: Pick<DetectedTimer, "seconds" | "maxSeconds">): string {
  if (timer.maxSeconds == null) return formatDuration(timer.seconds);
  for (const [factor, unit] of [
    [3600, "Std."],
    [60, "Min."],
  ] as const) {
    if (timer.seconds % factor === 0 && timer.maxSeconds % factor === 0) {
      return `${timer.seconds / factor}–${timer.maxSeconds / factor} ${unit}`;
    }
  }
  return `${formatDuration(timer.seconds)} – ${formatDuration(timer.maxSeconds)}`;
}

/** Timer-Chip eines Schritts in der Liste; null ohne Timer. */
export function stepTimerChip(text: string, mode: TimerMode, customSeconds: number | null): string | null {
  if (mode === "custom") return customSeconds && customSeconds > 0 ? formatDuration(customSeconds) : null;
  if (mode === "none") return null;
  const found = detectTimers(text);
  if (found.length === 0) return null;
  const first = timerShortLabel(found[0]);
  return found.length > 1 ? `${first} +${found.length - 1}` : first;
}
