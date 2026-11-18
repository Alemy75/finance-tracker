import type { Di } from "@/lib/di";

export interface AuthProps {
  di: Di;
  /** A profile exists, so the form signs in instead of creating one. */
  registered: boolean;
  /** Show the skeleton (the sign-in check is still running). */
  skeleton?: boolean;
}
