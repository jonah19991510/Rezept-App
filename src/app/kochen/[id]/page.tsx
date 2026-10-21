import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CookingMode } from "@/components/cooking/cooking-mode";
import { requireUser } from "@/lib/auth";
import { parseDecimal } from "@/lib/domain/decimal";
import { notesNewestFirst } from "@/lib/domain/cooklog";
import { getCookLogs } from "@/lib/server/kitchen-log";
import { getRecipeDetail } from "@/lib/server/recipes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/kochen/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Kochmodus" };
  const user = await requireUser();
  const detail = await getRecipeDetail(id, user.id);
  if (!detail) return { title: "Kochmodus" };
  return { title: `${detail.recipe.recipe_type === "cocktail" ? "Mixen" : "Kochen"}: ${detail.recipe.title}` };
}

/** Kochmodus als eigene Seite ohne Navigation (Vollbild über allem). */
export default async function CookPage({ params, searchParams }: PageProps<"/kochen/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const detail = await getRecipeDetail(id, user.id);
  if (!detail) notFound();

  const { recipe, ingredients, steps } = detail;
  const lastNote = notesNewestFirst(await getCookLogs(user.id, recipe.id))[0];
  // ?portionen=6 von der Rezeptseite übernehmen (nur sinnvolle Werte)
  const requested = parseDecimal(typeof query.portionen === "string" ? query.portionen : null);
  const initialServings = requested != null && requested >= 0.5 && requested <= 100 ? requested : recipe.servings;

  return (
    <CookingMode
      recipeId={recipe.id}
      title={recipe.title}
      recipeServings={recipe.servings}
      initialServings={initialServings}
      lines={ingredients.map((l) => ({
        id: l.id,
        amount: l.amount,
        unit: l.unit,
        name: l.ingredient.name,
        // Optionale Zutaten als Hinweis an der Notiz
        note: l.is_optional ? [l.note, "optional"].filter(Boolean).join(", ") : l.note,
        stepPosition: l.step_position,
      }))}
      steps={steps.map((s) => ({ position: s.position, text: s.text, timerSeconds: s.timer_seconds }))}
      lastNote={lastNote?.note ? { text: lastNote.note, date: lastNote.date } : null}
      kind={recipe.recipe_type}
    />
  );
}
