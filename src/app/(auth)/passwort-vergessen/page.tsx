import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/layout/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Passwort vergessen" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Passwort vergessen?"
      description="Kein Problem. Wir schicken dir einen Link, mit dem du ein neues Passwort setzen kannst."
      footer={
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Zurück zur Anmeldung
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
