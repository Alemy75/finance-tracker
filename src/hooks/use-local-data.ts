import { useQuery } from "@tanstack/react-query";
import type { Di } from "@/lib/di";
import type { LocalData } from "@/services/local-db";

/** Family data from the local cache; `undefined` until IndexedDB has been read. */
export function useLocalData(di: Di): LocalData | undefined {
  return useQuery(di.getLocalData.qo()).data;
}
