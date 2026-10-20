import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { markdownFileName, recipeToMarkdown } from "@/lib/domain/recipe-markdown";
import { getRecipeForMarkdown } from "@/lib/server/data-export";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Markdown-Export eines einzelnen Rezepts (eigenes oder öffentliches, RLS entscheidet). */
export async function GET(_request: Request, ctx: RouteContext<"/rezepte/[id]/markdown">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) notFound();
  await requireUser();
  const recipe = await getRecipeForMarkdown(id);
  if (!recipe) notFound();
  return new Response(recipeToMarkdown(recipe), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${markdownFileName(recipe.title)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
