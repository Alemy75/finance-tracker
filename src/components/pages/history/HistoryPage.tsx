import type { PageProps } from "@/components/pages/types";
import { History } from "@/components/widgets/history";
import { TbankImport } from "@/components/widgets/tbank-import";

export function HistoryPage({ di, skeleton }: PageProps) {
  return (
    <div className="grid gap-3 pt-3">
      <TbankImport di={di} skeleton={skeleton} />
      <History di={di} skeleton={skeleton} />
    </div>
  );
}
