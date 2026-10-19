import Link from "next/link";
import { goalProgress, type DayMacros, type Goals } from "@/lib/domain/plan";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const ROWS = [
  { key: "kcal", label: "kcal", unit: "", bar: "bg-macro-kcal" },
  { key: "protein", label: "Protein", unit: " g", bar: "bg-macro-protein" },
  { key: "carbs", label: "Kohlenhydrate", unit: " g", bar: "bg-macro-carbs" },
  { key: "fat", label: "Fett", unit: " g", bar: "bg-macro-fat" },
] as const;

/** Soll gegen Ist mit Fortschrittsbalken. Ohne Ziele nur die Summen plus Link zu den Einstellungen. */
export function GoalProgress({ actual, goals, compact = false }: { actual: DayMacros; goals: Goals; compact?: boolean }) {
  const hasGoals = ROWS.some((r) => goals[r.key] != null && (goals[r.key] ?? 0) > 0);

  return (
    <div className="grid gap-2.5">
      {ROWS.map((row) => {
        const value = actual[row.key];
        const goal = goals[row.key];
        const p = goalProgress(value, goal, row.key);
        const shown = row.key === "kcal" ? Math.round(value) : value;
        return (
          <div key={row.key} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className={cn(compact && "text-xs")}>{row.label}</span>
              <span className={cn("tabular-nums", compact ? "text-xs" : "text-sm")}>
                <span className="font-semibold">{formatNumber(shown, 0)}</span>
                {goal ? <span className="text-muted-foreground"> / {formatNumber(goal, 0)}{row.unit}</span> : row.unit}
              </span>
            </div>
            {p.state !== "none" ? (
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`${row.label}: ${Math.round(p.ratio * 100)} % vom Ziel`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.round(p.ratio * 100))}
              >
                <div
                  className={cn("h-full rounded-full transition-[width]", p.state === "over" ? "bg-destructive" : row.bar)}
                  style={{ width: `${Math.min(100, p.ratio * 100)}%` }}
                />
              </div>
            ) : null}
            {!compact && p.remaining != null && p.state === "under" ? (
              <p className="text-xs text-muted-foreground">
                noch {formatNumber(Math.round(p.remaining), 0)}
                {row.unit || " kcal"}
              </p>
            ) : null}
            {!compact && p.state === "over" && p.remaining != null ? (
              <p className="text-xs text-destructive">
                {formatNumber(Math.round(-p.remaining), 0)}
                {row.unit || " kcal"} über dem Ziel
              </p>
            ) : null}
          </div>
        );
      })}
      {!hasGoals && !compact ? (
        <p className="text-xs text-muted-foreground">
          <Link href="/einstellungen#ziele" className="font-medium text-primary underline-offset-4 hover:underline">
            Tagesziele festlegen
          </Link>
          , um Soll und Ist zu vergleichen.
        </p>
      ) : null}
    </div>
  );
}
