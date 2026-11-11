"use client";

import { useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { addCheckupVisitAction, deleteCheckupAction, deleteCheckupVisitAction, saveCheckupAction } from "@/app/(app)/sport/medizin/actions";
import { choiceChipClass, EditorSheet, FieldHeading } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addMonths, CHECKUP_PRESETS, type Checkup } from "@/lib/domain/medical";
import { Field, longDate, UnitInput } from "./health-parts";

type Form = { name: string; doctor: string; interval: string; nextOn: string; note: string };

/**
 * Vorsorge anlegen oder bearbeiten: Name (Vorschläge mit üblichem Rhythmus), Praxis, Rhythmus in Monaten, fest
 * ausgemachter nächster Termin, Notiz; darunter die bisherigen Besuche (löschbar).
 */
export function CheckupSheet({ checkup, onClose }: { checkup: Checkup | null; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState<Form>(() => ({
    name: checkup?.name ?? "",
    doctor: checkup?.doctor ?? "",
    interval: checkup?.intervalMonths != null ? String(checkup.intervalMonths) : "",
    nextOn: checkup?.nextOn ?? "",
    note: checkup?.note ?? "",
  }));
  const [visits, setVisits] = useState(checkup?.visits ?? []);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const err = (key: string) => errors[key]?.[0];
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  function close() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function save() {
    const interval = form.interval.trim() === "" ? null : Number(form.interval);
    if (interval != null && (!Number.isInteger(interval) || interval < 1)) {
      setErrors({ intervalMonths: ["Bitte ganze Monate eintragen."] });
      return;
    }
    startTransition(async () => {
      const result = await saveCheckupAction(checkup?.id ?? null, {
        name: form.name,
        doctor: form.doctor || null,
        intervalMonths: interval,
        nextOn: form.nextOn || null,
        note: form.note || null,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? "Bitte prüfe die Eingaben.");
        return;
      }
      toast.success(checkup ? "Vorsorge gespeichert" : "Vorsorge angelegt");
      close();
    });
  }

  function remove() {
    if (!checkup) return;
    startTransition(async () => {
      const result = await deleteCheckupAction(checkup.id);
      if (!result.ok) {
        toast.error(result.message ?? "Löschen ging nicht.");
        return;
      }
      toast.success("Vorsorge gelöscht");
      close();
    });
  }

  function removeVisit(id: string) {
    startTransition(async () => {
      const result = await deleteCheckupVisitAction(id);
      if (!result.ok) {
        toast.error(result.message ?? "Löschen ging nicht.");
        return;
      }
      setVisits((v) => v.filter((x) => x.id !== id));
      toast.success("Besuch gelöscht");
    });
  }

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title={checkup ? checkup.name : "Neue Vorsorge"}
      description="Rhythmus und/oder fest ausgemachter Termin – die App erinnert dich in der Übersicht."
      footer={
        <>
          {checkup ? (
            confirmDelete ? (
              <>
                <Button type="button" variant="destructive" size="lg" onClick={remove} disabled={pending} className="flex-1">
                  Mit Besuchen löschen
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => setConfirmDelete(false)}>
                  Abbrechen
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" size="icon-lg" onClick={() => setConfirmDelete(true)} aria-label="Vorsorge löschen">
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
      <div>
        <Field id="checkup-name" label="Untersuchung" error={err("name")}>
          <Input id="checkup-name" value={form.name} maxLength={60} onChange={(e) => set("name", e.target.value)} placeholder="z. B. Zahnarzt-Kontrolle" className="h-12 text-base" aria-invalid={Boolean(err("name"))} />
        </Field>
        {!checkup ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {CHECKUP_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setForm((f) => ({ ...f, name: p.name, interval: p.months != null ? String(p.months) : f.interval }))}
                className={choiceChipClass(form.name === p.name)}
                title={p.hint}
              >
                {p.name}
              </button>
            ))}
          </div>
        ) : null}
        {CHECKUP_PRESETS.find((p) => p.name === form.name) ? <p className="mt-2 text-xs text-muted-foreground">Üblich: {CHECKUP_PRESETS.find((p) => p.name === form.name)!.hint}</p> : null}
      </div>

      <Field id="checkup-doctor" label="Praxis/Ärztin/Arzt · optional" error={err("doctor")}>
        <Input id="checkup-doctor" value={form.doctor} maxLength={80} onChange={(e) => set("doctor", e.target.value)} placeholder="z. B. Dr. Muster, Hauptstraße" className="h-12 text-base" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id="checkup-interval" label="Alle … Monate" error={err("intervalMonths")}>
          <UnitInput id="checkup-interval" unit="Mon." inputMode="numeric" value={form.interval} onChange={(e) => set("interval", e.target.value.replace(/\D/g, ""))} placeholder="z. B. 6" />
        </Field>
        <Field id="checkup-next" label="Nächster Termin" error={err("nextOn")}>
          <Input id="checkup-next" type="date" value={form.nextOn} onChange={(e) => set("nextOn", e.target.value)} className="h-12 text-base" />
        </Field>
      </div>

      <Field id="checkup-note" label="Notiz · optional" error={err("note")}>
        <Textarea id="checkup-note" value={form.note} maxLength={500} onChange={(e) => set("note", e.target.value)} placeholder="z. B. Bonusheft mitnehmen" className="min-h-20" />
      </Field>

      {checkup && visits.length ? (
        <div>
          <FieldHeading aside={`${visits.length}×`}>Bisherige Besuche</FieldHeading>
          <ul className="divide-y rounded-2xl border bg-card">
            {visits.map((v) => (
              <li key={v.id} className="flex items-center gap-3 py-1 pr-1 pl-4">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{longDate(v.date)}</span>
                  {v.note ? <span className="block text-sm text-muted-foreground">{v.note}</span> : null}
                </span>
                <button
                  type="button"
                  onClick={() => removeVisit(v.id)}
                  disabled={pending}
                  className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Besuch vom ${longDate(v.date)} löschen`}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </EditorSheet>
  );
}

/** „War beim Termin“: Datum, Notiz und optional gleich den nächsten Termin (Vorschlag aus dem Rhythmus). */
export function VisitSheet({ checkup, today, onClose }: { checkup: Checkup; today: string; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [date, setDate] = useState(checkup.nextOn && checkup.nextOn <= today ? checkup.nextOn : today);
  const [note, setNote] = useState("");
  const [nextOn, setNextOn] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const suggested = checkup.intervalMonths ? addMonths(date || today, checkup.intervalMonths) : null;

  function close() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function save() {
    startTransition(async () => {
      const result = await addCheckupVisitAction(checkup.id, { date, note: note || null }, nextOn || null);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? "Bitte prüfe die Eingaben.");
        return;
      }
      toast.success(`${checkup.name} eingetragen`);
      close();
    });
  }

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title="War beim Termin"
      description={checkup.name}
      footer={
        <Button type="button" size="lg" onClick={save} disabled={pending} className="flex-1">
          Speichern
        </Button>
      }
    >
      <Field id="visit-date" label="Wann?" error={errors.date?.[0]}>
        <Input id="visit-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} className="h-12 text-base" />
      </Field>
      <Field id="visit-note" label="Notiz · optional" error={errors.note?.[0]}>
        <Input id="visit-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="z. B. alles gut, eine Füllung" className="h-12 text-base" />
      </Field>
      <div>
        <Field id="visit-next" label="Nächster Termin schon ausgemacht? · optional" error={errors.nextOn?.[0]}>
          <Input id="visit-next" type="date" min={date} value={nextOn} onChange={(e) => setNextOn(e.target.value)} className="h-12 text-base" />
        </Field>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {suggested ? `Ohne Termin rechnet die App mit dem Rhythmus: wieder fällig am ${longDate(suggested)}.` : "Ohne Rhythmus und Termin bleibt die nächste Untersuchung offen."}
        </p>
      </div>
    </EditorSheet>
  );
}
