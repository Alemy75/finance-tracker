import type { PageProps } from "@/components/pages/types";
import { Balance } from "@/components/widgets/balance";
import { Goals } from "@/components/widgets/goals";
import { NewGoal } from "@/components/widgets/new-goal";

export function GoalsPage({ di, skeleton }: PageProps) {
  return (
    <div className="pt-3">
      <Balance di={di} skeleton={skeleton} size="compact" className="mb-7" />
      <Goals di={di} skeleton={skeleton} />
      <NewGoal di={di} skeleton={skeleton} className="mt-5" />
    </div>
  );
}
