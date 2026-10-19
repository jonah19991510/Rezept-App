"use client";

import { useState, useTransition } from "react";
import { CalendarClock, GlassWater, Plus, Refrigerator, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePantryItemAction, savePantryItemAction } from "@/app/(app)/einkauf/pantry-actions";
import { EmptyState } from "@/components/layout/empty-state";
import { IngredientPicker } from "@/components/recipes/editor/ingredient-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import { expiryStatus, PANTRY_UNITS, type PantryLocation, type PantryUnit } from "@/lib/domain/pantry";
import { departmentLabel, departmentOrder, formatShoppingAmount, type FoodGroup } from "@/lib/domain/shopping";
import { dayMonth } from "@/lib/domain/week";
import type { PantryRow } from "@/lib/server/pantry";
import { cn } from "@/lib/utils";
import { pantryItemSchema } from "@/lib/validation/pantry";

type Draft = {
  id?: string;
  ingredientId: string;
  name: string;
  location: PantryLocation;
  amount: string;
  unit: PantryUnit | "";
  expiresOn: string;
};

const AREAS: { value: PantryLocation; label: string; icon: typeof Refrigerator }[] = [
  { value: "kitchen", label: "Küche", icon: Refrigerator },
  { value: "bar", label: "Bar", icon: GlassWater },
];

function defaultUnit(group: FoodGroup): PantryUnit {
  if (group === "egg" || group === "fruit") return "Stück";
  if (group === "spirits" || group === "liqueurs_wine" || group === "syrups_juices") return "ml";
  return "g";
}

/** Vorratsschrank mit den Bereichen Küche und Bar. Menge und Ablaufdatum sind freiwillig. */
export function PantryManager({ entries, today }: { entries: PantryRow[]; today: string }) {
  const [area, setArea] = useState<PantryLocation>("kitchen");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const inArea = entries.filter((e) => e.location === area);
  const groups = new Map<string, { order: number; items: PantryRow[] }>();
  for (const e of inArea) {
    const label = departmentLabel(e.foodGroup);
    const g = groups.get(label) ?? { order: departmentOrder(e.foodGroup), items: [] };
    g.items.push(e);
    groups.set(label, g);
  }
  const expiring = entries.filter((e) => {
    const s = expiryStatus(e.expiresOn, today);
    return s === "soon" || s === "expired";
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="group" aria-label="Bereich">
          {AREAS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={area === value}
              onClick={() => setArea(value)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground",
                area === value && "bg-card text-foreground shadow-sm",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label} ({entries.filter((e) => e.location === value).length})
            </button>
          ))}
        </div>
        <Button type="button" onClick={() => setPickerOpen(true)}>
          <Plus aria-hidden />
          Zutat hinzufügen
        </Button>
      </div>

      {expiring.length > 0 ? (
        <p className="flex gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            Bald verbrauchen: {expiring.map((e) => e.name).join(", ")}. „Was kochen?“ schlägt Rezepte damit zuerst vor.
          </span>
        </p>
      ) : null}

      {inArea.length === 0 ? (
        <EmptyState icon={area === "bar" ? GlassWater : Refrigerator} title={area === "bar" ? "Die Bar ist leer" : "Der Vorrat ist leer"}>
          {area === "bar"
            ? "Trag Spirituosen, Liköre, Sirupe und Säfte ein, die du zu Hause hast."
            : "Trag ein, was du zu Hause hast. Eine Menge brauchst du nicht, „vorhanden“ reicht. Abgehakte Einkäufe kannst du auch direkt aus der Einkaufsliste übernehmen."}
        </EmptyState>
      ) : (
        [...groups.entries()]
          .sort((a, b) => a[1].order - b[1].order)
          .map(([label, g]) => (
            <section key={label} aria-label={label}>
              <h2 className="mb-2 font-sans text-sm font-semibold tracking-wide text-muted-foreground uppercase">{label}</h2>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {g.items.map((e) => {
                  const status = expiryStatus(e.expiresOn, today);
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            id: e.id,
                            ingredientId: e.ingredientId,
                            name: e.name,
                            location: e.location,
                            amount: formatDecimalInput(e.amount),
                            unit: e.unit ?? defaultUnit(e.foodGroup),
                            expiresOn: e.expiresOn ?? "",
                          })
                        }
                        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-muted/50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{e.name}</span>
                          {e.expiresOn ? (
                            <span
                              className={cn(
                                "text-xs",
                                status === "expired" ? "text-destructive" : status === "soon" ? "font-medium text-primary" : "text-muted-foreground",
                              )}
                            >
                              {status === "expired" ? "abgelaufen am " : status === "soon" ? "läuft bald ab: " : "haltbar bis "}
                              {dayMonth(e.expiresOn)}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                          {e.amount != null ? formatShoppingAmount(e.amount, e.unit) : "vorhanden"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
      )}

      {pickerOpen ? (
        <IngredientPicker
          open
          onOpenChange={setPickerOpen}
          onSelect={(ingredient) => {
            const existing = entries.find((e) => e.ingredientId === ingredient.id && e.location === area);
            setDraft(
              existing
                ? {
                    id: existing.id,
                    ingredientId: existing.ingredientId,
                    name: existing.name,
                    location: existing.location,
                    amount: formatDecimalInput(existing.amount),
                    unit: existing.unit ?? defaultUnit(existing.foodGroup),
                    expiresOn: existing.expiresOn ?? "",
                  }
                : {
                    ingredientId: ingredient.id,
                    name: ingredient.name,
                    location: area,
                    amount: "",
                    unit: defaultUnit(ingredient.food_group),
                    expiresOn: "",
                  },
            );
          }}
        />
      ) : null}

      <PantryItemDialog draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

function PantryItemDialog({ draft, onClose }: { draft: Draft | null; onClose: () => void }) {
  return (
    <Dialog open={draft != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {draft ? <PantryItemForm key={draft.id ?? draft.ingredientId} initial={draft} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PantryItemForm({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function save() {
    const parsed = pantryItemSchema.safeParse({
      id: d.id,
      ingredientId: d.ingredientId,
      location: d.location,
      amount: d.amount.trim() ? (parseDecimal(d.amount) ?? Number.NaN) : null,
      unit: d.unit || null,
      expiresOn: d.expiresOn || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    startTransition(async () => {
      const result = await savePantryItemAction(parsed.data);
      if (result.ok) {
        toast.success(`${d.name} im Vorrat gespeichert.`);
        onDone();
      } else setError(result.message);
    });
  }

  function remove() {
    if (!d.id) return;
    startTransition(async () => {
      const result = await deletePantryItemAction(d.id!);
      if (result.ok) {
        toast.success(`${d.name} aus dem Vorrat entfernt.`);
        onDone();
      } else setError(result.message);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="pr-8">{d.name}</DialogTitle>
        <DialogDescription>Menge und Ablaufdatum sind freiwillig. Ohne Menge gilt die Zutat als vorhanden.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="pantry-amount">Menge</Label>
            <Input
              id="pantry-amount"
              inputMode="decimal"
              placeholder="vorhanden"
              value={d.amount}
              onChange={(e) => setD({ ...d, amount: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pantry-unit">Einheit</Label>
            <NativeSelect id="pantry-unit" value={d.unit} onChange={(e) => setD({ ...d, unit: e.target.value as PantryUnit })}>
              {PANTRY_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="pantry-expires">Haltbar bis</Label>
            <Input id="pantry-expires" type="date" value={d.expiresOn} onChange={(e) => setD({ ...d, expiresOn: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pantry-location">Bereich</Label>
            <NativeSelect
              id="pantry-location"
              value={d.location}
              onChange={(e) => setD({ ...d, location: e.target.value as PantryLocation })}
              disabled={Boolean(d.id)}
            >
              <option value="kitchen">Küche</option>
              <option value="bar">Bar</option>
            </NativeSelect>
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      <DialogFooter className="sm:justify-between">
        {d.id ? (
          <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
            <Trash2 aria-hidden />
            Entfernen
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Wird gespeichert …" : "Speichern"}
        </Button>
      </DialogFooter>
    </>
  );
}
