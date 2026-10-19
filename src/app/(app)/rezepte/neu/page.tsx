import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { RecipeEditor } from "@/components/recipes/editor/recipe-editor";
import { requireUser } from "@/lib/auth";
import { collectTags } from "@/lib/domain/recipe-filter";
import { getNutritionThresholds } from "@/lib/server/app-config";
import { getOwnRecipeList } from "@/lib/server/recipes";

export const metadata: Metadata = { title: "Neues Rezept" };

export default async function NewRecipePage() {
  const user = await requireUser();
  const [thresholds, list] = await Promise.all([getNutritionThresholds(), getOwnRecipeList(user.id)]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Neues Rezept" />
      <RecipeEditor
        thresholds={thresholds}
        tagSuggestions={collectTags(list)}
        initial={{
          title: "",
          description: "",
          servings: 2,
          prep_minutes: null,
          cook_minutes: null,
          category: null,
          tags: [],
          is_meal_prep: false,
          source_url: "",
          ingredients: [],
          steps: [],
        }}
      />
    </div>
  );
}
