"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EllipsisVertical, LogOut, Pencil, PartyPopper, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteChallengeAction, joinChallengeAction, leaveChallengeAction } from "@/app/(app)/sport/challenges/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const ITEM = "min-h-11 gap-2.5 px-2.5";

/** „Mitmachen“ mit kurzer Erklärung, ab wann es zählt. */
export function JoinButton({ challengeId, title, startText }: { challengeId: string; title: string; startText: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-sport/30 bg-sport-soft/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold">Machst du mit?</p>
        <p className="text-sm text-muted-foreground">{startText}</p>
      </div>
      <Button
        type="button"
        size="lg"
        className="h-12 shrink-0 rounded-full px-6 text-base"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await joinChallengeAction(challengeId);
            if (!result.ok) toast.error(result.message);
            else toast.success(`Du bist bei „${title}“ dabei. Viel Erfolg!`, { icon: <PartyPopper className="size-4" /> });
          })
        }
      >
        {pending ? "Einen Moment …" : "Mitmachen"}
      </Button>
    </div>
  );
}

/**
 * Menü „…“: Bearbeiten und Löschen (Ersteller bzw. Admin), Austreten (Teilnehmer). Löschen und Austreten fragen nach,
 * weil Einträge dabei verloren gehen.
 */
export function ChallengeMenu({
  challengeId,
  title,
  canEdit,
  canDelete,
  isParticipant,
  othersJoined,
}: {
  challengeId: string;
  title: string;
  canEdit: boolean;
  canDelete: boolean;
  isParticipant: boolean;
  othersJoined: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"leave" | "delete" | null>(null);
  if (!canEdit && !canDelete && !isParticipant) return null;

  function run(kind: "leave" | "delete") {
    startTransition(async () => {
      const result = kind === "leave" ? await leaveChallengeAction(challengeId) : await deleteChallengeAction(challengeId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setConfirm(null);
      toast.success(kind === "leave" ? `Du bist bei „${title}“ ausgetreten.` : `„${title}“ ist gelöscht.`);
      if (kind === "delete") router.push("/sport/entdecken/challenges");
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label={`Aktionen für ${title}`} disabled={pending} />}>
          <EllipsisVertical className="size-5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
          {canEdit ? (
            <DropdownMenuItem className={ITEM} render={<Link href={`/sport/challenges/${challengeId}/bearbeiten`} />}>
              <Pencil aria-hidden />
              Bearbeiten
            </DropdownMenuItem>
          ) : null}
          {isParticipant ? (
            <DropdownMenuItem className={ITEM} onClick={() => setConfirm("leave")}>
              <LogOut aria-hidden />
              Austreten
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={ITEM} variant="destructive" onClick={() => setConfirm("delete")}>
                <Trash2 aria-hidden />
                Löschen
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirm != null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === "leave" ? `Bei „${title}“ austreten?` : `„${title}“ löschen?`}</DialogTitle>
            <DialogDescription>
              {confirm === "leave"
                ? "Deine Einträge und Punkte dieser Challenge werden gelöscht, du verschwindest aus der Rangliste."
                : othersJoined
                  ? "Es machen schon andere mit. Ihre Einträge und Punkte gehen dabei verloren."
                  : "Die Challenge und alle Einträge sind danach weg."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
              Abbrechen
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={() => confirm && run(confirm)}>
              {confirm === "leave" ? "Austreten" : "Löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
