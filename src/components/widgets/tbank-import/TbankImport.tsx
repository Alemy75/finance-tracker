import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { formatMoney } from "@/finance";
import type { Category, FinanceTransaction } from "@/finance";
import { useLocalData } from "@/hooks/use-local-data";
import { parseTbankCsv } from "@/tbankImport";
import type { BankOperation } from "@/tbankImport";
import type { TbankImportProps } from "./types";

const bankDate = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Moscow"
});
const boundaryAmountKopeks = 408_500;
const panelClasses = "rounded-xl border bg-card px-4 py-3 shadow-xs";

function isBoundaryCandidate(operation: BankOperation): boolean {
  return operation.type === "expense" && operation.amountKopeks === boundaryAmountKopeks;
}

function operationAmount(operation: BankOperation): string {
  return `${operation.type === "income" ? "+" : "−"}${formatMoney(operation.amountKopeks)}`;
}

function ReviewOperation({ operation, categories, onSave }: {
  operation: BankOperation;
  categories: Category[];
  onSave: (entry: FinanceTransaction) => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const matching = categories.filter((category) => category.type === operation.type).sort((a, b) => a.sortOrder - b.sortOrder);
  const categoryValid = matching.some((category) => category.id === categoryId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryValid || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        id: operation.id, occurredAt: operation.occurredAt, amountKopeks: operation.amountKopeks,
        type: operation.type, note: operation.name.slice(0, 500), categoryId,
        account: "card", createdAt: new Date().toISOString(), author: null, goalId: null
      });
    } catch {
      setError("Не удалось сохранить операцию. Обновите историю и попробуйте ещё раз.");
      setSaving(false);
    }
  }

  return <li className="py-3">
    <form className="grid gap-2" onSubmit={submit}>
      <div className="flex justify-between gap-3">
        <div className="grid min-w-0 [overflow-wrap:anywhere]">
          <strong>{operation.name}</strong>
          <span className="text-sm text-muted-foreground">{bankDate.format(new Date(operation.occurredAt))} МСК</span>
        </div>
        <strong className="tabular shrink-0">{operationAmount(operation)}</strong>
      </div>
      <div className="flex items-center gap-3">
        <NativeSelect aria-label={`Категория · ${operation.name}`} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={saving} required>
          <NativeSelectOption value="">Выбрать категорию</NativeSelectOption>
          {matching.map((category) => <NativeSelectOption key={category.id} value={category.id}>{category.name}</NativeSelectOption>)}
        </NativeSelect>
        <Button type="submit" disabled={!categoryValid || saving}>{saving ? "Сохраняем…" : "Добавить"}</Button>
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </form>
  </li>;
}

export function TbankImport({ di, skeleton = false }: TbankImportProps) {
  const data = useLocalData(di);
  return <SkeletonSwap loading={skeleton || !data} skeleton={() => (
    <div className={panelClasses} data-sk="tbank-import"><SkeletonText className="font-semibold" sample="Импорт из Т‑Банка" /></div>
  )}>
    {data && <ImportContent di={di} categories={data.categories} transactions={data.transactions} />}
  </SkeletonSwap>;
}

function ImportContent({ di, categories, transactions }: Pick<TbankImportProps, "di"> & {
  categories: Category[];
  transactions: FinanceTransaction[];
}) {
  const inboxQuery = useQuery(di.getBankInbox.qo());
  const { data: inbox, isPending: loading } = inboxQuery;
  const importOperations = useMutation(di.importBankOperations.mo());
  const saveTransaction = useMutation(di.saveBankTransaction.mo());
  const [fileRows, setFileRows] = useState<BankOperation[]>([]);
  const [boundaryId, setBoundaryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const candidates = fileRows.filter(isBoundaryCandidate);
  const savedIds = new Set(transactions.map((entry) => entry.id));
  const pending = inbox?.operations.filter((row) => !savedIds.has(row.id)) ?? [];

  async function queueOperations(boundary: BankOperation, rows: BankOperation[]) {
    const updated = await importOperations.mutateAsync({ boundary, operations: rows });
    setFileRows([]);
    setBoundaryId("");
    const report = updated.operations.length ? `В списке на разбор: ${updated.operations.length}.` : "Новых операций нет.";
    const sameTime = rows.filter((row) => row.id !== updated.boundary.id && row.occurredAt === updated.boundary.occurredAt).length;
    setMessage(sameTime ? `${report} Совпало время с переводом Виктории: ${sameTime}. Проверьте эти операции в банке.` : report);
  }

  async function readFile(file: File) {
    setBusy(true);
    setError("");
    setMessage("");
    setFileRows([]);
    setBoundaryId("");
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Выберите CSV размером до 10 МБ или выгрузите период частями.");
      const { operations, skipped } = await parseTbankCsv(await file.text());
      if (inbox) await queueOperations(inbox.boundary, operations);
      else if (operations.some(isBoundaryCandidate)) setFileRows(operations);
      else throw new Error("В файле нет списания на 4 085 ₽. Выгрузите период, в который попал перевод Виктории.");
      if (skipped) setMessage((current) => `${current ? `${current} ` : ""}Пропущено строк без успешного ненулевого платежа в рублях: ${skipped}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось прочитать выгрузку.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmBoundary() {
    const boundary = candidates.find((row) => row.id === boundaryId);
    if (!boundary) return;
    setBusy(true);
    setError("");
    try {
      await queueOperations(boundary, fileRows);
    } catch {
      setError("Не удалось сохранить список на устройстве. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  return <details className={panelClasses} data-sk="tbank-import">
    <summary className="cursor-pointer font-semibold">Импорт из Т‑Банка{pending.length ? ` · На разбор: ${pending.length}` : ""}</summary>
    <div className="mt-3 grid gap-3">
      <p className="text-sm text-muted-foreground">Скачайте CSV из раздела «Операции» личного кабинета Т‑Банка. {inbox
        ? `Точка отсчёта на этом устройстве: ${bankDate.format(new Date(inbox.boundary.occurredAt))} МСК.`
        : "Для первой загрузки включите в период перевод Виктории на 4 085 ₽."}</p>
      <Label htmlFor="tbank-file">Выгрузка Т‑Банка</Label>
      <Input id="tbank-file" className="h-auto py-2" type="file" accept=".csv,text/csv" disabled={loading || busy || inboxQuery.isError} onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void readFile(file);
      }} />
      {busy && <p role="status">Обрабатываем выгрузку…</p>}
      {candidates.length > 0 && <div className="grid gap-2">
        <Label htmlFor="tbank-boundary">Какой перевод Виктории уже внесён в учёт?</Label>
        <NativeSelect id="tbank-boundary" value={boundaryId} onChange={(event) => setBoundaryId(event.target.value)} disabled={busy}>
          <NativeSelectOption value="">Выбрать операцию</NativeSelectOption>
          {candidates.map((row) => <NativeSelectOption key={row.id} value={row.id}>{bankDate.format(new Date(row.occurredAt))} МСК · {row.name} · {operationAmount(row)}</NativeSelectOption>)}
        </NativeSelect>
        <Button type="button" className="h-auto whitespace-normal" disabled={!boundaryId || busy} onClick={() => void confirmBoundary()}>Загрузить операции после перевода</Button>
      </div>}
      {inboxQuery.isError && <p className="text-sm text-destructive" role="alert">Не удалось открыть список импорта. Обновите страницу.</p>}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {message && <p className="text-sm" role="status">{message}</p>}
      {pending.length > 0 && <div>
        <h3 className="font-semibold">На разбор</h3>
        <ul className="divide-y">
          {pending.map((operation) => <ReviewOperation key={operation.id} operation={operation} categories={categories} onSave={async (entry) => {
            await saveTransaction.mutateAsync(entry);
            setMessage("Операция добавлена в историю.");
          }} />)}
        </ul>
      </div>}
    </div>
  </details>;
}
