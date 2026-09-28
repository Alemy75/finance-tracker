import type { FinanceTransaction, Goal, GoalMove, Settings } from "./finance";

export type SyncKind = "settings" | "goal" | "goalMove" | "transaction";
export type SyncEntity = Settings | Goal | GoalMove | FinanceTransaction;

export interface PendingMutation {
  sequence?: number;
  id: string;
  kind: SyncKind;
  entityId: string;
  baseVersion: number;
  payload: SyncEntity;
  state: "pending" | "conflict";
  reason?: string;
  remote?: SyncEntity | null;
}

export interface SyncSnapshot {
  settings: Settings | null;
  categories: import("./finance").Category[];
  goals: Goal[];
  goalMoves: GoalMove[];
  transactions: FinanceTransaction[];
}

export interface SyncResult {
  status: "accepted" | "conflict";
  version?: number;
  reason?: string;
  remote?: SyncEntity | null;
  retryable?: boolean;
}
