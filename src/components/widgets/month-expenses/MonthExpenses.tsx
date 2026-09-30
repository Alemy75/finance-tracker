import { CategoryBreakdown, categoryTotals } from "@/components/ui/category-breakdown";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { expensesByCategory } from "@/finance";
import { useLocalData } from "@/hooks/use-local-data";
import type { LocalData } from "@/services/local-db";
import type { MonthExpensesProps } from "./types";

const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
const empty = { title: "В этом месяце расходов нет", description: "Добавьте расход, чтобы увидеть суммы по категориям." };

function monthModel(data: LocalData | undefined) {
  const month = new Date();
  const grouped = data ? expensesByCategory(data.transactions, month) : new Map<string, number>();
  return {
    label: monthFormatter.format(month),
    total: [...grouped.values()].reduce((sum, amount) => sum + amount, 0),
    rows: categoryTotals(grouped, (id) => data?.categories.find((category) => category.id === id)?.name)
  };
}

/** Expenses of the current month by category. */
export function MonthExpenses({ di, skeleton = false }: MonthExpensesProps) {
  const data = useLocalData(di);
  const model = monthModel(data);
  return (
    <SkeletonSwap loading={skeleton || !data} skeleton={() => (
      <section data-sk="month-expenses" aria-hidden="true">
        <SectionHeading title={<SkeletonText sample="Расходы за месяц" />} aside={<SkeletonText sample={model.label} />} />
        {model.rows.length
          ? <CategoryBreakdown skeleton totalLabel="Всего" total={model.total} rows={model.rows} />
          : <EmptyState skeleton {...empty} />}
      </section>
    )}>
      <section data-sk="month-expenses">
        <SectionHeading title="Расходы за месяц" aside={model.label} />
        {model.rows.length ? <CategoryBreakdown totalLabel="Всего" total={model.total} rows={model.rows} /> : <EmptyState {...empty} />}
      </section>
    </SkeletonSwap>
  );
}
