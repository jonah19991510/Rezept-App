"use client";

import { useActionState } from "react";
import { confirmAction } from "@/app/(auth)/actions";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";

export function ConfirmForm({
  tokenHash,
  type,
  buttonLabel,
}: {
  tokenHash: string;
  type: string;
  buttonLabel: string;
}) {
  const [state, formAction, pending] = useActionState(confirmAction, {});

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage message={state.message} ok={state.ok} />
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Einen Moment …" : buttonLabel}
      </Button>
    </form>
  );
}
