import type { QueryClient } from "@tanstack/react-query";
import type { WritableAtom } from "nanostores";
import { createMutationService, createQueryService } from "@/lib/query";
import { HttpError } from "@/services/http-client";
import type { HttpClient } from "@/services/http-client";
import { accountStatusKey, accountStatusUrl, authUrl, signInKey, signOutKey, signUpKey } from "./config";
import type { AccountStatus, Credentials } from "./config";

async function postAuth(httpClient: HttpClient, path: Parameters<typeof authUrl>[0], body: Record<string, string> | null, setupKey?: string) {
  try {
    await httpClient.postJson(authUrl(path), body ?? {}, setupKey ? { "X-Account-Setup-Key": setupKey } : {});
  } catch (cause) {
    if (!(cause instanceof HttpError)) throw cause;
    const result = cause.body as { error?: string; message?: string } | null;
    throw new Error(result?.error ?? result?.message ?? "Не удалось выполнить вход. Попробуйте ещё раз.", { cause });
  }
}

/** Account status; keeps the local "signed in before" marker in step with the server session. */
export function createGetAccountStatus(deps: {
  httpClient: HttpClient;
  queryClient: QueryClient;
  $authMarker: WritableAtom<string | undefined>;
}) {
  return createQueryService(deps.queryClient, () => ({
    queryKey: accountStatusKey(),
    queryFn: async () => {
      const status = await deps.httpClient.getJson<AccountStatus>(accountStatusUrl()).catch((cause: unknown) => {
        throw new Error("Сервис входа недоступен. Проверьте локальную D1 и секреты авторизации.", { cause });
      });
      deps.$authMarker.set(status.user?.id);
      return status;
    }
  }));
}

type AuthDeps = {
  httpClient: HttpClient;
  queryClient: QueryClient;
  getAccountStatus: ReturnType<typeof createGetAccountStatus>;
};

async function confirmSession(deps: AuthDeps) {
  const status = await deps.queryClient.fetchQuery({ ...deps.getAccountStatus.qo(), staleTime: 0 });
  if (!status.user) throw new Error("Вход не подтвердился. Попробуйте ещё раз.");
}

export function createSignIn(deps: AuthDeps) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: signInKey(),
    mutationFn: async ({ email, password }: Credentials) => {
      await postAuth(deps.httpClient, "sign-in/email", { email: email.trim(), password });
      await confirmSession(deps);
    }
  }));
}

export function createSignUp(deps: AuthDeps) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: signUpKey(),
    mutationFn: async ({ email, password, setupKey }: Credentials & { setupKey: string }) => {
      await postAuth(deps.httpClient, "sign-up/email", { name: "Семья", email: email.trim(), password }, setupKey.trim());
      await confirmSession(deps);
    }
  }));
}

export function createSignOut(deps: {
  httpClient: HttpClient;
  queryClient: QueryClient;
  $authMarker: WritableAtom<string | undefined>;
  onSignedOut: () => void;
}) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: signOutKey(),
    mutationFn: async () => {
      await postAuth(deps.httpClient, "sign-out", null);
    },
    onSuccess: () => {
      deps.$authMarker.set(undefined);
      deps.queryClient.setQueryData<AccountStatus>(accountStatusKey(), { registered: true, user: null });
      deps.onSignedOut();
    }
  }));
}
