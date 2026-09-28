import { initialCategories } from "./finance";
import type { Category, FinanceTransaction, Goal, GoalMove, Settings } from "./finance";

export interface LocalData {
  settings: Settings | null;
  categories: Category[];
  transactions: FinanceTransaction[];
  goals: Goal[];
  goalMoves: GoalMove[];
}

const DATABASE_NAME = "family-finance-local";
const DATABASE_VERSION = 2;
let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("Изменение данных отменено."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Не удалось сохранить данные."));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("settings")) {
          database.createObjectStore("settings", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("categories")) {
          const store = database.createObjectStore("categories", { keyPath: "id" });
          for (const category of initialCategories) store.add(category);
        }
        if (!database.objectStoreNames.contains("transactions")) {
          database.createObjectStore("transactions", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("goals")) {
          database.createObjectStore("goals", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("goalMoves")) {
          database.createObjectStore("goalMoves", { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Закройте другие вкладки приложения и попробуйте снова."));
    }).catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
    databasePromise = opening;
    return opening;
  }
  return databasePromise;
}

export async function loadLocalData(): Promise<LocalData> {
  const database = await openDatabase();
  const transaction = database.transaction(["settings", "categories", "transactions", "goals", "goalMoves"], "readonly");
  const [settings, categories, transactions, goals, goalMoves] = await Promise.all([
    requestResult<Settings | undefined>(transaction.objectStore("settings").get("main")),
    requestResult<Category[]>(transaction.objectStore("categories").getAll()),
    requestResult<FinanceTransaction[]>(transaction.objectStore("transactions").getAll()),
    requestResult<Goal[]>(transaction.objectStore("goals").getAll()),
    requestResult<GoalMove[]>(transaction.objectStore("goalMoves").getAll())
  ]);
  return { settings: settings ?? null, categories, transactions, goals, goalMoves };
}

export async function saveOpeningBalance(settings: Settings): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction("settings", "readwrite");
  const complete = transactionComplete(transaction);
  await Promise.all([requestResult(transaction.objectStore("settings").add(settings)), complete]);
}

export async function saveFinanceTransaction(entry: FinanceTransaction): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction("transactions", "readwrite");
  const complete = transactionComplete(transaction);
  await Promise.all([requestResult(transaction.objectStore("transactions").add(entry)), complete]);
}

export async function updateFinanceTransaction(entry: FinanceTransaction): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction("transactions", "readwrite");
  const complete = transactionComplete(transaction);
  await Promise.all([requestResult(transaction.objectStore("transactions").put(entry)), complete]);
}

export async function deleteFinanceTransaction(entry: FinanceTransaction): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction("transactions", "readwrite");
  const complete = transactionComplete(transaction);
  await Promise.all([requestResult(transaction.objectStore("transactions").put(entry)), complete]);
}

export async function saveGoal(goal: Goal): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction("goals", "readwrite");
  const complete = transactionComplete(transaction);
  await Promise.all([requestResult(transaction.objectStore("goals").add(goal)), complete]);
}

export async function saveGoalMove(move: GoalMove): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction("goalMoves", "readwrite");
  const complete = transactionComplete(transaction);
  await Promise.all([requestResult(transaction.objectStore("goalMoves").add(move)), complete]);
}
