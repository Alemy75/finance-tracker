import { useRef } from "react";

/** Last non-null value, so an overlay keeps its content while it animates closed. */
export function useRetained<T>(value: T | null | undefined): T | null {
  const last = useRef<T | null>(null);
  if (value !== null && value !== undefined) last.current = value;
  return last.current;
}
