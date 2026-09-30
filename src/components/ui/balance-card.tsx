import { AnimatedMoney } from "@/components/ui/animated-money";
import { IconCreditCard, IconTarget } from "@/components/ui/icons";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { formatMoney } from "@/finance";
import { cn } from "@/lib/utils";

export interface BalanceValues {
  free: number;
  balance: number;
  allocated: number;
}

const sampleValues: BalanceValues = { free: 8_432_000, balance: 12_000_000, allocated: 3_568_000 };

/** Hero balance card. With `skeleton` the amounts become placeholders of the same size. */
export function BalanceCard({ values, skeleton = false, size = "hero", className }: {
  values?: BalanceValues;
  skeleton?: boolean;
  size?: "hero" | "compact";
  className?: string;
}) {
  const hero = size === "hero";
  const shown = values ?? sampleValues;
  const money = (key: keyof BalanceValues) => skeleton || !values
    ? <SkeletonText sample={formatMoney(shown[key])} tone="inverse" />
    : <AnimatedMoney value={values[key]} />;
  return (
    <section aria-label="Остатки" data-sk="balance"
      className={cn("relative overflow-hidden rounded-2xl gradient-forest p-5 text-on-forest shadow-lg shadow-forest/20 ring-1 ring-white/5", className)}>
      <span className="text-[13px] font-medium text-on-forest-muted">Свободно</span>
      <strong className={cn("mt-1 block font-extrabold tracking-[-0.035em]", hero ? "text-[40px] leading-[48px]" : "text-[30px] leading-9")}>
        {money("free")}
      </strong>
      <div className={cn("flex justify-between gap-4 border-t border-white/12 pt-4", hero ? "mt-5" : "mt-4")}>
        <div className="grid gap-1">
          <span className="flex items-center gap-1.5 text-[13px] text-on-forest-muted"><IconCreditCard className="size-3.5" />На карте</span>
          <strong className="text-base leading-6 font-bold">{money("balance")}</strong>
        </div>
        <div className="grid justify-items-end gap-1 text-right">
          <span className="flex items-center gap-1.5 text-[13px] text-on-forest-muted"><IconTarget className="size-3.5" />В целях</span>
          <strong className="text-base leading-6 font-bold">{money("allocated")}</strong>
        </div>
      </div>
    </section>
  );
}
