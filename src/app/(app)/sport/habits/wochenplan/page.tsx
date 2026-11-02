import type { Metadata } from "next";
import { WeekSchedule } from "@/components/sport/habits/week-schedule";
import { requireUser } from "@/lib/auth";
import { isoWeekday, todayInBerlin } from "@/lib/domain/week";
import { getSchedule } from "@/lib/server/habits";

export const metadata: Metadata = { title: "Trainings-Wochenplan" };

/** Habit Tracker, Tab „Wochenplan“: wiederkehrende Trainingswoche. */
export default async function SchedulePage() {
  const user = await requireUser();
  const entries = await getSchedule(user.id);
  return <WeekSchedule entries={entries} todayWeekday={isoWeekday(todayInBerlin())} />;
}
