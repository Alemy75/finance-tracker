import type { Di } from "@/lib/di";

export interface SyncStatusProps {
  di: Di;
  /** Show the skeleton of the status line (the sign-in check is still running). */
  skeleton?: boolean;
}
