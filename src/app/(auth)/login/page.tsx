import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/layout/auth-card";
import { getSignupMode } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { weiter } = await searchParams;
  const signupOpen = getSignupMode() === "open";

  return (
    <AuthCard
      title="Willkommen zurück"
      description="Melde dich mit deiner E-Mail-Adresse an."
      footer={
        signupOpen ? (
          <p>
            Noch kein Account?{" "}
            <Link href="/registrieren" className="font-medium text-primary underline-offset-4 hover:underline">
              Registrieren
            </Link>
          </p>
        ) : (
          <p>Neue Accounts gibt es nur auf Einladung.</p>
        )
      }
    >
      <LoginForm weiter={typeof weiter === "string" ? weiter : undefined} />
    </AuthCard>
  );
}
