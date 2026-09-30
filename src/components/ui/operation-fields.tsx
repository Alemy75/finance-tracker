import { IconArrowDownLeft, IconArrowUpRight, IconCreditCard, IconPocket, IconRepeat } from "@/components/ui/icons";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { accountLabels, transferTarget } from "@/finance";
import type { Account, Author, Category, TransactionType } from "@/finance";

export const typeOptions = [
  { value: "expense", label: "Расход", icon: <IconArrowUpRight className="size-4" /> },
  { value: "income", label: "Доход", icon: <IconArrowDownLeft className="size-4" /> }
] as const;

export type EntryKind = TransactionType | "transfer";

export const entryKindOptions = [
  ...typeOptions,
  { value: "transfer", label: "Перевод", icon: <IconRepeat className="size-4" /> }
] as const;

export const accountOptions = [
  { value: "card", label: accountLabels.card, icon: <IconCreditCard className="size-4" /> },
  { value: "cash", label: accountLabels.cash, icon: <IconPocket className="size-4" /> }
] as const;

/** "Карта → Наличные": the direction of a transfer that starts from `from`. */
export function transferLabel(from: Account): string {
  return `${accountLabels[from]} → ${accountLabels[transferTarget({ from })]}`;
}

export const transferOptions = [
  { value: "card", label: transferLabel("card") },
  { value: "cash", label: transferLabel("cash") }
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

/** ISO date as the value of a `datetime-local` input in the device's time zone. */
export function localDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
