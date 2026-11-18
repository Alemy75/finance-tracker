import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { IconEdit2, IconPlus } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sortedCategories } from "@/components/ui/operation-fields";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { initialCategories } from "@/finance";
import type { Category } from "@/finance";
import { useLocalData } from "@/hooks/use-local-data";
import { useRetained } from "@/hooks/use-retained";
import type { Di } from "@/lib/di";
import { collapse, easeOut } from "@/lib/motion";
import type { CategoriesProps } from "./types";

const titles = { expense: "Категории расходов", income: "Категории доходов" } as const;
const rowClassName = "flex min-h-12 items-center justify-between gap-3";

function RenameForm({ di, category, onDone }: { di: Di; category: Category; onDone: () => void }) {
  const renameCategory = useMutation(di.renameCategory.mo());
  const [name, setName] = useState(category.name);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await renameCategory.mutateAsync({ id: category.id, name });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось переименовать категорию.");
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <Field label="Новое название" htmlFor={`rename-${category.id}`}>
        <Input id={`rename-${category.id}`} type="text" maxLength={80} autoFocus value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>
      <FormError message={error} />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" disabled={renameCategory.isPending} onClick={onDone}>Отмена</Button>
        <Button type="submit" size="lg" disabled={renameCategory.isPending}>{renameCategory.isPending ? "Сохраняем…" : "Сохранить"}</Button>
      </div>
    </form>
  );
}

function CategoriesContent({ di, type, categories }: CategoriesProps & { categories: Category[] }) {
  const createCategory = useMutation(di.createCategory.mo());
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<Category | null>(null);
  const [error, setError] = useState("");
  const shownRenaming = useRetained(renaming);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await createCategory.mutateAsync({ type, name: newName });
      setNewName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось добавить категорию.");
    }
  }

  return (
    <section aria-labelledby={`${type}-categories-title`} data-sk={`categories-${type}`}>
      <SectionHeading id={`${type}-categories-title`} title={titles[type]} />
      <Card className="gap-0 px-4 py-2">
        <ul>
          <AnimatePresence initial={false}>
            {categories.map((category, index) => (
              <motion.li key={category.id} {...collapse} transition={easeOut} className={index > 0 ? "border-t" : undefined}>
                <div className={rowClassName}>
                  <strong className="text-sm font-semibold [overflow-wrap:anywhere]">{category.name}</strong>
                  <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground" disabled={createCategory.isPending}
                    onClick={() => { setRenaming(category); setError(""); }}><IconEdit2 className="size-3.5" />Переименовать</Button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <form className="grid gap-2 border-t pt-4 pb-3" onSubmit={create} noValidate>
          <Label htmlFor={`new-${type}-category`}>Новая категория</Label>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Input id={`new-${type}-category`} type="text" maxLength={80} value={newName}
              onChange={(event) => setNewName(event.target.value)} placeholder="Название" required />
            <Button type="submit" className="h-12 px-4" disabled={createCategory.isPending}><IconPlus />{createCategory.isPending ? "Добавляем…" : "Добавить"}</Button>
          </div>
          <FormError message={error} />
        </form>
      </Card>
      <ResponsiveDialog open={renaming !== null} onOpenChange={(open) => { if (!open) setRenaming(null); }}
        title="Переименовать категорию" description={shownRenaming ? `Сейчас: «${shownRenaming.name}». Новое название появится во всех записях.` : undefined}>
        {shownRenaming && <RenameForm key={shownRenaming.id} di={di} category={shownRenaming} onDone={() => setRenaming(null)} />}
      </ResponsiveDialog>
    </section>
  );
}

function CategoriesSkeleton({ type, categories }: { type: CategoriesProps["type"]; categories: Category[] }) {
  return (
    <section data-sk={`categories-${type}`} aria-hidden="true">
      <SectionHeading title={<SkeletonText sample={titles[type]} />} />
      <Card className="gap-0 px-4 py-2">
        <ul>
          {categories.map((category, index) => (
            <li key={category.id} className={index > 0 ? "border-t" : undefined}>
              <div className={rowClassName}>
                <strong className="text-sm font-semibold"><SkeletonText sample={category.name} /></strong>
                <span className="-mr-2 inline-flex h-9 items-center px-3 text-sm font-semibold"><SkeletonText sample="__Переименовать" /></span>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 border-t pt-4 pb-3">
          <span className="text-[13px] leading-none font-semibold"><SkeletonText sample="Новая категория" /></span>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><Skeleton className="h-12" /><Skeleton className="h-12 w-[7.5rem]" /></div>
        </div>
      </Card>
    </section>
  );
}

/** Expense or income categories: list, rename and add. */
export function Categories({ di, type, skeleton = false }: CategoriesProps) {
  const data = useLocalData(di);
  const categories = sortedCategories(data?.categories ?? initialCategories, type);
  return (
    <SkeletonSwap loading={skeleton || !data} skeleton={() => <CategoriesSkeleton type={type} categories={categories} />}>
      <CategoriesContent di={di} type={type} categories={categories} />
    </SkeletonSwap>
  );
}
