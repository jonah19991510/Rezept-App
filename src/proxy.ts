import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Alles außer statischen Dateien, Bildern, Metadaten- und PWA-Dateien (brauchen keinen Login)
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|icons/|robots.txt|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
