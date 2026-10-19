import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Rahmen für ein Diagramm: Titel, Erklärung, Diagramm und eine aufklappbare Tabelle mit denselben Werten. */
export function ChartCard({
  title,
  description,
  children,
  table,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  table?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-3xl border bg-card p-4 md:p-5", className)} aria-label={title}>
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </header>
      {children}
      {table ? (
        <details className="group text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-muted-foreground hover:text-foreground">
            Als Tabelle anzeigen
          </summary>
          <div className="mt-2 overflow-x-auto">{table}</div>
        </details>
      ) : null}
    </section>
  );
}

/** Schlichte Datentabelle für die Tabellenansicht der Diagramme. */
export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b text-muted-foreground">
          {head.map((h, i) => (
            <th key={h} className={cn("py-1.5 pr-3 font-medium", i > 0 && "text-right")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-b last:border-0">
            {row.map((cell, i) => (
              <td key={i} className={cn("py-1.5 pr-3", i > 0 && "text-right tabular-nums")}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Tooltip-Inhalt: Wert betont, Beschriftung leiser, Farbkennung als kurzer Strich. */
export function TooltipBox({ title, rows }: { title?: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-36 rounded-xl border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      {title ? <p className="mb-1 max-w-56 font-medium">{title}</p> : null}
      <ul className="space-y-0.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {row.color ? <span className="h-0.5 w-3 rounded-full" style={{ background: row.color }} aria-hidden /> : null}
              {row.label}
            </span>
            <span className="font-semibold tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
export const CHART_OTHER = "var(--chart-other)";
export const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };
