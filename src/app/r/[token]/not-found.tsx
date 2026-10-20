import { Link2Off } from "lucide-react";
import { Brand } from "@/components/layout/brand";

/** Ungültiger oder widerrufener Link: nichts verraten, nur freundlich erklären. */
export default function SharedNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-accent text-primary">
        <Link2Off className="size-8" aria-hidden />
      </span>
      <h1 className="text-3xl font-semibold">Link ungültig</h1>
      <p className="max-w-sm text-muted-foreground">
        Dieses Rezept ist nicht (mehr) geteilt. Vielleicht wurde der Link widerrufen. Frag am besten bei der Person nach,
        die ihn dir geschickt hat.
      </p>
      <Brand href="/" className="mt-4" />
    </main>
  );
}
