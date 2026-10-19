import { parsePhotoPath } from "@/lib/domain/photo";
import { RECIPE_PHOTO_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/**
 * Liefert ein Rezeptfoto aus dem privaten Storage-Bucket aus, mit den Rechten des angemeldeten Nutzers
 * (eigene Fotos und Fotos öffentlicher Rezepte). Pfade enthalten eine neue ID pro Foto und ändern sich nie,
 * daher darf der Browser sie lange zwischenspeichern ("private": nur der Browser, kein CDN).
 */
export async function GET(_request: Request, ctx: RouteContext<"/foto/[...pfad]">) {
  const { pfad } = await ctx.params;
  const path = pfad.join("/");
  const parsed = parsePhotoPath(path);
  if (!parsed) return new Response("Nicht gefunden", { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(RECIPE_PHOTO_BUCKET).download(path);
  if (error || !data) return new Response("Nicht gefunden", { status: 404 });

  return new Response(data, {
    headers: {
      "Content-Type": parsed.ext === "webp" ? "image/webp" : "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
