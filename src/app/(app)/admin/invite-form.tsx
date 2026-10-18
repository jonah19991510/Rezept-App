"use client";

import { useEffect, useRef } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Button } from "@/components/ui/button";
import { inviteSchema } from "@/lib/validation/auth";
import { inviteUserAction } from "./actions";

export function InviteForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { state, formAction, pending, errors, onSubmit } = useValidatedAction(inviteSchema, inviteUserAction);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormMessage message={state.message} ok={state.ok} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <FormField
          label="E-Mail-Adresse"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          required
          errors={errors.email}
        />
        <Button type="submit" disabled={pending} className="sm:mt-6.5">
          {pending ? "Wird verschickt …" : "Einladung senden"}
        </Button>
      </div>
    </form>
  );
}
