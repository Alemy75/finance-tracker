import { useState } from "react";
import type { FormEvent } from "react";
import { cardBalance, formatMoney, freeBalance, goalBalance, parseMoney } from "./finance";
import type { Goal, GoalMove } from "./finance";
import type { LocalData } from "./localData";

function GoalCard({ goal, data, onMove }: {
  goal: Goal;
  data: LocalData;
  onMove: (move: GoalMove) => Promise<void>;
}) {
  const [action, setAction] = useState<"allocate" | "release" | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const allocated = goalBalance(goal.id, data.goalMoves, data.transactions);
  const progress = Math.min(100, Math.max(0, Math.round(allocated / goal.targetKopeks * 100)));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const kopeks = parseMoney(amount);
    if (!action || !kopeks) {
      setError("Введите сумму больше нуля.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      await onMove({ id: crypto.randomUUID(), goalId: goal.id,
        amountKopeks: action === "allocate" ? kopeks : -kopeks,
        occurredAt: now, createdAt: now });
      setAmount("");
      setAction(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить изменение цели.");
    } finally {
      setSaving(false);
    }
  }

  return <article className="goal-card">
    <div className="goal-card-heading"><h3>{goal.name}</h3><strong>{formatMoney(allocated)}</strong></div>
    <div className="goal-progress" role="progressbar" aria-label={`Прогресс цели ${goal.name}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${progress}%` }} />
    </div>
    <p>Цель: {formatMoney(goal.targetKopeks)} · {progress}%</p>
    <div className="goal-actions">
      <button type="button" className="secondary-button" onClick={() => { setAction("allocate"); setAmount(""); setError(""); }}>Выделить</button>
      <button type="button" className="secondary-button" onClick={() => { setAction("release"); setAmount(""); setError(""); }} disabled={allocated <= 0}>Вернуть</button>
    </div>
    {action && <form className="goal-move-form" onSubmit={submit}>
      <label htmlFor={`goal-amount-${goal.id}`}>{action === "allocate" ? "Сколько выделить, ₽" : "Сколько вернуть, ₽"}</label>
      <input id={`goal-amount-${goal.id}`} type="text" inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} required />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="goal-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? "Сохраняем…" : action === "allocate" ? "Выделить" : "Вернуть"}</button>
        <button className="secondary-button" type="button" onClick={() => { setAction(null); setAmount(""); setError(""); }}>Отмена</button></div>
    </form>}
  </article>;
}

export function Goals({ data, onCreate, onMove }: {
  data: LocalData;
  onCreate: (goal: Goal) => Promise<void>;
  onMove: (move: GoalMove) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const balance = cardBalance(data.settings!, data.transactions);
  const free = freeBalance(data.settings!, data.goals, data.goalMoves, data.transactions);
  const allocated = balance - free;
  const activeGoals = data.goals.filter((goal) => !goal.archivedAt);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetKopeks = parseMoney(target);
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 120 || !targetKopeks) {
      setError("Введите название и желаемую сумму больше нуля.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      await onCreate({ id: crypto.randomUUID(), name: trimmedName, targetKopeks, createdAt: now, updatedAt: now });
      setName("");
      setTarget("");
    } catch {
      setError("Не удалось сохранить цель на устройстве.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="content-section top-section goals-section">
    <div className="balance-card compact-card">
      <span className="eyebrow">Свободно</span><strong className="compact-value">{formatMoney(free)}</strong>
      <div className="balance-breakdown"><div><span>На карте</span><strong>{formatMoney(balance)}</strong></div>
        <div><span>В целях</span><strong>{formatMoney(allocated)}</strong></div></div>
    </div>
    <div className="section-heading"><h2>Мои цели</h2></div>
    {activeGoals.length === 0 ? <div className="empty-panel"><strong>Целей пока нет</strong><p>Создайте цель и выделяйте на неё деньги с карты.</p></div> : (
      <div className="goal-list">{activeGoals.map((goal) => <GoalCard key={goal.id} goal={goal} data={data} onMove={onMove} />)}</div>
    )}
    <form className="entry-card goal-create" onSubmit={create}>
      <h3>Новая цель</h3>
      <label htmlFor="goal-name">Название</label>
      <input id="goal-name" type="text" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, отпуск" required />
      <label htmlFor="goal-target">Желаемая сумма, ₽</label>
      <input id="goal-target" type="text" inputMode="decimal" autoComplete="off" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="0" required />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Создать цель"}</button>
    </form>
  </section>;
}
