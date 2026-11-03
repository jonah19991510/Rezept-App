"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { CalendarCheck, Check, Dumbbell, Hash, Lock, Minus, Plus, Ruler, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { saveChallengeAction } from "@/app/(app)/sport/challenges/actions";
import { FormMessage } from "@/components/forms/form-message";
import { chipClass } from "@/components/recipes/chip-select";
import { EditorHeader } from "@/components/recipes/editor/editor-header";
import { FieldHeading, RadioSegments } from "@/components/recipes/editor/editor-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  CHALLENGE_ICONS,
  CHALLENGE_PRESETS,
  MISSED_RULES,
  periodCount,
  ruleLines,
  ruleSummary,
  type Challenge,
  type ChallengeMetric,
  type ChallengePreset,
  type ChallengeRules,
  type MissedRule,
} from "@/lib/domain/challenges";
import { DRINK_COLOR_KEYS, DRINK_COLORS, type DrinkColor } from "@/lib/domain/drinks";
import { addDays } from "@/lib/domain/week";
import { cn } from "@/lib/utils";
import type { ChallengeIcon as ChallengeIconKey } from "@/lib/domain/challenges";
import { CHALLENGE_ICON_LABELS, CHALLENGE_ICON_MAP, RuleCard } from "./challenge-parts";
import { parseAmount } from "./entry-controls";

/** Was zählt – so, wie man es beim Anlegen auswählt (Trainings sind eine eigene Art). */
type Kind = "check" | "daily" | "total" | "workouts";

type Form = {
  title: string;
  description: string;
  icon: ChallengeIconKey;
  color: DrinkColor;
  kind: Kind;
  /** Trainings: an Tagen (check) oder Anzahl insgesamt (total) */
  workoutMode: "check" | "total";
  unit: string;
  dailyTarget: string;
  totalTarget: string;
  frequency: "daily" | "weekly";
  daysPerWeek: number;
  durationDays: number;
  startMode: "fixed" | "join";
  startsOn: string;
  lateJoinDays: number;
  missedRule: MissedRule;
  jokers: number;
  minMode: "all" | "min";
  minPeriods: number;
  backfillDays: number;
  join: boolean;
};

const KINDS: { value: Kind; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "check", label: "Abhaken", hint: "Ja oder nein, z. B. kein Alkohol", icon: CalendarCheck },
  { value: "daily", label: "Menge pro Tag", hint: "Tagesziel, z. B. 50 Liegestütze", icon: Ruler },
  { value: "total", label: "Gesamtmenge", hint: "Für den ganzen Zeitraum, z. B. 100 km", icon: Hash },
  { value: "workouts", label: "Trainings", hint: "Zählt automatisch aus deinen Trainings", icon: Dumbbell },
];

const UNIT_SUGGESTIONS = ["Liegestütze", "Kniebeugen", "Schritte", "km", "Minuten", "Liter", "Seiten", "Wiederholungen"];
const DAY_DURATIONS = [7, 14, 21, 30, 60, 90];
const WEEK_DURATIONS = [2, 4, 6, 8, 12];
const BACKFILL = [
  { value: 0, label: "Nur am selben Tag" },
  { value: 1, label: "Bis gestern" },
  { value: 2, label: "2 Tage" },
  { value: 3, label: "3 Tage" },
  { value: 7, label: "7 Tage" },
];

const amountText = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

function formFrom(c: Challenge | null, today: string): Form {
  if (!c) {
    return {
      title: "",
      description: "",
      icon: "trophy",
      color: "orange",
      kind: "check",
      workoutMode: "check",
      unit: "",
      dailyTarget: "",
      totalTarget: "",
      frequency: "daily",
      daysPerWeek: 3,
      durationDays: 30,
      startMode: "fixed",
      startsOn: addDays(today, 1),
      lateJoinDays: 3,
      missedRule: "streak",
      jokers: 2,
      minMode: "all",
      minPeriods: 25,
      backfillDays: 1,
      join: true,
    };
  }
  const periods = periodCount(c);
  return {
    title: c.title,
    description: c.description ?? "",
    icon: (CHALLENGE_ICONS as readonly string[]).includes(c.icon) ? (c.icon as ChallengeIconKey) : "trophy",
    color: (DRINK_COLOR_KEYS as string[]).includes(c.color) ? (c.color as DrinkColor) : "orange",
    kind: c.source === "workouts" ? "workouts" : c.metric,
    workoutMode: c.metric === "total" ? "total" : "check",
    unit: c.unit ?? "",
    dailyTarget: amountText(c.dailyTarget),
    totalTarget: amountText(c.totalTarget),
    frequency: c.frequency,
    daysPerWeek: c.daysPerWeek ?? 3,
    durationDays: c.durationDays,
    startMode: c.startMode,
    startsOn: c.startsOn ?? addDays(today, 1),
    lateJoinDays: c.lateJoinDays,
    missedRule: c.missedRule,
    jokers: c.jokers,
    minMode: c.minPeriods == null ? "all" : "min",
    minPeriods: c.minPeriods ?? Math.max(1, periods - 5),
    backfillDays: c.backfillDays,
    join: false,
  };
}

/** Formular → Regeln (wie sie gespeichert werden). */
function toRules(f: Form): ChallengeRules & { valid: boolean } {
  const workouts = f.kind === "workouts";
  const metric: ChallengeMetric = workouts ? f.workoutMode : (f.kind as ChallengeMetric);
  const total = metric === "total";
  const weekly = !total && f.frequency === "weekly";
  const durationDays = weekly ? Math.max(7, Math.round(f.durationDays / 7) * 7) : f.durationDays;
  const periods = weekly ? durationDays / 7 : durationDays;
  const missedRule = total ? "relaxed" : f.missedRule;
  const dailyTarget = metric === "daily" ? parseAmount(f.dailyTarget) : null;
  const totalTarget = total ? parseAmount(f.totalTarget) : null;
  const unit = !workouts && metric !== "check" ? f.unit.trim() || null : null;
  return {
    metric,
    source: workouts ? "workouts" : "manual",
    unit,
    dailyTarget,
    totalTarget,
    frequency: weekly ? "weekly" : "daily",
    daysPerWeek: weekly ? f.daysPerWeek : null,
    durationDays,
    startMode: f.startMode,
    startsOn: f.startMode === "fixed" ? f.startsOn : null,
    lateJoinDays: f.startMode === "fixed" ? Math.min(f.lateJoinDays, durationDays - 1) : 0,
    missedRule,
    jokers: missedRule === "relaxed" ? 0 : Math.min(f.jokers, periods),
    minPeriods: total || missedRule === "strict" || f.minMode === "all" ? null : Math.min(f.minPeriods, periods),
    backfillDays: f.backfillDays,
    valid:
      (metric !== "daily" || (dailyTarget != null && dailyTarget > 0)) &&
      (!total || (totalTarget != null && totalTarget > 0)) &&
      (workouts || metric === "check" || unit != null) &&
      (f.startMode === "join" || /^\d{4}-\d{2}-\d{2}$/.test(f.startsOn)),
  };
}

/**
 * Challenge anlegen oder bearbeiten (ganze Seite wie der Plan-Editor): Vorlagen, Name und Beschreibung, Symbol und
 * Farbe, was zählt, wie oft, wie lange, Start, verpasste Tage mit Jokern, wann geschafft, Nachtragen. Unten die
 * Regel-Karte als Vorschau, so wie die anderen sie sehen. Machen schon andere mit, sind die Regeln gesperrt.
 */
export function ChallengeEditor({ challenge, locked, today }: { challenge: Challenge | null; locked: boolean; today: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => formFrom(challenge, today));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const rules = useMemo(() => toRules(form), [form]);
  const periods = periodCount(rules);
  const weeklyUnit = rules.frequency === "weekly";
  const err = (key: string) => errors[key]?.[0];

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function patch(p: Partial<Form>) {
    setDirty(true);
    setForm((f) => ({ ...f, ...p }));
  }

  function applyPreset(p: ChallengePreset) {
    patch({
      title: p.title,
      icon: p.icon,
      color: p.color as DrinkColor,
      kind: p.source === "workouts" ? "workouts" : (p.metric ?? "check"),
      workoutMode: p.metric === "total" ? "total" : "check",
      unit: p.unit ?? "",
      dailyTarget: amountText(p.dailyTarget),
      totalTarget: amountText(p.totalTarget),
      frequency: p.frequency ?? "daily",
      daysPerWeek: p.daysPerWeek ?? 3,
      durationDays: p.durationDays ?? 30,
      missedRule: p.missedRule ?? "relaxed",
      jokers: p.jokers ?? 0,
      minMode: p.minPeriods ? "min" : "all",
      minPeriods: p.minPeriods ?? 25,
    });
  }

  function setFrequency(frequency: "daily" | "weekly") {
    // Bei „pro Woche“ in ganzen Wochen
    patch({ frequency, durationDays: frequency === "weekly" ? Math.max(7, Math.round(form.durationDays / 7) * 7) : form.durationDays });
  }

  function save() {
    setMessage(undefined);
    startTransition(async () => {
      const result = await saveChallengeAction(challenge?.id ?? null, {
        title: form.title,
        description: form.description,
        icon: form.icon,
        color: form.color,
        metric: rules.metric,
        source: rules.source,
        unit: rules.unit,
        dailyTarget: rules.dailyTarget,
        totalTarget: rules.totalTarget,
        frequency: rules.frequency,
        daysPerWeek: rules.daysPerWeek,
        durationDays: rules.durationDays,
        startMode: rules.startMode,
        startsOn: rules.startsOn,
        lateJoinDays: rules.lateJoinDays,
        missedRule: rules.missedRule,
        jokers: rules.jokers,
        minPeriods: rules.minPeriods,
        backfillDays: rules.backfillDays,
        join: !challenge && form.join,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message ?? "Bitte die markierten Felder prüfen.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setDirty(false);
      toast.success(challenge ? "Gespeichert" : "Challenge angelegt");
      router.push(`/sport/challenges/${result.id}`);
    });
  }

  const preview = { ...rules, startsOn: rules.startsOn ?? today };

  return (
    <div className="space-y-8 pb-28">
      <EditorHeader
        kicker={challenge ? "Challenge bearbeiten" : "Neue Challenge"}
        title={form.title.trim() || "Ohne Namen"}
        cancelHref={challenge ? `/sport/challenges/${challenge.id}` : "/sport/entdecken/challenges"}
        dirty={dirty}
        onDiscard={() => setDirty(false)}
      />
      <FormMessage message={message} />

      {!challenge ? (
        <section>
          <FieldHeading>Vorlagen</FieldHeading>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
            {CHALLENGE_PRESETS.map((p) => {
              const Icon = CHALLENGE_ICON_MAP[p.icon];
              return (
                <button key={p.name} type="button" onClick={() => applyPreset(p)} aria-pressed={form.title === p.title} className={chipClass(form.title === p.title)}>
                  <Icon aria-hidden />
                  {p.title}
                </button>
              );
            })}
          </div>
          <p className="mt-1 px-0.5 text-sm text-muted-foreground">Füllt alles aus; danach kannst du jede Einstellung ändern.</p>
        </section>
      ) : null}

      <div className="rounded-3xl border bg-card">
        <div className="px-4 pt-3 pb-2">
          <label htmlFor="challenge-title" className="text-sm font-medium text-muted-foreground">
            Name
          </label>
          <input
            id="challenge-title"
            value={form.title}
            onChange={(e) => patch({ title: e.target.value })}
            maxLength={60}
            placeholder="z. B. 30 Tage Liegestütze"
            aria-invalid={Boolean(err("title")) || undefined}
            className="mt-0.5 block min-h-11 w-full bg-transparent font-heading text-[1.75rem] leading-tight font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
          />
          {err("title") ? <p className="mt-1 text-sm text-destructive">{err("title")}</p> : null}
        </div>
        <div className="border-t px-4 pt-3 pb-3">
          <label htmlFor="challenge-description" className="text-sm font-medium text-muted-foreground">
            Beschreibung <span className="font-normal">· optional</span>
          </label>
          <textarea
            id="challenge-description"
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
            maxLength={2000}
            rows={2}
            placeholder="Worum geht es, was zählt dazu (z. B. „auch Kniestand-Liegestütze“), warum mitmachen?"
            className="mt-1 block min-h-14 w-full resize-none bg-transparent text-base outline-none [field-sizing:content] placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      <Section title="Symbol und Farbe">
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10 sm:gap-2" role="radiogroup" aria-label="Symbol">
          {CHALLENGE_ICONS.map((key) => {
            const Icon = CHALLENGE_ICON_MAP[key];
            const on = form.icon === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={CHALLENGE_ICON_LABELS[key]}
                title={CHALLENGE_ICON_LABELS[key]}
                onClick={() => patch({ icon: key })}
                className={cn(
                  "grid aspect-square place-items-center rounded-2xl border transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  on ? "border-transparent text-white" : "bg-card text-muted-foreground hover:bg-muted",
                )}
                style={on ? { background: DRINK_COLORS[form.color].value } : undefined}
              >
                <Icon className="size-5" aria-hidden />
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Farbe">
          {DRINK_COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={form.color === key}
              aria-label={DRINK_COLORS[key].label}
              title={DRINK_COLORS[key].label}
              onClick={() => patch({ color: key })}
              className={cn(
                "grid size-10 place-items-center rounded-full ring-offset-2 ring-offset-background transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                form.color === key && "ring-2 ring-foreground",
              )}
              style={{ background: DRINK_COLORS[key].value }}
            >
              {form.color === key ? <Check className="size-5 text-white drop-shadow" aria-hidden /> : null}
            </button>
          ))}
        </div>
      </Section>

      {locked ? (
        <p className="flex gap-3 rounded-3xl border bg-muted/60 p-4 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="block font-semibold">Regeln gesperrt</span>
            Es machen schon andere mit. Damit es fair bleibt, lassen sich nur noch Name, Beschreibung, Symbol und Farbe ändern.
          </span>
        </p>
      ) : null}

      <fieldset disabled={locked} className={cn("space-y-8", locked && "opacity-60")}>
        <Section title="Was zählt?">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Was zählt">
            {KINDS.map((k) => {
              const on = form.kind === k.value;
              return (
                <button
                  key={k.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => patch({ kind: k.value })}
                  className={cn(
                    "flex min-h-24 flex-col items-start gap-1 rounded-2xl border p-3 text-left transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    on ? "border-primary bg-primary/10" : "bg-card hover:bg-muted",
                  )}
                >
                  <k.icon className={cn("size-5", on ? "text-primary" : "text-muted-foreground")} aria-hidden />
                  <span className="font-semibold">{k.label}</span>
                  <span className="text-xs text-muted-foreground">{k.hint}</span>
                </button>
              );
            })}
          </div>

          {form.kind === "workouts" ? (
            <div className="mt-3">
              <RadioSegments
                label="Trainings zählen"
                value={form.workoutMode}
                onChange={(workoutMode) => patch({ workoutMode })}
                options={[
                  { value: "check", label: "An Tagen trainieren" },
                  { value: "total", label: "Anzahl insgesamt" },
                ]}
              />
              {form.workoutMode === "total" ? (
                <AmountField id="challenge-total" label="Trainings insgesamt" value={form.totalTarget} onChange={(totalTarget) => patch({ totalTarget })} unit="Trainings" error={err("totalTarget")} />
              ) : null}
            </div>
          ) : null}

          {form.kind === "daily" || form.kind === "total" ? (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-3">
                <AmountField
                  id="challenge-target"
                  label={form.kind === "daily" ? "Tagesziel" : "Gesamtziel"}
                  value={form.kind === "daily" ? form.dailyTarget : form.totalTarget}
                  onChange={(v) => patch(form.kind === "daily" ? { dailyTarget: v } : { totalTarget: v })}
                  error={err(form.kind === "daily" ? "dailyTarget" : "totalTarget")}
                />
                <div className="grid min-w-0 gap-1.5">
                  <label htmlFor="challenge-unit" className="text-sm font-medium">
                    Einheit
                  </label>
                  <Input id="challenge-unit" value={form.unit} maxLength={24} onChange={(e) => patch({ unit: e.target.value })} placeholder="z. B. Liegestütze" className="h-12 text-base" aria-invalid={Boolean(err("unit")) || undefined} />
                </div>
              </div>
              {err("unit") ? <p className="text-sm text-destructive">{err("unit")}</p> : null}
              <div className="flex flex-wrap gap-2">
                {UNIT_SUGGESTIONS.map((u) => (
                  <button key={u} type="button" onClick={() => patch({ unit: u })} aria-pressed={form.unit === u} className={chipClass(form.unit === u)}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </Section>

        {rules.metric !== "total" ? (
          <Section title="Wie oft?">
            <RadioSegments
              label="Wie oft"
              value={form.frequency}
              onChange={setFrequency}
              options={[
                { value: "daily", label: "Jeden Tag" },
                { value: "weekly", label: "Tage pro Woche" },
              ]}
            />
            {form.frequency === "weekly" ? (
              <div className="mt-3">
                <Stepper label="Tage pro Woche" value={form.daysPerWeek} min={1} max={7} onChange={(daysPerWeek) => patch({ daysPerWeek })} unit={form.daysPerWeek === 1 ? "Tag pro Woche" : "Tage pro Woche"} />
              </div>
            ) : null}
          </Section>
        ) : null}

        <Section title="Wie lange?" aside={weeklyUnit ? `${rules.durationDays} Tage` : undefined}>
          <div className="flex flex-wrap gap-2">
            {(weeklyUnit ? WEEK_DURATIONS.map((w) => w * 7) : DAY_DURATIONS).map((d) => (
              <button key={d} type="button" aria-pressed={rules.durationDays === d} onClick={() => patch({ durationDays: d })} className={chipClass(rules.durationDays === d)}>
                {weeklyUnit ? `${d / 7} Wochen` : `${d} Tage`}
              </button>
            ))}
          </div>
          <div className="mt-3">
            {weeklyUnit ? (
              <Stepper label="Wochen" value={rules.durationDays / 7} min={1} max={52} onChange={(w) => patch({ durationDays: w * 7 })} unit={rules.durationDays === 7 ? "Woche" : "Wochen"} />
            ) : (
              <Stepper label="Tage" value={rules.durationDays} min={1} max={366} onChange={(durationDays) => patch({ durationDays })} unit={rules.durationDays === 1 ? "Tag" : "Tage"} />
            )}
          </div>
          {err("durationDays") ? <p className="mt-2 text-sm text-destructive">{err("durationDays")}</p> : null}
        </Section>

        <Section title="Start">
          <RadioSegments
            label="Start"
            value={form.startMode}
            onChange={(startMode) => patch({ startMode })}
            options={[
              { value: "fixed", label: "Gemeinsam" },
              { value: "join", label: "Ab Beitritt" },
            ]}
          />
          <p className="mt-2 px-0.5 text-sm text-muted-foreground">
            {form.startMode === "fixed"
              ? "Alle starten am selben Tag. Das ist fair für die Rangliste."
              : "Jeder startet, wenn er beitritt, und hat dann seine eigenen Tage. Einsteigen geht jederzeit."}
          </p>
          {form.startMode === "fixed" ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                <label htmlFor="challenge-start" className="w-24 shrink-0 text-sm font-medium">
                  Starttag
                </label>
                <Input
                  id="challenge-start"
                  type="date"
                  min={today}
                  value={form.startsOn}
                  onChange={(e) => patch({ startsOn: e.target.value })}
                  className="h-12 max-w-48 min-w-0 px-3 text-base"
                  aria-invalid={Boolean(err("startsOn")) || undefined}
                />
              </div>
              {err("startsOn") ? <p className="text-sm text-destructive">{err("startsOn")}</p> : null}
              <div>
                <p className="mb-2 text-sm font-medium">Später einsteigen</p>
                <Stepper
                  label="Später einsteigen"
                  value={Math.min(form.lateJoinDays, rules.durationDays - 1)}
                  min={0}
                  max={Math.max(0, rules.durationDays - 1)}
                  onChange={(lateJoinDays) => patch({ lateJoinDays })}
                  unit={form.lateJoinDays === 0 ? "nur bis zum Start" : form.lateJoinDays === 1 ? "Tag nach Start" : "Tage nach Start"}
                />
              </div>
            </div>
          ) : null}
        </Section>

        {rules.metric !== "total" ? (
          <Section title={weeklyUnit ? "Verpasste Wochen" : "Verpasste Tage"}>
            <div className="grid gap-2" role="radiogroup" aria-label="Verpasste Tage">
              {MISSED_RULES.map((m) => {
                const on = form.missedRule === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => patch({ missedRule: m.key })}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border p-3 text-left transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      on ? "border-primary bg-primary/10" : "bg-card hover:bg-muted",
                    )}
                  >
                    <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")} aria-hidden>
                      {on ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                    <span>
                      <span className="block font-semibold">{m.label}</span>
                      <span className="block text-sm text-muted-foreground">{m.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {form.missedRule !== "relaxed" ? (
              <div className="mt-3">
                <p className="mb-2 text-sm font-medium">Joker</p>
                <Stepper
                  label="Joker"
                  value={Math.min(form.jokers, periods)}
                  min={0}
                  max={Math.min(30, periods)}
                  onChange={(jokers) => patch({ jokers })}
                  unit={form.jokers === 1 ? `Joker (1 ${weeklyUnit ? "Woche" : "Tag"} frei)` : `Joker (${form.jokers} ${weeklyUnit ? "Wochen" : "Tage"} frei)`}
                />
              </div>
            ) : null}
          </Section>
        ) : null}

        {rules.metric !== "total" && form.missedRule !== "strict" ? (
          <Section title="Geschafft, wenn …">
            <RadioSegments
              label="Geschafft, wenn"
              value={form.minMode}
              onChange={(minMode) => patch({ minMode })}
              options={[
                { value: "all", label: weeklyUnit ? "Alle Wochen" : "Alle Tage" },
                { value: "min", label: "Mindestens …" },
              ]}
            />
            {form.minMode === "min" ? (
              <div className="mt-3">
                <Stepper
                  label="Mindestens"
                  value={Math.min(form.minPeriods, periods)}
                  min={1}
                  max={periods}
                  onChange={(minPeriods) => patch({ minPeriods })}
                  unit={`von ${periods} ${weeklyUnit ? "Wochen" : "Tagen"}`}
                />
              </div>
            ) : null}
            {err("minPeriods") ? <p className="mt-2 text-sm text-destructive">{err("minPeriods")}</p> : null}
          </Section>
        ) : null}

        {rules.source === "manual" ? (
          <Section title="Nachtragen">
            <div className="flex flex-wrap gap-2">
              {BACKFILL.map((b) => (
                <button key={b.value} type="button" aria-pressed={form.backfillDays === b.value} onClick={() => patch({ backfillDays: b.value })} className={chipClass(form.backfillDays === b.value)}>
                  {b.label}
                </button>
              ))}
            </div>
            <p className="mt-2 px-0.5 text-sm text-muted-foreground">Wie weit zurück man vergessene Tage noch eintragen darf.</p>
          </Section>
        ) : null}
      </fieldset>

      {!challenge ? (
        <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-2">
          <span>
            <span className="block font-medium">Ich mache selbst mit</span>
            <span className="block text-sm text-muted-foreground">Du erscheinst gleich in der Rangliste.</span>
          </span>
          <Switch checked={form.join} onCheckedChange={(join) => patch({ join })} />
        </label>
      ) : null}

      <RuleCard lines={ruleLines(preview)} title="So sehen es die anderen" className="bg-muted/30" />

      {/* Speicherleiste: am Handy fest unten (Navigation ist ausgeblendet), am Desktop mitlaufend unten im Inhalt */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:sticky md:bottom-4 md:rounded-2xl md:border md:p-3 md:shadow-lg">
        <p className="min-w-0 text-sm">
          <span className="block truncate font-semibold">{form.title.trim() || "Ohne Namen"}</span>
          <span className="block truncate text-xs text-muted-foreground">{rules.valid ? ruleSummary(rules) : "Ziel und Einheit fehlen noch"}</span>
        </p>
        <Button type="button" onClick={save} disabled={pending || form.title.trim() === "" || !rules.valid} className="h-12 shrink-0 rounded-full px-7 text-base">
          {pending ? "Wird gespeichert …" : challenge ? "Speichern" : "Anlegen"}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <FieldHeading aside={aside}>{title}</FieldHeading>
      {children}
    </section>
  );
}

function AmountField({ id, label, value, onChange, unit, error }: { id: string; label: string; value: string; onChange: (v: string) => void; unit?: string; error?: string }) {
  const invalid = value.trim() !== "" && parseAmount(value) == null;
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="z. B. 50" className="h-12 min-w-0 text-base tabular-nums" aria-invalid={invalid || Boolean(error) || undefined} />
        {unit ? <span className="shrink-0 text-sm text-muted-foreground">{unit}</span> : null}
      </div>
      {error || invalid ? <p className="text-sm text-destructive">{error ?? "Bitte eine Zahl eingeben."}</p> : null}
    </div>
  );
}

/** Zahl mit Minus/Plus und Text dahinter („3 Tage pro Woche“). */
function Stepper({ label, value, min, max, onChange, unit }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit: string }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <Button type="button" variant="outline" size="icon-lg" className="rounded-full" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Weniger">
        <Minus aria-hidden />
      </Button>
      <output className="min-w-12 text-center text-lg font-semibold tabular-nums" aria-live="polite">
        {value}
      </output>
      <Button type="button" variant="outline" size="icon-lg" className="rounded-full" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Mehr">
        <Plus aria-hidden />
      </Button>
      <span className="min-w-0 text-sm text-muted-foreground">{unit}</span>
    </div>
  );
}
