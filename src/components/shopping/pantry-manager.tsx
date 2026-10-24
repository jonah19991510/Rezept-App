"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, ChevronDown, GlassWater, ListPlus, Pencil, Plus, Refrigerator, Search, SearchX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePantryItemAction, savePantryItemAction, setOnShoppingListAction } from "@/app/(app)/einkauf/pantry-actions";
import { KitchenBarSwitch } from "@/components/bar/kitchen-bar-switch";
import { EmptyState } from "@/components/layout/empty-state";
import { chipClass } from "@/components/recipes/chip-select";
import { IngredientPicker } from "@/components/recipes/editor/ingredient-picker";
import { fabClass } from "@/components/recipes/new-recipe-fab";
import { ShoppingTabs } from "@/components/shopping/shopping-tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import { ingredientLabel, type IngredientLabel } from "@/lib/domain/ingredient-name";
import {
  expiryLabel,
  pantryChecklist,
  PANTRY_UNITS,
  type PantryCandidate,
  type PantryLocation,
  type PantryUnit,
} from "@/lib/domain/pantry";
import { departmentLabel, departmentOrder, formatShoppingAmount, type FoodGroup } from "@/lib/domain/shopping";
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
type Row = { item: PantryCandidate; entry: PantryRow | null; label: IngredientLabel };

/**
 * Vorratsschrank mit den Bereichen Küche und Bar. Alle Zutaten aus den eigenen Rezepten stehen zum Abhaken bereit:
 * Der Haken markiert sie als vorhanden bzw. nicht vorhanden. Menge und Ablaufdatum sind freiwillig (Stift), fehlende
 * Zutaten kommen mit „Liste“ auf die Einkaufsliste. Grundzutaten (nur Küche) erst auf Wunsch.
 */
export function PantryManager({
  entries,
  candidates,
  labels,
  onList,
  today,
  initialArea = "kitchen",
}: {
  entries: PantryRow[];
  /** eigene Zutaten (aus Rezepten oder selbst angelegt), die man abhaken kann */
  candidates: PantryCandidate[];
  /** Kurzname und Zusatzzeile je Zutat (display_name bzw. automatisch gekürzt) */
  labels: Record<string, IngredientLabel>;
  /** Zutaten, die offen auf der Einkaufsliste stehen */
  onList: string[];
  today: string;
  /** Phase 15: /einkauf/vorrat?bereich=bar öffnet direkt die Bar */
  initialArea?: PantryLocation;
}) {
  const [area, setArea] = useState<PantryLocation>(initialArea);
  const [show, setShow] = useState<Show>("alle");
  const [query, setQuery] = useState("");
  const [showStaples, setShowStaples] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [, startTransition] = useTransition();
  const [current, applyChange] = useOptimistic(entries, (state: PantryRow[], change: Change) =>
    change.type === "add"
      ? [...state.filter((e) => !(e.ingredientId === change.entry.ingredientId && e.location === change.entry.location)), change.entry]
      : state.filter((e) => !(e.ingredientId === change.ingredientId && e.location === change.location)),
  );
  const [listed, setListed] = useOptimistic(onList, (state: string[], change: { id: string; on: boolean }) =>
    change.on ? [...state, change.id] : state.filter((id) => id !== change.id),
  );

  const labelOf = (item: PantryCandidate) => labels[item.ingredientId] ?? ingredientLabel({ name: item.name });
  // Den Grundzutaten-Schalter gibt es nur in der Küche; die Bar zeigt alles
  const checklist = (a: PantryLocation): Row[] =>
    pantryChecklist(candidates, current, a, { includeStaples: a === "bar" || showStaples })
      .map((r) => ({ ...r, label: labelOf(r.item) }))
      .sort((x, y) => x.label.short.localeCompare(y.label.short, "de"));
  const rows = checklist(area);
  const other = checklist(area === "bar" ? "kitchen" : "bar");
  const stand = (list: Row[]) => `${list.filter((r) => r.entry).length} / ${list.length}`;
  const counts = area === "bar" ? { kitchen: stand(other), bar: stand(rows) } : { kitchen: stand(rows), bar: stand(other) };

  const words = query.trim().toLocaleLowerCase("de").split(/\s+/).filter(Boolean);
  const searched = rows.filter((r) => {
    const text = `${r.label.short} ${r.item.name}`.toLocaleLowerCase("de");
    return words.every((w) => text.includes(w));
  });
  const matches = (r: Row, s: Show) => s === "alle" || (s === "da") === (r.entry != null);

  // Gruppen nach Supermarkt-Abteilung. Stand „vorhanden / gesamt“ über die Suchtreffer; ohne Treffer ausgeblendet.
  const groups = new Map<string, { order: number; all: Row[]; shown: Row[] }>();
  for (const r of searched) {
    const label = departmentLabel(r.item.foodGroup);
    const g = groups.get(label) ?? { order: departmentOrder(r.item.foodGroup), all: [], shown: [] };
    g.all.push(r);
    if (matches(r, show)) g.shown.push(r);
    groups.set(label, g);
  }
  const sections = [...groups.entries()].filter(([, g]) => g.shown.length > 0).sort((a, b) => a[1].order - b[1].order);
  const hasStaples = candidates.some((c) => c.isStaple) || current.some((e) => e.isStaple && e.location === "kitchen");

  function selectArea(next: PantryLocation) {
    setArea(next);
    // Neu laden landet im gewählten Bereich
    window.history.replaceState(null, "", next === "bar" ? "?bereich=bar" : window.location.pathname);
  }

  function toggleGroup(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(label)) next.add(label);
      return next;
    });
  }

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
        toast(`${labelOf(entry).short}: nicht mehr vorhanden`, { action: { label: "Rückgängig", onClick: () => markPresent(entry, entry) } });
    });
  }

  function toggle(row: Row) {
    if (!row.entry) markPresent(row.item);
    else if (!row.entry.id.startsWith("neu-")) markMissing(row.entry); // gerade erst angelegt: erst speichern lassen
  }

  function toggleList(row: Row) {
    const id = row.item.ingredientId;
    const on = !listed.includes(id);
    startTransition(async () => {
      setListed({ id, on });
      const result = await setOnShoppingListAction({ ingredientId: id, onList: on });
      if (!result.ok) toast.error(result.message);
    });
  }

  return (
    // Unten Platz lassen, damit der schwebende Knopf die letzte Zeile nicht verdeckt
    <div className="pb-16 md:pb-20">
      <ShoppingTabs active="vorrat" bar={area === "bar"} />
      <KitchenBarSwitch active={area} onSelect={selectArea} counts={counts} />

      {rows.length === 0 && !(area === "kitchen" && hasStaples) ? (
        <EmptyState icon={area === "bar" ? GlassWater : Refrigerator} title={area === "bar" ? "Die Bar ist leer" : "Der Vorrat ist leer"}>
          {area === "bar"
            ? "Sobald du Cocktails anlegst, stehen ihre Spirituosen, Liköre und Sirupe hier zum Abhaken. Andere Flaschen trägst du mit dem Plus-Knopf ein."
            : "Sobald du Rezepte anlegst, stehen ihre Zutaten hier zum Abhaken. Alles andere trägst du mit dem Plus-Knopf ein."}
        </EmptyState>
      ) : (
        <div className="space-y-5">
          <div className="space-y-3">
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
            <div className="flex flex-wrap gap-2" role="group" aria-label="Anzeigen">
              {(Object.entries(SHOW) as [Show, string][]).map(([key, label]) => {
                const active = show === key;
                return (
                  <button key={key} type="button" aria-pressed={active} onClick={() => setShow(key)} className={cn(chipClass(active), "h-11")}>
                    {label}
                    <span
                      className={cn(
                        "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {searched.filter((r) => matches(r, key)).length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {sections.length === 0 ? (
            <EmptyState icon={SearchX} title="Nichts gefunden">
              {words.length > 0
                ? "Keine Zutat passt zur Suche. Mit dem Plus-Knopf unten rechts legst du eine Zutat an."
                : show === "da"
                  ? "Davon ist nichts als vorhanden markiert."
                  : "Alles da."}
            </EmptyState>
          ) : (
            sections.map(([label, g]) => {
              // Beim Suchen sind alle Gruppen offen
              const open = words.length > 0 || !collapsed.has(label);
              const listId = `vorrat-${area}-${g.order}`;
              return (
                <section key={label} aria-label={label}>
                  <h2>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={listId}
                      onClick={() => toggleGroup(label)}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-1 text-left font-sans text-sm font-semibold tracking-wide text-muted-foreground uppercase transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span className="truncate">{label}</span>
                      <span className="flex shrink-0 items-center gap-1.5 font-medium tabular-nums">
                        {g.all.filter((r) => r.entry).length} / {g.all.length}
                        <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} aria-hidden />
                      </span>
                    </button>
                  </h2>
                  {open ? (
                    <ul id={listId} className="mt-1 divide-y overflow-hidden rounded-2xl border bg-card">
                      {g.shown.map((row) => (
                        <PantryRowItem
                          key={row.item.ingredientId}
                          row={row}
                          today={today}
                          listed={listed.includes(row.item.ingredientId)}
                          onToggle={() => toggle(row)}
                          onEdit={() => row.entry && setDraft(draftFor(row.entry))}
                          onToggleList={() => toggleList(row)}
                        />
                      ))}
                    </ul>
                  ) : null}
                </section>
              );
            })
          )}

          {area === "kitchen" && hasStaples ? (
            <button
              type="button"
              aria-pressed={showStaples}
              onClick={() => setShowStaples((v) => !v)}
              className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-dashed px-4 py-2 text-center text-sm font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Grundzutaten (Salz, Pfeffer, Öl …) {showStaples ? "ausblenden" : "einblenden"}
            </button>
          ) : null}
        </div>
      )}

      <button type="button" aria-label="Zutat hinzufügen" title="Zutat hinzufügen" onClick={() => setPickerOpen(true)} className={fabClass}>
        <Plus className="size-7" aria-hidden />
      </button>

      {pickerOpen ? (
        <IngredientPicker
          open
          onOpenChange={setPickerOpen}
          initialQuery={query.trim() || undefined}
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

/** Eine Zeile: links der Haken (die ganze linke Fläche), rechts Menge mit Stift bzw. „Liste“ bei fehlenden Zutaten. */
function PantryRowItem({
  row,
  today,
  listed,
  onToggle,
  onEdit,
  onToggleList,
}: {
  row: Row;
  today: string;
  listed: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onToggleList: () => void;
}) {
  const e = row.entry;
  const { short, detail } = row.label;
  // Ein nahes Ablaufdatum ersetzt die Zusatzinfo
  const expiry = e ? expiryLabel(e.expiresOn, today) : null;
  const sub = expiry ?? detail;
  return (
    <li className="flex min-h-16 items-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={e != null}
        aria-label={sub ? `${short}, ${sub}` : short}
        onClick={onToggle}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pr-2 pl-4 text-left transition hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
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
          <span className={cn("block truncate", !e && "text-muted-foreground")}>{short}</span>
          {sub ? (
            <span
              className={cn(
                "block truncate text-xs",
                expiry === "Abgelaufen" ? "text-destructive" : expiry ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              {sub}
            </span>
          ) : null}
        </span>
      </button>
      <div className="flex shrink-0 items-center pr-2">
        {e ? (
          <button
            type="button"
            onClick={onEdit}
            disabled={e.id.startsWith("neu-")}
            aria-label={`${short}: Menge und Ablaufdatum bearbeiten`}
            className="flex min-h-11 min-w-11 items-center justify-end gap-2 rounded-full px-2.5 text-sm text-muted-foreground tabular-nums transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
          >
            {e.amount != null ? <span className="text-foreground/80">{formatShoppingAmount(e.amount, e.unit)}</span> : null}
            <Pencil className="size-4" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleList}
            aria-label={listed ? `${short} von der Einkaufsliste nehmen` : `${short} auf die Einkaufsliste setzen`}
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&_svg]:size-4",
              listed ? "border-primary/60 bg-primary/15 text-primary" : "bg-card text-foreground hover:bg-muted",
            )}
          >
            {listed ? <Check aria-hidden strokeWidth={2.5} /> : <ListPlus aria-hidden />}
            {listed ? "Auf Liste" : "Liste"}
          </button>
        )}
      </div>
    </li>
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
