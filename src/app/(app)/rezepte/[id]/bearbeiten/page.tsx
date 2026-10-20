import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BarMood } from "@/components/bar/bar-mood";
import { PageHeader } from "@/components/layout/page-header";
import { RecipeEditor } from "@/components/recipes/editor/recipe-editor";
import { requireUser } from "@/lib/auth";
import { toIngredientOption } from "@/lib/domain/ingredient-option";
import { collectTags } from "@/lib/domain/recipe-filter";
import { getDilutionConfig, getNutritionThresholds } from "@/lib/server/app-config";
import { getOwnRecipeList, getRecipeDetail } from "@/lib/server/recipes";

export const metadata: Metadata = { title: "Rezept bearbeiten" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditRecipePage({ params }: PageProps<"/rezepte/[id]/bearbeiten">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const [detail, thresholds, dilution] = await Promise.all([
    getRecipeDetail(id, user.id),
    getNutritionThresholds(),
    getDilutionConfig(),
  ]);
  // Fremde Rezepte lassen sich nicht bearbeiten (RLS würde das Speichern ohnehin ablehnen)
  if (!detail || !detail.isOwner) notFound();

  const { recipe, cocktail } = detail;
  const isCocktail = recipe.recipe_type === "cocktail";
  const list = await getOwnRecipeList(user.id, recipe.recipe_type);
  return (
    <div className="mx-auto max-w-3xl">
      {isCocktail ? <BarMood /> : null}
      <PageHeader title={isCocktail ? "Cocktail bearbeiten" : "Rezept bearbeiten"} description={recipe.title} />
      <RecipeEditor
        thresholds={thresholds}
        dilution={dilution}
        tagSuggestions={collectTags(list)}
        initial={{
          id: recipe.id,
          recipe_type: recipe.recipe_type,
          cocktail: isCocktail
            ? { glass: cocktail?.glass ?? null, method: cocktail?.method ?? null, ice: cocktail?.ice ?? "", garnish: cocktail?.garnish ?? "" }
            : null,
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
