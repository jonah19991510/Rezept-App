import { z } from "zod";

export const emailSchema = z
  .string({ error: "Bitte gib deine E-Mail-Adresse ein." })
  .trim()
  .toLowerCase()
  .min(1, "Bitte gib deine E-Mail-Adresse ein.")
  .max(254, "Die E-Mail-Adresse ist zu lang.")
  .pipe(z.email("Das sieht nicht nach einer gültigen E-Mail-Adresse aus."));

// bcrypt (Supabase Auth) nutzt höchstens 72 Byte
export const passwordSchema = z
  .string({ error: "Bitte gib ein Passwort ein." })
  .min(8, "Das Passwort muss mindestens 8 Zeichen lang sein.")
  .max(72, "Das Passwort darf höchstens 72 Zeichen lang sein.");

export const displayNameSchema = z
  .string({ error: "Bitte gib einen Anzeigenamen ein." })
  .trim()
  .min(1, "Bitte gib einen Anzeigenamen ein.")
  .max(50, "Der Anzeigename darf höchstens 50 Zeichen lang sein.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Bitte gib dein Passwort ein."),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const setPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirm: z.string(),
    displayName: displayNameSchema.optional(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Die beiden Passwörter stimmen nicht überein.",
  });

export const signupSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const otpTypeSchema = z.enum(["invite", "recovery", "signup", "email", "email_change", "magiclink"]);

export const confirmSchema = z.object({
  token_hash: z.string().min(1).max(512),
  type: otpTypeSchema,
});

export const inviteSchema = z.object({
  email: emailSchema,
});

export const deleteUserSchema = z.object({
  userId: z.uuid("Ungültige Nutzer-ID."),
});
