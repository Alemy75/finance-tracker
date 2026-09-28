import { initialCategories } from "../src/finance";
import { createAuth } from "./auth";
import type { Env } from "./auth";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function hasAccount(database: D1Database): Promise<boolean> {
  const row = await database.prepare('SELECT id FROM "user" LIMIT 1').first();
  return row !== null;
}

export async function ensureLedger(database: D1Database, userId: string): Promise<void> {
  const existing = await database.prepare("SELECT user_id FROM settings WHERE user_id = ?").bind(userId).first();
  if (existing) return;

  const now = new Date().toISOString();
  await database.batch([
    database.prepare("INSERT OR IGNORE INTO settings (user_id, opening_balance_kopeks, started_at, created_at, updated_at) VALUES (?, 0, ?, ?, ?)")
      .bind(userId, now, now, now),
    ...initialCategories.map((category) => database.prepare(
      "INSERT OR IGNORE INTO categories (user_id, id, type, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(userId, category.id, category.type, category.name, category.sortOrder, now, now))
  ]);
}

export async function accountStatus(request: Request, env: Env): Promise<Response> {
  const registered = await hasAccount(env.DB);
  if (!registered) return json({ registered: false, user: null });

  const auth = createAuth(request, env);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return json({ registered: true, user: null });

  await ensureLedger(env.DB, session.user.id);
  return json({ registered: true, user: { id: session.user.id, email: session.user.email } });
}

export async function authRequest(request: Request, env: Env): Promise<Response> {
  if (!env.BETTER_AUTH_SECRET || !env.ACCOUNT_SETUP_KEY) {
    return json({ error: "Секреты авторизации не настроены." }, 503);
  }

  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/auth/sign-up/email" && request.method === "POST") {
    if (await hasAccount(env.DB)) return json({ error: "Общий профиль уже создан." }, 409);
    if (request.headers.get("X-Account-Setup-Key") !== env.ACCOUNT_SETUP_KEY) {
      return json({ error: "Неверный ключ первого запуска." }, 403);
    }
  }

  return createAuth(request, env).handler(request);
}
