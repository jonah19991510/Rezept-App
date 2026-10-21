import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/** Seiten, die ohne Login erreichbar sind. */
const PUBLIC_PATHS = [
  "/login",
  "/passwort-vergessen",
  "/registrieren",
  "/auth/confirm",
  "/impressum",
  "/datenschutz",
  "/r/", // geteilte Rezeptkarten (Phase 14)
  "/api/keep-alive", // täglicher Aufruf von Vercel Cron, hält Supabase wach
];

/** Seiten, die eingeloggte Nutzer nicht mehr sehen müssen. */
const GUEST_ONLY_PATHS = ["/login", "/passwort-vergessen", "/registrieren"];

function matches(pathname: string, paths: string[]) {
  return paths.some((p) =>
    p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Erneuert bei jeder Anfrage die Supabase-Session (Cookies) und leitet
 * nicht eingeloggte Nutzer zum Login weiter. Die eigentliche Prüfung der
 * Rechte passiert zusätzlich serverseitig in jeder Seite/Action und per RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Wichtig: zwischen createServerClient und getClaims keinen weiteren Code ausführen.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!isLoggedIn && !matches(pathname, PUBLIC_PATHS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("weiter", pathname);
    return redirectWithCookies(url, response);
  }

  if (isLoggedIn && matches(pathname, GUEST_ONLY_PATHS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/rezepte";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

/** Redirect, der die eventuell erneuerten Session-Cookies mitnimmt. */
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
