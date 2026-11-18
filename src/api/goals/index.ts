import { createMutationService } from "@/lib/query";
import { freeBalance, goalBalance } from "@/finance";
import type { Goal, GoalMove } from "@/finance";
import { updateLocalData } from "@/api/local-data";
import type { LocalMutationDeps } from "@/api/local-data";

export const createGoalKey = () => ["goals", "create"] as const;
export const moveGoalMoneyKey = () => ["goals", "move"] as const;

export function createCreateGoal(deps: LocalMutationDeps) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: createGoalKey(),
    mutationFn: async (goal: Goal) => {
      await deps.localDb.saveGoal(goal).catch((cause: unknown) => {
        throw new Error("Не удалось сохранить цель на устройстве.", { cause });
      });
      return { ...goal, version: 1 };
    },
    onSuccess: (saved) => {
      updateLocalData(deps.queryClient, (data) => ({ ...data, goals: [...data.goals, saved] }));
      deps.onLocalChange();
    }
  }));
}

export function createMoveGoalMoney(deps: LocalMutationDeps) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: moveGoalMoneyKey(),
    mutationFn: async (move: GoalMove) => {
      const data = await deps.getLocalData();
      if (!data.settings || !data.goals.some((goal) => goal.id === move.goalId && !goal.archivedAt)) {
        throw new Error("Цель не найдена.");
      }
      if (move.amountKopeks > 0 && move.amountKopeks > freeBalance(data.settings, data.goals, data.goalMoves, data.transactions)) {
        throw new Error("Свободных денег для этой суммы недостаточно.");
      }
      if (move.amountKopeks < 0 && -move.amountKopeks > goalBalance(move.goalId, data.goalMoves, data.transactions)) {
        throw new Error("Нельзя вернуть больше, чем выделено на цель.");
      }
      await deps.localDb.saveGoalMove(move);
      return move;
    },
    onSuccess: (move) => {
      updateLocalData(deps.queryClient, (data) => ({ ...data, goalMoves: [...data.goalMoves, move] }));
      deps.onLocalChange();
    }
  }));
}
