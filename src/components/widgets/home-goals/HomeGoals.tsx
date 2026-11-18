import { Button } from "@/components/ui/button";
import { GoalSummaryRow } from "@/components/ui/goal-summary-row";
import { IconChevronRight } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { goalBalance } from "@/finance";
import { useLocalData } from "@/hooks/use-local-data";
import type { LocalData } from "@/services/local-db";
import type { HomeGoalsProps } from "./types";

function GoalRows({ data, skeleton = false }: { data: LocalData; skeleton?: boolean }) {
  return (
    <div className="grid gap-2">
      {data.goals.filter((goal) => !goal.archivedAt).map((goal) => (
        <GoalSummaryRow key={goal.id} skeleton={skeleton} goal={goal} allocated={goalBalance(goal.id, data.goalMoves, data.transactions)} />
      ))}
    </div>
  );
}

/** Active goals with their progress; renders nothing when there are none. */
export function HomeGoals({ di, skeleton = false }: HomeGoalsProps) {
  const data = useLocalData(di);
  if (!data?.goals.some((goal) => !goal.archivedAt)) return null;
  return (
    <SkeletonSwap loading={skeleton} skeleton={() => (
      <section data-sk="home-goals" aria-hidden="true">
        <SectionHeading title={<SkeletonText sample="Цели" />}
          aside={<span className="inline-flex h-7 items-center gap-1.5 text-sm font-semibold"><SkeletonText sample="Все цели" /><span className="size-4" /></span>} />
        <GoalRows data={data} skeleton />
      </section>
    )}>
      <section data-sk="home-goals">
        <SectionHeading title="Цели" aside={
          <Button variant="link" size="sm" className="h-7 px-0" onClick={() => di.$page.set("goals")}>Все цели<IconChevronRight /></Button>
        } />
        <GoalRows data={data} />
      </section>
    </SkeletonSwap>
  );
}
