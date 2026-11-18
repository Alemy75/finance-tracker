import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { AuthorSelect, localDateTime, transferOptions } from "@/components/ui/operation-fields";
import { Textarea } from "@/components/ui/textarea";
import { parseMoney } from "@/finance";
import type { Account, Author, Transfer } from "@/finance";
import type { Di } from "@/lib/di";

/** Correction of one transfer; closes itself through `onDone` after a successful save. */
export function EditTransferForm({ di, transfer, onDone }: { di: Di; transfer: Transfer; onDone: () => void }) {
  const updateTransfer = useMutation(di.updateTransfer.mo());
  const [from, setFrom] = useState<Account>(transfer.from);
  const [amount, setAmount] = useState((transfer.amountKopeks / 100).toFixed(2).replace(".", ","));
  const [occurredAt, setOccurredAt] = useState(localDateTime(transfer.occurredAt));
  const [author, setAuthor] = useState<Author>(transfer.author);
  const [note, setNote] = useState(transfer.note);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountKopeks = parseMoney(amount);
    const parsedDate = new Date(occurredAt);
    if (!amountKopeks || Number.isNaN(parsedDate.getTime())) {
      setError("Проверьте сумму и дату перевода.");
      return;
    }
    setError("");
    try {
      await updateTransfer.mutateAsync({ ...transfer, from, amountKopeks,
        occurredAt: occurredAt === localDateTime(transfer.occurredAt) ? transfer.occurredAt : parsedDate.toISOString(),
        author, note: note.trim() });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить исправление на устройстве.");
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit} aria-label="Исправить перевод" noValidate>
      <Field label="Сумма, ₽" htmlFor="edit-transfer-amount">
        <MoneyInput id="edit-transfer-amount" value={amount} onChange={(event) => setAmount(event.target.value)} required />
      </Field>
      <Field label="Направление" labelId="edit-transfer-direction">
        <ChoiceChips labelledBy="edit-transfer-direction" value={from} onChange={setFrom} options={transferOptions} />
      </Field>
      <Field label="Дата и время" htmlFor="edit-transfer-date">
        <Input id="edit-transfer-date" type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required />
      </Field>
      <Field label="Кто внёс запись" htmlFor="edit-transfer-author">
        <AuthorSelect id="edit-transfer-author" value={author} onChange={setAuthor} />
      </Field>
      <Field label="Заметка" htmlFor="edit-transfer-note">
        <Textarea id="edit-transfer-note" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <FormError message={error} />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onDone}>Отмена</Button>
        <Button type="submit" size="lg" disabled={updateTransfer.isPending}>{updateTransfer.isPending ? "Сохраняем…" : "Сохранить"}</Button>
      </div>
    </form>
  );
}
