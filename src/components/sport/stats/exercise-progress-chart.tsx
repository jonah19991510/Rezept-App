"use client";

import { useRouter } from "next/navigation";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { AXIS_TICK, CHART_COLORS, TooltipBox } from "@/components/stats/chart-card";
import type { Tracking } from "@/lib/domain/exercises";
import { mmss } from "@/lib/domain/workout";
import type { ExerciseSession } from "@/lib/domain/workout-stats";
import { formatNumber } from "@/lib/format";

const kg = (v: number) => `${formatNumber(v, 1)} kg`;
const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

/** Ausdauer: welche Größe das Diagramm zeigt (eigene Einheiten, daher nicht zusammen auf einer Achse). */
export type CardioMetric = "distance" | "time" | "speed";

type Series = {
  key: "best1RM" | "bestWeightKg" | "maxReps" | "maxSeconds" | "km" | "totalSeconds" | "speedKmh";
  label: string;
  color: string;
  format: (v: number) => string;
};

const km = (v: number) => `${formatNumber(v, 2)} km`;
const kmh = (v: number) => `${formatNumber(v, 1)} km/h`;

/** Welche Linien je Erfassung: Gewicht = geschätztes 1RM und schwerster Satz (beide kg), sonst eine Linie. */
function seriesFor(tracking: Tracking, metric: CardioMetric): Series[] {
  if (tracking === "time") return [{ key: "maxSeconds", label: "Längster Satz", color: CHART_COLORS[0], format: mmss }];
  if (tracking === "distance_time") {
    if (metric === "time") return [{ key: "totalSeconds", label: "Zeit", color: CHART_COLORS[0], format: mmss }];
    if (metric === "speed") return [{ key: "speedKmh", label: "Ø Tempo", color: CHART_COLORS[0], format: kmh }];
    return [{ key: "km", label: "Strecke", color: CHART_COLORS[0], format: km }];
  }
  if (tracking === "bodyweight_reps") return [{ key: "maxReps", label: "Meiste Wiederholungen", color: CHART_COLORS[0], format: (v) => `${v} Wdh.` }];
  return [
    { key: "best1RM", label: "Geschätztes 1RM", color: CHART_COLORS[0], format: kg },
    { key: "bestWeightKg", label: "Schwerster Satz", color: CHART_COLORS[1], format: kg },
  ];
}

/**
 * Verlauf einer Übung über die Trainings (ein Punkt je Training). Tipp auf einen Punkt öffnet das Training.
 * Bei Gewichtsübungen zwei Linien in kg (gleiche Achse): geschätztes 1RM und schwerster Satz.
 */
export function ExerciseProgressChart({
  sessions,
  tracking,
  metric = "distance",
}: {
  sessions: ExerciseSession[];
  tracking: Tracking;
  /** nur bei Strecke und Zeit */
  metric?: CardioMetric;
}) {
  const router = useRouter();
  const cardio = tracking === "distance_time";
  const series = seriesFor(tracking, metric);
  // Ausdauer: Strecke eines Trainings = alle Sätze zusammen
  const data = sessions.map((s) => ({ ...s, label: shortDate(s.date), km: s.totalDistanceM != null ? s.totalDistanceM / 1000 : null }));
  const timeAxis = tracking === "time" || (cardio && metric === "time");

  function renderTooltip({ active, payload }: TooltipContentProps) {
    const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
    if (!active || !p) return null;
    return (
      <TooltipBox
        title={`Training am ${p.label}`}
        rows={[
          // Ausdauer: immer alle drei Werte, die gewählte Größe mit Farbe
          ...(cardio
            ? [
                { label: "Strecke", value: p.km != null ? km(p.km) : "–", color: metric === "distance" ? CHART_COLORS[0] : undefined },
                { label: "Zeit", value: p.totalSeconds != null ? mmss(p.totalSeconds) : "–", color: metric === "time" ? CHART_COLORS[0] : undefined },
                { label: "Ø Tempo", value: p.speedKmh != null ? kmh(p.speedKmh) : "–", color: metric === "speed" ? CHART_COLORS[0] : undefined },
              ]
            : series.map((s) => {
                const v = p[s.key];
                return { label: s.label, value: v == null ? "–" : s.format(v), color: s.color };
              })),
          ...(tracking === "weight_reps" && p.bestWeightReps != null ? [{ label: "Wdh. beim schwersten Satz", value: String(p.bestWeightReps) }] : []),
          ...(p.volumeKg > 0 ? [{ label: "Volumen", value: `${formatNumber(Math.round(p.volumeKg), 0)} kg` }] : []),
          { label: "Sätze", value: String(p.sets) },
        ]}
      />
    );
  }

  return (
    <div>
      {series.length > 1 ? (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Legende">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis
              width={52}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => (timeAxis ? mmss(v) : formatNumber(v, 1))}
            />
            <Tooltip content={renderTooltip} cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                connectNulls
                isAnimationActive={false}
                dot={{ r: 4, fill: s.color, stroke: "var(--card)", strokeWidth: 2 }}
                activeDot={{
                  r: 7,
                  stroke: "var(--card)",
                  strokeWidth: 2,
                  cursor: "pointer",
                  onClick: (_: unknown, e: unknown) => {
                    const point = (e as { payload?: { workoutId?: string } }).payload;
                    if (point?.workoutId) router.push(`/sport/verlauf/${point.workoutId}`);
                  },
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
