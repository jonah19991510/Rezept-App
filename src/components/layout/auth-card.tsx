import type { ReactNode } from "react";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border bg-card p-6 shadow-sm shadow-foreground/5">
      <header className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </header>
      {children}
      {footer ? <div className="mt-6 border-t pt-4 text-sm text-muted-foreground">{footer}</div> : null}
    </section>
  );
}
