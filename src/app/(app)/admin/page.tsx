import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { DeleteUserButton } from "./delete-user-button";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Nutzerverwaltung" };

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  createdAt: string;
  pending: boolean;
};

async function loadUsers(): Promise<UserRow[]> {
  const admin = createAdminClient();
  const [{ data: authData, error }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id, display_name, role"),
  ]);
  if (error) throw new Error("Nutzerliste konnte nicht geladen werden.");

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return authData.users
    .map((u) => {
      const profile = byId.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "–",
        displayName: profile?.display_name ?? "–",
        role: profile?.role ?? "user",
        createdAt: u.created_at,
        // Eingeladen, aber noch nie angemeldet
        pending: Boolean(u.invited_at) && !u.last_sign_in_at,
      };
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export default async function AdminPage() {
  const currentAdmin = await requireAdmin();
  const users = await loadUsers();

  return (
    <>
      <PageHeader
        title="Nutzerverwaltung"
        description="Nur für Admins sichtbar. Hier lädst du neue Leute ein und verwaltest Accounts."
      />

      <section className="mb-8 rounded-3xl border bg-card p-5">
        <h2 className="mb-1 text-lg font-semibold">Jemanden einladen</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Die Person bekommt eine E-Mail mit einem Link, über den sie Anzeigenamen und Passwort festlegt.
        </p>
        <InviteForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Nutzer <span className="font-sans text-base font-normal text-muted-foreground">({users.length})</span>
        </h2>
        <ul className="grid gap-3">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{u.displayName}</span>
                  {u.role === "admin" ? <Badge>Admin</Badge> : null}
                  {u.pending ? <Badge variant="outline">Einladung offen</Badge> : null}
                  {u.id === currentAdmin.id ? <Badge variant="secondary">Du</Badge> : null}
                </div>
                <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                <p className="text-xs text-muted-foreground">Registriert am {formatDate(u.createdAt)}</p>
              </div>
              {u.id !== currentAdmin.id ? <DeleteUserButton userId={u.id} displayName={u.displayName} /> : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
