import type { QueryClient } from "@tanstack/react-query";
import { persistentAtom } from "@nanostores/persistent";
import { atom, computed } from "nanostores";
import { createGetAccountStatus, createSignIn, createSignOut, createSignUp } from "@/api/account";
import { createCreateCategory, createRenameCategory } from "@/api/categories";
import { createCreateGoal, createMoveGoalMoney } from "@/api/goals";
import { createGetHealth } from "@/api/health";
import { createGetLocalData, createGetOutbox, outboxKey } from "@/api/local-data";
import { createSaveOpeningBalance } from "@/api/settings";
import { createFetchBackup, createResolveConflict, createSynchronize } from "@/api/sync";
import { createDeleteTransaction, createSaveTransaction, createUpdateTransaction } from "@/api/transactions";
import type { Page } from "@/lib/pages";
import { createContainer, type } from "@/lib/container";
import type { ContainerOf } from "@/lib/container";
import { queryAtom } from "@/lib/query-atom";
import { deriveAuthState, deriveConnection } from "@/services/auth-state";
import { createDeviceId } from "@/services/device-id";
import { createHttpClient } from "@/services/http-client";
import { createLocalDb } from "@/services/local-db";
import { createOnlineAtom } from "@/services/online";
import { createSyncEngine } from "@/services/sync-engine";

const AUTH_MARKER = "family-finance-authenticated";

export type Di = ContainerOf<ReturnType<typeof createDi>>;

/** The one place where the app's external services are created; components receive the built container as `di`. */
export function createDi() {
  return createContainer()
    .require({
      queryClient: type<QueryClient>(),
      captureException: type<(error: Error) => void>()
    })
    .provide({
      httpClient: () => createHttpClient(),
      localDb: () => createLocalDb(),
      deviceId: () => createDeviceId(localStorage),
      $page: () => atom<Page>("home"),
      $online: () => createOnlineAtom(),
      /** Id of the user who last signed in on this device; lets the app open the local copy without network. */
      $authMarker: () => persistentAtom<string | undefined>(AUTH_MARKER, undefined)
    })
    .provide({
      getAccountStatus: createGetAccountStatus,
      getHealth: createGetHealth,
      getLocalData: createGetLocalData,
      getOutbox: createGetOutbox,
      synchronize: createSynchronize,
      fetchBackup: createFetchBackup
    })
    .provide({
      $accountStatus: ({ queryClient, getAccountStatus }) => queryAtom(queryClient, getAccountStatus.qo()),
      $health: ({ queryClient, getHealth }) => queryAtom(queryClient, getHealth.qo())
    })
    .provide({
      $authState: ({ $accountStatus, $online, $authMarker }) => computed([$accountStatus, $online, $authMarker], deriveAuthState),
      $connection: ({ $health, $online }) => computed([$health, $online], deriveConnection)
    })
    .provide({
      syncEngine: createSyncEngine
    })
    .provide({
      onLocalChange: ({ queryClient, syncEngine }) => () => {
        void queryClient.invalidateQueries({ queryKey: outboxKey() });
        void syncEngine.request();
      }
    })
    .provide({
      signIn: createSignIn,
      signUp: createSignUp,
      signOut: ({ httpClient, queryClient, $authMarker, syncEngine, $page }) => createSignOut({
        httpClient, queryClient, $authMarker,
        onSignedOut: () => {
          syncEngine.reset();
          $page.set("home");
        }
      }),
      saveOpeningBalance: createSaveOpeningBalance,
      saveTransaction: createSaveTransaction,
      updateTransaction: createUpdateTransaction,
      deleteTransaction: createDeleteTransaction,
      createCategory: createCreateCategory,
      renameCategory: createRenameCategory,
      createGoal: createCreateGoal,
      moveGoalMoney: createMoveGoalMoney,
      resolveConflict: ({ queryClient, localDb, getLocalData, onLocalChange, syncEngine }) =>
        createResolveConflict({ queryClient, localDb, getLocalData, onLocalChange, onFailed: syncEngine.showError })
    });
}
