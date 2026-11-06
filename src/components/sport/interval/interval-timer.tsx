"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Minus, Pause, Play, Plus, RotateCcw, SkipBack, SkipForward, Timer, Trophy, X } from "lucide-react";
import { useWakeLock } from "@/components/cooking/use-wake-lock";
import { chipClass } from "@/components/recipes/chip-select";
import { FieldHeading } from "@/components/recipes/editor/editor-parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildPhases,
  clockLabel,
  DEFAULT_INTERVAL,
  INTERVAL_LIMITS,
  INTERVAL_PRESETS,
  normalizeSettings,
  totalSeconds,
  type IntervalExercise,
  type IntervalPhase,
  type IntervalSettings,
} from "@/lib/domain/interval-timer";
import { durationLabel } from "@/lib/domain/training-plan";
import { cn } from "@/lib/utils";
import { unlockAudio, useIntervalTimer } from "./use-interval-timer";

export type IntervalDay = { id: string; name: string; focus: string | null; exercises: IntervalExercise[] };

const storageKey = (planId: string) => `intervall:${planId}`;

const FIELDS: { key: keyof IntervalSettings; label: string; hint: string; step: number; unit: string }[] = [
  { key: "work", label: "Belastung", hint: "je Übung", step: 5, unit: "Sekunden" },
  { key: "rest", label: "Pause", hint: "danach", step: 5, unit: "Sekunden" },
  { key: "rounds", label: "Runden", hint: "Durchgänge", step: 1, unit: "Runden" },
  { key: "prepare", label: "Vorbereitung", hint: "vor dem Start", step: 5, unit: "Sekunden" },
];

/**
 * Intervall-Timer zum Trainingsplan: Einstellungen (mit oder ohne die Übungen eines Trainingstags), dann der Ablauf im
 * Vollbild. Die letzten Einstellungen merkt sich das Gerät je Plan. Der Timer schreibt nichts in den Trainingsverlauf.
 */
export function IntervalTimer({ planId, planTitle, days, nextDayId }: { planId: string; planTitle: string; days: IntervalDay[]; nextDayId: string | null }) {
  const selectable = useMemo(() => days.filter((d) => d.exercises.length > 0), [days]);
  const [settings, setSettings] = useState<IntervalSettings>(DEFAULT_INTERVAL);
  const [dayId, setDayId] = useState<string | null>(() => (selectable.some((d) => d.id === nextDayId) ? nextDayId : (selectable[0]?.id ?? null)));
  const [run, setRun] = useState<{ id: number; phases: IntervalPhase[] } | null>(null);
  const audio = useRef<AudioContext | null>(null);

  const day = selectable.find((d) => d.id === dayId) ?? null;
  const phases = useMemo(() => buildPhases(settings, day?.exercises ?? []), [settings, day]);
  const hasFixedTimes = day?.exercises.some((e) => e.seconds != null) ?? false;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(planId));
      if (!raw) return;
      const stored = JSON.parse(raw) as { settings?: unknown; dayId?: unknown };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- einmalig nach dem Laden (localStorage gibt es erst im Browser)
      setSettings(normalizeSettings(stored.settings));
      if (stored.dayId === null) setDayId(null);
      else if (selectable.some((d) => d.id === stored.dayId)) setDayId(stored.dayId as string);
    } catch {
      // Ohne Speicher (privater Modus) oder mit kaputtem Eintrag gelten die Standardwerte
    }
  }, [planId, selectable]);

  function start() {
    unlockAudio(audio);
    try {
      window.localStorage.setItem(storageKey(planId), JSON.stringify({ settings, dayId: day?.id ?? null }));
    } catch {
      // Dann merkt sich das Gerät die Einstellungen eben nicht
    }
    setRun((r) => ({ id: (r?.id ?? 0) + 1, phases }));
  }

  if (run) return <IntervalRun key={run.id} phases={run.phases} audio={audio} planId={planId} onExit={() => setRun(null)} onRestart={start} />;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl space-y-8 bg-background px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <div>
        <Link
          href={`/sport/plaene/${planId}`}
          className="inline-flex min-h-10 items-center gap-1 rounded-full bg-muted pr-4 pl-2.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Plan
        </Link>
        <h1 className="mt-4 text-3xl font-semibold md:text-4xl">Intervall-Timer</h1>
        <p className="wrap-anywhere text-muted-foreground">{planTitle}</p>
      </div>

      {selectable.length ? (
        <section>
          <FieldHeading>Übungen</FieldHeading>
          <div className="flex flex-wrap gap-2">
            {selectable.map((d) => (
              <button key={d.id} type="button" aria-pressed={d.id === day?.id} onClick={() => setDayId(d.id)} className={chipClass(d.id === day?.id)}>
                {d.name}
              </button>
            ))}
            <button type="button" aria-pressed={!day} onClick={() => setDayId(null)} className={chipClass(!day)}>
              Ohne Übungen
            </button>
          </div>
          {day ? (
            <>
              <ol className="mt-3 divide-y rounded-2xl border bg-card">
                {day.exercises.map((e, i) => (
                  <li key={`${e.name}-${i}`} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0 wrap-anywhere">{e.name}</span>
                    <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{durationLabel(e.seconds ?? settings.work)}</span>
                  </li>
                ))}
              </ol>
              {hasFixedTimes ? <p className="mt-2 px-0.5 text-sm text-muted-foreground">Übungen mit fester Zeit im Plan laufen mit dieser Zeit, alle anderen mit der Belastung unten.</p> : null}
            </>
          ) : null}
        </section>
      ) : null}

      <section>
        <FieldHeading>Vorlagen</FieldHeading>
        <div className="flex flex-wrap gap-2">
          {INTERVAL_PRESETS.map((p) => {
            const on = settings.work === p.work && settings.rest === p.rest && settings.rounds === p.rounds;
            return (
              <button key={p.label} type="button" aria-pressed={on} onClick={() => setSettings((s) => ({ ...s, work: p.work, rest: p.rest, rounds: p.rounds }))} className={chipClass(on)}>
                {p.label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <FieldHeading>Einstellungen</FieldHeading>
        <div className="divide-y rounded-2xl border bg-card">
          {FIELDS.map(({ key, ...field }) => (
            <NumberField key={key} {...field} {...INTERVAL_LIMITS[key]} value={settings[key]} onChange={(v) => setSettings((s) => ({ ...s, [key]: v }))} />
          ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-[40rem] items-center justify-between gap-3">
          <p className="min-w-0 text-sm">
            <span className="block font-semibold tabular-nums">{clockLabel(totalSeconds(phases))} Minuten</span>
            <span className="block truncate text-xs text-muted-foreground">
              {settings.rounds === 1 ? "1 Runde" : `${settings.rounds} Runden`}
              {day ? ` · ${day.exercises.length === 1 ? "1 Übung" : `${day.exercises.length} Übungen`}` : ""}
            </span>
          </p>
          <Button type="button" onClick={start} className="h-12 shrink-0 rounded-full px-7 text-base">
            <Play aria-hidden />
            Start
          </Button>
        </div>
      </div>
    </main>
  );
}

/** Zahl mit Minus/Plus und freier Eingabe. Leeres oder ungültiges Feld behält den letzten gültigen Wert. */
function NumberField({ label, hint, unit, step, min, max, value, onChange }: { label: string; hint: string; unit: string; step: number; min: number; max: number; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setText(String(value));
  }
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5" role="group" aria-label={label}>
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">
          {unit === "Sekunden" && value >= 60 ? `${clockLabel(value)} Minuten` : unit === "Sekunden" ? `Sekunden ${hint}` : hint}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Button type="button" variant="outline" size="icon-lg" className="rounded-full" onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label={`${label}: weniger`}>
          <Minus aria-hidden />
        </Button>
        <Input
          inputMode="numeric"
          value={text}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
            setText(raw);
            if (raw && Number(raw) >= min && Number(raw) <= max) onChange(Number(raw));
          }}
          onBlur={() => setText(String(value))}
          aria-label={`${label} in ${unit}`}
          className="h-11 w-16 text-center text-lg font-semibold tabular-nums"
        />
        <Button type="button" variant="outline" size="icon-lg" className="rounded-full" onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label={`${label}: mehr`}>
          <Plus aria-hidden />
        </Button>
      </span>
    </div>
  );
}

const PHASE_TONE: Record<IntervalPhase["kind"], string> = {
  prepare: "bg-muted text-foreground",
  work: "bg-primary text-primary-foreground",
  rest: "bg-sport-soft text-foreground",
};

const PHASE_KICKER: Record<IntervalPhase["kind"], string> = { prepare: "Gleich geht’s los", work: "Belastung", rest: "Pause" };

/** Der laufende Ablauf im Vollbild: große Restzeit, Farbe je Phase, damit man sie auch aus der Entfernung erkennt. */
function IntervalRun({ phases, audio, planId, onExit, onRestart }: { phases: IntervalPhase[]; audio: React.RefObject<AudioContext | null>; planId: string; onExit: () => void; onRestart: () => void }) {
  const t = useIntervalTimer(phases, audio);
  useWakeLock(t.running);
  const rounds = phases.at(-1)?.round ?? 1;

  if (t.done) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6 text-center">
        <div className="max-w-sm space-y-5">
          <span className="mx-auto grid size-20 place-items-center rounded-3xl bg-sport-soft text-sport">
            <Trophy className="size-10" aria-hidden />
          </span>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold">Geschafft!</h1>
            <p className="text-muted-foreground">
              {rounds === 1 ? "1 Runde" : `${rounds} Runden`} in {clockLabel(totalSeconds(phases))} Minuten.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={onRestart} className="h-12 rounded-full px-6 text-base">
              <RotateCcw aria-hidden />
              Nochmal
            </Button>
            <Button type="button" variant="outline" onClick={onExit} className="h-12 rounded-full px-5 text-base">
              <Timer aria-hidden />
              Einstellungen
            </Button>
            <Link href={`/sport/plaene/${planId}`} className={cn(buttonVariants({ variant: "outline" }), "h-12 rounded-full px-5 text-base")}>
              Zum Plan
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const share = 1 - t.remainingMs / (t.phase.seconds * 1000);
  const roundButton = "grid place-items-center rounded-full transition focus-visible:ring-3 focus-visible:ring-current focus-visible:outline-none";

  return (
    <main className={cn("flex min-h-dvh flex-col px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] transition-colors duration-300", PHASE_TONE[t.phase.kind])}>
      <header className="flex items-center justify-between gap-3">
        <button type="button" onClick={onExit} aria-label="Timer beenden" title="Beenden" className={cn(roundButton, "size-11 bg-current/10 hover:bg-current/20")}>
          <X className="size-5" aria-hidden />
        </button>
        <p className="text-base font-semibold tabular-nums">
          Runde {t.phase.round} von {rounds}
        </p>
        <p className="min-w-11 text-right text-sm font-medium tabular-nums opacity-80" aria-label={`Insgesamt noch ${clockLabel(t.remainingTotal)} Minuten`}>
          {clockLabel(t.remainingTotal)}
        </p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
        {/* Ohne Übung hieße die Zeile sonst genauso wie die Überschrift („Pause“, „Belastung“) */}
        {PHASE_KICKER[t.phase.kind] !== t.phase.label ? <p className="text-sm font-semibold tracking-wide uppercase opacity-80">{PHASE_KICKER[t.phase.kind]}</p> : null}
        <h1 className="max-w-2xl text-3xl leading-tight font-semibold wrap-anywhere md:text-5xl" aria-live="polite">
          {t.phase.label}
        </h1>
        <p className="font-heading text-[clamp(6.5rem,32vw,15rem)] leading-none font-semibold tabular-nums" role="timer">
          {t.secondsLeft >= 60 ? clockLabel(t.secondsLeft) : t.secondsLeft}
        </p>
        <div className="h-2.5 w-full max-w-md overflow-hidden rounded-full bg-current/15" aria-hidden>
          <div className="h-full rounded-full bg-current" style={{ width: `${Math.min(100, share * 100)}%` }} />
        </div>
        <p className="mt-1 min-h-6 text-base wrap-anywhere opacity-90">
          {t.nextPhase ? `Als Nächstes: ${t.nextPhase.label} · ${durationLabel(t.nextPhase.seconds)}` : "Letztes Intervall"}
        </p>
      </div>

      <div className="flex items-center justify-center gap-5">
        <button type="button" onClick={t.previous} aria-label="Zurück" title="Zurück" className={cn(roundButton, "size-14 bg-current/10 hover:bg-current/20")}>
          <SkipBack className="size-6" aria-hidden />
        </button>
        <button
          type="button"
          onClick={t.toggle}
          aria-label={t.running ? "Pause" : "Weiter"}
          title={t.running ? "Pause" : "Weiter"}
          className={cn(roundButton, "size-20 bg-background text-foreground shadow-lg")}
        >
          {t.running ? <Pause className="size-9 fill-current" aria-hidden /> : <Play className="size-9 fill-current" aria-hidden />}
        </button>
        <button type="button" onClick={t.next} aria-label="Überspringen" title="Überspringen" className={cn(roundButton, "size-14 bg-current/10 hover:bg-current/20")}>
          <SkipForward className="size-6" aria-hidden />
        </button>
      </div>
    </main>
  );
}
