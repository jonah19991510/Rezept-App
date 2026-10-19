"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { copyWeekAction } from "@/app/(app)/wochenplan/actions";
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
import { addDays, isIsoDate, mondayOf, weekLabel } from "@/lib/domain/week";
import { cn } from "@/lib/utils";

/** Diese Woche in eine andere kopieren (ergänzen oder ersetzen). */
export function CopyWeekDialog({ monday, hasEntries }: { monday: string; hasEntries: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(addDays(monday, 7));
  const [replace, setReplace] = useState(false);
  const [pending, startTransition] = useTransition();
  const targetMonday = isIsoDate(target) ? mondayOf(target) : null;

  function copy() {
    if (!targetMonday) return;
    startTransition(async () => {
      const result = await copyWeekAction({ fromMonday: monday, toMonday: targetMonday, replace });
      if (result.ok) {
        toast.success(result.message ?? "Woche kopiert.");
        setOpen(false);
        router.push(`/wochenplan?woche=${targetMonday}`);
      } else toast.error(result.message);
    });
  }

  const quick = [
    { label: "Nächste Woche", value: addDays(monday, 7) },
    { label: "Übernächste Woche", value: addDays(monday, 14) },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" disabled={!hasEntries} />}>
        <Copy aria-hidden />
        Woche kopieren
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Woche kopieren</DialogTitle>
          <DialogDescription>Alle Mahlzeiten aus {weekLabel(monday)} in eine andere Woche übernehmen.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            {quick.map((q) => (
              <Button
                key={q.value}
                type="button"
                variant={target === q.value ? "default" : "outline"}
                onClick={() => setTarget(q.value)}
              >
                {q.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="copy-target">Oder eine andere Woche (irgendein Tag darin)</Label>
            <Input id="copy-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
            {targetMonday ? <p className="text-sm text-muted-foreground">Ziel: {weekLabel(targetMonday)}</p> : null}
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Wenn dort schon etwas geplant ist</legend>
            {[
              { value: false, label: "Ergänzen", hint: "Vorhandenes bleibt, Kopien kommen dazu" },
              { value: true, label: "Ersetzen", hint: "Vorhandenes in der Zielwoche wird gelöscht" },
            ].map((o) => (
              <label
                key={String(o.value)}
                className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2", replace === o.value && "border-primary bg-accent/50")}
              >
                <input type="radio" name="copy-mode" checked={replace === o.value} onChange={() => setReplace(o.value)} className="size-4 accent-primary" />
                <span className="text-sm">
                  <span className="font-medium">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
          <Button type="button" onClick={copy} disabled={!targetMonday || targetMonday === monday || pending}>
            {pending ? "Wird kopiert …" : "Kopieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
