import { useEffect } from "react";
import { useStore } from "@nanostores/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ConflictCard, SyncError, SyncStatusBar, SyncStatusBarSkeleton } from "@/components/ui/sync-status";
import type { SyncTone } from "@/components/ui/sync-status";
import type { SyncStatusProps } from "./types";

/**
 * State of the local copy against the shared profile: pending changes, errors and conflicts to resolve.
 * While mounted for a signed-in device it also starts sync on sign-in, reconnect and return to the app.
 */
export function SyncStatus({ di, skeleton = false }: SyncStatusProps) {
  const authState = useStore(di.$authState);
  const { syncing, checked, error } = useStore(di.syncEngine.$sync);
  const outboxQuery = useQuery(di.getOutbox.qo());
  const resolveConflict = useMutation(di.resolveConflict.mo());
  const outbox = outboxQuery.data ?? [];
  const conflicts = outbox.filter((item) => item.state === "conflict");

  useEffect(() => {
    if (authState !== "authenticated") return;
    void di.syncEngine.request();
    return di.syncEngine.watch();
  }, [authState, di]);

  if (skeleton) return <SyncStatusBarSkeleton text="Проверяем общие данные…" />;

  const tone: SyncTone = !checked || syncing ? "syncing" : conflicts.length ? "conflict" : outbox.length ? "pending" : "synced";
  const text = !checked ? "Проверяем общие данные…" : syncing ? "Синхронизация…"
    : conflicts.length ? "Есть изменения, требующие вашего решения." : outbox.length > 0 ? `Ожидают отправки: ${outbox.length}` : "Все изменения синхронизированы.";

  return (
    <>
      {authState === "offline" && <SyncStatusBar tone="offline" text={`Нет сети. Изменения сохраняются на устройстве и отправятся при подключении. Ожидают отправки: ${outbox.length}.`} />}
      {authState === "authenticated" && <SyncStatusBar tone={tone} text={text} />}
      {authState === "authenticated" && error && <SyncError message={error} onRetry={() => void di.syncEngine.request()} />}
      {outboxQuery.isError && <SyncError message="Изменение сохранено, но очередь не удалось прочитать. Обновите страницу." onRetry={() => void outboxQuery.refetch()} />}
      {conflicts.map((item) => (
        <ConflictCard key={item.id} mutation={item} onResolve={(choice) => resolveConflict.mutate({ mutation: item, choice })} />
      ))}
    </>
  );
}
