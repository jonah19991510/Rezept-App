"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { createPastWorkoutAction } from "@/app/(app)/sport/training-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { berlinParts } from "@/lib/domain/workout";

type Plan = { id: string; title: string; days: { id: string; name: string }[] };

/** Vorschlag beim Öffnen: Beginn vor einer Stunde, auf die Viertelstunde abgerundet (deutsche Zeit). */
function defaults() {
  const start = new Date(Date.now() - 60 * 60_000);
  start.setMinutes(start.getMinutes() - (start.getMinutes() % 15), 0, 0);
  return { ...berlinParts(start.toISOString()), minutes: "60" };
}

/**
 * „Training nachtragen“: Datum, Beginn, Dauer und optional Plan-Tag wählen; danach öffnet sich die Bearbeiten-Ansicht,
 * in der man die Sätze einträgt.
 */
export function LogPastWorkout({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: "", time: "", minutes: "60", planId: "", dayId: "" });
  const [pending, startTransition] = useTransition();
  const plan = plans.find((p) => p.id === form.planId) ?? null;

  function openDialog() {
    setForm({ ...defaults(), planId: "", dayId: "" });
    setOpen(true);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const durationMin = Number.parseInt(form.minutes, 10);
    if (!(durationMin >= 1 && durationMin <= 600)) {
      toast.error("Die Dauer muss zwischen 1 und 600 Minuten liegen.");
      return;
    }
    startTransition(async () => {
      const result = await createPastWorkoutAction({
        planId: plan?.id ?? null,
        dayId: plan ? form.dayId || plan.days[0]?.id || null : null,
        date: form.date,
        time: form.time,
        durationMin,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.push(`/training/${result.id}?bearbeiten=1`);
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={openDialog} className="h-11 rounded-full px-4">
        <CalendarPlus aria-hidden />
        Nachtragen
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Training nachtragen</DialogTitle>
              <DialogDescription>Wann hast du trainiert? Die Übungen und Sätze trägst du im nächsten Schritt ein.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="past-date">Datum</Label>
                <Input
                  id="past-date"
                  type="date"
                  required
                  value={form.date}
                  max={berlinParts(new Date().toISOString()).date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="h-11 px-2 text-base"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="past-time">Beginn</Label>
                <Input id="past-time" type="time" required value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} className="h-11 px-2 text-base" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="past-minutes">Minuten</Label>
                <Input
                  id="past-minutes"
                  inputMode="numeric"
                  required
                  value={form.minutes}
                  onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                  className="h-11 px-2 text-center text-base tabular-nums"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="past-plan">Plan</Label>
              <NativeSelect
                id="past-plan"
                value={form.planId}
                onChange={(e) => {
                  const next = plans.find((p) => p.id === e.target.value);
                  setForm((f) => ({ ...f, planId: e.target.value, dayId: next?.days[0]?.id ?? "" }));
                }}
              >
                <option value="">Ohne Plan (Übungen selbst wählen)</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.days.length === 0}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {plan && plan.days.length > 1 ? (
              <div className="grid gap-1.5">
                <Label htmlFor="past-day">Tag</Label>
                <NativeSelect id="past-day" value={form.dayId} onChange={(e) => setForm((f) => ({ ...f, dayId: e.target.value }))}>
                  {plan.days.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={pending}>
                Weiter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
