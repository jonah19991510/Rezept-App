"use client";

import { useState, useTransition } from "react";
import { ChevronRight, Plus, Target } from "lucide-react";
import { toast } from "sonner";
import { setDrinkGoalAction } from "@/app/(app)/sport/getraenke/actions";
import { chipClass } from "@/components/recipes/chip-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import { drinkFacts, formatLiters, type Drink } from "@/lib/domain/drinks";
import { formatNumber } from "@/lib/format";
import { DrinkDot } from "./drink-parts";
import { DrinkSheet } from "./drink-sheet";

const GOAL_PRESETS = [1500, 2000, 2500, 3000, 3500];

/** Tab „Getränke“: Tagesziel mit „Ändern“, Getränkeliste (antippen bearbeitet) und „+ Getränk hinzufügen“. */
export function DrinkManager({ goalMl, drinks }: { goalMl: number; drinks: Drink[] }) {
  const [editing, setEditing] = useState<Drink | "neu" | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [pending, startTransition] = useTransition();
  const goalValue = parseDecimal(goalInput);
  const goalMlInput = goalValue != null ? Math.round(goalValue * 1000) : null;

  function saveGoal(event: React.FormEvent) {
    event.preventDefault();
    if (goalMlInput == null) return;
    startTransition(async () => {
      const result = await setDrinkGoalAction(goalMlInput);
      if (!result.ok) {
        toast.error(result.message ?? "Das Ziel konnte nicht gespeichert werden.");
        return;
      }
      toast.success(`Tagesziel: ${formatLiters(goalMlInput, 1)}`);
      setGoalOpen(false);
    });
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-4 rounded-3xl border bg-card p-4" aria-label="Tagesziel">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sport-soft text-sport" aria-hidden>
          <Target className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-muted-foreground">Tagesziel</span>
          <span className="block font-heading text-2xl font-semibold tabular-nums">{formatLiters(goalMl, 1)}</span>
        </span>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full px-4"
          onClick={() => {
            setGoalInput(formatDecimalInput(goalMl / 1000, 2));
            setGoalOpen(true);
          }}
        >
          Ändern
        </Button>
      </section>

      <section aria-labelledby="getraenkeliste" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="getraenkeliste" className="text-lg font-semibold">
            Deine Getränke
          </h2>
          <span className="text-sm text-muted-foreground">Werte pro 100 ml</span>
        </div>
        {drinks.length > 0 ? (
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
            {drinks.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => setEditing(d)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/40">
                  <DrinkDot color={d.color} className="size-4" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{d.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {drinkFacts(d)}
                      {d.ingredients ? ` · ${formatNumber(d.waterPercent, 1)} % Wasser` : d.waterPercent >= 100 ? " · Wasser" : ""}
                    </span>
                    {d.ingredients ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        Mischgetränk: {d.ingredients.map((i) => `${i.ml} ml ${i.name}`).join(" + ")}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-3xl border border-dashed p-5 text-center text-sm text-muted-foreground">Noch keine Getränke. Leg dein erstes an.</p>
        )}
        <Button type="button" variant="outline" className="h-12 w-full rounded-full" onClick={() => setEditing("neu")}>
          <Plus aria-hidden />
          Getränk hinzufügen
        </Button>
        <p className="text-xs text-muted-foreground">
          Koffein und Zucker sind Richtwerte pro 100 ml; ändere sie, wenn deine Marke anders ist. Änderungen gelten für neue Einträge, frühere behalten ihre Werte.
        </p>
      </section>

      {editing ? <DrinkSheet key={editing === "neu" ? "neu" : editing.id} drink={editing === "neu" ? null : editing} drinks={drinks} onClose={() => setEditing(null)} /> : null}

      <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
        <DialogContent>
          <form onSubmit={saveGoal} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Tagesziel</DialogTitle>
              <DialogDescription>Wie viel möchtest du am Tag trinken? Das Ziel gilt für die Anzeige aller Tage.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Input
                inputMode="decimal"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                aria-label="Tagesziel in Litern"
                className="h-12 text-base tabular-nums"
                aria-invalid={goalMlInput == null || goalMlInput < 250 || goalMlInput > 10000}
              />
              <span className="text-muted-foreground">Liter</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {GOAL_PRESETS.map((ml) => (
                <button key={ml} type="button" aria-pressed={goalMlInput === ml} onClick={() => setGoalInput(formatDecimalInput(ml / 1000, 2))} className={chipClass(goalMlInput === ml)}>
                  {formatLiters(ml, 1)}
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGoalOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={pending || goalMlInput == null || goalMlInput < 250 || goalMlInput > 10000}>
                Speichern
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
