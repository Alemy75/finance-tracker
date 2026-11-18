import type { Category, FinanceTransaction, Goal, GoalMove, Settings, Transfer } from "./finance";

export type SyncKind = "settings" | "category" | "goal" | "goalMove" | "transaction" | "transfer";
export type SyncEntity = Settings | Category | Goal | GoalMove | FinanceTransaction | Transfer;

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
  categories: Category[];
  goals: Goal[];
  goalMoves: GoalMove[];
  transactions: FinanceTransaction[];
  transfers: Transfer[];
}

export interface SyncResult {
  status: "accepted" | "conflict";
  version?: number;
  reason?: string;
  remote?: SyncEntity | null;
  retryable?: boolean;
}
