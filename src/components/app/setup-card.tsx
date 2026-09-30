import type { ReactNode } from "react";
import { BrandMark } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { SkeletonText } from "@/components/ui/skeleton-text";

/** Card for one-time flows (sign in, opening balance). With `skeleton` its texts become placeholders. */
export function SetupCard({ eyebrow, title, description, footnote, skeleton = false, children }: {
  eyebrow: string;
  title: string;
  description: string;
  footnote: string;
  skeleton?: boolean;
  children: ReactNode;
}) {
  const text = (value: string) => skeleton ? <SkeletonText sample={value} /> : value;
  return (
    <Card className="mt-3 max-w-lg gap-0 p-6" data-sk="setup-card" aria-hidden={skeleton || undefined}>
      <div className="flex items-center gap-3">
        {skeleton ? <span className="size-9 rounded-[11px] bg-skeleton skeleton-ink" /> : <BrandMark />}
        <span className="text-[13px] font-semibold text-muted-foreground">{text(eyebrow)}</span>
      </div>
      <h2 className="mt-5 text-[26px] leading-8 font-extrabold tracking-tight">{text(title)}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text(description)}</p>
      <div className="mt-6">{children}</div>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{text(footnote)}</p>
    </Card>
  );
}
