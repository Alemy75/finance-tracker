import type { QueryClient } from "@tanstack/react-query";
import { atom, readonlyType } from "nanostores";
import type { ReadableAtom, WritableAtom } from "nanostores";
import { accountStatusKey } from "@/api/account";
import { localDataKey, outboxKey } from "@/api/local-data";
import { SESSION_EXPIRED } from "@/api/sync";
import type { Synchronize } from "@/api/sync";
import type { AuthState } from "@/services/auth-state";

export interface SyncState {
  syncing: boolean;
  /** At least one sync finished since sign-in, so the local copy matches the shared profile. */
  checked: boolean;
  error: string;
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;

/**
 * Runs sync rounds one at a time: a request that arrives during a round schedules exactly one more round.
 * Export takes the same lock so the backup always reflects a fully sent outbox.
 */
export function createSyncEngine(deps: {
  queryClient: QueryClient;
  synchronize: Synchronize;
  fetchBackup: () => Promise<Blob>;
  $authState: ReadableAtom<AuthState>;
  $authMarker: WritableAtom<string | undefined>;
  captureException: (error: Error) => void;
}) {
  const $sync = atom<SyncState>({ syncing: false, checked: false, error: "" });
  let running = false;
  let again = false;
  const patch = (next: Partial<SyncState>) => $sync.set({ ...$sync.get(), ...next });

  async function round() {
    const result = await deps.synchronize();
    deps.queryClient.setQueryData(localDataKey(), result.data);
    deps.queryClient.setQueryData(outboxKey(), result.outbox);
    patch({ error: "", checked: true });
    return result;
  }

  function handleFailure(cause: unknown) {
    const message = cause instanceof Error ? cause.message : "Не удалось синхронизировать данные.";
    if (message === SESSION_EXPIRED) {
      deps.$authMarker.set(undefined);
      void deps.queryClient.invalidateQueries({ queryKey: accountStatusKey() });
    } else if (!(cause instanceof Error)) {
      deps.captureException(new Error("[syncEngine] request: unexpected failure", { cause }));
    }
    patch({ error: message });
  }

  async function request() {
    if (!navigator.onLine) return;
    if (running) { again = true; return; }
    running = true;
    patch({ syncing: true });
    try {
      do {
        again = false;
        try {
          await round();
        } catch (cause) {
          handleFailure(cause);
          break;
        }
      } while (again && navigator.onLine);
    } finally {
      running = false;
      patch({ syncing: false });
    }
  }

  async function exportBackup() {
    if (deps.$authState.get() !== "authenticated" || !navigator.onLine) throw new Error("Для выгрузки нужно подключение к сети и вход в профиль.");
    if (running) throw new Error("Дождитесь окончания синхронизации и попробуйте снова.");
    running = true;
    patch({ syncing: true });
    try {
      const result = await round();
      if (result.outbox.length) {
        throw new Error("Остались изменения, которые не попали в общий профиль. Разрешите конфликты и повторите выгрузку.");
      }
      const url = URL.createObjectURL(await deps.fetchBackup());
      const link = document.createElement("a");
      link.href = url;
      link.download = `family-finance-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      running = false;
      patch({ syncing: false });
      if (again) void request();
    }
  }

  /** Syncs on reconnect and when the app comes back to the foreground; returns the unsubscribe function. */
  function watch() {
    const onVisible = () => { if (document.visibilityState === "visible") void request(); };
    const onOnline = () => void request();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }

  return {
    $sync: readonlyType($sync),
    request,
    exportBackup,
    watch,
    /** Forgets that the data was checked; called on sign-out. */
    reset: () => patch({ checked: false, error: "" }),
    showError: (message: string) => patch({ error: message })
  };
}
