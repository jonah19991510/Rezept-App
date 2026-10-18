import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormFieldProps = ComponentProps<typeof Input> & {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
};

/** Beschriftetes Eingabefeld mit Fehlermeldung darunter. */
export function FormField({ label, name, errors, hint, id, ...inputProps }: FormFieldProps) {
  const inputId = id ?? name;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const hasError = Boolean(errors && errors.length > 0);

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        name={name}
        aria-invalid={hasError || undefined}
        aria-describedby={[hasError ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined}
        {...inputProps}
      />
      {hint && !hasError ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p id={errorId} className="text-sm text-destructive">
          {errors?.[0]}
        </p>
      ) : null}
    </div>
  );
}
