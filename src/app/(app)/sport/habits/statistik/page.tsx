import type { Metadata } from "next";
import { HabitStats } from "@/components/sport/habits/habit-stats";
import { requireUser } from "@/lib/auth";
import { periodRange, type StatsView } from "@/lib/domain/drinks";
import { addDays, isIsoDate, mondayOf, todayInBerlin } from "@/lib/domain/week";
import { getHabitChecks, getHabits } from "@/lib/server/habits";

export const metadata: Metadata = { title: "Habit-Statistik" };

/** Habit Tracker, Tab „Statistik“: Woche oder Monat um `?datum=` (Standard: diese Woche, heute gewählt). */
export default async function HabitStatsPage({ searchParams }: PageProps<"/sport/habits/statistik">) {
  const user = await requireUser();
  const query = await searchParams;
  const today = todayInBerlin();
  const view: StatsView = query.ansicht === "monat" ? "monat" : "woche";
  const date = isIsoDate(query.datum) && query.datum <= today ? query.datum : today;
  const habitId = typeof query.habit === "string" ? query.habit : null;
  const { from, to } = periodRange(view, date);
  // Serien: bis ein Jahr zurück; Wochen am Monatsrand ganz (wöchentliche Habits)
  const historyFrom = addDays(today, -366);
  const start = [historyFrom, mondayOf(from)].sort()[0];
  const end = [addDays(mondayOf(to), 6), today].sort().at(-1)!;
  const [habits, checks] = await Promise.all([getHabits(user.id), getHabitChecks(user.id, start, end)]);
  return <HabitStats key={`${view}-${date}`} view={view} date={date} today={today} habits={habits} checks={checks} historyFrom={historyFrom} initialHabit={habitId} />;
}
