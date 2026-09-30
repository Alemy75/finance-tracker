import { createMutationService } from "@/lib/query";
import type { Settings } from "@/finance";
import { updateLocalData } from "@/api/local-data";
import type { LocalMutationDeps } from "@/api/local-data";

export const saveOpeningBalanceKey = () => ["settings", "opening-balance"] as const;
export const saveOpeningCashKey = () => ["settings", "opening-cash"] as const;

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

/** Enters or corrects the cash the family had when cash accounting started. */
export function createSaveOpeningCash(deps: LocalMutationDeps) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: saveOpeningCashKey(),
    mutationFn: async (openingCashKopeks: number) => {
      if (!Number.isSafeInteger(openingCashKopeks) || openingCashKopeks < 0) throw new Error("Введите сумму в рублях, не более двух знаков после запятой.");
      const { settings } = await deps.getLocalData();
      if (!settings) throw new Error("Сначала укажите остаток карты.");
      return deps.localDb.updateSettings({ ...settings, openingCashKopeks }).catch((cause: unknown) => {
        throw new Error("Не удалось сохранить сумму на устройстве. Проверьте доступ к хранилищу браузера.", { cause });
      });
    },
    onSuccess: (saved) => {
      updateLocalData(deps.queryClient, (data) => ({ ...data, settings: saved }));
      deps.onLocalChange();
    }
  }));
}
