import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { RecipeEditor } from "@/components/recipes/editor/recipe-editor";
import { requireUser } from "@/lib/auth";
import { collectTags } from "@/lib/domain/recipe-filter";
import { getDilutionConfig, getNutritionThresholds } from "@/lib/server/app-config";
import { getCategoryNames } from "@/lib/server/categories";
import { getOwnRecipeList } from "@/lib/server/recipes";

export const metadata: Metadata = { title: "Neues Rezept" };

export default async function NewRecipePage({ searchParams }: PageProps<"/rezepte/neu">) {
  const user = await requireUser();
  // Phase 15: /rezepte/neu?typ=cocktail legt einen Cocktail an
  const cocktail = (await searchParams).typ === "cocktail";
  const [thresholds, dilution, list, categories] = await Promise.all([
    getNutritionThresholds(),
    getDilutionConfig(),
    getOwnRecipeList(user.id, cocktail ? "cocktail" : "dish"),
    getCategoryNames(user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={cocktail ? "Neuer Cocktail" : "Neues Rezept"} />
      <RecipeEditor
        thresholds={thresholds}
        dilution={dilution}
        tagSuggestions={collectTags(list)}
        sideSuggestions={list.map((r) => r.title)}
        categories={categories}
        initial={{
          recipe_type: cocktail ? "cocktail" : "dish",
          cocktail: cocktail ? { glass: null, method: null, ice: "", garnish: "" } : null,
          title: "",
          description: "",
          servings: cocktail ? 1 : 2,
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
