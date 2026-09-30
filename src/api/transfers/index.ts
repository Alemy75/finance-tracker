import { createMutationService } from "@/lib/query";
import type { Transfer } from "@/finance";
import { updateLocalData } from "@/api/local-data";
import type { LocalMutationDeps } from "@/api/local-data";

export const saveTransferKey = () => ["transfers", "save"] as const;
export const updateTransferKey = () => ["transfers", "update"] as const;
export const deleteTransferKey = () => ["transfers", "delete"] as const;

function checkedTransfer(transfer: Transfer): Transfer {
  if (!Number.isSafeInteger(transfer.amountKopeks) || transfer.amountKopeks <= 0) throw new Error("Введите сумму перевода больше нуля.");
  if (transfer.from !== "card" && transfer.from !== "cash") throw new Error("Выберите направление перевода.");
  return transfer;
}

function replaceTransfer(deps: LocalMutationDeps, saved: Transfer) {
  updateLocalData(deps.queryClient, (data) => ({ ...data, transfers: data.transfers.map((item) => item.id === saved.id ? saved : item) }));
  deps.onLocalChange();
}

export function createSaveTransfer(deps: LocalMutationDeps) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: saveTransferKey(),
    mutationFn: async (transfer: Transfer) => deps.localDb.saveTransfer(checkedTransfer(transfer)).catch((cause: unknown) => {
      throw new Error("Не удалось сохранить перевод на устройстве.", { cause });
    }),
    onSuccess: (saved) => {
      updateLocalData(deps.queryClient, (data) => ({ ...data, transfers: [...data.transfers, saved] }));
      deps.onLocalChange();
    }
  }));
}

export function createUpdateTransfer(deps: LocalMutationDeps) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: updateTransferKey(),
    mutationFn: async (transfer: Transfer) => deps.localDb.updateTransfer(checkedTransfer(transfer)),
    onSuccess: (saved) => replaceTransfer(deps, saved)
  }));
}

export function createDeleteTransfer(deps: LocalMutationDeps) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: deleteTransferKey(),
    mutationFn: async (id: string) => {
      const existing = (await deps.getLocalData()).transfers.find((item) => item.id === id);
      if (!existing) throw new Error("Перевод не найден.");
      return deps.localDb.updateTransfer({ ...existing, deletedAt: new Date().toISOString() }).catch((cause: unknown) => {
        throw new Error("Не удалось удалить запись с устройства.", { cause });
      });
    },
    onSuccess: (saved) => replaceTransfer(deps, saved)
  }));
}
