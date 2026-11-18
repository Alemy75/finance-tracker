import { AnimatePresence, motion } from "motion/react";
import { GoalCard, GoalCardSkeleton } from "@/components/smart/goal-card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTarget } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { goalBalance } from "@/finance";
import { useLocalData } from "@/hooks/use-local-data";
import { easeOut } from "@/lib/motion";
import type { GoalsProps } from "./types";

const empty = { title: "Целей пока нет", description: "Создайте цель и выделяйте на неё деньги с карты." };

/** Active goals with their progress and money moves. */
export function Goals({ di, skeleton = false, className }: GoalsProps) {
  const data = useLocalData(di);
  const goals = data?.goals.filter((goal) => !goal.archivedAt) ?? [];
  const allocated = (id: string) => data ? goalBalance(id, data.goalMoves, data.transactions) : 0;
  return (
    <SkeletonSwap className={className} loading={skeleton || !data} skeleton={() => (
      <section aria-hidden="true">
        <SectionHeading title={<SkeletonText sample="Мои цели" />} />
        {goals.length > 0
          ? <div className="grid gap-3">{goals.map((goal) => <GoalCardSkeleton key={goal.id} goal={goal} allocated={allocated(goal.id)} />)}</div>
          : <EmptyState skeleton {...empty} />}
      </section>
    )}>
      <section>
        <SectionHeading title="Мои цели" />
        {goals.length === 0 ? <EmptyState icon={<IconTarget className="size-5" />} {...empty} /> : (
          <div className="grid gap-3">
            <AnimatePresence initial={false}>
              {goals.map((goal) => (
                <motion.div key={goal.id} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={easeOut}>
                  <GoalCard di={di} goal={goal} allocated={allocated(goal.id)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </SkeletonSwap>
  );
}
