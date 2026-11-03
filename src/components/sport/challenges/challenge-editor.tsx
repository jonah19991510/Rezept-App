"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { CalendarCheck, Check, Dumbbell, Globe, Hash, Lock, Medal, Minus, Plus, Repeat, Ruler, type LucideIcon } from "lucide-react";
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
  dateLabel,
  periodCount,
  roundAt,
  ruleLines,
  ruleSummary,
  type Challenge,
  type ChallengeMetric,
  type ChallengePeriod,
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
type Kind = "check" | "daily" | "total" | "most" | "workouts";

type Form = {
  title: string;
  description: string;
  icon: ChallengeIconKey;
  color: DrinkColor;
  kind: Kind;
  /** Trainings: an Tagen (check), Anzahl insgesamt (total) oder wer am meisten trainiert (most) */
  workoutMode: "check" | "total" | "most";
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
  period: ChallengePeriod;
  repeats: boolean;
  isPublic: boolean;
  join: boolean;
};

const KINDS: { value: Kind; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "check", label: "Abhaken", hint: "Ja oder nein, z. B. kein Alkohol", icon: CalendarCheck },
  { value: "daily", label: "Menge pro Tag", hint: "Tagesziel, z. B. 50 Liegestütze", icon: Ruler },
  { value: "total", label: "Gesamtmenge", hint: "Für den ganzen Zeitraum, z. B. 100 km", icon: Hash },
  { value: "workouts", label: "Trainings", hint: "Zählt automatisch aus deinen Trainings", icon: Dumbbell },
  { value: "most", label: "Wer schafft mehr?", hint: "Wettkampf ohne Ziel: Platz 1 hat am Ende die größte Menge, z. B. die meisten Liegestütze", icon: Medal },
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
      period: "days",
      repeats: false,
      isPublic: true,
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
    workoutMode: c.metric === "total" || c.metric === "most" ? c.metric : "check",
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
    period: c.period,
    repeats: c.repeats,
    isPublic: c.isPublic,
    join: false,
  };
}

/** Formular → Regeln (wie sie gespeichert werden). */
function toRules(f: Form): ChallengeRules & { valid: boolean } {
  const workouts = f.kind === "workouts";
  const metric: ChallengeMetric = workouts ? f.workoutMode : (f.kind as ChallengeMetric);
  const total = metric === "total";
  // Gesamtmenge und Wettkampf: ohne Rhythmus, verpasste Tage und „mindestens X von Y“
  const open = total || metric === "most";
  const calendar = f.period !== "days";
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(f.startsOn);
  // „x Tage pro Woche“ nur bei einer festen Anzahl Tage
  const weekly = !open && !calendar && f.frequency === "weekly";
  const durationDays = calendar
    ? validStart
      ? roundAt({ startsOn: f.startsOn, durationDays: 1, period: f.period }, 0).days
      : 30
    : weekly
      ? Math.max(7, Math.round(f.durationDays / 7) * 7)
      : f.durationDays;
  // Monat/Jahr und Wiederholen nur mit gemeinsamem Start
  const startMode = calendar || f.repeats ? "fixed" : f.startMode;
  const periods = weekly ? durationDays / 7 : durationDays;
  const missedRule = open ? "relaxed" : f.missedRule;
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
    startMode,
    startsOn: startMode === "fixed" ? f.startsOn : null,
    lateJoinDays: startMode === "fixed" ? Math.min(f.lateJoinDays, Math.max(0, durationDays - 1)) : 0,
    missedRule,
    jokers: missedRule === "relaxed" ? 0 : Math.min(f.jokers, periods),
    minPeriods: open || calendar || missedRule === "strict" || f.minMode === "all" ? null : Math.min(f.minPeriods, periods),
    backfillDays: f.backfillDays,
    period: f.period,
    repeats: f.repeats,
    valid:
      (metric !== "daily" || (dailyTarget != null && dailyTarget > 0)) &&
      (!total || (totalTarget != null && totalTarget > 0)) &&
      (workouts || metric === "check" || unit != null) &&
      (startMode === "join" || validStart),
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
      workoutMode: p.metric === "total" || p.metric === "most" ? p.metric : "check",
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
      period: "days",
      repeats: false,
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
        period: rules.period,
        repeats: rules.repeats,
        isPublic: form.isPublic,
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

      <Section title="Sichtbarkeit">
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Sichtbarkeit">
          {[
            { value: true, label: "Öffentlich", hint: "Alle sehen sie unter Entdecken und können mitmachen. Punkte zählen für die Gesamtrangliste.", icon: Globe },
            { value: false, label: "Privat", hint: "Nur du siehst sie. Die Punkte zählen nicht für die Gesamtrangliste.", icon: Lock },
          ].map((o) => {
            const on = form.isPublic === o.value;
            // Machen schon andere mit, kann sie nicht mehr privat werden (sie verschwände für die anderen)
            const disabled = !o.value && locked && challenge?.isPublic;
            return (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={Boolean(disabled)}
                onClick={() => patch({ isPublic: o.value })}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-3 text-left transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
                  on ? "border-primary bg-primary/10" : "bg-card hover:bg-muted",
                )}
              >
                <o.icon className={cn("mt-0.5 size-5 shrink-0", on ? "text-primary" : "text-muted-foreground")} aria-hidden />
                <span>
                  <span className="block font-semibold">{o.label}</span>
                  <span className="block text-sm text-muted-foreground">{o.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        {locked && challenge?.isPublic ? <p className="mt-2 px-0.5 text-sm text-muted-foreground">Es machen schon andere mit, deshalb bleibt sie öffentlich.</p> : null}
      </Section>

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
                    // Der Wettkampf steht allein in der letzten Zeile
                    k.value === "most" && "col-span-2",
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
                  { value: "check", label: "An Tagen" },
                  { value: "total", label: "Anzahl" },
                  { value: "most", label: "Wer am meisten?" },
                ]}
              />
              {form.workoutMode === "total" ? (
                <AmountField id="challenge-total" label="Trainings insgesamt" value={form.totalTarget} onChange={(totalTarget) => patch({ totalTarget })} unit="Trainings" error={err("totalTarget")} />
              ) : null}
            </div>
          ) : null}

          {form.kind === "daily" || form.kind === "total" || form.kind === "most" ? (
            <div className="mt-3 space-y-3">
              <div className={cn("grid gap-3", form.kind !== "most" && "grid-cols-[minmax(0,8rem)_minmax(0,1fr)]")}>
                {form.kind === "most" ? null : (
                <AmountField
                  id="challenge-target"
                  label={form.kind === "daily" ? "Tagesziel" : "Gesamtziel"}
                  value={form.kind === "daily" ? form.dailyTarget : form.totalTarget}
                  onChange={(v) => patch(form.kind === "daily" ? { dailyTarget: v } : { totalTarget: v })}
                  error={err(form.kind === "daily" ? "dailyTarget" : "totalTarget")}
                />
                )}
                <div className="grid min-w-0 gap-1.5">
                  <label htmlFor="challenge-unit" className="text-sm font-medium">
                    {form.kind === "most" ? "Was wird gezählt?" : "Einheit"}
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

        {(rules.metric === "check" || rules.metric === "daily") && form.period === "days" ? (
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
          <RadioSegments
            label="Wie lange"
            value={form.period}
            onChange={(period) => patch({ period, ...(period !== "days" ? { frequency: "daily" as const, minMode: "all" as const } : {}) })}
            options={[
              { value: "days", label: "Tage" },
              { value: "month", label: "Monatsende" },
              { value: "year", label: "Jahresende" },
            ]}
          />
          {form.period === "days" ? (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {(weeklyUnit ? WEEK_DURATIONS.map((w) => w * 7) : DAY_DURATIONS).map((d) => (
                  <button key={d} type="button" aria-pressed={rules.durationDays === d} onClick={() => patch({ durationDays: d })} className={chipClass(rules.durationDays === d)}>
                    {weeklyUnit ? `${d / 7} Wochen` : `${d} Tage`}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                {weeklyUnit ? (
                  <DurationInput id="challenge-weeks" value={rules.durationDays / 7} max={52} onChange={(w) => patch({ durationDays: w * 7 })} unit={rules.durationDays === 7 ? "Woche" : "Wochen"} />
                ) : (
                  <DurationInput id="challenge-days" value={rules.durationDays} max={366} onChange={(durationDays) => patch({ durationDays })} unit={rules.durationDays === 1 ? "Tag" : "Tage"} />
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 rounded-2xl bg-muted/60 p-3 text-sm">
              {/^\d{4}-\d{2}-\d{2}$/.test(form.startsOn)
                ? `Vom ${dateLabel(form.startsOn)} bis ${dateLabel(roundAt(rules, 0).to)} (${rules.durationDays} ${rules.durationDays === 1 ? "Tag" : "Tage"}).`
                : "Bitte unten einen Starttag wählen."}
            </p>
          )}
          {err("durationDays") ? <p className="mt-2 text-sm text-destructive">{err("durationDays")}</p> : null}

          <label className="mt-3 flex min-h-14 items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-2">
            <span className="flex items-start gap-3">
              <Repeat className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                <span className="block font-medium">Danach neu starten</span>
                <span className="block text-sm text-muted-foreground">
                  {form.period === "month"
                    ? "Am 1. des nächsten Monats beginnt eine neue Runde, und so weiter."
                    : form.period === "year"
                      ? "Am 1. Januar beginnt eine neue Runde, und so weiter."
                      : "Nach dem letzten Tag beginnt sofort die nächste Runde mit gleicher Dauer."}{" "}
                  Wer mitmacht, ist automatisch wieder dabei; frühere Runden stehen in der Statistik.
                </span>
              </span>
            </span>
            <Switch checked={form.repeats} onCheckedChange={(repeats) => patch({ repeats })} />
          </label>
        </Section>

        <Section title="Start">
          {form.period === "days" && !form.repeats ? (
            <RadioSegments
              label="Start"
              value={form.startMode}
              onChange={(startMode) => patch({ startMode })}
              options={[
                { value: "fixed", label: "Gemeinsam" },
                { value: "join", label: "Ab Beitritt" },
              ]}
            />
          ) : null}
          <p className="mt-2 px-0.5 text-sm text-muted-foreground">
            {form.period !== "days" || form.repeats
              ? "Alle starten gemeinsam (bei Monats-/Jahresende und Wiederholung gibt es nur den gemeinsamen Start)."
              : rules.startMode === "fixed"
              ? rules.metric === "most"
                ? "Alle starten am selben Tag und haben dasselbe Ende. Nur so gibt es am Ende Punkte für Platz 1 bis 3."
                : "Alle starten am selben Tag. Das ist fair für die Rangliste."
              : "Jeder startet, wenn er beitritt, und hat dann seine eigenen Tage. Einsteigen geht jederzeit."}
          </p>
          {rules.startMode === "fixed" ? (
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
                  unit={
                    form.repeats
                      ? form.lateJoinDays === 0
                        ? "sonst ab der nächsten Runde"
                        : `${form.lateJoinDays === 1 ? "Tag" : "Tage"} nach Rundenstart, sonst ab der nächsten`
                      : form.lateJoinDays === 0
                        ? "nur bis zum Start"
                        : form.lateJoinDays === 1
                          ? "Tag nach Start"
                          : "Tage nach Start"
                  }
                />
              </div>
            </div>
          ) : null}
        </Section>

        {rules.metric === "check" || rules.metric === "daily" ? (
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

        {(rules.metric === "check" || rules.metric === "daily") && form.missedRule !== "strict" && form.period === "days" ? (
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

/** Dauer frei eingeben (Tage bzw. Wochen), mit Minus/Plus. Leeres Feld behält den letzten gültigen Wert. */
function DurationInput({ id, value, max, onChange, unit }: { id: string; value: number; max: number; onChange: (v: number) => void; unit: string }) {
  const [text, setText] = useState(String(value));
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setText(String(value));
  }
  const set = (n: number) => {
    const next = Math.min(max, Math.max(1, n));
    setText(String(next));
    onChange(next);
  };
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Dauer">
      <Button type="button" variant="outline" size="icon-lg" className="rounded-full" onClick={() => set(value - 1)} disabled={value <= 1} aria-label="Weniger">
        <Minus aria-hidden />
      </Button>
      <Input
        id={id}
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "").slice(0, 3);
          setText(raw);
          const n = Number(raw);
          if (raw && n >= 1) onChange(Math.min(max, n));
        }}
        onBlur={() => setText(String(value))}
        aria-label={`Dauer in ${unit}`}
        className="h-12 w-20 text-center text-lg font-semibold tabular-nums"
      />
      <Button type="button" variant="outline" size="icon-lg" className="rounded-full" onClick={() => set(value + 1)} disabled={value >= max} aria-label="Mehr">
        <Plus aria-hidden />
      </Button>
      <span className="min-w-0 text-sm text-muted-foreground">
        {unit} <span className="opacity-70">(höchstens {max})</span>
      </span>
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
