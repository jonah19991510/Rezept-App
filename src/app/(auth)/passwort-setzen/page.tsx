import type { Metadata } from "next";
import { AuthCard } from "@/components/layout/auth-card";
import { requireUser } from "@/lib/auth";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Passwort setzen" };

export default async function SetPasswordPage({ searchParams }: PageProps<"/passwort-setzen">) {
  const user = await requireUser();
  const { neu } = await searchParams;
  const isInvite = neu === "1";

  return (
    <AuthCard
      title={isInvite ? "Willkommen!" : "Neues Passwort"}
      description={
        isInvite
          ? "Schön, dass du dabei bist. Wähle einen Anzeigenamen und ein Passwort für deinen Account."
          : "Wähle ein neues Passwort für deinen Account."
      }
    >
      <SetPasswordForm
        askDisplayName={isInvite}
        defaultDisplayName={user.displayName === "Neues Mitglied" ? "" : user.displayName}
      />
    </AuthCard>
  );
}
