"use client";

import { useEffect, useState, useTransition } from "react";
import { PackageMinus } from "lucide-react";
import { consumeAfterCookingAction, previewConsumptionAction, type ConsumptionRow } from "@/app/(app)/einkauf/pantry-actions";
import { Button } from "@/components/ui/button";

/** Nach dem Kochen: verbrauchte Zutaten aus dem Vorrat abziehen (Auswahl, Server rechnet die Mengen). */
export function PantryConsumption({ recipeId, servings }: { recipeId: string; servings: number }) {
  const [rows, setRows] = useState<ConsumptionRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    previewConsumptionAction({ recipeId, servings }).then((result) => {
      if (!active) return;
      setRows(result);
      // Vorausgewählt: Einträge mit bekannter Menge; „vorhanden“ ohne Menge nur, wenn der Nutzer es ankreuzt
      setSelected(new Set(result.filter((r) => r.after != null).map((r) => r.pantryId)));
    });
    return () => {
      active = false;
    };
  }, [recipeId, servings]);

  if (rows == null || rows.length === 0) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply() {
    startTransition(async () => {
      const result = await consumeAfterCookingAction({ recipeId, servings, pantryIds: [...selected] });
      setDone(result.ok ? (result.message ?? "Vorrat aktualisiert.") : result.message);
    });
  }

  if (done) return <p className="rounded-2xl bg-sage/15 px-4 py-3 text-center text-sm font-medium">{done}</p>;

  return (
    <section className="space-y-3 rounded-3xl border bg-card p-4 text-left" aria-labelledby="vorrat-abziehen">
      <h2 id="vorrat-abziehen" className="flex items-center gap-2 font-semibold">
        <PackageMinus className="size-5 text-primary" aria-hidden />
        Vorrat aktualisieren?
      </h2>
      <p className="text-sm text-muted-foreground">Diese Zutaten aus deinem Vorrat hast du verwendet:</p>
      <ul className="divide-y rounded-2xl border">
        {rows.map((r) => (
          <li key={r.pantryId}>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
              <input
                type="checkbox"
                checked={selected.has(r.pantryId)}
                onChange={() => toggle(r.pantryId)}
                className="size-5 shrink-0 accent-[var(--primary)]"
              />
              <span className="min-w-0 flex-1">{r.name}</span>
              <span className="shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                {r.after != null ? `${r.before} → ${r.after}` : "aufgebraucht?"}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" className="w-full" onClick={apply} disabled={pending || selected.size === 0}>
        {pending ? "Wird aktualisiert …" : "Vorrat aktualisieren"}
      </Button>
    </section>
  );
}
