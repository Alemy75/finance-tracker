import { AnimatedMoney } from "@/components/ui/animated-money";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { formatMoney } from "@/finance";

export interface CategoryAmount {
  id: string;
  name: string;
  amount: number;
}

export function categoryTotals(amounts: Map<string, number>, name: (id: string) => string | undefined): CategoryAmount[] {
  return [...amounts.entries()]
    .map(([id, amount]) => ({ id, amount, name: name(id) ?? "Категория" }))
    .sort((a, b) => b.amount - a.amount);
}

/** Month total with one row and share bar per category. With `skeleton` text leaves become placeholders. */
export function CategoryBreakdown({ totalLabel, total, rows, showShare = false, skeleton = false }: {
  totalLabel: string;
  total: number;
  rows: CategoryAmount[];
  showShare?: boolean;
  skeleton?: boolean;
}) {
  const text = (value: string) => skeleton ? <SkeletonText sample={value} /> : value;
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs" data-sk="category-breakdown" aria-hidden={skeleton || undefined}>
      <div className="flex items-baseline justify-between gap-4 border-b pb-3.5">
        <span className="text-[15px] leading-6 font-semibold">{text(totalLabel)}</span>
        <strong className="tabular text-lg leading-6 font-extrabold">{skeleton ? text(formatMoney(total)) : <AnimatedMoney value={total} />}</strong>
      </div>
      <ul className="grid gap-3.5 pt-3.5">
        {rows.map((row) => {
          const share = total > 0 ? Math.round(row.amount / total * 100) : 0;
          return (
            <li key={row.id} className="grid gap-2">
              <div className="flex items-baseline justify-between gap-4 text-sm leading-5">
                <span className="min-w-0 text-muted-foreground">{text(row.name)}{showShare && <small className="ml-1.5 text-xs">{text(`${share}%`)}</small>}</span>
                <strong className="tabular font-semibold">{text(formatMoney(row.amount))}</strong>
              </div>
              {skeleton ? <div className="h-1.5 rounded-full bg-muted" />
                : <AnimatedProgress value={share} label={`Доля категории ${row.name}`} className="h-1.5" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
