"use client";

import { useActionState, useState, type FormEvent } from "react";
import type { z } from "zod";
import { parseForm, type ActionState, type FieldErrors } from "@/lib/validation/form";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Prüft ein Formular vor dem Absenden mit demselben Zod-Schema wie der Server
 * und ruft erst dann die Server Action auf.
 */
export function useValidatedAction<S extends z.ZodType>(schema: S, action: ServerAction) {
  const [state, formAction, pending] = useActionState(action, {});
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const result = parseForm(schema, new FormData(event.currentTarget));
    if (!result.success) {
      event.preventDefault();
      setClientErrors(result.fieldErrors);
      return;
    }
    setClientErrors(null);
  }

  const errors: FieldErrors = clientErrors ?? state.fieldErrors ?? {};
  return { state, formAction, pending, errors, onSubmit };
}
