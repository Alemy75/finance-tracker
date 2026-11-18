import { useEffect, useState } from "react";
import { formatMoney } from "./finance";
import type { Category, FinanceTransaction } from "./finance";
import { importBankOperations, loadBankInbox } from "./localData";
import { parseTbankCsv } from "./tbankImport";
import type { BankInbox, BankOperation } from "./tbankImport";

const bankDate = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Moscow"
});
const boundaryAmountKopeks = 408_500;

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
        createdAt: new Date().toISOString(), author: null, goalId: null
      });
    } catch {
      setError("Не удалось сохранить операцию. Обновите историю и попробуйте ещё раз.");
      setSaving(false);
    }
  }

  return <li>
    <form className="bank-review-form" onSubmit={submit}>
      <div className="bank-operation-title">
        <div className="transaction-details"><strong>{operation.name}</strong><span>{bankDate.format(new Date(operation.occurredAt))} МСК</span></div>
        <strong className={`transaction-amount ${operation.type}`}>{operationAmount(operation)}</strong>
      </div>
      <div className="bank-review-actions">
        <select aria-label={`Категория · ${operation.name}`} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={saving} required>
          <option value="">Выбрать категорию</option>
          {matching.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <button type="submit" className="primary-button" disabled={!categoryValid || saving}>{saving ? "Сохраняем…" : "Добавить"}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  </li>;
}

export function TbankImportPanel({ categories, transactions, onSave }: {
  categories: Category[];
  transactions: FinanceTransaction[];
  onSave: (entry: FinanceTransaction) => Promise<void>;
}) {
  const [inbox, setInbox] = useState<BankInbox>();
  const [fileRows, setFileRows] = useState<BankOperation[]>([]);
  const [boundaryId, setBoundaryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadBankInbox().then((result) => {
      if (active) setInbox(result);
    }).catch(() => {
      if (active) setError("Не удалось открыть список импорта. Обновите страницу.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const candidates = fileRows.filter(isBoundaryCandidate);
  const savedIds = new Set(transactions.map((entry) => entry.id));
  const pending = inbox?.operations.filter((row) => !savedIds.has(row.id)) ?? [];

  async function queueOperations(boundary: BankOperation, rows: BankOperation[]) {
    const updated = await importBankOperations(boundary, rows);
    setInbox(updated);
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

  return <details className="entry-card bank-import">
    <summary>Импорт из Т‑Банка{pending.length ? ` · На разбор: ${pending.length}` : ""}</summary>
    <p>Скачайте CSV из раздела «Операции» личного кабинета Т‑Банка. {inbox
      ? `Точка отсчёта на этом устройстве: ${bankDate.format(new Date(inbox.boundary.occurredAt))} МСК.`
      : "Для первой загрузки включите в период перевод Виктории на 4 085 ₽."}</p>
    <label className="field-label" htmlFor="tbank-file">Выгрузка Т‑Банка</label>
    <input id="tbank-file" type="file" accept=".csv,text/csv" disabled={loading || busy} onChange={(event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (file) void readFile(file);
    }} />
    {busy && <p role="status">Обрабатываем выгрузку…</p>}
    {candidates.length > 0 && <div className="bank-boundary">
      <label className="field-label" htmlFor="tbank-boundary">Какой перевод Виктории уже внесён в учёт?</label>
      <select id="tbank-boundary" value={boundaryId} onChange={(event) => setBoundaryId(event.target.value)} disabled={busy}>
        <option value="">Выбрать операцию</option>
        {candidates.map((row) => <option key={row.id} value={row.id}>{bankDate.format(new Date(row.occurredAt))} МСК · {row.name} · {operationAmount(row)}</option>)}
      </select>
      <button type="button" className="primary-button" disabled={!boundaryId || busy} onClick={() => void confirmBoundary()}>Загрузить операции после перевода</button>
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status">{message}</p>}
    {pending.length > 0 && <div>
      <h3>На разбор</h3>
      <ul className="transaction-list bank-review-list">
        {pending.map((operation) => <ReviewOperation key={operation.id} operation={operation} categories={categories} onSave={async (entry) => {
          await onSave(entry);
          setInbox((current) => current && { ...current, operations: current.operations.filter((row) => row.id !== entry.id) });
          setMessage("Операция добавлена в историю.");
        }} />)}
      </ul>
    </div>}
  </details>;
}
