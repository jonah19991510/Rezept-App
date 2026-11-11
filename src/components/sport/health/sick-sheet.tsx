"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteSickEpisodeAction, saveSickEpisodeAction } from "@/app/(app)/sport/medizin/actions";
import { chipClass } from "@/components/recipes/chip-select";
import { choiceChipClass, EditorSheet, FieldHeading } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import { feverLevel, SICK_TITLES, sortTemperatures, SYMPTOMS, type SickEpisode, type Temperature } from "@/lib/domain/medical";
import { Field } from "./health-parts";

type TempRow = { key: number; date: string; time: string; celsius: string };
type Form = { title: string; start: string; end: string; ongoing: boolean; symptoms: string[]; sickNote: boolean; temps: TempRow[]; note: string };

let nextKey = 1;

/**
 * Krankheit eintragen oder ändern: was (Vorschläge), von–bis oder „noch krank“, Symptome, krankgeschrieben, Fieber-
 * messungen (Datum, Uhrzeit, °C), Notiz.
 */
export function SickSheet({ episode, today, now, onClose }: { episode: SickEpisode | null; today: string; now: string; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState<Form>(() => ({
    title: episode?.title ?? "",
    start: episode?.start ?? today,
    end: episode?.end ?? today,
    ongoing: episode ? episode.end == null : true,
    symptoms: episode?.symptoms ?? [],
    sickNote: episode?.sickNote ?? false,
    temps: (episode?.temperatures ?? []).map((t) => ({ key: nextKey++, date: t.date, time: t.time ?? "", celsius: formatDecimalInput(t.celsius, 1) })),
    note: episode?.note ?? "",
  }));
  const [custom, setCustom] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const err = (key: string) => errors[key]?.[0];
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const symptomOptions = [...SYMPTOMS, ...form.symptoms.filter((s) => !(SYMPTOMS as readonly string[]).includes(s))];

  function close() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function toggleSymptom(s: string) {
    set("symptoms", form.symptoms.includes(s) ? form.symptoms.filter((x) => x !== s) : [...form.symptoms, s]);
  }

  function addCustom() {
    const s = custom.trim().slice(0, 40);
    if (!s) return;
    if (!form.symptoms.some((x) => x.toLowerCase() === s.toLowerCase())) set("symptoms", [...form.symptoms, s]);
    setCustom("");
  }

  function save() {
    const temperatures: Temperature[] = [];
    for (const t of form.temps) {
      if (!t.celsius.trim()) continue;
      const celsius = parseDecimal(t.celsius);
      if (celsius == null || celsius < 34 || celsius > 43) {
        setErrors({ temps: ["Temperatur zwischen 34 und 43 °C eintragen."] });
        toast.error("Bitte die Temperatur prüfen.");
        return;
      }
      temperatures.push({ date: t.date, time: t.time || null, celsius });
    }
    startTransition(async () => {
      const result = await saveSickEpisodeAction(episode?.id ?? null, {
        title: form.title,
        start: form.start,
        end: form.ongoing ? null : form.end,
        symptoms: form.symptoms,
        sickNote: form.sickNote,
        temperatures: sortTemperatures(temperatures),
        note: form.note || null,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? "Bitte prüfe die Eingaben.");
        return;
      }
      toast.success(episode ? "Gespeichert" : "Gute Besserung!");
      close();
    });
  }

  function remove() {
    if (!episode) return;
    startTransition(async () => {
      const result = await deleteSickEpisodeAction(episode.id);
      if (!result.ok) {
        toast.error(result.message ?? "Löschen ging nicht.");
        return;
      }
      toast.success("Eintrag gelöscht");
      close();
    });
  }

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title={episode ? "Krankheit bearbeiten" : "Krank eintragen"}
      description="Von wann bis wann, was du hattest und wie hoch das Fieber war."
      footer={
        <>
          {episode ? (
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
              <Button type="button" variant="outline" size="icon-lg" onClick={() => setConfirmDelete(true)} aria-label="Eintrag löschen">
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
        <Field id="sick-title" label="Was hattest du?" error={err("title")}>
          <Input id="sick-title" value={form.title} maxLength={60} onChange={(e) => set("title", e.target.value)} placeholder="z. B. Erkältung" className="h-12 text-base" aria-invalid={Boolean(err("title"))} />
        </Field>
        <div className="mt-2 flex flex-wrap gap-2">
          {SICK_TITLES.map((t) => (
            <button key={t} type="button" onClick={() => set("title", t)} className={choiceChipClass(form.title === t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field id="sick-start" label="Krank seit" error={err("start")}>
            <Input id="sick-start" type="date" max={today} value={form.start} onChange={(e) => set("start", e.target.value)} className="h-12 text-base" />
          </Field>
          <Field id="sick-end" label="Wieder gesund" error={err("end")}>
            <Input id="sick-end" type="date" min={form.start} max={today} value={form.ongoing ? "" : form.end} disabled={form.ongoing} onChange={(e) => set("end", e.target.value)} className="h-12 text-base" />
          </Field>
        </div>
        <label className="flex min-h-12 items-center justify-between gap-4 rounded-2xl border bg-card px-4 py-2">
          <span className="font-medium">Noch krank</span>
          <Switch checked={form.ongoing} onCheckedChange={(v) => setForm((f) => ({ ...f, ongoing: v, end: v ? f.end : f.end < f.start ? f.start : f.end }))} />
        </label>
        <label className="flex min-h-12 items-center justify-between gap-4 rounded-2xl border bg-card px-4 py-2">
          <span>
            <span className="block font-medium">Krankgeschrieben</span>
            <span className="block text-sm text-muted-foreground">Arbeitsunfähigkeitsbescheinigung</span>
          </span>
          <Switch checked={form.sickNote} onCheckedChange={(v) => set("sickNote", v)} />
        </label>
      </div>

      <div>
        <FieldHeading aside={form.symptoms.length ? `${form.symptoms.length} gewählt` : undefined}>Symptome</FieldHeading>
        <div className="flex flex-wrap gap-2">
          {symptomOptions.map((s) => {
            const on = form.symptoms.includes(s);
            return (
              <button key={s} type="button" aria-pressed={on} onClick={() => toggleSymptom(s)} className={chipClass(on)}>
                {on ? <Check aria-hidden /> : null}
                {s}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={custom}
            maxLength={40}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Anderes Symptom"
            className="h-11 text-base"
            aria-label="Anderes Symptom"
          />
          <Button type="button" variant="outline" className="h-11 rounded-full" onClick={addCustom} disabled={!custom.trim()}>
            Hinzufügen
          </Button>
        </div>
      </div>

      <div>
        <FieldHeading aside="ab 38,0 °C Fieber">Fieber messen</FieldHeading>
        {form.temps.length ? (
          <ul className="mb-3 grid gap-2">
            {form.temps.map((t) => {
              const c = parseDecimal(t.celsius);
              const level = c != null ? feverLevel(c) : null;
              return (
                <li key={t.key} className="flex items-center gap-2">
                  <Input type="date" value={t.date} max={today} onChange={(e) => set("temps", form.temps.map((x) => (x.key === t.key ? { ...x, date: e.target.value } : x)))} className="h-11 min-w-0 flex-[1.4] text-base" aria-label="Datum der Messung" />
                  <Input type="time" value={t.time} onChange={(e) => set("temps", form.temps.map((x) => (x.key === t.key ? { ...x, time: e.target.value } : x)))} className="h-11 min-w-0 flex-1 text-base" aria-label="Uhrzeit der Messung" />
                  <div className="relative min-w-0 flex-1">
                    <Input
                      inputMode="decimal"
                      value={t.celsius}
                      onChange={(e) => set("temps", form.temps.map((x) => (x.key === t.key ? { ...x, celsius: e.target.value } : x)))}
                      placeholder="38,2"
                      className={`h-11 pr-8 text-base tabular-nums ${level === "fieber" ? "text-destructive" : level === "erhoeht" ? "text-amber-700 dark:text-amber-300" : ""}`}
                      aria-label="Temperatur in Grad Celsius"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">°C</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => set("temps", form.temps.filter((x) => x.key !== t.key))}
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Messung entfernen"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <Button type="button" variant="outline" className="h-11 w-full rounded-full" onClick={() => set("temps", [...form.temps, { key: nextKey++, date: today, time: now, celsius: "" }])}>
          <Plus aria-hidden />
          Messung hinzufügen
        </Button>
        {err("temps") ? <p className="mt-1 text-sm text-destructive">{err("temps")}</p> : null}
      </div>

      <Field id="sick-note" label="Notiz · optional" error={err("note")}>
        <Textarea id="sick-note" value={form.note} maxLength={500} onChange={(e) => set("note", e.target.value)} placeholder="z. B. Arzt war, Antibiotikum bekommen" className="min-h-20" />
      </Field>
    </EditorSheet>
  );
}
