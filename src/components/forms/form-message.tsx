import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Hinweis über oder unter einem Formular: Fehler (rot) oder Erfolg (Salbei). */
export function FormMessage({ message, ok }: { message?: string; ok?: boolean }) {
  if (!message) return null;
  const Icon = ok ? CircleCheck : CircleAlert;
  return (
    <div
      role={ok ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm",
        ok
          ? "border-sage/40 bg-sage/10 text-foreground"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", ok && "text-sage")} aria-hidden />
      <p>{message}</p>
    </div>
  );
}
