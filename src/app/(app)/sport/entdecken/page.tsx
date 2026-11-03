import { redirect } from "next/navigation";

/** Entdecken startet beim Feed. */
export default function SportDiscoverPage() {
  redirect("/sport/entdecken/feed");
}
