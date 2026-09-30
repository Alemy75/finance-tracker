import { useStore } from "@nanostores/react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/ui/app-shell";
import { pageTitles } from "@/lib/pages";
import type { AppLayoutProps } from "./types";

/** Header, navigation and sign-out around the current page. */
export function AppLayout({ di, children }: AppLayoutProps) {
  const page = useStore(di.$page);
  const authState = useStore(di.$authState);
  const connection = useStore(di.$connection);
  const marker = useStore(di.$authMarker);
  const signOut = useMutation({
    ...di.signOut.mo(),
    onError: (error) => toast.error(error.message || "Не удалось выйти.")
  });
  const navigable = authState === "authenticated" || authState === "offline" || (authState === "checking" && Boolean(marker));

  return (
    <AppShell page={page} onSelect={(next) => di.$page.set(next)} navigable={navigable}
      title={navigable ? pageTitles[page] : "Общий профиль"} connection={connection}
      onSignOut={authState === "authenticated" ? () => signOut.mutate() : undefined} signingOut={signOut.isPending}>
      {children}
    </AppShell>
  );
}
