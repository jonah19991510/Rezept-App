"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlarmClock, Check, ChevronLeft, ChevronRight, ListChecks, Pause, Play, StickyNote, Sun, SunDim, Timer, X } from "lucide-react";
import { PortionStepper } from "@/components/recipes/portion-stepper";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scaleAmount, scaleFactor } from "@/lib/domain/scaling";
import { formatCountdown, formatDuration, splitStepText } from "@/lib/domain/timers";
import type { Unit } from "@/lib/domain/units";
import { dayMonth } from "@/lib/domain/week";
import { formatScaledQuantity } from "@/lib/format-quantity";
import { KIND_WORDS } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { CookDone } from "./cook-done";
import { PantryConsumption } from "./pantry-consumption";
import { useCookTimers, type CookTimer } from "./use-cook-timers";
import { useWakeLock } from "./use-wake-lock";

export type CookLine = {
  id: string;
  amount: number | null;
  unit: Unit | null;
  name: string;
  note: string | null;
  stepPosition: number | null;
};

export type CookStep = { position: number; text: string; timerSeconds: number | null };

type Phase = "start" | "steps" | "done";

/** Vollbild-Kochmodus: Portionen wählen, Schritt für Schritt mit Timern, am Ende „Gekocht!“. */
export function CookingMode({
  recipeId,
  title,
  recipeServings,
  initialServings,
  lines,
  steps,
  lastNote = null,
  kind = "dish",
}: {
  recipeId: string;
  title: string;
  recipeServings: number;
  initialServings: number;
  lines: CookLine[];
  steps: CookStep[];
  /** Phase 12: letzte Notiz aus dem Koch-Log, prominent vor dem Start */
  lastNote?: { text: string; date: string } | null;
  /** Phase 15: Cocktails im Mix-Modus (Drinks, „Gemixt!“) */
  kind?: Enums<"recipe_type">;
}) {
  const w = KIND_WORDS[kind];
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("start");
  const [servings, setServings] = useState(initialServings);
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [showAll, setShowAll] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const timers = useCookTimers();
  const wakeLock = useWakeLock(phase !== "done");
  const touch = useRef<{ x: number; y: number } | null>(null);

  const factor = scaleFactor(servings, recipeServings);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const quantity = (line: CookLine) => {
    const s = scaleAmount(line.amount, line.unit, factor);
    return formatScaledQuantity(s.amount, line.unit, s.approx);
  };

  function go(delta: 1 | -1) {
    if (phase !== "steps") return;
    if (delta === 1 && isLast) {
      setPhase("done");
      return;
    }
    setIndex((i) => Math.min(Math.max(i + delta, 0), steps.length - 1));
    setShowAll(false);
  }

  // Pfeiltasten am PC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== "steps" || (e.target as HTMLElement)?.closest("input, textarea")) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function exit() {
    if (timers.running || timers.ringing) setConfirmExit(true);
    else router.push(`/rezepte/${recipeId}`);
  }

  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const stepLines = useMemo(() => (step ? lines.filter((l) => l.stepPosition === step.position) : []), [lines, step]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <Button type="button" variant="ghost" size="icon-lg" onClick={exit} aria-label={`${w.mode} beenden`}>
          <X className="size-6" aria-hidden />
        </Button>
        <p className="min-w-0 flex-1 truncate font-heading text-lg font-semibold">{title}</p>
        {phase !== "done" ? (
          wakeLock === "active" ? (
            <Sun className="mr-2 size-5 text-sage" aria-label="Bildschirm bleibt an" />
          ) : (
            <SunDim className="mr-2 size-5 text-muted-foreground" aria-label="Bildschirm kann ausgehen" />
          )
        ) : null}
      </header>

      {timers.timers.length > 0 ? (
        <TimerBar
          timers={timers.timers}
          remainingMs={timers.remainingMs}
          isFinished={timers.isFinished}
          onToggle={timers.togglePause}
          onRemove={timers.remove}
        />
      ) : null}

      <main
        className="flex-1 overflow-y-auto overscroll-contain"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start || phase !== "steps") return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        }}
      >
        {phase === "start" ? (
          <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
            <h1 className="text-3xl font-semibold text-balance md:text-4xl">{title}</h1>
            {lastNote ? (
              <aside className="flex gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4" aria-label="Deine letzte Notiz">
                <StickyNote className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="text-sm font-medium">Letztes Mal ({dayMonth(lastNote.date)}) notiert:</p>
                  <p className="text-lg whitespace-pre-line">{lastNote.text}</p>
                </div>
              </aside>
            ) : null}
            <section className="space-y-2" aria-labelledby="kochen-portionen">
              <h2 id="kochen-portionen" className="text-lg font-medium">
                {kind === "cocktail" ? "Wie viele Drinks mixt du?" : "Für wie viele Portionen kochst du?"}
              </h2>
              <PortionStepper value={servings} onChange={setServings} size="lg" kind={kind} />
              {servings !== recipeServings ? (
                <p className="text-sm text-muted-foreground">Alle Mengen sind umgerechnet (Rezept: {String(recipeServings).replace(".", ",")}).</p>
              ) : null}
            </section>
            <Checklist title="Mise en place: alles bereitstellen" lines={lines} checked={checked} onToggle={toggleChecked} quantity={quantity} />
            {wakeLock === "unsupported" || wakeLock === "failed" ? <WakeLockHint /> : null}
            <Button
              type="button"
              className="h-16 w-full text-lg"
              onClick={() => {
                timers.unlockAudio();
                setPhase(steps.length > 0 ? "steps" : "done");
              }}
            >
              {steps.length > 0 ? "Los geht's" : `${w.done}!`}
              <ChevronRight className="size-6" aria-hidden />
            </Button>
          </div>
        ) : null}

        {phase === "steps" && step ? (
          <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
            <div className="space-y-2">
              <p className="text-sm font-medium tracking-wide text-primary uppercase">
                Schritt {index + 1} von {steps.length}
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
              </div>
            </div>

            <p className="text-2xl leading-relaxed font-medium md:text-4xl md:leading-snug" aria-live="polite">
              {splitStepText(step.text).map((seg, i) =>
                seg.type === "text" ? (
                  <span key={i}>{seg.text}</span>
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={() => timers.start(seg.timer.label, seg.timer.seconds, index + 1)}
                    className="mx-0.5 inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-3 py-0.5 align-baseline text-primary underline-offset-4 hover:bg-primary/20 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    aria-label={`Timer starten: ${seg.timer.label}`}
                  >
                    <Timer className="size-[0.8em]" aria-hidden />
                    {seg.timer.label}
                  </button>
                ),
              )}
            </p>

            {step.timerSeconds ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => timers.start(formatDuration(step.timerSeconds!), step.timerSeconds!, index + 1)}
              >
                <AlarmClock aria-hidden />
                Timer {formatDuration(step.timerSeconds)} starten
              </Button>
            ) : null}

            {stepLines.length > 0 ? (
              <section className="rounded-3xl border bg-card p-4" aria-labelledby="schritt-zutaten">
                <h2 id="schritt-zutaten" className="mb-2 text-sm font-medium tracking-wide text-muted-foreground uppercase">
                  Für diesen Schritt
                </h2>
                <ul className="space-y-1.5 text-lg md:text-xl">
                  {stepLines.map((l) => (
                    <li key={l.id} className="flex gap-3">
                      <span className="min-w-24 font-semibold tabular-nums">{quantity(l) || "–"}</span>
                      <span>
                        {l.name}
                        {l.note ? <span className="text-muted-foreground">, {l.note}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div>
              <Button type="button" variant="ghost" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                <ListChecks aria-hidden />
                {showAll ? "Zutatenliste ausblenden" : "Alle Zutaten zum Abhaken"}
              </Button>
              {showAll ? (
                <div className="mt-3">
                  <Checklist lines={lines} checked={checked} onToggle={toggleChecked} quantity={quantity} />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {phase === "done" ? (
          <>
            <CookDone recipeId={recipeId} servings={servings} kind={kind} onBack={steps.length > 0 ? () => setPhase("steps") : () => setPhase("start")} />
            <div className="mx-auto max-w-xl px-4 pb-8 md:px-8">
              <PantryConsumption recipeId={recipeId} servings={servings} />
            </div>
          </>
        ) : null}
      </main>

      {phase === "steps" ? (
        <footer className="grid grid-cols-2 gap-3 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" className="h-16 text-lg" onClick={() => go(-1)} disabled={index === 0}>
            <ChevronLeft className="size-6" aria-hidden />
            Zurück
          </Button>
          <Button type="button" className="h-16 text-lg" onClick={() => go(1)}>
            {isLast ? (
              <>
                <Check className="size-6" aria-hidden />
                {w.done}!
              </>
            ) : (
              <>
                Weiter
                <ChevronRight className="size-6" aria-hidden />
              </>
            )}
          </Button>
        </footer>
      ) : null}

      <Dialog open={confirmExit} onOpenChange={setConfirmExit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{w.mode} beenden?</DialogTitle>
            <DialogDescription>Es laufen noch Timer. Beim Beenden werden sie gestoppt.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{kind === "cocktail" ? "Weitermixen" : "Weiterkochen"}</DialogClose>
            <Button type="button" variant="destructive" onClick={() => router.push(`/rezepte/${recipeId}`)}>
              Beenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Checklist({
  title,
  lines,
  checked,
  onToggle,
  quantity,
}: {
  title?: string;
  lines: CookLine[];
  checked: Set<string>;
  onToggle: (id: string) => void;
  quantity: (line: CookLine) => string;
}) {
  if (lines.length === 0) return null;
  return (
    <section className="space-y-2">
      {title ? <h2 className="text-lg font-medium">{title}</h2> : null}
      <ul className="divide-y rounded-2xl border bg-card">
        {lines.map((l) => {
          const done = checked.has(l.id);
          return (
            <li key={l.id}>
              <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2 text-lg">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => onToggle(l.id)}
                  className="size-6 shrink-0 accent-[var(--primary)]"
                />
                <span className={cn("min-w-24 font-semibold tabular-nums", done && "text-muted-foreground line-through")}>
                  {quantity(l) || "–"}
                </span>
                <span className={cn(done && "text-muted-foreground line-through")}>
                  {l.name}
                  {l.note ? <span className="text-muted-foreground">, {l.note}</span> : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TimerBar({
  timers,
  remainingMs,
  isFinished,
  onToggle,
  onRemove,
}: {
  timers: CookTimer[];
  remainingMs: (t: CookTimer) => number;
  isFinished: (t: CookTimer) => boolean;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto border-b bg-card/60 px-3 py-2" aria-label="Laufende Timer">
      {timers.map((t) => {
        const finished = isFinished(t);
        const paused = t.endsAt == null;
        return (
          <div
            key={t.id}
            role={finished ? "alert" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-1.5",
              finished ? "animate-pulse border-primary bg-primary text-primary-foreground" : "bg-background",
            )}
          >
            <div className="leading-tight">
              <div className={cn("text-xs", finished ? "text-primary-foreground/90" : "text-muted-foreground")}>
                Schritt {t.step} · {t.label}
              </div>
              <div className="font-heading text-xl font-semibold tabular-nums">
                {finished ? "Fertig!" : formatCountdown(remainingMs(t))}
                {paused && !finished ? <span className="ml-1 text-xs font-normal text-muted-foreground">pausiert</span> : null}
              </div>
            </div>
            {finished ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => onRemove(t.id)}>
                OK
              </Button>
            ) : (
              <>
                <Button type="button" size="icon" variant="ghost" onClick={() => onToggle(t.id)} aria-label={paused ? "Timer fortsetzen" : "Timer pausieren"}>
                  {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => onRemove(t.id)} aria-label="Timer löschen">
                  <X aria-hidden />
                </Button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WakeLockHint() {
  return (
    <p className="flex gap-2 rounded-2xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      <SunDim className="mt-0.5 size-4 shrink-0" aria-hidden />
      Dein Browser kann den Bildschirm nicht automatisch anlassen. Stell die automatische Sperre am Handy für die Kochzeit
      eventuell länger ein.
    </p>
  );
}
