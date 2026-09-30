import { BalanceCard } from "@/components/ui/balance-card";
import type { BalanceValues } from "@/components/ui/balance-card";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";
import { allocatedTotal, cardBalance, cashBalance, freeBalance } from "@/finance";
import { useLocalData } from "@/hooks/use-local-data";
import type { LocalData } from "@/services/local-db";
import type { BalanceProps } from "./types";

function balanceValues(data: LocalData | undefined): BalanceValues | undefined {
  if (!data?.settings) return undefined;
  return {
    free: freeBalance(data.settings, data.goals, data.goalMoves, data.transactions),
    card: cardBalance(data.settings, data.transactions, data.transfers),
    cash: cashBalance(data.settings, data.transactions, data.transfers),
    allocated: allocatedTotal(data.goals, data.goalMoves, data.transactions)
  };
}

/** Free money, card balance and money set aside for goals. */
export function Balance({ di, skeleton = false, size = "hero", className }: BalanceProps) {
  const values = balanceValues(useLocalData(di));
  return (
    <SkeletonSwap className={className} loading={skeleton || !values} skeleton={() => <BalanceCard skeleton size={size} values={values} />}>
      <BalanceCard size={size} values={values} />
    </SkeletonSwap>
  );
}
