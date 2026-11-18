import assert from "node:assert/strict";
import test from "node:test";
import { mergeBankInbox, parseTbankCsv } from "../src/tbankImport.ts";

const header = '"Дата операции";"Дата платежа";"Номер карты";"Статус";"Сумма операции";"Валюта операции";"Сумма платежа";"Валюта платежа";"Описание"';
const row = (time, amount, name, status = "OK", card = "*1234", currency = "RUB") =>
  `"18.11.2026 ${time}";"19.11.2026";"${card}";"${status}";"-2,00";"EUR";"${amount}";"${currency}";"${name}"`;
const csv = (...rows) => [header, ...rows].join("\r\n");

test("Т-Банк: рублёвая сумма платежа, знак, исходное описание и время операции", async () => {
  const { operations, skipped } = await parseTbankCsv(`\uFEFF${csv(
    row("14:01:30", "-1 234,56", 'Магазин; ""Новый""'),
    row("13:01:00", "+350,00", "Возврат\r\nпокупки"),
    row("12:02:00", "-990,00", "Отклонено", "FAILED"),
    row("12:01:00", "-50,00", "Нерублёвый счёт", "OK", "*2345", "USD"),
    row("12:00:00", "0,00", "Нулевая операция")
  )}`);
  assert.equal(skipped, 3);
  assert.deepEqual(operations.map(({ id, ...fields }) => fields), [
    { occurredAt: "2026-11-18T11:01:30.000Z", amountKopeks: 123456, type: "expense", name: 'Магазин; "Новый"' },
    { occurredAt: "2026-11-18T10:01:00.000Z", amountKopeks: 35000, type: "income", name: "Возврат покупки" }
  ]);
});

test("первый и повторный импорт учитывают границу, сохранённые записи и пересечение периодов", async () => {
  const boundaryRow = row("12:00:00", "-4085,00", "Виктория");
  const purchase = row("12:00:01", "-10,00", "Магазин");
  const otherCard = row("12:00:01", "-10,00", "Магазин", "OK", "*9876");
  const { operations: [first, second, other, boundary, older] } = await parseTbankCsv(csv(
    purchase, purchase, otherCard, boundaryRow, row("11:59:59", "-1,00", "Ранее")
  ));
  assert.equal(new Set([first.id, second.id, other.id]).size, 3);
  const saved = new Set([first.id]);
  const inbox = mergeBankInbox(undefined, boundary, [first, second, other, boundary, older], saved);
  assert.deepEqual(inbox.operations.map(({ id }) => id), [second.id, other.id]);
  const { operations: repeated } = await parseTbankCsv(csv(otherCard, purchase, purchase));
  assert.deepEqual(mergeBankInbox(inbox, older, repeated, saved), inbox);
});

test("повреждённая выгрузка отклоняется целиком", async () => {
  await assert.rejects(parseTbankCsv("another,format"), /разделе «Операции»/);
  await assert.rejects(parseTbankCsv(csv(row("12:00:00", "-20.999", "Списание"))), /дату и сумму/);
  await assert.rejects(parseTbankCsv(csv(row("12:00:00", "-20,00", "Списание").replace("18.11.2026", "31.11.2026"))), /дату и сумму/);
  await assert.rejects(parseTbankCsv(`${header}\n"unfinished`), /не закрыты кавычки/);
});
