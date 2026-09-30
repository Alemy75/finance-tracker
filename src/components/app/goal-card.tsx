import { useState } from "react";
import type { FormEvent } from "react";
import { goalProgress } from "@/components/app/goal-summary";
import { AnimatedMoney } from "@/components/ui/animated-money";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { IconMinus, IconPlus } from "@/components/ui/icons";
import { MoneyInput } from "@/components/ui/money-input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { formatMoney, parseMoney } from "@/finance";
import { useRetained } from "@/hooks/use-retained";
import type { Goal, GoalMove } from "@/finance";

type Action = "allocate" | "release";

const cardClassName = "rounded-xl border bg-card p-5 shadow-xs";

function GoalMoveForm({ goal, action, onMove, onDone }: {
  goal: Goal;
  action: Action;
  onMove: (move: GoalMove) => Promise<void>;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const kopeks = parseMoney(amount);
    if (!kopeks) {
      setError("Введите сумму больше нуля.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      await onMove({ id: crypto.randomUUID(), goalId: goal.id,
        amountKopeks: action === "allocate" ? kopeks : -kopeks,
        occurredAt: now, createdAt: now });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить изменение цели.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <Field label={action === "allocate" ? "Сколько выделить, ₽" : "Сколько вернуть, ₽"} htmlFor={`goal-amount-${goal.id}`}>
        <MoneyInput id={`goal-amount-${goal.id}`} size="lg" placeholder="0" autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} required />
      </Field>
      <FormError message={error} />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onDone}>Отмена</Button>
        <Button type="submit" size="lg" disabled={saving}>{saving ? "Сохраняем…" : action === "allocate" ? "Выделить" : "Вернуть"}</Button>
      </div>
    </form>
  );
}

export function GoalCard({ goal, allocated, onMove }: {
  goal: Goal;
  allocated: number;
  onMove: (move: GoalMove) => Promise<void>;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const [opened, setOpened] = useState(0);
  const shownAction = useRetained(action) ?? "allocate";
  const progress = goalProgress(allocated, goal.targetKopeks);
  const open = (next: Action) => { setAction(next); setOpened((count) => count + 1); };

  return (
    <article className={cardClassName} data-sk="goal-card">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 text-[17px] leading-6 font-bold">{goal.name}</h3>
        <strong className="text-[17px] leading-6 font-extrabold whitespace-nowrap"><AnimatedMoney value={allocated} /></strong>
      </div>
      <AnimatedProgress className="mt-3.5" value={progress} label={`Прогресс цели ${goal.name}`} />
      <p className="mt-2 mb-4 text-xs leading-4 text-muted-foreground">Цель: {formatMoney(goal.targetKopeks)} · {progress}%</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => open("allocate")}><IconPlus />Выделить</Button>
        <Button variant="outline" onClick={() => open("release")} disabled={allocated <= 0}><IconMinus />Вернуть</Button>
      </div>
      <ResponsiveDialog open={action !== null} onOpenChange={(next) => { if (!next) setAction(null); }}
        title={`${shownAction === "allocate" ? "Выделить на цель" : "Вернуть из цели"} «${goal.name}»`}
        description={shownAction === "allocate" ? "Деньги останутся на карте, но перестанут считаться свободными." : `Сейчас на цели ${formatMoney(allocated)}.`}>
        <GoalMoveForm key={opened} goal={goal} action={shownAction} onMove={onMove} onDone={() => setAction(null)} />
      </ResponsiveDialog>
    </article>
  );
}

export function GoalCardSkeleton({ goal, allocated }: { goal: Goal; allocated: number }) {
  const progress = goalProgress(allocated, goal.targetKopeks);
  return (
    <div className={cardClassName} data-sk="goal-card" aria-hidden="true">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 text-[17px] leading-6 font-bold"><SkeletonText sample={goal.name} /></h3>
        <strong className="text-[17px] leading-6 font-extrabold whitespace-nowrap"><SkeletonText sample={formatMoney(allocated)} /></strong>
      </div>
      <div className="mt-3.5 h-2 rounded-full bg-muted" />
      <p className="mt-2 mb-4 text-xs leading-4"><SkeletonText sample={`Цель: ${formatMoney(goal.targetKopeks)} · ${progress}%`} /></p>
      <div className="grid grid-cols-2 gap-2"><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
    </div>
  );
}
