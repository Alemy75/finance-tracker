import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { placeholderEntry, TransactionRow } from "@/components/ui/transaction-row";
import type { FinanceTransaction } from "@/finance";
import { collapse, easeOut } from "@/lib/motion";

export const listClassName = "overflow-hidden rounded-xl border bg-card shadow-xs";

export interface TransactionListProps {
  entries: FinanceTransaction[];
  categoryName: (id: string) => string | undefined;
  goalName?: (id: string) => string | undefined;
  actions?: (entry: FinanceTransaction) => ReactNode;
}

/** Card with a divided list of operations; rows animate in and out after the first render. */
export function TransactionList({ entries, categoryName, goalName, actions }: TransactionListProps) {
  return (
    <ul className={listClassName} data-sk="transaction-list">
      <AnimatePresence initial={false}>
        {entries.map((entry, index) => (
          <motion.li key={entry.id} layout="position" {...collapse} transition={easeOut}
            className={index > 0 ? "border-t" : undefined}>
            <TransactionRow entry={entry} categoryName={categoryName(entry.categoryId)}
              goalName={entry.goalId ? goalName?.(entry.goalId) ?? "Цель" : null} actions={actions?.(entry)} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

/** Skeleton of `TransactionList`: known entries keep their real shape, otherwise `rows` generic rows. */
export function TransactionListSkeleton({ entries, rows = 4, categoryName, goalName, actions }: Partial<TransactionListProps> & { rows?: number }) {
  const shaped = entries ?? Array.from({ length: rows }, () => placeholderEntry);
  return (
    <ul className={listClassName} data-sk="transaction-list" aria-hidden="true">
      {shaped.map((entry, index) => (
        <li key={`${entry.id}-${index}`} className={index > 0 ? "border-t" : undefined}>
          <TransactionRow skeleton entry={entry} categoryName={categoryName?.(entry.categoryId) ?? "Продукты"}
            goalName={entry.goalId ? goalName?.(entry.goalId) ?? "Цель" : null} actions={actions?.(entry)} />
        </li>
      ))}
    </ul>
  );
}
