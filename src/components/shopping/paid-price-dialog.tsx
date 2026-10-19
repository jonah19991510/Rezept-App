"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { savePaidPriceAction } from "@/app/(app)/preise/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseDecimal } from "@/lib/domain/decimal";
import { formatShoppingAmount } from "@/lib/domain/shopping";
import type { ShoppingItem } from "@/lib/server/shopping";

/** Lässt sich für diesen Eintrag ein Preis speichern? (Zutat und Menge in g, ml oder Stück) */
export function canPricePaid(item: ShoppingItem): boolean {
  return item.ingredientId != null && item.amount != null && (item.unit === "g" || item.unit === "ml" || item.unit === "Stück");
}

/** Schnelleingabe beim Einkaufen: „Was hast du für 500 g Spaghetti bezahlt?“ → Preis der Zutat. */
export function PaidPriceDialog({ item, onClose }: { item: ShoppingItem | null; onClose: () => void }) {
  return (
    <Dialog open={item != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">{item ? <PaidPriceForm key={item.id} item={item} onDone={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}

function PaidPriceForm({ item, onDone }: { item: ShoppingItem; onDone: () => void }) {
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function save() {
    const value = parseDecimal(price);
    if (value == null || value < 0) return setError("Bitte einen Preis eingeben, z. B. 2,49.");
    startTransition(async () => {
      const result = await savePaidPriceAction({ itemId: item.id, price: value });
      if (result.ok) {
        toast.success(result.message ?? "Preis gespeichert.");
        onDone();
      } else setError(result.message);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="pr-8">Preis eintragen</DialogTitle>
        <DialogDescription>
          Was hast du für {formatShoppingAmount(item.amount, item.unit)} {item.name} bezahlt? Der Preis gilt ab jetzt für
          Rezepte und Wochenplan.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="paid-price">Preis (€)</Label>
        <Input
          id="paid-price"
          inputMode="decimal"
          autoFocus
          placeholder="2,49"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Wird gespeichert …" : "Speichern"}
        </Button>
      </DialogFooter>
    </>
  );
}
