import type { Metadata } from "next";
import { ChallengesForDay } from "@/components/sport/challenges/challenge-day-list";
import { HabitToday } from "@/components/sport/habits/today-view";
import { requireUser } from "@/lib/auth";
import { periodRange } from "@/lib/domain/drinks";
import { sortSchedule } from "@/lib/domain/habits";
import { isIsoDate, isoWeekday, todayInBerlin } from "@/lib/domain/week";
import { getMyChallenges } from "@/lib/server/challenges";
import { getHabitChecks, getHabits, getSchedule } from "@/lib/server/habits";

export const metadata: Metadata = { title: "Habit Tracker" };

/** Habit Tracker, Tab „Heute“ (mit `?datum=` ein früherer Tag zum Nachtragen). */
export default async function HabitsTodayPage({ searchParams }: PageProps<"/sport/habits">) {
  const user = await requireUser();
  const query = await searchParams;
  const today = todayInBerlin();
  const date = isIsoDate(query.datum) && query.datum <= today ? query.datum : today;
  // Häkchen der ganzen Woche und des ganzen Monats um den Tag (für „2/3 diese Woche“)
  const week = periodRange("woche", date);
  const month = periodRange("monat", date);
  const from = week.from < month.from ? week.from : month.from;
  const to = week.to > month.to ? week.to : month.to;
  const [habits, checks, schedule, challenges] = await Promise.all([
    getHabits(user.id),
    getHabitChecks(user.id, from, to),
    getSchedule(user.id),
    getMyChallenges(user.id),
  ]);
  const weekday = isoWeekday(date);
  return (
    <HabitToday
      key={date}
      habits={habits}
      checks={checks}
      schedule={sortSchedule(schedule.filter((e) => e.weekday === weekday))}
      date={date}
      today={today}
      challenges={challenges ? <ChallengesForDay items={challenges} date={date} today={today} /> : null}
    />
  );
}
