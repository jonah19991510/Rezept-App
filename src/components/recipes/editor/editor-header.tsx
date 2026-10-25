"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Kopf des Editors: X („Abbrechen“, bei ungespeicherten Änderungen mit Rückfrage), daneben klein „Rezept bearbeiten“
 * und der Titel. Am Handy oben angeheftet (der App-Kopf ist im Editor ausgeblendet).
 */
export function EditorHeader({
  kicker,
  title,
  cancelHref,
  dirty,
  onDiscard,
}: {
  kicker: string;
  title: string;
  cancelHref: string;
  dirty: boolean;
  /** vor dem Verlassen: Warnung beim Schließen der Seite abschalten */
  onDiscard: () => void;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);

  function leave() {
    onDiscard();
    router.push(cancelHref);
  }

  return (
    <header className="sticky top-0 z-30 -mx-4 flex items-center gap-2 bg-background/90 px-2 py-1.5 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
      <button
        type="button"
        onClick={() => (dirty ? setConfirm(true) : leave())}
        aria-label="Abbrechen"
        className="grid size-11 shrink-0 place-items-center rounded-full transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <X className="size-5" aria-hidden />
      </button>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{kicker}</p>
        <h1 className="truncate text-lg leading-tight font-semibold">{title}</h1>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Änderungen verwerfen?</DialogTitle>
            <DialogDescription>Du hast ungespeicherte Änderungen. Wenn du jetzt gehst, sind sie weg.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirm(false)}>
              Weiter bearbeiten
            </Button>
            <Button type="button" variant="destructive" onClick={leave}>
              Verwerfen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
