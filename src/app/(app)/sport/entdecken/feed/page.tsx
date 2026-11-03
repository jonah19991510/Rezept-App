import type { Metadata } from "next";
import Link from "next/link";
import { Activity } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { FeedCard } from "@/components/sport/feed/feed-card";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/domain/week";
import { getFeed } from "@/lib/server/posts";

export const metadata: Metadata = { title: "Feed" };

/** Entdecken › Feed: geteilte Trainings aus der Runde, die neuesten zuerst (die letzten 50). */
export default async function FeedPage() {
  const user = await requireUser();
  const posts = await getFeed(user.id);
  const today = todayInBerlin();

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Noch nichts geteilt"
        action={
          <Link href="/sport/verlauf" className={buttonVariants({ variant: "outline" })}>
            Zu deinen Trainings
          </Link>
        }
      >
        Nach jedem Training kannst du es mit „Training teilen“ hier zeigen: Dauer, Übungen, Volumen und neue Bestwerte.
        Die anderen können anfeuern, kommentieren und das Training nachmachen.
      </EmptyState>
    );
  }

  return (
    <div className="mx-auto grid max-w-2xl grid-cols-1 gap-4">
      {posts.map((post) => (
        <FeedCard key={post.id} post={post} today={today} meId={user.id} isAdmin={user.role === "admin"} />
      ))}
      {posts.length >= 50 ? <p className="text-center text-sm text-muted-foreground">Ältere Trainings stehen nicht mehr im Feed.</p> : null}
    </div>
  );
}
