import { useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { chipClassName, ChoiceChips } from "@/components/ui/choice-chips";
import { Field, FieldSkeleton, FormError } from "@/components/ui/field";
import { IconArrowDownLeft, IconArrowUpRight, IconChevronDown } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SectionHeading } from "@/components/ui/section-heading";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, goalBalance, parseMoney } from "@/finance";
import type { Author, Category, FinanceTransaction, TransactionType } from "@/finance";
import type { LocalData } from "@/localData";
import { collapse, easeOut } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const typeOptions = [
  { value: "expense", label: "Расход", icon: <IconArrowUpRight className="size-4" /> },
  { value: "income", label: "Доход", icon: <IconArrowDownLeft className="size-4" /> }
] as const;

export function sortedCategories(categories: Category[], type: TransactionType): Category[] {
  return categories.filter((category) => category.type === type).sort((a, b) => a.sortOrder - b.sortOrder);
}

const extraToggleClassName = "flex h-8 w-fit items-center gap-1.5 rounded-md text-sm font-semibold";

export function QuickEntry({ data, onSave }: {
  data: LocalData;
  onSave: (entry: FinanceTransaction) => Promise<void>;
}) {
  const categories = data.categories;
  const [type, setType] = useState<TransactionType>("expense");
  const [categoryId, setCategoryId] = useState("expense-groceries");
  const [amount, setAmount] = useState("");
  const [occurredAtInput, setOccurredAtInput] = useState("");
  const [author, setAuthor] = useState<Author>(null);
  const [note, setNote] = useState("");
  const [goalId, setGoalId] = useState<string | null>(null);
  const [extraOpen, setExtraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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

    setSaving(true);
    setError("");
    try {
      await onSave({
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-7" aria-labelledby="quick-entry-title" data-sk="quick-entry">
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
                <motion.div id="entry-extra" key="extra" {...collapse} transition={easeOut} className="overflow-hidden">
                  <div className="grid gap-4 pt-4">
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
          <Button type="submit" size="lg" className="w-full" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить запись"}</Button>
        </form>
      </Card>
    </section>
  );
}

export function AuthorSelect({ id, value, onChange }: { id: string; value: Author; onChange: (author: Author) => void }) {
  return (
    <NativeSelect id={id} value={value ?? ""} onChange={(event) => onChange((event.target.value || null) as Author)}>
      <NativeSelectOption value="">Не указано</NativeSelectOption>
      <NativeSelectOption value="self">Я</NativeSelectOption>
      <NativeSelectOption value="wife">Жена</NativeSelectOption>
    </NativeSelect>
  );
}

export function QuickEntrySkeleton({ categories }: { categories: Category[] }) {
  return (
    <section className="mt-7" aria-hidden="true" data-sk="quick-entry">
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
