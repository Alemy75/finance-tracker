import type { Transition } from "motion/react";

export const springSnappy: Transition = { type: "spring", stiffness: 520, damping: 40, mass: 0.9 };
export const springSoft: Transition = { type: "spring", stiffness: 180, damping: 26 };
export const easeOut: Transition = { duration: 0.18, ease: [0.22, 1, 0.36, 1] };

export const collapse = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 }
} as const;
