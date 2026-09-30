import { AnimatedProgress } from "@/components/ui/animated-progress";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { formatMoney } from "@/finance";
import type { Goal } from "@/finance";

export function goalProgress(allocated: number, target: number): number {
  return Math.min(100, Math.max(0, Math.round(allocated / target * 100)));
}

/** Compact goal row for the home screen. */
export function GoalSummaryRow({ goal, allocated, skeleton = false }: { goal: Goal; allocated: number; skeleton?: boolean }) {
  const text = (value: string) => skeleton ? <SkeletonText sample={value} /> : value;
  const progress = goalProgress(allocated, goal.targetKopeks);
  return (
    <div className="rounded-lg border bg-card px-4 py-3 shadow-xs" data-sk="goal-summary">
      <div className="flex items-baseline justify-between gap-3 text-[13px] leading-5">
        <strong className="min-w-0 font-semibold">{text(goal.name)}</strong>
        <span className="tabular text-right text-muted-foreground">{text(`${formatMoney(allocated)} из ${formatMoney(goal.targetKopeks)}`)}</span>
      </div>
      {skeleton ? <div className="mt-2.5 h-1.5 rounded-full bg-muted" />
        : <AnimatedProgress value={progress} label={`Прогресс цели ${goal.name}`} className="mt-2.5 h-1.5" />}
    </div>
  );
}
