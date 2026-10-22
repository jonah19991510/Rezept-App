"use client";

import { useState, useTransition } from "react";
import { Euro, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePriceAction, savePriceAction } from "@/app/(app)/preise/actions";
import { EmptyState } from "@/components/layout/empty-state";
import { IngredientPicker } from "@/components/recipes/editor/ingredient-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { defaultPriceUnit, PRICE_UNIT_LABELS, PRICE_UNITS, pricePer100, type IngredientWeights, type PriceUnit } from "@/lib/domain/costs";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import { formatDate, formatEuro, formatNumber } from "@/lib/format";
import type { PriceRow } from "@/lib/server/kitchen-log";
import { priceSchema } from "@/lib/validation/kitchen-log";

export type PriceDraft = {
  ingredientId: string;
  name: string;
  info: IngredientWeights;
  id?: string;
  price: string;
  amount: string;
  unit: PriceUnit;
  store: string;
};

function per100Text(row: PriceRow): string {
  if (row.perGram == null) return "ohne Stückgewicht nicht umrechenbar";
  const unit = row.packageUnit === "ml" ? "ml" : "g";
  return `${formatEuro(pricePer100(row.perGram, row.packageUnit, row.info))} pro 100 ${unit}`;
}

/** Eigene Preise pro Zutat: Packungspreis und -größe, optional Laden. Daraus rechnet die App Kosten pro Portion. */
export function PriceManager({ prices }: { prices: PriceRow[] }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState<PriceDraft | null>(null);

  function edit(row: PriceRow) {
    setDraft({
      id: row.id,
      ingredientId: row.ingredientId,
      name: row.name,
      info: row.info,
      price: formatDecimalInput(row.price, 2),
      amount: formatDecimalInput(row.packageAmount),
      unit: row.packageUnit,
      store: row.store ?? "",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setPickerOpen(true)}>
          <Plus aria-hidden />
          Preis eintragen
        </Button>
      </div>

      {prices.length === 0 ? (
        <EmptyState icon={Euro} title="Noch keine Preise">
          Trag ein, was du für eine Packung bezahlst, z. B. 1,29 € für 500 g Spaghetti. Dann zeigen Rezepte, Wochenplan und
          Einkaufsliste, was ein Gericht ungefähr kostet. Schneller geht es beim Einkaufen: In der Einkaufsliste kannst du
          bei abgehakten Sachen den bezahlten Preis eintragen.
        </EmptyState>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {prices.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => edit(row)}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{row.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {per100Text(row)}
                    {row.store ? ` · ${row.store}` : ""} · {formatDate(row.updatedAt)}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums">
                  <span className="font-medium">{formatEuro(row.price)}</span>
                  <span className="block text-xs text-muted-foreground">
                    für {formatNumber(row.packageAmount)} {PRICE_UNIT_LABELS[row.packageUnit]}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pickerOpen ? (
        <IngredientPicker
          open
          onOpenChange={setPickerOpen}
          onSelect={(ingredient) => {
            const existing = prices.find((p) => p.ingredientId === ingredient.id);
            if (existing) return edit(existing);
            const info = { density_g_per_ml: ingredient.density_g_per_ml, piece_weight_g: ingredient.piece_weight_g };
            setDraft({
              ingredientId: ingredient.id,
              name: ingredient.name,
              info,
              price: "",
              amount: "",
              unit: defaultPriceUnit(ingredient.food_group, ingredient.density_g_per_ml),
              store: "",
            });
          }}
        />
      ) : null}

      <Dialog open={draft != null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          {draft ? <PriceForm key={draft.ingredientId} initial={draft} onDone={() => setDraft(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Preis einer Zutat eintragen, ändern oder löschen (auch auf der Seite „Zutaten“). */
export function PriceForm({ initial, onDone, hideHeader = false }: { initial: PriceDraft; onDone: () => void; hideHeader?: boolean }) {
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const needsPieceWeight = d.unit === "piece" && !d.info.piece_weight_g;

  function save() {
    const parsed = priceSchema.safeParse({
      ingredientId: d.ingredientId,
      price: d.price.trim() ? (parseDecimal(d.price) ?? Number.NaN) : undefined,
      packageAmount: d.amount.trim() ? (parseDecimal(d.amount) ?? Number.NaN) : undefined,
      packageUnit: d.unit,
      store: d.store,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    startTransition(async () => {
      const result = await savePriceAction(parsed.data);
      if (result.ok) {
        toast.success(`Preis für ${d.name} gespeichert.`);
        onDone();
      } else setError(result.message);
    });
  }

  function remove() {
    if (!d.id) return;
    startTransition(async () => {
      const result = await deletePriceAction(d.id!);
      if (result.ok) {
        toast.success(`Preis für ${d.name} gelöscht.`);
        onDone();
      } else setError(result.message);
    });
  }

  return (
    <>
      {hideHeader ? (
        <p className="text-sm text-muted-foreground">Was kostet eine Packung? Zum Beispiel 1,29 € für 500 g.</p>
      ) : (
        <DialogHeader>
          <DialogTitle className="pr-8">{d.name}</DialogTitle>
          <DialogDescription>Was kostet eine Packung? Zum Beispiel 1,29 € für 500 g.</DialogDescription>
        </DialogHeader>
      )}
      <div className="grid gap-4">
        <div className="grid grid-cols-[1fr_1fr_6rem] gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="price-price">Preis (€)</Label>
            <Input id="price-price" inputMode="decimal" placeholder="1,29" value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="price-amount">Packung</Label>
            <Input id="price-amount" inputMode="decimal" placeholder="500" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="price-unit">Einheit</Label>
            <NativeSelect id="price-unit" value={d.unit} onChange={(e) => setD({ ...d, unit: e.target.value as PriceUnit })}>
              {PRICE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {PRICE_UNIT_LABELS[u]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        {needsPieceWeight ? (
          <p className="text-xs text-muted-foreground">
            Für diese Zutat ist kein Stückgewicht hinterlegt. Gib die Packung besser in Gramm an, sonst lässt sich der Preis
            nicht auf Rezepte umrechnen.
          </p>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor="price-store">Laden (freiwillig)</Label>
          <Input id="price-store" placeholder="z. B. Wochenmarkt" value={d.store} onChange={(e) => setD({ ...d, store: e.target.value })} />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      <DialogFooter className="sm:justify-between">
        {d.id ? (
          <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
            <Trash2 aria-hidden />
            Löschen
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
