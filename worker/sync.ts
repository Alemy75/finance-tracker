import { createAuth } from "./auth";
import type { Env } from "./auth";
import { ensureLedger } from "./account";
import type { Category, FinanceTransaction, Goal, GoalMove, Settings } from "../src/finance";
import type { PendingMutation, SyncEntity, SyncResult, SyncSnapshot } from "../src/syncTypes";

type Row = Record<string, unknown>;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

async function userId(request: Request, env: Env): Promise<string | null> {
  const session = await createAuth(request, env).api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

async function rows(database: D1Database, sql: string, user: string): Promise<Row[]> {
  const result = await database.prepare(sql).bind(user).all<Row>();
  return result.results;
}

function setting(row: Row): Settings {
  return { id: "main", openingBalanceKopeks: Number(row.opening_balance_kopeks), startedAt: String(row.started_at), version: Number(row.version ?? 0) };
}
function category(row: Row): Category {
  return { id: String(row.id), type: row.type as "expense" | "income", name: String(row.name),
    sortOrder: Number(row.sort_order), version: Number(row.version) };
}
function goal(row: Row): Goal {
  return { id: String(row.id), name: String(row.name), targetKopeks: Number(row.target_kopeks),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at), archivedAt: row.archived_at as string | null,
    version: Number(row.version) };
}
function move(row: Row): GoalMove {
  return { id: String(row.id), goalId: String(row.goal_id), amountKopeks: Number(row.amount_kopeks),
    occurredAt: String(row.occurred_at), createdAt: String(row.created_at) };
}
function entry(row: Row): FinanceTransaction {
  return { id: String(row.id), type: row.type as "expense" | "income", amountKopeks: Number(row.amount_kopeks),
    categoryId: String(row.category_id), occurredAt: String(row.occurred_at), createdAt: String(row.created_at),
    author: row.author as "self" | "wife" | null, note: String(row.note), goalId: row.goal_id as string | null,
    deletedAt: row.deleted_at as string | null, version: Number(row.version) };
}

async function currentEntity(database: D1Database, user: string, kind: PendingMutation["kind"], id: string): Promise<SyncEntity | null> {
  if (kind === "settings") {
    const row = await database.prepare(`SELECT settings.*, (SELECT COUNT(*) FROM change_log WHERE user_id = ? AND entity_type = 'settings') AS version FROM settings WHERE user_id = ?`).bind(user, user).first<Row>();
    return row ? setting(row) : null;
  }
  if (kind === "category") {
    const row = await database.prepare("SELECT * FROM categories WHERE user_id = ? AND id = ?").bind(user, id).first<Row>();
    return row ? category(row) : null;
  }
  const table = kind === "goal" ? "goals" : kind === "goalMove" ? "goal_moves" : "transactions";
  const row = await database.prepare(`SELECT * FROM ${table} WHERE user_id = ? AND id = ?`).bind(user, id).first<Row>();
  return row ? kind === "goal" ? goal(row) : kind === "goalMove" ? move(row) : entry(row) : null;
}

async function ledgerSequence(database: D1Database, user: string): Promise<number> {
  const row = await database.prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM change_log WHERE user_id = ?").bind(user).first<{ seq: number }>();
  return Number(row?.seq ?? 0);
}

async function goalBalance(database: D1Database, user: string, goalId: string): Promise<number> {
  const row = await database.prepare(`SELECT
    COALESCE((SELECT SUM(amount_kopeks) FROM goal_moves WHERE user_id = ? AND goal_id = ?), 0) -
    COALESCE((SELECT SUM(amount_kopeks) FROM transactions WHERE user_id = ? AND goal_id = ? AND type = 'expense' AND deleted_at IS NULL), 0) AS amount`)
    .bind(user, goalId, user, goalId).first<{ amount: number }>();
  return Number(row?.amount ?? 0);
}

async function freeBalance(database: D1Database, user: string): Promise<number> {
  const row = await database.prepare(`SELECT
    (SELECT opening_balance_kopeks FROM settings WHERE user_id = ?) +
    COALESCE((SELECT SUM(CASE WHEN type = 'income' THEN amount_kopeks ELSE -amount_kopeks END) FROM transactions WHERE user_id = ? AND deleted_at IS NULL), 0) -
    COALESCE((SELECT SUM(amount_kopeks) FROM goal_moves WHERE user_id = ?), 0) +
    COALESCE((SELECT SUM(amount_kopeks) FROM transactions WHERE user_id = ? AND goal_id IS NOT NULL AND type = 'expense' AND deleted_at IS NULL), 0) AS amount`)
    .bind(user, user, user, user).first<{ amount: number }>();
  return Number(row?.amount ?? 0);
}

function validId(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 120; }
function validMoney(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }
function validDate(value: unknown): value is string { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }

async function conflict(database: D1Database, user: string, mutation: PendingMutation, reason: string, retryable = false): Promise<Response> {
  return json({ status: "conflict", reason, remote: await currentEntity(database, user, mutation.kind, mutation.entityId), retryable } satisfies SyncResult, 409);
}

export async function bootstrap(request: Request, env: Env): Promise<Response> {
  const user = await userId(request, env);
  if (!user) return json({ error: "Требуется вход." }, 401);
  await ensureLedger(env.DB, user);
  const database = env.DB;
  const [settingsRow, categoryRows, goalRows, moveRows, transactionRows, seq] = await Promise.all([
    database.prepare("SELECT settings.*, (SELECT COUNT(*) FROM change_log WHERE user_id = ? AND entity_type = 'settings') AS version FROM settings WHERE user_id = ?").bind(user, user).first<Row>(),
    rows(database, "SELECT id, type, name, sort_order, version FROM categories WHERE user_id = ? AND archived_at IS NULL ORDER BY type, sort_order", user),
    rows(database, "SELECT * FROM goals WHERE user_id = ?", user),
    rows(database, "SELECT * FROM goal_moves WHERE user_id = ? ORDER BY occurred_at, id", user),
    rows(database, "SELECT * FROM transactions WHERE user_id = ?", user),
    ledgerSequence(database, user)
  ]);
  const snapshot: SyncSnapshot = {
    settings: settingsRow && Number(settingsRow.version) > 0 ? setting(settingsRow) : null,
    categories: categoryRows.map(category),
    goals: goalRows.map(goal), goalMoves: moveRows.map(move), transactions: transactionRows.map(entry)
  };
  return json({ snapshot, seq });
}

export async function applyMutation(request: Request, env: Env): Promise<Response> {
  const user = await userId(request, env);
  if (!user) return json({ error: "Требуется вход." }, 401);
  await ensureLedger(env.DB, user);
  const mutation = await request.json().catch(() => null) as PendingMutation | null;
  if (!mutation || !validId(mutation.id) || !validId(mutation.entityId) || !["settings", "category", "goal", "goalMove", "transaction"].includes(mutation.kind)
    || !Number.isSafeInteger(mutation.baseVersion) || mutation.baseVersion < 0 || !mutation.payload || typeof mutation.payload !== "object") {
    return json({ error: "Неверный формат изменения." }, 400);
  }
  const database = env.DB;
  const duplicate = await database.prepare("SELECT result_json FROM mutations WHERE user_id = ? AND id = ?").bind(user, mutation.id).first<{ result_json: string }>();
  if (duplicate) return json(JSON.parse(duplicate.result_json));
  const current = await currentEntity(database, user, mutation.kind, mutation.entityId);
  const now = new Date().toISOString();
  const snapshot = mutation.payload as unknown as Record<string, unknown>;
  const statements: D1PreparedStatement[] = [];
  let version = mutation.baseVersion + 1;
  let entityType: string = mutation.kind;
  let payload: SyncEntity;

  if (mutation.kind === "settings") {
    if (mutation.entityId !== "main" || !Number.isSafeInteger(snapshot.openingBalanceKopeks) || Number(snapshot.openingBalanceKopeks) < 0 || !validDate(snapshot.startedAt)) return json({ error: "Неверные настройки." }, 400);
    if (!current || (current as Settings).version !== mutation.baseVersion) return conflict(database, user, mutation, "Стартовый остаток уже изменён на другом устройстве.");
    payload = { id: "main", openingBalanceKopeks: Number(snapshot.openingBalanceKopeks), startedAt: String(snapshot.startedAt), version };
    statements.push(database.prepare("UPDATE settings SET opening_balance_kopeks = ?, started_at = ?, updated_at = ? WHERE user_id = ? AND changes() = 1")
      .bind(payload.openingBalanceKopeks, payload.startedAt, now, user));
  } else if (mutation.kind === "category") {
    if (!validId(snapshot.id) || snapshot.id !== mutation.entityId || !["expense", "income"].includes(String(snapshot.type))
      || typeof snapshot.name !== "string" || !snapshot.name.trim() || snapshot.name.trim().length > 80
      || !Number.isSafeInteger(snapshot.sortOrder) || Number(snapshot.sortOrder) < 0) return json({ error: "Неверные данные категории." }, 400);
    if (current ? (current as Category).version !== mutation.baseVersion : mutation.baseVersion !== 0) {
      return conflict(database, user, mutation, "Категория уже изменена на другом устройстве.");
    }
    if (current && ((current as Category).type !== snapshot.type || (current as Category).sortOrder !== snapshot.sortOrder)) {
      return json({ error: "Тип и порядок категории менять нельзя." }, 400);
    }
    payload = { id: mutation.entityId, type: snapshot.type as "expense" | "income", name: snapshot.name.trim(),
      sortOrder: Number(snapshot.sortOrder), version };
    if (current) {
      statements.push(database.prepare("UPDATE categories SET name = ?, updated_at = ?, version = ? WHERE user_id = ? AND id = ? AND changes() = 1")
        .bind(payload.name, now, version, user, payload.id));
    } else {
      statements.push(database.prepare("INSERT INTO categories (user_id, id, type, name, sort_order, version, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1")
        .bind(user, payload.id, payload.type, payload.name, payload.sortOrder, version, now, now));
    }
  } else if (mutation.kind === "goal") {
    if (current || mutation.baseVersion !== 0) return conflict(database, user, mutation, "Цель уже есть в общем профиле.");
    if (!validId(snapshot.id) || snapshot.id !== mutation.entityId || typeof snapshot.name !== "string" || !snapshot.name.trim() || snapshot.name.trim().length > 120 || !validMoney(snapshot.targetKopeks) || !validDate(snapshot.createdAt)) return json({ error: "Неверные данные цели." }, 400);
    payload = { id: mutation.entityId, name: snapshot.name.trim(), targetKopeks: snapshot.targetKopeks, createdAt: String(snapshot.createdAt), updatedAt: now, version };
    statements.push(database.prepare("INSERT INTO goals (user_id, id, name, target_kopeks, created_at, updated_at, version) SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1")
      .bind(user, payload.id, payload.name, payload.targetKopeks, payload.createdAt, payload.updatedAt, version));
  } else if (mutation.kind === "goalMove") {
    if (current || mutation.baseVersion !== 0) return conflict(database, user, mutation, "Перемещение уже есть в общем профиле.");
    if (!validId(snapshot.id) || snapshot.id !== mutation.entityId || !validId(snapshot.goalId) || !Number.isSafeInteger(snapshot.amountKopeks) || snapshot.amountKopeks === 0 || !validDate(snapshot.occurredAt) || !validDate(snapshot.createdAt)) return json({ error: "Неверное перемещение денег." }, 400);
    const relatedGoal = await currentEntity(database, user, "goal", String(snapshot.goalId));
    if (!relatedGoal || (relatedGoal as Goal).archivedAt) return conflict(database, user, mutation, "Цель не найдена в общем профиле.");
    const amount = Number(snapshot.amountKopeks);
    if (amount > 0 && amount > await freeBalance(database, user)) return conflict(database, user, mutation, "В общем профиле недостаточно свободных денег.");
    if (amount < 0 && -amount > await goalBalance(database, user, String(snapshot.goalId))) return conflict(database, user, mutation, "В общей цели недостаточно выделенных денег.");
    payload = { id: mutation.entityId, goalId: String(snapshot.goalId), amountKopeks: amount, occurredAt: String(snapshot.occurredAt), createdAt: String(snapshot.createdAt) };
    statements.push(database.prepare("INSERT INTO goal_moves (user_id, id, goal_id, amount_kopeks, occurred_at, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE changes() = 1")
      .bind(user, payload.id, payload.goalId, payload.amountKopeks, payload.occurredAt, payload.createdAt));
    entityType = "goal_move";
    version = 1;
  } else {
    if (current ? (current as FinanceTransaction).version !== mutation.baseVersion : mutation.baseVersion !== 0) return conflict(database, user, mutation, "Операция уже изменена на другом устройстве.");
    if (!validId(snapshot.id) || snapshot.id !== mutation.entityId || !["expense", "income"].includes(String(snapshot.type)) || !validMoney(snapshot.amountKopeks) || !validId(snapshot.categoryId) || !validDate(snapshot.occurredAt) || !validDate(snapshot.createdAt) || (snapshot.author !== null && snapshot.author !== "self" && snapshot.author !== "wife") || typeof snapshot.note !== "string" || snapshot.note.length > 500 || (snapshot.goalId !== null && !validId(snapshot.goalId)) || (snapshot.goalId && snapshot.type !== "expense") || (snapshot.deletedAt != null && !validDate(snapshot.deletedAt))) return json({ error: "Неверные данные операции." }, 400);
    const category = await database.prepare("SELECT type FROM categories WHERE user_id = ? AND id = ? AND archived_at IS NULL").bind(user, snapshot.categoryId).first<{ type: string }>();
    if (!category || category.type !== snapshot.type) return conflict(database, user, mutation, "Категория не найдена в общем профиле.");
    if (snapshot.goalId) {
      const relatedGoal = await currentEntity(database, user, "goal", String(snapshot.goalId));
      if (!relatedGoal || (relatedGoal as Goal).archivedAt) return conflict(database, user, mutation, "Цель не найдена в общем профиле.");
      const available = await goalBalance(database, user, String(snapshot.goalId)) + (current && (current as FinanceTransaction).goalId === snapshot.goalId && !(current as FinanceTransaction).deletedAt ? (current as FinanceTransaction).amountKopeks : 0);
      if (!snapshot.deletedAt && Number(snapshot.amountKopeks) > available) return conflict(database, user, mutation, "В общей цели недостаточно выделенных денег.");
    }
    payload = { id: mutation.entityId, type: snapshot.type as "expense" | "income", amountKopeks: Number(snapshot.amountKopeks), categoryId: String(snapshot.categoryId),
      occurredAt: String(snapshot.occurredAt), createdAt: String(snapshot.createdAt), author: snapshot.author as "self" | "wife" | null,
      note: String(snapshot.note), goalId: snapshot.goalId as string | null, deletedAt: snapshot.deletedAt as string | null, version };
    if (current) {
      statements.push(database.prepare(`UPDATE transactions SET type = ?, amount_kopeks = ?, category_id = ?, occurred_at = ?, updated_at = ?, author = ?, note = ?, goal_id = ?, deleted_at = ?, version = ? WHERE user_id = ? AND id = ? AND changes() = 1`)
        .bind(payload.type, payload.amountKopeks, payload.categoryId, payload.occurredAt, now, payload.author, payload.note, payload.goalId, payload.deletedAt ?? null, version, user, payload.id));
    } else {
      statements.push(database.prepare(`INSERT INTO transactions (user_id, id, type, amount_kopeks, category_id, occurred_at, created_at, updated_at, author, note, goal_id, deleted_at, version) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`)
        .bind(user, payload.id, payload.type, payload.amountKopeks, payload.categoryId, payload.occurredAt, payload.createdAt, now, payload.author, payload.note, payload.goalId, payload.deletedAt ?? null, version));
    }
  }

  const seq = await ledgerSequence(database, user);
  const accepted: SyncResult = { status: "accepted", version };
  const reserve = database.prepare(`INSERT OR IGNORE INTO mutations (user_id, id, device_id, kind, result_json, created_at)
    SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COALESCE(MAX(seq), 0) FROM change_log WHERE user_id = ?) = ?`)
    .bind(user, mutation.id, request.headers.get("X-Device-Id") ?? "unknown", mutation.kind, JSON.stringify(accepted), now, user, seq);
  const log = database.prepare(`INSERT INTO change_log (user_id, entity_type, entity_id, action, entity_json, changed_at)
    SELECT ?, ?, ?, ?, ?, ? WHERE changes() = 1`)
    .bind(user, entityType, mutation.entityId, mutation.kind === "transaction" && (payload as FinanceTransaction).deletedAt ? "delete" : "upsert", JSON.stringify(payload), now);
  const results = await database.batch([reserve, ...statements, log]);
  if (results[0].meta.changes === 1) return json(accepted);
  const racedDuplicate = await database.prepare("SELECT result_json FROM mutations WHERE user_id = ? AND id = ?").bind(user, mutation.id).first<{ result_json: string }>();
  if (racedDuplicate) return json(JSON.parse(racedDuplicate.result_json));
  return conflict(database, user, mutation, "Общие данные изменились. Повторите отправку.", true);
}
