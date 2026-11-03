"use client";

import { useState } from "react";
import { Flame, Shield, Sparkles, Target } from "lucide-react";
import {
  amount,
  dateLabel,
  hasStreak,
  isDayOpen,
  jokersOf,
  progressLabel,
  progressShare,
  statusLabel,
  unitOf,
  type CellState,
  type Progress,
} from "@/lib/domain/challenges";
import { drinkColor } from "@/lib/domain/drinks";
import { cn } from "@/lib/utils";
import { ProgressBar, StatusPill } from "./challenge-parts";
import { DayAction, type EntryChallenge } from "./entry-controls";

const CELL_LABEL: Record<CellState, string> = {
  met: "erfüllt",
  partial: "angefangen",
  joker: "Joker",
  missed: "verpasst",
  open: "offen",
  future: "kommt noch",
  empty: "kein Eintrag",
};

/**
 * Eigener Fortschritt: Status, Kennzahlen (Fortschritt, Serie, Joker, Punkte), heute eintragen und ein Kästchen je Tag.
 * Antippen eines Tages zeigt ihn unten; Tage im Nachtrag-Fenster lassen sich dort ändern.
 */
export function MyProgress({ challenge, progress: p, values, today }: { challenge: EntryChallenge; progress: Progress; values: Record<string, number>; today: string }) {
  const inWindow = today >= p.from && today <= p.to;
  const [selected, setSelected] = useState<string>(inWindow ? today : p.days.findLast((d) => d.state !== "future")?.date ?? p.from);
  const cell = p.days.find((d) => d.date === selected);
  const c = drinkColor(challenge.color);
  const editable = cell != null && challenge.source === "manual" && cell.state !== "future" && isDayOpen(selected, today, challenge.backfillDays);
  const jokers = jokersOf(challenge);
  const streak = hasStreak(challenge);

  const kpis = [
    { icon: Target, label: "Fortschritt", value: progressLabel(challenge, p) },
    streak ? { icon: Flame, label: "Serie", value: `${p.streak} ${challenge.frequency === "weekly" ? (p.streak === 1 ? "Woche" : "Wochen") : p.streak === 1 ? "Tag" : "Tage"}`, hint: p.bestStreak > p.streak ? `Beste: ${p.bestStreak}` : undefined } : null,
    jokers ? { icon: Shield, label: "Joker übrig", value: `${p.jokersLeft} von ${jokers}` } : null,
    { icon: Sparkles, label: "Punkte", value: String(p.points.total), hint: pointsHint(p) },
  ].filter((k): k is NonNullable<typeof k> => k != null);

  return (
    <section className="space-y-4 rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="dein-fortschritt">
      <div className="flex items-center justify-between gap-3">
        <h2 id="dein-fortschritt" className="font-heading text-xl font-semibold">
          Dein Fortschritt
        </h2>
        <StatusPill status={p.status}>{statusLabel(p)}</StatusPill>
      </div>

      <ProgressBar share={progressShare(challenge, p)} color={challenge.color} label="Dein Fortschritt" />
      {p.status === "active" && !p.reachable ? <p className="text-sm text-muted-foreground">Das Ziel ist nicht mehr erreichbar, Punkte sammelst du trotzdem.</p> : null}
      {p.status === "completed" && p.completedOn ? <p className="text-sm font-medium text-sage">Geschafft am {dateLabel(p.completedOn)}. Stark!</p> : null}
      {p.status === "failed" && p.failedOn ? <p className="text-sm text-destructive">Ausgeschieden am {dateLabel(p.failedOn)}: ohne Joker verpasst.</p> : null}

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl bg-muted/60 p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <k.icon className="size-3.5" aria-hidden />
              {k.label}
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{k.value}</dd>
            {k.hint ? <dd className="text-xs text-muted-foreground">{k.hint}</dd> : null}
          </div>
        ))}
      </dl>

      <div>
        <p className="mb-2 text-sm font-semibold text-muted-foreground">
          {challenge.frequency === "weekly" ? "Jede Zeile ist eine Woche" : "Jeder Tag ein Kästchen"}
        </p>
        <ol className="grid grid-cols-7 gap-1.5" aria-label="Tage der Challenge">
          {p.days.map((d, i) => {
            const day = Number(d.date.slice(8));
            const isSelected = d.date === selected;
            const style =
              d.state === "met"
                ? { background: c, color: "white" }
                : d.state === "partial"
                  ? { background: `color-mix(in srgb, ${c} 30%, var(--card))` }
                  : d.state === "joker"
                    ? { background: `repeating-linear-gradient(135deg, color-mix(in srgb, ${c} 25%, var(--card)) 0 4px, var(--card) 4px 8px)` }
                    : undefined;
            return (
              <li key={d.date}>
                <button
                  type="button"
                  onClick={() => setSelected(d.date)}
                  aria-pressed={isSelected}
                  aria-label={`Tag ${i + 1}, ${dateLabel(d.date)}: ${CELL_LABEL[d.state]}${d.value && challenge.metric !== "check" ? `, ${amount(d.value)} ${unitOf(challenge, d.value)}` : ""}`}
                  className={cn(
                    "grid aspect-square w-full place-items-center rounded-xl text-xs font-medium tabular-nums transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    d.state === "missed" && "bg-destructive/10 text-destructive",
                    (d.state === "open" || d.state === "empty") && "bg-muted text-foreground",
                    d.state === "future" && "border border-dashed text-muted-foreground",
                    d.date === today && "font-bold underline underline-offset-2",
                    isSelected && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
                  )}
                  style={style}
                >
                  {day}
                </button>
              </li>
            );
          })}
        </ol>
        <Legend color={c} jokers={jokers > 0} />
      </div>

      {cell ? (
        <div className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border p-3">
          <div className="min-w-0">
            <p className="font-semibold">{selected === today ? "Heute" : dateLabel(selected)}</p>
            <p className="text-sm text-muted-foreground">
              {cell.state === "future"
                ? "Kommt noch."
                : challenge.source === "workouts"
                  ? cell.value
                    ? `${cell.value} ${unitOf(challenge, cell.value)}`
                    : "Kein Training an diesem Tag."
                  : editable
                    ? challenge.metric === "check"
                      ? cell.state === "met"
                        ? "Abgehakt."
                        : "Noch nicht abgehakt."
                      : `${amount(values[selected] ?? 0)} ${unitOf(challenge)} eingetragen.`
                    : `${CELL_LABEL[cell.state][0].toUpperCase()}${CELL_LABEL[cell.state].slice(1)}. Lässt sich nicht mehr ändern.`}
            </p>
          </div>
          {editable && p.status !== "failed" ? <DayAction key={selected} challenge={challenge} date={selected} value={values[selected] ?? 0} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function pointsHint(p: Progress): string | undefined {
  const parts = [p.points.days ? `${p.points.days} Tage` : null, p.points.streak ? `${p.points.streak} Serie` : null, p.points.completion ? `${p.points.completion} geschafft` : null].filter(Boolean);
  return parts.length > 1 ? parts.join(" + ") : undefined;
}

function Legend({ color, jokers }: { color: string; jokers: boolean }) {
  const item = (label: string, cls: string, style?: React.CSSProperties) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-3 rounded", cls)} style={style} aria-hidden />
      {label}
    </span>
  );
  return (
    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-hidden>
      {item("erfüllt", "", { background: color })}
      {item("offen", "bg-muted")}
      {jokers ? item("Joker", "", { background: `repeating-linear-gradient(135deg, color-mix(in srgb, ${color} 35%, var(--card)) 0 3px, var(--card) 3px 6px)` }) : null}
      {item("verpasst", "bg-destructive/20")}
    </p>
  );
}
