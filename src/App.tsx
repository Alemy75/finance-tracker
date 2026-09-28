import { useEffect, useState } from "react";

type Page = "home" | "history" | "goals";
type Connection = "checking" | "online" | "offline";

const pages: { id: Page; label: string }[] = [
  { id: "home", label: "Главная" },
  { id: "history", label: "История" },
  { id: "goals", label: "Цели" }
];

function Navigation({ page, onSelect, className }: {
  page: Page;
  onSelect: (page: Page) => void;
  className: string;
}) {
  return (
    <nav className={className} aria-label="Разделы приложения">
      {pages.map((item) => (
        <button
          key={item.id}
          type="button"
          className="nav-button"
          aria-current={page === item.id ? "page" : undefined}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function Home() {
  const month = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(new Date());

  return (
    <>
      <section className="balance-card" aria-label="Остатки">
        <span className="eyebrow">Свободно</span>
        <strong className="balance-value">— ₽</strong>
        <div className="balance-breakdown">
          <div><span>На карте</span><strong>— ₽</strong></div>
          <div><span>В целях</span><strong>— ₽</strong></div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading"><h2>Расходы</h2><span>{month}</span></div>
        <div className="empty-panel">
          <strong>Пока нет операций</strong>
          <p>Здесь появятся расходы по категориям после начала учёта.</p>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading"><h2>Цели</h2></div>
        <div className="empty-panel">
          <strong>Целей пока нет</strong>
          <p>Вы сможете выделять деньги на цели, не меняя остаток карты.</p>
        </div>
      </section>
    </>
  );
}

function History() {
  return (
    <section className="content-section top-section">
      <div className="segment" aria-label="Вид истории">
        <span className="selected-segment">Операции</span>
        <span>Категории</span>
      </div>
      <div className="empty-panel large-empty">
        <strong>История пока пуста</strong>
        <p>Доходы и расходы будут сгруппированы по дате, а отчёт — по категориям.</p>
      </div>
    </section>
  );
}

function Goals() {
  return (
    <section className="content-section top-section">
      <div className="balance-card compact-card">
        <span className="eyebrow">Свободно для целей</span>
        <strong className="compact-value">— ₽</strong>
      </div>
      <div className="empty-panel large-empty">
        <strong>Целей пока нет</strong>
        <p>Прогресс накоплений и выделенная сумма появятся здесь.</p>
      </div>
    </section>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [connection, setConnection] = useState<Connection>("checking");

  useEffect(() => {
    let active = true;

    async function checkConnection() {
      if (!navigator.onLine) {
        setConnection("offline");
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
    window.addEventListener("online", checkConnection);
    window.addEventListener("offline", checkConnection);
    return () => {
      active = false;
      window.removeEventListener("online", checkConnection);
      window.removeEventListener("offline", checkConnection);
    };
  }, []);

  const title = pages.find((item) => item.id === page)?.label ?? "Главная";
  const connectionText = connection === "online" ? "Подключено" : connection === "offline" ? "Нет связи" : "Проверка связи";

  return (
    <div className="app-layout">
      <aside className="desktop-sidebar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">₽</span><span>Семейные финансы</span></div>
        <Navigation page={page} onSelect={setPage} className="desktop-nav" />
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div>
            <span className="eyebrow">Семейные финансы</span>
            <h1>{title}</h1>
          </div>
          <div className={`connection ${connection}`} role="status">
            <span className="connection-dot" aria-hidden="true" />{connectionText}
          </div>
        </header>

        <main className="page-content">
          {page === "home" && <Home />}
          {page === "history" && <History />}
          {page === "goals" && <Goals />}
        </main>

        <Navigation page={page} onSelect={setPage} className="mobile-nav" />
      </div>
    </div>
  );
}
