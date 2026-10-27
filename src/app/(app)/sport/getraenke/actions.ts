"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { entryValues, mixValues, type DrinkEntry } from "@/lib/domain/drinks";
import { berlinToIso } from "@/lib/domain/workout";
import { getDrink, toEntry } from "@/lib/server/drinks";
import { createClient } from "@/lib/supabase/server";
import { flattenIssues } from "@/lib/validation/recipe";
import { drinkEntryInputSchema, drinkGoalSchema, drinkInputSchema, type DrinkEntryInput, type DrinkInput } from "@/lib/validation/drinks";

// Getränketracker: Einträge, Getränke und Tagesziel speichern. Wer was darf, entscheidet die RLS (nur eigene Daten).

const idSchema = z.uuid();
const ENTRY_COLUMNS = "id, drink_id, drink_name, drink_color, drunk_at, amount_ml, caffeine_mg, sugar_g, water_ml";

function revalidateDrinks() {
  revalidatePath("/sport/getraenke", "layout");
  revalidatePath("/");
}

export type EntryResult = { ok: true; entry: DrinkEntry } | { ok: false; message: string };

/** Zeitpunkt aus Datum und Uhrzeit (deutsche Zeit); ohne Angabe jetzt. Nicht in der Zukunft. */
function entryTime(date: string | null, time: string | null): { ok: true; iso: string } | { ok: false; message: string } {
  if (!date || !time) return { ok: true, iso: new Date().toISOString() };
  const iso = berlinToIso(date, time);
  if (!iso) return { ok: false, message: "Datum oder Uhrzeit ist ungültig." };
  if (new Date(iso).getTime() > Date.now() + 5 * 60_000) return { ok: false, message: "Der Zeitpunkt liegt in der Zukunft." };
  return { ok: true, iso };
}

export async function addDrinkEntryAction(input: DrinkEntryInput): Promise<EntryResult> {
  const user = await requireUser();
  const parsed = drinkEntryInputSchema.safeParse(input);
  if (!parsed.success || !parsed.data.drinkId) return { ok: false, message: "Ungültige Angaben." };
  const { drinkId, ml, date, time } = parsed.data;
  const when = entryTime(date, time);
  if (!when.ok) return when;
  const drink = await getDrink(drinkId, user.id);
  if (!drink) return { ok: false, message: "Das Getränk gibt es nicht mehr." };

  const values = entryValues(drink, ml);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drink_entries")
    .insert({
      drink_id: drink.id,
      drunk_at: when.iso,
      amount_ml: ml,
      drink_name: drink.name,
      drink_color: drink.color,
      caffeine_mg: values.caffeine,
      sugar_g: values.sugar,
      water_ml: values.water,
    })
    .select(ENTRY_COLUMNS)
    .single();
  if (error) return { ok: false, message: "Der Eintrag konnte nicht gespeichert werden." };
  revalidateDrinks();
  return { ok: true, entry: toEntry(data) };
}

/**
 * Eintrag ändern. Mit Getränk: Werte neu aus dem (aktuellen) Getränk. Ohne (Getränk gelöscht): Name und Farbe
 * bleiben, Koffein, Zucker und Wasser wachsen mit der Menge mit.
 */
export async function updateDrinkEntryAction(entryId: string, input: DrinkEntryInput): Promise<EntryResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(entryId).success) return { ok: false, message: "Ungültiger Eintrag." };
  const parsed = drinkEntryInputSchema.safeParse(input);
  if (!parsed.success || !parsed.data.date || !parsed.data.time) return { ok: false, message: "Ungültige Angaben." };
  const { drinkId, ml, date, time } = parsed.data;
  const when = entryTime(date, time);
  if (!when.ok) return when;

  const supabase = await createClient();
  const current = await supabase.from("drink_entries").select(ENTRY_COLUMNS).eq("id", entryId).eq("user_id", user.id).maybeSingle();
  if (current.error || !current.data) return { ok: false, message: "Den Eintrag gibt es nicht mehr." };
  const old = current.data;

  let patch;
  if (drinkId) {
    const drink = await getDrink(drinkId, user.id);
    if (!drink) return { ok: false, message: "Das Getränk gibt es nicht mehr." };
    // Gleiches Getränk und gleiche Menge: die Werte vom Zeitpunkt des Trinkens behalten
    const unchanged = drink.id === old.drink_id && ml === old.amount_ml;
    const values = entryValues(drink, ml);
    patch = unchanged
      ? {}
      : { drink_id: drink.id, drink_name: drink.name, drink_color: drink.color, caffeine_mg: values.caffeine, sugar_g: values.sugar, water_ml: values.water };
  } else {
    const factor = ml / old.amount_ml;
    const r = (v: number) => Math.round(Number(v) * factor * 10) / 10;
    patch = { caffeine_mg: r(old.caffeine_mg), sugar_g: r(old.sugar_g), water_ml: r(old.water_ml) };
  }

  const { data, error } = await supabase
    .from("drink_entries")
    .update({ ...patch, amount_ml: ml, drunk_at: when.iso })
    .eq("id", entryId)
    .select(ENTRY_COLUMNS)
    .single();
  if (error) return { ok: false, message: "Der Eintrag konnte nicht gespeichert werden." };
  revalidateDrinks();
  return { ok: true, entry: toEntry(data) };
}

export async function deleteDrinkEntryAction(entryId: string): Promise<{ ok: boolean; message?: string }> {
  await requireUser();
  if (!idSchema.safeParse(entryId).success) return { ok: false, message: "Ungültiger Eintrag." };
  const supabase = await createClient();
  const { error } = await supabase.from("drink_entries").delete().eq("id", entryId);
  if (error) return { ok: false, message: "Der Eintrag konnte nicht gelöscht werden." };
  revalidateDrinks();
  return { ok: true };
}

export type SaveDrinkResult = { ok: true; id: string } | { ok: false; message?: string; fieldErrors?: Record<string, string[]> };

/** Getränk anlegen (`drinkId` null) oder ändern. Bei Mischgetränken zählen die Werte aus den Zutaten. */
export async function saveDrinkAction(drinkId: string | null, input: DrinkInput): Promise<SaveDrinkResult> {
  const user = await requireUser();
  if (drinkId && !idSchema.safeParse(drinkId).success) return { ok: false, message: "Ungültiges Getränk." };
  const parsed = drinkInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: flattenIssues(parsed.error) };
  const d = parsed.data;
  const mix = d.ingredients ? mixValues(d.ingredients) : null;
  const row = {
    name: d.name,
    color: d.color,
    caffeine_mg_per_100ml: mix ? mix.caffeinePer100 : d.caffeinePer100,
    sugar_g_per_100ml: mix ? mix.sugarPer100 : d.sugarPer100,
    water_percent: mix ? mix.waterPercent : d.isWater ? 100 : 0,
    ingredients: d.ingredients,
  };

  const supabase = await createClient();
  let result;
  if (drinkId) {
    result = await supabase.from("drinks").update(row).eq("id", drinkId).eq("user_id", user.id).select("id");
  } else {
    // neue Getränke ans Ende der Liste
    const last = await supabase.from("drinks").select("position").eq("user_id", user.id).order("position", { ascending: false }).limit(1).maybeSingle();
    result = await supabase
      .from("drinks")
      .insert({ ...row, position: (last.data?.position ?? -1) + 1 })
      .select("id");
  }
  if (result.error) {
    if (result.error.code === "23505") return { ok: false, fieldErrors: { name: ["Ein Getränk mit diesem Namen gibt es schon."] } };
    return { ok: false, message: "Das Getränk konnte nicht gespeichert werden." };
  }
  if (!result.data.length) return { ok: false, message: "Das Getränk gibt es nicht mehr." };
  revalidateDrinks();
  return { ok: true, id: result.data[0].id };
}

/** Getränk löschen; frühere Einträge bleiben mit Name und Werten erhalten. */
export async function deleteDrinkAction(drinkId: string): Promise<{ ok: boolean; message?: string }> {
  await requireUser();
  if (!idSchema.safeParse(drinkId).success) return { ok: false, message: "Ungültiges Getränk." };
  const supabase = await createClient();
  const { error } = await supabase.from("drinks").delete().eq("id", drinkId);
  if (error) return { ok: false, message: "Das Getränk konnte nicht gelöscht werden." };
  revalidateDrinks();
  return { ok: true };
}

export async function setDrinkGoalAction(goalMl: number): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  const parsed = drinkGoalSchema.safeParse(goalMl);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ungültiges Ziel." };
  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").update({ drink_goal_ml: parsed.data }).eq("user_id", user.id);
  if (error) return { ok: false, message: "Das Ziel konnte nicht gespeichert werden." };
  revalidateDrinks();
  return { ok: true };
}
