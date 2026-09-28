import { useCallback, useEffect, useState } from "react";
import { AuthPanel } from "./AuthPanel";
import { getAccountStatus, signOut } from "./authClient";
import { cardBalance, expensesByCategory, formatMoney, parseMoney } from "./finance";
import type { Author, Category, FinanceTransaction, Settings, TransactionType } from "./finance";
import { loadLocalData, saveFinanceTransaction, saveOpeningBalance } from "./localData";
import type { LocalData } from "./localData";

type Page = "home" | "history" | "goals";
type Connection = "checking" | "online" | "offline";
type AuthState = "checking" | "setup" | "login" | "authenticated" | "offline" | "error";
const AUTH_MARKER = "family-finance-authenticated";

const pages: { id: Page; label: string }[] = [
  { id: "home", label: "Главная" },
  { id: "history", label: "История" },
  { id: "goals", label: "Цели" }
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
      <p className="setup-footnote">Финансовые данные пока сохраняются только на этом устройстве. Синхронизация появится на следующем этапе.</p>
    </section>
  );
}

function QuickEntry({ categories, onSave }: {
  categories: Category[];
  onSave: (entry: FinanceTransaction) => Promise<void>;
}) {
  const [type, setType] = useState<TransactionType>("expense");
  const [categoryId, setCategoryId] = useState("expense-groceries");
  const [amount, setAmount] = useState("");
  const [occurredAtInput, setOccurredAtInput] = useState("");
  const [author, setAuthor] = useState<Author>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const availableCategories = categories.filter((category) => category.type === type)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function chooseType(nextType: TransactionType) {
    setType(nextType);
    setCategoryId(categories.find((category) => category.type === nextType)?.id ?? "");
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
        occurredAt: chosenDate.toISOString(), createdAt, author, note: note.trim(), goalId: null
      });
      setAmount("");
      setOccurredAtInput("");
      setAuthor(null);
      setNote("");
      setMessage("Запись сохранена на этом устройстве. Можно добавить следующую.");
    } catch {
      setError("Не удалось сохранить запись на устройстве. Попробуйте ещё раз.");
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
  const ordered = [...transactions].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
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

function Home({ data, onSave }: { data: LocalData; onSave: (entry: FinanceTransaction) => Promise<void> }) {
  const month = new Date();
  const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(month);
  const balance = cardBalance(data.settings!, data.transactions);
  const grouped = expensesByCategory(data.transactions, month);
  const monthlyExpenses = [...grouped.values()].reduce((sum, amount) => sum + amount, 0);
  const categoryTotals = [...grouped.entries()]
    .map(([id, amount]) => ({ id, amount, name: data.categories.find((category) => category.id === id)?.name ?? "Категория" }))
    .sort((a, b) => b.amount - a.amount);
  return (
    <>
      <section className="balance-card" aria-label="Остатки">
        <span className="eyebrow">Свободно</span>
        <strong className="balance-value">{formatMoney(balance)}</strong>
        <div className="balance-breakdown">
          <div><span>На карте</span><strong>{formatMoney(balance)}</strong></div>
          <div><span>В целях</span><strong>{formatMoney(0)}</strong></div>
        </div>
      </section>
      <QuickEntry categories={data.categories} onSave={onSave} />
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

function History({ data }: { data: LocalData }) {
  return (
    <section className="content-section top-section">
      <p className="section-intro">Все записи на этом устройстве. Выбор месяца, фильтры и исправление записей появятся на следующем этапе.</p>
      <TransactionList transactions={data.transactions} categories={data.categories} />
    </section>
  );
}

function Goals({ balance }: { balance: number }) {
  return (
    <section className="content-section top-section">
      <div className="balance-card compact-card">
        <span className="eyebrow">Свободно для целей</span><strong className="compact-value">{formatMoney(balance)}</strong>
      </div>
      <div className="empty-panel large-empty"><strong>Целей пока нет</strong><p>Выделение денег на цели появится на следующем этапе.</p></div>
    </section>
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
    void loadLocalData().then((result) => { if (active) setData(result); }).catch(() => {
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
    setData((current) => current ? { ...current, settings } : current);
  }

  async function saveEntry(entry: FinanceTransaction) {
    await saveFinanceTransaction(entry);
    setData((current) => current ? { ...current, transactions: [...current.transactions, entry] } : current);
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
          {authState === "offline" && <div className="local-notice">Нет сети. Доступны только записи на этом устройстве.</div>}
          {authState === "authenticated" && <div className="local-notice">Общий вход работает. Финансовые данные пока только на этом устройстве; синхронизация ещё не подключена.</div>}
          {authError && <p className="form-error" role="alert">{authError}</p>}
          {loadError ? <div className="empty-panel" role="alert">{loadError}</div> : !data ? <div className="empty-panel">Загружаем данные…</div> : !data.settings ? (
            <OpeningSetup onSave={saveSettings} />
          ) : (
            <>
              {page === "home" && <Home data={data} onSave={saveEntry} />}
              {page === "history" && <History data={data} />}
              {page === "goals" && <Goals balance={cardBalance(data.settings, data.transactions)} />}
            </>
          )}
          </>}
        </main>
        {(authState === "authenticated" || authState === "offline") && <Navigation page={page} onSelect={setPage} className="mobile-nav" />}
      </div>
    </div>
  );
}
