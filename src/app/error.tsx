"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold">Da ist etwas schiefgelaufen</h1>
      <p className="max-w-sm text-muted-foreground">
        Bitte versuche es noch einmal. Wenn der Fehler bleibt, lade die Seite neu oder melde dich kurz ab und wieder an.
      </p>
      <Button size="lg" onClick={reset}>
        Noch einmal versuchen
      </Button>
    </main>
  );
}
