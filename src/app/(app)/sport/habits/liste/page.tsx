import type { Metadata } from "next";
import { HabitManager } from "@/components/sport/habits/habit-manager";
import { requireUser } from "@/lib/auth";
import { getHabitsAndRoutines } from "@/lib/server/habits";

export const metadata: Metadata = { title: "Habits" };

/** Habit Tracker, Tab „Habits“: Habits und Routinen anlegen, bearbeiten, Reihenfolge per Drag & Drop. */
export default async function HabitListPage() {
  const user = await requireUser();
  const { habits, routines } = await getHabitsAndRoutines(user.id);
  return <HabitManager habits={habits} routines={routines} />;
}
