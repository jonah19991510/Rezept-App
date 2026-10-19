import { formatNumber } from "@/lib/format";
import { UNIT_LABELS } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";

const FRACTIONS: [number, string][] = [
  [0.25, "¼"],
  [0.5, "½"],
  [0.75, "¾"],
  [1 / 3, "⅓"],
  [2 / 3, "⅔"],
];

/** „2 EL“, „½ Stück“, „1,5 kg“-artige Mengenangabe. Ohne Menge: leer („nach Geschmack“). */
export function formatQuantity(amount: number | null, unit: Enums<"unit"> | null): string {
  if (amount == null) return "";
  let number = formatNumber(amount, 2);

  // Brüche lesen sich bei Stück und Löffeln besser
  if (unit && unit !== "g" && unit !== "ml") {
    const whole = Math.floor(amount);
    const rest = amount - whole;
    const fraction = FRACTIONS.find(([value]) => Math.abs(value - rest) < 0.01);
    if (fraction) number = whole > 0 ? `${whole} ${fraction[1]}` : fraction[1];
  }
  return unit ? `${number} ${UNIT_LABELS[unit]}` : number;
}

/** Minuten als „45 Min.“ bzw. „1 Std. 15 Min.“ */
export function formatMinutes(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min.`;
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
}
