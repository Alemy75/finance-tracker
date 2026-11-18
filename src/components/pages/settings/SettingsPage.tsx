import type { PageProps } from "@/components/pages/types";
import { Backup } from "@/components/widgets/backup";
import { CashSettings } from "@/components/widgets/cash-settings";
import { Categories } from "@/components/widgets/categories";

export function SettingsPage({ di, skeleton }: PageProps) {
  return (
    <div className="flex flex-col gap-7 pt-3">
      <Categories di={di} type="expense" skeleton={skeleton} />
      <Categories di={di} type="income" skeleton={skeleton} />
      <CashSettings di={di} skeleton={skeleton} />
      <Backup di={di} skeleton={skeleton} />
    </div>
  );
}
