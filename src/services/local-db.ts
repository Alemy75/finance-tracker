import { initialCategories } from "@/finance";
import type { Category, FinanceTransaction, Goal, GoalMove, Settings } from "@/finance";
import type { PendingMutation, SyncEntity, SyncKind, SyncSnapshot } from "@/syncTypes";

export interface LocalData {
  settings: Settings | null;
  categories: Category[];
  transactions: FinanceTransaction[];
  goals: Goal[];
  goalMoves: GoalMove[];
}

const DATABASE_NAME = "family-finance-local";
const DATABASE_VERSION = 3;

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

export type LocalDb = ReturnType<typeof createLocalDb>;

/** IndexedDB storage of the family data and the outbox of changes waiting for sync. */
export function createLocalDb() {
  let databasePromise: Promise<IDBDatabase> | null = null;

  function openDatabase(): Promise<IDBDatabase> {
    if (!databasePromise) {
      const opening = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = (event) => {
          const database = request.result;
          const upgrade = request.transaction!;
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
          if (!database.objectStoreNames.contains("outbox")) {
            database.createObjectStore("outbox", { keyPath: "sequence", autoIncrement: true });
          }
          if (event.oldVersion > 0 && event.oldVersion < 3) {
            const outbox = upgrade.objectStore("outbox");
            const queueLegacy = (kind: SyncKind, entity: SyncEntity, entityId: string) => {
              outbox.add({ id: crypto.randomUUID(), kind, entityId, baseVersion: 0, payload: entity, state: "pending" } satisfies PendingMutation);
            };
            const settingRequest = upgrade.objectStore("settings").get("main");
            settingRequest.onsuccess = () => {
              if (settingRequest.result) queueLegacy("settings", settingRequest.result as Settings, "main");
              const goalsRequest = upgrade.objectStore("goals").getAll();
              goalsRequest.onsuccess = () => {
                for (const goal of goalsRequest.result as Goal[]) queueLegacy("goal", goal, goal.id);
                const movesRequest = upgrade.objectStore("goalMoves").getAll();
                movesRequest.onsuccess = () => {
                  for (const move of movesRequest.result as GoalMove[]) queueLegacy("goalMove", move, move.id);
                  const entriesRequest = upgrade.objectStore("transactions").getAll();
                  entriesRequest.onsuccess = () => {
                    for (const entry of entriesRequest.result as FinanceTransaction[]) queueLegacy("transaction", entry, entry.id);
                  };
                };
              };
            };
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

  async function loadLocalData(): Promise<LocalData> {
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

  async function saveOpeningBalance(settings: Settings): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(["settings", "outbox"], "readwrite");
    const complete = transactionComplete(transaction);
    const saved = { ...settings, version: 1 };
    transaction.objectStore("settings").add(saved);
    enqueue(transaction, "settings", "main", 0, saved);
    await complete;
  }

  async function saveCategory(category: Category): Promise<Category> {
    const database = await openDatabase();
    const transaction = database.transaction(["categories", "outbox"], "readwrite");
    const complete = transactionComplete(transaction);
    const saved = { ...category, version: 1 };
    transaction.objectStore("categories").add(saved);
    enqueue(transaction, "category", category.id, 0, saved);
    await complete;
    return saved;
  }

  async function renameCategory(category: Category): Promise<Category> {
    const database = await openDatabase();
    const transaction = database.transaction(["categories", "outbox"], "readwrite");
    const complete = transactionComplete(transaction);
    const baseVersion = category.version ?? 1;
    const saved = { ...category, version: baseVersion + 1 };
    transaction.objectStore("categories").put(saved);
    enqueue(transaction, "category", category.id, baseVersion, saved);
    await complete;
    return saved;
  }

  async function saveFinanceTransaction(entry: FinanceTransaction): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(["transactions", "outbox"], "readwrite");
    const complete = transactionComplete(transaction);
    const saved = { ...entry, version: 1 };
    transaction.objectStore("transactions").add(saved);
    enqueue(transaction, "transaction", entry.id, 0, saved);
    await complete;
  }

  async function updateFinanceTransaction(entry: FinanceTransaction): Promise<FinanceTransaction> {
    const database = await openDatabase();
    const transaction = database.transaction(["transactions", "outbox"], "readwrite");
    const complete = transactionComplete(transaction);
    const baseVersion = entry.version ?? 1;
    const saved = { ...entry, version: baseVersion + 1 };
    transaction.objectStore("transactions").put(saved);
    enqueue(transaction, "transaction", entry.id, baseVersion, saved);
    await complete;
    return saved;
  }

  async function deleteFinanceTransaction(entry: FinanceTransaction): Promise<FinanceTransaction> {
    return updateFinanceTransaction(entry);
  }

  async function saveGoal(goal: Goal): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(["goals", "outbox"], "readwrite");
    const complete = transactionComplete(transaction);
    const saved = { ...goal, version: 1 };
    transaction.objectStore("goals").add(saved);
    enqueue(transaction, "goal", goal.id, 0, saved);
    await complete;
  }

  async function saveGoalMove(move: GoalMove): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(["goalMoves", "outbox"], "readwrite");
    const complete = transactionComplete(transaction);
    transaction.objectStore("goalMoves").add(move);
    enqueue(transaction, "goalMove", move.id, 0, move);
    await complete;
  }

  function enqueue(transaction: IDBTransaction, kind: SyncKind, entityId: string, baseVersion: number, payload: SyncEntity): void {
    transaction.objectStore("outbox").add({ id: crypto.randomUUID(), kind, entityId, baseVersion, payload, state: "pending" } satisfies PendingMutation);
  }

  async function loadOutbox(): Promise<PendingMutation[]> {
    const database = await openDatabase();
    return requestResult<PendingMutation[]>(database.transaction("outbox", "readonly").objectStore("outbox").getAll());
  }

  async function removeMutation(sequence: number): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction("outbox", "readwrite");
    const complete = transactionComplete(transaction);
    transaction.objectStore("outbox").delete(sequence);
    await complete;
  }

  async function markMutationConflict(mutation: PendingMutation, reason: string, remote: SyncEntity | null): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction("outbox", "readwrite");
    const complete = transactionComplete(transaction);
    transaction.objectStore("outbox").put({ ...mutation, state: "conflict", reason, remote });
    await complete;
  }

  async function applyRemoteSnapshot(snapshot: SyncSnapshot, protectedEntities: Set<string>): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(["settings", "categories", "transactions", "goals", "goalMoves"], "readwrite");
    const complete = transactionComplete(transaction);
    if (snapshot.settings && !protectedEntities.has("settings:main")) transaction.objectStore("settings").put(snapshot.settings);
    for (const category of snapshot.categories) if (!protectedEntities.has(`category:${category.id}`)) transaction.objectStore("categories").put(category);
    for (const goal of snapshot.goals) if (!protectedEntities.has(`goal:${goal.id}`)) transaction.objectStore("goals").put(goal);
    for (const move of snapshot.goalMoves) if (!protectedEntities.has(`goalMove:${move.id}`)) transaction.objectStore("goalMoves").put(move);
    for (const entry of snapshot.transactions) if (!protectedEntities.has(`transaction:${entry.id}`)) transaction.objectStore("transactions").put(entry);
    await complete;
  }

  function storeName(kind: SyncKind): string {
    return kind === "settings" ? "settings" : kind === "category" ? "categories" : kind === "goal" ? "goals" : kind === "goalMove" ? "goalMoves" : "transactions";
  }

  async function acceptRemoteVersion(mutation: PendingMutation): Promise<void> {
    const related = (await loadOutbox()).filter((item) => item.kind === mutation.kind && item.entityId === mutation.entityId);
    const database = await openDatabase();
    const transaction = database.transaction(["outbox", storeName(mutation.kind)], "readwrite");
    const complete = transactionComplete(transaction);
    for (const item of related) transaction.objectStore("outbox").delete(item.sequence!);
    const store = transaction.objectStore(storeName(mutation.kind));
    if (mutation.remote) store.put(mutation.remote);
    else store.delete(mutation.entityId);
    await complete;
  }

  async function retryLocalVersion(mutation: PendingMutation): Promise<void> {
    const related = (await loadOutbox()).filter((item) => item.kind === mutation.kind && item.entityId === mutation.entityId);
    const database = await openDatabase();
    const store = database.transaction(storeName(mutation.kind), "readonly").objectStore(storeName(mutation.kind));
    const local = await requestResult<SyncEntity | undefined>(store.get(mutation.entityId));
    if (!local) throw new Error("Локальная запись не найдена.");
    const baseVersion = mutation.kind === "transaction" || mutation.kind === "settings" || mutation.kind === "category"
      ? Number((mutation.remote as { version?: number } | null)?.version ?? 0) : 0;
    const payload = mutation.kind === "transaction" || mutation.kind === "settings" || mutation.kind === "category"
      ? { ...local, version: baseVersion + 1 } as SyncEntity : local;
    const transaction = database.transaction(["outbox", storeName(mutation.kind)], "readwrite");
    const complete = transactionComplete(transaction);
    for (const item of related) transaction.objectStore("outbox").delete(item.sequence!);
    transaction.objectStore(storeName(mutation.kind)).put(payload);
    enqueue(transaction, mutation.kind, mutation.entityId, baseVersion, payload);
    await complete;
  }

  return {
    loadLocalData, saveOpeningBalance, saveCategory, renameCategory, saveFinanceTransaction, updateFinanceTransaction,
    deleteFinanceTransaction, saveGoal, saveGoalMove, loadOutbox, removeMutation, markMutationConflict, applyRemoteSnapshot,
    acceptRemoteVersion, retryLocalVersion
  };
}
