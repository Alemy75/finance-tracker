import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { SetupCard } from "@/components/ui/setup-card";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { parseMoney } from "@/finance";
import type { OpeningSetupProps } from "./types";

/** First step: the current card balance becomes the starting point of the accounting. */
export function OpeningSetup({ di }: OpeningSetupProps) {
  const saveOpeningBalance = useMutation(di.saveOpeningBalance.mo());
  const [amount, setAmount] = useState("");
  const [cash, setCash] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const openingBalanceKopeks = parseMoney(amount);
    const openingCashKopeks = parseMoney(cash || "0");
    if (openingBalanceKopeks === null || openingCashKopeks === null) {
      setError("Введите сумму в рублях, не более двух знаков после запятой.");
      return;
    }
    setError("");
    try {
      await saveOpeningBalance.mutateAsync({ id: "main", openingBalanceKopeks, openingCashKopeks, startedAt: new Date().toISOString() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить сумму на устройстве. Проверьте доступ к хранилищу браузера.");
    }
  }

  return (
    <SetupCard eyebrow="Первый шаг" title="Сколько сейчас денег?"
      description="Введите текущий остаток карты и наличных. Это будет точка отсчёта; дальше остатки изменят доходы, расходы и переводы."
      footnote="Сумма сохранится на устройстве и после подключения появится в общем профиле.">
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <Field label="На карте, ₽" htmlFor="opening-amount">
          <MoneyInput id="opening-amount" placeholder="Например, 50 000" value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </Field>
        <Field label="Наличные, ₽" htmlFor="opening-cash" hint="Если наличных нет, оставьте поле пустым.">
          <MoneyInput id="opening-cash" placeholder="0" value={cash} onChange={(event) => setCash(event.target.value)} />
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saveOpeningBalance.isPending}>{saveOpeningBalance.isPending ? "Сохраняем…" : "Начать учёт"}</Button>
      </form>
    </SetupCard>
  );
}
