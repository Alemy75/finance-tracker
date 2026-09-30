import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({ title, id, aside, className }: {
  title: ReactNode;
  id?: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="section-heading" className={cn("mb-3 flex min-h-7 items-center justify-between gap-3", className)}>
      <h2 id={id} className="text-lg leading-7 font-bold tracking-tight">{title}</h2>
      {aside && <div className="text-[13px] text-muted-foreground">{aside}</div>}
    </div>
  );
}
