import { useState } from "react";
import type { FormEvent } from "react";
import { SetupCard } from "@/components/app/setup-card";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { parseMoney } from "@/finance";
import type { Settings } from "@/finance";

export function OpeningSetup({ onSave }: { onSave: (settings: Settings) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const openingBalanceKopeks = parseMoney(amount);
    if (openingBalanceKopeks === null) {
      setError("Введите сумму в рублях, не более двух знаков после запятой.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ id: "main", openingBalanceKopeks, startedAt: new Date().toISOString() });
    } catch {
      setError("Не удалось сохранить сумму на устройстве. Проверьте доступ к хранилищу браузера.");
      setSaving(false);
    }
  }

  return (
    <SetupCard eyebrow="Первый шаг" title="Сколько сейчас на карте?"
      description="Введите текущий остаток вашей карты. Это будет точка отсчёта; дальше остаток изменят доходы и расходы."
      footnote="Сумма сохранится на устройстве и после подключения появится в общем профиле.">
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <Field label="Стартовый капитал, ₽" htmlFor="opening-amount">
          <MoneyInput id="opening-amount" placeholder="Например, 50 000" value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving}>{saving ? "Сохраняем…" : "Начать учёт"}</Button>
      </form>
    </SetupCard>
  );
}
