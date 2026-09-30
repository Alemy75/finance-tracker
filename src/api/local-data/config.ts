import type { QueryKey } from "@tanstack/react-query";

export const localDataKey = () => ["local", "data"] as const satisfies QueryKey;
export const outboxKey = () => ["local", "outbox"] as const satisfies QueryKey;
