"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { ChipRow } from "@/components/layout/list-blocks";
import { chipClass } from "@/components/recipes/chip-select";
import { ChartCard, CHART_COLORS, DataTable } from "@/components/stats/chart-card";
import { WeekSeries } from "@/components/stats/week-series";
import { NativeSelect } from "@/components/ui/native-select";
import { isTimed, MUSCLE_LABELS } from "@/lib/domain/exercises";
import { dayMonth, mondayOf, weekdayShort } from "@/lib/domain/week";
import { mmss } from "@/lib/domain/workout";
import {
  exerciseOptions,
  exerciseProgress,
  exerciseRecords,
  inRange,
  mondaysBetween,
  RANGE_LABELS,
  rangeStart,
  recentRecords,
  setsPerMuscle,
  statsTotals,
  streakWeeks,
  trainingCalendar,
  weeklyStats,
  type RecentRecord,
  type StatsRange,
  type StatsWorkout,
} from "@/lib/domain/workout-stats";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ExerciseProgressChart } from "./exercise-progress-chart";

const RANGES: StatsRange[] = ["4w", "3m", "1j", "alle"];
const kg = (v: number) => `${formatNumber(Math.round(v), 0)} kg`;
/** Große Mengen kompakt: „64,1 t“ statt „64.099 kg“ */
const tons = (v: number) => (v >= 10000 ? `${formatNumber(v / 1000, 1)} t` : kg(v));
/** Gesamtzeit kompakt: „45 Min.“, „28 Std.“ */
const hours = (minutes: number) => (minutes < 120 ? `${minutes} Min.` : `${formatNumber(Math.round(minutes / 60), 0)} Std.`);
const date = (iso: string) => `${weekdayShort(iso)}, ${dayMonth(iso)}`;

function recordValue(r: RecentRecord): string {
  if (r.kind === "time") return mmss(r.value);
  if (r.kind === "distance") return `${formatNumber(r.value / 1000, 2)} km`;
  if (r.kind === "reps") return `${r.value} Wdh.`;
  return `${formatNumber(r.value, 1)} kg`;
}

const RECORD_LABEL: Record<RecentRecord["kind"], string> = {
  "1rm": "geschätztes 1RM",
  weight: "Gewicht",
  reps: "Wiederholungen",
  time: "Zeit",
  distance: "Strecke",
};

/**
 * Sport-Statistik: Zeitraum als Chips, Kennzahlen, Trainings/Volumen/Dauer je Woche, Verlauf und Bestwerte je Übung,
 * Sätze pro Muskelgruppe, Kalender der Trainingstage und neue Bestwerte.
 */
export function SportStatsDashboard({ workouts, today }: { workouts: StatsWorkout[]; today: string }) {
  const [range, setRange] = useState<StatsRange>("3m");
  const from = rangeStart(range, today);
  const visible = useMemo(() => inRange(workouts, from), [workouts, from]);
  const mondays = useMemo(
    () => mondaysBetween(from ?? workouts[0]?.date ?? today, today),
    [from, workouts, today],
  );
  const weeks = useMemo(() => weeklyStats(visible, mondays), [visible, mondays]);
  const totals = useMemo(() => statsTotals(visible, mondays.length), [visible, mondays.length]);
  const streak = useMemo(() => streakWeeks(workouts, today), [workouts, today]);
  const options = useMemo(() => exerciseOptions(visible), [visible]);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const exercise = options.find((o) => o.id === exerciseId) ?? options[0] ?? null;
  const sessions = useMemo(() => (exercise ? exerciseProgress(visible, exercise.id) : []), [visible, exercise]);
  const records = useMemo(() => exerciseRecords(sessions), [sessions]);
  const muscles = useMemo(() => setsPerMuscle(visible, mondays.length), [visible, mondays.length]);
  const calendar = useMemo(() => trainingCalendar(workouts, today, 12), [workouts, today]);
  const latestRecords = useMemo(() => recentRecords(visible), [visible]);
  const maxMuscle = Math.max(20, ...muscles.map((m) => m.perWeek));

  return (
    <div className="space-y-6">
      <ChipRow label="Zeitraum">
        {RANGES.map((r) => (
          <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)} className={chipClass(range === r)}>
            {RANGE_LABELS[r]}
          </button>
        ))}
      </ChipRow>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Trainings" value={formatNumber(totals.workouts, 0)} sub={totals.perWeek != null ? `${formatNumber(totals.perWeek, 1)} pro Woche` : undefined} />
        <Kpi label="Ø Dauer" value={totals.avgMinutes != null ? `${totals.avgMinutes} Min.` : "–"} sub={totals.minutes ? `insgesamt ${hours(totals.minutes)}` : undefined} />
        <Kpi label="Volumen" value={tons(totals.volumeKg)} sub={`${formatNumber(totals.sets, 0)} Arbeitssätze`} />
        <Kpi label="Serie" value={String(streak)} sub={streak === 1 ? "Woche am Stück" : "Wochen am Stück"} />
      </dl>

      {visible.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">In diesem Zeitraum gibt es kein Training.</p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Trainings pro Woche"
              table={<DataTable head={["Woche ab", "Trainings", "Minuten"]} rows={weeks.map((w) => [dayMonth(w.monday), w.workouts, w.minutes])} />}
            >
              <WeekSeries points={weeks.map((w) => ({ monday: w.monday, value: w.workouts }))} kind="bar" color={CHART_COLORS[0]} label="Trainings" format={(v) => formatNumber(v, 0)} />
            </ChartCard>
            <ChartCard
              title="Volumen pro Woche"
              description="Gewicht × Wiederholungen aller Arbeitssätze."
              table={<DataTable head={["Woche ab", "Volumen", "Sätze"]} rows={weeks.map((w) => [dayMonth(w.monday), kg(w.volumeKg), w.sets])} />}
            >
              <WeekSeries
                points={weeks.map((w) => ({ monday: w.monday, value: w.volumeKg || null }))}
                kind="bar"
                color={CHART_COLORS[0]}
                label="Volumen"
                format={(v) => (v >= 10000 ? `${formatNumber(v / 1000, 0)} t` : formatNumber(Math.round(v), 0))}
              />
            </ChartCard>
          </div>

          <ChartCard
            title="Übung im Verlauf"
            description="Ein Punkt je Training. Tipp auf einen Punkt öffnet das Training."
            table={
              exercise ? (
                <DataTable
                  head={isTimed(exercise.tracking) ? ["Datum", "Bestwert", "Sätze"] : ["Datum", "Schwerster Satz", "Geschätztes 1RM", "Volumen"]}
                  rows={sessions.map((s) =>
                    isTimed(exercise.tracking)
                      ? [date(s.date), exercise.tracking === "time" ? (s.maxSeconds != null ? mmss(s.maxSeconds) : "–") : s.maxDistanceM != null ? `${formatNumber(s.maxDistanceM / 1000, 2)} km` : "–", s.sets]
                      : [
                          date(s.date),
                          s.bestWeightKg != null ? `${formatNumber(s.bestWeightKg, 1)} kg × ${s.bestWeightReps ?? "–"}` : s.maxReps != null ? `× ${s.maxReps}` : "–",
                          s.best1RM != null ? `${formatNumber(s.best1RM, 1)} kg` : "–",
                          kg(s.volumeKg),
                        ],
                  )}
                />
              ) : undefined
            }
          >
            {exercise ? (
              <>
                <NativeSelect value={exercise.id} onChange={(e) => setExerciseId(e.target.value)} aria-label="Übung" className="max-w-md">
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.sessions}×)
                    </option>
                  ))}
                </NativeSelect>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {isTimed(exercise.tracking) ? (
                    exercise.tracking === "time" ? (
                      <RecordTile label="Längster Satz" value={records.seconds ? mmss(records.seconds.value) : "–"} date={records.seconds?.date} />
                    ) : (
                      <RecordTile label="Längste Strecke" value={records.distance ? `${formatNumber(records.distance.value / 1000, 2)} km` : "–"} date={records.distance?.date} />
                    )
                  ) : (
                    <>
                      <RecordTile label="Schwerster Satz" value={records.weight ? `${formatNumber(records.weight.value, 1)} kg` : "–"} detail={records.weight?.detail} date={records.weight?.date} />
                      <RecordTile label="Geschätztes 1RM" value={records.oneRM ? `${formatNumber(records.oneRM.value, 1)} kg` : "–"} date={records.oneRM?.date} />
                      <RecordTile label="Bestes Volumen" value={records.volume ? kg(records.volume.value) : "–"} date={records.volume?.date} />
                      <RecordTile label="Meiste Wdh." value={records.reps ? String(records.reps.value) : "–"} date={records.reps?.date} />
                    </>
                  )}
                </dl>
                {sessions.length > 1 ? (
                  <ExerciseProgressChart sessions={sessions} tracking={exercise.tracking} />
                ) : (
                  <p className="text-sm text-muted-foreground">Ab zwei Trainings mit dieser Übung siehst du hier den Verlauf.</p>
                )}
                {exercise.tracking === "weight_reps" ? (
                  <p className="text-xs text-muted-foreground">
                    Das 1RM ist geschätzt (Epley-Formel aus Sätzen mit bis zu 12 Wiederholungen), nicht gemessen.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine Übung mit erledigten Sätzen.</p>
            )}
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Sätze pro Muskelgruppe"
              description="Arbeitssätze pro Woche im Zeitraum, Nebenmuskeln zählen halb. Für Muskelaufbau gelten etwa 10–20 Sätze pro Woche als guter Bereich (Band)."
              table={<DataTable head={["Muskelgruppe", "pro Woche", "gesamt"]} rows={muscles.map((m) => [MUSCLE_LABELS[m.muscle], formatNumber(m.perWeek, 1), formatNumber(m.total, 1)])} />}
            >
              <ul className="grid gap-2.5">
                {muscles.map((m) => (
                  <li key={m.muscle} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3rem] items-center gap-2 text-sm">
                    <span className="truncate">{MUSCLE_LABELS[m.muscle]}</span>
                    <span className="relative h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
                      {/* Band 10–20 Sätze */}
                      <span
                        className="absolute inset-y-0 bg-sage/20"
                        style={{ left: `${(10 / maxMuscle) * 100}%`, width: `${(10 / maxMuscle) * 100}%` }}
                      />
                      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(m.perWeek / maxMuscle) * 100}%`, background: CHART_COLORS[0] }} />
                    </span>
                    <span className="text-right font-medium tabular-nums">{formatNumber(m.perWeek, 1)}</span>
                  </li>
                ))}
              </ul>
            </ChartCard>

            <ChartCard
              title="Trainingstage"
              description="Die letzten 12 Wochen, eine Zeile pro Woche (Mo–So)."
              table={
                <DataTable
                  head={["Woche ab", "Trainings"]}
                  rows={calendar.map((w) => [dayMonth(w.monday), w.days.reduce((n, d) => n + (d.count ?? 0), 0)])}
                />
              }
            >
              <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-1 text-xs text-muted-foreground">
                <span />
                {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                  <span key={d} className="text-center">
                    {d}
                  </span>
                ))}
                {calendar.map((w) => (
                  <Week key={w.monday} monday={w.monday} days={w.days} current={w.monday === mondayOf(today)} />
                ))}
              </div>
            </ChartCard>
          </div>

          <ChartCard
            title="Dauer pro Woche"
            description="Trainingszeit in Minuten."
          >
            <WeekSeries points={weeks.map((w) => ({ monday: w.monday, value: w.minutes || null }))} kind="line" color={CHART_COLORS[0]} label="Minuten" format={(v) => formatNumber(Math.round(v), 0)} />
          </ChartCard>

          <section className="rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="neue-bestwerte">
            <h2 id="neue-bestwerte" className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Trophy className="size-5 text-macro-carbs" aria-hidden />
              Neue Bestwerte
            </h2>
            {latestRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground">Im Zeitraum noch keiner. Ab dem zweiten Training einer Übung zählt jede Steigerung.</p>
            ) : (
              <ul className="divide-y">
                {latestRecords.map((r) => (
                  <li key={`${r.workoutId}-${r.exerciseId}-${r.kind}`}>
                    <Link href={`/sport/verlauf/${r.workoutId}`} className="flex min-h-12 items-center justify-between gap-3 py-2 hover:underline">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {date(r.date)} · {RECORD_LABEL[r.kind]}
                        </span>
                      </span>
                      <span className="shrink-0 text-right tabular-nums">
                        <span className="block font-semibold">{recordValue(r)}</span>
                        <span className="block text-xs text-muted-foreground">vorher {recordValue({ ...r, value: r.previous })}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <p className="rounded-3xl border border-dashed p-4 text-sm text-muted-foreground">
        Später kommen hier Körpergewicht, Körpermaße und Getränke dazu, sobald es diese Bereiche gibt.
      </p>
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

function RecordTile({ label, value, detail, date: day }: { label: string; value: string; detail?: string; date?: string }) {
  return (
    <div className="rounded-2xl bg-muted p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-lg leading-tight font-semibold tabular-nums">
        {value}
        {detail ? <span className="ml-1 font-sans text-sm font-normal text-muted-foreground">{detail}</span> : null}
      </dd>
      {day ? <dd className="text-xs text-muted-foreground">{date(day)}</dd> : null}
    </div>
  );
}

function Week({ monday, days, current }: { monday: string; days: { date: string; count: number | null }[]; current: boolean }) {
  return (
    <>
      <span className={cn("self-center tabular-nums", current && "font-semibold text-foreground")}>{dayMonth(monday)}</span>
      {days.map((d) => (
        <span
          key={d.date}
          title={d.count == null ? undefined : `${date(d.date)}: ${d.count === 0 ? "kein Training" : d.count === 1 ? "1 Training" : `${d.count} Trainings`}`}
          className={cn(
            "aspect-square rounded-md",
            d.count == null ? "bg-transparent" : d.count === 0 ? "bg-muted" : d.count === 1 ? "bg-sport/70" : "bg-sport",
          )}
        >
          <span className="sr-only">
            {d.count == null ? "" : `${date(d.date)}: ${d.count === 0 ? "kein Training" : `${d.count} Training${d.count > 1 ? "s" : ""}`}`}
          </span>
        </span>
      ))}
    </>
  );
}
