import type { ReactNode } from "react";
import { IconArrowDownLeft, IconArrowUpRight } from "@/components/ui/icons";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { formatMoney } from "@/finance";
import type { FinanceTransaction } from "@/finance";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function authorSuffix(author: FinanceTransaction["author"]): string {
  return author === "self" ? " · Я" : author === "wife" ? " · Жена" : "";
}

export const placeholderEntry: FinanceTransaction = {
  id: "placeholder", type: "expense", amountKopeks: 125_000, categoryId: "", occurredAt: "2026-09-28T11:05:00.000Z",
  createdAt: "2026-09-28T11:05:00.000Z", author: null, note: "", goalId: null
};

/**
 * One operation. With `skeleton` every text leaf becomes a placeholder that uses the real string as its sample,
 * so the skeleton keeps the exact size of the row it stands in for.
 */
export function TransactionRow({ entry, categoryName, goalName, actions, skeleton = false }: {
  entry: FinanceTransaction;
  categoryName?: string;
  goalName?: string | null;
  actions?: ReactNode;
  skeleton?: boolean;
}) {
  const text = (value: string) => skeleton ? <SkeletonText sample={value} /> : value;
  const income = entry.type === "income";
  const Icon = income ? IconArrowDownLeft : IconArrowUpRight;
  return (
    <div className="px-4 py-3.5" data-sk="transaction-row">
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full",
          skeleton ? "skeleton-shimmer bg-skeleton" : income ? "bg-income/12 text-income" : "bg-muted text-muted-foreground")}>
          {!skeleton && <Icon className="size-4" />}
        </span>
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-0.5">
          <strong className="text-sm leading-5 font-semibold">{text(categoryName ?? "Категория")}</strong>
          <span className="text-xs leading-4 text-muted-foreground">{text(dateFormatter.format(new Date(entry.occurredAt)) + authorSuffix(entry.author))}</span>
          {entry.note && <span className="text-xs leading-4 [overflow-wrap:anywhere] text-muted-foreground">{text(entry.note)}</span>}
          {goalName && <span className="text-xs leading-4 text-muted-foreground">{text(`Из цели: ${goalName}`)}</span>}
        </div>
        <strong className={cn("tabular text-[15px] leading-5 font-bold whitespace-nowrap", income && !skeleton && "text-income")}>
          {text((income ? "+" : "−") + formatMoney(entry.amountKopeks))}
        </strong>
      </div>
      {actions && <div className="ml-12">{actions}</div>}
    </div>
  );
}
