import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useStore } from "@nanostores/react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { GoalsPage } from "@/components/pages/goals";
import { HistoryPage } from "@/components/pages/history";
import { HomePage } from "@/components/pages/home";
import { SettingsPage } from "@/components/pages/settings";
import type { PageProps } from "@/components/pages/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconAlertTriangle } from "@/components/ui/icons";
import { Toaster } from "@/components/ui/sonner";
import { AppLayout } from "@/components/widgets/app-layout";
import { Auth } from "@/components/widgets/auth";
import { OpeningSetup } from "@/components/widgets/opening-setup";
import { SyncStatus } from "@/components/widgets/sync-status";
import type { Di } from "@/lib/di";
import { easeOut } from "@/lib/motion";
import type { Page } from "@/lib/pages";

const pageComponents: Record<Page, (props: PageProps) => ReactNode> = {
  home: HomePage,
  history: HistoryPage,
  goals: GoalsPage,
  settings: SettingsPage
};

/** Fades between views; `mode="wait"` keeps one page on screen at a time. */
function ViewTransition({ viewKey, children }: { viewKey: string; children: ReactNode }) {
  const previous = useRef(viewKey);
  const shifted = previous.current !== viewKey;
  useEffect(() => { previous.current = viewKey; }, [viewKey]);
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={viewKey} initial={{ opacity: 0, y: shifted ? 6 : 0 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={easeOut}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Chooses between the sign-in forms, the first-run step and the current page. */
function AppContent({ di }: { di: Di }) {
  const authState = useStore(di.$authState);
  const accountStatus = useStore(di.$accountStatus);
  const marker = useStore(di.$authMarker);
  const page = useStore(di.$page);
  const localData = useQuery(di.getLocalData.qo());
  const PageComponent = pageComponents[page];

  if (authState === "checking") {
    return marker
      ? <><SyncStatus di={di} skeleton /><ViewTransition viewKey={page}><PageComponent di={di} skeleton /></ViewTransition></>
      : <Auth di={di} registered skeleton />;
  }
  if (authState === "setup" || authState === "login") {
    return <ViewTransition viewKey="auth"><Auth di={di} registered={authState === "login"} /></ViewTransition>;
  }
  if (authState === "error") {
    return (
      <EmptyState title="Не удалось проверить вход" description={accountStatus.error?.message} icon={<IconAlertTriangle className="size-5" />}>
        <Button className="mt-3 w-fit" onClick={() => void accountStatus.refetch()}>Повторить</Button>
      </EmptyState>
    );
  }
  return (
    <>
      <SyncStatus di={di} />
      {localData.isError
        ? <EmptyState title="Локальное хранилище недоступно" description={localData.error.message} icon={<IconAlertTriangle className="size-5" />} />
        : localData.data && !localData.data.settings
          ? <ViewTransition viewKey="opening"><OpeningSetup di={di} /></ViewTransition>
          : <ViewTransition viewKey={page}><PageComponent di={di} /></ViewTransition>}
    </>
  );
}

export default function App({ di }: { di: Di }) {
  return (
    <QueryClientProvider client={di.queryClient}>
      <MotionConfig reducedMotion="user">
        <AppLayout di={di}>
          <AppContent di={di} />
        </AppLayout>
        <Toaster position="top-center" offset={{ top: "calc(env(safe-area-inset-top) + 12px)" }} mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)" }} />
      </MotionConfig>
    </QueryClientProvider>
  );
}
