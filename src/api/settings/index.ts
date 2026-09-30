import { createMutationService } from "@/lib/query";
import type { Settings } from "@/finance";
import { updateLocalData } from "@/api/local-data";
import type { LocalMutationDeps } from "@/api/local-data";

export const saveOpeningBalanceKey = () => ["settings", "opening-balance"] as const;

export function createSaveOpeningBalance(deps: LocalMutationDeps) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: saveOpeningBalanceKey(),
    mutationFn: async (settings: Settings) => {
      await deps.localDb.saveOpeningBalance(settings).catch((cause: unknown) => {
        throw new Error("Не удалось сохранить сумму на устройстве. Проверьте доступ к хранилищу браузера.", { cause });
      });
      return { ...settings, version: 1 };
    },
    onSuccess: (saved) => {
      updateLocalData(deps.queryClient, (data) => ({ ...data, settings: saved }));
      deps.onLocalChange();
    }
  }));
}
