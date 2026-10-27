"use client";

import { useState, useTransition } from "react";
import { CircleHelp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteMeasurementAction, saveMeasurementAction } from "@/app/(app)/sport/koerper/actions";
import { EditorSheet } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fixed, longDay, MEASURES, type Measurement, type MeasureKey } from "@/lib/domain/body";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";

type Form = { date: string; note: string; values: Record<MeasureKey, string> };

function formFrom(m: Measurement | null, date: string): Form {
  return {
    date: m?.date ?? date,
    note: m?.note ?? "",
    values: Object.fromEntries(MEASURES.map((x) => [x.key, m?.[x.key] != null ? formatDecimalInput(m[x.key], 1) : ""])) as Record<MeasureKey, string>,
  };
}

/**
 * Messung eintragen oder ändern: Datum, Gewicht und Umfänge (Werte vom letzten Mal hell als Vorschlag), Notiz. Gibt es
 * für das gewählte Datum schon eine Messung, wird sie geladen und geändert (eine Messung je Tag).
 */
export function MeasurementSheet({
  measurement,
  measurements,
  keys,
  today,
  onClose,
  onGuide,
}: {
  /** null = neue Messung */
  measurement: Measurement | null;
  measurements: Measurement[];
  keys: MeasureKey[];
  today: string;
  onClose: () => void;
  onGuide: (key: MeasureKey) => void;
}) {
  const [open, setOpen] = useState(true);
  const [current, setCurrent] = useState<Measurement | null>(measurement);
  const [form, setForm] = useState<Form>(() => formFrom(measurement, today));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  // Je Maß der zuletzt gemessene Wert (aus irgendeiner früheren Messung) als heller Vorschlag
  const others = [...measurements].reverse().filter((m) => m.id !== current?.id);
  const lastValue = (key: MeasureKey) => others.find((m) => m[key] != null)?.[key] ?? null;
  const last = others[0] ?? null;

  function close() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function changeDate(date: string) {
    // Neue Messung auf einen Tag mit Messung: diese laden und ändern
    const existing = measurements.find((m) => m.date === date && m.id !== current?.id);
    if (existing && !measurement) {
      setCurrent(existing);
      setForm(formFrom(existing, date));
      toast("Für diesen Tag gibt es schon eine Messung. Du änderst sie.");
      return;
    }
    setForm((f) => ({ ...f, date }));
  }

  function save() {
    const values = Object.fromEntries(MEASURES.map((m) => [m.key, form.values[m.key].trim() === "" ? null : parseDecimal(form.values[m.key])])) as Record<
      MeasureKey,
      number | null
    >;
    const invalid = MEASURES.find((m) => form.values[m.key].trim() !== "" && values[m.key] == null);
    if (invalid) {
      setErrors({ [invalid.key]: ["Bitte eine Zahl eingeben."] });
      return;
    }
    startTransition(async () => {
      const result = await saveMeasurementAction(current?.id ?? null, { date: form.date, note: form.note.trim() || null, ...values });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? "Bitte prüfe die Eingaben.");
        return;
      }
      toast.success(current ? "Messung gespeichert" : "Messung eingetragen");
      close();
    });
  }

  function remove() {
    if (!current) return;
    startTransition(async () => {
      const result = await deleteMeasurementAction(current.id);
      if (!result.ok) {
        toast.error(result.message ?? "Löschen ging nicht.");
        return;
      }
      toast.success("Messung gelöscht");
      close();
    });
  }

  const err = (key: string) => errors[key]?.[0];
  const fields = MEASURES.filter((m) => keys.includes(m.key));

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title={current ? "Messung bearbeiten" : "Neue Messung"}
      description={current ? longDay(current.date) : "Trag ein, was du gemessen hast. Leere Felder bleiben leer."}
      footer={
        <>
          {current ? (
            confirmDelete ? (
              <>
                <Button type="button" variant="destructive" size="lg" onClick={remove} disabled={pending} className="flex-1">
                  Wirklich löschen
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => setConfirmDelete(false)}>
                  Abbrechen
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" size="icon-lg" onClick={() => setConfirmDelete(true)} aria-label="Messung löschen">
                <Trash2 aria-hidden />
              </Button>
            )
          ) : null}
          {!confirmDelete ? (
            <Button type="button" size="lg" onClick={save} disabled={pending} className="flex-1">
              Speichern
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-1.5">
        <Label htmlFor="body-date">Datum</Label>
        <Input id="body-date" type="date" max={today} value={form.date} onChange={(e) => changeDate(e.target.value)} className="h-12 text-base" aria-invalid={Boolean(err("date"))} />
        {err("date") ? <p className="text-sm text-destructive">{err("date")}</p> : null}
      </div>

      {err("_form") ? <p className="text-sm text-destructive">{err("_form")}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        {fields.map((m) => (
          <div key={m.key} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-1">
              <Label htmlFor={`body-${m.key}`}>{m.label}</Label>
              <button
                type="button"
                onClick={() => onGuide(m.key)}
                className="-my-2 grid size-8 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label={`So misst du ${m.label}`}
              >
                <CircleHelp className="size-4" aria-hidden />
              </button>
            </div>
            <div className="relative">
              <Input
                id={`body-${m.key}`}
                inputMode="decimal"
                value={form.values[m.key]}
                placeholder={lastValue(m.key) != null ? fixed(lastValue(m.key)!) : ""}
                onChange={(e) => setForm((f) => ({ ...f, values: { ...f.values, [m.key]: e.target.value } }))}
                className="h-12 pr-10 text-base tabular-nums"
                aria-invalid={Boolean(err(m.key))}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{m.unit}</span>
            </div>
            {err(m.key) ? <p className="text-sm text-destructive">{err(m.key)}</p> : null}
          </div>
        ))}
      </div>
      {last ? <p className="-mt-3 text-xs text-muted-foreground">Hell steht jeweils dein zuletzt gemessener Wert.</p> : null}

      <div className="grid gap-1.5">
        <Label htmlFor="body-note">Notiz · optional</Label>
        <Input id="body-note" value={form.note} maxLength={300} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="z. B. nach dem Urlaub" className="h-12 text-base" />
      </div>
    </EditorSheet>
  );
}
