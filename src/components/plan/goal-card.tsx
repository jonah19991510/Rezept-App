import Link from "next/link";
import type { ReactNode } from "react";
import { MacroDot } from "@/components/recipes/macro-dot";
import type { DayMacros, Goals } from "@/lib/domain/plan";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const MACROS = [
  { key: "protein", label: "Protein", full: "Protein", bar: "bg-macro-protein" },
  { key: "carbs", label: "Kohlenh.", full: "Kohlenhydrate", bar: "bg-macro-carbs" },
  { key: "fat", label: "Fett", full: "Fett", bar: "bg-macro-fat" },
] as const;

const fmt = (n: number) => formatNumber(Math.round(n), 0);

/** Fortschrittsbalken (Anteil am Ziel, höchstens voll). */
function Bar({ ratio, color, label, thin = false }: { ratio: number; color: string; label: string; thin?: boolean }) {
  const percent = Math.round(ratio * 100);
  return (
    <div
      className={cn("overflow-hidden rounded-full bg-muted", thin ? "h-1" : "h-2")}
      role="progressbar"
      aria-label={`${label}: ${percent} % vom Ziel`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(100, percent)}
    >
      <div className={cn("h-full rounded-full transition-[width]", color)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </div>
  );
}

/** „noch 123 g“, „120 kcal drüber“ (Akzent) bzw. beim Protein „Ziel erreicht“. */
function Rest({ actual, goal, unit, protein = false }: { actual: number; goal: number; unit: string; protein?: boolean }) {
  const rest = Math.round(goal - actual);
  if (rest > 0) return <span className="text-muted-foreground">noch {formatNumber(rest, 0)} {unit}</span>;
  if (rest === 0 || protein) return <span className="text-muted-foreground">Ziel erreicht</span>;
  return (
    <span className="text-primary">
      {formatNumber(-rest, 0)} {unit} drüber
    </span>
  );
}

/**
 * Tagesziel kompakt: kcal groß mit Rest bzw. Überschuss und breitem Balken, darunter Protein, Kohlenhydrate und Fett
 * in drei Spalten. Ohne Ziele nur die Summen und ein Link zu den Einstellungen.
 */
export function GoalCard({
  actual,
  goals,
  training,
  children,
}: {
  actual: DayMacros;
  goals: Goals;
  training: boolean;
  /** z. B. Kosten des Tages unten in der Karte */
  children?: ReactNode;
}) {
  const hasGoals = [goals.kcal, goals.protein, goals.carbs, goals.fat].some((g) => g != null && g > 0);
  const kcalGoal = goals.kcal && goals.kcal > 0 ? goals.kcal : null;

  return (
    <section className="rounded-3xl border bg-card p-4" aria-label="Tagesziel">
      <p className="text-sm text-muted-foreground">{hasGoals ? (training ? "Ziel Trainingstag" : "Ziel Ruhetag") : "Heute geplant"}</p>
      <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="tabular-nums">
          <span className="font-heading text-4xl font-semibold">{fmt(actual.kcal)}</span>
          <span className="text-muted-foreground"> {kcalGoal ? `/ ${formatNumber(kcalGoal, 0)} kcal` : "kcal"}</span>
        </p>
        {kcalGoal ? (
          <p className="text-sm tabular-nums">
            <Rest actual={actual.kcal} goal={kcalGoal} unit="kcal" />
          </p>
        ) : null}
      </div>
      {kcalGoal ? (
        <div className="mt-3">
          <Bar ratio={actual.kcal / kcalGoal} color="bg-macro-kcal" label="kcal" />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-3">
        {MACROS.map((m) => {
          const value = actual[m.key];
          const goal = goals[m.key] && (goals[m.key] ?? 0) > 0 ? goals[m.key]! : null;
          return (
            <div key={m.key} className="min-w-0 space-y-1">
              <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <MacroDot macro={m.key} />
                {m.label === m.full ? m.label : <abbr title={m.full} className="no-underline">{m.label}</abbr>}
              </p>
              <p className="tabular-nums">
                <span className="font-semibold">{fmt(value)}</span>
                <span className="text-muted-foreground">{goal ? ` / ${formatNumber(goal, 0)} g` : " g"}</span>
              </p>
              {goal ? (
                <>
                  <Bar ratio={value / goal} color={m.bar} label={m.full} thin />
                  <p className="truncate text-xs tabular-nums">
                    <Rest actual={value} goal={goal} unit="g" protein={m.key === "protein"} />
                  </p>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {!hasGoals ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <Link href="/einstellungen#ziele" className="font-medium text-primary underline-offset-4 hover:underline">
            Tagesziele festlegen
          </Link>
          , um Soll und Ist zu vergleichen.
        </p>
      ) : null}
      {children}
    </section>
  );
}
