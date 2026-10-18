import Link from "next/link";
import { getSignupMode } from "@/lib/env";
import { cn } from "@/lib/utils";

/** Links zu Impressum und Datenschutz. Erst sichtbar, wenn die Registrierung offen ist (SIGNUP_MODE=open). */
export function LegalFooter({ className }: { className?: string }) {
  if (getSignupMode() !== "open") return null;
  return (
    <footer className={cn("flex justify-center gap-4 py-6 text-sm text-muted-foreground", className)}>
      <Link href="/impressum" className="inline-flex min-h-11 items-center hover:text-foreground">
        Impressum
      </Link>
      <Link href="/datenschutz" className="inline-flex min-h-11 items-center hover:text-foreground">
        Datenschutz
      </Link>
    </footer>
  );
}
