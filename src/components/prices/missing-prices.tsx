"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ChevronRight, CircleCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { UnpricedReason } from "@/lib/domain/costs";
import { PriceForm, type PriceDraft } from "./price-manager";

export type MissingPrice = { ingredientId: string; name: string; reason: UnpricedReason; draft: PriceDraft };

const REASONS: Record<UnpricedReason, string> = {
  price: "kein Preis",
  convert: "Preis pro Stück, aber kein Stückgewicht: besser in Gramm angeben",
  grams: "Menge im Rezept ohne Gramm, ein Preis hilft hier nicht",
};

/**
 * „Preise ergänzen“ im Rezept: zeigt die Zutaten, die noch nicht in die Kosten eingehen, und lässt den Preis
 * gleich hier eintragen.
 */
export function MissingPrices({ items, label }: { items: MissingPrice[]; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const current = items.find((i) => i.ingredientId === editing) ?? null;
  const left = items.filter((i) => !done.includes(i.ingredientId));

  function saved(id: string) {
    setDone((d) => [...d, id]);
    setEditing(null);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        {label}
      </button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          {current ? (
            <>
              <DialogHeader>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="-ml-1 inline-flex min-h-9 items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  Alle fehlenden Preise
                </button>
                <DialogTitle className="pr-8">{current.name}</DialogTitle>
              </DialogHeader>
              <PriceForm key={current.ingredientId} initial={current.draft} onDone={() => saved(current.ingredientId)} hideHeader />
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">Fehlende Preise</DialogTitle>
                <DialogDescription>
                  Diese Zutaten gehen noch nicht in die Kosten ein. Tipp eine an, um den Preis einzutragen.
                </DialogDescription>
              </DialogHeader>
              {left.length === 0 ? (
                <p className="flex items-center gap-2 rounded-2xl border border-sage/40 bg-sage/10 px-4 py-3 text-sm">
                  <CircleCheck className="size-4 shrink-0 text-sage" aria-hidden />
                  Alles eingetragen. Die Kosten sind aktualisiert.
                </p>
              ) : (
                <ul className="divide-y overflow-hidden rounded-2xl border">
                  {left.map((item) =>
                    item.reason === "grams" ? (
                      <li key={item.ingredientId} className="px-4 py-2.5">
                        <span className="block font-medium">{item.name}</span>
                        <span className="block text-xs text-muted-foreground">{REASONS.grams}</span>
                      </li>
                    ) : (
                      <li key={item.ingredientId}>
                        <button
                          type="button"
                          onClick={() => setEditing(item.ingredientId)}
                          className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-muted/50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{item.name}</span>
                            <span className="block text-xs text-muted-foreground">{REASONS[item.reason]}</span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        </button>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
