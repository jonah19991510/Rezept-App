import { shareImageFileName } from "@/lib/domain/shared-recipe";
import { getSharedPhotoDataUrl, getSharedRecipe } from "@/lib/server/shared-recipes";
import { STORY_PHOTO, asJpeg, sharedStoryImage } from "@/lib/share-images";

/** Rezeptkarte als Bild (1080×1920 JPEG, z. B. für Instagram-Stories), zum Herunterladen. */
export async function GET(_request: Request, ctx: RouteContext<"/r/[token]/bild">) {
  const { token } = await ctx.params;
  const recipe = await getSharedRecipe(token);
  if (!recipe) return new Response("Nicht gefunden", { status: 404 });
  const image = sharedStoryImage(recipe, await getSharedPhotoDataUrl(token, STORY_PHOTO));
  return new Response(await asJpeg(image, 88), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename="${shareImageFileName(recipe.title)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
