import "server-only";
import type { Daytime, Habit, HabitCheck, HabitFrequency, HabitKind, Routine, ScheduleCategory, ScheduleEntry } from "@/lib/domain/habits";
import { berlinParts } from "@/lib/domain/workout";
import { createClient } from "@/lib/supabase/server";

// Habit Tracker und Trainings-Wochenplan lesen. Alles mit dem Client des Nutzers (RLS: nur eigene Daten).

export const HABIT_COLUMNS = "id, name, kind, frequency, target, weekdays, daytime, at_time, dose, notes, color, position, routine, paused_at, created_at";
export const SCHEDULE_COLUMNS = "id, weekday, daytime, at_time, title, category, duration_min, notes";

type HabitRow = {
  id: string;
  name: string;
  kind: string;
  frequency: string;
  target: number;
  weekdays: number[];
  daytime: string | null;
  at_time: string | null;
  dose: string | null;
  notes: string | null;
  color: string;
  position: number;
  routine: string | null;
  paused_at: string | null;
  created_at: string;
};

type ScheduleRow = {
  id: string;
  weekday: number;
  daytime: string;
  at_time: string | null;
  title: string;
  category: string;
  duration_min: number | null;
  notes: string | null;
};

export function toHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as HabitKind,
    frequency: row.frequency as HabitFrequency,
    target: row.target,
    weekdays: row.weekdays ?? [],
    daytime: row.daytime as Daytime | null,
    // Postgres liefert „07:30:00“
    atTime: row.at_time ? row.at_time.slice(0, 5) : null,
    dose: row.dose,
    notes: row.notes,
    color: row.color,
    position: row.position,
    routine: row.routine as Routine | null,
    startDate: berlinParts(row.created_at).date,
    pausedOn: row.paused_at ? berlinParts(row.paused_at).date : null,
  };
}

export function toScheduleEntry(row: ScheduleRow): ScheduleEntry {
  return {
    id: row.id,
    weekday: row.weekday,
    daytime: row.daytime as Daytime,
    atTime: row.at_time ? row.at_time.slice(0, 5) : null,
    title: row.title,
    category: row.category as ScheduleCategory,
    durationMin: row.duration_min,
    notes: row.notes,
  };
}

/** Alle Gewohnheiten (auch pausierte) in eigener Reihenfolge. */
export async function getHabits(userId: string): Promise<Habit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("habits").select(HABIT_COLUMNS).eq("user_id", userId).order("position").order("created_at");
  if (error) throw new Error(`Gewohnheiten konnten nicht gelesen werden (${error.code})`);
  return data.map(toHabit);
}

/** Abhak-Einträge von `from` bis `to` (beide einschließlich); seitenweise, Supabase liefert höchstens 1000 Zeilen. */
export async function getHabitChecks(userId: string, from: string, to: string): Promise<HabitCheck[]> {
  const supabase = await createClient();
  const out: HabitCheck[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from("habit_checks")
      .select("habit_id, day, count")
      .eq("user_id", userId)
      .gte("day", from)
      .lte("day", to)
      .order("day")
      .order("habit_id")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(`Abgehakte Gewohnheiten konnten nicht gelesen werden (${error.code})`);
    out.push(...data.map((c) => ({ habitId: c.habit_id, date: c.day, count: c.count })));
    if (data.length < 1000) return out;
  }
}

/** Trainings-Wochenplan (Reihenfolge rechnet die Seite: Tag, Uhrzeit). */
export async function getSchedule(userId: string): Promise<ScheduleEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("training_schedule").select(SCHEDULE_COLUMNS).eq("user_id", userId);
  if (error) throw new Error(`Wochenplan konnte nicht gelesen werden (${error.code})`);
  return data.map(toScheduleEntry);
}
