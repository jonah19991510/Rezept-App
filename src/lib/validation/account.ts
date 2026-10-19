import { z } from "zod";
import { displayNameSchema, passwordSchema } from "./auth";

export const displayNameFormSchema = z.object({ displayName: displayNameSchema });

export const changePasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Die beiden Passwörter stimmen nicht überein.",
  });

/** Zur Bestätigung muss der eigene Anzeigename eingetippt werden (Vergleich auf dem Server). */
export const deleteAccountSchema = z.object({
  confirmName: z.string().trim().min(1, "Bitte tippe deinen Anzeigenamen ein."),
});
