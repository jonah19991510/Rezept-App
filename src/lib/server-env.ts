import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  // Secret Key (sb_secret_…) oder Legacy-service_role-Key. Niemals NEXT_PUBLIC_!
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export function getServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
  if (!parsed.success) {
    throw new Error("SUPABASE_SECRET_KEY fehlt (nur serverseitig, siehe .env.example).");
  }
  return parsed.data;
}
