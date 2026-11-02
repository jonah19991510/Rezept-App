import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { HabitTabs } from "@/components/sport/habits/habit-parts";

/** Habit Tracker: gemeinsamer Kopf mit den Tabs Heute, Wochenplan, Statistik, Habits. */
export default function HabitsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Habit Tracker" />
      <HabitTabs />
      {children}
    </>
  );
}
