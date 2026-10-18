import type { z } from "zod";

export type FieldErrors = Partial<Record<string, string[]>>;

/** Einheitlicher Rückgabewert für Server Actions mit Formular. */
export type ActionState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: FieldErrors;
};

/** FormData in ein einfaches Objekt umwandeln (leere optionale Felder fallen weg). */
export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) result[key] = value;
  }
  return result;
}

/** Validiert FormData gegen ein Zod-Schema, auf Client und Server gleich. */
export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
): { success: true; data: z.infer<S> } | { success: false; fieldErrors: FieldErrors } {
  const parsed = schema.safeParse(formDataToObject(formData));
  if (parsed.success) return { success: true, data: parsed.data };

  const fieldErrors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { success: false, fieldErrors };
}
