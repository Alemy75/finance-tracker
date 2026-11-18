import { createAuth } from "./auth";
import type { Env } from "./auth";
import { ensureLedger } from "./account";

const tables = ["settings", "categories", "goals", "goal_moves", "transactions", "transfers", "mutations", "change_log"] as const;

export async function exportLedger(request: Request, env: Env): Promise<Response> {
  const session = await createAuth(request, env).api.getSession({ headers: request.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Требуется вход." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  await ensureLedger(env.DB, userId);
  // Batch keeps every exported table at one database revision.
  const results = await env.DB.batch(tables.map((table) =>
    env.DB.prepare(`SELECT * FROM ${table} WHERE user_id = ?`).bind(userId)
  ));
  const data = Object.fromEntries(tables.map((table, index) => [table, results[index].results]));
  const exportedAt = new Date().toISOString();
  const fileName = `family-finance-${exportedAt.slice(0, 10)}.json`;
  return new Response(JSON.stringify({ format: "family-finance-d1", version: 1, exportedAt, currency: "RUB", data }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store"
    }
  });
}
