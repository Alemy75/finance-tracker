export const bootstrapUrl = () => "/api/bootstrap" as const;
export const syncUrl = () => "/api/sync" as const;
export const exportUrl = () => "/api/export" as const;
export const resolveConflictKey = () => ["sync", "resolve-conflict"] as const;

export const SESSION_EXPIRED = "Сессия завершилась. Войдите снова.";
