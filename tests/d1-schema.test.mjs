import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migration = readFileSync(new URL("../migrations/0001_initial.sql", import.meta.url), "utf8");
const now = "2026-09-28T12:00:00.000Z";

function createDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(migration);
  return database;
}

test("миграция создаёт все таблицы данных и синхронизации", () => {
  const database = createDatabase();
  try {
    const names = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name);
    assert.deepEqual(names, ["categories", "change_log", "goal_moves", "goals", "mutations", "settings", "transactions"]);
  } finally {
    database.close();
  }
});

test("схема защищает связи между пользователями и запрещает неверные суммы", () => {
  const database = createDatabase();
  try {
    const settings = database.prepare("INSERT INTO settings (user_id, opening_balance_kopeks, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)");
    settings.run("family-a", 100000, now, now, now);
    settings.run("family-b", 50000, now, now, now);
    database.prepare("INSERT INTO categories (user_id, id, type, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("family-a", "groceries", "expense", "Продукты", now, now);
    const transaction = database.prepare("INSERT INTO transactions (user_id, id, type, amount_kopeks, category_id, occurred_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    transaction.run("family-a", "tx-1", "expense", 1250, "groceries", now, now, now);
    assert.throws(() => transaction.run("family-b", "tx-2", "expense", 1250, "groceries", now, now, now), /FOREIGN KEY/);
    assert.throws(() => transaction.run("family-a", "tx-3", "expense", 0, "groceries", now, now, now), /CHECK/);
  } finally {
    database.close();
  }
});

test("повтор мутации отклоняется, журнал изменений имеет монотонный номер", () => {
  const database = createDatabase();
  try {
    database.prepare("INSERT INTO settings (user_id, opening_balance_kopeks, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run("family-a", 0, now, now, now);
    const mutation = database.prepare("INSERT INTO mutations (user_id, id, device_id, kind, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?)");
    mutation.run("family-a", "mutation-1", "phone-1", "create_transaction", "{}", now);
    assert.throws(() => mutation.run("family-a", "mutation-1", "phone-1", "create_transaction", "{}", now), /UNIQUE/);
    const change = database.prepare("INSERT INTO change_log (user_id, entity_type, entity_id, action, entity_json, changed_at) VALUES (?, ?, ?, ?, ?, ?)");
    change.run("family-a", "settings", "family-a", "upsert", "{}", now);
    change.run("family-a", "category", "groceries", "upsert", "{}", now);
    assert.deepEqual(database.prepare("SELECT seq FROM change_log ORDER BY seq").all().map((row) => row.seq), [1, 2]);
  } finally {
    database.close();
  }
});
