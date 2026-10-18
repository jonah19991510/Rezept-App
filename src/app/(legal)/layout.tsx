import { Brand } from "@/components/layout/brand";

export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Brand href="/" className="mb-8" />
      <article className="space-y-4 rounded-3xl border bg-card p-6">{children}</article>
    </div>
  );
}
