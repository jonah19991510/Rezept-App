"use client";

import { useState, useTransition } from "react";
import { GitCompare, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { restoreVersionAction } from "@/app/(app)/rezepte/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { DayMacros } from "@/lib/domain/plan";
import { changeSummary, diffIngredients, diffSteps, type RecipeSnapshot, type SnapshotIngredient } from "@/lib/domain/versions";
import { formatDate, formatNumber } from "@/lib/format";
import { formatQuantity } from "@/lib/format-quantity";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export type VersionView = {
  version: number;
  changeNote: string | null;
  createdAt: string;
  snapshot: RecipeSnapshot;
  /** Makros pro Portion dieser Version */
  macros: DayMacros;
};

function quantity(i: SnapshotIngredient) {
  return formatQuantity(i.amount, i.unit as Enums<"unit"> | null) || "–";
}

/** Versionsverlauf (nur für den Owner): Liste, Vergleich zweier Versionen, alte Version wiederherstellen. */
export function VersionHistory({ recipeId, currentVersion, versions }: { recipeId: string; currentVersion: number; versions: VersionView[] }) {
  const [compare, setCompare] = useState<{ from: number; to: number } | null>(null);
  const [pending, startTransition] = useTransition();
  if (versions.length === 0) return null;
  const byVersion = new Map(versions.map((v) => [v.version, v]));
  const ordered = [...versions].sort((a, b) => b.version - a.version);

  function restore(version: number) {
    if (!window.confirm(`Version ${version} wiederherstellen? Der jetzige Stand bleibt als Version im Verlauf.`)) return;
    startTransition(async () => {
      const result = await restoreVersionAction({ recipeId, version });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <section aria-labelledby="versionen" className="space-y-3 rounded-3xl border bg-card p-4 md:p-5">
      <h2 id="versionen" className="flex items-center gap-2 text-xl font-semibold">
        <History className="size-5 text-primary" aria-hidden />
        Versionen
      </h2>
      <p className="text-sm text-muted-foreground">
        Bei jeder Änderung an Zutaten, Mengen, Schritten oder Portionen entsteht eine neue Version.
      </p>
      <ol className="divide-y rounded-2xl border">
        {ordered.map((v, index) => {
          const previous = ordered[index + 1];
          return (
            <li key={v.version} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-semibold">Version {v.version}</span>
                  {v.version === currentVersion ? <span className="ml-2 text-xs font-medium text-primary">aktuell</span> : null}
                  <span className="ml-2 text-xs text-muted-foreground">{formatDate(v.createdAt)}</span>
                </p>
                {v.changeNote ? <p className="text-sm">{v.changeNote}</p> : null}
                {previous ? <p className="text-xs text-muted-foreground">{changeSummary(previous.snapshot, v.snapshot)}</p> : null}
              </div>
              <div className="flex gap-1">
                {previous ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCompare({ from: previous.version, to: v.version })}>
                    <GitCompare aria-hidden />
                    Vergleichen
                  </Button>
                ) : null}
                {v.version !== currentVersion ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => restore(v.version)} disabled={pending}>
                    <RotateCcw aria-hidden />
                    Wiederherstellen
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <Dialog open={compare != null} onOpenChange={(open) => !open && setCompare(null)}>
        <DialogContent className="top-4 max-h-[calc(100dvh-2rem)] translate-y-0 overflow-y-auto sm:top-[8dvh] sm:max-w-lg">
          {compare ? (
            <Comparison
              versions={ordered}
              from={byVersion.get(compare.from)!}
              to={byVersion.get(compare.to)!}
              onChange={(from, to) => setCompare({ from, to })}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

const MACROS = [
  { key: "kcal", label: "kcal", unit: "" },
  { key: "protein", label: "Protein", unit: " g" },
  { key: "carbs", label: "Kohlenhydrate", unit: " g" },
  { key: "fat", label: "Fett", unit: " g" },
] as const;

function signed(value: number, digits: number) {
  const rounded = Number(value.toFixed(digits));
  return `${rounded > 0 ? "+" : ""}${formatNumber(rounded, digits)}`;
}

function Comparison({
  versions,
  from,
  to,
  onChange,
}: {
  versions: VersionView[];
  from: VersionView;
  to: VersionView;
  onChange: (from: number, to: number) => void;
}) {
  const ingredients = diffIngredients(from.snapshot.ingredients, to.snapshot.ingredients);
  const steps = diffSteps(from.snapshot.steps, to.snapshot.steps).filter((s) => s.kind !== "same");

  return (
    <>
      <DialogHeader>
        <DialogTitle>Versionen vergleichen</DialogTitle>
        <DialogDescription>Was sich von der älteren zur neueren Version geändert hat.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cmp-from">Von</Label>
          <NativeSelect id="cmp-from" value={from.version} onChange={(e) => onChange(Number(e.target.value), to.version)}>
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                Version {v.version}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cmp-to">Zu</Label>
          <NativeSelect id="cmp-to" value={to.version} onChange={(e) => onChange(from.version, Number(e.target.value))}>
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                Version {v.version}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {from.snapshot.servings !== to.snapshot.servings ? (
        <p className="text-sm">
          Portionen: {from.snapshot.servings} → <span className="font-semibold">{to.snapshot.servings}</span>
        </p>
      ) : null}

      <section className="space-y-2" aria-label="Zutaten">
        <h3 className="font-semibold">Zutaten</h3>
        <ul className="divide-y rounded-2xl border text-sm">
          {ingredients.map((c, i) => {
            const item = c.kind === "removed" ? c.before : c.after;
            return (
              <li
                key={`${item.ingredient_id}-${i}`}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2",
                  c.kind === "added" && "bg-sage/15",
                  c.kind === "removed" && "bg-destructive/10 text-muted-foreground line-through",
                  c.kind === "changed" && "bg-primary/10",
                )}
              >
                <span className="min-w-0">
                  {item.name}
                  {item.note ? <span className="text-muted-foreground">, {item.note}</span> : null}
                </span>
                <span className="shrink-0 tabular-nums">
                  {c.kind === "changed" ? (
                    <>
                      <span className="text-muted-foreground">{quantity(c.before)}</span> →{" "}
                      <span className="font-semibold">{quantity(c.after)}</span>
                    </>
                  ) : (
                    <>
                      {c.kind === "added" ? <span className="mr-1 text-xs font-medium text-sage">neu</span> : null}
                      {c.kind === "removed" ? <span className="mr-1 text-xs font-medium no-underline">entfernt</span> : null}
                      {quantity(item)}
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {steps.length > 0 ? (
        <section className="space-y-2" aria-label="Schritte">
          <h3 className="font-semibold">Geänderte Schritte</h3>
          <ul className="space-y-2 text-sm">
            {steps.map((s) => (
              <li key={s.position} className="rounded-2xl border p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Schritt {s.position} {s.kind === "added" ? "(neu)" : s.kind === "removed" ? "(entfernt)" : ""}
                </p>
                {s.before && s.kind !== "added" ? <p className="text-muted-foreground line-through">{s.before}</p> : null}
                {s.after && s.kind !== "removed" ? <p>{s.after}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2" aria-label="Makros pro Portion">
        <h3 className="font-semibold">Pro Portion</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {MACROS.map((m) => {
            const diff = to.macros[m.key] - from.macros[m.key];
            return (
              <div key={m.key} className="rounded-2xl bg-muted/60 p-2.5">
                <dt className="text-xs text-muted-foreground">{m.label}</dt>
                <dd className="tabular-nums">
                  <span className="font-semibold">{formatNumber(to.macros[m.key], m.key === "kcal" ? 0 : 1)}</span>
                  <span className={cn("ml-1 text-xs", Math.abs(diff) < 0.05 ? "text-muted-foreground" : diff > 0 ? "text-primary" : "text-sage")}>
                    {signed(diff, m.key === "kcal" ? 0 : 1)}
                    {m.unit}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="text-xs text-muted-foreground">Mit den heutigen Nährwerten der Zutaten gerechnet.</p>
      </section>
    </>
  );
}
