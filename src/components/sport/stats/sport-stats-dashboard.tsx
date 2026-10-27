"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { ChipRow } from "@/components/layout/list-blocks";
import { chipClass } from "@/components/recipes/chip-select";
import { ChartCard, CHART_COLORS, DataTable } from "@/components/stats/chart-card";
import { WeekSeries } from "@/components/stats/week-series";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { isTimed, MUSCLE_LABELS } from "@/lib/domain/exercises";
import { addDays, dayMonth, isoWeekNumber, mondayOf, relativeWeekLabel, weekDays, weekdayShort, weekLabel } from "@/lib/domain/week";
import { mmss } from "@/lib/domain/workout";
import {
  exerciseOptions,
  exerciseProgress,
  exerciseRecords,
  inRange,
  mondaysBetween,
  RANGE_LABELS,
  rangeEnd,
  rangeStart,
  recentRecords,
  setsPerMuscle,
  statsTotals,
  streakWeeks,
  trainingCalendar,
  weeklyStats,
  workoutSets,
  workoutVolume,
  type RecentRecord,
  type StatsRange,
  type StatsWorkout,
} from "@/lib/domain/workout-stats";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ExerciseProgressChart, type CardioMetric } from "./exercise-progress-chart";

const RANGES: StatsRange[] = ["woche", "4w", "3m", "1j", "alle"];
const CARDIO_METRICS: { value: CardioMetric; label: string }[] = [
  { value: "distance", label: "Strecke" },
  { value: "time", label: "Zeit" },
  { value: "speed", label: "Tempo" },
];
const kg = (v: number) => `${formatNumber(Math.round(v), 0)} kg`;
const km = (meters: number) => `${formatNumber(meters / 1000, 2)} km`;
const kmh = (v: number) => `${formatNumber(v, 1)} km/h`;
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
  // Gewählte Kalenderwoche für „Woche“ (anfangs die aktuelle; Pfeile blättern)
  const currentMonday = mondayOf(today);
  const [weekMonday, setWeekMonday] = useState(currentMonday);
  const isWeek = range === "woche";
  const from = rangeStart(range, today, weekMonday);
  const to = rangeEnd(range, weekMonday);
  const visible = useMemo(() => inRange(workouts, from, to), [workouts, from, to]);
  const mondays = useMemo(
    () => (isWeek ? [weekMonday] : mondaysBetween(from ?? workouts[0]?.date ?? today, today)),
    [isWeek, weekMonday, from, workouts, today],
  );
  const weeks = useMemo(() => weeklyStats(visible, mondays), [visible, mondays]);
  const totals = useMemo(() => statsTotals(visible, mondays.length), [visible, mondays.length]);
  const streak = useMemo(() => streakWeeks(workouts, today), [workouts, today]);
  const options = useMemo(() => exerciseOptions(visible), [visible]);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [cardioMetric, setCardioMetric] = useState<CardioMetric>("distance");
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
          <button
            key={r}
            type="button"
            aria-pressed={range === r}
            aria-label={r === "woche" ? `Kalenderwoche ${isoWeekNumber(weekMonday)}` : undefined}
            onClick={() => setRange(r)}
            className={chipClass(range === r)}
          >
            {/* Der Wochen-Chip zeigt immer die Kalenderwoche, die gerade gilt bzw. gewählt ist */}
            {r === "woche" ? `KW ${isoWeekNumber(weekMonday)}` : RANGE_LABELS[r]}
          </button>
        ))}
      </ChipRow>

      {isWeek ? (
        <div className="flex items-center justify-between gap-2 rounded-3xl border bg-card p-1.5">
          <Button type="button" variant="ghost" size="icon" onClick={() => setWeekMonday((m) => addDays(m, -7))} aria-label="Woche davor">
            <ChevronLeft aria-hidden />
          </Button>
          <p className="min-w-0 text-center">
            <span className="block font-semibold tabular-nums">{weekLabel(weekMonday)}</span>
            <span className="block text-sm text-muted-foreground">{relativeWeekLabel(weekMonday, today)}</span>
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setWeekMonday((m) => addDays(m, 7))}
            disabled={weekMonday >= currentMonday}
            aria-label="Woche danach"
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Trainings"
          value={formatNumber(totals.workouts, 0)}
          sub={isWeek ? "in der Woche" : totals.perWeek != null ? `${formatNumber(totals.perWeek, 1)} pro Woche` : undefined}
        />
        <Kpi label="Ø Dauer" value={totals.avgMinutes != null ? `${totals.avgMinutes} Min.` : "–"} sub={totals.minutes ? `insgesamt ${hours(totals.minutes)}` : undefined} />
        <Kpi label="Volumen" value={tons(totals.volumeKg)} sub={`${formatNumber(totals.sets, 0)} Arbeitssätze`} />
        <Kpi label="Serie" value={String(streak)} sub={streak === 1 ? "Woche am Stück" : "Wochen am Stück"} />
      </dl>

      {visible.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          {isWeek ? "In dieser Woche gibt es kein Training." : "In diesem Zeitraum gibt es kein Training."}
        </p>
      ) : (
        <>
          {isWeek ? (
            <WeekDays monday={weekMonday} today={today} workouts={visible} />
          ) : (
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
          )}

          <ChartCard
            title="Übung im Verlauf"
            description="Ein Punkt je Training. Tipp auf einen Punkt öffnet das Training."
            table={
              exercise ? (
                <DataTable
                  head={
                    exercise.tracking === "distance_time"
                      ? ["Datum", "Strecke", "Zeit", "Ø Tempo"]
                      : isTimed(exercise.tracking)
                        ? ["Datum", "Bestwert", "Sätze"]
                        : ["Datum", "Schwerster Satz", "Geschätztes 1RM", "Volumen"]
                  }
                  rows={sessions.map((s) =>
                    exercise.tracking === "distance_time"
                      ? [date(s.date), s.totalDistanceM != null ? km(s.totalDistanceM) : "–", s.totalSeconds != null ? mmss(s.totalSeconds) : "–", s.speedKmh != null ? kmh(s.speedKmh) : "–"]
                      : isTimed(exercise.tracking)
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
                <dl className={cn("grid gap-2", exercise.tracking === "distance_time" ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
                  {isTimed(exercise.tracking) ? (
                    exercise.tracking === "time" ? (
                      <RecordTile label="Längster Satz" value={records.seconds ? mmss(records.seconds.value) : "–"} date={records.seconds?.date} />
                    ) : (
                      <>
                        <RecordTile compact label="Längste Strecke" value={records.totalDistance ? km(records.totalDistance.value) : "–"} date={records.totalDistance?.date} />
                        <RecordTile compact label="Längste Zeit" value={records.totalSeconds ? mmss(records.totalSeconds.value) : "–"} date={records.totalSeconds?.date} />
                        <RecordTile compact label="Schnellstes Tempo" value={records.speed ? kmh(records.speed.value) : "–"} date={records.speed?.date} />
                      </>
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
                {sessions.length > 1 && exercise.tracking === "distance_time" ? (
                  <ChipRow label="Im Diagramm">
                    {CARDIO_METRICS.map((m) => (
                      <button key={m.value} type="button" aria-pressed={cardioMetric === m.value} onClick={() => setCardioMetric(m.value)} className={chipClass(cardioMetric === m.value)}>
                        {m.label}
                      </button>
                    ))}
                  </ChipRow>
                ) : null}
                {sessions.length > 1 ? (
                  <ExerciseProgressChart sessions={sessions} tracking={exercise.tracking} metric={cardioMetric} />
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

          {isWeek ? null : (
            <ChartCard
              title="Dauer pro Woche"
              description="Trainingszeit in Minuten."
            >
              <WeekSeries points={weeks.map((w) => ({ monday: w.monday, value: w.minutes || null }))} kind="line" color={CHART_COLORS[0]} label="Minuten" format={(v) => formatNumber(Math.round(v), 0)} />
            </ChartCard>
          )}

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
        Gewicht und Umfänge mit Verlauf findest du unter{" "}
        <Link href="/sport/koerper" className="font-medium text-primary underline-offset-4 hover:underline">
          Körpermaße
        </Link>
        , die Getränke-Statistik unter{" "}
        <Link href="/sport/getraenke/statistik" className="font-medium text-primary underline-offset-4 hover:underline">
          Getränke → Statistik
        </Link>
        .
      </p>
    </div>
  );
}

/** Die sieben Tage der gewählten Woche mit ihren Trainings (Dauer, Sätze, Volumen); antippen öffnet das Training. */
function WeekDays({ monday, today, workouts }: { monday: string; today: string; workouts: StatsWorkout[] }) {
  return (
    <section className="rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="woche-tage">
      <h2 id="woche-tage" className="mb-3 text-lg font-semibold">
        Trainings der Woche
      </h2>
      <ul className="divide-y">
        {weekDays(monday).map((day) => {
          const items = workouts.filter((w) => w.date === day);
          return (
            <li key={day} className="flex min-h-12 items-center gap-3 py-1.5">
              <span className={cn("w-20 shrink-0 text-sm whitespace-nowrap text-muted-foreground tabular-nums", day === today && "font-semibold text-foreground")}>{date(day)}</span>
              {items.length === 0 ? (
                <span className="text-sm text-muted-foreground">{day > today ? "–" : "Ruhetag"}</span>
              ) : (
                <ul className="min-w-0 flex-1 space-y-1">
                  {items.map((w) => (
                    <li key={w.id}>
                      <Link href={`/sport/verlauf/${w.id}`} className="block rounded-lg hover:underline">
                        <span className="block truncate font-medium">{w.title}</span>
                        <span className="block text-sm text-muted-foreground tabular-nums">
                          {Math.round(w.durationSeconds / 60)} Min. · {workoutSets(w)} Sätze
                          {workoutVolume(w) > 0 ? ` · ${kg(workoutVolume(w))}` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
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

function RecordTile({ label, value, detail, date: day, compact }: { label: string; value: string; detail?: string; date?: string; /** drei Kacheln nebeneinander am Handy */ compact?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-2xl bg-muted", compact ? "p-2.5" : "p-3")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-heading leading-tight font-semibold tabular-nums", compact ? "text-base whitespace-nowrap sm:text-lg" : "text-lg")}>
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
