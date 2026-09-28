import { useCallback, useEffect, useRef, useState } from "react";
import { AuthPanel } from "./AuthPanel";
import { getAccountStatus, signOut } from "./authClient";
import { History } from "./History";
import { Goals } from "./Goals";
import { SettingsPage } from "./SettingsPage";
import { allocatedTotal, cardBalance, expensesByCategory, formatMoney, freeBalance, goalBalance, parseMoney } from "./finance";
import type { Author, Category, FinanceTransaction, Goal, GoalMove, Settings, TransactionType } from "./finance";
import { deleteFinanceTransaction, loadLocalData, loadOutbox, retryLocalVersion, saveFinanceTransaction, saveGoal, saveGoalMove, saveOpeningBalance, updateFinanceTransaction, useRemoteVersion } from "./localData";
import type { LocalData } from "./localData";
import type { PendingMutation } from "./syncTypes";
import { synchronize } from "./syncClient";

type Page = "home" | "history" | "goals" | "settings";
type Connection = "checking" | "online" | "offline";
type AuthState = "checking" | "setup" | "login" | "authenticated" | "offline" | "error";
const AUTH_MARKER = "family-finance-authenticated";

const pages: { id: Page; label: string }[] = [
  { id: "home", label: "Главная" },
  { id: "history", label: "История" },
  { id: "goals", label: "Цели" },
  { id: "settings", label: "Настройки" }
];

const transactionDate = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
});

function Navigation({ page, onSelect, className }: {
  page: Page;
  onSelect: (page: Page) => void;
  className: string;
}) {
  return (
    <nav className={className} aria-label="Разделы приложения">
      {pages.map((item) => (
        <button key={item.id} type="button" className="nav-button"
          aria-current={page === item.id ? "page" : undefined}
          onClick={() => onSelect(item.id)}>{item.label}</button>
      ))}
    </nav>
  );
}

function OpeningSetup({ onSave }: { onSave: (settings: Settings) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const openingBalanceKopeks = parseMoney(amount);
    if (openingBalanceKopeks === null) {
      setError("Введите сумму в рублях, не более двух знаков после запятой.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ id: "main", openingBalanceKopeks, startedAt: new Date().toISOString() });
    } catch {
      setError("Не удалось сохранить сумму на устройстве. Проверьте доступ к хранилищу браузера.");
      setSaving(false);
    }
  }

  return (
    <section className="setup-card">
      <span className="eyebrow">Первый шаг</span>
      <h2>Сколько сейчас на карте?</h2>
      <p>Введите текущий остаток вашей карты. Это будет точка отсчёта; дальше остаток изменят доходы и расходы.</p>
      <form onSubmit={submit}>
        <label htmlFor="opening-amount">Стартовый капитал, ₽</label>
        <input id="opening-amount" type="text" inputMode="decimal" autoComplete="off"
          placeholder="Например, 50 000" value={amount} onChange={(event) => setAmount(event.target.value)} required />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Начать учёт"}</button>
      </form>
      <p className="setup-footnote">Сумма сохранится на устройстве и после подключения появится в общем профиле.</p>
    </section>
  );
}

function QuickEntry({ data, onSave }: {
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const availableCategories = categories.filter((category) => category.type === type)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const fundedGoals = data.goals.filter((goal) => !goal.archivedAt && goalBalance(goal.id, data.goalMoves, data.transactions) > 0);

  function chooseType(nextType: TransactionType) {
    setType(nextType);
    setCategoryId(categories.find((category) => category.type === nextType)?.id ?? "");
    if (nextType === "income") setGoalId(null);
    setMessage("");
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
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
    setMessage("");
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
      setMessage("Запись сохранена на этом устройстве. Можно добавить следующую.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить запись на устройстве.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="quick-entry content-section" aria-labelledby="quick-entry-title">
      <div className="section-heading"><h2 id="quick-entry-title">Добавить запись</h2></div>
      <form className="entry-card" onSubmit={submit}>
        <div className="type-switch" role="group" aria-label="Тип операции">
          <button type="button" className={type === "expense" ? "active" : ""} aria-pressed={type === "expense"} onClick={() => chooseType("expense")}>Расход</button>
          <button type="button" className={type === "income" ? "active" : ""} aria-pressed={type === "income"} onClick={() => chooseType("income")}>Доход</button>
        </div>
        <label className="field-label" htmlFor="entry-amount">Сумма, ₽</label>
        <input id="entry-amount" className="amount-input" type="text" inputMode="decimal"
          autoComplete="off" placeholder="0" value={amount}
          onChange={(event) => { setAmount(event.target.value); setMessage(""); }} required />
        <span className="field-label" id="category-label">Категория</span>
        <div className="category-grid" role="group" aria-labelledby="category-label">
          {availableCategories.map((category) => (
            <button key={category.id} type="button"
              className={`category-chip ${categoryId === category.id ? "selected" : ""}`}
              aria-pressed={categoryId === category.id} onClick={() => setCategoryId(category.id)}>{category.name}</button>
          ))}
        </div>
        <details className="extra-fields">
          <summary>Дополнительно</summary>
          <div className="extra-fields-body">
            <label htmlFor="entry-date">Дата и время</label>
            <input id="entry-date" type="datetime-local" value={occurredAtInput} onChange={(event) => setOccurredAtInput(event.target.value)} />
            <small>Если оставить пустым, возьмём момент сохранения.</small>
            {type === "expense" && fundedGoals.length > 0 && <>
              <label htmlFor="entry-goal">Оплатить из цели</label>
              <select id="entry-goal" value={goalId ?? ""} onChange={(event) => setGoalId(event.target.value || null)}>
                <option value="">Нет, обычный расход</option>
                {fundedGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name} · {formatMoney(goalBalance(goal.id, data.goalMoves, data.transactions))}</option>)}
              </select>
            </>}
            <label htmlFor="entry-author">Кто внёс запись</label>
            <select id="entry-author" value={author ?? ""} onChange={(event) => setAuthor((event.target.value || null) as Author)}>
              <option value="">Не указано</option><option value="self">Я</option><option value="wife">Жена</option>
            </select>
            <label htmlFor="entry-note">Заметка</label>
            <textarea id="entry-note" rows={2} maxLength={500} value={note}
              onChange={(event) => setNote(event.target.value)} placeholder="Необязательно" />
          </div>
        </details>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <button className="primary-button" type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить запись"}</button>
      </form>
    </section>
  );
}

function TransactionList({ transactions, categories, limit }: {
  transactions: FinanceTransaction[]; categories: Category[]; limit?: number;
}) {
  const ordered = transactions.filter((entry) => !entry.deletedAt).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const visible = limit ? ordered.slice(0, limit) : ordered;
  if (visible.length === 0) {
    return <div className="empty-panel"><strong>Пока нет операций</strong><p>Добавьте первый доход или расход — запись появится здесь.</p></div>;
  }
  return (
    <ul className="transaction-list">
      {visible.map((transaction) => (
        <li key={transaction.id}>
          <div className="transaction-details">
            <strong>{categories.find((category) => category.id === transaction.categoryId)?.name ?? "Категория"}</strong>
            <span>{transactionDate.format(new Date(transaction.occurredAt))}{transaction.author === "self" ? " · Я" : transaction.author === "wife" ? " · Жена" : ""}</span>
            {transaction.note && <span className="transaction-note">{transaction.note}</span>}
          </div>
          <strong className={`transaction-amount ${transaction.type}`}>
            {transaction.type === "income" ? "+" : "−"}{formatMoney(transaction.amountKopeks)}
          </strong>
        </li>
      ))}
    </ul>
  );
}

function Home({ data, onSave, onGoToGoals }: { data: LocalData; onSave: (entry: FinanceTransaction) => Promise<void>; onGoToGoals: () => void }) {
  const month = new Date();
  const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(month);
  const balance = cardBalance(data.settings!, data.transactions);
  const allocated = allocatedTotal(data.goals, data.goalMoves, data.transactions);
  const free = freeBalance(data.settings!, data.goals, data.goalMoves, data.transactions);
  const grouped = expensesByCategory(data.transactions, month);
  const monthlyExpenses = [...grouped.values()].reduce((sum, amount) => sum + amount, 0);
  const categoryTotals = [...grouped.entries()]
    .map(([id, amount]) => ({ id, amount, name: data.categories.find((category) => category.id === id)?.name ?? "Категория" }))
    .sort((a, b) => b.amount - a.amount);
  return (
    <>
      <section className="balance-card" aria-label="Остатки">
        <span className="eyebrow">Свободно</span>
        <strong className="balance-value">{formatMoney(free)}</strong>
        <div className="balance-breakdown">
          <div><span>На карте</span><strong>{formatMoney(balance)}</strong></div>
          <div><span>В целях</span><strong>{formatMoney(allocated)}</strong></div>
        </div>
      </section>
      {data.goals.some((goal) => !goal.archivedAt) && <section className="content-section home-goals">
        <div className="section-heading"><h2>Цели</h2><button className="text-button" type="button" onClick={onGoToGoals}>Все цели</button></div>
        <div className="home-goal-list">{data.goals.filter((goal) => !goal.archivedAt).map((goal) => <div key={goal.id}>
          <strong>{goal.name}</strong><span>{formatMoney(goalBalance(goal.id, data.goalMoves, data.transactions))} из {formatMoney(goal.targetKopeks)}</span>
        </div>)}</div>
      </section>}
      <QuickEntry data={data} onSave={onSave} />
      <section className="content-section">
        <div className="section-heading"><h2>Расходы за месяц</h2><span>{monthLabel}</span></div>
        {categoryTotals.length ? (
          <div className="summary-card">
            <div className="summary-total"><span>Всего</span><strong>{formatMoney(monthlyExpenses)}</strong></div>
            {categoryTotals.map((category) => (
              <div className="category-total" key={category.id}><span>{category.name}</span><strong>{formatMoney(category.amount)}</strong></div>
            ))}
          </div>
        ) : (
          <div className="empty-panel"><strong>В этом месяце расходов нет</strong><p>Добавьте расход, чтобы увидеть суммы по категориям.</p></div>
        )}
      </section>
      <section className="content-section">
        <div className="section-heading"><h2>Последние записи</h2></div>
        <TransactionList transactions={data.transactions} categories={data.categories} limit={5} />
      </section>
    </>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [connection, setConnection] = useState<Connection>("checking");
  const [data, setData] = useState<LocalData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authError, setAuthError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [outbox, setOutbox] = useState<PendingMutation[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncChecked, setSyncChecked] = useState(false);
  const [syncError, setSyncError] = useState("");
  const syncRunning = useRef(false);
  const syncAgain = useRef(false);

  const requestSync = useCallback(async () => {
    if (!navigator.onLine) return;
    if (syncRunning.current) { syncAgain.current = true; return; }
    syncRunning.current = true;
    setSyncing(true);
    try {
      do {
        syncAgain.current = false;
        try {
          const result = await synchronize();
          setData(result.data);
          setOutbox(result.outbox);
          setSyncError("");
          setSyncChecked(true);
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Не удалось синхронизировать данные.";
          if (message === "Сессия завершилась. Войдите снова.") {
            localStorage.removeItem(AUTH_MARKER);
            setAuthState("login");
          }
          setSyncError(message);
          break;
        }
      } while (syncAgain.current && navigator.onLine);
    } finally {
      syncRunning.current = false;
      setSyncing(false);
    }
  }, []);

  async function handleExport() {
    if (authState !== "authenticated" || !navigator.onLine) throw new Error("Для выгрузки нужно подключение к сети и вход в профиль.");
    if (syncRunning.current) throw new Error("Дождитесь окончания синхронизации и попробуйте снова.");
    syncRunning.current = true;
    setSyncing(true);
    try {
      const result = await synchronize();
      setData(result.data);
      setOutbox(result.outbox);
      setSyncChecked(true);
      setSyncError("");
      if (result.outbox.length || (await loadOutbox()).length) {
        throw new Error("Остались изменения, которые не попали в общий профиль. Разрешите конфликты и повторите выгрузку.");
      }
      const response = await fetch("/api/export", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "Сессия завершилась. Войдите снова." : "Не удалось получить резервную копию.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `family-finance-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      syncRunning.current = false;
      setSyncing(false);
      if (syncAgain.current) void requestSync();
    }
  }

  const refreshQueueAndSync = useCallback(async () => {
    if (navigator.onLine) setSyncing(true);
    try {
      setOutbox(await loadOutbox());
      void requestSync();
    } catch {
      setSyncing(false);
      setSyncError("Изменение сохранено, но очередь не удалось прочитать. Обновите страницу.");
    }
  }, [requestSync]);

  const refreshAuth = useCallback(async (): Promise<void> => {
    try {
      const status = await getAccountStatus();
      setAuthError("");
      if (status.user) {
        localStorage.setItem(AUTH_MARKER, status.user.id);
        setAuthState("authenticated");
      } else {
        localStorage.removeItem(AUTH_MARKER);
        setAuthState(status.registered ? "login" : "setup");
      }
    } catch (cause) {
      if (!navigator.onLine && localStorage.getItem(AUTH_MARKER)) {
        setAuthState("offline");
      } else {
        setAuthError(cause instanceof Error ? cause.message : "Не удалось проверить вход.");
        setAuthState("error");
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([loadLocalData(), loadOutbox()]).then(([result, queued]) => { if (active) { setData(result); setOutbox(queued); } }).catch(() => {
      if (active) setLoadError("Не удалось открыть локальное хранилище. Проверьте настройки браузера и обновите страницу.");
    });
    async function checkConnection() {
      if (!navigator.onLine) {
        if (active) setConnection("offline");
        return;
      }
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (active) setConnection(response.ok ? "online" : "offline");
      } catch {
        if (active) setConnection("offline");
      }
    }
    void checkConnection();
    void refreshAuth();
    window.addEventListener("online", refreshAuth);
    window.addEventListener("offline", refreshAuth);
    window.addEventListener("online", checkConnection);
    window.addEventListener("offline", checkConnection);
    return () => {
      active = false;
      window.removeEventListener("online", checkConnection);
      window.removeEventListener("offline", checkConnection);
      window.removeEventListener("online", refreshAuth);
      window.removeEventListener("offline", refreshAuth);
    };
  }, [refreshAuth]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    void requestSync();
    const onVisible = () => { if (document.visibilityState === "visible") void requestSync(); };
    window.addEventListener("online", requestSync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", requestSync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authState, requestSync]);

  async function handleAuthenticated() {
    const status = await getAccountStatus();
    if (!status.user) throw new Error("Вход не подтвердился. Попробуйте ещё раз.");
    localStorage.setItem(AUTH_MARKER, status.user.id);
    setAuthState("authenticated");
  }

  async function handleSignOut() {
    setSigningOut(true);
    setAuthError("");
    try {
      await signOut();
      localStorage.removeItem(AUTH_MARKER);
      setSyncChecked(false);
      setAuthState("login");
      setPage("home");
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : "Не удалось выйти.");
    } finally {
      setSigningOut(false);
    }
  }

  async function saveSettings(settings: Settings) {
    await saveOpeningBalance(settings);
    setData((current) => current ? { ...current, settings: { ...settings, version: 1 } } : current);
    void refreshQueueAndSync();
  }

  async function saveEntry(entry: FinanceTransaction) {
    if (entry.goalId) {
      if (entry.type !== "expense" || !data?.goals.some((goal) => goal.id === entry.goalId && !goal.archivedAt)) {
        throw new Error("Выберите существующую цель для расхода.");
      }
      if (entry.amountKopeks > goalBalance(entry.goalId, data.goalMoves, data.transactions)) {
        throw new Error("На этой цели недостаточно выделенных денег.");
      }
    }
    await saveFinanceTransaction(entry);
    setData((current) => current ? { ...current, transactions: [...current.transactions, { ...entry, version: 1 }] } : current);
    void refreshQueueAndSync();
  }

  async function updateEntry(entry: FinanceTransaction) {
    if (!data) throw new Error("Данные ещё загружаются.");
    if (entry.goalId && (entry.type !== "expense" || !data.goals.some((goal) => goal.id === entry.goalId && !goal.archivedAt))) {
      throw new Error("Выберите существующую цель для расхода.");
    }
    const updatedTransactions = data.transactions.map((item) => item.id === entry.id ? entry : item);
    if (data.goals.some((goal) => goalBalance(goal.id, data.goalMoves, updatedTransactions) < 0)) {
      throw new Error("После исправления на одной из целей не хватит выделенных денег.");
    }
    const saved = await updateFinanceTransaction(entry);
    setData((current) => current ? { ...current, transactions: current.transactions.map((item) => item.id === entry.id ? saved : item) } : current);
    void refreshQueueAndSync();
  }

  async function deleteEntry(id: string) {
    const existing = data?.transactions.find((item) => item.id === id);
    if (!existing) throw new Error("Запись не найдена.");
    const deleted = { ...existing, deletedAt: new Date().toISOString() };
    const saved = await deleteFinanceTransaction(deleted);
    setData((current) => current ? { ...current, transactions: current.transactions.map((item) => item.id === id ? saved : item) } : current);
    void refreshQueueAndSync();
  }

  async function createGoal(goal: Goal) {
    await saveGoal(goal);
    setData((current) => current ? { ...current, goals: [...current.goals, { ...goal, version: 1 }] } : current);
    void refreshQueueAndSync();
  }

  async function moveGoalMoney(move: GoalMove) {
    if (!data?.settings || !data.goals.some((goal) => goal.id === move.goalId && !goal.archivedAt)) {
      throw new Error("Цель не найдена.");
    }
    if (move.amountKopeks > 0 && move.amountKopeks > freeBalance(data.settings, data.goals, data.goalMoves, data.transactions)) {
      throw new Error("Свободных денег для этой суммы недостаточно.");
    }
    if (move.amountKopeks < 0 && -move.amountKopeks > goalBalance(move.goalId, data.goalMoves, data.transactions)) {
      throw new Error("Нельзя вернуть больше, чем выделено на цель.");
    }
    await saveGoalMove(move);
    setData((current) => current ? { ...current, goalMoves: [...current.goalMoves, move] } : current);
    void refreshQueueAndSync();
  }

  async function resolveConflict(mutation: PendingMutation, choice: "remote" | "local") {
    try {
      if (choice === "remote") await useRemoteVersion(mutation);
      else await retryLocalVersion(mutation);
      setData(await loadLocalData());
      void refreshQueueAndSync();
    } catch {
      setSyncError("Не удалось применить решение. Обновите страницу и попробуйте ещё раз.");
    }
  }

  const title = pages.find((item) => item.id === page)?.label ?? "Главная";
  const connectionText = connection === "online" ? "Сеть есть" : connection === "offline" ? "Нет сети" : "Проверка связи";
  return (
    <div className="app-layout">
      <aside className="desktop-sidebar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">₽</span><span>Семейные финансы</span></div>
        {(authState === "authenticated" || authState === "offline") && <Navigation page={page} onSelect={setPage} className="desktop-nav" />}
      </aside>
      <div className="app-main">
        <header className="app-header">
          <div><span className="eyebrow">Семейные финансы</span><h1>{authState === "authenticated" || authState === "offline" ? title : "Общий профиль"}</h1></div>
          <div className="header-actions">
            <div className={`connection ${connection}`} role="status"><span className="connection-dot" aria-hidden="true" />{connectionText}</div>
            {authState === "authenticated" && <button className="signout-button" type="button" onClick={handleSignOut} disabled={signingOut}>{signingOut ? "Выходим…" : "Выйти"}</button>}
          </div>
        </header>
        <main className="page-content">
          {authState === "checking" ? <div className="empty-panel">Проверяем вход…</div>
            : authState === "setup" || authState === "login" ? <AuthPanel registered={authState === "login"} onAuthenticated={handleAuthenticated} />
            : authState === "error" ? <div className="empty-panel" role="alert"><p>{authError}</p><button className="primary-button" type="button" onClick={() => void refreshAuth()}>Повторить</button></div>
            : <>
          {authState === "offline" && <div className="local-notice" role="status">Нет сети. Изменения сохраняются на устройстве и отправятся при подключении. Ожидают отправки: {outbox.length}.</div>}
          {authState === "authenticated" && <div className="local-notice" role="status">{!syncChecked ? "Проверяем общие данные…" : syncing ? "Синхронизация…" : outbox.some((item) => item.state === "conflict") ? "Есть изменения, требующие вашего решения." : outbox.length > 0 ? `Ожидают отправки: ${outbox.length}` : "Все изменения синхронизированы."}</div>}
          {syncError && authState === "authenticated" && <div className="sync-error" role="alert">{syncError} <button type="button" onClick={() => void requestSync()}>Повторить</button></div>}
          {outbox.filter((item) => item.state === "conflict").map((item) => <div className="sync-conflict" key={item.id}>
            <strong>Нужно решить конфликт: {item.kind === "transaction" ? "операция" : item.kind === "goalMove" ? "движение цели" : item.kind === "goal" ? "цель" : "стартовый остаток"}</strong>
            <p>{item.reason}</p>
            <div className="sync-conflict-actions">
              <button type="button" onClick={() => void resolveConflict(item, "remote")}>Принять общую версию</button>
              {item.kind !== "goal" && <button type="button" onClick={() => void resolveConflict(item, "local")}>{item.kind === "goalMove" ? "Повторить отправку" : "Сохранить мою версию"}</button>}
            </div>
          </div>)}
          {authError && <p className="form-error" role="alert">{authError}</p>}
          {loadError ? <div className="empty-panel" role="alert">{loadError}</div> : !data ? <div className="empty-panel">Загружаем данные…</div> : !data.settings ? (
            <OpeningSetup onSave={saveSettings} />
          ) : (
            <>
              {page === "home" && <Home data={data} onSave={saveEntry} onGoToGoals={() => setPage("goals")} />}
              {page === "history" && <History data={data} onUpdate={updateEntry} onDelete={deleteEntry} />}
              {page === "goals" && <Goals data={data} onCreate={createGoal} onMove={moveGoalMoney} />}
              {page === "settings" && <SettingsPage online={authState === "authenticated" && connection === "online"} syncing={syncing} onExport={handleExport} />}
            </>
          )}
          </>}
        </main>
        {(authState === "authenticated" || authState === "offline") && <Navigation page={page} onSelect={setPage} className="mobile-nav" />}
      </div>
    </div>
  );
}
