import type { Di } from "@/lib/di";

export interface PageProps {
  di: Di;
  /** Every widget shows its skeleton (the sign-in check is still running). */
  skeleton?: boolean;
}
