"use client";

import Link from "next/link";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Button } from "@/components/ui/button";
import { loginSchema } from "@/lib/validation/auth";
import { loginAction } from "../actions";

export function LoginForm({ weiter }: { weiter?: string }) {
  const { state, formAction, pending, errors, onSubmit } = useValidatedAction(loginSchema, loginAction);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormMessage message={state.message} ok={state.ok} />
      {weiter ? <input type="hidden" name="weiter" value={weiter} /> : null}
      <FormField label="E-Mail" name="email" type="email" autoComplete="email" inputMode="email" required errors={errors.email} />
      <FormField
        label="Passwort"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={errors.password}
      />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Wird angemeldet …" : "Anmelden"}
      </Button>
      <Link
        href="/passwort-vergessen"
        className="inline-flex min-h-11 items-center justify-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Passwort vergessen?
      </Link>
    </form>
  );
}
