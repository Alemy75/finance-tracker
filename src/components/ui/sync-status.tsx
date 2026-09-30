import { AnimatePresence, motion } from "motion/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconCheckCircle, IconClock, IconRefreshCw, IconWifiOff } from "@/components/ui/icons";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { easeOut } from "@/lib/motion";
import type { PendingMutation } from "@/syncTypes";

export type SyncTone = "synced" | "syncing" | "pending" | "conflict" | "offline";

const icons = {
  synced: IconCheckCircle,
  syncing: IconRefreshCw,
  pending: IconClock,
  conflict: IconAlertTriangle,
  offline: IconWifiOff
} as const;

const statusClassName = "mb-4 flex min-h-10 items-center gap-2.5 rounded-lg border border-forest-2/15 bg-lime/15 px-3.5 py-2 text-[13px] leading-snug text-forest-2 dark:border-lime/15 dark:bg-lime/[0.07] dark:text-lime";

export function SyncStatusBarSkeleton({ text }: { text: string }) {
  return (
    <div aria-hidden="true" data-sk="sync-status" className={statusClassName}>
      <IconRefreshCw className="size-4 opacity-40" />
      <span><SkeletonText sample={text} /></span>
    </div>
  );
}

export function SyncStatusBar({ tone, text }: { tone: SyncTone; text: string }) {
  const Icon = icons[tone];
  return (
    <div role="status" data-sk="sync-status" className={statusClassName}>
      <Icon className={tone === "syncing" ? "size-4 animate-spin [animation-duration:1.4s]" : "size-4"} />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={text} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={easeOut}>
          {text}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export function SyncError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive" className="mb-4">
      <IconAlertTriangle />
      <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-destructive">
        <span>{message}</span>
        <Button variant="link" size="sm" className="h-auto p-0 text-destructive dark:text-destructive" onClick={onRetry}>Повторить</Button>
      </AlertDescription>
    </Alert>
  );
}

const kindLabel: Record<PendingMutation["kind"], string> = {
  transaction: "операция",
  category: "категория",
  goalMove: "движение цели",
  goal: "цель",
  settings: "стартовый остаток"
};

export function ConflictCard({ mutation, onResolve }: {
  mutation: PendingMutation;
  onResolve: (choice: "remote" | "local") => void;
}) {
  return (
    <Alert variant="destructive" className="mb-4">
      <IconAlertTriangle />
      <AlertTitle className="line-clamp-none">Нужно решить конфликт: {kindLabel[mutation.kind] ?? "стартовый остаток"}</AlertTitle>
      <AlertDescription>
        <p>{mutation.reason}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onResolve("remote")}>Принять общую версию</Button>
          {mutation.kind !== "goal" && (
            <Button variant="outline" size="sm" onClick={() => onResolve("local")}>
              {mutation.kind === "goalMove" ? "Повторить отправку" : "Сохранить мою версию"}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
