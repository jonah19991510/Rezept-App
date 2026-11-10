"use client";

import { useState, useTransition } from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteScheduleAction, reorderScheduleAction, saveScheduleAction } from "@/app/(app)/sport/habits/actions";
import { TagLabel } from "@/components/layout/list-blocks";
import { chipClass } from "@/components/recipes/chip-select";
import { EditorSheet, FieldHeading } from "@/components/recipes/editor/editor-parts";
import { announcements, screenReaderInstructions, SortableRow, useEditorSensors, verticalOnly } from "@/components/recipes/editor/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  categoryOf,
  DAYTIMES,
  daytimeOfTime,
  formatDuration,
  SCHEDULE_CATEGORIES,
  SCHEDULE_PRESETS,
  scheduleSummary,
  slotLabel,
  sortSchedule,
  WEEKDAYS,
  type Daytime,
  type ScheduleCategory,
  type ScheduleEntry,
} from "@/lib/domain/habits";
import { cn } from "@/lib/utils";

const DURATIONS = [15, 30, 45, 60, 90];

type Editing = { entry: ScheduleEntry | null; weekday: number };

/**
 * Tab „Wochenplan“: wiederkehrende Trainingswoche (z. B. morgens Gym, abends Dehnen/Mobility). Am Handy ein Tag unter
 * dem anderen, am Desktop sieben Spalten. Antippen bearbeitet, „+“ legt für den Tag an (auch für mehrere Tage), am
 * Griff ziehen ändert die Reihenfolge innerhalb des Tages (gespeichert beim Ablegen).
 */
export function WeekSchedule({ entries, todayWeekday }: { entries: ScheduleEntry[]; todayWeekday: number }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  // Reihenfolge lokal (sofort sichtbar); neue Daten vom Server übernehmen
  const [local, setLocal] = useState(entries);
  const [source, setSource] = useState(entries);
  if (entries !== source) {
    setSource(entries);
    setLocal(entries);
  }
  const sensors = useEditorSensors();
  const [, startTransition] = useTransition();
  const sorted = sortSchedule(local);
  const summary = scheduleSummary(entries);

  /** Verschieben innerhalb eines Tages: Positionen 0, 1, 2 … in neuer Reihenfolge. */
  const onDragEnd = (day: ScheduleEntry[]) => ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = day.map((e) => e.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    const before = local;
    setLocal(local.map((e) => (next.includes(e.id) ? { ...e, position: next.indexOf(e.id) } : e)));
    startTransition(async () => {
      const result = await reorderScheduleAction(next);
      if (!result.ok) {
        setLocal(before);
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-card p-4" aria-label="Übersicht der Woche">
        {summary.count === 0 ? (
          <p className="text-sm text-muted-foreground">Plane deine Trainingswoche: was du an welchem Tag und zu welcher Tageszeit machst. Sie gilt jede Woche, bis du sie änderst.</p>
        ) : (
          <>
            <p className="tabular-nums">
              <span className="font-heading text-2xl font-semibold">{summary.count}</span>{" "}
              <span className="text-muted-foreground">
                {summary.count === 1 ? "Einheit" : "Einheiten"} an {summary.days === 1 ? "1 Tag" : `${summary.days} Tagen`}
                {summary.minutes > 0 ? ` · ${formatDuration(summary.minutes)}` : ""}
              </span>
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              {summary.byCategory.map((c) => (
                <li key={c.key} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
                  {c.label}
                  <span className="text-muted-foreground tabular-nums">
                    {c.count}×{c.minutes ? ` · ${formatDuration(c.minutes)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="grid gap-3 xl:grid-cols-7 xl:gap-2">
        {WEEKDAYS.map((w) => {
          const day = sorted.filter((e) => e.weekday === w.n);
          const isToday = w.n === todayWeekday;
          return (
            <section key={w.n} className={cn("rounded-3xl border bg-card p-3 xl:min-h-48", isToday && "border-primary/50 ring-1 ring-primary/30")} aria-label={w.long}>
              <div className="mb-1 flex items-center justify-between gap-2 pl-1">
                <h2 className="flex items-center gap-2 font-semibold">
                  <span className="xl:hidden">{w.long}</span>
                  <span className="hidden xl:inline">{w.short}</span>
                  {isToday ? <TagLabel>Heute</TagLabel> : null}
                  {day.length === 0 ? <span className="text-sm font-normal text-muted-foreground xl:hidden">Ruhetag</span> : null}
                </h2>
                <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => setEditing({ entry: null, weekday: w.n })} aria-label={`Training am ${w.long} hinzufügen`}>
                  <Plus aria-hidden />
                </Button>
              </div>
              {day.length === 0 ? (
                <p className="hidden px-1 pb-1 text-sm text-muted-foreground xl:block">Ruhetag</p>
              ) : (
                <DndContext
                  id={`schedule-dnd-${w.n}`}
                  collisionDetection={closestCenter}
                  sensors={sensors}
                  modifiers={[verticalOnly]}
                  onDragEnd={onDragEnd(day)}
                  accessibility={{ announcements: announcements((id) => day.find((e) => e.id === id)?.title ?? "Einheit"), screenReaderInstructions }}
                >
                  <SortableContext items={day.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                    <ul className="space-y-1.5">
                      {day.map((e) => {
                        const c = categoryOf(e.category);
                        const slot = slotLabel(e);
                        return (
                          <SortableRow
                            key={e.id}
                            id={e.id}
                            handleLabel={`${e.title} verschieben`}
                            className="rounded-2xl [&>button:first-child]:w-8 xl:[&>button:first-child]:w-6"
                          >
                            <button
                              type="button"
                              onClick={() => setEditing({ entry: e, weekday: e.weekday })}
                              className="flex min-h-12 min-w-0 flex-1 items-stretch gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                              style={{ background: `color-mix(in srgb, ${c.color} 10%, transparent)` }}
                            >
                              <span className="w-1 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                              <span className="min-w-0 flex-1">
                                {slot ? <span className="block text-xs font-medium text-muted-foreground tabular-nums">{slot}</span> : null}
                                <span className="block font-medium break-words hyphens-auto">{e.title}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {c.label}
                                  {e.durationMin ? ` · ${formatDuration(e.durationMin)}` : ""}
                                </span>
                                {e.notes ? <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{e.notes}</span> : null}
                              </span>
                            </button>
                          </SortableRow>
                        );
                      })}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}
            </section>
          );
        })}
      </div>

      {editing ? <ScheduleSheet key={editing.entry?.id ?? `neu-${editing.weekday}`} entry={editing.entry} weekday={editing.weekday} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

type Form = { title: string; category: ScheduleCategory; weekdays: number[]; daytime: Daytime | null; atTime: string; duration: string; notes: string };

/** Einheit anlegen (für einen oder mehrere Tage) oder bearbeiten. */
function ScheduleSheet({ entry, weekday, onClose }: { entry: ScheduleEntry | null; weekday: number; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState<Form>(() =>
    entry
      ? {
          title: entry.title,
          category: entry.category,
          weekdays: [entry.weekday],
          daytime: entry.daytime,
          atTime: entry.atTime ?? "",
          duration: entry.durationMin ? String(entry.durationMin) : "",
          notes: entry.notes ?? "",
        }
      : { title: "", category: "kraft", weekdays: [weekday], daytime: null, atTime: "", duration: "", notes: "" },
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const err = (key: string) => errors[key]?.[0];
  const duration = form.duration ? Number.parseInt(form.duration, 10) : null;

  function close() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function toggleDay(n: number) {
    // Beim Bearbeiten genau ein Tag, beim Anlegen mehrere
    if (entry) patch({ weekdays: [n] });
    else patch({ weekdays: form.weekdays.includes(n) ? form.weekdays.filter((d) => d !== n) : [...form.weekdays, n] });
  }

  function save() {
    startTransition(async () => {
      const result = await saveScheduleAction(entry?.id ?? null, {
        weekdays: form.weekdays,
        daytime: form.daytime,
        atTime: form.atTime || null,
        title: form.title,
        category: form.category,
        durationMin: duration,
        notes: form.notes,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? "Bitte die markierten Felder prüfen.");
        return;
      }
      toast.success(entry ? "Gespeichert" : form.weekdays.length > 1 ? `${form.title.trim()} an ${form.weekdays.length} Tagen eingeplant` : `${form.title.trim()} eingeplant`);
      close();
    });
  }

  function remove() {
    if (!entry) return;
    startTransition(async () => {
      const result = await deleteScheduleAction(entry.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`${entry.title} entfernt`);
      close();
    });
  }

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title={entry ? entry.title : "Training einplanen"}
      description={entry ? [WEEKDAYS[entry.weekday - 1].long, slotLabel(entry)].filter(Boolean).join(" · ") : "Gilt jede Woche."}
      footer={
        <>
          {entry ? (
            confirmDelete ? (
              <>
                <Button type="button" variant="destructive" size="lg" onClick={remove} disabled={pending} className="flex-1">
                  Wirklich entfernen
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => setConfirmDelete(false)}>
                  Abbrechen
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" size="icon-lg" onClick={() => setConfirmDelete(true)} aria-label="Entfernen">
                <Trash2 aria-hidden />
              </Button>
            )
          ) : null}
          {!confirmDelete ? (
            <Button type="button" size="lg" onClick={save} disabled={pending || form.title.trim() === "" || form.weekdays.length === 0} className="flex-1">
              Speichern
            </Button>
          ) : null}
        </>
      }
    >
      {!entry ? (
        <section>
          <FieldHeading>Vorschläge</FieldHeading>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SCHEDULE_PRESETS.map((p) => (
              <button key={p.title} type="button" aria-pressed={form.title === p.title} onClick={() => patch({ title: p.title, category: p.category })} className={chipClass(form.title === p.title)}>
                <span className="size-2.5 rounded-full" style={{ background: categoryOf(p.category).color }} aria-hidden />
                {p.title}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="schedule-title">Titel</Label>
        <Input id="schedule-title" value={form.title} maxLength={60} onChange={(e) => patch({ title: e.target.value })} className="h-12 text-base" placeholder="z. B. Gym – Oberkörper" aria-invalid={Boolean(err("title"))} />
        {err("title") ? <p className="text-sm text-destructive">{err("title")}</p> : null}
      </div>

      <section>
        <FieldHeading>Art</FieldHeading>
        <div className="flex flex-wrap gap-2">
          {SCHEDULE_CATEGORIES.map((c) => (
            <button key={c.key} type="button" aria-pressed={form.category === c.key} onClick={() => patch({ category: c.key })} className={chipClass(form.category === c.key)}>
              <span className="size-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <FieldHeading aside={entry ? undefined : "mehrere möglich"}>{entry ? "Tag" : "Tage"}</FieldHeading>
        <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Wochentage">
          {WEEKDAYS.map((w) => {
            const on = form.weekdays.includes(w.n);
            return (
              <button
                key={w.n}
                type="button"
                aria-pressed={on}
                aria-label={w.long}
                onClick={() => toggleDay(w.n)}
                className={cn(
                  "h-11 rounded-full border text-sm font-medium transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {w.short}
              </button>
            );
          })}
        </div>
        {err("weekdays") ? <p className="mt-2 text-sm text-destructive">{err("weekdays")}</p> : null}
      </section>

      <section>
        <FieldHeading aside="optional">Tageszeit</FieldHeading>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={form.daytime == null} onClick={() => patch({ daytime: null, atTime: "" })} className={chipClass(form.daytime == null)}>
            Keine
          </button>
          {DAYTIMES.map((d) => (
            <button
              key={d.key}
              type="button"
              aria-pressed={form.daytime === d.key}
              // erneut antippen nimmt die Tageszeit weg; andere Tageszeit als die Uhrzeit verwirft die Uhrzeit
              onClick={() =>
                form.daytime === d.key
                  ? patch({ daytime: null, atTime: "" })
                  : patch({ daytime: d.key, atTime: form.atTime && daytimeOfTime(form.atTime) !== d.key ? "" : form.atTime })
              }
              className={chipClass(form.daytime === d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Label htmlFor="schedule-time" className="w-20 shrink-0">
            Uhrzeit
          </Label>
          <Input
            id="schedule-time"
            type="time"
            value={form.atTime}
            onChange={(e) => patch(e.target.value ? { atTime: e.target.value, daytime: daytimeOfTime(e.target.value) } : { atTime: "" })}
            className="h-12 max-w-40 min-w-0 px-3 text-base"
          />
          {form.atTime ? (
            <Button type="button" variant="ghost" size="icon" onClick={() => patch({ atTime: "" })} aria-label="Uhrzeit entfernen">
              <X aria-hidden />
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">optional</span>
          )}
        </div>
      </section>

      <section>
        <FieldHeading htmlFor="schedule-duration" aside="optional">
          Dauer
        </FieldHeading>
        <div className="flex flex-wrap items-center gap-2">
          {DURATIONS.map((m) => (
            <button key={m} type="button" aria-pressed={duration === m} onClick={() => patch({ duration: duration === m ? "" : String(m) })} className={chipClass(duration === m)}>
              {formatDuration(m)}
            </button>
          ))}
          <span className="flex items-center gap-2">
            <Input
              id="schedule-duration"
              inputMode="numeric"
              value={form.duration}
              onChange={(e) => patch({ duration: e.target.value.replace(/\D/g, "").slice(0, 3) })}
              className="h-11 w-20 text-base tabular-nums"
              aria-invalid={Boolean(err("durationMin"))}
            />
            <span className="text-sm text-muted-foreground">min</span>
          </span>
        </div>
        {err("durationMin") ? <p className="mt-2 text-sm text-destructive">{err("durationMin")}</p> : null}
      </section>

      <div className="grid gap-1.5">
        <Label htmlFor="schedule-notes">Notizen</Label>
        <Textarea id="schedule-notes" value={form.notes} maxLength={500} onChange={(e) => patch({ notes: e.target.value })} className="min-h-20 text-base" placeholder="z. B. Push-Tag, Hüfte und Schultern" />
      </div>
    </EditorSheet>
  );
}
