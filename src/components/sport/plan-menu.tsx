"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Copy, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePlanAction, duplicatePlanAction, setPlanArchivedAction } from "@/app/(app)/sport/plaene/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ITEM = "min-h-11 gap-2.5 px-2.5";

/** Menü „…“ eines eigenen Plans: Bearbeiten, Duplizieren, Aus-/Einblenden, Löschen (mit Rückfrage). */
export function PlanMenu({ planId, title, archived }: { planId: string; title: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function run(action: () => Promise<{ ok: false; message: string } | { ok: boolean } | void>, success?: string) {
    startTransition(async () => {
      const result = await action();
      if (result && !result.ok) toast.error("message" in result ? result.message : "Das hat nicht geklappt.");
      else if (success) toast.success(success);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" className="rounded-full" aria-label={`Aktionen für ${title}`} disabled={pending} />}
        >
          <EllipsisVertical className="size-5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
          <DropdownMenuItem className={ITEM} render={<Link href={`/sport/plaene/${planId}/bearbeiten`} />}>
            <Pencil aria-hidden />
            Bearbeiten
          </DropdownMenuItem>
          <DropdownMenuItem className={ITEM} onClick={() => run(() => duplicatePlanAction(planId))}>
            <Copy aria-hidden />
            Duplizieren
          </DropdownMenuItem>
          <DropdownMenuItem
            className={ITEM}
            onClick={() =>
              run(() => setPlanArchivedAction(planId, !archived), archived ? `„${title}“ ist wieder aktiv.` : `„${title}“ ist ausgeblendet.`)
            }
          >
            {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {archived ? "Wieder einblenden" : "Ausblenden"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
              Der Plan mit allen Tagen und Übungen ist danach weg. Wenn du ihn nur gerade nicht nutzt, kannst du ihn stattdessen
              ausblenden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              Behalten
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={() => run(() => deletePlanAction(planId))}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
