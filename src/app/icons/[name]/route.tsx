import { appIconResponse } from "@/lib/app-icon";

// Icons für das Web-App-Manifest, beim Bauen als feste PNG-Dateien erzeugt.
const ICONS = {
  "icon-192.png": { size: 192, rounded: true, glyph: 0.62 },
  "icon-512.png": { size: 512, rounded: true, glyph: 0.62 },
  // maskable: Fläche ganz gefüllt, Symbol innerhalb der Sicherheitszone (innere 80 %)
  "icon-maskable-512.png": { size: 512, rounded: false, glyph: 0.5 },
} as const;

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_request: Request, ctx: RouteContext<"/icons/[name]">) {
  const { name } = await ctx.params;
  const icon = ICONS[name as keyof typeof ICONS];
  if (!icon) return new Response("Nicht gefunden", { status: 404 });
  return appIconResponse(icon.size, icon);
}
