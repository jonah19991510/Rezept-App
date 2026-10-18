import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-accent text-primary">
        <SearchX className="size-8" aria-hidden />
      </span>
      <h1 className="text-3xl font-semibold">Seite nicht gefunden</h1>
      <p className="max-w-sm text-muted-foreground">Diese Seite gibt es nicht (mehr). Vielleicht hilft der Weg zurück ins Rezeptbuch.</p>
      <Link href="/rezepte" className={buttonVariants({ size: "lg" })}>
        Zu meinen Rezepten
      </Link>
    </main>
  );
}
