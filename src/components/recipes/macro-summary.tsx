import { formatNumber } from "@/lib/format";
import { MacroDot } from "./macro-dot";
import { cn } from "@/lib/utils";

export type MacroValues = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
};

const MACROS = [
  { key: "protein", label: "Protein", color: "bg-macro-protein", kcalPerGram: 4 },
  { key: "carbs", label: "Kohlenhydrate", color: "bg-macro-carbs", kcalPerGram: 4 },
  { key: "fat", label: "Fett", color: "bg-macro-fat", kcalPerGram: 9 },
] as const;

/** Makros als Kacheln plus Balken mit der kcal-Verteilung. Farben sind in der ganzen App gleich. */
export function MacroSummary({
  values,
  total,
  caption = "pro Portion",
  totalLabel = "gesamt",
  compact = false,
  className,
}: {
  values: MacroValues;
  total?: MacroValues;
  caption?: string;
  /** Beschriftung der Gesamtwerte, z. B. „für 6 Portionen“ */
  totalLabel?: string;
  compact?: boolean;
  className?: string;
}) {
  const energyFromMacros = MACROS.reduce((sum, m) => sum + values[m.key] * m.kcalPerGram, 0);

  return (
    <div className={cn("space-y-3", className)}>
      <div className={cn("grid grid-cols-4 gap-2", compact && "gap-1.5")}>
        <Tile label="kcal" macro="kcal" value={formatNumber(Math.round(values.kcal), 0)} compact={compact} />
        {MACROS.map((m) => (
          <Tile
            key={m.key}
            label={compact ? m.label.replace("Kohlenhydrate", "KH") : m.label}
            value={`${formatNumber(values[m.key], values[m.key] < 10 ? 1 : 0)} g`}
            macro={m.key}
            compact={compact}
          />
        ))}
      </div>

      {energyFromMacros > 0 ? (
        <div
          className="flex h-2 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`Energieverteilung: ${MACROS.map(
            (m) => `${m.label} ${Math.round(((values[m.key] * m.kcalPerGram) / energyFromMacros) * 100)} %`,
          ).join(", ")}`}
        >
          {MACROS.map((m) => (
            <div key={m.key} className={m.color} style={{ width: `${((values[m.key] * m.kcalPerGram) / energyFromMacros) * 100}%` }} />
          ))}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {caption}
        {values.fiber != null ? ` · Ballaststoffe ${formatNumber(values.fiber)} g` : ""}
        {total ? ` · ${totalLabel} ${formatNumber(Math.round(total.kcal), 0)} kcal, ${formatNumber(total.protein, 0)} g Protein` : ""}
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  macro,
  compact,
}: {
  label: string;
  value: string;
  macro: "kcal" | "protein" | "carbs" | "fat";
  compact: boolean;
}) {
  return (
    <div className={cn("rounded-2xl bg-muted/60 px-2 text-center", compact ? "py-1.5" : "py-3")}>
      <div className={cn("font-heading font-semibold", compact ? "text-base" : "text-xl")}>{value}</div>
      <div className="flex items-center justify-center gap-1 text-[0.7rem] text-muted-foreground">
        <MacroDot macro={macro} />
        <span className="truncate">{label}</span>
      </div>
    </div>
  );
}
