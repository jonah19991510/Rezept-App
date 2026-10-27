"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveBodySettingsAction } from "@/app/(app)/sport/koerper/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CIRCUMFERENCES, type BodySettings, type MeasureKey, type Sex } from "@/lib/domain/body";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import { cn } from "@/lib/utils";

/** Einstellungen: Körpergröße für den BMI und welche Umfänge du misst (ausgeblendete verschwinden überall). */
export function SettingsDialog({ settings, open, onOpenChange }: { settings: BodySettings; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">{open ? <SettingsForm settings={settings} onDone={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function SettingsForm({ settings, onDone }: { settings: BodySettings; onDone: () => void }) {
  const [height, setHeight] = useState(settings.heightCm != null ? formatDecimalInput(settings.heightCm, 1) : "");
  const [hidden, setHidden] = useState<MeasureKey[]>(settings.hidden);
  const [sex, setSex] = useState<Sex | null>(settings.sex);
  const [pending, startTransition] = useTransition();
  const heightCm = height.trim() === "" ? null : parseDecimal(height);
  const invalid = height.trim() !== "" && (heightCm == null || heightCm < 100 || heightCm > 250);

  function save() {
    if (invalid) return;
    startTransition(async () => {
      const result = await saveBodySettingsAction({ heightCm, sex, hidden });
      if (!result.ok) {
        toast.error(result.message ?? "Speichern ging nicht.");
        return;
      }
      toast.success("Einstellungen gespeichert");
      onDone();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Einstellungen</DialogTitle>
        <DialogDescription>Körpergröße für BMI und Körperfett, Geschlecht für die Navy-Formel und welche Umfänge du misst.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <p className="text-sm font-medium">Geschlecht</p>
        <div className="grid grid-cols-2 rounded-full border bg-background p-0.5" role="group" aria-label="Geschlecht">
          {(["m", "w"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sex === s}
              onClick={() => setSex(s)}
              className={cn(
                "h-11 rounded-full text-sm font-medium text-muted-foreground transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                sex === s && "bg-sport text-sport-foreground",
              )}
            >
              {s === "m" ? "Männlich" : "Weiblich"}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Die Navy-Formel rechnet für Männer und Frauen unterschiedlich. Vorgabe aus dem Energiebedarfsrechner.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="body-height">Körpergröße</Label>
        <div className="relative">
          <Input id="body-height" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} className="h-12 pr-10 text-base tabular-nums" aria-invalid={invalid} placeholder="z. B. 180" />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">cm</span>
        </div>
        <p className="text-xs text-muted-foreground">Ohne Größe gibt es keinen BMI. Vorgabe ist die Größe aus dem Energiebedarfsrechner.</p>
      </div>
      <div>
        <p className="mb-1 text-sm font-medium">Umfänge</p>
        <ul className="divide-y rounded-2xl border">
          {CIRCUMFERENCES.map((m) => (
            <li key={m.key}>
              <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-3">
                {m.label}
                <Switch
                  checked={!hidden.includes(m.key)}
                  onCheckedChange={(on) => setHidden((h) => (on ? h.filter((k) => k !== m.key) : [...h, m.key]))}
                />
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted-foreground">
          Ausgeblendete Maße verschwinden aus Eingabe und Übersicht; gespeicherte Werte bleiben erhalten. Für den Körperfettanteil braucht es Hals
          und Bauch (Männer) bzw. Hals, Taille und Hüfte (Frauen).
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Abbrechen
        </Button>
        <Button type="button" onClick={save} disabled={pending || invalid}>
          Speichern
        </Button>
      </DialogFooter>
    </>
  );
}
