import { createMutationService } from "@/lib/query";
import type { Category, TransactionType } from "@/finance";
import { updateLocalData } from "@/api/local-data";
import type { LocalMutationDeps } from "@/api/local-data";
import type { LocalData } from "@/services/local-db";

export const createCategoryKey = () => ["categories", "create"] as const;
export const renameCategoryKey = () => ["categories", "rename"] as const;

function checkedCategoryName(data: LocalData, type: TransactionType, name: string, exceptId?: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) throw new Error("Название категории должно содержать от 1 до 80 символов.");
  if (data.categories.some((item) => item.type === type && item.id !== exceptId
    && item.name.toLocaleLowerCase("ru-RU") === trimmed.toLocaleLowerCase("ru-RU"))) {
    throw new Error("Категория с таким названием уже есть.");
  }
  return trimmed;
}

export function createCreateCategory(deps: LocalMutationDeps) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: createCategoryKey(),
    mutationFn: async ({ type, name }: { type: TransactionType; name: string }): Promise<Category> => {
      const data = await deps.getLocalData();
      return deps.localDb.saveCategory({ id: crypto.randomUUID(), type, name: checkedCategoryName(data, type, name),
        sortOrder: Math.max(-1, ...data.categories.filter((item) => item.type === type).map((item) => item.sortOrder)) + 1 });
    },
    onSuccess: (saved) => {
      updateLocalData(deps.queryClient, (data) => ({ ...data, categories: [...data.categories, saved] }));
      deps.onLocalChange();
    }
  }));
}

export function createRenameCategory(deps: LocalMutationDeps) {
  return createMutationService(deps.queryClient, () => ({
    mutationKey: renameCategoryKey(),
    mutationFn: async ({ id, name }: { id: string; name: string }): Promise<Category | null> => {
      const data = await deps.getLocalData();
      const existing = data.categories.find((item) => item.id === id);
      if (!existing) throw new Error("Категория не найдена.");
      const checked = checkedCategoryName(data, existing.type, name, id);
      if (checked === existing.name) return null;
      return deps.localDb.renameCategory({ ...existing, name: checked });
    },
    onSuccess: (saved) => {
      if (!saved) return;
      updateLocalData(deps.queryClient, (data) => ({ ...data, categories: data.categories.map((item) => item.id === saved.id ? saved : item) }));
      deps.onLocalChange();
    }
  }));
}
