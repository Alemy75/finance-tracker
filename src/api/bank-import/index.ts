import type { QueryClient } from "@tanstack/react-query";
import { createMutationService, createQueryService } from "@/lib/query";
import type { LocalDb } from "@/services/local-db";
import type { BankOperation } from "@/tbankImport";

export const bankInboxKey = () => ["local", "bank-inbox"] as const;

export function createGetBankInbox({ queryClient, localDb }: { queryClient: QueryClient; localDb: LocalDb }) {
  return createQueryService(queryClient, () => ({
    queryKey: bankInboxKey(),
    queryFn: localDb.loadBankInbox,
    staleTime: Infinity
  }));
}

export function createImportBankOperations({ queryClient, localDb }: { queryClient: QueryClient; localDb: LocalDb }) {
  return createMutationService(queryClient, () => ({
    mutationKey: ["bank-import", "load"],
    mutationFn: ({ boundary, operations }: { boundary: BankOperation; operations: BankOperation[] }) =>
      localDb.importBankOperations(boundary, operations),
    onSuccess: (inbox) => { queryClient.setQueryData(bankInboxKey(), inbox); }
  }));
}
