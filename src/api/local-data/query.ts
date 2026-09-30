import type { QueryClient } from "@tanstack/react-query";
import { createQueryService } from "@/lib/query";
import type { LocalData, LocalDb } from "@/services/local-db";
import { localDataKey, outboxKey } from "./config";

/** Family data from IndexedDB. The cache is kept current by local mutations and sync, so it never goes stale. */
export function createGetLocalData(deps: { localDb: LocalDb; queryClient: QueryClient }) {
  return createQueryService(deps.queryClient, () => ({
    queryKey: localDataKey(),
    queryFn: () => deps.localDb.loadLocalData().catch((cause: unknown) => {
      throw new Error("Не удалось открыть локальное хранилище. Проверьте настройки браузера и обновите страницу.", { cause });
    }),
    staleTime: Infinity
  }));
}

/** Changes waiting to be sent, including conflicts that need a decision. */
export function createGetOutbox(deps: { localDb: LocalDb; queryClient: QueryClient }) {
  return createQueryService(deps.queryClient, () => ({
    queryKey: outboxKey(),
    queryFn: () => deps.localDb.loadOutbox(),
    staleTime: Infinity
  }));
}

export type GetLocalData = ReturnType<typeof createGetLocalData>;

/** Dependencies of every mutation that writes to IndexedDB. */
export interface LocalMutationDeps {
  queryClient: QueryClient;
  localDb: LocalDb;
  getLocalData: GetLocalData;
  /** Refreshes the outbox and asks the sync engine to send it. */
  onLocalChange: () => void;
}

export function updateLocalData(queryClient: QueryClient, update: (data: LocalData) => LocalData) {
  queryClient.setQueryData<LocalData>(localDataKey(), (current) => current && update(current));
}
