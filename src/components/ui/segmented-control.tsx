import { useId } from "react";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function SegmentedControl<T extends string>({ value, onChange, options, label, className }: {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  label: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="group" aria-label={label} data-slot="segmented-control"
      className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button key={option.value} type="button" aria-pressed={active} onClick={() => onChange(option.value)}
            className="relative h-10 rounded-md text-sm font-semibold text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:text-foreground">
            {active && <motion.span layoutId={`segment-${id}`} transition={springSnappy} aria-hidden="true"
              className="absolute inset-0 rounded-md bg-card shadow-sm ring-1 ring-black/[0.03]" />}
            <span className="relative flex items-center justify-center gap-1.5">{option.icon}{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
