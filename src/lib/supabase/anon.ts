import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Client ohne Session für Mails wie „Passwort zurücksetzen“ und „E-Mail bestätigen“.
 * Implicit Flow: Der Link aus der Mail funktioniert auch auf einem anderen Gerät
 * als dem, auf dem er angefordert wurde (beim PKCE-Flow müsste es derselbe Browser sein).
 */
export function createAnonClient() {
  const env = getPublicEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
