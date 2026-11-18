import type { ReactNode } from "react";
import type { Di } from "@/lib/di";

export interface AppLayoutProps {
  di: Di;
  children: ReactNode;
}
