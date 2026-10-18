import { z } from "zod";

// Öffentliche Variablen: werden beim Build in den Client eingebettet.
// Sie müssen hier wörtlich als process.env.NEXT_PUBLIC_… stehen, sonst ersetzt Next sie nicht.
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export function getPublicEnv() {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      "Supabase-Umgebungsvariablen fehlen. Kopiere .env.example nach .env.local und trage URL und Publishable Key ein.",
    );
  }
  return parsed.data;
}

export const signupModeSchema = z.enum(["invite", "open"]);
export type SignupMode = z.infer<typeof signupModeSchema>;

/** Standard ist `invite`. Alles, was nicht exakt `open` ist, gilt als `invite`. */
export function getSignupMode(): SignupMode {
  return process.env.SIGNUP_MODE === "open" ? "open" : "invite";
}
