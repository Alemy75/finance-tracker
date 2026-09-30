import type { ComponentType, ReactNode } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { IconHome, IconList, IconLogOut, IconSettings, IconTarget } from "@/components/ui/icons";
import type { IconProps } from "@/components/ui/icons";
import { pageTitles } from "@/lib/pages";
import type { Page } from "@/lib/pages";
import { springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Connection } from "@/services/auth-state";

const pages: { id: Page; icon: ComponentType<IconProps> }[] = [
  { id: "home", icon: IconHome },
  { id: "history", icon: IconList },
  { id: "goals", icon: IconTarget },
  { id: "settings", icon: IconSettings }
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("grid size-9 place-items-center rounded-[11px] gradient-forest shadow-sm shadow-forest/30", className)}>
      <svg viewBox="140 120 232 276" className="size-[18px]" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="42">
        <path d="M204 142V374M204 142H274A70 70 0 0 1 274 282H164" stroke="var(--on-forest)" />
        <path d="M164 334H288" stroke="var(--lime)" />
      </svg>
    </span>
  );
}

function Navigation({ page, onSelect, variant }: { page: Page; onSelect: (page: Page) => void; variant: "desktop" | "mobile" }) {
  const desktop = variant === "desktop";
  return (
    <nav aria-label="Разделы приложения"
      className={desktop ? "grid gap-1"
        : "fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 border-t bg-card/85 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-xl backdrop-saturate-150 min-[760px]:hidden"}>
      {pages.map((item) => {
        const active = page === item.id;
        const Icon = item.icon;
        return (
          <button key={item.id} type="button" aria-current={active ? "page" : undefined} onClick={() => onSelect(item.id)}
            className={cn("relative rounded-lg outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
              desktop ? "flex h-11 items-center gap-3 px-3.5 text-sm font-semibold" : "flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {active && <motion.span layoutId={`nav-${variant}`} transition={springSnappy} aria-hidden="true"
              className={cn("absolute inset-0 rounded-lg", desktop ? "bg-accent" : "bg-muted")} />}
            <Icon className={cn("relative", desktop ? "size-[18px]" : "size-5")} strokeWidth={active ? 2.3 : 2} />
            <span className="relative">{pageTitles[item.id]}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function ConnectionBadge({ connection }: { connection: Connection }) {
  const text = connection === "online" ? "Сеть есть" : connection === "offline" ? "Нет сети" : "Проверка связи";
  return (
    <div role="status" className="inline-flex h-8 items-center gap-2 rounded-full border bg-card/70 px-3 text-xs font-medium whitespace-nowrap text-muted-foreground">
      <span aria-hidden="true" className={cn("size-2 rounded-full transition-colors",
        connection === "online" ? "bg-income" : connection === "offline" ? "bg-destructive" : "animate-pulse bg-muted-foreground/50")} />
      {text}
    </div>
  );
}

export function AppShell({ page, onSelect, navigable, title, connection, onSignOut, signingOut, children }: {
  page: Page;
  onSelect: (page: Page) => void;
  navigable: boolean;
  title: string;
  connection: Connection;
  onSignOut?: () => void;
  signingOut: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh min-[760px]:grid min-[760px]:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden min-[760px]:sticky min-[760px]:top-0 min-[760px]:block min-[760px]:h-dvh min-[760px]:border-r min-[760px]:bg-card/60 min-[760px]:px-4 min-[760px]:py-7 min-[760px]:backdrop-blur">
        <div className="mb-9 flex items-center gap-3 px-1.5 text-base font-bold tracking-tight"><BrandMark /><span>Семейные финансы</span></div>
        {navigable && <Navigation page={page} onSelect={onSelect} variant="desktop" />}
      </aside>
      <div className={cn("min-h-dvh min-[760px]:pb-0", navigable ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]" : "pb-8")}>
        <header className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-4 min-[760px]:pt-9">
          <div className="min-w-0">
            <span className="text-[13px] font-medium text-muted-foreground">Семейные финансы</span>
            <h1 className="mt-0.5 text-2xl leading-8 font-extrabold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionBadge connection={connection} />
            {onSignOut && (
              <Button variant="ghost" size="sm" onClick={onSignOut} disabled={signingOut} className="text-muted-foreground">
                <IconLogOut /><span className="max-[420px]:sr-only">{signingOut ? "Выходим…" : "Выйти"}</span>
              </Button>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-5 pb-8">{children}</main>
      </div>
      {navigable && <Navigation page={page} onSelect={onSelect} variant="mobile" />}
    </div>
  );
}
