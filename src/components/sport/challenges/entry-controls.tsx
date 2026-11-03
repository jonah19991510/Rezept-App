"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Dumbbell, Plus } from "lucide-react";
import { toast } from "sonner";
import { setChallengeEntryAction } from "@/app/(app)/sport/challenges/actions";
import { EditorSheet } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { amount, dateLabel, dayMet, unitOf, type ChallengeRules } from "@/lib/domain/challenges";
import { drinkColor } from "@/lib/domain/drinks";
import { cn } from "@/lib/utils";

export type EntryChallenge = ChallengeRules & { id: string; title: string; color: string };

/** „2,5“ → 2.5, „10.000“ → 10000, „2.5“ → 2.5; leer oder ungültig → null */
export function parseAmount(input: string): number | null {
  const raw = input.trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : /^\d+\.\d{1,2}$/.test(raw) ? raw : raw.replace(/\./g, "");
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Schnellknöpfe passend zur Größe des Ziels: 50 → +5, +10, +25 */
function quickSteps(target: number): number[] {
  if (target <= 3) return [0.25, 0.5, 1];
  if (target <= 12) return [1, 2, 5];
  if (target <= 60) return [5, 10, 25];
  if (target <= 300) return [10, 25, 50];
  if (target <= 3000) return [100, 250, 500];
  return [1000, 2500, 5000];
}

/** Eintragen mit sofortiger Anzeige; schlägt es fehl, springt der Wert zurück. */
function useEntry(challengeId: string, date: string, serverValue: number) {
  const [optimistic, setOptimistic] = useState<{ base: number; value: number } | null>(null);
  const [pending, startTransition] = useTransition();
  // Neue Daten vom Server ersetzen den lokalen Wert
  const value = optimistic && optimistic.base === serverValue ? optimistic.value : serverValue;

  function save(next: number, success?: string) {
    setOptimistic({ base: serverValue, value: next });
    startTransition(async () => {
      const result = await setChallengeEntryAction(challengeId, date, next);
      if (!result.ok) {
        setOptimistic(null);
        toast.error(result.message);
        return;
      }
      if (success) toast.success(success);
    });
  }
  return { value, save, pending };
}

/**
 * Was man an einem Tag tun kann: abhaken (runder Knopf), Menge eintragen (Knopf öffnet das Sheet) oder bei
 * Trainings-Challenges der Hinweis, dass es automatisch zählt.
 */
export function DayAction({ challenge, date, value: serverValue, size = "lg" }: { challenge: EntryChallenge; date: string; value: number; size?: "md" | "lg" }) {
  const { value, save, pending } = useEntry(challenge.id, date, serverValue);
  const [sheet, setSheet] = useState(false);
  const c = drinkColor(challenge.color);
  const met = dayMet(challenge, value);

  if (challenge.source === "workouts") {
    return (
      <Link
        href="/sport/plaene"
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label={value > 0 ? `${value} ${unitOf(challenge, value)} am ${dateLabel(date)}, zum Training` : "Zum Training"}
      >
        {value > 0 ? <Check className="size-4" style={{ color: c }} aria-hidden /> : <Dumbbell className="size-4" aria-hidden />}
        {value > 0 ? `${value} ${unitOf(challenge, value)}` : "Trainieren"}
      </Link>
    );
  }

  if (challenge.metric === "check") {
    return (
      <button
        type="button"
        onClick={() => {
          if (!met) navigator.vibrate?.(12);
          save(met ? 0 : 1);
        }}
        disabled={pending}
        aria-pressed={met}
        aria-label={`${challenge.title} am ${dateLabel(date)} ${met ? "nicht mehr abhaken" : "abhaken"}`}
        className={cn(
          "grid shrink-0 place-items-center rounded-full transition active:scale-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-70",
          size === "lg" ? "size-12" : "size-10",
        )}
        style={met ? { background: c, color: "white" } : { background: `color-mix(in srgb, ${c} 16%, var(--card))`, color: c, boxShadow: `inset 0 0 0 2px color-mix(in srgb, ${c} 45%, transparent)` }}
      >
        <Check className={cn(size === "lg" ? "size-6" : "size-5", !met && "opacity-40")} strokeWidth={3} aria-hidden />
      </button>
    );
  }

  const target = challenge.metric === "daily" ? (challenge.dailyTarget ?? 0) : 0;
  return (
    <>
      <button
        type="button"
        onClick={() => setSheet(true)}
        className={cn(
          "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold tabular-nums transition active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          met ? "text-white" : "border",
        )}
        style={met ? { background: c } : undefined}
        aria-label={`${challenge.title} am ${dateLabel(date)}: ${amount(value)} ${unitOf(challenge)} eingetragen, ändern`}
      >
        {met ? <Check className="size-4" strokeWidth={3} aria-hidden /> : value > 0 ? null : <Plus className="size-4" aria-hidden />}
        {value > 0 ? (target ? `${amount(value)}/${amount(target)}` : amount(value)) : "Eintragen"}
      </button>
      {sheet ? <AmountSheet challenge={challenge} date={date} value={value} onSave={save} onClose={() => setSheet(false)} /> : null}
    </>
  );
}

/** Menge eines Tages eintragen: Feld, Schnellknöpfe (+5 …), „Tagesziel“ bzw. „Hinzufügen“. */
function AmountSheet({
  challenge,
  date,
  value,
  onSave,
  onClose,
}: {
  challenge: EntryChallenge;
  date: string;
  value: number;
  onSave: (value: number, success?: string) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState(value > 0 ? amount(value) : "");
  const unit = unitOf(challenge);
  const daily = challenge.metric === "daily";
  const target = daily ? (challenge.dailyTarget ?? 0) : (challenge.totalTarget ?? 0) / Math.max(1, challenge.durationDays);
  const parsed = parseAmount(input);
  const current = parsed ?? 0;

  function close() {
    setOpen(false);
    setTimeout(onClose, 300);
  }
  function commit(next: number) {
    const rounded = Math.round(next * 100) / 100;
    onSave(rounded, rounded === 0 ? "Eintrag gelöscht" : daily && rounded >= (challenge.dailyTarget ?? Infinity) ? "Tagesziel geschafft" : "Gespeichert");
    close();
  }

  return (
    <EditorSheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title={`${unit} am ${dateLabel(date)}`}
      description={daily ? `Tagesziel: ${amount(challenge.dailyTarget ?? 0)} ${unit}` : `Ziel insgesamt: ${amount(challenge.totalTarget ?? 0)} ${unit}`}
      footer={
        <>
          {value > 0 ? (
            <Button type="button" variant="outline" size="lg" onClick={() => commit(0)}>
              Löschen
            </Button>
          ) : null}
          <Button type="button" size="lg" className="flex-1" disabled={parsed == null} onClick={() => commit(current)}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="grid gap-1.5">
        <Label htmlFor="challenge-amount">An diesem Tag insgesamt</Label>
        <div className="flex items-center gap-2">
          <Input
            id="challenge-amount"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="0"
            className="h-14 min-w-0 flex-1 text-2xl font-semibold tabular-nums"
            autoFocus
          />
          <span className="max-w-32 shrink-0 truncate text-muted-foreground">{unit}</span>
        </div>
        {parsed == null && input.trim() ? <p className="text-sm text-destructive">Bitte eine Zahl eingeben, z. B. 2,5.</p> : null}
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-muted-foreground">Dazurechnen</p>
        <div className="flex flex-wrap gap-2">
          {quickSteps(target || 10).map((step) => (
            <Button key={step} type="button" variant="outline" className="h-11 rounded-full px-4 tabular-nums" onClick={() => setInput(amount(current + step))}>
              +{amount(step)}
            </Button>
          ))}
          {daily && current < (challenge.dailyTarget ?? 0) ? (
            <Button type="button" variant="secondary" className="h-11 rounded-full px-4" onClick={() => setInput(amount(challenge.dailyTarget ?? 0))}>
              <Check aria-hidden />
              Tagesziel
            </Button>
          ) : null}
        </div>
      </div>
    </EditorSheet>
  );
}
