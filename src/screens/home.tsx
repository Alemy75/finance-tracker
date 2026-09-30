import { BalanceCard } from "@/components/app/balance-card";
import { CategoryBreakdown, categoryTotals } from "@/components/app/category-breakdown";
import { GoalSummaryRow } from "@/components/app/goal-summary";
import { QuickEntry, QuickEntrySkeleton } from "@/components/app/quick-entry";
import { TransactionList, TransactionListSkeleton } from "@/components/app/transaction-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconChevronRight } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { allocatedTotal, cardBalance, expensesByCategory, freeBalance, goalBalance, initialCategories } from "@/finance";
import type { FinanceTransaction } from "@/finance";
import type { LocalData } from "@/localData";

const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

function homeModel(data: LocalData) {
  const month = new Date();
  const grouped = expensesByCategory(data.transactions, month);
  const categoryName = (id: string) => data.categories.find((category) => category.id === id)?.name;
  return {
    monthLabel: monthFormatter.format(month),
    balance: data.settings ? {
      free: freeBalance(data.settings, data.goals, data.goalMoves, data.transactions),
      balance: cardBalance(data.settings, data.transactions),
      allocated: allocatedTotal(data.goals, data.goalMoves, data.transactions)
    } : undefined,
    goals: data.goals.filter((goal) => !goal.archivedAt),
    monthlyExpenses: [...grouped.values()].reduce((sum, amount) => sum + amount, 0),
    totals: categoryTotals(grouped, categoryName),
    recent: data.transactions.filter((entry) => !entry.deletedAt)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 5),
    categoryName
  };
}

const emptyExpenses = { title: "В этом месяце расходов нет", description: "Добавьте расход, чтобы увидеть суммы по категориям." };
const emptyOperations = { title: "Пока нет операций", description: "Добавьте первый доход или расход — запись появится здесь." };

export function Home({ data, onSave, onGoToGoals }: {
  data: LocalData;
  onSave: (entry: FinanceTransaction) => Promise<void>;
  onGoToGoals: () => void;
}) {
  const model = homeModel(data);
  return (
    <>
      <BalanceCard values={model.balance} />
      {model.goals.length > 0 && (
        <section className="mt-7" data-sk="home-goals">
          <SectionHeading title="Цели" aside={<Button variant="link" size="sm" className="h-7 px-0" onClick={onGoToGoals}>Все цели<IconChevronRight /></Button>} />
          <div className="grid gap-2">
            {model.goals.map((goal) => <GoalSummaryRow key={goal.id} goal={goal} allocated={goalBalance(goal.id, data.goalMoves, data.transactions)} />)}
          </div>
        </section>
      )}
      <QuickEntry data={data} onSave={onSave} />
      <section className="mt-7" data-sk="month-expenses">
        <SectionHeading title="Расходы за месяц" aside={model.monthLabel} />
        {model.totals.length
          ? <CategoryBreakdown totalLabel="Всего" total={model.monthlyExpenses} rows={model.totals} />
          : <EmptyState {...emptyExpenses} />}
      </section>
      <section className="mt-7" data-sk="recent">
        <SectionHeading title="Последние записи" />
        {model.recent.length
          ? <TransactionList entries={model.recent} categoryName={model.categoryName} />
          : <EmptyState {...emptyOperations} />}
      </section>
    </>
  );
}

/** Same layout as `Home`; when local data is already known the skeleton takes its exact shape. */
export function HomeSkeleton({ data }: { data: LocalData | null }) {
  const model = data ? homeModel(data) : null;
  const heading = (title: string) => <SkeletonText sample={title} />;
  return (
    <div aria-hidden="true">
      <BalanceCard skeleton values={model?.balance} />
      {model && model.goals.length > 0 && (
        <section className="mt-7" data-sk="home-goals">
          <SectionHeading title={heading("Цели")} aside={<span className="inline-flex h-7 items-center gap-1.5 text-sm font-semibold"><SkeletonText sample="Все цели" /><span className="size-4" /></span>} />
          <div className="grid gap-2">
            {model.goals.map((goal) => <GoalSummaryRow key={goal.id} skeleton goal={goal} allocated={goalBalance(goal.id, data!.goalMoves, data!.transactions)} />)}
          </div>
        </section>
      )}
      <QuickEntrySkeleton categories={data?.categories ?? initialCategories} />
      <section className="mt-7" data-sk="month-expenses">
        <SectionHeading title={heading("Расходы за месяц")} aside={<SkeletonText sample={model?.monthLabel ?? monthFormatter.format(new Date())} />} />
        {model && model.totals.length
          ? <CategoryBreakdown skeleton totalLabel="Всего" total={model.monthlyExpenses} rows={model.totals} />
          : <EmptyState skeleton {...emptyExpenses} />}
      </section>
      <section className="mt-7" data-sk="recent">
        <SectionHeading title={heading("Последние записи")} />
        {!model ? <TransactionListSkeleton rows={3} />
          : model.recent.length ? <TransactionListSkeleton entries={model.recent} categoryName={model.categoryName} />
          : <EmptyState skeleton {...emptyOperations} />}
      </section>
    </div>
  );
}
