import { getSharedPhoto } from "@/lib/server/shared-recipes";

/**
 * Foto einer geteilten Rezeptkarte, ohne Login. Nur solange der Link gilt: nach dem Widerrufen 404.
 * Kurz und nur im Browser zwischenspeichern (kein CDN), damit ein widerrufener Link schnell nichts mehr zeigt.
 */
export async function GET(request: Request, ctx: RouteContext<"/r/[token]/foto">) {
  const { token } = await ctx.params;
  const size = new URL(request.url).searchParams.get("groesse") === "klein" ? "klein" : "gross";
  const photo = await getSharedPhoto(token, size);
  if (!photo) return new Response("Nicht gefunden", { status: 404 });
  return new Response(photo.data, {
    headers: { "Content-Type": photo.contentType, "Cache-Control": "private, max-age=600" },
  });
}
