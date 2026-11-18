import { parseMoney } from "./finance.ts";
import type { TransactionType } from "./finance.ts";

export interface BankOperation {
  id: string;
  occurredAt: string;
  amountKopeks: number;
  type: TransactionType;
  name: string;
}

export interface BankInbox {
  boundary: BankOperation;
  operations: BankOperation[];
}

function csvRows(source: string): string[][] {
  const rows: string[][] = [];
  const csv = source.replace(/^\uFEFF/, "");
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;

  function finishField() {
    row.push(field);
    field = "";
    closedQuote = false;
  }

  for (let i = 0; i < csv.length; i++) {
    const character = csv[i];
    if (quoted) {
      if (character === '"' && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else if (character === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        field += character;
      }
    } else if (character === ";") {
      finishField();
    } else if (character === "\r" || character === "\n") {
      finishField();
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      if (character === "\r" && csv[i + 1] === "\n") i++;
    } else if (character === '"' && !field && !closedQuote) {
      quoted = true;
    } else if (character === '"' || closedQuote) {
      throw new Error("В CSV нарушен формат кавычек.");
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("В CSV не закрыты кавычки.");
  finishField();
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function bankDate(value: string): string | null {
  const parts = /^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!parts) return null;
  const [, day, month, year, hour, minute, second = "00"] = parts;
  const timestamp = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const calendar = new Date(`${timestamp}Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 19) !== timestamp) return null;
  return new Date(`${timestamp}+03:00`).toISOString();
}

export async function parseTbankCsv(source: string): Promise<{ operations: BankOperation[]; skipped: number }> {
  const [header = [], ...rows] = csvRows(source);
  const columns = header.map((value) => value.trim().toLowerCase());
  const required = ["дата операции", "номер карты", "статус", "сумма платежа", "валюта платежа", "описание"];
  const [dateColumn, cardColumn, statusColumn, amountColumn, currencyColumn, nameColumn] = required.map((name) => columns.indexOf(name));
  if (required.some((name) => !columns.includes(name))) {
    throw new Error("Выберите CSV, скачанный в разделе «Операции» личного кабинета Т‑Банка.");
  }

  const counts = new Map<string, number>();
  let skipped = 0;
  const entries: { key: string; occurrence: number; operation: Omit<BankOperation, "id"> }[] = [];
  rows.forEach((row, index) => {
    if (row.length !== header.length) throw new Error(`Проверьте столбцы в записи CSV № ${index + 2}.`);
    if (row[statusColumn].trim().toUpperCase() !== "OK" || row[currencyColumn].trim().toUpperCase() !== "RUB") {
      skipped++;
      return;
    }
    const occurredAt = bankDate(row[dateColumn]);
    const amount = row[amountColumn].trim().replace(/^−/, "-");
    const amountKopeks = parseMoney(amount.replace(/^[+-]/, ""));
    if (!occurredAt || amountKopeks === null) throw new Error(`Проверьте дату и сумму в записи CSV № ${index + 2}.`);
    if (amountKopeks === 0) {
      skipped++;
      return;
    }
    const type = amount.startsWith("-") ? "expense" : "income";
    const description = row[nameColumn].trim().replace(/\s+/g, " ");
    const name = description || "Операция Т‑Банка";
    const key = JSON.stringify([row[cardColumn].trim(), occurredAt, type, amountKopeks, description]);
    const occurrence = (counts.get(key) ?? 0) + 1;
    counts.set(key, occurrence);
    entries.push({ key, occurrence, operation: { occurredAt, amountKopeks, type, name } });
  });

  const encoder = new TextEncoder();
  const operations = await Promise.all(entries.map(async ({ key, occurrence, operation }) => {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(key));
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    return { ...operation, id: `tbank-${hash}-${occurrence}` };
  }));
  return { operations, skipped };
}

export function mergeBankInbox(inbox: BankInbox | undefined, boundary: BankOperation, imported: BankOperation[], savedIds: ReadonlySet<string>): BankInbox {
  const start = inbox?.boundary ?? boundary;
  const pending = new Map<string, BankOperation>();
  for (const operation of [...(inbox?.operations ?? []), ...imported]) {
    if (operation.occurredAt > start.occurredAt && !savedIds.has(operation.id)) pending.set(operation.id, operation);
  }
  return { boundary: start, operations: [...pending.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)) };
}
