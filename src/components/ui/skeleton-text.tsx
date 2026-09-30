import { cn } from "@/lib/utils";

/**
 * Placeholder for a text leaf. The sample string stays in the flow in transparent ink, so line boxes, wrapping and
 * baselines are exactly those of the real text; each line fragment gets its own shimmering bar.
 */
export function SkeletonText({ sample, tone = "default", className }: {
  sample: string;
  tone?: "default" | "inverse";
  className?: string;
}) {
  return (
    <span aria-hidden="true" data-slot="skeleton-text"
      className={cn("skeleton-ink rounded-[0.3em] box-decoration-clone text-transparent select-none", tone === "inverse" && "skeleton-ink-inverse", className)}>
      {sample}
    </span>
  );
}
