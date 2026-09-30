import { QueryObserver } from "@tanstack/react-query";
import type { QueryClient, QueryKey, QueryObserverOptions, QueryObserverResult } from "@tanstack/react-query";
import { atom, onMount, readonlyType } from "nanostores";

/** A nanostores atom that follows a TanStack query (ported from @mfa/nanostores `queryAtom`). */
export function queryAtom<TData, TKey extends QueryKey>(
  queryClient: QueryClient,
  options: QueryObserverOptions<TData, Error, TData, TData, TKey>
) {
  const observer = new QueryObserver(queryClient, options);
  const $state = atom<QueryObserverResult<TData, Error>>(observer.getCurrentResult());

  onMount($state, () => {
    $state.set(observer.getCurrentResult());
    return observer.subscribe((state) => $state.set(state));
  });

  return readonlyType($state);
}
