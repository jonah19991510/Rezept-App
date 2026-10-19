"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BookCheck, Copy, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
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

const ITEM = "min-h-11 gap-2.5 px-2.5";

/**
 * Aktionen auf der Rezeptseite. Bearbeiten/Löschen nur für den Owner.
 * Fremde (öffentliche) Rezepte: übernehmen bzw. die schon übernommene Kopie öffnen.
 */
export function RecipeActions({
  recipeId,
  title,
  isOwner,
  ownCopyId = null,
}: {
  recipeId: string;
  title: string;
  isOwner: boolean;
  ownCopyId?: string | null;
}) {
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

  function fork() {
    startTransition(async () => {
      const result = await forkRecipeAction(recipeId);
      if (result && !result.ok) toast.error(result.message);
    });
  }

  if (!isOwner) {
    if (ownCopyId) {
      return (
        <>
          <Link href={`/rezepte/${ownCopyId}`} className={buttonVariants()}>
            <BookCheck aria-hidden />
            Deine Kopie öffnen
          </Link>
          <Button type="button" variant="outline" onClick={fork} disabled={pending}>
            <Copy aria-hidden />
            {pending ? "Wird übernommen …" : "Noch einmal übernehmen"}
          </Button>
        </>
      );
    }
    return (
      <Button type="button" onClick={fork} disabled={pending}>
        <Copy aria-hidden />
        {pending ? "Wird übernommen …" : "In mein Rezeptbuch übernehmen"}
      </Button>
    );
  }

  return (
    <>
      <Link href={`/rezepte/${recipeId}/bearbeiten`} className={buttonVariants()}>
        <Pencil aria-hidden />
        Bearbeiten
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Weitere Aktionen" disabled={pending} />}>
          <EllipsisVertical aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
          <DropdownMenuItem className={ITEM} onClick={duplicate}>
            <Copy aria-hidden />
            Duplizieren
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
