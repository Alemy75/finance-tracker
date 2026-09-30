import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CategoryBreakdown, categoryTotals } from "@/components/app/category-breakdown";
import { EditOperation } from "@/components/app/edit-operation";
import { TransactionList, TransactionListSkeleton } from "@/components/app/transaction-list";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AnimatedMoney } from "@/components/ui/animated-money";
import { Button } from "@/components/ui/button";
import { chipClassName, ChoiceChips } from "@/components/ui/choice-chips";
import { EmptyState } from "@/components/ui/empty-state";
import { FormError } from "@/components/ui/field";
import { IconArrowDownLeft, IconArrowUpRight, IconChevronLeft, IconChevronRight, IconEdit2, IconTrash2 } from "@/components/ui/icons";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { formatMoney, isInMonth } from "@/finance";
import type { FinanceTransaction, TransactionType } from "@/finance";
import type { LocalData } from "@/localData";
import { useRetained } from "@/hooks/use-retained";
import { easeOut } from "@/lib/motion";
import { cn } from "@/lib/utils";

type View = "operations" | "categories";
type Filter = "all" | TransactionType;

const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
const viewOptions = [{ value: "operations", label: "Операции" }, { value: "categories", label: "Категории" }] as const;
const filterOptions = [{ value: "all", label: "Все" }, { value: "expense", label: "Расходы" }, { value: "income", label: "Доходы" }] as const;

function currentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function historyModel(data: LocalData, month: Date, filter: Filter) {
  const inMonth = data.transactions.filter((entry) => !entry.deletedAt && isInMonth(entry.occurredAt, month));
  const income = inMonth.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amountKopeks, 0);
  const expenses = inMonth.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amountKopeks, 0);
  const visible = inMonth.filter((entry) => filter === "all" || entry.type === filter)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt));
  const expenseTotals = inMonth.filter((entry) => entry.type === "expense").reduce((totals, entry) => {
    totals.set(entry.categoryId, (totals.get(entry.categoryId) ?? 0) + entry.amountKopeks);
    return totals;
  }, new Map<string, number>());
  const categoryName = (id: string) => data.categories.find((category) => category.id === id)?.name;
  const goalName = (id: string) => data.goals.find((goal) => goal.id === id)?.name;
  return { inMonth, income, expenses, visible, totals: categoryTotals(expenseTotals, categoryName), categoryName, goalName };
}

const statCardClassName = "grid gap-1 rounded-xl border bg-card p-4 shadow-xs";
const statValueClassName = "tabular text-[clamp(15px,4.4vw,19px)] leading-6 font-extrabold tracking-tight [overflow-wrap:anywhere]";
const rowActionsClassName = "mt-1.5 -ml-2 flex flex-wrap gap-1";
const rowActionClassName = "h-8 gap-1.5 px-2 text-xs font-semibold";
const emptyMonth = { title: "За этот месяц записей нет", description: "Выберите другой месяц или добавьте операцию на главной." };
const emptyExpenses = { title: "Расходов за этот месяц нет", description: "Выберите другой месяц или добавьте расход." };

export function History({ data, onUpdate, onDelete }: {
  data: LocalData;
  onUpdate: (entry: FinanceTransaction) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [month, setMonth] = useState(currentMonth);
  const [direction, setDirection] = useState(0);
  const [view, setView] = useState<View>("operations");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const model = historyModel(data, month, filter);
  const editing = model.inMonth.find((entry) => entry.id === editingId);
  const shownEditing = useRetained(editing);

  function moveMonth(delta: number) {
    setDirection(delta);
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setEditingId(null);
  }

  async function save(entry: FinanceTransaction) {
    await onUpdate(entry);
    setEditingId(null);
  }

  async function remove(id: string) {
    setError("");
    try {
      await onDelete(id);
      if (editingId === id) setEditingId(null);
    } catch {
      setError("Не удалось удалить запись с устройства.");
    }
  }

  const monthLabel = monthFormatter.format(month);
  return (
    <section className="mt-3">
      <div className="mb-4 flex items-center justify-between gap-3" aria-label="Выбор месяца" data-sk="month-picker">
        <Button variant="outline" size="icon" onClick={() => moveMonth(-1)} aria-label="Предыдущий месяц"><IconChevronLeft className="size-5" /></Button>
        <div className="relative grid h-7 flex-1 place-items-center overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.strong key={monthLabel} custom={direction} transition={easeOut}
              initial={{ opacity: 0, x: direction * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -24 }}
              className="text-lg leading-7 font-bold first-letter:uppercase">{monthLabel}</motion.strong>
          </AnimatePresence>
        </div>
        <Button variant="outline" size="icon" onClick={() => moveMonth(1)} aria-label="Следующий месяц"><IconChevronRight className="size-5" /></Button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2.5" aria-label="Итоги месяца" data-sk="history-summary">
        <div className={statCardClassName}>
          <span className="flex items-center gap-1.5 text-xs leading-4 text-muted-foreground"><IconArrowDownLeft className="size-3.5 text-income" />Доходы</span>
          <strong className={cn(statValueClassName, "text-income")}><AnimatedMoney prefix="+" value={model.income} /></strong>
        </div>
        <div className={statCardClassName}>
          <span className="flex items-center gap-1.5 text-xs leading-4 text-muted-foreground"><IconArrowUpRight className="size-3.5" />Расходы</span>
          <strong className={statValueClassName}><AnimatedMoney prefix="−" value={model.expenses} /></strong>
        </div>
      </div>
      <SegmentedControl className="mb-3" label="Вид истории" value={view} options={viewOptions}
        onChange={(next) => { setView(next); if (next === "categories") setEditingId(null); }} />
      {view === "operations" ? <>
        <ChoiceChips className="mb-3" size="sm" label="Фильтр операций" value={filter} onChange={setFilter} options={filterOptions} />
        <FormError message={error} />
        {model.visible.length === 0 ? <EmptyState {...emptyMonth} /> : (
          <TransactionList entries={model.visible} categoryName={model.categoryName} goalName={model.goalName}
            actions={(entry) => (
              <div className={rowActionsClassName}>
                <Button variant="ghost" size="sm" className={rowActionClassName} onClick={() => setEditingId(entry.id)}><IconEdit2 className="size-3.5" />Исправить</Button>
                <Button variant="ghost" size="sm" className={cn(rowActionClassName, "text-destructive hover:text-destructive")} onClick={() => setDeletingId(entry.id)}><IconTrash2 className="size-3.5" />Удалить</Button>
              </div>
            )} />
        )}
      </> : model.totals.length === 0 ? <EmptyState {...emptyExpenses} /> : (
        <CategoryBreakdown showShare totalLabel="Всего расходов" total={model.expenses} rows={model.totals} />
      )}

      <ResponsiveDialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditingId(null); }} title="Исправить запись">
        {shownEditing && <EditOperation key={shownEditing.id} entry={shownEditing} data={data} onSave={save} onCancel={() => setEditingId(null)} />}
      </ResponsiveDialog>
      <AlertDialog open={deletingId !== null} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить эту операцию?</AlertDialogTitle>
            <AlertDialogDescription>Запись исчезнет из истории на всех устройствах после синхронизации.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { if (deletingId) void remove(deletingId); }}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function HistorySkeleton({ data }: { data: LocalData | null }) {
  const month = currentMonth();
  const model = data ? historyModel(data, month, "all") : null;
  const actions = () => (
    <div className={rowActionsClassName}>
      <span className={cn("inline-flex items-center", rowActionClassName)}><SkeletonText sample="Исправить" className="ml-5" /></span>
      <span className={cn("inline-flex items-center", rowActionClassName)}><SkeletonText sample="Удалить" className="ml-5" /></span>
    </div>
  );
  return (
    <section className="mt-3" aria-hidden="true">
      <div className="mb-4 flex items-center justify-between gap-3" data-sk="month-picker">
        <Skeleton className="size-11" />
        <div className="grid h-7 flex-1 place-items-center"><strong className="text-lg leading-7 font-bold first-letter:uppercase"><SkeletonText sample={monthFormatter.format(month)} /></strong></div>
        <Skeleton className="size-11" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2.5" data-sk="history-summary">
        {[["Доходы", `+${formatMoney(model?.income ?? 0)}`], ["Расходы", `−${formatMoney(model?.expenses ?? 0)}`]].map(([label, value]) => (
          <div key={label} className={statCardClassName}>
            <span className="flex items-center gap-1.5 text-xs leading-4"><SkeletonText sample={`__${label}`} /></span>
            <strong className={statValueClassName}><SkeletonText sample={value} /></strong>
          </div>
        ))}
      </div>
      <Skeleton className="mb-3 h-12 rounded-lg" />
      <div className="mb-3 flex flex-wrap gap-2">
        {filterOptions.map((option) => <span key={option.value} className={cn(chipClassName, "h-9 px-3 text-[13px] skeleton-shimmer border-transparent bg-skeleton text-transparent")}>{option.label}</span>)}
      </div>
      {!model ? <TransactionListSkeleton rows={3} actions={actions} />
        : model.visible.length ? <TransactionListSkeleton entries={model.visible} categoryName={model.categoryName} goalName={model.goalName} actions={actions} />
        : <EmptyState skeleton {...emptyMonth} />}
    </section>
  );
}
