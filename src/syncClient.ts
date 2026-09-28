import { applyRemoteSnapshot, loadLocalData, loadOutbox, markMutationConflict, removeMutation } from "./localData";
import type { LocalData } from "./localData";
import type { PendingMutation, SyncResult, SyncSnapshot } from "./syncTypes";

const DEVICE_KEY = "family-finance-device-id";

function deviceId(): string {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

async function fetchSnapshot(): Promise<SyncSnapshot> {
  const response = await fetch("/api/bootstrap", { credentials: "same-origin", cache: "no-store" });
  if (response.status === 401) throw new Error("Сессия завершилась. Войдите снова.");
  if (!response.ok) throw new Error("Не удалось получить общие данные.");
  const data = await response.json() as { snapshot: SyncSnapshot };
  return data.snapshot;
}

function protectedEntities(outbox: PendingMutation[]): Set<string> {
  return new Set(outbox.map((item) => `${item.kind}:${item.entityId}`));
}

export async function synchronize(): Promise<{ data: LocalData; outbox: PendingMutation[] }> {
  let outbox = await loadOutbox();
  await applyRemoteSnapshot(await fetchSnapshot(), protectedEntities(outbox));

  for (const mutation of outbox) {
    if (mutation.state === "conflict") continue;
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch("/api/sync", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Device-Id": deviceId() },
        body: JSON.stringify(mutation)
      });
      if (response.status === 409) {
        const result = await response.json() as SyncResult;
        if (result.retryable && attempt < 3) continue;
        await markMutationConflict(mutation, result.reason ?? "Изменение не принято общим профилем.", result.remote ?? null);
      } else if (response.status === 400) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        await markMutationConflict(mutation, result?.error ?? "Изменение не прошло проверку.", null);
      } else if (response.ok) {
        await removeMutation(mutation.sequence!);
      } else {
        throw new Error(response.status === 401 ? "Сессия завершилась. Войдите снова." : "Не удалось отправить изменения.");
      }
      break;
    }
  }

  outbox = await loadOutbox();
  await applyRemoteSnapshot(await fetchSnapshot(), protectedEntities(outbox));
  return { data: await loadLocalData(), outbox };
}
