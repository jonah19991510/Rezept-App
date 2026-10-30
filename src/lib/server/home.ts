import "server-only";
import { longNotCooked } from "@/lib/domain/cooklog";
import { DEFAULT_GOAL_ML } from "@/lib/domain/drinks";
import { normalizeHomeLayout, type HomeWidget } from "@/lib/domain/home";
import { expiryStatus } from "@/lib/domain/pantry";
import { entryMacros, sumMacros, type DayMacros, type Goals } from "@/lib/domain/plan";
import { goalsForDay, isTrainingDay } from "@/lib/domain/training";
import { mondayOf, todayInBerlin } from "@/lib/domain/week";
import { nextPlanDay } from "@/lib/domain/workout";
import { createClient } from "@/lib/supabase/server";
import { getDrinkEntries } from "./drinks";
import { getCookLogs, getLongNotCookedWeeks } from "./kitchen-log";
import { getPantry } from "./pantry";
import { getAllGoals, getTrainingDays, getWeekEntries, type PlanEntry } from "./plan";
import { getOwnRecipeTitles } from "./recipes";
import { getShoppingList } from "./shopping";
import { getTrainingPlans } from "./sport";
import { getActiveWorkout, getLastPlanDayId, getWorkoutHistory, type ActiveWorkout, type WorkoutListItem } from "./workouts";

// Daten für die Widgets der Startseite. Die Seite lädt nur, was sichtbare Widgets brauchen.

/**
 * Anordnung der Widgets. Fehlt die Spalte noch (Migration …20261026090000 nicht eingespielt) oder ist nichts
 * gespeichert, gilt der Standard.
 */
export async function getHomeLayout(userId: string): Promise<HomeWidget[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_settings").select("home_widgets").eq("user_id", userId).maybeSingle();
  return normalizeHomeLayout(error ? null : data?.home_widgets);
}

export type TodayPlan = { entries: PlanEntry[]; totals: DayMacros; goals: Goals; training: boolean };

/** Heutige Einträge im Wochenplan mit Summe und dem Tagesziel (Trainingstag oder normal). */
export async function getTodayPlan(userId: string, today: string): Promise<TodayPlan> {
  const [week, goals, training] = await Promise.all([
    getWeekEntries(userId, mondayOf(today)),
    getAllGoals(userId),
    getTrainingDays(userId, today, today),
  ]);
  const entries = week.filter((e) => e.date === today);
  const isTraining = isTrainingDay(today, training.weekdays, training.overrides);
  return {
    entries,
    totals: sumMacros(entries.flatMap((e) => (e.perServing ? [entryMacros({ servings: e.servings, perServing: e.perServing })] : []))),
    goals: goalsForDay(isTraining, goals.default, goals.training),
    training: isTraining,
  };
}

/** Offene Einträge der Einkaufsliste (Grundzutaten nur, wenn sie auf der Liste eingeblendet sind). */
export async function getOpenShopping(userId: string): Promise<{ count: number; names: string[] }> {
  const { items, hideStaples } = await getShoppingList(userId);
  const open = items.filter((i) => !i.checked && !(hideStaples && i.isStaple));
  return { count: open.length, names: open.map((i) => i.name) };
}

export type ExpiringItem = { id: string; name: string; expiresOn: string; status: "expired" | "soon" };

/** Vorrat, der abgelaufen ist oder bald abläuft; zuerst das Älteste. */
export async function getExpiringPantry(userId: string, today: string): Promise<ExpiringItem[]> {
  const pantry = await getPantry(userId);
  return pantry
    .flatMap((p) => {
      const status = expiryStatus(p.expiresOn, today);
      return p.expiresOn && (status === "expired" || status === "soon") ? [{ id: p.id, name: p.name, expiresOn: p.expiresOn, status }] : [];
    })
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
}

export type LongAgoRecipe = { id: string; title: string; weeksAgo: number; avgRating: number };

/** Gut bewertete eigene Rezepte, die lange nicht gekocht wurden (wie im Wochenplan). */
export async function getLongNotCookedRecipes(userId: string, today: string, limit = 3): Promise<{ items: LongAgoRecipe[]; weeks: number }> {
  const [logs, weeks, titles] = await Promise.all([getCookLogs(userId), getLongNotCookedWeeks(userId), getOwnRecipeTitles(userId)]);
  const byId = new Map(titles.map((t) => [t.id, t.title]));
  const items = longNotCooked(logs, today, weeks)
    .filter((l) => byId.has(l.recipeId))
    .slice(0, limit)
    .map((l) => ({ id: l.recipeId, title: byId.get(l.recipeId)!, weeksAgo: l.weeksAgo, avgRating: l.avgRating }));
  return { items, weeks };
}

export type SportSummary = {
  active: ActiveWorkout | null;
  /** nächster Tag des zuletzt geänderten aktiven Plans */
  next: { planTitle: string; dayName: string; focus: string | null } | null;
  hasPlan: boolean;
  /** beendete Trainings dieser Woche (Montag bis heute, deutsche Zeit) mit ihrem Tag */
  week: (WorkoutListItem & { date: string })[];
  last: (WorkoutListItem & { date: string }) | null;
};

/** Sport auf der Startseite: laufendes Training, als Nächstes, diese Woche. Fehler (z. B. Tabellen fehlen) = leer. */
export async function getSportSummary(userId: string, today: string): Promise<SportSummary> {
  const [plans, active, history] = await Promise.all([
    getTrainingPlans(userId).catch(() => []),
    getActiveWorkout(userId).catch(() => null),
    getWorkoutHistory(userId, { limit: 30 }).catch(() => []),
  ]);
  const plan = plans.find((p) => !p.isArchived);
  const day = plan ? nextPlanDay(plan.days, await getLastPlanDayId(userId, plan.id).catch(() => null)) : null;
  const finished = history.filter((w) => w.endedAt).map((w) => ({ ...w, date: todayInBerlin(new Date(w.startedAt)) }));
  const monday = mondayOf(today);
  return {
    active,
    next: plan && day ? { planTitle: plan.title, dayName: day.name, focus: day.focus } : null,
    hasPlan: Boolean(plan),
    week: finished.filter((w) => w.date >= monday && w.date <= today),
    last: finished[0] ?? null,
  };
}

export type DrinkToday = { ml: number; goalMl: number };

/**
 * Heute getrunken (alle Getränke, wie auf der Getränke-Seite) und das Tagesziel. Legt anders als die Getränke-Seite
 * nichts an: ohne gesetztes Ziel gelten 2 l. Fehler (z. B. Tabellen fehlen) = kein Ring.
 */
export async function getDrinkToday(userId: string, today: string): Promise<DrinkToday | null> {
  try {
    const supabase = await createClient();
    const [settings, entries] = await Promise.all([
      supabase.from("user_settings").select("drink_goal_ml").eq("user_id", userId).maybeSingle(),
      getDrinkEntries(userId, today, today),
    ]);
    if (settings.error) return null;
    return { ml: entries.reduce((sum, e) => sum + e.ml, 0), goalMl: settings.data?.drink_goal_ml ?? DEFAULT_GOAL_ML };
  } catch {
    return null;
  }
}
