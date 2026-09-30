import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { TransactionList, TransactionListSkeleton } from "@/components/ui/transaction-list";
import { useLocalData } from "@/hooks/use-local-data";
import type { LocalData } from "@/services/local-db";
import type { RecentOperationsProps } from "./types";

const empty = { title: "Пока нет операций", description: "Добавьте первый доход или расход — запись появится здесь." };

function recentModel(data: LocalData) {
  return {
    entries: data.transactions.filter((entry) => !entry.deletedAt).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 5),
    categoryName: (id: string) => data.categories.find((category) => category.id === id)?.name
  };
}

/** The five latest operations. */
export function RecentOperations({ di, skeleton = false }: RecentOperationsProps) {
  const data = useLocalData(di);
  const model = data && recentModel(data);
  return (
    <SkeletonSwap loading={skeleton || !model} skeleton={() => (
      <section data-sk="recent" aria-hidden="true">
        <SectionHeading title={<SkeletonText sample="Последние записи" />} />
        {!model ? <TransactionListSkeleton rows={3} />
          : model.entries.length ? <TransactionListSkeleton entries={model.entries} categoryName={model.categoryName} />
          : <EmptyState skeleton {...empty} />}
      </section>
    )}>
      {model && (
        <section data-sk="recent">
          <SectionHeading title="Последние записи" />
          {model.entries.length ? <TransactionList entries={model.entries} categoryName={model.categoryName} /> : <EmptyState {...empty} />}
        </section>
      )}
    </SkeletonSwap>
  );
}
