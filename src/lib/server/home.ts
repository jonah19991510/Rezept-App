import "server-only";
import { longNotCooked } from "@/lib/domain/cooklog";
import { normalizeHomeLayout, type HomeWidget } from "@/lib/domain/home";
import { expiryStatus } from "@/lib/domain/pantry";
import { entryMacros, sumMacros, type DayMacros, type Goals } from "@/lib/domain/plan";
import { goalsForDay, isTrainingDay } from "@/lib/domain/training";
import { mondayOf } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";
import { getCookLogs, getLongNotCookedWeeks } from "./kitchen-log";
import { getPantry } from "./pantry";
import { getAllGoals, getTrainingDays, getWeekEntries, type PlanEntry } from "./plan";
import { getOwnRecipeTitles } from "./recipes";
import { getShoppingList } from "./shopping";

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
