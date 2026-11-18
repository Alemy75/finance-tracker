import type { Di } from "@/lib/di";

export interface BalanceProps {
  di: Di;
  /** Show the skeleton even when data is ready (the page is waiting for the sign-in check). */
  skeleton?: boolean;
  size?: "hero" | "compact";
  className?: string;
}
