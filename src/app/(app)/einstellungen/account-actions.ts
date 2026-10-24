"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { normalizeCategory } from "@/lib/domain/categories";
import { backupFileSchema, completeMapping, resolveBackupIngredients, type BackupFile } from "@/lib/domain/recipe-backup";
import { resolveLineGrams } from "@/lib/domain/units";
import { deleteUserCompletely } from "@/lib/server/delete-user";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { changePasswordSchema, deleteAccountSchema, displayNameFormSchema } from "@/lib/validation/account";
import { parseForm, type ActionState } from "@/lib/validation/form";

/** Anzeigenamen ändern (sichtbar bei veröffentlichten Rezepten). */
export async function updateDisplayNameAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(displayNameFormSchema, formData);
  if (!parsed.success) return { fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: parsed.data.displayName }).eq("id", user.id);
  if (error) return { message: "Der Anzeigename konnte nicht gespeichert werden." };

  revalidatePath("/", "layout");
  return { ok: true, message: "Anzeigename gespeichert." };
}

/** Neues Passwort setzen (der Nutzer ist angemeldet). */
export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = parseForm(changePasswordSchema, formData);
  if (!parsed.success) return { fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { fieldErrors: { password: ["Das ist schon dein aktuelles Passwort."] } };
    if (error.code === "weak_password") {
      return { fieldErrors: { password: ["Dieses Passwort ist zu schwach. Bitte wähle ein längeres."] } };
    }
    if (error.code === "reauthentication_needed") {
      return { message: "Bitte melde dich einmal ab und wieder an und versuch es dann noch einmal." };
    }
    return { message: "Das Passwort konnte nicht geändert werden. Bitte versuche es noch einmal." };
  }
  return { ok: true, message: "Passwort geändert." };
}

/**
 * Account löschen: Fotos, Auth-User und per Cascade alle Daten (auch veröffentlichte Rezepte).
 * Bestätigung über den eingetippten Anzeigenamen. Der letzte Admin kann sich nicht selbst löschen.
 */
export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(deleteAccountSchema, formData);
  if (!parsed.success) return { fieldErrors: parsed.fieldErrors };
  if (parsed.data.confirmName !== user.displayName.trim()) {
    return { fieldErrors: { confirmName: ["Der Name stimmt nicht mit deinem Anzeigenamen überein."] } };
  }

  if (user.role === "admin") {
    const admin = createAdminClient();
    const { count, error } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if (error || (count ?? 0) <= 1) {
      return {
        message:
          "Du bist der einzige Admin. Mach vorher eine andere Person zum Admin (README „Dich zum Admin machen“), sonst kann niemand mehr einladen.",
      };
    }
  }

  try {
    await deleteUserCompletely(user.id);
  } catch {
    return { message: "Der Account konnte nicht gelöscht werden. Bitte versuche es später noch einmal." };
  }

  // Session-Cookies im Browser entfernen (den Nutzer gibt es serverseitig nicht mehr)
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?konto=geloescht");
}

export type ImportBackupResult =
  | { ok: true; imported: number; skipped: number; createdIngredients: number }
  | { ok: false; message: string };

/** Rezept-Sicherung importieren: legt alle Rezepte zusätzlich als neue, private Rezepte an. */
export async function importRecipeBackupAction(input: BackupFile): Promise<ImportBackupResult> {
  const user = await requireUser();
  const parsed = backupFileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Die Datei ist keine gültige Sicherung." };
  const backup = parsed.data;
  const supabase = await createClient();

  // Zutaten zuordnen: vorhandene IDs, sonst gleicher Name, sonst neu anlegen
  const ids = [...new Set(backup.recipes.flatMap((r) => r.ingredients.map((l) => l.ingredient.id)))];
  const names = [...new Set(backup.recipes.flatMap((r) => r.ingredients.map((l) => l.ingredient.name)))];
  const [byId, byName] = await Promise.all([
    ids.length ? supabase.from("ingredients").select("id, name").in("id", ids) : Promise.resolve({ data: [], error: null }),
    names.length ? supabase.from("ingredients").select("id, name").in("name", names) : Promise.resolve({ data: [], error: null }),
  ]);
  if (byId.error || byName.error) return { ok: false, message: "Die Zutaten konnten nicht geprüft werden." };
  const { mapping, toCreate } = resolveBackupIngredients(backup, [...byId.data, ...byName.data]);

  let created: { id: string; name: string }[] = [];
  if (toCreate.length) {
    const { data, error } = await supabase
      .from("ingredients")
      .insert(
        toCreate.map((i) => {
          const row: TablesInsert<"ingredients"> = {
            name: i.name,
            kcal: i.kcal,
            protein: i.protein,
            carbs: i.carbs,
            fat: i.fat,
            fiber: i.fiber,
            sugar: i.sugar,
            food_group: i.food_group,
            // null: ein Trigger belegt die Ernährungsform aus der Zutatengruppe vor
            diet: i.diet as NonNullable<typeof i.diet>,
            piece_weight_g: i.piece_weight_g,
            density_g_per_ml: i.density_g_per_ml,
            abv: i.abv,
            source: "user",
            created_by: user.id,
          };
          return row;
        }),
      )
      .select("id, name");
    if (error) return { ok: false, message: "Fehlende Zutaten konnten nicht angelegt werden." };
    created = data;
  }
  const fullMapping = completeMapping(backup, mapping, created);

  const { data: infos } = await supabase
    .from("ingredients")
    .select("id, density_g_per_ml, piece_weight_g")
    .in("id", [...new Set(fullMapping.values())]);
  const infoById = new Map((infos ?? []).map((i) => [i.id, i]));

  let imported = 0;
  for (const recipe of backup.recipes) {
    const ingredients = recipe.ingredients.flatMap((line) => {
      const ingredientId = fullMapping.get(line.ingredient.id);
      if (!ingredientId) return [];
      return [
        {
          ingredient_id: ingredientId,
          amount: line.amount,
          unit: line.amount == null ? null : line.unit,
          // Gramm neu berechnen; das gesicherte Gewicht gilt nur, wo es sich nicht umrechnen lässt
          grams: resolveLineGrams(line.amount, line.unit, infoById.get(ingredientId) ?? {}, line.grams),
          note: line.note ?? "",
          step_position: line.step_position,
          is_optional: line.is_optional,
        },
      ];
    });
    const { error } = await supabase.rpc("save_recipe", {
      p_recipe: {
        id: null,
        // Phase 15: Version 2 enthält Cocktails, Version 1 nur Gerichte (Standard „dish“)
        recipe_type: recipe.recipe_type,
        ...(recipe.recipe_type === "cocktail" && recipe.cocktail ? { cocktail: recipe.cocktail } : {}),
        title: recipe.title,
        description: recipe.description ?? "",
        servings: recipe.servings,
        prep_minutes: recipe.prep_minutes,
        cook_minutes: recipe.cook_minutes,
        // ältere Sicherungen: Schlüssel der früheren festen Liste („pasta“)
        category_name: recipe.recipe_type === "cocktail" ? null : normalizeCategory(recipe.category),
        tags: recipe.tags,
        is_meal_prep: recipe.is_meal_prep,
        source_url: recipe.source_url ?? "",
        side_dishes: recipe.side_dishes,
      },
      p_ingredients: ingredients,
      p_steps: recipe.steps,
    });
    if (!error) imported++;
  }

  revalidatePath("/rezepte");
  if (imported === 0) return { ok: false, message: "Es konnte kein Rezept importiert werden." };
  return { ok: true, imported, skipped: backup.recipes.length - imported, createdIngredients: created.length };
}
