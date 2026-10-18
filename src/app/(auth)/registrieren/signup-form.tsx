"use client";

import Link from "next/link";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Button } from "@/components/ui/button";
import { signupSchema } from "@/lib/validation/auth";
import { signupAction } from "../actions";

export function SignupForm() {
  const { state, formAction, pending, errors, onSubmit } = useValidatedAction(signupSchema, signupAction);

  if (state.ok) return <FormMessage message={state.message} ok />;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormMessage message={state.message} ok={state.ok} />
      <FormField
        label="Anzeigename"
        name="displayName"
        autoComplete="nickname"
        maxLength={50}
        required
        hint="So sehen dich andere. Deine E-Mail-Adresse bleibt privat."
        errors={errors.displayName}
      />
      <FormField label="E-Mail" name="email" type="email" autoComplete="email" inputMode="email" required errors={errors.email} />
      <FormField
        label="Passwort"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Mindestens 8 Zeichen."
        errors={errors.password}
      />
      <p className="text-sm text-muted-foreground">
        Mit der Registrierung gelten unser{" "}
        <Link href="/impressum" className="text-primary underline-offset-4 hover:underline">
          Impressum
        </Link>{" "}
        und die{" "}
        <Link href="/datenschutz" className="text-primary underline-offset-4 hover:underline">
          Datenschutzerklärung
        </Link>
        .
      </p>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Wird erstellt …" : "Registrieren"}
      </Button>
    </form>
  );
}
