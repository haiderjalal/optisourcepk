import { requireUser } from "@/server/shop/dal";
import { exportAllData } from "@/services/shop/backup.service";

/**
 * GET /shop/backup — every back-office table as one JSON file to save.
 *
 * `requireUser()` re-checks the session because a proxy matcher is not a
 * guarantee.
 */
export async function GET(): Promise<Response> {
  await requireUser();

  const backup = await exportAllData();
  const day = backup.exportedAt.slice(0, 10);

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="optisource-backup-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
