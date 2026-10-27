import "server-only";
import { DEFAULT_DRINKS, DEFAULT_GOAL_ML, type Drink, type DrinkEntry, type DrinkIngredient } from "@/lib/domain/drinks";
import { berlinParts, berlinToIso } from "@/lib/domain/workout";
import { addDays } from "@/lib/domain/week";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// Getränketracker: Getränke, Einträge und Tagesziel lesen. Alles mit dem Client des Nutzers (RLS: nur eigene Daten).

const DRINK_COLUMNS = "id, name, color, caffeine_mg_per_100ml, sugar_g_per_100ml, water_percent, ingredients, position";
const ENTRY_COLUMNS = "id, drink_id, drink_name, drink_color, drunk_at, amount_ml, caffeine_mg, sugar_g, water_ml";

type DrinkRow = {
  id: string;
  name: string;
  color: string;
  caffeine_mg_per_100ml: number;
  sugar_g_per_100ml: number;
  water_percent: number;
  ingredients: Json | null;
  position: number;
};

type EntryRow = {
  id: string;
  drink_id: string | null;
  drink_name: string;
  drink_color: string;
  drunk_at: string;
  amount_ml: number;
  caffeine_mg: number;
  sugar_g: number;
  water_ml: number;
};

export function toDrink(row: DrinkRow): Drink {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    caffeinePer100: Number(row.caffeine_mg_per_100ml),
    sugarPer100: Number(row.sugar_g_per_100ml),
    waterPercent: Number(row.water_percent),
    ingredients: Array.isArray(row.ingredients) ? (row.ingredients as unknown as DrinkIngredient[]) : null,
    position: row.position,
  };
}

export function toEntry(row: EntryRow): DrinkEntry {
  const { date, time } = berlinParts(row.drunk_at);
  const [h, m] = time.split(":").map(Number);
  return {
    id: row.id,
    drinkId: row.drink_id,
    name: row.drink_name,
    color: row.drink_color,
    at: row.drunk_at,
    date,
    minutes: h * 60 + m,
    ml: row.amount_ml,
    caffeine: Number(row.caffeine_mg),
    sugar: Number(row.sugar_g),
    water: Number(row.water_ml),
  };
}

/**
 * Tagesziel und Getränke. Beim allerersten Öffnen (Ziel noch nicht gesetzt) legt das die Startliste an und setzt
 * das Ziel auf 2 l; danach bleibt eine leere Liste leer (wer alles löscht, bekommt sie nicht zurück).
 */
export async function getDrinkSetup(userId: string): Promise<{ goalMl: number; drinks: Drink[] }> {
  const supabase = await createClient();
  const settings = await supabase.from("user_settings").select("drink_goal_ml").eq("user_id", userId).maybeSingle();
  if (settings.error) throw new Error(`Einstellungen konnten nicht gelesen werden (${settings.error.code})`);
  let goalMl = settings.data?.drink_goal_ml ?? null;

  if (goalMl == null) {
    const seed = await supabase.from("drinks").upsert(
      DEFAULT_DRINKS.map((d) => ({
        name: d.name,
        color: d.color,
        caffeine_mg_per_100ml: d.caffeinePer100,
        sugar_g_per_100ml: d.sugarPer100,
        water_percent: d.waterPercent,
        position: d.position,
      })),
      { onConflict: "user_id,name", ignoreDuplicates: true },
    );
    if (seed.error) throw new Error(`Startliste konnte nicht angelegt werden (${seed.error.code})`);
    const update = await supabase.from("user_settings").update({ drink_goal_ml: DEFAULT_GOAL_ML }).eq("user_id", userId);
    if (update.error) throw new Error(`Tagesziel konnte nicht gesetzt werden (${update.error.code})`);
    goalMl = DEFAULT_GOAL_ML;
  }

  return { goalMl, drinks: await getDrinks(userId) };
}

export async function getDrinks(userId: string): Promise<Drink[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("drinks").select(DRINK_COLUMNS).eq("user_id", userId).order("position").order("name");
  if (error) throw new Error(`Getränke konnten nicht gelesen werden (${error.code})`);
  return data.map(toDrink);
}

export async function getDrink(drinkId: string, userId: string): Promise<Drink | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("drinks").select(DRINK_COLUMNS).eq("id", drinkId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Getränk konnte nicht gelesen werden (${error.code})`);
  return data ? toDrink(data) : null;
}

/** Einträge von `from` bis `to` (Kalendertage in deutscher Zeit, beide einschließlich), ältester zuerst. */
export async function getDrinkEntries(userId: string, from: string, to: string): Promise<DrinkEntry[]> {
  const supabase = await createClient();
  const start = berlinToIso(from, "00:00");
  const end = berlinToIso(addDays(to, 1), "00:00");
  if (!start || !end) return [];
  const rows: EntryRow[] = [];
  // Supabase liefert höchstens 1000 Zeilen je Abfrage
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from("drink_entries")
      .select(ENTRY_COLUMNS)
      .eq("user_id", userId)
      .gte("drunk_at", start)
      .lt("drunk_at", end)
      .order("drunk_at")
      .order("id")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(`Einträge konnten nicht gelesen werden (${error.code})`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows.map(toEntry);
}

/** Menge, Koffein, Zucker und Anzahl je Tag mit Einträgen (für Verlauf und Serie). */
export async function getDrinkDays(from: string, to: string): Promise<{ date: string; ml: number; caffeine: number; sugar: number; count: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("drink_days", { p_from: from, p_to: to });
  if (error) throw new Error(`Tage konnten nicht gelesen werden (${error.code})`);
  return data.map((d) => ({ date: d.day, ml: Number(d.amount_ml), caffeine: Number(d.caffeine_mg), sugar: Number(d.sugar_g), count: Number(d.entries) }));
}
