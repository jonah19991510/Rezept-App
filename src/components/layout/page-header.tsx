import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Zeile über die volle Breite unter dem Titel (z. B. Hinweis links, Link rechts) */
  meta?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 space-y-1 break-words">
        <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
      {meta ? <div className="-mt-1 basis-full">{meta}</div> : null}
    </header>
  );
}
