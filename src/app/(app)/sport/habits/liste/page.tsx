import type { Metadata } from "next";
import { HabitManager } from "@/components/sport/habits/habit-manager";
import { requireUser } from "@/lib/auth";
import { getHabits } from "@/lib/server/habits";

export const metadata: Metadata = { title: "Habits" };

/** Habit Tracker, Tab „Habits“: anlegen, bearbeiten, Reihenfolge per Drag & Drop. */
export default async function HabitListPage() {
  const user = await requireUser();
  return <HabitManager habits={await getHabits(user.id)} />;
}
