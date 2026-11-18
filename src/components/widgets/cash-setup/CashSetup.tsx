import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/field";
import { IconPocket } from "@/components/ui/icons";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { parseMoney } from "@/finance";
import { useLocalData } from "@/hooks/use-local-data";
import type { CashSetupProps } from "./types";

const title = "Сколько сейчас наличных?";
const description = "Укажите, сколько наличных в семейном кошельке. Сумма станет стартовым остатком наличных; если их нет, укажите 0.";

function CashSetupForm({ di }: Pick<CashSetupProps, "di">) {
  const saveOpeningCash = useMutation(di.saveOpeningCash.mo());
  const [amount, setAmount] = useState("");
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить сумму на устройстве.");
    }
  }

  return (
    <Card className="gap-0 border-dashed p-5" data-sk="cash-setup">
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime/25 text-forest-2 dark:bg-lime/10 dark:text-lime"><IconPocket className="size-5" /></span>
          <div className="grid gap-1">
            <h2 className="text-[17px] leading-6 font-bold">{title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="opening-cash" className="sr-only">Наличные, ₽</Label>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <MoneyInput id="opening-cash" placeholder="0" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <Button type="submit" className="h-12 px-5" disabled={saveOpeningCash.isPending}>{saveOpeningCash.isPending ? "Сохраняем…" : "Сохранить"}</Button>
          </div>
          <FormError message={error} />
        </div>
      </form>
    </Card>
  );
}

function CashSetupSkeleton() {
  return (
    <Card className="gap-0 border-dashed p-5" data-sk="cash-setup" aria-hidden="true">
      <div className="grid gap-4">
        <div className="flex items-start gap-3">
          <span className="skeleton-shimmer size-10 shrink-0 rounded-full bg-skeleton" />
          <div className="grid gap-1">
            <h2 className="text-[17px] leading-6 font-bold"><SkeletonText sample={title} /></h2>
            <p className="text-sm leading-relaxed"><SkeletonText sample={description} /></p>
          </div>
        </div>
        <div className="grid gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><Skeleton className="h-12" /><Skeleton className="h-12 w-[7.5rem]" /></div>
        </div>
      </div>
    </Card>
  );
}

/** Asks for the starting cash once; renders nothing after it has been entered. */
export function CashSetup({ di, skeleton = false }: CashSetupProps) {
  const settings = useLocalData(di)?.settings;
  if (!settings || (settings.openingCashKopeks !== undefined && settings.openingCashKopeks !== null)) return null;
  return (
    <SkeletonSwap loading={skeleton} skeleton={() => <CashSetupSkeleton />}>
      <CashSetupForm di={di} />
    </SkeletonSwap>
  );
}
