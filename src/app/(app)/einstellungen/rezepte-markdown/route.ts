import { requireUser } from "@/lib/auth";
import { bookToMarkdown } from "@/lib/domain/recipe-markdown";
import { getOwnRecipesForMarkdown } from "@/lib/server/data-export";

/** Das ganze eigene Rezeptbuch als Markdown, mit Inhaltsverzeichnis oben. */
export async function GET() {
  const user = await requireUser();
  const now = new Date();
  const recipes = await getOwnRecipesForMarkdown(user.id);
  const markdown = bookToMarkdown(recipes, { title: `Rezeptbuch von ${user.displayName}`, exportedAt: now });
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="rezeptbuch-${now.toISOString().slice(0, 10)}.md"`,
      "Cache-Control": "private, no-store",
    },
  });
}
