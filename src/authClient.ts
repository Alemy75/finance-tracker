export interface AccountStatus {
  registered: boolean;
  user: { id: string; email: string } | null;
}

async function postAuth(path: string, body: Record<string, string> | null, setupKey?: string): Promise<void> {
  const response = await fetch(`/api/auth/${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(setupKey ? { "X-Account-Setup-Key": setupKey } : {})
    },
    body: JSON.stringify(body ?? {})
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    throw new Error(result?.error ?? result?.message ?? "Не удалось выполнить вход. Попробуйте ещё раз.");
  }
}

export async function getAccountStatus(): Promise<AccountStatus> {
  const response = await fetch("/api/account/status", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Сервис входа недоступен. Проверьте локальную D1 и секреты авторизации.");
  return response.json() as Promise<AccountStatus>;
}

export function signUp(email: string, password: string, setupKey: string): Promise<void> {
  return postAuth("sign-up/email", { name: "Семья", email, password }, setupKey);
}

export function signIn(email: string, password: string): Promise<void> {
  return postAuth("sign-in/email", { email, password });
}

export function signOut(): Promise<void> {
  return postAuth("sign-out", null);
}
