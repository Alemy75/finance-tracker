import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { IconAlertCircle, IconCheckCircle } from "@/components/ui/icons";
import { collapse, easeOut } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function Field({ label, htmlFor, labelId, hint, className, children }: {
  label: string;
  htmlFor?: string;
  labelId?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div data-slot="field" className={cn("grid gap-2", className)}>
      {htmlFor ? <Label htmlFor={htmlFor}>{label}</Label>
        : <span id={labelId} className="text-[13px] leading-none font-semibold">{label}</span>}
      {children}
      {hint && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FormNotice({ message, tone }: { message: string; tone: "error" | "success" }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div key="notice" {...collapse} transition={easeOut} className="overflow-hidden">
          <p role={tone === "error" ? "alert" : "status"}
            className={cn("flex items-start gap-2 text-[13px] leading-snug",
              tone === "error" ? "text-destructive" : "text-income")}>
            {tone === "error" ? <IconAlertCircle className="mt-px size-4" /> : <IconCheckCircle className="mt-px size-4" />}
            <span>{message}</span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function FormError({ message }: { message: string }) {
  return <FormNotice message={message} tone="error" />;
}

export function FormSuccess({ message }: { message: string }) {
  return <FormNotice message={message} tone="success" />;
}

/** Skeleton of a `Field` with a single control of the given height class. */
export function FieldSkeleton({ label, control = "h-12" }: { label: string; control?: string }) {
  return (
    <div className="grid gap-2">
      <span className="text-[13px] leading-none font-semibold"><SkeletonText sample={label} /></span>
      <Skeleton className={control} />
    </div>
  );
}
