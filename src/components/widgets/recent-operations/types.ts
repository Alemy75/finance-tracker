import type { Di } from "@/lib/di";

export interface RecentOperationsProps {
  di: Di;
  /** Show the skeleton even when data is ready (the page is waiting for the sign-in check). */
  skeleton?: boolean;
}
