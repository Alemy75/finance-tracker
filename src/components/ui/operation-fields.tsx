import { IconArrowDownLeft, IconArrowUpRight } from "@/components/ui/icons";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Author, Category, TransactionType } from "@/finance";

export const typeOptions = [
  { value: "expense", label: "Расход", icon: <IconArrowUpRight className="size-4" /> },
  { value: "income", label: "Доход", icon: <IconArrowDownLeft className="size-4" /> }
] as const;

export function sortedCategories(categories: Category[], type: TransactionType): Category[] {
  return categories.filter((category) => category.type === type).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function AuthorSelect({ id, value, onChange }: { id: string; value: Author; onChange: (author: Author) => void }) {
  return (
    <NativeSelect id={id} value={value ?? ""} onChange={(event) => onChange((event.target.value || null) as Author)}>
      <NativeSelectOption value="">Не указано</NativeSelectOption>
      <NativeSelectOption value="self">Я</NativeSelectOption>
      <NativeSelectOption value="wife">Жена</NativeSelectOption>
    </NativeSelect>
  );
}
