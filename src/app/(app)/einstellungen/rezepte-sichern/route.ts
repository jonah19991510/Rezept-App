import { requireUser } from "@/lib/auth";
import { backupFileName } from "@/lib/domain/recipe-backup";
import { buildRecipeBackup } from "@/lib/server/data-export";

/** Rezept-Sicherung: alle eigenen Rezepte als JSON, wieder importierbar. */
export async function GET() {
  const user = await requireUser();
  const backup = await buildRecipeBackup(user.id);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${backupFileName("rezeptbuch-rezepte", new Date())}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
