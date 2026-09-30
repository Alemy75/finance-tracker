export type TransactionType = "expense" | "income";
export type Author = "self" | "wife" | null;
/** Where the money is: the family card or the shared cash wallet. */
export type Account = "card" | "cash";

export const accountLabels: Record<Account, string> = { card: "Карта", cash: "Наличные" };

export interface Settings {
  id: "main";
  openingBalanceKopeks: number;
  /** Cash on hand when cash accounting started; `null` until the user has entered it. */
  openingCashKopeks?: number | null;
  startedAt: string;
  version?: number;
}

export interface Category {
  id: string;
  type: TransactionType;
  name: string;
  sortOrder: number;
  version?: number;
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
  /** Missing on records created before cash accounting; such records belong to the card. */
  account?: Account;
  deletedAt?: string | null;
  version?: number;
}

/** Money moved between the card and cash; neither income nor expense. */
export interface Transfer {
  id: string;
  from: Account;
  amountKopeks: number;
  occurredAt: string;
  createdAt: string;
  author: Author;
  note: string;
  deletedAt?: string | null;
  version?: number;
}

export interface Goal {
  id: string;
  name: string;
  targetKopeks: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  version?: number;
}

export interface GoalMove {
  id: string;
  goalId: string;
  amountKopeks: number;
  occurredAt: string;
  createdAt: string;
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

export function accountOf(entry: Pick<FinanceTransaction, "account">): Account {
  return entry.account ?? "card";
}

export function transferTarget(transfer: Pick<Transfer, "from">): Account {
  return transfer.from === "card" ? "cash" : "card";
}

export function accountBalance(settings: Settings, account: Account, transactions: FinanceTransaction[], transfers: Transfer[] = []): number {
  const opening = account === "card" ? settings.openingBalanceKopeks : settings.openingCashKopeks ?? 0;
  const afterOperations = transactions.reduce((balance, entry) => balance
    + (entry.deletedAt || accountOf(entry) !== account ? 0 : (entry.type === "income" ? 1 : -1) * entry.amountKopeks), opening);
  return transfers.reduce((balance, transfer) => balance
    + (transfer.deletedAt ? 0 : transfer.from === account ? -transfer.amountKopeks : transferTarget(transfer) === account ? transfer.amountKopeks : 0), afterOperations);
}

export function cardBalance(settings: Settings, transactions: FinanceTransaction[], transfers: Transfer[] = []): number {
  return accountBalance(settings, "card", transactions, transfers);
}

export function cashBalance(settings: Settings, transactions: FinanceTransaction[], transfers: Transfer[] = []): number {
  return accountBalance(settings, "cash", transactions, transfers);
}

/** Card and cash together; transfers move money inside this sum and never change it. */
export function totalBalance(settings: Settings, transactions: FinanceTransaction[]): number {
  return cardBalance(settings, transactions) + cashBalance(settings, transactions);
}

export function goalBalance(goalId: string, moves: GoalMove[], transactions: FinanceTransaction[]): number {
  const moved = moves.reduce((sum, move) => sum + (move.goalId === goalId ? move.amountKopeks : 0), 0);
  return transactions.reduce((sum, entry) => sum - (!entry.deletedAt && entry.type === "expense" && entry.goalId === goalId ? entry.amountKopeks : 0), moved);
}

export function allocatedTotal(goals: Goal[], moves: GoalMove[], transactions: FinanceTransaction[]): number {
  return goals.reduce((sum, goal) => sum + goalBalance(goal.id, moves, transactions), 0);
}

export function freeBalance(settings: Settings, goals: Goal[], moves: GoalMove[], transactions: FinanceTransaction[]): number {
  return totalBalance(settings, transactions) - allocatedTotal(goals, moves, transactions);
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
    if (transaction.deletedAt || transaction.type !== "expense" || !isInMonth(transaction.occurredAt, month)) continue;
    totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amountKopeks);
  }
  return totals;
}

/** A record of the history: an income or expense, or a transfer between accounts. */
export type Operation = FinanceTransaction | Transfer;

export function isTransfer(operation: Operation): operation is Transfer {
  return "from" in operation;
}

/** Operations that are not deleted, newest first. */
export function activeOperations(transactions: FinanceTransaction[], transfers: Transfer[]): Operation[] {
  return [...transactions, ...transfers].filter((operation) => !operation.deletedAt)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt));
}
