"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteMedicationAction, saveMedicationAction } from "@/app/(app)/sport/medizin/actions";
import { choiceChipClass, EditorSheet, FieldHeading } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { MedicationIntake, MedicationSummary, SickEpisode } from "@/lib/domain/medical";
import { Field, shortDate } from "./health-parts";

export type MedicationDraft = Partial<Pick<MedicationIntake, "name" | "dose" | "reason" | "episodeId">>;

type Form = { name: string; dose: string; date: string; time: string; reason: string; episodeId: string; note: string };

/**
 * Einnahme eintragen oder ändern: Medikament (Vorschläge aus dem Verlauf), Dosis, wann, warum, optional zu welcher
 * Krankheit, Notiz.
 */
export function MedicationSheet({
  intake,
  draft,
  summaries,
  episodes,
  today,
  now,
  onClose,
}: {
  intake: MedicationIntake | null;
  /** Vorbelegung für eine neue Einnahme („Nochmal genommen“) */
  draft: MedicationDraft | null;
  summaries: MedicationSummary[];
  episodes: SickEpisode[];
  today: string;
  now: string;
  onClose: () => void;
}) {
  const running = episodes.find((e) => e.end == null) ?? null;
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState<Form>(() => ({
    name: intake?.name ?? draft?.name ?? "",
    dose: intake?.dose ?? draft?.dose ?? "",
    date: intake?.date ?? today,
    time: intake ? (intake.time ?? "") : now,
    reason: intake?.reason ?? draft?.reason ?? "",
    episodeId: intake ? (intake.episodeId ?? "") : (draft?.episodeId ?? running?.id ?? ""),
    note: intake?.note ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const err = (key: string) => errors[key]?.[0];
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const reasons = [...new Set(summaries.flatMap((s) => s.reasons))].slice(0, 30);
  // Krankheiten zur Auswahl: laufende und die der letzten Zeit (plus die schon verknüpfte)
  const episodeOptions = episodes.filter((e, i) => i < 12 || e.id === form.episodeId);

  function close() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function pick(s: MedicationSummary) {
    setForm((f) => ({ ...f, name: s.name, dose: s.lastDose ?? f.dose, reason: s.lastReason ?? f.reason }));
  }

  function save() {
    startTransition(async () => {
      const result = await saveMedicationAction(intake?.id ?? null, {
        name: form.name,
        dose: form.dose || null,
        date: form.date,
        time: form.time || null,
        reason: form.reason || null,
        episodeId: form.episodeId || null,
        note: form.note || null,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? "Bitte prüfe die Eingaben.");
        return;
      }
      toast.success(intake ? "Einnahme gespeichert" : `${form.name.trim()} eingetragen`);
      close();
    });
  }

  function remove() {
    if (!intake) return;
    startTransition(async () => {
      const result = await deleteMedicationAction(intake.id);
      if (!result.ok) {
        toast.error(result.message ?? "Löschen ging nicht.");
        return;
      }
      toast.success("Einnahme gelöscht");
      close();
    });
  }

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title={intake ? "Einnahme bearbeiten" : "Medikament genommen"}
      description="Was, wie viel, wann und warum."
      footer={
        <>
          {intake ? (
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
              <Button type="button" variant="outline" size="icon-lg" onClick={() => setConfirmDelete(true)} aria-label="Einnahme löschen">
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
      {!intake && summaries.length ? (
        <div>
          <FieldHeading>Schon mal genommen</FieldHeading>
          <div className="flex flex-wrap gap-2">
            {summaries.slice(0, 8).map((s) => (
              <button key={s.name} type="button" onClick={() => pick(s)} className={choiceChipClass(form.name.trim().toLowerCase() === s.name.toLowerCase())}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        <Field id="med-name" label="Medikament" error={err("name")}>
          <Input id="med-name" list="med-names" value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} placeholder="z. B. Ibuprofen" className="h-12 text-base" aria-invalid={Boolean(err("name"))} />
          <datalist id="med-names">
            {summaries.map((s) => (
              <option key={s.name} value={s.name} />
            ))}
          </datalist>
        </Field>
        <Field id="med-dose" label="Dosis · optional" error={err("dose")}>
          <Input id="med-dose" value={form.dose} maxLength={40} onChange={(e) => set("dose", e.target.value)} placeholder="z. B. 400 mg, 1 Tablette" className="h-12 text-base" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="med-date" label="Datum" error={err("date")}>
            <Input id="med-date" type="date" max={today} value={form.date} onChange={(e) => set("date", e.target.value)} className="h-12 text-base" />
          </Field>
          <Field id="med-time" label="Uhrzeit · optional" error={err("time")}>
            <Input id="med-time" type="time" value={form.time} onChange={(e) => set("time", e.target.value)} className="h-12 text-base" />
          </Field>
        </div>
        <Field id="med-reason" label="Warum?" error={err("reason")}>
          <Input id="med-reason" list="med-reasons" value={form.reason} maxLength={120} onChange={(e) => set("reason", e.target.value)} placeholder="z. B. Kopfschmerzen" className="h-12 text-base" />
          <datalist id="med-reasons">
            {reasons.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        {episodeOptions.length ? (
          <Field id="med-episode" label="Gehört zu Krankheit/Beschwerde · optional">
            <NativeSelect id="med-episode" value={form.episodeId} onChange={(e) => set("episodeId", e.target.value)}>
              <option value="">Keine</option>
              {episodeOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} ({e.end == null ? `seit ${shortDate(e.start)}` : e.start === e.end ? shortDate(e.start) : `${shortDate(e.start)}–${shortDate(e.end)}`})
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
      </div>

      <Field id="med-note" label="Notiz · optional" error={err("note")}>
        <Textarea id="med-note" value={form.note} maxLength={300} onChange={(e) => set("note", e.target.value)} placeholder="z. B. hat nach einer Stunde geholfen" className="min-h-20" />
      </Field>
    </EditorSheet>
  );
}
