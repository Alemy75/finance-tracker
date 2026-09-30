import type { QueryObserverResult } from "@tanstack/react-query";
import type { AccountStatus } from "@/api/account";

export type AuthState = "checking" | "setup" | "login" | "authenticated" | "offline" | "error";
export type Connection = "checking" | "online" | "offline";

/**
 * Without network a device that signed in before works with its local copy ("offline"); otherwise the server
 * answer decides between the sign-in forms and the app.
 */
export function deriveAuthState(status: QueryObserverResult<AccountStatus, Error>, online: boolean, marker: string | undefined): AuthState {
  if (!online && marker) return "offline";
  if (status.data) return status.data.user ? "authenticated" : status.data.registered ? "login" : "setup";
  if (status.isError) return "error";
  return "checking";
}

export function deriveConnection(health: QueryObserverResult<boolean, Error>, online: boolean): Connection {
  if (!online) return "offline";
  if (health.isPending) return "checking";
  return health.isSuccess && !health.isRefetchError ? "online" : "offline";
}
