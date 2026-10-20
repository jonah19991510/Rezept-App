import type { Metadata } from "next";
import { DiscoverView } from "@/components/recipes/discover-view";

export const metadata: Metadata = { title: "Entdecken" };

export default function DiscoverPage({ searchParams }: PageProps<"/entdecken">) {
  return <DiscoverView type="dish" searchParams={searchParams} />;
}
