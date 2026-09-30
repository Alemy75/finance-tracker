import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { chipClassName, ChoiceChips } from "@/components/ui/choice-chips";
import { Field, FieldSkeleton, FormError } from "@/components/ui/field";
import { IconChevronDown } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { AuthorSelect, sortedCategories, typeOptions } from "@/components/ui/operation-fields";
import { SectionHeading } from "@/components/ui/section-heading";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, goalBalance, initialCategories, parseMoney } from "@/finance";
import type { Author, Category, TransactionType } from "@/finance";
import { useLocalData } from "@/hooks/use-local-data";
import { collapse, easeOut } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { LocalData } from "@/services/local-db";
import type { QuickEntryProps } from "./types";

const extraToggleClassName = "flex h-8 w-fit items-center gap-1.5 rounded-md text-sm font-semibold";

/** Form for adding an income or expense; it stays ready for the next entry after saving. */
export function QuickEntry({ di, skeleton = false }: QuickEntryProps) {
  const data = useLocalData(di);
  return (
    <SkeletonSwap loading={skeleton || !data} skeleton={() => <QuickEntrySkeleton categories={data?.categories ?? initialCategories} />}>
      {data && <QuickEntryForm di={di} data={data} />}
    </SkeletonSwap>
  );
}

function QuickEntryForm({ di, data }: QuickEntryProps & { data: LocalData }) {
  const saveTransaction = useMutation(di.saveTransaction.mo());
  const categories = data.categories;
  const [type, setType] = useState<TransactionType>("expense");
  const [categoryId, setCategoryId] = useState("expense-groceries");
  const [amount, setAmount] = useState("");
  const [occurredAtInput, setOccurredAtInput] = useState("");
  const [author, setAuthor] = useState<Author>(null);
  const [note, setNote] = useState("");
  const [goalId, setGoalId] = useState<string | null>(null);
  const [extraOpen, setExtraOpen] = useState(false);
  const [error, setError] = useState("");

  const availableCategories = sortedCategories(categories, type);
  const fundedGoals = data.goals.filter((goal) => !goal.archivedAt && goalBalance(goal.id, data.goalMoves, data.transactions) > 0);

  function chooseType(nextType: TransactionType) {
    setType(nextType);
    setCategoryId(categories.find((category) => category.type === nextType)?.id ?? "");
    if (nextType === "income") setGoalId(null);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountKopeks = parseMoney(amount);
    if (amountKopeks === null || amountKopeks <= 0) {
      setError("Введите сумму больше нуля, не более двух знаков после запятой.");
      return;
    }
    if (!availableCategories.some((category) => category.id === categoryId)) {
      setError("Выберите категорию.");
      return;
    }
    const createdAt = new Date().toISOString();
    const chosenDate = occurredAtInput ? new Date(occurredAtInput) : new Date(createdAt);
    if (Number.isNaN(chosenDate.getTime())) {
      setError("Проверьте дату и время операции.");
      return;
    }

    setError("");
    try {
      await saveTransaction.mutateAsync({
        id: crypto.randomUUID(), type, amountKopeks, categoryId,
        occurredAt: chosenDate.toISOString(), createdAt, author, note: note.trim(), goalId: type === "expense" ? goalId : null
      });
      setAmount("");
      setOccurredAtInput("");
      setAuthor(null);
      setNote("");
      setGoalId(null);
      toast.success("Запись сохранена на этом устройстве. Можно добавить следующую.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить запись на устройстве.");
    }
  }

  return (
    <section aria-labelledby="quick-entry-title" data-sk="quick-entry">
      <SectionHeading id="quick-entry-title" title="Добавить запись" />
      <Card className="gap-0 p-4">
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <SegmentedControl label="Тип операции" value={type} onChange={chooseType} options={typeOptions} />
          <Field label="Сумма, ₽" htmlFor="entry-amount">
            <MoneyInput id="entry-amount" size="lg" placeholder="0" value={amount}
              onChange={(event) => setAmount(event.target.value)} required />
          </Field>
          <Field label="Категория" labelId="category-label">
            <ChoiceChips labelledBy="category-label" value={categoryId} onChange={setCategoryId}
              options={availableCategories.map((category) => ({ value: category.id, label: category.name }))} />
          </Field>
          <div className="border-t pt-3">
            <button type="button" aria-expanded={extraOpen} aria-controls="entry-extra" onClick={() => setExtraOpen((open) => !open)}
              className={cn(extraToggleClassName, "text-forest-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-lime")}>
              Дополнительно
              <motion.span animate={{ rotate: extraOpen ? 180 : 0 }} transition={easeOut} className="grid place-items-center">
                <IconChevronDown className="size-4" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {extraOpen && (
                <motion.div id="entry-extra" key="extra" {...collapse} transition={easeOut} className="-m-1 overflow-hidden">
                  {/* The padding keeps the 3px focus ring of the fields inside the clipped area. */}
                  <div className="grid gap-4 p-1 pt-5">
                    <Field label="Дата и время" htmlFor="entry-date" hint="Если оставить пустым, возьмём момент сохранения.">
                      <Input id="entry-date" type="datetime-local" value={occurredAtInput} onChange={(event) => setOccurredAtInput(event.target.value)} />
                    </Field>
                    {type === "expense" && fundedGoals.length > 0 && (
                      <Field label="Оплатить из цели" htmlFor="entry-goal">
                        <NativeSelect id="entry-goal" value={goalId ?? ""} onChange={(event) => setGoalId(event.target.value || null)}>
                          <NativeSelectOption value="">Нет, обычный расход</NativeSelectOption>
                          {fundedGoals.map((goal) => <NativeSelectOption key={goal.id} value={goal.id}>{goal.name} · {formatMoney(goalBalance(goal.id, data.goalMoves, data.transactions))}</NativeSelectOption>)}
                        </NativeSelect>
                      </Field>
                    )}
                    <Field label="Кто внёс запись" htmlFor="entry-author">
                      <AuthorSelect id="entry-author" value={author} onChange={setAuthor} />
                    </Field>
                    <Field label="Заметка" htmlFor="entry-note">
                      <Textarea id="entry-note" rows={2} maxLength={500} value={note}
                        onChange={(event) => setNote(event.target.value)} placeholder="Необязательно" />
                    </Field>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={saveTransaction.isPending}>{saveTransaction.isPending ? "Сохраняем…" : "Сохранить запись"}</Button>
        </form>
      </Card>
    </section>
  );
}

function QuickEntrySkeleton({ categories }: { categories: Category[] }) {
  return (
    <section aria-hidden="true" data-sk="quick-entry">
      <SectionHeading title={<SkeletonText sample="Добавить запись" />} />
      <Card className="gap-0 p-4">
        <div className="grid gap-4">
          <Skeleton className="h-12 rounded-lg" />
          <FieldSkeleton label="Сумма, ₽" control="h-16" />
          <div className="grid gap-2">
            <span className="text-[13px] leading-none font-semibold"><SkeletonText sample="Категория" /></span>
            <div className="flex flex-wrap gap-2">
              {sortedCategories(categories, "expense").map((category) => (
                <span key={category.id} className={cn(chipClassName, "skeleton-shimmer border-transparent bg-skeleton text-transparent")}>{category.name}</span>
              ))}
            </div>
          </div>
          <div className="border-t pt-3"><span className={cn(extraToggleClassName, "text-sm")}><SkeletonText sample="Дополнительно" /><span className="size-4" /></span></div>
          <Skeleton className="h-12" />
        </div>
      </Card>
    </section>
  );
}
