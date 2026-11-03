import { redirect } from "next/navigation";

/** Entdecken startet bei den Challenges (später beim Feed). */
export default function SportDiscoverPage() {
  redirect("/sport/entdecken/challenges");
}
