import type { PageProps } from "@/components/pages/types";
import { History } from "@/components/widgets/history";

export function HistoryPage({ di, skeleton }: PageProps) {
  return (
    <div className="pt-3">
      <History di={di} skeleton={skeleton} />
    </div>
  );
}
