import type { Di } from "@/lib/di";

export interface BackupProps {
  di: Di;
  /** Show the skeleton (the page is waiting for the sign-in check). */
  skeleton?: boolean;
}
