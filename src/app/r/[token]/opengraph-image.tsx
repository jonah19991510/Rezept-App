import { notFound } from "next/navigation";
import { getSharedPhotoDataUrl, getSharedRecipe } from "@/lib/server/shared-recipes";
import { asJpeg, sharedOgImage } from "@/lib/share-images";

// Vorschaubild für Messenger (WhatsApp, Signal, Telegram …), Next setzt og:image automatisch.
export const alt = "Rezeptkarte";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

export default async function OpenGraphImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const recipe = await getSharedRecipe(token);
  if (!recipe) notFound();
  const photo = await getSharedPhotoDataUrl(token, { width: size.height, height: size.height });
  return new Response(await asJpeg(sharedOgImage(recipe, photo, size)), {
    headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=300" },
  });
}
