"use client";

import { useState, useTransition } from "react";
import { CopyPlus, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteBloodTestAction, saveBloodTestAction } from "@/app/(app)/sport/supplemente/actions";
import { EditorSheet, FieldHeading } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { MARKER_GROUPS, MARKERS, markerOf, rangeOf, rangeText, STATUS_LABEL, statusOf, type BloodTest, type BloodValue } from "@/lib/domain/blood";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import type { Sex } from "@/lib/domain/supplements";
import { Field, longDate, statusTone, ToneBadge } from "./health-parts";

const OWN = "__eigen";

type Row = { key: number; marker: string; name: string; value: string; unit: string; low: string; high: string; showRange: boolean };
type Form = { date: string; lab: string; note: string; rows: Row[] };

let nextKey = 1;

const rowFrom = (v: BloodValue | null, keepValue = true): Row => ({
  key: nextKey++,
  marker: v?.marker ?? (v ? OWN : ""),
  name: v && !v.marker ? v.name : "",
  value: v && keepValue ? formatDecimalInput(v.value, 3) : "",
  unit: v?.unit ?? "",
  low: v?.low != null ? formatDecimalInput(v.low, 3) : "",
  high: v?.high != null ? formatDecimalInput(v.high, 3) : "",
  showRange: v?.low != null || v?.high != null,
});

/**
 * Bluttest eintragen oder ändern: Datum, Labor/Praxis, Werte (aus dem Katalog mit Einheit und üblichem Bereich oder
 * eigener Wert), optional der Bereich laut Befund, Notiz. „Werte vom letzten Test“ legt dieselben Zeilen leer an.
 */
export function BloodSheet({ test, last, sex, today, onClose }: { test: BloodTest | null; last: BloodTest | null; sex: Sex | null; today: string; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState<Form>(() => ({
    date: test?.date ?? today,
    lab: test?.lab ?? "",
    note: test?.note ?? "",
    rows: test ? test.values.map((v) => rowFrom(v)) : [rowFrom(null)],
  }));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const err = (key: string) => errors[key]?.[0];
  const setRow = (key: number, patch: Partial<Row>) => setForm((f) => ({ ...f, rows: f.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));

  function close() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function chooseMarker(row: Row, value: string) {
    const m = markerOf(value);
    setRow(row.key, { marker: value, unit: m ? m.unit : row.unit });
  }

  function copyLast() {
    if (!last) return;
    const used = new Set(form.rows.filter((r) => r.marker).map((r) => (r.marker === OWN ? `${OWN}:${r.name}` : r.marker)));
    const added = last.values.filter((v) => !used.has(v.marker ?? `${OWN}:${v.name}`)).map((v) => rowFrom(v, false));
    setForm((f) => ({ ...f, rows: [...f.rows.filter((r) => r.marker || r.value), ...added] }));
    toast(`${added.length} ${added.length === 1 ? "Wert" : "Werte"} vom ${longDate(last.date)} übernommen`);
  }

  function save() {
    const num = (v: string) => (v.trim() === "" ? null : parseDecimal(v));
    const values: BloodValue[] = [];
    for (const r of form.rows) {
      if (!r.marker && !r.value.trim()) continue;
      const m = markerOf(r.marker);
      const value = num(r.value);
      const fail = (message: string) => {
        setErrors({ [`row-${r.key}`]: [message] });
        toast.error(message);
      };
      if (!m && !r.name.trim()) return fail("Bitte einen Wert wählen oder benennen.");
      if (value == null) return fail("Bitte das Ergebnis als Zahl eintragen.");
      const low = num(r.low);
      const high = num(r.high);
      if ((r.low.trim() && low == null) || (r.high.trim() && high == null)) return fail("Der Bereich braucht Zahlen.");
      values.push({ marker: m?.key ?? null, name: m?.label ?? r.name.trim(), value, unit: r.unit.trim(), low, high });
    }
    startTransition(async () => {
      const result = await saveBloodTestAction(test?.id ?? null, { date: form.date, lab: form.lab || null, note: form.note || null, values });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? "Bitte prüfe die Eingaben.");
        return;
      }
      toast.success(test ? "Bluttest gespeichert" : "Bluttest eingetragen");
      close();
    });
  }

  function remove() {
    if (!test) return;
    startTransition(async () => {
      const result = await deleteBloodTestAction(test.id);
      if (!result.ok) {
        toast.error(result.message ?? "Löschen ging nicht.");
        return;
      }
      toast.success("Bluttest gelöscht");
      close();
    });
  }

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title={test ? "Bluttest bearbeiten" : "Neuer Bluttest"}
      description="Werte und Einheiten wie auf dem Befund. Steht dort ein Referenzbereich, gilt der."
      footer={
        <>
          {test ? (
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
              <Button type="button" variant="outline" size="icon-lg" onClick={() => setConfirmDelete(true)} aria-label="Bluttest löschen">
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
      <div className="grid grid-cols-2 gap-3">
        <Field id="blood-date" label="Datum" error={err("date")}>
          <Input id="blood-date" type="date" max={today} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="h-12 text-base" aria-invalid={Boolean(err("date"))} />
        </Field>
        <Field id="blood-lab" label="Labor/Praxis · optional" error={err("lab")}>
          <Input id="blood-lab" value={form.lab} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, lab: e.target.value }))} placeholder="z. B. Hausarzt" className="h-12 text-base" />
        </Field>
      </div>

      <div>
        <FieldHeading aside={`${form.rows.filter((r) => r.value.trim()).length} eingetragen`}>Werte</FieldHeading>
        {last && !test ? (
          <Button type="button" variant="outline" className="mb-3 h-11 w-full rounded-full" onClick={copyLast}>
            <CopyPlus aria-hidden />
            Werte vom letzten Test ({longDate(last.date)})
          </Button>
        ) : null}
        <ul className="grid gap-3">
          {form.rows.map((row) => {
            const m = markerOf(row.marker);
            const value = parseDecimal(row.value);
            const preview: BloodValue | null =
              value != null && (m || row.name.trim())
                ? { marker: m?.key ?? null, name: m?.label ?? row.name, value, unit: row.unit, low: parseDecimal(row.low), high: parseDecimal(row.high) }
                : null;
            const status = preview ? statusOf(preview, sex) : null;
            const range = m ? rangeText(rangeOf({ marker: m.key, name: m.label, value: 0, unit: row.unit, low: null, high: null }, sex)) : null;
            return (
              <li key={row.key} className="grid gap-2 rounded-2xl border bg-card p-3">
                <div className="flex items-center gap-2">
                  <NativeSelect className="min-w-0 flex-1" value={row.marker} onChange={(e) => chooseMarker(row, e.target.value)} aria-label="Blutwert">
                    <option value="" disabled>
                      Blutwert wählen …
                    </option>
                    {MARKER_GROUPS.map((g) => (
                      <optgroup key={g} label={g}>
                        {MARKERS.filter((x) => x.group === g).map((x) => (
                          <option key={x.key} value={x.key}>
                            {x.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <option value={OWN}>Eigener Wert …</option>
                  </NativeSelect>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, rows: f.rows.filter((r) => r.key !== row.key) }))}
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    aria-label="Wert entfernen"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                {row.marker === OWN ? (
                  <Input value={row.name} maxLength={60} onChange={(e) => setRow(row.key, { name: e.target.value })} placeholder="Name, z. B. Homocystein" className="h-12 text-base" aria-label="Name des Werts" />
                ) : null}
                <div className="flex gap-2">
                  <Input inputMode="decimal" value={row.value} onChange={(e) => setRow(row.key, { value: e.target.value })} placeholder="Ergebnis" className="h-11 min-w-0 flex-1 text-base tabular-nums" aria-label="Ergebnis" />
                  <Input value={row.unit} maxLength={20} onChange={(e) => setRow(row.key, { unit: e.target.value })} placeholder="Einheit" className="h-11 w-28 text-base" aria-label="Einheit" />
                </div>
                {row.showRange ? (
                  <div className="flex items-center gap-2">
                    <Input inputMode="decimal" value={row.low} onChange={(e) => setRow(row.key, { low: e.target.value })} placeholder="von" className="h-11 min-w-0 flex-1 text-base tabular-nums" aria-label="Referenzbereich von" />
                    <span className="text-muted-foreground">–</span>
                    <Input inputMode="decimal" value={row.high} onChange={(e) => setRow(row.key, { high: e.target.value })} placeholder="bis" className="h-11 min-w-0 flex-1 text-base tabular-nums" aria-label="Referenzbereich bis" />
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {status && status !== "unbekannt" ? <ToneBadge tone={statusTone(status)}>{STATUS_LABEL[status]}</ToneBadge> : null}
                  {!row.showRange && range ? <span>Üblich {range} {row.unit}</span> : null}
                  {m && m.unit !== row.unit && row.unit && !row.showRange ? <span>Andere Einheit als üblich ({m.unit}): Bereich vom Befund eintragen.</span> : null}
                  {!row.showRange ? (
                    <button type="button" onClick={() => setRow(row.key, { showRange: true })} className="min-h-8 font-medium text-primary underline-offset-4 hover:underline">
                      Bereich vom Befund
                    </button>
                  ) : null}
                </div>
                {m?.hint ? <p className="text-xs text-muted-foreground">{m.hint}</p> : null}
                {err(`row-${row.key}`) ? <p className="text-sm text-destructive">{err(`row-${row.key}`)}</p> : null}
              </li>
            );
          })}
        </ul>
        <Button type="button" variant="outline" className="mt-3 h-11 w-full rounded-full" onClick={() => setForm((f) => ({ ...f, rows: [...f.rows, rowFrom(null)] }))}>
          <Plus aria-hidden />
          Wert hinzufügen
        </Button>
        {err("values") ? <p className="mt-1 text-sm text-destructive">{err("values")}</p> : null}
      </div>

      <Field id="blood-note" label="Notiz · optional" error={err("note")}>
        <Textarea id="blood-note" value={form.note} maxLength={500} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="z. B. nüchtern, zwei Tage nach dem Training" className="min-h-20" />
      </Field>
    </EditorSheet>
  );
}
