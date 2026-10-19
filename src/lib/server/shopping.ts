import "server-only";
import type { FoodGroup } from "@/lib/domain/shopping";
import { createClient } from "@/lib/supabase/server";

export type ShoppingItem = {
  id: string;
  /** null bei eigenen Einträgen ohne Zutat */
  ingredientId: string | null;
  name: string;
  amount: number | null;
  unit: string | null;
  checked: boolean;
  source: "plan" | "manual";
  /** null bei von Hand angelegten Einträgen ohne Zutat */
  foodGroup: FoodGroup | null;
  isStaple: boolean;
};

export async function getShoppingList(userId: string): Promise<{ items: ShoppingItem[]; hideStaples: boolean }> {
  const supabase = await createClient();
  const [list, settings] = await Promise.all([
    supabase
      .from("shopping_list_items")
      .select("id, ingredient_id, name, amount, unit, checked, source, ingredients!shopping_list_items_ingredient_id_fkey(food_group, is_staple)")
      .eq("user_id", userId)
      .order("created_at"),
    supabase.from("user_settings").select("hide_staples").eq("user_id", userId).maybeSingle(),
  ]);
  if (list.error) throw new Error(`Einkaufsliste konnte nicht geladen werden (${list.error.code})`);

  return {
    hideStaples: settings.data?.hide_staples ?? true,
    items: list.data.map((row) => ({
      id: row.id,
      ingredientId: row.ingredient_id,
      name: row.name,
      amount: row.amount,
      unit: row.unit,
      checked: row.checked,
      source: row.source,
      foodGroup: row.ingredients?.food_group ?? null,
      isStaple: row.ingredients?.is_staple ?? false,
    })),
  };
}
