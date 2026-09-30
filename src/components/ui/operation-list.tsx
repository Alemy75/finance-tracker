import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { OperationRow, placeholderEntry } from "@/components/ui/operation-row";
import { isTransfer } from "@/finance";
import type { Operation } from "@/finance";
import { collapse, easeOut } from "@/lib/motion";

export const listClassName = "overflow-hidden rounded-xl border bg-card shadow-xs";

export interface OperationListProps {
  operations: Operation[];
  categoryName: (id: string) => string | undefined;
  goalName?: (id: string) => string | undefined;
  actions?: (operation: Operation) => ReactNode;
}

function rowProps({ categoryName, goalName, actions }: Omit<OperationListProps, "operations">, operation: Operation) {
  if (isTransfer(operation)) return { operation, actions: actions?.(operation) };
  return {
    operation,
    categoryName: categoryName(operation.categoryId),
    goalName: operation.goalId ? goalName?.(operation.goalId) ?? "Цель" : null,
    actions: actions?.(operation)
  };
}

/** Card with a divided list of operations and transfers; rows animate in and out after the first render. */
export function OperationList({ operations, ...rest }: OperationListProps) {
  return (
    <ul className={listClassName} data-sk="operation-list">
      <AnimatePresence initial={false}>
        {operations.map((operation, index) => (
          <motion.li key={operation.id} layout="position" {...collapse} transition={easeOut}
            className={index > 0 ? "border-t" : undefined}>
            <OperationRow {...rowProps(rest, operation)} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

/** Skeleton of `OperationList`: known operations keep their real shape, otherwise `rows` generic rows. */
export function OperationListSkeleton({ operations, rows = 4, categoryName = () => "Продукты", goalName, actions }:
  Partial<OperationListProps> & { rows?: number }) {
  const shaped = operations ?? Array.from({ length: rows }, () => placeholderEntry);
  return (
    <ul className={listClassName} data-sk="operation-list" aria-hidden="true">
      {shaped.map((operation, index) => (
        <li key={`${operation.id}-${index}`} className={index > 0 ? "border-t" : undefined}>
          <OperationRow skeleton {...rowProps({ categoryName: (id) => categoryName(id) ?? "Продукты", goalName, actions }, operation)} />
        </li>
      ))}
    </ul>
  );
}
