import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { IconEdit2 } from "@/components/ui/icons";
import { MoneyInput } from "@/components/ui/money-input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { cashBalance, formatMoney, parseMoney } from "@/finance";
import { useLocalData } from "@/hooks/use-local-data";
import type { Di } from "@/lib/di";
import type { LocalData } from "@/services/local-db";
import type { CashSettingsProps } from "./types";

const rowClassName = "flex min-h-12 items-center justify-between gap-3";

function cashModel(data: LocalData | undefined) {
  const opening = data?.settings?.openingCashKopeks ?? null;
  return {
    opening,
    openingLabel: opening === null ? "Не указан" : formatMoney(opening),
    current: formatMoney(data?.settings ? cashBalance(data.settings, data.transactions, data.transfers) : 0)
  };
}

function OpeningCashForm({ di, opening, onDone }: { di: Di; opening: number | null; onDone: () => void }) {
  const saveOpeningCash = useMutation(di.saveOpeningCash.mo());
  const [amount, setAmount] = useState(opening === null ? "" : (opening / 100).toFixed(2).replace(".", ","));
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const kopeks = parseMoney(amount || "0");
    if (kopeks === null) {
      setError("Введите сумму в рублях, не более двух знаков после запятой.");
      return;
    }
    setError("");
    try {
      await saveOpeningCash.mutateAsync(kopeks);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить сумму на устройстве.");
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <Field label="Стартовый остаток наличных, ₽" htmlFor="settings-opening-cash">
        <MoneyInput id="settings-opening-cash" size="lg" placeholder="0" autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <FormError message={error} />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onDone}>Отмена</Button>
        <Button type="submit" size="lg" disabled={saveOpeningCash.isPending}>{saveOpeningCash.isPending ? "Сохраняем…" : "Сохранить"}</Button>
      </div>
    </form>
  );
}

function CashRows({ model, skeleton = false, action }: { model: ReturnType<typeof cashModel>; skeleton?: boolean; action: React.ReactNode }) {
  const text = (value: string) => skeleton ? <SkeletonText sample={value} /> : value;
  return (
    <Card className="gap-0 px-4 py-2">
      <div className={rowClassName}>
        <span className="text-sm text-muted-foreground">{text("Сейчас в кошельке")}</span>
        <strong className="tabular text-sm font-semibold">{text(model.current)}</strong>
      </div>
      <div className={`${rowClassName} border-t`}>
        <div className="grid gap-0.5 py-2">
          <span className="text-sm text-muted-foreground">{text("Стартовый остаток")}</span>
          <strong className="tabular text-sm font-semibold">{text(model.openingLabel)}</strong>
        </div>
        {action}
      </div>
    </Card>
  );
}

/** Starting cash of the wallet with its correction. */
export function CashSettings({ di, skeleton = false }: CashSettingsProps) {
  const data = useLocalData(di);
  const model = cashModel(data);
  const [editing, setEditing] = useState(false);
  return (
    <SkeletonSwap loading={skeleton || !data} skeleton={() => (
      <section data-sk="cash-settings" aria-hidden="true">
        <SectionHeading title={<SkeletonText sample="Наличные" />} />
        <CashRows skeleton model={model} action={<span className="-mr-2 inline-flex h-9 items-center px-3 text-sm font-semibold"><SkeletonText sample="__Изменить" /></span>} />
      </section>
    )}>
      <section data-sk="cash-settings" aria-labelledby="cash-settings-title">
        <SectionHeading id="cash-settings-title" title="Наличные" />
        <CashRows model={model} action={
          <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground" onClick={() => setEditing(true)}><IconEdit2 className="size-3.5" />Изменить</Button>
        } />
        <ResponsiveDialog open={editing} onOpenChange={setEditing} title="Стартовый остаток наличных"
          description="Сколько наличных было, когда вы начали их учитывать. Текущий остаток пересчитается.">
          <OpeningCashForm di={di} opening={model.opening} onDone={() => setEditing(false)} />
        </ResponsiveDialog>
      </section>
    </SkeletonSwap>
  );
}
