import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function MoneyInput({ className, size = "default", ...props }: Omit<ComponentProps<"input">, "size"> & {
  size?: "default" | "lg";
}) {
  return (
    <div data-slot="money-input" className="relative">
      <Input type="text" inputMode="decimal" autoComplete="off" {...props}
        className={cn("tabular pr-10", size === "lg" && "h-16 pr-12 text-[28px] font-bold tracking-tight", className)} />
      <span aria-hidden="true" className={cn("pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 font-semibold text-muted-foreground",
        size === "lg" ? "text-2xl" : "text-base")}>₽</span>
    </div>
  );
}
