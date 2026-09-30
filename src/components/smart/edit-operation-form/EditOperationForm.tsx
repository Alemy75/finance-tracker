import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { AuthorSelect, sortedCategories, typeOptions } from "@/components/ui/operation-fields";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, goalBalance, parseMoney } from "@/finance";
import type { Author, FinanceTransaction, TransactionType } from "@/finance";
import type { Di } from "@/lib/di";
import type { LocalData } from "@/services/local-db";

function localDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Correction of one operation; closes itself through `onDone` after a successful save. */
export function EditOperationForm({ di, entry, data, onDone }: {
  di: Di;
  entry: FinanceTransaction;
  data: LocalData;
  onDone: () => void;
}) {
  const updateTransaction = useMutation(di.updateTransaction.mo());
  const categories = data.categories;
  const [type, setType] = useState<TransactionType>(entry.type);
  const [amount, setAmount] = useState((entry.amountKopeks / 100).toFixed(2).replace(".", ","));
  const [categoryId, setCategoryId] = useState(entry.categoryId);
  const [occurredAt, setOccurredAt] = useState(localDateTime(entry.occurredAt));
  const [author, setAuthor] = useState<Author>(entry.author);
  const [note, setNote] = useState(entry.note);
  const [goalId, setGoalId] = useState<string | null>(entry.goalId);
  const [error, setError] = useState("");
  const availableCategories = sortedCategories(categories, type);

  function changeType(nextType: TransactionType) {
    setType(nextType);
    setCategoryId(categories.find((category) => category.type === nextType)?.id ?? "");
    if (nextType === "income") setGoalId(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountKopeks = parseMoney(amount);
    const parsedDate = new Date(occurredAt);
    if (!amountKopeks || !availableCategories.some((category) => category.id === categoryId) || Number.isNaN(parsedDate.getTime())) {
      setError("Проверьте сумму, категорию и дату операции.");
      return;
    }
    setError("");
    try {
      await updateTransaction.mutateAsync({ ...entry, type, amountKopeks, categoryId,
        occurredAt: occurredAt === localDateTime(entry.occurredAt) ? entry.occurredAt : parsedDate.toISOString(),
        author, note: note.trim(), goalId: type === "expense" ? goalId : null });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить исправление на устройстве.");
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit} aria-label="Исправить операцию" noValidate>
      <SegmentedControl label="Тип операции" value={type} onChange={changeType} options={typeOptions} />
      <Field label="Сумма, ₽" htmlFor="edit-amount">
        <MoneyInput id="edit-amount" value={amount} onChange={(event) => setAmount(event.target.value)} required />
      </Field>
      <Field label="Категория" htmlFor="edit-category">
        <NativeSelect id="edit-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
          {availableCategories.map((category) => <NativeSelectOption key={category.id} value={category.id}>{category.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Дата и время" htmlFor="edit-date">
        <Input id="edit-date" type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required />
      </Field>
      {type === "expense" && data.goals.length > 0 && (
        <Field label="Оплатить из цели" htmlFor="edit-goal">
          <NativeSelect id="edit-goal" value={goalId ?? ""} onChange={(event) => setGoalId(event.target.value || null)}>
            <NativeSelectOption value="">Нет, обычный расход</NativeSelectOption>
            {data.goals.filter((goal) => !goal.archivedAt).map((goal) => <NativeSelectOption key={goal.id} value={goal.id}>{goal.name} · {formatMoney(goalBalance(goal.id, data.goalMoves, data.transactions))}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      )}
      <Field label="Кто внёс запись" htmlFor="edit-author">
        <AuthorSelect id="edit-author" value={author} onChange={setAuthor} />
      </Field>
      <Field label="Заметка" htmlFor="edit-note">
        <Textarea id="edit-note" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <FormError message={error} />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onDone}>Отмена</Button>
        <Button type="submit" size="lg" disabled={updateTransaction.isPending}>{updateTransaction.isPending ? "Сохраняем…" : "Сохранить"}</Button>
      </div>
    </form>
  );
}
