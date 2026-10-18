"use client";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Button } from "@/components/ui/button";
import { setPasswordSchema } from "@/lib/validation/auth";
import { setPasswordAction } from "../actions";

export function SetPasswordForm({
  askDisplayName,
  defaultDisplayName,
}: {
  askDisplayName: boolean;
  defaultDisplayName: string;
}) {
  const { state, formAction, pending, errors, onSubmit } = useValidatedAction(setPasswordSchema, setPasswordAction);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormMessage message={state.message} ok={state.ok} />
      {askDisplayName ? (
        <FormField
          label="Anzeigename"
          name="displayName"
          autoComplete="nickname"
          defaultValue={defaultDisplayName}
          maxLength={50}
          required
          hint="So sehen dich andere, z. B. bei veröffentlichten Rezepten. Deine E-Mail-Adresse bleibt privat."
          errors={errors.displayName}
        />
      ) : null}
      <FormField
        label="Passwort"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Mindestens 8 Zeichen."
        errors={errors.password}
      />
      <FormField
        label="Passwort wiederholen"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        errors={errors.passwordConfirm}
      />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Wird gespeichert …" : "Speichern und loslegen"}
      </Button>
    </form>
  );
}
