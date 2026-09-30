import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Dev-only: `?skeleton` draws every skeleton over its loaded content to check that they line up. */
const compareSkeletons = import.meta.env.DEV && typeof location !== "undefined" && new URLSearchParams(location.search).has("skeleton");

const stackClassName = "grid grid-cols-[minmax(0,1fr)] [&>*]:[grid-area:1/1]";
const FADE_MS = 200;

/**
 * Swaps a skeleton for its content in place. Both sit in the same grid cell, so while they cross-fade the block keeps
 * its size and nothing below it moves. The skeleton is removed by a timer rather than an animation callback, so it
 * also goes away in a background tab where animation frames do not run.
 */
export function SkeletonSwap({ loading, skeleton, children, className }: {
  loading: boolean;
  /** Rendered only while needed. */
  skeleton: () => ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [previousLoading, setPreviousLoading] = useState(loading);
  const [fadingOut, setFadingOut] = useState(false);
  const [hadSkeleton, setHadSkeleton] = useState(loading);
  if (previousLoading !== loading) {
    // Derived during render so the skeleton stays mounted in the same commit that reveals the content.
    setPreviousLoading(loading);
    setFadingOut(previousLoading && !loading);
    if (loading) setHadSkeleton(true);
  }

  useEffect(() => {
    if (!fadingOut) return;
    const timer = setTimeout(() => setFadingOut(false), FADE_MS);
    return () => clearTimeout(timer);
  }, [fadingOut]);

  if (compareSkeletons && !loading) {
    return (
      <div className={cn(stackClassName, className)}>
        <div>{children}</div>
        <div data-compare="skeleton" className="pointer-events-none opacity-60 mix-blend-multiply dark:mix-blend-screen">{skeleton()}</div>
      </div>
    );
  }
  return (
    <div className={cn(stackClassName, className)}>
      {(loading || fadingOut) && (
        <div key="skeleton" aria-hidden={!loading || undefined}
          className={cn("transition-opacity duration-200 motion-reduce:transition-none", !loading && "pointer-events-none opacity-0")}>
          {skeleton()}
        </div>
      )}
      {!loading && <div key="content" className={cn(hadSkeleton && "animate-in fade-in duration-200 motion-reduce:animate-none")}>{children}</div>}
    </div>
  );
}
