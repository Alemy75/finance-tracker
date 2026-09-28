export type TransactionType = "expense" | "income";
export type Author = "self" | "wife" | null;

export interface Settings {
  id: "main";
  openingBalanceKopeks: number;
  startedAt: string;
}

export interface Category {
  id: string;
  type: TransactionType;
  name: string;
  sortOrder: number;
}

export interface FinanceTransaction {
  id: string;
  type: TransactionType;
  amountKopeks: number;
  categoryId: string;
  occurredAt: string;
  createdAt: string;
  author: Author;
  note: string;
  goalId: string | null;
}

export const initialCategories: Category[] = [
  { id: "expense-groceries", type: "expense", name: "Продукты", sortOrder: 0 },
  { id: "expense-transport", type: "expense", name: "Транспорт", sortOrder: 1 },
  { id: "expense-home", type: "expense", name: "Дом", sortOrder: 2 },
  { id: "expense-credit", type: "expense", name: "Кредит", sortOrder: 3 },
  { id: "expense-other", type: "expense", name: "Прочее", sortOrder: 4 },
  { id: "income-salary", type: "income", name: "Зарплата", sortOrder: 0 },
  { id: "income-other", type: "income", name: "Другое", sortOrder: 1 }
];

const rubles = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatMoney(kopeks: number): string {
  return rubles.format(kopeks / 100);
}

export function parseMoney(input: string): number | null {
  const normalized = input.trim().replace(/[\s\u00a0\u202f]/g, "");
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(normalized)) return null;

  const [whole, fraction = ""] = normalized.replace(",", ".").split(".");
  const kopeks = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(kopeks) ? kopeks : null;
}

export function cardBalance(settings: Settings, transactions: FinanceTransaction[]): number {
  return transactions.reduce(
    (balance, transaction) => balance + (transaction.type === "income" ? 1 : -1) * transaction.amountKopeks,
    settings.openingBalanceKopeks
  );
}

export function isInMonth(isoDate: string, month: Date): boolean {
  const date = new Date(isoDate);
  return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
}

export function expensesByCategory(
  transactions: FinanceTransaction[],
  month: Date
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== "expense" || !isInMonth(transaction.occurredAt, month)) continue;
    totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amountKopeks);
  }
  return totals;
}
