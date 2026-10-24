"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { generateFromPlanAction } from "@/app/(app)/einkauf/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dayMonth, weekdayShort } from "@/lib/domain/week";
import { cn } from "@/lib/utils";

export type RangePreset = { label: string; from: string; to: string };

/**
 * Zeitraum wählen und die Einkaufsliste aus dem Wochenplan erstellen. Im Wochenplan mit eigenem Knopf
 * („Einkaufsliste aus dieser Woche“); danach geht es dort zur Liste.
 */
export function GenerateDialog({
  presets,
  hasPlanItems,
  triggerLabel = "Aus Wochenplan",
  triggerClassName,
  openListAfter = false,
}: {
  presets: RangePreset[];
  hasPlanItems: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
  /** nach dem Erstellen zur Einkaufsliste wechseln */
  openListAfter?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(presets[0].from);
  const [to, setTo] = useState(presets[0].to);
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const result = await generateFromPlanAction({ from, to });
      if (result.ok) {
        toast.success(result.message ?? "Einkaufsliste erstellt.");
        setOpen(false);
        if (openListAfter) router.push("/einkauf");
      } else toast.error(result.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerClassName ? "outline" : "default"} className={triggerClassName} />}>
        <CalendarRange aria-hidden />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Einkaufsliste aus dem Wochenplan</DialogTitle>
          <DialogDescription>
            Alle Zutaten der geplanten Mahlzeiten, gleiche Zutaten zusammengerechnet.
            {hasPlanItems ? " Die bisherigen Einträge aus dem Plan werden ersetzt, deine eigenen bleiben." : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            {presets.map((p) => {
              const active = p.from === from && p.to === to;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setFrom(p.from);
                    setTo(p.to);
                  }}
                  className={cn(
                    "flex min-h-12 items-center justify-between rounded-xl border px-3 text-left text-sm",
                    active && "border-primary bg-accent/50",
                  )}
                  aria-pressed={active}
                >
                  <span className="font-medium">{p.label}</span>
                  <span className="text-muted-foreground">
                    {weekdayShort(p.from)} {dayMonth(p.from)} – {weekdayShort(p.to)} {dayMonth(p.to)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="range-from">Von</Label>
              <Input id="range-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="range-to">Bis</Label>
              <Input id="range-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
          <Button type="button" onClick={generate} disabled={pending || !from || !to || from > to}>
            {pending ? "Wird erstellt …" : "Liste erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
