import { AppHeader } from "@/components/layout/app-header";
import { AreaTheme } from "@/components/layout/area-theme";
import { BottomNav } from "@/components/layout/bottom-nav";
import { LegalFooter } from "@/components/layout/legal-footer";
import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <AreaTheme>
      <div className="min-h-dvh md:flex">
        <Sidebar />
        {/* Unten Platz für die schwebende Navigation (Handy); die Startseite (data-home) hat keine */}
        <div className="group/app flex min-w-0 flex-1 flex-col overflow-x-clip">
          <AppHeader>
            <UserMenu displayName={user.displayName} isAdmin={user.role === "admin"} />
          </AppHeader>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-2 pb-28 max-md:group-has-[[data-home]]/app:pb-8 md:px-8 md:pb-10">
            {children}
          </main>
          <LegalFooter className="pb-24 max-md:group-has-[[data-home]]/app:pb-6 md:pb-6" />
        </div>
        <BottomNav />
      </div>
    </AreaTheme>
  );
}
