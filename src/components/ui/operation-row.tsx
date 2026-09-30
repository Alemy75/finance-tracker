import type { ReactNode } from "react";
import { IconArrowDownLeft, IconArrowUpRight, IconRepeat } from "@/components/ui/icons";
import { transferLabel } from "@/components/ui/operation-fields";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { accountLabels, accountOf, formatMoney, isTransfer } from "@/finance";
import type { FinanceTransaction, Operation } from "@/finance";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function authorSuffix(author: FinanceTransaction["author"]): string {
  return author === "self" ? " · Я" : author === "wife" ? " · Жена" : "";
}

export const placeholderEntry: FinanceTransaction = {
  id: "placeholder", type: "expense", amountKopeks: 125_000, categoryId: "", occurredAt: "2026-09-28T11:05:00.000Z",
  createdAt: "2026-09-28T11:05:00.000Z", author: null, note: "", goalId: null, account: "card"
};

/**
 * One income, expense or transfer. With `skeleton` every text leaf becomes a placeholder that uses the real string as
 * its sample, so the skeleton keeps the exact size of the row it stands in for.
 */
export function OperationRow({ operation, categoryName, goalName, actions, skeleton = false }: {
  operation: Operation;
  categoryName?: string;
  goalName?: string | null;
  actions?: ReactNode;
  skeleton?: boolean;
}) {
  const text = (value: string) => skeleton ? <SkeletonText sample={value} /> : value;
  const date = dateFormatter.format(new Date(operation.occurredAt));
  const transfer = isTransfer(operation);
  const income = !transfer && operation.type === "income";
  const Icon = transfer ? IconRepeat : income ? IconArrowDownLeft : IconArrowUpRight;
  const title = transfer ? transferLabel(operation.from) : categoryName ?? "Категория";
  const meta = `${date} · ${transfer ? "Перевод" : accountLabels[accountOf(operation)]}${authorSuffix(operation.author)}`;
  const amount = transfer ? formatMoney(operation.amountKopeks) : (income ? "+" : "−") + formatMoney(operation.amountKopeks);
  return (
    <div className="px-4 py-3.5" data-sk="operation-row">
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full",
          skeleton ? "skeleton-shimmer bg-skeleton" : income ? "bg-income/12 text-income" : "bg-muted text-muted-foreground")}>
          {!skeleton && <Icon className="size-4" />}
        </span>
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-0.5">
          <strong className="text-sm leading-5 font-semibold">{text(title)}</strong>
          <span className="text-xs leading-4 text-muted-foreground">{text(meta)}</span>
          {operation.note && <span className="text-xs leading-4 [overflow-wrap:anywhere] text-muted-foreground">{text(operation.note)}</span>}
          {goalName && <span className="text-xs leading-4 text-muted-foreground">{text(`Из цели: ${goalName}`)}</span>}
        </div>
        <strong className={cn("tabular text-[15px] leading-5 font-bold whitespace-nowrap", !skeleton && (income ? "text-income" : transfer && "text-muted-foreground"))}>
          {text(amount)}
        </strong>
      </div>
      {actions && <div className="ml-12">{actions}</div>}
    </div>
  );
}
