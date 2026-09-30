import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { AppShell } from "@/components/app/app-shell";
import type { Connection } from "@/components/app/app-shell";
import { pages } from "@/components/app/navigation";
import type { Page } from "@/components/app/navigation";
import { ConflictCard, SyncError, SyncStatus, SyncStatusSkeleton } from "@/components/app/sync-status";
import type { SyncTone } from "@/components/app/sync-status";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormError } from "@/components/ui/field";
import { IconAlertTriangle } from "@/components/ui/icons";
import { Toaster } from "@/components/ui/sonner";
import { easeOut } from "@/lib/motion";
import { getAccountStatus, signOut } from "./authClient";
import { freeBalance, goalBalance } from "./finance";
import type { Goal, GoalMove, FinanceTransaction, Settings, TransactionType } from "./finance";
import { deleteFinanceTransaction, loadLocalData, loadOutbox, renameCategory, retryLocalVersion, saveCategory, saveFinanceTransaction, saveGoal, saveGoalMove, saveOpeningBalance, updateFinanceTransaction, useRemoteVersion } from "./localData";
import type { LocalData } from "./localData";
import type { PendingMutation } from "./syncTypes";
import { synchronize } from "./syncClient";
import { AuthPanel, AuthSkeleton } from "@/screens/auth";
import { Goals, GoalsSkeleton } from "@/screens/goals";
import { History, HistorySkeleton } from "@/screens/history";
import { Home, HomeSkeleton } from "@/screens/home";
import { OpeningSetup } from "@/screens/opening-setup";
import { SettingsPage, SettingsSkeleton } from "@/screens/settings";

type AuthState = "checking" | "setup" | "login" | "authenticated" | "offline" | "error";
/** Dev-only: `?skeleton` overlays the current page's skeleton on its content to check that they line up. */
const compareSkeleton = import.meta.env.DEV && new URLSearchParams(location.search).has("skeleton");
const AUTH_MARKER = "family-finance-authenticated";

function PageSkeleton({ page, data }: { page: Page; data: LocalData | null }) {
  if (page === "history") return <HistorySkeleton data={data} />;
  if (page === "goals") return <GoalsSkeleton data={data} />;
  if (page === "settings") return <SettingsSkeleton categories={data?.categories ?? null} />;
  return <HomeSkeleton data={data} />;
}

/** Fades between views; a skeleton is replaced in place so the content lands exactly where its placeholder was. */
function ViewTransition({ viewKey, children }: { viewKey: string; children: React.ReactNode }) {
  const previous = useRef(viewKey);
  const fromSkeleton = previous.current.startsWith("skeleton");
  useEffect(() => { previous.current = viewKey; }, [viewKey]);
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={viewKey} initial={{ opacity: 0, y: fromSkeleton ? 0 : 6 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={easeOut}>
        {children}
      </motion.div>
    </AnimatePresence>
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

  function checkedCategoryName(type: TransactionType, name: string, exceptId?: string): string {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80) throw new Error("Название категории должно содержать от 1 до 80 символов.");
    if (data?.categories.some((item) => item.type === type && item.id !== exceptId
      && item.name.toLocaleLowerCase("ru-RU") === trimmed.toLocaleLowerCase("ru-RU"))) {
      throw new Error("Категория с таким названием уже есть.");
    }
    return trimmed;
  }

  async function createCategory(type: TransactionType, name: string) {
    if (!data) throw new Error("Данные ещё загружаются.");
    const saved = await saveCategory({ id: crypto.randomUUID(), type, name: checkedCategoryName(type, name),
      sortOrder: Math.max(-1, ...data.categories.filter((item) => item.type === type).map((item) => item.sortOrder)) + 1 });
    setData((current) => current ? { ...current, categories: [...current.categories, saved] } : current);
    void refreshQueueAndSync();
  }

  async function renameCategoryName(id: string, name: string) {
    const existing = data?.categories.find((item) => item.id === id);
    if (!existing) throw new Error("Категория не найдена.");
    const checked = checkedCategoryName(existing.type, name, id);
    if (checked === existing.name) return;
    const saved = await renameCategory({ ...existing, name: checked });
    setData((current) => current ? { ...current, categories: current.categories.map((item) => item.id === id ? saved : item) } : current);
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

  const expectSignedIn = authState === "checking" && Boolean(localStorage.getItem(AUTH_MARKER));
  const navigable = authState === "authenticated" || authState === "offline" || expectSignedIn;
  const title = navigable ? pages.find((item) => item.id === page)?.label ?? "Главная" : "Общий профиль";
  const conflicts = outbox.filter((item) => item.state === "conflict");
  const syncTone: SyncTone = !syncChecked || syncing ? "syncing" : conflicts.length ? "conflict" : outbox.length ? "pending" : "synced";
  const syncText = !syncChecked ? "Проверяем общие данные…" : syncing ? "Синхронизация…" : conflicts.length ? "Есть изменения, требующие вашего решения." : outbox.length > 0 ? `Ожидают отправки: ${outbox.length}` : "Все изменения синхронизированы.";

  let viewKey: string;
  let view: React.ReactNode;
  if (authState === "checking") {
    viewKey = expectSignedIn ? `skeleton-${page}` : "skeleton-auth";
    view = expectSignedIn ? <PageSkeleton page={page} data={data} /> : <AuthSkeleton />;
  } else if (authState === "setup" || authState === "login") {
    viewKey = "auth";
    view = <AuthPanel registered={authState === "login"} onAuthenticated={handleAuthenticated} />;
  } else if (authState === "error") {
    viewKey = "auth-error";
    view = (
      <EmptyState title="Не удалось проверить вход" description={authError} icon={<IconAlertTriangle className="size-5" />}>
        <Button className="mt-3 w-fit" onClick={() => void refreshAuth()}>Повторить</Button>
      </EmptyState>
    );
  } else if (loadError) {
    viewKey = "load-error";
    view = <EmptyState title="Локальное хранилище недоступно" description={loadError} icon={<IconAlertTriangle className="size-5" />} />;
  } else if (!data) {
    viewKey = `skeleton-${page}`;
    view = <PageSkeleton page={page} data={null} />;
  } else if (!data.settings) {
    viewKey = "opening";
    view = <OpeningSetup onSave={saveSettings} />;
  } else {
    viewKey = page;
    view = page === "home" ? <Home data={data} onSave={saveEntry} onGoToGoals={() => setPage("goals")} />
      : page === "history" ? <History data={data} onUpdate={updateEntry} onDelete={deleteEntry} />
      : page === "goals" ? <Goals data={data} onCreate={createGoal} onMove={moveGoalMoney} />
      : <SettingsPage categories={data.categories} online={authState === "authenticated" && connection === "online"}
        syncing={syncing} onCreateCategory={createCategory} onRenameCategory={renameCategoryName} onExport={handleExport} />;
  }

  return (
    <MotionConfig reducedMotion="user">
      <AppShell page={page} onSelect={setPage} navigable={navigable} title={title}
        connection={connection} onSignOut={authState === "authenticated" ? handleSignOut : undefined} signingOut={signingOut}>
        {authState === "offline" && <SyncStatus tone="offline" text={`Нет сети. Изменения сохраняются на устройстве и отправятся при подключении. Ожидают отправки: ${outbox.length}.`} />}
        {authState === "authenticated" && <SyncStatus tone={syncTone} text={syncText} />}
        {expectSignedIn && <SyncStatusSkeleton text="Проверяем общие данные…" />}
        {syncError && authState === "authenticated" && <SyncError message={syncError} onRetry={() => void requestSync()} />}
        {conflicts.map((item) => <ConflictCard key={item.id} mutation={item} onResolve={(choice) => void resolveConflict(item, choice)} />)}
        {authError && authState !== "error" && <div className="mb-4"><FormError message={authError} /></div>}
        {compareSkeleton && data?.settings && navigable ? (
          <div className="relative flow-root">
            {view}
            <div data-compare="skeleton" className="pointer-events-none absolute inset-x-0 top-0 opacity-60 mix-blend-multiply dark:mix-blend-screen">
              <PageSkeleton page={page} data={data} />
            </div>
          </div>
        ) : <ViewTransition viewKey={viewKey}>{view}</ViewTransition>}
      </AppShell>
      <Toaster position="top-center" offset={{ top: "calc(env(safe-area-inset-top) + 12px)" }} mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)" }} />
    </MotionConfig>
  );
}
