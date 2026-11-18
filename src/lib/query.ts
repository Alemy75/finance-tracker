import type { MutationObserverOptions, QueryClient, QueryKey, QueryObserverOptions } from "@tanstack/react-query";

/**
 * Service shapes shared by `src/api/*`, following @mfa/bff-api: a callable query or mutation that also exposes its
 * TanStack options, so components use `useQuery(di.x.qo())` / `useMutation(di.x.mo())` and services call it directly.
 */
export type QueryService<TData, TKey extends QueryKey, TArgs extends unknown[] = []> = ((...args: TArgs) => Promise<TData>) & {
  qo: (...args: TArgs) => QueryObserverOptions<TData, Error, TData, TData, TKey>;
};

export type MutationService<TData, TVariables> = ((variables: TVariables) => Promise<TData>) & {
  mo: () => MutationObserverOptions<TData, Error, TVariables>;
};

export function createQueryService<TData, TKey extends QueryKey, TArgs extends unknown[] = []>(
  queryClient: QueryClient,
  getQo: (...args: TArgs) => QueryObserverOptions<TData, Error, TData, TData, TKey>
): QueryService<TData, TKey, TArgs> {
  const query = (...args: TArgs) => queryClient.ensureQueryData(getQo(...args) as Parameters<QueryClient["ensureQueryData"]>[0]) as Promise<TData>;
  return Object.assign(query, { qo: getQo });
}

export function createMutationService<TData, TVariables>(
  queryClient: QueryClient,
  getMo: () => MutationObserverOptions<TData, Error, TVariables>
): MutationService<TData, TVariables> {
  const mutate = (variables: TVariables) => queryClient.getMutationCache()
    .build<TData, Error, TVariables, unknown>(queryClient, getMo())
    .execute(variables);
  return Object.assign(mutate, { mo: getMo });
}
