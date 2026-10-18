"use client";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Button } from "@/components/ui/button";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { forgotPasswordAction } from "../actions";

export function ForgotPasswordForm() {
  const { state, formAction, pending, errors, onSubmit } = useValidatedAction(
    forgotPasswordSchema,
    forgotPasswordAction,
  );

  if (state.ok) return <FormMessage message={state.message} ok />;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormMessage message={state.message} ok={state.ok} />
      <FormField label="E-Mail" name="email" type="email" autoComplete="email" inputMode="email" required errors={errors.email} />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Wird gesendet …" : "Link anfordern"}
      </Button>
    </form>
  );
}
