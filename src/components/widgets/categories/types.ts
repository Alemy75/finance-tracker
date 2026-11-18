import type { TransactionType } from "@/finance";
import type { Di } from "@/lib/di";

export interface CategoriesProps {
  di: Di;
  type: TransactionType;
  /** Show the skeleton even when data is ready (the page is waiting for the sign-in check). */
  skeleton?: boolean;
}
