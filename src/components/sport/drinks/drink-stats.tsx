"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { ChartCard, DataTable } from "@/components/stats/chart-card";
import { Button } from "@/components/ui/button";
import {
  byDrink,
  CAFFEINE_LIMIT_MG,
  caffeineSources,
  caffeineSummary,
  dayTotals,
  daysOf,
  drinkColor,
  drinkRanking,
  entryKey,
  formatLiters,
  formatMg,
  periodLabel,
  periodRange,
  periodSummary,
  shiftPeriod,
  shortDate,
  timeOfDay,
  type Drink,
  type DrinkEntry,
  type StatsView,
} from "@/lib/domain/drinks";
import { addDays, weekdayShort } from "@/lib/domain/week";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DayBars, type DayBar } from "./day-bars";
import { DayDetail } from "./day-detail";
import { DrinkDot } from "./drink-parts";

const CAFFEINE_COLOR = drinkColor("braun");
const pct = (share: number) => `${formatNumber(Math.round(share * 100), 0)} %`;
const dayName = (iso: string) => `${weekdayShort(iso)}, ${shortDate(iso)}`;
/** Werte über den Balken: „1,8“ (Liter) */
const barLiters = (ml: number) => formatNumber(ml / 1000, 1);

/**
 * Statistik des Getränketrackers für eine Woche oder einen Monat. Zeitraum und gewählter Tag stehen in der Adresse
 * (`?ansicht=woche&datum=…`); Wechsel des Zeitraums lädt die Seite mit den Einträgen dieses Zeitraums neu.
 */
export function DrinkStats({
  view,
  date,
  today,
  goalMl,
  drinks,
  entries,
  streak,
  initialFilter,
}: {
  view: StatsView;
  /** gewählter Tag (bestimmt den Zeitraum) */
  date: string;
  today: string;
  goalMl: number;
  drinks: Drink[];
  entries: DrinkEntry[];
  streak: number;
  /** Getränke-Filter aus der Adresse (`?getraenk=`) */
  initialFilter: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(date);
  const [filter, setFilterState] = useState<string | null>(initialFilter);
  const [openSlot, setOpenSlot] = useState<string | null>(null);

  const { from, to } = periodRange(view, date);
  const days = useMemo(() => daysOf(from, to), [from, to]);
  const ranking = useMemo(() => drinkRanking(entries), [entries]);
  const filtered = useMemo(() => (filter ? entries.filter((e) => entryKey(e) === filter) : entries), [entries, filter]);
  const allTotals = useMemo(() => dayTotals(entries, days), [entries, days]);
  const totals = useMemo(() => dayTotals(filtered, days), [filtered, days]);
  const summary = periodSummary(totals, goalMl, today);
  const goalSummary = periodSummary(allTotals, goalMl, today);
  const caffeine = caffeineSummary(totals);
  const sources = useMemo(() => caffeineSources(filtered), [filtered]);
  const slots = useMemo(() => timeOfDay(filtered), [filtered]);
  const filterName = ranking.find((r) => r.key === filter)?.name;

  // Stapel an jedem Tag in derselben Reihenfolge: das im Zeitraum meistgetrunkene Getränk unten
  const bars: DayBar[] = useMemo(() => {
    const order = new Map(ranking.map((r, i) => [r.key, i]));
    return days.map((d) => ({
      date: d,
      future: d > today,
      parts: byDrink(filtered.filter((e) => e.date === d))
        .sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0))
        .map((p) => ({ key: p.key, color: drinkColor(p.color), value: p.ml })),
    }));
  }, [days, filtered, today, ranking]);
  const caffeineBars: DayBar[] = totals.map((t) => ({
    date: t.date,
    future: t.date > today,
    alert: t.caffeine > CAFFEINE_LIMIT_MG,
    parts: [{ key: "koffein", color: t.caffeine > CAFFEINE_LIMIT_MG ? "var(--destructive)" : CAFFEINE_COLOR, value: t.caffeine }],
  }));

  const nextPeriodBlocked = shiftPeriod(view, from, 1) > today;
  const href = (v: StatsView, d: string, f: string | null) => `${pathname}?ansicht=${v}&datum=${d}${f ? `&getraenk=${encodeURIComponent(f)}` : ""}`;

  function navigate(nextView: StatsView, nextDate: string) {
    startTransition(() => router.push(href(nextView, nextDate, filter), { scroll: false }));
  }

  function selectDay(d: string) {
    if (d > today) return;
    if (d < from || d > to) {
      navigate(view, d);
      return;
    }
    setSelected(d);
    // Gewählten Tag in der Adresse merken, ohne neu zu laden
    window.history.replaceState(null, "", href(view, d, filter));
  }

  function setFilter(next: string | null) {
    setFilterState(next);
    window.history.replaceState(null, "", href(view, selected, next));
  }

  function shift(step: -1 | 1) {
    if (step === 1 && nextPeriodBlocked) return;
    const next = shiftPeriod(view, selected, step);
    navigate(view, next > today ? today : next);
  }

  const dayEntries = entries.filter((e) => e.date === selected);

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

      {filterName ? (
        <button type="button" onClick={() => setFilter(null)} className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-primary/50 bg-primary/10 px-4 text-sm font-medium text-primary">
          Nur {filterName}
          <X className="size-4" aria-hidden />
          <span className="sr-only">Filter entfernen</span>
        </button>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Ø pro Tag" value={summary.avg != null ? formatLiters(summary.avg) : "–"} sub={summary.daysWithEntries === 1 ? "1 Tag mit Einträgen" : `${summary.daysWithEntries} Tage mit Einträgen`} />
        <Kpi label="Ziel erreicht" value={`${goalSummary.reached}/${goalSummary.elapsed}`} sub={`Tage mit ${formatLiters(goalMl, 1)}`} />
        <Kpi label="Gesamt" value={formatLiters(summary.total, 1)} sub={summary.best ? `bester Tag ${dayName(summary.best.date)} · ${formatLiters(summary.best.ml)}` : undefined} />
        <Kpi label="Serie" value={streak === 1 ? "1 Tag" : `${streak} Tage`} sub="Ziel am Stück erreicht" />
      </dl>

      <ChartCard
        title="Pro Tag"
        description="Nach Getränk gestapelt. Tipp auf einen Balken zeigt den Tag, Wischen wechselt den Zeitraum."
        table={<DataTable head={["Tag", "Menge", "Getränke"]} rows={totals.filter((t) => t.date <= today).map((t) => [dayName(t.date), formatLiters(t.ml), t.count])} />}
      >
        <DayBars
          bars={bars}
          lines={[
            ...(filter ? [] : [{ value: goalMl, label: `Ziel ${formatLiters(goalMl, 1)}`, kind: "dashed" as const }]),
            ...(summary.avg ? [{ value: summary.avg, label: `Ø ${formatLiters(summary.avg)}`, kind: "dotted" as const }] : []),
          ]}
          selected={selected}
          onSelect={selectDay}
          onSwipe={shift}
          format={(v) => barLiters(v)}
          describe={(v) => formatLiters(v)}
          label="Menge pro Tag"
          compact={view === "monat"}
        />
      </ChartCard>

      <DayDetail
        date={selected}
        entries={dayEntries}
        goalMl={goalMl}
        drinks={drinks}
        today={today}
        prev={
          <Button type="button" variant="ghost" size="icon" onClick={() => selectDay(addDays(selected, -1))} aria-label="Tag davor">
            <ChevronLeft aria-hidden />
          </Button>
        }
        next={
          <Button type="button" variant="ghost" size="icon" onClick={() => selectDay(addDays(selected, 1))} disabled={selected >= today} aria-label="Tag danach">
            <ChevronRight aria-hidden />
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="welche-getraenke">
          <h2 id="welche-getraenke" className="text-lg font-semibold">
            Welche Getränke
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">Tipp auf ein Getränk filtert die Statistik.</p>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">In diesem Zeitraum ist nichts eingetragen.</p>
          ) : (
            <ul className="space-y-1">
              {ranking.map((r) => (
                <li key={r.key}>
                  <button
                    type="button"
                    aria-pressed={filter === r.key}
                    onClick={() => setFilter(filter === r.key ? null : r.key)}
                    className={cn(
                      "grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-2xl px-3 py-2 text-left transition hover:bg-muted/50",
                      filter === r.key && "bg-primary/10 ring-2 ring-primary/40",
                      filter && filter !== r.key && "opacity-50",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      <DrinkDot color={r.color} />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {r.count}× · <span className="font-semibold text-foreground">{formatLiters(r.ml)}</span> · {pct(r.share)}
                    </span>
                    <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className="block h-full rounded-full" style={{ width: `${r.share * 100}%`, background: drinkColor(r.color) }} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="tageszeit">
          <h2 id="tageszeit" className="text-lg font-semibold">
            Tageszeit
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">Morgens 5–11, mittags 11–15, nachmittags 15–18, abends 18–23 Uhr.</p>
          <ul className="space-y-1">
            {slots.map((s) => {
              const open = openSlot === s.key;
              const tracked = new Set(s.entries.map((e) => e.date)).size;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenSlot(open ? null : s.key)}
                    className="grid min-h-12 w-full grid-cols-[6.5rem_minmax(0,1fr)_auto_1rem] items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-muted/50"
                  >
                    <span className="font-medium">{s.label}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className="block h-full rounded-full bg-sport" style={{ width: `${s.share * 100}%` }} />
                    </span>
                    <span className="text-sm tabular-nums">
                      <span className="font-semibold">{formatLiters(s.ml)}</span> <span className="text-muted-foreground">· {pct(s.share)}</span>
                    </span>
                    <ChevronDown className={cn("size-4 text-muted-foreground transition", open && "rotate-180")} aria-hidden />
                  </button>
                  {open ? (
                    <div className="mx-3 mb-2 rounded-2xl bg-muted/50 p-3 text-sm">
                      {s.entries.length === 0 ? (
                        <p className="text-muted-foreground">Zu dieser Tageszeit nichts eingetragen.</p>
                      ) : (
                        <>
                          <p className="mb-2 text-muted-foreground tabular-nums">
                            {s.entries.length === 1 ? "1 Getränk" : `${s.entries.length} Getränke`} an {tracked === 1 ? "1 Tag" : `${tracked} Tagen`} · Ø{" "}
                            {formatLiters(s.ml / tracked)} pro Tag
                          </p>
                          <ul className="space-y-1">
                            {byDrink(s.entries).map((d) => (
                              <li key={d.key} className="flex items-center justify-between gap-3">
                                <span className="flex min-w-0 items-center gap-2">
                                  <DrinkDot color={d.color} />
                                  <span className="truncate">{d.name}</span>
                                </span>
                                <span className="tabular-nums">
                                  {d.count}× · {formatLiters(d.ml)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <ChartCard
        title="Koffein"
        description={`Milligramm pro Tag. Bis ${CAFFEINE_LIMIT_MG} mg am Tag gelten für gesunde Erwachsene als unbedenklich (EFSA); Tage darüber sind rot.`}
        table={<DataTable head={["Tag", "Koffein"]} rows={totals.filter((t) => t.date <= today).map((t) => [dayName(t.date), formatMg(t.caffeine)])} />}
      >
        <DayBars
          bars={caffeineBars}
          lines={[{ value: CAFFEINE_LIMIT_MG, label: `${CAFFEINE_LIMIT_MG} mg`, kind: "dashed" }]}
          selected={selected}
          onSelect={selectDay}
          onSwipe={shift}
          format={(v) => formatNumber(Math.round(v), 0)}
          describe={(v) => `${formatMg(v)} Koffein`}
          label="Koffein pro Tag"
          compact={view === "monat"}
        />
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Tile label="Ø pro Tag" value={caffeine.avg != null ? formatMg(caffeine.avg) : "–"} />
          <Tile label="Gesamt" value={formatMg(caffeine.total)} />
          <Tile label="Höchster Tag" value={caffeine.max ? formatMg(caffeine.max.caffeine) : "–"} sub={caffeine.max ? dayName(caffeine.max.date) : undefined} />
          <Tile label="Über 400 mg" value={caffeine.over === 1 ? "1 Tag" : `${caffeine.over} Tage`} alert={caffeine.over > 0} />
          <Tile label="Koffeinfrei" value={caffeine.free === 1 ? "1 Tag" : `${caffeine.free} Tage`} />
        </dl>
        {sources.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Koffeinquellen</h3>
            <ul className="space-y-2">
              {sources.map((s) => (
                <li key={s.key} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <DrinkDot color={s.color} />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full" style={{ width: `${s.share * 100}%`, background: drinkColor(s.color) }} />
                  </span>
                  <span className="tabular-nums">
                    <span className="font-semibold">{formatMg(s.caffeine)}</span> <span className="text-muted-foreground">· {pct(s.share)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </ChartCard>

    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-3xl border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold whitespace-nowrap tabular-nums">{value}</dd>
      {sub ? <dd className="text-xs text-muted-foreground">{sub}</dd> : null}
    </div>
  );
}

function Tile({ label, value, sub, alert }: { label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-heading text-lg leading-tight font-semibold tabular-nums", alert && "text-destructive")}>{value}</dd>
      {sub ? <dd className="text-xs text-muted-foreground">{sub}</dd> : null}
    </div>
  );
}
