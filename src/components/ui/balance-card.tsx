import type { ComponentType } from "react";
import { AnimatedMoney } from "@/components/ui/animated-money";
import { IconCreditCard, IconPocket, IconTarget } from "@/components/ui/icons";
import type { IconProps } from "@/components/ui/icons";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { formatMoney } from "@/finance";
import { cn } from "@/lib/utils";

export interface BalanceValues {
  free: number;
  card: number;
  cash: number;
  allocated: number;
}

const sampleValues: BalanceValues = { free: 8_432_000, card: 11_000_000, cash: 1_000_000, allocated: 3_568_000 };

const rows: { key: Exclude<keyof BalanceValues, "free">; label: string; icon: ComponentType<IconProps> }[] = [
  { key: "card", label: "На карте", icon: IconCreditCard },
  { key: "cash", label: "Наличные", icon: IconPocket },
  { key: "allocated", label: "В целях", icon: IconTarget }
];

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
      <dl className={cn("grid gap-2 border-t border-white/12 pt-4", hero ? "mt-5" : "mt-4")}>
        {rows.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-baseline justify-between gap-4">
            <dt className="flex items-center gap-1.5 self-center text-[13px] text-on-forest-muted"><Icon className="size-3.5" />{label}</dt>
            <dd className="tabular text-[15px] leading-6 font-bold whitespace-nowrap">{money(key)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
