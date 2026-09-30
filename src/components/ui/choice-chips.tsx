import { AnimatePresence, motion } from "motion/react";
import { springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

export const chipClassName = "inline-flex h-10 items-center rounded-full border px-3.5 text-sm font-medium";

export function ChoiceChips<T extends string>({ value, onChange, options, label, labelledBy, size = "default", className }: {
  value: T;
  onChange: (value: T) => void;
  options: readonly ChipOption<T>[];
  label?: string;
  labelledBy?: string;
  size?: "default" | "sm";
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} aria-labelledby={labelledBy} data-slot="choice-chips"
      className={cn("flex flex-wrap gap-2", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <motion.button key={option.value} type="button" layout="position" aria-pressed={selected}
              onClick={() => onChange(option.value)}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              whileTap={{ scale: 0.95 }} transition={springSnappy}
              className={cn(chipClassName, size === "sm" && "h-9 px-3 text-[13px]",
                "outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                selected
                  ? "border-transparent bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "border-input bg-card text-foreground/80 hover:bg-accent")}>
              {option.label}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
