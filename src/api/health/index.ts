import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { createQueryService } from "@/lib/query";
import type { HttpClient } from "@/services/http-client";

export const healthUrl = () => "/api/health" as const;
export const healthKey = () => ["health"] as const satisfies QueryKey;

/** Worker reachability; the header shows it as the network badge. */
export function createGetHealth(deps: { httpClient: HttpClient; queryClient: QueryClient }) {
  return createQueryService(deps.queryClient, () => ({
    queryKey: healthKey(),
    queryFn: async () => {
      await deps.httpClient.request(healthUrl());
      return true;
    }
  }));
}
