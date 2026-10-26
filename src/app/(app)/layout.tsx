import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { LegalFooter } from "@/components/layout/legal-footer";
import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh md:flex">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <AppHeader>
          <UserMenu displayName={user.displayName} isAdmin={user.role === "admin"} />
        </AppHeader>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-2 pb-28 md:px-8 md:pb-10">{children}</main>
        <LegalFooter className="pb-24 md:pb-6" />
      </div>
      <BottomNav />
    </div>
  );
}
