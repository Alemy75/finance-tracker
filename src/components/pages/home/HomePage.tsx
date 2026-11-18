import type { PageProps } from "@/components/pages/types";
import { Balance } from "@/components/widgets/balance";
import { CashSetup } from "@/components/widgets/cash-setup";
import { HomeGoals } from "@/components/widgets/home-goals";
import { MonthExpenses } from "@/components/widgets/month-expenses";
import { QuickEntry } from "@/components/widgets/quick-entry";
import { RecentOperations } from "@/components/widgets/recent-operations";

export function HomePage({ di, skeleton }: PageProps) {
  return (
    <div className="flex flex-col gap-7">
      <Balance di={di} skeleton={skeleton} />
      <CashSetup di={di} skeleton={skeleton} />
      <HomeGoals di={di} skeleton={skeleton} />
      <QuickEntry di={di} skeleton={skeleton} />
      <MonthExpenses di={di} skeleton={skeleton} />
      <RecentOperations di={di} skeleton={skeleton} />
    </div>
  );
}
