"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { createPastIntervalWorkoutAction, createPastWorkoutAction } from "@/app/(app)/sport/training-actions";
import { chipClass } from "@/components/recipes/chip-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { buildPhases, clockLabel, DEFAULT_INTERVAL, INTERVAL_LIMITS, INTERVAL_PRESETS, normalizeSettings, totalSeconds } from "@/lib/domain/interval-timer";
import { berlinParts } from "@/lib/domain/workout";

type Plan = { id: string; title: string; days: { id: string; name: string; timedSeconds: (number | null)[] }[] };
type Mode = "training" | "interval";
type IntervalFields = { work: string; rest: string; rounds: string };

const NO_EXERCISES = "ohne";

/** Vorschlag beim Öffnen: Beginn vor einer Stunde, auf die Viertelstunde abgerundet (deutsche Zeit). */
function defaults() {
  const start = new Date(Date.now() - 60 * 60_000);
  start.setMinutes(start.getMinutes() - (start.getMinutes() % 15), 0, 0);
  return { ...berlinParts(start.toISOString()), minutes: "60" };
}

const fieldsOf = (s: { work: number; rest: number; rounds: number }): IntervalFields => ({ work: String(s.work), rest: String(s.rest), rounds: String(s.rounds) });

/** Zuletzt im Intervall-Timer benutzte Einstellungen des Plans (vom Gerät), sonst die Standardwerte. */
function storedInterval(planId: string | null): IntervalFields {
  if (!planId) return fieldsOf(DEFAULT_INTERVAL);
  try {
    const raw = window.localStorage.getItem(`intervall:${planId}`);
    return fieldsOf(normalizeSettings(raw ? (JSON.parse(raw) as { settings?: unknown }).settings : null));
  } catch {
    return fieldsOf(DEFAULT_INTERVAL);
  }
}

/** Eingabe im erlaubten Bereich, sonst null. */
function readField(value: string, key: keyof typeof INTERVAL_LIMITS): number | null {
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= INTERVAL_LIMITS[key].min && n <= INTERVAL_LIMITS[key].max ? n : null;
}

/**
 * „Training nachtragen“: normales Training (Datum, Beginn, Dauer, optional Plan-Tag; danach öffnet sich die
 * Bearbeiten-Ansicht für die Sätze) oder Intervall-Training (Belastung, Pause, Runden; die Dauer ergibt sich daraus,
 * gespeichert wird es gleich mit allen Runden).
 */
export function LogPastWorkout({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("training");
  const [form, setForm] = useState({ date: "", time: "", minutes: "60", planId: "", dayId: "" });
  const [intervalFields, setIntervalFields] = useState<IntervalFields>(fieldsOf(DEFAULT_INTERVAL));
  const [pending, startTransition] = useTransition();
  const plan = plans.find((p) => p.id === form.planId) ?? null;
  const day = plan?.days.find((d) => d.id === form.dayId) ?? null;

  const work = readField(intervalFields.work, "work");
  const rest = readField(intervalFields.rest, "rest");
  const rounds = readField(intervalFields.rounds, "rounds");
  const intervalSeconds =
    work != null && rest != null && rounds != null
      ? totalSeconds(buildPhases({ prepare: 0, work, rest, rounds }, (day?.timedSeconds ?? []).map((seconds) => ({ name: "", seconds }))))
      : null;

  function openDialog() {
    setForm({ ...defaults(), planId: "", dayId: "" });
    setIntervalFields(fieldsOf(DEFAULT_INTERVAL));
    setOpen(true);
  }

  function choosePlan(planId: string) {
    const next = plans.find((p) => p.id === planId);
    // Im Intervall-Modus erst einmal der erste Tag mit Übungen
    const firstDay = mode === "interval" ? (next?.days.find((d) => d.timedSeconds.length > 0) ?? next?.days[0]) : next?.days[0];
    setForm((f) => ({ ...f, planId, dayId: firstDay?.id ?? (mode === "interval" && next ? NO_EXERCISES : "") }));
    if (mode === "interval") setIntervalFields(storedInterval(next?.id ?? null));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "interval") {
      if (work == null || rest == null || rounds == null) {
        toast.error(
          `Belastung ${INTERVAL_LIMITS.work.min}–${INTERVAL_LIMITS.work.max} s, Pause ${INTERVAL_LIMITS.rest.min}–${INTERVAL_LIMITS.rest.max} s, Runden ${INTERVAL_LIMITS.rounds.min}–${INTERVAL_LIMITS.rounds.max}.`,
        );
        return;
      }
      startTransition(async () => {
        const result = await createPastIntervalWorkoutAction({
          planId: plan?.id ?? null,
          dayId: plan && day ? day.id : null,
          settings: { work, rest, rounds },
          date: form.date,
          time: form.time,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        router.push(`/sport/verlauf/${result.id}`);
      });
      return;
    }
    const durationMin = Number.parseInt(form.minutes, 10);
    if (!(durationMin >= 1 && durationMin <= 600)) {
      toast.error("Die Dauer muss zwischen 1 und 600 Minuten liegen.");
      return;
    }
    startTransition(async () => {
      const result = await createPastWorkoutAction({
        planId: plan?.id ?? null,
        dayId: plan ? form.dayId || plan.days[0]?.id || null : null,
        date: form.date,
        time: form.time,
        durationMin,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.push(`/training/${result.id}?bearbeiten=1`);
    });
  }

  const isInterval = mode === "interval";

  return (
    <>
      <Button type="button" variant="outline" onClick={openDialog} className="h-11 rounded-full px-4">
        <CalendarPlus aria-hidden />
        Nachtragen
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Training nachtragen</DialogTitle>
              <DialogDescription>
                {isInterval
                  ? "Wann hast du trainiert und mit welchem Intervall? Die Dauer ergibt sich aus Belastung, Pause und Runden."
                  : "Wann hast du trainiert? Die Übungen und Sätze trägst du im nächsten Schritt ein."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2" role="group" aria-label="Art">
              {(
                [
                  ["training", "Training"],
                  ["interval", "Intervall"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => {
                    setMode(value);
                    // Tag passend zur Art: „Ohne Übungen“ gibt es nur beim Intervall
                    setForm((f) => (value === "training" && f.dayId === NO_EXERCISES ? { ...f, dayId: plan?.days[0]?.id ?? "" } : f));
                    if (value === "interval") setIntervalFields(storedInterval(plan?.id ?? null));
                  }}
                  className={chipClass(mode === value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={isInterval ? "grid grid-cols-2 gap-2" : "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-2"}>
              <div className="grid gap-1.5">
                <Label htmlFor="past-date">Datum</Label>
                <Input
                  id="past-date"
                  type="date"
                  required
                  value={form.date}
                  max={berlinParts(new Date().toISOString()).date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="h-11 px-2 text-base"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="past-time">Beginn</Label>
                <Input id="past-time" type="time" required value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} className="h-11 px-2 text-base" />
              </div>
              {isInterval ? null : (
                <div className="grid gap-1.5">
                  <Label htmlFor="past-minutes">Minuten</Label>
                  <Input
                    id="past-minutes"
                    inputMode="numeric"
                    required
                    value={form.minutes}
                    onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                    className="h-11 px-2 text-center text-base tabular-nums"
                  />
                </div>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="past-plan">Plan</Label>
              <NativeSelect id="past-plan" value={form.planId} onChange={(e) => choosePlan(e.target.value)}>
                <option value="">{isInterval ? "Ohne Plan (ohne Übungen)" : "Ohne Plan (Übungen selbst wählen)"}</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id} disabled={!isInterval && p.days.length === 0}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {plan && (isInterval ? plan.days.length > 0 : plan.days.length > 1) ? (
              <div className="grid gap-1.5">
                <Label htmlFor="past-day">{isInterval ? "Übungen" : "Tag"}</Label>
                <NativeSelect id="past-day" value={form.dayId} onChange={(e) => setForm((f) => ({ ...f, dayId: e.target.value }))}>
                  {plan.days.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                  {isInterval ? <option value={NO_EXERCISES}>Ohne Übungen</option> : null}
                </NativeSelect>
              </div>
            ) : null}

            {isInterval ? (
              <>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Vorlagen">
                  {INTERVAL_PRESETS.map((p) => {
                    const on = work === p.work && rest === p.rest && rounds === p.rounds;
                    return (
                      <button key={p.label} type="button" aria-pressed={on} onClick={() => setIntervalFields(fieldsOf(p))} className={chipClass(on)}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["work", "Belastung (s)"],
                      ["rest", "Pause (s)"],
                      ["rounds", "Runden"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="grid gap-1.5">
                      <Label htmlFor={`past-${key}`}>{label}</Label>
                      <Input
                        id={`past-${key}`}
                        inputMode="numeric"
                        required
                        value={intervalFields[key]}
                        aria-invalid={readField(intervalFields[key], key) == null}
                        onChange={(e) => setIntervalFields((v) => ({ ...v, [key]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                        className="h-11 px-2 text-center text-base tabular-nums"
                      />
                    </div>
                  ))}
                </div>
                <p className="rounded-2xl bg-muted px-3 py-2 text-sm" aria-live="polite">
                  Dauer:{" "}
                  <span className="font-semibold tabular-nums">{intervalSeconds != null ? `${clockLabel(intervalSeconds)} Minuten` : "–"}</span>
                  {day && day.timedSeconds.some((s) => s != null) ? (
                    <span className="block text-xs text-muted-foreground">Übungen mit fester Zeit im Plan zählen mit dieser Zeit.</span>
                  ) : null}
                </p>
              </>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={pending}>
                {isInterval ? "Speichern" : "Weiter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
