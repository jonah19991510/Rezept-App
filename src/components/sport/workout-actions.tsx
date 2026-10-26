"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ClipboardCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { applyWorkoutToPlanAction, deleteWorkoutAction } from "@/app/(app)/sport/training-actions";
import { clearLocalWorkout } from "@/components/sport/workout/use-workout-session";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Nach dem Training: Änderungen (Übungen, Reihenfolge, Satzzahl) in den Plan-Tag übernehmen. */
export function ApplyToPlan({ workoutId, dayName }: { workoutId: string; dayName: string }) {
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  if (done) return <p className="text-sm text-sage">Übernommen.</p>;
  return (
    <Button
      type="button"
      onClick={() =>
        startTransition(async () => {
          const result = await applyWorkoutToPlanAction(workoutId);
          if (result.ok) {
            setDone(true);
            toast.success(result.message);
          } else toast.error(result.message);
        })
      }
      disabled={pending}
    >
      <ClipboardCheck aria-hidden />
      In „{dayName}“ übernehmen
    </Button>
  );
}

/** Training aus dem Verlauf löschen (mit Rückfrage). */
export function DeleteWorkout({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button type="button" variant="ghost" className="text-destructive" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        Training löschen
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Training löschen?</DialogTitle>
            <DialogDescription>Das Training mit allen Sätzen verschwindet aus Verlauf und Statistik.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Behalten
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteWorkoutAction(workoutId);
                  if (!result.ok) {
                    toast.error("Das Training konnte nicht gelöscht werden.");
                    return;
                  }
                  clearLocalWorkout(workoutId);
                  router.replace("/sport/verlauf");
                })
              }
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
