/**
 * Liest deutsche Zahleneingaben: „1,5“, „1.5“, „ 250 “, „1.234,5“.
 * Gibt null zurück, wenn das keine Zahl ist.
 */
export function parseDecimal(input: string | number | null | undefined): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (input == null) return null;
  let s = input.trim().replace(/\s/g, "");
  if (s === "") return null;

  if (s.includes(",")) {
    // Deutsch: Punkte sind Tausendertrenner, Komma ist Dezimaltrenner
    s = s.replace(/\./g, "").replace(",", ".");
  }
  if (!/^-?\d*\.?\d+$/.test(s) && !/^-?\d+\.$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Zahl für ein Eingabefeld: Komma statt Punkt, ohne Tausenderpunkte, ohne überflüssige Nullen. */
export function formatDecimalInput(value: number | null | undefined, maxFractionDigits = 2): string {
  if (value == null || !Number.isFinite(value)) return "";
  const factor = 10 ** maxFractionDigits;
  return String(Math.round(value * factor) / factor).replace(".", ",");
}
