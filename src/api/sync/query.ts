import type { QueryClient } from "@tanstack/react-query";
import { createMutationService } from "@/lib/query";
import { HttpError } from "@/services/http-client";
import type { HttpClient } from "@/services/http-client";
import type { LocalData, LocalDb } from "@/services/local-db";
import type { PendingMutation, SyncResult, SyncSnapshot } from "@/syncTypes";
import type { LocalMutationDeps } from "@/api/local-data";
import { localDataKey } from "@/api/local-data";
import { bootstrapUrl, exportUrl, resolveConflictKey, SESSION_EXPIRED, syncUrl } from "./config";

export interface SyncOutcome {
  data: LocalData;
  outbox: PendingMutation[];
}

function protectedEntities(outbox: PendingMutation[]): Set<string> {
  return new Set(outbox.map((item) => `${item.kind}:${item.entityId}`));
}

/** One full round: pull the shared copy, send the outbox in order, pull again. */
export function createSynchronize(deps: { httpClient: HttpClient; localDb: LocalDb; deviceId: () => string }) {
  async function fetchSnapshot(): Promise<SyncSnapshot> {
    try {
      return (await deps.httpClient.getJson<{ snapshot: SyncSnapshot }>(bootstrapUrl())).snapshot;
    } catch (cause) {
      throw new Error(cause instanceof HttpError && cause.status === 401 ? SESSION_EXPIRED : "Не удалось получить общие данные.", { cause });
    }
  }

  return async function synchronize(): Promise<SyncOutcome> {
    let outbox = await deps.localDb.loadOutbox();
    await deps.localDb.applyRemoteSnapshot(await fetchSnapshot(), protectedEntities(outbox));

    for (const mutation of outbox) {
      if (mutation.state === "conflict") continue;
      for (let attempt = 0; attempt < 4; attempt++) {
        const response = await fetch(syncUrl(), {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-Device-Id": deps.deviceId() },
          body: JSON.stringify(mutation)
        });
        if (response.status === 409) {
          const result = await response.json() as SyncResult;
          if (result.retryable && attempt < 3) continue;
          await deps.localDb.markMutationConflict(mutation, result.reason ?? "Изменение не принято общим профилем.", result.remote ?? null);
        } else if (response.status === 400) {
          const result = await response.json().catch(() => null) as { error?: string } | null;
          await deps.localDb.markMutationConflict(mutation, result?.error ?? "Изменение не прошло проверку.", null);
        } else if (response.ok) {
          await deps.localDb.removeMutation(mutation.sequence!);
        } else {
          throw new Error(response.status === 401 ? SESSION_EXPIRED : "Не удалось отправить изменения.");
        }
        break;
      }
    }

    outbox = await deps.localDb.loadOutbox();
    await deps.localDb.applyRemoteSnapshot(await fetchSnapshot(), protectedEntities(outbox));
    return { data: await deps.localDb.loadLocalData(), outbox };
  };
}

export type Synchronize = ReturnType<typeof createSynchronize>;

/** The backup JSON of the shared profile. */
export function createFetchBackup(deps: { httpClient: HttpClient }) {
  return async function fetchBackup(): Promise<Blob> {
    try {
      return await (await deps.httpClient.request(exportUrl())).blob();
    } catch (cause) {
      throw new Error(cause instanceof HttpError && cause.status === 401 ? SESSION_EXPIRED : "Не удалось получить резервную копию.", { cause });
    }
  };
}

/** Applies the user's choice for a conflicting change: keep the shared version or send the local one again. */
export function createResolveConflict(deps: LocalMutationDeps & { queryClient: QueryClient; onFailed: (message: string) => void }) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: resolveConflictKey(),
    mutationFn: async ({ mutation, choice }: { mutation: PendingMutation; choice: "remote" | "local" }) => {
      if (choice === "remote") await deps.localDb.acceptRemoteVersion(mutation);
      else await deps.localDb.retryLocalVersion(mutation);
      return deps.localDb.loadLocalData();
    },
    onSuccess: (data) => {
      deps.queryClient.setQueryData(localDataKey(), data);
      deps.onLocalChange();
    },
    onError: () => deps.onFailed("Не удалось применить решение. Обновите страницу и попробуйте ещё раз.")
  }));
}
