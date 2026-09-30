import { motion } from "motion/react";
import { springSoft } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function AnimatedProgress({ value, label, className }: { value: number; label: string; className?: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}
      data-slot="progress" className={cn("h-2 overflow-hidden rounded-full bg-muted", className)}>
      <motion.div className="h-full rounded-full gradient-progress" initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }} transition={springSoft} />
    </div>
  );
}
