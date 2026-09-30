import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { EditOperationForm } from "@/components/smart/edit-operation-form";
import { EditTransferForm } from "@/components/smart/edit-transfer-form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AnimatedMoney } from "@/components/ui/animated-money";
import { Button } from "@/components/ui/button";
import { CategoryBreakdown, categoryTotals } from "@/components/ui/category-breakdown";
import { chipClassName, ChoiceChips } from "@/components/ui/choice-chips";
import { EmptyState } from "@/components/ui/empty-state";
import { FormError } from "@/components/ui/field";
import { IconArrowDownLeft, IconArrowUpRight, IconChevronLeft, IconChevronRight, IconEdit2, IconTrash2 } from "@/components/ui/icons";
import { OperationList, OperationListSkeleton } from "@/components/ui/operation-list";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { accountLabels, accountOf, activeOperations, formatMoney, isInMonth, isTransfer } from "@/finance";
import type { Account, FinanceTransaction, Operation } from "@/finance";
import { useLocalData } from "@/hooks/use-local-data";
import { useRetained } from "@/hooks/use-retained";
import { easeOut } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { LocalData } from "@/services/local-db";
import type { HistoryProps } from "./types";

type View = "operations" | "categories";
type TypeFilter = "all" | "expense" | "income" | "transfer";
type AccountFilter = "all" | Account;

const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
const viewOptions = [{ value: "operations", label: "Операции" }, { value: "categories", label: "Категории" }] as const;
const typeFilterOptions = [
  { value: "all", label: "Все" }, { value: "expense", label: "Расходы" }, { value: "income", label: "Доходы" }, { value: "transfer", label: "Переводы" }
] as const;
const accountFilterOptions = [
  { value: "all", label: "Все счета" }, { value: "card", label: accountLabels.card }, { value: "cash", label: accountLabels.cash }
] as const;

function currentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** A transfer touches both accounts, so it stays visible under either account filter. */
function inAccount(operation: Operation, filter: AccountFilter): boolean {
  return filter === "all" || isTransfer(operation) || accountOf(operation) === filter;
}

function ofType(operation: Operation, filter: TypeFilter): boolean {
  if (filter === "all") return true;
  if (isTransfer(operation)) return filter === "transfer";
  return operation.type === filter;
}

function historyModel(data: LocalData, month: Date, typeFilter: TypeFilter, accountFilter: AccountFilter) {
  const operations = activeOperations(data.transactions, data.transfers).filter((operation) => isInMonth(operation.occurredAt, month));
  const entries = operations.filter((operation): operation is FinanceTransaction => !isTransfer(operation));
  const scoped = entries.filter((entry) => inAccount(entry, accountFilter));
  const sum = (type: FinanceTransaction["type"]) => scoped.filter((entry) => entry.type === type).reduce((total, entry) => total + entry.amountKopeks, 0);
  const expenseTotals = entries.filter((entry) => entry.type === "expense").reduce((totals, entry) => {
    totals.set(entry.categoryId, (totals.get(entry.categoryId) ?? 0) + entry.amountKopeks);
    return totals;
  }, new Map<string, number>());
  const categoryName = (id: string) => data.categories.find((category) => category.id === id)?.name;
  const goalName = (id: string) => data.goals.find((goal) => goal.id === id)?.name;
  return {
    operations,
    income: sum("income"),
    expenses: sum("expense"),
    allExpenses: entries.filter((entry) => entry.type === "expense").reduce((total, entry) => total + entry.amountKopeks, 0),
    visible: operations.filter((operation) => inAccount(operation, accountFilter) && ofType(operation, typeFilter)),
    totals: categoryTotals(expenseTotals, categoryName),
    categoryName,
    goalName
  };
}

const statCardClassName = "grid gap-1 rounded-xl border bg-card p-4 shadow-xs";
const statValueClassName = "tabular text-[clamp(15px,4.4vw,19px)] leading-6 font-extrabold tracking-tight [overflow-wrap:anywhere]";
const rowActionsClassName = "mt-1.5 -ml-2 flex flex-wrap gap-1";
const rowActionClassName = "h-8 gap-1.5 px-2 text-xs font-semibold";
const smallChipClassName = "h-9 px-3 text-[13px]";
const emptyMonth = { title: "За этот месяц записей нет", description: "Выберите другой месяц или добавьте операцию на главной." };
const emptyExpenses = { title: "Расходов за этот месяц нет", description: "Выберите другой месяц или добавьте расход." };

/** Operations and transfers of a chosen month with totals, filters, the category view, correction and deletion. */
export function History({ di, skeleton = false }: HistoryProps) {
  const data = useLocalData(di);
  return (
    <SkeletonSwap loading={skeleton || !data} skeleton={() => <HistorySkeleton data={data ?? null} />}>
      {data && <HistoryContent di={di} data={data} />}
    </SkeletonSwap>
  );
}

function HistoryContent({ di, data }: { di: HistoryProps["di"]; data: LocalData }) {
  const deleteTransaction = useMutation(di.deleteTransaction.mo());
  const deleteTransfer = useMutation(di.deleteTransfer.mo());
  const [month, setMonth] = useState(currentMonth);
  const [direction, setDirection] = useState(0);
  const [view, setView] = useState<View>("operations");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const model = historyModel(data, month, typeFilter, accountFilter);
  const editing = model.operations.find((operation) => operation.id === editingId);
  const shownEditing = useRetained(editing);
  const deleting = useRetained(model.operations.find((operation) => operation.id === deletingId));

  function moveMonth(delta: number) {
    setDirection(delta);
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setEditingId(null);
  }

  async function remove(operation: Operation) {
    setError("");
    try {
      if (isTransfer(operation)) await deleteTransfer.mutateAsync(operation.id);
      else await deleteTransaction.mutateAsync(operation.id);
      if (editingId === operation.id) setEditingId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить запись с устройства.");
    }
  }

  const monthLabel = monthFormatter.format(month);
  return (
    <section>
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
        <ChoiceChips className="mb-2" size="sm" label="Фильтр операций" value={typeFilter} onChange={setTypeFilter} options={typeFilterOptions} />
        <ChoiceChips className="mb-3" size="sm" label="Фильтр по счёту" value={accountFilter} onChange={setAccountFilter} options={accountFilterOptions} />
        <FormError message={error} />
        {model.visible.length === 0 ? <EmptyState {...emptyMonth} /> : (
          <OperationList operations={model.visible} categoryName={model.categoryName} goalName={model.goalName}
            actions={(operation) => (
              <div className={rowActionsClassName}>
                <Button variant="ghost" size="sm" className={rowActionClassName} onClick={() => setEditingId(operation.id)}><IconEdit2 className="size-3.5" />Исправить</Button>
                <Button variant="ghost" size="sm" className={cn(rowActionClassName, "text-destructive hover:text-destructive")} onClick={() => setDeletingId(operation.id)}><IconTrash2 className="size-3.5" />Удалить</Button>
              </div>
            )} />
        )}
      </> : model.totals.length === 0 ? <EmptyState {...emptyExpenses} /> : (
        <CategoryBreakdown showShare totalLabel="Всего расходов" total={model.allExpenses} rows={model.totals} />
      )}

      <ResponsiveDialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditingId(null); }}
        title={shownEditing && isTransfer(shownEditing) ? "Исправить перевод" : "Исправить запись"}>
        {shownEditing && (isTransfer(shownEditing)
          ? <EditTransferForm key={shownEditing.id} di={di} transfer={shownEditing} onDone={() => setEditingId(null)} />
          : <EditOperationForm key={shownEditing.id} di={di} entry={shownEditing} data={data} onDone={() => setEditingId(null)} />)}
      </ResponsiveDialog>
      <AlertDialog open={deletingId !== null} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{deleting && isTransfer(deleting) ? "Удалить этот перевод?" : "Удалить эту операцию?"}</AlertDialogTitle>
            <AlertDialogDescription>Запись исчезнет из истории на всех устройствах после синхронизации.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { if (deleting) void remove(deleting); }}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function HistorySkeleton({ data }: { data: LocalData | null }) {
  const month = currentMonth();
  const model = data ? historyModel(data, month, "all", "all") : null;
  const actions = () => (
    <div className={rowActionsClassName}>
      <span className={cn("inline-flex items-center", rowActionClassName)}><SkeletonText sample="Исправить" className="ml-5" /></span>
      <span className={cn("inline-flex items-center", rowActionClassName)}><SkeletonText sample="Удалить" className="ml-5" /></span>
    </div>
  );
  const chips = (options: readonly { value: string; label: string }[], className: string) => (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => <span key={option.value} className={cn(chipClassName, smallChipClassName, "skeleton-shimmer border-transparent bg-skeleton text-transparent")}>{option.label}</span>)}
    </div>
  );
  return (
    <section aria-hidden="true">
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
      {chips(typeFilterOptions, "mb-2")}
      {chips(accountFilterOptions, "mb-3")}
      {!model ? <OperationListSkeleton rows={3} actions={actions} />
        : model.visible.length ? <OperationListSkeleton operations={model.visible} categoryName={model.categoryName} goalName={model.goalName} actions={actions} />
        : <EmptyState skeleton {...emptyMonth} />}
    </section>
  );
}
