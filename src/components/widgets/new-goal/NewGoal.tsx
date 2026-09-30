import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldSkeleton, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { parseMoney } from "@/finance";
import type { NewGoalProps } from "./types";

function NewGoalForm({ di }: NewGoalProps) {
  const createGoal = useMutation(di.createGoal.mo());
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetKopeks = parseMoney(target);
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 120 || !targetKopeks) {
      setError("Введите название и желаемую сумму больше нуля.");
      return;
    }
    setError("");
    try {
      const now = new Date().toISOString();
      await createGoal.mutateAsync({ id: crypto.randomUUID(), name: trimmedName, targetKopeks, createdAt: now, updatedAt: now });
      setName("");
      setTarget("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить цель на устройстве.");
    }
  }

  return (
    <Card className="gap-0 p-5" data-sk="goal-create">
      <form className="grid gap-4" onSubmit={create} noValidate>
        <h3 className="text-[17px] leading-6 font-bold">Новая цель</h3>
        <Field label="Название" htmlFor="goal-name">
          <Input id="goal-name" type="text" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, отпуск" required />
        </Field>
        <Field label="Желаемая сумма, ₽" htmlFor="goal-target">
          <MoneyInput id="goal-target" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="0" required />
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={createGoal.isPending}>{createGoal.isPending ? "Сохраняем…" : "Создать цель"}</Button>
      </form>
    </Card>
  );
}

function NewGoalSkeleton() {
  return (
    <Card className="gap-0 p-5" data-sk="goal-create" aria-hidden="true">
      <div className="grid gap-4">
        <h3 className="text-[17px] leading-6 font-bold"><SkeletonText sample="Новая цель" /></h3>
        <FieldSkeleton label="Название" />
        <FieldSkeleton label="Желаемая сумма, ₽" />
        <Skeleton className="h-12" />
      </div>
    </Card>
  );
}

/** Form for a new savings goal. */
export function NewGoal({ di, skeleton = false, className }: NewGoalProps) {
  return (
    <SkeletonSwap className={className} loading={skeleton} skeleton={() => <NewGoalSkeleton />}>
      <NewGoalForm di={di} />
    </SkeletonSwap>
  );
}
