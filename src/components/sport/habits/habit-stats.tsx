"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import { DayBars, type DayBar } from "@/components/sport/drinks/day-bars";
import { ChartCard, DataTable } from "@/components/stats/chart-card";
import { Button } from "@/components/ui/button";
import { daysOf, drinkColor, longDate, periodLabel, periodRange, shiftPeriod, shortDate, type StatsView } from "@/lib/domain/drinks";
import {
  countOn,
  dayRates,
  habitPeriodStats,
  habitStreak,
  isDueOn,
  nextCount,
  periodKpis,
  periodProgress,
  scheduleLabel,
  streakLabel,
  WEEKDAYS,
  weekdayRates,
  type CellState,
  type Habit,
  type HabitCheck,
  type HabitKind,
} from "@/lib/domain/habits";
import { addDays, isoWeekNumber, mondayOf, weekdayShort } from "@/lib/domain/week";
import { cn } from "@/lib/utils";
import { CheckButton, HabitIcon, percent } from "./habit-parts";
import { HabitSheet } from "./habit-sheet";
import { useHabitCounts } from "./use-habit-counts";

type KindFilter = "alle" | HabitKind;
const KIND_FILTERS: { key: KindFilter; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "habit", label: "Gewohnheiten" },
  { key: "supplement", label: "Supplemente" },
];
const dayName = (iso: string) => `${weekdayShort(iso)}, ${shortDate(iso)}`;

/**
 * Statistik des Habit Trackers für eine Woche oder einen Monat (`?ansicht=woche|monat&datum=…&habit=…`): Kennzahlen,
 * erledigt pro Tag (antippen wählt den Tag, Wischen wechselt den Zeitraum), der gewählte Tag zum Nachtragen, die
 * Übersicht aller Habits Tag für Tag (antippen filtert), Serien und Wochentage.
 */
export function HabitStats({
  view,
  date,
  today,
  habits,
  checks,
  historyFrom,
  initialHabit,
}: {
  view: StatsView;
  date: string;
  today: string;
  habits: Habit[];
  /** Häkchen von `historyFrom` bis Ende des Zeitraums (für Serien und Wochentage) */
  checks: HabitCheck[];
  historyFrom: string;
  initialHabit: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(date);
  const [habitId, setHabitIdState] = useState<string | null>(initialHabit);
  const [kind, setKind] = useState<KindFilter>("alle");
  const [editing, setEditing] = useState<Habit | null>(null);
  const { index, setCount } = useHabitCounts(checks);

  const { from, to } = periodRange(view, date);
  const days = useMemo(() => daysOf(from, to), [from, to]);
  // Nur Habits, die im Zeitraum liefen
  const inPeriod = habits.filter((h) => h.startDate <= to && (h.pausedOn == null || h.pausedOn > from));
  const byKind = inPeriod.filter((h) => kind === "alle" || h.kind === kind);
  const focus = byKind.find((h) => h.id === habitId) ?? null;
  const shown = focus ? [focus] : byKind;

  const stats = byKind.map((h) => habitPeriodStats(h, index, from, to, today));
  const shownStats = focus ? stats.filter((s) => s.habit.id === focus.id) : stats;
  const rates = dayRates(shown, index, from, to, today);
  const kpis = periodKpis(shownStats, rates, today);
  const streaks = new Map(byKind.map((h) => [h.id, habitStreak(h, index, today, historyFrom)]));
  const bestStreak = [...streaks.entries()]
    .map(([id, s]) => ({ habit: byKind.find((h) => h.id === id)!, ...s }))
    .filter((s) => !focus || s.habit.id === focus.id)
    .sort((a, b) => b.current - a.current)[0];
  const weekdays = weekdayRates(shown, index, today);

  // Gewählte Gewohnheit wöchentlich/monatlich: Balken zeigen Häkchen je Tag statt Prozent
  const countMode = focus != null && focus.frequency !== "daily";
  const bars: DayBar[] = rates.map((r) => {
    const value = countMode ? countOn(index, focus.id, r.date) : r.due > 0 ? (r.done / r.due) * 100 : 0;
    const color = focus ? drinkColor(focus.color) : r.due > 0 && r.done >= r.due ? "var(--sage)" : "var(--sport)";
    return { date: r.date, future: r.future, parts: value > 0 ? [{ key: "x", color, value }] : [] };
  });
  const elapsedRates = rates.filter((r) => !r.future && r.due > 0);
  const avg = !countMode && elapsedRates.length ? (elapsedRates.reduce((s, r) => s + r.done / r.due, 0) / elapsedRates.length) * 100 : null;

  const nextPeriodBlocked = shiftPeriod(view, from, 1) > today;
  const href = (v: StatsView, d: string, h: string | null) => `${pathname}?ansicht=${v}&datum=${d}${h ? `&habit=${h}` : ""}`;

  function navigate(nextView: StatsView, nextDate: string) {
    startTransition(() => router.push(href(nextView, nextDate, habitId), { scroll: false }));
  }

  function selectDay(d: string) {
    if (d > today) return;
    if (d < from || d > to) {
      navigate(view, d);
      return;
    }
    setSelected(d);
    window.history.replaceState(null, "", href(view, d, habitId));
  }

  function setHabitId(next: string | null) {
    setHabitIdState(next);
    window.history.replaceState(null, "", href(view, selected, next));
  }

  function shift(step: -1 | 1) {
    if (step === 1 && nextPeriodBlocked) return;
    const next = shiftPeriod(view, selected, step);
    navigate(view, next > today ? today : next);
  }

  function tap(h: Habit, d: string) {
    const current = countOn(index, h.id, d);
    setCount(h.id, d, nextCount(current, h.target, h.frequency), current);
  }

  const dayHabits = shown.filter((h) => isDueOn(h, selected));

  return (
    <div className={cn("space-y-6 transition-opacity", pending && "opacity-60")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full border bg-card p-0.5" role="group" aria-label="Zeitraum">
          {(["woche", "monat"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => v !== view && navigate(v, selected)}
              className={cn(
                "h-11 rounded-full px-5 text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                view === v && "bg-primary/15 text-primary hover:text-primary",
              )}
            >
              {v === "woche" ? "Woche" : "Monat"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={() => shift(-1)} aria-label={view === "woche" ? "Woche davor" : "Monat davor"}>
            <ChevronLeft aria-hidden />
          </Button>
          <span className="min-w-36 text-center text-sm font-semibold tabular-nums">{periodLabel(view, date)}</span>
          <Button type="button" variant="ghost" size="icon" onClick={() => shift(1)} disabled={nextPeriodBlocked} aria-label={view === "woche" ? "Woche danach" : "Monat danach"}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Art">
        {KIND_FILTERS.map((k) => (
          <button
            key={k.key}
            type="button"
            aria-pressed={kind === k.key}
            onClick={() => {
              setKind(k.key);
              if (focus && k.key !== "alle" && focus.kind !== k.key) setHabitId(null);
            }}
            className={cn(
              "inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              kind === k.key ? "border-primary/60 bg-primary/15 text-primary" : "bg-card hover:bg-muted",
            )}
          >
            {k.label}
          </button>
        ))}
        {focus ? (
          <button type="button" onClick={() => setHabitId(null)} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border-2 border-primary/50 bg-primary/10 px-4 text-sm font-medium whitespace-nowrap text-primary">
            Nur {focus.name}
            <X className="size-4" aria-hidden />
            <span className="sr-only">Filter entfernen</span>
          </button>
        ) : null}
      </div>

      {inPeriod.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-6 text-center text-sm text-muted-foreground">In diesem Zeitraum gab es noch keine Habits.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Erfüllt" value={kpis.rate != null ? percent(kpis.rate) : "–"} sub="von allem, was dran war" good={kpis.rate != null && kpis.rate >= 0.8} />
            <Kpi label="Perfekte Tage" value={`${kpis.perfect}/${kpis.days}`} sub="alle Täglichen erledigt" />
            <Kpi label="Abgehakt" value={`${kpis.total}×`} sub={focus ? focus.name : `${byKind.length} Habits`} />
            <Kpi
              label={focus ? "Serie" : "Beste laufende Serie"}
              value={bestStreak ? streakLabel(bestStreak.current, bestStreak.unit) : "–"}
              sub={bestStreak ? (focus ? `Rekord ${streakLabel(bestStreak.best, bestStreak.unit)}` : bestStreak.habit.name) : undefined}
            />
          </dl>

          {focus ? (
            <section className="flex items-center gap-3 rounded-3xl border bg-card p-4" aria-label={focus.name}>
              <HabitIcon kind={focus.kind} color={focus.color} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {focus.name}
                  {focus.dose ? <span className="font-normal text-muted-foreground"> · {focus.dose}</span> : null}
                </span>
                <span className="block truncate text-sm text-muted-foreground">{scheduleLabel(focus)}</span>
                {focus.notes ? <span className="block truncate text-xs text-muted-foreground">{focus.notes}</span> : null}
              </span>
              <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => setEditing(focus)} aria-label={`${focus.name} bearbeiten`}>
                <Pencil aria-hidden />
              </Button>
            </section>
          ) : null}

          <ChartCard
            title={countMode ? "Abgehakt pro Tag" : "Erledigt pro Tag"}
            description={
              countMode
                ? "Wie oft an jedem Tag abgehakt. Tipp auf einen Balken zeigt den Tag, Wischen wechselt den Zeitraum."
                : "Anteil der täglichen Habits, die an dem Tag dran waren; grün = alles geschafft. Tipp auf einen Balken zeigt den Tag, Wischen wechselt den Zeitraum."
            }
            table={
              <DataTable
                head={countMode ? ["Tag", "Abgehakt"] : ["Tag", "Erledigt", "Anteil"]}
                rows={rates
                  .filter((r) => !r.future)
                  .map((r) => (countMode ? [dayName(r.date), `${countOn(index, focus.id, r.date)}×`] : [dayName(r.date), `${r.done}/${r.due}`, r.due ? percent(r.done / r.due) : "–"]))}
              />
            }
          >
            <DayBars
              bars={bars}
              lines={countMode ? [] : [{ value: 100, label: "100 %", kind: "dashed" }, ...(avg != null ? [{ value: avg, label: `Ø ${percent(avg / 100)}`, kind: "dotted" as const }] : [])]}
              selected={selected}
              onSelect={selectDay}
              onSwipe={shift}
              format={(v) => (countMode ? `${v}×` : `${Math.round(v)}`)}
              describe={(v) => (countMode ? `${v}× abgehakt` : `${Math.round(v)} % erledigt`)}
              label={countMode ? "Abgehakt pro Tag" : "Erledigt pro Tag"}
              compact={view === "monat"}
            />
          </ChartCard>

          <section className="rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="tag-detail">
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="icon" onClick={() => selectDay(addDays(selected, -1))} aria-label="Tag davor">
                <ChevronLeft aria-hidden />
              </Button>
              <div className="min-w-0 text-center">
                <h2 id="tag-detail" className="font-semibold">
                  {selected === today ? "Heute" : longDate(selected)}
                </h2>
                <p className="text-sm text-muted-foreground">Antippen hakt ab oder trägt nach</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => selectDay(addDays(selected, 1))} disabled={selected >= today} aria-label="Tag danach">
                <ChevronRight aria-hidden />
              </Button>
            </div>
            {dayHabits.length === 0 ? (
              <p className="mt-3 text-center text-sm text-muted-foreground">An diesem Tag war nichts dran.</p>
            ) : (
              <ul className="mt-3 divide-y">
                {dayHabits.map((h) => {
                  const count = countOn(index, h.id, selected);
                  const periodic = h.frequency !== "daily";
                  const progress = periodProgress(h, index, selected);
                  return (
                    <li key={h.id} className="flex min-h-14 items-center gap-3 py-1.5">
                      <HabitIcon kind={h.kind} color={h.color} className="size-9" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{h.name}</span>
                        <span className="block truncate text-xs text-muted-foreground tabular-nums">
                          {periodic ? `${progress.done}/${progress.target} ${h.frequency === "weekly" ? "in der Woche" : "im Monat"}` : h.target > 1 ? `${count}/${h.target} am Tag` : h.dose ?? " "}
                        </span>
                      </span>
                      <CheckButton
                        size="md"
                        count={count}
                        target={periodic ? 1 : h.target}
                        color={h.color}
                        periodMet={periodic && progress.met}
                        onClick={() => tap(h, selected)}
                        label={`${h.name} am ${dayName(selected)}: ${count > 0 ? `${count}× abgehakt` : "nicht abgehakt"}`}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="uebersicht">
            <h2 id="uebersicht" className="text-lg font-semibold">
              {view === "woche" ? "Wochenübersicht" : "Monatsübersicht"}
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">Alle Habits Tag für Tag. Tipp auf einen Namen filtert die Statistik, auf ein Kästchen zeigt den Tag.</p>
            <Legend />
            {view === "woche" ? (
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_repeat(7,1.75rem)] items-center gap-x-1 sm:grid-cols-[minmax(0,1fr)_repeat(7,2.25rem)]" aria-hidden>
                <span />
                {days.map((d) => (
                  <span key={d} className={cn("text-center text-[0.7rem] text-muted-foreground", d === selected && "font-semibold text-foreground")}>
                    {weekdayShort(d)}
                  </span>
                ))}
              </div>
            ) : null}
            <ul className="mt-1 space-y-1">
              {stats.map((s) => {
                const h = s.habit;
                const streak = streaks.get(h.id);
                const isFocus = focus?.id === h.id;
                const periodText =
                  h.frequency === "daily"
                    ? null
                    : s.periods.length
                      ? s.periods.map((p) => `${p.done}/${p.target}`).join(" · ")
                      : `${periodProgress(h, index, to < today ? to : today).done}/${h.target} im Monat`;
                const nameButton = (
                  <button
                    type="button"
                    aria-pressed={isFocus}
                    onClick={() => setHabitId(isFocus ? null : h.id)}
                    className={cn("flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-1 text-left transition hover:bg-muted/50", focus && !isFocus && "opacity-50")}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: drinkColor(h.color) }} aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{h.name}</span>
                      <span className="block truncate text-xs text-muted-foreground tabular-nums">
                        {[s.rate != null ? percent(s.rate) : null, periodText, streak && streak.current > 0 ? `Serie ${streakLabel(streak.current, streak.unit)}` : null]
                          .filter(Boolean)
                          .join(" · ") || "–"}
                      </span>
                    </span>
                  </button>
                );
                const cells = s.cells.map((c) => (
                  <button
                    key={c.date}
                    type="button"
                    onClick={() => selectDay(c.date)}
                    disabled={c.state === "future"}
                    aria-label={`${h.name}, ${dayName(c.date)}: ${CELL_LABELS[c.state]}${c.count > 1 ? ` (${c.count}×)` : ""}`}
                    className={cn(
                      "rounded-md transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      view === "woche" ? "size-7 sm:size-9" : "h-5 min-w-0 flex-1 rounded-[3px]",
                      c.date === selected && "ring-2 ring-foreground/70 ring-offset-1 ring-offset-card",
                      focus && !isFocus && "opacity-50",
                    )}
                    style={cellStyle(c.state, h.color)}
                  />
                ));
                return view === "woche" ? (
                  <li key={h.id} className="grid grid-cols-[minmax(0,1fr)_repeat(7,1.75rem)] items-center gap-x-1 sm:grid-cols-[minmax(0,1fr)_repeat(7,2.25rem)]">
                    {nameButton}
                    {cells}
                  </li>
                ) : (
                  <li key={h.id} className="py-1">
                    {nameButton}
                    <div className="mt-1 flex gap-px">{cells}</div>
                  </li>
                );
              })}
            </ul>
            {view === "monat" ? (
              <div className="mt-1 flex gap-px text-[0.65rem] text-muted-foreground tabular-nums" aria-hidden>
                {days.map((d) => {
                  const n = Number(d.slice(8));
                  return (
                    <span key={d} className="min-w-0 flex-1 text-center">
                      {n === 1 || n % 5 === 0 ? n : ""}
                    </span>
                  );
                })}
              </div>
            ) : null}
            {view === "monat" ? (
              <details className="mt-3 text-sm">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-muted-foreground hover:text-foreground">Wochen im Monat</summary>
                <DataTable
                  head={["Habit", ...weeksOf(from, to).map((w) => `KW ${isoWeekNumber(w)}`)]}
                  rows={stats.map((s) => [
                    s.habit.name,
                    ...weeksOf(from, to).map((monday) => {
                      const sunday = addDays(monday, 6);
                      const r = habitPeriodStats(s.habit, index, monday < from ? from : monday, sunday > to ? to : sunday, today);
                      if (s.habit.frequency === "weekly") {
                        const p = s.periods.find((x) => x.from === monday);
                        return p ? `${p.done}/${p.target}` : "–";
                      }
                      return r.rate != null ? percent(r.rate) : r.total ? `${r.total}×` : "–";
                    }),
                  ])}
                />
              </details>
            ) : null}
          </section>

          <ChartCard
            title="Wochentage"
            description="Erledigte tägliche Habits je Wochentag in den letzten 12 Wochen. Wo hakt es?"
            table={<DataTable head={["Tag", "Erledigt", "Anteil"]} rows={weekdays.map((w) => [WEEKDAYS[w.weekday - 1].long, `${w.done}/${w.due}`, w.rate != null ? percent(w.rate) : "–"])} />}
          >
            {weekdays.every((w) => w.rate == null) ? (
              <p className="text-sm text-muted-foreground">Noch keine täglichen Habits mit Daten.</p>
            ) : (
              <ul className="space-y-1.5">
                {weekdays.map((w) => (
                  <li key={w.weekday} className="grid grid-cols-[2rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
                    <span className="font-medium">{WEEKDAYS[w.weekday - 1].short}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className={cn("block h-full rounded-full", w.rate != null && w.rate >= 0.8 ? "bg-sage" : "bg-sport")} style={{ width: `${(w.rate ?? 0) * 100}%` }} />
                    </span>
                    <span className="text-right font-semibold tabular-nums">{w.rate != null ? percent(w.rate) : "–"}</span>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </>
      )}

      {editing ? <HabitSheet key={editing.id} habit={editing} habits={habits} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

/** Montage der Wochen, die den Zeitraum berühren. */
function weeksOf(from: string, to: string): string[] {
  const out: string[] = [];
  for (let monday = mondayOf(from); monday <= to; monday = addDays(monday, 7)) out.push(monday);
  return out;
}

const CELL_LABELS: Record<CellState, string> = {
  done: "erledigt",
  partial: "teilweise",
  missed: "verpasst",
  open: "noch offen",
  off: "nicht dran",
  checked: "abgehakt",
  none: "nicht abgehakt",
  inactive: "lief noch nicht oder pausiert",
  future: "noch nicht",
};

function cellStyle(state: CellState, color: string): React.CSSProperties {
  const c = drinkColor(color);
  switch (state) {
    case "done":
    case "checked":
      return { background: c };
    case "partial":
      return { background: `color-mix(in srgb, ${c} 45%, var(--card))` };
    case "missed":
      return { background: "var(--muted)" };
    case "none":
      return { background: "color-mix(in srgb, var(--muted) 60%, var(--card))" };
    case "open":
      return { boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${c} 60%, transparent)` };
    case "off":
      return { background: "radial-gradient(circle, var(--border) 2px, transparent 2.5px)" };
    case "future":
      return { background: "color-mix(in srgb, var(--muted) 35%, transparent)" };
    default:
      return {};
  }
}

function Legend() {
  const items: { state: CellState; label: string }[] = [
    { state: "done", label: "erledigt" },
    { state: "partial", label: "teilweise" },
    { state: "missed", label: "verpasst" },
    { state: "off", label: "nicht dran" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
      {items.map((i) => (
        <li key={i.state} className="flex items-center gap-1.5">
          <span className="size-3.5 rounded" style={cellStyle(i.state, "blau")} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function Kpi({ label, value, sub, good }: { label: string; value: string; sub?: string; good?: boolean }) {
  return (
    <div className="rounded-3xl border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 truncate text-2xl font-semibold whitespace-nowrap tabular-nums", good && "text-sage")}>{value}</dd>
      {sub ? <dd className="truncate text-xs text-muted-foreground">{sub}</dd> : null}
    </div>
  );
}
