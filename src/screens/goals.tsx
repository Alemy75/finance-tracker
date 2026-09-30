import { useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BalanceCard } from "@/components/app/balance-card";
import { GoalCard, GoalCardSkeleton } from "@/components/app/goal-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldSkeleton, FormError } from "@/components/ui/field";
import { IconTarget } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { cardBalance, freeBalance, goalBalance, parseMoney } from "@/finance";
import type { Goal, GoalMove } from "@/finance";
import type { LocalData } from "@/localData";
import { easeOut } from "@/lib/motion";

function goalsModel(data: LocalData) {
  const balance = data.settings ? cardBalance(data.settings, data.transactions) : 0;
  const free = data.settings ? freeBalance(data.settings, data.goals, data.goalMoves, data.transactions) : 0;
  return {
    values: data.settings ? { free, balance, allocated: balance - free } : undefined,
    goals: data.goals.filter((goal) => !goal.archivedAt),
    allocated: (id: string) => goalBalance(id, data.goalMoves, data.transactions)
  };
}

const emptyGoals = { title: "Целей пока нет", description: "Создайте цель и выделяйте на неё деньги с карты." };

function NewGoalForm({ onCreate }: { onCreate: (goal: Goal) => Promise<void> }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetKopeks = parseMoney(target);
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 120 || !targetKopeks) {
      setError("Введите название и желаемую сумму больше нуля.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      await onCreate({ id: crypto.randomUUID(), name: trimmedName, targetKopeks, createdAt: now, updatedAt: now });
      setName("");
      setTarget("");
    } catch {
      setError("Не удалось сохранить цель на устройстве.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-5 gap-0 p-5" data-sk="goal-create">
      <form className="grid gap-4" onSubmit={create} noValidate>
        <h3 className="text-[17px] leading-6 font-bold">Новая цель</h3>
        <Field label="Название" htmlFor="goal-name">
          <Input id="goal-name" type="text" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, отпуск" required />
        </Field>
        <Field label="Желаемая сумма, ₽" htmlFor="goal-target">
          <MoneyInput id="goal-target" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="0" required />
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving}>{saving ? "Сохраняем…" : "Создать цель"}</Button>
      </form>
    </Card>
  );
}

export function Goals({ data, onCreate, onMove }: {
  data: LocalData;
  onCreate: (goal: Goal) => Promise<void>;
  onMove: (move: GoalMove) => Promise<void>;
}) {
  const model = goalsModel(data);
  return (
    <section className="mt-3">
      <BalanceCard size="compact" values={model.values} className="mb-7" />
      <SectionHeading title="Мои цели" />
      {model.goals.length === 0 ? <EmptyState icon={<IconTarget className="size-5" />} {...emptyGoals} /> : (
        <div className="grid gap-3">
          <AnimatePresence initial={false}>
            {model.goals.map((goal) => (
              <motion.div key={goal.id} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={easeOut}>
                <GoalCard goal={goal} allocated={model.allocated(goal.id)} onMove={onMove} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      <NewGoalForm onCreate={onCreate} />
    </section>
  );
}

export function GoalsSkeleton({ data }: { data: LocalData | null }) {
  const model = data ? goalsModel(data) : null;
  return (
    <section className="mt-3" aria-hidden="true">
      <BalanceCard skeleton size="compact" values={model?.values} className="mb-7" />
      <SectionHeading title={<SkeletonText sample="Мои цели" />} />
      {model && model.goals.length > 0 ? (
        <div className="grid gap-3">{model.goals.map((goal) => <GoalCardSkeleton key={goal.id} goal={goal} allocated={model.allocated(goal.id)} />)}</div>
      ) : <EmptyState skeleton {...emptyGoals} />}
      <Card className="mt-5 gap-0 p-5" data-sk="goal-create">
        <div className="grid gap-4">
          <h3 className="text-[17px] leading-6 font-bold"><SkeletonText sample="Новая цель" /></h3>
          <FieldSkeleton label="Название" />
          <FieldSkeleton label="Желаемая сумма, ₽" />
          <Skeleton className="h-12" />
        </div>
      </Card>
    </section>
  );
}
