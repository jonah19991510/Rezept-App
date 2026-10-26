"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dumbbell, Play } from "lucide-react";
import { toast } from "sonner";
import { deleteWorkoutAction, startWorkoutAction } from "@/app/(app)/sport/training-actions";
import { clearLocalWorkout } from "@/components/sport/workout/use-workout-session";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Day = { id: string; name: string; focus: string | null; exerciseCount: number };

/**
 * „Training starten“: mit Plan wählt man den Tag (vorausgewählt der nächste der Reihe), ohne Plan startet ein freies
 * Training. Läuft schon eins, fragt der Dialog: fortsetzen oder verwerfen und neu starten.
 */
export function StartTraining({
  planId = null,
  days = [],
  nextDayId = null,
  label = "Training starten",
  variant = "default",
  className,
}: {
  planId?: string | null;
  days?: Day[];
  nextDayId?: string | null;
  label?: string;
  variant?: "default" | "outline";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dayId, setDayId] = useState<string | null>(nextDayId ?? days[0]?.id ?? null);
  const [active, setActive] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start(replaceActive = false) {
    startTransition(async () => {
      if (replaceActive && active) {
        const removed = await deleteWorkoutAction(active);
        if (!removed.ok) {
          toast.error("Das laufende Training konnte nicht verworfen werden.");
          return;
        }
        clearLocalWorkout(active);
        setActive(null);
      }
      const result = await startWorkoutAction({ planId, dayId: planId ? dayId : null });
      if (result.ok) {
        router.push(`/training/${result.id}`);
        return;
      }
      if (result.activeId) {
        setActive(result.activeId);
        setOpen(true);
        return;
      }
      toast.error(result.message);
    });
  }

  function onClick() {
    // Mit mehreren Tagen erst wählen lassen, sonst direkt los
    if (planId && days.length > 1) setOpen(true);
    else start();
  }

  return (
    <>
      <Button type="button" variant={variant} onClick={onClick} disabled={pending || (planId != null && days.length === 0)} className={cn("h-12 rounded-full px-6 text-base", className)}>
        {planId ? <Play aria-hidden /> : <Dumbbell aria-hidden />}
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {active ? (
            <>
              <DialogHeader>
                <DialogTitle>Es läuft schon ein Training</DialogTitle>
                <DialogDescription>Du kannst es fortsetzen oder verwerfen und ein neues starten.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="destructive" onClick={() => start(true)} disabled={pending}>
                  Verwerfen und neu starten
                </Button>
                <Link href={`/training/${active}`} className={buttonVariants()}>
                  Fortsetzen
                </Link>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Welcher Tag?</DialogTitle>
                <DialogDescription>Vorausgewählt ist der nächste Tag nach deinem letzten Training.</DialogDescription>
              </DialogHeader>
              <div role="radiogroup" aria-label="Trainingstag" className="grid gap-2">
                {days.map((d) => {
                  const selected = d.id === dayId;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setDayId(d.id)}
                      className={cn(
                        "flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-left transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        selected ? "border-primary bg-primary/10" : "hover:bg-muted",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{d.name}</span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {d.focus ? `${d.focus} · ` : ""}
                          {d.exerciseCount === 1 ? "1 Übung" : `${d.exerciseCount} Übungen`}
                        </span>
                      </span>
                      {d.id === nextDayId ? <span className="shrink-0 rounded-full bg-sport-soft px-2.5 py-0.5 text-xs font-medium text-sport">Als Nächstes</span> : null}
                    </button>
                  );
                })}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="button" onClick={() => start()} disabled={pending || !dayId}>
                  <Play aria-hidden />
                  Los geht’s
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
