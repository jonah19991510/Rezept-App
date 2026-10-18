"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { deleteUserCompletely } from "@/lib/server/delete-user";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteUserSchema, inviteSchema } from "@/lib/validation/auth";
import { parseForm, type ActionState } from "@/lib/validation/form";

export async function inviteUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Jede Admin-Action prüft die Rolle selbst, nie nur die Seite.
  await requireAdmin();

  const parsed = parseForm(inviteSchema, formData);
  if (!parsed.success) return { fieldErrors: parsed.fieldErrors };

  const admin = createAdminClient();
  const siteUrl = await getSiteUrl();
  const { error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/confirm`,
  });

  if (error) {
    if (error.code === "email_exists" || error.status === 422) {
      return { message: "Für diese E-Mail-Adresse gibt es schon einen Account." };
    }
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return {
        message:
          "Supabase hat gerade zu viele Mails verschickt (Limit des Standard-Mailversands). Bitte versuche es in einer Stunde noch einmal.",
      };
    }
    return { message: "Die Einladung konnte nicht verschickt werden. Bitte versuche es noch einmal." };
  }

  revalidatePath("/admin");
  return { ok: true, message: `Einladung an ${parsed.data.email} ist unterwegs.` };
}

export async function deleteUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const currentAdmin = await requireAdmin();

  const parsed = parseForm(deleteUserSchema, formData);
  if (!parsed.success) return { message: "Ungültige Anfrage." };

  if (parsed.data.userId === currentAdmin.id) {
    return { message: "Deinen eigenen Account löschst du in den Einstellungen." };
  }

  try {
    await deleteUserCompletely(parsed.data.userId);
  } catch {
    return { message: "Der Nutzer konnte nicht gelöscht werden. Bitte versuche es noch einmal." };
  }

  revalidatePath("/admin");
  return { ok: true, message: "Der Nutzer und alle seine Daten wurden gelöscht." };
}
