import { createMutationService } from "@/lib/query";
import { goalBalance } from "@/finance";
import type { FinanceTransaction } from "@/finance";
import { updateLocalData } from "@/api/local-data";
import type { LocalMutationDeps } from "@/api/local-data";

export const saveTransactionKey = () => ["transactions", "save"] as const;
export const updateTransactionKey = () => ["transactions", "update"] as const;
export const deleteTransactionKey = () => ["transactions", "delete"] as const;

export function createSaveTransaction(deps: LocalMutationDeps) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: saveTransactionKey(),
    mutationFn: async (entry: FinanceTransaction) => {
      const data = await deps.getLocalData();
      if (entry.goalId) {
        if (entry.type !== "expense" || !data.goals.some((goal) => goal.id === entry.goalId && !goal.archivedAt)) {
          throw new Error("Выберите существующую цель для расхода.");
        }
        if (entry.amountKopeks > goalBalance(entry.goalId, data.goalMoves, data.transactions)) {
          throw new Error("На этой цели недостаточно выделенных денег.");
        }
      }
      await deps.localDb.saveFinanceTransaction(entry);
      return { ...entry, version: 1 };
    },
    onSuccess: (saved) => {
      updateLocalData(deps.queryClient, (data) => ({ ...data, transactions: [...data.transactions, saved] }));
      deps.onLocalChange();
    }
  }));
}

export function createUpdateTransaction(deps: LocalMutationDeps) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: updateTransactionKey(),
    mutationFn: async (entry: FinanceTransaction) => {
      const data = await deps.getLocalData();
      if (entry.goalId && (entry.type !== "expense" || !data.goals.some((goal) => goal.id === entry.goalId && !goal.archivedAt))) {
        throw new Error("Выберите существующую цель для расхода.");
      }
      const updatedTransactions = data.transactions.map((item) => item.id === entry.id ? entry : item);
      if (data.goals.some((goal) => goalBalance(goal.id, data.goalMoves, updatedTransactions) < 0)) {
        throw new Error("После исправления на одной из целей не хватит выделенных денег.");
      }
      return deps.localDb.updateFinanceTransaction(entry);
    },
    onSuccess: (saved) => {
      updateLocalData(deps.queryClient, (data) => ({ ...data, transactions: data.transactions.map((item) => item.id === saved.id ? saved : item) }));
      deps.onLocalChange();
    }
  }));
}

export function createDeleteTransaction(deps: LocalMutationDeps) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: deleteTransactionKey(),
    mutationFn: async (id: string) => {
      const existing = (await deps.getLocalData()).transactions.find((item) => item.id === id);
      if (!existing) throw new Error("Запись не найдена.");
      return deps.localDb.deleteFinanceTransaction({ ...existing, deletedAt: new Date().toISOString() }).catch((cause: unknown) => {
        throw new Error("Не удалось удалить запись с устройства.", { cause });
      });
    },
    onSuccess: (saved) => {
      updateLocalData(deps.queryClient, (data) => ({ ...data, transactions: data.transactions.map((item) => item.id === saved.id ? saved : item) }));
      deps.onLocalChange();
    }
  }));
}
