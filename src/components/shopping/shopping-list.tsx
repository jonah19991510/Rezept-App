"use client";

import { useOptimistic, useRef, useState, useTransition, type FormEvent } from "react";
import { Check, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  addManualItemAction,
  clearItemsAction,
  deleteItemAction,
  setHideStaplesAction,
  setItemCheckedAction,
} from "@/app/(app)/einkauf/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { departmentIndex, formatShoppingAmount, type FoodGroup } from "@/lib/domain/shopping";
import { FOOD_GROUP_LABELS } from "@/lib/labels";
import type { ShoppingItem } from "@/lib/server/shopping";
import { cn } from "@/lib/utils";

type OptimisticAction = { type: "check"; id: string; checked: boolean } | { type: "delete"; id: string };

function departmentLabel(group: FoodGroup | null) {
  if (group == null) return "Eigene Einträge";
  if (group === "fruit" || group === "vegetables") return "Obst & Gemüse";
  return FOOD_GROUP_LABELS[group];
}

/** Liste nach Supermarkt-Abteilung, große Tippflächen, Abhaken reagiert sofort (optimistisch). */
export function ShoppingList({ items, hideStaples }: { items: ShoppingItem[]; hideStaples: boolean }) {
  const [optimisticItems, applyOptimistic] = useOptimistic(items, (state: ShoppingItem[], action: OptimisticAction) =>
    action.type === "delete"
      ? state.filter((i) => i.id !== action.id)
      : state.map((i) => (i.id === action.id ? { ...i, checked: action.checked } : i)),
  );
  const [optimisticHide, setOptimisticHide] = useOptimistic(hideStaples);
  const [, startTransition] = useTransition();
  const [adding, startAdding] = useTransition();
  const [showChecked, setShowChecked] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  function toggle(item: ShoppingItem) {
    startTransition(async () => {
      applyOptimistic({ type: "check", id: item.id, checked: !item.checked });
      const result = await setItemCheckedAction(item.id, !item.checked);
      if (!result.ok) toast.error(result.message);
    });
  }

  function remove(item: ShoppingItem) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id: item.id });
      const result = await deleteItemAction(item.id);
      if (!result.ok) toast.error(result.message);
    });
  }

  function toggleStaples() {
    startTransition(async () => {
      setOptimisticHide(!optimisticHide);
      const result = await setHideStaplesAction(!optimisticHide);
      if (!result.ok) toast.error(result.message);
    });
  }

  function clear(scope: "checked" | "all") {
    if (scope === "all" && !window.confirm("Wirklich die ganze Einkaufsliste löschen?")) return;
    startTransition(async () => {
      const result = await clearItemsAction(scope);
      if (!result.ok) toast.error(result.message);
    });
  }

  function addManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "");
    const amount = String(data.get("amount") ?? "");
    if (!name.trim()) {
      nameRef.current?.focus();
      return;
    }
    startAdding(async () => {
      const result = await addManualItemAction({ name, amount });
      if (result.ok) {
        form.reset();
        nameRef.current?.focus();
      } else toast.error(result.message);
    });
  }

  const open = optimisticItems.filter((i) => !i.checked);
  const checked = optimisticItems.filter((i) => i.checked);
  const hiddenStaples = optimisticHide ? open.filter((i) => i.isStaple) : [];
  const visible = optimisticHide ? open.filter((i) => !i.isStaple) : open;

  // Nach Abteilung gruppieren; Obst und Gemüse liegen im Laden meist zusammen
  const groups = new Map<string, { order: number; items: ShoppingItem[] }>();
  for (const item of visible) {
    const label = departmentLabel(item.foodGroup);
    const order = item.foodGroup === "vegetables" ? departmentIndex("fruit") : departmentIndex(item.foodGroup);
    const entry = groups.get(label) ?? { order, items: [] };
    entry.items.push(item);
    groups.set(label, entry);
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => a[1].order - b[1].order);

  return (
    <div className="space-y-6">
      <form onSubmit={addManual} className="grid grid-cols-[1fr_6.5rem_auto] gap-2" aria-label="Eigenen Eintrag hinzufügen">
        <Input ref={nameRef} name="name" placeholder="Etwas hinzufügen …" aria-label="Was?" maxLength={200} autoComplete="off" />
        <Input name="amount" placeholder="Menge" aria-label="Menge, z. B. 2 Packungen" maxLength={40} autoComplete="off" />
        <Button type="submit" size="icon" disabled={adding} aria-label="Hinzufügen">
          <Plus aria-hidden />
        </Button>
      </form>

      {open.length === 0 && checked.length > 0 ? (
        <p className="rounded-2xl bg-sage/15 p-4 text-center font-medium">Alles im Wagen. 🎉</p>
      ) : null}

      {sortedGroups.map(([label, group]) => (
        <section key={label} aria-labelledby={`dep-${label}`}>
          <h2 id={`dep-${label}`} className="mb-2 font-sans text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {label}
          </h2>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {group.items
              .sort((a, b) => a.name.localeCompare(b.name, "de"))
              .map((item) => (
                <ItemRow key={item.id} item={item} onToggle={() => toggle(item)} onDelete={() => remove(item)} />
              ))}
          </ul>
        </section>
      ))}

      {optimisticHide && hiddenStaples.length > 0 ? (
        <button
          type="button"
          onClick={toggleStaples}
          className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Eye className="size-4" aria-hidden />
          {hiddenStaples.length} {hiddenStaples.length === 1 ? "Grundzutat" : "Grundzutaten"} ausgeblendet (
          {hiddenStaples.map((i) => i.name).join(", ")}) · anzeigen
        </button>
      ) : null}
      {!optimisticHide && open.some((i) => i.isStaple) ? (
        <button
          type="button"
          onClick={toggleStaples}
          className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <EyeOff className="size-4" aria-hidden />
          Grundzutaten wie Salz und Öl ausblenden
        </button>
      ) : null}

      {checked.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowChecked((v) => !v)}
              aria-expanded={showChecked}
              className="flex min-h-11 items-center gap-2 text-sm font-medium"
            >
              <Check className="size-4 text-sage" aria-hidden />
              Im Wagen ({checked.length}) · {showChecked ? "ausblenden" : "anzeigen"}
            </button>
            <Button type="button" variant="ghost" size="sm" onClick={() => clear("checked")}>
              <Trash2 aria-hidden />
              Erledigte löschen
            </Button>
          </div>
          {showChecked ? (
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card/60">
              {checked.map((item) => (
                <ItemRow key={item.id} item={item} onToggle={() => toggle(item)} onDelete={() => remove(item)} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {optimisticItems.length > 0 ? (
        <div className="pt-2">
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => clear("all")}>
            Ganze Liste löschen
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ItemRow({ item, onToggle, onDelete }: { item: ShoppingItem; onToggle: () => void; onDelete: () => void }) {
  const amount = formatShoppingAmount(item.amount, item.unit);
  return (
    <li className="flex items-stretch">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        onClick={onToggle}
        className="flex min-h-14 flex-1 items-center gap-3 px-3 py-2 text-left active:bg-muted"
      >
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors",
            item.checked ? "border-sage bg-sage text-sage-foreground" : "border-input",
          )}
          aria-hidden
        >
          {item.checked ? <Check className="size-4" /> : null}
        </span>
        <span className={cn("min-w-0 flex-1 text-base", item.checked && "text-muted-foreground line-through")}>
          {item.name}
        </span>
        {amount ? (
          <span className={cn("shrink-0 text-sm tabular-nums", item.checked ? "text-muted-foreground" : "font-medium")}>
            {amount}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="grid w-11 shrink-0 place-items-center text-muted-foreground hover:text-destructive"
        aria-label={`${item.name} löschen`}
      >
        <X className="size-4" aria-hidden />
      </button>
    </li>
  );
}
