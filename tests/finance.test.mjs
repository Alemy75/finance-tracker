import assert from "node:assert/strict";
import test from "node:test";
import { allocatedTotal, cardBalance, expensesByCategory, freeBalance, goalBalance, parseMoney } from "../src/finance.ts";

test("рубли переводятся в целые копейки без потери дробной части", () => {
  assert.equal(parseMoney("1 234,56"), 123456);
  assert.equal(parseMoney("0,01"), 1);
  assert.equal(parseMoney("12.3"), 1230);
  assert.equal(parseMoney("12,345"), null);
  assert.equal(parseMoney("-1"), null);
});

test("остаток считается от стартового капитала с доходами и расходами", () => {
  const settings = { openingBalanceKopeks: 100000 };
  const transactions = [
    { type: "income", amountKopeks: 25050 },
    { type: "expense", amountKopeks: 10025 }
  ];
  assert.equal(cardBalance(settings, transactions), 115025);
});

test("расход с изменённой датой попадает в выбранный месяц", () => {
  const transactions = [
    { type: "expense", amountKopeks: 15000, categoryId: "expense-groceries", occurredAt: "2026-08-15T12:00:00.000Z", createdAt: "2026-09-28T12:00:00.000Z" },
    { type: "expense", amountKopeks: 5000, categoryId: "expense-groceries", occurredAt: "2026-09-20T12:00:00.000Z", createdAt: "2026-09-20T12:00:00.000Z" },
    { type: "income", amountKopeks: 50000, categoryId: "income-salary", occurredAt: "2026-09-20T12:00:00.000Z", createdAt: "2026-09-20T12:00:00.000Z" }
  ];
  assert.equal(expensesByCategory(transactions, new Date(2026, 7, 15)).get("expense-groceries"), 15000);
  assert.equal(expensesByCategory(transactions, new Date(2026, 8, 15)).get("expense-groceries"), 5000);
});

test("удалённая операция не меняет остаток и отчёт", () => {
  const deleted = {
    type: "expense", amountKopeks: 20000, categoryId: "expense-groceries",
    occurredAt: "2026-09-15T12:00:00.000Z", deletedAt: "2026-09-28T12:00:00.000Z"
  };
  assert.equal(cardBalance({ openingBalanceKopeks: 100000 }, [deleted]), 100000);
  assert.equal(expensesByCategory([deleted], new Date(2026, 8, 15)).size, 0);
});

test("выделение, возврат и расход из цели рассчитываются без двойного списания", () => {
  const settings = { openingBalanceKopeks: 100000 };
  const goals = [{ id: "holiday", targetKopeks: 200000 }];
  const moves = [
    { goalId: "holiday", amountKopeks: 40000 },
    { goalId: "holiday", amountKopeks: -5000 }
  ];
  const transactions = [{ type: "expense", goalId: "holiday", amountKopeks: 10000,
    categoryId: "expense-transport", occurredAt: "2026-09-28T12:00:00.000Z" }];
  assert.equal(goalBalance("holiday", moves, transactions), 25000);
  assert.equal(allocatedTotal(goals, moves, transactions), 25000);
  assert.equal(cardBalance(settings, transactions), 90000);
  assert.equal(freeBalance(settings, goals, moves, transactions), 65000);
  assert.equal(expensesByCategory(transactions, new Date(2026, 8, 28)).get("expense-transport"), 10000);
  assert.equal(freeBalance(settings, goals, moves, []), 65000);
});

test("удалённый расход возвращает ранее выделенную сумму в цель", () => {
  const moves = [{ goalId: "holiday", amountKopeks: 30000 }];
  const transactions = [{ type: "expense", goalId: "holiday", amountKopeks: 12000,
    deletedAt: "2026-09-28T12:00:00.000Z" }];
  assert.equal(goalBalance("holiday", moves, transactions), 30000);
});
