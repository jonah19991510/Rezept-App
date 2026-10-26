import { requireUser } from "@/lib/auth";
import { backupFileName } from "@/lib/domain/recipe-backup";
import { buildSportBackup } from "@/lib/server/data-export";

/** Sport-Sicherung: eigene Trainingspläne und Übungen als JSON, wieder importierbar. */
export async function GET() {
  const user = await requireUser();
  const backup = await buildSportBackup(user.id);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${backupFileName("rezeptbuch-sport", new Date())}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
