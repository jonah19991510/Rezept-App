"use server";

import { redirect } from "next/navigation";
import { getSignupMode } from "@/lib/env";
import { safeRedirectPath } from "@/lib/redirect";
import { getSiteUrl } from "@/lib/site-url";
import { createAnonClient } from "@/lib/supabase/anon";
import { createClient } from "@/lib/supabase/server";
import {
  confirmSchema,
  forgotPasswordSchema,
  loginSchema,
  setPasswordSchema,
  signupSchema,
} from "@/lib/validation/auth";
import { parseForm, type ActionState } from "@/lib/validation/form";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(loginSchema, formData);
  if (!parsed.success) return { fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { message: "Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Mail." };
    }
    return { message: "E-Mail-Adresse oder Passwort ist falsch." };
  }

  redirect(safeRedirectPath(formData.get("weiter")));
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseForm(forgotPasswordSchema, formData);
  if (!parsed.success) return { fieldErrors: parsed.fieldErrors };

  const supabase = createAnonClient();
  const siteUrl = await getSiteUrl();
  // Ergebnis bewusst nicht unterscheiden: Niemand soll herausfinden können, ob eine Adresse registriert ist.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/confirm`,
  });

  return {
    ok: true,
    message:
      "Falls es zu dieser Adresse einen Account gibt, ist jetzt eine E-Mail mit einem Link zum Zurücksetzen unterwegs.",
  };
}

export async function confirmAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(confirmSchema, formData);
  if (!parsed.success) return { message: "Der Link ist unvollständig. Bitte öffne ihn erneut aus der E-Mail." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: parsed.data.token_hash,
    type: parsed.data.type,
  });
  if (error) {
    return {
      message:
        "Der Link ist ungültig oder abgelaufen. Lass dir eine neue Einladung schicken oder setze dein Passwort erneut zurück.",
    };
  }

  switch (parsed.data.type) {
    case "invite":
      redirect("/passwort-setzen?neu=1");
    case "recovery":
      redirect("/passwort-setzen");
    case "email_change":
      redirect("/einstellungen");
    default:
      redirect("/");
  }
}

export async function setPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(setPasswordSchema, formData);
  if (!parsed.success) return { fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { fieldErrors: { password: ["Bitte wähle ein anderes Passwort als bisher."] } };
    }
    if (error.code === "weak_password") {
      return { fieldErrors: { password: ["Dieses Passwort ist zu schwach. Bitte wähle ein längeres."] } };
    }
    return { message: "Das Passwort konnte nicht gespeichert werden. Bitte versuche es noch einmal." };
  }

  if (parsed.data.displayName) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ display_name: parsed.data.displayName })
      .eq("id", userId);
    if (profileError) {
      return { message: "Passwort gespeichert, aber der Anzeigename konnte nicht gesetzt werden." };
    }
  }

  redirect("/");
}

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Auch serverseitig prüfen: Im Einladungsmodus gibt es keine freie Registrierung.
  if (getSignupMode() !== "open") {
    return { message: "Die Registrierung ist nur mit Einladung möglich." };
  }

  const parsed = parseForm(signupSchema, formData);
  if (!parsed.success) return { fieldErrors: parsed.fieldErrors };

  const supabase = createAnonClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${siteUrl}/auth/confirm`,
    },
  });
  if (error) {
    if (error.code === "weak_password") {
      return { fieldErrors: { password: ["Dieses Passwort ist zu schwach. Bitte wähle ein längeres."] } };
    }
    if (error.code === "signup_disabled") {
      return { message: "Die Registrierung ist im Moment geschlossen." };
    }
    return { message: "Die Registrierung hat nicht geklappt. Bitte versuche es später noch einmal." };
  }

  return {
    ok: true,
    message: "Fast geschafft! Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben.",
  };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
