import type { ReactNode } from "react";
import { IconInbox } from "@/components/ui/icons";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, icon, skeleton = false, className, children }: {
  title: string;
  description?: string;
  icon?: ReactNode;
  skeleton?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const text = (value: string) => skeleton ? <SkeletonText sample={value} /> : value;
  return (
    <div data-slot="empty-state" data-sk="empty-state" aria-hidden={skeleton || undefined}
      className={cn("flex items-start gap-4 rounded-xl border border-dashed border-input bg-card/60 p-5", className)}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", skeleton ? "skeleton-shimmer bg-skeleton" : "bg-muted text-muted-foreground")}>
        {!skeleton && (icon ?? <IconInbox className="size-5" />)}
      </span>
      <div className="grid min-w-0 gap-1">
        <strong className="text-[15px] leading-snug font-bold">{text(title)}</strong>
        {description && <p className="max-w-[45ch] text-sm leading-relaxed text-muted-foreground">{text(description)}</p>}
        {children}
      </div>
    </div>
  );
}
