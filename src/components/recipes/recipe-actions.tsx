"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BookCheck, Copy, EllipsisVertical, FileDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteRecipeAction, duplicateRecipeAction, forkRecipeAction } from "@/app/(app)/rezepte/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const ITEM = "min-h-11 gap-2.5 px-2.5";

/** Runder Knopf oben auf der Rezeptseite (Herz, Menü) */
export const roundIconClass = "rounded-full bg-card";

/**
 * Fremde (öffentliche) Rezepte: übernehmen bzw. die schon übernommene Kopie öffnen. Steht neben „Kochen starten“.
 */
export function ForkActions({
  recipeId,
  ownCopyId = null,
  className,
}: {
  recipeId: string;
  ownCopyId?: string | null;
  /** Größe und Form wie „Kochen starten“ */
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function fork() {
    startTransition(async () => {
      const result = await forkRecipeAction(recipeId);
      if (result && !result.ok) toast.error(result.message);
    });
  }

  if (ownCopyId) {
    return (
      <>
        <Link href={`/rezepte/${ownCopyId}`} className={cn(buttonVariants({ variant: "outline" }), className)}>
          <BookCheck aria-hidden />
          Deine Kopie öffnen
        </Link>
        <Button type="button" variant="outline" onClick={fork} disabled={pending} className={className}>
          <Copy aria-hidden />
          {pending ? "Wird übernommen …" : "Noch einmal übernehmen"}
        </Button>
      </>
    );
  }
  return (
    <Button type="button" variant="outline" onClick={fork} disabled={pending} className={className} aria-label="In mein Rezeptbuch übernehmen">
      <Copy aria-hidden />
      {pending ? "Wird übernommen …" : "Übernehmen"}
    </Button>
  );
}

/** Menü ⋮ oben auf der eigenen Rezeptseite: Duplizieren, Als Markdown, Löschen (mit Rückfrage). */
export function RecipeMenu({ recipeId, title }: { recipeId: string; title: string }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateRecipeAction(recipeId);
      if (result && !result.ok) toast.error(result.message);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteRecipeAction(recipeId);
      if (result && !result.ok) toast.error(result.message);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Weitere Aktionen" disabled={pending} className={roundIconClass} />}>
          <EllipsisVertical aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
          <DropdownMenuItem className={ITEM} onClick={duplicate}>
            <Copy aria-hidden />
            Duplizieren
          </DropdownMenuItem>
          {/* Normaler Link: Der Browser lädt die .md-Datei herunter */}
          <DropdownMenuItem className={ITEM} render={<a href={`/rezepte/${recipeId}/markdown`} download />}>
            <FileDown aria-hidden />
            Als Markdown
          </DropdownMenuItem>
          <DropdownMenuItem className={ITEM} variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>„{title}“ löschen?</DialogTitle>
            <DialogDescription>
              Das Rezept wird endgültig gelöscht, auch aus deinem Wochenplan und deinen Favoriten. Das lässt sich nicht
              rückgängig machen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
            <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
              {pending ? "Wird gelöscht …" : "Endgültig löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
