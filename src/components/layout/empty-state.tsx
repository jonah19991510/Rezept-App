import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Freundlicher Hinweis, wenn ein Bereich noch leer ist. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed bg-card/60 px-6 py-14 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-accent text-primary">
        <Icon className="size-8" aria-hidden />
      </span>
      <div className="max-w-sm space-y-1.5">
        <h2 className="text-xl font-semibold">{title}</h2>
        {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}
