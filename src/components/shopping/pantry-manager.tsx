"use client";

import { useOptimistic, useState, useTransition } from "react";
import { CalendarClock, Check, GlassWater, Pencil, Plus, Refrigerator, Search, SearchX, Trash2 } from "lucide-react";
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
import {
  expiryStatus,
  pantryChecklist,
  PANTRY_UNITS,
  type PantryCandidate,
  type PantryLocation,
  type PantryUnit,
} from "@/lib/domain/pantry";
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

const SHOW = { alle: "Alle", da: "Vorhanden", fehlt: "Fehlt" } as const;
type Show = keyof typeof SHOW;

function defaultUnit(group: FoodGroup): PantryUnit {
  if (group === "egg" || group === "fruit") return "Stück";
  if (group === "spirits" || group === "liqueurs_wine" || group === "syrups_juices") return "ml";
  return "g";
}

function draftFor(e: PantryRow): Draft {
  return {
    id: e.id,
    ingredientId: e.ingredientId,
    name: e.name,
    location: e.location,
    amount: formatDecimalInput(e.amount),
    unit: e.unit ?? defaultUnit(e.foodGroup),
    expiresOn: e.expiresOn ?? "",
  };
}

type Change = { type: "add"; entry: PantryRow } | { type: "remove"; ingredientId: string; location: PantryLocation };

/**
 * Vorratsschrank mit den Bereichen Küche und Bar. Alle Zutaten aus den eigenen Rezepten stehen zum Abhaken bereit:
 * Antippen markiert sie als vorhanden bzw. nicht vorhanden. Menge und Ablaufdatum sind freiwillig (Stift).
 */
export function PantryManager({
  entries,
  candidates,
  today,
  initialArea = "kitchen",
}: {
  entries: PantryRow[];
  /** eigene Zutaten (aus Rezepten oder selbst angelegt), die man abhaken kann */
  candidates: PantryCandidate[];
  today: string;
  /** Phase 15: /einkauf/vorrat?bereich=bar öffnet direkt die Bar */
  initialArea?: PantryLocation;
}) {
  const [area, setArea] = useState<PantryLocation>(initialArea);
  const [show, setShow] = useState<Show>("alle");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [, startTransition] = useTransition();
  const [current, applyChange] = useOptimistic(entries, (state: PantryRow[], change: Change) =>
    change.type === "add"
      ? [...state.filter((e) => !(e.ingredientId === change.entry.ingredientId && e.location === change.entry.location)), change.entry]
      : state.filter((e) => !(e.ingredientId === change.ingredientId && e.location === change.location)),
  );

  const rows = pantryChecklist(candidates, current, area);
  const words = query.trim().toLocaleLowerCase("de").split(/\s+/).filter(Boolean);
  const visible = rows.filter(
    (r) =>
      (show === "alle" || (show === "da") === (r.entry != null)) &&
      words.every((w) => r.item.name.toLocaleLowerCase("de").includes(w)),
  );
  const groups = new Map<string, { order: number; rows: typeof rows }>();
  for (const r of visible) {
    const label = departmentLabel(r.item.foodGroup);
    const g = groups.get(label) ?? { order: departmentOrder(r.item.foodGroup), rows: [] };
    g.rows.push(r);
    groups.set(label, g);
  }
  const presentCount = rows.filter((r) => r.entry).length;
  const expiring = current.filter((e) => {
    const s = expiryStatus(e.expiresOn, today);
    return s === "soon" || s === "expired";
  });

  function markPresent(item: PantryCandidate, restore?: PantryRow) {
    const entry: PantryRow = restore ?? {
      id: `neu-${item.ingredientId}`,
      ingredientId: item.ingredientId,
      name: item.name,
      foodGroup: item.foodGroup,
      isStaple: item.isStaple,
      location: area,
      amount: null,
      unit: null,
      expiresOn: null,
    };
    startTransition(async () => {
      applyChange({ type: "add", entry });
      const result = await savePantryItemAction({
        ingredientId: entry.ingredientId,
        location: entry.location,
        amount: entry.amount,
        unit: entry.amount == null ? null : entry.unit,
        expiresOn: entry.expiresOn,
      });
      if (!result.ok) toast.error(result.message);
    });
  }

  function markMissing(entry: PantryRow) {
    startTransition(async () => {
      applyChange({ type: "remove", ingredientId: entry.ingredientId, location: entry.location });
      const result = await deletePantryItemAction(entry.id);
      if (!result.ok) toast.error(result.message);
      // Menge und Ablaufdatum gehen beim Abhaken verloren, deshalb zurückholbar
      else if (entry.amount != null || entry.expiresOn)
        toast(`${entry.name}: nicht mehr vorhanden`, { action: { label: "Rückgängig", onClick: () => markPresent(entry, entry) } });
    });
  }

  function toggle(row: (typeof rows)[number]) {
    if (!row.entry) markPresent(row.item);
    else if (!row.entry.id.startsWith("neu-")) markMissing(row.entry); // gerade erst angelegt: erst speichern lassen
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-full border bg-card p-1" role="group" aria-label="Bereich">
          {AREAS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={area === value}
              onClick={() => setArea(value)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground",
                area === value && "bg-primary text-primary-foreground hover:text-primary-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label} ({current.filter((e) => e.location === value).length})
            </button>
          ))}
        </div>
        <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
          <Plus aria-hidden />
          Andere Zutat
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

      {rows.length === 0 ? (
        <EmptyState icon={area === "bar" ? GlassWater : Refrigerator} title={area === "bar" ? "Die Bar ist leer" : "Der Vorrat ist leer"}>
          {area === "bar"
            ? "Sobald du Cocktails anlegst, stehen ihre Spirituosen, Liköre und Sirupe hier zum Abhaken. Andere Flaschen trägst du über „Andere Zutat“ ein."
            : "Sobald du Rezepte anlegst, stehen ihre Zutaten hier zum Abhaken. Alles andere trägst du über „Andere Zutat“ ein."}
        </EmptyState>
      ) : (
        <>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tipp eine Zutat an, um sie als vorhanden oder nicht vorhanden zu markieren. {presentCount} von {rows.length} vorhanden.
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zutat suchen …"
                aria-label="Zutat im Vorrat suchen"
                className="h-12 rounded-full pl-10"
              />
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-full border bg-card p-1" role="group" aria-label="Anzeigen">
              {(Object.entries(SHOW) as [Show, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={show === key}
                  onClick={() => setShow(key)}
                  className={cn(
                    "min-h-10 truncate rounded-full px-2 text-sm font-medium text-muted-foreground transition hover:text-foreground",
                    show === key && "bg-primary/15 text-primary hover:text-primary",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState icon={SearchX} title="Nichts gefunden">
              {show === "da" ? "Davon ist nichts als vorhanden markiert." : show === "fehlt" ? "Alles da." : "Keine Zutat passt zur Suche."}
            </EmptyState>
          ) : (
            [...groups.entries()]
              .sort((a, b) => a[1].order - b[1].order)
              .map(([label, g]) => (
                <section key={label} aria-label={label}>
                  <h2 className="mb-2 font-sans text-sm font-semibold tracking-wide text-muted-foreground uppercase">{label}</h2>
                  <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                    {g.rows.map((row) => {
                      const e = row.entry;
                      const status = e ? expiryStatus(e.expiresOn, today) : null;
                      return (
                        <li key={row.item.ingredientId} className="flex items-stretch">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={e != null}
                            onClick={() => toggle(row)}
                            className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left hover:bg-muted/50"
                          >
                            <span
                              className={cn(
                                "grid size-7 shrink-0 place-items-center rounded-full border-2 transition",
                                e ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                              )}
                              aria-hidden
                            >
                              {e ? <Check className="size-4" strokeWidth={3} /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn("block truncate font-medium", !e && "text-muted-foreground")}>{row.item.name}</span>
                              {e?.expiresOn ? (
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
                              {e ? (e.amount != null ? formatShoppingAmount(e.amount, e.unit) : "vorhanden") : "fehlt"}
                            </span>
                          </button>
                          {e && !e.id.startsWith("neu-") ? (
                            <button
                              type="button"
                              onClick={() => setDraft(draftFor(e))}
                              aria-label={`${e.name}: Menge und Ablaufdatum`}
                              className="grid w-12 shrink-0 place-items-center border-l text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            >
                              <Pencil className="size-4" aria-hidden />
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
          )}
        </>
      )}

      {pickerOpen ? (
        <IngredientPicker
          open
          onOpenChange={setPickerOpen}
          onSelect={(ingredient) => {
            const existing = current.find((e) => e.ingredientId === ingredient.id && e.location === area);
            setDraft(
              existing
                ? draftFor(existing)
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
