import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { RecipeEditor } from "@/components/recipes/editor/recipe-editor";
import { requireUser } from "@/lib/auth";
import { toIngredientOption } from "@/lib/domain/ingredient-option";
import { collectTags } from "@/lib/domain/recipe-filter";
import { getNutritionThresholds } from "@/lib/server/app-config";
import { getOwnRecipeList, getRecipeDetail } from "@/lib/server/recipes";

export const metadata: Metadata = { title: "Rezept bearbeiten" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditRecipePage({ params }: PageProps<"/rezepte/[id]/bearbeiten">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const [detail, thresholds, list] = await Promise.all([
    getRecipeDetail(id, user.id),
    getNutritionThresholds(),
    getOwnRecipeList(user.id),
  ]);
  // Fremde Rezepte lassen sich nicht bearbeiten (RLS würde das Speichern ohnehin ablehnen)
  if (!detail || !detail.isOwner) notFound();

  const { recipe } = detail;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Rezept bearbeiten" description={recipe.title} />
      <RecipeEditor
        thresholds={thresholds}
        tagSuggestions={collectTags(list)}
        initial={{
          id: recipe.id,
          title: recipe.title,
          description: recipe.description ?? "",
          servings: recipe.servings,
          prep_minutes: recipe.prep_minutes,
          cook_minutes: recipe.cook_minutes,
          category: recipe.category,
          tags: recipe.tags,
          is_meal_prep: recipe.is_meal_prep,
          source_url: recipe.source_url ?? "",
          ingredients: detail.ingredients.map((line) => ({
            ingredient: toIngredientOption(line.ingredient),
            amount: line.amount,
            unit: line.unit,
            grams: line.grams,
            note: line.note ?? "",
            step_position: line.step_position,
          })),
          steps: detail.steps.map((s) => ({ text: s.text, timer_seconds: s.timer_seconds })),
        }}
      />
    </div>
  );
}
