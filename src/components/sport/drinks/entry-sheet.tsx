"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addDrinkEntryAction, deleteDrinkEntryAction, updateDrinkEntryAction } from "@/app/(app)/sport/getraenke/actions";
import { EditorSheet, FieldHeading } from "@/components/recipes/editor/editor-parts";
import { chipClass } from "@/components/recipes/chip-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clock, formatLiters, longDate, QUICK_AMOUNTS, quickLabel, type Drink, type DrinkEntry } from "@/lib/domain/drinks";
import { berlinParts } from "@/lib/domain/workout";
import { DrinkChip } from "./drink-parts";

/** Was das Sheet zeigt: neuen Eintrag (für einen Tag, mit vorgewähltem Getränk) oder einen bestehenden ändern. */
export type EntrySheetState = { mode: "add"; date: string; drinkId: string | null } | { mode: "edit"; entry: DrinkEntry } | null;

type Form = { drinkId: string; ml: string; date: string; time: string };

function initialForm(state: NonNullable<EntrySheetState>, drinks: Drink[], today: string): Form {
  if (state.mode === "edit") {
    const e = state.entry;
    return { drinkId: e.drinkId ?? "", ml: String(e.ml), date: e.date, time: clock(e.minutes) };
  }
  const now = berlinParts(new Date().toISOString());
  // Für frühere Tage 12 Uhr vorschlagen, heute die aktuelle Uhrzeit
  return { drinkId: state.drinkId ?? drinks[0]?.id ?? "", ml: "250", date: state.date, time: state.date === today ? now.time : "12:00" };
}

/**
 * „Andere Menge / Zeit“, „Für diesen Tag nachtragen“ und Eintrag bearbeiten: Getränk, Menge, Datum, Uhrzeit.
 * Gespeichert wird per Server-Aktion; die Seite lädt danach neu (revalidate).
 */
export function EntrySheet({ state, onClose, drinks, today }: { state: EntrySheetState; onClose: () => void; drinks: Drink[]; today: string }) {
  return state ? <EntrySheetInner key={state.mode === "edit" ? state.entry.id : `add-${state.date}`} state={state} onClose={onClose} drinks={drinks} today={today} /> : null;
}

function EntrySheetInner({ state, onClose, drinks, today }: { state: NonNullable<EntrySheetState>; onClose: () => void; drinks: Drink[]; today: string }) {
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState<Form>(() => initialForm(state, drinks, today));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const edit = state.mode === "edit" ? state.entry : null;
  // Eintrag eines gelöschten Getränks: alter Name als eigene Auswahl
  const orphan = edit && !edit.drinkId ? edit : null;
  const ml = Number.parseInt(form.ml, 10);
  const valid = ml >= 1 && ml <= 5000 && (form.drinkId !== "" || orphan) && form.date && form.time;

  function close() {
    setOpen(false);
    // Animation des Sheets abwarten
    setTimeout(onClose, 300);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    startTransition(async () => {
      const input = { drinkId: form.drinkId || null, ml, date: form.date, time: form.time };
      const result = edit ? await updateDrinkEntryAction(edit.id, input) : await addDrinkEntryAction(input);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(edit ? "Eintrag gespeichert" : `${formatLiters(result.entry.ml)} ${result.entry.name} eingetragen`);
      close();
    });
  }

  function remove() {
    if (!edit) return;
    startTransition(async () => {
      const result = await deleteDrinkEntryAction(edit.id);
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
      title={edit ? "Eintrag bearbeiten" : form.date === today ? "Getränk eintragen" : "Nachtragen"}
      description={longDate(form.date || today)}
      footer={
        <form onSubmit={save} className="flex w-full gap-3">
          {edit ? (
            confirmDelete ? (
              <Button type="button" variant="destructive" onClick={remove} disabled={pending} className="h-12 flex-1">
                Wirklich löschen
              </Button>
            ) : (
              <Button type="button" variant="outline" size="icon-lg" onClick={() => setConfirmDelete(true)} aria-label="Eintrag löschen">
                <Trash2 aria-hidden />
              </Button>
            )
          ) : null}
          {!confirmDelete ? (
            <Button type="submit" size="lg" disabled={!valid || pending} className="flex-1">
              {edit ? "Speichern" : `${Number.isFinite(ml) ? formatLiters(ml) : ""} eintragen`}
            </Button>
          ) : (
            <Button type="button" variant="outline" size="lg" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
          )}
        </form>
      }
    >
      <section>
        <FieldHeading>Getränk</FieldHeading>
        <div className="flex flex-wrap gap-2">
          {orphan ? <DrinkChip name={`${orphan.name} (gelöscht)`} color={orphan.color} active={form.drinkId === ""} onClick={() => setForm((f) => ({ ...f, drinkId: "" }))} /> : null}
          {drinks.map((d) => (
            <DrinkChip key={d.id} name={d.name} color={d.color} active={form.drinkId === d.id} onClick={() => setForm((f) => ({ ...f, drinkId: d.id }))} />
          ))}
        </div>
      </section>

      <section>
        <FieldHeading htmlFor="entry-ml">Menge in ml</FieldHeading>
        <Input
          id="entry-ml"
          inputMode="numeric"
          value={form.ml}
          onChange={(e) => setForm((f) => ({ ...f, ml: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
          className="h-12 text-base tabular-nums"
          aria-invalid={form.ml !== "" && !(ml >= 1 && ml <= 5000)}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((q) => (
            <button key={q.ml} type="button" aria-pressed={ml === q.ml} onClick={() => setForm((f) => ({ ...f, ml: String(q.ml) }))} className={chipClass(ml === q.ml)}>
              {quickLabel(q.ml)} l
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="entry-date">Datum</Label>
          <Input id="entry-date" type="date" required max={today} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="h-12 px-3 text-base" />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="entry-time">Uhrzeit</Label>
          <Input id="entry-time" type="time" required value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} className="h-12 px-3 text-base" />
        </div>
      </section>
    </EditorSheet>
  );
}
