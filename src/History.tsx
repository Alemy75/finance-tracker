import { useState } from "react";
import type { FormEvent } from "react";
import { formatMoney, goalBalance, isInMonth, parseMoney } from "./finance";
import type { Author, FinanceTransaction, TransactionType } from "./finance";
import type { LocalData } from "./localData";

type View = "operations" | "categories";
type Filter = "all" | TransactionType;

const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function localDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function EditOperation({ entry, data, onSave, onCancel }: {
  entry: FinanceTransaction;
  data: LocalData;
  onSave: (entry: FinanceTransaction) => Promise<void>;
  onCancel: () => void;
}) {
  const categories = data.categories;
  const [type, setType] = useState<TransactionType>(entry.type);
  const [amount, setAmount] = useState((entry.amountKopeks / 100).toFixed(2).replace(".", ","));
  const [categoryId, setCategoryId] = useState(entry.categoryId);
  const [occurredAt, setOccurredAt] = useState(localDateTime(entry.occurredAt));
  const [author, setAuthor] = useState<Author>(entry.author);
  const [note, setNote] = useState(entry.note);
  const [goalId, setGoalId] = useState<string | null>(entry.goalId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const availableCategories = categories.filter((category) => category.type === type)
    .sort((a, b) => a.sortOrder - b.sortOrder);

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
    setSaving(true);
    setError("");
    try {
      await onSave({ ...entry, type, amountKopeks, categoryId,
        occurredAt: occurredAt === localDateTime(entry.occurredAt) ? entry.occurredAt : parsedDate.toISOString(),
        author, note: note.trim(), goalId: type === "expense" ? goalId : null });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить исправление на устройстве.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="entry-card history-edit" onSubmit={submit} aria-label="Исправить операцию">
      <h3>Исправить запись</h3>
      <div className="type-switch" role="group" aria-label="Тип операции">
        <button type="button" className={type === "expense" ? "active" : ""} aria-pressed={type === "expense"} onClick={() => changeType("expense")}>Расход</button>
        <button type="button" className={type === "income" ? "active" : ""} aria-pressed={type === "income"} onClick={() => changeType("income")}>Доход</button>
      </div>
      <label htmlFor="edit-amount">Сумма, ₽</label>
      <input id="edit-amount" type="text" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
      <label htmlFor="edit-category">Категория</label>
      <select id="edit-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
        {availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>
      <label htmlFor="edit-date">Дата и время</label>
      <input id="edit-date" type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required />
      {type === "expense" && data.goals.length > 0 && <>
        <label htmlFor="edit-goal">Оплатить из цели</label>
        <select id="edit-goal" value={goalId ?? ""} onChange={(event) => setGoalId(event.target.value || null)}>
          <option value="">Нет, обычный расход</option>
          {data.goals.filter((goal) => !goal.archivedAt).map((goal) => <option key={goal.id} value={goal.id}>{goal.name} · {formatMoney(goalBalance(goal.id, data.goalMoves, data.transactions))}</option>)}
        </select>
      </>}
      <label htmlFor="edit-author">Кто внёс запись</label>
      <select id="edit-author" value={author ?? ""} onChange={(event) => setAuthor((event.target.value || null) as Author)}>
        <option value="">Не указано</option><option value="self">Я</option><option value="wife">Жена</option>
      </select>
      <label htmlFor="edit-note">Заметка</label>
      <textarea id="edit-note" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="history-edit-actions">
        <button className="primary-button" type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</button>
        <button className="secondary-button" type="button" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}

export function History({ data, onUpdate, onDelete }: {
  data: LocalData;
  onUpdate: (entry: FinanceTransaction) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [view, setView] = useState<View>("operations");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inMonth = data.transactions.filter((entry) => !entry.deletedAt && isInMonth(entry.occurredAt, month));
  const income = inMonth.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amountKopeks, 0);
  const expenses = inMonth.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amountKopeks, 0);
  const visible = inMonth.filter((entry) => filter === "all" || entry.type === filter)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt));
  const categoryTotals = [...inMonth.filter((entry) => entry.type === "expense").reduce((totals, entry) => {
    totals.set(entry.categoryId, (totals.get(entry.categoryId) ?? 0) + entry.amountKopeks);
    return totals;
  }, new Map<string, number>()).entries()]
    .map(([id, amount]) => ({ id, amount, name: data.categories.find((category) => category.id === id)?.name ?? "Категория" }))
    .sort((a, b) => b.amount - a.amount);
  const editing = inMonth.find((entry) => entry.id === editingId);

  function moveMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setEditingId(null);
  }

  async function save(entry: FinanceTransaction) {
    await onUpdate(entry);
    setEditingId(null);
  }

  async function remove(id: string) {
    if (!window.confirm("Удалить эту операцию?")) return;
    setError("");
    try {
      await onDelete(id);
      if (editingId === id) setEditingId(null);
    } catch {
      setError("Не удалось удалить запись с устройства.");
    }
  }

  return (
    <section className="content-section top-section history-section">
      <div className="month-picker" aria-label="Выбор месяца">
        <button type="button" onClick={() => moveMonth(-1)} aria-label="Предыдущий месяц">‹</button>
        <strong>{monthFormatter.format(month)}</strong>
        <button type="button" onClick={() => moveMonth(1)} aria-label="Следующий месяц">›</button>
      </div>
      <div className="history-summary" aria-label="Итоги месяца">
        <div><span>Доходы</span><strong className="income-text">+{formatMoney(income)}</strong></div>
        <div><span>Расходы</span><strong>−{formatMoney(expenses)}</strong></div>
      </div>
      <div className="type-switch history-view" role="group" aria-label="Вид истории">
        <button type="button" className={view === "operations" ? "active" : ""} aria-pressed={view === "operations"} onClick={() => setView("operations")}>Операции</button>
        <button type="button" className={view === "categories" ? "active" : ""} aria-pressed={view === "categories"} onClick={() => { setView("categories"); setEditingId(null); }}>Категории</button>
      </div>
      {view === "operations" ? <>
        <div className="history-filters" role="group" aria-label="Фильтр операций">
          {([ ["all", "Все"], ["expense", "Расходы"], ["income", "Доходы"] ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {editing && <EditOperation key={editing.id} entry={editing} data={data} onSave={save} onCancel={() => setEditingId(null)} />}
        {visible.length === 0 ? <div className="empty-panel"><strong>За этот месяц записей нет</strong><p>Выберите другой месяц или добавьте операцию на главной.</p></div> : (
          <ul className="transaction-list history-list">
            {visible.map((entry) => <li key={entry.id}>
              <div className="transaction-details">
                <strong>{data.categories.find((category) => category.id === entry.categoryId)?.name ?? "Категория"}</strong>
                <span>{dateFormatter.format(new Date(entry.occurredAt))}{entry.author === "self" ? " · Я" : entry.author === "wife" ? " · Жена" : ""}</span>
                {entry.note && <span className="transaction-note">{entry.note}</span>}
                {entry.goalId && <span>Из цели: {data.goals.find((goal) => goal.id === entry.goalId)?.name ?? "Цель"}</span>}
                <div className="history-row-actions">
                  <button type="button" onClick={() => setEditingId(entry.id)}>Исправить</button>
                  <button type="button" onClick={() => void remove(entry.id)}>Удалить</button>
                </div>
              </div>
              <strong className={`transaction-amount ${entry.type}`}>{entry.type === "income" ? "+" : "−"}{formatMoney(entry.amountKopeks)}</strong>
            </li>)}
          </ul>
        )}
      </> : categoryTotals.length === 0 ? <div className="empty-panel"><strong>Расходов за этот месяц нет</strong><p>Выберите другой месяц или добавьте расход.</p></div> : (
        <div className="summary-card history-categories">
          <div className="summary-total"><span>Всего расходов</span><strong>{formatMoney(expenses)}</strong></div>
          {categoryTotals.map((category) => <div className="category-total" key={category.id}>
            <span>{category.name} <small>{Math.round(category.amount / expenses * 100)}%</small></span>
            <strong>{formatMoney(category.amount)}</strong>
          </div>)}
        </div>
      )}
    </section>
  );
}
