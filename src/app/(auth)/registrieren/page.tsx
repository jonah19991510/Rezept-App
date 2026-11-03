import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthCard } from "@/components/layout/auth-card";
import { getSignupMode } from "@/lib/env";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Registrieren" };

export default function SignupPage() {
  // Im Einladungsmodus gibt es diese Seite nicht.
  if (getSignupMode() !== "open") notFound();

  return (
    <AuthCard
      title="Account erstellen"
      description="Rezepte, Training und Ziele an einem Ort."
      footer={
        <p>
          Schon registriert?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Anmelden
          </Link>
        </p>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
