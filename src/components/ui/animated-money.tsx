import { useEffect } from "react";
import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { formatMoney } from "@/finance";
import { cn } from "@/lib/utils";

/** Money amount in kopeks that glides to a new value instead of jumping. */
export function AnimatedMoney({ value, prefix = "", className }: { value: number; prefix?: string; className?: string }) {
  const reduceMotion = useReducedMotion();
  const spring = useSpring(value, { stiffness: 120, damping: 22, mass: 0.9 });
  const text = useTransform(spring, (current) => prefix + formatMoney(Math.round(current)));

  useEffect(() => {
    if (reduceMotion) spring.jump(value);
    else spring.set(value);
  }, [reduceMotion, spring, value]);

  return <motion.span className={cn("tabular", className)} aria-label={prefix + formatMoney(value)}>{text}</motion.span>;
}
