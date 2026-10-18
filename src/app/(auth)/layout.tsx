import { Brand } from "@/components/layout/brand";
import { LegalFooter } from "@/components/layout/legal-footer";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col px-4">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 py-10">
        <Brand href="/login" className="self-center" />
        {children}
      </main>
      <LegalFooter />
    </div>
  );
}
